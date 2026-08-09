package com.baritzy.subtracker.ui.dashboard

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.baritzy.subtracker.billing.BillingManager
import com.baritzy.subtracker.data.model.CreateSubscriptionRequest
import com.baritzy.subtracker.data.model.ReceiptScanResponse
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.data.repository.PremiumRepository
import com.baritzy.subtracker.data.repository.PremiumState
import com.baritzy.subtracker.data.repository.SubscriptionRepository
import com.baritzy.subtracker.notifications.FcmTokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import javax.inject.Inject

enum class SortMode(val label: String) {
    RENEWAL_DATE("\u05EA\u05D0\u05E8\u05D9\u05DA \u05D7\u05D9\u05D3\u05D5\u05E9"),
    PRICE("\u05DE\u05D7\u05D9\u05E8"),
    DATE_ADDED("\u05EA\u05D0\u05E8\u05D9\u05DA \u05D4\u05D5\u05E1\u05E4\u05D4")
}

data class DashboardUiState(
    val subscriptions: List<Subscription> = emptyList(),
    val pendingSubscriptions: List<Subscription> = emptyList(),
    val searchQuery: String = "",
    val isLoading: Boolean = true,
    val error: String? = null,
    val currency: String = "USD",
    val ilsRate: Double = 3.7,
    val planFilter: String = "all",
    val showMonthly: Boolean = true,
    val sortMode: SortMode = SortMode.RENEWAL_DATE,
    val showAddForm: Boolean = false,
    val showPaywall: Boolean = false,
    val isSyncingPremium: Boolean = false,
    val paywallError: String? = null,
    val editingSubscription: Subscription? = null,
    val scanPrefill: ReceiptScanResponse? = null,
    val isScanning: Boolean = false,
    val scanError: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repository: SubscriptionRepository,
    private val fcmTokenManager: FcmTokenManager,
    private val premiumRepository: PremiumRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val prefs = context.getSharedPreferences("user_prefs", Context.MODE_PRIVATE)
    private val _uiState = MutableStateFlow(DashboardUiState(
        currency = prefs.getString("currency", "USD") ?: "USD",
        showMonthly = prefs.getBoolean("show_monthly", true),
        sortMode = try { SortMode.valueOf(prefs.getString("sort_mode", null) ?: "RENEWAL_DATE") } catch (_: Exception) { SortMode.RENEWAL_DATE }
    ))
    val uiState = _uiState.asStateFlow()
    private var _logosUpdated = false

    init {
        loadSubscriptions()
        // Ensure FCM token is up-to-date on every app launch
        viewModelScope.launch { try { fcmTokenManager.ensureTokenRegistered() } catch (_: Exception) {} }
    }

    private fun loadSubscriptions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                repository.refreshSubscriptions()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }

        viewModelScope.launch {
            repository.getActiveSubscriptions().collect { subs ->
                _uiState.update { it.copy(subscriptions = subs, isLoading = false) }
                // Auto-update missing logos (only once per session)
                if (!_logosUpdated) {
                    _logosUpdated = true
                    subs.filter { it.logoUrl.isNullOrBlank() || it.logoUrl?.contains("subtracker-api.fly.dev") == true }.forEach { sub ->
                        launch {
                            val result = repository.searchLogo(sub.companyName)
                            val subName = sub.companyName.lowercase().trim()
                            val logo = when {
                                subName.contains("freetv") || subName.contains("free tv") ||
                                subName.contains("פריטיוי") || subName.contains("פרי טי") || subName.contains("פרי טיוי") ->
                                    "local://logo_freetv"
                                result?.logo != null -> result.logo
                                else -> null
                            }

                            if (logo != null) {
                                repository.updateSubscription(sub.id, mapOf("logo_url" to logo))
                            }
                        }
                    }
                }
            }
        }

        viewModelScope.launch {
            repository.getPendingSubscriptions().collect { pending ->
                _uiState.update { it.copy(pendingSubscriptions = pending) }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                repository.refreshSubscriptions()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun setCurrency(currency: String) {
        _uiState.update { it.copy(currency = currency) }
        prefs.edit().putString("currency", currency).apply()
    }

    fun setPlanFilter(filter: String) {
        _uiState.update { it.copy(planFilter = filter) }
    }

    fun setSortMode(mode: SortMode) {
        _uiState.update { it.copy(sortMode = mode) }
        prefs.edit().putString("sort_mode", mode.name).apply()
    }

    fun toggleMonthlyYearly() {
        val newValue = !_uiState.value.showMonthly
        _uiState.update { it.copy(showMonthly = newValue) }
        prefs.edit().putBoolean("show_monthly", newValue).apply()
    }

    fun showAddForm() {
        _uiState.update { it.copy(showAddForm = true, editingSubscription = null) }
    }

    fun showEditForm(subscription: Subscription) {
        _uiState.update { it.copy(showAddForm = true, editingSubscription = subscription) }
    }

    fun dismissForm() {
        _uiState.update { it.copy(showAddForm = false, editingSubscription = null, scanPrefill = null) }
    }

    fun scanReceipt(uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isScanning = true, scanError = null) }
            val result = repository.scanReceipt(context, uri)
            if (result != null && result.success) {
                _uiState.update { it.copy(isScanning = false, scanPrefill = result, showAddForm = true) }
            } else {
                _uiState.update { it.copy(isScanning = false, scanError = "לא נמצאו פרטים בקבלה, נסה שנית") }
            }
        }
    }

    fun clearScanError() {
        _uiState.update { it.copy(scanError = null) }
    }

    fun createSubscription(request: CreateSubscriptionRequest) {
        viewModelScope.launch {
            val result = repository.createSubscription(request)
            if (result.isSuccess) {
                _uiState.update { it.copy(showAddForm = false) }
                return@launch
            }
            if (result.exceptionOrNull()?.message != "free_limit_reached") {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
                return@launch
            }
            handleFreeLimitReached(request)
        }
    }

    // The server answered 403 free_limit_reached. Showing the real paywall
    // unconditionally here is the exact bug documented 2026-08-09: a user
    // who already paid (client believes PREMIUM, or hasn't finished
    // reconciling yet -- UNKNOWN) would see "pay again" for something they
    // already own. Only a client that has positively resolved to FREE gets
    // the real paywall; PREMIUM and UNKNOWN both get one restore-and-retry
    // attempt first, with a syncing indicator instead of the paywall
    // flashing on screen. If that retry still 403s, show an actionable
    // error and stop -- never an infinite spinner.
    private suspend fun handleFreeLimitReached(request: CreateSubscriptionRequest) {
        if (premiumRepository.state.value == PremiumState.FREE) {
            _uiState.update { it.copy(showPaywall = true) }
            return
        }

        _uiState.update { it.copy(isSyncingPremium = true) }
        BillingManager.forceRefresh()
        delay(1500) // bounded wait for the async local-purchase -> /verify chain; see PremiumRepository docs
        val serverOk = premiumRepository.refreshFromServer()

        val retry = repository.createSubscription(request)
        _uiState.update { it.copy(isSyncingPremium = false) }

        when {
            retry.isSuccess -> _uiState.update { it.copy(showAddForm = false) }
            retry.exceptionOrNull()?.message == "free_limit_reached" -> {
                if (premiumRepository.state.value == PremiumState.FREE) {
                    // The restore genuinely resolved this account to FREE --
                    // now it's a real paywall, not a desync.
                    _uiState.update { it.copy(showPaywall = true) }
                } else {
                    Log.e(
                        "DashboardViewModel",
                        "free_limit_reached persisted after restore-and-retry " +
                            "(premiumState=${premiumRepository.state.value}, serverReachable=$serverOk)"
                    )
                    _uiState.update {
                        it.copy(
                            paywallError = "הפרימיום שלך לא מסתנכרן עם השרת. נסה \"שחזר רכישות\" בהגדרות, " +
                                "ואם זה לא עוזר פנה לתמיכה."
                        )
                    }
                }
            }
            else -> _uiState.update { it.copy(error = retry.exceptionOrNull()?.message) }
        }
    }

    fun dismissPaywall() { _uiState.update { it.copy(showPaywall = false) } }

    fun dismissPaywallError() { _uiState.update { it.copy(paywallError = null) } }

    fun updateSubscription(id: Int, updates: Map<String, Any?>) {
        viewModelScope.launch {
            repository.updateSubscription(id, updates)
            _uiState.update { it.copy(showAddForm = false, editingSubscription = null) }
        }
    }

    fun cancelSubscription(id: Int) {
        viewModelScope.launch {
            repository.cancelSubscription(id)
        }
    }

    fun confirmSubscription(id: Int) {
        viewModelScope.launch {
            repository.confirmSubscription(id)
        }
    }

    fun deleteSubscription(id: Int) {
        viewModelScope.launch {
            repository.deleteSubscription(id)
        }
    }

    val filteredSubscriptions: Flow<List<Subscription>> = _uiState.map { state ->
        var subs = state.subscriptions

        // Filter by plan
        if (state.planFilter != "all") {
            subs = subs.filter { it.planType == state.planFilter }
        }

        // Filter by search
        if (state.searchQuery.isNotBlank()) {
            val q = state.searchQuery.lowercase()
            subs = subs.filter {
                it.companyName.lowercase().contains(q) ||
                        it.serviceName.lowercase().contains(q)
            }
        }

        // Sort
        subs = when (state.sortMode) {
            SortMode.RENEWAL_DATE -> subs.sortedBy { it.renewalDate }
            SortMode.PRICE -> subs.sortedByDescending { it.costPerCycle }
            SortMode.DATE_ADDED -> subs.sortedByDescending { it.createdAt }
        }

        subs
    }

    val upcomingRenewals: Flow<List<Subscription>> = _uiState.map { state ->
        val today = LocalDate.now()
        state.subscriptions.filter { sub ->
            try {
                val renewalDate = LocalDate.parse(sub.renewalDate)
                val days = ChronoUnit.DAYS.between(today, renewalDate)
                days in 0..7
            } catch (e: Exception) {
                false
            }
        }.sortedBy { it.renewalDate }
    }

    // Total monthly cost — normalized to the selected display currency
    val totalMonthlyCost: Flow<Double> = _uiState.map { state ->
        val subs = if (state.planFilter != "all") {
            state.subscriptions.filter { it.planType == state.planFilter }
        } else {
            state.subscriptions
        }
        // Normalize all costs to USD first, then convert if needed
        subs.sumOf { sub ->
            if (sub.currency == "ILS") {
                // sub.cost is already monthly in ILS — convert to USD
                sub.cost / state.ilsRate
            } else {
                sub.cost // already in USD
            }
        }
    }

    fun formatAmount(amount: Double): String {
        val state = _uiState.value
        return if (state.currency == "ILS") {
            "₪%.0f".format(amount * state.ilsRate)
        } else {
            "$%.2f".format(amount)
        }
    }

    fun daysUntilRenewal(renewalDate: String): Long {
        return try {
            val date = LocalDate.parse(renewalDate)
            ChronoUnit.DAYS.between(LocalDate.now(), date)
        } catch (e: Exception) {
            0
        }
    }

    suspend fun searchLogo(query: String): com.baritzy.subtracker.data.model.LogoSearchResponse? {
        return repository.searchLogo(query)
    }

    suspend fun searchCancelUrl(service: String): String? {
        return repository.getCancelUrl(service)
    }

    suspend fun fetchInvoices(subscriptionId: Int): List<com.baritzy.subtracker.data.model.Invoice> {
        val result = repository.getInvoices(subscriptionId)
        return result.getOrDefault(emptyList())
    }

    suspend fun validateCancelUrl(companyName: String): String? {
        return repository.getCancelUrl(companyName)
    }

}
