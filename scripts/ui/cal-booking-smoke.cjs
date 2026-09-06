const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MARKETING_URL || "http://127.0.0.1:3103";
// The real React SDK runs; only the external embed service is replaced.
const embedFixture = `
const queued = window.Cal;
window.__calUi = [];
function command(name, options) {
  if (name === "ui") window.__calUi.push(options);
  if (name !== "inline") return;
  const frame = document.createElement("iframe");
  frame.title = "Calendar fixture";
  frame.src = "https://cal.com/" + options.calLink + "?theme=" + options.config.theme;
  options.elementOrSelector.appendChild(frame);
}
function cal(name, namespace) {
  if (name === "init" && typeof namespace === "string") cal.ns[namespace] = command;
  else command(name, namespace);
}
cal.ns = {};
Object.entries(queued.ns || {}).forEach(([namespace, fn]) => {
  cal.ns[namespace] = command;
  (fn.q || []).forEach(args => command(...args));
});
(queued.q || []).forEach(args => cal(...args));
window.Cal = cal;
`;

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
          await route.fulfill(route.request().url().endsWith("/embed.js")
            ? { contentType: "application/javascript", body: embedFixture }
            : { contentType: "text/html", body: "<h1>Calendar fixture — no real bookings</h1>" });
        });
        await page.addInitScript((language) => {
          localStorage.setItem("openvoiss.lang", language);
          localStorage.setItem("voysse.theme", "dark");
        }, lang);
        const cases = [
          [lang === "es" ? "Ver Cloud con Alex" : "Explore Cloud with Alex", "https://cal.com/voysse/voysse-cloud", "20 min"],
          [lang === "es" ? "Agendar con Alex" : "Book a call with Alex", "https://cal.com/voysse/hablemos-de-tu-proyecto", "30 min"],
        ];
        for (const [label, destination, duration] of cases) {
          await page.goto(base);
          const button = page.getByRole("button", { name: label, exact: true });
          await button.waitFor();
          assert.equal(await page.locator('[role="dialog"]').count(), 0);
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
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          const iframe = dialog.locator("iframe");
          await iframe.waitFor();
          assert.equal(await iframe.getAttribute("src"), destination + "?theme=light");
          assert(await page.evaluate(() => window.__calUi.some(ui => ui.theme === "light" && ui.styles?.body?.background === "#ffffff")));
          assert.equal(page.url(), base + "/");
          assert.equal(await dialog.evaluate(e => getComputedStyle(e).backgroundColor), "rgb(255, 255, 255)");
          assert.equal(await dialog.evaluate(e => getComputedStyle(e).colorScheme), "light");
          assert(await page.evaluate(() => document.documentElement.classList.contains("dark")));
          assert(calRequests.length > before);
          assert.equal(await dialog.locator('a[target="_blank"]').getAttribute("href"), destination);
          assert(await dialog.evaluate(e => e.getBoundingClientRect().width <= innerWidth));
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert(await button.evaluate(e => document.activeElement === e));
          await button.click();
          await dialog.waitFor();
          await dialog.getByRole("button", { name: lang === "es" ? "Cerrar calendario" : "Close calendar" }).click();
          await dialog.waitFor({ state: "hidden" });
        }
        assert.deepEqual(leads, []);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
    const blocked = await browser.newPage();
    await blocked.route("https://cal.com/**", route => route.abort());
    await blocked.goto(base);
    await blocked.locator(".cy-plans button").first().click();
    const fallback = blocked.getByRole("dialog").locator('a[target="_blank"]');
    await fallback.waitFor();
    assert((await fallback.getAttribute("href")).endsWith("/voysse/voysse-cloud"));
    await blocked.keyboard.press("Escape");
    await blocked.getByRole("dialog").waitFor({ state: "hidden" });
    await blocked.close();
    console.log("PASS Cal CTAs: ES/EN, 1440/390/320, correct destinations, light in-page dialogs on dark sites, lazy embeds, close/reopen, focus restoration, no lead POST.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
