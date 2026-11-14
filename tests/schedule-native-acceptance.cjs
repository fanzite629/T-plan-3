'use strict';

// Attach only to the parent's already-running native WinForms/WebView2 window.
// No app/process launch, termination, profile-file access, storage injection or import.
// The single authorized write is an actual UI submission with --add-task.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { chromium } = require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://tplan.local/index.html';
const KEY = 'tgrowth.v1';
const EVIDENCE = path.join(ROOT, 'output', 'playwright', 'schedule-20260920');
const PRIVATE = path.join(ROOT, 'backups', '20260919-schedule-update-baseline');
const BEFORE = path.join(PRIVATE, 'native-before.json');
const AFTER = path.join(PRIVATE, 'native-after.json');
const TITLE = '单片机实验考核准备';
const CHECKLIST = [
  '整理实验指导书', '补充实验指导书笔记', '复习所有实验流程', '整理常用程序',
  '整理常用单片机指令', '梳理实验接线', '总结常见实验故障', '第10周完成一次实验考核模拟'
];
const NOTES = '截止：第10周结束前（2026-11-15）。\n' + CHECKLIST.map((text, i) => `${i + 1}. ${text}`).join('\n');
const WEEKS = [2, 3, 6, 7, 8, 9, 10, 11, 12, 16, 17];
const GROUP = [
  { id: 'group-lab-1', week: 6, day: 3, slot: 3, date: '2026-10-14' },
  { id: 'group-lab-2', week: 7, day: 2, slot: 2, date: '2026-10-20' },
  { id: 'group-lab-3', week: 7, day: 4, slot: 2, date: '2026-10-22' },
  { id: 'group-lab-4', week: 8, day: 2, slot: 4, date: '2026-10-27' }
];
const MICRO = [
  { id: 'micro-lab-tue', weeks: [8, 9, 10], day: 2, slot: 2 },
  { id: 'micro-lab-wed', weeks: [8, 9], day: 3, slot: 3 },
  { id: 'micro-lab-thu', weeks: [8, 9], day: 4, slot: 2 },
  { id: 'micro-lab-fri-w8', weeks: [8], day: 5, slot: 2 },
  { id: 'micro-lab-fri-w9', weeks: [9], day: 5, slot: 3 },
  { id: 'micro-lab-assessment', weeks: [11], day: 2, slot: 2 }
];

