#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const compareScript = path.join(root, 'monteby-site-authoring', 'scripts', 'compare-screenshots.js');

test('masked media comparison ignores legal replacement photo pixels inside matching media boxes', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-mask-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeImageWithMediaBox(dependencies.PNG, targetPng, [12, 12, 12, 255], [30, 30, 30, 255]);
  writeImageWithMediaBox(dependencies.PNG, candidatePng, [230, 72, 40, 255], [30, 30, 30, 255]);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  writeLayout(path.join(directory, 'reference-layout.json'));
  writeLayout(path.join(directory, 'candidate-layout.json'));

  const raw = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ]);
  const masked = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--mask-media-boxes',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(masked.status, 0, masked.stderr);
  assert.equal(JSON.parse(raw.stdout).percent > 0, true);
  assert.equal(JSON.parse(masked.stdout).percent, 0);

  writeImageWithMediaBox(dependencies.PNG, candidatePng, [12, 12, 12, 255], [220, 60, 60, 255], 130);
  writeLayout(path.join(directory, 'candidate-layout.json'), 130);
  const shifted = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--mask-text-boxes',
    '--json',
  ]);

  assert.equal(shifted.status, 0, shifted.stderr);
  assert.equal(JSON.parse(shifted.stdout).percent > 0, true);
});

test('paired media content masking accepts replacement photography with full-page scaling and clipping', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-paired-media-full-page-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const mediaRect = { x: 25, y: 350, width: 150, height: 100 };
  const renderedMediaRect = { x: 50, y: 700, width: 300, height: 200 };
  const overlayRect = { x: 55, y: 365, width: 90, height: 22 };

  writeImageWithRectangles(dependencies.PNG, targetPng, [
    { rect: renderedMediaRect, color: [22, 48, 92, 255] },
    { rect: { x: 110, y: 730, width: 180, height: 44 }, color: [12, 12, 12, 255] },
  ], { width: 400, height: 800 });
  writeImageWithRectangles(dependencies.PNG, candidatePng, [
    { rect: renderedMediaRect, color: [230, 92, 42, 255] },
    { rect: { x: 110, y: 730, width: 180, height: 44 }, color: [12, 12, 12, 255] },
  ], { width: 400, height: 800 });
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json', { mode: 'full-page' });
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json', { mode: 'full-page' });
  const layoutOptions = {
    viewport: { width: 200, height: 200, scrollHeight: 450 },
    textBoxes: [{ rect: overlayRect, structureKey: '0.0.2' }],
    interactions: [
      { rect: mediaRect, structureKey: '0.0' },
      { rect: overlayRect, structureKey: '0.0.2' },
    ],
  };
  const targetBox = { source: 'https://reference.example.test/hero.jpg', rect: mediaRect, structureKey: '0.0.1' };
  const candidateBox = { source: 'https://candidate.example.test/replacement-hero.jpg', rect: mediaRect, structureKey: '0.0.1' };
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [targetBox], [targetBox], layoutOptions);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [candidateBox], [candidateBox], layoutOptions);

  const raw = runCompare([
    '--target-manifest', targetManifest,
    '--candidate-manifest', candidateManifest,
    '--json',
  ]);
  const masked = runCompare([
    '--target-manifest', targetManifest,
    '--candidate-manifest', candidateManifest,
    '--mask-paired-media-content',
    '--max-percent', '3',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(masked.status, 0, masked.stderr || masked.stdout);
  const rawReport = JSON.parse(raw.stdout);
  const maskedReport = JSON.parse(masked.stdout);
  assert.ok(rawReport.percent > 6);
  assert.ok(maskedReport.percent > 0, 'the conservative media edge must remain comparable');
  assert.ok(maskedReport.percent < 3);
  assert.equal(maskedReport.results[0].height, 800);
  assert.equal(maskedReport.mediaMask.applied, true);
  assert.equal(maskedReport.mediaMask.pairedBoxes, 1);
  assert.equal(maskedReport.mediaMask.maskedPairs, 1);
});

