#!/usr/bin/env node
// Safe test server for the Android instrumented tests (CI emulator only).
// Serves THIS commit's server and web code from an in-memory database with
// synthetic people; the emulator reaches it at http://10.0.2.2:<port>.
//
//   node scripts/android-test-server.mjs [port]      (default 3900)
//
// Accounts (all synthetic):
//   Main Admin      9913000001  password Testing@26
//   Village Admin   9800000010  (Thorala, mobile only)
//   Members         9700000001 … 9700000008 (Thorala, mobile only)
import { createApp } from "../server/app.mjs";
import { mainAdminId } from "../server/auth.mjs";
import { execSync } from "node:child_process";

const port = Number(process.argv[2] || process.env.PORT || 3900);
const MAIN = { name: "Test Main Admin", mobile: "9913000001", village: "Thorala", location: "Thorala", password: "Testing@26" };
const { app, store } = createApp({ dbPath: ":memory:", mainAdmin: MAIN, development: true, requireAppLock: true });
// The first-login password change is tested in the browser suite.
const m = store.get("members", mainAdminId(store));
delete m.cred.initial;
store.put("members", m);

const server = app.listen(port, "0.0.0.0");
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + port + "/api/";
const client = () => {
  let cookie = "";
  return async (path, body) => {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Cookie: cookie, "X-MVPMI-Client": "1", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
    const j = await r.json();
    if (!r.ok) throw new Error(path + ": " + (j.code || j.error));
    return j;
  };
};
const admin = client();
await admin("login", { mobile: MAIN.mobile, secret: MAIN.password });
const village = "થોરાળા";
await admin("admin/village-admins/" + encodeURIComponent(village) + "/create", { name: "Village Admin Ten", mobile: "9800000010" });
const va = client();
await va("login", { mobile: "9800000010" });
const names = ["Asha Patel", "Bhavesh Vala", "Chirag Gohil", "Daksha Jadeja", "Ekta Parmar", "Farhan Solanki", "Gita Rathod", "Hiren Zala"];
for (let i = 0; i < names.length; i++) {
  const [firstName, surname] = names[i].split(" ");
  const r = await client()("enrollment", { firstName, surname, phone: "970000000" + (i + 1), village, consent: true, currentLocation: "Surat" });
  await va("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await admin("admin/requests/" + r.myRequest.id + "/approve", {});
}
let sha = process.env.GITHUB_SHA || "";
try {
  sha ||= execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {}
console.log(`MVPMI Android test server ready on port ${port} · commit ${sha || "unknown"} · ${store.all("members").length} people`);
