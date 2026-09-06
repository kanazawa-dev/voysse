const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/api/**", route => route.fulfill({ json:
      new URL(route.request().url()).pathname === "/api/auth/me"
        ? { id: "u", name: "Alex", email: "alex@example.test", role: "admin", agency: { id: "a", name: "Studio", slug: "studio" } }
        : [] }));
    await page.goto((process.env.WEB_URL || "http://127.0.0.1:3101") + "/clients");
    const voxy = page.locator(".cy-sidebar-companion [data-bloub]");
    await voxy.waitFor();
    for (const collapsed of [false, true]) {
      if (collapsed) await page.locator('[data-slot="sidebar-trigger"]').click();
      await page.waitForFunction(() => document.querySelector(".cy-sidebar-companion [data-bloub]")?.dataset.animated === "true");
      const shape = await voxy.getAttribute("data-shape");
      const expression = await voxy.getAttribute("data-expression");
      await page.waitForFunction(previous => document.querySelector(".cy-sidebar-companion [data-bloub]")?.dataset.shape !== previous, shape, { timeout: 8000 });
      await page.waitForFunction(previous => document.querySelector(".cy-sidebar-companion [data-bloub]")?.dataset.expression !== previous, expression, { timeout: 10000 });
      assert.equal(await voxy.getAttribute("width"), collapsed ? "32" : "44");
      await page.screenshot({ path: collapsed ? "/tmp/voxy-lines-collapsed.png" : "/tmp/voxy-lines-expanded.png" });
    }
    const box = await voxy.boundingBox();
    const eyeX = () => voxy.locator('mask path[transform]').evaluateAll(eyes => {
      return eyes.reduce((sum, eye) => sum + Number(eye.getAttribute('transform').match(/matrix\(([^)]+)\)/)[1].split(/[ ,]+/)[4]), 0) / eyes.length;
    });
    await page.mouse.move(0, box.y + box.height / 2);
    await page.waitForTimeout(400);
    const left = await eyeX();
    await page.mouse.move(1200, box.y + box.height / 2);
    await page.waitForTimeout(400);
    assert((await eyeX()) > left, "eyes turn toward the mouse");
    assert.deepEqual(await voxy.boundingBox(), box, "Voxy does not move its layout box");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".cy-sidebar-companion [data-bloub]")?.dataset.animated === "false");
    await page.waitForTimeout(100);
    const paused = await voxy.innerHTML();
    await page.waitForTimeout(5500);
    assert.equal(await voxy.innerHTML(), paused);
    console.log("PASS sidebar Voxy: morphs and changes expressions expanded/collapsed, fixed sizes, mouse gaze, reduced motion freezes animation.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
