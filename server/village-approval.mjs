import { randomUUID } from "node:crypto";
import {
  fail,
  publicProfile,
  profile,
  nameParts,
  passwordHash,
  passwordMatches,
  strong,
} from "./store.mjs";

// Village administrators are delegated, village-scoped reviewers. Their
// authority comes ONLY from an explicit phone+password sign-in, never from
// merely being the approved member, and is re-checked live on every request.
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
// A change request for a village that has no administrator (yet) is decided
// by the main administrator directly instead of waiting forever.
const mainDecides = (store, r) =>
  r.kind === "update" && !store.get("villageAdmins", r.payload.village);

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

// A sign-in stays valid for 12 hours; the live assignment is verified each use,
// so replacing or removing the administrator revokes active sessions too.
// The session also records the assignment version and password date at
// sign-in: re-assignment, a password change or reset, and restore all end
// existing village-administrator sessions immediately.
export function activeAdminMember(store, req) {
  const v = req.session.villageAdmin;
  if (!v || v.until <= Date.now()) return null;
  const m = store.get("members", v.memberId);
  if (!m) return null;
  const a = store.get("villageAdmins", m.village);
  return a &&
    a.memberId === m.id &&
    a.version === v.version &&
    a.passChangedAt === v.passChangedAt
    ? m
    : null;
}

export function villageState(store, req) {
  const vaMember = req.isAdmin ? null : activeAdminMember(store, req);
  const ownerMe = store
    .all("members")
    .find((m) => m.owner === req.session.owner);
  const queue = store.all("requests").filter(needsVerification);
  const describe = ({ owner, ...r }) => ({
    ...r,
    payload: publicProfile(r.payload),
    old: r.old ? publicProfile(r.old) : undefined,
    stage: r.verification || mainDecides(store, r) ? "main" : "village",
    hasVillageAdmin: !!store.get("villageAdmins", r.payload.village),
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
        hasAdmin: !!store.get("villageAdmins", v.gu),
      })),
    villageAdmin: !!vaMember,
    villageAdminName: vaMember ? vaMember.nameGu || vaMember.name : null,
    villageAdminVillage: vaMember ? vaMember.village : null,
    adminDirectory: {
      main: store.get("config", "main-admin-contact") || null,
      villages: store
        .all("villages")
        .sort((a, b) => a.order - b.order)
        .map((v) => {
          const a = store.get("villageAdmins", v.gu);
          const m = a && store.get("members", a.memberId);
          return {
            village: v.gu,
            villageEn: v.en,
            admin: m
              ? { name: m.name, phone: m.phone, location: m.currentLocation || "" }
              : null,
          };
        }),
    },
    villageAdminEligible:
      !req.isAdmin &&
      !vaMember &&
      !!ownerMe &&
      !!store.get("villageAdmins", ownerMe.village) &&
      store.get("villageAdmins", ownerMe.village).memberId === ownerMe.id,
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
      ? store.all("villageAdmins").map(({ pass, ...a }) => a)
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
    a.memberId !== r.verification.memberId ||
    a.version !== r.verification.assignmentVersion
  )
    fail(
      "પહેલા ગામના એડમિનની ચકાસણી જરૂરી છે · Village verification is required first",
      409,
    );
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

// Shared by the administrator endpoint and development seed scripts.
export function enrollAdministrator(
  store,
  {
    village,
    name,
    phone,
    currentLocation = "",
    pass,
    reason = "Seeded administrator",
    actor = "seed",
  },
) {
  const v =
    typeof village === "string" ? store.get("villages", village) : village;
  if (!v) fail("Village not found", 404);
  const fullName = cleanText(name, 3, 120, "name");
  const parts = nameParts(fullName);
  const digits = String(phone || "").replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(digits))
    fail("નંબર બરાબર લખો · Enter a valid 10-digit mobile number");
  if (
    store
      .all("members")
      .some((m) => m.phone === digits || m.phone2 === digits) ||
    store.all("requests").some((r) => r.payload?.phone === digits)
  )
    fail(
      "આ નંબર પહેલેથી નોંધાયેલ છે · This phone already has a profile or request",
      409,
    );
  const location =
    currentLocation === undefined || currentLocation === ""
      ? ""
      : cleanText(currentLocation, 0, 240, "current location");
  const p = {
    firstName: parts.firstName,
    middleName: parts.middleName,
    surname: parts.surname,
    name: fullName,
    nameGu: fullName,
    phone: digits,
    phone2: "",
    label2: "work",
    village: v.gu,
    tehsil: "મહુવા",
    district: "ભાવનગર",
    ...(location ? { currentLocation: location } : {}),
  };
  const memberId = randomUUID();
  store.put("members", {
    ...p,
    id: memberId,
    owner: randomUUID(),
    createdAt: Date.now(),
    approvedAt: Date.now(),
    approvedBy: actor,
    consentAt: Date.now(),
    consentVersion: "administrator-enrollment-v1",
  });
  store.put("villageAdmins", {
    id: v.gu,
    memberId,
    version: randomUUID(),
    assignedAt: Date.now(),
    assignedBy: actor,
    reason,
    username: digits,
    pass: passwordHash(pass),
    passChangedAt: Date.now(),
  });
  store.audit(actor, "village-admin.enroll:" + reason, memberId);
  return memberId;
}
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

