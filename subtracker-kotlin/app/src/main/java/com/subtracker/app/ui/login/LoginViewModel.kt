package com.baritzy.subtracker.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.baritzy.subtracker.analytics.Analytics
import com.baritzy.subtracker.analytics.LoginMethod
import com.baritzy.subtracker.billing.BillingManager
import com.baritzy.subtracker.data.api.SubTrackerApi
import com.baritzy.subtracker.data.repository.AuthRepository
import com.baritzy.subtracker.data.repository.PremiumRepository
import com.baritzy.subtracker.notifications.FcmTokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val api: SubTrackerApi,
    private val fcmTokenManager: FcmTokenManager,
    private val premiumRepository: PremiumRepository,
    private val analytics: Analytics
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState = _uiState.asStateFlow()

    init {
        checkExistingToken()
    }

    // Called after every successful identity change (real Google login, the
    // web-callback token flow, or a fresh guest account) -- NOT after
    // resuming an existing session in checkExistingToken(). Two things a
    // stale identity would otherwise get wrong:
    // 1. A previously-seeded PREMIUM flag on this device could belong to a
    //    different person (shared device) and must not leak into the new
    //    identity.
    // 2. MainActivity initializes Billing before any login can happen, so
    //    its automatic purchase check can run under a guest identity and
    //    bind /verify to the wrong account. Forcing a fresh local-purchase
    //    check now, under the just-saved auth token, is what actually lets
    //    the server's orphaned-anonymous-account transfer run.
    private fun onIdentityChanged() {
        premiumRepository.reset()
        BillingManager.forceRefresh()
        viewModelScope.launch {
            premiumRepository.refreshFromServer()
        }
    }

    private fun checkExistingToken() {
        viewModelScope.launch {
            val token = authRepository.getToken()
            if (token != null) {
                val result = authRepository.getCurrentUser()
                if (result.isSuccess) {
                    _uiState.update { it.copy(isLoggedIn = true) }
                    launch { try { fcmTokenManager.ensureTokenRegistered() } catch (_: Exception) {} }
                }
            }
        }
    }

    fun handleGoogleIdToken(idToken: String, photoUrl: String? = null, displayName: String? = null, accountEmail: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.exchangeNativeAuthCode(mapOf("id_token" to idToken))
                if (response.isSuccessful && response.body() != null) {
                    val token = response.body()!!["token"] as String
                    val email = accountEmail ?: ""
                    // Persist auth inside NonCancellable: saving the token flips the app to the
                    // logged-in state, which tears down this screen + ViewModel mid-coroutine.
                    // Without this guard the save is cancelled and the user falls back to guest.
                    // (fixed 2026-08-03)
                    kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) {
                        authRepository.saveToken(token)
                        authRepository.getCurrentUser()
                        authRepository.saveUser(email, displayName, photoUrl)
                    }
                    onIdentityChanged()
                    _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
                    analytics.loginCompleted(LoginMethod.GOOGLE)
                    // Register FCM in background — don't block login
                    launch { try { fcmTokenManager.ensureTokenRegistered() } catch (_: Exception) {} }
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    _uiState.update { it.copy(isLoading = false, error = "שגיאה בהתחברות: $errorBody") }
                }
            } catch (e: Exception) {
                android.util.Log.e("LoginScreen", "VM exchange exception: ${e.javaClass.simpleName} - ${e.message}", e)
                _uiState.update { it.copy(isLoading = false, error = "שגיאת רשת: ${e.message}") }
            }
        }
    }

    fun handleTokenFromCallback(token: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            authRepository.saveToken(token)
            val result = authRepository.getCurrentUser()
            if (result.isSuccess) {
                onIdentityChanged()
                _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
                analytics.loginCompleted(LoginMethod.GOOGLE)
                launch { try { fcmTokenManager.ensureTokenRegistered() } catch (_: Exception) {} }
            } else {
                _uiState.update { it.copy(isLoading = false, error = "שגיאה בהתחברות") }
            }
        }
    }

    fun loginAsGuest() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = authRepository.createAnonymousUser()
            if (result.isSuccess) {
                onIdentityChanged()
                _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
                analytics.loginCompleted(LoginMethod.GUEST)
                launch { try { fcmTokenManager.ensureTokenRegistered() } catch (_: Exception) {} }
            } else {
                _uiState.update {
                    it.copy(isLoading = false, error = "שגיאה ביצירת חשבון אורח")
                }
            }
        }
    }
}
