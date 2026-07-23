#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  hasMeasuredSurfaceSize,
  normalizeMediaSurfaces,
  scaledMediaSurfaceRoleCounts,
} = require('./media-role-scale');

function parseArgs(argv) {
  const options = {
    targetDir: '',
    manifest: '',
    html: '',
    requireMarketplace: false,
    requireScreenshots: false,
    requireRenderedMedia: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target-dir') {
      options.targetDir = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--manifest') {
      options.manifest = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--html') {
      options.html = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--require-marketplace') {
      options.requireMarketplace = true;
    } else if (arg === '--require-screenshots') {
      options.requireScreenshots = true;
    } else if (arg === '--require-rendered-media') {
      options.requireRenderedMedia = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.targetDir && !options.manifest) {
    throw new Error('--target-dir or --manifest is required');
  }

  if (!options.manifest) {
    options.manifest = path.join(options.targetDir, 'target-manifest.json');
  }

  if (!options.html) {
    options.html = path.join(options.targetDir || path.dirname(options.manifest), 'target.html');
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
  audit-target-manifest.js (--target-dir dir | --manifest target-manifest.json) [--html target.html] [--require-marketplace] [--require-screenshots] [--require-rendered-media] [--json]

Audits a generated visual target before Monteby authoring starts. The command exits non-zero when a marketplace-style target lacks screenshots, media-surface roles, or HTML media evidence.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function auditTarget(options) {
  const manifest = readJson(options.manifest);
  const baseDir = options.targetDir || path.dirname(options.manifest);
  const html = fs.existsSync(options.html) ? fs.readFileSync(options.html, 'utf8') : '';
  const report = {
    ok: true,
    errors: [],
    warnings: [],
    stats: {
      screenshots: 0,
      screenshotFiles: 0,
      imageSources: 0,
      mediaSurfaces: 0,
      requiredMediaRoles: 0,
      htmlMediaReferences: 0,
      renderedLayoutFiles: 0,
      renderedFirstViewportMediaBoxes: 0,
      renderedFirstViewportMediaCoverage: 0,
      renderedHeroScaleMediaSurfaces: 0,
      renderedSecondaryScaleMediaSurfaces: 0,
      renderedServiceCardScaleMediaSurfaces: 0,
      screenshotSampledMediaBoxes: 0,
      screenshotPhotoLikeMediaBoxes: 0,
    },
  };

  auditScreenshots(report, manifest, baseDir, options.requireScreenshots);
  auditMarketplaceTarget(report, manifest, html, options);
  auditRenderedMedia(report, manifest, baseDir, options);

  report.ok = report.errors.length === 0;
  return report;
}

function auditScreenshots(report, manifest, baseDir, requireScreenshots) {
  const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
  report.stats.screenshots = screenshots.length;

  if (requireScreenshots && screenshots.length === 0) {
    error(report, 'missing_target_screenshots', 'Target audit requires captured screenshots in target-manifest.json.');
    return;
  }

  for (const screenshot of screenshots) {
    if (!screenshot || typeof screenshot !== 'object' || Array.isArray(screenshot)) {
      error(report, 'invalid_target_screenshot', 'Each target screenshot must be an object.');
      continue;
    }

    const file = typeof screenshot.file === 'string' ? screenshot.file.trim() : '';
    const label = typeof screenshot.label === 'string' ? screenshot.label.trim() : '';
    if (!label || !/\.png$/i.test(file)) {
      error(report, 'invalid_target_screenshot', 'Each target screenshot must include a non-empty label and .png file.');
      continue;
    }

    const screenshotPath = path.resolve(baseDir, file);
    if (!fileExistsWithContent(screenshotPath)) {
      error(report, 'missing_target_screenshot_file', `Target screenshot file is missing or empty: ${screenshotPath}`);
      continue;
    }

    report.stats.screenshotFiles += 1;
  }
}

function auditMarketplaceTarget(report, manifest, html, options) {
  const shouldAuditMarketplace = options.requireMarketplace || isMarketplaceManifest(manifest);
  const mediaSurfaces = normalizeMediaSurfaces(manifest.mediaSurfaces);
  const imageSources = arrayOfStrings(manifest.imageSources);
  const requiredRoles = normalizeRequiredMediaRoles(manifest.requiredMediaRoles);

  report.stats.imageSources = imageSources.length;
  report.stats.mediaSurfaces = mediaSurfaces.length;
  report.stats.requiredMediaRoles = requiredRoles.length;

  if (!shouldAuditMarketplace) {
    return;
  }

  if (options.requireMarketplace && manifest.variant !== 'marketplace-service') {
    error(report, 'not_marketplace_target', 'Expected a marketplace-service target manifest.');
  }

  if (!html) {
    error(report, 'missing_target_html', 'Marketplace target audit requires target.html so media evidence can be checked.');
  }

  if (mediaSurfaces.length === 0) {
    error(report, 'missing_media_surfaces', 'Marketplace target manifests must include mediaSurfaces with hero, secondary, and service-card roles.');
  }

  for (const [index, surface] of mediaSurfaces.entries()) {
    if (!surface.role) {
      error(report, 'missing_media_surface_role', `mediaSurfaces[${index}] is missing a role.`);
    }
    if (!surface.placement) {
      error(report, 'missing_media_surface_placement', `mediaSurfaces[${index}] is missing a placement.`);
    }
    if (!surface.source) {
      error(report, 'missing_media_surface_source', `mediaSurfaces[${index}] is missing a source.`);
      continue;
    }
    if (!isPhotoEvidenceValue(surface.source)) {
      error(report, 'non_photo_media_surface', `mediaSurfaces[${index}] source does not look like photo evidence: ${surface.source}`);
    }
    if (html && !htmlContainsSource(html, surface.source)) {
      error(report, 'media_source_not_in_html', `mediaSurfaces[${index}] source is not present in target.html: ${surface.source}`);
    } else if (html) {
      report.stats.htmlMediaReferences += 1;
    }
  }

  if (imageSources.length > 0 && !sameStringList(imageSources, mediaSurfaces.map((surface) => surface.source))) {
    error(report, 'image_sources_mismatch', 'imageSources must match mediaSurfaces[].source for generated marketplace targets.');
  }

  for (const missingRole of missingMarketplaceRoles(mediaSurfaces)) {
    error(report, 'missing_media_surface_role_count', missingRole);
  }

  for (const role of ['hero', 'secondary', 'service-card']) {
    if (!requiredRoles.includes(role)) {
      error(report, 'missing_required_media_role', `requiredMediaRoles must include "${role}".`);
    }
  }
}

function auditRenderedMedia(report, manifest, baseDir, options) {
  if (!options.requireRenderedMedia) {
    return;
  }

  const layouts = renderedLayoutEntries(manifest);
  if (layouts.length === 0) {
    error(report, 'missing_rendered_layout', 'Rendered media audit requires layout files from capture-template-reference.js --capture-layout.');
    return;
  }

  for (const [index, layoutEntry] of layouts.entries()) {
    if (layoutEntry.status !== 'ok') {
      error(report, 'failed_rendered_layout', `Rendered layout "${layoutEntry.label || index + 1}" is ${layoutEntry.status || 'missing'}. ${layoutEntry.error || ''}`.trim());
      continue;
    }

    const layoutPath = layoutEntry.file ? path.resolve(baseDir, layoutEntry.file) : '';
    if (!layoutPath || !fileExistsWithContent(layoutPath)) {
      error(report, 'missing_rendered_layout_file', `Rendered layout file is missing or empty: ${layoutPath || layoutEntry.file || '(empty)'}`);
      continue;
    }

    const layout = readJson(layoutPath);
    const summary = layout && typeof layout === 'object' && !Array.isArray(layout) && layout.summary && typeof layout.summary === 'object'
      ? layout.summary
      : {};
    const mediaBoxes = Number.isFinite(summary.firstViewportMediaBoxes) ? summary.firstViewportMediaBoxes : 0;
    const coverage = Number.isFinite(summary.firstViewportMediaCoverage) ? summary.firstViewportMediaCoverage : 0;

    report.stats.renderedLayoutFiles += 1;
    report.stats.renderedFirstViewportMediaBoxes += mediaBoxes;
    report.stats.renderedFirstViewportMediaCoverage = Math.max(report.stats.renderedFirstViewportMediaCoverage, coverage);

    if (mediaBoxes < 1) {
      error(report, 'missing_rendered_first_viewport_media', `Rendered layout "${layoutEntry.label || index + 1}" has no first-viewport media boxes.`);
    }

    const minimumCoverage = index === 0 ? 0.08 : 0.04;
    if (coverage < minimumCoverage) {
      error(report, 'low_rendered_first_viewport_media_coverage', `Rendered layout "${layoutEntry.label || index + 1}" has ${Math.round(coverage * 100)}% first-viewport media coverage; expected at least ${Math.round(minimumCoverage * 100)}%.`);
    }
  }

  auditRenderedMediaRoleScale(report, manifest);
  auditRenderedScreenshotPhotoEvidence(report, manifest, baseDir);
}

function renderedLayoutEntries(manifest) {
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
      error: typeof layout?.error === 'string' ? layout.error.trim() : '',
    }));
  }

  const layoutFile = typeof manifest?.layout === 'string' ? manifest.layout.trim() : '';
  if (!layoutFile) {
    return [];
  }

  return [{
    label: 'primary',
    file: layoutFile,
    status: typeof manifest?.layoutCapture?.status === 'string' ? manifest.layoutCapture.status : 'ok',
    error: typeof manifest?.layoutCapture?.error === 'string' ? manifest.layoutCapture.error : '',
  }];
}

