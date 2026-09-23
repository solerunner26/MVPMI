package org.mvpmi.directory

import android.annotation.TargetApi
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.text.InputType
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
    private var serverUrl = BuildConfig.COMMUNITY_URL
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
                    message("સેવ કરવાનું શીટ નથી · No save sheet available")
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
        // Community phone numbers must not appear in screenshots, screen
        // recordings or the recent-apps preview.
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        if (BuildConfig.DEBUG) serverUrl = getPreferences(MODE_PRIVATE).getString("testServer", serverUrl) ?: serverUrl
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
        if (BuildConfig.DEBUG) {
            val bar = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), 0, dp(8), 0) }
            bar.addView(TextView(this).apply { text = "TEST BUILD · Made-up contacts only"; textSize = 11f; setTextColor(Color.rgb(107, 79, 72)) }, LinearLayout.LayoutParams(0, dp(48), 1f))
            bar.addView(Button(this).apply { text = "Server"; contentDescription = "Change test server"; setOnClickListener { configureServer() } })
            root.addView(bar)
        }
        content = FrameLayout(this).apply { setBackgroundColor(Color.rgb(255, 251, 246)) }
        root.addView(content, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(navigationBar, LinearLayout.LayoutParams(-1, 0))
        web = WebView(this)
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
                    showConnectionError("સર્વર થોડી વાર માટે ઉપલબ્ધ નથી. થોડી મિનિટ પછી ફરી પ્રયાસ કરો.\nThe server is busy or restarting. Please try again in a few minutes.")
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
                handler.cancel()
                showConnectionError("The server certificate is not trusted. Use a valid HTTPS server or the debug-only local computer address.")
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
                catch (_: ActivityNotFoundException) { upload?.onReceiveValue(null); upload = null; message("ફાઇલ પસંદ કરી શકાતી નથી · No file picker available") }
                return true
            }
        }
        // Exports are saved through the mvpmiBridge save sheet (phone or
        // Google Drive); unexpected direct downloads fall back to the browser.
        web.setDownloadListener { _, _, _, _, _ -> message("બ્રાઉઝરમાં ખોલો · Open this link in a browser") }
        if (NavigationPolicy.validServer(serverUrl, BuildConfig.DEBUG)) loadServer()
        else if (BuildConfig.DEBUG) configureServer()
        else showConnectionError("The application server is not configured.")
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun loadServer() {
        if (!NavigationPolicy.validServer(serverUrl, BuildConfig.DEBUG)) return
        errorView?.let { content.removeView(it) }; errorView = null
        web.stopLoading()
        web.loadUrl(serverUrl)
    }

    private fun configureServer() {
        if (!BuildConfig.DEBUG) return
        val initialValid = NavigationPolicy.validServer(serverUrl, true)
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            hint = "http://10.0.2.2:3000"
            if (initialValid) setText(serverUrl)
            contentDescription = "Test server address"
        }
        val wrapper = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(8), dp(24), 0)
            addView(TextView(this@MainActivity).apply {
                text = "Start the test server on your computer first.\n\nEmulator: http://10.0.2.2:3000\nPhone: use the Wi-Fi address printed by the server.\n\nUse only made-up contacts. The Arena preview URL cannot be used here."
            })
            addView(input)
        }
        val dialog = AlertDialog.Builder(this).setTitle("MVPMl test server")
            .setView(wrapper).setPositiveButton("Connect", null)
            .setNegativeButton("Cancel") { _, _ -> if (!initialValid) finish() }
            .setCancelable(initialValid).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val next = input.text.toString().trim().trimEnd('/')
                if (!NavigationPolicy.validServer(next, true)) {
                    input.error = "Enter an HTTPS server, or a local computer HTTP address such as http://192.168.1.10:3000"
                } else {
                    serverUrl = next
                    getPreferences(MODE_PRIVATE).edit().putString("testServer", serverUrl).apply()
                    dialog.dismiss(); loadServer()
                }
            }
        }
        dialog.show()
    }

    private fun showConnectionError(detail: String = if (BuildConfig.DEBUG)
            "Check that your computer's test server is running. Your phone and computer must use the same Wi-Fi."
        else
            "ઇન્ટરનેટ કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.\nCheck your internet connection and try again.") {
        if (isFinishing) return
        errorView?.let { content.removeView(it) }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(24), dp(24), dp(24), dp(24))
            setBackgroundColor(Color.rgb(255, 251, 246))
            addView(TextView(this@MainActivity).apply { text = "કનેક્શન થઈ શક્યું નથી\nCould not connect"; textSize = 22f; gravity = Gravity.CENTER })
            addView(TextView(this@MainActivity).apply { text = if (BuildConfig.DEBUG) "\n$detail\n\n$serverUrl\n" else "\n$detail\n"; textSize = 17f; gravity = Gravity.CENTER })
            addView(Button(this@MainActivity).apply { text = "ફરી પ્રયાસ કરો · Retry"; textSize = 17f; setOnClickListener { loadServer() } })
            if (BuildConfig.DEBUG) addView(Button(this@MainActivity).apply { text = "Change test server"; setOnClickListener { configureServer() } })
        }
        errorView = box; content.addView(box, FrameLayout.LayoutParams(-1, -1))
    }

    private fun route(uri: Uri, mainFrame: Boolean = true): Boolean {
        when (NavigationPolicy.classify(uri.toString(), serverUrl, mainFrame, BuildConfig.DEBUG)) {
            NavigationPolicy.Destination.INTERNAL -> return false
            // Numbers are not copied to the clipboard (other apps could read them).
            NavigationPolicy.Destination.DIAL -> open(Intent(Intent.ACTION_DIAL, uri))
            NavigationPolicy.Destination.WHATSAPP -> open(Intent(Intent.ACTION_VIEW, uri))
            NavigationPolicy.Destination.BLOCKED -> if (mainFrame) message("આ લિંક ખોલી શકાતી નથી · This link cannot be opened")
        }
        return true
    }

    private fun navigateBack() {
        // On the connection-error screen, Back leaves the app.
        if (errorView != null) { finish(); return }
        if (backPending) return
        backPending = true
        web.evaluateJavascript("Boolean(window.mvpmiBack && window.mvpmiBack())") { handled ->
            backPending = false
            if (handled != "true") { if (web.canGoBack()) web.goBack() else finish() }
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
        catch (_: ActivityNotFoundException) { message("એપ ઉપલબ્ધ નથી · No compatible app is installed") }
        catch (_: SecurityException) { message("ઉપકરણની નીતિએ એપ ખોલવા દીધી નથી · Device policy blocked opening this app") }
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
            message("પ્રિન્ટ ઉપલબ્ધ નથી · Printing is unavailable")
        }
    }

    private fun message(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()

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
                    message("સેવ થઈ: $name · Saved")
                } catch (_: Exception) {
                    message("સેવ ન થઈ · Could not save the file")
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