test('paired media content masking cannot hide full-page height drift inside padded media', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-paired-media-height-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const mediaRect = { x: 40, y: 150, width: 120, height: 100 };
  const targetBox = { source: 'https://reference.example.test/hero.jpg', rect: mediaRect };
  const candidateBox = { source: 'https://candidate.example.test/replacement-hero.jpg', rect: mediaRect };

  writeImageWithRectangles(dependencies.PNG, targetPng, [
    { rect: mediaRect, color: [22, 48, 92, 255] },
  ], { width: 200, height: 300 });
  writeImageWithRectangles(dependencies.PNG, candidatePng, [
    { rect: mediaRect, color: [230, 92, 42, 255] },
  ], { width: 200, height: 200 });
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json', { mode: 'full-page' });
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json', { mode: 'full-page' });
  const layoutOptions = { viewport: { width: 200, height: 200, scrollHeight: 300 } };
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [targetBox], [targetBox], layoutOptions);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [candidateBox], [candidateBox], layoutOptions);

  const result = runCompare([
    '--target-manifest', targetManifest,
    '--candidate-manifest', candidateManifest,
    '--mask-paired-media-content',
    '--pad-to-largest',
    '--pad-background', '#808080',
    '--max-percent', '8',
    '--json',
  ]);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.results[0].padded, true);
  assert.equal(report.mediaMask.applied, true);
  assert.ok(report.percent > 8);
});

test('paired media content masking does not hide shifted, resized, or missing media geometry', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const targetRect = { x: 30, y: 45, width: 120, height: 100 };
  const scenarios = [
    { name: 'shifted', candidateRect: { ...targetRect, x: 60 }, maxPercent: 10, paired: true },
    { name: 'resized', candidateRect: { ...targetRect, width: 110, height: 95 }, maxPercent: 2, paired: true },
    { name: 'missing', candidateRect: null, maxPercent: 10, paired: false },
  ];

  for (const scenario of scenarios) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-compare-paired-media-${scenario.name}-`));
    const targetPng = path.join(directory, 'reference-desktop.png');
    const candidatePng = path.join(directory, 'candidate-desktop.png');
    const targetManifest = path.join(directory, 'reference-manifest.json');
    const candidateManifest = path.join(directory, 'candidate-manifest.json');
    const targetBox = { source: 'https://reference.example.test/hero.jpg', rect: targetRect };
    const candidateBoxes = scenario.candidateRect
      ? [{ source: 'https://candidate.example.test/replacement-hero.jpg', rect: scenario.candidateRect }]
      : [];

    writeImageWithRectangles(dependencies.PNG, targetPng, [
      { rect: targetRect, color: [22, 48, 92, 255] },
    ]);
    writeImageWithRectangles(dependencies.PNG, candidatePng, scenario.candidateRect ? [
      { rect: scenario.candidateRect, color: [230, 92, 42, 255] },
    ] : []);
    writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
    writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
    writeLayout(path.join(directory, 'reference-layout.json'), 20, [targetBox], [targetBox]);
    writeLayout(path.join(directory, 'candidate-layout.json'), 20, candidateBoxes, candidateBoxes);

    const result = runCompare([
      '--target-manifest', targetManifest,
      '--candidate-manifest', candidateManifest,
      '--mask-paired-media-content',
      '--max-percent', String(scenario.maxPercent),
      '--json',
    ]);

    assert.equal(result.status, 1, `${scenario.name}: ${result.stderr || result.stdout}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false, scenario.name);
    assert.equal(report.budgetErrors.some((error) => error.code === 'max_percent_exceeded'), true, scenario.name);
    assert.equal(report.mediaMask.applied, scenario.paired, scenario.name);
    assert.ok(report.percent > scenario.maxPercent, scenario.name);
  }
});

