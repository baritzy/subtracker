package com.baritzy.subtracker.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*
import kotlin.math.atan2
import kotlin.math.sqrt

@Composable
fun CostSummaryCard(
    subscriptions: List<Subscription>,
    totalMonthly: Double,
    currency: String,
    showMonthly: Boolean,
    planFilter: String,
    onCurrencyToggle: () -> Unit,
    onPlanFilterChange: (String) -> Unit,
    onToggleMonthlyYearly: () -> Unit,
    formatAmount: (Double) -> String
) {
    val colors = SubTrackerThemeColors.colors
    val displayAmount = if (showMonthly) totalMonthly else totalMonthly * 12

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.cardBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Top row: plan filter + currency
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Plan filters
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("all" to "הכל", "personal" to "פרטי", "family" to "משפחתי").forEach { (key, label) ->
                        FilterChip(
                            selected = planFilter == key,
                            onClick = { onPlanFilterChange(key) },
                            label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Primary.copy(alpha = 0.15f),
                                selectedLabelColor = Primary
                            )
                        )
                    }
                }

                // Currency toggle (segmented)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    val currencyOptions = listOf("$" to "USD", "₪" to "ILS")
                    currencyOptions.forEach { (symbol, code) ->
                        val isSelected = currency == code
                        FilterChip(
                            selected = isSelected,
                            onClick = { if (!isSelected) onCurrencyToggle() },
                            label = { Text(symbol, style = MaterialTheme.typography.labelMedium) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Primary.copy(alpha = 0.15f),
                                selectedLabelColor = Primary
                            ),
                            modifier = Modifier.height(32.dp)
                        )
                        if (code == "USD") Spacer(modifier = Modifier.width(4.dp))
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Donut chart + total
            if (subscriptions.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    DonutChart(
                        subscriptions = subscriptions,
                        formatAmount = formatAmount,
                        modifier = Modifier.size(160.dp)
                    )

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = formatAmount(displayAmount),
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontFamily = JetBrainsMonoFamily,
                                fontWeight = FontWeight.Bold
                            ),
                            color = colors.textPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        // Monthly / Yearly segmented toggle
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            FilterChip(
                                selected = showMonthly,
                                onClick = { if (!showMonthly) onToggleMonthlyYearly() },
                                label = { Text("לחודש", style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Primary.copy(alpha = 0.15f),
                                    selectedLabelColor = Primary
                                ),
                                modifier = Modifier.height(30.dp)
                            )
                            FilterChip(
                                selected = !showMonthly,
                                onClick = { if (showMonthly) onToggleMonthlyYearly() },
                                label = { Text("לשנה", style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Primary.copy(alpha = 0.15f),
                                    selectedLabelColor = Primary
                                ),
                                modifier = Modifier.height(30.dp)
                            )
                        }
                    }
                }
            } else {
                Text(
                    text = formatAmount(0.0),
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontFamily = JetBrainsMonoFamily
                    ),
                    color = colors.textPrimary,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            }

            // Legend — chips layout, no prices
            if (subscriptions.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    subscriptions.forEachIndexed { i, sub ->
                        val color = ChartColors[i % ChartColors.size]
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = color.copy(alpha = 0.12f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(color, CircleShape)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = sub.companyName,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textSecondary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DonutChart(
    subscriptions: List<Subscription>,
    formatAmount: (Double) -> String,
    modifier: Modifier = Modifier,
    ilsRate: Double = 3.7
) {
    val colors = SubTrackerThemeColors.colors
    // Normalize all costs to USD for proportional display
    val normalizedCosts = subscriptions.map { sub ->
        if (sub.currency == "ILS") sub.cost / ilsRate else sub.cost
    }
    val total = normalizedCosts.sum()
    if (total == 0.0) return

    var hoveredIndex by remember { mutableIntStateOf(-1) }

    // Auto-reset hovered segment after 2 seconds
    LaunchedEffect(hoveredIndex) {
        if (hoveredIndex >= 0) {
            kotlinx.coroutines.delay(2000L)
            hoveredIndex = -1
        }
    }

    val centerText = if (hoveredIndex >= 0 && hoveredIndex < subscriptions.size) {
        formatAmount(normalizedCosts[hoveredIndex])
    } else {
        formatAmount(total)
    }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(subscriptions) {
                    detectTapGestures { offset ->
                        val center = Offset(size.width / 2f, size.height / 2f)
                        val dx = offset.x - center.x
                        val dy = offset.y - center.y
                        val dist = sqrt(dx * dx + dy * dy)
                        // Very generous tap area — basically anywhere on the chart
                        val maxR = size.width / 2f
                        val minR = size.width / 2f * 0.2f

                        if (dist in minR..maxR) {
                            // Convert tap position to angle from 12 o'clock, clockwise
                            var angle = Math.toDegrees(atan2(dx.toDouble(), -dy.toDouble())).toFloat()
                            if (angle < 0) angle += 360f

                            var cumulative = 0f
                            normalizedCosts.forEachIndexed { i, cost ->
                                val sweep = (cost / total * 360).toFloat()
                                if (angle >= cumulative && angle < cumulative + sweep) {
                                    hoveredIndex = if (hoveredIndex == i) -1 else i
                                    return@detectTapGestures
                                }
                                cumulative += sweep
                            }
                            // Edge case: last segment wrapping around 360
                            hoveredIndex = if (hoveredIndex == normalizedCosts.lastIndex) -1 else normalizedCosts.lastIndex
                        } else {
                            hoveredIndex = -1
                        }
                    }
                }
        ) {
            val strokeWidth = size.width * 0.17f
            val radius = (size.width - strokeWidth) / 2f
            val topLeft = Offset(strokeWidth / 2f, strokeWidth / 2f)
            val arcSize = Size(radius * 2, radius * 2)

            // Layer 1: Deep shadow (offset down+right, dark)
            var sa1 = -90f
            normalizedCosts.forEachIndexed { i, cost ->
                val sweep = (cost / total * 360).toFloat()
                val color = ChartColors[i % ChartColors.size]
                drawArc(
                    color = color.copy(alpha = 0.12f),
                    startAngle = sa1,
                    sweepAngle = sweep - 2f,
                    useCenter = false,
                    topLeft = Offset(topLeft.x + 3f, topLeft.y + 10f),
                    size = arcSize,
                    style = Stroke(width = strokeWidth + 4f, cap = StrokeCap.Butt)
                )
                sa1 += sweep
            }

            // Layer 2: Mid shadow
            var sa2 = -90f
            normalizedCosts.forEachIndexed { i, cost ->
                val sweep = (cost / total * 360).toFloat()
                val color = ChartColors[i % ChartColors.size]
                drawArc(
                    color = color.copy(alpha = 0.25f),
                    startAngle = sa2,
                    sweepAngle = sweep - 2f,
                    useCenter = false,
                    topLeft = Offset(topLeft.x + 1f, topLeft.y + 5f),
                    size = arcSize,
                    style = Stroke(width = strokeWidth + 2f, cap = StrokeCap.Butt)
                )
                sa2 += sweep
            }

            // Layer 3: Main arcs (darker shade for base)
            var startAngle = -90f
            normalizedCosts.forEachIndexed { i, cost ->
                val sweep = (cost / total * 360).toFloat()
                val baseColor = ChartColors[i % ChartColors.size]
                val alpha = if (hoveredIndex >= 0 && hoveredIndex != i) 0.3f else 1f
                // Slightly darker version as base
                val darkColor = baseColor.copy(
                    red = (baseColor.red * 0.75f).coerceIn(0f, 1f),
                    green = (baseColor.green * 0.75f).coerceIn(0f, 1f),
                    blue = (baseColor.blue * 0.75f).coerceIn(0f, 1f),
                    alpha = alpha
                )
                drawArc(
                    color = darkColor,
                    startAngle = startAngle,
                    sweepAngle = sweep - 2f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                )
                startAngle += sweep
            }

            // Layer 4: Highlight (lighter, slightly thinner, offset up)
            var sa4 = -90f
            normalizedCosts.forEachIndexed { i, cost ->
                val sweep = (cost / total * 360).toFloat()
                val baseColor = ChartColors[i % ChartColors.size]
                val alpha = if (hoveredIndex >= 0 && hoveredIndex != i) 0.15f else 0.6f
                val lightColor = baseColor.copy(
                    red = (baseColor.red * 0.4f + 0.6f).coerceIn(0f, 1f),
                    green = (baseColor.green * 0.4f + 0.6f).coerceIn(0f, 1f),
                    blue = (baseColor.blue * 0.4f + 0.6f).coerceIn(0f, 1f),
                    alpha = alpha
                )
                drawArc(
                    color = lightColor,
                    startAngle = sa4,
                    sweepAngle = sweep - 2f,
                    useCenter = false,
                    topLeft = Offset(topLeft.x, topLeft.y - 1f),
                    size = arcSize,
                    style = Stroke(width = strokeWidth * 0.45f, cap = StrokeCap.Butt)
                )
                sa4 += sweep
            }
        }

        // Center text
        Text(
            text = centerText,
            style = MaterialTheme.typography.titleMedium.copy(
                fontFamily = JetBrainsMonoFamily,
                fontWeight = FontWeight.Bold
            ),
            color = colors.textPrimary
        )
    }
}
