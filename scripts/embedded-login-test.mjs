import { useEnglishForLegacyFlows } from "./test-language.mjs";
import { launchBrowser } from "./browser.mjs";
import { createApp } from "../server/app.mjs";
import https from "node:https";
import http from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "mvpmi-embed-"));
let server, outer, browser, store;
try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      dir + "/key",
      "-out",
      dir + "/cert",
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  const created = createApp({
    dbPath: ":memory:",
    adminPassword: "EmbeddedTest@2026",
    gateCode: "5831",
    secure: true,
    development: true,
  });
  store = created.store;
  server = https
    .createServer(
      { key: readFileSync(dir + "/key"), cert: readFileSync(dir + "/cert") },
      created.app,
    )
    .listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  outer = http
    .createServer((req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<iframe id="preview" src="https://127.0.0.1:${server.address().port}" style="width:450px;height:920px"></iframe>`,
      );
    })
    .listen(0);
  await new Promise((r) => outer.once("listening", r));
  browser = await launchBrowser();
  useEnglishForLegacyFlows(browser);
  for (const mode of ["cookies", "no-cookies", "no-storage"]) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1000, height: 1000 },
      acceptDownloads: true,
    });
    if (mode !== "cookies")
      await context.route("**/api/**", async (route) => {
        const headers = { ...route.request().headers() };
        delete headers.cookie;
        const response = await route.fetch({ headers });
        await context.clearCookies();
        const clean = { ...response.headers() };
        delete clean["set-cookie"];
        await route.fulfill({ response, headers: clean });
      });
    if (mode === "no-storage")
      await context.addInitScript(() => {
        for (const key of ["localStorage", "sessionStorage"])
          Object.defineProperty(window, key, {
            get() {
              throw new DOMException("Storage blocked", "SecurityError");
            },
          });
      });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:" + outer.address().port);
    const frame = page.frameLocator("#preview");
    await frame.getByTestId("Language").waitFor();
    if ((await frame.locator(".app").getAttribute("data-lang")) === "gu")
      await frame.getByTestId("Language").click();
    await frame.getByRole("button", { name: /Send request/ }).waitFor();
    for (let i = 0; i < 5; i++)
      await frame.getByTitle("MVPMl", { exact: true }).click({ force: true });
    for (const d of "5831")
      await frame.getByRole("button", { name: d, exact: true }).click();
    await frame.getByPlaceholder("admin", { exact: true }).fill("admin");
    await frame.locator("input[type=password]").fill("WrongPassword");
    await frame.getByRole("button", { name: /Sign in/ }).click();
    await frame
      .getByText("Wrong username or password", { exact: true })
      .first()
      .waitFor();
    await frame.locator("input[type=password]").fill("EmbeddedTest@2026");
    await frame.getByRole("button", { name: /Sign in/ }).click();
    await frame.getByText("New requests", { exact: true }).waitFor();
    if (mode !== "cookies")
      assert.equal(
        (await context.cookies()).find((c) => c.name === "mvpm_session"),
        undefined,
      );
    await frame.getByText("Backup & export", { exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      frame.getByText("Export Excel", { exact: true }).click(),
    ]);
    assert.equal(download.suggestedFilename(), "mvpmi-contacts.xlsx");
    if (mode !== "no-storage") {
      await page.reload();
      await frame.getByText("New requests", { exact: true }).waitFor();
    }
    await frame.getByTestId("Sign out").click();
    await frame.getByRole("button", { name: /Send request/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS embedded authentication, export and logout: " + mode);
    await context.close();
  }
  assert.equal(
    store.all("sessions").length,
    3,
    "Exactly one server session per browser context",
  );
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  if (outer) await new Promise((r) => outer.close(r));
  store?.db.close();
  rmSync(dir, { recursive: true, force: true });
}
