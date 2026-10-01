package org.mvpmi.directory.ui

import android.view.View
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource

/** What the page reports for the native bar (see web/controller.js _syncNav). */
@Immutable
data class NavUi(
    val visible: Boolean = false,
    val active: String? = null,
    val isAdmin: Boolean = false,
    val adminBadge: Int = 0,
    val dark: Boolean = false,
    val gujarati: Boolean = true,
)

/**
 * Native shell around the WebView: brick status-bar strip, the page (also the
 * blur source), the floating glass bottom bar above the system navigation
 * bar, and the splash screen on top at start. [onInsets] tells the page how
 * much room to leave at the bottom (in dp = CSS px).
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun AppShell(
    page: View,
    nav: NavUi,
    showSplash: Boolean,
    splash: SplashInfo,
    onEnter: () -> Unit,
    onContactAdmins: () -> Unit,
    onTab: (String) -> Unit,
    onInsets: (barSpaceDp: Float, navInsetDp: Float) -> Unit,
) {
    val colors = if (nav.dark) DarkShell else LightShell
    val hazeState = remember { HazeState() }
    val density = LocalDensity.current
    val imeOpen = WindowInsets.ime.getBottom(density) > 0
    val navInsetPx = WindowInsets.navigationBars.getBottom(density)
    var barBoxPx by remember { mutableIntStateOf(0) }
    val showBar = nav.visible && !showSplash && !imeOpen

    LaunchedEffect(showBar, barBoxPx, navInsetPx) {
        with(density) {
            onInsets(if (showBar && barBoxPx > 0) barBoxPx.toDp().value + 6f else 0f, navInsetPx.toDp().value)
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(colors.page)
            // Lets UI Automator find the tabs by id (nav_profile, splash_enter…).
            .semantics { testTagsAsResourceId = true },
    ) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars).background(Color(0xFFB2402C)))
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .hazeSource(hazeState)
                    .imePadding(),
            ) {
                AndroidView(factory = { page }, modifier = Modifier.fillMaxSize())
            }
        }
        AnimatedVisibility(
            visible = showBar,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(ShellMotion.spatial()) { it } + fadeIn(ShellMotion.effects()),
            exit = slideOutVertically(ShellMotion.effects()) { it } + fadeOut(ShellMotion.effects()),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .onSizeChanged { barBoxPx = it.height + navInsetPx },
                contentAlignment = Alignment.Center,
            ) {
                AdvancedBottomNavigationBar(
                    destinations = barDestinations(nav.gujarati, nav.isAdmin, nav.adminBadge, nav.dark),
                    selectedKey = nav.active,
                    onSelect = { onTab(it.key) },
                    hazeState = hazeState,
                    colors = colors,
                )
            }
        }
        AnimatedVisibility(
            visible = showSplash,
            enter = fadeIn(tween(200)),
            exit = fadeOut(tween(380)) + scaleOut(tween(380), targetScale = 1.04f),
        ) {
            SplashScreen(splash, if (nav.dark) DarkShell else LightShell, onEnter, onContactAdmins)
        }
    }
}
