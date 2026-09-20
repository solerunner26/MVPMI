# MVPMl — Community Directory

Development implementation of the supplied Gujarati/English community-directory design.

**Status: tested browser development build + a compiled, debug-signed Android test APK. Not ready for real community data or production distribution.** The original HTML and dossier are preserved unchanged. The app is generated from their markup, styles, icons and sun components; the designer's external screen-jump controls and sample data are not exposed by the running application.

## Modern redesign review — 17 September 2026

The whole-app redesign is implemented: **no permanent bottom settings bar**; a compact global header and preferences sheet; connected language/theme segments; a search-led directory with illustrated village tiles; labelled Call/WhatsApp actions; and coordinated forms, profile, dialogs and eight-card admin dashboard. Gujarati-first visible bilingual content and the 85–165% slider remain.

See the [before/after review, screenshots, test evidence and limits](docs/MODERN_REDESIGN.md). `npm run check` passes **92 Node tests** and all browser/contact/embedded/village/language/material suites. App accessibility has zero reported violations; four modal contrast uncertainties receive independent checks with raw axe results retained (details in the report). Physical-device and visual acceptance are not claimed.

**Pre-edit checkpoint:** `Pre-Modern-Redesign` → `6812495`. Earlier checkpoints and original assets are unchanged. Open preferences using the sliders control at the top right; language also has a direct header control.

## Village verification and management — 20 September 2026

Each community village has its own administrator with a **separate phone+password sign-in**; the hidden sun-tap entrance stays with the main administrator. The main administrator enrolls each village's administrator first — community applications stay closed for a village until its administrator exists. Applications wait for village verification, are forwarded with a mandatory reason, and receive directory access only after main-administrator approval. Village administrators can also propose member changes/removals, but every proposal needs the main administrator's final decision. Rejected/closed applications are kept in a separate admin-only ledger (distinct from the removed-member archive), villages are managed by the main administrator (seeded with the original seven), an optional **હાલ :** current-location field joins the form, language/theme are header-only controls, and access-code recovery is retired in favour of identity-checked reapplication. See the [full flow, data model, evidence and limits](docs/VILLAGE_APPROVAL.md); demo logins are in [DEMO_LOGINS.md](docs/DEMO_LOGINS.md).

**Pre-edit checkpoints:** `Pre-Village-Approval` (tag) and commit `9111cc7`.

## Previous Liquid Glass review (superseded presentation)

The previous review added a restrained material layer, Gujarati-first **visible bilingual pairs**, a continuous **85–165% slider**, and explicit reduced-effects fallbacks. Existing navigation and server-backed workflows remain. See the [upgrade comparison, evidence and remaining risks](docs/LIQUID_GLASS_UPGRADE.md).

**Exact pre-upgrade source checkpoint:** `Pre-LiquidGlass-Upgrade` at `3179e92`. cp001/cp002 and the original design assets remain unchanged. “UNDO” targets that pre-upgrade tree, not a replacement theme.

That checkpoint’s validation included 80 Node tests, browser/contact/recovery/embedded flows, 29 app accessibility states and 20 material states. Real-device Android, TalkBack, performance and visual acceptance remain outstanding. This is not native refractive glass or a production release. See the [release audit](docs/RELEASE_AUDIT.md) for the separate publishing blockers.

## Historical changes after cp001 (superseded presentation)

The following describes the earlier checkpoint, not the current bilingual/slider design. Gujarati is the default UI language; switching shows only the chosen language. Reading settings are available before enrollment, and language/theme/help controls use a reserved toolbar. The revision also adds accessible village reordering, short-name search, full-width phone values, clearer approval/confirmation copy and a wider desktop admin view. User-entered names are not automatically translated. Administrator-assisted member recovery was added at that checkpoint; access codes were later retired in favour of two-stage reapplication (see [the village verification guide](docs/VILLAGE_APPROVAL.md)). SMS phone-ownership verification and production release requirements remain separate. The source checkpoint `cp001` is unchanged.

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
- Village tiles seeded with the original seven villages, all-member list, bilingual name/number search, optional second number and optional current location (હાલ :), live counts and statistics. The main administrator can add villages at runtime.
- Two-stage approval: village-administrator verification and forwarding, then main-administrator approval. Mandatory reasons and categories; separate rejection ledger for non-community/incomplete applications; archived removed members keep one unique identity and number set.
- Separate village-administrator sign-in (phone + password, 12 hours, village-scoped); the sun-tap gate and main password remain main-administrator-only. Joining a village is closed until its administrator is enrolled. Village-administrator change/removal proposals always await the main administrator's decision. Demo data: `node scripts/seed-demo.mjs`.
- Header-only language and dark/light theme controls; reading settings keep the 85–165% slider and other preferences.
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

1. **Member SMS ownership verification.** Development identity is an opaque browser session, not a verified phone number. Access codes are retired: deleted members reapply through both stages, and an active member on a new device needs a main-administrator-confirmed replacement (no automatic access). New-number verification still requires an SMS provider.
2. **Android compatibility and accessibility.** Finish the native implementation/decide the hybrid approach, test actual low-end devices, OS font scaling, TalkBack, touch tile-reordering and Gujarati conjunct rendering. No app can promise every Android version.
3. **Privacy policy and retention.** The UI discloses member visibility and archive retention, but there is no approved retention duration/legal policy or automatic purge. Backups contain personal data in plaintext; store securely. Archive isolation currently means a separate server-side table with admin-only API access, not a separate physical database.
4. **Notifications and delegation.** Village administrators are delegated, village-scoped roles with their own credentials; there is still no co-administrator recovery of the main account. Security alerts are in-app only; no push/SMS intrusion notifications and no member approval notifications. Village administrators are delegated, village-scoped roles; there is still no co-administrator recovery of the main account.
5. **Operations.** HTTPS, `COOKIE_SECURE=true`, encrypted server storage/backups, infrastructure rate limits, monitoring, scheduled backups, migrations, cleanup and deployment hardening are required. Current rate limits deliberately use the socket address and ignore untrusted forwarded-IP headers; shared proxies can share a limit.
6. **Offline and scaling.** No persistent offline directory or conflict queue. Existing data stays in page memory during a disconnect; revocation is enforced at the next successful server request. Add indexed relational queries/pagination for larger communities.
7. **Remaining design features.** Villages are main-administrator managed (seeded with the original seven), but mobile long-press tile reordering is unimplemented, and backup restores directory and governance data rather than the full authentication/security system. PDF and file sharing still depend on browser support.

See `docs/IMPLEMENTATION.md` for the architecture and next steps. Do not remove the development guard until these decisions and security work are complete.

Android `assembleRelease` and `bundleRelease` are intentionally blocked until the P0 items in the audit are resolved. `.github/workflows/quality.yml` prepares debug compilation/Lint/Kotlin tests on a runner with the Android toolchain; adding this workflow does not mean those checks have passed.
