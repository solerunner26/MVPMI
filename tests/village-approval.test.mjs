import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example, VA_PASS } from "./helpers.mjs";

const reason = "Known personally in this village";
const forward = { reason, identityConfirmed: true };

test("applications stay closed until the main administrator enrolls a village administrator", async (t) => {
  const f = await fixture(t),
    guest = f.client();
  const blocked = await guest("enrollment", example, 409);
  assert.match(blocked.error, /This village has no administrator yet/);
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા"), {
    name: "Thorala Administrator",
    phone: "7990000010",
    pass: "Village@2026!",
    reason,
    identityConfirmed: true,
  });
  await guest("enrollment", example);
  assert.equal((await guest("state")).applicationStage, "village");
  const r = f.store.all("requests")[0];
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await guest(`village/requests/${r.id}/forward`, forward, 403);
});

test("village administrators sign in separately and member sessions hold no admin power", async (t) => {
  const f = await fixture(t),
    anyone = f.client();
  await f.ensureAdmin("Thorala");
  const assignment = f.store.get("villageAdmins", "થોરાળા");
  const applicant = f.client();
  await applicant("enrollment", { ...example, phone: "9000000002" });
  const r = f.store.all("requests")[0];
  await anyone(
    "village/login",
    { phone: assignment.username, pass: "Wrong@2026" },
    401,
  );
  await anyone("village/login", { phone: "8000000000", pass: VA_PASS }, 401);
  await anyone("village/login", { phone: assignment.username, pass: VA_PASS });
  assert.equal((await anyone("state")).villageAdmin, true);
  assert.match((await anyone("state")).villageAdminName, /^Administrator/);
  // Signed-in administrator acts only on their own village queue.
  await anyone(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {});
  await anyone("village/logout", {});
  assert.equal((await anyone("state")).villageAdmin, false);
  // A member who is later appointed administrator gains no power in their own
  // browser session; they must use the separate administrator sign-in.
  const memberSession = f.client();
  await memberSession("enrollment", { ...example, phone: "9000000003" });
  const own = f.store
    .all("requests")
    .find((x) => x.payload.phone === "9000000003");
  const va2 = f.client();
  await va2("village/login", { phone: assignment.username, pass: VA_PASS });
  await va2(`village/requests/${own.id}/forward`, forward);
  await f.admin(`admin/requests/${own.id}/approve`, {});
  const appointed = f.store
    .all("members")
    .find((m) => m.phone === "9000000003");
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા"), {
    memberId: appointed.id,
    pass: VA_PASS,
    reason,
    identityConfirmed: true,
  });
  assert.equal((await va2("state")).villageAdmin, false);
  const state = await memberSession("state");
  assert.equal(state.villageAdmin, false);
  assert.equal(state.villageAdminEligible, true);
  assert.deepEqual(state.reviewQueue, []);
  const later = f.client();
  await later("enrollment", { ...example, phone: "9000000008" });
  const laterRequest = f.store
    .all("requests")
    .find((x) => x.payload.phone === "9000000008");
  await memberSession(
    `village/requests/${laterRequest.id}/forward`,
    forward,
    403,
  );
  const va3 = f.client();
  await va3("village/login", { phone: appointed.phone, pass: VA_PASS });
  await va3(`village/requests/${laterRequest.id}/forward`, forward);
  await f.admin(`admin/requests/${laterRequest.id}/approve`, {});
});

test("local rejection works without a reason, retains phone and decision, never enters removed-members archive", async (t) => {
  const f = await fixture(t),
    guest = f.client();
  await f.ensureAdmin("Thorala");
  await guest("enrollment", example);
  let r = f.store.all("requests")[0];
  // Reasons and categories are no longer collected from administrators.
  await f.va("થોરાળા")(`village/requests/${r.id}/reject`, {});
  const main = await f.admin("state");
  assert.equal(main.rejectedApplications[0].phone, example.phone);
  assert.equal(main.archive.length, 0);
  assert.equal((await guest("state")).lastDecision.action, "reject");
  assert.deepEqual((await f.va("થોરાળા")("state")).rejectedApplications, []);
  await guest("enrollment", example);
  r = f.store.all("requests")[0];
  await f.va("થોરાળા")(`village/requests/${r.id}/close`, {
    reason: "Applicant withdrew the request",
    category: "other",
  });
  assert.equal(f.store.all("rejections").length, 1);
  assert.equal(f.store.all("rejections")[0].events.length, 2);
});

