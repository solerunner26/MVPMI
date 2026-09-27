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
5. SSH into the server and run `sudo mvpmi-config first-login` — it shows
   the first admin password, the 4-digit access code and the backup
   passphrase (created on the server). Copy them into your private
   handover sheet.
6. `sudo mvpmi-config set GOOGLE_CLIENT_SECRET` (paste the client secret
   from the handover sheet; the value is hidden while typing).

## Main administrator

- Open the site, **tap the sun logo 5 times**, enter the 4-digit access
  code, then user `admin` and the password (both set at first start, in the
  handover sheet). Save the recovery code shown at the first sign-in.
- Change the password in the app (Security). Set the main administrator's
  contact number (shown on the privacy page and "All admins").
- Enroll each village administrator before that village's members apply.

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
