#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const benchmarkScript = path.join(root, 'monteby-site-authoring', 'scripts', 'run-visual-benchmark.js');

test('visual benchmark report passes when audit and screenshot budgets pass', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, { candidateColor: [255, 255, 255, 255] });
  const reportPath = path.join(fixture.directory, 'benchmark-report.json');
  const markdownPath = path.join(fixture.directory, 'benchmark-report.md');

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-pass',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-dir',
    fixture.directory,
    '--out',
    reportPath,
    '--markdown',
    markdownPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.comparison.percent, 0);
  assert.equal(report.visualReview.columns.join('|'), 'reference|candidate|diff');
  assert.equal(fs.existsSync(report.visualReview.sheet), true);
  assert.equal(fs.existsSync(report.files.visualReviewSheet), true);
  const reviewImage = dependencies.PNG.sync.read(fs.readFileSync(report.visualReview.sheet));
  assert.ok(reviewImage.height > 80);
  assert.deepEqual(rgbaAt(reviewImage, 2, 2), [12, 18, 27, 255]);
  assert.deepEqual(report.blockers, []);
  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(fs.existsSync(markdownPath), true);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /Status: PASS/);
  assert.match(markdown, /## Visual Review/);
  assert.match(markdown, /Contact sheet:/);
  assert.match(markdown, /reference .*target-desktop\.png.*candidate .*candidate-desktop\.png.*diff .*diff-desktop\.png/);
});

test('visual benchmark rejects pixel-identical dead tabs and accepts the same capture with working interactions', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: false,
  });
  const referenceManifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  const referenceManifestForTabs = {
    ...referenceManifest,
    layout: 'target-layout.json',
    layoutCapture: { status: 'ok', file: 'target-layout.json', error: '' },
  };
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(referenceManifestForTabs));
  const targetManifestPath = path.join(fixture.directory, 'target-manifest.json');
  const targetManifestWithoutInteractionMetadata = {
    ...referenceManifest,
    layout: 'target-layout.json',
    layoutCapture: { status: 'ok', file: 'target-layout.json', error: '' },
  };
  const targetManifestWithTabs = {
    ...targetManifestWithoutInteractionMetadata,
    interactionPattern: { type: 'tabs' },
  };
  fs.writeFileSync(targetManifestPath, JSON.stringify(targetManifestWithTabs));

  const interactionEvidence = (working, overrides = {}) => {
    const group = {
      index: 0,
      orientation: 'vertical',
      geometry: {
        documentTopRatio: 0.25,
        centerXRatio: 0.5,
        widthRatio: 0.6,
        heightRatio: 0.08,
      },
      tabCount: 5,
      panelCount: 5,
      initialSelectedIndex: 2,
      targetIndex: 3,
      supported: true,
      click: {
        passed: working,
        invoked: true,
        hitTestPassed: true,
        pointerEventsEnabled: true,
        selectedChanged: working,
        panelChanged: working,
        focusMoved: true,
      },
      keyboard: {
        key: 'ArrowDown',
        activationMode: 'automatic',
        activationKey: '',
        arrowFocusMoved: working,
        passed: working,
        selectedChanged: working,
        panelChanged: working,
        focusMoved: working,
        focusIndicatorVisible: true,
      },
      ariaRelations: {
        controlledTargetsResolved: true,
        controlledTargetsAreTabpanels: true,
        panelsLabelledByTabs: true,
        complete: true,
      },
      restoredAfterClick: true,
      restored: true,
      working,
    };
    const mergedGroup = {
      ...group,
      ...overrides,
      geometry: { ...group.geometry, ...(overrides.geometry || {}) },
      click: { ...group.click, ...(overrides.click || {}) },
      keyboard: { ...group.keyboard, ...(overrides.keyboard || {}) },
    };

    return { tabs: {
      schemaVersion: 2,
      status: 'captured',
      groupLimit: 8,
      tabLimit: 20,
      detectedGroups: 1,
      retainedGroups: 1,
      workingGroups: working ? 1 : 0,
      truncatedGroups: 0,
      groups: [mergedGroup],
    } };
  };
  const writeRenderedLayout = (file, evidence) => {
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    fs.writeFileSync(file, JSON.stringify({
      ...existing,
      viewport: { width: 1, height: 1, scrollWidth: 1, scrollHeight: 1 },
      horizontalOverflow: {
        viewportWidth: 1,
        documentScrollWidth: 1,
        overflowPx: 0,
        offenderCount: 0,
        offendersTruncated: 0,
        offenders: [],
      },
      interactionEvidence: evidence,
    }));
  };
  const targetLayoutPath = path.join(fixture.directory, 'target-layout.json');
  const candidateLayoutPath = path.join(fixture.directory, 'candidate-layout.json');
  writeRenderedLayout(targetLayoutPath, interactionEvidence(true));
  writeRenderedLayout(candidateLayoutPath, interactionEvidence(false));

  const benchmarkArgs = [
    benchmarkScript,
    '--label',
    'unit-dead-tabs',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--target-manifest',
    targetManifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ];
  writeRenderedLayout(targetLayoutPath, interactionEvidence(false));
  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true));
  const unverifiedReferenceResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(unverifiedReferenceResult.status, 1, unverifiedReferenceResult.stderr || unverifiedReferenceResult.stdout);
  const unverifiedReferenceReport = JSON.parse(unverifiedReferenceResult.stdout);
  assert.equal(unverifiedReferenceReport.mechanics.stats.tabInteractions.required, true);
  assert.equal(unverifiedReferenceReport.mechanics.stats.tabInteractions.referenceWorkingGroups, 0);
  const unverifiedReferenceBlocker = unverifiedReferenceReport.blockers.find((blocker) => blocker.code === 'reference_tabs_interaction_unverified');
  assert.equal(unverifiedReferenceBlocker.source, 'mechanics');
  assert.equal(unverifiedReferenceBlocker.label, 'all');

  fs.writeFileSync(targetManifestPath, JSON.stringify(targetManifestWithoutInteractionMetadata));
  const inferredUnverifiedReferenceResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(
    inferredUnverifiedReferenceResult.status,
    1,
    inferredUnverifiedReferenceResult.stderr || inferredUnverifiedReferenceResult.stdout,
  );
  const inferredUnverifiedReferenceReport = JSON.parse(inferredUnverifiedReferenceResult.stdout);
  assert.equal(inferredUnverifiedReferenceReport.mechanics.stats.tabInteractions.required, true);
  assert.equal(inferredUnverifiedReferenceReport.mechanics.stats.tabInteractions.referenceDetectedGroups, 1);
  assert.equal(
    inferredUnverifiedReferenceReport.blockers.some((blocker) => blocker.code === 'reference_tabs_interaction_unverified'),
    true,
  );

  fs.writeFileSync(fixture.manifestPath, JSON.stringify({
    ...referenceManifestForTabs,
    layout: 'missing-reference-layout.json',
    layoutCapture: { status: 'failed', file: 'missing-reference-layout.json', error: 'capture failed' },
    interactionEvidence: {
      tabs: {
        viewports: [{ label: 'desktop', detectedGroups: 1 }],
      },
    },
  }));
  const missingReferenceEvidenceResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(
    missingReferenceEvidenceResult.status,
    1,
    missingReferenceEvidenceResult.stderr || missingReferenceEvidenceResult.stdout,
  );
  const missingReferenceEvidenceReport = JSON.parse(missingReferenceEvidenceResult.stdout);
  assert.equal(missingReferenceEvidenceReport.mechanics.skipped, false);
  assert.equal(
    missingReferenceEvidenceReport.blockers.some((blocker) => blocker.code === 'reference_tabs_interaction_unverified'),
    true,
  );
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(referenceManifestForTabs));

  const noTabEvidence = {
    tabs: {
      schemaVersion: 2,
      status: 'not-detected',
      detectedGroups: 0,
      retainedGroups: 0,
      workingGroups: 0,
      truncatedGroups: 0,
      groups: [],
    },
  };
  writeRenderedLayout(targetLayoutPath, noTabEvidence);
  writeRenderedLayout(candidateLayoutPath, noTabEvidence);
  const noTabResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(noTabResult.status, 0, noTabResult.stderr || noTabResult.stdout);
  const noTabReport = JSON.parse(noTabResult.stdout);
  assert.equal(noTabReport.mechanics.stats.tabInteractions.required, false);
  assert.equal(noTabReport.mechanics.stats.tabInteractions.referenceDetectedGroups, 0);

  fs.writeFileSync(targetManifestPath, JSON.stringify(targetManifestWithTabs));

  writeRenderedLayout(targetLayoutPath, interactionEvidence(true));
  writeRenderedLayout(candidateLayoutPath, interactionEvidence(false));
  const deadResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(deadResult.status, 1, deadResult.stderr || deadResult.stdout);
  const deadReport = JSON.parse(deadResult.stdout);
  assert.equal(deadReport.comparison.percent, 0);
  assert.equal(deadReport.comparison.maxPercent, 0);
  assert.equal(deadReport.mechanics.ok, false);
  assert.equal(deadReport.mechanics.stats.tabInteractions.referenceWorkingGroups, 1);
  assert.equal(deadReport.mechanics.stats.tabInteractions.candidateWorkingGroups, 0);
  const deadBlocker = deadReport.blockers.find((blocker) => blocker.code === 'candidate_tabs_interaction_mismatch');
  assert.equal(deadBlocker.source, 'mechanics');
  assert.equal(deadBlocker.label, 'desktop');
  assert.match(deadBlocker.message, /click selected state, click panel state, keyboard selected state, keyboard panel state, keyboard focus/);

  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true));
  const workingResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(workingResult.status, 0, workingResult.stderr || workingResult.stdout);
  const workingReport = JSON.parse(workingResult.stdout);
  assert.equal(workingReport.ok, true);
  assert.equal(workingReport.comparison.percent, 0);
  assert.equal(workingReport.mechanics.ok, true);
  assert.equal(workingReport.mechanics.stats.tabInteractions.candidateWorkingGroups, 1);
  assert.equal(workingReport.blockers.some((blocker) => blocker.code === 'candidate_tabs_interaction_mismatch'), false);

  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true, {
    keyboard: { focusIndicatorVisible: false },
  }));
  const hiddenFocusResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(hiddenFocusResult.status, 1, hiddenFocusResult.stderr || hiddenFocusResult.stdout);
  const hiddenFocusReport = JSON.parse(hiddenFocusResult.stdout);
  const hiddenFocusBlocker = hiddenFocusReport.blockers.find((blocker) => blocker.code === 'candidate_tabs_interaction_mismatch');
  assert.match(hiddenFocusBlocker.message, /keyboard visible focus indicator/);

  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true, {
    ariaRelations: {
      controlledTargetsResolved: true,
      controlledTargetsAreTabpanels: false,
      panelsLabelledByTabs: false,
      complete: false,
    },
  }));
  const invalidAriaResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(invalidAriaResult.status, 1, invalidAriaResult.stderr || invalidAriaResult.stdout);
  const invalidAriaReport = JSON.parse(invalidAriaResult.stdout);
  const invalidAriaBlocker = invalidAriaReport.blockers.find((blocker) => blocker.code === 'candidate_tabs_interaction_mismatch');
  assert.match(invalidAriaBlocker.message, /controlled target role=tabpanel/);
  assert.match(invalidAriaBlocker.message, /panel aria-labelledby reciprocity/);

  const legacyReferenceEvidence = interactionEvidence(true);
  delete legacyReferenceEvidence.tabs.schemaVersion;
  delete legacyReferenceEvidence.tabs.groups[0].ariaRelations;
  delete legacyReferenceEvidence.tabs.groups[0].keyboard.focusIndicatorVisible;
  writeRenderedLayout(targetLayoutPath, legacyReferenceEvidence);
  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true));
  const legacyReferenceResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(legacyReferenceResult.status, 0, legacyReferenceResult.stderr || legacyReferenceResult.stdout);
  const legacyReferenceReport = JSON.parse(legacyReferenceResult.stdout);
  assert.equal(legacyReferenceReport.mechanics.stats.tabInteractions.referenceWorkingGroups, 1);

  writeRenderedLayout(targetLayoutPath, interactionEvidence(true));
  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true));

  const firstReferenceGroup = interactionEvidence(true).tabs.groups[0];
  const secondReferenceGroup = {
    ...firstReferenceGroup,
    index: 1,
    orientation: 'horizontal',
    geometry: {
      ...firstReferenceGroup.geometry,
      documentTopRatio: 0.68,
      widthRatio: 0.72,
    },
    initialSelectedIndex: 0,
    targetIndex: 1,
    keyboard: {
      ...firstReferenceGroup.keyboard,
      key: 'ArrowRight',
    },
  };
  const twoGroupEvidence = (groups) => ({
    tabs: {
      schemaVersion: 2,
      status: 'captured',
      groupLimit: 8,
      tabLimit: 20,
      detectedGroups: groups.length,
      retainedGroups: groups.length,
      workingGroups: groups.length,
      truncatedGroups: 0,
      groups,
    },
  });
  writeRenderedLayout(targetLayoutPath, twoGroupEvidence([firstReferenceGroup, secondReferenceGroup]));
  writeRenderedLayout(candidateLayoutPath, twoGroupEvidence([
    { ...secondReferenceGroup, index: 0 },
    { ...firstReferenceGroup, index: 1 },
  ]));
  const reorderedGroupsResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(reorderedGroupsResult.status, 0, reorderedGroupsResult.stderr || reorderedGroupsResult.stdout);
  const reorderedGroupsReport = JSON.parse(reorderedGroupsResult.stdout);
  assert.equal(reorderedGroupsReport.mechanics.stats.tabInteractions.referenceWorkingGroups, 2);
  assert.equal(reorderedGroupsReport.mechanics.stats.tabInteractions.candidateWorkingGroups, 2);

  writeRenderedLayout(targetLayoutPath, interactionEvidence(true));

  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true, { orientation: 'horizontal' }));
  const wrongStructureResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(wrongStructureResult.status, 1, wrongStructureResult.stderr || wrongStructureResult.stdout);
  const wrongStructureReport = JSON.parse(wrongStructureResult.stdout);
  const wrongStructureBlocker = wrongStructureReport.blockers.find((blocker) => blocker.code === 'candidate_tabs_interaction_mismatch');
  assert.match(wrongStructureBlocker.message, /tablist orientation/);

  writeRenderedLayout(candidateLayoutPath, interactionEvidence(true, {
    geometry: { documentTopRatio: 0.8 },
  }));
  const wrongLocationResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(wrongLocationResult.status, 1, wrongLocationResult.stderr || wrongLocationResult.stdout);
  const wrongLocationReport = JSON.parse(wrongLocationResult.stdout);
  const wrongLocationBlocker = wrongLocationReport.blockers.find((blocker) => blocker.code === 'candidate_tabs_interaction_mismatch');
  assert.match(wrongLocationBlocker.message, /tablist location\/size/);
});

