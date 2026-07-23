#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { PNG } = require(require.resolve('pngjs', { paths: [process.cwd()] }));

const root = path.resolve(__dirname, '..');
const startScript = path.join(root, 'monteby-site-authoring', 'scripts', 'start-visual-benchmark.js');
const { childProcessTotalTimeoutMs } = require(startScript);
const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAYAAABr5z2BAAAANElEQVR4AaXBQRHAIADAsK6HhImdsCnhhRtwwKfJ837/5mJyJ5FEEkkk0WCRSCSRRBJJdACoPAQDTg2+uwAAAABJRU5ErkJggg==';
const completeCaptureEvidence = Object.freeze({
  status: 'complete',
  complete: true,
  essentialGeometryTruncated: false,
  reasons: [],
  categories: {},
});

test('start visual benchmark prints help', () => {
  const result = spawnSync(process.execPath, [startScript, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /start-visual-benchmark\.js/);
  assert.match(result.stdout, /--marketplace-reference/);
  assert.match(result.stdout, /--full-page/);
  assert.match(result.stdout, /--viewport-only/);
  assert.match(result.stdout, /--viewport-timeout-ms/);
});

test('start visual benchmark rejects non-positive viewport timeouts', () => {
  for (const value of ['0', '-1', '1.5', 'invalid']) {
    const result = spawnSync(process.execPath, [startScript, '--viewport-timeout-ms', value], { encoding: 'utf8' });

    assert.equal(result.status, 1, value);
    assert.match(result.stderr, /--viewport-timeout-ms must be a positive integer/, value);
  }
});

test('start visual benchmark derives a total child bound from every viewport plus setup margin', () => {
  assert.equal(childProcessTotalTimeoutMs({
    viewports: ['desktop:1440x1100', 'tablet:834x1112', 'mobile:390x844'],
    viewportTimeoutMs: 300000,
    waitMs: '1000',
    referenceWaitMs: '3500',
  }), 960000);
  assert.equal(childProcessTotalTimeoutMs({
    viewports: ['compact:320x240'],
    viewportTimeoutMs: 100,
    waitMs: '0',
    referenceWaitMs: '0',
  }), 1100);
  assert.equal(childProcessTotalTimeoutMs({
    viewports: [],
    viewportTimeoutMs: 0,
    waitMs: '1000',
    referenceWaitMs: '3500',
  }), 672000);
});

test('start visual benchmark times out a stuck generated target process, kills descendants, and reports preserved reference artifacts', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-generated-timeout-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-generated-timeout-bin-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');
  const preloadPath = path.join(directory, 'hang-generated-target.cjs');
  const pidFile = path.join(directory, 'hung-processes.json');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><body><h1>Preserved reference</h1></body></html>');
  writeFakeNpx(fakeNpxPath, 'Preserved reference');
  fs.writeFileSync(preloadPath, `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
if (path.basename(process.argv[1] || '') === 'generate-random-html-target.js') {
  const descendant = spawn(process.execPath, ['-e', ${JSON.stringify("process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);")}], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  fs.writeFileSync(process.env.MONTEBY_HUNG_PROCESS_FILE, JSON.stringify({ generator: process.pid, descendant: descendant.pid }));
  process.on('SIGTERM', () => {});
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
`);

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'stuck-generated-target',
    '--reference-html-file',
    referenceHtml,
    '--viewport-only',
    '--out-dir',
    directory,
    '--viewport',
    'compact:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--viewport-timeout-ms',
    '1000',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 8000,
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${preloadPath}`].filter(Boolean).join(' '),
      MONTEBY_HUNG_PROCESS_FILE: pidFile,
    },
  });

  const processIds = fs.existsSync(pidFile) ? Object.values(JSON.parse(fs.readFileSync(pidFile, 'utf8'))) : [];
  t.after(() => {
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.error, undefined);
  assert.match(result.stderr, /\[generated_target_process_timeout\]/);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.failure.code, 'generated_target_process_timeout');
  assert.equal(report.failure.timeoutMs, 2000);
  assert.equal(report.failure.terminationAttempted, true);
  assert.equal(report.commands.generateTarget.timedOut, true);
  assert.equal(report.commands.generateTarget.timeoutMs, 2000);
  assert.equal(report.commands.referenceCapture.length, 1);
  assert.equal(report.commands.referenceCapture[0].captureStatus, 'complete');
  assert.equal(fs.existsSync(report.commands.referenceCapture[0].manifest), true);
  assert.equal(fs.existsSync(path.join(directory, 'benchmark-start-report.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'NEXT-STEPS.md')), true);
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /generated_target_process_timeout/);
  assert.equal(processIds.length, 2);

  await new Promise((resolve) => setTimeout(resolve, 100));
  for (const pid of processIds) {
    const state = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
    assert.equal(state.stdout.trim() === '' || state.stdout.trim().startsWith('Z'), true, `process ${pid} is still alive with state ${state.stdout.trim()}`);
  }
});

test('start visual benchmark reports a generated viewport timeout with partial fallback artifacts', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-viewport-timeout-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-viewport-timeout-bin-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const pidFile = path.join(directory, 'hung-browser.pid');

  fs.writeFileSync(fakeNpxPath, `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
fs.writeFileSync(process.env.MONTEBY_TARGET_SCREENSHOT_OUT, 'partialpng');
fs.writeFileSync(process.env.MONTEBY_HUNG_BROWSER_PID, String(process.pid));
process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);
`);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'stuck-generated-viewport',
    '--out-dir',
    directory,
    '--viewport',
    'compact:320x240',
    '--wait-ms',
    '0',
    '--viewport-timeout-ms',
    '500',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 8000,
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      MONTEBY_HUNG_BROWSER_PID: pidFile,
    },
  });

  const browserPid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8')) : 0;
  t.after(() => {
    if (browserPid > 0) {
      try {
        process.kill(browserPid, 'SIGKILL');
      } catch {}
    }
  });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.error, undefined);
  assert.match(result.stderr, /\[generated_target_viewport_timeout\]/);
  const report = JSON.parse(result.stdout);
  assert.equal(report.failure.code, 'generated_target_viewport_timeout');
  assert.equal(report.failure.timedOut, true);
  assert.equal(report.failure.timeoutMs, 500);
  assert.equal(report.commands.generateTarget.timedOut, false);
  assert.equal(report.target.captureStatus, 'partial');
  assert.equal(report.target.captureFailure.artifact, 'target-compact.png');
  assert.deepEqual(report.failure.partialArtifacts.map((file) => path.basename(file)).sort(), [
    'target-compact.png',
    'target-manifest.json',
    'target.html',
  ]);
  assert.equal(fs.existsSync(path.join(directory, 'benchmark-start-report.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'NEXT-STEPS.md')), true);
  assert.ok(browserPid > 0);

  await new Promise((resolve) => setTimeout(resolve, 100));
  const state = spawnSync('ps', ['-o', 'stat=', '-p', String(browserPid)], { encoding: 'utf8' });
  assert.equal(state.stdout.trim() === '' || state.stdout.trim().startsWith('Z'), true, `browser process ${browserPid} is still alive with state ${state.stdout.trim()}`);
});

test('start visual benchmark generates target, audits it, and writes next steps', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-benchmark-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');

  writeFakeNpx(fakeNpxPath);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'unit-start',
    '--seed',
    'unit-start-seed',
    '--variant',
    'auto',
    '--archetype',
    'optomatta-optical-retail',
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.options.fullPage, true);
  assert.equal(report.options.requireMarketplace, true);
  assert.equal(report.target.variant, 'marketplace-service');
  assert.equal(report.target.screenshots.every((screenshot) => screenshot.mode === 'full-page'), true);
  assert.equal(report.target.archetype, 'optomatta-optical-retail');
  assert.equal(report.targetAudit.ok, true);
  assert.equal(report.files.startVisualReview, '');
  assert.equal(report.startVisualReview.items.length, 0);
  assert.equal(report.targetAudit.stats.screenshotFiles, 1);
  assert.equal(report.targetAudit.stats.mediaSurfaces, 21);
  assert.equal(report.targetAudit.stats.renderedLayoutFiles, 1);
  assert.equal(report.targetAudit.stats.renderedHeroScaleMediaSurfaces, 1);
  assert.equal(report.targetAudit.stats.renderedSecondaryScaleMediaSurfaces, 1);
  assert.equal(report.targetAudit.stats.renderedServiceCardScaleMediaSurfaces, 3);
  assert.equal(report.target.mediaSurfaces.filter((surface) => surface.role === 'reference-media').length, 16);
  assert.equal(report.commands.targetLayoutCapture.layoutCaptureStatus, 'ok');
  assert.match(report.files.targetLayout, /target-layout\.json/);
  assert.deepEqual(report.target.layouts.map((layout) => path.basename(layout)), ['target-layout.json']);
  assert.equal(fs.existsSync(path.join(directory, 'target-layout.json')), true);
  assert.equal(report.commands.visualBrief.status, 0);
  assert.match(report.commands.next.authoringReadiness, /audit-authoring-readiness\.js/);
  assert.match(report.commands.next.draftLayout, /draft-monteby-layout\.js/);
  assert.match(report.commands.next.draftLayout, /layout-draft\.json/);
  assert.match(report.commands.next.draftLayout, /--reference-manifest/);
  assert.match(report.commands.next.draftLayout, /target-manifest\.json/);
  assert.match(report.commands.next.draftLayout, /--require-marketplace-media/);
  assert.match(report.commands.next.auditLayout, /--require-marketplace-media/);
  assert.match(report.commands.next.runBenchmark, /--require-marketplace-media/);
  assert.match(report.commands.next.runBenchmark, /--pad-to-largest/);
  assert.match(report.commands.next.captureCandidateRender, /--full-page/);
  assert.equal(report.visualBrief.target.archetype, 'optomatta-optical-retail');
  assert.equal(fs.existsSync(path.join(directory, 'target.html')), true);
  assert.equal(fs.existsSync(path.join(directory, 'target-desktop.png')), true);
  assert.equal(fs.existsSync(path.join(directory, 'benchmark-start-report.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'NEXT-STEPS.md')), true);
  assert.equal(fs.existsSync(path.join(directory, 'VISUAL-BRIEF.md')), true);
  const markdown = fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8');
  assert.match(markdown, /run-visual-benchmark\.js/);
  assert.match(markdown, /draft-monteby-layout\.js/);
  assert.match(markdown, /Generated fallback target screenshots/);
  assert.match(markdown, /target-desktop\.png/);
  assert.match(markdown, /Do not present the generated fallback target as evidence/);
  assert.match(fs.readFileSync(path.join(directory, 'VISUAL-BRIEF.md'), 'utf8'), /Monteby Visual Authoring Brief/);
});

test('start visual benchmark can use a local HTML reference without forcing marketplace mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-benchmark-split-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  writeFakeNpx(fakeNpxPath);
  fs.chmodSync(fakeNpxPath, 0o755);
  fs.writeFileSync(referenceHtml, '<!doctype html><html><body><h1>Local measured reference</h1><img src="./hero.jpg" alt=""></body></html>');

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'unit-split-seed',
    '--variant',
    'split-hero',
    '--reference-html-file',
    referenceHtml,
    '--viewport-only',
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.options.fullPage, false);
  assert.equal(report.options.requireMarketplace, false);
  assert.equal(report.options.marketplaceReference, false);
  assert.equal(report.options.referenceClassification.kind, 'generic-measured-reference');
  assert.equal(report.options.referenceClassification.familyMechanics, false);
  assert.equal(report.references.length, 1);
  assert.match(report.references[0].url, /^file:\/\//);
  assert.equal(report.target.variant, 'split-hero');
  assert.equal(report.target.screenshots.every((screenshot) => screenshot.mode === 'viewport'), true);
  assert.doesNotMatch(report.commands.next.captureCandidateRender, /--full-page/);
  assert.doesNotMatch(report.commands.next.runBenchmark, /--pad-to-largest/);
  assert.equal(report.commands.targetLayoutCapture.layoutCaptureStatus, 'ok');
  assert.equal(fs.existsSync(path.join(directory, 'target-layout.json')), true);
  assert.equal(report.targetAudit.stats.screenshotFiles, 1);
  assert.equal(report.commands.visualBrief.status, 0);
  assert.doesNotMatch(report.commands.next.draftLayout, /--require-real-reference/);
  assert.doesNotMatch(report.commands.next.draftLayout, /--require-marketplace-media/);
});

test('start visual benchmark accepts a text-only generic measured reference', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-text-reference-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-text-reference-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');
  const textOnlyReferenceLayout = {
    capturedAt: '2026-07-11T00:00:00.000Z',
    url: 'file:///tmp/text-reference.html',
    title: 'Editorial Ledger',
    viewport: { width: 320, height: 240, scrollHeight: 900 },
    textBoxes: [{
      tag: 'h1',
      text: 'An editorial page without photography',
      rect: { x: 24, y: 24, width: 260, height: 72, top: 24 },
      firstViewportArea: 18720,
    }],
    mediaBoxes: [],
    landmarks: [],
    evidenceCompleteness: completeCaptureEvidence,
    summary: {
      firstViewportTextBoxes: 1,
      firstViewportMediaBoxes: 0,
      firstViewportMediaCoverage: 0,
      largestMediaArea: 0,
    },
  };
  const generatedTargetLayout = {
    ...textOnlyReferenceLayout,
    title: 'Generated target',
    mediaBoxes: [
      { tag: 'img', source: 'https://cdn.example.test/hero.jpg', rect: { x: 150, y: 24, width: 700, height: 360, top: 24 }, firstViewportArea: 76000 },
      { tag: 'img', source: 'https://cdn.example.test/secondary.jpg', rect: { x: 20, y: 96, width: 280, height: 150, top: 96 }, firstViewportArea: 30000 },
      { tag: 'img', source: 'https://cdn.example.test/service-1.jpg', rect: { x: 20, y: 320, width: 280, height: 160, top: 320 }, firstViewportArea: 0 },
      { tag: 'img', source: 'https://cdn.example.test/service-2.jpg', rect: { x: 20, y: 500, width: 280, height: 160, top: 500 }, firstViewportArea: 0 },
      { tag: 'img', source: 'https://cdn.example.test/service-3.jpg', rect: { x: 20, y: 680, width: 280, height: 160, top: 680 }, firstViewportArea: 0 },
    ],
    summary: {
      firstViewportTextBoxes: 1,
      firstViewportMediaBoxes: 2,
      firstViewportMediaCoverage: 0.33,
      largestMediaArea: 252000,
    },
  };

  fs.writeFileSync(referenceHtml, '<!doctype html><html><body><main><h1>An editorial page without photography</h1></main></body></html>');
  fs.writeFileSync(fakeNpxPath, `#!/usr/bin/env node
const fs = require('node:fs');
const screenshotOut = process.env.MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT || process.env.MONTEBY_REFERENCE_SCREENSHOT_OUT || process.env.MONTEBY_TARGET_SCREENSHOT_OUT || '';
if (screenshotOut) {
  fs.writeFileSync(screenshotOut, Buffer.from(${JSON.stringify(testPngBase64)}, 'base64'));
}
const layoutOut = process.env.MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT || process.env.MONTEBY_REFERENCE_LAYOUT_OUT || '';
if (layoutOut) {
  const layout = layoutOut.includes(${JSON.stringify(`${path.sep}references${path.sep}`)})
    ? ${JSON.stringify(textOnlyReferenceLayout)}
    : ${JSON.stringify(generatedTargetLayout)};
  fs.writeFileSync(layoutOut, JSON.stringify(layout));
}
`);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'text-only-reference-seed',
    '--reference-html-file',
    referenceHtml,
    '--viewport-only',
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.options.referenceClassification.kind, 'generic-measured-reference');
  assert.equal(report.options.referenceClassification.familyMechanics, false);
  assert.equal(report.references[0].captureStatus, 'complete');
  assert.equal(report.references[0].evidenceCompleteness.status, 'complete');
  assert.equal(report.references[0].evidenceCompleteness.complete, true);
  assert.deepEqual(report.references[0].requiredMediaRoles, []);
  assert.deepEqual(report.references[0].mediaSurfaceRoleCounts, {});
  assert.doesNotMatch(report.commands.next.draftLayout, /--require-real-reference/);
  assert.doesNotMatch(report.commands.next.draftLayout, /--require-marketplace-media/);
});

test('start visual benchmark blocks incomplete capture evidence before target generation', () => {
  const incompleteCaptureEvidence = {
    status: 'partial',
    complete: false,
    essentialGeometryTruncated: true,
    reasons: ['textBoxes-truncated'],
    categories: {
      textBoxes: { total: 260, retained: 240, truncated: 20, limit: 240 },
    },
  };
  const scenarios = [
    { label: 'full-page', modeArgs: ['--full-page'], captureStatus: 'partial', evidenceStatus: 'partial' },
    { label: 'viewport', modeArgs: ['--viewport-only'], captureStatus: 'complete', evidenceStatus: 'bounded' },
  ];

  for (const scenario of scenarios) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-start-incomplete-${scenario.label}-`));
    const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-fake-incomplete-${scenario.label}-`));
    const fakeNpxPath = path.join(binDirectory, 'npx');
    const referenceHtml = path.join(directory, 'reference.html');

    fs.writeFileSync(referenceHtml, '<!doctype html><html><body><main><h1>Incomplete measured reference</h1></main></body></html>');
    writeFakeNpx(fakeNpxPath, 'Incomplete measured reference', incompleteCaptureEvidence);

    const result = spawnSync(process.execPath, [
      startScript,
      '--seed',
      `incomplete-${scenario.label}-seed`,
      '--reference-html-file',
      referenceHtml,
      '--out-dir',
      directory,
      '--viewport',
      'desktop:320x240',
      '--wait-ms',
      '0',
      '--reference-wait-ms',
      '0',
      '--playwright-package',
      'fake-playwright',
      ...scenario.modeArgs,
      '--json',
    ], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      },
    });

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Reference capture quality failed/);
    assert.match(result.stderr, /reference capture is incomplete/);
    assert.match(result.stderr, new RegExp(`captureStatus=${scenario.captureStatus}`));
    assert.match(result.stderr, new RegExp(`evidenceStatus=${scenario.evidenceStatus}`));
    assert.match(result.stderr, /textBoxes-truncated/);
    assert.match(result.stderr, /Drafting is blocked until every requested viewport reports complete evidence/);
    assert.equal(fs.existsSync(path.join(directory, 'target.html')), false);
  }
});

test('start visual benchmark captures a local reference HTML file without a remote URL', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-reference-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');
  const captureSpawnLog = path.join(directory, 'capture-spawns.ndjson');
  const captureSpawnRecorder = path.join(directory, 'record-capture-spawns.cjs');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Reference Template</title></head><body><nav><a href="/book">Book now</a></nav><img src="/hero.jpg"><h1>Reference</h1></body></html>');
  fs.writeFileSync(captureSpawnRecorder, `'use strict';
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const originalSpawn = childProcess.spawn;
const originalSpawnSync = childProcess.spawnSync;
function recordBenchmarkSpawn(args) {
  if (Array.isArray(args) && args.some((arg) => ['capture-template-reference.js', 'generate-random-html-target.js'].includes(path.basename(String(arg))))) {
    fs.appendFileSync(process.env.MONTEBY_CAPTURE_SPAWN_LOG, JSON.stringify(args) + '\\n');
  }
}
childProcess.spawn = function recordCaptureSpawn(command, args, options) {
  recordBenchmarkSpawn(args);
  return originalSpawn.call(this, command, args, options);
};
childProcess.spawnSync = function recordCaptureSpawnSync(command, args, options) {
  recordBenchmarkSpawn(args);
  return originalSpawnSync.call(this, command, args, options);
};
`);
  fs.writeFileSync(fakeNpxPath, `#!/bin/sh
