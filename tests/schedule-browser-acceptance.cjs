'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.TPLAN_PREVIEW_URL;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+\/index\.html$/.test(base || ''), 'Use the local source preview URL');
const out = path.resolve(__dirname, '../output/playwright/schedule-20260920/browser');
fs.mkdirSync(out, { recursive: true });
const weeks = [2,3,6,7,8,9,10,11,12,16,17];
const req = (yes, why) => assert.ok(yes, why);
async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.locator('#app h1').waitFor();
  req(await page.locator('#storage-error').isHidden(), 'Storage error on load');
  const before = await page.evaluate(() => localStorage.getItem('tgrowth.v1'));
  await page.locator('nav [data-page="week"]').first().click();
  const report = { origin: base, checks: [], screenshotDirectory: out };
  async function inspect(w, suffix = '') {
    await page.locator('#week-number').fill(String(w));
    await page.locator('#week-number').dispatchEvent('change');
    req((await page.locator('#week-number').inputValue()) === String(w), 'Week picker W' + w);
    const rows = await page.locator('.timetable [data-action="course"]').evaluateAll(elements => elements.map(e => ({ id: e.dataset.id, date: e.dataset.date, status: e.dataset.attendanceStatus, text: e.innerText, cell: e.closest('td').cellIndex, slot: e.closest('tr').sectionRowIndex + 1 })));
    const ids = rows.map(r => r.id);
    const has = id => ids.includes(id);
    req(has('software-mon') === (w >= 3 && w <= 10), 'Software Monday W' + w);
    req(has('software-wed') === (w >= 3 && w <= 10), 'Software Wednesday W' + w);
    req(has('cad-lab-wed') === (w >= 11 && w <= 16), 'CAD Wednesday W' + w);
    req(has('cad-lab-fri') === (w >= 11 && w <= 16), 'CAD Friday W' + w);
    req(rows.filter(r => /cad-lab/.test(r.id)).length === (w >= 11 && w <= 16 ? 2 : 0), 'CAD duplicate W' + w);
    for (const [id, week, day, slot] of [['group-lab-1',6,3,3],['group-lab-2',7,2,2],['group-lab-3',7,4,2],['group-lab-4',8,2,4]]) {
      const item = rows.find(r => r.id === id);
      req(Boolean(item) === (w === week), id + ' presence W' + w);
      if (item) req(item.cell === day && item.slot === slot, id + ' cell');
    }
    if (w === 7) {
      const occupied = rows.find(r => r.id === 'instruments-tue');
      req(occupied?.status === 'occupied' && /被实验占用/.test(occupied.text), 'W7 theory occupied');
      await page.locator('.timetable [data-id="instruments-tue"]').click();
      req(await page.locator('[data-course-session="2026-10-20|instruments-tue"]').isVisible(), 'W7 original theory detail');
      await page.locator('#dialog [data-action="close"]').first().click();
    }
    if (w === 8) {
      req(rows.filter(r => r.id.startsWith('micro-lab-')).length === 4, 'W8 micro labs');
      req(rows.find(r => r.id === 'micro-lab-fri-w8')?.slot === 2, 'W8 Friday 3-4');
      req(/与正式课冲突/.test(rows.find(r => r.id === 'power-tue')?.text || ''), 'W8 optional conflict');
    }
    if (w === 9) req(rows.find(r => r.id === 'micro-lab-fri-w9')?.slot === 3, 'W9 Friday 5-6');
    if (w === 11) {
      req(rows.find(r => r.id === 'micro-lab-assessment')?.slot === 2, 'W11 exam slot');
      await page.locator('.timetable [data-id="micro-lab-assessment"]').click();
      const detail = await page.locator('#dialog').innerText();
      for (const s of ['教材','实验指导书','可以记笔记','单片机实验考核']) req(detail.includes(s), 'W11 assessment detail ' + s);
      await page.locator('#dialog').screenshot({ path: path.join(out, 'W11-assessment' + suffix + '.png') });
      await page.locator('#dialog [data-action="close"]').first().click();
    }
    if (w >= 11 && w <= 16) for (const id of ['cad-lab-wed','cad-lab-fri']) req(rows.find(r => r.id === id)?.text.includes('主教239'), id + ' room');
    req(!(await page.locator('[data-testid="schedule-profile"]').innerText()).includes('第二组'), 'No second-group UI');
    await page.locator('.timetable').screenshot({ path: path.join(out, 'W' + w + suffix + '.png') });
    report.checks.push({ week: w, status: 'PASS', cells: rows.length, afterRefresh: Boolean(suffix) });
  }
  for (const w of weeks) await inspect(w);
  assert.equal(await page.evaluate(() => localStorage.getItem('tgrowth.v1')), before, 'Browsing mutated storage');
  await page.reload();
  await page.locator('nav [data-page="week"]').first().click();
  for (const w of [6,7,8,11]) await inspect(w, '-after-refresh');
  assert.equal(await page.evaluate(() => localStorage.getItem('tgrowth.v1')), before, 'Refresh mutated storage');
  assert.deepEqual(errors, []);
  report.consoleErrors = errors.length;
  report.status = 'PASS';
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, report: path.join(out, 'report.json') }));
  await browser.close();
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
