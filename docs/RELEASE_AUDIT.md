# MVPMl — Development & Release Audit

**Review date:** 15 September 2026
**Release decision:** **NOT READY TO PUBLISH**
**What is usable now:** the browser development preview and a debug APK for initial phone/emulator testing, with synthetic contacts only.

## Plain-language summary

The directory and approval workflows have a working, tested backend. This audit fixed additional security, validation, accessibility and session-handling issues. However, the Android project is still an online WebView host, not a completed native/offline Android application. A debug APK has now been assembled and its signature verified in GitHub Actions. It has not been installed on a phone/emulator yet, and no production-signed Play Store app bundle exists.

A passing browser test does **not** prove the app works on an old Android phone. Likewise, a successful dependency audit does not mean the app has had an independent security assessment or meets Google Play policy.

**Do not upload this build to Google Play or enter real community contacts yet.** Both production server startup and Android release assembly are deliberately blocked while critical work remains.

## 1. Checks actually completed

| Check | Result | What the result means |
|---|---|---|
| Clean dependency install (`npm ci`) | Passed | Reproduces the installed Node dependencies from the lockfile |
| Automated server/configuration suite (`npm test`) | **54 tests passed** | Includes API permissions, workflows, invalid input, restore validation, reset controls, storage persistence, static Android configuration checks and a local load smoke test |
| Server coverage (`npm run test:coverage`) | **98.76% lines; 90.54% branches; 96.15% functions** | Covers the instrumented `server/*.mjs` files, **not** Android or the design renderer; uncovered branches remain |
| Browser workflow (`npm run test:ui`) | Passed | Enrollment → pending after reload → separate admin login/approval → directory → member change/approval; direct admin edit, text injection safety, preferences and basic width checks |
| Embedded preview (`npm run test:embedded`) | **3 modes passed** | Cookies enabled; all cookies removed; cookies and browser storage blocked. Tests actual login, wrong-password feedback, authenticated XLSX download and logout. Reload persistence is tested when tab storage is available |
| Automated accessibility (`npm run test:accessibility`) | **23 screen/state scans, 0 reported rule violations** | Automated WCAG A/AA-tagged rules only. **510 node-level color-contrast checks were incomplete across those scans** because of the rendered surfaces; they require manual review. This is not an accessibility certification |
| Dependency audit | **0 known vulnerabilities reported** | Point-in-time `npm audit`, not proof that dependencies have no undisclosed defects |
| Local read-load smoke test | Passed | 1,001 synthetic members; 20 sequential requests; approximately **11 ms median / 15 ms p95**, 219,788-byte response on this sandbox. Not a concurrency, low-end-device or production performance test |
| Source review of Android configuration | Completed | HTTPS-only release configuration (debug-only local HTTP exception), no broad contact/call/storage permissions, no JavaScript interface or SSL-error bypass in the host |
| JDK / SDK / Gradle / emulator availability | **Local sandbox blocked; CI available** | `java`, `gradle`, `adb` and `sdkmanager` were unavailable; direct SDK and Gradle distribution downloads failed with TLS connection errors |
| Kotlin compilation, Android Lint, Kotlin unit tests, debug assembly | **Passed in GitHub Actions** | Follow-up build `35005276099`, source `336e359`; lint completed with warnings, not a zero-warning certification |
| APK signature verification | **Passed** | SDK `apksigner verify --verbose --print-certs`; this is a debug key, not production signing |
| Computer test-server launcher | **Linux smoke test passed** | Isolated source extraction: build, HTTP app/state, generated access code and admin login; Windows/Mac launch wrappers have not been run on their respective OSes |
| APK/AAB installation, real devices, Play Console pre-launch/closed test | **Not run** | The debug artifact is now available; actual devices/emulators and the owner's Play Console account are still required |

All automated data used in this audit was synthetic and isolated from the preview database. No test deleted the user's existing preview profiles or requests.

### Re-run the executable checks

```sh
npm ci
npm run check
npm run test:coverage
```

`npm run check` runs the API/configuration suite, browser workflow, all embedded-session modes, accessibility scan and dependency audit. Browser artifacts are written to ignored `test-results/`; they are not committed as app data.

## 2. Issues corrected during this review

