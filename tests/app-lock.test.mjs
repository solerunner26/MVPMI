import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import {
  derivePinHash,
  verifyAppLock,
  enableAppLock,
  readAppLock,
  clearAppLock,
} from "../web/app-lock.mjs";

test("app-lock PIN hashing matches PBKDF2-SHA256 and never stores the PIN", () => {
  const salt = "00112233445566778899aabbccddeeff";
  const pin = "1357";
  // The pure-JS implementation must agree with Node's crypto.
  for (const iterations of [1, 2, 1000])
    assert.equal(
      derivePinHash(pin, salt, iterations),
      pbkdf2Sync(pin, Buffer.from(salt, "hex"), iterations, 32, "sha256").toString(
        "hex",
      ),
      "iteration " + iterations,
    );
  // A tiny localStorage shim exercises the enable/verify/clear cycle.
  const bag = new Map();
  globalThis.localStorage = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
  };
  assert.equal(readAppLock(), null);
  enableAppLock(pin);
  const stored = JSON.parse(bag.get("mvpmi.appLock"));
  assert.equal(stored.enabled, true);
  assert.match(stored.salt, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(stored).includes(pin), "PIN never stored");
  assert.equal(verifyAppLock(pin), true);
  assert.equal(verifyAppLock("9999"), false);
  // Each enable uses a fresh salt: same PIN, different hash.
  enableAppLock(pin);
  assert.notEqual(JSON.parse(bag.get("mvpmi.appLock")).hash, stored.hash);
  clearAppLock();
  assert.equal(readAppLock(), null);
  delete globalThis.localStorage;
});

test("the device logout endpoint destroys the whole session", async (t) => {
  const { fixture, example } = await import("./helpers.mjs");
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const member = f.client();
  await member("enrollment", example);
  const before = await member("state");
  assert.ok(before.myRequest, "the session owns the pending application");
  await member("logout", {});
  const after = await member("state");
  assert.ok(after.myRequest == null, "session identity destroyed");
  assert.equal(after.villageAdmin, false);
  assert.equal(after.role, "guest");
});
