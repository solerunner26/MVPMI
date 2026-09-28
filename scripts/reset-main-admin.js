#!/usr/bin/env node
// Server-only recovery for a forgotten Main Admin PASSWORD (Section 2).
// There is no password reset inside the app.
//
//   node scripts/reset-main-admin.js            (asks for the new password)
//   MVPMI_NEW_PASSWORD='...' node scripts/reset-main-admin.js
//
// Uses DB_PATH from the environment / .env (default data/community.sqlite).
// Every device where the Main Admin was logged in must log in again.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../server/store.mjs";
import { resetMainAdminPassword } from "../server/auth.mjs";
import { isPasswordFormat, PASSWORD_MIN } from "../server/terms.mjs";
import { readEnvFile } from "../server/config-file.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...readEnvFile(root + "/.env"), ...process.env };
const dbPath = resolve(root, env.DB_PATH || "data/community.sqlite");

// Reads a line without showing what is typed.
function ask(question) {
  return new Promise((done) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const raw = !!stdin.isTTY;
    if (raw) stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    let value = "";
    const finish = () => {
      if (raw) stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      done(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish();
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

let password = process.env.MVPMI_NEW_PASSWORD;
if (!password) {
  password = await ask(`New Main Admin password (at least ${PASSWORD_MIN} characters): `);
  const again = await ask("Type it again: ");
  if (again !== password) {
    console.error("The two passwords do not match. Nothing changed.");
    process.exit(1);
  }
}
if (!isPasswordFormat(password)) {
  console.error(`The password must be at least ${PASSWORD_MIN} characters. Nothing changed.`);
  process.exit(1);
}
const store = new Store(dbPath);
try {
  const m = resetMainAdminPassword(store, password);
  console.log(`Main Admin password reset for mobile ending ${m.phone.slice(-4)}. All Main Admin devices must log in again.`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
} finally {
  store.db.close();
}
