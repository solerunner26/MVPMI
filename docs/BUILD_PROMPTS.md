# Community Directory — Complete App-Building Prompt Pack

**Project:** Mahuva Vala Rajput Samaj — Community Phone Directory (codename MVPMI)
**Owner:** Jaldip Vala · **Prepared:** 30 September 2026 · **Based on:** working app v1.3.0-alpha.1
**Purpose:** rebuild the same app, module by module, with any AI coding system, then keep adding upgrades.

---

## How to use this pack

1. **Start every new AI chat by pasting Prompt 0 (Master Context).** It is the single source of truth. Every module prompt assumes it.
2. Then paste **one module prompt at a time**, in the order below. Do not paste several modules at once. The AI builds better in small, testable steps.
3. After each module, ask the AI to **run the acceptance checks** at the end of that prompt and show you the result (screenshots or test output). Move on only when all checks pass.
4. Attach your design references when you reach Module 14 (and ideally from the start): `design.md`, the 63-screen walkthrough, and your Claude Design screens (see "Your design work" below).
5. Keep a `DECISIONS.md` file in the project. Every time you decide something (colour, rule, wording), ask the AI to write it there. This stops later chats from "undoing" your choices.
6. Words in `CAPITALS_WITH_UNDERSCORES` are fixed names (roles, statuses). Ask the AI to use them exactly.

### Module order

| # | Module | Depends on |
|---|---|---|
| 0 | Master context (paste first, every chat) | — |
| 1 | Project setup, stack and free tools | 0 |
| 2 | Database, free backend and master data | 1 |
| 3 | Roles, rights and permissions (RBAC) | 2 |
| 4 | Login, sessions and account security (per role) | 3 |
| 5 | Registration and two-stage approval | 4 |
| 6 | Member Directory (home screen) | 5 |
| 7 | My Profile, change and removal requests | 6 |
| 8 | Village Admin tools | 5, 7 |
| 9 | Main Admin console | 8 |
| 10 | Reports, export, backup and restore | 9 |
| 11 | Notifications | 5–9 |
| 12 | Optional app lock and on-phone privacy | 4 |
| 13 | Offline mode and sync | 6 |
| 14 | Design system and "visual treat" | all screens |
| 15 | Gujarati / English language | all screens |
| 16 | Android app shell, permissions and device features | 1 |
| 17 | Security hardening and privacy law | all |
| 18 | Testing and quality | all |
| 19 | Build, signing, release and updates | 16, 18 |
| 20 | Hosting, operations, monitoring and hand-over | 2, 10 |
| — | Lessons learned (bugs found in v1.2 — must not repeat) | all |
| — | Future upgrades backlog | — |

---

## Your design work (reference material to give the AI)

- **Claude Design** screens made by you for this app: the original "Community Directory" design (Gujarati-first, warm saffron/brick "liquid glass" style, sun mark logo, glass cards and capsule buttons). Export them as images or share the design link with the AI in Module 14.
- **`design.md`** (in the repository `docs/design.md` and in this Claude Project): exact colours, fonts, sizes, shapes, motion, components, header layout and your owner decisions.
- **63-screen walkthrough** (Claude artifact "MVPMI App Walkthrough"): every screen of v1.2.0-alpha.3 in the order people use it. Give it to the AI as "the screens the rebuild must at least match".
- **Owner design decisions already taken (keep them):** saffron/brick identity (not purple); Gujarati default with an English switch; directory header in three lines exactly as in Module 6; your own name in green, every admin's name in red, no "You" label; language and dark-mode buttons live in the directory header, not in Settings; Manage Village Admins uses a village drop-down, not seven tiles; text-size control has a Reset (100%) button.
- **Note:** the Claude Project description mentions "blue and teal accents". The built app and your later decision use **saffron/brick**. Decide once and record it in `DECISIONS.md` before Module 14. This pack assumes saffron/brick.

---

## Prompt 0 — Master Context (paste first in every chat)

