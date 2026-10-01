package org.mvpmi.directory.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Colours of the native shell (splash screen + bottom bar), taken from
 * docs/design.md so the native parts match the web screens exactly.
 * Saffron/brick identity; every colour has a light and a dark value.
 */
data class ShellColors(
    val page: Color,
    val pageGlow: Color,
    val card: Color,
    val ink: Color,
    val ink2: Color,
    val brand: Color,
    val saffron: Color,
    val pillActive: Color,
    val glassOverlay: Color,
    val glassRimTop: Color,
    val glassRimBottom: Color,
    val glassFallback: Color,
    val shadow: Color,
    val chip: Color,
    val dark: Boolean,
) {
    val brandGradient: Brush get() = Brush.linearGradient(listOf(Color(0xFFB2402C), Color(0xFFE9A13B)))
    val goldRing: Brush get() = Brush.sweepGradient(listOf(Color(0xFFF3BC6A), Color(0xFFB2402C), Color(0xFFE9A13B), Color(0xFFF7D58A), Color(0xFFF3BC6A)))
}

val LightShell = ShellColors(
    page = Color(0xFFF7EEE5),
    pageGlow = Color(0xFFFBEADB),
    card = Color(0xFFFFFAF4),
    ink = Color(0xFF241413),
    ink2 = Color(0xFF6B4F48),
    brand = Color(0xFFB2402C),
    saffron = Color(0xFFE9A13B),
    pillActive = Color(0x24B2402C),
    // Liquid crystal: high translucency over a deep blur.
    glassOverlay = Color.White.copy(alpha = 0.15f),
    glassRimTop = Color.White.copy(alpha = 0.85f),
    glassRimBottom = Color.White.copy(alpha = 0.25f),
    glassFallback = Color(0xF0FFFAF4),
    shadow = Color(0x66783A1C),
    chip = Color(0xFFF1E6DC),
    dark = false,
)

val DarkShell = ShellColors(
    page = Color(0xFF120B0A),
    pageGlow = Color(0xFF4A1E14),
    card = Color(0xFF1E1412),
    ink = Color(0xFFF7EDE4),
    ink2 = Color(0xFFC3A79C),
    brand = Color(0xFFFF9D74),
    saffron = Color(0xFFF3BC6A),
    pillActive = Color(0x2EFF9D74),
    glassOverlay = Color.White.copy(alpha = 0.08f),
    glassRimTop = Color(0xFFFFE6D2).copy(alpha = 0.32f),
    glassRimBottom = Color(0xFFFFE6D2).copy(alpha = 0.06f),
    glassFallback = Color(0xF01C1210),
    shadow = Color(0xCC000000),
    chip = Color(0xFF2A1D1A),
    dark = true,
)

/** Material 3 Expressive-style motion: bouncy spatial springs, calm effects. */
object ShellMotion {
    fun <T> spatial() = spring<T>(dampingRatio = 0.62f, stiffness = Spring.StiffnessMediumLow)
    fun <T> spatialFast() = spring<T>(dampingRatio = 0.55f, stiffness = Spring.StiffnessMedium)
    fun <T> effects() = spring<T>(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMedium)
}
