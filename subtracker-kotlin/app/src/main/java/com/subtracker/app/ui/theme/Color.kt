package com.baritzy.subtracker.ui.theme

import androidx.compose.ui.graphics.Color

// Primary palette
val Primary = Color(0xFF6366F1)
val PrimaryDark = Color(0xFF4F46E5)
val Secondary = Color(0xFF8B5CF6)
val Success = Color(0xFF22C55E)
val Warning = Color(0xFFEAB308)
val Error = Color(0xFFEF4444)
val Orange = Color(0xFFF97316)

// Light theme
val LightBackground = Color(0xFFEEF2FF)
val LightSurface = Color(0xFFFFFFFF)
val LightCardBackground = Color(0xFFFFFFFF) // fully opaque white
val LightCardHover = Color(0xE6FFFFFF)      // 90% opacity
val LightHeaderBackground = Color(0xEBEEF2FF) // 92% opacity
val LightTextPrimary = Color(0xFF0F172A)
val LightTextSecondary = Color(0xFF1E293B)
val LightTextTertiary = Color(0xFF475569)
val LightTextMuted = Color(0xFF64748B)
val LightBorder = Color(0x1F6366F1)         // 12% opacity
val LightBorderFaint = Color(0x126366F1)    // 7% opacity

// Dark theme
val DarkBackground = Color(0xFF0F1729)
val DarkSurface = Color(0xFF1E293B)
val DarkCardBackground = Color(0xFF1E293B)
val DarkCardHover = Color(0xFF334155)
val DarkHeaderBackground = Color(0xEB0F1729)
val DarkTextPrimary = Color(0xFFF1F5F9)
val DarkTextSecondary = Color(0xFFE2E8F0)
val DarkTextTertiary = Color(0xFF94A3B8)
val DarkTextMuted = Color(0xFF64748B)
val DarkBorder = Color(0x336366F1)
val DarkBorderFaint = Color(0x1A6366F1)

// Company colors
object CompanyColors {
    val map = mapOf(
        "netflix" to Color(0xFFE50914),
        "spotify" to Color(0xFF1DB954),
        "adobe" to Color(0xFFFF0000),
        "github" to Color(0xFF333333),
        "openai" to Color(0xFF10A37F),
        "canva" to Color(0xFF00C4CC),
        "apple" to Color(0xFF555555),
        "google" to Color(0xFF4285F4),
        "microsoft" to Color(0xFF00A4EF),
        "amazon" to Color(0xFFFF9900),
        "disney" to Color(0xFF113CCF),
        "youtube" to Color(0xFFFF0000),
        "slack" to Color(0xFF4A154B),
        "notion" to Color(0xFF000000),
        "figma" to Color(0xFFF24E1E),
        "dropbox" to Color(0xFF0061FF),
        "zoom" to Color(0xFF2D8CFF),
    )

    fun getColor(companyName: String): Color {
        val lower = companyName.lowercase()
        return map.entries.firstOrNull { lower.contains(it.key) }?.value ?: Primary
    }
}

// Donut chart palette
val ChartColors = listOf(
    Color(0xFF6366F1),
    Color(0xFF8B5CF6),
    Color(0xFFEC4899),
    Color(0xFFEF4444),
    Color(0xFFF97316),
    Color(0xFFEAB308),
    Color(0xFF22C55E),
    Color(0xFF14B8A6),
    Color(0xFF06B6D4),
    Color(0xFF3B82F6),
)

// Urgency colors
fun urgencyColor(daysRemaining: Int): Color = when {
    daysRemaining < 0 -> Error
    daysRemaining <= 1 -> Error
    daysRemaining <= 3 -> Orange
    daysRemaining <= 7 -> Warning
    else -> Success
}
