'use strict';
// Test-only loopback preview: exact runtime allowlist, no directory or data access.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const allowed=new Set(['index.html','style.css','courses.js','calendar.js','core.js','dashboard-data.js','dashboard-view.js','app.js','task-timer.js','task-timer-view.js','task-timer.css','T成长_V1.1_单文件.html','T成长_V1.2_单文件.html','T计划_V1.3_单文件.html']);
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1)||'index.html';}catch{res.writeHead(400);return res.end();}
 if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)){res.writeHead(404);return res.end('Not found');}
 try{const content=fs.readFileSync(path.join(root,name));res.writeHead(200,{'Content-Type':types[path.extname(name)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1',()=>console.log('T成长 test preview: http://127.0.0.1:'+server.address().port+'/index.html'));
