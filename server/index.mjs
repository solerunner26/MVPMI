import { createApp } from "./app.mjs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Configuration comes from environment variables (see .env.example).
//
//   DEVELOPMENT_MODE=true  → local testing: enables the cookie-free preview
//                            transport and allows plain-HTTP cookies.
//   DEVELOPMENT_MODE=false → the real deployment (HTTPS required).
const development = process.env.DEVELOPMENT_MODE === "true";
const secure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : !development;
if (!development && !secure)
  throw new Error(
    "A live deployment must use HTTPS. Set COOKIE_SECURE=true (and serve the site over https://).",
  );

// cPanel "Setup Node.js App" runs the app behind Apache + Passenger, which
// forwards the visitor's address in X-Forwarded-For. TRUST_PROXY=1 trusts
// exactly one proxy hop. It is switched on automatically under Passenger.
const underPassenger =
  typeof globalThis.PhusionPassenger !== "undefined" ||
  !!process.env.PASSENGER_APP_ENV;
const trustRaw = process.env.TRUST_PROXY ?? (underPassenger ? "1" : "");
const trustProxy =
  trustRaw === "" || trustRaw === "false"
    ? false
    : /^\d+$/.test(trustRaw)
      ? Number(trustRaw)
      : trustRaw === "true"
        ? true
        : trustRaw;

const root = fileURLToPath(new URL("..", import.meta.url));
const { app } = createApp({
  adminPassword: process.env.ADMIN_PASSWORD,
  gateCode: process.env.ADMIN_GATE_CODE,
  // Relative database paths are resolved from the project folder.
  dbPath: resolve(root, process.env.DB_PATH || "data/community.sqlite"),
  secure,
  development,
  trustProxy,
  publicHosts: (process.env.PUBLIC_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
  requireAppLock: process.env.REQUIRE_APP_LOCK !== "false",
  vapidSubject: process.env.VAPID_SUBJECT || undefined,
  // Where the shared Android APK is kept (served at /download).
  ...(process.env.DOWNLOAD_DIR ? { downloadDir: resolve(root, process.env.DOWNLOAD_DIR) } : {}),
});

// PORT can be a number or (for some hosting proxies) a socket path.
const rawPort = process.env.PORT || "3000";
const port = /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort;
let server;
const onListen = () => {
  const address = server?.address?.();
  const shown = address && typeof address === "object" ? address.port : port;
  console.log(
    `MVPMI community directory listening on ${shown} (${development ? "development" : "live"} mode).`,
  );
};
server =
  typeof port === "number"
    ? app.listen(port, process.env.HOST || "0.0.0.0", onListen)
    : app.listen(port, onListen);