last=""
for arg in "$@"; do last="$arg"; done
${fakePngShellCommand()}
layout_out="\${MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT:-$MONTEBY_REFERENCE_LAYOUT_OUT}"
if [ -n "$layout_out" ]; then
cat > "$layout_out" <<'JSON'
{
  "capturedAt": "2026-07-08T00:00:00.000Z",
  "url": "file:///tmp/reference.html",
  "title": "Reference Template",
  "viewport": {
    "width": 320,
    "height": 240,
    "scrollHeight": 900
  },
	  "textBoxes": [
    {
      "tag": "h1",
      "text": "Reference",
      "rect": {
        "x": 24,
        "y": 24,
        "width": 180,
        "height": 48,
        "top": 24
      },
      "firstViewportArea": 8640
    },
    {
      "tag": "a",
      "text": "Book now",
      "rect": {
        "x": 24,
        "y": 88,
        "width": 96,
        "height": 36,
        "top": 88
      },
      "firstViewportArea": 3456
    }
  ],
	  "mediaBoxes": [
	    {
	      "tag": "section",
	      "source": "https://cdn.example.test/green-bokeh-textured-background-illustration.jpg",
	      "rect": {
	        "x": 0,
	        "y": 0,
	        "width": 320,
	        "height": 240,
	        "top": 0
	      },
	      "firstViewportArea": 76800
	    },
	    {
	      "tag": "img",
	      "source": "https://cdn.example.test/reference-hero.jpg",
      "rect": {
        "x": 150,
        "y": 24,
        "width": 700,
        "height": 360,
	        "top": 24
	      },
	      "firstViewportArea": 30000
	    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-service-1.jpg",
      "rect": {
        "x": 20,
        "y": 320,
        "width": 280,
        "height": 160,
        "top": 320
      },
      "firstViewportArea": 0
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-service-2.jpg",
      "rect": {
        "x": 160,
        "y": 320,
        "width": 280,
        "height": 160,
        "top": 320
      },
      "firstViewportArea": 0
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-service-3.jpg",
      "rect": {
        "x": 20,
        "y": 470,
        "width": 280,
        "height": 160,
        "top": 470
      },
      "firstViewportArea": 0
    }
  ],
  "landmarks": [],
	  "evidenceCompleteness": ${JSON.stringify(completeCaptureEvidence)},
	  "summary": {
	    "firstViewportTextBoxes": 0,
	    "firstViewportMediaBoxes": 2,
	    "firstViewportMediaCoverage": 1,
	    "largestMediaArea": 76800
	  }
	}
