// Read-only reproduction of report findings A01–A09 against the built dist
// (release tag eca7d83). Not part of the repo.
import { launchBrowser } from "/home/claude/MVPMI/scripts/browser.mjs";
import { createApp } from "/home/claude/MVPMI/server/app.mjs";
import { profile } from "/home/claude/MVPMI/server/store.mjs";
import { mainAdminId } from "/home/claude/MVPMI/server/auth.mjs";
import { readFileSync, mkdirSync } from "node:fs";
const OUT = process.env.OUT;
mkdirSync(OUT, { recursive: true });
const MAIN = { name: "Test Main Admin", mobile: "9913000001", village: "Thorala", location: "Thorala", password: "Testing@26" };
const { app, store } = createApp({ dbPath: ":memory:", mainAdmin: MAIN, development: true, requireAppLock: true });
const mm = store.get("members", mainAdminId(store)); delete mm.cred.initial; store.put("members", mm);
const srv = app.listen(0, "127.0.0.1"); await new Promise((r) => srv.once("listening", r));
const url = "http://127.0.0.1:" + srv.address().port;
const client = () => { let c = ""; return async (p, b) => { const r = await fetch(url + "/api/" + p, { method: b === undefined ? "GET" : "POST", headers: { Cookie: c, "X-MVPMI-Client": "1", "Content-Type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) }); if (r.headers.get("set-cookie")) c = r.headers.get("set-cookie").split(";")[0]; const j = await r.json(); if (!r.ok) throw new Error(p + ": " + (j.code || j.error)); return j; }; };
const admin = client(); await admin("login", { mobile: MAIN.mobile, secret: MAIN.password });
await admin("admin/village-admins/" + encodeURIComponent("થોરાળા") + "/create", { name: "Village Admin 10", mobile: "9800000010" });
store.tx(() => {
  const names = [["Seed", "Member0"], ["Bhagirathsinh Jaswantsinh", "Gohilvadiya"], ["ભગીરથસિંહ જસવંતસિંહ", "ગોહિલવાડિયા"], ["Short", "Name"]];
  names.forEach(([f, s], i) => store.put("members", { ...profile({ firstName: f, surname: s, phone: String(9700000000 + i), village: "થોરાળા", currentLocation: "Surat" }), id: "seed" + i, owner: "o" + i, approvedAt: 1 }));
});
const browser = await launchBrowser();
const results = {};
async function phone({ width = 360, lang = "en", fsPct = 100, theme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 728 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((p) => { try { localStorage.setItem("mvpmi-preferences", JSON.stringify(p)); } catch {} }, { lang, fsPct, theme });
  const page = await ctx.newPage(); await page.goto(url); return { ctx, page };
}
async function loginMobile(page, m) { await page.getByTestId("Login screen").waitFor(); await page.getByTestId("Login mobile").fill(m); await page.getByTestId("Login submit").click(); await page.getByTestId("Contact row").first().waitFor(); }
async function loginMain(page) { await page.getByTestId("Login screen").waitFor(); await page.getByTestId("Toggle password mode").click(); await page.getByTestId("Login mobile").fill(MAIN.mobile); await page.getByTestId("Login secret").fill(MAIN.password); await page.getByTestId("Login submit").click(); await page.getByTestId("Contact row").first().waitFor(); }
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// A01 + A06: matrix
results.A01 = []; results.A06 = [];
for (const width of [320, 360, 412]) for (const lang of ["en", "gu"]) for (const fsPct of [85, 100, 135, 165]) for (const theme of ["light"]) {
  const { ctx, page } = await phone({ width, lang, fsPct, theme });
  await loginMobile(page, "9800000010");
  const rowsInfo = await page.evaluate(() => [...document.querySelectorAll('[data-testid="Contact row"]')].map((row) => {
    const acts = [...row.querySelectorAll("a,button")].filter((x) => /tel:|wa\.me|whatsapp/i.test(x.getAttribute("href") || "") || /Call|WhatsApp/i.test(x.getAttribute("aria-label") || ""));
    const ar = acts.map((a) => a.getBoundingClientRect()); const left = Math.min(...ar.map((r) => r.left));
    const texts = [...row.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim() && !acts.some((a) => a.contains(e)));
    let worst = 0, who = "";
    for (const t of texts) { const r = t.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(t); const rr = range.getBoundingClientRect(); let right = Math.max(r.right, rr.right);
      // Only what is painted counts: clip by every overflow-hidden box.
      for (let e = t; e && e !== row; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowX !== "visible") right = Math.min(right, e.getBoundingClientRect().right); } for (const a of ar) { const o = Math.min(right, a.right) - Math.max(r.left, a.left); const v = Math.min(r.bottom, a.bottom) - Math.max(r.top, a.top); if (o > 0 && v > 0 && o > worst) { worst = o; who = t.textContent.trim().slice(0, 30); } } }
    return { worst: Math.round(worst), who, actionsLeft: Math.round(left) };
  }));
  const bad = rowsInfo.filter((r) => r.worst > 0);
  results.A01.push({ width, lang, fsPct, overlapRows: bad.length, maxOverlapPx: Math.max(0, ...bad.map((b) => b.worst)), example: bad[0]?.who || "" });
  const head = await page.evaluate(() => { const i = document.querySelector('[data-testid="Search input"]'); const n = document.querySelector('[data-testid="Community name"]'); const ps = i ? getComputedStyle(i) : null;
    const ctx2 = document.createElement("canvas").getContext("2d"); if (ps) ctx2.font = ps.font; const phW = i ? ctx2.measureText(i.placeholder).width : 0;
    return { searchW: Math.round(i?.getBoundingClientRect().width || 0), nameClipped: n ? n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 : null, placeholderCut: i ? (ctx2.font = getComputedStyle(i, "::placeholder").font, ctx2.measureText(i.placeholder).width) > i.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) : null }; });
  results.A06.push({ width, lang, fsPct, ...head });
  if (width === 320 && fsPct === 165 && lang === "en") await page.screenshot({ path: OUT + "/A01-320-165-en.png" });
  await ctx.close();
}
// A05: idle mutations on directory + admin panel
{
  const { ctx, page } = await phone({});
  await loginMobile(page, "9800000010");
  await page.waitForTimeout(1500);
  const count = async () => page.evaluate(() => new Promise((res) => { let n = 0; const o = new MutationObserver((l) => (n += l.length)); o.observe(document.body, { subtree: true, attributes: true, childList: true }); setTimeout(() => { o.disconnect(); res(n); }, 1000); }));
  results.A05 = { directoryIdleMutationsPerSec: await count() };
  await page.getByTestId("Admin").click(); await page.locator(".workflow-panel").waitFor(); await page.waitForTimeout(1500);
  results.A05.workflowIdleMutationsPerSec = await count();
  // A08: workflow tabs size
  results.A08 = await page.evaluate(() => { const tabs = [...document.querySelectorAll(".workflow-tabs button")]; const p = document.querySelector(".workflow-panel"); return { tabHeights: tabs.map((b) => Math.round(b.getBoundingClientRect().height)), tabsBlockHeight: Math.round(document.querySelector(".workflow-tabs")?.getBoundingClientRect().height || 0) }; });
  await page.screenshot({ path: OUT + "/A08-workflow-360.png" });
  // A03: members tab → Propose change → 503
  await page.locator(".workflow-tabs button", { hasText: "My village members" }).click();
  const card = page.locator(".workflow-card", { hasText: "Short Name" });
  await card.getByRole("button", { name: "Propose change" }).click();
  const reasonBox = card.locator("input,textarea").last();
  await reasonBox.fill("Repro reason text");
  await page.route("**/api/village/members/**", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Service unavailable (repro)" }) }));
  await card.getByRole("button", { name: "Send to main administrator" }).click();
  await page.waitForTimeout(800);
  results.A03 = { update: { bannerVisible: await page.getByTestId("Error banner").isVisible().catch(() => false), formStillOpen: (await card.getByRole("button", { name: "Send to main administrator" }).count()) > 0 } };
  await page.getByTestId("Error banner close").click().catch(() => {});
  await card.getByRole("button", { name: "Propose removal" }).click();
  await card.locator("input,textarea").last().fill("Repro removal reason");
  await card.getByRole("button", { name: "Send removal proposal" }).click();
  await page.waitForTimeout(800);
  results.A03.delete = { bannerVisible: await page.getByTestId("Error banner").isVisible().catch(() => false), formStillOpen: (await card.getByRole("button", { name: "Send removal proposal" }).count()) > 0 };
  await page.unroute("**/api/village/members/**");
  // A09: English card location prefix
  results.A09 = { englishCardText: (await card.innerText()).split("\n").find((l) => /Surat/.test(l)) };
  await ctx.close();
}
// A07 + A08 reset: Settings
{
  const { ctx, page } = await phone({});
  await loginMobile(page, "9800000010");
  await page.getByTestId("Profile and settings").click();
  await page.getByTestId("Profile settings").click();
  await page.waitForTimeout(600);
  results.A07 = await page.evaluate(() => [...document.querySelectorAll(".alpha-menu-item, [class*=menu] button")].slice(0, 8).map((b) => { const sp = [...b.querySelectorAll("span")].find((s) => s.textContent.trim() && !s.querySelector("svg,i")); if (!sp) return null; return { label: sp.textContent.trim().slice(0, 30), textAlign: getComputedStyle(sp).textAlign, textLeft: Math.round((() => { const r = document.createRange(); r.selectNodeContents(sp); return r.getBoundingClientRect().left; })()) }; }).filter(Boolean));
  const reset = page.getByTestId("Settings text size reset");
  results.A08.resetButton = await reset.evaluate((b) => ({ width: Math.round(b.getBoundingClientRect().width), height: Math.round(b.getBoundingClientRect().height), parentWidth: Math.round(b.parentElement.getBoundingClientRect().width) }));
  await page.screenshot({ path: OUT + "/A07-settings-360.png", fullPage: true });
  await ctx.close();
}
// A02: export with Android bridge stub (Main Admin)
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 728 } });
  await ctx.addInitScript(() => { window.__saved = []; window.mvpmiBridge = { saveFile: (n, m, b) => window.__saved.push(n), notify() {}, printHtml() {}, setScreenPrivacy() {} }; localStorage.setItem("mvpmi-preferences", JSON.stringify({ lang: "en" })); });
  const page = await ctx.newPage(); await page.goto(url); await loginMain(page);
  results.A02 = await page.evaluate(async () => { const inst = window.__mvpmiApp || null; return { hasHandle: !!inst }; });
  await ctx.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close(); srv.close();
