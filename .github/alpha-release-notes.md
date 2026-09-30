**Alpha 3 test build (v1.2.0-alpha.3: alpha 2 plus a lock-screen fix; server install fixed)** of the Mahuva Kshatriya Rajput Samaj community directory. For invited testers only.

- **mvpmi.apk** — install on Android phones (Android 10 or newer). It connects to https://samaj.kavigsv.com.
- **BUILD-INFO.txt** — version, server and signed / test build. This is a test-signed build: **uninstall the previous alpha first**.
- **SHA256SUMS.txt** — checksum to verify the download.

Fixed since alpha 1: names no longer run under the Call/WhatsApp buttons at large text; Backup & export on Android now opens the save sheet; a failed change/removal proposal keeps what you typed; the review panel no longer redraws itself while idle; the search box gets the whole line while searching; Settings labels aligned; smaller review tabs; English cards say "Location:". Also fixed: blank screen on phones with an old Android System WebView; a login lost when the app was closed right after logging in; the notification permission question appearing on the Login screen. Login by mobile number is unchanged.

Tested: 138 server tests, 175 browser checks, and Android emulator tests on API 29, 33 and 36 (see the CI run for details and what is not covered).
