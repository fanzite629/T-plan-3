const assert=require('node:assert/strict'),fs=require('fs'),G=require('../core'),M=require('../task-map'),F=require('../workflow');
const results=[];const test=(name,run)=>{run();results.push({name,pass:true});console.log('PASS '+name);};
function fixture(){let s=G.newState();G.mutate(s,'task:add',{id:'root',title:'合成课程',date:G.today(),category:'school',estimatedMinutes:30});const p=M.create(s.tasks[0]);p.flow=F.create(p);p.flow.draft=F.sample();s=M.save(s,p);return {s,p};}
const edge=(g,a,b,ap,bp)=>F.connection(g,a,b,ap,bp);
test('named ports: direction, resource type, branch outlets, duplicates and cycles',()=>{
 const g=F.sample('r');g.edges=[];
 assert.equal(edge(g,'read','explain','next-in','next-in').allowed,false);
 assert.equal(edge(g,'source','read','resource-out','next-in').allowed,false);
 assert.equal(edge(g,'source','read','resource-out','resource-in').allowed,true);
 g.edges.push(F.connect(g,'judge','practice','','no-out','next-in'));
 assert.equal(g.edges[0].when,'no');assert.equal(edge(g,'judge','repair','no-out','next-in').allowed,false);
 assert.equal(edge(g,'judge','repair','yes-out','next-in').allowed,true);
 assert.equal(edge(g,'practice','judge','next-out','next-in').allowed,false);
});
test('legacy edges infer ports without mutating old JSON; explicit inconsistent ports rejected',()=>{
 const g=F.sample(),raw=JSON.stringify(g);assert.equal(F.edgePorts(g,g.edges[0]).fromPort,'next-out');assert.equal(JSON.stringify(g),raw);
 g.edges[0].fromPort='no-out';assert.match(F.check(g).errors.join(''),/端口/);
});
test('group schema rejects duplicate membership, missing IDs and unknown code fields',()=>{
 const g=F.sample();g.groups=[{id:'q',title:'核心',nodeIds:['read','explain'],collapsed:true}];F.graph(g);
 g.groups.push({id:'q2',title:'重复',nodeIds:['read'],collapsed:false});assert.throws(()=>F.graph(g),/重复/);
 g.groups.pop();g.groups[0].nodeIds=['missing'];assert.throws(()=>F.graph(g),/缺失/);
 g.groups[0].nodeIds=['read'];g.groups[0].script='alert(1)';assert.throws(()=>F.graph(g),/未知/);
});
test('collapse is projection only: business edges, path budget and adoption stay intact',()=>{
 let {s,p}=fixture();p.flow.draft.groups=[{id:'q',title:'理解',nodeIds:['read','explain'],collapsed:true}];const before=JSON.stringify(p.flow.draft.edges),v=F.projection(p.flow.draft);
 assert.equal(v.nodes.length,4);assert.equal(v.edges.length,5);assert(v.edges.some(e=>e.viewFrom==='@group:q'&&e.to==='judge'));
 assert.equal(JSON.stringify(p.flow.draft.edges),before);assert.equal(F.check(p.flow.draft).max,25);s=M.save(s,p);s=F.adopt(s,p.id,['read','explain','practice','repair','record'],G);const count=s.tasks.length;s=F.adopt(s,p.id,['read','explain','practice','repair','record'],G);assert.equal(s.tasks.length,count);
 const history=JSON.stringify(s.taskMaps.plans[0].flow.versions);s.taskMaps.plans[0].flow.draft.groups[0].collapsed=false;F.start(s.taskMaps.plans[0]);assert.equal(JSON.stringify(s.taskMaps.plans[0].flow.versions),history);
});
test('layout and folds cannot alter completed evidence, timer state or effort totals',()=>{
 let {s,p}=fixture();s=F.adopt(s,p.id,['read','explain'],G);p=s.taskMaps.plans[0];F.start(p);s=F.advance(s,p.id,{result:'人工完成'},G);p=s.taskMaps.plans[0];G.mutate(s,'log:add',{date:G.today(),minutes:8,category:'school',taskId:p.flow.links.read});
 const before=JSON.stringify({tasks:s.tasks,logs:s.logs,runs:p.flow.runs,versions:p.flow.versions}),next=F.copy(p);next.flow.draft=F.arrange(next.flow.draft);next.flow.draft.groups=[{id:'q',title:'已完成阶段',nodeIds:['read'],collapsed:true}];F.guard(s,p,next);s=M.save(s,next);
 assert.equal(JSON.stringify({tasks:s.tasks,logs:s.logs,runs:next.flow.runs,versions:next.flow.versions}),before);assert.equal(M.effort(s,'root'),8);assert.equal(s.timerBoard,undefined);
});
test('template instances remap all IDs and groups, share resources without global edits',()=>{
 const g=F.sample('resource_shared');g.groups=[{id:'q',title:'核心',nodeIds:['read','explain'],collapsed:true}];g.nodes[0].locked=true;
 const a=F.cloneTemplate(g),b=F.cloneTemplate(g);assert(!a.nodes.some(n=>b.nodes.some(x=>x.id===n.id)));assert(!a.nodes.some(n=>n.locked));assert.equal(a.nodes.find(n=>n.kind==='resource').resourceId,'resource_shared');assert.equal(a.groups[0].nodeIds.length,2);assert.notEqual(a.groups[0].id,b.groups[0].id);F.graph(a);
});
test('old imports and new optional fields roundtrip; AI contract omits visual metadata',()=>{
 let {s,p}=fixture();const old=G.exportData(s);assert.deepEqual(G.parseImport(old).state,s);p.flow.version=2;p.flow.draft.groups=[{id:'q',title:'<img src=x>',nodeIds:['read'],collapsed:false}];p.flow.draft.edges[0]={...p.flow.draft.edges[0],fromPort:'next-out',toPort:'next-in'};s=M.save(s,p);assert.deepEqual(G.parseImport(G.exportData(s)).state,s);
 const ai=F.forAI(p.flow.draft);assert.equal(ai.groups,undefined);assert.equal(ai.edges[0].fromPort,undefined);assert.deepEqual(Object.keys(ai),['nodes','edges','startId','totalBudget']);const retained=F.retainGroups(p.flow.draft,ai);assert.equal(retained.groups.length,1);
});
test('human branch merge uses only selected path, no automatic task completion',()=>{
 let {s,p}=fixture();p.flow.draft=F.arrange(p.flow.draft);p.flow.draft.groups=[{id:'q',title:'分支',nodeIds:['practice','repair'],collapsed:true}];s=M.save(s,p);s=F.adopt(s,p.id,['read','explain','practice','repair','record'],G);F.start(s.taskMaps.plans[0]);for(const result of ['读','解释'])s=F.advance(s,p.id,{result},G);s=F.advance(s,p.id,{choice:'yes'},G);s=F.advance(s,p.id,{result:'练习完成'},G);assert.equal(s.taskMaps.plans[0].flow.runs[0].currentId,'record');assert.equal(s.tasks.find(t=>t.id===s.taskMaps.plans[0].flow.links.repair).status,'todo');assert.equal(s.logs.length,0);
});
test('constants are reference-only, typed, preserved in history and excluded from scheduling',()=>{
 let {s,p}=fixture();const g=p.flow.draft,c={...F.node('constant','验收题数'),id:'count',valueType:'number',value:'2'};g.nodes.push(c);g.edges.push(F.connect(g,'count','practice'));assert.equal(g.edges.at(-1).relation,'parameter');assert.equal(F.check(g).max,25);assert.equal(F.connection(g,'count','practice','parameter-out','next-in').allowed,false);s=M.save(s,p);s=F.adopt(s,p.id,['practice'],G);assert.equal(s.tasks.length,2);const v=s.taskMaps.plans[0].flow.versions[0];s.taskMaps.plans[0].flow.draft.nodes.find(n=>n.id==='count').value='3';assert.equal(v.graph.nodes.find(n=>n.id==='count').value,'2');assert.equal(F.forAI(g).nodes.some(n=>n.kind==='constant'),false);assert.equal(F.retainGroups(g,F.forAI(g)).nodes.find(n=>n.id==='count').value,'2');c.value='Infinity';assert.throws(()=>F.graph(g),/有效/);
});
fs.mkdirSync('output/flow-ports',{recursive:true});fs.writeFileSync('output/flow-ports/core-results.json',JSON.stringify({pass:true,results},null,2));
