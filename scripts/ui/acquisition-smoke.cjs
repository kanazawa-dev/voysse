const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MARKETING_URL || "http://localhost:3196";
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const events = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/acquisition/events", async route => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": base, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type",
      } });
      const request = route.request();
      events.push(request.postDataJSON());
      assert.equal(request.headers().referer, undefined);
      assert.equal(request.headers().cookie, undefined);
      await route.fulfill({ status: 204, headers: { "access-control-allow-origin": base } });
    });
    // Exercise arbitrary new channels and normalization, not just launch sites.
    for (const source of ["hn", "reddit", "producthunt", "linkedin", "podcast-42", " NEW_partner "]) {
      const previous = events.length;
      await page.goto(base + "/?utm_source=" + encodeURIComponent(source) + "&email=never-send@example.test");
      await page.waitForFunction(() => document.querySelector(".cy-action"));
      await page.waitForTimeout(400);
      assert.deepEqual(events.slice(previous), [{ source: source.trim().toLowerCase(), event: "pageview" }]);
    }
    // Dispatch a real DOM click but prevent navigation so all CTA counters can be checked together.
    for (const [selector, event] of [
      ['a[href$="/login"]', "app"], ['a[href="https://docs.voysse.cl/docs"]', "docs"],
      ['a[href="https://github.com/kanazawa-dev/voysse"]', "github"],
      ['[data-acquisition-booking]', "booking"],
    ]) {
      const before = events.length;
      await page.locator(selector).first().evaluate(el => {
        el.addEventListener("click", e => e.preventDefault(), { once: true });
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(150);
      assert.deepEqual(events[before], { source: "new_partner", event });
      if (event === "booking") await page.keyboard.press("Escape");
    }
    for (const source of ["", "<script>", "a".repeat(81), "two words"]) {
      const before = events.length;
      await page.goto(base + "/?utm_source=" + encodeURIComponent(source));
      await page.waitForTimeout(300);
      assert.equal(events.length, before);
    }
    await page.goto(base);
    await page.waitForTimeout(300);
    assert.deepEqual(events.at(-1), { source: "direct", event: "pageview" });
    for (const signal of ["doNotTrack", "globalPrivacyControl"]) {
      const privatePage = await browser.newPage();
      let requests = 0;
      await privatePage.addInitScript(({ signal }) => Object.defineProperty(navigator, signal, { value: signal === "doNotTrack" ? "1" : true }), { signal });
      privatePage.on("request", request => { if (request.url().includes("/acquisition/events")) requests++; });
      await privatePage.goto(base + "/?utm_source=private");
      await privatePage.waitForTimeout(400);
      assert.equal(requests, 0);
      await privatePage.close();
    }
    const admin = await browser.newPage();
    await admin.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      const json = path.endsWith("/admin/auth/me") ? { id: "admin", name: "Test", email: "admin@example.test" }
        : path.endsWith("/admin/acquisition") ? { truncated: false, rows: [
          { source: "podcast-42", event: "pageview", count: 12 },
          { source: "podcast-42", event: "booking", count: 3 },
        ] } : path.endsWith("/stats") ? {} : [];
      return route.fulfill({ json });
    });
    await admin.goto(process.env.WEB_URL || "http://localhost:3195/admin");
    await admin.getByText("podcast-42", { exact: true }).waitFor();
    const row = admin.getByRole("row").filter({ hasText: "podcast-42" });
    assert.deepEqual(await row.locator("td").allTextContents(), ["podcast-42", "12", "0", "0", "0", "3"]);
    for (const width of [1440, 390, 320]) {
      await admin.setViewportSize({ width, height: 900 });
      assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "admin overflow");
    }
    await admin.screenshot({ path: "/tmp/utm-admin.png", fullPage: true });
    await admin.close();
    assert.deepEqual(errors, []);
    console.log("PASS open sources, normalization, one pageview, CTA events, invalid labels, direct, no sensitive query/referrer/cookies, DNT/GPC; fixtures only");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
