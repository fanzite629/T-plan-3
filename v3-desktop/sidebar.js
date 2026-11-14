/* Sidebar controls use the existing app state, task actions and timer. */
const sideNavGroups=[['日常',['today','timer','week','schedule']],['整理与规划',['assistant','tree','review']]];
const sideIcon=(key)=>key==='assistant'?'<svg class="i robot-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6V3"/><circle cx="12" cy="2.5" r="1" fill="currentColor" stroke="none"/><rect x="4" y="6" width="16" height="14" rx="4"/><path d="M4 11H2v5h2M20 11h2v5h-2"/><rect x="7.5" y="10" width="2.5" height="3.5" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="10" width="2.5" height="3.5" rx="1.2" fill="currentColor" stroke="none"/><path d="M9 16.5h6"/></svg>':svg(NAV.find(x=>x[0]===key)?.[2]||'plus');
function sidebarLayout(){
 const compact=!!S.settings.sidebarCompact;
 document.body.classList.toggle('c',compact);
 const control=$('#sbClose'),mobile=innerWidth<=760;
 control.title=mobile?'关闭导航':'完全隐藏侧边栏 (Ctrl+B)';
 control.setAttribute('aria-label',mobile?'关闭导航':compact?'展开侧边栏':'收起侧边栏');
 control.setAttribute('aria-expanded',String(mobile?document.body.classList.contains('nav-open'):!compact));
 $('#sbOpen').hidden=mobile||!compact;
 $('#sbOpen').setAttribute('aria-expanded','false');
 $('#side').inert=mobile?!document.body.classList.contains('nav-open'):compact;
 sidebarWidthPreview(sidebarStoredWidth());
 const handle=$('#sidebarResize');if(handle)handle.hidden=mobile||compact;
 $('#menuBtn').setAttribute('aria-expanded',String(document.body.classList.contains('nav-open')));
}
renderNav=function(){
 sidebarLayout();
 const pending=(S.proposals||[]).filter(p=>p.status==='pending').length;
 const remaining=S.tasks.filter(t=>!t.done&&t.date&&t.date<=today()).length;
 $('#nav').innerHTML=sideNavGroups.map(([label,keys])=>`<div class="side-nav-group"><div class="side-section-title">${label}</div>${keys.map(k=>{const name=NAV.find(x=>x[0]===k)[1],count=k==='assistant'?pending:k==='today'?remaining:0;return `<button class="nav ${view===k?'on':''}" data-go="${k}" aria-label="${name}" title="${name}${count?' · '+count+(k==='assistant'?' 份待确认草稿':' 项待办'):''}" ${view===k?'aria-current="page"':''}>${sideIcon(k)}<span class="side-nav-label">${name}</span>${count?`<span class="side-count" aria-hidden="true">${count>99?'99+':count}</span>`:''}</button>`;}).join('')}</div>`).join('');
 sidebarTimer();
};
function sidebarTaskItem(x){const now=today(),main=S.main[now];const dateText=x.date===null?'未定 · '+md(x.week)+'这一周':x.date<now&&!x.done?'逾期 · '+md(x.date):x.date===now?'今天':dayLabel(x.date);return `<div class="item ${x.done?'done':''} ${x.pin?'pinned':''}" draggable="true" data-id="${x.id}" tabindex="0" role="button" aria-label="${esc(x.title)}，${esc(dateText)}，预计 ${x.est} 分钟" title="${esc(x.title)}\n${esc(dateText)} · ${x.est} 分钟 · 可拖动或用 Alt+方向键排序"><span class="grip" aria-hidden="true">⋮</span><button class="dot ${x.check?'chk':''}" data-ck="${x.id}" aria-label="${x.done?'取消完成':'标记完成'}" title="${x.done?'取消完成':'标记完成'}"><span>${x.done?'✓':''}</span></button><span class="side-item-copy"><span class="nm">${esc(x.title)}</span><span class="side-item-meta ${x.date&&x.date<now&&!x.done?'overdue':''}">${esc(dateText)}<span aria-hidden="true"> · </span>${x.est}′${main===x.id?' · 主任务':''}</span></span><button class="pin" data-pin="${x.id}" aria-label="${x.pin?'取消置顶':'置顶'}" title="${x.pin?'取消置顶':'置顶'}">${svg('pin')}</button></div>`;};
renderSide=function(){
 const now=today(),main=S.main[now],visible=S.tasks.filter(x=>!sidebarSectionForTask(x)),pinned=visible.filter(x=>x.pin&&!(x.done&&x.date<now)),td=visible.filter(x=>!x.pin&&(x.date===now||(x.date<now&&!x.done))),later=visible.filter(x=>!x.pin&&(x.date>now||x.date===null&&!x.done));
 td.sort((a,b)=>(b.id===main)-(a.id===main)||a.done-b.done);
 later.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||S.tasks.indexOf(a)-S.tasks.indexOf(b));
 const item=sidebarTaskItem;
 const group=(key,label,arr,empty,defaultOpen)=>{const open=S.settings.sidebarGroups?.[key]??defaultOpen;return `<div class="side-task-group"><button class="side-group-toggle" data-sb="group" data-group="${key}" aria-expanded="${open}" aria-controls="side-group-${key}"><svg class="i side-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg><span>${label}</span><span class="side-group-count">${key==='T'?arr.filter(x=>x.done).length+'/'+arr.length:arr.length}</span></button><div class="grp" data-g="${key}" id="side-group-${key}" ${open?'':'hidden'}>${arr.map(item).join('')||`<p class="side-empty">${empty}</p>`}</div></div>`;};
 $('#groups').innerHTML=group('P','置顶',pinned,'点任务右侧图钉，放在这里。',pinned.length>0)+group('T','今天',td,'今天还没有任务。点上方“新建任务”开始。',true)+group('L','之后与未定',later,'暂时没有后续安排。',later.length>0);
}
function sidebarTimer(){
 const box=$('#sideFocus'),a=S.active;if(!box)return;
 box.hidden=!a;if(!a){box.dataset.snapshot='';return;}
 const phase={running:'正在专注',paused:'已暂停',due:'时间到了',ended:'等待收尾'}[a.phase]||'计时';
 const key=JSON.stringify([a.id,a.title,a.phase,a.mode]);
 const time=a.phase==='ended'?'待收尾':a.phase==='due'?'时间到':clock(a.mode==='down'?a.budget-el(a,Date.now()):el(a,Date.now()));
 if(box.dataset.snapshot!==key){
  box.dataset.snapshot=key;box.className='side-focus '+a.phase;
  box.innerHTML=`<button class="side-focus-main" data-go="timer" aria-label="查看当前计时" title="${esc(a.title)} · ${phase}，点击查看"><span class="side-focus-label"><i aria-hidden="true"></i>${phase}</span><strong class="side-focus-time num">${time}</strong><span class="side-focus-title">${esc(a.title)}</span></button><div class="side-focus-actions">${['running','paused'].includes(a.phase)?`<button data-sb="timer-toggle" aria-label="${a.phase==='paused'?'继续':'暂停'}当前计时">${a.phase==='paused'?'继续':'暂停'}</button>`:''}${a.phase!=='ended'?'<button data-act="t-pip" aria-label="打开计时小窗">小窗 ↗</button>':'<button data-go="timer">去收尾 →</button>'}</div>`;
 }else{const timeEl=box.querySelector('.side-focus-time');if(timeEl.textContent!==time)timeEl.textContent=time;}
}
const tickBeforeSidebar=tick;
tick=function(){tickBeforeSidebar();sidebarTimer();const status=$('#saveState'),message=storageOK?'已保存在本机':'保存失败，请导出备份';if(status&&status.textContent!==message)status.textContent=message;$('.side-storage')?.classList.toggle('failed',!storageOK);};
toggleSide=function(){
 if(innerWidth<=760){document.body.classList.toggle('nav-open');sidebarLayout();return;}
 try{planChange(s=>{s.settings.sidebarCompact=!s.settings.sidebarCompact;});sidebarLayout();$(S.settings.sidebarCompact?'#sbOpen':'#sbClose').focus();}catch(e){toast(e.message);}
};
window.addEventListener('resize',()=>sidebarLayout());
function sidebarMaxWidth(){return Math.min(440,Math.max(224,innerWidth-460));}
function sidebarStoredWidth(){return Number.isFinite(S.settings.sidebarWidth)?S.settings.sidebarWidth:284;}
function sidebarWidthPreview(width){const value=Math.round(Math.max(224,Math.min(sidebarMaxWidth(),width)));document.documentElement.style.setProperty('--sidebar-width',value+'px');const handle=$('#sidebarResize');if(handle){handle.setAttribute('aria-valuenow',String(value));handle.setAttribute('aria-valuemax',String(sidebarMaxWidth()));handle.setAttribute('aria-valuetext',value+' 像素');}return value;}
function sidebarSaveWidth(width){try{const value=sidebarWidthPreview(width);planChange(s=>{s.settings.sidebarWidth=value;});}catch(e){sidebarWidthPreview(sidebarStoredWidth());toast('宽度未保存：'+e.message);}}
const sidebarResize=document.createElement('div');sidebarResize.id='sidebarResize';sidebarResize.tabIndex=0;sidebarResize.setAttribute('role','separator');sidebarResize.setAttribute('aria-label','调整侧边栏宽度');sidebarResize.setAttribute('aria-orientation','vertical');sidebarResize.setAttribute('aria-valuemin','224');sidebarResize.setAttribute('aria-controls','side');sidebarResize.title='左右拖动调节宽度 · 双击恢复默认 · 方向键微调';$('.app').append(sidebarResize);
let sidebarDrag=null;
sidebarResize.addEventListener('pointerdown',e=>{if(e.button!==0||innerWidth<=760||S.settings.sidebarCompact)return;e.preventDefault();sidebarDrag={pointer:e.pointerId,startX:e.clientX,startWidth:$('#side').getBoundingClientRect().width};sidebarResize.setPointerCapture(e.pointerId);document.body.classList.add('resizing-sidebar');});
sidebarResize.addEventListener('pointermove',e=>{if(sidebarDrag?.pointer!==e.pointerId)return;sidebarWidthPreview(sidebarDrag.startWidth+e.clientX-sidebarDrag.startX);});
function sidebarDragEnd(e,cancel){if(sidebarDrag?.pointer!==e.pointerId)return;const width=sidebarDrag.startWidth+e.clientX-sidebarDrag.startX;sidebarDrag=null;document.body.classList.remove('resizing-sidebar');if(sidebarResize.hasPointerCapture(e.pointerId))sidebarResize.releasePointerCapture(e.pointerId);cancel?sidebarWidthPreview(sidebarStoredWidth()):sidebarSaveWidth(width);}
sidebarResize.addEventListener('pointerup',e=>sidebarDragEnd(e,false));sidebarResize.addEventListener('pointercancel',e=>sidebarDragEnd(e,true));sidebarResize.addEventListener('lostpointercapture',()=>{if(sidebarDrag){sidebarDrag=null;document.body.classList.remove('resizing-sidebar');sidebarWidthPreview(sidebarStoredWidth());}});
sidebarResize.addEventListener('dblclick',()=>sidebarSaveWidth(284));
sidebarResize.addEventListener('keydown',e=>{const width=Number(sidebarResize.getAttribute('aria-valuenow')),delta=e.shiftKey?40:16;const next={ArrowLeft:width-delta,ArrowRight:width+delta,Home:224,End:sidebarMaxWidth()}[e.key];if(next===undefined)return;e.preventDefault();sidebarSaveWidth(next);});
function sidebarNewTask(){
 openDlg(`<h2>新建任务</h2><p class="sub">先写清楚下一步要做什么。</p><form id="sidebarTaskForm" class="form"><label class="f">任务名称<input class="in" id="sideNewTitle" maxlength="150" required placeholder="例如：读完第三章的两页课件" autocomplete="off"></label><div class="grid2"><label class="f">日期<input class="in" type="date" id="sideNewDate" value="${today()}"></label><label class="f">预计分钟<input class="in" type="number" id="sideNewMinutes" value="30" min="1" max="1440" required></label></div><label class="check"><input type="checkbox" id="sideNewUndated">暂不定日期，放进本周未定</label><div class="grid2"><label class="f">分类<select class="in" id="sideNewCategory"><option value="auto">按标题识别</option>${CHOICES.map(c=>`<option value="${c}">${catLabel(c)}</option>`).join('')}</select></label><label class="check"><input type="checkbox" id="sideNewPin">置顶这个任务</label></div><p class="plan-error" id="sideNewError" role="alert" hidden></p><div class="dlgfoot"><button class="btn" type="button" data-act="dlg-close">取消</button><button class="btn acc" type="submit">添加任务</button></div></form>`);
 $('#sideNewTitle').focus();
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-sb]');if(!button)return;e.preventDefault();e.stopImmediatePropagation();try{
 const action=button.dataset.sb;
 if(action==='create'){sidebarNewTask();return;}
 if(action==='group'){
  const group=button.dataset.group,open=button.getAttribute('aria-expanded')!=='true';
  planChange(s=>{s.settings.sidebarGroups={...s.settings.sidebarGroups,[group]:open};});
  button.setAttribute('aria-expanded',String(open));$('#side-group-'+group).hidden=!open;return;
 }
 if(action==='timer-toggle'){const phase=S.active?.phase;if(phase==='paused')tctl('resume');else if(phase==='running')tctl('pause');}
 }catch(err){toast(err.message);}},true);
