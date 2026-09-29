// Regression tests for the September 2026 full audit (see docs/AUDIT_FIXES.md).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, MAIN } from "./helpers.mjs";

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
  const done = await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  await f.firstLogin(m, phone);
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

test("a Village Admin's number changed by the Main Admin moves their login with it", async (t) => {
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
  await c("login", { mobile: "7990009999" });
  assert.equal((await c("state")).villageAdmin, true);
});

test("village-admin proposals survive backup and restore; a member on a new phone just logs in", async (t) => {
  const f = await setup(t);
  await join(f, "9000000001");
  const target = f.store.all("members").find((m) => m.phone === "9000000001");
  await f.va(G)("village/members/" + target.id + "/delete", {
    reason: "Moved away from the village",
    identityConfirmed: true,
  });
  // Same person, new phone: registering again is refused — they log in.
  assert.equal(
    (await f.client()("enrollment", member("9000000001", "Some Member Test"), 409)).code,
    "STATUS_APPROVED",
  );
  await f.client()("login", { mobile: "9000000001" });
  const backup = await f.admin("admin/backup");
  const preview = await f.admin("admin/restore/validate", backup);
  await f.admin("admin/restore", {
    backup,
    digest: preview.digest,
    currentDigest: preview.currentDigest,
  });
  assert.equal((await f.admin("state")).deleteRequests.length, 1);
  // The Village Admin keeps their PIN after the restore…
  const c = f.client();
  await c("login", { mobile: vaPhone(f.store) });
  assert.equal((await c("state")).villageAdmin, true);
  // …but phones logged in before the restore must log in again.
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

test("a disabled Village Admin loses access at once; a new one gets the village queue", async (t) => {
  const f = await setup(t);
  const m = f.client();
  const r = await m("enrollment", member("9000000003"));
  await f.admin("admin/village-admins/" + encodeURIComponent(G) + "/disable", {});
  let s = await f.va(G)("state");
  assert.equal(s.villageAdmin, false, "no admin tools any more");
  assert.equal(s.account.role, "MEMBER", "still a member of the village");
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true }, 403);
  // At most one ACTIVE admin per village: a new admin can now be created.
  const created = await f.admin("admin/village-admins/" + encodeURIComponent(G) + "/create", {
    name: "Second Administrator",
    mobile: "7991000002",
  });
  const v2 = f.client();
  await f.firstLogin(v2, "7991000002");
  await v2("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  // A second active admin for the same village is refused.
  assert.equal(
    (await f.admin("admin/village-admins/" + encodeURIComponent(G) + "/create", { name: "Third Admin", mobile: "7991000003" }, 409)).code,
    "VILLAGE_TAKEN",
  );
});

test("a Village Admin needs no PIN; a disabled or replaced admin loses the tools at once", async (t) => {
  const f = await setup(t);
  assert.equal((await f.va(G)("state")).villageAdmin, true);
  const c = f.client();
  const s = await c("login", { mobile: vaPhone(f.store) });
  assert.equal(s.account.role, "VILLAGE_ADMIN");
  assert.equal(s.account.mustSetPin, false);
  assert.equal(s.villageAdmin, true, "the admin tools are open straight after login");
  await f.admin("admin/village-admins/" + encodeURIComponent(G) + "/disable", {});
  assert.equal((await c("state")).villageAdmin, false);
});

test("wrong Main Admin passwords lock only that account, and a lockout never blocks other numbers", async (t) => {
  const f = await setup(t);
  const spam = f.client();
  for (let i = 0; i < 4; i++) await spam("login", { mobile: MAIN.mobile, secret: "wrong" + i + "xx" }, 401);
  assert.equal((await spam("login", { mobile: MAIN.mobile, secret: "wrong5xxx" }, 429)).code, "LOCKED_OUT");
  // A Village Admin (no secret at all) is unaffected.
  assert.equal((await f.client()("login", { mobile: vaPhone(f.store) })).account.role, "VILLAGE_ADMIN");
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
  // …after the Main Admin allows the number to register again.
  const ledger = (await f.admin("state")).rejectedApplications[0];
  await f.admin("admin/rejections/" + ledger.id + "/allow-rejoin", {});
  await f.client()("enrollment", member("9000000004", "Jjj Kkk Lll"));
  assert.ok((await f.admin("state")).newRequests[0].rejectedBefore);
});

test("rate limits use the forwarded client address behind a trusted proxy", async (t) => {
  const f = await fixture(t, { trustProxy: 1 });
  const call = (ip) =>
    fetch(f.url + "/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MVPMI-Client": "1",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ mobile: "9876500000", secret: "1357" }),
    });
  // Unknown numbers: 60 tries per visitor address in 15 minutes.
  for (let i = 0; i < 60; i++) assert.equal((await call("198.51.100.1")).status, 404);
  assert.equal((await call("198.51.100.1")).status, 429);
  // A different visitor is unaffected.
  assert.equal((await call("198.51.100.2")).status, 404);
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
    mainAdmin: MAIN,
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
