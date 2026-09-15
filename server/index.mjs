import { smsSender } from "./sms.mjs";
import { createApp } from "./app.mjs";
const development = process.env.DEVELOPMENT_MODE === "true";
if (!development)
  throw new Error(
    "Production launch is disabled until member SMS verification, recovery and retention policy are completed. Set DEVELOPMENT_MODE=true for a test deployment with synthetic data only.",
  );
const sms = smsSender(process.env);
const { app } = createApp({
  adminPassword: process.env.ADMIN_PASSWORD,
  gateCode: process.env.ADMIN_GATE_CODE,
  dbPath: process.env.DB_PATH || "data/community.sqlite",
  secure: process.env.COOKIE_SECURE === "true",
  development,
  sms,
  adminPhone: process.env.ADMIN_PHONE,
});
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log(
    `MVPMl development app listening on 0.0.0.0:${port}. Use synthetic contact data only.`,
  ),
);
