'use strict';
const assert=require('node:assert/strict'),Q=require('../quick-add');
const test=(name,f)=>{f();console.log('PASS '+name);};
const MON='2026-10-26',WED='2026-10-28',p=(text,today=MON,options)=>Q.parse(text,today,options);
test('dates are read at the start, the end or as a separated word, then removed from the title',()=>{
 assert.deepEqual(p('明天 考研数学 极限20题 45分钟'),{title:'考研数学 极限20题',date:'2026-10-27',minutes:45,category:'math'});
 assert.deepEqual(p('周五复习模电'),{title:'复习模电',date:'2026-10-30',minutes:null,category:null});
 assert.equal(p('下周三 实验报告').date,'2026-11-04');
 assert.equal(p('本周一 整理错题').date,'2026-10-26');
 assert.equal(p('周日 复盘').date,'2026-11-01');
 assert.equal(p('周一 复盘',WED).date,'2026-11-02');
 assert.equal(p('这周一 复盘',WED).date,'2026-10-26');
 assert.equal(p('大后天 交报告').date,'2026-10-29');
 assert.equal(p('复习模电 后天').date,'2026-10-28');
 assert.deepEqual(p('10月30日 六级听力一套 1小时'),{title:'六级听力一套',date:'2026-10-30',minutes:60,category:'english'});
 assert.equal(p('1月5日 期末复习').date,'2027-01-05');
 assert.equal(p('11/3 交报告').date,'2026-11-03');
 assert.equal(p('2026-11-20 模电实验').date,'2026-11-20');
 assert.deepEqual(p('复习明天45分钟'),{title:'复习',date:'2026-10-27',minutes:45,category:null});
});
test('durations in digits, Chinese numerals and English units',()=>{
 for(const [text,minutes,title] of [['背单词 1.5h',90,'背单词'],['一个半小时 整理笔记',90,'整理笔记'],['半小时 读论文',30,'读论文'],['复习模电45分钟',45,'复习模电'],['1小时30分钟 刷题',90,'刷题'],['45分钟内完成作业',45,'完成作业'],['两个小时 写报告',120,'写报告'],['四十五分钟 背单词',45,'背单词'],['复习 2hours',120,'复习'],['复习 30 分钟左右',30,'复习'],['明天 复习 ４５分钟',45,'复习'],['1小时半 复习',90,'复习'],['一小时半 复习',90,'复习'],['2h30m 刷题',150,'刷题'],['复习 1h 30min',90,'复习']]){
  const r=p(text);assert.equal(r.minutes,minutes,text);assert.equal(r.title,title,text);
 }
});
test('words that only look like dates or durations stay in the title',()=>{
 for(const text of ['今天的笔记整理','10月30日前交报告','看完1/2','极限20题','做周一的作业','复习45分钟模电','数学考到130分','30分钟的网课 看完','45分钟后 出门']){
  const r=p(text);assert.equal(r.title,text,text);assert.equal(r.date,null,text);assert.equal(r.minutes,null,text);
 }
});
test('punctuation left by removed words is tidied',()=>{
 assert.equal(p('明天，复习模电，45分钟').title,'复习模电');
 assert.equal(p('复习，明天，模电').title,'复习，模电');
 assert.deepEqual(p('   '),{title:'',date:null,minutes:null,category:null});
 assert.deepEqual(p('明天'),{title:'',date:'2026-10-27',minutes:null,category:null});
});
test('a field set by hand is not read from the text',()=>{
 assert.deepEqual(p('明天 复习',MON,{date:false}),{title:'明天 复习',date:null,minutes:null,category:null});
 assert.equal(p('复习 45分钟',MON,{minutes:false}).title,'复习 45分钟');
 assert.equal(p('考研数学 极限',MON,{category:false}).category,null);
});
test('category keywords: written label first, hidden categories skipped',()=>{
 assert.equal(p('数学建模 专业课作业').category,'school');
 assert.equal(p('线代 第三章').category,'math');
 assert.equal(p('数学建模校赛准备').category,null);
 assert.equal(p('基金定投复盘',MON,{categories:['school','english','math']}).category,null);
 assert.equal(p('基金定投复盘',MON,{categories:['school','english','math','stocks']}).category,'stocks');
});
test('impossible dates, over-long durations and titles are refused with a reason',()=>{
 assert.throws(()=>p('2月30日 复习'),/日期不存在：2月30日/);
 assert.throws(()=>p('复习 25小时'),/1440/);
 assert.throws(()=>p('x'.repeat(151)),/150/);
 assert.throws(()=>p('复习',''),/参考日期/);
});
console.log('7 quick-add groups passed');
