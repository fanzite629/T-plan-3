'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const G=require('../core.js'),C=require('../courses.js'),K=require('../calendar.js');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'calendar-evidence');
fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),scope:'2026-09-07 用户新增授权：测控软件3–8周、节假日提示、数学建模特殊日程',results:[],browsers:[]};
async function check(name,fn){try{const detail=await fn();report.results.push({name,status:'PASS',detail:detail??null});console.log('PASS '+name);}catch(e){report.results.push({name,status:'FAIL',error:e.stack});console.error('FAIL '+name+': '+e.message);}}
const boundary=[['2026-09-10T17:59:00+08:00','upcoming','即将开始'],['2026-09-10T18:00:00+08:00','active','进行中'],['2026-09-13T23:59:00+08:00','active','进行中'],['2026-09-14T00:00:00+08:00','ended',null]];

function seed(){
 const s=G.newState();for(const date of ['2026-09-10','2026-09-13','2026-09-14','2026-10-01']){const id='task-'+date;G.mutate(s,'task:add',{id,title:'合成主任务 '+date,category:'english',date,estimatedMinutes:30,priority:'high'},'2026-09-07T10:00:00+08:00');G.mutate(s,'main:set',{date,taskId:id},'2026-09-07T10:00:00+08:00');}
 G.mutate(s,'log:add',{id:'existing-log',date:'2026-09-07',category:'english',minutes:25,evidence:'已有25分钟投入，不应被日程改变'},'2026-09-07T10:00:00+08:00');return s;
}
async function pureCases(){
 await check('独立：测控软件3–8周边界，其他正式课程数量和旁听机会保持',()=>{
  for(let week=1;week<=20;week++){const a=C.forWeek(week).filter(c=>c.name==='测控软件技术');assert.equal(a.length,week>=3&&week<=8?2:0);if(a.length)assert.deepEqual(a.map(c=>[c.day,c.slot,c.room]),[[1,4,'一教239'],[3,5,'一教239']]);}
  assert.equal(C.forWeek(1).length,11);assert.equal(C.forWeek(2).length,10);assert.equal(Array.from({length:20},(_,i)=>C.optionalForWeek(i+1).filter(c=>!c.conflict).length).reduce((a,b)=>a+b,0),16);
 });
 await check('独立：竞赛四个时间边界，开始包含、结束排除，Asia/Shanghai与UTC等价',()=>{
  for(const [time,status] of boundary)assert.equal(K.eventStatus('modeling-20260910',time),status);
  assert.equal(K.eventStatus('modeling-20260910','2026-09-10T10:00:00Z'),'active');assert.equal(K.eventStatus('modeling-20260910','2026-09-13T16:00:00Z'),'ended');
  assert.equal(Date.parse(K.events[0].end)-Date.parse(K.events[0].start),78*60*60*1000);assert.equal(K.events[0].location,'三教');assert.match(K.events[0].leaveNote,/老师安排请假/);
 });
 await check('独立：首日只18点后提示，9月14日不请假且周一课程完整保留',()=>{
  assert.equal(K.eventsForDate('2026-09-10')[0].fullDay,false);assert.equal(K.eventsForDate('2026-09-10')[0].dayStart,'18:00');assert.match(K.annotation('2026-09-10').note,/白天课程保留/);
  for(const d of ['2026-09-11','2026-09-12','2026-09-13'])assert.equal(K.eventsForDate(d)[0].fullDay,true);
  assert.deepEqual(K.eventsForDate('2026-09-14'),[]);assert.equal(K.annotation('2026-09-14').kind,'');assert.deepEqual(C.forDay(2,1).map(c=>c.id),['micro-mon','thought-mon']);
 });
 await check('独立：全国放假范围/调休上班日期精确，邻日无误报，不宣称学校补课',()=>{
  const days=[];for(let n=0;n<45;n++){const date=G.addDays('2026-09-01',n),h=K.holidayForDate(date);if(h)days.push([date,h.kind]);}
  assert.deepEqual(days,[['2026-09-20','workday'],['2026-09-25','holiday'],['2026-09-26','holiday'],['2026-09-27','holiday'],...Array.from({length:7},(_,i)=>['2026-10-0'+(i+1),'holiday']),['2026-10-10','workday']]);
  for(const d of ['2026-09-20','2026-10-10']){assert.match(K.holidayForDate(d).note,/不代表学校已确认补课/);assert.match(K.holidayForDate(d).note,/不映射其他星期课程/);}
 });
 await check('独立：2027年完整放假调休保持未核实，不推断1月2/3日放假',()=>{
  assert.equal(K.holidayForDate('2027-01-01').kind,'statutory');for(const d of ['2027-01-02','2027-01-03']){assert.equal(K.holidayForDate(d),null);assert.match(K.dateNotes(d).join(''),/未核实/);}
 });
 await check('独立：特殊日历为只读提示，不改变投入/主任务/预算，周文本不泄漏已结束竞赛到下周',()=>{
  const s=seed(),before=JSON.stringify(s),stats=G.weekStats(s,'2026-09-07');for(const [now] of boundary){K.eventStatus('modeling-20260910',now);K.annotation(now.slice(0,10));K.weekText(G.weekStart(now.slice(0,10)));}
  assert.equal(JSON.stringify(s),before);assert.equal(G.weekStats(s,'2026-09-07').totalMinutes,25);assert.deepEqual(G.weekStats(s,'2026-09-07'),stats);assert.doesNotMatch(K.weekText('2026-09-14'),/数学建模/);
 });
}
async function browserCases(name,executablePath){
 const browser=await chromium.launch({executablePath,headless:true});const context=await browser.newContext({offline:true,timezoneId:'Asia/Shanghai',locale:'zh-CN',viewport:{width:1440,height:1000}});const p=await context.newPage();
 const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>requests.push(r.url()));
 await p.clock.install({time:new Date('2026-09-10T17:59:00+08:00')});await p.clock.pauseAt(new Date('2026-09-10T17:59:00+08:00'));const url=pathToFileURL(path.join(root,'index.html')).href;
 await p.goto(url);await p.locator('#app h1').waitFor();report.browsers.push({name,version:browser.version(),executablePath,offline:true,url});
 const raw=JSON.stringify(seed());
 try{
  await check(name+': 初次打开竞赛提示不自动写localStorage或新建任务/投入',async()=>{assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),null);assert.equal(await p.locator('[data-testid="main-task"]').count(),0);assert.match(await p.locator('[data-event-id="modeling-20260910"]').innerText(),/三教/);});
  await p.evaluate(raw=>localStorage.setItem('tgrowth.v1',raw),raw);await p.reload();
  for(const [time,status,label] of boundary){await check(name+': '+time+' 的界面状态与主任务/投入保持',async()=>{
   await p.clock.setSystemTime(new Date(time));await p.reload();await p.locator('#app h1').waitFor();
   if(label)assert.match(await p.locator('[data-event-id="modeling-20260910"]').innerText(),new RegExp(label));else{assert.equal(await p.locator('[data-event-id="modeling-20260910"]').count(),0);assert.equal(await p.locator('.course-row').count(),2);assert.doesNotMatch(await p.locator('.course-row').allInnerTexts().then(x=>x.join('')),/建模请假/);}
   const actual=await p.evaluate(()=>localStorage.getItem('tgrowth.v1'));assert.equal(actual,raw);const date=time.slice(0,10);assert.match(await p.locator('[data-testid="main-task"]').innerText(),new RegExp(date));
   const stats=await p.evaluate(()=>TG.weekStats(JSON.parse(localStorage.getItem('tgrowth.v1')),'2026-09-07'));assert.equal(stats.totalMinutes,25);assert.ok(stats.totalMinutes!==78*60);
   await p.screenshot({path:path.join(out,`${name}-boundary-${date}-${time.slice(11,16).replace(':','')}.png`),fullPage:true});return{status,storageUnchanged:true,totalMinutes:stats.totalMinutes};
  });}
  await check(name+': 持续打开17:59→18:00无需刷新切换状态，表单输入不被中断',async()=>{
   await p.clock.setSystemTime(new Date('2026-09-10T17:59:00+08:00'));await p.reload();assert.match(await p.locator('[data-event-id]').innerText(),/即将开始/);await p.clock.fastForward(60000);assert.match(await p.locator('[data-event-id]').innerText(),/进行中/);
   await p.clock.setSystemTime(new Date('2026-09-10T17:59:00+08:00'));await p.reload();await p.locator('[data-action="task-new"]').click();await p.locator('#f-title').fill('合成未提交表单');await p.clock.fastForward(60000);assert.equal(await p.locator('#f-title').inputValue(),'合成未提交表单');await p.locator('#dialog [data-action="close"]').first().click();await p.clock.fastForward(1000);assert.match(await p.locator('[data-event-id]').innerText(),/进行中/);assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),raw);
  });
  await check(name+': 持续打开9/13 23:59→9/14 00:00恢复周一，未生成78h投入',async()=>{
   await p.clock.setSystemTime(new Date('2026-09-13T23:59:00+08:00'));await p.reload();assert.match(await p.locator('[data-event-id]').innerText(),/进行中/);await p.clock.fastForward(60000);
   assert.equal(await p.locator('[data-event-id]').count(),0);assert.match(await p.locator('.date-strip').innerText(),/2026 \/ 09 \/ 14/);assert.equal(await p.locator('.course-row').count(),2);assert.match(await p.locator('[data-testid="main-task"]').innerText(),/2026-09-14/);assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),raw);
  });
  await check(name+': 节假日/调休日显示提示同时保留当日基础课，不映射其他星期',async()=>{
   for(const date of ['2026-09-20','2026-09-25','2026-10-01','2026-10-10']){
    await p.clock.setSystemTime(new Date(date+'T10:00:00+08:00'));await p.reload();const day=(new Date(date+'T12:00:00+08:00').getUTCDay()||7);const expected=C.forDay(G.teachingWeek(date),day).map(c=>c.name);
    assert.equal(await p.locator('.course-row').count(),expected.length);const text=await p.locator('.course-row').allInnerTexts().then(x=>x.join('\n'));for(const name of expected)assert.ok(text.includes(name));const notices=await p.locator('.course-notice').allInnerTexts();assert.ok(notices.length>0);for(const note of notices)assert.match(note,/待核实/);
    assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),raw);
   }
   await p.screenshot({path:path.join(out,name+'-national-workday.png'),fullPage:true});
  });
  await check(name+': 2027年页面明确待核实，周总结保留课程和特殊安排的正确周范围',async()=>{
   await p.clock.setSystemTime(new Date('2027-01-02T10:00:00+08:00'));await p.reload();assert.match(await p.locator('#app').innerText(),/2027年完整放假调休安排未核实/);assert.match(await p.locator('.course-notice').innerText(),/未核实/);
   await p.clock.setSystemTime(new Date('2026-09-07T10:00:00+08:00'));await p.reload();await p.locator('nav [data-page="review"]').click();await p.locator('[data-action="generate-review"]').click();let text=await p.locator('#review-text').inputValue();assert.match(text,/第2教学周课程/);
   const nextWeekText=text.split('下周正式课程、可选旁听及时间待定提示：')[1].split('本周取得的真实进展：')[0];assert.doesNotMatch(nextWeekText,/数学建模/);assert.doesNotMatch(nextWeekText,/測控软件|测控软件技术/);assert.match(text,/本周节假日与个人特殊安排：[\s\S]*数学建模/);
   await p.locator('#week-number').fill('3');await p.locator('#week-number').dispatchEvent('change');await p.locator('[data-action="generate-review"]').click();text=await p.locator('#review-text').inputValue();assert.match(text,/2026-10-01.*国庆节/);assert.match(text,/学校停课、补课安排待核实/);assert.match(text,/周一 7–8节 测控软件技术/);assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),raw);
  });
  await check(name+': 390px国庆提示合并后主任务标题首屏可见，旁听入口保留学校待核实提示',async()=>{
   await p.clock.setSystemTime(new Date('2026-10-01T10:00:00+08:00'));await p.setViewportSize({width:390,height:844});await p.reload();
   const rect=await p.locator('[data-testid="main-task"] h3').boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=777,JSON.stringify(rect));assert.match(await p.locator('.calendar-panel').innerText(),/国庆/);
   const card=p.locator('.optional').filter({has:p.locator('[data-action="attendance-plan"][data-id="2026-10-01|power-thu"]')});assert.match(await card.innerText(),/2026-10-01/);assert.match(await card.innerText(),/学校.*待核实/);
   await p.screenshot({path:path.join(out,`${name}-390-national-day-main-visible.png`),fullPage:false});
   for(const action of ['attendance-plan','attendance-attend']){await card.locator(`[data-action="${action}"]`).click();assert.match(await p.locator('#dialog').innerText(),/学校.*待核实/);await p.locator('#dialog [data-action="close"]').first().click();}
   assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),raw);return{mainTitleRect:rect,usableViewportBottom:777,storageUnchanged:true};
  });
  await check(name+': 390px新增提示/课表不横向溢出，双浏览器无外部请求/错误',async()=>{
   await p.clock.setSystemTime(new Date('2026-09-10T18:00:00+08:00'));await p.reload();await p.setViewportSize({width:390,height:844});
   for(const view of ['today','week','review']){await p.locator(`nav [data-page="${view}"]`).click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=390));await p.screenshot({path:path.join(out,`${name}-390-${view}-calendar.png`),fullPage:true});}
   assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(x=>!/^(file:|data:|blob:)/.test(x)),[]);assert.equal(await p.evaluate(()=>localStorage.getItem('tgrowth.v1')),raw);return{externalRequests:0,errors:0};
  });
 }finally{await browser.close();}
}
async function main(){await pureCases();for(const args of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']])await browserCases(...args);}
main().catch(e=>{report.results.push({name:'runner',status:'FAIL',error:e.stack});console.error(e);}).finally(()=>{report.finishedAt=new Date().toISOString();report.passed=report.results.filter(x=>x.status==='PASS').length;report.failed=report.results.filter(x=>x.status==='FAIL').length;fs.writeFileSync(path.join(out,'calendar-acceptance-results.json'),JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;});
