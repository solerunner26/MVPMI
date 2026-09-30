package org.mvpmi.directory

import android.app.Instrumentation
import android.content.Intent
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Shared helpers for the instrumented tests (patterns from
 * github.com/android/testing-samples: AndroidJUnitRunner + ActivityScenario,
 * Espresso-Web, Espresso-Intents and UI Automator).
 *
 * The tests run on a real emulator against the CI test server
 * (scripts/android-test-server.mjs, reached at http://10.0.2.2:3900) that
 * serves THIS commit's web code. Taps are real touch events on the screen
 * and typing uses real key events, so the WebView, keyboard and system
 * dialogs behave as they do for a person.
 */
object T {
    const val TAG = "MVPMITEST"
    const val MAIN = "9913000001"
    const val MAIN_PASSWORD = "Testing@26"
    const val VILLAGE_ADMIN = "9800000010"
    fun member(n: Int) = "970000000$n"

    val instr: Instrumentation get() = InstrumentationRegistry.getInstrumentation()
    val device: UiDevice get() = UiDevice.getInstance(instr)
    val pkg: String get() = instr.targetContext.packageName

    fun log(message: String) {
        Log.i(TAG, message)
    }

    /** Runs a shell command as the shell user (like adb shell). */
    fun shell(command: String): String {
        val pfd = instr.uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(pfd).use { it.bufferedReader().readText() }
    }

    fun waitUntil(timeoutMs: Long, what: String, check: () -> Boolean) {
        if (!poll(timeoutMs, check)) fail("Timed out after ${timeoutMs / 1000}s waiting for: $what")
    }

    fun poll(timeoutMs: Long, check: () -> Boolean): Boolean {
        val end = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < end) {
            val ok = try { check() } catch (_: Throwable) { false }
            if (ok) return true
            SystemClock.sleep(250)
        }
        return false
    }

    /** API level, WebView package/version, app version and server address,
     *  written to logcat so CI can put them in the report. */
    fun recordEnvironment() {
        val context = instr.targetContext
        val webView = WebView.getCurrentWebViewPackage()
        @Suppress("DEPRECATION")
        val app = context.packageManager.getPackageInfo(context.packageName, 0)
        log(
            "ENV api=${Build.VERSION.SDK_INT} release=${Build.VERSION.RELEASE} device=${Build.MODEL} " +
                "webview=${webView?.packageName}:${webView?.versionName} app=${app.versionName} " +
                "server=${BuildConfig.COMMUNITY_URL}",
        )
    }

    /** Network off/on as a person would do it (airplane mode where the
     *  shell may switch it, Wi-Fi and mobile data everywhere). */
    fun network(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) shell("cmd connectivity airplane-mode " + if (on) "disable" else "enable")
        val word = if (on) "enable" else "disable"
        shell("svc wifi $word")
        shell("svc data $word")
    }

    /** True while Android reports a usable network. */
    fun online(): Boolean {
        val cm = instr.targetContext.getSystemService(android.net.ConnectivityManager::class.java)
        val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Opens the app from the launcher icon (the same intent Android uses). */
    fun launchFromLauncher() {
        val context = instr.targetContext
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}

fun tid(id: String) = "[data-testid=\"$id\"]"
private fun q(value: String) = JSONObject.quote(value)

/** Drives the running app: reads the page with JavaScript and acts with real
 *  touches and key presses. */
class App(val scenario: ActivityScenario<MainActivity>) {
    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWebView(view.getChildAt(i))?.let { return it }
        return null
    }

    /** Evaluates `body` (a function body that returns a value) in the page. */
    fun js(body: String): Any? {
        val latch = CountDownLatch(1)
        val result = AtomicReference<String>("null")
        scenario.onActivity { activity ->
            val web = findWebView(activity.window.decorView) ?: error("WebView not found")
            web.evaluateJavascript("(function(){ $body })()") { value ->
                result.set(value ?: "null")
                latch.countDown()
            }
        }
        if (!latch.await(15, TimeUnit.SECONDS)) error("JavaScript did not answer: $body")
        val value = JSONTokener(result.get()).nextValue()
        return if (value == JSONObject.NULL) null else value
    }

    fun jsBool(body: String) = js(body) == true
    fun jsInt(body: String) = (js(body) as? Number)?.toInt() ?: -1
    fun jsString(body: String) = js(body)?.toString()

    fun exists(css: String) = jsBool("return !!document.querySelector(${q(css)})")
    fun screen() = jsString("var a=document.querySelector('.app'); return a ? a.getAttribute('data-screen') : null")

    fun waitFor(css: String, timeoutMs: Long = 20000) = T.waitUntil(timeoutMs, css) { exists(css) }
    fun waitGone(css: String, timeoutMs: Long = 20000) = T.waitUntil(timeoutMs, "$css to disappear") { !exists(css) }
    fun waitScreen(name: String, timeoutMs: Long = 30000) = T.waitUntil(timeoutMs, "screen '$name' (now '${runCatching { screen() }.getOrNull()}')") { screen() == name }

    fun rows() = jsInt("return document.querySelectorAll(${q(tid("Contact row"))}).length")

    /** Real finger tap on the centre of the element. */
    fun tap(css: String) {
        // The page may re-render between finding and measuring the element;
        // try again until it stays put.
        var box: JSONObject? = null
        T.waitUntil(20000, css) {
            box = js(
                "var e=document.querySelector(${q(css)}); if(!e) return null;" +
                    "e.scrollIntoView({block:'center', inline:'center'}); var r=e.getBoundingClientRect();" +
                    "if(!r.width||!r.height) return null;" +
                    "return {x:r.left+r.width/2, y:r.top+r.height/2, d:window.devicePixelRatio}",
            ) as? JSONObject
            box != null
        }
        SystemClock.sleep(250)
        box = (js(
            "var e=document.querySelector(${q(css)}); if(!e) return null; var r=e.getBoundingClientRect();" +
                "return {x:r.left+r.width/2, y:r.top+r.height/2, d:window.devicePixelRatio}",
        ) as? JSONObject) ?: box
        val b = box!!
        val location = IntArray(2)
        scenario.onActivity { activity -> findWebView(activity.window.decorView)!!.getLocationOnScreen(location) }
        val d = b.getDouble("d")
        T.device.click((location[0] + b.getDouble("x") * d).toInt(), (location[1] + b.getDouble("y") * d).toInt())
        SystemClock.sleep(400)
    }

    /** Tap the first element matching `css` whose text contains `text`. */
    fun tapText(css: String, text: String) {
        T.waitUntil(20000, "'$text' in $css") {
            jsBool(
                "var e=[...document.querySelectorAll(${q(css)})].find(function(x){return x.textContent.indexOf(${q(text)})>=0});" +
                    "if(!e) return false; document.querySelectorAll('[data-t-target]').forEach(function(x){x.removeAttribute('data-t-target')});" +
                    "e.setAttribute('data-t-target','1'); return true",
            )
        }
        tap("[data-t-target=\"1\"]")
    }

    /** Types with real key events into the focused field. */
    fun type(text: String) {
        T.instr.sendStringSync(text)
        SystemClock.sleep(300)
    }

    fun clearFocusedField(count: Int = 12) {
        repeat(count) { T.instr.sendKeyDownUpSync(KeyEvent.KEYCODE_DEL) }
    }

    fun fill(testId: String, text: String) {
        tap(tid(testId))
        clearFocusedField()
        type(text)
    }

    /** English UI for readable assertions (the app starts in Gujarati). */
    fun english() {
        waitFor(".app")
        if (jsString("return document.querySelector('.app').getAttribute('data-lang')") != "en") {
            js(
                "var p={}; try{p=JSON.parse(localStorage.getItem('mvpmi-preferences')||'{}')}catch(e){}" +
                    "p.lang='en'; localStorage.setItem('mvpmi-preferences', JSON.stringify(p)); location.reload(); return 1",
            )
            SystemClock.sleep(1500)
            T.waitUntil(30000, "English UI") { jsString("var a=document.querySelector('.app'); return a && a.getAttribute('data-lang')") == "en" }
        }
    }

    /** Members and Village Admins: mobile number only. */
    fun loginMobile(mobile: String) {
        waitScreen("login")
        fill("Login mobile", mobile)
        tap(tid("Login submit"))
        waitScreen("directory")
        T.waitUntil(20000, "contact rows") { rows() >= 3 }
    }

    fun loginMain() {
        waitScreen("login")
        tap(tid("Toggle password mode"))
        fill("Login mobile", T.MAIN)
        fill("Login secret", T.MAIN_PASSWORD)
        tap(tid("Login submit"))
        waitScreen("directory")
    }

    /** My Profile → "Lock this app with a PIN" → the PIN twice. */
    fun turnOnPinLock(pin: String) {
        tap(tid("Profile and settings"))
        waitScreen("profile")
        tap(tid("Profile PIN lock"))
        waitFor(tid("Lock PIN dialog"))
        fill("Lock pin", pin)
        fill("Lock pin confirm", pin)
        tap(tid("Lock pin save"))
        T.waitUntil(15000, "PIN lock switch on") {
            jsString("var s=document.querySelector(${q(tid("Profile PIN lock"))}); return s && s.getAttribute('aria-checked')") == "true"
        }
    }

    fun secureWindow(): Boolean {
        var secure = false
        scenario.onActivity { secure = it.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0 }
        return secure
    }

    fun keyboardShown(): Boolean {
        var shown = false
        if (Build.VERSION.SDK_INT >= 30)
            scenario.onActivity { shown = it.window.decorView.rootWindowInsets?.isVisible(WindowInsets.Type.ime()) == true }
        return shown || T.shell("dumpsys input_method").contains("mInputShown=true")
    }

    fun assertNoSidewaysScroll() {
        val over = jsInt("return document.documentElement.scrollWidth - window.innerWidth")
        assertTrue("page scrolls sideways by ${over}px", over <= 1)
    }
}