JSON
exit 0
fi
${fakePngShellCommand()}
`);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'reference-start',
    '--seed',
    'reference-seed',
    '--variant',
    'auto',
    '--marketplace-reference',
    '--archetype',
    'optomatta-optical-retail',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--viewport-timeout-ms',
    '240000',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${captureSpawnRecorder}`].filter(Boolean).join(' '),
      MONTEBY_CAPTURE_SPAWN_LOG: captureSpawnLog,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.options.marketplaceReference, true);
  assert.equal(report.options.fullPage, true);
  assert.equal(report.options.viewportTimeoutMs, 240000);
  assert.equal(report.target.archetype, 'optomatta-optical-retail');
	  assert.equal(report.references.length, 1);
	  assert.match(report.references[0].url, /^file:\/\//);
	  assert.match(report.references[0].manifest, /reference-manifest\.json/);
	  const manifest = JSON.parse(fs.readFileSync(report.references[0].manifest, 'utf8'));
	  assert.equal(manifest.mediaSurfaces.some((surface) => /bokeh|textured|illustration/.test(surface.source)), false);
	  assert.equal(manifest.firstViewportMediaCoverage, 0.3906);
	  assert.match(report.references[0].brief, /REFERENCE-BRIEF\.md/);
  assert.match(report.references[0].briefJson, /reference-brief\.json/);
  assert.match(report.references[0].layout, /reference-layout\.json/);
  assert.deepEqual(report.references[0].mediaSurfaceRoleCounts, {
    hero: 1,
    'service-card': 3,
  });
  assert.deepEqual(report.references[0].mediaSurfaceScaleCounts, {
    hero: 1,
    secondary: 0,
    'service-card': 3,
  });
  assert.deepEqual(report.references[0].requiredMediaRoles.map((role) => role.role), ['hero', 'service-card']);
  assert.equal(report.references[0].screenshots.length, 1);
  assert.match(report.files.startVisualReview, /start-visual-review\.png/);
  assert.equal(fs.existsSync(report.files.startVisualReview), true);
  const reviewImage = PNG.sync.read(fs.readFileSync(report.files.startVisualReview));
  assert.equal(reviewImage.width, 1032);
  assert.ok(reviewImage.height > 80);
  assert.deepEqual(rgbaAt(reviewImage, 2, 2), [12, 18, 27, 255]);
  assert.deepEqual(report.startVisualReview.columns, ['real reference', 'generated fallback']);
  assert.equal(report.startVisualReview.items.length, 1);
  assert.doesNotMatch(report.commands.next.auditLayout, /--require-real-reference/);
  assert.match(report.commands.next.auditLayout, /--require-marketplace-media/);
  assert.match(report.commands.next.draftLayout, /draft-monteby-layout\.js/);
  assert.match(report.commands.next.draftLayout, /reference-manifest\.json/);
  assert.doesNotMatch(report.commands.next.draftLayout, /--require-real-reference/);
  assert.match(report.commands.next.draftLayout, /--require-marketplace-media/);
  assert.match(report.commands.next.auditLayout, /reference-manifest\.json/);
  assert.match(report.commands.next.captureCandidateRender, /capture-template-reference\.js/);
  assert.match(report.commands.next.captureCandidateRender, /--capture-layout/);
  assert.match(report.commands.next.captureCandidateRender, /--full-page/);
  assert.match(report.commands.next.captureCandidateRender, /--viewport-timeout-ms 240000/);
  assert.match(report.commands.next.captureCandidateRender, /--viewport desktop:320x240/);
  assert.match(report.commands.next.runBenchmark, /reference-manifest\.json/);
  assert.match(report.commands.next.runBenchmark, /--candidate-manifest/);

  const benchmarkInvocations = fs.readFileSync(captureSpawnLog, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const captureInvocations = benchmarkInvocations.filter((args) => (
    args.some((arg) => path.basename(String(arg)) === 'capture-template-reference.js')
  ));
  const generatorInvocation = benchmarkInvocations.find((args) => (
    args.some((arg) => path.basename(String(arg)) === 'generate-random-html-target.js')
  ));
  assert.equal(captureInvocations.length, 2);
  assert.ok(generatorInvocation);
  assert.equal(generatorInvocation[generatorInvocation.indexOf('--viewport-timeout-ms') + 1], '240000');
  assert.equal(captureInvocations.some((args) => args.includes('--skip-screenshots')), true);
  assert.equal(captureInvocations.some((args) => !args.includes('--skip-screenshots')), true);
  for (const args of captureInvocations) {
    assert.equal(args.includes('--full-page'), true);
    const timeoutIndex = args.indexOf('--viewport-timeout-ms');
    assert.notEqual(timeoutIndex, -1);
    assert.equal(args[timeoutIndex + 1], '240000');
  }

  const markdown = fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8');
  const referenceBrief = fs.readFileSync(report.references[0].brief, 'utf8');
  assert.match(markdown, /Real References/);
  assert.match(markdown, /Read Before Authoring/);
  assert.match(markdown, /Do not present the generated fallback target as evidence/);
  assert.match(markdown, /If a candidate screenshot has no obvious photography/);
  assert.match(markdown, /start-visual-review\.png/);
  assert.match(markdown, /left: captured real reference, right: generated fallback/);
  assert.match(markdown, /reference-desktop\.png/);
  assert.match(markdown, /target-desktop\.png/);
  assert.match(markdown, /generated target layout/);
  assert.match(markdown, /REFERENCE-BRIEF\.md/);
  assert.match(markdown, /audit-authoring-readiness\.js/);
  assert.match(markdown, /CANDIDATE_PUBLIC_OR_PREVIEW_URL/);
  assert.match(markdown, /skips rendered media parity/);
  assert.match(referenceBrief, /untrusted rendered-visible browser layout text/);
  assert.match(referenceBrief, /Reference/);
  assert.match(referenceBrief, /Book now/);
  assert.match(referenceBrief, /Required Replacement Media Roles/);
  assert.match(markdown, /Media roles: hero:1, service-card:3/);
  assert.match(markdown, /Scaled media roles: hero:1, service-card:3/);
});

