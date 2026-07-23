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

test('visual iteration prints help', () => {
  const result = spawnSync(process.execPath, [iterationScript, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /run-visual-iteration\.js/);
  assert.match(result.stdout, /start-visual-benchmark\.js/);
  assert.match(result.stdout, /run-visual-benchmark\.js/);
  assert.match(result.stdout, /diagnostic_passed/);
  assert.match(result.stdout, /never final fidelity or canonical success/);
});

test('visual iteration runs target, draft, render, candidate capture, and benchmark', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-visual-iteration-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-iteration-npx-'));
  const contractPath = path.join(directory, 'contract.json');
  const fakeNpxPath = path.join(binDirectory, 'npx');

  fs.writeFileSync(contractPath, JSON.stringify(iterationContract(), null, 2));
  writeFakeNpx(fakeNpxPath);

  const result = spawnSync(process.execPath, [
    iterationScript,
    '--label',
    'unit-iteration',
    '--contract',
    contractPath,
    '--seed',
    'unit-iteration-seed',
    '--variant',
    'split-hero',
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.status, 'diagnostic_passed');
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.verificationLevel, 'full_page_static_visual_diagnostic');
  assert.equal(report.visualBenchmarkPassed, true);
  assert.equal(report.visualDiagnosticPassed, true);
  assert.equal(report.fidelityPassed, false);
  assert.equal(report.canonicalVerification, false);
  assert.equal(report.productReady, false);
  assert.deepEqual(report.canonicalEvidence, {
    renderer: 'render-monteby-preview.js',
    staticHtmlPreview: true,
    wordpressRestValidated: false,
    wordpressRestSaved: false,
    wordpressPhpPreviewed: false,
  });
  assert.equal(report.useCandidateManifest, true);
  assert.equal(report.steps.start.status, 0);
  assert.equal(report.steps.readiness.status, 0);
  assert.equal(report.steps.draft.status, 0);
  assert.equal(report.steps.render.status, 0);
  assert.equal(report.steps.candidateCapture.status, 0);
  assert.equal(report.steps.benchmark.status, 0);
  assert.equal(report.benchmark.ok, true);
  assert.equal(report.draft.stats.authoringMode, 'generic-measured-reference');
  assert.equal(report.benchmark.genericGeometry.enforced, true);
  assert.equal(report.benchmark.genericGeometry.ok, true);
  assert.deepEqual(report.blockers, []);
  assert.equal(fs.existsSync(path.join(directory, 'target.html')), true);
  assert.equal(fs.existsSync(path.join(directory, 'target-desktop.png')), true);
  assert.equal(fs.existsSync(path.join(directory, 'candidate', 'layout-draft.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'candidate', 'layout.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'candidate', 'layout-draft-preview.html')), true);
  assert.equal(fs.existsSync(path.join(directory, 'candidate', 'rendered', 'candidate-desktop.png')), true);
  assert.equal(fs.existsSync(path.join(directory, 'candidate', 'benchmark-report.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'visual-iteration-report.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'VISUAL-ITERATION.md')), true);
  const markdown = fs.readFileSync(path.join(directory, 'VISUAL-ITERATION.md'), 'utf8');
  assert.match(markdown, /Status: VISUAL DIAGNOSTIC PASS/);
  assert.doesNotMatch(markdown, /Status: PASS/);
  assert.match(markdown, /Verification level: full_page_static_visual_diagnostic/);
  assert.match(markdown, /Final fidelity passed: no/);
  assert.match(markdown, /Canonical WordPress verification: no/);
  assert.match(markdown, /WordPress REST validate evidence: no/);
  assert.match(markdown, /WordPress REST save evidence: no/);
  assert.match(markdown, /WordPress\/PHP preview evidence: no/);
  assert.match(markdown, /not a final 1:1 fidelity result/);
});

