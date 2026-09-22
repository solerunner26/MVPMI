import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createApp } from "../server/app.mjs";
import { launchBrowser } from "./browser.mjs";
import { chooseLanguage, chooseTheme } from "./preferences-checks.mjs";
import { assertFits, setTextSize } from "./text-size-checks.mjs";
import { verifyOpaqueModalContrast } from "./modal-contrast-checks.mjs";

const { app, store } = createApp({
  dbPath: ":memory:",
  development: true,
  adminPassword: "WorkflowTest@2026!",
  gateCode: "5831",
});
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const url = "http://localhost:" + server.address().port;
const browser = await launchBrowser();
const errors = [];
const scans = [];
mkdirSync("test-results/village-workflow", { recursive: true });

async function newPage(width = 360) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByTestId("Language").waitFor();
  // The suite drives English UI; single-language display is covered by the
  // language suite, so panel labels are asserted in English only.
  await chooseLanguage(page, "en");
  return page;
}
async function register(page, name, phone, location = "", village = "થોરાળા") {
  const [first, ...rest] = name.split(" ");
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).fill(first);
  await page.getByPlaceholder(/ચૌધરી|Chaudhary/).fill(rest.pop() || first);
  await page.locator('input[inputmode="numeric"]').first().fill(phone);
  if (location) await page.getByTestId("Current location").fill(location);
  await page
    .getByRole("combobox", { name: /Village|ગામ/ })
    .selectOption(village);
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).click();
  await page.getByRole("button", { name: /Submit request|વિનંતી મોકલો/ }).click();
  await page.getByRole("button", { name: /Withdraw|કેન્સલ કરો/ }).waitFor();
}
async function optionState(page, value) {
  await page.waitForFunction(
    (value) =>
      !![...(document.querySelector("select")?.options || [])].find(
        (o) => o.value === value,
      ),
    value,
    { timeout: 15000 },
  );
  return page.evaluate(
    (value) =>
      [...(document.querySelector("select")?.options || [])].find(
        (o) => o.value === value,
      )?.disabled,
    value,
  );
}
async function scan(page, name) {
  await page
    .locator(".preferences-panel")
    .evaluateAll((es) => es.forEach((e) => (e.scrollTop = 0)));
  await assertFits(page, name);
  const result = await new AxeBuilder({ page: page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    name,
  );
  if (result.incomplete.length)
    writeFileSync(
      "test-results/village-workflow/incomplete.json",
      JSON.stringify({ name, incomplete: result.incomplete }, null, 2),
    );
  const verified = await verifyOpaqueModalContrast(
    page,
    result.incomplete,
    name,
  );
  scans.push({
    name,
    violations: result.violations,
    incomplete: result.incomplete,
    verified,
  });
  await page.screenshot({
    path: "test-results/village-workflow/" + name + ".png",
    fullPage: true,
  });
}
async function loginAsAdmin(page) {
  for (let i = 0; i < 5; i++)
    await page.getByTestId("Brand logo").click();
  await page.getByRole("button", { name: "5", exact: true }).first().waitFor();
  for (const n of ["5", "8", "3", "1"])
    await page.getByRole("button", { name: n, exact: true }).click();
  await page.locator("input").nth(0).fill("admin");
  await page.locator("input").nth(1).fill("WorkflowTest@2026!");
  await page.getByRole("button", { name: /^Sign in$|^લોગિન કરો$/ }).click();
  await page.getByTestId("Village management").waitFor();
}
async function loginAsVillageAdmin(page, phone, pass) {
  await page.getByTestId("Village admin sign in").click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("dialog")
    .locator('input[inputmode="numeric"]')
    .fill(phone);
  await page.getByRole("dialog").locator('input[type="password"]').fill(pass);
  await page.getByRole("dialog").getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ }).click();
  await page.getByTestId("Dashboard").waitFor();
}

