const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const width of [1440, 390, 320]) {
      const es = lang === 'es', writes = [], errors = [];
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      let outcome = 'matched', conflict = false;
      const agents = ['Sales', 'Support'].map((name, i) => ({ id: String(i), name, is_active: true, updated_at: '2026-09-06' }));
      await page.addInitScript(({lang, width}) => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', width === 390 ? 'dark' : 'light'); }, {lang, width});
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
          writes.push(path); assert.equal(path, '/api/studio/c/handoffs/simulate');
          const body = req.postDataJSON(); assert.equal(body.expected_revision, 1); assert.equal(body.language, lang);
          assert.equal(body.source_agent_id, '0'); assert.equal(body.message, 'Technical question');
          if (conflict) return route.fulfill({ status: 409, json: { detail: 'Draft changed' } });
          return route.fulfill({ json: { simulation_only: true, revision: 1, source_agent_id: '0', target_agent_id: outcome === 'matched' ? '1' : null,
            outcome, condition: outcome === 'matched' ? 'Technical help' : null, reason: outcome === 'matched' ? 'This is a technical request.' : '' } });
        }
        return route.fulfill({ json: path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'agency', name: 'Agency' } } : path.endsWith('/handoffs') ? { revision: 1, valid: true, rules: [{ source_agent_id: '0', target_agent_id: '1', condition: 'Technical help' }], max_hops: 3 } : path.includes('/studio/') ? { client: { id: 'c', name: 'Client', is_active: true }, agents, channels: [] } : [] });
      });
      await page.goto((process.env.WEB_URL || 'http://127.0.0.1:3117') + '/clients/c/studio');
      const panel = page.locator('[data-routing-simulation]');
      await panel.getByRole('combobox').selectOption('0');
      await panel.getByRole('textbox').fill('Technical question');
      const run = panel.getByRole('button', { name: es ? 'Simular · consume tokens' : 'Simulate · uses tokens', exact: true });
      await run.focus(); await page.keyboard.press('Enter');
      await panel.getByRole('status').filter({ hasText: 'Sales → Support' }).waitFor();
      assert.equal(writes.length, 1);
      await page.screenshot({ path: `/tmp/studio-simulation-${lang}-${width}.png`, fullPage: true });
      outcome = 'invalid_response'; await run.click();
      await panel.getByRole('status').filter({ hasText: es ? 'Respuesta del modelo no válida' : 'Invalid model response' }).waitFor();
      conflict = true; await run.click();
      await panel.getByRole('alert').filter({ hasText: 'Draft changed' }).waitFor();
      assert.equal(await panel.getByRole('status').count(), 0, 'stale proposal cleared');
      assert.equal(await panel.getByRole('textbox').inputValue(), 'Technical question');
      await page.getByRole('button', { name: es ? 'Añadir conexión' : 'Add connection', exact: true }).click();
      assert.equal(await page.locator('[data-routing-simulation]').count(), 0, 'unsaved edits remove simulation');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS routing simulation ES/EN 1440/390/320 light/dark: explicit token action, matched rule, invalid-output human fallback, stale revision, no live writes, keyboard.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
