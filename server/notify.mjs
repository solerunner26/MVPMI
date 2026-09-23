import webpush from "web-push";
import { randomBytes, randomUUID } from "node:crypto";
import { fail, hash, isRecord } from "./store.mjs";

// System-level notifications without any paid service.
//
// Every domain event is written to the `notifications` table, addressed to
// recipient keys:
//   "main"            — the main administrator's devices
//   "village:<gu>"    — that village's administrator devices
//   "owner:<owner>"   — one applicant/member's own device(s)
// Two free delivery channels read from it:
//   1. Web Push (browser / home-screen app): standard VAPID push, keys are
//      generated on first start and stored in the database.
//   2. Android app: a background job pulls /api/notifications/pull with a
//      per-device token at least every 15 minutes (no Firebase account).
// Notification text carries names and villages only — never phone numbers.

export const recipientKeys = (store, session, now = Date.now()) => {
  const keys = ["owner:" + session.owner];
  const admin = store.get("config", "admin");
  if (
    session.mainNotify &&
    admin &&
    session.mainNotify.changedAt === admin.changedAt
  )
    keys.push("main");
  const v = session.villageNotify;
  if (v) {
    const a = store.get("villageAdmins", v.village);
    const m = a && store.get("members", a.memberId);
    if (
      a &&
      m &&
      a.memberId === v.memberId &&
      a.version === v.version &&
      a.passChangedAt === v.passChangedAt &&
      m.village === v.village
    )
      keys.push("village:" + v.village);
  }
  return session.blocked ? [] : keys;
};

const pick = (n, lang) => ({
  id: n.id,
  kind: n.kind,
  at: n.at,
  title: lang === "en" ? n.titleEn : n.titleGu,
  body: lang === "en" ? n.bodyEn : n.bodyGu,
});

export function createNotifier(store, { vapidSubject } = {}) {
  let vapid = store.get("config", "vapid");
  if (!vapid) {
    const keys = webpush.generateVAPIDKeys();
    vapid = { id: "vapid", ...keys, createdAt: Date.now() };
    store.put("config", vapid);
  }
  const subject =
    vapidSubject || "mailto:mvpmi-admin@users.noreply.github.com";
  const push = async (sub, payload) => {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify(payload), {
        TTL: 86400,
        urgency: "normal",
        vapidDetails: {
          subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        timeout: 10000,
      });
    } catch (error) {
      // Expired or revoked browser subscriptions are removed.
      if (error?.statusCode === 404 || error?.statusCode === 410)
        store.del("pushSubs", sub.id);
    }
  };
  const notify = (to, message) => {
    const targets = [...new Set([to].flat().filter(Boolean))];
    if (!targets.length) return;
    const at = Date.now();
    const rows = targets.map((recipient) => ({
      id: randomUUID(),
      to: recipient,
      at,
      kind: message.kind || "info",
      titleGu: message.titleGu,
      titleEn: message.titleEn,
      bodyGu: message.bodyGu || "",
      bodyEn: message.bodyEn || message.bodyGu || "",
    }));
    for (const row of rows) store.put("notifications", row);
    // Push delivery happens after the response; failures never affect the
    // domain action that raised the notification.
    setImmediate(() => {
      let subs;
      try {
        subs = store.all("pushSubs");
      } catch {
        return;
      }
      for (const sub of subs) {
        const session = store.get("sessions", sub.sessionId);
        if (!session || session.expires <= Date.now()) continue;
        const keys = recipientKeys(store, session);
        for (const row of rows)
          if (keys.includes(row.to))
            push(sub, { ...pick(row, sub.lang), tag: row.kind + ":" + row.id });
      }
    });
  };
  const feed = (session, after = 0, limit = 20) => {
    const keys = new Set(recipientKeys(store, session));
    return store
      .all("notifications")
      .filter((n) => keys.has(n.to) && n.at > after)
      .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
      // Oldest first: the cursor then moves forward without skipping any.
      .slice(0, limit);
  };
  const latestAt = (session) => {
    const keys = new Set(recipientKeys(store, session));
    let latest = 0;
    for (const n of store.all("notifications"))
      if (keys.has(n.to) && n.at > latest) latest = n.at;
    return latest;
  };
  return { notify, feed, latestAt, publicKey: vapid.publicKey };
}

// Routes that must work without a browser session (the Android background
// job authenticates with its device token only). Installed BEFORE the
// session middleware so a background poll never creates a new session.
export function installDevicePull(app, store, notifier) {
  app.get("/api/notifications/pull", (req, res) => {
    res.set("Cache-Control", "no-store");
    const token = req.get("X-MVPMI-Device") || "";
    const device = /^[a-f0-9]{64}$/.test(token) && store.get("devices", hash(token));
    const session = device && store.get("sessions", device.sessionId);
    if (!device || !session || session.expires <= Date.now())
      return res.status(401).json({ error: "Device not registered" });
    const items = notifier.feed(session, device.cursor || 0);
    if (items.length) {
      device.cursor = items[items.length - 1].at;
      device.lastPull = Date.now();
      store.put("devices", device);
    }
    res.json({ items: items.map((n) => pick(n, device.lang)) });
  });
}

export function installNotificationRoutes(app, store, notifier, { rate }) {
  app.get("/api/push/key", (req, res) =>
    res.json({ publicKey: notifier.publicKey }),
  );
  app.post("/api/push/subscribe", (req, res) => {
    rate("push:" + req.session.id, 30, 3600000);
    const sub = req.body.subscription;
    if (
      !isRecord(sub) ||
      typeof sub.endpoint !== "string" ||
      !/^https:\/\//.test(sub.endpoint) ||
      sub.endpoint.length > 1000 ||
      !isRecord(sub.keys) ||
      typeof sub.keys.p256dh !== "string" ||
      typeof sub.keys.auth !== "string" ||
      sub.keys.p256dh.length > 200 ||
      sub.keys.auth.length > 100
    )
      fail("Invalid push subscription");
    store.put("pushSubs", {
      id: hash(sub.endpoint),
      sessionId: req.session.id,
      lang: req.body.lang === "en" ? "en" : "gu",
      subscription: {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      },
      at: Date.now(),
    });
    res.json({ ok: true });
  });
  app.post("/api/push/unsubscribe", (req, res) => {
    if (typeof req.body.endpoint === "string")
      store.del("pushSubs", hash(req.body.endpoint));
    res.json({ ok: true });
  });
  // Android app: exchange the signed-in session for a background token.
  app.post("/api/notifications/device", (req, res) => {
    rate("device:" + req.session.id, 30, 3600000);
    let cursor = Date.now();
    for (const d of store.all("devices"))
      if (d.sessionId === req.session.id) {
        // Re-registration keeps the delivery position, so events raised
        // while the app was closed are still delivered once.
        cursor = Math.min(cursor, d.cursor || cursor);
        store.del("devices", d.id);
      }
    const token = randomBytes(32).toString("hex");
    store.put("devices", {
      id: hash(token),
      sessionId: req.session.id,
      lang: req.body.lang === "en" ? "en" : "gu",
      // New devices start from now: old events are never replayed.
      cursor,
      at: Date.now(),
    });
    res.json({ token });
  });
}
