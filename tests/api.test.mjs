import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
const form = {
  name: "Test Member",
  phone: "9000000001",
  phone2: "",
  village: "Thorala",
  consent: true,
};
async function setup(t, opts = {}) {
  const { app, store } = createApp({
    dbPath: ":memory:",
    adminPassword: "Testing@2026!",
    gateCode: "5831",
    development: true,
    ...opts,
  });
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
      assert.equal(r.status, expected, await r.clone().text());
      return r.headers.get("content-type")?.includes("json")
        ? r.json()
        : r.arrayBuffer();
    };
  };
  const admin = client();
  await admin("admin/gate", { code: "5831" });
  await admin("admin/login", { user: "admin", pass: "Testing@2026!" });
  return { store, client, admin, base };
}
test("approval gate, ownership, request replacement, withdrawal and admin-only archive", async (t) => {
  const { client, admin } = await setup(t);
  const a = client(),
    b = client();
  assert.deepEqual((await a("state")).members, []);
  await a("admin/backup", undefined, 403);
  await a("profile/delete", {}, 403);
  await a("enrollment", form);
  await a("enrollment", { ...form, name: "Edited Name" });
  const state = await admin("state");
  assert.equal(state.newRequests.length, 1);
  assert.equal(state.archive.length, 1);
  await b("enrollment", form, 409);
  assert.equal((await b("state")).myRequest, null);
  assert.equal((await a("state")).archive.length, 0);
  await a("enrollment/withdraw", {});
  assert.equal((await admin("state")).archive.length, 2);
  assert.equal((await a("state")).role, "guest");
});
test("approve, search data, update stays private, direct admin edit, delete revokes access", async (t) => {
  const { client, admin } = await setup(t),
    a = client();
  await a("enrollment", form);
  let s = await admin("state");
  await admin("admin/requests/" + s.newRequests[0].id + "/approve", {});
  s = await a("state");
  assert.equal(s.role, "member");
  assert.equal(s.members.length, 1);
  assert.equal(s.members[0].owner, undefined);
  await a("profile/update", { ...form, name: "New Name", phone: "9000000002" });
  assert.equal((await a("state")).members[0].phone, form.phone);
  s = await admin("state");
  const update = s.updateRequests[0].id;
  await admin("admin/requests/" + update + "/approve", {});
  assert.equal((await a("state")).members[0].nameGu, "New Name");
  await admin("admin/requests/" + update + "/approve", {}, 409);
  const id = (await a("state")).meId;
  await admin("admin/members/" + id, { ...form, name: "Direct Admin Edit" });
  assert.equal((await a("state")).members[0].name, "Direct Admin Edit");
  await a("profile/delete", {});
  await a("profile/delete", {});
  s = await admin("state");
  assert.equal(s.deleteRequests.length, 1);
  await admin("admin/requests/" + s.deleteRequests[0].id + "/approve", {});
  assert.equal((await a("state")).role, "guest");
  assert.deepEqual((await a("state")).members, []);
  await a("profile/update", form, 403);
});
test("backup validation is atomic, roundtrip restores links, export is a genuine XLSX", async (t) => {
  const { client, admin } = await setup(t),
    a = client();
  await a("enrollment", form);
  let s = await admin("state");
  await admin("admin/requests/" + s.newRequests[0].id + "/approve", {});
  const backup = await admin("admin/backup");
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.sessions, undefined);
  await admin(
    "admin/restore/validate",
    { ...backup, members: [...backup.members, ...backup.members] },
    400,
  );
  assert.equal((await a("state")).members.length, 1);
  await admin("admin/members/" + backup.members[0].id + "/delete", {});
  const diff = await admin("admin/restore/validate", backup);
  await admin("admin/restore", {
    backup,
    digest: diff.digest,
    currentDigest: diff.currentDigest,
  });
  assert.equal((await a("state")).role, "member");
  const xlsx = Buffer.from(await admin("admin/export.xlsx"));
  assert.equal(xlsx.subarray(0, 2).toString(), "PK");
});
test("server rejects invalid fields, ignores injected approval, rejects stale updates", async (t) => {
  const { client, admin } = await setup(t),
    a = client();
  await a("enrollment", { ...form, phone2: "1234567890" }, 400);
  await a("enrollment", { ...form, village: "Unknown" }, 400);
  await a("enrollment", { ...form, consent: false }, 400);
  await a("enrollment", { ...form, role: "admin", status: "approved" });
  assert.equal((await a("state")).role, "pending");
  let s = await admin("state");
  await admin("admin/requests/" + s.newRequests[0].id + "/approve", {});
  await a("profile/update", { ...form, name: "Requested Name" });
  s = await admin("state");
  await admin("admin/members/" + s.members[0].id, {
    ...form,
    name: "Concurrent Admin Edit",
  });
  await admin("admin/requests/" + s.updateRequests[0].id + "/approve", {}, 409);
});
test("authentication, failed attempt auditing, device blocking and logout", async (t) => {
  const { client, admin } = await setup(t),
    a = client();
  await a("admin/login", { user: "admin", pass: "Testing@2026!" }, 403);
  await a("admin/gate", { code: "0000" }, 401);
  let s = await admin("state");
  assert.equal(s.alerts.length, 1);
  await admin("admin/alerts/" + s.alerts[0].id + "/block", {});
  await a("state", undefined, 403);
  await admin("admin/logout", {});
  await admin("admin/backup", undefined, 403);
});
test("password reset uses delivered OTP, enforces strength, revokes admin sessions", async (t) => {
  let code;
  const { client, admin } = await setup(t, {
    sms: async (p, c) => {
      code = c;
    },
    adminPhone: "+919000000000",
  });
  const a = client();
  await a("admin/gate", { code: "5831" });
  await a("admin/reset/send", {});
  await a("admin/reset", { otp: "000000", password: "NewSecret@2026" }, 400);
  await a("admin/reset", { otp: code, password: "weak" }, 400);
  await a("admin/reset", { otp: code, password: "NewSecret@2026" });
  await admin("admin/backup", undefined, 403);
  await a("admin/gate", { code: "5831" });
  await a("admin/login", { user: "admin", pass: "NewSecret@2026" });
});
test("gate attempts are rate limited", async (t) => {
  const { client } = await setup(t),
    a = client();
  for (let i = 0; i < 5; i++) await a("admin/gate", { code: "0000" }, 401);
  await a("admin/gate", { code: "5831" }, 429);
});
