import { randomBytes, randomUUID } from "node:crypto";
import { fail, hash } from "./store.mjs";

const COOKIE = "mvpm_session";
const SESSION_DAYS = 180;

// Client address used for rate limits. Behind cPanel/Passenger or any
// reverse proxy the socket address is the proxy, so the app is configured
// with Express "trust proxy" (see createApp) and req.ip carries the real
// client. "unknown" keeps a stable key when neither is available.
export const clientKey = (req) =>
  String(req.ip || req.socket?.remoteAddress || "unknown");
// False when the visitor's own address is not visible (for example a proxy
// that does not forward it). Per-address limits are then skipped instead of
// putting every visitor into one shared bucket.
export const knownClient = (req) => {
  const ip = String(req.ip || req.socket?.remoteAddress || "");
  return !!ip && !/^(::1|127\.|::ffff:127\.|unknown$)/.test(ip);
};

// Isolated from domain logic so both cookie and cookie-free preview paths are tested.
export function installSessions(app, store, { development, secure, rate }) {
  // Production uses a first-party Lax cookie (CSRF-resistant). The embedded
  // development preview needs a cross-site, partitioned cookie instead.
  const cookieOptions = () => ({
    httpOnly: true,
    secure,
    sameSite: development && secure ? "none" : "lax",
    ...(development && secure ? { partitioned: true } : {}),
    maxAge: SESSION_DAYS * 86400000,
    path: "/",
  });
  const issue = (res) => {
    const value = randomBytes(32).toString("hex");
    res.cookie(COOKIE, value, cookieOptions());
    return hash(value);
  };
  app.use("/api", (req, res, next) => {
    try {
      const supplied = req.get("X-MVPMI-Session");
      const cookie = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(COOKIE + "="))
        ?.slice(COOKIE.length + 1);
      let session;
      if (supplied !== undefined) {
        const transport =
          development &&
          /^[a-f0-9]{64}$/.test(supplied) &&
          store.get("transports", hash(supplied));
        if (!transport || transport.expiresAt <= Date.now())
          fail("Preview session expired. Refresh to reconnect.", 401);
        session = store.get("sessions", transport.sessionId);
        if (!session || session.expires <= Date.now())
          fail("Preview session expired. Refresh to reconnect.", 401);
      } else if (cookie && /^[a-f0-9]{64}$/.test(cookie)) {
        session = store.get("sessions", hash(cookie));
        // A request that left the browser just before sign-in rotated the
        // cookie still reaches the same session for one minute.
        if (session?.aliasOf)
          session =
            session.aliasUntil > Date.now()
              ? store.get("sessions", session.aliasOf)
              : null;
      }
      let fresh = false;
      if (!session || session.expires <= Date.now()) {
        fresh = true;
        if (knownClient(req)) rate("session:" + clientKey(req), 300, 3600000);
        session = {
          id: issue(res),
          owner: randomUUID(),
          createdAt: Date.now(),
          expires: Date.now() + SESSION_DAYS * 86400000,
        };
        store.put("sessions", session);
      }
      if (session.blocked)
        fail(
          "આ ઉપકરણને રોકવામાં આવ્યું છે · Device blocked. Contact the administrator.",
          403,
        );
      req.session = session;
      req.isAdmin = session.adminUntil > Date.now();
      // Sign-in rotates the session identifier (prevents session fixation):
      // the same owner and state move to a fresh cookie; any development
      // transport that pointed at the old identifier follows it.
      req.rotateSession = () => {
        // A session created by this very request is already brand new.
        if (fresh) return;
        fresh = true;
        const previous = req.session.id;
        const nextId = issue(res);
        store.tx(() => {
          store.put("sessions", {
            id: previous,
            aliasOf: nextId,
            aliasUntil: Date.now() + 60000,
            expires: Date.now() + 60000,
          });
          req.session.id = nextId;
          store.put("sessions", req.session);
          for (const row of store.all("transports"))
            if (row.sessionId === previous)
              store.put("transports", { ...row, sessionId: nextId });
          for (const row of store.all("devices"))
            if (row.sessionId === previous)
              store.put("devices", { ...row, sessionId: nextId });
          for (const row of store.all("pushSubs"))
            if (row.sessionId === previous)
              store.put("pushSubs", { ...row, sessionId: nextId });
        });
      };
      next();
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/session/transport", (req, res) => {
    if (!development) return res.json({ enabled: false });
    rate("transport:" + req.session.id, 20, 3600000);
    const now = Date.now();
    for (const row of store.all("transports"))
      if (row.expiresAt <= now) store.del("transports", row.id);
    const token = randomBytes(32).toString("hex"),
      expiresAt = now + 12 * 3600000;
    store.put("transports", {
      id: hash(token),
      sessionId: req.session.id,
      expiresAt,
    });
    res.json({ enabled: true, token, expiresAt });
  });
}
