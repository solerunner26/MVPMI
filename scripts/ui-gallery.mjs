// Screenshot gallery of every main screen in light and dark themes.
//   node scripts/ui-gallery.mjs <output-folder> [width]
// Used to compare the UI before/after a design change. Synthetic data only.
import { createApp } from "../server/app.mjs";
import { enrollAdministrator, forwardRequest } from "../server/village-approval.mjs";
import { launchBrowser } from "./browser.mjs";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { verifyGlassContrast } from "./glass-contrast-checks.mjs";
import assert from "node:assert/strict";

// GLASS_A11Y=1 additionally runs axe (WCAG 2.1 A/AA) on every screen in the
// full Liquid Glass mode and measures glass text contrast on real pixels.
const A11Y = process.env.GLASS_A11Y === "1";
let a11yScreens = 0;

const OUT = process.argv[2] || "test-results/gallery";
const WIDTH = Number(process.argv[3] || 390);
mkdirSync(OUT, { recursive: true });

function server(requireAppLock) {
  const { app, store } = createApp({
    requireAppLock,
    dbPath: ":memory:",
    development: true,
    adminPassword: "Preview@2026!",
    gateCode: "5831",
  });
  store.put("config", { id: "main-admin-contact", name: "મુખ્ય એડમિન", nameEn: "Main Administrator", phone: "9000000000" });
  enrollAdministrator(store, { village: "તરેડી", name: "Manishaben Bhimani", phone: "9001000003", pass: "Taredi@2026", actor: "seed" });
  enrollAdministrator(store, { village: "થોરાળા", name: "Rameshbhai Vala", phone: "9001000001", pass: "Thorala@2026", actor: "seed" });
  const now = Date.now();
  const people = [
    ["Ashokbhai Bhimjibhai Chaudhary", "અશોકભાઈ ભીમજીભાઈ ચૌધરી", "9825014523", "તરેડી", "Surat"],
    ["Bharatsinh Ranubha Gohil", "ભરતસિંહ રણુભા ગોહિલ", "9825014524", "થોરાળા", "Ahmedabad"],
    ["Chetnaben Dilipbhai Vala", "ચેતનાબેન દિલીપભાઈ વાળા", "9825014525", "તરેડી", ""],
    ["Dilipsinh Harisinh Parmar", "દિલીપસિંહ હરિસિંહ પરમાર", "9825014526", "સથરા", "Mumbai"],
    ["Hetalben Jayesh Solanki", "હેતલબેન જયેશ સોલંકી", "9825014527", "લીલવણ", ""],
    ["Jayrajsinh Mahipat Zala", "જયરાજસિંહ મહિપત ઝાલા", "9825014528", "જીંજકા", "Bhavnagar"],
  ];
  for (const [name, nameGu, phone, village, loc] of people) {
    const [firstName, middleName, surname] = name.split(" ");
    store.put("members", {
      id: randomUUID(), owner: randomUUID(), firstName, middleName, surname, name, nameGu, phone,
      phone2: phone === "9825014523" ? "9725014523" : "", label2: "work", village,
      tehsil: "મહુવા", district: "ભાવનગર", ...(loc ? { currentLocation: loc } : {}),
      createdAt: now, approvedAt: now, approvedBy: "seed", consentAt: now, consentVersion: "v1",
    });
  }
  const r = { id: randomUUID(), owner: randomUUID(), kind: "new", createdAt: now, consentAt: now,
    payload: { firstName: "Kiranben", middleName: "Mahesh", surname: "Vaghela", name: "Kiranben Mahesh Vaghela", nameGu: "કિરણબેન મહેશ વાઘેલા", phone: "9825099001", phone2: "", label2: "work", village: "તરેડી", tehsil: "મહુવા", district: "ભાવનગર", currentLocation: "Vadodara" } };
  store.put("requests", r);
  forwardRequest(store, r.id, "Known family, verified");
  store.put("requests", { id: randomUUID(), owner: randomUUID(), kind: "new", createdAt: now, consentAt: now,
    payload: { firstName: "Mahendra", middleName: "Nanji", surname: "Dabhi", name: "Mahendra Nanji Dabhi", nameGu: "મહેન્દ્ર નાનજી ડાભી", phone: "9825099002", phone2: "", label2: "work", village: "તરેડી", tehsil: "મહુવા", district: "ભાવનગર" } });
  return new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve({ store, url: "http://127.0.0.1:" + s.address().port, close: () => s.close() }));
  });
}

