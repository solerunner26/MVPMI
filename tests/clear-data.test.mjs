// Client hand-over: everything is deleted except the Main Admin login.
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, MAIN } from "./helpers.mjs";
import { clearDirectory } from "../server/clear-directory.mjs";

const G = "થોરાળા";

test("clearDirectory removes all contacts but keeps the Main Admin login and villages", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const m = f.client();
  const r = await m("enrollment", {
    firstName: "Clear",
    middleName: "Me",
    surname: "Member",
    phone: "9000000077",
    village: "Thorala",
    consent: true,
  });
  await f.va(G)("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
  await f.admin("admin/requests/" + r.myRequest.id + "/approve", {});
  assert.ok(f.store.all("members").length >= 3);
  const villages = f.store.all("villages").length;

  const removed = clearDirectory(f.store);
  assert.ok(removed.members >= 2);

  const members = f.store.all("members");
  assert.equal(members.length, 1);
  assert.equal(members[0].phone, MAIN.mobile);
  for (const table of ["villageAdmins", "requests", "sessions", "archive", "rejections"])
    assert.equal(f.store.all(table).length, 0, table + " is empty");
  assert.equal(f.store.all("villages").length, villages, "village list kept");

  // The Main Admin can still log in with his password.
  const a = f.client();
  const s = await a("login", { mobile: MAIN.mobile, secret: MAIN.password });
  assert.equal(s.account.role, "MAIN_ADMIN");
});
