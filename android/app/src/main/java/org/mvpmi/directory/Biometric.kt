package org.mvpmi.directory

import android.app.Activity
import android.content.Context
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import java.security.SecureRandom

/** Optional fingerprint unlock (Section 5), using only the phone's own
 *  biometric system (android.hardware.biometrics, Android 10+). */
internal object Biometric {
    private const val PREFS = "mvpmi-biometric"

    fun available(context: Context): Boolean = try {
        val manager = context.getSystemService(BiometricManager::class.java)
        val status = if (Build.VERSION.SDK_INT >= 30)
            manager?.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        else legacyStatus(manager)
        status == BiometricManager.BIOMETRIC_SUCCESS
    } catch (_: Exception) { false }

    @Suppress("DEPRECATION")
    private fun legacyStatus(manager: BiometricManager?): Int? = manager?.canAuthenticate()

    /** The random device key released after a successful fingerprint. */
    fun key(context: Context, create: Boolean): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = prefs.getString("key", null)
        if (saved != null && Regex("[a-f0-9]{64}").matches(saved)) return saved
        if (!create) return ""
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        val fresh = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
        prefs.edit().putString("key", fresh).apply()
        return fresh
    }

    fun forget(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    fun prompt(activity: Activity, title: String, cancel: String, done: (Boolean) -> Unit) {
        var finished = false
        val finish = { ok: Boolean -> if (!finished) { finished = true; done(ok) } }
        try {
            val prompt = BiometricPrompt.Builder(activity)
                .setTitle(title)
                .setNegativeButton(cancel, activity.mainExecutor) { _, _ -> finish(false) }
                .build()
            prompt.authenticate(
                CancellationSignal(),
                activity.mainExecutor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { finish(true) }
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { finish(false) }
                },
            )
        } catch (_: Exception) {
            finish(false)
        }
    }
}
