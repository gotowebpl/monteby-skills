#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const iterationScript = path.join(root, 'monteby-site-authoring', 'scripts', 'run-visual-iteration.js');

test('run visual iteration documents the viewport timeout option', () => {
  const result = spawnSync(process.execPath, [iterationScript, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /--full-page/);
  assert.match(result.stdout, /--viewport-only/);
  assert.match(result.stdout, /--viewport-timeout-ms/);
  assert.match(result.stdout, /--channel chrome/);
  assert.match(result.stdout, /--max-percent/);
  assert.match(result.stdout, /--max-viewport-percent/);
  assert.match(result.stdout, /locally installed Chrome/);
  assert.match(result.stdout, /reference, target, candidate, and long-mobile viewport capture/);
});

test('run visual iteration rejects non-positive viewport timeouts', () => {
  for (const value of ['0', '-1', '1.5', 'invalid']) {
    const result = spawnSync(process.execPath, [iterationScript, '--viewport-timeout-ms', value], { encoding: 'utf8' });

    assert.equal(result.status, 1, value);
    assert.match(result.stderr, /--viewport-timeout-ms must be a positive integer/, value);
  }
});

test('run visual iteration forwards viewport timeout to start, candidate, and long-mobile captures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-timeout-iteration-'));
  const contract = path.join(directory, 'contract.json');
  const spawnLog = path.join(directory, 'spawn-log.ndjson');
  const spawnHarness = path.join(directory, 'spawn-harness.cjs');

  fs.writeFileSync(contract, '{}\n');
  fs.writeFileSync(spawnHarness, `'use strict';
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const originalSpawnSync = childProcess.spawnSync;
const handledScripts = new Set([
  'start-visual-benchmark.js',
  'audit-authoring-readiness.js',
  'draft-monteby-layout.js',
  'render-monteby-preview.js',
  'capture-template-reference.js',
  'run-visual-benchmark.js',
]);

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? '' : String(args[index + 1] || '');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\n');
}

function success(report = null) {
  return {
    status: 0,
    stdout: report === null ? '' : JSON.stringify(report),
    stderr: '',
  };
}

childProcess.spawnSync = function runVisualIterationHarness(command, args, options) {
  const script = Array.isArray(args) && args.length > 0 ? path.basename(String(args[0])) : '';
  if (!handledScripts.has(script)) {
    return originalSpawnSync.call(this, command, args, options);
  }

  fs.appendFileSync(process.env.MONTEBY_ITERATION_SPAWN_LOG, JSON.stringify({ script, args }) + '\\n');

  if (script === 'start-visual-benchmark.js') {
    const outDir = optionValue(args, '--out-dir');
    const referenceHtmlFile = optionValue(args, '--reference-html-file');
    const targetHtml = path.join(outDir, 'target.html');
    const targetManifest = path.join(outDir, 'target-manifest.json');
    const mobileLayout = path.join(outDir, 'target-layout-mobile.json');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(targetHtml, '<!doctype html><title>Target</title>');
    writeJson(mobileLayout, {
      viewport: { width: 390, height: 844, scrollHeight: 2200 },
      mediaBoxes: [{
        source: 'https://images.example.test/photo-after-fold.jpg',
        rect: { x: 24, y: 900, width: 342, height: 360, top: 900 },
        firstViewportArea: 0,
      }],
    });
    writeJson(targetManifest, {
      sourceUrl: pathToFileURL(targetHtml).href,
      layouts: [{ label: 'mobile', file: path.basename(mobileLayout), status: 'ok' }],
      requiredMediaRoles: [],
    });
    const references = [];
    if (referenceHtmlFile) {
      const referenceDir = path.join(outDir, 'references', 'local-html');
      const referenceLayout = path.join(referenceDir, 'reference-layout-mobile.json');
      const referenceManifest = path.join(referenceDir, 'reference-manifest.json');
      writeJson(referenceLayout, {
        viewport: { width: 390, height: 844, scrollHeight: 1800 },
        textBoxes: [],
        mediaBoxes: [],
        landmarks: [{ tag: 'main', rect: { x: 0, y: 0, width: 390, height: 1800, top: 0 } }],
      });
      writeJson(referenceManifest, {
        sourceUrl: pathToFileURL(referenceHtmlFile).href,
        layouts: [{ label: 'mobile', file: path.basename(referenceLayout), status: 'ok' }],
        requiredMediaRoles: [],
      });
      references.push({
        url: pathToFileURL(referenceHtmlFile).href,
        manifest: referenceManifest,
      });
    }
    const report = {
      ok: true,
      options: {
        requireMarketplace: false,
        marketplaceReference: false,
        referenceUrls: references.map((reference) => reference.url),
        archetype: '',
        referenceClassification: referenceHtmlFile
          ? { kind: 'generic-measured-reference', family: '', familyMechanics: false, source: 'captured-reference-layout' }
          : { kind: 'generated-target', family: '', familyMechanics: false, source: 'none' },
      },
      target: { variant: 'split-hero' },
      references,
      files: { targetHtml, targetManifest },
    };
    writeJson(path.join(outDir, 'benchmark-start-report.json'), report);
    return success(report);
  }

  if (script === 'audit-authoring-readiness.js') {
    return success({ ok: true });
  }

  if (script === 'draft-monteby-layout.js') {
    writeJson(optionValue(args, '--out'), {
      ROOT: {
        type: { resolvedName: 'RootCanvas' },
        isCanvas: true,
        props: {},
        nodes: [],
      },
    });
    return success({ ok: true, stats: {}, audit: { ok: true }, qualityErrors: [] });
  }

  if (script === 'render-monteby-preview.js') {
    const out = optionValue(args, '--out');
    const fragment = optionValue(args, '--fragment-out');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, '<!doctype html><title>Candidate</title>');
    fs.writeFileSync(fragment, '<main>Candidate</main>');
    return success();
  }

  if (script === 'capture-template-reference.js') {
    const outDir = optionValue(args, '--out-dir');
    writeJson(path.join(outDir, 'reference-manifest.json'), {
      sourceUrl: optionValue(args, '--url'),
      requiredMediaRoles: [],
    });
    return success();
  }

  const out = optionValue(args, '--out');
  const markdown = optionValue(args, '--markdown');
  if (out) {
    writeJson(out, { ok: true });
  }
  if (markdown) {
    fs.mkdirSync(path.dirname(markdown), { recursive: true });
    fs.writeFileSync(markdown, '# Benchmark\\n');
  }
  return success({
    ok: true,
    blockers: [],
    files: {},
    visualReview: {},
    comparison: { ok: true, budgetErrors: [] },
    templateVisualVerdict: { ok: true },
  });
};
`);

  const spawnOptions = {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${spawnHarness}`].filter(Boolean).join(' '),
      MONTEBY_ITERATION_SPAWN_LOG: spawnLog,
    },
  };
  const fullPageResult = spawnSync(process.execPath, [
    iterationScript,
    '--contract',
    contract,
    '--out-dir',
    directory,
    '--variant',
    'split-hero',
    '--viewport',
    'mobile:390x844',
    '--viewport-timeout-ms',
    '240000',
    '--json',
  ], spawnOptions);

  assert.equal(fullPageResult.status, 0, fullPageResult.stderr || fullPageResult.stdout);
  const fullPageReport = JSON.parse(fullPageResult.stdout);
  assert.equal(fullPageReport.options.viewportTimeoutMs, 240000);
  assert.equal(fullPageReport.options.fullPage, true);
  assert.equal(fullPageReport.options.preserveSourceText, true);
  assert.equal(fullPageReport.longMobile.needed, false);
  assert.equal(fullPageReport.longMobile.reason, 'full_page_capture_already_covers_below_fold');

  const fullPageSpawns = fs.readFileSync(spawnLog, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const fullPageStart = fullPageSpawns.find((spawn) => spawn.script === 'start-visual-benchmark.js');
  const fullPageReadiness = fullPageSpawns.find((spawn) => spawn.script === 'audit-authoring-readiness.js');
  const fullPageDraft = fullPageSpawns.find((spawn) => spawn.script === 'draft-monteby-layout.js');
  const fullPageCaptures = fullPageSpawns.filter((spawn) => spawn.script === 'capture-template-reference.js');
  const fullPageBenchmarks = fullPageSpawns.filter((spawn) => spawn.script === 'run-visual-benchmark.js');

  assert.ok(fullPageStart);
  assert.ok(fullPageReadiness);
  assert.ok(fullPageDraft);
  assert.equal(timeoutValue(fullPageStart.args), '240000');
  assert.equal(fullPageStart.args.includes('--full-page'), true);
  assert.equal(argumentValue(fullPageReadiness.args, '--reference-layout'), path.join(directory, 'target-layout-mobile.json'));
  assert.equal(fullPageDraft.args.includes('--preserve-source-text'), true);
  assert.equal(fullPageCaptures.length, 1);
  assert.equal(fullPageCaptures[0].args.includes('--full-page'), true);
  assert.equal(timeoutValue(fullPageCaptures[0].args), '240000');
  assert.equal(fullPageBenchmarks.length, 1);
  assert.equal(fullPageBenchmarks[0].args.includes('--pad-to-largest'), true);
  assert.equal(fullPageBenchmarks[0].args.includes('--candidate-manifest'), true);
  assert.equal(fullPageBenchmarks[0].args.includes('--candidate-dir'), false);

  fs.writeFileSync(spawnLog, '');
  const genericDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-generic-html-iteration-'));
  const genericReference = path.join(genericDirectory, 'reference.html');
  fs.writeFileSync(genericReference, '<!doctype html><main><h1>Measured local HTML</h1></main>');
  const genericResult = spawnSync(process.execPath, [
    iterationScript,
    '--contract',
    contract,
    '--out-dir',
    genericDirectory,
    '--reference-html-file',
    genericReference,
    '--preserve-source-text',
    '--viewport',
    'mobile:390x844',
    '--viewport-timeout-ms',
    '240000',
    '--json',
  ], spawnOptions);

  assert.equal(genericResult.status, 0, genericResult.stderr || genericResult.stdout);
  const genericSpawns = fs.readFileSync(spawnLog, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const genericDraft = genericSpawns.find((spawn) => spawn.script === 'draft-monteby-layout.js');
  const genericBenchmarks = genericSpawns.filter((spawn) => spawn.script === 'run-visual-benchmark.js');
  assert.ok(genericDraft);
  assert.equal(genericDraft.args.includes('--require-real-reference'), false);
  assert.equal(genericDraft.args.includes('--require-marketplace-media'), false);
  assert.equal(genericDraft.args.includes('--preserve-source-text'), true);
  assert.equal(genericBenchmarks.length, 1);
  assert.equal(genericBenchmarks[0].args.includes('--require-real-reference'), false);
  assert.equal(genericBenchmarks[0].args.includes('--require-marketplace-media'), false);
  assert.equal(genericBenchmarks[0].args.includes('--candidate-manifest'), true);

  fs.writeFileSync(spawnLog, '');
  const viewportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-timeout-viewport-iteration-'));
  const viewportResult = spawnSync(process.execPath, [
    iterationScript,
    '--contract',
    contract,
    '--out-dir',
    viewportDirectory,
    '--variant',
    'split-hero',
    '--viewport',
    'mobile:390x844',
    '--viewport-timeout-ms',
    '240000',
    '--viewport-only',
    '--json',
  ], spawnOptions);

  assert.equal(viewportResult.status, 0, viewportResult.stderr || viewportResult.stdout);
  const viewportReport = JSON.parse(viewportResult.stdout);
  assert.equal(viewportReport.options.viewportTimeoutMs, 240000);
  assert.equal(viewportReport.options.fullPage, false);
  assert.equal(viewportReport.longMobile.needed, true);

  const viewportSpawns = fs.readFileSync(spawnLog, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const viewportStart = viewportSpawns.find((spawn) => spawn.script === 'start-visual-benchmark.js');
  const viewportCaptures = viewportSpawns.filter((spawn) => spawn.script === 'capture-template-reference.js');
  const viewportBenchmarks = viewportSpawns.filter((spawn) => spawn.script === 'run-visual-benchmark.js');

  assert.ok(viewportStart);
  assert.equal(timeoutValue(viewportStart.args), '240000');
  assert.equal(viewportStart.args.includes('--viewport-only'), true);
  assert.equal(viewportCaptures.length, 3);
  assert.deepEqual(
    viewportCaptures.map((capture) => path.relative(viewportDirectory, argumentValue(capture.args, '--out-dir'))).sort(),
    ['candidate/rendered', 'long-mobile/candidate', 'long-mobile/reference']
  );
  for (const capture of viewportCaptures) {
    assert.equal(timeoutValue(capture.args), '240000');
    assert.equal(capture.args.includes('--full-page'), false);
  }
  assert.equal(viewportBenchmarks.length, 2);
  assert.equal(viewportBenchmarks.every((benchmark) => !benchmark.args.includes('--pad-to-largest')), true);
});

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? '' : String(args[index + 1] || '');
}

function timeoutValue(args) {
  return argumentValue(args, '--viewport-timeout-ms');
}
