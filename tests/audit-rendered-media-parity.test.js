#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'monteby-site-authoring', 'scripts', 'audit-rendered-media-parity.js');

test('rendered media parity passes when candidate preserves required roles and coverage', () => {
  const fixture = createFixture({
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/candidate-hero.jpg', 900, 520, 420000),
      surface('service-card', 'https://cdn.example.test/candidate-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.35,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.stats.candidateRoleCounts, {
    hero: 1,
    'service-card': 3,
  });
  assert.equal(report.errors.length, 0);
});

test('rendered media parity accepts a reference that has no photographic roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-rendered-media-parity-text-only-'));
  const referenceManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');
  writeManifest(referenceManifest, 'reference-layout.json', [], 0, [], 'https://example.test/text-only');
  writeManifest(candidateManifest, 'candidate-layout.json', [], 0, [], 'https://candidate.example.test/text-only');

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    referenceManifest,
    '--candidate-manifest',
    candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.requiredRoles, 0);
  assert.deepEqual(report.errors, []);
});

test('rendered media parity prefers semantic manifest coverage over raw decorative layout coverage', () => {
  const fixture = createFixture({
    referenceManifestCoverage: 0.16,
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/candidate-hero.png', 440, 530, 233200),
      surface('secondary', 'https://cdn.example.test/candidate-mini.jpg', 235, 156, 36660),
      surface('service-card', 'https://cdn.example.test/candidate-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.16,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.referenceFirstViewportMediaCoverage, 0.16);
  assert.equal(report.stats.minimumCandidateFirstViewportMediaCoverage, 0.12);
});

test('rendered media parity fails strict viewport coverage when mobile loses visible photography', () => {
  const fixture = createFixture({
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/candidate-hero.jpg', 900, 520, 420000),
      surface('service-card', 'https://cdn.example.test/candidate-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.35,
    referenceMobileCoverage: 0.82,
    candidateMobileCoverage: 0.08,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--require-viewport-coverage',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.viewportCoverage.length, 2);
  assert.deepEqual(report.stats.viewportCoverage.map((item) => item.label), ['desktop', 'mobile']);
  assert.equal(report.stats.viewportCoverage.find((item) => item.label === 'mobile').enforced, true);
  assert.equal(report.errors.some((item) => item.code === 'viewport_media_coverage_drop'), true);
  assert.match(report.errors.map((item) => item.message).join(' '), /mobile/);
});

test('rendered media parity reports non-strict viewport coverage loss as advisory', () => {
  const fixture = createFixture({
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/candidate-hero.jpg', 900, 520, 420000),
      surface('service-card', 'https://cdn.example.test/candidate-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.35,
    referenceMobileCoverage: 0.82,
    candidateMobileCoverage: 0.08,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const mobileCoverage = report.stats.viewportCoverage.find((item) => item.label === 'mobile');
  assert.equal(report.ok, true);
  assert.equal(mobileCoverage.enforced, false);
  assert.equal(mobileCoverage.error, null);
  assert.equal(mobileCoverage.warning.code, 'viewport_media_coverage_drop');
  assert.equal(report.warnings.some((item) => item.code === 'viewport_media_coverage_drop'), true);
});

test('rendered media parity does not require photo coverage for logo-only viewports', () => {
  const fixture = createFixture({
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/candidate-hero.jpg', 900, 520, 420000),
      surface('service-card', 'https://cdn.example.test/candidate-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.35,
    referenceMobileCoverage: 0.007,
    candidateMobileCoverage: 0,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--require-viewport-coverage',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const mobileCoverage = report.stats.viewportCoverage.find((item) => item.label === 'mobile');
  assert.equal(report.ok, true);
  assert.equal(mobileCoverage.enforced, false);
  assert.equal(mobileCoverage.minimumCoverage, 0);
  assert.equal(mobileCoverage.warning.code, 'viewport_reference_coverage_below_photo_floor');
  assert.equal(report.warnings.some((item) => item.code === 'viewport_reference_coverage_below_photo_floor'), true);
});

test('rendered media parity fails when candidate loses rendered photo roles', () => {
  const fixture = createFixture({
    candidateSurfaces: [
      surface('reference-media', 'https://cdn.example.test/candidate-logo.png', 80, 32, 2560),
    ],
    candidateCoverage: 0.02,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((item) => item.code), [
    'missing_rendered_media_role',
    'missing_rendered_media_role',
    'first_viewport_media_coverage_drop',
  ]);
  assert.match(report.errors.map((item) => item.message).join(' '), /service-card/);
});

test('rendered media parity fails when candidate reuses captured reference assets', () => {
  const fixture = createFixture({
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/reference-hero.jpg', 900, 520, 420000),
      surface('service-card', 'https://cdn.example.test/candidate-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/candidate-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.35,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.errors[0].code, 'reused_reference_media');
});

test('rendered media parity allows generated target media reuse', () => {
  const fixture = createFixture({
    referenceSourceUrl: '',
    candidateSurfaces: [
      surface('hero', 'https://cdn.example.test/reference-hero.jpg', 900, 520, 420000),
      surface('service-card', 'https://cdn.example.test/reference-service-1.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/reference-service-2.jpg', 280, 190, 0),
      surface('service-card', 'https://cdn.example.test/reference-service-3.jpg', 280, 190, 0),
    ],
    candidateCoverage: 0.35,
  });

  const result = spawnSync(process.execPath, [
    script,
    '--reference-manifest',
    fixture.referenceManifest,
    '--candidate-manifest',
    fixture.candidateManifest,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.reusedReferenceMedia, 0);
});

function createFixture(options) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-rendered-media-parity-'));
  const referenceManifest = path.join(directory, 'reference-manifest.json');
  const candidateManifest = path.join(directory, 'candidate-manifest.json');

  writeManifest(referenceManifest, 'reference-layout.json', [
    surface('hero', 'https://cdn.example.test/reference-hero.jpg', 900, 520, 420000),
    surface('service-card', 'https://cdn.example.test/reference-service-1.jpg', 280, 190, 0),
    surface('service-card', 'https://cdn.example.test/reference-service-2.jpg', 280, 190, 0),
    surface('service-card', 'https://cdn.example.test/reference-service-3.jpg', 280, 190, 0),
  ], 0.62, [
    { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
    { role: 'service-card', minSurfaces: 3, placement: 'afterHero' },
  ], options.referenceSourceUrl === undefined ? 'https://example.test/page' : options.referenceSourceUrl, options.referenceManifestCoverage, options.referenceMobileCoverage);
  writeManifest(candidateManifest, 'candidate-layout.json', options.candidateSurfaces, options.candidateCoverage, [], 'https://candidate.example.test/page', null, options.candidateMobileCoverage);

  return { directory, referenceManifest, candidateManifest };
}

function writeManifest(file, layoutFile, mediaSurfaces, coverage, requiredMediaRoles, sourceUrl = 'https://example.test/page', manifestCoverage = null, mobileCoverage = null) {
  const directory = path.dirname(file);
  fs.writeFileSync(path.join(directory, layoutFile), JSON.stringify({
    summary: {
      firstViewportMediaCoverage: coverage,
    },
  }, null, 2));
  const layoutEntries = [
    { label: 'desktop', width: 1440, height: 1200, file: layoutFile, status: 'ok', error: '' },
  ];
  if (Number.isFinite(mobileCoverage)) {
    const mobileLayoutFile = layoutFile.replace(/\.json$/, '-mobile.json');
    fs.writeFileSync(path.join(directory, mobileLayoutFile), JSON.stringify({
      summary: {
        firstViewportMediaCoverage: mobileCoverage,
      },
    }, null, 2));
    layoutEntries.push({ label: 'mobile', width: 390, height: 844, file: mobileLayoutFile, status: 'ok', error: '' });
  }
  const manifest = {
    sourceUrl,
    layout: layoutFile,
    layoutCapture: { status: 'ok', file: layoutFile, error: '', layouts: layoutEntries },
    screenshots: [
      { label: 'desktop', file: 'desktop.png' },
    ],
    media: mediaSurfaces.map((item) => item.source),
    mediaSurfaces,
    requiredMediaRoles,
  };
  if (Number.isFinite(manifestCoverage)) {
    manifest.firstViewportMediaCoverage = manifestCoverage;
  }
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
}

function surface(role, source, width, height, firstViewportArea) {
  return {
    role,
    placement: firstViewportArea > 0 ? 'firstViewport' : 'afterHero',
    source,
    width,
    height,
    firstViewportArea,
  };
}
