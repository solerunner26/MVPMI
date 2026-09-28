import test from "node:test";
import { MAIN } from "./helpers.mjs";
import assert from "node:assert/strict";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";
import { encryptBackup, decryptBackup } from "../server/drive-backup.mjs";

const PASS = "correct horse battery staple";

test("backup encryption round-trips and rejects a wrong passphrase", () => {
  const data = Buffer.from("SQLite format 3\u0000 synthetic");
  const sealed = encryptBackup(data, PASS);
  assert.ok(!sealed.includes(Buffer.from("synthetic")), "ciphertext hides content");
  assert.deepEqual(decryptBackup(sealed, PASS), data);
  assert.throws(() => decryptBackup(sealed, "another passphrase!!"), /Wrong backup passphrase/);
  assert.throws(() => decryptBackup(Buffer.from("nope"), PASS), /Not an MVPMI/);
});

// A tiny stand-in for Google's OAuth and Drive endpoints.
async function fakeGoogle(t) {
  const g = express();
  const files = new Map();
  const seen = { tokens: 0, uploads: 0, deletes: 0 };
  let nextId = 1;
  g.use(express.urlencoded({ extended: false }));
  g.post("/token", (req, res) => {
    seen.tokens++;
    if (req.body.grant_type === "authorization_code") {
      assert.equal(req.body.code, "good-code");
      const idToken = "x." + Buffer.from(JSON.stringify({ email: "admin@example.org" })).toString("base64url") + ".y";
      return res.json({ access_token: "at1", refresh_token: "rt-secret", id_token: idToken });
    }
    assert.equal(req.body.refresh_token, "rt-secret");
    res.json({ access_token: "at2" });
  });
  g.post("/revoke", (req, res) => res.json({}));
  const auth = (req, res, next) => (/^Bearer at[12]$/.test(req.get("authorization") || "") ? next() : res.status(401).json({ error: { message: "bad token" } }));
  g.post("/api/files", auth, express.json(), (req, res) => {
    const id = "f" + nextId++;
    files.set(id, { id, name: req.body.name, folder: true, createdTime: new Date().toISOString() });
    res.json({ id });
  });
  g.get("/api/files/:id", auth, (req, res) => (files.has(req.params.id) ? res.json({ id: req.params.id, trashed: false }) : res.status(404).json({ error: { message: "not found" } })));
  g.get("/api/files", auth, (req, res) => {
    const list = [...files.values()].filter((f) => !f.folder).sort((a, b) => b.createdTime.localeCompare(a.createdTime) || b.id.localeCompare(a.id));
    res.json({ files: list });
  });
  g.delete("/api/files/:id", auth, (req, res) => {
    seen.deletes++;
    files.delete(req.params.id);
    res.status(204).end();
  });
  g.post("/upload/files", auth, express.raw({ type: "multipart/related", limit: "50mb" }), (req, res) => {
    seen.uploads++;
    const boundary = /boundary=(\S+)/.exec(req.get("content-type"))[1];
    const raw = req.body;
    const metaStart = raw.indexOf("\r\n\r\n") + 4;
    const metaEnd = raw.indexOf("\r\n--" + boundary, metaStart);
    const meta = JSON.parse(raw.subarray(metaStart, metaEnd).toString());
    const dataStart = raw.indexOf("\r\n\r\n", metaEnd) + 4;
    const dataEnd = raw.lastIndexOf("\r\n--" + boundary + "--");
    const id = "f" + nextId++;
    files.set(id, { id, name: meta.name, parents: meta.parents, data: raw.subarray(dataStart, dataEnd), createdTime: new Date(Date.now() + nextId).toISOString() });
    res.json({ id, name: meta.name, size: dataEnd - dataStart });
  });
  const server = g.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = "http://127.0.0.1:" + server.address().port;
  return {
    files,
    seen,
    google: { auth: base + "/auth", token: base + "/token", revoke: base + "/revoke", api: base + "/api", upload: base + "/upload" },
  };
}

