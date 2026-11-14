'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const TG = require('./core.js');
const V2 = require('./backups/20260907-v12/core.js');
const V1 = require('./backups/20260907-v11/core.js');
const MONDAY = '2026-09-07', T = '2026-09-07T12:00:00+08:00', CUTOFF = '2026-09-13T23:59:59+08:00';
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.exitCode = 1; process.stderr.write('FAIL ' + name + '\n' + error.stack + '\n'); }
}
function apply(state, action, payload, now = T) { return TG.mutate(state, action, payload, now); }
function plan(extra = {}) {
  return { courseId: 'micro-tue', week: 1, date: '2026-09-08', topic: '', preQuestions: [], minimumGoals: [], standardGoals: [], stretchGoals: [], evidence: [], reflection: '', unresolvedProblem: '', levelReached: 'unreviewed', ...extra };
}
function save(state, values = {}) {
  const p = plan(values); apply(state, 'coursePlan:save', p);
  return TG.getCoursePlan(state, p.courseId, p.date);
}
function task(state, planId, extra = {}) {
  apply(state, 'task:add', { id: 'review-task', title: '课后复盘', category: 'school', date: '2026-09-08', estimatedMinutes: 30, coursePlanId: planId, ...extra });
}
function fixture(api) {
  const state = api.newState();
  const go = (action, values) => api.mutate(state, action, values, T);
  go('week', { monday: MONDAY, ...api.getWeek(state, MONDAY) });
  go('task:add', { id: 'old-task', title: '旧任务', category: 'stocks', date: MONDAY });
  go('log:add', { id: 'old-log', date: MONDAY, category: 'stocks', minutes: 31, taskId: 'old-task', evidence: '原学习证据' });
  go('health:set', { date: MONDAY, weight: 156.3, trained: true });
  go('main:set', { date: MONDAY, taskId: 'old-task' });
  go('attendance:attend', { date: '2026-09-08', courseId: 'power-tue', minutes: 80 });
  go('review:save', { monday: MONDAY, text: '旧总结保留\n空格  \n标点。', reflection: { progress: '旧进展', adjustments: '旧调整', outcomes: '旧结果' } });
  return state;
}
function rejectImport(state, edit) {
  const envelope = JSON.parse(TG.exportData(state, T)); edit(envelope.data);
  assert.throws(() => TG.parseImport(JSON.stringify(envelope)));
}
test('schema 3 has an empty plan collection and ordinary tasks explicitly have null associations', () => {
  const state = TG.newState(); assert.equal(state.schemaVersion, 3); assert.deepEqual(state.courseLearningPlans, []);
  apply(state, 'task:add', { title: '普通任务', category: 'english', date: MONDAY });
  assert.equal(state.tasks[0].coursePlanId, null); assert.equal(TG.validateState(state), true);
  assert.equal(TG.getCoursePlan(state, 'micro-tue', '2026-09-08'), null);
});
test('real schema 1 and 2 fixtures migrate without altering existing fields, links or review snapshots', () => {
  for (const api of [V1, V2]) {
    const raw = fixture(api), before = JSON.stringify(raw), migrated = TG.upgradeState(raw);
    assert.equal(JSON.stringify(raw), before); assert.equal(migrated.schemaVersion, 3); assert.deepEqual(migrated.courseLearningPlans, []);
    for (const field of ['settings', 'logs', 'health', 'mainByDate', 'attendance', 'reviews']) assert.deepEqual(migrated[field], raw[field]);
    const legacyTask = clone(migrated.tasks[0]); assert.equal(legacyTask.coursePlanId, null); delete legacyTask.coursePlanId; assert.deepEqual(legacyTask, raw.tasks[0]);
    assert.equal(TG.taskMinutes(migrated, 'old-task'), 31);
    assert.equal(migrated.weeks[MONDAY].goals.agent, raw.schemaVersion === 1 ? 0 : 210);
    assert.deepEqual(TG.parseImport(api.exportData(raw, T)).state, migrated);
  }
});
test('migration preserves Chinese stock aliases and still rejects conflicting keys and missing old fields', () => {
  const raw = fixture(V2); raw.tasks[0].category = '股票/理财'; raw.logs[0].category = '财务/投资';
  const migrated = TG.upgradeState(raw); assert.equal(migrated.tasks[0].category, 'stocks'); assert.equal(migrated.logs[0].category, 'stocks');
  const missing = fixture(V2); delete missing.tasks[0].statusHistory; assert.throws(() => TG.upgradeState(missing));
  const conflict = fixture(V2); conflict.weeks[MONDAY].goals['股票/理财'] = 1; assert.throws(() => TG.upgradeState(conflict));
  const fabricated = fixture(V2); fabricated.courseLearningPlans = []; assert.throws(() => TG.upgradeState(fabricated));
  const badV3 = TG.newState(); delete badV3.courseLearningPlans; assert.throws(() => TG.upgradeState(badV3));
});
test('different courses and each week or lesson are independent plans', () => {
  const state = TG.newState();
  save(state, { topic: '周二主题' });
  save(state, { courseId: 'micro-thu', date: '2026-09-10', topic: '周四主题' });
  save(state, { courseId: 'network-tue', topic: '网络主题' });
  save(state, { week: 5, date: '2026-10-06', topic: '第五周主题' });
  assert.equal(state.courseLearningPlans.length, 4);
  assert.equal(TG.getCoursePlan(state, 'micro-tue', '2026-09-08').topic, '周二主题');
  assert.equal(TG.getCoursePlan(state, 'micro-tue', '2026-10-06').topic, '第五周主题');
  assert.equal(TG.getCoursePlan(state, 'micro-thu', '2026-09-10').topic, '周四主题');
});
test('empty plans have no invented course knowledge or automatic review and returned plans are detached', () => {
  const state = TG.newState(), p = save(state);
  assert.equal(p.topic, ''); assert.deepEqual(p.preQuestions, []); assert.deepEqual(p.minimumGoals, []); assert.deepEqual(p.standardGoals, []); assert.deepEqual(p.stretchGoals, []);
  assert.equal(p.levelReached, 'unreviewed'); assert.equal(TG.courseLearningStats(state, MONDAY, CUTOFF).reviewedCount, 0);
  p.minimumGoals.push('外部编辑'); assert.deepEqual(TG.getCoursePlan(state, 'micro-tue', '2026-09-08').minimumGoals, []);
  assert.match(TG.courseLearningText(state, p.id), /尚未填写/);
  assert.equal(state.tasks.length, 0); assert.equal(state.logs.length, 0);
});
test('three target arrays edit independently and same-lesson save upserts without duplicate IDs', () => {
  const state = TG.newState(); const first = save(state, { minimumGoals: ['保底'], standardGoals: ['达标1', '达标2'], stretchGoals: ['进阶'] });
  const second = save(state, { minimumGoals: ['新版保底'], standardGoals: ['达标1', '达标2'], stretchGoals: ['进阶'] });
  assert.equal(state.courseLearningPlans.length, 1); assert.equal(second.id, first.id);
  assert.deepEqual(second.minimumGoals, ['新版保底']); assert.deepEqual(second.standardGoals, ['达标1', '达标2']); assert.deepEqual(second.stretchGoals, ['进阶']);
  apply(state, 'coursePlan:save', { ...second, standardGoals: ['独立编辑达标'], stretchGoals: [] });
  assert.deepEqual(TG.getCoursePlan(state, second.courseId, second.date).minimumGoals, ['新版保底']);
  assert.deepEqual(TG.getCoursePlan(state, second.courseId, second.date).stretchGoals, []);
});
test('plan metadata and targets alone never count as reviewed', () => {
  const state = TG.newState(); save(state, { topic: '课程主题', preQuestions: ['带着什么问题'], minimumGoals: ['保底'], standardGoals: ['达标'], stretchGoals: ['进阶'], reflection: '   ', unresolvedProblem: '  ' });
  const stats = TG.courseLearningStats(state, MONDAY, CUTOFF);
  assert.deepEqual(stats, { reviewedCount: 0, minimumCount: 0, standardCount: 0, stretchCount: 0, blockedCount: 0, records: [] });
});
test('evidence and actual outcomes save independently without upgrading self-assessed level', () => {
  const state = TG.newState(); const p = save(state, { evidence: ['explain', 'draw'], reflection: '独立说清结构' });
  assert.equal(p.levelReached, 'unreviewed');
  const stats = TG.courseLearningStats(state, MONDAY, CUTOFF);
  assert.equal(stats.reviewedCount, 1); assert.equal(stats.minimumCount, 0); assert.equal(stats.standardCount, 0); assert.equal(stats.stretchCount, 0);
  const text = TG.courseLearningText(state, p.id); assert.match(text, /独立说清结构/); assert.match(text, /不看教材解释/); assert.match(text, /独立画出/);
});
test('minimum, standard and stretch counts are mutually exclusive explicit self-assessments', () => {
  const state = TG.newState();
  save(state, { levelReached: 'minimum', stretchGoals: ['可选进阶尚未完成'] });
  save(state, { courseId: 'micro-thu', date: '2026-09-10', levelReached: 'standard', evidence: ['stuck'] });
  save(state, { courseId: 'network-tue', levelReached: 'stretch' });
  const stats = TG.courseLearningStats(state, MONDAY, CUTOFF);
  assert.equal(stats.reviewedCount, 3); assert.equal(stats.minimumCount, 1); assert.equal(stats.standardCount, 1); assert.equal(stats.stretchCount, 1); assert.equal(stats.blockedCount, 1);
  const p = TG.getCoursePlan(state, 'micro-tue', '2026-09-08'); assert.equal(p.levelReached, 'minimum');
  assert.doesNotMatch(TG.courseLearningText(state, p.id), /失败|逾期/);
});
test('blocked facts accept explicit status, stuck evidence or written problem without double count', () => {
  const state = TG.newState();
  save(state, { levelReached: 'blocked', evidence: ['stuck'], unresolvedProblem: '一个卡点' });
  save(state, { courseId: 'micro-thu', date: '2026-09-10', unresolvedProblem: '只有文字卡点' });
  save(state, { courseId: 'network-tue', evidence: ['stuck'] });
  const stats = TG.courseLearningStats(state, MONDAY, CUTOFF);
  assert.equal(stats.reviewedCount, 3); assert.equal(stats.blockedCount, 3); assert.equal(stats.minimumCount + stats.standardCount + stats.stretchCount, 0);
});
test('statistics respect week and cutoff date, exclude future lessons and return detached records', () => {
  const state = TG.newState();
  save(state, { levelReached: 'minimum' }); save(state, { courseId: 'micro-thu', date: '2026-09-10', levelReached: 'standard' });
  save(state, { week: 2, date: '2026-09-15', levelReached: 'stretch' });
  assert.equal(TG.courseLearningStats(state, MONDAY, '2026-09-08T23:59:59+08:00').reviewedCount, 1);
  assert.equal(TG.courseLearningStats(state, MONDAY, CUTOFF).reviewedCount, 2);
  assert.equal(TG.courseLearningStats(state, '2026-09-14', CUTOFF).reviewedCount, 0);
  const stats = TG.courseLearningStats(state, MONDAY, CUTOFF); stats.records[0].topic = '不应回写';
  assert.equal(TG.getCoursePlan(state, 'micro-tue', '2026-09-08').topic, '');
});
test('course copy text contains exact timetable metadata and all user-authored learning sections', () => {
  const state = TG.newState(), p = save(state, { topic: '用户主题', preQuestions: ['前置问题'], minimumGoals: ['保底问题'], standardGoals: ['达标问题'], stretchGoals: ['进阶问题'], reflection: '实际产出', evidence: ['solve', 'teach'], unresolvedProblem: '仍有疑问', levelReached: 'standard' });
  const text = TG.courseLearningText(state, p.id);
  for (const value of ['微型计算机原理及接口技术', '门洪', '二东201', '第1周', '2026-09-08 周二 1–2节', '用户主题', '前置问题', '保底问题', '达标问题', '进阶问题', '实际产出', '独立完成基础题', '把内容讲给别人', '仍有疑问', '达到达标线']) assert.ok(text.includes(value), value);
  assert.match(text, /复盘实际完成的内容、核对学习证据/); assert.match(text, /优先解决仍存在的卡点/); assert.match(text, /信息不足时请先询问/);
  const optional = save(state, { courseId: 'power-tue' }); assert.match(TG.courseLearningText(state, optional.id), /可选旁听/);
  assert.throws(() => TG.courseLearningText(state, 'missing'));
});
test('fixed course plan creation never adds minutes, reserves budget or generates a task', () => {
  const state = TG.newState(), before = TG.weekStats(state, MONDAY);
  save(state, { levelReached: 'stretch', evidence: ['explain'], reflection: '已写成果' });
  const after = TG.weekStats(state, MONDAY);
  assert.equal(after.allocatedMinutes, before.allocatedMinutes); assert.equal(after.totalMinutes, 0);
  assert.equal(state.logs.length, 0); assert.equal(state.tasks.length, 0); assert.equal(state.attendance.length, 0);
});
test('repeated after-class task creation reuses the existing linked task and never overwrites its content', () => {
  const state = TG.newState(), p = save(state); task(state, p.id);
  const original = JSON.stringify(state.tasks[0]); task(state, p.id, { id: 'second-id', title: '不应覆盖原任务', estimatedMinutes: 99 });
  assert.equal(state.tasks.length, 1); assert.equal(JSON.stringify(state.tasks[0]), original);
  assert.equal(state.tasks[0].coursePlanId, p.id); assert.equal(state.logs.length, 0);
  apply(state, 'task:complete', { id: 'review-task' }); apply(state, 'task:complete', { id: 'review-task' });
  assert.equal(state.logs.length, 0); assert.equal(TG.getCoursePlan(state, p.courseId, p.date).levelReached, 'unreviewed');
});
test('review task logs count once by real date and task edit, update or postponement preserves its lesson', () => {
  const state = TG.newState(), p = save(state); task(state, p.id);
  apply(state, 'log:add', { id: 'real-log', date: '2026-09-13', category: 'school', minutes: 20, taskId: 'review-task' });
  apply(state, 'log:add', { id: 'next-log', date: '2026-09-14', category: 'school', minutes: 10, taskId: 'review-task' });
  apply(state, 'task:complete', { id: 'review-task' }); apply(state, 'task:complete', { id: 'review-task' });
  assert.equal(TG.taskMinutes(state, 'review-task'), 30); assert.equal(TG.weekStats(state, MONDAY).actual.school, 20); assert.equal(TG.weekStats(state, '2026-09-14').actual.school, 10);
  apply(state, 'task:edit', { id: 'review-task', title: '更名' }); apply(state, 'task:update', { id: 'review-task', category: 'other' });
  apply(state, 'task:postpone', { id: 'review-task', today: '2026-09-13' }, '2026-09-13T20:00:00+08:00');
  assert.equal(state.tasks[0].coursePlanId, p.id); assert.equal(state.tasks[0].date, '2026-09-14');
  assert.equal(TG.getCoursePlan(state, p.courseId, p.date).date, '2026-09-08'); assert.equal(state.logs[0].category, 'school');
  assert.throws(() => apply(clone(state), 'task:edit', { id: 'review-task', coursePlanId: null }));
});
test('deleting a linked task preserves course plan, respects log choice and allows a new review task', () => {
  for (const deleteLogs of [false, true]) {
    const state = TG.newState(), p = save(state, { reflection: '课程成果' }); task(state, p.id);
    apply(state, 'log:add', { id: 'real-log', date: '2026-09-08', category: 'school', minutes: 30, taskId: 'review-task' });
    apply(state, 'task:delete', { id: 'review-task', deleteLogs });
    assert.equal(state.courseLearningPlans.length, 1); assert.equal(state.courseLearningPlans[0].reflection, '课程成果');
    assert.equal(state.logs.length, deleteLogs ? 0 : 1); if (!deleteLogs) assert.equal(state.logs[0].taskId, null);
    task(state, p.id, { id: 'new-task' }); assert.equal(state.tasks.length, 1); assert.equal(state.tasks[0].coursePlanId, p.id);
  }
});
test('plan edits retain association but cannot move an existing plan to another lesson', () => {
  const state = TG.newState(), p = save(state); task(state, p.id);
  apply(state, 'coursePlan:save', { ...p, reflection: '新产出' }); assert.equal(state.tasks[0].coursePlanId, p.id);
  assert.throws(() => apply(clone(state), 'coursePlan:save', { ...p, week: 2, date: '2026-09-15' }));
  assert.throws(() => apply(clone(state), 'coursePlan:save', { ...p, courseId: 'network-tue' }));
});
test('export and import schema 3 completely restore plans, linked tasks, evidence and outcomes', () => {
  const state = TG.upgradeState(fixture(V2)), oldSummary = JSON.stringify(state.reviews[MONDAY]);
  const p = save(state, { minimumGoals: ['保底'], evidence: ['explain', 'stuck'], reflection: '可证明的成果', unresolvedProblem: '具体卡点', levelReached: 'minimum' }); task(state, p.id);
  const json = TG.exportData(state, T), envelope = JSON.parse(json), parsed = TG.parseImport(json);
  assert.equal(envelope.schemaVersion, 3); assert.equal(envelope.data.schemaVersion, 3); assert.equal(parsed.counts.courseLearningPlans, 1);
  assert.deepEqual(parsed.state, state); assert.equal(JSON.stringify(parsed.state.reviews[MONDAY]), oldSummary);
  assert.deepEqual(TG.upgradeState(parsed.state), parsed.state);
});
test('new weekly text includes course facts and outcomes while saved old summaries remain frozen', () => {
  const state = TG.upgradeState(fixture(V2)), oldSummary = JSON.stringify(state.reviews[MONDAY]);
  save(state, { topic: '用户填写的章节主题', minimumGoals: ['保底'], levelReached: 'minimum', reflection: '已能解释', unresolvedProblem: '卡在中断', evidence: ['explain', 'stuck'] });
  save(state, { courseId: 'micro-thu', date: '2026-09-10', topic: '只有计划不算复盘' });
  const text = TG.summaryText(state, MONDAY, { cutoffISO: CUTOFF });
  assert.match(text, /已复盘课程：1；达到保底线：1；达到达标线：0；达到进阶线：0；存在卡点：1/);
  assert.match(text, /已能解释/); assert.match(text, /卡在中断/); assert.match(text, /固定课时不加入自主学习分钟/);
  assert.match(text, /本节主题：用户填写的章节主题/);
  assert.equal(JSON.stringify(state.reviews[MONDAY]), oldSummary);
  apply(state, 'review:save', { monday: MONDAY, text }, CUTOFF); const frozen = JSON.stringify(state.reviews[MONDAY]);
  const p = TG.getCoursePlan(state, 'micro-tue', '2026-09-08'); apply(state, 'coursePlan:save', { ...p, reflection: '后来修改' });
  assert.equal(JSON.stringify(state.reviews[MONDAY]), frozen);
});
test('bad course IDs, actual weekday or teaching-week boundaries reject entire imports', () => {
  const state = TG.newState(); save(state);
  for (const edit of [p => { p.courseId = 'missing'; }, p => { p.date = '2026-09-09'; }, p => { p.week = 2; }, p => { p.date = '2026-02-30'; }, p => { p.week = 12; p.date = '2026-11-24'; }, p => { p.week = 0; }, p => { p.courseId = 'software-mon'; p.date = MONDAY; }]) rejectImport(state, s => edit(s.courseLearningPlans[0]));
});
test('duplicate plan keys, IDs, task links and missing fields reject imports without altering live state', () => {
  const state = TG.newState(), p = save(state); task(state, p.id); const original = JSON.stringify(state);
  rejectImport(state, s => { s.courseLearningPlans.push({ ...clone(s.courseLearningPlans[0]), id: 'duplicate-lesson' }); });
  rejectImport(state, s => { s.courseLearningPlans.push({ ...clone(s.courseLearningPlans[0]), courseId: 'network-tue' }); });
  rejectImport(state, s => { s.courseLearningPlans[0].id = s.tasks[0].id; });
  rejectImport(state, s => { s.tasks[0].coursePlanId = 'missing-plan'; });
  rejectImport(state, s => { s.tasks.push({ ...clone(s.tasks[0]), id: 'double-review' }); });
  rejectImport(state, s => { delete s.tasks[0].coursePlanId; });
  rejectImport(state, s => { delete s.courseLearningPlans[0].preQuestions; });
  rejectImport(state, s => { s.courseLearningPlans[0].fakeMastery = 83; });
  assert.equal(JSON.stringify(state), original);
});
test('malformed, excessive or repeated plan arrays and oversized text are rejected', () => {
  const state = TG.newState(); save(state);
  const changes = [
    p => { p.preQuestions = '错误'; }, p => { p.minimumGoals = [1]; }, p => { p.standardGoals = ['']; },
    p => { p.stretchGoals = Array(51).fill('太多'); }, p => { p.minimumGoals = ['x'.repeat(1001)]; },
    p => { p.topic = 'x'.repeat(501); }, p => { p.reflection = 'x'.repeat(10001); }, p => { p.unresolvedProblem = 'x'.repeat(10001); },
    p => { p.evidence = ['explain', 'explain']; }, p => { p.evidence = ['83%']; }, p => { p.levelReached = 'mastered83'; },
    p => { Object.defineProperty(p, '__proto__', { value: { polluted: true }, enumerable: true }); }
  ];
  for (const change of changes) rejectImport(state, s => change(s.courseLearningPlans[0]));
  assert.equal({}.polluted, undefined);
});
test('old-v2 envelope, current-v3 data mismatch and unknown versions are refused', () => {
  const data = TG.newState();
  assert.throws(() => TG.parseImport(JSON.stringify({ schemaVersion: 2, exportedAt: T, data })));
  assert.throws(() => TG.parseImport(JSON.stringify({ schemaVersion: 3, exportedAt: T, data: fixture(V2) })));
  assert.throws(() => TG.upgradeState({ ...data, schemaVersion: 4 }));
});
test('browser exports validate plans with bundled course data and no network or storage', () => {
  const sandbox = {}; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('./core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('./courses.js'), 'utf8'), sandbox);
  const output = vm.runInContext("var state=TG.newState(); TG.mutate(state,'coursePlan:save'," + JSON.stringify(plan()) + ", '2026-09-07T12:00:00+08:00'); JSON.stringify([state.schemaVersion,state.courseLearningPlans.length,TG.validateState(state)])", sandbox);
  assert.deepEqual(JSON.parse(output), [3, 1, true]);
});
test('real timetable date validation is stable across host timezones', () => {
  const code = "const g=require('./core.js');const s=g.newState();g.mutate(s,'coursePlan:save'," + JSON.stringify(plan()) + ", '2026-09-07T12:00:00+08:00');process.stdout.write(JSON.stringify(s.courseLearningPlans.map(p=>[p.courseId,p.date,p.week])))";
  const values = ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'].map(TZ => execFileSync(process.execPath, ['-e', code], { cwd: __dirname, env: { ...process.env, TZ }, encoding: 'utf8' }));
  assert.equal(values[0], values[1]); assert.equal(values[1], values[2]);
});
process.stdout.write('\nRESULT ' + passed + ' PASS' + (process.exitCode ? ' / FAILURES PRESENT' : ' / 0 FAIL') + '\n');
