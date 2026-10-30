// Second-phone login with a code from the phone already using the number
// (owner, 30 Oct 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example, MAIN } from "./helpers.mjs";

test("a 2nd phone needs the 6-digit code shown on the 1st phone; both stay logged in", async (t) => {
  const f = await fixture(t);
  const father = f.client();
  const m = await f.enroll(father, { ...example, phone: "9000000071", name: "Ramesh Vala" });
  const son = f.client();
  // Without the code: refused, a code is created and the father is told.
  const e = await son("login", { mobile: "9000000071" }, 409);
  assert.equal(e.code, "OWNER_CODE_SENT");
  const notes = f.store.all("notifications").filter((n) => n.kind === "login-code");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].to, "owner:" + f.store.get("members", m.id).owner);
  // The father sees the code in his app; the son's state has none.
  const fs = await father("state");
  assert.equal(fs.loginCodes.length, 1);
  const code = fs.loginCodes[0].code;
  assert.match(code, /^\d{6}$/);
  assert.equal((await f.admin("state")).loginCodeRequests[0].code, code, "the Main Admin can also give the code");
  // Wrong code, then the right one.
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await son("login", { mobile: "9000000071", code: wrong }, 401)).code, "OWNER_CODE_WRONG");
  const s = await son("login", { mobile: "9000000071", code });
  assert.equal(s.account.id, m.id);
  // Both phones are logged in; the code is used up.
  assert.equal((await father("state")).account.id, m.id);
  assert.equal((await father("state")).loginCodes.length, 0);
  // Asking again sends no extra notification until "resend".
  const third = f.client();
  await third("login", { mobile: "9000000071" }, 409);
  await third("login", { mobile: "9000000071" }, 409);
  assert.equal(f.store.all("notifications").filter((n) => n.kind === "login-code").length, 2);
  await third("login", { mobile: "9000000071", resend: true }, 409);
  assert.equal(f.store.all("notifications").filter((n) => n.kind === "login-code").length, 3);
});

test("the first phone logs in without a code; after signing out everywhere, no code is needed", async (t) => {
  const f = await fixture(t);
  const a = f.client();
  await f.enroll(a, { ...example, phone: "9000000081" });
  await a("logout", {});
  const b = f.client();
  const s = await b("login", { mobile: "9000000081" });
  assert.ok(s.account, "nobody else logged in with this number: no code");
});

test("five wrong codes end the code; the Main Admin's password login never asks for a code", async (t) => {
  const f = await fixture(t);
  const a = f.client();
  await f.enroll(a, { ...example, phone: "9000000091" });
  const b = f.client();
  await b("login", { mobile: "9000000091" }, 409);
  const code = (await a("state")).loginCodes[0].code;
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await b("login", { mobile: "9000000091", code: wrong }, 401);
  assert.equal((await b("login", { mobile: "9000000091", code }, 409)).code, "OWNER_CODE_EXPIRED");
  // The Main Admin is already logged in (f.admin) and logs in again elsewhere.
  const other = f.client();
  const s = await other("login", { mobile: MAIN.mobile, secret: MAIN.password });
  assert.ok(s.account);
});
