// Nightly Google Drive backup run by the server's timer (or by hand):
//   node scripts/backup-drive-now.mjs
// Uses the same settings as the app (DB_PATH, GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, BACKUP_PASSPHRASE, PUBLIC_URL). Safe while the app
// is running (SQLite WAL + VACUUM INTO snapshot).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../server/store.mjs";
import { createDriveBackup } from "../server/drive-backup.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const store = new Store(resolve(root, process.env.DB_PATH || "data/community.sqlite"));
const drive = createDriveBackup(store, process.env);
try {
  if (!drive.configured) {
    console.log("Drive backup is not configured on this server; skipped.");
  } else if (!drive.status().connected) {
    console.log("Google Drive is not connected yet (admin → Backup & export); skipped.");
  } else {
    const r = await drive.backup("timer");
    console.log(`Backup uploaded: ${r.name} (${r.bytes} bytes)`);
  }
} catch (e) {
  console.error("Drive backup failed: " + e.message);
  process.exitCode = 1;
} finally {
  store.db.close();
}
