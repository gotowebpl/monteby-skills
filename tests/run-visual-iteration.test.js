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
const iterationScript = path.join(root, 'monteby-site-authoring', 'scripts', 'run-visual-iteration.js');
const {
  buildRepairQueue,
  initialReport,
  nextActionFor,
  parseArgs,
  validateCandidatePlanBinding,
  validateLayoutPlan,
} = require(iterationScript);

function nodeMapSha256(nodeMap) {
  return createHash('sha256').update(JSON.stringify(nodeMap)).digest('hex');
}

test('remote references cannot opt into source-text copying', () => {
  assert.throws(
    () => parseArgs([
      '--contract', '/tmp/contract.json',
      '--reference-url', 'https://third-party.example.test/',
      '--preserve-source-text',
    ]),
    /only allowed for owned local HTML or generated targets/
  );
});

test('canonical viewport coverage stays incomplete when either visual budget is nonzero', () => {
  const report = initialReport(parseArgs([
    '--contract', '/tmp/contract.json',
    '--viewport', 'desktop:1440x1200',
    '--viewport', 'tablet:834x1112',
    '--viewport', 'mobile:390x844',
    '--max-percent', '0.01',
  ]));

  assert.equal(report.canonicalViewportCoverage.zeroDiffBudget, false);
  assert.equal(report.canonicalViewportCoverage.complete, false);
  assert.equal(report.nextAction.id, 'wait_for_step');
});

test('layout plan gate rejects truncation and missing section mappings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-plan-gate-'));
  const plan = path.join(directory, 'layout-plan.json');
  const sourceLayout = path.join(directory, 'layout-draft.json');
  const sourceNodeMap = {
    ROOT: { nodes: ['section-1'] },
    'section-1': {
      type: { resolvedName: 'Section' },
      parent: 'ROOT',
      nodes: [],
    },
  };
  fs.writeFileSync(sourceLayout, `${JSON.stringify(sourceNodeMap)}\n`);
  fs.writeFileSync(plan, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    sourceLayout,
    sourceLayoutSha256: nodeMapSha256(sourceNodeMap),
    sourceLayoutDigestFormat: 'sha256:json-stringify-node-map',
    mode: 'generic-measured-reference',
    rootSectionIds: ['section-1'],
    bands: [{
      generatedSectionId: '',
      surfaceMappings: [],
      surfaceParity: {
        captured: { text: 0, media: 0, group: 0, child: 0 },
        authored: { text: 0, media: 0, group: 0, child: 0 },
        omitted: { text: [], media: [], group: [], child: [] },
        complete: true,
      },
    }],
    completion: {
      plannedBands: 1,
      emittedSections: 1,
      allBandsMapped: false,
      allSurfacesMapped: true,
      capturedSurfaces: { text: 0, media: 0, group: 0, child: 0 },
      authoredSurfaces: { text: 0, media: 0, group: 0, child: 0 },
      truncated: true,
      omittedBands: [2],
      omittedMedia: [],
      omittedText: [],
      omittedGroups: [],
      omittedChildren: [],
    },
  }));

  assert.deepEqual(
    validateLayoutPlan(plan).map((blocker) => blocker.code),
    ['layout_plan_incomplete', 'layout_plan_band_mapping_incomplete']
  );
});