test('visual benchmark fails above one CSS pixel of candidate horizontal overflow with structured offenders', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
  });
  const markdownPath = path.join(fixture.directory, 'overflow-report.md');
  writeLayoutSummary(path.join(fixture.directory, 'target-layout.json'), 0.62, {
    width: 1440,
    height: 1200,
    scrollWidth: 1440,
    scrollHeight: 3000,
  });
  const candidateLayoutPath = path.join(fixture.directory, 'candidate-layout.json');
  const writeCandidateOverflow = (overflowPx) => {
    const documentScrollWidth = 1440 + overflowPx;
    fs.writeFileSync(candidateLayoutPath, JSON.stringify({
      viewport: {
        width: 1440,
        height: 1200,
        scrollWidth: documentScrollWidth,
        scrollHeight: 3000,
      },
      horizontalOverflow: {
        viewportWidth: 1440,
        documentScrollWidth,
        overflowPx,
        offenderCount: 1,
        offendersTruncated: 0,
        limit: 20,
        offenders: [{
          key: '2.0',
          tag: 'section',
          rect: { left: 0, right: documentScrollWidth, top: 400, bottom: 900, width: documentScrollWidth, height: 500 },
          overflowLeft: 0,
          overflowRight: overflowPx,
          display: 'block',
          position: 'static',
        }],
      },
      summary: { firstViewportMediaCoverage: 0.62 },
    }));
  };
  writeCandidateOverflow(2);

  const overflowResult = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-horizontal-overflow',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--markdown',
    markdownPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(overflowResult.status, 1, overflowResult.stderr);
  const overflowReport = JSON.parse(overflowResult.stdout);
  assert.equal(overflowReport.horizontalOverflow.ok, false);
  assert.equal(overflowReport.horizontalOverflow.thresholdPx, 1);
  assert.equal(overflowReport.horizontalOverflow.stats.maxOverflowPx, 2);
  assert.deepEqual(overflowReport.horizontalOverflow.stats.viewports[0], {
    label: 'desktop',
    measured: true,
    file: candidateLayoutPath,
    viewportWidth: 1440,
    documentScrollWidth: 1442,
    overflowPx: 2,
    offenderCount: 1,
    offendersTruncated: 0,
    offenders: [{
      key: '2.0',
      tag: 'section',
      rect: { left: 0, right: 1442, top: 400, bottom: 900, width: 1442, height: 500 },
      overflowLeft: 0,
      overflowRight: 2,
      display: 'block',
      position: 'static',
    }],
  });
  const blocker = overflowReport.blockers.find((item) => item.code === 'candidate_horizontal_overflow_exceeded');
  assert.equal(blocker.source, 'horizontal-overflow');
  assert.equal(blocker.label, 'desktop');
  assert.equal(blocker.overflowPx, 2);
  assert.equal(blocker.thresholdPx, 1);
  assert.equal(blocker.offenders[0].key, '2.0');
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /## Horizontal Overflow[\s\S]*Status: FAIL[\s\S]*desktop:2px \(1442\/1440px\)/);

  writeCandidateOverflow(1);
  const toleranceResult = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-horizontal-overflow-tolerance',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(toleranceResult.status, 0, toleranceResult.stderr || toleranceResult.stdout);
  const toleranceReport = JSON.parse(toleranceResult.stdout);
  assert.equal(toleranceReport.ok, true);
  assert.equal(toleranceReport.horizontalOverflow.ok, true);
  assert.equal(toleranceReport.horizontalOverflow.stats.maxOverflowPx, 1);
  assert.equal(toleranceReport.blockers.some((item) => item.code === 'candidate_horizontal_overflow_exceeded'), false);
});

test('visual benchmark enforces full-page depth for an unmapped reference family', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
  });
  writeLayoutSummary(path.join(fixture.directory, 'target-layout.json'), 0.62, {
    width: 1440,
    height: 1200,
    scrollHeight: 5000,
  });
  writeLayoutSummary(path.join(fixture.directory, 'candidate-layout.json'), 0.62, {
    width: 1440,
    height: 1200,
    scrollHeight: 3500,
  });

  const shortResult = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-generic-depth-shortfall',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(shortResult.status, 1, shortResult.stderr);
  const shortReport = JSON.parse(shortResult.stdout);
  assert.equal(shortReport.mechanics.skipped, false);
  assert.equal(shortReport.mechanics.ok, false);
  assert.deepEqual(shortReport.mechanics.stats.pageDepth.desktop, {
    reference: 5000,
    candidate: 3500,
    ratio: 0.7,
  });
  assert.match(shortReport.blockers.map((blocker) => blocker.code).join(' '), /candidate_page_depth_shortfall/);

  writeLayoutSummary(path.join(fixture.directory, 'candidate-layout.json'), 0.62, {
    width: 1440,
    height: 1200,
    scrollHeight: 4000,
  });
  const completeResult = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-generic-depth-complete',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(completeResult.status, 0, completeResult.stderr);
  const completeReport = JSON.parse(completeResult.stdout);
  assert.equal(completeReport.mechanics.ok, true);
  assert.equal(completeReport.mechanics.stats.pageDepth.desktop.ratio, 0.8);
});

test('strict unknown-family geometry rejects a grossly overlong page symmetrically', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const referenceBands = genericGeometryReferenceBands();
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 10000,
    referenceBands,
    candidateBands: scaleGeometryBands(referenceBands, 2),
  });
  const result = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-overlong');

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.genericGeometry.enforced, true);
  assert.equal(report.genericGeometry.skipped, false);
  assert.equal(report.genericGeometry.ok, false);
  assert.equal(report.genericGeometry.stats.viewports[0].pageDepth.symmetricDelta, 0.5);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_page_depth_mismatch/);
});

test('strict unknown-family geometry accepts a close responsive landmark layout', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5080,
    referenceBands: genericGeometryReferenceBands(),
    candidateBands: genericGeometryCloseCandidateBands(),
  });
  const result = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-close');

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const viewport = report.genericGeometry.stats.viewports[0];
  assert.equal(report.ok, true);
  assert.equal(report.genericGeometry.enforced, true);
  assert.equal(report.genericGeometry.skipped, false);
  assert.equal(report.genericGeometry.ok, true);
  assert.ok(viewport.score >= report.genericGeometry.thresholds.minViewportScore);
  assert.equal(viewport.bands.referenceSourceLandmarks, 5);
  assert.equal(viewport.bands.referenceCollapsedLandmarks, 1);
  assert.equal(viewport.bands.referenceCount, 4);
  assert.equal(viewport.bands.candidateCount, 4);
  assert.equal(viewport.bands.missingCount, 0);
  assert.equal(viewport.bands.extraCount, 0);
  assert.equal(viewport.bands.reorderedBands, 0);
});

test('strict generic geometry compares a constrained reference band with its Monteby content frame', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const pageBackground = 'rgb(244, 248, 255)';
  const referenceBands = [
    { tag: 'nav', top: 26, height: 44, width: 1280, x: 80 },
    { tag: 'section', top: 136, height: 580, width: 1280, x: 80 },
    { tag: 'section', top: 740, height: 250, width: 1280, x: 80 },
    { tag: 'section', top: 1060, height: 102, width: 1280, x: 80 },
  ].map((band) => ({ ...band, backgroundColor: 'rgba(0, 0, 0, 0)', paintedBackground: false }));
  const candidateBands = [
    { tag: 'nav', top: 0, height: 136, width: 1440 },
    { tag: 'section', top: 136, height: 604, width: 1440 },
    { tag: 'section', top: 740, height: 320, width: 1440 },
    { tag: 'section', top: 1060, height: 140, width: 1440 },
  ].map((band) => ({ ...band, backgroundColor: pageBackground, paintedBackground: true }));
  const candidateGroups = referenceBands.map((band, index) => ({
    ...band,
    key: `${index}.0`,
    parentKey: String(index),
    backgroundColor: 'rgba(0, 0, 0, 0)',
    paintedBackground: false,
  }));
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 1200,
    candidateScrollHeight: 1200,
    referenceBands,
    candidateBands,
    referencePageBackground: pageBackground,
    candidatePageBackground: 'rgb(247, 247, 244)',
    candidateGroups,
  });
  const result = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-content-frame');

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const viewport = report.genericGeometry.stats.viewports[0];
  assert.equal(report.genericGeometry.ok, true);
  assert.equal(viewport.geometry.meanNormalizedWidthDelta, 0, JSON.stringify(viewport.geometry.pairs));
  assert.ok(viewport.geometry.pairs.every((pair) => pair.candidateGeometrySource.startsWith('layoutGroup:')));

  writeGenericGeometryLayout(fixture.candidateLayoutPath, {
    scrollHeight: 1200,
    pageBackground: 'rgb(247, 247, 244)',
    bands: candidateBands.map((band) => ({ ...band, backgroundColor: 'rgb(220, 38, 38)' })),
    groups: candidateGroups,
    mediaSource: 'https://cdn.example.test/candidate-hero.jpg',
  });
  const paintedOuterResult = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-painted-outer-band');
  assert.equal(paintedOuterResult.status, 1, paintedOuterResult.stderr);
  const paintedOuterReport = JSON.parse(paintedOuterResult.stdout);
  assert.match(paintedOuterReport.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_band_width_mismatch/);
});

test('strict generic geometry rejects a missing large painted inner surface', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const bands = genericGeometryReferenceBands();
  const paintedSurface = {
    key: '1.0',
    parentKey: '1',
    top: 180,
    x: 884,
    width: 560,
    height: 480,
    backgroundColor: 'rgb(40, 96, 86)',
    paintedBackground: true,
  };
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5000,
    referenceBands: bands,
    candidateBands: bands,
    referenceGroups: [paintedSurface],
    candidateGroups: [],
  });
  const missingResult = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-missing-painted-surface');

  assert.equal(missingResult.status, 1, missingResult.stderr);
  const missingReport = JSON.parse(missingResult.stdout);
  const missingViewport = missingReport.genericGeometry.stats.viewports[0];
  assert.equal(missingViewport.paintedSurfaces.referenceCount, 1);
  assert.equal(missingViewport.paintedSurfaces.candidateCount, 0);
  assert.equal(missingViewport.paintedSurfaces.missingCount, 1);
  assert.match(missingReport.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_painted_surface_missing/);

  writeGenericGeometryLayout(fixture.candidateLayoutPath, {
    scrollHeight: 5000,
    bands,
    groups: [{ ...paintedSurface, x: 880, width: 556 }],
    mediaSource: 'https://cdn.example.test/candidate-hero.jpg',
  });
  const matchedResult = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-matched-painted-surface');
  assert.equal(matchedResult.status, 0, matchedResult.stderr || matchedResult.stdout);
  const matchedReport = JSON.parse(matchedResult.stdout);
  assert.equal(matchedReport.genericGeometry.stats.viewports[0].paintedSurfaces.matchedCount, 1);
});

