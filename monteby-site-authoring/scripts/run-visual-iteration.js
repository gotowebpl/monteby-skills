#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');
const { fileURLToPath, pathToFileURL } = require('url');

const LONG_MOBILE_VIEWPORT = 'mobile-long:390x1800';
const CANONICAL_VIEWPORTS = [
  'desktop:1440x1200',
  'tablet:834x1112',
  'mobile:390x844',
];
const LONG_MOBILE_FIRST_VIEWPORT_COVERAGE_MAX = 0.02;
const LONG_MOBILE_AFTER_FOLD_MIN = 0.9;
const LONG_MOBILE_AFTER_FOLD_MAX = 2.6;

function parseArgs(argv) {
  const options = {
    label: 'visual-iteration',
    contract: '',
    outDir: '',
    seed: String(Date.now()),
    variant: 'auto',
    archetype: '',
    marketplaceReference: false,
    referenceUrls: [],
    referenceHtmlFile: '',
    candidateLayout: '',
    waitMs: '1000',
    referenceWaitMs: '3500',
    fullPage: true,
    channel: '',
    playwrightPackage: 'playwright@1.54.1',
    viewportTimeoutMs: 0,
    viewports: [],
    maxPercent: '0',
    maxViewportPercent: '0',
    renderedMinCoverageRatio: '',
    allowStructuralVerdict: false,
    preserveSourceText: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--marketplace-reference') {
      options.marketplaceReference = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--allow-structural-verdict') {
      options.allowStructuralVerdict = true;
      continue;
    }
    if (arg === '--preserve-source-text') {
      options.preserveSourceText = true;
      continue;
    }
    if (arg === '--full-page') {
      options.fullPage = true;
      continue;
    }
    if (arg === '--viewport-only') {
      options.fullPage = false;
      continue;
    }

    const valueOption = [
      '--label',
      '--contract',
      '--out-dir',
      '--seed',
      '--variant',
      '--archetype',
      '--reference-url',
      '--reference-html-file',
      '--candidate-layout',
      '--wait-ms',
      '--reference-wait-ms',
      '--channel',
      '--playwright-package',
      '--viewport-timeout-ms',
      '--viewport',
      '--max-percent',
      '--max-viewport-percent',
      '--rendered-min-coverage-ratio',
    ].includes(arg);

    if (!valueOption) {
      throw new Error(`Unknown option: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    index += 1;
    switch (arg) {
      case '--label':
        options.label = value;
        break;
      case '--contract':
        options.contract = path.resolve(value);
        break;
      case '--out-dir':
        options.outDir = path.resolve(value);
        break;
      case '--seed':
        options.seed = value;
        break;
      case '--variant':
        options.variant = value;
        break;
      case '--archetype':
        options.archetype = value;
        break;
      case '--reference-url':
        options.referenceUrls.push(value);
        break;
      case '--reference-html-file':
        options.referenceHtmlFile = path.resolve(value);
        break;
      case '--candidate-layout':
        options.candidateLayout = path.resolve(value);
        break;
      case '--wait-ms':
        options.waitMs = value;
        break;
      case '--reference-wait-ms':
        options.referenceWaitMs = value;
        break;
      case '--channel':
        options.channel = value;
        break;
      case '--playwright-package':
        options.playwrightPackage = value;
        break;
      case '--viewport-timeout-ms':
        options.viewportTimeoutMs = parsePositiveInteger(value, arg);
        break;
      case '--viewport':
        options.viewports.push(value);
        break;
      case '--max-percent':
        options.maxPercent = value;
        break;
      case '--max-viewport-percent':
        options.maxViewportPercent = value;
        break;
      case '--rendered-min-coverage-ratio':
        options.renderedMinCoverageRatio = value;
        break;
      default:
        break;
    }
  }

  if (!options.outDir) {
    options.outDir = path.join(os.tmpdir(), `monteby-visual-iteration-${slugify(options.seed)}`);
  }
  if (options.referenceUrls.length === 0 && !options.referenceHtmlFile) {
    options.preserveSourceText = true;
  }
  if (options.referenceUrls.length > 0 && options.preserveSourceText) {
    throw new Error('--preserve-source-text is only allowed for owned local HTML or generated targets; it cannot be combined with --reference-url');
  }
  if (!options.help && !options.contract) {
    throw new Error('--contract is required');
  }

  return options;
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function usage() {
  return `Usage:
  run-visual-iteration.js --contract contract.json [--seed value] [--variant auto|split-hero|editorial-ledger|bento-showcase|tabbed-program|marketplace-service] [--archetype name] [--reference-url url | --reference-html-file file] [--candidate-layout layout.json] [--preserve-source-text] [--out-dir dir] [--viewport label:WIDTHxHEIGHT] [--full-page | --viewport-only] [--viewport-timeout-ms milliseconds] [--channel chrome] [--max-percent value] [--max-viewport-percent value] [--allow-structural-verdict] [--json]

Options:
  --reference-html-file <file>  Use a local HTML document as the measured reference without requiring a remote URL.
  --candidate-layout <file>     Audit and benchmark an edited candidate while retaining the measured layout plan.
  --full-page                  Capture and compare complete responsive pages. This is the default and remains a static visual diagnostic.
  --viewport-only              Capture only the first viewport for a faster diagnostic iteration. It cannot prove full-page fidelity.
  --viewport-timeout-ms <ms>  Positive timeout forwarded to every reference, target, candidate, and long-mobile viewport capture. Default: capture auto
  --channel chrome            Use the locally installed Chrome when Playwright's bundled browser is unavailable.
  --max-percent <value>       Maximum aggregate screenshot difference percentage. Default: 0
  --max-viewport-percent <v>  Maximum screenshot difference percentage for any viewport. Default: 0
  --preserve-source-text      Preserve text from owned local HTML. Automatically enabled for generated targets

Runs one local visual-fidelity iteration:
  1. start-visual-benchmark.js creates/captures the target
  2. audit-authoring-readiness.js checks the live contract
  3. draft-monteby-layout.js creates a measured plan and clean Monteby draft
  4. render-monteby-preview.js renders a diagnostic local preview
  5. capture-template-reference.js captures the preview
  6. run-visual-benchmark.js reports blockers

Every report includes a versioned layout-plan artifact plus exactly one nextAction. Execute that action; do not improvise a parallel workflow.
This is a local diagnostic loop. A successful run reports diagnostic_passed, never final fidelity or canonical success.
The generated JSON and Markdown keep the visual benchmark result separate from fidelityPassed and canonicalVerification.
WordPress REST validation, REST save, and PHP preview remain required for canonical verification on real sites.`;
}

function slugify(input) {
  const slug = String(input || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'iteration';
}

function scriptPath(name) {
  return path.join(__dirname, name);
}

function runNodeScript(name, args) {
  const result = spawnSync(process.execPath, [scriptPath(name), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  return {
    script: name,
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    report: parseJsonOrNull(result.stdout),
  };
}

function parseJsonOrNull(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractNodeMap(value) {
  if (isObject(value) && isObject(value.ROOT)) return value;
  if (isObject(value?.nodeMap) && isObject(value.nodeMap.ROOT)) return value.nodeMap;
  if (isObject(value?.layout) && isObject(value.layout.ROOT)) return value.layout;
  return null;
}

function nodeMapSha256(value) {
  const nodeMap = extractNodeMap(value);
  return nodeMap
    ? createHash('sha256').update(JSON.stringify(nodeMap)).digest('hex')
    : '';
}

function fileSha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sameStringOrder(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => typeof value === 'string' && value === right[index]);
}

function resolvedPlanSourceLayout(planFile, sourceLayout) {
  if (typeof sourceLayout !== 'string' || !sourceLayout) {
    return '';
  }
  if (path.isAbsolute(sourceLayout)) {
    return sourceLayout;
  }
  const fromCwd = path.resolve(sourceLayout);
  return fs.existsSync(fromCwd)
    ? fromCwd
    : path.resolve(path.dirname(planFile), sourceLayout);
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function startArgs(options) {
  const args = [
    '--label',
    options.label,
    '--seed',
    options.seed,
    '--variant',
    options.variant,
    '--out-dir',
    options.outDir,
    '--wait-ms',
    options.waitMs,
    '--reference-wait-ms',
    options.referenceWaitMs,
    '--playwright-package',
    options.playwrightPackage,
    ...(options.viewportTimeoutMs > 0
      ? ['--viewport-timeout-ms', String(options.viewportTimeoutMs)]
      : []),
    '--json',
  ];

  if (options.archetype) {
    args.push('--archetype', options.archetype);
  }
  if (options.marketplaceReference) {
    args.push('--marketplace-reference');
  }
  args.push(options.fullPage ? '--full-page' : '--viewport-only');
  if (options.referenceHtmlFile) {
    args.push('--reference-html-file', options.referenceHtmlFile);
  }
  if (options.channel) {
    args.push('--channel', options.channel);
  }
  for (const url of options.referenceUrls) {
    args.push('--reference-url', url);
  }
  for (const viewport of options.viewports) {
    args.push('--viewport', viewport);
  }

  return args;
}

function viewportArgs(options) {
  return options.viewports.flatMap((viewport) => ['--viewport', viewport]);
}

function startReportPath(options) {
  return path.join(options.outDir, 'benchmark-start-report.json');
}

function candidateDir(options) {
  return path.join(options.outDir, 'candidate');
}

function candidateContractPath(options) {
  return path.join(candidateDir(options), 'contract.json');
}

function layoutDraftPath(options) {
  return path.join(candidateDir(options), 'layout-draft.json');
}

function layoutPlanPath(options) {
  return path.join(candidateDir(options), 'layout-plan.json');
}

function layoutPath(options) {
  return path.join(candidateDir(options), 'layout.json');
}

function previewPath(options) {
  return path.join(candidateDir(options), 'layout-draft-preview.html');
}

function previewFragmentPath(options) {
  return path.join(candidateDir(options), 'layout-draft-fragment.html');
}

function candidateRenderedDir(options) {
  return path.join(candidateDir(options), 'rendered');
}

function candidateManifestPath(options) {
  return path.join(candidateRenderedDir(options), 'reference-manifest.json');
}

function longMobileDir(options) {
  return path.join(options.outDir, 'long-mobile');
}

function longMobileReferenceDir(options) {
  return path.join(longMobileDir(options), 'reference');
}

function longMobileCandidateDir(options) {
  return path.join(longMobileDir(options), 'candidate');
}

function longMobileDiffDir(options) {
  return path.join(longMobileDir(options), 'diffs');
}

function longMobileReferenceManifestPath(options) {
  return path.join(longMobileReferenceDir(options), 'reference-manifest.json');
}

function longMobileCandidateManifestPath(options) {
  return path.join(longMobileCandidateDir(options), 'reference-manifest.json');
}

function longMobileBenchmarkReportPath(options) {
  return path.join(longMobileDir(options), 'benchmark-report.json');
}

function longMobileBenchmarkMarkdownPath(options) {
  return path.join(longMobileDir(options), 'benchmark-report.md');
}

function benchmarkReportPath(options) {
  return path.join(candidateDir(options), 'benchmark-report.json');
}

function benchmarkMarkdownPath(options) {
  return path.join(candidateDir(options), 'benchmark-report.md');
}

function diffDir(options) {
  return path.join(candidateDir(options), 'diffs');
}

function iterationReportPath(options) {
  return path.join(options.outDir, 'visual-iteration-report.json');
}

function iterationMarkdownPath(options) {
  return path.join(options.outDir, 'VISUAL-ITERATION.md');
}

function referenceManifestFor(startReport) {
  const reference = Array.isArray(startReport?.references) && startReport.references.length > 0
    ? startReport.references[0]
    : null;
  return reference?.manifest || startReport?.files?.targetManifest || '';
}

function targetManifestFor(startReport, referenceManifest) {
  const hasRealReference = Array.isArray(startReport?.references) && startReport.references.length > 0;
  return hasRealReference ? referenceManifest : startReport?.files?.targetManifest || referenceManifest;
}

function shouldRequireMarketplace(startReport) {
  if (typeof startReport?.options?.requireMarketplace === 'boolean') {
    return startReport.options.requireMarketplace;
  }
  if (startReport?.options?.referenceClassification?.kind === 'generic-measured-reference') {
    return false;
  }

  return startReport?.options?.marketplaceReference === true
    || Boolean(startReport?.options?.archetype)
    || startReport?.target?.variant === 'marketplace-service';
}

function shouldRequireRealReference(startReport) {
  const references = Array.isArray(startReport?.references) ? startReport.references : [];
  return references.some((reference) => /^https?:\/\//i.test(String(reference?.url || '')));
}

function readinessArgs(options, referenceManifest) {
  const args = [
    '--contract',
    candidateContractPath(options),
    '--start-report',
    startReportPath(options),
  ];

  if (referenceManifest && fs.existsSync(referenceManifest)) {
    const manifest = readJson(referenceManifest);
    const manifestDir = path.dirname(referenceManifest);
    const briefFile = typeof manifest.briefJson === 'string' ? manifest.briefJson.trim() : '';
    const resolvedBrief = briefFile
      ? (path.isAbsolute(briefFile) ? briefFile : path.join(manifestDir, briefFile))
      : '';
    if (resolvedBrief && fs.existsSync(resolvedBrief)) {
      args.push('--reference-brief', resolvedBrief);
    }

    for (const label of ['desktop', 'tablet', 'mobile', 'mobile-long']) {
      const layoutFile = loadManifestLayout(referenceManifest, label, true);
      if (layoutFile) {
        args.push('--reference-layout', layoutFile);
      }
    }
  }

  args.push('--json');
  return args;
}

function draftArgs(options, startReport, referenceManifest) {
  const args = [
    '--contract',
    candidateContractPath(options),
    '--start-report',
    startReportPath(options),
    '--reference-manifest',
    referenceManifest,
    '--out',
    layoutDraftPath(options),
    '--plan-out',
    layoutPlanPath(options),
    '--json',
  ];

  if (shouldRequireRealReference(startReport)) {
    args.push('--require-real-reference');
  }
  if (shouldRequireMarketplace(startReport)) {
    args.push('--require-marketplace-media');
  }
  if (options.preserveSourceText) {
    args.push('--preserve-source-text');
  }

  return args;
}

function auditCandidateArgs(options, startReport, referenceManifest) {
  const args = [
    '--layout',
    options.candidateLayout,
    '--contract',
    candidateContractPath(options),
    '--reference-manifest',
    referenceManifest,
    '--json',
  ];

  if (shouldRequireRealReference(startReport)) {
    args.push('--require-real-reference');
  }
  if (shouldRequireMarketplace(startReport)) {
    args.push('--require-marketplace-media');
  }

  return args;
}

function renderArgs(options) {
  return [
    '--layout',
    layoutPath(options),
    '--out',
    previewPath(options),
    '--fragment-out',
    previewFragmentPath(options),
    '--title',
    `${options.label} Monteby draft`,
  ];
}

function candidateCaptureArgs(options) {
  return [
    '--url',
    pathToFileURL(previewPath(options)).href,
    '--html-file',
    previewPath(options),
    '--out-dir',
    candidateRenderedDir(options),
    '--name',
    'candidate',
    '--wait-ms',
    options.waitMs,
    '--playwright-package',
    options.playwrightPackage,
    ...(options.viewportTimeoutMs > 0
      ? ['--viewport-timeout-ms', String(options.viewportTimeoutMs)]
      : []),
    '--capture-layout',
    ...(options.fullPage ? ['--full-page'] : []),
    ...(options.channel ? ['--channel', options.channel] : []),
    ...viewportArgs(options),
  ];
}

function longMobileReferenceCaptureArgs(options, startReport, referenceManifest) {
  const source = referenceCaptureSource(startReport, referenceManifest);
  const args = [
    '--url',
    source.url,
    '--out-dir',
    longMobileReferenceDir(options),
    '--name',
    'reference',
    '--wait-ms',
    options.referenceWaitMs,
    '--playwright-package',
    options.playwrightPackage,
    ...(options.viewportTimeoutMs > 0
      ? ['--viewport-timeout-ms', String(options.viewportTimeoutMs)]
      : []),
    '--capture-layout',
    '--viewport',
    LONG_MOBILE_VIEWPORT,
    ...(options.channel ? ['--channel', options.channel] : []),
  ];

  if (source.htmlFile) {
    args.push('--html-file', source.htmlFile);
  }

  return args;
}

function longMobileCandidateCaptureArgs(options) {
  return [
    '--url',
    pathToFileURL(previewPath(options)).href,
    '--html-file',
    previewPath(options),
    '--out-dir',
    longMobileCandidateDir(options),
    '--name',
    'candidate',
    '--wait-ms',
    options.waitMs,
    '--playwright-package',
    options.playwrightPackage,
    ...(options.viewportTimeoutMs > 0
      ? ['--viewport-timeout-ms', String(options.viewportTimeoutMs)]
      : []),
    '--capture-layout',
    '--viewport',
    LONG_MOBILE_VIEWPORT,
    ...(options.channel ? ['--channel', options.channel] : []),
  ];
}

function benchmarkArgs(options, startReport, referenceManifest, targetManifest, useCandidateManifest) {
  const args = [
    '--label',
    options.label,
    '--layout',
    layoutPath(options),
    '--contract',
    candidateContractPath(options),
    '--reference-manifest',
    referenceManifest,
    '--target-manifest',
    targetManifest,
    '--diff-dir',
    diffDir(options),
    '--out',
    benchmarkReportPath(options),
    '--markdown',
    benchmarkMarkdownPath(options),
    '--max-percent',
    options.maxPercent,
    '--max-viewport-percent',
    options.maxViewportPercent,
    ...(options.fullPage ? ['--pad-to-largest'] : []),
    '--json',
  ];

  if (useCandidateManifest) {
    args.push('--candidate-manifest', candidateManifestPath(options));
  } else {
    args.push('--candidate-dir', candidateRenderedDir(options), '--candidate-prefix', 'candidate');
  }
  if (shouldRequireRealReference(startReport)) {
    args.push('--require-real-reference');
  }
  if (shouldRequireMarketplace(startReport)) {
    args.push('--require-marketplace-media');
  }
  if (options.renderedMinCoverageRatio) {
    args.push('--rendered-min-coverage-ratio', options.renderedMinCoverageRatio);
  }

  return args;
}

function longMobileBenchmarkArgs(options, startReport) {
  const args = [
    '--label',
    `${options.label}-mobile-long`,
    '--layout',
    layoutPath(options),
    '--contract',
    candidateContractPath(options),
    '--reference-manifest',
    longMobileReferenceManifestPath(options),
    '--target-manifest',
    longMobileReferenceManifestPath(options),
    '--candidate-manifest',
    longMobileCandidateManifestPath(options),
    '--diff-dir',
    longMobileDiffDir(options),
    '--out',
    longMobileBenchmarkReportPath(options),
    '--markdown',
    longMobileBenchmarkMarkdownPath(options),
    '--max-percent',
    options.maxPercent,
    '--max-viewport-percent',
    options.maxViewportPercent,
    '--json',
  ];

  if (shouldRequireRealReference(startReport)) {
    args.push('--require-real-reference');
  }
  if (shouldRequireMarketplace(startReport)) {
    args.push('--require-marketplace-media');
  }
  if (options.renderedMinCoverageRatio) {
    args.push('--rendered-min-coverage-ratio', options.renderedMinCoverageRatio);
  }

  return args;
}

function stepSummary(run) {
  return {
    script: run.script,
    status: run.status,
    ok: run.report?.ok,
    stderr: run.stderr.trim(),
  };
}

function collectStepBlockers(source, run) {
  const blockers = [];
  if (!run) {
    return blockers;
  }
  if (Array.isArray(run.report?.blockers)) {
    return run.report.blockers.map((blocker) => ({ ...blocker, source: blocker.source || source }));
  }
  for (const item of Array.isArray(run.report?.errors) ? run.report.errors : []) {
    blockers.push({
      source,
      code: item.code || `${source}_error`,
      message: item.message || String(item),
    });
  }
  for (const item of Array.isArray(run.report?.qualityErrors) ? run.report.qualityErrors : []) {
    blockers.push({
      source,
      code: item.code || `${source}_quality_error`,
      message: item.message || String(item),
    });
  }
  for (const item of Array.isArray(run.report?.audit?.errors) ? run.report.audit.errors : []) {
    blockers.push({
      source,
      code: item.code || `${source}_audit_error`,
      message: item.message || String(item),
    });
  }
  if (run.status !== 0 && blockers.length === 0) {
    blockers.push({
      source,
      code: `${source}_failed`,
      message: run.stderr.trim() || `${run.script} exited with status ${run.status}.`,
    });
  }
  return blockers;
}

function collectVisualBudgetBlockers(benchmarkReport) {
  const comparison = benchmarkReport?.comparison;
  if (!comparison || comparison.ok !== false) {
    return [];
  }

  const budgetErrors = Array.isArray(comparison.budgetErrors) ? comparison.budgetErrors : [];
  if (budgetErrors.length > 0) {
    return budgetErrors.map((error) => ({
      source: 'visual-diff',
      code: error.code || 'visual_budget_failed',
      message: error.message || 'Visual screenshot budget failed.',
      label: error.label,
      percent: error.percent,
      maxPercent: error.maxPercent,
      maxViewportPercent: error.maxViewportPercent,
    }));
  }

  return [{
    source: 'visual-diff',
    code: 'visual_budget_failed',
    message: 'Visual screenshot comparison failed.',
  }];
}

function initialReport(options) {
  const requestedViewports = options.viewports.length > 0
    ? options.viewports.map(String)
    : [...CANONICAL_VIEWPORTS];
  const missingViewports = CANONICAL_VIEWPORTS
    .filter((viewport) => !requestedViewports.includes(viewport));
  const requestedViewportLabels = requestedViewports.map((viewport) => viewport.split(':')[0]);
  const missingViewportLabels = missingViewports.map((viewport) => viewport.split(':')[0]);
  return {
    schemaVersion: 1,
    artifact: 'monteby-visual-iteration',
    label: options.label,
    generatedAt: new Date().toISOString(),
    ok: false,
    status: 'running',
    diagnosticOnly: true,
    verificationLevel: options.fullPage
      ? 'full_page_static_visual_diagnostic'
      : 'viewport_only_static_visual_diagnostic',
    visualBenchmarkPassed: null,
    visualDiagnosticPassed: false,
    fidelityPassed: false,
    canonicalVerification: false,
    productReady: false,
    canonicalViewportCoverage: {
      required: CANONICAL_VIEWPORTS,
      requested: requestedViewports,
      requestedLabels: requestedViewportLabels,
      missing: missingViewports,
      missingLabels: missingViewportLabels,
      fullPage: options.fullPage,
      strictVisualBudget: options.allowStructuralVerdict !== true,
      zeroDiffBudget: Number(options.maxPercent) === 0
        && Number(options.maxViewportPercent) === 0,
      complete: options.fullPage
        && missingViewportLabels.length === 0
        && options.allowStructuralVerdict !== true
        && Number(options.maxPercent) === 0
        && Number(options.maxViewportPercent) === 0,
    },
    canonicalEvidence: {
      renderer: 'render-monteby-preview.js',
      staticHtmlPreview: true,
      wordpressRestValidated: false,
      wordpressRestSaved: false,
      wordpressPhpPreviewed: false,
    },
    artifactBindings: {
      layoutPlanSha256: '',
      layoutPlanDigestFormat: 'sha256:file-bytes',
      candidateLayoutSha256: '',
      candidateLayoutDigestFormat: 'sha256:json-stringify-node-map',
      plannedSourceLayoutSha256: '',
      inputFileDigestFormat: 'sha256:file-bytes',
      sourceContractSha256: '',
      contractSha256: '',
      referenceManifestSha256: '',
      targetManifestSha256: '',
      rootOrderMatches: false,
      surfaceMappingsResolve: false,
    },
    files: {
      outDir: options.outDir,
      sourceContract: options.contract,
      contract: candidateContractPath(options),
      startReport: startReportPath(options),
      layoutDraft: layoutDraftPath(options),
      layoutPlan: layoutPlanPath(options),
      layout: layoutPath(options),
      sourceCandidateLayout: options.candidateLayout,
      preview: previewPath(options),
      previewFragment: previewFragmentPath(options),
      candidateManifest: candidateManifestPath(options),
      longMobileReferenceManifest: longMobileReferenceManifestPath(options),
      longMobileCandidateManifest: longMobileCandidateManifestPath(options),
      longMobileBenchmarkReport: longMobileBenchmarkReportPath(options),
      longMobileBenchmarkMarkdown: longMobileBenchmarkMarkdownPath(options),
      benchmarkReport: benchmarkReportPath(options),
      benchmarkMarkdown: benchmarkMarkdownPath(options),
      iterationReport: iterationReportPath(options),
      iterationMarkdown: iterationMarkdownPath(options),
    },
    options: {
      seed: options.seed,
      variant: options.variant,
      archetype: options.archetype,
      referenceUrls: options.referenceUrls,
      marketplaceReference: options.marketplaceReference,
      viewports: options.viewports,
      viewportTimeoutMs: options.viewportTimeoutMs,
      fullPage: options.fullPage,
      waitMs: options.waitMs,
      referenceWaitMs: options.referenceWaitMs,
      channel: options.channel,
      playwrightPackage: options.playwrightPackage,
      maxPercent: options.maxPercent,
      maxViewportPercent: options.maxViewportPercent,
      allowStructuralVerdict: options.allowStructuralVerdict,
      preserveSourceText: options.preserveSourceText,
      referenceHtmlFile: options.referenceHtmlFile,
      candidateLayout: options.candidateLayout,
    },
    referenceManifest: '',
    targetManifest: '',
    useCandidateManifest: false,
    longMobile: {
      needed: false,
      reason: 'not_checked',
      diagnosticOnly: true,
    },
    steps: {},
    blockers: [],
    repairQueue: [],
    nextAction: {
      id: 'wait_for_step',
      tool: '',
      args: [],
      requires: [],
      instruction: 'The iteration is running.',
    },
  };
}

function writeIterationMarkdown(report) {
  const status = report.ok
    ? 'VISUAL DIAGNOSTIC PASS'
    : report.status === 'running'
      ? 'RUNNING'
      : 'FAIL';
  const visualBenchmark = typeof report.visualBenchmarkPassed === 'boolean'
    ? (report.visualBenchmarkPassed ? 'yes' : 'no')
    : 'not run';
  const lines = [
    '# Monteby Visual Iteration',
    '',
    `- Status: ${status}`,
    `- Diagnostic status: ${report.status}`,
    `- Verification level: ${report.verificationLevel}`,
    `- Visual benchmark passed: ${visualBenchmark}`,
    `- Visual diagnostic passed: ${report.visualDiagnosticPassed ? 'yes' : 'no'}`,
    `- Final fidelity passed: ${report.fidelityPassed ? 'yes' : 'no'}`,
    `- Canonical WordPress verification: ${report.canonicalVerification ? 'yes' : 'no'}`,
    `- Product ready / REST verified: ${report.productReady ? 'yes' : 'no'}`,
    `- Canonical viewport coverage: ${report.canonicalViewportCoverage?.complete ? 'complete' : 'incomplete'}`,
    `- Missing canonical viewports: ${(report.canonicalViewportCoverage?.missingLabels || []).join(', ') || 'none'}`,
    `- Label: ${report.label}`,
    `- Target manifest: \`${report.targetManifest || ''}\``,
    `- Reference manifest: \`${report.referenceManifest || ''}\``,
    `- Layout: \`${report.files.layout}\``,
    `- Layout plan: \`${report.files.layoutPlan}\``,
    `- Preview: \`${report.files.preview}\``,
    `- Candidate manifest: \`${report.files.candidateManifest}\``,
    `- Benchmark report: \`${report.files.benchmarkReport}\``,
    '',
    '## Verification Boundary',
    '',
    `- Candidate renderer: ${report.canonicalEvidence.renderer} (static HTML diagnostic)`,
    `- WordPress REST validate evidence: ${report.canonicalEvidence.wordpressRestValidated ? 'yes' : 'no'}`,
    `- WordPress REST save evidence: ${report.canonicalEvidence.wordpressRestSaved ? 'yes' : 'no'}`,
    `- WordPress/PHP preview evidence: ${report.canonicalEvidence.wordpressPhpPreviewed ? 'yes' : 'no'}`,
    '- A visual diagnostic pass is not a final 1:1 fidelity result or canonical product verification.',
    '',
    '## Steps',
    '',
  ];

  for (const [name, step] of Object.entries(report.steps)) {
    lines.push(`- ${name}: status ${step.status}${typeof step.ok === 'boolean' ? `, ok ${step.ok}` : ''}`);
  }

  lines.push('', '## Long Mobile Diagnostic', '');
  lines.push(`- Needed: ${report.longMobile?.needed ? 'yes' : 'no'}`);
  lines.push(`- Reason: ${report.longMobile?.reason || ''}`);
  lines.push('- Blocking: no, diagnostic evidence only');
  if (report.longMobile?.needed) {
    lines.push(`- Reference manifest: \`${report.files.longMobileReferenceManifest}\``);
    lines.push(`- Candidate manifest: \`${report.files.longMobileCandidateManifest}\``);
    lines.push(`- Benchmark report: \`${report.files.longMobileBenchmarkReport}\``);
    if (report.longMobile.visualReview?.sheet) {
      lines.push(`- Contact sheet: \`${report.longMobile.visualReview.sheet}\``);
    }
  }

  lines.push('', '## Blockers', '');
  if (report.blockers.length === 0) {
    lines.push('- None');
  } else {
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker.source || 'iteration'} / ${blocker.code || 'blocked'}: ${blocker.message || ''}`);
    }
  }

  lines.push('', '## Repair Queue', '');
  if (!Array.isArray(report.repairQueue) || report.repairQueue.length === 0) {
    lines.push('- None');
  } else {
    for (const item of report.repairQueue) {
      const section = item.sectionId ? ` section \`${item.sectionId}\`,` : '';
      const viewport = item.viewport ? ` viewport \`${item.viewport}\`,` : '';
      lines.push(`- ${item.code}:${section}${viewport} ${item.instruction}`);
    }
  }

  lines.push('', '## Next Action', '');
  lines.push(`- ID: \`${report.nextAction?.id || ''}\``);
  lines.push(`- Tool: \`${report.nextAction?.tool || ''}\``);
  lines.push(`- Args: \`${JSON.stringify(report.nextAction?.args || [])}\``);
  lines.push(`- Requires: \`${JSON.stringify(report.nextAction?.requires || [])}\``);
  lines.push(`- Instruction: ${report.nextAction?.instruction || ''}`);

  fs.writeFileSync(iterationMarkdownPath({ outDir: report.files.outDir }), `${lines.join('\n')}\n`);
}

