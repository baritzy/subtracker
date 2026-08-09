package com.baritzy.subtracker.ui.history

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.data.repository.SubscriptionRepository
import com.baritzy.subtracker.ui.components.CompanyLogo
import com.baritzy.subtracker.ui.components.EmptyState
import com.baritzy.subtracker.ui.components.formatHebrewDate
import com.baritzy.subtracker.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val repository: SubscriptionRepository
) : ViewModel() {
    val cancelled: StateFlow<List<Subscription>> = repository.getCancelledSubscriptions()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allSubscriptions: StateFlow<List<Subscription>> = repository.getAllSubscriptions()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun deleteSubscription(id: Int) {
        viewModelScope.launch { repository.deleteSubscription(id) }
    }

    // Remove start_date from a subscription (excludes it from payment history)
    fun removeStartDate(id: Int) {
        viewModelScope.launch {
            repository.updateSubscription(id, mapOf("start_date" to null))
        }
    }

    // Reset all start dates (clears entire payment history)
    fun resetAllStartDates() {
        viewModelScope.launch {
            val subs = allSubscriptions.value
            for (sub in subs) {
                if (!sub.startDate.isNullOrBlank()) {
                    repository.updateSubscription(sub.id, mapOf("start_date" to null))
                }
            }
        }
    }

    suspend fun getPlansUrl(service: String): String? {
        return repository.getPlansUrl(service)
    }
}

/** Calculate how long a subscription was active */
fun formatDuration(startDate: String?, cancelledAt: String?): String? {
    if (startDate.isNullOrBlank() || cancelledAt.isNullOrBlank()) return null
    return try {
        val start = LocalDate.parse(startDate.substring(0, 10))
        val end = LocalDate.parse(cancelledAt.substring(0, 10))
        val totalDays = ChronoUnit.DAYS.between(start, end)
        if (totalDays < 0) return null
        val months = (totalDays / 30).toInt()
        val remainingDays = (totalDays % 30).toInt()
        when {
            months == 0 -> "$totalDays ימים"
            remainingDays == 0 -> if (months == 1) "חודש" else "$months חודשים"
            months == 1 -> "חודש ו-$remainingDays ימים"
            else -> "$months חודשים ו-$remainingDays ימים"
        }
    } catch (e: Exception) { null }
}

/** Estimate total paid over subscription lifetime */
fun calcTotalPaid(sub: Subscription): Double? {
    if (sub.startDate.isNullOrBlank()) return null
    return try {
        val start = LocalDate.parse(sub.startDate.substring(0, 10))
        val end = if (!sub.cancelledAt.isNullOrBlank()) {
            LocalDate.parse(sub.cancelledAt.substring(0, 10))
        } else {
            LocalDate.now()
        }
        val totalDays = ChronoUnit.DAYS.between(start, end)
        if (totalDays <= 0) return null
        val cycleMonths = when (sub.billingCycle) {
            "yearly" -> 12
            "custom" -> sub.customCycleMonths ?: 1
            else -> 1
        }
        val cycleDays = cycleMonths * 30
        val cycles = ((totalDays + cycleDays - 1) / cycleDays).toInt() // ceil division
        cycles * sub.costPerCycle
    } catch (e: Exception) { null }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    onBack: () -> Unit,
    viewModel: HistoryViewModel = hiltViewModel()
) {
    val colors = SubTrackerThemeColors.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val cancelled by viewModel.cancelled.collectAsStateWithLifecycle()
    val allSubs by viewModel.allSubscriptions.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }

    // Sort by cancelled date, newest first
    val sorted = remember(cancelled) {
        cancelled.sortedByDescending { it.cancelledAt ?: it.updatedAt }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("היסטוריה", color = colors.textPrimary) },
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
        Column(modifier = Modifier.padding(padding)) {
            // Tab row
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = colors.background,
                contentColor = Primary
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("מנויים מבוטלים") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("סה\"כ שולם") }
                )
            }

            when (selectedTab) {
                0 -> CancelledHistoryTab(sorted, viewModel, scope, context, colors)
                1 -> {
                    var historyCurrency by remember { mutableStateOf("USD") }
                    val ilsRate = 3.7
                    PaidHistorySection(
                        subscriptions = allSubs,
                        formatAmount = { amount ->
                            if (historyCurrency == "ILS") "₪${"%.0f".format(amount * ilsRate)}"
                            else "$${"%.2f".format(amount)}"
                        },
                        ilsRate = ilsRate,
                        currency = historyCurrency,
                        onCurrencyChange = { historyCurrency = it },
                        onRemoveStartDate = { id -> viewModel.removeStartDate(id) },
                        onResetAllStartDates = { viewModel.resetAllStartDates() }
                    )
                }
            }
        }
    }
}

