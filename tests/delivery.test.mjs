import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { smsSender } from "../server/sms.mjs";
test("SMS configuration rejects plaintext endpoints, credentials in URLs and missing authentication", () => {
  assert.equal(smsSender({}), undefined);
  for (const env of [
    { SMS_WEBHOOK_URL: "broken" },
    {
      SMS_WEBHOOK_URL: "http://example.invalid",
      SMS_WEBHOOK_TOKEN: "secret",
      ADMIN_PHONE: "+919000000000",
    },
    {
      SMS_WEBHOOK_URL: "https://user:password@example.invalid",
      SMS_WEBHOOK_TOKEN: "secret",
      ADMIN_PHONE: "+919000000000",
    },
    {
      SMS_WEBHOOK_URL: "https://example.invalid",
      ADMIN_PHONE: "+919000000000",
    },
    {
      SMS_WEBHOOK_URL: "https://example.invalid",
      SMS_WEBHOOK_TOKEN: "secret",
      ADMIN_PHONE: "invalid",
    },
  ])
    assert.throws(() => smsSender(env));
});
test("SMS uses authenticated HTTPS, refuses redirects and rejects delivery failures", async () => {
  const env = {
    SMS_WEBHOOK_URL: "https://sms.example.invalid/send",
    SMS_WEBHOOK_TOKEN: "test-secret",
    ADMIN_PHONE: "+919000000000",
  };
  const send = smsSender(env, async (url, options) => {
    assert.equal(url, env.SMS_WEBHOOK_URL);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer test-secret");
    assert.equal(JSON.parse(options.body).phone, env.ADMIN_PHONE);
    assert.ok(JSON.parse(options.body).message.includes("654321"));
    return { ok: true };
  });
  await send(env.ADMIN_PHONE, "654321");
  await assert.rejects(
    smsSender(env, async () => ({ ok: false }))(env.ADMIN_PHONE, "654321"),
  );
});
test("production startup remains explicitly disabled until release blockers are resolved", () => {
  const result = spawnSync(process.execPath, ["server/index.mjs"], {
    encoding: "utf8",
    env: { ...process.env, DEVELOPMENT_MODE: "false" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production launch is disabled/);
});
