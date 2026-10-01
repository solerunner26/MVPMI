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

/** Server not reachable, then back: the app keeps the saved directory and
 *  reconnects with Retry, without restarting. */
@RunWith(AndroidJUnit4::class)
class ServerUnreachableTest {
    @After
    fun restore() {
        runCatching { T.serverOutage(false) }
    }

    @Test
    fun unreachableShowsSavedDirectoryAndRetryReconnects() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(3))
            T.serverOutage(true)
            // The page notices on its next request (as when the person returns).
            app.js("window.dispatchEvent(new Event('offline')); return 1")
            app.waitFor(tid("Offline banner"), 30000)
            assertTrue("saved directory still listed", app.rows() >= 8)
            assertTrue("Call still offered offline", app.exists("[data-testid=\"Contact row\"] a[href^=\"tel:\"]"))
            T.serverOutage(false)
            T.waitUntil(45000, "reconnected without restarting") {
                if (app.exists(tid("Offline banner"))) runCatching { app.tap(tid("Offline banner")) }
                !app.exists(tid("Offline banner"))
            }
            assertEquals("directory", app.screen())
        }
    }
}

/** The phone itself offline (airplane mode / Wi-Fi and data off). Reported as
 *  SKIPPED when this emulator image does not let the test cut its network. */
@RunWith(AndroidJUnit4::class)
class DeviceOfflineTest {
    @After
    fun restore() {
        T.network(true)
        T.poll(60000) { T.online() }
    }

    @Test
    fun airplaneModeShowsSavedDirectoryAndComesBack() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(3))
            T.network(false)
            assumeTrue("This emulator image keeps its network on (airplane mode not applied)", T.poll(30000) { !T.online() })
            app.js("window.dispatchEvent(new Event('offline')); return 1")
            app.waitFor(tid("Offline banner"), 30000)
            assertTrue(app.rows() >= 8)
            T.network(true)
            T.waitUntil(60000, "network back") { T.online() }
            T.waitUntil(45000, "reconnected") {
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
            // Four digits submit by themselves.
            app.fill("Unlock secret", "1111")
            app.waitFor(tid("Unlock error"))
            assertEquals("wrong PIN keeps it locked", "lock", app.screen())
            app.fill("Unlock secret", "2468")
            app.waitScreen("directory")
            T.waitUntil(15000, "contacts") { app.rows() >= 8 }
            // One tap turns the lock off; screenshots are allowed again.
            app.navUntil("profile", "My Profile") { app.screen() == "profile" }
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
            app.fill("Unlock secret", "1357") // 4 digits unlock by themselves
            // Unlocking returns to the screen the person was on (My Profile).
            T.waitUntil(30000, "unlocked") { app.screen() in setOf("profile", "directory") }
            // Forgot PIN = sign out and log in again (no administrator).
            T.device.pressHome()
            Thread.sleep(65000)
            T.launchFromLauncher()
            app.waitScreen("lock", 30000)
            // "Forgot PIN?" asks "Sign out of this phone?".
            app.tapUntil(tid("Lock forgot"), "sign-out question") { app.exists(tid("Confirm yes")) }
            app.tapUntil(tid("Confirm yes"), "Login screen") { app.screen() == "login" }
            app.loginMobile(T.member(5))
            assertFalse("no lock after logging in again", app.secureWindow())
        }
    }
}
