'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('./courses.js');
const G = require('./core.js');
const baseline = require('./backups/20260919-schedule-update-baseline/courses.js');
const clone = value => JSON.parse(JSON.stringify(value));
const expectedGroups = [
  ['group-lab-1', '2026-10-14', 6, 3, 3],
  ['group-lab-2', '2026-10-20', 7, 2, 2],
  ['group-lab-3', '2026-10-22', 7, 4, 2],
  ['group-lab-4', '2026-10-27', 8, 2, 4]
];
let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log('PASS ' + name);
}
function occurrences(prefix) {
  const result = [];
  for (let week = 1; week <= 20; week += 1) {
    C.forWeek(week).filter(item => item.id.startsWith(prefix)).forEach(item => {
      result.push([item.id, G.addDays('2026-09-07', (week - 1) * 7 + item.day - 1), week, item.day, item.slot]);
    });
  }
  return result;
}
function fixture(id, extra = {}) {
  return { id, name: id, teacher: '待确认', room: '待确认', day: 2, slot: 2, weeks: [6, 7, 8], optional: false, notice: '', ...extra };
}
function rowKey(row) {
  return [row.week, row.day, row.slot, ...row.courseIds.slice().sort()].join('/');
}

check('all 30 baseline IDs and source fields retained; only authorized software weeks and micro metadata change', () => {
  assert.equal(baseline.courses.length, 30);
  const oldIds = new Set(baseline.courses.map(item => item.id));
  for (const original of baseline.courses) {
    const current = C.courses.find(item => item.id === original.id);
    assert.ok(current, 'retained ' + original.id);
    const expected = clone(original);
    if (original.id === 'software-mon' || original.id === 'software-wed') expected.weeks = [3, 4, 5, 6, 7, 8, 9, 10];
    const currentFields = Object.fromEntries(Object.keys(original).map(key => [key, current[key]]));
    assert.deepEqual(currentFields, expected, original.id + ' original fields');
    const additional = Object.keys(current).filter(key => !Object.hasOwn(original, key)).sort();
    assert.deepEqual(additional, original.id.startsWith('micro-lab-') ? ['displayName', 'formalName', 'type'] : [], original.id + ' added fields');
  }
  assert.deepEqual(C.courses.filter(item => !oldIds.has(item.id)).map(item => item.id).sort(),
    ['cad-lab-fri', 'cad-lab-wed', 'group-lab-1', 'group-lab-2', 'group-lab-3', 'group-lab-4']);
  assert.deepEqual(C.events, baseline.events.filter(item => item.name !== '电子电路CAD实验'));
});

check('exact personal identity and exactly four required first-group labs with confirmed calendar dates', () => {
  assert.deepEqual(C.personalProfile, { name: '范子特', className: '测控241', group: 1 });
  assert.deepEqual(occurrences('group-lab-'), expectedGroups);
  C.courses.filter(item => item.id.startsWith('group-lab-')).forEach(item => {
    assert.equal(item.name, '【分组实验｜课程名待确认】');
    assert.equal(item.type, 'lab');
    assert.equal(item.group, 1);
    assert.equal(item.optional, false);
    assert.equal(item.teacher, '待确认');
    assert.equal(item.room, '待确认');
  });
  assert.deepEqual(C.scheduleExceptions.map(item => [item.courseId, item.week, item.day, item.slot]),
    expectedGroups.map(([id, , week, day, slot]) => [id, week, day, slot]));
  assert.ok(C.scheduleExceptions.every(item => item.status === 'confirmed' && item.group === 1 && item.className === '测控241'));
  assert.equal(C.pendingNotices.length, 1);
  assert.match(C.pendingNotices[0].notice, /课程正式名称、教师和地点/);
  assert.doesNotMatch(JSON.stringify([C.courses, C.scheduleExceptions, C.pendingNotices]), /第二组|excused/);
});

check('CAD is exactly 12 meetings, Wednesday/Friday periods 5–6 in weeks 11–16, room 主教239', () => {
  const actual = occurrences('cad-lab-');
  const expected = [];
  for (let week = 11; week <= 16; week += 1) {
    for (const [id, day] of [['cad-lab-wed', 3], ['cad-lab-fri', 5]]) {
      expected.push([id, G.addDays('2026-09-07', (week - 1) * 7 + day - 1), week, day, 3]);
    }
  }
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual.map(row => row.slice(2).join('/'))).size, 12);
  assert.equal(C.courses.filter(item => item.name === '电子电路CAD实验').length, 2);
  assert.equal(C.events.filter(item => /CAD/.test(item.name)).length, 0);
  C.courses.filter(item => item.id.startsWith('cad-lab-')).forEach(item => {
    assert.equal(item.room, '主教239');
    assert.equal(item.teacher, '张叶');
    assert.equal(item.type, 'lab');
    assert.equal(item.optional, false);
  });
  for (let week = 1; week <= 20; week += 1) {
    assert.ok(C.optionalForWeek(week).every(item => item.warning === ''));
    assert.doesNotMatch(C.weekText(week), /CAD实验.*待确认|第二组/);
  }
});

