import { randomUUID } from "node:crypto";
import { fail, publicProfile, profile, nameParts, memberRecord } from "./store.mjs";
import {
  mainAdminId,
  mobileDigits,
  isMobile,
} from "./auth.mjs";

// Village Admins are delegated, village-scoped reviewers created only by the
// Main Admin (Section 3). They log in with their mobile number like every member; their
// authority is re-checked live on every request (a disabled admin loses it at
// once).
// Joining requests, village moves and mobile-number changes all pass through
// the village administrator first. A village administrator's own record is
// decided by the main administrator directly (nobody can verify themselves).
export const numbersChanged = (r) =>
  r.kind === "update" &&
  (r.old.phone !== r.payload.phone ||
    (r.old.phone2 || "") !== (r.payload.phone2 || ""));
export const needsVerification = (r) =>
  r.kind === "new" ||
  (r.kind === "update" &&
    (r.old.village !== r.payload.village ||
      (!r.selfAdmin && numbersChanged(r))));
// A request for a village that has no ACTIVE Village Admin is decided by the
// Main Admin directly instead of waiting forever.
export const activeAssignment = (store, village) => {
  const a = store.get("villageAdmins", village);
  return a && !a.disabled ? a : null;
};
const mainDecides = (store, r) =>
  (r.kind === "update" || r.kind === "new") &&
  !activeAssignment(store, r.payload.village);

export function decisionReason(value) {
  if (
    typeof value !== "string" ||
    value.trim().length < 5 ||
    value.trim().length > 500 ||
    /[\u0000-\u001f]/.test(value)
  )
    fail("કારણ લખો (5–500 અક્ષર) · Enter a reason (5–500 characters)");
  return value.trim();
}

const cleanText = (value, min, max, label) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\u0000-\u001f<>]/.test(value)
  )
    fail("Invalid " + label);
  return value.trim();
};

// The logged-in Village Admin in admin mode (see server/auth.mjs).
export function activeAdminMember(store, req) {
  const m = req.villageAdminMember;
  if (!m) return null;
  const a = activeAssignment(store, m.village);
  return a && a.memberId === m.id ? m : null;
}

export function villageState(store, req) {
  const vaMember = req.isAdmin ? null : activeAdminMember(store, req);
  const queue = store.all("requests").filter(needsVerification);
  const describe = ({ owner, ...r }) => ({
    ...r,
    payload: publicProfile(r.payload),
    old: r.old ? publicProfile(r.old) : undefined,
    stage: r.verification || mainDecides(store, r) ? "main" : "village",
    hasVillageAdmin: !!activeAssignment(store, r.payload.village),
    existingMember: req.isAdmin
      ? store.all("members").find((m) => m.phone === r.payload.phone)?.id
      : undefined,
    archiveMatches: req.isAdmin
      ? store
          .all("archive")
          .filter((a) =>
            [a.phone, a.phone2, ...(a.numbers || [])].some(
              (n) => n && [r.payload.phone, r.payload.phone2].includes(n),
            ),
          )
          .map((a) => ({ id: a.id, name: a.name, phone: a.phone }))
      : undefined,
  });
  const own = queue.find((r) => r.owner === req.session.owner && r.kind === "new");
  const closed = store
    .all("rejections")
    .flatMap((r) => r.events || [])
    .filter((e) => e.owner === req.session.owner)
    .sort((a, b) => b.at - a.at)[0];
  return {
    villages: store
      .all("villages")
      .sort((a, b) => a.order - b.order)
      .map((v) => ({
        ...v,
        hasAdmin: !!activeAssignment(store, v.gu),
      })),
    villageAdmin: !!vaMember,
    villageAdminName: vaMember ? vaMember.nameGu || vaMember.name : null,
    villageAdminNameEn: vaMember ? vaMember.name : null,
    villageAdminVillage: vaMember ? vaMember.village : null,
    adminDirectory: {
      main: (() => {
        const m = store.get("members", mainAdminId(store));
        return m ? { name: m.nameGu || m.name, nameGu: m.nameGu || m.name, nameEn: m.name, phone: m.phone } : null;
      })(),
      villages: store
        .all("villages")
        .sort((a, b) => a.order - b.order)
        .map((v) => {
          const a = activeAssignment(store, v.gu);
          const m = a && store.get("members", a.memberId);
          return {
            village: v.gu,
            villageEn: v.en,
            admin: m
              ? {
                  name: m.name,
                  nameGu: m.nameGu || m.name,
                  phone: m.phone,
                  location: m.currentLocation || "",
                  locationEn: m.currentLocationEn || m.currentLocation || "",
                  locationGu: m.currentLocationGu || m.currentLocation || "",
                }
              : null,
          };
        }),
    },
    reviewQueue: req.isAdmin
      ? queue.map(describe)
      : vaMember
        ? queue
            .filter(
              (r) => r.payload.village === vaMember.village && !r.verification,
            )
            .map(describe)
        : [],
    villageProposals: vaMember
      ? store
          .all("requests")
          .filter(
            (r) =>
              (r.kind === "update" || r.kind === "delete") &&
              r.old?.village === vaMember.village,
          )
          .map((r) => ({
            id: r.id,
            kind: r.kind,
            memberId: r.memberId,
            reason: r.reason,
            villageChange: r.kind === "update",
          }))
      : [],
    villageAssignments: req.isAdmin
      ? store.all("villageAdmins").map(({ pass, ...a }) => {
          const m = store.get("members", a.memberId);
          return {
            ...a,
            name: m?.name || "",
            nameGu: m?.nameGu || "",
            phone: m?.phone || "",
          };
        })
      : [],
    rejectedApplications: req.isAdmin ? store.all("rejections") : [],
    applicationStage: own ? (own.verification ? "main" : "village") : null,
    lastDecision:
      !own && closed
        ? { action: closed.action, reason: closed.reason, at: closed.at }
        : null,
  };
}

