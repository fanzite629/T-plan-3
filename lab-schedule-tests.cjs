'use strict';
const assert = require('node:assert/strict');
const C = require('./courses.js');
const G = require('./core.js');
const expected = [
  ['2026-10-27',8,2,2],['2026-10-28',8,3,3],['2026-10-29',8,4,2],['2026-10-30',8,5,2],
  ['2026-11-03',9,2,2],['2026-11-04',9,3,3],['2026-11-05',9,4,2],['2026-11-06',9,5,3],
  ['2026-11-10',10,2,2],['2026-11-17',11,2,2]
];
const actual = [];
for(let week=1;week<=20;week++) {
  for(const c of C.forWeek(week).filter(c=>c.id.startsWith('micro-lab-'))) {
    const date=G.addDays('2026-09-07',(week-1)*7+c.day-1);
    actual.push([date,week,c.day,c.slot]);
    assert.equal(G.teachingWeek(date),week);
    assert.equal(C.forDay(week,c.day).filter(x=>x.slot===c.slot).length,1,'No collision: '+date);
    assert.equal(c.optional,false);
    assert.equal(c.formalName,'微型计算机原理及接口技术实验');
    assert.equal(c.type,c.id==='micro-lab-assessment'?'assessment':'lab');
    assert.equal(c.displayName,c.id==='micro-lab-assessment'?'🔴 单片机实验考核':'🧪 单片机实验');
    assert.equal(c.attendanceStatus,'normal');
  }
}
assert.deepEqual(actual,expected);
const exam=C.forDay(11,2).find(c=>c.id==='micro-lab-assessment');
assert.match(exam.name,/考核/);
assert.match(exam.notice,/教材、实验指导书/);
assert.match(exam.notice,/可以记笔记/);
assert.match(C.weekText(11),/考核可以带教材/);
assert.equal(C.courses.filter(c=>c.id.startsWith('micro-lab-')&&c.notice).length,1);
console.log('PASS: all 10 exact lab dates, periods, boundaries, no collisions, original names, formal name, assessment type and notice.');
