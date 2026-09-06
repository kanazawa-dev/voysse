const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['en', 'es']) {
      const es = lang === 'es', page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const agent = (id, name) => ({ id, name, instructions: '', description: '', model: 'test-model', is_active: true, updated_at: '2026-09-06T00:00:00Z', widget_enabled: false, widget_color: '#5135ff', widget_greeting: 'Hello', widget_position: 'right' });
      const graph = { client: { id: 'client-a', name: 'Alpha', is_active: true }, agents: [agent('a', 'Sales'), agent('b', 'Support')], channels: ['whatsapp', 'whatsapp-cloud', 'instagram', 'messenger'].map(kind => ({ kind, id: kind, agent_id: 'a', status: 'connected', is_enabled: true, updated_at: '2026-09-06T00:00:00Z' })) };
      const writes = [], errors = []; let confirm = false, conflict = false;
      await page.addInitScript(lang => localStorage.setItem('openvoiss.lang', lang), lang);
      page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', dialog => confirm ? dialog.accept() : dialog.dismiss());
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() !== 'GET') {
          const body = request.postDataJSON(); writes.push({ path, body });
          if (conflict) return route.fulfill({ status: 409, json: { detail: 'Connection changed' } });
          if (path.endsWith('/preview')) return route.fulfill({ json: { text: 'Sandbox response', sources: [], tools_enabled: false } });
          if (path.includes('/channels/')) {
            const row = graph.channels.find(c => path.includes('/' + c.kind + '/'));
            assert.equal(body.expected_agent_id, row.agent_id); assert.equal(body.expected_updated_at, row.updated_at);
            row.agent_id = body.agent_id; row.updated_at = new Date().toISOString();
          } else if (path === '/api/agents') {
            assert.equal(body.client_id, 'client-a'); graph.agents.push(agent('new', body.name));
            return route.fulfill({ json: { id: 'new' } });
          } else {
            const row = graph.agents.find(a => path.endsWith('/' + a.id));
            assert.equal(body.expected_updated_at, row.updated_at);
            Object.assign(row, body, { updated_at: new Date().toISOString() });
          }
          return route.fulfill({ json: graph });
        }
        if (path.endsWith('/handoffs')) return route.fulfill({ json: { rules: [], max_hops: 3, human_fallback: true, revision: 0, valid: true, problems: [] } });
        return route.fulfill({ json: path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'agency', name: 'Agency' } } : path.includes('/studio/') ? graph : [] });
      });
      await page.goto((process.env.WEB_URL || 'http://127.0.0.1:3114') + '/clients/client-a/studio');
      await page.locator('[data-studio-node="channel:whatsapp"]').click();
      await page.getByLabel(es ? 'Agente asignado' : 'Assigned agent', { exact: true }).selectOption('b');
      await page.getByRole('button', { name: es ? 'Aplicar conexión' : 'Apply connection' }).click();
      assert.equal(writes.length, 0, 'cancel leaves live graph untouched');
      confirm = true;
      await page.getByRole('button', { name: es ? 'Aplicar conexión' : 'Apply connection' }).click();
      await page.waitForFunction(() => document.querySelector('[data-studio-node="channel:whatsapp"]').textContent.includes('Support'));
      assert.equal(graph.channels[0].is_enabled, true);
      await page.locator('[data-studio-node="channel:whatsapp-cloud"]').dragTo(page.locator('[data-studio-node="agent:b"]'));
      await page.waitForFunction(() => document.querySelector('[data-studio-node="channel:whatsapp-cloud"]').textContent.includes('Support'));
      assert.equal(graph.channels[1].agent_id, 'b');
      conflict = true;
      await page.getByLabel(es ? 'Agente asignado' : 'Assigned agent', { exact: true }).selectOption('a');
      await page.getByRole('button', { name: es ? 'Aplicar conexión' : 'Apply connection' }).click();
      await page.getByRole('alert').filter({ hasText: 'Connection changed' }).waitFor();
      assert.equal(graph.channels[0].agent_id, 'b'); conflict = false;
      await page.locator('[data-studio-node="agent:b"]').click();
      await page.getByLabel(es ? 'Instrucciones' : 'Instructions', { exact: true }).fill('Be concise');
      await page.getByRole('button', { name: es ? 'Revisar y guardar' : 'Review and save' }).click();
      await page.waitForFunction(() => !document.querySelector('fieldset').disabled);
      assert.equal(graph.agents[1].instructions, 'Be concise');
      await page.getByLabel(es ? 'Mensaje de prueba' : 'Test message', { exact: true }).fill('Hello');
      await page.getByRole('button', { name: es ? 'Enviar prueba' : 'Send test' }).click();
      await page.getByRole('log').getByText('Sandbox response', { exact: false }).waitFor();
      assert(writes.at(-1).path.endsWith('/preview')); assert.deepEqual(writes.at(-1).body.history, []);
      await page.screenshot({ path: `/tmp/studio-preview-${lang}.png`, fullPage: true });
      await page.getByRole('button', { name: es ? 'Nuevo agente' : 'New agent' }).click();
      await page.getByLabel(es ? 'Nombre' : 'Name', { exact: true }).fill('New assistant');
      await page.getByRole('button', { name: es ? 'Revisar y guardar' : 'Review and save' }).click();
      await page.locator('[data-studio-node="agent:new"]').waitFor();
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `/tmp/studio-edit-${lang}-${width}.png`, fullPage: true });
      }
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS Studio editing: confirmation/cancel, CAS conflicts, saved settings, safe preview, client-bound creation, ES/EN responsive.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
