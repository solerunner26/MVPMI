import { createApp } from "../server/app.mjs";
import { enrollAdministrator } from "../server/village-approval.mjs";
import { useEnglishForLegacyFlows } from "./test-language.mjs";
import { chromium } from "playwright";
import chrome from "@sparticuz/chromium";
import { brotliDecompressSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

// Capture screenshots of the v0.3.4 changes: the admin-login emblem and
// the recovery-code password reset flow (no SMS/OTP anywhere).
const outDir = "docs/modern-design/v034-forgot";
mkdirSync(outDir, { recursive: true });
const libs = tmpdir() + "/mvpmi-browser-libs";
mkdirSync(libs, { recursive: true });
writeFileSync(
  libs + "/libs.tar",
  brotliDecompressSync(
    readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
  ),
);
execFileSync("tar", ["xf", libs + "/libs.tar", "-C", libs]);
const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "TestPreview@2026",
  gateCode: "5831",
  development: true,
});
enrollAdministrator(store, {
  village: "થોરાળા",
  name: "Thorala Village Administrator",
  phone: "7990000010",
  pass: "Village@2026!",
  reason: "Seeded for the browser flow",
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  headless: true,
  executablePath: await chrome.executablePath(),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader"],
  env: { ...process.env, LD_LIBRARY_PATH: libs + "/lib" },
});
useEnglishForLegacyFlows(browser);
const admin = await browser.newContext({ viewport: { width: 412, height: 892 } });
const panel = await admin.newPage();
const shot = (name) => panel.screenshot({ path: `${outDir}/${name}.png` });
await panel.goto(url);
await panel.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).waitFor();
for (let i = 0; i < 5; i++) await panel.getByTestId("Brand logo").click({ force: true });
await panel.getByRole("button", { name: "5", exact: true }).first().waitFor();
for (const digit of "5831")
  await panel.getByRole("button", { name: digit, exact: true }).click();
await panel.getByPlaceholder("admin", { exact: true }).waitFor();
await shot("login-emblem");
await panel.getByTestId("Theme").click();
await shot("login-emblem-dark");
await panel.getByTestId("Theme").click();
await panel.getByPlaceholder("admin", { exact: true }).fill("admin");
await panel.locator("input[type=password]").fill("TestPreview@2026");
await panel.getByRole("button", { name: /^Sign in$|^લોગિન કરો$/ }).click();
const notice = panel.getByRole("dialog", { name: /Recovery code|રિકવરી કોડ/ });
await notice.waitFor();
await shot("recovery-notice");
await panel.getByRole("button", { name: /^Saved it$|^સાચવી લીધો$/ }).click();
await panel.goto(url);
await panel.getByText("Security alerts", { exact: true }).click();
await shot("security-recovery-card");
await panel.getByRole("button", { name: /^New code$|^નવો બનાવો$/ }).click();
await panel.getByRole("button", { name: /^Continue$|^આગળ વધો$/ }).click();
await notice.waitFor();
const code = await notice
  .getByText(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/, { exact: true })
  .innerText();
await panel.getByRole("button", { name: /^Saved it$|^સાચવી લીધો$/ }).click();
await panel.getByTestId("Sign out").click();
await panel.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).waitFor();
for (let i = 0; i < 5; i++) await panel.getByTestId("Brand logo").click({ force: true });
await panel.getByRole("button", { name: "5", exact: true }).first().waitFor();
for (const digit of "5831")
  await panel.getByRole("button", { name: digit, exact: true }).click();
await panel.getByPlaceholder("admin", { exact: true }).waitFor();
await panel.getByRole("button", { name: /Forgot password/ }).click();
await panel.getByText("Reset password", { exact: true }).waitFor();
await shot("forgot-password");
await panel
  .getByRole("button", { name: /Show or hide the code/ })
  .click();
await panel.getByPlaceholder("XXXX-XXXX-XXXX-XXXX").fill(code);
await panel.locator('input[placeholder="At least 10 characters"]').fill("Rotated@2026!");
await panel.getByRole("button", { name: /Set new password/ }).click();
await panel.getByText("Password changed", { exact: true }).waitFor();
await shot("reset-success");
console.log("Captured v0.3.4 screenshots to " + outDir);
await browser.close();
server.close();
store.db.close();
