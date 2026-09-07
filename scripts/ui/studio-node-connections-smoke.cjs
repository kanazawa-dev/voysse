const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch();try{
 for(const lang of ['es','en']) for(const [immersive,width] of [[true,1440],[true,390],[false,390]]){
  const es=lang==='es',errors=[],writes=[];
  let conflict=false,draft={rules:[],max_hops:3,human_fallback:true,revision:0,valid:true,problems:[]};
  const agents=['Sales','Support','Inactive'].map((name,i)=>({id:String(i),name,is_active:i!==2,updated_at:'2026-09-07',widget_enabled:false}));
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.addInitScript(({lang,width})=>{localStorage.setItem('openvoiss.lang',lang);localStorage.setItem('voysse.theme',width===390?'dark':'light');},{lang,width});
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   if(req.method()!=='GET'){
    writes.push(p);assert(p.endsWith('/handoffs'));assert.equal(req.method(),'PUT');
    if(conflict)return route.fulfill({status:409,json:{detail:'Draft changed'}});
    const body=req.postDataJSON();assert.equal(body.expected_revision,draft.revision);
    draft={...draft,...body,revision:draft.revision+1};
   }
   const json=p.endsWith('/auth/me')?{id:'u',name:'Alex',role:'admin',agency:{id:'agency',name:'Agency'}}:
    p.endsWith('/onboarding')?{step:7,status:'completed',revision:1}:
    p.endsWith('/handoffs')?draft:p.endsWith('/policies')?{items:[],revision:0}:p.endsWith('/execution')?{items:[]}:
    p.includes('/studio/')?{client:{id:'c',name:'Client',is_active:true},agents,channels:[]}:[];
   await route.fulfill({json});
  });
  await page.goto((process.env.WEB_URL||'http://127.0.0.1:3140')+(immersive?'/studio/c':'/clients/c/studio'));
  const panel=page.locator('[data-handoff-editor]'),node=id=>page.locator(`[data-studio-node="agent:${id}"]`);
  const connect=page.getByRole('button',{name:es?'Conectar nodos':'Connect nodes',exact:true});
  await page.waitForFunction(()=>document.querySelector('[data-handoff-editor] form'));
  await connect.click();await node('0').click();await node('1').click();
  const condition=panel.locator('textarea').first();await condition.waitFor();assert.equal(await condition.inputValue(),'');
  assert.equal(writes.length,0);assert.equal(await page.locator('[data-studio-handoff-edge]').count(),1);
  await condition.fill('Technical help');await panel.getByRole('button',{name:es?'Guardar borrador':'Save draft',exact:true}).click();
  await panel.getByRole('status').filter({hasText:es?'Borrador guardado':'Draft saved'}).waitFor();assert.equal(draft.rules.length,1);
  const close=async()=>{if(immersive)await page.getByRole('button',{name:es?'Cerrar panel':'Close panel',exact:true}).click()};
  await close();await node('0').click();await node('1').click();assert.equal(await panel.locator('[data-rule-index]').count(),1,'duplicate only focuses rule');
  await close();await node('1').click();await node('0').click();await panel.getByRole('alert').filter({hasText:es?'Conexión no válida':'Invalid connection'}).waitFor();assert.equal(await page.locator('[data-studio-handoff-edge]').count(),1);
  await close();await node('0').click();await node('2').click();await panel.getByRole('alert').filter({hasText:es?'Conexión no válida':'Invalid connection'}).waitFor();assert.equal(writes.length,1);
  await condition.fill('Preserved on conflict');conflict=true;await panel.getByRole('button',{name:es?'Guardar borrador':'Save draft',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Draft changed'}).waitFor();assert.equal(await condition.inputValue(),'Preserved on conflict');conflict=false;
  await panel.getByRole('button',{name:es?'Recargar borrador':'Reload draft',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-handoff-editor] textarea').value==='Technical help');
  await page.screenshot({path:`/tmp/studio-node-edge-${lang}-${immersive}-${width}.png`});
  await close();await page.getByRole('button',{name:es?'Cancelar conexión':'Cancel connection',exact:true}).click();
  if(immersive&&width===1440){await page.locator('[data-studio-handoff-edge]').press('Enter');await condition.waitFor();await close();}
  await connect.click();await node('0').focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');assert(await connect.isVisible(),'Escape exits');
  await page.reload();await page.locator('[data-studio-handoff-edge]').waitFor({state:'attached'});assert.equal(await page.locator('[data-studio-handoff-edge]').count(),1,'saved edge survives reload');
  if(immersive)await page.getByRole('button',{name:es?'Conexiones y pruebas':'Connections & tests',exact:true}).click();
  await panel.getByRole('button',{name:es?'Eliminar conexión 1':'Remove connection 1',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-studio-handoff-edge]'));
  if(immersive&&width===1440){await close();await connect.click();await node('0').dragTo(node('1'));await page.locator('[data-studio-handoff-edge]').waitFor();assert.equal(await panel.locator('[data-rule-index]').count(),1,'native drag creates rule');}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:`/tmp/studio-node-connections-${lang}-${immersive}-${width}.png`});await page.close();
 }
 console.log('PASS node connections ES/EN desktop/mobile: click/keyboard, draft condition, save/reload, duplicates/cycles/inactive, conflict preservation, remove, no live writes');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
