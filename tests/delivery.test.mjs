import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
// The SMS/OTP delivery adapter and its tests were removed with the switch to
// offline recovery codes: password reset no longer depends on any paid
// per-message service.
test("production startup remains explicitly disabled until release blockers are resolved", () => {
  const result = spawnSync(process.execPath, ["server/index.mjs"], {
    encoding: "utf8",
    env: { ...process.env, DEVELOPMENT_MODE: "false" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production launch is disabled/);
});
