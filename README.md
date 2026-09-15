# MVPMl — Community Directory

Development implementation of the supplied Gujarati/English community-directory design.

**Status: tested browser development build + a compiled, debug-signed Android test APK. Not ready for real community data or production distribution.** The original HTML and dossier are preserved unchanged. The app is generated from their markup, styles, icons and sun components; the designer's external screen-jump controls and sample data are not exposed by the running application.

## Latest release audit

**Not ready for publication.** See [the release audit](docs/RELEASE_AUDIT.md) for the checked code, corrected issues, executed tests and unexecuted Android/Play requirements. This review passed **54 server/configuration tests**, the browser workflows, three embedded-session modes and 23 automated accessibility scans. Manual contrast/TalkBack review and Android compilation/device testing remain outstanding.

The development preview now uses an expiring, tab-scoped session transport so cookie-blocking browsers can sign in. It still requires the gate and admin password; the transport is disabled outside development. If all browser storage is blocked, it persists only until the page reloads.

## Run locally

Requires **Node 22.13+** (uses the built-in experimental `node:sqlite` API).

```sh
npm ci
npm run build
cp .env.example .env
# Edit .env with your own development admin password and access code.
node --env-file=.env server/index.mjs
```

Open `http://localhost:3000`. The server binds to `0.0.0.0`; the UI calls same-origin `/api` endpoints, so hosted previews do not call the viewer's localhost.

- The database starts empty. Use **synthetic test contacts only**.
- Submit a profile in one browser. Open an **incognito/private browser** to act as a separate administrator.
- Tap the sun logo **5 times within 2.5 seconds**, enter your configured four-digit gate code, then sign in as `admin` with your configured password.
- Approve the request. The member browser discovers approval within 8 seconds or on reload.
- `ADMIN_PASSWORD` and `ADMIN_GATE_CODE` only initialize a **new database**; changing the environment does not overwrite stored credentials.
- No prototype password or access code is embedded in the generated client.

## Implemented and verified

- Persistent SQLite member, request, archive, session, security-alert and audit tables.
- Server-enforced directory access: guests and pending members receive **no directory records**.
- Enrollment, request editing/replacement (archives old payload), withdrawal, approval and rejection.
- Member profile edits remain pending until approval. Delete requests preserve access until approved.
- Direct admin edits/deletes; dependent request cleanup; stale-update and duplicate-phone checks.
- Seven village tiles, all-member list, bilingual name/number search, optional second number, live counts and statistics.
- Original light/dark styling, sun and waiting animations, Gujarati/English language switching, four text-size presets (Default, Big, Bigger, Biggest); preferences persist without persisting the directory in localStorage.
- Browser dialer links (not automatic calls), clipboard copy where supported, and WhatsApp chat URLs.
- Hidden admin gate, scrypt password hashes, opaque HttpOnly session cookies, 30-minute admin sessions, server-side attempt limits, security alerts, session blocking, and sign-out.
- Admin reset OTP generation/expiry/attempt limit, strong-password enforcement, session revocation, and a configurable SMS webhook. **Real SMS is not configured in the preview.** Codes are never returned to the browser or logged. A 60-day password reminder is shown when due.
- Real `.xlsx` export; print-ready browser PDF/Save-as-PDF workflow; Web Share file sharing where supported, with a download fallback.
- Versioned directory-data JSON export and validated, confirmed, transactional restore. Includes members, open request queues and archive, **not authentication credentials, sessions or security/audit history**.
- Basic loading, connection/retry and operation-failure states; reduced-motion support and scroll-layout fix so profile settings do not collapse on short screens.

## Tests

```sh
npm test          # API authorization and lifecycle tests, in-memory and disk SQLite
npm run test:ui   # browser flow through the actual design, using separate member/admin contexts
npm run test:embedded     # normal, blocked-cookie and blocked-storage iframe login
npm run test:accessibility # automated axe scans, keyboard focus and Back-handler checks
npm run test:coverage      # server coverage, not Android coverage
npm run check              # all runnable quality checks and dependency audit
```

UI tests cover enrollment, pending state after reload, hidden admin login, approval, directory search, approved profile changes, language/theme persistence and horizontal overflow. Browser screenshots are saved to ignored `test-results/`.

