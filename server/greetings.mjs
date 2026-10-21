// Greetings from the Main Admin (owner, 21 Oct 2026).
//
// Only the Main Admin sends: a short text in any language (Gujarati, English,
// Hindi) for an occasion, an invitation or a meeting, to everyone or to
// members he picks by name. Every recipient gets
//   - a "flash" card in the app that stays until it is closed with X,
//   - a phone notification, and
//   - the message in their Message Centre, where it stays until they delete
//     it (deleting only hides it for that member).
// Two tables: `greetings` (what was sent) and `inbox` (one row per recipient).
// Nothing here changes members or any other record.
import { randomUUID } from "node:crypto";
import { fail } from "./store.mjs";
import { ROLES } from "./terms.mjs";

const MAX_TEXT = 2000;

export function greetingState(store, req) {
  if (!req.me) return {};
  const mine = store
    .all("inbox")
    .filter((r) => r.memberId === req.me.id && !r.deletedAt)
    .sort((a, b) => b.at - a.at)
    .map((r) => {
      const g = store.get("greetings", r.greetingId);
      return g ? { id: g.id, at: g.at, text: g.text, read: !!r.readAt, closed: !!r.closedAt } : null;
    })
    .filter(Boolean);
  const out = { messages: mine, messagesUnread: mine.filter((m) => !m.read).length };
  if (req.role === ROLES.MAIN_ADMIN)
    out.greetingsSent = store
      .all("greetings")
      .sort((a, b) => b.at - a.at)
      .slice(0, 50)
      .map((g) => ({ id: g.id, at: g.at, text: g.text, to: g.to, count: g.count }));
  return out;
}

export function installGreetings(app, store, { notifier, rate, state, mainAdminId }) {
  const me = (req) => {
    if (!req.me) fail("Please log in", 401, "SESSION");
    return req.me;
  };
  const main = (req) => {
    const m = me(req);
    if (req.role !== ROLES.MAIN_ADMIN) fail("Only the Main Admin can send greetings", 403, "FORBIDDEN");
    return m;
  };

  app.post("/api/admin/greetings", (req, res) => {
    const sender = main(req);
    rate("greet:" + sender.id, 30, 3600000);
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > MAX_TEXT) fail("સંદેશ લખો (2000 અક્ષર સુધી) · Write a message (up to 2000 characters)");
    const mainId = mainAdminId(store);
    const everyone = store.all("members").filter((m) => m.id !== mainId && m.id !== sender.id);
    let recipients;
    if (req.body.to === "all") recipients = everyone;
    else {
      const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.filter((x) => typeof x === "string"))] : [];
      recipients = everyone.filter((m) => ids.includes(m.id));
      if (!recipients.length) fail("ઓછામાં ઓછું એક સભ્ય પસંદ કરો · Choose at least one member");
    }
    const at = Date.now();
    const g = { id: randomUUID(), at, by: sender.id, text, to: req.body.to === "all" ? "all" : "some", count: recipients.length };
    store.tx(() => {
      store.put("greetings", g);
      for (const m of recipients) store.put("inbox", { id: g.id + ":" + m.id, greetingId: g.id, memberId: m.id, at });
      store.audit(sender.id, "greeting.sent", g.id + " · " + recipients.length);
    });
    const preview = text.length > 140 ? text.slice(0, 137) + "…" : text;
    notifier.notify(
      [...new Set(recipients.map((m) => "owner:" + m.owner).filter((k) => k !== "owner:undefined"))],
      {
        kind: "greeting",
        titleGu: "સમાજ તરફથી સંદેશ",
        titleEn: "Message from the community",
        bodyGu: preview,
        bodyEn: preview,
      },
    );
    res.json({ ...state(req), sent: { id: g.id, count: recipients.length } });
  });

  const own = (req) => {
    const m = me(req);
    const row = store.get("inbox", String(req.params.id) + ":" + m.id);
    if (!row || row.deletedAt) fail("Message not found", 404, "NOT_FOUND");
    return row;
  };
  // read: opened in the Message Centre; close: flash card closed with X
  // (it stays unread in the Message Centre); delete: hidden for this member.
  for (const action of ["read", "close", "delete"])
    app.post("/api/messages/:id/" + action, (req, res) => {
      const row = own(req);
      const now = Date.now();
      // Reading it in the Message Centre also ends its flash card.
      if (action === "read") (row.readAt = row.readAt || now), (row.closedAt = row.closedAt || now);
      if (action === "close") row.closedAt = row.closedAt || now;
      if (action === "delete") row.deletedAt = now;
      store.put("inbox", row);
      res.json(state(req));
    });
}
