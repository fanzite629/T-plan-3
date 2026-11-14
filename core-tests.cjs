'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const TG = require('./core.js');
const clone = value => JSON.parse(JSON.stringify(value));
const MONDAY = '2026-09-07';
const T = '2026-09-07T08:00:00+08:00';
let passed = 0;
function test(name, body) {
  try { body(); passed++; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + '\n' + error.stack + '\n'); process.exitCode = 1; }
}
function apply(state, action, payload, now = T) { return TG.mutate(state, action, payload, now); }
function addTask(state, id = 'task-a', extra = {}, now = T) {
  apply(state, 'task:add', { id, title: '学习任务', category: 'english', date: MONDAY, ...extra }, now);
  return state.tasks.find(t => t.id === id);
}
function addLog(state, id, date, minutes, extra = {}) { apply(state, 'log:add', { id, date, category: 'english', minutes, ...extra }); }
function badImport(state, change) {
  const envelope = JSON.parse(TG.exportData(state, T)); change(envelope);
  assert.throws(() => TG.parseImport(JSON.stringify(envelope)));
}

test('schema defaults and per-week copies never mutate historical targets', () => {
  const state = TG.newState(); assert.equal(TG.validateState(state), true);
  const week = TG.getWeek(state, MONDAY); week.goals.english = 999;
  assert.equal(TG.getWeek(state, MONDAY).goals.english, 420);
  apply(state, 'week', { monday: MONDAY, ...TG.getWeek(state, MONDAY) });
  const original = clone(state.weeks[MONDAY]);
  apply(state, 'week:applyNext', { monday: MONDAY, budgetMinutes: 100, goals: { ...original.goals, english: 60 }, fitnessMinutes: 120 });
  assert.deepEqual(state.weeks[MONDAY], original);
  assert.equal(state.weeks['2026-09-14'].goals.english, 60);
});

