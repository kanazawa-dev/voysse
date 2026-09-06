const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const theme of ['light', 'dark']) {
      const es = lang === 'es', errors = [], writes = [];
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      let layout = { revision: 0, positions: {}, zoom: 100 }, conflict = false;
      const agents = [{ id: 'a', name: 'Support', is_active: true, widget_enabled: true }];
      const channels = [{ id: 'w', kind: 'whatsapp', agent_id: 'a', status: 'connected', is_enabled: true }];
      await page.addInitScript(({lang, theme}) => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', theme); }, {lang, theme});
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
          writes.push(path); assert.equal(path, '/api/studio/c/layout'); assert.equal(req.method(), 'PUT');
          const body = req.postDataJSON(); assert.equal(body.expected_revision, layout.revision);
          if (conflict) return route.fulfill({ status: 409, json: { detail: 'Layout changed' } });
          layout = { positions: body.positions, zoom: body.zoom, revision: layout.revision + 1 };
          return route.fulfill({ json: layout });
        }
        return route.fulfill({ json: path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'ag', name: 'Agency' } } : path.endsWith('/layout') ? layout : path.endsWith('/handoffs') ? { revision: 0, valid: true, rules: [], max_hops: 3 } : path.includes('/studio/') ? { client: { id: 'c', name: 'Client', is_active: true }, agents, channels, layout } : [] });
      });
      const url = (process.env.WEB_URL || 'http://127.0.0.1:3121') + '/clients/c/studio';
      await page.goto(url);
      const controls = page.locator('[data-layout-controls]'), node = page.locator('[data-studio-node="agent:a"]');
      const arrange = controls.getByRole('button', { name: es ? 'Organizar nodos' : 'Arrange nodes', exact: true });
      const save = controls.getByRole('button', { name: es ? 'Guardar distribución' : 'Save layout', exact: true });
      const reload = controls.getByRole('button', { name: es ? 'Recargar distribución' : 'Reload layout', exact: true });
      const edge = page.locator('[data-studio-edge="whatsapp"]'), initialEdge = await edge.getAttribute('d');
      await arrange.click(); await node.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await node.evaluate(n => n.style.left), '350px');
      assert.notEqual(await edge.getAttribute('d'), initialEdge);
      await page.keyboard.press('Shift+ArrowDown'); assert.equal(await node.evaluate(n => n.style.top), '120px');
      const map = node.locator('xpath=../..');
      await node.dragTo(map, { sourcePosition: { x: 20, y: 20 }, targetPosition: { x: 470, y: 240 } });
      assert.notEqual(await node.evaluate(n => n.style.left), '350px');
      assert.equal(writes.length, 0, 'arranging must not rebind channels');
      await page.getByRole('button', { name: es ? 'Acercar' : 'Zoom in', exact: true }).click();
      await save.click(); await controls.getByRole('status').filter({ hasText: es ? 'Distribución guardada' : 'Saved layout' }).waitFor();
      assert.equal(layout.zoom, 125); assert(layout.positions['agent:a']); assert.equal(writes.length, 1);
      const saved = JSON.parse(JSON.stringify(layout)); await page.reload();
      assert.equal(await node.evaluate(n => n.style.left), `${saved.positions['agent:a'].x}px`);
      assert.equal(await page.getByText('125%', { exact: true }).count(), 1);
      await arrange.click(); await node.focus(); await page.keyboard.press('ArrowDown');
      conflict = true; await save.click(); await controls.getByRole('alert').filter({ hasText: 'Layout changed' }).waitFor();
      const unsavedTop = await node.evaluate(n => n.style.top);
      page.once('dialog', d => d.dismiss()); await reload.click(); assert.equal(await node.evaluate(n => n.style.top), unsavedTop);
      page.once('dialog', d => d.accept()); await reload.click();
      await controls.getByRole('status').filter({ hasText: es ? 'Distribución guardada' : 'Saved layout' }).waitFor();
      assert.equal(await node.evaluate(n => n.style.top), `${saved.positions['agent:a'].y}px`);
      const reset = controls.getByRole('button', { name: es ? 'Restablecer vista' : 'Reset view', exact: true });
      page.once('dialog', d => d.accept()); await reset.click();
      assert.equal(await node.evaluate(n => n.style.left), '340px'); assert.equal(await page.getByText('100%', { exact: true }).count(), 1);
      conflict = false; await save.click(); await controls.getByRole('status').filter({ hasText: es ? 'Distribución guardada' : 'Saved layout' }).waitFor();
      assert.deepEqual(layout.positions, {}); assert.equal(writes.length, 3);
      await page.screenshot({ path: `/tmp/studio-layout-${lang}-${theme}.png`, fullPage: true });
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); assert.equal(await controls.isVisible(), false);
        await node.click(); await page.locator('[data-studio-inspector]').getByRole('heading', { name: 'Support', exact: true }).waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS persistent layout ES/EN light/dark: pointer/keyboard positioning, zoom/save/reload, live edges, CAS preservation, reset, no channel writes, mobile cards/selection.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
