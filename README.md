# MVPMI — મહુવા ક્ષત્રિય રાજપૂત સમાજ · Community Directory

A private, bilingual (Gujarati / English) phone directory for the Mahuva
Kshatriya Rajput Samaj. Members apply once; their **village administrator**
verifies them and the **main administrator** approves. Approved members can
search the directory and call or WhatsApp other members. The directory is
locked with a PIN.

- **Live site:** https://samaj.kavigsv.com (app download: `/download`)
- **Android app:** built and signed automatically by GitHub Actions for each
  release (`mvpmi.apk` to share, `mvpmi-play.aab` for Google Play).
- **Version:** 1.0.0 (first public release).

## Roles

| Role | Can do |
|---|---|
| Member | Apply (first, father's and surname, one of 7 villages, mobile, optional second number and current location), then view the directory, call/WhatsApp, edit own details (re-verified), request removal |
| Village administrator | Separate phone + password sign-in; verifies applicants of **their own village only** and forwards them; proposes changes/removals; gives PIN reset codes |
| Main administrator | Hidden entrance (tap the sun logo 5 times + 4-digit code + password); enrolls village administrators; final approval; approves mobile-number changes; removes members; reports (PDF, Excel, CSV); backups |

## Where things are

| Path | What |
|---|---|
| `server/` | Node.js 22 + Express 5 server, SQLite database (`node:sqlite`) |
| `web/` | App logic, design layer (`liquid-ios.css`) and components |
| `Community Directory.dc.html` | Original design source; `npm run build` turns it into `dist/` |
| `android/` | Android app (Kotlin WebView host, notifications, save/print bridges) |
| `deploy/oracle/` | Server installer, automatic updater, settings template |
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
npm run check          # everything: unit, browser, accessibility, languages, materials, audit
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
