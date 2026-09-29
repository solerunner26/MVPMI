import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { mainAdminId } from "../server/auth.mjs";
export const example = {
  name: "Synthetic Member",
  phone: "9000000001",
  phone2: "",
  label2: "work",
  village: "Thorala",
  consent: true,
};
// Test accounts. The Main Admin is seeded from the same settings the server
// reads from config/main-admin.env.
export const MAIN = {
  name: "Test Main Admin",
  mobile: "9913000001",
  village: "Thorala",
  location: "Thorala",
  password: "Testing@2026!",
};
// The seeded password is for the FIRST login only (tests/first-login.test.mjs
// covers that). Other tests start after the Main Admin chose his password.
export function firstPasswordDone(store) {
  const m = store.get("members", mainAdminId(store));
  delete m.cred.initial;
  store.put("members", m);
  return store;
}
export const VA_PIN = "2580";
export const MEMBER_PIN = "3691";
export async function fixture(t, options = {}) {
  const { app, store } = createApp({
    dbPath: ":memory:",
    mainAdmin: MAIN,
    development: true,
    // The server-side app lock has its own tests (tests/app-lock-server.test.mjs).
    requireAppLock: false,
    ...options,
  });
  if (!options.keepFirstPassword) firstPasswordDone(store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    store.db.close();
  });
  const url = "http://127.0.0.1:" + server.address().port;
  const client = () => {
    let cookie = "";
    return async (path, body, status = 200) => {
      const response = await fetch(url + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: cookie,
          "X-MVPMI-Client": "1",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      const result = response.headers.get("content-type")?.includes("json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer());
      assert.equal(
        response.status,
        status,
        `${path}: expected ${status}, got ${response.status} ${JSON.stringify(result.error || "")}`,
      );
      return result;
    };
  };
  const admin = client();
  await admin("login", { mobile: MAIN.mobile, secret: MAIN.password });
  const villageClients = new Map();
  const va = (village) => {
    const c = villageClients.get(village);
    assert.ok(c, "No administrator enrolled for " + village);
    return c;
  };
  // Members and Village Admins log in with their mobile number only.
  // (The extra arguments are ignored; older tests still pass them.)
  const firstLogin = async (c, mobile) => c("login", { mobile });
  const ensureAdmin = async (village) => {
    const record = store
      .all("villages")
      .find(
        (v) =>
          v.gu === village ||
          v.en.toLowerCase() === String(village).toLowerCase(),
      );
    assert.ok(record, "Unknown village " + village);
    if (villageClients.has(record.gu)) return;
    const phone = "799" + String(1000000 + villageClients.size).slice(-7);
    const created = await admin(
      "admin/village-admins/" + encodeURIComponent(record.gu) + "/create",
      { name: "Administrator " + village, mobile: phone },
    );
    const c = client();
    assert.equal(created.created.kind, "village-admin");
    await firstLogin(c, phone);
    villageClients.set(record.gu, c);
  };
  const enroll = async (user, p = example) => {
    await ensureAdmin(p.village);
    await user("enrollment", p);
    const request = (await admin("state")).newRequests.find(
      (r) => r.phone === p.phone,
    );
    await va(request.village)("village/requests/" + request.id + "/forward", {
      reason: "Verified test community member",
      identityConfirmed: true,
    });
    const approved = await admin("admin/requests/" + request.id + "/approve", {});
    assert.equal(approved.issuedPin, undefined, "no TEMP PIN any more");
    await firstLogin(user, p.phone);
    return (await user("state")).members.find((m) => m.phone === p.phone);
  };
  return { store, client, admin, enroll, ensureAdmin, va, url, firstLogin };
}
