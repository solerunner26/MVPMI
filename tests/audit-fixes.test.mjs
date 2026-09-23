// Regression tests for the September 2026 full audit (see docs/AUDIT_FIXES.md).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, VA_PASS } from "./helpers.mjs";

const G = "થોરાળા";
const member = (phone, name = "Some Member Test") => ({
  firstName: name.split(" ")[0],
  middleName: name.split(" ")[1],
  surname: name.split(" ")[2],
  phone,
  village: "Thorala",
  consent: true,
});
const vaPhone = (store) =>
  store.get("members", store.get("villageAdmins", G).memberId).phone;
async function setup(t, options) {
  const f = await fixture(t, options);
  await f.ensureAdmin("Thorala");
  return f;
}
async function join(f, phone, name) {
  const m = f.client();
  const r = await m("enrollment", member(phone, name));
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", {
    identityConfirmed: true,
  });
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  return m;
}

test("village-verified number change: member request waits for the village administrator", async (t) => {
  const f = await setup(t);
  const m = await join(f, "9000000001");
  const s = await m("profile/update", member("9000000009"));
  const id = s.updateRequests[0].id;
  await f.admin("admin/requests/" + id + "/approve", {}, 409);
  const va = await f.va(G)("state");
  assert.ok(va.reviewQueue.some((r) => r.id === id));
  await f.va(G)("village/requests/" + id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + id + "/approve", {});
  assert.ok(f.store.all("members").some((x) => x.phone === "9000000009"));
});

test("a village administrator's own number change goes straight to the main administrator and moves the sign-in", async (t) => {
  const f = await setup(t);
  const store = f.store;
  const vaMember = store.get("members", store.get("villageAdmins", G).memberId);
  // Main administrator edits the village administrator's number directly.
  await f.admin("admin/members/" + vaMember.id, {
    firstName: "Administrator",
    middleName: "",
    surname: "Thorala",
    phone: "7990009999",
    village: "Thorala",
  });
  const c = f.client();
  await c("village/login", { phone: "7990009999", pass: VA_PASS });
  assert.equal((await c("state")).villageAdmin, true);
  assert.equal(store.get("villageAdmins", G).username, "7990009999");
});

test("village-admin proposals and device-replacement applications survive backup and restore", async (t) => {
  const f = await setup(t);
  await join(f, "9000000001");
  const target = f.store.all("members").find((m) => m.phone === "9000000001");
  await f.va(G)("village/members/" + target.id + "/delete", {
    reason: "Moved away from the village",
    identityConfirmed: true,
  });
  // Same person, new phone/device: applies again with the same number.
  await f.client()("enrollment", member("9000000001", "Some Member Test"));
  const backup = await f.admin("admin/backup");
  const preview = await f.admin("admin/restore/validate", backup);
  await f.admin("admin/restore", {
    backup,
    digest: preview.digest,
    currentDigest: preview.currentDigest,
  });
  // Village administrator keeps their password after restore…
  const c = f.client();
  await c("village/login", { phone: vaPhone(f.store), pass: VA_PASS });
  // …but sessions signed in before the restore are ended.
  assert.equal((await f.va(G)("state")).villageAdmin, false);
});

test("older backups (renamed village) keep a matching confirmation digest", async (t) => {
  const f = await setup(t);
  const backup = await f.admin("admin/backup");
  backup.villages = backup.villages.map((v) =>
    v.gu === "જીંજકા" ? { ...v, id: "ઝીંજકા", gu: "ઝીંજકા" } : v,
  );
  const preview = await f.admin("admin/restore/validate", backup);
  await f.admin("admin/restore", {
    backup,
    digest: preview.digest,
    currentDigest: preview.currentDigest,
  });
});

test("replacing a village administrator returns forwarded requests to the new administrator", async (t) => {
  const f = await setup(t);
  const m = f.client();
  const r = await m("enrollment", member("9000000003"));
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/village-admins/" + encodeURIComponent(G), {
    name: "Second Administrator",
    phone: "7991000002",
    pass: VA_PASS,
    reason: "Replacement administrator",
    identityConfirmed: true,
  });
  const v2 = f.client();
  await v2("village/login", { phone: "7991000002", pass: VA_PASS });
  await v2("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
});

test("password reset ends existing village-administrator sessions", async (t) => {
  const f = await setup(t);
  assert.equal((await f.va(G)("state")).villageAdmin, true);
  await f.admin("admin/village-admins/" + encodeURIComponent(G) + "/password", {
    pass: "Other@2026!x",
    identityConfirmed: true,
  });
  assert.equal((await f.va(G)("state")).villageAdmin, false);
});

