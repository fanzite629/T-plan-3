// Explicit live API acceptance. Uses current configuration with fabricated data only.
// Never logs a key, request headers, or production tasks/records.
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process'),P=require('./planning-core.js');
const out=path.resolve(__dirname,'output/playwright'),root=path.join(out,'deepseek-live-'+Date.now());fs.mkdirSync(root,{recursive:true});
const today=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})(),week=P.weekStart(today);
const requested=(process.argv[2]||'tasks,review,tree,week').split(',');
const exe=process.env.TPLAN_TEST_EXE||'D:/Soft/TPlanV3/T计划 v3.exe';
const results=[],errors=[];let app,browser,page;
const seed={app:'tplan',v:1,sample:false,main:{},notes:[],trees:[],active:null,ui:{},settings:{cap:180},weekPlans:{[week]:{focus:'示例：复习电路基础，检查能否独立列式',capacityMin:120}},
 tasks:[{id:'live-demo-a',title:'示例任务：复习电路基础',date:today,week:null,cat:'school',est:30,done:false,pin:false,createdAt:Date.now()},
 {id:'live-demo-b',title:'示例任务：做两道练习题',date:null,week,cat:'school',est:45,done:false,pin:false,createdAt:Date.now()}],
 sessions:[{id:'live-demo-session-a',taskId:'live-demo-a',title:'示例任务：复习电路基础',cat:'school',date:today,start:null,end:null,minutes:20,note:'验收用虚构数据：读了定义，做了示例题 1 到 3。',src:'manual'},
 {id:'live-demo-session-b',taskId:'live-demo-b',title:'示例任务：做两道练习题',cat:'school',date:today,start:null,end:null,minutes:15,note:'验收用虚构数据：第四题列式仍有疑问，没有标记完成。',src:'manual'}]};
