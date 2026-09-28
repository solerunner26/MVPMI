// App lock (Section 5). The lock uses the SAME secret as the login: the
// 4-digit PIN for Members and Village Admins, the PASSWORD for the Main
// Admin. There is no second secret.
//
//   • Members choose "Ask for PIN when opening the app" (default OFF).
//   • Admins always have it ON and cannot turn it off.
//   • When ON, the directory locks on every app start and whenever the app
//     returns after 1 minute or more in the background. The server enforces
//     it: while locked, /api/state sends no member records and every action
//     is refused.
//   • 5 wrong PINs → locked for 5 minutes (shared with the login counter).
//   • Optional fingerprint unlock through the phone's own biometric prompt:
//     the Android app keeps a random device key that is released only after a
//     successful fingerprint; the server keeps a hash of it for this session.
import { randomUUID } from "node:crypto";
import { fail } from "./store.mjs";
import { BACKGROUND_LOCK_MS } from "./terms.mjs";
import {
  isAdminRole,
  verifyAccountSecret,
  hashSecret,
  secretMatches,
} from "./auth.mjs";

export const lockForced = (req) => isAdminRole(req.role);
export const lockOn = (req, required) =>
  !!required &&
  !!req.me &&
  !req.mustSetPin &&
  (lockForced(req) || !!req.session.lock?.pref);

// Every API request: a lock that was left in the background for 1 minute or
// more closes, even if the app was killed and never came back.
export function touchLock(store, req, required) {
  if (!lockOn(req, required)) return;
  const l = (req.session.lock ||= {});
  if (l.locked === false && l.hiddenAt && Date.now() - l.hiddenAt >= BACKGROUND_LOCK_MS) {
    l.locked = true;
    delete l.hiddenAt;
    store.put("sessions", req.session);
  }
}

export function lockView(req, required) {
  if (!lockOn(req, required))
    return { locked: false, lockOn: false, lockForced: lockForced(req), biometricOn: false };
  const l = req.session.lock || {};
  return {
    locked: l.locked !== false,
    lockOn: true,
    lockForced: lockForced(req),
    biometricOn: !!l.bio,
  };
}

export function installAppLock(app, store, { required }) {
  const save = (req) => store.put("sessions", req.session);
  const guard = (req) => {
    if (!req.me) fail("Please log in", 401, "SESSION");
  };
  app.post("/api/lock/engage", (req, res) => {
    if (lockOn(req, required)) {
      req.session.lock.locked = true;
      delete req.session.lock.hiddenAt;
      save(req);
    }
    res.json({ ok: true });
  });
  // The app went to the background: lock if it stays away for 1 minute.
  app.post("/api/lock/hidden", (req, res) => {
    const l = req.session.lock;
    if (lockOn(req, required) && l && l.locked === false) {
      l.hiddenAt = Date.now();
      save(req);
    }
    res.json({ ok: true });
  });
  app.post("/api/lock/visible", (req, res) => {
    const l = req.session.lock;
    if (l?.hiddenAt) {
      if (Date.now() - l.hiddenAt >= BACKGROUND_LOCK_MS && lockOn(req, required)) l.locked = true;
      delete l.hiddenAt;
      save(req);
    }
    res.json({ ok: true });
  });
  app.post("/api/lock/unlock", (req, res) => {
    guard(req);
    const l = (req.session.lock ||= {});
    if (req.body.biometric !== undefined) {
      if (!l.bio || !secretMatches(String(req.body.biometric), l.bio))
        fail("Fingerprint unlock is not set up on this phone", 401, "BIOMETRIC_FAILED");
    } else verifyAccountSecret(store, req.me, String(req.body.secret ?? ""));
    l.locked = false;
    delete l.hiddenAt;
    l.activeAt = Date.now();
    save(req);
    res.json({ ok: true });
  });
  // Members: "Ask for PIN when opening the app" (default OFF).
  app.post("/api/lock/preference", (req, res) => {
    guard(req);
    if (lockForced(req) && req.body.on !== true)
      fail("Admins always use the app lock", 409, "LOCK_FORCED");
    const l = (req.session.lock ||= {});
    l.pref = req.body.on === true;
    if (!l.pref) delete l.bio;
    l.locked = false;
    save(req);
    res.json({ ok: true, ...lockView(req, required) });
  });
  // Optional fingerprint unlock. The Android app sends its device key after a
  // successful fingerprint prompt; turning the lock off forgets it.
  app.post("/api/lock/biometric", (req, res) => {
    guard(req);
    const l = (req.session.lock ||= {});
    if (req.body.on === false) {
      delete l.bio;
    } else {
      if (!lockOn(req, required)) fail("Turn on the app lock first", 409, "LOCK_OFF");
      if (l.locked !== false) fail("Unlock first", 423, "LOCKED");
      const key = String(req.body.key ?? "");
      if (!/^[a-f0-9]{64}$/.test(key)) fail("Invalid device key", 400, "BIOMETRIC_FAILED");
      l.bio = hashSecret(key);
      l.bioId = randomUUID();
    }
    save(req);
    res.json({ ok: true, ...lockView(req, required) });
  });
}
