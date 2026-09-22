# MVPMI — Release Roadmap & Going-Online Guide

Answers to the owner's two questions (audit list items **19** and **20**):
how to release the app for normal users, village admins and the main
administrator, and how to put everything online without the Play Store —
including how the data is stored. Cross-references like `#3` point at the
numbered problem list from the code assessment (items 1–18).

---

## 19. What to do before releasing to real users

### Phase 0 — fix the defects that matter for real data (from the audit)

| Do first | Why |
|---|---|
| Resolve `#1` (docs say `com.mvpmi.community`, APK is `org.mvpmi.directory`) | **Before** creating the Firebase app, or FCM will never match |
| Resolve `#2` (Android notification overwrite) | Two events in one poll = one lost notification |
| Resolve `#3` (VA password reset does not revoke sessions) | A compromised VA account stays usable up to 12 h after a reset |
| Resolve `#4` (CSV formula injection) | Exports are opened in Excel by real users |
| Decide `#6` (clipboard copy of numbers on dial) | Recommended: remove it before the privacy-conscious rollout |

Items `#5`, `#7`–`#11` (browser notifications, GET side effects, shared
global rate limits, no pruning, full-state polling, 1-second re-render) are
strongly recommended but can follow in a fast second pass.

### Phase 1 — the "production pass" (code changes, done on your word)

The server and the release build are **deliberately locked** today
(`DEVELOPMENT_MODE` guard in `server/index.mjs`, `verifyReleaseReadiness`
in `android/app/build.gradle.kts`). Do **not** run real community data on a
dev-mode server. The unlock is a conscious pass:

1. **Identity model, accepted in writing.** SMS verification is not used
   (your decision, no cost). Identity = the village administrator verifies
   each member in person before forwarding; the main administrator makes
   the final approval. Document this as the design, replacing the open
   RELEASE_AUDIT item.
2. **Retention policy, decided.** Example: audit log kept 1 year,
   security alerts 90 days, expired sessions/limits pruned daily
   (also resolves `#9`), archive kept until a member asks for deletion.
   You choose the numbers.
3. **Server production mode.** Replace the dev guard with the above
   decisions; `COOKIE_SECURE=true` on HTTPS; keep the rate limits.
4. **Signed release APK.** You generate a keystore once (I give the exact
   commands; the file stays on your computer, never in the repo), I add
   the signing config and replace the release-blocker with a real
   pre-flight checklist. Release builds are HTTPS-only, no test banner.
5. **Hand-over decisions** (your standing instructions): remove the
   VA/main-admin logout controls in the hand-over build; final app label
   and version 1.0.
6. **Firebase** (free Spark plan): closed-app push notifications. Create
   the project with the **correct package name** (see `#1`), send me
   `google-services.json` — it contains no private keys.

### Phase 2 — seed the real community (order matters)

1. Start the production server (see §20). First run creates the main-admin
   account from your `ADMIN_PASSWORD` + `ADMIN_GATE_CODE`.
2. Main admin signs in → **save the recovery code on paper** (shown once).
3. Set the public main-administrator contact (All-admins page).
4. Appoint the 7 village administrators (પાસવર્ડ રીસેટ manager): hand each
   their phone-number login + temporary password **in person**; they
   change the password on first sign-in (Account tab).
5. Members enroll; the VA verifies in person and forwards; the main admin
   approves. Approved members can see other members' numbers — the
   built-in privacy notice covers this.
6. Run `docs/BETA_TEST_CHECKLIST.md` once against the production server
   before inviting everyone.

### Phase 3 — rollout

Start with 1–2 villages for a week, then all 7. Keep the APK link in one
WhatsApp group message. Support path: main admin (you) + me for fixes.

---

## 20. Going online step by step (no Play Store)

### A. Where the server lives — the one real cost

The app on the phone is only a viewer; the Node server must run somewhere
always-on with a **persistent disk** (the database is a file).

