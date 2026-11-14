/* Offline task timer. Wall-clock anchors survive navigation, suspension and restart. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TGTimer=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const text=(v,max=4000)=>typeof v==='string'&&v.length<=max;
const num=v=>Number.isFinite(v)&&v>=0;
const energy=['high','medium','low'];
const intents={study:'学习理解',practice:'做题练习',review:'复习巩固',work:'推进任务'};
function statsFields(x){
 check(x.completionCriterion===undefined||text(x.completionCriterion,500),'本轮完成标准请控制在500字内');
 check(x.intent===undefined||x.intent===''||Object.hasOwn(intents,x.intent),'专注类型无效');
 check(x.pauseCount===undefined||(Number.isInteger(x.pauseCount)&&x.pauseCount>=0),'暂停次数无效');
 check(x.pauseTrackingComplete===undefined||typeof x.pauseTrackingComplete==='boolean','暂停统计标记无效');
 check(x.quality===undefined||x.quality===null||(Number.isInteger(x.quality)&&x.quality>=1&&x.quality<=5),'专注评分应为1—5分');
}
function empty(){return {active:null,records:[],draft:null};}
function validate(b){
 check(b&&typeof b==='object'&&!Array.isArray(b),'计时看板数据无效');
 check(Object.keys(b).every(k=>['active','records','draft'].includes(k)),'计时看板包含未知字段');
 check(Array.isArray(b.records)&&b.records.length<=10000,'计时记录无效或过多');
 const validDraft=d=>d&&text(d.title,150)&&text(d.taskId,100)&&energy.includes(d.energy)&&Number.isInteger(d.minutes)&&d.minutes>=1&&d.minutes<=180&&(d.cutoff===null||num(d.cutoff))&&(d.cutoffConfirmed===undefined||typeof d.cutoffConfirmed==='boolean')&&(d.cutoffMode===undefined||['manual','budget'].includes(d.cutoffMode));
 check(b.draft===null||validDraft(b.draft),'计时设置无效');
 if(b.draft)statsFields(b.draft);
 if(b.active!==null){const a=b.active;
  statsFields(a);
  check(a&&text(a.id,100)&&text(a.title,150)&&a.title.trim()&&text(a.taskId,100)&&energy.includes(a.energy),'当前计时任务无效');
  check(['running','paused','review'].includes(a.phase),'计时状态无效');
  for(const k of ['startedAt','lastAt','cutoff','budgetMs','remainingMs','elapsedMs','finishedAt'])check(num(a[k]),'计时数值无效：'+k);
  check(a.budgetMs>=60000&&a.budgetMs<=10800000&&a.remainingMs<=a.budgetMs&&a.elapsedMs<=a.budgetMs+1,'计时预算无效');
  check(Number.isInteger(a.extensionCount)&&a.extensionCount>=0&&a.extensionCount<=3&&Number.isInteger(a.extraMinutes)&&a.extraMinutes>=0&&a.extraMinutes<=30,'追加预算无效');
  check(a.cutoff>a.startedAt&&a.lastAt>=a.startedAt&&text(a.reason,40),'计时底线或状态无效');
 }
 const ids=new Set();for(const r of b.records){
  statsFields(r);
  check(r&&text(r.id,100)&&!ids.has(r.id)&&text(r.title,150)&&text(r.taskId,100)&&energy.includes(r.energy),'计时记录字段无效');ids.add(r.id);
  check(['done','extend','split','defer'].includes(r.decision)&&text(r.blocker)&&text(r.next)&&text(r.logId,100),'计时复盘无效');
  for(const k of ['startedAt','finishedAt','elapsedMs','budgetMs','cutoff'])check(num(r[k]),'计时记录数值无效');
  check(r.elapsedMs<=r.budgetMs&&r.finishedAt>=r.startedAt,'计时记录时间无效');
 }
 return b;
}
function sync(board,now=Date.now()){
 const b=clone(board),a=b.active;if(!a||a.phase==='review')return b;
 if(a.phase==='running'){
  const end=Math.min(now,a.cutoff,a.lastAt+a.remainingMs),delta=Math.max(0,end-a.lastAt);
  a.elapsedMs+=delta;a.remainingMs-=delta;a.lastAt=Math.max(a.lastAt,end);
  if(a.remainingMs<=0){a.phase='review';a.reason='budget';a.finishedAt=end;}
 }
 if(now>=a.cutoff&&a.phase!=='review'){a.phase='review';a.reason='cutoff';a.finishedAt=a.cutoff;}
 if(a.phase==='review'&&a.finishedAt>=a.cutoff)a.reason='cutoff';
 return b;
}
function start(board,p,now=Date.now(),id='timer_'+now){
 check(!board.active,'请先收尾当前任务');
 const title=String(p.title||'').trim(),minutes=Number(p.minutes),cutoffMode=p.cutoffMode||'manual';
 check(['manual','budget'].includes(cutoffMode),'收尾底线设置方式无效');
 const cutoff=cutoffMode==='budget'?now+minutes*60000:Number(p.cutoff);
 check(title.length>0&&title.length<=150,'请写下本轮要推进的具体任务（最多150字）');
 check(Number.isInteger(minutes)&&minutes>=1&&minutes<=180,'本轮预算为1—180分钟');
 check((cutoffMode==='budget'||(p.cutoff!==null&&p.cutoff!==undefined&&p.cutoff!==''))&&Number.isFinite(cutoff),'请为这个新任务重新设置收尾底线');
 check(cutoff>now,'收尾底线已经过去，请明确选择新的日期和时间');
 check(energy.includes(p.energy),'请选择当前精力');
 const intent=p.intent||'',completionCriterion=String(p.completionCriterion||'').trim();statsFields({intent,completionCriterion});
 const b=clone(board);b.draft={title,minutes,cutoff,cutoffMode,cutoffConfirmed:true,energy:p.energy,taskId:p.taskId||'',intent,completionCriterion};
 b.active={id,title,taskId:p.taskId||'',intent,completionCriterion,pauseCount:0,pauseTrackingComplete:true,energy:p.energy,phase:'running',startedAt:now,lastAt:now,cutoff,budgetMs:minutes*60000,remainingMs:minutes*60000,elapsedMs:0,extensionCount:0,extraMinutes:0,reason:'',finishedAt:0};return validate(b);
}
function control(board,action,now=Date.now()){
 const b=sync(board,now),a=b.active;check(a,'还没有开始计时');if(a.phase==='review')return b;
 if(action==='pause'&&a.phase==='running'){a.phase='paused';a.pauseCount=(a.pauseCount||0)+1;a.pauseTrackingComplete=a.pauseTrackingComplete===true;}
 else if(action==='resume'&&a.phase==='paused'){a.phase='running';a.lastAt=Math.max(now,a.lastAt);}
 else if(action==='finish'){a.phase='review';a.reason='manual';a.finishedAt=Math.min(now,a.cutoff);}
 else throw new Error('当前状态不能执行此操作');return validate(b);
}
function decide(board,p,now=Date.now()){
 const b=sync(board,now),a=b.active;check(a&&a.phase==='review','请先结束本轮计时');
 check(['done','extend','split','defer'].includes(p.decision),'请选择收尾方式');
 const blocker=String(p.blocker||'').trim(),next=String(p.next||'').trim();
 check(blocker.length<=4000&&next.length<=4000,'记录请控制在4000字内');
 check(p.decision==='done'||blocker,'还没懂时，请先记录具体卡在哪里');
 check(!['extend','split'].includes(p.decision)||next,'请写下接下来要解决的一个小问题');
 const minutes=Number(p.minutes||10);
 const quality=p.quality===undefined||p.quality===null||p.quality===''?null:Number(p.quality);statsFields({quality});
 if(p.decision==='extend'){
  check(Number.isInteger(minutes)&&minutes>=1&&minutes<=15,'单次追加1—15分钟');
  check(a.extensionCount<3&&a.extraMinutes+minutes<=30,'本任务已到追加上限（最多3次、累计30分钟），请拆小或暂缓');
  check(now+minutes*60000<=a.cutoff,'追加会越过收尾底线，请拆小或暂缓');
 }
 b.records.unshift({id:a.id,title:a.title,taskId:a.taskId,energy:a.energy,completionCriterion:a.completionCriterion||'',intent:a.intent||'',...(a.pauseCount===undefined?{}:{pauseCount:a.pauseCount}),pauseTrackingComplete:a.pauseTrackingComplete===true,quality,startedAt:a.startedAt,finishedAt:a.finishedAt,elapsedMs:a.elapsedMs,budgetMs:a.budgetMs,cutoff:a.cutoff,decision:p.decision,blocker,next,logId:''});
 if(p.decision==='extend')b.active={...a,id:a.id+'_e'+(a.extensionCount+1),title:next.slice(0,150),pauseCount:0,pauseTrackingComplete:true,phase:'running',startedAt:now,lastAt:now,budgetMs:minutes*60000,remainingMs:minutes*60000,elapsedMs:0,extensionCount:a.extensionCount+1,extraMinutes:a.extraMinutes+minutes,finishedAt:0,reason:''};
 else {b.active=null;b.draft={title:p.decision==='split'?next.slice(0,150):'',minutes:15,taskId:p.decision==='split'?a.taskId:'',energy:a.energy,cutoff:null,cutoffMode:'manual',cutoffConfirmed:false};}
 return validate(b);
}
// One display contract for the page, title, global pill and native window.
function displayRemaining(a,now=Date.now()){
 if(!a||a.phase==='review'||now>=a.cutoff)return 0;
 return Math.max(0,Math.min(a.remainingMs,a.cutoff-(a.phase==='running'?now:a.lastAt)));
}
return {empty,validate,sync,start,control,decide,displayRemaining,intents};
});