```text
You are a senior Android + backend engineer and product designer. We are building a
PRIVATE, TRUSTED COMMUNITY PHONE DIRECTORY app. Read this whole brief before writing
code. Never change a rule written here without asking me first; if something is
unclear, ask me one question, then continue.

1. PURPOSE
Members of the Mahuva Vala Rajput Samaj (Mahuva taluka, Bhavnagar district,
Gujarat, India) find and contact each other. Administrators keep the information
accurate and control who gets in. Focus: easy community connections, verified
membership, controlled access to personal information, zero running cost.

2. PLATFORM
- Android 10 (API 29) to Android 17 (API 37). Phones from 5" to 6.8", 320–480 dp wide,
  portrait first, landscape must not break.
- Must work on low-end phones (2 GB RAM) and slow mobile data (2G/3G), and on phones
  whose Android System WebView / Chrome is old (if any web view is used).
- Distributed first as an APK by link (WhatsApp/website); Google Play later.

3. LANGUAGE
Gujarati is the default for every screen, message, error, notification and export.
One tap switches to English. Both are written properly by a person, not machine-mixed.
Numbers and phone numbers stay in Latin digits (0–9) unless I say otherwise.

4. MASTER DATA (fixed, editable only by the Main Admin)
District: Bhavnagar (ભાવનગર). Taluka: Mahuva (મહુવા).
Villages (order matters, Gujarati / English):
  1 થોરાળા / Thorala      2 સથરા / Sathra        3 તરેડી / Taredi
  4 લીલવણ / Lilvan        5 દૂધાળા નં 1 / Dudhala No 1
  6 તલગાજરડા / Talgajarada 7 જીંજકા / Jinjaka   (old spelling ઝીંજકા / Zinzaka = alias)
Design the data so more villages, talukas and districts can be added later.

5. USERS AND ROLES (exact names)
- GUEST: not logged in. Sees only Login, Register, "Contact admin". Sees NO member data.
- APPLICANT: has registered, status PENDING. Sees only their own application.
- MEMBER: approved person. Sees the directory, own profile, can call/WhatsApp.
- VILLAGE_ADMIN: a MEMBER who manages ONE village (one active admin per village).
- MAIN_ADMIN: the single top administrator (Girvansinh Vala, Thorala; mobile set in
  server config, never hard-coded). A second backup MAIN_ADMIN may be added later.
Statuses of a person: PENDING, APPROVED, REJECTED, REMOVED (and WITHDRAWN for an
application the person cancelled).

6. CORE FLOWS
- Register → Village Admin of that village verifies identity and forwards → Main Admin
  gives final approval → the person's phone is logged in automatically.
- Members request profile changes and removal; Village Admins propose changes/removals
  for their village; Main Admin decides.
- Main Admin manages members, Village Admins, master data, reports, exports, backups.

7. NON-NEGOTIABLES
- Security by default: every rule is enforced on the SERVER/DATABASE (row-level
  security), never only in the app screen.
- Privacy: no phone number ever appears in a notification, a log file, an analytics
  event or a URL. Numbers are never copied to the clipboard automatically.
- Zero cost: use only free tiers listed in Module 1. Warn me before anything that
  could cost money.
- Accessibility: every tap target ≥ 48 dp; text-size setting 85–165%; works with
  TalkBack; contrast WCAG AA in light and dark themes.
- Errors: always show WHAT went wrong and WHAT to do, in the user's language, at the
  top of the screen; never lose what the user typed.
- Every screen: Gujarati + English, light + dark, 320/360/412 dp widths, 85–165% text,
  no text overlapping buttons, no sideways scrolling.
- Keep a DECISIONS.md and a CHANGELOG.md updated with every change.

8. HOW TO WORK WITH ME
I am not a programmer. Explain in simple words. For anything I must do (accounts,
keys, server commands), give numbered click-by-click steps. Show screenshots of
finished screens. Never delete data without a backup and my written "yes".
```

---

## Prompt 1 — Project setup, technology stack and free tools

```text
MODULE 1: PROJECT SETUP.
Set up the project with this stack (all free):

APP
- Flutter (latest stable) with Dart, Material 3, targeting Android minSdk 29,
  targetSdk/compileSdk = latest stable Android. One app for all roles; screens and
  buttons appear by role. Keep the code ready for a Flutter Web admin panel later.
- State management: Riverpod. Routing: go_router with role-based route guards.
- Local storage: drift (SQLite) for the offline copy; flutter_secure_storage (Android
  Keystore) for tokens and keys.

BACKEND (choose A; B is the self-hosted fallback — ask me before switching)
- A) Supabase FREE plan: PostgreSQL database, Auth, Row Level Security, Storage,
     Edge Functions, Realtime. Note: free projects PAUSE after about a week with no
     activity — add a free GitHub Actions scheduled job that calls a health endpoint
     daily so it never pauses. Free limits (check current values): ~500 MB database,
     ~1 GB file storage, ~50,000 monthly active users.
- B) PocketBase (free, open source, single binary, SQLite, auth, API rules) on my
     existing Google Cloud "Always Free" e2-micro VM (us-west1), behind Caddy (free
     automatic HTTPS) at a sub-domain of my domain kavigsv.com. No pausing.

OTHER FREE SERVICES
- Google Sign-In via Android Credential Manager (free) — see Module 4.
- Firebase (Spark free plan): Cloud Messaging (push notifications), Crashlytics (crash
  reports), App Check with Play Integrity (blocks fake/modified apps). Do NOT use
  Firebase phone-number OTP unless I approve (SMS can cost money).
- Google Drive API (free, my Google account) for encrypted nightly backups.
- GitHub (private repository) + GitHub Actions (free minutes) for CI/CD, tests and
  building the signed APK. GitHub Releases for APK download links.
- Cloudflare free (optional): DNS and DDoS protection for the domain.
- UptimeRobot free: checks the backend every 5 minutes and emails me if it is down.
- Figma free / Claude Design: design files.

REPOSITORY LAYOUT
/app (Flutter)  /backend (SQL migrations, RLS policies, Edge Functions or PocketBase
hooks)  /docs (DECISIONS.md, CHANGELOG.md, design.md, SECURITY.md, RUNBOOK.md)
/scripts  /.github/workflows

ENVIRONMENTS
- dev (local), test (CI with synthetic data), prod (live). Separate projects/keys.
  Server address, keys and admin mobile come from environment config, never from code.
- .gitignore all secrets; add a secret-scanning step in CI.

DELIVER: the empty app running on an emulator showing a Gujarati splash + "Hello",
the backend reachable over HTTPS, CI running on every push, and a README with
click-by-click setup steps for me.

ACCEPTANCE: app builds in CI; `flutter analyze` has zero issues; health endpoint
returns OK over HTTPS; no secret in the repository.
```

---

## Prompt 2 — Database, free backend and master data