test('strict generic geometry excludes nested semantic landmarks from root band inventory', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const bands = genericGeometryReferenceBands();
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5000,
    referenceBands: bands,
    candidateBands: bands,
  });
  const referenceLayout = JSON.parse(fs.readFileSync(fixture.referenceLayoutPath, 'utf8'));
  referenceLayout.landmarks.push({
    key: '2.0',
    order: referenceLayout.landmarks.length,
    tag: 'section',
    flowParticipation: 'normal',
    rect: { x: 100, y: 1100, width: 1240, height: 300, top: 1100, bottom: 1400, left: 100, right: 1340 },
  });
  referenceLayout.evidenceCompleteness.categories.landmarks.total += 1;
  referenceLayout.evidenceCompleteness.categories.landmarks.retained += 1;
  fs.writeFileSync(fixture.referenceLayoutPath, JSON.stringify(referenceLayout));

  const result = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-nested-landmark');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.genericGeometry.stats.viewports[0].bands.referenceCount, 4);
  assert.equal(report.genericGeometry.stats.viewports[0].bands.missingCount, 0);
});

test('viewport-only real-reference geometry remains diagnostic', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const bands = genericGeometryReferenceBands();
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5000,
    referenceBands: bands,
    candidateBands: bands,
  });
  for (const file of [fixture.referenceLayoutPath, fixture.candidateLayoutPath]) {
    const layout = JSON.parse(fs.readFileSync(file, 'utf8'));
    layout.evidenceCompleteness.mode = 'viewport';
    fs.writeFileSync(file, JSON.stringify(layout));
  }
  for (const file of [fixture.manifestPath, fixture.candidateManifestPath]) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.screenshots = manifest.screenshots.map((screenshot) => ({ ...screenshot, mode: 'viewport' }));
    fs.writeFileSync(file, JSON.stringify(manifest));
  }

  const result = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-viewport-diagnostic');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.genericGeometry.enforced, false);
  assert.equal(report.blockers.some((blocker) => blocker.code.startsWith('generic_geometry_')), false);
});

test('familyless generated targets enforce the generic geometry verdict without a real-reference flag', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5080,
    referenceBands: genericGeometryReferenceBands(),
    candidateBands: genericGeometryCloseCandidateBands(),
  });
  const referenceManifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  delete referenceManifest.sourceUrl;
  referenceManifest.seed = 'generated-geometry-unit';
  referenceManifest.variant = 'bento-showcase';
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(referenceManifest));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-generated-generic-geometry',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.genericGeometry.enforced, true);
  assert.equal(report.genericGeometry.skipped, false);
  assert.equal(report.genericGeometry.ok, true);
});

test('complete local HTML geometry is enforced without an HTTP real-reference flag', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const referenceBands = genericGeometryReferenceBands();
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5000,
    referenceBands,
    candidateBands: referenceBands.slice(0, -1),
  });
  const referenceManifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  referenceManifest.sourceUrl = 'file:///tmp/local-reference.html';
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(referenceManifest));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-local-html-generic-geometry',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.genericGeometry.enforced, true);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_major_band_missing/);
});

test('strict unknown-family geometry rejects missing, extra, and reordered major bands', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const referenceBands = genericGeometryReferenceBands();
  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5000,
    referenceBands,
    candidateBands: referenceBands.filter((_, index) => index !== 3),
  });
  const missingResult = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-missing-band');

  assert.equal(missingResult.status, 1, missingResult.stderr);
  const missingReport = JSON.parse(missingResult.stdout);
  assert.equal(missingReport.genericGeometry.stats.viewports[0].bands.missingCount, 1);
  assert.match(missingReport.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_major_band_missing/);

  writeGenericGeometryLayout(fixture.candidateLayoutPath, {
    scrollHeight: 5000,
    bands: [
      ...referenceBands,
      { tag: 'section', top: 3200, height: 600, width: 1440 },
    ],
    mediaSource: 'https://cdn.example.test/candidate-hero.jpg',
  });
  const extraResult = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-extra-band');

  assert.equal(extraResult.status, 1, extraResult.stderr);
  const extraReport = JSON.parse(extraResult.stdout);
  assert.equal(extraReport.genericGeometry.stats.viewports[0].bands.extraCount, 1);
  assert.match(extraReport.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_major_band_extra/);

  writeGenericGeometryLayout(fixture.candidateLayoutPath, {
    scrollHeight: 5000,
    bands: genericGeometryReorderedCandidateBands(),
    mediaSource: 'https://cdn.example.test/candidate-hero.jpg',
  });
  const reorderedResult = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-reordered-band');

  assert.equal(reorderedResult.status, 1, reorderedResult.stderr);
  const reorderedReport = JSON.parse(reorderedResult.stdout);
  assert.ok(reorderedReport.genericGeometry.stats.viewports[0].bands.reorderedBands > 0);
  assert.match(reorderedReport.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_major_band_reordered/);
});

test('strict unknown-family geometry cannot pass with incomplete layout evidence', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createStrictGenericGeometryFixture(dependencies.PNG, {
    referenceScrollHeight: 5000,
    candidateScrollHeight: 5000,
    referenceBands: genericGeometryReferenceBands(),
    candidateBands: genericGeometryReferenceBands(),
    candidateEvidenceComplete: false,
  });
  const result = runStrictGenericGeometryBenchmark(fixture, 'unit-generic-geometry-incomplete');

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.genericGeometry.enforced, true);
  assert.equal(report.genericGeometry.skipped, true);
  assert.equal(report.genericGeometry.ok, false);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /generic_geometry_candidate_evidence_incomplete/);
});

test('visual benchmark automatically pads full-page height differences and keeps depth failures visible', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
  });
  writeSolidPng(dependencies.PNG, fixture.targetPath, [255, 255, 255, 255], 4, 5);
  writeSolidPng(dependencies.PNG, fixture.candidatePath, [255, 255, 255, 255], 4, 3);

  const referenceManifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  referenceManifest.screenshots = [
    { label: 'desktop', width: 4, height: 2, mode: 'full-page', file: 'target-desktop.png' },
  ];
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(referenceManifest));

  const candidateManifest = JSON.parse(fs.readFileSync(fixture.candidateManifestPath, 'utf8'));
  candidateManifest.screenshots = [
    { label: 'desktop', width: 4, height: 2, mode: 'full-page', file: 'candidate-desktop.png' },
  ];
  fs.writeFileSync(fixture.candidateManifestPath, JSON.stringify(candidateManifest));

  writeLayoutSummary(path.join(fixture.directory, 'target-layout.json'), 0.62, {
    width: 4,
    height: 2,
    scrollHeight: 5,
  });
  writeLayoutSummary(path.join(fixture.directory, 'candidate-layout.json'), 0.62, {
    width: 4,
    height: 2,
    scrollHeight: 3,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-full-page-height-shortfall',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.comparison.unavailable, undefined);
  assert.equal(report.comparison.results[0].padded, true);
  assert.equal(report.comparison.results[0].width, 4);
  assert.equal(report.comparison.results[0].height, 5);
  assert.equal(report.comparison.results[0].mismatched, 8);
  assert.equal(report.comparison.percent, 40);
  assert.deepEqual(report.mechanics.stats.pageDepth.desktop, {
    reference: 5,
    candidate: 3,
    ratio: 0.6,
  });
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.match(blockerCodes, /max_percent_exceeded/);
  assert.match(blockerCodes, /max_viewport_percent_exceeded/);
  assert.match(blockerCodes, /candidate_page_depth_shortfall/);
});

test('visual benchmark rejects viewport image height differences with a structured blocker', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
  });
  writeSolidPng(dependencies.PNG, fixture.targetPath, [255, 255, 255, 255], 4, 5);
  writeSolidPng(dependencies.PNG, fixture.candidatePath, [255, 255, 255, 255], 4, 3);

  const referenceManifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  referenceManifest.screenshots = [
    { label: 'desktop', width: 4, height: 2, mode: 'viewport', file: 'target-desktop.png' },
  ];
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(referenceManifest));

  const candidateManifest = JSON.parse(fs.readFileSync(fixture.candidateManifestPath, 'utf8'));
  candidateManifest.screenshots = [
    { label: 'desktop', width: 4, height: 2, mode: 'viewport', file: 'candidate-desktop.png' },
  ];
  fs.writeFileSync(fixture.candidateManifestPath, JSON.stringify(candidateManifest));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-viewport-height-mismatch',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--pad-to-largest',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.comparison.ok, false);
  assert.equal(report.comparison.unavailable, true);
  assert.deepEqual(report.comparison.results, []);
  assert.equal(report.comparison.errors[0].code, 'screenshot_comparison_unavailable');
  assert.match(report.comparison.errors[0].message, /Screenshot sizes differ: target 4x5, candidate 4x3/);
  assert.match(report.commands.comparison.stderr, /Screenshot sizes differ: target 4x5, candidate 4x3/);
  assert.deepEqual(
    report.blockers.filter((blocker) => blocker.source === 'comparison').map((blocker) => blocker.code),
    ['screenshot_comparison_unavailable']
  );
  assert.doesNotMatch(report.comparison.errors[0].message, /did not print JSON output/);
});

test('visual benchmark report fails when screenshot budget fails', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, { candidateColor: [0, 0, 0, 255] });
  const reportPath = path.join(fixture.directory, 'benchmark-report.json');

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-budget-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-dir',
    fixture.directory,
    '--out',
    reportPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, false);
  assert.equal(report.blockers.length, 1);
  assert.equal(report.blockers[0].source, 'comparison');
  assert.equal(report.blockers[0].code, 'max_percent_exceeded');
  assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).ok, false);
});

test('visual benchmark applies paired media masking to legal replacement photography budgets', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    imageWidth: 200,
    imageHeight: 200,
    mediaReference: true,
  });
  const mediaRect = { x: 20, y: 40, width: 160, height: 120 };
  const targetMediaBox = mediaBox(
    mediaRect.x,
    mediaRect.y,
    mediaRect.width,
    mediaRect.height,
    mediaRect.width * mediaRect.height,
    'https://reference.example.test/reference-hero.jpg'
  );
  const candidateMediaBox = mediaBox(
    mediaRect.x,
    mediaRect.y,
    mediaRect.width,
    mediaRect.height,
    mediaRect.width * mediaRect.height,
    'https://candidate.example.test/replacement-hero.jpg'
  );
  const viewport = { width: 200, height: 200, scrollWidth: 200, scrollHeight: 200 };
  const layoutEvidence = (box) => ({
    viewport,
    horizontalOverflow: {
      viewportWidth: 200,
      documentScrollWidth: 200,
      overflowPx: 0,
      offenderCount: 0,
      offendersTruncated: 0,
      offenders: [],
    },
    summary: { firstViewportMediaCoverage: 0.48 },
    mediaBoxes: [box],
    meaningfulMediaBoxes: [box],
    textBoxes: [],
    interactions: [],
    landmarks: [],
  });
  writeSolidPng(dependencies.PNG, fixture.targetPath, [255, 255, 255, 255], 200, 200, [
    { rect: mediaRect, color: [24, 52, 96, 255] },
  ]);
  writeSolidPng(dependencies.PNG, fixture.candidatePath, [255, 255, 255, 255], 200, 200, [
    { rect: mediaRect, color: [228, 88, 42, 255] },
  ]);
  fs.writeFileSync(path.join(fixture.directory, 'target-layout.json'), JSON.stringify(layoutEvidence(targetMediaBox)));
  fs.writeFileSync(path.join(fixture.directory, 'candidate-layout.json'), JSON.stringify(layoutEvidence(candidateMediaBox)));

  const benchmarkArgs = [
    benchmarkScript,
    '--label', 'unit-media-aware-budget',
    '--layout', fixture.layoutPath,
    '--contract', fixture.contractPath,
    '--reference-manifest', fixture.manifestPath,
    '--candidate-manifest', fixture.candidateManifestPath,
    '--max-percent', '15',
    '--max-viewport-percent', '15',
    '--json',
  ];
  const result = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.audit.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.comparison.mediaMask.applied, true);
  assert.equal(report.comparison.mediaMask.pairedBoxes, 1);
  assert.ok(report.comparison.percent > 0);
  assert.ok(report.comparison.percent < 15);

  const shiftedRect = { x: 50, y: 40, width: 150, height: 120 };
  const shiftedCandidateBox = mediaBox(
    shiftedRect.x,
    shiftedRect.y,
    shiftedRect.width,
    shiftedRect.height,
    shiftedRect.width * shiftedRect.height,
    'https://candidate.example.test/replacement-hero.jpg'
  );
  writeSolidPng(dependencies.PNG, fixture.candidatePath, [255, 255, 255, 255], 200, 200, [
    { rect: shiftedRect, color: [228, 88, 42, 255] },
  ]);
  fs.writeFileSync(
    path.join(fixture.directory, 'candidate-layout.json'),
    JSON.stringify(layoutEvidence(shiftedCandidateBox))
  );
  const shiftedResult = spawnSync(process.execPath, benchmarkArgs, {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(shiftedResult.status, 1, shiftedResult.stderr || shiftedResult.stdout);
  const shiftedReport = JSON.parse(shiftedResult.stdout);
  assert.equal(shiftedReport.renderedMedia.ok, true);
  assert.equal(shiftedReport.comparison.mediaMask.applied, true);
  assert.equal(shiftedReport.comparison.ok, false);
  assert.ok(shiftedReport.comparison.percent > 15);
  assert.equal(
    shiftedReport.blockers.some((blocker) => blocker.code === 'max_percent_exceeded'),
    true
  );
});

