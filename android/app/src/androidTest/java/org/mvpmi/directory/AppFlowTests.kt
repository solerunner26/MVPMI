package org.mvpmi.directory

import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.assertion.WebViewAssertions.webMatches
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.DriverAtoms.getText
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.hamcrest.Matchers.containsString
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Start, login with the mobile number, and system Back. */
@RunWith(AndroidJUnit4::class)
class LaunchLoginBackTest {
    @Test
    fun opensLoginsWithMobileAndBackLeavesTheApp() {
        T.recordEnvironment()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.waitScreen("login")
            // Espresso-Web reads the login screen through WebDriver atoms.
            onWebView()
                .withElement(findElement(Locator.CSS_SELECTOR, tid("Login screen")))
                .check(webMatches(getText(), containsString("mobile")))
            assertFalse("the window is not secure while no PIN lock is on", app.secureWindow())
            app.loginMobile(T.member(1))
            assertTrue(app.rows() >= 8)
            app.assertNoSidewaysScroll()
            // Back from the Member Directory home leaves the app; it never
            // returns to the Login screen.
            T.device.pressBack()
            T.waitUntil(10000, "the app closes on Back") { scenario.state == Lifecycle.State.DESTROYED }
        }
    }
}

/** Rotation (no reload, same screen) and the on-screen keyboard (insets). */
@RunWith(AndroidJUnit4::class)
class RotationKeyboardTest {
    @After
    fun natural() {
        runCatching { T.device.setOrientationNatural(); T.device.unfreezeRotation() }
    }

    @Test
    fun rotationKeepsTheScreenAndTheKeyboardNeverCoversSearch() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(2))
            app.js("window.__noReload = 1; return 1")
            T.device.setOrientationLeft()
            Thread.sleep(2000)
            assertEquals("directory", app.screen())
            assertEquals("page was not reloaded by rotation", 1, app.jsInt("return window.__noReload || 0"))
            assertTrue(app.rows() >= 8)
            app.assertNoSidewaysScroll()
            T.device.setOrientationNatural()
            Thread.sleep(2000)
            assertEquals("directory", app.screen())
            app.assertNoSidewaysScroll()

            val heightBefore = app.jsInt("return window.innerHeight")
            app.tap(tid("Search input"))
            val shown = T.poll(8000) { app.keyboardShown() }
            assumeTrue("No on-screen keyboard appeared on this emulator (hardware keyboard mode)", shown)
            Thread.sleep(1000)
            val box = app.js(
                "var r=document.querySelector('[data-testid=\"Search input\"]').getBoundingClientRect();" +
                    "return {bottom:r.bottom, h:window.innerHeight}",
            ) as org.json.JSONObject
            assertTrue("the page shrinks above the keyboard", box.getInt("h") < heightBefore)
            assertTrue("search box stays visible above the keyboard", box.getDouble("bottom") <= box.getDouble("h"))
            app.type("Asha")
            T.waitUntil(10000, "search result") { app.rows() == 1 }
            assertTrue(app.jsBool("return document.querySelector('[data-testid=\"Contact row\"]').textContent.indexOf('Asha')>=0"))
            T.device.pressBack() // closes the keyboard first
            Thread.sleep(800)
            assertEquals("directory", app.screen())
        }
    }
}

/** Network lost and back (radio switched off on the emulator). */
@RunWith(AndroidJUnit4::class)
class OfflineReconnectTest {
    private fun network(on: Boolean) {
        val word = if (on) "enable" else "disable"
        T.shell("svc wifi $word")
        T.shell("svc data $word")
    }

    @After
    fun restore() {
        network(true)
    }

    @Test
    fun offlineShowsSavedDirectoryAndRetryReconnects() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(3))
            network(false)
            T.waitUntil(30000, "network off") { !T.online() }
            // Ask the page to refresh (as when the person pulls or returns).
            app.js("window.dispatchEvent(new Event('offline')); return 1")
            app.waitFor(tid("Offline banner"), 30000)
            assertTrue("saved directory still listed", app.rows() >= 8)
            assertTrue("Call still offered offline", app.exists("[data-testid=\"Contact row\"] a[href^=\"tel:\"]"))
            network(true)
            T.waitUntil(60000, "network back") { T.online() }
            T.waitUntil(45000, "reconnected without restarting") {
                if (app.exists(tid("Offline banner"))) runCatching { app.tap(tid("Offline banner")) }
                !app.exists(tid("Offline banner"))
            }
            assertEquals("directory", app.screen())
        }
    }
}

/**
 * Cold start after the process was killed (CI runs phase1, then
 * `am force-stop`, then phase2 without clearing data).
 */
@RunWith(AndroidJUnit4::class)
class ColdStartTest {
    @Test
    fun phase1_loginAndTurnOnPinLock() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(4))
            app.turnOnPinLock("2468")
            T.waitUntil(5000, "screenshots blocked while the PIN lock is on") { app.secureWindow() }
        }
    }

    @Test
    fun phase2_coldStartAsksForThePinThenTurnsItOff() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.waitScreen("lock", 45000)
            assertTrue("screenshots blocked from the first frame", app.secureWindow())
            assertEquals("no contacts behind the lock", 0, app.rows())
            app.fill("Unlock secret", "1111")
            app.tap(tid("Unlock submit"))
            app.waitFor(tid("Unlock error"))
            app.fill("Unlock secret", "2468")
            app.tap(tid("Unlock submit"))
            app.waitScreen("directory")
            T.waitUntil(15000, "contacts") { app.rows() >= 8 }
            // One tap turns the lock off; screenshots are allowed again.
            app.tap(tid("Profile and settings"))
            app.waitScreen("profile")
            app.tap(tid("Profile PIN lock"))
            T.waitUntil(15000, "lock off") {
                app.jsString("return document.querySelector('[data-testid=\"Profile PIN lock\"]').getAttribute('aria-checked')") == "false"
            }
            T.waitUntil(5000, "window no longer secure") { !app.secureWindow() }
        }
    }
}

/** The optional lock closes after a minute in the background. */
@RunWith(AndroidJUnit4::class)
class BackgroundLockTest {
    @Test
    fun oneMinuteInTheBackgroundLocksAndForgotPinSignsOut() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(5))
            app.turnOnPinLock("1357")
            T.device.pressHome()
            Thread.sleep(65000)
            T.launchFromLauncher()
            app.waitScreen("lock", 30000)
            assertEquals(0, app.rows())
            app.fill("Unlock secret", "1357")
            app.tap(tid("Unlock submit"))
            app.waitScreen("directory")
            // Forgot PIN = sign out and log in again (no administrator).
            T.device.pressHome()
            Thread.sleep(65000)
            T.launchFromLauncher()
            app.waitScreen("lock", 30000)
            app.tap(tid("Lock forgot"))
            if (app.exists(tid("Confirm yes"))) app.tap(tid("Confirm yes"))
            app.waitScreen("login")
            app.loginMobile(T.member(5))
            assertFalse("no lock after logging in again", app.secureWindow())
        }
    }
}
