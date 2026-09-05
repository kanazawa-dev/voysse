const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WEB_URL || "http://localhost:3101";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [],
      keys = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (/hydrat|didn't match|Base UI:/i.test(m.text())) errors.push(m.text());
    });
    const now = new Date().toISOString();
    const conversation = {
      id: "conversation-1",
      client_id: "client-1",
      agent_id: "agent-1",
      agent_name: "Assistant",
      title: "Customer chat",
      contact_name: "Customer",
      mode: "human",
      channel: "whatsapp_cloud",
      created_at: now,
      updated_at: now,
      messages: [],
      deliveries: [],
      preview: "Hello",
    };
    let loseResponse = true;
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": base,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      let data = [];
      if (path === "/api/auth/me")
        data = {
          id: "operator-1",
          name: "Operator",
          role: "operator",
          email: "operator@example.com",
          agency: { id: "agency-1", name: "Test", is_active: true },
        };
      else if (path === "/api/conversations/inbox-agents")
        data = [{ id: "agent-1", name: "Assistant" }];
      else if (path === "/api/conversations/inbox") data = [conversation];
      else if (path === "/api/conversations/conversation-1/reply") {
        const body = req.postDataJSON();
        keys.push(body.request_id);
        assert.match(body.request_id, /^[0-9a-f-]{36}$/);
        assert.equal(body.content, "A human response");
        if (!conversation.deliveries.length)
          conversation.deliveries.push({
            id: body.request_id,
            content: body.content,
            status: "uncertain",
            error_code: "confirmation_missing",
            sender_name: "Operator",
            created_at: now,
            updated_at: now,
            external_message_id: null,
          });
        if (loseResponse) {
          loseResponse = false;
          return route.abort("failed");
        }
        data = conversation;
      } else if (path === "/api/conversations/conversation-1")
        data = conversation;
      else if (path.endsWith("/read")) return route.fulfill({ status: 204 });
      await route.fulfill({ json: data });
    });
    await page.goto(base + "/inbox");
    await page.getByRole("button").filter({ hasText: "Customer" }).click();
    const input = page.locator('input[name="content"]');
    await input.fill("A human response");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page
      .getByRole("button", { name: "Check attempt", exact: true })
      .waitFor();
    assert.equal(await input.inputValue(), "A human response");
    assert.equal(await input.getAttribute("readonly"), "");
    await page
      .getByRole("button", { name: "Check attempt", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Uncertain send" })
      .waitFor();
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    await page.waitForFunction(
      () => document.querySelector('input[name="content"]').value === "",
    );
    assert.equal(conversation.messages.length, 0);
    assert.equal(await input.getAttribute("maxlength"), "4096");
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Inbox overflow " + width,
      );
    }
    await page.screenshot({
      path: "/tmp/voysse-human-delivery.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS lost response retains text/key, repeat does not create a second attempt, uncertain status, channel limit, 1440/390/320; API fixtures only",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
