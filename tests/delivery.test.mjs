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
  const port = String(20000 + Math.floor(Math.random() * 20000));
  const child = spawn(process.execPath, ["app.cjs"], {
    env: {
      ...process.env,
      DEVELOPMENT_MODE: "false",
      COOKIE_SECURE: "true",
      TRUST_PROXY: "1",
      PORT: port,
      DB_PATH: join(dir, "live.sqlite"),
      ADMIN_PASSWORD: "LiveTest@2026!",
      ADMIN_GATE_CODE: "5831",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 15000);
    child.stdout.on("data", (d) => {
      if (/listening/.test(String(d))) {
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
