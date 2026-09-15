import { randomBytes, randomUUID } from "node:crypto";
import { fail, hash } from "./store.mjs";

// Isolated from domain logic so both cookie and cookie-free preview paths are tested.
export function installSessions(app, store, { development, secure, rate }) {
  app.use("/api", (req, res, next) => {
    try {
      const supplied = req.get("X-MVPMI-Session");
      const cookie = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("mvpm_session="))
        ?.slice(13);
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
      }
      if (!session || session.expires <= Date.now()) {
        rate("session:" + req.socket.remoteAddress, 100, 3600000);
        const value = randomBytes(32).toString("hex");
        session = {
          id: hash(value),
          owner: randomUUID(),
          expires: Date.now() + 180 * 86400000,
        };
        store.put("sessions", session);
        res.cookie("mvpm_session", value, {
          httpOnly: true,
          secure,
          sameSite: secure ? "none" : "lax",
          partitioned: secure,
          maxAge: 180 * 86400000,
          path: "/",
        });
      }
      if (session.blocked)
        fail(
          "આ ઉપકરણને રોકવામાં આવ્યું છે · Device blocked. Contact the administrator.",
          403,
        );
      req.session = session;
      req.isAdmin = session.adminUntil > Date.now();
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
