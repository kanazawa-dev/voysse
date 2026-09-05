const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// English and Spanish share LTR. Test the actual server response, normal
// hydration, and a host/extension setting dir before React loads.
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const url of [
      process.env.MARKETING_URL || "http://localhost:3102",
      (process.env.WEB_URL || "http://localhost:3101") + "/login",
    ]) {
      for (const injectedDirection of [false, true]) {
        const page = await browser.newPage();
        const errors = [];
        page.on("console", (message) => {
          if (/hydrat|server rendered|didn't match/i.test(message.text())) {
            errors.push(message.text());
          }
        });
        page.on("pageerror", (error) => errors.push(error.message));
        if (injectedDirection) {
          await page.addInitScript(() => {
            const setDirection = () => {
              if (!document.documentElement) return false;
              document.documentElement.dir = "ltr";
              return true;
            };
            if (!setDirection()) {
              const observer = new MutationObserver(() => {
                if (setDirection()) observer.disconnect();
              });
              observer.observe(document, { childList: true, subtree: true });
            }
          });
        }
        const response = await page.goto(url);
        assert.equal(response.status(), 200);
        assert.match(await response.text(), /<html[^>]*\bdir="ltr"/);
        // The avatar effect is a signal that client hydration has completed.
        await page.waitForFunction(() =>
          document.querySelector('[data-bloub][data-animated="true"]'),
        ).catch(async (error) => {
          console.error({ url, injectedDirection, errors, title: await page.title(), avatars: await page.locator('[data-bloub]').count() });
          throw error;
        });
        await page.waitForTimeout(500);
        assert.equal(await page.locator("html").getAttribute("dir"), "ltr");
        assert.deepEqual(errors, [], `${url}, injected dir: ${injectedDirection}`);
        console.log(`PASS: ${url}, injected dir: ${injectedDirection}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
