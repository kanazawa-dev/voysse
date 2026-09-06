const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const width of [1440, 390, 320]) {
      const es = lang === 'es', errors = [], writes = [];
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      let empty = true, reviewed = false, conflict = false, failRead = false, lost = false;
      const agents = [{ id: 'a', name: 'Support', is_active: true }];
      const turn = () => ({ turn_id: 'turn-1', conversation_id: 'conv-1', status: reviewed ? 'reviewed_human' : 'uncertain',
        created_at: '2026-09-06T12:00:00Z', current_revision: reviewed ? 3 : 2, current_responder_id: reviewed ? null : 'a', active_turn_id: reviewed ? null : 'turn-1',
        transitions: reviewed ? [{ id: 'review-1', kind: 'human_review', actor_id: 'admin-1', reason: 'Verified provider logs', source_id: 'a', target_id: null, revision: 3, reviewed_at: '2026-09-06T12:05:00Z', previous_status: 'uncertain' }] : [] });
      await page.addInitScript(({lang, width}) => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', width === 390 ? 'dark' : 'light'); }, {lang, width});
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() !== 'GET') {
          writes.push(path); assert.equal(path, '/api/studio/c/execution/conv-1/turn-1/review-human');
          const body = req.postDataJSON(); assert.equal(body.expected_revision, 2); assert.equal(body.acknowledge_external_effects, true);
          assert.equal(body.reason, 'Verified provider logs'); assert.match(body.request_id, /^[0-9a-f-]{36}$/);
          if (conflict) return route.fulfill({ status: 409, json: { detail: 'Execution owner changed' } });
          reviewed = true; if (lost) return route.fulfill({ status: 503, json: { detail: 'Response lost after commit' } });
          return route.fulfill({ json: { applied: true, review: turn().transitions[0] } });
        }
        if (path.endsWith('/execution')) {
          if (failRead) return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
          return route.fulfill({ json: { runtime_enabled: false, has_more: !empty && url.searchParams.get('offset') === '0', items: empty || url.searchParams.get('offset') !== '0' ? [] : [turn()] } });
        }
        return route.fulfill({ json: path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'agency', name: 'Agency' } } : path.endsWith('/handoffs') ? { revision: 0, valid: true, rules: [], max_hops: 3 } : path.includes('/studio/') ? { client: { id: 'c', name: 'Client', is_active: true }, agents, channels: [] } : [] });
      });
      await page.goto((process.env.WEB_URL || 'http://127.0.0.1:3119') + '/clients/c/studio');
      const panel = page.locator('[data-execution-panel]');
      const load = panel.getByRole('button', { name: es ? 'Cargar turnos' : 'Load turns', exact: true });
      await load.focus(); await page.keyboard.press('Enter');
      await panel.getByRole('status').filter({ hasText: es ? 'Todavía no hay' : 'No execution' }).waitFor();
      assert.equal(writes.length, 0);
      empty = false; await load.click();
      await panel.getByRole('button', { name: es ? 'Siguiente' : 'Next', exact: true }).click();
      await panel.getByRole('status').waitFor();
      await panel.getByRole('button', { name: es ? 'Anterior' : 'Previous', exact: true }).click();
      const open = panel.getByRole('button', { name: es ? 'Revisar hacia humano' : 'Review toward human', exact: true });
      await open.click();
      const close = panel.getByRole('button', { name: es ? 'Cerrar hacia humano' : 'Close toward human', exact: true });
      assert(await close.isDisabled());
      await panel.getByRole('textbox').fill('Verified provider logs'); assert(await close.isDisabled());
      await panel.getByRole('checkbox').check();
      page.once('dialog', d => d.dismiss()); await close.click(); assert.equal(writes.length, 0);
      await page.screenshot({ path: `/tmp/studio-execution-${lang}-${width}.png`, fullPage: true });
      page.once('dialog', d => d.accept()); await close.click();
      await panel.getByRole('status').filter({ hasText: es ? 'Revisión guardada' : 'Review saved' }).waitFor();
      assert.equal(writes.length, 1); assert.equal(await open.count(), 0);
      await load.click(); await panel.locator('summary').click();
      await panel.getByText('Verified provider logs', { exact: true }).waitFor();
      assert.equal(await open.count(), 0);
      reviewed = false; await load.click(); await open.click();
      await panel.getByRole('textbox').fill('Verified provider logs'); await panel.getByRole('checkbox').check();
      conflict = true; page.once('dialog', d => d.accept()); await close.click();
      await panel.getByRole('alert').filter({ hasText: 'Execution owner changed' }).waitFor();
      assert.equal(writes.length, 2); assert.equal(await close.count(), 0); assert.equal(await open.count(), 0);
      failRead = true; await load.click(); await panel.getByRole('alert').filter({ hasText: 'Unavailable' }).waitFor();
      assert.equal(writes.length, 2);
      failRead = false; conflict = false; lost = true; await load.click(); await open.click();
      await panel.getByRole('textbox').fill('Verified provider logs'); await panel.getByRole('checkbox').check();
      page.once('dialog', d => d.accept()); await close.click();
      await panel.getByRole('alert').filter({ hasText: 'Response lost after commit' }).waitFor();
      assert.equal(writes.length, 3); assert.equal(await close.count(), 0);
      await load.click(); await panel.locator('summary').click();
      await panel.getByText('Verified provider logs', { exact: true }).waitFor();
      assert.equal(writes.length, 3); assert.equal(await open.count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS execution review ES/EN 1440/390/320 light/dark: empty, pagination, audit, explicit acknowledgment/confirmation, stale-owner lockout, load errors, keyboard, no auto-retry or unrelated writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
