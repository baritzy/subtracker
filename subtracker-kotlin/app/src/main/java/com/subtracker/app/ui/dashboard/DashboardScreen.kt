package com.baritzy.subtracker.ui.dashboard

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.baritzy.subtracker.billing.BillingManager
import com.baritzy.subtracker.ui.components.*
import com.baritzy.subtracker.ui.paywall.PaywallScreen
import com.baritzy.subtracker.ui.theme.*
import kotlinx.coroutines.delay
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToHistory: () -> Unit,
    onNavigateToCalendar: () -> Unit,
    onNavigateToTrials: () -> Unit,
    onNavigateToSettings: () -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val colors = SubTrackerThemeColors.colors
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val filteredSubs by viewModel.filteredSubscriptions.collectAsStateWithLifecycle(emptyList())
    val upcomingRenewals by viewModel.upcomingRenewals.collectAsStateWithLifecycle(emptyList())
    val totalMonthly by viewModel.totalMonthlyCost.collectAsStateWithLifecycle(0.0)
    val context = LocalContext.current

    var fabMenuOpen by remember { mutableStateOf(false) }
    val cameraUri = remember { mutableStateOf<Uri?>(null) }
    val fabRotation by animateFloatAsState(targetValue = if (fabMenuOpen) 45f else 0f, label = "fab")

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        fabMenuOpen = false
        if (success) cameraUri.value?.let { viewModel.scanReceipt(it) }
    }

    fun launchCamera() {
        val dir = File(context.cacheDir, "camera").also { it.mkdirs() }
        val file = File(dir, "receipt_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        cameraUri.value = uri
        cameraLauncher.launch(uri)
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchCamera()
    }

    val fileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        fabMenuOpen = false
        uri?.let { viewModel.scanReceipt(it) }
    }

    // Auto-dismiss scan error after 4 seconds
    LaunchedEffect(uiState.scanError) {
        if (uiState.scanError != null) {
            delay(4000)
            viewModel.clearScanError()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.background)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 16.dp, end = 16.dp,
                top = 60.dp, bottom = 100.dp
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header with settings gear
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "מעקב מנויים",
                        style = MaterialTheme.typography.displayLarge,
                        color = colors.textPrimary
                    )
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(
                            Icons.Default.Settings,
                            contentDescription = "הגדרות",
                            tint = colors.textTertiary
                        )
                    }
                }
            }

            // Navigation buttons
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    NavChip("היסטוריה", Icons.Default.History, onClick = onNavigateToHistory)
                    NavChip("יומן", Icons.Default.CalendarMonth, onClick = onNavigateToCalendar)
                    NavChip("Trials", Icons.Default.Timer, onClick = onNavigateToTrials)
                }
            }

            // Pending review panel
            if (uiState.pendingSubscriptions.isNotEmpty()) {
                item {
                    PendingReviewPanel(
                        pending = uiState.pendingSubscriptions,
                        onConfirm = { viewModel.confirmSubscription(it.id) },
                        onDismiss = { viewModel.deleteSubscription(it.id) }
                    )
                }
            }

            // Cost summary
            item {
                CostSummaryCard(
                    subscriptions = filteredSubs,
                    totalMonthly = totalMonthly,
                    currency = uiState.currency,
                    showMonthly = uiState.showMonthly,
                    planFilter = uiState.planFilter,
                    onCurrencyToggle = {
                        viewModel.setCurrency(if (uiState.currency == "USD") "ILS" else "USD")
                    },
                    onPlanFilterChange = { viewModel.setPlanFilter(it) },
                    onToggleMonthlyYearly = { viewModel.toggleMonthlyYearly() },
                    formatAmount = { viewModel.formatAmount(it) }
                )
            }

            // Upcoming renewals
            if (upcomingRenewals.isNotEmpty()) {
                item {
                    RenewalTimelineCard(
                        renewals = upcomingRenewals,
                        formatAmount = { viewModel.formatAmount(it) },
                        daysUntil = { viewModel.daysUntilRenewal(it) }
                    )
                }
            }

            // Search + Sort
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        SearchBar(
                            query = uiState.searchQuery,
                            onQueryChange = { viewModel.setSearchQuery(it) }
                        )
                    }
                    SortButton(
                        currentSort = uiState.sortMode,
                        onSortChange = { viewModel.setSortMode(it) }
                    )
                }
            }

            // Subscription cards
            if (uiState.isLoading) {
                items(3) {
                    SkeletonCard()
                }
            } else if (filteredSubs.isEmpty()) {
                item {
                    EmptyState(
                        emoji = "📭",
                        message = if (uiState.searchQuery.isNotBlank()) {
                            "לא נמצאו תוצאות"
                        } else {
                            "אין מנויים עדיין. לחץ על + כדי להוסיף"
                        }
                    )
                }
            } else {
                itemsIndexed(filteredSubs, key = { _, sub -> sub.id }) { index, sub ->
                    SubscriptionCard(
                        subscription = sub,
                        index = index,
                        formatAmount = { viewModel.formatAmount(it) },
                        daysUntilRenewal = viewModel.daysUntilRenewal(sub.renewalDate),
                        onEdit = { viewModel.showEditForm(sub) },
                        onCancel = { viewModel.cancelSubscription(sub.id) },
                        onDelete = { viewModel.deleteSubscription(sub.id) },
                        onUpdate = { id, updates -> viewModel.updateSubscription(id, updates) },
                        onFetchInvoices = { id -> viewModel.fetchInvoices(id) },
                        onValidateCancelUrl = { name -> viewModel.validateCancelUrl(name) }
                    )
                }
            }
        }

        // Backdrop to close FAB menu
        AnimatedVisibility(
            visible = fabMenuOpen,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.3f))
                    .noRippleClickable { fabMenuOpen = false }
            )
        }

        // FAB menu column
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(24.dp),
            horizontalAlignment = Alignment.Start,
            verticalArrangement = Arrangement.Bottom
        ) {
            // Mini action buttons (above FAB)
            AnimatedVisibility(
                visible = fabMenuOpen,
                enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
                exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 2 })
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(bottom = 12.dp)
                ) {
                    FabMenuItem(
                        icon = Icons.Default.CameraAlt,
                        label = "מצלמה",
                        onClick = {
                            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_GRANTED
                            ) {
                                launchCamera()
                            } else {
                                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                            }
                        }
                    )
                    FabMenuItem(
                        icon = Icons.Default.AttachFile,
                        label = "קובץ / PDF",
                        onClick = { fileLauncher.launch("*/*") }
                    )
                    FabMenuItem(
                        icon = Icons.Default.Edit,
                        label = "ידני",
                        onClick = { fabMenuOpen = false; viewModel.showAddForm() }
                    )
                }
            }

            // Main FAB
            FloatingActionButton(
                onClick = { fabMenuOpen = !fabMenuOpen },
                modifier = Modifier.size(56.dp),
                shape = CircleShape,
                containerColor = Primary,
                contentColor = androidx.compose.ui.graphics.Color.White,
                elevation = FloatingActionButtonDefaults.elevation(8.dp, 12.dp)
            ) {
                Icon(
                    Icons.Default.Add,
                    contentDescription = "הוסף מנוי",
                    modifier = Modifier.rotate(fabRotation)
                )
            }
        }

        // Scanning overlay
        AnimatedVisibility(
            visible = uiState.isScanning,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.6f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(color = Primary, strokeWidth = 3.dp)
                    Text(
                        "סורק קבלה...",
                        color = androidx.compose.ui.graphics.Color.White,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        // Premium sync overlay -- shown instead of flashing the paywall at a
        // user who may have already paid (see DashboardViewModel.handleFreeLimitReached)
        AnimatedVisibility(
            visible = uiState.isSyncingPremium,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.6f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(color = Primary, strokeWidth = 3.dp)
                    Text(
                        "מסנכרן פרימיום...",
                        color = androidx.compose.ui.graphics.Color.White,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        // Scan error toast
        AnimatedVisibility(
            visible = uiState.scanError != null,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 100.dp, start = 24.dp, end = 24.dp),
            enter = fadeIn() + slideInVertically(initialOffsetY = { it }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { it })
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.errorContainer,
                tonalElevation = 4.dp
            ) {
                Text(
                    text = uiState.scanError ?: "",
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }

    // Add/Edit form modal
    if (uiState.showAddForm) {
        SubscriptionFormSheet(
            subscription = uiState.editingSubscription,
            prefill = uiState.scanPrefill,
            onDismiss = { viewModel.dismissForm() },
            onCreate = { viewModel.createSubscription(it) },
            onUpdate = { id, updates -> viewModel.updateSubscription(id, updates) },
            onSearchLogo = { viewModel.searchLogo(it) },
            onSearchCancelUrl = { viewModel.searchCancelUrl(it) }
        )
    }

    // Paywall
    if (uiState.showPaywall) {
        val activity = LocalContext.current as Activity
        PaywallScreen(
            onUpgrade = { BillingManager.launchPurchaseFlow(activity) },
            onDismiss = { viewModel.dismissPaywall() }
        )
    }

    // Terminal state for a client that believes it's Premium but the server
    // keeps rejecting with free_limit_reached even after a restore-and-retry.
    // Never an infinite spinner -- an actionable message pointing at the
    // Settings restore button / support, per DashboardViewModel.handleFreeLimitReached.
    uiState.paywallError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissPaywallError() },
            title = { Text("בעיית סנכרון") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissPaywallError() }) { Text("הבנתי") }
            }
        )
    }
}

