#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadPlaywright, resolveNpxInvocation } = require('./capture-template-reference');

const REQUIRED_VIEWPORTS = [1440, 834, 390, 375];

function validateEvidence(evidence) {
  if (!evidence || evidence.ok !== true || evidence.browser !== 'chromium' || evidence.browserClosed !== true) {
    throw new Error('Chromium did not complete the authoring browser preflight');
  }
  for (const width of REQUIRED_VIEWPORTS) {
    const row = evidence.viewports?.find((item) => item.width === width);
    if (!row || row.navigation !== 'ok' || row.animationFrames < 2 || row.screenshotBytes < 100) {
      throw new Error(`Browser preflight is incomplete at ${width}px`);
    }
  }
  return evidence;
}

function runPlaywright(url, playwrightPackage = 'playwright@1.54.1') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-browser-preflight-'));
  const script = path.join(directory, 'preflight.cjs');
  const source = `'use strict';
const path = require('node:path');
const loadPlaywright = ${loadPlaywright.toString()};
const { chromium } = loadPlaywright();
(async () => {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const width of ${JSON.stringify(REQUIRED_VIEWPORTS)}) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const response = await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Animation frames did not progress')), 10000);
        requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timeout); resolve(); }));
      }));
      const screenshot = await page.screenshot({ type: 'png' });
      rows.push({ width, navigation: response && response.ok() ? 'ok' : 'failed', animationFrames: 2, screenshotBytes: screenshot.length });
      await page.close();
    }
  } finally { await browser.close(); }
  process.stdout.write(JSON.stringify({ ok: true, browser: 'chromium', browserClosed: true, viewports: rows }));
})().catch((error) => { process.stderr.write(error.message); process.exitCode = 1; });\n`;
  try {
    fs.writeFileSync(script, source, 'utf8');
    const npx = resolveNpxInvocation();
    const result = spawnSync(npx.command, [...npx.args, '--yes', '-p', playwrightPackage, 'node', script], {
      encoding: 'utf8',
      timeout: 180000,
    });
    if (result.status !== 0) {
      const message = String(result.stderr || result.error?.message || 'Playwright preflight failed').trim();
      const missingDependency = /Cannot find module|Executable doesn.t exist|Host system is missing dependencies|browserType.launch:.*not found/i.test(message);
      throw new Error(`${missingDependency ? 'blocked_browser_dependencies' : 'blocked_browser_runtime'}: ${message}${missingDependency ? `\nInstall: npx --yes ${playwrightPackage} install --with-deps chromium` : ''}`);
    }
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function preflight(url, runner = runPlaywright) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('--url must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('--url must be an absolute HTTP(S) URL without credentials');
  }
  return validateEvidence(runner(parsed.toString()));
}

function main(argv = process.argv.slice(2)) {
  try {
    if (argv.length !== 2 || argv[0] !== '--url') throw new Error('Usage: browser-preflight.js --url URL');
    const report = preflight(argv[1]);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { REQUIRED_VIEWPORTS, preflight, validateEvidence };
