import { forwardRequest } from "../server/village-approval.mjs";
import {
  checkModernPreferences,
  checkModernDirectory,
} from "./modern-design-checks.mjs";
import { toggleTheme } from "./preferences-checks.mjs";
import { useEnglishForLegacyFlows } from "./test-language.mjs";
import { checkTextSizes, setTextSize } from "./text-size-checks.mjs";
import { checkContactActions } from "./contact-checks.mjs";
import { chromium } from "playwright";
import chrome from "@sparticuz/chromium";
import { brotliDecompressSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createApp } from "../server/app.mjs";
import assert from "node:assert/strict";
// The npm-distributed browser provides a fallback when Playwright's CDN is unavailable.
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
import { enrollAdministrator } from "../server/village-approval.mjs";
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
  executablePath: await chrome.executablePath(),
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
  env: { ...process.env, LD_LIBRARY_PATH: libs + "/lib" },
  headless: true,
});
useEnglishForLegacyFlows(browser);
const errors = [];
try {
  const context = await browser.newContext({
      viewport: { width: 412, height: 892 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).waitFor();
  await checkModernPreferences(page);
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).fill("Test");
  await page.getByPlaceholder(/ચૌધરી|Chaudhary/).fill("Community Member");
  await page.locator('input[inputmode="numeric"]').first().fill("9000000001");
  await page
    .getByRole("combobox", { name: /Village|ગામ/ })
    .selectOption("થોરાળા");
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).click();
  await page.getByRole("button", { name: /Submit request|વિનંતી મોકલો/ }).click();
  await page.getByRole("button", { name: /Withdraw|કેન્સલ કરો/ }).waitFor();
  forwardRequest(
    store,
    store.all("requests").find((r) => r.kind === "new").id,
    "Verified community member",
  );
  await page.reload();
  await page.getByRole("button", { name: /Withdraw|કેન્સલ કરો/ }).waitFor();
  assert(
    (await page.locator("body").innerText()).includes("Test Community Member"),
  );
  await page.screenshot({ path: "test-results/pending.png" });
  // Independent admin cookie jar, same browser origin.
  const admin = await browser.newContext({
      viewport: { width: 412, height: 892 },
    }),
    panel = await admin.newPage();
  panel.on("pageerror", (e) => errors.push(e.message));
  await panel.goto(url);
  await panel.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).waitFor();
  // Enter through the real hidden logo gesture, not a prototype screen shortcut.
  for (let i = 0; i < 5; i++)
    await panel.getByTestId("Brand logo").click({ force: true });
  await panel.getByRole("button", { name: "5", exact: true }).first().waitFor();
  for (const digit of "5831")
    await panel.getByRole("button", { name: digit, exact: true }).click();
  await panel.getByPlaceholder("admin", { exact: true }).fill("admin");
  await panel.locator("input[type=password]").fill("TestPreview@2026");
  await panel.getByRole("button", { name: /^Sign in$|^લોગિન કરો$/ }).click();
  await panel.getByText("Requests", { exact: true }).click();
  await panel.getByRole("button", { name: /Approve|મંજૂર/ }).click();
  await panel
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await page.reload();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).click();
  await page.getByTestId("Call").first().waitFor();
  await page.screenshot({ path: "test-results/directory.png" });
  await checkModernDirectory(page);
  await checkContactActions(browser, context, url);
  await checkTextSizes(context, url);
  await page.getByPlaceholder("Search name or number").fill("Test Community");
  assert.equal(await page.getByTestId("Call").count(), 1);
  await page.reload();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  await page.getByTestId("My profile").click();
  await page.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).click();
  await page.getByRole("button", { name: /Send for approval/ }).waitFor();
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).first().fill("Updated");
  await page.getByRole("button", { name: /Send for approval/ }).click();
  await page.getByText("My profile", { exact: true }).waitFor();
  const stateBefore = await page.evaluate(() =>
    fetch("/api/state").then((r) => r.json()),
  );
  assert.equal(
    stateBefore.members.find((m) => m.phone === "9000000001").name,
    "Test Community Member",
  );
  assert.equal(stateBefore.updateRequests.length, 1);
  await panel.reload();
  await panel.getByText("Requests", { exact: true }).click();
  await panel.getByRole("button", { name: /Authorize|મંજૂર/ }).click();
  await page.reload();
  await page.getByTestId("My profile").click();
  assert(
    (await page.locator("body").innerText()).includes("Updated Community Member"),
  );
  if ((await page.locator(".app").getAttribute("data-lang")) !== "en")
    await page.getByTestId("Language").click();
  if ((await page.locator(".app").getAttribute("data-theme")) !== "dark")
    await toggleTheme(page);
  await setTextSize(page, 140);
  await page.reload();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  assert.equal(await page.locator(".app").getAttribute("data-lang"), "en");
  assert.equal(await page.locator(".app").getAttribute("data-theme"), "dark");
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => el.scrollWidth > window.innerWidth),
    false,
  );
  await panel.reload();
  await panel.getByText("Members", { exact: true }).click();
  // Several members exist; edit the enrolled test member specifically.
  await panel
    .locator("div", { hasText: "Updated Community Member" })
    .filter({ has: panel.getByTestId("Edit") })
    .getByTestId("Edit")
    .first()
    .click();
  await panel.getByRole("button", { name: /Save changes/ }).waitFor();
  const hostileName = '<img src=x onerror="window.__attack=1">';
  await panel.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).first().fill(hostileName);
  await panel.getByRole("button", { name: /Save changes/ }).click();
  await panel.getByTestId("Edit").first().waitFor();
  await page.reload();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).click();
  await page.getByTestId("Call").first().waitFor();
  assert((await page.locator("body").innerText()).includes(hostileName));
  assert.equal(await page.evaluate(() => window.__attack), undefined);
  assert.equal(
    store.all("requests").length,
    0,
    "Admin edit must not create an approval request",
  );
  for (const width of [320, 360, 412, 800]) {
    await page.setViewportSize({ width, height: 800 });
    assert.equal(
      await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: rendered modern design, submitted request, retained pending after reload, hidden admin login, approved in separate session, directory search, no browser errors or horizontal overflow.",
  );
} finally {
  await browser.close();
  server.close();
  store.db.close();
}
