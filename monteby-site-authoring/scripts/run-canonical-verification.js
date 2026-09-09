#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { canonicalSha256 } = require('./wordpress-layout-client');
const { renderDocument } = require('./render-monteby-preview');
const { appliedPropExpectations, publicPropVerification } = require('./verify-public-props');
const {
  buildRepairQueue,
  nextActionFor,
  validateLayoutPlan,
  CANONICAL_VIEWPORTS,
} = require('./run-visual-iteration.js');
const {
  buildSubpixelResidual,
  evaluateSubpixelFixedPoint,
  validateSubpixelAuthorization,
} = require('./subpixel-residual');

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
    subpixelAuthorization: '',
    json: false,
    help: false,
    verifyProps: false,
    authHeaderEnv: 'MONTEBY_AUTH_HEADER',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help' || option === '-h') {
      options.help = true;
    } else if (option === '--json') {
      options.json = true;
    } else if (option === '--verify-props') {
      options.verifyProps = true;
    } else if (['--operations', '--patch-report', '--apply-report', '--before-snapshot', '--saved-snapshot', '--contract', '--wordpress-wrapper'].includes(option)) {
      const key = option.slice(2).replace(/-([a-z])/gu, (_, character) => character.toUpperCase());
      options[key] = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--auth-header-env') {
      options.authHeaderEnv = requiredValue(argv, index += 1, option);
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
    } else if (option === '--subpixel-authorization') {
      options.subpixelAuthorization = path.resolve(requiredValue(argv, index += 1, option));
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  if (!options.help) {
    if (options.verifyProps) {
      for (const key of ['operations', 'patchReport', 'applyReport', 'beforeSnapshot', 'savedSnapshot', 'contract']) {
        if (!options[key]) throw new Error(`${key} is required for --verify-props`);
      }
      if (options.iterationReport || options.previewReport || options.subpixelAuthorization) throw new Error('Prop verification cannot be combined with visual-fidelity inputs');
      if (!/^[A-Z_][A-Z0-9_]*$/u.test(options.authHeaderEnv)) throw new Error('Invalid auth environment variable name');
    } else {
      if (options.operations || options.patchReport || options.applyReport || options.beforeSnapshot || options.savedSnapshot || options.contract || options.wordpressWrapper) throw new Error('Prop evidence options require --verify-props');
      if (!options.iterationReport) throw new Error('--iteration-report is required');
      if (!options.previewReport) throw new Error('--preview-report is required');
    }
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
  run-canonical-verification.js --iteration-report visual-iteration-report.json --preview-report preview-response.json --public-page-url URL --out-dir DIR [--subpixel-authorization FILE] [--channel chrome] [--wait-ms MS] [--playwright-package PACKAGE] [--json]
  run-canonical-verification.js --verify-props --operations FILE --patch-report FILE --apply-report FILE --before-snapshot FILE --saved-snapshot FILE --contract FILE --public-page-url URL --out-dir DIR [--wordpress-wrapper FILE] [--auth-header-env NAME] [--json]

Captures the public WordPress/PHP result at desktop:1440x1200,
tablet:834x1112, and mobile:390x844, then runs the strict benchmark.
This is the only site-authoring script that may emit status DONE.`;
}

function verifyAppliedProps(options, report) {
  report.mode = 'verify-props';
  report.nextAction = nextAction('blocked_public_prop_evidence', '', [], [], 'Review the explicit applied-prop evidence blockers; never reapply automatically.');
  const inputs = Object.fromEntries(['operations', 'patchReport', 'applyReport', 'beforeSnapshot', 'savedSnapshot', 'contract'].map((key) => [key, readJson(options[key])]));
  const inputHashes = Object.fromEntries(Object.keys(inputs).map((key) => [key, fileSha256(options[key])]));
  const prepared = appliedPropExpectations({ operations: inputs.operations, preflight: inputs.patchReport, applied: inputs.applyReport,
    before: inputs.beforeSnapshot, saved: inputs.savedSnapshot, contract: inputs.contract, publicPageUrl: options.publicPageUrl });
  report.effects = prepared.effects;
  report.bindings = prepared.bindings;
  report.bindings.inputFiles = inputHashes;
  report.bindings.inputFileDigestFormat = 'sha256:file-bytes';
  report.blockers = prepared.blockers;
  report.status = 'PUBLIC_PROPS_BLOCKED';
  if (report.blockers.length) return;
  const directory = fs.mkdtempSync(path.join(options.outDir, 'public-props-'));
  const snapshot = (label) => {
    const outDir = path.join(directory, label);
    const args = ['snapshot', '--site', prepared.bindings.site, '--page-id', String(prepared.bindings.pageId), '--out-dir', outDir,
      '--out', path.join(outDir, 'snapshot-report.json'), '--auth-header-env', options.authHeaderEnv];
    const result = options.wordpressWrapper
      ? spawnSync(process.execPath, [options.wordpressWrapper, 'skill', scriptPath('wordpress-layout-client.js'), ...args], { encoding: 'utf8' })
      : spawnSync(process.execPath, [scriptPath('wordpress-layout-client.js'), ...args], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`public_props_${label}_snapshot_failed`);
    const snapshotReport = readJson(path.join(outDir, 'snapshot-report.json'));
    if (snapshotReport?.ok !== true || snapshotReport.code !== 'SNAPSHOT_OK'
      || snapshotReport.scope?.site !== prepared.bindings.site || snapshotReport.scope?.pageId !== prepared.bindings.pageId) throw new Error(`public_props_${label}_snapshot_report_invalid`);
    const artifact = readJson(path.join(outDir, 'layout-before.json'));
    const freshContract = readJson(path.join(outDir, 'contract.json'));
    if (artifact?.artifact !== 'monteby-page-snapshot' || artifact.site !== prepared.bindings.site
      || artifact.pageId !== prepared.bindings.pageId || artifact.publicPageUrl !== options.publicPageUrl
      || artifact.data?.id !== prepared.bindings.pageId || artifact.data?.builderJson !== inputs.savedSnapshot.data.builderJson
      || artifact.data?.postModifiedGmt !== inputs.savedSnapshot.data.postModifiedGmt
      || !Number.isFinite(Date.parse(artifact.capturedAt))
      || Date.parse(artifact.capturedAt) < Date.parse(inputs.savedSnapshot.capturedAt)
      || canonicalSha256(freshContract) !== prepared.bindings.contractSha256) throw new Error(`public_props_${label}_state_changed`);
    report.bindings[`${label}SnapshotSha256`] = canonicalSha256(artifact);
    report.files[`${label}Snapshot`] = path.join(outDir, 'layout-before.json');
  };
  snapshot('beforeCapture');
  const rendered = renderDocument(prepared.nodeMap, 'Applied public prop verification', inputs.contract);
  if (rendered.diagnostics.length) throw new Error('public_props_diagnostic_unresolved');
  const htmlFile = path.join(directory, 'diagnostic.html');
  fs.writeFileSync(htmlFile, rendered.html);
  writeJson(path.join(directory, 'saved-layout.json'), prepared.nodeMap);
  writeJson(path.join(directory, 'expectations.json'), prepared);
  report.files.expectations = path.join(directory, 'expectations.json');
  report.files.savedLayout = path.join(directory, 'saved-layout.json');
  const captures = [];
  for (const kind of ['diagnostic', 'public']) {
    const outDir = path.join(directory, kind);
    const args = [...(kind === 'public' ? ['--url', options.publicPageUrl] : ['--html-file', htmlFile]), '--out-dir', outDir,
      '--name', kind, '--wait-ms', options.waitMs, '--playwright-package', options.playwrightPackage,
      '--capture-layout', '--require-layout', '--full-page', ...(options.channel ? ['--channel', options.channel] : []),
      ...[...CANONICAL_VIEWPORTS, 'stress:375x844'].flatMap((viewport) => ['--viewport', viewport])];
    const capture = runScript('capture-template-reference.js', args);
    if (capture.status !== 0) throw new Error(`public_props_${kind}_capture_failed`);
    const manifestFile = path.join(outDir, 'reference-manifest.json');
    const manifest = readJson(manifestFile);
    if (kind === 'public' && manifest.sourceUrl !== options.publicPageUrl) throw new Error('public_props_capture_url_mismatch');
    if (manifest.evidenceCompleteness?.complete !== true) throw new Error(`public_props_${kind}_capture_truncated`);
    const layouts = ['reference-layout.json', 'reference-layout-tablet.json', 'reference-layout-mobile.json', 'reference-layout-stress.json']
      .map((file) => {
        const fullPath = path.join(outDir, file);
        report.bindings[`${kind}:${file}`] = fileSha256(fullPath);
        return readJson(fullPath);
      });
    for (const [index, width] of [1440, 834, 390, 375].entries()) {
      const layout = layouts[index];
      if (kind === 'public' && layout?.url !== options.publicPageUrl) throw new Error('public_props_rendered_url_mismatch');
      if (layout?.viewport?.width !== width || !Number.isFinite(layout.viewport.scrollWidth)
        || !Number.isFinite(layout.viewport.scrollHeight) || layout.viewport.scrollHeight <= 0
        || layout.viewport.scrollWidth < width || layout.viewport.scrollWidth > width + 1
        || layout.evidenceCompleteness?.complete !== true
        || !Array.isArray(layout.textBoxes) || layout.textBoxes.length === 0) throw new Error(`public_props_${kind}_capture_incomplete_or_overflowing`);
    }
    report.files[`${kind}Manifest`] = manifestFile;
    report.bindings[`${kind}ManifestSha256`] = fileSha256(manifestFile);
    captures.push(layouts);
  }
  snapshot('afterCapture');
  for (const key of Object.keys(inputs)) {
    if (fileSha256(options[key]) !== inputHashes[key]) throw new Error('public_props_input_changed_during_capture');
  }
  report.verification = publicPropVerification(prepared, ...captures);
  report.ok = report.verification.complete;
  report.status = report.ok ? 'PUBLIC_PROPS_VERIFIED' : 'PUBLIC_PROPS_FAILED';
  report.blockers = report.ok ? [] : [{ code: 'public_prop_mismatch_or_overflow' }];
  report.nextAction = nextAction(report.ok ? 'public_props_complete' : 'review_public_prop_failure', '', [], [],
    'This verifies applied observable props only; it is not a fidelity, 1:1 or product-readiness verdict.');
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

function fileSha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function capturedPageSha256(manifestFile) {
  const manifest = readJson(manifestFile);
  const screenshots = Array.isArray(manifest?.screenshots) ? manifest.screenshots : [];
  const digest = createHash('sha256');
  let hashed = 0;
  for (const screenshot of screenshots) {
    const screenshotFile = path.resolve(path.dirname(manifestFile), String(screenshot?.file || ''));
    if (!fs.existsSync(screenshotFile)) continue;
    digest.update(String(screenshot?.label || ''));
    digest.update('\0');
    digest.update(fs.readFileSync(screenshotFile));
    hashed += 1;
  }
  return hashed > 0 ? digest.digest('hex') : fileSha256(manifestFile);
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
  if (
    Number(iteration?.options?.maxPercent) !== 0
    || Number(iteration?.options?.maxViewportPercent) !== 0
  ) {
    blockers.push({
      code: 'canonical_visual_budget_not_zero',
      message: 'Canonical verification requires zero aggregate and per-viewport screenshot-difference budgets.',
    });
  }
  for (const [key, file] of Object.entries({
    layout: iteration?.files?.layout,
    sourceContract: iteration?.files?.sourceContract,
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
  const bindings = iteration?.artifactBindings;
  if (!isObject(bindings)) {
    blockers.push({
      code: 'iteration_artifact_bindings_missing',
      message: 'The passing diagnostic must persist immutable hashes for every canonical input artifact.',
    });
  } else {
    const mismatches = [];
    const recordMismatch = (name) => {
      if (!mismatches.includes(name)) mismatches.push(name);
    };
    if (
      bindings.layoutPlanDigestFormat !== 'sha256:file-bytes'
      || bindings.candidateLayoutDigestFormat !== 'sha256:json-stringify-node-map'
      || bindings.inputFileDigestFormat !== 'sha256:file-bytes'
      || bindings.rootOrderMatches !== true
      || bindings.surfaceMappingsResolve !== true
    ) {
      recordMismatch('binding-metadata');
    }
    for (const [name, expected, file, digest] of [
      ['layoutPlan', bindings.layoutPlanSha256, iteration?.files?.layoutPlan, fileSha256],
      ['sourceContract', bindings.sourceContractSha256, iteration?.files?.sourceContract, fileSha256],
      ['contract', bindings.contractSha256, iteration?.files?.contract, fileSha256],
      ['referenceManifest', bindings.referenceManifestSha256, iteration?.referenceManifest, fileSha256],
      ['targetManifest', bindings.targetManifestSha256, iteration?.targetManifest, fileSha256],
    ]) {
      if (!/^[a-f0-9]{64}$/.test(String(expected || ''))) {
        recordMismatch(name);
        continue;
      }
      try {
        if (!file || digest(file) !== expected) {
          recordMismatch(name);
        }
      } catch {
        recordMismatch(name);
      }
    }
    if (!/^[a-f0-9]{64}$/.test(String(bindings.candidateLayoutSha256 || ''))) {
      recordMismatch('candidateLayout');
    } else {
      try {
        if (
          nodeMapSha256(readJson(iteration?.files?.layout))
          !== bindings.candidateLayoutSha256
        ) {
          recordMismatch('candidateLayout');
        }
      } catch {
        recordMismatch('candidateLayout');
      }
    }
    try {
      const plan = readJson(iteration?.files?.layoutPlan);
      if (
        !/^[a-f0-9]{64}$/.test(String(bindings.plannedSourceLayoutSha256 || ''))
        || plan.sourceLayoutSha256 !== bindings.plannedSourceLayoutSha256
      ) {
        recordMismatch('plannedSourceLayout');
      }
    } catch {
      recordMismatch('plannedSourceLayout');
    }
    if (mismatches.length > 0) {
      blockers.push({
        code: 'iteration_artifact_binding_mismatch',
        message: `Artifacts changed after diagnostic_passed or lack exact bindings: ${mismatches.join(', ')}.`,
      });
    }
  }
  const layoutPlanFile = iteration?.files?.layoutPlan;
  if (typeof layoutPlanFile === 'string' && layoutPlanFile && fs.existsSync(layoutPlanFile)) {
    for (const blocker of validateLayoutPlan(layoutPlanFile)) {
      blockers.push({
        code: blocker.code,
        message: blocker.message,
      });
    }
    if (iteration?.options?.preserveSourceText === true) {
      try {
        const contentLedger = readJson(layoutPlanFile)?.contentLedger;
        if (contentLedger?.complete !== true) {
          blockers.push({
            code: 'content_ledger_incomplete',
            message: 'Canonical verification requires a complete node-map content ledger when preserveSourceText is enabled.',
          });
        }
      } catch {
        blockers.push({
          code: 'content_ledger_incomplete',
          message: 'Canonical verification could not read the required content ledger.',
        });
      }
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

  const savedPublicPageUrl = normalizeComparableUrl(saveReport.evidence?.publicPageUrl);
  const previewPublicPageUrl = normalizeComparableUrl(previewReport.evidence?.publicPageUrl);
  const requestedPublicPageUrl = normalizeComparableUrl(options.publicPageUrl);
  if (
    !savedPublicPageUrl
    || savedPublicPageUrl !== previewPublicPageUrl
    || savedPublicPageUrl !== requestedPublicPageUrl
  ) {
    blockers.push({
      code: 'public_page_scope_mismatch',
      message: 'SAVE_OK, PREVIEW_OK, and canonical capture must bind the exact public URL resolved for this WordPress page ID.',
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
    '--max-percent', '0',
    '--max-viewport-percent', '0',
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

function canonicalZeroDiffBlockers(benchmarkReport) {
  const comparison = benchmarkReport?.comparison;
  const expectedLabels = CANONICAL_VIEWPORTS.map((viewport) => viewport.split(':')[0]);
  const results = Array.isArray(comparison?.results) ? comparison.results : [];
  const labels = results.map((result) => String(result?.label || ''));
  const aggregateExact = comparison?.ok === true
    && Number(comparison?.mismatched) === 0
    && Number(comparison?.percent) === 0
    && Number(comparison?.maxPercent) === 0
    && Number(comparison?.total) > 0;
  const viewportsExact = results.length === expectedLabels.length
    && expectedLabels.every((label, index) => labels[index] === label)
    && results.every((result) => (
      Number(result?.mismatched) === 0
      && Number(result?.percent) === 0
      && Number(result?.total) > 0
    ));
  if (aggregateExact && viewportsExact) {
    return [];
  }
  return [{
    source: 'visual-diff',
    code: 'canonical_zero_diff_evidence_missing',
    message: 'Canonical DONE requires an exact zero-difference aggregate and one non-empty zero-difference result for desktop, tablet, and mobile in canonical order.',
    expectedLabels,
    actualLabels: labels,
    aggregate: {
      mismatched: comparison?.mismatched,
      total: comparison?.total,
      percent: comparison?.percent,
      maxPercent: comparison?.maxPercent,
    },
  }];
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
      subpixelResidual: path.join(options.outDir, 'subpixel-residual.json'),
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
      ...(options.subpixelAuthorization
        ? ['--subpixel-authorization', options.subpixelAuthorization]
        : []),
      '--json',
    ],
    ['CANONICAL_FAILURE_RESOLVED'],
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
    if (options.verifyProps) {
      verifyAppliedProps(options, report);
      persist(report);
      output(report, options);
      process.exitCode = report.ok ? 0 : 1;
      return;
    }
    const iteration = readJson(options.iterationReport);
    const previewReport = readJson(options.previewReport);
    const inputBlockers = validateCanonicalEvidence(options, iteration, previewReport);
    if (inputBlockers.length > 0) {
      report.status = 'INPUT_BLOCKED';
      report.blockers = inputBlockers;
      report.nextAction = nextAction(
        'blocked_canonical_evidence',
        '',
        [],
        ['PASSING_LOCAL_REPORT', 'SCOPED_SAVE_OK_REPORT', 'SCOPED_PREVIEW_OK_REPORT'],
        'Stop. Recreate the exact local-pass → validate → save → preview evidence chain, then start a new canonical verification run from its emitted action.'
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

    const zeroDiffBlockers = canonicalZeroDiffBlockers(benchmark.report);
    const visualBudgetFailed = zeroDiffBlockers.length > 0;
    let authorizedResidual = null;
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
          : zeroDiffBlockers)
        : [];
      report.blockers = benchmarkBlockers.concat(budgetBlockers).length > 0
        ? benchmarkBlockers.concat(budgetBlockers)
        : [{
          code: 'canonical_benchmark_failed',
          message: benchmark.stderr || 'Canonical benchmark did not pass.',
        }];
      const residualEvaluation = evaluateSubpixelFixedPoint(
        iteration.benchmark,
        benchmark.report,
        report.blockers
      );
      if (residualEvaluation.eligible) {
        const residual = buildSubpixelResidual(residualEvaluation, {
          pageSha256: capturedPageSha256(report.files.candidateManifest),
          layoutSha256: nodeMapSha256(readJson(iteration.files.layout)),
          manifestSha256: fileSha256(iteration.referenceManifest),
          iterationSha256: fileSha256(options.iterationReport),
        });
        writeJson(report.files.subpixelResidual, residual);
        const authorization = options.subpixelAuthorization && fs.existsSync(options.subpixelAuthorization)
          ? readJson(options.subpixelAuthorization)
          : null;
        const authorizationResult = validateSubpixelAuthorization(authorization, residual);
        if (authorizationResult.ok) {
          authorizedResidual = {
            residual,
            authorization: {
              file: options.subpixelAuthorization,
              authorizedBy: authorizationResult.authorizedBy,
              authorizedAt: authorizationResult.authorizedAt,
            },
          };
        } else {
          report.status = options.subpixelAuthorization
            ? 'SUBPIXEL_AUTHORIZATION_INVALID'
            : 'CANONICAL_RESIDUAL_AUTHORIZATION_REQUIRED';
          report.blockers = [{
            code: options.subpixelAuthorization
              ? authorizationResult.code
              : 'blocked_subpixel_authorization_required',
            message: options.subpixelAuthorization
              ? 'The supplied subpixel authorization does not bind the exact current residual evidence.'
              : 'The stable subpixel residual is within policy, but an explicit person/date/hash-bound authorization is required.',
          }];
          report.nextAction = nextAction(
            'authorize_subpixel_residual',
            '',
            [],
            ['NAMED_AUTHORIZER', 'AUTHORIZATION_DATE', 'EXACT_RESIDUAL_SHA256', 'EXACT_EVIDENCE_BINDINGS'],
            `Review ${report.files.subpixelResidual}, create a monteby-subpixel-authorization file bound to its residualSha256 and bindings, then rerun with --subpixel-authorization.`
          );
          persist(report);
          output(report, options);
          process.exitCode = 1;
          return;
        }
      }
      if (!authorizedResidual) {
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
          repairReportPath: report.files.report,
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
    }

    report.ok = true;
    report.status = 'DONE';
    report.fidelityPassed = true;
    report.canonicalVerification = true;
    report.productReady = true;
    report.verdict = authorizedResidual
      ? 'canonical_verified_with_authorized_residual'
      : 'canonical_verified_1_to_1';
    report.evidence = {
      site: previewReport.scope.site,
      pageId: previewReport.scope.pageId,
      layoutSha256: previewReport.layoutSha256,
      saveReport: previewReport.evidence.saveReport,
      previewReport: options.previewReport,
      publicPageUrl: options.publicPageUrl,
      ...(authorizedResidual ? { subpixelResidual: authorizedResidual } : {}),
    };
    report.nextAction = nextAction(
      'complete',
      '',
      [],
      [],
      authorizedResidual
        ? 'Canonical WordPress/PHP output passed with an explicitly authorized subpixel residual. This verdict is not 1:1.'
        : 'Canonical WordPress/PHP output passed the strict zero-difference three-viewport benchmark. No action remains.'
    );
    persist(report);
    output(report, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!report && options?.outDir) {
      report = baseReport(options);
    }
    if (report) {
      report.status = options?.verifyProps ? 'PUBLIC_PROPS_BLOCKED' : 'ERROR';
      report.blockers = [{ code: options?.verifyProps && /^(?:prop|public_props)_[a-z_]+$/u.test(message) ? message : 'canonical_verification_error', message }];
      report.nextAction = options?.verifyProps
        ? nextAction('blocked_public_prop_evidence', '', [], [], 'Review the exact failure; never reapply operations automatically.')
        : retryAction(options);
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
  verifyAppliedProps,
  benchmarkArgs,
  captureArgs,
  parseArgs,
  validateCanonicalEvidence,
  validateIteration,
};
