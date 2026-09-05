const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MARKETING_URL || "http://localhost:3102";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (/hydration|didn't match|Base UI:/i.test(m.text()))
        errors.push(m.text());
    });
    await page.addInitScript(() =>
      localStorage.setItem("openvoiss.lang", "es"),
    );
    await page.goto(base, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", {
        name: "Tu agencia, conectada. Tus agentes, con IA.",
      })
      .waitFor();
    assert.equal(await page.locator("video").count(), 0);
    assert.equal(await page.locator(".cy-section").count(), 7);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-violet")
          .trim(),
      ),
      "#5135ff",
    );
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow at ${width}`,
      );
      for (const target of [
        "#features",
        "#channels",
        "#workspace",
        "#control",
        "#pricing",
        "#faq",
      ])
        assert.equal(await page.locator(target).count(), 1);
    }
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page
      .locator(".cy-nav-links summary")
      .filter({ hasText: "Producto" })
      .click();
    await page
      .locator(".cy-nav-dropdown a")
      .filter({ hasText: "Agentes y conocimiento" })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Abrir menú" })
        .getAttribute("aria-expanded"),
      "false",
    );
    const faq = page.locator(".cy-faq details").first();
    await faq.locator("summary").click();
    assert.equal(await faq.getAttribute("open"), "");
    await page.locator(".cy-cloud-trigger").click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    // Existing account route and legal links remain real, not dummy buttons.
    assert.match(
      await page.locator(".cy-hero .cy-action").first().getAttribute("href"),
      /\/login$/,
    );
    assert.equal(
      await page.locator('.cy-footer a[href="/privacy"]').count(),
      1,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/voysse-cypon-320.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({
      path: "/tmp/voysse-cypon-final.png",
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".cy-action")
        .first()
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    // English still works through the real language control.
    await page
      .locator(".cy-nav-right button")
      .filter({ hasText: "ES" })
      .click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await page
      .getByRole("heading", {
        name: "Your agency, connected. Your agents, with AI.",
      })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS Cypon identity: ES/EN, 7 sections, navigation, FAQ, Cloud dialog, no video, reduced motion, no hydration errors, 1440/1024/768/390/320. No real interest submission.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
