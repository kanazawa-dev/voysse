const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const width of [1440, 390, 320]) {
      const es = lang === 'es', writes = [], errors = [];
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const policy = { rules: [{ source_agent_id: 'a', target_agent_id: 'b', condition: 'Technical question' }], max_hops: 3, human_fallback: true };
      const draft = { ...policy, revision: 5, valid: true, problems: [] };
      const version = (revision, snapshot = policy) => ({ id: `v-${revision}`, revision, actor_id: 'a-long-historical-actor-identifier-1234567890', policy: snapshot,
        created_at: '2026-09-06T12:00:00Z', request: { action: snapshot ? 'publish' : 'unpublish', reason: 'Reviewed routing' } });
      let versions = [], conflict = false, lost = false, readError = false;
      await page.addInitScript(({lang, width}) => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', width === 390 ? 'dark' : 'light'); }, {lang, width});
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() !== 'GET') {
          writes.push(req.postDataJSON()); assert.equal(path, '/api/studio/c/policies'); assert.equal(req.method(), 'POST');
          const body = writes.at(-1); assert.equal(body.expected_revision, versions[0]?.revision || 0);
          assert.equal(body.reason, 'Reviewed routing'); assert.match(body.request_id, /^[0-9a-f-]{36}$/);
          assert.equal(body.runtime_enabled, undefined);
          if (conflict) return route.fulfill({ status: 409, json: { detail: 'Published policy changed' } });
          if (body.action === 'publish') { assert.equal(body.draft_revision, 5); assert.equal(body.restore_revision, undefined); }
          if (body.action === 'restore') { assert.equal(body.restore_revision, 1); assert.equal(body.draft_revision, undefined); }
          if (body.action === 'unpublish') { assert.equal(body.draft_revision, undefined); assert.equal(body.restore_revision, undefined); }
          const row = version((versions[0]?.revision || 0) + 1, body.action === 'unpublish' ? null : policy);
          versions.unshift(row);
          return route.fulfill(lost ? { status: 503, json: { detail: 'Response lost after commit' } } : { json: { version: row, applied: true, runtime_enabled: false } });
        }
        if (path.endsWith('/policies')) {
          if (readError) return route.fulfill({ status: 503, json: { detail: 'History unavailable' } });
          const before = Number(url.searchParams.get('before_revision'));
          return route.fulfill({ json: { runtime_enabled: false, items: before ? versions.filter(v => v.revision < before) : versions.slice(0, 1), has_more: !before && versions.length > 1 } });
        }
        return route.fulfill({ json: path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'agency', name: 'Agency' } } : path.endsWith('/handoffs') ? draft : path.includes('/studio/') ? { client: { id: 'c', name: 'Client', is_active: true }, agents: ['a', 'b'].map((id, i) => ({ id, name: i ? 'Support' : 'Sales', is_active: true })), channels: [] } : [] });
      });
      await page.goto((process.env.WEB_URL || 'http://127.0.0.1:3120') + '/clients/c/studio');
      const panel = page.locator('[data-policy-panel]');
      const load = panel.getByRole('button', { name: es ? 'Cargar historial' : 'Load history', exact: true });
      const publish = panel.getByRole('button', { name: es ? 'Publicar borrador guardado' : 'Publish saved draft', exact: true });
      const confirm = panel.getByRole('button', { name: es ? 'Confirmar cambio de versión' : 'Confirm version change', exact: true });
      await load.focus(); await page.keyboard.press('Enter');
      await panel.getByText(es ? 'No hay versiones registradas.' : 'No recorded versions.', { exact: true }).waitFor();
      assert.equal(writes.length, 0); await publish.click(); assert(await confirm.isDisabled());
      await panel.getByRole('textbox').fill('Reviewed routing');
      page.once('dialog', d => d.dismiss()); await confirm.click(); assert.equal(writes.length, 0);
      page.once('dialog', d => d.accept()); await confirm.click();
      await panel.getByRole('status').filter({ hasText: es ? 'registrada' : 'recorded' }).waitFor();
      assert.equal(writes.length, 1); assert.equal(await publish.count(), 0);
      await load.click(); await panel.getByRole('status').filter({ hasText: es ? 'Coincide' : 'Matches' }).waitFor(); assert(await publish.isDisabled());
      versions = [version(3, { ...policy, max_hops: 2 }), version(2, null), version(1)];
      await load.click(); await panel.getByRole('button', { name: es ? 'Cargar anteriores' : 'Load older versions', exact: true }).click();
      await panel.getByRole('button', { name: es ? 'Restaurar versión 1' : 'Restore version 1', exact: true }).click();
      assert.match(await panel.getByRole('status').innerText(), /3/);
      await panel.getByRole('textbox').fill('Reviewed routing');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/studio-policies-${lang}-${width}.png`, fullPage: true });
      page.once('dialog', d => d.accept()); await confirm.click();
      await panel.getByRole('status').filter({ hasText: es ? 'registrada' : 'recorded' }).waitFor();
      assert.equal(writes.at(-1).expected_revision, 3); assert.equal(writes.at(-1).restore_revision, 1);
      await load.click(); await panel.getByRole('status').filter({ hasText: es ? 'Coincide' : 'Matches' }).waitFor();
      const unpublish = panel.getByRole('button', { name: es ? 'Retirar publicación' : 'Unpublish', exact: true });
      await unpublish.click(); await panel.getByRole('textbox').fill('Reviewed routing'); lost = true;
      page.once('dialog', d => d.accept()); await confirm.click();
      await panel.getByRole('alert').filter({ hasText: 'Response lost after commit' }).waitFor();
      assert.equal(writes.length, 3); assert.equal(await confirm.count(), 0);
      await load.click(); await panel.getByText(es ? 'Sin política publicada' : 'No published policy', { exact: true }).first().waitFor();
      assert(await unpublish.isDisabled()); assert.equal(writes.length, 3);
      lost = false; conflict = true; await publish.click(); await panel.getByRole('textbox').fill('Reviewed routing');
      page.once('dialog', d => d.accept()); await confirm.click();
      await panel.getByRole('alert').filter({ hasText: 'Published policy changed' }).waitFor();
      assert.equal(writes.length, 4); assert.equal(await publish.count(), 0);
      readError = true; await load.click(); await panel.getByRole('alert').filter({ hasText: 'History unavailable' }).waitFor();
      assert.equal(await publish.count(), 0);
      await page.getByRole('button', { name: es ? 'Añadir conexión' : 'Add connection', exact: true }).click();
      await panel.waitFor({ state: 'detached' });
      assert.equal(await panel.count(), 0, 'unsaved draft removes publication controls');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS policy controls ES/EN 1440/390/320 light/dark: comparison, current head across history pages, publish/restore/unpublish, confirm/cancel, lost response reconciliation, stale/read failures, dirty draft, keyboard, zero unrelated writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
