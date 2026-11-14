'use strict';
// Independent V1 acceptance. Only temporary browser contexts and synthetic data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const out = process.env.TG_ACCEPTANCE_OUTPUT ? path.resolve(process.env.TG_ACCEPTANCE_OUTPUT) : path.join(__dirname, 'evidence');
const report = { baseline: 'T成长_运行规则与资源配置_合并方案_20260907.md §8', startedAt: new Date().toISOString(), results: [], browsers: [] };
fs.mkdirSync(out, { recursive: true });

async function check(name, fn) {
  try {
    const detail = await fn();
    report.results.push({ name, status: 'PASS', detail: detail ?? null });
    console.log(`PASS ${name}`);
  } catch (e) {
    report.results.push({ name, status: 'FAIL', error: e.stack });
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

async function launch(name, executablePath) {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai', locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-09-07T10:00:00+08:00'));
  const errors = [];
  const requests = [];
  page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console.error', text: m.text() }); });
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.locator('#app h1').waitFor();
  report.browsers.push({ name, executablePath, version: browser.version(), offline: true, url: page.url() });
  return { browser, context, page, errors, requests };
}

async function environmentCases(name, handle) {
  const { page, errors, requests } = handle;
  await check(`${name}: file:// 离线入口与页面初始化`, async () => {
    assert.ok(page.url().startsWith('file:///'));
    assert.match(await page.title(), /T成长/);
    assert.ok((await page.locator('#app').innerText()).length > 50);
    // file:// may report navigator.onLine=true even under CDP offline emulation.
    // Both contexts are explicitly offline; online flag is not a valid oracle here.
    return { contextOffline: true, navigatorOnline: await page.evaluate(() => navigator.onLine) };
  });
  await page.screenshot({ path: path.join(out, `${name}-desktop-today.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['today', 'week', 'records', 'review']) {
    await check(`${name}: 390px ${view} 页面`, async () => {
      await page.locator(`nav [data-page="${view}"]`).click();
      await page.locator('#app h1').waitFor();
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.client + 1, JSON.stringify(dimensions));
      await page.screenshot({ path: path.join(out, `${name}-390-${view}.png`), fullPage: true });
      return dimensions;
    });
  }
  await check(`${name}: 无外部网络请求/页面和控制台错误`, async () => {
    assert.deepEqual(requests.filter(r => !/^(file:|data:|blob:)/.test(r.url)), []);
    assert.deepEqual(errors, []);
    return { requestCount: requests.length, externalRequests: 0, errors: 0 };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function stateOf(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('tgrowth.v1'))); }
async function action(page, name, scope = '#app', id) {
  await page.locator(`${scope} [data-action="${name}"]${id ? `[data-id="${id}"]` : ''}`).first().click();
}
async function submit(page) { await page.locator('#dialog form button[type="submit"]').click(); await page.locator('#dialog').waitFor({state:'hidden'}); }
async function nav(page, view) { await page.locator(`nav [data-page="${view}"]`).click(); }
async function addTask(page,title,date='2026-09-07',category='english') {
  await action(page,'task-new');await page.locator('#f-title').fill(title);await page.locator('#f-date').fill(date);await page.locator('#f-category').selectOption(category);await page.locator('#f-estimatedMinutes').fill('90');await submit(page);
}
async function addLog(page,{taskId='',date='2026-09-07',minutes=20,category='english',evidence='实际验收合成成果'}) {
  if(taskId)await action(page,'log','#app',taskId);else await action(page,'log');
  await page.locator('#f-date').fill(date);await page.locator('#f-minutes').fill(String(minutes));await page.locator('#f-category').selectOption(category);await page.locator('#f-evidence').fill(evidence);await submit(page);
}

async function userPathCases(name, handle) {
  const {page,errors,requests}=handle;
  page.on('dialog',d=>d.accept());
  let ids={},exportText='',snapshot='';
  await nav(page,'today');
  await check(`${name}: 新建4任务→选1主任务→最多3重点`,async()=>{
    for(const title of ['验收英语主任务','验收数学次要','验收删除保留','验收删除全部'])await addTask(page,title);
    const s=await stateOf(page);ids=Object.fromEntries(s.tasks.map(t=>[t.title,t.id]));
    await action(page,'choose-main');await page.locator('#f-taskId').selectOption(ids['验收英语主任务']);await submit(page);
    assert.equal(await page.locator('[data-testid="main-task"]').count(),1);assert.equal(await page.locator('[data-testid="secondary-task"]').count(),2);
    assert.match(await page.locator('[data-testid="main-task"]').innerText(),/验收英语主任务/);
  });
  await check(`${name}: 跨周记录40/20分钟→编辑为35→任务和周汇总一致`,async()=>{
    await addLog(page,{taskId:ids['验收英语主任务'],date:'2026-09-06',minutes:40});await addLog(page,{taskId:ids['验收英语主任务'],minutes:20});
    await nav(page,'records');let s=await stateOf(page);const log=s.logs.find(l=>l.date==='2026-09-06');await action(page,'log-edit','#app',log.id);await page.locator('#f-minutes').fill('35');await submit(page);
    s=await stateOf(page);assert.deepEqual(s.logs.map(l=>l.minutes).sort((a,b)=>a-b),[20,35]);
    const totals=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('tgrowth.v1'));return [TG.weekStats(s,'2026-09-01').actual.english,TG.weekStats(s,'2026-09-07').actual.english,TG.taskMinutes(s,s.tasks[0].id)];});assert.deepEqual(totals,[35,20,55]);
  });
  await check(`${name}: 完成主任务→刷新→保留成果且不自动补位`,async()=>{
    await nav(page,'today');await action(page,'complete','#app',ids['验收英语主任务']);await page.reload();await page.locator('[data-testid="main-task"]').waitFor();
    const s=await stateOf(page);assert.equal(s.mainByDate['2026-09-07'],ids['验收英语主任务']);assert.equal(s.tasks.find(t=>t.id===ids['验收英语主任务']).status,'done');assert.equal(s.logs.length,2);assert.match(await page.locator('[data-testid="main-task"]').innerText(),/已完成/);assert.equal(await page.locator('[data-testid="secondary-task"]').count(),2);
  });
  await check(`${name}: 任务编辑与延期到系统明天，文本按普通文本显示`,async()=>{
    await nav(page,'week');await action(page,'task-edit','#app',ids['验收数学次要']);await page.locator('#f-title').fill('验收数学 <img src=x onerror="window.BAD=1">');await page.locator('#f-evidence').fill('能复述两条担忧');await page.locator('#f-priority').selectOption('medium');await submit(page);
    await action(page,'postpone','#app',ids['验收数学次要']);const s=await stateOf(page);const t=s.tasks.find(t=>t.id===ids['验收数学次要']);assert.equal(t.date,'2026-09-08');assert.equal(t.originalDate,'2026-09-07');assert.equal(t.history.length,1);assert.equal(await page.evaluate(()=>window.BAD),undefined);assert.equal(await page.locator('#app img[src="x"]').count(),0);
  });
  await check(`${name}: 删除安排保留20分钟，与确认连同15分钟删除`,async()=>{
    await addLog(page,{taskId:ids['验收删除保留'],minutes:20});await addLog(page,{taskId:ids['验收删除全部'],minutes:15});
    await action(page,'task-delete','#app',ids['验收删除保留']);await action(page,'delete-keep','#dialog');
    let s=await stateOf(page);assert.ok(s.logs.some(l=>l.minutes===20&&l.taskId===null));
    await action(page,'task-delete','#app',ids['验收删除全部']);await action(page,'delete-all','#dialog');s=await stateOf(page);assert.equal(s.tasks.length,2);assert.equal(s.logs.length,3);assert.equal(s.logs.reduce((a,l)=>a+l.minutes,0),75);
  });
  await check(`${name}: 健身4天/120分钟预算分离，超额可保存且零目标正确`,async()=>{
    await action(page,'goals');await page.locator('#f-budget').fill('1');
    for(const id of ['school','english','math','power','fitness','stocks','other'])await page.locator(`#goal-${id}`).fill(id==='english'?'1':id==='fitness'?'4':'0');
    await page.locator('#f-fitnessMinutes').fill('2');await submit(page);
    const s=await stateOf(page);assert.equal(s.weeks['2026-09-07'].budgetMinutes,60);assert.equal(s.weeks['2026-09-07'].fitnessMinutes,120);assert.equal(s.weeks['2026-09-07'].goals.fitness,4);
    assert.match(await page.locator('#app').innerText(),/超出预算/);assert.match(await page.locator('[data-category="stocks"]').innerText(),/未设目标/);assert.doesNotMatch(await page.locator('#app').innerText(),/NaN|Infinity/);
  });
  await check(`${name}: 健康日期更新不重复，滚动均值158/160与样本2/1`,async()=>{
    await nav(page,'records');for(const [date,weight,trained] of [['2026-09-07','158',true],['2026-09-07','157',true],['2026-09-01','159',false],['2026-08-31','160',false]]){
      await action(page,'health');await page.locator('#f-date').fill(date);await page.locator('#f-weight').fill(weight);await page.locator('[name="trained"]').setChecked(trained);await submit(page);
    }
    const s=await stateOf(page);assert.equal(s.health.length,3);const text=await page.locator('#app').innerText();assert.match(text,/158\.0斤/);assert.match(text,/160\.0斤/);assert.match(text,/2\/7天有记录/);assert.match(text,/1\/7天有记录/);assert.match(text,/-2\.0斤/);
  });
  await check(`${name}: 旁听计划/重复参加单条记录，预算和投入独立`,async()=>{
    await nav(page,'week');const key='2026-09-08|power-tue';await action(page,'attendance-plan','#app',key);await page.locator('#f-minutes').fill('90');await submit(page);
    for(const minutes of ['80','85']){await action(page,'attendance-attend','#app',key);await page.locator('#f-minutes').fill(minutes);await page.locator('#f-evidence').fill('旁听一次，复述基础概念');await submit(page);}
    const s=await stateOf(page);assert.equal(s.attendance.length,1);assert.equal(s.attendance[0].plannedMinutes,90);assert.equal(s.logs.filter(l=>l.category==='power').length,1);assert.equal(s.logs.find(l=>l.category==='power').minutes,85);
  });
  await check(`${name}: 保存总结与下周目标确认应用，不改变旧目标和快照`,async()=>{
    await page.clock.setFixedTime(new Date('2026-09-13T20:00:00+08:00'));await page.reload();await nav(page,'review');await page.locator('#f-progress').fill('独立完成阅读复述');await page.locator('#f-adjustments').fill('继续英语，减少无计划查看');await page.locator('#f-outcomes').fill('下周完成3个明确结果');await action(page,'generate-review');
    const text=await page.locator('#review-text').inputValue();assert.match(text,/第1教学周/);assert.match(text,/下周正式课程/);assert.match(text,/第2教学周课程/);assert.match(text,/独立完成阅读复述/);
    await action(page,'save-review');let s=await stateOf(page);snapshot=JSON.stringify(s.reviews['2026-09-07']);const old=JSON.stringify(s.weeks['2026-09-07']);
    await action(page,'next-goals');await page.locator('#f-budget').fill('5');await page.locator('#goal-english').fill('2');await submit(page);s=await stateOf(page);assert.equal(JSON.stringify(s.weeks['2026-09-07']),old);assert.equal(JSON.stringify(s.reviews['2026-09-07']),snapshot);assert.equal(s.weeks['2026-09-14'].budgetMinutes,300);assert.equal(s.weeks['2026-09-14'].goals.english,120);
    await nav(page,'week');await action(page,'complete','#app',ids['验收数学次要']);s=await stateOf(page);assert.equal(JSON.stringify(s.reviews['2026-09-07']),snapshot);
  });
  await check(`${name}: 11周课表显示CAD待定，13周旁听冲突与边界可见`,async()=>{
    await page.locator('#week-number').fill('11');await page.locator('#week-number').dispatchEvent('change');assert.match(await page.locator('#app').innerText(),/CAD实验/);assert.match(await page.locator('#app').innerText(),/不保证可参加/);
    await page.locator('#week-number').fill('13');await page.locator('#week-number').dispatchEvent('change');const optional=page.locator('.optional');assert.equal(await optional.count(),1);assert.match(await optional.innerText(),/热力设备及辅机冲突/);
    await page.locator('#week-number').fill('1');await page.locator('#week-number').dispatchEvent('change');
  });
  await check(`${name}: 存储配额失败可见、未伪称保存且原数据不变`,async()=>{
    const before=JSON.stringify(await stateOf(page));await page.evaluate(()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
    await action(page,'task-new');await page.locator('#f-title').fill('不应被保存的任务');await page.locator('#dialog form button[type="submit"]').click();assert.match(await page.locator('#dialog .form-error').innerText(),/未保存/);assert.equal(JSON.stringify(await stateOf(page)),before);
    await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;delete window.__originalSetItem;});await action(page,'close','#dialog');
  });
  await check(`${name}: JSON真实下载→清空→预览取消→确认导入完整恢复`,async()=>{
    await page.evaluate(()=>localStorage.setItem('acceptance.otherApp','keep-me'));const before=await stateOf(page);
    await action(page,'data','.sidebar');const downloaded=page.waitForEvent('download');await action(page,'export','#dialog');const download=await downloaded;const file=path.join(out,`${name}-roundtrip.json`);await download.saveAs(file);exportText=fs.readFileSync(file,'utf8');assert.deepEqual(JSON.parse(exportText).data,before);
    await action(page,'clear','#dialog');assert.equal(await page.evaluate(()=>localStorage.getItem('tgrowth.v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('acceptance.otherApp')),'keep-me');
    const upload={name:'backup.json',mimeType:'application/json',buffer:Buffer.from(exportText)};await page.locator('#import-file').setInputFiles(upload);await page.locator('#dialog-title').filter({hasText:'导入预览'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('tgrowth.v1')),null);await action(page,'close','#dialog');assert.equal(await page.evaluate(()=>localStorage.getItem('tgrowth.v1')),null);
    await page.locator('#import-file').setInputFiles(upload);await action(page,'confirm-import','#dialog');assert.deepEqual(await stateOf(page),before);await page.reload();assert.deepEqual(await stateOf(page),before);
  });
  await check(`${name}: 损坏JSON/坏字段拒绝，不覆盖原数据`,async()=>{
    const before=JSON.stringify(await stateOf(page));for(const [filename,body] of [['broken.json','{broken'],['invalid.json',exportText.replace('"minutes": 35','"minutes": -35')]]){
      await page.locator('#import-file').setInputFiles({name:filename,mimeType:'application/json',buffer:Buffer.from(body)});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导入失败'));assert.equal(JSON.stringify(await stateOf(page)),before);
    }
  });
  await check(`${name}: Enter提交表单后可选主任务，延期后不再显示今日主任务`,async()=>{
    await nav(page,'today');await action(page,'task-new');await page.locator('#f-title').fill('键盘提交与主任务延期');await page.locator('#f-title').press('Enter');await page.locator('#dialog').waitFor({state:'hidden'});
    let s=await stateOf(page);const t=s.tasks.find(t=>t.title==='键盘提交与主任务延期');assert.ok(t);await action(page,'choose-main');await page.locator('#f-taskId').selectOption(t.id);await submit(page);await action(page,'postpone','#app',t.id);
    assert.equal(await page.locator('[data-testid="main-task"]').count(),0);s=await stateOf(page);assert.equal(s.tasks.find(x=>x.id===t.id).date,'2026-09-14');
  });
  await check(`${name}: 生成后修改复盘有提示，调整下周目标不丢失未保存复盘`,async()=>{
    await nav(page,'review');await action(page,'generate-review');await page.locator('#f-progress').fill('验收尚未保存的新进展');await action(page,'save-review');assert.match(await page.locator('#status').innerText(),/重新生成/);
    await action(page,'generate-review');const before=await page.locator('#review-text').inputValue();await action(page,'next-goals');await page.locator('#f-budget').fill('5');await submit(page);
    assert.equal(await page.locator('#f-progress').inputValue(),'验收尚未保存的新进展');assert.equal(await page.locator('#review-text').inputValue(),before);
  });
  await check(`${name}: 复制按钮遇权限拒绝后提示手动复制，完整选中文本与总结一致`,async()=>{
    const expected=await page.locator('#review-text').inputValue();
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('Synthetic permission denial','NotAllowedError'))}}));
    try{
      await action(page,'copy-review');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Ctrl+C'));
      const selectedText=await page.locator('#review-text').evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd));assert.equal(selectedText,expected);assert.ok(expected.length>100);
      return { clipboardPermissionDenied:'simulated', buttonClicked:true, fullTextSelected:true, systemClipboardWrite:'NOT RUN (preserved)' };
    } finally { await page.evaluate(()=>delete navigator.clipboard); }
  });
  await check(`${name}: 完整用户路径后零外部请求/页面错误`,async()=>{assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>!/^(file:|data:|blob:)/.test(r.url)),[]);return{externalRequests:0,errors:0};});
  await nav(page,'today');await addTask(page,'验收示例 · 阅读后复述两点','2026-09-13');
  const example=(await stateOf(page)).tasks.find(t=>t.title==='验收示例 · 阅读后复述两点');await action(page,'choose-main');await page.locator('#f-taskId').selectOption(example.id);await submit(page);
  await page.locator('#status').waitFor({state:'hidden',timeout:7000});
  await page.screenshot({path:path.join(out,`${name}-desktop-populated.png`),fullPage:true});
  await page.setViewportSize({width:390,height:844});for(const view of ['today','week','records','review']){await nav(page,view);await page.screenshot({path:path.join(out,`${name}-390-populated-${view}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));}await page.setViewportSize({width:1440,height:1000});
}

async function main() {
  for (const [name, executablePath] of [
    ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
    ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
  ]) {
    const handle = await launch(name, executablePath);
    try { await environmentCases(name, handle); await userPathCases(name,handle); }
    finally { await handle.browser.close(); }
  }
}

main().catch(e => { report.results.push({ name: 'runner', status: 'FAIL', error: e.stack }); console.error(e); }).finally(() => {
  report.finishedAt = new Date().toISOString();
  report.passed = report.results.filter(x => x.status === 'PASS').length;
  report.failed = report.results.filter(x => x.status === 'FAIL').length;
  fs.writeFileSync(path.join(out, 'acceptance-results.json'), JSON.stringify(report, null, 2), 'utf8');
  process.exitCode = report.failed ? 1 : 0;
});
