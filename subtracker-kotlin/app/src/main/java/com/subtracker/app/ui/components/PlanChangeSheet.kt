package com.baritzy.subtracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.LayoutDirection
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanChangeSheet(
    subscription: Subscription,
    onDismiss: () -> Unit,
    onSave: (Map<String, Any?>) -> Unit
) {
    val colors = SubTrackerThemeColors.colors
    val currSymbol = if (subscription.currency == "ILS") "₪" else "$"

    var newPriceStr by remember { mutableStateOf("") }
    var newCycle by remember { mutableStateOf(subscription.billingCycle) }
    var customMonthsStr by remember { mutableStateOf(subscription.customCycleMonths?.toString() ?: "3") }
    var switchDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val newPrice = newPriceStr.toDoubleOrNull() ?: 0.0
    val customMonths = customMonthsStr.toIntOrNull() ?: 3

    // Calculate proration
    val oldCycleDays = when (subscription.billingCycle) {
        "yearly" -> 365L
        "custom" -> (subscription.customCycleMonths ?: 1) * 30L
        else -> 30L
    }
    val newCycleDays = when (newCycle) {
        "yearly" -> 365L
        "custom" -> customMonths * 30L
        else -> 30L
    }

    val daysRemaining = try {
        val renewal = LocalDate.parse(subscription.renewalDate)
        val switchD = LocalDate.parse(switchDate)
        ChronoUnit.DAYS.between(switchD, renewal).coerceAtLeast(0)
    } catch (e: Exception) { 0L }

    val dailyRateOld = subscription.costPerCycle / oldCycleDays
    val credit = (dailyRateOld * daysRemaining * 100).toLong() / 100.0
    val firstPayment = (newPrice - credit).coerceAtLeast(0.0)

    val newMonthlyCost = when (newCycle) {
        "yearly" -> newPrice / 12.0
        "custom" -> newPrice / customMonths
        else -> newPrice
    }

    val newRenewalDate = try {
        LocalDate.parse(switchDate).plusDays(newCycleDays).toString()
    } catch (e: Exception) { "" }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        CompositionLocalProvider(
            androidx.compose.ui.platform.LocalLayoutDirection provides LayoutDirection.Rtl
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 16.dp)
            ) {
                Text(
                    text = "שינוי מסלול — ${subscription.companyName}",
                    style = MaterialTheme.typography.headlineSmall,
                    color = colors.textPrimary
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Current plan → New plan comparison
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.borderFaint)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("מסלול נוכחי", style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
                            val oldCycleLabel = when (subscription.billingCycle) {
                                "monthly" -> "חודש"
                                "yearly" -> "שנה"
                                else -> "${subscription.customCycleMonths} חודשים"
                            }
                            Text(
                                "$currSymbol${"%.2f".format(subscription.costPerCycle)}/$oldCycleLabel",
                                style = MaterialTheme.typography.titleMedium.copy(fontFamily = JetBrainsMonoFamily),
                                color = colors.textSecondary
                            )
                        }

                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = colors.textMuted
                        )

                        Column(modifier = Modifier.weight(1f)) {
                            Text("מסלול חדש", style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
                            if (newPrice > 0) {
                                val newCycleLabel = when (newCycle) {
                                    "monthly" -> "חודש"
                                    "yearly" -> "שנה"
                                    else -> "$customMonths חודשים"
                                }
                                Text(
                                    "$currSymbol${"%.2f".format(newPrice)}/$newCycleLabel",
                                    style = MaterialTheme.typography.titleMedium.copy(fontFamily = JetBrainsMonoFamily),
                                    color = Primary
                                )
                            } else {
                                Text("—", style = MaterialTheme.typography.titleMedium, color = colors.textMuted)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // New price
                Text("מחיר מסלול חדש ($currSymbol)", style = MaterialTheme.typography.labelMedium, color = colors.textTertiary)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = newPriceStr,
                    onValueChange = { newPriceStr = it },
                    placeholder = { Text("לדוגמה: 100", color = colors.textMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // New cycle
                Text("מחזור חיוב חדש", style = MaterialTheme.typography.labelMedium, color = colors.textTertiary)
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("monthly" to "חודשי", "yearly" to "שנתי", "custom" to "מותאם").forEach { (key, label) ->
                        FilterChip(
                            selected = newCycle == key,
                            onClick = { newCycle = key },
                            label = { Text(label) }
                        )
                    }
                }
                if (newCycle == "custom") {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = customMonthsStr,
                        onValueChange = { customMonthsStr = it },
                        placeholder = { Text("מספר חודשים", color = colors.textMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Switch date
                Text("תאריך המעבר", style = MaterialTheme.typography.labelMedium, color = colors.textTertiary)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = switchDate,
                    onValueChange = { switchDate = it },
                    placeholder = { Text("YYYY-MM-DD", color = colors.textMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                // Proration breakdown
                if (newPrice > 0) {
                    Spacer(modifier = Modifier.height(16.dp))

                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Primary.copy(alpha = 0.06f)
                        )
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                "חישוב תשלום ראשון",
                                style = MaterialTheme.typography.labelMedium,
                                color = Primary,
                                fontWeight = FontWeight.Bold
                            )

                            Spacer(modifier = Modifier.height(10.dp))

                            // New plan cost
                            ProrationRow(
                                label = "מסלול חדש ($newCycleDays ימים)",
                                value = "$currSymbol${"%.2f".format(newPrice)}"
                            )

                            // Credit
                            if (credit > 0) {
                                ProrationRow(
                                    label = "קרדיט על $daysRemaining ימים שנותרו",
                                    value = "− $currSymbol${"%.2f".format(credit)}",
                                    valueColor = Success
                                )
                            }

                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = 8.dp),
                                color = colors.border
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    "תשלום ראשון",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "$currSymbol${"%.2f".format(firstPayment)}",
                                    style = MaterialTheme.typography.titleMedium.copy(fontFamily = JetBrainsMonoFamily),
                                    color = Primary,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            val newCycleLabel = when (newCycle) {
                                "monthly" -> "חודש"
                                "yearly" -> "שנה"
                                else -> "$customMonths חודשים"
                            }
                            Text(
                                "חידוש הבא: ${formatHebrewDate(newRenewalDate)} · לאחר מכן: $currSymbol${"%.2f".format(newPrice)}/$newCycleLabel",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textMuted
                            )
                        }
                    }
                }

                // Error
                error?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = colors.error, style = MaterialTheme.typography.bodySmall)
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("ביטול")
                    }

                    Button(
                        onClick = {
                            if (newPrice <= 0) {
                                error = "יש להזין מחיר תקין"
                                return@Button
                            }
                            saving = true
                            error = null

                            val prorationNote = if (credit > 0) {
                                "שינוי מסלול $switchDate: קרדיט $currSymbol${"%.2f".format(credit)} | תשלום ראשון $currSymbol${"%.2f".format(firstPayment)}"
                            } else null

                            val existingNotes = subscription.notes?.split("\n---\n")?.firstOrNull()
                            val notes = listOfNotNull(existingNotes, prorationNote).joinToString("\n---\n").ifBlank { null }

                            onSave(buildMap {
                                put("cost", (newMonthlyCost * 100).toLong() / 100.0)
                                put("cost_per_cycle", newPrice)
                                put("billing_cycle", newCycle)
                                if (newCycle == "custom") put("custom_cycle_months", customMonths) else put("custom_cycle_months", null)
                                put("renewal_date", newRenewalDate)
                                put("notes", notes)
                            })
                        },
                        modifier = Modifier.weight(2f),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !saving && newPrice > 0
                    ) {
                        Text(if (saving) "שומר..." else "אשר שינוי מסלול")
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
private fun ProrationRow(
    label: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color? = null
) {
    val colors = SubTrackerThemeColors.colors
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = colors.textMuted,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelMedium.copy(fontFamily = JetBrainsMonoFamily),
            color = valueColor ?: colors.textSecondary,
            fontWeight = FontWeight.SemiBold
        )
    }
}
