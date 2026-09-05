const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(process.env.MARKETING_URL || "http://localhost:3102", {
      waitUntil: "networkidle",
    });
    const action = p.locator(".cy-hero .cy-action").first();
    const state = () =>
      action.evaluate((e) => ({
        bg: getComputedStyle(e).backgroundColor,
        inset: getComputedStyle(e, "::before").top,
        transform: getComputedStyle(e).transform,
      }));
    const before = await state();
    await action.hover();
    await p.waitForTimeout(250);
    const after = await state();
    assert.notEqual(before.bg, after.bg);
    assert.equal(before.inset, "-4px");
    assert.equal(after.inset, "0px");
    assert.equal(after.transform, "none");
    await p.mouse.move(1400, 800);
    const summary = p.locator(".cy-nav-links summary").first();
    await summary.hover();
    await p.waitForTimeout(250);
    assert.equal(
      await p.locator(".cy-nav-links details").first().getAttribute("open"),
      "",
    );
    await p.locator(".cy-nav-dropdown a").first().hover();
    assert.equal(
      await p.locator(".cy-nav-links details").first().getAttribute("open"),
      "",
    );
    await p.mouse.move(1400, 800);
    await p.waitForTimeout(250);
    assert.equal(
      await p.locator(".cy-nav-links details").first().getAttribute("open"),
      null,
    );
    await summary.hover();
    await p.keyboard.press("Escape");
    assert.equal(
      await p.locator(".cy-nav-links details").first().getAttribute("open"),
      null,
      "Escape also dismisses a hover-only menu",
    );
    await summary.focus();
    await p.keyboard.press("Enter");
    await p.keyboard.press("Escape");
    assert.equal(
      await p.locator(".cy-nav-links details").first().getAttribute("open"),
      null,
    );
    const card = p.locator(".cy-feature-grid article").first();
    await card.scrollIntoViewIfNeeded();
    await p.mouse.move(1400, 800);
    const bg = await card.evaluate((e) => getComputedStyle(e).backgroundColor);
    await card.hover();
    await p.waitForTimeout(250);
    assert.notEqual(
      await card.evaluate((e) => getComputedStyle(e).backgroundColor),
      bg,
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await action.evaluate(
        (e) => getComputedStyle(e, "::before").transitionDuration,
      ),
      "0s",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS landing hover: inset corners, 200ms color, hover menu retained while entering submenu, mouse exit, keyboard Escape, cards and reduced motion.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
