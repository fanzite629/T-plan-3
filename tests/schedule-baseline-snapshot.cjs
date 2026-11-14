'use strict';
// Read the already-running original app through its own storage API. No profile-file access.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const G = require('../core.js');
async function main() {
  const browser = await chromium.connectOverCDP(process.env.TPLAN_CDP_URL || 'http://127.0.0.1:54931', { noDefaults: true });
  const page = browser.contexts()[0].pages().find(p => p.url() === 'https://tplan.local/index.html');
  assert.ok(page, 'Native TPlan page is loaded');
  await page.locator('#app h1').waitFor();
  assert.equal(await page.locator('#storage-error').isVisible(), false);
  const raw = await page.evaluate(() => localStorage.getItem('tgrowth.v1'));
  const data = raw ? G.upgradeState(JSON.parse(raw)) : G.newState();
  G.validateState(data);
  const out = path.resolve(__dirname, '../backups/20260919-schedule-update-baseline/installed-original-state.json');
  const snapshot = { raw, data };
  if (fs.existsSync(out)) assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), snapshot, 'Existing original snapshot still matches');
  else fs.writeFileSync(out, JSON.stringify(snapshot, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ status:'PASS', saved:out, tasks:data.tasks.length, logs:data.logs.length, plans:data.courseLearningPlans.length, weeks:Object.keys(data.weeks).length, reviews:Object.keys(data.reviews).length }));
  process.exit(0); // Only disconnect this test client; leave the native app alive.
}
main().catch(e => { console.error(e.stack); process.exit(1); });