function persist(report) {
  writeJson(report.files.iterationReport, report);
  writeIterationMarkdown(report);
}

function loadLayoutPlan(report) {
  const file = report?.files?.layoutPlan;
  if (!file || !fs.existsSync(file)) {
    return null;
  }

  try {
    return readJson(file);
  } catch (error) {
    return null;
  }
}

const LAYOUT_SURFACE_KINDS = ['text', 'media', 'group', 'child'];

function validSurfaceCounts(value) {
  return isObject(value) && LAYOUT_SURFACE_KINDS.every(
    (kind) => Number.isInteger(value[kind]) && value[kind] >= 0
  );
}

function sameSurfaceCounts(left, right) {
  return validSurfaceCounts(left)
    && validSurfaceCounts(right)
    && LAYOUT_SURFACE_KINDS.every((kind) => left[kind] === right[kind]);
}

function nodeBelongsToRoot(nodeMap, nodeId, rootId) {
  let currentId = String(nodeId || '');
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    if (currentId === rootId) {
      return true;
    }
    visited.add(currentId);
    currentId = String(nodeMap?.[currentId]?.parent || '');
  }
  return false;
}

function validateLayoutPlan(file) {
  let plan;
  try {
    plan = readJson(file);
  } catch (error) {
    return [{
      source: 'draft',
      code: 'layout_plan_invalid_json',
      message: 'The required layout plan is not valid JSON.',
    }];
  }

  const blockers = [];
  let sourceNodeMap = null;
  if (plan.schemaVersion !== 1 || plan.artifact !== 'monteby-layout-plan') {
    blockers.push({
      source: 'draft',
      code: 'layout_plan_schema_invalid',
      message: 'The layout plan must use schemaVersion 1 and artifact "monteby-layout-plan".',
    });
  }
  const sourceLayout = resolvedPlanSourceLayout(file, plan.sourceLayout);
  if (!sourceLayout || !fs.existsSync(sourceLayout)) {
    blockers.push({
      source: 'draft',
      code: 'layout_plan_source_missing',
      message: 'The layout plan must retain the original generated layout used to restore mapped subtrees.',
    });
  } else {
    try {
      sourceNodeMap = extractNodeMap(readJson(sourceLayout));
    } catch {
      sourceNodeMap = null;
    }
    const sourceDigest = sourceNodeMap ? nodeMapSha256(sourceNodeMap) : '';
    if (
      !/^[a-f0-9]{64}$/.test(String(plan.sourceLayoutSha256 || ''))
      || plan.sourceLayoutDigestFormat !== 'sha256:json-stringify-node-map'
      || !sourceDigest
      || sourceDigest !== plan.sourceLayoutSha256
    ) {
      blockers.push({
        source: 'draft',
        code: 'layout_plan_source_digest_mismatch',
        message: 'The layout plan source digest does not bind the exact generated node map.',
      });
    }
  }
  if (!plan.completion || typeof plan.completion !== 'object' || Array.isArray(plan.completion)) {
    blockers.push({
      source: 'draft',
      code: 'layout_plan_completion_missing',
      message: 'The layout plan must contain a completion object.',
    });
    return blockers;
  }

  const omittedBands = Array.isArray(plan.completion.omittedBands) ? plan.completion.omittedBands : null;
  const omittedMedia = Array.isArray(plan.completion.omittedMedia) ? plan.completion.omittedMedia : null;
  const omittedText = Array.isArray(plan.completion.omittedText) ? plan.completion.omittedText : null;
  const omittedGroups = plan.mode === 'generic-measured-reference'
    ? (Array.isArray(plan.completion.omittedGroups) ? plan.completion.omittedGroups : null)
    : [];
  const omittedChildren = plan.mode === 'generic-measured-reference'
    ? (Array.isArray(plan.completion.omittedChildren) ? plan.completion.omittedChildren : null)
    : [];
  if (
    plan.completion.truncated !== false
    || omittedBands === null
    || omittedMedia === null
    || omittedText === null
    || omittedGroups === null
    || omittedChildren === null
    || omittedBands.length > 0
    || omittedMedia.length > 0
    || omittedText.length > 0
    || omittedGroups.length > 0
    || omittedChildren.length > 0
    || (plan.mode === 'generic-measured-reference' && plan.completion.allSurfacesMapped !== true)
  ) {
    blockers.push({
      source: 'draft',
      code: 'layout_plan_incomplete',
      message: 'The layout plan is truncated, reports omitted measured surfaces, or lacks complete surface parity; no later stage may continue.',
    });
  }

  const rootSectionIds = Array.isArray(plan.rootSectionIds) ? plan.rootSectionIds : [];
  if (rootSectionIds.length !== Number(plan.completion.emittedSections)) {
    blockers.push({
      source: 'draft',
      code: 'layout_plan_section_count_mismatch',
      message: 'The layout plan emittedSections count does not match rootSectionIds.',
    });
  }
  if (
    sourceNodeMap
    && !sameStringOrder(rootSectionIds, sourceNodeMap?.ROOT?.nodes)
  ) {
    blockers.push({
      source: 'draft',
      code: 'layout_plan_source_root_order_mismatch',
      message: 'The planned root IDs/order do not match the exact generated source layout.',
    });
  }

  if (plan.mode === 'generic-measured-reference') {
    const bands = Array.isArray(plan.bands) ? plan.bands : [];
    if (
      bands.length !== Number(plan.completion.plannedBands)
      || plan.completion.allBandsMapped !== true
      || bands.some((band) => !band || typeof band.generatedSectionId !== 'string' || !band.generatedSectionId)
    ) {
      blockers.push({
        source: 'draft',
        code: 'layout_plan_band_mapping_incomplete',
        message: 'Every measured generic band must map to one stable generated section ID.',
      });
    }

    const completionCountsValid = validSurfaceCounts(plan.completion.capturedSurfaces)
      && validSurfaceCounts(plan.completion.authoredSurfaces)
      && sameSurfaceCounts(
        plan.completion.capturedSurfaces,
        plan.completion.authoredSurfaces
      );
    const summedCaptured = Object.fromEntries(LAYOUT_SURFACE_KINDS.map((kind) => [kind, 0]));
    const summedAuthored = Object.fromEntries(LAYOUT_SURFACE_KINDS.map((kind) => [kind, 0]));
    let surfaceEvidenceValid = completionCountsValid;

    for (const band of bands) {
      const mappings = Array.isArray(band?.surfaceMappings) ? band.surfaceMappings : null;
      const parity = isObject(band?.surfaceParity) ? band.surfaceParity : null;
      const omitted = isObject(parity?.omitted) ? parity.omitted : null;
      const captured = parity?.captured;
      const authored = parity?.authored;
      if (
        !mappings
        || !parity
        || !validSurfaceCounts(captured)
        || !validSurfaceCounts(authored)
        || !sameSurfaceCounts(captured, authored)
        || parity.complete !== true
        || !omitted
        || !LAYOUT_SURFACE_KINDS.every(
          (kind) => Array.isArray(omitted[kind]) && omitted[kind].length === 0
        )
      ) {
        surfaceEvidenceValid = false;
        continue;
      }

      for (const kind of LAYOUT_SURFACE_KINDS) {
        summedCaptured[kind] += captured[kind];
        summedAuthored[kind] += authored[kind];
      }

      const seen = new Set();
      const mappedCounts = Object.fromEntries(LAYOUT_SURFACE_KINDS.map((kind) => [kind, 0]));
      for (const mapping of mappings) {
        const mappingKey = `${String(mapping?.kind || '')}:${String(mapping?.structureKey || '')}`;
        const nodeId = String(mapping?.generatedNodeId || '');
        const geometryNodeId = String(mapping?.geometryNodeId || '');
        if (
          !LAYOUT_SURFACE_KINDS.includes(mapping?.kind)
          || !mapping?.structureKey
          || !nodeId
          || !mapping?.generatedComponent
          || typeof mapping?.strategy !== 'string'
          || !mapping.strategy
          || typeof mapping?.lowered !== 'boolean'
          || !Array.isArray(mapping?.viewports)
          || mapping.viewports.length === 0
          || mapping.viewports.some((viewport) => typeof viewport !== 'string' || !viewport)
          || seen.has(mappingKey)
          || !sourceNodeMap?.[nodeId]
          || !nodeBelongsToRoot(sourceNodeMap, nodeId, band.generatedSectionId)
          || (geometryNodeId && (
            !sourceNodeMap?.[geometryNodeId]
            || !nodeBelongsToRoot(sourceNodeMap, geometryNodeId, band.generatedSectionId)
          ))
        ) {
          surfaceEvidenceValid = false;
          continue;
        }
        seen.add(mappingKey);
        mappedCounts[mapping.kind] += 1;
      }
      if (!sameSurfaceCounts(mappedCounts, authored)) {
        surfaceEvidenceValid = false;
      }
    }

    if (
      !surfaceEvidenceValid
      || !sameSurfaceCounts(summedCaptured, plan.completion.capturedSurfaces)
      || !sameSurfaceCounts(summedAuthored, plan.completion.authoredSurfaces)
    ) {
      blockers.push({
        source: 'draft',
        code: 'layout_plan_surface_mapping_incomplete',
        message: 'Every captured text/media/group/child surface must bind once to an existing node below its planned root section.',
      });
    }
  }

  return blockers;
}

