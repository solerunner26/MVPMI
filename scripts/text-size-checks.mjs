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
    if (document.body.scrollWidth > innerWidth + 1)
      bad.push({ pageOverflow: true });
    return bad;
  });
  assert.deepEqual(overflow, [], label);
}

export async function checkTextSizes(context, url) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByTestId("My profile").click();
  const choices = [
    ["Default", 100],
    ["Big", 120],
    ["Bigger", 140],
    ["Biggest", 160],
  ];
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    for (const lang of ["gu", "en"]) {
      if ((await page.locator(".app").getAttribute("data-lang")) !== lang)
        await page.getByTestId("Language").click();
      for (const [name, percent] of choices) {
        const translated = {
          Default: "મૂળ માપ",
          Big: "મોટું",
          Bigger: "વધુ મોટું",
          Biggest: "સૌથી મોટું",
        };
        const button = page.getByRole("button", {
          name: lang === "gu" ? translated[name] : name,
          exact: true,
        });
        await button.click();
        assert.equal(await button.getAttribute("aria-pressed"), "true");
        assert.equal(
          await page.locator('.text-size-option[aria-pressed="true"]').count(),
          1,
        );
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
        await assertFits(page, `profile ${width} ${lang} ${name}`);
        if (width === 360 && lang === "en" && name === "Biggest") {
          await button.scrollIntoViewIfNeeded();
          await page.screenshot({ path: "test-results/text-size-biggest.png" });
        }
        await page
          .getByRole("button", {
            name: /યાદીમાં પાછા જાઓ|Back to directory/,
            exact: true,
          })
          .click();
        await assertFits(page, `directory tiles ${width} ${lang} ${name}`);
        await page
          .getByRole("button", { name: /બધા સભ્યો|All Members/ })
          .click();
        await page.getByTestId("Call").waitFor();
        await assertFits(page, `directory list ${width} ${lang} ${name}`);
        await page.getByTestId("My profile").click();
      }
    }
  }
  await page.reload();
  await page.getByTestId("My profile").click();
  assert.equal(
    await page
      .getByRole("button", { name: "Biggest", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByTestId("Theme").click();
  await assertFits(page, "Biggest alternate theme");
  await page.getByRole("button", { name: "Default", exact: true }).click();
  await page.reload();
  await page.getByTestId("My profile").click();
  assert.equal(
    await page
      .getByRole("button", { name: "Default", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.deepEqual(errors, []);
  await page.close();
  console.log(
    "PASS: four text presets; 320/360/412px, Gujarati/English profile and directory control overflow; selection, persistence and Default reset.",
  );
}
