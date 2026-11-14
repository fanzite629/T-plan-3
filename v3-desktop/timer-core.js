(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TPlanTimer=factory();})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const clone=s=>JSON.parse(JSON.stringify(s));
 function elapsed(a,now=Date.now()){if(!a)return 0;const value=Math.max(0,a.acc+(a.phase==='running'?Math.max(0,now-a.lastAt):0));return a.mode==='down'?Math.min(value,a.budget):value;}
 function begin(s,input,now){if(s.active)throw Error('先结束并保存当前这一轮');const title=String(input.title||'').trim();if(!title||title.length>150)throw Error('请填写 1–150 字的计时内容');const dur=input.dur;if(dur!=='up'&&(!Number.isInteger(dur)||dur<1||dur>180))throw Error('自定义时长请填 1–180 的整数');const n=clone(s),t=n.tasks.find(t=>t.id===input.taskId);n.active={id:input.id,title,taskId:t?.id||null,cat:input.cat||t?.cat||'other',course:input.course||null,mode:dur==='up'?'up':'down',budget:dur==='up'?0:dur*60000,startedAt:now,lastAt:now,acc:0,phase:'running',pauses:0,endedAt:null};return n;}
 function control(s,key,now){const n=clone(s),a=n.active;if(!a||a.phase==='ended')return n;
  if(key==='pause'&&a.phase==='running'){a.acc=elapsed(a,now);a.phase=a.mode==='down'&&a.acc>=a.budget?'due':'paused';if(a.phase==='paused')a.pauses++;}
  else if(key==='resume'&&a.phase==='paused'){a.lastAt=now;a.phase='running';}
  else if(key==='add5'&&a.mode==='down'){a.acc=elapsed(a,now);a.budget+=300000;if(a.phase==='due')a.phase='running';if(a.phase==='running')a.lastAt=now;}
  else if(key==='up'){a.acc=elapsed(a,now);a.mode='up';if(a.phase==='due')a.phase='running';if(a.phase==='running')a.lastAt=now;}
  else if(key==='end'){a.acc=elapsed(a,now);a.phase='ended';a.endedAt=now;}
  return n;
 }
 function due(s,now){const n=clone(s),a=n.active;if(a?.phase==='running'&&a.mode==='down'&&elapsed(a,now)>=a.budget){a.acc=a.budget;a.phase='due';}return n;}
 function finish(s,draft,date,noteId,now){const a=s.active;if(!a||a.phase!=='ended')throw Error('请先结束这一轮计时');const minutes=Number(draft.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('用时请填 1–1440 的整数分钟');const note=String(draft.note||'').trim(),stuck=String(draft.stuck||'').trim(),next=String(draft.next||'').trim();if(note.length>300||stuck.length>2000||next.length>1000)throw Error('记录内容超过字数限制，请精简后保存');if(s.sessions.some(x=>x.id===a.id))throw Error('这一轮已有记录，请先到回看核对');const n=clone(s);n.sessions.push({id:a.id,title:a.title,taskId:a.taskId,cat:a.cat,course:a.course,date,start:a.startedAt,end:a.endedAt,minutes,note,src:'timer'});if(stuck)n.notes.push({id:noteId,date,text:stuck,taskId:a.taskId,course:a.course,cat:a.cat,at:now,src:'timer'});const t=n.tasks.find(t=>t.id===a.taskId);if(t){t.next=next;if(draft.done&&!t.done){t.done=true;t.doneAt=now;}}n.active=null;return n;}
 return {elapsed,begin,control,due,finish};
});
