#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PAIRED_MEDIA_MIN_AREA = 10000;
const PAIRED_MEDIA_MIN_CONTAINED_OVERLAP = 0.5;
const PAIRED_MEDIA_MIN_AXIS_RATIO = 0.35;
const PAIRED_MEDIA_EDGE_INSET = 2;
const PAIRED_MEDIA_PROTECTED_PADDING = 2;
const PAIRED_MEDIA_MAX_PROTECTED_RECTS = 256;
const PAIRED_MEDIA_MAX_MASK_RECTS = 1024;

function parseArgs(argv) {
  const options = {
    target: '',
    candidate: '',
    targetManifest: '',
    candidateManifest: '',
    candidateDir: '',
    candidatePrefix: 'candidate',
    diff: '',
    diffDir: '',
    label: 'comparison',
    threshold: 0.1,
    maxPercent: null,
    maxViewportPercent: null,
    padToLargest: false,
    padBackground: '#ffffff',
    maskMediaBoxes: false,
    maskPairedMediaContent: false,
    maskIdentityMedia: false,
    maskTextBoxes: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target') {
      options.target = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate') {
      options.candidate = requiredValue(argv, index += 1, arg);
    } else if (arg === '--target-manifest') {
      options.targetManifest = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate-manifest') {
      options.candidateManifest = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate-dir') {
      options.candidateDir = requiredValue(argv, index += 1, arg);
    } else if (arg === '--candidate-prefix') {
      options.candidatePrefix = requiredValue(argv, index += 1, arg);
    } else if (arg === '--diff') {
      options.diff = requiredValue(argv, index += 1, arg);
    } else if (arg === '--diff-dir') {
      options.diffDir = requiredValue(argv, index += 1, arg);
    } else if (arg === '--label') {
      options.label = requiredValue(argv, index += 1, arg);
    } else if (arg === '--threshold') {
      options.threshold = parseThreshold(requiredValue(argv, index += 1, arg));
    } else if (arg === '--max-percent') {
      options.maxPercent = parsePercentBudget(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--max-viewport-percent') {
      options.maxViewportPercent = parsePercentBudget(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--pad-to-largest') {
      options.padToLargest = true;
    } else if (arg === '--pad-background') {
      options.padBackground = requiredValue(argv, index += 1, arg);
    } else if (arg === '--mask-media-boxes') {
      options.maskMediaBoxes = true;
    } else if (arg === '--mask-paired-media-content') {
      options.maskPairedMediaContent = true;
    } else if (arg === '--mask-identity-media') {
      options.maskIdentityMedia = true;
    } else if (arg === '--mask-text-boxes') {
      options.maskTextBoxes = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.maskIdentityMedia && (!options.targetManifest || !options.candidateManifest)) {
    throw new Error('--mask-identity-media requires --target-manifest and --candidate-manifest');
  }
  if (options.maskPairedMediaContent && (!options.targetManifest || !options.candidateManifest)) {
    throw new Error('--mask-paired-media-content requires --target-manifest and --candidate-manifest');
  }

  if (options.targetManifest) {
    if (!options.candidateManifest && !options.candidateDir) {
      throw new Error('--candidate-manifest or --candidate-dir is required with --target-manifest');
    }
    return options;
  }

  if (!options.target) {
    throw new Error('--target is required');
  }
  if (!options.candidate) {
    throw new Error('--candidate is required');
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

function parseThreshold(value) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('--threshold must be a number between 0 and 1');
  }
  return threshold;
}

function parsePercentBudget(value, arg) {
  const budget = Number(value);
  if (!Number.isFinite(budget) || budget < 0 || budget > 100) {
    throw new Error(`${arg} must be a number between 0 and 100`);
  }
  return budget;
}

function printHelp() {
  console.log(`Usage:
  compare-screenshots.js --target target.png --candidate candidate.png [--diff diff.png] [--label name] [--threshold 0.1] [--max-percent 2] [--max-viewport-percent 4] [--pad-to-largest] [--pad-background #ffffff] [--json]
  compare-screenshots.js --target-manifest target-manifest.json (--candidate-dir dir | --candidate-manifest candidate-manifest.json) [--candidate-prefix candidate] [--diff-dir dir] [--threshold 0.1] [--max-percent 2] [--max-viewport-percent 4] [--pad-to-largest] [--pad-background #ffffff] [--mask-media-boxes] [--mask-paired-media-content] [--mask-identity-media] [--mask-text-boxes] [--json]

Compares PNG screenshots and reports mismatched pixels. Manifest mode compares every screenshot entry by label.
Use --max-percent to fail when the aggregate diff is too high, and --max-viewport-percent to fail when any individual viewport is too high.
Use --pad-to-largest for full-page benchmark screenshots with different scroll heights.
Use --mask-paired-media-content with two capture manifests to neutralize only the shared interior of geometrically paired meaningful media boxes. Media edges, text, interactive overlays, shifts, missing boxes, and unpaired regions remain comparable.
Use --mask-identity-media with two capture manifests to ignore matched replacement logos, brands, icons, badges, ratings, avatars, and client/partner/sponsor media while retaining their geometry.
Dependencies are resolved from this package first and then from the current working directory.`);
}

function loadDependency(name) {
  const searchPaths = [__dirname, process.cwd()];
  try {
    return require(require.resolve(name, { paths: searchPaths }));
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error(`Missing dependency "${name}". Install package dependencies or run from a project that has ${name} available.`);
    }
    throw error;
  }
}

function compareScreenshots(options) {
  const { PNG } = loadDependency('pngjs');
  const pixelmatch = normalizePixelmatch(loadDependency('pixelmatch'));
  let target = readPng(PNG, options.target);
  let candidate = readPng(PNG, options.candidate);
  const sharedMaskHeight = Math.min(target.height, candidate.height);
  const targetMaskRects = imageMaskRects(options.targetMaskRects || [], target.width, target.height, sharedMaskHeight);
  const candidateMaskRects = imageMaskRects(options.candidateMaskRects || [], candidate.width, candidate.height, sharedMaskHeight);
  let padded = false;

  if (options.requireEqualWidths === true && target.width !== candidate.width) {
    throw new Error(`Screenshot viewport widths differ for "${options.label}": target ${target.width}px, candidate ${candidate.width}px`);
  }

  if (target.width !== candidate.width || target.height !== candidate.height) {
    if (!options.padToLargest) {
      throw new Error(`Screenshot sizes differ: target ${target.width}x${target.height}, candidate ${candidate.width}x${candidate.height}`);
    }

    const background = parseColor(options.padBackground);
    const width = Math.max(target.width, candidate.width);
    const height = Math.max(target.height, candidate.height);
    target = padPng(PNG, target, width, height, background);
    candidate = padPng(PNG, candidate, width, height, background);
    padded = true;
  }

  if (targetMaskRects.length > 0 || candidateMaskRects.length > 0) {
    applyRectMasks(target, targetMaskRects);
    applyRectMasks(candidate, candidateMaskRects);
  }

  const diff = new PNG({ width: target.width, height: target.height });
  const mismatched = pixelmatch(
    target.data,
    candidate.data,
    diff.data,
    target.width,
    target.height,
    { threshold: options.threshold },
  );

  if (options.diff) {
    fs.mkdirSync(path.dirname(path.resolve(options.diff)), { recursive: true });
    fs.writeFileSync(path.resolve(options.diff), PNG.sync.write(diff));
  }

  const total = target.width * target.height;
  return {
    label: options.label,
    target: path.resolve(options.target),
    candidate: path.resolve(options.candidate),
    width: target.width,
    height: target.height,
    mismatched,
    total,
    percent: Number(((mismatched / total) * 100).toFixed(2)),
    diff: options.diff ? path.resolve(options.diff) : '',
    padded,
    maskRectangles: {
      target: targetMaskRects.length,
      candidate: candidateMaskRects.length,
    },
  };
}

function compareScreenshotManifest(options) {
  const targetManifestPath = path.resolve(options.targetManifest);
  const targetManifest = readJson(targetManifestPath);
  const targetBaseDir = path.dirname(targetManifestPath);
  const targetScreenshots = manifestScreenshots(targetManifest, '--target-manifest');
  const candidateContext = buildCandidateScreenshotContext(options);
  const candidateLookup = candidateContext.screenshots;
  const results = [];

  for (const screenshot of targetScreenshots) {
    const candidateScreenshot = candidateLookup.get(screenshot.label);
    if (!candidateScreenshot) {
      throw new Error(`Candidate screenshot for label "${screenshot.label}" was not found.`);
    }
    assertCompatibleScreenshotMetadata(screenshot, candidateScreenshot);

    const targetFile = path.resolve(targetBaseDir, screenshot.file);
    const diff = options.diffDir ? path.join(path.resolve(options.diffDir), `diff-${screenshot.label}.png`) : '';
    const sharedTextMaskRects = options.maskTextBoxes === true
      ? layoutBoxMaskRects(targetManifest, targetBaseDir, screenshot.label, 'textBoxes', 1)
      : [];
    const identityMaskRects = options.maskIdentityMedia === true
      ? pairedIdentityMediaMaskRects(
        targetManifest,
        targetBaseDir,
        candidateContext.manifest,
        candidateContext.baseDir,
        screenshot.label
      )
      : { target: [], candidate: [] };
    const pairedMediaMask = options.maskPairedMediaContent === true
      ? pairedMediaContentMaskRects(
        targetManifest,
        targetBaseDir,
        candidateContext.manifest,
        candidateContext.baseDir,
        screenshot.label
      )
      : emptyPairedMediaMask('disabled');
    const comparison = compareScreenshots({
      ...options,
      target: targetFile,
      candidate: candidateScreenshot.file,
      diff,
      label: screenshot.label,
      requireEqualWidths: true,
      targetMaskRects: [
        ...layoutMaskRectsForOptions(options, targetManifest, targetBaseDir, screenshot.label, sharedTextMaskRects, identityMaskRects.target),
        ...pairedMediaMask.target,
      ],
      candidateMaskRects: [
        ...layoutMaskRectsForOptions(options, candidateContext.manifest, candidateContext.baseDir, screenshot.label, sharedTextMaskRects, identityMaskRects.candidate),
        ...pairedMediaMask.candidate,
      ],
    });
    results.push({
      ...comparison,
      mediaMask: pairedMediaMask.stats,
    });
  }

  const mismatched = results.reduce((sum, result) => sum + result.mismatched, 0);
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const percents = results.map((result) => result.percent);

  return {
    label: options.label,
    count: results.length,
    mismatched,
    total,
    percent: total > 0 ? Number(((mismatched / total) * 100).toFixed(2)) : 0,
    maxPercent: percents.length > 0 ? Math.max(...percents) : 0,
    results,
    mediaMask: summarizePairedMediaMasks(results, options.maskPairedMediaContent === true),
  };
}

function buildCandidateScreenshotContext(options) {
  if (options.candidateManifest) {
    const manifestPath = path.resolve(options.candidateManifest);
    const baseDir = path.dirname(manifestPath);
    const manifest = readJson(manifestPath);
    const screenshots = manifestScreenshots(manifest, '--candidate-manifest');
    return {
      manifest,
      baseDir,
      screenshots: new Map(screenshots.map((screenshot) => [screenshot.label, {
        ...screenshot,
        file: path.resolve(baseDir, screenshot.file),
      }])),
    };
  }

  const candidateDir = path.resolve(options.candidateDir);
  const targetScreenshots = manifestScreenshots(readJson(path.resolve(options.targetManifest)), '--target-manifest');
  return {
    manifest: {},
    baseDir: candidateDir,
    screenshots: new Map(targetScreenshots.map((screenshot) => [
      screenshot.label,
      {
        label: screenshot.label,
        file: path.join(candidateDir, `${options.candidatePrefix}-${screenshot.label}.png`),
        width: null,
        height: null,
        mode: '',
      },
    ])),
  };
}

function manifestScreenshots(manifest, label) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.screenshots) || manifest.screenshots.length === 0) {
    throw new Error(`${label} must contain a non-empty screenshots array.`);
  }

  return manifest.screenshots.map((screenshot) => {
    if (!screenshot || typeof screenshot !== 'object' || Array.isArray(screenshot)) {
      throw new Error(`${label} screenshots entries must be objects.`);
    }

    const screenshotLabel = typeof screenshot.label === 'string' ? screenshot.label.trim() : '';
    const file = typeof screenshot.file === 'string' ? screenshot.file.trim() : '';
    if (!screenshotLabel || !file) {
      throw new Error(`${label} screenshots entries must include label and file.`);
    }

    return {
      label: screenshotLabel,
      file,
      width: manifestScreenshotDimension(screenshot.width, label, screenshotLabel, 'width'),
      height: manifestScreenshotDimension(screenshot.height, label, screenshotLabel, 'height'),
      mode: manifestScreenshotMode(screenshot.mode, label, screenshotLabel),
    };
  });
}

