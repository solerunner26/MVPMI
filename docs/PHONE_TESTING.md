# Test MVPMl on your phone or emulator (debug build)

For the alpha with real users, install the **signed release APK** instead
(see [ALPHA_TESTING.md](ALPHA_TESTING.md)). This page is for testing a debug
build against a server on your own computer, with made-up contacts only.

## 1. Start the test server on your computer

1. Install Node.js 22.13 or newer (https://nodejs.org).
2. Extract the source ZIP completely, then double-click
   `START-TEST-SERVER-WINDOWS.cmd` (Windows) or open
   `START-TEST-SERVER-MAC.command` (Mac/Linux: `sh START-TEST-SERVER-MAC.command`).
3. Leave the window open. It prints the computer, emulator and Wi-Fi
   addresses, and a made-up **Main Admin mobile number and password** for
   this test database only.
4. Open `http://localhost:3000` on the computer: the Login screen appears.

If Windows Firewall asks, allow Node.js on **Private networks only**.

## 2. Build a debug APK that points at your computer

The server address is built into the app — there is no server setting in
the app. Build the debug APK with your computer's address, for example:

```sh
gradle -p android :app:assembleDebug -PcommunityUrl=https://samaj.kavigsv.com -PcommunityDebugUrl=http://192.168.1.10:3000
```

(Emulator: `-PcommunityDebugUrl=http://10.0.2.2:3000`.) Plain `http://` is
allowed only for debug builds and only for private network addresses. The
CI debug APK points at the live server (`COMMUNITY_URL`).

## 3. Walk through the app

1. **Main Admin:** Login → "Main Admin? Log in with password" → the printed
   mobile and password. You land on the Member Directory; the shield icon
   opens the admin tools.
2. **Admin → Manage Village Admins → Create Village Admin** for a village
   (made-up name and number). A TEMP PIN appears once.
3. In a private browser window (or a second phone), log in with that number
   and TEMP PIN → you must **Set new PIN** first.
4. In another window, **Register** a made-up member for that village (tick
   the consent box). The Village Admin forwards it; the Main Admin approves
   it and gets the member's TEMP PIN.
5. Log in as the member with the TEMP PIN, set a PIN, try search, call /
   WhatsApp buttons (do not call made-up numbers), Settings, app lock and
   "Forgot PIN?".

`npm run test:e2e` runs all of these paths automatically.

## If it cannot connect

- The app shows "No internet / Server not reachable — Retry". Check the
  server window is still open and the phone is on the same Wi-Fi.
- If Android says **"App not installed"**, a previous test APK was signed
  with a different debug key: uninstall the old **test** app first.