test('visual iteration captures long mobile diagnostic when reference photos sit below the first fold', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-visual-iteration-long-mobile-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-iteration-long-mobile-npx-'));
  const contractPath = path.join(directory, 'contract.json');
  const fakeNpxPath = path.join(binDirectory, 'npx');

  fs.writeFileSync(contractPath, JSON.stringify(iterationContract(), null, 2));
  writeFakeNpx(fakeNpxPath);

  const result = spawnSync(process.execPath, [
    iterationScript,
    '--label',
    'unit-iteration-long-mobile',
    '--contract',
    contractPath,
    '--seed',
    'unit-iteration-long-mobile-seed',
    '--variant',
    'split-hero',
    '--out-dir',
    directory,
    '--viewport',
    'mobile:390x844',
    '--wait-ms',
    '0',
    '--reference-wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--viewport-only',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      MONTEBY_FAKE_AFTER_FOLD_MEDIA: '1',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.status, 'diagnostic_passed');
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.verificationLevel, 'viewport_only_static_visual_diagnostic');
  assert.equal(report.visualBenchmarkPassed, true);
  assert.equal(report.visualDiagnosticPassed, true);
  assert.equal(report.fidelityPassed, false);
  assert.equal(report.canonicalVerification, false);
  assert.notEqual(report.status, 'passed');
  assert.equal(report.longMobile.needed, true);
  assert.equal(report.longMobile.reason, 'mobile_first_viewport_is_photo_light_but_reference_has_after_fold_photography');
  assert.equal(report.steps.longMobileReferenceCapture.status, 0);
  assert.equal(report.steps.longMobileCandidateCapture.status, 0);
  assert.equal(fs.existsSync(path.join(directory, 'long-mobile', 'reference', 'reference-mobile-long.png')), true);
  assert.equal(fs.existsSync(path.join(directory, 'long-mobile', 'candidate', 'candidate-mobile-long.png')), true);
  assert.equal(fs.existsSync(path.join(directory, 'long-mobile', 'benchmark-report.json')), true);
  const markdown = fs.readFileSync(path.join(directory, 'VISUAL-ITERATION.md'), 'utf8');
  assert.match(markdown, /Status: VISUAL DIAGNOSTIC PASS/);
  assert.doesNotMatch(markdown, /Status: PASS/);
  assert.match(markdown, /Verification level: viewport_only_static_visual_diagnostic/);
  assert.match(markdown, /Long Mobile Diagnostic/);
  assert.match(markdown, /Needed: yes/);
});

