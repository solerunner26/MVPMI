// Profile pictures (owner, 21 Oct 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example } from "./helpers.mjs";

const jpeg = (fill = 7, size = 1200) => {
  const b = Buffer.alloc(size, fill);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
  return "data:image/jpeg;base64," + b.toString("base64");
};

test("a member adds, changes and removes their photo; everyone signed in sees it", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client();
  const ma = await f.enroll(a, { ...example, phone: "9000000041", name: "Asha Vala" });
  await f.enroll(b, { ...example, phone: "9000000042", name: "Bhavesh Vala" });
  await a("profile/photo", { data: "data:image/png;base64,iVBORw0KGgo=" }, 400);
  await a("profile/photo", { data: "data:image/jpeg;base64," + Buffer.alloc(300, 1).toString("base64") }, 400);
  await a("profile/photo", { data: jpeg(7, 500 * 1024) }, 400);
  let s = await a("profile/photo", { data: jpeg(7) });
  assert.ok(s.account.photo, "own account shows the photo version");
  const seen = (await b("state")).members.find((m) => m.id === ma.id);
  assert.ok(seen.photo, "other members see the photo");
  const img = await b("photos/" + ma.id);
  assert.equal(img[0], 0xff);
  assert.equal(img.length, 1200);
  // Change it.
  await new Promise((r) => setTimeout(r, 5));
  s = await a("profile/photo", { data: jpeg(9) });
  assert.notEqual(s.account.photo, seen.photo);
  // Signed-out phones get nothing.
  await f.client()("photos/" + ma.id, undefined, 401);
  s = await a("profile/photo/delete", {});
  assert.equal(s.account.photo, undefined);
  assert.equal((await b("state")).members.find((m) => m.id === ma.id).photo, undefined);
  await b("photos/" + ma.id, undefined, 404);
  // Member records never hold image data.
  assert.ok(!JSON.stringify(f.store.get("members", ma.id)).includes("base64"));
});

test("only the Main Admin or that village's Village Admin can remove someone's photo", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client();
  const ma = await f.enroll(a, { ...example, phone: "9000000051", name: "Asha Vala" });
  await f.enroll(b, { ...example, phone: "9000000052", name: "Bhavesh Vala" });
  await a("profile/photo", { data: jpeg() });
  assert.equal((await b(`members/${ma.id}/photo/delete`, {}, 403)).code, "FORBIDDEN");
  await f.va("થોરાળા")(`members/${ma.id}/photo/delete`, {});
  assert.ok(!f.store.get("photos", ma.id));
  await a("profile/photo", { data: jpeg() });
  await f.admin(`members/${ma.id}/photo/delete`, {});
  assert.ok(!f.store.get("photos", ma.id));
  await f.admin("members/nobody/photo/delete", {}, 404);
});
