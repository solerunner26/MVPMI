// Log in with the mobile number only (Members, Village Admins) or mobile +
// PASSWORD (the Main Admin), password changes and admin mode.
//
// Only the Main Admin has a credential. It lives on the member record under
// `cred`, hashed with bcrypt, and is never returned by any API, never
// exported in backups and never written to logs.
//
//   cred = {
//     password: bcrypt hash of the Main Admin PASSWORD
//     initial?: true while it is the first-login-only password
//     stamp:    changes whenever the password changes; sessions made with an
//               older stamp are logged out
//     fails, until: wrong attempts and lockout end (5 wrong → 5 minutes)
//   }
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { fail, profile, nameParts } from "./store.mjs";
import {
  ROLES,
  isPasswordFormat,
  MAX_WRONG_ATTEMPTS,
  LOCKOUT_MS,
} from "./terms.mjs";

const ROUNDS = 10;
export const hashSecret = (secret) => bcrypt.hashSync(String(secret), ROUNDS);
export const secretMatches = (secret, hashed) =>
  typeof secret === "string" &&
  secret.length <= 128 &&
  typeof hashed === "string" &&
  hashed.startsWith("$2") &&
  bcrypt.compareSync(secret, hashed);
// Compared against when a number has no credential, so a wrong number and a
// wrong PIN take the same time.
const DUMMY_HASH = hashSecret("not-a-real-secret");

export const mobileDigits = (raw) => String(raw ?? "").replace(/\D/g, "").replace(/^91(?=[6-9]\d{9}$)/, "");
export const isMobile = (digits) => /^[6-9]\d{9}$/.test(digits);

export const mainAdminId = (store) => store.get("config", "main-admin")?.memberId || null;

export function accountRole(store, member) {
  if (!member) return null;
  if (member.id === mainAdminId(store)) return ROLES.MAIN_ADMIN;
  const a = store.get("villageAdmins", member.village);
  if (a && a.memberId === member.id && !a.disabled) return ROLES.VILLAGE_ADMIN;
  return ROLES.MEMBER;
}
export const isAdminRole = (role) =>
  role === ROLES.MAIN_ADMIN || role === ROLES.VILLAGE_ADMIN;

// Main Admin seed (Section 2). Values come from the server's own config file
// (config/main-admin.env or the service environment), never from the app.
export function seedMainAdmin(store, config = {}) {
  if (mainAdminId(store) && store.get("members", mainAdminId(store))) return false;
  const name = String(config.name || "").trim();
  const mobile = mobileDigits(config.mobile);
  const password = String(config.password || "");
  if (!name || !isMobile(mobile) || !isPasswordFormat(password) || !config.village)
    throw new Error(
      "Main Admin is not set up. Fill MAIN_ADMIN_NAME, MAIN_ADMIN_MOBILE, MAIN_ADMIN_VILLAGE and MAIN_ADMIN_PASSWORD (4+ characters) in config/main-admin.env or the server environment.",
    );
  const parts = nameParts(name);
  const p = profile(
    {
      firstName: parts.firstName,
      middleName: parts.middleName,
      surname: parts.surname || parts.firstName,
      nameGu: config.nameGu || name,
      phone: mobile,
      village: config.village,
      ...(config.location ? { currentLocation: String(config.location) } : {}),
    },
    store.all("villages"),
  );
  const existing = store.all("members").find((m) => m.phone === mobile);
  const now = Date.now();
  const member = {
    ...(existing || {}),
    ...p,
    id: existing?.id || randomUUID(),
    owner: existing?.owner || randomUUID(),
    createdAt: existing?.createdAt || now,
    approvedAt: existing?.approvedAt || now,
    approvedBy: existing?.approvedBy || "seed",
    consentAt: existing?.consentAt || now,
    consentVersion: existing?.consentVersion || "main-admin-seed-v1",
    // "initial": this password is for the FIRST login only; the Main Admin
    // must choose his own password right after that login.
    cred: { password: hashSecret(password), initial: true, stamp: randomUUID(), changedAt: now },
  };
  store.tx(() => {
    store.put("members", member);
    store.put("config", { id: "main-admin", memberId: member.id, seededAt: now });
    store.audit("seed", "main-admin.seed", member.id);
  });
  return true;
}

// Server-side recovery (scripts/reset-main-admin.js): no reset in the app.
export function resetMainAdminPassword(store, password) {
  if (!isPasswordFormat(password))
    throw new Error("The password must be at least 4 characters.");
  const m = store.get("members", mainAdminId(store));
  if (!m) throw new Error("No Main Admin in this database.");
  store.tx(() => {
    // A server reset is also a first-login-only password.
    m.cred = { password: hashSecret(password), initial: true, stamp: randomUUID(), changedAt: Date.now() };
    store.put("members", m);
    store.audit("server-script", "main-admin.password-reset", m.id);
  });
  return m;
}

