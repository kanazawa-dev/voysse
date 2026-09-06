const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WEB_URL || "http://localhost:3101";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let signedIn = false, empty = false, unavailable = false;
    const now = new Date().toISOString();
    const conversation = {
      id: "c1", title: "Customer inquiry", channel: "whatsapp_cloud", mode: "ai",
      updated_at: now, preview: "Hello", deliveries: [],
      messages: [{ id: "m1", role: "user", content: "A long message " + "x".repeat(180), created_at: now }],
    };
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/portal/demo/me" && !signedIn) return route.fulfill({ status: 401, json: { detail: "Unauthorized" } });
      if (path === "/api/portal/demo" && unavailable) return route.fulfill({ status: 404, json: { detail: "Portal unavailable" } });
      let data = {};
      if (path === "/api/portal/demo") data = { agency_name: "Agency Studio", client_name: "Customer", portal_title: "Customer Inbox", agency_brand_color: "#ffff00" };
      else if (path.endsWith("/login")) { signedIn = true; data = { client_id: "client" }; }
      else if (path.endsWith("/logout")) signedIn = false;
      else if (path.endsWith("/conversations")) data = empty ? [] : [conversation];
      else if (path.endsWith("/mode")) { conversation.mode = route.request().postDataJSON().mode; data = conversation; }
      else if (path.includes("/conversations/")) data = conversation;
      await route.fulfill({ json: data });
    });
    const check = async (surface) => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const dark of [false, true]) {
          const toggle = page.locator(".cy-theme-toggle");
          assert.equal(await toggle.count(), 1);
          if (await page.evaluate(() => document.documentElement.classList.contains("dark")) !== dark) await toggle.click();
          const result = await page.evaluate(() => {
            const root = document.querySelector(".cy-portal"), style = getComputedStyle(root);
            const theme = document.querySelector(".cy-theme-toggle").getBoundingClientRect();
            const language = document.querySelector(".cy-language-trigger").getBoundingClientRect();
            return { overflow: document.documentElement.scrollWidth > innerWidth,
              background: style.backgroundColor, font: style.fontFamily,
              heights: [theme.height, language.height], y: [theme.y, language.y] };
          });
          assert.equal(result.overflow, false, surface + " overflow " + width);
          assert.match(result.font, /Geist/);
          assert.equal(result.background, dark ? "rgb(20, 20, 23)" : "rgb(244, 244, 245)");
          assert.deepEqual(result.heights, [36, 36]);
          assert.equal(result.y[0], result.y[1]);
          await page.locator(".cy-language-trigger").focus();
          await page.keyboard.press("Tab");
          assert.equal(await toggle.evaluate(el => document.activeElement === el), true);
          assert.equal(await toggle.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
        }
      }
      await page.screenshot({ path: "/tmp/portal-" + surface + ".png", fullPage: true });
    };
    await page.goto(base + "/portal/demo");
    await page.locator("#portal-email").waitFor();
    await check("login");
    await page.locator(".cy-language-trigger").click();
    await page.getByRole("menuitemradio", { name: "Español" }).click();
    await page.locator("#portal-email").fill("client@example.test");
    await page.locator("#portal-password").fill("password");
    await page.locator(".access-form button[type=submit]").click();
    await page.locator(".portal-messages article").waitFor();
    await check("inbox");
    assert.equal(await page.locator('input[name=content]').isDisabled(), true);
    await page.locator(".portal-mode-toggle").click();
    await page.waitForFunction(() => !document.querySelector('input[name=content]').disabled);
    await page.reload();
    await page.locator(".portal-inbox").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("voysse.theme")), "dark");
    assert.equal(await page.locator(".cy-language-trigger").innerText().then(s => s.trim()), "ES");
    empty = true;
    await page.reload();
    await page.locator(".empty-state").waitFor();
    await check("empty");
    unavailable = true;
    await page.reload();
    await page.getByText("Portal unavailable").waitFor();
    await check("unavailable");
    assert.deepEqual(errors, []);
    console.log("PASS portal login/inbox/empty/unavailable; light/dark; 1440/768/390/320; shared controls, keyboard, persistence, language, human mode; API fixtures only");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