```text
MODULE 2: DATABASE.
Create migrations (SQL for Supabase / collections for PocketBase) for:

districts(id, name_gu, name_en, active)
talukas(id, district_id, name_gu, name_en, active)
villages(id, taluka_id, name_gu, name_en, sort_order, active, aliases[])
  — seed the 7 villages, Mahuva, Bhavnagar from the Master Context.
people(id, auth_user_id NULL until linked, first_name, middle_name, surname,
  first_name_gu, middle_name_gu, surname_gu (optional Gujarati spelling),
  phone (10 digits, starts 6–9, UNIQUE among non-removed), phone2 (optional,
  different), phone2_label (home/work/other), village_id, current_location (optional,
  max 120 chars), gender (optional), photo_url (optional, later),
  show_phone2 (bool), status PENDING|APPROVED|REJECTED|REMOVED|WITHDRAWN,
  consent_at, consent_version, approved_at, approved_by, created_at, updated_at)
roles(person_id, role MEMBER|VILLAGE_ADMIN|MAIN_ADMIN, village_id (for VILLAGE_ADMIN),
  active, granted_by, granted_at, revoked_at) — one ACTIVE VILLAGE_ADMIN per village.
requests(id, kind NEW|UPDATE|REMOVE, person_id, payload JSON (proposed values),
  reason, stage WAITING_VILLAGE|WAITING_MAIN|APPROVED|REJECTED|CLOSED|WITHDRAWN,
  created_by, village_verified_by, village_verified_at, identity_confirmed bool,
  decided_by, decided_at, decision_reason, created_at)
rejections / archive(person snapshot, reason, removed_by, removed_at, allow_rejoin)
devices(id, person_id, device_name, platform, app_version, push_token_hash,
  first_seen, last_seen, trusted bool, revoked_at)
sessions / refresh tokens (managed by Auth), app_lock(person_id, device_id,
  pin_hash, biometric_key_hash, enabled)
notifications(id, person_id, kind, title_gu, title_en, body_gu, body_en, read_at,
  created_at)  — NEVER store phone numbers in notification text.
audit_log(id, actor_person_id, actor_role, action, target_type, target_id,
  before JSON, after JSON (phone numbers masked), ip_hash, device_id, created_at)
  — append-only (no UPDATE/DELETE allowed, even for admins).
security_events(id, kind LOGIN_FAILED|LOCKOUT|NEW_DEVICE|ROLE_CHANGED|EXPORT|
  RESTORE|RLS_DENIED|INTEGRITY_FAILED, person_id, detail, created_at)
settings(key, value) — backup settings, privacy contact, app minimum version.

RULES
- All timestamps UTC; show in Asia/Kolkata.
- Validate everything on the server: names 2–60 letters (Gujarati or English), phone
  regex ^[6-9][0-9]{9}$, both phones different, village must exist and be active.
- Indexes for search on name (Gujarati + English), phone, village.
- Enable Row Level Security on EVERY table (policies come in Module 3).
- Soft-delete people (status REMOVED + archive); hard delete only through the
  "delete my data" process (Module 17).
- A seed script for TEST data (synthetic names, numbers 97000xxxxx) that can never
  run against prod.

DELIVER: migrations, seed, an entity diagram (image or Mermaid), and a data
dictionary in docs.
ACCEPTANCE: migrations apply cleanly on an empty database; seed loads; a query as an
anonymous user returns ZERO rows from every table.
```

---

## Prompt 3 — Roles, rights and access permissions (RBAC)

```text
MODULE 3: ROLES AND PERMISSIONS. Implement exactly this matrix, enforced in the
database (Row Level Security / API rules) AND reflected in the app (hide what a role
cannot do). The app hiding a button is NOT security; the database rule is.

Legend: ✔ allowed · ✖ not allowed · "own" = only their own record ·
"village" = only people of the village they administer.

| Capability                                   | GUEST | APPLICANT | MEMBER | VILLAGE_ADMIN | MAIN_ADMIN |
|----------------------------------------------|-------|-----------|--------|---------------|------------|
| See Login / Register / Contact admin         | ✔     | ✔         | ✔      | ✔             | ✔          |
| Submit a registration                         | ✔     | ✖ (has one)| ✖     | ✖             | ✖          |
| See / edit / withdraw own application         | ✖     | own       | ✖      | ✖             | ✖          |
| See the member directory (APPROVED only)      | ✖     | ✖         | ✔      | ✔             | ✔          |
| See phone2 of others                          | ✖     | ✖         | if shared | ✔ village  | ✔          |
| Call / WhatsApp a member                      | ✖     | ✖         | ✔      | ✔             | ✔          |
| See admins list (Main + Village Admins)       | ✖     | ✔ (contact)| ✔     | ✔             | ✔          |
| See own profile                               | ✖     | own       | own    | own           | own        |
| Request change of own profile                 | ✖     | ✖         | own    | own           | edits directly |
| Request own removal                           | ✖     | ✖         | own    | own           | ✖ (must hand over first) |
| See pending registrations                     | ✖     | ✖         | ✖      | village       | ✔ all      |
| Verify identity & forward registration        | ✖     | ✖         | ✖      | village       | ✔          |
| Reject registration (reason ≥ 5 chars)        | ✖     | ✖         | ✖      | village       | ✔          |
| Correct details in a pending registration     | ✖     | ✖         | ✖      | village       | ✔          |
| FINAL approval of registration                | ✖     | ✖         | ✖      | ✖             | ✔ (only after village verification) |
| Propose change / removal of a member          | ✖     | ✖         | ✖      | village       | ✔ (decides directly) |
| Approve change / removal requests             | ✖     | ✖         | ✖      | ✖             | ✔          |
| Edit any member directly                      | ✖     | ✖         | ✖      | ✖             | ✔          |
| Create / edit / disable / enable Village Admin| ✖     | ✖         | ✖      | ✖             | ✔          |
| Allow rejoin (rejected / removed person)      | ✖     | ✖         | ✖      | ✖             | ✔          |
| Manage villages / talukas / districts         | ✖     | ✖         | ✖      | ✖             | ✔          |
| Reports, exports (PDF/Excel/CSV/JSON)         | ✖     | ✖         | ✖      | village list PDF only (optional, off by default) | ✔ |
| Backup / restore                              | ✖     | ✖         | ✖      | ✖             | ✔ (restore needs step-up + typed confirmation) |
| See audit log & security alerts               | ✖     | ✖         | ✖      | own actions   | ✔          |
| Clear all directory data (hand-over)          | ✖     | ✖         | ✖      | ✖             | server console only, never in the app |
| Change own password / 2FA / devices           | ✖     | ✖         | devices | devices + PIN | ✔ all     |

EXTRA RULES
- One ACTIVE VILLAGE_ADMIN per village. A Village Admin is also a MEMBER of that
  village and appears in the directory with a red name.
- A Village Admin can never act on another village, never give final approval, never
  see audit logs of others, never export the whole directory.
- MAIN_ADMIN cannot remove or demote the last MAIN_ADMIN (prevents lock-out).
- Every privileged action writes an audit_log row (who, what, before/after, when).
- Disabling a Village Admin takes effect immediately (their open sessions lose admin
  rights at the next request).
- Status REMOVED or REJECTED people cannot log in; they see a clear message and
  "Contact your village admin".

DELIVER: RLS policies / API rules for every table, a role guard in the app router,
and automated tests that try EVERY cell of the matrix as every role (allowed must
succeed, not-allowed must be refused by the SERVER even when called directly).
ACCEPTANCE: the permission test suite passes 100%; a direct API call by a MEMBER to
approve a request is refused with 403 and logged in security_events.
```