test('visual benchmark report fails when clean-json audit fails', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    blockedProp: true,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-audit-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-dir',
    fixture.directory,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, false);
  assert.equal(report.comparison.ok, true);
  assert.deepEqual(report.blockers.map((blocker) => blocker.source), ['audit']);
  assert.deepEqual(report.blockers.map((blocker) => blocker.code), ['blocked_prop']);
});

test('visual benchmark report fails when rendered candidate loses media roles', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    candidateRenderedMedia: false,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-rendered-media-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, false);
  assert.equal(report.blockers[0].source, 'rendered-media');
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /missing_rendered_media_role/);
});

test('visual benchmark report can pass a deliberate rendered coverage ratio override', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    referenceCoverage: 1,
    candidateCoverage: 0.41,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-rendered-coverage-ratio-override',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--rendered-min-coverage-ratio',
    '0.4',
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.renderedMedia.stats.minimumCandidateFirstViewportMediaCoverage, 0.4);
});

test('strict real-template benchmark fails when visual resemblance is still weak', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [0, 0, 0, 255],
    mediaReference: true,
    caregloMechanics: true,
  });
  fs.copyFileSync(path.join(fixture.directory, 'target-layout.json'), path.join(fixture.directory, 'candidate-layout.json'));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout-mobile.json'), path.join(fixture.directory, 'candidate-layout-mobile.json'));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-visual-shortfall',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '100',
    '--max-viewport-percent',
    '100',
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.mechanics.ok, true);
  assert.equal(report.qualitative.ok, false);
  assert.equal(report.qualitative.family, 'careglo');
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /template_visual_resemblance_shortfall/);
});

test('real-template benchmark auto-enforces strict verdict from captured sourceUrl', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [0, 0, 0, 255],
    mediaReference: true,
    caregloMechanics: true,
  });
  fs.copyFileSync(path.join(fixture.directory, 'target-layout.json'), path.join(fixture.directory, 'candidate-layout.json'));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout-mobile.json'), path.join(fixture.directory, 'candidate-layout-mobile.json'));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-auto-strict-source-url',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '100',
    '--max-viewport-percent',
    '100',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.screenshotMedia.skipped, false);
  assert.equal(report.mechanics.skipped, false);
  assert.equal(report.qualitative.skipped, false);
  assert.equal(report.qualitative.family, 'careglo');
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /template_visual_resemblance_shortfall/);
});

test('marketplace fallback benchmark maps template family from referenceStyle', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [0, 0, 0, 255],
    mediaReference: true,
    optomattaMechanics: true,
  });
  const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  delete manifest.sourceUrl;
  manifest.referenceStyle = 'optomatta-optical-retail';
  manifest.archetype = 'optomatta-optical-retail';
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(manifest));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout.json'), path.join(fixture.directory, 'candidate-layout.json'));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout-mobile.json'), path.join(fixture.directory, 'candidate-layout-mobile.json'));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-family-from-reference-style',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '100',
    '--max-viewport-percent',
    '100',
    '--require-marketplace-media',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mechanics.skipped, false);
  assert.equal(report.mechanics.family, 'optomatta');
  assert.equal(report.qualitative.skipped, false);
  assert.equal(report.qualitative.family, 'optomatta');
});

test('strict real-template benchmark treats the comparison budget as diagnostic when structural verdict passes', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [0, 0, 0, 255],
    candidateTexture: true,
    imageWidth: 96,
    imageHeight: 80,
    mediaReference: true,
    caregloMechanics: true,
  });
  const targetLayoutPath = path.join(fixture.directory, 'target-layout.json');
  const candidateLayoutPath = path.join(fixture.directory, 'candidate-layout.json');
  const targetLayout = JSON.parse(fs.readFileSync(targetLayoutPath, 'utf8'));
  const maskedMediaBox = mediaBox(0, 0, 1440, 1200, 1728000, 'https://reference.example.test/replacement-hero.jpg');
  targetLayout.mediaBoxes = [maskedMediaBox, ...targetLayout.mediaBoxes];
  fs.writeFileSync(targetLayoutPath, JSON.stringify(targetLayout));
  fs.writeFileSync(candidateLayoutPath, JSON.stringify({
    ...targetLayout,
    mediaBoxes: [
      mediaBox(0, 0, 1440, 1200, 1728000, 'https://candidate.example.test/replacement-hero.jpg'),
      ...targetLayout.mediaBoxes.slice(1),
    ],
  }));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout-mobile.json'), path.join(fixture.directory, 'candidate-layout-mobile.json'));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-raw-diff-diagnostic',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.comparison.ok, false);
  assert.equal(report.comparison.budgetErrors.length > 0, true);
  assert.equal(report.structuralComparison.percent, 0);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.screenshotMedia.ok, true);
  assert.equal(report.mechanics.ok, true);
  assert.equal(report.qualitative.ok, true);
  assert.doesNotMatch(report.blockers.map((blocker) => blocker.code).join(' '), /max_percent_exceeded|max_viewport_percent_exceeded/);
});

test('strict real-template benchmark fails when media boxes render as flat placeholders', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    imageWidth: 96,
    imageHeight: 80,
    mediaReference: true,
    caregloMechanics: true,
  });
  fs.copyFileSync(path.join(fixture.directory, 'target-layout.json'), path.join(fixture.directory, 'candidate-layout.json'));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout-mobile.json'), path.join(fixture.directory, 'candidate-layout-mobile.json'));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-flat-placeholder-media',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.mechanics.ok, true);
  assert.equal(report.screenshotMedia.ok, false);
  assert.equal(report.screenshotMedia.stats.sampledMediaBoxes > 0, true);
  assert.equal(report.screenshotMedia.stats.photoLikeMediaBoxes, 0);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /candidate_screenshot_photo_evidence_missing/);
});

test('strict real-template benchmark fails when a viewport loses photo-led coverage', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    referenceCoverage: 0.5,
    candidateCoverage: 0.5,
  });
  writeViewportCoverageManifests(fixture.directory, fixture.manifestPath, fixture.candidateManifestPath, {
    referenceMobileCoverage: 0.84,
    candidateMobileCoverage: 0.06,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-viewport-media-drop',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, false);
  assert.equal(report.renderedMedia.stats.viewportCoverage.length, 2);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /viewport_media_coverage_drop/);
  assert.match(report.blockers.map((blocker) => blocker.message).join(' '), /mobile/);
});

test('strict real-template benchmark fails when photo density is too thin', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    caregloMechanics: true,
  });
  fs.copyFileSync(path.join(fixture.directory, 'target-layout.json'), path.join(fixture.directory, 'candidate-layout.json'));
  fs.copyFileSync(path.join(fixture.directory, 'target-layout-mobile.json'), path.join(fixture.directory, 'candidate-layout-mobile.json'));
  appendReferenceMediaSurfaces(fixture.manifestPath, 8);

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-template-photo-density-shortfall',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.mechanics.ok, true);
  assert.equal(report.qualitative.ok, false);
  assert.equal(report.qualitative.stats.mediaDensity.referenceSurfaces, 13);
  assert.equal(report.qualitative.stats.mediaDensity.candidateSurfaces, 5);
  assert.equal(report.qualitative.stats.mediaDensity.minimumCandidateSurfaces, 10);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /template_photo_density_shortfall/);
});

test('visual benchmark report names Careglo mechanics mismatches', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    caregloMechanics: true,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-careglo-mechanics-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.mechanics.ok, false);
  assert.equal(report.mechanics.family, 'careglo');
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /careglo_nav_cta_underextended/);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /careglo_nav_links_position_mismatch/);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /careglo_nav_links_hit_area_mismatch/);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /careglo_mobile_heading_wrap_mismatch/);
  assert.match(report.blockers.map((blocker) => blocker.code).join(' '), /careglo_page_depth_shortfall/);
});

test('visual benchmark does not treat a mobile-long-only Careglo diagnostic as desktop mechanics', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    candidateTexture: true,
    imageWidth: 390,
    imageHeight: 1800,
    mediaReference: true,
  });
  const targetLong = path.join(fixture.directory, 'target-mobile-long.png');
  const candidateLong = path.join(fixture.directory, 'candidate-mobile-long.png');
  writeTexturedPng(dependencies.PNG, targetLong, 390, 1800);
  writeTexturedPng(dependencies.PNG, candidateLong, 390, 1800);
  writeCaregloMobileLongOnlyManifest(fixture.manifestPath, 'target-mobile-long.png', 'target-layout-mobile-long.json');
  writeCaregloMobileLongOnlyManifest(fixture.candidateManifestPath, 'candidate-mobile-long.png', 'candidate-layout-mobile-long.json', 'http://localhost:8190/candidate-careglo/');
  writeMobileLongOnlyLayout(path.join(fixture.directory, 'target-layout-mobile-long.json'));
  writeMobileLongOnlyLayout(path.join(fixture.directory, 'candidate-layout-mobile-long.json'));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-careglo-mobile-long-only',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.match(result.stdout, /unit-careglo-mobile-long-only/);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mechanics.skipped, true);
  assert.match(report.mechanics.reason, /Desktop rendered layout evidence is missing/);
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.doesNotMatch(blockerCodes, /careglo_nav_cta_missing/);
  assert.doesNotMatch(blockerCodes, /careglo_nav_links_missing/);
});

test('visual benchmark accepts Careglo fallback nav labels and right-side secondary media', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    candidateTexture: true,
    imageWidth: 96,
    imageHeight: 80,
    mediaReference: true,
    caregloMechanics: true,
  });
  fs.copyFileSync(fixture.candidatePath, fixture.targetPath);
  writeCaregloFallbackMechanicsLayouts(fixture.directory);

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-careglo-fallback-mechanics-pass',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mechanics.ok, true);
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.doesNotMatch(blockerCodes, /careglo_nav_links_missing/);
  assert.doesNotMatch(blockerCodes, /careglo_nav_cta_underextended/);
  assert.doesNotMatch(blockerCodes, /careglo_secondary_proof_missing/);
});

test('visual benchmark report names Maidy mechanics mismatches', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    maidyMechanics: true,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-maidy-mechanics-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.notEqual(report.renderedMedia.skipped, true);
  assert.equal(report.mechanics.ok, false);
  assert.equal(report.mechanics.family, 'maidy');
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.match(blockerCodes, /maidy_topbar_missing/);
  assert.match(blockerCodes, /maidy_right_hero_media_missing/);
  assert.match(blockerCodes, /maidy_equipment_media_missing/);
  assert.match(blockerCodes, /maidy_logo_strip_missing/);
  assert.match(blockerCodes, /maidy_tablet_hero_rhythm_mismatch/);
  assert.match(blockerCodes, /maidy_page_depth_shortfall/);
});

