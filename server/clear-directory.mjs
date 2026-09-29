// Client hand-over: remove every contact from the database and keep ONLY the
// Main Admin login (and the fixed village list and settings). Used by
// scripts/clear-directory.mjs on the server, and tested here in the suite.
import { mainAdminId } from "./auth.mjs";

// Rows that describe people, requests or logins. "villages" and "config"
// (village list, backup settings, the Main Admin pointer) are kept.
const WIPE = [
  "villageAdmins",
  "rejections",
  "requests",
  "archive",
  "alerts",
  "sessions",
  "transports",
  "recoveries",
  "audit",
  "limits",
  "notifications",
  "devices",
  "pushSubs",
  "pinResets",
];

export function clearDirectory(store) {
  const keep = mainAdminId(store);
  if (!keep || !store.get("members", keep))
    throw new Error("There is no Main Admin in this database; nothing was changed.");
  const removed = {};
  store.tx(() => {
    for (const m of store.all("members"))
      if (m.id !== keep) {
        store.del("members", m.id);
        removed.members = (removed.members || 0) + 1;
      }
    for (const t of WIPE)
      for (const row of store.all(t)) {
        store.del(t, row.id);
        removed[t] = (removed[t] || 0) + 1;
      }
    // The Main Admin's own devices/sessions are gone too: he logs in again.
    store.audit(keep, "directory.cleared", keep);
  });
  return removed;
}
