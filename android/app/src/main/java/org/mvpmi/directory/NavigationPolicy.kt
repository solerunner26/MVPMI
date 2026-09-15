package org.mvpmi.directory

import java.net.URI

/** Pure policy: test without launching intents or granting device permissions. */
internal object NavigationPolicy {
    enum class Destination { INTERNAL, DIAL, WHATSAPP, BLOCKED }

    fun classify(raw: String, base: String, mainFrame: Boolean = true): Destination {
        return try {
            val uri = URI(raw)
            val origin = URI(base)
            val sameOrigin = uri.scheme == "https" && origin.scheme == "https" &&
                uri.host != null && uri.host.equals(origin.host, ignoreCase = true) &&
                uri.rawUserInfo == null && origin.rawUserInfo == null && port(uri) == port(origin)
            when {
                sameOrigin -> Destination.INTERNAL
                !mainFrame -> Destination.BLOCKED
                uri.scheme == "tel" && Regex("\\+91[6-9][0-9]{9}").matches(uri.rawSchemeSpecificPart) -> Destination.DIAL
                uri.scheme == "https" && uri.host == "wa.me" && uri.rawUserInfo == null && port(uri) == 443 &&
                    uri.rawQuery == null && uri.rawFragment == null && Regex("/91[6-9][0-9]{9}").matches(uri.rawPath ?: "") -> Destination.WHATSAPP
                else -> Destination.BLOCKED
            }
        } catch (_: Exception) { Destination.BLOCKED }
    }
    private fun port(uri: URI): Int = if (uri.port == -1) 443 else uri.port
}
