import {
  installVillageApproval,
  villageState,
  assertVerified,
  needsVerification,
  activeAdminMember,
} from "./village-approval.mjs";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { installSessions, clientKey, knownClient } from "./session.mjs";
import {
  createNotifier,
  installDevicePull,
  installNotificationRoutes,
} from "./notify.mjs";
import { installAppLock, lockView, touchLock } from "./app-lock.mjs";
import { installDriveBackup } from "./drive-backup-routes.mjs";
import express from "express";
import ExcelJS from "exceljs";
import { randomUUID, randomBytes } from "node:crypto";
import {
  Store,
  villages,
  hash,
  passwordHash,
  passwordMatches,
  strong,
  profile,
  text,
  fail,
  publicProfile,
  isRecord,
} from "./store.mjs";
// Static files resolve from the project, not the process working directory,
// so hosting panels that start Node from another folder still work.
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
export function createApp({
  dbPath = "data/community.sqlite",
  adminPassword,
  gateCode,
  secure = false,
  development = false,
  // Behind cPanel/Passenger, Apache or any reverse proxy set this (see
  // server/index.mjs) so rate limits see each visitor's own address.
  trustProxy = false,
  // Extra public host names accepted by the same-origin check, e.g. when
  // the proxy rewrites the Host header.
  publicHosts = [],
  requireAppLock = true,
  vapidSubject,
  staticDir = DIST,
  // Google Drive backup settings (see server/drive-backup.mjs); tests pass
  // their own environment and a fake Google endpoint.
  driveEnv = process.env,
  driveOptions = {},
} = {}) {
  const store = new Store(dbPath),
    app = express();
  if (trustProxy !== false) app.set("trust proxy", trustProxy);
  if (!store.get("config", "admin")) {
    if (!strong(adminPassword) || !/^\d{4}$/.test(gateCode || ""))
      throw new Error(
        "Set a strong ADMIN_PASSWORD and a four-digit ADMIN_GATE_CODE",
      );
    store.put("config", {
      id: "admin",
      username: "admin",
      password: passwordHash(adminPassword),
      gate: passwordHash(gateCode),
      changedAt: Date.now(),
    });
  }
  store.initializeVillages();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "GET" && req.get("X-MVPMI-Client") !== "1")
      return res.status(403).json({ error: "Invalid request origin" });
    // Admin downloads (backup, exports) are fetched by the app with the
    // client header; a plain cross-site link cannot trigger them.
    if (
      req.method === "GET" &&
      req.path.startsWith("/admin/") &&
      req.get("X-MVPMI-Client") !== "1"
    )
      return res.status(403).json({ error: "Invalid request origin" });
    const origin = req.get("Origin");
    if (origin) {
      const allowed = new Set(
        [
          req.get("host"),
          trustProxy !== false ? req.get("x-forwarded-host") : null,
          ...publicHosts,
        ]
          .filter(Boolean)
          .flatMap((h) => String(h).split(","))
          .map((h) => h.trim().toLowerCase()),
      );
      try {
        if (!allowed.has(new URL(origin).host.toLowerCase()))
          return res.status(403).json({ error: "Invalid request origin" });
      } catch {
        return res.status(403).json({ error: "Invalid request origin" });
      }
    }
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", (req, res, next) => {
    if (req.method === "POST") {
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Send a JSON object" });
      if (!isRecord(req.body))
        return res
          .status(400)
          .json({ error: "Request body must be a JSON object" });
    }
    next();
  });
  const rate = (key, max = 5, window = 900000) => {
    const now = Date.now();
    let r = store.get("limits", key);
    if (!r || r.until < now) r = { id: key, count: 0, until: now + window };
    r.count++;
    store.put("limits", r);
    if (r.count > max)
      fail("ઘણા પ્રયાસો થયા · Too many attempts. Please try again later.", 429);
  };
  const notifier = createNotifier(store, { vapidSubject });
  const notify = notifier.notify;
  const villageName = (gu) => {
    const v = store.get("villages", gu);
    return { gu, en: v?.en || gu };
  };
  installDevicePull(app, store, notifier);
  installSessions(app, store, { development, secure, rate });
  app.use("/api", (req, res, next) => {
    try {
      touchLock(store, req);
    } catch {}
    next();
  });
  // Housekeeping on start and every hour (never keeps the process alive).
  try {
    store.cleanup();
  } catch {}
  setInterval(() => {
    try {
      store.cleanup();
    } catch {}
  }, 3600000).unref();
  const admin = (req, res, next) =>
    req.isAdmin
      ? next()
      : res.status(403).json({ error: "Admin authentication required" });
  installDriveBackup(app, store, { admin, rate, env: driveEnv, options: driveOptions });
  const member = (req) => {
    const m = store.all("members").find((m) => m.owner === req.session.owner);
    if (!m) fail("Admin approval required", 403);
    return m;
  };
  const alert = (req, title) => {
    store.put("alerts", {
      id: randomUUID(),
      title,
      who:
        store.all("members").find((m) => m.owner === req.session.owner)
          ?.phone || "Unknown device",
      device: (req.get("user-agent") || "Unknown").slice(0, 240),
      sessionId: req.session.id,
      when: new Date().toISOString(),
      blocked: false,
    });
    // At most one security notification per 10 minutes, so a burst of
    // wrong attempts does not flood the administrator's phone.
    const last = store.get("config", "alert-notified");
    if (!last || last.at < Date.now() - 600000) {
      store.put("config", { id: "alert-notified", at: Date.now() });
      const [gu, en] = String(title).split(" · ");
      notify("main", {
        kind: "security",
        titleGu: "સુરક્ષા ચેતવણી",
        titleEn: "Security alert",
        bodyGu: gu || title,
        bodyEn: en || title,
      });
    }
  };
  // Sessions that would receive directory records: approved members and
  // signed-in village administrators (the main administrator is exempt —
  // they already pass the hidden gate and password every 30 minutes).
  const sessionSees = (req) =>
    !req.isAdmin &&
    (store.all("members").some((m) => m.owner === req.session.owner) ||
      !!activeAdminMember(store, req));
  const lockFor = (req) => lockView(req, sessionSees(req), requireAppLock);
  const lockClosed = (req) => {
    const l = lockFor(req);
    return l.lockSetup || l.locked;
  };
  // Member and village-administrator actions are refused while locked.
  app.use(
    ["/api/profile", "/api/village/requests", "/api/village/members", "/api/village/password"],
    (req, res, next) => {
      if (req.method === "POST" && lockClosed(req))
        return res
          .status(423)
          .json({ error: "એપ લોક છે · The app is locked. Enter your PIN." });
      next();
    },
  );
  const state = (req) => {
    const me =
        store.all("members").find((m) => m.owner === req.session.owner) ||
        activeAdminMember(store, req),
      requests = store.all("requests");
    const lock = lockFor(req);
    const hidden = lock.lockSetup || lock.locked;
    const mine = requests.find(
      (r) => r.owner === req.session.owner && r.kind === "new",
    );
    const visible = req.isAdmin
      ? requests
      : requests.filter((r) => r.owner === req.session.owner);
    return {
      ...villageState(store, req),
      role: req.isAdmin ? "admin" : me ? "member" : mine ? "pending" : "guest",
      meId: me?.id || null,
      myRequest: mine ? { ...mine.payload, id: mine.id } : null,
      requestAt: mine?.createdAt || null,
      members:
        (req.isAdmin || me) && !hidden
          ? store.all("members").map(publicProfile)
          : [],
      ...lock,
      latestNotificationAt: notifier.latestAt(req.session),
      newRequests: req.isAdmin
        ? visible
            .filter((r) => r.kind === "new")
            .map((r) => ({
              ...r.payload,
              id: r.id,
              rejectedBefore: r.rejectedBefore || null,
              when: new Date(r.createdAt).toISOString(),
            }))
        : [],
      updateRequests: visible
        .filter((r) => r.kind === "update")
        .map((r) => ({
          id: r.id,
          memberId: r.memberId,
          name: r.old.nameGu,
          old: publicProfile(r.old),
          next: publicProfile(r.payload),
        })),
      deleteRequests: visible
        .filter((r) => r.kind === "delete")
        .map((r) => ({
          id: r.id,
          memberId: r.memberId,
          name: r.old.nameGu,
          phone: r.old.phone,
          place: [r.old.village, r.old.tehsil, r.old.district].join(", "),
          reason: r.reason,
        })),
      archive: req.isAdmin
        ? store.all("archive").map(({ owner, snapshot, ...a }) => a)
        : [],
      alerts: req.isAdmin
        ? store.all("alerts").map(({ sessionId, ...a }) => a)
        : [],
      lastBackup: store.get("config", "backup")?.when || "—",
      auditLog: req.isAdmin
        ? store
            .all("audit")
            .sort((a, b) => b.at - a.at)
            .slice(0, 500)
            .map(({ at, actor, action, target }) => ({
              at,
              actor,
              action,
              target,
            }))
        : [],
      passwordDue:
        req.isAdmin &&
        Date.now() - store.get("config", "admin").changedAt > 60 * 86400000,
      development,
    };
  };
  const hideWhenLocked = (req, data) => {
    if (!(data.locked || data.lockSetup)) return data;
    // Nothing that lists community members leaves the server while locked.
    return {
      ...data,
      reviewQueue: [],
      villageProposals: [],
      updateRequests: [],
      deleteRequests: [],
    };
  };
  const baseState = state;
  const lockedState = (req) => hideWhenLocked(req, baseState(req));
  const { issue: issuePinReset } = installAppLock(app, store, {
    rate,
    sessionSees,
    required: requireAppLock,
    notify,
  });
  installNotificationRoutes(app, store, notifier, { rate });
  installVillageApproval(app, store, {
    admin,
    state: lockedState,
    rate,
    notify,
    clientKey,
    knownClient,
    issuePinReset,
  });
  app.get("/api/state", (req, res) => res.json(lockedState(req)));
  // Deployment check: confirms the server runs and whether each visitor's
  // own address reaches the app (needed for fair per-visitor limits).
  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      mode: development ? "development" : "live",
      https: secure,
      visitorAddressVisible: knownClient(req),
      node: process.versions.node,
    }),
  );
  app.post("/api/enrollment", (req, res) => {
    rate("enroll:" + req.session.id, 30, 3600000);
    if (store.all("members").some((m) => m.owner === req.session.owner))
      fail("Already approved", 409);
    // Identity is verified in person by the village administrator (who knows
    // the family) before the main administrator approves; there is no SMS.
    if (req.body.consent !== true) fail("Consent is required");
    const p = profile(req.body, store.all("villages"));
    if (!store.get("villageAdmins", p.village))
      fail(
        "આ ગામ માટે ગામ એડમિન હજુ નિયુક્ત નથી · This village has no administrator yet. Enrollment opens after the main administrator appoints one.",
        409,
      );
    // A phone that was REJECTED before (not merely withdrawn or replaced by
    // the applicant) shows a warning to both administrator levels.
    const rejectEvent = (a) =>
      (a.events || []).filter((e) => e.action === "reject").at(-1);
    const priorLedger = store
      .all("rejections")
      .find(
        (a) =>
          (a.phone === p.phone || (a.phone2 && a.phone2 === p.phone)) &&
          rejectEvent(a),
      );
    const priorRejection =
      priorLedger ||
      store
        .all("archive")
        .find(
          (a) =>
            [a.phone, a.phone2, ...(a.numbers || [])].some(
              (n) => n && n === p.phone,
            ) &&
            /નામંજૂર/.test(
              a.history?.[a.history.length - 1]?.reason || a.status || "",
            ),
        );
    const lastEvent = priorLedger ? rejectEvent(priorLedger) : null;
    store.tx(() => {
      store.unique(p, req.session.owner, undefined, true);
      for (const r of store
        .all("requests")
        .filter((r) => r.owner === req.session.owner && r.kind === "new")) {
        store.archive(r.payload, "બદલી · Replaced request");
        store.del("requests", r.id);
      }
      store.put("requests", {
        id: randomUUID(),
        owner: req.session.owner,
        kind: "new",
        payload: p,
        createdAt: Date.now(),
        consentAt: Date.now(),
        consentVersion: "development-disclosure-v1",
        ...(priorRejection
          ? {
              rejectedBefore: {
                at: lastEvent?.at || null,
                reason: lastEvent?.reason || "",
                actorName: lastEvent?.actorName || "",
              },
            }
          : {}),
      });
    });
    notify("village:" + p.village, {
      kind: "new-request",
      titleGu: "નવી નોંધણી વિનંતી આવી",
      titleEn: "New joining application",
      bodyGu: p.nameGu + " · ચકાસીને આગળ મોકલો",
      bodyEn: p.name + " · please verify and forward",
    });
    res.json(lockedState(req));
  });
  app.post("/api/enrollment/withdraw", (req, res) => {
    store.tx(() => {
      for (const r of store
        .all("requests")
        .filter((r) => r.owner === req.session.owner && r.kind === "new")) {
        store.archive(r.payload, "કેન્સલ · Withdrawn by user");
        store.del("requests", r.id);
      }
    });
    res.json(lockedState(req));
  });
  app.post("/api/profile/update", (req, res) => {
    const m = member(req),
      p = profile(req.body, store.all("villages"));
    const assignment = store.get("villageAdmins", m.village);
    const r = {
      id: randomUUID(),
      owner: m.owner,
      kind: "update",
      memberId: m.id,
      old: m,
      payload: p,
      createdAt: Date.now(),
      // A village administrator's own number change cannot be verified by
      // themselves; the main administrator decides it directly.
      ...(assignment?.memberId === m.id ? { selfAdmin: true } : {}),
    };
    store.tx(() => {
      store.unique(p, m.owner);
      for (const old of store
        .all("requests")
        .filter((x) => x.owner === m.owner && x.kind === "update"))
        store.del("requests", old.id);
      store.put("requests", r);
    });
    const who = { gu: m.nameGu || m.name, en: m.name };
    if (needsVerification(r)) {
      const place = villageName(p.village);
      notify("village:" + p.village, {
        kind: "change-request",
        titleGu:
          m.village !== p.village
            ? "ગામ બદલવાની વિનંતી · ચકાસણી કરો"
            : "મોબાઇલ નંબર બદલવાની વિનંતી · ચકાસણી કરો",
        titleEn:
          m.village !== p.village
            ? "Village change request · please verify"
            : "Mobile number change · please verify",
        bodyGu: who.gu + " · " + place.gu,
        bodyEn: who.en + " · " + place.en,
      });
    } else
      notify("main", {
        kind: "change-request",
        titleGu: "માહિતી બદલવાની વિનંતી આવી",
        titleEn: "Profile change request",
        bodyGu: who.gu,
        bodyEn: who.en,
      });
    res.json(lockedState(req));
  });
  app.post("/api/profile/delete", (req, res) => {
    const m = member(req);
    if (
      !store
        .all("requests")
        .some((r) => r.memberId === m.id && r.kind === "delete")
    )
      store.put("requests", {
        id: randomUUID(),
        owner: m.owner,
        kind: "delete",
        memberId: m.id,
        old: m,
        reason: "સભ્યની વિનંતી · Requested by member",
        createdAt: Date.now(),
      });
    notify(["main", "village:" + m.village], {
      kind: "removal-request",
      titleGu: "સભ્યએ યાદીમાંથી દૂર થવાની વિનંતી કરી",
      titleEn: "Member asked to be removed",
      bodyGu: m.nameGu || m.name,
      bodyEn: m.name,
    });
    res.json(lockedState(req));
  });
  app.post("/api/admin/gate", (req, res) => {
    rate("gate:" + req.session.id);
    if (knownClient(req)) rate("gate-ip:" + clientKey(req), 30);
    else {
      // Visitor addresses are hidden by the proxy: fall back to a site-wide
      // cap on WRONG codes only (100 per hour).
      const g = store.get("limits", "gate-global-failures");
      if (g?.until > Date.now() && g.count >= 100)
        fail("ઘણા પ્રયાસો થયા · Too many attempts. Please try again later.", 429);
    }
    const a = store.get("config", "admin");
    if (!passwordMatches(String(req.body.code || ""), a.gate)) {
      if (!knownClient(req))
        try {
          rate("gate-global-failures", 1e9, 3600000);
        } catch {}
      alert(req, "ખોટો કોડ · Incorrect access code");
      fail("Incorrect access code", 401);
    }
    req.session.gateUntil = Date.now() + 300000;
    store.put("sessions", req.session);
    res.json({ ok: true });
  });
  app.post("/api/admin/login", (req, res) => {
    // The hidden gate is checked BEFORE any shared counter, so strangers
    // without the access code cannot lock the administrator out.
    if (!(req.session.gateUntil > Date.now()))
      fail("Access code required", 403);
    rate("login:" + req.session.id);
    const global = store.get("limits", "login-global-failures");
    if (global?.until > Date.now() && global.count >= 30)
      fail("ઘણા પ્રયાસો થયા · Too many attempts. Please try again later.", 429);
    const a = store.get("config", "admin");
    if (
      req.body.user !== a.username ||
      !passwordMatches(String(req.body.pass || ""), a.password)
    ) {
      try {
        rate("login-global-failures", 1e9);
      } catch {}
      alert(req, "લોગિન નિષ્ફળ · Failed admin login");
      fail("Wrong username or password", 401);
    }
    req.rotateSession();
    req.session.adminUntil = Date.now() + 30 * 60000;
    // Administrator notifications stay on for this device until it signs
    // out completely or the password changes.
    req.session.mainNotify = { changedAt: a.changedAt };
    store.put("sessions", req.session);
    req.isAdmin = true;
    store.audit(req.session.owner, "admin.login", a.id);
    const payload = lockedState(req);
    // First sign-in on a fresh account issues the offline recovery code
    // exactly once; the client must make the administrator save it. Later
    // sign-ins never resend it — a lost code is replaced from the security
    // tab while signed in, not by this endpoint.
    if (!a.recoveryHash)
      payload.recovery = issueRecovery(a, req.session.owner, "admin.recovery-issued");
    res.json(payload);
  });
  // Full device sign-out (used by the app-lock "forgot PIN" flow): the
  // session, including member identity and any administrator role, is
  // destroyed so resetting a forgotten lock never leaves data accessible.
  app.post("/api/logout", (req, res) => {
    const id = req.session.id;
    store.audit(req.session.owner, "device.logout", id);
    store.tx(() => {
      store.del("sessions", id);
      for (const t of ["devices", "pushSubs"])
        for (const d of store.all(t)) if (d.sessionId === id) store.del(t, d.id);
    });
    res.clearCookie("mvpm_session", { path: "/" });
    res.json({ signedOut: true });
  });
  app.post("/api/admin/logout", (req, res) => {
    delete req.session.adminUntil;
    delete req.session.gateUntil;
    if (req.body.stopNotifications === true) delete req.session.mainNotify;
    store.put("sessions", req.session);
    req.isAdmin = false;
    res.json(lockedState(req));
  });
  // Password recovery without SMS or OTP: the administrator saves a long
  // offline recovery code (issued once at first sign-in, rotated on every
  // use and on demand from the security tab). Possession of that code plus
  // the access gate is enough to set a new password. This removes the
  // per-message SMS cost entirely and is stronger than a 6-digit OTP:
  // 80 bits of entropy, no phone-number dependency, no SIM-swap risk.
  const recoveryCode = () => {
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let value = BigInt("0x" + randomBytes(10).toString("hex")),
      raw = "";
    for (let i = 0; i < 16; i++, value >>= 5n)
      raw = alphabet[Number(value & 31n)] + raw;
    return raw;
  };
  const normalizeRecovery = (input) =>
    String(input || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16);
  const issueRecovery = (a, actor, action) => {
    const code = recoveryCode();
    a.recoveryHash = passwordHash(code);
    a.recoveryAt = Date.now();
    store.put("config", a);
    store.audit(actor, action, "admin");
    return code;
  };
  app.post("/api/admin/recover", (req, res) => {
    if (!req.isAdmin && !(req.session.gateUntil > Date.now()))
      fail("Access code required", 403);
    if (store.get("config", "reset-lock")?.until > Date.now())
      fail("Reset temporarily locked. Try again in 15 minutes.", 429);
    rate("recover:" + req.session.id, 10);
    rate("recover-global", 20, 3600000);
    const a = store.get("config", "admin");
    if (
      !a.recoveryHash ||
      !passwordMatches(normalizeRecovery(req.body.recovery), a.recoveryHash)
    ) {
      alert(req, "ખોટો રિકવરી કોડ · Wrong recovery code");
      req.session.recoverTries = (req.session.recoverTries || 0) + 1;
      if (req.session.recoverTries >= 5) {
        req.session.recoverTries = 0;
        store.put("sessions", req.session);
        store.put("config", { id: "reset-lock", until: Date.now() + 900000 });
        fail("Too many attempts. Reset locked for 15 minutes.", 429);
      }
      store.put("sessions", req.session);
      fail("Incorrect recovery code", 401);
    }
    if (!strong(req.body.password))
      fail("Use 10+ characters, upper/lowercase, a number and a symbol");
    a.password = passwordHash(req.body.password);
    a.changedAt = Date.now();
    const next = issueRecovery(
      a,
      req.session.owner,
      "admin.password-recovered",
    );
    // Every administrator session is revoked; the resetting device keeps
    // only its gate so the new password can be used immediately without
    // repeating the hidden-logo gesture.
    for (const s of store.all("sessions")) {
      delete s.adminUntil;
      delete s.reset;
      delete s.recoverTries;
      if (s.id !== req.session.id) delete s.gateUntil;
      store.put("sessions", s);
    }
    res.json({ ok: true, recovery: next });
  });
  app.post("/api/admin/recovery/regenerate", admin, (req, res) => {
    const a = store.get("config", "admin");
    const next = issueRecovery(
      a,
      req.session.owner,
      "admin.recovery-regenerated",
    );
    res.json({ ok: true, recovery: next });
  });
  // The main administrator may correct typos in a joining request before the
  // final approval; moving it to another village restarts that village's
  // verification so no application skips local review.
  app.post("/api/admin/requests/:id/correct", admin, (req, res) => {
    const r = store.get("requests", req.params.id);
    if (!r) fail("Request already processed", 409);
    if (r.kind !== "new") fail("Only joining requests can be corrected here", 409);
    const p = profile(
      { ...req.body, village: req.body.village || r.payload.village },
      store.all("villages"),
    );
    store.unique(p, r.owner, undefined, true);
    store.tx(() => {
      if (r.verification && p.village !== r.payload.village) {
        r.reviewHistory = [...(r.reviewHistory || []), r.verification];
        delete r.verification;
      }
      r.corrections = [
        ...(r.corrections || []),
        { by: req.session.owner, at: Date.now(), before: publicProfile(r.payload) },
      ];
      r.payload = p;
      store.put("requests", r);
      store.audit(req.session.owner, "admin.request.correct", r.id);
    });
    res.json(lockedState(req));
  });

  // Contactable identity for the "All admins" page (name + phone shown to
  // everyone, including applicants who want to talk before applying).
  app.post("/api/admin/main-admin-contact", admin, (req, res) => {
    const name = text(req.body.name, 3, 120, "name");
    // Optional English spelling so the public page honours the language
    // selection; falls back to the stored name.
    const nameEnRaw = req.body.nameEn;
    const nameEn =
      typeof nameEnRaw === "string" && nameEnRaw.trim()
        ? text(nameEnRaw, 3, 120, "English name")
        : "";
    const phone = String(req.body.phone || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phone))
      fail("નંબર બરાબર લખો · Enter a valid 10-digit mobile number");
    store.tx(() => {
      store.put("config", {
        id: "main-admin-contact",
        name,
        ...(nameEn ? { nameEn } : {}),
        phone,
      });
      store.audit(req.session.owner, "main-admin-contact.set", phone);
    });
    res.json(lockedState(req));
  });

  app.post("/api/admin/requests/:id/:action", admin, (req, res) => {
    const r = store.get("requests", req.params.id);
    if (!r) fail("Request already processed. Refresh and try again", 409);
    if (!["approve", "reject"].includes(req.params.action))
      fail("Invalid action");
    store.tx(() => {
      if (req.params.action === "approve") {
        assertVerified(store, r);
        if (r.kind === "new") {
          const existing = store
            .all("members")
            .find((m) => m.phone === r.payload.phone);
          if (existing) {
            if (
              req.body.replaceExistingMemberId !== existing.id ||
              req.body.identityConfirmed !== true
            )
              fail(
                "Confirm the existing member before replacing device access",
                409,
              );
            // Device replacement keeps the person's record (second number,
            // label, location) and moves it to the new phone's session.
            // Requests raised from the old device are closed.
            for (const old of store
              .all("requests")
              .filter((x) => x.memberId === existing.id))
              store.del("requests", old.id);
            store.del("members", existing.id);
            store.audit(
              req.session.owner,
              "member.device-replacement",
              existing.id,
            );
            if (!r.payload.phone2 && existing.phone2) {
              r.payload.phone2 = existing.phone2;
              r.payload.label2 = existing.label2 || "work";
            }
            if (r.payload.currentLocation === undefined && existing.currentLocation)
              r.payload.currentLocation = existing.currentLocation;
          }
          const archived = store
            .all("archive")
            .filter((a) =>
              [a.phone, a.phone2, ...(a.numbers || [])].some(
                (n) => n && [r.payload.phone, r.payload.phone2].includes(n),
              ),
            );
          if (
            archived.length &&
            (archived.length !== 1 ||
              req.body.archiveId !== archived[0].id ||
              req.body.identityConfirmed !== true)
          )
            fail("Confirm the matching archive identity before rejoining", 409);
          store.unique(r.payload, r.owner, r.id);
          store.put("members", {
            ...r.payload,
            id:
              existing?.id ||
              archived[0]?.personId ||
              archived[0]?.snapshot?.id ||
              randomUUID(),
            owner: r.owner,
            createdAt: r.createdAt,
            approvedAt: Date.now(),
            approvedBy: req.session.owner,
            consentAt: r.consentAt,
            consentVersion: r.consentVersion,
          });
        } else {
          const m = store.get("members", r.memberId);
          if (!m) fail("Member no longer exists", 409);
          if (r.kind === "update") {
            if (!isDeepStrictEqual(m, r.old))
              fail(
                "Profile changed since this request. Reject and ask for a new request.",
                409,
              );
            store.unique(r.payload, m.owner, r.id);
            if (m.village !== r.payload.village) store.dropAssignments(m.id);
            store.put("members", { ...m, ...r.payload });
            syncAdminUsername(m.id, r.payload.phone);
          } else store.remove(m, "દૂર કરી · Removed on request");
        }
      } else if (r.kind === "new") {
        store.rejectRequest(
          r,
          "reject",
          req.body.reason?.trim().slice(0, 500) || "",
          req.session.owner,
          "main",
          req.body.category,
        );
      }
      store.del("requests", r.id);
      store.audit(req.session.owner, "request." + req.params.action, r.id);
    });
    const who = r.payload || r.old;
    const place = villageName((r.payload || r.old).village);
    if (req.params.action === "approve") {
      if (r.kind === "new") {
        notify("owner:" + r.owner, {
          kind: "approved",
          titleGu: "સ્વાગત છે! તમારી નોંધણી મંજૂર થઈ",
          titleEn: "Welcome! Your application is approved",
          bodyGu: "સમાજની સંપર્ક યાદી હવે ખુલ્લી છે. પિન સેટ કરીને શરૂ કરો.",
          bodyEn: "The community directory is now open. Set your PIN to begin.",
        });
        notify("village:" + r.payload.village, {
          kind: "member-added",
          titleGu: "નવો સભ્ય ઉમેરાયો · " + place.gu,
          titleEn: "New member added · " + place.en,
          bodyGu: who.nameGu || who.name,
          bodyEn: who.name,
        });
      } else
        notify("owner:" + r.owner, {
          kind: r.kind === "delete" ? "removed" : "change-approved",
          titleGu:
            r.kind === "delete"
              ? "તમને યાદીમાંથી દૂર કરવામાં આવ્યા"
              : "તમારો ફેરફાર મંજૂર થયો",
          titleEn:
            r.kind === "delete"
              ? "You were removed from the directory"
              : "Your change was approved",
          bodyGu: r.kind === "delete" ? "પ્રશ્ન હોય તો ગામના એડમિનનો સંપર્ક કરો." : "નવી માહિતી યાદીમાં દેખાય છે.",
          bodyEn: r.kind === "delete" ? "Contact your village administrator with any questions." : "Your new details now show in the directory.",
        });
    } else
      notify("owner:" + r.owner, {
        kind: "declined",
        titleGu: r.kind === "new" ? "નોંધણી વિનંતી નામંજૂર થઈ" : "વિનંતી નામંજૂર થઈ",
        titleEn: r.kind === "new" ? "Application rejected" : "Request not approved",
        bodyGu: req.body.reason?.trim().slice(0, 200) || "વધુ માહિતી માટે ગામના એડમિનનો સંપર્ક કરો.",
        bodyEn: req.body.reason?.trim().slice(0, 200) || "Contact your village administrator for details.",
      });
    res.json(lockedState(req));
  });
  // A village administrator signs in with their current member number.
  const syncAdminUsername = (memberId, phone) => {
    for (const a of store.all("villageAdmins"))
      if (a.memberId === memberId && a.username !== phone)
        store.put("villageAdmins", { ...a, username: phone });
  };
  app.post("/api/admin/members/:id", admin, (req, res) => {
    const m = store.get("members", req.params.id);
    if (!m) fail("Member not found", 404);
    const p = profile(req.body, store.all("villages"));
    if (p.village !== m.village)
      fail("Village changes require the destination village review", 409);
    store.tx(() => {
      store.unique(p, m.owner);
      store.put("members", { ...m, ...p });
      syncAdminUsername(m.id, p.phone);
      store.audit(req.session.owner, "member.edit", m.id);
    });
    res.json(lockedState(req));
  });
  app.post("/api/admin/members/:id/delete", admin, (req, res) => {
    const m = store.get("members", req.params.id);
    if (!m) fail("Member not found", 404);
    store.tx(() => {
      store.remove(m, "એડમિને દૂર કરી · Deleted by admin");
      store.audit(req.session.owner, "member.delete", m.id);
    });
    notify("owner:" + m.owner, {
      kind: "removed",
      titleGu: "તમને યાદીમાંથી દૂર કરવામાં આવ્યા",
      titleEn: "You were removed from the directory",
      bodyGu: "પ્રશ્ન હોય તો ગામના એડમિનનો સંપર્ક કરો.",
      bodyEn: "Contact your village administrator with any questions.",
    });
    res.json(lockedState(req));
  });
  // Forgotten member PIN: the main administrator can issue a code for anyone.
  app.post("/api/admin/members/:id/pin-reset", admin, (req, res) => {
    const m = store.get("members", req.params.id);
    if (!m) fail("Member not found", 404);
    if (req.body.identityConfirmed !== true)
      fail("Confirm you spoke with this member first");
    issuePinReset(req, res, m, req.session.owner, "admin");
  });
  app.post("/api/admin/alerts/:id/block", admin, (req, res) => {
    const a = store.get("alerts", req.params.id);
    if (!a) fail("Alert not found", 404);
    if (a.sessionId === req.session.id)
      fail("Cannot block your current admin session");
    const s = store.get("sessions", a.sessionId);
    if (s) {
      s.blocked = true;
      s.adminUntil = 0;
      store.put("sessions", s);
    }
    a.blocked = true;
    store.put("alerts", a);
    store.audit(req.session.owner, "session.block", a.id);
    res.json(lockedState(req));
  });
  app.get("/api/admin/backup", admin, (req, res) => {
    store.put("config", { id: "backup", when: new Date().toISOString() });
    store.audit(req.session.owner, "backup.export", "database");
    res.attachment("mvpmi-backup.json").json(store.snapshot());
  });
  app.post("/api/admin/restore/validate", admin, (req, res) => {
    // The confirmation digest covers the file exactly as uploaded; the
    // validator may upgrade older backups (village renames, name parts).
    const digest = hash(JSON.stringify(req.body));
    const b = store.validateBackup(structuredClone(req.body));
    res.json({
      members: b.members.length,
      requests: b.requests.length,
      archive: b.archive.length,
      currentMembers: store.all("members").length,
      digest,
      currentDigest: store.dataDigest(),
    });
  });
  app.post("/api/admin/restore", admin, (req, res) => {
    if (typeof req.body.currentDigest !== "string")
      fail("Restore preview is required");
    if (
      !isRecord(req.body.backup) ||
      req.body.digest !== hash(JSON.stringify(req.body.backup))
    )
      fail("Backup confirmation does not match");
    store.restore(req.body.backup, req.session.owner, req.body.currentDigest);
    res.json(lockedState(req));
  });
  app.get("/api/admin/export.xlsx", admin, async (req, res) => {
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet(req.query.lang === "en" ? "Community" : "સમાજ");
    const englishHeaders = [
      "#",
      "Name (Gujarati)",
      "Name",
      "Personal",
      "Second number",
      "Label",
      "Village",
      "Tehsil",
      "District",
    ];
    const gujaratiHeaders = [
      "ક્રમ",
      "ગુજરાતી નામ",
      "નામ",
      "પોતાનો નંબર",
      "બીજો નંબર",
      "પ્રકાર",
      "ગામ",
      "તાલુકો",
      "જિલ્લો",
    ];
    const pair = (gu, en, separator = " · ") =>
      gu === en
        ? gu
        : req.query.lang === "en"
          ? en + separator + gu
          : gu + separator + en;
    const headers = gujaratiHeaders.map((gu, i) =>
      pair(gu, englishHeaders[i], "\n"),
    );
    sheet.columns = headers.map((header) => ({ header, width: 26 }));
    const place = (value) => {
      const match = villages.find((v) => v.gu === value || v.en === value);
      return match ? pair(match.gu, match.en) : value;
    };
    let serial = 0;
    for (const m of store.all("members"))
      sheet.addRow([
        ++serial,
        m.nameGu,
        m.name,
        m.phone,
        m.phone2,
        m.label2 === "work"
          ? pair("ધંધાનો", "Work")
          : m.label2 === "other"
            ? pair("બીજો", "Other")
            : m.label2,
        place(m.village),
        pair("મહુવા", "Mahuva"),
        pair("ભાવનગર", "Bhavnagar"),
      ]);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(1).height = 40;
    res.attachment("mvpmi-contacts.xlsx");
    res.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(Buffer.from(await book.xlsx.writeBuffer()));
  });
  // Downloadable CSV reports. UTF-8 BOM keeps Gujarati correct in Excel.
  const csvCell = (value) => {
    let text = String(value ?? "");
    // Spreadsheet formula injection: a cell that starts with = + - @ (or a
    // tab/return) is stored as text, never run as a formula in Excel.
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\n\r]/.test(text)
      ? '"' + text.replaceAll('"', '""') + '"'
      : text;
  };
  const csvLang = (req, gu, en) => (req.query.lang === "en" ? en : gu);
  const villageLabel = (value) => {
    const match = villages.find((v) => v.gu === value || v.en === value);
    return match ? match.gu + " / " + match.en : value;
  };
  const iso = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16) : "");
  app.get("/api/admin/export.csv", admin, (req, res) => {
    const type = String(req.query.type || "members");
    const L = (gu, en) => csvLang(req, gu, en);
    const rows = [];
    // Header and section rows are marked objects; plain arrays are data
    // rows that the emitter prefixes with a running serial number.
    const head = (cells) => rows.push({ h: cells });
    const section = (gu, en) => rows.push({ s: [L(gu, en)] });
    const members = store.all("members");
    const requests = store.all("requests");
    const archive = store.all("archive");
    const rejections = store.all("rejections");
    const admins = Object.fromEntries(store.all("villageAdmins"));
    const villagesAll = store.all("villages");
    const audit = store
      .all("audit")
      .sort((a, b) => b.at - a.at)
      .slice(0, 500);
    if (type === "members") {
      head([
        L("ગુજરાતી નામ", "Name (Gujarati)"),
        L("નામ", "Name"),
        L("પોતાનો નંબર", "Personal number"),
        L("બીજો નંબર", "Second number"),
        L("પ્રકાર", "Label"),
        L("ગામ", "Village"),
        L("તાલુકો", "Tehsil"),
        L("જિલ્લો", "District"),
        L("હાલની જગ્યા", "Current location"),
      ]);
      for (const m of members)
        rows.push([
          m.nameGu,
          m.name,
          m.phone,
          m.phone2,
          m.label2,
          villageLabel(m.village),
          L("મહુવા", "Mahuva"),
          L("ભાવનગર", "Bhavnagar"),
          m.currentLocation || "",
        ]);
    } else if (type === "villages") {
      head([
        L("ગામ", "Village"),
        L("સભ્યો", "Members"),
        L("ગામ એડમિન", "Village administrator"),
        L("એડમિન નંબર", "Administrator number"),
      ]);
      for (const v of villagesAll) {
        const a = admins[v.gu] && store.get("members", admins[v.gu].memberId);
        rows.push([
          v.gu + " / " + v.en,
          members.filter((m) => m.village === v.gu).length,
          a ? a.nameGu || a.name : "",
          a ? a.phone : "",
        ]);
      }
    } else if (type === "requests") {
      head([
        L("પ્રકાર", "Kind"),
        L("નામ", "Name"),
        L("નંબર", "Phone"),
        L("ગામ", "Village"),
        L("તબક્કો", "Stage"),
        L("પહેલા નામંજૂર", "Rejected before"),
        L("સમય", "Created"),
      ]);
      const kindText = {
        new: L("નવી નોંધણી", "New enrollment"),
        update: L("ફેરફાર", "Change"),
        delete: L("દૂર કરવાની", "Removal"),
      };
      for (const r of requests)
        rows.push([
          kindText[r.kind] || r.kind,
          (r.payload || r.old || {}).nameGu || (r.payload || r.old || {}).name,
          (r.payload || r.old || {}).phone,
          villageLabel((r.payload || r.old || {}).village),
          r.verification
            ? L("મુખ્ય એડમિન પાસે", "With main admin")
            : L("ગામ ચકાસણી બાકી", "Awaiting village verification"),
          r.rejectedBefore ? L("હા", "Yes") : "",
          iso(r.createdAt),
        ]);
    } else if (type === "rejections") {
      head([
        L("નામ", "Name"),
        L("નંબર", "Phone"),
        L("ગામ", "Village"),
        L("કેટેગરી", "Category"),
        L("છેલ્લો નિર્ણય", "Last decision"),
        L("નિર્ણય કરનાર", "Decided by"),
        L("સમય", "When"),
      ]);
      for (const a of rejections) {
        const last = a.events?.[a.events.length - 1] || {};
        rows.push([
          a.name,
          a.phone,
          villageLabel(a.village),
          a.category,
          last.action === "closed"
            ? L("બંધ", "Closed")
            : last.action === "reject"
              ? L("નામંજૂર", "Rejected")
              : last.action || "",
          last.actorName || "",
          iso(last.at),
        ]);
      }
    } else if (type === "archive") {
      head([
        L("નામ", "Name"),
        L("નંબર", "Phone"),
        L("ગામ", "Village"),
        L("સ્થિતિ", "Status"),
        L("સમય", "When"),
      ]);
      for (const a of archive) {
        const last = a.history?.[a.history.length - 1];
        rows.push([
          a.nameGu || a.name,
          a.phone,
          villageLabel(a.village),
          last?.reason || "",
          iso(last?.at),
        ]);
      }
    } else if (type === "activity") {
      head([
        L("સમય", "When"),
        L("કરનાર", "Actor"),
        L("ક્રિયા", "Action"),
        L("લક્ષ્ય", "Target"),
      ]);
      for (const a of audit)
        rows.push([iso(a.at), a.actor, a.action, a.target]);
    } else if (type === "full") {
      section("સમાજ સંપૂર્ણ રિપોર્ટ", "Community full report");
      rows.push([]);
      section("કુલ મંજૂર સભ્યો", "Total approved members");
      rows.push([String(members.length)]);
      rows.push([]);
      section("ગામ પ્રમાણે સભ્યો", "Members by village");
      head([L("ગામ", "Village"), L("સભ્યો", "Members")]);
      for (const v of villagesAll)
        rows.push([
          v.gu + " / " + v.en,
          members.filter((m) => m.village === v.gu).length,
        ]);
      rows.push([]);
      section("બાકી વિનંતીઓ", "Pending requests");
      head([
        L("પ્રકાર", "Kind"),
        L("નામ", "Name"),
        L("નંબર", "Phone"),
        L("તબક્કો", "Stage"),
      ]);
      for (const r of requests)
        rows.push([
          r.kind,
          (r.payload || r.old || {}).nameGu || "",
          (r.payload || r.old || {}).phone,
          r.verification
            ? L("મુખ્ય એડમિન પાસે", "With main admin")
            : L("ગામ ચકાસણી બાકી", "Awaiting village verification"),
        ]);
      rows.push([]);
      section("આર્કાઇવ", "Archive");
      head([L("નામ", "Name"), L("નંબર", "Phone"), L("સ્થિતિ", "Status")]);
      for (const a of archive)
        rows.push([
          a.nameGu || a.name,
          a.phone,
          a.history?.[a.history.length - 1]?.reason || "",
        ]);
      rows.push([]);
      section("નામંજૂર નોંધણી", "Rejection ledger");
      head([L("નામ", "Name"), L("નંબર", "Phone"), L("કેટેગરી", "Category")]);
      for (const a of rejections) rows.push([a.name, a.phone, a.category]);
      rows.push([]);
      section(
        "છેલ્લી પ્રવૃત્તિ (વધુમાં વધુ ૫૦૦)",
        "Recent activity (up to 500)",
      );
      head([L("સમય", "When"), L("કરનાર", "Actor"), L("ક્રિયા", "Action")]);
      for (const a of audit) rows.push([iso(a.at), a.actor, a.action]);
    } else fail("Unknown report type");
    res.setHeader(
      "content-disposition",
      'attachment; filename="mvpmi-' + type + '.csv"',
    );
    res.type("text/csv; charset=utf-8");
    let serial = 0;
    const lines = rows.map((r) => {
      if (r && r.h) {
        serial = 0;
        return [L("\u0a95\u0acd\u0ab0\u0aae", "#"), ...r.h];
      }
      if (r && r.s) {
        serial = 0;
        return r.s;
      }
      if (!Array.isArray(r) || r.length < 2) return r || [];
      serial += 1;
      return [serial, ...r];
    });
    res.send("\uFEFF" + lines.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
  // The service worker must be able to control the whole site.
  app.get("/sw.js", (req, res, next) => {
    res.set("Service-Worker-Allowed", "/");
    res.set("Cache-Control", "no-cache");
    next();
  });
  app.use(express.static(staticDir, { index: "index.html" }));
  app.use((err, req, res, next) => {
    if (!err.status)
      console.error(
        "Unexpected server error:",
        err.name,
        err.message,
        err.stack.split("\n")[1],
      );
    const status = err.status || 500;
    res.status(status).json({
      error:
        err.type === "entity.parse.failed"
          ? "Invalid JSON"
          : err.type === "entity.too.large"
            ? "Request exceeds 10 MB"
            : status < 500
              ? err.message
              : "સર્વર ભૂલ · Server error. Please retry.",
    });
  });
  return { app, store };
}