function validateCandidatePlanBinding(planFile, candidateFile) {
  const blockers = [];
  const evidence = {
    layoutPlanSha256: '',
    layoutPlanDigestFormat: 'sha256:file-bytes',
    candidateLayoutSha256: '',
    candidateLayoutDigestFormat: 'sha256:json-stringify-node-map',
    plannedSourceLayoutSha256: '',
    rootOrderMatches: false,
    surfaceMappingsResolve: false,
  };
  let plan;
  let candidateNodeMap;
  try {
    plan = readJson(planFile);
    evidence.layoutPlanSha256 = fileSha256(planFile);
    evidence.plannedSourceLayoutSha256 = String(plan.sourceLayoutSha256 || '');
  } catch {
    blockers.push({
      source: 'iteration',
      code: 'layout_plan_binding_invalid',
      message: 'The passing candidate cannot be bound because the layout plan is unreadable.',
    });
    return { blockers, evidence };
  }
  try {
    candidateNodeMap = extractNodeMap(readJson(candidateFile));
    evidence.candidateLayoutSha256 = candidateNodeMap
      ? nodeMapSha256(candidateNodeMap)
      : '';
  } catch {
    candidateNodeMap = null;
  }
  if (!candidateNodeMap || !evidence.candidateLayoutSha256) {
    blockers.push({
      source: 'iteration',
      code: 'candidate_layout_binding_invalid',
      message: 'The actual candidate does not contain a valid ROOT node map to hash and bind.',
    });
    return { blockers, evidence };
  }

  const plannedRoots = Array.isArray(plan.rootSectionIds) ? plan.rootSectionIds : [];
  const candidateRoots = Array.isArray(candidateNodeMap?.ROOT?.nodes)
    ? candidateNodeMap.ROOT.nodes
    : [];
  evidence.rootOrderMatches = sameStringOrder(plannedRoots, candidateRoots);
  if (!evidence.rootOrderMatches) {
    blockers.push({
      source: 'iteration',
      code: 'candidate_layout_root_order_mismatch',
      message: 'The actual candidate ROOT.nodes IDs/order differ from the mechanically planned roots.',
    });
  }

  const missingMappings = [];
  for (const band of Array.isArray(plan.bands) ? plan.bands : []) {
    for (const mapping of Array.isArray(band?.surfaceMappings) ? band.surfaceMappings : []) {
      const generatedNodeId = String(mapping?.generatedNodeId || '');
      const geometryNodeId = String(mapping?.geometryNodeId || '');
      if (
        !candidateNodeMap[generatedNodeId]
        || !nodeBelongsToRoot(candidateNodeMap, generatedNodeId, band.generatedSectionId)
        || (geometryNodeId && (
          !candidateNodeMap[geometryNodeId]
          || !nodeBelongsToRoot(candidateNodeMap, geometryNodeId, band.generatedSectionId)
        ))
      ) {
        missingMappings.push(`${String(mapping?.kind || '')}:${String(mapping?.structureKey || '')}`);
      }
    }
  }
  evidence.surfaceMappingsResolve = missingMappings.length === 0;
  if (!evidence.surfaceMappingsResolve) {
    blockers.push({
      source: 'iteration',
      code: 'candidate_layout_surface_mapping_missing',
      message: `The actual candidate no longer contains planned surface mappings: ${missingMappings.join(', ')}.`,
    });
  }
  return { blockers, evidence };
}

