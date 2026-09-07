const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WEB_URL || 'http://127.0.0.1:3138';
(async () => {
 const browser = await chromium.launch();
 try {
  for (const theme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const role of ['admin', 'operator']) {
   const es = lang === 'es', errors = [], writes = [];
   let value = {step:0,status:'new',revision:0}, fail = false;
   const context = await browser.newContext({viewport:{width:1440,height:900}});
   await context.addInitScript(({lang, theme}) => { localStorage.setItem('openvoiss.lang',lang); localStorage.setItem('voysse.theme',theme); },{lang,theme});
   await context.route('**/api/**', async route => {
    const req=route.request(), path=new URL(req.url()).pathname;
    if(path==='/api/onboarding') {
     if(req.method()==='PUT') {
      const body=req.postDataJSON(); writes.push(path);
      if(fail) return route.fulfill({status:409,json:{detail:'Tour changed in another tab'}});
      assert.equal(body.expected_revision,value.revision);
      value={step:body.step,status:body.status,revision:value.revision+1};
     }
     return route.fulfill({json:value});
    }
    assert.equal(req.method(),'GET','tour never creates resources or calls AI');
    return route.fulfill({json:path.endsWith('/auth/me') ? {id:'user',name:'Test',role,email:'user@example.com',agency:{id:'agency',name:'Agency'}} : []});
   });
   const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
   const home=role==='admin'?'/clients':'/inbox';
   await page.goto(base+home);
   const dialog=page.getByRole('dialog'); await dialog.waitFor();
   assert.equal(writes.length,0,'first display is read only');
   for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:800});
    const box=await dialog.boundingBox(); assert(box.x>=0 && box.x+box.width<=width,'dialog fits viewport');
    await page.keyboard.press('Tab'); await page.waitForFunction(() => document.querySelector('[data-onboarding-tour]')?.contains(document.activeElement), null, { timeout: 2000 });
   }
   await page.screenshot({path:`/tmp/onboarding-${lang}-${role}-${theme}.png`});
   const next=dialog.getByRole('button',{name:es?'Siguiente':'Next',exact:true});
   await next.click(); await page.waitForFunction(() => document.querySelector('[data-onboarding-tour]').getAttribute('aria-busy')==='false');
   assert.equal(value.step,1);
   if(role==='admin') {
    await next.click(); await page.waitForFunction(() => document.querySelector('[data-onboarding-tour]').getAttribute('aria-busy')==='false');
    await dialog.getByRole('button',{name:es?'Abrir configuración':'Open setup',exact:true}).click();
    await page.waitForURL('**/clients/new');
    assert.equal(value.step,2); assert.equal(await dialog.count(),0);
    await page.getByRole('button',{name:es?'Primeros pasos':'Getting started',exact:true}).click(); await dialog.waitFor();
   }
   await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
   await page.waitForTimeout(100);
   await page.reload(); await page.getByRole('button',{name:es?'Primeros pasos':'Getting started',exact:true}).waitFor();
   assert.equal(await dialog.count(),0,'dismissal survives reload');
   await page.getByRole('button',{name:es?'Primeros pasos':'Getting started',exact:true}).click(); await dialog.waitFor();
   const last=role==='admin'?7:2;
   while(value.step<last) {await next.click();await page.waitForFunction(()=>document.querySelector('[data-onboarding-tour]').getAttribute('aria-busy')==='false');}
   await dialog.getByRole('button',{name:es?'Terminar recorrido':'Finish tour',exact:true}).click(); await dialog.waitFor({state:'hidden'});
   assert.equal(value.status,'completed');
   await page.reload(); await page.getByRole('button',{name:es?'Primeros pasos':'Getting started',exact:true}).click();
   await dialog.getByRole('button',{name:es?'Repetir recorrido':'Repeat tour',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('[data-onboarding-tour]').getAttribute('aria-busy')==='false'); assert.equal(value.step,0);
   fail=true; await next.click(); await dialog.getByRole('alert').waitFor(); assert.equal(value.step,0,'failed save does not advance');
   await dialog.getByRole('button',{name:es?'Ahora no':'Not now',exact:true}).click(); await dialog.waitFor({state:'hidden'});
   assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'workspace fits mobile');
   assert.deepEqual(errors,[]); await context.close();
  }
  console.log('PASS onboarding ES/EN admin/operator: first access, mobile, focus, setup navigation, persisted dismissal, completion, repeat, conflict and nonblocking exit.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
