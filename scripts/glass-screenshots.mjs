// Capture the Liquid Glass refinement in both themes for visual inspection.
// Emulates a typical phone profile so the full material path renders; the
// opaque fallback is exercised separately by scripts/material-test.mjs.
import { createApp } from "../server/app.mjs";
import { launchBrowser } from "./browser.mjs";
import { enrollAdministrator } from "../server/village-approval.mjs";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

const OUT = "docs/modern-design/glass-refinement";
mkdirSync(OUT, { recursive: true });

const { app, store } = createApp({
  dbPath: ":memory:",
  development: true,
  adminPassword: "Preview@2026!",
  gateCode: "5831",
});
store.tx(() => {
  for (const [gu, en] of [
    ["થોરાળા", "Thorala"],
    ["સથરા", "Sathra"],
    ["તરેડી", "Taredi"],
    ["લીલવણ", "Lilvan"],
    ["દૂધાળા નં 1", "Dudhala No 1"],
    ["તલગાજરડા", "Talgajarada"],
    ["જીંજકા", "Jinjaka"],
  ])
    store.put("villages", { id: gu, gu, en, order: 0, open: true });
  store.put("config", {
    id: "main-admin-contact",
    name: "મુખ્ય એડમિન",
    phone: "9000000000",
  });
});
enrollAdministrator(store, {
  village: "તરેડી",
  name: "Manishaben Bhimani",
  phone: "9001000003",
  pass: "Taredi@2026",
  actor: "seed",
});
const now = Date.now();
const mk = (name, nameGu, phone) => ({
  id: randomUUID(),
  owner: randomUUID(),
  name,
  nameGu,
  phone,
  phone2: "",
  label2: "work",
  village: "તરેડી",
  tehsil: "મહુવા",
  district: "ભાવનગર",
  createdAt: now,
  approvedAt: now,
  approvedBy: "seed",
  consentAt: now,
  consentVersion: "v1",
});
store.tx(() => {
  store.put("members", mk("Ashok Chaudhary", "અશોક ચૌધરી", "9003000023"));
  store.put("members", mk("Kishor Chudasama", "કિશોર ચુડાસમા", "9003000026"));
  store.put("requests", {
    id: "req-shot",
    owner: randomUUID(),
    kind: "new",
    payload: {
      firstName: "Pending",
      middleName: "",
      surname: "Patelia",
      name: "Pending Patelia",
      nameGu: "Pending Patelia",
      phone: "9002000001",
      phone2: "",
      village: "તરેડી",
      tehsil: "મહુવા",
      district: "ભાવનગર",
    },
    createdAt: now,
  });
});

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const url = "http://localhost:" + server.address().port;
const browser = await launchBrowser();

async function phoneContext(theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => 8,
    });
    const p = { theme: "light", lang: "gu" };
    localStorage.setItem("mvpmi-preferences", JSON.stringify(p));
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.getByTestId("Language").waitFor();
  const wants = { theme };
  await page.evaluate((t) => {
    localStorage.setItem(
      "mvpmi-preferences",
      JSON.stringify({ theme: t, lang: "gu" }),
    );
  }, theme);
  await page.reload();
  await page.getByTestId("Language").waitFor();
  if (theme === "dark") {
    // Ensure dark even if the seeded preference raced.
    if ((await page.locator(".app").getAttribute("data-theme")) !== "dark")
      await page.getByTestId("Theme").click();
  }
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

const shots = [];
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
}

// ---- Guest: signup + consent dialog + all-admins ----
for (const theme of ["light", "dark"]) {
  const { page } = await phoneContext(theme);
  await shot(page, `signup-${theme}`);
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).fill("જલદીપ");
  await page.getByPlaceholder(/ચૌધરી|Chaudhary/).fill("વાળા");
  await page.locator('input[inputmode="numeric"]').first().fill("9009000001");
  await page
    .getByRole("combobox", { name: /Village|ગામ/ })
    .selectOption("તરેડી");
  await page
    .getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ })
    .click();
  await page.getByRole("dialog").waitFor();
  await shot(page, `consent-${theme}`);
  await page.getByRole("button", { name: /Cancel|રહેવા દો/ }).click();
  await page.waitForTimeout(300);
  await page.getByTestId("All admins").click();
  await page.locator(".admin-row").first().waitFor();
  await shot(page, `all-admins-${theme}`);
  await page
    .getByRole("button", { name: /પાછા જાઓ|Back/ })
    .last()
    .click();
  await page.getByTestId("Reading settings").click();
  await page.locator(".preferences-panel").waitFor();
  await shot(page, `settings-${theme}`);
}

// ---- Village administrator: home, workflow ----
for (const theme of ["light", "dark"]) {
  const { page } = await phoneContext(theme);
  await page.getByTestId("Village admin sign in").click();
  await page
    .getByRole("dialog")
    .locator('input[inputmode="numeric"]')
    .fill("9001000003");
  await page
    .getByRole("dialog")
    .locator('input[type="password"]')
    .fill("Taredi@2026");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ })
    .click();
  await page.getByTestId("Dashboard").waitFor();
  await shot(page, `va-home-${theme}`);
  await page.getByTestId("Dashboard").click();
  await page.getByRole("dialog").waitFor();
  await shot(page, `va-workflow-${theme}`);
}

console.log("Captured: " + shots.join(", "));
await browser.close();
server.close();
store.db.close();
