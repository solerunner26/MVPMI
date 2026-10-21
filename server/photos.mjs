// Profile pictures (owner, 21 Oct 2026).
//
// A member adds, changes or removes their own photo (camera or gallery); it
// shows to every signed-in member at once. The Main Admin, and the Village
// Admin for their own village, can remove an unsuitable photo. Photos live in
// their own `photos` table (one small JPEG per member, made square and
// resized on the phone), never inside member records, and are served only to
// signed-in members while the app is not locked.
import { fail } from "./store.mjs";
import { ROLES } from "./terms.mjs";

const MAX_BYTES = 400 * 1024;

export const photoVersions = (store) => new Map(store.all("photos").map((p) => [p.id, p.at]));

export function installPhotos(app, store, { rate, state, locked }) {
  const me = (req) => {
    if (!req.me) fail("Please log in", 401, "SESSION");
    if (req.mustSetPin || locked(req)) fail("Locked", 423, "LOCKED");
    return req.me;
  };
  const save = (memberId, by, dataUrl) => {
    const m = typeof dataUrl === "string" && /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) fail("ફોટો JPEG હોવો જોઈએ · The photo must be a JPEG image");
    const bytes = Buffer.from(m[1], "base64");
    if (bytes.length < 200 || bytes.length > MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
      fail("ફોટો બરાબર નથી અથવા બહુ મોટો છે · The photo is not valid or too large");
    store.put("photos", { id: memberId, data: bytes.toString("base64"), at: Date.now(), by });
  };

  app.post("/api/profile/photo", (req, res) => {
    const m = me(req);
    rate("photo:" + m.id, 30, 3600000);
    save(m.id, m.id, req.body.data);
    store.audit(m.id, "photo.set", m.id);
    res.json(state(req));
  });
  app.post("/api/profile/photo/delete", (req, res) => {
    const m = me(req);
    store.del("photos", m.id);
    store.audit(m.id, "photo.removed", m.id);
    res.json(state(req));
  });
  // Main Admin (any member) or the Village Admin of that member's village.
  app.post("/api/members/:id/photo/delete", (req, res) => {
    const actor = me(req);
    const target = store.get("members", String(req.params.id));
    if (!target) fail("Member not found", 404, "NOT_FOUND");
    const village = store.get("villageAdmins", target.village);
    const allowed =
      req.role === ROLES.MAIN_ADMIN ||
      (req.role === ROLES.VILLAGE_ADMIN && village && village.memberId === actor.id && !village.disabled);
    if (!allowed) fail("Only an administrator can remove another member's photo", 403, "FORBIDDEN");
    store.del("photos", target.id);
    store.audit(actor.id, "photo.removed", target.id);
    res.json(state(req));
  });
  app.get("/api/photos/:id", (req, res) => {
    me(req);
    const p = store.get("photos", String(req.params.id));
    if (!p || !store.get("members", p.id)) return res.status(404).json({ error: "No photo" });
    res.set("Content-Type", "image/jpeg");
    // The URL carries the photo's version (?v=), so phones may keep it.
    res.set("Cache-Control", "private, max-age=31536000, immutable");
    res.send(Buffer.from(p.data, "base64"));
  });
}
