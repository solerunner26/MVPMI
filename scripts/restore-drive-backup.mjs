// Turn a Google Drive backup (mvpmi-….sqlite.gz.enc) back into a database.
//   BACKUP_PASSPHRASE='…' node scripts/restore-drive-backup.mjs <backup.enc> [out.sqlite]
// Then stop the app, replace data/community.sqlite with the output file
// (delete community.sqlite-wal and -shm next to it) and start the app again.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { decryptBackup } from "../server/drive-backup.mjs";

const [input, output = "restored-community.sqlite"] = process.argv.slice(2);
const passphrase = process.env.BACKUP_PASSPHRASE || "";
if (!input || passphrase.length < 16) {
  console.error("Usage: BACKUP_PASSPHRASE='…' node scripts/restore-drive-backup.mjs <backup.enc> [out.sqlite]");
  process.exit(2);
}
if (existsSync(output)) {
  console.error("Refusing to overwrite " + output);
  process.exit(2);
}
const plain = decryptBackup(readFileSync(input), passphrase);
if (plain.subarray(0, 15).toString() !== "SQLite format 3") throw new Error("Decrypted data is not a SQLite database");
writeFileSync(output, plain, { mode: 0o600 });
console.log("Restored database written to " + output + " (" + plain.length + " bytes)");
