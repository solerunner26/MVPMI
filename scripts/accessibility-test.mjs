import { assertFits } from "./text-size-checks.mjs";
import AxeBuilder from "@axe-core/playwright";
import { launchBrowser } from "./browser.mjs";
import { createApp } from "../server/app.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "Accessible@2026",
  gateCode: "5831",
  development: true,
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await launchBrowser(),
  results = [];
try {
  const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.getByRole("button", { name: /Send request/ }).waitFor();
  const scan = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await assertFits(page, name);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    results.push({
      screen: name,
      violations: result.violations,
      incomplete: result.incomplete,
    });
    console.log(
      name,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
  };
  await scan("signup-gu-light");
  await page.getByTitle("Theme", { exact: true }).click();
  await scan("signup-gu-dark");
  await page.getByTitle("Language", { exact: true }).click();
  await scan("signup-en-dark");
  await page.getByTitle("Theme", { exact: true }).click();
  await scan("signup-en-light");
  await page.locator("input").nth(0).fill("Synthetic Member");
  await page.locator("input").nth(1).fill("9000000001");
  await page.locator("input").nth(2).fill("Thorala");
  await page.getByRole("button", { name: /Send request/ }).click();
  await page.getByRole("dialog").waitFor();
  await scan("consent-dialog");
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page
      .locator("[role=dialog]")
      .evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("[role=dialog]")
      .evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: /Send request/ }).click();
  await page.getByRole("button", { name: /Confirm/ }).click();
  await page.getByRole("button", { name: /Withdraw/ }).waitFor();
  await scan("pending");
  // Synthetic fixture approval for scanning; authentication is tested separately.
  const r = store.all("requests")[0];
  store.put("members", {
    ...r.payload,
    id: "fixture-member",
    owner: r.owner,
    approvedAt: Date.now(),
  });
  store.del("requests", r.id);
  await page.reload();
  await page.getByRole("button", { name: /All Members/ }).waitFor();
  await scan("directory-tiles");
  await page.getByRole("button", { name: /All Members/ }).click();
  await page.getByTitle("Call", { exact: true }).waitFor();
  await scan("directory-list");
  // Do not launch external apps while scanning the original contact sheets.
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest('a[href^="tel:"],a[href^="https://wa.me/"]'))
          e.preventDefault();
      },
      true,
    ),
  );
  for (const title of ["Call", "WhatsApp"]) {
    await page.getByTitle(title, { exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await scan("contact-" + title);
    await page.getByRole("button", { name: /OK/ }).click();
  }
  await page.getByTitle("My profile", { exact: true }).click();
  await page.getByRole("button", { name: /Edit my details/ }).waitFor();
  await scan("profile");
  await page.getByRole("button", { name: "Biggest", exact: true }).click();
  await scan("profile-large-font");
  // Keep Biggest enabled for edit, reset, and all admin screen checks.
  await page.getByRole("button", { name: /Edit my details/ }).click();
  await page.getByRole("button", { name: /Send for approval/ }).waitFor();
  await scan("edit-profile");
  assert.equal(await page.evaluate(() => window.mvpmiBack()), true);
  await page.getByRole("button", { name: /Edit my details/ }).waitFor();
  assert.equal(await page.evaluate(() => window.mvpmiBack()), true);
  await page.getByTitle("MVPMl", { exact: true }).waitFor();
  for (let i = 0; i < 5; i++)
    await page.getByTitle("MVPMl", { exact: true }).click({ force: true });
  await page.getByText("Enter access code", { exact: true }).waitFor();
  await scan("gate");
  for (const digit of "5831")
    await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByPlaceholder("admin", { exact: true }).waitFor();
  await scan("admin-login");
  await page.getByRole("button", { name: /Forgot password/ }).click();
  await page.getByText("Reset password", { exact: true }).waitFor();
  await scan("admin-reset");
  await page.getByRole("button", { name: /Back to login/ }).click();
  await page.getByPlaceholder("admin", { exact: true }).fill("admin");
  await page.locator("input[type=password]").fill("Accessible@2026");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.getByText("New requests", { exact: true }).waitFor();
  await scan("admin-home");
  for (const section of [
    "New requests",
    "Update requests",
    "Delete requests",
    "Members",
    "Archive",
    "Security alerts",
    "Backup & export",
    "Total members",
  ]) {
    const item = page.getByText(section, { exact: true });
    if ((await item.count()) === 0) continue;
    await item.click();
    await page.getByRole("button", { name: /Back to dashboard/ }).waitFor();
    await scan("admin-" + section);
    await page.getByRole("button", { name: /Back to dashboard/ }).click();
  }
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/accessibility.json",
    JSON.stringify(results, null, 2),
  );
  const count = results.reduce((n, r) => n + r.violations.length, 0);
  console.log(
    `${results.length} screens scanned; ${count} rule violations. Incomplete checks require manual review.`,
  );
  if (count) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  store.db.close();
}
