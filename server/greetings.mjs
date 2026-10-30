// Greetings from the Main Admin (owner, 21 Oct 2026; images, likes and
// editing 30 Oct 2026).
//
// Only the Main Admin sends: a short text in any language (Gujarati, English,
// Hindi) and/or ONE picture, to everyone or to members he picks by name.
// Every recipient gets
//   - a "flash" card in the app that stays until it is closed with X,
//   - a phone notification, and
//   - the message in their Message Centre (the only place the picture is
//     shown), where they can Like it and Save the picture.
// Storage: `greetings` (what was sent), `greetingImages` (ONE copy of each
// picture, never one per member) and `inbox` (one small row per recipient:
// seen / read / liked / deleted). Likes and views never create notifications;
// the Main Admin looks them up whenever he wants (who saw, who liked).
// He can edit the text or picture of a greeting, or remove it for everyone.
// Nothing here changes members or any other record.
import { randomUUID } from "node:crypto";
import { fail } from "./store.mjs";
import { ROLES } from "./terms.mjs";

const MAX_TEXT = 2000;
const MAX_IMAGE = 2 * 1024 * 1024;

function imageBytes(dataUrl) {
  const m = typeof dataUrl === "string" && /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) fail("ફોટો JPEG હોવો જોઈએ · The picture must be a JPEG image");
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length < 200 || bytes.length > MAX_IMAGE || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    fail("ફોટો બરાબર નથી અથવા બહુ મોટો છે · The picture is not valid or too large");
  return bytes;
}

// Likes and views of one greeting (counted from the inbox rows).
function tally(store, gid) {
  const rows = store.all("inbox").filter((r) => r.greetingId === gid);
  return {
    rows,
    seen: rows.filter((r) => r.closedAt || r.readAt).length,
    liked: rows.filter((r) => r.likedAt && !r.deletedAt).length,
  };
}

export function greetingState(store, req) {
  if (!req.me) return {};
  const likes = new Map();
  for (const r of store.all("inbox")) if (r.likedAt && !r.deletedAt) likes.set(r.greetingId, (likes.get(r.greetingId) || 0) + 1);
  const mine = store
    .all("inbox")
    .filter((r) => r.memberId === req.me.id && !r.deletedAt)
    .sort((a, b) => b.at - a.at)
    .map((r) => {
      const g = store.get("greetings", r.greetingId);
      return g
        ? {
            id: g.id,
            at: g.at,
            text: g.text || "",
            image: g.imageAt || 0,
            edited: g.editedAt || 0,
            read: !!r.readAt,
            closed: !!r.closedAt,
            liked: !!r.likedAt,
            likes: likes.get(g.id) || 0,
          }
        : null;
    })
    .filter(Boolean);
  const out = { messages: mine, messagesUnread: mine.filter((m) => !m.read).length };
  if (req.role === ROLES.MAIN_ADMIN)
    out.greetingsSent = store
      .all("greetings")
      .sort((a, b) => b.at - a.at)
      .slice(0, 50)
      .map((g) => {
        const t = tally(store, g.id);
        return { id: g.id, at: g.at, text: g.text || "", image: g.imageAt || 0, edited: g.editedAt || 0, to: g.to, count: g.count, seen: t.seen, liked: t.liked };
      });
  return out;
}