test('candidate binding hashes the actual candidate and rejects changed root order or missing mapped nodes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-plan-binding-'));
  const planFile = path.join(directory, 'layout-plan.json');
  const candidateFile = path.join(directory, 'layout.json');
  const candidate = {
    ROOT: { nodes: ['section-1', 'section-2'] },
    'section-1': {
      type: { resolvedName: 'Section' },
      parent: 'ROOT',
      nodes: ['text-1'],
    },
    'text-1': {
      type: { resolvedName: 'Text' },
      parent: 'section-1',
      nodes: [],
    },
    'section-2': {
      type: { resolvedName: 'Section' },
      parent: 'ROOT',
      nodes: [],
    },
  };
  const plan = {
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    sourceLayoutSha256: 'a'.repeat(64),
    rootSectionIds: ['section-1', 'section-2'],
    bands: [{
      generatedSectionId: 'section-1',
      surfaceMappings: [{
        kind: 'text',
        structureKey: 'band.1.text.1',
        generatedNodeId: 'text-1',
      }],
    }],
  };
  fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(candidateFile, `${JSON.stringify(candidate, null, 2)}\n`);

  const passing = validateCandidatePlanBinding(planFile, candidateFile);
  assert.deepEqual(passing.blockers, []);
  assert.equal(passing.evidence.candidateLayoutSha256, nodeMapSha256(candidate));
  assert.equal(passing.evidence.layoutPlanSha256, createHash('sha256')
    .update(fs.readFileSync(planFile))
    .digest('hex'));
  assert.equal(passing.evidence.rootOrderMatches, true);
  assert.equal(passing.evidence.surfaceMappingsResolve, true);

  candidate.ROOT.nodes.reverse();
  delete candidate['text-1'];
  fs.writeFileSync(candidateFile, `${JSON.stringify(candidate, null, 2)}\n`);
  assert.deepEqual(
    validateCandidatePlanBinding(planFile, candidateFile).blockers.map((blocker) => blocker.code),
    ['candidate_layout_root_order_mismatch', 'candidate_layout_surface_mapping_missing']
  );
});

test('repair queue maps measured geometry failures to stable section ids', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-repair-queue-'));
  const plan = path.join(directory, 'layout-plan.json');
  const layout = path.join(directory, 'layout.json');
  fs.writeFileSync(layout, JSON.stringify({
    ROOT: {
      nodes: ['section-hero', 'section-proof', 'extra-candidate'],
    },
  }));
  fs.writeFileSync(plan, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    bands: [
      { generatedSectionId: 'section-hero' },
      { generatedSectionId: 'section-proof' },
      { generatedSectionId: 'section-services' },
    ],
  }));

  const queue = buildRepairQueue({
    status: 'benchmark_failed',
    files: { layoutPlan: plan, layout },
    blockers: [],
    benchmark: {
      genericGeometry: {
        stats: {
          viewports: [{
            label: 'mobile',
            errors: [{ code: 'generic_geometry_band_top_mismatch' }, { code: 'generic_geometry_band_height_mismatch' }],
            bands: {
              missing: [{ index: 1, tags: ['section'], top: 0.3, height: 0.2, width: 1 }],
              extra: [{
                index: 2,
                tags: ['aside'],
                top: 0.6,
                height: 0.1,
                width: 0.8,
                montebyNodeIds: ['extra-candidate'],
              }],
            },
            geometry: {
              pairs: [
                { referenceIndex: 0, candidateIndex: 0, topDelta: 0.02, heightDelta: 0.12, widthDelta: 0 },
                { referenceIndex: 2, candidateIndex: 1, topDelta: 0.18, heightDelta: 0.04, widthDelta: 0.03 },
              ],
            },
          }],
        },
      },
    },
  });

  assert.deepEqual(
    queue.slice(0, 2).map((item) => [item.code, item.sectionId]),
    [
      ['restore_measured_band', 'section-proof'],
      ['remove_or_merge_extra_band', 'extra-candidate'],
    ]
  );
  assert.deepEqual(
    queue.filter((item) => item.code === 'match_band_geometry').map((item) => item.sectionId),
    ['section-services', 'section-hero']
  );

  const unresolvedExtra = buildRepairQueue({
    status: 'benchmark_failed',
    files: { layoutPlan: plan, layout },
    blockers: [],
    benchmark: {
      genericGeometry: {
        stats: {
          viewports: [{
            label: 'desktop',
            errors: [{ code: 'generic_geometry_band_top_mismatch' }],
            bands: {
              missing: [],
              extra: [{
                index: 0,
                tags: ['section'],
                top: 0,
                height: 0.1,
                width: 1,
              }],
            },
            geometry: { pairs: [] },
          }],
        },
      },
    },
  });
  assert.equal(unresolvedExtra[0].code, 'remove_or_merge_extra_band');
  assert.equal(
    unresolvedExtra[0].sectionId,
    '',
    'benchmark order must never be guessed as a Monteby ROOT node id'
  );
});