function manifestScreenshotDimension(value, manifestLabel, screenshotLabel, property) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const dimension = Number(value);
  if (!Number.isFinite(dimension) || dimension <= 0) {
    throw new Error(`${manifestLabel} screenshot "${screenshotLabel}" ${property} must be a positive number.`);
  }
  return dimension;
}

function manifestScreenshotMode(value, manifestLabel, screenshotLabel) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const mode = String(value).trim();
  if (mode !== 'viewport' && mode !== 'full-page') {
    throw new Error(`${manifestLabel} screenshot "${screenshotLabel}" mode must be "viewport" or "full-page".`);
  }
  return mode;
}

function assertCompatibleScreenshotMetadata(target, candidate) {
  if (target.mode && candidate.mode && target.mode !== candidate.mode) {
    throw new Error(`Screenshot mode mismatch for "${target.label}": target ${target.mode}, candidate ${candidate.mode}`);
  }

  if (Number.isFinite(target.width) && Number.isFinite(candidate.width) && target.width !== candidate.width) {
    throw new Error(`Screenshot viewport width mismatch for "${target.label}": target ${target.width}px, candidate ${candidate.width}px`);
  }

  if (Number.isFinite(target.height) && Number.isFinite(candidate.height) && target.height !== candidate.height) {
    throw new Error(`Screenshot viewport height mismatch for "${target.label}": target ${target.height}px, candidate ${candidate.height}px`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function layoutMaskRectsForOptions(options, manifest, baseDir, label, sharedTextMaskRects, identityMaskRects) {
  return [
    ...(options.maskMediaBoxes === true ? layoutBoxMaskRects(manifest, baseDir, label, 'mediaBoxes', 10000) : []),
    ...(options.maskIdentityMedia === true ? identityMaskRects : []),
    ...(options.maskTextBoxes === true ? sharedTextMaskRects : []),
  ];
}

function layoutBoxMaskRects(manifest, baseDir, label, boxProperty, minimumArea) {
  const layout = manifestLayout(manifest, baseDir, label);
  if (!layout) {
    return [];
  }

  const boxes = boxProperty === 'mediaBoxes' && Array.isArray(layout.meaningfulMediaBoxes)
    ? layout.meaningfulMediaBoxes
    : Array.isArray(layout[boxProperty]) ? layout[boxProperty] : [];
  return boxes
    .map(maskRectFromBox)
    .filter((rect) => {
      return rect && rect.width * rect.height >= minimumArea;
    });
}

function pairedMediaContentMaskRects(targetManifest, targetBaseDir, candidateManifest, candidateBaseDir, label) {
  const targetLayout = manifestLayout(targetManifest, targetBaseDir, label);
  const candidateLayout = manifestLayout(candidateManifest, candidateBaseDir, label);
  if (!targetLayout || !candidateLayout) {
    return emptyPairedMediaMask('layout-evidence-missing');
  }

  const targetCoordinateWidth = layoutViewportWidth(targetLayout);
  const candidateCoordinateWidth = layoutViewportWidth(candidateLayout);
  if (
    targetCoordinateWidth <= 0
    || candidateCoordinateWidth <= 0
    || Math.abs(targetCoordinateWidth - candidateCoordinateWidth) > 1
  ) {
    return emptyPairedMediaMask('viewport-width-mismatch');
  }

  const targetBoxes = meaningfulMediaMaskBoxes(targetLayout);
  const candidateBoxes = meaningfulMediaMaskBoxes(candidateLayout);
  if (targetBoxes.length === 0 || candidateBoxes.length === 0) {
    return emptyPairedMediaMask('media-box-evidence-missing', {
      targetMediaBoxes: targetBoxes.length,
      candidateMediaBoxes: candidateBoxes.length,
    });
  }

  const pairs = pairMediaMaskBoxes(targetBoxes, candidateBoxes);
  const targetMasks = [];
  const candidateMasks = [];
  let maskedPairs = 0;
  let protectedRects = 0;

  for (const pair of pairs) {
    const intersection = rectIntersection(pair.target.rect, pair.candidate.rect);
    if (!intersection) {
      continue;
    }

    const inset = pairedMediaEdgeInset(pair.target.box, pair.candidate.box);
    const mediaInterior = insetRect(intersection, inset);
    if (!mediaInterior) {
      continue;
    }

    const pairProtectedRects = [
      ...protectedMediaOverlayRects(targetLayout, pair.target.box),
      ...protectedMediaOverlayRects(candidateLayout, pair.candidate.box),
    ]
      .map((rect) => expandRect(rect, PAIRED_MEDIA_PROTECTED_PADDING))
      .filter((rect) => rectIntersectionArea(rect, mediaInterior) > 0);
    if (pairProtectedRects.length > PAIRED_MEDIA_MAX_PROTECTED_RECTS) {
      continue;
    }

    const maskSegments = subtractProtectedRects(mediaInterior, pairProtectedRects);
    if (maskSegments === null || maskSegments.length === 0) {
      continue;
    }

    maskedPairs += 1;
    protectedRects += pairProtectedRects.length;
    targetMasks.push(...maskSegments.map((rect) => withCoordinateWidth(rect, targetCoordinateWidth, true)));
    candidateMasks.push(...maskSegments.map((rect) => withCoordinateWidth(rect, candidateCoordinateWidth, true)));
  }

  return {
    target: targetMasks,
    candidate: candidateMasks,
    stats: {
      enabled: true,
      applied: maskedPairs > 0,
      reason: maskedPairs > 0 ? '' : 'no-safe-paired-media-interior',
      targetMediaBoxes: targetBoxes.length,
      candidateMediaBoxes: candidateBoxes.length,
      pairedBoxes: pairs.length,
      maskedPairs,
      unpairedTargetBoxes: Math.max(0, targetBoxes.length - pairs.length),
      unpairedCandidateBoxes: Math.max(0, candidateBoxes.length - pairs.length),
      protectedRects,
      maskRectangles: targetMasks.length,
    },
  };
}

function emptyPairedMediaMask(reason, stats = {}) {
  return {
    target: [],
    candidate: [],
    stats: {
      enabled: reason !== 'disabled',
      applied: false,
      reason,
      targetMediaBoxes: 0,
      candidateMediaBoxes: 0,
      pairedBoxes: 0,
      maskedPairs: 0,
      unpairedTargetBoxes: 0,
      unpairedCandidateBoxes: 0,
      protectedRects: 0,
      maskRectangles: 0,
      ...stats,
    },
  };
}

function summarizePairedMediaMasks(results, enabled) {
  const viewports = results.map((result) => ({
    label: result.label,
    ...(result.mediaMask || emptyPairedMediaMask(enabled ? 'media-box-evidence-missing' : 'disabled').stats),
  }));

  return {
    enabled,
    applied: viewports.some((viewport) => viewport.applied === true),
    pairedBoxes: viewports.reduce((total, viewport) => total + Number(viewport.pairedBoxes || 0), 0),
    maskedPairs: viewports.reduce((total, viewport) => total + Number(viewport.maskedPairs || 0), 0),
    maskRectangles: viewports.reduce((total, viewport) => total + Number(viewport.maskRectangles || 0), 0),
    viewports,
  };
}

function meaningfulMediaMaskBoxes(layout) {
  const boxes = Array.isArray(layout?.meaningfulMediaBoxes)
    ? layout.meaningfulMediaBoxes
    : Array.isArray(layout?.mediaBoxes) ? layout.mediaBoxes : [];
  const seen = new Set();
  const result = [];

  for (const box of boxes) {
    const rect = maskRectFromBox(box);
    if (!rect || rect.width * rect.height < PAIRED_MEDIA_MIN_AREA) {
      continue;
    }

    const key = [rect.x, rect.y, rect.width, rect.height]
      .map((value) => Math.round(value * 10) / 10)
      .join(':');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ box, rect });
  }

  return result;
}

function pairMediaMaskBoxes(targetBoxes, candidateBoxes) {
  const possiblePairs = [];

  for (let targetIndex = 0; targetIndex < targetBoxes.length; targetIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < candidateBoxes.length; candidateIndex += 1) {
      const targetRect = targetBoxes[targetIndex].rect;
      const candidateRect = candidateBoxes[candidateIndex].rect;
      const intersection = rectIntersectionArea(targetRect, candidateRect);
      if (intersection <= 0) {
        continue;
      }

      const targetArea = targetRect.width * targetRect.height;
      const candidateArea = candidateRect.width * candidateRect.height;
      const containedOverlap = intersection / Math.min(targetArea, candidateArea);
      const widthRatio = Math.min(targetRect.width, candidateRect.width) / Math.max(targetRect.width, candidateRect.width);
      const heightRatio = Math.min(targetRect.height, candidateRect.height) / Math.max(targetRect.height, candidateRect.height);
      if (
        containedOverlap < PAIRED_MEDIA_MIN_CONTAINED_OVERLAP
        || widthRatio < PAIRED_MEDIA_MIN_AXIS_RATIO
        || heightRatio < PAIRED_MEDIA_MIN_AXIS_RATIO
      ) {
        continue;
      }

      const union = targetArea + candidateArea - intersection;
      possiblePairs.push({
        targetIndex,
        candidateIndex,
        intersection,
        overlap: union > 0 ? intersection / union : 0,
        containedOverlap,
      });
    }
  }

  possiblePairs.sort((left, right) => (
    right.overlap - left.overlap
    || right.containedOverlap - left.containedOverlap
    || right.intersection - left.intersection
  ));
  const pairedTargets = new Set();
  const pairedCandidates = new Set();
  const pairs = [];

  for (const pair of possiblePairs) {
    if (pairedTargets.has(pair.targetIndex) || pairedCandidates.has(pair.candidateIndex)) {
      continue;
    }
    pairedTargets.add(pair.targetIndex);
    pairedCandidates.add(pair.candidateIndex);
    pairs.push({
      target: targetBoxes[pair.targetIndex],
      candidate: candidateBoxes[pair.candidateIndex],
    });
  }

  return pairs;
}

