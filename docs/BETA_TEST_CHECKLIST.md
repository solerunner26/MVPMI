# Beta test checklist — v0.3.0 (admin redesign, reports, notifications)

## What changed in v0.3.0 (twelve items)

Design uniformity:

1. New-registration form: every control now shares one border and one
   background (the father's-name field had a stray ink-coloured line;
   the locked tehsil/district fields had a different border). Both themes.
2. Admin login / password-reset cards sit on the page background colour
   instead of a pale pure-white slab. Both themes.
3. Tiles everywhere (admin dashboard, backup exports, village list, Total
   members): the red brand stripe now appears on hover/keyboard focus for
   every tile — not only the first — and pressing a tile gives a 3D
   pressed-block effect. The stripe is a real element so screen-reader and
   contrast tooling stays accurate.

Admin dashboard redesign:

4. Tiles are grouped by activity: New/Update/Delete requests are clubbed
   under one **Requests** tile (all three lists with headings and counts on
   one screen). New **Reports** and **Notifications** tiles join
   Total members, Members, Backup, Archive and Security — eight tiles.
5. **Total members** now shows a village tile per village with its member
   count; tapping a village lists its members; "Back to village list"
   returns. The fixed tehsil/district sections and the "7 villages · 1
   tehsil · 1 district" counters are removed.
6. **Archive** lists tagged sections — Removed members, Rejected
   applications, Closed/withdrawn applications — each with counts, plus
   Download PDF and Download CSV buttons.
7. **Reports** tile: six reports (Full report, Members directory, Village
   summary, Pending requests, Rejected/closed, Activity log), each as PDF
   (system print sheet → Save as PDF) and CSV (opens in Excel/Sheets).

Exports and backup:

8. CSV export added (UTF-8 BOM so Gujarati opens correctly in Excel).
   On Android, saving any file (CSV, Excel, JSON backup) or printing a
   PDF opens the system sheet where the main admin picks **phone memory
   or Google Drive** — two taps, no technical setup. (Direct Google Drive
   API sync would need your own Google Cloud project and OAuth keys; the
   system picker achieves the same with zero setup.)
9. The Android app no longer blocks downloads (the old test build showed
   "use your computer browser"). New bridge: `mvpmiBridge` with
   saveFile / printHtml / notify.

Notifications:

10. **Notifications** tile + header bell for the main admin; Notifications
    tab for village admins. Pending requests, applications waiting for
    village verification, rejected-number warnings and security alerts
    stay listed until they are handled — they re-appear every time the
    app opens or data refreshes (the app polls every 8 s while open).
11. If a phone number that was **rejected before** applies again, both the
    village admin and the main admin see a red warning on the review card
    and a notification entry. (Demo: 9002000003 applies to Jinjaka.)
12. While the app is open on Android, a reminder system notification is
    posted when decisions are pending (at most once per 10 minutes).
    Honest limit: notifications that wake a closed app need Firebase push
    infrastructure (FCM server keys) — not possible in this workspace;
    the Android bridge code is in place for when that is added.

Screenshots: `docs/modern-design/v03-admin/` (dashboard, requests, stats
drill-down, archive, reports, notifications — light and dark, plus the
village-admin notification tab).

Automated results for v0.3.0: Node 101/101, UI 5, language 2,
accessibility 29 screens / 0 violations, embedded 3, village-workflow 1
(includes the rejected-number regression), materials 20, npm audit 0.

---

# Beta test checklist — Liquid Glass refinement (v0.2.0) + app icon (v0.2.1)

Checkpoint before these changes: git tag `Pre-LiquidGlass-Refinement`
(UNDO restores it). Package `org.mvpmi.directory`, versionCode 3,
versionName 0.2.1-dev. Existing data, sign-ins, villages and the approval
workflow are unchanged.

## What changed in v0.2.1