---

## Prompt 4 — Login, sessions and account security (per role)

```text
MODULE 4: AUTHENTICATION. Our first version let members log in with only a mobile
number — anyone knowing a number could open the directory. Replace it with this
free, strong, simple design:

A) MEMBERS and APPLICANTS — "Continue with Google" (one tap)
- Android Credential Manager + Google Sign-In (free). Every Android phone already has
  a Google account, so there is nothing to remember and nothing to type.
- On REGISTER: the person signs in with Google, then fills the form (name, mobile,
  village…). The Google account is linked to the application.
- On APPROVAL: the Google account becomes the member's login. The Village Admin's
  identity check (they know the person, or call the mobile number) is what verifies
  the mobile number — no SMS needed.
- NEW PHONE: sign in with the same Google account → works. Different Google account
  → treated as a new applicant, OR the member asks their Village Admin to "move my
  login", which links the new Google account after the Village Admin confirms by a
  phone call (logged in audit_log).
- Fallback for a member without a usable Google account (ask me before building):
  mobile number + 6-digit PIN created at first login, reset only by the Village
  Admin after a phone call, 5 wrong tries → 15-minute wait.

B) VILLAGE_ADMIN — Google Sign-In + step-up
- Logs in with Google like a member.
- Opening Admin Tools and every decision (verify, forward, reject, propose) needs a
  STEP-UP: fingerprint/face (Android BiometricPrompt, class BIOMETRIC_STRONG) or a
  6-digit admin PIN (hashed with Argon2id/bcrypt, never stored in plain text).
- Step-up stays valid 10 minutes, then asks again.
- Admin rights only on devices marked TRUSTED by the Main Admin (first admin login
  on a new device creates a "new device" alert for the Main Admin).

C) MAIN_ADMIN — strongest
- Google Sign-In + password (min 10 chars, checked against breached-password list)
  + TOTP two-factor (free authenticator app: Google Authenticator / Microsoft
  Authenticator) OR a passkey (Credential Manager). 10 one-time recovery codes
  shown once at setup.
- First-time setup: a one-time setup link/code from server config; forces choosing
  password + 2FA before anything else.
- Step-up (biometric/2FA) for: exports, backup restore, role changes, member deletion,
  master data changes. Step-up valid 5 minutes.
- Email + push alert on every Main Admin login from a new device.
- Forgotten password: server-console reset only (documented in RUNBOOK.md), never
  through the app.

SESSIONS (all roles)
- Short-lived access token (15 min) + rotating refresh token (30 days members,
  7 days admins), stored ONLY in Android Keystore via flutter_secure_storage.
- Refresh-token reuse detection → revoke the whole session family.
- "My devices" screen: device name, last used, sign out one / all other devices.
  Main Admin can sign out any person's devices.
- On role change, disable, removal or rejection → all that person's sessions end.
- Rate limits (server side): login 10/min per device, 30/hour per IP; registration
  3/day per device; failed step-up 5 tries → 15-minute wait → security_event.
- Firebase App Check (Play Integrity) on every API call: modified or emulator-cloned
  apps are refused in prod (allowed in test).
- Sign out: "Sign out of this phone" clears tokens, offline copy and caches.

SCREENS: Login (Google button, language switch, "New member? Register", "Contact
admin"), Register, Pending approval, Blocked (rejected/removed) message, Main Admin
setup (password + 2FA QR + recovery codes), Step-up sheet, My devices.

DELIVER: all flows working on an emulator with test Google accounts; SECURITY.md
explaining each login type in simple words for me.
ACCEPTANCE: a member cannot log in with only a mobile number; a Village Admin cannot
approve without step-up; Main Admin without 2FA cannot reach the console; a stolen
refresh token used twice kills the session; tests prove each.
```

---

## Prompt 5 — Registration and two-stage approval

