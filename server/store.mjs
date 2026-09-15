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
  { en: "Zinzaka", gu: "ઝીંજકા" },
];
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
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export const isRecord = (p) =>
  p !== null && typeof p === "object" && !Array.isArray(p);
const text = (v, min, max, label) => {
  if (
    typeof v !== "string" ||
    v.trim().length < min ||
    v.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(v)
  )
    fail("Invalid " + label);
  return v.trim();
};
export function profile(p) {
  if (!isRecord(p)) fail("Invalid profile");
  const name = text(p.name, 3, 120, "name"),
    nameGu = text(
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
    villages.find(
      (v) =>
        v.gu === p.village.trim() ||
        v.en.toLowerCase() === p.village.trim().toLowerCase(),
    );
  if (!village)
    fail(
      "આપેલા સાત ગામમાંથી પસંદ કરો · Choose one of the seven community villages",
    );
  if (p.label2 !== undefined && !["work", "other"].includes(p.label2))
    fail("Invalid second-number label");
  return {
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
  "name",
  "nameGu",
  "phone",
  "phone2",
  "label2",
  "village",
  "tehsil",
  "district",
];
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
  "members",
  "requests",
  "archive",
  "alerts",
  "sessions",
  "transports",
  "config",
  "audit",
  "limits",
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
    this.put("archive", {
      ...p,
      id: randomUUID(),
      snapshot: p,
      name: p.nameGu || p.name,
      nameLatin: p.name,
      place: [p.village, p.tehsil, p.district].join(", "),
      status: reason,
      when: new Date().toISOString(),
      archivedAt: Date.now(),
    });
  }
  unique(p, owner, excludeRequest) {
    if (
      this.all("members").some(
        (m) => m.phone === p.phone && m.owner !== owner,
      ) ||
      this.all("requests").some(
        (r) =>
          r.id !== excludeRequest &&
          r.owner !== owner &&
          r.payload?.phone === p.phone,
      )
    )
      fail(
        "આ નંબર પહેલેથી નોંધાયેલ છે · This phone already has a profile or request",
        409,
      );
  }
  remove(m, reason) {
    this.archive(m, reason);
    this.del("members", m.id);
    for (const r of this.all("requests").filter((r) => r.memberId === m.id))
      this.del("requests", r.id);
  }
  data() {
    return {
      members: this.all("members"),
      requests: this.all("requests"),
      archive: this.all("archive"),
    };
  }
  dataDigest() {
    return hash(JSON.stringify(this.data()));
  }
  snapshot() {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...this.data(),
    };
  }
  validateBackup(b) {
    const keys = (p, allowed) => {
      if (!isRecord(p) || Object.keys(p).some((k) => !allowed.includes(k)))
        fail("Unknown or invalid backup fields");
    };
    keys(b, ["schemaVersion", "exportedAt", "members", "requests", "archive"]);
    if (
      b.schemaVersion !== 1 ||
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
      const clean = profile(p);
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
      reserve(m.phone, m.owner);
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
      if (r.kind === "new") {
        canonical(r.payload);
        if (
          owners.has(r.owner) ||
          r.old !== undefined ||
          r.memberId !== undefined
        )
          fail("Conflicting enrollment");
        reserve(r.payload.phone, r.owner);
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
    return b;
  }
  restore(b, actor, expectedDigest) {
    this.validateBackup(b);
    this.tx(() => {
      if (expectedDigest !== undefined && expectedDigest !== this.dataDigest())
        fail(
          "Directory changed since restore preview. Validate the backup again.",
          409,
        );
      for (const t of ["members", "requests", "archive"]) {
        this.db.exec(`DELETE FROM ${t}`);
        for (const x of b[t]) this.put(t, x);
      }
      this.audit(actor, "restore", b.exportedAt);
    });
  }
}
