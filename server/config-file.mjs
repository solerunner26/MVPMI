import { readFileSync, existsSync } from "node:fs";

// Minimal KEY=VALUE reader for config/main-admin.env (no dependency). Values
// already in the environment win, so /etc/mvpmi.env keeps working.
export function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    let value = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[line.slice(0, i).trim()] = value;
  }
  return out;
}

export function mainAdminConfig(root, env = process.env) {
  const file = readEnvFile(root + "/config/main-admin.env");
  const pick = (key) => env[key] || file[key] || "";
  return {
    name: pick("MAIN_ADMIN_NAME"),
    nameGu: pick("MAIN_ADMIN_NAME_GU"),
    mobile: pick("MAIN_ADMIN_MOBILE"),
    village: pick("MAIN_ADMIN_VILLAGE"),
    location: pick("MAIN_ADMIN_LOCATION"),
    password: pick("MAIN_ADMIN_PASSWORD"),
  };
}