function protectedMediaOverlayRects(layout, mediaBox) {
  const textBoxes = Array.isArray(layout?.textBoxes) ? layout.textBoxes : [];
  const interactions = Array.isArray(layout?.interactions) ? layout.interactions : [];
  const overlayGroups = Array.isArray(layout?.layoutGroups)
    ? layout.layoutGroups.filter((group) => isIndependentOverlayGroup(group, mediaBox))
    : [];

  const textRects = textBoxes.flatMap((textBox) => {
    if (!structureOwnsMedia(textBox, mediaBox)) {
      return [maskRectFromBox(textBox)].filter(Boolean);
    }

    return (Array.isArray(textBox?.lines) ? textBox.lines : [])
      .map(maskRectFromBox)
      .filter(Boolean);
  });
  const interactionRects = interactions
    .filter((interaction) => !structureOwnsMedia(interaction, mediaBox))
    .map(maskRectFromBox)
    .filter(Boolean);

  return [
    ...textRects,
    ...interactionRects,
    ...overlayGroups.map(maskRectFromBox).filter(Boolean),
  ];
}

function isIndependentOverlayGroup(group, mediaBox) {
  if (group?.flowParticipation !== 'overlay') {
    return false;
  }

  const groupKey = typeof group?.key === 'string' ? group.key.trim() : '';
  return groupKey !== '' && !structureOwnsMedia({ structureKey: groupKey }, mediaBox);
}