test('Maidy tablet mechanics prefers semantic photo boxes over decorative media', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    maidyMechanics: true,
  });
  const targetLayoutPath = path.join(fixture.directory, 'target-layout-tablet.json');
  const candidateLayoutPath = path.join(fixture.directory, 'candidate-layout-tablet.json');
  const targetLayout = JSON.parse(fs.readFileSync(targetLayoutPath, 'utf8'));
  const candidateLayout = JSON.parse(fs.readFileSync(candidateLayoutPath, 'utf8'));
  targetLayout.meaningfulMediaBoxes = [mediaBox(417, 157, 387, 684, 264708, 'https://target.example.test/cleaner.png')];
  candidateLayout.meaningfulMediaBoxes = [mediaBox(417, 157, 387, 684, 264708, 'https://candidate.example.test/cleaner.png')];
  fs.writeFileSync(targetLayoutPath, JSON.stringify(targetLayout));
  fs.writeFileSync(candidateLayoutPath, JSON.stringify(candidateLayout));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-maidy-semantic-tablet-mechanics',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.doesNotMatch(blockerCodes, /maidy_tablet_hero_rhythm_mismatch/);
  assert.deepEqual(report.mechanics.stats.tabletHeroRhythm, {
    reference: { x: 417, y: 157, width: 387, height: 684 },
    candidate: { x: 417, y: 157, width: 387, height: 684 },
  });
});

test('Maidy mechanics accepts a full hero composite as right-side visual evidence', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    maidyMechanics: true,
  });
  fs.writeFileSync(path.join(fixture.directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 9618 },
    summary: { firstViewportMediaCoverage: 0.75 },
    textBoxes: [
      textBox('Contact', 1214, 91, 76, 14),
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 120, 284, 600, 328),
    ],
    mediaBoxes: [
      mediaBox(0, 149, 1440, 847, 1219680, 'https://candidate.example.test/maidy-hero-composite.png'),
      mediaBox(0, 743, 320, 258, 82560, 'https://candidate.example.test/vacuum.png', 'img'),
    ],
    landmarks: [
      landmarkBox('section', 0, 0, 1440, 49, 'rgb(32, 49, 59)'),
      landmarkBox('section', 0, 996, 1440, 198, 'rgb(32, 49, 59)'),
    ],
  }));
  fs.writeFileSync(path.join(fixture.directory, 'candidate-layout-tablet.json'), JSON.stringify({
    viewport: { width: 834, height: 1112, scrollHeight: 12554 },
    summary: { firstViewportMediaCoverage: 0.9 },
    textBoxes: [
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 30, 230, 360, 244),
    ],
    mediaBoxes: [
      mediaBox(0, 57, 834, 784, 654231, 'https://candidate.example.test/maidy-hero-composite.png'),
      mediaBox(417, 157, 387, 684, 264708, 'https://candidate.example.test/cleaner.png'),
    ],
    landmarks: [
      landmarkBox('section', 0, 0, 834, 57, 'rgb(32, 49, 59)'),
      landmarkBox('section', 0, 841, 834, 198, 'rgb(32, 49, 59)'),
    ],
  }));
  fs.writeFileSync(path.join(fixture.directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 17813 },
    summary: { firstViewportMediaCoverage: 0.1 },
    textBoxes: [
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 20, 196, 350, 244),
    ],
    mediaBoxes: [],
    landmarks: [],
  }));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-maidy-composite-hero',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.notEqual(report.renderedMedia.skipped, true);
  assert.equal(report.mechanics.ok, true);
  assert.equal(report.mechanics.stats.rightHeroMedia.candidate.x, 720);
  assert.doesNotMatch(report.blockers.map((blocker) => blocker.code).join(' '), /maidy_right_hero_media_missing/);
});

test('visual benchmark report names Optomatta mechanics mismatches', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    optomattaMechanics: true,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-optomatta-mechanics-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.notEqual(report.renderedMedia.skipped, true);
  assert.equal(report.mechanics.ok, false);
  assert.equal(report.mechanics.family, 'optomatta');
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.match(blockerCodes, /optomatta_phone_cta_missing/);
  assert.match(blockerCodes, /optomatta_hero_media_scale_mismatch/);
  assert.match(blockerCodes, /optomatta_mobile_heading_width_mismatch/);
  assert.match(blockerCodes, /optomatta_proof_strip_missing/);
  assert.match(blockerCodes, /optomatta_proof_tiles_missing/);
  assert.match(blockerCodes, /optomatta_page_depth_shortfall/);
});

test('Optomatta mechanics accept replacement CTA copy and still classify structural mobile heading drift', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    optomattaMechanics: true,
  });
  const candidateDesktopPath = path.join(fixture.directory, 'candidate-layout.json');
  const candidateDesktop = JSON.parse(fs.readFileSync(candidateDesktopPath, 'utf8'));
  candidateDesktop.textBoxes.unshift(textBox('Umów badanie wzroku', 1215, 18, 215, 72, 'a'));
  candidateDesktop.textBoxes[1] = textBox('A clearer view for every day.', 120, 260, 560, 92, 'h1');
  fs.writeFileSync(candidateDesktopPath, JSON.stringify(candidateDesktop));

  const candidateMobilePath = path.join(fixture.directory, 'candidate-layout-mobile.json');
  const candidateMobile = JSON.parse(fs.readFileSync(candidateMobilePath, 'utf8'));
  candidateMobile.textBoxes = [textBox('A clearer view for every day.', 24, 172, 342, 64, 'h1')];
  fs.writeFileSync(candidateMobilePath, JSON.stringify(candidateMobile));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-optomatta-replacement-copy',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const errorCodes = report.mechanics.errors.map((error) => error.code).join(' ');
  const warningCodes = report.mechanics.warnings.map((warning) => warning.code).join(' ');
  assert.doesNotMatch(errorCodes, /optomatta_phone_cta_(?:missing|position_mismatch|scale_mismatch)/);
  assert.match(errorCodes, /optomatta_hero_heading_wrap_mismatch/);
  assert.match(errorCodes, /optomatta_mobile_heading_wrap_mismatch/);
  assert.match(errorCodes, /optomatta_mobile_heading_width_mismatch/);
  assert.doesNotMatch(warningCodes, /optomatta_mobile_heading_missing/);
  assert.equal(report.mechanics.stats.phoneCta.candidate.x, 1215);

  candidateDesktop.textBoxes[0] = textBox('Umów badanie wzroku', 1340, 18, 90, 36, 'a');
  fs.writeFileSync(candidateDesktopPath, JSON.stringify(candidateDesktop));
  const compactResult = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-optomatta-replacement-copy-compact-cta',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(compactResult.status, 1);
  const compactReport = JSON.parse(compactResult.stdout);
  const compactErrorCodes = compactReport.mechanics.errors.map((error) => error.code).join(' ');
  assert.doesNotMatch(compactErrorCodes, /optomatta_phone_cta_(?:missing|position_mismatch)/);
  assert.match(compactErrorCodes, /optomatta_phone_cta_scale_mismatch/);
});

test('visual benchmark report names Lumen mechanics mismatches', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    lumenMechanics: true,
  });

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-lumen-mechanics-fail',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.notEqual(report.renderedMedia.skipped, true);
  assert.equal(report.mechanics.ok, false);
  assert.equal(report.mechanics.family, 'lumen');
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.match(blockerCodes, /lumen_doctor_visual_missing/);
  assert.match(blockerCodes, /lumen_mini_media_missing/);
  assert.match(blockerCodes, /lumen_proof_card_missing/);
  assert.match(blockerCodes, /lumen_stats_missing/);
  assert.match(blockerCodes, /lumen_page_depth_shortfall/);
  assert.deepEqual(report.mechanics.stats.heroHeading.reference, {
    text: 'See Better. Live Better.',
    x: 329,
    y: 200,
    width: 836,
    height: 268,
  });
});

test('Lumen mechanics measure localized replacement CTA and heading copy through structure and geometry', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    lumenMechanics: true,
  });
  const candidateDesktopPath = path.join(fixture.directory, 'candidate-layout.json');
  const candidateDesktop = JSON.parse(fs.readFileSync(candidateDesktopPath, 'utf8'));
  candidateDesktop.textBoxes = [
    textBox('Umów wizytę', 900, 50, 90, 28, 'a'),
    textBox('Clarity for every horizon.', 160, 250, 520, 82, 'h1'),
  ];
  fs.writeFileSync(candidateDesktopPath, JSON.stringify(candidateDesktop));

  const candidateMobilePath = path.join(fixture.directory, 'candidate-layout-mobile.json');
  const candidateMobile = JSON.parse(fs.readFileSync(candidateMobilePath, 'utf8'));
  candidateMobile.textBoxes = [textBox('Clarity for every horizon.', 20, 180, 350, 64, 'h1')];
  fs.writeFileSync(candidateMobilePath, JSON.stringify(candidateMobile));

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-lumen-replacement-copy',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const errorCodes = report.mechanics.errors.map((error) => error.code).join(' ');
  const warningCodes = report.mechanics.warnings.map((warning) => warning.code).join(' ');
  assert.doesNotMatch(errorCodes, /lumen_appointment_cta_missing/);
  assert.match(errorCodes, /lumen_appointment_cta_position_mismatch/);
  assert.match(errorCodes, /lumen_appointment_cta_scale_mismatch/);
  assert.match(errorCodes, /lumen_hero_heading_scale_mismatch/);
  assert.match(errorCodes, /lumen_mobile_heading_wrap_mismatch/);
  assert.doesNotMatch(warningCodes, /lumen_mobile_heading_missing/);
  assert.equal(report.mechanics.stats.appointmentCta.candidate.x, 900);
});

test('visual benchmark report names Lumen doctor cutout asset mismatch', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    lumenMechanics: true,
  });
  writeLumenCutoutMismatchLayouts(fixture.directory);

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-lumen-cutout-mismatch',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.mechanics.ok, false);
  assert.equal(report.mechanics.family, 'lumen');
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.match(blockerCodes, /lumen_doctor_cutout_asset_mismatch/);
  assert.equal(report.mechanics.stats.doctorVisualCutout.reference.transparentLike, true);
  assert.equal(report.mechanics.stats.doctorVisualCutout.candidate.transparentLike, false);
});

test('visual benchmark report names Lumen vertical rhythm mismatches', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const fixture = createBenchmarkFixture(dependencies.PNG, {
    candidateColor: [255, 255, 255, 255],
    mediaReference: true,
    lumenMechanics: true,
  });
  writeLumenVerticalRhythmMismatchLayouts(fixture.directory);

  const result = spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    'unit-lumen-vertical-rhythm-mismatch',
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.audit.ok, true);
  assert.equal(report.comparison.ok, true);
  assert.equal(report.renderedMedia.ok, true);
  assert.equal(report.mechanics.ok, false);
  assert.equal(report.mechanics.family, 'lumen');
  const blockerCodes = report.blockers.map((blocker) => blocker.code).join(' ');
  assert.doesNotMatch(blockerCodes, /lumen_stats_missing/);
  assert.match(blockerCodes, /lumen_mini_media_position_mismatch/);
  assert.match(blockerCodes, /lumen_proof_card_position_mismatch/);
  assert.match(blockerCodes, /lumen_stats_position_mismatch/);
  assert.match(blockerCodes, /lumen_stats_scale_mismatch/);
});

