# Android device tests (emulator)

Real instrumented tests in `android/app/src/androidTest`, written with the
patterns of [android/testing-samples](https://github.com/android/testing-samples):
AndroidJUnitRunner + ActivityScenario, **Espresso-Web** (WebView content),
**Espresso-Intents** (what the app asks Android to open) and **UI Automator**
(system screens: dialler, save sheet, permission dialog, fingerprint prompt,
notification shade).

They are different from the other checks:

| Check | Where it runs | What it proves |
|---|---|---|
| `npm test` | Node | server rules, Android source configuration (static) |
| `npm run test:e2e` | Chromium at phone size | every screen/button of the web app; the Android bridge is a **stand-in** |
| `:app:testDebugUnitTest` | JVM | navigation policy (no device) |
| **Device tests (this file)** | **Android emulator, API 29, 33, 36** | the real app APK, its WebView, system Back, rotation, keyboard, network loss, process kill, save sheet, dialler, notifications, fingerprint |

## How CI runs them

Job `android-device-tests` in `.github/workflows/quality.yml`:

1. builds `app-debug.apk` with `-PcommunityDebugUrl=http://10.0.2.2:3900` and
   `app-debug-androidTest.apk`;
2. starts `scripts/android-test-server.mjs` (this commit's server and web
   code, in-memory database, synthetic people only);
3. boots an emulator per API level (reactivecircus/android-emulator-runner)
   and runs `scripts/android-device-tests.sh`, which resets the app between
   test classes, kills the process for the cold-start test, and sends
   fingerprint touches (`adb emu finger touch`) when a test asks for them;
4. uploads `device-test-results/api-N/` (environment with APK SHA-256, server
   commit and WebView version, update check, raw output, logcat, summary).

The alpha release job waits for these tests.

## What is covered

| Test class | Covers |
|---|---|
| LaunchLoginBackTest | start, Espresso-Web read of Login, mobile-only login, Back from the directory closes the app |
| RotationKeyboardTest | rotation without reload or sideways scroll; on-screen keyboard shrinks the page and never covers search; real typing |
| OfflineReconnectTest | Wi-Fi and data off → offline banner with saved directory and Call; back on → Retry reconnects without restart |
| ColdStartTest (2 phases, process killed between) | PIN lock survives a real cold start; screenshots blocked from the first frame; wrong/right PIN; lock off → screenshots allowed |
| BackgroundLockTest | 65 s in the background locks; "Forgot PIN?" signs out and a new login has no lock |
| CallWhatsAppIntentTest | exact `ACTION_DIAL tel:+91…` and `ACTION_VIEW https://wa.me/91…` intents |
| RealDiallerTest | the system dialler really opens with the number |
| ExportSaveTest | CSV written through `ACTION_CREATE_DOCUMENT`; cancel writes nothing; unwritable place fails safely; the real save sheet: Back cancels, Save writes to Downloads |
| NotificationPermissionTest (API 33+) | deny → app works, no notification; enabled later → notification appears |
| FingerprintSetup + BiometricUnlockTest | fingerprint on, unknown finger refused, Cancel keeps it locked, enrolled finger unlocks |

## Not covered by these tests (say so in every report)

- A real phone (only emulators), phone makers' own Android versions, and
  low-memory devices.
- The real WhatsApp app (not on the emulator; the intent is checked).
- Google Password Manager saving the Main Admin password.
- Google Drive as a save location (the save sheet is tested with Downloads).
- Real fingerprint sensors (the emulator's virtual sensor is used). If an
  emulator image cannot enroll a fingerprint, the biometric test is reported
  as **SKIPPED**, never as passed.
- Updating over an app signed with a different key: CI records whether the
  new APK installs over the published previous alpha (`update-check.md`).
