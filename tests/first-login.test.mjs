// Owner decisions: the seeded Main Admin password works for the FIRST login
// only; he must then choose his own password (new + re-enter, any 4+
// characters). Members and Village Admins have no PIN or password.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, MAIN } from "./helpers.mjs";

test("the first-time Main Admin password must be replaced at the first login", async (t) => {
  const f = await fixture(t, { keepFirstPassword: true });
  const main = f.client();
  let s = await main("login", { mobile: MAIN.mobile, secret: MAIN.password });
  assert.equal(s.account.mustSetPin, true);
  assert.equal(s.account.role, "MAIN_ADMIN");
  assert.equal(s.account.adminMode, false, "no admin tools before the new password");
  assert.equal(s.members.length, 0, "no directory before the new password");
  assert.equal((await main("admin/requests", undefined, 409)).code, "SET_PIN_FIRST");
  const set = (body, status) => main("password/set", body, status);
  assert.equal((await set({ next: "abc", confirm: "abc" }, 400)).code, "PASSWORD_FORMAT");
  assert.equal((await set({ next: MAIN.password, confirm: MAIN.password }, 400)).code, "PASSWORD_SAME");
  assert.equal((await set({ next: "krishna", confirm: "krishnb" }, 400)).code, "PASSWORD_MISMATCH");
  // Any plain password is accepted: no letters/numbers/symbols mix required.
  s = await set({ next: "krishna", confirm: "krishna" });
  assert.equal(s.account.mustSetPin, false);
  assert.equal(s.account.adminMode, true);
  assert.ok(s.members.length >= 1);
  assert.equal((await set({ next: "Again@2026", confirm: "Again@2026" }, 409)).code, "PIN_ALREADY_SET");
  // The first-time password no longer works; the chosen one does, with no
  // second forced change.
  assert.equal((await f.client()("login", { mobile: MAIN.mobile, secret: MAIN.password }, 401)).code, "WRONG_PASSWORD");
  s = await f.client()("login", { mobile: MAIN.mobile, secret: "krishna" });
  assert.equal(s.account.mustSetPin, false);
});
