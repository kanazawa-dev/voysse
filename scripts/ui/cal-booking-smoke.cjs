const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MARKETING_URL || "http://127.0.0.1:3102";

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const lang of ["es", "en"]) {
      for (const width of [1440, 390, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const errors = [], calRequests = [], leads = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (/hydration|didn't match|Base UI:/i.test(message.text())) errors.push(message.text());
        });
        page.on("request", (request) => {
          if (request.url().includes("/api/public/cloud-interest")) leads.push(request.url());
        });
        await page.route("https://cal.com/**", async (route) => {
          calRequests.push(route.request().url());
          await route.fulfill({ contentType: "text/html", body: "<h1>Booking destination fixture</h1>" });
        });
        await page.addInitScript((language) => localStorage.setItem("openvoiss.lang", language), lang);
        const cases = [
          [lang === "es" ? "Ver Cloud con Alex" : "Explore Cloud with Alex", "https://cal.com/voysse/voysse-cloud", "20 min"],
          [lang === "es" ? "Agendar con Alex" : "Book a call with Alex", "https://cal.com/voysse/hablemos-de-tu-proyecto", "30 min"],
        ];
        for (const [label, destination, duration] of cases) {
          await page.goto(base);
          const button = page.getByRole("link", { name: label, exact: true });
          await button.waitFor();
          assert.equal(await button.getAttribute("href"), destination);
          assert.equal(await page.locator(".cy-plans [role=dialog]").count(), 0);
          assert.equal(await page.locator('iframe[src*="cal.com"]').count(), 0);
          assert.equal(await page.locator('script[src*="cal.com"]').count(), 0);
          const card = page.locator(".cy-plans article").filter({ has: button });
          assert.match(await card.locator(".cy-booking-note").innerText(), new RegExp(duration));
          assert.equal(await card.locator('a[href="mailto:alex@voysse.cl"]').count(), 1);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          const before = calRequests.length;
          await button.focus();
          assert(await button.evaluate((element) => document.activeElement === element));
          assert.notEqual(await button.evaluate((element) => getComputedStyle(element).outlineStyle), "none");
          await page.keyboard.press("Enter");
          await page.waitForURL(destination);
          assert.equal(calRequests.length, before + 1);
        }
        assert.deepEqual(leads, []);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
    console.log("PASS Cal CTAs: ES/EN, 1440/390/320, correct destinations, keyboard focus/navigation, no lead POST or calendar embed.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
