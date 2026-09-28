import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Identity is verified in person by the village administrator, so the live
// server starts without any SMS/OTP service. It must, however, refuse to run
// a live deployment over plain HTTP.
test("live mode refuses to start without HTTPS cookies", () => {
  const result = spawnSync(process.execPath, ["server/index.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEVELOPMENT_MODE: "false",
      COOKIE_SECURE: "false",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use HTTPS/);
});

test("live mode starts (HTTPS cookies, trusted proxy) and the CommonJS bridge loads it in-process", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mvpmi-live-"));
  let port;
  const child = spawn(process.execPath, ["app.cjs"], {
    env: {
      ...process.env,
      DEVELOPMENT_MODE: "false",
      COOKIE_SECURE: "true",
      TRUST_PROXY: "1",
      PORT: "0",
      DB_PATH: join(dir, "live.sqlite"),
      MAIN_ADMIN_NAME: "Live Test Admin",
      MAIN_ADMIN_MOBILE: "9913000001",
      MAIN_ADMIN_VILLAGE: "Thorala",
      MAIN_ADMIN_PASSWORD: "LiveTest@26",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 15000);
    child.stdout.on("data", (d) => {
      const match = /listening on (\d+)/.exec(String(d));
      if (match) {
        port = match[1];
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => reject(new Error("exited " + code)));
  });
  const r = await fetch(`http://127.0.0.1:${port}/api/state`, {
    headers: { "X-Forwarded-For": "203.0.113.9" },
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Partitioned/);
  const body = await r.json();
  assert.equal(body.development, false);
  const transport = await fetch(`http://127.0.0.1:${port}/api/session/transport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-MVPMI-Client": "1" },
    body: "{}",
  });
  assert.deepEqual(await transport.json(), { enabled: false });
});