check('week 7 occupied theory remains visible and addressable but is excluded from active attendance', () => {
  const slot = C.forDay(7, 2).filter(item => item.slot === 2);
  assert.deepEqual(slot.map(item => item.id).sort(), ['group-lab-2', 'instruments-tue']);
  assert.deepEqual(C.attendanceFor('instruments-tue', 7), {
    attendanceStatus: 'occupied', statusLabel: '【被实验占用】',
    attendanceNotice: '本时段上实验课，理论课不上；原理论课保留供查看学习记录。',
    relatedCourseIds: ['group-lab-2']
  });
  assert.equal(C.attendanceFor('instruments-tue', 6).attendanceStatus, 'normal');
  assert.equal(C.attendanceFor('instruments-tue', 8), null);
  assert.equal(C.attendanceFor('missing', 7), null);
  assert.ok(!C.activeForWeek(7).some(item => item.id === 'instruments-tue'));
  assert.ok(C.activeForWeek(7).some(item => item.id === 'group-lab-2'));
  const occupied = [];
  for (let week = 1; week <= 20; week += 1) {
    C.forWeek(week).filter(item => item.attendanceStatus !== 'normal').forEach(item => occupied.push([week, item.id]));
  }
  assert.deepEqual(occupied, [[7, 'instruments-tue']]);
});

check('all 20 weeks raw formal pair overlaps are exactly represented in the conflict report', () => {
  const expected = [];
  for (let week = 1; week <= 20; week += 1) {
    const raw = C.courses.filter(item => !item.optional && item.weeks.includes(week));
    raw.forEach((a, index) => raw.slice(index + 1).forEach(b => {
      if (a.day === b.day && a.slot === b.slot) expected.push(rowKey({ week, day: a.day, slot: a.slot, courseIds: [a.id, b.id] }));
    }));
  }
  const report = C.conflictReport();
  assert.equal(report.weeks, 20);
  assert.deepEqual(report.resolved.concat(report.remaining).map(rowKey).sort(), expected.sort());
  assert.deepEqual(report.resolved.map(rowKey), ['7/2/2/group-lab-2/instruments-tue']);
  assert.deepEqual(report.remaining, []);
  assert.equal(report.optional.length, 10);
  assert.deepEqual(report.optional.map(row => [row.week, row.day, row.slot]),
    [[3, 2, 4], [4, 2, 4], [5, 2, 4], [6, 2, 4], [8, 2, 4], [9, 4, 3], [10, 4, 3], [11, 4, 3], [12, 4, 3], [13, 4, 3]]);
  for (const category of ['resolved', 'remaining', 'optional']) {
    for (const row of report[category]) {
      assert.equal(row.category, category);
      for (const id of row.courseIds) {
        const item = C.courses.find(course => course.id === id);
        assert.ok(item.weeks.includes(row.week));
        assert.equal(item.day, row.day);
        assert.equal(item.slot, row.slot);
      }
    }
  }
});

check('any formal personal lab or assessment occupies theory only in the exact week/day/slot', () => {
  for (const type of ['lab', 'assessment']) {
    const config = { courses: [
      fixture('theory'), fixture('formal-experiment', { type, weeks: [7] }),
      fixture('other-day', { day: 3 }), fixture('other-slot', { slot: 3 })
    ] };
    assert.equal(C.attendanceFor('theory', 7, config).attendanceStatus, 'occupied');
    assert.deepEqual(C.attendanceFor('theory', 7, config).relatedCourseIds, ['formal-experiment']);
    for (const week of [6, 8]) assert.equal(C.attendanceFor('theory', week, config).attendanceStatus, 'normal');
    for (const id of ['other-day', 'other-slot', 'formal-experiment']) assert.equal(C.attendanceFor(id, 7, config).attendanceStatus, 'normal');
    assert.equal(C.conflictReport(config).resolved.length, 1);
    assert.equal(C.conflictReport(config).remaining.length, 0);
  }
});

check('two formal experiments in one slot remain an unresolved collision even when theory is occupied', () => {
  const config = { courses: [
    fixture('theory', { weeks: [7] }), fixture('lab', { weeks: [7], type: 'lab' }),
    fixture('assessment', { weeks: [7], type: 'assessment' })
  ] };
  const report = C.conflictReport(config);
  assert.equal(report.resolved.length, 2);
  assert.deepEqual(report.remaining.map(rowKey), ['7/2/2/assessment/lab']);
  assert.deepEqual(C.activeForWeek(7, config).map(item => item.id).sort(), ['assessment', 'lab']);
  const theories = { courses: [fixture('theory-a', { weeks: [7] }), fixture('theory-b', { weeks: [7] })] };
  assert.equal(C.conflictReport(theories).remaining.length, 1);
  assert.equal(C.conflictReport(theories).resolved.length, 0);
});