try {
  const applicant = await newPage(),
    admin = await newPage(1200),
    va = await newPage();

  // 1. Before any administrator exists, joining stays closed.
  await scan(applicant, "join-closed");
  const villageSelect = applicant.getByRole("combobox", {
    name: /Village|ગામ/,
  });
  assert.equal(await villageSelect.locator("option").count(), 8);
  assert.equal(
    await optionState(applicant, "થોરાળા"),
    true,
    "Village without an administrator cannot accept applications",
  );
  assert.equal(await applicant.getByTestId("Village admin sign in").count(), 1);

  // 2. Main administrator enrolls the first village administrator directly.
  await loginAsAdmin(admin);
  await admin.getByTestId("Village management").click();
  await admin.getByRole("button", { name: /Villages & admins/ }).click();
  const card = admin
    .locator(".workflow-card")
    .filter({ has: admin.getByRole("heading", { name: /થોરાળા|Thorala/ }) });
  await card.getByLabel(/First name/).fill("Thorala");
  await card.getByLabel(/Surname/).fill("Administrator");
  await card.getByLabel(/Phone number \(used to sign in\)/).fill("7990000010");
  await card.getByLabel(/Current location/).fill("Mahuva main road");
  await card.getByLabel(/Initial password/).fill("Village@2026!");
  await card.getByRole("checkbox").check();
  await scan(admin, "enroll-first-admin");
  await card.getByRole("button", { name: /Enroll administrator/ }).click();
  await card.getByText(/Current administrator:/).waitFor();
  await scan(admin, "admin-assigned");
  await admin
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();

  // 3. Joining opens for that village; the separate administrator sign-in works.
  await applicant.reload();
  assert.equal(await optionState(applicant, "થોરાળા"), false);
  await register(
    applicant,
    "Directory Applicant",
    "9000000001",
    "Adajan, Surat",
  );
  assert.match(
    await applicant.locator("body").innerText(),
    /Waiting for your village/,
  );
  await scan(applicant, "pending-village-stage");

  await va.getByTestId("Village admin sign in").click();
  await va.getByRole("dialog").waitFor();
  await scan(va, "admin-login-sheet");
  await va
    .getByRole("dialog")
    .locator('input[inputmode="numeric"]')
    .fill("7990000010");
  await va
    .getByRole("dialog")
    .locator('input[type="password"]')
    .fill("Wrong@2026");
  await va.getByRole("dialog").getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ }).click();
  await va.getByRole("alert").waitFor();
  await va
    .getByRole("dialog")
    .locator('input[type="password"]')
    .fill("Village@2026!");
  await va.getByRole("dialog").getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ }).click();
  await va.getByTestId("Dashboard").waitFor();

  // The hidden sun-tap gate stays sealed for village administrators.
  for (let i = 0; i < 5; i++)
    await va.getByTestId("Brand logo").click();
  assert.equal(
    await va.getByRole("button", { name: "5", exact: true }).count(),
    0,
    "Sun-tap gate must not open for village administrators",
  );

  // 4. Village verification and forwarding.
  await va.getByTestId("Dashboard").click();
  let request = va
    .locator(".workflow-card")
    .filter({ hasText: "Directory Applicant" });
  await request.getByRole("checkbox").check();
  await scan(va, "village-verification");
  await request.getByRole("button", { name: /Verify & forward/ }).click();
  await request.waitFor({ state: "detached" });
  await va
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();

  await applicant.reload();
  await applicant.getByRole("button", { name: /Withdraw|કેન્સલ કરો/ }).waitFor();
  assert.match(await applicant.locator("body").innerText(), /Village verified/);
  await scan(applicant, "pending-main-stage");

  // 5. Final approval by the main administrator.
  await admin.getByTestId("Village management").click();
  request = admin
    .locator(".workflow-card")
    .filter({ hasText: "Directory Applicant" });
  await request.getByRole("checkbox").check();
  await scan(admin, "main-final-review");
  await request.getByRole("button", { name: /Final approval/ }).click();
  await request.waitFor({ state: "detached" });
  await admin
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();

  await applicant.reload();
  await applicant.getByTestId("My profile").waitFor();
  await applicant.getByRole("button", { name: /All Members|બધા સભ્યો/ }).click();
  await applicant.getByText("હાલ : Adajan, Surat").waitFor();
  await scan(applicant, "approved-location");

  // 6. Village administrator proposes a member change; only the main
  //    administrator can decide it.
  await va.getByTestId("Dashboard").click();
  await va.getByRole("button", { name: /My village members/ }).click();
  const memberCard = va
    .locator(".workflow-card")
    .filter({ hasText: "Directory Applicant" });
  await memberCard.getByRole("button", { name: /Propose change/ }).click();
  await memberCard.getByTestId("Current location").fill("Ring Road, Surat");
  await memberCard.getByLabel(/Proposal reason/).fill("Member moved house");
  await scan(va, "village-member-proposal");
  await memberCard
    .getByRole("button", { name: /Send to main administrator/ })
    .click();
  // v0.3.2: a clear confirmation appears and the form closes.
  await memberCard.getByText(/Forwarded to the main administrator/).waitFor();
  assert.equal(
    await memberCard.getByRole("button", {
      name: /Send to main administrator/,
    }).count(),
    0,
    "Proposal form closes after forwarding",
  );
  await va
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  // The dashboard badge counts the proposal now waiting with the main
  // administrator even though the village administrator cannot act on it.
  assert.equal(
    await va.locator(".dash-badge").innerText(),
    "1",
    "Badge counts forwarded proposals",
  );

  await admin.reload();
  await admin.getByTestId("Village management").waitFor();
  await admin.getByText("Requests", { exact: true }).click();
  await admin.getByRole("button", { name: /Authorize|મંજૂર/ }).click();
  await admin.getByText("Requests", { exact: true }).waitFor();
  await applicant.reload();
  await applicant.getByTestId("My profile").click();
  await applicant.getByText("Ring Road, Surat").first().waitFor();

  // 7. Rejection with a reason stays visible to the main administrator only.
  const rejected = await newPage();
  await register(rejected, "Unknown Applicant", "9000000002");
  await va.reload();
  await va.getByTestId("Dashboard").waitFor();
  await va.getByTestId("Dashboard").click();
  let rejectCard = va
    .locator(".workflow-card")
    .filter({ hasText: "Unknown Applicant" });
  await rejectCard.getByRole("button", { name: /Reject|નામંજૂર/ }).click();
  await rejectCard.waitFor({ state: "detached" });
  await rejected.reload();
  await rejected
    .getByText(/Previous application was closed|પાછલી વિનંતી બંધ/)
    .waitFor();
  await scan(rejected, "rejected-feedback");

  // 7b. The rejected number applies again: the village administrator must
  //     see the "rejected before" warning on the review card.
  const repeat = await newPage();
  await register(repeat, "Repeat Applicant", "9000000002");
  await va.reload();
  await va.getByTestId("Dashboard").waitFor();
  await va.getByTestId("Dashboard").click();
  const repeatCard = va
    .locator(".workflow-card")
    .filter({ hasText: "Repeat Applicant" });
  await repeatCard.waitFor();
  await scan(va, "rejected-before-warning");
  assert.match(
    await repeatCard.innerText(),
    /rejected before/,
    "Re-application from a rejected number is flagged",
  );
  await repeatCard.getByRole("button", { name: /Reject|નામંજૂર/ }).click();
  await repeatCard.waitFor({ state: "detached" });
  await va
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await repeat.close();
  await admin
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await admin.reload();
  await admin.getByTestId("Village management").click();
  await admin
    .getByRole("button", { name: /Rejected \/ closed requests/ })
    .click();
  await admin.getByText("9000000002", { exact: true }).waitFor();
  await scan(admin, "rejection-ledger");

  // 8. Village administrator proposes removal; main administrator decides.
  await va.reload();
  await va.getByTestId("Dashboard").waitFor();
  await va.getByTestId("Dashboard").click();
  await va.getByRole("button", { name: /My village members/ }).click();
  const removalCard = va
    .locator(".workflow-card")
    .filter({ hasText: "Directory Applicant" });
  await removalCard.getByRole("button", { name: /Propose removal/ }).click();
  await removalCard.getByLabel(/Removal reason/).fill("Left the community");
  await removalCard
    .getByRole("button", { name: /Send removal proposal/ })
    .click();
  await removalCard.getByText(/Forwarded to the main administrator/).waitFor();
  assert.equal(
    await removalCard.getByRole("button", {
      name: /Send removal proposal/,
    }).count(),
    0,
    "Removal form closes after forwarding",
  );
  await va
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await admin
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await admin.reload();
  await admin.getByText("Requests", { exact: true }).click();
  await admin.getByRole("button", { name: /Remove|કાઢી નાખો/ }).click();
  await admin.getByRole("button", { name: /Remove from directory/ }).click();
  await admin.getByText("No removal requests.", { exact: true }).waitFor();
  await applicant.reload();
  await applicant.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).waitFor();

  // 9. New villages appear immediately but stay closed until an administrator
  //    is enrolled.
  await admin.getByTestId("Village management").click();
  await admin.getByRole("button", { name: /Villages & admins/ }).click();
  const add = admin.locator("form.workflow-card");
  await add.getByLabel(/Gujarati name/).fill("નવું ગામ");
  await add.getByLabel(/English name/).fill("New Village");
  await add.getByRole("button", { name: /Add village/ }).click();
  await admin.getByRole("heading", { name: /New Village/ }).waitFor();
  await scan(admin, "manage-villages");
  await rejected.reload();
  await rejected.getByRole("combobox", { name: /Village|ગામ/ }).waitFor();
  assert.equal(await rejected.locator("select option").count(), 9);
  assert.equal(
    await optionState(rejected, "નવું ગામ"),
    true,
    "A new village without an administrator stays closed",
  );

  // 10. Administrator account: password change and sign-out.
  await va.getByTestId("Dashboard").click();
  await va.getByRole("button", { name: /Account/ }).click();
  await va.getByLabel(/Current password/).fill("Village@2026!");
  await va.getByLabel(/New password/).fill("Newer@2026!");
  await scan(va, "village-account");
  await va.getByRole("button", { name: /Change password/ }).click();
  await va
    .getByRole("button", { name: /Sign out village administrator/ })
    .click();
  await va.getByTestId("Village admin sign in").waitFor();
  // The new password is required; the old one no longer works.
  await va.getByTestId("Village admin sign in").click();
  await va.getByRole("dialog").waitFor();
  await va
    .getByRole("dialog")
    .locator('input[inputmode="numeric"]')
    .fill("7990000010");
  await va
    .getByRole("dialog")
    .locator('input[type="password"]')
    .fill("Village@2026!");
  await va.getByRole("dialog").getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ }).click();
  await va.getByRole("alert").waitFor();
  await va
    .getByRole("dialog")
    .locator('input[type="password"]')
    .fill("Newer@2026!");
  await va.getByRole("dialog").getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ }).click();
  await va.getByTestId("Dashboard").waitFor();

  // 11. Large-text English dark management view remains usable.
  await admin
    .getByRole("button", { name: /Back to dashboard|ડેશબોર્ડ પર પાછા/ })
    .click();
  await admin.getByTestId("Reading settings").click();
  await setTextSize(admin, 165);
  await admin.getByRole("button", { name: /Close|બંધ કરો/ }).click();
  await chooseLanguage(admin, "en");
  await chooseTheme(admin, "dark");
  await admin.getByTestId("Village management").click();
  await admin.getByRole("button", { name: /Villages & admins/ }).click();
  await scan(admin, "management-en-dark-165");

  assert.deepEqual(errors, []);
  console.log(
    "PASS: admin-first enrollment, separate village-admin sign-in, sealed sun-tap gate, verification, final approval, member proposals, rejection ledger, removal and closed new villages.",
  );
} finally {
  writeFileSync(
    "test-results/village-workflow/accessibility.json",
    JSON.stringify(scans, null, 2),
  );
  await browser.close();
  server.close();
  store.db.close();
}
