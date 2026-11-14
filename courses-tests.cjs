'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('./courses.js');
let checks = 0;

function check(name, fn) {
  fn();
  checks += 1;
  console.log('PASS ' + name);
}
function slot(week, day, period) {
  return C.forDay(week, day).filter(item => item.slot === period);
}
function ids(week) { return C.forWeek(week).map(item => item.id); }
function activeEvents(week) { return C.events.filter(item => item.weeks.includes(week)); }

check('PDF source fields, unique IDs and valid periods/weeks', () => {
  assert.equal(C.courses.length, 36);
  assert.equal(new Set(C.courses.map(item => item.id)).size, 36);
  const teachers = {
    '微型计算机原理及接口技术': '门洪', '传感器原理及应用': '耿靖童',
    '习近平新时代中国特色社会主义思想概论': '曲宏歌', '测控软件技术': '刘玉秋',
    '现代分析仪器及应用': '付娆', '计算机网络技术': '陈丹丹', '热力设备及辅机': '姚国家',
    '电力经济与管理': '刘寅东', '误差理论与数据分析': '杨汉瑞', '形势与政策教育': '魏子青',
    '党史': '刘中华', '电力系统分析': '杨玉龙', '电子电路CAD实验': '张叶',
    '【分组实验｜课程名待确认】': '待确认'
  };
  C.courses.forEach(item => {
    assert.equal(item.teacher, (item.id.startsWith("micro-lab-") ? "待确认" : teachers[item.name]));
    assert.ok(item.room && item.day >= 1 && item.day <= 7 && item.slot >= 1 && item.slot <= 5);
    assert.equal(new Set(item.weeks).size, item.weeks.length);
    assert.ok(item.weeks.every(w => Number.isInteger(w) && w >= 1 && w <= 20));
    assert.equal(typeof item.optional, 'boolean');
  });
});

check('microcomputer: Monday/Tuesday/Thursday, never Wednesday, weeks 1–11', () => {
  for (let week = 1; week <= 20; week += 1) {
    assert.equal(slot(week, 3, 1).length, 0);
    const rooms = [[1, '二东402'], [2, '二东201'], [4, '二东202']];
    rooms.forEach(([day, room]) => {
      assert.deepEqual(slot(week, day, 1).map(item => [item.name, item.room]),
        week <= 11 ? [['微型计算机原理及接口技术', room]] : []);
    });
  }
});

check('Tuesday periods 5–6: network weeks 1–6, empty 7–8, thermal 9–16', () => {
  for (let week = 1; week <= 20; week += 1) {
    assert.deepEqual(slot(week, 2, 3).map(item => item.name),
      week <= 6 ? ['计算机网络技术'] : week >= 9 && week <= 16 ? ['热力设备及辅机'] : []);
  }
});

check('economy weeks 3–6, policy weeks 5–8 and Friday thought odd weeks only', () => {
  for (let week = 1; week <= 20; week += 1) {
    assert.equal(slot(week, 4, 2).filter(c => !c.type).length, week >= 3 && week <= 6 ? 1 : 0);
    assert.equal(slot(week, 5, 5).length, week >= 5 && week <= 8 ? 1 : 0);
    assert.equal(slot(week, 5, 2).filter(c => !c.id.startsWith("micro-lab-")).length, week <= 15 && week % 2 === 1 ? 1 : 0);
    assert.equal(slot(week, 6, 1).length, week <= 5 ? 1 : 0);
    assert.equal(slot(week, 7, 3).length, week <= 5 ? 1 : 0);
  }
});

check('software starts week 3, remains Monday 7–8 / Wednesday 9–10, ends week 10', () => {
  for (let week = 1; week <= 20; week += 1) {
    const expected = week >= 3 && week <= 10;
    assert.deepEqual(slot(week, 1, 4).map(item => [item.name, item.teacher, item.room]),
      expected ? [['测控软件技术', '刘玉秋', '一教239']] : []);
    assert.deepEqual(slot(week, 3, 5).map(item => [item.name, item.teacher, item.room]),
      expected ? [['测控软件技术', '刘玉秋', '一教239']] : []);
  }
});

check('all 20 weeks preserve formal classes and only active classes occupy personal time', () => {
  const counts = [11, 10, 15, 16, 20, 18, 16, 17, 17, 13, 14, 7, 8, 7, 8, 7, 0, 0, 0, 0];
  counts.forEach((count, i) => {
    const list = C.forWeek(i + 1);
    assert.equal(list.length, count, 'week ' + (i + 1));
    const active = C.activeForWeek(i + 1);
    assert.equal(active.length, count - (i === 6 ? 1 : 0));
    assert.equal(new Set(active.map(item => item.day + '-' + item.slot)).size, active.length);
    assert.ok(list.every(item => !item.optional));
  });
  assert.ok(ids(7).includes('instruments-tue'));
  assert.ok(!ids(8).includes('instruments-tue'));
  assert.ok(ids(8).includes('instruments-fri'));
  assert.ok(!ids(9).includes('instruments-fri'));
});

