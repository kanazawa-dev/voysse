// Isolated browser contract tests. Every API request is intercepted; no live data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WEB_URL || 'http://127.0.0.1:3144';
const config = { instructions: 'Shared behavior', personality: 'Friendly', temperature: 0.7, max_tokens: 2048, memory_limit: 30 };
const stamp = '2026-09-08T12:00:00Z';

(async () => {
 const browser = await chromium.launch();
 try {
  for (const lang of ['es', 'en']) for (const theme of ['light', 'dark']) {
   const es = lang === 'es', errors = [], writes = [];
   let solutions = [], versions = new Map(), installations = [], failList = true, conflict = true, uncertain = false;
   let activeWrites = 0, maxActiveWrites = 0, role = 'admin', solutionReads = 0;
   const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
   await context.addInitScript(({lang, theme}) => {
    localStorage.setItem('openvoiss.lang', lang); localStorage.setItem('voysse.theme', theme);
    document.cookie = 'sidebar_state=false; path=/';
   }, { lang, theme });
   await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const json = value => route.fulfill({json:value});
    if (path === '/api/auth/me') return json({id:'owner',name:'Owner',role,email:'test@example.com',agency:{id:'agency',name:'Test agency'}});
    if (path === '/api/onboarding') return json({step:7,status:'completed',revision:1});
    if (path === '/api/clients') return json([{id:'c1',name:'First client',is_active:true},{id:'c2',name:'Second client',is_active:true},{id:'c3',name:'Inactive client',is_active:false}]);
    if (method !== 'GET') {
     assert(path.startsWith('/api/solutions'), `Unexpected write: ${method} ${path}`);
     assert.equal(method, 'POST'); writes.push({path,body:req.postDataJSON()});
     activeWrites++; maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
     await new Promise(resolve => setTimeout(resolve, 100)); activeWrites--;
    }
    if (path === '/api/solutions') {
     if (method === 'GET') solutionReads++;
     if (method === 'POST') {
      if (uncertain) return route.fulfill({status:503,json:{detail:'Unknown result'}});
      const body = req.postDataJSON(); assert.deepEqual(Object.keys(body).sort(), ['name','settings']);
      solutions.unshift({id:'s1',name:body.name,latest_version:1,created_at:stamp});
      versions.set(1,{solution_id:'s1',number:1,settings:body.settings}); return json(solutions[0]);
     }
     if (failList) { failList=false; return route.fulfill({status:503,json:{detail:'Offline'}}); }
     const offset=Number(url.searchParams.get('offset')||0); return json(solutions.slice(offset,offset+50));
    }
    if (path === '/api/solutions/s1/versions') {
     if (method === 'POST') {
      const body=req.postDataJSON();
      if (conflict) { conflict=false; versions.set(2,{solution_id:'s1',number:2,settings:{...config,personality:'Other editor'}}); solutions[0].latest_version=2;
       return route.fulfill({status:409,json:{detail:'Stale version'}}); }
      assert.equal(body.expected_latest_version,2,'explicit reviewed base required');
      versions.set(3,{solution_id:'s1',number:3,settings:body.settings}); solutions[0].latest_version=3; return json(versions.get(3));
     }
     return json([...versions.values()].sort((a,b)=>b.number-a.number).slice(0,Number(url.searchParams.get('limit')||50)));
    }
    if (/\/versions\/\d+$/.test(path)) return json(versions.get(Number(path.split('/').at(-1))));
    if (path === '/api/solutions/s1/installations') {
     if (method === 'POST') {
      const body=req.postDataJSON(); assert.deepEqual(Object.keys(body).sort(),['client_id','name','version_number']);
      assert.equal(body.version_number,3); assert.equal(body.client_id,'c1');
      installations.push({id:'i1',client_id:'c1',agent_id:'a1',version_number:3}); return json(installations[0]);
     }
     return json(installations);
    }
    assert.equal(method,'GET'); return json([]);
   });
   const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
   await page.goto(base+'/solutions');
   await page.getByRole('button',{name:es?'Reintentar':'Retry',exact:true}).click();
   await page.getByRole('heading',{name:es?'Tu biblioteca reutilizable empieza aquí':'Your reusable library starts here'}).waitFor();
   assert.equal(writes.length,0);
   await page.getByRole('button',{name:es?'Nueva solución':'New solution',exact:true}).click();
   const dialog=page.getByRole('dialog'); await dialog.waitFor();
   for (const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000}); await page.waitForTimeout(250); const box=await dialog.boundingBox();
    assert(box.x>=0 && box.x+box.width<=width+1,'dialog fits');
    if (!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))) {
     await page.screenshot({path:'/tmp/solutions-overflow.png',fullPage:true});
     console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(-15).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,60)}))})));
     assert.fail('no horizontal overflow');
    }
   }
   await page.keyboard.press('Tab'); assert(await dialog.evaluate(node=>node.contains(document.activeElement)),'focus stays in dialog');
   await dialog.getByLabel(es?'Nombre de la solución':'Solution name',{exact:true}).fill('Reusable support');
   await dialog.getByLabel(es?'Instrucciones compartidas':'Shared instructions').fill(config.instructions);
   await dialog.getByRole('checkbox').check();
   await dialog.getByRole('button',{name:es?'Crear solución':'Create solution',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   await page.getByRole('button',{name:/Reusable support/}).click();
   await page.getByRole('button',{name:es?'Publicar nueva versión':'Publish new version',exact:true}).click();
   await dialog.getByLabel(es?'Instrucciones compartidas':'Shared instructions').fill('My preserved draft');
   await dialog.getByRole('checkbox').check();
   await dialog.getByRole('button',{name:es?'Publicar nueva versión':'Publish new version',exact:true}).click();
   await dialog.getByRole('alert').waitFor();
   assert.equal(await dialog.getByLabel(es?'Instrucciones compartidas':'Shared instructions').inputValue(),'My preserved draft');
   assert(await dialog.getByRole('button',{name:es?'Publicar nueva versión':'Publish new version',exact:true}).isDisabled());
   await dialog.getByRole('button',{name:es?'Revisar última versión':'Review latest version',exact:true}).click();
   await dialog.getByRole('button',{name:/^(Ya comparé|I compared it)/}).click();
   assert.equal(await dialog.getByLabel(es?'Instrucciones compartidas':'Shared instructions').inputValue(),'My preserved draft');
   await dialog.getByRole('button',{name:es?'Publicar nueva versión':'Publish new version',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   const select=page.getByLabel(es?'Cliente':'Client',{exact:true}); await select.selectOption('c1');
   assert.equal(await select.locator('option[value="c3"]').count(),0,'inactive clients excluded');
   await page.getByRole('checkbox').check();
   await page.getByRole('button',{name:es?'Instalar para un cliente · v3':'Install for a client · v3',exact:true}).click();
   await page.getByRole('status').filter({hasText:es?'Instalado y apagado':'Installed inactive'}).waitFor();
   assert.equal(await page.getByRole('link',{name:es?'Revisar agente':'Review agent',exact:true}).first().getAttribute('href'),'/agents/a1');
   await page.waitForFunction(()=>document.querySelector('option[value="c1"]')?.disabled);
   assert.equal(installations.length,1); assert.equal(maxActiveWrites,1);
   for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000}); await page.waitForTimeout(250);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'detail fits');
    if (width === 1440) await page.screenshot({path:`/tmp/solutions-desktop-${lang}-${theme}.png`,fullPage:true});
   }
   await page.screenshot({path:`/tmp/solutions-${lang}-${theme}.png`,fullPage:true});
   await page.getByRole('button',{name:es?'Volver a la biblioteca':'Back to library',exact:true}).click();
   uncertain=true;
   await page.getByRole('button',{name:es?'Nueva solución':'New solution',exact:true}).click();
   await dialog.getByLabel(es?'Nombre de la solución':'Solution name',{exact:true}).fill('Uncertain');
   await dialog.getByRole('checkbox').check(); await dialog.getByRole('button',{name:es?'Crear solución':'Create solution',exact:true}).click();
   await dialog.getByRole('alert').waitFor(); assert(await dialog.getByRole('button',{name:es?'Crear solución':'Create solution',exact:true}).isDisabled());
   await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
   solutions = Array.from({length:51},(_,index)=>({id:`page-${index}`,name:`Paged solution ${index}`,latest_version:1,created_at:stamp}));
   await page.reload();
   await page.getByRole('button',{name:/Paged solution 0 /}).waitFor();
   await page.getByRole('button',{name:es?'Siguiente':'Next',exact:true}).click();
   await page.getByRole('button',{name:/Paged solution 50 /}).waitFor();
   assert(await page.getByRole('button',{name:es?'Siguiente':'Next',exact:true}).isDisabled());
   await page.getByRole('button',{name:es?'Anterior':'Previous',exact:true}).click();
   await page.getByRole('button',{name:/Paged solution 0 /}).waitFor();
   role='operator'; const readsBefore=solutionReads;
   await page.reload(); await page.waitForURL('**/inbox');
   assert.equal(await page.locator('a[href="/solutions"]').count(),0,'operator has no library navigation');
   assert.equal(solutionReads,readsBefore,'operator does not mount library');
   assert.deepEqual(errors,[]); assert.equal(writes.length,5);
   console.log(`PASS ${lang}/${theme}: create, CAS review, inactive install, uncertain outcome, pagination, operator gate, 1440/390/320`);
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
