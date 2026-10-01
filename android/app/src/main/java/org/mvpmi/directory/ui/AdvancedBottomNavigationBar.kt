package org.mvpmi.directory.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

/** One tab of the bar. [toggle] tabs (theme, language) act instead of navigating. */
@Immutable
data class BarDestination(
    val key: String,
    val label: String,
    val description: String,
    val outlined: ImageVector,
    val filled: ImageVector,
    val center: Boolean = false,
    val toggle: Boolean = false,
    val badge: Int = 0,
)

/**
 * The app's five tabs, Search in the middle (owner, 2 Oct 2026):
 * Profile · Admin tools (Settings for members) · Search · Theme · Language.
 * Titles, icons and destinations come from the former top icon row of the
 * directory (the Filter icon was removed: the village chips do that job).
 */
fun barDestinations(gujarati: Boolean, isAdmin: Boolean, adminBadge: Int, dark: Boolean): List<BarDestination> {
    fun l(gu: String, en: String) = if (gujarati) gu else en
    val second = if (isAdmin)
        BarDestination("admin", l("એડમિન", "Admin"), l("એડમિન સાધનો", "Admin tools"), Icons.Outlined.AdminPanelSettings, Icons.Filled.AdminPanelSettings, badge = adminBadge)
    else
        BarDestination("settings", l("સેટિંગ્સ", "Settings"), l("સેટિંગ્સ", "Settings"), Icons.Outlined.Settings, Icons.Filled.Settings)
    return listOf(
        BarDestination("profile", l("પ્રોફાઇલ", "Profile"), l("મારી પ્રોફાઇલ", "My Profile"), Icons.Outlined.AccountCircle, Icons.Filled.AccountCircle),
        second,
        BarDestination("search", l("શોધો", "Search"), l("નામ, નંબર કે ગામ શોધો", "Search the directory"), Icons.Rounded.Search, Icons.Rounded.Search, center = true),
        if (dark)
            BarDestination("theme", l("આછો", "Light"), l("આછો દેખાવ", "Light theme"), Icons.Outlined.LightMode, Icons.Filled.LightMode, toggle = true)
        else
            BarDestination("theme", l("ઘેરો", "Dark"), l("ઘેરો દેખાવ", "Dark theme"), Icons.Outlined.DarkMode, Icons.Filled.DarkMode, toggle = true),
        BarDestination("lang", if (gujarati) "English" else "ગુજરાતી", l("ભાષા: English કરો", "Language: switch to ગુજરાતી"), Icons.Outlined.Translate, Icons.Filled.Translate, toggle = true),
    )
}

/**
 * Floating capsule NavigationBar with "liquid crystal" glass: the content
 * behind (registered with [hazeState]) is blurred live, then a highly
 * translucent white overlay, a glossy top highlight and a thin glowing rim
 * keep every label readable. Android 11 and older get a tinted glass instead
 * of the live blur.
 */
@Composable
fun AdvancedBottomNavigationBar(
    destinations: List<BarDestination>,
    selectedKey: String?,
    onSelect: (BarDestination) -> Unit,
    hazeState: HazeState,
    colors: ShellColors,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(36.dp)
    val haptics = LocalHapticFeedback.current
    Box(
        modifier
            .widthIn(max = 460.dp)
            .fillMaxWidth()
            .shadow(elevation = 22.dp, shape = shape, ambientColor = colors.shadow, spotColor = colors.shadow)
            .clip(shape)
            .hazeEffect(state = hazeState) {
                blurRadius = 34.dp
                backgroundColor = colors.page
                // A frosted base keeps labels readable over any row (the
                // page behind is a WebView), then the 15 % white crystal layer.
                tints = listOf(HazeTint(colors.page.copy(alpha = if (colors.dark) 0.62f else 0.55f)), HazeTint(colors.glassOverlay))
                noiseFactor = 0.06f
                fallbackTint = HazeTint(colors.glassFallback)
            }
            // Glossy highlight on the upper half, like light on curved glass.
            .background(Brush.verticalGradient(listOf(colors.glassRimTop.copy(alpha = if (colors.dark) 0.10f else 0.32f), Color.Transparent)))
            .border(1.dp, Brush.verticalGradient(listOf(colors.glassRimTop, colors.glassRimBottom)), shape),
    ) {
        NavigationBar(
            containerColor = Color.Transparent,
            contentColor = colors.ink,
            tonalElevation = 0.dp,
            windowInsets = WindowInsets(0, 0, 0, 0),
        ) {
            destinations.forEach { d ->
                val selected = !d.toggle && d.key == selectedKey
                val iconScale by animateFloatAsState(if (selected) 1.12f else 1f, ShellMotion.spatial(), label = "iconScale")
                NavigationBarItem(
                    selected = selected,
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(d)
                    },
                    modifier = Modifier
                        .testTag("nav_" + d.key)
                        .semantics { contentDescription = d.description },
                    alwaysShowLabel = true,
                    icon = {
                        if (d.center) CenterSearchIcon(selected, colors)
                        else BadgedBox(badge = { if (d.badge > 0) Badge { Text(if (d.badge > 99) "99+" else d.badge.toString()) } }) {
                            // Outlined when inactive, Filled when active, with a springy swap.
                            AnimatedContent(
                                targetState = selected,
                                transitionSpec = {
                                    (scaleIn(ShellMotion.spatialFast(), initialScale = 0.6f) + fadeIn(ShellMotion.effects())) togetherWith
                                        (scaleOut(ShellMotion.effects(), targetScale = 0.6f) + fadeOut(ShellMotion.effects()))
                                },
                                label = "iconSwap",
                            ) { on ->
                                Icon(
                                    imageVector = if (on) d.filled else d.outlined,
                                    contentDescription = null,
                                    modifier = Modifier.size(24.dp).graphicsLayer { scaleX = iconScale; scaleY = iconScale },
                                )
                            }
                        }
                    },
                    label = {
                        Text(
                            d.label,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontSize = 11.5.sp,
                            fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.SemiBold,
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = if (d.center) Color.White else colors.brand,
                        selectedTextColor = colors.brand,
                        indicatorColor = if (d.center) Color.Transparent else colors.pillActive,
                        unselectedIconColor = if (d.center) Color.White else colors.ink2,
                        unselectedTextColor = colors.ink2,
                    ),
                )
            }
        }
    }
}

/** Raised round Search button; its corners morph from circle to squircle when active. */
@Composable
private fun CenterSearchIcon(selected: Boolean, colors: ShellColors) {
    val corner by animateDpAsState(if (selected) 17.dp else 26.dp, ShellMotion.spatial(), label = "searchCorner")
    val lift by animateDpAsState(if (selected) (-6).dp else (-2).dp, ShellMotion.spatial(), label = "searchLift")
    Box(
        Modifier
            .graphicsLayer { translationY = lift.toPx() }
            .size(52.dp)
            .shadow(10.dp, RoundedCornerShape(corner), ambientColor = colors.brand, spotColor = colors.brand)
            .clip(RoundedCornerShape(corner))
            .background(colors.brandGradient)
            .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.55f), Color.Transparent)), RoundedCornerShape(corner)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Rounded.Search, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
    }
}
