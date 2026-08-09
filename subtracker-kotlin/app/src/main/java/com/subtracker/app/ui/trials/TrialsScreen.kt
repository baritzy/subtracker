package com.baritzy.subtracker.ui.trials

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.data.repository.SubscriptionRepository
import com.baritzy.subtracker.ui.components.*
import com.baritzy.subtracker.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

@HiltViewModel
class TrialsViewModel @Inject constructor(
    private val repository: SubscriptionRepository
) : ViewModel() {
    val trials: StateFlow<List<Subscription>> = repository.getActiveTrials()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun convertToPaid(subscription: Subscription) {
        viewModelScope.launch {
            repository.updateSubscription(subscription.id, mapOf(
                "is_trial" to false,
                "trial_end_date" to null
            ))
        }
    }

    fun deleteSubscription(id: Int) {
        viewModelScope.launch { repository.deleteSubscription(id) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrialsScreen(
    onBack: () -> Unit,
    viewModel: TrialsViewModel = hiltViewModel()
) {
    val colors = SubTrackerThemeColors.colors
    val trials by viewModel.trials.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ניסיונות חינם", color = colors.textPrimary) },
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
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Alert header
            if (trials.isNotEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Warning.copy(alpha = 0.06f)
                        )
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                "🎯 ${trials.size} ניסיונות פעילים",
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "עקוב אחרי מתי כל אחד מסתיים — לפני שמחייבים אותך",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted
                            )
                        }
                    }
                }
            }

            if (trials.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillParentMaxHeight(0.7f), contentAlignment = Alignment.Center) {
                        EmptyState(emoji = "🆓", message = "אין מנויי Trials פעילים")
                    }
                }
            }

            itemsIndexed(trials, key = { _, sub -> sub.id }) { _, sub ->
                val trialDays = remember(sub.trialEndDate) {
                    try {
                        val endDate = LocalDate.parse(sub.trialEndDate)
                        ChronoUnit.DAYS.between(LocalDate.now(), endDate).toInt()
                    } catch (e: Exception) { 0 }
                }
                val urgencyCol = urgencyColor(trialDays)

                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = urgencyCol.copy(alpha = 0.08f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CompanyLogo(sub.companyName, sub.logoUrl, 44)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(sub.companyName, style = MaterialTheme.typography.titleMedium,
                                    color = colors.textPrimary)
                                Text(sub.serviceName, style = MaterialTheme.typography.bodySmall,
                                    color = colors.textMuted)
                            }
                            IconButton(onClick = { viewModel.deleteSubscription(sub.id) }) {
                                Icon(Icons.Default.Delete, "מחק", tint = colors.textMuted)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            sub.trialEndDate?.let {
                                Text(
                                    "סיום ניסיון: ${formatHebrewDate(it)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.textTertiary
                                )
                            }
                            DaysBadge(trialDays, urgencyCol)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        val cycleLabel = when (sub.billingCycle) {
                            "yearly" -> "שנה"
                            else -> "חודש"
                        }
                        Text(
                            "מחיר אחרי הניסיון: $${sub.costPerCycle} / $cycleLabel",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = { viewModel.convertToPaid(sub) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("עברתי למנוי בתשלום")
                        }
                    }
                }
            }
        }
    }
}
