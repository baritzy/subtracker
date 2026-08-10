package com.baritzy.subtracker

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.baritzy.subtracker.ads.AdManager
import com.baritzy.subtracker.analytics.Analytics
import com.baritzy.subtracker.billing.BillingManager
import com.baritzy.subtracker.data.api.SubTrackerApi
import com.baritzy.subtracker.data.repository.PremiumRepository
import javax.inject.Inject
import com.baritzy.subtracker.ui.navigation.SubTrackerNavHost
import com.baritzy.subtracker.ui.theme.SubTrackerTheme
import com.baritzy.subtracker.ui.theme.ThemeMode
import com.baritzy.subtracker.ui.settings.ThemeViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var api: SubTrackerApi
    @Inject lateinit var premiumRepository: PremiumRepository
    @Inject lateinit var analytics: Analytics

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* granted or not — no action needed, FCM handles it */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        AdManager.initialize(this, premiumRepository)
        BillingManager.initialize(this, premiumRepository, analytics) { purchaseToken ->
            lifecycleScope.launch {
                try {
                    api.verifyPremium(mapOf("purchaseToken" to purchaseToken))
                } catch (e: Exception) {
                    Log.e("MainActivity", "verifyPremium failed: ${e.javaClass.simpleName} - ${e.message}", e)
                }
            }
        }
        // Reconcile the server side of premium once per cold start. If there's
        // no token yet (fresh install / logged out) this 401s and is a no-op
        // via PremiumRepository.reset(); if there's a valid persisted token
        // this is what turns a network-connected cold start into a resolved
        // PREMIUM/FREE state instead of staying UNKNOWN until something else
        // happens to ask.
        lifecycleScope.launch { premiumRepository.refreshFromServer() }

        // Auto-request notification permission on first launch (Android 13+)
        requestNotificationPermissionIfNeeded()

        setContent {
            val themeViewModel: ThemeViewModel = hiltViewModel()
            val themeMode by themeViewModel.themeMode.collectAsStateWithLifecycle()

            SubTrackerTheme(themeMode = themeMode) {
                val navController = rememberNavController()
                SubTrackerNavHost(
                    navController = navController,
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Promo-code redemption and reinstall detection happen entirely
        // inside the Play Store app, so PurchasesUpdatedListener never fires
        // for them. Re-check (throttled) whenever the user returns here.
        BillingManager.refreshPurchasesIfStale()
        // AdManager reads the unified PremiumRepository state itself now --
        // no boolean is read here, since BillingManager's own signal is
        // always false on a cold start (async setup) and is no longer
        // exposed for UI decisions at all.
        AdManager.onAppOpen(this, applicationContext)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}
