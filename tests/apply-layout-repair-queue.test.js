#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(
  root,
  'monteby-site-authoring',
  'scripts',
  'apply-layout-repair-queue.js'
);

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-repair-applier-'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sectionContract() {
  return {
    components: [{
      name: 'Section',
      allowedParents: ['ROOT'],
      aiProps: [
        'minHeight',
        'minHeightTablet',
        'minHeightMobile',
        'innerPaddingX',
        'innerPaddingXTablet',
        'innerPaddingXMobile',
      ],
    }, {
      name: 'Container',
      allowedParents: ['Section'],
      aiProps: [],
    }, {
      name: 'Heading',
      allowedParents: ['Container'],
      aiProps: ['text'],
    }, {
      name: 'Text',
      allowedParents: ['Section'],
      aiProps: ['text'],
    }],
  };
}

function node(type, parent, nodes = [], props = {}) {
  return {
    type: { resolvedName: type },
    parent,
    nodes,
    props,
  };
}

function viewport(height, contentInset) {
  return {
    height,
    contentInset,
    width: 1440,
    top: 0,
  };
}

function createFixture({
  sourceLayout,
  candidateLayout,
  bands,
  repairQueue,
  contract = sectionContract(),
}) {
  const directory = tempDirectory();
  const sourceLayoutPath = path.join(directory, 'layout-draft.json');
  const candidatePath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');
  const contractPath = path.join(directory, 'contract.json');
  const iterationReportPath = path.join(directory, 'visual-iteration-report.json');
  const out = path.join(directory, 'layout-repaired.json');

  writeJson(sourceLayoutPath, sourceLayout);
  writeJson(candidatePath, candidateLayout);
  writeJson(contractPath, contract);
  writeJson(planPath, {
    schemaVersion: 1,
    artifact: 'monteby-layout-plan',
    mode: 'generic-measured-reference',
    sourceLayout: sourceLayoutPath,
    rootSectionIds: bands.map((band) => band.generatedSectionId),
    bands,
    completion: {
      capturedBands: bands.length,
      draftedRootSections: bands.length,
      allBandsMapped: true,
      plannedBands: bands.length,
      emittedSections: bands.length,
      truncated: false,
      omittedBands: [],
      omittedMedia: [],
      omittedText: [],
    },
  });
  writeJson(iterationReportPath, {
    schemaVersion: 1,
    artifact: 'monteby-visual-iteration',
    label: 'repair-applier-test',
    status: 'benchmark_failed',
    files: {
      outDir: directory,
      sourceContract: contractPath,
      contract: contractPath,
      layoutPlan: planPath,
      layout: candidatePath,
      sourceCandidateLayout: '',
      iterationReport: iterationReportPath,
    },
    options: {
      seed: 'repair-applier-seed',
      variant: 'auto',
      archetype: '',
      referenceUrls: [],
      marketplaceReference: false,
      viewports: [
        'desktop:1440x1200',
        'tablet:834x1112',
        'mobile:390x844',
      ],
      viewportTimeoutMs: 0,
      fullPage: true,
      waitMs: '0',
      referenceWaitMs: '0',
      channel: '',
      playwrightPackage: 'fake-playwright',
      maxPercent: '0',
      maxViewportPercent: '0',
      allowStructuralVerdict: false,
      preserveSourceText: true,
      referenceHtmlFile: path.join(directory, 'owned-reference.html'),
      candidateLayout: '',
    },
    repairQueue,
  });

  return {
    directory,
    sourceLayoutPath,
    candidatePath,
    planPath,
    contractPath,
    iterationReportPath,
    out,
  };
}

