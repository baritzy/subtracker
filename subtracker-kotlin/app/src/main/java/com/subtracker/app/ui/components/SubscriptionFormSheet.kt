package com.baritzy.subtracker.ui.components

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import com.baritzy.subtracker.R
import com.baritzy.subtracker.data.model.CreateSubscriptionRequest
import com.baritzy.subtracker.data.model.LogoSearchResponse
import com.baritzy.subtracker.data.model.ReceiptScanResponse
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.LayoutDirection
import java.time.LocalDate
import java.time.Instant
import java.time.ZoneOffset
import android.content.Context

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionFormSheet(
    subscription: Subscription? = null,
    prefill: ReceiptScanResponse? = null,
    onDismiss: () -> Unit,
    onCreate: (CreateSubscriptionRequest) -> Unit,
    onUpdate: (Int, Map<String, Any?>) -> Unit,
    onSearchLogo: suspend (String) -> LogoSearchResponse? = { null },
    onSearchCancelUrl: suspend (String) -> String? = { null }
) {
    val colors = SubTrackerThemeColors.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val isEditing = subscription != null

    // Draft saving — restore from SharedPreferences for new subscriptions
    val draftPrefs = remember { context.getSharedPreferences("form_draft", Context.MODE_PRIVATE) }

    fun loadDraft(key: String, default: String): String {
        if (isEditing) return default
        return draftPrefs.getString(key, null) ?: default
    }

    // Map prefill billing cycle (quarterly → custom)
    val prefillBillingCycle = when (prefill?.billingCycle) {
        "monthly" -> "monthly"
        "yearly" -> "yearly"
        "quarterly" -> "custom"
        else -> null
    }
    val prefillCustomMonths = if (prefill?.billingCycle == "quarterly") "3" else null

    var companyName by remember { mutableStateOf(subscription?.companyName ?: prefill?.companyName ?: loadDraft("company_name", "")) }
    var serviceName by remember { mutableStateOf(subscription?.serviceName ?: prefill?.serviceName ?: loadDraft("service_name", "")) }
    var costStr by remember { mutableStateOf(subscription?.costPerCycle?.toString() ?: prefill?.cost?.toString() ?: loadDraft("cost", "")) }
    var billingCycle by remember { mutableStateOf(subscription?.billingCycle ?: prefillBillingCycle ?: loadDraft("billing_cycle", "monthly")) }
    var customMonthsStr by remember { mutableStateOf(subscription?.customCycleMonths?.toString() ?: prefillCustomMonths ?: loadDraft("custom_months", "")) }
    var renewalDate by remember { mutableStateOf(subscription?.renewalDate ?: prefill?.renewalDate ?: loadDraft("renewal_date", LocalDate.now().plusMonths(1).toString())) }
    var startDate by remember { mutableStateOf(subscription?.startDate ?: prefill?.startDate ?: loadDraft("start_date", "")) }
    var planType by remember { mutableStateOf(subscription?.planType ?: loadDraft("plan_type", "personal")) }
    var planCustom by remember { mutableStateOf(subscription?.planTypeCustom ?: loadDraft("plan_custom", "")) }
    var currency by remember { mutableStateOf(subscription?.currency ?: prefill?.currency?.takeIf { it == "ILS" || it == "USD" } ?: loadDraft("currency", "USD")) }
    var isTrial by remember { mutableStateOf(if (isEditing) (subscription?.isTrial ?: 0) == 1 else draftPrefs.getBoolean("is_trial", false)) }
    var trialEndDate by remember { mutableStateOf(subscription?.trialEndDate ?: loadDraft("trial_end_date", "")) }
    var cancelUrl by remember { mutableStateOf(subscription?.cancelUrl ?: prefill?.cancelUrl ?: loadDraft("cancel_url", "")) }
    var notes by remember { mutableStateOf(subscription?.notes ?: prefill?.notes ?: loadDraft("notes", "")) }

    // Save draft whenever form changes (only for new subscriptions)
    LaunchedEffect(companyName, serviceName, costStr, billingCycle, currency, renewalDate, cancelUrl, notes) {
        if (!isEditing) {
            draftPrefs.edit()
                .putString("company_name", companyName)
                .putString("service_name", serviceName)
                .putString("cost", costStr)
                .putString("billing_cycle", billingCycle)
                .putString("custom_months", customMonthsStr)
                .putString("renewal_date", renewalDate)
                .putString("start_date", startDate)
                .putString("plan_type", planType)
                .putString("plan_custom", planCustom)
                .putString("currency", currency)
                .putBoolean("is_trial", isTrial)
                .putString("trial_end_date", trialEndDate)
                .putString("cancel_url", cancelUrl)
                .putString("notes", notes)
                .apply()
        }
    }

    fun clearDraft() {
        draftPrefs.edit().clear().apply()
    }

    // Logo search state
    var logoUrl by remember { mutableStateOf(subscription?.logoUrl) }
    // If editing and existing logo is a local file path, treat it as custom (user-uploaded)
    var customLogoPath by remember {
        mutableStateOf(
            subscription?.logoUrl?.takeIf { it.startsWith("/") }
        )
    } // local file path from user upload
    var localLogoUri by remember { mutableStateOf<Uri?>(null) }
    var isSearchingLogo by remember { mutableStateOf(false) }
    // Auto cancel URL state
    var isSearchingCancelUrl by remember { mutableStateOf(false) }

    // Image picker — copy to internal storage so it persists across app restarts
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            localLogoUri = uri
            try {
                val logosDir = java.io.File(context.filesDir, "logos")
                if (!logosDir.exists()) logosDir.mkdirs()
                val fileName = "logo_${System.currentTimeMillis()}.png"
                val destFile = java.io.File(logosDir, fileName)
                context.contentResolver.openInputStream(uri)?.use { input ->
                    destFile.outputStream().use { output -> input.copyTo(output) }
                }
                customLogoPath = destFile.absolutePath
            } catch (e: Exception) {
                // Fallback: keep localLogoUri for display at least
            }
        }
    }

    // Translate Hebrew company names to English for better lookup
    suspend fun translateToEnglish(text: String): String {
        // Check if contains Hebrew characters
        if (!text.any { it in '\u05D0'..'\u05EA' }) return text
        return try {
            val url = "https://api.mymemory.translated.net/get?q=${java.net.URLEncoder.encode(text, "UTF-8")}&langpair=he|en"
            val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            val response = connection.inputStream.bufferedReader().readText()
            // Simple JSON parsing for translatedText
            val match = Regex("\"translatedText\":\"([^\"]+)\"").find(response)
            val translated = match?.groupValues?.get(1) ?: text
            translated.replaceFirstChar { it.uppercase() }
        } catch (e: Exception) {
            text
        }
    }

    // Debounced logo + cancel URL search when company name changes
    // ONLY search if user hasn't uploaded a custom logo
    LaunchedEffect(companyName) {
        if (companyName.length >= 2) {
            cancelUrl = ""

            // Don't auto-search if user already uploaded a custom logo
            if (customLogoPath == null) {
                logoUrl = null // only reset if no custom logo

                // Logo search after 600ms debounce
                delay(600L)
                isSearchingLogo = true

                // Try original name first, then translated English name
                var result = onSearchLogo(companyName)
                if (result?.logo == null) {
                    val englishName = translateToEnglish(companyName)
                    if (englishName != companyName) {
                        result = onSearchLogo(englishName)
                    }
                }
                logoUrl = result?.logo
                // FreeTV override — always use local embedded logo regardless of server response
                val lower = companyName.lowercase().trim()
                if (lower.contains("freetv") || lower.contains("free tv") ||
                    lower.contains("פריטיוי") || lower.contains("פרי טי") || lower.contains("פרי טיוי")) {
                    logoUrl = "local://logo_freetv"
                }
                isSearchingLogo = false
            }

            // Cancel URL search after debounce
            delay(400L)
            isSearchingCancelUrl = true
            var url = onSearchCancelUrl(companyName)
            if (url == null) {
                val englishName = translateToEnglish(companyName)
                if (englishName != companyName) {
                    url = onSearchCancelUrl(englishName)
                }
            }
            cancelUrl = url ?: ""
            isSearchingCancelUrl = false
        } else if (customLogoPath == null) {
            logoUrl = null
            cancelUrl = ""
        }
    }

    // Calculate monthly cost
    val monthlyCost = remember(costStr, billingCycle, customMonthsStr) {
        val cost = costStr.toDoubleOrNull() ?: 0.0
        when (billingCycle) {
            "yearly" -> cost / 12.0
            "custom" -> {
                val months = customMonthsStr.toIntOrNull() ?: 1
                cost / months
            }
            else -> cost
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.ui.platform.LocalLayoutDirection provides LayoutDirection.Rtl
        ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            Text(
                text = if (isEditing) "עריכת מנוי" else "מנוי חדש",
                style = MaterialTheme.typography.headlineSmall,
                color = colors.textPrimary
            )

            if (!isEditing && prefill != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Primary.copy(alpha = 0.12f)
                ) {
                    Text(
                        text = "✓ פרטים זוהו מהקבלה — בדוק ואשר",
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = Primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // === Logo area ===
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Logo preview (large, centered, tappable to pick image)
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (logoUrl != null) androidx.compose.ui.graphics.Color.White else colors.borderFaint)
                        .clickable { imagePickerLauncher.launch("image/*") },
                    contentAlignment = Alignment.Center
                ) {
                    val hasLogo = localLogoUri != null || customLogoPath != null || logoUrl != null
                    if (hasLogo) {
                        // Prefer local image from gallery, then remote URL (convert dead Clearbit→Google favicons)
                        // Priority: user-uploaded local image > custom file > remote URL
                        val displayData: Any? = localLogoUri
                            ?: customLogoPath?.let { java.io.File(it) }
                            ?: logoUrl?.let { url ->
                            when {
                                url.startsWith("local://logo_freetv") -> R.drawable.logo_freetv
                                url.startsWith("/") -> java.io.File(url)
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
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(displayData)
                                .crossfade(true)
                                .build(),
                            contentDescription = "לוגו",
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(12.dp)),
                            contentScale = ContentScale.Fit
                        )
                    } else if (isSearchingLogo) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            Icons.Default.CameraAlt,
                            contentDescription = "הוסף לוגו",
                            tint = colors.textMuted,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            if (localLogoUri != null || customLogoPath != null || logoUrl != null) {
                TextButton(
                    onClick = { imagePickerLauncher.launch("image/*") },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "שנה לוגו",
                        style = MaterialTheme.typography.labelLarge,
                        color = colors.error
                    )
                }
            } else {
                // Tap logo area to pick from gallery
                Text(
                    text = if (isSearchingLogo) "מחפש לוגו..." else "הלוגו יזוהה אוטומטית",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // === Company name ===
            FormField(label = "חברה") {
                OutlinedTextField(
                    value = companyName,
                    onValueChange = { companyName = it },
                    placeholder = { Text("Netflix, Spotify...", color = colors.textMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
            }

            // === Service name ===
            FormField(label = "שם השירות") {
                OutlinedTextField(
                    value = serviceName,
                    onValueChange = { serviceName = it },
                    placeholder = { Text("Premium, Basic...", color = colors.textMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
            }

            // === Cost + Currency ===
            FormField(label = "מחיר") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = costStr,
                        onValueChange = { costStr = it },
                        placeholder = { Text("49.90", color = colors.textMuted) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                    )
                    SegmentedButton(
                        options = listOf("$", "₪"),
                        selected = if (currency == "USD") "$" else "₪",
                        onSelect = { currency = if (it == "$") "USD" else "ILS" }
                    )
                }
            }

            // === Billing cycle ===
            FormField(label = "מחזור חיוב") {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("monthly" to "חודשי", "yearly" to "שנתי", "custom" to "מותאם").forEach { (key, label) ->
                        FilterChip(
                            selected = billingCycle == key,
                            onClick = { billingCycle = key },
                            label = { Text(label) }
                        )
                    }
                }
            }

            if (billingCycle == "custom") {
                FormField(label = "כל כמה חודשים") {
                    OutlinedTextField(
                        value = customMonthsStr,
                        onValueChange = { customMonthsStr = it },
                        placeholder = { Text("3", color = colors.textMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
            }

            // Monthly equivalent
            if (billingCycle != "monthly" && monthlyCost > 0) {
                Text(
                    text = "שווה ערך חודשי: ${if (currency == "ILS") "₪" else "$"}${"%.2f".format(monthlyCost)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Primary
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            // === Renewal date (date picker) ===
            var showRenewalPicker by remember { mutableStateOf(false) }
            FormField(label = "תאריך חידוש") {
                OutlinedTextField(
                    value = renewalDate,
                    onValueChange = {},
                    placeholder = { Text("לחץ לבחירת תאריך", color = colors.textMuted) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showRenewalPicker = true },
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    readOnly = true,
                    enabled = false,
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledTextColor = colors.textPrimary,
                        disabledBorderColor = colors.border,
                        disabledPlaceholderColor = colors.textMuted,
                        disabledContainerColor = colors.surface
                    )
                )
            }
            if (showRenewalPicker) {
                val pickerState = rememberDatePickerState(
                    initialSelectedDateMillis = try {
                        LocalDate.parse(renewalDate).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
                    } catch (e: Exception) { System.currentTimeMillis() }
                )
                DatePickerDialog(
                    onDismissRequest = { showRenewalPicker = false },
                    confirmButton = {
                        TextButton(onClick = {
                            pickerState.selectedDateMillis?.let { millis ->
                                renewalDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()
                            }
                            showRenewalPicker = false
                        }) { Text("אישור") }
                    },
                    dismissButton = {
                        TextButton(onClick = { showRenewalPicker = false }) { Text("ביטול") }
                    }
                ) { DatePicker(state = pickerState) }
            }

            // === Start date (date picker) ===
            var showStartPicker by remember { mutableStateOf(false) }
            FormField(label = "תאריך התחלה (אופציונלי)") {
                OutlinedTextField(
                    value = startDate,
                    onValueChange = {},
                    placeholder = { Text("לחץ לבחירת תאריך", color = colors.textMuted) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showStartPicker = true },
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    readOnly = true,
                    enabled = false,
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledTextColor = colors.textPrimary,
                        disabledBorderColor = colors.border,
                        disabledPlaceholderColor = colors.textMuted,
                        disabledContainerColor = colors.surface
                    )
                )
            }
            if (showStartPicker) {
                val pickerState = rememberDatePickerState(
                    initialSelectedDateMillis = try {
                        LocalDate.parse(startDate).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
                    } catch (e: Exception) { System.currentTimeMillis() }
                )
                DatePickerDialog(
                    onDismissRequest = { showStartPicker = false },
                    confirmButton = {
                        TextButton(onClick = {
                            pickerState.selectedDateMillis?.let { millis ->
                                startDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()
                            }
                            showStartPicker = false
                        }) { Text("אישור") }
                    },
                    dismissButton = {
                        TextButton(onClick = { showStartPicker = false }) { Text("ביטול") }
                    }
                ) { DatePicker(state = pickerState) }
            }

            // === Plan type ===
            FormField(label = "סוג מנוי") {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("personal" to "פרטי", "family" to "משפחתי", "other" to "אחר").forEach { (key, label) ->
                        FilterChip(
                            selected = planType == key,
                            onClick = { planType = key },
                            label = { Text(label) }
                        )
                    }
                }
            }

            if (planType == "other") {
                FormField(label = "שם המסלול") {
                    OutlinedTextField(
                        value = planCustom,
                        onValueChange = { planCustom = it },
                        placeholder = { Text("עסקי, סטודנט...", color = colors.textMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                }
            }

            // === Trial ===
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = isTrial, onCheckedChange = { isTrial = it })
                Text("תקופת ניסיון", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
            }

            if (isTrial) {
                var showTrialPicker by remember { mutableStateOf(false) }
                FormField(label = "תאריך סיום ניסיון") {
                    OutlinedTextField(
                        value = trialEndDate,
                        onValueChange = {},
                        placeholder = { Text("לחץ לבחירת תאריך", color = colors.textMuted) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showTrialPicker = true },
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        readOnly = true,
                        enabled = false,
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = colors.textPrimary,
                            disabledBorderColor = colors.border,
                            disabledPlaceholderColor = colors.textMuted,
                            disabledContainerColor = colors.surface
                        )
                    )
                }
                if (showTrialPicker) {
                    val pickerState = rememberDatePickerState(
                        initialSelectedDateMillis = try {
                            LocalDate.parse(trialEndDate).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
                        } catch (e: Exception) { System.currentTimeMillis() }
                    )
                    DatePickerDialog(
                        onDismissRequest = { showTrialPicker = false },
                        confirmButton = {
                            TextButton(onClick = {
                                pickerState.selectedDateMillis?.let { millis ->
                                    trialEndDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()
                                }
                                showTrialPicker = false
                            }) { Text("אישור") }
                        },
                        dismissButton = {
                            TextButton(onClick = { showTrialPicker = false }) { Text("ביטול") }
                        }
                    ) { DatePicker(state = pickerState) }
                }
            }

            // === Cancel URL ===
            FormField(label = if (isSearchingCancelUrl) "מחפש קישור ביטול..." else "קישור לביטול") {
                OutlinedTextField(
                    value = cancelUrl,
                    onValueChange = { cancelUrl = it },
                    placeholder = { Text("https://www.netflix.com/cancelplan", color = colors.textMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    trailingIcon = {
                        if (isSearchingCancelUrl) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        }
                    }
                )
                // Manual search button when cancel URL not found
                if (cancelUrl.isBlank() && !isSearchingCancelUrl && companyName.isNotBlank()) {
                    TextButton(
                        onClick = {
                            scope.launch {
                                isSearchingCancelUrl = true
                                val url = onSearchCancelUrl(companyName)
                                cancelUrl = url ?: ""
                                isSearchingCancelUrl = false
                            }
                        }
                    ) {
                        Text(
                            "🔍 חפש קישור ביטול ל-$companyName",
                            style = MaterialTheme.typography.labelSmall,
                            color = Primary
                        )
                    }
                }
            }

            // === Notes ===
            FormField(label = "הערות (אופציונלי)") {
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    placeholder = { Text("הערות נוספות...", color = colors.textMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    minLines = 2,
                    maxLines = 4
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // === Buttons ===
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        clearDraft()
                        onDismiss()
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("ביטול")
                }

                Button(
                    onClick = {
                        clearDraft()
                        val cost = costStr.toDoubleOrNull() ?: 0.0
                        if (isEditing) {
                            onUpdate(subscription!!.id, buildMap {
                                put("company_name", companyName)
                                put("service_name", serviceName)
                                put("cost", monthlyCost)
                                put("cost_per_cycle", cost)
                                put("billing_cycle", billingCycle)
                                if (billingCycle == "custom") put("custom_cycle_months", customMonthsStr.toIntOrNull())
                                put("renewal_date", renewalDate)
                                put("start_date", startDate.ifBlank { null })
                                put("plan_type", planType)
                                if (planType == "other") put("plan_type_custom", planCustom)
                                put("currency", currency)
                                put("is_trial", if (isTrial) 1 else 0)
                                put("trial_end_date", if (isTrial) trialEndDate else null)
                                put("cancel_url", cancelUrl.ifBlank { null })
                                put("notes", notes.ifBlank { null })
                                // Custom logo (local file) takes priority over API logo
                                put("logo_url", customLogoPath ?: logoUrl)
                            })
                        } else {
                            onCreate(CreateSubscriptionRequest(
                                companyName = companyName,
                                serviceName = serviceName,
                                cost = monthlyCost,
                                costPerCycle = cost,
                                billingCycle = billingCycle,
                                customCycleMonths = if (billingCycle == "custom") customMonthsStr.toIntOrNull() else null,
                                renewalDate = renewalDate,
                                startDate = startDate.ifBlank { null },
                                planType = planType,
                                planTypeCustom = if (planType == "other") planCustom else null,
                                currency = currency,
                                isTrial = isTrial,
                                trialEndDate = if (isTrial) trialEndDate else null,
                                cancelUrl = cancelUrl.ifBlank { null },
                                notes = notes.ifBlank { null },
                                logoUrl = customLogoPath ?: logoUrl
                            ))
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    enabled = companyName.isNotBlank() && serviceName.isNotBlank() && costStr.isNotBlank()
                ) {
                    Text(if (isEditing) "עדכן" else "הוסף מנוי")
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
        } // CompositionLocalProvider
    }
}

/** Form field with label above and content below */
@Composable
private fun FormField(label: String, content: @Composable () -> Unit) {
    val colors = SubTrackerThemeColors.colors
    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = colors.textTertiary
    )
    Spacer(modifier = Modifier.height(4.dp))
    content()
    Spacer(modifier = Modifier.height(12.dp))
}

@Composable
fun SegmentedButton(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { option ->
            FilterChip(
                selected = selected == option,
                onClick = { onSelect(option) },
                label = { Text(option, style = MaterialTheme.typography.labelSmall) }
            )
        }
    }
}
