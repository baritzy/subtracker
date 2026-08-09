package com.baritzy.subtracker.billing

import android.app.Activity
import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.android.billingclient.api.*
import com.baritzy.subtracker.data.repository.PremiumRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object BillingManager {
    private const val TAG = "BillingManager"
    const val PRODUCT_ID = "premium_unlock"
    private const val PURCHASE_CHECK_THROTTLE_MS = 2 * 60 * 1000L

    private lateinit var billingClient: BillingClient

    private val _productPrice = MutableStateFlow<String?>(null)
    val productPrice: StateFlow<String?> = _productPrice

    private var onPurchaseSuccess: ((String) -> Unit)? = null
    private var billingClientReady = false
    private var lastPurchaseCheckElapsedMs: Long? = null

    // Reports into the unified PremiumRepository -- nothing should read
    // BillingManager's local billing signal directly for UI decisions
    // anymore. Set once from MainActivity.initialize(); nullable so a
    // caller that forgets to wire it up fails loud (logged) instead of
    // silently deciding premium on its own.
    private var premiumRepository: PremiumRepository? = null

    fun initialize(context: Context, premiumRepository: PremiumRepository, onPurchase: (purchaseToken: String) -> Unit) {
        this.premiumRepository = premiumRepository
        onPurchaseSuccess = onPurchase
        billingClient = BillingClient.newBuilder(context)
            .setListener { billingResult, purchases ->
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (purchase in purchases) {
                        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                            handlePurchase(purchase)
                        }
                    }
                }
            }
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .build()

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    billingClientReady = true
                    checkExistingPurchases()
                    fetchProductPrice()
                } else {
                    Log.e(TAG, "Billing setup failed: ${result.responseCode} ${result.debugMessage}")
                }
            }
            override fun onBillingServiceDisconnected() {
                billingClientReady = false
                Log.w(TAG, "Billing service disconnected")
            }
        })
    }

    // Re-checks purchases with a throttle. Call from MainActivity.onResume():
    // promo-code redemptions and reinstalls happen entirely inside the Play
    // Store app, so PurchasesUpdatedListener never fires for them. This is
    // the only path that notices those cases, but queryPurchasesAsync should
    // not be hammered on every resume.
    fun refreshPurchasesIfStale() {
        if (!billingClientReady) return
        val now = SystemClock.elapsedRealtime()
        val last = lastPurchaseCheckElapsedMs
        if (last != null && now - last < PURCHASE_CHECK_THROTTLE_MS) return
        checkExistingPurchases()
    }

    // Bypasses the throttle entirely. Two callers:
    // 1. LoginViewModel right after a login completes -- MainActivity
    //    initializes billing before any login can happen, so the automatic
    //    checkExistingPurchases() at app start can run under a guest
    //    identity and bind /verify to the wrong account. This forces a
    //    second pass under the NEW auth token so the server's orphaned-
    //    anonymous-account transfer actually has a chance to run.
    // 2. The "Restore purchases" button in Settings, and the 403 retry in
    //    DashboardViewModel.
    // No-ops (logged) if billing hasn't finished connecting yet -- in that
    // case the connection's own onBillingSetupFinished callback will run
    // checkExistingPurchases() anyway, and by the time that fires the auth
    // token will already reflect whatever identity is current.
    fun forceRefresh(onComplete: () -> Unit = {}) {
        if (!billingClientReady) {
            Log.w(TAG, "forceRefresh called before billing client ready; skipping (setup-finished will run its own check)")
            onComplete()
            return
        }
        checkExistingPurchases(onComplete)
    }

    // Shared entry point for "this purchase grants premium." Used both by the
    // live PurchasesUpdatedListener (a purchase just completed) and by
    // checkExistingPurchases() (a purchase already exists that the listener
    // never fired for, e.g. promo code redemption or reinstall).
    private fun handlePurchase(purchase: Purchase) {
        if (purchase.isAcknowledged) {
            grantPremium(purchase)
            return
        }
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient.acknowledgePurchase(params) { result ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                grantPremium(purchase)
            }
        }
    }

    // /api/premium/verify is explicitly idempotent and forward-only, so
    // calling it again for a purchase we've already granted is safe.
    private fun grantPremium(purchase: Purchase) {
        premiumRepository?.reportLocalBilling(true)
            ?: Log.e(TAG, "grantPremium called but premiumRepository was never wired up via initialize()")
        onPurchaseSuccess?.invoke(purchase.purchaseToken)
    }

    private fun checkExistingPurchases(onComplete: (() -> Unit)? = null) {
        lastPurchaseCheckElapsedMs = SystemClock.elapsedRealtime()
        billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { billingResult, purchases ->
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                Log.e(TAG, "queryPurchasesAsync failed: ${billingResult.responseCode} ${billingResult.debugMessage}")
                onComplete?.invoke()
                return@queryPurchasesAsync
            }
            val owned = purchases.any {
                it.products.contains(PRODUCT_ID) && it.purchaseState == Purchase.PurchaseState.PURCHASED
            }
            for (purchase in purchases) {
                if (purchase.products.contains(PRODUCT_ID) &&
                    purchase.purchaseState == Purchase.PurchaseState.PURCHASED
                ) {
                    handlePurchase(purchase)
                }
            }
            if (!owned) {
                // Genuine "resolved: no local purchase" signal -- only reported
                // when the query itself succeeded (checked above), never on a
                // failed/timed-out query, which returns early instead of
                // falling through to here.
                premiumRepository?.reportLocalBilling(false)
            }
            onComplete?.invoke()
        }
    }

    fun fetchProductPrice() {
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )
        val params = QueryProductDetailsParams.newBuilder().setProductList(productList).build()
        billingClient.queryProductDetailsAsync(params) { _, productDetailsResult ->
            val price = productDetailsResult.productDetailsList.firstOrNull()?.oneTimePurchaseOfferDetails?.formattedPrice
            if (price != null) _productPrice.value = price
        }
    }

    fun launchPurchaseFlow(activity: Activity) {
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )
        val params = QueryProductDetailsParams.newBuilder().setProductList(productList).build()
        billingClient.queryProductDetailsAsync(params) { _, productDetailsResult ->
            val productDetails = productDetailsResult.productDetailsList.firstOrNull() ?: return@queryProductDetailsAsync
            val offerToken = productDetails.oneTimePurchaseOfferDetails?.let { "" } ?: ""
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .build()
                ))
                .build()
            billingClient.launchBillingFlow(activity, flowParams)
        }
    }
}
