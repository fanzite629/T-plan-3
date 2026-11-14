'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(__dirname,'../output/playwright/task-timer');fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 const native=!!process.env.TIMER_CDP;
 const browser=native?await chromium.connectOverCDP(process.env.TIMER_CDP):await chromium.launch({headless:true});
 const context=native?browser.contexts()[0]:await browser.newContext({viewport:{width:1440,height:1050}});
 const page=native?context.pages().find(p=>p.url().includes('tplan.local')):await context.newPage();
 const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1|https:\/\/tplan.local|data:|blob:)/.test(r.url()))network.push(r.url());});
 if(!native)await page.goto(process.env.TIMER_URL);else await page.reload();
 await page.locator('#app h1').waitFor();
 const nav=id=>page.locator('nav [data-page="'+id+'"]').click();
 const click=id=>page.locator('[data-timer="'+id+'"]').first().click();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tgrowth.v1')));
 const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 await check('existing task links into timer without changing its status or creating effort',async()=>{
  await nav('today');await page.locator('[data-action="task-new"]').first().click();await page.locator('#f-title').fill('合成验收：弄懂放大电路的静态工作点');await page.locator('#dialog button[type="submit"]').click();
  await nav('timer');await click('pick');assert.match(await page.locator('#tt-title').inputValue(),/静态工作点/);assert.equal((await state()).logs.length,0);
 });
 await check('responsive layout at desktop, compact tablet and phone widths',async()=>{
  if(!native){for(const width of [1440,980,390]){await page.setViewportSize({width,height:1050});await page.screenshot({path:path.join(out,`timer-ready-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width);assert.ok(await page.locator('nav [data-page="timer"]').isVisible());}await page.setViewportSize({width:1440,height:1050});}
  else await page.screenshot({path:path.join(out,'native-ready.png'),fullPage:true});
 });
 await check('start, switch pages, global countdown, pause and reload restore',async()=>{
  await page.locator('#tt-minutes').fill('1');const cutoff=new Date(Date.now()+3600000);const value=new Date(cutoff.getTime()-cutoff.getTimezoneOffset()*60000).toISOString().slice(0,16);await page.locator('#tt-cutoff').fill(value);await click('start');assert.equal((await state()).timerBoard.active.phase,'running');
  await nav('week');await pause(1200);assert.match(await page.locator('#tt-global').textContent(),/专注中/);await page.locator('#tt-global').click();await click('pause');assert.equal((await state()).timerBoard.active.phase,'paused');const saved=(await state()).timerBoard.active;await page.reload();await nav('timer');assert.equal((await state()).timerBoard.active.phase,'paused');assert.equal((await state()).timerBoard.active.elapsedMs,saved.elapsedMs);await click('resume');
 });
 await check('budget expiry, blocker validation, finite extension and real effort confirmation',async()=>{
  // Advancing the browser clock exercises actual timer polling, not a direct transition call.
  await page.clock.install();await page.clock.runFor(61000);await page.locator('#tt-review').waitFor();assert.equal((await state()).timerBoard.active.phase,'review');assert.equal((await state()).logs.length,0);
  await page.locator('#tt-decision').selectOption('extend');await click('decide');assert.match(await page.locator('#tt-error').textContent(),/卡在/);await page.locator('#tt-blocker').fill('不会列出直流回路方程');await page.locator('#tt-next').fill('先画出直流通路');await page.locator('#tt-extra-minutes').fill('1');await click('decide');assert.equal((await state()).timerBoard.active.extensionCount,1);
  await page.clock.runFor(1000);await click('finish');await page.locator('#tt-blocker').fill('已经画出直流通路');await click('decide');assert.equal((await state()).timerBoard.records.length,2);assert.equal((await state()).logs.length,0);
  await click('log');await page.locator('#f-minutes').fill('1');await page.locator('#dialog button[type="submit"]').click();assert.equal((await state()).logs.length,1);assert.equal((await state()).tasks[0].status,'todo');assert.ok((await state()).timerBoard.records[0].logId);
 });
 await check('backup roundtrip retains timer, logs and task; existing five pages remain usable',async()=>{
  assert.ok(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('tgrowth.v1'));return JSON.stringify(TG.parseImport(TG.exportData(s)).state)===JSON.stringify(s);}));
  for(const id of ['today','week','dashboard','records','review','timer']){await nav(id);assert.ok((await page.locator('#app h1').textContent()).length);}
  await page.screenshot({path:path.join(out,native?'native-history.png':'timer-history.png'),fullPage:true});
 });
 await check('no page errors, CSP violations or external requests',()=>{assert.deepEqual(errors,[]);assert.deepEqual(network,[]);});
 fs.writeFileSync(path.join(out,native?'native-results.json':'browser-results.json'),JSON.stringify({checks,errors,network},null,2));
 if(native){fs.writeFileSync(path.join(out,'native-state-before-restart.json'),JSON.stringify(await state()));await page.clock.resume();}
 await browser.close();
}
run().catch(e=>{console.error(e);process.exitCode=1;});
