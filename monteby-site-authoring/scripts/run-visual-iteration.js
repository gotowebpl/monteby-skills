#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { fileURLToPath, pathToFileURL } = require('url');

const LONG_MOBILE_VIEWPORT = 'mobile-long:390x1800';
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
  run-visual-iteration.js --contract contract.json [--seed value] [--variant auto|split-hero|editorial-ledger|bento-showcase|tabbed-program|marketplace-service] [--archetype name] [--reference-url url | --reference-html-file file] [--preserve-source-text] [--out-dir dir] [--viewport label:WIDTHxHEIGHT] [--full-page | --viewport-only] [--viewport-timeout-ms milliseconds] [--channel chrome] [--max-percent value] [--max-viewport-percent value] [--allow-structural-verdict] [--json]

Options:
  --reference-html-file <file>  Use a local HTML document as the measured reference without requiring a remote URL.
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
  3. draft-monteby-layout.js creates a clean Monteby draft
  4. render-monteby-preview.js renders a diagnostic local preview
  5. capture-template-reference.js captures the preview
  6. run-visual-benchmark.js reports blockers

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
  return {
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
    canonicalEvidence: {
      renderer: 'render-monteby-preview.js',
      staticHtmlPreview: true,
      wordpressRestValidated: false,
      wordpressRestSaved: false,
      wordpressPhpPreviewed: false,
    },
    files: {
      outDir: options.outDir,
      sourceContract: options.contract,
      contract: candidateContractPath(options),
      startReport: startReportPath(options),
      layoutDraft: layoutDraftPath(options),
      layout: layoutPath(options),
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
      maxPercent: options.maxPercent,
      maxViewportPercent: options.maxViewportPercent,
      allowStructuralVerdict: options.allowStructuralVerdict,
      preserveSourceText: options.preserveSourceText,
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
    `- Label: ${report.label}`,
    `- Target manifest: \`${report.targetManifest || ''}\``,
    `- Reference manifest: \`${report.referenceManifest || ''}\``,
    `- Layout: \`${report.files.layout}\``,
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

  fs.writeFileSync(iterationMarkdownPath({ outDir: report.files.outDir }), `${lines.join('\n')}\n`);
}

function persist(report) {
  writeJson(report.files.iterationReport, report);
  writeIterationMarkdown(report);
}

function finish(report, status, blockers = []) {
  report.status = status;
  report.blockers = blockers;
  report.ok = status === 'diagnostic_passed';
  report.diagnosticOnly = true;
  report.fidelityPassed = false;
  report.canonicalVerification = false;
  report.productReady = false;
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

    copyFile(layoutDraftPath(options), layoutPath(options));

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
  if (report.blockers.length > 0) {
    console.log(`visual_iteration_blockers=${report.blockers.length}`);
  }
}

main();
