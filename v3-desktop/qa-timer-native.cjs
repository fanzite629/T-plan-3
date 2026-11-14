// Isolated, visible native window fixture for the desktop UI acceptance pass.
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'output/playwright'),root=path.join(out,'timer-native-'+Date.now());fs.mkdirSync(root,{recursive:true});
const app=spawn(path.resolve(__dirname,'package/T计划 v3.exe'),[],{windowsHide:true,stdio:'ignore',env:{...process.env,TPLAN_V3_QA:'1',TPLAN_V3_DATA_DIR:root,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9364'}});
let browser;
(async()=>{for(let n=0;n<80;n++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9364');if(browser.contexts()[0]?.pages().length)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const page=browser.contexts()[0].pages()[0];await page.locator('#nav [data-go="timer"]').waitFor();
 await page.locator('#nav [data-go="timer"]').click();await page.locator('#tTitle').fill('验收：黑白灰计时小窗');await page.locator('[data-act="t-start"]').click();await page.locator('[data-act="t-pause"]').click();await page.getByRole('button',{name:'小窗',exact:true}).click();
 fs.writeFileSync(path.join(out,'timer-native-ready.json'),JSON.stringify({root,pid:app.pid,port:9364,exeSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'package/T计划 v3.exe'))).digest('hex')}));
 console.log('NATIVE READY '+root);await browser.close();browser=null;
 // The child process keeps the fixture available until explicitly closed after manual acceptance.
})().catch(e=>{console.error(e);app.kill();process.exitCode=1;});