function structureOwnsMedia(item, mediaBox) {
  const itemKey = typeof item?.structureKey === 'string' ? item.structureKey.trim() : '';
  const mediaKey = typeof mediaBox?.structureKey === 'string' ? mediaBox.structureKey.trim() : '';
  return itemKey !== ''
    && mediaKey !== ''
    && (mediaKey === itemKey || mediaKey.startsWith(`${itemKey}.`));
}

function pairedMediaEdgeInset(targetBox, candidateBox) {
  const borderWidths = [targetBox, candidateBox].flatMap((box) => [
    box?.borderTopWidth,
    box?.borderRightWidth,
    box?.borderBottomWidth,
    box?.borderLeftWidth,
  ]).map((value) => Number.parseFloat(value)).filter(Number.isFinite);
  return Math.max(PAIRED_MEDIA_EDGE_INSET, ...borderWidths) + 1;
}

function insetRect(rect, inset) {
  const amount = Number.isFinite(inset) && inset > 0 ? inset : 0;
  const width = rect.width - (amount * 2);
  const height = rect.height - (amount * 2);
  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: rect.x + amount,
    y: rect.y + amount,
    width,
    height,
  };
}

function expandRect(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + (amount * 2),
    height: rect.height + (amount * 2),
  };
}

function subtractProtectedRects(rect, protectedRects) {
  let segments = [rect];

  for (const protectedRect of protectedRects) {
    segments = segments.flatMap((segment) => subtractRect(segment, protectedRect));
    if (segments.length > PAIRED_MEDIA_MAX_MASK_RECTS) {
      return null;
    }
  }

  return segments.filter((segment) => segment.width > 0 && segment.height > 0);
}

