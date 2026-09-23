package org.mvpmi.directory

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * System notifications without Firebase or any paid service.
 *
 * The web page gives the app a device token (after sign-in or application).
 * [NotificationJob] then asks the server for new notifications about every
 * 15 minutes whenever the phone has internet, and the app also checks right
 * away when it opens or when the page says something new arrived.
 * Notification text never contains phone numbers.
 */
internal object Notifications {
    private const val PREFS = "mvpmi-notifications"
    private const val CHANNEL = "mvpmi-updates"
    private const val JOB_ID = 4201

    fun save(context: Context, server: String, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("server", server.trimEnd('/'))
            .putString("token", token)
            .apply()
        schedule(context)
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        (context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).cancel(JOB_ID)
    }

    fun schedule(context: Context) {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
        if (scheduler.allPendingJobs.any { it.id == JOB_ID }) return
        val job = JobInfo.Builder(JOB_ID, ComponentName(context, NotificationJob::class.java))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(15 * 60 * 1000L)
            .setPersisted(true)
            .build()
        try { scheduler.schedule(job) } catch (_: Exception) { /* best-effort */ }
    }

    /** Runs on a background thread. Returns false when the check should be retried. */
    fun pull(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val server = prefs.getString("server", null) ?: return true
        val token = prefs.getString("token", null) ?: return true
        if (!NavigationPolicy.validServer(server, BuildConfig.DEBUG)) return true
        var connection: HttpURLConnection? = null
        return try {
            val conn = URL("$server/api/notifications/pull").openConnection() as HttpURLConnection
            connection = conn
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-MVPMI-Device", token)
            conn.setRequestProperty("Accept", "application/json")
            when (conn.responseCode) {
                200 -> {
                    val body = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                    val items = JSONObject(body).optJSONArray("items")
                    if (items != null) for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        show(context, item.optString("id"), item.optString("title"), item.optString("body"))
                    }
                    true
                }
                // The sign-in behind this token has ended; stop checking.
                401 -> { clear(context); true }
                else -> false
            }
        } catch (_: Exception) {
            false
        } finally {
            connection?.disconnect()
        }
    }

    fun show(context: Context, id: String, title: String, text: String) {
        if (title.isBlank()) return
        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(
                    NotificationChannel(CHANNEL, "સમાજ સૂચનાઓ · Community updates", NotificationManager.IMPORTANCE_DEFAULT),
                )
            }
            val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val intent = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val builder = if (Build.VERSION.SDK_INT >= 26)
                Notification.Builder(context, CHANNEL)
            else
                @Suppress("DEPRECATION") Notification.Builder(context)
            val notification = builder
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(text))
                .setContentIntent(intent)
                .setAutoCancel(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .build()
            // A distinct id per event, so notifications never overwrite each other.
            manager.notify(if (id.isBlank()) (title + text).hashCode() else id.hashCode(), notification)
        } catch (_: Exception) {
            /* notifications are best-effort (permission may be off) */
        }
    }
}

/** Periodic background check scheduled by [Notifications.schedule]. */
class NotificationJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        Thread {
            val ok = Notifications.pull(applicationContext)
            jobFinished(params, !ok)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true
}
