import assert from "node:assert/strict";
export async function checkBilingualSorting(browser, store, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.getByTestId("Language").waitFor();
  await page.getByPlaceholder(/અશોકભાઈ|Ashokbhai/).fill("Alpha");
  await page.getByPlaceholder(/ચૌધરી|Chaudhary/).fill("Test");
  await page.locator('input[inputmode="numeric"]').first().fill("9000000061");
  await page.getByRole("combobox",{name:/Village|ગામ/}).selectOption("થોરાળા");
  await page.getByRole("button", { name: /Send request|રિક્વેસ્ટ મોકલો/ }).click();
  await page.getByRole("button", { name: /Submit request|વિનંતી મોકલો/ }).click();
  await page.getByRole("button", { name: /Withdraw|કેન્સલ કરો/ }).waitFor();
  const request = store
    .all("requests")
    .find((r) => r.payload.phone === "9000000061");
  store.put("members", {
    ...request.payload,
    id: "sort-alpha",
    owner: request.owner,
    nameGu: "કસોટી અ",
    approvedAt: Date.now(),
  });
  store.put("members", {
    ...request.payload,
    id: "sort-zulu",
    owner: "sort-fixture",
    name: "Zulu Test",
    nameGu: "અન્ય કસોટી",
    phone: "9000000062",
    approvedAt: Date.now(),
  });
  store.del("requests", request.id);
  await page.reload();
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).waitFor();
  await page.locator(".village-tile svg").first().waitFor();
  assert.equal(await page.locator(".village-tile").count(), 7);
  assert.equal(await page.locator(".village-tile svg defs").count(), 7);
  await page.screenshot({
    path: "test-results/liquid-glass/directory-gu-light.png",
  });
  await page.getByRole("button", { name: /All Members|બધા સભ્યો/ }).click();
  for (const lang of ["gu", "en"]) {
    if ((await page.locator(".app").getAttribute("data-lang")) !== lang)
      await page.getByTestId("Language").click();
    // One language at a time: only the selected script is rendered, and the
    // directory order stays stable across languages.
    const shown =
      lang === "en"
        ? [
            ["Alpha Test", "Zulu Test"],
            ["કસોટી અ", "અન્ય કસોટી"],
          ]
        : [
            ["કસોટી અ", "અન્ય કસોટી"],
            ["Alpha Test", "Zulu Test"],
          ];
    // The list sorts by the visible script in each language.
    const ordered =
      lang === "en"
        ? ["Alpha Test", "Zulu Test"]
        : ["અન્ય કસોટી", "કસોટી અ"];
    const first = await page
      .getByText(ordered[0], { exact: true })
      .boundingBox();
    const second = await page
      .getByText(ordered[1], { exact: true })
      .boundingBox();
    assert.ok(first && second, lang + " shows its own script");
    assert.equal(
      first.y < second.y,
      true,
      "Directory sorts by the visible script in " + lang,
    );
    const hidden = shown[1];
    for (const name of hidden)
      assert.equal(
        await page.getByText(name, { exact: true }).count(),
        0,
        lang + " hides the alternate script (" + name + ")",
      );
  }
  await context.close();
  console.log(
    "PASS: one language at a time per selection; directory sorting follows the visible script; seven original Sun-mark village tiles.",
  );
}