- App icon everywhere: web favicon + apple-touch icon (browser tab, home
  screen), Android launcher icons (legacy + adaptive for API 26+) and the
  512 px Play listing icon — generated from the owner's devotional image,
  nothing cropped, on the app's terracotta brand gradient. See
  `docs/APP_ICON.md` for the two source options and how to switch.
- The village-administrator Dashboard badge now also counts the change and
  removal proposals from their village that are waiting with the main
  administrator (previously it counted only new applications to verify).
- Removed four unused interface-copy entries; no visible text changed.
- All automated suites re-run green (Node 99, UI 5, language 2,
  accessibility 29 screens/0 violations, embedded 3, village 1 — including a
  new badge regression check, materials 20).

## What changed (visual only)

- Header bar, header buttons (all-admins, shield, language, theme, reading
  settings), Dashboard/My-profile buttons and the floating workflow button
  are now translucent Liquid Glass chips with thin bright rims and soft
  shadows — light theme uses translucent white, dark theme darker glass.
- Sheets and dialogs (reading settings, all-admins, village-admin sign-in,
  workflow, consent) use stronger glass with real background blur.
- The page has a subtle warm scenic wash; content lists and forms stay on
  quiet opaque surfaces so text remains easy to scan.
- Buttons gained deliberate press/hover/disabled/selected states; the theme
  toggle keeps its accessible label and immediate full-app effect.
- Nothing changed in names, roles, villages, data or the approval rules.

## Automated test results (this environment)

| Check | Result |
| --- | --- |
| Node suite (99 tests) | PASS |
| UI/browser suite (header, tiles, search, contacts, sizes) | PASS |
| Language suite (single language, sorting, persistence) | PASS |
| Accessibility suite (29 screens, axe WCAG 2.x AA) | PASS — 0 rule violations |
| Material suite (20 states: both themes × blur/translucent/opaque × 85/165%, outage, offline) | PASS |
| Embedded webview suite (cookies/no-cookies/no-storage) | PASS |
| Village workflow browser suite (admin-first, sign-in, verify, approve, proposals, ledger) | PASS |
| Contrast on composited glass (computed) | PASS — ink 13.7–15.9:1, secondary 5.3–8.8:1, icons ≥6.5:1 (needs 4.5/3) |
| Performance proxy (headless Chromium): theme switch 27–38 ms; backdrop-blur layers 0 browsing / 1 with sheet open | PASS |
| npm audit | 0 vulnerabilities |

Untested here (no Android SDK/device in this environment): real-device GPU
performance, cutout/gesture-area behaviour, system dark-mode interplay on
Android, install-over-previous. Manual steps below.

## Screenshots

`docs/modern-design/glass-refinement/` — signup, consent dialog, all-admins,
reading settings, village-admin home and workflow, admin dashboard; each in
light and dark theme.

## Manual checklist for testers (Android)

Prerequisite: get the debug APK (CI download or local build — see
"APK build" below), install over the previous version, and confirm existing
sign-ins survive.

v0.3.0 manual checks:

13. On the phone: Backup & export → CSV list → the system save sheet opens
    → choose Downloads or Drive → file appears there and opens with
    Gujarati intact.
14. Reports → Full report → PDF → the print sheet opens → Save as PDF to
    Drive or phone → the PDF contains members, villages, pending requests,
    archive, rejections and activity.
15. Register with a previously rejected number (demo 9002000003) → both
    admins see the red "rejected before" warning on the review card.
16. With a request waiting, keep the app open ~10 minutes → a system
    notification appears (allow notifications when asked the first time).

v0.3.1 manual checks (village-admin screens — see
`docs/modern-design/v031-va/` for screenshots):

17. Sign in as a village administrator → open the Dashboard: the title
    "Village verification · <name>" always stays on one line (also in
    English and at large text size).
18. The section tabs (Requests / My village members / Notifications /
    Account) look like Swiggy's tab bar: one row, active section underlined
    in brand red. The back control is a plain arrow at the top right (no
    "Back to dashboard" text).