function isMarketplaceManifest(manifest) {
  return manifest && typeof manifest === 'object' && !Array.isArray(manifest)
    && (
      manifest.variant === 'marketplace-service'
      || normalizeMediaSurfaces(manifest.mediaSurfaces).length > 0
      || normalizeRequiredMediaRoles(manifest.requiredMediaRoles).some((role) => ['hero', 'secondary', 'service-card'].includes(role))
    );
}

function auditRenderedMediaRoleScale(report, manifest) {
  const surfaces = normalizeMediaSurfaces(renderedMediaSurfaces(manifest)).filter(hasMeasuredSurfaceSize);
  if (surfaces.length === 0) {
    return;
  }

  const heroSurfaces = surfaces.filter((surface) => surface.role === 'hero' && surface.placement === 'firstViewport');
  const secondarySurfaces = surfaces.filter((surface) => surface.role === 'secondary' && surface.placement === 'firstViewport');
  const serviceCardSurfaces = surfaces.filter((surface) => surface.role === 'service-card' && surface.placement === 'afterHero');
  const scaledCounts = scaledMediaSurfaceRoleCounts(surfaces);

  report.stats.renderedHeroScaleMediaSurfaces = scaledCounts.hero || 0;
  report.stats.renderedSecondaryScaleMediaSurfaces = scaledCounts.secondary || 0;
  report.stats.renderedServiceCardScaleMediaSurfaces = scaledCounts['service-card'] || 0;

  if (heroSurfaces.length > 0 && report.stats.renderedHeroScaleMediaSurfaces === 0) {
    error(report, 'undersized_rendered_hero_media_surface', 'Rendered target hero media is too small for a marketplace benchmark; expected a large first-viewport photo surface, not a thumbnail or decorative image.');
  }

  if (secondarySurfaces.length > 0 && report.stats.renderedSecondaryScaleMediaSurfaces === 0) {
    error(report, 'undersized_rendered_secondary_media_surface', 'Rendered target secondary media is too small for a marketplace benchmark; expected a readable first-viewport proof/detail/equipment image.');
  }

  if (serviceCardSurfaces.length >= 3 && report.stats.renderedServiceCardScaleMediaSurfaces < 3) {
    error(report, 'undersized_rendered_service_card_media_surface', `Rendered target service-card media is too small (${report.stats.renderedServiceCardScaleMediaSurfaces}/3 scaled surfaces); expected card-level service photos, not icons, logos, avatars, or thumbnail strips.`);
  }
}

