/* Native companion integration. All task writes reuse the existing draft confirmation flow. */
function petCommand(action){if(nativeMiniTimer)chrome.webview.postMessage({kind:'pet-control',action});}
function petEntry(){
 const foot=$('.sidefoot');if(!foot||$('#petEntry'))return;
 const b=document.createElement('button');b.id='petEntry';b.className='side-settings';b.type='button';b.title='打开橙橙桌宠与学习助理';b.setAttribute('aria-label','桌宠与学习助理');
 b.innerHTML='<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9c-4-5-5 3-2 6 1 5 5 6 8 6s7-1 8-6c3-3 2-11-2-6-3-2-9-2-12 0Z"/><path d="M8 13h.01M16 13h.01M10 17h4"/></svg><span>桌宠与助理</span>';
 b.addEventListener('click',()=>petCommand('panel'));foot.prepend(b);
}
const renderNavBeforeCompanion=renderNav;
renderNav=function(){renderNavBeforeCompanion();petEntry();};
window.tplanPetContext=function(){
 const d=today(),ws=weekStart(d),sessions=S.sessions.filter(x=>x.date===d);
 const tasks=S.tasks.filter(x=>!x.done).slice().sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice(0,30).map(x=>({id:x.id,title:x.title,date:x.date,week:x.week,minutes:x.est,category:x.cat,next:x.next||''}));
 const entry=S.reviewEntries?.['day:'+d];
 return {today:d,weekStart:ws,tasks,todayRecords:sessions.map(x=>({title:x.title,minutes:x.minutes,note:x.note||''})),recordedMinutes:sessions.reduce((a,b)=>a+(Number(b.minutes)||0),0),weekFocus:S.weekPlans?.[ws]?.focus||'',timer:desktopTimerState(),reflection:entry?{reflection:entry.reflection||'',next:entry.next||''}:null};
};
window.tplanPetDraft=function(raw,requestId,prompt){
 try{
  if(typeof requestId!=='string'||!/^pet_[a-zA-Z0-9_-]{1,100}$/.test(requestId))throw Error('草稿标识无效');
  let p=S.proposals.find(x=>x.petRequestId===requestId);
  if(!p){
   const d=PC.validateDraft(raw,{kind:'tasks',today:today(),tasks:S.tasks});
   if(d.items)for(const it of d.items)if(!it.date&&!it.week)it.week=weekStart(today());
   p=PC.createProposal(PC.clone(S),d,{source:'ai',model:ag().modelId||'',prompt:String(prompt||'').slice(0,4000)});
   p.petRequestId=requestId;
   planChange(s=>{s.proposals.push(p);s.ui.selectedProposal=p.id;s.ui.assistantRequestFocus=true;});
  }else{S.ui.selectedProposal=p.id;S.ui.assistantRequestFocus=true;}
  go('assistant');return {ok:true,id:p.id,status:p.status};
 }catch(e){return {ok:false,error:e.message};}
};