document.addEventListener('change',e=>{if(e.target.id==='sideNewUndated'){$('#sideNewDate').disabled=e.target.checked;}},true);
document.addEventListener('click',e=>{if(e.target.closest('#menuBtn,#scrim'))sidebarLayout();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')sidebarLayout();});
document.addEventListener('keydown',e=>{if(e.target.closest?.('#sidebarTaskForm')&&e.key==='Enter'&&e.isComposing){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('submit',e=>{if(e.target.id!=='sidebarTaskForm')return;e.preventDefault();e.stopImmediatePropagation();try{
 const title=$('#sideNewTitle').value.trim(),min=Number($('#sideNewMinutes').value),undated=$('#sideNewUndated').checked,date=$('#sideNewDate').value,cat=$('#sideNewCategory').value;
 if(!title)throw new Error('先写下任务名称。');if(!Number.isInteger(min)||min<1||min>1440)throw new Error('预计时长请填 1–1440 的整数。');if(!undated&&!PC.validDate(date))throw new Error('请选择有效日期，或者勾选暂不定日期。');
 const created=newTask({title,date:undated?null:date,week:weekStart(today()),est:min,cat:cat==='auto'?catOf(title):cat,pin:$('#sideNewPin').checked});
 const section=$('#sideNewSection')?.value;if(section){if(!SC.sections(S).some(x=>x.id===section))throw new Error('分区已不存在，请重新选择');created.sectionId=section;}planChange(s=>s.tasks.push(created));closeDlg();renderNav();renderSide();if(view==='week')render();if(view==='today')refreshPanel();toast(undated?'已添加到本周未定':'已添加到 '+dayLabel(date));
 }catch(err){const box=$('#sideNewError');box.textContent=err.message;box.hidden=false;}},true);
