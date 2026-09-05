const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({ headless: true });
  try {
    const p = await b.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (/hydration|didn't match|Base UI:/i.test(m.text()))
        errors.push(m.text());
    });
    const agency = {
      id: "agency-1",
      name: "Voysse Studio",
      slug: "voysse",
      is_active: true,
      brand_color: "#5135ff",
      logo_url: null,
    };
    const user = {
      id: "user-1",
      name: "Alex",
      email: "alex@example.test",
      role: "admin",
      agency,
    };
    const client = {
      id: "client-1",
      name: "Nova Studio",
      industry: "Diseño",
      description: "Asistente comercial",
      agents: [],
      is_active: true,
      portal_enabled: true,
    };
    const agent = {
      id: "agent-1",
      name: "Asistente de ventas",
      client_id: client.id,
      client,
      description: "Ventas y soporte",
      is_active: true,
      connections: [],
    };
    await p.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path.endsWith("/auth/me")) data = user;
      else if (path === "/api/dashboard")
        data = {
          clients: 3,
          active_clients: 3,
          agents: 8,
          active_agents: 7,
          conversations: 248,
          channels: 4,
          connected_channels: 3,
          recent_agents: [],
        };
      else if (path === "/api/dashboard/metrics")
        data = {
          messages: 584,
          human_conversations: 12,
          daily_conversations: Array.from({ length: 14 }, (_, i) => ({
            date: `2026-09-${String(i + 1).padStart(2, "0")}`,
            count: 8 + i * 3,
          })),
          top_agents: [{ id: agent.id, name: agent.name, conversations: 80 }],
          tokens_in: 24500,
          tokens_out: 12600,
          usage_by_model: [
            { model: "gpt-4.1", input_tokens: 24500, output_tokens: 12600 },
          ],
          by_channel: {},
        };
      else if (path === "/api/portal/demo/me")
        return route.fulfill({ status: 401, json: { detail: "Unauthorized" } });
      else if (path === "/api/portal/demo")
        data = {
          agency_name: "Voysse Studio",
          agency_brand_color: "#7c3aed",
          agency_logo_url: null,
          client_name: "Nova Studio",
        };
      else if (path === "/api/widget/demo")
        data = {
          title: "Asistente",
          greeting: "Hola, ¿cómo podemos ayudarte?",
          color: "#7c3aed",
          agency_name: "Voysse Studio",
          agency_logo_url: null,
        };
      else if (path === "/api/widget/demo/history")
        data = { messages: [], mode: "ai", reply: null };
      else if (path === "/api/agency") data = agency;
      else if (path === "/api/agents") data = [agent];
      else if (path === "/api/clients") data = [client];
      return route.fulfill({ json: data });
    });
    for (const path of [
      "/",
      "/clients",
      "/clients/new",
      "/agents/new",
      "/team",
      "/agents",
      "/channels",
      "/settings",
      "/inbox",
      "/playground",
      "/login",
      "/admin/login",
      "/portal/demo",
      "/widget/demo",
    ]) {
      await p.setViewportSize({ width: 1440, height: 1000 });
      await p.goto((process.env.WEB_URL || "http://localhost:3101") + path);
      await p.waitForTimeout(1200);
      await p.screenshot({
        path: `/tmp/cypon-web-${path.replaceAll("/", "") || "dashboard"}.png`,
        fullPage: true,
      });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `desktop overflow ${path}`,
      );
      if (path === "/") {
        assert.equal(
          await p.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--primary")
              .trim(),
          ),
          "#5135ff",
        );
        assert.equal(
          await p
            .locator('[data-slot="card"]')
            .first()
            .evaluate((e) => getComputedStyle(e).borderRadius),
          "2px",
        );
        assert.match(
          await p.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily),
          /Geist/,
        );
        const card = p.locator('[data-slot="card"]').first();
        const borderBefore = await card.evaluate(
          (e) => getComputedStyle(e).borderColor,
        );
        await card.hover();
        assert.notEqual(
          await card.evaluate((e) => getComputedStyle(e).borderColor),
          borderBefore,
        );
        const nav = p
          .locator('[data-slot="sidebar-menu-button"][data-active="false"]')
          .first();
        const navBefore = await nav.evaluate(
          (e) => getComputedStyle(e).backgroundColor,
        );
        await nav.hover();
        assert.notEqual(
          await nav.evaluate((e) => getComputedStyle(e).backgroundColor),
          navBefore,
        );
        await p.mouse.move(1400, 0);
        await p.evaluate(() => document.documentElement.classList.add("dark"));
        assert.equal(
          await p
            .locator('[data-slot="card"]')
            .first()
            .evaluate((e) => getComputedStyle(e).backgroundColor),
          "rgb(27, 27, 32)",
        );
        await p.screenshot({ path: "/tmp/cypon-web-dark.png", fullPage: true });
        await p.evaluate(() =>
          document.documentElement.classList.remove("dark"),
        );
      }
      if (path === "/clients") {
        const primary = p
          .locator('[data-slot="button"][data-variant="default"]')
          .first();
        assert.equal(
          await primary.evaluate((e) => getComputedStyle(e, "::before").top),
          "-3px",
        );
        await primary.hover();
        assert.equal(
          await primary.evaluate((e) => getComputedStyle(e, "::before").top),
          "0px",
        );
      }
      for (const width of [390, 320]) {
        await p.setViewportSize({ width, height: 844 });
        await p.waitForTimeout(200);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `mobile overflow ${path} ${width}`,
        );
      }
    }

    assert.deepEqual(errors, []);
    console.log(
      "PASS dashboard identity: 14 routes 1440/390/320, typography/tokens, dark palette and button hover with API fixtures; no hydration errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
