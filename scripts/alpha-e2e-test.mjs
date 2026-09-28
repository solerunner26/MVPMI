// Alpha audit end-to-end test (Sections 1–9). Drives the real app in Chromium
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
  if (!keepFirstPassword) {
    await admin("login", { mobile: MAIN.mobile, secret: MAIN.password });
    await admin("lock/unlock", { secret: MAIN.password }).catch(() => {});
  }
  const villageAdmins = new Map();
  const ensureVA = async (village = "થોરાળા", mobile = "9800000010", pin = "2580") => {
    if (villageAdmins.has(village)) return villageAdmins.get(village);
    const created = await admin("admin/village-admins/" + encodeURIComponent(village) + "/create", { name: "Village Admin " + mobile.slice(-2), mobile });
    const c = client();
    await c("login", { mobile, secret: created.issuedPin.pin });
    await c("pin/set", { pin, confirm: pin });
    const va = { client: c, mobile, pin };
    villageAdmins.set(village, va);
    return va;
  };
  // Registers, forwards, approves; returns the TEMP PIN.
  const approvedMember = async (phone, village = "થોરાળા", name = "Test Member") => {
    const va = await ensureVA(village);
    const u = client();
    const [firstName, surname] = name.split(" ");
    const r = await u("enrollment", { firstName, surname, phone, village, consent: true });
    await va.client("village/requests/" + r.myRequest.id + "/forward", { identityConfirmed: true });
    const done = await admin("admin/requests/" + r.myRequest.id + "/approve", {});
    return done.issuedPin.pin;
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
async function waitScreen(page, name) {
  await page.waitForFunction((n) => document.querySelector(".app")?.getAttribute("data-screen") === n, name, { timeout: 10000 });
}
async function loginMain(page, password = MAIN.password) {
  await page.getByTestId("Login screen").waitFor();
  await page.getByTestId("Toggle password mode").click();
  await page.getByTestId("Login mobile").fill(MAIN.mobile);
  await page.getByTestId("Login secret").fill(password);
  await page.getByTestId("Login submit").click();
}
async function loginPin(page, mobile, pin) {
  await page.getByTestId("Login screen").waitFor();
  await page.getByTestId("Login mobile").fill(mobile);
  await page.getByTestId("Login secret").fill(pin);
  await page.getByTestId("Login submit").click();
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
    console.error("Flow " + name + " stopped: " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | "));
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

// ---------------------------------------------------------------- Section 2
await flow("s2", async (env) => {
  const S = "2 Main Admin";
  const { page, ctx } = await phone(env.url);
  await row(S, "Login", "Log in (wrong password)", "shows 'Wrong password' and attempts left").run(async () => {
    await loginMain(page, "Wrong@pass1");
    await page.getByTestId("Login error").filter({ hasText: "Wrong password" }).waitFor();
    await page.getByTestId("Login error").filter({ hasText: "4 attempts left" }).waitFor();
  });
  await row(S, "Login", "Log in (first-time password)", "asks for a new password before anything else").run(async () => {
    await page.getByTestId("Login secret").fill(FIRST_PASSWORD);
    await page.getByTestId("Login submit").click();
    await waitScreen(page, "setpin");
    await page.getByText("Set your new password").first().waitFor();
    assert.equal(await page.getByTestId("Admin").count(), 0);
    await shot(page, "s2-first-password");
  });
  for (const [label, next, confirm, message] of [
    ["shorter than 8", "short", "short", "at least 8 characters"],
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
  });
  for (const [label, args, message] of [
    ["wrong old password", ["Nope@1234", "NewPass@26", "NewPass@26"], "The old password is wrong."],
    ["new shorter than 8", [MAIN.password, "short", "short"], "at least 8 characters"],
    ["new same as old", [MAIN.password, MAIN.password, MAIN.password], "same as the old password"],
    ["new fields differ", [MAIN.password, "NewPass@26", "NewPass@27"], "do not match"],
  ])
    await row(S, "Change Password dialog", "Change (" + label + ")", "error shown, dialog stays open, typing kept").run(async () => {
      await fill(...args);
      await page.getByTestId("Change error").filter({ hasText: message }).waitFor();
      assert.ok(await dialog().isVisible());
      assert.equal(await page.getByTestId("Change next").inputValue(), args[1]);
    });
  await row(S, "Change Password dialog", "Change (valid)", "'Password changed successfully', dialog closes").run(async () => {
    await fill(MAIN.password, "NewPass@26", "NewPass@26");
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
    await page.getByTestId("Admin enter secret").fill("NewPass@26");
    await page.getByTestId("Admin enter submit").click();
    await waitScreen(page, "admin");
    await back(page);
    await waitScreen(page, "directory");
  });
  await row(S, "Settings", "Sign out of this phone", "clears everything, Login screen; Back leaves the app").run(async () => {
    await page.getByTestId("Profile and settings").click();
    await waitScreen(page, "settings");
    await page.getByTestId("Sign out of this phone").click();
    await page.getByTestId("Confirm yes").click();
    await waitScreen(page, "login");
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
    await page.getByTestId("Login secret").fill("NewPass@26");
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
  let temp;
  await row(S, "Admin → Manage Village Admins", "Create Village Admin (Thorala)", "TEMP PIN shown once with WhatsApp button").run(async () => {
    await loginMain(main.page);
    await waitScreen(main.page, "directory");
    await main.page.getByTestId("Admin").click();
    await waitScreen(main.page, "admin");
    await main.page.getByRole("button", { name: /Manage Village Admins/ }).click();
    await main.page.getByTestId("VA create Thorala").click();
    await main.page.getByTestId("VA name").fill("Thorala Village Admin");
    await main.page.getByTestId("VA mobile").fill("9800000010");
    await main.page.getByTestId("VA form save").click();
    await main.page.getByTestId("TEMP PIN dialog").waitFor();
    temp = (await main.page.getByTestId("TEMP PIN value").innerText()).trim();
    assert.match(temp, /^\d{4}$/);
    await shot(main.page, "s3-temp-pin");
  });
  await row(S, "TEMP PIN dialog", "Share on WhatsApp", "opens WhatsApp to that mobile with app name, village, TEMP PIN, 'Change it after first login'").run(async () => {
    const href = await main.page.getByTestId("Share on WhatsApp").getAttribute("href");
    assert.ok(href.startsWith("https://wa.me/919800000010?text="));
    const text = decodeURIComponent(href.split("text=")[1]);
    for (const part of ["Community Directory", "You are the Village Admin for Thorala", "TEMP PIN: " + temp, "Change it after first login", "ગામ એડમિન"])
      assert.ok(text.includes(part), part);
  });
  await row(S, "TEMP PIN dialog", "Call", "phones the new Village Admin").run(async () => {
    assert.equal(await main.page.getByTestId("TEMP PIN call").getAttribute("href"), "tel:+919800000010");
  });
  await row(S, "TEMP PIN dialog", "Done", "closes; the TEMP PIN stays on the card (Call / WhatsApp) until first login").run(async () => {
    await main.page.getByTestId("TEMP PIN done").click();
    await main.page.getByTestId("TEMP PIN dialog").waitFor({ state: "detached" });
    await main.page.getByTestId("Village admin Thorala").filter({ hasText: "First login pending" }).waitFor();
    assert.equal((await main.page.getByTestId("VA temp pin Thorala").innerText()).trim(), temp);
    assert.equal(await main.page.getByTestId("VA call Thorala").getAttribute("href"), "tel:+919800000010");
    assert.ok(decodeURIComponent(await main.page.getByTestId("VA share Thorala").getAttribute("href")).includes("TEMP PIN: " + temp));
    await shot(main.page, "s3-va-card-handover");
  });
  await row(S, "Manage Village Admins", "Create (second admin for Thorala)", "not offered while one is active").run(async () => {
    assert.equal(await main.page.getByTestId("VA create Thorala").count(), 0);
  });
  const va = await phone(env.url);
  await row(S, "Login (Village Admin)", "Log in with TEMP PIN", "forced to 'Set new PIN' before anything else").run(async () => {
    await loginPin(va.page, "9800000010", temp);
    await waitScreen(va.page, "setpin");
    assert.equal(await back(va.page), false, "Back cannot skip it");
    assert.equal(await screenOf(va.page), "setpin");
  });
  await row(S, "Set new PIN", "Set PIN (1234)", "refused as too easy").run(async () => {
    await va.page.getByTestId("Set PIN new").fill("1234");
    await va.page.getByTestId("Set PIN confirm").fill("1234");
    await va.page.getByTestId("Set PIN submit").click();
    await va.page.getByTestId("Set PIN error").filter({ hasText: "too easy" }).waitFor();
  });
  await row(S, "Set new PIN", "Set PIN (valid)", "lands on the directory with the Admin icon").run(async () => {
    await va.page.getByTestId("Set PIN new").fill("2580");
    await va.page.getByTestId("Set PIN confirm").fill("2580");
    await va.page.getByTestId("Set PIN submit").click();
    await waitScreen(va.page, "directory");
    await va.page.getByTestId("Admin").waitFor();
  });
  await row(S, "Manage Village Admins", "(after the Village Admin's first login)", "TEMP PIN removed from the card; status Active").run(async () => {
    await main.page.getByTestId("Village admin Thorala").filter({ hasText: "Active" }).waitFor();
    assert.equal(await main.page.getByTestId("VA temp pin Thorala").count(), 0);
    assert.equal((await main.page.content()).includes(">" + temp + "<"), false);
  });
  // Two registrations: Thorala (this admin) and Sathra (another admin).
  await env.ensureVA("સથરા", "9800000020", "3690");
  const applicant = env.client();
  const applied = await applicant("enrollment", { firstName: "Ramesh", surname: "Vala", phone: "9811111111", village: "થોરાળા", consent: true });
  await env.client()("enrollment", { firstName: "Other", surname: "Village", phone: "9822222222", village: "સથરા", consent: true });
  await row(S, "Directory (Village Admin)", "Admin icon", "review panel shows ONLY their own village").run(async () => {
    await va.page.getByTestId("Admin").click();
    await va.page.locator(".workflow-panel").waitFor();
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
  await row(S, "Admin dashboard (Main Admin)", "Approve forwarded registration", "approved; TEMP PIN for the member shown once").run(async () => {
    await main.page.getByTestId("Workflow back").click();
    await main.page.getByRole("button", { name: /(^|\s)Requests\b/ }).filter({ hasText: "removals" }).first().click();
    await main.page.locator('[data-glass="1"]', { hasText: "Ramesh Vala" }).getByRole("button", { name: /Approve/ }).click();
    await main.page.getByTestId("TEMP PIN dialog").waitFor();
    const href = await main.page.getByTestId("Share on WhatsApp").getAttribute("href");
    assert.ok(href.startsWith("https://wa.me/919811111111?text="));
    assert.ok(decodeURIComponent(href).includes("Your registration is approved"));
    await main.page.getByTestId("TEMP PIN done").click();
    assert.ok(env.store.all("members").some((m) => m.phone === "9811111111"));
    void applied;
  });
  await row(S, "Review panel (Village Admin)", "Log out of admin", "ends admin session only; directory as member").run(async () => {
    await va.page.getByTestId("Admin logout").click();
    await waitScreen(va.page, "directory");
    await toast(va.page, "Logged out of admin");
  });
  await row(S, "Settings (Village Admin)", "Change PIN", "'PIN changed successfully'").run(async () => {
    await va.page.getByTestId("Profile and settings").click();
    await va.page.getByTestId("Settings change PIN").click();
    await va.page.getByTestId("Change current").fill("2580");
    await va.page.getByTestId("Change next").fill("4826");
    await va.page.getByTestId("Change confirm").fill("4826");
    await va.page.getByTestId("Change submit").click();
    await toast(va.page, "PIN changed successfully");
  });
  await row(S, "Manage Village Admins", "Disable", "the Village Admin loses admin tools at once").run(async () => {
    await main.page.getByTestId("Admin back").click();
    await main.page.getByRole("button", { name: /Manage Village Admins/ }).click();
    await main.page.getByTestId("VA disable Thorala").click();
    await main.page.getByTestId("Confirm yes").click();
    await main.page.getByTestId("Village admin Thorala").filter({ hasText: "Disabled" }).waitFor();
    await va.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await va.page.getByTestId("Admin").waitFor({ state: "detached", timeout: 12000 });
  });
  await row(S, "Manage Village Admins", "Enable / Reset PIN / Edit", "each works").run(async () => {
    await main.page.getByTestId("VA enable Thorala").click();
    await main.page.getByTestId("VA reset Thorala").waitFor();
    await main.page.getByTestId("VA reset Thorala").click();
    await main.page.getByTestId("Confirm yes").click();
    await main.page.getByTestId("TEMP PIN dialog").waitFor();
    await main.page.getByTestId("TEMP PIN done").click();
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
  await row(S, "Login", "New member? Register", "opens the registration form (no 'Already Member?' button anywhere)").run(async () => {
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
  const pin = await env.approvedMember("9844444444");
  await row(S, "Register", "Submit (APPROVED number)", "'already a member. Please log in.' + Go to Login + Forgot PIN?").run(async () => {
    await (await tryNumber("9844444444")).filter({ hasText: "already a member. Please log in." }).waitFor();
    await other.page.getByTestId("Status forgot PIN").waitFor();
    await other.page.getByTestId("Status go to login").click();
    await waitScreen(other.page, "login");
    assert.equal(await other.page.getByTestId("Login mobile").inputValue(), "9844444444");
    await other.page.getByTestId("Go to register").click();
  });
  // A rejected and a removed number.
  const rej = env.client();
  const r = await rej("enrollment", { firstName: "Rej", surname: "Ected", phone: "9855555555", village: "થોરાળા", consent: true });
  await env.admin("admin/requests/" + r.myRequest.id + "/reject", { reason: "Not known here" });
  await row(S, "Register", "Submit (REJECTED number)", "'Your registration was not approved. Contact your village admin.'").run(async () => {
    await (await tryNumber("9855555555")).filter({ hasText: "was not approved" }).waitFor();
  });
  const removedId = env.store.all("members").find((m) => m.phone === "9844444444").id;
  await env.admin("admin/members/" + removedId + "/delete", {});
  await row(S, "Register", "Submit (REMOVED number)", "'This number was removed. Contact your village admin.'").run(async () => {
    await (await tryNumber("9844444444")).filter({ hasText: "was removed" }).waitFor();
    void pin;
  });
  await row(S, "Pending", "(status after approval)", "tells the person to log in with the TEMP PIN").run(async () => {
    const req = env.store.all("requests").find((x) => x.payload.phone === "9833333333");
    const va = await env.ensureVA();
    await va.client("village/requests/" + req.id + "/forward", { identityConfirmed: true });
    await env.admin("admin/requests/" + req.id + "/approve", {});
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.getByTestId("Pending approved").waitFor({ timeout: 12000 });
    await page.getByTestId("Pending go to login").click();
    await waitScreen(page, "login");
  });
  await row(S, "Login", "Forgot PIN?", "sends a request to the village admin (nothing is reset)").run(async () => {
    await page.getByTestId("Forgot PIN").click();
    await page.getByTestId("Forgot mobile").fill("9833333333");
    await page.getByTestId("Forgot send").click();
    await page.getByTestId("Forgot sent").waitFor();
    await page.getByTestId("Forgot done").click();
    const va = await env.ensureVA();
    const s = await va.client("state");
    assert.equal(s.pinResetRequests.length, 1);
  });
  await row(S, "Village Admin → Forgot PIN requests", "Create TEMP PIN", "TEMP PIN + WhatsApp button for that member").run(async () => {
    const vaPage = await phone(env.url);
    await loginPin(vaPage.page, "9800000010", "2580");
    await waitScreen(vaPage.page, "directory");
    await vaPage.page.getByTestId("Admin").click();
    await vaPage.page.getByRole("button", { name: /Forgot PIN requests/ }).click();
    await vaPage.page.getByTestId("PIN request create").click();
    await vaPage.page.getByTestId("Confirm yes").click();
    await vaPage.page.getByTestId("TEMP PIN dialog").waitFor();
    const href = await vaPage.page.getByTestId("Share on WhatsApp").getAttribute("href");
    assert.ok(href.startsWith("https://wa.me/919833333333?text="));
    await vaPage.ctx.close();
  });
  await screenAudit(page, S, "Login");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual([...page.errors, ...other.page.errors], []));
  await ctx.close();
  await other.ctx.close();
});

// ---------------------------------------------------------------- Section 5
await flow("s5", async (env) => {
  const S = "5 PIN & app lock";
  const temp = await env.approvedMember("9866666666", "થોરાળા", "Lock Member");
  const { page, ctx } = await phone(env.url);
  await row(S, "Login", "Log in with TEMP PIN", "forced 'Set new PIN'").run(async () => {
    await loginPin(page, "9866666666", temp);
    await waitScreen(page, "setpin");
    await shot(page, "s5-set-pin");
  });
  await row(S, "Set new PIN", "Set PIN", "directory opens; TEMP PIN cannot be used again").run(async () => {
    await page.getByTestId("Set PIN new").fill("3691");
    await page.getByTestId("Set PIN confirm").fill("3691");
    await page.getByTestId("Set PIN submit").click();
    await waitScreen(page, "directory");
    const again = await env.client()("login", { mobile: "9866666666", secret: temp }).catch((e) => e.message);
    assert.match(String(again), /WRONG_PIN|TEMP_USED/);
    // That refused try counted as a wrong PIN; start the lock test clean.
    const m = env.store.all("members").find((x) => x.phone === "9866666666");
    m.cred.fails = 0;
    env.store.put("members", m);
  });
  await row(S, "Settings", "Ask for PIN when opening the app (default)", "OFF for members; reload opens directly").run(async () => {
    await page.getByTestId("Profile and settings").click();
    assert.equal(await page.getByTestId("Settings app lock").getAttribute("aria-checked"), "false");
    await page.reload();
    await waitScreen(page, "directory");
  });
  await row(S, "Settings", "Ask for PIN when opening the app → ON", "reopening the app asks for the PIN").run(async () => {
    await page.getByTestId("Profile and settings").click();
    await page.getByTestId("Settings app lock").click();
    await toast(page, "App lock on");
    assert.equal(await page.getByTestId("Settings app lock").getAttribute("aria-checked"), "true");
    await page.reload();
    await waitScreen(page, "lock");
    assert.equal(await page.getByTestId("Contact row").count(), 0, "no contacts behind the lock");
    await shot(page, "s5-lock");
  });
  await row(S, "Lock", "Unlock (wrong PIN ×4)", "'Wrong PIN' with attempts left").run(async () => {
    let unlocks = 0;
    page.on("request", (r) => { if (r.url().includes("/api/lock/unlock")) unlocks++; });
    for (let i = 0; i < 4; i++) {
      await page.getByTestId("Unlock secret").fill("1470");
      await page.getByTestId("Unlock error").filter({ hasText: (4 - i) + " attempts left" }).waitFor();
    }
    assert.equal(unlocks, 4);
    await page.getByTestId("Unlock error").filter({ hasText: "1 attempts left" }).waitFor();
  });
  await row(S, "Lock", "Unlock (5th wrong PIN)", "locked for 5 minutes, remaining time shown").run(async () => {
    await page.getByTestId("Unlock secret").fill("1470");
    await page.getByTestId("Unlock error").filter({ hasText: /Try again in [45]:\d\d/ }).waitFor();
    assert.ok(await page.getByTestId("Unlock submit").isDisabled());
  });
  await row(S, "Lock", "Unlock (after the 5 minutes)", "the right PIN opens the directory").run(async () => {
    const m = env.store.all("members").find((x) => x.phone === "9866666666");
    m.cred.until = Date.now() - 1;
    env.store.put("members", m);
    await page.reload();
    await waitScreen(page, "lock");
    await page.getByTestId("Unlock secret").fill("3691");
    await waitScreen(page, "directory");
  });
  await row(S, "Directory", "(1 minute in the background)", "locks when the app returns").run(async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const session = env.store.all("sessions").find((x) => x.auth && env.store.get("members", x.auth.memberId)?.phone === "9866666666");
    session.lock.hiddenAt = Date.now() - 61000;
    env.store.put("sessions", session);
    await page.evaluate(() => {
      window.__realNow = Date.now;
      const shift = 61000;
      Date.now = () => window.__realNow() + shift;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitScreen(page, "lock");
    await page.evaluate(() => (Date.now = window.__realNow));
    await page.getByTestId("Unlock secret").fill("3691");
    await waitScreen(page, "directory");
  });
  await row(S, "Settings", "Ask for PIN → OFF", "turned off").run(async () => {
    await page.getByTestId("Profile and settings").click();
    await page.getByTestId("Settings app lock").click();
    await toast(page, "App lock off");
    await page.reload();
    await waitScreen(page, "directory");
  });
  await row(S, "Settings (admin)", "Ask for PIN when opening the app", "always ON for admins, cannot be turned off").run(async () => {
    const admin = await phone(env.url);
    await loginMain(admin.page);
    await waitScreen(admin.page, "directory");
    await admin.page.getByTestId("Profile and settings").click();
    const sw = admin.page.getByTestId("Settings app lock");
    assert.equal(await sw.getAttribute("aria-checked"), "true");
    assert.ok(await sw.isDisabled());
    await admin.page.getByText("Always on for admins").waitFor();
    await admin.page.reload();
    await waitScreen(admin.page, "lock");
    await admin.page.getByTestId("Unlock secret").fill(MAIN.password);
    await admin.page.getByTestId("Unlock submit").click();
    await waitScreen(admin.page, "directory");
    await admin.ctx.close();
  });
  await screenAudit(page, S, "Settings");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- Section 6
await flow("s6", async (env) => {
  const S = "6 Change feedback";
  const temp = await env.approvedMember("9877777777", "થોરાળા", "Pin Changer");
  for (const lang of ["en", "gu"]) {
    const { page, ctx } = await phone(env.url, { lang });
    await loginPin(page, "9877777777", lang === "en" ? temp : "5802");
    if (lang === "en") {
      await waitScreen(page, "setpin");
      await page.getByTestId("Set PIN new").fill("3691");
      await page.getByTestId("Set PIN confirm").fill("3691");
      await page.getByTestId("Set PIN submit").click();
    }
    await waitScreen(page, "directory");
    await page.getByTestId("Profile and settings").click();
    await page.getByTestId("Settings change PIN").click();
    const dialog = page.getByTestId("Change PIN dialog");
    const cases = [
      ["wrong old PIN", ["1470", "5802", "5802"], { en: "The old PIN is wrong.", gu: "જૂનો પિન ખોટો છે." }, "current"],
      ["new PINs differ", ["3691", "5802", "5803"], { en: "do not match", gu: "એકસરખા નથી" }, "confirm"],
      ["new same as old", ["3691", "3691", "3691"], { en: "same as the old PIN", gu: "જૂના પિન જેવો જ" }, "next"],
      ["PIN not 4 digits", ["3691", "580", "580"], { en: "exactly 4 digits", gu: "૪ આંકડાનો" }, "next"],
      ["PIN too easy", ["3691", "1111", "1111"], { en: "too easy", gu: "સહેલો" }, "next"],
    ];
    for (const [label, [a, b, c], message, field] of cases)
      await row(S, "Change PIN dialog (" + lang + ")", "Change (" + label + ")", "message shown, field highlighted, dialog open, typing kept").run(async () => {
        await page.getByTestId("Change current").fill(a);
        await page.getByTestId("Change next").fill(b);
        await page.getByTestId("Change confirm").fill(c);
        await page.getByTestId("Change submit").click();
        await page.getByTestId("Change error").filter({ hasText: message[lang] }).waitFor();
        assert.equal(await page.getByTestId("Change " + field).getAttribute("aria-invalid"), "true");
        assert.ok(await dialog.isVisible());
        assert.equal(await page.getByTestId("Change next").inputValue(), b);
      });
    await row(S, "Change PIN dialog (" + lang + ")", "Change (network error)", "network message, dialog stays open").run(async () => {
      await page.getByTestId("Change current").fill("3691");
      await page.getByTestId("Change next").fill("5802");
      await page.getByTestId("Change confirm").fill("5802");
      await ctx.setOffline(true);
      await page.getByTestId("Change submit").click();
      await page.getByTestId("Change error").filter({ hasText: lang === "en" ? "No internet" : "ઇન્ટરનેટ નથી" }).waitFor();
      await ctx.setOffline(false);
      assert.ok(await dialog.isVisible());
    });
    await row(S, "Change PIN dialog (" + lang + ")", "Change (valid)", lang === "en" ? "'PIN changed successfully', dialog closes" : "'પિન સફળતાપૂર્વક બદલાયો', dialog closes").run(async () => {
      if (lang === "gu") {
        await page.getByTestId("Change current").fill("5802");
        await page.getByTestId("Change next").fill("3691");
        await page.getByTestId("Change confirm").fill("3691");
      }
      await page.getByTestId("Change submit").click();
      await toast(page, lang === "en" ? "PIN changed successfully" : "પિન સફળતાપૂર્વક બદલાયો");
      await dialog.waitFor({ state: "detached" });
    });
    if (lang === "en") await screenAudit(page, S, "Settings (after PIN change)");
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
  // Member: settings stack.
  const temp = await env.approvedMember("9888888888", "થોરાળા", "Nav Member");
  const m = await phone(env.url);
  await loginPin(m.page, "9888888888", temp);
  await m.page.getByTestId("Set PIN new").fill("3691");
  await m.page.getByTestId("Set PIN confirm").fill("3691");
  await m.page.getByTestId("Set PIN submit").click();
  await waitScreen(m.page, "directory");
  await row(S, "Directory (member)", "Profile & settings → My Profile → Back → Back", "profile → settings → directory").run(async () => {
    await m.page.getByTestId("Profile and settings").click();
    await m.page.getByTestId("Settings my profile").click();
    await waitScreen(m.page, "profile");
    await back(m.page);
    await waitScreen(m.page, "settings");
    await back(m.page);
    await waitScreen(m.page, "directory");
  });
  await row(S, "Settings (member)", "Request profile change → Send for approval", "change request sent; back on My Profile").run(async () => {
    await m.page.getByTestId("Profile and settings").click();
    await m.page.getByTestId("Settings request change").click();
    await waitScreen(m.page, "edit");
    await m.page.getByTestId("Edit currentLocation").fill("Ahmedabad");
    await m.page.getByTestId("Edit save").click();
    await waitScreen(m.page, "profile");
    await toast(m.page, "Change request sent");
    await m.page.getByText("Your change request is waiting for approval.").waitFor();
  });
  await row(S, "Settings (member)", "Request removal", "confirm → 'Removal request sent'").run(async () => {
    await back(m.page);
    await m.page.getByTestId("Settings request removal").click();
    await m.page.getByTestId("Confirm yes").click();
    await toast(m.page, "Removal request sent");
  });
  await row(S, "Directory (member)", "Admin icon", "not shown to members").run(async () => {
    await back(m.page);
    assert.equal(await m.page.getByTestId("Admin").count(), 0);
  });
  await row(S, "Settings (member)", "Sign out of this phone", "Login screen; Back leaves the app (never back to the directory)").run(async () => {
    await m.page.getByTestId("Profile and settings").click();
    await m.page.getByTestId("Sign out of this phone").click();
    await m.page.getByTestId("Confirm yes").click();
    await waitScreen(m.page, "login");
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
  const temp = await env.approvedMember("9899999999", "થોરાળા", "Directory Member");
  const { page, ctx } = await phone(env.url);
  await loginPin(page, "9899999999", temp);
  await page.getByTestId("Set PIN new").fill("3691");
  await page.getByTestId("Set PIN confirm").fill("3691");
  await page.getByTestId("Set PIN submit").click();
  await waitScreen(page, "directory");
  await row(S, "Directory", "(layout on a 6-inch phone, 360×728)", "at least 8 contacts fully visible").run(async () => {
    const visible = await page.evaluate(() => {
      const list = document.querySelector(".alpha-list").getBoundingClientRect();
      return [...document.querySelectorAll(".alpha-row")].filter((r) => {
        const b = r.getBoundingClientRect();
        return b.top >= list.top - 1 && b.bottom <= Math.min(list.bottom, window.innerHeight) + 1;
      }).length;
    });
    assert.ok(visible >= 8, visible + " rows");
    const height = await page.locator(".alpha-row").first().evaluate((el) => el.getBoundingClientRect().height);
    assert.ok(height >= 60 && height <= 70, "row " + height + "px");
    await shot(page, "s8-directory");
    return visible + " rows visible, rows " + Math.round(height) + " px";
  });
  await row(S, "Directory", "Search icon", "search field opens in the top bar with the keyboard").run(async () => {
    await page.getByTestId("Search").click();
    await page.getByTestId("Search input").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.testid), "Search input");
  });
  await row(S, "Search", "Type 2 letters", "no filtering yet ('type at least 3')").run(async () => {
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
  await row(S, "Search", "X", "clears the search and closes the field").run(async () => {
    await page.getByTestId("Search clear").click();
    await page.getByTestId("Search input").waitFor({ state: "detached" });
    await page.getByTestId("Directory count").filter({ hasText: /members/ }).waitFor();
  });
  await row(S, "Directory", "Village filter icon / chips", "chips filter by village; the bar can be hidden").run(async () => {
    await page.getByTestId("Chip Sathra").click();
    await page.getByTestId("Directory count").filter({ hasText: "4 members" }).waitFor();
    await back(page);
    await page.getByTestId("Village filter").click();
    await page.getByTestId("Village chips").waitFor({ state: "detached" });
    await page.getByTestId("Village filter").click();
    await page.getByTestId("Village chips").waitFor();
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
  await row(S, "Directory", "Profile & settings icon → My Profile", "My Profile is inside Settings; no separate My Profile button on the directory").run(async () => {
    assert.equal(await page.getByRole("button", { name: /^My Profile$/ }).count(), 0);
    await page.getByTestId("Profile and settings").click();
    await page.getByTestId("Settings my profile").click();
    await waitScreen(page, "profile");
    await shot(page, "s8-settings-profile");
    await back(page);
  });
  await row(S, "Settings", "(contents)", "My Profile, request change, request removal, Change PIN, App lock, Language, Sign out").run(async () => {
    for (const id of ["Settings my profile", "Settings request change", "Settings request removal", "Settings change PIN", "Settings app lock", "Settings Gujarati", "Settings English", "Sign out of this phone"])
      await page.getByTestId(id).waitFor();
    await shot(page, "s8-settings");
    await back(page);
  });
  await screenAudit(page, S, "Directory");
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- Section 1
await flow("s1", async (env) => {
  const S = "1 Server & offline";
  env.seedMembers(5);
  const temp = await env.approvedMember("9812121212", "થોરાળા", "Offline Member");
  const { page, ctx } = await phone(env.url);
  await loginPin(page, "9812121212", temp);
  await page.getByTestId("Set PIN new").fill("3691");
  await page.getByTestId("Set PIN confirm").fill("3691");
  await page.getByTestId("Set PIN submit").click();
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
    // Tap Retry (the app may also have reconnected by itself already).
    await page.getByTestId("Offline banner").click({ timeout: 3000 }).catch(() => {});
    await page.getByTestId("Offline banner").waitFor({ state: "detached", timeout: 15000 });
    await page.getByText("SeedA Member0").first().waitFor();
    const n = await page.getByTestId("Contact row").count();
    assert.ok(n >= 8, String(n));
  });
  await row(S, "Lock (offline)", "Unlock with PIN without internet", "opens the saved directory; wrong PIN refused").run(async () => {
    await page.getByTestId("Profile and settings").click();
    await page.getByTestId("Settings app lock").click();
    await toast(page, "App lock on");
    await back(page);
    await ctx.setOffline(true);
    await page.reload().catch(() => {});
    await waitScreen(page, "lock");
    await page.getByText("Offline: opens with the PIN last used on this phone.").waitFor();
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
    await page.getByTestId("Profile and settings").click();
    await page.getByTestId("Sign out of this phone").click();
    await page.getByTestId("Confirm yes").click();
    await waitScreen(page, "login");
    assert.equal(await page.evaluate(() => localStorage.getItem("mvpmi.offline.v1")), null);
  });
  await row(S, "(all screens)", "(browser console)", "no JavaScript errors").run(async () => assert.deepEqual(page.errors, []));
  await ctx.close();
});

// ---------------------------------------------------------------- Section 9
await flow("s9", async (env) => {
  const S = "9 Audit";
  env.seedMembers(4);
  const temp = await env.approvedMember("9813131313", "થોરાળા", "Audit Member");
  const { page, ctx } = await phone(env.url, { lang: "gu" });
  const checkLang = async (screen, gu, en, goto) => {
    await row(S, screen, "Language Gujarati ↔ English", "every text switches").run(async () => {
      await page.locator("html[lang=gu]").waitFor();
      await page.getByText(gu, { exact: false }).first().waitFor();
      if (goto) await goto("en");
      else await page.evaluate(() => {});
      await page.locator("html[lang=en]").waitFor();
      await page.getByText(en, { exact: false }).first().waitFor();
      if (goto) await goto("gu");
      await page.locator("html[lang=gu]").waitFor();
    });
  };
  const viaLoginSwitch = async (l) => page.getByTestId(l === "en" ? "Language English" : "Language Gujarati").click();
  await checkLang("Login", "મોબાઇલ નંબર", "Mobile number", viaLoginSwitch);
  await page.getByTestId("Go to register").click();
  await waitScreen(page, "register");
  const viaSettingsless = async (l) => {
    await back(page);
    await page.getByTestId(l === "en" ? "Language English" : "Language Gujarati").click();
    await page.getByTestId("Go to register").click();
  };
  await checkLang("Register", "નોંધણી", "Register", viaSettingsless);
  await back(page);
  await loginPin(page, "9813131313", temp);
  await waitScreen(page, "setpin");
  await checkLang("Set new PIN", "તમારો નવો પિન બનાવો", "Set your new PIN", viaLoginSwitch);
  await page.getByTestId("Set PIN new").fill("3691");
  await page.getByTestId("Set PIN confirm").fill("3691");
  await page.getByTestId("Set PIN submit").click();
  await waitScreen(page, "directory");
  const viaSettings = async (l) => {
    const before = await screenOf(page);
    await page.evaluate((x) => {
      const prefs = JSON.parse(localStorage.getItem("mvpmi-preferences") || "{}");
      localStorage.setItem("mvpmi-preferences", JSON.stringify({ ...prefs, lang: x }));
    }, l);
    await page.getByTestId("Profile and settings").click().catch(() => {});
    if (before !== "settings") await waitScreen(page, "settings");
    await page.getByTestId(l === "en" ? "Settings English" : "Settings Gujarati").click();
    if (before === "directory") await back(page);
  };
  await checkLang("Directory", "સમાજ સંપર્ક યાદી", "Community Directory", viaSettings);
  await page.getByTestId("Profile and settings").click();
  await waitScreen(page, "settings");
  await checkLang("Settings", "સેટિંગ્સ", "Settings", async (l) => page.getByTestId(l === "en" ? "Settings English" : "Settings Gujarati").click());
  await row(S, "Every alpha screen", "(rotation to landscape and back)", "no crash, no sideways scrolling").run(async () => {
    for (const screen of ["settings", "directory"]) {
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
if (pass !== rows.length || !rows.length) process.exit(1);
