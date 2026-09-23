# Build the shareable Android app (free, on GitHub)

The APK is built by GitHub Actions — you never need Android Studio. Do the
one-time setup once; after that every `v…` tag produces a new `mvpmi.apk`.

## Why a permanent key matters

Android installs an update only if it is signed with **the same key** as
the app already on the phone. Earlier builds used a throw-away debug key
per build, so members would have had to uninstall (and sign in again) for
every update. The release build now always uses **your** key.

**Keep the key file and its passwords safe (e.g. in Google Drive and on a
USB stick). If the key is lost, members must uninstall and reinstall.**

## One-time setup (about 10 minutes)

1. **Create the key** on any computer with Java (or in Android Studio →
   Build → Generate Signed Bundle/APK → Create new). With Java:

   ```bash
   keytool -genkeypair -v -keystore mvpmi-release.jks -alias mvpmi \
     -keyalg RSA -keysize 4096 -validity 36500 \
     -dname "CN=Mahuva Kshatriya Rajput Samaj, C=IN"
   ```

   Choose a strong password; use the same for key and store when asked.

2. **Turn the key into text** for GitHub:
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("mvpmi-release.jks")) | Set-Clipboard`
   - Mac/Linux: `base64 -w0 mvpmi-release.jks` (Mac: `base64 -i mvpmi-release.jks`)

3. GitHub → your repository → **Settings → Secrets and variables →
   Actions**:
   - **Secrets** (New repository secret):
     `MVPMI_KEYSTORE_BASE64` (the text from step 2),
     `MVPMI_KEYSTORE_PASSWORD`, `MVPMI_KEY_PASSWORD` (your password),
     `MVPMI_KEY_ALIAS` = `mvpmi`
   - **Variables** tab → New variable: `COMMUNITY_URL` =
     `https://directory.yourdomain.com` (your live address, no trailing
     slash, no sub-folder)

## Make a release

GitHub → **Releases → Draft a new release → Choose a tag** → type e.g.
`v0.4.0` → **Create new tag** → **Publish release**. After about 15 minutes
the release shows `mvpmi.apk`. (Actions → "Quality checks" shows progress.
The Android app is only built if all server and browser tests pass.)

Download `mvpmi.apk` and upload it to your GoDaddy `public_html/app/`
folder (see `DEPLOY_GODADDY.md` §6), then share that link.

For every later update: publish a new tag (`v0.4.1`, …). Each build gets a
higher version number automatically, so it installs over the old app and
members stay signed in.

## What the app does on the phone

- Opens only your `COMMUNITY_URL` over HTTPS; other links are refused.
- Blocks screenshots/screen recording of the app (community privacy).
- Asks for notification permission only after the person applies or signs
  in; checks for new notifications about every 15 minutes in the
  background (no Firebase), and immediately when opened.
- Never backs up or transfers its data to another phone or the cloud.
- Works on Android 5.0 and newer with an up-to-date "Android System
  WebView"; includes the Let's Encrypt root for old phones.

The debug APK (`app-debug.apk`) is for testing only: it has a "TEST BUILD"
bar and can point at a computer test server.
