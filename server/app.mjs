import {
  installVillageApproval,
  villageState,
  assertVerified,
  needsVerification,
  activeAdminMember,
} from "./village-approval.mjs";
import { isDeepStrictEqual } from "node:util";
import { installSessions } from "./session.mjs";
import express from "express";
import ExcelJS from "exceljs";
import { randomUUID, randomBytes, randomInt } from "node:crypto";
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
export function createApp({
  dbPath = "data/community.sqlite",
  adminPassword,
  gateCode,
  secure = false,
  sms,
  adminPhone = "",
  development = false,
} = {}) {
  const store = new Store(dbPath),
    app = express();
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
    const origin = req.get("Origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host"))
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
  installSessions(app, store, { development, secure, rate });
  const admin = (req, res, next) =>
    req.isAdmin
      ? next()
      : res.status(403).json({ error: "Admin authentication required" });
  const member = (req) => {
    const m = store.all("members").find((m) => m.owner === req.session.owner);
    if (!m) fail("Admin approval required", 403);
    return m;
  };
  const alert = (req, title) =>
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
  const state = (req) => {
    const me =
        store.all("members").find((m) => m.owner === req.session.owner) ||
        activeAdminMember(store, req),
      requests = store.all("requests");
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
      members: req.isAdmin || me ? store.all("members").map(publicProfile) : [],
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
  installVillageApproval(app, store, { admin, state, rate });
  app.get("/api/state", (req, res) => res.json(state(req)));
  app.post("/api/enrollment", (req, res) => {
    rate("enroll:" + req.session.id, 30, 3600000);
    if (store.all("members").some((m) => m.owner === req.session.owner))
      fail("Already approved", 409);
    if (
      !development &&
      req.session.verifiedPhone !== String(req.body.phone).replace(/\D/g, "")
    )
      fail("Phone verification required", 403);
    if (req.body.consent !== true) fail("Consent is required");
    const p = profile(req.body, store.all("villages"));
    if (!store.get("villageAdmins", p.village))
      fail(
        "આ ગામ માટે ગામ એડમિન હજુ નિયુક્ત નથી · This village has no administrator yet. Enrollment opens after the main administrator appoints one.",
        409,
      );
    store.unique(p, req.session.owner, undefined, true);
    // Item: a phone that was rejected before shows a warning to both
    // administrator levels while the new request is being decided.
    const priorRejection =
      store.all("rejections").find(
        (a) => a.phone === p.phone || (a.phone2 && a.phone2 === p.phone),
      ) ||
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
    const lastEvent =
      priorRejection?.events?.[priorRejection.events.length - 1];
    store.tx(() => {
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
    res.json(state(req));
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
    res.json(state(req));
  });
  app.post("/api/profile/update", (req, res) => {
    const m = member(req),
      p = profile(req.body, store.all("villages"));
    store.unique(p, m.owner);
    if (
      !development &&
      p.phone !== m.phone &&
      req.session.verifiedPhone !== p.phone
    )
      fail("Verify the new phone number first", 403);
    store.tx(() => {
      for (const r of store
        .all("requests")
        .filter((r) => r.owner === m.owner && r.kind === "update"))
        store.del("requests", r.id);
      store.put("requests", {
        id: randomUUID(),
        owner: m.owner,
        kind: "update",
        memberId: m.id,
        old: m,
        payload: p,
        createdAt: Date.now(),
      });
    });
    res.json(state(req));
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
    res.json(state(req));
  });
  app.post("/api/admin/gate", (req, res) => {
    rate("gate:" + req.session.id);
    rate("gate-ip:" + req.socket.remoteAddress, 30);
    const a = store.get("config", "admin");
    if (!passwordMatches(String(req.body.code || ""), a.gate)) {
      alert(req, "ખોટો કોડ · Incorrect access code");
      fail("Incorrect access code", 401);
    }
    req.session.gateUntil = Date.now() + 300000;
    store.put("sessions", req.session);
    res.json({ ok: true });
  });
  app.post("/api/admin/login", (req, res) => {
    rate("login:" + req.session.id);
    rate("login-global", 30);
    if (!(req.session.gateUntil > Date.now()))
      fail("Access code required", 403);
    const a = store.get("config", "admin");
    if (
      req.body.user !== a.username ||
      !passwordMatches(String(req.body.pass || ""), a.password)
    ) {
      alert(req, "લોગિન નિષ્ફળ · Failed admin login");
      fail("Wrong username or password", 401);
    }
    req.session.adminUntil = Date.now() + 30 * 60000;
    store.put("sessions", req.session);
    req.isAdmin = true;
    store.audit(req.session.owner, "admin.login", a.id);
    res.json(state(req));
  });
  app.post("/api/admin/logout", (req, res) => {
    delete req.session.adminUntil;
    delete req.session.gateUntil;
    store.put("sessions", req.session);
    req.isAdmin = false;
    res.json(state(req));
  });
  app.post("/api/admin/reset/send", async (req, res) => {
    if (!req.isAdmin && !(req.session.gateUntil > Date.now()))
      fail("Access code required", 403);
    if (!sms || !/^\+91[6-9]\d{9}$/.test(adminPhone))
      fail("SMS recovery is not configured. Contact the server operator.", 503);
    if (store.get("config", "reset-lock")?.until > Date.now())
      fail("Reset temporarily locked. Try again in 15 minutes.", 429);
    rate("reset-session:" + req.session.id, 1, 60000);
    rate("reset-global", 5, 3600000);
    const otp = String(randomInt(100000, 1000000));
    req.session.reset = {
      hash: hash(otp),
      expires: Date.now() + 600000,
      attempts: 0,
    };
    store.put("sessions", req.session);
    try {
      await sms(adminPhone, otp);
    } catch {
      const latest = store.get("sessions", req.session.id);
      delete latest.reset;
      store.put("sessions", latest);
      fail("SMS delivery failed. Please retry later.", 503);
    }
    res.json({ ok: true, phone: adminPhone.slice(-4) });
  });
  app.post("/api/admin/reset", (req, res) => {
    if (store.get("config", "reset-lock")?.until > Date.now())
      fail("Reset temporarily locked. Try again in 15 minutes.", 429);
    const r = req.session.reset;
    if (!r || r.expires < Date.now()) fail("Code expired. Request a new code");
    if (hash(String(req.body.otp)) !== r.hash) {
      r.attempts++;
      store.put("sessions", req.session);
      if (r.attempts >= 5) {
        store.put("config", { id: "reset-lock", until: Date.now() + 900000 });
        fail("Too many attempts. Reset locked for 15 minutes.", 429);
      }
      fail("Incorrect code");
    }
    if (!strong(req.body.password))
      fail("Use 10+ characters, upper/lowercase, a number and a symbol");
    const a = store.get("config", "admin");
    a.password = passwordHash(req.body.password);
    a.changedAt = Date.now();
    store.put("config", a);
    for (const s of store.all("sessions")) {
      delete s.adminUntil;
      delete s.reset;
      delete s.gateUntil;
      store.put("sessions", s);
    }
    res.json({ ok: true });
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
    res.json(state(req));
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
    res.json(state(req));
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
            store.del("members", existing.id);
            store.audit(
              req.session.owner,
              "member.device-replacement",
              existing.id,
            );
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
          } else store.remove(m, "દૂર કરી · Removed on request");
        }
      } else if (needsVerification(r)) {
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
    res.json(state(req));
  });
  app.post("/api/admin/members/:id", admin, (req, res) => {
    const m = store.get("members", req.params.id);
    if (!m) fail("Member not found", 404);
    const p = profile(req.body, store.all("villages"));
    if (p.village !== m.village)
      fail("Village changes require the destination village review", 409);
    store.unique(p, m.owner);
    store.tx(() => {
      store.put("members", { ...m, ...p });
      store.audit(req.session.owner, "member.edit", m.id);
    });
    res.json(state(req));
  });
  app.post("/api/admin/members/:id/delete", admin, (req, res) => {
    const m = store.get("members", req.params.id);
    if (!m) fail("Member not found", 404);
    store.tx(() => {
      store.remove(m, "એડમિને દૂર કરી · Deleted by admin");
      store.audit(req.session.owner, "member.delete", m.id);
    });
    res.json(state(req));
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
    res.json(state(req));
  });
  app.get("/api/admin/backup", admin, (req, res) => {
    store.put("config", { id: "backup", when: new Date().toISOString() });
    store.audit(req.session.owner, "backup.export", "database");
    res.attachment("mvpmi-backup.json").json(store.snapshot());
  });
  app.post("/api/admin/restore/validate", admin, (req, res) => {
    const b = store.validateBackup(req.body);
    res.json({
      members: b.members.length,
      requests: b.requests.length,
      archive: b.archive.length,
      currentMembers: store.all("members").length,
      digest: hash(JSON.stringify(b)),
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
    res.json(state(req));
  });
  app.get("/api/admin/export.xlsx", admin, async (req, res) => {
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet(req.query.lang === "en" ? "Community" : "સમાજ");
    const englishHeaders = [
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
    for (const m of store.all("members"))
      sheet.addRow([
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
    const text = String(value ?? "");
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
    const head = (cells) => rows.push(cells);
    const section = (gu, en) => rows.push([L(gu, en)]);
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
    res.send("\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
  app.use(express.static("dist", { index: "index.html" }));
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