function loadImageDependencies() {
  try {
    return {
      PNG: require(require.resolve('pngjs', { paths: [root, process.cwd()] })).PNG,
    };
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

function createStrictGenericGeometryFixture(PNG, options) {
  const fixture = createBenchmarkFixture(PNG, {
    candidateColor: [0, 0, 0, 255],
    candidateTexture: true,
    imageWidth: 96,
    imageHeight: 80,
    mediaReference: true,
  });
  fs.copyFileSync(fixture.candidatePath, fixture.targetPath);

  const referenceLayoutPath = path.join(fixture.directory, 'target-layout.json');
  const candidateLayoutPath = path.join(fixture.directory, 'candidate-layout.json');
  writeGenericGeometryLayout(referenceLayoutPath, {
    scrollHeight: options.referenceScrollHeight,
    bands: options.referenceBands,
    pageBackground: options.referencePageBackground,
    mediaSource: 'https://cdn.example.test/reference-hero.jpg',
    groups: options.referenceGroups,
  });
  writeGenericGeometryLayout(candidateLayoutPath, {
    scrollHeight: options.candidateScrollHeight,
    bands: options.candidateBands,
    pageBackground: options.candidatePageBackground,
    mediaSource: 'https://cdn.example.test/candidate-hero.jpg',
    evidenceComplete: options.candidateEvidenceComplete !== false,
    groups: options.candidateGroups,
  });

  const layoutDescriptor = (file) => ({
    label: 'desktop',
    width: 1440,
    height: 1200,
    file,
    status: 'ok',
    error: '',
  });
  const referenceManifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  const referenceLayouts = [layoutDescriptor('target-layout.json')];
  fs.writeFileSync(fixture.manifestPath, JSON.stringify({
    ...referenceManifest,
    sourceUrl: 'https://example.test/unknown-real-reference',
    captureStatus: 'complete',
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, mode: 'full-page', file: 'target-desktop.png' },
    ],
    layout: 'target-layout.json',
    layouts: referenceLayouts,
    layoutCapture: {
      status: 'ok',
      file: 'target-layout.json',
      error: '',
      layouts: referenceLayouts,
    },
  }));

  const candidateManifest = JSON.parse(fs.readFileSync(fixture.candidateManifestPath, 'utf8'));
  const candidateLayouts = [layoutDescriptor('candidate-layout.json')];
  fs.writeFileSync(fixture.candidateManifestPath, JSON.stringify({
    ...candidateManifest,
    sourceUrl: 'http://localhost:8190/unknown-candidate/',
    captureStatus: 'complete',
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, mode: 'full-page', file: 'candidate-desktop.png' },
    ],
    layout: 'candidate-layout.json',
    layouts: candidateLayouts,
    layoutCapture: {
      status: 'ok',
      file: 'candidate-layout.json',
      error: '',
      layouts: candidateLayouts,
    },
  }));

  return {
    ...fixture,
    referenceLayoutPath,
    candidateLayoutPath,
  };
}

function runStrictGenericGeometryBenchmark(fixture, label) {
  return spawnSync(process.execPath, [
    benchmarkScript,
    '--label',
    label,
    '--layout',
    fixture.layoutPath,
    '--contract',
    fixture.contractPath,
    '--reference-manifest',
    fixture.manifestPath,
    '--candidate-manifest',
    fixture.candidateManifestPath,
    '--max-percent',
    '0',
    '--max-viewport-percent',
    '0',
    '--require-real-reference',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
}

function writeGenericGeometryLayout(file, options) {
  const evidenceComplete = options.evidenceComplete !== false;
  const landmarks = options.bands.map((band, index) => ({
    order: index,
    key: band.key || String(index),
    tag: band.tag,
    flowParticipation: band.flowParticipation || 'normal',
    backgroundColor: band.backgroundColor || '',
    paintedBackground: band.paintedBackground === true,
    rect: {
      x: band.x || 0,
      y: band.top,
      width: band.width || 1440,
      height: band.height,
      top: band.top,
      bottom: band.top + band.height,
      left: band.x || 0,
      right: (band.x || 0) + (band.width || 1440),
    },
  }));
  const layoutGroups = (options.groups || []).map((group, index) => ({
    key: group.key || `group-${index}`,
    parentKey: group.parentKey || '',
    tag: group.tag || 'div',
    flowParticipation: group.flowParticipation || 'normal',
    backgroundColor: group.backgroundColor || '',
    paintedBackground: group.paintedBackground === true,
    rect: {
      x: group.x || 0,
      y: group.top,
      width: group.width || 1440,
      height: group.height,
      top: group.top,
      bottom: group.top + group.height,
      left: group.x || 0,
      right: (group.x || 0) + (group.width || 1440),
    },
  }));
  const renderedMedia = mediaBox(0, 0, 1440, 1000, 1200000, options.mediaSource);
  fs.writeFileSync(file, JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: options.scrollHeight },
    documentStyle: { backgroundColor: options.pageBackground || 'rgb(255, 255, 255)' },
    summary: { firstViewportMediaCoverage: 0.62 },
    textBoxes: [],
    mediaBoxes: [renderedMedia],
    meaningfulMediaBoxes: [renderedMedia],
    layoutGroups,
    landmarks,
    evidenceCompleteness: {
      mode: 'full-page',
      status: evidenceComplete ? 'complete' : 'partial',
      complete: evidenceComplete,
      essentialGeometryTruncated: !evidenceComplete,
      reasons: evidenceComplete ? [] : ['landmarks-truncated'],
      categories: {
        landmarks: {
          total: landmarks.length + (evidenceComplete ? 0 : 1),
          retained: landmarks.length,
          truncated: evidenceComplete ? 0 : 1,
          limit: 160,
        },
      },
    },
  }));
}

function genericGeometryReferenceBands() {
  return [
    { tag: 'nav', top: 0, height: 96, width: 1440 },
    { tag: 'section', top: 0, height: 1000, width: 1440 },
    { tag: 'section', top: 1000, height: 700, width: 1440 },
    { tag: 'section', top: 1700, height: 1200, width: 1440 },
    { tag: 'footer', top: 4500, height: 500, width: 1440 },
  ];
}

function genericGeometryCloseCandidateBands() {
  return [
    { tag: 'nav', top: 0, height: 100, width: 1440 },
    { tag: 'section', top: 0, height: 1015, width: 1440 },
    { tag: 'section', top: 1020, height: 710, width: 1400, x: 20 },
    { tag: 'section', top: 1730, height: 1210, width: 1420, x: 10 },
    { tag: 'footer', top: 4560, height: 500, width: 1440 },
  ];
}

function genericGeometryReorderedCandidateBands() {
  return [
    { tag: 'nav', top: 0, height: 96, width: 1440 },
    { tag: 'section', top: 0, height: 1000, width: 1440 },
    { tag: 'section', top: 1000, height: 1200, width: 1440 },
    { tag: 'section', top: 2200, height: 700, width: 1440 },
    { tag: 'footer', top: 4500, height: 500, width: 1440 },
  ];
}

function scaleGeometryBands(bands, factor) {
  return bands.map((band) => ({
    ...band,
    top: band.top * factor,
    height: band.height * factor,
  }));
}

function createBenchmarkFixture(PNG, options) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-visual-benchmark-'));
  const targetPath = path.join(directory, 'target-desktop.png');
  const candidatePath = path.join(directory, 'candidate-desktop.png');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const candidateManifestPath = path.join(directory, 'candidate-manifest.json');
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const imageWidth = Number.isInteger(options.imageWidth) && options.imageWidth > 0 ? options.imageWidth : 1;
  const imageHeight = Number.isInteger(options.imageHeight) && options.imageHeight > 0 ? options.imageHeight : 1;

  writeSolidPng(PNG, targetPath, [255, 255, 255, 255], imageWidth, imageHeight);
  if (options.candidateTexture === true) {
    writeTexturedPng(PNG, candidatePath, imageWidth, imageHeight);
  } else {
    writeSolidPng(PNG, candidatePath, options.candidateColor, imageWidth, imageHeight);
  }

  writeBenchmarkManifest(manifestPath, 'target-desktop.png', options.mediaReference === true, options.caregloMechanics === true, options.maidyMechanics === true, options.optomattaMechanics === true, options.lumenMechanics === true, options.referenceCoverage);
  writeCandidateManifest(candidateManifestPath, 'candidate-desktop.png', options.candidateRenderedMedia !== false, options.caregloMechanics === true, options.maidyMechanics === true, options.optomattaMechanics === true, options.lumenMechanics === true, options.candidateCoverage);
  if (options.caregloMechanics === true) {
    writeCaregloMechanicsLayouts(directory);
  }
  if (options.maidyMechanics === true) {
    writeMaidyMechanicsLayouts(directory);
  }
  if (options.optomattaMechanics === true) {
    writeOptomattaMechanicsLayouts(directory);
  }
  if (options.lumenMechanics === true) {
    writeLumenMechanicsLayouts(directory);
  }
	  fs.writeFileSync(contractPath, JSON.stringify({
	    components: [
	      {
	        name: 'Section',
	        allowedParents: ['ROOT'],
	        props: ['backgroundImage', 'minHeight'],
	        aiProps: ['backgroundImage', 'minHeight'],
	        controls: [
	          { type: 'image', prop: 'backgroundImage' },
	          { type: 'css-value', prop: 'minHeight', units: ['px'] },
	        ],
	      },
	      {
	        name: 'Container',
	        allowedParents: ['Section'],
	        props: ['backgroundImage', 'minHeight'],
	        aiProps: ['backgroundImage', 'minHeight'],
	        controls: [
	          { type: 'image', prop: 'backgroundImage' },
	          { type: 'css-value', prop: 'minHeight', units: ['px'] },
	        ],
	      },
	    ],
	  }));
  fs.writeFileSync(layoutPath, JSON.stringify(layoutFixture(options)));

  return { directory, targetPath, candidatePath, manifestPath, candidateManifestPath, contractPath, layoutPath };
}

function writeBenchmarkManifest(file, screenshotFile, withMediaReference, withCaregloMechanics = false, withMaidyMechanics = false, withOptomattaMechanics = false, withLumenMechanics = false, referenceCoverage = 0.62) {
  const manifest = {
    screenshots: [
      { label: 'desktop', width: 1, height: 1, mode: 'viewport', file: screenshotFile },
    ],
  };
  if (withCaregloMechanics) {
    Object.assign(manifest, caregloManifestFields('target-layout'));
  }
  if (withMaidyMechanics) {
    Object.assign(manifest, maidyManifestFields('target-layout'));
  }
  if (withOptomattaMechanics) {
    Object.assign(manifest, optomattaManifestFields('target-layout'));
  }
  if (withLumenMechanics) {
    Object.assign(manifest, lumenManifestFields('target-layout'));
  }
  if (withMediaReference) {
    Object.assign(manifest, mediaManifestFields('target-layout.json', true, 'reference'));
    writeLayoutSummary(path.join(path.dirname(file), 'target-layout.json'), referenceCoverage);
  }
  fs.writeFileSync(file, JSON.stringify(manifest));
}

function writeCandidateManifest(file, screenshotFile, withRenderedMedia, withCaregloMechanics = false, withMaidyMechanics = false, withOptomattaMechanics = false, withLumenMechanics = false, candidateCoverage = null) {
  const manifest = {
    screenshots: [
      { label: 'desktop', width: 1, height: 1, mode: 'viewport', file: screenshotFile },
    ],
    ...mediaManifestFields('candidate-layout.json', withRenderedMedia, 'candidate'),
  };
  if (withCaregloMechanics) {
    Object.assign(manifest, {
      sourceUrl: 'http://localhost:8190/candidate-careglo/',
      layout: 'candidate-layout.json',
      layouts: layoutEntries('candidate-layout'),
      layoutCapture: {
        status: 'ok',
        file: 'candidate-layout.json',
        error: '',
        layouts: layoutEntries('candidate-layout'),
      },
    });
  }
  if (withMaidyMechanics) {
    Object.assign(manifest, {
      sourceUrl: 'http://localhost:8190/candidate-maidy/',
      layout: 'candidate-layout.json',
      layouts: layoutEntries('candidate-layout'),
      layoutCapture: {
        status: 'ok',
        file: 'candidate-layout.json',
        error: '',
        layouts: layoutEntries('candidate-layout'),
      },
    });
  }
  if (withOptomattaMechanics) {
    Object.assign(manifest, {
      sourceUrl: 'http://localhost:8190/candidate-optomatta/',
      layout: 'candidate-layout.json',
      layouts: layoutEntries('candidate-layout'),
      layoutCapture: {
        status: 'ok',
        file: 'candidate-layout.json',
        error: '',
        layouts: layoutEntries('candidate-layout'),
      },
    });
  }
  if (withLumenMechanics) {
    Object.assign(manifest, {
      sourceUrl: 'http://localhost:8190/candidate-lumen/',
      layout: 'candidate-layout.json',
      layouts: layoutEntries('candidate-layout'),
      layoutCapture: {
        status: 'ok',
        file: 'candidate-layout.json',
        error: '',
        layouts: layoutEntries('candidate-layout'),
      },
    });
  }
  writeLayoutSummary(path.join(path.dirname(file), 'candidate-layout.json'), Number.isFinite(candidateCoverage) ? candidateCoverage : withRenderedMedia ? 0.4 : 0.02);
  fs.writeFileSync(file, JSON.stringify(manifest));
}

function caregloManifestFields(baseName) {
  return {
    sourceUrl: 'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements',
    layout: `${baseName}.json`,
    layouts: layoutEntries(baseName),
    layoutCapture: {
      status: 'ok',
      file: `${baseName}.json`,
      error: '',
      layouts: layoutEntries(baseName),
    },
  };
}

