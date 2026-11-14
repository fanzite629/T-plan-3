'use strict';
// Records only explicit deliverable/runtime files. Never reads profiles or personal records.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'desktop-evidence','final-manifest.json');
const expectedExe='384C3BA306B8043A795F3A9A3DB418A31320D81FC214063FDD94C14D97E7DEF8';
const files=['index.html','style.css','core.js','courses.js','calendar.js','dashboard-data.js','dashboard-view.js','app.js','T计划_V1.3_单文件.html','desktop/TPlan.cs','desktop/out/TPlan-win-x64/T计划.exe','releases/T计划_1.3.0_Windows_x64_便携版.zip'];
if(process.env.TPLAN_INSTALLER_SHA)files.push('releases/T计划_Setup_1.3.0_x64.exe');
const manifest={recordedAt:new Date().toISOString(),scope:'Final frozen UI + native 1.3.0 deliverables; profiles and synthetic evidence are not included',files:files.map(file=>{const body=fs.readFileSync(path.join(root,file));return{file,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex').toUpperCase()};})};
assert.equal(manifest.files.find(x=>x.file.endsWith('/T计划.exe')).sha256,expectedExe);
assert.equal(manifest.files.find(x=>x.file.endsWith('.zip')).sha256,'5E6E8544A3243F1B6A90EDA1FBB3792E54F64356ADEE190DF5584BC6A723F15F');
if(process.env.TPLAN_INSTALLER_SHA)assert.equal(manifest.files.find(x=>x.file.endsWith('_x64.exe')).sha256,process.env.TPLAN_INSTALLER_SHA);
fs.writeFileSync(out,JSON.stringify(manifest,null,2));console.log(JSON.stringify({out,files:manifest.files.length,verified:true}));
