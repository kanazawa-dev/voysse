const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const theme of ['light', 'dark']) {
      const es = lang === 'es', errors = [], writes = [];
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(({ lang, theme }) => { try { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', theme); } catch {} }, { lang, theme });
      await context.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== 'GET') writes.push(path);
        return route.fulfill({ json: path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'ag', name: 'Agency' } } : path === '/api/clients' ? [{ id: 'a', name: 'Alpha', is_active: true }] : path.endsWith('/handoffs') ? { revision: 0, valid: true, rules: [], max_hops: 3 } : path.includes('/studio/') ? { client: { id: 'a', name: 'Alpha', is_active: true }, agents: [{ id: 'one', name: 'Support', is_active: true, widget_enabled: true }, { id: 'two', name: 'Sales', is_active: true, widget_enabled: true }], channels: [{ id: 'w', kind: 'whatsapp', is_enabled: true, agent_id: 'one', status: 'connected' }], layout: { revision: 0, positions: { 'widget:two': { x: 1500, y: 200 } }, zoom: 100 } } : [] });
      });
      const page = await context.newPage(), base = process.env.WEB_URL || 'http://127.0.0.1:3121';
      await page.goto(base + '/clients/a/studio');
      const link = page.getByRole('link', { name: 'Studio', exact: true }).first();
      assert.equal(await link.getAttribute('target'), '_blank');
      const opened = context.waitForEvent('page'); await link.click(); const canvas = await opened;
      canvas.on('pageerror', e => errors.push(e.message));
      await canvas.waitForURL('**/studio/a'); await canvas.locator('[data-immersive-studio]').waitFor();
      assert(page.url().endsWith('/clients/a/studio')); assert(await canvas.evaluate(() => window.opener === null));
      assert.equal(await canvas.locator('[data-sidebar="sidebar"]').count(), 0);
      const viewport = canvas.locator('[data-immersive-studio] div[tabindex="0"]');
      const box = await viewport.boundingBox();
      await canvas.mouse.move(box.x + 650, box.y + 320); await canvas.mouse.down(); await canvas.mouse.move(box.x + 350, box.y + 320, { steps: 8 }); await canvas.mouse.up();
      assert(await viewport.evaluate(n => n.scrollLeft > 0));
      await viewport.evaluate(n => { n.scrollLeft = 0; });
      await canvas.locator('button[data-studio-node="agent:one"]').click();
      await canvas.getByRole('button', { name: es ? 'Cerrar panel' : 'Close panel', exact: true }).click();
      await canvas.getByRole('button', { name: es ? 'Conexiones y pruebas' : 'Connections & tests', exact: true }).click();
      await canvas.getByRole('button', { name: es ? 'Añadir conexión' : 'Add connection', exact: true }).click();
      assert.equal(await canvas.locator('[data-handoff-editor]').getAttribute('data-studio-dirty'), 'true');
      await canvas.getByRole('button', { name: es ? 'Cerrar panel' : 'Close panel', exact: true }).click();
      await canvas.getByRole('button', { name: es ? 'Conexiones y pruebas' : 'Connections & tests', exact: true }).click();
      assert.equal(await canvas.locator('[data-handoff-editor]').getAttribute('data-studio-dirty'), 'true');
      await canvas.getByRole('button', { name: es ? 'Cerrar panel' : 'Close panel', exact: true }).click();
      await canvas.getByRole('button', { name: es ? 'Ejecuciones' : 'Executions', exact: true }).click();
      await canvas.locator('[data-execution-panel]').waitFor();
      await canvas.getByRole('button', { name: es ? 'Cerrar panel' : 'Close panel', exact: true }).click();
      for (const width of [1440, 390, 320]) {
        await canvas.setViewportSize({ width, height: 844 });
        assert(await canvas.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
        assert((await viewport.boundingBox()).height > 250);
        for (const button of await canvas.locator('nav[aria-label] button').all()) { const r = await button.boundingBox(); assert(r.x >= 0 && r.x + r.width <= width, 'Every canvas tool must fit'); }
        await canvas.getByRole('button', { name: 'Inspector', exact: true }).click();
        assert(await canvas.locator('[data-studio-inspector]').isVisible());
        await canvas.getByRole('button', { name: es ? 'Cerrar panel' : 'Close panel', exact: true }).click();
        await canvas.screenshot({ path: `/tmp/studio-immersive-${lang}-${theme}-${width}.png` });
      }
      assert.deepEqual(writes, []); assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS immersive Studio: new tab/no opener, authenticated canvas, pan, persistent drawers, ES/EN themes mobile, no page overflow or writes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
