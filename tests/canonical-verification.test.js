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
  assert.equal(report.nextAction.id, 'apply_layout_repair_queue');
  assert.equal(path.basename(report.nextAction.tool), 'apply-layout-repair-queue.js');
  assert.equal(report.nextAction.args.includes('--iteration-report'), true);
  assert.equal(
    report.nextAction.args[report.nextAction.args.indexOf('--iteration-report') + 1],
    path.join(fixture.outDir, 'canonical-verification-report.json')
  );
  assert.equal(report.nextAction.args.includes('--out'), true);
  assert.deepEqual(report.nextAction.requires, []);
  assert.equal(
    report.repairQueue.some((item) => item.sectionId === 'section-hero'),
    false,
    'a screenshot-only failure must not invent a geometry mutation target'
  );
  assert.ok(report.repairQueue.length > 0);
  assert.equal(report.repairQueue.every((item) => item.sectionId === ''), true);
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
  assert.equal(report.nextAction.id, 'blocked_canonical_evidence');
  assert.equal(report.nextAction.tool, '');
  assert.deepEqual(report.nextAction.args, []);
  assert.equal(fs.existsSync(fixture.spawnLog), false, 'no browser or benchmark action runs');
});

test('canonical verification requires and then honors exact subpixel authorization', () => {
  const fixture = createFixture();
  const iteration = JSON.parse(fs.readFileSync(fixture.files.iteration, 'utf8'));
  iteration.benchmark = subpixelGeometryReport();
  fs.writeFileSync(fixture.files.iteration, JSON.stringify(iteration));

  const first = runFixture(fixture, false, false, 'https://site.example.test/page/', false, true);
  const firstReport = JSON.parse(first.stdout);
  assert.equal(first.status, 1);
  assert.equal(firstReport.status, 'CANONICAL_RESIDUAL_AUTHORIZATION_REQUIRED');
  assert.equal(firstReport.blockers[0].code, 'blocked_subpixel_authorization_required');
  const residual = JSON.parse(fs.readFileSync(firstReport.files.subpixelResidual, 'utf8'));

  const authorizationFile = path.join(fixture.directory, 'subpixel-authorization.json');
  fs.writeFileSync(authorizationFile, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-subpixel-authorization',
    authorizedBy: 'Release Owner',
    authorizedAt: '2026-08-20T12:00:00.000Z',
    residualSha256: residual.residualSha256,
    bindings: residual.bindings,
  }));
  const second = runFixture(
    fixture,
    false,
    false,
    'https://site.example.test/page/',
    false,
    true,
    authorizationFile
  );
  const secondReport = JSON.parse(second.stdout);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(secondReport.status, 'DONE');
  assert.equal(secondReport.verdict, 'canonical_verified_with_authorized_residual');
  assert.match(secondReport.nextAction.instruction, /not 1:1/);
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

test('canonical verification refuses DONE without complete zero-diff viewport evidence', () => {
  const fixture = createFixture();
  const result = runFixture(
    fixture,
    false,
    false,
    'https://site.example.test/page/',
    true
  );

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'CANONICAL_COMPARE_FAILED');
  assert.equal(report.ok, false);
  assert.equal(
    report.blockers.some((blocker) => blocker.code === 'canonical_zero_diff_evidence_missing'),
    true
  );
});

test('canonical verification rejects a forged complete report with nonzero visual budgets', () => {
  const fixture = createFixture();
  const iteration = JSON.parse(fs.readFileSync(fixture.files.iteration, 'utf8'));
  iteration.options.maxPercent = '0.01';
  fs.writeFileSync(fixture.files.iteration, JSON.stringify(iteration));

  const result = runFixture(fixture, false);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(
    report.blockers.some((blocker) => blocker.code === 'canonical_visual_budget_not_zero'),
    true
  );
  assert.equal(fs.existsSync(fixture.spawnLog), false, 'no browser or benchmark action runs');
});

test('canonical verification revalidates the mechanical plan before DONE', () => {
  const fixture = createFixture();
  const plan = JSON.parse(fs.readFileSync(fixture.files.plan, 'utf8'));
  delete plan.completion;
  fs.writeFileSync(fixture.files.plan, JSON.stringify(plan));

  const result = runFixture(fixture, false);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(
    report.blockers.some((blocker) => blocker.code === 'layout_plan_completion_missing'),
    true
  );
  assert.equal(fs.existsSync(fixture.spawnLog), false, 'no browser or benchmark action runs');
});

