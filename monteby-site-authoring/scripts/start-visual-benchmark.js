#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { runBoundedProcess } = require('./bounded-child-process');
const { captureViewportTimeoutMs } = require('./capture-template-reference');
const {
  mediaSurfaceRoleCounts,
  requiredRoleMinimums,
  roleScaleQualityErrors,
  scaledMediaSurfaceRoleCounts,
} = require('./media-role-scale');

const GENERIC_MEASURED_REFERENCE = 'generic-measured-reference';
const DEFAULT_BENCHMARK_VIEWPORT_COUNT = 3;
const SPECIALIZED_REFERENCE_ARCHETYPES = new Set([
  'luxury-car-care',
  'maid-service-agency',
  'optomatta-optical-retail',
  'lumen-eye-care-editorial',
]);

function parseArgs(argv) {
  const options = {
    label: 'benchmark-start',
    seed: String(Date.now()),
    variant: 'auto',
    archetype: '',
    archetypeSource: '',
    referenceClassification: null,
    marketplaceReference: false,
    referenceUrls: [],
    referenceHtmlFile: '',
    referenceOutDir: '',
    referenceWaitMs: '3500',
    outDir: '',
    viewports: [],
    fullPage: true,
    waitMs: '1000',
    channel: '',
    playwrightPackage: 'playwright@1.54.1',
    viewportTimeoutMs: 0,
    requireMarketplace: false,
    out: '',
    markdown: '',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--label') {
      options.label = requiredValue(argv, index += 1, arg);
    } else if (arg === '--seed') {
      options.seed = requiredValue(argv, index += 1, arg);
    } else if (arg === '--variant') {
      options.variant = requiredValue(argv, index += 1, arg);
    } else if (arg === '--archetype') {
      options.archetype = requiredValue(argv, index += 1, arg);
      options.archetypeSource = 'cli';
    } else if (arg === '--marketplace-reference') {
      options.marketplaceReference = true;
    } else if (arg === '--reference-url') {
      options.referenceUrls.push(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-html-file') {
      options.referenceHtmlFile = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-out-dir') {
      options.referenceOutDir = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-wait-ms') {
      options.referenceWaitMs = requiredValue(argv, index += 1, arg);
    } else if (arg === '--out-dir') {
      options.outDir = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--viewport') {
      options.viewports.push(requiredValue(argv, index += 1, arg));
    } else if (arg === '--full-page') {
      options.fullPage = true;
    } else if (arg === '--viewport-only') {
      options.fullPage = false;
    } else if (arg === '--wait-ms') {
      options.waitMs = requiredValue(argv, index += 1, arg);
    } else if (arg === '--channel') {
      options.channel = requiredValue(argv, index += 1, arg);
    } else if (arg === '--playwright-package') {
      options.playwrightPackage = requiredValue(argv, index += 1, arg);
    } else if (arg === '--viewport-timeout-ms') {
      options.viewportTimeoutMs = parsePositiveInteger(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--require-marketplace') {
      options.requireMarketplace = true;
    } else if (arg === '--out') {
      options.out = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--markdown') {
      options.markdown = path.resolve(requiredValue(argv, index += 1, arg));
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
    options.outDir = path.join(os.tmpdir(), `monteby-visual-target-${slugify(options.seed)}`);
  }

  if (!options.out) {
    options.out = path.join(options.outDir, 'benchmark-start-report.json');
  }

  if (!options.markdown) {
    options.markdown = path.join(options.outDir, 'NEXT-STEPS.md');
  }

  if (options.referenceHtmlFile) {
    if (!fs.existsSync(options.referenceHtmlFile) || !fs.statSync(options.referenceHtmlFile).isFile()) {
      throw new Error(`--reference-html-file does not exist or is not a file: ${options.referenceHtmlFile}`);
    }
    if (options.referenceUrls.length === 0) {
      options.referenceUrls.push(pathToFileURL(options.referenceHtmlFile).toString());
    }
  }

  const hasRemoteReference = options.referenceUrls.some((url) => /^https?:\/\//i.test(url));
  if (hasRemoteReference) {
    options.marketplaceReference = true;
  }

  if (options.marketplaceReference && options.referenceUrls.length > 0) {
    if (!options.archetype) {
      options.archetype = inferArchetypeFromReferenceUrls(options.referenceUrls);
      options.archetypeSource = options.archetype ? 'url' : '';
    }
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

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  start-visual-benchmark.js [--seed value] [--variant auto|split-hero|editorial-ledger|bento-showcase|tabbed-program|marketplace-service] [--archetype name] [--marketplace-reference] [--reference-url url | --reference-html-file file] [--out-dir dir] [--viewport label:WIDTHxHEIGHT] [--full-page | --viewport-only] [--viewport-timeout-ms milliseconds] [--channel chrome] [--json]

Options:
  --reference-html-file <file>  Capture a local HTML document as the measured reference; no remote URL is required.
  --full-page                  Capture complete responsive pages. This is the default authoring benchmark mode.
  --viewport-only              Capture only the first viewport for a faster diagnostic run.
  --viewport-timeout-ms <ms>  Positive timeout for each reference and target browser viewport capture. Default: capture auto

Captures real template references when provided, generates a visual target with screenshots and target-layout.json, runs target preflight, and writes a start report with next-step commands for clean Monteby JSON recreation.`);
}

function slugify(input) {
  const slug = String(input).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'target';
}

function inferArchetypeFromReferenceUrls(urls) {
  const joined = urls.join(' ').toLowerCase();
  if (joined.includes('optomatta')) {
    return 'optomatta-optical-retail';
  }
  if (joined.includes('lumen')) {
    return 'lumen-eye-care-editorial';
  }
  if (joined.includes('maidy')) {
    return 'maid-service-agency';
  }
  if (joined.includes('careglo') || joined.includes('studioniskala') || /\/car(?:\/|-)/.test(joined)) {
    return 'luxury-car-care';
  }
  return '';
}

function inferArchetypeFromReferenceRuns(referenceRuns) {
  const evidence = referenceRuns
    .map(referenceEvidenceText)
    .join(' ')
    .toLowerCase();

  if (!evidence.trim()) {
    return '';
  }

  if (/\b(optomatta|eyewear|eye\s*wear|glasses|frames?|lens(?:es)?|optical retail|optometrist|vision exam|eye exam)\b/i.test(evidence)) {
    return 'optomatta-optical-retail';
  }
  if (/\b(lumen|see better|live better|eye care|eye-care|doctor|specialists?|licensed|qualified|clinic|clinical)\b/i.test(evidence)) {
    return 'lumen-eye-care-editorial';
  }
  if (/\b(maidy|maid|cleaning|cleaner|housekeeping|home care|home cleaning|vacuum|dirty scene|clean fresh|clean & fresh)\b/i.test(evidence)) {
    return 'maid-service-agency';
  }
  if (/\b(careglo|car detailing|auto detailing|detailing|vehicle|automotive|ceramic|paint correction|luxury finish|detail bay|car care)\b/i.test(evidence)) {
    return 'luxury-car-care';
  }

  return '';
}

function referenceEvidenceText(referenceRun) {
  const parts = [referenceRun?.url || ''];

  const manifest = readOptionalJson(referenceRun?.manifest);
  if (manifest) {
    parts.push(
      manifest.sourceUrl || '',
      manifest.title || '',
      manifest.referenceStyle || '',
      ...(Array.isArray(manifest.media) ? manifest.media : []),
      ...(Array.isArray(manifest.imageSources) ? manifest.imageSources : []),
      ...mediaSurfaceEvidence(manifest.mediaSurfaces)
    );
  }

  const brief = readOptionalJson(referenceRun?.briefJson);
  if (brief) {
    parts.push(
      brief.sourceUrl || '',
      brief.text?.title || '',
      ...arrayOfStrings(brief.text?.h1),
      ...arrayOfStrings(brief.text?.h2),
      ...arrayOfStrings(brief.text?.h3),
      ...arrayOfStrings(brief.text?.ctas),
      ...arrayOfStrings(brief.text?.stats),
      ...mediaSurfaceEvidence(brief.media?.surfaces)
    );
  }

  return parts.filter(Boolean).join(' ');
}

function resolveReferenceArchetype(options, referenceRuns) {
  if (options.referenceUrls.length === 0) {
    options.archetypeInference = {
      archetype: options.archetype,
      source: options.archetypeSource || (options.archetype ? 'unknown' : 'none'),
    };
    options.referenceClassification = {
      kind: 'generated-target',
      family: options.archetype || '',
      familyMechanics: SPECIALIZED_REFERENCE_ARCHETYPES.has(options.archetype),
      source: options.archetypeSource || (options.archetype ? 'explicit' : 'none'),
    };
    return;
  }

  if (options.archetype) {
    options.archetypeInference = {
      archetype: options.archetype,
      source: options.archetypeSource || 'explicit',
    };
    options.referenceClassification = {
      kind: SPECIALIZED_REFERENCE_ARCHETYPES.has(options.archetype) ? 'specialized-family' : 'explicit-archetype',
      family: options.archetype,
      familyMechanics: SPECIALIZED_REFERENCE_ARCHETYPES.has(options.archetype),
      source: options.archetypeSource || 'explicit',
    };
    return;
  }

  if (options.marketplaceReference === false) {
    options.archetypeInference = {
      archetype: '',
      source: GENERIC_MEASURED_REFERENCE,
    };
    options.referenceClassification = {
      kind: GENERIC_MEASURED_REFERENCE,
      family: '',
      familyMechanics: false,
      source: 'captured-reference-layout',
    };
    return;
  }

  const inferred = inferArchetypeFromReferenceRuns(referenceRuns);
  if (inferred) {
    options.archetype = inferred;
    options.archetypeSource = 'reference-content';
    options.archetypeInference = {
      archetype: inferred,
      source: 'reference-content',
    };
    options.referenceClassification = {
      kind: 'specialized-family',
      family: inferred,
      familyMechanics: true,
      source: 'reference-content',
    };
    return;
  }

  options.archetypeInference = {
    archetype: '',
    source: GENERIC_MEASURED_REFERENCE,
  };
  options.referenceClassification = {
    kind: GENERIC_MEASURED_REFERENCE,
    family: '',
    familyMechanics: false,
    source: 'captured-reference-layout',
  };
}

function mediaSurfaceEvidence(mediaSurfaces) {
  if (!Array.isArray(mediaSurfaces)) {
    return [];
  }

  return mediaSurfaces.flatMap((surface) => {
    if (!surface || typeof surface !== 'object') {
      return [];
    }
    return [
      surface.source,
      surface.description,
      surface.role,
      surface.placement,
    ].filter((value) => typeof value === 'string');
  });
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function readOptionalJson(file) {
  if (!file || !fs.existsSync(file)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

function scriptPath(name) {
  return path.join(__dirname, name);
}

function childProcessTotalTimeoutMs(options) {
  const viewportCount = options.viewports.length > 0
    ? options.viewports.length
    : DEFAULT_BENCHMARK_VIEWPORT_COUNT;
  const waitMs = Math.max(
    Number(options.waitMs) || 0,
    Number(options.referenceWaitMs) || 0
  );
  const perViewportTimeoutMs = captureViewportTimeoutMs({
    viewportTimeoutMs: options.viewportTimeoutMs,
    waitMs,
  }, {});
  const setupMarginMs = Math.min(60000, Math.max(1000, Math.ceil(perViewportTimeoutMs / 5)));
  const totalTimeoutMs = (perViewportTimeoutMs * viewportCount) + setupMarginMs;

  if (!Number.isSafeInteger(totalTimeoutMs)) {
    throw new Error('Derived child process timeout exceeds the safe integer range');
  }

  return totalTimeoutMs;
}

async function runScript(script, args, timeoutMs) {
  const result = await runBoundedProcess(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    timeoutMs,
  });
  const timeoutMessage = result.timedOut
    ? `[benchmark_child_timeout] ${path.basename(script)} exceeded its ${timeoutMs}ms total process bound; termination was requested for the child and browser descendants.`
    : '';
  const spawnErrorMessage = result.error instanceof Error ? result.error.message : '';

  return {
    script,
    status: result.status,
    stdout: result.stdout,
    stderr: [result.stderr.trim(), timeoutMessage, spawnErrorMessage].filter(Boolean).join('\n'),
    code: result.code,
    timedOut: result.timedOut,
    timeoutMs: result.timeoutMs,
    terminationAttempted: result.terminationAttempted,
    forceKillSent: result.forceKillSent,
  };
}

async function runJsonScript(script, args, timeoutMs) {
  const run = await runScript(script, args, timeoutMs);
  return {
    ...run,
    report: parseJsonOutput(run.stdout, script),
  };
}

function parseJsonOutput(stdout, script) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) {
    throw new Error(`${path.basename(script)} did not print JSON output.`);
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`${path.basename(script)} printed invalid JSON output: ${error.message}`);
  }
}

function generatorArgs(options) {
  const genericMeasuredReference = options.referenceClassification?.kind === GENERIC_MEASURED_REFERENCE;
  const variant = genericMeasuredReference && ['auto', 'marketplace-service'].includes(options.variant)
    ? 'split-hero'
    : options.variant;
  const args = [
    '--seed',
    options.seed,
    '--variant',
    variant,
    '--out-dir',
    options.outDir,
    '--capture-screenshots',
    '--wait-ms',
    options.waitMs,
    '--playwright-package',
    options.playwrightPackage,
  ];

  if (options.archetype) {
    args.push('--archetype', options.archetype);
  }
  if (options.marketplaceReference && !genericMeasuredReference) {
    args.push('--marketplace-reference');
  }
  if (options.fullPage) {
    args.push('--full-page');
  }
  if (options.channel) {
    args.push('--channel', options.channel);
  }
  if (options.viewportTimeoutMs > 0) {
    args.push('--viewport-timeout-ms', String(options.viewportTimeoutMs));
  }
  for (const viewport of options.viewports) {
    args.push('--viewport', viewport);
  }

  return args;
}

function referenceCaptureArgs(options, url, outDir, index) {
  const args = [
    '--url',
    url,
    '--out-dir',
    outDir,
    '--name',
    'reference',
    '--wait-ms',
    options.referenceWaitMs,
    '--playwright-package',
    options.playwrightPackage,
  ];

  if (options.viewportTimeoutMs > 0) {
    args.push('--viewport-timeout-ms', String(options.viewportTimeoutMs));
  }

  if (options.referenceHtmlFile && index === 0) {
    args.push('--html-file', options.referenceHtmlFile);
  }
  args.push('--capture-layout');
  if (options.fullPage) {
    args.push('--full-page');
  }
  if (options.channel) {
    args.push('--channel', options.channel);
  }
  for (const viewport of options.viewports) {
    args.push('--viewport', viewport);
  }

  return args;
}

async function runReferenceCaptures(options) {
  const captures = [];

  for (let index = 0; index < options.referenceUrls.length; index += 1) {
    const url = options.referenceUrls[index];
    const outDir = referenceOutDir(options, url, index);
    const run = await runScript(
      scriptPath('capture-template-reference.js'),
      referenceCaptureArgs(options, url, outDir, index),
      options.childProcessTimeoutMs
    );
    const manifestPath = path.join(outDir, 'reference-manifest.json');
    const manifest = run.status === 0 && fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : null;

    captures.push({
      url,
      outDir,
      manifest: manifestPath,
      brief: path.join(outDir, manifest?.brief || 'REFERENCE-BRIEF.md'),
      briefJson: path.join(outDir, manifest?.briefJson || 'reference-brief.json'),
      layout: manifest?.layout ? path.join(outDir, manifest.layout) : '',
      layouts: referenceLayoutFiles(outDir, manifest),
      captureStatus: typeof manifest?.captureStatus === 'string' ? manifest.captureStatus : 'unknown',
      captureMessage: typeof manifest?.captureMessage === 'string' ? manifest.captureMessage : '',
      evidenceCompleteness: manifest?.evidenceCompleteness && typeof manifest.evidenceCompleteness === 'object'
        ? manifest.evidenceCompleteness
        : manifest?.layoutCapture?.evidenceCompleteness && typeof manifest.layoutCapture.evidenceCompleteness === 'object'
          ? manifest.layoutCapture.evidenceCompleteness
          : null,
      layoutCaptureStatus: manifest?.layoutCapture?.status || 'skipped',
      layoutCaptureError: manifest?.layoutCapture?.error || '',
      mediaSurfaces: Array.isArray(manifest?.mediaSurfaces) ? manifest.mediaSurfaces : [],
      mediaSurfaceRoleCounts: mediaSurfaceRoleCounts(manifest?.mediaSurfaces),
      mediaSurfaceScaleCounts: scaledMediaSurfaceRoleCounts(manifest?.mediaSurfaces),
      requiredMediaRoles: Array.isArray(manifest?.requiredMediaRoles) ? manifest.requiredMediaRoles : [],
      screenshots: Array.isArray(manifest?.screenshots)
        ? manifest.screenshots.map((screenshot) => path.join(outDir, screenshot.file || ''))
        : [],
      mediaCount: typeof manifest?.mediaCount === 'number' ? manifest.mediaCount : 0,
      status: run.status,
      stderr: run.stderr.trim(),
      timedOut: run.timedOut,
      timeoutMs: run.timeoutMs,
    });
  }

  return captures;
}

function referenceLayoutFiles(outDir, manifest) {
  if (Array.isArray(manifest?.layouts) && manifest.layouts.length > 0) {
    return manifest.layouts
      .filter((layout) => layout && typeof layout === 'object' && typeof layout.file === 'string' && layout.file.trim())
      .map((layout) => path.join(outDir, layout.file));
  }

  return manifest?.layout ? [path.join(outDir, manifest.layout)] : [];
}

function referenceQualityErrors(referenceRuns, requireFamilyMedia) {
  const errors = [];
  for (const run of referenceRuns) {
    if (run.status !== 0) {
      continue;
    }
    if (run.layoutCaptureStatus !== 'ok') {
      errors.push(`${run.url}: rendered layout capture is ${run.layoutCaptureStatus}. ${run.layoutCaptureError || 'reference-layout.json is required for real template references.'}`);
      continue;
    }

    const evidence = run.evidenceCompleteness;
    const evidenceStatus = typeof evidence?.status === 'string' ? evidence.status : 'unknown';
    const evidenceReasons = Array.isArray(evidence?.reasons)
      ? evidence.reasons.filter((reason) => typeof reason === 'string' && reason.trim())
      : [];
    const incompleteViewport = Array.isArray(evidence?.viewports)
      ? evidence.viewports.find((viewport) => (
        viewport?.complete !== true
        || viewport?.status !== 'complete'
        || viewport?.essentialGeometryTruncated === true
        || (Array.isArray(viewport?.reasons) && viewport.reasons.length > 0)
      ))
      : null;
    const captureIncomplete = run.captureStatus !== 'complete';
    const evidenceIncomplete = !evidence
      || evidence.complete !== true
      || evidenceStatus !== 'complete'
      || evidence.essentialGeometryTruncated === true
      || evidenceReasons.length > 0
      || Boolean(incompleteViewport);

    if (captureIncomplete || evidenceIncomplete) {
      const reasons = evidenceReasons.length > 0
        ? ` Reasons: ${evidenceReasons.join(', ')}.`
        : '';
      const viewport = incompleteViewport
        ? ` Incomplete viewport: ${incompleteViewport.label || incompleteViewport.file || 'unknown'}.`
        : '';
      const message = run.captureMessage ? ` ${run.captureMessage}` : '';
      errors.push(`${run.url}: reference capture is incomplete (captureStatus=${run.captureStatus}, evidenceStatus=${evidenceStatus}).${message}${reasons}${viewport} Drafting is blocked until every requested viewport reports complete evidence.`);
    }

    const requiredRoles = requiredRoleMinimums(
      run.requiredMediaRoles,
      requireFamilyMedia ? { hero: 1, 'service-card': 1 } : {}
    );

    for (const [role, minimum] of Object.entries(requiredRoles)) {
      if (!Number.isFinite(run.mediaSurfaceRoleCounts[role]) || run.mediaSurfaceRoleCounts[role] < minimum) {
        errors.push(`${run.url}: missing rendered "${role}" media role in reference-manifest.json (${run.mediaSurfaceRoleCounts[role] || 0}/${minimum}).`);
      }
    }

    errors.push(...roleScaleQualityErrors(run.mediaSurfaces, requiredRoles, run.url));
  }

  return errors;
}

function referenceOutDir(options, url, index) {
  if (options.referenceOutDir && options.referenceUrls.length === 1) {
    return options.referenceOutDir;
  }

  const label = referenceLabel(url, index);
  const root = options.referenceOutDir || path.join(options.outDir, 'references');
  return path.join(root, label);
}

function referenceLabel(url, index) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathPart = parsed.pathname.split('/').filter(Boolean).slice(0, 2).join('-');
    return slugify(`${index + 1}-${host}-${pathPart}`);
  } catch (error) {
    return slugify(`${index + 1}-reference`);
  }
}

function targetAuditArgs(options, requireMarketplace) {
  const args = [
    '--target-dir',
    options.outDir,
    '--require-screenshots',
    '--json',
  ];

  if (requireMarketplace) {
    args.push('--require-marketplace');
    args.push('--require-rendered-media');
  }

  return args;
}

function visualBriefArgs(options) {
  return [
    '--target-dir',
    options.outDir,
    '--out',
    visualBriefPath(options),
    '--json',
  ];
}

function targetLayoutCaptureArgs(options) {
  const targetHtml = path.join(options.outDir, 'target.html');
  const args = [
    '--url',
    pathToFileURL(targetHtml).toString(),
    '--html-file',
    targetHtml,
    '--out-dir',
    path.join(options.outDir, 'target-rendered'),
    '--name',
    'target',
    '--wait-ms',
    options.waitMs,
    '--playwright-package',
    options.playwrightPackage,
    ...(options.viewportTimeoutMs > 0
      ? ['--viewport-timeout-ms', String(options.viewportTimeoutMs)]
      : []),
    '--capture-layout',
    '--skip-screenshots',
    ...(options.fullPage ? ['--full-page'] : []),
  ];

  if (options.channel) {
    args.push('--channel', options.channel);
  }
  for (const viewport of options.viewports) {
    args.push('--viewport', viewport);
  }

  return args;
}

function attachTargetLayout(options, manifest) {
  const renderedDir = path.join(options.outDir, 'target-rendered');
  const renderedManifestPath = path.join(renderedDir, 'reference-manifest.json');

  if (!fs.existsSync(renderedManifestPath)) {
    return { manifest, layoutCaptureStatus: 'missing', layoutCaptureError: 'target-rendered/reference-manifest.json was not created.' };
  }

  const renderedManifest = JSON.parse(fs.readFileSync(renderedManifestPath, 'utf8'));
  const copiedLayouts = copyTargetLayouts(options, renderedDir, renderedManifest);
  const primaryLayout = copiedLayouts[0] || {
    status: renderedManifest?.layoutCapture?.status || 'missing',
    file: '',
    error: renderedManifest?.layoutCapture?.error || 'target-rendered/reference-layout.json was not created.',
  };
  const failedLayout = copiedLayouts.find((layout) => layout.status !== 'ok');
  const layoutCaptureStatus = failedLayout ? 'failed' : primaryLayout.status || 'missing';
  const layoutCaptureError = failedLayout ? failedLayout.error || 'Generated target layout capture failed.' : primaryLayout.error || '';

  const updatedManifest = {
    ...manifest,
    layout: primaryLayout.file || '',
    layouts: copiedLayouts,
    layoutCapture: {
      status: layoutCaptureStatus,
      file: primaryLayout.file || '',
      error: layoutCaptureError,
      layouts: copiedLayouts,
    },
    renderedMediaCount: typeof renderedManifest?.renderedMediaCount === 'number'
      ? renderedManifest.renderedMediaCount
      : manifest.renderedMediaCount || 0,
    renderedMediaSurfaces: Array.isArray(renderedManifest?.mediaSurfaces)
      ? renderedManifest.mediaSurfaces
      : [],
  };

  const targetManifestPath = path.join(options.outDir, 'target-manifest.json');
  fs.writeFileSync(targetManifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);

  return {
    manifest: updatedManifest,
    layoutCaptureStatus: updatedManifest.layoutCapture.status,
    layoutCaptureError: updatedManifest.layoutCapture.error || '',
  };
}

function copyTargetLayouts(options, renderedDir, renderedManifest) {
  const renderedLayouts = Array.isArray(renderedManifest?.layouts) && renderedManifest.layouts.length > 0
    ? renderedManifest.layouts
    : fallbackRenderedLayouts(renderedManifest);

  return renderedLayouts.map((layout, index) => copyTargetLayout(options, renderedDir, layout, index));
}

function fallbackRenderedLayouts(renderedManifest) {
  const layoutFile = typeof renderedManifest?.layout === 'string' ? renderedManifest.layout.trim() : '';
  if (!layoutFile && !renderedManifest?.layoutCapture) {
    return [];
  }

  return [{
    label: 'desktop',
    width: 0,
    height: 0,
    file: layoutFile || 'reference-layout.json',
    status: renderedManifest?.layoutCapture?.status || 'missing',
    error: renderedManifest?.layoutCapture?.error || '',
  }];
}

function copyTargetLayout(options, renderedDir, layout, index) {
  const sourceFile = typeof layout?.file === 'string' ? layout.file.trim() : '';
  const sourcePath = sourceFile ? path.join(renderedDir, sourceFile) : '';
  const targetFile = index === 0 ? 'target-layout.json' : `target-layout-${slugify(layout?.label || `viewport-${index + 1}`)}.json`;
  const targetPath = path.join(options.outDir, targetFile);
  const status = typeof layout?.status === 'string' ? layout.status : 'missing';
  const canCopy = status === 'ok' && sourcePath && fs.existsSync(sourcePath);

  if (canCopy) {
    fs.copyFileSync(sourcePath, targetPath);
  }

  return {
    label: typeof layout?.label === 'string' ? layout.label : '',
    width: Number.isFinite(layout?.width) ? layout.width : 0,
    height: Number.isFinite(layout?.height) ? layout.height : 0,
    file: canCopy ? targetFile : '',
    status: canCopy ? 'ok' : status,
    error: canCopy ? '' : layout?.error || (sourceFile ? `Missing rendered layout file: ${sourceFile}` : 'Rendered layout file is missing.'),
  };
}

function visualBriefPath(options) {
  return path.join(options.outDir, 'VISUAL-BRIEF.md');
}

function shouldRequireMarketplace(options, manifest) {
  if (options.referenceClassification?.kind === GENERIC_MEASURED_REFERENCE) {
    return options.requireMarketplace;
  }

  return options.requireMarketplace
    || options.marketplaceReference
    || Boolean(options.archetype)
    || options.variant === 'marketplace-service'
    || manifest?.variant === 'marketplace-service';
}

function buildGenerateFailureReport(options, referenceRuns, generateRun) {
  const targetHtml = path.join(options.outDir, 'target.html');
  const targetManifest = path.join(options.outDir, 'target-manifest.json');
  const partialManifest = readOptionalJson(targetManifest);
  const screenshots = fs.existsSync(options.outDir)
    ? fs.readdirSync(options.outDir)
      .filter((file) => /^target-[a-z0-9-]+\.png$/i.test(file))
      .map((file) => path.join(options.outDir, file))
    : [];
  const code = generateRun.timedOut
    ? 'generated_target_process_timeout'
    : partialManifest?.captureFailure?.code || 'generated_target_failed';
  const message = generateRun.stderr.trim() || partialManifest?.captureFailure?.message || 'Generated fallback target failed.';
  const partialArtifacts = [targetHtml, targetManifest, ...screenshots].filter((file) => fs.existsSync(file));

  return {
    label: options.label,
    generatedAt: new Date().toISOString(),
    ok: false,
    failure: {
      code,
      stage: 'generated-fallback',
      message,
      timedOut: generateRun.timedOut || code === 'generated_target_viewport_timeout',
      timeoutMs: generateRun.timedOut
        ? generateRun.timeoutMs
        : partialManifest?.captureFailure?.timeoutMs || 0,
      terminationAttempted: generateRun.terminationAttempted === true
        || partialManifest?.captureFailure?.terminationAttempted === true,
      forceKillSent: generateRun.forceKillSent === true
        || partialManifest?.captureFailure?.forceKillSent === true,
      partialArtifacts,
    },
    options: {
      seed: options.seed,
      variant: options.variant,
      archetype: options.archetype,
      marketplaceReference: options.marketplaceReference,
      referenceUrls: options.referenceUrls,
      fullPage: options.fullPage,
      viewportTimeoutMs: options.viewportTimeoutMs,
      childProcessTimeoutMs: options.childProcessTimeoutMs,
    },
    files: {
      outDir: options.outDir,
      targetHtml,
      targetManifest,
      screenshots,
      jsonReport: options.out,
      markdownReport: options.markdown,
    },
    commands: {
      generateTarget: {
        status: generateRun.status,
        code: generateRun.code,
        timedOut: generateRun.timedOut,
        timeoutMs: generateRun.timeoutMs,
        terminationAttempted: generateRun.terminationAttempted,
        forceKillSent: generateRun.forceKillSent,
        stderr: generateRun.stderr.trim(),
      },
      referenceCapture: referenceRuns.map((run) => ({
        url: run.url,
        status: run.status,
        captureStatus: run.captureStatus,
        manifest: run.manifest,
        screenshots: run.screenshots,
      })),
    },
    target: partialManifest,
  };
}

function buildReport(options, referenceRuns, generateRun, targetLayoutRun, targetLayoutResult, targetAuditRun, visualBriefRun, manifest, requireMarketplace) {
  const targetHtml = path.join(options.outDir, 'target.html');
  const targetManifest = path.join(options.outDir, 'target-manifest.json');
  const targetLayout = manifest?.layout ? path.join(options.outDir, manifest.layout) : '';
  const screenshots = Array.isArray(manifest?.screenshots)
    ? manifest.screenshots.map((screenshot) => path.join(options.outDir, screenshot.file || ''))
    : [];
  const referencesOk = referenceRuns.every((run) => run.status === 0);
  const targetLayoutOk = targetLayoutRun.status === 0 && targetLayoutResult.layoutCaptureStatus === 'ok';
  const targetQualityErrors = targetReferenceQualityErrors(referenceRuns, manifest, options.outDir, options);
  const ok = referencesOk
    && generateRun.status === 0
    && targetLayoutOk
    && targetAuditRun.status === 0
    && targetAuditRun.report?.ok === true
    && visualBriefRun.status === 0
    && targetQualityErrors.length === 0;

  return {
    label: options.label,
    generatedAt: new Date().toISOString(),
    ok,
    options: {
      seed: options.seed,
      variant: options.variant,
      archetype: options.archetype,
      archetypeInference: options.archetypeInference || {
        archetype: options.archetype,
        source: options.archetypeSource || '',
      },
      referenceClassification: options.referenceClassification || {
        kind: referenceRuns.length > 0 ? GENERIC_MEASURED_REFERENCE : 'generated-target',
        family: options.archetype || '',
        familyMechanics: false,
        source: 'fallback',
      },
      marketplaceReference: options.marketplaceReference,
      referenceUrls: options.referenceUrls,
      requireMarketplace,
      fullPage: options.fullPage,
      viewportTimeoutMs: options.viewportTimeoutMs,
      childProcessTimeoutMs: options.childProcessTimeoutMs,
    },
    files: {
      outDir: options.outDir,
      targetHtml,
      targetManifest,
      targetLayout,
      screenshots,
      startVisualReview: '',
      visualBrief: visualBriefPath(options),
      jsonReport: options.out,
      markdownReport: options.markdown,
    },
    commands: {
      generateTarget: {
        status: generateRun.status,
        stderr: generateRun.stderr.trim(),
        code: generateRun.code,
        timedOut: generateRun.timedOut,
        timeoutMs: generateRun.timeoutMs,
      },
      targetAudit: {
        status: targetAuditRun.status,
        stderr: targetAuditRun.stderr.trim(),
      },
      targetLayoutCapture: {
        status: targetLayoutRun.status,
        stderr: targetLayoutRun.stderr.trim(),
        code: targetLayoutRun.code,
        timedOut: targetLayoutRun.timedOut,
        timeoutMs: targetLayoutRun.timeoutMs,
        layoutCaptureStatus: targetLayoutResult.layoutCaptureStatus,
        layoutCaptureError: targetLayoutResult.layoutCaptureError,
      },
      visualBrief: {
        status: visualBriefRun.status,
        stderr: visualBriefRun.stderr.trim(),
      },
      referenceCapture: referenceRuns.map((run) => ({
        url: run.url,
        status: run.status,
        captureStatus: run.captureStatus,
        evidenceStatus: run.evidenceCompleteness?.status || 'unknown',
        stderr: run.stderr,
        timedOut: run.timedOut,
        timeoutMs: run.timeoutMs,
      })),
      next: nextCommands(options, targetManifest, referenceRuns),
    },
    references: referenceRuns.map((run) => ({
      url: run.url,
      outDir: run.outDir,
      manifest: run.manifest,
      brief: run.brief,
      briefJson: run.briefJson,
      layout: run.layout,
      layouts: run.layouts,
      captureStatus: run.captureStatus,
      captureMessage: run.captureMessage,
      evidenceCompleteness: run.evidenceCompleteness,
      layoutCaptureStatus: run.layoutCaptureStatus,
      layoutCaptureError: run.layoutCaptureError,
      mediaSurfaceRoleCounts: run.mediaSurfaceRoleCounts,
      mediaSurfaceScaleCounts: run.mediaSurfaceScaleCounts,
      requiredMediaRoles: run.requiredMediaRoles,
      screenshots: run.screenshots,
      mediaCount: run.mediaCount,
    })),
    target: {
      seed: manifest?.seed || '',
      variant: manifest?.variant || '',
      archetype: manifest?.archetype || '',
      referenceStyle: manifest?.referenceStyle || '',
      heroAssetMode: manifest?.heroAssetMode || '',
      equipmentAssetMode: manifest?.equipmentAssetMode || '',
      layout: targetLayout,
      layouts: Array.isArray(manifest?.layouts)
        ? manifest.layouts.map((layout) => layout.file ? path.join(options.outDir, layout.file) : '')
        : [],
      layoutCaptureStatus: manifest?.layoutCapture?.status || 'missing',
      layoutCaptureError: manifest?.layoutCapture?.error || '',
      screenshots: manifest?.screenshots || [],
      mediaSurfaces: manifest?.mediaSurfaces || [],
      requiredMediaRoles: manifest?.requiredMediaRoles || [],
    },
    visualBrief: {
      ...visualBriefRun.report,
      authoringRequirements: {
        ...(visualBriefRun.report?.authoringRequirements || {}),
        referenceClassification: options.referenceClassification || undefined,
      },
    },
    targetAudit: targetAuditRun.report,
    targetQuality: {
      ok: targetQualityErrors.length === 0,
      errors: targetQualityErrors,
    },
  };
}

function attachStartVisualReview(report, options) {
  const visualReview = buildStartVisualReview(report, options);
  report.startVisualReview = visualReview;
  report.files.startVisualReview = visualReview.sheet;
}

function buildStartVisualReview(report, options) {
  const items = startVisualReviewItems(report);
  const warnings = [];
  let sheet = '';

  if (items.length > 0) {
    try {
      sheet = writeStartVisualReviewSheet(items, startVisualReviewSheetPath(options));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    sheet,
    columns: items.length > 0 ? ['real reference', 'generated fallback'] : [],
    items,
    warnings,
  };
}

function startVisualReviewItems(report) {
  if (!Array.isArray(report.references) || report.references.length === 0) {
    return [];
  }

  const targetScreenshots = screenshotMap(report.files?.screenshots || []);
  const items = [];

  for (const reference of report.references) {
    const referenceScreenshots = screenshotMap(reference.screenshots || []);
    const labels = orderedScreenshotLabels([...referenceScreenshots.keys(), ...targetScreenshots.keys()]);

    for (const label of labels) {
      const referenceFile = referenceScreenshots.get(label) || '';
      const fallbackFile = targetScreenshots.get(label) || '';
      if (referenceFile || fallbackFile) {
        items.push({
          label: `${reference.url || 'reference'} ${label}`,
          reference: referenceFile,
          fallback: fallbackFile,
        });
      }
    }
  }

  return items;
}

function screenshotMap(files) {
  const map = new Map();
  for (const file of files) {
    if (typeof file !== 'string' || !file.trim()) {
      continue;
    }
    map.set(screenshotLabel(file), file);
  }
  return map;
}

function screenshotLabel(file) {
  const basename = path.basename(file).toLowerCase();
  const match = basename.match(/(?:reference|target|candidate|diff)-([a-z0-9-]+)\.png$/);
  return match ? match[1] : slugify(path.basename(file, path.extname(file)));
}

function orderedScreenshotLabels(labels) {
  const preferred = ['desktop', 'tablet', 'mobile'];
  const unique = [...new Set(labels.filter(Boolean))];
  return [
    ...preferred.filter((label) => unique.includes(label)),
    ...unique.filter((label) => !preferred.includes(label)).sort(),
  ];
}

function startVisualReviewSheetPath(options) {
  return path.join(options.outDir, 'start-visual-review.png');
}

function writeStartVisualReviewSheet(items, outputPath) {
  const { PNG } = loadPngDependency();
  const maxCellWidth = 480;
  const maxCellHeight = 720;
  const gutter = 24;
  const rowGap = 24;
  const headerHeight = 42;
  const rowLabelHeight = 22;
  const columns = ['reference', 'fallback'];
  const rows = items.map((item) => columns.map((column) => fitSheetCell(readSheetCell(PNG, item[column]), maxCellWidth, maxCellHeight)));
  const rowHeights = rows.map((row) => Math.max(...row.map((cell) => cell.height), 1));
  const width = (maxCellWidth * columns.length) + (gutter * (columns.length + 1));
  const height = headerHeight + rowHeights.reduce((sum, rowHeight) => sum + rowHeight + rowLabelHeight, rowGap) + (rowGap * rowHeights.length);
  const sheet = new PNG({ width, height });

  fillPng(sheet, [255, 255, 255, 255]);
  fillRect(sheet, 0, 0, width, headerHeight, [12, 18, 27, 255]);
  drawText(sheet, 'CAPTURED REAL REFERENCE', gutter, 16, [255, 255, 255, 255], 2);
  drawText(sheet, 'GENERATED FALLBACK TARGET', gutter + maxCellWidth + gutter, 16, [255, 255, 255, 255], 2);

  let y = headerHeight + rowGap;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let x = gutter;
    const rowHeight = rowHeights[rowIndex];
    const rowLabel = sheetRowLabel(items[rowIndex]?.label || `row ${rowIndex + 1}`);

    drawText(sheet, rowLabel, gutter, y, [71, 85, 105, 255], 1);
    y += rowLabelHeight;

    for (const cell of rows[rowIndex]) {
      if (cell.image) {
        drawScaledPng(sheet, cell.image, x, y, cell.width, cell.height);
      }
      x += maxCellWidth + gutter;
    }

    y += rowHeight + rowGap;
  }

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), PNG.sync.write(sheet));

  return path.resolve(outputPath);
}

function sheetRowLabel(label) {
  const normalized = String(label || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\?.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return truncateSheetText(normalized || 'reference', 118);
}

function truncateSheetText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function loadPngDependency() {
  try {
    return {
      PNG: require(require.resolve('pngjs', { paths: [__dirname, process.cwd()] })).PNG,
    };
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Missing dependency "pngjs"; start visual review sheet was not created.');
    }
    throw error;
  }
}

function readSheetCell(PNG, file) {
  if (!file) {
    return null;
  }

  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    return null;
  }

  return PNG.sync.read(fs.readFileSync(resolved));
}

function fitSheetCell(image, maxWidth, maxHeight) {
  if (!image) {
    return { image: null, width: 1, height: 1 };
  }

  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  return {
    image,
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  };
}

function fillPng(image, color) {
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = color[3];
  }
}

function fillRect(image, x, y, width, height, color) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(image.width, Math.ceil(x + width));
  const endY = Math.min(image.height, Math.ceil(y + height));

  for (let row = startY; row < endY; row += 1) {
    for (let column = startX; column < endX; column += 1) {
      setPixel(image, column, row, color);
    }
  }
}

function drawScaledPng(target, source, targetX, targetY, targetWidth, targetHeight) {
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y / targetHeight) * source.height));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / targetWidth) * source.width));
      const sourceOffset = ((sourceY * source.width) + sourceX) * 4;
      const targetOffset = (((targetY + y) * target.width) + targetX + x) * 4;
      target.data[targetOffset] = source.data[sourceOffset];
      target.data[targetOffset + 1] = source.data[sourceOffset + 1];
      target.data[targetOffset + 2] = source.data[sourceOffset + 2];
      target.data[targetOffset + 3] = source.data[sourceOffset + 3];
    }
  }
}

function drawText(image, text, x, y, color, scale = 1) {
  const glyphScale = Math.max(1, Math.floor(scale));
  let cursorX = Math.floor(x);
  const cursorY = Math.floor(y);

  for (const char of String(text || '').toUpperCase()) {
    if (char === ' ') {
      cursorX += 4 * glyphScale;
      continue;
    }

    const glyph = SHEET_FONT[char] || SHEET_FONT['?'];
    drawGlyph(image, glyph, cursorX, cursorY, color, glyphScale);
    cursorX += 6 * glyphScale;
  }
}

function drawGlyph(image, glyph, x, y, color, scale) {
  for (let row = 0; row < glyph.length; row += 1) {
    const pattern = glyph[row];
    for (let column = 0; column < pattern.length; column += 1) {
      if (pattern[column] !== '1') {
        continue;
      }
      fillRect(image, x + (column * scale), y + (row * scale), scale, scale, color);
    }
  }
}

function setPixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }

  const offset = ((y * image.width) + x) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = color[3];
}

const SHEET_FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
};

function targetReferenceQualityErrors(referenceRuns, manifest, outDir, options = {}) {
  if (!Array.isArray(referenceRuns) || referenceRuns.length === 0) {
    return [];
  }
  if (options.referenceClassification?.kind === GENERIC_MEASURED_REFERENCE) {
    return [];
  }

  const errors = [];
  const targetLayout = manifest?.layout ? readOptionalJson(path.join(outDir, manifest.layout)) : null;
  const targetScrollHeight = layoutScrollHeight(targetLayout);
  const targetMediaSurfaces = Math.max(
    Array.isArray(manifest?.mediaSurfaces) ? manifest.mediaSurfaces.length : 0,
    Array.isArray(manifest?.renderedMediaSurfaces) ? manifest.renderedMediaSurfaces.length : 0
  );

  for (const reference of referenceRuns) {
    const referenceLayout = readOptionalJson(reference.layout);
    const referenceScrollHeight = layoutScrollHeight(referenceLayout);
    const referenceMediaSurfaces = Array.isArray(reference.mediaSurfaces) ? reference.mediaSurfaces.length : 0;

    if (referenceScrollHeight > 0 && targetScrollHeight > 0) {
      const depthRatio = targetScrollHeight / referenceScrollHeight;
      if (depthRatio < 0.8) {
        errors.push({
          code: 'fallback_reference_depth_shortfall',
          message: `Generated fallback page is too short compared with the captured reference (${targetScrollHeight}px vs ${referenceScrollHeight}px, ${Math.round(depthRatio * 100)}%). Extend the fallback before authoring Monteby JSON.`,
        });
      }
    }

    if (referenceMediaSurfaces >= 10 && targetMediaSurfaces > 0) {
      const densityRatio = targetMediaSurfaces / referenceMediaSurfaces;
      if (densityRatio < 0.75) {
        errors.push({
          code: 'fallback_reference_media_density_shortfall',
          message: `Generated fallback has too few media surfaces compared with the captured reference (${targetMediaSurfaces}/${referenceMediaSurfaces}, ${Math.round(densityRatio * 100)}%). Add visible replacement photography instead of treating the fallback as ready.`,
        });
      }
    }

    if (isMaidyReference(reference) && maidyReferenceNeedsCutoutOrComposite(reference) && !maidyFallbackHasCutoutOrComposite(manifest, targetLayout)) {
      errors.push({
        code: 'fallback_maidy_cutout_or_composite_missing',
        message: 'Captured Maidy reference uses PNG/composite cleaner and equipment hero mechanics, but the generated fallback uses rectangular stock-photo panels. Provide a generated/licensed/user-provided Maidy cutout or composite asset, or improve the fallback generator before authoring Monteby JSON.',
      });
    }

    if (isCaregloReference(reference) && caregloReferenceNeedsActiveDetailing(reference, referenceLayout) && !caregloFallbackHasActiveDetailing(manifest, targetLayout)) {
      errors.push({
        code: 'fallback_careglo_active_detailing_media_missing',
        message: 'Captured Careglo reference uses active detailing/proof photography, but the generated fallback looks like generic car stock. Use replacement media that clearly shows detailing, polishing, washing, interior service, or proof/detail work before authoring Monteby JSON.',
      });
    }

    if (isLumenReference(reference) && lumenReferenceNeedsDoctorCutout(reference, referenceLayout) && !lumenFallbackHasDoctorCutout(manifest, targetLayout)) {
      errors.push({
        code: 'fallback_lumen_doctor_cutout_missing',
        message: 'Captured Lumen reference uses transparent/cutout-like doctor hero mechanics, but the generated fallback uses rectangular stock-photo panels. Provide a generated/licensed/user-provided Lumen doctor cutout asset, or improve the fallback generator before authoring Monteby JSON.',
      });
    }
  }

  return errors;
}

function isMaidyReference(reference) {
  const evidence = [
    reference?.url,
    reference?.manifest,
    reference?.brief,
    ...(Array.isArray(reference?.mediaSurfaces) ? reference.mediaSurfaces.map((surface) => surface?.source) : []),
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  return evidence.includes('maidy') || evidence.includes('maid-service-agency');
}

function maidyReferenceNeedsCutoutOrComposite(reference) {
  const surfaces = Array.isArray(reference?.mediaSurfaces) ? reference.mediaSurfaces : [];

  return surfaces.some((surface) => {
    const source = String(surface?.source || '').toLowerCase();
    const placement = String(surface?.placement || '').toLowerCase();
    return placement === 'firstviewport'
      && source.endsWith('.png')
      && /(cleaner|vacuum|spray|rag|bg_[0-9]+|maidy)/.test(source);
  });
}

function maidyFallbackHasCutoutOrComposite(manifest, targetLayout) {
  if (manifest?.heroAssetMode === 'cutout' || manifest?.heroAssetMode === 'composite') {
    return true;
  }
  if (typeof manifest?.heroAssetMode === 'string') {
    return false;
  }

  const manifestSources = Array.isArray(manifest?.mediaSurfaces)
    ? manifest.mediaSurfaces.map((surface) => surface?.source)
    : [];
  const layoutSources = Array.isArray(targetLayout?.mediaBoxes)
    ? targetLayout.mediaBoxes
      .filter((box) => Number(box?.firstViewportArea || 0) > 0)
      .map((box) => box?.source)
    : [];
  const evidence = [...manifestSources, ...layoutSources]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  return /(maidy[-_]?hero[-_]?composite|maidy[-_]?cleaner[-_]?cutout|cleaner[-_]?cutout|hero[-_]?cutout|transparent[-_]?cleaner|(?:cleaner|maid|vacuum|spray|equipment)[^ ]*\.png)/.test(evidence);
}

function isCaregloReference(reference) {
  const evidence = [
    reference?.url,
    reference?.manifest,
    reference?.brief,
    ...(Array.isArray(reference?.mediaSurfaces) ? reference.mediaSurfaces.map((surface) => surface?.source) : []),
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  return evidence.includes('careglo') || evidence.includes('luxury-car-care') || evidence.includes('templates.studioniskala.com/car');
}

function caregloReferenceNeedsActiveDetailing(reference, referenceLayout) {
  const mediaItems = [
    ...(Array.isArray(reference?.mediaSurfaces) ? reference.mediaSurfaces : []),
    ...(Array.isArray(referenceLayout?.mediaBoxes) ? referenceLayout.mediaBoxes : []),
  ];

  return mediaItems.some((item) => {
    const source = String(item?.source || '').toLowerCase();
    const placement = String(item?.placement || '').toLowerCase();
    const firstViewportArea = Number(item?.firstViewportArea || 0);
    const width = Number(item?.rect?.width || item?.width || 0);
    const height = Number(item?.rect?.height || item?.height || 0);
    const firstViewport = placement === 'firstviewport' || firstViewportArea > 0;
    const largeEnough = firstViewportArea >= 24000 || width >= 220 || height >= 180;

    return firstViewport && largeEnough && isCaregloDetailingSource(source);
  });
}

function caregloFallbackHasActiveDetailing(manifest, targetLayout) {
  const layoutSources = Array.isArray(targetLayout?.mediaBoxes)
    ? targetLayout.mediaBoxes
      .filter((box) => Number(box?.firstViewportArea || 0) > 0)
      .map((box) => box?.source)
    : [];
  const manifestSources = Array.isArray(manifest?.mediaSurfaces)
    ? manifest.mediaSurfaces
      .filter((surface) => String(surface?.placement || '').toLowerCase() === 'firstviewport')
      .map((surface) => surface?.source)
    : [];
  const sources = layoutSources.length > 0 ? layoutSources : manifestSources;

  return sources
    .map((value) => String(value || '').toLowerCase())
    .some(isCaregloDetailingSource);
}

function isCaregloDetailingSource(source) {
  return /(detail|detailing|polish|prepar|spray|foam|wash|clean|interior|inside|headlight|ceramic|paint[-_ ]?correction|brush|worker|mechanic|car[-_ ]?care|luxury[-_ ]?car[-_ ]?care|17029940|14615262|5233261|6872164|5233285|6873119)/.test(source);
}

function isLumenReference(reference) {
  const evidence = [
    reference?.url,
    reference?.manifest,
    reference?.brief,
    ...(Array.isArray(reference?.mediaSurfaces) ? reference.mediaSurfaces.map((surface) => surface?.source) : []),
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  return evidence.includes('lumen') || evidence.includes('lumen-eye-care-editorial');
}

function lumenReferenceNeedsDoctorCutout(reference, referenceLayout) {
  const mediaItems = [
    ...(Array.isArray(reference?.mediaSurfaces) ? reference.mediaSurfaces : []),
    ...(Array.isArray(referenceLayout?.mediaBoxes) ? referenceLayout.mediaBoxes : []),
  ];

  return mediaItems.some((item) => {
    const source = String(item?.source || '').toLowerCase();
    const placement = String(item?.placement || '').toLowerCase();
    const firstViewportArea = Number(item?.firstViewportArea || 0);
    const width = Number(item?.rect?.width || item?.width || 0);
    const height = Number(item?.rect?.height || item?.height || 0);
    const firstViewport = placement === 'firstviewport' || firstViewportArea > 0;
    const largeEnough = firstViewportArea >= 30000 || width >= 220 || height >= 280;

    return firstViewport
      && largeEnough
      && isLikelyCutoutAsset(source)
      && /(doctor|specialist|optometrist|lumen|eye|person|woman|man|doc)/.test(source);
  });
}

function lumenFallbackHasDoctorCutout(manifest, targetLayout) {
  const manifestSources = Array.isArray(manifest?.mediaSurfaces)
    ? manifest.mediaSurfaces.map((surface) => surface?.source)
    : [];
  const layoutSources = Array.isArray(targetLayout?.mediaBoxes)
    ? targetLayout.mediaBoxes
      .filter((box) => Number(box?.firstViewportArea || 0) > 0)
      .map((box) => box?.source)
    : [];
  const evidence = [...manifestSources, ...layoutSources]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  return /(lumen[-_]?doctor[-_]?cutout|doctor[-_]?cutout|transparent[-_]?doctor|(?:doctor|specialist|optometrist|eye|person|woman|man|doc)[^ ]*\.(png|webp))/i.test(evidence);
}

function isLikelyCutoutAsset(source) {
  if (!/\.(png|webp)(?:[?#].*)?$/.test(source)) {
    return false;
  }

  return !/(bokeh|texture|pattern|abstract|gradient|shape|blob|ornament|noise|illustration|background|bg[_-]?)/.test(source);
}

function layoutScrollHeight(layout) {
  const value = layout?.viewport?.scrollHeight;
  return Number.isFinite(value) ? value : 0;
}

function nextCommands(options, targetManifest, referenceRuns = []) {
  const candidateDir = path.join(options.outDir, 'candidate');
  const layout = path.join(candidateDir, 'layout.json');
  const layoutDraft = path.join(candidateDir, 'layout-draft.json');
  const contract = path.join(candidateDir, 'contract.json');
  const screenshots = path.join(candidateDir, 'screenshots');
  const rendered = path.join(candidateDir, 'rendered');
  const renderedManifest = path.join(rendered, 'reference-manifest.json');
  const diffs = path.join(candidateDir, 'diffs');
  const report = path.join(candidateDir, 'benchmark-report.json');
  const markdown = path.join(candidateDir, 'benchmark-report.md');
  const startReport = options.out;
  const referenceManifest = referenceRuns[0]?.manifest || targetManifest;
  const marketplaceFlags = shouldRequireMarketplace(options, null) ? ' --require-marketplace-media' : '';
  const realReferenceFlags = referenceRuns.some((run) => /^https?:\/\//i.test(String(run?.url || '')))
    ? ' --require-real-reference'
    : '';
  const strictMediaFlags = `${realReferenceFlags}${marketplaceFlags}`;

  return {
    fetchContract: 'GET /wp-json/monteby/v1/contract > candidate/contract.json',
    captureCandidateRender: [
      'node monteby-site-authoring/scripts/capture-template-reference.js',
      '--url CANDIDATE_PUBLIC_OR_PREVIEW_URL',
      `--out-dir ${shellQuote(rendered)}`,
      '--name candidate',
      '--capture-layout',
      ...(options.fullPage ? ['--full-page'] : []),
      ...(options.viewportTimeoutMs > 0
        ? [`--viewport-timeout-ms ${options.viewportTimeoutMs}`]
        : []),
      ...viewportArgs(options),
    ].join(' '),
    authoringReadiness: [
      'node monteby-site-authoring/scripts/audit-authoring-readiness.js',
      `--contract ${shellQuote(contract)}`,
      `--start-report ${shellQuote(startReport)}`,
      '--json',
    ].join(' '),
    draftLayout: [
      'node monteby-site-authoring/scripts/draft-monteby-layout.js',
      `--contract ${shellQuote(contract)}`,
      `--start-report ${shellQuote(startReport)}`,
      `--reference-manifest ${shellQuote(referenceManifest)}`,
      `--out ${shellQuote(layoutDraft)}`,
      '--json',
    ].join(' ') + strictMediaFlags,
    auditLayout: [
      'node monteby-site-authoring/scripts/audit-monteby-layout.js',
      `--layout ${shellQuote(layout)}`,
      `--contract ${shellQuote(contract)}`,
      `--reference-manifest ${shellQuote(referenceManifest)}`,
      '--json',
    ].join(' ') + strictMediaFlags,
    runBenchmark: [
      'node monteby-site-authoring/scripts/run-visual-benchmark.js',
      `--label ${shellQuote(options.label)}`,
      `--layout ${shellQuote(layout)}`,
      `--contract ${shellQuote(contract)}`,
      `--reference-manifest ${shellQuote(referenceManifest)}`,
      `--candidate-manifest ${shellQuote(renderedManifest)}`,
      `--diff-dir ${shellQuote(diffs)}`,
      `--out ${shellQuote(report)}`,
      `--markdown ${shellQuote(markdown)}`,
      '--max-percent 0',
      '--max-viewport-percent 0',
      ...(options.fullPage ? ['--pad-to-largest'] : []),
    ].join(' ') + strictMediaFlags,
    legacyScreenshotBenchmark: [
      'node monteby-site-authoring/scripts/run-visual-benchmark.js',
      `--label ${shellQuote(options.label)}`,
      `--layout ${shellQuote(layout)}`,
      `--contract ${shellQuote(contract)}`,
      `--reference-manifest ${shellQuote(referenceManifest)}`,
      `--candidate-dir ${shellQuote(screenshots)}`,
      '--candidate-prefix candidate',
      `--diff-dir ${shellQuote(diffs)}`,
      `--out ${shellQuote(report)}`,
      `--markdown ${shellQuote(markdown)}`,
      '--max-percent 0',
      '--max-viewport-percent 0',
      ...(options.fullPage ? ['--pad-to-largest'] : []),
    ].join(' ') + strictMediaFlags,
  };
}

function viewportArgs(options) {
  return options.viewports.flatMap((viewport) => ['--viewport', viewport]);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function writeOutputs(report, options) {
  writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`);
  writeFile(options.markdown, renderMarkdown(report));
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function renderMarkdown(report) {
  const lines = [
    '# Monteby Visual Benchmark Start',
    '',
    `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Label: ${report.label}`,
    `- Generated: ${report.generatedAt}`,
    `- Target HTML: \`${report.files.targetHtml}\``,
    `- Target manifest: \`${report.files.targetManifest}\``,
    `- Target layout: \`${report.files.targetLayout || 'missing'}\``,
    `- Visual brief: \`${report.files.visualBrief}\``,
    `- Screenshots: ${report.files.screenshots.length}`,
    `- Start visual review: \`${report.files.startVisualReview || 'not created'}\``,
    `- Media surfaces: ${report.target.mediaSurfaces.length}`,
    `- Real references: ${report.references.length}`,
    `- Fallback archetype: ${report.options.archetype || 'none'} (${report.options.archetypeInference?.source || 'unknown'})`,
    `- Reference classification: ${report.options.referenceClassification?.kind || 'none'}; family mechanics: ${report.options.referenceClassification?.familyMechanics ? report.options.referenceClassification.family : 'none'}`,
    '',
    '## Read Before Authoring',
    '',
    '- Inspect every real reference screenshot listed below.',
    ...(report.options.referenceClassification?.kind === GENERIC_MEASURED_REFERENCE
      ? ['- This is a generic measured reference. Use its captured band geometry as a bounded authoring scaffold; no maintained template-family mechanics or 1:1 result are claimed.']
      : []),
    '- Do not present the generated fallback target as evidence that Monteby matches the supplied Envato/template URL; it is only an original pressure target after the real screenshots have been inspected.',
    '- If a candidate screenshot has no obvious photography in the first viewport, or the photos read as small placeholders, reject it before interpreting JSON/media-role audits.',
    ...startVisualReviewLines(report),
    ...targetScreenshotLines(report),
    `- Inspect generated target layout: \`${report.files.targetLayout || 'missing'}\``,
    `- Read fallback target brief: \`${report.files.visualBrief}\``,
    ...report.references.map((reference) => `- Read real reference brief: \`${reference.brief}\``),
    '',
    '## Next Commands',
    '',
    '```bash',
    report.commands.next.fetchContract,
    '',
    report.commands.next.authoringReadiness,
    '',
    report.commands.next.draftLayout,
    '',
    report.commands.next.auditLayout,
    '',
    report.commands.next.captureCandidateRender,
    '',
    report.commands.next.runBenchmark,
    '',
    '# Fallback only when no candidate URL is available; this skips rendered media parity.',
    report.commands.next.legacyScreenshotBenchmark,
    '```',
    '',
    '## Target Audit',
    '',
    `- Status: ${report.targetAudit.ok ? 'PASS' : 'FAIL'}`,
  ];

  appendIssueList(lines, report.targetAudit.errors, 'Target Audit Errors');
  appendIssueList(lines, report.targetQuality.errors, 'Target Reference Quality Errors');
  appendIssueList(lines, targetLayoutErrors(report), 'Target Layout Errors');
  appendReferenceList(lines, report.references);

  return `${lines.join('\n')}\n`;
}

function startVisualReviewLines(report) {
  if (!Array.isArray(report.references) || report.references.length === 0) {
    return [];
  }

  const lines = [];
  if (report.files?.startVisualReview) {
    lines.push(`- Open start visual review sheet: \`${report.files.startVisualReview}\` (left: captured real reference, right: generated fallback).`);
  } else {
    lines.push('- Start visual review sheet: not created; inspect the listed real reference and generated fallback screenshots manually before authoring.');
  }

  for (const warning of report.startVisualReview?.warnings || []) {
    lines.push(`  - Warning: ${warning}`);
  }

  return lines;
}

function targetLayoutErrors(report) {
  if (report.commands.targetLayoutCapture.layoutCaptureStatus === 'ok') {
    return [];
  }

  return [{
    code: 'missing_target_layout',
    message: report.commands.targetLayoutCapture.layoutCaptureError || report.commands.targetLayoutCapture.stderr || 'Generated target layout capture failed.',
  }];
}

function appendReferenceList(lines, references) {
  lines.push('', '## Real References', '');
  if (!Array.isArray(references) || references.length === 0) {
    lines.push('- None');
    return;
  }

  for (const reference of references) {
    lines.push(`- ${reference.url}`);
    lines.push(`  - Manifest: \`${reference.manifest}\``);
    lines.push(`  - Brief: \`${reference.brief}\``);
    if (reference.layout) {
      lines.push(`  - Rendered layout: \`${reference.layout}\``);
    } else {
      lines.push(`  - Rendered layout: ${reference.layoutCaptureStatus}`);
    }
    if (Array.isArray(reference.layouts) && reference.layouts.length > 1) {
      lines.push(`  - Rendered layouts: ${reference.layouts.map((layout) => `\`${layout}\``).join(', ')}`);
    }
    if (reference.layoutCaptureError) {
      lines.push(`  - Layout capture error: ${reference.layoutCaptureError}`);
    }
    lines.push(`  - Screenshots: ${reference.screenshots.length}`);
    for (const screenshot of reference.screenshots || []) {
      lines.push(`    - \`${screenshot}\``);
    }
    lines.push(`  - Media evidence: ${reference.mediaCount}`);
    lines.push(`  - Media roles: ${formatRoleCounts(reference.mediaSurfaceRoleCounts)}`);
    lines.push(`  - Scaled media roles: ${formatRoleCounts(reference.mediaSurfaceScaleCounts)}`);
  }
}

function targetScreenshotLines(report) {
  if (!Array.isArray(report.files?.screenshots) || report.files.screenshots.length === 0) {
    return ['- Generated target screenshots: none'];
  }

  return [
    '- Generated fallback target screenshots:',
    ...report.files.screenshots.map((screenshot) => `  - \`${screenshot}\``),
  ];
}

function formatRoleCounts(roleCounts) {
  const roles = ['hero', 'secondary', 'service-card', 'reference-media'];
  const parts = roles
    .filter((role) => Number.isFinite(roleCounts?.[role]) && roleCounts[role] > 0)
    .map((role) => `${role}:${roleCounts[role]}`);

  return parts.length > 0 ? parts.join(', ') : 'none';
}

function appendIssueList(lines, items, title) {
  lines.push('', `## ${title}`, '');
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('- None');
    return;
  }

  for (const item of items) {
    const code = item.code ? `[${item.code}] ` : '';
    lines.push(`- ${code}${item.message || ''}`);
  }
}

function printSummary(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`monteby_visual_benchmark_start=${report.ok ? 'ok' : 'failed'}`);
  console.log(`target_dir=${report.files.outDir}`);
  console.log(`target_manifest=${report.files.targetManifest}`);
  console.log(`visual_brief=${report.files.visualBrief}`);
  console.log(`start_visual_review=${report.files.startVisualReview || 'not-created'}`);
  console.log(`screenshots=${report.files.screenshots.length}`);
  console.log(`references=${report.references.length}`);
  console.log(`target_audit=${report.targetAudit.ok ? 'ok' : 'failed'}`);
  console.log(`target_reference_quality=${report.targetQuality.ok ? 'ok' : 'failed'}`);
  console.log(`report_json=${report.files.jsonReport}`);
  console.log(`report_markdown=${report.files.markdownReport}`);
  for (const item of report.targetAudit.errors || []) {
    console.log(`error ${item.code}: ${item.message}`);
  }
  for (const item of report.targetQuality.errors || []) {
    console.log(`error ${item.code}: ${item.message}`);
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    options.childProcessTimeoutMs = childProcessTotalTimeoutMs(options);
    fs.mkdirSync(options.outDir, { recursive: true });
    const referenceRuns = await runReferenceCaptures(options);
    const failedReference = referenceRuns.find((run) => run.status !== 0);
    if (failedReference) {
      throw new Error(failedReference.stderr || `Reference capture failed: ${failedReference.url}`);
    }
    resolveReferenceArchetype(options, referenceRuns);
    const referenceQuality = referenceQualityErrors(
      referenceRuns,
      options.referenceClassification?.familyMechanics === true
    );
    if (referenceQuality.length > 0) {
      throw new Error(`Reference capture quality failed:\n${referenceQuality.map((error) => `- ${error}`).join('\n')}`);
    }

    const generateRun = await runScript(
      scriptPath('generate-random-html-target.js'),
      generatorArgs(options),
      options.childProcessTimeoutMs
    );

    if (generateRun.status !== 0) {
      const failureReport = buildGenerateFailureReport(options, referenceRuns, generateRun);
      writeFile(options.out, `${JSON.stringify(failureReport, null, 2)}\n`);
      writeFile(options.markdown, `${[
        '# Monteby Visual Benchmark Start',
        '',
        '- Status: FAIL',
        `- Failure: [${failureReport.failure.code}] ${failureReport.failure.message}`,
        `- Timeout: ${failureReport.failure.timeoutMs || 'not reported'}ms`,
        `- Process cleanup attempted: ${failureReport.failure.terminationAttempted ? 'yes' : 'no'}`,
        '- Partial diagnostic artifacts:',
        ...(failureReport.failure.partialArtifacts.length > 0
          ? failureReport.failure.partialArtifacts.map((file) => `  - \`${file}\``)
          : ['  - None']),
        '- Captured real-reference artifacts remain in their reference output directories.',
        '',
      ].join('\n')}\n`);
      console.error(`[${failureReport.failure.code}] ${failureReport.failure.message}`);
      if (options.json) {
        console.log(JSON.stringify(failureReport, null, 2));
      }
      process.exitCode = 1;
      return;
    }

    const targetManifest = path.join(options.outDir, 'target-manifest.json');
    const generatedManifest = JSON.parse(fs.readFileSync(targetManifest, 'utf8'));
    const targetLayoutRun = await runScript(
      scriptPath('capture-template-reference.js'),
      targetLayoutCaptureArgs(options),
      options.childProcessTimeoutMs
    );
    const targetLayoutResult = attachTargetLayout(options, generatedManifest);
    if (targetLayoutRun.status !== 0 || targetLayoutResult.layoutCaptureStatus !== 'ok') {
      throw new Error(targetLayoutRun.stderr.trim() || targetLayoutResult.layoutCaptureError || 'Generated target layout capture failed.');
    }
    const manifest = targetLayoutResult.manifest;
    const requireMarketplace = shouldRequireMarketplace(options, manifest);
    const targetAuditRun = await runJsonScript(
      scriptPath('audit-target-manifest.js'),
      targetAuditArgs(options, requireMarketplace),
      options.childProcessTimeoutMs
    );
    const visualBriefRun = await runJsonScript(
      scriptPath('write-visual-brief.js'),
      visualBriefArgs(options),
      options.childProcessTimeoutMs
    );
    const report = buildReport(options, referenceRuns, generateRun, targetLayoutRun, targetLayoutResult, targetAuditRun, visualBriefRun, manifest, requireMarketplace);
    attachStartVisualReview(report, options);

    writeOutputs(report, options);
    printSummary(report, options.json);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildGenerateFailureReport,
  childProcessTotalTimeoutMs,
  generatorArgs,
  runScript,
};