function bindIterationInputFiles(files) {
  const blockers = [];
  const evidence = {
    inputFileDigestFormat: 'sha256:file-bytes',
  };
  for (const [field, file] of Object.entries({
    sourceContractSha256: files?.sourceContract,
    contractSha256: files?.contract,
    referenceManifestSha256: files?.referenceManifest,
    targetManifestSha256: files?.targetManifest,
  })) {
    if (typeof file !== 'string' || !file || !fs.existsSync(file)) {
      evidence[field] = '';
      blockers.push({
        source: 'iteration',
        code: 'iteration_artifact_binding_missing',
        message: `Cannot bind required diagnostic input for ${field}.`,
      });
      continue;
    }
    evidence[field] = fileSha256(file);
  }
  return { blockers, evidence };
}

function buildRepairQueue(report) {
  if (report.status === 'diagnostic_passed') {
    return [];
  }

  const queue = [];
  const plan = loadLayoutPlan(report);
  const planBands = Array.isArray(plan?.bands) ? plan.bands : [];
  let candidateRootIds = [];
  try {
    const payload = report?.files?.layout && fs.existsSync(report.files.layout)
      ? readJson(report.files.layout)
      : null;
    const nodeMap = payload?.ROOT
      ? payload
      : payload?.nodeMap?.ROOT
        ? payload.nodeMap
        : payload?.layout?.ROOT
          ? payload.layout
          : null;
    candidateRootIds = Array.isArray(nodeMap?.ROOT?.nodes) ? nodeMap.ROOT.nodes : [];
  } catch {
    candidateRootIds = [];
  }
  const viewports = Array.isArray(report?.benchmark?.genericGeometry?.stats?.viewports)
    ? report.benchmark.genericGeometry.stats.viewports
    : [];

  for (const viewport of viewports) {
    const label = String(viewport?.label || 'unknown');
    for (const missing of Array.isArray(viewport?.bands?.missing) ? viewport.bands.missing : []) {
      const band = planBands[Number(missing.index)] || null;
      queue.push({
        code: 'restore_measured_band',
        viewport: label,
        referenceIndex: missing.index,
        sectionId: band?.generatedSectionId || '',
        evidence: {
          tags: missing.tags,
          top: missing.top,
          height: missing.height,
          width: missing.width,
          target: band?.viewports?.[label] || null,
          sourceLayout: plan?.sourceLayout || '',
          sourceSectionId: band?.generatedSectionId || '',
        },
        instruction: `Restore reference band #${Number(missing.index) + 1} with the captured order and normalized top/height/width.`,
      });
    }

    for (const extra of Array.isArray(viewport?.bands?.extra) ? viewport.bands.extra : []) {
      const measuredNodeIds = Array.isArray(extra?.montebyNodeIds)
        ? extra.montebyNodeIds.filter((nodeId) => candidateRootIds.includes(nodeId))
        : [];
      const candidateRootId = measuredNodeIds.length === 1 ? measuredNodeIds[0] : '';
      queue.push({
        code: 'remove_or_merge_extra_band',
        viewport: label,
        candidateIndex: extra.index,
        sectionId: candidateRootId,
        evidence: {
          tags: extra.tags,
          top: extra.top,
          height: extra.height,
          width: extra.width,
          candidateRootId,
          measuredNodeIds,
        },
        instruction: `Remove candidate band #${Number(extra.index) + 1} only if the repair applier proves it is a duplicate; otherwise require an explicit content-scope decision.`,
      });
    }

    const geometryErrorCodes = new Set((Array.isArray(viewport?.errors) ? viewport.errors : [])
      .map((error) => String(error?.code || ''))
      .filter((code) => /^generic_geometry_band_(?:top|height|width)_mismatch$/u.test(code)));
    const pairs = geometryErrorCodes.size > 0 && Array.isArray(viewport?.geometry?.pairs)
      ? viewport.geometry.pairs
      : [];
    const rankedPairs = pairs
      .map((pair) => ({
        ...pair,
        severity: Math.max(
          geometryErrorCodes.has('generic_geometry_band_top_mismatch') ? Number(pair.topDelta) || 0 : 0,
          geometryErrorCodes.has('generic_geometry_band_height_mismatch') ? Number(pair.heightDelta) || 0 : 0,
          geometryErrorCodes.has('generic_geometry_band_width_mismatch') ? Number(pair.widthDelta) || 0 : 0
        ),
      }))
      .filter((pair) => pair.severity > 0)
      .sort((left, right) => right.severity - left.severity);

    for (const pair of rankedPairs) {
      const band = planBands[Number(pair.referenceIndex)] || null;
      queue.push({
        code: 'match_band_geometry',
        viewport: label,
        referenceIndex: pair.referenceIndex,
        candidateIndex: pair.candidateIndex,
        sectionId: band?.generatedSectionId || '',
        evidence: {
          topDelta: pair.topDelta,
          heightDelta: pair.heightDelta,
          widthDelta: pair.widthDelta,
          signedTopDelta: pair.signedTopDelta,
          signedHeightDelta: pair.signedHeightDelta,
          signedWidthDelta: pair.signedWidthDelta,
          referenceGeometry: pair.referenceGeometry,
          candidateGeometry: pair.candidateGeometry,
          candidateGeometrySource: pair.candidateGeometrySource,
          target: band?.viewports?.[label] || null,
          precedingSectionId: Number(pair.referenceIndex) > 0
            ? planBands[Number(pair.referenceIndex) - 1]?.generatedSectionId || ''
            : '',
        },
        instruction: `Tune the mapped section to reduce normalized deltas (top ${pair.topDelta}, height ${pair.heightDelta}, width ${pair.widthDelta}).`,
      });
    }
  }

  for (const blocker of Array.isArray(report.blockers) ? report.blockers : []) {
    const viewport = blocker.label || '';
    const code = String(blocker.code || '');
    const representedRepairCode = /^generic_geometry_band_(?:top|height|width)_mismatch$/.test(code)
      ? 'match_band_geometry'
      : code === 'generic_geometry_major_band_missing'
        ? 'restore_measured_band'
        : code === 'generic_geometry_major_band_extra'
          ? 'remove_or_merge_extra_band'
          : '';
    const represented = representedRepairCode
      && queue.some((item) => item.code === representedRepairCode && item.viewport === viewport);
    const deferredVisualSummary = queue.length > 0
      && blocker.source === 'visual-diff'
      && [
        'max_percent_exceeded',
        'max_viewport_percent_exceeded',
        'visual_budget_failed',
        'canonical_visual_budget_failed',
      ].includes(code);
    const duplicate = queue.some((item) => item.code === blocker.code && item.viewport === viewport);
    if (!duplicate && !represented && !deferredVisualSummary) {
      queue.push({
        code: blocker.code || 'resolve_blocker',
        viewport,
        sectionId: '',
        evidence: blocker,
        instruction: blocker.message || 'Resolve the reported blocker without bypassing the contract.',
      });
    }
  }

  return queue;
}

