const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WEB_URL || 'http://127.0.0.1:3114';
const timestamp = '2026-09-06T00:00:00Z';
const agent = (id, name) => ({ id, name, description: 'Customer assistant', instructions: 'Be helpful', model: 'test', provider: 'openai', is_active: true, updated_at: timestamp, widget_enabled: id === 'a', widget_greeting: 'Hello!', widget_color: '#5135ff', widget_position: 'right' });
const graph = { client: { id: 'client-a', name: 'Client Alpha', is_active: true }, agents: [agent('a', 'Sales'), agent('b', 'Support')], channels: ['whatsapp', 'whatsapp-cloud', 'instagram', 'messenger'].map((kind, index) => ({ kind, id: index < 2 ? kind : null, agent_id: index < 2 ? 'a' : null, updated_at: timestamp, is_enabled: index === 0, status: index === 0 ? 'connected' : index === 1 ? 'disconnected' : 'not_configured' })) };
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['en', 'es']) {
      const page = await browser.newPage();
      const errors = [], writes = [];
      await page.addInitScript(lang => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', 'dark'); }, lang);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== 'GET') writes.push(url.pathname);
        if (url.pathname.endsWith('/handoffs')) return route.fulfill({ json: { rules: [], max_hops: 3, human_fallback: true, revision: 0, valid: true, problems: [] } });
        const json = url.pathname.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', email: 'alex@example.com', agency: { name: 'Studio', id: 'agency' } } : url.pathname.includes('/studio/') ? graph : [];
        return route.fulfill({ json });
      });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(base + '/clients/client-a/studio');
        await page.locator('[data-studio-node="agent:a"]').waitFor();
        assert.equal(await page.locator('[data-studio-node]').count(), 8);
        assert.equal(await page.locator('[data-studio-edge]').count(), 2);
        await page.locator('[data-studio-node="agent:a"]').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-studio-node="agent:a"]').getAttribute('aria-pressed'), 'true');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow');
        if (width === 1440) await page.getByRole('button', { name: lang === 'es' ? 'Acercar' : 'Zoom in' }).click();
        await page.screenshot({ path: `/tmp/studio-${lang}-${width}.png`, fullPage: true });
      }
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      await page.route('**/api/studio/empty', route => route.fulfill({ json: { ...graph, agents: [], channels: graph.channels.map(c => ({ ...c, id: null, agent_id: null })) } }));
      await page.goto(base + '/clients/empty/studio');
      await page.getByText(lang === 'es' ? 'Comienza con tu primer agente.' : 'Start with your first agent.').waitFor();
      await page.route('**/api/studio/denied', route => route.fulfill({ status: 404, json: { detail: 'Client not found' } }));
      await page.goto(base + '/clients/denied/studio');
      await page.getByRole('alert').filter({ hasText: 'Client not found' }).waitFor();
      assert.equal(await page.locator('[data-studio-node]').count(), 0);
      await page.close();
    }
    console.log('PASS Studio: ES/EN responsive graph, edges, keyboard, zoom, empty/error isolation, zero writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
