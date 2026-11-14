// Included inside the application's closure: the main timer remains the single source of truth.
const nativeMiniTimer = !!window.chrome?.webview;
function desktopTimerState(kind = 'timer-state') {
 const a = S.active, at = Date.now();
 return {kind, error:timerError||'', id:a?.id || '', title:a?.title || '', phase:a?.phase || 'ready',
  dark:document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches),
  mode:a?.mode || 'down', budgetMs:a?.budget || 0, elapsedMs:a ? el(a, at) : 0, at};
}
function desktopTimerSnapshot() {
 if(nativeMiniTimer) window.chrome.webview.postMessage(desktopTimerState());
}
function openDesktopMiniTimer() {
 if(!S.active || S.active.phase === 'ended') return;
 tick();
 window.chrome.webview.postMessage(desktopTimerState('timer-mini'));
}
if(nativeMiniTimer) {
 // The native host also calls this while minimized, so reaching zero is persisted promptly.
 window.tplanDesktopPoll = () => tick();
 window.chrome.webview.addEventListener('message', event => {
  const command = event.data;
  if(command === 'timer:show') { if(view !== 'timer') go('timer'); return; }
  const a = S.active;
  if(!a || a.phase === 'ended') return;
  if(command === 'timer:pause' && a.phase === 'running') tctl('pause');
  else if(command === 'timer:resume' && a.phase === 'paused') tctl('resume');
  else if(command === 'timer:add5' && a.mode === 'down') tctl('add5');
  else if(command === 'timer:end') { tctl('end'); go('timer'); }
 });
}
