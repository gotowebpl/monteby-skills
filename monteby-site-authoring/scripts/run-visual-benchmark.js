#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TEMPLATE_PAGE_DEPTH_MIN_RATIO = 0.8;
const TEMPLATE_VISUAL_DIFF_MAX_PERCENT = 4;
const TEMPLATE_VISUAL_DIFF_MAX_VIEWPORT_PERCENT = 8;
const TEMPLATE_MEDIA_SURFACE_MIN_RATIO = 0.75;
const HORIZONTAL_OVERFLOW_MAX_PX = 1;
const HORIZONTAL_OVERFLOW_OFFENDER_LIMIT = 20;
const GENERIC_GEOMETRY_THRESHOLDS = Object.freeze({
  minViewportScore: 82,
  maxPageDepthDelta: 0.2,
  maxMeanTopDelta: 0.045,
  maxMeanHeightDelta: 0.05,
  maxMeanWidthDelta: 0.1,
  maxViewportDimensionDelta: 0.02,
  maxMissingBands: 0,
  maxExtraBands: 0,
  maxReorderedBands: 0,
  minBandWidthRatio: 0.5,
  minBandHeightPx: 32,
  minBandHeightViewportRatio: 0.03,
  contentFrameReferenceMaxWidth: 0.96,
  contentFrameCandidateMinWidth: 0.98,
  contentFrameMaxTopDelta: 0.04,
  contentFrameMaxHeightDelta: 0.06,
  contentFrameMaxWidthDelta: 0.035,
  minPaintedSurfaceWidthRatio: 0.2,
  minPaintedSurfaceAreaRatio: 0.02,
  maxPaintedSurfaceCenterXDelta: 0.18,
  maxPaintedSurfaceTopDelta: 0.04,
  maxPaintedSurfaceWidthDelta: 0.18,
  maxPaintedSurfaceHeightDelta: 0.12,
  overlapCollapseRatio: 0.8,
  reorderShapeMaxDelta: 0.035,
  reorderAmbiguityMargin: 0.008,
  alignmentTopScale: 0.08,
  alignmentHeightScale: 0.08,
  alignmentWidthScale: 0.15,
  alignmentGapCost: 0.85,
  scorePageDepthScale: 0.4,
  scoreTopScale: 0.1,
  scoreHeightScale: 0.1,
  scoreWidthScale: 0.2,
  scoreWeights: Object.freeze({
    pageDepth: 0.25,
    top: 0.25,
    height: 0.2,
    width: 0.1,
    bandCoverage: 0.15,
    order: 0.05,
  }),
});
const GENERIC_GEOMETRY_MAJOR_TAGS = new Set(['section', 'header', 'footer', 'nav']);

