import {chooseTheme} from "./preferences-checks.mjs";
import assert from "node:assert/strict";
import { assertFits, setTextSize } from "./text-size-checks.mjs";
export async function checkModernPreferences(page) {
  assert.equal(
    await page.locator(".utility-bar").count(),
    0,
    "Rejected dock must be absent, not hidden",
  );
  assert.equal(await page.locator(".main-header").count(), 1);
  assert.equal(
    await page.locator(".main-header").getByTestId("Reading settings").count(),
    1,
  );
  assert.equal(
    await page.locator(".main-header").getByTestId("Language").count(),
    1,
  );
  await page.getByTestId("Reading settings").click();
  assert.equal(await page.getByRole("dialog").count(), 1);
  assert.equal(await page.locator('.language-options,.theme-options').count(),0,'Settings must not duplicate the header controls');
  for (const theme of ['dark','light']){await chooseTheme(page,theme);assert.equal(await page.locator('.app').getAttribute('data-theme'),theme);}
  for (const size of [85, 165, 100]) {
    await setTextSize(page, size);
    await assertFits(page, "Modern preferences " + size);
  }
  await page.getByRole("button", { name: /Close/ }).click();
  assert.equal(
    await page
      .getByTestId("Reading settings")
      .evaluate((el) => el === document.activeElement),
    true,
    "Restore focus to header",
  );
  await page.getByTestId("Reading settings").click();
  await page.getByTestId("Member help").click();
  assert.equal(
    await page.getByRole("dialog").count(),
    1,
    "Help must replace, not stack on, preferences",
  );
  assert.equal(await page.getByTestId("Light theme").count(), 0);
  assert.equal(await page.evaluate(() => window.mvpmiBack()), true);
  assert.equal(await page.getByRole("dialog").count(), 0);
  console.log(
    "PASS: dock removed; one global header; header-only language/theme controls; 85–165% preferences; focus return and non-stacking help.",
  );
}
export async function checkModernDirectory(page) {
  assert.equal(await page.locator(".directory-heading h1").count(), 1);
  const modes = page.locator(".directory-segments");
  assert.equal(await modes.locator("button").count(), 2);
  await modes.getByRole("button", { name: /Villages/ }).click();
  assert.equal(
    await modes
      .getByRole("button", { name: /Villages/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".collection-tile").count(), 7);
  assert.equal(
    await page.locator(".collection-tile svg defs").count(),
    7,
    "Original Sun retained",
  );
  await page.locator(".collection-tile").first().click();
  assert.match(
    await page.locator(".directory-heading h1").innerText(),
    /Thorala|થોરાળા/,
  );
  assert.equal(
    await modes
      .getByRole("button", { name: /Villages/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  await modes.getByRole("button", { name: /All Members/ }).click();
  assert.equal(
    await modes
      .getByRole("button", { name: /All Members/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  for (const action of ["Call", "WhatsApp"])
    assert.match(
      await page.getByTestId(action).first().innerText(),
      new RegExp(action),
    );
  console.log(
    "PASS: directory search hierarchy, two real modes, seven illustrated Sun tiles, selected-village heading and labelled contact actions.",
  );
}
