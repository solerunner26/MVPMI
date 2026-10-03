import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { firstPasswordDone } from "./helpers.mjs";
const form = {
  name: "Test Member",
  phone: "9000000001",
  phone2: "",
  village: "Thorala",
  consent: true,
};
const MAIN = {
  name: "Main Admin Test",
  mobile: "9913000001",
  village: "Thorala",
  location: "Thorala",
  password: "Testing@26",
};
async function setup(t, opts = {}) {
  const { app, store } = createApp({
    requireAppLock: false,
    dbPath: ":memory:",
    mainAdmin: MAIN,
    development: true,
    ...opts,
  });
  firstPasswordDone(store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => {
    server.close();
    store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const client = () => {
    let cookie = "";
    return async (path, body, expected = 200) => {
      const r = await fetch(base + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: cookie,
          "X-MVPMI-Client": "1",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      assert.equal(r.status, expected, `${path}: ${await r.clone().text()}`);
      return r.headers.get("content-type")?.includes("json")
        ? r.json()
        : r.arrayBuffer();
    };
  };
  const admin = client();
  await admin("login", { mobile: MAIN.mobile, secret: MAIN.password });
  const created = await admin(
    "admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create",
    { name: "Thorala Administrator", mobile: "7990000010" },
  );
  const va = client();
  await va("login", { mobile: "7990000010" });
  const forward = (id) =>
    va("village/requests/" + id + "/forward", {
      reason: "Verified community member",
      identityConfirmed: true,
    });
  // Approve a joining request and log the new member in with the mobile number.
  const approveAndLogin = async (user, requestId, phone, pin = "3691") => {
    const approved = await admin("admin/requests/" + requestId + "/approve", {});
    assert.equal(approved.issuedPin, undefined, "no TEMP PIN any more");
    await user("login", { mobile: phone });
    return {};
  };
  return { store, client, admin, va, forward, base, approveAndLogin };
}
test("approval gate, ownership, request replacement, withdrawal and admin-only archive", async (t) => {
  const { client, admin } = await setup(t);
  const a = client(),
    b = client();
  assert.deepEqual((await a("state")).members, []);
  await a("admin/backup", undefined, 403);
  await a("profile/delete", {}, 401);
  await a("enrollment", form);
  await a("enrollment", { ...form, name: "Edited Name" });
  const state = await admin("state");
  assert.equal(state.newRequests.length, 1);
  assert.equal(state.archive.length, 0);
  assert.equal(state.rejectedApplications.length, 1);
  await b("enrollment", form, 409);
  assert.equal((await b("state")).myRequest, null);
  assert.equal((await a("state")).archive.length, 0);
  await a("enrollment/withdraw", {});
  assert.equal((await admin("state")).rejectedApplications[0].events.length, 2);
  assert.equal((await a("state")).role, "guest");
});
test("approve, search data, update stays private, direct admin edit, delete revokes access", async (t) => {
  const { client, admin, forward, approveAndLogin } = await setup(t),
    a = client();
  await a("enrollment", form);
  let s = await admin("state");
  await forward(s.newRequests[0].id);
  const request = s.newRequests[0].id;
  await approveAndLogin(a, request, form.phone);
  s = await a("state");
  assert.equal(s.role, "member");
  // Main Admin, Village Admin and the new member.
  assert.equal(s.members.length, 3);
  const mine = s.members.find((m) => m.phone === form.phone);
  assert.equal(mine.owner, undefined);
  await a("profile/update", { ...form, name: "New Name", phone: "9000000002" });
  assert.equal(
    (await a("state")).members.find((m) => m.phone === form.phone).phone,
    form.phone,
  );
  s = await admin("state");
  const update = s.updateRequests[0].id;
  // Owner requirement: a mobile-number change is verified and forwarded by
  // the village administrator before the main administrator can approve it.
  await admin("admin/requests/" + update + "/approve", {}, 409);
  assert.ok(s.reviewQueue.some((r) => r.id === update && r.stage === "village"));
  await forward(update);
  await admin("admin/requests/" + update + "/approve", {});
  const changed = (await a("state")).members.find((m) => m.phone === "9000000002");
  assert.equal(changed.name, "New Name");
  // Typed in English: a Gujarati spelling is added automatically.
  assert.match(changed.nameGu, /[\u0A80-\u0AFF]/);
  await admin("admin/requests/" + update + "/approve", {}, 409);
  const id = (await a("state")).meId;
  await admin("admin/members/" + id, { ...form, name: "Direct Admin Edit" });
  assert.equal(
    (await a("state")).members.find((m) => m.phone === form.phone).name,
    "Direct Admin Edit",
  );
  await a("profile/delete", {});
  await a("profile/delete", {});
  s = await admin("state");
  assert.equal(s.deleteRequests.length, 1);
  await admin("admin/requests/" + s.deleteRequests[0].id + "/approve", {});
  assert.equal((await a("state")).role, "guest");
  assert.deepEqual((await a("state")).members, []);
  await a("profile/update", form, 401);
  // The removed number cannot register again or log in.
  const again = await client()("enrollment", form, 409);
  assert.equal(again.code, "STATUS_REMOVED");
  assert.equal((await client()("login", { mobile: form.phone }, 409)).code, "STATUS_REMOVED");
});
test("backup validation is atomic, roundtrip restores links, export is a genuine XLSX", async (t) => {
  const { client, admin, forward, approveAndLogin } = await setup(t),
    a = client();
  await a("enrollment", form);
  let s = await admin("state");
  await forward(s.newRequests[0].id);
  await approveAndLogin(a, s.newRequests[0].id, form.phone);
  const backup = await admin("admin/backup");
  assert.equal(backup.schemaVersion, 2);
  assert.equal(backup.sessions, undefined);
  // No PIN or PASSWORD hash ever leaves the server.
  assert.equal(JSON.stringify(backup).includes('"cred"'), false);
  assert.equal(JSON.stringify(backup).includes("$2"), false);
  await admin(
    "admin/restore/validate",
    { ...backup, members: [...backup.members, ...backup.members] },
    400,
  );
  assert.equal((await a("state")).members.length, 3);
  await admin(
    "admin/members/" +
      backup.members.find((m) => m.phone === form.phone).id +
      "/delete",
    {},
  );
  const diff = await admin("admin/restore/validate", backup);
  await admin("admin/restore", {
    backup,
    digest: diff.digest,
    currentDigest: diff.currentDigest,
  });
  // Everyone logs in again after a restore (with the mobile number only).
  assert.equal((await a("state")).role, "guest");
  await a("login", { mobile: form.phone });
  assert.equal((await a("state")).role, "member");
  const xlsx = Buffer.from(await admin("admin/export.xlsx"));
  assert.equal(xlsx.subarray(0, 2).toString(), "PK");
});
test("CSV reports download with a UTF-8 BOM and admin-only access", async (t) => {
  const { client, admin } = await setup(t);
  await client()("admin/export.csv?type=members", undefined, 403);
  for (const type of [
    "members",
    "villages",
    "requests",
    "rejections",
    "archive",
    "activity",
    "full",
  ]) {
    const csv = Buffer.from(await admin("admin/export.csv?type=" + type)).toString("utf8");
    assert.ok(csv.startsWith("\uFEFF"), type + " has a BOM");
    assert.ok(
      csv.includes("ગામ") ||
        csv.includes("Village") ||
        csv.includes("Action") ||
        csv.includes("ક્રિયા"),
      type + " header",
    );
    assert.ok(csv.includes("\u0a95\u0acd\u0ab0\u0aae,#") || csv.includes("#,\u0a95\u0acd\u0ab0\u0aae") || csv.includes("\u0a95\u0acd\u0ab0\u0aae"), type + " serial column");
    if (type === "members" || type === "villages") {
      const firstData = csv
        .split("\r\n")
        .find((l) => /^\uFEFF?[0-9]+,/.test(l) || /^[0-9]+,/.test(l));
      assert.ok(firstData, type + " has serial-numbered rows");
      assert.match(firstData, /^(\uFEFF)?1,/);
    }
  }
  await admin("admin/export.csv?type=nonsense", undefined, 400);
});
test("a rejected phone cannot register again until the Main Admin allows it; then both admins see the warning", async (t) => {
  const { client, admin, forward } = await setup(t);
  const a = client();
  await a("enrollment", { ...form, phone: "9003000001" });
  let s = await admin("state");
  await forward(s.newRequests[0].id);
  await admin(
    "admin/requests/" + s.newRequests[0].id + "/reject",
    { reason: "Not recognised" },
  );
  // The same person applies again from a fresh session.
  const b = client();
  assert.equal((await b("enrollment", { ...form, phone: "9003000001" }, 409)).code, "STATUS_REJECTED");
  assert.equal((await b("login", { mobile: "9003000001", secret: "1357" }, 409)).code, "STATUS_REJECTED");
  s = await admin("state");
  await admin("admin/rejections/" + s.rejectedApplications[0].id + "/allow-rejoin", {});
  await b("enrollment", { ...form, phone: "9003000001" });
  s = await admin("state");
  assert.ok(
    s.newRequests.some((r) => r.phone === "9003000001" && r.rejectedBefore),
    "the new request carries the rejection warning",
  );
  assert.ok(
    s.reviewQueue.some((r) => r.payload.phone === "9003000001" && r.rejectedBefore),
    "the village administrator sees the warning too",
  );
});
test("server rejects invalid fields, ignores injected approval, rejects stale updates", async (t) => {
  const { client, admin, forward, approveAndLogin } = await setup(t),
    a = client();
  await a("enrollment", { ...form, phone2: "1234567890" }, 400);
  await a("enrollment", { ...form, village: "Unknown" }, 400);
  await a("enrollment", { ...form, consent: false }, 400);
  await a("enrollment", { ...form, role: "admin", status: "approved" });
  assert.equal((await a("state")).role, "pending");
  let s = await admin("state");
  await forward(s.newRequests[0].id);
  await approveAndLogin(a, s.newRequests[0].id, form.phone);
  await a("profile/update", { ...form, name: "Requested Name" });
  s = await admin("state");
  await admin(
    "admin/members/" + s.members.find((m) => m.phone === form.phone).id,
    { ...form, name: "Concurrent Admin Edit" },
  );
  await admin("admin/requests/" + s.updateRequests[0].id + "/approve", {}, 409);
});
test("authentication, failed attempt auditing, device blocking and admin logout", async (t) => {
  const { client, admin } = await setup(t),
    a = client();
  await a("admin/backup", undefined, 403);
  const wrong = await a("login", { mobile: MAIN.mobile, secret: "Wrong@pass1" }, 401);
  assert.equal(wrong.code, "WRONG_PASSWORD");
  assert.equal(wrong.left, 4);
  let s = await admin("state");
  assert.equal(s.alerts.length, 1);
  // Alerts never show a full phone number.
  assert.doesNotMatch(s.alerts[0].title, /9913000001/);
  await admin("admin/alerts/" + s.alerts[0].id + "/block", {});
  await a("state", undefined, 403);
  // "Log out" in the admin tools ends ONLY admin mode.
  s = await admin("admin/logout", {});
  assert.equal(s.role, "member");
  assert.equal(s.account.role, "MAIN_ADMIN");
  assert.equal(s.account.adminMode, false);
  assert.ok(s.members.length >= 2, "still sees the directory as a member");
  await admin("admin/backup", undefined, 403);
  // Re-opening the admin tools asks for the password again.
  await admin("admin/enter", { secret: "nope-nope" }, 401);
  s = await admin("admin/enter", { secret: MAIN.password });
  assert.equal(s.role, "admin");
  // "Sign out of this phone" clears everything.
  await admin("logout", {});
  s = await admin("state");
  assert.equal(s.role, "guest");
  assert.equal(s.account, null);
  assert.deepEqual(s.members, []);
});
test("Section 2: Main Admin is seeded once from server config, logs in with mobile + password and can change it", async (t) => {
  const { client, admin, store } = await setup(t);
  const main = store.all("members").find((m) => m.phone === MAIN.mobile);
  assert.ok(main, "seeded as a member of Thorala");
  assert.equal(main.village, "થોરાળા");
  assert.equal(main.currentLocation, "Thorala");
  assert.match(main.cred.password, /^\$2[aby]\$10\$/, "bcrypt hash");
  assert.equal(JSON.stringify(main).includes(MAIN.password), false);
  const me = (await admin("state")).account;
  assert.deepEqual(
    [me.role, me.name, me.phone, me.village, me.currentLocation],
    ["MAIN_ADMIN", "Main Admin Test", MAIN.mobile, "થોરાળા", "Thorala"],
  );
  // Change Password dialog rules, in order.
  const change = (body, status) => admin("password/change", body, status);
  assert.equal((await change({ current: "wrong-old", next: "Another@26", confirm: "Another@26" }, 401)).code, "WRONG_OLD_PASSWORD");
  assert.equal((await change({ current: MAIN.password, next: "abc", confirm: "abc" }, 400)).code, "PASSWORD_FORMAT");
  // No complexity rules: four plain characters are enough (owner decision).
  assert.equal((await change({ current: MAIN.password, next: "abcd", confirm: "abcd" })).ok, true);
  assert.equal((await change({ current: "abcd", next: MAIN.password, confirm: MAIN.password })).ok, true);
  assert.equal((await change({ current: MAIN.password, next: MAIN.password, confirm: MAIN.password }, 400)).code, "PASSWORD_SAME");
  assert.equal((await change({ current: MAIN.password, next: "Another@26", confirm: "Another@27" }, 400)).code, "PASSWORD_MISMATCH");
  const other = client();
  await other("login", { mobile: MAIN.mobile, secret: MAIN.password });
  const ok = await change({ current: MAIN.password, next: "Another@26", confirm: "Another@26" });
  assert.equal(ok.ok, true);
  assert.equal(ok.role, "admin", "this phone stays logged in");
  assert.equal((await other("state")).account, null, "other phones must log in again");
  assert.equal((await client()("login", { mobile: MAIN.mobile, secret: MAIN.password }, 401)).code, "WRONG_PASSWORD");
  await client()("login", { mobile: MAIN.mobile, secret: "Another@26" });
  // A second start never re-seeds or overwrites the changed password.
  const { seedMainAdmin } = await import("../server/auth.mjs");
  assert.equal(seedMainAdmin(store, MAIN), false);
  // Server-only recovery (scripts/reset-main-admin.js uses this).
  const { resetMainAdminPassword } = await import("../server/auth.mjs");
  resetMainAdminPassword(store, "Recovered@26");
  assert.equal((await admin("state")).account, null, "reset logs every device out");
  await client()("login", { mobile: MAIN.mobile, secret: "Recovered@26" });
  // There is no password reset inside the app.
  for (const path of ["admin/recover", "admin/recovery/regenerate", "admin/gate", "admin/login"])
    await client()(path, {}, 404);
});
test("Section 2: the app refuses to start without Main Admin settings", () => {
  assert.throws(
    () => createApp({ dbPath: ":memory:", requireAppLock: false }),
    /MAIN_ADMIN_NAME/,
  );
  assert.throws(
    () => createApp({ dbPath: ":memory:", mainAdmin: { ...MAIN, password: "abc" } }),
    /4\+ characters/,
  );
});
test("5 wrong PINs or passwords lock the account for 5 minutes and show the time left", async (t) => {
  const { client } = await setup(t),
    a = client();
  for (let i = 0; i < 4; i++) await a("login", { mobile: MAIN.mobile, secret: "wrong" + i + "xx" }, 401);
  const locked = await a("login", { mobile: MAIN.mobile, secret: "wrong5xxx" }, 429);
  assert.equal(locked.code, "LOCKED_OUT");
  assert.ok(locked.until > Date.now() + 4.9 * 60000 && locked.until <= Date.now() + 5 * 60000);
  // Even the right password waits until the lockout ends.
  assert.equal((await a("login", { mobile: MAIN.mobile, secret: MAIN.password }, 429)).code, "LOCKED_OUT");
});
