// Second-phone login (owner, 30 Oct 2026).
//
// Members and Village Admins log in with their mobile number only. When that
// number is ALREADY logged in on another phone, a new phone must also enter a
// 6-digit code. The code is shown to the person on the phone(s) already
// using the number (an in-app card and a phone notification), and to the
// Main Admin. The owner decides whether to share it — e.g. a father lets his
// son use the app with his number. Phones that are already logged in stay
// logged in. The Main Admin (password login) is not affected.
import { randomInt } from "node:crypto";
import { fail } from "./store.mjs";
import { ROLES } from "./terms.mjs";

const VALID_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;

const now = () => Date.now();
const masked = (p) => String(p || "").slice(0, 2) + "******" + String(p || "").slice(-2);

// Phones (sessions) where this member is logged in right now, except this one.
export function otherPhones(store, memberId, sessionId) {
  const t = now();
  return store.all("sessions").filter((s) => s.auth?.memberId === memberId && s.expires > t && s.id !== sessionId && !s.aliasOf);
}

function liveCodes(store) {
  const t = now();
  const all = store.all("loginCodes");
  for (const c of all) if (c.expires <= t || c.tries >= MAX_TRIES) store.del("loginCodes", c.id);
  return all.filter((c) => c.expires > t && c.tries < MAX_TRIES);
}

// Called by /api/login for a member whose number is already in use.
// Returns normally when the code given is right; otherwise sends/asks.
export function requireOwnerCode(store, req, m, { notify, rate }) {
  const id = m.id + ":" + req.session.id;
  const given = String(req.body.code ?? "").replace(/\D/g, "");
  const codes = liveCodes(store);
  const current = codes.find((c) => c.id === id);
  if (given) {
    if (!current) fail("The code has expired. Ask for a new one.", 409, "OWNER_CODE_EXPIRED", { field: "code" });
    if (current.code !== given) {
      current.tries = (current.tries || 0) + 1;
      store.put("loginCodes", current);
      fail("Wrong code", 401, "OWNER_CODE_WRONG", { field: "code", left: Math.max(0, MAX_TRIES - current.tries) });
    }
    store.del("loginCodes", id);
    store.audit(m.id, "login.second-phone", masked(m.phone));
    return;
  }
  if (!current || req.body.resend === true) {
    rate("login-code:" + m.id, 6, 3600000);
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    store.put("loginCodes", { id, memberId: m.id, sessionId: req.session.id, code, at: now(), expires: now() + VALID_MS, tries: 0 });
    store.audit(m.id, "login.code-sent", masked(m.phone));
    notify("owner:" + m.owner, {
      kind: "login-code",
      titleGu: "બીજા ફોનમાં તમારા નંબરથી લોગિન",
      titleEn: "Login with your number on another phone",
      bodyGu: "કોડ " + code + " — તમે ઓળખતા હો તો જ આપો. 10 મિનિટ માન્ય.",
      bodyEn: "Code " + code + " — share it only with someone you trust. Valid 10 minutes.",
    });
  }
  fail("A code was sent to the phone already using this number", 409, "OWNER_CODE_SENT", { field: "code" });
}

// What the logged-in owner (and the Main Admin) see in the app.
export function loginCodeState(store, req) {
  if (!req.me) return {};
  const codes = liveCodes(store);
  const out = {
    loginCodes: codes
      .filter((c) => c.memberId === req.me.id && c.sessionId !== req.session.id)
      .map((c) => ({ id: c.id, code: c.code, at: c.at, expires: c.expires })),
  };
  if (req.role === ROLES.MAIN_ADMIN)
    out.loginCodeRequests = codes
      .map((c) => {
        const m = store.get("members", c.memberId);
        return m ? { id: c.id, code: c.code, at: c.at, expires: c.expires, memberId: m.id, name: m.name, nameGu: m.nameGu, village: m.village, phone: m.phone } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.at - a.at);
  return out;
}
