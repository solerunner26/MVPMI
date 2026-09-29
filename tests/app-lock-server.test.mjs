// Optional phone lock (owner decision 2026-09-30): nobody is ever locked
// unless they turned the lock on in My Profile and chose a 4-digit PIN.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, MAIN } from "./helpers.mjs";

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
// with the mobile number, exactly like the app does after approval).
async function approved(f, phone = "9000000011", { login = true } = {}) {
  await f.ensureAdmin("Thorala");
  const m = f.client();
  const r = await m("enrollment", form(phone));
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  const done = await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  if (login) await f.firstLogin(m, phone);
  return { m, done };
}
const sessionOf = (f, phone) => {
  const member = f.store.all("members").find((y) => y.phone === phone);
  return f.store.all("sessions").find((x) => x.auth?.memberId === member.id);
};

test("approval needs no PIN: the registrant's phone is logged in automatically", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m, done } = await approved(f, "9000000011", { login: false });
  assert.equal(done.issuedPin, undefined, "no TEMP PIN is created");
  assert.equal(f.store.all("members").filter((x) => x.cred).length, 1);
  // Before login, the registrant's phone only learns it was approved.
  let s = await m("state");
  assert.equal(s.role, "guest");
  assert.equal(s.approvedHere, true);
  assert.deepEqual(s.members, []);
  // It logs in by itself (no typing) and lands in the directory.
  s = await m("login/approved", {});
  assert.equal(s.account.role, "MEMBER");
  assert.equal(s.account.mustSetPin, false);
  assert.ok(s.members.length >= 3);
  assert.equal(s.account.notice.kind, "approved");
  // Someone else's phone cannot use it.
  await f.client()("login/approved", {}, 404);
  // The Main Admin can never be logged in this way, even on a phone that
  // belonged to his record.
  const admin2 = f.client();
  await admin2("login/approved", {}, 404);
});

test("the lock is OFF for everybody and never turns on by itself, admins included", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  let s = await m("state");
  assert.deepEqual([s.account.lockOn, s.locked], [false, false]);
  await m("lock/engage", {});
  await m("lock/hidden", {});
  const row = sessionOf(f, "9000000011");
  row.lock.hiddenAt = Date.now() - 3600000; // an hour in the background
  f.store.put("sessions", row);
  assert.equal((await m("state")).locked, false, "OFF: never locks, however long the app was away");
  // Admins are not forced either.
  s = await f.admin("state");
  assert.deepEqual([s.account.role, s.lockOn, s.locked], ["MAIN_ADMIN", false, false]);
  await f.admin("lock/engage", {});
  assert.equal((await f.admin("state")).locked, false);
  const va = await f.va(G)("state");
  assert.deepEqual([va.lockOn, va.locked], [false, false]);
  assert.equal(va.villageAdmin, true);
});

test("My Profile → lock with a PIN: needs 4 digits twice, hides everything until the right PIN", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  assert.equal((await m("lock/preference", { on: true, pin: "12", confirm: "12" }, 400)).code, "PIN_FORMAT");
  assert.equal((await m("lock/preference", { on: true, pin: "1a34", confirm: "1a34" }, 400)).code, "PIN_FORMAT");
  assert.equal((await m("lock/preference", { on: true, pin: "2468", confirm: "2469" }, 400)).code, "PIN_MISMATCH");
  assert.equal((await m("state")).lockOn, false, "nothing changed after refused attempts");
  // Any 4 digits are fine (no "weak PIN" rule for a phone lock).
  let s = await m("lock/preference", { on: true, pin: "1234", confirm: "1234" });
  assert.deepEqual([s.lockOn, s.locked], [true, false], "turning it on does not lock the open app");
  await m("lock/engage", {});
  s = await m("state");
  assert.equal(s.locked, true);
  assert.deepEqual(s.members, []);
  assert.equal((await m("profile/delete", {}, 423)).code, "LOCKED");
  assert.equal(JSON.stringify(s).includes("1234"), false);
  assert.equal((await m("lock/unlock", { secret: "0000" }, 401)).code, "WRONG_PIN");
  await m("lock/unlock", { secret: "1234" });
  s = await m("state");
  assert.equal(s.locked, false);
  assert.ok(s.members.length >= 3);
  // The PIN can be changed while unlocked, and the lock can be turned off
  // again with no PIN (the phone is already open).
  await m("lock/preference", { on: true, pin: "5678", confirm: "5678" });
  await m("lock/engage", {});
  await m("lock/unlock", { secret: "1234" }, 401);
  await m("lock/unlock", { secret: "5678" });
  s = await m("lock/preference", { on: false });
  assert.deepEqual([s.lockOn, s.locked], [false, false]);
  await m("lock/engage", {});
  assert.equal((await m("state")).locked, false);
});

test("Forgot PIN: signing out and logging in again removes the lock, no administrator needed", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  await m("lock/preference", { on: true, pin: "1234", confirm: "1234" });
  await m("lock/engage", {});
  assert.equal((await m("state")).locked, true);
  // The lock screen's "Forgot PIN?" uses the normal sign-out, which is open
  // while locked.
  await m("logout", {});
  const again = f.client();
  const s = await again("login", { mobile: "9000000011" });
  assert.deepEqual([s.account.role, s.lockOn, s.locked], ["MEMBER", false, false]);
  assert.ok(s.members.length >= 3);
});

test("the lock closes after 1 minute or more in the background, not before", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  await m("lock/preference", { on: true, pin: "1234", confirm: "1234" });
  await m("lock/hidden", {});
  const row = sessionOf(f, "9000000011");
  row.lock.hiddenAt = Date.now() - 30000;
  f.store.put("sessions", row);
  assert.equal((await m("state")).locked, false, "30 seconds away: still open");
  row.lock.hiddenAt = Date.now() - 61000;
  f.store.put("sessions", row);
  const s = await m("state");
  assert.equal(s.locked, true, "over a minute away: locked");
  assert.deepEqual(s.members, []);
});

test("fingerprint unlock uses a device key released by the phone's biometric prompt", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const { m } = await approved(f);
  const key = "a".repeat(64);
  assert.equal((await m("lock/biometric", { key }, 409)).code, "LOCK_OFF");
  await m("lock/preference", { on: true, pin: "1234", confirm: "1234" });
  const s = await m("lock/biometric", { key });
  assert.equal(s.biometricOn, true);
  await m("lock/engage", {});
  assert.equal((await m("lock/unlock", { biometric: "b".repeat(64) }, 401)).code, "BIOMETRIC_FAILED");
  await m("lock/unlock", { biometric: key });
  assert.equal((await m("state")).locked, false);
  // Turning the lock off forgets the key.
  await m("lock/preference", { on: false });
  const row = sessionOf(f, "9000000011");
  assert.equal(row.lock.bio, undefined);
  assert.equal(JSON.stringify(f.store.all("sessions")).includes(key), false, "only a hash of the key is stored");
});

test("the Main Admin can use the same optional lock; his password is not the lock", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  await f.admin("lock/preference", { on: true, pin: "4567", confirm: "4567" });
  await f.admin("lock/engage", {});
  assert.equal((await f.admin("state")).locked, true);
  assert.equal((await f.admin("lock/unlock", { secret: MAIN.password }, 401)).code, "WRONG_PIN");
  await f.admin("lock/unlock", { secret: "4567" });
  assert.equal((await f.admin("state")).locked, false);
});
