import { chooseLanguage } from "./preferences-checks.mjs";
import {
  enrollAdministrator,
  forwardRequest,
} from "../server/village-approval.mjs";
import { openMemberHelp } from "./preferences-checks.mjs";
import { checkBilingualSorting } from "./bilingual-sort-checks.mjs";
import assert from "node:assert/strict";
import { launchBrowser } from "./browser.mjs";
import { createApp } from "../server/app.mjs";
import { assertFits, setTextSize } from "./text-size-checks.mjs";

const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "LanguageTest@2026",
  gateCode: "5831",
  development: true,
});
enrollAdministrator(store, {
  village: "થોરાળા",
  name: "Thorala Village Administrator",
  phone: "7990000010",
  pass: "Village@2026!",
  reason: "Seeded for the language flow",
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = "http://127.0.0.1:" + server.address().port;
const browser = await launchBrowser();
const errors = [];
async function selectedLanguage(page, lang, name) {
  assert.equal(await page.locator(".app").getAttribute("data-lang"), lang);
  assert.equal(await page.locator("html").getAttribute("lang"), lang);
  // One language at a time: the selected script is visible, the alternate is not.
  assert(
    (await page.locator(`.bi > .${lang}:visible`).count()) > 0,
    name + " visible " + lang,
  );
  assert.equal(
    await page.locator(`.bi > .${lang === "gu" ? "en" : "gu"}:visible`).count(),
    0,
    name + " hides the alternate script",
  );
  assert.equal(
    (await page.locator("body").innerText()).includes("�"),
    false,
    name + " encoding",
  );
  await assertFits(page, name);
}
async function switchTo(page, lang) {
  if ((await page.locator(".app").getAttribute("data-lang")) !== lang)
    await page.getByTestId("Language").click();
}

// The directory opens on the all-members list; switch to village tiles.
async function showVillageTiles(page) {
  await page
    .getByRole("button", { name: /^Villages$|^ગામો$/ })
    .click();
  await page.locator(".village-tile").first().waitFor();
}

try {
  const member = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const page = await member.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByTestId("Language").waitFor();
  await selectedLanguage(page, "gu", "fresh signup");
  await page.getByTestId("Reading settings").click();
  await setTextSize(page, 165);
  await page.getByRole("button", { name: /બંધ કરો/ }).click();
  assert.equal(
    await page
      .locator(".app")
      .evaluate((el) => el.style.getPropertyValue("--fs")),
    "1.65",
  );
  await page.getByTestId("Reading settings").click();
  await chooseLanguage(page, "en");
  await setTextSize(page, 100);
  await page.getByRole("button", { name: /Close|બંધ કરો/ }).click();
  await selectedLanguage(page, "en", "English signup");
  const villageSelect = page.getByRole("combobox", { name: /Village|ગામ/ });
  assert.equal(
    await villageSelect.locator("option").count(),
    8,
    "Seven fixed villages plus prompt",
  );
  await villageSelect.selectOption("થોરાળા");
  assert.equal(await villageSelect.inputValue(), "થોરાળા");
  await page.reload();
  await page.getByTestId("Language").waitFor();
  await selectedLanguage(page, "en", "persisted language");
  await openMemberHelp(page);
  await page.getByText(/Access codes are no longer used/).waitFor();
  await page.getByRole("button", { name: /Understood/ }).click();
  await switchTo(page, "gu");
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).fill("Test");
  await page.getByPlaceholder(/ચૌધરી|Chaudhary/).fill("Member");
  await page.locator('input[inputmode="numeric"]').first().fill("9000000001");
  await page
    .getByRole("combobox", { name: /Village|ગામ/ })
    .selectOption("થોરાળા");
  await page.getByRole("button", { name: /રિક્વેસ્ટ મોકલો/ }).click();
  await page.getByRole("dialog").waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /આર્કાઇવ/);
  await page.getByRole("button", { name: /વિનંતી મોકલો/ }).click();
  await page.getByText("એડમિનની મંજૂરીની રાહમાં", { exact: true }).waitFor();
  forwardRequest(
    store,
    store.all("requests").find((r) => r.kind === "new").id,
    "Verified community member",
  );
  await selectedLanguage(page, "gu", "pending Gujarati");
  await switchTo(page, "en");
  await selectedLanguage(page, "en", "pending English");
  assert.match(await page.locator("body").innerText(), /You can close the app/);
  const adminContext = await browser.newContext({
    viewport: { width: 1024, height: 900 },
  });
  const panel = await adminContext.newPage();
  panel.on("pageerror", (e) => errors.push(e.message));
  await panel.goto(url);
  await panel.getByTestId("Language").waitFor();
  for (let i = 0; i < 5; i++)
    await panel.getByTestId("Brand logo").click();
  await switchTo(panel, "en");
  await selectedLanguage(panel, "en", "gate English");
  for (const digit of "5831")
    await panel.getByRole("button", { name: digit, exact: true }).click();
  await selectedLanguage(panel, "en", "login English");
  await switchTo(panel, "gu");
  await panel.getByRole("heading", { name: /એડમિન પેનલ|ADMIN PANEL/ }).waitFor();
  assert.equal(
    (await panel.locator("body").innerText()).includes("ફક્ત અધિકૃત પ્રવેશ"),
    true,
    "Gujarati-only admin notice",
  );
  assert.equal(
    (await panel.locator("body").innerText()).includes("Restricted access"),
    false,
    "English stays hidden in Gujarati mode",
  );
  await switchTo(panel, "en");
  await panel.getByPlaceholder("admin", { exact: true }).fill("admin");
  await panel.locator("input[type=password]").fill("LanguageTest@2026");
  await panel.getByRole("button", { name: /^Sign in$|^લોગિન કરો$/ }).click();
  await panel.getByText("Requests", { exact: true }).first().waitFor();
  // First sign-in shows the one-time recovery-code notice; dismiss it.
  await panel
    .getByRole("button", { name: /^Saved it$|^સાચવી લીધો$/ })
    .click();
  assert(
    (await panel.locator(".app").boundingBox()).width > 800,
    "Admin expands on desktop",
  );
  await panel.getByText("Requests", { exact: true }).click();
  await panel.getByRole("button", { name: /Approve|મંજૂર/ }).click();
  await panel.getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ }).click();
  for (const section of [
    "Total members",
    "Requests",
    "Reports",
    "Archive",
    "Security alerts",
    "Backup & export",
  ]) {
    await panel.getByText(section, { exact: true }).click();
    await selectedLanguage(panel, "en", section + " English");
    await switchTo(panel, "gu");
    await selectedLanguage(panel, "gu", section + " Gujarati");
    await switchTo(panel, "en");
    await panel.getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ }).click();
  }
  // The all-members list behind the first Total-members stats tile also
  // follows one language at a time.
  await panel.getByText("Total members", { exact: true }).click();
  await panel.locator(".stats-village-grid .mvpmi-tile").first().click();
  await selectedLanguage(panel, "en", "all-members list English");
  await switchTo(panel, "gu");
  await selectedLanguage(panel, "gu", "all-members list Gujarati");
  await switchTo(panel, "en");
  await panel
    .getByRole("button", { name: /Back to village list|ગામની યાદી પર પાછા/ })
    .click();
  await panel
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await page.reload();
  await page.getByTestId("My profile").waitFor();
  await selectedLanguage(page, "en", "directory English");
  await showVillageTiles(page);
  const before = await page.locator(".village-tile").allTextContents();
  await page.getByRole("button", { name: /Reorder villages|ગામનો ક્રમ બદલો/ }).click();
  await page
    .getByRole("button", { name: /Move later|પછી ખસેડો/ })
    .first()
    .click();
  const after = await page.locator(".village-tile").allTextContents();
  assert.equal(after[1], before[0]);
  await page.getByRole("button", { name: /Done|પૂર્ણ/ }).click();
  await page.reload();
  await page.getByTestId("My profile").waitFor();
  await showVillageTiles(page);
  assert.equal(
    (await page.locator(".village-tile").allTextContents())[1],
    before[0],
  );
  await page.getByPlaceholder("Search name or number").fill("Te");
  await page.getByTestId("Call").waitFor();
  assert.equal(
    await page.getByTestId("Call").count(),
    1,
    "Two-letter name search works",
  );
  await page.getByTestId("My profile").click();
  await selectedLanguage(page, "en", "profile English");
  await page.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).click();
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).first().fill("Changed");
  await page
    .locator('input[inputmode="numeric"]')
    .nth(1)
    .fill("8000000002");
  await page.getByRole("button", { name: /Send for approval/ }).click();
  await page.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).waitFor();
  await panel.reload();
  await panel.getByText("Requests", { exact: true }).click();
  await selectedLanguage(panel, "en", "populated update comparison");
  assert.equal(
    (await panel.locator("body").innerText()).includes("phone2:"),
    false,
  );
  await switchTo(panel, "gu");
  await selectedLanguage(panel, "gu", "Gujarati update comparison");
  await switchTo(panel, "en");
  await panel.getByRole("button", { name: /Reject|નામંજૂર/ }).click();
  await panel.getByRole("button", { name: /Reject request/ }).click();
  await panel.getByRole("dialog").waitFor({ state: "detached" });
  await setTextSize(page, 165);
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    const number = page.getByText("90000 00001", { exact: true });
    assert.equal(
      await number.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
    );
    await selectedLanguage(page, "en", "large profile " + width);
  }
  await switchTo(page, "gu");
  await selectedLanguage(page, "gu", "profile Gujarati");
  await page.screenshot({ path: "test-results/gujarati-profile.png" });
  // Access-code recovery was explicitly retired; the staged rejoin suite replaces it.
  await checkBilingualSorting(browser, store, url);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Gujarati default, single-language display per selection, early reading settings, persistence, consent, pending guidance, admin sections in both languages, desktop width, keyboard-accessible reordering, two-letter search and unbroken large phone numbers.",
  );
} finally {
  await browser.close();
  server.close();
  store.db.close();
}
