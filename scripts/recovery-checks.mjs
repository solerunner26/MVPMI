import { openMemberHelp } from "./preferences-checks.mjs";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

export async function checkAdminRecovery(browser, panel, oldPage, url) {
  // Hold the old device offline so polling cannot clear the revoked token
  // before reload. This exercises the formerly timing-dependent first 401.
  await oldPage.route("**/api/state", (route) => route.abort());
  const oldToken = await oldPage.evaluate(
    () => JSON.parse(sessionStorage.getItem("mvpmi-preview-session")).token,
  );
  await panel.getByRole("button", { name: /Back to dashboard/ }).click();
  await panel.getByText("Members", { exact: true }).click();
  for (const mode of ["cookies", "no-cookies"]) {
    await panel.getByTestId("Issue recovery").click();
    await panel
      .getByRole("button", {
        name: /I verified identity — issue code/,
      })
      .click();
    const code = (
      await panel.getByTestId("Issued recovery code").innerText()
    ).replace(/\s/g, "");
    assert.match(code, /^[a-f0-9]{32}$/);
    assert.equal(
      (
        await new AxeBuilder({ page: panel })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations.length,
      0,
    );
    await panel
      .getByRole("dialog")
      .getByRole("button", { name: /Close/ })
      .click();
    assert.equal(await panel.getByTestId("Issued recovery code").count(), 0);
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
    });
    if (mode === "no-cookies")
      await context.route("**/api/**", async (route) => {
        const headers = { ...route.request().headers() };
        delete headers.cookie;
        const response = await route.fetch({ headers });
        await context.clearCookies();
        const responseHeaders = { ...response.headers() };
        delete responseHeaders["set-cookie"];
        await route.fulfill({ response, headers: responseHeaders });
      });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.getByTestId("Reading settings").waitFor();
    await openMemberHelp(page);
    assert.equal(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations.length,
      0,
    );
    await page.getByTestId("Recovery phone").fill("9000000001");
    await page.getByTestId("Recovery code").fill("a".repeat(32));
    await page.getByRole("button", { name: /પ્રવેશ પાછો મેળવો/ }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    await page.getByTestId("Recovery code").fill(code);
    await page.getByRole("button", { name: /પ્રવેશ પાછો મેળવો/ }).click();
    await page.getByTestId("My profile").waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.reload();
    await page.getByTestId("My profile").waitFor();
    const visibleState = await page.evaluate(async () => {
      const session = JSON.parse(
        sessionStorage.getItem("mvpmi-preview-session"),
      );
      return (
        await fetch("/api/state", {
          headers: { "X-MVPMI-Session": session.token },
        })
      ).json();
    });
    assert.equal(visibleState.role, "member");
    assert.equal(visibleState.archive.length, 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
  await oldPage.unroute("**/api/state");
  const revoked = oldPage.waitForResponse(
    (response) =>
      response.url().endsWith("/api/state") && response.status() === 401,
  );
  await oldPage.reload();
  await revoked;
  await oldPage.getByRole("button", { name: /રિક્વેસ્ટ મોકલો/ }).waitFor();
  const fresh = await oldPage.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("mvpmi-preview-session"));
    const state = await (
      await fetch("/api/state", {
        headers: { "X-MVPMI-Session": session.token },
      })
    ).json();
    return { token: session.token, role: state.role, members: state.members };
  });
  assert.notEqual(fresh.token, oldToken);
  assert.equal(fresh.role, "guest");
  assert.deepEqual(fresh.members, []);
  console.log(
    "PASS: admin-assisted recovery UI, code clearing, invalid-code feedback, cookie/no-cookie login + reload, old-device revocation; recovery dialogs have zero reported axe violations.",
  );
}