function iterationArgsFor(report, candidateLayout = '', overrides = {}) {
  const options = report.options || {};
  const fullPage = typeof overrides.fullPage === 'boolean' ? overrides.fullPage : options.fullPage;
  const viewports = Array.isArray(overrides.viewports) ? overrides.viewports : options.viewports;
  const allowStructuralVerdict = typeof overrides.allowStructuralVerdict === 'boolean'
    ? overrides.allowStructuralVerdict
    : options.allowStructuralVerdict;
  const args = [
    '--label', report.label,
    '--contract', report.files.sourceContract,
    '--seed', options.seed,
    '--variant', options.variant,
    '--out-dir', report.files.outDir,
    fullPage ? '--full-page' : '--viewport-only',
    '--wait-ms', options.waitMs,
    '--reference-wait-ms', options.referenceWaitMs,
    '--playwright-package', options.playwrightPackage,
    '--max-percent', options.maxPercent,
    '--max-viewport-percent', options.maxViewportPercent,
    '--json',
  ];

  if (options.archetype) {
    args.push('--archetype', options.archetype);
  }
  if (options.referenceHtmlFile) {
    args.push('--reference-html-file', options.referenceHtmlFile);
  }
  for (const url of Array.isArray(options.referenceUrls) ? options.referenceUrls : []) {
    args.push('--reference-url', url);
  }
  if (options.marketplaceReference) {
    args.push('--marketplace-reference');
  }
  if (options.preserveSourceText) {
    args.push('--preserve-source-text');
  }
  if (allowStructuralVerdict) {
    args.push('--allow-structural-verdict');
  }
  if (options.channel) {
    args.push('--channel', options.channel);
  }
  if (Number(options.viewportTimeoutMs) > 0) {
    args.push('--viewport-timeout-ms', String(options.viewportTimeoutMs));
  }
  if (options.renderedMinCoverageRatio) {
    args.push('--rendered-min-coverage-ratio', options.renderedMinCoverageRatio);
  }
  for (const viewport of Array.isArray(viewports) ? viewports : []) {
    args.push('--viewport', viewport);
  }
  if (candidateLayout) {
    args.push('--candidate-layout', candidateLayout);
  }

  return args;
}