| Finding | Correction and evidence |
|---|---|
| The checked-out application still relied on cookies for every request, risking the recurring gate/sign-in loop | Isolated session handling in `server/session.mjs`; development-only, expiring opaque transport shared by every API request, including exports. Tested with all cookies/storage blocked. The access code and admin password remain mandatory |
| All login failures were shown as wrong credentials | The UI displays the actual server error and uses the login response directly rather than depending on an extra cookie-based refresh |
| Browser storage exceptions could break preference updates | Storage reads/writes are guarded; memory-only preview authentication works when storage access throws |
| Private ownership fields could appear in pending update snapshots | Public profile serialization now uses an allowlist, including nested old/requested profile values |
| Invalid object/array/primitive input could reach domain handlers | JSON object and content-type guards; strict field typing, bounds and phone validation; malformed JSON receives a non-sensitive 400 response |
| Malformed origin values could throw instead of being rejected | Controlled origin parsing and 403 response; no permissive CORS added |
| Malformed backup entries could corrupt displays or carry unknown fields | Record-level allowlists, scalar types, canonical profiles, identifiers/timestamps, request ownership, phone-conflict and reference validation; invalid files leave data untouched |
| Restore could overwrite changes made after the administrator previewed the backup | Restore preview now includes a digest of the current data; the transaction rejects a stale confirmation with 409 |
| Equivalent JSON key order could produce a false stale-update conflict | Structural equality replaces JSON-string equality |
| Enrollment approval dropped consent evidence | Approved records retain consent timestamp/version, original request timestamp and approving admin identity. This remains development disclosure, **not an approved legal policy** |
| Unauthenticated reset requests could consume the shared SMS quota | Authenticate gate/admin before consuming SMS quota; server-side resend interval; five-error reset lock, OTP expiry and delivery-failure cleanup tested |
| Password reset did not invalidate every gate capability | Reset now revokes admin access, gate state and outstanding OTPs across all sessions |
| SMS configuration could use insecure transport or follow a redirect | HTTPS-only authenticated delivery adapter; credentials-in-URL rejected; redirects refused; provider errors not returned to users |
| Admin edit selection could outlive the editor | Clear selected admin member on successful navigation/save and when returning to own profile |
| Scroll region was not keyboard-focusable; blank keypad control had no accessible name | Added focusability and semantic labels; disabled the decorative blank key without changing the keypad layout |
| Dialogs lacked semantics, focus containment and Escape handling | Added dialog labels, modal semantics, focus restoration, Tab containment and Escape support. Browser keyboard checks pass |
| Android Back did not follow the app's internal screens | Added a tested JavaScript Back handler and native legacy/modern Back integration **source**. Native integration still requires device testing |
| Native navigation could trigger external intents from subframes or accept overly broad URLs | Added a pure Kotlin navigation policy, stricter same-origin checks, dialer/WhatsApp validation and subframe restrictions. Kotlin tests are written but **not executed here** |
| Unfinished Android source could accidentally be assembled as a release | Added an explicit release-readiness failure on `assembleRelease` / `bundleRelease`; debug build checks remain available |

The uploaded visual reference files are unchanged. Corrections reuse their layout and styling; accessibility changes are semantic/focus/scroll behaviour rather than a new design.

## 3. Remaining development — in priority order

### P0: required before real community data

1. **Verified member identity and recovery.** Implement SMS OTP enrollment, returning-member authentication, new-phone verification, reinstall/lost-device recovery and anti-abuse controls. Current identity is a browser session; anyone can submit a claimed number in development mode. Admin approval does not prove phone ownership.
2. **Privacy and genuine account-data deletion.** Current removal takes a contact off the directory but copies it to an admin archive. That is not complete account/data erasure. Decide and implement retention limits, deletion processing, archive purge, backup retention and service-provider deletion. An indefinite archive “for admin use” must not be described as compliant data deletion.
3. **Finish the Android delivery approach.** Decide whether the final app is native Kotlin/Room, as recommended by the dossier, or an explicitly accepted hybrid implementation. The current renderer needs modern JavaScript/WebView features; declaring `minSdk 21` does not make it work on Android 5.
4. **Complete native functionality.** Android downloads, PDF printing, file sharing, download errors, startup network failure, renderer process recovery, process-death recovery and offline behaviour are incomplete. Back/navigation source fixes need compilation and device tests.
5. **Secure deployment and operations.** Choose hosting and an SMS provider; configure TLS, non-preview admin credentials, encryption/storage permissions, backups, monitoring, rate limits and recovery procedures. Remove development transport only as part of a reviewed production identity design. Do not simply remove the production/release guards.

### P1: required before a release candidate

- Complete offline strategy, stale-data/revocation rules and conflict handling.
- Add dynamic village management and mobile touch/long-press tile reordering if the dossier's features remain required.
- Implement security-alert and member-approval notification delivery; current alerts are in-app only.
- Provide an admin recovery/co-admin procedure so loss of one phone is not catastrophic.
- Add scheduled encrypted backups and test disaster recovery. JSON export currently excludes authentication, sessions and security/audit history; it is a directory-data backup, not a complete server backup.
- Review database indexing, pagination, cleanup and concurrent workload limits for the expected community size.
- Manually verify colour contrast, TalkBack reading order, touch targets, Gujarati conjunct rendering and OS font scaling with elderly community users. Automated checks cannot resolve all glass/gradient contrast combinations.
- Finish a privacy policy, retention policy, support contact and an external account-deletion request page; no invented legal entity or public support details have been supplied.

## 4. Android/device test plan — still to execute

Use actual artifacts and test both fresh install and upgrade, not just the HTML in a desktop browser.

