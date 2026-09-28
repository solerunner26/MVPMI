import test from "node:test";
import assert from "node:assert/strict";
import {
  ROLES,
  STATUS,
  WEAK_PINS,
  isPinFormat,
  isWeakPin,
  isPasswordFormat,
  randomTempPin,
} from "../server/terms.mjs";
import { STR, t } from "../web/strings.mjs";

test("Section 0: roles and statuses use the agreed names", () => {
  assert.deepEqual(Object.keys(ROLES), ["MAIN_ADMIN", "VILLAGE_ADMIN", "MEMBER"]);
  assert.deepEqual(Object.keys(STATUS), ["PENDING", "APPROVED", "REJECTED", "REMOVED"]);
});

test("Section 0: PIN is exactly 4 digits and easy PINs are refused", () => {
  for (const ok of ["0012", "5820", "9071"]) assert.ok(isPinFormat(ok) && !isWeakPin(ok));
  for (const bad of ["123", "12345", "12a4", "", null]) assert.ok(!isPinFormat(bad));
  for (const weak of ["0000", "1111", "5555", "9999", "1234", "4321"]) assert.ok(isWeakPin(weak));
  assert.equal(WEAK_PINS.length, 12);
  for (let i = 0; i < 2000; i++) {
    const pin = randomTempPin();
    assert.ok(isPinFormat(pin) && !isWeakPin(pin));
  }
});

test("Section 0: PASSWORD needs at least 8 characters", () => {
  assert.ok(isPasswordFormat("JayMa@26"));
  assert.ok(!isPasswordFormat("short7!"));
  assert.ok(!isPasswordFormat(12345678));
});

test("Every string resource exists in Gujarati and English", () => {
  for (const [key, row] of Object.entries(STR)) {
    assert.equal(row.length, 2, key);
    assert.ok(row[0].trim() && row[1].trim(), key);
    assert.match(row[0], /[઀-૿]|^[A-Z0-9 ·+().:/-]+$/u, "Gujarati text for " + key);
  }
  assert.equal(t("term.pin", "en"), "PIN");
  assert.equal(t("err.LOCKED_OUT", "en", { min: 4, sec: 5 }), "Too many wrong attempts. Try again in 4 min 5 s.");
});

test("No old words for these terms remain in the app", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const files = [
    ...readdirSync("web").filter((f) => /\.(mjs|js|css)$/.test(f)).map((f) => "web/" + f),
    ...readdirSync("server").filter((f) => f.endsWith(".mjs")).map((f) => "server/" + f),
  ];
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), /passcode/i, f);
});
