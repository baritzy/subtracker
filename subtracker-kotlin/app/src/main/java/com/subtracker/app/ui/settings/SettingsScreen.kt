package com.baritzy.subtracker.ui.settings

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.baritzy.subtracker.billing.BillingManager
import com.baritzy.subtracker.data.repository.PremiumRepository
import com.baritzy.subtracker.data.repository.PremiumState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.baritzy.subtracker.data.repository.AuthRepository
import com.baritzy.subtracker.data.repository.SubscriptionRepository
import com.baritzy.subtracker.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val subscriptionRepository: SubscriptionRepository,
    private val premiumRepository: PremiumRepository
) : ViewModel() {
    val userEmail: StateFlow<String?> = authRepository.userEmail
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val userName: StateFlow<String?> = authRepository.userName
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val userPhoto: StateFlow<String?> = authRepository.userPhoto
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    // The one place the whole screen reads premium status from. Nothing here
    // touches BillingManager directly anymore.
    val premiumState: StateFlow<PremiumState> = premiumRepository.state

    private val _restoreInProgress = MutableStateFlow(false)
    val restoreInProgress: StateFlow<Boolean> = _restoreInProgress

    private val _restoreResult = MutableStateFlow<String?>(null)
    val restoreResult: StateFlow<String?> = _restoreResult

    fun logout() {
        viewModelScope.launch { authRepository.logout() }
    }

    fun deleteAllData() {
        viewModelScope.launch { subscriptionRepository.deleteAllSubscriptions() }
    }

    suspend fun sendTestPush(): Boolean {
        return subscriptionRepository.sendTestPush()
    }

    // Manual recovery button: the escape hatch for "email Eytan so he can
    // run SQL" being the only remedy when a purchase, promo code, or
    // reinstall never made it to the server. Forces a fresh local billing
    // check (bypassing the 2-minute throttle), gives the resulting /verify
    // call a bounded window to land, then re-asks the server directly.
    //
    // Known weakness: BillingManager's callback API has no way to signal
    // "the /verify network call this triggered has completed" (that call is
    // fired from MainActivity, fully decoupled from this ViewModel), so the
    // 1500ms wait below is a heuristic, not a guarantee. Worst case on a
    // slow network: the toast says "no purchase found" while the real
    // reconciliation is still in flight and completes moments later,
    // silently updating premiumState in the background. It never reports a
    // false "restored" for a purchase that doesn't exist.
    fun restorePurchases() {
        if (_restoreInProgress.value) return
        viewModelScope.launch {
            _restoreInProgress.value = true
            _restoreResult.value = null
            try {
                BillingManager.forceRefresh()
                kotlinx.coroutines.delay(1500)
                val serverOk = premiumRepository.refreshFromServer()
                _restoreResult.value = when {
                    premiumRepository.state.value == PremiumState.PREMIUM -> "✓ הפרימיום שוחזר בהצלחה"
                    !serverOk -> "לא הצלחנו להתחבר לשרת, נסה שוב"
                    else -> "לא נמצאה רכישה קודמת לשחזור"
                }
            } catch (e: Exception) {
                Log.e("SettingsViewModel", "restorePurchases failed: ${e.javaClass.simpleName} - ${e.message}", e)
                _restoreResult.value = "שגיאה בשחזור, נסה שוב"
            } finally {
                _restoreInProgress.value = false
            }
        }
    }

    fun clearRestoreResult() {
        _restoreResult.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val colors = SubTrackerThemeColors.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val email by viewModel.userEmail.collectAsStateWithLifecycle()
    val name by viewModel.userName.collectAsStateWithLifecycle()
    val photo by viewModel.userPhoto.collectAsStateWithLifecycle()

    val themeVm: ThemeViewModel = hiltViewModel()
    val themeMode by themeVm.themeMode.collectAsStateWithLifecycle()

    val premiumState by viewModel.premiumState.collectAsStateWithLifecycle()
    val isPremium = premiumState == PremiumState.PREMIUM
    val productPrice by BillingManager.productPrice.collectAsStateWithLifecycle()
    val restoreInProgress by viewModel.restoreInProgress.collectAsStateWithLifecycle()
    val restoreResult by viewModel.restoreResult.collectAsStateWithLifecycle()

    var showLogoutConfirm by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    // Re-check permission every time settings screen is visible (e.g. after returning from phone settings)
    fun checkNotifPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
        } else true
    }

    var notificationPermission by remember { mutableStateOf(checkNotifPermission()) }

    // Re-check when screen resumes (user might have toggled it in phone settings)
    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                notificationPermission = checkNotifPermission()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> notificationPermission = granted }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("הגדרות", color = colors.textPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = colors.textPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.background)
            )
        },
        containerColor = colors.background
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Theme toggle — centered, no label
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
            ) {
                // Resolve actual dark state (SYSTEM follows device setting)
                val systemIsDark = isSystemInDarkTheme()
                val isActuallyDark = when (themeMode) {
                    ThemeMode.DARK -> true
                    ThemeMode.LIGHT -> false
                    ThemeMode.SYSTEM -> systemIsDark
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.LightMode,
                        contentDescription = "בהיר",
                        tint = if (!isActuallyDark) Primary else colors.textMuted,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Switch(
                        checked = isActuallyDark,
                        onCheckedChange = { isDark ->
                            themeVm.setThemeMode(if (isDark) ThemeMode.DARK else ThemeMode.LIGHT)
                        },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = Primary,
                            checkedThumbColor = androidx.compose.ui.graphics.Color.White
                        )
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Icon(
                        Icons.Default.DarkMode,
                        contentDescription = "כהה",
                        tint = if (isActuallyDark) Primary else colors.textMuted,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            // Notifications with per-option toggles
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
            ) {
                val notifPrefs = context.getSharedPreferences("notif_prefs", android.content.Context.MODE_PRIVATE)
                var notif7d by remember { mutableStateOf(notifPrefs.getBoolean("notif_7d", true)) }
                var notif24h by remember { mutableStateOf(notifPrefs.getBoolean("notif_24h", true)) }
                var notif3h by remember { mutableStateOf(notifPrefs.getBoolean("notif_3h", true)) }

                Column(modifier = Modifier.padding(16.dp)) {
                    Text("התראות", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                    Spacer(modifier = Modifier.height(12.dp))

                    // 7 days before
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = notif7d,
                            onCheckedChange = {
                                notif7d = it
                                notifPrefs.edit().putBoolean("notif_7d", it).apply()
                            }
                        )
                        Text("7 ימים לפני חידוש", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    }

                    // 24 hours before
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = notif24h,
                            onCheckedChange = {
                                notif24h = it
                                notifPrefs.edit().putBoolean("notif_24h", it).apply()
                            }
                        )
                        Text("24 שעות לפני חידוש", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    }

                    // 3 hours before
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = notif3h,
                            onCheckedChange = {
                                notif3h = it
                                notifPrefs.edit().putBoolean("notif_3h", it).apply()
                            }
                        )
                        Text("3 שעות לפני חידוש", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        if (notificationPermission) "✓ התראות מופעלות" else "יש לאשר התראות כדי לקבל עדכונים",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (notificationPermission) Success else colors.textMuted
                    )

                    // "Approve notifications" button — opens phone settings directly
                    if (!notificationPermission) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val intent = Intent().apply {
                                    action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
                                    putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                                }
                                context.startActivity(intent)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Notifications, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("אשר התראות")
                        }
                    }
                }
            }

            // Premium
            if (isPremium) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Primary.copy(alpha = 0.1f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("👑", fontSize = 28.sp)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                "פרמיום פעיל",
                                style = MaterialTheme.typography.titleMedium,
                                color = Primary
                            )
                            Text(
                                "תודה על התמיכה!",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted
                            )
                        }
                    }
                }
            } else {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Primary.copy(alpha = 0.08f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "👑 שדרג לפרמיום",
                            style = MaterialTheme.typography.titleMedium,
                            color = Primary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "מינויים ללא הגבלה, ללא פרסומות, תשלום חד-פעמי",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val activity = context as Activity
                                BillingManager.launchPurchaseFlow(activity)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                buildString {
                                    append("שדרג עכשיו")
                                    productPrice?.let { append(" • $it") }
                                }
                            )
                        }

                        // Manual recovery: the escape hatch for a purchase, promo
                        // code, or reinstall that never reached the server. Without
                        // this, the only remedy was emailing support to run SQL.
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = { viewModel.restorePurchases() },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            enabled = !restoreInProgress
                        ) {
                            if (restoreInProgress) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Primary
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("משחזר...")
                            } else {
                                Icon(Icons.Default.Restore, null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("שחזר רכישות")
                            }
                        }
                        restoreResult?.let { message ->
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                message,
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textSecondary
                            )
                        }
                    }
                }
            }

            // Account
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("חשבון", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Avatar — Google profile photo or fallback
                        if (photo != null) {
                            AsyncImage(
                                model = ImageRequest.Builder(context)
                                    .data(photo)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = "תמונת פרופיל",
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Surface(
                                modifier = Modifier.size(44.dp),
                                shape = CircleShape,
                                color = Primary.copy(alpha = 0.15f)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        (name?.take(1) ?: "G").uppercase(),
                                        color = Primary,
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                name ?: "מחובר",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.textPrimary
                            )
                            Text(
                                email ?: "חשבון אורח",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedButton(
                        onClick = { showLogoutConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Logout, null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("יציאה מהחשבון")
                    }
                }
            }

            // Danger zone
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.error.copy(alpha = 0.04f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("אזור סכנה", style = MaterialTheme.typography.titleMedium,
                        color = colors.error)
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedButton(
                        onClick = { showDeleteConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.error)
                    ) {
                        Icon(Icons.Default.DeleteForever, null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("אפס את כל הנתונים")
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Logout dialog
    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("יציאה") },
            text = { Text("בטוח שאתה רוצה לצאת?") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutConfirm = false
                    viewModel.logout()
                    onLogout()
                }) { Text("יציאה", color = colors.error) }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirm = false }) { Text("ביטול") }
            }
        )
    }

    // Delete dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("איפוס נתונים") },
            text = { Text("האם אתה בטוח? כל המנויים יימחקו לצמיתות.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.deleteAllData()
                }) { Text("מחק הכל", color = colors.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("ביטול") }
            }
        )
    }
}