const credential = (pass) => {
  if (!strong(pass))
    fail(
      "મજબૂત પાસવર્ડ જરૂરી (10+ અક્ષર, મોટા-નાના અક્ષર, આંકડો, ચિહ્ન) · Choose a strong password (10+ characters, upper/lowercase, digit, symbol)",
    );
  return pass;
};

export function installVillageApproval(
  app,
  store,
  { admin, state, rate, notify = () => {}, clientKey, knownClient, issuePinReset },
) {
  const villageLabel = (gu) => {
    const v = store.get("villages", gu);
    return { gu, en: v?.en || gu };
  };
  // Enrolling the first administrators is a main-administrator trust decision:
  // the person is created as an approved member WITH credentials in one step.
  app.post("/api/admin/village-admins/:village", admin, (req, res) => {
    const village = store.get("villages", req.params.village);
    if (!village) fail("Village not found", 404);
    const reason = req.body.reason?.trim() || "Administrator change";
    if (req.body.reason?.trim()) decisionReason(req.body.reason);
    if (req.body.identityConfirmed !== true)
      fail("Confirm identity in person before appointment");
    store.tx(() => {
      if (req.body.memberId === null) {
        store.del("villageAdmins", village.gu);
        resetStaged(store, village.gu);
        store.audit(
          req.session.owner,
          "village-admin.remove:" + reason,
          village.gu,
        );
      } else if (req.body.memberId !== undefined) {
        const m = store.get("members", req.body.memberId);
        if (!m || m.village !== village.gu)
          fail("Choose an approved member of this village");
        const previous = store.get("villageAdmins", village.gu);
        if (previous && previous.memberId === m.id)
          fail("This member already administers the village", 409);
        store.put("villageAdmins", {
          id: village.gu,
          memberId: m.id,
          version: randomUUID(),
          assignedAt: Date.now(),
          assignedBy: req.session.owner,
          reason,
          username: m.phone,
          pass: passwordHash(credential(req.body.pass)),
          passChangedAt: Date.now(),
        });
        resetStaged(store, village.gu);
        store.audit(
          req.session.owner,
          "village-admin.assign:" + reason,
          village.gu,
        );
      } else {
        enrollAdministrator(store, {
          village,
          name: req.body.name,
          phone: req.body.phone,
          currentLocation: req.body.currentLocation,
          pass: credential(req.body.pass),
          reason,
          actor: req.session.owner,
        });
        // Requests forwarded by the previous administrator return to the
        // village queue for the new administrator (never stuck).
        resetStaged(store, village.gu);
      }
    });
    res.json(state(req));
  });

  app.post("/api/admin/village-admins/:village/password", admin, (req, res) => {
    const village = store.get("villages", req.params.village);
    if (!village) fail("Village not found", 404);
    const a = store.get("villageAdmins", village.gu);
    if (!a) fail("This village has no administrator", 409);
    const reason = req.body.reason?.trim() || "Password reset";
    if (req.body.reason?.trim()) decisionReason(req.body.reason);
    if (req.body.identityConfirmed !== true)
      fail("Confirm identity in person before resetting the password");
    store.tx(() => {
      a.pass = passwordHash(credential(req.body.pass));
      a.passChangedAt = Date.now();
      store.put("villageAdmins", a);
      store.audit(
        req.session.owner,
        "village-admin.password:" + reason,
        village.gu,
      );
    });
    res.json(state(req));
  });

  // Separate sign-in for village administrators. The hidden sun-tap gate and
  // the main password never appear on this path.
  app.post("/api/village/login", (req, res) => {
    rate("village-login:" + req.session.id, 10, 900000);
    const phone = String(req.body.phone || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phone))
      fail("નંબર બરાબર લખો · Enter a valid 10-digit mobile number");
    // Wrong passwords are limited per number AND per client, so a stranger
    // cannot lock a real administrator out from another network.
    const phoneKey =
      "village-login-phone:" +
      phone +
      ":" +
      (knownClient(req) ? clientKey(req) : req.session.id);
    const blocked = (key, max) => (store.get("limits", key)?.until > Date.now() && store.get("limits", key).count >= max);
    if (blocked(phoneKey, 5) || blocked("village-login-phone:" + phone, 100))
      fail("ઘણા પ્રયાસો થયા · Too many attempts. Please try again later.", 429);
    // The administrator signs in with their CURRENT member number, so an
    // approved number change moves the sign-in with it.
    const a = store.all("villageAdmins").find((x) => {
      const m = store.get("members", x.memberId);
      return m ? m.phone === phone : x.username === phone;
    });
    const attempt = String(req.body.pass ?? "");
    // Always burn a hash comparison so timing does not reveal enrollments.
    const matches = passwordMatches(
      attempt,
      a?.pass || "00000000000000000000000000000000:" + "0".repeat(128),
    );
    const m = a && matches ? store.get("members", a.memberId) : null;
    if (!m || m.village !== a.id) {
      try {
        rate(phoneKey, 1e9);
        rate("village-login-phone:" + phone, 1e9, 3600000);
      } catch {}
      fail(
        "ગામ એડમિન સાઇન ઇન નિષ્ફળ · Village administrator sign-in failed",
        401,
      );
    }
    req.rotateSession();
    store.tx(() => {
      req.session.villageAdmin = {
        memberId: m.id,
        until: Date.now() + 12 * 3600000,
        version: a.version,
        passChangedAt: a.passChangedAt,
      };
      // Notifications continue after the 12-hour sign-in ends, until the
      // administrator signs out or the assignment/password changes.
      req.session.villageNotify = {
        village: a.id,
        memberId: m.id,
        version: a.version,
        passChangedAt: a.passChangedAt,
      };
      store.put("sessions", req.session);
      store.audit(m.id, "village.login", a.id);
    });
    res.json(state(req));
  });

  app.post("/api/village/logout", (req, res) => {
    if (req.session.villageAdmin) {
      store.tx(() => {
        delete req.session.villageAdmin;
        delete req.session.villageNotify;
        store.put("sessions", req.session);
        store.audit(req.session.owner, "village.logout", req.session.owner);
      });
    }
    res.json(state(req));
  });

  app.post("/api/village/password", (req, res) => {
    const me = activeAdminMember(store, req);
    if (!me) fail("Village administrator sign-in required", 403);
    const a = store.get("villageAdmins", me.village);
    if (!a || !passwordMatches(String(req.body.current ?? ""), a.pass))
      fail(
        "ગામ એડમિન સાઇન ઇન નિષ્ફળ · Village administrator sign-in failed",
        401,
      );
    store.tx(() => {
      a.pass = passwordHash(credential(req.body.next));
      a.passChangedAt = Date.now();
      store.put("villageAdmins", a);
      // Other devices signed in with the old password are signed out; this
      // device continues with the new password date.
      req.session.villageAdmin.passChangedAt = a.passChangedAt;
      if (req.session.villageNotify)
        req.session.villageNotify.passChangedAt = a.passChangedAt;
      store.put("sessions", req.session);
      store.audit(me.id, "village.password", a.id);
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
    const reason = req.body.reason?.trim().slice(0, 500) || "";
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
        old: m,
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
        old: m,
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

  // Forgotten app PIN: after confirming the member by phone, the village
  // administrator creates a one-time code and reads it to them.
  app.post("/api/village/members/:id/pin-reset", (req, res) => {
    const me = activeAdminMember(store, req);
    if (!me) fail("Village administrator sign-in required", 403);
    const m = store.get("members", req.params.id);
    if (!m) fail("Member not found", 404);
    if (m.village !== me.village)
      fail("This member belongs to another village", 403);
    if (m.id === me.id)
      fail("Ask the main administrator for your own reset code", 409);
    if (req.body.identityConfirmed !== true)
      fail("Confirm you spoke with this member first");
    rate("pin-reset-issue:" + me.id, 20, 3600000);
    issuePinReset(req, res, m, me.id, "village");
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