function renderedMediaSurfaces(manifest) {
  return Array.isArray(manifest?.renderedMediaSurfaces) && manifest.renderedMediaSurfaces.length > 0
    ? manifest.renderedMediaSurfaces
    : manifest?.mediaSurfaces;
}

function auditRenderedScreenshotPhotoEvidence(report, manifest, baseDir) {
  const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
  if (screenshots.length === 0) {
    return;
  }

  let PNG;
  try {
    PNG = loadPngDependency().PNG;
  } catch (loadError) {
    error(report, 'screenshot_photo_evidence_dependency_missing', loadError instanceof Error ? loadError.message : String(loadError));
    return;
  }

  const layouts = renderedLayoutEntries(manifest)
    .filter((layout) => layout.status === 'ok' || !layout.status);

  for (const screenshot of screenshots) {
    const file = typeof screenshot?.file === 'string' ? screenshot.file.trim() : '';
    const label = typeof screenshot?.label === 'string' ? screenshot.label.trim() : '';
    const screenshotPath = file ? path.resolve(baseDir, file) : '';
    if (!screenshotPath || !fileExistsWithContent(screenshotPath)) {
      continue;
    }

    const layoutEntry = layouts.find((layout) => layout.label === label)
      || layouts.find((layout) => layout.label === 'desktop')
      || layouts[0]
      || null;
    if (!layoutEntry || !layoutEntry.file) {
      continue;
    }

    const layoutPath = path.resolve(baseDir, layoutEntry.file);
    if (!fileExistsWithContent(layoutPath)) {
      continue;
    }

    let png;
    try {
      png = PNG.sync.read(fs.readFileSync(screenshotPath));
    } catch (readError) {
      error(report, 'invalid_target_screenshot_png', `Target screenshot is not a readable PNG: ${screenshotPath}. ${readError instanceof Error ? readError.message : String(readError)}`);
      continue;
    }

    const layout = readJson(layoutPath);
    const boxes = firstViewportPhotoMediaBoxes(layout).slice(0, 5);
    for (const box of boxes) {
      const texture = mediaBoxTextureEvidence(png, layout.viewport || {}, box);
      report.stats.screenshotSampledMediaBoxes += texture.sampled ? 1 : 0;
      report.stats.screenshotPhotoLikeMediaBoxes += texture.photoLike ? 1 : 0;
    }
  }

  if (report.stats.screenshotSampledMediaBoxes === 0) {
    error(report, 'target_screenshot_media_boxes_missing', 'Target screenshots could not be checked for visible photography because no first-viewport rendered photo boxes were available.');
    return;
  }

  if (report.stats.screenshotPhotoLikeMediaBoxes === 0) {
    error(report, 'target_screenshot_photo_evidence_missing', 'Rendered target media boxes are present, but screenshot pixels do not show photographic texture. Regenerate or recapture before authoring Monteby JSON.');
  }
}

