package com.baritzy.subtracker.ads

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.baritzy.subtracker.data.repository.PremiumRepository
import com.baritzy.subtracker.data.repository.PremiumState
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

object AdManager {
    private const val TAG = "AdManager"
    private const val INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-8398995241935603/4328782921"

    private var interstitialAd: InterstitialAd? = null
    private var isLoading = false
    private var appOpenCount = 0

    // True only right after ProcessLifecycleOwner reports the whole app
    // process coming to the foreground. Activity.onResume() alone fires for
    // every activity transition, including returning from the Play Billing
    // sheet, Google Sign-In, the receipt-scan camera, or a permission
    // dialog -- none of those are a real "app open" and none should be
    // eligible to show an interstitial.
    private var isRealAppOpen = false
    private var lifecycleObserverRegistered = false

    // Single source of truth for premium, wired in from MainActivity. Ads
    // must NEVER read BillingManager directly anymore -- that was the root
    // cause of "I paid and still see ads" (BillingManager.isPremium.value
    // read synchronously in onResume, always false on a cold start because
    // billing setup + queryPurchasesAsync are both async).
    private var premiumRepository: PremiumRepository? = null

    fun initialize(context: Context, premiumRepository: PremiumRepository) {
        this.premiumRepository = premiumRepository
        MobileAds.initialize(context) {}
        loadInterstitial(context)
        registerProcessLifecycleObserver()
    }

    private fun registerProcessLifecycleObserver() {
        if (lifecycleObserverRegistered) return
        lifecycleObserverRegistered = true
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                isRealAppOpen = true
            }
        })
    }

    private fun loadInterstitial(context: Context) {
        if (isLoading || interstitialAd != null) return
        isLoading = true
        val adRequest = AdRequest.Builder().build()
        InterstitialAd.load(context, INTERSTITIAL_AD_UNIT_ID, adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    isLoading = false
                }
                override fun onAdFailedToLoad(error: LoadAdError) {
                    interstitialAd = null
                    isLoading = false
                }
            }
        )
    }

    // Call this from Activity.onResume(). Only counts as an app open (and
    // only eligible to show an ad) when it coincides with a true
    // process-level foreground transition -- see isRealAppOpen above.
    // Shows ad every 4 real app opens. Ads are eligible ONLY in the FREE
    // state -- both UNKNOWN (not reconciled yet) and PREMIUM suppress them.
    fun onAppOpen(activity: Activity, context: Context) {
        val repo = premiumRepository
        if (repo == null) {
            Log.e(TAG, "onAppOpen called before initialize(); refusing to show an ad")
            return
        }
        if (repo.state.value != PremiumState.FREE) return
        if (!isRealAppOpen) return
        isRealAppOpen = false

        appOpenCount++
        if (appOpenCount % 4 == 0 && interstitialAd != null) {
            // Re-check right before showing: premium state can flip
            // asynchronously relative to the resume that fires when an
            // external activity (e.g. the billing sheet) closes, so a user
            // who just paid could otherwise still catch one last ad.
            if (repo.state.value != PremiumState.FREE) return

            interstitialAd!!.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    interstitialAd = null
                    loadInterstitial(context)
                }
                override fun onAdFailedToShowFullScreenContent(e: AdError) {
                    interstitialAd = null
                    loadInterstitial(context)
                }
            }
            interstitialAd!!.show(activity)
        } else {
            loadInterstitial(context)
        }
    }
}
