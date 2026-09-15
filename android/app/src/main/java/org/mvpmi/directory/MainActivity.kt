package org.mvpmi.directory

import android.annotation.TargetApi
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.webkit.*
import android.widget.*
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher

/** Online debug host for the supplied design. Not the finished offline/native app. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var content: FrameLayout
    private var errorView: View? = null
    private var upload: ValueCallback<Array<Uri>>? = null
    private var unregisterBack: (() -> Unit)? = null
    private var backPending = false
    private var serverUrl = BuildConfig.COMMUNITY_URL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG) serverUrl = getPreferences(MODE_PRIVATE).getString("testServer", serverUrl) ?: serverUrl
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(255, 251, 246)) }
        root.setOnApplyWindowInsetsListener { view, insets ->
            @Suppress("DEPRECATION")
            view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            insets
        }
        if (BuildConfig.DEBUG) {
            val bar = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), 0, dp(8), 0) }
            bar.addView(TextView(this).apply { text = "TEST BUILD · Made-up contacts only"; textSize = 11f; setTextColor(Color.rgb(107, 79, 72)) }, LinearLayout.LayoutParams(0, dp(48), 1f))
            bar.addView(Button(this).apply { text = "Server"; contentDescription = "Change test server"; setOnClickListener { configureServer() } })
            root.addView(bar)
        }
        content = FrameLayout(this)
        root.addView(content, LinearLayout.LayoutParams(-1, 0, 1f))
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
            userAgentString += " MVPMlAndroid/0.1"
        }
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
        web.setDownloadListener { _, _, _, _, _ -> message("હાલ બ્રાઉઝરમાં એક્સપોર્ટ કરો · Use your computer browser for exports in this test build") }
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

    private fun showConnectionError(detail: String = "Check that your computer's test server is running. Your phone and computer must use the same Wi-Fi.") {
        if (isFinishing) return
        errorView?.let { content.removeView(it) }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(24), dp(24), dp(24), dp(24))
            setBackgroundColor(Color.rgb(255, 251, 246))
            addView(TextView(this@MainActivity).apply { text = "કનેક્શન થઈ શક્યું નથી\nCould not connect"; textSize = 22f; gravity = Gravity.CENTER })
            addView(TextView(this@MainActivity).apply { text = "\n$detail\n\n$serverUrl\n"; textSize = 15f; gravity = Gravity.CENTER })
            addView(Button(this@MainActivity).apply { text = "Retry"; setOnClickListener { loadServer() } })
            if (BuildConfig.DEBUG) addView(Button(this@MainActivity).apply { text = "Change test server"; setOnClickListener { configureServer() } })
        }
        errorView = box; content.addView(box, FrameLayout.LayoutParams(-1, -1))
    }

    private fun route(uri: Uri, mainFrame: Boolean = true): Boolean {
        when (NavigationPolicy.classify(uri.toString(), serverUrl, mainFrame, BuildConfig.DEBUG)) {
            NavigationPolicy.Destination.INTERNAL -> return false
            NavigationPolicy.Destination.DIAL -> {
                (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager)
                    .setPrimaryClip(ClipData.newPlainText("Phone", uri.schemeSpecificPart))
                open(Intent(Intent.ACTION_DIAL, uri))
            }
            NavigationPolicy.Destination.WHATSAPP -> open(Intent(Intent.ACTION_VIEW, uri))
            NavigationPolicy.Destination.BLOCKED -> { }
        }
        return true
    }

    private fun navigateBack() {
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
    }
    private fun message(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()

    @Deprecated("Required for Android 5 compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 100) {
            upload?.onReceiveValue(if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null)
            upload = null
        }
    }
    @Deprecated("Legacy back handling; API 33+ uses ModernBack")
    override fun onBackPressed() { navigateBack() }
    override fun onDestroy() { unregisterBack?.invoke(); upload?.onReceiveValue(null); web.destroy(); super.onDestroy() }
}
