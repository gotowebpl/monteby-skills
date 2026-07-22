#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  mediaSurfaceRoleCounts,
  requiredRoleMinimums,
  roleScaleQualityErrors,
  scaledMediaSurfaceRoleCounts,
} = require('./media-role-scale');

const DEFAULT_REFERENCES = [
  {
    label: 'careglo',
    archetype: 'luxury-car-care',
    url: 'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements',
  },
  {
    label: 'maidy',
    archetype: 'maid-service-agency',
    url: 'https://askproject.net/maidy/home/?storefront=envato-elements',
  },
  {
    label: 'optomatta',
    archetype: 'optomatta-optical-retail',
    url: 'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
  },
  {
    label: 'lumen',
    archetype: 'lumen-eye-care-editorial',
    url: 'https://omispace.com/lumen/?storefront=envato-elements',
  },
];

const DEFAULT_VIEWPORTS = [
  'desktop:1440x1200',
  'tablet:834x1112',
  'mobile:390x844',
];

function parseArgs(argv) {
  const options = {
    outDir: '',
    references: [],
    viewports: [],
    waitMs: '3500',
    timeoutMs: '300000',
    channel: '',
    playwrightPackage: 'playwright@1.54.1',
    captureScript: path.join(__dirname, 'capture-template-reference.js'),
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out-dir') {
      options.outDir = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-url') {
      options.references.push(parseReferenceValue(requiredValue(argv, index += 1, arg), options.references.length));
    } else if (arg === '--viewport') {
      options.viewports.push(requiredValue(argv, index += 1, arg));
    } else if (arg === '--wait-ms') {
      options.waitMs = requiredValue(argv, index += 1, arg);
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = requiredValue(argv, index += 1, arg);
    } else if (arg === '--channel') {
      options.channel = requiredValue(argv, index += 1, arg);
    } else if (arg === '--playwright-package') {
      options.playwrightPackage = requiredValue(argv, index += 1, arg);
    } else if (arg === '--capture-script') {
      options.captureScript = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.outDir) {
    options.outDir = path.join(os.tmpdir(), `monteby-reference-suite-${Date.now()}`);
  }

  if (options.references.length === 0) {
    options.references = DEFAULT_REFERENCES;
  }

  if (options.viewports.length === 0) {
    options.viewports = DEFAULT_VIEWPORTS;
  }

  return options;
}

function requiredValue(argv, index, arg) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  run-reference-suite.js [--out-dir dir] [--reference-url [label=]url] [--viewport label:WIDTHxHEIGHT] [--channel chrome] [--timeout-ms 300000] [--json]

Captures and quality-checks Monteby visual reference demos. Defaults to the four Envato-style references tracked by the monteby-site-authoring skill.`);
}

function parseReferenceValue(value, index) {
  const match = /^([a-z0-9-]+)=(https?:\/\/.+)$/i.exec(value);
  if (match) {
    return {
      label: slugify(match[1]),
      archetype: '',
      url: match[2],
    };
  }

  return {
    label: referenceLabel(value, index),
    archetype: '',
    url: value,
  };
}

function referenceLabel(url, index) {
  try {
    const parsed = new URL(url);
    return slugify(`${index + 1}-${parsed.hostname.replace(/^www\./, '')}-${parsed.pathname.split('/').filter(Boolean).slice(0, 2).join('-')}`);
  } catch (error) {
    return slugify(`${index + 1}-reference`);
  }
}

function slugify(input) {
  const slug = String(input).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'reference';
}

function runCapture(reference, options) {
  const outDir = path.join(options.outDir, reference.label);
  const args = [
    options.captureScript,
    '--url',
    reference.url,
    '--out-dir',
    outDir,
    '--name',
    'reference',
    '--wait-ms',
    options.waitMs,
    '--playwright-package',
    options.playwrightPackage,
    '--capture-layout',
  ];

  if (options.channel) {
    args.push('--channel', options.channel);
  }
  for (const viewport of options.viewports) {
    args.push('--viewport', viewport);
  }

  console.error(`[monteby-reference-suite] capturing ${reference.label}: ${reference.url}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: parseTimeoutMs(options.timeoutMs),
  });
  const timedOut = result.error && result.error.code === 'ETIMEDOUT';
  const manifestPath = path.join(outDir, 'reference-manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? readJsonFile(manifestPath)
    : null;
  const quality = auditReferenceQuality(manifest, options.viewports.length);
  const layouts = referenceLayoutFiles(outDir, manifest);

  return {
    label: reference.label,
    archetype: reference.archetype || '',
    url: reference.url,
    outDir,
    manifest: manifestPath,
    brief: path.join(outDir, manifest?.brief || 'REFERENCE-BRIEF.md'),
    layout: manifest?.layout ? path.join(outDir, manifest.layout) : '',
    layouts,
    layoutCount: layouts.length,
    screenshotCount: Array.isArray(manifest?.screenshots) ? manifest.screenshots.length : 0,
    mediaCount: typeof manifest?.mediaCount === 'number' ? manifest.mediaCount : 0,
    roleCounts: mediaSurfaceRoleCounts(manifest?.mediaSurfaces),
    scaledRoleCounts: scaledMediaSurfaceRoleCounts(manifest?.mediaSurfaces),
    requiredMediaRoles: Array.isArray(manifest?.requiredMediaRoles) ? manifest.requiredMediaRoles : [],
    captureStatus: typeof manifest?.captureStatus === 'string' ? manifest.captureStatus : '',
    captureMessage: typeof manifest?.captureMessage === 'string' ? manifest.captureMessage : '',
    status: timedOut || result.status === null ? 1 : result.status,
    timedOut: Boolean(timedOut),
    stdout: String(result.stdout || '').trim(),
    stderr: timedOut
      ? `Reference capture timed out after ${options.timeoutMs}ms. ${String(result.stderr || '').trim()}`.trim()
      : String(result.stderr || '').trim(),
    quality,
  };
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

function parseTimeoutMs(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 300000;
  }

  return parsed;
}

