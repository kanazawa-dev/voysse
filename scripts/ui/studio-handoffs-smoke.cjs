const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const width of [1440, 390, 320]) {
      console.log('Checking', lang, width);
      const es = lang === 'es', errors = [], writes = [];
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      let conflict = false, reject = false, accept = false;
      let draft = { rules: [], max_hops: 1, human_fallback: true, revision: 0, valid: true, problems: [] };
      const agents = ['Sales', 'Support'].map((name, i) => ({ id: String(i), name, is_active: true, updated_at: '2026-09-06', widget_enabled: false }));
      await page.addInitScript(({lang, width}) => { localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', width === 390 ? 'dark' : 'light'); }, {lang, width});
      page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', d => accept ? d.accept() : d.dismiss());
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
          writes.push(path); assert(path.endsWith('/handoffs')); assert.equal(req.method(), 'PUT');
          if (conflict || reject) return route.fulfill({ status: conflict ? 409 : 422, json: { detail: conflict ? 'Draft changed' : 'Invalid handoff draft: cycle' } });
          const body = req.postDataJSON(); assert.equal(body.expected_revision, draft.revision);
          assert.equal(body.human_fallback, true); assert(!('runtime_enabled' in body));
          draft = { ...draft, ...body, revision: draft.revision + 1 };
        }
        const json = path.endsWith('/auth/me') ? { id: 'u', name: 'Alex', role: 'admin', agency: { id: 'agency', name: 'Agency' } } : path.endsWith('/handoffs') ? draft : path.includes('/studio/') ? { client: { id: 'c', name: 'Client', is_active: true }, agents, channels: [] } : [];
        await route.fulfill({ json });
      });
      await page.goto((process.env.WEB_URL || 'http://127.0.0.1:3116') + '/clients/c/studio');
      const panel = page.locator('[data-handoff-editor]');
      const button = (en, spanish) => panel.getByRole('button', { name: es ? spanish : en, exact: true });
      await button('Add connection', 'Añadir conexión').click();
      await panel.getByRole('combobox', { name: es ? 'Hacia' : 'To', exact: true }).selectOption('1');
      await panel.getByRole('textbox').fill('Technical help');
      await button('Save draft', 'Guardar borrador').click();
      await panel.getByRole('status').filter({ hasText: es ? 'Borrador guardado' : 'Draft saved' }).waitFor();
      await page.screenshot({ path: `/tmp/studio-handoff-rules-${lang}-${width}.png`, fullPage: true });
      const before = writes.length;
      await panel.getByLabel(es ? 'Comenzar con' : 'Start with', { exact: true }).selectOption('0');
      await panel.getByRole('button', { name: 'Technical help → Support', exact: true }).click();
      await panel.getByText(es ? 'Límite alcanzado o sin reglas' : 'Hop limit reached or no rules', { exact: false }).waitFor();
      await button('Go to human attention', 'Pasar a atención humana').click();
      await panel.getByRole('status').filter({ hasText: 'Sales → Support →' }).waitFor();
      assert.equal(writes.length, before, 'walkthrough never writes');
      conflict = true;
      await panel.getByRole('textbox').fill('Preserve local edit');
      await button('Save draft', 'Guardar borrador').click();
      await panel.getByRole('alert').filter({ hasText: 'Draft changed' }).waitFor();
      assert.equal(await panel.getByRole('textbox').inputValue(), 'Preserve local edit');
      await button('Reload draft', 'Recargar borrador').click();
      assert.equal(await panel.getByRole('textbox').inputValue(), 'Preserve local edit', 'cancel reload keeps edits');
      accept = true; conflict = false;
      await button('Reload draft', 'Recargar borrador').click();
      await page.waitForFunction(() => document.querySelector('[data-handoff-editor] textarea').value === 'Technical help');
      reject = true;
      await panel.getByRole('textbox').fill('Rejected draft');
      await button('Save draft', 'Guardar borrador').click();
      await panel.getByRole('alert').filter({ hasText: 'cycle' }).waitFor();
      assert.equal(await panel.getByRole('textbox').inputValue(), 'Rejected draft');
      reject = false;
      await button('Remove connection 1', 'Eliminar conexión 1').click();
      await button('Save draft', 'Guardar borrador').click();
      await panel.getByRole('status').filter({ hasText: es ? 'Borrador guardado' : 'Draft saved' }).waitFor();
      assert.equal(draft.rules.length, 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow');
      await page.screenshot({ path: `/tmp/studio-handoff-${lang}-${width}.png`, fullPage: true });
      draft = { ...draft, rules: [{ source_agent_id: '0', target_agent_id: 'missing', condition: 'Deleted target' }], valid: false, problems: ['unavailable_agent'] };
      await button('Reload draft', 'Recargar borrador').click();
      await panel.getByRole('alert').filter({ hasText: es ? 'Revisa el borrador' : 'Review the draft' }).waitFor();
      assert(await panel.getByLabel(es ? 'Comenzar con' : 'Start with', { exact: true }).isDisabled());
      let release, seen, first = true;
      const held = new Promise(resolve => { release = resolve; });
      const requested = new Promise(resolve => { seen = resolve; });
      await page.route('**/api/studio/c/handoffs', async route => {
        if (first) { first = false; seen(); await held; return route.fulfill({ json: { ...draft, rules: [] } }); }
        return route.fulfill({ json: { ...draft, valid: true, rules: [{ source_agent_id: '0', target_agent_id: '1', condition: 'Fresh' }] } });
      });
      await page.reload(); await requested;
      await button('Load draft', 'Cargar borrador').click();
      await panel.getByRole('textbox').fill('Newer local edit');
      const late = page.waitForResponse(r => r.url().endsWith('/handoffs'));
      release(); await late;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await panel.getByRole('textbox').inputValue(), 'Newer local edit', 'late initial GET cannot replace newer edits');
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('PASS handoff editor ES/EN 1440/390/320 light/dark: save/clear, CAS/422 preservation, reload confirmation, bounded manual rehearsal without writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
