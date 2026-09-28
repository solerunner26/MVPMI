import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example, MAIN, VA_PIN, MEMBER_PIN } from "./helpers.mjs";

const reason = "Known personally in this village";
const forward = { reason, identityConfirmed: true };

test("applications stay closed until the main administrator enrolls a village administrator", async (t) => {
  const f = await fixture(t),
    guest = f.client();
  const blocked = await guest("enrollment", example, 409);
  assert.equal(blocked.code, "NO_VILLAGE_ADMIN");
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create", {
    name: "Thorala Administrator",
    mobile: "7990000010",
  });
  await guest("enrollment", example);
  assert.equal((await guest("state")).applicationStage, "village");
  const r = f.store.all("requests")[0];
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await guest(`village/requests/${r.id}/forward`, forward, 403);
});

test("Village Admins log in with mobile + PIN; powers exist only in admin mode and follow the live assignment", async (t) => {
  const f = await fixture(t),
    anyone = f.client();
  await f.ensureAdmin("Thorala");
  const vaMember = f.store.get("members", f.store.get("villageAdmins", "થોરાળા").memberId);
  const applicant = f.client();
  await applicant("enrollment", { ...example, phone: "9000000002" });
  const r = f.store.all("requests")[0];
  assert.equal((await anyone("login", { mobile: vaMember.phone, secret: "1470" }, 401)).code, "WRONG_PIN");
  assert.equal((await anyone("login", { mobile: "8000000000", secret: VA_PIN }, 404)).code, "NOT_REGISTERED");
  let s = await anyone("login", { mobile: vaMember.phone, secret: VA_PIN });
  assert.equal(s.villageAdmin, true);
  assert.equal(s.account.role, "VILLAGE_ADMIN");
  assert.match(s.villageAdminName, /^Administrator/);
  // Admins land on the directory as members too.
  assert.ok(s.members.length >= 2);
  await anyone(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {});
  // "Log out" from admin mode: still a member, no admin power.
  s = await anyone("admin/logout", {});
  assert.equal(s.villageAdmin, false);
  assert.equal(s.role, "member");
  const later = f.client();
  await later("enrollment", { ...example, phone: "9000000008" });
  const laterRequest = f.store.all("requests").find((x) => x.payload.phone === "9000000008");
  await anyone(`village/requests/${laterRequest.id}/forward`, forward, 403);
  await anyone("admin/enter", { secret: VA_PIN });
  await anyone(`village/requests/${laterRequest.id}/forward`, forward);
  await f.admin(`admin/requests/${laterRequest.id}/approve`, {});
  // An existing member can be made the Village Admin (after the old one is
  // disabled): they get a TEMP PIN and their old login ends.
  const memberSession = f.client();
  const member = await f.enroll(memberSession, { ...example, phone: "9000000003" });
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/disable", {});
  assert.equal((await anyone("state")).villageAdmin, false);
  const promoted = await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create", {
    name: "ignored for existing members",
    mobile: member.phone,
  });
  assert.equal(promoted.issuedPin.memberId, member.id, "same member record");
  assert.equal((await memberSession("state")).account, null);
  s = await f.firstLogin(memberSession, member.phone, promoted.issuedPin.pin, "4826");
  assert.equal(s.villageAdmin, true);
  // A member of ANOTHER village cannot be made this village's admin.
  const sathra = await f.enroll(f.client(), { ...example, phone: "9000000014", village: "Sathra" });
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/disable", {});
  assert.equal(
    (await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create", { name: "X Y", mobile: sathra.phone }, 409)).code,
    "MEMBER_OTHER_VILLAGE",
  );
});

