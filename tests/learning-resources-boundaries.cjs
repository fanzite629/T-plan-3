const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.connectOverCDP(process.env.TPLAN_TEST_CDP||'http://127.0.0.1:58432'),p=b.contexts()[0].pages().find(p=>p.url().includes('tplan.local'));
 const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('tgrowth.v1')));
 const click=a=>p.locator(`[data-timer="${a}"]`).click();
 await p.locator('nav [data-page="timer"]').click();
 if((await state()).timerBoard.active){await click('finish');await click('decide');}
 const before=await state();const logId=await p.locator('[data-timer="log"]').first().getAttribute('data-id');await p.locator('[data-timer="log"]').first().click();
 await p.locator('#dialog input[name="minutes"]').fill('7');await p.locator('#dialog button[type="submit"]').click();
 const after=await state();assert.equal(after.logs.length,before.logs.length+1);assert.ok(after.timerBoard.records.find(r=>r.id===logId).logId);assert.equal(after.logs.find(l=>l.id===after.timerBoard.records.find(r=>r.id===logId).logId).minutes,7);assert.deepEqual(after.tasks,before.tasks);
 console.log('PASS actual effort appears only after explicit confirmation and can differ from timer; tasks stay unchanged');
 const now=new Date('2026-10-22T17:00:00+08:00');await p.clock.setFixedTime(now);
 await p.locator('#tt-title').fill('合成验收：工具卡打开时到底线');await p.locator('#tt-minutes').fill('45');await p.locator('#tt-cutoff').fill('2026-10-22T17:02');await click('start');
 await p.locator('.tt-resource-entry [data-resource="open"]').click();await p.locator('[data-card="gpt"]').click();
 const original=(await state()).timerBoard.active;await p.clock.setFixedTime(new Date('2026-10-22T17:03:00+08:00'));
 await p.locator('#tt-review').waitFor();const ended=(await state()).timerBoard.active;
 assert.equal(ended.reason,'cutoff');assert.equal(ended.cutoff,original.cutoff);assert.equal(ended.elapsedMs,120000);assert.equal(ended.budgetMs,2700000);assert.equal(await p.locator('#tt-clock').textContent(),'00:00');assert.equal(await p.locator('#lr-tool-title').textContent(),'GPT');
 assert.equal(await p.locator('#tt-decision option[value="extend"]').isDisabled(),true);
 await p.locator('#tt-blocker').fill('条件尚未核对');await p.locator('#tt-next').fill('下一轮查教材');await p.locator('#tt-decision').selectOption('defer');await click('decide');
 const final=await state();assert.deepEqual(final.logs,after.logs);assert.deepEqual(final.tasks,after.tasks);assert.equal(final.timerBoard.active,null);assert.equal(final.timerBoard.records[0].decision,'defer');
 console.log('PASS open card survives expiry, fixed deadline stops at exactly 2 minutes despite 45-minute budget; defer keeps existing workflow and no implicit effort');
 fs.writeFileSync(path.resolve(__dirname,'../output/playwright/learning-resources/boundary-results.json'),JSON.stringify({status:'PASS',checks:2},null,2));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