test("Drive backup: admin connects, backs up an encrypted snapshot, cron hook and retention work", async (t) => {
  const fake = await fakeGoogle(t);
  const env = { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret", BACKUP_PASSPHRASE: PASS, PUBLIC_URL: "https://directory.example.org" };
  const { app, store } = createApp({
    dbPath: ":memory:",
    mainAdmin: MAIN,
    development: true,
    requireAppLock: false,
    driveEnv: env,
    driveOptions: { google: fake.google },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    store.db.close();
  });
  const url = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  const call = async (path, body, headers = {}) => {
    const res = await fetch(url + path, {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      headers: { Cookie: cookie, "X-MVPMI-Client": "1", "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.headers.get("set-cookie")) cookie = res.headers.get("set-cookie").split(";")[0];
    return res;
  };
  // Not signed in: nothing is reachable.
  assert.equal((await call("/api/admin/drive")).status, 403);
  assert.equal((await call("/api/login", { mobile: MAIN.mobile, secret: MAIN.password })).status, 200);

  let status = await (await call("/api/admin/drive")).json();
  assert.equal(status.configured, true);
  assert.equal(status.connected, false);
  assert.match(status.cronCommand, /^curl .*https:\/\/directory\.example\.org\/api\/cron\/backup$/);

  const { url: consent } = await (await call("/api/admin/drive/connect", {})).json();
  const u = new URL(consent);
  assert.equal(u.searchParams.get("redirect_uri"), "https://directory.example.org/api/drive/callback");
  assert.match(u.searchParams.get("scope"), /auth\/drive\.file/);
  assert.equal(u.searchParams.get("access_type"), "offline");
  const state = u.searchParams.get("state");

  // A forged state is refused and cannot be retried with the right one.
  let r = await call("/api/drive/callback?code=good-code&state=" + "0".repeat(state.length));
  assert.equal(r.headers.get("location"), "/?drive=error");
  r = await call("/api/drive/callback?code=good-code&state=" + state);
  assert.equal(r.headers.get("location"), "/?drive=error", "state is single-use");

  const { url: consent2 } = await (await call("/api/admin/drive/connect", {})).json();
  r = await call("/api/drive/callback?code=good-code&state=" + new URL(consent2).searchParams.get("state"));
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/?drive=connected");
  // The refresh token is stored encrypted, never in plain text.
  assert.equal(JSON.stringify(store.get("config", "drive-backup")).includes("rt-secret"), false);

  // Wait for the automatic first backup, then run a manual one.
  for (let i = 0; i < 50 && !store.get("config", "drive-backup").lastSuccess; i++) await new Promise((x) => setTimeout(x, 20));
  status = await (await call("/api/admin/drive/backup", {})).json();
  assert.equal(status.connected, true);
  assert.equal(status.account, "admin@example.org");
  assert.equal(status.lastError, "");
  assert.match(status.lastFile, /^mvpmi-.*\.sqlite\.gz\.enc$/);
  assert.equal(fake.seen.uploads, 2);

  // The uploaded file decrypts to a real SQLite database with the data.
  const uploaded = [...fake.files.values()].find((f) => f.data);
  const plain = decryptBackup(uploaded.data, PASS);
  assert.equal(plain.subarray(0, 15).toString(), "SQLite format 3");
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-restore-"));
  try {
    writeFileSync(join(dir, "db.sqlite"), plain);
    const db = new DatabaseSync(join(dir, "db.sqlite"), { readOnly: true });
    assert.ok(db.prepare("SELECT data FROM config WHERE id = 'main-admin'").get(), "Main Admin config is in the backup");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(uploaded.parents?.[0], "backups go into the app's own folder");

  // Cron hook: wrong token refused, right token backs up.
  const adminCookie = cookie;
  const cronToken = /X-MVPMI-Cron: ([a-f0-9]+)/.exec(status.cronCommand)[1];
  assert.equal((await call("/api/cron/backup", {}, { "X-MVPMI-Cron": "f".repeat(cronToken.length), Cookie: "" })).status, 403);
  r = await call("/api/cron/backup", {}, { "X-MVPMI-Cron": cronToken, Cookie: "" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  cookie = adminCookie;

  // Retention keeps the newest 30 files.
  for (let i = 0; i < 30; i++) {
    const id = "old" + i;
    fake.files.set(id, { id, name: `mvpmi-2020-01-${String(i + 1).padStart(2, "0")}.sqlite.gz.enc`, createdTime: "2020-01-01T00:00:00.000Z" });
  }
  r = await call("/api/admin/drive/backup", {});
  assert.equal(r.status, 200, await r.text());
  assert.equal([...fake.files.values()].filter((f) => !f.folder).length, 30, JSON.stringify({ deletes: fake.seen.deletes, err: store.get("config", "drive-backup").lastError, names: [...fake.files.values()].map((f) => f.name) }).slice(0, 900));

  // Disconnect forgets the token.
  status = await (await call("/api/admin/drive/disconnect", {})).json();
  assert.equal(status.connected, false);
});

test("Drive backup is off (and harmless) when the server is not configured", async (t) => {
  const { app, store } = createApp({
    dbPath: ":memory:",
    mainAdmin: MAIN,
    development: true,
    requireAppLock: false,
    driveEnv: {},
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    store.db.close();
  });
  const url = "http://127.0.0.1:" + server.address().port;
  const res = await fetch(url + "/api/cron/backup", {
    method: "POST",
    headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json", "X-MVPMI-Cron": "x" },
    body: "{}",
  });
  assert.equal(res.status, 403);
});