test("local rejection needs a reason, retains phone and decision, never enters removed-members archive", async (t) => {
  const f = await fixture(t),
    guest = f.client();
  await f.ensureAdmin("Thorala");
  await guest("enrollment", example);
  let r = f.store.all("requests")[0];
  // Village Admins reject WITH a reason (Section 3).
  await f.va("થોરાળા")(`village/requests/${r.id}/reject`, {}, 400);
  await f.va("થોરાળા")(`village/requests/${r.id}/reject`, { reason: "Not known in the village" });
  const main = await f.admin("state");
  assert.equal(main.rejectedApplications[0].phone, example.phone);
  assert.equal(main.archive.length, 0);
  assert.equal((await guest("state")).lastDecision.action, "reject");
  assert.deepEqual((await f.va("થોરાળા")("state")).rejectedApplications, []);
  assert.equal((await guest("enrollment", example, 409)).code, "STATUS_REJECTED");
  await f.admin("admin/rejections/" + main.rejectedApplications[0].id + "/allow-rejoin", {});
  await guest("enrollment", example);
  r = f.store.all("requests")[0];
  await f.va("થોરાળા")(`village/requests/${r.id}/close`, {
    reason: "Applicant withdrew the request",
    category: "other",
  });
  assert.equal(f.store.all("rejections").length, 1);
  assert.equal(f.store.all("rejections")[0].events.length, 3);
});

test("disabling a Village Admin revokes authority at once; the Main Admin decides that village until a new admin exists", async (t) => {
  const f = await fixture(t),
    applicant = f.client();
  await f.ensureAdmin("Thorala");
  const replacement = f.client();
  const next = await f.enroll(replacement, {
    ...example,
    name: "Replacement Admin",
    phone: "7990000012",
  });
  await applicant("enrollment", { ...example, phone: "9000000004" });
  const r = f.store.all("requests").find((x) => x.payload.phone === "9000000004");
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward);
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/disable", {});
  assert.equal((await f.va("થોરાળા")("state")).villageAdmin, false);
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward, 403);
  // Re-enabling restores the same admin; their phone opens the admin tools
  // again with the PIN.
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/enable", {});
  assert.equal((await f.va("થોરાળા")("state")).account.role, "VILLAGE_ADMIN");
  assert.equal((await f.va("થોરાળા")("admin/enter", { secret: VA_PIN })).villageAdmin, true);
  // New admin: the old forward is invalid and the new admin verifies again.
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/disable", {});
  const created = await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create", {
    name: "Replacement Admin",
    mobile: next.phone,
  });
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  const fresh = f.client();
  await f.firstLogin(fresh, next.phone, created.issuedPin.pin, "4826");
  await fresh(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {});
});

test("village queues are scoped, self verification is denied, arbitrary villages rejected", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  await f.ensureAdmin("Sathra");
  const other = f.client();
  await other("enrollment", {
    ...example,
    village: "Sathra",
    phone: "9000000005",
  });
  const r = f.store
    .all("requests")
    .find((x) => x.payload.phone === "9000000005");
  assert.equal((await f.va("થોરાળા")("state")).reviewQueue.length, 0);
  await f.va("થોરાળા")(`village/requests/${r.id}/reject`, { reason }, 403);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await f.client()(
    "enrollment",
    { ...example, phone: "9000000006", village: "Invented" },
    400,
  );
  // An approved number (here the Village Admin's own) cannot register again.
  const vaPhone = f.store.get("members", f.store.get("villageAdmins", "થોરાળા").memberId).phone;
  assert.equal((await f.client()("enrollment", { ...example, phone: vaPhone }, 409)).code, "STATUS_APPROVED");
});

test("the village list is fixed at seven villages and adding villages is removed", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.client()("state")).villages.length, 7);
  await f.ensureAdmin("Thorala");
  await f.va("થોરાળા")(
    "admin/villages",
    { gu: "નવું ગામ", en: "New Village" },
    404,
  );
  await f.admin("admin/villages", { gu: "નવું ગામ", en: "New Village" }, 404);
  assert.equal((await f.client()("state")).villages.length, 7);
});

