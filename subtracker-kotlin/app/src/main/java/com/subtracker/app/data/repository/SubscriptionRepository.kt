package com.baritzy.subtracker.data.repository

import android.content.Context
import android.net.Uri
import com.baritzy.subtracker.data.api.SubTrackerApi
import com.baritzy.subtracker.data.db.dao.InvoiceDao
import com.baritzy.subtracker.data.db.dao.SubscriptionDao
import com.baritzy.subtracker.data.model.*
import kotlinx.coroutines.flow.Flow
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SubscriptionRepository @Inject constructor(
    private val api: SubTrackerApi,
    private val subscriptionDao: SubscriptionDao,
    private val invoiceDao: InvoiceDao
) {
    fun getActiveSubscriptions(): Flow<List<Subscription>> =
        subscriptionDao.getByStatus("active")

    fun getCancelledSubscriptions(): Flow<List<Subscription>> =
        subscriptionDao.getByStatus("cancelled")

    fun getPendingSubscriptions(): Flow<List<Subscription>> =
        subscriptionDao.getPending()

    fun getActiveTrials(): Flow<List<Subscription>> =
        subscriptionDao.getActiveTrials()

    fun getAllSubscriptions(): Flow<List<Subscription>> =
        subscriptionDao.getAll()

    suspend fun refreshSubscriptions() {
        val response = api.getSubscriptions()
        if (response.isSuccessful) {
            response.body()?.let { subs ->
                subscriptionDao.deleteAll()
                subscriptionDao.insertAll(subs)
            }
        }
    }

    suspend fun createSubscription(request: CreateSubscriptionRequest): Result<Subscription> {
        return try {
            val response = api.createSubscription(request)
            if (response.isSuccessful && response.body() != null) {
                val sub = response.body()!!
                subscriptionDao.insert(sub)
                Result.success(sub)
            } else {
                if (response.code() == 403) {
                    Result.failure(Exception("free_limit_reached"))
                } else {
                    Result.failure(Exception("Failed to create: ${response.code()}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateSubscription(id: Int, updates: Map<String, Any?>): Result<Subscription> {
        return try {
            val response = api.updateSubscription(id, updates)
            if (response.isSuccessful && response.body() != null) {
                val sub = response.body()!!
                subscriptionDao.insert(sub)
                Result.success(sub)
            } else {
                Result.failure(Exception("Failed to update: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun cancelSubscription(id: Int): Result<Subscription> {
        return try {
            val response = api.cancelSubscription(id)
            if (response.isSuccessful && response.body() != null) {
                val sub = response.body()!!
                subscriptionDao.insert(sub)
                Result.success(sub)
            } else {
                Result.failure(Exception("Failed to cancel: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun confirmSubscription(id: Int): Result<Subscription> {
        return try {
            val response = api.confirmSubscription(id)
            if (response.isSuccessful && response.body() != null) {
                val sub = response.body()!!
                subscriptionDao.insert(sub)
                Result.success(sub)
            } else {
                Result.failure(Exception("Failed to confirm: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteSubscription(id: Int): Result<Unit> {
        return try {
            val response = api.deleteSubscription(id)
            if (response.isSuccessful) {
                subscriptionDao.deleteById(id)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteAllSubscriptions(): Result<Unit> {
        return try {
            val response = api.deleteAllSubscriptions()
            if (response.isSuccessful) {
                subscriptionDao.deleteAll()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getInvoices(subscriptionId: Int): Result<List<Invoice>> {
        return try {
            val response = api.getInvoices(subscriptionId)
            if (response.isSuccessful && response.body() != null) {
                val invoices = response.body()!!
                invoiceDao.insertAll(invoices)
                Result.success(invoices)
            } else {
                Result.failure(Exception("Failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getLocalInvoices(subscriptionId: Int): Flow<List<Invoice>> =
        invoiceDao.getBySubscriptionId(subscriptionId)

    suspend fun searchLogo(query: String): LogoSearchResponse? {
        return try {
            val response = api.searchLogo(query)
            if (response.isSuccessful) response.body() else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getCancelUrl(service: String): String? {
        return try {
            val response = api.getCancelUrl(service)
            if (response.isSuccessful) response.body()?.url else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getPlansUrl(service: String): String? {
        return try {
            val response = api.getPlansUrl(service)
            if (response.isSuccessful) response.body()?.url else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun sendTestPush(): Boolean {
        return try {
            val response = api.sendTestPush()
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }

    suspend fun scanReceipt(context: Context, uri: Uri): ReceiptScanResponse? {
        return try {
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
            val fileName = if (mimeType == "application/pdf") "receipt.pdf" else "receipt.jpg"
            val part = MultipartBody.Part.createFormData(
                "file", fileName, bytes.toRequestBody(mimeType.toMediaTypeOrNull())
            )
            val response = api.scanReceipt(part)
            if (response.isSuccessful) response.body() else null
        } catch (e: Exception) {
            null
        }
    }
}
