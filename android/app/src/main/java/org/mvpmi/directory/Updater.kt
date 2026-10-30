package org.mvpmi.directory

import android.app.DownloadManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Must-update (owner, 21 Oct 2026; background download 30 Oct 2026). The
 * server says which build is current (GET /api/app-version). When it is newer
 * than this app, the app shows a full-screen update page that cannot be
 * skipped. The new APK is downloaded by Android's own download service, so it
 * keeps going when the app is minimised (progress in the notification shade).
 * When it is ready the person is notified; Android's own Install screen
 * follows, and after the update a notification says the app is ready to use.
 * The login and everything else on the phone are kept (same key, same app).
 */
object Updater {
    data class Info(val build: Int, val version: String, val url: String)
    data class Status(val state: Int, val progress: Float, val file: File?)

    const val NONE = 0
    const val RUNNING = 1
    const val DONE = 2
    const val FAILED = 3
    const val EXTRA_INSTALL = "mvpmi_install_update"

    private const val PREFS = "mvpmi-updater"
    private const val CHANNEL = "mvpmi-app-update"

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

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun dm(context: Context) = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private fun dir(context: Context) = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir, "").apply { mkdirs() }
    private fun fileFor(context: Context, build: Int) = File(dir(context), "mvpmi-update-$build.apk")

    /** Starts (or keeps) the background download of [info]. */
    fun start(context: Context, info: Info) {
        val p = prefs(context)
        val known = p.getLong("id", -1L)
        if (known >= 0 && p.getInt("build", 0) == info.build) {
            val s = status(context, info.build)
            if (s.state == RUNNING || s.state == DONE) return
            dm(context).remove(known)
        }
        val target = fileFor(context, info.build)
        target.delete()
        val request = DownloadManager.Request(Uri.parse(info.url))
            .setTitle("વાળા સમાજ · નવું અપડેટ")
            .setDescription("Downloading the new version · નવી આવૃત્તિ ડાઉનલોડ થાય છે")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, target.name)
            .setMimeType("application/vnd.android.package-archive")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)
            .addRequestHeader("X-MVPMI-Client", "1")
        val id = dm(context).enqueue(request)
        p.edit().putLong("id", id).putInt("build", info.build).putString("version", info.version).apply()
    }

    /** Where the download of [build] is: running (with progress), done or failed. */
    fun status(context: Context, build: Int): Status {
        val p = prefs(context)
        val id = p.getLong("id", -1L)
        if (id < 0 || p.getInt("build", 0) != build) return Status(NONE, 0f, null)
        dm(context).query(DownloadManager.Query().setFilterById(id))?.use { c ->
            if (!c.moveToFirst()) return Status(NONE, 0f, null)
            val st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            val progress = if (total > 0) done.toFloat() / total else -1f
            return when (st) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    val f = fileFor(context, build)
                    if (f.length() > 100_000) Status(DONE, 1f, f) else Status(FAILED, 0f, null)
                }
                DownloadManager.STATUS_FAILED -> Status(FAILED, 0f, null)
                else -> Status(RUNNING, progress, null)
            }
        }
        return Status(NONE, 0f, null)
    }

    fun downloadId(context: Context) = prefs(context).getLong("id", -1L)
    fun pendingBuild(context: Context) = prefs(context).getInt("build", 0)

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
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
        context.startActivity(intent)
    }

    /** After the update: forget the download and remove the old file. */
    fun cleanUp(context: Context) {
        val p = prefs(context)
        val id = p.getLong("id", -1L)
        if (id >= 0) try { dm(context).remove(id) } catch (_: Exception) {}
        p.edit().clear().apply()
        dir(context).listFiles()?.filter { it.name.startsWith("mvpmi-update-") }?.forEach { it.delete() }
    }

    fun notify(context: Context, id: Int, title: String, text: String, install: Boolean) {
        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26)
                manager.createNotificationChannel(NotificationChannel(CHANNEL, "એપ અપડેટ · App update", NotificationManager.IMPORTANCE_HIGH))
            val open = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (install) open.putExtra(EXTRA_INSTALL, true)
            val pi = PendingIntent.getActivity(context, 40 + id, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(context)
            manager.notify(
                id,
                b.setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setStyle(Notification.BigTextStyle().bigText(text))
                    .setContentIntent(pi)
                    .setAutoCancel(true)
                    .build(),
            )
        } catch (_: Exception) {
            /* best-effort (notifications may be off) */
        }
    }

    fun clearNotification(context: Context, id: Int) =
        try { (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(id) } catch (_: Exception) {}

    const val NOTE_READY = 7101
    const val NOTE_UPDATED = 7102
}

/**
 * Download finished (also while the app is minimised or closed): tell the
 * person the update is ready to install. After Android has installed the new
 * version: tell them the app is ready to use.
 */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            DownloadManager.ACTION_DOWNLOAD_COMPLETE -> {
                val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
                if (id < 0 || id != Updater.downloadId(context)) return
                val s = Updater.status(context, Updater.pendingBuild(context))
                if (s.state == Updater.DONE)
                    Updater.notify(
                        context, Updater.NOTE_READY,
                        "અપડેટ તૈયાર છે · Update ready",
                        "ઇન્સ્ટોલ કરવા અહીં દબાવો. · Tap to install the new version.",
                        install = true,
                    )
            }
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Updater.clearNotification(context, Updater.NOTE_READY)
                Updater.cleanUp(context)
                Updater.notify(
                    context, Updater.NOTE_UPDATED,
                    "એપ અપડેટ થઈ ગઈ · App updated",
                    "નવી આવૃત્તિ વાપરવા તૈયાર છે. · The new version is ready to use.",
                    install = false,
                )
            }
        }
    }
}