@Composable
private fun androidx.compose.ui.Modifier.noRippleClickable(onClick: () -> Unit): androidx.compose.ui.Modifier =
    this.clickable(
        indication = null,
        interactionSource = remember { MutableInteractionSource() },
        onClick = onClick
    )

@Composable
private fun FabMenuItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    val colors = SubTrackerThemeColors.colors
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(28.dp),
        color = colors.cardBackground,
        tonalElevation = 4.dp,
        shadowElevation = 4.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(icon, contentDescription = null, tint = Primary, modifier = Modifier.size(20.dp))
            Text(label, style = MaterialTheme.typography.labelLarge, color = colors.textPrimary)
        }
    }
}

@Composable
fun RowScope.NavChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    val colors = SubTrackerThemeColors.colors
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = colors.textSecondary
        ),
        border = ButtonDefaults.outlinedButtonBorder(enabled = true),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun SortButton(currentSort: SortMode, onSortChange: (SortMode) -> Unit) {
    val colors = SubTrackerThemeColors.colors
    var showMenu by remember { mutableStateOf(false) }

    Box {
        IconButton(
            onClick = { showMenu = true },
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(colors.cardBackground)
        ) {
            Icon(
                Icons.Default.FilterList,
                contentDescription = "\u05DE\u05D9\u05D5\u05DF",
                tint = if (currentSort != SortMode.RENEWAL_DATE) Primary else colors.textMuted
            )
        }
        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
            SortMode.entries.forEach { mode ->
                DropdownMenuItem(
                    text = {
                        Text(
                            mode.label,
                            color = if (mode == currentSort) Primary else colors.textPrimary
                        )
                    },
                    leadingIcon = {
                        if (mode == currentSort) {
                            Icon(Icons.Default.Check, null, tint = Primary, modifier = Modifier.size(18.dp))
                        }
                    },
                    onClick = {
                        onSortChange(mode)
                        showMenu = false
                    }
                )
            }
        }
    }
}

@Composable
fun SearchBar(query: String, onQueryChange: (String) -> Unit) {
    val colors = SubTrackerThemeColors.colors
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier.fillMaxWidth(),
        placeholder = {
            Text("חיפוש...", color = colors.textMuted)
        },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = null, tint = colors.textMuted)
        },
        trailingIcon = {
            if (query.isNotBlank()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Close, contentDescription = "נקה", tint = colors.textMuted)
                }
            }
        },
        shape = RoundedCornerShape(12.dp),
        singleLine = true,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Primary,
            unfocusedBorderColor = colors.border
        )
    )
}