test('calendar Monday, Sunday, year crossing and leap-day validation', () => {
  assert.equal(TG.weekStart('2026-09-13'), MONDAY);
  assert.equal(TG.remainingDays(MONDAY), 6); assert.equal(TG.remainingDays('2026-09-13'), 0);
  assert.equal(TG.teachingWeek('2026-09-06'), 0); assert.equal(TG.teachingWeek('2026-09-07'), 1);
  assert.equal(TG.teachingWeek('2026-09-14'), 2); assert.equal(TG.teachingWeek('2026-12-06'), 13);
  assert.equal(TG.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(TG.addDays('2026-12-31', 1), '2027-01-01');
  assert.throws(() => TG.weekStart('2026-02-29')); assert.throws(() => TG.weekStart('2026-2-01'));
  assert.equal(TG.weekDates('2026-09-09').length, 7);
});

test('timezone conversion uses local day while date-only calendar is timezone-safe', () => {
  const code = "const t=require('./core.js');process.stdout.write(JSON.stringify([t.today('2026-09-06T17:00:00Z'),t.weekStart('2026-09-07')]))";
  const shanghai = JSON.parse(execFileSync(process.execPath, ['-e', code], { cwd: __dirname, env: { ...process.env, TZ: 'Asia/Shanghai' }, encoding: 'utf8' }));
  const utc = JSON.parse(execFileSync(process.execPath, ['-e', code], { cwd: __dirname, env: { ...process.env, TZ: 'UTC' }, encoding: 'utf8' }));
  assert.deepEqual(shanghai, ['2026-09-07', MONDAY]); assert.deepEqual(utc, ['2026-09-06', MONDAY]);
});

test('one explicitly selected main plus at most two secondary, completion creates no replacement', () => {
  const state = TG.newState();
  for (let i = 1; i <= 5; i++) addTask(state, 'task-' + i, { priority: 'high', estimatedMinutes: 60 });
  assert.equal(TG.focusTasks(state, MONDAY).main, null);
  apply(state, 'main:set', { date: MONDAY, taskId: 'task-3' });
  assert.equal(TG.focusTasks(state, MONDAY).main.id, 'task-3'); assert.equal(TG.focusTasks(state, MONDAY).secondary.length, 2);
  apply(state, 'task:complete', { id: 'task-3' }); apply(state, 'task:complete', { id: 'task-3' });
  const focus = TG.focusTasks(state, MONDAY);
  assert.equal(focus.main.id, 'task-3'); assert.equal(focus.main.status, 'done'); assert.equal(focus.secondary.length, 2);
  assert.equal(state.logs.length, 0); assert.equal(TG.taskMinutes(state, 'task-3'), 0); assert.equal(state.tasks[2].statusHistory.length, 2);
  apply(state, 'main:set', { date: MONDAY, taskId: 'task-4' }); assert.equal(Object.keys(state.mainByDate).length, 1);
  assert.throws(() => apply(clone(state), 'main:set', { date: '2026-09-08', taskId: 'task-4' }));
});

test('unfinished task receives real logs, Sunday and Monday minutes belong to different weeks', () => {
  const state = TG.newState(); addTask(state, 'task-cross', { date: '2026-09-13', estimatedMinutes: 60 });
  addLog(state, 'log-sun', '2026-09-13', 40, { taskId: 'task-cross' });
  addLog(state, 'log-mon', '2026-09-14', 20, { taskId: 'task-cross' });
  assert.equal(TG.taskMinutes(state, 'task-cross'), 60);
  assert.equal(TG.weekStats(state, MONDAY).actual.english, 40);
  assert.equal(TG.weekStats(state, '2026-09-14').actual.english, 20);
  assert.equal(state.tasks[0].status, 'todo');
  apply(state, 'task:complete', { id: 'task-cross' }, '2026-09-14T09:00:00+08:00');
  assert.equal(TG.taskMinutes(state, 'task-cross'), 60);
});

test('postponing today main removes it from today without promoting another task', () => {
  const state = TG.newState(); addTask(state); addTask(state, 'task-b', { priority: 'high' });
  apply(state, 'main:set', { date: MONDAY, taskId: 'task-a' });
  apply(state, 'task:postpone', { id: 'task-a', today: MONDAY });
  assert.equal(TG.focusTasks(state, MONDAY).main, null);
  assert.equal(TG.focusTasks(state, MONDAY).secondary[0].id, 'task-b');
  assert.equal(state.mainByDate[MONDAY], 'task-a');
  assert.equal(TG.focusTasks(state, '2026-09-08').main, null);
});

test('completed daily main achievement survives rescheduling and reopening on a later day', () => {
  const state = TG.newState(); addTask(state);
  apply(state, 'main:set', { date: MONDAY, taskId: 'task-a' });
  apply(state, 'task:complete', { id: 'task-a' }, '2026-09-07T12:00:00+08:00');
  apply(state, 'task:edit', { id: 'task-a', date: '2026-09-08', status: 'todo' }, '2026-09-08T08:00:00+08:00');
  assert.equal(TG.focusTasks(state, MONDAY).main.status, 'done');
  assert.equal(state.tasks[0].status, 'todo');
});

test('summary headings distinguish pre-term and post-term weeks', () => {
  const state = TG.newState();
  assert.match(TG.summaryText(state, '2026-08-31'), /^学期前周总结/);
  assert.match(TG.summaryText(state, '2027-01-25'), /^学期后周总结/);
});

test('edit, delete and repeated import do not duplicate accumulated minutes', () => {
  const state = TG.newState(); addTask(state); addLog(state, 'log-a', MONDAY, 30, { taskId: 'task-a' });
  apply(state, 'log:edit', { id: 'log-a', minutes: 45 }); assert.equal(TG.taskMinutes(state, 'task-a'), 45);
  apply(state, 'log:edit', { id: 'log-a', date: '2026-09-14', category: 'math' });
  assert.equal(TG.weekStats(state, MONDAY).totalMinutes, 0); assert.equal(TG.weekStats(state, '2026-09-14').actual.math, 45);
  apply(state, 'task:edit', { id: 'task-a', title: '编辑后', estimatedMinutes: 100 });
  assert.equal(TG.taskMinutes(state, 'task-a'), 45);
  const restored = TG.parseImport(TG.exportData(state, T)).state;
  const restoredAgain = TG.parseImport(TG.exportData(restored, T)).state;
  assert.deepEqual(restoredAgain, state); assert.equal(TG.taskMinutes(restoredAgain, 'task-a'), 45);
  apply(restoredAgain, 'log:delete', { id: 'log-a' }); assert.equal(TG.taskMinutes(restoredAgain, 'task-a'), 0);
});

test('delete task with historical logs preserved detaches IDs but retains dates and categories', () => {
  const state = TG.newState(); addTask(state); addLog(state, 'log-a', MONDAY, 30, { taskId: 'task-a' });
  apply(state, 'main:set', { date: MONDAY, taskId: 'task-a' });
  apply(state, 'task:delete', { id: 'task-a', deleteLogs: false });
  assert.equal(state.tasks.length, 0); assert.equal(state.logs[0].taskId, null);
  assert.equal(state.logs[0].category, 'english'); assert.equal(state.logs[0].date, MONDAY);
  assert.equal(TG.weekStats(state, MONDAY).actual.english, 30); assert.equal(TG.focusTasks(state, MONDAY).main, null);
});

test('delete task and its logs removes only selected task minutes', () => {
  const state = TG.newState(); addTask(state); addTask(state, 'task-b');
  addLog(state, 'log-a', MONDAY, 30, { taskId: 'task-a' }); addLog(state, 'log-b', MONDAY, 40, { taskId: 'task-b' });
  apply(state, 'task:delete', { id: 'task-a', deleteLogs: true });
  assert.equal(state.logs.length, 1); assert.equal(state.logs[0].id, 'log-b'); assert.equal(TG.weekStats(state, MONDAY).actual.english, 40);
});

test('postpone means system tomorrow, histories retain original week and deduplicate visits', () => {
  const state = TG.newState(); addTask(state, 'task-a', { date: '2026-09-10' });
  apply(state, 'task:postpone', { id: 'task-a', today: '2026-09-13' }, '2026-09-13T20:00:00+08:00');
  assert.equal(state.tasks[0].date, '2026-09-14'); assert.equal(state.tasks[0].originalDate, '2026-09-10');
  assert.equal(TG.weekStats(state, MONDAY).taskCount, 1); assert.equal(TG.weekStats(state, MONDAY).postponedTasks.length, 1);
  assert.equal(TG.weekStats(state, '2026-09-14').taskCount, 1);
  apply(state, 'task:edit', { id: 'task-a', date: '2026-09-12' }, '2026-09-14T20:00:00+08:00');
  apply(state, 'task:edit', { id: 'task-a', date: '2026-09-15' }, '2026-09-14T21:00:00+08:00');
  assert.equal(TG.weekStats(state, MONDAY).taskCount, 1); assert.equal(TG.weekStats(state, '2026-09-14').taskCount, 1);
  assert.equal(TG.weekStats(state, MONDAY, '2026-09-13T19:00:00+08:00').postponedTasks.length, 0);
});

test('completion status follows cutoff even after task is reopened', () => {
  const state = TG.newState(); addTask(state);
  apply(state, 'task:complete', { id: 'task-a' }, '2026-09-08T12:00:00+08:00');
  apply(state, 'task:edit', { id: 'task-a', status: 'todo' }, '2026-09-09T12:00:00+08:00');
  assert.equal(TG.weekStats(state, MONDAY, '2026-09-08T20:00:00+08:00').completedCount, 1);
  assert.equal(TG.weekStats(state, MONDAY, '2026-09-09T20:00:00+08:00').completedCount, 0);
  assert.equal(state.tasks[0].completedAt, null);
});

test('fitness day count is idempotent and kept separate from hours and budget', () => {
  const state = TG.newState();
  apply(state, 'health:set', { date: MONDAY, weight: null, trained: true });
  apply(state, 'health:set', { date: MONDAY, weight: null, trained: true });
  addLog(state, 'log-fit', MONDAY, 45, { category: 'fitness' });
  const stats = TG.weekStats(state, MONDAY);
  assert.equal(stats.actual.fitness, 1); assert.equal(stats.minutes.fitness, 45); assert.equal(stats.progress.fitness.percent, 25);
  assert.equal(stats.allocatedMinutes, 1950); assert.equal(stats.remainingMinutes, -150);
  apply(state, 'health:set', { date: MONDAY, weight: null, trained: false }); assert.equal(TG.weekStats(state, MONDAY).actual.fitness, 0);
});

test('over budget is allowed and zero goals never generate NaN or 100 percent', () => {
  const state = TG.newState(); const week = TG.getWeek(state, MONDAY);
  apply(state, 'week', { monday: MONDAY, ...week, budgetMinutes: 10 });
  addLog(state, 'log-stocks', MONDAY, 30, { category: 'stocks' });
  const stats = TG.weekStats(state, MONDAY);
  assert.equal(stats.remainingMinutes, -1940);
  assert.equal(stats.progress.stocks.percent, null); assert.equal(stats.progress.stocks.label, '计划外投入');
  assert.equal(stats.progress.other.percent, null); assert.equal(stats.progress.other.label, '未设目标/已暂停');
  assert.equal(JSON.stringify(stats).includes('NaN'), false);
});

test('attendance reserves within power target and repeated attended action updates a single log', () => {
  const state = TG.newState(), a = { date: '2026-09-08', courseId: 'audit-tue' };
  apply(state, 'attendance:plan', { ...a, plannedMinutes: 90 });
  assert.equal(TG.weekStats(state, MONDAY).allocatedMinutes, 1950); assert.equal(TG.weekStats(state, MONDAY).plannedAttendanceMinutes, 90); assert.equal(TG.weekStats(state, MONDAY).attendanceOverGoalMinutes, 0); assert.equal(TG.weekStats(state, MONDAY).attendanceCount, 0);
  assert.equal(TG.weekStats(state, MONDAY).taskCount, 0);
  apply(state, 'attendance:attend', { ...a, minutes: 80 });
  apply(state, 'attendance:attend', { ...a, minutes: 80 });
  assert.equal(state.logs.length, 1); assert.equal(TG.weekStats(state, MONDAY).actual.power, 80);
  apply(state, 'attendance:attend', { ...a, minutes: 85, evidence: '学习收获' });
  assert.equal(state.logs.length, 1); assert.equal(TG.weekStats(state, MONDAY).actual.power, 85); assert.equal(TG.weekStats(state, MONDAY).attendanceCount, 1);
});

test('attendance beyond power target reserves only the excess and zero target reserves all minutes', () => {
  const state = TG.newState(), week = TG.getWeek(state, MONDAY);
  apply(state, 'attendance:plan', { date: '2026-09-08', courseId: 'audit-tue', plannedMinutes: 400 });
  let stats = TG.weekStats(state, MONDAY);
  assert.equal(stats.plannedAttendanceMinutes, 400); assert.equal(stats.attendanceOverGoalMinutes, 100); assert.equal(stats.allocatedMinutes, 2050);
  apply(state, 'week', { monday: MONDAY, ...week, goals: { ...week.goals, power: 0 } }); stats = TG.weekStats(state, MONDAY);
  assert.equal(stats.attendanceOverGoalMinutes, 400); assert.equal(stats.allocatedMinutes, 2050);
  apply(state, 'attendance:cancel', { date: '2026-09-08', courseId: 'audit-tue' });
  assert.equal(TG.weekStats(state, MONDAY).allocatedMinutes, 1650);
});

test('cancel attendance preserves or deletes log explicitly without multiplying repeated records', () => {
  const state = TG.newState(), a = { date: '2026-09-08', courseId: 'audit-tue' };
  apply(state, 'attendance:plan', { ...a, plannedMinutes: 90 }); apply(state, 'attendance:attend', { ...a, minutes: 80 });
  apply(state, 'attendance:cancel', a); assert.equal(state.logs.length, 1); assert.equal(state.attendance[0].plannedMinutes, 0);
  apply(state, 'attendance:plan', { ...a, plannedMinutes: 90 }); apply(state, 'attendance:attend', { ...a, minutes: 80 });
  assert.equal(state.logs.length, 1);
  apply(state, 'attendance:cancel', { ...a, deleteLog: true }); assert.equal(state.logs.length, 0); assert.equal(state.attendance.length, 0);
});

test('direct log deletion clears attendance references and permits one subsequent replacement', () => {
  const state = TG.newState(), a = { date: '2026-09-08', courseId: 'audit-tue' };
  apply(state, 'attendance:attend', { ...a, minutes: 80 }); const logId = state.attendance[0].logId;
  apply(state, 'log:delete', { id: logId }); assert.equal(state.attendance[0].attended, false);
  apply(state, 'attendance:attend', { ...a, minutes: 30 }); assert.equal(state.logs.length, 1); assert.equal(TG.weekStats(state, MONDAY).actual.power, 30);
  assert.throws(() => apply(clone(state), 'log:edit', { id: state.logs[0].id, category: 'math' }));
});

test('weight means ignore missing days and separate rolling seven days from calendar week', () => {
  const state = TG.newState();
  for (const [date, weight] of [['2026-08-31', 160], ['2026-09-06', 158], ['2026-09-07', 157], ['2026-09-09', 155], ['2026-09-10', null]]) apply(state, 'health:set', { date, weight, trained: false });
  const stats = TG.healthStats(state, '2026-09-13');
  assert.equal(stats.recent.count, 2); assert.equal(stats.recent.average, 156);
  assert.equal(stats.previous.count, 2); assert.equal(stats.previous.average, 159); assert.equal(stats.change, -3);
  assert.deepEqual(stats.current, { date: '2026-09-09', weight: 155 });
  assert.equal(TG.healthStats(state, '2026-09-09').recent.count, 3);
  assert.equal(TG.weekStats(state, MONDAY).weight.count, 2);
  apply(state, 'health:set', { date: '2026-09-09', weight: 156, trained: true });
  assert.equal(state.health.length, 5); assert.equal(TG.weekStats(state, MONDAY).weight.average, 156.5);
});

test('missing previous or current weight produces null change and no fabricated baseline record', () => {
  const state = TG.newState(); let stats = TG.healthStats(state, MONDAY);
  assert.equal(stats.current, null); assert.equal(stats.recent.average, null); assert.equal(stats.change, null);
  assert.equal(stats.startWeight, 158); assert.equal(stats.targetWeight, 128);
  apply(state, 'health:set', { date: MONDAY, weight: 157, trained: false }); stats = TG.healthStats(state, MONDAY);
  assert.equal(stats.change, null); assert.equal(stats.recent.count, 1); assert.equal(stats.previous.count, 0);
});

test('review frozen facts and text survive later completion and next-week changes', () => {
  const state = TG.newState(); addTask(state, 'task-cross', { date: '2026-09-13' });
  addLog(state, 'log-sun', '2026-09-13', 40, { taskId: 'task-cross' });
  apply(state, 'task:postpone', { id: 'task-cross', today: '2026-09-13' }, '2026-09-13T20:00:00+08:00');
  const r = { progress: '学会了一个概念', adjustments: '减少无计划投入', outcomes: '三个结果' }, cutoff = '2026-09-13T21:00:00+08:00';
  const text = TG.summaryText(state, MONDAY, { cutoffISO: cutoff, nextCoursesText: '周二7–8节，可选旁听；CAD实验时间待定', reflection: r });
  apply(state, 'review:save', { monday: MONDAY, text, reflection: r }, cutoff);
  const snapshot = JSON.stringify(state.reviews[MONDAY]);
  apply(state, 'task:complete', { id: 'task-cross' }, '2026-09-14T12:00:00+08:00');
  addLog(state, 'log-mon', '2026-09-14', 20, { taskId: 'task-cross' });
  apply(state, 'week:applyNext', { monday: MONDAY, ...TG.getWeek(state, MONDAY), goals: { ...TG.getWeek(state, MONDAY).goals, english: 999 } });
  assert.equal(JSON.stringify(state.reviews[MONDAY]), snapshot);
  assert.equal(state.reviews[MONDAY].stats.completedCount, 0); assert.equal(state.reviews[MONDAY].stats.actual.english, 40);
  assert.match(text, /跨周延期/); assert.match(text, /CAD实验时间待定/); assert.match(text, /完成任务：0\/1/);
  assert.deepEqual(TG.parseImport(TG.exportData(state, T)).state.reviews, state.reviews);
});

test('full export-clear-import restores every persistent collection exactly', () => {
  let state = TG.newState(); addTask(state); addLog(state, 'log-a', MONDAY, 30, { taskId: 'task-a', evidence: '<script>文本保持原样</script>' });
  apply(state, 'week', { monday: MONDAY, ...TG.getWeek(state, MONDAY) }); apply(state, 'main:set', { date: MONDAY, taskId: 'task-a' });
  apply(state, 'health:set', { date: MONDAY, weight: 158, trained: true });
  apply(state, 'settings', { direction: '自定义方向', hideStocks: true });
  apply(state, 'attendance:attend', { date: '2026-09-08', courseId: 'audit-tue', minutes: 90 });
  apply(state, 'review:save', { monday: MONDAY, text: '快照' });
  const original = clone(state), json = TG.exportData(state, T); state = TG.newState();
  state = TG.parseImport(json).state; assert.deepEqual(state, original);
  assert.equal(TG.parseImport(json).counts.logs, 2);
});

test('damaged and incompatible imports reject without mutating existing state', () => {
  const state = TG.newState(); addTask(state); const before = JSON.stringify(state);
  for (const text of ['', '{bad', '[]', 'null', '{"schemaVersion":2}', JSON.stringify(state)]) assert.throws(() => TG.parseImport(text));
  badImport(state, e => { e.schemaVersion = 999; }); badImport(state, e => { e.data.schemaVersion = 999; });
  badImport(state, e => { e.data.unexpected = 1; }); badImport(state, e => { delete e.data.logs; });
  badImport(state, e => { e.exportedAt = '2026-09-07T24:00:00Z'; });
  assert.equal(JSON.stringify(state), before);
});

test('duplicate IDs, broken task links and duplicate health days are rejected', () => {
  const state = TG.newState(); addTask(state); addLog(state, 'log-a', MONDAY, 30, { taskId: 'task-a' });
  apply(state, 'health:set', { date: MONDAY, weight: 158, trained: true });
  badImport(state, e => e.data.tasks.push(clone(e.data.tasks[0])));
  badImport(state, e => { e.data.logs[0].id = 'task-a'; });
  badImport(state, e => { e.data.logs[0].taskId = 'missing-task'; });
  badImport(state, e => { e.data.mainByDate[MONDAY] = 'missing-task'; });
  badImport(state, e => e.data.health.push(clone(e.data.health[0])));
});

test('invalid numbers, dates, unknown fields and malformed history are rejected', () => {
  const state = TG.newState(); addTask(state); addLog(state, 'log-a', MONDAY, 30);
  badImport(state, e => { e.data.logs[0].date = '2026-02-30'; });
  for (const minutes of [-1, 0, 1.5, 1441, '60', null]) badImport(state, e => { e.data.logs[0].minutes = minutes; });
  badImport(state, e => { e.data.logs[0].category = 'unknown'; });
  badImport(state, e => { e.data.tasks[0].actualMinutes = 100; });
  badImport(state, e => { e.data.tasks[0].date = '2026-09-08'; });
  badImport(state, e => { e.data.tasks[0].status = 'done'; });
  const envelope = TG.exportData(state, T).replace('"minutes": 30', '"minutes": 1e999');
  assert.throws(() => TG.parseImport(envelope));
});

test('prototype pollution keys are rejected at every object layer', () => {
  const state = TG.newState(); addTask(state); const encoded = TG.exportData(state, T);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const envelope = JSON.parse(encoded); Object.defineProperty(envelope.data.settings, key, { enumerable: true, value: { polluted: true } });
    assert.throws(() => TG.parseImport(JSON.stringify(envelope)));
    const again = JSON.parse(encoded); Object.defineProperty(again.data.weeks, key, { enumerable: true, value: {} });
    assert.throws(() => TG.parseImport(JSON.stringify(again)));
  }
  assert.equal({}.polluted, undefined);
});

