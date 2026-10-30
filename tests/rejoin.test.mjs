// Rejected and removed numbers can register again, or be corrected and added
// by the Main Admin (owner, 30 Oct 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example } from "./helpers.mjs";

async function rejected(f, phone, name = "Wrong Name") {
  await f.ensureAdmin("Thorala");
  const u = f.client();
  await u("enrollment", { ...example, phone, name, consent: true });
  const r = (await f.admin("state")).newRequests.find((x) => x.phone === phone);
  await f.admin("admin/requests/" + r.id + "/reject", { reason: "Name is wrong", category: "insufficient" });
  return u;
}

test("Allow all: every rejected and removed number can register again", async (t) => {
  const f = await fixture(t);
  const u = await rejected(f, "9000000101");
  assert.equal((await u("enrollment", { ...example, phone: "9000000101", consent: true }, 409)).code, "STATUS_REJECTED");
  // A removed member too.
  const a = f.client();
  const m = await f.enroll(a, { ...example, phone: "9000000102" });
  await f.admin("admin/members/" + m.id + "/delete", { reason: "test" });
  assert.equal((await f.client()("enrollment", { ...example, phone: "9000000102", consent: true }, 409)).code, "STATUS_REMOVED");
  await a("admin/rejoin/allow-all", {}, 403);
  const r = await f.admin("admin/rejoin/allow-all", {});
  assert.ok(r.allowed >= 2);
  await f.client()("enrollment", { ...example, phone: "9000000101", name: "Right Name", consent: true });
  await f.client()("enrollment", { ...example, phone: "9000000102", consent: true });
  // History is kept.
  assert.ok(f.store.all("rejections").some((x) => x.phone === "9000000101"));
  assert.ok(f.store.all("archive").some((x) => x.phone === "9000000102"));
});

test("Correct & add: the Main Admin fixes the details and adds a rejected number directly", async (t) => {
  const f = await fixture(t);
  await rejected(f, "9000000111");
  const person = { firstName: "Mahesh", surname: "Vala", phone: "9000000111", village: "Thorala" };
  assert.equal((await f.admin("admin/members/add", person, 409)).code, "STATUS_REJECTED");
  const r = await f.admin("admin/members/add", { ...person, allowBlocked: true });
  assert.equal(r.added.phone, "9000000111");
  assert.ok(r.members.some((m) => m.phone === "9000000111" && m.name.startsWith("Mahesh")));
  const s = await f.firstLogin(f.client(), "9000000111");
  assert.equal(s.account.phone, "9000000111");
  // An approved or pending number is never overridden.
  assert.equal((await f.admin("admin/members/add", { ...person, allowBlocked: true }, 409)).code, "STATUS_APPROVED");
});