function runFixture(fixture) {
  return spawnSync(process.execPath, [
    script,
    '--iteration-report', fixture.iterationReportPath,
    '--out', fixture.out,
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
}

function tempArtifacts(directory) {
  return fs.readdirSync(directory).filter((name) => name.endsWith('.tmp'));
}

test('invalid applier inputs stop with a terminal JSON action', () => {
  const result = spawnSync(process.execPath, [script, '--json'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'INPUT_BLOCKED');
  assert.equal(report.nextAction.id, 'blocked_repair_inputs');
  assert.equal(report.nextAction.tool, '');
  assert.deepEqual(report.nextAction.args, []);
  assert.deepEqual(report.nextAction.requires, ['VALID_REPAIR_INPUTS']);
});

test('recursively restores a complete planned subtree and applies responsive Section geometry', () => {
  const sourceLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a', 'section-b'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', [], { minHeight: '100px' }),
    'section-b': {
      ...node('Section', 'ROOT', ['container-b'], {
        minHeight: '200px',
        backgroundColor: '#112233',
      }),
      linkedNodes: { badge: 'badge-b' },
    },
    'container-b': node('Container', 'section-b', ['heading-b']),
    'heading-b': node('Heading', 'container-b', [], { text: 'Restored heading' }),
    'badge-b': node('Text', 'section-b', [], { text: 'Restored badge' }),
  };
  const candidateLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', [], { minHeight: '100px' }),
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: {
      desktop: viewport(100, 20),
      tablet: viewport(90, 18),
      mobile: viewport(80, 16),
    },
  }, {
    order: 1,
    generatedSectionId: 'section-b',
    viewports: {
      desktop: viewport(420.25, 32.5),
      tablet: viewport(360, 24),
      mobile: viewport(300, 16),
    },
  }];
  const fixture = createFixture({
    sourceLayout,
    candidateLayout,
    bands,
    repairQueue: [{
      code: 'restore_measured_band',
      viewport: 'desktop',
      referenceIndex: 1,
      sectionId: 'section-b',
      evidence: { sourceSectionId: 'section-b' },
    }, {
      code: 'match_band_geometry',
      viewport: 'desktop',
      referenceIndex: 1,
      sectionId: 'section-b',
    }, {
      code: 'match_band_geometry',
      viewport: 'mobile',
      referenceIndex: 1,
      sectionId: 'section-b',
    }],
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const repaired = JSON.parse(fs.readFileSync(fixture.out, 'utf8'));

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.artifact, 'monteby-layout-repair-application');
  assert.equal(report.status, 'REPAIRED_CANDIDATE_WRITTEN');
  assert.equal(report.ok, true);
  assert.deepEqual(Object.keys(report.nextAction).sort(), [
    'args',
    'id',
    'instruction',
    'requires',
    'tool',
  ]);
  assert.equal(report.nextAction.id, 'rerun_visual_iteration_with_repaired_candidate');
  assert.equal(path.basename(report.nextAction.tool), 'run-visual-iteration.js');
  assert.equal(report.nextAction.args.includes('--candidate-layout'), true);
  assert.equal(
    report.nextAction.args[report.nextAction.args.indexOf('--candidate-layout') + 1],
    fixture.out
  );
  assert.match(report.inputLayoutSha256, /^[a-f0-9]{64}$/);
  assert.match(report.outputLayoutSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(report.inputLayoutSha256, report.outputLayoutSha256);
  assert.equal(report.preservedRootSections.length, 1);
  assert.equal(report.preservedRootSections[0].sectionId, 'section-a');
  assert.equal(
    report.preservedRootSections[0].beforeSha256,
    report.preservedRootSections[0].afterSha256
  );
  assert.match(report.preservedRootSections[0].beforeSha256, /^[a-f0-9]{64}$/);

  assert.deepEqual(repaired.ROOT.nodes, ['section-a', 'section-b']);
  assert.equal(repaired['section-b'].props.backgroundColor, '#112233');
  assert.equal(repaired['section-b'].props.minHeight, '420.25px');
  assert.equal(repaired['section-b'].props.innerPaddingX, '32.5px');
  assert.equal(repaired['section-b'].props.minHeightMobile, '300px');
  assert.equal(repaired['section-b'].props.innerPaddingXMobile, '16px');
  assert.equal(repaired['container-b'].parent, 'section-b');
  assert.equal(repaired['heading-b'].props.text, 'Restored heading');
  assert.equal(repaired['badge-b'].props.text, 'Restored badge');
  assert.equal(
    report.applied.find((item) => item.code === 'restore_measured_band').copiedNodeCount,
    4
  );
  assert.deepEqual(tempArtifacts(fixture.directory), []);
});

test('returns terminal REPAIR_IDEMPOTENT without writing or scheduling a rerun', () => {
  const layout = {
    ROOT: { type: { resolvedName: 'ROOT' }, nodes: ['section-a'], props: {} },
    'section-a': node('Section', 'ROOT', [], { minHeight: '420px', innerPaddingX: '32px' }),
  };
  const fixture = createFixture({
    sourceLayout: layout,
    candidateLayout: layout,
    bands: [{
      order: 0,
      generatedSectionId: 'section-a',
      viewports: {
        desktop: {
          ...viewport(420, 32),
        },
      },
    }],
    repairQueue: [{
      code: 'match_band_geometry',
      viewport: 'desktop',
      referenceIndex: 0,
      sectionId: 'section-a',
    }],
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'REPAIR_IDEMPOTENT');
  assert.equal(report.nextAction.id, 'blocked_repair_idempotent');
  assert.equal(report.nextAction.tool, '');
  assert.equal(fs.existsSync(fixture.out), false);
});

test('relinks one explicitly approved exact global-style literal and rejects stale local overrides', () => {
  const layout = {
    ROOT: { type: { resolvedName: 'ROOT' }, nodes: ['section-a'], props: {} },
    'section-a': node('Section', 'ROOT', [], { backgroundColor: '#112233' }),
  };
  const contract = {
    ...sectionContract(),
    components: sectionContract().components.map((component) => (
      component.name === 'Section'
        ? { ...component, aiProps: [...component.aiProps, 'backgroundColor'] }
        : component
    )),
    globalStyles: {
      colors: { accent: '#112233' },
      typography: { fonts: {}, presets: {} },
      customCSS: '.not-an-authoring-token{color:red}',
    },
    designTokens: {
      version: 1,
      tokens: {
        'colors.accent': {
          value: '#ff0000',
          cssVariable: '--monteby-token-colors-accent',
          reference: 'var(--monteby-token-colors-accent)',
        },
      },
      bindings: {
        Section: { backgroundColor: 'colors.accent' },
      },
    },
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: { desktop: viewport(420, 32) },
  }];
  const fixture = createFixture({
    sourceLayout: layout,
    candidateLayout: layout,
    bands,
    contract,
    repairQueue: [{
      code: 'relink_global_style_literal',
      nodeId: 'section-a',
      prop: 'backgroundColor',
      token: 'colors.accent',
      evidence: { literal: '#112233' },
    }],
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const repaired = JSON.parse(fs.readFileSync(fixture.out, 'utf8'));
  assert.equal(repaired['section-a'].props.backgroundColor, 'var(--gcb-color-accent)');
  assert.deepEqual(report.applied.find((item) => item.code === 'relink_global_style_literal'), {
    code: 'relink_global_style_literal',
    nodeId: 'section-a',
    component: 'Section',
    prop: 'backgroundColor',
    token: 'colors.accent',
    before: '#112233',
    after: 'var(--gcb-color-accent)',
  });

  const changed = JSON.parse(JSON.stringify(layout));
  changed['section-a'].props.backgroundColor = '#abcdef';
  const staleFixture = createFixture({
    sourceLayout: layout,
    candidateLayout: changed,
    bands,
    contract,
    repairQueue: [{
      code: 'relink_global_style_literal',
      nodeId: 'section-a',
      prop: 'backgroundColor',
      token: 'colors.accent',
      evidence: { literal: '#112233' },
    }],
  });
  const staleResult = runFixture(staleFixture);
  assert.equal(staleResult.status, 1, staleResult.stderr || staleResult.stdout);
  const staleReport = JSON.parse(staleResult.stdout);
  assert.equal(staleReport.status, 'REPAIR_BLOCKED');
  assert.equal(staleReport.blockers.some((blocker) => blocker.code === 'GLOBAL_STYLE_RELINK_EVIDENCE_STALE'), true);
  assert.equal(fs.existsSync(staleFixture.out), false);
});

test('blocks recursive restore when a source subtree ID is reachable from an unrelated root', () => {
  const sourceLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a', 'section-b'],
      props: {},
    },
    'section-a': node('Section', 'ROOT'),
    'section-b': node('Section', 'ROOT', ['shared-node']),
    'shared-node': node('Text', 'section-b', [], { text: 'Plan-owned child' }),
  };
  const candidateLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', ['shared-node']),
    'shared-node': node('Text', 'section-a', [], { text: 'Unrelated live child' }),
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: {
      desktop: viewport(100, 20),
      tablet: viewport(90, 18),
      mobile: viewport(80, 16),
    },
  }, {
    order: 1,
    generatedSectionId: 'section-b',
    viewports: {
      desktop: viewport(200, 20),
      tablet: viewport(180, 18),
      mobile: viewport(160, 16),
    },
  }];
  const fixture = createFixture({
    sourceLayout,
    candidateLayout,
    bands,
    repairQueue: [{
      code: 'restore_measured_band',
      viewport: 'desktop',
      referenceIndex: 1,
      sectionId: 'section-b',
    }],
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.status, 'REPAIR_BLOCKED');
  assert.equal(report.blockers[0].code, 'RESTORE_NODE_ID_COLLISION');
  assert.equal(report.nextAction.id, 'blocked_repair_application');
  assert.equal(report.nextAction.tool, '');
  assert.deepEqual(report.nextAction.args, []);
  assert.deepEqual(report.blockers[0].collidingNodeIds, ['shared-node']);
  assert.equal(fs.existsSync(fixture.out), false);
});