test('paired media content masking keeps surrounding UI and interactive overlays in the diff', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-paired-media-ui-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const mediaRect = { x: 30, y: 45, width: 140, height: 120 };
  const outsideUiRect = { x: 10, y: 10, width: 50, height: 20 };
  const overlayRect = { x: 60, y: 80, width: 65, height: 24 };
  const targetBox = { source: 'https://reference.example.test/hero.jpg', rect: mediaRect };
  const candidateBox = { source: 'https://candidate.example.test/replacement-hero.jpg', rect: mediaRect };

  writeImageWithRectangles(dependencies.PNG, targetPng, [
    { rect: mediaRect, color: [22, 48, 92, 255] },
    { rect: outsideUiRect, color: [18, 18, 18, 255] },
    { rect: overlayRect, color: [15, 15, 15, 255] },
  ]);
  writeImageWithRectangles(dependencies.PNG, candidatePng, [
    { rect: mediaRect, color: [230, 92, 42, 255] },
    { rect: outsideUiRect, color: [190, 30, 30, 255] },
    { rect: overlayRect, color: [35, 180, 80, 255] },
  ]);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  const layoutOptions = {
    textBoxes: [{ rect: overlayRect }],
    interactions: [{ rect: overlayRect }],
  };
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [targetBox], [targetBox], layoutOptions);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [candidateBox], [candidateBox], layoutOptions);

  const result = runCompare([
    '--target-manifest', targetManifest,
    '--candidate-manifest', candidateManifest,
    '--mask-paired-media-content',
    '--max-percent', '5',
    '--json',
  ]);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mediaMask.applied, true);
  assert.ok(report.mismatched >= (outsideUiRect.width * outsideUiRect.height) + (overlayRect.width * overlayRect.height));
  assert.ok(report.percent > 5);
});

test('paired media content masking preserves prior pixel comparison when layout evidence is absent', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-paired-media-no-evidence-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeImageWithRectangles(dependencies.PNG, targetPng, [
    { rect: { x: 30, y: 45, width: 140, height: 120 }, color: [22, 48, 92, 255] },
  ]);
  writeImageWithRectangles(dependencies.PNG, candidatePng, [
    { rect: { x: 30, y: 45, width: 140, height: 120 }, color: [230, 92, 42, 255] },
  ]);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [], []);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [], []);

  const raw = runCompare([
    '--target-manifest', targetManifest,
    '--candidate-manifest', candidateManifest,
    '--json',
  ]);
  const mediaAware = runCompare([
    '--target-manifest', targetManifest,
    '--candidate-manifest', candidateManifest,
    '--mask-paired-media-content',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(mediaAware.status, 0, mediaAware.stderr);
  const rawReport = JSON.parse(raw.stdout);
  const mediaAwareReport = JSON.parse(mediaAware.stdout);
  assert.equal(mediaAwareReport.mismatched, rawReport.mismatched);
  assert.equal(mediaAwareReport.percent, rawReport.percent);
  assert.equal(mediaAwareReport.mediaMask.applied, false);
  assert.equal(mediaAwareReport.mediaMask.viewports[0].reason, 'media-box-evidence-missing');
});

test('masked text comparison ignores replacement glyph pixels while retaining text box geometry', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-text-mask-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeImageWithMediaBox(dependencies.PNG, targetPng, [12, 12, 12, 255], [20, 20, 20, 255]);
  writeImageWithMediaBox(dependencies.PNG, candidatePng, [12, 12, 12, 255], [220, 60, 60, 255]);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  writeLayout(path.join(directory, 'reference-layout.json'));
  writeLayout(path.join(directory, 'candidate-layout.json'));

  const raw = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ]);
  const masked = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--mask-text-boxes',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(masked.status, 0, masked.stderr);
  assert.equal(JSON.parse(raw.stdout).percent > 0, true);
  assert.equal(JSON.parse(masked.stdout).percent, 0);
});

test('media masking leaves decorative backgrounds visible while masking meaningful photos', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-meaningful-mask-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const decorativeBox = {
    source: 'https://cdn.example.test/bg_35.png',
    rect: { x: 0, y: 0, width: 200, height: 200 },
  };
  const photoBox = {
    source: 'https://cdn.example.test/cleaner-at-work.webp',
    rect: { x: 0, y: 40, width: 170, height: 130 },
    paintedRect: { x: 30, y: 40, width: 140, height: 130 },
  };

  writeImageWithMediaBox(dependencies.PNG, targetPng, [12, 12, 12, 255], [30, 30, 30, 255], 20, [20, 120, 20, 255]);
  writeImageWithMediaBox(dependencies.PNG, candidatePng, [230, 72, 40, 255], [30, 30, 30, 255], 20, [220, 230, 220, 255]);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [decorativeBox, photoBox], [photoBox]);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [decorativeBox, photoBox], [photoBox]);

  const raw = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ]);
  const masked = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--mask-media-boxes',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(masked.status, 0, masked.stderr);
  assert.equal(JSON.parse(raw.stdout).percent, 95);
  assert.equal(JSON.parse(masked.stdout).percent, 49.5);
});

