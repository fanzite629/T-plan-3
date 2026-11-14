const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(__dirname,'../output/playwright/task-timer');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:58421'),p=b.contexts()[0].pages().find(p=>p.url().includes('tplan.local'));await p.locator('#app h1').waitFor();
 const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('tgrowth.v1')));
 const mode=process.argv[2];
 if(mode==='prepare'){
  assert.deepEqual(await state(),JSON.parse(fs.readFileSync(path.join(out,'native-state-before-restart.json'),'utf8')));console.log('PASS actual new native process restored history, effort and task unchanged');
  await p.locator('nav [data-page="timer"]').click();await p.locator('#tt-title').fill('合成验收：暂停重启与底线');await p.locator('#tt-minutes').fill('25');const cutoff=new Date(Date.now()+120000);await p.locator('#tt-cutoff').fill(new Date(cutoff-cutoff.getTimezoneOffset()*60000).toISOString().slice(0,16));await p.locator('[data-timer="start"]').click();await p.locator('[data-timer="pause"]').click();fs.writeFileSync(path.join(out,'native-paused-before-restart.json'),JSON.stringify(await state()));
 }else{
  assert.deepEqual(await state(),JSON.parse(fs.readFileSync(path.join(out,'native-paused-before-restart.json'),'utf8')));await p.locator('nav [data-page="timer"]').click();assert.equal((await state()).timerBoard.active.phase,'paused');console.log('PASS paused active timer restored after native process restart');
  await p.clock.install();await p.clock.runFor(180000);await p.locator('#tt-review').waitFor();assert.equal((await state()).timerBoard.active.reason,'cutoff');assert.equal(await p.locator('#tt-decision option[value="extend"]').isDisabled(),true);console.log('PASS hard cutoff fires while paused and blocks extension');
  await p.locator('#tt-blocker').fill('需要补充基础概念');await p.locator('#tt-next').fill('先回顾直流通路');await p.locator('#tt-decision').selectOption('split');await p.locator('[data-timer="decide"]').click();assert.equal(await p.locator('#tt-title').inputValue(),'先回顾直流通路');await p.locator('[data-timer="start"]').click();assert.match(await p.locator('#tt-error').textContent(),/重新设置/);console.log('PASS split prefills next task and requires a newly chosen cutoff');
  const saved=await state(),raw=await p.evaluate(()=>TG.exportData(JSON.parse(localStorage.getItem('tgrowth.v1'))));await p.locator('#import-file').setInputFiles({name:'timer-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(raw)});await p.locator('[data-action="confirm-import"]').click();assert.deepEqual(await state(),saved);console.log('PASS actual import preview and confirm preserves timer records');
  fs.writeFileSync(path.join(out,'native-restart-results.json'),JSON.stringify({pausedRestart:'PASS',hardCutoff:'PASS',split:'PASS',import:'PASS'},null,2));await p.clock.resume();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
