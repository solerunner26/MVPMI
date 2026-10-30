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

test("a login from the OLD app (before v1.4) never blocks: its app may have been removed during the update", async (t) => {
  const f = await fixture(t);
  const url = f.url + "/api/";
  // The person's old app (build 201) is logged in…
  const oldApp = async (path, body) => {
    const r = await fetch(url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 MVPMlAndroid/1.3.1 MVPMlBuild/201", Cookie: oldApp.cookie || "" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie")) oldApp.cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  };
  const a = f.client();
  await f.enroll(a, { ...example, phone: "9000000301" });
  await a("logout", {});
  assert.equal((await oldApp("login", { mobile: "9000000301" })).status, 200);
  await oldApp("state");
  // …then the same phone installs v1.4 fresh: no code needed.
  const s = await f.client()("login", { mobile: "9000000301" });
  assert.ok(s.account);
  // A v1.4 app (build 220) that is logged in DOES ask the next phone for a code.
  const newApp = f.client();
  const r = await fetch(url + "login", { method: "POST", headers: { "X-MVPMI-Client": "1", "Content-Type": "application/json", "User-Agent": "MVPMlAndroid/1.4.0 MVPMlBuild/220" }, body: JSON.stringify({ mobile: "9000000301" }) });
  assert.equal(r.status, 409, "the browser session counts, so a code is asked");
  void newApp;
});
