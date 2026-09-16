import assert from "node:assert/strict";
import { launchBrowser } from "./browser.mjs";
import { createApp } from "../server/app.mjs";
import { assertFits } from "./text-size-checks.mjs";

const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "LanguageTest@2026",
  gateCode: "5831",
  development: true,
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = "http://127.0.0.1:" + server.address().port;
const browser = await launchBrowser();
const errors = [];
async function selectedLanguage(page, lang, name) {
  assert.equal(await page.locator(".app").getAttribute("data-lang"), lang);
  assert.equal(await page.locator("html").getAttribute("lang"), lang);
  const hiddenClass = lang === "gu" ? "en" : "gu";
  assert.equal(
    await page.locator(`.bi > .${hiddenClass}:visible`).count(),
    0,
    name + " opposite-language labels",
  );
  assert.equal(
    (await page.locator("body").innerText()).includes("�"),
    false,
    name + " encoding",
  );
  if (lang === "en") {
    const ui = await page.locator("body").innerText();
    // The destination language is intentionally named in its own script.
    assert.equal(
      /[\u0a80-\u0aff]/.test(ui.replaceAll("ગુજરાતી", "")),
      false,
      name + " untranslated Gujarati UI",
    );
  }
  await assertFits(page, name);
}
async function switchTo(page, lang) {
  if ((await page.locator(".app").getAttribute("data-lang")) !== lang)
    await page.getByTestId("Language").click();
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
  await page.getByRole("button", { name: "સૌથી મોટું", exact: true }).click();
  await page.getByRole("button", { name: "બંધ કરો", exact: true }).click();
  assert.equal(
    await page
      .locator(".app")
      .evaluate((el) => el.style.getPropertyValue("--fs")),
    "1.60",
  );
  await page.getByTestId("Reading settings").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page.getByRole("button", { name: "Default", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await selectedLanguage(page, "en", "English signup");
  await page.reload();
  await page.getByTestId("Language").waitFor();
  await selectedLanguage(page, "en", "persisted language");
  await page.getByTestId("Member help").click();
  await page.getByText(/Automatic recovery/).waitFor();
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  await switchTo(page, "gu");
  await page.locator("input").nth(0).fill("Test Member");
  await page.locator("input").nth(1).fill("9000000001");
  await page.locator("input").nth(2).fill("Thorala");
  await page
    .getByRole("button", { name: "રિક્વેસ્ટ મોકલો", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /આર્કાઇવ/);
  await page.getByRole("button", { name: "વિનંતી મોકલો", exact: true }).click();
  await page.getByText("એડમિનની મંજૂરીની રાહમાં", { exact: true }).waitFor();
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
    await panel.getByTitle("MVPMl", { exact: true }).click();
  await switchTo(panel, "en");
  await selectedLanguage(panel, "en", "gate English");
  for (const digit of "5831")
    await panel.getByRole("button", { name: digit, exact: true }).click();
  await selectedLanguage(panel, "en", "login English");
  await panel.getByPlaceholder("admin", { exact: true }).fill("admin");
  await panel.locator("input[type=password]").fill("LanguageTest@2026");
  await panel.getByRole("button", { name: "Sign in", exact: true }).click();
  await panel.getByText("New requests", { exact: true }).waitFor();
  assert(
    (await panel.locator(".app").boundingBox()).width > 800,
    "Admin expands on desktop",
  );
  await panel.getByText("New requests", { exact: true }).click();
  await panel.getByRole("button", { name: "Approve", exact: true }).click();
  await panel
    .getByRole("button", { name: "Back to dashboard", exact: true })
    .click();
  for (const section of [
    "Total members",
    "New requests",
    "Update requests",
    "Delete requests",
    "Members",
    "Archive",
    "Security alerts",
    "Backup & export",
  ]) {
    await panel.getByText(section, { exact: true }).click();
    await selectedLanguage(panel, "en", section + " English");
    await switchTo(panel, "gu");
    await selectedLanguage(panel, "gu", section + " Gujarati");
    await switchTo(panel, "en");
    await panel
      .getByRole("button", { name: "Back to dashboard", exact: true })
      .click();
  }
  await page.reload();
  await page.getByTestId("My profile").waitFor();
  await selectedLanguage(page, "en", "directory English");
  const before = await page.locator(".village-tile").allTextContents();
  await page
    .getByRole("button", { name: "Reorder villages", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Move later/ })
    .first()
    .click();
  const after = await page.locator(".village-tile").allTextContents();
  assert.equal(after[1], before[0]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await page.getByTestId("My profile").waitFor();
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
  await page
    .getByRole("button", { name: "Edit my details", exact: true })
    .click();
  await page.locator("input").nth(0).fill("Changed Test Member");
  await page.locator("input").nth(2).fill("8000000002");
  await page
    .getByRole("button", { name: "Send for approval", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit my details", exact: true })
    .waitFor();
  await panel.reload();
  await panel.getByText("Update requests", { exact: true }).click();
  await selectedLanguage(panel, "en", "populated update comparison");
  assert.equal(
    (await panel.locator("body").innerText()).includes("phone2:"),
    false,
  );
  await switchTo(panel, "gu");
  await selectedLanguage(panel, "gu", "Gujarati update comparison");
  await switchTo(panel, "en");
  await panel.getByRole("button", { name: "Reject", exact: true }).click();
  await panel
    .getByRole("button", { name: "Reject request", exact: true })
    .click();
  await panel.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Biggest", exact: true }).click();
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
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Gujarati default, single-language screens, early reading settings, persistence, consent, pending guidance, both-language admin sections, desktop width, keyboard-accessible reordering, two-letter search and unbroken large phone numbers.",
  );
} finally {
  await browser.close();
  server.close();
  store.db.close();
}
