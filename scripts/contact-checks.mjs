import assert from "node:assert/strict";

// Intercept external navigation: never place a call or contact a synthetic number.
async function checkSurface(surface, target, mode) {
  await surface.getByRole("button", { name: /All Members/ }).click();
  await surface.getByTestId("Call").waitFor();
  await surface.evaluate((mode) => {
    window.contactAttempts = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value:
        mode === "missing"
          ? undefined
          : {
              writeText: () => {
                if (mode === "throws")
                  throw new DOMException(
                    "Clipboard blocked",
                    "NotAllowedError",
                  );
                return Promise.reject(
                  new DOMException("Clipboard denied", "NotAllowedError"),
                );
              },
            },
    });
    document.addEventListener(
      "click",
      (event) => {
        const link = event.target.closest("a[href]");
        if (link && /^(tel:|https:\/\/wa.me\/)/.test(link.href)) {
          window.contactAttempts.push({
            href: link.href,
            target: link.target,
            rel: link.rel,
          });
          event.preventDefault();
        }
      },
      true,
    );
  }, mode);
  for (const [title, href] of [
    ["Call", "tel:+919000000001"],
    ["WhatsApp", "https://wa.me/919000000001"],
  ]) {
    const button = surface.getByTestId(title);
    assert.equal(await button.getAttribute("href"), href);
    assert.equal(await button.getAttribute("target"), target);
    // Enter exercises keyboard activation of the real link, not only pointer clicks.
    await button.focus();
    await button.press(title === "Call" ? "Enter" : "Space");
    const dialog = surface.getByRole("dialog");
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Requested/);
    const retry = dialog.locator("a[href]");
    assert.equal(await retry.getAttribute("href"), href);
    await retry.click();
    // The original sheet closes on backdrop/number click; retries still dispatch.
    await surface.getByTestId(title).waitFor();
  }
  const attempts = await surface.evaluate(() => window.contactAttempts);
  assert.equal(attempts.length, 4);
  for (const a of attempts) {
    assert.equal(a.target, target);
    assert.match(a.rel, /noopener/);
    assert.match(a.rel, /noreferrer/);
  }
}

export async function checkContactActions(browser, context, url) {
  const errors = [];
  for (const mode of ["missing", "throws", "rejects"]) {
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await checkSurface(page, "_blank", mode);
    await page.close();
  }
  const embedded = await context.newPage();
  embedded.on("pageerror", (e) => errors.push(e.message));
  await embedded.goto(url);
  await embedded.setContent(
    `<iframe title="Restricted preview" sandbox="allow-scripts allow-same-origin" src="${url}" style="width:450px;height:920px"></iframe>`,
  );
  const frame = embedded.frameLocator("iframe");
  await frame.getByRole("button", { name: /All Members/ }).waitFor();
  // FrameLocator lacks evaluate: obtain the actual same-origin frame for injection.
  await checkSurface(embedded.frames()[1], "_blank", "throws");
  await embedded.close();
  // Exercise actual browser default navigation with a mocked destination; no real WhatsApp request.
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "Mock WhatsApp destination",
    }),
  );
  for (const allowPopups of [false, true]) {
    const host = await context.newPage();
    host.on("pageerror", (e) => errors.push(e.message));
    const consoleMessages = [];
    host.on("console", (m) => consoleMessages.push(m.text()));
    await host.goto(url);
    await host.setContent(
      `<iframe sandbox="allow-scripts allow-same-origin ${allowPopups ? "allow-popups" : ""}" src="${url}" style="width:450px;height:920px"></iframe>`,
    );
    const framed = host.frameLocator("iframe");
    await framed.getByRole("button", { name: /All Members/ }).click();
    if (allowPopups) {
      const opened = context.waitForEvent("page");
      await framed.getByTestId("WhatsApp").click();
      const popup = await opened;
      await popup.waitForURL("https://wa.me/919000000001");
      await popup.waitForLoadState();
      assert.equal(
        await popup.locator("body").innerText(),
        "Mock WhatsApp destination",
      );
      assert.equal(await popup.evaluate(() => window.opener), null);
      await popup.close();
    } else {
      await framed.getByTestId("WhatsApp").click();
      await framed.getByRole("dialog").waitFor();
      assert(
        consoleMessages.some((m) => /blocked opening|allow-popups/i.test(m)),
        "Restricted iframe must actually block the popup",
      );
      assert.match(
        await framed.getByRole("dialog").innerText(),
        /preview or popup blocker/,
      );
    }
    await host.close();
  }
  await context.unroute("https://wa.me/**");
  const native = await browser.newContext({
    storageState: await context.storageState(),
    userAgent: "Mozilla/5.0 Android MVPMlAndroid/0.1",
    viewport: { width: 412, height: 892 },
  });
  const page = await native.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await checkSurface(page, "_self", "missing");
  await native.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: contact links + retry sheets, keyboard activation, absent/throwing/rejecting clipboard, restricted iframe and Android-UA routing. External navigation intercepted; real OS apps not tested.",
  );
}