check('optional attendance: 15 opportunities / 30 timetable periods, formal experiments take priority', () => {
  const availableDays = [[2, 4], [2, 4], [4], [4], [4], [4], [2, 4], [4], [2], [2], [2], [2], [], [], [], [], [], [], [], []];
  let total = 0;
  for (let week = 1; week <= 20; week += 1) {
    const optional = C.optionalForWeek(week);
    const available = optional.filter(item => !item.conflict);
    assert.deepEqual(available.map(item => item.day), availableDays[week - 1], 'week ' + week);
    assert.equal(optional.length, week <= 12 ? 2 : week === 13 ? 1 : 0);
    optional.forEach(item => {
      assert.equal(item.teacher, '杨玉龙');
      assert.equal(item.room, '二中627');
      const expected = item.day === 2 && week >= 3 && week <= 6 ? ['电力经济与管理']
        : item.day === 2 && week === 8 ? ['【分组实验｜课程名待确认】']
          : item.day === 4 && week >= 9 ? ['热力设备及辅机'] : [];
      assert.deepEqual(item.conflictNames, expected);
      assert.equal(item.conflict, expected.length > 0);
      assert.equal(item.warning, '');
    });
    total += available.length;
  }
  assert.equal(total, 15);
  assert.equal(total * 2, 30);
});

check('CAD pending event replaced by exact courses; course-design pending windows retained', () => {
  for (let week = 1; week <= 20; week += 1) {
    const expected = week === 18 ? ['电子工艺设计']
        : week >= 19 ? ['传感器原理及应用课程设计'] : [];
    assert.deepEqual(activeEvents(week).map(item => item.name), expected);
    activeEvents(week).forEach(item => assert.match(item.notice, /待确认/));
  }
  [11, 12].forEach(week => {
    const optional = C.optionalForWeek(week).find(item => item.day === 2);
    assert.equal(optional.conflict, false);
    assert.equal(optional.warning, '');
    assert.equal(C.forWeek(week).filter(item => item.name === '电子电路CAD实验').length, 2);
  });
});

check('week summary text includes formal courses, conflicts, experiment uncertainty and semester end', () => {
  assert.match(C.weekText(1), /周四 1–2节 微型计算机原理及接口技术 \/ 门洪 \/ 二东202/);
  assert.match(C.weekText(3), /与电力经济与管理冲突/);
  assert.match(C.weekText(9), /与热力设备及辅机冲突/);
  assert.match(C.weekText(11), /周三 5–6节 🧪 电子电路CAD实验 \/ 张叶 \/ 主教239/);
  assert.doesNotMatch(C.weekText(12), /CAD实验.*待确认|不保证可参加/);
  assert.match(C.weekText(7), /现代分析仪器及应用.*【被实验占用】/);
  assert.match(C.weekText(8), /与【分组实验｜课程名待确认】冲突/);
  assert.match(C.weekText(13), /周四 5–6节 电力系统分析/);
  assert.doesNotMatch(C.weekText(13), /周二 7–8节 电力系统分析/);
  assert.match(C.weekText(16), /电子电路CAD实验/);
  assert.match(C.weekText(18), /电子工艺设计/);
  assert.match(C.weekText(19), /传感器原理及应用课程设计/);
  assert.match(C.weekText(20), /传感器原理及应用课程设计/);
  assert.match(C.weekText(21), /本学期已结束/);
  assert.match(C.weekText(0), /尚未开始/);
});

check('invalid bounds return no classes; browser and CommonJS APIs work without dependencies', () => {
  [0, 21, -1, 1.5, undefined, 'bad'].forEach(week => {
    assert.deepEqual(C.forWeek(week), []);
    assert.deepEqual(C.optionalForWeek(week), []);
  });
  [0, 8, -1, 1.5, undefined].forEach(day => assert.deepEqual(C.forDay(1, day), []));
  assert.deepEqual(C.forWeek('1'), C.forWeek(1));
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'courses.js'), 'utf8'), sandbox);
  assert.equal(sandbox.window.TGCourses.forWeek(1).length, 11);
  assert.equal(sandbox.window.TGCourses.optionalForWeek(11)[0].conflict, false);
  const result = C.forWeek(1);
  result.pop();
  assert.equal(C.forWeek(1).length, 11);
});

console.log('\nPASS: ' + checks + ' course test groups; boundary weeks 1/2/3/6/7/8/9/11/12/13/16/18/19/20 covered.');