// Who is logged in on this request (and with which role).
export function resolveAuth(store, req) {
  const auth = req.session.auth;
  let me = null;
  if (auth) {
    const m = store.get("members", auth.memberId);
    if (m && (m.cred?.stamp || null) === (auth.stamp || null)) me = m;
    else {
      // Password changed elsewhere, or the member was removed.
      delete req.session.auth;
      delete req.session.adminMode;
      store.put("sessions", req.session);
    }
  }
  req.me = me;
  req.role = me ? accountRole(store, me) : null;
  req.mustSetPin = !!(me && req.session.auth?.mustSetPin);
  if (!isAdminRole(req.role) && req.session.adminMode) {
    // The admin role was taken away (for example a disabled Village Admin).
    delete req.session.adminMode;
    store.put("sessions", req.session);
  }
  req.adminMode = isAdminRole(req.role) && !!req.session.adminMode && !req.mustSetPin;
  req.isAdmin = req.role === ROLES.MAIN_ADMIN && req.adminMode;
  req.villageAdminMember = req.role === ROLES.VILLAGE_ADMIN && req.adminMode ? me : null;
}

// Checks the Main Admin PASSWORD, counting wrong attempts: 5 wrong → locked
// for 5 minutes.
export function verifyAccountSecret(store, member, secret, { field = "secret", old = false } = {}) {
  const cred = member.cred || {};
  const now = Date.now();
  if (cred.until > now)
    fail("Too many wrong attempts · ઘણા ખોટા પ્રયાસો", 429, "LOCKED_OUT", { until: cred.until, field });
  const hashed = cred.password;
  const ok = secretMatches(String(secret ?? ""), hashed || DUMMY_HASH) && !!hashed;
  if (ok) {
    if (cred.fails || cred.until) {
      cred.fails = 0;
      cred.until = 0;
      member.cred = cred;
      store.put("members", member);
    }
    return true;
  }
  cred.fails = (cred.fails || 0) + 1;
  if (cred.fails >= MAX_WRONG_ATTEMPTS) {
    cred.fails = 0;
    cred.until = now + LOCKOUT_MS;
    member.cred = cred;
    store.put("members", member);
    fail("Too many wrong attempts · ઘણા ખોટા પ્રયાસો", 429, "LOCKED_OUT", { until: cred.until, field });
  }
  member.cred = cred;
  store.put("members", member);
  fail("Wrong password · પાસવર્ડ ખોટો છે", 401, old ? "WRONG_OLD_PASSWORD" : "WRONG_PASSWORD", {
    field,
    left: MAX_WRONG_ATTEMPTS - cred.fails,
  });
}

export function validateNewPassword(next, confirm, currentHash) {
  const value = String(next ?? "");
  if (!isPasswordFormat(value))
    fail("Password too short", 400, "PASSWORD_FORMAT", { field: "next" });
  if (currentHash && secretMatches(value, currentHash))
    fail("New password same as old", 400, "PASSWORD_SAME", { field: "next" });
  if (String(confirm ?? "") !== value)
    fail("Passwords do not match", 400, "PASSWORD_MISMATCH", { field: "confirm" });
  return value;
}

// Status of a mobile number that has no approved account (Section 4).
export function numberStatus(store, mobile) {
  if (store.all("members").some((m) => m.phone === mobile)) return "APPROVED";
  if (store.all("requests").some((r) => r.kind === "new" && r.payload?.phone === mobile))
    return "PENDING";
  // An admin can allow a removed or rejected number to register again.
  if (
    store
      .all("archive")
      .some((a) => !a.rejoinAllowed && [a.phone, ...(a.numbers || [])].includes(mobile))
  )
    return "REMOVED";
  const ledger = store.all("rejections").find((r) => r.phone === mobile);
  const last = ledger?.events?.[ledger.events.length - 1];
  if (last && last.action === "reject") return "REJECTED";
  return null;
}