test('start visual benchmark rejects Maidy fallbacks without cutout or composite hero mechanics', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-maidy-cutout-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-maidy-cutout-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Maidy Reference</title></head><body><h1>Avoid A Dirty Scene, Keep Your Place Clean & Fresh</h1><img src="/cleaner.png"><img src="/vacuum.png"></body></html>');
  writeMaidyCutoutReferenceNpx(fakeNpxPath);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'maidy-cutout-start',
    '--seed',
    'maidy-cutout-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://askproject.net/maidy/home/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL: 'https://cdn.example.test/assets/original-vacuum-cutout.png',
      MONTEBY_MAIDY_HERO_CUTOUT_URL: '',
      MONTEBY_MAIDY_HERO_COMPOSITE_URL: '',
    },
  });

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.targetQuality.ok, false);
  assert.equal(report.target.heroAssetMode, 'stock');
  assert.equal(report.target.equipmentAssetMode, 'cutout');
  assert.match(report.targetQuality.errors.map((error) => error.code).join(' '), /fallback_maidy_cutout_or_composite_missing/);
  assert.match(report.files.startVisualReview, /start-visual-review\.png/);
  assert.equal(fs.existsSync(report.files.startVisualReview), true);
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /fallback_maidy_cutout_or_composite_missing/);
});

