# Test MVPMl on your phone or emulator

This guide is for the **MVPMl Test debug APK**, not a Play Store release. Use made-up contacts only. The app needs a backend server: the APK is not a standalone offline directory.

## Downloads

- **[Download APK ZIP](https://github.com/solerunner26/MVPMI/actions/runs/35005276099/artifacts/10411406258)** — sign into GitHub if prompted, extract `app-debug.apk`. The ZIP also includes its checksum and source-build information. GitHub keeps this artifact for 14 days.
- Use the supplied **MVPMl-test-server.zip**, or [download the tested source ZIP](https://github.com/solerunner26/MVPMI/archive/336e359.zip). Extract it completely before starting the server.

Build/source `336e359`: compilation, lint, Kotlin unit tests, assembly and debug signature verification passed. Installation on your phone/emulator is the next test, not something already verified.

## What you need

- A Windows, Mac or Linux computer.
- Node.js **22.13 or newer LTS** from https://nodejs.org (install once; no Android development tools are needed for phone testing).
- The test-server ZIP and the debug APK provided with this build.
- For phone testing: phone and computer on the **same trusted Wi-Fi**.
- For emulator testing: an Android emulator already installed/running.

The Arena preview URL **does not work as a phone backend** because Arena protects it with a traffic-access token. Never copy platform tokens into an APK.

## Step 1 — Start the server on your computer

1. Download the test-server ZIP.
2. **Extract the whole ZIP** into a folder. Do not run files while they are still inside the ZIP viewer.
3. On Windows, double-click **`START-TEST-SERVER-WINDOWS.cmd`**.
4. On Mac, open **`START-TEST-SERVER-MAC.command`**. On Linux, open a terminal in the extracted folder and run `sh START-TEST-SERVER-MAC.command`.
5. Wait while it installs dependencies and builds the browser app. Internet is needed for the initial installation.
6. Leave that window open. It prints:
   - the computer browser address;
   - the emulator address;
   - one or more phone/Wi-Fi addresses;
   - your **test admin access code and password**.

Open `http://localhost:3000` on the computer first. If the entry form appears, the backend is running.

If Windows Firewall asks, allow Node.js on **Private networks only**. Do not disable the firewall or expose this development server to the internet.

### Important about passwords

The launcher creates credentials specifically for **your computer's test database**. They are different from the Arena preview credentials. Read/copy the credentials printed in your server window; do not use the Arena access code/password.

The settings and test database are saved under the extracted folder's `data/` directory. Keep that folder private. If you change the admin password in the app, use the changed password; the launcher will tell you that the original password is no longer current.

## Step 2 — Install on your Android phone

1. Download/copy **`app-debug.apk`** (or the supplied renamed `MVPMl-debug.apk`) onto your phone. If downloaded from a GitHub artifact, extract the artifact ZIP first.
2. Tap the APK to install it. If Android asks, allow installation from that particular browser/file manager for this install, then turn that permission off afterwards. Do not turn off Play Protect.
3. Open **MVPMl Test**.
4. In **MVPMl test server**, enter the Wi-Fi address printed by the server, for example `http://192.168.1.10:3000`. Use **your** address, not this example.
5. Press **Connect**. The supplied community-directory design should load.

If more than one address is printed, use the address of the computer's Wi-Fi connection. VPNs, guest Wi-Fi and router client-isolation settings may prevent devices from reaching each other.

**Do not enter `localhost` on a phone:** that refers to the phone itself, not your computer.

## Step 3 — Install on an emulator

1. Keep the computer test server running.
2. Drag the APK onto the running Android emulator, or install with Android Studio/ADB.
3. Open **MVPMl Test**.
4. Enter **`http://10.0.2.2:3000`** as the test server for the standard Android Studio emulator.
5. Press **Connect**.

Optional ADB installation:

```sh
adb install -r app-debug.apk
```

For a USB-connected physical device, advanced users can run `adb reverse tcp:3000 tcp:3000` and use `http://127.0.0.1:3000` in the debug app instead of Wi-Fi.

## Step 4 — Test the approval flow

1. Enter a made-up profile and send a request. Use a different test mobile number on each separate device/browser. **Do not call or WhatsApp the made-up numbers.**
2. Tap the sun logo five times quickly.
3. Enter the access code printed in your computer's server window.
4. Sign in as `admin` using the password printed there.
5. Open **New requests** and approve the test profile.
6. Sign out of admin. The directory should become available.
7. Try search, village tiles, My profile, a profile-change request and admin approval.

To act as a separate administrator, open the computer browser in a private/incognito window. Requests made by the phone appear there because both use the same computer backend.

## If it cannot connect

- Check the server window is still open and has no error.
- Check `http://localhost:3000` opens on the computer.
- Check the phone uses the same Wi-Fi, not mobile data.
- Check the phone's server address matches the current address printed on the computer.
- Check Node.js is allowed on the computer's private-network firewall profile.
- Use **Server** in the APK's test banner to correct the address, or **Retry** on the error screen.
- For a hosted backend, use a valid HTTPS certificate. The APK does not bypass certificate errors.

If Android says **“App not installed”**, an older test APK may have been signed with a different debug key. Debug keys can differ between CI builds. Uninstall the previous **test** APK and install the new one. This clears that device's app session/settings; its old unverified membership cannot currently be recovered automatically. Test with a fresh made-up number. Do not uninstall a real production app to work around signing problems.

If the screen is blank on an old phone, update Android System WebView/Chrome where possible and report the Android and WebView versions. The package declares Android 5 minimum, but the current web renderer's old-phone compatibility is **not certified**. Start testing with a recent Android device/emulator.

## What this test build does not finish

- Real SMS member verification or lost-device recovery.
- Native/offline directory storage.
- Native PDF/download/share integration: use the computer browser to test exports for now.
- Public hosting, production authentication, notifications, genuine data erasure or a completed privacy policy.
- Full real-device, accessibility, memory/performance or Play Console validation.

The native server-selection/error screens and test banner are **debug tools** around the unchanged web design. Local HTTP access is allowed only in debug builds and only for loopback/private IPv4 hosts by the navigation policy. It is not encrypted: use synthetic data on a trusted local network only. The release manifest remains HTTPS-only, and release assembly remains blocked pending the release audit.

## Going from testing to deployment

1. Choose and deploy a permanent HTTPS backend with persistent storage/backups and monitoring. Do not publish the local test server.
2. Implement verified member identity/recovery and choose an SMS provider.
3. Complete data-deletion/retention rules, privacy policy and support/deletion URLs.
4. Finish native exports, offline behaviour and compatibility work.
5. Build and test an actual release candidate on devices and Play testing tracks.
6. Only then configure a permanent backend URL, production signing and a release AAB/APK, remove the reviewed release blockers, and publish.

See `RELEASE_AUDIT.md` for the full remaining-work checklist. A debug APK is for testing; it is not deployment approval.
