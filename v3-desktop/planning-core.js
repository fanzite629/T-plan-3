/* Planning rules shared by the desktop UI and integration tests. No network or storage access. */
(function(root, factory) {
 if(typeof module === 'object' && module.exports) module.exports = factory();
 else root.TPlanPlanning = factory();
})(typeof globalThis === 'object' ? globalThis : this, function() {
 'use strict';
 const clone = x => JSON.parse(JSON.stringify(x));
 const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
 const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
 const uid = p => p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 function fail(message) { throw new Error(message); }
 function text(x, max, label, optional=false) {
  if(typeof x !== 'string' || (!optional && !x.trim()) || x.length > max) fail(label+'格式不正确或过长');
  return x.trim();
 }
 function validDate(s) {
  if(typeof s!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y=+s.slice(0,4),m=+s.slice(5,7),d=+s.slice(8,10),dt=new Date(y,m-1,d);
  return y>=1970 && y<=2200 && dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d;
 }
 function date(s,label) { if(!validDate(s)) fail(label+'必须是有效日期'); return s; }
 const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 function addDays(s,n) { const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+n);return iso(d); }
 function weekStart(s) { date(s,'周日期');const d=new Date(s+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d); }
 function integer(x,min,max,label) { if(!Number.isInteger(x)||x<min||x>max)fail(label+'须为 '+min+'–'+max+' 的整数');return x; }
 function normalize(s) {
  if(!obj(s))fail('数据不是对象');
  if((s.planningVersion||0)>1)fail('这是更新版本的计划数据，请使用新版软件');
  s.planningVersion=1;
  if(!Array.isArray(s.proposals))s.proposals=[];
  if(!obj(s.reviewEntries))s.reviewEntries={};
  if(!obj(s.weekPlans))s.weekPlans={};
  for(const t of s.tasks||[]) {
   if(t.date===null) { if(!validDate(t.week)) t.week=null;else t.week=weekStart(t.week); }
   else t.week=null;
   if(typeof t.next!=='string')t.next='';
  }
  return s;
 }
 function parseJSON(raw) {
  if(obj(raw))return clone(raw);
  if(typeof raw!=='string'||raw.length>200000)fail('模型结果过长或不是文本');
  const s=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try { const v=JSON.parse(s); if(!obj(v))fail('草稿必须是 JSON 对象');return v; }
  catch { fail('模型没有返回有效 JSON，请重试；尚未写入任何任务'); }
 }
 function taskItem(v, ws, allowExisting) {
  if(!obj(v))fail('任务条目无效');
  const item={title:text(v.title,150,'任务标题'), date:v.date==null?null:date(v.date,'任务日期'),
   minutes:integer(v.minutes,1,1440,'预计分钟'), category:['school','math','english','other'].includes(v.category)?v.category:'other'};
  if(ws && item.date && (item.date<ws||item.date>addDays(ws,6)))fail('周计划里的日期必须在所选周内');
  item.week=item.date?null:(ws || (v.week?weekStart(v.week):null));
  if(v.taskId!=null) { if(!allowExisting)fail('添加任务草稿不能修改已有任务');item.taskId=text(v.taskId,100,'任务 ID'); }
  return item;
 }
 function validateDraft(raw, context) {
  const d=parseJSON(raw), kind=d.kind;
  if(!['tasks','tree','week'].includes(kind))fail('只能提议任务、决策树或周计划');
  if(context.kind && kind!==context.kind)fail('返回类型与这次请求不一致');
  const out={kind,title:text(d.title,150,'草稿标题')};
  if(kind==='tasks'||kind==='week') {
   if(!Array.isArray(d.items)||!d.items.length||d.items.length>40)fail('每份草稿须包含 1–40 个任务');
   let ws=null;
   if(kind==='week') {
    ws=weekStart(d.weekStart);if(context.weekStart&&ws!==context.weekStart)fail('模型改变了所选周，请重试');
    out.weekStart=ws;out.focus=text(d.focus||'',300,'本周重点',true);
    out.capacityMin=d.capacityMin==null?null:integer(d.capacityMin,0,10080,'本周可投入分钟');
   }
   out.items=d.items.map(x=>taskItem(x,ws,kind==='week'));
   const ids=new Set();
   for(const item of out.items)if(item.taskId){
    if(ids.has(item.taskId))fail('同一任务在草稿里出现了两次');ids.add(item.taskId);
    const t=(context.tasks||[]).find(t=>t.id===item.taskId);
    if(!t||t.done)fail('草稿引用了不存在或已完成的任务');
    if(t.title!==item.title)fail('已有任务的标题不能在排程草稿中改写，请保留原题目');
    if(!(t.date>=ws&&t.date<=addDays(ws,6)||t.date===null&&t.week===ws))fail('周计划只能调整所选周中的任务');
    item.category=t.cat;
   }
  } else {
   out.start=date(d.start||context.today,'起始日期');let count=0;
   function node(n,depth,root=false) {
    if(!obj(n)||depth>8||++count>80)fail('决策树超过 8 层或 80 个节点，或节点格式错误');
    if(!['goal','step','check'].includes(n.kind)||(root?n.kind!=='goal':n.kind==='goal'))fail('决策树节点类型不正确');
    if(!Array.isArray(n.kids))fail('节点缺少 kids 子节点列表');
    if(n.kind==='check'&&(n.kids.length<2||n.kids.length>4))fail('检查点须有 2–4 个分支');
    if(n.kind!=='check'&&n.kids.length>1)fail('普通步骤只能有一个下一步；分支请使用检查点');
    if(root&&n.kids.length!==1)fail('目标根节点需要一个第一步');
    const v={kind:n.kind,title:text(n.title,150,'节点标题'),min:n.kind==='step'?integer(n.min,1,600,'步骤分钟'):0,
     day:integer(n.day==null?0:n.day,0,59,'相对天数'),cond:text(n.cond||'',120,'分支条件',true),kids:n.kids.map(k=>node(k,depth+1))};
    if(v.kind==='check'&&v.kids.some(k=>!k.cond))fail('每个检查点分支都需要写明条件');
    return v;
   }
   out.root=node(d.root,0,true);out.root.title=out.title;
  }
  return out;
 }
 function taskBasis(t) { return t?JSON.stringify([t.title,t.date,t.week||null,t.est,t.done]):null; }
 function basis(state,draft) {
  if(draft.kind!=='week')return null;
  return {weekPlan:JSON.stringify(state.weekPlans?.[draft.weekStart]||null),
   tasks:Object.fromEntries(draft.items.filter(x=>x.taskId).map(x=>[x.taskId,taskBasis(state.tasks.find(t=>t.id===x.taskId))]))};
 }
 function createProposal(state,draft,meta={}) {
  const p={id:uid('proposal'),status:'pending',createdAt:Date.now(),source:meta.source==='ai'?'ai':'local',
   model:meta.model||'',prompt:meta.prompt||'',draft:clone(draft),basis:meta.basis||basis(state,draft)};
  return p;
 }
 function applyProposal(state,id,now=Date.now()) {
  const s=normalize(clone(state)),p=s.proposals.find(p=>p.id===id);
  if(!p)fail('找不到这份草稿');
  if(p.status==='accepted')return {state:s,alreadyApplied:true,created:p.created||[]};
  if(p.status!=='pending')fail('这份草稿已经处理，不能再次写入');
  const d=validateDraft(p.draft,{kind:p.draft.kind,today:iso(new Date(now)),tasks:s.tasks,weekStart:p.draft.weekStart});
  if(d.kind==='week'&&p.basis) {
   if(p.basis.weekPlan!==JSON.stringify(s.weekPlans[d.weekStart]||null))fail('本周重点或容量已变化，请刷新草稿后再确认');
   for(const [id,old] of Object.entries(p.basis.tasks))if(old!==taskBasis(s.tasks.find(t=>t.id===id)))fail('草稿中的任务已变化，请刷新草稿后再确认');
  }
  const made=[];
  if(d.kind==='tree') {
   const stamp=n=>({...n,id:uid('n'),kids:n.kids.map(stamp),origin:p.source==='ai'?'agent':'local'});
   const tr={id:uid('tr'),goal:d.title,createdAt:now,start:d.start,root:stamp(d.root),added:{},chosen:{},pick:{},origin:p.source==='ai'?'agent':'local'};
   s.trees.push(tr);made.push({kind:'tree',id:tr.id});
  } else {
   for(const item of d.items) {
    if(item.taskId) {
     const t=s.tasks.find(t=>t.id===item.taskId);
     Object.assign(t,{date:item.date,week:item.week,est:item.minutes});
     for(const day of Object.keys(s.main))if(s.main[day]===t.id&&day!==t.date)delete s.main[day];
     made.push({kind:'moved',id:t.id});
    } else {
     const t={id:uid('t'),title:item.title,cat:item.category,date:item.date,week:item.week,est:item.minutes,
      done:false,doneAt:null,pin:false,createdAt:now,tree:null,check:false,legacy:null,next:'',origin:p.source==='ai'?'agent':'local',proposalId:p.id};
     s.tasks.push(t);made.push({kind:'task',id:t.id});
    }
   }
   if(d.kind==='week')s.weekPlans[d.weekStart]={...(s.weekPlans[d.weekStart]||{}),focus:d.focus,capacityMin:d.capacityMin,origin:p.source==='ai'?'agent':'local',updatedAt:now};
  }
  p.status='accepted';p.appliedAt=now;p.created=made;
  return {state:s,alreadyApplied:false,created:made};
 }
 function facts(state,from,to) {
  date(from,'开始日期');date(to,'结束日期');if(to<from)fail('日期范围无效');
  const sessions=state.sessions.filter(s=>s.date>=from&&s.date<=to);
  const minutes=sessions.reduce((n,s)=>n+(Number(s.minutes)||0),0);
  const tasks=state.tasks.filter(t=>t.date&&t.date>=from&&t.date<=to);
  const by=new Map();
  for(const s of sessions){const k=s.taskId||s.title;const x=by.get(k)||{taskId:s.taskId||null,title:s.title,minutes:0,count:0};x.minutes+=Number(s.minutes)||0;x.count++;by.set(k,x);}
  return {from,to,minutes,count:sessions.length,planned:tasks.length,done:tasks.filter(t=>t.done).length,
   byTask:[...by.values()],withoutRecord:tasks.filter(t=>!sessions.some(s=>s.taskId===t.id)).map(t=>({id:t.id,title:t.title,done:!!t.done})),
   fingerprint:JSON.stringify({sessions:sessions.map(s=>[s.id,s.taskId,s.title,s.date,s.minutes,s.note||'']),tasks:tasks.map(t=>[t.id,t.title,t.date,!!t.done])})};
 }
 function reviewDraft(raw) {
  const d=parseJSON(raw);
  return {summary:text(d.summary,6000,'复盘内容'),nextSteps:(Array.isArray(d.nextSteps)?d.nextSteps:[]).slice(0,5).map(x=>text(x,500,'下一步建议'))};
 }
 function moveTask(state,id,target,ws) {
  const s=normalize(clone(state)),t=s.tasks.find(t=>t.id===id);if(!t)fail('任务已不存在');
  if(target===null){t.date=null;t.week=weekStart(ws);}else{t.date=date(target,'任务日期');t.week=null;}
  for(const d of Object.keys(s.main))if(s.main[d]===id&&d!==t.date)delete s.main[d];
  return s;
 }
 return {clone,uid,normalize,validDate,addDays,weekStart,validateDraft,parseJSON,createProposal,applyProposal,basis,facts,reviewDraft,moveTask};
});
