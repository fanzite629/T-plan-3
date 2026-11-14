/* Four small, offline charts. Numbers are supplied by TGDashboard, never sample data. */
(function(root){
'use strict';
const palette=new Proxy({}, {get:(_,id)=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return ['#3978cf','#568bdb','#3762a6','#7396c9','#4a6fbd'][h%5];}});
const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const hours=value=>Number((value/60).toFixed(2)).toLocaleString('zh-CN',{maximumFractionDigits:2});
const pct=value=>value===null?'—':value.toFixed(1)+'%';
const empty='<div class="chart-empty">开始记录后，这里会形成趋势。</div>';
const svg=(body,label,viewBox='0 0 360 240')=>`<svg class="data-chart" viewBox="${viewBox}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</svg>`;
const card=(id,title,note,content)=>`<section class="card dashboard-card" data-chart="${id}"><div class="card-head"><h2>${title}</h2></div><p class="chart-caption">${note}</p>${content}</section>`;
function comparison(d){
 const max=Math.max(60,...d.comparison.flatMap(x=>[x.targetMinutes,x.actualMinutes]));
 const rows=d.comparison.map(x=>`<div class="comparison-row" data-category="${esc(x.id)}" data-target-minutes="${x.targetMinutes}" data-actual-minutes="${x.actualMinutes}"><div class="chart-row-label"><strong>${esc(x.label)}</strong><span>目标 ${hours(x.targetMinutes)}h · 实际 <b>${hours(x.actualMinutes)}h</b></span></div>${svg(`<rect x="0" y="2" width="${x.targetMinutes/max*360}" height="8" rx="3" fill="#dce7f5"/><rect x="0" y="16" width="${x.actualMinutes/max*360}" height="8" rx="3" fill="${palette[x.id]}"/>`,`${x.label}，目标${hours(x.targetMinutes)}小时，实际${hours(x.actualMinutes)}小时`,'0 0 360 28')}</div>`).join('');
 return card('comparison','本周任务预计投入 vs 实际投入','浅条为你创建任务时填写的预计耗时，深条为本周关联该任务的实际投入。单位：小时。',
 (rows||'<div class="chart-empty">本周还没有安排任务。新建任务后自动显示对比。</div>')+
 (d.unassignedMinutes?`<p class="form-note">另有 ${hours(d.unassignedMinutes)}h 未关联本周任务，保留在实际投入总量中。</p>`:''));
}

function daily(d){
 const cats=d.series, maximum=Math.max(60,...d.days.map(x=>x.totalMinutes)), maxHours=Math.ceil(maximum/60), ceiling=maxHours*60, bottom=192,height=150;
 let marks=[0,.5,1].map(v=>{const y=bottom-v*height;return `<line x1="36" y1="${y}" x2="350" y2="${y}" stroke="#e5ecf4"/><text x="29" y="${y+4}" text-anchor="end" fill="#68798f" font-size="11">${Number((v*maxHours).toFixed(1))}</text>`;}).join('');
 marks+='<text x="5" y="20" fill="#68798f" font-size="11">小时</text>';
 d.days.forEach((day,i)=>{const x=45+i*44;let y=bottom;cats.forEach(c=>{const m=day.minutes[c.id]||0,h=m/ceiling*height;if(m){y-=h;marks+=`<rect x="${x}" y="${y}" width="25" height="${h}" fill="${palette[c.id]}"><title>${day.date} ${esc(c.label)} ${hours(m)}小时</title></rect>`;}});marks+=`<text x="${x+12.5}" y="${bottom-day.totalMinutes/ceiling*height-7}" text-anchor="middle" fill="#253e5c" font-size="10">${hours(day.totalMinutes)}</text><text x="${x+12.5}" y="214" text-anchor="middle" fill="#68798f" font-size="11">${esc(day.dayLabel)}</text>`;});
 const legend=`<div class="chart-legend">${cats.map(c=>`<span><svg width="9" height="9" aria-hidden="true"><rect width="9" height="9" rx="2" fill="${palette[c.id]}"/></svg>${esc(c.label)}</span>`).join('')}</div>`;
 const table=`<details class="chart-values"><summary>查看每天的记录数值</summary><div class="chart-table-scroll"><table><caption>所选周的自主投入，单位：分钟</caption><thead><tr><th>日期</th>${cats.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th>合计</th></tr></thead><tbody>${d.days.map(day=>`<tr data-date="${day.date}"><th>${day.date}</th>${cats.map(c=>`<td>${day.minutes[c.id]||0}</td>`).join('')}<td>${day.totalMinutes}</td></tr>`).join('')}</tbody></table></div></details>`;
 return card('daily','本周每日自主投入','周一至周日，按实际发生日期汇总。只累计统一投入记录，不重复计算任务或旁听。',d.hasLogs?svg(marks,'周一至周日的任务实际投入堆叠条形图')+legend+table:empty);
}
function allocationPie(a){
 if(a.actualTotalMinutes<=0)return '';
 const parts=a.rows.filter(r=>r.actualMinutes>0),total=a.actualTotalMinutes;
 const shareLabel=share=>share>0&&share<0.1?'<0.1%':pct(share);
 const point=angle=>[100+88*Math.cos(angle),100+88*Math.sin(angle)].map(n=>Number(n.toFixed(6))).join(' ');
 let angle=-Math.PI/2;
 const slices=parts.map((r,i)=>{
  const share=r.actualMinutes/total*100,sweep=r.actualMinutes/total*Math.PI*2,end=i===parts.length-1?Math.PI*1.5:angle+sweep;
  const attrs=`class="pie-slice" data-slice-category="${esc(r.id)}" data-minutes="${r.actualMinutes}" data-percent="${share}" fill="${palette[r.id]}"`;
  const title=`<title>${esc(r.label)}：${r.actualMinutes}分钟，占已记录自主投入${esc(shareLabel(share))}</title>`;
  const mark=parts.length===1?`<circle ${attrs} cx="100" cy="100" r="88">${title}</circle>`:`<path ${attrs} d="M 100 100 L ${point(angle)} A 88 88 0 ${sweep>Math.PI?1:0} 1 ${point(end)} Z">${title}</path>`;
  angle=end;return mark;
 }).join('');
 const legend=parts.map(r=>{const share=r.actualMinutes/total*100;return `<li data-pie-category="${esc(r.id)}"><svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${palette[r.id]}"/></svg><span>${esc(r.label)}</span><span class="pie-value"><b>${esc(shareLabel(share))}</b><small>${hours(r.actualMinutes)}h</small></span></li>`;}).join('');
 return `<figure class="allocation-pie-block"><figcaption>实际投入分布 · 饼图</figcaption><div class="pie-layout"><svg class="allocation-pie" data-testid="allocation-pie" data-total-minutes="${total}" viewBox="0 0 200 200" role="img" aria-label="本周已记录自主投入${hours(total)}小时，按专注内容统计，具体百分比与时长见旁边图例"><title>本周实际投入分布，共${hours(total)}小时</title>${slices}</svg><ul class="pie-legend" aria-label="实际投入饼图图例">${legend}</ul></div><p class="pie-note">计时投入使用开始时填写的内容；相同内容合并统计。只有确认实际投入后才计入。</p></figure>`;
}
function allocation(d){
 const a=d.allocation;
 const rows=a.rows.map(r=>`<div class="allocation-row" data-category="${esc(r.id)}" data-actual-percent="${r.actualPercent===null?'':r.actualPercent}"><div class="chart-row-label"><strong>${esc(r.label)}</strong><span>${hours(r.actualMinutes)}h · <b>${pct(r.actualPercent)}</b></span></div>${svg(`<rect x="0" y="4" width="360" height="8" rx="3" fill="#edf3fc"/><rect x="0" y="4" width="${(r.actualPercent||0)*3.6}" height="8" rx="3" fill="${palette[r.id]}"/>`,`${r.label}，实际投入${hours(r.actualMinutes)}小时，占${pct(r.actualPercent)}`,'0 0 360 16')}</div>`).join('');
 return card('allocation','本周专注内容分布',`本周已确认投入 ${hours(a.actualTotalMinutes)}h，看看时间花在了哪些具体内容上。`,d.hasLogs?allocationPie(a)+rows:empty);
}
root.TGDashboardView={render:data=>`<div class="dashboard-grid">${comparison(data)}${daily(data)}${allocation(data)}</div>`};
})(typeof globalThis!=='undefined'?globalThis:this);
