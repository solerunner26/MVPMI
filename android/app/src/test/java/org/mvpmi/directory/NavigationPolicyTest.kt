package org.mvpmi.directory

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test
import org.mvpmi.directory.NavigationPolicy.Destination.*

class NavigationPolicyTest {
    private val base = "https://community.example"
    @Test fun allowsOnlyTheConfiguredHttpsOrigin() {
        assertEquals(INTERNAL, NavigationPolicy.classify("https://community.example/profile", base))
        assertEquals(INTERNAL, NavigationPolicy.classify("https://community.example:443/", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("http://community.example/", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("https://community.example.evil.test/", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("https://community.example:444/", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("https://evil@community.example/", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("javascript:alert(1)", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("file:///sdcard/secret", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("intent://malicious", base))
    }
    @Test fun opensOnlyValidIndianMobileDialerLinks() {
        assertEquals(DIAL, NavigationPolicy.classify("tel:+919000000001", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("tel:*123%23", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("tel:+911234567890", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("tel:+919000000001", base, false))
    }
    @Test fun validatesWhatsAppLinksAndBlocksSubframeIntents() {
        assertEquals(WHATSAPP, NavigationPolicy.classify("https://wa.me/919000000001", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("https://wa.me/919000000001", base, false))
        assertEquals(BLOCKED, NavigationPolicy.classify("https://wa.me/919000000001?redirect=evil", base))
        assertEquals(BLOCKED, NavigationPolicy.classify("https://evil@wa.me/919000000001", base))
    }
    @Test fun privateHttpIsDebugOnlyAndPublicHttpIsAlwaysBlocked() {
        for (base in listOf("http://10.0.2.2:3000", "http://192.168.1.10:3000", "http://127.0.0.1:3000", "http://172.16.0.2:3000")) {
            assertFalse(NavigationPolicy.validServer(base))
            assertTrue(NavigationPolicy.validServer(base, true))
            assertEquals(INTERNAL, NavigationPolicy.classify("$base/api/state", base, true, true))
            assertEquals(BLOCKED, NavigationPolicy.classify("$base/api/state", base))
        }
        for (base in listOf("http://example.com", "http://8.8.8.8", "http://172.32.0.1", "http://192.169.0.1", "https://user:pass@example.com", "https://example.com/path", "https://example.invalid")) {
            assertFalse(NavigationPolicy.validServer(base, true))
        }
    }
}
