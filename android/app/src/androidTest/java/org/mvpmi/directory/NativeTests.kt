package org.mvpmi.directory

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtra
import androidx.test.espresso.intent.matcher.IntentMatchers.isInternal
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.hamcrest.Matchers.allOf
import org.hamcrest.Matchers.not
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.regex.Pattern

/** Call and WhatsApp: the exact intents the app sends (Espresso-Intents). */
@RunWith(AndroidJUnit4::class)
class CallWhatsAppIntentTest {
    @Before
    fun start() = Intents.init()

    @After
    fun stop() = Intents.release()

    @Test
    fun callOpensTheDiallerAndWhatsAppOpensWaMe() {
        // Outgoing intents are answered by the test instead of a real app, so
        // this checks WHAT the app asks Android to open (the emulator has no
        // WhatsApp; the real dialler is checked in the next test).
        intending(not(isInternal())).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, null))
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(6))
            val call = "[data-testid=\"Contact row\"] a[href^=\"tel:\"]"
            val tel = app.jsString("return document.querySelector('$call').getAttribute('href')")!!
            assertTrue(tel, tel.matches(Regex("tel:\\+91[0-9]{10}")))
            app.tap(call)
            intended(allOf(hasAction(Intent.ACTION_DIAL), hasData(Uri.parse(tel))))
            val wa = "[data-testid=\"Contact row\"] a[href*=\"wa.me\"]"
            val link = app.jsString("return document.querySelector('$wa').getAttribute('href')")!!
            assertTrue(link, link.startsWith("https://wa.me/91"))
            app.tap(wa)
            intended(allOf(hasAction(Intent.ACTION_VIEW), hasData(Uri.parse(link))))
            assertEquals("still in the directory", "directory", app.screen())
        }
    }
}

/** The real dialler app opens with the number filled in (UI Automator). */
@RunWith(AndroidJUnit4::class)
class RealDiallerTest {
    @Test
    fun callOpensTheSystemDialler() {
        val dial = Intent(Intent.ACTION_DIAL, Uri.parse("tel:+919700000001"))
        val handler = T.instr.targetContext.packageManager.resolveActivity(dial, 0)
        assumeTrue("This emulator image has no dialler app", handler != null)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(7))
            val tel = app.jsString("return document.querySelector('[data-testid=\"Contact row\"] a[href^=\"tel:\"]').getAttribute('href')")!!
            app.tap("[data-testid=\"Contact row\"] a[href^=\"tel:\"]")
            val dialler = T.device.wait(Until.hasObject(By.pkg(Pattern.compile(".*(dialer|contacts|phone).*"))), 15000)
            assertTrue("dialler opened", dialler == true)
            val digits = tel.removePrefix("tel:+91")
            val shown = T.device.wait(Until.hasObject(By.text(Pattern.compile(".*" + digits.takeLast(4) + ".*"))), 8000)
            assertTrue("number $digits shown in the dialler", shown == true)
            T.device.pressBack()
            T.device.pressBack()
            T.launchFromLauncher()
            app.waitScreen("directory")
        }
    }
}

/**
 * Backup & export (Main Admin): the file really goes through Android's
 * "save as" sheet (ACTION_CREATE_DOCUMENT) and is written by the app.
 */
@RunWith(AndroidJUnit4::class)
class ExportSaveTest {
    private val target = File(T.instr.targetContext.cacheDir, "export-test.csv")

    private fun openExports(app: App) {
        app.english()
        if (app.screen() == "login") app.loginMain()
        app.tap(tid("Admin"))
        if (app.exists(tid("Admin enter dialog"))) {
            app.fill("Admin enter secret", T.MAIN_PASSWORD)
            app.tap(tid("Admin enter submit"))
        }
        app.tapText(".mvpmi-tile", "Backup & export")
        app.waitFor(".mvpmi-tile")
        T.waitUntil(15000, "CSV tile") { app.jsBool("return [...document.querySelectorAll('.mvpmi-tile')].some(function(t){return t.textContent.indexOf('CSV list')>=0})") }
    }

    @Before
    fun clean() {
        target.delete()
    }

