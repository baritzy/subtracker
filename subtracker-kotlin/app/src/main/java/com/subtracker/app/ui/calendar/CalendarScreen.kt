package com.baritzy.subtracker.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.data.repository.SubscriptionRepository
import com.baritzy.subtracker.ui.components.CompanyLogo
import com.baritzy.subtracker.ui.components.EmptyState
import com.baritzy.subtracker.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

@HiltViewModel
class CalendarViewModel @Inject constructor(
    repository: SubscriptionRepository
) : ViewModel() {

    private val _currentMonth = MutableStateFlow(YearMonth.now())
    val currentMonth = _currentMonth.asStateFlow()

    val activeSubscriptions: StateFlow<List<Subscription>> =
        repository.getActiveSubscriptions()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun nextMonth() { _currentMonth.update { it.plusMonths(1) } }
    fun prevMonth() { _currentMonth.update { it.minusMonths(1) } }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    onBack: () -> Unit,
    viewModel: CalendarViewModel = hiltViewModel()
) {
    val colors = SubTrackerThemeColors.colors
    val currentMonth by viewModel.currentMonth.collectAsStateWithLifecycle()
    val subs by viewModel.activeSubscriptions.collectAsStateWithLifecycle()

    val hebrewMonths = listOf(
        "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
        "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
    )
    val dayNames = listOf("א", "ב", "ג", "ד", "ה", "ו", "ש")

    // Find renewals for this month
    val renewalsThisMonth = remember(subs, currentMonth) {
        subs.filter { sub ->
            try {
                val d = LocalDate.parse(sub.renewalDate)
                // Check if renewal falls in this month (considering recurring)
                val monthStart = currentMonth.atDay(1)
                val monthEnd = currentMonth.atEndOfMonth()
                // Simple: check if renewal day matches any day in this month
                d.dayOfMonth <= monthEnd.dayOfMonth &&
                        (d.monthValue == currentMonth.monthValue && d.year == currentMonth.year)
            } catch (e: Exception) { false }
        }
    }

    val renewalsByDay = remember(renewalsThisMonth) {
        renewalsThisMonth.groupBy {
            try { LocalDate.parse(it.renewalDate).dayOfMonth } catch (e: Exception) { 1 }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("יומן חידושים", color = colors.textPrimary) },
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Month nav
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Swap arrow visuals since previous attempts pointed inward
                    IconButton(onClick = { viewModel.nextMonth() }) {
                        Text("‹", style = MaterialTheme.typography.headlineLarge, color = colors.textSecondary)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "${hebrewMonths[currentMonth.monthValue - 1]} ${currentMonth.year}",
                            style = MaterialTheme.typography.headlineSmall,
                            color = colors.textPrimary
                        )
                        Text(
                            "${renewalsThisMonth.size} חידושים החודש",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted
                        )
                    }
                    IconButton(onClick = { viewModel.prevMonth() }) {
                        Text("›", style = MaterialTheme.typography.headlineLarge, color = colors.textSecondary)
                    }
                }
            }

            // Day names
            item {
                Row(modifier = Modifier.fillMaxWidth()) {
                    dayNames.forEach { day ->
                        Text(
                            text = day,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted
                        )
                    }
                }
            }

            // Calendar grid
            item {
                val firstDay = currentMonth.atDay(1)
                val startOffset = firstDay.dayOfWeek.value % 7 // Sunday=0
                val daysInMonth = currentMonth.lengthOfMonth()
                val today = LocalDate.now()

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    var dayCounter = 1 - startOffset
                    while (dayCounter <= daysInMonth) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            for (col in 0..6) {
                                val day = dayCounter + col
                                val isCurrentMonth = day in 1..daysInMonth
                                val isToday = isCurrentMonth &&
                                        today.year == currentMonth.year &&
                                        today.monthValue == currentMonth.monthValue &&
                                        today.dayOfMonth == day
                                val hasRenewals = isCurrentMonth && renewalsByDay.containsKey(day)

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .aspectRatio(1f)
                                        .padding(1.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(
                                            when {
                                                isToday -> Primary.copy(alpha = 0.12f)
                                                hasRenewals -> Primary.copy(alpha = 0.04f)
                                                else -> colors.cardBackground
                                            }
                                        )
                                        .then(
                                            if (isToday) Modifier.border(1.dp, Primary, RoundedCornerShape(8.dp))
                                            else Modifier
                                        ),
                                    contentAlignment = Alignment.TopCenter
                                ) {
                                    if (isCurrentMonth) {
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            modifier = Modifier.padding(2.dp)
                                        ) {
                                            Text(
                                                "$day",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = if (isToday) Primary else colors.textSecondary
                                            )
                                            renewalsByDay[day]?.take(2)?.forEach { sub ->
                                                Column(
                                                    horizontalAlignment = Alignment.CenterHorizontally,
                                                    modifier = Modifier.padding(top = 1.dp)
                                                ) {
                                                    CompanyLogo(sub.companyName, sub.logoUrl, 14)
                                                    Text(
                                                        sub.companyName,
                                                        style = MaterialTheme.typography.labelSmall.copy(
                                                            fontSize = 6.sp,
                                                            lineHeight = 7.sp
                                                        ),
                                                        color = colors.textMuted,
                                                        maxLines = 1,
                                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                                    )
                                                }
                                            }
                                            val extras = (renewalsByDay[day]?.size ?: 0) - 2
                                            if (extras > 0) {
                                                Text(
                                                    "+$extras",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontSize = 7.sp
                                                    ),
                                                    color = Primary
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        dayCounter += 7
                    }
                }
            }

            // Monthly summary
            if (renewalsThisMonth.isNotEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                "חידושים החודש",
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.textPrimary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            renewalsThisMonth.forEach { sub ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CompanyLogo(sub.companyName, sub.logoUrl, 28)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(sub.companyName, modifier = Modifier.weight(1f),
                                        style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                                    Text(
                                        "$${sub.costPerCycle}",
                                        style = MaterialTheme.typography.labelMedium.copy(fontFamily = JetBrainsMonoFamily),
                                        color = colors.textPrimary
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                item {
                    EmptyState(emoji = "📅", message = "אין חידושי מנויים בחודש זה")
                }
            }
        }
    }
}