test('start visual benchmark accepts a generated Maidy fallback with a configured cutout', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-maidy-cutout-ready-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-maidy-cutout-ready-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Maidy Reference</title></head><body><h1>Avoid A Dirty Scene, Keep Your Place Clean & Fresh</h1><img src="/cleaner.png"><img src="/vacuum.png"></body></html>');
  writeMaidyCutoutReferenceNpx(fakeNpxPath);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'maidy-cutout-ready-start',
    '--seed',
    'maidy-cutout-ready-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://askproject.net/maidy/home/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      MONTEBY_MAIDY_HERO_CUTOUT_URL: 'https://cdn.example.test/assets/original-cleaner-cutout.png',
      MONTEBY_MAIDY_HERO_COMPOSITE_URL: '',
      MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL: 'https://cdn.example.test/assets/original-vacuum-cutout.png',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.target.heroAssetMode, 'cutout');
  assert.equal(report.target.equipmentAssetMode, 'cutout');
  assert.equal(report.targetQuality.ok, true);
  assert.equal(report.targetQuality.errors.length, 0);
});

test('start visual benchmark rejects Careglo fallbacks with generic car stock instead of active detailing media', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-careglo-detailing-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-careglo-detailing-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Careglo Reference</title></head><body><h1>Detailing That Defines True Luxury.</h1><img src="/spray-in-car.jpg"><img src="/preparing-detail.jpg"></body></html>');
  writeCaregloGenericCarReferenceNpx(fakeNpxPath);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'careglo-detailing-start',
    '--seed',
    'careglo-detailing-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.targetQuality.ok, false);
  assert.match(report.targetQuality.errors.map((error) => error.code).join(' '), /fallback_careglo_active_detailing_media_missing/);
  assert.match(report.files.startVisualReview, /start-visual-review\.png/);
  assert.equal(fs.existsSync(report.files.startVisualReview), true);
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /fallback_careglo_active_detailing_media_missing/);
});

test('start visual benchmark rejects Lumen fallbacks without doctor cutout hero mechanics', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-lumen-cutout-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-lumen-cutout-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Lumen Reference</title></head><body><h1>See Better. Live Better.</h1><img src="/doctor-cutout.png"></body></html>');
  writeLumenCutoutReferenceNpx(fakeNpxPath);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'lumen-cutout-start',
    '--seed',
    'lumen-cutout-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://omispace.com/lumen/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.targetQuality.ok, false);
  assert.match(report.targetQuality.errors.map((error) => error.code).join(' '), /fallback_lumen_doctor_cutout_missing/);
  assert.match(report.files.startVisualReview, /start-visual-review\.png/);
  assert.equal(fs.existsSync(report.files.startVisualReview), true);
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /fallback_lumen_doctor_cutout_missing/);
});

test('start visual benchmark fails when generated fallback is much thinner than real reference', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-thin-fallback-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-thin-fallback-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Dense Reference</title></head><body><h1>Dense optical reference</h1><img src="/hero.jpg"></body></html>');
  fs.writeFileSync(fakeNpxPath, `#!/usr/bin/env node
const fs = require('fs');
const screenshotOut = process.env.MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT || process.env.MONTEBY_REFERENCE_SCREENSHOT_OUT || process.env.MONTEBY_TARGET_SCREENSHOT_OUT || '';
if (screenshotOut) {
  writeTexturedPng(screenshotOut);
}
const out = process.env.MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT || process.env.MONTEBY_REFERENCE_LAYOUT_OUT || '';
if (!out && screenshotOut) {
  process.exit(0);
}
if (out) {
  const isReference = out.includes('/references/');
  const mediaBoxes = [];
  if (isReference) {
    mediaBoxes.push(mediaBox('https://cdn.example.test/reference-hero.jpg', 150, 24, 700, 360, 76800));
    mediaBoxes.push(mediaBox('https://cdn.example.test/reference-secondary.jpg', 20, 44, 210, 150, 31500));
    for (let index = 0; index < 32; index += 1) {
      mediaBoxes.push(mediaBox('https://cdn.example.test/reference-extra-' + index + '.jpg', 20, 300 + index * 180, 280, 160, 0));
    }
  } else {
    mediaBoxes.push(mediaBox('https://cdn.example.test/target-hero.jpg', 150, 24, 700, 360, 76000));
    mediaBoxes.push(mediaBox('https://cdn.example.test/target-secondary.jpg', 20, 96, 280, 150, 30000));
    for (let index = 0; index < 3; index += 1) {
      mediaBoxes.push(mediaBox('https://cdn.example.test/target-service-' + index + '.jpg', 20, 320 + index * 180, 280, 160, 0));
    }
  }
  fs.writeFileSync(out, JSON.stringify({
    capturedAt: '2026-07-08T00:00:00.000Z',
    url: isReference ? 'file:///tmp/dense-reference.html' : 'file:///tmp/target.html',
    title: isReference ? 'Dense Reference' : 'Target',
    viewport: { width: 320, height: 240, scrollHeight: isReference ? 3000 : 900 },
    textBoxes: [],
    mediaBoxes,
    landmarks: [],
    evidenceCompleteness: ${JSON.stringify(completeCaptureEvidence)},
    summary: {
      firstViewportTextBoxes: 0,
      firstViewportMediaBoxes: 2,
      firstViewportMediaCoverage: 1,
      largestMediaArea: 76800
    }
  }, null, 2));
  process.exit(0);
}
const last = process.argv[process.argv.length - 1];
fs.writeFileSync(last, 'fakepng');
function mediaBox(source, x, y, width, height, firstViewportArea) {
  return { tag: 'img', source, rect: { x, y, width, height, top: y }, firstViewportArea };
}
function writeTexturedPng(file) {
  const { PNG } = require(require.resolve('pngjs', { paths: [process.cwd()] }));
  const width = 320;
  const height = 240;
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      image.data[offset] = (x * 13 + y * 7) % 256;
      image.data[offset + 1] = (x * 5 + y * 17 + 48) % 256;
      image.data[offset + 2] = (x * 19 + y * 3 + 96) % 256;
      image.data[offset + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
`);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'thin-fallback-start',
    '--seed',
    'thin-fallback-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.targetQuality.errors.map((error) => error.code), [
    'fallback_reference_depth_shortfall',
    'fallback_reference_media_density_shortfall',
  ]);
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /Target Reference Quality Errors/);
});

test('start visual benchmark infers fallback archetype from captured reference content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-reference-content-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-reference-content-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, [
    '<!doctype html><html><head><title>Vision Studio Template</title></head><body>',
    '<nav><a href="/exam">Book eye exam</a></nav>',
    '<h1>Quality glasses for clearer vision</h1>',
    '<h2>Eyewear frames, lens guidance, and optical retail appointments</h2>',
    '<img src="/hero.jpg"><img src="/service.jpg">',
    '</body></html>',
  ].join(''));
  writeFakeNpx(fakeNpxPath, 'Quality glasses for clearer vision and optical care');

  const result = spawnSync(process.execPath, [
    startScript,
    '--label',
    'reference-content-start',
    '--seed',
    'reference-content-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://preview.example.test/template-kit/homepage/',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.options.archetype, 'optomatta-optical-retail');
  assert.deepEqual(report.options.archetypeInference, {
    archetype: 'optomatta-optical-retail',
    source: 'reference-content',
  });
  assert.equal(report.target.archetype, 'optomatta-optical-retail');
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /Fallback archetype: optomatta-optical-retail \(reference-content\)/);
});