function nextActionFor(report) {
  const retry = {
    tool: scriptPath('run-visual-iteration.js'),
    args: iterationArgsFor(report, report.files.sourceCandidateLayout || ''),
    requires: [],
  };

  if (report.status === 'diagnostic_passed') {
    if (report.canonicalViewportCoverage?.complete !== true) {
      return {
        id: 'capture_canonical_viewports',
        tool: scriptPath('run-visual-iteration.js'),
        args: iterationArgsFor(report, report.files.layout, {
          fullPage: true,
          viewports: CANONICAL_VIEWPORTS,
          allowStructuralVerdict: false,
        }),
        requires: [],
        instruction: 'Run the exact full-page three-viewport command before any canonical WordPress mutation.',
      };
    }
    return {
      id: 'snapshot_canonical_page',
      tool: scriptPath('wordpress-layout-client.js'),
      args: [
        'snapshot',
        '--site', '$MONTEBY_SITE_URL',
        '--page-id', '$MONTEBY_PAGE_ID',
        '--out-dir', path.join(report.files.outDir, 'wordpress'),
      ],
      requires: ['MONTEBY_SITE_URL', 'MONTEBY_PAGE_ID', 'MONTEBY_AUTH_HEADER'],
      instruction: 'Provide the target site and page ID, keep authorization in MONTEBY_AUTH_HEADER, then snapshot before validation or save.',
    };
  }

  if (
    report.status === 'visual_budget_failed'
    || report.status === 'benchmark_failed'
    || report.status === 'candidate_audit_failed'
  ) {
    const repairReport = report.repairReportPath
      || report.files.iterationReport
      || path.join(report.files.outDir, 'visual-iteration-report.json');
    const candidateLayout = report.files.layout
      || report.files.sourceCandidateLayout
      || path.join(report.files.outDir, 'candidate', 'layout.json');
    const repairedLayout = path.join(path.dirname(candidateLayout), 'layout-repaired.json');
    return {
      id: 'apply_layout_repair_queue',
      tool: scriptPath('apply-layout-repair-queue.js'),
      args: [
        '--iteration-report', repairReport,
        '--out', repairedLayout,
        '--json',
      ],
      requires: [],
      instruction: 'Apply the complete repairQueue deterministically; ambiguous content scope and unknown blockers remain hard stops.',
    };
  }

  const blockers = Array.isArray(report.blockers) ? report.blockers : [];
  const productGapBlocker = (blocker) => {
    const code = String(blocker?.code || '');
    return /(?:^|_)(?:product|capability|control)_gap(?:_|$)/i.test(code)
      || /^missing_(?:component|authoring_prop|media_capability|.*(?:control|controls))$/i.test(code);
  };
  if (
    (report.status === 'readiness_failed' || report.status === 'draft_failed')
    && blockers.length > 0
    && blockers.every(productGapBlocker)
  ) {
    return {
      id: 'resolve_product_gap',
      tool: 'monteby-widget-development',
      args: [],
      requires: [],
      instruction: 'Treat the reported contract or capability gap as product work. Do not bypass it with raw CSS, HTML, or theme overrides.',
    };
  }

  if (report.status === 'readiness_failed' || report.status === 'draft_failed') {
    return {
      id: 'blocked_iteration_inputs',
      tool: '',
      args: [],
      requires: ['VALID_ITERATION_INPUTS'],
      instruction: 'Stop. Repair or recapture the explicit input/plan evidence, then start a new iteration; this is not automatically a product gap.',
    };
  }

  if (report.status === 'render_failed' || report.status === 'candidate_capture_failed') {
    return {
      id: 'retry_render_or_capture',
      ...retry,
      requires: ['RENDER_OR_CAPTURE_FAILURE_RESOLVED'],
      instruction: 'Resolve the reported renderer or capture failure, then run this exact command without changing the measured plan.',
    };
  }

  return {
    id: 'blocked_iteration_stage',
    tool: '',
    args: [],
    requires: ['ITERATION_BLOCKERS_RESOLVED'],
    instruction: 'Stop. The current failure has no mechanically safe automatic transition; resolve its explicit blockers before starting a new run.',
  };
}