test("strangers cannot lock out the administrators", async (t) => {
  const f = await setup(t);
  // Without the hidden gate, login attempts never touch a shared counter.
  for (let i = 0; i < 35; i++)
    await f.client()("admin/login", { user: "x", pass: "y" }, 403);
  const b = f.client();
  await b("admin/gate", { code: "5831" });
  await b("admin/login", { user: "admin", pass: "Testing@2026!" });
  // Wrong village-admin passwords are limited per number AND client, and
  // correct passwords are not counted at all.
  const phone = vaPhone(f.store);
  const spam = f.client();
  for (let i = 0; i < 5; i++)
    await spam("village/login", { phone, pass: "bad" }, 401);
  await spam("village/login", { phone, pass: "bad" }, 429);
});

test("withdrawn or replaced applications are not flagged as 'rejected before'", async (t) => {
  const f = await setup(t);
  const m = f.client();
  for (const n of ["Aaa Bbb Ccc", "Ddd Eee Fff", "Ggg Hhh Iii"])
    await m("enrollment", member("9000000004", n));
  const s = await f.admin("state");
  assert.equal(s.newRequests[0].rejectedBefore, null);
  // A real rejection IS flagged on the next application.
  await f.va(G)("village/requests/" + s.newRequests[0].id + "/reject", {
    reason: "Not from this village",
    category: "not-community",
  });
  await f.client()("enrollment", member("9000000004", "Jjj Kkk Lll"));
  assert.ok((await f.admin("state")).newRequests[0].rejectedBefore);
});

test("device replacement keeps the member's second number and location", async (t) => {
  const f = await setup(t);
  const m = f.client();
  const r = await m("enrollment", {
    ...member("9000000005"),
    phone2: "9000000006",
    currentLocation: "Surat",
  });
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  const old = f.store.all("members").find((x) => x.phone === "9000000005");
  const n = f.client();
  const again = await n("enrollment", member("9000000005"));
  await f.va(G)("village/requests/" + again.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + again.myRequest.id + "/approve", {
    replaceExistingMemberId: old.id,
    identityConfirmed: true,
  });
  const now = f.store.get("members", old.id);
  assert.equal(now.phone2, "9000000006");
  assert.equal(now.currentLocation, "Surat");
  assert.equal((await n("state")).role, "member");
});

test("rate limits use the forwarded client address behind a trusted proxy", async (t) => {
  const f = await fixture(t, { trustProxy: 1 });
  for (let i = 0; i < 5; i++)
    await f.client()("admin/gate", { code: "0000" }, 401);
  const call = (ip) =>
    fetch(f.url + "/api/admin/gate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MVPMI-Client": "1",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ code: "0000" }),
    });
  for (let i = 0; i < 30; i++) assert.equal((await call("198.51.100.1")).status, 401);
  assert.equal((await call("198.51.100.1")).status, 429);
  // A different visitor is unaffected.
  assert.equal((await call("198.51.100.2")).status, 401);
});

test("origin check accepts the forwarded public host behind a proxy", async (t) => {
  const f = await fixture(t, { trustProxy: 1 });
  const r = await fetch(f.url + "/api/enrollment/withdraw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MVPMI-Client": "1",
      Origin: "https://directory.example.org",
      "X-Forwarded-Host": "directory.example.org",
    },
    body: "{}",
  });
  assert.equal(r.status, 200);
});

test("admin downloads cannot be triggered by a plain cross-site link", async (t) => {
  const f = await fixture(t);
  const r = await fetch(f.url + "/api/admin/backup");
  assert.equal(r.status, 403);
});

test("expired and abandoned rows are cleaned up", async (t) => {
  const f = await fixture(t);
  f.store.put("sessions", { id: "x".repeat(64), owner: "nobody", createdAt: 0, expires: Date.now() + 1e9 });
  f.store.put("limits", { id: "old", count: 1, until: 0 });
  f.store.cleanup();
  assert.equal(f.store.get("sessions", "x".repeat(64)), null);
  assert.equal(f.store.get("limits", "old"), null);
});

test("CSV reports cannot carry spreadsheet formulas", async (t) => {
  const f = await setup(t);
  await join(f, "9000000041", '=HYPERLINK("x") Middle Name');
  const csv = Buffer.from(await f.admin("admin/export.csv?type=members&lang=en")).toString("utf8");
  assert.ok(csv.includes("'=HYPERLINK"), "formula-looking text is prefixed with an apostrophe");
});

test("health check and consistent database backup script", async (t) => {
  const { mkdtempSync, readdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const { createApp } = await import("../server/app.mjs");
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-backup-"));
  const { store } = createApp({
    dbPath: join(dir, "db.sqlite"),
    adminPassword: "Backup@2026!x",
    gateCode: "5831",
  });
  store.db.close();
  const r = spawnSync(process.execPath, ["scripts/backup-db.mjs", join(dir, "db.sqlite"), join(dir, "out")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readdirSync(join(dir, "out")).length, 1);
  const f = await fixture(t);
  const health = await f.client()("health");
  assert.equal(health.ok, true);
  assert.equal(health.mode, "development");
});