function referenceLayoutFiles(outDir, manifest) {
  const layouts = Array.isArray(manifest?.layouts) && manifest.layouts.length > 0
    ? manifest.layouts
    : Array.isArray(manifest?.layoutCapture?.layouts) && manifest.layoutCapture.layouts.length > 0
      ? manifest.layoutCapture.layouts
      : [];

  if (layouts.length > 0) {
    return layouts
      .filter((layout) => layout && typeof layout === 'object' && typeof layout.file === 'string' && layout.file.trim())
      .map((layout) => path.join(outDir, layout.file));
  }

  return manifest?.layout ? [path.join(outDir, manifest.layout)] : [];
}

function auditReferenceQuality(manifest, expectedViewportCount) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['reference-manifest.json was not created.'] };
  }

  if (manifest.captureStatus && manifest.captureStatus !== 'complete') {
    const message = manifest.captureMessage ? ` ${manifest.captureMessage}` : '';
    errors.push(`reference capture status is ${manifest.captureStatus}.${message}`);
  }

  const layoutStatus = manifest.layoutCapture?.status || 'skipped';
  if (layoutStatus !== 'ok') {
    errors.push(`layoutCapture.status is ${layoutStatus}.`);
  }

  const layouts = normalizedLayoutEntries(manifest);
  if (layouts.length < expectedViewportCount) {
    errors.push(`Expected ${expectedViewportCount} rendered layout snapshot(s), found ${layouts.length}.`);
  }
  for (const layout of layouts) {
    if (layout.status !== 'ok') {
      errors.push(`Rendered layout "${layout.label || layout.file || 'unknown'}" is ${layout.status || 'missing'}.`);
    }
    if (!layout.file) {
      errors.push(`Rendered layout "${layout.label || 'unknown'}" is missing a file.`);
    }
  }

  const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
  if (screenshots.length === 0) {
    errors.push('No reference screenshots were captured.');
  } else if (screenshots.length < expectedViewportCount) {
    errors.push(`Expected ${expectedViewportCount} screenshot(s), found ${screenshots.length}.`);
  }

  const roleCounts = mediaSurfaceRoleCounts(manifest.mediaSurfaces);
  const requiredRoles = requiredRoleMinimums(manifest.requiredMediaRoles, { hero: 1, 'service-card': 1 });

  for (const [role, minimum] of Object.entries(requiredRoles)) {
    if (!Number.isFinite(roleCounts[role]) || roleCounts[role] < minimum) {
      errors.push(`Missing rendered "${role}" media role (${roleCounts[role] || 0}/${minimum}).`);
    }
  }

  errors.push(...roleScaleQualityErrors(manifest.mediaSurfaces, requiredRoles, 'Reference'));

  return {
    ok: errors.length === 0,
    errors,
  };
}

function normalizedLayoutEntries(manifest) {
  const layouts = Array.isArray(manifest?.layouts) && manifest.layouts.length > 0
    ? manifest.layouts
    : Array.isArray(manifest?.layoutCapture?.layouts) && manifest.layoutCapture.layouts.length > 0
      ? manifest.layoutCapture.layouts
      : [];

  if (layouts.length > 0) {
    return layouts.map((layout) => ({
      label: typeof layout?.label === 'string' ? layout.label.trim() : '',
      file: typeof layout?.file === 'string' ? layout.file.trim() : '',
      status: typeof layout?.status === 'string' ? layout.status.trim() : '',
    }));
  }

  const layoutFile = typeof manifest?.layout === 'string' ? manifest.layout.trim() : '';
  return layoutFile
    ? [{
      label: 'primary',
      file: layoutFile,
      status: typeof manifest?.layoutCapture?.status === 'string' ? manifest.layoutCapture.status : 'ok',
    }]
    : [];
}

