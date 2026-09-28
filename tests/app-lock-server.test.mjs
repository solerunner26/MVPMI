// Section 5: login PIN, TEMP PIN, server-enforced app lock and notifications.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, MAIN, VA_PIN, MEMBER_PIN } from "./helpers.mjs";

const G = "થોરાળા";
const form = (phone) => ({
  firstName: "Lock",
  middleName: "Test",
  surname: "Member",
  phone,
  village: "Thorala",
  consent: true,
});
// Registers, forwards and approves; returns the member's client (logged in
// with their own PIN) and the TEMP PIN the approving admin saw.
async function approved(f, phone = "9000000011", { login = true } = {}) {
  await f.ensureAdmin("Thorala");
  const m = f.client();
  const r = await m("enrollment", form(phone));
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  const done = await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  if (login) await f.firstLogin(m, phone, done.issuedPin.pin, MEMBER_PIN);
  return { m, issued: done.issuedPin };
}
const sessionOf = (f, phone) => {
  const member = f.store.all("members").find((y) => y.phone === phone);
  return f.store.all("sessions").find((x) => x.auth?.memberId === member.id);
};

test("approval shows a TEMP PIN once; the first login must set a new PIN before anything else", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m, issued } = await approved(f, "9000000011", { login: false });
  assert.match(issued.pin, /^\d{4}$/);
  assert.deepEqual(
    [issued.kind, issued.phone, issued.village],
    ["member", "9000000011", G],
  );
  // The TEMP PIN is never stored in plain text and never shown again.
  assert.equal(JSON.stringify(f.store.all("members")).includes('"' + issued.pin + '"'), false);
  assert.equal(JSON.stringify(await f.admin("state")).includes('"pin":"' + issued.pin), false);
  // Before login, the registrant's phone only learns it was approved.
  let s = await m("state");
  assert.equal(s.role, "guest");
  assert.equal(s.approvedHere, true);
  assert.deepEqual(s.members, []);
  // First login with the TEMP PIN: nothing but "Set new PIN".
  s = await m("login", { mobile: "9000000011", secret: issued.pin });
  assert.equal(s.account.mustSetPin, true);
  assert.deepEqual(s.members, []);
  assert.equal((await m("profile/delete", {}, 409)).code, "SET_PIN_FIRST");
  // The TEMP PIN works for one login only.
  assert.equal((await f.client()("login", { mobile: "9000000011", secret: issued.pin }, 409)).code, "TEMP_USED");
  assert.equal((await m("pin/set", { pin: "1111", confirm: "1111" }, 400)).code, "PIN_WEAK");
  assert.equal((await m("pin/set", { pin: "12a4", confirm: "12a4" }, 400)).code, "PIN_FORMAT");
  assert.equal((await m("pin/set", { pin: "2468", confirm: "2469" }, 400)).code, "PIN_MISMATCH");
  assert.equal((await m("pin/set", { pin: issued.pin, confirm: issued.pin }, 400)).code, "PIN_SAME");
  s = await m("pin/set", { pin: "2468", confirm: "2468" });
  assert.equal(s.account.mustSetPin, false);
  assert.equal(s.account.role, "MEMBER");
  assert.ok(s.members.length >= 3);
  // Member notice: approved.
  assert.equal(s.account.notice.kind, "approved");
  // Next login uses the new PIN.
  await f.client()("login", { mobile: "9000000011", secret: "2468" });
});

test("members choose the app lock (default OFF); an engaged lock hides everything until the right PIN", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  let s = await m("state");
  assert.equal(s.account.lockOn, false, "default OFF for members");
  await m("lock/engage", {});
  assert.equal((await m("state")).locked, false, "OFF: nothing to lock");
  s = await m("lock/preference", { on: true });
  assert.equal(s.lockOn, true);
  await m("lock/engage", {});
  s = await m("state");
  assert.equal(s.locked, true);
  assert.deepEqual(s.members, []);
  assert.equal((await m("profile/delete", {}, 423)).code, "LOCKED");
  assert.equal((await m("lock/unlock", { secret: "1470" }, 401)).code, "WRONG_PIN");
  await m("lock/unlock", { secret: MEMBER_PIN });
  assert.ok((await m("state")).members.length >= 1);
  // Turning it off again.
  await m("lock/preference", { on: false });
  await m("lock/engage", {});
  assert.equal((await m("state")).locked, false);
});

