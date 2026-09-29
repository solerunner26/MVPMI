// Optional phone lock (owner decision 2026-09-30).
//
//   • The lock is OFF by default for everybody, admins included, and it
//     never turns itself on. Nothing locks the app unless the person turned
//     it on in My Profile.
//   • Turning it on means choosing a 4-digit PIN for THIS phone (any four
//     digits). The PIN is not a login: Members and Village Admins log in
//     with their mobile number only, so a forgotten PIN is fixed by
//     "Forgot PIN → sign out of this phone and sign in again" (the normal
//     /api/logout), which needs no administrator.
//   • When ON, the directory locks on every app start and whenever the app
//     returns after 1 minute or more in the background. The server enforces
//     it: while locked, /api/state sends no member records and every action
//     is refused.
//   • Optional fingerprint unlock through the phone's own biometric prompt:
//     the Android app keeps a random device key that is released only after a
//     successful fingerprint; the server keeps a hash of it for this session.
import { randomUUID } from "node:crypto";
import { fail } from "./store.mjs";
import { BACKGROUND_LOCK_MS } from "./terms.mjs";
import { hashSecret, secretMatches } from "./auth.mjs";

export const lockOn = (req, required) =>
  !!required &&
  !!req.me &&
  !req.mustSetPin &&
  !!req.session.lock?.pref &&
  !!req.session.lock?.pin;

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
    return { locked: false, lockOn: false, biometricOn: false };
  const l = req.session.lock || {};
  return {
    locked: l.locked !== false,
    lockOn: true,
    biometricOn: !!l.bio,
  };
}

const isLockPin = (v) => /^\d{4}$/.test(String(v ?? ""));

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
    } else {
      if (!l.pin) fail("The app lock is off", 409, "LOCK_OFF");
      if (!secretMatches(String(req.body.secret ?? ""), l.pin))
        fail("Wrong PIN · પિન ખોટો છે", 401, "WRONG_PIN", { field: "secret" });
    }
    l.locked = false;
    delete l.hiddenAt;
    l.activeAt = Date.now();
    save(req);
    res.json({ ok: true });
  });
  // "Lock this app with a PIN" in My Profile. Turning it ON (or changing the
  // PIN) sends the new PIN twice; turning it OFF needs nothing (the phone is
  // already open).
  app.post("/api/lock/preference", (req, res) => {
    guard(req);
    const l = (req.session.lock ||= {});
    if (req.body.on === true) {
      if (l.pin && l.locked !== false) fail("The app is locked", 423, "LOCKED");
      if (!isLockPin(req.body.pin)) fail("The PIN must be 4 digits", 400, "PIN_FORMAT", { field: "pin" });
      if (String(req.body.confirm ?? "") !== String(req.body.pin))
        fail("The PINs do not match", 400, "PIN_MISMATCH", { field: "confirm" });
      l.pref = true;
      l.pin = hashSecret(String(req.body.pin));
    } else {
      l.pref = false;
      delete l.pin;
      delete l.bio;
      delete l.bioId;
    }
    l.locked = false;
    delete l.hiddenAt;
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