test('repair queue retains every geometry mismatch beyond the former per-viewport and total limits', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-full-repair-queue-'));
  const plan = path.join(directory, 'layout-plan.json');
  const layout = path.join(directory, 'layout.json');
  const bands = Array.from({ length: 31 }, (_, index) => ({
    order: index,
    generatedSectionId: `section-${index}`,
    viewports: {
      desktop: {
        height: 100 + index,
        contentInset: 20,
      },
    },
  }));
  fs.writeFileSync(layout, JSON.stringify({
    ROOT: {
      nodes: bands.map((band) => band.generatedSectionId),
    },
  }));
  fs.writeFileSync(plan, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    bands,
  }));

  const queue = buildRepairQueue({
    status: 'benchmark_failed',
    files: { layoutPlan: plan, layout },
    blockers: [],
    benchmark: {
      genericGeometry: {
        stats: {
          viewports: [{
            label: 'desktop',
            errors: [{ code: 'generic_geometry_band_top_mismatch' }],
            bands: { missing: [], extra: [] },
            geometry: {
              pairs: bands.map((band, index) => ({
                referenceIndex: index,
                candidateIndex: index,
                topDelta: (index + 1) / 100,
                heightDelta: 0,
                widthDelta: 0,
              })),
            },
          }],
        },
      },
    },
  });

  assert.equal(queue.length, 31);
  assert.equal(queue.every((item) => item.code === 'match_band_geometry'), true);
  assert.deepEqual(
    new Set(queue.map((item) => item.sectionId)),
    new Set(bands.map((band) => band.generatedSectionId))
  );
});

