import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { randomBytes, randomInt } from "node:crypto";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    "Please install Node.js 22.13 or a newer LTS version, then open the launcher again.",
  );
  process.exit(1);
}
await import("./build.mjs");
const { createApp } = await import("../server/app.mjs");
const { passwordMatches } = await import("../server/store.mjs");
mkdirSync("data", { recursive: true });
const settingsFile = "data/phone-test-settings.json";
if (!existsSync(settingsFile)) {
  writeFileSync(
    settingsFile,
    JSON.stringify(
      {
        password: "Test@" + randomBytes(8).toString("hex") + "9",
        gate: String(randomInt(1000, 10000)),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}
const settings = JSON.parse(readFileSync(settingsFile, "utf8"));
const port = Number(process.env.TEST_PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("TEST_PORT must be between 1024 and 65535");
const { app, store } = createApp({
  dbPath: "data/phone-testing.sqlite",
  adminPassword: settings.password,
  gateCode: settings.gate,
  development: true,
  secure: false,
});
const server = app.listen(port, "0.0.0.0", () => {
  const saved = store.get("config", "admin");
  console.log("\n==========================================================");
  console.log("MVPMl PHONE / EMULATOR TEST SERVER — NOT PRODUCTION");
  console.log("Use made-up contacts only. Keep this window open.");
  console.log("==========================================================");
  console.log(`Computer browser: http://localhost:${port}`);
  console.log(`Android emulator: http://10.0.2.2:${port}`);
  console.log("\nFor your PHONE, use the address matching your Wi-Fi:");
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && !a.internal && a.family === "IPv4");
  for (const a of addresses) console.log(`  http://${a.address}:${port}`);
  if (!addresses.length)
    console.log("  No network address found. Connect the computer to Wi-Fi.");
  console.log("\nPhone and computer must be on the same trusted Wi-Fi.");
  console.log(
    "If Windows Firewall asks, allow Node.js on PRIVATE networks only.",
  );
  console.log("\nADMIN — tap the sun logo 5 times quickly:");
  console.log("  Username: admin");
  console.log(
    "  Access code: " +
      (passwordMatches(settings.gate, saved.gate)
        ? settings.gate
        : "Use your previously configured access code"),
  );
  console.log(
    "  Password: " +
      (passwordMatches(settings.password, saved.password)
        ? settings.password
        : "Password was changed. Use your new password."),
  );
  console.log(
    "\nThese credentials belong only to THIS computer test database.",
  );
  console.log("They are different from the Arena preview credentials.");
  console.log(
    "Stop the server with Ctrl+C. Do not expose it to the internet.\n",
  );
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Close the other server window and try again.`
      : "Could not start server: " + error.message,
  );
  store.db.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      store.db.close();
      process.exit(0);
    });
  });