function finish(report, status, blockers = []) {
  report.status = status;
  report.blockers = blockers;
  report.ok = status === 'diagnostic_passed';
  report.diagnosticOnly = true;
  report.fidelityPassed = false;
  report.canonicalVerification = false;
  report.productReady = false;
  report.repairQueue = buildRepairQueue(report);
  report.nextAction = nextActionFor(report);
  persist(report);
  return report;
}

function failAt(report, status, source, run) {
  return finish(report, status, collectStepBlockers(source, run));
}

function referenceCaptureSource(startReport, referenceManifest) {
  const manifest = referenceManifest && fs.existsSync(referenceManifest) ? readJson(referenceManifest) : {};
  let url = String(manifest.sourceUrl || manifest.url || '').trim();
  let htmlFile = '';

  if (url.startsWith('file:')) {
    htmlFile = fileURLToPath(url);
  }

  if (!url && startReport?.files?.targetHtml) {
    htmlFile = path.resolve(startReport.files.targetHtml);
    url = pathToFileURL(htmlFile).href;
  }

  if (!htmlFile && url.startsWith('file:')) {
    htmlFile = fileURLToPath(url);
  }

  return { url, htmlFile };
}

function longMobilePlan(referenceManifest) {
  const plan = {
    needed: false,
    reason: 'mobile_reference_does_not_need_long_proof',
    diagnosticOnly: true,
    stats: {},
  };

  if (!referenceManifest || !fs.existsSync(referenceManifest)) {
    plan.reason = 'reference_manifest_missing';
    return plan;
  }

  const mobileLayout = loadManifestLayout(referenceManifest, 'mobile');
  if (!mobileLayout) {
    plan.reason = 'mobile_layout_missing';
    return plan;
  }

  const viewport = mobileLayout.viewport || {};
  const viewportWidth = finiteNumber(viewport.width);
  const viewportHeight = finiteNumber(viewport.height);
  const viewportArea = viewportWidth * viewportHeight;
  if (viewportArea <= 0 || viewportHeight <= 0) {
    plan.reason = 'mobile_viewport_missing';
    return plan;
  }

  const mediaBoxes = meaningfulPhotoBoxes(mobileLayout);
  const firstViewportMediaArea = mediaBoxes.reduce((sum, box) => sum + Math.max(0, finiteNumber(box.firstViewportArea)), 0);
  const firstViewportCoverage = Math.round(Math.min(1, firstViewportMediaArea / viewportArea) * 10000) / 10000;
  const afterFoldBox = mediaBoxes
    .filter((box) => {
      const top = mediaBoxTop(box);
      return top >= viewportHeight * LONG_MOBILE_AFTER_FOLD_MIN && top <= viewportHeight * LONG_MOBILE_AFTER_FOLD_MAX;
    })
    .sort((first, second) => mediaBoxTop(first) - mediaBoxTop(second))[0] || null;

  plan.stats = {
    viewport: { width: viewportWidth, height: viewportHeight },
    firstViewportCoverage,
    meaningfulPhotoBoxes: mediaBoxes.length,
    afterFoldPhotoTop: afterFoldBox ? Math.round(mediaBoxTop(afterFoldBox)) : null,
  };

  if (firstViewportCoverage < LONG_MOBILE_FIRST_VIEWPORT_COVERAGE_MAX && afterFoldBox) {
    plan.needed = true;
    plan.reason = 'mobile_first_viewport_is_photo_light_but_reference_has_after_fold_photography';
  }

  return plan;
}

function loadManifestLayout(manifestFile, label, returnFile = false) {
  const manifest = readJson(manifestFile);
  const manifestDir = path.dirname(manifestFile);
  const entries = [];
  if (Array.isArray(manifest.layoutCapture?.layouts)) {
    entries.push(...manifest.layoutCapture.layouts);
  }
  if (Array.isArray(manifest.layouts)) {
    entries.push(...manifest.layouts);
  }

  const entry = entries.find((item) => item?.label === label && item?.status !== 'failed');
  const file = entry?.file || '';
  if (!file) {
    return null;
  }

  const resolved = path.isAbsolute(file) ? file : path.join(manifestDir, file);
  if (!fs.existsSync(resolved)) {
    return null;
  }

  return returnFile ? resolved : readJson(resolved);
}

function meaningfulPhotoBoxes(layout) {
  const viewport = layout?.viewport || {};
  const viewportArea = finiteNumber(viewport.width) * finiteNumber(viewport.height);
  const minArea = Math.max(12000, viewportArea * 0.004);
  return (Array.isArray(layout?.mediaBoxes) ? layout.mediaBoxes : [])
    .filter((box) => isMeaningfulPhotoBox(box, minArea));
}

function isMeaningfulPhotoBox(box, minArea) {
  const source = String(box?.source || box?.backgroundImage || '').trim();
  const rect = box?.rect || {};
  const boxArea = finiteNumber(rect.width) * finiteNumber(rect.height);
  const firstViewportArea = finiteNumber(box?.firstViewportArea);

  return isPhotoMediaSource(source)
    && !isExcludedMediaSource(source)
    && (boxArea >= minArea || firstViewportArea >= minArea);
}

function isPhotoMediaSource(source) {
  return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(source)
    || /images\.unsplash\.com\/photo-/i.test(source)
    || /images\.pexels\.com\/photos\//i.test(source)
    || /source\.unsplash\.com/i.test(source)
    || /picsum\.photos/i.test(source);
}

function isExcludedMediaSource(source) {
  const pathname = (() => {
    try {
      return new URL(source).pathname;
    } catch (error) {
      return source;
    }
  })();
  const basename = decodeURIComponent(String(pathname).split('/').pop() || '');

  return /(?:logo|brand|icon|favicon|vector|avatar|sprite|badge|star|rating)/i.test(basename)
    || /(?:^|[-_])(?:abstract|bokeh|blob|decorative|dots|gradient|illustration|noise|ornament|pattern|shape|texture|textured)(?:[-_.]|$)/i.test(basename)
    || /(?:^|[-_])(?:client|partner|sponsor)[-_]?\d+(?:[-_.]|$)/i.test(basename);
}