function parseArgs(argv) {
  const options = {
    label: 'benchmark',
    layout: '',
    contract: '',
    referenceManifest: '',
    targetManifest: '',
    candidateManifest: '',
    candidateDir: '',
    candidatePrefix: 'candidate',
    diffDir: '',
    out: '',
    markdown: '',
    threshold: '0.1',
    maxPercent: '',
    maxViewportPercent: '',
    minMediaSurfaces: '',
    renderedMinCoverageRatio: '',
    requireRealReference: false,
    requireMarketplaceMedia: false,
    padToLargest: false,
    padBackground: '#ff00ff',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--label') {
      options.label = requiredValue(argv, index += 1, arg);
    } else if (arg === '--layout') {
      options.layout = requiredValue(argv, index += 1, arg);
    } else if (arg === '--contract') {
      options.contract = requiredValue(argv, index += 1, arg);
    } else if (arg === '--reference-manifest') {
      options.referenceManifest = requiredValue(argv, index += 1, arg);
    } else if (arg === '--target-manifest') {
      options.targetManifest = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate-manifest') {
      options.candidateManifest = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate-dir') {
      options.candidateDir = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate-prefix') {
      options.candidatePrefix = requiredValue(argv, index += 1, arg);
    } else if (arg === '--diff-dir') {
      options.diffDir = requiredValue(argv, index += 1, arg);
    } else if (arg === '--out') {
      options.out = requiredValue(argv, index += 1, arg);
    } else if (arg === '--markdown') {
      options.markdown = requiredValue(argv, index += 1, arg);
    } else if (arg === '--threshold') {
      options.threshold = requiredValue(argv, index += 1, arg);
    } else if (arg === '--max-percent') {
      options.maxPercent = requiredValue(argv, index += 1, arg);
    } else if (arg === '--max-viewport-percent') {
      options.maxViewportPercent = requiredValue(argv, index += 1, arg);
    } else if (arg === '--min-media-surfaces') {
      options.minMediaSurfaces = requiredValue(argv, index += 1, arg);
    } else if (arg === '--rendered-min-coverage-ratio') {
      options.renderedMinCoverageRatio = requiredValue(argv, index += 1, arg);
    } else if (arg === '--require-real-reference') {
      options.requireRealReference = true;
    } else if (arg === '--require-marketplace-media') {
      options.requireMarketplaceMedia = true;
    } else if (arg === '--pad-to-largest') {
      options.padToLargest = true;
    } else if (arg === '--pad-background') {
      options.padBackground = requiredValue(argv, index += 1, arg);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.layout) {
    throw new Error('--layout is required');
  }
  if (!options.contract) {
    throw new Error('--contract is required');
  }
  if (!options.referenceManifest) {
    throw new Error('--reference-manifest is required');
  }
  if (!options.candidateManifest && !options.candidateDir) {
    throw new Error('--candidate-manifest or --candidate-dir is required');
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
  run-visual-benchmark.js --layout layout.json --contract contract.json --reference-manifest manifest.json (--candidate-dir dir | --candidate-manifest manifest.json) [--target-manifest manifest.json] [--out report.json] [--markdown report.md] [--max-percent 0] [--max-viewport-percent 0] [--rendered-min-coverage-ratio 0.5] [--require-real-reference] [--require-marketplace-media] [--pad-to-largest] [--pad-background #ff00ff] [--json]

Runs the Monteby layout audit, optional rendered media parity audit, and screenshot comparison, then writes one benchmark report.
The command exits non-zero when the clean-JSON audit fails, rendered media roles are lost, candidate horizontal overflow exceeds 1 CSS pixel, or visual budgets are exceeded.
Matched full-page manifests are padded to their largest scroll height automatically; viewport captures keep strict image dimensions.
When both screenshot manifests include rendered layout evidence, visual budgets neutralize only safely paired meaningful media interiors; media geometry, edges, overlays, surrounding UI, and unpaired regions remain strict.
Unmapped --require-real-reference runs and familyless generated targets require complete matching full-page layout evidence and a passing generic geometry verdict.
For mapped real-template or marketplace manifests, strict mode is enforced automatically; media-aware comparison budgets remain diagnostic when the structural Template Visual Verdict applies.`);
}

function scriptPath(name) {
  return path.join(__dirname, name);
}

function runJsonScript(script, args, structuredFailure = null) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  let report;
  try {
    report = parseJsonOutput(result.stdout, script);
  } catch (error) {
    if (!structuredFailure) {
      throw error;
    }

    const stderr = String(result.stderr || '').trim();
    const spawnError = result.error instanceof Error ? result.error.message : '';
    const parseError = error instanceof Error ? error.message : String(error);
    const detail = stderr || spawnError || parseError;
    report = {
      label: structuredFailure.label || path.basename(script),
      ok: false,
      unavailable: true,
      count: 0,
      mismatched: 0,
      total: 0,
      percent: null,
      maxPercent: null,
      results: [],
      budgetErrors: [],
      errors: [
        {
          code: structuredFailure.code,
          message: `${structuredFailure.message} ${detail}`.trim(),
        },
      ],
    };
  }

  return {
    script,
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    report,
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

function auditArgs(options) {
  const args = [
    '--layout',
    path.resolve(options.layout),
    '--contract',
    path.resolve(options.contract),
    '--reference-manifest',
    path.resolve(options.referenceManifest),
    '--json',
  ];

  if (options.minMediaSurfaces) {
    args.push('--min-media-surfaces', options.minMediaSurfaces);
  }
  if (options.requireRealReference) {
    args.push('--require-real-reference');
  }
  if (options.requireMarketplaceMedia) {
    args.push('--require-marketplace-media');
  }

  return args;
}

function compareArgs(options) {
  const args = [
    '--target-manifest',
    path.resolve(options.targetManifest || options.referenceManifest),
    '--candidate-prefix',
    options.candidatePrefix,
    '--threshold',
    options.threshold,
    '--json',
  ];

  if (options.candidateManifest) {
    args.push('--candidate-manifest', path.resolve(options.candidateManifest));
    if (options.maskPairedMediaContent !== false) {
      args.push('--mask-paired-media-content');
    }
  } else {
    args.push('--candidate-dir', path.resolve(options.candidateDir));
  }
  if (options.diffDir) {
    args.push('--diff-dir', path.resolve(options.diffDir));
  } else if (effectiveDiffDir(options)) {
    args.push('--diff-dir', effectiveDiffDir(options));
  }
  if (options.maxPercent) {
    args.push('--max-percent', options.maxPercent);
  }
  if (options.maxViewportPercent) {
    args.push('--max-viewport-percent', options.maxViewportPercent);
  }
  if (options.padToLargest) {
    args.push('--pad-to-largest');
    if (options.padBackground) {
      args.push('--pad-background', options.padBackground);
    }
  }

  return args;
}

function structuralCompareArgs(options) {
  if (!options.candidateManifest || (options.requireRealReference !== true && options.requireMarketplaceMedia !== true)) {
    return [];
  }

  const args = compareArgs({
    ...options,
    diffDir: structuralDiffDir(options),
    maxPercent: '',
    maxViewportPercent: '',
    maskPairedMediaContent: false,
  });
  args.push('--mask-media-boxes');
  args.push('--mask-identity-media');
  args.push('--mask-text-boxes');
  return args;
}

function renderedMediaArgs(options) {
  if (!options.candidateManifest) {
    return [];
  }

  const args = [
    '--reference-manifest',
    path.resolve(options.referenceManifest),
    '--candidate-manifest',
    path.resolve(options.candidateManifest),
    '--json',
  ];

  if (options.renderedMinCoverageRatio) {
    args.push('--min-coverage-ratio', options.renderedMinCoverageRatio);
  }
  if (options.requireRealReference === true || options.requireMarketplaceMedia === true) {
    args.push('--require-viewport-coverage');
  }

  return args;
}

function buildReport(options, auditRun, compareRun, structuralCompareRun, renderedMediaRun, mechanicsReport, genericGeometryReport, horizontalOverflowReport) {
  const auditReport = auditRun.report;
  const comparisonReport = compareRun.report;
  const structuralComparisonReport = structuralCompareRun?.report || {
    ok: true,
    skipped: true,
    reason: 'Structural comparison is generated only for strict rendered candidate manifest runs.',
    results: [],
  };
  const qualitativeComparisonReport = structuralComparisonReport.skipped === true
    ? comparisonReport
    : structuralComparisonReport;
  const renderedMediaReport = renderedMediaRun?.report || {
    ok: true,
    skipped: true,
    reason: 'No --candidate-manifest was provided; rendered media parity requires a capture-template-reference.js manifest for the candidate page.',
    errors: [],
    warnings: [],
  };
  const mechanics = mechanicsReport || {
    ok: true,
    skipped: true,
    reason: 'No template-specific mechanics audit was available for this reference.',
    errors: [],
    warnings: [],
    stats: {},
  };
  const genericGeometry = genericGeometryReport || {
    ok: true,
    skipped: true,
    enforced: false,
    family: '',
    reason: 'Generic geometry verdict was not generated.',
    errors: [],
    warnings: [],
    thresholds: { ...GENERIC_GEOMETRY_THRESHOLDS },
    stats: {},
  };
  const horizontalOverflow = horizontalOverflowReport || {
    ok: true,
    skipped: true,
    reason: 'Horizontal overflow evidence was not generated.',
    thresholdPx: HORIZONTAL_OVERFLOW_MAX_PX,
    errors: [],
    warnings: [],
    stats: { measuredViewports: 0, maxOverflowPx: null, viewports: [] },
  };
  const screenshotMedia = screenshotMediaEvidenceReport(options, mechanics);
  const qualitative = qualitativeTemplateReview(options, qualitativeComparisonReport, renderedMediaReport, mechanics, screenshotMedia);
  const strictTemplateVerdict = usesStrictTemplateVerdict(qualitative);
  const blockers = collectBlockers(auditReport, comparisonReport, structuralComparisonReport, renderedMediaReport, screenshotMedia, horizontalOverflow, genericGeometry, mechanics, qualitative, {
    ignoreComparisonBudgetErrors: strictTemplateVerdict,
  });
  const genericGeometryAccepted = genericGeometry.enforced !== true
    || (genericGeometry.skipped !== true && genericGeometry.ok === true);
  const ok = auditReport.ok === true
    && (comparisonReport.ok !== false || strictTemplateVerdict)
    && structuralComparisonReport.ok !== false
    && renderedMediaReport.ok !== false
    && screenshotMedia.ok !== false
    && horizontalOverflow.ok !== false
    && genericGeometryAccepted
    && mechanics.ok !== false
    && qualitative.ok !== false
    && blockers.length === 0;

  return {
    label: options.label,
    generatedAt: new Date().toISOString(),
    ok,
    files: {
      layout: path.resolve(options.layout),
      contract: path.resolve(options.contract),
      referenceManifest: path.resolve(options.referenceManifest),
      targetManifest: path.resolve(options.targetManifest || options.referenceManifest),
      candidateManifest: options.candidateManifest ? path.resolve(options.candidateManifest) : '',
      candidateDir: options.candidateDir ? path.resolve(options.candidateDir) : '',
      diffDir: effectiveDiffDir(options),
      jsonReport: options.out ? path.resolve(options.out) : '',
      markdownReport: options.markdown ? path.resolve(options.markdown) : '',
      visualReviewSheet: '',
    },
    commands: {
      audit: {
        status: auditRun.status,
        stderr: auditRun.stderr.trim(),
      },
      comparison: {
        status: compareRun.status,
        stderr: compareRun.stderr.trim(),
      },
      structuralComparison: {
        status: structuralCompareRun ? structuralCompareRun.status : 0,
        stderr: structuralCompareRun ? structuralCompareRun.stderr.trim() : '',
      },
      renderedMedia: {
        status: renderedMediaRun ? renderedMediaRun.status : 0,
        stderr: renderedMediaRun ? renderedMediaRun.stderr.trim() : '',
      },
      mechanics: {
        status: mechanics.skipped ? 0 : mechanics.ok ? 0 : 1,
        stderr: '',
      },
      genericGeometry: {
        status: genericGeometry.enforced && (genericGeometry.skipped || !genericGeometry.ok) ? 1 : 0,
        stderr: '',
      },
      horizontalOverflow: {
        status: horizontalOverflow.ok ? 0 : 1,
        stderr: '',
      },
    },
    audit: auditReport,
    renderedMedia: renderedMediaReport,
    screenshotMedia,
    horizontalOverflow,
    genericGeometry,
    mechanics,
    qualitative,
    comparison: comparisonReport,
    structuralComparison: structuralComparisonReport,
    visualReview: {
      sheet: '',
      columns: [],
      items: [],
      warnings: [],
    },
    blockers,
  };
}

function qualitativeTemplateReview(options, comparisonReport, renderedMediaReport, mechanicsReport) {
  const family = typeof mechanicsReport?.family === 'string' ? mechanicsReport.family : '';
  const strictMarketplaceRun = options.requireRealReference === true || options.requireMarketplaceMedia === true;
  const report = {
    ok: true,
    skipped: false,
    family,
    errors: [],
    warnings: [],
    thresholds: {
      aggregateDiffPercent: TEMPLATE_VISUAL_DIFF_MAX_PERCENT,
      viewportDiffPercent: TEMPLATE_VISUAL_DIFF_MAX_VIEWPORT_PERCENT,
      mediaSurfaceRatio: TEMPLATE_MEDIA_SURFACE_MIN_RATIO,
    },
    stats: {
      mediaDensity: null,
    },
  };

  if (!strictMarketplaceRun || !family) {
    return {
      ...report,
      skipped: true,
      reason: !strictMarketplaceRun
        ? 'Template visual verdict is enforced only for strict real-reference or marketplace-media benchmark runs.'
        : 'Reference is not mapped to a template family with visual verdict thresholds.',
    };
  }

  if (!options.candidateManifest) {
    report.errors.push({
      code: 'candidate_render_capture_missing',
      label: 'rendered',
      message: 'Strict real-template benchmarks require a rendered candidate manifest. Capture the candidate page before judging Envato-style visual fidelity.',
    });
  }

  if (renderedMediaReport?.skipped === true) {
    report.errors.push({
      code: 'rendered_media_review_missing',
      label: 'rendered',
      message: 'Strict real-template benchmarks cannot skip rendered media parity. A screenshot-only comparison can hide missing or broken photos.',
    });
  }

  const aggregateDiff = typeof comparisonReport?.percent === 'number' ? comparisonReport.percent : null;
  const viewportDiff = typeof comparisonReport?.maxPercent === 'number' ? comparisonReport.maxPercent : null;
  if (
    (aggregateDiff !== null && aggregateDiff > TEMPLATE_VISUAL_DIFF_MAX_PERCENT)
    || (viewportDiff !== null && viewportDiff > TEMPLATE_VISUAL_DIFF_MAX_VIEWPORT_PERCENT)
  ) {
    report.errors.push({
      code: 'template_visual_resemblance_shortfall',
      label: family,
      message: `The rendered candidate still differs too much from the captured ${family} reference (aggregate ${formatPercent(aggregateDiff)}, max viewport ${formatPercent(viewportDiff)}). Open the visual review sheet and keep tuning the JSON/assets; do not call this Envato-style match complete just because media roles or mechanics pass.`,
    });
  }

  const mediaDensity = templateMediaDensity(renderedMediaReport);
  report.stats.mediaDensity = mediaDensity;
  if (mediaDensity.referenceSurfaces > mediaDensity.requiredSurfaces && mediaDensity.candidateSurfaces < mediaDensity.minimumCandidateSurfaces) {
    report.errors.push({
      code: 'template_photo_density_shortfall',
      label: family,
      message: `The rendered candidate has too few meaningful photo/media surfaces for the captured ${family} reference (${mediaDensity.candidateSurfaces}/${mediaDensity.referenceSurfaces}; expected at least ${mediaDensity.minimumCandidateSurfaces}). Keep adding contract-backed replacement photography until the page reads like a real template kit, not a minimal scaffold.`,
    });
  }

  report.ok = report.errors.length === 0;
  return report;
}

function screenshotMediaEvidenceReport(options, mechanicsReport) {
  const strictMarketplaceRun = options.requireRealReference === true || options.requireMarketplaceMedia === true;
  const family = typeof mechanicsReport?.family === 'string' && mechanicsReport.family.trim()
    ? mechanicsReport.family.trim()
    : 'marketplace';
  const report = {
    ok: true,
    skipped: false,
    family,
    errors: [],
    warnings: [],
    stats: {
      viewports: [],
      sampledMediaBoxes: 0,
      photoLikeMediaBoxes: 0,
    },
  };

  if (!strictMarketplaceRun) {
    return {
      ...report,
      skipped: true,
      reason: 'Screenshot media evidence is enforced only for strict real-reference or marketplace-media benchmark runs.',
    };
  }

  if (!options.candidateManifest) {
    report.errors.push({
      code: 'candidate_render_capture_missing',
      label: 'rendered',
      message: 'Strict marketplace screenshot media evidence requires a rendered candidate manifest.',
    });
    report.ok = false;
    return report;
  }

  let PNG;
  try {
    PNG = loadPngDependency().PNG;
  } catch (error) {
    report.errors.push({
      code: 'screenshot_media_dependency_missing',
      label: family,
      message: error instanceof Error ? error.message : String(error),
    });
    report.ok = false;
    return report;
  }

  const manifestPath = path.resolve(options.candidateManifest);
  const manifest = readJson(manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];

  if (screenshots.length === 0) {
    report.errors.push({
      code: 'candidate_screenshots_missing',
      label: family,
      message: 'Strict marketplace screenshot media evidence requires candidate screenshots in the rendered candidate manifest.',
    });
    report.ok = false;
    return report;
  }

  for (const screenshot of screenshots) {
    const viewportReport = screenshotViewportMediaEvidence(PNG, manifest, manifestDir, screenshot);
    report.stats.viewports.push(viewportReport);
    report.stats.sampledMediaBoxes += viewportReport.sampledMediaBoxes;
    report.stats.photoLikeMediaBoxes += viewportReport.photoLikeMediaBoxes;

    if (viewportReport.error) {
      report.errors.push(viewportReport.error);
    }
  }

  const primaryViewport = report.stats.viewports.find((viewport) => viewport.label === 'desktop') || report.stats.viewports[0] || null;
  if (report.stats.sampledMediaBoxes === 0) {
    report.errors.push({
      code: 'candidate_screenshot_media_boxes_missing',
      label: family,
      message: 'Candidate screenshots could not be checked for visible photography because no first-viewport media boxes were available. Capture the candidate with --capture-layout before claiming template fidelity.',
    });
  } else if (report.stats.photoLikeMediaBoxes === 0) {
    report.errors.push({
      code: 'candidate_screenshot_photo_evidence_missing',
      label: family,
      message: 'Candidate media boxes are present in the rendered layout, but the screenshot pixels do not show photographic texture. Do not pass a strict Envato/template benchmark with blank, flat, or placeholder media surfaces.',
    });
  } else if (
    primaryViewport
    && primaryViewport.sampledMediaBoxes > 0
    && primaryViewport.photoLikeMediaBoxes === 0
    && primaryViewport.firstViewportMediaCoverage >= 0.12
  ) {
    report.errors.push({
      code: 'candidate_primary_screenshot_photo_evidence_missing',
      label: primaryViewport.label,
      message: `Candidate ${primaryViewport.label} media boxes are present, but none of them looks photographic in the screenshot. Replace flat/blank placeholder surfaces with visible licensed, generated, neutral, or user-provided imagery.`,
    });
  }

  report.ok = report.errors.length === 0;
  return report;
}

function screenshotViewportMediaEvidence(PNG, manifest, manifestDir, screenshot) {
  const label = typeof screenshot?.label === 'string' && screenshot.label.trim() ? screenshot.label.trim() : 'viewport';
  const screenshotFile = typeof screenshot?.file === 'string' ? screenshot.file.trim() : '';
  const layout = loadLayoutForScreenshot(manifest, manifestDir, label);
  const result = {
    label,
    screenshot: screenshotFile ? path.resolve(manifestDir, screenshotFile) : '',
    layout: layout.file,
    sampledMediaBoxes: 0,
    photoLikeMediaBoxes: 0,
    firstViewportMediaCoverage: Number.isFinite(layout.data?.summary?.firstViewportMediaCoverage)
      ? layout.data.summary.firstViewportMediaCoverage
      : 0,
    mediaBoxes: [],
  };

  if (!screenshotFile) {
    result.error = {
      code: 'candidate_screenshot_file_missing',
      label,
      message: `Candidate screenshot "${label}" has no file entry.`,
    };
    return result;
  }

  const screenshotPath = path.resolve(manifestDir, screenshotFile);
  if (!fs.existsSync(screenshotPath)) {
    result.error = {
      code: 'candidate_screenshot_file_missing',
      label,
      message: `Candidate screenshot "${label}" does not exist: ${screenshotPath}`,
    };
    return result;
  }

  if (!layout.data) {
    result.error = {
      code: 'candidate_layout_file_missing',
      label,
      message: `Candidate layout evidence for screenshot "${label}" is missing.`,
    };
    return result;
  }

  const png = PNG.sync.read(fs.readFileSync(screenshotPath));
  const mediaBoxes = firstViewportPhotoMediaBoxes(layout.data).slice(0, 5);
  for (const box of mediaBoxes) {
    const texture = mediaBoxTextureEvidence(png, layout.data.viewport || {}, box);
    result.mediaBoxes.push({
      source: box.source || box.backgroundImage || '',
      width: Math.round(box.rect?.width || 0),
      height: Math.round(box.rect?.height || 0),
      firstViewportArea: Math.round(box.firstViewportArea || 0),
      uniqueColorBuckets: texture.uniqueColorBuckets,
      lumaStddev: texture.lumaStddev,
      edgeRatio: texture.edgeRatio,
      photoLike: texture.photoLike,
    });
    result.sampledMediaBoxes += texture.sampled ? 1 : 0;
    result.photoLikeMediaBoxes += texture.photoLike ? 1 : 0;
  }

  return result;
}

function loadLayoutForScreenshot(manifest, manifestDir, label) {
  const entries = layoutEntriesFromManifest(manifest);
  const entry = entries.find((item) => item.label === label && item.status !== 'failed')
    || entries.find((item) => item.label === 'desktop' && item.status !== 'failed')
    || entries.find((item) => item.status !== 'failed')
    || null;
  const file = entry?.file || (label === 'desktop' ? manifest.layoutCapture?.file || manifest.layout : '');
  if (!file) {
    return { file: '', data: null };
  }

  const resolved = path.isAbsolute(file) ? file : path.resolve(manifestDir, file);
  if (!fs.existsSync(resolved)) {
    return { file: resolved, data: null };
  }

  return { file: resolved, data: readJson(resolved) };
}

function layoutEntriesFromManifest(manifest) {
  const entries = [];
  if (Array.isArray(manifest?.layoutCapture?.layouts)) {
    entries.push(...manifest.layoutCapture.layouts);
  }
  if (Array.isArray(manifest?.layouts)) {
    entries.push(...manifest.layouts);
  }
  if (entries.length === 0) {
    if (typeof manifest?.layoutCapture?.file === 'string') {
      entries.push({ label: 'desktop', file: manifest.layoutCapture.file, status: manifest.layoutCapture.status || 'ok' });
    }
    if (typeof manifest?.layout === 'string') {
      entries.push({ label: 'desktop', file: manifest.layout, status: 'ok' });
    }
  }

  return entries
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.file === 'string')
    .map((entry) => ({
      label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : 'desktop',
      file: entry.file,
      status: typeof entry.status === 'string' ? entry.status : 'ok',
    }));
}

function firstViewportPhotoMediaBoxes(layout) {
  const viewport = layout?.viewport || {};
  const viewportArea = Number.isFinite(viewport.width) && Number.isFinite(viewport.height)
    ? viewport.width * viewport.height
    : 0;
  const minArea = Math.max(12000, viewportArea * 0.004);
  const boxes = Array.isArray(layout?.mediaBoxes) ? layout.mediaBoxes : [];

  return boxes
    .filter((box) => Number.isFinite(box?.firstViewportArea) && box.firstViewportArea >= minArea)
    .filter((box) => isCandidatePhotoMediaUrl(box.source || box.backgroundImage || ''))
    .sort((first, second) => (second.firstViewportArea || 0) - (first.firstViewportArea || 0));
}

function mediaBoxTextureEvidence(png, viewport, box) {
  const rect = box?.rect || {};
  const viewportWidth = Number.isFinite(viewport.width) && viewport.width > 0 ? viewport.width : png.width;
  const scale = viewportWidth > 0 ? png.width / viewportWidth : 1;
  const x = clampInt(Math.floor((Number(rect.left ?? rect.x) || 0) * scale), 0, png.width - 1);
  const y = clampInt(Math.floor((Number(rect.top ?? rect.y) || 0) * scale), 0, png.height - 1);
  const width = clampInt(Math.ceil((Number(rect.width) || 0) * scale), 1, png.width - x);
  const height = clampInt(Math.ceil((Number(rect.height) || 0) * scale), 1, png.height - y);

  if (width <= 1 || height <= 1) {
    return {
      sampled: false,
      uniqueColorBuckets: 0,
      lumaStddev: 0,
      edgeRatio: 0,
      photoLike: false,
    };
  }

  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));
  const buckets = new Set();
  const lumas = [];
  let edgeTransitions = 0;
  let comparedTransitions = 0;

  for (let sampleY = y; sampleY < y + height; sampleY += stepY) {
    let previous = null;
    for (let sampleX = x; sampleX < x + width; sampleX += stepX) {
      const offset = ((sampleY * png.width) + sampleX) * 4;
      const red = png.data[offset];
      const green = png.data[offset + 1];
      const blue = png.data[offset + 2];
      const alpha = png.data[offset + 3];
      if (alpha < 16) {
        continue;
      }

      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      lumas.push(luma);
      buckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
      if (previous !== null) {
        comparedTransitions += 1;
        if (Math.abs(luma - previous) >= 14) {
          edgeTransitions += 1;
        }
      }
      previous = luma;
    }
  }

  if (lumas.length < 16) {
    return {
      sampled: false,
      uniqueColorBuckets: buckets.size,
      lumaStddev: 0,
      edgeRatio: 0,
      photoLike: false,
    };
  }

  const mean = lumas.reduce((sum, value) => sum + value, 0) / lumas.length;
  const variance = lumas.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / lumas.length;
  const lumaStddev = Math.round(Math.sqrt(variance) * 100) / 100;
  const edgeRatio = comparedTransitions > 0 ? Math.round((edgeTransitions / comparedTransitions) * 10000) / 10000 : 0;
  const uniqueColorBuckets = buckets.size;
  const photoLike = (uniqueColorBuckets >= 24 && lumaStddev >= 14 && edgeRatio >= 0.04)
    || (uniqueColorBuckets >= 42 && lumaStddev >= 10 && edgeRatio >= 0.025);

  return {
    sampled: true,
    uniqueColorBuckets,
    lumaStddev,
    edgeRatio,
    photoLike,
  };
}

function isCandidatePhotoMediaUrl(source) {
  const normalized = String(source || '').trim();
  if (!normalized) {
    return false;
  }

  if (/(?:logo|brand|icon|favicon|vector|avatar|sprite|badge|star|rating|pattern|texture|noise|shape|blob|gradient|illustration)/i.test(normalized)) {
    return false;
  }

  return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(normalized)
    || /images\.unsplash\.com\/photo-/i.test(normalized)
    || /images\.pexels\.com\/photos\//i.test(normalized)
    || /source\.unsplash\.com/i.test(normalized)
    || /picsum\.photos/i.test(normalized);
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function usesStrictTemplateVerdict(qualitativeReport) {
  return qualitativeReport?.skipped === false
    && typeof qualitativeReport.family === 'string'
    && qualitativeReport.family.trim() !== '';
}

function templateMediaDensity(renderedMediaReport) {
  const referenceSurfaces = totalRoleCount(renderedMediaReport?.stats?.referenceRoleCounts);
  const candidateSurfaces = totalRoleCount(renderedMediaReport?.stats?.candidateRoleCounts);
  const requiredSurfaces = requiredRoleSurfaceMinimum(renderedMediaReport?.requiredRoles);
  return {
    referenceSurfaces,
    candidateSurfaces,
    requiredSurfaces,
    minimumCandidateSurfaces: Math.max(
      requiredSurfaces,
      Math.ceil(referenceSurfaces * TEMPLATE_MEDIA_SURFACE_MIN_RATIO),
    ),
  };
}

function totalRoleCount(roleCounts) {
  if (!roleCounts || typeof roleCounts !== 'object' || Array.isArray(roleCounts)) {
    return 0;
  }

  return Object.values(roleCounts).reduce((total, count) => Number.isFinite(count) && count > 0 ? total + count : total, 0);
}

function requiredRoleSurfaceMinimum(requiredRoles) {
  if (!Array.isArray(requiredRoles)) {
    return 0;
  }

  return requiredRoles.reduce((total, role) => {
    const count = role && typeof role === 'object' && Number.isInteger(role.minSurfaces) && role.minSurfaces > 0
      ? role.minSurfaces
      : 1;
    return total + count;
  }, 0);
}

function collectBlockers(auditReport, comparisonReport, structuralComparisonReport, renderedMediaReport, screenshotMediaReport, horizontalOverflowReport, genericGeometryReport, mechanicsReport, qualitativeReport, options = {}) {
  const blockers = [];

  for (const item of Array.isArray(auditReport.errors) ? auditReport.errors : []) {
    blockers.push({
      source: 'audit',
      code: item.code || 'audit_error',
      message: item.message || '',
    });
  }

  for (const item of Array.isArray(comparisonReport.errors) ? comparisonReport.errors : []) {
    blockers.push({
      source: 'comparison',
      code: item.code || 'comparison_error',
      label: item.label || '',
      message: item.message || '',
    });
  }

  if (options.ignoreComparisonBudgetErrors !== true) {
    for (const item of Array.isArray(comparisonReport.budgetErrors) ? comparisonReport.budgetErrors : []) {
      blockers.push({
        source: 'comparison',
        code: item.code || 'budget_error',
        label: item.label || '',
        message: item.message || '',
      });
    }
  }

  for (const item of Array.isArray(structuralComparisonReport.errors) ? structuralComparisonReport.errors : []) {
    blockers.push({
      source: 'structural-comparison',
      code: item.code || 'structural_comparison_error',
      label: item.label || '',
      message: item.message || '',
    });
  }

  for (const item of Array.isArray(renderedMediaReport.errors) ? renderedMediaReport.errors : []) {
    blockers.push({
      source: 'rendered-media',
      code: item.code || 'rendered_media_error',
      message: item.message || '',
    });
  }

  for (const item of Array.isArray(screenshotMediaReport.errors) ? screenshotMediaReport.errors : []) {
    blockers.push({
      source: 'screenshot-media',
      code: item.code || 'screenshot_media_error',
      label: item.label || '',
      message: item.message || '',
    });
  }

  for (const item of Array.isArray(horizontalOverflowReport.errors) ? horizontalOverflowReport.errors : []) {
    blockers.push({
      source: 'horizontal-overflow',
      code: item.code || 'horizontal_overflow_error',
      label: item.label || '',
      message: item.message || '',
      overflowPx: item.overflowPx,
      thresholdPx: item.thresholdPx,
      viewportWidth: item.viewportWidth,
      documentScrollWidth: item.documentScrollWidth,
      offenderCount: item.offenderCount,
      offendersTruncated: item.offendersTruncated,
      offenders: Array.isArray(item.offenders) ? item.offenders : [],
    });
  }

  if (genericGeometryReport.enforced === true) {
    for (const item of Array.isArray(genericGeometryReport.errors) ? genericGeometryReport.errors : []) {
      blockers.push({
        source: 'generic-geometry',
        code: item.code || 'generic_geometry_error',
        label: item.label || '',
        message: item.message || '',
      });
    }
  }

  for (const item of Array.isArray(mechanicsReport.errors) ? mechanicsReport.errors : []) {
    blockers.push({
      source: 'mechanics',
      code: item.code || 'mechanics_error',
      label: item.label || '',
      message: item.message || '',
    });
  }

  for (const item of Array.isArray(qualitativeReport.errors) ? qualitativeReport.errors : []) {
    blockers.push({
      source: 'qualitative',
      code: item.code || 'qualitative_error',
      label: item.label || '',
      message: item.message || '',
    });
  }

  return blockers;
}

function writeOutputs(report, options) {
  if (options.out) {
    writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (options.markdown) {
    writeFile(options.markdown, renderMarkdown(report));
  }
}

function writeFile(file, contents) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, contents);
}

function effectiveDiffDir(options) {
  if (options.diffDir) {
    return path.resolve(options.diffDir);
  }
  if (options.markdown) {
    return path.join(path.dirname(path.resolve(options.markdown)), 'diffs');
  }
  if (options.out) {
    return path.join(path.dirname(path.resolve(options.out)), 'diffs');
  }

  return '';
}

function structuralDiffDir(options) {
  const diffDir = effectiveDiffDir(options);
  return diffDir ? `${diffDir}-structural` : '';
}

function renderMarkdown(report) {
  const tabInteractionStats = report.mechanics.stats?.tabInteractions || {};
  const tabInteractionViewports = Array.isArray(tabInteractionStats.viewports)
    ? tabInteractionStats.viewports.map((viewport) => (
      `${viewport.label}:${viewport.candidateWorkingGroups}/${viewport.referenceWorkingGroups}`
    )).join(', ') || 'none'
    : 'none';
  const lines = [
    '# Monteby Visual Benchmark Report',
    '',
    `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Label: ${report.label}`,
    `- Generated: ${report.generatedAt}`,
    `- Layout: \`${report.files.layout}\``,
    `- Reference: \`${report.files.referenceManifest}\``,
    '',
    '## Audit',
    '',
    `- Status: ${report.audit.ok ? 'PASS' : 'FAIL'}`,
    `- Nodes: ${report.audit.stats?.nodes ?? 'n/a'}`,
    `- Media surfaces: ${report.audit.stats?.mediaSurfaces ?? 'n/a'}`,
  ];

  appendIssueList(lines, report.audit.errors, 'Audit Errors');

  lines.push(
    '',
    '## Rendered Media',
    '',
    `- Status: ${report.renderedMedia.skipped ? 'SKIPPED' : report.renderedMedia.ok ? 'PASS' : 'FAIL'}`,
    `- Reference roles: ${formatRoleCounts(report.renderedMedia.stats?.referenceRoleCounts)}`,
    `- Candidate roles: ${formatRoleCounts(report.renderedMedia.stats?.candidateRoleCounts)}`,
    `- Reference first-viewport media coverage: ${formatCoverage(report.renderedMedia.stats?.referenceFirstViewportMediaCoverage)}`,
    `- Candidate first-viewport media coverage: ${formatCoverage(report.renderedMedia.stats?.candidateFirstViewportMediaCoverage)}`,
    `- Viewport coverage: ${formatViewportCoverage(report.renderedMedia.stats?.viewportCoverage)}`,
  );
  if (report.renderedMedia.skipped) {
    lines.push(`- Reason: ${report.renderedMedia.reason}`);
  }

  appendIssueList(lines, report.renderedMedia.errors, 'Rendered Media Errors');

  lines.push(
    '',
    '## Screenshot Media Evidence',
    '',
    `- Status: ${report.screenshotMedia.skipped ? 'SKIPPED' : report.screenshotMedia.ok ? 'PASS' : 'FAIL'}`,
    `- Family: ${report.screenshotMedia.family || 'n/a'}`,
    `- Sampled media boxes: ${report.screenshotMedia.stats?.sampledMediaBoxes ?? 0}`,
    `- Photo-like media boxes: ${report.screenshotMedia.stats?.photoLikeMediaBoxes ?? 0}`,
    `- Viewports: ${formatScreenshotMediaViewports(report.screenshotMedia.stats?.viewports)}`,
  );
  if (report.screenshotMedia.skipped) {
    lines.push(`- Reason: ${report.screenshotMedia.reason}`);
  }

  appendIssueList(lines, report.screenshotMedia.errors, 'Screenshot Media Evidence Errors');

  lines.push(
    '',
    '## Horizontal Overflow',
    '',
    `- Status: ${report.horizontalOverflow.skipped ? 'SKIPPED' : report.horizontalOverflow.ok ? 'PASS' : 'FAIL'}`,
    `- Maximum allowed: ${report.horizontalOverflow.thresholdPx}px`,
    `- Maximum measured: ${Number.isFinite(report.horizontalOverflow.stats?.maxOverflowPx) ? `${report.horizontalOverflow.stats.maxOverflowPx}px` : 'n/a'}`,
    `- Viewports: ${formatHorizontalOverflowViewports(report.horizontalOverflow.stats?.viewports)}`,
  );
  if (report.horizontalOverflow.skipped) {
    lines.push(`- Reason: ${report.horizontalOverflow.reason}`);
  }

  appendIssueList(lines, report.horizontalOverflow.errors, 'Horizontal Overflow Errors');
  appendIssueList(lines, report.horizontalOverflow.warnings, 'Horizontal Overflow Warnings');

  lines.push(
    '',
    '## Generic Geometry Verdict',
    '',
    `- Status: ${report.genericGeometry.skipped ? 'SKIPPED' : report.genericGeometry.ok ? 'PASS' : 'FAIL'}`,
    `- Required for acceptance: ${report.genericGeometry.enforced ? 'yes' : 'no'}`,
    `- Mapped family: ${report.genericGeometry.family || 'none'}`,
    `- Minimum viewport score: ${report.genericGeometry.thresholds?.minViewportScore ?? 'n/a'}`,
    `- Maximum symmetric page-depth delta: ${formatCoverage(report.genericGeometry.thresholds?.maxPageDepthDelta)}`,
    `- Aggregate score: ${formatGeometryScore(report.genericGeometry.stats?.aggregateScore)}`,
    `- Minimum viewport score: ${formatGeometryScore(report.genericGeometry.stats?.minViewportScore)}`,
    `- Viewports: ${formatGenericGeometryViewports(report.genericGeometry.stats?.viewports)}`,
  );
  if (report.genericGeometry.skipped) {
    lines.push(`- Reason: ${report.genericGeometry.reason}`);
  }

  appendIssueList(lines, report.genericGeometry.errors, 'Generic Geometry Errors');
  appendIssueList(lines, report.genericGeometry.warnings, 'Generic Geometry Warnings');

  lines.push(
    '',
    '## Template Mechanics',
    '',
    `- Status: ${report.mechanics.skipped ? 'SKIPPED' : report.mechanics.ok ? 'PASS' : 'FAIL'}`,
    `- Family: ${report.mechanics.family || 'n/a'}`,
    `- Working tab groups: ${tabInteractionStats.candidateWorkingGroups ?? 0}/${tabInteractionStats.referenceWorkingGroups ?? 0}`,
    `- Tab interaction viewports: ${tabInteractionViewports}`,
  );
  if (report.mechanics.skipped) {
    lines.push(`- Reason: ${report.mechanics.reason}`);
  }

  appendIssueList(lines, report.mechanics.errors, 'Mechanics Errors');
  appendIssueList(lines, report.mechanics.warnings, 'Mechanics Warnings');

  lines.push(
    '',
    '## Template Visual Verdict',
    '',
    `- Status: ${report.qualitative.skipped ? 'SKIPPED' : report.qualitative.ok ? 'PASS' : 'FAIL'}`,
    `- Family: ${report.qualitative.family || 'n/a'}`,
    `- Aggregate threshold: ${formatPercent(report.qualitative.thresholds?.aggregateDiffPercent)}`,
    `- Viewport threshold: ${formatPercent(report.qualitative.thresholds?.viewportDiffPercent)}`,
    `- Structural aggregate diff: ${report.structuralComparison?.skipped ? 'n/a' : formatPercent(report.structuralComparison?.percent)}`,
    `- Structural max viewport diff: ${report.structuralComparison?.skipped ? 'n/a' : formatPercent(report.structuralComparison?.maxPercent)}`,
    `- Media density: ${formatMediaDensity(report.qualitative.stats?.mediaDensity)}`,
  );
  if (report.qualitative.skipped) {
    lines.push(`- Reason: ${report.qualitative.reason}`);
  }

  appendIssueList(lines, report.qualitative.errors, 'Template Visual Verdict Errors');
  appendIssueList(lines, report.qualitative.warnings, 'Template Visual Verdict Warnings');

  lines.push(
    '',
    '## Visual Diff',
    '',
    `- Status: ${report.comparison.ok === false ? 'FAIL' : 'PASS'}`,
    `- Aggregate diff: ${formatPercent(report.comparison.percent)}`,
    `- Max viewport diff: ${formatPercent(report.comparison.maxPercent)}`,
    `- Compared screenshots: ${report.comparison.count ?? 1}`,
    `- Paired media masking: ${formatPairedMediaMask(report.comparison.mediaMask)}`,
  );
  if (report.structuralComparison?.skipped !== true) {
    lines.push(
      `- Structural aggregate diff: ${formatPercent(report.structuralComparison.percent)}`,
      `- Structural max viewport diff: ${formatPercent(report.structuralComparison.maxPercent)}`,
    );
  }

  appendIssueList(lines, report.comparison.budgetErrors, 'Budget Errors');
  appendIssueList(lines, report.comparison.errors, 'Comparison Errors');
  appendIssueList(lines, report.structuralComparison.errors, 'Structural Comparison Errors');
  appendVisualReview(lines, report.visualReview);
  appendIssueList(lines, report.blockers, 'Blockers');

  return `${lines.join('\n')}\n`;
}

function appendVisualReview(lines, visualReview) {
  lines.push('', '## Visual Review', '');

  if (!visualReview || !Array.isArray(visualReview.items) || visualReview.items.length === 0) {
    lines.push('- No screenshot pairs were available.');
    return;
  }

  if (visualReview.sheet) {
    lines.push(`- Contact sheet: \`${visualReview.sheet}\``);
    lines.push(`- Columns: ${visualReview.columns.join(' | ')}`);
  } else {
    lines.push('- Contact sheet: not created.');
  }

  if (Array.isArray(visualReview.warnings) && visualReview.warnings.length > 0) {
    for (const warning of visualReview.warnings) {
      lines.push(`- Warning: ${warning}`);
    }
  }

  lines.push('');
  for (const item of visualReview.items) {
    lines.push(`- ${item.label}: reference \`${item.target || 'n/a'}\`, candidate \`${item.candidate || 'n/a'}\`${item.diff ? `, diff \`${item.diff}\`` : ''}`);
  }
}

function appendIssueList(lines, items, title) {
  lines.push('', `## ${title}`, '');
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('- None');
    return;
  }

  for (const item of items) {
    const code = item.code ? `[${item.code}] ` : '';
    const label = item.label ? `(${item.label}) ` : '';
    lines.push(`- ${code}${label}${item.message || ''}`);
  }
}

function formatPercent(value) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
}