test("village admin proposals always require the main administrator's final decision", async (t) => {
  const f = await fixture(t),
    owner = f.client();
  const member = await f.enroll(owner, example);
  const va = f.va("થોરાળા");
  await va(`village/members/${member.id}/update`, {
    ...example,
    name: "Proposed Name",
    currentLocation: "Ring Road, Surat",
    reason: "Member requested correction in person",
    identityConfirmed: true,
  });
  assert.equal(
    (await owner("state")).members.find((m) => m.id === member.id).name,
    example.name,
  );
  await va(`admin/requests/${f.store.all("requests")[0].id}/approve`, {}, 403);
  await va(
    `village/members/${member.id}/delete`,
    { reason: "Left the community", identityConfirmed: true },
    409,
  );
  const update = f.store.all("requests").find((r) => r.kind === "update");
  await f.admin(`admin/requests/${update.id}/approve`, {});
  const changed = f.store.all("members").find((m) => m.id === member.id);
  assert.equal(changed.name, "Proposed Name");
  assert.equal(changed.currentLocation, "Ring Road, Surat");
  await va(`village/members/${member.id}/delete`, {
    reason: "Member moved away permanently",
    identityConfirmed: true,
  });
  const del = f.store.all("requests").find((r) => r.kind === "delete");
  await f.admin(`admin/requests/${del.id}/approve`, {});
  assert.equal(
    f.store.all("members").find((m) => m.id === member.id),
    undefined,
  );
  assert.equal(f.store.all("archive").length, 1);
});

test("village admin proposals are village-scoped and never apply to the admin's own record", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  await f.ensureAdmin("Sathra");
  const outsider = await f.enroll(f.client(), {
    ...example,
    village: "Sathra",
    phone: "9000000007",
  });
  const va = f.va("થોરાળા");
  await va(
    `village/members/${outsider.id}/update`,
    {
      ...example,
      village: "Sathra",
      reason: "Out of scope attempt",
      identityConfirmed: true,
    },
    403,
  );
  const assignment = f.store.get("villageAdmins", "થોરાળા");
  await va(
    `village/members/${assignment.memberId}/delete`,
    { reason: "Self removal attempt", identityConfirmed: true },
    409,
  );
});

test("deleted member rejoins through both stages, archive person and numbers remain unique", async (t) => {
  const f = await fixture(t),
    old = f.client();
  const member = await f.enroll(old, example);
  await f.admin(`admin/members/${member.id}/delete`, {});
  assert.equal((await old("state")).role, "guest");
  const fresh = f.client();
  assert.equal((await fresh("enrollment", example, 409)).code, "STATUS_REMOVED");
  await f.admin("admin/archive/" + f.store.all("archive")[0].id + "/allow-rejoin", {});
  await fresh("enrollment", example);
  let r = f.store.all("requests")[0];
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward);
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

test("a member on a new phone logs in with the same PIN; there is no second registration", async (t) => {
  const f = await fixture(t),
    old = f.client();
  await f.enroll(old, example);
  const fresh = f.client();
  assert.equal((await fresh("enrollment", example, 409)).code, "STATUS_APPROVED");
  assert.deepEqual((await fresh("state")).members, []);
  const s = await fresh("login", { mobile: example.phone, secret: MEMBER_PIN });
  assert.equal(s.role, "member");
  assert.equal((await old("state")).role, "member", "both phones stay logged in");
});

test("phone collision checking covers primary and secondary numbers", async (t) => {
  const f = await fixture(t),
    a = f.client();
  await f.enroll(a, { ...example, phone2: "8000000002" });
  await f.client()("enrollment", { ...example, phone: "8000000002" }, 409);
  await f.client()(
    "enrollment",
    { ...example, phone: "8000000003", phone2: "8000000002" },
    409,
  );
});

test("a Village Admin changes their own PIN; the Main Admin resets it with a TEMP PIN", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const phone = f.store.get("members", f.store.get("villageAdmins", "થોરાળા").memberId).phone;
  const va = f.va("થોરાળા");
  assert.equal((await va("pin/change", { current: "1470", next: "3579", confirm: "3579" }, 401)).code, "WRONG_OLD_PIN");
  assert.equal((await va("pin/change", { current: VA_PIN, next: "357", confirm: "357" }, 400)).code, "PIN_FORMAT");
  assert.equal((await va("pin/change", { current: VA_PIN, next: "4321", confirm: "4321" }, 400)).code, "PIN_WEAK");
  assert.equal((await va("pin/change", { current: VA_PIN, next: "3579", confirm: "3578" }, 400)).code, "PIN_MISMATCH");
  assert.equal((await va("pin/change", { current: VA_PIN, next: VA_PIN, confirm: VA_PIN }, 400)).code, "PIN_SAME");
  const ok = await va("pin/change", { current: VA_PIN, next: "3579", confirm: "3579" });
  assert.equal(ok.ok, true);
  assert.equal(ok.villageAdmin, true, "this phone stays logged in");
  assert.equal((await f.client()("login", { mobile: phone, secret: VA_PIN }, 401)).code, "WRONG_PIN");
  await f.client()("login", { mobile: phone, secret: "3579" });
  const reset = await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/reset", {});
  assert.equal((await f.client()("login", { mobile: phone, secret: "3579" }, 401)).code, "WRONG_PIN");
  const s = await f.client()("login", { mobile: phone, secret: reset.issuedPin.pin });
  assert.equal(s.account.mustSetPin, true);
});

