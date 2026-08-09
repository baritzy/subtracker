package com.baritzy.subtracker.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import com.baritzy.subtracker.R
import com.baritzy.subtracker.data.model.Invoice
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

@Composable
fun SubscriptionCard(
    subscription: Subscription,
    index: Int,
    formatAmount: (Double) -> String,
    daysUntilRenewal: Long,
    onEdit: () -> Unit,
    onCancel: () -> Unit,
    onDelete: () -> Unit,
    onUpdate: ((Int, Map<String, Any?>) -> Unit)? = null,
    onFetchInvoices: (suspend (Int) -> List<Invoice>)? = null,
    onValidateCancelUrl: (suspend (String) -> String?)? = null
) {
    val colors = SubTrackerThemeColors.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var expanded by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    var showCancelConfirm by remember { mutableStateOf(false) }
    var showInvoices by remember { mutableStateOf(false) }
    var showPlanChange by remember { mutableStateOf(false) }
    var cancelLoading by remember { mutableStateOf(false) }
    var noCancelUrl by remember { mutableStateOf(false) }

    // Invoices state
    var invoices by remember { mutableStateOf<List<Invoice>>(emptyList()) }
    var invoicesLoading by remember { mutableStateOf(false) }
    var invoicesLoaded by remember { mutableStateOf(false) }

    val chevronRotation by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        animationSpec = tween(200), label = "chevron"
    )

    val companyColor = CompanyColors.getColor(subscription.companyName)
    val urgencyCol = urgencyColor(daysUntilRenewal.toInt())

    // Entry animation
    val animAlpha = remember { Animatable(0f) }
    val animOffsetY = remember { Animatable(16f) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(index * 60L)
        launch { animAlpha.animateTo(1f, tween(220)) }
        animOffsetY.animateTo(0f, tween(220))
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                alpha = animAlpha.value
                translationY = animOffsetY.value
            }
            .clickable {
                expanded = !expanded
                showCancelConfirm = false
                noCancelUrl = false
            },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.cardBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Collapsed header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Logo
                CompanyLogo(
                    companyName = subscription.companyName,
                    logoUrl = subscription.logoUrl,
                    size = 36
                )

                Spacer(modifier = Modifier.width(12.dp))

                // Name + service + trial badge
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = subscription.companyName,
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.textPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        // Trial badge in collapsed state
                        if (subscription.isTrial == 1) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Warning.copy(alpha = 0.12f)
                            ) {
                                Text(
                                    "Trial",
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp),
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                    color = Warning,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    Text(
                        text = subscription.serviceName,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Cost — always show in the subscription's own currency
                Text(
                    text = "${if (subscription.currency == "ILS") "₪" else "$"}${"%.2f".format(subscription.costPerCycle)}",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontFamily = JetBrainsMonoFamily,
                        color = PrimaryDark
                    )
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Days badge
                DaysBadge(daysUntilRenewal.toInt(), urgencyCol)

                Spacer(modifier = Modifier.width(4.dp))

                // Chevron
                Icon(
                    Icons.Default.ExpandMore,
                    contentDescription = null,
                    modifier = Modifier
                        .size(20.dp)
                        .rotate(chevronRotation),
                    tint = colors.textMuted
                )
            }

            // Expanded content
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically(tween(200)) + fadeIn(tween(200)),
                exit = shrinkVertically(tween(150)) + fadeOut(tween(150))
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    // Color accent bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(companyColor)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Plan badge + menu
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val planLabel = when (subscription.planType) {
                            "family" -> "משפחתי"
                            "other" -> subscription.planTypeCustom ?: "אחר"
                            else -> "פרטי"
                        }
                        if (subscription.planType != "personal") {
                            AssistChip(
                                onClick = {},
                                label = { Text(planLabel, style = MaterialTheme.typography.labelSmall) },
                                colors = AssistChipDefaults.assistChipColors(
                                    containerColor = if (subscription.planType == "family")
                                        Success.copy(alpha = 0.1f) else colors.borderFaint
                                )
                            )
                        } else {
                            Spacer(modifier = Modifier.width(1.dp))
                        }

                        Box {
                            IconButton(onClick = { showMenu = true }) {
                                Icon(Icons.Default.MoreVert, contentDescription = "תפריט",
                                    tint = colors.textMuted)
                            }
                            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                                DropdownMenuItem(
                                    text = { Text("עריכה") },
                                    leadingIcon = { Icon(Icons.Default.Edit, null) },
                                    onClick = { showMenu = false; onEdit() }
                                )
                                // Plan change option
                                if (onUpdate != null) {
                                    DropdownMenuItem(
                                        text = { Text("שנה מסלול") },
                                        leadingIcon = { Icon(Icons.Default.SwapVert, null) },
                                        onClick = { showMenu = false; showPlanChange = true }
                                    )
                                }
                                DropdownMenuItem(
                                    text = { Text("ביטלתי את המנוי", color = colors.error) },
                                    leadingIcon = { Icon(Icons.Default.Cancel, null, tint = colors.error) },
                                    onClick = { showMenu = false; showCancelConfirm = true }
                                )
                            }
                        }
                    }

                    // Trial badge with end date
                    if (subscription.isTrial == 1) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Card(
                            shape = RoundedCornerShape(10.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = Warning.copy(alpha = 0.07f)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "🎯 ניסיון חינם",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Warning
                                )
                                subscription.trialEndDate?.let { endDate ->
                                    Text(
                                        " · מסתיים ${formatHebrewDate(endDate)}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = colors.textMuted
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Billing cycle info — use subscription's own currency
                    val currSymbol = if (subscription.currency == "ILS") "₪" else "$"
                    val costDisplay = "$currSymbol${"%.2f".format(subscription.costPerCycle)}"
                    if (subscription.billingCycle == "yearly") {
                        Text(
                            text = "שווה ערך ל-$currSymbol${"%.2f".format(subscription.cost)}/חודש",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted
                        )
                    }
                    if (subscription.billingCycle == "custom") {
                        Text(
                            text = "כל ${subscription.customCycleMonths ?: 1} חודשים · שווה ערך ל-$currSymbol${"%.2f".format(subscription.cost)}/חודש",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Renewal date
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "מתחדש ${formatHebrewDate(subscription.renewalDate)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textTertiary
                        )
                        Text(
                            text = DaysBadgeLabel(daysUntilRenewal.toInt()),
                            style = MaterialTheme.typography.labelSmall,
                            color = urgencyCol,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Progress bar
                    RenewalProgressBar(
                        renewalDate = subscription.renewalDate,
                        billingCycle = subscription.billingCycle,
                        customMonths = subscription.customCycleMonths
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Notes
                    subscription.notes?.takeIf { it.isNotBlank() }?.let { notes ->
                        Text(
                            text = notes,
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // Notification toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = subscription.notificationsEnabled == 1,
                            onCheckedChange = { enabled ->
                                onUpdate?.invoke(subscription.id, mapOf("notifications_enabled" to if (enabled) 1 else 0))
                            },
                            modifier = Modifier.size(24.dp),
                            colors = CheckboxDefaults.colors(
                                checkedColor = Primary,
                                checkmarkColor = Color.White
                            )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            Icons.Default.Notifications,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = if (subscription.notificationsEnabled == 1) Primary else colors.textMuted
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "\u05E7\u05D1\u05DC \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05DC\u05DE\u05E0\u05D5\u05D9 \u05D6\u05D4",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Invoices button + expandable list
                    OutlinedButton(
                        onClick = {
                            showInvoices = !showInvoices
                            // Fetch invoices from API when first opened
                            if (showInvoices && !invoicesLoaded && onFetchInvoices != null) {
                                invoicesLoading = true
                                scope.launch {
                                    try {
                                        invoices = onFetchInvoices(subscription.id)
                                    } catch (_: Exception) {}
                                    invoicesLoading = false
                                    invoicesLoaded = true
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = colors.textSecondary
                        )
                    ) {
                        Icon(Icons.Default.Receipt, null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("חשבוניות")
                    }

                    AnimatedVisibility(visible = showInvoices) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = CardDefaults.cardColors(containerColor = colors.borderFaint)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                if (invoicesLoading) {
                                    Box(
                                        modifier = Modifier.fillMaxWidth(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            strokeWidth = 2.dp
                                        )
                                    }
                                } else if (invoices.isEmpty()) {
                                    Text(
                                        "אין חשבוניות מזוהות עדיין",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textMuted,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                } else {
                                    // Total
                                    val total = invoices.sumOf { it.amount }
                                    val since = invoices.lastOrNull()?.invoiceDate?.let {
                                        try { formatHebrewDate(it.substring(0, 10)) } catch (_: Exception) { null }
                                    }
                                    if (since != null) {
                                        Text(
                                            "סה\"כ $currSymbol${"%.2f".format(total)} מאז $since",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = colors.textMuted,
                                            modifier = Modifier.padding(bottom = 8.dp)
                                        )
                                    }

                                    invoices.forEach { inv ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 6.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                "$currSymbol${"%.2f".format(inv.amount)}",
                                                style = MaterialTheme.typography.titleSmall.copy(fontFamily = JetBrainsMonoFamily),
                                                color = colors.textPrimary
                                            )
                                            Column(horizontalAlignment = Alignment.End) {
                                                Text(
                                                    formatHebrewDate(inv.invoiceDate.substring(0, 10)),
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = colors.textSecondary
                                                )
                                                Text(
                                                    if (inv.billingCycle == "yearly") "שנתי" else "חודשי",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = colors.textMuted
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Cancel subscription button with server validation
                    if (showCancelConfirm) {
                        Card(
                            shape = RoundedCornerShape(10.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = colors.error.copy(alpha = 0.06f)
                            )
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    "ביטלת את המנוי?",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.error.copy(alpha = 0.7f)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = {
                                            showCancelConfirm = false
                                            expanded = false
                                            onCancel()
                                        },
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = colors.error.copy(alpha = 0.2f),
                                            contentColor = colors.error
                                        )
                                    ) { Text("כן, ביטלתי", fontWeight = FontWeight.Bold) }

                                    Button(
                                        onClick = { showCancelConfirm = false },
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = colors.borderFaint,
                                            contentColor = colors.textSecondary
                                        )
                                    ) { Text("לא, עדיין פעיל") }
                                }
                            }
                        }
                    } else if (noCancelUrl) {
                        Card(
                            shape = RoundedCornerShape(10.dp),
                            colors = CardDefaults.cardColors(containerColor = colors.cardBackground)
                        ) {
                            Text(
                                "לא הוגדר עמוד ביטול מנוי",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textMuted,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(11.dp)
                            )
                        }
                    } else {
                        Button(
                            onClick = {
                                cancelLoading = true
                                scope.launch {
                                    try {
                                        // Validate cancel URL via server first
                                        val validatedUrl = onValidateCancelUrl?.invoke(subscription.companyName)
                                        val target = validatedUrl ?: subscription.cancelUrl

                                        if (!target.isNullOrBlank()) {
                                            try {
                                                context.startActivity(
                                                    android.content.Intent(
                                                        android.content.Intent.ACTION_VIEW,
                                                        android.net.Uri.parse(target)
                                                    )
                                                )
                                            } catch (_: Exception) {}
                                            showCancelConfirm = true
                                        } else {
                                            noCancelUrl = true
                                        }
                                    } catch (_: Exception) {
                                        // Fallback to stored URL
                                        val fallback = subscription.cancelUrl
                                        if (!fallback.isNullOrBlank()) {
                                            try {
                                                context.startActivity(
                                                    android.content.Intent(
                                                        android.content.Intent.ACTION_VIEW,
                                                        android.net.Uri.parse(fallback)
                                                    )
                                                )
                                            } catch (_: Exception) {}
                                            showCancelConfirm = true
                                        } else {
                                            noCancelUrl = true
                                        }
                                    }
                                    cancelLoading = false
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            enabled = !cancelLoading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.error.copy(alpha = 0.1f),
                                contentColor = colors.error
                            )
                        ) {
                            if (cancelLoading) {
                                Text("בודק...")
                            } else {
                                Icon(Icons.Default.OpenInNew, null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("בטל מנוי")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                }
            }
        }
    }

    // Cancel confirmation dialog (legacy — replaced by inline confirm above)

    // Plan change sheet
    if (showPlanChange && onUpdate != null) {
        PlanChangeSheet(
            subscription = subscription,
            onDismiss = { showPlanChange = false },
            onSave = { updates ->
                onUpdate(subscription.id, updates)
                showPlanChange = false
            }
        )
    }
}

@Composable
fun DaysBadge(days: Int, color: Color) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.15f)
    ) {
        Text(
            text = DaysBadgeLabel(days),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.SemiBold
        )
    }
}

fun DaysBadgeLabel(days: Int): String = when {
    days < 0 -> "פג"
    days == 0 -> "היום"
    days == 1 -> "מחר"
    else -> "$days ימים"
}

@Composable
fun RenewalProgressBar(
    renewalDate: String,
    billingCycle: String,
    customMonths: Int?
) {
    val colors = SubTrackerThemeColors.colors
    val progress = remember(renewalDate, billingCycle) {
        try {
            val renewal = LocalDate.parse(renewalDate)
            val cycleDays = when (billingCycle) {
                "yearly" -> 365L
                "custom" -> (customMonths ?: 1) * 30L
                else -> 30L
            }
            val startDate = renewal.minusDays(cycleDays)
            val elapsed = ChronoUnit.DAYS.between(startDate, LocalDate.now()).toFloat()
            (elapsed / cycleDays).coerceIn(0f, 1f)
        } catch (e: Exception) { 0.5f }
    }

    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(600, easing = FastOutSlowInEasing),
        label = "progress"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(3.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(colors.borderFaint)
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(animatedProgress)
                .clip(RoundedCornerShape(2.dp))
                .background(
                    Brush.horizontalGradient(listOf(Primary, Secondary))
                )
        )
    }
}

@Composable
fun CompanyLogo(companyName: String, logoUrl: String?, size: Int = 36) {
    val colors = SubTrackerThemeColors.colors
    val companyColor = CompanyColors.getColor(companyName)

    // Hardcoded local logo for companies with known broken/missing favicons
    val localLogoRes: Int? = when {
        companyName.lowercase().let { n ->
            n.contains("freetv") || n.contains("free tv") ||
            n.contains("פריטיוי") || n.contains("פרי טי") || n.contains("פרי טיוי")
        } -> R.drawable.logo_freetv
        else -> null
    }

    if (localLogoRes != null) {
        Image(
            painter = painterResource(id = localLogoRes),
            contentDescription = companyName,
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Fit
        )
        return
    }

    // Handle local:// sentinel URLs (e.g. local://logo_freetv stored in DB)
    if (logoUrl?.startsWith("local://logo_freetv") == true) {
        Image(
            painter = painterResource(id = R.drawable.logo_freetv),
            contentDescription = companyName,
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Fit
        )
        return
    }

    // Convert dead Clearbit / low-res DuckDuckGo URLs → Google favicons (128px, reliable)
    val resolvedUrl = logoUrl?.let { url ->
        when {
            url.startsWith("/") -> url // local file path — keep as-is
            url.contains("logo.clearbit.com") -> {
                val domain = url.substringAfter("logo.clearbit.com/")
                "https://www.google.com/s2/favicons?domain=$domain&sz=128"
            }
            url.contains("icons.duckduckgo.com") -> {
                val domain = url.substringAfter("ip3/").removeSuffix(".ico")
                "https://www.google.com/s2/favicons?domain=$domain&sz=128"
            }
            else -> url
        }
    }

    if (resolvedUrl != null) {
        var showFallback by remember { mutableStateOf(false) }
        // Support local file paths (from custom logo upload) and remote URLs
        val imageData: Any = if (resolvedUrl.startsWith("/")) java.io.File(resolvedUrl) else resolvedUrl

        if (!showFallback) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imageData)
                    .crossfade(true)
                    .build(),
                contentDescription = companyName,
                modifier = Modifier
                    .size(size.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White),
                contentScale = ContentScale.Fit,
                onError = { showFallback = true }
            )
        } else {
            LogoInitials(companyName, companyColor, size)
        }
    } else {
        LogoInitials(companyName, companyColor, size)
    }
}

@Composable
private fun LogoInitials(companyName: String, companyColor: Color, size: Int) {
    val initials = companyName.take(2).uppercase()
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(companyColor.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initials,
            style = MaterialTheme.typography.labelMedium,
            color = companyColor,
            fontWeight = FontWeight.Bold
        )
    }
}

fun formatHebrewDate(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr)
        val hebrewMonths = listOf(
            "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
            "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
        )
        "${date.dayOfMonth} ${hebrewMonths[date.monthValue - 1]} ${date.year}"
    } catch (e: Exception) {
        dateStr
    }
}
