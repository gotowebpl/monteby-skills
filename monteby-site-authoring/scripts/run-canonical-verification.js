#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { buildRepairQueue, nextActionFor, CANONICAL_VIEWPORTS } = require('./run-visual-iteration.js');

function requiredValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    iterationReport: '',
    previewReport: '',
    publicPageUrl: '',
    outDir: '',
    waitMs: '1500',
    playwrightPackage: 'playwright@1.54.1',
    channel: '',
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help' || option === '-h') {
      options.help = true;
    } else if (option === '--json') {
      options.json = true;
    } else if (option === '--iteration-report') {
      options.iterationReport = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--public-page-url') {
      options.publicPageUrl = requiredValue(argv, index += 1, option);
    } else if (option === '--preview-report') {
      options.previewReport = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--out-dir') {
      options.outDir = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--wait-ms') {
      options.waitMs = requiredValue(argv, index += 1, option);
    } else if (option === '--playwright-package') {
      options.playwrightPackage = requiredValue(argv, index += 1, option);
    } else if (option === '--channel') {
      options.channel = requiredValue(argv, index += 1, option);
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  if (!options.help) {
    if (!options.iterationReport) throw new Error('--iteration-report is required');
    if (!options.previewReport) throw new Error('--preview-report is required');
    if (!options.publicPageUrl) throw new Error('--public-page-url is required');
    if (!options.outDir) throw new Error('--out-dir is required');
    let parsed;
    try {
      parsed = new URL(options.publicPageUrl);
    } catch {
      throw new Error('--public-page-url must be an absolute HTTP(S) URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('--public-page-url must be an HTTP(S) URL without embedded credentials');
    }
  }

  return options;
}

function usage() {
  return `Usage:
  run-canonical-verification.js --iteration-report visual-iteration-report.json --preview-report preview-response.json --public-page-url URL --out-dir DIR [--channel chrome] [--wait-ms MS] [--playwright-package PACKAGE] [--json]

Captures the public WordPress/PHP result at desktop:1440x1200,
tablet:834x1112, and mobile:390x844, then runs the strict benchmark.
This is the only site-authoring script that may emit status DONE.`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
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
  if (!nodeMap) return '';
  return createHash('sha256').update(JSON.stringify(nodeMap)).digest('hex');
}

function scriptPath(name) {
  return path.join(__dirname, name);
}

function runScript(name, args) {
  const result = spawnSync(process.execPath, [scriptPath(name), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  let report = null;
  const stdout = String(result.stdout || '').trim();
  if (stdout) {
    try {
      report = JSON.parse(stdout);
    } catch {
      report = null;
    }
  }
  return {
    script: name,
    status: result.status === null ? 1 : result.status,
    stdout,
    stderr: String(result.stderr || '').trim(),
    report,
  };
}

function validateIteration(iteration) {
  const blockers = [];
  if (iteration?.schemaVersion !== 1 || iteration?.artifact !== 'monteby-visual-iteration') {
    blockers.push({
      code: 'iteration_schema_invalid',
      message: 'Input must be a schemaVersion 1 monteby-visual-iteration report.',
    });
  }
  if (iteration?.status !== 'diagnostic_passed' || iteration?.visualDiagnosticPassed !== true) {
    blockers.push({
      code: 'local_diagnostic_not_passed',
      message: 'Canonical verification requires a passing local visual diagnostic.',
    });
  }
  if (iteration?.canonicalViewportCoverage?.complete !== true) {
    blockers.push({
      code: 'canonical_viewport_coverage_incomplete',
      message: 'The local diagnostic must cover all three canonical full-page viewports.',
    });
  }
  for (const [key, file] of Object.entries({
    layout: iteration?.files?.layout,
    contract: iteration?.files?.contract,
    layoutPlan: iteration?.files?.layoutPlan,
    referenceManifest: iteration?.referenceManifest,
    targetManifest: iteration?.targetManifest,
  })) {
    if (typeof file !== 'string' || !file || !fs.existsSync(file)) {
      blockers.push({
        code: `missing_${key}`,
        message: `Required ${key} artifact is missing.`,
      });
    }
  }
  return blockers;
}

function validateCanonicalEvidence(options, iteration, previewReport) {
  const blockers = validateIteration(iteration);
  if (
    !isObject(previewReport)
    || previewReport.schemaVersion !== 1
    || previewReport.ok !== true
    || previewReport.stage !== 'preview'
    || previewReport.code !== 'PREVIEW_OK'
    || !isObject(previewReport.scope)
    || !isObject(previewReport.evidence)
    || !/^[a-f0-9]{64}$/.test(previewReport.layoutSha256 || '')
  ) {
    blockers.push({
      code: 'preview_evidence_invalid',
      message: 'Canonical verification requires a persisted scoped PREVIEW_OK report.',
    });
    return blockers;
  }

  const saveReportFile = previewReport.evidence.saveReport;
  if (
    typeof saveReportFile !== 'string'
    || !saveReportFile
    || !fs.existsSync(saveReportFile)
  ) {
    blockers.push({
      code: 'save_evidence_missing',
      message: 'The PREVIEW_OK report must point to its persisted SAVE_OK report.',
    });
    return blockers;
  }

  let saveReport;
  try {
    saveReport = readJson(saveReportFile);
  } catch {
    blockers.push({
      code: 'save_evidence_invalid_json',
      message: 'The persisted save report is not valid JSON.',
    });
    return blockers;
  }
  if (
    saveReport.schemaVersion !== 1
    || saveReport.ok !== true
    || saveReport.stage !== 'save'
    || saveReport.code !== 'SAVE_OK'
    || !isObject(saveReport.scope)
    || !/^[a-f0-9]{64}$/.test(saveReport.layoutSha256 || '')
  ) {
    blockers.push({
      code: 'save_evidence_invalid',
      message: 'The referenced report does not contain scoped SAVE_OK evidence.',
    });
    return blockers;
  }

  const scopesMatch = saveReport.scope.site === previewReport.scope.site
    && saveReport.scope.pageId === previewReport.scope.pageId
    && previewReport.evidence.site === saveReport.scope.site
    && previewReport.evidence.pageId === saveReport.scope.pageId;
  if (!scopesMatch) {
    blockers.push({
      code: 'canonical_scope_mismatch',
      message: 'SAVE_OK and PREVIEW_OK evidence do not belong to the same site/page.',
    });
  }

  const digestsMatch = saveReport.layoutSha256 === previewReport.layoutSha256
    && previewReport.evidence.layoutSha256 === saveReport.layoutSha256;
  if (!digestsMatch) {
    blockers.push({
      code: 'canonical_digest_chain_mismatch',
      message: 'SAVE_OK and PREVIEW_OK evidence do not bind the same node-map digest.',
    });
  }

  let currentLayoutSha256 = '';
  try {
    currentLayoutSha256 = nodeMapSha256(readJson(iteration.files.layout));
  } catch {
    currentLayoutSha256 = '';
  }
  if (!currentLayoutSha256 || currentLayoutSha256 !== saveReport.layoutSha256) {
    blockers.push({
      code: 'canonical_layout_changed_after_save',
      message: 'The local candidate no longer matches the node map proven by SAVE_OK/PREVIEW_OK.',
    });
  }

  const normalizedIterationLayout = path.resolve(iteration.files.layout);
  for (const evidenceLayout of [
    saveReport.artifacts?.layout,
    previewReport.artifacts?.layout,
  ]) {
    if (typeof evidenceLayout !== 'string' || path.resolve(evidenceLayout) !== normalizedIterationLayout) {
      blockers.push({
        code: 'canonical_layout_path_mismatch',
        message: 'Canonical evidence points to a different layout artifact than the passing iteration.',
      });
      break;
    }
  }

  let publicOrigin = '';
  let savedOrigin = '';
  try {
    publicOrigin = new URL(options.publicPageUrl).origin;
    savedOrigin = new URL(saveReport.scope.site).origin;
  } catch {
    publicOrigin = '';
    savedOrigin = '';
  }
  if (!publicOrigin || publicOrigin !== savedOrigin) {
    blockers.push({
      code: 'public_page_origin_mismatch',
      message: 'The canonical public page URL must use the same origin as the saved WordPress site.',
    });
  }

  let referenceUrl = '';
  try {
    referenceUrl = String(readJson(iteration.referenceManifest)?.sourceUrl || '');
  } catch {
    referenceUrl = '';
  }
  if (
    /^https?:\/\//i.test(referenceUrl)
    && normalizeComparableUrl(referenceUrl) === normalizeComparableUrl(options.publicPageUrl)
  ) {
    blockers.push({
      code: 'public_page_matches_reference',
      message: 'The public candidate URL cannot be the remote reference URL.',
    });
  }

  return blockers;
}

function normalizeComparableUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function captureArgs(options) {
  return [
    '--url', options.publicPageUrl,
    '--out-dir', path.join(options.outDir, 'capture'),
    '--name', 'canonical-candidate',
    '--wait-ms', options.waitMs,
    '--playwright-package', options.playwrightPackage,
    '--capture-layout',
    '--require-layout',
    '--full-page',
    ...(options.channel ? ['--channel', options.channel] : []),
    ...CANONICAL_VIEWPORTS.flatMap((viewport) => ['--viewport', viewport]),
  ];
}

function benchmarkArgs(options, iteration, startReport) {
  const args = [
    '--label', `${iteration.label || 'monteby'}-canonical`,
    '--layout', iteration.files.layout,
    '--contract', iteration.files.contract,
    '--reference-manifest', iteration.referenceManifest,
    '--target-manifest', iteration.targetManifest,
    '--candidate-manifest', path.join(options.outDir, 'capture', 'reference-manifest.json'),
    '--diff-dir', path.join(options.outDir, 'diffs'),
    '--out', path.join(options.outDir, 'benchmark-report.json'),
    '--markdown', path.join(options.outDir, 'BENCHMARK.md'),
    '--max-percent', String(iteration.options?.maxPercent ?? '0'),
    '--max-viewport-percent', String(iteration.options?.maxViewportPercent ?? '0'),
    '--pad-to-largest',
    '--json',
  ];

  let referenceSource = '';
  try {
    referenceSource = String(readJson(iteration.referenceManifest)?.sourceUrl || '');
  } catch {
    referenceSource = '';
  }
  if (/^https?:\/\//i.test(referenceSource)) {
    args.push('--require-real-reference');
  }
  if (
    startReport?.options?.requireMarketplace === true
    || startReport?.options?.marketplaceReference === true
    || Boolean(startReport?.options?.archetype)
  ) {
    args.push('--require-marketplace-media');
  }
  if (iteration.options?.renderedMinCoverageRatio) {
    args.push('--rendered-min-coverage-ratio', String(iteration.options.renderedMinCoverageRatio));
  }
  return args;
}

function nextAction(id, tool, args, requires, instruction) {
  return { id, tool, args, requires, instruction };
}

function baseReport(options) {
  return {
    schemaVersion: 1,
    artifact: 'monteby-canonical-verification',
    generatedAt: new Date().toISOString(),
    ok: false,
    status: 'RUNNING',
    fidelityPassed: false,
    canonicalVerification: false,
    productReady: false,
    files: {
      iterationReport: options.iterationReport,
      previewReport: options.previewReport,
      outDir: options.outDir,
      candidateManifest: path.join(options.outDir, 'capture', 'reference-manifest.json'),
      benchmarkReport: path.join(options.outDir, 'benchmark-report.json'),
      benchmarkMarkdown: path.join(options.outDir, 'BENCHMARK.md'),
      report: path.join(options.outDir, 'canonical-verification-report.json'),
    },
    steps: {},
    blockers: [],
    repairQueue: [],
    nextAction: nextAction('wait_for_step', '', [], [], 'Canonical verification is running.'),
  };
}

function retryAction(options) {
  return nextAction(
    'retry_canonical_verification',
    path.resolve(__filename),
    [
      '--iteration-report', options.iterationReport,
      '--preview-report', options.previewReport,
      '--public-page-url', options.publicPageUrl,
      '--out-dir', options.outDir,
      '--wait-ms', options.waitMs,
      '--playwright-package', options.playwrightPackage,
      ...(options.channel ? ['--channel', options.channel] : []),
      '--json',
    ],
    [],
    'Resolve the explicit blocker, then run this exact canonical verification command.'
  );
}

function persist(report) {
  writeJson(report.files.report, report);
}

function output(report, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`canonical_verification=${report.files.report}\n`);
    process.stdout.write(`canonical_verification_status=${report.status}\n`);
    process.stdout.write(`canonical_verification_ok=${report.ok ? 'true' : 'false'}\n`);
    process.stdout.write(`canonical_verification_next_action=${report.nextAction.id}\n`);
  }
}

function main() {
  let options;
  let report;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }

    report = baseReport(options);
    fs.mkdirSync(options.outDir, { recursive: true });
    const iteration = readJson(options.iterationReport);
    const previewReport = readJson(options.previewReport);
    const inputBlockers = validateCanonicalEvidence(options, iteration, previewReport);
    if (inputBlockers.length > 0) {
      report.status = 'INPUT_BLOCKED';
      report.blockers = inputBlockers;
      report.nextAction = nextAction(
        'restore_canonical_evidence_chain',
        scriptPath('wordpress-layout-client.js'),
        [],
        ['PASSING_LOCAL_REPORT', 'SCOPED_SAVE_OK_REPORT', 'SCOPED_PREVIEW_OK_REPORT'],
        'Recreate the exact validate → save → preview evidence chain before canonical verification.'
      );
      persist(report);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    const capture = runScript('capture-template-reference.js', captureArgs(options));
    report.steps.capture = {
      status: capture.status,
      stderr: capture.stderr,
    };
    if (capture.status !== 0 || !fs.existsSync(report.files.candidateManifest)) {
      report.status = 'CANONICAL_CAPTURE_FAILED';
      report.blockers = [{
        code: 'canonical_capture_failed',
        message: capture.stderr || 'Canonical public-page capture did not produce a manifest.',
      }];
      report.nextAction = retryAction(options);
      persist(report);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    let startReport = null;
    if (iteration.files?.startReport && fs.existsSync(iteration.files.startReport)) {
      startReport = readJson(iteration.files.startReport);
    }
    const benchmark = runScript(
      'run-visual-benchmark.js',
      benchmarkArgs(options, iteration, startReport)
    );
    report.steps.benchmark = {
      status: benchmark.status,
      ok: benchmark.report?.ok,
      stderr: benchmark.stderr,
    };
    report.benchmark = benchmark.report;

    const visualBudgetFailed = benchmark.report?.comparison?.ok === false;
    if (benchmark.status !== 0 || benchmark.report?.ok !== true || visualBudgetFailed) {
      report.status = 'CANONICAL_COMPARE_FAILED';
      const benchmarkBlockers = Array.isArray(benchmark.report?.blockers)
        ? benchmark.report.blockers
        : [];
      const budgetBlockers = visualBudgetFailed
        ? (Array.isArray(benchmark.report?.comparison?.budgetErrors)
          && benchmark.report.comparison.budgetErrors.length > 0
          ? benchmark.report.comparison.budgetErrors.map((blocker) => ({
            ...blocker,
            source: blocker.source || 'visual-diff',
          }))
          : [{
            source: 'visual-diff',
            code: 'canonical_visual_budget_failed',
            message: 'Canonical screenshot comparison exceeded the configured budget.',
          }])
        : [];
      report.blockers = benchmarkBlockers.concat(budgetBlockers).length > 0
        ? benchmarkBlockers.concat(budgetBlockers)
        : [{
          code: 'canonical_benchmark_failed',
          message: benchmark.stderr || 'Canonical benchmark did not pass.',
        }];
      report.repairQueue = buildRepairQueue({
        status: 'benchmark_failed',
        files: iteration.files,
        blockers: report.blockers,
        benchmark: {
          genericGeometry: benchmark.report?.genericGeometry,
        },
      });
      report.nextAction = nextActionFor({
        ...iteration,
        status: 'benchmark_failed',
        blockers: report.blockers,
        benchmark: {
          genericGeometry: benchmark.report?.genericGeometry,
        },
      });
      persist(report);
      output(report, options);
      process.exitCode = 1;
      return;
    }

    report.ok = true;
    report.status = 'DONE';
    report.fidelityPassed = true;
    report.canonicalVerification = true;
    report.productReady = true;
    report.evidence = {
      site: previewReport.scope.site,
      pageId: previewReport.scope.pageId,
      layoutSha256: previewReport.layoutSha256,
      saveReport: previewReport.evidence.saveReport,
      previewReport: options.previewReport,
      publicPageUrl: options.publicPageUrl,
    };
    report.nextAction = nextAction(
      'complete',
      '',
      [],
      [],
      'Canonical WordPress/PHP output passed the strict three-viewport benchmark. No action remains.'
    );
    persist(report);
    output(report, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!report && options?.outDir) {
      report = baseReport(options);
    }
    if (report) {
      report.status = 'ERROR';
      report.blockers = [{ code: 'canonical_verification_error', message }];
      report.nextAction = retryAction(options);
      persist(report);
      output(report, options);
    } else {
      process.stderr.write(`${message}\n`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  benchmarkArgs,
  captureArgs,
  parseArgs,
  validateCanonicalEvidence,
  validateIteration,
};