test('visual iteration names screenshot budget failures explicitly', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-visual-iteration-diff-'));
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fake-iteration-diff-npx-'));
  const contractPath = path.join(directory, 'contract.json');
  const fakeNpxPath = path.join(binDirectory, 'npx');

  fs.writeFileSync(contractPath, JSON.stringify(iterationContract(), null, 2));
  writeFakeNpx(fakeNpxPath);

  const result = spawnSync(process.execPath, [
    iterationScript,
    '--label',
    'unit-iteration-diff',
    '--contract',
    contractPath,
    '--seed',
    'unit-iteration-diff-seed',
    '--variant',
    'split-hero',
    '--out-dir',
    directory,
    '--viewport',
    'desktop:320x240',
    '--wait-ms',
    '0',
    '--playwright-package',
    'fake-playwright',
    '--json',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH || ''}`,
      MONTEBY_FAKE_CANDIDATE_DIFF: '1',
    },
  });

  assert.equal(result.status, 1, result.stdout);

  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.status, 'visual_budget_failed');
  assert.equal(report.visualDiagnosticPassed, false);
  assert.equal(report.fidelityPassed, false);
  assert.equal(report.canonicalVerification, false);
  assert.equal(report.benchmark.comparison.ok, false);
  assert.equal(report.blockers[0].source, 'visual-diff');
  assert.match(report.blockers[0].code, /max_/);
  assert.match(fs.readFileSync(path.join(directory, 'VISUAL-ITERATION.md'), 'utf8'), /Status: FAIL/);
});

function writeFakeNpx(file) {
  fs.writeFileSync(file, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PNG } = require(require.resolve('pngjs', { paths: [process.cwd()] }));

const screenshotOut = process.env.MONTEBY_TARGET_SCREENSHOT_OUT
  || process.env.MONTEBY_REFERENCE_CAPTURE_SCREENSHOT_OUT
  || process.env.MONTEBY_REFERENCE_SCREENSHOT_OUT
  || '';
if (screenshotOut) {
  writeTexturedPng(screenshotOut);
}

const layoutOut = process.env.MONTEBY_REFERENCE_CAPTURE_LAYOUT_OUT || process.env.MONTEBY_REFERENCE_LAYOUT_OUT || '';
if (layoutOut) {
  fs.mkdirSync(path.dirname(layoutOut), { recursive: true });
  const width = Number(process.env.MONTEBY_REFERENCE_CAPTURE_WIDTH || process.env.MONTEBY_REFERENCE_LAYOUT_WIDTH || process.env.MONTEBY_TARGET_SCREENSHOT_WIDTH || 320);
  const height = Number(process.env.MONTEBY_REFERENCE_CAPTURE_HEIGHT || process.env.MONTEBY_REFERENCE_LAYOUT_HEIGHT || process.env.MONTEBY_TARGET_SCREENSHOT_HEIGHT || 240);
  const afterFold = process.env.MONTEBY_FAKE_AFTER_FOLD_MEDIA === '1' && width === 390;
  const photo = afterFold
    ? mediaBox(24, 1110, 342, 360, 'https://cdn.example.test/iteration-after-fold-photo.jpg', width, height)
    : mediaBox(Math.max(24, width - 136), 28, 112, 148, 'https://cdn.example.test/iteration-hero.jpg', width, height);
  const fullPage = process.env.MONTEBY_REFERENCE_CAPTURE_FULL_PAGE === '1'
    || process.env.MONTEBY_REFERENCE_SCREENSHOT_FULL_PAGE === '1'
    || process.env.MONTEBY_TARGET_SCREENSHOT_FULL_PAGE === '1';
  fs.writeFileSync(layoutOut, JSON.stringify({
    capturedAt: '2026-07-09T00:00:00.000Z',
    url: 'file:///tmp/iteration.html',
    title: 'Iteration',
    viewport: { width, height, scrollHeight: afterFold ? 2200 : 900 },
    textBoxes: [
      {
        tag: 'h1',
        text: 'Iteration headline',
        structureKey: '0.0',
        parentGroupKey: '0',
        rect: { x: 24, y: 36, width: Math.min(240, width - 48), height: 72, top: 36, left: 24, right: Math.min(264, width - 24), bottom: 108 },
        firstViewportArea: 12960,
        fontSize: '42px',
        fontWeight: '700',
        color: 'rgb(20, 20, 20)',
        backgroundColor: 'rgba(0, 0, 0, 0)'
      }
    ],
    mediaBoxes: [
      { ...photo, structureKey: '0.1', parentGroupKey: '0' }
    ],
    landmarks: [{
      key: '0',
      groupKey: '0',
      tag: 'section',
      flowParticipation: 'normal',
      rect: { x: 0, y: 0, width, height: afterFold ? 2200 : 900, top: 0, left: 0, right: width, bottom: afterFold ? 2200 : 900 },
      display: 'block',
      backgroundColor: 'rgb(255, 255, 255)'
    }],
    evidenceCompleteness: {
      mode: fullPage ? 'full-page' : 'viewport-diagnostic',
      status: fullPage ? 'complete' : 'bounded',
      complete: fullPage,
      essentialGeometryTruncated: false,
      reasons: [],
      categories: {
        landmarks: { total: 1, retained: 1, truncated: 0, limit: 160 }
      }
    },
    summary: {
      firstViewportTextBoxes: 1,
      firstViewportMediaBoxes: 1,
      firstViewportMediaCoverage: Math.min(1, photo.firstViewportArea / (width * height)),
      largestMediaArea: photo.rect.width * photo.rect.height
    }
  }, null, 2));
}

function mediaBox(x, y, width, height, source, viewportWidth, viewportHeight) {
  const firstViewportWidth = Math.max(0, Math.min(x + width, viewportWidth) - Math.max(x, 0));
  const firstViewportHeight = Math.max(0, Math.min(y + height, viewportHeight) - Math.max(y, 0));
  return {
    tag: 'img',
    source,
    rect: { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height },
    firstViewportArea: firstViewportWidth * firstViewportHeight,
    objectFit: 'cover',
    objectPosition: '50% 50%',
    backgroundSize: 'auto',
    backgroundPosition: '0% 0%'
  };
}

function writeTexturedPng(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const width = Number(process.env.MONTEBY_REFERENCE_CAPTURE_WIDTH || process.env.MONTEBY_REFERENCE_SCREENSHOT_WIDTH || process.env.MONTEBY_TARGET_SCREENSHOT_WIDTH || 320);
  const height = Number(process.env.MONTEBY_REFERENCE_CAPTURE_HEIGHT || process.env.MONTEBY_REFERENCE_SCREENSHOT_HEIGHT || process.env.MONTEBY_TARGET_SCREENSHOT_HEIGHT || 240);
  const image = new PNG({ width, height });
  const candidateDiff = process.env.MONTEBY_FAKE_CANDIDATE_DIFF === '1' && file.includes('/candidate/');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      image.data[offset] = candidateDiff ? 245 : (x * 11 + y * 3) % 256;
      image.data[offset + 1] = candidateDiff ? 230 : (x * 5 + y * 13 + 32) % 256;
      image.data[offset + 2] = candidateDiff ? 210 : (x * 17 + y * 7 + 64) % 256;
      image.data[offset + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
`);
  fs.chmodSync(file, 0o755);
}