function subtractRect(rect, cut) {
  const overlap = rectIntersection(rect, cut);
  if (!overlap) {
    return [rect];
  }

  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;
  const overlapRight = overlap.x + overlap.width;
  const overlapBottom = overlap.y + overlap.height;
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: overlap.y - rect.y },
    { x: rect.x, y: overlapBottom, width: rect.width, height: rectBottom - overlapBottom },
    { x: rect.x, y: overlap.y, width: overlap.x - rect.x, height: overlap.height },
    { x: overlapRight, y: overlap.y, width: rectRight - overlapRight, height: overlap.height },
  ].filter((segment) => segment.width > 0 && segment.height > 0);
}

function rectIntersection(left, right) {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  const width = rightEdge - x;
  const height = bottomEdge - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function layoutViewportWidth(layout) {
  const width = Number(layout?.viewport?.width);
  return Number.isFinite(width) && width > 0 ? width : 0;
}

function withCoordinateWidth(rect, coordinateWidth, sharedClip = false) {
  return coordinateWidth > 0 ? { ...rect, coordinateWidth, sharedClip } : rect;
}

function pairedIdentityMediaMaskRects(targetManifest, targetBaseDir, candidateManifest, candidateBaseDir, label) {
  const targetRects = identityMediaMaskRects(targetManifest, targetBaseDir, label);
  const candidateRects = identityMediaMaskRects(candidateManifest, candidateBaseDir, label);
  const possiblePairs = [];

  for (let targetIndex = 0; targetIndex < targetRects.length; targetIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < candidateRects.length; candidateIndex += 1) {
      const targetRect = targetRects[targetIndex];
      const candidateRect = candidateRects[candidateIndex];
      const intersection = rectIntersectionArea(targetRect, candidateRect);
      if (intersection <= 0) {
        continue;
      }

      const union = (targetRect.width * targetRect.height) + (candidateRect.width * candidateRect.height) - intersection;
      possiblePairs.push({
        targetIndex,
        candidateIndex,
        intersection,
        overlap: union > 0 ? intersection / union : 0,
      });
    }
  }

  possiblePairs.sort((left, right) => right.overlap - left.overlap || right.intersection - left.intersection);
  const pairedTargets = new Set();
  const pairedCandidates = new Set();
  const pairs = [];

  for (const pair of possiblePairs) {
    if (pairedTargets.has(pair.targetIndex) || pairedCandidates.has(pair.candidateIndex)) {
      continue;
    }
    pairedTargets.add(pair.targetIndex);
    pairedCandidates.add(pair.candidateIndex);
    pairs.push(pair);
  }

  return {
    target: pairs.map((pair) => targetRects[pair.targetIndex]),
    candidate: pairs.map((pair) => candidateRects[pair.candidateIndex]),
  };
}

