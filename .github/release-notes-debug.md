# MVPMI Test — debug APK (beta)

**This is a phone-testing build, not the finished Play Store app.** It is
signed with the debug key and is meant for beta testing with made-up
contacts only.

## આ શું છે? (What is this?)

- **English:** The Mahuva Kshatriya Rajput community directory test app.
  Install `app-debug.apk` on your Android phone to test. The exact app
  version and source commit are listed in `BUILD-INFO.txt` and in the tag
  name above.
- **ગુજરાતી:** મહુવા ક્ષત્રિય રાજપૂત સમાજની ડિરેક્ટરી એપનું ટેસ્ટ બિલ્ડ.
  `app-debug.apk` ફાઇલ ડાઉનલોડ કરીને ફોનમાં ઇન્સ્ટોલ કરો. હજુ માત્ર ટેસ્ટિંગ
  માટે છે — હજુ ખરી (સાચી) માહિતી નાખશો નહીં, નકલી નામ-નંબર વાપરો.

## Before you install

The app needs a **test server running on a computer** on the same Wi-Fi as
the phone. Full step-by-step guide (with pictures of what to type where):
**[docs/PHONE_TESTING.md](https://github.com/solerunner26/MVPMI/blob/main/docs/PHONE_TESTING.md)**

Quick summary:

1. On a computer: download the source ZIP from the green **Code** button on
   the repository page, extract it, and double-click
   `START-TEST-SERVER-WINDOWS.cmd` (Windows) or
   `START-TEST-SERVER-MAC.command` (Mac).
2. It prints a phone address (like `http://192.168.x.x:3000`) and the admin
   code/password — keep the window open.
3. Install `app-debug.apk` on the phone, open **MVPMI Test**, type that
   address, press Connect.
4. Test with made-up names and numbers only.

## Files

- `app-debug.apk` — install this on the phone
- `SHA256SUMS.txt` — checksum to verify the download (optional)
- `BUILD-INFO.txt` — source commit this APK was built from

## What is not finished yet (honest limits)

- Not on the Play Store; debug build only.
- Real SMS verification, offline mode and production hosting are still
  pending — see `docs/RELEASE_AUDIT.md`.
- Direct Google-Drive sync needs the owner's Google Cloud keys; use the
  system save sheet (phone memory or Drive) meanwhile.
- Notifications while the app is closed need Firebase setup (planned).

ગુજરાતીમાં ટૂંકમાં: આ ટેસ્ટ એપ છે. કમ્પ્યુટર પર ટેસ્ટ-સર્વર ચાલુ રાખીને,
એજ જ ડબલ્યુ-ફાય (Wi-Fi) માં ફોન જોડો. ખરી માહિતી હજુ નાખવી નહીં.
