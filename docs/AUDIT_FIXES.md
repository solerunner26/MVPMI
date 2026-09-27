# Full audit fixes — v0.4.0 (23 September 2026)

Checkpoint before any change: git tag **`Pre-Full-Audit-Fix`** (= `628bb71`,
v0.3.4). All work is on branch `fix/full-audit` in small commits, so every
change can be compared (`git diff Pre-Full-Audit-Fix`) or undone.

## A. Owner requirements that were not met

| # | Problem | Fix | Proof |
|---|---|---|---|
| 1 | Passcode lock optional, hidden in settings, off by default | PIN is **mandatory** for every approved member and signed-in village admin; the app shows "Create a four-digit PIN" right after approval | `tests/app-lock-server.test.mjs`, `scripts/app-lock-test.mjs` |
| 2 | Lock bypass: an open Call/WhatsApp sheet stayed usable under the lock | Locking closes every sheet, dialog and panel; no `tel:` link exists under the lock | browser test step 2 |
| 3 | 5 wrong PINs reset by reloading; PIN hash in localStorage; lock removable by clearing storage | PIN checked **on the server** (scrypt). While locked the server sends **no member records**. Wrong PINs: 5 → 1 min wait, then 2, 4, 8… up to 60 min; 15 → only a reset code opens it | server + browser tests |
| 4 | No lock while the app stays open | Locks on every app start, after 30 s in the background, and after 3 idle minutes | browser test steps 2, 4, 5 |
| 5 | Mobile-number change skipped the village admin | Number (and second-number) changes now go to the member's village admin first, then the main admin. A village admin's own change goes to the main admin directly. The village admin sees "old → new" and is asked to call the member | `audit-fixes` tests 1–2, updated `api.test.mjs` |
| 6 | Server refused to run in real (live) mode; waited for an SMS step that did not exist | Identity = in-person verification by the village admin + main-admin approval (no SMS cost). Live mode runs and **requires HTTPS**; the development-only session transport is off in live mode | `tests/delivery.test.mjs` |
| 7 | Forgot PIN = apply again from scratch | "Forgot PIN?" → call your village admin → they create a one-time 6-digit code (15 min, single use) → new PIN. The main admin can create codes too ("Member PIN reset" tab). Signing out stays as a last option | server + browser tests |

## B. Coding errors

| # | Problem | Fix |
|---|---|---|
| 8 | Backups with village-admin proposals / device-replacement applications could not be restored; restore wiped village-admin passwords; older backups failed confirmation | Allowlist extended; device claims accepted; passwords kept for the same assigned person; confirmation digest taken from the uploaded file; village-admin sessions end after restore |
| 9 | Behind GoDaddy's proxy all visitors shared one rate-limit bucket | `TRUST_PROXY` (auto under Passenger) → per-visitor limits; when the address is hidden the app uses per-session + site-wide failure limits instead of one shared bucket; `/api/health` shows which is active |
| 10 | Anyone could lock out the main admin (global login counter before the gate) and village admins (per-number counter) | Gate checked first; only **failed** logins are counted; village-admin failures are limited per number **and** per visitor |
| 11 | Replacing a village admin stranded forwarded requests | Requests return to the new admin's queue |
| 12 | Password reset / re-assignment didn't end village-admin sessions | Session stores assignment version + password date; any change ends other sessions immediately |
| 13 | Withdrawn / replaced applications flagged as "rejected before" | Only real rejections flag a number; declined change requests never enter the rejection ledger |
| 14 | Pasted "+91 98250 14523" saved as "91982 50145" | `phoneDigits()` removes +91 / 0 prefixes in the form and profile editor |
| 15 | Village admin had to log in with the old number after a number change | Sign-in follows the member's current number |
| 16 | Device replacement deleted the second number and location | Kept and moved to the new phone; old-device requests closed |
| + | Session id not changed at sign-in (fixation) | Rotated at main-admin and village-admin sign-in |
| + | Admin backup/export could be triggered by a cross-site link | Admin downloads need the app header; live cookies are `SameSite=Lax` |
| + | Sessions/limits never cleaned; every crawler request stored a session | Hourly cleanup (expired sessions, idle anonymous sessions after 2 days, old limits, 60-day-old notifications) |
| + | Duplicate-number checks outside the transaction | Moved inside |
| + | CSV reports could carry spreadsheet formulas | Cells starting with = + - @ are stored as text |
| + | Origin check broke behind a proxy that rewrites Host | Forwarded host (and optional `PUBLIC_HOSTS`) accepted |
| + | `PORT` as a socket path crashed; paths depended on the working folder | Socket paths supported; `dist/` and database resolved from the project folder; `app.cjs` loads the server in the same process (Passenger-safe) |

## C. Android app

