# Changelog

## 1.1.0 — alpha (September 2026)

- Owner decisions (28 Sep): the seeded Main Admin password works for the
  first login only, then he must set his own; a Village Admin's TEMP PIN
  stays on their card for the Main Admin (Call / WhatsApp) until their first
  login. The app keeps the word "PIN".

Full audit and rework for the alpha with real users (fresh start: the old
database is not carried over).

- **Terms:** PASSWORD (Main Admin), PIN (4 digits, login + app lock), TEMP
  PIN (one login, shared by WhatsApp); roles MAIN_ADMIN, VILLAGE_ADMIN,
  MEMBER; statuses PENDING, APPROVED, REJECTED, REMOVED.
- **Server address** built into the app per build type; the "Server" button
  and test banner are gone. Offline: app shell cached, saved directory copy
  with "Last updated", Retry without restarting.
- **Main Admin** seeded once from a server-only config file (bcrypt hash);
  mobile + password login; My Profile with Change Password; server-only
  reset script. The hidden sun-logo gate, access code and recovery code are
  removed.
- **Village Admins** created, edited, disabled, enabled and reset by the
  Main Admin; TEMP PIN with "Share on WhatsApp"; forced "Set new PIN";
  village-scoped review; rejections need a reason.
- **Registration:** server checks the number (member / pending / rejected /
  removed / new); consent checkbox; "Already Member?" removed; "Forgot PIN?"
  asks the village admin for a TEMP PIN.
- **App lock:** same PIN as the login; optional for members (default off),
  always on for admins; locks after ≥1 minute in the background; easy PINs
  refused; 5 wrong → 5-minute lockout with countdown; optional fingerprint.
- **Feedback** for every PIN/password change case, in Gujarati and English.
- **Navigation:** Back works on every screen; "Discard changes?"; admin edit
  → Save returns to the list with "Saved"; logout / login clear the stack;
  "Log out" of admin keeps the member logged in.
- **Directory redesign:** slim top bar, 3-character search (name, number,
  village, taluka, district), optional village chips, compact 64 dp rows
  with Call and WhatsApp (8+ contacts on a 6-inch phone), details sheet,
  My Profile inside Settings.
- **Android:** minimum Android 10; native messages in Gujarati/English
  string resources.
- **Tests:** new end-to-end suite (`npm run test:e2e`) replaces the old
  browser tests.

## 1.0.0 — 27 September 2026 (first public release)

- Live server on a Google Cloud e2-micro VM with automatic HTTPS, nightly
  backups (local + encrypted Google Drive copy) and automatic updates to
  tested GitHub releases.
- Google Drive backup: admin → Backup & export → Connect Google Drive.
  Uses the `drive.file` permission only; backups are AES-256 encrypted.
- Privacy policy (`/privacy`), account-deletion page (`/delete-account`)
  and app download page (`/download`) — needed for Google Play.
- Faster loading: 10 MB → 2.4 MB site, first page 518 KB → 87 KB
  (Brotli), unused icons and font files removed, long browser caching.
- Android: signed APK and Play-ready AAB from CI, version name from the
  release tag, recovery when Android stops the WebView renderer.
- Repository cleanup: design-tool leftovers, demo data seeder, demo logins
  and outdated reports removed.

## 0.6.0 — Liquid Glass precision pass

No clipped or overlapping text; uniform controls in light and dark; tab
bar with icons; layout audit tool.

## 0.5.0 — iOS-style Liquid Glass design

## 0.4.0 — Full audit fixes, server-enforced PIN lock, notifications
