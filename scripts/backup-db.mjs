// Consistent daily database backup for shared hosting (cron job).
//   node scripts/backup-db.mjs [database] [backup folder] [days to keep]
// Uses SQLite's "VACUUM INTO", which is safe while the app is running
// (a plain file copy of a live WAL database can be incomplete).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const database = resolve(root, process.argv[2] || process.env.DB_PATH || "data/community.sqlite");
const folder = resolve(root, process.argv[3] || "backups");
const keepDays = Number(process.argv[4] || 30);
mkdirSync(folder, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const target = join(folder, `community-${stamp}.sqlite`);
const db = new DatabaseSync(database, { readOnly: true });
db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
db.close();
for (const name of readdirSync(folder)) {
  const file = join(folder, name);
  if (/^community-.*\.sqlite$/.test(name) && statSync(file).mtimeMs < Date.now() - keepDays * 86400000)
    unlinkSync(file);
}
console.log("Backup written: " + target);