test('painted background mask aligns with a negatively offset reference image', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-painted-alignment-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const visibleMediaRect = { x: 0, y: 40, width: 140, height: 130 };
  const targetPhotoBox = {
    source: 'https://cdn.example.test/reference-vacuum.png',
    rect: { x: -30, y: 40, width: 170, height: 130 },
  };
  const candidatePhotoBox = {
    source: 'https://cdn.example.test/replacement-vacuum.png',
    rect: { x: 0, y: 40, width: 170, height: 130 },
    paintedRect: visibleMediaRect,
  };

  writeImageWithMediaBox(dependencies.PNG, targetPng, [12, 12, 12, 255], [30, 30, 30, 255], 20, [255, 255, 255, 255], visibleMediaRect);
  writeImageWithMediaBox(dependencies.PNG, candidatePng, [230, 72, 40, 255], [30, 30, 30, 255], 20, [255, 255, 255, 255], visibleMediaRect);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [targetPhotoBox], [targetPhotoBox]);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [candidatePhotoBox], [candidatePhotoBox]);

  const raw = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ]);
  const masked = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--mask-media-boxes',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(masked.status, 0, masked.stderr);
  assert.equal(JSON.parse(raw.stdout).percent > 0, true);
  assert.equal(JSON.parse(masked.stdout).percent, 0);
});

test('identity media masking ignores replacement pixels at matching raw media geometry', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-identity-mask-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const rect = { x: 30, y: 40, width: 90, height: 50 };

  writeImageWithRectangles(dependencies.PNG, targetPng, [{ rect, color: [22, 42, 82, 255] }]);
  writeImageWithRectangles(dependencies.PNG, candidatePng, [{ rect, color: [220, 90, 50, 255] }]);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
  writeLayout(path.join(directory, 'reference-layout.json'), 20, [
    { source: 'https://reference.example.test/client-logo.png', rect },
  ], []);
  writeLayout(path.join(directory, 'candidate-layout.json'), 20, [
    { source: 'https://candidate.example.test/replacement-partner-brand.png', rect },
  ], []);

  const raw = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ]);
  const masked = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--mask-identity-media',
    '--json',
  ]);

  assert.equal(raw.status, 0, raw.stderr);
  assert.equal(masked.status, 0, masked.stderr);
  assert.equal(JSON.parse(raw.stdout).percent > 0, true);
  assert.equal(JSON.parse(masked.stdout).percent, 0);
});