function writeCaregloMobileLongOnlyManifest(file, screenshotFile, layoutFile, sourceUrl = 'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements') {
  const mediaSource = 'https://cdn.example.test/careglo-mobile-long-hero.jpg';
  fs.writeFileSync(file, JSON.stringify({
    sourceUrl,
    screenshots: [
      { label: 'mobile-long', width: 390, height: 1800, mode: 'viewport', file: screenshotFile },
    ],
    media: [mediaSource],
    mediaSurfaces: [
      mediaSurface('hero', mediaSource, 348, 522, 181656),
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
    ],
    layout: layoutFile,
    layouts: [
      { label: 'mobile-long', width: 390, height: 1800, file: layoutFile, status: 'ok', error: '' },
    ],
    layoutCapture: {
      status: 'ok',
      file: layoutFile,
      error: '',
      layouts: [
        { label: 'mobile-long', width: 390, height: 1800, file: layoutFile, status: 'ok', error: '' },
      ],
    },
  }));
}

function writeMobileLongOnlyLayout(file) {
  fs.writeFileSync(file, JSON.stringify({
    viewport: { width: 390, height: 1800, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.18 },
    textBoxes: [
      textBox('Premium detailing for cars that deserve ceremony.', 20, 145, 350, 184),
    ],
    mediaBoxes: [
      mediaBox(21, 1110, 348, 522, 181656, 'https://cdn.example.test/careglo-mobile-long-hero.jpg'),
    ],
  }));
}

function maidyManifestFields(baseName) {
  return {
    sourceUrl: 'https://askproject.net/maidy/home/?storefront=envato-elements',
    layout: `${baseName}.json`,
    layouts: layoutEntries(baseName),
    layoutCapture: {
      status: 'ok',
      file: `${baseName}.json`,
      error: '',
      layouts: layoutEntries(baseName),
    },
  };
}

function optomattaManifestFields(baseName) {
  return {
    sourceUrl: 'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
    layout: `${baseName}.json`,
    layouts: layoutEntries(baseName),
    layoutCapture: {
      status: 'ok',
      file: `${baseName}.json`,
      error: '',
      layouts: layoutEntries(baseName),
    },
  };
}

function lumenManifestFields(baseName) {
  return {
    sourceUrl: 'https://omispace.com/lumen/?storefront=envato-elements',
    layout: `${baseName}.json`,
    layouts: layoutEntries(baseName),
    layoutCapture: {
      status: 'ok',
      file: `${baseName}.json`,
      error: '',
      layouts: layoutEntries(baseName),
    },
  };
}

function layoutEntries(baseName) {
  return [
    { label: 'desktop', width: 1440, height: 1200, file: `${baseName}.json`, status: 'ok', error: '' },
    { label: 'tablet', width: 834, height: 1112, file: `${baseName}-tablet.json`, status: 'ok', error: '' },
    { label: 'mobile', width: 390, height: 844, file: `${baseName}-mobile.json`, status: 'ok', error: '' },
  ];
}

function writeMaidyMechanicsLayouts(directory) {
  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 9618 },
    summary: { firstViewportMediaCoverage: 1 },
    textBoxes: [
      textBox('Contact', 1214, 91, 76, 14),
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 120, 284, 600, 328),
    ],
    mediaBoxes: [
      mediaBox(720, 149, 600, 847, 508200),
      mediaBox(-80, 743, 320, 258, 82560),
    ],
    landmarks: [
      landmarkBox('section', 0, 0, 1440, 49, 'rgb(32, 49, 59)'),
      landmarkBox('section', 0, 996, 1440, 198, 'rgb(32, 49, 59)'),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 2500 },
    summary: { firstViewportMediaCoverage: 0.6 },
    textBoxes: [
      textBox('Contact', 840, 40, 120, 44),
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 120, 220, 600, 120),
    ],
    mediaBoxes: [
      mediaBox(820, 360, 360, 240, 86400),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-tablet.json'), JSON.stringify({
    viewport: { width: 834, height: 1112, scrollHeight: 12554 },
    summary: { firstViewportMediaCoverage: 1 },
    textBoxes: [
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 30, 230, 360, 244),
    ],
    mediaBoxes: [
      mediaBox(0, 57, 834, 784, 654231),
      mediaBox(417, 157, 387, 684, 264708),
    ],
    landmarks: [
      landmarkBox('section', 0, 0, 834, 57, 'rgb(32, 49, 59)'),
      landmarkBox('section', 0, 841, 834, 198, 'rgb(32, 49, 59)'),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-tablet.json'), JSON.stringify({
    viewport: { width: 834, height: 1112, scrollHeight: 2500 },
    summary: { firstViewportMediaCoverage: 0.9 },
    textBoxes: [
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 30, 230, 360, 120),
    ],
    mediaBoxes: [
      mediaBox(0, 148, 834, 1245, 804318, 'https://candidate.example.test/maidy-hero-composite.png'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 17813 },
    summary: { firstViewportMediaCoverage: 1 },
    textBoxes: [
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 20, 196, 350, 244),
    ],
    mediaBoxes: [],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 2500 },
    summary: { firstViewportMediaCoverage: 0.1 },
    textBoxes: [
      textBox('Avoid A Dirty Scene, Keep Your Place Clean & Fresh', 20, 220, 350, 120),
    ],
    mediaBoxes: [],
    landmarks: [],
  }));
}

function writeCaregloMechanicsLayouts(directory) {
  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 8754 },
    summary: { firstViewportMediaCoverage: 0.62 },
    textBoxes: [
      textBox('Home', 345, 18, 80, 51),
      textBox('Make Appointment', 1221, 16, 194, 55),
      textBox('Detailing That Defines True Luxury.', 24, 232, 548, 211),
    ],
    mediaBoxes: [
      mediaBox(620, 183, 796, 814, 648245),
      mediaBox(24, 797, 216, 200, 43120),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 2628 },
    summary: { firstViewportMediaCoverage: 0.4 },
    textBoxes: [
      textBox('Home', 468, 31, 44, 18),
      textBox('Make Appointment', 845, 18, 192, 44),
      textBox('Detailing That Defines True Luxury.', 20, 233, 534, 214),
    ],
    mediaBoxes: [
      mediaBox(618, 176, 802, 778, 624173),
      mediaBox(20, 772, 216, 182, 39312),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 17775 },
    summary: { firstViewportMediaCoverage: 0.01 },
    textBoxes: [
      textBox('Premium detailing for cars that deserve ceremony.', 24, 215, 342, 352),
    ],
    mediaBoxes: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 4516 },
    summary: { firstViewportMediaCoverage: 0.07 },
    textBoxes: [
      textBox('Detailing That Defines True Luxury.', 20, 270, 350, 136),
    ],
    mediaBoxes: [],
  }));
}

function writeCaregloFallbackMechanicsLayouts(directory) {
  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.224 },
    textBoxes: [
      textBox('Services', 680, 42, 42, 10),
      textBox('Make Appointment', 1221, 36, 194, 24),
      textBox('Premium detailing for cars that deserve ceremony.', 52, 350, 420, 184),
    ],
    mediaBoxes: [
      mediaBox(629, 157, 467, 701, 327367),
      mediaBox(1114, 157, 224, 269, 60256),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.224 },
    textBoxes: [
      textBox('Services', 690, 42, 42, 10),
      textBox('Contact', 940, 36, 64, 24),
      textBox('Reserve a Visit', 1242, 36, 174, 24),
      textBox('Premium detailing for cars that deserve ceremony.', 52, 350, 420, 184),
    ],
    mediaBoxes: [
      mediaBox(624, 157, 467, 701, 327367),
      mediaBox(1112, 157, 224, 269, 60256),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-tablet.json'), JSON.stringify({
    viewport: { width: 834, height: 1112, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.459 },
    textBoxes: [
      textBox('Premium detailing for cars that deserve ceremony.', 32, 238, 720, 96),
    ],
    mediaBoxes: [
      mediaBox(32, 504, 770, 520, 400400),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-tablet.json'), JSON.stringify({
    viewport: { width: 834, height: 1112, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.459 },
    textBoxes: [
      textBox('Premium detailing for cars that deserve ceremony.', 32, 238, 720, 96),
    ],
    mediaBoxes: [
      mediaBox(32, 504, 770, 520, 400400),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.311 },
    textBoxes: [
      textBox('Premium detailing for cars that deserve ceremony.', 20, 145, 350, 184),
    ],
    mediaBoxes: [
      mediaBox(21, 550, 348, 522, 102064),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 6817 },
    summary: { firstViewportMediaCoverage: 0.311 },
    textBoxes: [
      textBox('Premium detailing for cars that deserve ceremony.', 20, 145, 350, 184),
    ],
    mediaBoxes: [
      mediaBox(21, 550, 348, 522, 102064),
    ],
  }));
}

function writeOptomattaMechanicsLayouts(directory) {
  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 8755 },
    summary: { firstViewportMediaCoverage: 0.62 },
    textBoxes: [
      textBox('+6221-2002-2012', 1215, 18, 215, 72, 'a'),
      textBox('We secure your eyes with quality glasses', 122, 278, 566, 216, 'h1'),
      textBox('Qualified Doctors', 185, 876, 260, 26, 'h3'),
      textBox('Emergency Care', 612, 876, 260, 26, 'h3'),
      textBox('24 Hours Services', 1038, 876, 260, 26, 'h3'),
    ],
    mediaBoxes: [
      mediaBox(0, 108, 1440, 704, 1013760),
    ],
    landmarks: [
      landmarkBox('section', 0, 0, 1440, 108, 'rgb(255, 255, 255)'),
      landmarkBox('section', 0, 812, 1440, 221, 'rgb(246, 247, 250)'),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 2300 },
    summary: { firstViewportMediaCoverage: 0.36 },
    textBoxes: [
      textBox('Secure clearer vision with precision eyewear.', 120, 260, 560, 92, 'h1'),
      textBox('28 doctors', 120, 840, 260, 26),
      textBox('24h service', 520, 840, 260, 26),
      textBox('4.9 rating', 920, 840, 260, 26),
    ],
    mediaBoxes: [
      mediaBox(720, 260, 520, 320, 166400),
    ],
    landmarks: [
      landmarkBox('section', 0, 0, 1440, 84, 'rgb(255, 255, 255)'),
    ],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 12675 },
    summary: { firstViewportMediaCoverage: 0.58 },
    textBoxes: [
      textBox('We secure your eyes with quality glasses', 24, 171, 200, 152, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(0, 63, 390, 478, 186420),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 2300 },
    summary: { firstViewportMediaCoverage: 0.18 },
    textBoxes: [
      textBox('Secure clearer vision with precision eyewear.', 24, 172, 342, 64, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(20, 120, 350, 180, 63000),
    ],
    landmarks: [],
  }));
}

function writeLumenMechanicsLayouts(directory) {
  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 10151 },
    summary: { firstViewportMediaCoverage: 0.61 },
    textBoxes: [
      textBox('Appointment Now', 1240, 50, 180, 50, 'a'),
      textBox('Eye Care Clinic', 80, 240, 89, 45, 'h1'),
      textBox('See Better.', 329, 200, 628, 144, 'h2'),
      textBox('Live Better.', 529, 324, 636, 144, 'h2'),
      textBox('10K', 80, 828, 101, 87, 'strong'),
      textBox('15', 284, 828, 61, 87, 'strong'),
      textBox('Licensed & Qualified Eye Specialists', 1000, 852, 290, 82, 'h2'),
    ],
    mediaBoxes: [
      mediaBox(190, 357, 440, 530, 233200),
      mediaBox(632, 701, 235, 156, 36619),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 2500 },
    summary: { firstViewportMediaCoverage: 0.34 },
    textBoxes: [
      textBox('Appointment Now', 900, 50, 180, 50, 'a'),
      textBox('See Better. Live Better.', 160, 250, 520, 82, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(760, 300, 320, 220, 70400),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 18796 },
    summary: { firstViewportMediaCoverage: 0.29 },
    textBoxes: [
      textBox('Eye Care Clinic', 20, 140, 350, 20, 'h1'),
      textBox('See Better.', 38, 180, 314, 72, 'h2'),
      textBox('Live Better.', 36, 252, 318, 72, 'h2'),
    ],
    mediaBoxes: [
      mediaBox(20, 814, 350, 232, 10507),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 2500 },
    summary: { firstViewportMediaCoverage: 0.1 },
    textBoxes: [
      textBox('See Better. Live Better.', 20, 180, 350, 64, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(20, 520, 350, 160, 56000),
    ],
    landmarks: [],
  }));
}

