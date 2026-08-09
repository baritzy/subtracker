package com.baritzy.subtracker.data.api

import com.baritzy.subtracker.data.model.*
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface SubTrackerApi {

    // Auth
    @GET("auth/google")
    suspend fun getGoogleAuthUrl(): Response<Map<String, String>>

    @POST("auth/anonymous")
    suspend fun createAnonymousUser(): Response<AuthResponse>

    @POST("auth/google-native")
    suspend fun exchangeNativeAuthCode(@Body body: Map<String, String>): Response<Map<String, Any>>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<UserInfo>

    // Subscriptions
    @GET("subscriptions")
    suspend fun getSubscriptions(
        @Query("status") status: String? = null
    ): Response<List<Subscription>>

    @GET("subscriptions/{id}")
    suspend fun getSubscription(@Path("id") id: Int): Response<Subscription>

    @POST("subscriptions")
    suspend fun createSubscription(
        @Body request: CreateSubscriptionRequest
    ): Response<Subscription>

    @PUT("subscriptions/{id}")
    suspend fun updateSubscription(
        @Path("id") id: Int,
        @Body updates: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Subscription>

    @POST("subscriptions/{id}/cancel")
    suspend fun cancelSubscription(@Path("id") id: Int): Response<Subscription>

    @POST("subscriptions/{id}/confirm")
    suspend fun confirmSubscription(@Path("id") id: Int): Response<Subscription>

    @DELETE("subscriptions/{id}")
    suspend fun deleteSubscription(@Path("id") id: Int): Response<Unit>

    @DELETE("subscriptions/all")
    suspend fun deleteAllSubscriptions(): Response<Unit>

    @GET("subscriptions/{id}/invoices")
    suspend fun getInvoices(@Path("id") subscriptionId: Int): Response<List<Invoice>>

    // Utility
    @GET("subscriptions/cancel-url")
    suspend fun getCancelUrl(@Query("service") service: String): Response<CancelUrlResponse>

    @GET("subscriptions/plans-url")
    suspend fun getPlansUrl(@Query("service") service: String): Response<PlansUrlResponse>

    @GET("subscriptions/logo-search")
    suspend fun searchLogo(@Query("q") query: String): Response<LogoSearchResponse>

    // Push Notifications
    @GET("push/vapid-public")
    suspend fun getVapidKey(): Response<VapidResponse>

    @POST("push/subscribe")
    suspend fun subscribePush(@Body request: PushSubscribeRequest): Response<Map<String, Boolean>>

    @HTTP(method = "DELETE", path = "push/subscribe", hasBody = true)
    suspend fun unsubscribePush(@Body request: Map<String, String>): Response<Map<String, Boolean>>

    @POST("push/test")
    suspend fun sendTestPush(): Response<Map<String, Any>>

    // FCM native token registration
    @POST("push/register-device")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): Response<Map<String, Boolean>>

    // Gmail
    @GET("gmail/auth")
    suspend fun getGmailAuthUrl(): Response<Map<String, String>>

    @GET("gmail/status")
    suspend fun getGmailStatus(): Response<GmailStatus>

    @POST("gmail/disconnect")
    suspend fun disconnectGmail(): Response<Unit>

    @POST("gmail/sync")
    suspend fun syncGmail(): Response<GmailSyncResponse>

    // Receipt scanning
    @Multipart
    @POST("receipt/scan")
    suspend fun scanReceipt(@Part file: MultipartBody.Part): Response<ReceiptScanResponse>

    // Premium
    @POST("premium/verify")
    suspend fun verifyPremium(@Body body: Map<String, String>): Response<Map<String, Any>>

    // Own response model, camelCase isPremium -- NOT UserInfo (that's
    // snake_case is_premium from /auth/me). See PremiumStatusResponse.
    @GET("premium/status")
    suspend fun getPremiumStatus(): Response<PremiumStatusResponse>

    // Health
    @GET("health")
    suspend fun health(): Response<HealthResponse>
}