export function assertVerified(store, r) {
  if (!needsVerification(r) || mainDecides(store, r)) return;
  const a = store.get("villageAdmins", r.payload.village);
  if (
    !r.verification ||
    !a ||
    a.disabled ||
    a.memberId !== r.verification.memberId ||
    a.version !== r.verification.assignmentVersion
  ) {
    const va = a && !a.disabled ? store.get("members", a.memberId) : null;
    fail(
      "પહેલા ગામના એડમિનની ચકાસણી જરૂરી છે · Village verification is required first" +
        (va ? ` (${va.name}, ${va.phone})` : ""),
      409,
      "VERIFY_FIRST",
      {
        info: {
          village: r.payload.village,
          admin: va ? { name: va.name, nameGu: va.nameGu, phone: va.phone } : null,
        },
      },
    );
  }
  const verifier = store.get("members", a.memberId);
  if (
    !verifier ||
    verifier.village !== r.payload.village ||
    verifier.owner === r.owner ||
    verifier.phone === r.payload.phone
  )
    fail("Independent village verification required", 409);
}

const resetStaged = (store, village) => {
  for (const r of store
    .all("requests")
    .filter((r) => needsVerification(r) && r.payload.village === village)) {
    if (r.verification) {
      r.reviewHistory = [...(r.reviewHistory || []), r.verification];
      delete r.verification;
      store.put("requests", r);
    }
  }
};

// Section 3: create a Village Admin (Main Admin only). The person becomes an
// approved member of that village if they are not one already, and gets a
// TEMP PIN for their first login. Shared by the endpoint, seed scripts and tests.
export function createVillageAdmin(
  store,
  { village, name, mobile, currentLocation = "", actor = "seed" },
) {
  const v =
    typeof village === "string"
      ? store.get("villages", village) ||
        store.all("villages").find((x) => x.en.toLowerCase() === village.toLowerCase())
      : village;
  if (!v) fail("Village not found", 404);
  if (activeAssignment(store, v.gu))
    fail("This village already has an active Village Admin", 409, "VILLAGE_TAKEN");
  const digits = mobileDigits(mobile);
  if (!isMobile(digits))
    fail("Enter a valid mobile number", 400, "MOBILE_FORMAT", { field: "mobile" });
  let m = store.all("members").find((x) => x.phone === digits);
  if (m && m.village !== v.gu)
    fail("This mobile number belongs to a member of another village", 409, "MEMBER_OTHER_VILLAGE", { field: "mobile" });
  if (m && m.id === mainAdminId(store))
    fail("The Main Admin cannot be a Village Admin", 409, "FORBIDDEN", { field: "mobile" });
  if (
    !m &&
    (store.all("members").some((x) => x.phone2 === digits) ||
      store.all("requests").some((r) => r.payload?.phone === digits || r.payload?.phone2 === digits))
  )
    fail("This mobile number is already in use", 409, "PHONE_IN_USE", { field: "mobile" });
  if (!m) {
    const fullName = cleanText(name, 3, 120, "name");
    const parts = nameParts(fullName);
    const p = profile(
      {
        firstName: parts.firstName,
        middleName: parts.middleName,
        surname: parts.surname || parts.firstName,
        nameGu: fullName,
        phone: digits,
        village: v.gu,
        ...(currentLocation ? { currentLocation } : {}),
      },
      store.all("villages"),
    );
    m = {
      ...p,
      id: randomUUID(),
      owner: randomUUID(),
      createdAt: Date.now(),
      approvedAt: Date.now(),
      approvedBy: actor,
      consentAt: Date.now(),
      consentVersion: "village-admin-created-v1",
    };
  }
  store.put("members", m);
  store.put("villageAdmins", {
    id: v.gu,
    memberId: m.id,
    version: randomUUID(),
    assignedAt: Date.now(),
    assignedBy: actor,
    reason: "Created by the Main Admin",
  });
  store.audit(actor, "village-admin.create", m.id);
  resetStaged(store, v.gu);
  return {
    kind: "village-admin",
    memberId: m.id,
    name: m.name,
    nameGu: m.nameGu,
    phone: m.phone,
    village: v.gu,
    villageEn: v.en,
  };
}
// Older scripts call the previous name.
export const enrollAdministrator = (store, options) =>
  createVillageAdmin(store, { ...options, mobile: options.mobile ?? options.phone });

