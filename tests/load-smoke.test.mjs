import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { profile } from "../server/store.mjs";

test("local 1,001-member read smoke test preserves authorization and bounded output", async (t) => {
  const { client, enroll, store } = await fixture(t),
    u = client();
  await enroll(u);
  store.tx(() => {
    for (let i = 100; i < 1100; i++)
      store.put("members", {
        ...profile({
          name: "Synthetic Member " + i,
          phone: String(9000000000 + i),
          village: "Thorala",
        }),
        id: "load-" + i,
        owner: "synthetic-owner-" + i,
        approvedAt: 1,
      });
  });
  const durations = [];
  let last;
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    last = await u("state");
    durations.push(performance.now() - start);
    assert.equal(last.members.length, 1001);
  }
  durations.sort((a, b) => a - b);
  const bytes = Buffer.byteLength(JSON.stringify(last));
  assert.ok(bytes < 1024 * 1024);
  assert.equal(JSON.stringify(last).includes("synthetic-owner-"), false);
  const outsider = client();
  assert.deepEqual((await outsider("state")).members, []);
  t.diagnostic(
    JSON.stringify({
      members: 1001,
      requests: 20,
      p50Milliseconds: Math.round(durations[10]),
      p95Milliseconds: Math.round(durations[18]),
      responseBytes: bytes,
      note: "Local sequential smoke test, not concurrency/Android performance certification",
    }),
  );
});
