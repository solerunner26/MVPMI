import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";

async function start(t, extra = {}) {
  const { app, store } = createApp({ dbPath: ":memory:", adminPassword: "Testing@2026!", gateCode: "5831", driveEnv: {}, ...extra });
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
  assert.match(html, /All admins/, "no contact configured yet: points to the in-app list");
  assert.doesNotMatch(html, /9000000000|example\.org/);
  store.put("config", { id: "main-admin-contact", name: "મુખ્ય એડમિન", phone: "9876543210" });
  html = await (await fetch(url + "/delete-account")).text();
  assert.match(html, /\+91 9876543210/);
  assert.match(html, /Request removal from directory/);
  html = await (await fetch(url + "/download")).text();
  assert.match(html, /available soon/);
  assert.equal((await fetch(url + "/download/mvpmi.apk")).status, 404);
  writeFileSync(join(dir, "mvpmi.apk"), Buffer.from("PK fake apk"));
  html = await (await fetch(url + "/download")).text();
  assert.match(html, /href="\/download\/mvpmi\.apk"/);
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
  const css = /href="(\/vendor\/icons\/style\.css\?v=[a-f0-9]{10})"/.exec(html);
  assert.ok(css, "icon sheet link is versioned");
  const asset = await fetch(url + css[1], { headers: { "accept-encoding": "gzip" } });
  assert.equal(asset.headers.get("content-encoding"), "gzip");
  assert.match(asset.headers.get("cache-control"), /immutable/);
  const text = await asset.text();
  assert.ok(text.length < 40000, "icon sheet is subset to the icons in use");
  assert.match(text, /ph-lock-key/);
  assert.equal((await fetch(url + "/vendor/icons/Phosphor-Duotone.svg")).status, 404, "legacy font formats are not shipped");
  assert.equal((await fetch(url + "/api/nothing")).headers.get("cache-control"), "no-store");
});
