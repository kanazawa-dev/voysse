const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.MARKETING_URL || "http://localhost:3102");
  await p.locator("h1").waitFor();
  await p.getByRole("button", { name: "Language" }).click();
  await p.getByRole("menuitemradio", { name: "Español" }).click();
  assert.equal(await p.locator("html").getAttribute("lang"), "es");
  await p.keyboard.press("Escape");
  await p.locator("#faq summary").first().click();
  assert(
    (await p.locator("#faq details").first().getAttribute("open")) !== null,
  );
  await p.getByRole("button", { name: "Elegir Cloud" }).click();
  await p.getByRole("dialog").waitFor();
  await p.keyboard.press("Escape");
  assert((await p.locator("video").count()) === 0);
  assert.equal(await p.locator("[data-bloub]").count(), 3);
  assert(
    await p
      .locator("[data-bloub]")
      .evaluateAll((nodes) =>
        nodes.every((n) => n.dataset.animated === "false"),
      ),
  );
  for (const image of await p.locator("img.rivr-scene").all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((img) => img.decode());
  }
  assert.equal(await p.locator("img.rivr-scene").count(), 2);
  for (const width of [1440, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    const docsLink = p.locator(".rivr-doc-notch");
    await docsLink.focus();
    const notch = await docsLink.evaluate(el => ({
      outline: getComputedStyle(el).outlineStyle,
      iconFocus: getComputedStyle(el.firstElementChild).outlineStyle,
      corner: getComputedStyle(el, "::before").width,
    }));
    assert.equal(notch.outline, "none", "no contour around the cutout");
    assert.equal(notch.iconFocus, "solid", "keyboard focus stays visible on icon");
    assert.equal(notch.corner, width > 700 ? "40px" : "24px");
    await docsLink.evaluate(el => el.blur());

    await p.screenshot({
      path: `/tmp/rivr-landing-${width}.png`,
      fullPage: true,
    });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `landing overflow ${width}`,
    );
  }
  const agency = {
    id: "agency-1",
    name: "Voysse Studio",
    slug: "voysse",
    is_active: true,
    brand_color: "#20365b",
    logo_url: null,
  };
  const user = {
    id: "user-1",
    name: "Alex",
    email: "alex@example.test",
    role: "owner",
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
      path: `/tmp/rivr-web-${path.replaceAll("/", "") || "dashboard"}.png`,
      fullPage: true,
    });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `desktop overflow ${path}`,
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(200);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `mobile overflow ${path}`,
    );
  }
  console.log(
    JSON.stringify({
      errors,
      checks:
        "ES switching, FAQ, Cloud modal, reduced motion, landing 1440/390/320, 11 app routes at desktop/mobile with API fixtures",
    }),
  );
  await b.close();
  assert.deepEqual(errors, []);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