export function installAuth(app, store, { rate, state, alert, knownClient, clientKey }) {
  const save = (req) => store.put("sessions", req.session);
  const signedIn = (req) => {
    if (!req.me) fail("Please log in", 401, "SESSION");
    return req.me;
  };

  // Opens a session for a member (the same for every login route).
  const startSession = (req, fresh, role, mustChoose) => {
    req.rotateSession();
    req.session.owner = fresh.owner;
    req.session.auth = {
      memberId: fresh.id,
      stamp: fresh.cred?.stamp || null,
      mustSetPin: mustChoose,
      at: Date.now(),
    };
    // Admins land on the directory with their tools one tap away.
    if (isAdminRole(role)) req.session.adminMode = true;
    else delete req.session.adminMode;
    // A new login starts without a phone lock (it is optional, My Profile).
    req.session.lock = { pref: false, locked: false, activeAt: Date.now() };
    save(req);
    store.audit(fresh.id, "login", role);
    resolveAuth(store, req);
  };

  app.post("/api/login", (req, res) => {
    rate("login:" + req.session.id, 30, 900000);
    if (knownClient(req)) rate("login-ip:" + clientKey(req), 60, 900000);
    const mobile = mobileDigits(req.body.mobile);
    if (!isMobile(mobile))
      fail("Enter a valid mobile number", 400, "MOBILE_FORMAT", { field: "mobile" });
    const m = store.all("members").find((x) => x.phone === mobile);
    if (!m) {
      secretMatches("x", DUMMY_HASH);
      const status = numberStatus(store, mobile);
      if (status) fail("Status " + status, 409, "STATUS_" + status, { field: "mobile" });
      fail("Not registered", 404, "NOT_REGISTERED", { field: "mobile" });
    }
    const role = accountRole(store, m);
    const main = role === ROLES.MAIN_ADMIN;
    if (main) {
      // Only the Main Admin has a password.
      if (typeof req.body.secret !== "string" || !req.body.secret)
        fail("Enter your password", 400, "PASSWORD_REQUIRED", { field: "secret" });
      try {
        verifyAccountSecret(store, m, req.body.secret);
      } catch (e) {
        if (e.status === 401 || e.code === "LOCKED_OUT")
          alert(req, "મુખ્ય એડમિન લોગિન નિષ્ફળ · Failed Main Admin login: " + mobile.slice(0, 2) + "******" + mobile.slice(-2));
        throw e;
      }
    }
    const fresh = store.get("members", m.id);
    startSession(req, fresh, role, main && !!fresh.cred?.initial);
    res.json(state(req));
  });

  // A registration from THIS phone was approved: the person is logged in
  // without typing anything (the phone that applied is the phone that owns
  // the record). Never for the Main Admin.
  app.post("/api/login/approved", (req, res) => {
    if (req.me) return res.json(state(req));
    const m = store.all("members").find((x) => x.owner === req.session.owner);
    if (!m || accountRole(store, m) === ROLES.MAIN_ADMIN)
      fail("Not registered", 404, "NOT_REGISTERED");
    startSession(req, m, accountRole(store, m), false);
    res.json(state(req));
  });

  // The first-time Main Admin password works for ONE login; he then chooses
  // his own (new + re-enter; he has just typed the old one).
  app.post("/api/password/set", (req, res) => {
    const me = signedIn(req);
    if (accountRole(store, me) !== ROLES.MAIN_ADMIN)
      fail("Only the Main Admin has a password", 403, "FORBIDDEN");
    if (!req.session.auth.mustSetPin || !me.cred?.initial)
      fail("Password already set", 409, "PIN_ALREADY_SET");
    const password = validateNewPassword(req.body.next, req.body.confirm, me.cred.password);
    store.tx(() => {
      me.cred = { password: hashSecret(password), stamp: randomUUID(), changedAt: Date.now() };
      store.put("members", me);
      req.session.auth = { ...req.session.auth, stamp: me.cred.stamp, mustSetPin: false };
      req.session.adminMode = true;
      save(req);
      store.audit(me.id, "password.set", me.id);
    });
    resolveAuth(store, req);
    res.json(state(req));
  });

  app.post("/api/password/change", (req, res) => {
    const me = signedIn(req);
    if (accountRole(store, me) !== ROLES.MAIN_ADMIN)
      fail("Only the Main Admin has a password", 403, "FORBIDDEN");
    verifyAccountSecret(store, me, String(req.body.current ?? ""), { field: "current", old: true });
    const fresh = store.get("members", me.id);
    const password = validateNewPassword(req.body.next, req.body.confirm, fresh.cred.password);
    store.tx(() => {
      fresh.cred = { password: hashSecret(password), stamp: randomUUID(), changedAt: Date.now() };
      store.put("members", fresh);
      req.session.auth = { ...req.session.auth, stamp: fresh.cred.stamp };
      save(req);
      store.audit(me.id, "password.change", me.id);
    });
    resolveAuth(store, req);
    res.json({ ok: true, ...state(req) });
  });

  // "Log out" inside the admin tools ends ONLY the admin session; the person
  // stays logged in as a normal member on the Member Directory.
  app.post("/api/admin/logout", (req, res) => {
    signedIn(req);
    delete req.session.adminMode;
    save(req);
    store.audit(req.me.id, "admin.logout", req.me.id);
    resolveAuth(store, req);
    res.json(state(req));
  });

  // Opening the admin tools again after "Log out": the Main Admin types his
  // PASSWORD once more; a Village Admin just opens them (no secret).
  app.post("/api/admin/enter", (req, res) => {
    const me = signedIn(req);
    const role = accountRole(store, me);
    if (!isAdminRole(role)) fail("Not an admin", 403, "FORBIDDEN");
    if (req.mustSetPin) fail("Set your password first", 409, "SET_PIN_FIRST");
    if (role === ROLES.MAIN_ADMIN) verifyAccountSecret(store, me, String(req.body.secret ?? ""));
    req.session.adminMode = true;
    save(req);
    store.audit(me.id, "admin.enter", me.id);
    resolveAuth(store, req);
    res.json(state(req));
  });
}