```text
MODULE 5: REGISTRATION AND APPROVAL.

REGISTER FORM (after Google sign-in): first name*, father's/middle name, surname*,
optional Gujarati spelling of the name, mobile*, second mobile (optional, with label
home/work/other and "show to members" switch), village* (drop-down of active
villages), current location/address (optional, 120 chars), consent checkbox*
("I agree that my name, mobile number and village are visible to approved community
members") with a link to the Privacy page. Validate live; keep typing on errors.

DUPLICATES (server side, clear messages):
- number PENDING → "Your registration is waiting for approval."
- APPROVED → "Already a member. Please log in."
- REJECTED → "Your registration was not approved. Contact your village admin." (can
  re-apply only if Main Admin used "Allow rejoin")
- REMOVED → "This number was removed. Contact your village admin."

STAGES
NEW → WAITING_VILLAGE (Village Admin of that village)
   Village Admin: "I independently confirmed this person's identity" checkbox +
   Verify & forward | Correct details | Reject (reason ≥ 5 chars) | Close.
   If the village has NO Village Admin → goes straight to WAITING_MAIN with a
   warning pill "No Village Admin — Main Admin verifies".
WAITING_MAIN (Main Admin) → Correct details | Reject | FINAL APPROVAL (only after
   village verification; if not verified, the button is disabled and the screen says
   WHY and shows the Village Admin's name with a Call button).
APPROVED → person becomes MEMBER; their phone logs in automatically ONCE and shows
   "Welcome — you are approved" ONCE (never again on later logins).
The applicant can edit or withdraw while PENDING. Each stage change notifies the
right people (Module 11) and writes audit_log.

UPDATE and REMOVE requests follow the same idea: Member or Village Admin proposes with
a reason → Main Admin decides. The form closes only after the server says "saved";
on failure it stays open with all typing kept and shows the reason at the top.

ACCEPTANCE: full flow tested end-to-end with 3 test accounts; every duplicate message
shown; failed network during submit keeps the form; approval notice shown exactly
once.
```

---

## Prompt 6 — Member Directory (home screen)

```text
MODULE 6: DIRECTORY. Home screen for MEMBER and above.

HEADER — exactly three lines (owner decision, 2 Oct 2026):
Line 1: [sun logo — the community's holy symbol, on a gold circular medallion]
  [community name — ALWAYS ONE LINE in both languages; shrink the font to fit]
Line 2: search box across the full width, magnifier inside, placeholder
  "નામ, નંબર કે ગામ શોધો" / "Search name, number or village" (falls back to
  "શોધો" / "Search" when it would be cut off at large text sizes).
Line 3: chips "All" + each village (scroll sideways), always visible. No filter icon.

BOTTOM NAVIGATION BAR (replaces the old header icon row):
Floating glass capsule above the system navigation bar (window insets), five tabs:
My Profile · Settings (members) / Admin Tools with a badge (admins) · SEARCH raised
in the centre on the brand gradient (focuses the search box) · Dark/Light theme
(toggle) · Language (toggle; label = the language you switch TO).
Outlined icons when inactive, Filled inside a rounded pill when active; spring
transitions; light haptic tick. "Liquid crystal" glass: live backdrop blur of the
page behind (~30 dp), white 15 % overlay, glossy top highlight, thin glowing rim;
solid tinted fallback where blur is unavailable. The list scrolls under it. Shown on
Directory, My Profile, Settings, Admin; hidden on splash, with the keyboard open and
under sheets/dialogs. Android: Jetpack Compose Material 3 NavigationBar in a
reusable, state-driven AdvancedBottomNavigationBar composable (Haze for the blur).

SPLASH (Android app, each start): deity image in a tall arch with a gold rim and a
soft glow, the sun medallion over its foot (slowly turning), one-line community
name, "ભાવનગર જિલ્લો • સંગઠન, સંસ્કાર અને સેવા", member counts, a big
"પ્રવેશ કરો • Enter Directory" button (the app opens ONLY from this button), and
Main Admin / Village Admin contact chips. Brand saffron/brick colours.

LIST ROW: round avatar (first letter on brand gradient, or photo later) · name
(Gujarati or English by language; wraps to 2 lines then "…"; NEVER painted under the
buttons) · "Village • Taluka" · Call button · WhatsApp button (44–48 dp each).
Own name GREEN, every admin RED, no "You" label. Sorted by name in the current
language. Count line: "12 members".
Tap row → contact sheet: full name, village, taluka, district, current location,
phone(s) with Call and WhatsApp, "Report wrong details" (sends a change request to
the Village Admin).

SEARCH: name (Gujarati or English, partial, ignores case and matras variants),
mobile digits (any 3+ digits), village, taluka, district. Starts at 3 characters;
shows "Type at least 3 characters" before that. Instant, works offline.

ACTIONS: Call = Android ACTION_DIAL with +91 number (never auto-call). WhatsApp =
https://wa.me/91XXXXXXXXXX. If WhatsApp is missing, show a friendly message.
Back on this screen closes the app (never returns to Login).

EMPTY / ERROR STATES: designed illustrations for "No results", "No internet (showing
saved list, last updated …)", "Server busy".

ACCEPTANCE: 320/360/412 dp × Gujarati/English × 85/100/135/165% text × light/dark —
no overlap between text and buttons (measured, not only "no sideways scroll"); 8 rows
visible on a 6-inch phone at 100%; search < 100 ms for 5,000 members.
```

---

## Prompt 7 — My Profile, change and removal requests

```text
MODULE 7: MY PROFILE.
My Profile shows: name, mobile(s), village, taluka, district, current location, role,
member since. Buttons: Request profile change · Request removal · Settings · My devices
· (Main Admin) Change password / 2FA · Optional phone lock (Module 12).

Request change: same form as registration pre-filled; only changed fields are sent;
reason optional; shows "Waiting for approval" pill until decided; one open change
request at a time (can edit/withdraw it).
Request removal: confirm sheet explains what happens; after approval the person is
REMOVED, signed out everywhere, and their data follows the retention rule (Module 17).

SETTINGS: text size slider 85–165% (5% steps) + Reset to 100% · phone notifications
on/off per kind · All admins (Main Admin + Village Admins with Call/WhatsApp) ·
Privacy policy · About (version, "Check for update") · Sign out of this phone.
(Language and theme are NOT in Settings — they live in the directory header.)

ACCEPTANCE: Back with unsaved changes asks "Discard changes?"; every label left-aligned
next to its icon; all texts in both languages.
```

---

## Prompt 8 — Village Admin tools

