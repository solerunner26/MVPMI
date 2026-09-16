import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";

async function fixture(t) {
  const { app, store } = createApp({
    dbPath: ":memory:",
    adminPassword: "RecoveryTest@2026",
    gateCode: "5831",
    development: true,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => {
    server.close();
    store.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const client = () => {
    let cookie = "";
    return async (path, body, status = 200, extra = {}) => {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: cookie,
          "X-MVPMI-Client": "1",
          "Content-Type": "application/json",
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      const data = await response.json();
      if (Array.isArray(status))
        assert.ok(status.includes(response.status), JSON.stringify(data));
      else assert.equal(response.status, status, JSON.stringify(data));
      return data;
    };
  };
  const admin = client(),
    old = client(),
    fresh = client();
  await admin("admin/gate", { code: "5831" });
  await admin("admin/login", { user: "admin", pass: "RecoveryTest@2026" });
  await old("enrollment", {
    name: "Recovery Member",
    phone: "9000000001",
    village: "Thorala",
    consent: true,
  });
  const request = (await admin("state")).newRequests[0];
  await admin(`admin/requests/${request.id}/approve`, {});
  const member = store.all("members")[0];
  const issue = () =>
    admin(`admin/members/${member.id}/recovery`, { identityVerified: true });
  const redeem = (code, phone = member.phone) => ({ code, phone });
  return { store, client, admin, old, fresh, member, issue, redeem };
}

test("only admin can issue and must attest identity verification; code is hash-only and absent from public state/backup", async (t) => {
  const f = await fixture(t);
  await f.fresh(
    `admin/members/${f.member.id}/recovery`,
    { identityVerified: true },
    403,
  );
  await f.old(
    `admin/members/${f.member.id}/recovery`,
    { identityVerified: true },
    403,
  );
  await f.admin(`admin/members/${f.member.id}/recovery`, {}, 400);
  const grant = await f.issue();
  assert.match(grant.code, /^[a-f0-9]{32}$/);
  assert(grant.expiresAt > Date.now());
  assert(!JSON.stringify(f.store.all("recoveries")).includes(grant.code));
  assert(!JSON.stringify(f.store.all("audit")).includes(grant.code));
  assert(!JSON.stringify(await f.admin("admin/backup")).includes(grant.code));
  assert(!JSON.stringify(await f.fresh("state")).includes("digest"));
});

test("redemption rotates sessions and transport, revokes old devices, preserves member and pending requests, never grants admin", async (t) => {
  const f = await fixture(t);
  const oldTransport = await f.old("session/transport", {});
  const guestTransport = await f.fresh("session/transport", {});
  await f.old("profile/update", {
    name: "Pending Name",
    phone: f.member.phone,
    phone2: "",
    village: "Thorala",
  });
  const oldSession = f.store
    .all("sessions")
    .find((s) => s.owner === f.member.owner);
  f.store.put("sessions", {
    ...oldSession,
    adminUntil: Date.now() + 60000,
    gateUntil: Date.now() + 60000,
  });
  const grant = await f.issue();
  const state = await f.fresh("member/recover", f.redeem(grant.code));
  assert.equal(state.role, "member");
  assert.equal(state.meId, f.member.id);
  assert.equal(state.updateRequests.length, 1);
  assert.notEqual(state.recoveryTransport.token, guestTransport.token);
  assert.equal((await f.old("state")).role, "guest");
  await f.fresh("state", undefined, 401, {
    "X-MVPMI-Session": oldTransport.token,
  });
  await f.fresh("state", undefined, 401, {
    "X-MVPMI-Session": guestTransport.token,
  });
  assert.equal(
    (
      await f.fresh("state", undefined, 200, {
        "X-MVPMI-Session": state.recoveryTransport.token,
      })
    ).role,
    "member",
  );
  await f.fresh("admin/backup", undefined, 403);
  assert.equal(f.store.get("sessions", oldSession.id), null);
  assert.equal(f.store.all("recoveries").length, 0);
  await f.client()("member/recover", f.redeem(grant.code), 400);
});

test("code is bound to personal number; unknown members and incorrect codes have identical errors", async (t) => {
  const f = await fixture(t),
    grant = await f.issue();
  const a = await f.fresh(
    "member/recover",
    f.redeem(grant.code, "8000000002"),
    400,
  );
  const b = await f.fresh("member/recover", f.redeem("a".repeat(32)), 400);
  assert.deepEqual(a, b);
  assert.equal(
    (
      await f.fresh(
        "member/recover",
        f.redeem(grant.code.toUpperCase().match(/.{4}/g).join(" ")),
      )
    ).role,
    "member",
  );
});

test("reissuing invalidates the previous code", async (t) => {
  const f = await fixture(t),
    first = await f.issue(),
    second = await f.issue();
  await f.fresh("member/recover", f.redeem(first.code), 400);
  assert.equal(
    (await f.fresh("member/recover", f.redeem(second.code))).role,
    "member",
  );
});

test("expired grants are removed and cannot be redeemed", async (t) => {
  const f = await fixture(t),
    grant = await f.issue();
  const row = f.store.get("recoveries", f.member.id);
  f.store.put("recoveries", { ...row, expiresAt: Date.now() - 1 });
  await f.fresh("member/recover", f.redeem(grant.code), 400);
  assert.equal(f.store.all("recoveries").length, 0);
});

test("five incorrect attempts lock a code; session rate limit applies too", async (t) => {
  const f = await fixture(t),
    grant = await f.issue();
  for (let i = 0; i < 5; i++)
    await f.fresh("member/recover", f.redeem("b".repeat(32)), 400);
  await f.fresh("member/recover", f.redeem(grant.code), 429);
  await f.client()("member/recover", f.redeem(grant.code), 400);
});

test("existing identities cannot be overwritten by recovery", async (t) => {
  const f = await fixture(t),
    grant = await f.issue();
  await f.old("member/recover", f.redeem(grant.code), 409);
  await f.admin("member/recover", f.redeem(grant.code), 409);
  await f.fresh("enrollment", {
    name: "Another Member",
    phone: "8000000002",
    village: "Thorala",
    consent: true,
  });
  await f.fresh("member/recover", f.redeem(grant.code), 409);
  assert.equal(f.store.all("recoveries").length, 1);
});

test("removal and directory restore invalidate outstanding recovery grants", async (t) => {
  const f = await fixture(t),
    grant = await f.issue();
  const backup = await f.admin("admin/backup");
  f.store.restore(backup, "test-admin");
  assert.equal(f.store.all("recoveries").length, 0);
  await f.fresh("member/recover", f.redeem(grant.code), 400);
  const other = await f.issue();
  f.store.remove(f.member, "Removed for test");
  assert.equal(f.store.all("recoveries").length, 0);
  await f.fresh("member/recover", f.redeem(other.code), 400);
});

test("concurrent redemption has exactly one winner", async (t) => {
  const f = await fixture(t),
    grant = await f.issue();
  const results = await Promise.all(
    [f.client(), f.client()].map((client) =>
      client("member/recover", f.redeem(grant.code), [200, 400]),
    ),
  );
  assert.equal(results.filter((result) => result.role === "member").length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  assert.equal(f.store.all("recoveries").length, 0);
});