function buildReport(options, results) {
  const ok = results.every((result) => result.status === 0 && result.quality.ok);

  return {
    generatedAt: new Date().toISOString(),
    ok,
    outDir: options.outDir,
    references: results.map((result) => ({
      label: result.label,
      archetype: result.archetype,
      url: result.url,
      outDir: result.outDir,
      manifest: result.manifest,
      brief: result.brief,
      layout: result.layout,
      layouts: result.layouts,
      layoutCount: result.layoutCount,
      screenshotCount: result.screenshotCount,
      mediaCount: result.mediaCount,
      roleCounts: result.roleCounts,
      scaledRoleCounts: result.scaledRoleCounts,
      requiredMediaRoles: result.requiredMediaRoles,
      captureStatus: result.captureStatus,
      captureMessage: result.captureMessage,
      status: result.status,
      timedOut: result.timedOut,
      quality: result.quality,
      stderr: result.stderr,
    })),
  };
}

function writeReport(report, options) {
  fs.mkdirSync(options.outDir, { recursive: true });
  fs.writeFileSync(path.join(options.outDir, 'reference-suite-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(options.outDir, 'REFERENCE-SUITE.md'), renderMarkdown(report));
}

function renderMarkdown(report) {
  const lines = [
    '# Monteby Reference Suite',
    '',
    `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Generated: ${report.generatedAt}`,
    `- Output: \`${report.outDir}\``,
    '',
    '## References',
    '',
  ];

  for (const reference of report.references) {
    lines.push(`- ${reference.label}: ${reference.quality.ok && reference.status === 0 ? 'PASS' : 'FAIL'}`);
    lines.push(`  - URL: ${reference.url}`);
    lines.push(`  - Manifest: \`${reference.manifest}\``);
    lines.push(`  - Brief: \`${reference.brief}\``);
    lines.push(`  - Layout: \`${reference.layout || 'missing'}\``);
    lines.push(`  - Layout snapshots: ${reference.layoutCount || 0}`);
    lines.push(`  - Screenshots: ${reference.screenshotCount}`);
    lines.push(`  - Media: ${reference.mediaCount}`);
    if (reference.captureStatus) {
      lines.push(`  - Capture status: ${reference.captureStatus}${reference.captureMessage ? ` - ${reference.captureMessage}` : ''}`);
    }
    lines.push(`  - Roles: ${formatRoleCounts(reference.roleCounts)}`);
    lines.push(`  - Scaled roles: ${formatRoleCounts(reference.scaledRoleCounts)}`);
    lines.push(`  - Required roles: ${formatRequiredRoles(reference.requiredMediaRoles)}`);
    for (const error of reference.quality.errors) {
      lines.push(`  - Error: ${error}`);
    }
    if (reference.timedOut) {
      lines.push(`  - Error: Capture timed out.`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatRoleCounts(roleCounts) {
  const roles = ['hero', 'secondary', 'service-card', 'reference-media'];
  const parts = roles
    .filter((role) => Number.isFinite(roleCounts?.[role]) && roleCounts[role] > 0)
    .map((role) => `${role}:${roleCounts[role]}`);

  return parts.length > 0 ? parts.join(', ') : 'none';
}

function formatRequiredRoles(requiredRoles) {
  const minimums = requiredRoleMinimums(requiredRoles);
  const roles = ['hero', 'secondary', 'service-card', 'reference-media'];
  const parts = roles
    .filter((role) => Number.isFinite(minimums[role]) && minimums[role] > 0)
    .map((role) => `${role}:${minimums[role]}`);

  return parts.length > 0 ? parts.join(', ') : 'none detected';
}

function printSummary(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`monteby_reference_suite=${report.ok ? 'ok' : 'failed'}`);
  console.log(`out_dir=${report.outDir}`);
  console.log(`report_json=${path.join(report.outDir, 'reference-suite-report.json')}`);
  console.log(`report_markdown=${path.join(report.outDir, 'REFERENCE-SUITE.md')}`);
  for (const reference of report.references) {
    console.log(`${reference.label}=${reference.quality.ok && reference.status === 0 ? 'ok' : 'failed'} roles=${formatRoleCounts(reference.roleCounts)}`);
    if (reference.timedOut) {
      console.log(`${reference.label}_timeout=true`);
    }
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    fs.mkdirSync(options.outDir, { recursive: true });
    const results = options.references.map((reference) => runCapture(reference, options));
    const report = buildReport(options, results);
    writeReport(report, options);
    printSummary(report, options.json);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
