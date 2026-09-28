import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export const villages = [
  { en: "Thorala", gu: "થોરાળા" },
  { en: "Sathra", gu: "સથરા" },
  { en: "Taredi", gu: "તરેડી" },
  { en: "Lilvan", gu: "લીલવણ" },
  { en: "Dudhala No 1", gu: "દૂધાળા નં 1" },
  { en: "Talgajarada", gu: "તલગાજરડા" },
  { en: "Jinjaka", gu: "જીંજકા" },
];
// The village "ઝીંજકા" was renamed to "જીંજકા" (September 2026). Exact-string
// aliases keep existing databases, old backups and audit trails consistent.
export const VILLAGE_RENAMES = { "ઝીંજકા": "જીંજકા", Zinzaka: "Jinjaka" };
export const renameVillageText = (v) =>
  typeof v === "string" ? VILLAGE_RENAMES[v] || v : v;
export function applyVillageRenames(value) {
  if (Array.isArray(value)) return value.map(applyVillageRenames);
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value))
      value[key] = applyVillageRenames(value[key]);
    return value;
  }
  return renameVillageText(value);
}
export const hash = (x) => createHash("sha256").update(x).digest("hex");
export function passwordHash(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function passwordMatches(p, h) {
  if (
    typeof p !== "string" ||
    p.length > 128 ||
    typeof h !== "string" ||
    !/^\w{32}:[a-f0-9]{128}$/.test(h)
  )
    return false;
  const [salt, key] = h.split(":");
  return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, "hex"));
}
export function strong(p) {
  return (
    typeof p === "string" &&
    p.length >= 10 &&
    p.length <= 128 &&
    /[a-z]/.test(p) &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^a-zA-Z0-9]/.test(p)
  );
}
// Errors carry an optional machine-readable code (see web/strings.mjs "err.*")
// and extra fields (for example the lockout end time).
export function fail(message, status = 400, code, extra) {
  throw Object.assign(new Error(message), {
    status,
    ...(code ? { code } : {}),
    ...(extra || {}),
  });
}
export const isRecord = (p) =>
  p !== null && typeof p === "object" && !Array.isArray(p);
export const text = (v, min, max, label) => {
  if (
    typeof v !== "string" ||
    v.trim().length < min ||
    v.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(v)
  )
    fail("Invalid " + label);
  return v.trim();
};
// Full names are entered and stored in three parts; the composed full name
// keeps search, sorting, export and display working unchanged.
export const nameParts = (name) => {
  const tokens = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: tokens[0] || "",
    middleName: tokens.slice(1, -1).join(" "),
    surname: tokens.length > 1 ? tokens[tokens.length - 1] : "",
  };
};
export function profile(p, registry = villages) {
  if (!isRecord(p)) fail("Invalid profile");
  let firstName, middleName, surname;
  if (p.firstName === undefined && p.middleName === undefined && p.surname === undefined) {
    // Legacy callers still send a single full name; split it once.
    text(p.name, 3, 120, "name");
    ({ firstName, middleName, surname } = nameParts(p.name));
  } else {
    firstName = text(p.firstName, 2, 60, "first name");
    middleName =
      p.middleName === undefined || p.middleName === ""
        ? ""
        : text(p.middleName, 2, 60, "middle name");
    surname = text(p.surname, 2, 60, "surname");
  }
  const name = [firstName, middleName, surname].filter(Boolean).join(" ");
  text(name, 3, 120, "name");
  const nameGu = text(
    p.nameGu === undefined ? name : p.nameGu,
    3,
    120,
    "Gujarati name",
  );
  const number = (value, optional) => {
    if (optional && (value === undefined || value === "")) return "";
    if (
      typeof value !== "string" ||
      value.length > 24 ||
      !/^[\d\s()+-]+$/.test(value)
    )
      fail("Invalid phone number");
    const d = value.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(d))
      fail("નંબર બરાબર લખો · Enter a valid 10-digit mobile number");
    return d;
  };
  const phone = number(p.phone, false),
    phone2 = number(p.phone2, true);
  if (phone2 === phone) fail("Both numbers must be different");
  const village =
    typeof p.village === "string" &&
    registry.find(
      (v) =>
        v.gu === p.village.trim() ||
        v.en.toLowerCase() === p.village.trim().toLowerCase(),
    );
  if (!village)
    fail("યાદીમાંથી ગામ પસંદ કરો · Choose a community village from the list");
  if (p.label2 !== undefined && !["work", "other"].includes(p.label2))
    fail("Invalid second-number label");
  return {
    ...(p.currentLocation !== undefined
      ? { currentLocation: text(p.currentLocation, 0, 240, "current location") }
      : {}),
    firstName,
    middleName,
    surname,
    name,
    nameGu,
    phone,
    phone2,
    label2: p.label2 || "work",
    village: village.gu,
    tehsil: "મહુવા",
    district: "ભાવનગર",
  };
}
export const profileKeys = [
  "currentLocation",
  "firstName",
  "middleName",
  "surname",
  "name",
  "nameGu",
  "phone",
  "phone2",
  "label2",
  "village",
  "tehsil",
  "district",
];
// A member record without its login secrets and one-time notices. Used for
// every copy of a member (requests, archive, backups) so PIN / PASSWORD
// hashes stay only on the live member record.
export const memberRecord = (m) => {
  if (!m || typeof m !== "object") return m;
  const { cred, notice, ...rest } = m;
  return rest;
};
// Never return a stored record wholesale, even after administrator restore.
export const publicProfile = (p) =>
  Object.fromEntries(
    ["id", ...profileKeys]
      .filter((k) => p[k] !== undefined)
      .map((k) => [k, p[k]]),
  );