test('refuses an ambiguous extra band without changing an existing output artifact', () => {
  const sourceLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', [], { minHeight: '100px' }),
  };
  const candidateLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a', 'section-extra'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', [], { minHeight: '100px' }),
    'section-extra': node('Section', 'ROOT', ['extra-copy'], { minHeight: '240px' }),
    'extra-copy': node('Text', 'section-extra', [], { text: 'Owned content with no duplicate' }),
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: {
      desktop: viewport(100, 20),
      tablet: viewport(90, 18),
      mobile: viewport(80, 16),
    },
  }];
  const fixture = createFixture({
    sourceLayout,
    candidateLayout,
    bands,
    repairQueue: [{
      code: 'remove_or_merge_extra_band',
      viewport: 'desktop',
      candidateIndex: 1,
      sectionId: 'section-extra',
      evidence: {
        candidateRootId: 'section-extra',
        measuredNodeIds: ['section-extra'],
      },
    }],
  });
  const sentinel = '{"sentinel":true}\n';
  fs.writeFileSync(fixture.out, sentinel);

  const result = runFixture(fixture);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.ok, false);
  assert.equal(report.status, 'CONTENT_SCOPE_DECISION_REQUIRED');
  assert.equal(report.blockers[0].code, 'CONTENT_SCOPE_DECISION_REQUIRED');
  assert.match(report.blockers[0].message, /never|not a mechanically proven duplicate|explicit content-scope/i);
  assert.deepEqual(report.applied, []);
  assert.deepEqual(Object.keys(report.nextAction).sort(), [
    'args',
    'id',
    'instruction',
    'requires',
    'tool',
  ]);
  assert.deepEqual(report.nextAction.requires, ['CONTENT_SCOPE_DECISION']);
  assert.equal(report.nextAction.id, 'blocked_content_scope');
  assert.equal(report.nextAction.tool, '');
  assert.deepEqual(report.nextAction.args, []);
  assert.equal(fs.readFileSync(fixture.out, 'utf8'), sentinel);
  assert.deepEqual(tempArtifacts(fixture.directory), []);
});

