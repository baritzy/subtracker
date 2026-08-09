package com.baritzy.subtracker.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Extended colors for SubTracker
data class SubTrackerColors(
    val background: Color,
    val surface: Color,
    val cardBackground: Color,
    val cardHover: Color,
    val headerBackground: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val textMuted: Color,
    val border: Color,
    val borderFaint: Color,
    val primary: Color,
    val primaryDark: Color,
    val secondary: Color,
    val success: Color,
    val warning: Color,
    val error: Color,
    val isDark: Boolean
)

val LightSubTrackerColors = SubTrackerColors(
    background = LightBackground,
    surface = LightSurface,
    cardBackground = LightCardBackground,
    cardHover = LightCardHover,
    headerBackground = LightHeaderBackground,
    textPrimary = LightTextPrimary,
    textSecondary = LightTextSecondary,
    textTertiary = LightTextTertiary,
    textMuted = LightTextMuted,
    border = LightBorder,
    borderFaint = LightBorderFaint,
    primary = Primary,
    primaryDark = PrimaryDark,
    secondary = Secondary,
    success = Success,
    warning = Warning,
    error = Error,
    isDark = false
)

val DarkSubTrackerColors = SubTrackerColors(
    background = DarkBackground,
    surface = DarkSurface,
    cardBackground = DarkCardBackground,
    cardHover = DarkCardHover,
    headerBackground = DarkHeaderBackground,
    textPrimary = DarkTextPrimary,
    textSecondary = DarkTextSecondary,
    textTertiary = DarkTextTertiary,
    textMuted = DarkTextMuted,
    border = DarkBorder,
    borderFaint = DarkBorderFaint,
    primary = Primary,
    primaryDark = PrimaryDark,
    secondary = Secondary,
    success = Success,
    warning = Warning,
    error = Error,
    isDark = true
)

val LocalSubTrackerColors = staticCompositionLocalOf { LightSubTrackerColors }

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    secondary = Secondary,
    onSecondary = Color.White,
    background = LightBackground,
    onBackground = LightTextPrimary,
    surface = LightSurface,
    onSurface = LightTextPrimary,
    error = Error,
    onError = Color.White,
)

private val DarkColorScheme = darkColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    secondary = Secondary,
    onSecondary = Color.White,
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    error = Error,
    onError = Color.White,
)

enum class ThemeMode {
    LIGHT, DARK, SYSTEM
}

@Composable
fun SubTrackerTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit
) {
    val systemIsDark = isSystemInDarkTheme()
    val isDark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> systemIsDark
    }

    val colorScheme = if (isDark) DarkColorScheme else LightColorScheme
    val subTrackerColors = if (isDark) DarkSubTrackerColors else LightSubTrackerColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        val activity = view.context as? Activity
        SideEffect {
            activity?.let {
                it.window.statusBarColor = subTrackerColors.background.toArgb()
                it.window.navigationBarColor = subTrackerColors.background.toArgb()
                WindowCompat.getInsetsController(it.window, view).apply {
                    isAppearanceLightStatusBars = !isDark
                    isAppearanceLightNavigationBars = !isDark
                }
            }
        }
    }

    CompositionLocalProvider(LocalSubTrackerColors provides subTrackerColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = SubTrackerTypography,
            content = content
        )
    }
}

// Helper to access SubTracker colors
object SubTrackerThemeColors {
    val colors: SubTrackerColors
        @Composable
        get() = LocalSubTrackerColors.current
}
