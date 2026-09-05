const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WEB_URL || "http://localhost:3101";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (process.env.DEBUG_UI)
      page.on("console", (m) => {
        if (["error", "warning"].includes(m.type()))
          console.log(m.type(), m.text());
      });
    page.on("console", (m) => {
      if (/hydrat|didn't match|Base UI:/i.test(m.text())) errors.push(m.text());
    });
    const agency = {
      id: "agency-1",
      name: "Test agency",
      is_active: true,
      brand_color: "#20365b",
      logo_url: null,
    };
    const customer = {
      id: "client-1",
      name: "Test client",
      is_active: true,
      agents: [{ id: "agent-1", name: "Test agent" }],
    };
    let channel = null;
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      let data = [];
      if (path === "/api/auth/me")
        data = { id: "user-1", name: "Alex", role: "admin", agency };
      else if (path === "/api/clients") data = [customer];
      else if (path === "/api/clients/client-1") data = customer;
      else if (path === "/api/agency") data = agency;
      else if (path.startsWith("/api/social/channels/client-1/")) {
        if (path.endsWith("/events")) data = [];
        else if (path.endsWith("/connect")) {
          channel.status = "awaiting_message";
          data = channel;
        } else if (path.endsWith("/disconnect")) {
          channel.status = "disconnected";
          data = channel;
        } else if (request.method() === "PUT") {
          const input = request.postDataJSON();
          assert.equal(input.access_token, "test-token");
          channel = {
            id: "channel-1",
            account_id: input.account_id,
            agent_id: input.agent_id,
            status: "disconnected",
            display_name: "",
            last_error: null,
          };
          data = channel;
        } else if (!channel)
          return route.fulfill({
            status: 404,
            json: { detail: "Not configured" },
          });
        else data = channel;
      }
      await route.fulfill({ json: data });
    });
    await page.goto(base + "/channels");
    await page.locator("#channel-client").click();
    await page.getByRole("option", { name: "Test client" }).click();
    for (const route of ["social/instagram", "social/messenger", "webchat"]) {
      assert.equal(
        await page
          .locator(`a[href="/clients/client-1/channels/${route}"]`)
          .count(),
        1,
      );
    }
    for (const platform of ["instagram", "messenger"]) {
      channel = null;
      await page.goto(base + `/clients/client-1/channels/social/${platform}`);
      await page.locator("#social-account").fill("111");
      await page.locator("#social-token").fill("test-token");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector("#social-token")?.value === "",
      );
      await page.getByRole("button", { name: "Verify and connect" }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "awaiting first message" })
        .waitFor();
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${platform} overflow ${width}`,
        );
      }
      await page.screenshot({
        path: `/tmp/voysse-${platform}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Disconnect", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Disconnected" })
        .waitFor();
    }
    await page.goto(base + "/clients/client-1/channels/webchat");
    await page.locator('a[href="/agents/agent-1#widget"]').waitFor();
    assert.equal(
      await page
        .locator('a[href="/agents/agent-1#widget"]')
        .getAttribute("href"),
      "/agents/agent-1#widget",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: channel links, manual setup, token clearing, connect/disconnect, widget link, responsive layouts and hydration (API fixtures; not a live Meta test).",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
