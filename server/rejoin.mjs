// Rejected and removed numbers (owner, 30 Oct 2026).
//
// A number that was rejected (e.g. a wrong name) or removed cannot register
// again until the Main Admin allows it. From his Settings he can allow one
// number, allow ALL of them at once, or correct the details himself and add
// the person straight to the directory (Add member). Nothing is deleted: the
// history stays in the archive and the rejection ledger.
import { ROLES } from "./terms.mjs";
import { fail } from "./store.mjs";

const blockedRejection = (r) => r.events?.[r.events.length - 1]?.action === "reject";

function clearRejection(store, r, actor) {
  const last = r.events[r.events.length - 1];
  store.put("rejections", {
    ...r,
    events: [
      ...r.events,
      {
        requestId: last?.requestId || r.id,
        owner: last?.owner || "admin",
        action: "cleared",
        reason: "Allowed to register again",
        actor: actor.id,
        actorName: actor.nameGu || actor.name,
        level: "main",
        category: r.category,
        at: Date.now(),
        snapshot: last?.snapshot,
      },
    ],
  });
}

// Every block on this number (rejections and removed records) is lifted.
export function clearBlocksFor(store, phone, actor) {
  let n = 0;
  for (const r of store.all("rejections"))
    if ((r.phone === phone || r.phone2 === phone) && blockedRejection(r)) clearRejection(store, r, actor), n++;
  for (const a of store.all("archive"))
    if (!a.rejoinAllowed && [a.phone, a.phone2, ...(a.numbers || [])].includes(phone))
      store.put("archive", { ...a, rejoinAllowed: true, rejoinAllowedAt: Date.now(), rejoinAllowedBy: actor.id }), n++;
  return n;
}

export function installRejoin(app, store, { admin, state }) {
  app.post("/api/admin/rejoin/allow-all", admin, (req, res) => {
    if (req.role !== ROLES.MAIN_ADMIN) fail("Only the Main Admin can do this", 403, "FORBIDDEN");
    let n = 0;
    store.tx(() => {
      for (const r of store.all("rejections")) if (blockedRejection(r)) clearRejection(store, r, req.me), n++;
      for (const a of store.all("archive"))
        if (!a.rejoinAllowed) store.put("archive", { ...a, rejoinAllowed: true, rejoinAllowedAt: Date.now(), rejoinAllowedBy: req.me.id }), n++;
      store.audit(req.me.id, "rejoin.allow-all", String(n));
    });
    res.json({ ...state(req), allowed: n });
  });
}