test("backup roundtrip preserves governance and rejection records but strips credentials and requires fresh verification", async (t) => {
  const f = await fixture(t),
    guest = f.client();
  await f.ensureAdmin("Thorala");
  await guest("enrollment", example);
  const r = f.store.all("requests")[0];
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward);
  const b = await f.admin("admin/backup");
  assert.equal(b.schemaVersion, 2);
  assert.equal(b.villageAdmins[0].pass, undefined);
  const preview = await f.admin("admin/restore/validate", b);
  await f.admin("admin/restore", { backup: b, ...preview });
  assert.equal(f.store.get("requests", r.id).verification, undefined);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
});

test("old access codes cannot be issued or redeemed", async (t) => {
  const f = await fixture(t);
  const member = await f.enroll(f.client(), example);
  await f.admin(
    `admin/members/${member.id}/recovery`,
    { identityVerified: true },
    410,
  );
  await f.client()(
    "member/recover",
    { phone: member.phone, code: "a".repeat(32) },
    410,
  );
  assert.equal(f.store.all("recoveries").length, 0);
});

test("three-part names compose the stored full name and legacy names split once", async (t) => {
  const f = await fixture(t), u = f.client();
  const member = await f.enroll(u, {
    ...example,
    firstName: "Kishor",
    middleName: "Sinh",
    surname: "Chudasama",
    name: undefined,
    phone: "9000000011",
  });
  assert.equal(member.name, "Kishor Sinh Chudasama");
  assert.equal(member.firstName, "Kishor");
  assert.equal(member.middleName, "Sinh");
  assert.equal(member.surname, "Chudasama");
  const legacy = await f.enroll(f.client(), {
    ...example,
    name: "Legacy Three Token",
    phone: "9000000012",
  });
  assert.equal(legacy.firstName, "Legacy");
  assert.equal(legacy.middleName, "Three");
  assert.equal(legacy.surname, "Token");
});

