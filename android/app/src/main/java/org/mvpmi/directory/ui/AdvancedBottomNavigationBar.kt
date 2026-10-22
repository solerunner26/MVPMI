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
import org.mvpmi.directory.R
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.outlined.Celebration
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.clickable
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
 * The app's five tabs (owner, 2 Oct 2026; centre changed 21 Oct 2026):
 * Profile · Admin tools (Settings for members) · Greeting/Messages · Theme · Language.
 * Titles, icons and destinations come from the former top icon row of the
 * directory (the Filter icon was removed: the village chips do that job).
 */
fun barDestinations(gujarati: Boolean, isAdmin: Boolean, adminBadge: Int, dark: Boolean, isMain: Boolean = false, unread: Int = 0): List<BarDestination> {
    fun l(gu: String, en: String) = if (gujarati) gu else en
    // Owner, 22 Oct 2026: Home (the sun) in the centre for everyone; Dark and
    // Language moved to the top of the main screen (in the page).
    //   Member:        Profile · Messages · Home · Admins/Help · Settings
    //   Village Admin: Profile · Messages · Home · Admin · Settings
    //   Main Admin:    Profile · Admin · Home · Greeting · Settings
    val profile = BarDestination("profile", l("પ્રોફાઇલ", "Profile"), l("મારી પ્રોફાઇલ", "My Profile"), Icons.Outlined.AccountCircle, Icons.Filled.AccountCircle)
    val admin = BarDestination("admin", l("એડમિન", "Admin"), l("એડમિન સાધનો", "Admin tools"), Icons.Outlined.AdminPanelSettings, Icons.Filled.AdminPanelSettings, badge = adminBadge)
    val messages = BarDestination("messages", l("સંદેશ", "Messages"), l("સંદેશ કેન્દ્ર", "Message Centre"), Icons.Outlined.Email, Icons.Filled.Email, badge = unread)
    val home = BarDestination("home", l("હોમ", "Home"), l("હોમ: સભ્યોની યાદી", "Home: member directory"), Icons.Outlined.Home, Icons.Filled.Home, center = true)
    val settings = BarDestination("settings", l("સેટિંગ્સ", "Settings"), l("સેટિંગ્સ", "Settings"), Icons.Outlined.Settings, Icons.Filled.Settings)
    val fourth = when {
        isMain -> BarDestination("greeting", l("શુભેચ્છા", "Greeting"), l("શુભેચ્છા સંદેશ મોકલો", "Send a greeting"), Icons.Outlined.Celebration, Icons.Filled.Celebration)
        isAdmin -> admin
        else -> BarDestination("help", l("એડમિન/મદદ", "Admins"), l("એડમિન અને મદદ", "Admins and help"), Icons.Outlined.Groups, Icons.Filled.Groups)
    }
    return listOf(profile, if (isMain) admin else messages, home, fourth, settings)
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
            .fillMaxWidth(),
    ) {
        // The glass is its own clipped layer BEHIND the tabs, so the raised
        // centre Search button can rise above the capsule without being cut.
        Box(
            Modifier
                .matchParentSize()
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
        )
        NavigationBar(
            containerColor = Color.Transparent,
            contentColor = colors.ink,
            tonalElevation = 0.dp,
            windowInsets = WindowInsets(0, 0, 0, 0),
        ) {
            destinations.forEach { d ->
                val selected = !d.toggle && d.key == selectedKey
                if (d.center) {
                    // Search: the circle and its label sit together in the bar
                    // row (label on the same line as the other labels, no gap).
                    CenterSearchItem(d, selected, colors) {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(d)
                    }
                    return@forEach
                }
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
                        BadgedBox(badge = { if (d.badge > 0) Badge { Text(if (d.badge > 99) "99+" else d.badge.toString()) } }) {
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

/** Round Search button with its label right under it; the corners morph
 *  from circle to squircle when active (spring). Same row as the other tabs. */
@Composable
private fun RowScope.CenterSearchItem(d: BarDestination, selected: Boolean, colors: ShellColors, onClick: () -> Unit) {
    val corner by animateDpAsState(if (selected) 16.dp else 23.dp, ShellMotion.spatial(), label = "searchCorner")
    val scale by animateFloatAsState(if (selected) 1.06f else 1f, ShellMotion.spatial(), label = "searchScale")
    Column(
        Modifier
            .weight(1f)
            // A fixed height, never "fill": filling made the whole bar grow
            // to the screen's height and swallow taps meant for the page.
            .height(80.dp)
            .testTag("nav_" + d.key)
            .semantics(mergeDescendants = true) { contentDescription = d.description; role = Role.Tab; this.selected = selected }
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClick)
            .padding(bottom = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Bottom,
    ) {
        Box(
            Modifier
                .graphicsLayer { scaleX = scale; scaleY = scale }
                .size(46.dp)
                .shadow(8.dp, RoundedCornerShape(corner), ambientColor = colors.brand, spotColor = colors.brand)
                .clip(RoundedCornerShape(corner))
                .background(colors.brandGradient)
                .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.55f), Color.Transparent)), RoundedCornerShape(corner)),
            contentAlignment = Alignment.Center,
        ) {
            if (d.key == "home")
                // The community's sun is the Home button.
                Image(painterResource(R.drawable.sun_medallion), contentDescription = null, modifier = Modifier.size(36.dp))
            else
                BadgedBox(badge = { if (d.badge > 0) Badge { Text(if (d.badge > 99) "99+" else d.badge.toString()) } }) {
                    Icon(if (selected) d.filled else d.outlined, contentDescription = null, tint = Color.White, modifier = Modifier.size(26.dp))
                }
        }
        Spacer(Modifier.height(3.dp))
        Text(
            d.label,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.brand,
        )
    }
}