function loadPngDependency() {
  try {
    return {
      PNG: require(require.resolve('pngjs', { paths: [__dirname, process.cwd()] })).PNG,
    };
  } catch (loadError) {
    if (loadError && loadError.code === 'MODULE_NOT_FOUND') {
      throw new Error('Missing dependency "pngjs"; screenshot photo evidence could not be checked.');
    }
    throw loadError;
  }
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
    .filter((box) => isPhotoEvidenceValue(box.source || box.backgroundImage || ''))
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
      photoLike: false,
    };
  }

  const mean = lumas.reduce((sum, value) => sum + value, 0) / lumas.length;
  const variance = lumas.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / lumas.length;
  const lumaStddev = Math.sqrt(variance);
  const edgeRatio = comparedTransitions > 0 ? edgeTransitions / comparedTransitions : 0;
  const uniqueColorBuckets = buckets.size;
  const photoLike = (uniqueColorBuckets >= 24 && lumaStddev >= 14 && edgeRatio >= 0.04)
    || (uniqueColorBuckets >= 42 && lumaStddev >= 10 && edgeRatio >= 0.025);

  return {
    sampled: true,
    photoLike,
  };
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRequiredMediaRoles(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((role) => {
      if (typeof role === 'string') {
        return role.trim();
      }
      if (role && typeof role === 'object' && !Array.isArray(role) && typeof role.role === 'string') {
        return role.role.trim();
      }
      return '';
    })
    .filter(Boolean);
}

function missingMarketplaceRoles(mediaSurfaces) {
  const firstViewport = mediaSurfaces.filter((surface) => surface.placement === 'firstViewport');
  const afterHero = mediaSurfaces.filter((surface) => surface.placement === 'afterHero');
  const heroCount = firstViewport.filter((surface) => surface.role === 'hero').length;
  const secondaryCount = firstViewport.filter((surface) => surface.role === 'secondary').length;
  const serviceCardCount = afterHero.filter((surface) => surface.role === 'service-card').length;
  const missing = [];

  if (heroCount < 1) {
    missing.push('mediaSurfaces must include at least one firstViewport hero image.');
  }
  if (secondaryCount < 1) {
    missing.push('mediaSurfaces must include at least one firstViewport secondary image.');
  }
  if (serviceCardCount < 3) {
    missing.push(`mediaSurfaces must include at least three afterHero service-card images (${serviceCardCount}/3).`);
  }

  return missing;
}

function htmlContainsSource(html, source) {
  return html.includes(source) || html.includes(escapeHtml(source));
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function sameStringList(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function fileExistsWithContent(file) {
  try {
    return fs.statSync(file).size > 0;
  } catch (error) {
    return false;
  }
}

function isPhotoEvidenceValue(value) {
  const normalized = String(value || '').trim();
  return /\.(?:avif|jpe?g|png|webp)(?:[?#].*)?$/i.test(normalized)
    || /images\.unsplash\.com\/photo-/i.test(normalized)
    || /images\.pexels\.com\/photos\//i.test(normalized)
    || /source\.unsplash\.com/i.test(normalized)
    || /picsum\.photos/i.test(normalized);
}

function error(report, code, message) {
  report.errors.push({ code, message });
}

function printReport(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`monteby_target_audit=${report.ok ? 'ok' : 'failed'}`);
  console.log(`screenshots=${report.stats.screenshots}`);
  console.log(`media_surfaces=${report.stats.mediaSurfaces}`);
  console.log(`rendered_layouts=${report.stats.renderedLayoutFiles}`);
  console.log(`rendered_first_viewport_media_coverage=${Math.round(report.stats.renderedFirstViewportMediaCoverage * 100)}%`);
  for (const item of report.errors) {
    console.log(`error ${item.code}: ${item.message}`);
  }
  for (const item of report.warnings) {
    console.log(`warning ${item.code}: ${item.message}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = auditTarget(options);
  printReport(report, options.json);
  process.exitCode = report.ok ? 0 : 1;
}

main();