test("village administrators correct applicant details before forwarding; corrections stay village-scoped", async (t) => {
  const f = await fixture(t), applicant = f.client();
  await f.ensureAdmin("Thorala");
  await f.ensureAdmin("Sathra");
  await applicant("enrollment", example);
  const r = f.store.all("requests")[0];
  const va = f.va("થોરાળા");
  await f.va("સથરા")(`village/requests/${r.id}/correct`, {
    firstName: "Corrected",
    surname: "Applicant",
    phone: example.phone,
    reason: "Out of scope attempt",
  }, 403);
  await va(`village/requests/${r.id}/correct`, {
    firstName: "Corected",
    middleName: "",
    surname: "AplecANT",
    phone: example.phone,
    phone2: "",
    label2: "work",
    currentLocation: "Fixed address",
  });
  let payload = f.store.get("requests", r.id).payload;
  assert.equal(payload.firstName, "Corected");
  assert.equal(payload.surname, "AplecANT");
  assert.equal(payload.currentLocation, "Fixed address");
  assert.equal(f.store.get("requests", r.id).corrections.length, 1);
  await va(`village/requests/${r.id}/forward`, forward);
  await va(`village/requests/${r.id}/correct`, {
    firstName: "Late",
    surname: "Edit",
    phone: example.phone,
  }, 409);
  await f.admin(`admin/requests/${r.id}/correct`, {
    firstName: "Corrected",
    middleName: "",
    surname: "Applicant",
    phone: example.phone,
    phone2: "",
    label2: "work",
  });
  payload = f.store.get("requests", r.id).payload;
  assert.equal(payload.name, "Corrected Applicant");
  await f.admin(`admin/requests/${r.id}/approve`, {});
  const member = f.store.all("members").find((m) => m.phone === example.phone);
  assert.equal(member.name, "Corrected Applicant");
  assert.equal(member.surname, "Applicant");
});

