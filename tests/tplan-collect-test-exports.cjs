'use strict';
// Collect only exports created by failed native QA filename attempts; never other user JSON.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const evidence=path.join(__dirname,'desktop-evidence'),out=path.join(evidence,'collected-default-exports');fs.mkdirSync(out,{recursive:true});
const ps=s=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);'+s],{encoding:'utf8',windowsHide:true});
const q=s=>"'"+s.replaceAll("'","''")+"'",documents=JSON.parse(ps("[Environment]::GetFolderPath('MyDocuments') | ConvertTo-Json -Compress"));
const fixture=JSON.parse(fs.readFileSync(path.join(evidence,'native-1788790835858','native-roundtrip.json'),'utf8')).data;
const runs=fs.readdirSync(evidence).filter(n=>/^native-\d+$/.test(n)).map(n=>{try{return{directory:n,...JSON.parse(fs.readFileSync(path.join(evidence,n,'native-results.json'),'utf8'))};}catch{return null;}}).filter(Boolean);
const collected=[];
for(const filename of fs.readdirSync(documents).filter(n=>/^T计划_数据备份_20260907-\d{6}\.json$/.test(n))){
 const source=path.join(documents,filename),stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink())continue;
 const run=runs.find(r=>stat.birthtimeMs>=Date.parse(r.startedAt)&&stat.birthtimeMs<=Date.parse(r.finishedAt)&&r.results.some(x=>x.name.startsWith('W5')));if(!run)continue;
 let envelope;try{envelope=JSON.parse(fs.readFileSync(source,'utf8'));assert.equal(envelope.schemaVersion,3);assert.equal(envelope.data.tasks.length,1);assert.equal(envelope.data.logs.length,1);const expected=structuredClone(fixture),taskId=envelope.data.tasks[0].id,logId=envelope.data.logs[0].id;expected.tasks[0].id=taskId;expected.logs[0].id=logId;expected.logs[0].taskId=taskId;expected.mainByDate['2026-09-07']=taskId;assert.deepEqual(envelope.data,expected);}catch{continue;}
 const destination=path.join(out,filename);assert.equal(fs.existsSync(destination),false);assert.ok(path.resolve(source).startsWith(path.resolve(documents)+path.sep));assert.ok(path.resolve(destination).startsWith(path.resolve(evidence)+path.sep));
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').toUpperCase();ps('Move-Item -LiteralPath '+q(source)+' -Destination '+q(destination));
 collected.push({filename,matchedRun:run.directory,destination,sha256,wholeStateEqualsNativeFixture:true,generatedIdsAreRunSpecific:true});
}
fs.writeFileSync(path.join(out,'collection.json'),JSON.stringify({collected,onlyNewMatchingSyntheticExportsMoved:true},null,2));console.log(JSON.stringify({collected:collected.length,output:out}));
