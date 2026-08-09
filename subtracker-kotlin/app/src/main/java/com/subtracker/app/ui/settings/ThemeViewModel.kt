package com.baritzy.subtracker.ui.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.baritzy.subtracker.ui.theme.ThemeMode
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

private val Context.themeDataStore: DataStore<Preferences> by preferencesDataStore(name = "theme_prefs")

@HiltViewModel
class ThemeViewModel @Inject constructor(
    @ApplicationContext private val context: Context
) : ViewModel() {

    companion object {
        private val THEME_KEY = stringPreferencesKey("theme_mode")
    }

    // Read initial value synchronously from SharedPreferences to avoid flicker
    private val initialTheme: ThemeMode = run {
        val sp = context.getSharedPreferences("theme_quick", Context.MODE_PRIVATE)
        when (sp.getString("theme_mode", null)) {
            "light" -> ThemeMode.LIGHT
            "dark" -> ThemeMode.DARK
            else -> ThemeMode.SYSTEM
        }
    }

    val themeMode = context.themeDataStore.data
        .map { prefs ->
            when (prefs[THEME_KEY]) {
                "light" -> ThemeMode.LIGHT
                "dark" -> ThemeMode.DARK
                else -> ThemeMode.SYSTEM
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), initialTheme)

    fun setThemeMode(mode: ThemeMode) {
        val modeStr = when (mode) {
            ThemeMode.LIGHT -> "light"
            ThemeMode.DARK -> "dark"
            ThemeMode.SYSTEM -> "system"
        }
        // Save synchronously for instant read on next launch
        context.getSharedPreferences("theme_quick", Context.MODE_PRIVATE)
            .edit().putString("theme_mode", modeStr).apply()
        // Save to DataStore for reactive flow
        viewModelScope.launch {
            context.themeDataStore.edit { prefs ->
                prefs[THEME_KEY] = modeStr
            }
        }
    }
}
