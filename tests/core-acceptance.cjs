'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TG = require('../core.js');
const C = require('../courses.js');
const results = [];
const MONDAY = '2026-09-07';
const MONDAY_TIME = '2026-09-07T10:00:00+08:00';
function test(name, fn) { try { fn(); results.push({name,status:'PASS'}); console.log('PASS '+name); } catch(e) {results.push({name,status:'FAIL',error:e.stack}); console.error('FAIL '+name+': '+e.message);} }
function mutate(state, action, payload, now=MONDAY_TIME) { TG.mutate(state, action, payload, now); }
function add(state,id,date=MONDAY,extra={}) { mutate(state,'task:add',{id,title:id,category:'english',date,priority:'high',estimatedMinutes:90,...extra}); }
function record(state,id,date,minutes,taskId=null,category='english') { mutate(state,'log:add',{id,date,minutes,taskId,category,evidence:'合成学习成果'}); }
function plan(state,monday,overrides={}) { const p={...TG.getWeek(state,monday),...overrides};mutate(state,'week',{monday,...p}); }

test('第1项：显式选定一个主任务，最多两次重点，完成后保留且不自动提升',()=>{
 const s=TG.newState(); for(let i=1;i<=5;i++)add(s,'t'+i);
 assert.equal(TG.focusTasks(s).main,null);
 mutate(s,'main:set',{date:MONDAY,taskId:'t3'});
 let f=TG.focusTasks(s,MONDAY);assert.equal(f.main.id,'t3');assert.equal(f.secondary.length,2);
 mutate(s,'task:complete',{id:'t3'});mutate(s,'task:complete',{id:'t3'});
 f=TG.focusTasks(s,MONDAY);assert.equal(f.main.id,'t3');assert.equal(f.main.status,'done');assert.equal(f.secondary.length,2);
 assert.equal(s.tasks[2].statusHistory.length,2);assert.equal(s.logs.length,0);assert.equal(TG.taskMinutes(s,'t3'),0);
});
test('第1/4项：延期未完成主任务后，今日不继续突出已改到明天的安排',()=>{
 const s=TG.newState();add(s,'main');mutate(s,'main:set',{date:MONDAY,taskId:'main'});
 mutate(s,'task:postpone',{id:'main'});assert.equal(s.tasks[0].date,'2026-09-08');
 assert.equal(TG.focusTasks(s,MONDAY).main,null);
});
test('第2项：跨周40/20分钟依发生日期；未完成任务计时；编辑和重复完成不增量',()=>{
 const s=TG.newState();add(s,'cross','2026-09-13');record(s,'sun','2026-09-13',40,'cross');record(s,'mon','2026-09-14',20,'cross');
 assert.equal(TG.weekStats(s,MONDAY).actual.english,40);assert.equal(TG.weekStats(s,'2026-09-14').actual.english,20);assert.equal(TG.taskMinutes(s,'cross'),60);
 mutate(s,'task:complete',{id:'cross'},'2026-09-14T20:00:00+08:00');mutate(s,'task:complete',{id:'cross'},'2026-09-14T20:10:00+08:00');
 assert.equal(TG.taskMinutes(s,'cross'),60);mutate(s,'log:edit',{id:'sun',minutes:30});assert.equal(TG.taskMinutes(s,'cross'),50);assert.equal(TG.weekStats(s,MONDAY).actual.english,30);
 const restored=TG.parseImport(TG.exportData(s)).state;assert.deepEqual(restored,s);assert.equal(TG.taskMinutes(restored,'cross'),50);
});
test('第2项：删除任务保留投入与连同删除分别正确处理',()=>{
 const s=TG.newState();add(s,'keep');add(s,'remove');record(s,'k',MONDAY,40,'keep');record(s,'r',MONDAY,20,'remove');
 mutate(s,'task:delete',{id:'keep',deleteLogs:false});assert.equal(s.logs.find(l=>l.id==='k').taskId,null);assert.equal(TG.weekStats(s,MONDAY).actual.english,60);
 mutate(s,'task:delete',{id:'remove',deleteLogs:true});assert.equal(s.logs.length,1);assert.equal(TG.weekStats(s,MONDAY).actual.english,40);TG.validateState(s);
});
test('第2项：旁听重复参加只保存一条投入，修改分钟和删除同步处理',()=>{
 const s=TG.newState();mutate(s,'attendance:plan',{date:'2026-09-08',courseId:'power-tue',plannedMinutes:90});
 mutate(s,'attendance:attend',{date:'2026-09-08',courseId:'power-tue',minutes:80,evidence:'旁听成果'});
 mutate(s,'attendance:attend',{date:'2026-09-08',courseId:'power-tue',minutes:80});assert.equal(s.logs.length,1);assert.equal(TG.weekStats(s,MONDAY).actual.power,80);
 mutate(s,'attendance:attend',{date:'2026-09-08',courseId:'power-tue',minutes:95});assert.equal(TG.weekStats(s,MONDAY).actual.power,95);
 mutate(s,'log:delete',{id:s.logs[0].id});assert.equal(TG.weekStats(s,MONDAY).attendanceCount,0);assert.equal(TG.weekStats(s,MONDAY).actual.power,0);TG.validateState(s);
});
test('第3项：电力目标包含旁听，目标内预留不重复计预算，超出部分才另计',()=>{
 const s=TG.newState();const before=TG.weekStats(s,MONDAY).allocatedMinutes;
 mutate(s,'attendance:plan',{date:'2026-09-08',courseId:'power-tue',plannedMinutes:120});
 let stat=TG.weekStats(s,MONDAY);assert.equal(stat.goals.power,300);assert.equal(stat.allocatedMinutes,before);assert.equal(stat.attendanceOverGoalMinutes,0);
 mutate(s,'attendance:plan',{date:'2026-09-10',courseId:'power-thu',plannedMinutes:240});
 stat=TG.weekStats(s,MONDAY);assert.equal(stat.plannedAttendanceMinutes,360);assert.equal(stat.allocatedMinutes,before+60);assert.equal(stat.attendanceOverGoalMinutes,60);
});
test('第3项：健身次数与小时分离；同日重复不增次数；超额和零目标无异常值',()=>{
 const s=TG.newState();const goals=Object.fromEntries(TG.CATEGORIES.map(c=>[c.id,0]));goals.fitness=4;goals.english=60;plan(s,MONDAY,{budgetMinutes:60,fitnessMinutes:120,goals});
 mutate(s,'health:set',{date:MONDAY,weight:158,trained:true});mutate(s,'health:set',{date:MONDAY,weight:157,trained:true});record(s,'gym',MONDAY,50,null,'fitness');
 record(s,'stocks',MONDAY,10,null,'stocks');const stats=TG.weekStats(s,MONDAY);assert.equal(stats.allocatedMinutes,180);assert.equal(stats.remainingMinutes,-120);assert.equal(stats.actual.fitness,1);assert.equal(stats.minutes.fitness,50);
 assert.equal(stats.progress.stocks.percent,null);assert.equal(stats.progress.stocks.label,'计划外投入');assert.equal(stats.progress.math.label,'未设目标/已暂停');assert.doesNotMatch(JSON.stringify(stats),/NaN|Infinity/);
});
test('第4项：跨周延期保留原周任务；系统明天独立于任务原日期；历史状态与快照固定',()=>{
 const s=TG.newState();add(s,'defer','2026-09-13');
 mutate(s,'task:postpone',{id:'defer'},'2026-09-13T20:00:00+08:00');assert.equal(s.tasks[0].date,'2026-09-14');assert.equal(s.tasks[0].history[0].from,'2026-09-13');
 let stat=TG.weekStats(s,MONDAY,'2026-09-13T22:00:00+08:00');assert.equal(stat.taskCount,1);assert.equal(stat.completedCount,0);assert.equal(stat.postponedTasks.length,1);
 const text=TG.summaryText(s,MONDAY,{cutoffISO:'2026-09-13T22:00:00+08:00',nextCoursesText:C.weekText(2)});
 mutate(s,'review:save',{monday:MONDAY,text},'2026-09-13T22:00:00+08:00');const snapshot=JSON.stringify(s.reviews[MONDAY]);
 const previousPlan=TG.getWeek(s,MONDAY);mutate(s,'week:applyNext',{monday:MONDAY,...previousPlan,budgetMinutes:300});
 mutate(s,'task:complete',{id:'defer'},'2026-09-14T20:00:00+08:00');assert.equal(JSON.stringify(s.reviews[MONDAY]),snapshot);assert.deepEqual(TG.getWeek(s,MONDAY),previousPlan);assert.equal(TG.getWeek(s,'2026-09-14').budgetMinutes,300);
 stat=TG.weekStats(s,MONDAY,'2026-09-13T22:00:00+08:00');assert.equal(stat.completedCount,0);assert.equal(TG.weekStats(s,MONDAY).completedCount,1);
 add(s,'old','2026-08-01');mutate(s,'task:postpone',{id:'old'},'2026-09-14T22:00:00+08:00');assert.equal(s.tasks.find(t=>t.id==='old').date,'2026-09-15');
});
test('第5项：旁听16次与边界、实验待定和微机星期修正',()=>{
 const expected=[[2,4],[2,4],[4],[4],[4],[4],[2,4],[2,4],[2],[2],[2],[2],[],[]];let total=0;
 expected.forEach((days,i)=>{const actual=C.optionalForWeek(i+1).filter(c=>!c.conflict).map(c=>c.day);assert.deepEqual(actual,days);total+=actual.length;});assert.equal(total,16);
 for(let w=1;w<=11;w++){assert.equal(C.forDay(w,3).some(c=>c.slot===1),false);assert.ok(C.forDay(w,4).some(c=>c.slot===1&&c.room==='二东202'));}
 [11,12].forEach(w=>{const tue=C.optionalForWeek(w).find(c=>c.day===2);assert.equal(tue.conflict,false);assert.match(tue.warning,/待确认/);assert.match(C.weekText(w),/电子电路CAD实验/);});
 assert.equal(C.forWeek(21).length,0);assert.match(C.weekText(21),/结束/);
});
test('第6项：体重稀疏记录、自然日窗口、同日更新、当前体重日期与无样本',()=>{
 const s=TG.newState();let h=TG.healthStats(s,'2026-09-14');assert.equal(h.current,null);assert.equal(h.recent.average,null);assert.equal(h.change,null);
 for(const [date,weight] of [['2026-09-01',170],['2026-09-07',160],['2026-09-08',158],['2026-09-14',156]])mutate(s,'health:set',{date,weight,trained:false});
 h=TG.healthStats(s,'2026-09-14');assert.deepEqual(h.current,{date:'2026-09-14',weight:156});assert.deepEqual(h.recent,{startDate:'2026-09-08',endDate:'2026-09-14',average:157,count:2});assert.equal(h.previous.average,165);assert.equal(h.previous.count,2);assert.equal(h.change,-8);
 mutate(s,'health:set',{date:'2026-09-14',weight:154,trained:true});assert.equal(s.health.length,4);assert.equal(TG.healthStats(s,'2026-09-14').recent.average,156);
 const week=TG.weekStats(s,'2026-09-14');assert.equal(week.weight.average,154);assert.equal(week.weight.count,1);assert.equal(TG.healthStats(s,'2026-09-01').current.weight,170);
});
test('第7项：全部数据完整往返；损坏字段/引用/重复/污染键均拒绝且输入不变',()=>{
 const s=TG.newState();add(s,'task');record(s,'log',MONDAY,20,'task');mutate(s,'health:set',{date:MONDAY,weight:157.5,trained:true});plan(s,MONDAY);mutate(s,'main:set',{date:MONDAY,taskId:'task'});
 mutate(s,'review:save',{monday:MONDAY,text:'合成快照'});const text=TG.exportData(s,MONDAY_TIME), before=JSON.stringify(s);assert.deepEqual(TG.parseImport(text).state,s);
 for(const alter of [ e=>e.schemaVersion=999,e=>e.data.logs[0].minutes=-1,e=>e.data.logs[0].date='2026-02-30',e=>e.data.logs[0].taskId='missing',e=>e.data.tasks.push(e.data.tasks[0]),e=>e.data.health.push(e.data.health[0]),e=>e.data.settings.extra='bad',e=>e.data.mainByDate[MONDAY]='missing']){
  const e=JSON.parse(text);alter(e);assert.throws(()=>TG.parseImport(JSON.stringify(e)));assert.equal(JSON.stringify(s),before);
 }
 assert.throws(()=>TG.parseImport('{broken'));assert.throws(()=>TG.parseImport(text.replace('"schemaVersion": 1','"__proto__":{},"schemaVersion": 1')));assert.equal({}.polluted,undefined);
});

const out=process.env.TG_ACCEPTANCE_OUTPUT?path.resolve(process.env.TG_ACCEPTANCE_OUTPUT):path.join(__dirname,'evidence');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'core-acceptance-results.json'),JSON.stringify({runAt:new Date().toISOString(),results},null,2));
console.log(`RESULT ${results.filter(r=>r.status==='PASS').length} PASS / ${results.filter(r=>r.status==='FAIL').length} FAIL`);
process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
