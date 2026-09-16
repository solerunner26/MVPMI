import { randomBytes, timingSafeEqual } from "node:crypto";
import { fail, hash } from "./store.mjs";

// Operator-assisted identity verification. This is NOT SMS phone-ownership verification.
export function installMemberRecovery(
  app,
  store,
  { admin, rate, state, secure, development },
) {
  const ttl = 15 * 60 * 1000;
  const clean = () => {
    for (const row of store.all("recoveries"))
      if (row.expiresAt <= Date.now()) store.del("recoveries", row.id);
  };
  app.post("/api/admin/members/:id/recovery", admin, (req, res) => {
    rate("recovery-issue:" + req.session.id, 30, 3600000);
    if (req.body.identityVerified !== true)
      fail("Confirm that you verified this member's identity", 400);
    const member = store.get("members", req.params.id);
    if (!member) fail("Member not found", 404);
    rate("recovery-member:" + member.id, 5);
    clean();
    const code = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + ttl;
    store.tx(() => {
      // The member ID is the key: reissue invalidates any earlier code.
      store.put("recoveries", {
        id: member.id,
        owner: member.owner,
        phone: member.phone,
        digest: hash(code),
        expiresAt,
        attempts: 0,
      });
      store.audit(req.session.owner, "member.recovery.issued", member.id);
    });
    res.json({ code, expiresAt }); // Returned once, only to the authenticated administrator.
  });
  app.post("/api/member/recover", (req, res) => {
    rate("recovery-ip:" + req.socket.remoteAddress, 20);
    rate("recovery-session:" + req.session.id, 5);
    rate("recovery-global", 200, 3600000);
    if (
      req.isAdmin ||
      store.all("members").some((m) => m.owner === req.session.owner) ||
      store.all("requests").some((r) => r.owner === req.session.owner)
    )
      fail("Use a new browser session to recover access", 409);
    clean();
    const invalid = () =>
      fail(
        "Invalid or expired recovery code. Ask your administrator for a new code",
        400,
      );
    if (
      typeof req.body.phone !== "string" ||
      !/^[6-9]\d{9}$/.test(req.body.phone) ||
      typeof req.body.code !== "string" ||
      !/^[a-fA-F0-9 -]{32,48}$/.test(req.body.code)
    )
      return invalid();
    const code = req.body.code.replace(/[ -]/g, "").toLowerCase();
    const member = store.all("members").find((m) => m.phone === req.body.phone);
    const grant = member && store.get("recoveries", member.id);
    if (
      !grant ||
      grant.owner !== member.owner ||
      grant.phone !== member.phone ||
      grant.attempts >= 5
    )
      return invalid();
    if (
      !timingSafeEqual(
        Buffer.from(grant.digest, "hex"),
        Buffer.from(hash(code), "hex"),
      )
    ) {
      store.tx(() => {
        const current = store.get("recoveries", member.id);
        if (current && current.digest === grant.digest)
          store.put("recoveries", {
            ...current,
            attempts: current.attempts + 1,
          });
      });
      return invalid();
    }
    const cookie = randomBytes(32).toString("hex");
    const session = {
      id: hash(cookie),
      owner: member.owner,
      expires: Date.now() + 180 * 86400000,
    };
    const transport = development
      ? {
          token: randomBytes(32).toString("hex"),
          expiresAt: Date.now() + 12 * 3600000,
        }
      : undefined;
    store.tx(() => {
      const current = store.get("recoveries", member.id);
      const currentMember = store.get("members", member.id);
      if (
        !current ||
        current.digest !== grant.digest ||
        current.expiresAt <= Date.now() ||
        current.attempts >= 5 ||
        !currentMember ||
        currentMember.owner !== grant.owner ||
        currentMember.phone !== grant.phone
      )
        invalid();
      store.del("recoveries", member.id);
      // Revoke every old device plus the caller's pre-recovery session. Never copy admin/gate privileges.
      const revoked = new Set(
        store
          .all("sessions")
          .filter((s) => s.owner === member.owner || s.id === req.session.id)
          .map((s) => s.id),
      );
      for (const row of store.all("transports"))
        if (revoked.has(row.sessionId)) store.del("transports", row.id);
      for (const id of revoked) store.del("sessions", id);
      store.put("sessions", session);
      if (transport)
        store.put("transports", {
          id: hash(transport.token),
          sessionId: session.id,
          expiresAt: transport.expiresAt,
        });
      store.audit(session.owner, "member.recovery.redeemed", member.id);
    });
    req.session = session;
    req.isAdmin = false;
    res.cookie("mvpm_session", cookie, {
      httpOnly: true,
      secure,
      sameSite: secure ? "none" : "lax",
      partitioned: secure,
      maxAge: 180 * 86400000,
      path: "/",
    });
    res.json({ ...state(req), recoveryTransport: transport });
  });
}
