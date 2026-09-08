'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const path = require('node:path');
const { loadPlaywright } = require('../monteby-site-authoring/scripts/capture-template-reference');
const { REQUIRED_VIEWPORTS, preflight } = require('../monteby-site-authoring/scripts/browser-preflight');

test('browser preflight requires navigation, two animation frames, and screenshots at all authoring widths', () => {
  const report = preflight('https://example.test/page', (url) => ({
    ok: true,
    browser: 'chromium',
    browserClosed: true,
    url,
    viewports: REQUIRED_VIEWPORTS.map((width) => ({
      width, navigation: 'ok', animationFrames: 2, screenshotBytes: 400,
    })),
  }));
  assert.equal(report.viewports.length, 4);
  assert.throws(() => preflight('https://example.test/page', () => ({ ...report, browserClosed: false })), /did not complete/);
  assert.throws(() => preflight('https://example.test/page', () => ({
    ...report,
    viewports: report.viewports.filter((row) => row.width !== 375),
  })), /incomplete at 375px/);
});

test('browser preflight rejects credential-bearing and non-http targets', () => {
  assert.throws(() => preflight('file:///tmp/private.html', () => ({})), /HTTP\(S\)/);
  assert.throws(() => preflight('https://user:secret@example.test/', () => ({})), /without credentials/);
});

test('capture and preflight share package resolution through npx PATH on Unix and Windows', () => {
  for (const platform of ['linux', 'win32']) {
    const pathApi = platform === 'win32' ? path.win32 : path.posix;
    const modules = platform === 'win32' ? 'C:\\npm cache\\node_modules' : '/tmp/npm-cache/node_modules';
    const delimiter = platform === 'win32' ? ';' : ':';
    const expected = { chromium: 'resolved browser' };
    const calls = [];
    const result = vm.runInNewContext(`(${loadPlaywright.toString()})()`, {
      path: pathApi,
      process: { platform, env: { PATH: ['unrelated', pathApi.join(modules, '.bin')].join(delimiter) } },
      require(candidate) {
        calls.push(candidate);
        if (candidate === pathApi.join(modules, 'playwright')) return expected;
        throw new Error('Cannot find module playwright');
      },
    });
    assert.equal(result, expected);
    assert.deepEqual(calls, ['playwright', pathApi.join(modules, 'playwright')]);
  }
});
