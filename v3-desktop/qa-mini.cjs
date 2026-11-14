const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const step=process.argv[2]||'start';
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9348');
 const p=b.contexts()[0].pages()[0];
 await p.waitForFunction(()=>typeof window.tplanDesktopPoll==='function');
 const read=()=>p.evaluate(()=>JSON.parse(chrome.webview.hostObjects.sync.database.Read('tplan.v3')));
 if(step==='start') {
  await p.getByRole('button',{name:'计时',exact:true}).first().click();
  await p.locator('#tTitle').fill('小窗验收：中文任务与主窗口同步');
  await p.getByRole('button',{name:'开始',exact:true}).click();
  await p.getByRole('button',{name:'小窗',exact:true}).click();
  assert.equal((await read()).active.phase,'running');
 } else if(step==='reopen') {
  await p.locator('#nav [data-go="timer"]').click();
  await p.getByRole('button',{name:'小窗',exact:true}).click();
  await p.waitForTimeout(500);
 } else if(step==='paused') {
  const a=(await read()).active; assert.equal(a.phase,'paused');
  await p.waitForTimeout(1600); assert.equal((await read()).active.acc,a.acc);
 } else if(step==='running') { assert.equal((await read()).active.phase,'running');
 } else if(step==='added') { assert.equal((await read()).active.budget,30*60000);
 } else if(step==='ended') {
  assert.equal((await read()).active.phase,'ended'); await p.locator('#wMin').waitFor();
  await p.locator('#wMin').fill('2'); await p.getByRole('button',{name:'保存这段时间',exact:true}).click();
  const s=await read(); assert.equal(s.active,null);assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].minutes,2);
 } else if(step==='up') {
  await p.locator('#tTitle').fill('正计时小窗验收');
  await p.getByRole('button',{name:'正计时',exact:true}).click();
  await p.getByRole('button',{name:'开始',exact:true}).click();
  await p.getByRole('button',{name:'小窗',exact:true}).click();
  assert.equal((await read()).active.mode,'up');
 } else if(step==='due-setup') {
  await p.evaluate(()=>{
   const db=chrome.webview.hostObjects.sync.database,s=JSON.parse(db.Read('tplan.v3')),now=Date.now();
   s.active={id:'qa-short-down',title:'到点和延长验收',taskId:null,cat:'other',course:null,mode:'down',budget:4000,startedAt:now,lastAt:now,acc:0,phase:'running',pauses:0,endedAt:null};
   db.Write('tplan.v3',JSON.stringify(s));
  });
  await p.reload();await p.waitForFunction(()=>typeof window.tplanDesktopPoll==='function');
  await p.getByRole('button',{name:'小窗',exact:true}).click();
  await p.waitForTimeout(5500); assert.equal((await read()).active.phase,'due');
 } else if(step==='extended') {
  const a=(await read()).active;assert.equal(a.phase,'running');assert.equal(a.budget,304000);
 } else if(step==='status') {console.log(JSON.stringify((await read()).active));}
 console.log('PASS mini integration:',step);await b.close();
})().catch(e=>{console.error(e);process.exitCode=1});