function identityMediaMaskRects(manifest, baseDir, label) {
  const layout = manifestLayout(manifest, baseDir, label);
  if (!layout || !Array.isArray(layout.mediaBoxes)) {
    return [];
  }

  return layout.mediaBoxes
    .filter(isIdentityMediaBox)
    .map(maskRectFromBox)
    .filter(Boolean);
}

function isIdentityMediaBox(box) {
  if (!box || typeof box !== 'object') {
    return false;
  }

  const source = String(box.source || box.backgroundImage || '').trim();
  if (!source) {
    return false;
  }

  let pathname = source;
  try {
    pathname = new URL(source).pathname;
  } catch (error) {
    pathname = source.split(/[?#]/, 1)[0];
  }
  let basename = pathname.split('/').pop() || '';
  try {
    basename = decodeURIComponent(basename);
  } catch (error) {
    basename = String(basename);
  }

  if (/(?:^|[-_])(?:abstract|bokeh|blob|decorative|dots|gradient|illustration|noise|ornament|pattern|shape|texture|textured)(?:[-_.]|$)/i.test(basename)) {
    return false;
  }

  return /(?:logo|brand|icon|favicon|avatar|badge|rating)/i.test(basename)
    || /(?:^|[-_])(?:client|partner|sponsor)(?:[-_]?\d+)?(?:[-_.]|$)/i.test(basename);
}

function rectIntersectionArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function maskRectFromBox(box) {
  if (!box || typeof box !== 'object') {
    return null;
  }

  const rect = box.paintedRect || box.rect;
  if (!rect || typeof rect !== 'object') {
    return null;
  }

  const x = Number(rect.x ?? rect.left);
  const y = Number(rect.y ?? rect.top);
  const width = Number(rect.width ?? (Number(rect.right) - x));
  const height = Number(rect.height ?? (Number(rect.bottom) - y));
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function manifestLayout(manifest, baseDir, label) {
  if (!manifest || typeof manifest !== 'object') {
    return null;
  }

  const layoutFile = manifestLayoutFile(manifest, label);
  if (!layoutFile) {
    return null;
  }

  const layoutPath = path.resolve(baseDir, layoutFile);
  return fs.existsSync(layoutPath) ? readJson(layoutPath) : null;
}

function manifestLayoutFile(manifest, label) {
  const entries = Array.isArray(manifest.layouts)
    ? manifest.layouts
    : Array.isArray(manifest.layoutCapture?.layouts)
      ? manifest.layoutCapture.layouts
      : [];

  const entry = entries.find((item) => item && item.label === label && typeof item.file === 'string');
  if (entry) {
    return entry.file;
  }

  return typeof manifest.layout === 'string' ? manifest.layout : '';
}

function parseColor(value) {
  const color = String(value || '').trim();
  const hex = color.startsWith('#') ? color.slice(1) : color;

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
      255,
    ];
  }

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255,
    ];
  }

  throw new Error('--pad-background must be a 3- or 6-digit hex color.');
}

