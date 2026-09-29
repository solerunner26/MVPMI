package org.mvpmi.directory

import android.annotation.TargetApi
import android.app.Activity
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
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher

/** Android host for the hosted community directory (online WebView app). */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var content: FrameLayout
    private var errorView: View? = null
    private var upload: ValueCallback<Array<Uri>>? = null
    private var unregisterBack: (() -> Unit)? = null
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
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(36, 20, 19)) }
        // Android 15+ always draws edge-to-edge: coloured bars sit behind the
        // status and navigation icons so the (white) icons stay visible.
        val statusBar = View(this).apply { setBackgroundColor(Color.rgb(178, 64, 44)) }
        val navigationBar = View(this).apply { setBackgroundColor(Color.rgb(36, 20, 19)) }
        root.setOnApplyWindowInsetsListener { view, insets ->
            @Suppress("DEPRECATION")
            view.setPadding(insets.systemWindowInsetLeft, 0, insets.systemWindowInsetRight, 0)
            @Suppress("DEPRECATION")
            statusBar.layoutParams = LinearLayout.LayoutParams(-1, insets.systemWindowInsetTop)
            @Suppress("DEPRECATION")
            navigationBar.layoutParams = LinearLayout.LayoutParams(-1, insets.systemWindowInsetBottom)
            insets
        }
        root.addView(statusBar, LinearLayout.LayoutParams(-1, 0))
        content = FrameLayout(this).apply { setBackgroundColor(Color.rgb(255, 251, 246)) }
        root.addView(content, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(navigationBar, LinearLayout.LayoutParams(-1, 0))
        web = WebView(this)
        // Lets the phone's password manager (Google Password Manager) offer to
        // save the Main Admin's password; members have no password.
        web.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
        content.addView(web, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        if (Build.VERSION.SDK_INT >= 33) unregisterBack = ModernBack.register(this) { navigateBack() }
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            userAgentString += " MVPMlAndroid/" + BuildConfig.VERSION_NAME
        }
        web.addJavascriptInterface(Bridge(), "mvpmiBridge")
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.webViewClient = object : WebViewClient() {
            @Deprecated("Required for Android 5 and 6")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = route(Uri.parse(url))
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = route(request.url, request.isForMainFrame)
            override fun onPageFinished(view: WebView, url: String) { CookieManager.getInstance().flush() }
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

    @TargetApi(33)
    private object ModernBack {
        fun register(activity: Activity, action: () -> Unit): () -> Unit {
            val callback = OnBackInvokedCallback { action() }
            activity.onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
            return { activity.onBackInvokedDispatcher.unregisterOnBackInvokedCallback(callback) }
        }
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
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    message(R.string.save_done_gu, R.string.save_done_en)
                } catch (_: Exception) {
                    message(R.string.save_failed_gu, R.string.save_failed_en)
                }
            }
        }
    }
    @Deprecated("Legacy back handling; API 33+ uses ModernBack")
    override fun onBackPressed() { navigateBack() }
    override fun onResume() {
        super.onResume()
        web.onResume()
        // Deliver anything that arrived while the app was closed.
        pullSoon()
    }
    // Lets the page know it is in the background (starts the 30-second lock).
    override fun onPause() {
        web.onPause()
        super.onPause()
    }
    override fun onDestroy() { unregisterBack?.invoke(); upload?.onReceiveValue(null); web.destroy(); super.onDestroy() }
}