| Option | Cost | Verdict |
|---|---|---|
| **Small VPS** (Hetzner €4 ≈ ₹400/mo, DigitalOcean $6, E2E/Hostinger India similar) | ~₹400–500/mo | **Recommended.** Always on, disk persists, full control |
| Railway / Render with volume | ~$5/mo usage | Fine, slightly less control |
| Render **free** tier | ₹0 | **Not safe for real data** — sleeps (30–60 s "offline" wake-ups) and free disks are ephemeral |
| Your own always-on computer + free DuckDNS domain | ₹0 | Works, but power/net outage = the whole community's app is down |
| Firebase | ₹0 | Only for push notifications, not hosting |

Domain: optional. A paid domain (.in ≈ ₹700/yr) looks professional; the
host's free subdomain (e.g. `mvpmi.up.railway.app`) works too.

### B. Server setup (about 30 minutes; I can do it with you)

```bash
# 1. Fresh Ubuntu VPS → SSH in, install Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Get the code (the GitHub repo is public; it contains no secrets)
git clone https://github.com/solerunner26/MVPMI && cd MVPMI

# 3. Configure (this file is gitignored — never committed)
cat > .env <<'EOF'
ADMIN_PASSWORD=<strong 10+ char password>
ADMIN_GATE_CODE=<4 digits>
COOKIE_SECURE=true
PORT=3000
EOF

# 4. Install, build, run
npm ci && npm run build
npm start   # first run creates data/community.sqlite with your admin
```

5. Run it under a supervisor so it restarts on crash/reboot
   (`systemd` unit or `pm2 start server/index.mjs`).
6. Put **Caddy** in front for automatic HTTPS: a 3-line Caddyfile maps
   `https://your-domain` → `localhost:3000` with a free Let's Encrypt
   certificate. The app already sets secure cookies and refuses
   cross-origin API calls.

### C. How the data is stored (the direct answer)

- **Everything lives in one SQLite database file on the server:**
  `data/community.sqlite` — members, joining/change/removal requests,
  archive, rejection ledger, village admins (password hashes), sessions,
  audit log, security alerts, config (main-admin hash, recovery-code
  hash).
- **Phones store nothing** except: a session cookie (who is signed in),
  preferences (language/theme/text size) and the optional app-lock PIN
  hash. The APK contains zero member data — losing a phone loses nothing.
- Consequences:
  - The **server disk is the single source of truth** → back it up.
  - Built-in backup: admin → Reports → Backup & export → JSON
    (ડેટા પાછો લાવો restores it, with a confirmation preview).
  - Add one automatic daily copy on the server (cron + `cp` of the
    .sqlite file, or `rclone` to Google Drive). For a community this
    size, that is enough.
  - Server dies with no backup = data gone. Server restored from backup =
    everyone keeps working; sessions may need re-login.

### D. Build the real APK

```bash
# release build pointed at your server (after the Phase-1 unlock)
gradle -p android :app:assembleRelease "-PcommunityUrl=https://your-domain"
```

Testing side-channel: debug builds keep the "Server" button and can also
point at the real HTTPS server.

### E. Distribute the APK without the Play Store

1. **Easiest: link.** We already publish every build on GitHub Releases
   (e.g. `…/releases/tag/v0.3.4-beta.1`). Send the release link in the
   WhatsApp group; or share the APK file directly via WhatsApp/Drive.
2. **One-time install steps for users:** download → tap the file →
   Android asks to allow installs from WhatsApp/browser → allow →
   Play Protect warning → "More details → Install anyway" (normal for
   any app outside the Play Store).
3. **Updates:** share the new APK; it installs **over** the old one
   (same signing key) and everyone stays logged in. No data loss — data
   is on the server.
4. **Trade-offs to accept (no Play Store):** no auto-updates (an in-app
   "update available" check can be added later), the Play Protect
   warning on each install, no store listing. Zero cost, full control.

### F. Monthly cost reality check

| Item | Cost |
|---|---|
| VPS hosting | ~₹400–500/month |
| Domain (optional) | ~₹700/year |
| Firebase push | ₹0 (free Spark plan) |
| APK distribution | ₹0 |
| Play Store fee | ₹0 (skipped) |

---

## Suggested order for "resolve the query number …"

`1` → `2` → `3` → `4` → `6` (pre-real-data fixes) → Firebase + Phase 1 →
hosting (§20 B) → rollout (Phase 2–3). The remaining audit items
(`#5`, `#7`–`#18`) slot in before or right after Phase 1.