```text
MODULE 8: VILLAGE ADMIN. Opened from the Admin Tools icon (step-up required).
Title: "Village verification · <Admin name> · <Village>".
Tabs (icon beside label, 48 dp): Requests · My village members · My actions.

Requests: cards for this village only — name, mobile, village, submitted time, stage
pill. Actions: identity-confirmed checkbox → Verify & forward; Correct details
(inline form, invalid number shown at top, form stays open); Reject (reason ≥ 5
chars); Close request. "No requests waiting." empty state.
My village members: list with Propose change / Propose removal (reason required). A
card with an open proposal shows "Forwarded to the Main Admin — waiting". The form
closes ONLY when the server confirms; failures keep the typing.
My actions: this admin's own history from audit_log.
Log out of admin: ends admin mode only; stays logged in as a member.

ACCEPTANCE: a Village Admin of Thorala sees nothing from Sathra (server-enforced);
disabling them removes access within one request; every action is in audit_log.
```

---

## Prompt 9 — Main Admin console

```text
MODULE 9: MAIN ADMIN CONSOLE (step-up + 2FA). "ADMIN PANEL" header with Back and
"Log out of admin".

DASHBOARD tiles with counts: Total members · Requests (new · changes · removals) ·
Reports · Backup & export · Archive (removed · rejected · withdrawn) · Security alerts
· Manage Village Admins · Master data (villages/talukas/districts) · Audit log ·
My Profile. A top card: "N items need action".

MEMBERS: totals by village → village list → member card with Edit / Remove (reason) /
Sign out devices / View history. Edit writes directly (audit_log before/after).
REQUESTS: review panel with tabs Requests · Manage Village Admins · Rejected/closed ·
Removed members. Final approval rules from Module 5.
MANAGE VILLAGE ADMINS: village drop-down (not tiles) → card: admin name, mobile,
Active/Disabled, Call, WhatsApp, Edit, Disable/Enable, "Move admin to another member".
Create: pick an existing APPROVED member of that village (search) or enter name +
mobile (creates member + admin). Hand-over dialog: "Tell on WhatsApp" (message with
app link and login steps — NO password or PIN in the message) and Call.
MASTER DATA: add/rename/reorder/deactivate villages (with Gujarati + English + old
names as aliases), talukas, districts. Deactivating a village with members is blocked
until members are moved.
SECURITY ALERTS: failed logins, lockouts, new admin devices, refused requests,
integrity failures; mark as reviewed.
AUDIT LOG: filter by person, action, date; export CSV (step-up).

ACCEPTANCE: every tile opens its screen in both languages; all destructive actions ask
for step-up and confirmation; audit log cannot be edited.
```

---

## Prompt 10 — Reports, export, backup and restore

```text
MODULE 10: REPORTS AND BACKUP (Main Admin only, step-up each time).
REPORTS: Full report, Members directory, Village summary, Pending requests,
Archive — each as PDF (Gujarati font embedded, A4, header with community name, date,
page numbers, "Confidential — for community use only" watermark with the admin's
name) and CSV/Excel (UTF-8 with BOM so Gujarati opens correctly in Excel).
EXPORT: saved through Android's "Save as" sheet (ACTION_CREATE_DOCUMENT: phone
memory or Google Drive) — handle Save, Cancel and "cannot write here" with clear
messages. Every export writes audit_log + security_event EXPORT.
BACKUP: nightly automatic encrypted backup (AES-256-GCM, key from server secret) of
the whole database to the Main Admin's Google Drive folder "MVPMI backups"; keep 30
daily + 12 monthly; "Back up now" button; "Last backup: <time>" shown on dashboard.
RESTORE: pick a backup → preview counts → type RESTORE → step-up → restore, after an
automatic safety backup of the current data.
HAND-OVER / CLEAR DATA: server-console command only (never in the app): keeps Main
Admin and master data, deletes all people, requests, sessions, notifications, audit
(after exporting the audit), and old local backups; asks to type DELETE.

ACCEPTANCE: export opens the save sheet on a real device and the file opens in
Excel/Sheets with correct Gujarati; restore of a backup reproduces the same counts.
```

---

## Prompt 11 — Notifications

```text
MODULE 11: NOTIFICATIONS with Firebase Cloud Messaging (free).
Ask for Android 13+ notification permission ONLY after the person has registered or
logged in — NEVER on the Login screen at first launch. If denied, the app works fully
and Settings explains how to turn it on in phone settings.
Events: applicant → approved / rejected / needs correction; Village Admin → new
registration in my village, proposal decided; Main Admin → request forwarded, new
admin device, security alert, backup failed; member → profile change decided.
Text never contains phone numbers; tap opens the right screen; in-app notification
list with read/unread; language follows the user's choice; quiet hours 22:00–07:00
except security alerts.
ACCEPTANCE: deny → app works, no crash; enable later → notifications arrive; tested on
API 29, 33 and 36 emulators.
```

---

## Prompt 12 — Optional app lock and on-phone privacy

```text
MODULE 12: OPTIONAL PHONE LOCK (members) — off by default, never forced.
In My Profile: "Lock this app with a PIN" (4 digits, entered twice) + optional
fingerprint. When on: the app locks when reopened or after 1 minute in the
background; nothing behind the lock screen (no names, no numbers, recents preview
hidden, screenshots blocked with FLAG_SECURE only while the lock is on). Wrong PIN →
"Wrong PIN" (small delay after 5 tries, never a permanent lock-out). "Forgot PIN?" →
sign out of this phone and log in again with Google (no admin needed). Dialogs opened
on the lock screen must stay open until answered.
For admins the step-up of Module 4 is separate and mandatory.
ACCEPTANCE: lock survives a real process kill (cold start asks for PIN); biometric
success / wrong finger / cancel tested on an emulator with an enrolled fingerprint.
```

---

## Prompt 13 — Offline mode and sync

