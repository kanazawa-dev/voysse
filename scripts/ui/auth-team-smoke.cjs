const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WEB_URL || "http://localhost:3101";

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    if (process.env.DEBUG_UI)
      page.on("console", (m) => console.log(m.type(), m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (/hydrat|didn't match|Base UI:/i.test(m.text())) errors.push(m.text());
    });
    let role = "admin",
      configured = false,
      resets = 0,
      accepted = 0,
      invites = [];
    const token = "a".repeat(43);
    const agency = {
      id: "agency-1",
      name: "Test agency",
      is_active: true,
      brand_color: "#20365b",
      logo_url: null,
    };
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (process.env.DEBUG_UI) console.log(req.method(), path);
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": base,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      if (path === "/api/auth/forgot-password")
        return route.fulfill({
          status: configured ? 202 : 503,
          json: configured
            ? { message: "If eligible" }
            : { detail: "Not configured" },
        });
      if (path === "/api/auth/reset-password" || path === "/api/team/accept") {
        const input = req.postDataJSON();
        assert.equal(input.token, token);
        assert.equal(input.password, "safe-new-password");
        if (path.endsWith("accept")) {
          assert.equal(input.name, "New Operator");
          accepted++;
        } else resets++;
        return route.fulfill({ status: 204 });
      }
      let data = [];
      if (path === "/api/auth/me")
        data = {
          id: "user-1",
          name: "Alex",
          email: "alex@example.com",
          role,
          agency,
        };
      if (path === "/api/team/members")
        data = [
          {
            id: "user-1",
            name: "Alex",
            email: "alex@example.com",
            role: "admin",
          },
        ];
      if (path === "/api/team/invitations") {
        if (req.method() === "POST") {
          const body = req.postDataJSON();
          assert.equal(body.role, "operator");
          invites = [
            { id: "invite-1", ...body, expires_at: "2026-12-10T12:00:00Z" },
          ];
          data = { token, ...invites[0] };
        } else data = invites;
      }
      if (
        path === "/api/team/invitations/invite-1" &&
        req.method() === "DELETE"
      ) {
        invites = [];
        return route.fulfill({ status: 204 });
      }
      await route.fulfill({ json: data });
    });
    await page.goto(base + "/login");
    await page.locator('a[href="/forgot-password"]').click();
    await page.waitForURL(base + "/forgot-password");
    await page.getByRole("heading", { name: "Recover your account" }).waitFor();
    await page.locator("#email").fill("person@example.com");
    await page.getByRole("button", { name: "Send link" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "not configured" })
      .waitFor();
    configured = true;
    await page.getByRole("button", { name: "Send link" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "eligible account" })
      .waitFor();
    await page.goto(base + "/reset-password#token=" + token);
    await page.locator("#password").fill("safe-new-password");
    await page.locator("#confirm").fill("wrong-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await page.getByRole("alert").filter({ hasText: "do not match" }).waitFor();
    assert.equal(resets, 0);
    assert.equal(new URL(page.url()).hash, "");
    await page.locator("#confirm").fill("safe-new-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Password updated" })
      .waitFor();
    assert.equal(resets, 1);
    await page.goto(base + "/reset-password");
    await page
      .getByRole("alert")
      .filter({ hasText: "Missing recovery link" })
      .waitFor();
    await page.goto(base + "/team");
    await page.locator("#email").fill("operator@example.com");
    await page.getByRole("button", { name: "Create invitation" }).click();
    assert.equal(
      await page.locator("#invite-link").inputValue(),
      base + "/accept-invitation#token=" + token,
    );
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Team overflow " + width,
      );
    }
    await page.screenshot({ path: "/tmp/voysse-team.png", fullPage: true });
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page.getByText("No pending invitations.", { exact: true }).waitFor();
    await page.goto(base + "/accept-invitation#token=" + token);
    await page.locator("#name").fill("New Operator");
    await page.locator("#password").fill("safe-new-password");
    await page.locator("#confirm").fill("safe-new-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Invitation accepted" })
      .waitFor();
    assert.equal(accepted, 1);
    role = "operator";
    await page.goto(base + "/team");
    await page.waitForURL(base + "/inbox");
    assert.equal(await page.locator('a[href="/team"]').count(), 0);
    assert.equal(await page.locator('a[href="/settings"]').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS recovery configured/unconfigured, mismatched passwords, fragment/StrictMode, invitations, operator navigation, responsive 1440/390/320; API fixtures only",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