test('does not treat a filtered benchmark index as proof of extra ROOT identity', () => {
  const sourceLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', [], { minHeight: '100px' }),
  };
  const candidateLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a', 'section-copy'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', [], { minHeight: '100px' }),
    'section-copy': node('Section', 'ROOT', [], { minHeight: '100px' }),
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: {
      desktop: viewport(100, 20),
      tablet: viewport(90, 18),
      mobile: viewport(80, 16),
    },
  }];
  const fixture = createFixture({
    sourceLayout,
    candidateLayout,
    bands,
    repairQueue: [{
      code: 'remove_or_merge_extra_band',
      viewport: 'desktop',
      candidateIndex: 1,
      sectionId: 'section-copy',
      evidence: {
        candidateRootId: 'section-copy',
        measuredNodeIds: [],
      },
    }],
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.status, 'CONTENT_SCOPE_DECISION_REQUIRED');
  assert.equal(report.blockers[0].code, 'EXTRA_BAND_IDENTITY_UNPROVEN');
  assert.equal(fs.existsSync(fixture.out), false);
});

test('removes a structurally identical extra subtree only after mechanical duplicate proof', () => {
  const sourceLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', ['copy-a'], { minHeight: '100px' }),
    'copy-a': node('Text', 'section-a', [], { text: 'Repeated exact copy' }),
  };
  const candidateLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a', 'section-copy'],
      props: {},
    },
    'section-a': node('Section', 'ROOT', ['copy-a'], { minHeight: '100px' }),
    'copy-a': node('Text', 'section-a', [], { text: 'Repeated exact copy' }),
    'section-copy': node('Section', 'ROOT', ['copy-b'], { minHeight: '100px' }),
    'copy-b': node('Text', 'section-copy', [], { text: 'Repeated exact copy' }),
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: {
      desktop: viewport(100, 20),
      tablet: viewport(90, 18),
      mobile: viewport(80, 16),
    },
  }];
  const fixture = createFixture({
    sourceLayout,
    candidateLayout,
    bands,
    repairQueue: [{
      code: 'remove_or_merge_extra_band',
      viewport: 'desktop',
      candidateIndex: 1,
      sectionId: 'section-copy',
      evidence: {
        candidateRootId: 'section-copy',
        measuredNodeIds: ['section-copy'],
      },
    }],
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const repaired = JSON.parse(fs.readFileSync(fixture.out, 'utf8'));
  const removal = report.applied.find((item) => item.code === 'remove_or_merge_extra_band');

  assert.deepEqual(repaired.ROOT.nodes, ['section-a']);
  assert.equal(repaired['section-copy'], undefined);
  assert.equal(repaired['copy-b'], undefined);
  assert.equal(removal.proof, 'identical-subtree');
  assert.equal(removal.deletedNodeCount, 2);
});

test('keeps every unknown repairQueue blocker hard and writes no candidate', () => {
  const sourceLayout = {
    ROOT: {
      type: { resolvedName: 'ROOT' },
      nodes: ['section-a'],
      props: {},
    },
    'section-a': node('Section', 'ROOT'),
  };
  const bands = [{
    order: 0,
    generatedSectionId: 'section-a',
    viewports: {
      desktop: viewport(100, 20),
      tablet: viewport(90, 18),
      mobile: viewport(80, 16),
    },
  }];
  const repairQueue = Array.from({ length: 31 }, (_, index) => ({
    code: `real_blocker_${index}`,
    sectionId: '',
    evidence: { index },
  }));
  const fixture = createFixture({
    sourceLayout,
    candidateLayout: sourceLayout,
    bands,
    repairQueue,
  });

  const result = runFixture(fixture);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.status, 'REPAIR_BLOCKED');
  assert.equal(report.nextAction.id, 'blocked_repair_queue');
  assert.equal(report.nextAction.tool, '');
  assert.deepEqual(report.nextAction.args, []);
  assert.equal(report.repairQueueCount, 31);
  assert.equal(report.blockers.length, 31);
  assert.equal(fs.existsSync(fixture.out), false);
});
