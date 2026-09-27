# Android app: releases, sharing and Google Play

The app is built by **GitHub Actions** (free). You never need Android
Studio. Every GitHub *release* (tag `v…`) produces:

| File | Use |
|---|---|
| `mvpmi.apk` | Share with members: https://samaj.kavigsv.com/download (the server copies each new APK there automatically) |
| `mvpmi-play.aab` | Upload to Google Play Console |
| `SHA256SUMS.txt` | Checksums |

A release is created **only after all server, browser, accessibility and
Android tests pass**.

## The signing key — keep it forever

Android installs an update only if it is signed with the **same key**.
The key `mvpmi-upload.jks` (alias `mvpmi`) and its password are in the
handover package. Keep two copies (e.g. Google Drive + USB stick). It is
never stored in the repository.

GitHub → repository → **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `MVPMI_KEYSTORE_BASE64` | contents of `mvpmi-upload.jks.base64` |
| Secret | `MVPMI_KEYSTORE_PASSWORD` | the key password |
| Secret | `MVPMI_KEY_PASSWORD` | the same password |
| Secret | `MVPMI_KEY_ALIAS` | `mvpmi` |
| Variable | `COMMUNITY_URL` | `https://samaj.kavigsv.com` |

## Publish a new version

1. Update `CHANGELOG.md` on `main`.
2. GitHub → **Releases → Draft a new release → Choose a tag** → type the
   new version, e.g. `v1.0.1` → **Create new tag** → **Publish release**.
3. About 20–30 minutes later the release shows `mvpmi.apk` and
   `mvpmi-play.aab` (progress: **Actions → Quality checks**).
   `versionName` = the tag, `versionCode` increases automatically, so it
   installs over the old app and members stay signed in.
4. Within an hour the live server updates itself to this release and
   serves the new APK at `/download`.

## Google Play (optional, one-time USD 25 developer account)

1. https://play.google.com/console → create the app
   "મહુવા ક્ષત્રિય રાજપૂત સમાજ" (free, app).
2. **Play App Signing**: accept the default (Google keeps the app-signing
   key; `mvpmi-upload.jks` becomes your *upload* key).
3. Store listing: use `android/play-icon-512.png` and screenshots from
   `docs/liquid-ios/`.
4. **App content**: Privacy policy URL `https://samaj.kavigsv.com/privacy`;
   Data safety — collected: name, phone numbers, approximate location (city
   typed by the member); purpose: app functionality; encrypted in transit;
   users can request deletion; no data shared or sold, no ads. Account
   deletion URL: `https://samaj.kavigsv.com/delete-account`. Target audience:
   18+. The app has no ads.
5. Because the directory is private, give Google review a test login:
   *App access → All or some functionality is restricted* → describe the
   approval flow and provide a reviewer account (a member approved by you).
6. Personal developer accounts must run a **closed test with at least 12
   testers for 14 days** before production. Add community members' Gmail
   addresses as testers.
7. Production → Create new release → upload `mvpmi-play.aab`.

## What the app does on the phone

- Opens only `https://samaj.kavigsv.com`; other links are refused.
- Blocks screenshots and screen recording (community privacy).
- Asks for notification permission only after the person applies or signs
  in; checks for notifications about every 15 minutes (no Firebase needed).
- Android 5.0 and newer; targets Android 16 (API 36), as Google Play
  requires from 31 August 2026.

The debug APK from the Actions run (`app-debug.apk`) is for testing only:
it shows a "TEST BUILD" bar and can point at a computer test server
(`PHONE_TESTING.md`).
