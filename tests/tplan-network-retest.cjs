'use strict';
// Bounded retest of the corrected native host, only after an explicit release freeze.
// Uses the already authorized native virtual HTTPS origin; never navigates file://.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
let source = fs.readFileSync(path.join(__dirname, 'tplan-desktop.cjs'), 'utf8').split('async function main(){')[0];
source = source.replace("env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port='+port", "env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port='+port+' --log-net-log='+path.join(out,'netlog.json')+' --net-log-capture-mode=Default'");
source += `
async function retest(){
 let run;
 try {
  run=await launch(executable,true); const connection=await attach(run),p=connection.page;
  await check('N1 修复宿主真实启动、品牌及原生存储恢复',async()=>{
   assert.equal(p.url(),'https://tplan.local/index.html');
   assert.equal(await p.locator('nav [data-page]').count(),5);
   assert.equal(await state(p),null);
   const seed=fs.readFileSync(path.join(__dirname,'desktop-evidence','native-1788790835858','native-roundtrip.json'),'utf8');
   await upload(p,seed); assert.deepEqual(await state(p),JSON.parse(seed).data);
   await connection.context.setOffline(true); await p.reload(); await p.locator('#app h1').waitFor();
   assert.deepEqual(await state(p),JSON.parse(seed).data);
   await p.screenshot({path:path.join(out,'corrected-native-content.png'),fullPage:true});
   return {exeSha256:crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex').toUpperCase(),offlineScope:'CDP simulation after first load including reload'};
  });
  await delay(4000); await close(run); run=null;
 } finally { if(run)await close(run).catch(e=>report.results.push({name:'cleanup',status:'FAIL',error:e.message})); }
 await check('N2 启动全过程 NetLog 无实际网络连接/隧道/发送',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(out,'netlog.json'),'utf8'));
  const types=Object.fromEntries(Object.entries(data.constants.logEventTypes).map(([k,v])=>[v,k]));
  const events=data.events.map(e=>({...e,typeName:types[e.type]}));
  const connect=events.filter(e=>e.phase===1 && ['TCP_CONNECT','TCP_CONNECT_ATTEMPT','UDP_CONNECT'].includes(e.typeName));
  const send=events.filter(e=>/SEND_TUNNEL_HEADERS|SEND_REQUEST_HEADERS|UDP_BYTES_SENT|SOCKET_BYTES_SENT|DNS_TRANSACTION_QUERY/.test(e.typeName));
  const unexpectedUrls=events.filter(e=>typeof e.params?.url==='string'&&!e.params.url.startsWith('https://tplan.local/')&&!/^(blob:|data:|about:|http:\\/\\/(127\\.|localhost))/.test(e.params.url));
  const cmd=data.constants.clientInfo.command_line;
  report.netLog={eventCount:events.length,commandLine:cmd,connectionBegins:connect,sendEvents:send,unexpectedUrls,scope:'One corrected-host isolated startup through normal close; not an OS-wide lifetime capture'};
  fs.writeFileSync(path.join(out,'netlog-summary.json'),JSON.stringify(report.netLog,null,2));
  assert.ok(cmd.includes('--host-resolver-rules="MAP * ^NOTFOUND"'),'Correct quoted Chromium failure sentinel must reach actual process');
  assert.ok(cmd.includes('--no-proxy-server'),'Process must not inherit system proxy');
  assert.deepEqual(connect,[]); assert.deepEqual(send,[]); assert.deepEqual(unexpectedUrls,[]);
  return {eventCount:events.length,connectionBegins:0,sendEvents:0,unexpectedUrls:0};
 });
}
retest().catch(e=>{if(!report.results.some(x=>x.error===e.stack))report.results.push({name:'runner',status:'FAIL',error:e.stack});}).finally(()=>{
 for(const child of owned.values())if(child.exitCode===null)child.kill();
 report.finishedAt=new Date().toISOString();report.passed=report.results.filter(x=>x.status==='PASS').length;report.failed=report.results.filter(x=>x.status==='FAIL').length;
 fs.writeFileSync(path.join(out,'network-retest-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.passed,failed:report.failed,results:report.results},null,2));process.exitCode=report.failed?1:0;
});
`;
const filename=path.join(__dirname,'tplan-network-retest-generated.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(source,filename);