```text
MODULE 13: OFFLINE.
Keep an encrypted offline copy (SQLCipher or drift + encryption key in Keystore) of
the directory the member is allowed to see, refreshed on every open and every 6 hours
(WorkManager). Offline: show a top banner "No internet / Server not reachable — Retry
· Last updated <time>"; search, contact sheet, Call and WhatsApp still work; admin
actions and requests are disabled with a clear reason (never queued silently).
Retry reconnects without restarting. Sign out wipes the offline copy. Removed or
disabled users get their offline copy wiped at the next contact with the server.
ACCEPTANCE: airplane mode → saved list works; back online → Retry works; offline copy
unreadable when copied off the phone.
```

---

## Prompt 14 — Design system and "visual treat"

```text
MODULE 14: DESIGN. Attached: design.md, the 63-screen walkthrough and my Claude
Design screens. Match their identity, then raise the polish:

IDENTITY: warm saffron/brick "liquid glass" (frosted translucent cards with a light
rim and soft warm shadow) on a warm paper background with a soft radial glow; a sun
mark logo. Colour tokens (light / dark):
  brand #B2402C / #FF9D74 · saffron #E9A13B / #F3BC6A · gradient 135° brand→saffron
  text #241413 / #F7EDE4 · secondary #6B4F48 / #C3A79C · page #F7EEE5 / #120B0A
  success & own name #17692F / #5EE08A · danger & admin names #C62828 / #FF7B7B
  WhatsApp #128C4B / #6BD49A · error banner #B3261E (white text)
TYPE: Noto Sans Gujarati (Gujarati) + Manrope (English), weights 500/700/800.
Scale 11/13/15/19/24/30 × text-size setting. Inputs never below 16.
SHAPE: cards 26, inner 18, fields 16, buttons/chips capsule, avatars circle.
MOTION: spring for tab lens and presses (160 ms), ease for sheets; respect
"remove animations"; NOTHING animates while idle (battery).

VISUAL TREAT (make people smile, stay fast):
- Animated splash: sun mark rises and glows, community name fades in (≤ 1.2 s).
- Welcome after approval: one-time celebration (confetti in saffron/brick, Lottie,
  free) + "Welcome to the community, <name>".
- Hero header on the directory with a subtle village-sky gradient that changes with
  time of day (dawn/day/dusk/night) and theme.
- Village chips with small line icons; avatars with soft gradient rings; admins get a
  small shield badge (colour + icon, not colour alone).
- Pull-to-refresh with a spinning sun; skeleton shimmer while loading.
- Haptic feedback on Call, WhatsApp, approve, reject.
- Beautiful empty states with simple illustrations (free: unDraw/Storyset, recoloured
  to brand) for no results, no requests, offline.
- Festival themes (optional, admin-switched): Navratri, Diwali accents.
- Bottom sheets with blur, dialogs that never cover the text they ask about.
- Home-screen widget (later): "Search the directory".

RULES: Material 3 components themed with these tokens; dark theme designed, not
inverted; 48 dp targets; icon-only buttons have labels for TalkBack; no text under
buttons at 165%; test at 320/360/412 dp.
DELIVER: theme package (tokens, typography, components), a design gallery screen (debug
only) showing every component in both themes and languages.
ACCEPTANCE: side-by-side screenshots of every screen vs the walkthrough, light/dark,
Gujarati/English.
```

---

## Prompt 15 — Gujarati / English language

```text
MODULE 15: LANGUAGE. Use Flutter intl (ARB files) with gu (default) and en. Every
string, error, notification, PDF and export in both. Language switch in the directory
header and on Login/Lock screens; remembered per device. Names: show Gujarati spelling
in Gujarati mode when available, else the English spelling. Dates in Indian format.
Search matches Gujarati and English spellings of villages. Provide a spreadsheet of all
strings (key, Gujarati, English) for me to proof-read, and a test that fails if any key
is missing in either language.
```

---

## Prompt 16 — Android app shell, permissions and device features

```text
MODULE 16: ANDROID.
- minSdk 29, target latest; edge-to-edge with correct insets (Android 15+), predictive
  Back, keyboard never covers the focused field, rotation keeps the screen and typed
  text, process death restores the screen.
- Permissions: INTERNET, POST_NOTIFICATIONS (asked after login), USE_BIOMETRIC. No
  contacts, location, SMS, call-log, camera (photo upload later uses the system
  picker without permission).
- No cloud/device backup of app data (allowBackup=false, data-extraction rules).
- HTTPS only; certificate pinning to the backend (with a backup pin); no cleartext.
- ProGuard/R8 on; no debug logs in release.
- Deep links: /approved, /request/<id> open the right screen after login.
- In-app update check: if server says minimum version is higher, show "Update the app"
  with the download link (APK) or Play in-app update later.
- App name: "સમાજ સંપર્ક" / "Samaj Directory"; adaptive icon from the sun mark.
ACCEPTANCE: works on API 29, 33, 36 emulators; Back on the home screen exits; no
permission asked at first launch.
```

---

## Prompt 17 — Security hardening and privacy law

```text
MODULE 17: SECURITY AND PRIVACY. Write SECURITY.md and PRIVACY.md and implement:
- OWASP MASVS L1 checklist for the app and OWASP ASVS L2 for the API — show me the
  checklist with pass/fail.
- Row Level Security on every table (Module 3); service keys only on the server,
  never in the app.
- Input validation server side; output encoding; no raw SQL string building.
- Secrets in the server's secret store / env; rotate yearly; CI secret scanning.
- Rate limiting and lock-outs (Module 4); security_events for every refusal; daily
  summary to Main Admin if anything unusual.
- App Check / Play Integrity required in prod.
- Data minimisation: store only listed fields; no Aadhaar, no address unless the
  person adds it; show second number only if the person allows.
- Consent screen with version; re-ask consent when the privacy text changes.
- India Digital Personal Data Protection Act 2023: purpose statement, consent,
  right to access (download my data as PDF), correction (change request), erasure
  (removal request → data deleted within 30 days, except the minimum audit record),
  grievance contact (Main Admin name + email) on the Privacy page.
- Retention: rejected applications deleted after 180 days; removed members' archive
  kept 1 year then anonymised; audit log kept 3 years.
- Exports watermarked and logged; no bulk copy button for members.
- Screenshot blocking only while the optional lock is on (members) and always on
  admin screens that show many numbers (Main Admin can switch this).
- Dependency updates and vulnerability scan (GitHub Dependabot, free) weekly.
ACCEPTANCE: automated security tests (unauthorised calls, role escalation, token
reuse, SQL injection strings, oversize inputs) all refused; checklist shared.
```

