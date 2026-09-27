// Nightly encrypted database backup to the main administrator's Google Drive.
//
// • Free: uses the administrator's own Drive (15 GB free) through Google's
//   OAuth "drive.file" permission — the app can only see files it created,
//   never the rest of the Drive.
// • Private: every backup is a consistent SQLite snapshot, gzip-compressed
//   and encrypted with AES-256-GCM using a key derived (scrypt) from the
//   BACKUP_PASSPHRASE kept only on the server. Google never sees member data.
// • Reliable on shared hosting: a daily cPanel cron job runs
//   `node scripts/backup-drive.mjs`; the server also starts an overdue backup
//   on its own when it is awake (Passenger may stop idle apps at night).
//
// Configuration (environment variables):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  OAuth "Web application" client
//   BACKUP_PASSPHRASE                       16+ characters; needed to restore
//   PUBLIC_URL                              https://your-site (OAuth redirect)
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAGIC = Buffer.from("MVPMIBK1");
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "MVPMI backups";
const KEEP = 30;
const DAY = 86400000;

export const defaultGoogle = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
  api: "https://www.googleapis.com/drive/v3",
  upload: "https://www.googleapis.com/upload/drive/v3",
};

// ---- Encryption -------------------------------------------------------
function key(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
export function encryptBackup(plain, passphrase) {
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}
export function decryptBackup(file, passphrase) {
  if (file.length < 52 || !file.subarray(0, 8).equals(MAGIC))
    throw new Error("Not an MVPMI encrypted backup");
  const salt = file.subarray(8, 24),
    iv = file.subarray(24, 36),
    tag = file.subarray(36, 52);
  const decipher = createDecipheriv("aes-256-gcm", key(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return gunzipSync(Buffer.concat([decipher.update(file.subarray(52)), decipher.final()]));
  } catch {
    throw new Error("Wrong backup passphrase or damaged file");
  }
}

// Consistent copy of the live database (safe while the app is running).
export function snapshotDatabase(store) {
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-backup-"));
  const file = join(dir, "community.sqlite");
  try {
    store.db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
    return readFileSync(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- Drive backup service ---------------------------------------------
export function createDriveBackup(store, env = process.env, { google = defaultGoogle, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const clientId = env.GOOGLE_CLIENT_ID || "",
    clientSecret = env.GOOGLE_CLIENT_SECRET || "",
    passphrase = env.BACKUP_PASSPHRASE || "",
    publicUrl = String(env.PUBLIC_URL || "").replace(/\/+$/, "");
  const configured = !!(clientId && clientSecret && passphrase.length >= 16 && /^https?:\/\//.test(publicUrl));
  const redirectUri = publicUrl + "/api/drive/callback";
  const cfg = () => store.get("config", "drive-backup") || { id: "drive-backup" };
  const save = (patch) => store.put("config", { ...cfg(), ...patch, id: "drive-backup" });
  let running = null;

  // The refresh token is stored encrypted with the backup passphrase, so a
  // copied database alone cannot be used to reach the Drive.
  const sealToken = (t) => encryptBackup(Buffer.from(t, "utf8"), passphrase).toString("base64");
  const openToken = (s) => decryptBackup(Buffer.from(s, "base64"), passphrase).toString("utf8");

  async function google_(url, init = {}) {
    const res = await fetchImpl(url, init);
    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    if (!res.ok) {
      const detail = body.error_description || body.error?.message || body.error || res.status;
      throw Object.assign(new Error("Google Drive: " + detail), { status: 502, google: body });
    }
    return body;
  }
  async function accessToken() {
    const c = cfg();
    if (!c.refresh) throw Object.assign(new Error("Google Drive is not connected"), { status: 409 });
    const body = await google_(google.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: openToken(c.refresh),
        grant_type: "refresh_token",
      }),
    });
    return body.access_token;
  }
  async function folder(token) {
    const c = cfg();
    const auth = { Authorization: "Bearer " + token };
    if (c.folderId) {
      try {
        const f = await google_(`${google.api}/files/${encodeURIComponent(c.folderId)}?fields=id,trashed`, { headers: auth });
        if (!f.trashed) return c.folderId;
      } catch {}
    }
    const f = await google_(`${google.api}/files?fields=id`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    save({ folderId: f.id });
    return f.id;
  }

  return {
    configured,
    redirectUri,
    status() {
      const c = cfg();
      return {
        configured,
        connected: !!c.refresh,
        account: c.account || "",
        lastSuccess: c.lastSuccess || 0,
        lastFile: c.lastFile || "",
        lastError: c.lastError || "",
        lastAttempt: c.lastAttempt || 0,
        kept: KEEP,
      };
    },
    authUrl(state) {
      if (!configured) throw Object.assign(new Error("Drive backup is not configured on the server"), { status: 409 });
      return (
        google.auth +
        "?" +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: SCOPE + " openid email",
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
          state,
        })
      );
    },
    async connect(code) {
      const body = await google_(google.token, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!body.refresh_token) throw Object.assign(new Error("Google did not return offline access; try again"), { status: 502 });
      let account = "";
      try {
        const payload = JSON.parse(Buffer.from(String(body.id_token || "").split(".")[1] || "", "base64url").toString("utf8"));
        account = payload.email || "";
      } catch {}
      save({ refresh: sealToken(body.refresh_token), account, connectedAt: now(), folderId: "", lastError: "" });
    },
    async disconnect() {
      const c = cfg();
      if (c.refresh) {
        try {
          await fetchImpl(google.revoke, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: openToken(c.refresh) }),
          });
        } catch {}
      }
      store.put("config", { id: "drive-backup" });
    },
    // One backup: snapshot → encrypt → upload → keep the newest 30.
    async backup(reason = "manual") {
      if (running) return running;
      running = (async () => {
        save({ lastAttempt: now() });
        try {
          const token = await accessToken();
          const parent = await folder(token);
          const stamp = new Date(now()).toISOString().replace(/[:T]/g, "-").slice(0, 16);
          const name = `mvpmi-${stamp}.sqlite.gz.enc`;
          const data = encryptBackup(snapshotDatabase(store), passphrase);
          const boundary = "mvpmi" + randomBytes(12).toString("hex");
          const meta = JSON.stringify({ name, parents: [parent], description: "MVPMI encrypted backup (" + reason + ")" });
          const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
            data,
            Buffer.from(`\r\n--${boundary}--`),
          ]);
          const file = await google_(`${google.upload}/files?uploadType=multipart&fields=id,name,size`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token, "Content-Type": `multipart/related; boundary=${boundary}` },
            body,
          });
          // Retention: delete the oldest backups beyond the newest 30.
          const list = await google_(
            `${google.api}/files?` +
              new URLSearchParams({
                q: `'${parent}' in parents and trashed = false`,
                orderBy: "createdTime desc",
                fields: "files(id,name,createdTime)",
                pageSize: "200",
              }),
            { headers: { Authorization: "Bearer " + token } },
          );
          for (const old of (list.files || []).filter((f) => /^mvpmi-.*\.enc$/.test(f.name)).slice(KEEP)) {
            try {
              await fetchImpl(`${google.api}/files/${encodeURIComponent(old.id)}`, {
                method: "DELETE",
                headers: { Authorization: "Bearer " + token },
              });
            } catch {}
          }
          save({ lastSuccess: now(), lastFile: file.name || name, lastError: "", lastBytes: data.length });
          store.put("config", { id: "backup", when: new Date(now()).toISOString(), where: "drive" });
          store.audit("system", "drive-backup.ok", file.name || name);
          return { ok: true, name: file.name || name, bytes: data.length };
        } catch (e) {
          save({ lastError: String(e.message || e).slice(0, 300) });
          try {
            store.audit("system", "drive-backup.failed", String(e.message || e).slice(0, 120));
          } catch {}
          throw e;
        } finally {
          running = null;
        }
      })();
      return running;
    },
    // Called on ordinary traffic: start a backup when the last one is older
    // than a day (covers hosts where cron is not set up).
    due() {
      const c = cfg();
      return configured && !!c.refresh && !running && now() - (c.lastSuccess || 0) > DAY && now() - (c.lastAttempt || 0) > 3600000;
    },
  };
}
