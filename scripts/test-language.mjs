// Existing workflow tests use English labels. Dedicated language tests exercise the real Gujarati default.
export function useEnglishForLegacyFlows(browser) {
  const create = browser.newContext.bind(browser);
  browser.gujaratiContext = create;
  browser.newContext = async (...args) => {
    const context = await create(...args);
    await context.addInitScript(() => {
      try {
        if (!localStorage.getItem("mvpmi-preferences"))
          localStorage.setItem(
            "mvpmi-preferences",
            JSON.stringify({ lang: "en" }),
          );
      } catch {}
    });
    return context;
  };
}