    @Test
    fun a_saveWritesTheCsvThroughTheSaveSheet() {
        Intents.init()
        try {
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT))
                .respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, Intent().setData(Uri.fromFile(target))))
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val app = App(scenario)
                openExports(app)
                app.tapText(".mvpmi-tile", "CSV list")
                T.waitUntil(20000, "CSV written") { target.length() > 0 }
                intended(allOf(hasAction(Intent.ACTION_CREATE_DOCUMENT), hasExtra(Intent.EXTRA_TITLE, "mvpmi-members.csv")))
                val text = target.readText()
                assertTrue("members in the file", text.contains("9700000001") && text.contains("Asha"))
            }
        } finally {
            Intents.release()
        }
    }

    @Test
    fun b_cancelWritesNothingAndTheAppCarriesOn() {
        Intents.init()
        try {
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT))
                .respondWith(Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null))
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val app = App(scenario)
                openExports(app)
                app.tapText(".mvpmi-tile", "CSV list")
                Thread.sleep(3000)
                assertFalse(target.exists())
                // The page still works: a second export can be started.
                app.tapText(".mvpmi-tile", "Excel (.xlsx)")
                intended(allOf(hasAction(Intent.ACTION_CREATE_DOCUMENT), hasExtra(Intent.EXTRA_TITLE, "mvpmi-contacts.xlsx")))
            }
        } finally {
            Intents.release()
        }
    }

    @Test
    fun c_aPlaceThatCannotBeWrittenFailsSafely() {
        Intents.init()
        try {
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT))
                .respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, Intent().setData(Uri.parse("content://org.mvpmi.missing.provider/nothing.csv"))))
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val app = App(scenario)
                openExports(app)
                app.tapText(".mvpmi-tile", "CSV list")
                Thread.sleep(3000)
                var finishing = true
                scenario.onActivity { finishing = it.isFinishing }
                assertFalse("the app did not crash or close", finishing)
                assertNotNull(app.screen())
            }
        } finally {
            Intents.release()
        }
    }

    @Test
    fun d_realSaveSheetCancelThenSave() {
        T.shell("rm -f /sdcard/Download/mvpmi-members*.csv")
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            openExports(app)
            val picker = Pattern.compile(".*documentsui.*")
            // Cancel with Back: the app comes back, nothing saved.
            app.tapText(".mvpmi-tile", "CSV list")
            assertTrue("save sheet opened", T.device.wait(Until.hasObject(By.pkg(picker)), 15000) == true)
            T.device.pressBack()
            T.waitUntil(10000, "back in the app") { T.device.currentPackageName == T.pkg }
            assertEquals("", T.shell("ls /sdcard/Download/ 2>/dev/null").lines().filter { it.startsWith("mvpmi-members") }.joinToString())
            // Save into Downloads.
            app.tapText(".mvpmi-tile", "CSV list")
            assertTrue(T.device.wait(Until.hasObject(By.pkg(picker)), 15000) == true)
            Thread.sleep(1500)
            var save = T.device.findObject(By.pkg(picker).text(Pattern.compile("(?i)save")))
            if (save == null || !save.isEnabled) {
                // Some versions open in "Recent", where nothing can be saved.
                T.device.findObject(By.desc(Pattern.compile("(?i)show roots")))?.click()
                T.device.wait(Until.findObject(By.text(Pattern.compile("(?i)downloads?"))), 8000)?.click()
                Thread.sleep(1500)
                save = T.device.wait(Until.findObject(By.pkg(picker).text(Pattern.compile("(?i)save"))), 8000)
            }
            assertNotNull("Save button in the save sheet", save)
            save!!.click()
            T.waitUntil(15000, "back in the app after saving") { T.device.currentPackageName == T.pkg }
            T.waitUntil(15000, "file in Downloads") {
                T.shell("ls /sdcard/Download/").lines().any { it.startsWith("mvpmi-members") }
            }
        }
    }
}

/** Android 13+: notification permission denied, then enabled later. */
@RunWith(AndroidJUnit4::class)
class NotificationPermissionTest {
    private fun granted() = T.instr.targetContext.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun notificationShown(text: String): Boolean {
        T.device.openNotification()
        val found = T.device.wait(Until.hasObject(By.textContains(text)), 8000) == true
        T.device.pressBack()
        Thread.sleep(800)
        return found
    }

    @Test
    fun denyKeepsTheAppWorkingAndEnablingLaterShowsNotifications() {
        assumeTrue("Runtime notification permission exists from Android 13 (API 33)", Build.VERSION.SDK_INT >= 33)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(8))
            // Asked once after sign-in (the device registers for notifications).
            val deny = T.device.wait(
                Until.findObject(By.res(Pattern.compile(".*permission_deny.*button"))),
                30000,
            ) ?: T.device.findObject(By.text(Pattern.compile("(?i)don.t allow")))
            assertNotNull("Android asked for notification permission", deny)
            deny!!.click()
            T.waitUntil(10000, "back in the app") { T.device.currentPackageName == T.pkg }
            assertFalse(granted())
            assertEquals("directory", app.screen())
            app.js("window.mvpmiBridge.notify('MVPMI test', 'While denied'); return 1")
            assertFalse("no notification while denied", notificationShown("While denied"))
            // The person turns notifications on later in the phone's settings
            // (done here with the same permission switch Settings uses).
            T.shell("pm grant ${T.pkg} android.permission.POST_NOTIFICATIONS")
            assertTrue(granted())
            app.js("window.mvpmiBridge.notify('MVPMI test', 'After enabling'); return 1")
            assertTrue("notification appears after enabling", notificationShown("After enabling"))
            assertEquals("directory", app.screen())
        }
    }
}

