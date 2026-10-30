import test from "node:test";
import { MAIN } from "./helpers.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";

async function start(t, extra = {}) {
  const { app, store } = createApp({ dbPath: ":memory:", mainAdmin: MAIN, driveEnv: {}, ...extra });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    store.db.close();
  });
  return { url: "http://127.0.0.1:" + server.address().port, store };
}

test("privacy, account-deletion and download pages use live contact details only", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-dl-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { url, store } = await start(t, { downloadDir: dir });
  let html = await (await fetch(url + "/privacy")).text();
  assert.match(html, /Privacy policy/);
  // The contact is the seeded Main Admin (the same one "All admins" shows).
  assert.match(html, new RegExp("\\+91 " + MAIN.mobile));
  assert.doesNotMatch(html, /9000000000|example\.org/);
  html = await (await fetch(url + "/delete-account")).text();
  assert.match(html, new RegExp("\\+91 " + MAIN.mobile));
  assert.match(html, /Request removal from directory/);
  html = await (await fetch(url + "/download")).text();
  assert.match(html, /available soon/);
  assert.equal((await fetch(url + "/download/mvpmi.apk")).status, 404);
  writeFileSync(join(dir, "mvpmi.apk"), Buffer.from("PK fake apk"));
  html = await (await fetch(url + "/download")).text();
  assert.match(html, /href="\/download\/MVPMI-app\.apk"/);
  // With the version files the name shows version and build.
  writeFileSync(join(dir, "VERSION"), "v1.3.0-alpha.2\n");
  writeFileSync(join(dir, "BUILD"), "222\n");
  html = await (await fetch(url + "/download")).text();
  assert.match(html, /href="\/download\/MVPMI-v1\.3\.0-alpha\.2-build222\.apk"/);
  assert.match(html, /Version <b>1\.3\.0-alpha\.2<\/b>.*Build <b>222<\/b>/);
  const named = await fetch(url + "/download/MVPMI-v1.3.0-alpha.2-build222.apk");
  assert.equal(named.status, 200);
  assert.match(named.headers.get("content-disposition"), /MVPMI-v1\.3\.0-alpha\.2-build222\.apk/);
  const apk = await fetch(url + "/download/mvpmi.apk");
  assert.equal(apk.status, 200);
  assert.equal(apk.headers.get("content-type"), "application/vnd.android.package-archive");
});

test("static site: Brotli/gzip copies, versioned assets cached, HTML revalidated", async (t) => {
  const { url } = await start(t);
  const home = await fetch(url + "/", { headers: { "accept-encoding": "br" } });
  assert.equal(home.headers.get("content-encoding"), "br");
  assert.equal(home.headers.get("cache-control"), "no-cache");
  const html = await home.text();
  const css = /href="(\/vendor\/app-fonts\.css\?v=[a-f0-9]{10})"/.exec(html);
  assert.ok(css, "font and icon sheet link is versioned");
  const asset = await fetch(url + css[1], { headers: { "accept-encoding": "gzip" } });
  assert.equal(asset.headers.get("content-encoding"), "gzip");
  assert.match(asset.headers.get("cache-control"), /immutable/);
  const text = await asset.text();
  assert.ok(text.length < 60000, "icon rules are subset to the icons in use");
  assert.match(text, /ph-lock-key/);
  assert.equal((await fetch(url + "/vendor/icons/Phosphor-Duotone.svg")).status, 404, "legacy font formats are not shipped");
  assert.equal((await fetch(url + "/api/nothing")).headers.get("cache-control"), "no-store");
});

test("download page can send members to the GitHub release APK", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-dl-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const url0 = "https://github.com/solerunner26/MVPMI/releases/latest/download/mvpmi.apk";
  const { url } = await start(t, { downloadDir: dir, driveEnv: { APK_URL: url0 } });
  assert.match(await (await fetch(url + "/download")).text(), /href="\/download\/MVPMI-app\.apk"/);
  const r = await fetch(url + "/download/MVPMI-app.apk", { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), url0);
});

test("must-update: /api/app-version names the build this server can hand out", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-ver-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { url } = await start(t, { downloadDir: dir });
  const get = async () => (await fetch(url + "/api/app-version", { headers: { "X-MVPMI-Client": "1" } })).json();
  assert.deepEqual(await get(), { build: 0, version: "", url: "" }, "no APK: nothing to update to");
  writeFileSync(join(dir, "mvpmi.apk"), Buffer.from("PK fake apk"));
  writeFileSync(join(dir, "VERSION"), "v1.4.0\n");
  writeFileSync(join(dir, "BUILD"), "230\n");
  assert.deepEqual(await get(), { build: 230, version: "v1.4.0", url: "/download/MVPMI-v1.4.0-build230.apk" });
  // Also without the app header (plain GET).
  assert.equal((await fetch(url + "/api/app-version")).status, 200);
});

test("must-update: a test copy of the server can point its test app at another APK", async (t) => {
  const { url } = await start(t, {
    driveEnv: { APP_UPDATE_BUILD: "305", APP_UPDATE_VERSION: "test-305", APP_UPDATE_URL: "https://github.com/x/y/releases/download/test-build/app.apk" },
  });
  const r = await (await fetch(url + "/api/app-version")).json();
  assert.equal(r.build, 305);
  assert.match(r.url, /^https:\/\/github\.com\//);
});

test("a new app version is announced ONCE to every member's phone when its APK is on this server", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-ann-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { createApp: make } = await import("../server/app.mjs");
  const { app, store } = make({ dbPath: ":memory:", mainAdmin: MAIN, driveEnv: {}, downloadDir: dir });
  t.after(() => store.db.close());
  const notes = () => store.all("notifications").filter((n) => n.kind === "update");
  app.locals.announceUpdate();
  assert.equal(notes().length, 0, "no APK yet: nothing announced");
  writeFileSync(join(dir, "mvpmi.apk"), Buffer.alloc(200000, 1));
  writeFileSync(join(dir, "VERSION"), "v1.4.0\n");
  writeFileSync(join(dir, "BUILD"), "220\n");
  app.locals.announceUpdate();
  assert.ok(notes().length >= 1, "announced");
  assert.ok(notes().every((n) => n.to.startsWith("owner:")));
  const n = notes().length;
  app.locals.announceUpdate();
  assert.equal(notes().length, n, "not again for the same build");
  assert.equal(store.get("config", "update-announced").build, 220);
});