test('start visual benchmark proceeds with an unknown captured URL as a generic measured reference', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-unknown-reference-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-unknown-reference-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, [
    '<!doctype html><html><head><title>Template Preview</title></head><body>',
    '<h1>Build better spaces for everyday teams</h1>',
    '<h2>Flexible planning, careful service, and simple appointments</h2>',
    '<img src="/hero.jpg"><img src="/service.jpg"><img src="/detail.jpg"><img src="/proof.jpg">',
    '</body></html>',
  ].join(''));
  writeFakeNpx(fakeNpxPath);

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'unknown-reference-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://preview.example.test/template-kit/homepage/',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.options.archetype, '');
  assert.deepEqual(report.options.archetypeInference, {
    archetype: '',
    source: 'generic-measured-reference',
  });
  assert.deepEqual(report.options.referenceClassification, {
    kind: 'generic-measured-reference',
    family: '',
    familyMechanics: false,
    source: 'captured-reference-layout',
  });
  assert.equal(report.options.marketplaceReference, true);
  assert.equal(report.options.requireMarketplace, false);
  assert.equal(report.target.variant, 'split-hero');
  assert.equal(['luxury-car-care', 'maid-service-agency', 'optomatta-optical-retail', 'lumen-eye-care-editorial'].includes(report.target.archetype), false);
  assert.equal(report.visualBrief.authoringRequirements.referenceClassification.kind, 'generic-measured-reference');
  assert.match(report.commands.next.draftLayout, /--require-real-reference/);
  assert.doesNotMatch(report.commands.next.draftLayout, /--require-marketplace-media/);
  assert.equal(fs.existsSync(path.join(directory, 'target.html')), true);
  assert.match(fs.readFileSync(path.join(directory, 'NEXT-STEPS.md'), 'utf8'), /generic measured reference/i);
});

test('start visual benchmark fails when a real reference lacks rendered media roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-weak-reference-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-weak-reference-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Weak Reference</title></head><body><img src="/logo.png"><h1>Reference</h1></body></html>');
  fs.writeFileSync(fakeNpxPath, `#!/bin/sh
screenshot_out="\${MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT:-$MONTEBY_REFERENCE_SCREENSHOT_OUT}"
if [ -n "$screenshot_out" ]; then
printf fakepng > "$screenshot_out"
fi
if [ -n "$MONTEBY_TARGET_SCREENSHOT_OUT" ]; then
printf fakepng > "$MONTEBY_TARGET_SCREENSHOT_OUT"
exit 0
fi
layout_out="\${MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT:-$MONTEBY_REFERENCE_LAYOUT_OUT}"
if [ -n "$layout_out" ]; then
cat > "$layout_out" <<'JSON'
{
  "capturedAt": "2026-07-08T00:00:00.000Z",
  "url": "file:///tmp/weak-reference.html",
  "title": "Weak Reference",
  "viewport": {
    "width": 320,
    "height": 240,
    "scrollHeight": 300
  },
  "textBoxes": [],
  "mediaBoxes": [
    {
      "tag": "img",
      "source": "https://cdn.example.test/logo-light.png",
      "rect": {
        "x": 20,
        "y": 20,
        "width": 80,
        "height": 32,
        "top": 20
      },
      "firstViewportArea": 2560
    }
  ],
  "landmarks": [],
  "evidenceCompleteness": ${JSON.stringify(completeCaptureEvidence)},
  "summary": {
    "firstViewportTextBoxes": 0,
    "firstViewportMediaBoxes": 1,
    "firstViewportMediaCoverage": 0.03,
    "largestMediaArea": 2560
  }
}
JSON
exit 0
fi
last=""
for arg in "$@"; do last="$arg"; done
printf fakepng > "$last"
`);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'weak-reference-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Reference capture quality failed/);
  assert.match(result.stderr, /missing rendered "hero" media role/);
  assert.match(result.stderr, /missing rendered "service-card" media role/);
});

test('start visual benchmark fails when a real reference has undersized rendered photo roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-start-small-reference-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-small-reference-npx-'));
  const fakeNpxPath = path.join(binDirectory, 'npx');
  const referenceHtml = path.join(directory, 'reference.html');

  fs.writeFileSync(referenceHtml, '<!doctype html><html><head><title>Small Reference</title></head><body><img src="/hero.jpg"><img src="/service.jpg"><h1>Reference</h1></body></html>');
  fs.writeFileSync(fakeNpxPath, `#!/bin/sh
screenshot_out="\${MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT:-$MONTEBY_REFERENCE_SCREENSHOT_OUT}"
if [ -n "$screenshot_out" ]; then
printf fakepng > "$screenshot_out"
fi
if [ -n "$MONTEBY_TARGET_SCREENSHOT_OUT" ]; then
printf fakepng > "$MONTEBY_TARGET_SCREENSHOT_OUT"
exit 0
fi
layout_out="\${MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT:-$MONTEBY_REFERENCE_LAYOUT_OUT}"
if [ -n "$layout_out" ]; then
cat > "$layout_out" <<'JSON'
{
  "capturedAt": "2026-07-08T00:00:00.000Z",
  "url": "file:///tmp/small-reference.html",
  "title": "Small Reference",
  "viewport": {
    "width": 320,
    "height": 240,
    "scrollHeight": 900
  },
  "textBoxes": [],
  "mediaBoxes": [
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-hero.jpg",
      "rect": {
        "x": 20,
        "y": 24,
        "width": 260,
        "height": 120,
        "top": 24
      },
      "firstViewportArea": 31200
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-service-1.jpg",
      "rect": {
        "x": 20,
        "y": 320,
        "width": 220,
        "height": 90,
        "top": 320
      },
      "firstViewportArea": 0
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-service-2.jpg",
      "rect": {
        "x": 20,
        "y": 430,
        "width": 220,
        "height": 90,
        "top": 430
      },
      "firstViewportArea": 0
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/reference-service-3.jpg",
      "rect": {
        "x": 20,
        "y": 540,
        "width": 220,
        "height": 90,
        "top": 540
      },
      "firstViewportArea": 0
    }
  ],
  "landmarks": [],
  "evidenceCompleteness": ${JSON.stringify(completeCaptureEvidence)},
  "summary": {
    "firstViewportTextBoxes": 0,
    "firstViewportMediaBoxes": 1,
    "firstViewportMediaCoverage": 0.4,
    "largestMediaArea": 31200
  }
}
JSON
exit 0
fi
last=""
for arg in "$@"; do last="$arg"; done
printf fakepng > "$last"
`);
  fs.chmodSync(fakeNpxPath, 0o755);

  const result = spawnSync(process.execPath, [
    startScript,
    '--seed',
    'small-reference-seed',
    '--variant',
    'auto',
    '--reference-url',
    'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements',
    '--reference-html-file',
    referenceHtml,
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Reference capture quality failed/);
  assert.match(result.stderr, /rendered "hero" media role is undersized/);
  assert.match(result.stderr, /rendered "service-card" media role is undersized/);
});

