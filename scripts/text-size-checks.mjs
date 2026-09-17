import assert from "node:assert/strict";

export async function assertFits(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(
      '.app button, .app [role="button"], .app .bi',
    )) {
      if (!el.getClientRects().length || !el.clientWidth || !el.clientHeight)
        continue;
      if (
        el.scrollWidth > el.clientWidth + 2 ||
        el.scrollHeight > el.clientHeight + 2
      )
        bad.push({
          text: el.textContent.trim().slice(0, 90),
          width: [el.clientWidth, el.scrollWidth],
          height: [el.clientHeight, el.scrollHeight],
        });
    }
    for (const region of document.querySelectorAll(".app .noscroll")) {
      const first = [...region.children].find(
        (el) => el.getClientRects().length,
      );
      if (
        first &&
        first.getBoundingClientRect().top <
          region.getBoundingClientRect().top - region.scrollTop - 2
      )
        bad.push({ unreachableTop: first.textContent.trim().slice(0, 70) });
    }
    for (const button of document.querySelectorAll(
      '.app button:not(:disabled), .app a[role="button"]',
    )) {
      if (!button.getClientRects().length) continue;
      const rect = button.getBoundingClientRect();
      if (rect.width < 47.5 || rect.height < 47.5)
        bad.push({
          smallTarget: button.textContent.trim(),
          width: rect.width,
          height: rect.height,
        });
    }
    if (document.body.scrollWidth > innerWidth + 1)
      bad.push({ pageOverflow: true });
    return bad;
  });
  assert.deepEqual(overflow, [], label);
}

export async function setTextSize(page, percent) {
  await page.locator('input[type="range"]').last().fill(String(percent));
}
export async function checkTextSizes(context, url) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByTestId("My profile").click();
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    for (const lang of ["gu", "en"]) {
      if ((await page.locator(".app").getAttribute("data-lang")) !== lang)
        await page.getByTestId("Language").click();
      for (const percent of [85, 100, 125, 165]) {
        await setTextSize(page, percent);
        assert.equal(
          await page
            .locator(".app")
            .evaluate((e) => e.style.getPropertyValue("--fs")),
          (percent / 100).toFixed(2),
        );
        assert.equal(
          await page.evaluate(
            () => JSON.parse(localStorage.getItem("mvpmi-preferences")).fsPct,
          ),
          percent,
        );
        await assertFits(page, `profile ${width} ${lang} ${percent}`);
        await page
          .getByRole("button", { name: /Back to directory|યાદીમાં પાછા જાઓ/ })
          .click();
        await assertFits(page, `tiles ${width} ${lang} ${percent}`);
        await page.getByRole("button", { name: /All Members/ }).click();
        await page.getByTestId("Call").waitFor();
        await assertFits(page, `members ${width} ${lang} ${percent}`);
        await page.getByTestId("My profile").click();
      }
    }
  }
  await page.reload();
  await page.getByTestId("My profile").click();
  const range = page.locator('input[type="range"]');
  assert.equal(await range.inputValue(), "165");
  await range.focus();
  await page.keyboard.press("Home");
  assert.equal(await range.inputValue(), "85");
  await page.keyboard.press("ArrowRight");
  assert.equal(await range.inputValue(), "86");
  await page.keyboard.press("End");
  assert.equal(await range.inputValue(), "165");
  await page.getByTestId("Theme").click();
  await assertFits(page, "165 alternate theme");
  await page.getByRole("button", { name: /Reset to 100%/ }).click();
  await page.reload();
  await page.getByTestId("My profile").click();
  assert.equal(await page.locator('input[type="range"]').inputValue(), "100");
  assert.deepEqual(errors, []);
  await page.close();
  console.log(
    "PASS: 85–165% slider; 320/360/412px × both languages × 4 sizes; profile, tiles, member list, keyboard, persistence and reset.",
  );
}