test('attendance imports reject missing logs, duplicated associations and mismatched dates', () => {
  const state = TG.newState(); apply(state, 'attendance:attend', { date: '2026-09-08', courseId: 'audit-tue', minutes: 90 });
  badImport(state, e => { e.data.attendance[0].logId = 'missing'; });
  badImport(state, e => { e.data.attendance[0].date = '2026-09-09'; });
  badImport(state, e => e.data.attendance.push(clone(e.data.attendance[0])));
  badImport(state, e => e.data.attendance.push({ ...e.data.attendance[0], courseId: 'another-course' }));
});

test('mutation validation rejects unknown actions and prototype settings payloads', () => {
  const state = TG.newState(); assert.throws(() => apply(state, 'nonexistent', {}));
  assert.throws(() => apply(clone(state), 'settings', JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.throws(() => apply(clone(state), 'week', { monday: MONDAY, ...TG.getWeek(state, MONDAY), goals: { ...TG.getWeek(state, MONDAY).goals, fitness: 8 } }));
  assert.throws(() => apply(clone(state), 'health:set', { date: MONDAY, weight: 0, trained: true }));
});

process.stdout.write('\n' + passed + ' core acceptance tests passed' + (process.exitCode ? '; FAILURES PRESENT' : '; all PASS') + '\n');
