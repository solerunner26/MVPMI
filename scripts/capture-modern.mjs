import { chooseLanguage,chooseTheme } from "./preferences-checks.mjs";
import { mkdirSync } from "node:fs";
import { setTextSize, assertFits } from "./text-size-checks.mjs";
// Optional visual evidence only; drives public controls, never rewrites app state.
export async function captureModernVariants(page, name) {
  if (
    !process.env.CAPTURE_DESIGN ||
    !["directory-tiles", "directory-list", "profile", "admin-home"].includes(
      name,
    )
  )
    return;
  const folder = "test-results/modern-design/screens";
  mkdirSync(folder, { recursive: true });
  const original = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mvpmi-preferences")),
  );
  const set = async (lang, theme, size) => {
    await page.getByTestId("Reading settings").click();
    await chooseLanguage(page,lang);
    await chooseTheme(page,theme);
    await setTextSize(page, size);
    await page.getByRole("button", { name: /Close|બંધ કરો/ }).click();
    await page
      .locator(".noscroll")
      .evaluateAll((nodes) => nodes.forEach((el) => (el.scrollTop = 0)));
    await page.evaluate(() => document.fonts.ready);
  };
  for (const lang of ["gu", "en"])
    for (const theme of ["light", "dark"]) {
      await set(lang, theme, 100);
      await assertFits(page, `capture ${name} ${lang} ${theme}`);
      await page.screenshot({
        path: `${folder}/${name}-${lang}-${theme}-100.png`,
      });
    }
  if (name === "admin-home") {
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 1120, height: 900 });
    await assertFits(page, "desktop dashboard");
    await page.screenshot({ path: `${folder}/admin-desktop.png` });
    await page.setViewportSize(viewport);
  }
  await set(original.lang, original.theme, original.fsPct);
}
