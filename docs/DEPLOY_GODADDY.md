# Put MVPMI online on GoDaddy (free, step by step)

This is the **single source of truth** for going live (v0.4.0). It replaces
the GoDaddy parts of `HANDOVER.md` and `RELEASE_ROADMAP.md` §20.

**Cost:** ₹0 extra. It uses your existing GoDaddy **Web Hosting (cPanel,
Linux)** plan, a free sub-domain, GoDaddy's free AutoSSL certificate, and
free GitHub Actions for the Android app. No SMS, no Firebase, no Play Store.

```
Member's phone ──HTTPS──► directory.yourdomain.com (GoDaddy cPanel)
  (Chrome "Add to Home screen"            Apache ─► Passenger ─► Node 24
   or the MVPMI Android app)                                   └─ data/community.sqlite
```

---

## 0. Check your plan (2 minutes)

GoDaddy → **My Products → Web Hosting → Manage → cPanel Admin**. In cPanel,
search for **"Setup Node.js App"**.

| You see | What to do |
|---|---|
| "Setup Node.js App" with Node **22.13 or newer** (GoDaddy now offers Node 24) | Continue below |
| No such icon, or Plesk (Windows), or Website Builder | This plan cannot run the app. Ask GoDaddy support to move you to Linux cPanel hosting; do not buy anything else first. |

## 1. Create the address and free HTTPS

1. cPanel → **Domains** → **Create A New Domain** → `directory.yourdomain.com`
   (untick "Share document root"). Any name works; it must be a
   **sub-domain or domain root**, not a sub-folder like `yourdomain.com/app`.
2. cPanel → **SSL/TLS Status** → select the new sub-domain → **Run AutoSSL**.
   Wait until it shows a green padlock (can take up to an hour).

## 2. Put the code on the server

Easiest — cPanel → **Git™ Version Control → Create**:

- Clone URL: `https://github.com/solerunner26/MVPMI.git`
- Repository path: `mvpmi` (i.e. `/home/<cpanel-user>/mvpmi`, **outside**
  `public_html`)

(Alternative: download the repository ZIP from GitHub, upload it with
**File Manager** into `/home/<cpanel-user>/mvpmi` and **Extract**.)

## 3. Create the Node.js application

cPanel → **Setup Node.js App → Create Application**:

| Field | Value |
|---|---|
| Node.js version | the highest offered (24.x) — must be ≥ 22.13 |
| Application mode | **Production** |
| Application root | `mvpmi` |
| Application URL | `directory.yourdomain.com` |
| Application startup file | **`app.cjs`** |

Add these **environment variables** (button "Add Variable"):

| Name | Value |
|---|---|
| `NODE_ENV` | `production` (installs only what the server needs) |
| `DEVELOPMENT_MODE` | `false` |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `1` |
| `ADMIN_PASSWORD` | your main-admin password: 10+ characters with capital, small, number and symbol |
| `ADMIN_GATE_CODE` | your secret 4-digit access code |
| `VAPID_SUBJECT` | `mailto:` + your email (used by browser push services) |

Do **not** set `PORT` — Passenger provides it. `ADMIN_PASSWORD` and
`ADMIN_GATE_CODE` are only read the very first time (they create the
account); later changes are made inside the app.

Click **Create**.

## 4. Install and build

1. On the same page click **Run NPM Install** and wait until it reports
   success. (cPanel keeps the packages in its own "virtual environment";
   do **not** use `npm ci` here — it deletes cPanel's `node_modules` link.)
2. cPanel → **Terminal**. Copy the "Enter to the virtual environment"
   command shown at the top of the Node.js app page and run it, then build:

   ```bash
   source /home/<cpanel-user>/nodevenv/mvpmi/24/bin/activate && cd /home/<cpanel-user>/mvpmi
   npm run build
   ```
3. Back on **Setup Node.js App**, click **Restart**.

## 5. Check it works

Open these in your phone's Chrome:

1. `https://directory.yourdomain.com/api/health` →
   `{"ok":true,"mode":"live","https":true,"visitorAddressVisible":true,…}`.
   If `visitorAddressVisible` is `false` the app still works safely, it just
   uses site-wide limits instead of per-visitor limits.
2. `https://directory.yourdomain.com` → the Gujarati registration form.
3. Tap the header **shield** → **Main administrator sign in** (or tap the
   sun logo 5 times) → your 4 digits → user `admin` + your password.
4. **Write down the recovery code** that appears once, and keep it safe
   (it is the only way to reset a forgotten main-admin password).
5. Menu → **Villages, admins & verification**: appoint the administrator of
   each of the 7 villages (name, mobile, temporary password). Joining a
   village opens only after its administrator exists.
6. Settings (sliders icon) → **Phone notifications → Turn on**.

## 6. Share it with the community

**Option A — link only (recommended, nothing to install):** send
`https://directory.yourdomain.com` on WhatsApp. Members open it in Chrome →
⋮ menu → **Add to Home screen / Install app**. It opens full-screen like an
app, updates automatically, and can show notifications.

**Option B — the Android app (APK):** follow `docs/ANDROID_RELEASE.md` once
(creates your permanent signing key and builds `mvpmi.apk` on GitHub for
free). Upload `mvpmi.apk` with File Manager to `public_html/app/` of your main
domain and share `https://yourdomain.com/app/mvpmi.apk`. Members must allow
"Install unknown apps" for Chrome; Android may show a Play Protect notice for
apps not from the Play Store — they can choose **Install anyway**.

Both options use the same server and data.

## 7. Daily backup (free)

cPanel → **Cron Jobs** → add (once a day, e.g. 02:30):

```
cd /home/<cpanel-user>/mvpmi && /home/<cpanel-user>/nodevenv/mvpmi/24/bin/node scripts/backup-db.mjs >/dev/null 2>&1
```

It writes a consistent copy to `mvpmi/backups/` and keeps 30 days. Once a
month, download the newest file (File Manager → Download) to your own
computer. Also use Admin → **Backup & export** for a JSON backup.

## 8. Updating later

cPanel → **Git Version Control → Manage → Pull or Deploy → Update from
Remote**, then **Run NPM Install**, then in Terminal (inside the virtual
environment as in step 4) `npm run build`, then **Restart**. The database (`data/`) and backups are never touched by updates.

## 9. Good to know

- **Where data lives:** only on your server in `mvpmi/data/community.sqlite`.
  Phones keep a session cookie and preferences; the directory is never
  stored on the phone.
- **Shared-hosting limits:** GoDaddy may pause the app after a period with
  no visitors; the next visit then takes a few seconds. This is normal.
- **Logs:** Setup Node.js App shows the log file path. A line
  "SQLite is an experimental feature" is a harmless Node notice.
- **Never** put `.env`, `data/` or `backups/` inside `public_html`, and never
  commit them to GitHub.
- **Identity:** the village administrator knows each family and confirms
  every applicant and every mobile-number change in person or by phone; the
  main administrator gives the final approval. There is no SMS cost.

## 10. Local testing on a computer (optional)

`START-TEST-SERVER-WINDOWS.cmd` / `START-TEST-SERVER-MAC.command` start a
separate test server with made-up credentials (see `PHONE_TESTING.md`).
