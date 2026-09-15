package org.mvpmi.directory

import org.junit.Assert.assertEquals
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
}