| # | Problem | Fix |
|---|---|---|
| 17 | New signing key on every build → updates would not install | Release APK signed with **one permanent key** from GitHub secrets (`docs/ANDROID_RELEASE.md`); `versionCode` grows with each build |
| 18 | Only a debuggable test build existed (test bar, "Server" button, USB data access) | Real release build (not debuggable, no test bar, no server button, no WebView debugging) |
| 19 | Screenshots/recents preview showed numbers | `FLAG_SECURE` |
| 20 | Missing server URL built a broken app; sub-folder URLs failed at runtime | Build fails with a clear message unless the URL is an HTTPS site root |
| 21 | Invisible status-bar icons on Android 15+ | Brand-coloured status bar and dark navigation bar drawn behind the icons |
| 22 | Raw GoDaddy error pages; offline message blamed the "test server" | Friendly bilingual messages for server errors (5xx) and no internet; Back on the error screen leaves the app |
| + | Numbers copied to the clipboard on every call | Removed (web and Android) |
| + | Notification permission asked at first launch; notifications overwrote each other | Asked after applying/signing in; one notification per event |
| + | Dark-mode switch reloaded the page; Android 12+ device transfer copied cookies | More config changes handled; backup and device transfer excluded |
| + | Old phones (≤ 7.1) cannot verify Let's Encrypt certificates | ISRG Root X1 bundled via network security config |
| + | CI built the APK even when tests failed; `test:village` never ran; write permission on every run | Android job needs the test job; `test:village` and `test:lock` run; only the tag-publish job can write |

## D. Design

| # | Problem | Fix |
|---|---|---|
| 23 | 12 px form captions | Minimum 14 px (scales with the text-size slider) |
| 24 | Name order First → Surname, middle optional | First → Middle (father's) → Surname, one per row, all required in the form |
| 25 | Hidden main-admin entry only | "Main administrator sign in" button inside the admin sign-in panel (the 5-tap gesture still works) |
| 26 | Unlabelled lock keypad; "Visual effects" row spacing | Keys labelled ("Delete last digit"…); row padding and focus ring fixed |
| 27 | Design dossier out of date | Addendum at the end of `MVPMl-design-dossier.md` |

## E. New: system notifications (free)

Server events create notifications for the right people only. Text contains
names and villages, **never phone numbers**.

| Event | Who is notified |
|---|---|
| New application / number or village change | That village's administrator |
| Village admin forwards | Main administrator + the applicant ("verified, waiting for final approval") |
| Approved | Applicant ("Welcome…set your PIN") + village administrator ("new member added") |
| Rejected / not accepted | Applicant (with the reason) |
| Change approved, removal, admin removal | The member |
| Change/removal proposals, member asks to be removed | Main administrator (+ village admin for removals) |
| Wrong access codes / failed admin logins | Main administrator (at most one alert per 10 minutes) |
| PIN reset code created | The member |

Delivery: **Android app** — background check about every 15 minutes plus
immediately on opening (JobScheduler, no Firebase). **Browser / home-screen
app** — standard Web Push with keys generated on the server (Chrome on
Android, Edge, Firefox; iPhone only when added to the Home Screen).
Turn on from Settings → Phone notifications, or when offered after applying
or signing in.

## F. Second review round (independent re-check of this branch)

| Found | Fix |
|---|---|
| Choosing a replacement village administrator crashed the admin screen (React hook inside a condition — present since v0.3.x) | Password field is now its own component |
| The lock relied on the phone to engage; killing the app left the session unlocked on the server | Server locks by itself: 30 s after the app reported going to the background, or 3 minutes without real activity (polls do not count) |
| Main-admin notification devices were removed by the cleanup after 2 days | Sessions with notifications on are kept |
| More than 20 waiting notifications: the oldest were skipped | Delivered oldest first, 20 at a time, none skipped |
| A request sent with the old cookie during sign-in could lose the member's identity | Old session id stays as a one-minute alias after rotation |
| A village administrator's own village move skipped the destination village | Only their own number change skips the village step |
| Number change stuck when the village has no administrator | Main administrator decides it directly |
| Internal request owner ids reached village administrators | Removed from their queue |
| Tag publish failed when no release key was configured | Fixed; debug APK still attached |

## Test evidence (this build, Linux sandbox)

- `npm test` — **125 passed** (server, security, workflow, lock, notifications, backups, Android static checks)
- Browser suites passed: `test:ui`, `test:lock` (new), `test:embedded` (3 modes), `test:accessibility` (29 screens, 0 violations), `test:language`, `test:village`, `test:materials`
- `npm audit` — 0 vulnerabilities

Not possible in this sandbox (Google/Maven downloads are blocked here): compiling the
Android app. GitHub Actions compiles, lints and unit-tests it on every push.
Release testing: see `RELEASE_TESTING.md`.
