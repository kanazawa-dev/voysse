const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const base of [
      process.env.MARKETING_URL || "http://localhost:3102",
      process.env.WEB_URL || "http://localhost:3101",
    ]) {
      const page = await browser.newPage({ reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + (base.includes("3102") ? "/" : "/login"));
      const trigger = page.locator(".cy-language-trigger");
      await trigger.waitFor();
      assert.equal(
        await trigger.evaluate((e) => getComputedStyle(e).borderRadius),
        "0px",
      );
      await trigger.click();
      const menu = page.locator(".cy-language-menu");
      await menu.waitFor();
      assert.equal(
        await menu.evaluate((e) => getComputedStyle(e).backgroundColor),
        "rgb(250, 250, 250)",
      );
      assert.equal(
        await menu.evaluate((e) => getComputedStyle(e).borderRadius),
        "2px",
      );
      await page.getByRole("menuitemradio", { name: "English" }).click();
      await menu.waitFor({ state: "hidden" });
      assert.match(await trigger.innerText(), /EN/);
      await trigger.click();
      await page.getByRole("menuitemradio", { name: "Español" }).click();
      await menu.waitFor({ state: "hidden" });
      assert.match(await trigger.innerText(), /ES/);
      await trigger.focus();
      await page.keyboard.press("Enter");
      await menu.waitFor();
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      await page.setViewportSize({ width: 320, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(
      "PASS language control: both apps, rectangular menu, ES/EN switching, keyboard Escape and 320px.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
