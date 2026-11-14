/* 快速添加：把输入框里的一句话拆成任务字段。只识别句子里明确写出的日期、时长和分类关键词；
   结果先显示在输入框下方，按回车后才保存。纯文本处理，不联网。 */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.TGQuickAdd=f();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const DAY=86400000,pad=n=>String(n).padStart(2,'0');
const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const weekday=d=>(new Date(d+'T00:00:00Z').getUTCDay()+6)%7+1;
const DIGIT={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
const WEEKDAY={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7};
const RELATIVE={'今天':0,'今晚':0,'明天':1,'明晚':1,'后天':2,'大后天':3};
// 词语只在句首、句尾或被空格、标点隔开时识别，句子中间连写的内容保持原样。
const SEP='[\\s,，。、;；:：!！?？]';
// “10月30日前”“明天的”这类说法不当作安排日期；“30分钟的网课”“45分钟后”不当作预计耗时。
const DATE_END='(?![前后之以的到起])',DUR_END='(?![的后前])';
const HOURS='(?:个?(?:小时|钟头)|(?:h|hr|hrs|hour|hours)(?![a-zA-Z]))';
const MINUTES='(?:分钟|(?:min|mins|minute|minutes)(?![a-zA-Z]))';
const AROUND='(?:左右|上下|以内|之内|内)?';
const CN='[零〇一二两三四五六七八九十]{1,3}';
// 写出分类名称优先，其次按常见词预选；用户可在选项里改。
const KEYWORDS=[['school',/学校专业课|专业课/],['math',/考研数学|数学(?!建模)|高数|线代|线性代数|概率论|微积分/],['english',/六级|四级|英语|单词|听力|口语/],['stocks',/财务|理财|投资|股票|基金/]];
function cnNumber(s){if(Object.prototype.hasOwnProperty.call(DIGIT,s))return DIGIT[s];const m=/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(s);return m?(m[1]?DIGIT[m[1]]:1)*10+(m[2]?DIGIT[m[2]]:0):NaN;}
function take(text,core,{atEnd=true}={}){
 const tries=[new RegExp('(^|'+SEP+')('+core+')(?='+SEP+'|$)'),new RegExp('^(\\s*)('+core+')')];
 if(atEnd)tries.push(new RegExp('()('+core+')\\s*$'));
 for(const re of tries){const m=re.exec(text);if(m){const at=m.index+m[1].length;return {token:m[2],groups:m.slice(3),rest:text.slice(0,at)+' '+text.slice(at+m[2].length)};}}
 return null;
}
function calendarDate(y,m,d,token){const value=y+'-'+pad(m)+'-'+pad(d),t=new Date(value+'T00:00:00Z');if(!(y>=2000&&y<=2100&&t.getUTCMonth()+1===m&&t.getUTCDate()===d))throw new Error('日期不存在：'+token);return value;}
function findDate(text,today){
 let hit=take(text,'(大后天|今天|今晚|明天|明晚|后天)'+DATE_END);
 if(hit)return {...hit,date:addDays(today,RELATIVE[hit.groups[0]])};
 hit=take(text,'(下个?|本|这个?)?(?:周|星期|礼拜)([一二三四五六日天])'+DATE_END);
 if(hit){const [scope,day]=hit.groups,monday=addDays(today,1-weekday(today));let date=addDays(monday,WEEKDAY[day]-1+(scope&&scope[0]==='下'?7:0));if(!scope&&date<today)date=addDays(date,7);return {...hit,date};}
 hit=take(text,'(?<!\\d)(\\d{4})-(\\d{1,2})-(\\d{1,2})(?!\\d)'+DATE_END);
 if(hit){const [y,m,d]=hit.groups.map(Number);return {...hit,date:calendarDate(y,m,d,hit.token)};}
 // 斜线写法不在句尾识别，避免把“看完1/2”当成日期。
 hit=take(text,'(?<!\\d)(\\d{1,2})月(\\d{1,2})(?:[日号]|(?![日号\\d]))'+DATE_END)||take(text,'(?<![\\d/])(\\d{1,2})\\/(\\d{1,2})(?![\\d/])'+DATE_END,{atEnd:false});
 if(hit){const [m,d]=hit.groups.map(Number),y=Number(today.slice(0,4));let date=calendarDate(y,m,d,hit.token);if(date<addDays(today,-180))date=calendarDate(y+1,m,d,hit.token);return {...hit,date};}
 return null;
}
function findMinutes(text){
 let minutes=null,hit=take(text,'(?<![\\d.])(\\d+(?:\\.\\d+)?)\\s*'+HOURS+'(?:\\s*(\\d{1,2})\\s*(?:分钟|分|min(?![a-zA-Z])|m(?![a-zA-Z]))|(半))?'+AROUND+DUR_END);
 if(hit)minutes=Number(hit.groups[0])*60+Number(hit.groups[1]||0)+(hit.groups[2]?30:0);
 if(!hit){hit=take(text,'(?<![\\d.])(\\d{1,4})\\s*'+MINUTES+AROUND+DUR_END);if(hit)minutes=Number(hit.groups[0]);}
 if(!hit){hit=take(text,'(?:(半)|('+CN+')个?(半)?)个?(?:小时|钟头)(半)?'+AROUND+DUR_END);if(hit){const [half,n,plus,after]=hit.groups;minutes=half?30:cnNumber(n)*60+(plus||after?30:0);if(!Number.isFinite(minutes))hit=null;}}
 if(!hit){hit=take(text,'('+CN+')分钟'+AROUND+DUR_END);if(hit){minutes=cnNumber(hit.groups[0]);if(!Number.isFinite(minutes))hit=null;}}
 if(!hit)return null;
 minutes=Math.round(minutes);
 if(minutes>1440)throw new Error('预计耗时最长 1440 分钟（24 小时），这里写的是 '+minutes+' 分钟');
 return {...hit,minutes};
}
function clean(s){return s.replace(/\s+/g,' ').replace(/([，,、；;])(?:\s*[，,、；;])+/g,'$1').replace(/^[\s，,。、；;：:]+|[\s，,。、；;：:]+$/g,'');}
// options.date / minutes / category 为 false 时不从文字读取该项（用户已在选项里手动选择）。
function parse(text,today,options={}){
 if(typeof text!=='string')throw new Error('请输入文字');
 if(typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today))throw new Error('参考日期无效');
 let rest=text.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)),date=null,minutes=null;
 const readDate=()=>{if(options.date===false||date!==null)return;const hit=findDate(rest,today);if(hit){date=hit.date;rest=hit.rest;}};
 readDate();
 if(options.minutes!==false){const hit=findMinutes(rest);if(hit){minutes=hit.minutes;rest=hit.rest;}}
 readDate(); // 时长去掉后，日期可能落到句尾，例如“复习明天45分钟”。
 const title=clean(rest);
 if(title.length>150)throw new Error('任务名称最多 150 字，现在 '+title.length+' 字');
 let category=null;
 if(options.category!==false)for(const [id,re] of KEYWORDS)if((!options.categories||options.categories.includes(id))&&re.test(title)){category=id;break;}
 return {title,date,minutes,category};
}
return {parse};
});
