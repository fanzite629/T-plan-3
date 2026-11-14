'use strict';
// Test-only adapter: old scripts use fixed CDP ports; redirect solely to this runner's isolated candidate.
const {chromium}=require('C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const connect=chromium.connectOverCDP.bind(chromium),endpoint=process.env.TPLAN_TEST_CDP;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint||''))throw Error('Isolated loopback CDP required');
chromium.connectOverCDP=async()=>{const b=await connect(endpoint);for(const c of b.contexts())for(const p of c.pages()){p.setDefaultTimeout(12000);await p.setViewportSize({width:1440,height:1050});if(process.env.TPLAN_TEST_DATE){await p.clock.setFixedTime(new Date(process.env.TPLAN_TEST_DATE));await p.reload();}}return b;};
