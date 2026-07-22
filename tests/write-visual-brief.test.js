#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const briefScript = path.join(root, 'monteby-site-authoring', 'scripts', 'write-visual-brief.js');

test('visual brief extracts target hierarchy, media roles, and visual tokens', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-visual-brief-'));
  const manifestPath = path.join(directory, 'target-manifest.json');
  const htmlPath = path.join(directory, 'target.html');
  const layoutPath = path.join(directory, 'target-layout.json');
  const mobileLayoutPath = path.join(directory, 'target-layout-mobile.json');
  const markdownPath = path.join(directory, 'VISUAL-BRIEF.md');

  fs.writeFileSync(manifestPath, JSON.stringify({
    seed: 'brief-seed',
    variant: 'marketplace-service',
    archetype: 'brief-archetype',
    referenceStyle: 'brief-style',
    palette: 'brief-palette',
    sourceOwnership: 'generated',
    preserveSourceText: true,
    reuseSourceMedia: true,
    interactionPattern: {
      type: 'tabs',
      itemCount: 5,
      defaultActiveTab: 2,
      orientation: 'vertical',
      mobileTabLayout: 'scroll',
    },
    tabs: [
      {
        labelPrefix: '01',
        label: '<strong>First room</strong>',
        labelSuffix: '18:00',
        eyebrow: '18:00 · Hall A',
        title: 'A clear first chapter',
        content: 'A concise panel body.',
        image: 'https://images.unsplash.com/photo-room',
        imageAlt: 'Guests in the first room',
        ctaLabel: 'Reserve this part',
        ctaUrl: '#reserve',
      },
    ],
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, file: 'target-desktop.png' },
    ],
    layout: 'target-layout.json',
	    layoutCapture: {
	      status: 'ok',
	      file: 'target-layout.json',
	      error: '',
	    },
	    firstViewportMediaCoverage: 0.18,
	    layouts: [
      { label: 'desktop', width: 1440, height: 1200, file: 'target-layout.json', status: 'ok', error: '' },
      { label: 'mobile', width: 390, height: 844, file: 'target-layout-mobile.json', status: 'ok', error: '' },
    ],
    mediaSurfaces: [
      { role: 'hero', placement: 'firstViewport', source: 'https://images.unsplash.com/photo-hero' },
      { role: 'secondary', placement: 'firstViewport', source: 'https://images.unsplash.com/photo-detail' },
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
    ],
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    viewport: {
      width: 1440,
      height: 1200,
      scrollHeight: 2400,
    },
    textBoxes: [
      {
        tag: 'h1',
        text: 'Build a precise Monteby page',
        rect: { x: 96, y: 180, width: 620, height: 148, top: 180 },
        fontSize: '72px',
        fontWeight: '800',
      },
    ],
    mediaBoxes: [
      {
        tag: 'section',
        source: 'https://images.unsplash.com/photo-hero',
        rect: { x: 720, y: 120, width: 620, height: 640, top: 120 },
        firstViewportArea: 396800,
        objectFit: 'fill',
        backgroundSize: 'cover',
      },
    ],
    summary: {
      firstViewportTextBoxes: 4,
      firstViewportMediaBoxes: 1,
      firstViewportMediaCoverage: 0.28,
      largestMediaArea: 396800,
    },
  }));
  fs.writeFileSync(mobileLayoutPath, JSON.stringify({
    viewport: {
      width: 390,
      height: 844,
      scrollHeight: 1800,
    },
    textBoxes: [],
    mediaBoxes: [
      {
        tag: 'img',
        source: 'https://images.unsplash.com/photo-mobile',
        rect: { x: 20, y: 320, width: 350, height: 280, top: 320 },
        firstViewportArea: 98000,
      },
    ],
    summary: {
      firstViewportTextBoxes: 2,
      firstViewportMediaBoxes: 1,
      firstViewportMediaCoverage: 0.3,
      largestMediaArea: 98000,
    },
  }));
  fs.writeFileSync(htmlPath, `<!doctype html>
<html>
<head>
  <title>Brief Target</title>
  <style>
    :root { --bg: #fff; --ink: #111; --accent: #f5b14c; }
    body { font-family: Inter, sans-serif; background: var(--bg); }
  </style>
</head>
<body>
  <nav class="nav topbar"><a href="#">Home</a><a href="#">Contact</a></nav>
  <section class="hero split"><h1>Build a precise Monteby page</h1><p>Hero copy.</p><a href="#">Book now</a></section>
  <section class="service-strip"><h2>Services</h2><article><h3>Detailing</h3><strong>4.9</strong><span>rating</span></article></section>
</body>
</html>`);

  const result = spawnSync(process.execPath, [
    briefScript,
    '--target-dir',
    directory,
    '--out',
    markdownPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.target.variant, 'marketplace-service');
  assert.equal(report.target.sourceOwnership, 'generated');
  assert.deepEqual(report.target.interactionPattern, {
    type: 'tabs',
    itemCount: 5,
    defaultActiveTab: 2,
    orientation: 'vertical',
    mobileTabLayout: 'scroll',
  });
  assert.deepEqual(report.target.tabs, [{
    labelPrefix: '01',
    label: 'First room',
    labelSuffix: '18:00',
    eyebrow: '18:00 · Hall A',
    title: 'A clear first chapter',
    content: 'A concise panel body.',
    image: 'https://images.unsplash.com/photo-room',
    imageAlt: 'Guests in the first room',
    ctaLabel: 'Reserve this part',
    ctaUrl: '#reserve',
  }]);
  assert.equal(report.text.h1[0], 'Build a precise Monteby page');
  assert.deepEqual(report.text.ctas, ['Home', 'Contact', 'Book now']);
  assert.equal(report.visualSignals.rootVariables['--accent'], '#f5b14c');
  assert.equal(report.visualSignals.bodyFontFamily, 'Inter, sans-serif');
  assert.equal(report.media.surfaces.length, 2);
  assert.equal(report.renderedLayout.status, 'ok');
  assert.equal(report.renderedLayout.label, 'desktop');
  assert.equal(report.renderedLayouts.length, 2);
  assert.equal(report.renderedLayouts[1].label, 'mobile');
  assert.equal(report.renderedLayout.summary.firstViewportMediaCoverage, 0.28);
  assert.equal(report.renderedLayout.textSamples[0].rect.width, 620);
	  assert.deepEqual(report.authoringRequirements.requiredMediaRoles.map((role) => role.role), ['hero']);
	  assert.equal(report.authoringRequirements.firstViewportMediaCoverage.target, 0.18);
	  assert.equal(report.authoringRequirements.firstViewportMediaCoverage.minimumCandidate, 0.12);
  assert.equal(report.authoringRequirements.viewportTargets.length, 2);
  assert.equal(report.authoringRequirements.viewportTargets[1].firstViewportMediaCoverage, 0.3);
  assert.equal(report.authoringRequirements.priorityMediaSamples[0].firstViewportArea, 396800);
  assert.equal(report.authoringRequirements.preserveSourceText, true);
  assert.equal(report.authoringRequirements.reuseSourceMedia, true);
  assert.equal(fs.existsSync(markdownPath), true);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /Monteby Visual Authoring Brief/);
  assert.match(markdown, /hero \/ firstViewport/);
  assert.match(markdown, /Rendered Layout Snapshot/);
  assert.match(markdown, /Viewport Snapshot Summaries/);
  assert.match(markdown, /mobile: 390x844, media coverage 30%/);
  assert.match(markdown, /Monteby Authoring Requirements/);
	  assert.match(markdown, /Candidate minimum media coverage: 12%/);
  assert.match(markdown, /hero: 1 replacement surface\(s\), placement firstViewport/);
	  assert.match(markdown, /declared media may be reused/);
  assert.match(markdown, /First-viewport media coverage: 28%/);
  assert.match(markdown, /Build a precise Monteby page/);
});

test('visual brief requires a target manifest or target directory', () => {
  const result = spawnSync(process.execPath, [
    briefScript,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--target-dir or --manifest is required/);
});