const browser = await launchBrowser();
const shots = [];
async function page(url, theme, lang = "gu") {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2 });
  // A typical phone (the sandbox browser reports 2 cores = low-end mode).
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 6 });
  });
  await context.addInitScript(([t, l]) => {
    try { localStorage.setItem("mvpmi-preferences", JSON.stringify({ theme: t, lang: l })); } catch {}
  }, [theme, lang]);
  const p = await context.newPage();
  p.on("pageerror", (e) => console.error("pageerror", e.message));
  await p.goto(url);
  await p.getByTestId("Brand logo").waitFor();
  await p.waitForTimeout(400);
  return p;
}
const snap = async (p, name, theme) => {
  await p.waitForTimeout(450);
  const file = `${OUT}/${name}-${theme}.png`;
  await p.screenshot({ path: file });
  shots.push(file);
  if (A11Y) {
    const result = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      result.violations.map((v) => v.id + " " + JSON.stringify(v.nodes.map((n) => n.target)).slice(0, 300)),
      [],
      name + "-" + theme,
    );
    await verifyGlassContrast(p, result.incomplete, name + "-" + theme);
    a11yScreens++;
  }
};
const close = async (p) => {
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  const back = p.locator(".preferences-scrim .workflow-back, .preferences-scrim .workflow-heading button, .preferences-scrim .sheet-close, .preferences-scrim .close-preferences");
  if (await p.locator(".preferences-scrim").count()) await back.first().click().catch(() => {});
  await p.waitForTimeout(200);
};
const approveSelf = async (p, store) => {
  const applied = await p.evaluate(() =>
    fetch("/api/enrollment", { method: "POST", headers: { "Content-Type": "application/json", "X-MVPMI-Client": "1" },
      body: JSON.stringify({ firstName: "Vijaysinh", middleName: "Bhupat", surname: "Vala", phone: "9825014599", phone2: "9725014599", village: "તરેડી", currentLocation: "Surat", consent: true }) }).then((r) => r.json()));
  const req = store.get("requests", applied.myRequest.id);
  store.put("members", { ...req.payload, id: "me-" + randomUUID(), owner: req.owner, createdAt: Date.now(), approvedAt: Date.now() });
  store.del("requests", req.id);
  await p.reload();
  await p.getByTestId("My profile").waitFor();
};

