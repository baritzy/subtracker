package com.baritzy.subtracker.analytics

import android.content.Context
import android.os.Bundle
import android.util.Log
import com.baritzy.subtracker.data.repository.PremiumState
import com.google.firebase.analytics.FirebaseAnalytics
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Which identity path a login went through. A typed enum (not a raw
 * string) so the "google" / "guest" values can't drift or typo across
 * call sites -- see [Analytics.loginCompleted].
 */
enum class LoginMethod(val paramValue: String) {
    GOOGLE("google"),
    GUEST("guest")
}

/**
 * Thin, crash-proof wrapper around FirebaseAnalytics.
 *
 * Two rules matter more than anything else here:
 * 1. Analytics must NEVER throw or otherwise change app behaviour. Every
 *    call is wrapped defensively; a failure is logged and swallowed, full
 *    stop. This codebase's defining bug pattern is a silent empty catch
 *    hiding a real failure (see project lessons.md) -- the difference here
 *    is deliberate: we log loudly, we just never propagate.
 * 2. Only named functions are exposed, never a free-form
 *    `logEvent(String, Bundle)` passthrough, so event names cannot drift
 *    between call sites.
 *
 * Privacy: every parameter below is a count, a bucket, or an enum value.
 * No email, name, subscription name, price, or purchase token is ever
 * logged through this class.
 */
@Singleton
class Analytics @Inject constructor(
    @ApplicationContext context: Context
) {
    companion object {
        private const val TAG = "Analytics"

        private const val EVENT_ADD_STARTED = "subscription_add_started"
        private const val EVENT_ADD_COMPLETED = "subscription_add_completed"
        private const val EVENT_PAYWALL_SHOWN = "paywall_shown"
        private const val EVENT_PURCHASE_STARTED = "purchase_started"
        private const val EVENT_PREMIUM_GRANTED = "premium_granted"
        private const val EVENT_LOGIN_COMPLETED = "login_completed"

        private const val PARAM_IS_FIRST = "is_first_subscription"
        private const val PARAM_SOURCE = "source" // premium_granted: "purchase" | "restore"
        private const val PARAM_METHOD = "method" // login_completed: "google" | "guest"

        private const val USER_PROP_PREMIUM_STATE = "premium_state"
        private const val USER_PROP_SUBSCRIPTION_BUCKET = "subscription_count_bucket"
    }

    private val firebaseAnalytics: FirebaseAnalytics? = try {
        FirebaseAnalytics.getInstance(context)
    } catch (e: Exception) {
        Log.e(TAG, "Failed to obtain FirebaseAnalytics instance: ${e.javaClass.simpleName} - ${e.message}", e)
        null
    }

    private inline fun safe(block: (FirebaseAnalytics) -> Unit) {
        val client = firebaseAnalytics ?: return
        try {
            block(client)
        } catch (e: Exception) {
            Log.e(TAG, "Analytics call failed: ${e.javaClass.simpleName} - ${e.message}", e)
        }
    }

    /** User opened the add-subscription flow (manual entry or a successful receipt scan). */
    fun subscriptionAddStarted() = safe { it.logEvent(EVENT_ADD_STARTED, null) }

    /** A subscription was actually created. [isFirstSubscription] = the user had zero before this one. */
    fun subscriptionAddCompleted(isFirstSubscription: Boolean) = safe {
        val bundle = Bundle().apply { putBoolean(PARAM_IS_FIRST, isFirstSubscription) }
        it.logEvent(EVENT_ADD_COMPLETED, bundle)
    }

    /** The free-limit paywall was actually shown to the user. */
    fun paywallShown() = safe { it.logEvent(EVENT_PAYWALL_SHOWN, null) }

    /** User tapped upgrade and the Play billing flow was launched. */
    fun purchaseStarted() = safe { it.logEvent(EVENT_PURCHASE_STARTED, null) }

    /** Premium just became active (a real UNKNOWN/FREE -> PREMIUM transition, not a re-check). */
    fun premiumGranted(isRestore: Boolean) = safe {
        val bundle = Bundle().apply { putString(PARAM_SOURCE, if (isRestore) "restore" else "purchase") }
        it.logEvent(EVENT_PREMIUM_GRANTED, bundle)
    }

    /** A fresh login completed (not a resumed session -- see LoginViewModel.checkExistingToken). */
    fun loginCompleted(method: LoginMethod) = safe {
        val bundle = Bundle().apply { putString(PARAM_METHOD, method.paramValue) }
        it.logEvent(EVENT_LOGIN_COMPLETED, bundle)
    }

    /** User property: current resolved premium state. Call whenever PremiumRepository's state changes. */
    fun setPremiumState(state: PremiumState) = safe {
        it.setUserProperty(USER_PROP_PREMIUM_STATE, state.name.lowercase())
    }

    /** User property: bucketed active-subscription count. Call whenever the subscriptions list changes. */
    fun setSubscriptionCountBucket(count: Int) = safe {
        val bucket = when {
            count <= 0 -> "0"
            count in 1..3 -> "1-3"
            count == 4 -> "4"
            else -> "5+"
        }
        it.setUserProperty(USER_PROP_SUBSCRIPTION_BUCKET, bucket)
    }
}
