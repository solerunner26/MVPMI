import { launchBrowser } from "/home/claude/MVPMI/scripts/browser.mjs";
import { createApp } from "/home/claude/MVPMI/server/app.mjs";
import { mainAdminId } from "/home/claude/MVPMI/server/auth.mjs";
const MAIN = { name: "Test Main Admin", mobile: "9913000001", village: "Thorala", location: "Thorala", password: "Testing@26" };
const { app, store } = createApp({ dbPath: ":memory:", mainAdmin: MAIN, development: true });
const mm = store.get("members", mainAdminId(store)); delete mm.cred.initial; store.put("members", mm);
const srv = app.listen(0, "127.0.0.1"); await new Promise((r) => srv.once("listening", r));
const url = "http://127.0.0.1:" + srv.address().port;
const browser = await launchBrowser();
const out = {};
for (const bridge of [true, false]) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 728 }, acceptDownloads: true });
  await ctx.addInitScript((b) => { window.__saved = []; if (b) window.mvpmiBridge = { saveFile: (n) => window.__saved.push(n), notify() {}, printHtml() {}, setScreenPrivacy() {} }; localStorage.setItem("mvpmi-preferences", JSON.stringify({ lang: "en" })); }, bridge);
  const page = await ctx.newPage(); await page.goto(url);
  await page.getByTestId("Toggle password mode").click(); await page.getByTestId("Login mobile").fill(MAIN.mobile); await page.getByTestId("Login secret").fill(MAIN.password); await page.getByTestId("Login submit").click();
  await page.getByTestId("Admin").waitFor(); await page.getByTestId("Admin").click();
  await page.getByTestId("Admin enter dialog").waitFor().catch(() => {});
  if (await page.getByTestId("Admin enter dialog").count()) { await page.getByTestId("Admin enter dialog").locator("input[type=password]").fill(MAIN.password); await page.getByTestId("Admin enter dialog").getByRole("button").last().click(); }
  await page.waitForTimeout(1200);
  const dl = bridge ? null : page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  const r = await page.evaluate(async () => {
    let f = null;
    for (const el of document.querySelectorAll("*")) { const key = Object.keys(el).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")); if (!key) continue; let g = el[key]; while (g && !(g.stateNode && g.stateNode && g.stateNode.logic && typeof g.stateNode.logic.file === "function")) g = g.return; if (g) { f = g; break; } }
    if (!f) { const a=document.querySelector(".app"); const r=document.getElementById("root")||document.body.firstElementChild; return { error: "no component", appKeys: a?Object.keys(a):null, rootKeys: r?Object.keys(r):null, rootId: r?.id }; }
    const inst=f.stateNode.logic; if (typeof inst.file!=="function") return {error:"no file()", methods:Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).slice(0,60)}; await inst.file("export.csv?type=members&lang=en", "mvpmi-members.csv");
    await new Promise((r) => setTimeout(r, 500));
    return { saveFileCalls: window.__saved.length, busyAfter: f.stateNode._busy };
  });
  out[bridge ? "androidBridge" : "plainBrowser"] = { ...r, browserDownload: bridge ? undefined : !!(await dl) };
  await ctx.close();
}
console.log(JSON.stringify(out));
await browser.close(); srv.close();
