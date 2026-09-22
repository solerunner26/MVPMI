import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { fixture, example } from "./helpers.mjs";
import {
  hash,
  passwordHash,
  passwordMatches,
  profile,
} from "../server/store.mjs";

const protectedRoutes = [
  ["admin/backup"],
  ["admin/export.xlsx"],
  ["admin/restore/validate", {}],
  ["admin/restore", {}],
  ["admin/members/unknown", {}],
  ["admin/members/unknown/delete", {}],
  ["admin/alerts/unknown/block", {}],
  ["admin/requests/unknown/approve", {}],
  ["admin/requests/unknown/reject", {}],
  ["village/requests/unknown/forward", { reason: "Attempted action" }],
  ["village/members/unknown/update", { reason: "Attempted action" }],
  ["village/members/unknown/delete", { reason: "Attempted action" }],
  ["village/password", { current: "Attempt@2026!", next: "Attempt@2026!" }],
  ["admin/recovery/regenerate", {}],
];
for (const role of ["guest", "pending", "member"])
  test(`${role}: every admin data/mutation endpoint requires admin authorization`, async (t) => {
    const { client, enroll, ensureAdmin } = await fixture(t),
      u = client();
    if (role === "pending") {
      await ensureAdmin("Thorala");
      await u("enrollment", example);
    }
    if (role === "member") await enroll(u);
    for (const [path, body] of protectedRoutes) await u(path, body, 403);
  });

