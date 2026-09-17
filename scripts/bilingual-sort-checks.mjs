import assert from "node:assert/strict";
export async function checkBilingualSorting(browser, store, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.getByTestId("Language").waitFor();
  await page.locator("input").nth(0).fill("Alpha Test");
  await page.locator("input").nth(1).fill("9000000061");
  await page.locator("input").nth(2).fill("Thorala");
  await page.getByRole("button", { name: /Send request/ }).click();
  await page.getByRole("button", { name: /Submit request/ }).click();
  await page.getByRole("button", { name: /Withdraw/ }).waitFor();
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
  await page.getByRole("button", { name: /All Members/ }).waitFor();
  await page.locator(".village-tile svg").first().waitFor();
  assert.equal(await page.locator(".village-tile").count(), 7);
  assert.equal(await page.locator(".village-tile svg defs").count(), 7);
  await page.screenshot({
    path: "test-results/liquid-glass/directory-gu-light.png",
  });
  await page.getByRole("button", { name: /All Members/ }).click();
  for (const lang of ["gu", "en"]) {
    if ((await page.locator(".app").getAttribute("data-lang")) !== lang)
      await page.getByTestId("Language").click();
    const alpha = await page
      .getByText("Alpha Test", { exact: true })
      .boundingBox();
    const zulu = await page
      .getByText("Zulu Test", { exact: true })
      .boundingBox();
    assert.equal(
      alpha.y < zulu.y,
      lang === "en",
      "Sort order follows primacy, not whichever spelling is rendered first",
    );
    for (const name of ["Alpha Test", "કસોટી અ", "Zulu Test", "અન્ય કસોટી"])
      assert.equal(await page.getByText(name, { exact: true }).count(), 1);
  }
  await context.close();
  console.log(
    "PASS: two-script member names stay visible; Gujarati/English sorting actually reverses the fixture order; seven original Sun-mark village tiles.",
  );
}
