package org.mvpmi.directory

import android.annotation.TargetApi
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONObject
import org.mvpmi.directory.ui.AppShell
import org.mvpmi.directory.ui.NavUi
import org.mvpmi.directory.ui.SplashInfo

/** Android host for the hosted community directory (online WebView app). */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var content: FrameLayout
    private var errorView: View? = null
    private var upload: ValueCallback<Array<Uri>>? = null
    // Native shell state (splash screen + bottom bar), fed by the page.
    private var navUi by mutableStateOf(NavUi())
    private var showSplash by mutableStateOf(false)
    private var splashFromLogo = false
    private var splashInfo by mutableStateOf(SplashInfo())
    private var lastInsets = 0f to 0f
    private var backPending = false
    // The server address is fixed when the app is built (BuildConfig);
    // members can never see or change it.
    private val serverUrl = BuildConfig.COMMUNITY_URL
    private var pendingSave: Pair<String, ByteArray>? = null

    /** Web bridge: file saving (phone or Google Drive via the system
     *  picker), printing (Save as PDF anywhere) and local reminders. */
    inner class Bridge {
        @android.webkit.JavascriptInterface
        fun saveFile(name: String, mime: String, base64: String) {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            runOnUiThread {
                pendingSave = name to bytes
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = if (mime.isBlank()) "application/octet-stream" else mime
                    putExtra(Intent.EXTRA_TITLE, name)
                }
                try { startActivityForResult(intent, 101) }
                catch (_: ActivityNotFoundException) {
                    pendingSave = null
                    message(R.string.save_no_sheet_gu, R.string.save_no_sheet_en)
                }
            }
        }

        /** The page reports what the native bottom bar and splash should show:
         *  visibility, active tab, role, theme, language and member counts
         *  (never phone numbers). */
        /** The sun logo in the page header shows the splash (Mataji) again;
         *  "Enter Directory" or Back returns to the page. */
        @android.webkit.JavascriptInterface
        fun openSplash() {
            runOnUiThread {
                splashFromLogo = true
                showSplash = true
                applySystemBars()
            }
        }

        @android.webkit.JavascriptInterface
        fun navState(json: String) {
            val o = try { JSONObject(json) } catch (_: Exception) { return }
            runOnUiThread {
                navUi = NavUi(
                    visible = o.optBoolean("visible"),
                    active = o.optString("active").ifBlank { null },
                    isAdmin = o.optBoolean("isAdmin"),
                    adminBadge = o.optInt("adminBadge"),
                    dark = o.optBoolean("dark"),
                    gujarati = o.optString("lang") != "en",
                )
                val prefs = getPreferences(MODE_PRIVATE).edit()
                    .putBoolean("shellDark", navUi.dark)
                    .putBoolean("shellGujarati", navUi.gujarati)
                if (o.optBoolean("loggedIn"))
                    prefs.putString("splashVillageGu", o.optString("villageGu"))
                        .putString("splashVillageEn", o.optString("villageEn"))
                        .putInt("splashVillageMembers", o.optInt("villageMembers"))
                        .putInt("splashTotal", o.optInt("totalMembers"))
                prefs.apply()
                applySystemBars()
            }
        }

        @android.webkit.JavascriptInterface
        fun printHtml(title: String, base64: String) {
            val html = String(Base64.decode(base64, Base64.DEFAULT), Charsets.UTF_8)
            runOnUiThread { printReport(title, html) }
        }

        @android.webkit.JavascriptInterface
        fun notify(title: String, text: String) {
            runOnUiThread { Notifications.show(this@MainActivity, "", title, text) }
        }

        /** Background notifications: store the device token for [NotificationJob]. */
        @android.webkit.JavascriptInterface
        fun registerDevice(token: String) {
            if (!Regex("[a-f0-9]{64}").matches(token)) return
            runOnUiThread {
                Notifications.save(this@MainActivity, serverUrl, token)
                askNotificationPermission()
                pullSoon()
            }
        }

        /** The page saw something new: check the server now. */
        @android.webkit.JavascriptInterface
        fun pullNow() {
            runOnUiThread { pullSoon() }
        }

        /** Section 5: optional fingerprint unlock through the phone's own
         *  biometric prompt. The app keeps a random device key in its private
         *  storage and gives it to the page only after a successful prompt;
         *  the server stores just a hash of it for this login. */
        @android.webkit.JavascriptInterface
        fun biometricAvailable(): Boolean = Biometric.available(this@MainActivity)

        @android.webkit.JavascriptInterface
        fun biometricEnroll(title: String, cancel: String) {
            runOnUiThread {
                Biometric.prompt(this@MainActivity, title, cancel) { ok ->
                    sendBiometric(if (ok) "ok" else "cancel", if (ok) Biometric.key(this@MainActivity, create = true) else "")
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun biometricUnlock(title: String, cancel: String) {
            runOnUiThread {
                val key = Biometric.key(this@MainActivity, create = false)
                if (key.isEmpty()) { sendBiometric("error", ""); return@runOnUiThread }
                Biometric.prompt(this@MainActivity, title, cancel) { ok ->
                    sendBiometric(if (ok) "ok" else "cancel", if (ok) key else "")
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun biometricForget() {
            runOnUiThread { Biometric.forget(this@MainActivity) }
        }

        /** True while the person's optional PIN lock is on: hides the screen
         *  from screenshots and the recent-apps preview. */
        @android.webkit.JavascriptInterface
        fun setScreenPrivacy(on: Boolean) {
            runOnUiThread {
                getPreferences(MODE_PRIVATE).edit().putBoolean("screenPrivacy", on).apply()
                applyScreenPrivacy(on)
            }
        }
    }

    private fun applyScreenPrivacy(on: Boolean) {
        if (on) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    private fun sendBiometric(kind: String, key: String) {
        // Both values are fixed words or 64 hex digits (see Biometric.key).
        val safeKind = if (kind == "ok" || kind == "cancel") kind else "error"
        val safeKey = if (Regex("[a-f0-9]{64}").matches(key)) key else ""
        web.evaluateJavascript("window.mvpmiBiometricResult && window.mvpmiBiometricResult('$safeKind','$safeKey')", null)
    }

    private fun pullSoon() {
        val context = applicationContext
        Thread { Notifications.pull(context) }.start()
    }

    /** Asked only once the person has applied or signed in (not at first launch). */
    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
            !getPreferences(MODE_PRIVATE).getBoolean("askedNotifications", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("askedNotifications", true).apply()
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 102)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The app must stay visible in the recent-apps list like any other
        // app. Screenshots and the recents preview are blocked ONLY while the
        // person's optional PIN lock is on (the page tells us through
        // setScreenPrivacy; the choice is remembered for the next start).
        applyScreenPrivacy(getPreferences(MODE_PRIVATE).getBoolean("screenPrivacy", false))
        content = FrameLayout(this).apply { setBackgroundColor(Color.rgb(255, 251, 246)) }
        web = WebView(this)
        // Lets the phone's password manager (Google Password Manager) offer to
        // save the Main Admin's password; members have no password.
        web.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
        content.addView(web, FrameLayout.LayoutParams(-1, -1))
        // Splash screen at every fresh start (not after rotation or a return
        // from the background); the directory loads underneath meanwhile.
        val prefs = getPreferences(MODE_PRIVATE)
        navUi = NavUi(dark = prefs.getBoolean("shellDark", false), gujarati = prefs.getBoolean("shellGujarati", true))
        splashInfo = SplashInfo(
            villageGu = prefs.getString("splashVillageGu", "") ?: "",
            villageEn = prefs.getString("splashVillageEn", "") ?: "",
            villageMembers = prefs.getInt("splashVillageMembers", 0),
            totalMembers = prefs.getInt("splashTotal", 0),
            gujarati = navUi.gujarati,
        )
        showSplash = savedInstanceState == null
        applySystemBars()
        setContent {
            AppShell(
                page = content,
                nav = navUi,
                showSplash = showSplash,
                splash = splashInfo.copy(gujarati = navUi.gujarati),
                onEnter = { showSplash = false; splashFromLogo = false; applySystemBars() },
                onContactAdmins = { showSplash = false; applySystemBars(); webNav("admins") },
                onTab = { key -> webNav(key) },
                onInsets = { bar, inset -> lastInsets = bar to inset; pushInsets() },
            )
        }
        // One Back handler for every Android version (predictive Back on 13+).
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    showSplash && splashFromLogo -> { showSplash = false; splashFromLogo = false; applySystemBars() }
                    showSplash -> finish()
                    else -> navigateBack()
                }
            }
        })
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            userAgentString += " MVPMlAndroid/" + BuildConfig.VERSION_NAME + " MVPMlBuild/" + BuildConfig.VERSION_CODE
        }
        web.addJavascriptInterface(Bridge(), "mvpmiBridge")
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.webViewClient = object : WebViewClient() {
            @Deprecated("Required for Android 5 and 6")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = route(Uri.parse(url))
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = route(request.url, request.isForMainFrame)
            override fun onPageFinished(view: WebView, url: String) { CookieManager.getInstance().flush(); pushInsets() }
            // The legacy callback is invoked for main-frame errors by newer WebView versions too.
            @Deprecated("Compatible main-frame error callback")
            override fun onReceivedError(view: WebView, code: Int, description: String, failingUrl: String) {
                showConnectionError()
            }
            // The hosting server answered with an error page (busy, restarting, updating).
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame && response.statusCode >= 500)
                    showConnectionError(both(R.string.error_busy_gu, R.string.error_busy_en))
            }
            // Android may stop the WebView's renderer under memory pressure;
            // start the screen again instead of crashing the app.
            @TargetApi(26)
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                content.removeView(view)
                recreate() // onDestroy() destroys the old WebView
                return true
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
                handler.cancel()
                showConnectionError(both(R.string.error_certificate_gu, R.string.error_certificate_en))
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            // Debug builds only: page errors go to logcat (device tests).
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                if (BuildConfig.DEBUG && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    android.util.Log.w("MVPMIWEB", message.message() + " @" + message.sourceId() + ":" + message.lineNumber())
                return false
            }
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                upload?.onReceiveValue(null)
                upload = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                }
                try { startActivityForResult(intent, 100) }
                catch (_: ActivityNotFoundException) { upload?.onReceiveValue(null); upload = null; message(R.string.no_file_picker_gu, R.string.no_file_picker_en) }
                return true
            }
        }
        // Exports are saved through the mvpmiBridge save sheet (phone or
        // Google Drive); unexpected direct downloads fall back to the browser.
        web.setDownloadListener { _, _, _, _, _ -> message(R.string.open_in_browser_gu, R.string.open_in_browser_en) }
        if (NavigationPolicy.validServer(serverUrl, BuildConfig.DEBUG)) loadServer()
        else showConnectionError(both(R.string.error_not_configured_gu, R.string.error_not_configured_en), retry = false)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun loadServer() {
        if (!NavigationPolicy.validServer(serverUrl, BuildConfig.DEBUG)) return
        errorView?.let { content.removeView(it) }; errorView = null
        web.stopLoading()
        web.loadUrl(serverUrl)
    }

    /** Full-screen "Server not reachable — Retry" state. Shown only when the
     *  page itself cannot load (first start without internet, server down).
     *  Once the app has loaded, the web page shows its own offline banner and
     *  the saved copy of the directory instead. */
    private fun showConnectionError(detail: String = both(R.string.error_offline_gu, R.string.error_offline_en), retry: Boolean = true) {
        if (isFinishing) return
        errorView?.let { content.removeView(it) }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(24), dp(24), dp(24), dp(24))
            setBackgroundColor(Color.rgb(255, 251, 246))
            addView(TextView(this@MainActivity).apply { text = both(R.string.error_title_gu, R.string.error_title_en); textSize = 22f; gravity = Gravity.CENTER; setTextColor(Color.rgb(36, 20, 19)) })
            addView(TextView(this@MainActivity).apply { text = "\n$detail\n"; textSize = 17f; gravity = Gravity.CENTER; setTextColor(Color.rgb(107, 79, 72)) })
            if (retry) addView(Button(this@MainActivity).apply {
                text = getString(R.string.retry_gu) + " · " + getString(R.string.retry_en); textSize = 17f
                setOnClickListener { loadServer() }
            })
        }
        errorView = box; content.addView(box, FrameLayout.LayoutParams(-1, -1))
    }

    private fun route(uri: Uri, mainFrame: Boolean = true): Boolean {
        when (NavigationPolicy.classify(uri.toString(), serverUrl, mainFrame, BuildConfig.DEBUG)) {
            NavigationPolicy.Destination.INTERNAL -> return false
            // Numbers are not copied to the clipboard (other apps could read them).
            NavigationPolicy.Destination.DIAL -> open(Intent(Intent.ACTION_DIAL, uri))
            NavigationPolicy.Destination.WHATSAPP -> open(Intent(Intent.ACTION_VIEW, uri))
            NavigationPolicy.Destination.BLOCKED -> if (mainFrame) message(R.string.link_blocked_gu, R.string.link_blocked_en)
        }
        return true
    }

    private fun navigateBack() {
        // On the connection-error screen, Back leaves the app.
        if (errorView != null) { finish(); return }
        if (backPending) return
        backPending = true
        // The page decides (Section 7). When it does not handle Back (Login,
        // Pending, Lock, the Member Directory home), the app closes: there is
        // no browser history to fall back into, so Back can never reopen an
        // admin screen after logout or the Login screen after logging in.
        web.evaluateJavascript("Boolean(window.mvpmiBack && window.mvpmiBack())") { handled ->
            backPending = false
            if (handled != "true") finish()
        }
    }

    /** Native bar → page (window.mvpmiNav, web/controller.js navGo). */
    private fun webNav(target: String) {
        if (!Regex("[a-z]+").matches(target)) return
        web.evaluateJavascript("window.mvpmiNav && window.mvpmiNav.go('$target')", null)
    }

    /** Room the page leaves at the bottom: the floating bar (when shown) and
     *  the system navigation bar, in CSS px (= dp). */
    private fun pushInsets() {
        if (!::web.isInitialized) return
        val (bar, inset) = lastInsets
        web.evaluateJavascript(
            "(function(r){r.style.setProperty('--native-bar-space','${bar.toInt()}px');" +
                "r.style.setProperty('--native-inset-bottom','${inset.toInt()}px');})(document.documentElement)",
            null,
        )
    }

    /** Status-bar icons: dark on the light splash, light on the brick strip;
     *  navigation-bar icons follow the page theme. */
    private fun applySystemBars() {
        val transparent = Color.TRANSPARENT
        val status = if (showSplash && !navUi.dark) SystemBarStyle.light(transparent, transparent) else SystemBarStyle.dark(transparent)
        val navigation = if (navUi.dark) SystemBarStyle.dark(transparent) else SystemBarStyle.light(transparent, transparent)
        enableEdgeToEdge(statusBarStyle = status, navigationBarStyle = navigation)
    }

    private fun open(intent: Intent) {
        try { startActivity(intent) }
        catch (_: ActivityNotFoundException) { message(R.string.no_app_gu, R.string.no_app_en) }
        catch (_: SecurityException) { message(R.string.policy_blocked_gu, R.string.policy_blocked_en) }
    }
    /** Print an HTML report through the system print sheet — "Save as PDF"
     *  can target phone storage or Google Drive. */
    private fun printReport(title: String, html: String) {
        try {
            val printer = WebView(this)
            printer.settings.javaScriptEnabled = false
            printer.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    val manager = getSystemService(PRINT_SERVICE) as android.print.PrintManager
                    manager.print(title, view.createPrintDocumentAdapter(title), android.print.PrintAttributes.Builder().build())
                    view.postDelayed({ printer.destroy() }, 60000)
                }
            }
            printer.loadDataWithBaseURL(serverUrl, html, "text/html", "utf-8", null)
        } catch (_: Exception) {
            message(R.string.print_unavailable_gu, R.string.print_unavailable_en)
        }
    }

    private fun both(gu: Int, en: Int): String = getString(gu) + "\n" + getString(en)
    private fun message(gu: Int, en: Int) = Toast.makeText(this, getString(gu) + " · " + getString(en), Toast.LENGTH_LONG).show()

    @Deprecated("Required for Android 5 compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 100) {
            upload?.onReceiveValue(if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null)
            upload = null
        }
        if (requestCode == 101 && pendingSave != null) {
            val (name, bytes) = pendingSave!!
            pendingSave = null
            val uri = data?.data
            if (resultCode == RESULT_OK && uri != null) {
                try {
                    val out = contentResolver.openOutputStream(uri) ?: throw java.io.IOException("no output stream")
                    out.use { it.write(bytes) }
                    message(R.string.save_done_gu, R.string.save_done_en)
                } catch (_: Exception) {
                    message(R.string.save_failed_gu, R.string.save_failed_en)
                }
            }
        }
    }
    override fun onResume() {
        super.onResume()
        web.onResume()
        // Deliver anything that arrived while the app was closed.
        pullSoon()
    }
    // Lets the page know it is in the background (starts the 30-second lock).
    override fun onPause() {
        web.onPause()
        // Save the login cookie now: WebView writes cookies to disk only now
        // and then, so a login followed by the app being closed or killed
        // could otherwise be lost (emulator cold-start test, 30 Sep 2026).
        CookieManager.getInstance().flush()
        super.onPause()
    }
    override fun onDestroy() { upload?.onReceiveValue(null); (web.parent as? android.view.ViewGroup)?.removeView(web); web.destroy(); super.onDestroy() }
}