test("5 wrong PINs lock the account for 5 minutes, even for the right PIN", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  await m("lock/preference", { on: true });
  await m("lock/engage", {});
  for (let i = 0; i < 4; i++) {
    const wrong = await m("lock/unlock", { secret: "1470" }, 401);
    assert.equal(wrong.left, 4 - i);
  }
  const locked = await m("lock/unlock", { secret: "1470" }, 429);
  assert.equal(locked.code, "LOCKED_OUT");
  assert.ok(locked.until - Date.now() > 4.9 * 60000);
  assert.equal((await m("lock/unlock", { secret: MEMBER_PIN }, 429)).code, "LOCKED_OUT");
  // The login uses the same counter: a new phone cannot skip the wait.
  assert.equal((await f.client()("login", { mobile: "9000000011", secret: MEMBER_PIN }, 429)).code, "LOCKED_OUT");
  const member = f.store.all("members").find((x) => x.phone === "9000000011");
  member.cred.until = Date.now() - 1;
  f.store.put("members", member);
  await m("lock/unlock", { secret: MEMBER_PIN });
});

test("admins always have the lock on; the Main Admin unlocks with the password", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  await f.ensureAdmin("Thorala");
  let s = await f.admin("state");
  assert.equal(s.account.lockOn, true);
  assert.equal(s.account.lockForced, true);
  assert.equal((await f.admin("lock/preference", { on: false }, 409)).code, "LOCK_FORCED");
  assert.equal((await f.va(G)("lock/preference", { on: false }, 409)).code, "LOCK_FORCED");
  await f.admin("lock/engage", {});
  s = await f.admin("state");
  assert.equal(s.locked, true);
  assert.deepEqual([s.members, s.newRequests, s.alerts, s.auditLog], [[], [], [], []]);
  await f.admin("admin/backup", undefined, 423);
  assert.equal((await f.admin("lock/unlock", { secret: "0000" }, 401)).code, "WRONG_PASSWORD");
  await f.admin("lock/unlock", { secret: MAIN.password });
  assert.ok((await f.admin("state")).members.length >= 2);
  // A Village Admin unlocks with their PIN.
  await f.va(G)("lock/engage", {});
  assert.equal((await f.va(G)("village/pin-requests/x/dismiss", {}, 423)).code, "LOCKED");
  await f.va(G)("lock/unlock", { secret: VA_PIN });
});

test("the lock closes after 1 minute or more in the background, not before", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  await m("lock/preference", { on: true });
  await m("lock/hidden", {});
  let s = sessionOf(f, "9000000011");
  s.lock.hiddenAt = Date.now() - 40000;
  f.store.put("sessions", s);
  await m("lock/visible", {});
  assert.equal((await m("state")).locked, false, "40 seconds away: still open");
  await m("lock/hidden", {});
  s = sessionOf(f, "9000000011");
  s.lock.hiddenAt = Date.now() - 61000;
  f.store.put("sessions", s);
  // Even if the app never comes back, the next request finds it locked.
  const later = await m("state");
  assert.equal(later.locked, true);
  assert.deepEqual(later.members, []);
});

test("fingerprint unlock uses a device key released by the phone's biometric prompt", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  const key = "ab".repeat(32);
  assert.equal((await m("lock/biometric", { key }, 409)).code, "LOCK_OFF");
  await m("lock/preference", { on: true });
  const on = await m("lock/biometric", { key });
  assert.equal(on.biometricOn, true);
  await m("lock/engage", {});
  assert.equal((await m("lock/unlock", { biometric: "cd".repeat(32) }, 401)).code, "BIOMETRIC_FAILED");
  await m("lock/unlock", { biometric: key });
  assert.equal((await m("state")).locked, false);
  // The key hash is stored, never the key.
  assert.equal(JSON.stringify(f.store.all("sessions")).includes(key), false);
});