function python(code,args=[],input){const r=spawnSync('python',['-c',code,...args],{encoding:'utf8',input,windowsHide:true});if(r.status!==0)throw Error(r.stderr);return r.stdout;}
const read=()=>page.evaluate(()=>JSON.parse(chrome.webview.hostObjects.sync.database.Read('tplan.v3')));
const go=async v=>page.locator('#nav [data-go="'+v+'"]').click();
async function generate(kind){const before=await read(),start=Date.now();console.log('START live '+kind);let item={kind,ok:false};
 try{
  if(kind==='review'){
   await go('review');await page.locator('#reviewReflection').fill('独立验收示例：前三题能跟着例题做，第四题独立列式仍卡住。');await page.locator('#reviewNext').fill('独立验收示例：下次先列第四题的已知量。');await page.locator('#reviewInclude').check();
   await page.locator('[data-enh="review-ai"]').click();
  }else{
   await go('assistant');await page.locator('[name="plan-kind"][value="'+kind+'"]').check();
   const prompt={tasks:'独立验收示例。为复习电路基础提出 2 个可观察的小任务，合计不超过 60 分钟，日期未定。只规划要做的行动，不编造学习成果。',tree:'独立验收示例。目标：复习电路基础并检查能否独立列式。只需一个 20 分钟学习步骤、一个检查点和两个后续分支。分支条件为能独立列式或暂时不能，总节点不超过 6 个。',week:'独立验收示例。请安排本周现有的两个示例任务，不新增任务，不改标题。保留一个在本周未定；本周容量 120 分钟。重点是能否独立列式，由我做完后判断。'}[kind];
   await page.locator('#planPrompt').fill(prompt);await page.locator('[data-enh="generate-ai"]').click();
  }
  await page.waitForFunction(()=>!document.querySelector('.plan-busy'),{},{timeout:70000});
  const response=await page.evaluate(()=>window.liveResponses.at(-1));if(response?.error)throw Error(response.error);
  const s=await read();assert.deepEqual(s.sessions,before.sessions);assert.deepEqual(s.tasks,before.tasks);
  if(kind==='review'){
   const entry=s.reviewEntries['day:'+today];if(!entry?.generated)throw Error(await page.locator('.plan-error').first().innerText().catch(()=>'未生成复盘草稿'));
   assert.equal(entry.generated.source,'ai');assert.equal(entry.reflection,'独立验收示例：前三题能跟着例题做，第四题独立列式仍卡住。');assert.ok(entry.generated.summary.trim());
   item.output=entry.generated;await page.locator('.review-ai').screenshot({path:path.join(out,'deepseek-live-review.png')});
   await page.locator('[data-enh="review-adopt"]').click();const adopted=(await read()).reviewEntries['day:'+today];
   assert.ok(adopted.next.startsWith(entry.next));assert.equal(adopted.reflection,entry.reflection);
   assert.doesNotMatch(adopted.next,/建议\s*[：:]\s*建议\s*[：:]/,'采纳建议时不应重复添加“建议：”前缀');
   const once=adopted.next;await page.locator('[data-enh="review-adopt"]').click();assert.equal((await read()).reviewEntries['day:'+today].next,once);
   item.adoptionVerified=true;
  }else{
   const p=s.proposals?.find(p=>!before.proposals?.some(q=>q.id===p.id));if(!p)throw Error(await page.locator('.plan-error').first().innerText().catch(()=>'未生成提议草稿'));
   assert.equal(p.status,'pending');assert.equal(p.source,'ai');assert.equal(p.draft.kind,kind);item.output=p.draft;
   if(kind==='week'&&requested.length===1){assert.deepEqual(p.draft.items.map(x=>x.taskId).sort(),['live-demo-a','live-demo-b']);assert.equal(p.draft.capacityMin,120);assert.ok(p.draft.items.some(x=>x.date===null));}
   await page.locator('[data-proposal="'+p.id+'"]').screenshot({path:path.join(out,'deepseek-live-'+kind+'.png')});
   await page.locator('[data-proposal="'+p.id+'"] [data-enh="proposal-accept"]').click();
   const saved=await read();assert.equal(saved.proposals.find(x=>x.id===p.id).status,'accepted');assert.deepEqual(saved.sessions,before.sessions);
   if(kind==='week')assert.equal(saved.tasks.length,before.tasks.length);
  }
  item.ok=true;
 }catch(e){item.error=e.message;item.modelResponse=await page.evaluate(()=>window.liveResponses.at(-1)).catch(()=>null);}
 item.elapsedSeconds=Number(((Date.now()-start)/1000).toFixed(1));results.push(item);console.log((item.ok?'PASS ':'FAIL ')+kind+' '+item.elapsedSeconds+'s'+(item.error?' '+item.error:''));
}
(async()=>{
 const source=path.join(process.env.LOCALAPPDATA,'TPlanV3/tplan.sqlite3');
 python(`import sqlite3,json,sys
src=sqlite3.connect('file:'+sys.argv[1].replace('\\\\','/')+'?mode=ro',uri=True)
state=json.loads(src.execute("select value from storage where key='tplan.v3'").fetchone()[0])
config=state.get('settings',{}).get('agent',{})
assert config.get('modelId')=='deepseek-chat', 'Configured model changed; inspect before making live requests'
assert config.get('baseUrl','').rstrip('/') in ('https://api.deepseek.com','https://api.deepseek.com/v1'), 'Configured endpoint changed; inspect before requests'
secret=src.execute("select value from storage where key='secret'").fetchone()
assert secret and secret[0], 'No configured API key'
test=json.loads(sys.stdin.buffer.read().decode('utf-8'));test['settings']['agent']=config
dst=sqlite3.connect(sys.argv[2]);dst.execute('create table storage(key text primary key,value text not null,updated_at text not null)')
dst.execute("insert into storage values('tplan.v3',?,datetime('now'))",(json.dumps(test,ensure_ascii=False),))
dst.execute("insert into storage values('secret',?,datetime('now'))",(secret[0],));dst.commit();dst.close();src.close()`,[source,path.join(root,'tplan.sqlite3')],JSON.stringify(P.normalize(seed)));
 app=spawn(exe,[],{env:{...process.env,TPLAN_V3_DATA_DIR:root,TPLAN_V3_QA:'1',WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9351'},stdio:'ignore',windowsHide:true});
 for(let i=0;i<60;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9351');break;}catch{await new Promise(r=>setTimeout(r,250));}}if(!browser)throw Error('QA WebView2 did not start');
 page=browser.contexts()[0].pages()[0];await page.locator('#nav [data-go="assistant"]').waitFor();page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>{window.liveResponses=[];chrome.webview.addEventListener('message',e=>{if(e.data?.kind==='ai-response')window.liveResponses.push(e.data);});});
 for(const kind of requested)await generate(kind);
 assert.deepEqual(errors,[]);
})().catch(e=>{errors.push(e.message);console.error(e.message);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close().catch(()=>{});if(app)await new Promise(r=>{app.once('exit',r);app.kill();});
 // Remove the copied encrypted credential once the QA process is no longer using it.
 if(fs.existsSync(path.join(root,'tplan.sqlite3')))python("import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('pragma secure_delete=on'); c.execute(\"delete from storage where key='secret'\"); c.commit(); c.execute('pragma wal_checkpoint(truncate)'); c.close()",[path.join(root,'tplan.sqlite3')]);
 const report={at:new Date().toISOString(),model:'deepseek-chat',endpoint:'https://api.deepseek.com',executable:exe,results,errors,isolatedData:root,credentialCopyRemoved:true};
 const target=path.join(out,'deepseek-live-results-'+Date.now()+'.json');fs.writeFileSync(target,JSON.stringify(report,null,2));console.log('RESULT '+target);if(results.some(x=>!x.ok)||errors.length)process.exitCode=1;
});