test('identity media masking retains shifted, resized, missing, extra, and decorative differences', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const baseRect = { x: 30, y: 50, width: 70, height: 45 };
  const scenarios = [
    {
      name: 'shifted',
      targetBoxes: [{ source: 'https://reference.example.test/site-logo.png', rect: baseRect }],
      candidateBoxes: [{ source: 'https://candidate.example.test/site-brand.png', rect: { ...baseRect, x: 42 } }],
      targetRectangles: [{ rect: baseRect, color: [25, 45, 75, 255] }],
      candidateRectangles: [{ rect: { ...baseRect, x: 42 }, color: [220, 90, 50, 255] }],
      paired: true,
    },
    {
      name: 'resized',
      targetBoxes: [{ source: 'https://reference.example.test/rating-badge.png', rect: baseRect }],
      candidateBoxes: [{ source: 'https://candidate.example.test/rating-badge.png', rect: { ...baseRect, width: 92, height: 58 } }],
      targetRectangles: [{ rect: baseRect, color: [25, 45, 75, 255] }],
      candidateRectangles: [{ rect: { ...baseRect, width: 92, height: 58 }, color: [220, 90, 50, 255] }],
      paired: true,
    },
    {
      name: 'missing',
      targetBoxes: [{ source: 'https://reference.example.test/customer-avatar.png', rect: baseRect }],
      candidateBoxes: [],
      targetRectangles: [{ rect: baseRect, color: [25, 45, 75, 255] }],
      candidateRectangles: [],
      paired: false,
    },
    {
      name: 'extra',
      targetBoxes: [],
      candidateBoxes: [{ source: 'https://candidate.example.test/partner-4.png', rect: baseRect }],
      targetRectangles: [],
      candidateRectangles: [{ rect: baseRect, color: [220, 90, 50, 255] }],
      paired: false,
    },
    {
      name: 'decorative',
      targetBoxes: [{ source: 'https://reference.example.test/brand-pattern.png', rect: baseRect }],
      candidateBoxes: [{ source: 'https://candidate.example.test/brand-pattern.png', rect: baseRect }],
      targetRectangles: [{ rect: baseRect, color: [25, 45, 75, 255] }],
      candidateRectangles: [{ rect: baseRect, color: [220, 90, 50, 255] }],
      paired: false,
    },
  ];

  for (const scenario of scenarios) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-compare-identity-${scenario.name}-`));
    const targetPng = path.join(directory, 'reference-desktop.png');
    const candidatePng = path.join(directory, 'candidate-desktop.png');
    const targetManifest = path.join(directory, 'reference-manifest.json');
    const candidateManifest = path.join(directory, 'candidate-manifest.json');

    writeImageWithRectangles(dependencies.PNG, targetPng, scenario.targetRectangles);
    writeImageWithRectangles(dependencies.PNG, candidatePng, scenario.candidateRectangles);
    writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json');
    writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json');
    writeLayout(path.join(directory, 'reference-layout.json'), 20, scenario.targetBoxes, []);
    writeLayout(path.join(directory, 'candidate-layout.json'), 20, scenario.candidateBoxes, []);

    const raw = runCompare([
      '--target-manifest',
      targetManifest,
      '--candidate-manifest',
      candidateManifest,
      '--json',
    ]);
    const masked = runCompare([
      '--target-manifest',
      targetManifest,
      '--candidate-manifest',
      candidateManifest,
      '--mask-identity-media',
      '--json',
    ]);

    assert.equal(raw.status, 0, `${scenario.name}: ${raw.stderr}`);
    assert.equal(masked.status, 0, `${scenario.name}: ${masked.stderr}`);
    const rawPercent = JSON.parse(raw.stdout).percent;
    const maskedPercent = JSON.parse(masked.stdout).percent;
    assert.equal(maskedPercent > 0, true, `${scenario.name} geometry should remain measurable`);
    assert.equal(scenario.paired ? maskedPercent < rawPercent : maskedPercent === rawPercent, true, scenario.name);
  }
});

test('manifest comparison rejects viewport and full-page mode mismatches', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-mode-mismatch-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeImageWithRectangles(dependencies.PNG, targetPng, []);
  writeImageWithRectangles(dependencies.PNG, candidatePng, []);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json', { mode: 'full-page' });
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json', { mode: 'viewport' });

  const result = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--pad-to-largest',
    '--json',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Screenshot mode mismatch.*target full-page, candidate viewport/);
});

test('manifest comparison rejects incompatible viewport widths before padding', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-width-mismatch-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeImageWithRectangles(dependencies.PNG, targetPng, []);
  writeImageWithRectangles(dependencies.PNG, candidatePng, []);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json', { width: 200 });
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json', { width: 220 });

  const result = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--pad-to-largest',
    '--json',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Screenshot viewport width mismatch.*target 200px, candidate 220px/);
});

test('manifest comparison rejects incompatible viewport heights before padding', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-height-mismatch-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeImageWithRectangles(dependencies.PNG, targetPng, []);
  writeImageWithRectangles(dependencies.PNG, candidatePng, []);
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json', { height: 200 });
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json', { height: 240 });

  const result = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--pad-to-largest',
    '--json',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Screenshot viewport height mismatch.*target 200px, candidate 240px/);
});

test('full-page manifest comparison scores differences below the declared viewport height', (context) => {
  const dependencies = loadImageDependencies();
  if (!dependencies) {
    context.skip('pngjs is not installed in this checkout');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-compare-full-page-depth-'));
  const targetPng = path.join(directory, 'reference-desktop.png');
  const candidatePng = path.join(directory, 'candidate-desktop.png');
  const targetManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  const belowFoldRect = { x: 40, y: 300, width: 80, height: 50 };

  writeImageWithRectangles(dependencies.PNG, targetPng, [], { height: 400 });
  writeImageWithRectangles(dependencies.PNG, candidatePng, [
    { rect: belowFoldRect, color: [25, 45, 75, 255] },
  ], { height: 400 });
  writeManifest(targetManifest, 'reference-desktop.png', 'reference-layout.json', { mode: 'full-page', height: 200 });
  writeManifest(candidateManifest, 'candidate-desktop.png', 'candidate-layout.json', { mode: 'full-page', height: 200 });

  const result = runCompare([
    '--target-manifest',
    targetManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.results[0].height, 400);
  assert.equal(report.results[0].mismatched, belowFoldRect.width * belowFoldRect.height);
  assert.equal(report.percent > 0, true);
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

function runCompare(args) {
  return spawnSync(process.execPath, [compareScript, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function writeImageWithMediaBox(
  PNG,
  file,
  mediaColor,
  textColor,
  textX = 20,
  backgroundColor = [255, 255, 255, 255],
  mediaRect = { x: 30, y: 40, width: 140, height: 130 }
) {
  const image = new PNG({ width: 200, height: 200 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = backgroundColor[0];
    image.data[offset + 1] = backgroundColor[1];
    image.data[offset + 2] = backgroundColor[2];
    image.data[offset + 3] = backgroundColor[3];
  }

  for (let y = mediaRect.y; y < mediaRect.y + mediaRect.height; y += 1) {
    for (let x = mediaRect.x; x < mediaRect.x + mediaRect.width; x += 1) {
      const offset = ((y * image.width) + x) * 4;
      image.data[offset] = mediaColor[0];
      image.data[offset + 1] = mediaColor[1];
      image.data[offset + 2] = mediaColor[2];
      image.data[offset + 3] = mediaColor[3];
    }
  }

  for (let y = 10; y < 30; y += 1) {
    for (let x = textX; x < Math.min(image.width, textX + 100); x += 1) {
      const offset = ((y * image.width) + x) * 4;
      image.data[offset] = textColor[0];
      image.data[offset + 1] = textColor[1];
      image.data[offset + 2] = textColor[2];
      image.data[offset + 3] = textColor[3];
    }
  }

  fs.writeFileSync(file, PNG.sync.write(image));
}

function writeManifest(file, screenshotFile, layoutFile, options = {}) {
  const label = options.label || 'desktop';
  const width = options.width || 200;
  const height = options.height || 200;
  fs.writeFileSync(file, JSON.stringify({
    screenshots: [
      { label, width, height, mode: options.mode || 'viewport', file: screenshotFile },
    ],
    layout: layoutFile,
    layouts: [
      { label, width, height, file: layoutFile, status: 'ok', error: '' },
    ],
  }));
}

function writeImageWithRectangles(PNG, file, rectangles, options = {}) {
  const width = options.width || 200;
  const height = options.height || 200;
  const backgroundColor = options.backgroundColor || [255, 255, 255, 255];
  const image = new PNG({ width, height });

  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = backgroundColor[0];
    image.data[offset + 1] = backgroundColor[1];
    image.data[offset + 2] = backgroundColor[2];
    image.data[offset + 3] = backgroundColor[3];
  }

  for (const item of rectangles) {
    const left = Math.max(0, Math.floor(item.rect.x));
    const top = Math.max(0, Math.floor(item.rect.y));
    const right = Math.min(width, Math.ceil(item.rect.x + item.rect.width));
    const bottom = Math.min(height, Math.ceil(item.rect.y + item.rect.height));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = ((y * image.width) + x) * 4;
        image.data[offset] = item.color[0];
        image.data[offset + 1] = item.color[1];
        image.data[offset + 2] = item.color[2];
        image.data[offset + 3] = item.color[3];
      }
    }
  }

  fs.writeFileSync(file, PNG.sync.write(image));
}

function writeLayout(file, textX = 20, mediaBoxes = null, meaningfulMediaBoxes = null, options = {}) {
  const layout = {
    viewport: options.viewport || {
      width: 200,
      height: 200,
      scrollHeight: 200,
    },
    mediaBoxes: Array.isArray(mediaBoxes) ? mediaBoxes : [
      {
        rect: {
          x: 30,
          y: 40,
          width: 140,
          height: 130,
        },
      },
    ],
    textBoxes: Array.isArray(options.textBoxes) ? options.textBoxes : [
      {
        rect: {
          x: textX,
          y: 10,
          width: 100,
          height: 20,
        },
      },
    ],
    interactions: Array.isArray(options.interactions) ? options.interactions : [],
    layoutGroups: Array.isArray(options.layoutGroups) ? options.layoutGroups : [],
  };
  if (Array.isArray(meaningfulMediaBoxes)) {
    layout.meaningfulMediaBoxes = meaningfulMediaBoxes;
  }
  fs.writeFileSync(file, JSON.stringify(layout));
}