function writeFakeNpx(fakeNpxPath, renderedHeading = 'Target', evidenceCompleteness = completeCaptureEvidence) {
  fs.writeFileSync(fakeNpxPath, `#!/bin/sh
last=""
for arg in "$@"; do last="$arg"; done
${fakePngShellCommand()}
layout_out="\${MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT:-$MONTEBY_REFERENCE_LAYOUT_OUT}"
if [ -n "$layout_out" ]; then
cat > "$layout_out" <<'JSON'
{
  "capturedAt": "2026-07-08T00:00:00.000Z",
  "url": "file:///tmp/target.html",
  "title": ${JSON.stringify(renderedHeading)},
  "viewport": {
    "width": 320,
    "height": 240,
    "scrollHeight": 900
  },
  "textBoxes": [
    {
      "tag": "h1",
      "text": ${JSON.stringify(renderedHeading)},
      "rect": {
        "x": 24,
        "y": 24,
        "width": 180,
        "height": 48,
        "top": 24
      },
      "firstViewportArea": 8640
    }
  ],
  "mediaBoxes": [
    {
      "tag": "img",
      "source": "https://cdn.example.test/target-hero.jpg",
      "rect": {
        "x": 150,
        "y": 24,
        "width": 700,
        "height": 360,
        "top": 24
      },
      "firstViewportArea": 76000
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/target-secondary.jpg",
      "rect": {
        "x": 20,
        "y": 96,
        "width": 280,
        "height": 150,
        "top": 96
      },
      "firstViewportArea": 30000
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/target-service-1.jpg",
      "rect": {
        "x": 20,
        "y": 320,
        "width": 280,
        "height": 160,
        "top": 320
      },
      "firstViewportArea": 0
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/target-service-2.jpg",
      "rect": {
        "x": 20,
        "y": 500,
        "width": 280,
        "height": 160,
        "top": 500
      },
      "firstViewportArea": 0
    },
    {
      "tag": "img",
      "source": "https://cdn.example.test/target-service-3.jpg",
      "rect": {
        "x": 20,
        "y": 680,
        "width": 280,
        "height": 160,
        "top": 680
      },
      "firstViewportArea": 0
    }
  ],
  "landmarks": [],
  "evidenceCompleteness": ${JSON.stringify(evidenceCompleteness)},
  "summary": {
    "firstViewportTextBoxes": 1,
    "firstViewportMediaBoxes": 1,
    "firstViewportMediaCoverage": 0.33,
    "largestMediaArea": 25500
  }
}
JSON
exit 0
fi
${fakePngShellCommand()}
`);
  fs.chmodSync(fakeNpxPath, 0o755);
}

function fakePngShellCommand() {
  return `out="\${MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT:-\${MONTEBY_REFERENCE_SCREENSHOT_OUT:-\${MONTEBY_TARGET_SCREENSHOT_OUT:-$last}}}"
if [ -n "$out" ]; then
"${process.execPath}" -e 'const fs=require("fs"); const {PNG}=require("pngjs"); const width=320; const height=240; const image=new PNG({width,height}); for (let y=0;y<height;y+=1){ for (let x=0;x<width;x+=1){ const offset=((y*width)+x)*4; image.data[offset]=(x*13+y*7)%256; image.data[offset+1]=(x*5+y*17+48)%256; image.data[offset+2]=(x*19+y*3+96)%256; image.data[offset+3]=255; }} fs.writeFileSync(process.argv[1], PNG.sync.write(image));' "$out"
fi`;
}

function rgbaAt(image, x, y) {
  const offset = ((y * image.width) + x) * 4;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ];
}

function writeCaregloGenericCarReferenceNpx(fakeNpxPath) {
  fs.writeFileSync(fakeNpxPath, `#!/usr/bin/env node
const fs = require('fs');
const screenshotOut = process.env.MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT || process.env.MONTEBY_REFERENCE_SCREENSHOT_OUT || process.env.MONTEBY_TARGET_SCREENSHOT_OUT || '';
if (screenshotOut) {
  writeTexturedPng(screenshotOut);
}
const out = process.env.MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT || process.env.MONTEBY_REFERENCE_LAYOUT_OUT || '';
if (!out && screenshotOut) {
  process.exit(0);
}
if (out) {
  const isReference = out.includes('/references/');
  const mediaBoxes = isReference
    ? [
      mediaBox('img', 'https://templates.studioniskala.com/car/wp-content/uploads/sites/25/2025/08/spray-in-c-S9KB8AR.jpg', 80, 48, 260, 360, 72000),
      mediaBox('img', 'https://templates.studioniskala.com/car/wp-content/uploads/sites/25/2025/08/preparing-a-U3AT8SC-1536x1024.jpg', 20, 150, 220, 130, 28600),
      mediaBox('img', 'https://templates.studioniskala.com/car/wp-content/uploads/sites/25/2025/08/spray-in-c-ET7FV5P.jpg', 20, 320, 280, 160, 0),
      mediaBox('img', 'https://templates.studioniskala.com/car/wp-content/uploads/sites/25/2025/08/auto-service-SZWZD6Q-1536x1024.jpg', 20, 500, 280, 160, 0),
      mediaBox('img', 'https://templates.studioniskala.com/car/wp-content/uploads/sites/25/2025/08/car-from-w-CGBWSMN.jpg', 20, 680, 280, 160, 0),
    ]
    : [
      mediaBox('img', 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=82', 80, 48, 260, 360, 72000),
      mediaBox('img', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=82', 20, 150, 220, 130, 28600),
      mediaBox('img', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=700&q=80', 20, 320, 280, 160, 0),
      mediaBox('img', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=700&q=80', 20, 500, 280, 160, 0),
      mediaBox('img', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=700&q=80', 20, 680, 280, 160, 0),
    ];
  fs.writeFileSync(out, JSON.stringify({
    capturedAt: '2026-07-08T00:00:00.000Z',
    url: isReference ? 'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements' : 'file:///tmp/target.html',
    title: isReference ? 'Careglo Reference' : 'Target',
    viewport: { width: 320, height: 240, scrollHeight: 900 },
    textBoxes: [
      { tag: 'h1', text: 'Detailing That Defines True Luxury.', rect: { x: 20, y: 80, width: 220, height: 120, top: 80 }, firstViewportArea: 26400 },
      { tag: 'a', text: 'Make Appointment', rect: { x: 210, y: 28, width: 90, height: 34, top: 28 }, firstViewportArea: 3060 }
    ],
    mediaBoxes,
    landmarks: [
      { tag: 'section', rect: { x: 0, y: 0, width: 320, height: 72, top: 0 }, backgroundColor: 'rgb(16, 17, 20)' }
    ],
    evidenceCompleteness: ${JSON.stringify(completeCaptureEvidence)},
    summary: {
      firstViewportTextBoxes: 2,
      firstViewportMediaBoxes: 2,
      firstViewportMediaCoverage: 0.62,
      largestMediaArea: 72000
    }
  }, null, 2));
  process.exit(0);
}
const last = process.argv[process.argv.length - 1];
fs.writeFileSync(last, Buffer.from('${testPngBase64}', 'base64'));
function mediaBox(tag, source, x, y, width, height, firstViewportArea) {
  return { tag, source, rect: { x, y, width, height, top: y }, firstViewportArea, objectFit: 'cover', backgroundSize: 'auto' };
}
function writeTexturedPng(file) {
  const { PNG } = require(require.resolve('pngjs', { paths: [process.cwd()] }));
  const width = 320;
  const height = 240;
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      image.data[offset] = (x * 13 + y * 7) % 256;
      image.data[offset + 1] = (x * 5 + y * 17 + 48) % 256;
      image.data[offset + 2] = (x * 19 + y * 3 + 96) % 256;
      image.data[offset + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
`);
}

