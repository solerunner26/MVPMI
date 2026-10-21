// Main Admin adds a member directly (owner, 21 Oct 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example } from "./helpers.mjs";

const person = { firstName: "Kiran", middleName: "Ramesh", surname: "Vala", phone: "9000000061", village: "Bhadrod" };

test("the Main Admin adds a member who can then log in with the mobile number", async (t) => {
  const f = await fixture(t);
  const before = (await f.admin("state")).members.length;
  const r = await f.admin("admin/members/add", person);
  assert.equal(r.added.phone, "9000000061");
  assert.equal(r.added.village, "ભાદ્રોડ");
  assert.equal(r.members.length, before + 1);
  const m = r.members.find((x) => x.id === r.added.id);
  assert.equal(m.tehsil, "મહુવા");
  // No request, no verification: the member logs in at once.
  assert.equal(r.newRequests.length, 0);
  const c = f.client();
  const s = await c("login", { mobile: "9000000061" });
  assert.equal(s.account.id, r.added.id);
  // The same number cannot be added twice.
  assert.equal((await f.admin("admin/members/add", person, 409)).code, "STATUS_APPROVED");
  await f.admin("admin/members/add", { ...person, phone: "123" }, 400);
});

test("nobody but the Main Admin can add members directly", async (t) => {
  const f = await fixture(t);
  const a = f.client();
  await f.enroll(a, { ...example, phone: "9000000071" });
  await a("admin/members/add", { ...person, phone: "9000000072" }, 403);
  await f.va("થોરાળા")("admin/members/add", { ...person, phone: "9000000073" }, 403);
  await f.client()("admin/members/add", { ...person, phone: "9000000074" }, 403);
});
