'use strict';
// One bounded native startup for an owned-window image and optional NetLog observation.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
let source=fs.readFileSync(path.join(__dirname,'tplan-desktop.cjs'),'utf8').split('async function main(){')[0];
source=source.replace("env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port='+port","env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port='+port+' --log-net-log='+path.join(out,'netlog.json')+' --net-log-capture-mode=Default'");
source+=`
async function supplement(){let run;try{
 run=await launch(executable,true);const connection=await attach(run),p=connection.page;
 const seed=fs.readFileSync(path.join(__dirname,'desktop-evidence','native-1788790835858','native-roundtrip.json'),'utf8');await upload(p,seed);await nav(p,'today');await p.locator('#status').waitFor({state:'hidden',timeout:6000});
 const windowFile=path.join(out,'native-owned-window.png'),q=s=>"'"+s.replaceAll("'","''")+"'";
 try{ps('& ([scriptblock]::Create([IO.File]::ReadAllText('+q(path.join(__dirname,'tplan-window-shot.ps1'))+',[Text.Encoding]::UTF8))) -TPlanPid '+run.child.pid+' -OutputPath '+q(windowFile));report.ownedWindowImage=windowFile;}catch(e){report.ownedWindowImage='NOT VERIFIED PrintWindow: '+e.message;}
 await p.screenshot({path:path.join(out,'native-content.png'),fullPage:true});await nav(p,'dashboard');await nav(p,'records');await delay(2500);assert.deepEqual(await state(p),JSON.parse(seed).data);await close(run);run=null;
 await check('ZIP原生短窗口：重用真实导出JSON后界面可用、退出进程',()=>({exe:executable,ownedWindow:report.ownedWindowImage}));
 try{const data=JSON.parse(fs.readFileSync(path.join(out,'netlog.json'),'utf8')),types=Object.fromEntries(Object.entries(data.constants.logEventTypes).map(([name,id])=>[id,name]));const urls=[],endpoints=[];
 for(const event of data.events){const params=event.params||{},type=types[event.type];if(typeof params.url==='string'&&!['https://tplan.local/','blob:','data:','about:','http://127.0.0.1:','http://localhost:'].some(prefix=>params.url.startsWith(prefix)))urls.push({type,url:params.url});if(/TCP_CONNECT|UDP_CONNECT|SOCKET_ALIVE/.test(type)){for(const key of ['address','remote_address','endpoint'])if(typeof params[key]==='string'&&!/^(127\\.|\\[?::1(?:\\]|:|$)|0\\.0\\.0\\.0)/.test(params[key]))endpoints.push({type,[key]:params[key]});}}
 report.netLog={status:'OBSERVED',events:data.events.length,externalUrls:urls,nonLoopbackEndpoints:endpoints,scope:'One short synthetic-profile startup; not a proof of all Windows background networking'};
 }catch(e){report.netLog={status:'NOT VERIFIED',reason:e.message};}
}finally{if(run)await close(run).catch(()=>{});}}
supplement().catch(e=>report.results.push({name:'supplement',status:'FAIL',error:e.stack})).finally(()=>{for(const child of owned.values())if(child.exitCode===null)child.kill();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'supplement-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,results:report.results,netLog:report.netLog,ownedWindow:report.ownedWindowImage},null,2));process.exitCode=report.results.some(x=>x.status==='FAIL')?1:0;});
`;
const filename=path.join(__dirname,'tplan-native-supplement-generated.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(source,filename);