const plain = await server(false);
for (const theme of ["light", "dark"]) {
  // Guest / applicant
  let p = await page(plain.url, theme);
  await snap(p, "01-signup", theme);
  await p.locator(".noscroll").first().evaluate((el) => (el.scrollTop = 600));
  await snap(p, "02-signup-lower", theme);
  await p.getByTestId("Reading settings").click();
  await snap(p, "03-preferences", theme);
  await close(p);
  await p.getByTestId("All admins").click();
  await snap(p, "04-all-admins", theme);
  await close(p);
  await p.getByTestId("Village admin sign in").click();
  await snap(p, "05-admin-signin", theme);
  await close(p);
  await p.evaluate(() =>
    fetch("/api/enrollment", { method: "POST", headers: { "Content-Type": "application/json", "X-MVPMI-Client": "1" },
      body: JSON.stringify({ firstName: "Pending", middleName: "Test", surname: "Applicant", phone: "9825014588", village: "તરેડી", consent: true }) }));
  await p.reload();
  await p.getByTestId("Brand logo").waitFor();
  await snap(p, "06-pending", theme);
  await p.context().close();

  // Approved member
  p = await page(plain.url, theme);
  await approveSelf(p, plain.store);
  await snap(p, "07-directory-all", theme);
  await p.locator(".directory-segments button").first().click();
  await snap(p, "08-directory-villages", theme);
  await p.locator(".village-tile").first().click();
  await snap(p, "09-village-view", theme);
  await p.locator(".directory-segments button").nth(1).click();
  await p.getByPlaceholder(/શોધ|Search/).first().fill("ભરત").catch(() => {});
  await snap(p, "10-search", theme);
  await p.getByPlaceholder(/શોધ|Search/).first().fill("").catch(() => {});
  await p.getByTestId("Call").first().click();
  await snap(p, "11-call-sheet", theme);
  await close(p);
  await p.getByTestId("My profile").click();
  await snap(p, "12-profile", theme);
  await p.getByRole("button", { name: /Edit my details|મારી વિગત બદલો/ }).click();
  await snap(p, "13-edit-profile", theme);
  await p.context().close();

  // Main administrator
  p = await page(plain.url, theme);
  for (let i = 0; i < 5; i++) await p.getByTestId("Brand logo").click({ force: true });
  await p.getByRole("button", { name: "5", exact: true }).first().waitFor();
  await snap(p, "14-gate", theme);
  for (const d of "5831") await p.getByRole("button", { name: d, exact: true }).first().click();
  await p.getByPlaceholder("admin", { exact: true }).waitFor();
  await snap(p, "15-admin-login", theme);
  await p.getByPlaceholder("admin", { exact: true }).fill("admin");
  await p.locator("input[type=password]").fill("Preview@2026!");
  await p.getByRole("button", { name: /^Sign in$|^લોગિન કરો$/ }).click();
  await p.getByRole("button", { name: /^Saved it$|^સાચવી લીધો$/ }).waitFor().catch(() => {});
  await snap(p, "16-recovery-code", theme);
  await p.getByRole("button", { name: /^Saved it$|^સાચવી લીધો$/ }).click().catch(() => {});
  await snap(p, "17-admin-home", theme);
  await p.locator(".admin-dashboard-grid .mvpmi-tile, .mvpmi-tile").first().click();
  await snap(p, "18-admin-section", theme);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.getByTestId("Village management").click();
  await snap(p, "19-workflow-requests", theme);
  await p.locator(".workflow-tabs button").nth(1).click();
  await snap(p, "20-workflow-villages", theme);
  await p.context().close();

  // Village administrator
  p = await page(plain.url, theme);
  await p.getByTestId("Village admin sign in").click();
  await p.getByRole("dialog").locator("input").first().fill("9001000003");
  await p.getByRole("dialog").locator('input[type="password"]').fill("Taredi@2026");
  await p.getByRole("dialog").getByRole("button", { name: /^Sign in$|^સાઇન ઇન$/ }).click();
  await p.getByTestId("Dashboard").click();
  await snap(p, "21-va-requests", theme);
  await p.locator(".workflow-tabs button").nth(1).click();
  await snap(p, "22-va-members", theme);
  await p.context().close();
}
plain.close();

const locked = await server(true);
for (const theme of ["light", "dark"]) {
  const p = await page(locked.url, theme);
  await approveSelf(p, locked.store).catch(() => {});
  await p.getByRole("button", { name: "5", exact: true }).first().waitFor();
  await snap(p, "23-pin-setup", theme);
  await p.getByRole("button", { name: /Forgot PIN|પિન ભૂલી ગયા/ }).count();
  await p.context().close();
}
locked.close();
await browser.close();
console.log("Saved " + shots.length + " screenshots to " + OUT);
if (A11Y)
  console.log(
    `PASS: ${a11yScreens} Liquid Glass screens (light + dark): 0 axe violations; glass text contrast measured on rendered pixels.`,
  );