function formatCoverage(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'n/a';
}

function formatGeometryScore(value) {
  return typeof value === 'number' ? value.toFixed(1) : 'n/a';
}

function formatPairedMediaMask(mediaMask) {
  if (!mediaMask || typeof mediaMask !== 'object') {
    return 'n/a';
  }
  if (mediaMask.enabled !== true) {
    return 'disabled';
  }
  if (mediaMask.applied !== true) {
    return 'not applied (no safe paired media evidence)';
  }

  return `${mediaMask.maskedPairs || 0}/${mediaMask.pairedBoxes || 0} paired boxes, ${mediaMask.maskRectangles || 0} safe mask regions`;
}

function formatGenericGeometryViewports(viewports) {
  if (!Array.isArray(viewports) || viewports.length === 0) {
    return 'none';
  }

  return viewports.map((viewport) => {
    const status = viewport.compared === true ? formatGeometryScore(viewport.score) : 'incomplete';
    const bands = viewport.bands
      ? `${viewport.bands.referenceCount}/${viewport.bands.candidateCount} bands`
      : 'no bands';
    return `${viewport.label}:${status} (${bands})`;
  }).join(', ');
}

function formatRoleCounts(counts) {
  const roles = ['hero', 'secondary', 'service-card', 'reference-media'];
  const parts = roles
    .filter((role) => Number.isFinite(counts?.[role]) && counts[role] > 0)
    .map((role) => `${role}:${counts[role]}`);

  return parts.length > 0 ? parts.join(', ') : 'none';
}

function formatMediaDensity(mediaDensity) {
  if (!mediaDensity || typeof mediaDensity !== 'object') {
    return 'n/a';
  }

  return `${mediaDensity.candidateSurfaces}/${mediaDensity.referenceSurfaces} meaningful surfaces; minimum ${mediaDensity.minimumCandidateSurfaces}`;
}

function formatViewportCoverage(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'n/a';
  }

  return items
    .map((item) => {
      const label = item?.label || 'viewport';
      return `${label}:${formatCoverage(item?.candidateCoverage)}/${formatCoverage(item?.referenceCoverage)}`;
    })
    .join(', ');
}

function formatScreenshotMediaViewports(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'n/a';
  }

  return items
    .map((item) => {
      const label = item?.label || 'viewport';
      const sampled = Number.isFinite(item?.sampledMediaBoxes) ? item.sampledMediaBoxes : 0;
      const photoLike = Number.isFinite(item?.photoLikeMediaBoxes) ? item.photoLikeMediaBoxes : 0;
      return `${label}:${photoLike}/${sampled}`;
    })
    .join(', ');
}

function formatHorizontalOverflowViewports(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'none';
  }

  return items.map((item) => (
    item.measured
      ? `${item.label}:${item.overflowPx}px (${item.documentScrollWidth}/${item.viewportWidth}px)`
      : `${item.label}:unavailable`
  )).join(', ');
}

function attachVisualReview(report, options) {
  const visualReview = buildVisualReview(report, options);
  report.visualReview = visualReview;
  report.files.visualReviewSheet = visualReview.sheet;
}

function buildVisualReview(report, options) {
  const items = visualReviewItems(report.comparison);
  const columns = visualReviewColumns(items);
  const warnings = [];
  const sheetPath = visualReviewSheetPath(report, options);
  let sheet = '';

  if (items.length > 0 && columns.length > 0 && sheetPath) {
    try {
      sheet = writeVisualReviewSheet(items, columns, sheetPath);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    sheet,
    columns,
    items,
    warnings,
  };
}

function visualReviewItems(comparison) {
  const results = Array.isArray(comparison?.results) ? comparison.results : [comparison];

  return results
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      label: String(item.label || 'comparison'),
      target: typeof item.target === 'string' ? item.target : '',
      candidate: typeof item.candidate === 'string' ? item.candidate : '',
      diff: typeof item.diff === 'string' ? item.diff : '',
    }))
    .filter((item) => item.target || item.candidate || item.diff);
}

function visualReviewColumns(items) {
  const columns = [
    { key: 'target', label: 'reference' },
    { key: 'candidate', label: 'candidate' },
    { key: 'diff', label: 'diff' },
  ];

  return columns.filter((column) => items.some((item) => item[column.key])).map((column) => column.label);
}

function visualReviewSheetPath(report, options) {
  const baseDir = options.markdown
    ? path.dirname(path.resolve(options.markdown))
    : options.out
      ? path.dirname(path.resolve(options.out))
      : options.diffDir
        ? path.resolve(options.diffDir)
        : '';

  if (!baseDir) {
    return '';
  }

  return path.join(baseDir, `${slugFileName(report.label || 'benchmark')}-visual-review.png`);
}

function slugFileName(value) {
  return String(value || 'benchmark').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'benchmark';
}

