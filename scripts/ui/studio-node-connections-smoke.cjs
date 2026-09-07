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
  const panel=page.locator('[data-handoff-editor]'),node=id=>page.locator(`button[data-studio-node="agent:${id}"]`),handle=id=>page.locator(`[data-connector-handle][data-studio-node="agent:${id}"]`);
  await page.waitForFunction(()=>document.querySelector('[data-handoff-editor] form'));
  // Drag from node 0's connector handle to node 1: point-to-point connection, no mode toggle.
  await handle('0').hover();await page.mouse.down();await node('1').hover();await page.mouse.up();
  const condition=panel.locator('textarea').first();await condition.waitFor();assert.equal(await condition.inputValue(),'');
  assert.equal(writes.length,0);assert.equal(await page.locator('[data-studio-handoff-edge]').count(),1);
  await condition.fill('Technical help');await panel.getByRole('button',{name:es?'Guardar borrador':'Save draft',exact:true}).click();
  await panel.getByRole('status').filter({hasText:es?'Borrador guardado':'Draft saved'}).waitFor();assert.equal(draft.rules.length,1);
  const close=async()=>{if(immersive)await page.getByRole('button',{name:es?'Cerrar panel':'Close panel',exact:true}).click()};
  const link=async(a,b)=>{await handle(a).hover();await page.mouse.down();await node(b).hover();await page.mouse.up();};
  await close();await link('0','1');assert.equal(await panel.locator('[data-rule-index]').count(),1,'duplicate only focuses rule');
  await close();await link('1','0');await panel.getByRole('alert').filter({hasText:es?'Conexión no válida':'Invalid connection'}).waitFor();assert.equal(await page.locator('[data-studio-handoff-edge]').count(),1);
  await close();await link('0','2');await panel.getByRole('alert').filter({hasText:es?'Conexión no válida':'Invalid connection'}).waitFor();assert.equal(writes.length,1);
  await condition.fill('Preserved on conflict');conflict=true;await panel.getByRole('button',{name:es?'Guardar borrador':'Save draft',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Draft changed'}).waitFor();assert.equal(await condition.inputValue(),'Preserved on conflict');conflict=false;
  await panel.getByRole('button',{name:es?'Recargar borrador':'Reload draft',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-handoff-editor] textarea').value==='Technical help');
  await page.screenshot({path:`/tmp/studio-node-edge-${lang}-${immersive}-${width}.png`});
  await close();await page.keyboard.press('Escape');
  if(immersive&&width===1440){await page.locator('[data-studio-handoff-edge]').press('Enter');await condition.waitFor();await close();}
  await page.reload();await page.locator('[data-studio-handoff-edge]').waitFor({state:'attached'});assert.equal(await page.locator('[data-studio-handoff-edge]').count(),1,'saved edge survives reload');
  if(immersive)await page.getByRole('button',{name:es?'Conexiones y pruebas':'Connections & tests',exact:true}).click();
  await panel.getByRole('button',{name:es?'Eliminar conexión 1':'Remove connection 1',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-studio-handoff-edge]'));
  if(immersive&&width===1440){
   await close();
   // Dragging the node body (not the handle) repositions it instead of connecting.
   const before=await node('0').evaluate(el=>el.closest('div').style.left);
   await node('0').hover();await page.mouse.down();await page.mouse.move(600,500,{steps:6});await page.mouse.up();
   assert.notEqual(await node('0').evaluate(el=>el.closest('div').style.left),before,'body drag repositions, does not connect');
   assert.equal(await page.locator('[data-studio-handoff-edge]').count(),0);
   await link('0','1');await page.locator('[data-studio-handoff-edge]').waitFor();assert.equal(await panel.locator('[data-rule-index]').count(),1,'handle drag creates rule');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:`/tmp/studio-node-connections-${lang}-${immersive}-${width}.png`});await page.close();
 }
 console.log('PASS node connections ES/EN desktop/mobile: handle drag-to-connect, draft condition, save/reload, duplicates/cycles/inactive, conflict preservation, remove, body drag repositions not connects, no live writes');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
