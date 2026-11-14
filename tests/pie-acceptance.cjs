'use strict';
// Authorized pie-only supplement. Browser entry is explicit loopback HTTP, never file://.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const G=require('../core.js'),D=require('../dashboard-data.js');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'pie-evidence');fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),scope:'Only actual-minute allocation pie and V1.1 regression',mode:'Approved loopback HTTP; complete file/offline initial NOT RUN',results:[],browsers:[]};
async function check(name,fn){try{const detail=await fn();report.results.push({name,status:'PASS',detail:detail??null});console.log('PASS '+name);}catch(e){report.results.push({name,status:'FAIL',error:e.stack});console.error('FAIL '+name+': '+e.message);}}
const now='2026-09-13T20:00:00+08:00';
function fixture(entries){const s=G.newState();entries.forEach(([category,minutes],i)=>G.mutate(s,'log:add',{id:'pie-log-'+i,date:'2026-09-07',category,minutes,evidence:'合成饼图验收记录'},now));for(const date of ['2026-09-07','2026-09-08','2026-09-09'])G.mutate(s,'health:set',{date,weight:null,trained:true},now);G.mutate(s,'log:add',{id:'outside-log',date:'2026-09-14',category:'stocks',minutes:500,evidence:'未来周合成记录'},now);return s;}
async function stateOf(p){return p.evaluate(()=>JSON.parse(localStorage.getItem('tgrowth.v1')));}
async function nav(p,view){await p.locator(`nav [data-page="${view}"]`).click();}
async function action(p,name,scope='#app',id){await p.locator(`${scope} [data-action="${name}"]${id?`[data-id="${id}"]`:''}`).first().click();}
async function submit(p){await p.locator('#dialog form button[type="submit"]').click();await p.locator('#dialog').waitFor({state:'hidden'});}
async function upload(p,s){await p.locator('#import-file').setInputFiles({name:'synthetic-pie.json',mimeType:'application/json',buffer:Buffer.from(typeof s==='string'?s:G.exportData(s,now))});await action(p,'confirm-import','#dialog');}
async function week(p,n){await p.locator('#week-number').fill(String(n));await p.locator('#week-number').dispatchEvent('change');}
async function verifyPie(p,entries){
 const total=entries.reduce((n,r)=>n+r[1],0),pie=p.locator('[data-testid="allocation-pie"]');
 const slices=await pie.locator('path[data-slice-category],circle[data-slice-category]').evaluateAll(es=>es.map(e=>({category:e.dataset.sliceCategory,minutes:Number(e.dataset.minutes),percent:Number(e.dataset.percent),tag:e.tagName.toLowerCase(),d:e.getAttribute('d'),r:Number(e.getAttribute('r')),title:e.querySelector('title')?.textContent})));
 assert.equal(slices.length,entries.length);let previousEnd=null,firstStart=null;
 for(let i=0;i<entries.length;i++){
  const [id,minutes]=entries[i],s=slices[i];assert.equal(s.category,id);assert.equal(s.minutes,minutes);assert.ok(Math.abs(s.percent-minutes/total*100)<1e-6);assert.ok(s.title&&s.title.length>3);
  if(entries.length===1){assert.equal(s.tag,'circle');assert.ok(s.r>0);continue;}
  assert.equal(s.tag,'path');const v=s.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);assert.equal(v.length,11,s.d);
  const [cx,cy,sx,sy,rx,ry,rotation,large,sweep,ex,ey]=v;assert.equal(rx,ry);assert.equal(rotation,0);assert.equal(sweep,1);assert.equal(large,minutes/total>.5?1:0);
  assert.ok(Math.abs(Math.hypot(sx-cx,sy-cy)-rx)<.1);assert.ok(Math.abs(Math.hypot(ex-cx,ey-cy)-rx)<.1);
  const angle=(Math.atan2(ey-cy,ex-cx)-Math.atan2(sy-cy,sx-cx)+Math.PI*2)%(Math.PI*2);assert.ok(Math.abs(angle-minutes/total*Math.PI*2)<.002,JSON.stringify({id,actualDegrees:angle*180/Math.PI,expectedDegrees:minutes/total*360}));
  if(previousEnd)assert.ok(Math.hypot(sx-previousEnd[0],sy-previousEnd[1])<.1);else firstStart=[sx,sy];previousEnd=[ex,ey];
 }
 if(entries.length>1)assert.ok(Math.hypot(previousEnd[0]-firstStart[0],previousEnd[1]-firstStart[1])<.1);
 return{totalMinutes:total,angles:entries.map(([id,n])=>[id,n/total*360])};
}
async function main(){
 const url=new URL(process.env.TG_PIE_URL);assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');
 for(const [name,executablePath] of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
  const browser=await chromium.launch({executablePath,headless:true}),context=await browser.newContext({timezoneId:'Asia/Shanghai',locale:'zh-CN',viewport:{width:1440,height:1000},acceptDownloads:true}),p=await context.newPage();p.setDefaultTimeout(10000);const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>requests.push(r.url()));p.on('dialog',d=>d.accept());
  await p.clock.setFixedTime(new Date(now));await p.goto(url.href);await nav(p,'dashboard');report.browsers.push({name,version:browser.version(),executablePath,url:url.href});
  try{
   await check(name+' 零投入无饼，不新增导航/第五卡片，不写入记录',async()=>{assert.equal(await p.locator('[data-testid="allocation-pie"]').count(),0);assert.equal(await p.locator('nav [data-page]').count(),5);assert.equal(await p.locator('[data-chart]').count(),4);assert.equal(await stateOf(p),null);assert.doesNotMatch(await p.locator('#app').innerText(),/NaN|Infinity/);});
   await check(name+' 单类健身45分钟为完整100%圆，3训练天数不参与分母',async()=>{const s=fixture([['fitness',45]]);await upload(p,s);const result=await verifyPie(p,[['fitness',45]]);assert.equal(await p.locator('[data-chart="allocation"] .allocation-row').count(),8);assert.deepEqual(await stateOf(p),s);return result;});
   await check(name+' 多类30/60/90/120分钟对应36/72/108/144度，保留原横条',async()=>{const entries=[['school',30],['english',60],['agent',90],['fitness',120]],s=fixture(entries);await upload(p,s);const result=await verifyPie(p,entries);assert.equal(await p.locator('[data-chart="allocation"] .allocation-row').count(),8);assert.deepEqual(await stateOf(p),s);return result;});
   await check(name+' 大扇区1/359分钟验证1度与359度大弧标志，无丢失圆面',async()=>{const entries=[['school',1],['agent',359]];await upload(p,fixture(entries));return verifyPie(p,entries);});
   const original=fixture([['school',30],['english',60],['agent',90],['fitness',120]]);await upload(p,original);
   await check(name+' 切周与刷新保持原状态；桌面/390饼图、图例无页面横向溢出',async()=>{const before=await p.locator('[data-testid="allocation-pie"]').innerHTML();await week(p,2);assert.equal(await p.locator('[data-testid="allocation-pie"]').count(),0);await week(p,1);assert.equal(await p.locator('[data-testid="allocation-pie"]').innerHTML(),before);await p.reload();await nav(p,'dashboard');assert.deepEqual(await stateOf(p),original);assert.equal(await p.locator('[data-testid="allocation-pie"]').innerHTML(),before);await p.locator('#status').waitFor({state:'hidden',timeout:6000});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(out,name+'-desktop-dashboard.png'),fullPage:true});await p.locator('[data-chart="allocation"]').screenshot({path:path.join(out,name+'-desktop-pie-card.png')});await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=391));await p.screenshot({path:path.join(out,name+'-390-dashboard.png'),fullPage:true});await p.locator('[data-chart="allocation"]').screenshot({path:path.join(out,name+'-390-pie-card.png')});await p.setViewportSize({width:1440,height:1000});});
   await check(name+' 实际编辑90→60、删除健身120后饼图同步为20%/40%/40%',async()=>{await nav(p,'records');await action(p,'log-edit','#app','pie-log-2');await p.locator('#f-minutes').fill('60');await submit(p);await nav(p,'dashboard');await verifyPie(p,[['school',30],['english',60],['agent',60],['fitness',120]]);await nav(p,'records');await action(p,'log-delete','#app','pie-log-3');await nav(p,'dashboard');return verifyPie(p,[['school',30],['english',60],['agent',60]]);});
   await check(name+' 已加载页面断网后真实JSON导出清空导入恢复状态与饼图，无新增请求',async()=>{await context.setOffline(true);const count=requests.length,before=await stateOf(p),html=await p.locator('[data-testid="allocation-pie"]').innerHTML();await action(p,'data','.sidebar');const wait=p.waitForEvent('download');await action(p,'export','#dialog');const dl=await wait,file=path.join(out,name+'-pie-roundtrip.json');await dl.saveAs(file);await action(p,'clear','#dialog');assert.equal(await p.locator('[data-testid="allocation-pie"]').count(),0);await upload(p,fs.readFileSync(file,'utf8'));assert.deepEqual(await stateOf(p),before);assert.equal(await p.locator('[data-testid="allocation-pie"]').innerHTML(),html);assert.equal(requests.length,count);await context.setOffline(false);return{requestDelta:0,fullOfflineInitial:'NOT RUN URL policy'};});
   await check(name+' 单文件同步、无新增依赖或外部请求、控制台错误0',async()=>{const single=new URL(process.env.TG_PIE_SINGLE_URL);assert.equal(single.origin,url.origin);const start=requests.length;await p.goto(single.href);await nav(p,'dashboard');assert.equal(requests.length-start,1);await verifyPie(p,[['school',30],['english',60],['agent',60]]);assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(x=>!x.startsWith(url.origin+'/')&&!/^(data:|blob:)/.test(x)),[]);return{externalRequests:0,errors:0,singleDocumentRequests:1};});
  }finally{await browser.close();}
 }
 const bundle=fs.readFileSync(path.join(root,'T成长_V1.1_单文件.html'),'utf8');assert.ok(bundle.includes(fs.readFileSync(path.join(root,'dashboard-view.js'),'utf8').replace(/\r\n?/g,'\n')));assert.ok(bundle.includes(fs.readFileSync(path.join(root,'style.css'),'utf8').replace(/\r\n?/g,'\n')));
 report.hashes=['index.html','app.js','core.js','courses.js','calendar.js','dashboard-data.js','dashboard-view.js','style.css','T成长_V1.1_单文件.html'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').toUpperCase()}));
}
main().catch(e=>{report.results.push({name:'runner',status:'FAIL',error:e.stack});console.error(e);}).finally(()=>{report.finishedAt=new Date().toISOString();report.passed=report.results.filter(r=>r.status==='PASS').length;report.failed=report.results.filter(r=>r.status==='FAIL').length;fs.writeFileSync(path.join(out,'pie-results.json'),JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;});