function writeVisualReviewSheet(items, columns, outputPath) {
  const { PNG } = loadPngDependency();
  const columnKeys = columns.map((label) => (label === 'reference' ? 'target' : label));
  const rows = items.map((item) => columnKeys.map((key) => readSheetCell(PNG, item[key])));
  const maxCellWidth = 480;
  const gutter = 24;
  const rowGap = 24;
  const headerHeight = 42;
  const rowLabelHeight = 22;
  const background = [255, 255, 255, 255];
  const fittedRows = rows.map((row) => row.map((cell) => fitSheetCell(cell, maxCellWidth)));
  const rowHeights = fittedRows.map((row) => Math.max(...row.map((cell) => cell.height), 1));
  const width = (maxCellWidth * columnKeys.length) + (gutter * (columnKeys.length + 1));
  const height = headerHeight + rowHeights.reduce((sum, rowHeight) => sum + rowHeight + rowLabelHeight, rowGap) + (rowGap * rowHeights.length);
  const sheet = new PNG({ width, height });

  fillPng(sheet, background);
  fillRect(sheet, 0, 0, width, headerHeight, [12, 18, 27, 255]);
  for (let columnIndex = 0; columnIndex < columnKeys.length; columnIndex += 1) {
    const x = gutter + (columnIndex * (maxCellWidth + gutter));
    drawText(sheet, visualReviewColumnTitle(columnKeys[columnIndex]), x, 16, [255, 255, 255, 255], 2);
  }

  let y = headerHeight + rowGap;
  for (let rowIndex = 0; rowIndex < fittedRows.length; rowIndex += 1) {
    let x = gutter;
    const rowHeight = rowHeights[rowIndex];

    drawText(sheet, sheetRowLabel(items[rowIndex]?.label || `row ${rowIndex + 1}`), gutter, y, [71, 85, 105, 255], 1);
    y += rowLabelHeight;

    for (const cell of fittedRows[rowIndex]) {
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

function visualReviewColumnTitle(key) {
  if (key === 'target') {
    return 'REFERENCE';
  }
  if (key === 'candidate') {
    return 'MONTEBY CANDIDATE';
  }
  if (key === 'diff') {
    return 'DIFF';
  }
  return String(key || 'IMAGE').toUpperCase();
}

function sheetRowLabel(label) {
  const normalized = String(label || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\?.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return truncateSheetText(normalized || 'comparison', 118);
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
      throw new Error('Missing dependency "pngjs"; visual review sheet was not created.');
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

function fitSheetCell(image, maxWidth) {
  if (!image) {
    return { image: null, width: 1, height: 1 };
  }

  const scale = image.width > maxWidth ? maxWidth / image.width : 1;
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

function auditTemplateMechanics(options) {
  if (!options.candidateManifest) {
    return skippedMechanics('No --candidate-manifest was provided.');
  }

  const referenceManifestPath = path.resolve(options.referenceManifest);
  const candidateManifestPath = path.resolve(options.candidateManifest);
  const referenceManifest = readJson(referenceManifestPath);
  const targetManifest = options.targetManifest
    ? readJson(path.resolve(options.targetManifest))
    : referenceManifest;
  const family = mechanicsFamily(referenceManifest);
  const referenceLayouts = loadComparableLayouts(referenceManifestPath);
  const candidateLayouts = loadComparableLayouts(candidateManifestPath);
  const referenceTabSummaries = [
    ...(Array.isArray(referenceManifest?.layouts) ? referenceManifest.layouts : []),
    ...(Array.isArray(referenceManifest?.layoutCapture?.layouts) ? referenceManifest.layoutCapture.layouts : []),
    ...(Array.isArray(referenceManifest?.interactionEvidence?.tabs?.viewports)
      ? referenceManifest.interactionEvidence.tabs.viewports
      : []),
  ];
  const capturedReferenceTabsDetected = Object.values(referenceLayouts).some((layout) => {
    const tabs = layout?.interactionEvidence?.tabs;
    return Number(tabs?.detectedGroups || 0) > 0
      || (Array.isArray(tabs?.groups) && tabs.groups.length > 0);
  }) || referenceTabSummaries.some((entry) => Number(entry?.tabInteractions?.detectedGroups ?? entry?.detectedGroups ?? 0) > 0);
  const requiresWorkingTabs = referenceManifest?.interactionPattern?.type === 'tabs'
    || targetManifest?.interactionPattern?.type === 'tabs'
    || capturedReferenceTabsDetected;
  if (!referenceLayouts.desktop) {
    if (requiresWorkingTabs) {
      const tabsOnlyReport = {
        ok: true,
        skipped: false,
        family,
        errors: [],
        warnings: [],
        stats: {},
      };
      compareTabInteractions(tabsOnlyReport, referenceLayouts, candidateLayouts, true);
      tabsOnlyReport.ok = tabsOnlyReport.errors.length === 0;
      return tabsOnlyReport;
    }
    return skippedMechanics('Desktop rendered layout evidence is missing.');
  }
  if (!candidateLayouts.desktop) {
    const missingCandidateReport = {
      ok: true,
      skipped: false,
      family,
      errors: [],
      warnings: [],
      stats: {},
    };
    compareTabInteractions(missingCandidateReport, referenceLayouts, candidateLayouts, requiresWorkingTabs);
    if (missingCandidateReport.errors.length > 0) {
      missingCandidateReport.ok = false;
      return missingCandidateReport;
    }
    return skippedMechanics('Desktop candidate layout evidence is missing.');
  }

  let report;
  if (family === 'careglo') {
    report = auditCaregloMechanics(referenceLayouts, candidateLayouts);
  } else if (family === 'maidy') {
    report = auditMaidyMechanics(referenceLayouts, candidateLayouts);
  } else if (family === 'optomatta') {
    report = auditOptomattaMechanics(referenceLayouts, candidateLayouts);
  } else if (family === 'lumen') {
    report = auditLumenMechanics(referenceLayouts, candidateLayouts);
  } else {
    report = {
      ok: true,
      skipped: false,
      family: '',
      errors: [],
      warnings: [],
      stats: {},
    };
  }

  for (const label of ['desktop', 'tablet', 'mobile']) {
    if (referenceLayouts[label] && candidateLayouts[label]) {
      comparePageDepth(report, referenceLayouts[label], candidateLayouts[label], label);
    }
  }
  compareTabInteractions(report, referenceLayouts, candidateLayouts, requiresWorkingTabs);

  report.ok = report.errors.length === 0;
  return report;
}

function skippedMechanics(reason) {
  return {
    ok: true,
    skipped: true,
    reason,
    errors: [],
    warnings: [],
    stats: {},
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function mechanicsFamily(referenceManifest) {
  const source = [
    referenceManifest?.sourceUrl,
    referenceManifest?.url,
    referenceManifest?.referenceStyle,
    referenceManifest?.archetype,
    referenceManifest?.target?.referenceStyle,
    referenceManifest?.target?.archetype,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  if (source.includes('templates.studioniskala.com/car') || source.includes('careglo') || source.includes('luxury-car-care')) {
    return 'careglo';
  }
  if (source.includes('askproject.net/maidy') || source.includes('maidy') || source.includes('maid-service-agency')) {
    return 'maidy';
  }
  if (source.includes('kits.moxcreative.com/optomatta') || source.includes('optomatta') || source.includes('optical-retail')) {
    return 'optomatta';
  }
  if (source.includes('omispace.com/lumen') || source.includes('lumen') || source.includes('eye-care-editorial')) {
    return 'lumen';
  }

  return '';
}

function loadComparableLayouts(manifestPath) {
  const manifest = readJson(manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const layoutEntries = Array.isArray(manifest.layoutCapture?.layouts)
    ? manifest.layoutCapture.layouts
    : Array.isArray(manifest.layouts)
      ? manifest.layouts
      : [];
  const layouts = {};

  for (const label of ['desktop', 'tablet', 'mobile', 'mobile-long']) {
    const entry = layoutEntries.find((item) => item?.label === label && item?.status !== 'failed');
    const file = entry?.file || '';
    if (!file) {
      continue;
    }
    const resolved = path.isAbsolute(file) ? file : path.join(manifestDir, file);
    if (fs.existsSync(resolved)) {
      layouts[label] = readJson(resolved);
    }
  }

  if (!layouts.desktop && layoutEntries.length === 0) {
    const file = manifest.layoutCapture?.file || manifest.layout || '';
    const resolved = file ? (path.isAbsolute(file) ? file : path.join(manifestDir, file)) : '';
    if (resolved && fs.existsSync(resolved)) {
      layouts.desktop = readJson(resolved);
    }
  }

  if (!layouts.mobile && layouts['mobile-long']) {
    layouts.mobile = layouts['mobile-long'];
  }

  return layouts;
}

function compareTabInteractions(report, referenceLayouts, candidateLayouts, requiresWorkingTabs = false) {
  const stats = {
    required: requiresWorkingTabs,
    enforcedViewports: 0,
    referenceDetectedGroups: 0,
    referenceWorkingGroups: 0,
    candidateWorkingGroups: 0,
    failedGroups: 0,
    viewports: [],
  };

  for (const label of ['desktop', 'tablet', 'mobile']) {
    const referenceTabEvidence = referenceLayouts[label]?.interactionEvidence?.tabs;
    const referenceGroups = Array.isArray(referenceTabEvidence?.groups)
      ? referenceTabEvidence.groups
      : [];
    const referenceSchemaVersion = Number(referenceTabEvidence?.schemaVersion || 0);
    const allowLegacyReferenceA11y = referenceSchemaVersion < 2;
    const detectedGroupCount = Number(referenceTabEvidence?.detectedGroups || 0);
    stats.referenceDetectedGroups += Math.max(
      Number.isFinite(detectedGroupCount) ? Math.max(0, detectedGroupCount) : 0,
      referenceGroups.length,
    );
    const workingReferenceGroups = referenceGroups.filter((group) => (
      tabInteractionGroupPasses(group, null, allowLegacyReferenceA11y)
    ));
    if (workingReferenceGroups.length === 0) {
      continue;
    }

    stats.enforcedViewports += 1;
    stats.referenceWorkingGroups += workingReferenceGroups.length;
    const candidateGroups = Array.isArray(candidateLayouts[label]?.interactionEvidence?.tabs?.groups)
      ? candidateLayouts[label].interactionEvidence.tabs.groups
      : [];
    const unmatchedCandidateIndexes = new Set(candidateGroups.map((_, index) => index));
    let passedGroups = 0;
    const failures = [];

    for (const [referenceOrder, referenceGroup] of workingReferenceGroups.entries()) {
      const groupIndex = Number.isInteger(referenceGroup?.index) ? referenceGroup.index : referenceOrder;
      const matchingCandidateIndex = candidateGroups.findIndex((candidateGroup, candidateIndex) => (
        unmatchedCandidateIndexes.has(candidateIndex)
        && tabInteractionGroupPasses(candidateGroup, referenceGroup)
      ));
      if (matchingCandidateIndex >= 0) {
        unmatchedCandidateIndexes.delete(matchingCandidateIndex);
        passedGroups += 1;
        continue;
      }

      const candidateGroup = candidateGroups.find((candidate, candidateIndex) => (
        unmatchedCandidateIndexes.has(candidateIndex)
        && candidate?.orientation === referenceGroup.orientation
        && candidate?.tabCount === referenceGroup.tabCount
        && candidate?.panelCount === referenceGroup.panelCount
      )) || candidateGroups.find((_, candidateIndex) => unmatchedCandidateIndexes.has(candidateIndex));

      const failedEvidence = [];
      if (!candidateGroup) {
        failedEvidence.push('missing captured group evidence');
      } else {
        if (candidateGroup.orientation !== referenceGroup.orientation) failedEvidence.push('tablist orientation');
        if (candidateGroup.tabCount !== referenceGroup.tabCount) failedEvidence.push('tab count');
        if (candidateGroup.panelCount !== referenceGroup.panelCount) failedEvidence.push('panel count');
        if (candidateGroup.initialSelectedIndex !== referenceGroup.initialSelectedIndex) failedEvidence.push('default selection');
        if (candidateGroup.targetIndex !== referenceGroup.targetIndex) failedEvidence.push('keyboard target');
        const geometryTolerances = {
          documentTopRatio: 0.12,
          centerXRatio: 0.15,
          widthRatio: 0.2,
          heightRatio: 0.2,
        };
        for (const [key, tolerance] of Object.entries(geometryTolerances)) {
          const referenceValue = Number(referenceGroup.geometry?.[key]);
          if (!Number.isFinite(referenceValue)) {
            continue;
          }
          const candidateValue = Number(candidateGroup.geometry?.[key]);
          if (!Number.isFinite(candidateValue) || Math.abs(referenceValue - candidateValue) > tolerance) {
            failedEvidence.push('tablist location/size');
            break;
          }
        }
        if (candidateGroup.click?.hitTestPassed !== true) failedEvidence.push('pointer hit target');
        if (candidateGroup.click?.pointerEventsEnabled !== true) failedEvidence.push('pointer events');
        if (candidateGroup.click?.invoked !== true) failedEvidence.push('pointer activation');
        if (candidateGroup.click?.selectedChanged !== true) failedEvidence.push('click selected state');
        if (candidateGroup.click?.panelChanged !== true) failedEvidence.push('click panel state');
        if (candidateGroup.click?.focusMoved !== true) failedEvidence.push('click focus');
        if (candidateGroup.keyboard?.selectedChanged !== true) failedEvidence.push('keyboard selected state');
        if (candidateGroup.keyboard?.panelChanged !== true) failedEvidence.push('keyboard panel state');
        if (candidateGroup.keyboard?.focusMoved !== true) failedEvidence.push('keyboard focus');
        if (candidateGroup.keyboard?.focusIndicatorVisible !== true) failedEvidence.push('keyboard visible focus indicator');
        if (candidateGroup.keyboard?.arrowFocusMoved !== true) failedEvidence.push('arrow-key focus');
        if (!['automatic', 'manual'].includes(candidateGroup.keyboard?.activationMode)) failedEvidence.push('keyboard activation mode');
        if (candidateGroup.ariaRelations?.controlledTargetsResolved !== true) failedEvidence.push('aria-controls targets');
        if (candidateGroup.ariaRelations?.controlledTargetsAreTabpanels !== true) failedEvidence.push('controlled target role=tabpanel');
        if (candidateGroup.ariaRelations?.panelsLabelledByTabs !== true) failedEvidence.push('panel aria-labelledby reciprocity');
        if (candidateGroup.restoredAfterClick !== true || candidateGroup.restored !== true) failedEvidence.push('default-state restoration');
      }
      const evidenceLabel = failedEvidence.join(', ') || 'incomplete transition evidence';
      failures.push({ groupIndex, evidence: failedEvidence });
      mechanicsError(
        report,
        'candidate_tabs_interaction_mismatch',
        label,
        `${label} tab group ${groupIndex + 1} does not reproduce the working reference interaction (${evidenceLabel}). It must keep reciprocal tab/tabpanel ARIA, the same semantic tab structure and approximate location; a hit-tested click plus ${referenceGroup.keyboard?.key || 'orientation-aware arrow-key'} automatic or Enter/Space manual activation must change the selected tab, visible panel, and focus with a visible keyboard focus indicator, then restore the default state.`
      );
    }

    stats.candidateWorkingGroups += passedGroups;
    stats.failedGroups += workingReferenceGroups.length - passedGroups;
    stats.viewports.push({
      label,
      referenceWorkingGroups: workingReferenceGroups.length,
      candidateWorkingGroups: passedGroups,
      failedGroups: workingReferenceGroups.length - passedGroups,
      failures,
    });
  }

  if (requiresWorkingTabs && stats.referenceWorkingGroups === 0) {
    mechanicsError(
      report,
      'reference_tabs_interaction_unverified',
      'all',
      'The target declares or captured reference evidence detects a tabs interaction, but no viewport contains a fully working reference group. Fix or recapture the reference before accepting visual parity; a screenshot alone cannot prove usable tabs.'
    );
  }

  report.stats.tabInteractions = stats;
}

function tabInteractionGroupPasses(group, referenceGroup = null, allowLegacyA11yEvidence = false) {
  const focusIndicatorCaptured = group?.keyboard
    && Object.prototype.hasOwnProperty.call(group.keyboard, 'focusIndicatorVisible');
  const focusIndicatorPasses = group?.keyboard?.focusIndicatorVisible === true
    || (allowLegacyA11yEvidence && !focusIndicatorCaptured);
  const ariaRelationsCaptured = group
    && Object.prototype.hasOwnProperty.call(group, 'ariaRelations');
  const ariaRelationsPass = group?.ariaRelations?.controlledTargetsResolved === true
    && group.ariaRelations.controlledTargetsAreTabpanels === true
    && group.ariaRelations.panelsLabelledByTabs === true
    && group.ariaRelations.complete === true;
  const ariaEvidencePasses = ariaRelationsPass
    || (allowLegacyA11yEvidence && !ariaRelationsCaptured);
  const interactionPasses = group?.supported === true
    && group?.click?.hitTestPassed === true
    && group.click.pointerEventsEnabled === true
    && group.click.invoked === true
    && group?.click?.passed === true
    && group.click.selectedChanged === true
    && group.click.panelChanged === true
    && group.click.focusMoved === true
    && group?.keyboard?.passed === true
    && group.keyboard.selectedChanged === true
    && group.keyboard.panelChanged === true
    && group.keyboard.focusMoved === true
    && focusIndicatorPasses
    && group.keyboard.arrowFocusMoved === true
    && ['automatic', 'manual'].includes(group.keyboard.activationMode)
    && group.restoredAfterClick === true
    && group.restored === true
    && ariaEvidencePasses;

  if (!interactionPasses || !referenceGroup) {
    return interactionPasses;
  }

  if (group.orientation !== referenceGroup.orientation
    || group.tabCount !== referenceGroup.tabCount
    || group.panelCount !== referenceGroup.panelCount
    || group.initialSelectedIndex !== referenceGroup.initialSelectedIndex
    || group.targetIndex !== referenceGroup.targetIndex) {
    return false;
  }

  const geometryTolerances = {
    documentTopRatio: 0.12,
    centerXRatio: 0.15,
    widthRatio: 0.2,
    heightRatio: 0.2,
  };
  return Object.entries(geometryTolerances).every(([key, tolerance]) => {
    const referenceValue = Number(referenceGroup.geometry?.[key]);
    if (!Number.isFinite(referenceValue)) {
      return true;
    }
    const candidateValue = Number(group.geometry?.[key]);
    return Number.isFinite(candidateValue) && Math.abs(referenceValue - candidateValue) <= tolerance;
  });
}

function auditGenericGeometry(options) {
  const referenceManifestPath = path.resolve(options.referenceManifest);
  const referenceManifest = readJson(referenceManifestPath);
  const family = mechanicsFamily(referenceManifest);
  const referenceEvidence = loadManifestLayoutEvidence(referenceManifestPath);
  const hasCompleteFullPageReferenceGeometry = referenceEvidence.entries.length > 0
    && referenceEvidence.entries.every((entry) => (
      entry.data?.evidenceCompleteness?.complete === true
      && entry.data?.evidenceCompleteness?.status === 'complete'
      && entry.data?.evidenceCompleteness?.mode === 'full-page'
    ));
  const generatedMeasuredTarget = !family
    && typeof referenceManifest?.seed === 'string'
    && referenceManifest.seed.trim() !== ''
    && typeof referenceManifest?.variant === 'string'
    && Array.isArray(referenceManifest?.layouts)
    && referenceManifest.layouts.length > 0;
  const enforced = !family
    && hasCompleteFullPageReferenceGeometry
    && (options.requireRealReference === true || Boolean(options.candidateManifest) || generatedMeasuredTarget);
  const report = {
    ok: true,
    skipped: false,
    enforced,
    family,
    errors: [],
    warnings: [],
    thresholds: {
      ...GENERIC_GEOMETRY_THRESHOLDS,
      scoreWeights: { ...GENERIC_GEOMETRY_THRESHOLDS.scoreWeights },
    },
    stats: {
      referenceViewports: [],
      candidateViewports: [],
      matchingViewports: [],
      comparedViewports: 0,
      aggregateScore: null,
      minViewportScore: null,
      viewports: [],
    },
  };

  if (!options.candidateManifest) {
    report.skipped = true;
    report.reason = 'A rendered candidate manifest is required to compare captured layout geometry.';
    if (enforced) {
      genericGeometryError(
        report,
        'generic_geometry_candidate_manifest_missing',
        'rendered',
        'An unmapped real-reference or generated measured-target benchmark cannot skip the generic geometry verdict. Capture the candidate with layout evidence and pass --candidate-manifest.'
      );
    }
    report.ok = !enforced;
    return report;
  }

  const candidateEvidence = loadManifestLayoutEvidence(path.resolve(options.candidateManifest));
  report.stats.referenceViewports = referenceEvidence.entries.map((entry) => entry.label);
  report.stats.candidateViewports = candidateEvidence.entries.map((entry) => entry.label);

  if (referenceEvidence.entries.length === 0) {
    report.skipped = true;
    report.reason = 'The reference manifest does not expose captured layout JSON.';
    genericGeometryError(
      report,
      'generic_geometry_reference_layouts_missing',
      'reference',
      'Generic geometry needs captured reference layout JSON from the reference manifest.'
    );
    report.ok = false;
    return report;
  }

  const referenceLabels = new Set(referenceEvidence.entries.map((entry) => entry.label));
  for (const candidateEntry of candidateEvidence.entries) {
    if (!referenceLabels.has(candidateEntry.label)) {
      report.warnings.push({
        code: 'generic_geometry_extra_candidate_viewport',
        label: candidateEntry.label,
        message: `Candidate layout evidence includes unmatched viewport "${candidateEntry.label}"; it is not part of the reference verdict.`,
      });
    }
  }

  for (const referenceEntry of referenceEvidence.entries) {
    const candidateEntry = candidateEvidence.byLabel.get(referenceEntry.label) || null;
    if (!candidateEntry) {
      const viewportReport = {
        label: referenceEntry.label,
        compared: false,
        score: null,
        errors: [{
          code: 'generic_geometry_candidate_viewport_missing',
          label: referenceEntry.label,
          message: `Candidate layout evidence is missing the reference viewport "${referenceEntry.label}".`,
        }],
      };
      report.stats.viewports.push(viewportReport);
      report.errors.push(...viewportReport.errors);
      continue;
    }

    report.stats.matchingViewports.push(referenceEntry.label);
    const viewportReport = compareGenericGeometryViewport(referenceEntry, candidateEntry);
    report.stats.viewports.push(viewportReport);
    report.errors.push(...viewportReport.errors);
    report.warnings.push(...viewportReport.warnings);
  }

  const compared = report.stats.viewports.filter((viewport) => viewport.compared === true);
  report.stats.comparedViewports = compared.length;
  if (compared.length === 0) {
    report.skipped = true;
    report.reason = 'No viewport had complete reference and candidate layout evidence.';
    if (report.errors.length === 0) {
      genericGeometryError(
        report,
        'generic_geometry_no_comparable_viewports',
        'rendered',
        'Generic geometry could not compare any reference/candidate viewport pair.'
      );
    }
    report.ok = false;
    return report;
  }

  const scoreWeight = compared.reduce(
    (total, viewport) => total + Math.max(1, viewport.bands?.referenceCount || 0),
    0
  );
  report.stats.aggregateScore = roundGeometry(compared.reduce(
    (total, viewport) => total + (viewport.score * Math.max(1, viewport.bands?.referenceCount || 0)),
    0
  ) / scoreWeight, 1);
  report.stats.minViewportScore = Math.min(...compared.map((viewport) => viewport.score));
  report.ok = report.errors.length === 0;
  return report;
}

function loadManifestLayoutEvidence(manifestPath) {
  const manifest = readJson(manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const entries = [];
  const byLabel = new Map();

  for (const descriptor of layoutEntriesFromManifest(manifest)) {
    if (byLabel.has(descriptor.label)) {
      continue;
    }

    const resolved = path.isAbsolute(descriptor.file)
      ? descriptor.file
      : path.resolve(manifestDir, descriptor.file);
    const entry = {
      label: descriptor.label,
      status: descriptor.status,
      file: resolved,
      data: null,
      error: '',
    };

    if (descriptor.status === 'failed') {
      entry.error = 'Manifest marks this layout capture as failed.';
    } else if (!fs.existsSync(resolved)) {
      entry.error = `Layout file does not exist: ${resolved}`;
    } else {
      try {
        entry.data = readJson(resolved);
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error);
      }
    }

    entries.push(entry);
    byLabel.set(entry.label, entry);
  }

  return { entries, byLabel };
}

function auditHorizontalOverflow(options) {
  const report = {
    ok: true,
    skipped: false,
    thresholdPx: HORIZONTAL_OVERFLOW_MAX_PX,
    errors: [],
    warnings: [],
    stats: {
      measuredViewports: 0,
      maxOverflowPx: null,
      viewports: [],
    },
  };

  if (!options.candidateManifest) {
    report.skipped = true;
    report.reason = 'A rendered candidate manifest is required to measure document horizontal overflow.';
    return report;
  }

  const evidence = loadManifestLayoutEvidence(path.resolve(options.candidateManifest));
  if (evidence.entries.length === 0) {
    report.skipped = true;
    report.reason = 'The candidate manifest does not expose captured layout JSON.';
    return report;
  }

  for (const entry of evidence.entries) {
    if (entry.error || !entry.data) {
      report.stats.viewports.push({
        label: entry.label,
        measured: false,
        file: entry.file,
        error: entry.error || 'Layout JSON is empty.',
      });
      report.warnings.push({
        code: 'horizontal_overflow_layout_unavailable',
        label: entry.label,
        message: `Candidate horizontal overflow evidence is unavailable: ${entry.error || 'layout JSON is empty'}`,
      });
      continue;
    }

    const layout = entry.data;
    const captured = layout.horizontalOverflow && typeof layout.horizontalOverflow === 'object'
      ? layout.horizontalOverflow
      : {};
    const viewportWidth = Number(captured.viewportWidth ?? layout.viewport?.width);
    const documentScrollWidth = Number(captured.documentScrollWidth ?? layout.viewport?.scrollWidth);
    const reportedOverflowPx = Number(captured.overflowPx);
    const derivedOverflowPx = Number.isFinite(viewportWidth) && viewportWidth > 0
      && Number.isFinite(documentScrollWidth) && documentScrollWidth > 0
      ? Math.max(0, documentScrollWidth - viewportWidth)
      : NaN;
    const measured = Number.isFinite(reportedOverflowPx) || Number.isFinite(derivedOverflowPx);

    if (!measured || !Number.isFinite(viewportWidth) || viewportWidth <= 0) {
      report.stats.viewports.push({
        label: entry.label,
        measured: false,
        file: entry.file,
        error: 'viewport width, document scrollWidth, or horizontal overflow is missing',
      });
      report.warnings.push({
        code: 'horizontal_overflow_evidence_missing',
        label: entry.label,
        message: 'Candidate layout evidence does not include a positive viewport width plus document scrollWidth or horizontal overflow measurement.',
      });
      continue;
    }

    const overflowPx = Math.max(
      0,
      Number.isFinite(reportedOverflowPx) ? reportedOverflowPx : 0,
      Number.isFinite(derivedOverflowPx) ? derivedOverflowPx : 0
    );
    const rawOffenders = Array.isArray(captured.offenders) ? captured.offenders : [];
    const offenders = rawOffenders.slice(0, HORIZONTAL_OVERFLOW_OFFENDER_LIMIT).map((item) => {
      const rect = item?.rect && typeof item.rect === 'object' ? item.rect : {};
      return {
        key: String(item?.key || '').slice(0, 80),
        tag: String(item?.tag || '').slice(0, 40),
        rect: {
          left: Number(rect.left) || 0,
          right: Number(rect.right) || 0,
          top: Number(rect.top) || 0,
          bottom: Number(rect.bottom) || 0,
          width: Number(rect.width) || 0,
          height: Number(rect.height) || 0,
        },
        overflowLeft: Number(item?.overflowLeft) || 0,
        overflowRight: Number(item?.overflowRight) || 0,
        display: String(item?.display || '').slice(0, 40),
        position: String(item?.position || '').slice(0, 40),
      };
    });
    const reportedOffenderCount = Number.isInteger(captured.offenderCount)
      ? captured.offenderCount
      : rawOffenders.length;
    const offenderCount = Math.max(reportedOffenderCount, rawOffenders.length);
    const reportedTruncated = Number.isInteger(captured.offendersTruncated)
      ? captured.offendersTruncated
      : 0;
    const offendersTruncated = Math.max(reportedTruncated, offenderCount - offenders.length);
    const viewportReport = {
      label: entry.label,
      measured: true,
      file: entry.file,
      viewportWidth,
      documentScrollWidth: Number.isFinite(documentScrollWidth) ? documentScrollWidth : null,
      overflowPx,
      offenderCount,
      offendersTruncated,
      offenders,
    };
    report.stats.viewports.push(viewportReport);
    report.stats.measuredViewports += 1;
    report.stats.maxOverflowPx = report.stats.maxOverflowPx === null
      ? overflowPx
      : Math.max(report.stats.maxOverflowPx, overflowPx);

    if (overflowPx > HORIZONTAL_OVERFLOW_MAX_PX) {
      report.errors.push({
        code: 'candidate_horizontal_overflow_exceeded',
        label: entry.label,
        message: `Candidate ${entry.label} document overflows horizontally by ${overflowPx}px; the maximum allowed overflow is ${HORIZONTAL_OVERFLOW_MAX_PX}px.`,
        overflowPx,
        thresholdPx: HORIZONTAL_OVERFLOW_MAX_PX,
        viewportWidth,
        documentScrollWidth: viewportReport.documentScrollWidth,
        offenderCount,
        offendersTruncated,
        offenders,
      });
    }
  }

  if (report.stats.measuredViewports === 0) {
    report.skipped = true;
    report.reason = 'No candidate viewport had document horizontal overflow evidence.';
  }
  report.ok = report.errors.length === 0;
  return report;
}

function compareGenericGeometryViewport(referenceEntry, candidateEntry) {
  const result = {
    label: referenceEntry.label,
    compared: false,
    score: null,
    errors: [],
    warnings: [],
    evidence: {
      referenceFile: referenceEntry.file,
      candidateFile: candidateEntry.file,
    },
  };

  if (referenceEntry.error || !referenceEntry.data) {
    result.errors.push({
      code: 'generic_geometry_reference_layout_unavailable',
      label: result.label,
      message: `Reference layout evidence is unavailable: ${referenceEntry.error || 'layout JSON is empty'}`,
    });
  }
  if (candidateEntry.error || !candidateEntry.data) {
    result.errors.push({
      code: 'generic_geometry_candidate_layout_unavailable',
      label: result.label,
      message: `Candidate layout evidence is unavailable: ${candidateEntry.error || 'layout JSON is empty'}`,
    });
  }
  if (result.errors.length > 0) {
    return result;
  }

  const reference = inspectGenericGeometryLayout(referenceEntry.data, 'reference', result.label);
  const candidate = inspectGenericGeometryLayout(candidateEntry.data, 'candidate', result.label);
  result.evidence.reference = reference.evidence;
  result.evidence.candidate = candidate.evidence;
  result.errors.push(...reference.errors, ...candidate.errors);
  if (result.errors.length > 0) {
    return result;
  }

  const referenceBands = normalizeGeometryBands(
    reference.bands,
    reference.viewport.scrollHeight,
    reference.viewport.width,
    reference.pageBackground
  );
  const candidateBands = normalizeGeometryBands(
    candidate.bands,
    candidate.viewport.scrollHeight,
    candidate.viewport.width,
    reference.pageBackground
  );
  const alignment = alignGeometryBands(referenceBands, candidateBands);
  const reordered = findReorderedGeometryBands(referenceBands, candidateBands);
  const paintedSurfaceComparisons = alignment.pairs.map((pair) => {
    const referenceBand = referenceBands[pair.referenceIndex];
    const candidateBand = candidateBands[pair.candidateIndex];
    return {
      referenceIndex: pair.referenceIndex,
      candidateIndex: pair.candidateIndex,
      ...matchPaintedGeometrySurfaces(referenceBand.paintedSurfaces, candidateBand.paintedSurfaces),
    };
  });
  const missingPaintedSurfaces = paintedSurfaceComparisons.flatMap((comparison) => (
    comparison.missing.map((surface) => ({
      referenceBand: comparison.referenceIndex,
      candidateBand: comparison.candidateIndex,
      surface,
    }))
  ));
  const pairs = alignment.pairs.map((pair) => {
    const referenceBand = referenceBands[pair.referenceIndex];
    const capturedCandidateBand = candidateBands[pair.candidateIndex];
    const candidateBand = selectCandidateGeometryBand(referenceBand, capturedCandidateBand);
    return {
      referenceIndex: pair.referenceIndex,
      candidateIndex: pair.candidateIndex,
      referenceTags: referenceBand.tags,
      candidateTags: capturedCandidateBand.tags,
      candidateGeometrySource: candidateBand.geometrySource,
      topDelta: Math.abs(referenceBand.top - candidateBand.top),
      heightDelta: Math.abs(referenceBand.height - candidateBand.height),
      widthDelta: Math.abs(referenceBand.width - candidateBand.width),
    };
  });
  const topDeltas = pairs.map((pair) => pair.topDelta);
  const heightDeltas = pairs.map((pair) => pair.heightDelta);
  const widthDeltas = pairs.map((pair) => pair.widthDelta);
  const meanTopDelta = geometryMean(topDeltas, 1);
  const meanHeightDelta = geometryMean(heightDeltas, 1);
  const meanWidthDelta = geometryMean(widthDeltas, 1);
  const pageDepthDelta = symmetricGeometryDelta(
    reference.viewport.scrollHeight,
    candidate.viewport.scrollHeight
  );
  const viewportWidthDelta = symmetricGeometryDelta(reference.viewport.width, candidate.viewport.width);
  const viewportHeightDelta = symmetricGeometryDelta(reference.viewport.height, candidate.viewport.height);
  const matchedCount = pairs.length;
  const bandCoverage = matchedCount / Math.max(1, referenceBands.length, candidateBands.length);
  const maximumInversions = Math.max(1, (matchedCount * (matchedCount - 1)) / 2);
  const orderSimilarity = 1 - Math.min(1, reordered.inversions / maximumInversions);
  const scoreParts = {
    pageDepth: geometrySimilarity(pageDepthDelta, GENERIC_GEOMETRY_THRESHOLDS.scorePageDepthScale),
    top: geometrySimilarity(meanTopDelta, GENERIC_GEOMETRY_THRESHOLDS.scoreTopScale),
    height: geometrySimilarity(meanHeightDelta, GENERIC_GEOMETRY_THRESHOLDS.scoreHeightScale),
    width: geometrySimilarity(meanWidthDelta, GENERIC_GEOMETRY_THRESHOLDS.scoreWidthScale),
    bandCoverage,
    order: orderSimilarity,
  };
  const score = roundGeometry(Object.entries(GENERIC_GEOMETRY_THRESHOLDS.scoreWeights).reduce(
    (total, [name, weight]) => total + (scoreParts[name] * weight),
    0
  ) * 100, 1);

  result.compared = true;
  result.score = score;
  result.pageDepth = {
    reference: reference.viewport.scrollHeight,
    candidate: candidate.viewport.scrollHeight,
    ratio: roundGeometry(candidate.viewport.scrollHeight / reference.viewport.scrollHeight, 4),
    symmetricDelta: roundGeometry(pageDepthDelta, 4),
  };
  result.viewportDimensions = {
    reference: { width: reference.viewport.width, height: reference.viewport.height },
    candidate: { width: candidate.viewport.width, height: candidate.viewport.height },
    widthDelta: roundGeometry(viewportWidthDelta, 4),
    heightDelta: roundGeometry(viewportHeightDelta, 4),
  };
  result.bands = {
    referenceCount: referenceBands.length,
    candidateCount: candidateBands.length,
    matchedCount,
    missingCount: alignment.missing.length,
    extraCount: alignment.extra.length,
    reorderedBands: reordered.inversions,
    referenceSourceLandmarks: reference.evidence.sourceLandmarks,
    candidateSourceLandmarks: candidate.evidence.sourceLandmarks,
    referenceCollapsedLandmarks: reference.evidence.collapsedLandmarks,
    candidateCollapsedLandmarks: candidate.evidence.collapsedLandmarks,
    missing: alignment.missing.map((index) => geometryBandSummary(referenceBands[index], index)),
    extra: alignment.extra.map((index) => geometryBandSummary(candidateBands[index], index)),
    reorderPairs: reordered.pairs,
  };
  result.geometry = {
    meanNormalizedTopDelta: roundGeometry(meanTopDelta, 4),
    meanNormalizedHeightDelta: roundGeometry(meanHeightDelta, 4),
    meanNormalizedWidthDelta: roundGeometry(meanWidthDelta, 4),
    maxNormalizedTopDelta: roundGeometry(Math.max(0, ...topDeltas), 4),
    maxNormalizedHeightDelta: roundGeometry(Math.max(0, ...heightDeltas), 4),
    maxNormalizedWidthDelta: roundGeometry(Math.max(0, ...widthDeltas), 4),
    scoreParts: Object.fromEntries(Object.entries(scoreParts).map(([name, value]) => [name, roundGeometry(value, 4)])),
    pairs: pairs.map((pair) => ({
      ...pair,
      topDelta: roundGeometry(pair.topDelta, 4),
      heightDelta: roundGeometry(pair.heightDelta, 4),
      widthDelta: roundGeometry(pair.widthDelta, 4),
    })),
  };
  result.paintedSurfaces = {
    referenceCount: referenceBands.reduce((total, band) => total + band.paintedSurfaces.length, 0),
    candidateCount: candidateBands.reduce((total, band) => total + band.paintedSurfaces.length, 0),
    matchedCount: paintedSurfaceComparisons.reduce((total, comparison) => total + comparison.matched.length, 0),
    missingCount: missingPaintedSurfaces.length,
    missing: missingPaintedSurfaces,
  };

  if (pageDepthDelta > GENERIC_GEOMETRY_THRESHOLDS.maxPageDepthDelta) {
    genericGeometryError(
      result,
      'generic_geometry_page_depth_mismatch',
      result.label,
      `Candidate page depth ${candidate.viewport.scrollHeight}px differs symmetrically from the ${reference.viewport.scrollHeight}px reference by ${formatCoverage(pageDepthDelta)}; the limit is ${formatCoverage(GENERIC_GEOMETRY_THRESHOLDS.maxPageDepthDelta)}.`
    );
  }
  if (Math.max(viewportWidthDelta, viewportHeightDelta) > GENERIC_GEOMETRY_THRESHOLDS.maxViewportDimensionDelta) {
    genericGeometryError(
      result,
      'generic_geometry_viewport_dimensions_mismatch',
      result.label,
      `Reference and candidate viewport dimensions differ by more than ${formatCoverage(GENERIC_GEOMETRY_THRESHOLDS.maxViewportDimensionDelta)}, so normalized band geometry is not comparable acceptance evidence.`
    );
  }
  if (alignment.missing.length > GENERIC_GEOMETRY_THRESHOLDS.maxMissingBands) {
    genericGeometryError(
      result,
      'generic_geometry_major_band_missing',
      result.label,
      `Candidate is missing ${alignment.missing.length} ordered major normal-flow landmark band(s): ${formatGeometryBandList(result.bands.missing)}.`
    );
  }
  if (alignment.extra.length > GENERIC_GEOMETRY_THRESHOLDS.maxExtraBands) {
    genericGeometryError(
      result,
      'generic_geometry_major_band_extra',
      result.label,
      `Candidate has ${alignment.extra.length} extra ordered major normal-flow landmark band(s): ${formatGeometryBandList(result.bands.extra)}.`
    );
  }
  if (reordered.inversions > GENERIC_GEOMETRY_THRESHOLDS.maxReorderedBands) {
    genericGeometryError(
      result,
      'generic_geometry_major_band_reordered',
      result.label,
      `Candidate reorders ${reordered.inversions} confidently shape-matched major band pair(s); preserve the captured normal-flow sequence.`
    );
  }
  if (missingPaintedSurfaces.length > 0) {
    genericGeometryError(
      result,
      'generic_geometry_painted_surface_missing',
      result.label,
      `Candidate is missing ${missingPaintedSurfaces.length} large painted inner surface(s) captured inside aligned major bands.`
    );
  }
  if (meanTopDelta > GENERIC_GEOMETRY_THRESHOLDS.maxMeanTopDelta) {
    genericGeometryError(
      result,
      'generic_geometry_band_top_mismatch',
      result.label,
      `Mean normalized band-top delta is ${formatCoverage(meanTopDelta)}; the limit is ${formatCoverage(GENERIC_GEOMETRY_THRESHOLDS.maxMeanTopDelta)}.`
    );
  }
  if (meanHeightDelta > GENERIC_GEOMETRY_THRESHOLDS.maxMeanHeightDelta) {
    genericGeometryError(
      result,
      'generic_geometry_band_height_mismatch',
      result.label,
      `Mean normalized band-height delta is ${formatCoverage(meanHeightDelta)}; the limit is ${formatCoverage(GENERIC_GEOMETRY_THRESHOLDS.maxMeanHeightDelta)}.`
    );
  }
  if (meanWidthDelta > GENERIC_GEOMETRY_THRESHOLDS.maxMeanWidthDelta) {
    genericGeometryError(
      result,
      'generic_geometry_band_width_mismatch',
      result.label,
      `Mean normalized band-width delta is ${formatCoverage(meanWidthDelta)}; the limit is ${formatCoverage(GENERIC_GEOMETRY_THRESHOLDS.maxMeanWidthDelta)}.`
    );
  }
  if (score < GENERIC_GEOMETRY_THRESHOLDS.minViewportScore) {
    genericGeometryError(
      result,
      'generic_geometry_score_shortfall',
      result.label,
      `Normalized page-depth, band geometry, coverage, and order score is ${score}; the acceptance minimum is ${GENERIC_GEOMETRY_THRESHOLDS.minViewportScore}.`
    );
  }

  return result;
}

function inspectGenericGeometryLayout(layout, side, label) {
  const errors = [];
  const viewport = layout && typeof layout === 'object' ? layout.viewport : null;
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  const scrollHeight = Number(viewport?.scrollHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(scrollHeight) || scrollHeight <= 0) {
    errors.push({
      code: `generic_geometry_${side}_viewport_invalid`,
      label,
      message: `${capitalizeGeometrySide(side)} layout evidence needs positive viewport width, height, and scrollHeight values.`,
    });
  }

  const completeness = layout?.evidenceCompleteness;
  const landmarkCounts = completeness?.categories?.landmarks;
  const completenessReasons = [];
  if (!completeness || completeness.complete !== true || completeness.status !== 'complete') {
    completenessReasons.push('capture is not marked complete');
  }
  if (completeness?.mode !== 'full-page') {
    completenessReasons.push('capture mode is not full-page');
  }
  if (completeness?.essentialGeometryTruncated === true) {
    completenessReasons.push('essential geometry was truncated');
  }
  if (!landmarkCounts || !Number.isFinite(landmarkCounts.total) || !Number.isFinite(landmarkCounts.retained)) {
    completenessReasons.push('landmark retention counts are missing');
  } else if (Number(landmarkCounts.truncated || 0) > 0 || landmarkCounts.retained !== landmarkCounts.total) {
    completenessReasons.push('landmark evidence is truncated');
  }
  if (completenessReasons.length > 0) {
    errors.push({
      code: `generic_geometry_${side}_evidence_incomplete`,
      label,
      message: `${capitalizeGeometrySide(side)} layout evidence is incomplete: ${completenessReasons.join('; ')}.`,
    });
  }

  if (!Array.isArray(layout?.landmarks)) {
    errors.push({
      code: `generic_geometry_${side}_landmarks_missing`,
      label,
      message: `${capitalizeGeometrySide(side)} layout JSON does not contain a landmarks array.`,
    });
  } else if (landmarkCounts && Number(landmarkCounts.retained) !== layout.landmarks.length) {
    errors.push({
      code: `generic_geometry_${side}_landmark_count_mismatch`,
      label,
      message: `${capitalizeGeometrySide(side)} landmark retention metadata does not match the captured landmarks array.`,
    });
  }

  if (errors.length > 0) {
    return {
      viewport: { width, height, scrollHeight },
      pageBackground: String(layout?.documentStyle?.backgroundColor || ''),
      bands: [],
      evidence: {
        complete: false,
        sourceLandmarks: Array.isArray(layout?.landmarks) ? layout.landmarks.length : 0,
        majorLandmarks: 0,
        collapsedLandmarks: 0,
      },
      errors,
    };
  }

  const extracted = extractMajorNormalFlowBands(layout);
  if (extracted.bands.length === 0) {
    errors.push({
      code: `generic_geometry_${side}_major_bands_missing`,
      label,
      message: `${capitalizeGeometrySide(side)} layout has no measurable normal-flow section/header/footer/nav bands.`,
    });
  }

  return {
    viewport: { width, height, scrollHeight },
    pageBackground: String(layout?.documentStyle?.backgroundColor || ''),
    bands: extracted.bands,
    evidence: {
      complete: errors.length === 0,
      sourceLandmarks: extracted.sourceLandmarks,
      majorLandmarks: extracted.majorLandmarks,
      collapsedLandmarks: extracted.collapsedLandmarks,
    },
    errors,
  };
}

function extractMajorNormalFlowBands(layout) {
  const viewportWidth = Number(layout.viewport.width);
  const viewportHeight = Number(layout.viewport.height);
  const scrollHeight = Number(layout.viewport.scrollHeight);
  const minimumHeight = Math.max(
    GENERIC_GEOMETRY_THRESHOLDS.minBandHeightPx,
    viewportHeight * GENERIC_GEOMETRY_THRESHOLDS.minBandHeightViewportRatio
  );
  const landmarks = Array.isArray(layout.landmarks) ? layout.landmarks : [];
  const meaningfulMedia = Array.isArray(layout.meaningfulMediaBoxes) ? layout.meaningfulMediaBoxes : [];
  const rawCandidates = landmarks.map((landmark, index) => {
    const tag = String(landmark?.tag || '').trim().toLowerCase();
    if (!GENERIC_GEOMETRY_MAJOR_TAGS.has(tag) || landmark?.flowParticipation === 'overlay') {
      return null;
    }

    const rect = geometryRect(landmark?.rect, scrollHeight);
    if (!rect || rect.height < minimumHeight) {
      return null;
    }
    const visibleWidth = Math.max(0, Math.min(viewportWidth, rect.right) - Math.max(0, rect.left));
    if (visibleWidth < viewportWidth * GENERIC_GEOMETRY_THRESHOLDS.minBandWidthRatio) {
      return null;
    }

    const sourceKey = String(landmark?.key || landmark?.groupKey || '');
    const hasFullBandMedia = meaningfulMedia.some((media) => {
      const mediaRect = geometryRect(media?.rect, scrollHeight);
      if (!mediaRect || mediaRect.width < rect.width * 0.9 || mediaRect.height < rect.height * 0.75) {
        return false;
      }
      const mediaKey = String(media?.structureKey || media?.parentGroupKey || '');
      const keyOwned = !sourceKey || (mediaKey && (mediaKey === sourceKey || mediaKey.startsWith(`${sourceKey}.`)));
      const overlapWidth = Math.max(0, Math.min(rect.right, mediaRect.right) - Math.max(rect.left, mediaRect.left));
      const overlapHeight = Math.max(0, Math.min(rect.bottom, mediaRect.bottom) - Math.max(rect.top, mediaRect.top));
      return keyOwned && overlapWidth * overlapHeight >= rect.width * rect.height * 0.65;
    });

    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      tags: [tag],
      sourceIndexes: [index],
      sourceKeys: sourceKey ? [sourceKey] : [],
      backgroundColor: String(landmark?.backgroundColor || ''),
      paintedBackground: landmark?.paintedBackground === true,
      hasFullBandMedia,
    };
  }).filter(Boolean);
  const candidates = rawCandidates.filter((candidate) => !rawCandidates.some((parent) => (
    parent !== candidate
    && parent.sourceKeys.length > 0
    && candidate.sourceKeys.length > 0
    && candidate.sourceKeys.some((candidateKey) => parent.sourceKeys.some((parentKey) => candidateKey.startsWith(`${parentKey}.`)))
    && candidate.top >= parent.top - 2
    && candidate.bottom <= parent.bottom + 2
    && candidate.left >= parent.left - 2
    && candidate.right <= parent.right + 2
  ))).sort((left, right) => (
    left.top - right.top
    || left.sourceIndexes[0] - right.sourceIndexes[0]
    || right.height - left.height
  ));
  const bands = [];

  for (const candidate of candidates) {
    let merged = false;
    for (let index = bands.length - 1; index >= 0; index -= 1) {
      if (!geometryBandsOverlapAsOne(bands[index], candidate)) {
        continue;
      }
      bands[index] = mergeGeometryBands(bands[index], candidate);
      merged = true;
      break;
    }
    if (!merged) {
      bands.push(candidate);
    }
  }

  bands.sort((left, right) => left.top - right.top || left.sourceIndexes[0] - right.sourceIndexes[0]);
  const layoutGroups = Array.isArray(layout.layoutGroups) ? layout.layoutGroups : [];
  for (const band of bands) {
    band.contentFrames = layoutGroups.map((group, index) => {
      if (group?.flowParticipation === 'overlay') {
        return null;
      }
      const rect = geometryRect(group?.rect, scrollHeight);
      if (!rect) {
        return null;
      }
      const groupKey = typeof group?.key === 'string' ? group.key : '';
      const linkedToLandmark = band.sourceKeys.length === 0
        || band.sourceKeys.some((sourceKey) => groupKey.startsWith(`${sourceKey}.`));
      const containmentTolerance = Math.max(3, Math.min(24, Math.max(rect.width, rect.height) * 0.02));
      const contained = rect.top >= band.top - containmentTolerance
        && rect.bottom <= band.bottom + containmentTolerance
        && rect.left >= band.left - containmentTolerance
        && rect.right <= band.right + containmentTolerance;
      const visiblyInset = rect.width < band.width - (viewportWidth * 0.02);
      if (!linkedToLandmark || !contained || !visiblyInset || rect.width < viewportWidth * GENERIC_GEOMETRY_THRESHOLDS.minBandWidthRatio) {
        return null;
      }
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        key: groupKey || `layout-group-${index}`,
        backgroundColor: String(group?.backgroundColor || ''),
        paintedBackground: group?.paintedBackground === true,
      };
    }).filter(Boolean);
    band.paintedSurfaces = layoutGroups.map((group, index) => {
      if (group?.flowParticipation === 'overlay' || group?.paintedBackground !== true) {
        return null;
      }
      const rect = geometryRect(group?.rect, scrollHeight);
      if (!rect) {
        return null;
      }
      const groupKey = typeof group?.key === 'string' ? group.key : '';
      const linkedToLandmark = band.sourceKeys.length === 0
        || band.sourceKeys.some((sourceKey) => groupKey.startsWith(`${sourceKey}.`));
      const containmentTolerance = Math.max(3, Math.min(24, Math.max(rect.width, rect.height) * 0.02));
      const contained = rect.top >= band.top - containmentTolerance
        && rect.bottom <= band.bottom + containmentTolerance
        && rect.left >= band.left - containmentTolerance
        && rect.right <= band.right + containmentTolerance;
      const viewportAreaRatio = (rect.width * rect.height) / Math.max(1, viewportWidth * viewportHeight);
      if (!linkedToLandmark
        || !contained
        || rect.width < viewportWidth * GENERIC_GEOMETRY_THRESHOLDS.minPaintedSurfaceWidthRatio
        || viewportAreaRatio < GENERIC_GEOMETRY_THRESHOLDS.minPaintedSurfaceAreaRatio) {
        return null;
      }
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        key: groupKey || `painted-layout-group-${index}`,
      };
    }).filter(Boolean);
  }
  return {
    sourceLandmarks: landmarks.length,
    majorLandmarks: candidates.length,
    collapsedLandmarks: candidates.length - bands.length,
    bands,
  };
}

function geometryRect(rect, scrollHeight) {
  if (!rect || typeof rect !== 'object' || Array.isArray(rect)) {
    return null;
  }

  const rawTop = Number.isFinite(Number(rect.top)) ? Number(rect.top) : Number(rect.y);
  const rawLeft = Number.isFinite(Number(rect.left)) ? Number(rect.left) : Number(rect.x);
  const rawWidth = Number(rect.width);
  const rawHeight = Number(rect.height);
  if (![rawTop, rawLeft, rawWidth, rawHeight].every(Number.isFinite) || rawWidth <= 0 || rawHeight <= 0) {
    return null;
  }

  const rawBottom = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : rawTop + rawHeight;
  const rawRight = Number.isFinite(Number(rect.right)) ? Number(rect.right) : rawLeft + rawWidth;
  const top = Math.max(0, rawTop);
  const bottom = Math.min(scrollHeight, rawBottom);
  if (bottom <= top || rawRight <= rawLeft) {
    return null;
  }

  return {
    top,
    bottom,
    left: rawLeft,
    right: rawRight,
    width: rawRight - rawLeft,
    height: bottom - top,
  };
}

function geometryBandsOverlapAsOne(left, right) {
  const verticalOverlap = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  const horizontalOverlap = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const verticalRatio = verticalOverlap / Math.max(1, Math.min(left.height, right.height));
  const horizontalRatio = horizontalOverlap / Math.max(1, Math.min(left.width, right.width));
  return verticalRatio >= GENERIC_GEOMETRY_THRESHOLDS.overlapCollapseRatio
    && horizontalRatio >= GENERIC_GEOMETRY_THRESHOLDS.minBandWidthRatio;
}

function mergeGeometryBands(left, right) {
  const top = Math.min(left.top, right.top);
  const bottom = Math.max(left.bottom, right.bottom);
  const leftEdge = Math.min(left.left, right.left);
  const rightEdge = Math.max(left.right, right.right);
  return {
    top,
    bottom,
    left: leftEdge,
    right: rightEdge,
    width: rightEdge - leftEdge,
    height: bottom - top,
    tags: [...new Set([...left.tags, ...right.tags])].sort(),
    sourceIndexes: [...left.sourceIndexes, ...right.sourceIndexes].sort((first, second) => first - second),
    sourceKeys: [...new Set([...(left.sourceKeys || []), ...(right.sourceKeys || [])])],
    backgroundColor: left.backgroundColor || right.backgroundColor || '',
    paintedBackground: left.paintedBackground === true || right.paintedBackground === true,
    hasFullBandMedia: left.hasFullBandMedia === true || right.hasFullBandMedia === true,
  };
}

function normalizeGeometryBands(bands, scrollHeight, viewportWidth, referencePageBackground) {
  return bands.map((band, index) => ({
    index,
    tags: band.tags,
    sourceIndexes: band.sourceIndexes,
    top: band.top / scrollHeight,
    height: band.height / scrollHeight,
    width: band.width / viewportWidth,
    geometrySource: 'landmark',
    backgroundColor: String(band.backgroundColor || ''),
    paintedBackground: band.paintedBackground === true,
    hasFullBandMedia: band.hasFullBandMedia === true,
    referencePageBackground: String(referencePageBackground || ''),
    contentFrames: (band.contentFrames || []).map((frame) => ({
      top: frame.top / scrollHeight,
      height: frame.height / scrollHeight,
      width: frame.width / viewportWidth,
      geometrySource: `layoutGroup:${frame.key}`,
      backgroundColor: String(frame.backgroundColor || ''),
      paintedBackground: frame.paintedBackground === true,
    })),
    paintedSurfaces: (band.paintedSurfaces || []).map((surface) => ({
      centerX: (surface.left + (surface.width / 2)) / viewportWidth,
      top: surface.top / scrollHeight,
      width: surface.width / viewportWidth,
      height: surface.height / viewportWidth,
      geometrySource: `layoutGroup:${surface.key}`,
    })),
  }));
}

function matchPaintedGeometrySurfaces(referenceSurfaces, candidateSurfaces) {
  const availableCandidates = new Set(candidateSurfaces.map((_, index) => index));
  const matched = [];
  const missing = [];

  for (const reference of [...referenceSurfaces].sort((left, right) => right.width * right.height - left.width * left.height)) {
    const candidates = [...availableCandidates].map((index) => {
      const candidate = candidateSurfaces[index];
      const deltas = {
        centerX: Math.abs(reference.centerX - candidate.centerX),
        top: Math.abs(reference.top - candidate.top),
        width: Math.abs(reference.width - candidate.width),
        height: Math.abs(reference.height - candidate.height),
      };
      return { index, candidate, deltas, cost: Object.values(deltas).reduce((total, delta) => total + delta, 0) };
    }).filter(({ deltas }) => (
      deltas.centerX <= GENERIC_GEOMETRY_THRESHOLDS.maxPaintedSurfaceCenterXDelta
      && deltas.top <= GENERIC_GEOMETRY_THRESHOLDS.maxPaintedSurfaceTopDelta
      && deltas.width <= GENERIC_GEOMETRY_THRESHOLDS.maxPaintedSurfaceWidthDelta
      && deltas.height <= GENERIC_GEOMETRY_THRESHOLDS.maxPaintedSurfaceHeightDelta
    )).sort((left, right) => left.cost - right.cost);

    if (candidates.length === 0) {
      missing.push(reference);
      continue;
    }

    const closest = candidates[0];
    availableCandidates.delete(closest.index);
    matched.push({ reference, candidate: closest.candidate });
  }

  return { matched, missing };
}

function selectCandidateGeometryBand(referenceBand, candidateBand) {
  if (
    referenceBand.width > GENERIC_GEOMETRY_THRESHOLDS.contentFrameReferenceMaxWidth
    || candidateBand.width < GENERIC_GEOMETRY_THRESHOLDS.contentFrameCandidateMinWidth
  ) {
    return candidateBand;
  }

  const normalizedOuterColor = candidateBand.backgroundColor.toLowerCase().replace(/\s+/g, '');
  const normalizedReferencePageColor = referenceBand.referencePageBackground.toLowerCase().replace(/\s+/g, '');
  const outerIsTransparent = normalizedOuterColor === 'transparent'
    || /^rgba\([^,]+,[^,]+,[^,]+,0(?:\.0+)?\)$/u.test(normalizedOuterColor);
  const outerMatchesReferencePage = normalizedOuterColor !== ''
    && normalizedReferencePageColor !== ''
    && normalizedOuterColor === normalizedReferencePageColor;
  if (candidateBand.hasFullBandMedia || (!outerIsTransparent && !outerMatchesReferencePage)) {
    return candidateBand;
  }

  const eligibleFrames = candidateBand.contentFrames.filter((frame) => (
    Math.abs(referenceBand.top - frame.top) <= GENERIC_GEOMETRY_THRESHOLDS.contentFrameMaxTopDelta
    && Math.abs(referenceBand.height - frame.height) <= GENERIC_GEOMETRY_THRESHOLDS.contentFrameMaxHeightDelta
    && Math.abs(referenceBand.width - frame.width) <= GENERIC_GEOMETRY_THRESHOLDS.contentFrameMaxWidthDelta
    && (!referenceBand.paintedBackground || frame.paintedBackground)
  ));
  if (eligibleFrames.length === 0) {
    return candidateBand;
  }

  return eligibleFrames.reduce((closest, frame) => {
    const closestDelta = Math.abs(referenceBand.top - closest.top)
      + Math.abs(referenceBand.height - closest.height)
      + Math.abs(referenceBand.width - closest.width);
    const frameDelta = Math.abs(referenceBand.top - frame.top)
      + Math.abs(referenceBand.height - frame.height)
      + Math.abs(referenceBand.width - frame.width);
    return frameDelta < closestDelta ? frame : closest;
  });
}

function alignGeometryBands(referenceBands, candidateBands) {
  const referenceCount = referenceBands.length;
  const candidateCount = candidateBands.length;
  const costs = Array.from({ length: referenceCount + 1 }, () => new Float64Array(candidateCount + 1));
  const trace = Array.from({ length: referenceCount + 1 }, () => new Uint8Array(candidateCount + 1));

  for (let referenceIndex = 1; referenceIndex <= referenceCount; referenceIndex += 1) {
    costs[referenceIndex][0] = referenceIndex * GENERIC_GEOMETRY_THRESHOLDS.alignmentGapCost;
    trace[referenceIndex][0] = 1;
  }
  for (let candidateIndex = 1; candidateIndex <= candidateCount; candidateIndex += 1) {
    costs[0][candidateIndex] = candidateIndex * GENERIC_GEOMETRY_THRESHOLDS.alignmentGapCost;
    trace[0][candidateIndex] = 2;
  }

  for (let referenceIndex = 1; referenceIndex <= referenceCount; referenceIndex += 1) {
    for (let candidateIndex = 1; candidateIndex <= candidateCount; candidateIndex += 1) {
      const paired = costs[referenceIndex - 1][candidateIndex - 1]
        + geometryBandAlignmentCost(referenceBands[referenceIndex - 1], candidateBands[candidateIndex - 1]);
      const missing = costs[referenceIndex - 1][candidateIndex] + GENERIC_GEOMETRY_THRESHOLDS.alignmentGapCost;
      const extra = costs[referenceIndex][candidateIndex - 1] + GENERIC_GEOMETRY_THRESHOLDS.alignmentGapCost;
      if (paired <= missing && paired <= extra) {
        costs[referenceIndex][candidateIndex] = paired;
        trace[referenceIndex][candidateIndex] = 0;
      } else if (missing <= extra) {
        costs[referenceIndex][candidateIndex] = missing;
        trace[referenceIndex][candidateIndex] = 1;
      } else {
        costs[referenceIndex][candidateIndex] = extra;
        trace[referenceIndex][candidateIndex] = 2;
      }
    }
  }

  const pairs = [];
  const missing = [];
  const extra = [];
  let referenceIndex = referenceCount;
  let candidateIndex = candidateCount;
  while (referenceIndex > 0 || candidateIndex > 0) {
    const operation = trace[referenceIndex][candidateIndex];
    if (referenceIndex > 0 && candidateIndex > 0 && operation === 0) {
      pairs.push({ referenceIndex: referenceIndex - 1, candidateIndex: candidateIndex - 1 });
      referenceIndex -= 1;
      candidateIndex -= 1;
    } else if (referenceIndex > 0 && (candidateIndex === 0 || operation === 1)) {
      missing.push(referenceIndex - 1);
      referenceIndex -= 1;
    } else {
      extra.push(candidateIndex - 1);
      candidateIndex -= 1;
    }
  }

  pairs.reverse();
  missing.reverse();
  extra.reverse();
  return { pairs, missing, extra };
}

function geometryBandAlignmentCost(referenceBand, candidateBand) {
  const top = Math.min(2, Math.abs(referenceBand.top - candidateBand.top) / GENERIC_GEOMETRY_THRESHOLDS.alignmentTopScale);
  const height = Math.min(2, Math.abs(referenceBand.height - candidateBand.height) / GENERIC_GEOMETRY_THRESHOLDS.alignmentHeightScale);
  const width = Math.min(2, Math.abs(referenceBand.width - candidateBand.width) / GENERIC_GEOMETRY_THRESHOLDS.alignmentWidthScale);
  const tagPenalty = geometryBandTagsOverlap(referenceBand, candidateBand) ? 0 : 0.2;
  return (top * 0.45) + (height * 0.35) + (width * 0.2) + tagPenalty;
}

function findReorderedGeometryBands(referenceBands, candidateBands) {
  const matches = [];
  for (let referenceIndex = 0; referenceIndex < referenceBands.length; referenceIndex += 1) {
    const candidateMatch = closestGeometryShape(referenceBands[referenceIndex], candidateBands);
    if (!candidateMatch || candidateMatch.distance > GENERIC_GEOMETRY_THRESHOLDS.reorderShapeMaxDelta || candidateMatch.ambiguous) {
      continue;
    }
    const referenceMatch = closestGeometryShape(candidateBands[candidateMatch.index], referenceBands);
    if (!referenceMatch || referenceMatch.index !== referenceIndex || referenceMatch.ambiguous) {
      continue;
    }
    matches.push({
      referenceIndex,
      candidateIndex: candidateMatch.index,
      shapeDelta: roundGeometry(candidateMatch.distance, 4),
    });
  }

  const pairs = [];
  for (let first = 0; first < matches.length; first += 1) {
    for (let second = first + 1; second < matches.length; second += 1) {
      if (matches[first].candidateIndex > matches[second].candidateIndex) {
        pairs.push({ first: matches[first], second: matches[second] });
      }
    }
  }

  return { inversions: pairs.length, pairs: pairs.slice(0, 12) };
}

function closestGeometryShape(sourceBand, candidateBands) {
  const distances = candidateBands.map((candidate, index) => ({
    index,
    distance: geometryBandShapeDistance(sourceBand, candidate),
  })).sort((left, right) => left.distance - right.distance || left.index - right.index);
  if (distances.length === 0) {
    return null;
  }

  return {
    ...distances[0],
    ambiguous: distances.length > 1
      && distances[1].distance - distances[0].distance < GENERIC_GEOMETRY_THRESHOLDS.reorderAmbiguityMargin,
  };
}

function geometryBandShapeDistance(referenceBand, candidateBand) {
  const height = Math.abs(referenceBand.height - candidateBand.height);
  const width = Math.abs(referenceBand.width - candidateBand.width);
  const tagPenalty = geometryBandTagsOverlap(referenceBand, candidateBand) ? 0 : 0.05;
  return (height * 0.75) + (width * 0.25) + tagPenalty;
}

function geometryBandTagsOverlap(referenceBand, candidateBand) {
  const candidateTags = new Set(candidateBand.tags);
  return referenceBand.tags.some((tag) => candidateTags.has(tag));
}

function geometryBandSummary(band, index) {
  return {
    index,
    tags: band.tags,
    top: roundGeometry(band.top, 4),
    height: roundGeometry(band.height, 4),
    width: roundGeometry(band.width, 4),
  };
}

function formatGeometryBandList(bands) {
  if (!Array.isArray(bands) || bands.length === 0) {
    return 'none';
  }
  return bands.map((band) => `#${band.index + 1} ${band.tags.join('+')} at ${formatCoverage(band.top)}`).join(', ');
}

function symmetricGeometryDelta(reference, candidate) {
  return Math.abs(reference - candidate) / Math.max(reference, candidate, 1);
}

function geometryMean(values, emptyValue = 0) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : emptyValue;
}

function geometrySimilarity(delta, scale) {
  return 1 - Math.min(1, delta / scale);
}

function roundGeometry(value, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function capitalizeGeometrySide(side) {
  return `${side.charAt(0).toUpperCase()}${side.slice(1)}`;
}

function genericGeometryError(report, code, label, message) {
  report.errors.push({ code, label, message });
}

function auditCaregloMechanics(referenceLayouts, candidateLayouts) {
  const report = {
    ok: true,
    skipped: false,
    family: 'careglo',
    errors: [],
    warnings: [],
    stats: {},
  };
  const referenceDesktop = referenceLayouts.desktop;
  const candidateDesktop = candidateLayouts.desktop;
  const referenceMobile = referenceLayouts.mobile;
  const candidateMobile = candidateLayouts.mobile;

  compareNavCta(report, referenceDesktop, candidateDesktop);
  compareCaregloNavLinks(report, referenceDesktop, candidateDesktop);
  compareHeroMediaBox(report, referenceDesktop, candidateDesktop);
  compareSecondaryMediaBox(report, referenceDesktop, candidateDesktop);
  compareMobileHeading(report, referenceMobile, candidateMobile);
  report.ok = report.errors.length === 0;
  return report;
}

function compareNavCta(report, referenceLayout, candidateLayout) {
  const primaryCtaPattern = /^(?:make appointment|book (?:an? )?(?:appointment|visit|service)|reserve (?:a |your )?(?:visit|slot|detail))$/i;
  const fallbackCtaPattern = /^contact(?: us)?$/i;
  const reference = rightmostTextBox(referenceLayout, primaryCtaPattern) || rightmostTextBox(referenceLayout, fallbackCtaPattern);
  const candidate = rightmostTextBox(candidateLayout, primaryCtaPattern) || rightmostTextBox(candidateLayout, fallbackCtaPattern);
  if (!reference || !candidate) {
    mechanicsError(report, 'careglo_nav_cta_missing', 'desktop', 'Careglo mechanics require a first-viewport appointment CTA in the nav.');
    return;
  }

  const referenceGap = Math.round(referenceLayout.viewport.width - rectRight(reference));
  const candidateGap = Math.round(candidateLayout.viewport.width - rectRight(candidate));
  report.stats.navCtaRightGap = { reference: referenceGap, candidate: candidateGap };

  if (candidateGap > referenceGap + 120) {
    mechanicsError(
      report,
      'careglo_nav_cta_underextended',
      'desktop',
      `Candidate nav CTA ends ${candidateGap}px from the right edge; reference ends ${referenceGap}px from the right edge. Preserve the wide header distribution before treating the page as Careglo-like.`
    );
  }
}

function compareCaregloNavLinks(report, referenceLayout, candidateLayout) {
  const navLinkPattern = /^(?:Home|Services)$/i;
  const reference = firstTextBox(referenceLayout, navLinkPattern);
  const candidate = firstTextBox(candidateLayout, navLinkPattern);
  if (!reference || !candidate) {
    mechanicsError(report, 'careglo_nav_links_missing', 'desktop', 'Careglo mechanics require desktop navigation links between the logo and appointment CTA.');
    return;
  }

  report.stats.navLinks = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };

  if (candidate.rect.x > reference.rect.x + 90) {
    mechanicsError(
      report,
      'careglo_nav_links_position_mismatch',
      'desktop',
      `Candidate desktop nav links start at ${Math.round(candidate.rect.x)}px; reference starts at ${Math.round(reference.rect.x)}px. Preserve the Careglo header rhythm instead of leaving centered generic nav text.`
    );
  }

  if (candidate.rect.height < reference.rect.height * 0.7) {
    mechanicsError(
      report,
      'careglo_nav_links_hit_area_mismatch',
      'desktop',
      `Candidate desktop nav link height is ${Math.round(candidate.rect.height)}px; reference link height is ${Math.round(reference.rect.height)}px. Use contract-backed Text padding/display props for real nav hit areas, not bare text labels.`
    );
  }
}

function compareHeroMediaBox(report, referenceLayout, candidateLayout) {
  const reference = largestFirstViewportMedia(referenceLayout);
  const candidate = largestFirstViewportMedia(candidateLayout);
  if (!reference || !candidate) {
    mechanicsError(report, 'careglo_hero_media_missing', 'desktop', 'Careglo mechanics require a large first-viewport hero media surface.');
    return;
  }

  report.stats.heroMedia = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };

  if (Math.abs(candidate.rect.x - reference.rect.x) > 90 || Math.abs(candidate.rect.y - reference.rect.y) > 90) {
    mechanicsError(
      report,
      'careglo_hero_media_position_mismatch',
      'desktop',
      'Candidate hero media is not anchored near the captured Careglo hero media position.'
    );
  }
  if (candidate.rect.width < reference.rect.width * 0.82 || candidate.rect.height < reference.rect.height * 0.82) {
    mechanicsError(
      report,
      'careglo_hero_media_scale_mismatch',
      'desktop',
      'Candidate hero media is too small for the captured Careglo first viewport.'
    );
  }
}

function compareSecondaryMediaBox(report, referenceLayout, candidateLayout) {
  let reference = firstMediaNear(referenceLayout, 24, 790, 260, 240);
  let candidate = firstMediaNear(candidateLayout, 20, 760, 280, 260);
  if (!reference) {
    const referenceHero = largestFirstViewportMedia(referenceLayout);
    const candidateHero = largestFirstViewportMedia(candidateLayout);
    reference = (referenceLayout?.mediaBoxes || [])
      .filter((box) => box !== referenceHero && Number(box?.firstViewportArea || 0) > 0)
      .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;
    candidate = (candidateLayout?.mediaBoxes || [])
      .filter((box) => box !== candidateHero && Number(box?.firstViewportArea || 0) > 0)
      .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;
  }
  if (!reference || !candidate) {
    mechanicsError(report, 'careglo_secondary_proof_missing', 'desktop', 'Careglo mechanics require the secondary proof/detail image visible in the hero viewport.');
    return;
  }

  report.stats.secondaryProofMedia = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };

  if (candidate.rect.height < reference.rect.height * 0.8) {
    mechanicsError(
      report,
      'careglo_secondary_proof_scale_mismatch',
      'desktop',
      'Candidate proof/detail image is too short compared with the captured Careglo proof image.'
    );
  }
}

function compareMobileHeading(report, referenceLayout, candidateLayout) {
  if (!referenceLayout || !candidateLayout) {
    mechanicsWarning(report, 'careglo_mobile_layout_missing', 'mobile', 'Mobile layout evidence is missing, so mobile Careglo mechanics could not be checked.');
    return;
  }

  const reference = combinedTextBox(referenceLayout, (box) => String(box?.tag || '').toLowerCase() === 'h1', 80, Number(referenceLayout?.viewport?.height || 844) * 0.72)
    || (referenceLayout?.textBoxes || [])
      .filter((box) => Number(box?.rect?.top || 0) >= 100 && Number(box?.rect?.top || 0) < Number(referenceLayout?.viewport?.height || 844))
      .sort((a, b) => (Number(b?.rect?.height || 0) * Number(b?.rect?.width || 0)) - (Number(a?.rect?.height || 0) * Number(a?.rect?.width || 0)))[0]
    || null;
  const candidate = combinedTextBox(candidateLayout, (box) => String(box?.tag || '').toLowerCase() === 'h1', 80, Number(candidateLayout?.viewport?.height || 844) * 0.72)
    || (candidateLayout?.textBoxes || [])
      .filter((box) => Number(box?.rect?.top || 0) >= 100 && Number(box?.rect?.top || 0) < Number(candidateLayout?.viewport?.height || 844))
      .sort((a, b) => (Number(b?.rect?.height || 0) * Number(b?.rect?.width || 0)) - (Number(a?.rect?.height || 0) * Number(a?.rect?.width || 0)))[0]
    || null;
  if (!reference || !candidate) {
    mechanicsError(report, 'careglo_mobile_heading_missing', 'mobile', 'Careglo mobile mechanics require the main hero heading.');
    return;
  }

  report.stats.mobileHeading = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };

  if (candidate.rect.height < reference.rect.height * 0.62) {
    mechanicsError(
      report,
      'careglo_mobile_heading_wrap_mismatch',
      'mobile',
      'Candidate mobile hero heading is much more compressed than the reference. This usually needs responsive text alignment/wrap controls such as textAlignMobile plus mobile typography tuning.'
    );
  }
}

function comparePageDepth(report, referenceLayout, candidateLayout, label) {
  const referenceHeight = Number(referenceLayout?.viewport?.scrollHeight || 0);
  const candidateHeight = Number(candidateLayout?.viewport?.scrollHeight || 0);
  if (referenceHeight <= 0 || candidateHeight <= 0) {
    return;
  }

  const ratio = candidateHeight / referenceHeight;
  report.stats.pageDepth = report.stats.pageDepth || {};
  report.stats.pageDepth[label] = { reference: referenceHeight, candidate: candidateHeight, ratio };
  if (candidateHeight < referenceHeight * TEMPLATE_PAGE_DEPTH_MIN_RATIO) {
    const family = String(report.family || 'candidate');
    mechanicsError(
      report,
      `${family}_page_depth_shortfall`,
      label,
      `Candidate page scroll height (${candidateHeight}px) is much shorter than the captured reference (${referenceHeight}px). Reproduce more of the homepage sections before claiming full-template fidelity.`
    );
  }
}

function auditMaidyMechanics(referenceLayouts, candidateLayouts) {
  const report = {
    ok: true,
    skipped: false,
    family: 'maidy',
    errors: [],
    warnings: [],
    stats: {},
  };
  const referenceDesktop = referenceLayouts.desktop;
  const candidateDesktop = candidateLayouts.desktop;
  const referenceTablet = referenceLayouts.tablet;
  const candidateTablet = candidateLayouts.tablet;
  const referenceMobile = referenceLayouts.mobile;
  const candidateMobile = candidateLayouts.mobile;

  compareMaidyTopbar(report, referenceDesktop, candidateDesktop);
  compareMaidyNavContact(report, referenceDesktop, candidateDesktop);
  compareMaidyRightHeroMedia(report, referenceDesktop, candidateDesktop);
  compareMaidyEquipmentMedia(report, referenceDesktop, candidateDesktop);
  compareMaidyLogoStrip(report, referenceDesktop, candidateDesktop);
  compareMaidyTabletHeroRhythm(report, referenceTablet, candidateTablet);
  compareMaidyMobileHeading(report, referenceMobile, candidateMobile);
  report.ok = report.errors.length === 0;
  return report;
}

function compareMaidyTopbar(report, referenceLayout, candidateLayout) {
  const reference = darkTopBand(referenceLayout, 80);
  const candidate = darkTopBand(candidateLayout, 80);
  report.stats.topbar = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (reference && !candidate) {
    mechanicsError(report, 'maidy_topbar_missing', 'desktop', 'Maidy mechanics require a dark full-width contact/social topbar above the white navigation row.');
  }
}

function compareMaidyNavContact(report, referenceLayout, candidateLayout) {
  const reference = rightmostTextBox(referenceLayout, /^Contact$/i);
  const candidate = rightmostTextBox(candidateLayout, /^Contact$/i);
  if (!reference || !candidate) {
    mechanicsError(report, 'maidy_nav_contact_missing', 'desktop', 'Maidy mechanics require the desktop nav contact CTA.');
    return;
  }

  const referenceGap = Math.round(referenceLayout.viewport.width - rectRight(reference));
  const candidateGap = Math.round(candidateLayout.viewport.width - rectRight(candidate));
  report.stats.navContactRightGap = { reference: referenceGap, candidate: candidateGap };
  if (Math.abs(candidateGap - referenceGap) > 180) {
    mechanicsError(
      report,
      'maidy_nav_contact_position_mismatch',
      'desktop',
      `Candidate nav contact CTA ends ${candidateGap}px from the right edge; reference ends ${referenceGap}px from the right edge. Preserve the separate Maidy nav row and right CTA pressure.`
    );
  }
}

function compareMaidyRightHeroMedia(report, referenceLayout, candidateLayout) {
  const reference = rightHeroMedia(referenceLayout);
  const candidate = rightHeroMedia(candidateLayout);
  report.stats.rightHeroMedia = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'maidy_right_hero_media_missing', 'desktop', 'Maidy mechanics require a tall right-side cleaner/person hero visual, not only a background or small card image.');
    return;
  }
  if (candidate.rect.height < reference.rect.height * 0.72 || candidate.rect.width < reference.rect.width * 0.66) {
    mechanicsError(
      report,
      'maidy_right_hero_media_scale_mismatch',
      'desktop',
      'Candidate right-side hero cleaner visual is too small compared with the captured Maidy reference.'
    );
  }
}

function compareMaidyEquipmentMedia(report, referenceLayout, candidateLayout) {
  const reference = lowerLeftEquipmentMedia(referenceLayout);
  const candidate = lowerLeftEquipmentMedia(candidateLayout);
  report.stats.equipmentMedia = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (reference && !candidate) {
    mechanicsError(report, 'maidy_equipment_media_missing', 'desktop', 'Maidy mechanics require the lower-left equipment/vacuum visual in the hero viewport.');
  }
}

function compareMaidyLogoStrip(report, referenceLayout, candidateLayout) {
  const reference = darkBandNear(referenceLayout, Number(referenceLayout?.viewport?.height || 1200) * 0.65, Number(referenceLayout?.viewport?.height || 1200) * 1.08);
  const candidate = darkBandNear(candidateLayout, Number(candidateLayout?.viewport?.height || 1200) * 0.65, Number(candidateLayout?.viewport?.height || 1200) * 1.08);
  report.stats.logoStrip = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (reference && !candidate) {
    mechanicsError(report, 'maidy_logo_strip_missing', 'desktop', 'Maidy mechanics require the dark partner/logo strip immediately after the hero.');
  }
}

function compareMaidyTabletHeroRhythm(report, referenceLayout, candidateLayout) {
  if (!referenceLayout || !candidateLayout) {
    mechanicsWarning(report, 'maidy_tablet_layout_missing', 'tablet', 'Tablet layout evidence is missing, so Maidy tablet hero rhythm could not be checked.');
    return;
  }

  const reference = largestFirstViewportMedia(referenceLayout);
  const candidate = largestFirstViewportMedia(candidateLayout);
  report.stats.tabletHeroRhythm = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsWarning(report, 'maidy_tablet_hero_media_missing', 'tablet', 'Tablet hero media evidence is missing, so Maidy tablet hero rhythm could not be checked.');
    return;
  }

  const referenceTop = Number(reference.rect?.top ?? reference.rect?.y ?? 0);
  const candidateTop = Number(candidate.rect?.top ?? candidate.rect?.y ?? 0);
  const referenceHeight = Number(reference.rect?.height || 0);
  const candidateHeight = Number(candidate.rect?.height || 0);
  if (candidateTop > referenceTop + 100 || candidateHeight > referenceHeight * 1.25) {
    mechanicsError(
      report,
      'maidy_tablet_hero_rhythm_mismatch',
      'tablet',
      `Candidate tablet hero starts at ${Math.round(candidateTop)}px and is ${Math.round(candidateHeight)}px tall; reference starts at ${Math.round(referenceTop)}px and is ${Math.round(referenceHeight)}px tall. Preserve Maidy's tablet first-viewport hero rhythm instead of letting stacked copy/media push the partner strip down.`
    );
  }
}

