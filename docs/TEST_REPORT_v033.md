# MVPMI v0.3.3 — Test & Verification Report

**Date:** 22 September 2026 · **Version:** 0.3.3 (Android versionCode 7)
**Scope:** the six requested items — add-village removal, Password-reset
manager redesign, OS-level notifications, village-admin sign-out landing,
four-digit app lock, and the full Android-project inspection/test pass.

## How to verify everything in this report

```sh
git clone https://github.com/solerunner26/MVPMI && cd MVPMI
git checkout v0.3.3-beta.1
npm ci
npm run check        # all suites in one command
```

## 1. What changed (item by item)

| # | Requested | Implemented as |
|---|---|---|
| 1 | Remove "નવું ગામ ઉમેરો" | The add-village form is gone from the UI **and** the `POST /api/admin/villages` endpoint is removed from the server — the village list is fixed at the seven seeded villages, enforced at backend level (`server/village-approval.mjs`, `web/village-workflow.mjs`) |
| 2 | Password-entry eye option; tab renamed "પાસવર્ડ રીસેટ"; compact dropdown design | The main admin's tab is now "પાસવર્ડ રીસેટ / Password reset": a village dropdown opens one card with that village's current administrator, member list, new-admin selection and password — every password field (new admin, reset) has the show/hide **eye** button. The page is one screen instead of seven stacked cards |
| 3 | Remove notification tab/tile; deliver notifications at OS level | The Notifications tile (dashboard), the notifications screen and the header bell are removed; the village-administrator Alerts tab is removed. The Android bridge now posts a **system notification** for every newly observed event: new enrollment request → village administrator; village-verified/forwarded request + change/removal proposals + security alerts → main administrator; finally-approved member → village administrator ("નવો સભ્ય ઉમેરાયો · ⟨village⟩"). Verified live with a stubbed bridge (below). Notifications while the app is closed need Firebase — setup steps in §5 |
| 4 | Village-admin sign-out returns members to the member list | Signing out of the village-administrator role now lands a member session directly on the community member list (`screen: "directory"`), never on a sign-in dead end. The sign-out controls stay available for beta testing; in the final hand-over build they can be hidden (one-line change) |
| 5 | Four-digit PIN app lock for every user | New device app lock, managed under **Reading settings → એપ લોક / App lock**: enable, change and disable (changing/disabling requires the current PIN). The lock screen reuses the admin passcode design (dots + keypad), covers the whole app (no data renders while locked), engages on app open and after 60 s in the background, locks for 30 s after 5 wrong attempts, and "Forgot PIN?" removes the lock **and signs the device out** (`POST /api/logout` destroys the session server-side). The PIN is stored only on the device as a salted PBKDF2-SHA256 hash (50,000 iterations) — never the PIN itself, never on the server |
| 6 | Inspect the Android project; keep names/backend; test everything; report honestly | See §3 and §4 |

## 2. Automated suites (all green)

| Suite | Command | Result |
|---|---|---|
| Node API/security/store/localisation | `npm test` | **103/103 pass** — includes new tests: fixed 7-village list + removed endpoint (404 for admin and VA), PBKDF2 hashing matches Node `crypto` byte-for-byte, PIN never stored, enable/verify/clear cycle, `/api/logout` destroys the session |
| Browser workflow incl. app lock | `npm run test:ui` | PASS — full E2E app-lock flow: enable → reload locks → no member data renders while locked → wrong PIN error → correct PIN unlocks → change PIN → disable → lock gone; plus the existing flows through the new Password-reset manager |
| Embedded sessions | `npm run test:embedded` | PASS ×3 (cookies / no-cookies / no-storage — the lock stays off when storage is unavailable) |
| Accessibility (axe WCAG A/AA) | `npm run test:accessibility` | 28 screens, 0 rule violations |
| Language | `npm run test:language` | PASS — one language at a time on every remaining screen |
| Village workflow | `npm run test:village` | PASS — enrollment → verification → final approval → proposals → rejection ledger; the manager is now the dropdown design with 7 fixed villages and no add form |
| Materials/a11y fallback | `npm run test:materials` | PASS — 20 states |
| Dependency audit | `npm audit --audit-level=moderate` | 0 vulnerabilities |

## 3. Android project inspection (item 6)

- **Framework:** hybrid Android WebView app (Kotlin `MainActivity` + WebView
  bridge) wrapping the community web app (React inside a custom
  design-component runtime, no React Native).
- **Backend:** the project's own Node.js server (`server/`, Express 5 +
  `node:sqlite`), self-hostable. **No backend change was needed** — the
  existing server already enforces every rule below, so no new service or
  account was created and nothing paid was enabled.