function mediaBoxTop(box) {
  const rect = box?.rect || {};
  return finiteNumber(rect.top) || finiteNumber(rect.y);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function runLongMobileDiagnostic(report, options, startReport, referenceManifest) {
  if (options.fullPage) {
    report.longMobile = {
      needed: false,
      reason: 'full_page_capture_already_covers_below_fold',
      diagnosticOnly: true,
      stats: {},
    };
    persist(report);
    return report;
  }

  const diagnostic = longMobilePlan(referenceManifest);
  report.longMobile = diagnostic;
  persist(report);
  if (!diagnostic.needed) {
    return report;
  }

  const source = referenceCaptureSource(startReport, referenceManifest);
  if (!source.url) {
    report.longMobile = {
      ...diagnostic,
      ok: false,
      reason: 'reference_source_url_missing',
    };
    persist(report);
    return report;
  }

  const referenceRun = runNodeScript('capture-template-reference.js', longMobileReferenceCaptureArgs(options, startReport, referenceManifest));
  report.steps.longMobileReferenceCapture = stepSummary(referenceRun);
  report.longMobile.referenceCapture = {
    status: referenceRun.status,
    ok: fs.existsSync(longMobileReferenceManifestPath(options)),
  };
  persist(report);
  if (referenceRun.status !== 0 || !fs.existsSync(longMobileReferenceManifestPath(options))) {
    report.longMobile.ok = false;
    report.longMobile.blockers = collectStepBlockers('long-mobile-reference-capture', referenceRun);
    persist(report);
    return report;
  }

  const candidateRun = runNodeScript('capture-template-reference.js', longMobileCandidateCaptureArgs(options));
  report.steps.longMobileCandidateCapture = stepSummary(candidateRun);
  report.longMobile.candidateCapture = {
    status: candidateRun.status,
    ok: fs.existsSync(longMobileCandidateManifestPath(options)),
  };
  persist(report);
  if (candidateRun.status !== 0 || !fs.existsSync(longMobileCandidateManifestPath(options))) {
    report.longMobile.ok = false;
    report.longMobile.blockers = collectStepBlockers('long-mobile-candidate-capture', candidateRun);
    persist(report);
    return report;
  }

  const benchmarkRun = runNodeScript('run-visual-benchmark.js', longMobileBenchmarkArgs(options, startReport));
  report.steps.longMobileBenchmark = stepSummary(benchmarkRun);
  report.longMobile.ok = benchmarkRun.status === 0 && benchmarkRun.report?.ok !== false;
  if (benchmarkRun.report) {
    report.longMobile.benchmark = {
      ok: benchmarkRun.report.ok,
      blockers: benchmarkRun.report.blockers,
      files: benchmarkRun.report.files,
      comparison: benchmarkRun.report.comparison,
      renderedMedia: benchmarkRun.report.renderedMedia,
      mechanics: benchmarkRun.report.mechanics,
      templateVisualVerdict: benchmarkRun.report.templateVisualVerdict,
    };
    report.longMobile.visualReview = benchmarkRun.report.visualReview;
  } else {
    report.longMobile.blockers = collectStepBlockers('long-mobile-benchmark', benchmarkRun);
  }
  persist(report);

  return report;
}

function main() {
  let options;
  let report;

  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }

    if (!fs.existsSync(options.contract)) {
      throw new Error(`Contract file does not exist: ${options.contract}`);
    }
    if (options.candidateLayout && !fs.existsSync(options.candidateLayout)) {
      throw new Error(`Candidate layout file does not exist: ${options.candidateLayout}`);
    }

    fs.mkdirSync(candidateDir(options), { recursive: true });
    copyFile(options.contract, candidateContractPath(options));
    report = initialReport(options);
    persist(report);

    const startRun = runNodeScript('start-visual-benchmark.js', startArgs(options));
    report.steps.start = stepSummary(startRun);
    if (startRun.report) {
      report.start = {
        ok: startRun.report.ok,
        target: startRun.report.target,
        files: startRun.report.files,
      };
    }
    persist(report);
    if (startRun.status !== 0 || startRun.report?.ok === false || !startRun.report) {
      report = failAt(report, 'start_failed', 'start', startRun);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    const startReport = startRun.report;
    const referenceManifest = referenceManifestFor(startReport);
    const targetManifest = targetManifestFor(startReport, referenceManifest);
    report.referenceManifest = referenceManifest;
    report.targetManifest = targetManifest;

    const readinessRun = runNodeScript('audit-authoring-readiness.js', readinessArgs(options, referenceManifest));
    report.steps.readiness = stepSummary(readinessRun);
    persist(report);
    if (readinessRun.status !== 0 || readinessRun.report?.ok === false || !readinessRun.report) {
      report = failAt(report, 'readiness_failed', 'readiness', readinessRun);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    const draftRun = runNodeScript('draft-monteby-layout.js', draftArgs(options, startReport, referenceManifest));
    report.steps.draft = stepSummary(draftRun);
    if (draftRun.report) {
      report.draft = {
        ok: draftRun.report.ok,
        stats: draftRun.report.stats,
        audit: draftRun.report.audit,
        qualityErrors: draftRun.report.qualityErrors,
      };
    }
    persist(report);
    if (draftRun.status !== 0 || draftRun.report?.ok === false || !draftRun.report) {
      report = failAt(report, 'draft_failed', 'draft', draftRun);
      output(report, options);
      process.exitCode = 1;
      return;
    }
    if (!fs.existsSync(layoutPlanPath(options))) {
      report = finish(report, 'draft_failed', [{
        source: 'draft',
        code: 'layout_plan_missing',
        message: 'The drafter completed without the required versioned layout-plan artifact.',
      }]);
      output(report, options);
      process.exitCode = 1;
      return;
    }
    const planBlockers = validateLayoutPlan(layoutPlanPath(options));
    if (planBlockers.length > 0) {
      report = finish(report, 'draft_failed', planBlockers);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    if (options.candidateLayout) {
      const candidateAuditRun = runNodeScript(
        'audit-monteby-layout.js',
        auditCandidateArgs(options, startReport, referenceManifest)
      );
      report.steps.candidateAudit = stepSummary(candidateAuditRun);
      report.candidateAudit = candidateAuditRun.report;
      persist(report);
      if (candidateAuditRun.status !== 0 || candidateAuditRun.report?.ok === false || !candidateAuditRun.report) {
        report = failAt(report, 'candidate_audit_failed', 'candidate-audit', candidateAuditRun);
        output(report, options);
        process.exitCode = 1;
        return;
      }
      if (path.resolve(options.candidateLayout) !== path.resolve(layoutPath(options))) {
        copyFile(options.candidateLayout, layoutPath(options));
      }
    } else {
      copyFile(layoutDraftPath(options), layoutPath(options));
    }

    const candidateBinding = validateCandidatePlanBinding(
      layoutPlanPath(options),
      layoutPath(options)
    );
    const inputBindings = bindIterationInputFiles({
      sourceContract: report.files.sourceContract,
      contract: report.files.contract,
      referenceManifest: report.referenceManifest,
      targetManifest: report.targetManifest,
    });
    candidateBinding.blockers.push(...inputBindings.blockers);
    report.artifactBindings = {
      ...candidateBinding.evidence,
      ...inputBindings.evidence,
    };
    persist(report);
    if (candidateBinding.blockers.length > 0) {
      report = finish(report, 'candidate_audit_failed', candidateBinding.blockers);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    const renderRun = runNodeScript('render-monteby-preview.js', renderArgs(options));
    report.steps.render = stepSummary(renderRun);
    persist(report);
    if (renderRun.status !== 0) {
      report = failAt(report, 'render_failed', 'render', renderRun);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    const captureRun = runNodeScript('capture-template-reference.js', candidateCaptureArgs(options));
    report.steps.candidateCapture = stepSummary(captureRun);
    persist(report);
    if (captureRun.status !== 0 || !fs.existsSync(candidateManifestPath(options))) {
      report = failAt(report, 'candidate_capture_failed', 'candidate-capture', captureRun);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    const useCandidateManifest = true;
    report.useCandidateManifest = useCandidateManifest;

    const benchmarkRun = runNodeScript(
      'run-visual-benchmark.js',
      benchmarkArgs(options, startReport, referenceManifest, targetManifest, useCandidateManifest)
    );
    report.steps.benchmark = stepSummary(benchmarkRun);
    if (benchmarkRun.report) {
      report.benchmark = {
        ok: benchmarkRun.report.ok,
        blockers: benchmarkRun.report.blockers,
        files: benchmarkRun.report.files,
        visualReview: benchmarkRun.report.visualReview,
        comparison: benchmarkRun.report.comparison,
        genericGeometry: benchmarkRun.report.genericGeometry,
        templateVisualVerdict: benchmarkRun.report.templateVisualVerdict,
      };
    }
    report.visualBenchmarkPassed = benchmarkRun.status === 0 && benchmarkRun.report?.ok === true;

    report = runLongMobileDiagnostic(report, options, startReport, referenceManifest);

    const visualBudgetBlockers = options.allowStructuralVerdict
      ? []
      : collectVisualBudgetBlockers(benchmarkRun.report);
    if (visualBudgetBlockers.length > 0) {
      report = finish(report, 'visual_budget_failed', visualBudgetBlockers);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    if (benchmarkRun.status !== 0 || benchmarkRun.report?.ok === false || !benchmarkRun.report) {
      report = failAt(report, 'benchmark_failed', 'benchmark', benchmarkRun);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    report.visualDiagnosticPassed = true;
    report = finish(report, 'diagnostic_passed', []);
    output(report, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (report) {
      report = finish(report, 'failed', [{ source: 'iteration', code: 'iteration_error', message }]);
      output(report, options || { json: false });
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  }
}

function output(report, options) {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`visual_iteration=${report.files.iterationReport}`);
  console.log(`visual_iteration_status=${report.status}`);
  console.log(`visual_iteration_ok=${report.ok ? 'true' : 'false'}`);
  console.log(`visual_iteration_verification_level=${report.verificationLevel}`);
  console.log(`visual_iteration_visual_benchmark_passed=${report.visualBenchmarkPassed ? 'true' : 'false'}`);
  console.log(`visual_iteration_fidelity_passed=${report.fidelityPassed ? 'true' : 'false'}`);
  console.log(`visual_iteration_canonical_verification=${report.canonicalVerification ? 'true' : 'false'}`);
  console.log(`visual_iteration_next_action=${report.nextAction?.id || ''}`);
  if (report.blockers.length > 0) {
    console.log(`visual_iteration_blockers=${report.blockers.length}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  CANONICAL_VIEWPORTS,
  buildRepairQueue,
  initialReport,
  iterationArgsFor,
  nextActionFor,
  parseArgs,
  validateCandidatePlanBinding,
  validateLayoutPlan,
};
