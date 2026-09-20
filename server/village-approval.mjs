import { randomUUID } from "node:crypto";
import { fail, publicProfile, profile } from "./store.mjs";
export const needsVerification = (r) =>
  r.kind === "new" ||
  (r.kind === "update" && r.old.village !== r.payload.village);
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
export function villageState(store, req) {
  const me = store.all("members").find((m) => m.owner === req.session.owner);
  const assignments = me
    ? store.all("villageAdmins").filter((a) => a.memberId === me.id)
    : [];
  const localVillages = new Set(assignments.map((a) => a.id));
  const queue = store.all("requests").filter((r) => needsVerification(r));
  const describe = (r) => ({
    ...r,
    payload: publicProfile(r.payload),
    old: r.old ? publicProfile(r.old) : undefined,
    stage: r.verification ? "main" : "village",
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
  const own = queue.find((r) => r.owner === req.session.owner);
  const closed = store
    .all("rejections")
    .flatMap((r) => r.events || [])
    .filter((e) => e.owner === req.session.owner)
    .sort((a, b) => b.at - a.at)[0];
  return {
    villages: store.all("villages").sort((a, b) => a.order - b.order),
    villageAdmin: assignments.length > 0,
    reviewQueue: req.isAdmin
      ? queue.map(describe)
      : queue
          .filter(
            (r) => localVillages.has(r.payload.village) && !r.verification,
          )
          .map(describe),
    villageAssignments: req.isAdmin ? store.all("villageAdmins") : [],
    rejectedApplications: req.isAdmin ? store.all("rejections") : [],
    applicationStage: own ? (own.verification ? "main" : "village") : null,
    lastDecision:
      !own && closed
        ? { action: closed.action, reason: closed.reason, at: closed.at }
        : null,
  };
}
export function assertVerified(store, r) {
  if (!needsVerification(r)) return;
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
export function installVillageApproval(app, store, { admin, state }) {
  app.post("/api/admin/villages", admin, (req, res) => {
    const clean = (x) => {
      if (
        typeof x !== "string" ||
        x.trim().length < 2 ||
        x.length > 80 ||
        /[\u0000-\u001f<>]/.test(x)
      )
        fail("Invalid village name");
      return x.trim();
    };
    const gu = clean(req.body.gu),
      en = clean(req.body.en);
    if (
      store
        .all("villages")
        .some((v) => v.gu === gu || v.en.toLowerCase() === en.toLowerCase())
    )
      fail("Village already exists", 409);
    store.tx(() => {
      store.put("villages", {
        id: gu,
        gu,
        en,
        order: store.all("villages").length,
      });
      store.audit(req.session.owner, "village.add", gu);
    });
    res.json(state(req));
  });
  app.post("/api/admin/village-admins/:village", admin, (req, res) => {
    const village = store.get("villages", req.params.village);
    if (!village) fail("Village not found", 404);
    const reason = decisionReason(req.body.reason);
    store.tx(() => {
      let memberId = req.body.memberId;
      if (req.body.requestId) {
        // Explicit trusted-representative appointment solves first-admin bootstrapping.
        // This is NOT the ordinary membership approval endpoint.
        if (req.body.identityConfirmed !== true)
          fail("Confirm identity in person before appointment");
        const r = store.get("requests", req.body.requestId);
        if (!r || r.kind !== "new" || r.payload.village !== village.gu)
          fail("Matching pending representative required", 409);
        if (store.get("villageAdmins", village.gu))
          fail(
            "Remove the previous assignment before appointing a new representative",
            409,
          );
        store.unique(r.payload, r.owner, r.id);
        memberId = randomUUID();
        store.put("members", {
          ...r.payload,
          id: memberId,
          owner: r.owner,
          createdAt: r.createdAt,
          approvedAt: Date.now(),
          approvedBy: req.session.owner,
          consentAt: r.consentAt,
          consentVersion: r.consentVersion,
        });
        store.del("requests", r.id);
        store.audit(
          req.session.owner,
          "representative.appoint:" + reason,
          memberId,
        );
      }
      if (memberId !== null) {
        const m = store.get("members", memberId);
        if (!m || m.village !== village.gu)
          fail("Choose an approved member of this village");
      }
      if (memberId === null) store.del("villageAdmins", village.gu);
      else
        store.put("villageAdmins", {
          id: village.gu,
          memberId,
          version: randomUUID(),
          assignedAt: Date.now(),
          assignedBy: req.session.owner,
          reason,
        });
      // A replacement must review pending work independently; old attestation is history only.
      for (const r of store
        .all("requests")
        .filter(
          (r) => needsVerification(r) && r.payload.village === village.gu,
        )) {
        if (r.verification) {
          r.reviewHistory = [...(r.reviewHistory || []), r.verification];
          delete r.verification;
          store.put("requests", r);
        }
      }
      store.audit(
        req.session.owner,
        "village-admin.assign:" + reason,
        village.gu,
      );
    });
    res.json(state(req));
  });
  app.post("/api/village/requests/:id/:action", (req, res) => {
    const r = store.get("requests", req.params.id);
    if (!r) fail("Request already processed", 409);
    const me = store.all("members").find((m) => m.owner === req.session.owner);
    const assignment = store.get("villageAdmins", r.payload?.village);
    if (
      !me ||
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
    const reason = decisionReason(req.body.reason);
    if (action === "forward" && req.body.identityConfirmed !== true)
      fail("Confirm independent identity verification");
    store.tx(() => {
      if (action === "forward") {
        r.verification = {
          memberId: me.id,
          name: me.nameGu || me.name,
          assignmentVersion: assignment.version,
          at: Date.now(),
          reason,
        };
        store.put("requests", r);
      } else {
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
      store.audit(me.id, "village.request." + action + ":" + reason, r.id);
    });
    res.json(state(req));
  });
  // Old codes can no longer grant access, including codes issued before migration.
  app.post(
    ["/api/member/recover", "/api/admin/members/:id/recovery"],
    (req, res) =>
      res
        .status(410)
        .json({
          error:
            "Access codes retired. Submit a new application for village and main-admin review.",
        }),
  );
}
