package com.baritzy.subtracker.data.repository

import android.content.Context
import android.util.Log
import com.baritzy.subtracker.analytics.Analytics
import com.baritzy.subtracker.data.api.SubTrackerApi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Three real states, not a boolean. UNKNOWN must never be treated as FREE:
 * showing an ad or a paywall to a user we simply haven't reconciled yet is
 * the "I paid and still see ads" complaint.
 */
enum class PremiumState { UNKNOWN, FREE, PREMIUM }

/**
 * Single app-wide source of truth for premium status.
 *
 * Before this existed, three signals disagreed: the local Play Billing
 * cache, the server's `is_premium` (fetched on login and then read nowhere),
 * and a 403 `free_limit_reached` from the subscriptions endpoint. Every
 * consumer (ads, settings, paywall gating) must read [state] here instead of
 * asking any one of those sources directly.
 *
 * Resolution rule (deliberately asymmetric, see project lessons.md
 * 2026-08-09): `true` from ANY source wins immediately and is remembered.
 * `false` is only accepted once BOTH local billing and the server have each
 * explicitly reported "no premium" in this process lifetime. A transient
 * server failure, or a billing client that hasn't finished connecting yet,
 * must never demote a real premium user back to FREE -- the owner (user id
 * 2) is premium server-side with a NULL purchase token, and anyone whose
 * `/verify` call didn't land yet would otherwise get demoted right after
 * paying. At this scale the cost of a stuck `true` is negligible against
 * double-charging someone.
 */
@Singleton
class PremiumRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SubTrackerApi,
    private val analytics: Analytics
) {
    companion object {
        private const val TAG = "PremiumRepository"
        private const val PREFS_NAME = "premium_state"
        private const val KEY_LAST_KNOWN_PREMIUM = "last_known_premium"
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // "Resolved" means that source has actually reported back at least once
    // this process lifetime -- as opposed to just sitting at its Kotlin
    // default. Without this distinction a billing client that hasn't
    // finished connecting yet looks identical to one that finished and
    // found nothing, which is exactly the cold-start bug this class exists
    // to fix (MainActivity.onResume used to read BillingManager.isPremium
    // synchronously while billing setup + queryPurchasesAsync are async).
    @Volatile private var localBillingResolved = false
    @Volatile private var localBillingPremium = false
    @Volatile private var serverResolved = false
    @Volatile private var serverPremium = false

    private val _state = MutableStateFlow(seedInitialState())
    val state: StateFlow<PremiumState> = _state

    init {
        // Reflect the seeded cold-start value immediately -- don't wait for
        // the first recompute(), which may be seconds away (async billing +
        // network) or may never happen this session (no signal changes).
        analytics.setPremiumState(_state.value)
    }

    // Seeds ONLY from a persisted, previously-confirmed PREMIUM flag -- never
    // FREE, and never from BillingManager (whose own StateFlow starts at
    // false before its async connection finishes, which is the exact trap
    // this repository replaces). A returning premium user must not show as
    // UNKNOWN-then-ads on a cold start with no network; a never-verified
    // user correctly starts UNKNOWN until this session actually reconciles.
    private fun seedInitialState(): PremiumState {
        return if (prefs.getBoolean(KEY_LAST_KNOWN_PREMIUM, false)) {
            PremiumState.PREMIUM
        } else {
            PremiumState.UNKNOWN
        }
    }

    @Synchronized
    fun reportLocalBilling(isPremium: Boolean) {
        localBillingResolved = true
        localBillingPremium = isPremium
        recompute()
    }

    @Synchronized
    fun reportServerPremium(isPremium: Boolean) {
        serverResolved = true
        serverPremium = isPremium
        recompute()
    }

    @Synchronized
    private fun recompute() {
        val next = when {
            localBillingPremium || serverPremium -> PremiumState.PREMIUM
            localBillingResolved && serverResolved -> PremiumState.FREE
            else -> return // still missing a signal -- leave state exactly as it was (seeded PREMIUM or UNKNOWN)
        }
        _state.value = next
        prefs.edit().putBoolean(KEY_LAST_KNOWN_PREMIUM, next == PremiumState.PREMIUM).apply()
        analytics.setPremiumState(next)
    }

    // Reset on logout and on any 401: without this, user A's premium on a
    // shared device leaks straight into user B's session, and a fresh login
    // would otherwise inherit a stale seeded PREMIUM flag from whoever used
    // the device before.
    @Synchronized
    fun reset() {
        localBillingResolved = false
        localBillingPremium = false
        serverResolved = false
        serverPremium = false
        _state.value = PremiumState.UNKNOWN
        prefs.edit().clear().apply()
        analytics.setPremiumState(PremiumState.UNKNOWN)
    }

    // Calls GET /api/premium/status. Every failure is logged explicitly --
    // this codebase's defining bug pattern is a silent empty catch, and a
    // silent failure here is exactly what let the server's is_premium go
    // unread for months (fetched once on login, then discarded). A failed
    // call never demotes a known-premium user: it just leaves the server
    // side unresolved and recompute() keeps whatever state already existed.
    suspend fun refreshFromServer(): Boolean {
        return try {
            val response = api.getPremiumStatus()
            if (response.isSuccessful && response.body() != null) {
                reportServerPremium(response.body()!!.isPremium)
                true
            } else {
                if (response.code() == 401) {
                    Log.w(TAG, "refreshFromServer: 401 Unauthorized, resetting premium state")
                    reset()
                } else {
                    Log.e(TAG, "refreshFromServer failed: HTTP ${response.code()}")
                }
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "refreshFromServer exception: ${e.javaClass.simpleName} - ${e.message}", e)
            false
        }
    }
}