export function installGreetings(app, store, { notifier, rate, state, mainAdminId, locked = () => false }) {
  const me = (req) => {
    if (!req.me) fail("Please log in", 401, "SESSION");
    return req.me;
  };
  const main = (req) => {
    const m = me(req);
    if (req.role !== ROLES.MAIN_ADMIN) fail("Only the Main Admin can send greetings", 403, "FORBIDDEN");
    return m;
  };
  const cleanText = (raw) => {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text.length > MAX_TEXT) fail("સંદેશ 2000 અક્ષર સુધી · A message can have up to 2000 characters");
    return text;
  };
  const greeting = (id) => {
    const g = store.get("greetings", String(id));
    if (!g) fail("Greeting not found", 404, "NOT_FOUND");
    return g;
  };

  app.post("/api/admin/greetings", (req, res) => {
    const sender = main(req);
    rate("greet:" + sender.id, 30, 3600000);
    const text = cleanText(req.body.text);
    const image = req.body.image ? imageBytes(req.body.image) : null;
    if (!text && !image) fail("સંદેશ લખો અથવા ફોટો ઉમેરો · Write a message or add a picture");
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
    if (image) g.imageAt = at;
    store.tx(() => {
      store.put("greetings", g);
      if (image) store.put("greetingImages", { id: g.id, data: image.toString("base64"), at });
      for (const m of recipients) store.put("inbox", { id: g.id + ":" + m.id, greetingId: g.id, memberId: m.id, at });
      store.audit(sender.id, "greeting.sent", g.id + " · " + recipients.length);
    });
    const preview = text ? (text.length > 140 ? text.slice(0, 137) + "…" : text) : "";
    notifier.notify(
      [...new Set(recipients.map((m) => "owner:" + m.owner).filter((k) => k !== "owner:undefined"))],
      {
        kind: "greeting",
        titleGu: "સમાજ તરફથી સંદેશ",
        titleEn: "Message from the community",
        bodyGu: preview || "📷 નવો ફોટો — સંદેશ કેન્દ્રમાં જુઓ",
        bodyEn: preview || "📷 New picture — open the Message Centre",
      },
    );
    res.json({ ...state(req), sent: { id: g.id, count: recipients.length } });
  });

  // Edit: new text and/or picture. image: data URL = replace, null = remove,
  // missing = keep. Recipients see the change; nobody is notified again.
  app.post("/api/admin/greetings/:id/edit", (req, res) => {
    const sender = main(req);
    const g = greeting(req.params.id);
    const text = req.body.text === undefined ? g.text || "" : cleanText(req.body.text);
    let image;
    if (req.body.image) image = imageBytes(req.body.image);
    const removeImage = req.body.image === null;
    const hasImage = image ? true : removeImage ? false : !!g.imageAt;
    if (!text && !hasImage) fail("સંદેશ લખો અથવા ફોટો ઉમેરો · Write a message or add a picture");
    const now = Date.now();
    store.tx(() => {
      const next = { ...g, text, editedAt: now };
      if (image) {
        next.imageAt = now;
        store.put("greetingImages", { id: g.id, data: image.toString("base64"), at: now });
      } else if (removeImage) {
        delete next.imageAt;
        store.del("greetingImages", g.id);
      }
      store.put("greetings", next);
      store.audit(sender.id, "greeting.edited", g.id);
    });
    res.json(state(req));
  });

  // Remove for everyone (the greeting, its picture and every inbox row).
  app.post("/api/admin/greetings/:id/delete", (req, res) => {
    const sender = main(req);
    const g = greeting(req.params.id);
    store.tx(() => {
      for (const r of store.all("inbox").filter((r) => r.greetingId === g.id)) store.del("inbox", r.id);
      store.del("greetingImages", g.id);
      store.del("greetings", g.id);
      store.audit(sender.id, "greeting.deleted", g.id);
    });
    res.json(state(req));
  });

  // Who saw it and who liked it — looked up on demand, never notified.
  app.get("/api/admin/greetings/:id/stats", (req, res) => {
    main(req);
    const g = greeting(req.params.id);
    const t = tally(store, g.id);
    const person = (r) => {
      const m = store.get("members", r.memberId);
      return m ? { id: m.id, name: m.name, nameGu: m.nameGu, village: m.village } : null;
    };
    const seen = t.rows
      .filter((r) => r.closedAt || r.readAt)
      .sort((a, b) => (a.closedAt || a.readAt) - (b.closedAt || b.readAt))
      .map((r) => ({ ...person(r), at: r.readAt || r.closedAt, liked: !!(r.likedAt && !r.deletedAt) }))
      .filter((x) => x.id);
    const liked = t.rows
      .filter((r) => r.likedAt && !r.deletedAt)
      .sort((a, b) => a.likedAt - b.likedAt)
      .map((r) => ({ ...person(r), at: r.likedAt }))
      .filter((x) => x.id);
    res.json({ id: g.id, count: g.count, seen, liked, notSeen: g.count - seen.length });
  });

  // The ONE stored picture, for the Main Admin and the members it was sent
  // to (while it is in their list). The URL carries the version (?v=).
  app.get("/api/greetings/:id/image", (req, res) => {
    const m = me(req);
    if (req.mustSetPin || locked(req)) fail("Locked", 423, "LOCKED");
    const g = greeting(req.params.id);
    if (req.role !== ROLES.MAIN_ADMIN) {
      const row = store.get("inbox", g.id + ":" + m.id);
      if (!row || row.deletedAt) fail("Greeting not found", 404, "NOT_FOUND");
    }
    const img = store.get("greetingImages", g.id);
    if (!img) return res.status(404).json({ error: "No picture" });
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "private, max-age=31536000, immutable");
    res.send(Buffer.from(img.data, "base64"));
  });

  const own = (req) => {
    const m = me(req);
    const row = store.get("inbox", String(req.params.id) + ":" + m.id);
    if (!row || row.deletedAt) fail("Message not found", 404, "NOT_FOUND");
    return row;
  };
  // read: opened in the Message Centre; close: flash card closed with X
  // (it stays unread in the Message Centre); like / unlike; delete: hidden
  // for this member.
  for (const action of ["read", "close", "like", "unlike", "delete"])
    app.post("/api/messages/:id/" + action, (req, res) => {
      const row = own(req);
      const now = Date.now();
      // Reading it in the Message Centre also ends its flash card.
      if (action === "read") (row.readAt = row.readAt || now), (row.closedAt = row.closedAt || now);
      if (action === "close") row.closedAt = row.closedAt || now;
      if (action === "like") (row.likedAt = row.likedAt || now), (row.readAt = row.readAt || now), (row.closedAt = row.closedAt || now);
      if (action === "unlike") delete row.likedAt;
      if (action === "delete") row.deletedAt = now;
      store.put("inbox", row);
      res.json(state(req));
    });
}
