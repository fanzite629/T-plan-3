'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),G=require('../core'),T=require('../task-timer');
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(__dirname,'../output/playwright/workbench');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.connectOverCDP(process.env.TPLAN_TEST_CDP||'http://127.0.0.1:58432'),p=b.contexts()[0].pages().find(p=>p.url().includes('tplan.local'));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-10-22T12:00:00+08:00'));await p.setViewportSize({width:1440,height:1000});
 const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('tgrowth.v1')));
 const nav=key=>p.locator(`nav [data-page="${key}"]`).click();
 const s=G.newState(),d='2026-10-22',now='2026-10-22T04:00:00.000Z';
 for(const [id,title,min] of [['test-network','完成两道子网划分练习，解释每一步的依据',45],['test-review','复习微机接口技术：整理一条关键推导',25],['test-english','阅读一篇英语文章，整理三个表达',30]])G.mutate(s,'task:add',{id,title,category:'school',date:d,estimatedMinutes:min},now);
 G.mutate(s,'task:complete',{id:'test-english'},now);G.mutate(s,'main:set',{date:d,taskId:'test-network'},now);G.mutate(s,'log:add',{id:'test-log',date:d,category:'school',taskId:'test-english',minutes:30,evidence:'已独立整理表达，明天回测'},now);
 s.timerBoard=T.empty();
 await p.locator('#import-file').setInputFiles({name:'workbench-isolated.json',mimeType:'application/json',buffer:Buffer.from(G.exportData(s))});await p.locator('[data-action="confirm-import"]').click();await nav('today');
 assert.equal(await p.locator('.wb-metric').count(),4);assert.match(await p.locator('.wb-metric').nth(0).innerText(),/1\s*\/ 3 项/);assert.match(await p.locator('.wb-metric').nth(1).innerText(),/30\s*分钟/);assert.match(await p.locator('.wb-metric').nth(2).innerText(),/0\s*轮/);
 await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(4500);await p.screenshot({path:path.join(out,'workbench-desktop.png')});
 const original=await state();
 for(const key of ['week','schedule','timer','focus','dashboard','records','today']){await nav(key);assert.equal(await p.locator('nav .active').count(),1);assert.equal(await p.locator('nav .active').getAttribute('data-page'),key);assert.deepEqual(await state(),original);}
 await p.locator('.today-courses [data-action="go-schedule"]').click();assert.equal(await p.locator('#app h1').textContent(),'我的课表');assert.equal(await p.locator('.timetable').count(),1);
 const course=await p.locator('.timetable [data-action="course"]').first().getAttribute('data-id');
 await p.locator('.timetable [data-action="course"]').first().click();await p.locator('#dialog[open] .course-tabs').waitFor();await p.locator('#dialog [data-action="close"]').click();
 assert.ok(course);await p.locator('[data-action="next-week"]').click();assert.equal(await p.locator('#week-number').inputValue(),'8');await p.locator('[data-action="prev-week"]').click();assert.equal(await p.locator('#week-number').inputValue(),'7');
 await p.locator('#week-number').fill('3');await p.locator('#week-number').press('Tab');assert.equal(await p.locator('#week-number').inputValue(),'3');await p.locator('[data-action="current-week"]').click();assert.equal(await p.locator('#week-number').inputValue(),'7');
 await p.screenshot({path:path.join(out,'schedule-desktop.png')});await nav('week');assert.equal(await p.locator('.timetable').count(),0);assert.equal(await p.locator('#all-tasks').count(),1);assert.deepEqual(await state(),original);
 console.log('PASS home metrics from data, seven nav entries with unique active state, independent timetable weeks/detail, weekly tasks retained, navigation never mutates business data');
 await nav('today');await p.locator('.wb-topbar [data-action="task-new"]').click();await p.locator('#dialog input[name="title"]').fill('从顶部新建的合成任务');await p.locator('#dialog button[type="submit"]').click();assert.equal((await state()).tasks.length,4);
 await nav('timer');await p.locator('#tt-title').fill('合成：工作台跨页面计时');await p.locator('[data-timer="preset"][data-id="45"]').click();await p.locator('[data-timer="budget-cutoff"]').click();await p.locator('[data-timer="start"]').click();
 const active=(await state()).timerBoard.active;await nav('schedule');assert.equal(await p.locator('#tt-global').isVisible(),true);assert.match(await p.locator('#tt-global').textContent(),/45:00/);assert.equal(await p.locator('#wb-idle-timer').isVisible(),false);await p.locator('#tt-global').click();assert.equal(await p.locator('#app h1').textContent(),'任务计时看板');assert.deepEqual((await state()).timerBoard.active,active);
 await p.locator('[data-timer="pause"]').click();await nav('today');assert.match(await p.locator('#tt-global').textContent(),/已暂停/);await p.locator('#tt-global').click();await p.locator('[data-timer="resume"]').click();await p.locator('[data-timer="finish"]').click();await p.locator('[data-timer="decide"]').click();
 console.log('PASS top create task and live timer navigation/pause/resume/finish; timer anchors unchanged by page navigation');
 for(const width of [1440,1024,768,390]){
  await p.setViewportSize({width,height:950});if(width<=850)await p.locator('#wb-menu-toggle').click();await nav('today');
  assert.equal(await p.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true,'home overflow '+width);
  if(width===390){await p.locator('#wb-menu-toggle').click();assert.equal(await p.locator('#wb-menu-toggle').getAttribute('aria-expanded'),'true');await p.keyboard.press('Escape');assert.equal(await p.locator('#wb-menu-toggle').getAttribute('aria-expanded'),'false');await p.locator('#wb-menu-toggle').click();await nav('schedule');assert.equal(await p.locator('#wb-menu-toggle').getAttribute('aria-expanded'),'false');assert.equal(await p.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true,'schedule must scroll inside table');await p.locator('#wb-menu-toggle').click();await nav('today');}
  await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(300);await p.screenshot({path:path.join(out,`workbench-${width}.png`)});
 }
 assert.deepEqual(errors,[]);console.log('PASS 1440/1024/768/390 layouts, mobile navigation and Escape, timetable scroll contained; no page errors');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',checks:3,widths:[1440,1024,768,390],errors,profile:'isolated'},null,2));
 await p.setViewportSize({width:1440,height:1000});await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
