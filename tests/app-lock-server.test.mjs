// Server-enforced app lock and system notifications.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

const G = "થોરાળા";
const form = (phone) => ({
  firstName: "Lock",
  middleName: "Test",
  surname: "Member",
  phone,
  village: "Thorala",
  consent: true,
});
async function approved(f, phone = "9000000011") {
  await f.ensureAdmin("Thorala");
  // A signed-in village administrator sees the directory, so their device
  // needs its own PIN before it can act.
  if (f.requireAppLock !== false) await f.va(G)("lock/setup", { pin: "3690" });
  const m = f.client();
  const r = await m("enrollment", form(phone));
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  return m;
}

test("approved members must set a PIN before any directory record is sent", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const m = await approved(f);
  let s = await m("state");
  assert.equal(s.role, "member");
  assert.equal(s.lockSetup, true);
  assert.deepEqual(s.members, []);
  await m("profile/delete", {}, 423);
  await m("lock/setup", { pin: "1234" }, 400); // too easy to guess
  await m("lock/setup", { pin: "2580" });
  s = await m("state");
  assert.equal(s.locked, false);
  assert.ok(s.members.length >= 1);
});

test("an engaged lock hides the directory until the right PIN; wrong PINs wait longer", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const m = await approved(f);
  await m("lock/setup", { pin: "2580" });
  await m("lock/engage", {});
  let s = await m("state");
  assert.equal(s.locked, true);
  assert.deepEqual(s.members, []);
  for (let i = 0; i < 5; i++) await m("lock/unlock", { pin: "1111" }, 401);
  // Now a wait applies even to the correct PIN; a reload cannot reset it.
  await m("lock/unlock", { pin: "2580" }, 429);
  s = await m("state");
  assert.ok(s.lockWaitUntil > Date.now());
  const session = f.store.all("sessions").find((x) => x.lock?.fails >= 5);
  session.lock.until = 0;
  f.store.put("sessions", session);
  await m("lock/unlock", { pin: "2580" });
  assert.ok((await m("state")).members.length >= 1);
});

test("forgotten PIN: the village administrator issues a one-time reset code", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const m = await approved(f);
  await m("lock/setup", { pin: "2580" });
  await m("lock/engage", {});
  const target = f.store.all("members").find((x) => x.phone === "9000000011");
  await f.va(G)("village/members/" + target.id + "/pin-reset", {}, 400);
  const { code } = await f.va(G)("village/members/" + target.id + "/pin-reset", {
    identityConfirmed: true,
  });
  assert.match(code, /^\d{6}$/);
  // Another device cannot use the code.
  await f.client()("lock/reset", { code }, 403);
  await m("lock/reset", { code: "000000" }, 401);
  await m("lock/reset", { code });
  const s = await m("state");
  assert.equal(s.lockSetup, true);
  await m("lock/setup", { pin: "1470" });
  assert.ok((await m("state")).members.length >= 1);
  // The code is single-use.
  await m("lock/reset", { code }, 401);
});

test("notifications reach the right people and never include phone numbers", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const applicant = f.client();
  const { token: applicantToken } = await applicant("notifications/device", { lang: "en" });
  const { token: vaToken } = await f.va(G)("notifications/device", { lang: "gu" });
  const { token: mainToken } = await f.admin("notifications/device", { lang: "en" });
  const pull = async (token) => {
    const r = await fetch(f.url + "/api/notifications/pull", {
      headers: { "X-MVPMI-Device": token },
    });
    assert.equal(r.status, 200);
    return (await r.json()).items;
  };
  const r = await applicant("enrollment", form("9000000021"));
  let items = await pull(vaToken);
  assert.equal(items.length, 1);
  assert.match(items[0].title, /નોંધણી/);
  assert.equal((await pull(vaToken)).length, 0); // delivered once
  assert.equal((await pull(mainToken)).length, 0);
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  items = await pull(mainToken);
  assert.equal(items[0].title, "Village verified · final approval needed");
  assert.equal((await pull(applicantToken))[0].kind, "stage");
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  items = await pull(applicantToken);
  assert.equal(items[0].kind, "approved");
  assert.equal((await pull(vaToken))[0].kind, "member-added");
  for (const n of f.store.all("notifications"))
    assert.doesNotMatch(JSON.stringify(n), /9000000021/);
  // Unknown device tokens get nothing.
  const bad = await fetch(f.url + "/api/notifications/pull", {
    headers: { "X-MVPMI-Device": "0".repeat(64) },
  });
  assert.equal(bad.status, 401);
});

test("administrator notifications stop after the password changes; web push subscriptions are validated", async (t) => {
  const f = await fixture(t);
  const { token } = await f.admin("notifications/device", {});
  f.store.put("config", { ...f.store.get("config", "admin"), changedAt: Date.now() + 1 });
  await f.ensureAdmin("Thorala");
  await f.client()("enrollment", form("9000000031"));
  const r = await fetch(f.url + "/api/notifications/pull", { headers: { "X-MVPMI-Device": token } });
  const items = (await r.json()).items;
  assert.equal(items.length, 0);
  const key = await f.client()("push/key");
  assert.ok(key.publicKey.length > 60);
  await f.client()("push/subscribe", { subscription: { endpoint: "http://insecure" } }, 400);
  await f.client()("push/subscribe", {
    subscription: { endpoint: "https://push.example.org/abc", keys: { p256dh: "x", auth: "y" } },
  });
});