The Linux UI harness uses an npm-distributed Chromium and extracts its bundled runtime libraries into the OS temporary directory; no browser binaries or generated screenshots are tracked in Git.

## Phone / emulator test APK

[Download the APK ZIP from GitHub Actions](https://github.com/solerunner26/MVPMI/actions/runs/35010521845/artifacts/10413323453) (GitHub sign-in may be required; artifact retention is 14 days). Extract `app-debug.apk` from it. Kotlin compilation, Android lint, unit tests, APK assembly and signature verification passed in [build 35010521845](https://github.com/solerunner26/MVPMI/actions/runs/35010521845), source commit `076ed80`. Actual device/emulator installation remains to be tested.

**Read [the step-by-step phone testing guide](docs/PHONE_TESTING.md).** Install Node.js LTS on your computer, extract this source folder, and open `START-TEST-SERVER-WINDOWS.cmd` or `START-TEST-SERVER-MAC.command`. Leave the server window open. Its credentials/database are separate from the Arena preview. Use the emulator address `http://10.0.2.2:3000`, or the printed computer Wi-Fi address on your phone. Do not use the Arena preview URL as the APK backend.

## Android source

`android/` contains an **online Kotlin WebView host scaffold**, not a complete native Kotlin/Room implementation. It preserves the HTML design while providing Android `ACTION_DIAL`, clipboard, WhatsApp `ACTION_VIEW`, HTTPS first-party navigation (debug builds additionally allow private-network HTTP for local testing) and a Storage Access Framework file picker. No direct-call, contacts or broad storage permission is requested.

Open `android/` in Android Studio with JDK 17, Android SDK 36 and Gradle 8.11.1. Supply the hosted backend URL as a Gradle property:

```sh
cd android
gradle assembleDebug -PcommunityUrl=https://your-development-host.example
```

**The debug APK was built, linted, unit-tested and signature-verified in GitHub Actions. It has not yet been installed/tested on an emulator or phone.** The local sandbox still lacks an Android SDK/JDK. `minSdk = 21` is a packaging target, not a claim that this web renderer works on Android 5. The current JS/CSS require a modern WebView. Native/offline rendering, legacy WebView fallbacks, device testing, download/print/share integration, native Back integration testing and release signing remain work. Use the browser preview to test exports for now.

## Production blockers — do not skip

`server/index.mjs` intentionally refuses to launch without `DEVELOPMENT_MODE=true`.

1. **Member SMS ownership verification and recovery.** Development identity is an opaque browser session, not a verified phone number. A new browser cannot reclaim an existing profile. New-number verification and reinstalls require a designed recovery flow and an SMS provider.
2. **Android compatibility and accessibility.** Finish the native implementation/decide the hybrid approach, test actual low-end devices, OS font scaling, TalkBack, touch tile-reordering and Gujarati conjunct rendering. No app can promise every Android version.
3. **Privacy policy and retention.** The UI discloses member visibility and archive retention, but there is no approved retention duration/legal policy or automatic purge. Backups contain personal data in plaintext; store securely. Archive isolation currently means a separate server-side table with admin-only API access, not a separate physical database.
4. **Notifications and recovery.** Security alerts are in-app only; no push/SMS intrusion notifications. No member approval notifications, co-admin recovery or delegated roles.
5. **Operations.** HTTPS, `COOKIE_SECURE=true`, encrypted server storage/backups, infrastructure rate limits, monitoring, scheduled backups, migrations, cleanup and deployment hardening are required. Current rate limits deliberately use the socket address and ignore untrusted forwarded-IP headers; shared proxies can share a limit.
6. **Offline and scaling.** No persistent offline directory or conflict queue. Existing data stays in page memory during a disconnect; revocation is enforced at the next successful server request. Add indexed relational queries/pagination for larger communities.
7. **Remaining design features.** Villages are fixed in code, mobile long-press tile reordering is unimplemented, and backup is directory-data recovery rather than a full authentication/security-system restore. PDF and file sharing still depend on browser support.

See `docs/IMPLEMENTATION.md` for the architecture and next steps. Do not remove the development guard until these decisions and security work are complete.


Android `assembleRelease` and `bundleRelease` are intentionally blocked until the P0 items in the audit are resolved. `.github/workflows/quality.yml` prepares debug compilation/Lint/Kotlin tests on a runner with the Android toolchain; adding this workflow does not mean those checks have passed.
