# Running the live server

The live site **https://samaj.kavigsv.com** runs on a **Google Cloud
Compute Engine e2-micro** virtual machine (Ubuntu 24.04, region
`us-west1`). The machine and its 30 GB disk are in Google's Always Free
tier; the public IPv4 address costs about US$3.65 (≈ ₹300) per month. The
APK is downloaded from GitHub, so the server's own data transfer stays
within the free 1 GB/month.

```
Phone (Android app or Chrome) ──HTTPS──► Caddy (automatic Let's Encrypt certificate)
                                            └─► Node.js 22 app (systemd service "mvpmi")
                                                  └─ /var/lib/mvpmi/community.sqlite
Nightly 02:30 IST ─► local copy (14 days) + encrypted copy in Google Drive (30 copies)
Hourly ─► checks GitHub for a new *release*; updates itself (backup first, roll back if it fails)
```

## What is where on the server

| Path | What |
|---|---|
| `/opt/mvpmi/app` | The app (a Git checkout of this repository) |
| `/etc/mvpmi.env` | Settings and secrets (see `deploy/server/mvpmi.env.example`) |
| `/var/lib/mvpmi/community.sqlite` | **The database** |
| `/var/lib/mvpmi/backups/` | Nightly and before-update copies |
| `/etc/caddy/Caddyfile` | Web address and HTTPS |

Open a terminal on the server: Google Cloud console → **Compute Engine →
VM instances → mvpmi → SSH** (opens in the browser).

## First installation (for a new server)

1. Google Cloud project **MVPMI Backup** (billing linked) → Compute Engine →
   **Create instance**: name `mvpmi`, region `us-west1`, machine
   **e2-micro**, boot disk **Ubuntu 24.04 LTS**, 30 GB **Standard
   persistent disk**, firewall: tick **Allow HTTP** and **Allow HTTPS**.
   Advanced → Metadata: key `user-data`, value =
   `deploy/server/cloud-init.example.yaml`.
2. VPC network → IP addresses → make the instance's external address
   **Static** (so it never changes).
3. GoDaddy → **kavigsv.com → DNS → Add record**: type `A`, name `samaj`,
   value = the static IP, TTL 1 hour.
4. Wait 5–10 minutes, then open `https://samaj.kavigsv.com/api/health`.
5. SSH into the server and run `sudo mvpmi-config main-admin`. It asks for
   the Main Admin's name, Gujarati name (optional), mobile number, village,
   current location and initial PASSWORD (8+ characters, typed hidden) and
   restarts the app. These values stay in `/etc/mvpmi.env` on the server —
   never in git or in the Android app.
6. `sudo mvpmi-config first-login` shows the backup passphrase (created on
   the server). Copy it into your private handover sheet.
7. `sudo mvpmi-config set GOOGLE_CLIENT_SECRET` (paste the client secret
   from the handover sheet; the value is hidden while typing).

## Moving an existing server to version 1.1 (fresh start for the alpha)

Version 1.1 replaces the old sign-in (hidden sun-logo gate, recovery code,
village-admin passwords, device-bound members) with mobile + PIN / PASSWORD
logins. The alpha starts with an empty database:

1. `sudo mvpmi-config main-admin` (as above) — do this BEFORE publishing the
   v1.1 release, otherwise the automatic update cannot start and rolls back.
2. `sudo systemctl stop mvpmi` and move the old database aside:
   `sudo mv /var/lib/mvpmi/community.sqlite /var/lib/mvpmi/community-v1.0.sqlite`
   (also move `community.sqlite-wal` / `-shm` if present).
3. Publish the v1.1 release (or wait for the hourly update), then
   `sudo systemctl start mvpmi`.

## Main Admin

- Open the app → **Login** → "Main Admin? Log in with password" → mobile
  number and password. The Main Admin lands on the Member Directory; the
  shield icon in the top bar opens the admin tools.
- Change the password in the app: **Admin → My Profile → Change Password**
  (or Settings → My Profile).
- Forgotten password: on the server, `sudo mvpmi-config reset-main-admin`
  (runs `scripts/reset-main-admin.js`). There is no reset inside the app.
- **Admin → Manage Village Admins**: create one Village Admin per village
  (name + mobile). The app shows a TEMP PIN once, with a **Share on
  WhatsApp** button. Create Village Admins before that village's members
  register (registration for a village without an active admin is closed).

## Google Drive backup

One-time: admin → **Backup & export → Connect Google Drive** — do this in
Chrome on a computer or phone browser (Google sign-in is not allowed inside
apps). After that, a backup runs every night, and "Back up now" runs one
immediately. Backups are encrypted with `BACKUP_PASSPHRASE`; **keep the
passphrase in the handover sheet safe** — without it a backup cannot be
opened.

Restore (on any computer with Node.js 22):

```bash
BACKUP_PASSPHRASE='…' node scripts/restore-drive-backup.mjs mvpmi-2026-….sqlite.gz.enc restored.sqlite
```

Then on the server: `sudo systemctl stop mvpmi`, replace
`/var/lib/mvpmi/community.sqlite` with the restored file (owner `mvpmi`),
delete `community.sqlite-wal`/`-shm` next to it, `sudo systemctl start mvpmi`.

## Updating the app

Normal way — nothing to do on the server: publish a GitHub release
(see `ANDROID_RELEASE.md`). When its tests pass, the server installs it
within an hour and `/download` gets the new APK.

Manual commands (VM instances → mvpmi → **SSH**):

```bash
sudo mvpmi-update latest        # install the newest release now
sudo mvpmi-update v1.0.0        # go back to (or pin) a specific release
sudo systemctl status mvpmi     # is it running?
sudo journalctl -u mvpmi -n 100 # app log
sudo journalctl -u mvpmi-update -n 50
sudo mvpmi-config set PRIVACY_CONTACT_EMAIL   # change a setting (asks for the value)
```

## If something is wrong

| Symptom | Check |
|---|---|
| Site does not open | `systemctl status caddy mvpmi`; firewall allows HTTP/HTTPS; DNS `samaj` → correct IP |
| "Certificate" warning | DNS must point to the server before Caddy can get the certificate; `journalctl -u caddy` |
| Backup failed (Backup tab shows the error) | Reconnect Google Drive; check `GOOGLE_CLIENT_ID/SECRET` in `/etc/mvpmi.env` |
| Update did not happen | `journalctl -u mvpmi-update`; the release must exist on GitHub (it is created only when all tests pass) |

Keep an eye on Google Cloud → Billing → Reports once a month: the only
expected charge is the IPv4 address (≈ US$3.65). A budget alert
(Billing → Budgets & alerts, e.g. ₹500) warns you if anything else starts
costing money.
