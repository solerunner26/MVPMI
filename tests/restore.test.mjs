import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example } from "./helpers.mjs";

const cases = [
  ["null root", () => null],
  ["wrong version", (b) => ({ ...b, schemaVersion: 99 })],
  ["null member", (b) => ({ ...b, members: [null] })],
  [
    "duplicate member",
    (b) => ({ ...b, members: [...b.members, ...b.members] }),
  ],
  ["empty owner", (b) => ({ ...b, members: [{ ...b.members[0], owner: "" }] })],
  [
    "extra credential field",
    (b) => ({ ...b, members: [{ ...b.members[0], password: "secret" }] }),
  ],
  [
    "object display name",
    (b) => ({ ...b, members: [{ ...b.members[0], nameGu: { attack: true } }] }),
  ],
  ["incomplete request", (b) => ({ ...b, requests: [{}] })],
  [
    "orphan request",
    (b) => ({
      ...b,
      requests: [
        {
          id: "r",
          owner: "missing",
          kind: "delete",
          memberId: "missing",
          createdAt: 1,
          old: b.members[0],
          reason: "reason",
        },
      ],
    }),
  ],
  [
    "object archive field",
    (b) => ({
      ...b,
      archive: [
        { id: "a", name: "Name", nameLatin: { bad: true }, status: "Removed" },
      ],
    }),
  ],
  [
    "null snapshot",
    (b) => ({
      ...b,
      archive: [{ id: "a", name: "Name", status: "Removed", snapshot: null }],
    }),
  ],
  ["root session injection", (b) => ({ ...b, sessions: [{ admin: true }] })],
];
for (const [name, damage] of cases)
  test(
    "restore rejects " + name + " without modifying existing data",
    async (t) => {
      const { admin, enroll, client, store } = await fixture(t);
      await enroll(client());
      const before = store.dataDigest(),
        backup = await admin("admin/backup");
      await admin("admin/restore/validate", damage(backup), 400);
      assert.equal(store.dataDigest(), before);
    },
  );

test("restore refuses stale confirmation and mismatched file digest", async (t) => {
  const { admin, enroll, client, store } = await fixture(t);
  await enroll(client());
  const backup = await admin("admin/backup"),
    preview = await admin("admin/restore/validate", backup);
  await admin(
    "admin/restore",
    { backup, digest: "wrong", currentDigest: preview.currentDigest },
    400,
  );
  await client()("enrollment", { ...example, phone: "9000000002" });
  const before = store.dataDigest();
  await admin(
    "admin/restore",
    { backup, digest: preview.digest, currentDigest: preview.currentDigest },
    409,
  );
  assert.equal(store.dataDigest(), before);
  const fresh = await admin("admin/restore/validate", backup);
  await admin("admin/restore", {
    backup,
    digest: fresh.digest,
    currentDigest: fresh.currentDigest,
  });
  assert.equal(store.all("members").length, 1);
  assert.equal(store.all("requests").length, 0);
});

test("backup rejects conflicting proposed phones and mismatched request ownership", async (t) => {
  const { admin, client, enroll } = await fixture(t),
    one = client(),
    two = client();
  await enroll(one);
  await enroll(two, { ...example, phone: "9000000002" });
  await one("profile/update", { ...example, name: "Updated Name" });
  const backup = await admin("admin/backup");
  let broken = structuredClone(backup);
  broken.requests[0].payload.phone = "9000000002";
  await admin("admin/restore/validate", broken, 400);
  broken = structuredClone(backup);
  broken.requests[0].old.owner = "someone-else";
  await admin("admin/restore/validate", broken, 400);
});

test("JSON key ordering does not cause a false stale-update conflict after restore", async (t) => {
  const { admin, client, enroll } = await fixture(t),
    u = client();
  await enroll(u);
  await u("profile/update", { ...example, name: "Updated Name" });
  const backup = await admin("admin/backup");
  backup.requests[0].old = Object.fromEntries(
    Object.entries(backup.requests[0].old).reverse(),
  );
  const preview = await admin("admin/restore/validate", backup);
  await admin("admin/restore", {
    backup,
    digest: preview.digest,
    currentDigest: preview.currentDigest,
  });
  await admin("admin/requests/" + backup.requests[0].id + "/approve", {});
  assert.equal((await u("state")).members[0].name, "Updated Name");
});