/**
 * Enrolls a fingerprint on the emulator (screen lock PIN + Settings flow,
 * finger touches sent by CI through `adb emu finger touch`). Skipped, not
 * failed, when this emulator image cannot enroll one.
 */
@RunWith(AndroidJUnit4::class)
class FingerprintSetup {
    @Test
    fun enrollFingerprint() {
        val context = T.instr.targetContext
        if (Biometric.available(context)) return
        T.shell("locksettings set-pin 1111")
        val enroll = Intent(if (Build.VERSION.SDK_INT >= 30) Settings.ACTION_BIOMETRIC_ENROLL else "android.settings.FINGERPRINT_ENROLL")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 30)
            enroll.putExtra(Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED, android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG)
        val started = runCatching { context.startActivity(enroll) }.isSuccess
        assumeTrue("No fingerprint enrollment screen on this image", started)
        val buttons = Pattern.compile("(?i)^(next|i agree|agree|more|continue|start|ok|got it|done)$")
        val ok = T.poll(150000) {
            if (Biometric.available(context)) return@poll true
            val pinField = T.device.findObject(By.clazz("android.widget.EditText"))
            val button = T.device.findObject(By.text(buttons)) ?: T.device.findObject(By.desc(buttons))
            when {
                pinField != null && pinField.text.isNullOrEmpty() -> {
                    pinField.click(); T.shell("input text 1111"); T.shell("input keyevent 66")
                }
                button != null && button.isEnabled -> button.click()
                else -> T.log("FINGER_GOOD") // CI touches the sensor with finger 1
            }
            Thread.sleep(1500)
            Biometric.available(context)
        }
        T.device.pressHome()
        assumeTrue("Fingerprint enrollment did not complete on this emulator image", ok)
        T.log("FINGERPRINT_ENROLLED")
    }
}

/** Fingerprint unlock: turn on, unknown finger, cancel, then the right finger. */
@RunWith(AndroidJUnit4::class)
class BiometricUnlockTest {
    private fun promptVisible() =
        T.device.wait(Until.hasObject(By.pkg("com.android.systemui").text(Pattern.compile("(?i)cancel"))), 10000) == true

    @Test
    fun fingerprintEnrollFailCancelAndSucceed() {
        assumeTrue("No fingerprint enrolled on this emulator (see FingerprintSetup)", Biometric.available(T.instr.targetContext))
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val app = App(scenario)
            app.english()
            app.loginMobile(T.member(1))
            app.turnOnPinLock("3690")
            // Turn on fingerprint: the phone's own prompt appears.
            app.tap(tid("Profile fingerprint"))
            assertTrue("fingerprint prompt shown", promptVisible())
            T.log("FINGER_GOOD")
            T.waitUntil(20000, "fingerprint switch on") {
                app.jsString("return document.querySelector('[data-testid=\"Profile fingerprint\"]').getAttribute('aria-checked')") == "true"
            }
            // Lock the app now (the same server call a minute in the background makes).
            app.js(
                "fetch('/api/lock/engage',{method:'POST',headers:{'X-MVPMI-Client':'1','Content-Type':'application/json'},body:'{}',credentials:'same-origin'})" +
                    ".then(function(){location.reload()}); return 1",
            )
            app.waitScreen("lock", 30000)
            // A finger that is not enrolled is refused; Cancel keeps the app locked.
            if (!T.poll(3000) { T.device.hasObject(By.pkg("com.android.systemui")) }) app.tap(tid("Unlock fingerprint"))
            assertTrue(promptVisible())
            T.log("FINGER_BAD")
            Thread.sleep(3000)
            assertEquals("unknown finger does not unlock", "lock", app.screen())
            T.device.findObject(By.pkg("com.android.systemui").text(Pattern.compile("(?i)cancel")))?.click()
            Thread.sleep(1500)
            assertEquals("cancel keeps the app locked", "lock", app.screen())
            assertEquals(0, app.rows())
            // The enrolled finger unlocks.
            app.tap(tid("Unlock fingerprint"))
            assertTrue(promptVisible())
            T.log("FINGER_GOOD")
            app.waitScreen("directory", 30000)
            T.waitUntil(15000, "contacts") { app.rows() >= 8 }
        }
    }

    @After
    fun screenLockOff() {
        // Leave the emulator without a screen lock for the next run.
        runCatching { T.shell("locksettings clear --old 1111") }
    }
}
