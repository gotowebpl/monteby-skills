#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const auditScript = path.join(root, 'monteby-site-authoring', 'scripts', 'audit-target-manifest.js');
const generatorScript = path.join(root, 'monteby-site-authoring', 'scripts', 'generate-random-html-target.js');

test('target audit accepts generated marketplace target media roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-generated-'));
  const generate = spawnSync(process.execPath, [
    generatorScript,
    '--seed',
    'target-audit-optomatta',
    '--variant',
    'auto',
    '--archetype',
    'optomatta-optical-retail',
    '--out-dir',
    directory,
  ], { encoding: 'utf8' });

  assert.equal(generate.status, 0, generate.stderr);

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.mediaSurfaces, 21);
  assert.equal(report.stats.htmlMediaReferences, 21);
  assert.equal(report.stats.requiredMediaRoles, 3);
  assert.deepEqual(report.errors, []);
});

test('target audit rejects generated targets without required screenshots when requested', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-no-screenshots-'));
  const generate = spawnSync(process.execPath, [
    generatorScript,
    '--seed',
    'target-audit-no-screenshots',
    '--variant',
    'auto',
    '--archetype',
    'lumen-eye-care-editorial',
    '--out-dir',
    directory,
  ], { encoding: 'utf8' });

  assert.equal(generate.status, 0, generate.stderr);

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--require-screenshots',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_target_screenshots']);
});

test('target audit rejects media surfaces missing from target HTML', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-missing-html-media-'));
  const manifestPath = path.join(directory, 'target-manifest.json');
  const htmlPath = path.join(directory, 'target.html');
  const manifest = validMarketplaceManifest();

  manifest.mediaSurfaces[4].source = 'https://replacement.example.test/missing-card.jpg';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(htmlPath, htmlForManifest(validMarketplaceManifest()));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'media_source_not_in_html'));
});

