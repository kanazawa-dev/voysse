const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await chromium.launch();
 try {
  for (const lang of ['es','en']) for (const theme of ['light','dark']) {
   const errors=[], context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.addInitScript(({lang,theme})=>{localStorage.setItem('openvoiss.lang',lang);localStorage.setItem('voysse.theme',theme);},{lang,theme});
   let cost=.002;
   await context.route('**/api/**', route => {
    const path=new URL(route.request().url()).pathname;
    assert.equal(route.request().method(),'GET','report never calls providers or writes');
    const usage={messages:1,tokens_in:1000,tokens_out:1000,estimated_cost_usd:cost,usage_by_model:[{provider:'openai',model:'gpt-4.1-mini',input_tokens:1000,output_tokens:1000,estimated_cost_usd:cost}]};
    const json=path.endsWith('/auth/me')?{id:'user',name:'Test',role:'admin',agency:{id:'agency',name:'Agency'}}:
     path==='/api/onboarding'?{step:7,status:'completed',revision:1}:
     path==='/api/dashboard'?{clients:1,agents:0,conversations:0,channels:0,recent_agents:[]}:
     path==='/api/dashboard/metrics'?{...usage,human_conversations:0,by_channel:{},daily_conversations:[],top_agents:[],usage_by_client:[{client_id:'hotel',name:'Hotel Demo',input_tokens:1000,output_tokens:1000,estimated_cost_usd:cost}]}:
     path==='/api/clients/hotel'?{id:'hotel',name:'Hotel Demo',agents:[],is_active:true}:
     path.endsWith('/usage')?usage:[];
    return route.fulfill({json});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto((process.env.WEB_URL||'http://127.0.0.1:3139')+'/');
   await page.getByText(lang==='es'?'Uso por cliente':'Usage by client',{exact:true}).waitFor();
   await page.getByText(lang==='es'?'0,002 USD':'0.002 USD',{exact:false}).first().waitFor();
   for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.getByRole('link',{name:'Hotel Demo',exact:true}).click();
   await page.getByRole('tab',{name:lang==='es'?'Uso':'Usage',exact:true}).click();
   await page.getByText(lang==='es'?'0,002 USD':'0.002 USD',{exact:false}).first().waitFor();
   await page.screenshot({path:`/tmp/usage-cost-${lang}-${theme}.png`,fullPage:true});
   cost=.000002;await page.reload();await page.getByRole('tab',{name:lang==='es'?'Uso':'Usage',exact:true}).click();
   await page.getByText('< 0.0001 USD',{exact:true}).first().waitFor();
   cost=null;await page.reload();await page.getByRole('tab',{name:lang==='es'?'Uso':'Usage',exact:true}).click();
   await page.getByText(lang==='es'?'Hay modelos sin tarifa.':'Some models have no rate.',{exact:false}).waitFor();
   assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/usage-${lang}-${theme}.png`});await context.close();
  }
  console.log('PASS usage costs ES/EN light/dark, desktop/mobile, client navigation, unknown rates, read-only');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
