#!/usr/bin/env node
// Client hand-over: deletes EVERY contact (members, registrations, Village
// Admins, removed-member archive, rejected applications, notifications,
// devices, logins, audit log) and keeps only the Main Admin login, the village
// list and the server settings. It cannot be undone.
//
//   node scripts/clear-directory.mjs --yes [--keep-backups]
//
// Uses DB_PATH from the environment / .env. Stop the app first
// (sudo mvpmi-config clear-directory does all of it). Old local nightly
// backups contain the deleted contacts, so they are deleted too unless
// --keep-backups is given. Copies already stored in Google Drive are not
// touched (delete the "MVPMI backups" folder there yourself).
import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../server/store.mjs";
import { clearDirectory } from "../server/clear-directory.mjs";
import { readEnvFile } from "../server/config-file.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...readEnvFile(root + "/.env"), ...process.env };
const dbPath = resolve(root, env.DB_PATH || "data/community.sqlite");
if (!process.argv.includes("--yes")) {
  console.error("This deletes every contact and keeps only the Main Admin login.\nNothing was changed. Run again with --yes to confirm.");
  process.exit(1);
}
const store = new Store(dbPath);
try {
  const removed = clearDirectory(store);
  store.db.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  console.log("Directory cleared. Removed: " + (Object.entries(removed).map(([k, n]) => n + " " + k).join(", ") || "nothing (already empty)") + ".");
  console.log("Kept: the Main Admin login, the village list and the server settings.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  store.db.close();
}
if (!process.exitCode && !process.argv.includes("--keep-backups")) {
  const folder = join(dirname(dbPath), "backups");
  if (existsSync(folder)) {
    let n = 0;
    for (const name of readdirSync(folder))
      if (/^community-.*\.sqlite$/.test(name)) {
        unlinkSync(join(folder, name));
        n++;
      }
    console.log("Deleted " + n + " old local backup file(s) that still held the old contacts.");
  }
}