test('canonical verification blocks an incomplete source-text ledger', () => {
  const fixture = createFixture();
  const plan = JSON.parse(fs.readFileSync(fixture.files.plan, 'utf8'));
  plan.contentLedger.complete = false;
  plan.contentLedger.missing = [{ text: 'Missing paragraph' }];
  fs.writeFileSync(fixture.files.plan, JSON.stringify(plan));

  const result = runFixture(fixture, false);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(report.blockers.some((blocker) => blocker.code === 'content_ledger_incomplete'), true);
  assert.equal(fs.existsSync(fixture.spawnLog), false);
});

test('canonical verification rejects missing constraint evidence before browser work', () => {
  const fixture = createFixture();
  const plan = JSON.parse(fs.readFileSync(fixture.files.plan, 'utf8'));
  delete plan.constraintDecisions;
  fs.writeFileSync(fixture.files.plan, JSON.stringify(plan));

  const result = runFixture(fixture, false);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(report.blockers.some((blocker) => blocker.code === 'layout_plan_constraint_evidence_incomplete'), true);
  assert.equal(fs.existsSync(fixture.spawnLog), false);
});

test('canonical verification rejects an input artifact changed after diagnostic_passed', () => {
  const fixture = createFixture();
  fs.appendFileSync(fixture.files.contract, '\n');

  const result = runFixture(fixture, false);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(
    report.blockers.some((blocker) => (
      blocker.code === 'iteration_artifact_binding_mismatch'
      && blocker.message.includes('sourceContract')
      && blocker.message.includes('contract')
    )),
    true
  );
  assert.equal(fs.existsSync(fixture.spawnLog), false, 'no browser or benchmark action runs');
});

