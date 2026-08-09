package com.baritzy.subtracker.ui.history

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.ui.unit.Dp
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*
import java.time.LocalDate

data class YearData(
    val year: Int,
    val total: Double,
    val rows: List<SubPaymentRow>
)

data class SubPaymentRow(
    val id: Int, // subscription ID for deletion
    val name: String,
    val service: String,
    val amount: Double,
    val currency: String,
    val payments: Int
)

fun buildYearData(subscriptions: List<Subscription>, ilsRate: Double): List<YearData> {
    val now = LocalDate.now()
    // year → subscription id → accumulated data
    val byYear = mutableMapOf<Int, MutableMap<Int, MutableSubData>>()

    for (s in subscriptions) {
        if (s.status != "active" || s.startDate.isNullOrBlank()) continue

        val start = try { LocalDate.parse(s.startDate.substring(0, 10)) } catch (e: Exception) { continue }
        if (start.isAfter(now)) continue

        val usdPerPayment = if (s.currency == "ILS") s.costPerCycle / ilsRate else s.costPerCycle

        var paymentDate = start
        val monthsToAdd = when (s.billingCycle) {
            "monthly" -> 1L
            "custom" -> (s.customCycleMonths ?: 1).toLong()
            else -> 12L
        }

        while (!paymentDate.isAfter(now)) {
            val yr = paymentDate.year
            val yearMap = byYear.getOrPut(yr) { mutableMapOf() }
            val data = yearMap.getOrPut(s.id) {
                MutableSubData(s.companyName, s.serviceName, 0.0, s.currency, s.costPerCycle, 0)
            }
            data.usdAmount += usdPerPayment
            data.payments++

            paymentDate = paymentDate.plusMonths(monthsToAdd)
        }
    }

    return byYear.entries
        .map { (year, subs) ->
            val rows = subs.entries.map { (id, data) -> SubPaymentRow(id, data.name, data.service, data.usdAmount, data.currency, data.payments) }
            YearData(year, rows.sumOf { it.amount }, rows)
        }
        .sortedByDescending { it.year }
}

private data class MutableSubData(
    val name: String,
    val service: String,
    var usdAmount: Double,
    val currency: String,
    val costPerCycle: Double,
    var payments: Int
)

@Composable
fun PaidHistorySection(
    subscriptions: List<Subscription>,
    formatAmount: (Double) -> String,
    ilsRate: Double,
    currency: String = "USD",
    onCurrencyChange: (String) -> Unit = {},
    onRemoveStartDate: (Int) -> Unit = {}, // remove start_date to exclude from payment history
    onResetAllStartDates: () -> Unit = {}
) {
    val colors = SubTrackerThemeColors.colors
    val years = remember(subscriptions) { buildYearData(subscriptions, ilsRate) }
    val grandTotal = years.sumOf { it.total }

    if (years.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxWidth().padding(60.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("📂", fontSize = 40.sp)
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    "אין נתוני תשלום עדיין",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "הוסף תאריך התחלה למנויים שלך כדי לראות כאן את ההיסטוריה",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
            }
        }
        return
    }

    Column(
        modifier = Modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Grand total card
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Primary.copy(alpha = 0.1f)
            )
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "סה\"כ שולם (כל הזמנים)",
                        style = MaterialTheme.typography.labelMedium,
                        color = Primary,
                        fontWeight = FontWeight.Bold
                    )
                    // Currency toggle
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        FilterChip(
                            selected = currency == "USD",
                            onClick = { onCurrencyChange("USD") },
                            label = { Text("$", style = MaterialTheme.typography.labelSmall) }
                        )
                        FilterChip(
                            selected = currency == "ILS",
                            onClick = { onCurrencyChange("ILS") },
                            label = { Text("₪", style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    formatAmount(grandTotal),
                    style = MaterialTheme.typography.displayMedium.copy(
                        fontFamily = JetBrainsMonoFamily
                    ),
                    color = colors.textPrimary,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "על פני ${years.size} שנה${if (years.size > 1) "ים" else ""}",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted
                )
            }
        }

        // Yearly cards
        years.forEachIndexed { index, yr ->
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
            ) {
                Column {
                    // Year header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            yr.year.toString(),
                            style = MaterialTheme.typography.titleLarge,
                            color = colors.textPrimary,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            formatAmount(yr.total),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontFamily = JetBrainsMonoFamily
                            ),
                            color = Primary,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    HorizontalDivider(color = colors.border.copy(alpha = 0.3f))

                    // Rows per subscription
                    yr.rows.forEach { row ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 16.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    row.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.textPrimary,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    "${row.payments} תשלום${if (row.payments > 1) "ים" else ""}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textMuted
                                )
                            }
                            Text(
                                formatAmount(row.amount),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontFamily = JetBrainsMonoFamily
                                ),
                                color = colors.textSecondary,
                                fontWeight = FontWeight.Bold
                            )
                            // Delete from payment history
                            IconButton(
                                onClick = { onRemoveStartDate(row.id) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "הסר מהיסטוריה",
                                    tint = colors.textMuted,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }

        // Reset payment history button
        var showResetConfirm by remember { mutableStateOf(false) }
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = { showResetConfirm = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.error)
        ) {
            Icon(Icons.Default.DeleteSweep, null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("אפס היסטוריית תשלומים")
        }

        if (showResetConfirm) {
            AlertDialog(
                onDismissRequest = { showResetConfirm = false },
                title = { Text("אפס היסטוריית תשלומים") },
                text = { Text("פעולה זו תמחק את תאריכי ההתחלה של כל המנויים. הנתונים ב\"סה\"כ שולם\" יתאפסו.\n\nהמנויים עצמם לא יימחקו.") },
                confirmButton = {
                    TextButton(onClick = {
                        showResetConfirm = false
                        onResetAllStartDates()
                    }) { Text("אפס", color = colors.error) }
                },
                dismissButton = {
                    TextButton(onClick = { showResetConfirm = false }) { Text("ביטול") }
                }
            )
        }
    }
}
