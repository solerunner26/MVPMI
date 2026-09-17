import { verifyOpaqueModalContrast } from "./modal-contrast-checks.mjs";
import { toggleTheme } from "./preferences-checks.mjs";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { launchBrowser } from "./browser.mjs";
import { assertFits, setTextSize } from "./text-size-checks.mjs";
import { createApp } from "../server/app.mjs";
const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "MaterialTest@2026",
  gateCode: "5831",
  development: true,
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = "http://127.0.0.1:" + server.address().port;
const browser = await launchBrowser(),
  results = [],
  errors = [];
mkdirSync("test-results/modern-design", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    reducedMotion: "reduce",
  });
  // Explicit high-capability simulation; not a low-end GPU performance claim.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
    Object.defineProperty(navigator, "deviceMemory", { value: 8 });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByTestId("Reading settings").waitFor();
  const scan = async (name) => {
    await page
      .locator(".preferences-panel")
      .evaluateAll((panels) =>
        panels.forEach((panel) => (panel.scrollTop = 0)),
      );
    await assertFits(page, name);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    if (result.incomplete.length)
      writeFileSync(
        "test-results/material-incomplete.json",
        JSON.stringify({ name, incomplete: result.incomplete }, null, 2),
      );
    const verifiedContrast = await verifyOpaqueModalContrast(
      page,
      result.incomplete,
      name,
    );
    results.push({
      name,
      violations: result.violations,
      incomplete: result.incomplete,
      verifiedContrast,
    });
    assert.deepEqual(
      result.violations.map((x) => x.id),
      [],
      name,
    );
    await page.screenshot({
      path: "test-results/modern-design/" + name + ".png",
    });
  };
  for (const theme of ["light", "dark"]) {
    if ((await page.locator(".app").getAttribute("data-theme")) !== theme)
      await toggleTheme(page);
    for (const mode of ["blur", "opaque", "translucent"]) {
      await page.getByTestId("Reading settings").click();
      const toggle = page.getByRole("switch");
      if (
        ((await toggle.getAttribute("aria-checked")) === "true") !==
        (mode !== "opaque")
      )
        await toggle.click();
      await page.evaluate((disable) => {
        window.__supportsOriginal ||= CSS.supports.bind(CSS);
        CSS.supports = (...args) =>
          disable && String(args[0]).includes("backdrop-filter")
            ? false
            : window.__supportsOriginal(...args);
      }, mode === "translucent");
      for (const percent of [85, 165]) {
        await setTextSize(page, percent);
        assert.equal(
          await page.locator(".app").getAttribute("data-material"),
          mode,
        );
        await scan(`${theme}-${mode}-${percent}-settings`);
      }
      await page.getByRole("button", { name: /Close/ }).click();
      await scan(`${theme}-${mode}-165-form`);
      await page.evaluate(() => {
        CSS.supports = window.__supportsOriginal;
      });
    }
  }
  // OS preference overrides are exercised through Chromium's media engine.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-reduced-transparency", value: "reduce" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ],
  });
  await page.waitForFunction(
    () => document.querySelector(".app").dataset.material === "opaque",
  );
  await scan("system-reduced-transparency");
  await page.emulateMedia({ forcedColors: "active" });
  await scan("system-forced-colors");
  await page.emulateMedia({ forcedColors: "none" });
  // First-load server outage must expose Retry, not an endless busy scrim.
  const unavailable = await context.newPage();
  await unavailable.route("**/api/**", (r) => r.abort());
  await unavailable.goto(url);
  await unavailable.locator(".connection-banner").waitFor();
  assert.equal(await unavailable.locator(".busy-state").count(), 0);
  assert.match(
    await unavailable.locator(".connection-banner").innerText(),
    /server is unavailable/,
  );
  await unavailable.unroute("**/api/**");
  await unavailable.locator(".connection-banner").click();
  await unavailable.getByRole("button", { name: /Send request/ }).waitFor();
  assert.equal(await unavailable.locator(".connection-banner").count(), 0);
  // Test stale/offline copy by interrupting a loaded state refresh (poll interval 15s).
  await unavailable.route("**/api/state", (r) => r.abort());
  await unavailable.locator(".connection-banner").waitFor({ timeout: 20000 });
  assert.match(
    await unavailable.locator(".connection-banner").innerText(),
    /out of date/,
  );
  assert.match(
    await unavailable.locator(".last-confirmed").innerText(),
    /Last connected/,
  );
  await context.setOffline(true);
  await unavailable.locator(".connection-banner").click();
  await unavailable.getByText(/You’re offline/).waitFor();
  await context.setOffline(false);
  await unavailable.unroute("**/api/state");
  await unavailable.locator(".connection-banner").click();
  await unavailable
    .locator(".connection-banner")
    .waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${results.length} material/a11y states; both themes, 85/165%, blur/translucent/opaque, OS preferences, initial outage, retry, stale timestamp and offline recovery.`,
  );
} finally {
  writeFileSync(
    "test-results/modern-design/material-checks.json",
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  await new Promise((r) => server.close(r));
  store.db.close();
}