function compareMaidyMobileHeading(report, referenceLayout, candidateLayout) {
  if (!referenceLayout || !candidateLayout) {
    mechanicsWarning(report, 'maidy_mobile_layout_missing', 'mobile', 'Mobile layout evidence is missing, so mobile Maidy mechanics could not be checked.');
    return;
  }
  const reference = combinedTextBox(referenceLayout, (box) => String(box?.tag || '').toLowerCase() === 'h1', 80, Number(referenceLayout?.viewport?.height || 844) * 0.72)
    || (referenceLayout?.textBoxes || [])
      .filter((box) => Number(box?.rect?.top || 0) >= 80 && Number(box?.rect?.top || 0) < Number(referenceLayout?.viewport?.height || 844) * 0.72)
      .filter((box) => Number(box?.rect?.width || 0) >= 180 && Number(box?.rect?.height || 0) >= 44)
      .sort((a, b) => (Number(b?.rect?.height || 0) * Number(b?.rect?.width || 0)) - (Number(a?.rect?.height || 0) * Number(a?.rect?.width || 0)))[0]
    || null;
  const candidate = combinedTextBox(candidateLayout, (box) => String(box?.tag || '').toLowerCase() === 'h1', 80, Number(candidateLayout?.viewport?.height || 844) * 0.72)
    || (candidateLayout?.textBoxes || [])
      .filter((box) => Number(box?.rect?.top || 0) >= 80 && Number(box?.rect?.top || 0) < Number(candidateLayout?.viewport?.height || 844) * 0.72)
      .filter((box) => Number(box?.rect?.width || 0) >= 180 && Number(box?.rect?.height || 0) >= 44)
      .sort((a, b) => (Number(b?.rect?.height || 0) * Number(b?.rect?.width || 0)) - (Number(a?.rect?.height || 0) * Number(a?.rect?.width || 0)))[0]
    || null;
  if (!reference || !candidate) {
    mechanicsWarning(report, 'maidy_mobile_heading_missing', 'mobile', 'Maidy mobile hero heading geometry could not be identified; inspect mobile screenshots manually.');
    return;
  }

  report.stats.mobileHeading = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };
  if (candidate.rect.height < reference.rect.height * 0.68) {
    mechanicsError(report, 'maidy_mobile_heading_wrap_mismatch', 'mobile', 'Candidate mobile Maidy heading is much more compressed than the captured reference.');
  }
}

