# MVPMI v0.3.4 — Test & Verification Report

Date: 23 Sep 2026 · Build: versionName 0.3.4-dev, versionCode 8 ·
Package: `com.mvpmi.community` (unchanged) · App name: "MVPMI Test"
(unchanged).

This release has two changes requested by the owner:

1. An emblem image inside the brown "ADMIN PANEL" card on the main-admin
   login page.
2. The SMS/OTP "forgot password" service is **removed** and replaced by an
   offline **recovery code** (no SMS cost, no phone number, more secure).
   The main administrator changes the password from the "Forgot password?"
   link on the admin-panel login page.

## How to verify everything in this report

Run the same commands CI runs (`npm ci && npm run build && node --test
tests/` plus the browser suites). Fingerprints are in §6. Every claim below
was produced by a command that was actually executed; anything not executed
is listed in §5.

## 1. What changed (item by item)

| # | Change | Where |
|---|--------|-------|
| 1 | Round golden sun emblem (`/brand/admin-emblem.png`, 256×256, ~128 KB) at the top of the brown ADMIN PANEL card; CSS-cropped circle, gold ring, fits inside the card | `Community Directory.dc.html`, `web/brand/` |
| 2 | SMS adapter deleted (`server/sms.mjs`, `SMS_WEBHOOK_*`/`ADMIN_PHONE` env, adapter tests). No SMS/OTP code path remains anywhere | `server/`, `.env.example`, `tests/delivery.test.mjs` |
| 3 | Recovery code: 16 chars from a 31-symbol unambiguous alphabet (Crockford-style, no I/L/O/U) = 80 bits, generated with `crypto.randomBytes(10)`; stored **scrypt-hashed**, never plaintext | `server/app.mjs` |
| 4 | `POST /api/admin/recover` (login page): requires the access gate (or an admin session), normalizes dashed input, verifies the code, enforces the strong-password rule, sets the new password, **rotates** to a fresh code, revokes every admin session (the resetting device keeps only its gate), returns the new code once | `server/app.mjs` |
| 5 | Auto-issue at first sign-in: if no recovery hash exists, the login response carries the code once; the client shows a "રિકવરી કોડ સાચવો / Save your recovery code" dialog. Later sign-ins never resend it | `server/app.mjs`, `web/controller.js` |
| 6 | `POST /api/admin/recovery/regenerate` (admin-only): new code from the Security tab, with a confirmation dialog; old code dies immediately | `server/app.mjs`, Security tab card |
| 7 | Reset screen rebuilt: recovery-code field + new-password field, both masked with eye toggles, strength meter, inline bilingual errors, success panel with the rotated code | `Community Directory.dc.html`, `web/controller.js` |
| 8 | Abuse limits: per-session rate (10/15 min), global rate (20/h), 5 wrong codes → 15-minute global lock; every wrong code raises a security alert like other failed credentials | `server/app.mjs` |

## 2. Automated suites (all green)

Run with `npm ci && npm run build && npm test` on Node 22 — **100/100
passing** (SMS/OTP-era tests removed with the service; recovery tests
added):

- `tests/api.test.mjs` — new recovery test: gate required, regenerate
  issues a 16-char code, hash-not-plaintext at rest, wrong code 401, weak
  password 400, dashed input accepted, success rotates the code, other
  sessions revoked, old code dead, new code works.
- `tests/security.test.mjs` — recovery endpoints added to the
  admin-protected and malformed-body sweeps; new tests: rate limit + 5-strike
  15-minute lock (also for correct codes and new sessions during the lock),
  alerts on wrong codes, code never in stored records/responses/errors,
  session/gate revocation rules.
- `tests/delivery.test.mjs` — SMS adapter tests deleted with the service;
  the production-startup guard test is kept.
- All other suites unchanged and passing (village approval, app lock,
  bilingual view, contact actions, android config, …).

Browser suites, all green: ui-test **with the full recovery E2E**
(first-login notice → Security-tab regenerate → sign out → forgot
password → new password → sign back in; emblem image asserted to load),
accessibility-test (**29 screens, 0 rule violations** — the notice dialog
is scanned), language-test (admin sections in both languages),
embedded-login-test (×3 modes), village-workflow-test, material-test
(20 states).

## 3. Design decisions worth knowing

- **Why a recovery code is more secure than SMS OTP:** SMS codes are ~20
  bits and SIM-swappable; the recovery code is 80 bits, works offline, has
  no phone-number dependency and no per-message cost. Rotation on every use
  means a code seen over someone's shoulder is already dead after a reset.
- **Where the code lives:** only as a scrypt hash in the `config` table.
  The plaintext exists exactly twice — once in the response when issued,
  once on the administrator's paper.
- **Bootstrap:** accounts created before v0.3.4 have no recovery code; the
  first sign-in after upgrading shows the save dialog once. If the password
  is forgotten *before* that first sign-in happens, the operator must reset
  `data/community.sqlite`'s admin config — documented, not hidden.
- **Emblem accessibility:** the image is decorative (`alt=""`); the card
  still carries the "ADMIN PANEL" text and "RESTRICTED ACCESS" line.

## 4. Not verified (honest limits)

- **CI flake, root-caused and fixed:** the `main`-branch CI run for this
  commit failed once in `npm run test:language` ("fresh signup visible
  gu"). Reproduced locally ~3/40 fresh page loads: the test's bare
  `:visible`-`count()` does not retry and ran between the header mounting
  and the first layout of the page content, counting zero visible
  Gujarati spans even though the app was correctly in Gujarati (elements
  laid out milliseconds later). This is a test race, not an app bug. Fix:
  wait for the first visible span before counting
  (`scripts/language-test.mjs`, `selectedLanguage`). After the fix: 0/40
  reproductions; the same assertion in repeated full runs passes.
- The emblem's artistic quality is a visual judgement — pixel/palette
  checks (dark-brown background matching the card, gold sun, 4-way radial
  symmetry) were automated, but the owner should eyeball it on a phone.
- Real-device Android checks remain outstanding (debug APK only; same
  standing limits as TEST_REPORT_v033.md §7).
- Closed-app push still awaits the owner's Firebase project (unchanged;
  see TEST_REPORT_v033.md §5).

## 5. Reproduction fingerprints

- `npm test` → **100/100 pass** (Node 22).
- `npm run build` → dist/index.html contains exactly one
  `img src="/brand/admin-emblem.png"` (inside `.admin-signin-heading`) and
  no `resetOtp`/`sendReset`/`admin/reset` references.
- `grep -ri "sms" server/` → no matches (adapter deleted).
- Release: v0.3.4-beta.1 APK + SHA256SUMS.txt + BUILD-INFO.txt published
  by CI on the tag.
