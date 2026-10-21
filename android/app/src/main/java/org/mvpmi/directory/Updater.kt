package org.mvpmi.directory

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Must-update (owner, 21 Oct 2026). The server says which build is current
 * (GET /api/app-version). When it is newer than this app, the app shows a
 * full-screen update page that cannot be skipped: it downloads the new APK
 * from the community server and opens Android's own Install screen. The login
 * and everything else on the phone are kept (same signing key, same app).
 */
object Updater {
    data class Info(val build: Int, val version: String, val url: String)

    /** Network call: run off the main thread. null = up to date (or unknown). */
    fun check(server: String, currentBuild: Int): Info? {
        val c = URL("$server/api/app-version").openConnection() as HttpURLConnection
        return try {
            c.connectTimeout = 8000
            c.readTimeout = 8000
            c.setRequestProperty("X-MVPMI-Client", "1")
            c.setRequestProperty("Accept", "application/json")
            if (c.responseCode != 200) return null
            val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
            val build = j.optInt("build", 0)
            val path = j.optString("url", "")
            if (build <= currentBuild || path.isBlank()) null
            else Info(build, j.optString("version", ""), if (path.startsWith("https://")) path else server + path)
        } catch (_: Exception) {
            null
        } finally {
            c.disconnect()
        }
    }

    fun apkFile(context: Context): File = File(File(context.cacheDir, "updates").apply { mkdirs() }, "mvpmi-update.apk")

    /** Downloads to the app cache; [progress] gets 0..1 (or -1 when the size is unknown). */
    fun download(context: Context, info: Info, progress: (Float) -> Unit): File {
        val target = apkFile(context)
        val part = File(target.parentFile, "mvpmi-update.part")
        var url = URL(info.url)
        // Follow redirects ourselves (the server may send the phone to GitHub).
        repeat(5) {
            val c = url.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 15000
            c.readTimeout = 30000
            c.setRequestProperty("X-MVPMI-Client", "1")
            try {
                val code = c.responseCode
                if (code in 300..399) {
                    val next = c.getHeaderField("Location") ?: error("redirect without location")
                    url = URL(url, next)
                    if (url.protocol != "https") error("insecure download")
                    return@repeat
                }
                if (code != 200) error("HTTP $code")
                val total = c.contentLengthLong
                var done = 0L
                c.inputStream.use { input ->
                    part.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            done += n
                            progress(if (total > 0) done.toFloat() / total else -1f)
                        }
                    }
                }
                if (done < 100_000) error("download too small")
                if (!part.renameTo(target)) { target.delete(); part.renameTo(target) }
                return target
            } finally {
                c.disconnect()
            }
        }
        error("too many redirects")
    }

    /** true = Android may install from this app; otherwise opens the setting for it. */
    fun canInstall(context: Context): Boolean = context.packageManager.canRequestPackageInstalls()

    fun openInstallPermission(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.packageName))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    fun install(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".photos", apk)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
        context.startActivity(intent)
    }
}