| Test group | Required cases |
|---|---|
| Build | Android Lint, Kotlin unit tests, debug APK; final release/AAB after blockers are removed; merged manifest; signing and package/version verification |
| Device versions | Proposed minimum API 21/23 only if still supported by the chosen implementation; API 26, 29/30, 33, 35 and 36; old and current WebView versions; low-memory physical phone |
| Install/lifecycle | Clean install, upgrade with data, force-stop, process kill, reboot, rotation, background/foreground, task switching, Back/predictive Back, keyboard resize and edge-to-edge insets |
| Permissions/intents | ACTION_DIAL prefill without automatic calling; WhatsApp installed/uninstalled; no suitable handler; clipboard behaviour; Storage Access Framework cancellation, empty/invalid/large files |
| Functional | Every member/admin workflow, rejects, duplicate requests, double taps, concurrent approvals, credential/OTP expiry, session revocation, admin edits, archive separation, restore interrupted mid-operation |
| Connectivity | Airplane mode, slow/flaky network, TLS failure, timeouts, server 4xx/5xx, lost response after mutation, retries and stale data after revocation |
| Accessibility | TalkBack, switch/keyboard access, 200% OS font/display scale, Gujarati/English, light/dark, contrast, touch-target sizes and one-handed use by elders |
| Performance | Cold/warm start, memory, ANRs, scrolling/input latency, battery/background work, realistic dataset and concurrent server workload |
| Security | Independent review of identity/authorization, transport, backup leakage, session lifecycle, XSS, certificate handling, native navigation and dependency supply chain |
| Distribution | Play internal testing, pre-launch report, closed testing when applicable, reviewer access to approval-gated screens, store listing and Data safety review |

No Android device-matrix item above is marked passed by this audit.

## 5. Publication requirements checked against official guidance

These are release requirements/planning inputs, **not completed approvals**. Re-check Play Console at submission time.

- Current official guidance requires new phone/tablet apps and updates to target **Android 16 / API 36** from 31 August 2026. The source declares 36; the actual bundle has not been validated. [2](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- Check 16 KB memory-page compatibility and the final artifact's native libraries/packaging; run a 16 KB environment test as applicable. Source being Kotlin does not replace artifact inspection. [3](https://developer.android.com/guide/practices/page-sizes)
- Personal Play developer accounts created after 13 November 2023 must meet the official closed-test requirement: **at least 12 testers opted in continuously for 14 days**, then apply for production access. The owner's account type/date is unknown; no such test has been run. [4](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- For apps allowing account creation, Google requires both an in-app deletion path and an external web resource, including associated-data deletion with clearly explained legitimate retention exceptions. The current archive-only removal is not sufficient evidence of compliance. [5](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- Complete accurate Data safety declarations and a privacy policy, including data handled by the app's WebView and third-party services. Do not claim “no data collected” for a hosted contact directory. [6](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

Also prepare signing keys/Play App Signing, app icon/screenshots, content rating, audience declaration, support details and reviewer instructions. These need owner decisions and Play Console access; they cannot be completed by local tests alone.

## 6. CI and next action

`.github/workflows/quality.yml` defines server/browser quality jobs and a JDK 17 / SDK 36 Android debug build, Lint and Kotlin-unit-test job. **The workflow was added but has not run on GitHub during this audit.** The Android fixture URL in that job is intentionally non-live and is not a distributable community build.

**Recommended next milestone:** confirm the member SMS provider/budget, oldest real phones, native-versus-hybrid delivery and retention/deletion policy. Then implement those P0 items, build a debug APK, execute the device matrix, fix findings, and only then prepare a Play release candidate.

## Debug APK follow-up — 15 September 2026

[Successful build and all job results](https://github.com/solerunner26/MVPMI/actions/runs/35005276099) · [Debug APK artifact ZIP](https://github.com/solerunner26/MVPMI/actions/runs/35005276099/artifacts/10411406258). Source commit: `336e359`. The artifact contains `app-debug.apk`, `SHA256SUMS.txt` and `BUILD-INFO.txt`, with 14-day retention. The archive digest reported by GitHub is `sha256:7b042ecff331d835891a916e1dfe3efe55b8ce73dbad9a36c99854c6b3d5be80` (this is the ZIP digest, not the APK checksum). Direct binary download into this sandbox was blocked by its connection to artifact storage; use the GitHub download link.

This follow-up fixed the obsolete SDK setup package, a Kotlin dial-number regex and an API-23-only status-bar attribute incorrectly placed in API-21 resources. It adds a debug-only configurable server, native connection/retry screen and test banner without changing the directory design. The computer launcher uses a separate database and generated per-computer credentials. The Arena preview is traffic-token protected and cannot be used directly by an external APK. See [PHONE_TESTING.md](PHONE_TESTING.md).

The production decision remains **NOT READY TO PUBLISH**. Compile/unit/lint/signature checks do not establish installation success, old-WebView compatibility, native exports, real member verification, secure public hosting or Play policy compliance.