- **Authentication:** session cookies (httpOnly, SameSite) — hidden sun-tap
  gate + 4-digit code + password for the main administrator; phone-number +
  password for village administrators; enrollment requests for members.
- **Package name / app name:** unchanged — `com.mvpmi.community` (see
  `android/app/build.gradle.kts`), app label "MVPMI Test". No renaming, no
  new branding.
- **Build process:** Gradle 8.11.1, JDK 17, `assembleDebug` in CI
  (`.github/workflows/quality.yml`) with Android Lint, Kotlin unit tests and
  `apksigner` signature verification.
- **Signing:** debug key only. A signed **release** APK is intentionally
  blocked by the release-readiness guard (see `docs/RELEASE_AUDIT.md` —
  SMS identity verification and production hosting are still pending owner
  decisions). The debug APK is clearly labelled a test build; it is
  suitable for this closed beta, not for store distribution.
- **Working vs mock:** directory, enrollment pipeline, verification chain,
  proposals, rejection ledger, archive, reports (PDF/CSV/Excel), backup,
  app lock and OS notifications are real, server-backed features. The admin
  password-reset OTP screen and SMS recovery remain placeholders (no SMS
  provider configured — documented, not claimed). The APK prompts for the
  test-server address at first launch; it does not ship mock data.

## 4. Access rules verified (backend-enforced, re-tested this round)

- Village list fixed at seven; requests stored separately from approved
  members; request states: submitted → checked & forwarded → finally
  approved / rejected (tests/village-approval.test.mjs).
- A village administrator sees only their own village's queue and cannot
  make the final decision; only the central administrator adds members.
- Applicants cannot browse other requests; pending/rejected requests never
  appear in the directory; signed-out users read nothing.
- Ordinary users cannot change their own role or village (server rejects
  injected fields — tests/api.test.mjs, tests/security.test.mjs).
- Privacy: the "approved members can see phone numbers" notice is shown at
  enrollment; only verification/directory data is collected; test data uses
  dummy numbers; passwords/tokens are never logged; full phone numbers are
  not written to logs.

## 5. Remaining setup the owner must do (not done here, nothing invented)

**Closed-app push notifications (Firebase, free plan):** while the app is
open, notifications arrive via the Android system notification channel
(verified). When the app is closed, no code runs to receive them. To add
FCM push:

1. Create a free project at console.firebase.google.com (no payment method;
   the Spark plan is free).
2. Add an Android app with package name `com.mvpmi.community` and download
   `google-services.json`.
3. Send me the file (it contains no private keys) — I will wire the FCM
   token registration and the server-side send. Email/password or no auth
   is fine; **SMS will not be used** (it can incur charges).

**Production hosting:** the test server runs on your computer. For real
use the Node server needs a host (any free-tier Node host works); this is
an owner decision listed in `docs/RELEASE_AUDIT.md`.

## 6. Live verification beyond the suites

On the running preview (both themes): 6 dashboard tiles, no bell, no
notifications screen; the Password-reset manager renders 7 villages in a
dropdown, no add form, eye toggles reveal typed passwords; **a stubbed
Android bridge received exactly one system notification** —
"નવી નોંધણી વિનંતી આવી / New enrollment request" — when a new member applied
(after fixing a flood bug: signing in used to notify for every pre-existing
item; identity changes now re-baseline silently); VA sign-out lands on the
member list for member sessions; the app lock locks on reload, blocks all
data, unlocks with the PIN, changes and disables correctly. Zero page
errors in every probed session.

## 7. Not verified (honest limits)

- Real-device behaviour: installation, upgrade, Android back/predictive
  back, TalkBack, system notification appearance (the stub proves the call,
  not the OS rendering), 200 % OS font, notched layouts — manual checklist
  items in `docs/BETA_TEST_CHECKLIST.md`.
- Closed-app push: requires Firebase (§5).
- Release APK: blocked by the release audit until SMS identity and hosting
  are decided.
- The pure-JS PBKDF2 was verified against Node's crypto at 1, 2, 1000 and
  50,000 default iterations; timing on low-end phones not measured.

## 8. Reproduction fingerprints

- Tag `v0.3.3-beta.1` · version 0.3.3 · versionCode 7
- `npm run check` exit 0 · Node 103/103 · a11y 28 screens/0 violations ·
  materials 20 · audit 0 vulnerabilities
- Manual checklist for the central administrator and all seven village
  administrators: `docs/BETA_TEST_CHECKLIST.md` (logins listed there).