check('optional conflicts use actual week and active formal courses, excluding occupied theory', () => {
  const config = { courses: [fixture('theory'), fixture('lab', { weeks: [7], type: 'lab' }), fixture('optional', { weeks: [6, 7, 8, 9], optional: true })] };
  assert.deepEqual(C.optionalForWeek(6, config)[0].conflictIds, ['theory']);
  assert.deepEqual(C.optionalForWeek(7, config)[0].conflictIds, ['lab']);
  assert.deepEqual(C.optionalForWeek(8, config)[0].conflictIds, ['theory']);
  assert.equal(C.optionalForWeek(9, config)[0].conflict, false);
  const optionalLab = { courses: [fixture('theory', { weeks: [7] }), fixture('optional-lab', { weeks: [7], type: 'lab', optional: true })] };
  assert.equal(C.attendanceFor('theory', 7, optionalLab).attendanceStatus, 'normal');
  assert.equal(C.conflictReport(optionalLab).optional.length, 1);
  assert.deepEqual(C.optionalForWeek(8).find(item => item.id === 'power-tue').conflictIds, ['group-lab-4']);
  assert.equal(C.optionalForWeek(7).find(item => item.id === 'power-tue').conflict, false);
});

check('every baseline course occurrence retains valid saved plans, notes, tasks and export/import round trips', () => {
  const state = G.newState();
  const now = '2026-09-19T12:00:00+08:00';
  for (const item of baseline.courses) {
    for (const week of item.weeks) {
      state.courseLearningPlans.push({
        id: 'preserved-' + item.id + '-' + week, courseId: item.id, week,
        date: G.addDays('2026-09-07', (week - 1) * 7 + item.day - 1),
        topic: '原有课堂笔记 ' + item.id, preQuestions: ['原有问题'], minimumGoals: ['原有学习计划'],
        standardGoals: [], stretchGoals: [], evidence: [], reflection: '原有学习记录', unresolvedProblem: '', levelReached: 'unreviewed'
      });
    }
  }
  G.mutate(state, 'task:add', { id: 'preserved-task', title: '原有任务', category: 'school', date: '2026-10-20', notes: '原有任务备注' }, now);
  const before = clone(state);
  assert.equal(G.validateState(state), true);
  assert.deepEqual(G.parseImport(G.exportData(state, now)).state, before);
  const retained = G.getCoursePlan(state, 'instruments-tue', '2026-10-20');
  assert.ok(retained);
  assert.equal(retained.topic, '原有课堂笔记 instruments-tue');
  assert.deepEqual(retained.minimumGoals, ['原有学习计划']);
  for (let week = 1; week <= 20; week += 1) { C.forWeek(week); C.activeForWeek(week); C.optionalForWeek(week); C.weekText(week); }
  C.conflictReport();
  assert.deepEqual(state, before);
});

check('source configuration remains immutable and querying never accesses browser storage', () => {
  const original = JSON.stringify([C.courses, C.events, C.scheduleExceptions, C.personalProfile]);
  const result = C.forWeek(7);
  result.find(item => item.id === 'instruments-tue').relatedCourseIds.push('external-change');
  result[0].name = 'external-change';
  assert.deepEqual(C.attendanceFor('instruments-tue', 7).relatedCourseIds, ['group-lab-2']);
  assert.equal(JSON.stringify([C.courses, C.events, C.scheduleExceptions, C.personalProfile]), original);
  assert.ok(Object.isFrozen(C.courses) && Object.isFrozen(C.personalProfile) && Object.isFrozen(C.scheduleExceptions));
  assert.ok(C.courses.every(item => Object.isFrozen(item) && Object.isFrozen(item.weeks)));
  const sandbox = { window: {} };
  const blockStorage = () => { throw new Error('schedule queried persistent storage'); };
  Object.defineProperty(sandbox, 'localStorage', { get: blockStorage });
  Object.defineProperty(sandbox.window, 'localStorage', { get: blockStorage });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'courses.js'), 'utf8'), sandbox);
  assert.equal(sandbox.window.TGCourses.conflictReport().resolved.length, 1);
  assert.equal(sandbox.window.TGCourses.forWeek(7).length, 16);
});

console.log('\nPASS: ' + checks + ' schedule-update test groups; 20 weeks; 4 group labs; 12 CAD meetings; baseline fields and saved plans retained.');
