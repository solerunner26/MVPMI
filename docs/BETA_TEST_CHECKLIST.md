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

Prerequisite: build the debug APK (see below), install over the previous
version, and confirm existing sign-ins survive.

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

## APK build (blocked in this workspace — manual)

This workspace has no Android SDK/Gradle/Java. On a machine with Android
Studio (AGP compatible with compileSdk 36):

```
cd android
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
# Install over the previous version (same applicationId + signing identity):
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Release builds stay intentionally blocked until the items in
`docs/RELEASE_AUDIT.md` are resolved; do not distribute a release APK yet.