// Development/test helper: mark a staged request as village-verified exactly
// like the signed-in endpoint does. Production traffic always uses the endpoint.
export function forwardRequest(
  store,
  requestId,
  reason = "Seeded verification",
) {
  const r = store.get("requests", requestId);
  if (!r) fail("Request already processed", 409);
  const a = store.get("villageAdmins", r.payload.village);
  if (!a) fail("Village has no administrator", 409);
  const verifier = store.get("members", a.memberId);
  r.verification = {
    memberId: a.memberId,
    name: verifier?.nameGu || "Administrator",
    ...(verifier?.name && verifier.name !== verifier.nameGu
      ? { nameEn: verifier.name }
      : {}),
    assignmentVersion: a.version,
    at: Date.now(),
    ...(reason ? { reason } : {}),
  };
  store.put("requests", r);
  return r;
}

export function installVillageApproval(
  app,
  store,
  { admin, state, rate, notify = () => {} },
) {
  const villageLabel = (gu) => {
    const v = store.get("villages", gu);
    return { gu, en: v?.en || gu };
  };
  // ---- Section 3: Manage Village Admins (Main Admin only) ----------------
  const villageOf = (req) => {
    const v = store.get("villages", req.params.village);
    if (!v) fail("Village not found", 404);
    return v;
  };
  const assignmentOf = (v) => {
    const a = store.get("villageAdmins", v.gu);
    if (!a) fail("This village has no Village Admin", 404, "NO_VILLAGE_ADMIN");
    const m = store.get("members", a.memberId);
    if (!m) fail("Village Admin record is missing", 404, "NO_VILLAGE_ADMIN");
    return { a, m };
  };
  app.post("/api/admin/village-admins/:village/create", admin, (req, res) => {
    const v = villageOf(req);
    let issued;
    store.tx(() => {
      issued = createVillageAdmin(store, {
        village: v,
        name: req.body.name,
        mobile: req.body.mobile,
        actor: req.me.id,
      });
    });
    res.json({ ...state(req), created: issued });
  });
  app.post("/api/admin/village-admins/:village/edit", admin, (req, res) => {
    const v = villageOf(req);
    const { m } = assignmentOf(v);
    const fullName = cleanText(req.body.name, 3, 120, "name");
    const parts = nameParts(fullName);
    const digits = mobileDigits(req.body.mobile);
    if (!isMobile(digits))
      fail("Enter a valid mobile number", 400, "MOBILE_FORMAT", { field: "mobile" });
    const p = profile(
      {
        ...m,
        firstName: parts.firstName,
        middleName: parts.middleName,
        surname: parts.surname || parts.firstName,
        nameGu: m.nameGu === m.name ? fullName : m.nameGu,
        phone: digits,
      },
      store.all("villages"),
    );
    store.tx(() => {
      try {
        store.unique(p, m.owner);
      } catch {
        fail("This mobile number is already in use", 409, "PHONE_IN_USE", { field: "mobile" });
      }
      store.put("members", { ...m, ...p });
      store.audit(req.me.id, "village-admin.edit", v.gu);
    });
    res.json(state(req));
  });
  app.post("/api/admin/village-admins/:village/disable", admin, (req, res) => {
    const v = villageOf(req);
    const { a } = assignmentOf(v);
    store.tx(() => {
      store.put("villageAdmins", { ...a, disabled: true, disabledAt: Date.now(), disabledBy: req.me.id });
      store.audit(req.me.id, "village-admin.disable", v.gu);
    });
    res.json(state(req));
  });
  app.post("/api/admin/village-admins/:village/enable", admin, (req, res) => {
    const v = villageOf(req);
    const { a } = assignmentOf(v);
    store.tx(() => {
      const { disabled, disabledAt, disabledBy, ...rest } = a;
      store.put("villageAdmins", { ...rest, version: randomUUID() });
      resetStaged(store, v.gu);
      store.audit(req.me.id, "village-admin.enable", v.gu);
    });
    res.json(state(req));
  });
  // A village administrator may correct applicant details (spelling, numbers)
  // before forwarding; the correction is audited and never changes ownership.
  app.post("/api/village/requests/:id/correct", (req, res) => {
    const me = activeAdminMember(store, req);
    if (!me) fail("Village administrator sign-in required", 403);
    const r = store.get("requests", req.params.id);
    if (!r) fail("Request already processed", 409);
    if (r.kind !== "new" || r.verification)
      fail("Only unverified joining requests can be corrected here", 409);
    if (r.payload.village !== me.village)
      fail("This request belongs to another village", 403);
    if (r.owner === me.owner || r.payload.phone === me.phone)
      fail("You cannot correct your own request", 403);
    const p = profile(
      { ...req.body, village: r.payload.village },
      store.all("villages"),
    );
    store.unique(p, r.owner, undefined, true);
    store.tx(() => {
      r.corrections = [
        ...(r.corrections || []),
        { by: me.id, at: Date.now(), before: publicProfile(r.payload) },
      ];
      r.payload = p;
      store.put("requests", r);
      store.audit(me.id, "village.request.correct", r.id);
    });
    res.json(state(req));
  });

  app.post("/api/village/requests/:id/:action", (req, res) => {
    // Authority is checked before request lookup so ordinary sessions learn
    // nothing about which request identifiers exist.
    const me = activeAdminMember(store, req);
    if (!me) fail("Village administrator sign-in required", 403);
    const r = store.get("requests", req.params.id);
    if (!r) fail("Request already processed", 409);
    const assignment = store.get("villageAdmins", r.payload?.village);
    if (
      !assignment ||
      assignment.memberId !== me.id ||
      me.village !== r.payload.village
    )
      fail("Village administrator permission required", 403);
    if (!needsVerification(r) || r.verification)
      fail("Request is no longer in the village queue", 409);
    if (r.owner === me.owner || r.payload.phone === me.phone)
      fail("You cannot verify your own request", 403);
    const action = req.params.action;
    if (!["forward", "reject", "close"].includes(action))
      fail("Invalid decision");
    // Section 3: a rejection always carries a reason for the applicant.
    const reason =
      action === "reject"
        ? decisionReason(req.body.reason)
        : req.body.reason?.trim().slice(0, 500) || "";
    if (action === "forward" && req.body.identityConfirmed !== true)
      fail("Confirm independent identity verification");
    store.tx(() => {
      if (action === "forward") {
        r.verification = {
          memberId: me.id,
          name: me.nameGu || me.name,
          ...(me.name && me.name !== me.nameGu ? { nameEn: me.name } : {}),
          assignmentVersion: assignment.version,
          at: Date.now(),
          ...(reason ? { reason } : {}),
        };
        store.put("requests", r);
      } else {
        // Only joining applications enter the rejection ledger; a declined
        // change request leaves the member's record exactly as it was.
        if (r.kind === "new")
          store.rejectRequest(
            r,
            action,
            reason,
            me.id,
            "village",
            req.body.category,
          );
        store.del("requests", r.id);
      }
      store.audit(
        me.id,
        "village.request." + action + (reason ? ":" + reason : ""),
        r.id,
      );
    });
    const who = r.payload.nameGu || r.payload.name,
      whoEn = r.payload.name || who,
      place = villageLabel(r.payload.village);
    if (action === "forward") {
      notify("main", {
        kind: "forwarded",
        titleGu: r.kind === "new" ? "ગામ ચકાસણી પૂર્ણ · અંતિમ મંજૂરી બાકી" : "ફેરફાર ચકાસાયો · અંતિમ મંજૂરી બાકી",
        titleEn: r.kind === "new" ? "Village verified · final approval needed" : "Change verified · final approval needed",
        bodyGu: who + " · " + place.gu,
        bodyEn: whoEn + " · " + place.en,
      });
      notify("owner:" + r.owner, {
        kind: "stage",
        titleGu: "ગામના એડમિને ચકાસણી કરી",
        titleEn: "Your village administrator verified you",
        bodyGu: "હવે મુખ્ય એડમિનની મંજૂરી બાકી છે.",
        bodyEn: "Now waiting for the main administrator's approval.",
      });
    } else
      notify("owner:" + r.owner, {
        kind: "declined",
        titleGu: r.kind === "new" ? "વિનંતી સ્વીકારાઈ નથી" : "ફેરફાર સ્વીકારાયો નથી",
        titleEn: r.kind === "new" ? "Application not accepted" : "Change not accepted",
        bodyGu: reason || "વધુ માહિતી માટે ગામના એડમિનનો સંપર્ક કરો.",
        bodyEn: reason || "Contact your village administrator for details.",
      });
    res.json(state(req));
  });

  // Village administrators may PROPOSE member changes and removals; every
  // proposal becomes a request that only the main administrator can decide.
  const proposalGuards = (req, id) => {
    const me = activeAdminMember(store, req);
    if (!me) fail("Village administrator sign-in required", 403);
    const m = store.get("members", id);
    if (!m) fail("Member not found", 404);
    if (m.village !== me.village)
      fail("This member belongs to another village", 403);
    if (m.id === me.id)
      fail(
        "Ask the main administrator to change your own administrator record",
        409,
      );
    if (
      store
        .all("requests")
        .some(
          (r) => r.memberId === m.id && ["update", "delete"].includes(r.kind),
        )
    )
      fail("A change request is already pending for this member", 409);
    const reason = decisionReason(req.body.reason);
    if (req.body.identityConfirmed !== true)
      fail("Confirm you verified this change with the member");
    return { me, m, reason };
  };

  app.post("/api/village/members/:id/update", (req, res) => {
    const { me, m, reason } = proposalGuards(req, req.params.id);
    const p = profile(req.body, store.all("villages"));
    store.tx(() => {
      store.unique(p, m.owner);
      const r = {
        id: randomUUID(),
        owner: m.owner,
        kind: "update",
        memberId: m.id,
        old: memberRecord(m),
        payload: p,
        createdAt: Date.now(),
        proposedBy: me.id,
        reason,
      };
      // A number change proposed by this village's own administrator is
      // already the village verification; it goes straight to the main
      // administrator. A move to ANOTHER village still needs that village.
      const a = store.get("villageAdmins", me.village);
      if (needsVerification(r) && p.village === me.village && a)
        r.verification = {
          memberId: me.id,
          name: me.nameGu || me.name,
          ...(me.name && me.name !== me.nameGu ? { nameEn: me.name } : {}),
          assignmentVersion: a.version,
          at: Date.now(),
          reason,
        };
      store.put("requests", r);
      store.audit(me.id, "village.member.update-proposed:" + reason, m.id);
    });
    notify("main", {
      kind: "proposal",
      titleGu: "માહિતી બદલવાની સૂચના આવી",
      titleEn: "Change proposal received",
      bodyGu: (m.nameGu || m.name) + " · " + villageLabel(m.village).gu,
      bodyEn: m.name + " · " + villageLabel(m.village).en,
    });
    res.json(state(req));
  });

  app.post("/api/village/members/:id/delete", (req, res) => {
    const { me, m, reason } = proposalGuards(req, req.params.id);
    store.tx(() => {
      store.put("requests", {
        id: randomUUID(),
        owner: m.owner,
        kind: "delete",
        memberId: m.id,
        old: memberRecord(m),
        reason,
        createdAt: Date.now(),
        proposedBy: me.id,
      });
      store.audit(me.id, "village.member.delete-proposed:" + reason, m.id);
    });
    notify("main", {
      kind: "proposal",
      titleGu: "દૂર કરવાની સૂચના આવી",
      titleEn: "Removal proposal received",
      bodyGu: (m.nameGu || m.name) + " · " + villageLabel(m.village).gu,
      bodyEn: m.name + " · " + villageLabel(m.village).en,
    });
    res.json(state(req));
  });

  // Old codes can no longer grant access, including codes issued before migration.
  app.post(
    ["/api/member/recover", "/api/admin/members/:id/recovery"],
    (req, res) =>
      res.status(410).json({
        error:
          "Access codes retired. Submit a new application for village and main-admin review.",
      }),
  );
}