function writeMaidyCutoutReferenceNpx(fakeNpxPath) {
  fs.writeFileSync(fakeNpxPath, `#!/usr/bin/env node
const fs = require('fs');
const screenshotOut = process.env.MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT || process.env.MONTEBY_REFERENCE_SCREENSHOT_OUT || process.env.MONTEBY_TARGET_SCREENSHOT_OUT || '';
if (screenshotOut) {
  writeTexturedPng(screenshotOut);
}
const out = process.env.MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT || process.env.MONTEBY_REFERENCE_LAYOUT_OUT || '';
if (!out && screenshotOut) {
  process.exit(0);
}
if (out) {
  const isReference = out.includes('/references/');
  const mediaBoxes = isReference
    ? [
      mediaBox('section', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/bg_2.png', 0, 49, 700, 360, 252000),
      mediaBox('div', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/bg_35.png', 150, 60, 600, 320, 90000),
      mediaBox('img', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/happy-cleaner-with-spray-and-rag-smiling-at-camera2-QCHMFLG-689x1024.png', 160, 60, 570, 320, 90000),
      mediaBox('img', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/vacuum-cleaner3.png', -80, 180, 320, 258, 16000),
      mediaBox('img', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/service-1.jpg', 20, 320, 280, 160, 0),
      mediaBox('img', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/service-2.jpg', 20, 500, 280, 160, 0),
      mediaBox('img', 'https://askproject.net/maidy/wp-content/uploads/sites/71/2022/05/service-3.jpg', 20, 680, 280, 160, 0),
    ]
    : [
      mediaBox('img', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=82', 150, 24, 700, 360, 76000),
      mediaBox('img', 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=82', 20, 96, 280, 150, 30000),
      mediaBox('img', 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80', 20, 320, 280, 160, 0),
      mediaBox('img', 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=700&q=80', 20, 500, 280, 160, 0),
      mediaBox('img', 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=700&q=80', 20, 680, 280, 160, 0),
    ];
  fs.writeFileSync(out, JSON.stringify({
    capturedAt: '2026-07-08T00:00:00.000Z',
    url: isReference ? 'https://askproject.net/maidy/home/?storefront=envato-elements' : 'file:///tmp/target.html',
    title: isReference ? 'Maidy Reference' : 'Target',
    viewport: { width: 320, height: 240, scrollHeight: 900 },
    textBoxes: [
      { tag: 'h1', text: 'Avoid A Dirty Scene, Keep Your Place Clean & Fresh', rect: { x: 20, y: 80, width: 220, height: 120, top: 80 }, firstViewportArea: 26400 },
      { tag: 'a', text: 'Contact', rect: { x: 240, y: 40, width: 60, height: 30, top: 40 }, firstViewportArea: 1800 }
    ],
    mediaBoxes,
    landmarks: [
      { tag: 'section', rect: { x: 0, y: 0, width: 320, height: 40, top: 0 }, backgroundColor: 'rgb(32, 55, 64)' },
      { tag: 'section', rect: { x: 0, y: 210, width: 320, height: 80, top: 210 }, backgroundColor: 'rgb(32, 55, 64)' }
    ],
    evidenceCompleteness: ${JSON.stringify(completeCaptureEvidence)},
    summary: {
      firstViewportTextBoxes: 2,
      firstViewportMediaBoxes: 4,
      firstViewportMediaCoverage: 1,
      largestMediaArea: 252000
    }
  }, null, 2));
  process.exit(0);
}
const last = process.argv[process.argv.length - 1];
fs.writeFileSync(last, Buffer.from('${testPngBase64}', 'base64'));
function mediaBox(tag, source, x, y, width, height, firstViewportArea) {
  return { tag, source, rect: { x, y, width, height, top: y }, firstViewportArea, objectFit: 'cover', backgroundSize: tag === 'section' || tag === 'div' ? 'cover' : 'auto' };
}
function writeTexturedPng(file) {
  const { PNG } = require(require.resolve('pngjs', { paths: [process.cwd()] }));
  const width = 320;
  const height = 240;
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      image.data[offset] = (x * 13 + y * 7) % 256;
      image.data[offset + 1] = (x * 5 + y * 17 + 48) % 256;
      image.data[offset + 2] = (x * 19 + y * 3 + 96) % 256;
      image.data[offset + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
`);
}

function writeLumenCutoutReferenceNpx(fakeNpxPath) {
  fs.writeFileSync(fakeNpxPath, `#!/usr/bin/env node
const fs = require('fs');
const screenshotOut = process.env.MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT || process.env.MONTEBY_REFERENCE_SCREENSHOT_OUT || process.env.MONTEBY_TARGET_SCREENSHOT_OUT || '';
if (screenshotOut) {
  writeTexturedPng(screenshotOut);
}
const out = process.env.MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT || process.env.MONTEBY_REFERENCE_LAYOUT_OUT || '';
if (!out && screenshotOut) {
  process.exit(0);
}
if (out) {
  const isReference = out.includes('/references/');
  const mediaBoxes = isReference
    ? [
      mediaBox('img', 'https://omispace.com/lumen/wp-content/uploads/sites/10/2024/01/lumen-doctor-cutout.png', 80, 80, 300, 420, 80000),
      mediaBox('img', 'https://omispace.com/lumen/wp-content/uploads/sites/10/2024/01/eye-exam-card.jpg', 20, 150, 220, 130, 28600),
      mediaBox('img', 'https://omispace.com/lumen/wp-content/uploads/sites/10/2024/01/service-1.jpg', 20, 320, 280, 160, 0),
      mediaBox('img', 'https://omispace.com/lumen/wp-content/uploads/sites/10/2024/01/service-2.jpg', 20, 500, 280, 160, 0),
      mediaBox('img', 'https://omispace.com/lumen/wp-content/uploads/sites/10/2024/01/service-3.jpg', 20, 680, 280, 160, 0),
    ]
    : [
      mediaBox('img', 'https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=1200&q=82', 80, 80, 300, 420, 80000),
      mediaBox('img', 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=82', 20, 150, 220, 130, 28600),
      mediaBox('img', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=700&q=80', 20, 320, 280, 160, 0),
      mediaBox('img', 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80', 20, 500, 280, 160, 0),
      mediaBox('img', 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=700&q=80', 20, 680, 280, 160, 0),
    ];
  fs.writeFileSync(out, JSON.stringify({
    capturedAt: '2026-07-08T00:00:00.000Z',
    url: isReference ? 'https://omispace.com/lumen/?storefront=envato-elements' : 'file:///tmp/target.html',
    title: isReference ? 'Lumen Reference' : 'Target',
    viewport: { width: 320, height: 240, scrollHeight: 900 },
    textBoxes: [
      { tag: 'h1', text: 'See Better. Live Better.', rect: { x: 20, y: 80, width: 220, height: 120, top: 80 }, firstViewportArea: 26400 },
      { tag: 'a', text: 'Appointment Now', rect: { x: 210, y: 28, width: 90, height: 34, top: 28 }, firstViewportArea: 3060 }
    ],
    mediaBoxes,
    landmarks: [
      { tag: 'section', rect: { x: 0, y: 0, width: 320, height: 72, top: 0 }, backgroundColor: 'rgb(255, 255, 255)' }
    ],
    evidenceCompleteness: ${JSON.stringify(completeCaptureEvidence)},
    summary: {
      firstViewportTextBoxes: 2,
      firstViewportMediaBoxes: 2,
      firstViewportMediaCoverage: 0.52,
      largestMediaArea: 80000
    }
  }, null, 2));
  process.exit(0);
}
const last = process.argv[process.argv.length - 1];
fs.writeFileSync(last, Buffer.from('${testPngBase64}', 'base64'));
function mediaBox(tag, source, x, y, width, height, firstViewportArea) {
  return { tag, source, rect: { x, y, width, height, top: y }, firstViewportArea, objectFit: 'cover', backgroundSize: 'auto' };
}
function writeTexturedPng(file) {
  const { PNG } = require(require.resolve('pngjs', { paths: [process.cwd()] }));
  const width = 320;
  const height = 240;
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      image.data[offset] = (x * 13 + y * 7) % 256;
      image.data[offset + 1] = (x * 5 + y * 17 + 48) % 256;
      image.data[offset + 2] = (x * 19 + y * 3 + 96) % 256;
      image.data[offset + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
`);
}