@Composable
private fun CancelledHistoryTab(
    sorted: List<Subscription>,
    viewModel: HistoryViewModel,
    scope: kotlinx.coroutines.CoroutineScope,
    context: android.content.Context,
    colors: SubTrackerColors
) {
        if (sorted.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                EmptyState(emoji = "🗂️", message = "אין מנויים מבוטלים עדיין")
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                itemsIndexed(sorted, key = { _, sub -> sub.id }) { index, sub ->
                    var showDeleteConfirm by remember { mutableStateOf(false) }
                    var loadingPlans by remember { mutableStateOf(false) }
                    val currSymbol = if (sub.currency == "ILS") "₪" else "$"

                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CompanyLogo(sub.companyName, sub.logoUrl, 36)
                            Spacer(modifier = Modifier.width(12.dp))

                            // Name + service + duration
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    sub.companyName,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = colors.textPrimary
                                )
                                Text(
                                    sub.serviceName,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.textMuted
                                )
                                // Duration display
                                formatDuration(sub.startDate, sub.cancelledAt)?.let { duration ->
                                    Text(
                                        duration,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = colors.textMuted
                                    )
                                }
                            }

                            // Cost info (total paid or monthly crossed out)
                            Column(horizontalAlignment = Alignment.End) {
                                val totalPaid = calcTotalPaid(sub)
                                if (totalPaid != null) {
                                    Text(
                                        "$currSymbol${"%.2f".format(totalPaid)}",
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            fontFamily = JetBrainsMonoFamily
                                        ),
                                        color = colors.textMuted
                                    )
                                } else {
                                    Text(
                                        "$currSymbol${"%.2f".format(sub.cost)}/חו׳",
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            fontFamily = JetBrainsMonoFamily,
                                            textDecoration = TextDecoration.LineThrough
                                        ),
                                        color = colors.textMuted
                                    )
                                }
                                sub.cancelledAt?.let {
                                    Text(
                                        formatHebrewDate(it.substring(0, 10)),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = colors.textMuted
                                    )
                                }
                            }
                        }

                        // Action buttons
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp)
                                .padding(bottom = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Renew button
                            Button(
                                onClick = {
                                    loadingPlans = true
                                    scope.launch {
                                        val url = viewModel.getPlansUrl(sub.companyName)
                                        val targetUrl = url ?: "https://www.google.com/search?q=${sub.companyName}+plans+pricing"
                                        try {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl)))
                                        } catch (_: Exception) {}
                                        loadingPlans = false
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !loadingPlans,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Success,
                                    contentColor = androidx.compose.ui.graphics.Color.White
                                )
                            ) {
                                if (loadingPlans) {
                                    Text("...")
                                } else {
                                    Icon(Icons.Default.OpenInNew, null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("חדש מנוי")
                                }
                            }

                            // Delete button
                            if (showDeleteConfirm) {
                                Button(
                                    onClick = {
                                        showDeleteConfirm = false
                                        viewModel.deleteSubscription(sub.id)
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = colors.error.copy(alpha = 0.2f),
                                        contentColor = colors.error
                                    )
                                ) { Text("מחק") }

                                Button(
                                    onClick = { showDeleteConfirm = false },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = colors.borderFaint,
                                        contentColor = colors.textMuted
                                    )
                                ) { Text("ביטול") }
                            } else {
                                IconButton(onClick = { showDeleteConfirm = true }) {
                                    Icon(Icons.Default.Delete, "מחק", tint = colors.textMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

