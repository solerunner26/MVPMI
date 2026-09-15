package org.mvpmi.directory

import java.net.URI

/** Keep cleartext private-network access strictly opt-in for debug builds. */
internal object NavigationPolicy {
    enum class Destination { INTERNAL, DIAL, WHATSAPP, BLOCKED }

    fun validServer(raw: String, allowLocalHttp: Boolean = false): Boolean = try {
        val uri = URI(raw)
        uri.host != null && uri.host != "example.invalid" && uri.rawUserInfo == null &&
            uri.rawQuery == null && uri.rawFragment == null && (uri.rawPath.isNullOrEmpty() || uri.rawPath == "/") &&
            (uri.port == -1 || uri.port in 1..65535) &&
            (uri.scheme == "https" || (allowLocalHttp && uri.scheme == "http" && isPrivateHost(uri.host)))
    } catch (_: Exception) { false }

    private fun isPrivateHost(host: String): Boolean {
        if (host == "localhost") return true
        val parts = host.split('.').map { it.toIntOrNull() ?: return false }
        if (parts.size != 4 || parts.any { it !in 0..255 }) return false
        return parts[0] == 10 || parts[0] == 127 ||
            (parts[0] == 192 && parts[1] == 168) ||
            (parts[0] == 172 && parts[1] in 16..31)
    }

    fun classify(raw: String, base: String, mainFrame: Boolean = true, allowLocalHttp: Boolean = false): Destination {
        return try {
            val uri = URI(raw)
            val origin = URI(base)
            val sameOrigin = validServer(base, allowLocalHttp) && uri.scheme == origin.scheme &&
                uri.host != null && uri.host.equals(origin.host, ignoreCase = true) &&
                uri.rawUserInfo == null && port(uri) == port(origin)
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
    private fun port(uri: URI): Int = if (uri.port != -1) uri.port else if (uri.scheme == "https") 443 else 80
}
