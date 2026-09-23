// Browser test for the server-enforced app lock (PIN):
// mandatory PIN creation, lock on return from background (with an open Call
// sheet), wrong/right PIN, lock on every app start, and the village-admin
// reset code for a forgotten PIN.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createApp } from "../server/app.mjs";
import { enrollAdministrator } from "../server/village-approval.mjs";
import { passwordHash } from "../server/store.mjs";
import { launchBrowser } from "./browser.mjs";

mkdirSync("test-results", { recursive: true });
const { app, store } = createApp({
  dbPath: ":memory:",
  adminPassword: "TestPreview@2026",
  gateCode: "5831",
  development: true,
  requireAppLock: true,
});
enrollAdministrator(store, {
  village: "થોરાળા",
  name: "Thorala Village Administrator",
  phone: "7990000010",
  pass: "Village@2026!",
  reason: "Seeded for the lock flow",
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = "http://127.0.0.1:" + server.address().port;
const browser = await launchBrowser();
const errors = [];
const typePin = async (page, pin) => {
  for (const digit of pin)
    await page.getByRole("button", { name: digit, exact: true }).first().click();
};
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto(url);
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).waitFor();
  // Apply through the API with the page's own session, then approve.
  const applied = await page.evaluate(() =>
    fetch("/api/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-MVPMI-Client": "1" },
      body: JSON.stringify({
        firstName: "Lock",
        middleName: "Browser",
        surname: "Member",
        phone: "9000000077",
        village: "થોરાળા",
        consent: true,
      }),
    }).then((r) => r.json()),
  );
  const request = store.get("requests", applied.myRequest.id);
  store.put("members", {
    ...request.payload,
    id: "member-lock-test",
    owner: request.owner,
    createdAt: Date.now(),
    approvedAt: Date.now(),
  });
  store.del("requests", request.id);
  await page.reload();

  // 1. Approved member must create a PIN before seeing anyone.
  await page.getByText(/Create a four-digit PIN|નવો ચાર આંકડાનો પિન બનાવો/).first().waitFor();
  assert.equal(await page.locator(".app").getAttribute("data-screen"), "applock");
  assert.ok(!(await page.locator("body").innerText()).includes("7990000010"));
  assert.equal(
    await page.getByRole("button", { name: /Delete last digit|છેલ્લો આંકડો કાઢો/ }).count() > 0,
    true,
    "lock keypad keys are labelled",
  );
  await typePin(page, "1470");
  await page.getByText(/Enter the same PIN again|પિન ફરી નાખો/).first().waitFor();
  await typePin(page, "1470");
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  await page.screenshot({ path: "test-results/lock-after-setup.png" });

  // 2. Open a Call sheet, go to the background for 31 seconds, come back:
  //    the sheet is closed and nothing is readable or tappable.
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).click();
  await page.getByTestId("Call").first().click();
  await page.getByRole("dialog").first().waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(31000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByText(/App lock · Enter PIN|એપ લોક · પિન નાખો/).first().waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0, "Call sheet closed by the lock");
  assert.equal(await page.locator('a[href^="tel:"]').count(), 0, "no dial links under the lock");
  const lockedState = await page.evaluate(() =>
    fetch("/api/state").then((r) => r.json()),
  );
  assert.deepEqual(lockedState.members, [], "server sends no members while locked");
  await page.screenshot({ path: "test-results/lock-screen.png" });

  // 3. Wrong PIN → message; right PIN → directory.
  await typePin(page, "2222");
  await page.getByRole("alert").first().waitFor();
  await typePin(page, "1470");
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();

  // 4. Every app start is locked, and a reload does not skip it.
  await page.reload();
  await page.getByText(/App lock · Enter PIN|એપ લોક · પિન નાખો/).first().waitFor();

  // 5. Idle for 3 minutes locks the app too.
  await typePin(page, "1470");
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  await page.clock.fastForward(200000);
  await page.getByText(/App lock · Enter PIN|એપ લોક · પિન નાખો/).first().waitFor();

  // 6. Forgotten PIN: village administrator's one-time code.
  store.put("recoveries", {
    id: "member-lock-test",
    hash: passwordHash("246810"),
    until: Date.now() + 15 * 60000,
    tries: 0,
    by: "village-admin",
  });
  await page.getByRole("button", { name: /Forgot PIN|પિન ભૂલી ગયા/ }).click();
  await page.getByTestId("PIN reset code").fill("246810");
  await page.screenshot({ path: "test-results/lock-forgot.png" });
  await page.getByRole("button", { name: /Check code|કોડ ચકાસો/ }).click();
  await page.getByText(/Create a four-digit PIN|નવો ચાર આંકડાનો પિન બનાવો/).first().waitFor();
  await typePin(page, "3690");
  await typePin(page, "3690");
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();

  assert.deepEqual(errors, []);
  console.log(
    "PASS: mandatory server PIN, lock on background/idle/start (Call sheet closed, no records sent), wrong/right PIN, village-admin reset code.",
  );
} finally {
  await browser.close();
  server.close();
}
