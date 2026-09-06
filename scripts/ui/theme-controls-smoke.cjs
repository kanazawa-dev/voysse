const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [base, paths] of [
      [process.env.MARKETING_URL || "http://127.0.0.1:3103", ["/", "/privacy"]],
      [process.env.WEB_URL || "http://127.0.0.1:3101", ["/clients", "/login", "/admin/login"]],
    ]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/api/**", route => route.fulfill({ json:
        route.request().url().endsWith("/auth/me")
          ? { id: "u", name: "Alex", email: "alex@example.test", role: "admin", agency: { id: "a", name: "Studio", slug: "studio" } }
          : [] }));
      for (const path of paths) {
        await page.goto(base + path);
        const toggle = page.locator(".cy-theme-toggle");
        await toggle.waitFor();
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await toggle.click();
          const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
          assert.equal(await page.evaluate(() => localStorage.getItem("voysse.theme")), dark ? "dark" : "light");
          assert.equal(await toggle.evaluate(e => e.getBoundingClientRect().width), 44, base + path + " width " + width);
          assert.equal(await toggle.evaluate(e => e.getBoundingClientRect().height), 36, path + " theme height");
          for (const language of await page.locator(".cy-language-trigger:visible").all()) {
            const themeBox = await toggle.boundingBox();
            const languageBox = await language.boundingBox();
            assert.equal(themeBox.height, languageBox.height, path + " matching control heights");
            if (paths.includes("/privacy")) {
              assert(Math.abs(themeBox.y - languageBox.y) < 1, path + " header alignment");
            }
          }
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + " overflow " + width);
          await page.reload();
          await toggle.waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), dark);
          await toggle.focus();
          assert.notEqual(await toggle.evaluate(e => getComputedStyle(e).outlineStyle), "none");
          if (path === "/" && width === 320) await page.screenshot({ path: base.includes("3103") ? "/tmp/marketing-theme-mobile.png" : "/tmp/web-theme-mobile.png" });
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("PASS themes: landing/legal/dashboard/auth, toggle persistence, keyboard and 1440/390/320 widths.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