test("reassignment revokes authority immediately and invalidates outstanding verification", async (t) => {
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
  const r = f.store
    .all("requests")
    .find((x) => x.payload.phone === "9000000004");
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward);
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા"), {
    memberId: next.id,
    pass: "Village@2026!",
    reason,
    identityConfirmed: true,
  });
  assert.equal((await f.va("થોરાળા")("state")).villageAdmin, false);
  await f.admin(`admin/requests/${r.id}/approve`, {}, 409);
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward, 403);
  const fresh = f.client();
  await fresh(
    "village/login",
    { phone: "9000000004", pass: "Village@2026!" },
    401,
  );
  await fresh(
    "village/login",
    { phone: example.phone, pass: "Village@2026!" },
    401,
  );
  await fresh("village/login", { phone: next.phone, pass: "Village@2026!" });
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
  const assignment = f.store.get("villageAdmins", "થોરાળા");
  // The administrator's phone can be claimed on a new device, but only the
  // main administrator can complete such a replacement.
  await f.va("થોરાળા")("enrollment", {
    ...example,
    phone: assignment.username,
  });
  const own = f.store
    .all("requests")
    .find((x) => x.payload.phone === assignment.username);
  await f.va("થોરાળા")(`village/requests/${own.id}/forward`, forward, 403);
});

test("only main admin adds villages; villages without administrators cannot receive applications", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  await f.va("થોરાળા")(
    "admin/villages",
    { gu: "નવું ગામ", en: "New Village" },
    403,
  );
  await f.admin("admin/villages", { gu: "નવું ગામ", en: "New Village" });
  assert.equal((await f.client()("state")).villages.length, 8);
  await f.admin("admin/villages", { gu: "નવું ગામ", en: "Other name" }, 409);
  const guest = f.client();
  await guest(
    "enrollment",
    { ...example, village: "New Village", currentLocation: "Adajan, Surat" },
    409,
  );
  await f.ensureAdmin("New Village");
  await guest("enrollment", {
    ...example,
    village: "New Village",
    currentLocation: "Adajan, Surat",
  });
  const r = f.store
    .all("requests")
    .find((x) => x.payload.currentLocation === "Adajan, Surat");
  await f.va("નવું ગામ")(`village/requests/${r.id}/forward`, forward);
  await f.admin(`admin/requests/${r.id}/approve`, {});
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

test("new device gets no automatic access; verified replacement revokes the previous owner", async (t) => {
  const f = await fixture(t),
    old = f.client();
  const member = await f.enroll(old, example);
  const fresh = f.client();
  await fresh("enrollment", example);
  const r = f.store.all("requests")[0];
  assert.deepEqual((await fresh("state")).members, []);
  await f.va("થોરાળા")(`village/requests/${r.id}/forward`, forward);
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

test("village admin passwords can be changed by the admin and reset by the main administrator", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const assignment = f.store.get("villageAdmins", "થોરાળા");
  const va = f.va("થોરાળા");
  await va(
    "village/password",
    { current: "Wrong@2026", next: "Newer@2026!" },
    401,
  );
  await va("village/password", { current: VA_PASS, next: "weak" }, 400);
  await va("village/password", { current: VA_PASS, next: "Newer@2026!" });
  const afterChange = f.client();
  await afterChange(
    "village/login",
    { phone: assignment.username, pass: VA_PASS },
    401,
  );
  await afterChange("village/login", {
    phone: assignment.username,
    pass: "Newer@2026!",
  });
  await f.admin(
    "admin/village-admins/" + encodeURIComponent("થોરાળા") + "/password",
    {
      pass: "Reset@2026!",
      reason,
      identityConfirmed: true,
    },
  );
  const afterReset = f.client();
  await afterReset(
    "village/login",
    { phone: assignment.username, pass: "Newer@2026!" },
    401,
  );
  await afterReset("village/login", {
    phone: assignment.username,
    pass: "Reset@2026!",
  });
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

test("administrator changes and password resets no longer require a reason", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  const replacement = f.client();
  const next = await f.enroll(replacement, { ...example, name: "Reasonless Replacement", phone: "9000000013" });
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા"), {
    memberId: next.id,
    pass: "Village@2026!",
    identityConfirmed: true,
  });
  const assignment = f.store.get("villageAdmins", "થોરાળા");
  assert.equal(assignment.memberId, next.id);
  await f.admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/password", {
    pass: "Reset@2026!",
    identityConfirmed: true,
  });
  const fresh = f.client();
  await fresh("village/login", { phone: next.phone, pass: "Reset@2026!" });
});

test("the all-admins directory lists contactable administrators for everyone", async (t) => {
  const f = await fixture(t);
  await f.ensureAdmin("Thorala");
  await f.admin("admin/main-admin-contact", {
    name: "Main Administrator",
    phone: "9000000000",
  });
  const guest = f.client();
  const directory = (await guest("state")).adminDirectory;
  assert.equal(directory.main.name, "Main Administrator");
  assert.equal(directory.main.phone, "9000000000");
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