function requireCondition(value, message) { if (!value) throw new Error(message); }
function same(actual, expected, message) { requireCondition(isDeepStrictEqual(actual, expected), message); }
function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function dateFor(week, day = 1) {
  return new Date(Date.UTC(2026, 8, 7 + (week - 1) * 7 + day - 1)).toISOString().slice(0, 10);
}
function writeNew(filename, content) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, typeof content === 'string' ? content : JSON.stringify(content, null, 2), { encoding: 'utf8', flag: 'wx' });
}
function readSaved(filename) {
  const saved = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  // Also accept an application export envelope created by the parent before attachment.
  const state = saved.state || saved.data || saved.exportEnvelope?.data || (saved.schemaVersion ? saved : null);
  requireCondition(state && Array.isArray(state.tasks), 'Private snapshot has an unsupported shape: ' + path.basename(filename));
  return { ...saved, state };
}
function summary(snapshot) {
  const s = snapshot.state;
  return {
    stateSHA256: hash(s), rawSHA256: snapshot.raw === undefined ? null : hash(snapshot.raw),
    tasks: s.tasks.length, logs: s.logs.length, health: s.health.length,
    courseLearningPlans: s.courseLearningPlans.length, weeks: Object.keys(s.weeks).length,
    reviews: Object.keys(s.reviews).length, attendance: s.attendance.length
  };
}
function validatePreparationTask(task) {
  requireCondition(task.title === TITLE && task.date === '2026-11-15', 'Existing preparation task title/date needs user action; no overwrite attempted');
  requireCondition(task.category === 'school' && task.estimatedMinutes === 0, 'Existing preparation task category/duration needs user action; no overwrite attempted');
  requireCondition(typeof task.notes === 'string' && task.notes.includes('第10周结束前'), 'Existing preparation task deadline note needs user action; no overwrite attempted');
  for (const item of CHECKLIST) requireCondition(task.notes.includes(item), 'Existing preparation task checklist needs user action; no overwrite attempted');
}
function comparePreservation(before, after, allowTaskAddition) {
  const a = before.state, b = after.state;
  same(Object.keys(b).sort(), Object.keys(a).sort(), 'Top-level state fields changed');
  for (const key of Object.keys(a)) if (key !== 'tasks') same(b[key], a[key], 'Original data changed in field: ' + key);
  requireCondition(b.tasks.length >= a.tasks.length, 'An original task was removed');
  for (let index = 0; index < a.tasks.length; index += 1) same(b.tasks[index], a.tasks[index], 'An original task changed or task order changed at index ' + index);
  const extra = b.tasks.slice(a.tasks.length);
  requireCondition(extra.length <= (allowTaskAddition ? 1 : 0), 'Unexpected task additions');
  if (extra.length) {
    requireCondition(!a.tasks.some(task => task.title === TITLE), 'Preparation task duplicated');
    validatePreparationTask(extra[0]);
  }
  requireCondition(new Set(b.tasks.map(task => task.id)).size === b.tasks.length, 'Duplicate task IDs detected');
  return { originalTasksPreserved: a.tasks.length, originalOtherFieldsPreserved: Object.keys(a).length - 1, tasksAdded: extra.length };
}
function sameSnapshot(actual, expected, message) {
  same(actual.state, expected.state, message);
  if (Object.hasOwn(expected, 'raw')) same(actual.raw, expected.raw, message + ' (raw localStorage)');
}
function disconnect(browser) {
  // Browser.close() is intentionally forbidden here. This closes the client pipe,
  // not the WebView2 browser, the native window or the browser profile.
  browser?._connection?.close();
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  requireCondition([...flags].every(flag => ['--add-task', '--verify-restart'].includes(flag)), 'Supported flags: --add-task OR --verify-restart');
  requireCondition(flags.size <= 1, '--add-task and --verify-restart are mutually exclusive');
  requireCondition(process.env.TPLAN_CDP_URL, 'TPLAN_CDP_URL must identify the already-running native app');
  const endpoint = new URL(process.env.TPLAN_CDP_URL);
  requireCondition(['http:', 'ws:'].includes(endpoint.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only a loopback native CDP endpoint is accepted');
  const mode = flags.has('--add-task') ? 'add-task' : flags.has('--verify-restart') ? 'verify-restart' : 'read-only';
  if (mode === 'verify-restart') requireCondition(fs.existsSync(BEFORE) && fs.existsSync(AFTER), 'Restart verification requires preserved native-before.json and native-after.json');
  const runId = `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const output = path.join(EVIDENCE, runId);
  fs.mkdirSync(output, { recursive: false });
  const report = { mode, startedAt: new Date().toISOString(), origin: ORIGIN, output, checks: [], consoleErrors: [], pageErrors: [], limitations: ['Native process launch/close/restart and outer-window screenshots are managed and evidenced separately by the parent.'] };
  let browser, page;
  async function check(name, work) {
    try {
      const detail = await work();
      report.checks.push({ name, status: 'PASS', detail: detail ?? null });
      console.log('PASS ' + name);
      return detail;
    } catch (error) {
      report.checks.push({ name, status: 'FAIL', error: error.message });
      throw error;
    }
  }
  async function snapshotState() {
    return page.evaluate(key => {
      const raw = localStorage.getItem(key);
      const state = raw === null ? window.TG.newState() : window.TG.upgradeState(JSON.parse(raw));
      window.TG.validateState(state);
      return { snapshotVersion: 1, capturedAt: new Date().toISOString(), origin: location.href, raw, state, exportEnvelope: JSON.parse(window.TG.exportData(state)) };
    }, KEY);
  }
  async function aria(name, target = page.locator('body')) {
    writeNew(path.join(output, name + '.aria.txt'), await target.ariaSnapshot());
  }
  async function ready() {
    requireCondition(page.url() === ORIGIN, 'Native page origin differs from https://tplan.local/index.html');
    await page.locator('#app h1').waitFor({ state: 'visible' });
    requireCondition(await page.locator('#storage-error').isHidden(), 'Application reports a storage error; no write attempted');
    requireCondition(await page.locator('#dialog').isHidden(), 'An existing dialog is open; finish it before native QA');
  }
  async function selectWeek(week) {
    await page.locator('[data-page="week"]').first().click();
    await page.locator('#week-number').fill(String(week));
    await page.locator('#week-number').dispatchEvent('change');
    requireCondition(await page.locator('#week-number').inputValue() === String(week), 'Week input did not select W' + week);
    requireCondition((await page.locator('.week-switch').innerText()).includes(dateFor(week)), 'Selected week start date is wrong for W' + week);
    requireCondition((await page.locator('.week-switch').innerText()).includes(dateFor(week, 7)), 'Selected week end date is wrong for W' + week);
    await page.locator('.timetable').waitFor({ state: 'visible' });
  }
  async function inspectWeek(week, suffix = '') {
    await selectWeek(week);
    const profile = await page.locator('[data-testid="schedule-profile"]').innerText();
    requireCondition(['范子特', '测控241', '第一组'].every(value => profile.includes(value)), 'Personal profile is missing from rendered schedule');
    const rendered = await page.locator('.timetable button[data-action="course"]').evaluateAll(buttons => buttons.map(button => ({
      id: button.dataset.id, date: button.dataset.date, status: button.dataset.attendanceStatus || null,
      text: button.innerText, day: button.closest('td').cellIndex, slot: button.closest('tr').sectionRowIndex + 1,
      optional: button.classList.contains('optional-cell'), conflict: button.classList.contains('conflict')
    })));
    const formal = rendered.filter(item => !item.optional);
    const expected = await page.evaluate(w => window.TGCourses.forWeek(w).map(item => ({ id: item.id, day: item.day, slot: item.slot, status: item.attendanceStatus, title: item.displayName || item.name })), week);
    same(formal.map(({ id, day, slot, status }) => ({ id, day, slot, status })).sort((a, b) => a.id.localeCompare(b.id)), expected.map(({ id, day, slot, status }) => ({ id, day, slot, status })).sort((a, b) => a.id.localeCompare(b.id)), 'Rendered formal timetable differs from course occurrences in W' + week);
    for (const item of rendered) requireCondition(item.date === dateFor(week, item.day), 'Rendered course date differs from its weekday in W' + week);
    for (const item of expected) requireCondition(formal.find(row => row.id === item.id).text.includes(item.title), 'Rendered course title differs in W' + week);
    function occurrence(spec, present) {
      const found = formal.filter(item => item.id === spec.id);
      requireCondition(found.length === (present ? 1 : 0), `Unexpected ${spec.id} occurrence count in W${week}`);
      if (present) {
        same([found[0].day, found[0].slot, found[0].date], [spec.day, spec.slot, spec.date || dateFor(week, spec.day)], `Wrong cell/date for ${spec.id} in W${week}`);
        return found[0];
      }
    }
    for (const item of GROUP) occurrence(item, item.week === week);
    for (const item of MICRO) occurrence(item, item.weeks.includes(week));
    for (const item of [{ id: 'software-mon', day: 1, slot: 4 }, { id: 'software-wed', day: 3, slot: 5 }]) occurrence(item, week >= 3 && week <= 10);
    for (const item of [{ id: 'cad-lab-wed', day: 3, slot: 3 }, { id: 'cad-lab-fri', day: 5, slot: 3 }]) {
      const found = occurrence(item, week >= 11 && week <= 16);
      if (found) requireCondition(found.text.includes('电子电路CAD实验') && found.text.includes('主教239'), 'CAD name/room missing in W' + week);
    }
    requireCondition(formal.filter(item => /CAD/.test(item.text)).length === (week >= 11 && week <= 16 ? 2 : 0), 'Duplicate or unexpected CAD UI entries in W' + week);
    const scheduleText = await page.locator('.timetable').locator('xpath=ancestor::section[1]').innerText();
    requireCondition(!/第二组|第2组|理论课免上|免上/.test(scheduleText), 'Removed second-group/excused logic remains in schedule UI');
    requireCondition(!/CAD[^\n]*(时间待定|时段待定|节次待定)/.test(scheduleText), 'Pending CAD placeholder still rendered');
    if (week === 7) {
      const theory = formal.find(item => item.id === 'instruments-tue');
      requireCondition(theory?.status === 'occupied' && theory.text.includes('被实验占用'), 'W7 original instruments theory must remain and show occupied status');
      await page.locator('.timetable [data-id="instruments-tue"]').click();
      requireCondition(await page.locator('[data-course-session="2026-10-20|instruments-tue"]').isVisible(), 'Original theory learning-record entry is not accessible');
      await aria('W7-original-theory' + suffix, page.locator('#dialog'));
      await page.locator('#dialog [data-action="close"]').first().click();
    }
    if (week === 8) {
      const optional = rendered.find(item => item.id === 'power-tue');
      requireCondition(optional?.optional && optional.conflict, 'W8 optional power course conflict must remain optional and marked');
      requireCondition(formal.filter(item => item.id.startsWith('micro-lab-')).length === 4 && formal.some(item => item.id === 'group-lab-4'), 'W8 personal group lab and four microcomputer labs must coexist');
    }
    await aria('W' + week + suffix, page.locator('.timetable'));
    await page.locator('.timetable').screenshot({ path: path.join(output, 'W' + week + suffix + '.png') });
    if (week === 11) {
      await page.locator('.timetable [data-id="micro-lab-assessment"]').click();
      const text = await page.locator('#dialog').innerText();
      for (const required of ['单片机实验考核', '正式名称：微型计算机原理及接口技术实验', '2026-11-17', '第11教学周', '3–4节', '教材', '实验指导书', '可以记笔记']) requireCondition(text.includes(required), 'Assessment detail missing: ' + required);
      await aria('W11-assessment' + suffix, page.locator('#dialog'));
      await page.locator('#dialog').screenshot({ path: path.join(output, 'W11-assessment' + suffix + '.png') });
      await page.locator('#dialog [data-action="close"]').first().click();
    }
    return { week, monday: dateFor(week), formalOccurrences: formal.length, optionalOccurrences: rendered.length - formal.length };
  }
  try {
    browser = await chromium.connectOverCDP(endpoint.href, { timeout: 20000, noDefaults: true });
    const pages = browser.contexts().flatMap(context => context.pages()).filter(candidate => candidate.url() === ORIGIN);
    requireCondition(pages.length === 1, 'Expected exactly one already-running native TPlan page');
    page = pages[0];
    page.setDefaultTimeout(12000);
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await ready();
    // First evidence is the actual current accessibility tree, before UI actions.
    await aria('initial');
    const initial = await snapshotState();
    if (!fs.existsSync(BEFORE)) writeNew(BEFORE, initial);
    const baseline = readSaved(BEFORE);
    report.initial = summary(initial);
    report.baseline = summary(baseline);
    const savedAfter = fs.existsSync(AFTER) ? readSaved(AFTER) : null;
    await check('Original user data preserved on attachment', async () => {
      if (mode === 'verify-restart') sameSnapshot(initial, savedAfter, 'State differs after parent-managed native restart');
      else if (savedAfter) sameSnapshot(initial, savedAfter, 'Current state differs from existing after-snapshot; originals were not overwritten');
      return comparePreservation(baseline, initial, mode === 'add-task' || Boolean(savedAfter));
    });
    await check('Personal schedule configuration and no second-group entries', async () => {
      const config = await page.evaluate(() => ({ profile: window.TGCourses.personalProfile, groups: window.TGCourses.courses.filter(item => item.group).map(item => ({ id: item.id, group: item.group })), events: window.TGCourses.events }));
      same(config.profile, { name: '范子特', className: '测控241', group: 1 }, 'Personal profile configuration is incorrect');
      same(config.groups.map(item => item.id).sort(), GROUP.map(item => item.id).sort(), 'Unexpected grouped-lab definitions');
      requireCondition(config.groups.every(item => item.group === 1), 'Non-personal grouped-lab definition remains');
      requireCondition(!config.events.some(item => /CAD/.test(item.name)), 'Pending CAD event duplicates the confirmed course');
      return { personalGroup: 1, personalLabDefinitions: config.groups.length, pendingCAD: 0 };
    });
    for (const week of WEEKS) await check('Actual timetable W' + week, () => inspectWeek(week));
    await check('UI browsing does not change stored data', async () => { sameSnapshot(await snapshotState(), initial, 'UI browsing changed user data'); return summary(initial); });

    let finalState = initial;
    if (mode === 'add-task') {
      await check('Single preparation task added or validated through actual UI', async () => {
        const existing = initial.state.tasks.filter(task => task.title === TITLE);
        requireCondition(existing.length <= 1, 'Duplicate preparation tasks already exist; no changes attempted');
        if (existing.length) {
          validatePreparationTask(existing[0]);
          report.taskAction = 'Existing valid task retained; no write';
        } else {
          requireCondition(!savedAfter, 'Existing after-snapshot has no preparation task; preserve it and resolve before adding');
          sameSnapshot(await snapshotState(), initial, 'Data changed before task submission; no write attempted');
          await page.locator('#app [data-action="task-new"]').first().click();
          await aria('task-form', page.locator('#dialog'));
          await page.locator('#f-title').fill(TITLE);
          await page.locator('#f-category').selectOption('school');
          await page.locator('#f-date').fill('2026-11-15');
          await page.locator('#f-estimatedMinutes').fill('0');
          await page.locator('#f-priority').selectOption('medium');
          await page.locator('#f-status').selectOption('todo');
          await page.locator('#f-notes').fill(NOTES);
          await page.locator('#f-evidence').fill('');
          await page.locator('#dialog button[type="submit"]').click();
          await page.locator('#dialog').waitFor({ state: 'hidden' });
          requireCondition(await page.locator('#storage-error').isHidden(), 'Task save produced a storage error');
          report.taskAction = 'One task submitted through native app UI';
        }
        finalState = await snapshotState();
        const matches = finalState.state.tasks.filter(task => task.title === TITLE);
        requireCondition(matches.length === 1, 'Exactly one preparation task must exist after UI action');
        validatePreparationTask(matches[0]);
        const preservation = comparePreservation(initial, finalState, true);
        if (savedAfter) sameSnapshot(finalState, savedAfter, 'Existing after-snapshot differs; no snapshot overwrite attempted');
        else writeNew(AFTER, finalState);
        return { ...preservation, preparationTasks: matches.length, deadline: '2026-11-15' };
      });
    }
    if (mode === 'verify-restart') await check('Saved task and full state after external native restart', async () => {
      const tasks = initial.state.tasks.filter(task => task.title === TITLE);
      requireCondition(tasks.length === 1, 'Preparation task is missing or duplicated after restart');
      validatePreparationTask(tasks[0]);
      sameSnapshot(initial, savedAfter, 'Restart state mismatch');
      return { matchedAfterSHA256: summary(savedAfter).stateSHA256, preparationTasks: tasks.length };
    });
    await check('Refresh preserves the complete state and exact stored representation', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready();
      sameSnapshot(await snapshotState(), finalState, 'Refresh changed stored data');
      return summary(finalState);
    });
    for (const week of [6, 7, 8, 11]) await check('Refreshed timetable W' + week, () => inspectWeek(week, '-after-refresh'));
    await check('Final existing records and tasks remain intact', async () => {
      const final = await snapshotState();
      sameSnapshot(final, finalState, 'Final UI verification changed user data');
      const preservation = comparePreservation(baseline, final, mode === 'add-task' || Boolean(savedAfter));
      report.final = summary(final);
      return preservation;
    });
    await check('No console or page errors during native acceptance', async () => {
      requireCondition(report.consoleErrors.length === 0 && report.pageErrors.length === 0, 'Native page emitted console/page errors; see report');
      return { consoleErrors: 0, pageErrors: 0 };
    });
  } catch (error) {
    report.error = error.message;
    if (!report.checks.some(item => item.status === 'FAIL')) report.checks.push({ name: 'Native attachment or runner', status: 'FAIL', error: error.message });
    if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: false }).catch(() => {});
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.passed = report.checks.filter(item => item.status === 'PASS').length;
    report.failed = report.checks.filter(item => item.status === 'FAIL').length;
    writeNew(path.join(output, 'report.json'), report);
    disconnect(browser);
    console.log(JSON.stringify({ mode, passed: report.passed, failed: report.failed, report: path.join(output, 'report.json') }));
  }
}

if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { comparePreservation, sameSnapshot, validatePreparationTask, dateFor, CHECKLIST, NOTES, GROUP, MICRO };
