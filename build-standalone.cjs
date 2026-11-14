'use strict';
// Build-only utility; the resulting HTML needs no runtime or server.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n?/g,'\n');
const hash=text=>"'sha256-"+crypto.createHash('sha256').update(text,'utf8').digest('base64')+"'";
let html=read('index.html');
const css='\n'+read('style.css')+'\n'+read('task-timer.css')+'\n'+read('workbench.css')+'\n'+read('logicflow-vendor.css')+'\n'+read('task-map.css')+'\n'+read('workflow.css')+'\n'+read('theme-claude.css')+'\n';
if(/<\/style/i.test(css))throw new Error('CSS contains a closing style tag');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>');
html=html.replace('<link rel="stylesheet" href="task-timer.css">','');
html=html.replace('<link rel="stylesheet" href="workbench.css">','');
html=html.replace('<link rel="stylesheet" href="logicflow-vendor.css">','').replace('<link rel="stylesheet" href="task-map.css">','');
html=html.replace('<link rel="stylesheet" href="workflow.css">','');
html=html.replace('<link rel="stylesheet" href="theme-claude.css">','');
if(/<link rel="stylesheet"/.test(html))throw new Error('Unbundled stylesheet link left in HTML');
const scripts=[];
html=html.replace(/<script src="([a-z-]+\.js)" defer><\/script>/g,(_,name)=>{
 const body='\n'+read(name)+'\n';
 if(/<\/script/i.test(body))throw new Error(name+' contains a closing script tag');
 scripts.push({name,body});
 // Insert scripts at the end: the original defer contract requires the DOM first.
 return '';
});
if(scripts.length!==15)throw new Error('Expected 15 local scripts, got '+scripts.length);
const csp=`default-src 'none'; script-src ${scripts.map(s=>hash(s.body)).join(' ')}; style-src ${hash(css)}; style-src-attr 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+(">)/,'$1'+csp+'$2');
// A replacement callback preserves literal $&, $` and $' in bundled libraries.
html=html.replace('</body>',()=>scripts.map(s=>'<script>'+s.body+'</script>').join('\n')+'\n</body>');
html=html.replace('<html lang="zh-CN">','<!-- T计划 V1.3 · generated from the local source files; no personal browser records included. -->\n<html lang="zh-CN">');
// Preserve the previous entry path for users whose browser stores data by file path.
for(const name of ['T计划_V1.3_单文件.html','T成长_V1.2_单文件.html','T成长_V1.1_单文件.html']){
 const output=path.join(root,name);
 fs.writeFileSync(output,html,'utf8');
 console.log('Built '+output+' ('+Buffer.byteLength(html)+' bytes), '+scripts.length+' embedded scripts, SHA-256 CSP.');
}
