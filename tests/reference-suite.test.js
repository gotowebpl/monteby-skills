#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const suiteScript = path.join(root, 'monteby-site-authoring', 'scripts', 'run-reference-suite.js');

function writeFakeCaptureScript(directory) {
  const script = path.join(directory, 'fake-capture.js');
  fs.writeFileSync(script, `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function valueAfter(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : '';
}

function valuesAfter(argv, name) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1]) {
      values.push(argv[index + 1]);
    }
  }
  return values;
}

const argv = process.argv.slice(2);
const outDir = valueAfter(argv, '--out-dir');
const url = valueAfter(argv, '--url');
const viewports = valuesAfter(argv, '--viewport');
fs.mkdirSync(outDir, { recursive: true });

const weak = url.includes('weak');
const small = url.includes('small');
const withoutSecondary = url.includes('without-secondary');
const mediaSurfaces = weak ? [
  {
    role: 'reference-media',
    placement: 'firstViewport',
    source: 'https://cdn.example.test/logo-light.png',
    width: 80,
    height: 32,
    firstViewportArea: 2560
  }
] : small ? [
  {
    role: 'hero',
    placement: 'firstViewport',
    source: 'https://cdn.example.test/reference-hero.jpg',
    width: 300,
    height: 120,
    firstViewportArea: 36000
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-1.jpg',
    width: 220,
    height: 90,
    firstViewportArea: 0
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-2.jpg',
    width: 220,
    height: 90,
    firstViewportArea: 0
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-3.jpg',
    width: 220,
    height: 90,
    firstViewportArea: 0
  }
] : withoutSecondary ? [
  {
    role: 'hero',
    placement: 'firstViewport',
    source: 'https://cdn.example.test/reference-hero.jpg',
    width: 620,
    height: 520,
    firstViewportArea: 260000
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-1.jpg',
    width: 260,
    height: 180,
    firstViewportArea: 0
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-2.jpg',
    width: 260,
    height: 180,
    firstViewportArea: 0
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-3.jpg',
    width: 260,
    height: 180,
    firstViewportArea: 0
  }
] : [
  {
    role: 'hero',
    placement: 'firstViewport',
    source: 'https://cdn.example.test/reference-hero.jpg',
    width: 620,
    height: 520,
    firstViewportArea: 260000
  },
  {
    role: 'secondary',
    placement: 'firstViewport',
    source: 'https://cdn.example.test/reference-secondary.jpg',
    width: 220,
    height: 180,
    firstViewportArea: 39600
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-1.jpg',
    width: 260,
    height: 180,
    firstViewportArea: 0
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-2.jpg',
    width: 260,
    height: 180,
    firstViewportArea: 0
  },
  {
    role: 'service-card',
    placement: 'afterHero',
    source: 'https://cdn.example.test/reference-service-3.jpg',
    width: 260,
    height: 180,
    firstViewportArea: 0
  }
];

const requiredMediaRoles = weak ? [] : [
  {
    role: 'hero',
    minSurfaces: 1,
    placement: 'firstViewport',
    description: 'Hero role.'
  },
  ...(withoutSecondary || small ? [] : [
    {
      role: 'secondary',
      minSurfaces: 1,
      placement: 'firstViewport',
      description: 'Secondary role.'
    }
  ]),
  {
    role: 'service-card',
    minSurfaces: 3,
    placement: 'afterHero',
    description: 'Service card role.'
  }
];

const screenshots = viewports.map((viewport) => {
  const label = viewport.split(':')[0] || 'desktop';
  const size = (viewport.split(':')[1] || '320x240').split('x');
  const file = \`reference-\${label}.png\`;
  fs.writeFileSync(path.join(outDir, file), 'fakepng');
  return {
    label,
    width: Number(size[0] || 320),
    height: Number(size[1] || 240),
    mode: 'viewport',
    file
  };
});
const layouts = viewports.map((viewport, index) => {
  const label = viewport.split(':')[0] || 'desktop';
  const size = (viewport.split(':')[1] || '320x240').split('x');
  const file = index === 0 ? 'reference-layout.json' : \`reference-layout-\${label}.json\`;
  fs.writeFileSync(path.join(outDir, file), JSON.stringify({ summary: { firstViewportMediaCoverage: 0.5 } }, null, 2));
  return {
    label,
    width: Number(size[0] || 320),
    height: Number(size[1] || 240),
    file,
    status: 'ok',
    error: ''
  };
});
fs.writeFileSync(path.join(outDir, 'REFERENCE-BRIEF.md'), '# Reference Brief\\n');
fs.writeFileSync(path.join(outDir, 'reference-manifest.json'), JSON.stringify({
  sourceUrl: url,
  capturedAt: '2026-07-08T00:00:00.000Z',
  brief: 'REFERENCE-BRIEF.md',
  layout: 'reference-layout.json',
  layouts,
  layoutCapture: {
    status: 'ok',
    file: 'reference-layout.json',
    error: '',
    layouts
  },
  mediaCount: mediaSurfaces.length,
  mediaSurfaces,
  requiredMediaRoles,
  screenshots
}, null, 2) + '\\n');
`);
  fs.chmodSync(script, 0o755);
  return script;
}

