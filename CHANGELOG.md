# Changelog

## 1.3.0 — alpha 5 (3 October 2026)

- Community renamed: Mahuva Vala Rajput Samaj / મહુવા વાળા રાજપૂત સમાજ; app
  name on the phone (launcher, web app) વાળા સમાજ.
- Names and current location are stored in both scripts: typed in Gujarati
  → English spelling added, typed in English → Gujarati added (offline
  transliteration with a word list of local names, surnames and places).
  Existing records are filled in at start-up; typed values are kept; old
  backups still restore. The app shows each in the selected language.
- Sign out moved from Settings to My Profile → Options (last item).
- Bottom bar: Search label sits right under its button (app and web);
  theme label in Gujarati is "કલર".
- Release pipeline: official tags build the signed APK + Play bundle with a
  versioned file name, run the emulator tests first, then publish.

## 1.3.0 — alpha 4 (2 October 2026)

- Tile suns (and the member-card watermark) no longer rotate: the admin
  screens flickered on phones.
- Admin panels (legacy .noscroll scroller) reserve room for the bottom bar,
  so the last tiles scroll fully clear of it (browser and app).
- Native bar: the glass is a separate clipped layer behind the tabs, so the
  raised centre Search button is never cut at the top.

## 1.3.0 — alpha 3 (2 October 2026)

- Logo: the embossed 3D sun cut out on its own (no disc or ring) for every
  in-app use and the splash; the launcher icon is the full embossed square.
- One palette: green removed everywhere (row Call/WhatsApp icons, own name,
  success notes, legacy WhatsApp button); own name deep saffron, admins brick.
- Sun logo in the directory header opens the splash (native) or the same
  darshan page in browsers; Enter or Back returns.
- My Profile rebuilt on the Member Details card; actions as a menu card.
- Spacing: text-size card, admin tiles (no hollow middle), notifications card.

## 1.3.0 — alpha 2 (2 October 2026)

- New community sun logo ("community logo 2") for the launcher icon, web
  icons, header, login, splash and member page.
- Member details: full page with sun-crowned card (both names, role, Call /
  WhatsApp in brick and saffron, numbers, native village, current residence,
  "see all members from this village").
- Pending approval: the turning "waiting sun" with hourglass is back.
- Android: the page no longer reserves the camera-cutout area a second time
  (empty band above the community name on Pixel phones).
- Download: the server always offers the APK of the version it runs (it
  syncs it from the release on start); file name and page show version and
  build; Settings shows version and build.
- Browser glass bar more opaque for legibility; native bar has a frosted base.
- CI: emulator tests run on demand only and no longer gate alpha releases.

## 1.3.0 — alpha 1 (2 October 2026)

- **Native shell (Android, Jetpack Compose):** splash screen at start (deity
  arch, turning sun medallion, one-line community name, member counts,
  "Enter Directory" button, admin contacts); the app opens only from its
  button. Back on the splash leaves the app.
- **Bottom navigation bar:** floating glass capsule (Material 3
  NavigationBar + live blur via Haze on Android 12+, tinted glass on 10–11):
  Profile · Settings/Admin · Search (raised, centre) · Theme · Language.
  Outlined icons when inactive, filled in a rounded pill when active, spring
  motion, haptics, above the system navigation bar. Hidden on the splash,
  with the keyboard open and under sheets. Browsers get the same bar in CSS.
- **Directory header:** line 1 sun logo + community name (always one line),
  line 2 the search box, line 3 village chips (always visible). The filter
  icon and the header icon row are removed (they moved to the bottom bar).
- **Sun symbol** is the launcher icon, web icons, favicon and logo.
- Tests: new NativeShellTest on API 29/33/36; browser e2e updated (178).

## 1.2.0 — alpha 3 (30 September 2026)

- alpha 2 could not be installed on the server (esbuild was a development-only package; the server installs runtime packages only).
- "Forgot PIN?" → "Sign out of this phone?" closed itself after a few seconds on the lock screen; it now stays until answered.

## 1.2.0 — alpha 2 (30 September 2026)

Fixes from the v1.2.0-alpha.1 release test report (owner-approved; login by
mobile number is unchanged by decision).

- **Names never under Call/WhatsApp** at any text size (85–165%) or phone
  width; long names wrap to two lines, then "…".
- **Android export works:** Backup & export now opens the phone's "save as"
  sheet (it silently did nothing); a location that cannot be written says
  "Save failed" instead of "Saved".
- **Failed proposals keep your typing:** if sending a change or removal
  proposal fails, the form and reason stay for another try. Enable/Disable
  Village Admin no longer says "done" when it failed.
- **Battery:** the review panel no longer redraws itself 60 times a second
  while idle.
- **Header:** tapping search gives the box the whole line; the placeholder
  ("Search") is never cut; the community name always fits.
- Settings labels line up after their icons; review tabs are smaller (icon
  beside the label, two per row for the Main Admin); text-size Reset is a
  small button; English cards say "Location:".
- **Found by the new Android emulator tests, fixed:**
  - Phones with an old Android System WebView (e.g. version 74 on Android 10
    that was never updated) showed a blank screen; every WebView older than
    103 could not reach the server. Scripts are now compiled for older
    WebViews and two too-new browser features have safe replacements
    (verified in Chromium 74 and on the Android 10 emulator).
  - A login could be lost if the app was closed or killed soon after logging
    in: the login cookie is now saved whenever the app goes to the background.
  - Android 13+ asked for notification permission on the Login screen at
    first launch; it now asks only after login or registration.
- **Testing:** new browser regression flow (overlap at every size, failed
  requests, export path, idle loop, old-WebView requests) and real Android
  emulator tests on API 29, 33 and 36 (docs/ANDROID_DEVICE_TESTS.md); the
  alpha release now waits for them.

## 1.2.0 — alpha 1 (30 September 2026)

- **No PIN to log in.** Members and Village Admins log in with their mobile
  number only (also on a new phone). Only the Main Admin has a password:
  any 4+ characters, offered to Google Password Manager.
- **Optional phone PIN** only inside My Profile (off by default, never
  forced, forgot = sign out and in again, no admin needed). The app never
  locks or hides itself unless this is on; screenshots are blocked only then.
- **Approvals:** errors show in a banner at the top with the real reason;
  Save correction and Final approval work; the page explains why Final
  approval is off and who the Village Admin is.
- **Directory:** new 3-line header (logo, name, search / Filter, My Profile,
  Admin Tools, Dark theme, Language / village chips). "You" removed; own name
  green, admins red. Language and theme moved out of Settings.
- Text size has a Reset (100%). Manage Village Admins uses a village drop-down.
- **Hand-over:** `sudo mvpmi-config clear-directory` deletes all contacts and
  keeps only the Main Admin login.

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