test("main administrator may move a request to another village, restarting verification", async (t) => {
  const f = await fixture(t), applicant = f.client();
  await f.ensureAdmin("Thorala");
  await f.ensureAdmin("Sathra");
  await applicant("enrollment", example);
  const r = f.store.all("requests")[0];
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/correct`, {
    firstName: "Moved",
    middleName: "",
    surname: "Member",
    phone: example.phone,
    phone2: "",
    label2: "work",
    village: "સથરા",
  });
  const moved = f.store.get("requests", r.id);
  assert.equal(moved.payload.village, "સથરા");
  assert.equal(moved.verification, undefined);
  assert.equal(moved.reviewHistory.length, 1);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await f.va("સથરા")(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {});
});

test("Village Admin create, edit, disable and reset need no reason; edits keep the TEMP PIN private", async (t) => {
  const f = await fixture(t);
  const g = encodeURIComponent("થોરાળા");
  const created = await f.admin("admin/village-admins/" + g + "/create", { name: "Thorala Admin Person", mobile: "7990000077" });
  assert.equal(created.issuedPin.kind, "village-admin");
  assert.equal(created.issuedPin.villageEn, "Thorala");
  let s = await f.admin("state");
  const row = s.villageAssignments.find((a) => a.id === "થોરાળા");
  assert.deepEqual([row.name, row.phone, row.mustSetPin, !!row.disabled], ["Thorala Admin Person", "7990000077", true, false]);
  // Owner decision: the Main Admin sees it again ONLY as the card's tempPin
  // (until first login); nowhere else in the state.
  assert.equal(row.tempPin, created.issuedPin.pin);
  const { tempPin, ...rest } = row;
  assert.equal(JSON.stringify({ ...s, villageAssignments: [rest] }).includes(created.issuedPin.pin + '"'), false, "not leaked elsewhere");
  void tempPin;
  s = await f.admin("admin/village-admins/" + g + "/edit", { name: "Thorala Admin Renamed", mobile: "7990000078" });
  assert.equal(s.villageAssignments.find((a) => a.id === "થોરાળા").phone, "7990000078");
  assert.equal((await f.admin("admin/village-admins/" + g + "/edit", { name: "Xx Yy Zz", mobile: MAIN.mobile }, 409)).code, "PHONE_IN_USE");
  await f.admin("admin/village-admins/" + g + "/disable", {});
  assert.equal((await f.admin("state")).villages.find((v) => v.gu === "થોરાળા").hasAdmin, false);
  await f.admin("admin/village-admins/" + g + "/enable", {});
  const fresh = f.client();
  const reset = await f.admin("admin/village-admins/" + g + "/reset", {});
  await f.firstLogin(fresh, "7990000078", reset.issuedPin.pin, "5802");
  assert.equal((await fresh("state")).villageAdmin, true);
  assert.equal((await f.admin("admin/village-admins/" + encodeURIComponent("નથી") + "/create", { name: "X Y", mobile: "7990000079" }, 404)).error, "Village not found");
});

test("the all-admins directory lists contactable administrators for everyone", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const guest = f.client();
  const directory = (await guest("state")).adminDirectory;
  // The Main Admin's contact comes from the seeded account.
  assert.equal(directory.main.name, MAIN.name);
  assert.equal(directory.main.phone, MAIN.mobile);
  const thorala = directory.villages.find((v) => v.village === "થોરાળા");
  assert.match(thorala.admin.name, /^Administrator/);
  assert.equal(thorala.admin.phone, "7991000000");
  const sathra = directory.villages.find((v) => v.village === "સથરા");
  assert.equal(sathra.admin, null);
});

test("the ઝીંજકા → જીંજકા rename migrates existing databases and old backups", async (t) => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { Store, applyVillageRenames } = await import("../server/store.mjs");
  const dir = mkdtempSync(join(tmpdir(), "rename-"));
  const path = join(dir, "community.sqlite");
  try {
    // A database that still carries the old spelling everywhere.
    const old = new Store(path);
    old.tx(() => {
      old.del("villages", "જીંજકા");
      old.put("villages", { id: "ઝીંજકા", gu: "ઝીંજકા", en: "Zinzaka", order: 6 });
      old.put("members", {
        id: "m-rename",
        name: "Hardik Makwana",
        nameGu: "હાર્દિક મકવાણા",
        phone: "9003000009",
        village: "ઝીંજકા",
      });
      old.put("requests", {
        id: "r-rename",
        kind: "new",
        payload: { name: "Applicant", phone: "9003000099", village: "ઝીંજકા" },
      });
      old.put("villageAdmins", { id: "ઝીંજકા", memberId: "m-rename" });
      old.del("config", "village-rename-jinjaka-v1");
    });
    old.db.close();

    // Reopening runs the migration.
    const migrated = new Store(path);
    assert.equal(migrated.get("villages", "ઝીંજકા"), null);
    assert.deepEqual(migrated.get("villages", "જીંજકા").en, "Jinjaka");
    assert.equal(migrated.get("members", "m-rename").village, "જીંજકા");
    assert.equal(
      migrated.get("requests", "r-rename").payload.village,
      "જીંજકા",
    );
    assert.ok(migrated.get("villageAdmins", "જીંજકા"));
    assert.equal(migrated.get("villageAdmins", "ઝીંજકા"), null);
    migrated.db.close();

    // Old backups normalize too, and member names are never touched.
    const backup = {
      village: "ઝીંજકા",
      nested: [{ en: "Zinzaka", note: "Zinzaka village" }],
    };
    applyVillageRenames(backup);
    assert.equal(backup.village, "જીંજકા");
    assert.equal(backup.nested[0].en, "Jinjaka");
    assert.equal(backup.nested[0].note, "Zinzaka village");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("village administrators forward a corrected request without any reason", async (t) => {
  const f = await fixture(t),
    guest = f.client();
  await f.ensureAdmin("Thorala");
  await guest("enrollment", example);
  const r = f.store.all("requests")[0];
  // Correction first, then a plain forward — no reason field exists anymore.
  await f.va("થોરાળા")(`village/requests/${r.id}/correct`, {
    firstName: "Corrected",
    surname: "Applicant",
    phone: example.phone,
  });
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, {
    identityConfirmed: true,
  });
  const forwarded = f.store.get("requests", r.id);
  assert.equal(forwarded.verification.memberId !== undefined, true);
  assert.equal(forwarded.verification.reason, undefined);
  assert.equal(forwarded.payload.name, "Corrected Applicant");
  // The main administrator approves without a reason too.
  await f.admin(`admin/requests/${r.id}/approve`, {
    identityConfirmed: true,
  });
  assert.equal(
    f.store.all("members").some((m) => m.name === "Corrected Applicant"),
    true,
  );
});