function writeSlowCaptureScript(directory) {
  const script = path.join(directory, 'slow-capture.js');
  fs.writeFileSync(script, `#!/usr/bin/env node
'use strict';

setTimeout(() => {}, 10000);
`);
  fs.chmodSync(script, 0o755);
  return script;
}

function writePartialSlowCaptureScript(directory) {
  const script = path.join(directory, 'partial-slow-capture.js');
  fs.writeFileSync(script, `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function valueAfter(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : '';
}

const argv = process.argv.slice(2);
const outDir = valueAfter(argv, '--out-dir');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'reference-desktop.png'), 'fakepng');
fs.writeFileSync(path.join(outDir, 'reference-manifest.json'), JSON.stringify({
  sourceUrl: valueAfter(argv, '--url'),
  capturedAt: '2026-07-09T00:00:00.000Z',
  captureStatus: 'partial',
  captureMessage: 'Screenshot captured for desktop; capture still in progress.',
  brief: 'REFERENCE-BRIEF.md',
  briefJson: 'reference-brief.json',
  layout: '',
  layouts: [],
  layoutCapture: {
    status: 'skipped',
    file: '',
    error: '',
    layouts: []
  },
  mediaCount: 1,
  mediaSurfaces: [],
  requiredMediaRoles: [],
  screenshots: [
    {
      label: 'desktop',
      width: 320,
      height: 240,
      mode: 'viewport',
      file: 'reference-desktop.png'
    }
  ]
}, null, 2) + '\\n');
fs.writeFileSync(path.join(outDir, 'REFERENCE-BRIEF.md'), '# Partial Reference Brief\\n');
setTimeout(() => {}, 10000);
`);
  fs.chmodSync(script, 0o755);
  return script;
}

test('reference suite prints help', () => {
  const result = spawnSync(process.execPath, [suiteScript, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /run-reference-suite\.js/);
  assert.match(result.stdout, /--reference-url/);
});

test('reference suite passes references with required rendered media roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-'));
  const captureScript = writeFakeCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'alpha=https://example.test/reference-alpha',
    '--reference-url',
    'beta=https://example.test/reference-beta',
    '--viewport',
    'desktop:320x240',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, true);
  assert.equal(report.references.length, 2);
  assert.equal(report.references[0].label, 'alpha');
  assert.deepEqual(report.references[0].roleCounts, {
    hero: 1,
    secondary: 1,
    'service-card': 3,
  });
  assert.equal(fs.existsSync(path.join(directory, 'reference-suite-report.json')), true);
  assert.match(markdown, /alpha: PASS/);
  assert.match(markdown, /Roles: hero:1, secondary:1, service-card:3/);
  assert.match(markdown, /Scaled roles: hero:1, secondary:1, service-card:3/);
  assert.match(markdown, /Required roles: hero:1, secondary:1, service-card:3/);
});

