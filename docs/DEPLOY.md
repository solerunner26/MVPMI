# Running the live server

The live site **https://samaj.kavigsv.com** runs on an **Oracle Cloud
"Always Free"** virtual machine (Ubuntu, India West – Mumbai). Cost: ₹0.

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
| `/etc/mvpmi.env` | Settings and secrets (see `deploy/oracle/mvpmi.env.example`) |
| `/var/lib/mvpmi/community.sqlite` | **The database** |
| `/var/lib/mvpmi/backups/` | Nightly and before-update copies |
| `/var/lib/mvpmi/downloads/mvpmi.apk` | The APK served at `/download` |
| `/etc/caddy/Caddyfile` | Web address and HTTPS |

## First installation (already done — for a new server)

1. Oracle Cloud console → **Compute → Instances → Create instance**:
   image **Canonical Ubuntu 24.04**, shape **VM.Standard.E2.1.Micro**
   (Always Free) or **VM.Standard.A1.Flex** (1 OCPU, 6 GB, Always Free),
   public IPv4 on, SSH key: *Generate* and **save the private key**.
   Under *Advanced options → Management → Initialization script*, paste a
   cloud-init file like `deploy/oracle/cloud-init.example.yaml` with your own
   secrets.
2. **Networking → Virtual cloud networks → (your VCN) → Security lists →
   Default** → *Add ingress rules*: source `0.0.0.0/0`, TCP, destination
   ports `80` and `443`.
3. GoDaddy → **kavigsv.com → DNS → Add record**: type `A`, name `samaj`,
   value = the instance's public IP, TTL 1 hour.
4. Wait 5–10 minutes. The certificate is issued automatically. Open
   `https://samaj.kavigsv.com/api/health` — it should say `"mode":"live"`.

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

Manual commands (Oracle Cloud console → the instance → **Cloud Shell**, or
SSH with the saved key: `ssh ubuntu@<IP>`):

```bash
sudo mvpmi-update latest        # install the newest release now
sudo mvpmi-update v1.0.0        # go back to (or pin) a specific release
sudo systemctl status mvpmi     # is it running?
sudo journalctl -u mvpmi -n 100 # app log
sudo journalctl -u mvpmi-update -n 50
sudo nano /etc/mvpmi.env && sudo systemctl restart mvpmi   # change settings
```

## If something is wrong

| Symptom | Check |
|---|---|
| Site does not open | `systemctl status caddy mvpmi`; security list has ports 80/443; DNS `samaj` → correct IP |
| "Certificate" warning | DNS must point to the server before Caddy can get the certificate; `journalctl -u caddy` |
| Backup failed (Backup tab shows the error) | Reconnect Google Drive; check `GOOGLE_CLIENT_ID/SECRET` in `/etc/mvpmi.env` |
| Update did not happen | `journalctl -u mvpmi-update`; the release must exist on GitHub (it is created only when all tests pass) |

Oracle may reclaim Always Free instances that stay almost idle for 7 days
(CPU < 20 %). A live directory with daily use is normally not affected; if
the instance is ever stopped, start it again in the console — data is kept
on the boot volume.
