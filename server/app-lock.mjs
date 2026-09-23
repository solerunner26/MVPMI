import { randomInt } from "node:crypto";
import { fail, passwordHash, passwordMatches } from "./store.mjs";

// Server-enforced app lock (PIN).
//
// Every session that can see the community directory (an approved member or
// a signed-in village administrator) must set a four-digit PIN. While the
// session is locked — on every app start, after 30 seconds in the
// background and after 3 idle minutes — /api/state returns NO directory
// records. The PIN hash lives on the server (scrypt), so clearing browser
// storage or reloading the page cannot bypass it, and wrong guesses are
// counted on the server with growing waits.
//
// A forgotten PIN is reset with a one-time 6-digit code issued by the
// member's village administrator (or the main administrator) after they
// confirm the person by phone — no re-application needed.

const WEAK = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "0123", "9876"]);
const RESET_MINUTES = 15;

export const lockApplies = (req, seesDirectory, required) =>
  required && !req.isAdmin && seesDirectory;

export function lockView(req, seesDirectory, required) {
  if (!lockApplies(req, seesDirectory, required))
    return { lockSetup: false, locked: false };
  const l = req.session.lock;
  if (!l?.hash) return { lockSetup: true, locked: false };
  return {
    lockSetup: false,
    locked: l.locked !== false,
    lockWaitUntil: l.until > Date.now() ? l.until : 0,
    lockFrozen: !!l.frozen,
  };
}

const pinValue = (pin) => {
  const value = String(pin ?? "");
  if (!/^\d{4}$/.test(value))
    fail("ચાર આંકડાનો પિન નાખો · Enter a four-digit PIN");
  return value;
};

export function installAppLock(app, store, { rate, sessionSees, required, notify }) {
  const save = (req) => store.put("sessions", req.session);
  const guard = (req) => {
    if (!lockApplies(req, sessionSees(req), required))
      fail("App lock is not needed for this sign-in", 409);
  };
  app.post("/api/lock/setup", (req, res) => {
    guard(req);
    if (req.session.lock?.hash)
      fail("A PIN is already set. Use Change PIN.", 409);
    const pin = pinValue(req.body.pin);
    if (WEAK.has(pin))
      fail("આ પિન સહેલાઈથી અંદાજી શકાય છે, બીજો પસંદ કરો · This PIN is too easy to guess. Choose another.");
    req.session.lock = { hash: passwordHash(pin), locked: false, fails: 0, strikes: 0, setAt: Date.now() };
    save(req);
    res.json({ ok: true });
  });
  app.post("/api/lock/engage", (req, res) => {
    if (req.session.lock?.hash && req.session.lock.locked === false) {
      req.session.lock.locked = true;
      save(req);
    }
    res.json({ ok: true });
  });
  app.post("/api/lock/unlock", (req, res) => {
    guard(req);
    const l = req.session.lock;
    if (!l?.hash) fail("Set a PIN first", 409);
    if (l.frozen)
      fail("ઘણા ખોટા પ્રયાસ. ગામના એડમિન પાસેથી રીસેટ કોડ મેળવો · Too many wrong PINs. Ask your village administrator for a reset code.", 423);
    if (l.until > Date.now())
      fail("થોડી વાર રાહ જુઓ · Please wait before trying again.", 429);
    if (!passwordMatches(String(req.body.pin ?? ""), l.hash)) {
      l.fails = (l.fails || 0) + 1;
      l.strikes = (l.strikes || 0) + 1;
      // 5 wrong → 1 minute, then each further wrong PIN doubles the wait
      // (2, 4, 8 … up to 60 minutes). 15 wrong in total freezes the lock.
      if (l.strikes >= 15) l.frozen = true;
      else if (l.fails >= 5)
        l.until = Date.now() + Math.min(60, 2 ** (l.fails - 5)) * 60000;
      save(req);
      fail("ખોટો પિન · Wrong PIN", 401);
    }
    Object.assign(l, { locked: false, fails: 0, strikes: 0, until: 0 });
    save(req);
    res.json({ ok: true });
  });
  app.post("/api/lock/change", (req, res) => {
    guard(req);
    const l = req.session.lock;
    if (!l?.hash || l.locked !== false) fail("Unlock the app first", 423);
    if (!passwordMatches(String(req.body.current ?? ""), l.hash))
      fail("હાલનો પિન ખોટો છે · The current PIN is wrong", 401);
    const pin = pinValue(req.body.next);
    if (WEAK.has(pin))
      fail("આ પિન સહેલાઈથી અંદાજી શકાય છે, બીજો પસંદ કરો · This PIN is too easy to guess. Choose another.");
    l.hash = passwordHash(pin);
    save(req);
    res.json({ ok: true });
  });
  // Member enters the one-time code their village administrator read out.
  app.post("/api/lock/reset", (req, res) => {
    rate("pin-reset:" + req.session.id, 10);
    const me = store.all("members").find((m) => m.owner === req.session.owner);
    if (!me) fail("Only an approved member's own phone can use a reset code", 403);
    const r = store.get("recoveries", me.id);
    const code = String(req.body.code ?? "").replace(/\D/g, "");
    if (!r || r.until < Date.now() || !r.hash) fail("કોડ માન્ય નથી · The code is not valid or has expired", 401);
    if (!passwordMatches(code, r.hash)) {
      r.tries = (r.tries || 0) + 1;
      if (r.tries >= 5) store.del("recoveries", me.id);
      else store.put("recoveries", r);
      fail("કોડ ખોટો છે · Wrong code", 401);
    }
    store.tx(() => {
      store.del("recoveries", me.id);
      delete req.session.lock;
      save(req);
      store.audit(me.id, "pin.reset", r.by);
    });
    res.json({ ok: true });
  });
  // Issued by an administrator after confirming the member by phone.
  const issue = (req, res, member, actor, level) => {
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    store.tx(() => {
      store.put("recoveries", {
        id: member.id,
        hash: passwordHash(code),
        until: Date.now() + RESET_MINUTES * 60000,
        tries: 0,
        by: actor,
      });
      store.audit(actor, level + ".pin-reset-code", member.id);
    });
    notify?.("owner:" + member.owner, {
      kind: "pin-reset",
      titleGu: "પિન રીસેટ કોડ તૈયાર છે",
      titleEn: "PIN reset code ready",
      bodyGu: "એડમિને કોડ બનાવ્યો છે. " + RESET_MINUTES + " મિનિટમાં વાપરો.",
      bodyEn: "An administrator created your code. Use it within " + RESET_MINUTES + " minutes.",
    });
    res.json({ code, minutes: RESET_MINUTES });
  };
  return { issue };
}
