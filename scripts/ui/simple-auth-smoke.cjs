const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  const p = await browser.newPage();
  const errors = [], calls = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (/hydration|didn't match|Base UI:/i.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(() => localStorage.setItem('openvoiss.lang', 'es'));
  await p.route('**/api/**', route => {
   const path = new URL(route.request().url()).pathname;
   if (path === '/api/auth/register') {
    calls.push(route.request().postDataJSON());
    return route.fulfill({json:{agency:{is_active:false}}});
   }
   if (path === '/api/auth/login') return route.fulfill({status:401,json:{detail:'Credenciales incorrectas'}});
   return route.fulfill({status:401,json:{detail:'Unauthorized'}});
  });
  await p.goto((process.env.WEB_URL || 'http://localhost:3101') + '/login');
  const card = p.locator('.cy-auth-card');
  await card.waitFor();
  assert.equal(await p.locator('h1').count(), 1);
  assert.equal(await p.locator('.rivr-soft-backdrop').count(), 0);
  await p.locator('#email').fill('test@example.test');
  await p.locator('#password').fill('test-password-123');
  await p.locator('button[type=submit]').click();
  await p.getByText('Credenciales incorrectas', {exact:true}).waitFor();
  await p.getByRole('tab').nth(1).click();
  assert.equal(await p.getByText('Credenciales incorrectas', {exact:true}).count(), 0);
  assert.equal(await p.locator('#password').getAttribute('autocomplete'), 'new-password');
  for (const width of [1440,390,320]) {
   await p.setViewportSize({width,height:900});
   assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   const box = await card.boundingBox();
   assert(Math.abs(box.x + box.width / 2 - width / 2) < 2);
  }
  await p.locator('#agency_name').fill('Test agency');
  await p.locator('#name').fill('Test person');
  await p.locator('#email').fill('test@example.test');
  await p.locator('#password').fill('test-password-123');
  await p.screenshot({path:'/tmp/voysse-simple-register.png',fullPage:true});
  await p.locator('button[type=submit]').click();
  await p.locator('a[href^="mailto:"]').waitFor();
  assert.equal(calls.length,1);
  assert.equal(calls[0].agency_name,'Test agency');
  assert.deepEqual(errors,[]);
  console.log('PASS simple auth: centered register 1440/390/320, login error, mode switch, autocomplete, pending approval, no real submission.');
 } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