---

## Prompt 18 — Testing and quality

```text
MODULE 18: TESTING. Write and run, in CI on every push:
- Unit tests (validation, permissions, request state machine).
- Database/RLS tests: every cell of the permission matrix for every role.
- Widget tests for every screen in gu/en, light/dark, 85–165% text.
- Integration tests on Android emulators API 29, 33 and 36 (GitHub Actions with
  reactivecircus/android-emulator-runner, free): login per role, registration → village
  verify → main approval, directory search, call/WhatsApp intents (Espresso-Intents /
  integration_test), export save + cancel via the real save sheet (UI Automator),
  notification permission deny/allow, rotation, keyboard, process kill, offline/online,
  optional lock + fingerprint (enrolled emulator fingerprint).
- Layout checks: measure overlap of text and buttons (not only page width).
- Accessibility: contrast, labels, 48 dp targets.
- Performance: cold start < 2.5 s on a low-end emulator; directory of 5,000 members
  scrolls at 60 fps.
- A test is marked FLAKY if it passes only on retry — never count it as passed.
- A release is published ONLY when all suites pass. Produce a checklist table
  (screen | action | expected | result | pass/fail) for me.
```

---

## Prompt 19 — Build, signing, release and updates

```text
MODULE 19: RELEASE.
- One permanent release signing key (store it safely + backup; GitHub Secrets for CI).
  Every build shared with people must use it, so updates install over the old app
  (our v1.2 test builds could not update because each was signed differently).
- Versioning: semantic (1.3.0), versionCode from CI run number.
- CI: on a version tag → run all tests → build signed APK + AAB → SHA-256 checksums →
  GitHub Release (pre-release for alpha/beta) with Gujarati + English release notes.
- Download page on my domain: big "Download" button, version, size, checksum, how to
  allow install from unknown sources, what's new.
- Server "minimum app version" for forced updates.
- Later: Google Play (internal testing → closed → production), Data safety form
  filled from PRIVACY.md.
```

---

## Prompt 20 — Hosting, operations, monitoring and hand-over

```text
MODULE 20: OPERATIONS (all free).
- Prod backend: Supabase free (with daily keep-alive job) OR PocketBase on Google
  Cloud Always-Free e2-micro + Caddy HTTPS at a sub-domain of kavigsv.com.
- Monitoring: UptimeRobot (5-min checks), Crashlytics, daily backup-success check.
- RUNBOOK.md with copy-paste commands: update server, restore backup, reset Main Admin
  password, rotate keys, clear directory for hand-over, add a village.
- Staging copy with synthetic data for testing before each release.
- Hand-over package for my client: admin guide (Gujarati + English, with screenshots),
  member guide (one page), Village Admin guide (one page), support contacts.
```

---

## Lessons learned from v1.2 (tell the AI: "do not repeat these")

These were real bugs found and fixed in the current app. Add a test for each.

1. Long names painted **under** the Call/WhatsApp buttons at large text — test element overlap, not only page width.
2. Android **export did nothing** (a second "busy" check blocked it) — test the real save sheet.
3. A failed **proposal closed the form** and lost the typing — close forms only after the server confirms.
4. A tab effect **redrew the screen 60 times a second while idle** (battery) — nothing may animate while idle.
5. Header **search box too narrow**, placeholder cut — give search the whole line while searching.
6. Settings labels **centred** instead of aligned after icons.
7. English screens showing a **Gujarati prefix** ("હાલ :") — every string through the translation system.
8. Old Android WebView (v74) showed a **blank screen**, and WebViews older than 103 could not reach the server — support old WebViews or use native Flutter.
9. **Login lost** when the app was closed right after logging in (cookie not saved) — store tokens securely at once.
10. Notification **permission asked on the Login screen** at first launch — ask only after login.
11. "Forgot PIN? → Sign out?" **dialog closed itself** after 8 seconds — dialogs on the lock screen must stay.
12. "Approved! Logging you in…" **message repeated** at every login — show once.
13. Updates could not install over the old app (**different signing keys**) — one permanent key.
14. Mobile-number-only login let **anyone with a number open the directory** — fixed by Module 4.
15. "Create Village Admin" button **wrapped onto three lines** at 360 dp — check button labels at every width.

---

## Future upgrades backlog (add later, one module prompt each)

- Profile photos (compressed, admin-approved), family grouping (head of family + members), blood group (opt-in) for emergencies.
- Events and announcements board (Main Admin posts; Village Admin posts for their village).
- Birthday / anniversary greetings (opt-in).
- Business / profession directory (opt-in category and search).
- Donations / fees register (no payments inside the app unless approved).
- More talukas and districts; Taluka Admin role between Village and Main Admin.
- Web admin panel (Flutter Web) for the Main Admin on a laptop.
- Google Play release; iOS later.
- WhatsApp Business API or SMS OTP (paid; only if the community funds it).
- Emergency contacts card and "Share my contact" QR code.

---

*End of pack. Keep this file, `design.md` and `DECISIONS.md` together and give all three to any AI system you use.*