test('target audit accepts marketplace target with screenshots and role evidence', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-valid-'));
  const manifestPath = path.join(directory, 'target-manifest.json');
  const htmlPath = path.join(directory, 'target.html');
  const screenshotPath = path.join(directory, 'target-desktop.png');
  const layoutPath = path.join(directory, 'target-layout.json');
  const manifest = validMarketplaceManifest();

  manifest.screenshots = [
    {
      label: 'desktop',
      width: 1440,
      height: 1200,
      mode: 'viewport',
      file: 'target-desktop.png',
    },
  ];
	  manifest.layout = 'target-layout.json';
	  manifest.layoutCapture = { status: 'ok', file: 'target-layout.json', error: '' };
	  manifest.layouts = [
	    { label: 'desktop', width: 1440, height: 1200, file: 'target-layout.json', status: 'ok', error: '' },
	  ];
	  manifest.renderedMediaSurfaces = measuredMarketplaceSurfaces(manifest);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(htmlPath, htmlForManifest(manifest));
  writeTexturedPng(screenshotPath, 320, 240);
  fs.writeFileSync(layoutPath, JSON.stringify({
    viewport: {
      width: 320,
      height: 240,
    },
    mediaBoxes: [
      {
        tag: 'img',
        source: manifest.mediaSurfaces[0].source,
        rect: { x: 0, y: 0, width: 250, height: 190, top: 0, left: 0, right: 250, bottom: 190 },
        firstViewportArea: 47500,
      },
      {
        tag: 'img',
        source: manifest.mediaSurfaces[1].source,
        rect: { x: 210, y: 40, width: 90, height: 110, top: 40, left: 210, right: 300, bottom: 150 },
        firstViewportArea: 9900,
      },
    ],
    summary: {
      firstViewportMediaBoxes: 2,
      firstViewportMediaCoverage: 0.22,
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--require-screenshots',
    '--require-rendered-media',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.screenshotFiles, 1);
  assert.equal(report.stats.mediaSurfaces, 5);
  assert.equal(report.stats.htmlMediaReferences, 5);
	  assert.equal(report.stats.renderedLayoutFiles, 1);
	  assert.equal(report.stats.renderedFirstViewportMediaCoverage, 0.22);
	  assert.equal(report.stats.renderedHeroScaleMediaSurfaces, 1);
	  assert.equal(report.stats.renderedSecondaryScaleMediaSurfaces, 1);
	  assert.equal(report.stats.renderedServiceCardScaleMediaSurfaces, 3);
  assert.equal(report.stats.screenshotSampledMediaBoxes, 1);
  assert.equal(report.stats.screenshotPhotoLikeMediaBoxes, 1);
	  assert.deepEqual(report.errors, []);
	});

test('target audit rejects rendered marketplace screenshots without visible photo texture', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-flat-screenshot-'));
  const manifestPath = path.join(directory, 'target-manifest.json');
  const htmlPath = path.join(directory, 'target.html');
  const screenshotPath = path.join(directory, 'target-desktop.png');
  const layoutPath = path.join(directory, 'target-layout.json');
  const manifest = validMarketplaceManifest();

  manifest.screenshots = [
    {
      label: 'desktop',
      width: 320,
      height: 240,
      mode: 'viewport',
      file: 'target-desktop.png',
    },
  ];
  manifest.layout = 'target-layout.json';
  manifest.layoutCapture = { status: 'ok', file: 'target-layout.json', error: '' };
  manifest.layouts = [
    { label: 'desktop', width: 320, height: 240, file: 'target-layout.json', status: 'ok', error: '' },
  ];
  manifest.renderedMediaSurfaces = measuredMarketplaceSurfaces(manifest);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(htmlPath, htmlForManifest(manifest));
  writeSolidPng(screenshotPath, [250, 250, 250, 255], 320, 240);
  fs.writeFileSync(layoutPath, JSON.stringify({
    viewport: {
      width: 320,
      height: 240,
    },
    mediaBoxes: [
      {
        tag: 'img',
        source: manifest.mediaSurfaces[0].source,
        rect: { x: 0, y: 0, width: 250, height: 190, top: 0, left: 0, right: 250, bottom: 190 },
        firstViewportArea: 47500,
      },
    ],
    summary: {
      firstViewportMediaBoxes: 1,
      firstViewportMediaCoverage: 0.62,
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--require-screenshots',
    '--require-rendered-media',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.screenshotSampledMediaBoxes, 1);
  assert.equal(report.stats.screenshotPhotoLikeMediaBoxes, 0);
  assert.ok(report.errors.some((error) => error.code === 'target_screenshot_photo_evidence_missing'));
});

test('target audit rejects marketplace target without rendered first-viewport photography', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-no-rendered-media-'));
  const manifestPath = path.join(directory, 'target-manifest.json');
  const htmlPath = path.join(directory, 'target.html');
  const layoutPath = path.join(directory, 'target-layout.json');
  const manifest = validMarketplaceManifest();

  manifest.layout = 'target-layout.json';
  manifest.layoutCapture = { status: 'ok', file: 'target-layout.json', error: '' };
  manifest.layouts = [
    { label: 'desktop', width: 1440, height: 1200, file: 'target-layout.json', status: 'ok', error: '' },
  ];

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(htmlPath, htmlForManifest(manifest));
  fs.writeFileSync(layoutPath, JSON.stringify({
    summary: {
      firstViewportMediaBoxes: 0,
      firstViewportMediaCoverage: 0.01,
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--require-rendered-media',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
	  assert.ok(report.errors.some((error) => error.code === 'missing_rendered_first_viewport_media'));
	  assert.ok(report.errors.some((error) => error.code === 'low_rendered_first_viewport_media_coverage'));
	});

test('target audit rejects marketplace targets with undersized rendered media roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-audit-small-rendered-roles-'));
  const manifestPath = path.join(directory, 'target-manifest.json');
  const htmlPath = path.join(directory, 'target.html');
  const layoutPath = path.join(directory, 'target-layout.json');
  const manifest = validMarketplaceManifest();

  manifest.layout = 'target-layout.json';
  manifest.layoutCapture = { status: 'ok', file: 'target-layout.json', error: '' };
  manifest.layouts = [
    { label: 'desktop', width: 1440, height: 1200, file: 'target-layout.json', status: 'ok', error: '' },
  ];
  manifest.renderedMediaSurfaces = [
    measuredSurface(manifest.mediaSurfaces[0], 360, 180, 64800),
    measuredSurface(manifest.mediaSurfaces[1], 160, 80, 12800),
    measuredSurface(manifest.mediaSurfaces[2], 220, 90, 0),
    measuredSurface(manifest.mediaSurfaces[3], 220, 90, 0),
    measuredSurface(manifest.mediaSurfaces[4], 220, 90, 0),
  ];

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(htmlPath, htmlForManifest(manifest));
  fs.writeFileSync(layoutPath, JSON.stringify({
    summary: {
      firstViewportMediaBoxes: 2,
      firstViewportMediaCoverage: 0.22,
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--target-dir',
    directory,
    '--require-marketplace',
    '--require-rendered-media',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.renderedHeroScaleMediaSurfaces, 0);
  assert.equal(report.stats.renderedSecondaryScaleMediaSurfaces, 0);
  assert.equal(report.stats.renderedServiceCardScaleMediaSurfaces, 0);
  assert.deepEqual(report.errors.map((error) => error.code), [
    'undersized_rendered_hero_media_surface',
    'undersized_rendered_secondary_media_surface',
    'undersized_rendered_service_card_media_surface',
  ]);
});

function validMarketplaceManifest() {
  const sources = [
    'https://replacement.example.test/hero.jpg',
    'https://replacement.example.test/detail.jpg',
    'https://replacement.example.test/card-one.jpg',
    'https://replacement.example.test/card-two.jpg',
    'https://replacement.example.test/card-three.jpg',
  ];

  return {
    seed: 'valid-target',
    variant: 'marketplace-service',
    imageSources: sources,
    mediaSurfaces: [
      { role: 'hero', placement: 'firstViewport', source: sources[0] },
      { role: 'secondary', placement: 'firstViewport', source: sources[1] },
      { role: 'service-card', placement: 'afterHero', source: sources[2] },
      { role: 'service-card', placement: 'afterHero', source: sources[3] },
      { role: 'service-card', placement: 'afterHero', source: sources[4] },
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'service-card', minSurfaces: 3, placement: 'afterHero' },
    ],
  };
}

function htmlForManifest(manifest) {
  const images = manifest.mediaSurfaces
    .map((surface) => `<img src="${surface.source.replace(/&/g, '&amp;')}">`)
    .join('');

	  return `<!doctype html><html><body>${images}</body></html>`;
	}

function measuredMarketplaceSurfaces(manifest) {
  return [
    measuredSurface(manifest.mediaSurfaces[0], 900, 520, 420000),
    measuredSurface(manifest.mediaSurfaces[1], 260, 170, 44200),
    measuredSurface(manifest.mediaSurfaces[2], 320, 160, 0),
    measuredSurface(manifest.mediaSurfaces[3], 320, 160, 0),
    measuredSurface(manifest.mediaSurfaces[4], 320, 160, 0),
  ];
}

function measuredSurface(surface, width, height, firstViewportArea) {
  return {
    ...surface,
    width,
    height,
    firstViewportArea,
  };
}

function writeSolidPng(file, rgba, width, height) {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = rgba[0];
    image.data[offset + 1] = rgba[1];
    image.data[offset + 2] = rgba[2];
    image.data[offset + 3] = rgba[3];
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}

function writeTexturedPng(file, width, height) {
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
