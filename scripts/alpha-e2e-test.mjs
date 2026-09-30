// End-to-end test of the whole app (login without PIN, optional phone lock,
// approvals, directory layout, offline, navigation). Drives the real app in Chromium
// at phone size against a fresh in-memory server, one flow per section, and
// writes the checklist table (screen | button | result | pass/fail) to
// test-results/alpha-checklist.{json,md}. Exit code 1 if any row fails.
import { launchBrowser } from "./browser.mjs";
import { createApp } from "../server/app.mjs";
import { profile } from "../server/store.mjs";
import { mainAdminId } from "../server/auth.mjs";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

// FIRST_PASSWORD is the seeded first-login-only password; flow s2 tests the
// forced change to MAIN.password. Every other flow starts after that change.
const FIRST_PASSWORD = "FirstTime@26";
const MAIN = { name: "Test Main Admin", mobile: "9913000001", village: "Thorala", location: "Thorala", password: "Testing@26" };
const PHONE = { width: 360, height: 728 }; // 6-inch phone, minus status and navigation bars
const rows = [];
const only = process.env.ALPHA_ONLY ? new Set(process.env.ALPHA_ONLY.split(",")) : null;
mkdirSync("test-results/alpha", { recursive: true });

async function server(keepFirstPassword = false) {
  const { app, store } = createApp({
    dbPath: ":memory:",
    mainAdmin: keepFirstPassword ? { ...MAIN, password: FIRST_PASSWORD } : MAIN,
    development: true,
    requireAppLock: true,
  });
  if (!keepFirstPassword) {
    const m = store.get("members", mainAdminId(store));
    delete m.cred.initial;
    store.put("members", m);
  }
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const url = "http://127.0.0.1:" + s.address().port;
  // Plain API client for set-up steps that are not under test.
  const client = () => {
    let cookie = "";
    return async (path, body) => {
      const r = await fetch(url + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { Cookie: cookie, "X-MVPMI-Client": "1", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
      const j = await r.json();
      if (!r.ok) throw new Error(path + ": " + (j.code || j.error));
      return j;
    };
  };
  const admin = client();
  // In flow s2 the browser does the Main Admin's very first login itself.
  if (!keepFirstPassword) await admin("login", { mobile: MAIN.mobile, secret: MAIN.password });
  const villageAdmins = new Map();
  const ensureVA = async (village = "થોરાળા", mobile = "9800000010") => {
    if (villageAdmins.has(village)) return villageAdmins.get(village);
    await admin("admin/village-admins/" + encodeURIComponent(village) + "/create", { name: "Village Admin " + mobile.slice(-2), mobile });
    const c = client();
    await c("login", { mobile });
    const va = { client: c, mobile };
    villageAdmins.set(village, va);
    return va;
  };
  // Registers, forwards and approves a member (no PIN exists any more).
  const approvedMember = async (phone, village = "થોરાળા", name = "Test Member") => {
    const va = await ensureVA(village);
    const u = client();
    const [firstName, surname] = name.split(" ");
    const r = await u("enrollment", { firstName, surname, phone, village, consent: true });
    await va.client("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
    await admin("admin/requests/" + r.myRequest.id + "/approve", {});
    return phone;
  };
  const seedMembers = (n, village = "થોરાળા") => {
    store.tx(() => {
      for (let i = 0; i < n; i++)
        store.put("members", {
          ...profile({ firstName: "Seed" + String.fromCharCode(65 + (i % 26)), surname: "Member" + i, phone: String(9700000000 + i), village }),
          id: "seed-" + village + i,
          owner: "seed-owner-" + i,
          approvedAt: 1,
        });
    });
  };
  return { store, url, client, admin, ensureVA, approvedMember, seedMembers, close: () => new Promise((r) => s.close(r)) };
}

const browser = await launchBrowser();
async function phone(url, { lang = "en", viewport = PHONE } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, serviceWorkers: "allow" });
  // Preferences are stored before the app starts (language choice).
  await ctx.addInitScript((l) => {
    try {
      if (!localStorage.getItem("mvpmi-preferences")) localStorage.setItem("mvpmi-preferences", JSON.stringify({ lang: l }));
    } catch {}
  }, lang);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) page.errors.push(m.text());
  });
  await page.goto(url);
  return { ctx, page };
}
const screenOf = (page) => page.locator(".app").getAttribute("data-screen");
const back = (page) => page.evaluate(() => window.mvpmiBack());
async function waitScreen(page, name, timeout = 10000) {
  await page.waitForFunction((n) => document.querySelector(".app")?.getAttribute("data-screen") === n, name, { timeout });
}
async function loginMain(page, password = MAIN.password) {
  await page.getByTestId("Login screen").waitFor();
  await page.getByTestId("Toggle password mode").click();
  await page.getByTestId("Login mobile").fill(MAIN.mobile);
  await page.getByTestId("Login secret").fill(password);
  await page.getByTestId("Login submit").click();
}
// Members and Village Admins: mobile number only.
async function loginMobile(page, mobile) {
  await page.getByTestId("Login screen").waitFor();
  await page.getByTestId("Login mobile").fill(mobile);
  await page.getByTestId("Login submit").click();
}
// Opens Settings the way a person does: My Profile icon → Settings.
async function openSettings(page) {
  await page.getByTestId("Profile and settings").click();
  await waitScreen(page, "profile");
  await page.getByTestId("Profile settings").click();
  await waitScreen(page, "settings");
}
async function signOut(page) {
  await openSettings(page);
  await page.getByTestId("Sign out of this phone").click();
  await page.getByTestId("Confirm yes").click();
  await waitScreen(page, "login");
}
async function toast(page, text) {
  await page.locator('[role="status"]', { hasText: text }).first().waitFor({ timeout: 5000 });
}
async function shot(page, name) {
  await page.screenshot({ path: "test-results/alpha/" + name + ".png" });
}
function row(section, screen, button, expected) {
  return {
    async run(fn) {
      try {
        const result = await fn();
        rows.push({ section, screen, button, expected, result: result || expected, pass: true });
      } catch (e) {
        rows.push({ section, screen, button, expected, result: String(e.message || e).split("\n")[0].slice(0, 180), pass: false });
        throw e;
      }
    },
  };
}
let lastPage = null;
async function flow(name, fn) {
  if (only && !only.has(name)) return;
  const env = await server(name === "s2");
  try {
    await fn(env);
  } catch (e) {
    try {
      for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: "test-results/alpha/FAIL-" + name + "-" + Math.random().toString(36).slice(2, 6) + ".png" });
    } catch {}
    console.error("Flow " + name + " stopped: " + (e.stack || e).toString().split("\n").slice(0, 12).join(" | "));
    // Readable on the GitHub run page (annotations) without downloading logs.
    if (process.env.GITHUB_ACTIONS) console.log("::error title=E2E flow " + name + " stopped::" + (e.stack || e).toString().split("\n").slice(0, 8).join(" | ").replace(/[\r\n%]/g, " "));
  } finally {
    await env.close();
  }
}
// Every visible control has a name; nothing overflows sideways.
async function screenAudit(page, section, screen) {
  await row(section, screen, "(all buttons and links)", "every control has an accessible name").run(async () => {
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll(".app button, .app a[href], .app [role=button], .app input, .app select")]
        .filter((el) => el.getClientRects().length && !el.closest("[inert]"))
        .filter((el) => {
          const label = el.getAttribute("aria-label") || el.textContent.trim() || el.getAttribute("title") || (el.labels && el.labels[0]?.textContent.trim());
          return !label;
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    assert.deepEqual(unnamed, []);
  });
  await row(section, screen, "(layout)", "no sideways scrolling at 360 px").run(async () => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, "overflow " + over + "px");
  });
  await row(section, screen, "(accessibility scan)", "no serious or critical axe issues").run(async () => {
    // Scan again after a short pause if a fade/slide animation was still
    // running (half-transparent text fails the contrast rule mid-animation).
    let bad = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await page.waitForTimeout(600);
      const result = await new AxeBuilder({ page }).include(".app").analyze();
      bad = result.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id + ": " + v.nodes[0]?.target);
      if (!bad.length) break;
    }
    assert.ok(!bad.length, "axe: " + bad.join(" ; "));
  });
}

// Simulates the app going to the background for `ms` and coming back.
async function backgroundFor(page, ms) {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  await page.evaluate((shift) => {
    window.__realNow ||= Date.now;
    Date.now = () => window.__realNow() + shift;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  }, ms);
}
const restoreClock = (page) => page.evaluate(() => window.__realNow && (Date.now = window.__realNow));

