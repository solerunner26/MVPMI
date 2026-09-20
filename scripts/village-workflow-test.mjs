import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createApp } from "../server/app.mjs";
import { launchBrowser } from "./browser.mjs";
import {
  appointFirstRepresentative,
  chooseLanguage,
  chooseTheme,
} from "./preferences-checks.mjs";
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
const browser = await launchBrowser(),
  errors = [],
  scans = [];
mkdirSync("test-results/village-workflow", { recursive: true });
async function newPage() {
  const c = await browser.newContext({
    viewport: { width: 360, height: 800 },
    reducedMotion: "reduce",
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.getByTestId("Language").waitFor();
  return p;
}
async function register(p, name, phone, location = "") {
  await p.locator("input").nth(0).fill(name);
  await p.locator("input").nth(1).fill(phone);
  await p.getByTestId("Current location").fill(location);
  await p.getByRole("combobox", { name: /Village|ગામ/ }).selectOption("થોરાળા");
  await p.getByRole("button", { name: /Send request/ }).click();
  await p.getByRole("button", { name: /Submit request/ }).click();
  await p.getByRole("button", { name: /Withdraw/ }).waitFor();
}
async function scan(p, name) {
  await p
    .locator(".preferences-panel")
    .evaluateAll((es) => es.forEach((e) => (e.scrollTop = 0)));
  await assertFits(p, name);
  const result = await new AxeBuilder({ page: p })
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
  const verified = await verifyOpaqueModalContrast(p, result.incomplete, name);
  scans.push({
    name,
    violations: result.violations,
    incomplete: result.incomplete,
    verified,
  });
  await p.screenshot({
    path: "test-results/village-workflow/" + name + ".png",
  });
}
try {
  const local = await newPage(),
    member = await newPage(),
    admin = await newPage();
  await scan(member, "join-gu");
  assert.equal(await member.locator("select option").count(), 8);
  await member.getByTestId("Reading settings").click();
  assert.equal(
    await member.locator(".language-options,.theme-options").count(),
    0,
  );
  await member.getByRole("button", { name: /Close/ }).click();
  await chooseTheme(member, "dark");
  await scan(member, "join-dark");
  await chooseTheme(member, "light");
  await register(local, "Village Representative", "7999999991");
  for (let i = 0; i < 5; i++)
    await admin.getByTitle("MVPMl", { exact: true }).click();
  for (const n of ["5", "8", "3", "1"])
    await admin.getByRole("button", { name: n, exact: true }).click();
  await admin.locator("input").nth(0).fill("admin");
  await admin.locator("input").nth(1).fill("WorkflowTest@2026!");
  await admin.getByRole("button", { name: /Sign in/ }).click();
  await admin.getByTestId("Village management").waitFor();
  await appointFirstRepresentative(admin, store.all("requests")[0].id);
  await local.reload();
  await local.getByTestId("Village management").waitFor();
  await register(member, "Directory Applicant", "9000000001", "Adajan, Surat");
  assert.match(
    await member.locator("body").innerText(),
    /Waiting for your village/,
  );
  await admin.getByTestId("Village management").click();
  await admin.getByRole("button", { name: /Final approval/ }).waitFor();
  assert.equal(
    await admin.getByRole("button", { name: /Final approval/ }).isDisabled(),
    true,
  );
  await scan(admin, "main-awaiting-village");
  await admin.getByRole("button", { name: /Back to dashboard/ }).click();
  await local.getByTestId("Village management").click();
  let card = local
    .locator(".workflow-card")
    .filter({ hasText: "Directory Applicant" });
  await card
    .getByLabel(/Verification \/ decision reason/)
    .fill("Known personally; verified in person");
  await card.getByRole("checkbox").check();
  await scan(local, "local-verification");
  await card.getByRole("button", { name: /Verify & forward/ }).click();
  await card.waitFor({ state: "detached" });
  await local.getByRole("button", { name: /Back to dashboard/ }).click();
  await member.reload();
  await member.getByRole("button", { name: /Withdraw/ }).waitFor();
  assert.match(await member.locator("body").innerText(), /Village verified/);
  await admin.reload();
  await admin.getByTestId("Village management").click();
  card = admin
    .locator(".workflow-card")
    .filter({ hasText: "Directory Applicant" });
  await card
    .getByLabel(/Verification \/ decision reason/)
    .fill("Village verification reviewed");
  await card.getByRole("checkbox").check();
  await scan(admin, "main-final-review");
  await card.getByRole("button", { name: /Final approval/ }).click();
  await card.waitFor({ state: "detached" });
  await member.reload();
  await member.getByTestId("My profile").waitFor();
  await member.getByRole("button", { name: /All Members/ }).click();
  await member.getByText("હાલ : Adajan, Surat").waitFor();
  await scan(member, "approved-location");
  const rejected = await newPage();
  await register(rejected, "Unknown Applicant", "9000000002");
  await local.reload();
  await local.getByTestId("Village management").click();
  card = local
    .locator(".workflow-card")
    .filter({ hasText: "Unknown Applicant" });
  await card
    .getByLabel(/Verification \/ decision reason/)
    .fill("Not recognised after identity review");
  await card.getByLabel(/Rejection category/).selectOption("not-community");
  await card.getByRole("button", { name: /Reject/ }).click();
  await card.waitFor({ state: "detached" });
  await rejected.reload();
  await rejected.getByText("Not recognised after identity review").waitFor();
  await scan(rejected, "rejected-feedback");
  await admin.getByRole("button", { name: /Back to dashboard/ }).click();
  await admin.reload();
  await admin.getByTestId("Village management").click();
  await admin
    .getByRole("button", { name: /Rejected \/ closed requests/ })
    .click();
  await admin.getByText("9000000002", { exact: true }).waitFor();
  await scan(admin, "rejection-ledger");
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
  await rejected
    .getByRole("combobox", { name: /Village|ગામ/ })
    .selectOption("નવું ગામ");
  await member.getByTestId("My profile").click();
  await member.getByRole("button", { name: /Edit my details/ }).click();
  assert.equal(
    await member.getByTestId("Current location").inputValue(),
    "Adajan, Surat",
  );
  await member
    .locator('option[value="નવું ગામ"]')
    .waitFor({ state: "attached" });
  assert.equal(await member.locator("select option").count(), 9);
  await admin.getByRole("button", { name: /Back to dashboard/ }).click();
  await admin.getByTestId("Reading settings").click();
  await setTextSize(admin, 165);
  await admin.getByRole("button", { name: /Close/ }).click();
  await chooseLanguage(admin, "en");
  await chooseTheme(admin, "dark");
  await admin.getByTestId("Village management").click();
  await admin.getByRole("button", { name: /Villages & admins/ }).click();
  await scan(admin, "management-en-dark-165");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real UI enrollment, first-admin appointment, local forwarding, final approval, rejection ledger, location, dynamic villages, both themes/languages and large-text management.",
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
