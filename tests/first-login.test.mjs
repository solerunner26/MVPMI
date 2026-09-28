// Owner decisions of 2026-09-28:
//  - The seeded Main Admin password works for the FIRST login only; he must
//    then choose his own password (new + re-enter).
//  - A Village Admin's TEMP PIN stays visible to the Main Admin (only) on the
//    Village Admin's card until their first login, so he can hand it over in
//    a phone call. A member's TEMP PIN is still never stored.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, MAIN, VA_PIN } from "./helpers.mjs";

test("the first-time Main Admin password must be replaced at the first login", async (t) => {
  const f = await fixture(t, { keepFirstPassword: true });
  const main = f.client();
  let s = await main("login", { mobile: MAIN.mobile, secret: MAIN.password });
  assert.equal(s.account.mustSetPin, true);
  assert.equal(s.account.role, "MAIN_ADMIN");
  assert.equal(s.account.adminMode, false, "no admin tools before the new password");
  assert.equal(s.members.length, 0, "no directory before the new password");
  assert.equal((await main("admin/requests", undefined, 409)).code, "SET_PIN_FIRST");
  assert.equal((await main("pin/set", { pin: "4826", confirm: "4826" }, 409)).code, "FORBIDDEN");
  const set = (body, status) => main("password/set", body, status);
  assert.equal((await set({ next: "short", confirm: "short" }, 400)).code, "PASSWORD_FORMAT");
  assert.equal((await set({ next: MAIN.password, confirm: MAIN.password }, 400)).code, "PASSWORD_SAME");
  assert.equal((await set({ next: "Chosen@2026", confirm: "Chosen@2027" }, 400)).code, "PASSWORD_MISMATCH");
  s = await set({ next: "Chosen@2026", confirm: "Chosen@2026" });
  assert.equal(s.account.mustSetPin, false);
  assert.equal(s.account.adminMode, true);
  assert.ok(s.members.length >= 1);
  assert.equal((await set({ next: "Again@2026", confirm: "Again@2026" }, 409)).code, "PIN_ALREADY_SET");
  // The first-time password no longer works; the chosen one does, with no
  // second forced change.
  assert.equal((await f.client()("login", { mobile: MAIN.mobile, secret: MAIN.password }, 401)).code, "WRONG_PASSWORD");
  s = await f.client()("login", { mobile: MAIN.mobile, secret: "Chosen@2026" });
  assert.equal(s.account.mustSetPin, false);
});

test("a Village Admin's TEMP PIN stays on the card for the Main Admin until first login", async (t) => {
  const f = await fixture(t);
  const created = await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create", {
    name: "Handover Admin",
    mobile: "9800000077",
  });
  const pin = created.issuedPin.pin;
  const card = async () => (await f.admin("state")).villageAssignments.find((a) => a.phone === "9800000077");
  assert.equal((await card()).tempPin, pin, "the Main Admin can see it again");
  // The Village Admin logs in with it: it disappears from the card at once.
  const va = f.client();
  const s = await va("login", { mobile: "9800000077", secret: pin });
  assert.deepEqual(s.villageAssignments || [], [], "a Village Admin never sees the card list");
  assert.equal((await card()).tempPin, null);
  await va("pin/set", { pin: VA_PIN, confirm: VA_PIN });
  assert.equal((await card()).tempPin, null);
  assert.equal(JSON.stringify(f.store.get("members", (await card()).memberId).cred).includes('"handover"'), false);
  // Reset PIN (e.g. a new phone or a forgotten PIN) shows the new one again.
  const reset = await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/reset", {});
  assert.equal((await card()).tempPin, reset.issuedPin.pin);
});

test("a member's TEMP PIN is never stored in plain text", async (t) => {
  const f = await fixture(t);
  const user = f.client();
  const m = await f.enroll(user, { name: "Plain Check", phone: "9811100011", village: "Thorala", consent: true });
  const reset = await f.admin("admin/members/" + m.id + "/pin-reset", {});
  const stored = JSON.stringify(f.store.get("members", m.id).cred);
  assert.equal(stored.includes(reset.issuedPin.pin), false);
  assert.equal(stored.includes("handover"), false);
});
