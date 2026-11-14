/* Business data only. No LogicFlow representation, network access or task status from AI. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.TGTaskMap=f();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const MAX=30,DEPTH=3,copy=o=>JSON.parse(JSON.stringify(o));
const flow=()=>typeof module==='object'&&module.exports?require('./workflow.js'):globalThis.TGFlow;
const ok=(v,m)=>{if(!v)throw new Error(m);};
const text=(v,max,label,empty=true)=>ok(typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0),label+'格式或长度无效');
const id=v=>{text(v,100,'ID',false);ok(/^[a-zA-Z0-9_-]+$/.test(v)&&!['__proto__','constructor','prototype'].includes(v),'ID无效');};
const obj=(o,fields)=>{ok(o&&typeof o==='object'&&!Array.isArray(o),'需要对象');ok(Object.keys(o).every(k=>fields.includes(k)),'包含不支持的字段');};
const uid=()=> 'map_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
function constraints(c){obj(c,['goal','progress','budget','deadline','materials']);text(c.goal,1000,'目标',false);text(c.progress,2000,'已有进度');text(c.materials,3000,'资料或限制');text(c.deadline,40,'截止时间');ok(c.deadline===''||Number.isFinite(Date.parse(c.deadline)),'截止时间无效');ok(Number.isInteger(c.budget)&&c.budget>=1&&c.budget<=10080,'预算须为1—10080分钟');return c;}
function validateDraft(d){
 obj(d,['nodes','questions','assumptions','conflicts']);
 for(const key of ['questions','assumptions','conflicts']){ok(Array.isArray(d[key])&&d[key].length<=5,key+'最多5条');d[key].forEach(s=>text(s,500,key,false));}
 ok(Array.isArray(d.nodes)&&d.nodes.length<=MAX,'最多30个节点');ok(d.nodes.length>0||d.questions.length>0,'空方案：请补充目标或具体卡点');
 const by=new Map();for(const n of d.nodes){obj(n,['id','title','action','minutes','criterion','parentId','dependencies']);id(n.id);ok(!by.has(n.id),'节点ID重复');by.set(n.id,n);text(n.title,150,'标题',false);text(n.action,2000,'具体行动',false);text(n.criterion,500,'完成标准',false);ok(Number.isInteger(n.minutes)&&n.minutes>=1&&n.minutes<=180,'单节点预计时长须为1—180分钟');ok(n.parentId===null||typeof n.parentId==='string','父节点无效');ok(Array.isArray(n.dependencies)&&n.dependencies.length<=MAX&&new Set(n.dependencies).size===n.dependencies.length,'前置依赖重复或无效');n.dependencies.forEach(id);}
 for(const n of d.nodes){let p=n,seen=new Set([n.id]),depth=1;while(p.parentId!==null){ok(by.has(p.parentId),'父节点不存在');ok(!seen.has(p.parentId),'包含关系不能成环');seen.add(p.parentId);p=by.get(p.parentId);depth++;ok(depth<=DEPTH,'最多3层节点');}for(const dep of n.dependencies){ok(by.has(dep),'依赖端点不存在');ok(dep!==n.id,'节点不能依赖自身');ok(!seen.has(dep),'不能依赖自己的汇总父节点');}}
 const visited=new Set(),stack=new Set();function walk(k){ok(!stack.has(k),'执行依赖存在循环');if(visited.has(k))return;stack.add(k);for(const dep of by.get(k).dependencies)walk(dep);stack.delete(k);visited.add(k);}d.nodes.forEach(n=>walk(n.id));
 // A summary and any descendant cannot be execution dependencies in either direction.
 for(const n of d.nodes)for(const dep of n.dependencies){let p=by.get(dep);while(p.parentId!==null){ok(p.parentId!==n.id,'汇总节点不能依赖自己的子节点');p=by.get(p.parentId);}}
 const children=new Map(d.nodes.map(n=>[n.id,[]]));d.nodes.forEach(n=>{if(n.parentId)children.get(n.parentId).push(n.id);});
 const leaves=k=>children.get(k).length?children.get(k).flatMap(leaves):[k];
 const execution=new Map(d.nodes.filter(n=>!children.get(n.id).length).map(n=>[n.id,new Set()]));
 for(const n of d.nodes)for(const dep of n.dependencies)for(const target of leaves(n.id))for(const source of leaves(dep))execution.get(target).add(source);
 const done=new Set(),active=new Set();function visit(k){ok(!active.has(k),'汇总节点展开后的依赖存在循环');if(done.has(k))return;active.add(k);execution.get(k).forEach(visit);active.delete(k);done.add(k);}execution.forEach((_,k)=>visit(k));
 return d;
}
const summaries=d=>new Set(d.nodes.map(n=>n.parentId).filter(Boolean));
const total=d=>{const parents=summaries(d);return d.nodes.filter(n=>!parents.has(n.id)).reduce((a,n)=>a+n.minutes,0);};
function validateStore(s){
 obj(s,['version','plans','resources','templates']);ok(s.version===1&&Array.isArray(s.plans)&&s.plans.length<=300,'地图存储格式无效');const ids=new Set(),targets=new Set(),taskIds=new Set();
 if(s.resources!==undefined)flow().resources(s.resources);
 if(s.templates!==undefined){ok(Array.isArray(s.templates)&&s.templates.length<=50,'模板最多50个');const tids=new Set();for(const t of s.templates){obj(t,['id','name','graph']);id(t.id);ok(!tids.has(t.id),'模板ID重复');tids.add(t.id);text(t.name,100,'模板名',false);flow().graph(t.graph);}}
 for(const p of s.plans){obj(p,['id','rootTaskId','constraints','draft','accepted','links','source','revision','created','flow','coursePlanId']);id(p.id);id(p.rootTaskId);if(p.coursePlanId!==undefined)id(p.coursePlanId);if(p.flow!==undefined)flow().validate(p.flow);ok(!ids.has(p.id)&&!targets.has(p.rootTaskId),'地图ID或目标重复');ids.add(p.id);targets.add(p.rootTaskId);constraints(p.constraints);validateDraft(p.draft);ok(['manual','mock','deepseek'].includes(p.source),'来源无效');ok(Number.isInteger(p.revision)&&p.revision>=0,'版本无效');obj(p.links,Object.keys(p.links));if(p.created!==undefined){obj(p.created,Object.keys(p.links));for(const value of Object.values(p.created))text(value,12000,'创建快照',false);}ok(Object.keys(p.links).length<=MAX,'关联过多');
 if(p.accepted!==null){validateDraft(p.accepted);ok(JSON.stringify(p.accepted)===JSON.stringify(p.draft),'已采用方案不可重新生成或改写');}else ok(Object.keys(p.links).length===0,'草稿不能关联正式任务');
 for(const [nodeId,taskId] of Object.entries(p.links)){id(nodeId);id(taskId);ok(p.accepted&&p.accepted.nodes.some(n=>n.id===nodeId),'关联节点不存在');ok(!taskIds.has(taskId),'正式任务重复关联');taskIds.add(taskId);}if(p.accepted)ok(Object.keys(p.links).length===p.accepted.nodes.length,'正式任务关联不完整');
 }
 const flowTaskIds=new Set();for(const p of s.plans)if(p.flow){const local=new Set();for(const [nid,tid] of Object.entries(p.flow.links)){ok(!local.has(tid)&&!flowTaskIds.has(tid),'流程任务重复关联');ok(!taskIds.has(tid)||p.links[nid]===tid,'与旧地图关联冲突');local.add(tid);flowTaskIds.add(tid);}}
 // Separate plans can further decompose adopted nodes; prevent imported hierarchy cycles/depth overflow.
 const parents=parentTaskIds(s),counts=new Map();for(const task of parents.keys()){let t=task,seen=new Set(),depth=0;while(parents.has(t)){ok(!seen.has(t),'跨地图包含关系成环');seen.add(t);t=parents.get(t);ok(++depth<=DEPTH,'子任务最多3层');}counts.set(t,(counts.get(t)||0)+1);ok(counts.get(t)<=MAX,'同一目标的执行树最多30个子节点');}
 return s;
}
function create(task){return {id:uid(),rootTaskId:task.id,constraints:{goal:task.title,progress:'',budget:Math.max(1,task.estimatedMinutes||45),deadline:'',materials:''},draft:{nodes:[],questions:['这一轮希望留下什么可验收的结果？'],assumptions:[],conflicts:[]},accepted:null,links:{},source:'manual',revision:0};}
function save(state,plan){validateStore({version:1,plans:[plan]});const next=copy(state);next.taskMaps??={version:1,plans:[]};const i=next.taskMaps.plans.findIndex(p=>p.rootTaskId===plan.rootTaskId);if(i<0)next.taskMaps.plans.push(copy(plan));else next.taskMaps.plans[i]=copy(plan);validateStore(next.taskMaps);return next;}
function adopt(state,planId,G){
 const next=copy(state),p=next.taskMaps?.plans.find(p=>p.id===planId);ok(p,'草稿不存在');if(p.accepted)return next;validateDraft(p.draft);ok(p.draft.nodes.length>0,'先回答澄清问题并生成节点');const root=next.tasks.find(t=>t.id===p.rootTaskId);ok(root,'原任务已删除，草稿保留供查看');
 // All IDs/statuses are generated here. Do not accept either from the model.
 const links={},created={};for(const n of p.draft.nodes){const taskId=uid();G.mutate(next,'task:add',{id:taskId,title:n.title,category:root.category,date:root.date,estimatedMinutes:n.minutes,priority:root.priority,notes:n.action+'\n完成标准：'+n.criterion,status:'todo'});links[n.id]=taskId;created[n.id]=JSON.stringify(next.tasks.find(t=>t.id===taskId));}
 p.created=created;p.links=links;p.accepted=copy(p.draft);p.revision++;validateStore(next.taskMaps);return next;
}
function rollback(state,planId){const next=copy(state),p=next.taskMaps?.plans.find(p=>p.id===planId);ok(p?.accepted,'没有可撤回的方案');const ids=new Set(Object.values(p.links));
 ok(!next.logs.some(l=>ids.has(l.taskId))&&!next.timerBoard?.records.some(r=>ids.has(r.taskId))&&!ids.has(next.timerBoard?.active?.taskId),'已有计时或投入，保留方案与历史记录；请编辑正式任务');
 ok(!next.taskMaps.plans.some(x=>x.id!==p.id&&ids.has(x.rootTaskId)),'子任务已有地图，不能撤回');
 for(const taskId of ids){const t=next.tasks.find(t=>t.id===taskId),n=p.draft.nodes.find(n=>p.links[n.id]===taskId);ok(p.created?.[n.id]===JSON.stringify(t),'子任务已变更，不能安全撤回');ok(t&&t.status==='todo'&&t.statusHistory.length===1&&!t.history.length&&t.title===n.title&&t.estimatedMinutes===n.minutes&&t.notes===n.action+'\n完成标准：'+n.criterion&&!t.evidence,'子任务已变更或删除，不支持安全撤回');}
 next.tasks=next.tasks.filter(t=>!ids.has(t.id));for(const d of Object.keys(next.mainByDate))if(ids.has(next.mainByDate[d]))delete next.mainByDate[d];if(ids.has(next.timerBoard?.draft?.taskId)){next.timerBoard.draft.taskId='';next.timerBoard.draft.cutoff=null;next.timerBoard.draft.cutoffMode='manual';next.timerBoard.draft.cutoffConfirmed=false;}
 p.accepted=null;p.links={};p.created={};p.revision++;return next;
}
function parentTaskIds(store){const m=new Map();for(const p of store?.plans||[]){if(p.accepted)for(const n of p.accepted.nodes)m.set(p.links[n.id],n.parentId?p.links[n.parentId]:p.rootTaskId);if(p.flow)for(const tid of Object.values(p.flow.links))if(!m.has(tid))m.set(tid,p.rootTaskId);}return m;}
const summaryTasks=state=>new Set(parentTaskIds(state.taskMaps).values());
function descendants(state,root){const parents=parentTaskIds(state.taskMaps),all=new Set([root]);let change=true;while(change){change=false;for(const [k,p]of parents)if(all.has(p)&&!all.has(k)){all.add(k);change=true;}}return all;}
function effort(state,root){const ids=descendants(state,root);return state.logs.filter(l=>ids.has(l.taskId)).reduce((n,l)=>n+l.minutes,0);}
function estimated(state,root){const ids=descendants(state,root),parents=summaryTasks(state);return state.tasks.filter(t=>ids.has(t.id)&&!parents.has(t.id)).reduce((n,t)=>n+t.estimatedMinutes,0);}
function fingerprint(task){return JSON.stringify(task||null);}
function mock(c){return {questions:[],assumptions:['模拟示例，不是 AI 调用；请按自己的课程与进度改写。'],conflicts:c.budget<45?['45分钟示例超出预算；可缩小验收范围或减少步骤。']:[],nodes:[{id:'diagnose',title:'诊断一个具体问题',action:'选一道对应题或一个操作，先独立尝试，标出第一个无法解释的步骤。',minutes:10,criterion:'留下自己的尝试与一个明确卡点',parentId:null,dependencies:[]},{id:'repair',title:'针对卡点补齐概念',action:'根据错因查对应资料，写出关键定义或条件，再修改原尝试。',minutes:15,criterion:'能解释修改依据并指出资料来源',parentId:null,dependencies:['diagnose']},{id:'verify',title:'独立练习与验收',action:'合上资料完成类似问题，核对完成标准，记录错因和下一步。',minutes:20,criterion:'保留独立产出及验收结果；未通过则标明下一步',parentId:null,dependencies:['repair']}]};}
return {MAX,DEPTH,uid,copy,constraints,validateDraft,validateStore,create,save,adopt,rollback,total,summaries,summaryTasks,descendants,effort,estimated,fingerprint,mock};
});
