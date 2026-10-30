// Main Admin adds a member directly (owner, 21 Oct 2026).
//
// Only the Main Admin. The member is created already approved (no village
// verification, no request), and can log in at once with their mobile number
// — the same mobile-number login every member uses. The reply carries what
// the app needs to open a WhatsApp message telling the member their profile
// was created. A number that already has a profile or a pending application
// is refused; a removed or rejected number must first be allowed to rejoin
// (Archive), exactly as for a normal registration.
import { randomUUID } from "node:crypto";
import { fail, profile } from "./store.mjs";
import { numberStatus } from "./auth.mjs";
import { ROLES } from "./terms.mjs";
import { clearBlocksFor } from "./rejoin.mjs";

export function installDirectAdd(app, store, { admin, rate, state, notify = () => {} }) {
  app.post("/api/admin/members/add", admin, (req, res) => {
    if (req.role !== ROLES.MAIN_ADMIN) fail("Only the Main Admin can add members directly", 403, "FORBIDDEN");
    rate("direct-add:" + req.me.id, 120, 3600000);
    const mobile = String(req.body.phone ?? "").replace(/\D/g, "");
    // A rejected or removed number can be added when the Main Admin says so
    // (Correct & add, owner 30 Oct 2026); its block is lifted at the same time.
    const override = req.body.allowBlocked === true;
    if (/^[6-9]\d{9}$/.test(mobile)) {
      const status = numberStatus(store, mobile);
      if (status && !(override && (status === "REJECTED" || status === "REMOVED")))
        fail("Status " + status, 409, "STATUS_" + status, { field: "phone" });
    }
    const p = profile(req.body, store.all("villages"));
    const now = Date.now();
    const m = {
      ...p,
      id: randomUUID(),
      owner: randomUUID(),
      createdAt: now,
      approvedAt: now,
      approvedBy: req.me.id,
      addedBy: "main-admin",
      consentAt: now,
      consentVersion: "main-admin-added-v1",
    };
    store.tx(() => {
      if (override) clearBlocksFor(store, mobile, req.me);
      store.unique(p, m.owner);
      store.put("members", m);
      store.audit(req.me.id, "member.direct-add", m.id);
    });
    const v = store.get("villages", m.village);
    notify("village:" + m.village, {
      kind: "member-added",
      titleGu: "નવો સભ્ય ઉમેરાયો · " + (v?.gu || m.village),
      titleEn: "New member added · " + (v?.en || m.village),
      bodyGu: m.nameGu || m.name,
      bodyEn: m.name,
    });
    res.json({
      ...state(req),
      added: { id: m.id, name: m.name, nameGu: m.nameGu, phone: m.phone, village: m.village },
    });
  });
}
