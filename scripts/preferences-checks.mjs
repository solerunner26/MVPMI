// Exercise the actual new preferences navigation, never hidden test controls.
export async function toggleTheme(page) {
  const theme = await page.locator(".app").getAttribute("data-theme");
  const open = (await page.getByTestId("Light theme").count()) > 0;
  if (!open) await page.getByTestId("Reading settings").click();
  await page
    .getByTestId(theme === "dark" ? "Light theme" : "Dark theme")
    .click();
  if (!open) await page.getByRole("button", { name: /Close|બંધ કરો/ }).click();
}
export async function openMemberHelp(page) {
  await page.getByTestId("Reading settings").click();
  await page.getByTestId("Member help").click();
}
