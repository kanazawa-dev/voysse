const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WEB_URL || "http://localhost:3101";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (/hydrat|didn't match|Base UI:/i.test(m.text())) errors.push(m.text());
    });
    const cid = "12345678-1234-1234-1234-123456789abc",
      now = new Date().toISOString();
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path === "/api/auth/me")
        data = {
          id: "user-1",
          name: "Alex",
          email: "alex@example.com",
          role: "admin",
          agency: { id: "agency-1", name: "Test", is_active: true },
        };
      else if (path === "/api/clients/client-1")
        data = {
          id: "client-1",
          name: "Test client",
          agents: [{ id: "agent-1", name: "Assistant" }],
        };
      else if (path === "/api/whatsapp-cloud/channels/client-1")
        data = {
          id: "channel-1",
          client_id: "client-1",
          agent_id: "agent-1",
          status: "connected",
          phone_number_id: "111",
          phone_number: "+56123456",
          has_access_token: true,
          has_app_secret: true,
          is_enabled: true,
          webhook_url: "https://example.com/webhook",
          webhook_verify_token: "test-only",
        };
      else if (path.endsWith("/events"))
        data = [
          {
            id: "event-1",
            status: "queued",
            preview: "Waiting for worker",
            updated_at: now,
            received_at: now,
          },
          {
            id: "event-2",
            status: "needs_review",
            error_code: "preparation_interrupted",
            preview: "Check tool action",
            conversation_id: cid,
            updated_at: now,
            received_at: now,
          },
          {
            id: "event-3",
            status: "uncertain",
            error_code: "delivery_unknown",
            preview: "Check external message",
            updated_at: now,
            received_at: now,
          },
        ];
      else if (path === "/api/conversations/" + cid)
        data = {
          id: cid,
          title: "Review this conversation",
          contact_name: "Customer",
          channel: "whatsapp_cloud",
          mode: "human",
          messages: [
            {
              id: "msg-1",
              role: "user",
              sender_type: "visitor",
              content: "Hello",
              created_at: now,
            },
          ],
          deliveries: [],
          created_at: now,
          updated_at: now,
        };
      await route.fulfill({ json: data });
    });
    await page.goto(base + "/clients/client-1/channels/whatsapp-cloud");
    await page.getByRole("heading", { name: "Incoming activity" }).waitFor();
    await page.getByText("Needs review", { exact: true }).waitFor();
    await page.getByText("Uncertain send", { exact: true }).waitFor();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Overflow " + width,
      );
    }
    await page.screenshot({
      path: "/tmp/voysse-cloud-events.png",
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "View conversation", exact: true })
      .click();
    await page.waitForURL(base + "/inbox?conversation=" + cid);
    await page
      .getByRole("button", { name: "Return to AI", exact: true })
      .waitFor();
    await page.getByText("Hello", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS Cloud event statuses, 1440/390/320 and deep link to Inbox; fixtures only",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