test('repair queue defers only visual budget summaries when actionable geometry exists', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-repair-summary-'));
  const plan = path.join(directory, 'layout-plan.json');
  const layout = path.join(directory, 'layout.json');
  fs.writeFileSync(layout, JSON.stringify({
    ROOT: { nodes: ['section-hero'] },
  }));
  fs.writeFileSync(plan, JSON.stringify({
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    bands: [{
      order: 0,
      generatedSectionId: 'section-hero',
      viewports: { desktop: { height: 500, contentInset: 24 } },
    }],
  }));

  const queue = buildRepairQueue({
    status: 'visual_budget_failed',
    files: { layoutPlan: plan, layout },
    blockers: [{
      source: 'visual-diff',
      code: 'max_percent_exceeded',
      message: 'Aggregate screenshot budget failed.',
    }, {
      source: 'visual-diff',
      code: 'unmapped_overlay_difference',
      message: 'A non-summary visual blocker remains.',
    }],
    benchmark: {
      genericGeometry: {
        stats: {
          viewports: [{
            label: 'desktop',
            errors: [{ code: 'generic_geometry_band_height_mismatch' }],
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
    },
  });

  assert.equal(queue.some((item) => item.code === 'match_band_geometry'), true);
  assert.equal(queue.some((item) => item.code === 'max_percent_exceeded'), false);
  assert.equal(queue.some((item) => item.code === 'unmapped_overlay_difference'), true);
});

test('AUTHOR next action invokes the deterministic repair applier with no manual gate', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-repair-action-'));
  const iterationReport = path.join(directory, 'visual-iteration-report.json');
  const layout = path.join(directory, 'candidate', 'layout.json');
  const action = nextActionFor({
    status: 'benchmark_failed',
    label: 'unit',
    options: {},
    files: {
      outDir: directory,
      iterationReport,
      layout,
      sourceCandidateLayout: '',
      sourceContract: path.join(directory, 'contract.json'),
    },
  });

  assert.equal(action.id, 'apply_layout_repair_queue');
  assert.equal(path.basename(action.tool), 'apply-layout-repair-queue.js');
  assert.deepEqual(Object.keys(action).sort(), ['args', 'id', 'instruction', 'requires', 'tool']);
  assert.deepEqual(action.args, [
    '--iteration-report', iterationReport,
    '--out', path.join(directory, 'candidate', 'layout-repaired.json'),
    '--json',
  ]);
  assert.deepEqual(action.requires, []);
  assert.equal(JSON.stringify(action).includes('REPAIR_QUEUE_APPLIED'), false);
});

test('canonical next action is an exact credential-free snapshot command', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-next-action-'));
  const action = nextActionFor({
    status: 'diagnostic_passed',
    label: 'unit',
    canonicalViewportCoverage: { complete: true },
    options: {},
    files: {
      outDir: directory,
      sourceContract: path.join(directory, 'contract.json'),
      sourceCandidateLayout: '',
    },
  });

  assert.equal(action.id, 'snapshot_canonical_page');
  assert.equal(path.basename(action.tool), 'wordpress-layout-client.js');
  assert.deepEqual(Object.keys(action).sort(), ['args', 'id', 'instruction', 'requires', 'tool']);
  assert.deepEqual(action.requires, ['MONTEBY_SITE_URL', 'MONTEBY_PAGE_ID', 'MONTEBY_AUTH_HEADER']);
  assert.equal(JSON.stringify(action).includes('Authorization'), false);
});

test('next actions distinguish product gaps from malformed or incomplete evidence', () => {
  const base = {
    files: {
      outDir: '/tmp/monteby-next-action',
      sourceCandidateLayout: '',
    },
    options: {
      viewports: ['desktop:1440x1200'],
      fullPage: true,
    },
  };
  const productGap = nextActionFor({
    ...base,
    status: 'readiness_failed',
    blockers: [{
      source: 'readiness',
      code: 'missing_authoring_prop',
      message: 'Section lacks a required responsive control.',
    }],
  });
  assert.equal(productGap.id, 'resolve_product_gap');
  assert.equal(productGap.tool, 'monteby-widget-development');

  for (const current of [
    {
      status: 'draft_failed',
      blockers: [{ code: 'layout_plan_incomplete', message: 'Evidence is incomplete.' }],
    },
    {
      status: 'readiness_failed',
      blockers: [{ code: 'readiness_failed', message: 'The readiness report is missing.' }],
    },
  ]) {
    const blocked = nextActionFor({ ...base, ...current });
    assert.equal(blocked.id, 'blocked_iteration_inputs');
    assert.equal(blocked.tool, '');
    assert.deepEqual(blocked.args, []);
    assert.deepEqual(blocked.requires, ['VALID_ITERATION_INPUTS']);
  }
});

test('retry transitions require explicit failure resolution and unknown stages stop', () => {
  const base = {
    files: {
      outDir: '/tmp/monteby-next-action',
      sourceCandidateLayout: '',
      sourceContract: '/tmp/contract.json',
    },
    options: {
      seed: 'unit',
      variant: 'auto',
      viewports: ['desktop:1440x1200'],
      fullPage: true,
      waitMs: '0',
      referenceWaitMs: '0',
      playwrightPackage: 'playwright',
      maxPercent: '0',
      maxViewportPercent: '0',
    },
    blockers: [{ code: 'capture_failed', message: 'Capture failed.' }],
  };
  const retry = nextActionFor({ ...base, status: 'candidate_capture_failed' });
  assert.equal(retry.id, 'retry_render_or_capture');
  assert.deepEqual(retry.requires, ['RENDER_OR_CAPTURE_FAILURE_RESOLVED']);

  const blocked = nextActionFor({ ...base, status: 'failed' });
  assert.equal(blocked.id, 'blocked_iteration_stage');
  assert.equal(blocked.tool, '');
  assert.deepEqual(blocked.args, []);
  assert.deepEqual(blocked.requires, ['ITERATION_BLOCKERS_RESOLVED']);
});

test('run visual iteration documents the viewport timeout option', () => {
  const result = spawnSync(process.execPath, [iterationScript, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /--full-page/);
  assert.match(result.stdout, /--viewport-only/);
  assert.match(result.stdout, /--viewport-timeout-ms/);
  assert.match(result.stdout, /--channel chrome/);
  assert.match(result.stdout, /--max-percent/);
  assert.match(result.stdout, /--max-viewport-percent/);
  assert.match(result.stdout, /--candidate-layout/);
  assert.match(result.stdout, /layout-plan/);
  assert.match(result.stdout, /nextAction/);
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
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const originalSpawnSync = childProcess.spawnSync;
const handledScripts = new Set([
  'start-visual-benchmark.js',
  'audit-authoring-readiness.js',
  'draft-monteby-layout.js',
  'audit-monteby-layout.js',
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
    const sourceLayout = {
      ROOT: {
        type: { resolvedName: 'RootCanvas' },
        isCanvas: true,
        props: {},
        nodes: [],
      },
    };
    writeJson(optionValue(args, '--out'), sourceLayout);
    writeJson(optionValue(args, '--plan-out'), {
      schemaVersion: 1,
      artifact: 'monteby-layout-plan',
      sourceLayout: optionValue(args, '--out'),
      sourceLayoutSha256: createHash('sha256').update(JSON.stringify(sourceLayout)).digest('hex'),
      sourceLayoutDigestFormat: 'sha256:json-stringify-node-map',
      mode: 'generic-measured-reference',
      rootSectionIds: [],
      bands: [],
      completion: {
        capturedBands: 0,
        draftedRootSections: 0,
        allBandsMapped: true,
        allSurfacesMapped: true,
        plannedBands: 0,
        emittedSections: 0,
        capturedSurfaces: { text: 0, media: 0, group: 0, child: 0 },
        authoredSurfaces: { text: 0, media: 0, group: 0, child: 0 },
        truncated: false,
        omittedBands: [],
        omittedMedia: [],
        omittedText: [],
        omittedGroups: [],
        omittedChildren: [],
      },
    });
    return success({ ok: true, stats: {}, audit: { ok: true }, qualityErrors: [] });
  }

  if (script === 'audit-monteby-layout.js') {
    return success({ ok: true, errors: [], warnings: [] });
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
  assert.equal(fullPageReport.schemaVersion, 1);
  assert.equal(fullPageReport.artifact, 'monteby-visual-iteration');
  assert.equal(fullPageReport.canonicalViewportCoverage.complete, false);
  assert.deepEqual(fullPageReport.canonicalViewportCoverage.missingLabels.sort(), ['desktop', 'tablet']);
  assert.match(fullPageReport.artifactBindings.layoutPlanSha256, /^[a-f0-9]{64}$/);
  assert.match(fullPageReport.artifactBindings.candidateLayoutSha256, /^[a-f0-9]{64}$/);
  assert.equal(fullPageReport.artifactBindings.rootOrderMatches, true);
  assert.equal(fullPageReport.artifactBindings.surfaceMappingsResolve, true);
  assert.equal(fullPageReport.nextAction.id, 'capture_canonical_viewports');
  assert.equal(fullPageReport.nextAction.args.filter((arg) => arg === '--viewport').length, 3);
  assert.equal(fs.existsSync(fullPageReport.files.layoutPlan), true);
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
  assert.equal(
    argumentValue(fullPageDraft.args, '--plan-out'),
    path.join(directory, 'candidate', 'layout-plan.json')
  );
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