function padPng(PNG, image, width, height, background) {
  if (image.width === width && image.height === height) {
    return image;
  }

  const padded = new PNG({ width, height });

  for (let offset = 0; offset < padded.data.length; offset += 4) {
    padded.data[offset] = background[0];
    padded.data[offset + 1] = background[1];
    padded.data[offset + 2] = background[2];
    padded.data[offset + 3] = background[3];
  }

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = ((y * image.width) + x) * 4;
      const destination = ((y * width) + x) * 4;
      padded.data[destination] = image.data[source];
      padded.data[destination + 1] = image.data[source + 1];
      padded.data[destination + 2] = image.data[source + 2];
      padded.data[destination + 3] = image.data[source + 3];
    }
  }

  return padded;
}

function imageMaskRects(rects, imageWidth, imageHeight, sharedImageHeight) {
  return rects.flatMap((rect) => {
    const coordinateWidth = Number(rect?.coordinateWidth);
    const scale = Number.isFinite(coordinateWidth) && coordinateWidth > 0
      ? imageWidth / coordinateWidth
      : 1;
    const x = Number(rect?.x) * scale;
    const y = Number(rect?.y) * scale;
    const width = Number(rect?.width) * scale;
    const height = Number(rect?.height) * scale;
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      return [];
    }

    const left = Math.max(0, x);
    const top = Math.max(0, y);
    const right = Math.min(imageWidth, x + width);
    const clipHeight = rect?.sharedClip === true ? Math.min(imageHeight, sharedImageHeight) : imageHeight;
    const bottom = Math.min(clipHeight, y + height);
    return right > left && bottom > top
      ? [{ x: left, y: top, width: right - left, height: bottom - top }]
      : [];
  });
}

