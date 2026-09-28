// Section 2 "Done when": the Main Admin seed values (name, mobile, initial
// PASSWORD) live only in the server's own config file, which git ignores.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readEnvFile } from "../server/config-file.mjs";

const tracked = () =>
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((f) => f && existsSync(f));

test("config/main-admin.env and .env are excluded from git", () => {
  for (const file of ["config/main-admin.env", ".env"]) {
    const r = execFileSync("git", ["check-ignore", "-v", file], { encoding: "utf8" });
    assert.match(r, /\.gitignore/, file);
  }
  assert.equal(tracked().includes("config/main-admin.env"), false);
});

test("the Main Admin seed values never appear in any tracked file (Android code included)", (t) => {
  const seed = readEnvFile("config/main-admin.env");
  const secrets = ["MAIN_ADMIN_PASSWORD", "MAIN_ADMIN_MOBILE", "MAIN_ADMIN_NAME"]
    .map((k) => seed[k])
    .filter((v) => v && v.length >= 6);
  if (!secrets.length) {
    t.skip("no config/main-admin.env on this computer");
    return;
  }
  for (const file of tracked()) {
    const text = readFileSync(file).toString("latin1") + readFileSync(file, "utf8");
    for (const secret of secrets) assert.equal(text.includes(secret), false, file);
  }
});
