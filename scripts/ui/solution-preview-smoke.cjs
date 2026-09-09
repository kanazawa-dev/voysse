// Isolated UI contract checks: all API requests are intercepted; no live tenants.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const config={instructions:'Shared instructions',personality:'Friendly',temperature:0.7,max_tokens:512,memory_limit:30};
const date='2026-09-08T12:00:00Z';
(async()=>{
 const browser=await chromium.launch();
 try{for(const lang of ['es','en'])for(const theme of ['light','dark']){
  const es=lang==='es',errors=[],writes=[];let fail=true,revision=1,pinAttempt=0,slow=false;
  const protectedFields=new Set(['max_tokens']);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({lang,theme})=>{localStorage.setItem('openvoiss.lang',lang);localStorage.setItem('voysse.theme',theme);document.cookie='sidebar_state=false; path=/';},{lang,theme});
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname;
   const json=value=>route.fulfill({json:value});
   if(req.method()!=='GET'){
    assert.equal(req.method(),'POST');assert.equal(p,'/api/solutions/s1/installations/i1/protected-fields');
    const body=req.postDataJSON();writes.push(body);assert.deepEqual(Object.keys(body).sort(),['expected_agent_updated_at','expected_revision','field']);
    assert.equal(body.expected_agent_updated_at,date);assert.equal(body.expected_revision,revision);
    pinAttempt++;revision++;
    if(pinAttempt===1)return route.fulfill({status:409,json:{detail:'Stale'}});
    protectedFields.add(body.field);
    if(pinAttempt===2)return route.fulfill({status:503,json:{detail:'Unknown outcome'}});
    return json({id:'i1',revision,local_overrides:[...protectedFields]});
   }
   if(p==='/api/auth/me')return json({id:'u',name:'Admin',role:'admin',agency:{id:'a',name:'Agency'}});
   if(p==='/api/onboarding')return json({step:7,status:'completed',revision:1});
   if(p==='/api/solutions')return json([{id:'s1',name:'Reusable service',latest_version:2,created_at:date}]);
   if(p==='/api/clients')return json([{id:'c1',name:'Client one',is_active:true},{id:'c2',name:'Client two',is_active:true}]);
   if(/\/versions\/\d+$/.test(p))return json({solution_id:'s1',number:Number(p.split('/').at(-1)),settings:config});
   if(p.endsWith('/installations'))return json([{id:'i1',client_id:'c1',agent_id:'a1',version_number:1},{id:'i2',client_id:'c2',agent_id:'a2',version_number:1}]);
   if(p.endsWith('/preview')){
    if(fail){fail=false;return route.fulfill({status:503,json:{detail:'Unavailable'}});}
    const second=p.includes('/i2/');if(slow&&!second)await new Promise(r=>setTimeout(r,650));
    return json({installation_id:second?'i2':'i1',installed_version:1,target_version:Number(url.searchParams.get('target_version')),revision,agent_updated_at:date,
     changes:Object.entries(config).map(([field,value])=>({field,baseline:value,current:field==='instructions'?(second?'Second client value':'Local '+'x'.repeat(180)):field==='max_tokens'?1024:value,
      target:field==='instructions'?'Updated shared':field==='personality'?'Formal':value,
      status:field==='instructions'?'conflict':field==='max_tokens'?'preserved':field==='personality'?(protectedFields.has(field)?'conflict':'updated'):protectedFields.has(field)?'preserved':'unchanged'})),
     conflicts:['instructions',...(protectedFields.has('personality')?['personality']:[])],local_overrides:[...protectedFields],detected_overrides:[...protectedFields,'instructions'],can_apply:false});
   }
   return json([]);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.WEB_URL||'http://127.0.0.1:3144')+'/solutions');
  await page.getByRole('button',{name:/Reusable service/}).click();
  const label=es?'Vista previa de actualización':'Preview update';
  await page.getByRole('button',{name:label+' · v2',exact:true}).first().click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('alert').waitFor();assert.equal(writes.length,0);
  const refresh=()=>dialog.getByRole('button',{name:es?'Actualizar':'Refresh',exact:true}).click();
  await refresh();await dialog.getByRole('heading',{name:es?'Instalada v1 → vista previa v2':'Installed v1 → preview v2'}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:/^(Apply|Aplicar)/}).count(),0);
  const pinLabel=es?'Proteger este valor del cliente':'Protect this client value';
  const field=name=>dialog.locator('section').filter({has:page.getByRole('heading',{name,exact:true})});
  const tone=field(es?'Tono y personalidad':'Tone and personality');
  await tone.getByRole('button',{name:pinLabel,exact:true}).click();await dialog.getByRole('alert').waitFor();
  assert(await tone.getByRole('button',{name:pinLabel,exact:true}).isDisabled());assert.equal(writes.length,1);
  await refresh();await tone.getByRole('button',{name:pinLabel,exact:true}).click();await dialog.getByRole('alert').waitFor();
  assert(await tone.getByRole('button',{name:pinLabel,exact:true}).isDisabled());assert.equal(writes.length,2);
  await refresh();await tone.getByText(es?'Protegido explícitamente':'Explicitly protected',{exact:true}).waitFor();
  const instructions=field(es?'Instrucciones compartidas':'Shared instructions');
  await instructions.getByRole('button',{name:pinLabel,exact:true}).click();
  await instructions.getByText(es?'Protegido explícitamente':'Explicitly protected',{exact:true}).waitFor();assert.equal(writes.length,3);
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);
   const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(box.y>=0&&box.y+box.height<=1001);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.keyboard.press('Tab');assert(await dialog.evaluate(n=>n.contains(document.activeElement)));
  await dialog.evaluate(n=>{n.scrollTop=0;});
  await page.screenshot({path:`/tmp/solution-preview-${lang}-${theme}.png`});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.getByRole('group',{name:es?'Versiones':'Versions',exact:true}).getByRole('button',{name:es?'Anterior':'Previous',exact:true}).click();
  slow=true;const delayed=page.waitForRequest(r=>r.url().includes('/i1/preview?target_version=1'));
  await page.getByRole('button',{name:label+' · v1',exact:true}).first().click();await delayed;
  await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:label+' · v1',exact:true}).nth(1).click();
  await dialog.getByText('Second client value',{exact:true}).waitFor();await page.waitForTimeout(800);
  assert.equal(await dialog.getByText('Second client value',{exact:true}).count(),1,'late first-client preview must not replace second');
  assert.deepEqual(errors,[]);assert.equal(writes.length,3);
  console.log(`PASS ${lang}/${theme}: preview, retry, protection CAS/uncertainty, target/client switch, focus, 1440/390/320`);
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
