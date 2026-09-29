# Paused work — v1.2.0-alpha.2 (paused 30 Sep 2026, 04:22 IST)

Owner approved (30 Sep): fix A01–A03, A05–A09 from the v1.2.0-alpha.1 test
report; KEEP mobile-only login (A04); add Android emulator tests (API 29, 33,
36) in GitHub Actions that must pass; then publish v1.2.0-alpha.2 and update
the live server (keep data).

## Done (in this branch, not released)
- A02 export: controller.js saveDownload() (no nested run()); verified 1 saveFile call with bridge stub. MainActivity: null output stream = "save failed".
- A03: village-workflow.mjs update/delete proposals close only when act() succeeds; alpha-admin.mjs enable/disable flash only on success. Verified form stays open on 503.
- A05: liquid-ios.mjs no-op class writes removed; idle mutations 60/s -> 0.
- A01: alpha.css row text column constrained; names wrap to 2 lines + ellipsis. 0 overlaps in 24-combination matrix.
- A06: header search mode (name hides while searching), placeholder "Search"/"શોધો", aria-label longer, name 3 lines capped at 115%, <=340px name 13px, placeholder font capped.
- A07: menu/switch labels text-align start (all at x=65).
- A08: workflow tabs icon-beside-label 48px; Reset is compact text button.
- A09: "હાલ :" prefix translated ("Location:").

## Next steps (resume here)
1. Placeholder at 320px/165% still looks cut ("Searcl") although computed ::placeholder is 17.25px and inner width 70px — investigate (maybe type=search decoration / screenshot); fix.
2. "My village members" tab wraps with icon far left — centre icon+label or allow 2-line label cleanly.
3. Check dark theme + Gujarati screenshots of the changed screens.
4. Add regression tests: e2e overlap check (element overlap, not page overflow) over 320/360/412 × en/gu × 85/100/135/165 with long names; failed proposal (503) keeps form; idle mutation count 0; settings label alignment; export bridge harness (saveFile called once; cancel/failure); English card prefix. Reproduction scripts are in scripts/repro-alpha2/.
5. Android instrumented tests: android/app/src/androidTest (AndroidJUnitRunner, Espresso-Web, Espresso-Intents, UI Automator, modelled on android/testing-samples); test build pointing at a CI-started server (10.0.2.2) from this commit; CI job with reactivecircus/android-emulator-runner for API 29, 33, 36. Cover Back, rotation, IME, offline/reconnect, process recreation, PIN + biometric success/cancel/failure, notification deny/allow (33), Call/WhatsApp intents, export save/cancel via document picker. Record APK hash, server SHA, WebView version, API.
6. npm test + npm run test:e2e; bump to 1.2.0 alpha.2 (versionName/code, CHANGELOG, release notes, .github/alpha-release = v1.2.0-alpha.2); merge into alpha/v1.1-audit; wait for CI + pre-release.
7. Live server via built-in browser SSH tab: `sudo mvpmi-update v1.2.0-alpha.2` (user may need to press Enter), verify https://samaj.kavigsv.com.
8. Delete WIP-RESUME.md and scripts/repro-alpha2 before the release commit.