function applyRectMasks(image, rects) {
  const color = [128, 128, 128, 255];

  for (const rect of rects) {
    const x = Number(rect.x || 0);
    const y = Number(rect.y || 0);
    const width = Number(rect.width || 0);
    const height = Number(rect.height || 0);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      continue;
    }
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(image.width, Math.ceil(x + width));
    const bottom = Math.min(image.height, Math.ceil(y + height));

    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = ((y * image.width) + x) * 4;
        image.data[offset] = color[0];
        image.data[offset + 1] = color[1];
        image.data[offset + 2] = color[2];
        image.data[offset + 3] = color[3];
      }
    }
  }
}

function normalizePixelmatch(moduleValue) {
  if (typeof moduleValue === 'function') {
    return moduleValue;
  }
  if (moduleValue && typeof moduleValue.default === 'function') {
    return moduleValue.default;
  }
  throw new Error('Dependency "pixelmatch" did not export a comparison function.');
}

function readPng(PNG, file) {
  return PNG.sync.read(fs.readFileSync(path.resolve(file)));
}

function applyBudget(result, options) {
  const budget = {};
  const budgetErrors = [];

  if (typeof options.maxPercent === 'number') {
    budget.maxPercent = options.maxPercent;
    if (result.percent > options.maxPercent) {
      budgetErrors.push({
        code: 'max_percent_exceeded',
        percent: result.percent,
        maxPercent: options.maxPercent,
        message: `${result.label} diff ${result.percent.toFixed(2)}% exceeds max ${options.maxPercent.toFixed(2)}%.`,
      });
    }
  }

  if (typeof options.maxViewportPercent === 'number') {
    budget.maxViewportPercent = options.maxViewportPercent;
    const viewportResults = Array.isArray(result.results) ? result.results : [result];
    for (const item of viewportResults) {
      if (item.percent > options.maxViewportPercent) {
        budgetErrors.push({
          code: 'max_viewport_percent_exceeded',
          label: item.label,
          percent: item.percent,
          maxViewportPercent: options.maxViewportPercent,
          message: `${item.label} diff ${item.percent.toFixed(2)}% exceeds viewport max ${options.maxViewportPercent.toFixed(2)}%.`,
        });
      }
    }
  }

  if (Object.keys(budget).length === 0) {
    return result;
  }

  return {
    ...result,
    ok: budgetErrors.length === 0,
    budget,
    budgetErrors,
  };
}

function printResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (Array.isArray(result.results)) {
    for (const item of result.results) {
      console.log(`${item.label}: ${item.mismatched}/${item.total} (${item.percent.toFixed(2)}%)`);
      if (item.diff) {
        console.log(`diff_${item.label}=${item.diff}`);
      }
    }
    console.log(`${result.label}: ${result.mismatched}/${result.total} (${result.percent.toFixed(2)}%), max=${result.maxPercent.toFixed(2)}%, count=${result.count}`);
    printBudgetErrors(result);
    return;
  }

  console.log(`${result.label}: ${result.mismatched}/${result.total} (${result.percent.toFixed(2)}%)`);
  if (result.diff) {
    console.log(`diff=${result.diff}`);
  }
  printBudgetErrors(result);
}

function printBudgetErrors(result) {
  if (!Array.isArray(result.budgetErrors) || result.budgetErrors.length === 0) {
    return;
  }

  for (const item of result.budgetErrors) {
    console.log(`budget_error ${item.code}: ${item.message}`);
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = applyBudget(
      options.targetManifest ? compareScreenshotManifest(options) : compareScreenshots(options),
      options
    );
    printResult(result, options.json);
    if (result.ok === false) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
