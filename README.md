# MVPMI — મહુવા વાળા રાજપૂત સમાજ · Community Directory

A private, bilingual (Gujarati / English) phone directory for the Mahuva Vala
Rajput Samaj. Members register once; their **Village Admin**
verifies them and the **Main Admin** approves. Approved members log in with
their mobile number and a 4-digit **PIN**, search the directory and call or
WhatsApp other members. The directory is never shown without an approved
login, and a saved copy lets logged-in members call contacts offline.

- **Live site:** https://samaj.kavigsv.com (app download: `/download`)
- **Android app:** built and signed automatically by GitHub Actions for each
  release (`mvpmi.apk` to share, `mvpmi-play.aab` for Google Play).
- **Version:** 1.1.0 (alpha: new login model, directory redesign — see
  [CHANGELOG.md](CHANGELOG.md) and [docs/ALPHA_TESTING.md](docs/ALPHA_TESTING.md)).

## Roles

| Role | Logs in with | Can do |
|---|---|---|
| MEMBER | mobile + 4-digit PIN | Register (consent required), then view the directory, search, call/WhatsApp, request profile changes or removal, change PIN, optional app lock and fingerprint unlock |
| VILLAGE_ADMIN (one per village, 7 villages) | mobile + PIN | Everything a member can, plus: review PENDING registrations and change requests of **their village only**, forward to the Main Admin or reject with a reason, create TEMP PINs for "Forgot PIN?" requests |
| MAIN_ADMIN (exactly one, seeded on the server) | mobile + PASSWORD | Final approval, Manage Village Admins (create / edit / disable / reset), members, reports (PDF, Excel, CSV), backups, security alerts |

Terms used everywhere: **PASSWORD** (Main Admin only, 8+ characters), **PIN**
(4 digits; login AND app lock for Village Admins and Members), **TEMP PIN**
(random 4 digits created by an admin, one login only, shared with the
"Share on WhatsApp" button). Account status: PENDING, APPROVED, REJECTED,
REMOVED.

## Where things are

| Path | What |
|---|---|
| `server/` | Node.js 22 + Express 5 server, SQLite database (`node:sqlite`) |
| `web/` | App logic, design layer (`liquid-ios.css`) and components |
| `Community Directory.dc.html` | Original design source; `npm run build` turns it into `dist/` |
| `web/alpha-*.mjs`, `web/strings.mjs` | Login, registration, directory, settings, admin tools and every Gujarati/English string |
| `server/auth.mjs`, `server/terms.mjs` | Logins, TEMP PINs, PIN/PASSWORD changes, admin mode, shared terms |
| `config/main-admin.env.example` | Main Admin seed template (the real file stays on the server, not in git) |
| `android/` | Android app (Kotlin WebView host, notifications, save/print, fingerprint bridges) |
| `deploy/server/` | Server installer, automatic updater, settings template |
| `tests/`, `scripts/*-test.mjs` | Unit, API, browser, accessibility and layout tests |
| `docs/` | Deployment, Android release, design system, testing report |

## Documents

- **Put the server online / maintain it:** [docs/DEPLOY.md](docs/DEPLOY.md)
- **Release a new Android version (APK + Play Store):** [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md)
- **Release testing report:** [docs/RELEASE_TESTING.md](docs/RELEASE_TESTING.md)
- **Design system (Liquid Glass, light & dark):** [docs/LIQUID_GLASS_V2.md](docs/LIQUID_GLASS_V2.md)
- **Village verification flow:** [docs/VILLAGE_APPROVAL.md](docs/VILLAGE_APPROVAL.md)
- **Security audit history:** [docs/AUDIT_FIXES.md](docs/AUDIT_FIXES.md)
- **Test the debug app on a phone:** [docs/PHONE_TESTING.md](docs/PHONE_TESTING.md)
- **Change history:** [CHANGELOG.md](CHANGELOG.md)

## Develop

```bash
npm install
npm run dev            # http://localhost:3000 (DEVELOPMENT_MODE=true in .env)
npm test               # unit + API tests
npm run test:e2e       # every screen and navigation path in a phone-size browser
npm run check          # everything above + npm audit
```

Windows/Mac helpers: `START-TEST-SERVER-WINDOWS.cmd`, `START-TEST-SERVER-MAC.command`.

## Release a new version

1. Make changes on a branch, run `npm run check`, merge to `main`.
2. Update `CHANGELOG.md`, then create a GitHub release with a new tag
   (`v1.0.1`, `v1.1.0`, …).
3. GitHub Actions runs every test, then builds the signed APK and AAB and
   attaches them to the release.
4. Within an hour the server updates itself to that release (with a
   database backup first and automatic roll-back if it does not start), and
   `/download` serves the new APK. Upload `mvpmi-play.aab` to Google Play.

Git tags `Pre-*` are checkpoints taken before each major change.
