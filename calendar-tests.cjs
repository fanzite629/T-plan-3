'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const fs = require('node:fs');
const Calendar = require('./calendar.js');
const eventId = 'modeling-20260910';
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.exitCode = 1; process.stderr.write('FAIL ' + name + '\n' + error.stack + '\n'); }
}
test('start date is partial leave only after 18:00 and excludes daytime', () => {
  const event = Calendar.eventsForDate('2026-09-10')[0];
  assert.equal(event.dayStart, '18:00'); assert.equal(event.dayEnd, '24:00'); assert.equal(event.fullDay, false);
  assert.equal(event.location, '三教'); assert.equal(event.leaveNote, '老师安排请假（用户提供）');
  assert.equal(Calendar.annotation('2026-09-10').kind, 'partial-leave');
  assert.match(event.note, /白天课程保留/); assert.match(event.note, /节次起止时间待核实/);
});
test('September 11 through 13 are full days and ending September 14 is excluded', () => {
  for (const date of ['2026-09-11', '2026-09-12', '2026-09-13']) {
    const event = Calendar.eventsForDate(date)[0];
    assert.equal(event.fullDay, true); assert.equal(event.dayStart, '00:00'); assert.equal(event.dayEnd, '24:00');
    assert.equal(Calendar.annotation(date).kind, 'leave');
  }
  assert.deepEqual(Calendar.eventsForDate('2026-09-09'), []);
  assert.deepEqual(Calendar.eventsForDate('2026-09-14'), []);
  assert.equal(Calendar.annotation('2026-09-14').kind, '');
});
test('event status boundaries include start and exclude end to the millisecond', () => {
  assert.equal(Calendar.eventStatus(eventId, '2026-09-10T17:59:59.999+08:00'), 'upcoming');
  assert.equal(Calendar.eventStatus(eventId, '2026-09-10T18:00:00+08:00'), 'active');
  assert.equal(Calendar.eventStatus(eventId, '2026-09-13T23:59:59.999+08:00'), 'active');
  assert.equal(Calendar.eventStatus(eventId, '2026-09-14T00:00:00+08:00'), 'ended');
  assert.equal(Calendar.eventStatus(eventId, '2026-09-15T00:00:00+08:00'), 'ended');
});
test('UTC, positive and negative offsets resolve the same status instant', () => {
  for (const timestamp of ['2026-09-10T10:00:00Z', '2026-09-10T18:00:00+08:00', '2026-09-10T06:00:00-04:00']) assert.equal(Calendar.eventStatus(eventId, timestamp), 'active');
  for (const timestamp of ['2026-09-13T16:00:00Z', '2026-09-14T00:00:00+08:00', '2026-09-13T12:00:00-04:00']) assert.equal(Calendar.eventStatus(eventId, timestamp), 'ended');
});
test('date projections and default status instant are invariant across host timezones', () => {
  const code = "const c=require('./calendar.js');process.stdout.write(JSON.stringify([c.eventsForDate('2026-09-10'),c.eventsForDate('2026-09-13'),c.eventsForDate('2026-09-14'),c.eventStatus('modeling-20260910','2026-09-13T16:00:00Z')]))";
  const results = ['Asia/Shanghai', 'UTC', 'America/Los_Angeles'].map(TZ => JSON.parse(execFileSync(process.execPath, ['-e', code], { cwd: __dirname, env: { ...process.env, TZ }, encoding: 'utf8' })));
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});
test('Mid-Autumn and National Day holiday ranges are exact and do not alter adjacent dates', () => {
  for (const date of ['2026-09-25', '2026-09-26', '2026-09-27']) assert.equal(Calendar.holidayForDate(date).label, '中秋节');
  for (let day = 1; day <= 7; day++) assert.equal(Calendar.holidayForDate('2026-10-0' + day).label, '国庆节');
  for (const date of ['2026-09-24', '2026-09-28', '2026-09-30', '2026-10-08']) assert.equal(Calendar.holidayForDate(date), null);
  assert.equal(Calendar.annotation('2026-10-01').kind, 'holiday');
  assert.match(Calendar.holidayForDate('2026-10-01').note, /学校停课、补课安排待核实/);
});
test('national workdays are hints and never claim school substitution', () => {
  for (const date of ['2026-09-20', '2026-10-10']) {
    const holiday = Calendar.holidayForDate(date);
    assert.equal(holiday.kind, 'workday'); assert.equal(Calendar.annotation(date).kind, 'workday');
    assert.match(holiday.note, /不代表学校已确认补课/); assert.match(holiday.note, /不映射其他星期课程/);
  }
});
test('January 1 is statutory only; January 2 and 3 are not inferred holidays or shifts', () => {
  assert.equal(Calendar.holidayForDate('2027-01-01').kind, 'statutory');
  assert.match(Calendar.holidayForDate('2027-01-01').label, /法定日期/);
  assert.match(Calendar.holidayForDate('2027-01-01').note, /2027年完整放假调休安排尚未核实/);
  for (const date of ['2027-01-02', '2027-01-03', '2027-01-24']) {
    assert.equal(Calendar.holidayForDate(date), null); assert.equal(Calendar.annotation(date).kind, 'unknown');
    assert.match(Calendar.dateNotes(date).join(''), /未核实/);
  }
});
test('semester scope prevents accidental extrapolation of calendar data', () => {
  for (const date of ['2026-01-01', '2026-05-01', '2026-09-06', '2027-01-25', '2027-10-01', '2028-01-01']) {
    assert.equal(Calendar.holidayForDate(date), null); assert.deepEqual(Calendar.dateNotes(date), []);
    assert.equal(Calendar.annotation(date).kind, '');
  }
});
test('weekly text has seven dated lines, includes partial leave and crosses the year correctly', () => {
  const first = Calendar.weekText('2026-09-07');
  assert.equal(first.split('\n').length, 7); assert.match(first, /2026-09-10 周四：数学建模 · 18:00–24:00/);
  assert.match(first, /2026-09-13 周日：数学建模 · 00:00–24:00/);
  assert.doesNotMatch(Calendar.weekText('2026-09-14'), /数学建模/);
  const newYear = Calendar.weekText('2026-12-28');
  assert.equal(newYear.split('\n').length, 7); assert.match(newYear, /2027-01-01 周五：元旦（法定日期）/);
  assert.match(newYear, /2027-01-03 周日：2027年完整放假调休安排尚未核实/);
});
test('malformed dates, missing timezones and unknown events fail explicitly', () => {
  for (const date of ['2026-02-29', '2026-09-31', '2026-9-10', '', null, 20260910]) {
    assert.throws(() => Calendar.eventsForDate(date)); assert.throws(() => Calendar.holidayForDate(date)); assert.throws(() => Calendar.annotation(date));
  }
  assert.deepEqual(Calendar.eventsForDate('2028-02-29'), []);
  for (const now of ['2026-09-10', '2026-09-10T18:00:00', '2026-09-10T24:00:00Z', '2026-02-30T18:00:00Z', '2026-09-10T18:00:00+08:99', null]) assert.throws(() => Calendar.eventStatus(eventId, now));
  assert.throws(() => Calendar.eventStatus('unknown', '2026-09-10T18:00:00Z'));
  assert.throws(() => Calendar.weekText('2026-09-08'));
});
test('constants are immutable and returned annotation edits cannot change source data', () => {
  assert.equal(Calendar.sources.length, 2); assert.equal(Calendar.events.length, 1);
  assert.ok(Calendar.sources.every(source => /^https:\/\//.test(source.url) && source.verifiedOn === '2026-09-07'));
  assert.throws(() => { Calendar.events[0].name = '改名'; }); assert.throws(() => Calendar.sources.push({}));
  const event = Calendar.eventsForDate('2026-09-10')[0]; event.name = '改名';
  assert.equal(Calendar.eventsForDate('2026-09-10')[0].name, '数学建模');
  const holiday = Calendar.holidayForDate('2026-09-25'); holiday.label = '改名';
  assert.equal(Calendar.holidayForDate('2026-09-25').label, '中秋节');
});
test('browser global export runs without storage, network or external dependencies', () => {
  const sandbox = {};
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync(require.resolve('./calendar.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.TGCalendar.eventsForDate, 'function');
  assert.equal(sandbox.TGCalendar.annotation('2026-09-11').kind, 'leave');
  assert.equal(Object.keys(sandbox).join(','), 'TGCalendar');
});
process.stdout.write('\nRESULT ' + passed + ' PASS' + (process.exitCode ? ' / FAILURES PRESENT' : ' / 0 FAIL') + '\n');
