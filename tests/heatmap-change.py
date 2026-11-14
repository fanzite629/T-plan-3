from pathlib import Path
p=Path(__file__).resolve().parents[1]/'focus-stats.js'
s=p.read_text(encoding='utf-8')
start=s.index('<details><summary>查看每天的数值</summary>')
end=s.index('</details>',start)+len('</details>')
s=s[:start]+'${heatmap(d)}'+s[end:]
at=s.index('function render(state')
s=s[:at]+'''function heatmap(d){
 const level=m=>m<=0?0:m<=15?1:m<=30?2:m<=60?3:4;
 const offset=(new Date(d.start+'T12:00:00').getDay()+6)%7;
 return `<div class="fs-heatmap"><div class="card-head"><h3>每日专注热力图</h3><small>${d.start} — ${d.end}</small></div><p class="form-note">颜色表示专注分钟数，点击日期查看轮次与时间。浅色表示无计时时长。</p><div class="fs-heat-grid">${['一','二','三','四','五','六','日'].map(x=>`<span class="fs-heat-week">周${x}</span>`).join('')}${Array.from({length:offset},()=>'<span aria-hidden="true"></span>').join('')}${d.days.map(x=>`<button class="fs-heat-cell heat-${level(x.minutes)}" data-focus-day="${x.date}" data-count="${x.count}" data-minutes="${fmt(x.minutes)}" aria-label="${x.date}，收尾${x.count}轮，专注${fmt(x.minutes)}分钟" title="${x.date} · ${x.count}轮 · ${fmt(x.minutes)}分钟"><span>${x.date.slice(5).replace('-',' / ')}</span><strong>${fmt(x.minutes)}<small> 分</small></strong></button>`).join('')}</div><div class="fs-heat-legend"><span>无时长</span>${[0,1,2,3,4].map(i=>`<i class="heat-${i}" aria-hidden="true"></i>`).join('')}<span>≤15 / ≤30 / ≤60 / &gt;60 分钟</span></div><p id="fs-heat-detail" role="status">选择日期查看详情；统计计时记录，不代表任务完成或长期掌握。</p></div>`;
}
''' +s[at:]
s=s.replace('return {build,render};','return {build,render,heatmap};')
p.write_text(s,encoding='utf-8')
p=p.parent/'app.js';s=p.read_text(encoding='utf-8');s=s.replace("if(b.dataset.focusRange){", "if(b.dataset.focusDay){const d=document.querySelector('#fs-heat-detail');if(d)d.textContent=b.dataset.focusDay+' · 收尾 '+b.dataset.count+' 轮 · 专注 '+b.dataset.minutes+' 分钟';document.querySelectorAll('[data-focus-day]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));return;}if(b.dataset.focusRange){");p.write_text(s,encoding='utf-8')
