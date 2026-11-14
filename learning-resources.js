/* Local, static learning aids. Never writes business data or controls the timer. */
window.TGLearningResources=(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const template='我正在学【知识点】。原文/题目是【内容】。我的理解或尝试是【内容】。我卡在【具体位置】。请先给一个提示，不直接给完整答案；等我回答后再纠正。请标明需要回教材核对的结论。';
const cards=[
 {id:'scope',title:'不知道学什么、学到什么程度',tool:'教师 PPT＋最新教师要求',questions:['这一轮只学哪个知识点？','要求是解释、比较、计算，还是操作？','用哪道例题或练习验收？'],usage:'查看对应小节标题、定义和例题，确定本轮任务。',stop:'能说清“学什么＋完成标准”，就开始学习，不继续翻整套资料。',note:'旧年级复习材料不能当成本次考试范围的保证。'},
 {id:'textbook',title:'定义、公式条件或推导不清',tool:'教材',questions:['术语的准确含义是什么？','公式在什么条件下成立？','PPT 省略了哪一步？'],usage:'按目录查对应小节，补齐当前缺口，不从头通读。',stop:'能解释定义、适用条件或关键推导，再回到原题验证。'},
 {id:'gpt',title:'概念混淆、思路卡住或答案出错',tool:'GPT',questions:['我已理解到哪一步？','从哪一步开始不懂？','哪两个概念容易混淆？'],usage:'提供题目或原文，以及自己的理解或尝试，让 GPT 针对卡点解释、举反例、给提示或检查步骤。',stop:'能够独立解释或完成类似题，而不只是觉得回答看起来明白。',note:'GPT 的重要结论需核对教材或课件。',template},
 {id:'process',title:'文字看懂了，但想象不出动态过程',tool:'对应网课片段或过程图',questions:['数据、信号或指令怎样一步步变化？','哪个环节在脑中画不出来？','这一段视频具体要解决什么问题？'],usage:'带着一个问题看对应片段，中途暂停，自己画过程或预测下一步。',stop:'能够自行复述或画出过程，随后做题验证；不要求刷完整套课。',note:'如果连缺什么都说不清，先用 GPT 定位前置知识，而不是盲目刷课。'},
 {id:'verify',title:'感觉看懂了，但不确定是否真的会',tool:'纸笔＋教师例题或练习',questions:['关掉资料，我能讲清楚吗？','换一道类似题，我还能做吗？','错因是概念、条件、步骤，还是计算？'],usage:'独立作答后再核对；按错因返回对应工具。',stop:'满足本轮明确的完成标准。单次做对可记为“本轮通过”，不自动推断长期掌握；之后仍需回测。'},
 {id:'notes',title:'学完了，需要留下可复用的内容',tool:'纸上关键词＋一份电子主笔记',questions:['我自己的核心理解是什么？','哪个错因最值得留下？','下一次从哪里接着做？'],usage:'纸上只记关键理解、错因、待解决问题或必要推导；完整解释和来源整理到电子笔记。',stop:'下次能找到理解、例题和卡点即可，不为美化笔记延长学习。',note:'Space 可用于讨论，Obsidian 可用于最终归档。主笔记位置由你选择，不必两边同步维护。'}
];
const key='tplan.learning-resource-panel.v1';
let state={context:'',open:false,selected:'',step:'tool'},criterionText='';
function remember(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch(_){/* Session-only UI still works without storage. */}}
function body(){
 const c=cards.find(c=>c.id===state.selected);
 return `<div class="card-head"><div><span class="tt-kicker">遇到问题，再调用工具</span><h2>学习资源调度</h2></div><button type="button" data-resource="${state.open?'close':'open'}" aria-expanded="${state.open}" aria-controls="lr-content">${state.open?'收起，返回学习':'我卡住了'}</button></div>
 ${state.open?`<div id="lr-content"><ol class="lr-steps" aria-label="使用步骤"><li><button type="button" data-resource="select" aria-current="${!c&&state.step!=='verify'?'step':'false'}">1 选择当前卡点</button></li><li><button type="button" data-resource="tool" aria-current="${c&&state.step!=='verify'?'step':'false'}">2 只用一个优先工具</button></li><li><button type="button" data-resource="verify" aria-current="${state.step==='verify'?'step':'false'}">3 独立验收</button></li></ol>
 ${state.step==='verify'?verification(c):c?`<article class="lr-tool"><div class="card-head"><span class="meta">${esc(c.title)}</span><button type="button" class="small" data-resource="back">← 改选卡点</button></div><span class="tt-kicker">优先工具</span><h3 tabindex="-1" id="lr-tool-title">${esc(c.tool)}</h3><div class="lr-tool-grid"><div><h4>带着一个问题</h4><ul>${c.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul><p class="form-note">选与你有关的问题即可，不必逐项填写。</p></div><div><h4>具体怎么用</h4><p>${esc(c.usage)}</p>${c.note?`<p class="lr-caution">${esc(c.note)}</p>`:''}</div></div>${c.template?`<div class="lr-template"><div class="card-head"><h4>有明确问题时，复制后自行补充</h4><button type="button" data-resource="copy">复制提问模板</button></div><p>${esc(c.template)}</p><span class="form-note">仅复制到剪贴板，不发送笔记或打开外部工具。</span><span id="lr-copy-status" role="status" aria-live="polite"></span></div>`:''}<div class="lr-check"><h4>何时停下 · 独立验收</h4><p>${esc(c.stop)}</p><p class="form-note">对照本轮完成标准，合上资料自己讲、画或做一道题。收尾时记录成果 / 卡点与下一步，任务完成仍由你确认。</p></div></article>`:`<p class="muted">现在最需要解决哪一种问题？选一项即可。</p><div class="lr-choices">${cards.map((c,i)=>`<button type="button" data-resource="choose" data-card="${c.id}"><span class="lr-number">0${i+1}</span><span>${esc(c.title)}</span><span aria-hidden="true">↗</span></button>`).join('')}</div>`}
 <p class="form-note">工具卡不改变预算与收尾底线。到点后，沿用本轮收尾中的追加、拆小或暂缓。</p></div>`:'<p class="muted">选择当前卡点，找到一个优先工具，再靠自己验收。</p>'}
 <p class="lr-footer">不是“这个工具还没用”，而是“这个问题需要谁来解决”。</p>`;
}
function verification(c){const currentCriterion=document.querySelector('#tt-criterion')?.value??criterionText;return `<article class="lr-verification"><span class="tt-kicker">合上资料，让自己来试一次</span><h3 id="lr-verify-title" tabindex="-1">独立验收</h3><div class="lr-check"><h4>本轮完成标准</h4><p>${esc(currentCriterion||'本轮没有填写完成标准。先给自己一个能检验的小目标，例如独立做一道类似题，并解释每一步。')}</p></div><ol class="lr-verify-list"><li><b>先独立作答</b><p>收起资料与工具回答，用自己的话讲清楚、画出过程，或完成一道类似题。</p></li><li><b>再对照核验</b><p>对照本轮标准检查；如有错，分清是概念、条件、步骤还是计算，再返回对应工具。</p></li><li><b>留下这次结果</b><p>达到标准可在收尾时记为“本轮通过”；单次做对不代表长期掌握，之后仍需回测。未达到就沿用原来的卡点与下一步记录。</p></li></ol>${c?`<div class="lr-check"><h4>当前问题的停止条件</h4><p>${esc(c.stop)}</p></div>`:''}<p class="form-note">验收结果由你判断。打开这个步骤不会停止计时，也不会自动确认投入或完成任务。</p><div class="actions"><button type="button" data-resource="tool">${c?'返回工具卡':'选择一个卡点'}</button><button type="button" data-resource="return">返回计时与收尾</button></div></article>`;}
function render(context,criterion=''){
 criterionText=criterion;

 try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved?.context===context)state={context,open:saved.open===true,selected:cards.some(c=>c.id===saved.selected)?saved.selected:'',step:saved.step==='verify'?'verify':'tool'};else state={context,open:false,selected:'',step:'tool'};}catch(_){if(state.context!==context)state={context,open:false,selected:'',step:'tool'};}
 return `<section class="card lr-panel" id="learning-resources" aria-label="学习资源调度">${body()}</section>`;
}
function update(focus){remember();const panel=document.querySelector('#learning-resources');if(panel){panel.innerHTML=body();panel.querySelector(focus)?.focus({preventScroll:true});}}
async function copy(){
 const status=document.querySelector('#lr-copy-status');
 try{
  try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(template);}
  catch(_){const input=document.createElement('textarea');input.value=template;input.className='lr-copy-buffer';input.setAttribute('aria-label','提问模板');document.body.append(input);input.select();try{if(!document.execCommand('copy'))throw new Error('Copy failed');}finally{input.remove();document.querySelector('[data-resource="copy"]')?.focus({preventScroll:true});}}
  if(status)status.textContent='已复制，粘贴后填写你的具体问题。';
 }catch(_){if(status)status.textContent='未能复制，请选中上方模板手动复制。';}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-resource]');if(!b)return;e.preventDefault();
 const action=b.dataset.resource;
 if(action==='copy'){copy();return;}
 if(action==='open')state.open=true;
 if(action==='close'||action==='return')state.open=false;
 if(action==='back'||action==='select'){state.selected='';state.step='tool';}
 if(action==='tool')state.step='tool';
 if(action==='verify')state.step='verify';
 if(action==='choose'){if(!cards.some(c=>c.id===b.dataset.card))return;state.selected=b.dataset.card;state.step='tool';}
 const outside=!b.closest('#learning-resources');
 update(action==='verify'?'#lr-verify-title':action==='choose'?'#lr-tool-title':action==='back'||action==='select'||action==='open'&&!state.selected?'[data-resource="choose"]':'[data-resource="'+(state.open?'close':'open')+'"]');
 if(action==='return'){document.querySelector('.tt-resource-entry button')?.focus({preventScroll:true});document.querySelector('.tt-focus')?.scrollIntoView({block:'start',behavior:'smooth'});}
 if(outside)document.querySelector('#learning-resources')?.scrollIntoView({block:'start',behavior:'smooth'});
});
return {render,reset(){state.open=false;state.selected='';state.step='tool';update();}};
})();