const memberKeys = [
  "id",
  "owner",
  ...profileKeys,
  "createdAt",
  "approvedAt",
  "approvedBy",
  "consentAt",
  "consentVersion",
];
const tables = new Set([
  "villages",
  "villageAdmins",
  "rejections",
  "members",
  "requests",
  "archive",
  "alerts",
  "sessions",
  "transports",
  "recoveries",
  "config",
  "audit",
  "limits",
  "notifications",
  "devices",
  "pushSubs",
  // "Forgot PIN?" requests waiting for a Village Admin (Section 4).
  "pinResets",
]);
const table = (t) => {
  if (!tables.has(t)) throw new Error("Unknown database table");
  return t;
};
export class Store {
  constructor(path) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    for (const t of tables)
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
      );
    this.initializeVillages();
    this.initializeVillageRenames();
    this.initializeNameParts();
  }
  // Rename "ઝીંજકા" → "જીંજકા" everywhere (idempotent). Exact-string values
  // only, so member names and reasons are never touched.
  initializeVillageRenames() {
    if (this.get("config", "village-rename-jinjaka-v1")) return;
    this.tx(() => {
      for (const table of [
        "villages",
        "villageAdmins",
        "members",
        "requests",
        "archive",
        "rejections",
      ]) {
        for (const row of this.all(table)) {
          const next = applyVillageRenames(structuredClone(row));
          if (next === row) continue;
          if (next.id !== row.id) this.del(table, row.id);
          this.put(table, next);
        }
      }
      this.put("config", { id: "village-rename-jinjaka-v1", at: Date.now() });
    });
  }
  // Fill three-part names for records created before the split (idempotent).
  initializeNameParts() {
    if (this.get("config", "name-parts-v1")) return;
    const split = (record) => {
      if (record && !record.firstName && record.name) {
        const parts = nameParts(record.name);
        record.firstName = parts.firstName;
        record.middleName = parts.middleName;
        record.surname = parts.surname;
      }
      return record;
    };
    this.tx(() => {
      for (const m of this.all("members")) this.put("members", split(m));
      for (const r of this.all("requests")) {
        if (r.payload) split(r.payload);
        if (r.old) split(r.old);
        this.put("requests", r);
      }
      for (const a of this.all("archive")) this.put("archive", split(a));
      this.put("config", { id: "name-parts-v1", at: Date.now() });
    });
  }
  initializeVillages() {
    if (this.get("config", "village-workflow-v1")) return;
    this.tx(() => {
      villages.forEach((v, i) =>
        this.put("villages", { ...v, id: v.gu, order: i }),
      );
      for (const a of this.all("archive")) {
        if (!a.snapshot?.id && !a.approvedAt) {
          this.rejectRequest(
            { id: a.id, payload: a.snapshot || a, owner: a.owner },
            "closed",
            a.status || "Legacy request",
            "migration",
            "legacy",
            "legacy",
          );
          this.del("archive", a.id);
        }
      }
      this.db.exec("DELETE FROM recoveries");
      this.put("config", { id: "village-workflow-v1", at: Date.now() });
    });
  }
  rejectRequest(r, action, reason, actor, level, category = "other") {
    if (
      ![
        "not-community",
        "duplicate",
        "insufficient",
        "other",
        "legacy",
      ].includes(category)
    )
      fail("Invalid rejection category");
    const p = r.payload || r.old;
    const previous = this.all("rejections").find((a) => a.phone === p.phone);
    this.put("rejections", {
      id: previous?.id || randomUUID(),
      name: p.nameGu || p.name,
      phone: p.phone,
      phone2: p.phone2 || "",
      village: p.village,
      category,
      events: [
        ...(previous?.events || []),
        {
          requestId: r.id || randomUUID(),
          owner: r.owner,
          action,
          reason,
          actor,
          actorName: this.get("members", actor)?.nameGu || actor,
          level,
          category,
          at: Date.now(),
          snapshot: publicProfile(p),
        },
      ],
    });
  }
  all(t) {
    return this.db
      .prepare(`SELECT data FROM ${table(t)} ORDER BY id`)
      .all()
      .map((x) => JSON.parse(x.data));
  }
  get(t, id) {
    const x = this.db
      .prepare(`SELECT data FROM ${table(t)} WHERE id=?`)
      .get(String(id));
    return x ? JSON.parse(x.data) : null;
  }
  put(t, x) {
    this.db
      .prepare(
        `INSERT INTO ${table(t)}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(String(x.id), JSON.stringify(x));
    return x;
  }
  del(t, id) {
    this.db.prepare(`DELETE FROM ${table(t)} WHERE id=?`).run(String(id));
  }
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(actor, action, id) {
    this.put("audit", {
      id: randomUUID(),
      actor,
      action,
      target: id,
      at: Date.now(),
    });
  }
  archive(p, reason) {
    if (!p.id && !p.approvedAt) {
      this.rejectRequest(
        { payload: p, owner: p.owner },
        "closed",
        reason,
        "system",
        "system",
      );
      return;
    }
    const previous = this.all("archive").find(
      (a) => a.personId === p.id || a.snapshot?.id === p.id,
    );
    const numbers = [
      ...new Set(
        [...(previous?.numbers || []), p.phone, p.phone2].filter(Boolean),
      ),
    ];
    if (
      this.all("archive").some(
        (a) =>
          a.id !== previous?.id &&
          [a.phone, a.phone2, ...(a.numbers || [])].some(
            (n) => n && numbers.includes(n),
          ),
      )
    )
      fail("Archive phone conflict needs main-admin review", 409);
    this.put("archive", {
      ...p,
      id: previous?.id || randomUUID(),
      personId: p.id,
      numbers,
      history: [...(previous?.history || []), { at: Date.now(), reason }],
      snapshot: p,
      name: p.nameGu || p.name,
      nameLatin: p.name,
      place: [p.village, p.tehsil, p.district].join(", "),
      status: reason,
      when: new Date().toISOString(),
      archivedAt: Date.now(),
    });
  }
  unique(p, owner, excludeRequest, allowClaim = false) {
    const numbers = [p.phone, p.phone2].filter(Boolean);
    if (
      this.all("members").some(
        (m) =>
          m.owner !== owner &&
          [m.phone, m.phone2].some((n) => n && numbers.includes(n)) &&
          !(allowClaim && m.phone === p.phone),
      ) ||
      this.all("requests").some(
        (r) =>
          r.id !== excludeRequest &&
          r.owner !== owner &&
          [r.payload?.phone, r.payload?.phone2].some(
            (n) => n && numbers.includes(n),
          ),
      )
    )
      fail(
        "આ નંબર પહેલેથી નોંધાયેલ છે. મદદ માટે તમારા ગામના એડમિનનો સંપર્ક કરો · This phone already has a profile or pending application. Contact your village administrator for help.",
        409,
      );
  }
  dropAssignments(memberId) {
    for (const a of this.all("villageAdmins").filter(
      (a) => a.memberId === memberId,
    )) {
      this.del("villageAdmins", a.id);
      for (const r of this.all("requests").filter(
        (r) => r.payload?.village === a.id && r.verification,
      )) {
        r.reviewHistory = [...(r.reviewHistory || []), r.verification];
        delete r.verification;
        this.put("requests", r);
      }
    }
  }
  remove(m, reason) {
    this.del("recoveries", m.id);
    this.del("pinResets", m.id);
    for (const f of this.all("pinResets").filter((x) => x.memberId === m.id))
      this.del("pinResets", f.id);
    this.dropAssignments(m.id);
    this.archive(memberRecord(m), reason);
    this.del("members", m.id);
    for (const r of this.all("requests").filter((r) => r.memberId === m.id))
      this.del("requests", r.id);
  }
  data() {
    return {
      villages: this.all("villages"),
      villageAdmins: this.all("villageAdmins").map(({ pass, ...a }) => a),
      rejections: this.all("rejections"),
      // PIN / PASSWORD hashes and one-time notices never leave the server.
      members: this.all("members").map(memberRecord),
      requests: this.all("requests").map((r) => (r.old ? { ...r, old: memberRecord(r.old) } : r)),
      archive: this.all("archive").map((a) => ({
        ...memberRecord(a),
        ...(a.snapshot ? { snapshot: memberRecord(a.snapshot) } : {}),
      })),
    };
  }
  dataDigest() {
    return hash(JSON.stringify(this.data()));
  }
  snapshot() {
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      ...this.data(),
    };
  }
  validateBackup(b) {
    // Backups exported before the ઝીંજકા → જીંજકા rename keep working.
    applyVillageRenames(b);
    // Older backups predate the three-part names; derive the parts on import.
    const withNameParts = (record) => {
      if (record && isRecord(record) && !record.firstName && record.name) {
        const parts = nameParts(record.name);
        return {
          ...record,
          firstName: parts.firstName,
          middleName: parts.middleName,
          surname: parts.surname,
        };
      }
      return record;
    };
    b = {
      ...b,
      members: b.members?.map(withNameParts),
      archive: b.archive?.map(withNameParts),
      requests: b.requests?.map((r) =>
        r && isRecord(r)
          ? {
              ...r,
              ...(r.payload ? { payload: withNameParts(r.payload) } : {}),
              ...(r.old ? { old: withNameParts(r.old) } : {}),
            }
          : r,
      ),
    };
    const keys = (p, allowed) => {
      if (!isRecord(p) || Object.keys(p).some((k) => !allowed.includes(k)))
        fail("Unknown or invalid backup fields");
    };
    keys(b, [
      "schemaVersion",
      "exportedAt",
      "members",
      "requests",
      "archive",
      "villages",
      "villageAdmins",
      "rejections",
    ]);
    const registry = b.schemaVersion === 2 ? b.villages : villages;
    if (
      !Array.isArray(registry) ||
      registry.length < 7 ||
      registry.length > 1000
    )
      fail("Invalid villages backup");
    const villageIds = new Set(),
      englishNames = new Set();
    for (const v of registry) {
      text(v.gu, 2, 80, "village");
      text(v.en, 2, 80, "village");
      if (b.schemaVersion === 2) {
        keys(v, ["id", "gu", "en", "order"]);
        if (v.id !== v.gu || !Number.isInteger(v.order))
          fail("Invalid village record");
      }
      if (villageIds.has(v.gu) || englishNames.has(v.en.toLowerCase()))
        fail("Duplicate village");
      villageIds.add(v.gu);
      englishNames.add(v.en.toLowerCase());
    }
    if (
      villages.some(
        (v) => !registry.some((x) => x.gu === v.gu && x.en === v.en),
      )
    )
      fail("Original villages must be retained");
    if (
      ![1, 2].includes(b.schemaVersion) ||
      typeof b.exportedAt !== "string" ||
      !Number.isFinite(Date.parse(b.exportedAt)) ||
      !["members", "requests", "archive"].every(
        (k) => Array.isArray(b[k]) && b[k].length <= 50000,
      )
    )
      fail("Unsupported or invalid backup");
    const id = (x) => text(x, 1, 128, "record identity");
    const canonical = (p, allowed = profileKeys) => {
      keys(p, allowed);
      const clean = profile(p, registry);
      if (profileKeys.some((k) => p[k] !== clean[k]))
        fail("Backup profiles must use canonical, complete fields");
    };
    const member = (p) => {
      canonical(p, memberKeys);
      id(p.id);
      id(p.owner);
      for (const k of ["createdAt", "approvedAt", "consentAt"])
        if (p[k] !== undefined && (!Number.isFinite(p[k]) || p[k] < 0))
          fail("Invalid timestamp");
      for (const k of ["approvedBy", "consentVersion"])
        if (p[k] !== undefined) id(p[k]);
    };
    const ids = new Set(),
      memberPhones = new Set(),
      phones = new Map(),
      owners = new Set(),
      byId = new Map();
    const reserve = (phone, owner) => {
      if (phones.has(phone) && phones.get(phone) !== owner)
        fail("Conflicting phone in backup");
      phones.set(phone, owner);
    };
    for (const m of b.members) {
      member(m);
      if (ids.has(m.id) || phones.has(m.phone) || owners.has(m.owner))
        fail("Duplicate member");
      ids.add(m.id);
      memberPhones.add(m.phone);
      reserve(m.phone, m.owner);
      if (m.phone2) reserve(m.phone2, m.owner);
      owners.add(m.owner);
      byId.set(m.id, m);
    }
    const requestIds = new Set(),
      open = new Set();
    for (const r of b.requests) {
      keys(r, [
        "id",
        "owner",
        "kind",
        "memberId",
        "old",
        "payload",
        "createdAt",
        "consentAt",
        "consentVersion",
        "reason",
        "verification",
        "reviewHistory",
        "proposedBy",
        "rejectedBefore",
        "corrections",
        "selfAdmin",
      ]);
      id(r.id);
      id(r.owner);
      if (
        requestIds.has(r.id) ||
        !["new", "update", "delete"].includes(r.kind) ||
        open.has(r.kind + ":" + r.owner)
      )
        fail("Invalid or duplicate request");
      requestIds.add(r.id);
      open.add(r.kind + ":" + r.owner);
      for (const key of ["createdAt", "consentAt"])
        if (
          (key === "createdAt" || r[key] !== undefined) &&
          (!Number.isFinite(r[key]) || r[key] < 0)
        )
          fail("Invalid request timestamp");
      if (r.consentVersion !== undefined) id(r.consentVersion);
      if (r.proposedBy !== undefined) id(r.proposedBy);
      if (r.selfAdmin !== undefined && typeof r.selfAdmin !== "boolean")
        fail("Invalid request flag");
      if (r.rejectedBefore !== undefined && r.rejectedBefore !== null) {
        keys(r.rejectedBefore, ["at", "reason", "actorName"]);
        if (
          (r.rejectedBefore.at !== null && !Number.isFinite(r.rejectedBefore.at)) ||
          typeof r.rejectedBefore.reason !== "string" ||
          typeof r.rejectedBefore.actorName !== "string"
        )
          fail("Invalid request history");
      }
      if (r.corrections !== undefined) {
        if (!Array.isArray(r.corrections) || r.corrections.length > 1000)
          fail("Invalid request corrections");
        for (const c of r.corrections) {
          keys(c, ["by", "at", "before"]);
          id(c.by);
          if (!Number.isFinite(c.at) || !isRecord(c.before))
            fail("Invalid request corrections");
        }
      }
      if (r.kind === "new") {
        canonical(r.payload);
        if (
          owners.has(r.owner) ||
          r.old !== undefined ||
          r.memberId !== undefined
        )
          fail("Conflicting enrollment");
        // A pending device-replacement application legitimately reuses an
        // active member's own number (the main administrator decides it).
        if (!memberPhones.has(r.payload.phone)) reserve(r.payload.phone, r.owner);
        if (r.payload.phone2) reserve(r.payload.phone2, r.owner);
      } else {
        const m = byId.get(r.memberId);
        if (!m || m.owner !== r.owner) fail("Orphan request");
        member(r.old);
        if (r.old.id !== m.id || r.old.owner !== r.owner)
          fail("Invalid request base owner");
        if (r.kind === "update") {
          canonical(r.payload);
          reserve(r.payload.phone, r.owner);
        } else {
          text(r.reason, 1, 500, "deletion reason");
          if (r.payload !== undefined) fail("Unexpected deletion payload");
        }
      }
    }
    const archiveIds = new Set();
    for (const a of b.archive) {
      keys(a, [
        ...memberKeys,
        "snapshot",
        "nameLatin",
        "place",
        "status",
        "when",
        "archivedAt",
        "personId",
        "numbers",
        "history",
        "rejoinAllowed",
        "rejoinAllowedAt",
        "rejoinAllowedBy",
      ]);
      id(a.id);
      if (archiveIds.has(a.id)) fail("Duplicate archive record");
      archiveIds.add(a.id);
      text(a.name, 1, 120, "archive name");
      text(a.status, 1, 512, "archive reason");
      for (const k of [
        "nameGu",
        "nameLatin",
        "phone",
        "phone2",
        "label2",
        "village",
        "tehsil",
        "district",
        "owner",
        "approvedBy",
        "consentVersion",
        "place",
        "when",
      ])
        if (a[k] !== undefined) text(a[k], 0, 512, k);
      for (const k of ["archivedAt", "createdAt", "approvedAt", "consentAt"])
        if (a[k] !== undefined && (!Number.isFinite(a[k]) || a[k] < 0))
          fail("Invalid archive timestamp");
      if (a.snapshot !== undefined) {
        if (!isRecord(a.snapshot)) fail("Invalid archive snapshot");
        if (a.snapshot.id !== undefined) member(a.snapshot);
        else canonical(a.snapshot);
      }
    }
    if (b.schemaVersion === 2) {
      if (
        !Array.isArray(b.villageAdmins) ||
        !Array.isArray(b.rejections) ||
        b.rejections.length > 50000
      )
        fail("Invalid governance backup");
      const assigned = new Set();
      for (const a of b.villageAdmins) {
        keys(a, [
          "id",
          "memberId",
          "version",
          "assignedAt",
          "assignedBy",
          "reason",
          "username",
          "passChangedAt",
          "disabled",
          "disabledAt",
          "disabledBy",
        ]);
        if (a.username !== undefined && !/^\d{10}$/.test(a.username))
          fail("Invalid administrator username");
        if (a.pass !== undefined)
          fail("Administrator password hashes must not be exported");
        if (
          a.passChangedAt !== undefined &&
          (!Number.isFinite(a.passChangedAt) || a.passChangedAt < 0)
        )
          fail("Invalid password date");
        const m = byId.get(a.memberId);
        if (
          !m ||
          m.village !== a.id ||
          assigned.has(a.id) ||
          !villageIds.has(a.id)
        )
          fail("Invalid village assignment");
        assigned.add(a.id);
        id(a.version);
        id(a.assignedBy);
        text(a.reason, 5, 500, "assignment reason");
        if (!Number.isFinite(a.assignedAt)) fail("Invalid assignment date");
      }
      const rejectedPhones = new Set();
      for (const r of b.rejections) {
        keys(r, [
          "id",
          "name",
          "phone",
          "phone2",
          "village",
          "category",
          "events",
        ]);
        id(r.id);
        text(r.name, 1, 120, "name");
        if (r.reason !== undefined && typeof r.reason !== "string")
          fail("Invalid rejection reason");
        if (
          !/^[6-9]\d{9}$/.test(r.phone) ||
          rejectedPhones.has(r.phone) ||
          !Array.isArray(r.events) ||
          r.events.length > 10000
        )
          fail("Invalid rejection records");
        rejectedPhones.add(r.phone);
        for (const e of r.events) {
          keys(e, [
            "requestId",
            "owner",
            "action",
            "reason",
            "actor",
            "actorName",
            "level",
            "category",
            "at",
            "snapshot",
          ]);
          id(e.requestId);
          if (e.reason !== undefined && typeof e.reason !== "string")
            fail("Invalid rejection reason");
          id(e.actor);
          id(e.level);
          id(e.action);
          if (!Number.isFinite(e.at)) fail("Invalid rejection date");
          canonical(e.snapshot);
        }
      }
    }
    const archivedPhones = new Set();
    for (const a of b.archive) {
      if (
        a.numbers !== undefined &&
        (!Array.isArray(a.numbers) ||
          a.numbers.some((n) => !/^[6-9]\d{9}$/.test(n)))
      )
        fail("Invalid archive numbers");
      for (const n of new Set(
        [a.phone, a.phone2, ...(a.numbers || [])].filter(Boolean),
      )) {
        if (archivedPhones.has(n)) fail("Duplicate archive phone");
        archivedPhones.add(n);
      }
      if (
        a.history !== undefined &&
        (!Array.isArray(a.history) ||
          a.history.length > 10000 ||
          a.history.some(
            (e) =>
              !Number.isFinite(e.at) ||
              typeof e.reason !== "string" ||
              e.reason.length > 512,
          ))
      )
        fail("Invalid archive history");
    }
    return b;
  }
  restore(b, actor, expectedDigest, keepSessionId) {
    this.validateBackup(b);
    // PIN / PASSWORD hashes are never exported. Everyone keeps their current
    // login when their record is restored; a person who has no login on this
    // server needs a TEMP PIN from an admin. The Main Admin is always kept.
    const creds = new Map(
      this.all("members").filter((m) => m.cred).map((m) => [m.id, m.cred]),
    );
    const mainId = this.get("config", "main-admin")?.memberId;
    const mainRecord = mainId ? this.get("members", mainId) : null;
    this.tx(() => {
      if (expectedDigest !== undefined && expectedDigest !== this.dataDigest())
        fail(
          "Directory changed since restore preview. Validate the backup again.",
          409,
        );
      this.db.exec("DELETE FROM recoveries");
      for (const t of [
        "members",
        "requests",
        "archive",
        "villages",
        "villageAdmins",
        "rejections",
      ]) {
        this.db.exec(`DELETE FROM ${t}`);
        for (const raw of b[t] ||
          (t === "villages"
            ? villages.map((v, i) => ({ ...v, id: v.gu, order: i }))
            : [])) {
          const x = structuredClone(raw);
          if (t === "requests") {
            delete x.verification;
            delete x.reviewHistory;
          }
          if (t === "villageAdmins") {
            delete x.pass;
            x.version = randomUUID();
          }
          if (t === "members" && creds.has(x.id)) x.cred = creds.get(x.id);
          this.put(t, x);
        }
      }
      if (mainRecord) {
        const clash = this.all("members").find(
          (m) => m.phone === mainRecord.phone && m.id !== mainRecord.id,
        );
        if (clash) this.del("members", clash.id);
        this.put("members", mainRecord);
      }
      // Everyone else logs in again after a restore (the Main Admin who ran
      // it stays logged in on this phone).
      for (const s of this.all("sessions"))
        if (s.id !== keepSessionId && (s.auth || s.adminMode)) {
          delete s.auth;
          delete s.adminMode;
          this.put("sessions", s);
        }
      this.audit(actor, "restore", b.exportedAt);
    });
  }
  // Housekeeping: expired sessions, rate-limit windows, transports, device
  // tokens and old notifications. Anonymous sessions that never applied
  // are dropped after two days so crawlers cannot grow the database.
  cleanup(now = Date.now()) {
    const owners = new Set([
      ...this.all("members").map((m) => m.owner),
      ...this.all("requests").map((r) => r.owner),
    ]);
    this.tx(() => {
      for (const s of this.all("sessions")) {
        const idle =
          !owners.has(s.owner) &&
          !s.auth &&
          !s.aliasOf &&
          (s.createdAt || 0) < now - 2 * 86400000;
        if (s.expires <= now || idle || (s.aliasOf && s.aliasUntil < now))
          this.del("sessions", s.id);
      }
      for (const l of this.all("limits"))
        if (l.until < now) this.del("limits", l.id);
      for (const t of this.all("transports"))
        if (t.expiresAt <= now) this.del("transports", t.id);
      const liveSessions = new Set(this.all("sessions").map((s) => s.id));
      for (const t of ["devices", "pushSubs"])
        for (const d of this.all(t))
          if (!liveSessions.has(d.sessionId)) this.del(t, d.id);
      for (const n of this.all("notifications"))
        if (n.at < now - 60 * 86400000) this.del("notifications", n.id);
    });
  }
}
