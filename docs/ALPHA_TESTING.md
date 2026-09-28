# Alpha test — version 1.1

The goal of the alpha is to find errors with a small group of real users
before the wider release. This version changes how everyone logs in, so
every tester starts fresh.

## Before inviting testers (Main Admin)

1. Server ready for 1.1 (see [DEPLOY.md](DEPLOY.md) → "Moving an existing
   server to version 1.1"): Main Admin set with `sudo mvpmi-config
   main-admin`, old database moved aside.
2. Install the signed `mvpmi.apk` from the GitHub release on your phone and
   log in: **Login → "Main Admin? Log in with password"**.
3. Change the initial password: **Admin → My Profile → Change Password**.
4. **Admin → Manage Village Admins**: create the Village Admin for each
   village taking part. Tap **Share on WhatsApp** to send each one their
   TEMP PIN (it is shown only once; use **Reset PIN** if it was lost).
5. Share the download link (`https://samaj.kavigsv.com/download`) with the
   testers.

## What testers do

| Who | Steps |
|---|---|
| New member | Install → **New member? Register** → fill in, tick the consent box → "Pending approval". After approval the admin sends a TEMP PIN on WhatsApp → **Login** with mobile + TEMP PIN → set your own 4-digit PIN. |
| Village Admin | Login with mobile + TEMP PIN → set a PIN → shield icon → review your village's registrations (Verify & forward, or Reject with a reason) and "Forgot PIN" requests. |
| Everyone | Search (3+ letters or digits), village chips, call / WhatsApp buttons, contact details, Settings (My Profile, request change, request removal, Change PIN, app lock, language), Back button on every screen, airplane mode. |

## Please report

For every problem: **what you tapped, what you expected, what happened**,
the screen (a description — screenshots are blocked inside the app for
privacy), your Android version and phone model, and the time. Send reports
to the Main Admin on WhatsApp.

Things especially worth checking:

- Gujarati / English switch on every screen.
- Phone's Back button: never returns to Login after logging in, never to an
  admin screen after "Log out of admin".
- Lock after 1 minute in the background (when "Ask for PIN" is on; always on
  for admins); 5 wrong PINs → 5-minute wait with a countdown.
- No internet: the directory still opens from the saved copy with "Last
  updated"; "Retry" loads fresh data without restarting.
