import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example } from "./helpers.mjs";
const reason = "Known personally in this village";
const forward = { reason, identityConfirmed: true };
async function scenario(t) {
  const f = await fixture(t);
  const local = f.client();
  const rep = await f.enroll(local, {
    ...example,
    name: "Village Representative",
    phone: "7999999991",
  });
  return { ...f, local, rep };
}
test("new enrollment cannot bypass independent village and main approval", async (t) => {
  const f = await scenario(t),
    guest = f.client();
  await guest("enrollment", example);
  const r = f.store.all("requests")[0];
  assert.equal((await guest("state")).applicationStage, "village");
  assert.deepEqual((await guest("state")).members, []);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await guest(`village/requests/${r.id}/forward`, forward, 403);
  await f.local(`village/requests/${r.id}/forward`, { reason }, 400);
  await f.local(`village/requests/${r.id}/forward`, forward);
  assert.equal((await guest("state")).applicationStage, "main");
  assert.deepEqual((await guest("state")).members, []);
  await f.local(`admin/requests/${r.id}/approve`, {}, 403);
  await f.admin(`admin/requests/${r.id}/approve`, {});
  assert.equal((await guest("state")).role, "member");
});
test("local rejection requires reason, retains phone and decision, never enters removed-members archive", async (t) => {
  const f = await scenario(t),
    guest = f.client();
  await guest("enrollment", example);
  let r = f.store.all("requests")[0];
  await f.local(`village/requests/${r.id}/reject`, { reason: "" }, 400);
  await f.local(`village/requests/${r.id}/reject`, {
    reason: "Cannot recognise this applicant",
    category: "not-community",
  });
  const main = await f.admin("state");
  assert.equal(main.rejectedApplications[0].phone, example.phone);
  assert.equal(main.archive.length, 0);
  assert.equal(
    (await guest("state")).lastDecision.reason,
    "Cannot recognise this applicant",
  );
  assert.deepEqual((await f.local("state")).rejectedApplications, []);
  await guest("enrollment", example);
  r = f.store.all("requests")[0];
  await f.local(`village/requests/${r.id}/close`, {
    reason: "Applicant withdrew the request",
    category: "other",
  });
  assert.equal(f.store.all("rejections").length, 1);
  assert.equal(f.store.all("rejections")[0].events.length, 2);
});
test("reassignment revokes authority immediately and invalidates outstanding verification", async (t) => {
  const f = await scenario(t),
    replacement = f.client(),
    applicant = f.client();
  const next = await f.enroll(replacement, {
    ...example,
    name: "Replacement Admin",
    phone: "7999999992",
  });
  await applicant("enrollment", example);
  const r = f.store.all("requests")[0];
  await f.local(`village/requests/${r.id}/forward`, forward);
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા"), {
    memberId: next.id,
    reason,
  });
  assert.equal((await f.local("state")).villageAdmin, false);
  assert.equal((await replacement("state")).villageAdmin, true);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await f.local(`village/requests/${r.id}/forward`, forward, 403);
  await replacement(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {});
});
test("village queues are scoped, self verification is denied, arbitrary villages rejected", async (t) => {
  const f = await scenario(t),
    other = f.client();
  await other("enrollment", { ...example, village: "Sathra" });
  const r = f.store.all("requests")[0];
  assert.equal((await f.local("state")).reviewQueue.length, 0);
  await f.local(`village/requests/${r.id}/reject`, { reason }, 403);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await f.client()(
    "enrollment",
    { ...example, phone: "7999999998", village: "Invented" },
    400,
  );
  const own = f.client();
  await own("enrollment", { ...example, phone: f.rep.phone });
  const self = f.store
    .all("requests")
    .find((r) => r.payload.phone === f.rep.phone);
  await f.local(`village/requests/${self.id}/forward`, forward, 403);
});
test("only main admin adds villages; duplicates and unassigned automatic approval are blocked", async (t) => {
  const f = await scenario(t);
  await f.local("admin/villages", { gu: "નવું ગામ", en: "New Village" }, 403);
  await f.admin("admin/villages", { gu: "નવું ગામ", en: "New Village" });
  assert.equal((await f.client()("state")).villages.length, 8);
  await f.admin("admin/villages", { gu: "નવું ગામ", en: "Other name" }, 409);
  const guest = f.client();
  await guest("enrollment", {
    ...example,
    village: "New Village",
    currentLocation: "Adajan, Surat",
  });
  const r = f.store.all("requests")[0];
  assert.equal(r.payload.currentLocation, "Adajan, Surat");
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
});
test("deleted member rejoins through both stages, archive person and numbers remain unique", async (t) => {
  const f = await scenario(t),
    old = f.client();
  const member = await f.enroll(old, example);
  await f.admin(`admin/members/${member.id}/delete`, {});
  assert.equal((await old("state")).role, "guest");
  const fresh = f.client();
  await fresh("enrollment", example);
  let r = f.store.all("requests")[0];
  await f.local(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  const archived = f.store.all("archive")[0];
  await f.admin(`admin/requests/${r.id}/approve`, {
    archiveId: archived.id,
    identityConfirmed: true,
  });
  const restored = f.store
    .all("members")
    .find((m) => m.phone === example.phone);
  assert.equal(restored.id, member.id);
  assert.equal((await old("state")).role, "guest");
  await f.admin(`admin/members/${member.id}/delete`, {});
  assert.equal(f.store.all("archive").length, 1);
  assert.equal(f.store.all("archive")[0].history.length, 2);
  assert.equal(f.store.all("rejections").length, 0);
});
test("new device gets no automatic access; verified replacement revokes the previous owner", async (t) => {
  const f = await scenario(t),
    old = f.client();
  const member = await f.enroll(old, example);
  const fresh = f.client();
  await fresh("enrollment", example);
  const r = f.store.all("requests")[0];
  assert.deepEqual((await fresh("state")).members, []);
  await f.local(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await f.admin(`admin/requests/${r.id}/approve`, {
    replaceExistingMemberId: member.id,
    identityConfirmed: true,
    reason,
  });
  assert.equal((await old("state")).role, "guest");
  assert.equal((await fresh("state")).role, "member");
  assert.equal(
    f.store.all("members").filter((m) => m.phone === example.phone).length,
    1,
  );
});
test("phone collision checking covers primary and secondary numbers", async (t) => {
  const f = await scenario(t),
    a = f.client();
  await f.enroll(a, { ...example, phone2: "8000000002" });
  await f.client()("enrollment", { ...example, phone: "8000000002" }, 409);
  await f.client()(
    "enrollment",
    { ...example, phone: "8000000003", phone2: "8000000002" },
    409,
  );
});
test("backup roundtrip preserves governance and rejection records but requires fresh verification", async (t) => {
  const f = await scenario(t),
    guest = f.client();
  await guest("enrollment", example);
  const r = f.store.all("requests")[0];
  await f.local(`village/requests/${r.id}/forward`, forward);
  const b = await f.admin("admin/backup");
  assert.equal(b.schemaVersion, 2);
  const preview = await f.admin("admin/restore/validate", b);
  await f.admin("admin/restore", { backup: b, ...preview });
  assert.equal(f.store.get("requests", r.id).verification, undefined);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
});
test("old access codes cannot be issued or redeemed", async (t) => {
  const f = await scenario(t);
  await f.admin(
    `admin/members/${f.rep.id}/recovery`,
    { identityVerified: true },
    410,
  );
  await f.client()(
    "member/recover",
    { phone: f.rep.phone, code: "a".repeat(32) },
    410,
  );
  assert.equal(f.store.all("recoveries").length, 0);
});
