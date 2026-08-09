package com.baritzy.subtracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*

@Composable
fun RenewalTimelineCard(
    renewals: List<Subscription>,
    formatAmount: (Double) -> String,
    daysUntil: (String) -> Long
) {
    val colors = SubTrackerThemeColors.colors

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Warning.copy(alpha = 0.06f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "חידושים ב-7 ימים הקרובים",
                style = MaterialTheme.typography.titleMedium,
                color = colors.textPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))

            renewals.forEach { sub ->
                val days = daysUntil(sub.renewalDate).toInt()
                val urgencyCol = urgencyColor(days)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Dot
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(urgencyCol, CircleShape)
                    )

                    Spacer(modifier = Modifier.width(10.dp))

                    // Name
                    Text(
                        text = sub.companyName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textSecondary,
                        modifier = Modifier.weight(1f)
                    )

                    // Date
                    Text(
                        text = formatHebrewDate(sub.renewalDate),
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted
                    )

                    Spacer(modifier = Modifier.width(12.dp))

                    // Cost — show in the subscription's own currency (same as card)
                    val currSymbol = if (sub.currency == "ILS") "₪" else "$"
                    Text(
                        text = "$currSymbol${"%.2f".format(sub.costPerCycle)}",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontFamily = JetBrainsMonoFamily
                        ),
                        color = colors.textSecondary
                    )
                }
            }
        }
    }
}
