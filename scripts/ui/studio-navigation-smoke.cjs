const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const theme of ['light', 'dark']) {
      const es = lang === 'es', errors = [], reads = [];
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      let clients = [{ id: 'a', name: 'Alpha', is_active: true }, { id: 'b', name: 'Beta', is_active: true }], fail = false, release;
      const user = { id: 'u', role: 'admin', name: 'Alex', agency: { id: 'ag', name: 'Agency' } };
      await page.addInitScript(({lang, theme}) => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', theme); }, {lang, theme});
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (path === '/api/auth/me') return route.fulfill({ json: user });
        if (path === '/api/clients') return route.fulfill(fail ? { status: 503, json: { detail: 'Unavailable' } } : { json: clients });
        const id = path.split('/')[3];
        if (req.method() !== 'GET') {
          assert(path.endsWith('/layout')); await new Promise(resolve => { release = resolve; });
          return route.fulfill({ json: { revision: 1, positions: {}, zoom: 125 } });
        }
        if (path.endsWith('/handoffs')) return route.fulfill({ json: { revision: 0, valid: true, rules: [], max_hops: 3 } });
        if (path.startsWith('/api/studio/')) {
          reads.push(id); return route.fulfill({ json: { client: clients.find(c => c.id === id), agents: [{ id: id + '-agent', name: id === 'a' ? 'Alpha agent' : 'Beta agent', is_active: true, widget_enabled: true }], channels: [], layout: { revision: 0, positions: {}, zoom: 100 } } });
        }
        return route.fulfill({ json: [] });
      });
      const base = process.env.WEB_URL || 'http://127.0.0.1:3121';
      await page.goto(base + '/studio'); await page.waitForURL('**/studio/a');
      const picker = page.getByRole('combobox', { name: es ? 'Cliente de Studio' : 'Studio client', exact: true });
      await picker.selectOption('b'); await page.waitForURL('**/studio/b');
      await page.locator('[data-studio-node="agent:b-agent"]').waitFor();
      assert.equal(await page.locator('[data-studio-node="agent:a-agent"]').count(), 0);
      await page.goto(base + '/studio'); await page.waitForURL('**/studio/b');
      await page.getByRole('button', { name: es ? 'Acercar' : 'Zoom in', exact: true }).click();
      page.once('dialog', d => d.dismiss()); await picker.selectOption('a'); assert(page.url().endsWith('/studio/b'));
      await page.getByRole('button', { name: es ? 'Guardar distribución' : 'Save layout', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-layout-controls][data-studio-busy="true"]'));
      await picker.selectOption('a'); assert(page.url().endsWith('/studio/b'));
      assert(await page.getByRole('alert').filter({ hasText: es ? 'Espera' : 'Wait' }).count());
      while (!release) await page.waitForTimeout(10); release();
      await page.waitForFunction(() => document.querySelector('[data-layout-controls][data-studio-busy="false"]'));
      await page.locator('[data-studio-node="agent:b-agent"]').click();
      await page.getByLabel(es ? 'Nombre' : 'Name', { exact: true }).fill('Unsaved');
      page.once('dialog', d => d.dismiss()); await picker.selectOption('a'); assert(page.url().endsWith('/studio/b'));
      page.once('dialog', d => d.accept()); await picker.selectOption('a'); await page.waitForURL('**/studio/a');
      await page.getByRole('textbox', { name: es ? 'Buscar cliente' : 'Search clients', exact: true }).fill('not-found');
      await page.getByText(es ? 'No hay coincidencias.' : 'No matching clients.', { exact: true }).waitFor();
      await page.goto(base + '/clients/a/studio'); await picker.waitFor();
      await page.getByRole('link', { name: 'Studio', exact: true }).first().waitFor();
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); assert(await picker.isVisible());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.screenshot({ path: `/tmp/studio-navigation-${lang}-${theme}.png`, fullPage: true });
      await page.evaluate(() => localStorage.setItem('voysse.studio.client:ag:u', 'forbidden'));
      await page.goto(base + '/studio'); await page.waitForURL('**/studio/a'); assert(!reads.includes('forbidden'));
      clients = []; await page.goto(base + '/studio'); await page.getByRole('link', { name: es ? 'Crear cliente' : 'Create client', exact: true }).waitFor();
      fail = true; await page.reload(); await page.getByRole('alert').filter({ hasText: 'Unavailable' }).waitFor();
      fail = false; await page.getByRole('button', { name: es ? 'Reintentar' : 'Retry', exact: true }).click();
      await page.getByRole('link', { name: es ? 'Crear cliente' : 'Create client', exact: true }).waitFor();
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS Studio navigation ES/EN light/dark: selection/isolation, remembered/stale client, dirty cancellation, busy block, legacy links, empty/error/retry and mobile.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