function iterationContract() {
  const components = [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: [
          'tag',
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
          'paddingTopTablet',
          'paddingRightTablet',
          'paddingBottomTablet',
          'paddingLeftTablet',
          'paddingTopMobile',
          'paddingRightMobile',
          'paddingBottomMobile',
          'paddingLeftMobile',
          'innerMaxWidth',
          'innerPaddingX',
          'innerPaddingXTablet',
          'innerPaddingXMobile',
          'background',
          'backgroundColor',
          'backgroundType',
          'backgroundImage',
          'backgroundSize',
          'backgroundPosition',
          'backgroundRepeat',
          'minHeight',
          'minHeightTablet',
          'minHeightMobile',
        ],
      },
      {
        name: 'Container',
        allowedParents: ['Section', 'Container'],
        props: [
          'layoutDisplay',
          'flexDirection',
          'flexDirectionTablet',
          'flexDirectionMobile',
          'flexWrap',
          'flexWrapTablet',
          'flexWrapMobile',
          'justifyContent',
          'justifyContentTablet',
          'justifyContentMobile',
          'alignItems',
          'alignItemsTablet',
          'alignItemsMobile',
          'gap',
          'gapTablet',
          'gapMobile',
          'responsiveStack',
          'width',
          'maxWidth',
          'maxWidthTablet',
          'maxWidthMobile',
          'minHeight',
          'minHeightTablet',
          'minHeightMobile',
          'flexBasis',
          'flexGrow',
          'flexShrink',
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
          'paddingTopTablet',
          'paddingRightTablet',
          'paddingBottomTablet',
          'paddingLeftTablet',
          'paddingTopMobile',
          'paddingRightMobile',
          'paddingBottomMobile',
          'paddingLeftMobile',
          'gridTemplateColumns',
          'gridTemplateColumnsTablet',
          'gridTemplateColumnsMobile',
          'gridColumnStart',
          'gridColumnSpan',
          'gridRowStart',
          'gridRowSpan',
          'gridColumnStartTablet',
          'gridColumnSpanTablet',
          'gridRowStartTablet',
          'gridRowSpanTablet',
          'gridColumnStartMobile',
          'gridColumnSpanMobile',
          'gridRowStartMobile',
          'gridRowSpanMobile',
          'borderRadius',
          'background',
          'backgroundColor',
          'backgroundImage',
          'backgroundSize',
          'backgroundPosition',
          'boxShadow',
        ],
      },
      {
        name: 'Heading',
        allowedParents: ['Section', 'Container'],
        props: ['tag', 'text', 'fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile', 'letterSpacing', 'letterSpacingTablet', 'letterSpacingMobile', 'fontWeight', 'textColor', 'textAlign', 'marginTop', 'marginBottom'],
      },
      {
        name: 'Text',
        allowedParents: ['Section', 'Container'],
        props: ['text', 'display', 'fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile', 'letterSpacing', 'letterSpacingTablet', 'letterSpacingMobile', 'fontWeight', 'textColor', 'textAlign', 'backgroundColor', 'paddingY', 'paddingX', 'borderRadius', 'marginTop', 'marginBottom'],
      },
      {
        name: 'ButtonBlock',
        allowedParents: ['Section', 'Container'],
        props: ['label', 'text', 'url', 'href', 'backgroundColor', 'textColor', 'paddingY', 'paddingX', 'borderRadius', 'textDecoration', 'alignment'],
      },
      {
        name: 'ImageBlock',
        allowedParents: ['Section', 'Container'],
        props: ['src', 'image', 'url', 'alt', 'width', 'height', 'maxWidth', 'objectFit', 'objectPosition', 'borderRadius'],
      },
      {
        name: 'StatsGrid',
        allowedParents: ['Section', 'Container'],
        props: ['items', 'columns', 'gap', 'metricOrder'],
      },
    ];

  return {
    components: components.map((component) => ({
      ...component,
      aiProps: [...component.props],
    })),
  };
}