function auditOptomattaMechanics(referenceLayouts, candidateLayouts) {
  const report = {
    ok: true,
    skipped: false,
    family: 'optomatta',
    errors: [],
    warnings: [],
    stats: {},
  };
  const referenceDesktop = referenceLayouts.desktop;
  const candidateDesktop = candidateLayouts.desktop;
  const referenceMobile = referenceLayouts.mobile;
  const candidateMobile = candidateLayouts.mobile;

  compareOptomattaHeader(report, referenceDesktop, candidateDesktop);
  compareOptomattaPhoneCta(report, referenceDesktop, candidateDesktop);
  compareOptomattaHeroMedia(report, referenceDesktop, candidateDesktop);
  compareOptomattaHeroHeading(report, referenceDesktop, candidateDesktop);
  compareOptomattaProofStrip(report, referenceDesktop, candidateDesktop);
  compareOptomattaMobileHeading(report, referenceMobile, candidateMobile);
  report.ok = report.errors.length === 0;
  return report;
}

function compareOptomattaHeader(report, referenceLayout, candidateLayout) {
  const reference = lightTopBand(referenceLayout, 130);
  const candidate = lightTopBand(candidateLayout, 130);
  report.stats.headerBand = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (reference && !candidate) {
    mechanicsError(report, 'optomatta_header_band_missing', 'desktop', 'Optomatta mechanics require a bright full-width header band before the hero.');
  }
}

