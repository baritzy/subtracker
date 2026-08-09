package com.baritzy.subtracker.data.model

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

@Entity(tableName = "subscriptions")
data class Subscription(
    @PrimaryKey val id: Int = 0,
    @ColumnInfo(name = "user_id") @SerializedName("user_id") val userId: Int = 0,
    @ColumnInfo(name = "company_name") @SerializedName("company_name") val companyName: String = "",
    @ColumnInfo(name = "service_name") @SerializedName("service_name") val serviceName: String = "",
    val cost: Double = 0.0,
    @ColumnInfo(name = "billing_cycle") @SerializedName("billing_cycle") val billingCycle: String = "monthly",
    @ColumnInfo(name = "cost_per_cycle") @SerializedName("cost_per_cycle") val costPerCycle: Double = 0.0,
    @ColumnInfo(name = "custom_cycle_months") @SerializedName("custom_cycle_months") val customCycleMonths: Int? = null,
    @ColumnInfo(name = "renewal_date") @SerializedName("renewal_date") val renewalDate: String = "",
    @ColumnInfo(name = "start_date") @SerializedName("start_date") val startDate: String? = null,
    @ColumnInfo(name = "cancel_url") @SerializedName("cancel_url") val cancelUrl: String? = null,
    val status: String = "active",
    @ColumnInfo(name = "cancelled_at") @SerializedName("cancelled_at") val cancelledAt: String? = null,
    val source: String = "manual",
    @ColumnInfo(name = "gmail_message_id") @SerializedName("gmail_message_id") val gmailMessageId: String? = null,
    val notes: String? = null,
    @ColumnInfo(name = "plan_type") @SerializedName("plan_type") val planType: String = "personal",
    @ColumnInfo(name = "plan_type_custom") @SerializedName("plan_type_custom") val planTypeCustom: String? = null,
    val currency: String = "USD",
    @ColumnInfo(name = "logo_url") @SerializedName("logo_url") val logoUrl: String? = null,
    @ColumnInfo(name = "is_trial") @SerializedName("is_trial") val isTrial: Int = 0,
    @ColumnInfo(name = "trial_end_date") @SerializedName("trial_end_date") val trialEndDate: String? = null,
    @ColumnInfo(name = "notifications_enabled", defaultValue = "1") @SerializedName("notifications_enabled") val notificationsEnabled: Int = 1,
    @ColumnInfo(name = "created_at") @SerializedName("created_at") val createdAt: String = "",
    @ColumnInfo(name = "updated_at") @SerializedName("updated_at") val updatedAt: String = ""
)

@Entity(tableName = "invoices")
data class Invoice(
    @PrimaryKey val id: Int = 0,
    @ColumnInfo(name = "subscription_id") @SerializedName("subscription_id") val subscriptionId: Int = 0,
    val amount: Double = 0.0,
    @ColumnInfo(name = "billing_cycle") @SerializedName("billing_cycle") val billingCycle: String = "monthly",
    @ColumnInfo(name = "invoice_date") @SerializedName("invoice_date") val invoiceDate: String = "",
    val currency: String = "USD",
    @ColumnInfo(name = "gmail_message_id") @SerializedName("gmail_message_id") val gmailMessageId: String? = null,
    val notes: String? = null,
    @ColumnInfo(name = "created_at") @SerializedName("created_at") val createdAt: String = ""
)

data class AuthResponse(
    val token: String
)

data class UserInfo(
    val id: Int,
    val email: String,
    val name: String?,
    @SerializedName("is_premium") val isPremium: Boolean,
    @SerializedName("created_at") val createdAt: String
)

data class CancelUrlResponse(
    val url: String?
)

data class PlansUrlResponse(
    val url: String?
)

data class LogoSearchResponse(
    val logo: String?,
    val domain: String?
)

data class VapidResponse(
    val key: String
)

data class PushSubscribeRequest(
    val endpoint: String,
    val p256dh: String,
    val auth: String
)

data class FcmTokenRequest(
    val token: String,
    @SerializedName("device_type") val deviceType: String = "android"
)

data class GmailStatus(
    val connected: Boolean,
    val email: String?,
    @SerializedName("last_synced_at") val lastSyncedAt: String?
)

data class GmailSyncResponse(
    @SerializedName("new_subscriptions_found") val newSubscriptionsFound: Int
)

data class HealthResponse(
    val ok: Boolean
)

// Dedicated response model for GET /api/premium/status. Deliberately NOT
// reusing UserInfo: that endpoint's is_premium is snake_case, this one's
// isPremium is camelCase. Reusing a mismatched field name makes Gson
// silently produce `false` for a real premium user with zero error signal --
// the exact bug found and fixed 2026-08-09 (see project lessons.md).
data class PremiumStatusResponse(
    @SerializedName("isPremium") val isPremium: Boolean,
    @SerializedName("subscriptionCount") val subscriptionCount: Int,
    @SerializedName("freeLimit") val freeLimit: Int
)

data class ReceiptScanResponse(
    val success: Boolean,
    @SerializedName("company_name") val companyName: String?,
    @SerializedName("service_name") val serviceName: String?,
    val cost: Double?,
    val currency: String?,
    @SerializedName("billing_cycle") val billingCycle: String?,
    @SerializedName("renewal_date") val renewalDate: String?,
    @SerializedName("billing_date") val startDate: String? = null,
    val notes: String?,
    @SerializedName("cancel_url") val cancelUrl: String? = null
)

data class CreateSubscriptionRequest(
    @SerializedName("company_name") val companyName: String,
    @SerializedName("service_name") val serviceName: String,
    val cost: Double,
    @SerializedName("billing_cycle") val billingCycle: String,
    @SerializedName("cost_per_cycle") val costPerCycle: Double,
    @SerializedName("custom_cycle_months") val customCycleMonths: Int? = null,
    @SerializedName("renewal_date") val renewalDate: String,
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("cancel_url") val cancelUrl: String? = null,
    val notes: String? = null,
    @SerializedName("plan_type") val planType: String = "personal",
    @SerializedName("plan_type_custom") val planTypeCustom: String? = null,
    val currency: String = "USD",
    @SerializedName("logo_url") val logoUrl: String? = null,
    @SerializedName("is_trial") val isTrial: Boolean = false,
    @SerializedName("trial_end_date") val trialEndDate: String? = null
)