test("Forgot PIN? asks the village admin, who creates a TEMP PIN to share on WhatsApp", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  await approved(f);
  const lost = f.client();
  // Same answer for unknown numbers (no member lookup through this form).
  assert.deepEqual(await lost("pin/forgot", { mobile: "9888888888" }), { ok: true });
  assert.deepEqual(await lost("pin/forgot", { mobile: "9000000011" }), { ok: true });
  assert.equal((await lost("pin/forgot", { mobile: "123" }, 400)).code, "MOBILE_FORMAT");
  // Nothing was reset by the request itself.
  await f.client()("login", { mobile: "9000000011", secret: MEMBER_PIN });
  let s = await f.va(G)("state");
  assert.equal(s.pinResetRequests.length, 1);
  assert.equal(s.pinResetRequests[0].phone, "9000000011");
  assert.equal((await f.admin("state")).pinResetRequests.length, 1, "the Main Admin sees every village");
  const target = s.pinResetRequests[0].memberId;
  const reset = await f.va(G)("village/members/" + target + "/pin-reset", {});
  assert.equal(reset.issuedPin.kind, "reset");
  assert.match(reset.issuedPin.pin, /^\d{4}$/);
  assert.equal(reset.pinResetRequests.length, 0);
  // The old PIN stops working; every phone of that member is logged out.
  assert.equal((await f.client()("login", { mobile: "9000000011", secret: MEMBER_PIN }, 401)).code, "WRONG_PIN");
  const again = f.client();
  const st = await again("login", { mobile: "9000000011", secret: reset.issuedPin.pin });
  assert.equal(st.account.mustSetPin, true);
  await again("pin/set", { pin: "8024", confirm: "8024" });
  // A Village Admin cannot reset their own PIN; the Main Admin does.
  const vaId = f.store.get("villageAdmins", G).memberId;
  await f.va(G)("village/members/" + vaId + "/pin-reset", {}, 409);
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

test("admin notifications stop on a phone whose login ended (password changed elsewhere)", async (t) => {
  const f = await fixture(t);
  const { token } = await f.admin("notifications/device", {});
  const other = f.client();
  await other("login", { mobile: MAIN.mobile, secret: MAIN.password });
  await other("password/change", { current: MAIN.password, next: "Changed@2026", confirm: "Changed@2026" });
  await f.ensureAdmin("Thorala").catch(() => {});
  await f.client()("enrollment", form("9000000031")).catch(() => {});
  const r = await fetch(f.url + "/api/notifications/pull", { headers: { "X-MVPMI-Device": token } });
  const items = (await r.json()).items;
  assert.equal(items.filter((i) => i.kind !== "security").length, 0);
  const key = await f.client()("push/key");
  assert.ok(key.publicKey.length > 60);
  await f.client()("push/subscribe", { subscription: { endpoint: "http://insecure" } }, 400);
  await f.client()("push/subscribe", {
    subscription: { endpoint: "https://push.example.org/abc", keys: { p256dh: "x", auth: "y" } },
  });
});

test("notifications are delivered oldest first without skipping; logged-in admin phones survive cleanup", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const { token } = await f.va(G)("notifications/device", {});
  for (let i = 0; i < 25; i++)
    await f.client()("enrollment", form("90000001" + String(i).padStart(2, "0")));
  const pull = async () =>
    (await (await fetch(f.url + "/api/notifications/pull", { headers: { "X-MVPMI-Device": token } })).json()).items;
  assert.equal((await pull()).length, 20);
  assert.equal((await pull()).length, 5);
  await f.admin("notifications/device", {});
  const mainId = f.store.get("config", "main-admin").memberId;
  const adminSession = f.store.all("sessions").find((x) => x.auth?.memberId === mainId);
  adminSession.createdAt = 0;
  f.store.put("sessions", adminSession);
  f.store.cleanup();
  assert.ok(f.store.get("sessions", adminSession.id));
});

test("a request sent with the old cookie just after login keeps the same person", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const phone = f.store.get("members", f.store.get("villageAdmins", G).memberId).phone;
  const first = await fetch(f.url + "/api/state");
  const oldCookie = first.headers.get("set-cookie").split(";")[0];
  const login = await fetch(f.url + "/api/login", {
    method: "POST",
    headers: { Cookie: oldCookie, "Content-Type": "application/json", "X-MVPMI-Client": "1" },
    body: JSON.stringify({ mobile: phone, secret: VA_PIN }),
  });
  assert.equal(login.status, 200);
  assert.notEqual(login.headers.get("set-cookie").split(";")[0], oldCookie);
  const stale = await fetch(f.url + "/api/state", { headers: { Cookie: oldCookie } });
  assert.equal((await stale.json()).villageAdmin, true);
  assert.equal(stale.headers.get("set-cookie"), null);
});

test("a Village Admin moving village still needs the destination village; changes in a village without an active admin go to the Main Admin", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  await f.ensureAdmin("Sathra");
  const vaMember = f.store.get("members", f.store.get("villageAdmins", G).memberId);
  const moved = await f.va(G)("profile/update", {
    firstName: "Administrator",
    middleName: "Moving",
    surname: "Thorala",
    phone: vaMember.phone,
    village: "Sathra",
  });
  const move = moved.updateRequests[0].id;
  await f.admin("admin/requests/" + move + "/approve", {}, 409);
  // The Sathra admin is disabled: the Main Admin decides directly.
  const m = await approvedIn(f, "Sathra", "9000000099");
  await f.admin("admin/village-admins/" + encodeURIComponent("સથરા") + "/disable", {});
  const change = await m("profile/update", { ...form("9000000098"), village: "Sathra" });
  await f.admin("admin/requests/" + change.updateRequests[0].id + "/approve", {});
});
async function approvedIn(f, village, phone) {
  const m = f.client();
  const r = await m("enrollment", { ...form(phone), village });
  const gu = f.store.all("villages").find((v) => v.en === village).gu;
  await f.va(gu)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  const done = await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  await f.firstLogin(m, phone, done.issuedPin.pin, MEMBER_PIN);
  return m;
}