function compareOptomattaPhoneCta(report, referenceLayout, candidateLayout) {
  const semanticCtaPattern = /(?:\+?\d[\d\s().-]{6,}\d|\b(?:call|phone|telephone)\b|\b(?:book|schedule|reserve|request)\b.{0,48}\b(?:eye|exam|appointment|visit|consult(?:ation)?|clinic)\b|\b(?:eye|exam|appointment|visit|consult(?:ation)?|clinic)\b.{0,48}\b(?:book|schedule|reserve|request)\b)/i;
  const referenceWidth = Number(referenceLayout?.viewport?.width || 0);
  const candidateWidth = Number(candidateLayout?.viewport?.width || 0);
  const reference = rightmostTextBox(referenceLayout, /\S/, (box) => {
    const tag = String(box?.tag || '').toLowerCase();
    return (tag === 'a' || tag === 'button')
      && Number(box?.rect?.top ?? box?.rect?.y ?? 0) <= 150
      && rectRight(box) >= referenceWidth * 0.55
      && (semanticCtaPattern.test(String(box?.text || ''))
        || (Number(box?.rect?.width || 0) >= 90 && Number(box?.rect?.height || 0) >= 28));
  });
  const candidate = rightmostTextBox(candidateLayout, /\S/, (box) => {
    const tag = String(box?.tag || '').toLowerCase();
    return (tag === 'a' || tag === 'button')
      && Number(box?.rect?.top ?? box?.rect?.y ?? 0) <= 150
      && rectRight(box) >= candidateWidth * 0.55
      && (semanticCtaPattern.test(String(box?.text || ''))
        || (Number(box?.rect?.width || 0) >= 90 && Number(box?.rect?.height || 0) >= 28));
  });
  if (!reference || !candidate) {
    mechanicsError(report, 'optomatta_phone_cta_missing', 'desktop', 'Optomatta mechanics require a semantic call, phone, or eye-appointment CTA at the far right of the desktop header.');
    return;
  }

  const referenceGap = Math.round(referenceLayout.viewport.width - rectRight(reference));
  const candidateGap = Math.round(candidateLayout.viewport.width - rectRight(candidate));
  report.stats.phoneCtaRightGap = { reference: referenceGap, candidate: candidateGap };
  report.stats.phoneCta = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };
  const referenceTop = Number(reference.rect?.top ?? reference.rect?.y ?? 0);
  const candidateTop = Number(candidate.rect?.top ?? candidate.rect?.y ?? 0);
  if (Math.abs(candidateGap - referenceGap) > 150 || Math.abs(candidateTop - referenceTop) > 64) {
    mechanicsError(
      report,
      'optomatta_phone_cta_position_mismatch',
      'desktop',
      `Candidate phone CTA ends ${candidateGap}px from the right edge at ${Math.round(candidateTop)}px from the top; reference ends ${referenceGap}px from the right edge at ${Math.round(referenceTop)}px. Preserve the Optomatta retail header distribution.`
    );
  }
  if (
    Number(candidate.rect?.width || 0) < Number(reference.rect?.width || 0) * 0.55
    || Number(candidate.rect?.width || 0) > Number(reference.rect?.width || 0) * 1.65
    || Number(candidate.rect?.height || 0) < Number(reference.rect?.height || 0) * 0.6
    || Number(candidate.rect?.height || 0) > Number(reference.rect?.height || 0) * 1.5
  ) {
    mechanicsError(report, 'optomatta_phone_cta_scale_mismatch', 'desktop', 'Candidate phone CTA dimensions do not preserve the captured Optomatta header CTA geometry.');
  }
}

function compareOptomattaHeroMedia(report, referenceLayout, candidateLayout) {
  const reference = largestFirstViewportMedia(referenceLayout);
  const candidate = largestFirstViewportMedia(candidateLayout);
  report.stats.heroMedia = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'optomatta_hero_media_missing', 'desktop', 'Optomatta mechanics require a full-width optical hero photo/background.');
    return;
  }

  if (Math.abs(Number(candidate.rect.y || 0) - Number(reference.rect.y || 0)) > 100 || Number(candidate.rect.x || 0) > Number(reference.rect.x || 0) + 90) {
    mechanicsError(
      report,
      'optomatta_hero_media_position_mismatch',
      'desktop',
      'Candidate hero media is not anchored like the captured Optomatta first viewport.'
    );
  }
  if (candidate.rect.width < reference.rect.width * 0.82 || candidate.rect.height < reference.rect.height * 0.72) {
    mechanicsError(
      report,
      'optomatta_hero_media_scale_mismatch',
      'desktop',
      'Candidate hero media is too small for the captured Optomatta full-width optical hero.'
    );
  }
}

function compareOptomattaHeroHeading(report, referenceLayout, candidateLayout) {
  const reference = optomattaHeroHeading(referenceLayout);
  const candidate = optomattaHeroHeading(candidateLayout);
  report.stats.heroHeading = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'optomatta_hero_heading_missing', 'desktop', 'Optomatta mechanics require a large left-side hero heading.');
    return;
  }

  if (Math.abs(Number(candidate.rect.x || 0) - Number(reference.rect.x || 0)) > 190 || Math.abs(Number(candidate.rect.y || 0) - Number(reference.rect.y || 0)) > 150) {
    mechanicsError(
      report,
      'optomatta_hero_heading_position_mismatch',
      'desktop',
      'Candidate hero heading is not positioned like the captured Optomatta left hero copy.'
    );
  }
  if (candidate.rect.height < reference.rect.height * 0.55) {
    mechanicsError(
      report,
      'optomatta_hero_heading_wrap_mismatch',
      'desktop',
      'Candidate hero heading is much more compressed than the captured Optomatta heading.'
    );
  }
}

function compareOptomattaProofStrip(report, referenceLayout, candidateLayout) {
  const referenceBand = lightBandNear(referenceLayout, 760, 1080);
  const candidateBand = lightBandNear(candidateLayout, 760, 1120);
  const referenceTiles = optomattaProofTiles(referenceLayout);
  const candidateTiles = optomattaProofTiles(candidateLayout);
  report.stats.proofStrip = {
    referenceBand: referenceBand ? rectMetrics(referenceBand) : null,
    candidateBand: candidateBand ? rectMetrics(candidateBand) : null,
    referenceTiles,
    candidateTiles,
  };

  if (referenceBand && !candidateBand) {
    mechanicsError(report, 'optomatta_proof_strip_missing', 'desktop', 'Optomatta mechanics require the pale proof/service strip immediately below the hero.');
  }
  if (referenceTiles.length >= 3 && candidateTiles.length < 3) {
    mechanicsError(report, 'optomatta_proof_tiles_missing', 'desktop', 'Optomatta mechanics require three semantic proof or service tiles below the hero.');
  }
}

function compareOptomattaMobileHeading(report, referenceLayout, candidateLayout) {
  if (!referenceLayout || !candidateLayout) {
    mechanicsWarning(report, 'optomatta_mobile_layout_missing', 'mobile', 'Mobile layout evidence is missing, so mobile Optomatta mechanics could not be checked.');
    return;
  }
  const reference = optomattaHeroHeading(referenceLayout);
  const candidate = optomattaHeroHeading(candidateLayout);
  report.stats.mobileHeading = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsWarning(report, 'optomatta_mobile_heading_missing', 'mobile', 'Optomatta mobile hero heading geometry could not be identified; inspect mobile screenshots manually.');
    return;
  }
  if (candidate.rect.height < reference.rect.height * 0.62) {
    mechanicsError(report, 'optomatta_mobile_heading_wrap_mismatch', 'mobile', 'Candidate mobile Optomatta heading is much more compressed than the captured reference.');
  }
  if (candidate.rect.width > reference.rect.width * 1.45) {
    mechanicsError(
      report,
      'optomatta_mobile_heading_width_mismatch',
      'mobile',
      `Candidate mobile Optomatta heading is ${Math.round(candidate.rect.width)}px wide; reference is ${Math.round(reference.rect.width)}px. Preserve the narrow mobile copy column with responsive width controls instead of letting the heading span the full phone viewport.`
    );
  }
}

function auditLumenMechanics(referenceLayouts, candidateLayouts) {
  const report = {
    ok: true,
    skipped: false,
    family: 'lumen',
    errors: [],
    warnings: [],
    stats: {},
  };
  const referenceDesktop = referenceLayouts.desktop;
  const candidateDesktop = candidateLayouts.desktop;
  const referenceMobile = referenceLayouts.mobile;
  const candidateMobile = candidateLayouts.mobile;

  compareLumenAppointmentCta(report, referenceDesktop, candidateDesktop);
  compareLumenHeroHeading(report, referenceDesktop, candidateDesktop);
  compareLumenDoctorVisual(report, referenceDesktop, candidateDesktop);
  compareLumenDoctorCutout(report, referenceDesktop, candidateDesktop);
  compareLumenMiniMedia(report, referenceDesktop, candidateDesktop);
  compareLumenProofCard(report, referenceDesktop, candidateDesktop);
  compareLumenStats(report, referenceDesktop, candidateDesktop);
  compareLumenMobileHeading(report, referenceMobile, candidateMobile);
  report.ok = report.errors.length === 0;
  return report;
}

function compareLumenAppointmentCta(report, referenceLayout, candidateLayout) {
  const semanticCtaPattern = /(?:\b(?:appointment|book|schedule|reserve|request)\b.{0,48}\b(?:now|visit|exam|consult(?:ation)?|care|appointment)\b|\b(?:book|schedule|reserve|request)\b)/i;
  const referenceWidth = Number(referenceLayout?.viewport?.width || 0);
  const candidateWidth = Number(candidateLayout?.viewport?.width || 0);
  const reference = rightmostTextBox(referenceLayout, /\S/, (box) => {
    const tag = String(box?.tag || '').toLowerCase();
    return (tag === 'a' || tag === 'button')
      && Number(box?.rect?.top ?? box?.rect?.y ?? 0) <= 150
      && rectRight(box) >= referenceWidth * 0.55
      && (semanticCtaPattern.test(String(box?.text || ''))
        || (Number(box?.rect?.width || 0) >= 90 && Number(box?.rect?.height || 0) >= 28));
  });
  const candidate = rightmostTextBox(candidateLayout, /\S/, (box) => {
    const tag = String(box?.tag || '').toLowerCase();
    return (tag === 'a' || tag === 'button')
      && Number(box?.rect?.top ?? box?.rect?.y ?? 0) <= 150
      && rectRight(box) >= candidateWidth * 0.55
      && (semanticCtaPattern.test(String(box?.text || ''))
        || (Number(box?.rect?.width || 0) >= 90 && Number(box?.rect?.height || 0) >= 28));
  });
  if (!reference || !candidate) {
    mechanicsError(report, 'lumen_appointment_cta_missing', 'desktop', 'Lumen mechanics require a semantic booking or appointment CTA at the far right of the desktop header.');
    return;
  }

  const referenceGap = Math.round(referenceLayout.viewport.width - rectRight(reference));
  const candidateGap = Math.round(candidateLayout.viewport.width - rectRight(candidate));
  report.stats.appointmentCtaRightGap = { reference: referenceGap, candidate: candidateGap };
  report.stats.appointmentCta = {
    reference: rectMetrics(reference),
    candidate: rectMetrics(candidate),
  };
  const referenceTop = Number(reference.rect?.top ?? reference.rect?.y ?? 0);
  const candidateTop = Number(candidate.rect?.top ?? candidate.rect?.y ?? 0);
  if (Math.abs(candidateGap - referenceGap) > 190 || Math.abs(candidateTop - referenceTop) > 70) {
    mechanicsError(
      report,
      'lumen_appointment_cta_position_mismatch',
      'desktop',
      `Candidate appointment CTA ends ${candidateGap}px from the right edge at ${Math.round(candidateTop)}px from the top; reference ends ${referenceGap}px from the right edge at ${Math.round(referenceTop)}px. Preserve the Lumen editorial header distribution.`
    );
  }
  if (
    Number(candidate.rect?.width || 0) < Number(reference.rect?.width || 0) * 0.55
    || Number(candidate.rect?.width || 0) > Number(reference.rect?.width || 0) * 1.65
    || Number(candidate.rect?.height || 0) < Number(reference.rect?.height || 0) * 0.6
    || Number(candidate.rect?.height || 0) > Number(reference.rect?.height || 0) * 1.5
  ) {
    mechanicsError(report, 'lumen_appointment_cta_scale_mismatch', 'desktop', 'Candidate appointment CTA dimensions do not preserve the captured Lumen header CTA geometry.');
  }
}

function compareLumenHeroHeading(report, referenceLayout, candidateLayout) {
  const reference = lumenHeroHeading(referenceLayout);
  const candidate = lumenHeroHeading(candidateLayout);
  report.stats.heroHeading = {
    reference: reference ? { text: reference.text, ...rectMetrics(reference) } : null,
    candidate: candidate ? { text: candidate.text, ...rectMetrics(candidate) } : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'lumen_hero_heading_missing', 'desktop', 'Lumen mechanics require an oversized first-viewport editorial hero headline.');
    return;
  }

  if (Math.abs(Number(candidate.rect.x || 0) - Number(reference.rect.x || 0)) > 260 || Math.abs(Number(candidate.rect.y || 0) - Number(reference.rect.y || 0)) > 180) {
    mechanicsError(
      report,
      'lumen_hero_heading_position_mismatch',
      'desktop',
      'Candidate Lumen hero heading is not positioned like the captured oversized editorial headline.'
    );
  }
  if (candidate.rect.height < reference.rect.height * 0.55 || candidate.rect.width < reference.rect.width * 0.55) {
    mechanicsError(
      report,
      'lumen_hero_heading_scale_mismatch',
      'desktop',
      'Candidate Lumen hero heading is much more compressed than the captured oversized editorial headline.'
    );
  }
}

function compareLumenDoctorVisual(report, referenceLayout, candidateLayout) {
  const reference = lumenDoctorVisual(referenceLayout);
  const candidate = lumenDoctorVisual(candidateLayout);
  report.stats.doctorVisual = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'lumen_doctor_visual_missing', 'desktop', 'Lumen mechanics require a large white-coat doctor visual anchored in the lower-left/center of the hero.');
    return;
  }

  if (Math.abs(Number(candidate.rect.x || 0) - Number(reference.rect.x || 0)) > 220 || Math.abs(Number(candidate.rect.y || 0) - Number(reference.rect.y || 0)) > 220) {
    mechanicsError(report, 'lumen_doctor_visual_position_mismatch', 'desktop', 'Candidate doctor visual is not anchored like the captured Lumen hero doctor.');
  }
  if (candidate.rect.width < reference.rect.width * 0.62 || candidate.rect.height < reference.rect.height * 0.62) {
    mechanicsError(report, 'lumen_doctor_visual_scale_mismatch', 'desktop', 'Candidate doctor visual is too small for the captured Lumen hero.');
  }
}

function compareLumenDoctorCutout(report, referenceLayout, candidateLayout) {
  const reference = lumenDoctorVisual(referenceLayout);
  const candidate = lumenDoctorVisual(candidateLayout);
  if (!reference || !candidate) {
    return;
  }

  const referenceSource = mediaSource(reference);
  const candidateSource = mediaSource(candidate);
  const referenceCutout = isLikelyTransparentCutoutMedia(reference);
  const candidateCutout = isLikelyTransparentCutoutMedia(candidate);
  report.stats.doctorVisualCutout = {
    reference: {
      source: referenceSource,
      transparentLike: referenceCutout,
    },
    candidate: {
      source: candidateSource,
      transparentLike: candidateCutout,
    },
  };

  if (referenceCutout && !candidateCutout) {
    mechanicsError(
      report,
      'lumen_doctor_cutout_asset_mismatch',
      'desktop',
      'Captured Lumen uses a transparent/cutout-like PNG doctor visual. Candidate uses a rectangular non-cutout replacement; use a generated/licensed transparent PNG/WebP cutout or add a contract-backed image mask/cutout control instead of approximating with a boxed JPG/background.'
    );
  }
}

function compareLumenMiniMedia(report, referenceLayout, candidateLayout) {
  const reference = lumenMiniMedia(referenceLayout);
  const candidate = lumenMiniMedia(candidateLayout);
  report.stats.miniMedia = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'lumen_mini_media_missing', 'desktop', 'Lumen mechanics require the small eye-exam media card around the lower middle of the hero.');
    return;
  }

  if (candidate.rect.width < reference.rect.width * 0.62 || candidate.rect.height < reference.rect.height * 0.62) {
    mechanicsError(report, 'lumen_mini_media_scale_mismatch', 'desktop', 'Candidate Lumen mini media card is too small compared with the captured reference.');
  }
  if (Math.abs(Number(candidate.rect.x || 0) - Number(reference.rect.x || 0)) > 120 || Math.abs(Number(candidate.rect.y || 0) - Number(reference.rect.y || 0)) > 96) {
    mechanicsError(report, 'lumen_mini_media_position_mismatch', 'desktop', 'Candidate Lumen mini media card is not positioned like the captured lower-middle eye-exam media card.');
  }
}

function compareLumenProofCard(report, referenceLayout, candidateLayout) {
  const reference = lumenProofCard(referenceLayout);
  const candidate = lumenProofCard(candidateLayout);
  report.stats.proofCard = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsError(report, 'lumen_proof_card_missing', 'desktop', 'Lumen mechanics require a white specialist-credential proof card on the right side of the hero.');
    return;
  }

  const referenceWidth = Number(referenceLayout?.viewport?.width || 0);
  const candidateWidth = Number(candidateLayout?.viewport?.width || 0);
  if (Number(candidate.rect.x || 0) < candidateWidth * 0.52 || Math.abs(Number(candidate.rect.y || 0) - Number(reference.rect.y || 0)) > 120) {
    mechanicsError(report, 'lumen_proof_card_position_mismatch', 'desktop', 'Candidate proof card is not positioned like the captured Lumen right-side proof card.');
  }
  if (Number(reference.rect.x || 0) >= referenceWidth * 0.55 && Number(candidate.rect.width || 0) < Number(reference.rect.width || 0) * 0.62) {
    mechanicsError(report, 'lumen_proof_card_scale_mismatch', 'desktop', 'Candidate proof card text block is too narrow for the captured Lumen proof card.');
  }
}