19. Sign out: the red sign-out arrow sits at the top right of the
    Dashboard, visible on every section — one tap signs out. (Also still
    available under Account.) After signing out, the Dashboard and My
    profile icons sit side by side on one line at the top right of the
    directory.

v0.3.2 manual checks (see `docs/modern-design/v032-tiles/` for
screenshots and `docs/TEST_REPORT_v032.md` for the full test report):

20. Village administrator → My village members → send "માહિતી બદલવાની
    સૂચના" or "દૂર કરવાની સૂચના": the form closes and a green
    "મુખ્ય એડમિનને મોકલી દીધું · Forwarded to the main administrator"
    notice appears immediately.
21. Main admin → Total members: the first tile is "કુલ સભ્યો / Total
    members" — tap it to see every member in one list with edit and
    delete; the separate Members tile is gone.
22. Every tile (dashboard, villages, backup options, directory villages)
    shows the community Sun mark slowly rotating, one compact size, with
    the red stripe on hover and the pressed effect on touch — in both
    themes.
23. Reports: every PDF opens on the community letterhead (Sun symbol,
    "મહુવા ક્ષત્રિય રાજપૂત સમાજ · Mahuva-Bhavnagar District", date at the
    right) and every row starts with a serial number (ક્રમ/#); CSV and
    Excel exports are numbered too.
24. Icons: check both themes — no yellow/amber or teal icons anywhere;
    success marks are green, everything else follows the theme colours.

1. First launch shows the LIGHT theme even if the device is in dark mode.
2. Theme button switches instantly; reopen the app after closing it and after
   a device restart — the chosen theme returns; no wrong-theme flash.
3. Gujarati default; language button switches; no screen shows both scripts.
4. Open every sheet (reading settings, all-admins, village-admin sign-in,
   workflow). Text stays sharp; glass shows blur behind sheets, not rows.
5. System font size 200%: nothing is cut; all buttons stay ≥48 dp.
6. Long names/numbers wrap without overflow at 320 px-width devices.
7. Keyboard opens on signup: the Send button stays reachable.
8. Village admin: Dashboard badge counts pending; correct-then-forward works
   in one pass; reject is a single confirmed action. The badge also includes
   member change/removal proposals from the village that are waiting with
   the main administrator (they appear as pending in the Members tab).
9. Main admin: workflow bar, corrections before final approval, ledger.
10. Settings → effects switch off: surfaces become fully opaque and stay
    readable (accessibility fallback).
11. Slow/low-end device (if available): scrolling stays smooth — glass never
    blurs list content.
12. Launcher icon: the devotional artwork is fully visible (nothing
    cropped) on the home screen, in recents and in the app drawer, on both
    circular and squircle launcher masks. If the wrong source image was
    used, regenerate with the other option (see `docs/APP_ICON.md`).

## APK build

Easiest — the Releases page (one click, no sign-in, never expires):

1. Open https://github.com/solerunner26/MVPMI/releases
2. Open the newest release and download **app-debug.apk** directly —
   no unzip, no GitHub account needed.
3. Copy it to the phone → install over the previous version (same
   applicationId + signing identity; allow "unknown sources" if asked).
   The same page has `SHA256SUMS.txt` (checksum), `BUILD-INFO.txt`
   (source commit) and **Source code (zip)** — use that ZIP if you need
   to run the computer test server (see docs/PHONE_TESTING.md).

Every `v*` git tag automatically builds and publishes a fresh release
through the "Quality checks" workflow.

Alternative — a specific CI build: open
https://github.com/solerunner26/MVPMI/actions, click a green "Quality
checks" run, scroll to **Artifacts**, download **mvpmi-debug-apk**
(requires repo-owner sign-in; kept 14 days).

Alternative — build locally on a machine with Android Studio (AGP compatible
with compileSdk 36):

```
cd android
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
# Install over the previous version (same applicationId + signing identity):
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Release builds stay intentionally blocked until the items in
`docs/RELEASE_AUDIT.md` are resolved; do not distribute a release APK yet.
