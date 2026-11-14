'use strict';
const assert = require('node:assert/strict');
const TG = require('./core.js');
const Legacy = require('./backups/20260907-v11/core.js');
const MONDAY = '2026-09-07', NEXT = '2026-09-14', T = '2026-09-07T12:00:00+08:00';
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.exitCode = 1; process.stderr.write('FAIL ' + name + '\n' + error.stack + '\n'); }
}
function apply(state, action, payload, now = T) { return TG.mutate(state, action, payload, now); }
function legacyFixture() {
  const state = Legacy.newState(); assert.equal(state.schemaVersion, 1);
  const old = (action, payload, now = T) => Legacy.mutate(state, action, payload, now);
  old('settings', { direction: '原方向', focus: '原重点', defer: '原暂缓', hideStocks: true });
  old('week', { monday: MONDAY, ...Legacy.getWeek(state, MONDAY), goals: { ...Legacy.getWeek(state, MONDAY).goals, stocks: 90, other: 75 } });
  old('week', { monday: NEXT, ...Legacy.getWeek(state, NEXT), budgetMinutes: 1200, goals: { ...Legacy.getWeek(state, NEXT).goals, english: 300 } });
  old('task:add', { id: 'stock-task', title: '原投资任务', category: 'stocks', date: MONDAY, estimatedMinutes: 60, priority: 'high', notes: '保留原备注', evidence: '原证据' });
  old('task:add', { id: 'english-task', title: '跨周英语任务', category: 'english', date: '2026-09-13' });
  old('main:set', { date: MONDAY, taskId: 'stock-task' });
  old('log:add', { id: 'stock-log', date: MONDAY, category: 'stocks', minutes: 31, taskId: 'stock-task', evidence: '旧财务投入' });
  old('log:add', { id: 'english-log', date: '2026-09-13', category: 'english', minutes: 45, taskId: 'english-task' });
  old('attendance:plan', { date: '2026-09-08', courseId: 'power-tue', plannedMinutes: 90 });
  old('attendance:attend', { date: '2026-09-08', courseId: 'power-tue', minutes: 80, evidence: '原旁听成果' });
  old('health:set', { date: MONDAY, weight: 157.4, trained: true });
  old('health:set', { date: '2026-09-08', weight: null, trained: false });
  old('task:complete', { id: 'stock-task' }, '2026-09-07T15:00:00+08:00');
  old('task:postpone', { id: 'english-task', today: '2026-09-13' }, '2026-09-13T21:00:00+08:00');
  old('review:save', { monday: MONDAY, text: '第1教学周\n股票/理财：原统计\n保持每个字符与空格  ', reflection: { progress: '原成果', adjustments: '原调整', outcomes: '原下周结果' } }, '2026-09-13T22:00:00+08:00');
  return state;
}
function rejectWithoutMutation(state) {
  const before = JSON.stringify(state);
  assert.throws(() => TG.upgradeState(state));
  assert.equal(JSON.stringify(state), before);
}
test('current schema eight-category contract and new default preserve other category IDs', () => {
  const state = TG.newState(); assert.equal(state.schemaVersion, 3);
  assert.deepEqual(TG.CATEGORIES.map(c => c.id), ['school', 'english', 'math', 'power', 'agent', 'fitness', 'stocks', 'other']);
  assert.equal(TG.CATEGORIES.find(c => c.id === 'agent').label, 'AI / Agent');
  assert.equal(TG.CATEGORIES.find(c => c.id === 'stocks').label, '财务/投资');
  assert.equal(TG.getWeek(state, MONDAY).goals.agent, 210);
  assert.equal(TG.getWeek(state, MONDAY).goals.stocks, 0);
  assert.equal(TG.weekStats(state, MONDAY).allocatedMinutes, 1950);
  assert.equal(TG.weekStats(state, MONDAY).remainingMinutes, -150);
});
test('real version 1 state upgrades without changing any original collection or saved target value', () => {
  const raw = legacyFixture(), before = JSON.stringify(raw), result = TG.upgradeState(raw);
  assert.equal(JSON.stringify(raw), before); assert.notEqual(result, raw); assert.equal(result.schemaVersion, 3);
  for (const key of ['settings', 'logs', 'health', 'mainByDate', 'attendance', 'reviews']) assert.deepEqual(result[key], raw[key]);
  assert.deepEqual(result.tasks, raw.tasks.map(task => ({ ...task, coursePlanId: null })));
  assert.deepEqual(result.courseLearningPlans, []);
  for (const monday of Object.keys(raw.weeks)) {
    assert.equal(result.weeks[monday].goals.agent, 0);
    const withoutAgent = clone(result.weeks[monday]); delete withoutAgent.goals.agent;
    assert.deepEqual(withoutAgent, raw.weeks[monday]);
  }
  assert.equal(TG.taskMinutes(result, 'stock-task'), 31);
  assert.equal(TG.weekStats(result, MONDAY).allocatedMinutes, Legacy.weekStats(raw, MONDAY).allocatedMinutes);
  assert.equal(TG.weekStats(result, MONDAY).attendanceCount, 1);
  assert.equal(TG.focusTasks(result, MONDAY).main.id, 'stock-task');
  assert.equal(TG.getWeek(result, '2026-09-21').goals.agent, 210);
});
test('upgrade is idempotent and returns detached copies for current schema data too', () => {
  const once = TG.upgradeState(legacyFixture()), twice = TG.upgradeState(once);
  assert.deepEqual(twice, once); assert.notEqual(twice, once); assert.notEqual(twice.tasks[0], once.tasks[0]);
  twice.weeks[MONDAY].goals.english = 1; assert.equal(once.weeks[MONDAY].goals.english, 420);
  twice.reviews[MONDAY].text = '独立副本'; assert.notEqual(once.reviews[MONDAY].text, '独立副本');
});
test('schema 1 JSON imports and re-exports current schema with exact recovery', () => {
  const raw = legacyFixture(), oldJSON = Legacy.exportData(raw, T);
  const parsed = TG.parseImport(oldJSON); assert.equal(parsed.exportedAt, T); assert.equal(parsed.state.schemaVersion, 3);
  assert.deepEqual(parsed.counts, { tasks: 2, logs: 3, health: 2, weeks: 2, attendance: 1, reviews: 1, courseLearningPlans: 0 });
  const exported = TG.exportData(parsed.state, T), envelope = JSON.parse(exported);
  assert.equal(envelope.schemaVersion, 3); assert.equal(envelope.data.schemaVersion, 3);
  assert.deepEqual(TG.parseImport(exported).state, parsed.state);
  assert.deepEqual(TG.parseImport(TG.exportData(TG.parseImport(exported).state, T)).state, parsed.state);
});
test('Chinese stock category and goals aliases normalize without losing minutes or associations', () => {
  for (const alias of ['股票/理财', '财务/投资']) {
    const raw = legacyFixture(); raw.tasks[0].category = alias; raw.logs[0].category = alias;
    raw.weeks[MONDAY].goals[alias] = raw.weeks[MONDAY].goals.stocks; delete raw.weeks[MONDAY].goals.stocks;
    raw.reviews[MONDAY].stats.goals[alias] = raw.reviews[MONDAY].stats.goals.stocks; delete raw.reviews[MONDAY].stats.goals.stocks;
    raw.reviews[MONDAY].stats.actual[alias] = raw.reviews[MONDAY].stats.actual.stocks; delete raw.reviews[MONDAY].stats.actual.stocks;
    const before = JSON.stringify(raw), result = TG.upgradeState(raw);
    assert.equal(JSON.stringify(raw), before); assert.equal(result.tasks[0].category, 'stocks'); assert.equal(result.logs[0].category, 'stocks');
    assert.equal(result.logs[0].taskId, 'stock-task'); assert.equal(result.weeks[MONDAY].goals.stocks, 90);
    assert.equal(result.reviews[MONDAY].stats.actual.stocks, 31); assert.equal(result.reviews[MONDAY].text, raw.reviews[MONDAY].text);
    assert.equal(TG.weekStats(result, MONDAY).actual.stocks, 31);
    const envelope = { schemaVersion: 1, exportedAt: T, data: raw };
    assert.deepEqual(TG.parseImport(JSON.stringify(envelope)).state, result);
  }
});
test('multiple stock goal keys conflict even when numerically equal, including review snapshots', () => {
  for (const alias of ['股票/理财', '财务/投资']) {
    for (const location of ['week', 'reviewGoal', 'reviewActual']) {
      const raw = legacyFixture();
      const goals = location === 'week' ? raw.weeks[MONDAY].goals : location === 'reviewGoal' ? raw.reviews[MONDAY].stats.goals : raw.reviews[MONDAY].stats.actual;
      goals[alias] = goals.stocks; rejectWithoutMutation(raw);
    }
  }
  const raw = legacyFixture(); delete raw.weeks[MONDAY].goals.stocks;
  raw.weeks[MONDAY].goals['股票/理财'] = 1; raw.weeks[MONDAY].goals['财务/投资'] = 2;
  rejectWithoutMutation(raw);
});
test('old snapshot bytes are preserved through AI activity, new plans and new snapshots', () => {
  const raw = legacyFixture(), originalSnapshot = JSON.stringify(raw.reviews[MONDAY]), state = TG.upgradeState(raw);
  apply(state, 'task:add', { id: 'ai-task', title: 'Agent练习', category: 'agent', date: NEXT });
  apply(state, 'log:add', { id: 'ai-log', date: NEXT, category: 'agent', minutes: 60, taskId: 'ai-task', evidence: '搭建一个检索节点' });
  apply(state, 'week', { monday: NEXT, ...TG.getWeek(state, NEXT), goals: { ...TG.getWeek(state, NEXT).goals, agent: 210 } });
  const text = TG.summaryText(state, NEXT, { cutoffISO: '2026-09-20T22:00:00+08:00' });
  assert.match(text, /AI \/ Agent：1\/3.5h/); assert.match(text, /财务\/投资/);
  apply(state, 'review:save', { monday: NEXT, text }, '2026-09-20T22:00:00+08:00');
  assert.equal(JSON.stringify(state.reviews[MONDAY]), originalSnapshot);
  assert.equal(Object.keys(state.reviews[MONDAY].stats.goals).length, 7);
  assert.equal(Object.keys(state.reviews[NEXT].stats.goals).length, 8);
  assert.equal(state.reviews[NEXT].stats.actual.agent, 60);
  const restored = TG.parseImport(TG.exportData(state, T)).state;
  assert.equal(JSON.stringify(restored.reviews[MONDAY]), originalSnapshot);
  assert.deepEqual(restored.reviews[NEXT], state.reviews[NEXT]);
});
test('AI tasks support main selection, repeated completion, cross-week logs, editing and deletion', () => {
  const state = TG.newState();
  apply(state, 'task:add', { id: 'ai-task', title: 'AI节点', category: 'agent', date: MONDAY, estimatedMinutes: 90, priority: 'high' });
  apply(state, 'main:set', { date: MONDAY, taskId: 'ai-task' });
  apply(state, 'log:add', { id: 'ai-log-1', date: '2026-09-13', category: 'agent', minutes: 40, taskId: 'ai-task' });
  apply(state, 'log:add', { id: 'ai-log-2', date: NEXT, category: 'agent', minutes: 20, taskId: 'ai-task' });
  assert.equal(TG.taskMinutes(state, 'ai-task'), 60); assert.equal(TG.weekStats(state, MONDAY).actual.agent, 40); assert.equal(TG.weekStats(state, NEXT).actual.agent, 20);
  apply(state, 'task:complete', { id: 'ai-task' }); apply(state, 'task:complete', { id: 'ai-task' });
  assert.equal(state.logs.length, 2); assert.equal(TG.focusTasks(state, MONDAY).main.status, 'done');
  apply(state, 'log:edit', { id: 'ai-log-1', minutes: 45 }); assert.equal(TG.weekStats(state, MONDAY).actual.agent, 45);
  apply(state, 'task:edit', { id: 'ai-task', title: '改进AI节点', category: 'other' }); assert.equal(TG.weekStats(state, MONDAY).actual.agent, 45);
  apply(state, 'task:delete', { id: 'ai-task', deleteLogs: false });
  assert.equal(state.logs[0].taskId, null); assert.equal(state.logs[0].category, 'agent');
  apply(state, 'log:delete', { id: 'ai-log-1' }); assert.equal(TG.weekStats(state, MONDAY).actual.agent, 0);
});
test('AI minutes and fitness training days stay separate with all eight categories present', () => {
  const state = TG.newState();
  for (const category of TG.CATEGORIES) apply(state, 'log:add', { id: 'log-' + category.id, date: MONDAY, category: category.id, minutes: 10 });
  apply(state, 'health:set', { date: MONDAY, weight: null, trained: true });
  const stats = TG.weekStats(state, MONDAY);
  assert.equal(stats.totalMinutes, 80); assert.equal(stats.actual.agent, 10); assert.equal(stats.actual.fitness, 1); assert.equal(stats.minutes.fitness, 10);
  assert.equal(Object.keys(stats.actual).length, 8); assert.equal(Object.keys(stats.progress).length, 8);
  assert.equal(stats.progress.agent.percent, 10 / 210 * 100);
});
test('migrated zero AI target reports unplanned actual; customized target persists independently', () => {
  const state = TG.upgradeState(legacyFixture());
  apply(state, 'log:add', { id: 'ai-log', date: MONDAY, category: 'agent', minutes: 15 });
  let stats = TG.weekStats(state, MONDAY); assert.equal(stats.progress.agent.percent, null); assert.equal(stats.progress.agent.label, '计划外投入');
  apply(state, 'week', { monday: MONDAY, ...TG.getWeek(state, MONDAY), goals: { ...TG.getWeek(state, MONDAY).goals, agent: 30 } });
  stats = TG.weekStats(state, MONDAY); assert.equal(stats.progress.agent.percent, 50);
  assert.equal(TG.getWeek(state, NEXT).goals.agent, 0); assert.equal(TG.getWeek(state, '2026-09-21').goals.agent, 210);
  assert.equal(TG.parseImport(TG.exportData(state, T)).state.weeks[MONDAY].goals.agent, 30);
});
test('migration cannot fabricate absent legacy fields or repair broken references', () => {
  const changes = [
    s => { delete s.logs; }, s => { delete s.weeks[MONDAY].goals.english; }, s => { delete s.tasks[0].statusHistory; },
    s => { delete s.health[0].trained; }, s => { s.logs[0].taskId = 'missing'; }, s => { s.mainByDate[MONDAY] = 'missing'; },
    s => { s.attendance[0].logId = 'missing'; }, s => { s.weeks[MONDAY].goals.agent = 210; }, s => { s.tasks[0].category = 'agent'; },
    s => { s.logs.push(clone(s.logs[0])); }, s => { s.logs[0].minutes = -1; }, s => { s.health[0].date = '2026-02-30'; }
  ];
  for (const change of changes) { const state = legacyFixture(); change(state); rejectWithoutMutation(state); }
});
test('current schema live plans require AI field, while saved review category sets must remain internally consistent', () => {
  const state = TG.upgradeState(legacyFixture());
  const missingLive = clone(state); delete missingLive.weeks[MONDAY].goals.agent; rejectWithoutMutation(missingLive);
  const incompleteSnapshot = clone(state); incompleteSnapshot.reviews[MONDAY].stats.goals.agent = 0; rejectWithoutMutation(incompleteSnapshot);
  const otherIncomplete = clone(state); otherIncomplete.reviews[MONDAY].stats.actual.agent = 0; rejectWithoutMutation(otherIncomplete);
  const unsupported = clone(state); unsupported.weeks[MONDAY].goals.random = 0; rejectWithoutMutation(unsupported);
  const badAI = clone(state); badAI.weeks[MONDAY].goals.agent = '210'; rejectWithoutMutation(badAI);
});
test('wrong schema, envelope mismatch and damaged imports are rejected', () => {
  for (const value of [null, [], {}, { schemaVersion: 999 }, { schemaVersion: '1' }]) assert.throws(() => TG.upgradeState(value));
  const original = legacyFixture();
  assert.throws(() => TG.parseImport(JSON.stringify({ schemaVersion: 2, exportedAt: T, data: original })));
  const current = TG.upgradeState(original);
  assert.throws(() => TG.parseImport(JSON.stringify({ schemaVersion: 1, exportedAt: T, data: current })));
  for (const text of ['{', 'null', '[]', '{}']) assert.throws(() => TG.parseImport(text));
  assert.throws(() => TG.validateState(original));
});
test('migration rejects dangerous keys, nonfinite numbers and unsupported values without JSON coercion', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const state = legacyFixture(); Object.defineProperty(state.weeks[MONDAY].goals, key, { value: { polluted: true }, enumerable: true });
    rejectWithoutMutation(state);
  }
  for (const value of [Infinity, -Infinity, NaN, undefined]) {
    const state = legacyFixture(); state.health[0].weight = value;
    assert.throws(() => TG.upgradeState(state)); assert.equal(state.health[0].weight, value);
  }
  const cyclic = legacyFixture(); cyclic.settings.focus = cyclic; assert.throws(() => TG.upgradeState(cyclic));
  const missingArray = legacyFixture(); delete missingArray.tasks[0]; assert.throws(() => TG.upgradeState(missingArray));
  const accessor = legacyFixture(); let called = false;
  Object.defineProperty(accessor.settings, 'focus', { get() { called = true; return '不应运行'; }, enumerable: true });
  assert.throws(() => TG.upgradeState(accessor)); assert.equal(called, false);
  assert.equal({}.polluted, undefined);
});
process.stdout.write('\nRESULT ' + passed + ' PASS' + (process.exitCode ? ' / FAILURES PRESENT' : ' / 0 FAIL') + '\n');