test('canonical verification rejects a same-origin URL for a different page', () => {
  const fixture = createFixture();
  const result = runFixture(
    fixture,
    false,
    false,
    'https://site.example.test/different-page/'
  );

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(
    report.blockers.some((blocker) => blocker.code === 'public_page_scope_mismatch'),
    true
  );
  assert.equal(fs.existsSync(fixture.spawnLog), false, 'no browser or benchmark action runs');
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
  const nodeMap = {
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-hero'],
    },
    'section-hero': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: [],
    },
  };
  const layoutSha256 = createHash('sha256').update(JSON.stringify(nodeMap)).digest('hex');
  fs.writeFileSync(files.layout, JSON.stringify(nodeMap));
  fs.writeFileSync(files.contract, JSON.stringify({ components: [] }));
  fs.writeFileSync(files.plan, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    sourceLayout: files.layout,
    sourceLayoutSha256: layoutSha256,
    sourceLayoutDigestFormat: 'sha256:json-stringify-node-map',
    mode: 'generic-measured-reference',
    constraintDecisions: [],
    rootSectionIds: ['section-hero'],
    bands: [{
      order: 0,
      generatedSectionId: 'section-hero',
      viewports: {
        mobile: {
          top: 0,
          height: 844,
          width: 390,
          contentInset: 20,
        },
      },
      surfaceMappings: [],
      surfaceParity: {
        captured: { text: 0, media: 0, group: 0, child: 0 },
        authored: { text: 0, media: 0, group: 0, child: 0 },
        omitted: { text: [], media: [], group: [], child: [] },
        complete: true,
      },
    }],
    completion: {
      capturedBands: 1,
      draftedRootSections: 1,
      allBandsMapped: true,
      allSurfacesMapped: true,
      plannedBands: 1,
      emittedSections: 1,
      capturedSurfaces: { text: 0, media: 0, group: 0, child: 0 },
      authoredSurfaces: { text: 0, media: 0, group: 0, child: 0 },
      truncated: false,
      omittedBands: [],
      omittedMedia: [],
      omittedText: [],
      omittedGroups: [],
      omittedChildren: [],
    },
    contentLedger: {
      schemaVersion: 1,
      artifact: 'monteby-content-ledger-comparison',
      complete: true,
      matched: [],
      missing: [],
      truncatedOrChanged: [],
      duplicateCountMismatch: [],
    },
  }));
  fs.writeFileSync(files.reference, JSON.stringify({ sourceUrl: 'file:///owned-reference.html' }));
  fs.writeFileSync(files.target, JSON.stringify({ sourceUrl: 'file:///owned-reference.html' }));
  const fileSha256 = (file) => createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
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
    evidence: {
      site: 'https://site.example.test',
      pageId: 17,
      publicPageUrl: 'https://site.example.test/page/',
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
      publicPageUrl: 'https://site.example.test/page/',
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
    artifactBindings: {
      layoutPlanSha256: fileSha256(files.plan),
      layoutPlanDigestFormat: 'sha256:file-bytes',
      candidateLayoutSha256: layoutSha256,
      candidateLayoutDigestFormat: 'sha256:json-stringify-node-map',
      plannedSourceLayoutSha256: layoutSha256,
      inputFileDigestFormat: 'sha256:file-bytes',
      sourceContractSha256: fileSha256(files.contract),
      contractSha256: fileSha256(files.contract),
      referenceManifestSha256: fileSha256(files.reference),
      targetManifestSha256: fileSha256(files.target),
      rootOrderMatches: true,
      surfaceMappingsResolve: true,
    },
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
    const subpixel = process.env.MONTEBY_CANONICAL_SUBPIXEL === '1';
    if (subpixel) fs.writeFileSync(path.join(outDir, 'desktop.png'), 'stable-page-pixels');
    fs.writeFileSync(path.join(outDir, 'reference-manifest.json'), JSON.stringify({
      sourceUrl: value(args, '--url'),
      screenshots: subpixel ? [{ label: 'desktop', file: 'desktop.png' }] : [],
      layouts: [],
    }));
    return { status: 0, stdout: 'reference_manifest=ok\\n', stderr: '' };
  }
  const failed = process.env.MONTEBY_CANONICAL_FAIL === '1';
  const budgetFailed = process.env.MONTEBY_CANONICAL_BUDGET_FAIL === '1';
  const incompleteZero = process.env.MONTEBY_CANONICAL_INCOMPLETE_ZERO === '1';
  const subpixel = process.env.MONTEBY_CANONICAL_SUBPIXEL === '1';
  const report = subpixel ? ${JSON.stringify({
    ok: true,
    blockers: [],
    comparison: {
      ok: true,
      budgetErrors: [],
      mismatched: 3,
      total: 30000,
      percent: 0.01,
      maxPercent: 0.01,
      results: ['desktop', 'tablet', 'mobile'].map((label) => ({
        label,
        mismatched: 1,
        total: 10000,
        percent: 0.01,
      })),
    },
    genericGeometry: {
      ok: true,
      stats: {
        viewports: ['desktop', 'tablet', 'mobile'].map((label) => ({
          label,
          geometry: { pairs: [{ referenceIndex: 0, candidateIndex: 0, signedHeightDelta: 0.2 }] },
        })),
      },
    },
  })} : failed ? {
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
  } : incompleteZero ? {
    ok: true,
    blockers: [],
    comparison: { ok: true, budgetErrors: [], percent: 0, maxPercent: 0 },
    genericGeometry: { ok: true, stats: { viewports: [] } },
  } : {
    ok: true,
    blockers: [],
    comparison: {
      ok: true,
      budgetErrors: [],
      count: 3,
      mismatched: 0,
      total: 3,
      percent: 0,
      maxPercent: 0,
      results: [
        { label: 'desktop', mismatched: 0, total: 1, percent: 0 },
        { label: 'tablet', mismatched: 0, total: 1, percent: 0 },
        { label: 'mobile', mismatched: 0, total: 1, percent: 0 },
      ],
    },
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

function runFixture(
  fixture,
  fail,
  budgetFail = false,
  publicPageUrl = 'https://site.example.test/page/',
  incompleteZero = false,
  subpixel = false,
  authorizationFile = ''
) {
  return spawnSync(process.execPath, [
    script,
    '--iteration-report', fixture.files.iteration,
    '--preview-report', fixture.files.previewReport,
    '--public-page-url', publicPageUrl,
    '--out-dir', fixture.outDir,
    '--playwright-package', 'fake',
    '--wait-ms', '0',
    ...(authorizationFile ? ['--subpixel-authorization', authorizationFile] : []),
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
      MONTEBY_CANONICAL_INCOMPLETE_ZERO: incompleteZero ? '1' : '0',
      MONTEBY_CANONICAL_SUBPIXEL: subpixel ? '1' : '0',
    },
  });
}

function subpixelGeometryReport() {
  return {
    genericGeometry: {
      stats: {
        viewports: ['desktop', 'tablet', 'mobile'].map((label) => ({
          label,
          geometry: {
            pairs: [{ referenceIndex: 0, candidateIndex: 0, signedHeightDelta: 0.2 }],
          },
        })),
      },
    },
  };
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