test('reference suite captures desktop, tablet, and mobile by default', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-default-viewports-'));
  const captureScript = writeFakeCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'alpha=https://example.test/reference-alpha',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, true);
  assert.equal(report.references[0].screenshotCount, 3);
  assert.equal(report.references[0].layoutCount, 3);
  assert.deepEqual(report.references[0].layouts.map((layout) => path.basename(layout)), [
    'reference-layout.json',
    'reference-layout-tablet.json',
    'reference-layout-mobile.json',
  ]);
  assert.match(markdown, /Layout snapshots: 3/);
});

test('reference suite accepts references whose manifest does not require secondary media', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-no-secondary-'));
  const captureScript = writeFakeCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'without-secondary=https://example.test/without-secondary-reference',
    '--viewport',
    'desktop:320x240',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, true);
  assert.deepEqual(report.references[0].roleCounts, {
    hero: 1,
    'service-card': 3,
  });
  assert.deepEqual(report.references[0].requiredMediaRoles.map((role) => role.role), ['hero', 'service-card']);
  assert.match(markdown, /without-secondary: PASS/);
  assert.match(markdown, /Required roles: hero:1, service-card:3/);
});

test('reference suite fails references without real photo roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-weak-'));
  const captureScript = writeFakeCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'weak=https://example.test/weak-reference',
    '--viewport',
    'desktop:320x240',
    '--json',
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, false);
  assert.equal(report.references[0].quality.ok, false);
  assert.match(report.references[0].quality.errors.join(' '), /Missing rendered "hero" media role/);
  assert.match(report.references[0].quality.errors.join(' '), /Missing rendered "service-card" media role/);
  assert.match(markdown, /weak: FAIL/);
});

test('reference suite fails references with undersized photo roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-small-'));
  const captureScript = writeFakeCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'small=https://example.test/small-reference',
    '--viewport',
    'desktop:320x240',
    '--json',
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, false);
  assert.equal(report.references[0].quality.ok, false);
  assert.deepEqual(report.references[0].roleCounts, {
    hero: 1,
    'service-card': 3,
  });
  assert.deepEqual(report.references[0].scaledRoleCounts, {
    hero: 0,
    secondary: 0,
    'service-card': 0,
  });
  assert.match(report.references[0].quality.errors.join(' '), /rendered "hero" media role is undersized/);
  assert.match(report.references[0].quality.errors.join(' '), /rendered "service-card" media role is undersized/);
  assert.match(markdown, /small: FAIL/);
  assert.match(markdown, /Scaled roles: none/);
});

test('reference suite reports timed out captures instead of hanging indefinitely', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-timeout-'));
  const captureScript = writeSlowCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'slow=https://example.test/slow-reference',
    '--viewport',
    'desktop:320x240',
    '--timeout-ms',
    '500',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, false);
  assert.equal(report.references[0].timedOut, true);
  assert.match(report.references[0].stderr, /timed out/);
  assert.match(markdown, /Capture timed out/);
});

test('reference suite reports partial manifests left by timed out captures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-reference-suite-partial-timeout-'));
  const captureScript = writePartialSlowCaptureScript(directory);

  const result = spawnSync(process.execPath, [
    suiteScript,
    '--out-dir',
    directory,
    '--capture-script',
    captureScript,
    '--reference-url',
    'partial=https://example.test/partial-reference',
    '--viewport',
    'desktop:320x240',
    '--timeout-ms',
    '500',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const markdown = fs.readFileSync(path.join(directory, 'REFERENCE-SUITE.md'), 'utf8');

  assert.equal(report.ok, false);
  assert.equal(report.references[0].timedOut, true);
  assert.equal(report.references[0].captureStatus, 'partial');
  assert.equal(report.references[0].screenshotCount, 1);
  assert.match(report.references[0].quality.errors.join(' '), /reference capture status is partial/);
  assert.match(markdown, /Capture status: partial/);
  assert.match(markdown, /Screenshots: 1/);
});
