const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const web = process.env.WEB_URL || "http://localhost:3101";
const marketing = process.env.MARKETING_URL || "http://localhost:3102";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(marketing);
    const avatar = page.locator("[data-bloub]").first();
    await page.waitForFunction(
      () => document.querySelector("[data-bloub]")?.dataset.animated === "true",
    );
    const before = await avatar.innerHTML();
    await page.waitForTimeout(300);
    assert.notEqual(
      await avatar.innerHTML(),
      before,
      "visible avatar animates",
    );
    assert.equal(await page.getByRole("button", { name: /Bloub|Voxy/ }).count(), 0, "no companion playback controls");
    await page.getByText("Voxy", { exact: true }).waitFor();
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-bloub]")?.dataset.animated === "false",
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(
      () => document.querySelector("[data-bloub]")?.dataset.animated === "true",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("[data-bloub]")].every(
        (n) => n.dataset.animated === "false",
      ),
    );
    const ids = await page
      .locator("[data-bloub] mask")
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    assert.equal(new Set(ids).size, ids.length, "unique SVG masks");
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({
        status: 401,
        json: { detail: "Invalid credentials" },
      });
    });
    await page.goto(web + "/login");
    await page.locator('input[name="email"]').fill("test@example.test");
    await page.locator('input[name="password"]').fill("test-password");
    await page.locator('button[type="submit"]').click();
    await page.locator('[data-bloub][data-mood="thinking"]').waitFor();
    await page.locator('[data-bloub][data-mood="error"]').waitFor();
    assert.equal(
      await page.locator("[data-bloub]").getAttribute("data-animated"),
      "false",
      "reduced motion keeps error state static",
    );
    await page.route("**/api/widget/demo", (r) =>
      r.fulfill({
        json: {
          title: "Demo",
          greeting: "Hello",
          color: "#7c3aed",
          agency_name: "Tenant",
          agency_logo_url: null,
        },
      }),
    );
    await page.route("**/api/widget/demo/history?*", (r) =>
      r.fulfill({ json: { messages: [] } }),
    );
    await page.route("**/api/widget/demo/messages", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await r.fulfill({
        json: { reply: "Test reply", mode: "ai", messages: [] },
      });
    });
    await page.goto(web + "/widget/demo");
    await page.locator('input[name="message"]').fill("Test");
    await page.locator('button[type="submit"]').click();
    await page.locator('[data-bloub][data-mood="thinking"]').waitFor();
    await page.getByText("Test reply").waitFor();
    assert.equal(
      await page.locator('[data-bloub][data-mood="thinking"]').count(),
      0,
      "busy avatar clears on response",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => localStorage.setItem("voysse.bloub.paused", "true"));
    await page.goto(web + "/login");
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-bloub]").getAttribute("data-animated"), "true", "obsolete pause preference does not silently freeze Voxy");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: animation, no visible playback controls, renamed Voxy, ignored legacy pause preference, offscreen pause, live reduced-motion changes, unique masks, real login error and widget busy/success UI states with fixtures.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
