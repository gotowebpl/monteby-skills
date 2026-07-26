#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(
  root,
  'monteby-site-authoring',
  'scripts',
  'run-canonical-verification.js'
);

test('canonical verification is the only pipeline stage that emits DONE', () => {
  const fixture = createFixture();
  const result = runFixture(fixture, false);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.artifact, 'monteby-canonical-verification');
  assert.equal(report.ok, true);
  assert.equal(report.status, 'DONE');
  assert.equal(report.fidelityPassed, true);
  assert.equal(report.canonicalVerification, true);
  assert.equal(report.productReady, true);
  assert.equal(report.nextAction.id, 'complete');
  assert.equal(report.nextAction.tool, '');
  assert.deepEqual(report.nextAction.args, []);
  assert.equal(fs.existsSync(report.files.report), true);

  const spawns = readSpawns(fixture.spawnLog);
  const capture = spawns.find((entry) => entry.script === 'capture-template-reference.js');
  const benchmark = spawns.find((entry) => entry.script === 'run-visual-benchmark.js');
  assert.ok(capture);
  assert.ok(benchmark);
  assert.deepEqual(argumentValues(capture.args, '--viewport'), [
    'desktop:1440x1200',
    'tablet:834x1112',
    'mobile:390x844',
  ]);
  assert.equal(capture.args.includes('--full-page'), true);
  assert.equal(capture.args.includes('--require-layout'), true);
  assert.equal(benchmark.args.includes('--candidate-manifest'), true);
  assert.equal(benchmark.args.includes('--pad-to-largest'), true);
});

test('canonical comparison failure returns to local repair and cannot emit DONE', () => {
  const fixture = createFixture();
  const result = runFixture(fixture, true);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.status, 'CANONICAL_COMPARE_FAILED');
  assert.equal(report.fidelityPassed, false);
  assert.equal(report.canonicalVerification, false);
  assert.equal(report.productReady, false);
  assert.equal(report.nextAction.id, 'repair_candidate_from_queue');
  assert.equal(path.basename(report.nextAction.tool), 'run-visual-iteration.js');
  assert.equal(report.nextAction.args.includes('--candidate-layout'), true);
  assert.ok(report.repairQueue.some((item) => item.sectionId === 'section-hero'));
});

test('canonical verification refuses DONE without scoped SAVE_OK and PREVIEW_OK evidence', () => {
  const fixture = createFixture();
  const preview = JSON.parse(fs.readFileSync(fixture.files.previewReport, 'utf8'));
  preview.evidence.saveReport = path.join(fixture.directory, 'missing-save-report.json');
  fs.writeFileSync(fixture.files.previewReport, JSON.stringify(preview));

  const result = runFixture(fixture, false);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(report.ok, false);
  assert.equal(report.canonicalVerification, false);
  assert.equal(report.blockers.some((blocker) => blocker.code === 'save_evidence_missing'), true);
  assert.equal(fs.existsSync(fixture.spawnLog), false, 'no browser or benchmark action runs');
});

test('canonical verification treats screenshot budgets as hard even when structural report is green', () => {
  const fixture = createFixture();
  const result = runFixture(fixture, false, true);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'CANONICAL_COMPARE_FAILED');
  assert.equal(report.ok, false);
  assert.equal(report.blockers.some((blocker) => blocker.code === 'max_percent_exceeded'), true);
});

function createFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-canonical-verification-'));
  const files = {
    layout: path.join(directory, 'layout.json'),
    contract: path.join(directory, 'contract.json'),
    plan: path.join(directory, 'layout-plan.json'),
    reference: path.join(directory, 'reference-manifest.json'),
    target: path.join(directory, 'target-manifest.json'),
    iteration: path.join(directory, 'visual-iteration-report.json'),
    saveReport: path.join(directory, 'save-response.json'),
    previewReport: path.join(directory, 'preview-response.json'),
  };
  const nodeMap = { ROOT: { nodes: [] } };
  const layoutSha256 = createHash('sha256').update(JSON.stringify(nodeMap)).digest('hex');
  fs.writeFileSync(files.layout, JSON.stringify(nodeMap));
  fs.writeFileSync(files.contract, JSON.stringify({ components: [] }));
  fs.writeFileSync(files.plan, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    bands: [{ generatedSectionId: 'section-hero' }],
  }));
  fs.writeFileSync(files.reference, JSON.stringify({ sourceUrl: 'file:///owned-reference.html' }));
  fs.writeFileSync(files.target, JSON.stringify({ sourceUrl: 'file:///owned-reference.html' }));
  fs.writeFileSync(files.saveReport, JSON.stringify({
    schemaVersion: 1,
    ok: true,
    stage: 'save',
    code: 'SAVE_OK',
    scope: {
      site: 'https://site.example.test',
      pageId: 17,
    },
    layoutSha256,
    artifacts: {
      layout: files.layout,
      layoutSha256,
    },
  }));
  fs.writeFileSync(files.previewReport, JSON.stringify({
    schemaVersion: 1,
    ok: true,
    stage: 'preview',
    code: 'PREVIEW_OK',
    scope: {
      site: 'https://site.example.test',
      pageId: 17,
    },
    layoutSha256,
    artifacts: {
      layout: files.layout,
      layoutSha256,
      saveReport: files.saveReport,
    },
    evidence: {
      site: 'https://site.example.test',
      pageId: 17,
      layoutSha256,
      saveReport: files.saveReport,
    },
  }));
  fs.writeFileSync(files.iteration, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-visual-iteration',
    label: 'canonical-unit',
    status: 'diagnostic_passed',
    visualDiagnosticPassed: true,
    canonicalViewportCoverage: { complete: true },
    referenceManifest: files.reference,
    targetManifest: files.target,
    files: {
      outDir: directory,
      sourceContract: files.contract,
      contract: files.contract,
      layout: files.layout,
      layoutPlan: files.plan,
      startReport: path.join(directory, 'missing-start-report.json'),
      sourceCandidateLayout: '',
    },
    options: {
      seed: 'canonical-unit',
      variant: 'auto',
      archetype: '',
      referenceUrls: [],
      marketplaceReference: false,
      viewports: [
        'desktop:1440x1200',
        'tablet:834x1112',
        'mobile:390x844',
      ],
      fullPage: true,
      waitMs: '0',
      referenceWaitMs: '0',
      playwrightPackage: 'fake',
      maxPercent: '0',
      maxViewportPercent: '0',
      allowStructuralVerdict: false,
      preserveSourceText: true,
    },
  }));

  const harness = path.join(directory, 'spawn-harness.cjs');
  const spawnLog = path.join(directory, 'spawn-log.ndjson');
  fs.writeFileSync(harness, `'use strict';
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const original = childProcess.spawnSync;

function value(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? '' : String(args[index + 1] || '');
}

childProcess.spawnSync = function canonicalHarness(command, args, options) {
  const script = Array.isArray(args) && args.length > 0 ? path.basename(String(args[0])) : '';
  if (!['capture-template-reference.js', 'run-visual-benchmark.js'].includes(script)) {
    return original.call(this, command, args, options);
  }
  fs.appendFileSync(process.env.MONTEBY_CANONICAL_SPAWN_LOG, JSON.stringify({ script, args }) + '\\n');
  if (script === 'capture-template-reference.js') {
    const outDir = value(args, '--out-dir');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'reference-manifest.json'), JSON.stringify({
      sourceUrl: value(args, '--url'),
      screenshots: [],
      layouts: [],
    }));
    return { status: 0, stdout: 'reference_manifest=ok\\n', stderr: '' };
  }
  const failed = process.env.MONTEBY_CANONICAL_FAIL === '1';
  const budgetFailed = process.env.MONTEBY_CANONICAL_BUDGET_FAIL === '1';
  const report = failed ? {
    ok: false,
    blockers: [{
      source: 'generic-geometry',
      code: 'generic_geometry_band_height_mismatch',
      label: 'mobile',
      message: 'Band height differs.',
    }],
    genericGeometry: {
      stats: {
        viewports: [{
          label: 'mobile',
          bands: { missing: [], extra: [] },
          geometry: {
            pairs: [{
              referenceIndex: 0,
              candidateIndex: 0,
              topDelta: 0,
              heightDelta: 0.2,
              widthDelta: 0,
            }],
          },
        }],
      },
    },
  } : budgetFailed ? {
    ok: true,
    blockers: [],
    comparison: {
      ok: false,
      budgetErrors: [{
        code: 'max_percent_exceeded',
        message: 'Canonical pixel budget failed.',
      }],
    },
    genericGeometry: { ok: true, stats: { viewports: [] } },
  } : {
    ok: true,
    blockers: [],
    comparison: { ok: true, budgetErrors: [] },
    genericGeometry: { ok: true, stats: { viewports: [] } },
  };
  const out = value(args, '--out');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report));
  return { status: failed ? 1 : 0, stdout: JSON.stringify(report), stderr: '' };
};
`);

  return {
    directory,
    files,
    harness,
    spawnLog,
    outDir: path.join(directory, 'canonical'),
  };
}

function runFixture(fixture, fail, budgetFail = false) {
  return spawnSync(process.execPath, [
    script,
    '--iteration-report', fixture.files.iteration,
    '--preview-report', fixture.files.previewReport,
    '--public-page-url', 'https://site.example.test/page/',
    '--out-dir', fixture.outDir,
    '--playwright-package', 'fake',
    '--wait-ms', '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${fixture.harness}`].filter(Boolean).join(' '),
      MONTEBY_CANONICAL_SPAWN_LOG: fixture.spawnLog,
      MONTEBY_CANONICAL_FAIL: fail ? '1' : '0',
      MONTEBY_CANONICAL_BUDGET_FAIL: budgetFail ? '1' : '0',
    },
  });
}

function readSpawns(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function argumentValues(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name) values.push(args[index + 1]);
  }
  return values;
}
