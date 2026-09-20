import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
export const example = {
  name: "Synthetic Member",
  phone: "9000000001",
  phone2: "",
  label2: "work",
  village: "Thorala",
  consent: true,
};
export const VA_PASS = "Village@2026!";
export async function fixture(t, options = {}) {
  const { app, store } = createApp({
    dbPath: ":memory:",
    adminPassword: "Testing@2026!",
    gateCode: "5831",
    development: true,
    ...options,
  });
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
        `${path}: expected ${status}, got ${response.status}`,
      );
      return result;
    };
  };
  const admin = client();
  await admin("admin/gate", { code: "5831" });
  await admin("admin/login", { user: "admin", pass: "Testing@2026!" });
  const villageClients = new Map();
  const va = (village) => {
    const c = villageClients.get(village);
    assert.ok(c, "No administrator enrolled for " + village);
    return c;
  };
  const ensureAdmin = async (village) => {
    const record = store
      .all("villages")
      .find(
        (v) =>
          v.gu === village ||
          v.en.toLowerCase() === String(village).toLowerCase(),
      );
    assert.ok(record, "Unknown village " + village);
    if (store.get("villageAdmins", record.gu)) return;
    const phone = "799" + String(1000000 + villageClients.size).slice(-7);
    await admin("admin/village-admins/" + encodeURIComponent(record.gu), {
      name: "Administrator " + village,
      phone,
      pass: VA_PASS,
      reason: "Known village administrator",
      identityConfirmed: true,
    });
    const c = client();
    await c("village/login", { phone, pass: VA_PASS });
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
    await admin("admin/requests/" + request.id + "/approve", {});
    return (await user("state")).members.find((m) => m.phone === p.phone);
  };
  return { store, client, admin, enroll, ensureAdmin, va, url };
}
