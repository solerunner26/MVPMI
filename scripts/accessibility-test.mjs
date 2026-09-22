import { chooseLanguage } from "./preferences-checks.mjs";
import { enrollAdministrator } from "../server/village-approval.mjs";
import { captureModernVariants } from "./capture-modern.mjs";
import { verifyOpaqueModalContrast } from "./modal-contrast-checks.mjs";
import { openMemberHelp } from "./preferences-checks.mjs";
import { toggleTheme } from "./preferences-checks.mjs";
import { assertFits, setTextSize } from "./text-size-checks.mjs";
import AxeBuilder from "@axe-core/playwright";
import { launchBrowser } from "./browser.mjs";
import { createApp } from "../server/app.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
mkdirSync("test-results", { recursive: true });
const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "Accessible@2026",
  gateCode: "5831",
  development: true,
});
enrollAdministrator(store, {
  village: "થોરાળા",
  name: "Thorala Village Administrator",
  phone: "7990000010",
  pass: "Village@2026!",
  reason: "Seeded for the accessibility flow",
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
  if (process.env.CAPTURE_DESIGN) {
    mkdirSync("test-results/modern-design/screens", { recursive: true });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
      Object.defineProperty(navigator, "deviceMemory", { value: 8 });
    });
  }
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.getByTestId("Language").waitFor();
  const scan = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await assertFits(page, name);
    if (process.env.CAPTURE_DESIGN)
      await page.screenshot({
        path: "test-results/modern-design/screens/" + name + ".png",
      });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const verifiedContrast = await verifyOpaqueModalContrast(
      page,
      result.incomplete,
      name,
    );
    results.push({
      screen: name,
      violations: result.violations,
      incomplete: result.incomplete,
      verifiedContrast,
    });
    await captureModernVariants(page, name);
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
  await page.getByTestId("Reading settings").click();
  await scan("reading-settings-gu");
  await chooseLanguage(page, "en");
  await scan("reading-settings-en");
  await chooseLanguage(page, "gu");
  await page.getByRole("button", { name: /બંધ કરો/ }).click();
  await openMemberHelp(page);
  await scan("member-help-gu");
  await page.getByRole("button", { name: /સમજાયું/ }).click();
  await toggleTheme(page);
  await scan("signup-gu-dark");
  await page.getByTestId("Language").click();
  await scan("signup-en-dark");
  await toggleTheme(page);
  await scan("signup-en-light");
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).fill("Synthetic");
  await page.getByPlaceholder(/ચૌધરી|Chaudhary/).fill("Member");
  await page.locator('input[inputmode="numeric"]').first().fill("9000000001");
  await page
    .getByRole("combobox", { name: /Village|ગામ/ })
    .selectOption("થોરાળા");
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).click();
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
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).click();
  await page.getByRole("button", { name: /Submit request|વિનંતી મોકલો/ }).click();
  await page.getByRole("button", { name: /Withdraw|કેન્સલ કરો/ }).waitFor();
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
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  await scan("directory-tiles");
  await page
    .getByRole("button", { name: /^Villages$|^ગામો$/ })
    .click();
  await page.locator(".village-tile").first().waitFor();
  await page.getByRole("button", { name: /Reorder villages|ગામનો ક્રમ બદલો/ }).click();
  await scan("village-reordering");
  await page.getByRole("button", { name: /Done|પૂર્ણ/ }).click();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).click();
  await page.getByTestId("Call").first().waitFor();
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
    await page.getByTitle(title, { exact: true }).first().click();
    await page.getByRole("dialog").waitFor();
    await scan("contact-" + title);
    await page.getByRole("button", { name: /OK/ }).click();
  }
  await page.getByTestId("My profile").click();
  await page.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).waitFor();
  await scan("profile");
  await setTextSize(page, 165);
  await scan("profile-large-font");
  // Keep Biggest enabled for edit, reset, and all admin screen checks.
  await page.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).click();
  await page.getByRole("button", { name: /Send for approval/ }).waitFor();
  await scan("edit-profile");
  assert.equal(await page.evaluate(() => window.mvpmiBack()), true);
  await page.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).waitFor();
  assert.equal(await page.evaluate(() => window.mvpmiBack()), true);
  await page.getByTestId("Brand logo").waitFor();
  for (let i = 0; i < 5; i++)
    await page.getByTestId("Brand logo").click({ force: true });
  await page.getByRole("button", { name: "5", exact: true }).first().waitFor();
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
  await page.getByRole("button", { name: /^Sign in$|^લોગિન કરો$/ }).click();
  await page.getByText("Requests", { exact: true }).first().waitFor();
  await scan("admin-home");
  for (const section of [
    "Requests",
    "Members",
    "Reports",
    "Archive",
    "Security alerts",
    "Backup & export",
    "Notifications",
    "Total members",
  ]) {
    const item = page.getByText(section, { exact: true });
    if ((await item.count()) === 0) continue;
    await item.click();
    await page.getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ }).waitFor();
    if (section === "Total members") {
      // Also scan the all-members list behind the first stats tile.
      await page.locator(".stats-village-grid .mvpmi-tile").first().click();
      await page.getByRole("button", { name: /Back to village list|ગામની યાદી પર પાછા/ }).waitFor();
      await scan("admin-all-members");
      await page.getByRole("button", { name: /Back to village list|ગામની યાદી પર પાછા/ }).click();
    }
    await scan("admin-" + section);
    await page.getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ }).click();
  }
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/accessibility.json",
    JSON.stringify(results, null, 2),
  );
  const count = results.reduce((n, r) => n + r.violations.length, 0);
  console.log(
    `${results.length} screens scanned; ${count} rule violations. ${results.reduce((n, r) => n + r.verifiedContrast.length, 0)} modal text checks independently verified (raw axe uncertainty retained). Real-device/manual review is still required.`,
  );
  if (count) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  store.db.close();
}