function writeLumenCutoutMismatchLayouts(directory) {
  const targetTextBoxes = [
    textBox('Appointment Now', 1240, 50, 180, 50, 'a'),
    textBox('See Better.', 329, 200, 628, 144, 'h1'),
    textBox('Live Better.', 529, 324, 636, 144, 'h1'),
    textBox('10K', 80, 828, 101, 87, 'strong'),
    textBox('15', 284, 828, 61, 87, 'strong'),
    textBox('Licensed & Qualified Eye Specialists', 1000, 852, 290, 82, 'h2'),
  ];
  const candidateTextBoxes = [
    textBox('Appointment Now', 1240, 50, 180, 50, 'a'),
    textBox('See Better.', 329, 200, 628, 144, 'h1'),
    textBox('Live Better.', 529, 324, 636, 144, 'h1'),
    textBox('10K', 80, 828, 101, 87, 'strong'),
    textBox('15', 284, 828, 61, 87, 'strong'),
    textBox('Licensed & Qualified Eye Specialists', 1000, 852, 290, 82, 'h2'),
  ];

  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 10151 },
    summary: { firstViewportMediaCoverage: 0.61 },
    textBoxes: targetTextBoxes,
    mediaBoxes: [
      mediaBox(190, 357, 440, 530, 233200, 'https://reference.example.test/lumen-doctor-cutout.png', 'img'),
      mediaBox(632, 701, 235, 156, 36619, 'https://reference.example.test/lumen-eye-exam.jpg', 'img'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 10151 },
    summary: { firstViewportMediaCoverage: 0.61 },
    textBoxes: candidateTextBoxes,
    mediaBoxes: [
      mediaBox(190, 357, 440, 530, 233200, 'https://candidate.example.test/lumen-doctor-rectangular.jpg', 'div'),
      mediaBox(632, 701, 235, 156, 36619, 'https://candidate.example.test/lumen-eye-exam.jpg', 'div'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 18796 },
    summary: { firstViewportMediaCoverage: 0.29 },
    textBoxes: [
      textBox('See Better.', 38, 180, 314, 72, 'h1'),
      textBox('Live Better.', 36, 252, 318, 72, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(20, 814, 350, 232, 10507, 'https://reference.example.test/lumen-eye-exam.jpg', 'img'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 18796 },
    summary: { firstViewportMediaCoverage: 0.29 },
    textBoxes: [
      textBox('See Better.', 38, 180, 314, 72, 'h1'),
      textBox('Live Better.', 36, 252, 318, 72, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(20, 814, 350, 232, 10507, 'https://candidate.example.test/lumen-eye-exam.jpg', 'div'),
    ],
    landmarks: [],
  }));
}

function writeLumenVerticalRhythmMismatchLayouts(directory) {
  fs.writeFileSync(path.join(directory, 'target-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 10151 },
    summary: { firstViewportMediaCoverage: 0.61 },
    textBoxes: [
      textBox('Appointment Now', 1240, 50, 180, 50, 'a'),
      textBox('See Better.', 329, 200, 628, 144, 'h1'),
      textBox('Live Better.', 529, 324, 636, 144, 'h1'),
      textBox('10K', 80, 828, 101, 87, 'strong'),
      textBox('15', 284, 828, 61, 87, 'strong'),
      textBox('Licensed & Qualified Eye Specialists', 1000, 946, 320, 67, 'h2'),
    ],
    mediaBoxes: [
      mediaBox(190, 357, 440, 530, 233200, 'https://reference.example.test/lumen-doctor-cutout.png', 'img'),
      mediaBox(632, 701, 235, 156, 36619, 'https://reference.example.test/lumen-eye-exam.jpg', 'img'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200, scrollHeight: 10151 },
    summary: { firstViewportMediaCoverage: 0.61 },
    textBoxes: [
      textBox('Appointment Now', 1240, 50, 180, 50, 'a'),
      textBox('See Better.', 295, 174, 650, 104, 'h1'),
      textBox('Live Better.', 501, 278, 664, 117, 'h1'),
      textBox('10K+', 80, 983, 194, 56, 'strong'),
      textBox('15+', 316, 983, 194, 56, 'strong'),
      textBox('Licensed & Qualified Eye Specialists', 1026, 767, 370, 60, 'h2'),
    ],
    mediaBoxes: [
      mediaBox(190, 415, 440, 530, 233200, 'https://candidate.example.test/lumen-doctor-cutout.png', 'img'),
      mediaBox(658, 833, 235, 156, 36619, 'https://candidate.example.test/lumen-eye-exam.jpg', 'img'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'target-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 18796 },
    summary: { firstViewportMediaCoverage: 0.29 },
    textBoxes: [
      textBox('See Better.', 38, 180, 314, 72, 'h1'),
      textBox('Live Better.', 36, 252, 318, 72, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(20, 814, 350, 232, 10507, 'https://reference.example.test/lumen-eye-exam.jpg', 'img'),
    ],
    landmarks: [],
  }));
  fs.writeFileSync(path.join(directory, 'candidate-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844, scrollHeight: 18796 },
    summary: { firstViewportMediaCoverage: 0.29 },
    textBoxes: [
      textBox('See Better.', 38, 180, 314, 72, 'h1'),
      textBox('Live Better.', 36, 252, 318, 72, 'h1'),
    ],
    mediaBoxes: [
      mediaBox(20, 814, 350, 232, 10507, 'https://candidate.example.test/lumen-eye-exam.jpg', 'img'),
    ],
    landmarks: [],
  }));
}

function textBox(text, x, y, width, height, tag = 'span') {
  return {
    tag,
    text,
    rect: { x, y, width, height, top: y, bottom: y + height, left: x, right: x + width },
  };
}

function mediaBox(x, y, width, height, firstViewportArea, source = 'https://cdn.example.test/careglo-photo.jpg', tag = 'div') {
  return {
    tag,
    source,
    rect: { x, y, width, height, top: y, bottom: y + height, left: x, right: x + width },
    firstViewportArea,
  };
}

function landmarkBox(tag, x, y, width, height, backgroundColor) {
  return {
    tag,
    rect: { x, y, width, height, top: y, bottom: y + height, left: x, right: x + width },
    backgroundColor,
  };
}

function mediaManifestFields(layoutFile, withPhotoRoles, prefix) {
  const mediaSurfaces = withPhotoRoles
    ? [
      mediaSurface('hero', `https://cdn.example.test/${prefix}-hero.jpg`, 900, 520, 420000),
      mediaSurface('secondary', `https://cdn.example.test/${prefix}-secondary.jpg`, 280, 190, 53200),
      mediaSurface('service-card', `https://cdn.example.test/${prefix}-service-1.jpg`, 280, 190, 0),
      mediaSurface('service-card', `https://cdn.example.test/${prefix}-service-2.jpg`, 280, 190, 0),
      mediaSurface('service-card', `https://cdn.example.test/${prefix}-service-3.jpg`, 280, 190, 0),
    ]
    : [
      mediaSurface('reference-media', `https://cdn.example.test/${prefix}-logo.png`, 80, 32, 2560),
    ];

  return {
    layout: layoutFile,
    layoutCapture: { status: 'ok', file: layoutFile, error: '' },
    media: mediaSurfaces.map((surface) => surface.source),
    mediaSurfaces,
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'service-card', minSurfaces: 3, placement: 'afterHero' },
    ],
  };
}

function writeLayoutSummary(file, coverage, viewport = null) {
  fs.writeFileSync(file, JSON.stringify({
    ...(viewport ? { viewport } : {}),
    summary: {
      firstViewportMediaCoverage: coverage,
    },
  }));
}

function writeViewportCoverageManifests(directory, referenceManifestPath, candidateManifestPath, options) {
  const referenceMobileLayout = path.join(directory, 'target-layout-mobile.json');
  const candidateMobileLayout = path.join(directory, 'candidate-layout-mobile.json');
  writeLayoutSummary(referenceMobileLayout, options.referenceMobileCoverage);
  writeLayoutSummary(candidateMobileLayout, options.candidateMobileCoverage);
  addLayoutEntries(referenceManifestPath, 'target-layout.json', 'target-layout-mobile.json', 'https://example.test/template-reference');
  addLayoutEntries(candidateManifestPath, 'candidate-layout.json', 'candidate-layout-mobile.json');
}

function addLayoutEntries(manifestPath, desktopLayoutFile, mobileLayoutFile, sourceUrl = '') {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const layoutCapture = manifest.layoutCapture && typeof manifest.layoutCapture === 'object'
    ? manifest.layoutCapture
    : { status: 'ok', file: desktopLayoutFile, error: '' };
  const layouts = [
    { label: 'desktop', width: 1440, height: 1200, file: desktopLayoutFile, status: 'ok', error: '' },
    { label: 'mobile', width: 390, height: 844, file: mobileLayoutFile, status: 'ok', error: '' },
  ];

  fs.writeFileSync(manifestPath, JSON.stringify({
    ...manifest,
    sourceUrl: sourceUrl || manifest.sourceUrl,
    layout: desktopLayoutFile,
    layoutCapture: {
      ...layoutCapture,
      file: desktopLayoutFile,
      layouts,
    },
    layouts,
  }));
}

function mediaSurface(role, source, width, height, firstViewportArea) {
  return {
    role,
    placement: firstViewportArea > 0 ? 'firstViewport' : 'afterHero',
    source,
    width,
    height,
    firstViewportArea,
  };
}

function appendReferenceMediaSurfaces(manifestPath, count) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const mediaSurfaces = Array.isArray(manifest.mediaSurfaces) ? manifest.mediaSurfaces : [];
  const media = Array.isArray(manifest.media) ? manifest.media : [];

  for (let index = 0; index < count; index += 1) {
    const source = `https://cdn.example.test/reference-extra-${index + 1}.jpg`;
    mediaSurfaces.push(mediaSurface('reference-media', source, 360, 260, 0));
    media.push(source);
  }

  fs.writeFileSync(manifestPath, JSON.stringify({
    ...manifest,
    media,
    mediaSurfaces,
  }));
}

function layoutFixture(options) {
	  if (options.mediaReference === true) {
	    return {
	      ROOT: node('RootCanvas', null, ['section-hero', 'section-proof', 'section-services']),
	      'section-hero': {
	        ...node('Section', 'ROOT', ['hero-secondary']),
	        props: {
	          backgroundImage: "url('https://cdn.example.test/layout-hero.jpg')",
	          minHeight: 640,
        },
      },
	      'hero-secondary': {
	        ...node('Container', 'section-hero', []),
	        props: {
	          backgroundImage: "url('https://cdn.example.test/layout-secondary.jpg')",
	          minHeight: 180,
        },
      },
	      'section-proof': {
	        ...node('Section', 'ROOT', []),
	        props: {},
	      },
	      'section-services': node('Section', 'ROOT', ['service-card-1', 'service-card-2', 'service-card-3']),
	      'service-card-1': {
	        ...node('Container', 'section-services', []),
	        props: {
	          backgroundImage: "url('https://cdn.example.test/layout-service-1.jpg')",
	          minHeight: 220,
	        },
	      },
	      'service-card-2': {
	        ...node('Container', 'section-services', []),
	        props: {
	          backgroundImage: "url('https://cdn.example.test/layout-service-2.jpg')",
	          minHeight: 220,
	        },
	      },
	      'service-card-3': {
	        ...node('Container', 'section-services', []),
	        props: {
	          backgroundImage: "url('https://cdn.example.test/layout-service-3.jpg')",
	          minHeight: 220,
	        },
	      },
	    };
	  }

  return {
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', []),
      props: options.blockedProp ? { className: 'not-allowed' } : {},
    },
  };
}

function node(type, parent, nodes) {
  return {
    type: { resolvedName: type },
    isCanvas: nodes.length > 0,
    props: {},
    parent,
    nodes,
    linkedNodes: {},
  };
}

function writeSolidPng(PNG, file, rgba, width = 1, height = 1, rectangles = []) {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = rgba[0];
    image.data[offset + 1] = rgba[1];
    image.data[offset + 2] = rgba[2];
    image.data[offset + 3] = rgba[3];
  }
  for (const item of rectangles) {
    const left = Math.max(0, Math.floor(item.rect.x));
    const top = Math.max(0, Math.floor(item.rect.y));
    const right = Math.min(width, Math.ceil(item.rect.x + item.rect.width));
    const bottom = Math.min(height, Math.ceil(item.rect.y + item.rect.height));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = ((y * width) + x) * 4;
        image.data[offset] = item.color[0];
        image.data[offset + 1] = item.color[1];
        image.data[offset + 2] = item.color[2];
        image.data[offset + 3] = item.color[3];
      }
    }
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}

function writeTexturedPng(PNG, file, width, height) {
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

function rgbaAt(image, x, y) {
  const offset = ((y * image.width) + x) * 4;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ];
}
