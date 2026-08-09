package com.baritzy.subtracker.notifications

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.baritzy.subtracker.data.api.SubTrackerApi
import com.baritzy.subtracker.data.model.FcmTokenRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FcmTokenManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SubTrackerApi
) {
    companion object {
        private const val TAG = "FcmTokenManager"
    }

    suspend fun ensureTokenRegistered() {
        try {
            val prefs = context.getSharedPreferences("fcm", Context.MODE_PRIVATE)
            val token = FirebaseMessaging.getInstance().token.await()
            val savedToken = prefs.getString("fcm_token", null)
            val needsSync = prefs.getBoolean("token_needs_sync", false)

            // Always register — server uses ON CONFLICT DO UPDATE so this is idempotent.
            // Avoids silent failures where server lost the token but app thinks it's registered.
            Log.d(TAG, "Registering FCM token with server (changed=${token != savedToken}, needsSync=$needsSync)")
            val response = api.registerFcmToken(FcmTokenRequest(token = token))
            if (response.isSuccessful) {
                prefs.edit()
                    .putString("fcm_token", token)
                    .putBoolean("token_needs_sync", false)
                    .apply()
                Log.d(TAG, "FCM token registered successfully")
            } else {
                Log.w(TAG, "Failed to register token: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error registering FCM token", e)
        }
    }
}