function compareLumenStats(report, referenceLayout, candidateLayout) {
  const reference = lumenStats(referenceLayout);
  const candidate = lumenStats(candidateLayout);
  report.stats.stats = {
    reference: reference.map(rectMetrics),
    candidate: candidate.map(rectMetrics),
  };
  if (reference.length >= 2 && candidate.length < 2) {
    mechanicsError(report, 'lumen_stats_missing', 'desktop', 'Lumen mechanics require two large numeric hero stats near the lower-left area.');
    return;
  }
  if (reference.length >= 2 && candidate.length >= 2) {
    const referenceTop = average(reference.map((box) => Number(box?.rect?.y || 0)));
    const candidateTop = average(candidate.map((box) => Number(box?.rect?.y || 0)));
    const referenceHeight = average(reference.map((box) => Number(box?.rect?.height || 0)));
    const candidateHeight = average(candidate.map((box) => Number(box?.rect?.height || 0)));
    if (Math.abs(candidateTop - referenceTop) > 110) {
      mechanicsError(report, 'lumen_stats_position_mismatch', 'desktop', 'Candidate Lumen hero stats are not vertically anchored like the captured lower-left stats.');
    }
    if (candidateHeight < referenceHeight * 0.72) {
      mechanicsError(report, 'lumen_stats_scale_mismatch', 'desktop', 'Candidate Lumen hero stats are visually compressed compared with the captured lower-left stats.');
    }
  }
}

function compareLumenMobileHeading(report, referenceLayout, candidateLayout) {
  if (!referenceLayout || !candidateLayout) {
    mechanicsWarning(report, 'lumen_mobile_layout_missing', 'mobile', 'Mobile layout evidence is missing, so mobile Lumen mechanics could not be checked.');
    return;
  }
  const reference = lumenHeroHeading(referenceLayout);
  const candidate = lumenHeroHeading(candidateLayout);
  report.stats.mobileHeading = {
    reference: reference ? rectMetrics(reference) : null,
    candidate: candidate ? rectMetrics(candidate) : null,
  };
  if (!reference || !candidate) {
    mechanicsWarning(report, 'lumen_mobile_heading_missing', 'mobile', 'Lumen mobile hero heading geometry could not be identified; inspect mobile screenshots manually.');
    return;
  }
  if (candidate.rect.height < reference.rect.height * 0.62) {
    mechanicsError(report, 'lumen_mobile_heading_wrap_mismatch', 'mobile', 'Candidate mobile Lumen heading is much more compressed than the captured reference.');
  }
}

function firstTextBox(layout, pattern) {
  return (layout?.textBoxes || []).find((box) => pattern.test(String(box?.text || ''))) || null;
}

function rightmostTextBox(layout, pattern, predicate = () => true) {
  return (layout?.textBoxes || [])
    .filter((box) => pattern.test(String(box?.text || '')) && predicate(box))
    .sort((a, b) => rectRight(b) - rectRight(a))[0] || null;
}

function largestFirstViewportMedia(layout) {
  const mediaBoxes = Array.isArray(layout?.meaningfulMediaBoxes)
    ? layout.meaningfulMediaBoxes
    : layout?.mediaBoxes || [];
  return mediaBoxes
    .filter((box) => Number(box?.firstViewportArea || 0) > 0)
    .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;
}

function firstMediaNear(layout, x, y, xTolerance, yTolerance) {
  return (layout?.mediaBoxes || [])
    .filter((box) => Math.abs(Number(box?.rect?.x || 0) - x) <= xTolerance && Math.abs(Number(box?.rect?.y || 0) - y) <= yTolerance)
    .sort((a, b) => Math.abs(Number(a.rect.y || 0) - y) - Math.abs(Number(b.rect.y || 0) - y))[0] || null;
}

function darkTopBand(layout, maxBottom) {
  return (layout?.landmarks || [])
    .filter((box) => Number(box?.rect?.top || 0) <= 8 && Number(box?.rect?.bottom || 0) <= maxBottom)
    .filter((box) => isDarkColor(box?.backgroundColor) && Number(box?.rect?.width || 0) >= Number(layout?.viewport?.width || 0) * 0.8)
    .sort((a, b) => Number(b.rect.width || 0) - Number(a.rect.width || 0))[0] || null;
}

function darkBandNear(layout, minY, maxY) {
  return (layout?.landmarks || [])
    .filter((box) => Number(box?.rect?.y || 0) >= minY && Number(box?.rect?.y || 0) <= maxY)
    .filter((box) => isDarkColor(box?.backgroundColor) && Number(box?.rect?.width || 0) >= Number(layout?.viewport?.width || 0) * 0.8)
    .sort((a, b) => Number(b.rect.width || 0) - Number(a.rect.width || 0))[0] || null;
}

function lightTopBand(layout, maxBottom) {
  return (layout?.landmarks || [])
    .filter((box) => Number(box?.rect?.top || 0) <= 8 && Number(box?.rect?.bottom || 0) <= maxBottom)
    .filter((box) => isLightColor(box?.backgroundColor) && Number(box?.rect?.width || 0) >= Number(layout?.viewport?.width || 0) * 0.8)
    .sort((a, b) => Number(b.rect.width || 0) - Number(a.rect.width || 0))[0] || null;
}

function lightBandNear(layout, minY, maxY) {
  return (layout?.landmarks || [])
    .filter((box) => Number(box?.rect?.y || 0) >= minY && Number(box?.rect?.y || 0) <= maxY)
    .filter((box) => isLightColor(box?.backgroundColor) && Number(box?.rect?.width || 0) >= Number(layout?.viewport?.width || 0) * 0.8)
    .sort((a, b) => Number(b.rect.width || 0) - Number(a.rect.width || 0))[0] || null;
}

function optomattaHeroHeading(layout) {
  const viewportWidth = Number(layout?.viewport?.width || 0);
  const viewportHeight = Number(layout?.viewport?.height || 0);
  const minY = viewportWidth <= 560 ? 80 : 120;
  const maxY = Math.min(viewportHeight * 0.72, viewportWidth <= 560 ? 520 : 560);

  return combinedTextBox(layout, (box) => String(box?.tag || '').toLowerCase() === 'h1', minY, maxY)
    || (layout?.textBoxes || [])
      .filter((box) => Number(box?.rect?.top ?? box?.rect?.y ?? 0) >= minY && Number(box?.rect?.top ?? box?.rect?.y ?? 0) <= maxY)
      .filter((box) => String(box?.text || '').trim().length >= 8)
      .filter((box) => Number(box?.rect?.width || 0) >= 140 && Number(box?.rect?.height || 0) >= 44)
      .sort((a, b) => {
        const fontSizeDelta = Number.parseFloat(String(b?.fontSize || '0')) - Number.parseFloat(String(a?.fontSize || '0'));
        return fontSizeDelta !== 0
          ? fontSizeDelta
          : (Number(b?.rect?.height || 0) * Number(b?.rect?.width || 0)) - (Number(a?.rect?.height || 0) * Number(a?.rect?.width || 0));
      })[0]
    || null;
}

function optomattaProofTiles(layout) {
  return (layout?.textBoxes || [])
    .filter((box) => Number(box?.rect?.top || 0) >= 720 && Number(box?.rect?.top || 0) <= 1120)
    .filter((box) => /^(?:h[2-4]|strong)$/i.test(String(box?.tag || ''))
      || Number.parseFloat(String(box?.fontSize || '0')) >= 18
      || Number.parseFloat(String(box?.fontWeight || '0')) >= 650)
    .filter((box) => String(box?.text || '').trim().length >= 4)
    .sort((a, b) => Number(a?.rect?.x || 0) - Number(b?.rect?.x || 0))
    .map((box) => String(box.text || ''));
}

function lumenHeroHeading(layout) {
  const viewportWidth = Number(layout?.viewport?.width || 0);
  const viewportHeight = Number(layout?.viewport?.height || 0);
  const minY = viewportWidth <= 560 ? 80 : 120;
  const maxY = Math.min(viewportHeight * 0.72, viewportWidth <= 560 ? 560 : 620);

  return combinedTextBox(layout, (box) => /^h[1-3]$/i.test(String(box?.tag || '')), minY, maxY, 0.3)
    || (layout?.textBoxes || [])
      .filter((box) => Number(box?.rect?.top ?? box?.rect?.y ?? 0) >= minY && Number(box?.rect?.top ?? box?.rect?.y ?? 0) <= maxY)
      .filter((box) => String(box?.text || '').trim().length >= 8)
      .filter((box) => Number(box?.rect?.width || 0) >= 180 && Number(box?.rect?.height || 0) >= 52)
      .sort((a, b) => {
        const fontSizeDelta = Number.parseFloat(String(b?.fontSize || '0')) - Number.parseFloat(String(a?.fontSize || '0'));
        return fontSizeDelta !== 0
          ? fontSizeDelta
          : (Number(b?.rect?.height || 0) * Number(b?.rect?.width || 0)) - (Number(a?.rect?.height || 0) * Number(a?.rect?.width || 0));
      })[0]
    || null;
}

function lumenDoctorVisual(layout) {
  const width = Number(layout?.viewport?.width || 0);
  const height = Number(layout?.viewport?.height || 0);
  return (layout?.mediaBoxes || [])
    .filter((box) => Number(box?.firstViewportArea || 0) > 0)
    .filter((box) => Number(box?.rect?.x || 0) >= 70 && Number(box?.rect?.x || 0) <= width * 0.42)
    .filter((box) => Number(box?.rect?.y || 0) >= height * 0.2 && Number(box?.rect?.y || 0) <= height * 0.62)
    .filter((box) => Number(box?.rect?.width || 0) >= 260 && Number(box?.rect?.height || 0) >= 340)
    .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;
}

function lumenMiniMedia(layout) {
  const width = Number(layout?.viewport?.width || 0);
  const height = Number(layout?.viewport?.height || 0);
  return (layout?.mediaBoxes || [])
    .filter((box) => Number(box?.firstViewportArea || 0) > 0)
    .filter((box) => Number(box?.rect?.x || 0) >= width * 0.34 && Number(box?.rect?.x || 0) <= width * 0.72)
    .filter((box) => Number(box?.rect?.y || 0) >= height * 0.42 && Number(box?.rect?.y || 0) <= height * 0.76)
    .filter((box) => Number(box?.rect?.width || 0) >= 150 && Number(box?.rect?.width || 0) <= 380)
    .filter((box) => Number(box?.rect?.height || 0) >= 100 && Number(box?.rect?.height || 0) <= 260)
    .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;
}

function lumenProofCard(layout) {
  const width = Number(layout?.viewport?.width || 0);
  return (layout?.textBoxes || [])
    .filter((box) => /^(?:h[2-4]|strong)$/i.test(String(box?.tag || ''))
      || Number.parseFloat(String(box?.fontSize || '0')) >= 22
      || Number.parseFloat(String(box?.fontWeight || '0')) >= 650)
    .filter((box) => Number(box?.rect?.x || 0) >= width * 0.55)
    .filter((box) => Number(box?.rect?.y || 0) >= 650 && Number(box?.rect?.y || 0) <= 1080)
    .filter((box) => Number(box?.rect?.width || 0) >= 180 && Number(box?.rect?.height || 0) >= 36)
    .filter((box) => String(box?.text || '').trim().length >= 10)
    .sort((a, b) => Number(b.rect.width || 0) - Number(a.rect.width || 0))[0] || null;
}

function lumenStats(layout) {
  const width = Number(layout?.viewport?.width || 0);
  return (layout?.textBoxes || [])
    .filter((box) => /^\d[\d.,]*\s*(?:[km])?\s*(?:%|\+)?$/i.test(String(box?.text || '').trim()))
    .filter((box) => String(box?.tag || '').toLowerCase() === 'strong'
      || Number.parseFloat(String(box?.fontSize || '0')) >= 32
      || Number(box?.rect?.height || 0) >= 40)
    .filter((box) => Number(box?.rect?.x || 0) <= width * 0.36)
    .filter((box) => Number(box?.rect?.y || 0) >= 600 && Number(box?.rect?.y || 0) <= 1080)
    .slice(0, 4);
}

function mediaSource(box) {
  return String(box?.source || box?.currentSrc || box?.src || '');
}

function isLikelyTransparentCutoutMedia(box) {
  return /\.(?:png|webp)(?:[?#]|$)/i.test(mediaSource(box));
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return 0;
  }

  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function combinedTextBox(layout, predicate, minY, maxY, minimumAreaRatio = 0) {
  let boxes = (layout?.textBoxes || [])
    .filter(predicate)
    .filter((box) => Number(box?.rect?.y ?? box?.rect?.top ?? 0) >= minY && Number(box?.rect?.y ?? box?.rect?.top ?? 0) <= maxY)
    .filter((box) => Number(box?.rect?.width || 0) > 0 && Number(box?.rect?.height || 0) > 0);
  if (boxes.length === 0) {
    return null;
  }

  if (minimumAreaRatio > 0) {
    const largestArea = Math.max(...boxes.map((box) => Number(box.rect.width) * Number(box.rect.height)));
    boxes = boxes.filter((box) => Number(box.rect.width) * Number(box.rect.height) >= largestArea * minimumAreaRatio);
  }

  const left = Math.min(...boxes.map((box) => Number(box?.rect?.left ?? box?.rect?.x ?? 0)));
  const top = Math.min(...boxes.map((box) => Number(box?.rect?.top ?? box?.rect?.y ?? 0)));
  const right = Math.max(...boxes.map(rectRight));
  const bottom = Math.max(...boxes.map((box) => Number(box?.rect?.bottom ?? (Number(box?.rect?.y || 0) + Number(box?.rect?.height || 0)))));

  return {
    text: boxes.map((box) => String(box.text || '')).join(' '),
    rect: {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      top,
      bottom,
      left,
      right,
    },
  };
}

function rightHeroMedia(layout) {
  const width = Number(layout?.viewport?.width || 0);
  const height = Number(layout?.viewport?.height || 0);
  const directMedia = (layout?.mediaBoxes || [])
    .filter((box) => Number(box?.rect?.x || 0) >= width * 0.45)
    .filter((box) => Number(box?.rect?.y || 0) >= 90 && Number(box?.rect?.y || 0) <= 300)
    .filter((box) => Number(box?.rect?.width || 0) >= width * 0.25 && Number(box?.rect?.height || 0) >= height * 0.48)
    .sort((a, b) => Number(b.rect.height || 0) - Number(a.rect.height || 0))[0] || null;

  return directMedia || compositeRightHeroMedia(layout);
}

function compositeRightHeroMedia(layout) {
  const width = Number(layout?.viewport?.width || 0);
  const height = Number(layout?.viewport?.height || 0);
  const composite = (layout?.mediaBoxes || [])
    .filter((box) => Number(box?.firstViewportArea || 0) > 0)
    .filter((box) => Number(box?.rect?.x || 0) <= 24)
    .filter((box) => Number(box?.rect?.y || 0) >= 90 && Number(box?.rect?.y || 0) <= 300)
    .filter((box) => Number(box?.rect?.width || 0) >= width * 0.88 && Number(box?.rect?.height || 0) >= height * 0.48)
    .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;

  if (!composite) {
    return null;
  }

  const top = Number(composite.rect.top ?? composite.rect.y ?? 0);
  const right = Number(composite.rect.right ?? (Number(composite.rect.x || 0) + Number(composite.rect.width || 0)));
  const bottom = Number(composite.rect.bottom ?? (top + Number(composite.rect.height || 0)));
  const left = Math.max(width * 0.5, Number(composite.rect.left ?? composite.rect.x ?? 0));

  return {
    ...composite,
    rect: {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      top,
      bottom,
      left,
      right,
    },
  };
}

function lowerLeftEquipmentMedia(layout) {
  const height = Number(layout?.viewport?.height || 0);
  return (layout?.mediaBoxes || [])
    .filter((box) => Number(box?.rect?.x || 0) <= 80)
    .filter((box) => Number(box?.rect?.y || 0) >= height * 0.45 && Number(box?.rect?.y || 0) <= height * 0.78)
    .filter((box) => Number(box?.rect?.width || 0) >= 160 && Number(box?.rect?.height || 0) >= 120)
    .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0] || null;
}

function isDarkColor(value) {
  const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return false;
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return red + green + blue < 210;
}

function isLightColor(value) {
  const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return false;
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return red + green + blue > 690;
}

function rectRight(box) {
  return Number(box?.rect?.right ?? (Number(box?.rect?.x || 0) + Number(box?.rect?.width || 0)));
}

function rectMetrics(box) {
  return {
    x: Math.round(Number(box?.rect?.x || 0)),
    y: Math.round(Number(box?.rect?.y || 0)),
    width: Math.round(Number(box?.rect?.width || 0)),
    height: Math.round(Number(box?.rect?.height || 0)),
  };
}

function mechanicsError(report, code, label, message) {
  report.errors.push({ code, label, message });
}

function mechanicsWarning(report, code, label, message) {
  report.warnings.push({ code, label, message });
}

function printSummary(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`monteby_visual_benchmark=${report.ok ? 'ok' : 'failed'}`);
  console.log(`audit=${report.audit.ok ? 'ok' : 'failed'}`);
  console.log(`rendered_media=${report.renderedMedia.skipped ? 'skipped' : report.renderedMedia.ok ? 'ok' : 'failed'}`);
  console.log(`horizontal_overflow=${report.horizontalOverflow.skipped ? 'skipped' : report.horizontalOverflow.ok ? 'ok' : 'failed'}`);
  console.log(`generic_geometry=${report.genericGeometry.skipped ? 'skipped' : report.genericGeometry.ok ? 'ok' : 'failed'}`);
  console.log(`mechanics=${report.mechanics.skipped ? 'skipped' : report.mechanics.ok ? 'ok' : 'failed'}`);
  console.log(`visual_diff=${formatPercent(report.comparison.percent)}`);
  console.log(`max_viewport_diff=${formatPercent(report.comparison.maxPercent)}`);
  if (report.structuralComparison?.skipped !== true) {
    console.log(`structural_visual_diff=${formatPercent(report.structuralComparison.percent)}`);
    console.log(`structural_max_viewport_diff=${formatPercent(report.structuralComparison.maxPercent)}`);
  }
  if (report.files.jsonReport) {
    console.log(`report_json=${report.files.jsonReport}`);
  }
  if (report.files.markdownReport) {
    console.log(`report_markdown=${report.files.markdownReport}`);
  }
  if (report.files.visualReviewSheet) {
    console.log(`visual_review=${report.files.visualReviewSheet}`);
  }
  for (const blocker of report.blockers) {
    console.log(`blocker ${blocker.source}:${blocker.code}: ${blocker.message}`);
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const referenceManifest = readJson(path.resolve(options.referenceManifest));
    const targetManifest = options.targetManifest
      ? readJson(path.resolve(options.targetManifest))
      : referenceManifest;
    const family = mechanicsFamily(referenceManifest);
    const sourceUrl = String(referenceManifest?.sourceUrl || referenceManifest?.url || '');
    if (options.candidateManifest && family) {
      options.requireMarketplaceMedia = true;
      if (/^https?:\/\//i.test(sourceUrl)) {
        options.requireRealReference = true;
      }
    }

    const targetScreenshots = Array.isArray(targetManifest?.screenshots) ? targetManifest.screenshots : [];
    const candidateManifest = options.candidateManifest ? readJson(path.resolve(options.candidateManifest)) : null;
    const candidateScreenshots = Array.isArray(candidateManifest?.screenshots) ? candidateManifest.screenshots : [];
    const candidateScreenshotsByLabel = new Map(candidateScreenshots.map((screenshot) => [screenshot?.label, screenshot]));
    const targetIsFullPage = targetScreenshots.length > 0
      && targetScreenshots.every((screenshot) => screenshot?.mode === 'full-page');
    const candidateMatchesFullPage = candidateManifest !== null
      && targetScreenshots.length > 0
      && targetScreenshots.every((screenshot) => candidateScreenshotsByLabel.get(screenshot?.label)?.mode === 'full-page');
    options.padToLargest = targetIsFullPage && (options.padToLargest || candidateMatchesFullPage);

    const auditRun = runJsonScript(scriptPath('audit-monteby-layout.js'), auditArgs(options));
    const compareRun = runJsonScript(scriptPath('compare-screenshots.js'), compareArgs(options), {
      code: 'screenshot_comparison_unavailable',
      label: options.label,
      message: 'Screenshot comparison could not run.',
    });
    const structuralCompareCommandArgs = structuralCompareArgs(options);
    const structuralCompareRun = structuralCompareCommandArgs.length > 0
      ? runJsonScript(scriptPath('compare-screenshots.js'), structuralCompareCommandArgs, {
        code: 'structural_screenshot_comparison_unavailable',
        label: `${options.label}-structural`,
        message: 'Structural screenshot comparison could not run.',
      })
      : null;
    const renderedMediaCommandArgs = renderedMediaArgs(options);
    const renderedMediaRun = renderedMediaCommandArgs.length > 0
      ? runJsonScript(scriptPath('audit-rendered-media-parity.js'), renderedMediaCommandArgs)
      : null;
    const mechanicsReport = auditTemplateMechanics(options);
    const genericGeometryReport = auditGenericGeometry(options);
    const horizontalOverflowReport = auditHorizontalOverflow(options);
    const report = buildReport(
      options,
      auditRun,
      compareRun,
      structuralCompareRun,
      renderedMediaRun,
      mechanicsReport,
      genericGeometryReport,
      horizontalOverflowReport
    );

    attachVisualReview(report, options);
    writeOutputs(report, options);
    printSummary(report, options.json);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
