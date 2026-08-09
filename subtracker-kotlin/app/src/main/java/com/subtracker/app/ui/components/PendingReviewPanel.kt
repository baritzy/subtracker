package com.baritzy.subtracker.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*

@Composable
fun PendingReviewPanel(
    pending: List<Subscription>,
    onConfirm: (Subscription) -> Unit,
    onDismiss: (Subscription) -> Unit
) {
    val colors = SubTrackerThemeColors.colors
    var expanded by remember { mutableStateOf(false) }
    val chevronRotation by animateFloatAsState(
        if (expanded) 180f else 0f, tween(200), label = "chevron"
    )

    // Selection state for batch import
    val selectedIds = remember { mutableStateMapOf<Int, Boolean>() }

    // Initialize all as selected
    LaunchedEffect(pending) {
        pending.forEach { sub ->
            if (!selectedIds.containsKey(sub.id)) {
                selectedIds[sub.id] = true
            }
        }
    }

    val selectedCount = pending.count { selectedIds[it.id] == true }
    val allSelected = selectedCount == pending.size

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Primary.copy(alpha = 0.06f)
        )
    ) {
        Column {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Mail, contentDescription = null, tint = Primary)
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "מנויים שנמצאו",
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.textPrimary
                    )
                    Text(
                        text = "נמצאו ${pending.size} מנויים ב-Gmail",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted
                    )
                }
                Icon(
                    Icons.Default.ExpandMore,
                    contentDescription = null,
                    modifier = Modifier
                        .size(20.dp)
                        .rotate(chevronRotation),
                    tint = colors.textMuted
                )
            }

            // Content
            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {

                    // Select all toggle
                    TextButton(
                        onClick = {
                            val newValue = !allSelected
                            pending.forEach { selectedIds[it.id] = newValue }
                        }
                    ) {
                        Text(
                            if (allSelected) "בטל הכל" else "בחר הכל",
                            style = MaterialTheme.typography.labelSmall,
                            color = Primary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    HorizontalDivider(color = colors.border.copy(alpha = 0.3f))

                    Spacer(modifier = Modifier.height(4.dp))

                    // Subscription items with checkboxes
                    pending.forEach { sub ->
                        val isSelected = selectedIds[sub.id] == true
                        val currSymbol = if (sub.currency == "ILS") "₪" else "$"

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedIds[sub.id] = !isSelected }
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Checkbox
                            Checkbox(
                                checked = isSelected,
                                onCheckedChange = { selectedIds[sub.id] = it },
                                colors = CheckboxDefaults.colors(checkedColor = Primary)
                            )

                            Spacer(modifier = Modifier.width(4.dp))

                            // Logo
                            CompanyLogo(sub.companyName, sub.logoUrl, 32)

                            Spacer(modifier = Modifier.width(8.dp))

                            // Info
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    sub.companyName,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.textPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "חידוש: ${if (sub.renewalDate.isNotBlank()) formatHebrewDate(sub.renewalDate) else "—"}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textMuted
                                )
                            }

                            // Cost
                            if (sub.cost > 0) {
                                Text(
                                    "$currSymbol${"%.2f".format(sub.cost)}/חו׳",
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        fontFamily = JetBrainsMonoFamily
                                    ),
                                    color = colors.textSecondary
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Bottom action buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Cancel — dismiss all pending (user doesn't want any of them)
                        OutlinedButton(
                            onClick = {
                                // Delete all pending — user chose to dismiss the entire batch
                                pending.forEach { sub -> onDismiss(sub) }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("ביטול")
                        }

                        // Confirm selected, dismiss unselected
                        Button(
                            onClick = {
                                pending.forEach { sub ->
                                    if (selectedIds[sub.id] == true) {
                                        onConfirm(sub)
                                    } else {
                                        onDismiss(sub)
                                    }
                                }
                            },
                            modifier = Modifier.weight(2f),
                            shape = RoundedCornerShape(12.dp),
                            enabled = selectedCount > 0
                        ) {
                            Text(
                                if (selectedCount == pending.size) "ייבא את כולם"
                                else "ייבא $selectedCount נבחרים"
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}
