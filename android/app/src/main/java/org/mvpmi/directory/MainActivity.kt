package org.mvpmi.directory

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.annotation.TargetApi
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import android.webkit.*
import android.widget.Toast

/** Online development host for the unchanged design. Not the finished native/offline app. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var upload: ValueCallback<Array<Uri>>? = null
    private var unregisterBack: (() -> Unit)? = null
    private var backPending = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        // Target 36 draws edge-to-edge; preserve room for the system status/navigation bars.
        web.setOnApplyWindowInsetsListener { view, insets ->
            @Suppress("DEPRECATION")
            view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            insets
        }
        setContentView(web)
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
            // Default SSL error handling cancels; never bypass certificate errors.
            override fun onPageFinished(view: WebView, url: String) { CookieManager.getInstance().flush() }
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
        // Download/print/share need a native Storage Access Framework implementation before release.
        web.setDownloadListener { _, _, _, _, _ -> message("હાલ બ્રાઉઝરમાં એક્સપોર્ટ કરો · Use your browser for exports in this development build") }
        web.loadUrl(BuildConfig.COMMUNITY_URL)
    }

    private fun route(uri: Uri, mainFrame: Boolean = true): Boolean {
        when (NavigationPolicy.classify(uri.toString(), BuildConfig.COMMUNITY_URL, mainFrame)) {
            NavigationPolicy.Destination.INTERNAL -> return false
            NavigationPolicy.Destination.DIAL -> {
                (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager)
                    .setPrimaryClip(ClipData.newPlainText("Phone", uri.schemeSpecificPart))
                open(Intent(Intent.ACTION_DIAL, uri))
            }
            NavigationPolicy.Destination.WHATSAPP -> open(Intent(Intent.ACTION_VIEW, uri))
            NavigationPolicy.Destination.BLOCKED -> { /* Never load an untrusted origin or launch a subframe intent. */ }
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
    @Deprecated("Legacy Android back handling; predictive-back integration remains to be added")
    override fun onBackPressed() { navigateBack() }
    override fun onDestroy() { unregisterBack?.invoke(); upload?.onReceiveValue(null); web.destroy(); super.onDestroy() }
}
