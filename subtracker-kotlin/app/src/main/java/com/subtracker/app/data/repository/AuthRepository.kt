package com.baritzy.subtracker.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.baritzy.subtracker.data.api.SubTrackerApi
import com.baritzy.subtracker.data.model.UserInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "auth")

@Singleton
class AuthRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SubTrackerApi,
    private val premiumRepository: PremiumRepository
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("auth_token")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
        private val USER_NAME_KEY = stringPreferencesKey("user_name")
        private val USER_PHOTO_KEY = stringPreferencesKey("user_photo")
    }

    val token: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[TOKEN_KEY]
    }

    val userEmail: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_EMAIL_KEY]
    }

    val userName: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_NAME_KEY]
    }

    val userPhoto: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_PHOTO_KEY]
    }

    suspend fun getToken(): String? {
        return context.dataStore.data.first()[TOKEN_KEY]
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
        }
        // Also save to SharedPreferences for OkHttp interceptor (avoids DI cycle)
        context.getSharedPreferences("auth_quick", android.content.Context.MODE_PRIVATE)
            .edit().putString("auth_token", token).apply()
    }

    suspend fun saveUser(email: String, name: String?, photoUrl: String? = null) {
        context.dataStore.edit { prefs ->
            prefs[USER_EMAIL_KEY] = email
            name?.let { prefs[USER_NAME_KEY] = it }
            photoUrl?.let { prefs[USER_PHOTO_KEY] = it }
        }
        // Also save to SharedPreferences for instant access
        context.getSharedPreferences("user_quick", android.content.Context.MODE_PRIVATE).edit()
            .putString("email", email)
            .putString("name", name)
            .apply {
                photoUrl?.let { putString("photo", it) }
            }
            .apply()
    }

    suspend fun logout() {
        context.dataStore.edit { prefs ->
            prefs.clear()
        }
        context.getSharedPreferences("auth_quick", android.content.Context.MODE_PRIVATE)
            .edit().clear().apply()
        // Without this, user A's premium on a shared device leaks straight
        // into user B's next session.
        premiumRepository.reset()
    }

    suspend fun getCurrentUser(): Result<UserInfo> {
        return try {
            val response = api.getCurrentUser()
            if (response.isSuccessful && response.body() != null) {
                val user = response.body()!!
                // Don't overwrite existing photo/name from Google Sign-In with null from server
                val existingPhoto = context.dataStore.data.first()[USER_PHOTO_KEY]
                val existingName = context.dataStore.data.first()[USER_NAME_KEY]
                saveUser(user.email, user.name ?: existingName, existingPhoto)
                Result.success(user)
            } else if (response.code() == 401) {
                logout()
                Result.failure(Exception("Unauthorized"))
            } else {
                Result.failure(Exception("Failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createAnonymousUser(): Result<String> {
        return try {
            val response = api.createAnonymousUser()
            if (response.isSuccessful && response.body() != null) {
                val token = response.body()!!.token
                saveToken(token)
                saveUser("guest@subtracker.app", "אורח")
                Result.success(token)
            } else {
                Result.failure(Exception("Failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