// ---------------------------------------------------------------- Section 2
await flow("s2", async (env) => {
  const S = "2 Main Admin";
  const { page, ctx } = await phone(env.url);
  await row(S, "Login", "(mobile field)", "one mobile field; no PIN field for members").run(async () => {
    await page.getByTestId("Login screen").waitFor();
    assert.equal(await page.getByTestId("Login secret").count(), 0);
    assert.equal(await page.getByText(/Forgot PIN/i).count(), 0);
    assert.equal(await page.getByText(/PIN/).count(), 0, "the word PIN is not on the login screen");
    await shot(page, "s2-login");
  });
  await row(S, "Login", "Log in with the Main Admin's mobile only", "asks for the password").run(async () => {
    await loginMobile(page, MAIN.mobile);
    await page.getByTestId("Login secret").waitFor();
    await page.getByTestId("Login error").filter({ hasText: "Main Admin number" }).waitFor();
    assert.equal(await page.getByTestId("Login secret").getAttribute("autocomplete"), "current-password");
    assert.equal(await page.getByTestId("Login mobile").getAttribute("name"), "username");
  });
  await row(S, "Login", "Log in (wrong password)", "shows 'Wrong password' and attempts left").run(async () => {
    await page.getByTestId("Login secret").fill("Wrong@pass1");
    await page.getByTestId("Login submit").click();
    await page.getByTestId("Login error").filter({ hasText: "Wrong password" }).waitFor();
    await page.getByTestId("Login error").filter({ hasText: "4 attempts left" }).waitFor();
  });
  await row(S, "Login", "Log in (first-time password)", "asks for a new password before anything else").run(async () => {
    await page.getByTestId("Login secret").fill(FIRST_PASSWORD);
    await page.getByTestId("Login submit").click();
    await waitScreen(page, "setpin");
    await page.getByText("Set your new password").first().waitFor();
    assert.equal(await page.getByTestId("Admin").count(), 0);
    assert.equal(await page.getByTestId("Set PIN new").getAttribute("autocomplete"), "new-password");
    await shot(page, "s2-first-password");
  });
  for (const [label, next, confirm, message] of [
    ["shorter than 4", "abc", "abc", "at least 4 characters"],
    ["same as the first-time password", FIRST_PASSWORD, FIRST_PASSWORD, "same as the old password"],
    ["fields differ", MAIN.password, MAIN.password + "x", "do not match"],
  ])
    await row(S, "Set new password", "Set password (" + label + ")", "error shown, stays on the screen").run(async () => {
      await page.getByTestId("Set PIN new").fill(next);
      await page.getByTestId("Set PIN confirm").fill(confirm);
      await page.getByTestId("Set PIN submit").click();
      await page.getByTestId("Set PIN error").filter({ hasText: message }).waitFor();
      assert.equal(await screenOf(page), "setpin");
    });
  await row(S, "Set new password", "Set password (valid)", "'Password set', lands on the Member Directory").run(async () => {
    await page.getByTestId("Set PIN new").fill(MAIN.password);
    await page.getByTestId("Set PIN confirm").fill(MAIN.password);
    await page.getByTestId("Set PIN submit").click();
    await waitScreen(page, "directory");
    await toast(page, "Password set");
    await shot(page, "s2-directory-main-admin");
  });
  await row(S, "Directory", "Back", "leaves the app (never returns to Login)").run(async () => {
    assert.equal(await back(page), false);
    assert.equal(await screenOf(page), "directory");
  });
  await row(S, "Directory", "Admin icon", "opens the admin dashboard").run(async () => {
    await page.getByTestId("Admin").click();
    await waitScreen(page, "admin");
  });
  await row(S, "Admin dashboard", "My Profile tile", "profile page shows name, mobile, village, current location").run(async () => {
    await page.getByRole("button", { name: /My Profile/ }).click();
    await waitScreen(page, "profile");
    const text = await page.getByTestId("Main Admin profile").innerText();
    for (const part of ["Test Main Admin", "99130 00001", "Thorala", "Main Admin"]) assert.ok(text.includes(part), part);
    await shot(page, "s2-main-admin-profile");
  });
  const dialog = () => page.getByTestId("Change Password dialog");
  const fill = async (current, next, confirm) => {
    await page.getByTestId("Change current").fill(current);
    await page.getByTestId("Change next").fill(next);
    await page.getByTestId("Change confirm").fill(confirm);
    await page.getByTestId("Change submit").click();
  };
  await row(S, "Profile", "Change Password", "opens Old / New / Re-enter dialog").run(async () => {
    await page.getByTestId("Profile change password").click();
    await dialog().waitFor();
    assert.equal(await page.getByTestId("Change next").getAttribute("autocomplete"), "new-password");
  });
  for (const [label, args, message] of [
    ["wrong old password", ["Nope@1234", "abcd", "abcd"], "The old password is wrong."],
    ["new shorter than 4", [MAIN.password, "abc", "abc"], "at least 4 characters"],
    ["new same as old", [MAIN.password, MAIN.password, MAIN.password], "same as the old password"],
    ["new fields differ", [MAIN.password, "abcd", "abce"], "do not match"],
  ])
    await row(S, "Change Password dialog", "Change (" + label + ")", "error shown, dialog stays open, typing kept").run(async () => {
      await fill(...args);
      await page.getByTestId("Change error").filter({ hasText: message }).waitFor();
      assert.ok(await dialog().isVisible());
      assert.equal(await page.getByTestId("Change next").inputValue(), args[1]);
    });
  await row(S, "Change Password dialog", "Change (a very simple password)", "any 4+ character password is accepted").run(async () => {
    await fill(MAIN.password, "abcd", "abcd");
    await toast(page, "Password changed successfully");
    await dialog().waitFor({ state: "detached" });
  });
  await row(S, "Profile", "Back", "returns to the admin dashboard").run(async () => {
    await page.getByTestId("Back").click();
    await waitScreen(page, "admin");
  });
  await row(S, "Admin dashboard", "Log out of admin", "admin session ends, lands on Member Directory as a member").run(async () => {
    await page.getByTestId("Admin logout").click();
    await waitScreen(page, "directory");
    await toast(page, "Logged out of admin");
    assert.equal(await back(page), false, "Back does not return to admin");
    assert.equal(await screenOf(page), "directory");
  });
  await row(S, "Directory", "Admin icon (after admin logout)", "asks for the password again").run(async () => {
    await page.getByTestId("Admin").click();
    await page.getByTestId("Admin enter dialog").waitFor();
    await page.getByTestId("Admin enter secret").fill("abcd");
    await page.getByTestId("Admin enter submit").click();
    await waitScreen(page, "admin");
    await back(page);
    await waitScreen(page, "directory");
  });
  await row(S, "Settings", "Sign out of this phone", "clears everything, Login screen; Back leaves the app").run(async () => {
    await signOut(page);
    assert.equal(await back(page), false);
    assert.equal(await page.evaluate(() => localStorage.getItem("mvpmi.offline.v1")), null);
  });
  await row(S, "Login", "Log in with the OLD password", "refused").run(async () => {
    await loginMain(page, MAIN.password);
    await page.getByTestId("Login error").filter({ hasText: "Wrong password" }).waitFor();
  });
  await row(S, "Login", "Log in with the first-time password", "refused (first login only)").run(async () => {
    await page.getByTestId("Login secret").fill(FIRST_PASSWORD);
    await page.getByTestId("Login submit").click();
    await page.getByTestId("Login error").filter({ hasText: "Wrong password" }).waitFor();
  });
  await row(S, "Login", "Log in with the NEW password", "works").run(async () => {
    await page.getByTestId("Login secret").fill("abcd");
    await page.getByTestId("Login submit").click();
    await waitScreen(page, "directory");
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- Section 3
await flow("s3", async (env) => {
  const S = "3 Village Admins";
  const main = await phone(env.url);
  await row(S, "Admin → Manage Village Admins", "(drop-down instead of seven tiles)", "no village cards until a village is chosen").run(async () => {
    await loginMain(main.page);
    await waitScreen(main.page, "directory");
    await main.page.getByTestId("Admin").click();
    await waitScreen(main.page, "admin");
    await main.page.getByRole("button", { name: /Manage Village Admins/ }).click();
    await main.page.getByTestId("VA village select").waitFor();
    assert.equal(await main.page.locator('[data-testid^="Village admin "]').count(), 0);
    assert.equal(await main.page.getByTestId("VA village select").locator("option").count(), 8, "'Choose' + 7 villages");
    await shot(main.page, "s3-manage-dropdown");
  });
  await row(S, "Manage Village Admins", "Choose Thorala → Create Village Admin", "hand-over dialog: no PIN, Call and WhatsApp").run(async () => {
    await main.page.getByTestId("VA village select").selectOption("થોરાળા");
    assert.equal(await main.page.locator('[data-testid^="Village admin "]').count(), 1, "only the chosen village");
    await main.page.getByTestId("VA create Thorala").click();
    await main.page.getByTestId("VA name").fill("Thorala Village Admin");
    await main.page.getByTestId("VA mobile").fill("9800000010");
    await main.page.getByTestId("VA form save").click();
    await main.page.getByTestId("Village Admin created dialog").waitFor();
    const text = await main.page.getByTestId("Village Admin created text").innerText();
    assert.ok(text.includes("98000 00010") && !/\b\d{4}\b(?! *\d)/.test(text.replace("98000 00010", "")), text);
    await shot(main.page, "s3-created");
  });
  await row(S, "Created dialog", "Share on WhatsApp", "opens WhatsApp to that mobile: app name, village, 'log in with your mobile number'").run(async () => {
    const href = await main.page.getByTestId("Share on WhatsApp").getAttribute("href");
    assert.ok(href.startsWith("https://wa.me/919800000010?text="));
    const text = decodeURIComponent(href.split("text=")[1]);
    for (const part of ["Community Directory", "You are the Village Admin for Thorala", "98000 00010", "ગામ એડમિન"]) assert.ok(text.includes(part), part);
    assert.equal(/PIN|TEMP|password/i.test(text), false, "no secret in the message");
  });
  await row(S, "Created dialog", "Call", "phones the new Village Admin").run(async () => {
    assert.equal(await main.page.getByTestId("Village Admin call").getAttribute("href"), "tel:+919800000010");
  });
  await row(S, "Created dialog", "Done", "closes; the card shows Active with Call").run(async () => {
    await main.page.getByTestId("Village Admin created done").click();
    await main.page.getByTestId("Village Admin created dialog").waitFor({ state: "detached" });
    await main.page.getByTestId("Village admin Thorala").filter({ hasText: "Active" }).waitFor();
    assert.equal(await main.page.getByTestId("VA call Thorala").getAttribute("href"), "tel:+919800000010");
    assert.equal(await main.page.getByTestId("VA reset Thorala").count(), 0, "no PIN reset any more");
  });
  await row(S, "Manage Village Admins", "Create (second admin for Thorala)", "not offered while one is active").run(async () => {
    assert.equal(await main.page.getByTestId("VA create Thorala").count(), 0);
  });
  const va = await phone(env.url);
  await row(S, "Login (Village Admin)", "Log in with the mobile number only", "straight to the directory with the Admin icon").run(async () => {
    await loginMobile(va.page, "9800000010");
    await waitScreen(va.page, "directory");
    await va.page.getByTestId("Admin").waitFor();
    assert.equal(await back(va.page), false);
  });
  // Two registrations: Thorala (this admin) and Sathra (another admin).
  await env.ensureVA("સથરા", "9800000020");
  const applicant = env.client();
  const applied = await applicant("enrollment", { firstName: "Ramesh", surname: "Vala", phone: "9811111111", village: "થોરાળા", consent: true });
  await env.client()("enrollment", { firstName: "Other", surname: "Village", phone: "9822222222", village: "સથરા", consent: true });
  await row(S, "Directory (Village Admin)", "Admin icon", "review panel opens without a password, ONLY their own village").run(async () => {
    await va.page.getByTestId("Admin").click();
    await va.page.locator(".workflow-panel").waitFor();
    assert.equal(await va.page.getByTestId("Admin enter dialog").count(), 0);
    const text = await va.page.locator(".workflow-panel").innerText();
    assert.ok(text.includes("Ramesh Vala"));
    assert.ok(!text.includes("Other Village"));
    await shot(va.page, "s3-village-admin-queue");
  });
  await row(S, "Review panel", "Reject (no reason)", "needs a reason first").run(async () => {
    await va.page.getByTestId("Reject start").click();
    assert.ok(await va.page.getByTestId("Reject confirm").isDisabled());
    await va.page.getByRole("button", { name: "Cancel" }).click();
  });
  await row(S, "Review panel", "Verify & forward", "forwarded to the Main Admin").run(async () => {
    await va.page.locator(".workflow-check input").first().check();
    await va.page.getByRole("button", { name: /Verify & forward/ }).click();
    await va.page.getByText("No requests waiting.").waitFor();
  });
  await row(S, "Admin dashboard (Main Admin)", "Approve forwarded registration", "approved at once; no PIN dialog").run(async () => {
    await main.page.getByTestId("Workflow back").click();
    await main.page.getByRole("button", { name: /(^|\s)Requests\b/ }).filter({ hasText: "removals" }).first().click();
    await main.page.locator('[data-glass="1"]', { hasText: "Ramesh Vala" }).getByRole("button", { name: /Approve/ }).click();
    await toast(main.page, "Saved successfully");
    await main.page.waitForFunction(() => !document.body.innerText.includes("Ramesh Vala"));
    assert.ok(env.store.all("members").some((m) => m.phone === "9811111111"));
    assert.equal(await main.page.getByTestId("Village Admin created dialog").count(), 0);
    void applied;
  });
  await row(S, "Review panel (Village Admin)", "Log out of admin", "ends admin session only; directory as member").run(async () => {
    await va.page.getByTestId("Admin logout").click();
    await waitScreen(va.page, "directory");
    await toast(va.page, "Logged out of admin");
  });
  await row(S, "Directory (Village Admin)", "Admin icon (again)", "opens the tools again with no password").run(async () => {
    await va.page.getByTestId("Admin").click();
    await va.page.locator(".workflow-panel").waitFor();
    assert.equal(await va.page.getByTestId("Admin enter dialog").count(), 0);
    await va.page.getByTestId("Workflow back").click();
  });
  await row(S, "Manage Village Admins", "Disable", "the Village Admin loses admin tools at once").run(async () => {
    await main.page.getByTestId("Admin back").click();
    await main.page.getByRole("button", { name: /Manage Village Admins/ }).click();
    await main.page.getByTestId("VA village select").selectOption("થોરાળા");
    await main.page.getByTestId("VA disable Thorala").click();
    await main.page.getByTestId("Confirm yes").click();
    await main.page.getByTestId("Village admin Thorala").filter({ hasText: "Disabled" }).waitFor();
    await va.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await va.page.getByTestId("Admin").waitFor({ state: "detached", timeout: 12000 });
  });
  await row(S, "Manage Village Admins", "Enable / Edit", "each works").run(async () => {
    await main.page.getByTestId("VA enable Thorala").click();
    await main.page.getByTestId("VA edit Thorala").waitFor();
    await main.page.getByTestId("VA edit Thorala").click();
    await main.page.getByTestId("VA name").fill("Thorala Admin Renamed");
    await main.page.getByTestId("VA form save").click();
    await main.page.getByTestId("Village admin Thorala").filter({ hasText: "Thorala Admin Renamed" }).waitFor();
  });
  await screenAudit(main.page, S, "Manage Village Admins");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual([...main.page.errors, ...va.page.errors], []));
  await main.ctx.close();
  await va.ctx.close();
});

// ---------------------------------------------------------------- Section 4
await flow("s4", async (env) => {
  const S = "4 Registration";
  await env.ensureVA();
  const { page, ctx } = await phone(env.url);
  const form = async (phone, { consent = true } = {}) => {
    await page.getByTestId("Register firstName").fill("Kishor");
    await page.getByTestId("Register surname").fill("Chudasama");
    await page.getByTestId("Register phone").fill(phone);
    await page.getByTestId("Register village").selectOption("થોરાળા");
    const box = page.getByTestId("Register consent");
    if ((await box.isChecked()) !== consent) await box.click();
    await page.getByTestId("Register submit").click();
  };
  await row(S, "Login", "Log in with a number that is not registered", "'This number is not registered'").run(async () => {
    await loginMobile(page, "9866000000");
    await page.getByTestId("Login error").filter({ hasText: "not registered" }).waitFor();
  });
  await row(S, "Login", "New member? Register", "opens the registration form").run(async () => {
    await page.getByTestId("Go to register").click();
    await waitScreen(page, "register");
    assert.equal(await page.getByText(/Already a member\?/i).count(), 0);
  });
  await row(S, "Register", "Submit without consent", "refused: tick the consent box").run(async () => {
    await form("9833333333", { consent: false });
    await page.getByTestId("Consent error").waitFor();
    await shot(page, "s4-consent");
  });
  await row(S, "Register", "Submit (new number)", "PENDING registration → 'Pending approval' screen, no directory").run(async () => {
    await page.getByTestId("Register consent").click();
    await page.getByTestId("Register submit").click();
    await waitScreen(page, "pending");
    await page.getByTestId("Pending stage").waitFor();
    assert.equal(await page.getByTestId("Directory screen").count(), 0);
    assert.equal(await back(page), false);
    await shot(page, "s4-pending");
  });
  const other = await phone(env.url);
  const tryNumber = async (phone) => {
    await other.page.waitForFunction(() => ["login", "register"].includes(document.querySelector(".app")?.getAttribute("data-screen")));
    if ((await screenOf(other.page)) !== "register") await other.page.getByTestId("Go to register").click();
    await other.page.getByTestId("Register firstName").fill("Some");
    await other.page.getByTestId("Register surname").fill("Person");
    await other.page.getByTestId("Register phone").fill(phone);
    await other.page.getByTestId("Register village").selectOption("થોરાળા");
    if (!(await other.page.getByTestId("Register consent").isChecked())) await other.page.getByTestId("Register consent").click();
    await other.page.getByTestId("Register submit").click();
    return other.page.getByTestId("Register status");
  };
  await row(S, "Register", "Submit (PENDING number)", "'Your registration is waiting for approval.'").run(async () => {
    await (await tryNumber("9833333333")).filter({ hasText: "waiting for approval" }).waitFor();
  });
  await env.approvedMember("9844444444");
  await row(S, "Register", "Submit (APPROVED number)", "'already a member. Please log in.' + Go to Login (no Forgot PIN)").run(async () => {
    await (await tryNumber("9844444444")).filter({ hasText: "already a member. Please log in." }).waitFor();
    assert.equal(await other.page.getByTestId("Status forgot PIN").count(), 0);
    await other.page.getByTestId("Status go to login").click();
    await waitScreen(other.page, "login");
    assert.equal(await other.page.getByTestId("Login mobile").inputValue(), "9844444444");
  });
  await row(S, "Login (another phone)", "Log in with an approved number", "lands in the directory: no PIN, on any phone").run(async () => {
    await other.page.getByTestId("Login submit").click();
    await waitScreen(other.page, "directory");
  });
  await signOut(other.page);
  await row(S, "Login", "Log in with the PENDING number", "'waiting for approval'").run(async () => {
    await loginMobile(other.page, "9833333333");
    await other.page.getByTestId("Login error").filter({ hasText: "waiting for approval" }).waitFor();
  });
  // A rejected and a removed number.
  const rej = env.client();
  const r = await rej("enrollment", { firstName: "Rej", surname: "Ected", phone: "9855555555", village: "થોરાળા", consent: true });
  await env.admin("admin/requests/" + r.myRequest.id + "/reject", { reason: "Not known here" });
  await other.page.getByTestId("Go to register").click();
  await row(S, "Register", "Submit (REJECTED number)", "'Your registration was not approved. Contact your village admin.'").run(async () => {
    await (await tryNumber("9855555555")).filter({ hasText: "was not approved" }).waitFor();
  });
  const removedId = env.store.all("members").find((m) => m.phone === "9844444444").id;
  await env.admin("admin/members/" + removedId + "/delete", {});
  await row(S, "Register", "Submit (REMOVED number)", "'This number was removed. Contact your village admin.'").run(async () => {
    await (await tryNumber("9844444444")).filter({ hasText: "was removed" }).waitFor();
  });
  await row(S, "Pending", "(after approval)", "logs in by itself and opens the directory — nothing to type").run(async () => {
    const req = env.store.all("requests").find((x) => x.payload.phone === "9833333333");
    const va = await env.ensureVA();
    await va.client("village/requests/" + req.id + "/forward", { identityConfirmed: true });
    await env.admin("admin/requests/" + req.id + "/approve", {});
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForFunction(() => document.querySelector(".app")?.getAttribute("data-screen") === "directory", null, { timeout: 15000 });
    await toast(page, "approved");
    assert.ok((await page.getByTestId("Contact row").count()) >= 1);
    await shot(page, "s4-auto-login");
  });
  await screenAudit(other.page, S, "Register");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual([...page.errors, ...other.page.errors], []));
  await ctx.close();
  await other.ctx.close();
});

// ---------------------------------------------------------------- Section 5
await flow("s5", async (env) => {
  const S = "5 Optional PIN lock";
  await env.approvedMember("9866666666", "થોરાળા", "Lock Member");
  const { page, ctx } = await phone(env.url);
  await row(S, "Login", "Log in (member)", "no PIN to set; straight to the directory").run(async () => {
    await loginMobile(page, "9866666666");
    await waitScreen(page, "directory");
  });
  const profile = async () => {
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "profile");
  };
  await row(S, "My Profile", "Lock this app with a PIN (default)", "OFF and available; reload opens directly").run(async () => {
    await profile();
    const sw = page.getByTestId("Profile PIN lock");
    assert.equal(await sw.getAttribute("aria-checked"), "false");
    assert.ok(await sw.isEnabled(), "not greyed out");
    await shot(page, "s5-profile-lock-off");
    await page.reload();
    await waitScreen(page, "directory");
  });
  await row(S, "Directory", "(2 minutes in the background)", "never locks and never hides while the lock is off").run(async () => {
    await backgroundFor(page, 120000);
    await page.waitForTimeout(600);
    await restoreClock(page);
    assert.equal(await screenOf(page), "directory");
    assert.ok((await page.getByTestId("Contact row").count()) >= 1);
  });
  await row(S, "My Profile", "Lock this app with a PIN → ON (bad entries)", "needs 4 digits twice").run(async () => {
    await profile();
    await page.getByTestId("Profile PIN lock").click();
    await page.getByTestId("Lock PIN dialog").waitFor();
    await page.getByTestId("Lock pin").fill("12");
    await page.getByTestId("Lock pin confirm").fill("12");
    await page.getByTestId("Lock pin save").click();
    await page.getByTestId("Lock pin error").filter({ hasText: "exactly 4 digits" }).waitFor();
    await page.getByTestId("Lock pin").fill("1111");
    await page.getByTestId("Lock pin confirm").fill("2222");
    await page.getByTestId("Lock pin save").click();
    await page.getByTestId("Lock pin error").filter({ hasText: "do not match" }).waitFor();
  });
  await row(S, "My Profile", "Lock this app with a PIN → ON (1111)", "any 4 digits; switch on; no lock yet").run(async () => {
    await page.getByTestId("Lock pin confirm").fill("1111");
    await page.getByTestId("Lock pin save").click();
    await toast(page, "PIN lock is on");
    assert.equal(await page.getByTestId("Profile PIN lock").getAttribute("aria-checked"), "true");
    await page.getByTestId("Profile change lock PIN").waitFor();
    assert.equal(await screenOf(page), "profile");
    await shot(page, "s5-profile-lock-on");
  });
  await row(S, "App start", "(reopen the app)", "asks for the PIN; no contacts behind the lock").run(async () => {
    await page.reload();
    await waitScreen(page, "lock");
    assert.equal(await page.getByTestId("Contact row").count(), 0);
    await shot(page, "s5-lock");
  });
  await row(S, "Lock", "Unlock (wrong PIN ×6)", "'Wrong PIN' each time; never locked out").run(async () => {
    for (let i = 0; i < 6; i++) {
      await page.getByTestId("Unlock secret").fill("1470");
      await page.getByTestId("Unlock error").filter({ hasText: "Wrong PIN" }).waitFor();
      await page.getByTestId("Unlock secret").fill("");
    }
    assert.ok(await page.getByTestId("Unlock submit").isEnabled());
  });
  await row(S, "Lock", "Unlock (right PIN)", "opens the directory").run(async () => {
    await page.getByTestId("Unlock secret").fill("1111");
    await waitScreen(page, "directory");
  });
  await row(S, "Directory", "(1 minute in the background)", "locks when the app returns").run(async () => {
    const session = env.store.all("sessions").find((x) => x.auth && env.store.get("members", x.auth.memberId)?.phone === "9866666666");
    await backgroundFor(page, 61000);
    session.lock.hiddenAt = Date.now() - 61000;
    env.store.put("sessions", session);
    await waitScreen(page, "lock");
    await restoreClock(page);
    await page.getByTestId("Unlock secret").fill("1111");
    await waitScreen(page, "directory");
  });
  await row(S, "Lock", "Forgot PIN? Sign out", "signs out; logging in again removes the lock (no admin needed)").run(async () => {
    await page.reload();
    await waitScreen(page, "lock");
    await page.getByTestId("Lock forgot").click();
    await page.getByTestId("Confirm yes").click();
    await waitScreen(page, "login");
    await loginMobile(page, "9866666666");
    await waitScreen(page, "directory");
    await profile();
    assert.equal(await page.getByTestId("Profile PIN lock").getAttribute("aria-checked"), "false");
  });
  await row(S, "My Profile", "Lock this app with a PIN → OFF", "turns off with one tap").run(async () => {
    await page.getByTestId("Profile PIN lock").click();
    await page.getByTestId("Lock pin").fill("2580");
    await page.getByTestId("Lock pin confirm").fill("2580");
    await page.getByTestId("Lock pin save").click();
    await toast(page, "PIN lock is on");
    await page.getByTestId("Profile PIN lock").click();
    await toast(page, "PIN lock is off");
    await page.reload();
    await waitScreen(page, "directory");
  });
  await row(S, "My Profile (admin)", "Lock this app with a PIN", "NOT forced for the Main Admin: off, can be switched, never auto-locks").run(async () => {
    const admin = await phone(env.url);
    await loginMain(admin.page);
    await waitScreen(admin.page, "directory");
    await admin.page.getByTestId("Profile and settings").click();
    await waitScreen(admin.page, "profile");
    const sw = admin.page.getByTestId("Profile PIN lock");
    assert.equal(await sw.getAttribute("aria-checked"), "false");
    assert.ok(await sw.isEnabled());
    await admin.page.reload();
    await waitScreen(admin.page, "directory");
    await backgroundFor(admin.page, 300000);
    await admin.page.waitForTimeout(500);
    assert.equal(await screenOf(admin.page), "directory");
    await admin.ctx.close();
  });
  await profile();
  await screenAudit(page, S, "My Profile");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- Section 6
await flow("s6", async (env) => {
  const S = "6 Change feedback";
  const passwords = { en: [MAIN.password, "abcd"], gu: ["abcd", MAIN.password] };
  for (const lang of ["en", "gu"]) {
    const [current, next] = passwords[lang];
    const { page, ctx } = await phone(env.url, { lang });
    await loginMain(page, current);
    await waitScreen(page, "directory");
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "profile");
    await page.getByTestId("Profile change password").click();
    const dialog = page.getByTestId("Change Password dialog");
    const cases = [
      ["wrong old password", ["Nope@1234", "xyz9", "xyz9"], { en: "The old password is wrong.", gu: "જૂનો પાસવર્ડ ખોટો છે." }, "current"],
      ["new passwords differ", [current, "xyz9", "xyz8"], { en: "do not match", gu: "એકસરખા નથી" }, "confirm"],
      ["new same as old", [current, current, current], { en: "same as the old password", gu: "જૂના પાસવર્ડ જેવો" }, "next"],
      ["password shorter than 4", [current, "xy9", "xy9"], { en: "at least 4 characters", gu: "ઓછામાં ઓછો ૪ અક્ષરનો" }, "next"],
    ];
    for (const [label, [a, b, c], message, field] of cases)
      await row(S, "Change Password dialog (" + lang + ")", "Change (" + label + ")", "message shown, field highlighted, dialog open, typing kept").run(async () => {
        await page.getByTestId("Change current").fill(a);
        await page.getByTestId("Change next").fill(b);
        await page.getByTestId("Change confirm").fill(c);
        await page.getByTestId("Change submit").click();
        await page.getByTestId("Change error").filter({ hasText: message[lang] }).waitFor();
        assert.equal(await page.getByTestId("Change " + field).getAttribute("aria-invalid"), "true");
        assert.ok(await dialog.isVisible());
        assert.equal(await page.getByTestId("Change next").inputValue(), b);
      });
    await row(S, "Change Password dialog (" + lang + ")", "Change (network error)", "network message, dialog stays open").run(async () => {
      await page.getByTestId("Change current").fill(current);
      await page.getByTestId("Change next").fill(next);
      await page.getByTestId("Change confirm").fill(next);
      await ctx.setOffline(true);
      await page.getByTestId("Change submit").click();
      await page.getByTestId("Change error").filter({ hasText: lang === "en" ? "No internet" : "ઇન્ટરનેટ નથી" }).waitFor();
      await ctx.setOffline(false);
      assert.ok(await dialog.isVisible());
    });
    await row(S, "Change Password dialog (" + lang + ")", "Change (valid)", lang === "en" ? "'Password changed successfully', dialog closes" : "'પાસવર્ડ સફળતાપૂર્વક બદલાયો', dialog closes").run(async () => {
      await page.getByTestId("Change submit").click();
      await toast(page, lang === "en" ? "Password changed successfully" : "પાસવર્ડ સફળતાપૂર્વક બદલાયો");
      await dialog.waitFor({ state: "detached" });
    });
    if (lang === "en") await screenAudit(page, S, "My Profile (after password change)");
    await row(S, "(all screens)", "(browser console, " + lang + ")", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
    await ctx.close();
  }
});

// ---------------------------------------------------------------- Section 7
await flow("s7", async (env) => {
  const S = "7 Navigation";
  env.seedMembers(3);
  const { page, ctx } = await phone(env.url);
  await loginMain(page);
  await waitScreen(page, "directory");
  await page.getByTestId("Admin").click();
  await waitScreen(page, "admin");
  await row(S, "Admin → Total members → village list", "Edit member", "opens the edit form").run(async () => {
    await page.getByRole("button", { name: /Total members/ }).first().click();
    await page.getByRole("button", { name: /Thorala/ }).first().click();
    await page.getByTestId("Edit").first().click();
    await waitScreen(page, "adminedit");
  });
  await row(S, "Edit member", "Back with unsaved changes", "asks 'Discard changes?'").run(async () => {
    await page.getByTestId("Edit currentLocation").fill("Surat");
    await back(page);
    await page.getByTestId("Discard changes").waitFor();
    await page.getByTestId("Confirm no").click();
    assert.equal(await screenOf(page), "adminedit");
  });
  await row(S, "Edit member", "Save", "returns to the member list, refreshed, with 'Saved'").run(async () => {
    await page.getByTestId("Edit save").click();
    await waitScreen(page, "admin");
    await toast(page, "Saved");
    await page.getByText(/Back to village list/).waitFor();
    assert.ok(env.store.all("members").some((m) => m.currentLocation === "Surat"));
  });
  await row(S, "Edit member", "Back with unsaved changes → Discard", "returns to the list without saving").run(async () => {
    await page.getByTestId("Edit").first().click();
    await waitScreen(page, "adminedit");
    await page.getByTestId("Edit currentLocation").fill("Rajkot");
    await page.getByTestId("Back").click();
    await page.getByTestId("Confirm yes").click();
    await waitScreen(page, "admin");
    assert.ok(!env.store.all("members").some((m) => m.currentLocation === "Rajkot"));
  });
  await row(S, "Admin dashboard", "Back ×3", "village list → dashboard home → Member Directory").run(async () => {
    await back(page);
    await back(page);
    await back(page);
    await waitScreen(page, "directory");
  });
  // Member: profile → settings stack.
  await env.approvedMember("9888888888", "થોરાળા", "Nav Member");
  const m = await phone(env.url);
  await loginMobile(m.page, "9888888888");
  await waitScreen(m.page, "directory");
  await row(S, "Directory (member)", "My Profile → Settings → Back → Back", "profile → settings → profile → directory").run(async () => {
    await m.page.getByTestId("Profile and settings").click();
    await waitScreen(m.page, "profile");
    await m.page.getByTestId("Profile settings").click();
    await waitScreen(m.page, "settings");
    await back(m.page);
    await waitScreen(m.page, "profile");
    await back(m.page);
    await waitScreen(m.page, "directory");
  });
  await row(S, "My Profile (member)", "Request profile change → Send for approval", "change request sent; back on My Profile").run(async () => {
    await m.page.getByTestId("Profile and settings").click();
    await m.page.getByTestId("Profile request change").click();
    await waitScreen(m.page, "edit");
    await m.page.getByTestId("Edit currentLocation").fill("Ahmedabad");
    await m.page.getByTestId("Edit save").click();
    await waitScreen(m.page, "profile");
    await toast(m.page, "Change request sent");
    await m.page.getByText("Your change request is waiting for approval.").first().waitFor();
  });
  await row(S, "My Profile (member)", "Request removal", "confirm → 'Removal request sent'").run(async () => {
    await m.page.getByTestId("Profile request removal").click();
    await m.page.getByTestId("Confirm yes").click();
    await toast(m.page, "Removal request sent");
  });
  await row(S, "Directory (member)", "Admin icon", "not shown to members").run(async () => {
    await back(m.page);
    assert.equal(await m.page.getByTestId("Admin").count(), 0);
  });
  await row(S, "Settings (member)", "Sign out of this phone", "Login screen; Back leaves the app (never back to the directory)").run(async () => {
    await signOut(m.page);
    assert.equal(await back(m.page), false);
    assert.equal(await m.page.getByTestId("Contact row").count(), 0);
  });
  await row(S, "Login → Register", "Back", "returns to Login").run(async () => {
    await m.page.getByTestId("Go to register").click();
    await waitScreen(m.page, "register");
    await back(m.page);
    await waitScreen(m.page, "login");
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual([...page.errors, ...m.page.errors], []));
  await ctx.close();
  await m.ctx.close();
});

// ---------------------------------------------------------------- Section 8
await flow("s8", async (env) => {
  const S = "8 Directory";
  env.seedMembers(20);
  env.seedMembers(4, "સથરા");
  await env.ensureVA("થોરાળા", "9800000010");
  await env.approvedMember("9899999999", "થોરાળા", "Directory Member");
  const { page, ctx } = await phone(env.url);
  await loginMobile(page, "9899999999");
  await waitScreen(page, "directory");
  await row(S, "Directory", "(header)", "line 1: logo + community name + search box + search button; line 2: icons; line 3: All + villages").run(async () => {
    const box = async (sel) => (await page.locator(sel).first().boundingBox());
    const logo = await box(".alpha-dirlogo");
    const name = await box('[data-testid="Community name"]');
    const input = await box('[data-testid="Search input"]');
    const button = await box('[data-testid="Search"]');
    const icons = await box(".alpha-diricons");
    const chips = await box('[data-testid="Village chips"]');
    const firstRow = await box(".alpha-row");
    assert.ok(logo.width <= 40, "small logo " + logo.width);
    assert.equal((await page.getByTestId("Community name").innerText()).trim(), "Mahuva Kshatriya Rajput Samaj");
    const mid = (b) => b.y + b.height / 2;
    for (const b of [name, input, button]) assert.ok(Math.abs(mid(b) - mid(logo)) < 14, "line 1 aligned");
    assert.ok(logo.x < name.x && name.x < input.x && input.x < button.x, "line 1 order: logo, name, search box, button");
    assert.ok(icons.y > logo.y + logo.height - 2, "icons are on line 2");
    assert.ok(chips.y >= icons.y + icons.height - 2, "villages are on line 3");
    assert.ok(firstRow.y >= chips.y + chips.height - 2, "members below");
    await shot(page, "s8-directory-header");
  });
  await row(S, "Directory", "(line 2 icons)", "Filter, My Profile, Dark theme, Language in that order").run(async () => {
    const ids = await page.locator(".alpha-diricons button").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    assert.deepEqual(ids, ["Village filter", "Profile and settings", "Theme toggle", "Language toggle"]);
  });
  await row(S, "Directory", "(line 3 chips)", "'All' first, then the villages").run(async () => {
    const chips = await page.locator('[data-testid="Village chips"] button').evaluateAll((els) => els.map((e) => e.textContent.trim()));
    assert.equal(chips[0], "All");
    assert.deepEqual(chips.slice(1), ["Thorala", "Sathra", ...chips.slice(3)].slice(0, chips.length - 1).map((x, i) => chips[i + 1]));
    assert.equal(chips.length, 8);
  });
  await row(S, "Directory", "(layout on a 6-inch phone, 360×728)", "at least 7 contacts fully visible").run(async () => {
    const visible = await page.evaluate(() => {
      const list = document.querySelector(".alpha-list").getBoundingClientRect();
      return [...document.querySelectorAll(".alpha-row")].filter((r) => {
        const b = r.getBoundingClientRect();
        return b.top >= list.top - 1 && b.bottom <= Math.min(list.bottom, window.innerHeight) + 1;
      }).length;
    });
    assert.ok(visible >= 7, visible + " rows");
    const height = await page.locator(".alpha-row").first().evaluate((el) => el.getBoundingClientRect().height);
    assert.ok(height >= 60 && height <= 70, "row " + height + "px");
    await shot(page, "s8-directory");
    return visible + " rows visible, rows " + Math.round(height) + " px";
  });
  await row(S, "Directory", "Names: own GREEN, admins RED, no 'You'", "colours as requested").run(async () => {
    const me = page.locator('.alpha-row-name[data-role="me"]');
    assert.equal(await me.count(), 1);
    assert.equal(await me.evaluate((el) => getComputedStyle(el).color), "rgb(23, 105, 47)");
    const admins = page.locator('.alpha-row-name[data-role="admin"]');
    assert.ok((await admins.count()) >= 2, "Main Admin and the Village Admin");
    for (const c of await admins.evaluateAll((els) => els.map((el) => getComputedStyle(el).color))) assert.equal(c, "rgb(198, 40, 40)");
    const plain = await page.locator(".alpha-row-name:not([data-role])").first().evaluate((el) => getComputedStyle(el).color);
    assert.notEqual(plain, "rgb(198, 40, 40)");
    assert.equal(await page.locator(".alpha-list").getByText(/\bYou\b|તમે/).count(), 0, "no 'You'");
    // The names really are the admins'.
    const adminNames = await admins.allInnerTexts();
    assert.ok(adminNames.some((n) => n.includes("Test Main Admin")) && adminNames.some((n) => n.includes("Village Admin 10")), adminNames.join(","));
  });
  await row(S, "Directory", "Search box (always visible)", "no search icon to open first").run(async () => {
    await page.getByTestId("Search input").waitFor();
    await page.getByTestId("Search input").fill("Se");
    await page.getByTestId("Directory count").filter({ hasText: "at least 3" }).waitFor();
  });
  await row(S, "Search", "Name (3+ letters)", "matching names").run(async () => {
    await page.getByTestId("Search input").fill("Direct");
    await page.getByTestId("Directory count").filter({ hasText: "1 found" }).waitFor();
  });
  await row(S, "Search", "Mobile digits", "matching numbers").run(async () => {
    await page.getByTestId("Search input").fill("97000");
    const text = await page.getByTestId("Directory count").innerText();
    assert.match(text, /\d+ found/);
    assert.ok(Number(text.match(/\d+/)[0]) >= 10);
  });
  await row(S, "Search", "Village (English and Gujarati)", "members of that village").run(async () => {
    await page.getByTestId("Search input").fill("Sathra");
    await page.getByTestId("Directory count").filter({ hasText: "4 found" }).waitFor();
    await page.getByTestId("Search input").fill("સથરા");
    await page.getByTestId("Directory count").filter({ hasText: "4 found" }).waitFor();
  });
  await row(S, "Search", "Taluka / district", "everyone in Mahuva / Bhavnagar").run(async () => {
    await page.getByTestId("Search input").fill("Mahuva");
    const n = Number((await page.getByTestId("Directory count").innerText()).match(/\d+/)[0]);
    assert.ok(n >= 25, String(n));
  });
  await row(S, "Search", "Search button", "closes the keyboard; results stay").run(async () => {
    await page.getByTestId("Search input").fill("Direct");
    await page.getByTestId("Search").click();
    assert.notEqual(await page.evaluate(() => document.activeElement?.dataset?.testid || ""), "Search input");
    await page.getByTestId("Directory count").filter({ hasText: "1 found" }).waitFor();
  });
  await row(S, "Search", "Clear the box", "everyone is listed again").run(async () => {
    await page.getByTestId("Search input").fill("");
    await page.getByTestId("Directory count").filter({ hasText: /members/ }).waitFor();
  });
  await row(S, "Directory", "Filter icon / chips", "chips filter by village; the icon hides / shows the bar").run(async () => {
    await page.getByTestId("Chip Sathra").click();
    await page.getByTestId("Directory count").filter({ hasText: "4 members" }).waitFor();
    await back(page);
    await page.getByTestId("Village filter").click();
    await page.getByTestId("Village chips").waitFor({ state: "detached" });
    await page.getByTestId("Village filter").click();
    await page.getByTestId("Village chips").waitFor();
  });
  await row(S, "Directory", "Dark theme icon", "switches to dark and back, remembered").run(async () => {
    await page.getByTestId("Theme toggle").click();
    await page.locator('.app[data-theme="dark"]').waitFor();
    await shot(page, "s8-dark");
    const admin = await page.locator('.alpha-row-name[data-role="admin"]').first().evaluate((el) => getComputedStyle(el).color);
    assert.notEqual(admin, "rgb(198, 40, 40)", "lighter red on dark");
    await page.getByTestId("Theme toggle").click();
    await page.locator('.app[data-theme="light"], .app:not([data-theme="dark"])').first().waitFor();
    assert.equal(await page.locator('.app[data-theme="dark"]').count(), 0);
  });
  await row(S, "Directory", "Language icon", "switches Gujarati ↔ English").run(async () => {
    await page.getByTestId("Language toggle").click();
    await page.locator("html[lang=gu]").waitFor();
    assert.equal((await page.getByTestId("Community name").innerText()).trim(), "મહુવા ક્ષત્રિય રાજપૂત સમાજ");
    await page.getByTestId("Language toggle").click();
    await page.locator("html[lang=en]").waitFor();
  });
  await row(S, "Contact row", "Call icon", "opens the phone dialler (tel:+91…)").run(async () => {
    const href = await page.getByTestId("Call").first().getAttribute("href");
    assert.match(href, /^tel:\+91[6-9]\d{9}$/);
  });
  await row(S, "Contact row", "WhatsApp icon", "opens WhatsApp (wa.me/91…)").run(async () => {
    const href = await page.getByTestId("WhatsApp").first().getAttribute("href");
    assert.match(href, /^https:\/\/wa\.me\/91[6-9]\d{9}$/);
  });
  await row(S, "Contact row", "Tap the row", "full details sheet; Back closes it").run(async () => {
    await page.locator(".alpha-row-main").first().click();
    await page.getByTestId("Contact details").waitFor();
    await shot(page, "s8-contact");
    await back(page);
    await page.getByTestId("Contact details").waitFor({ state: "detached" });
  });
  await row(S, "Directory", "My Profile icon", "opens My Profile; Settings is reached from there").run(async () => {
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "profile");
    await shot(page, "s8-profile");
    for (const id of ["Profile PIN lock", "Profile settings", "Profile request change", "Profile request removal"]) await page.getByTestId(id).waitFor();
    await page.getByTestId("Profile settings").click();
    await waitScreen(page, "settings");
  });
  await row(S, "Settings", "(contents)", "profile, requests, text size + Reset, notifications, admins, sign out — no language, no theme, no PIN").run(async () => {
    for (const id of ["Settings my profile", "Settings request change", "Settings request removal", "Settings text size", "Settings text size reset", "Settings all admins", "Sign out of this phone"])
      await page.getByTestId(id).waitFor();
    for (const id of ["Settings Gujarati", "Settings English", "Settings light", "Settings dark", "Settings app lock", "Settings change PIN"])
      assert.equal(await page.getByTestId(id).count(), 0, id + " was removed");
    await shot(page, "s8-settings");
  });
  await row(S, "Settings", "Text size → Reset", "back to 100%").run(async () => {
    const slider = page.getByTestId("Settings text size");
    await slider.fill("140");
    await page.locator(".alpha-range output").filter({ hasText: "140%" }).waitFor();
    await page.getByTestId("Settings text size reset").click();
    await page.locator(".alpha-range output").filter({ hasText: "100%" }).waitFor();
    await toast(page, "Text size reset to 100%");
    assert.ok(await page.getByTestId("Settings text size reset").isDisabled());
    await back(page);
    await back(page);
  });
  await screenAudit(page, S, "Directory");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
  // The Main Admin also sees the Admin Tools icon between My Profile and Dark theme.
  const a = await phone(env.url);
  await loginMain(a.page);
  await waitScreen(a.page, "directory");
  await row(S, "Directory (Main Admin)", "(line 2 icons)", "Filter, My Profile, Admin Tools, Dark theme, Language").run(async () => {
    const ids = await a.page.locator(".alpha-diricons button").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    assert.deepEqual(ids, ["Village filter", "Profile and settings", "Admin", "Theme toggle", "Language toggle"]);
    const admin = await a.page.locator('.alpha-row-name[data-role="me"]').count();
    assert.equal(admin, 1, "own name (even as admin) is the green one");
  });
  await a.ctx.close();
});

// ---------------------------------------------------------------- Section 1
await flow("s1", async (env) => {
  const S = "1 Server & offline";
  env.seedMembers(5);
  await env.approvedMember("9812121212", "થોરાળા", "Offline Member");
  const { page, ctx } = await phone(env.url);
  await loginMobile(page, "9812121212");
  await waitScreen(page, "directory");
  await page.waitForFunction(() => navigator.serviceWorker?.controller || false, null, { timeout: 10000 }).catch(() => {});
  await page.reload();
  await waitScreen(page, "directory");
  await row(S, "(whole app)", "Server button / server address", "nowhere in the app").run(async () => {
    const html = await page.content();
    assert.equal(/Change test server|>Server<|10\.0\.2\.2/.test(html), false);
  });
  await row(S, "Directory", "(airplane mode)", "'No internet / Server not reachable — Retry' with 'Last updated'").run(async () => {
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.getByTestId("Offline banner").waitFor({ timeout: 15000 });
    await page.getByTestId("Last updated").waitFor();
    assert.ok((await page.getByTestId("Contact row").count()) >= 6, "contacts still visible");
    await shot(page, "s1-offline");
  });
  await row(S, "Directory (offline)", "Call / WhatsApp", "still available from the saved copy").run(async () => {
    assert.match(await page.getByTestId("Call").first().getAttribute("href"), /^tel:/);
  });
  await row(S, "(app restarted offline)", "(open app)", "opens without crashing; saved directory shown").run(async () => {
    await page.reload().catch(() => {});
    await waitScreen(page, "directory");
    await page.getByTestId("Offline banner").waitFor();
    assert.ok((await page.getByTestId("Contact row").count()) >= 6);
  });
  await row(S, "Directory (back online)", "Retry", "directory loads without restarting the app").run(async () => {
    env.seedMembers(1, "તરેડી");
    await ctx.setOffline(false);
    await page.getByTestId("Offline banner").click({ timeout: 3000 }).catch(() => {});
    await page.getByTestId("Offline banner").waitFor({ state: "detached", timeout: 15000 });
    await page.getByText("SeedA Member0").first().waitFor();
    const n = await page.getByTestId("Contact row").count();
    assert.ok(n >= 8, String(n));
  });
  await row(S, "Lock (offline)", "Unlock with PIN without internet", "opens the saved directory; wrong PIN refused").run(async () => {
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "profile");
    await page.getByTestId("Profile PIN lock").click();
    await page.getByTestId("Lock pin").fill("3691");
    await page.getByTestId("Lock pin confirm").fill("3691");
    await page.getByTestId("Lock pin save").click();
    await toast(page, "PIN lock is on");
    await back(page);
    await ctx.setOffline(true);
    await page.reload().catch(() => {});
    // Offline start from the saved copy is slower when the machine is busy.
    await waitScreen(page, "lock", 25000);
    await page.getByText("Offline: opens with the PIN saved on this phone.").waitFor();
    await page.getByTestId("Unlock secret").fill("1470");
    await page.getByTestId("Unlock error").filter({ hasText: "Wrong PIN" }).waitFor();
    await page.getByTestId("Unlock secret").fill("3691");
    await waitScreen(page, "directory");
    assert.ok((await page.getByTestId("Contact row").count()) >= 6);
    await ctx.setOffline(false);
    await page.getByTestId("Offline banner").click({ timeout: 3000 }).catch(() => {});
    await page.getByTestId("Offline banner").waitFor({ state: "detached", timeout: 15000 });
  });
  await row(S, "Settings", "Sign out of this phone", "the saved copy is wiped from the phone").run(async () => {
    await signOut(page);
    assert.equal(await page.evaluate(() => localStorage.getItem("mvpmi.offline.v1")), null);
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- Section 9
await flow("s9", async (env) => {
  const S = "9 Audit";
  env.seedMembers(4);
  await env.approvedMember("9813131313", "થોરાળા", "Audit Member");
  const { page, ctx } = await phone(env.url, { lang: "gu" });
  const checkLang = async (screen, gu, en, goto) => {
    await row(S, screen, "Language Gujarati ↔ English", "every text switches").run(async () => {
      await page.locator("html[lang=gu]").waitFor();
      await page.getByText(gu, { exact: false }).first().waitFor();
      await goto("en");
      await page.locator("html[lang=en]").waitFor();
      await page.getByText(en, { exact: false }).first().waitFor();
      await goto("gu");
      await page.locator("html[lang=gu]").waitFor();
    });
  };
  const viaLoginSwitch = async (l) => page.getByTestId(l === "en" ? "Language English" : "Language Gujarati").click();
  await checkLang("Login", "મોબાઇલ નંબર", "Mobile number", viaLoginSwitch);
  await page.getByTestId("Go to register").click();
  await waitScreen(page, "register");
  await checkLang("Register", "નોંધણી", "Register", async (l) => {
    await back(page);
    await viaLoginSwitch(l);
    await page.getByTestId("Go to register").click();
  });
  await back(page);
  await loginMobile(page, "9813131313");
  await waitScreen(page, "directory");
  const viaIcon = async () => page.getByTestId("Language toggle").click();
  await checkLang("Directory", "મહુવા ક્ષત્રિય રાજપૂત સમાજ", "Mahuva Kshatriya Rajput Samaj", async () => viaIcon());
  await page.getByTestId("Profile and settings").click();
  await waitScreen(page, "profile");
  const viaDirectory = async () => {
    await back(page);
    await viaIcon();
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "profile");
  };
  await checkLang("My Profile", "મારી પ્રોફાઇલ", "My Profile", viaDirectory);
  await page.getByTestId("Profile settings").click();
  await waitScreen(page, "settings");
  await checkLang("Settings", "સેટિંગ્સ", "Settings", async () => {
    await back(page);
    await back(page);
    await viaIcon();
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "profile");
    await page.getByTestId("Profile settings").click();
    await waitScreen(page, "settings");
  });
  await row(S, "Every alpha screen", "(rotation to landscape and back)", "no crash, no sideways scrolling").run(async () => {
    for (const screen of ["settings", "profile", "directory"]) {
      if ((await screenOf(page)) !== screen) await back(page);
      await waitScreen(page, screen);
      await page.setViewportSize({ width: 728, height: 360 });
      await page.waitForTimeout(200);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, screen + " overflow " + over);
      await page.setViewportSize(PHONE);
      await page.waitForTimeout(200);
      assert.equal(await screenOf(page), screen);
    }
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
  // Admin screens at landscape.
  const a = await phone(env.url);
  await loginMain(a.page);
  await waitScreen(a.page, "directory");
  await a.page.getByTestId("Admin").click();
  await waitScreen(a.page, "admin");
  await row(S, "Admin dashboard", "(rotation to landscape and back)", "no crash, same screen").run(async () => {
    await a.page.setViewportSize({ width: 728, height: 360 });
    await a.page.waitForTimeout(200);
    await a.page.setViewportSize(PHONE);
    assert.equal(await screenOf(a.page), "admin");
  });
  await screenAudit(a.page, S, "Admin dashboard");
  await a.ctx.close();
});

// --------------------------------------------------------------- Section 10
// The Main Admin's approval flow: why it cannot be finished is always shown,
// at the very top of the screen.
await flow("s10", async (env) => {
  const S = "10 Approval errors";
  const va = await env.ensureVA("થોરાળા", "9800000010");
  const applicant = env.client();
  const applied = await applicant("enrollment", { firstName: "Ramesh", surname: "Vala", phone: "9811111111", village: "થોરાળા", consent: true });
  const { page, ctx } = await phone(env.url);
  await loginMain(page);
  await waitScreen(page, "directory");
  await page.getByTestId("Admin").click();
  await waitScreen(page, "admin");
  const banner = () => page.getByTestId("Error banner");
  const atTop = async () => {
    const box = await banner().boundingBox();
    assert.ok(box && box.y <= 1, "banner sits at the top: " + JSON.stringify(box));
    assert.ok(box.width >= 340, "banner is full width");
  };
  await row(S, "Admin dashboard", "Approve a request the Village Admin has not verified", "review panel opens and a top banner names the Village Admin to call").run(async () => {
    await page.getByRole("button", { name: /(^|\s)Requests\b/ }).filter({ hasText: "removals" }).first().click();
    await page.locator('[data-glass="1"]', { hasText: "Ramesh Vala" }).getByRole("button", { name: /Approve/ }).click();
    await banner().waitFor();
    await atTop();
    const text = await page.getByTestId("Error banner message").innerText();
    assert.ok(text.includes("Village Admin 10") && text.includes("9800000010") && /verify/i.test(text), text);
    await page.locator(".workflow-panel").waitFor();
    await shot(page, "s10-banner");
  });
  await row(S, "Review panel", "(Final approval is off)", "the reason is written next to the button, with a Call link").run(async () => {
    const why = page.getByTestId("Approval blockers");
    await why.waitFor();
    const text = await why.innerText();
    assert.ok(/Village Admin must verify/.test(text) && /independently confirmed/.test(text), text);
    assert.equal(await page.getByTestId("Call village admin").getAttribute("href"), "tel:+919800000010");
    assert.ok(await page.getByTestId("Final approval").isDisabled());
  });
  await row(S, "Error banner", "Dismiss", "closes").run(async () => {
    await page.getByTestId("Error banner close").click();
    await banner().waitFor({ state: "detached" });
  });
  await row(S, "Review panel", "Correct details → Save correction (invalid number)", "top banner explains what is wrong; form stays open").run(async () => {
    await page.getByRole("button", { name: "Correct details" }).click();
    await page.getByLabel("Phone number", { exact: true }).fill("123");
    await page.getByTestId("Save correction").click();
    await banner().waitFor();
    await atTop();
    const text = (await page.getByTestId("Error banner message").innerText()) + (await banner().innerText());
    assert.ok(/mobile|phone|number/i.test(text) && /400/.test(text), text);
    assert.ok(await page.getByTestId("Save correction").isVisible(), "the form stays open");
    await shot(page, "s10-save-correction-error");
  });
  await row(S, "Review panel", "Save correction (fixed)", "'Saved', the request shows the corrected details").run(async () => {
    await page.getByLabel("Phone number", { exact: true }).fill("9811111112");
    await page.getByTestId("Save correction").click();
    await toast(page, "Saved");
    await banner().waitFor({ state: "detached" });
    await page.getByText("9811111112").first().waitFor();
    assert.equal(env.store.all("requests").find((r) => r.id === applied.myRequest.id).payload.phone, "9811111112");
  });
  await row(S, "Review panel", "Final approval after the Village Admin forwards", "approved; member can log in with the mobile number").run(async () => {
    await va.client("village/requests/" + applied.myRequest.id + "/forward", { identityConfirmed: true });
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.getByText("Village verified").first().waitFor({ timeout: 15000 });
    await page.locator(".workflow-check input").first().check();
    assert.equal(await page.getByTestId("Approval blockers").count(), 0);
    await page.getByTestId("Final approval").click();
    await toast(page, "Member approved");
    assert.ok(env.store.all("members").some((m) => m.phone === "9811111112"));
    const member = env.client();
    const s = await member("login", { mobile: "9811111112" });
    assert.equal(s.account.role, "MEMBER");
  });
  await row(S, "Review panel", "Any failed action (request already withdrawn)", "top banner with the server's reason").run(async () => {
    const other = env.client();
    const r2 = await other("enrollment", { firstName: "Late", surname: "Comer", phone: "9822222222", village: "થોરાળા", consent: true });
    await va.client("village/requests/" + r2.myRequest.id + "/forward", { identityConfirmed: true });
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.getByText("Late Comer").first().waitFor({ timeout: 15000 });
    await other("enrollment/withdraw", {});
    await page.locator('.workflow-card', { hasText: "Late Comer" }).locator(".workflow-check input").check();
    await page.locator('.workflow-card', { hasText: "Late Comer" }).getByTestId("Final approval").click();
    await banner().waitFor();
    await atTop();
    assert.ok((await page.getByTestId("Error banner message").innerText()).length > 10);
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- 11
// Regressions from the v1.2.0-alpha.1 test report (30 Sep 2026): element
// overlap at every text size (not only page overflow), header, failed
// proposals, Android export path, idle refresh loop, alignment, spacing and
// the English location prefix.
const LONG_EN = ["Bhagirathsinh Jaswantsinh", "Gohilvadiya"];
const LONG_GU = ["ભગીરથસિંહ જસવંતસિંહ", "ગોહિલવાડિયા"];
function seedLong(env) {
  env.store.tx(() => {
    [LONG_EN, LONG_GU, ["Short", "Name"], ["Change", "Target"], ["Removal", "Target"]].forEach(([firstName, surname], i) =>
      env.store.put("members", {
        ...profile({ firstName, surname, phone: String(9710000000 + i), village: "થોરાળા", currentLocation: "Surat" }),
        id: "long-" + i,
        owner: "long-owner-" + i,
        approvedAt: 1,
      }),
    );
  });
}
// Visible overlap (px) between any painted text of a contact row and its
// Call/WhatsApp buttons. Text clipped by an overflow box does not count.
const rowOverlap = (page) =>
  page.evaluate(() => {
    let worst = 0, who = "";
    for (const row of document.querySelectorAll('[data-testid="Contact row"]')) {
      const acts = [...row.querySelectorAll(".alpha-contact-actions a, .alpha-contact-actions button")].map((a) => a.getBoundingClientRect());
      for (const t of row.querySelectorAll(".alpha-row-text *")) {
        if (!t.textContent.trim() || t.children.length) continue;
        const r = t.getBoundingClientRect(), range = document.createRange();
        range.selectNodeContents(t);
        const rr = range.getBoundingClientRect();
        let right = Math.max(r.right, rr.right);
        for (let e = t; e && e !== row; e = e.parentElement) if (getComputedStyle(e).overflowX !== "visible") right = Math.min(right, e.getBoundingClientRect().right);
        for (const a of acts) {
          const x = Math.min(right, a.right) - Math.max(r.left, a.left), y = Math.min(r.bottom, a.bottom) - Math.max(r.top, a.top);
          if (x > 0.5 && y > 0.5 && x > worst) (worst = Math.round(x)), (who = t.textContent.trim().slice(0, 24));
        }
      }
    }
    return { worst, who };
  });
const headerFit = (page) =>
  page.evaluate(() => {
    const i = document.querySelector('[data-testid="Search input"]'), n = document.querySelector('[data-testid="Community name"]');
    const cs = getComputedStyle(i), ph = getComputedStyle(i, "::placeholder");
    const c = document.createElement("canvas").getContext("2d");
    c.font = ph.fontWeight + " " + ph.fontSize + " " + ph.fontFamily;
    return {
      searchW: Math.round(i.getBoundingClientRect().width),
      nameCut: n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1,
      placeholderCut: c.measureText(i.placeholder).width > i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1,
    };
  });
await flow("s11", async (env) => {
  const S = "11 Report fixes";
  seedLong(env);
  const va = await env.ensureVA();
  for (const width of [320, 360, 412])
    for (const lang of ["en", "gu"])
      await row(S, "Directory " + width + " px (" + lang + ")", "Text size 85 / 100 / 135 / 165 %, long names, light + dark", "names never under Call/WhatsApp; header name, search box and placeholder fit").run(async () => {
        const problems = [];
        for (const fsPct of [85, 100, 135, 165]) {
          const theme = fsPct === 165 ? "dark" : "light";
          const ctx = await browser.newContext({ viewport: { width, height: 728 } });
          await ctx.addInitScript((p) => localStorage.setItem("mvpmi-preferences", JSON.stringify(p)), { lang, fsPct, theme });
          const page = await ctx.newPage();
          await page.goto(env.url);
          await loginMobile(page, va.mobile);
          await page.getByTestId("Contact row").nth(4).waitFor();
          const o = await rowOverlap(page), h = await headerFit(page);
          if (o.worst) problems.push(fsPct + "%: '" + o.who + "' under the buttons by " + o.worst + "px");
          if (h.searchW < 96) problems.push(fsPct + "%: search box " + h.searchW + "px");
          if (h.nameCut) problems.push(fsPct + "%: community name cut");
          if (h.placeholderCut) problems.push(fsPct + "%: placeholder cut");
          if (width === 320 && fsPct === 165) await shot(page, "s11-directory-320-165-" + lang);
          await ctx.close();
        }
        assert.deepEqual(problems, []);
      });
  const { ctx, page } = await phone(env.url);
  await loginMobile(page, va.mobile);
  await waitScreen(page, "directory");
  await row(S, "Directory", "Tap the search box", "the community name steps aside; the box gets the whole line").run(async () => {
    const before = (await page.getByTestId("Search input").boundingBox()).width;
    await page.getByTestId("Search input").focus();
    await page.waitForTimeout(150);
    const after = (await page.getByTestId("Search input").boundingBox()).width;
    assert.ok(after > before + 60, before + " -> " + after);
    assert.equal(await page.getByTestId("Community name").isVisible(), false);
    await page.getByTestId("Search input").blur();
    await page.getByTestId("Community name").waitFor();
  });
  await row(S, "Settings", "(labels)", "every label starts at the same place after its icon").run(async () => {
    await openSettings(page);
    const lefts = await page.evaluate(() =>
      [...document.querySelectorAll(".alpha-menu-item > span")].filter((s) => s.getClientRects().length).map((s) => {
        const r = document.createRange();
        r.selectNodeContents(s.firstChild);
        return [getComputedStyle(s).textAlign, Math.round(r.getBoundingClientRect().left)];
      }),
    );
    assert.ok(lefts.length >= 3);
    assert.ok(lefts.every(([a]) => a === "start" || a === "left"), JSON.stringify(lefts));
    assert.equal(new Set(lefts.map(([, x]) => x)).size, 1, JSON.stringify(lefts));
  });
  await row(S, "Settings", "Text size → Reset", "a compact secondary button, still a 48 px target").run(async () => {
    const b = await page.getByTestId("Settings text size reset").evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight, p: el.parentElement.offsetWidth }));
    assert.ok(b.w < b.p * 0.7 && b.h >= 48, JSON.stringify(b));
    await back(page);
    await back(page);
    await waitScreen(page, "directory");
  });
  await row(S, "Review panel (Village Admin)", "(tabs)", "icon beside the label, 48–56 px tall").run(async () => {
    await page.getByTestId("Admin").click();
    await page.locator(".workflow-panel").waitFor();
    // Layout height (offsetHeight): the panel's opening animation scales
    // the on-screen box for a moment on slower machines.
    const hs = await page.locator(".workflow-tabs > button").evaluateAll((bs) => bs.map((b) => b.offsetHeight));
    assert.ok(hs.length && hs.every((h) => h >= 48 && h <= 56), JSON.stringify(hs));
    await shot(page, "s11-workflow-tabs");
  });
  await row(S, "Review panel (idle)", "(1 second, nothing touched)", "no idle refresh loop: the tabs are not rewritten").run(async () => {
    await page.waitForTimeout(1200);
    const n = await page.evaluate(() => new Promise((res) => {
      let n = 0;
      const o = new MutationObserver((l) => (n += l.length));
      o.observe(document.querySelector(".workflow-panel"), { subtree: true, attributes: true, childList: true });
      setTimeout(() => (o.disconnect(), res(n)), 1000);
    }));
    assert.equal(n, 0);
  });
  const card = (name) => page.locator(".workflow-card", { hasText: name });
  const fail503 = () => page.route("**/api/village/members/**", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Server busy, try again" }) }));
  await row(S, "My village members", "(English card)", "location reads 'Location: Surat' (no Gujarati prefix)").run(async () => {
    await page.locator(".workflow-tabs button", { hasText: "My village members" }).click();
    const text = await card("Short Name").innerText();
    assert.ok(text.includes("Location: Surat") && !text.includes("હાલ"), text);
  });
  await row(S, "My village members", "Propose change → Send (server error 503)", "top banner; the form and the typed reason stay").run(async () => {
    await card("Change Target").getByRole("button", { name: "Propose change" }).click();
    await card("Change Target").locator("input").last().fill("Moved to Surat last year");
    await fail503();
    await card("Change Target").getByRole("button", { name: "Send to main administrator" }).click();
    await page.getByTestId("Error banner").waitFor();
    assert.equal(await card("Change Target").getByRole("button", { name: "Send to main administrator" }).count(), 1);
    assert.equal(await card("Change Target").locator("input").last().inputValue(), "Moved to Surat last year");
    await page.unroute("**/api/village/members/**");
    await page.getByTestId("Error banner close").click();
  });
  await row(S, "My village members", "Propose change → Send (server back)", "sent; the form closes; forwarded note shown").run(async () => {
    await card("Change Target").getByRole("button", { name: "Send to main administrator" }).click();
    await card("Change Target").locator(".workflow-forwarded").waitFor();
    assert.equal(await card("Change Target").getByRole("button", { name: "Send to main administrator" }).count(), 0);
  });
  await row(S, "My village members", "Propose removal → Send (server error, then back)", "form and reason kept on error; sent after").run(async () => {
    await card("Removal Target").getByRole("button", { name: "Propose removal" }).click();
    await card("Removal Target").locator("input").last().fill("Asked to be removed");
    await fail503();
    await card("Removal Target").getByRole("button", { name: "Send removal proposal" }).click();
    await page.getByTestId("Error banner").waitFor();
    assert.equal(await card("Removal Target").locator("input").last().inputValue(), "Asked to be removed");
    await page.unroute("**/api/village/members/**");
    await page.getByTestId("Error banner close").click();
    await card("Removal Target").getByRole("button", { name: "Send removal proposal" }).click();
    await card("Removal Target").locator(".workflow-forwarded").waitFor();
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors.filter((e) => !/503/.test(e)), []));
  await ctx.close();
  await row(S, "Login (Android bridge stand-in)", "(first launch, not signed in)", "no notification registration on the Login screen; registers after login").run(async () => {
    const c = await browser.newContext({ viewport: PHONE });
    await c.addInitScript(() => {
      localStorage.setItem("mvpmi-preferences", JSON.stringify({ lang: "en" }));
      window.__registered = [];
      window.mvpmiBridge = { registerDevice: (t) => window.__registered.push(t), pullNow() {}, saveFile() {}, printHtml() {}, notify() {}, setScreenPrivacy() {}, biometricAvailable: () => false };
    });
    const p = await c.newPage();
    await p.goto(env.url);
    await p.getByTestId("Login screen").waitFor();
    await p.waitForTimeout(2500);
    assert.equal(await p.evaluate(() => window.__registered.length), 0, "registered before sign-in");
    await loginMobile(p, va.mobile);
    await waitScreen(p, "directory");
    await p.waitForFunction(() => window.__registered.length === 1, null, { timeout: 10000 });
    await c.close();
  });
  // Android export path (JavaScript side): the page must call the native
  // bridge. This is a browser stand-in for the bridge, NOT a phone; the real
  // save sheet is covered by the Android instrumented tests.
  for (const bridge of [true, false])
    await row(S, "Backup & export (Main Admin, " + (bridge ? "Android bridge stand-in" : "plain browser") + ")", "CSV list, then Excel", bridge ? "each export calls the native save sheet once" : "each export downloads a file").run(async () => {
      const c = await browser.newContext({ viewport: PHONE, acceptDownloads: true });
      await c.addInitScript((b) => {
        localStorage.setItem("mvpmi-preferences", JSON.stringify({ lang: "en" }));
        window.__saved = [];
        if (b) window.mvpmiBridge = { saveFile: (n, m, d) => window.__saved.push([n, m, d.length]), printHtml() {}, notify() {}, setScreenPrivacy() {}, biometricAvailable: () => false };
      }, bridge);
      const p = await c.newPage();
      await p.goto(env.url);
      await loginMain(p);
      await waitScreen(p, "directory");
      await p.getByTestId("Admin").click();
      if (await p.getByTestId("Admin enter dialog").isVisible().catch(() => false)) {
        await p.getByTestId("Admin enter secret").fill(MAIN.password);
        await p.getByTestId("Admin enter submit").click();
      }
      await p.locator(".mvpmi-tile", { hasText: "Backup & export" }).first().click();
      for (const [label, file] of [["CSV list", "mvpmi-members.csv"], ["Excel (.xlsx)", "mvpmi-contacts.xlsx"]]) {
        const dl = bridge ? null : p.waitForEvent("download", { timeout: 8000 });
        await p.locator(".mvpmi-tile", { hasText: label }).first().click();
        if (bridge) {
          await p.waitForFunction((f) => window.__saved.some(([n]) => n === f), file, { timeout: 8000 });
          await toast(p, "Choose where to save");
        } else assert.equal((await dl).suggestedFilename(), file);
      }
      if (bridge) {
        const saved = await p.evaluate(() => window.__saved);
        assert.equal(saved.length, 2, JSON.stringify(saved));
        assert.ok(saved.every(([, , size]) => size > 20));
      }
      await c.close();
    });
});

await browser.close();
// ---------------------------------------------------------------- Report
const pass = rows.filter((r) => r.pass).length;
const md = [
  "| Section | Screen | Button / action | Expected | Result | Pass/Fail |",
  "|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.section} | ${r.screen} | ${r.button} | ${r.expected} | ${r.result.replaceAll("|", "/")} | ${r.pass ? "PASS" : "FAIL"} |`),
  "",
  `**${pass} / ${rows.length} passed.**`,
].join("\n");
writeFileSync("test-results/alpha-checklist.md", md + "\n");
writeFileSync("test-results/alpha-checklist.json", JSON.stringify(rows, null, 2));
console.log(md);
if (process.env.GITHUB_ACTIONS)
  for (const r of rows.filter((x) => !x.pass).slice(0, 9))
    console.log("::error title=E2E FAIL " + r.section + "::" + (r.screen + " / " + r.button + " → " + r.result).replace(/[\r\n%]/g, " "));
if (pass !== rows.length || !rows.length) process.exit(1);
