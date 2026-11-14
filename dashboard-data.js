/* Task-based weekly statistics. Legacy categories remain valid only for saved data. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
 else root.TGDashboard=factory(root.TG);
})(typeof globalThis!=='undefined'?globalThis:this,function(G){
 'use strict';
 function build(state,monday,asOfDate=G.today()){
  G.validateState(state);if(G.weekStart(monday)!==monday)throw new Error('看板起始日期必须为周一');G.addDays(asOfDate,0);
  const endDate=G.addDays(monday,6),cutoff=endDate<asOfDate?endDate:asOfDate;
  const tasks=state.tasks.filter(t=>t.date>=monday&&t.date<=endDate).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
  const logs=state.logs.filter(l=>l.date>=monday&&l.date<=cutoff);
  const totals=new Map();for(const l of logs)totals.set(l.taskId,(totals.get(l.taskId)||0)+l.minutes);
  const maps=typeof module==='object'&&module.exports?require('./task-map.js'):globalThis.TGTaskMap,summaryIds=maps.summaryTasks(state);
  const comparison=tasks.map(t=>({id:t.id,label:t.title+(summaryIds.has(t.id)?'（汇总；仅列直属投入）':''),date:t.date,status:t.status,targetMinutes:summaryIds.has(t.id)?0:t.estimatedMinutes,actualMinutes:totals.get(t.id)||0}));
  const taskById=new Map(tasks.map(t=>[t.id,t])),ids=new Set(taskById.keys());
  const unassignedMinutes=logs.filter(l=>!ids.has(l.taskId)).reduce((n,l)=>n+l.minutes,0);
  const targetTotalMinutes=comparison.reduce((n,t)=>n+t.targetMinutes,0),totalMinutes=logs.reduce((n,l)=>n+l.minutes,0);
  // The ledger is the sole source of minutes. Timer records supply the title
  // captured for that round, including old records and deleted/moved tasks.
  const timersByLog=new Map();for(const r of state.timerBoard?.records||[])if(r.logId&&r.title.trim()&&!timersByLog.has(r.logId))timersByLog.set(r.logId,r);
  const groups=new Map(),logGroups=new Map();
  for(const l of logs){
   const timer=timersByLog.get(l.id),task=taskById.get(l.taskId);
   const label=timer?timer.title.trim():task?task.title:'手动记录的投入';
   const id=timer?'timer-title:'+label:task?'task:'+task.id:'manual-unassigned';
   if(!groups.has(id))groups.set(id,{id,label,targetMinutes:0,actualMinutes:0});
   groups.get(id).actualMinutes+=l.minutes;logGroups.set(l.id,id);
  }
  const series=[...groups.values()];
  const days=Array.from({length:7},(_,i)=>({date:G.addDays(monday,i),dayLabel:['周一','周二','周三','周四','周五','周六','周日'][i],minutes:Object.create(null),totalMinutes:0}));
  const dayMap=new Map(days.map(d=>[d.date,d]));for(const l of logs){const d=dayMap.get(l.date),id=logGroups.get(l.id);d.minutes[id]=(d.minutes[id]||0)+l.minutes;d.totalMinutes+=l.minutes;}
  const rows=series.map(t=>({...t,targetPercent:null,actualPercent:totalMinutes?t.actualMinutes/totalMinutes*100:null}));
  return {monday,endDate,asOfDate,hasLogs:logs.length>0,totalMinutes,unassignedMinutes,comparison,series,days,taskCount:tasks.length,completedCount:tasks.filter(t=>t.status==='done').length,targetTotalMinutes,
   allocation:{targetTotalMinutes,actualTotalMinutes:totalMinutes,rows,deviates:false}};
 }
 return {build};
});