for (const [label, body] of [
  ["null", null],
  ["array", []],
  ["string", "bad"],
  ["number", 7],
])
  test(`malformed ${label} JSON cannot crash domain handlers`, async (t) => {
    const { url } = await fixture(t);
    for (const path of [
      "enrollment",
      "admin/login",
      "admin/recover",
      "admin/recovery/regenerate",
      "admin/restore",
    ]) {
      const r = await fetch(url + "/api/" + path, {
        method: "POST",
        headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 400);
      assert.equal((await r.json()).error.includes("TypeError"), false);
    }
  });

test("CSRF/origin/content-type protection handles malformed origins without throwing", async (t) => {
  const { url } = await fixture(t);
  for (const origin of ["https://attacker.invalid", "null", ":bad-url"]) {
    const r = await fetch(url + "/api/session/transport", {
      method: "POST",
      headers: {
        Origin: origin,
        "X-MVPMI-Client": "1",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(r.status, 403);
  }
  assert.equal(
    (
      await fetch(url + "/api/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(url + "/api/enrollment", {
        method: "POST",
        headers: { "X-MVPMI-Client": "1", "Content-Type": "text/plain" },
        body: "{}",
      })
    ).status,
    415,
  );
  const r = await fetch(url + "/api/enrollment", {
    method: "POST",
    headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json" },
    body: '{"phone":"sensitive malformed payload"',
  });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "Invalid JSON" });
});

test("state and update snapshots expose only public profile fields, even for restored extra metadata", async (t) => {
  const { client, enroll, store, admin } = await fixture(t),
    u = client(),
    other = client();
  const m = await enroll(u);
  const record = store.get("members", m.id);
  record.privateAuditMarker = "never-expose";
  store.put("members", record);
  await u("profile/update", { ...example, name: "Updated Name" });
  const s = await u("state");
  assert.equal(s.members[0].owner, undefined);
  assert.equal(s.members[0].privateAuditMarker, undefined);
  assert.equal(s.updateRequests[0].old.owner, undefined);
  assert.equal(s.updateRequests[0].old.privateAuditMarker, undefined);
  assert.equal((await other("state")).updateRequests.length, 0);
  assert.equal((await other("state")).members.length, 0);
  assert.equal((await admin("state")).members[0].privateAuditMarker, undefined);
});

test("approval carries consent evidence and rejects double approval", async (t) => {
  const { client, admin, store, ensureAdmin, va } = await fixture(t),
    u = client();
  await ensureAdmin("Thorala");
  await u("enrollment", example);
  const r = (await admin("state")).newRequests[0];
  await va("થોરાળા")("village/requests/" + r.id + "/forward", {
    reason: "Verified community member",
    identityConfirmed: true,
  });
  await admin("admin/requests/" + r.id + "/approve", {});
  const m = store.all("members").find((x) => x.phone === example.phone);
  assert.equal(m.consentVersion, "development-disclosure-v1");
  assert.ok(m.consentAt);
  assert.ok(m.createdAt);
  assert.ok(m.approvedBy);
  await admin("admin/requests/" + r.id + "/approve", {}, 409);
  assert.equal(
    store.all("members").filter((x) => x.phone === example.phone).length,
    1,
  );
});

test("reject enrollment/update/deletion paths preserve the correct directory state", async (t) => {
  const { client, admin, enroll, ensureAdmin } = await fixture(t),
    u = client();
  await ensureAdmin("Thorala");
  await u("enrollment", example);
  let s = await admin("state");
  await admin("admin/requests/" + s.newRequests[0].id + "/reject", {
    reason: "Insufficient community verification",
  });
  assert.equal((await u("state")).role, "guest");
  assert.equal((await admin("state")).rejectedApplications.length, 1);
  await enroll(u);
  await u("profile/update", { ...example, phone: "9000000002" });
  s = await admin("state");
  await admin("admin/requests/" + s.updateRequests[0].id + "/reject", {});
  assert.equal(
    (await u("state")).members.find((m) => m.phone === example.phone).phone,
    example.phone,
  );
  await u("profile/delete", {});
  s = await admin("state");
  await admin("admin/requests/" + s.deleteRequests[0].id + "/reject", {});
  assert.equal((await u("state")).role, "member");
  assert.equal((await u("state")).deleteRequests.length, 0);
});

test("admin removal cleans update/delete requests and revokes member reads", async (t) => {
  const { client, admin, enroll, store } = await fixture(t),
    u = client();
  const m = await enroll(u);
  await u("profile/update", { ...example, name: "New Name" });
  await u("profile/delete", {});
  await admin("admin/members/" + m.id + "/delete", {});
  assert.equal(store.all("requests").length, 0);
  assert.deepEqual((await u("state")).members, []);
  await u("profile/update", example, 403);
});

test("expiry, logout and device blocking are enforced by the server", async (t) => {
  const { client, admin, store } = await fixture(t);
  const active = store.all("sessions").find((s) => s.adminUntil > Date.now());
  active.adminUntil = Date.now() - 1;
  store.put("sessions", active);
  await admin("admin/backup", undefined, 403);
  const u = client();
  await u("admin/gate", { code: "5831" });
  const gate = store
    .all("sessions")
    .find((s) => s.id !== active.id && s.gateUntil);
  gate.gateUntil = Date.now() - 1;
  store.put("sessions", gate);
  await u("admin/login", { user: "admin", pass: "Testing@2026!" }, 403);
  gate.blocked = true;
  store.put("sessions", gate);
  await u("state", undefined, 403);
  await u("admin/gate", { code: "5831" }, 403);
});

test("recovery attempts require the gate, are rate limited and lock reset for 15 minutes after five wrong codes", async (t) => {
  const { client, admin, store } = await fixture(t),
    u = client();
  const code = (await admin("admin/recovery/regenerate", {})).recovery;
  // Without the access gate the endpoint is closed.
  await u("admin/recover", { recovery: code, password: "NextPass@2026" }, 403);
  await u("admin/gate", { code: "5831" });
  for (let i = 0; i < 4; i++)
    await u("admin/recover", { recovery: "BAD" + i, password: "NextPass@2026" }, 401);
  await u("admin/recover", { recovery: "BAD4", password: "NextPass@2026" }, 429);
  assert.ok(store.get("config", "reset-lock").until > Date.now() + 14 * 60000);
  // Every wrong code raises a security alert like other failed credentials.
  assert.equal(
    store.all("alerts").filter((x) => /recovery/i.test(x.title)).length,
    5,
  );
  // The lock also stops a correct code, even from a brand-new session.
  await u("admin/recover", { recovery: code, password: "NextPass@2026" }, 429);
  const v = client();
  await v("admin/gate", { code: "5831" });
  await v("admin/recover", { recovery: code, password: "NextPass@2026" }, 429);
});

test("recovery codes never appear in stored records, responses other than issuance, or error text", async (t) => {
  const { admin, client, store } = await fixture(t);
  const code = (await admin("admin/recovery/regenerate", {})).recovery;
  const u = client();
  await u("admin/gate", { code: "5831" });
  const r = await u("admin/recover", { recovery: code, password: "wrong" }, 400);
  assert.equal(JSON.stringify(r).includes(code), false);
  for (const row of store.all("sessions"))
    assert.equal(JSON.stringify(row).includes(code), false);
  const record = store.get("config", "admin");
  assert.equal(JSON.stringify(record).includes(code), false);
  assert.ok(passwordMatches(code, record.recoveryHash));
});

test("changing password from the login page invalidates every other admin session and gate", async (t) => {
  const { admin, client, store } = await fixture(t),
    other = client();
  await other("admin/gate", { code: "5831" });
  await other("admin/login", { user: "admin", pass: "Testing@2026!" });
  const code = (await admin("admin/recovery/regenerate", {})).recovery;
  await admin("admin/recover", { recovery: code, password: "ChangedPass@2026" });
  const sessions = store.all("sessions");
  const keeper = sessions.find((s) => s.adminUntil === undefined && s.gateUntil > Date.now());
  // Only the resetting device keeps its gate so the new password can be
  // used immediately; every other session is fully revoked.
  assert.equal(sessions.filter((s) => s.adminUntil !== undefined).length, 0);
  assert.ok(keeper);
  await other("admin/backup", undefined, 403);
  await other("admin/login", { user: "admin", pass: "ChangedPass@2026" }, 403);
  await admin("admin/login", { user: "admin", pass: "ChangedPass@2026" });
});

test("cookie-independent transport retains identity without granting admin or accepting invalid tokens", async (t) => {
  const { url, store } = await fixture(t);
  let token;
  const call = async (path, body, status = 200, override) => {
    const headers = {
      "Content-Type": "application/json",
      "X-MVPMI-Client": "1",
    };
    if (override || token) headers["X-MVPMI-Session"] = override || token;
    const r = await fetch(url + "/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(r.status, status);
    return r.json();
  };
  const start = await call("session/transport", {});
  token = start.token;
  assert.equal(start.enabled, true);
  await call("admin/backup", undefined, 403);
  await call("admin/login", { user: "admin", pass: "Testing@2026!" }, 403);
  await call("admin/gate", { code: "5831" });
  await call("admin/login", { user: "admin", pass: "Testing@2026!" });
  assert.equal((await call("state")).role, "admin");
  await call("state", undefined, 401, "0".repeat(64));
  const b = await call("admin/backup");
  assert.equal(b.sessions, undefined);
  assert.equal(b.transports, undefined);
  assert.equal(JSON.stringify(b).includes(token), false);
  await call("admin/logout", {});
  await call("admin/backup", undefined, 403);
  const transport = store.get("transports", hash(token));
  transport.expiresAt = Date.now() - 1;
  store.put("transports", transport);
  await call("state", undefined, 401);
});

test("preview transport is unavailable outside development", async (t) => {
  const { admin, url } = await fixture(t, { development: false });
  assert.deepEqual(await admin("session/transport", {}), { enabled: false });
  const r = await fetch(url + "/api/state", {
    headers: { "X-MVPMI-Session": "0".repeat(64) },
  });
  assert.equal(r.status, 401);
});

test("XLSX contains literal text, not executable spreadsheet formulas", async (t) => {
  const { client, enroll, admin } = await fixture(t),
    u = client();
  await enroll(u, {
    ...example,
    name: '=HYPERLINK("https://example.invalid")',
  });
  const bytes = await admin("admin/export.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  let found = false;
  workbook.worksheets[0].eachRow((row) => {
    const cell = row.getCell(2);
    if (
      cell.type === ExcelJS.ValueType.String &&
      cell.value === '=HYPERLINK("https://example.invalid")'
    )
      found = true;
  });
  assert.ok(found, "Literal formula-looking name is exported as text");
});

test("response cache policy and HttpOnly session flags", async (t) => {
  const { url } = await fixture(t, { secure: true });
  const r = await fetch(url + "/api/state");
  assert.equal(r.headers.get("cache-control"), "no-store");
  const c = r.headers.get("set-cookie");
  for (const flag of ["HttpOnly", "Secure", "SameSite=None", "Partitioned"])
    assert.ok(c.includes(flag));
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("password and field validation rejects corrupt or misleading data", () => {
  const h = passwordHash("TestPass@2026");
  assert.equal(passwordMatches("TestPass@2026", h), true);
  assert.equal(passwordMatches("wrong", h), false);
  assert.equal(passwordMatches("x", "malformed"), false);
  assert.equal(passwordMatches("x".repeat(10000), h), false);
  for (const patch of [
    { nameGu: " " },
    { nameGu: {} },
    { name: [] },
    { name: "ab" },
    { name: "a\u0000b" },
    { phone: {} },
    { phone: "abc9000000001" },
    { label2: "invalid" },
  ])
    assert.throws(
      () => profile({ ...example, ...patch }),
      (e) => e.status === 400,
    );
});

test("oversized JSON requests fail with 413 without exposing payloads", async (t) => {
  const { url } = await fixture(t);
  const r = await fetch(url + "/api/enrollment", {
    method: "POST",
    headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "X".repeat(10 * 1024 * 1024 + 1) }),
  });
  assert.equal(r.status, 413);
  assert.deepEqual(await r.json(), { error: "Request exceeds 10 MB" });
});

test("simultaneous approval is consumed once and leaves one approved member", async (t) => {
  const { url, client, admin, store, enroll, va } = await fixture(t),
    u = client();
  await enroll(client(), {
    ...example,
    name: "Verifier Fixture",
    phone: "7999999991",
  });
  await u("enrollment", example);
  const id = (await admin("state")).newRequests[0].id;
  await va("થોરાળા")("village/requests/" + id + "/forward", {
    reason: "Verified in person",
    identityConfirmed: true,
  });
  const post = async (path, body, token) => {
    const r = await fetch(url + "/api/" + path, {
      method: "POST",
      headers: {
        "X-MVPMI-Client": "1",
        "X-MVPMI-Session": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return r.status;
  };
  const transport = await fetch(url + "/api/session/transport", {
    method: "POST",
    headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.json());
  await post("admin/gate", { code: "5831" }, transport.token);
  await post(
    "admin/login",
    { user: "admin", pass: "Testing@2026!" },
    transport.token,
  );
  const statuses = await Promise.all([
    post("admin/requests/" + id + "/approve", {}, transport.token),
    post("admin/requests/" + id + "/approve", {}, transport.token),
  ]);
  assert.deepEqual(statuses.sort(), [200, 409]);
  assert.equal(
    store.all("members").filter((m) => m.phone === example.phone).length,
    1,
  );
  // Village administrator, verifier fixture and the approved applicant.
  assert.equal(store.all("members").length, 3);
});
