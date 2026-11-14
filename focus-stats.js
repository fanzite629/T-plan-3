/* Focus statistics use saved timer rounds, never add them to the effort ledger. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./task-timer'));else root.TGFocusStats=factory(root.TG,root.TGTimer);})(typeof globalThis!=='undefined'?globalThis:this,(G,T)=>{
'use strict';
const ranges={today:1,'7d':7,'30d':30};
const date=ms=>{const d=new Date(ms);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n.toFixed(1)).toLocaleString('zh-CN');
function build(state,range='7d',now=Date.now()){
 G.validateState(state);if(!Object.hasOwn(ranges,range)||!Number.isFinite(now))throw new Error('专注统计范围无效');
 const end=date(now),start=G.addDays(end,1-ranges[range]);
 const records=(state.timerBoard?.records||[]).filter(r=>r.finishedAt<=now&&date(r.finishedAt)>=start&&date(r.finishedAt)<=end).slice().sort((a,b)=>b.finishedAt-a.finishedAt);
 const days=Array.from({length:ranges[range]},(_,i)=>({date:G.addDays(start,i),minutes:0,count:0})),byDay=new Map(days.map(d=>[d.date,d]));
 const contents=new Map(),types=new Map(),quality=Array.from({length:5},(_,i)=>({score:5-i,count:0}));let totalMs=0,pauses=0,pauseUnknown=0,rated=0;
 for(const r of records){const d=byDay.get(date(r.finishedAt));d.minutes+=r.elapsedMs/60000;d.count++;totalMs+=r.elapsedMs;pauses+=r.pauseCount||0;if(r.pauseTrackingComplete!==true)pauseUnknown++;
  const title=r.title.trim()||'未命名计时';if(!contents.has(title))contents.set(title,{label:title,minutes:0,count:0});const c=contents.get(title);c.minutes+=r.elapsedMs/60000;c.count++;
  const type=T.intents[r.intent]||'未记录类型';if(!types.has(type))types.set(type,{label:type,count:0});types.get(type).count++;
  if(Number.isInteger(r.quality)&&r.quality>=1&&r.quality<=5){quality.find(q=>q.score===r.quality).count++;rated++;}
 }
 return {range,start,end,records,days,count:records.length,done:records.filter(r=>r.decision==='done').length,totalMinutes:totalMs/60000,averageMinutes:records.length?totalMs/60000/records.length:0,pauses,pauseUnknown,rated,unrated:records.length-rated,quality,contents:[...contents.values()].sort((a,b)=>b.minutes-a.minutes),types:[...types.values()].sort((a,b)=>b.count-a.count)};
}
function trend(d,key,label,color){const max=Math.max(1,...d.days.map(x=>x[key])),top=22,bottom=160,left=38,width=530,step=width/d.days.length;
 let marks=[0,.5,1].map(n=>`<line x1="38" y1="${bottom-n*(bottom-top)}" x2="568" y2="${bottom-n*(bottom-top)}" stroke="#e4edf9"/><text x="30" y="${bottom-n*(bottom-top)+4}" text-anchor="end">${fmt(max*n)}</text>`).join('');
 d.days.forEach((x,i)=>{const h=x[key]/max*(bottom-top),xpos=left+i*step+step*.2;marks+=`<rect x="${xpos}" y="${bottom-h}" width="${Math.max(2,step*.6)}" height="${h}" rx="3" fill="${color}"><title>${x.date}：${fmt(x[key])}${label}</title></rect>`;if(d.days.length<=7||i%5===0||i===d.days.length-1)marks+=`<text x="${left+(i+.5)*step}" y="183" text-anchor="middle">${x.date.slice(5)}</text>`;});
 return `<div class="fs-trend"><p>${key==='minutes'?'专注时长 · 分钟':'收尾轮次 · 轮'}</p><svg viewBox="0 0 600 200" role="img" aria-label="${key==='minutes'?'每日专注时长':'每日收尾轮次'}">${marks}</svg></div>`;
}
function bars(items,total,unit,key){return items.length?items.map(x=>`<div class="fs-bar"><div><strong>${esc(x.label)}</strong><span>${fmt(x[key])} ${unit}</span></div><progress max="${Math.max(1,total)}" value="${x[key]}" aria-label="${esc(x.label)} ${fmt(x[key])}${unit}"></progress></div>`).join(''):'<p class="empty">这个区间还没有已收尾的专注记录。</p>';}
function heatmap(d){
 const level=m=>m<=0?0:m<=15?1:m<=30?2:m<=60?3:4;
 const offset=(new Date(d.start+'T12:00:00').getDay()+6)%7;
 return `<div class="fs-heatmap"><div class="card-head"><h3>每日专注热力图</h3><small>${d.start} — ${d.end}</small></div><p class="form-note">颜色表示专注分钟数，点击日期查看轮次与时间。浅色表示无计时时长。</p><div class="fs-heat-grid">${['一','二','三','四','五','六','日'].map(x=>`<span class="fs-heat-week">周${x}</span>`).join('')}${Array.from({length:offset},()=>'<span aria-hidden="true"></span>').join('')}${d.days.map(x=>`<button class="fs-heat-cell heat-${level(x.minutes)}" data-focus-day="${x.date}" data-count="${x.count}" data-minutes="${fmt(x.minutes)}" aria-label="${x.date}，收尾${x.count}轮，专注${fmt(x.minutes)}分钟" title="${x.date} · ${x.count}轮 · ${fmt(x.minutes)}分钟"><span>${x.date.slice(5).replace('-',' / ')}</span><strong>${fmt(x.minutes)}<small> 分</small></strong></button>`).join('')}</div><div class="fs-heat-legend"><span>无时长</span>${[0,1,2,3,4].map(i=>`<i class="heat-${i}" aria-hidden="true"></i>`).join('')}<span>≤15 / ≤30 / ≤60 / &gt;60 分钟</span></div><p id="fs-heat-detail" role="status">选择日期查看详情；统计计时记录，不代表任务完成或长期掌握。</p></div>`;
}
function render(state,range='7d'){
 const d=build(state,range),metric=(label,value,unit,note,key)=>`<section class="card fs-metric"><small>${label}</small><p><strong data-focus-metric="${key}">${value}</strong><span>${unit}</span></p><small>${note}</small></section>`;
 return `<header class="page-head"><div><p class="eyebrow">看清投入，调整下一步</p><h1>专注统计</h1><p class="muted">从每一轮记录里，看看时间花在了什么内容上。</p></div><button class="primary" data-page="timer">返回计时看板</button></header>
 <div class="fs-range" role="group" aria-label="专注统计日期范围">${[['today','今天'],['7d','近7天'],['30d','近30天']].map(([r,l])=>`<button data-focus-range="${r}" aria-pressed="${r===range}" class="${r===range?'active':''}">${l}</button>`).join('')}</div>
 <p class="form-note">${d.start} — ${d.end} · 按收尾日期统计，跨日的一轮计入收尾日。统计已保存轮次，正在计时与待收尾不计入。</p>
 <div class="fs-metrics">${metric('已收尾轮次',d.count,'轮',`其中标记“本轮完成” ${d.done} 轮`,'count')}${metric('专注总时长',fmt(d.totalMinutes),'分钟',`计时参考 · 折合 ${fmt(d.totalMinutes/60)} 小时`,'minutes')}${metric('平均单轮',d.count?fmt(d.averageMinutes):'—','分钟','总计时时长 ÷ 已收尾轮次','average')}${metric('暂停次数',d.count===0||d.pauseUnknown===d.count&&d.pauses===0?'—':d.pauses,'次',d.pauseUnknown?`${d.pauseUnknown} 轮未完整记录，仅汇总已知次数`:'统计暂停操作，不把提前收尾当作打断','pauses')}</div>
 <section class="card section fs-trends"><div class="card-head"><h2>每日专注趋势</h2><small>无记录日期显示为0</small></div><div class="fs-two">${trend(d,'minutes','分钟','#4e7dd7')}${trend(d,'count','轮','#91b3ef')}</div>${heatmap(d)}</section>
 <div class="fs-two section"><section class="card"><h2>时间花在哪些内容上</h2><p class="form-note">沿用每轮开始时填写的内容，同名合并。</p>${bars(d.contents.slice(0,12),d.totalMinutes,'分钟','minutes')}${d.contents.length>12?`<details><summary>查看其余 ${d.contents.length-12} 项内容</summary>${bars(d.contents.slice(12),d.totalMinutes,'分钟','minutes')}</details>`:''}</section>
 <section class="card"><h2>做的是哪类事</h2><p class="form-note">开始前可选类型，未选择的记录单独保留。</p>${bars(d.types,d.count,'轮','count')}</section>
 <section class="card"><h2>专注质量分布</h2><p class="form-note">收尾时可自评1—5分。已评分 ${d.rated} 轮，未评分 ${d.unrated} 轮。</p>${d.rated?bars(d.quality.map(q=>({label:'★'.repeat(q.score),count:q.count})),d.rated,'轮','count'):'<p class="empty">还没有评分。下一轮收尾时可以留下感受。</p>'}</section>
 <section class="card fs-guide"><h2>怎么读这些数</h2><p>单轮长短受任务难度、预算和收尾底线影响，可以结合当轮卡点一起看。</p><p>暂停次数只表示你点了暂停；评分是个人感受，都不等同于掌握程度。</p><p>这里使用计时记录，已扣除暂停时间；“数据看板”使用你确认的实际投入，两者不会自动累加。</p><button data-page="dashboard">查看实际投入看板</button></section></div>
 <section class="card"><div class="card-head"><h2>本区间的专注记录</h2><small>最近 ${Math.min(30,d.count)} / ${d.count} 轮</small></div>${d.records.slice(0,30).map(r=>`<article class="fs-record"><div><strong>${esc(r.title)}</strong><p class="meta">${date(r.finishedAt)} · ${T.intents[r.intent]||'未记录类型'} · ${r.quality?'自评 '+r.quality+' / 5':'未评分'}</p></div><span>${fmt(r.elapsedMs/60000)} 分钟</span></article>`).join('')||'<p class="empty">完成一轮计时并保存收尾后，这里就会出现记录。</p>'}</section>`;
}
return {build,render,heatmap};
});
