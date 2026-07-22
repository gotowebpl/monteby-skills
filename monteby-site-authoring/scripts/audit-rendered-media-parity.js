#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MEANINGFUL_VIEWPORT_COVERAGE_FLOOR = 0.02;

function parseArgs(argv) {
  const options = {
    referenceManifest: '',
    candidateManifest: '',
    minCoverageRatio: 0.5,
    minAbsoluteCoverage: 0.12,
    allowReferenceMediaReuse: false,
    requireViewportCoverage: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reference-manifest') {
      options.referenceManifest = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--candidate-manifest') {
      options.candidateManifest = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--min-coverage-ratio') {
      options.minCoverageRatio = parseNonNegativeNumber(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--min-absolute-coverage') {
      options.minAbsoluteCoverage = parseNonNegativeNumber(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--allow-reference-media-reuse') {
      options.allowReferenceMediaReuse = true;
    } else if (arg === '--require-viewport-coverage') {
      options.requireViewportCoverage = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.referenceManifest) {
    throw new Error('--reference-manifest is required');
  }
  if (!options.candidateManifest) {
    throw new Error('--candidate-manifest is required');
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

function parseNonNegativeNumber(value, arg) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${arg} must be a non-negative number`);
  }
  return number;
}

function printHelp() {
  console.log(`Usage:
  audit-rendered-media-parity.js --reference-manifest reference-manifest.json --candidate-manifest reference-manifest.json [--min-coverage-ratio 0.5] [--min-absolute-coverage 0.12] [--require-viewport-coverage] [--json]

Compares rendered media roles from capture-template-reference.js manifests and fails when the candidate page loses required photo roles, first-viewport media coverage, or reuses captured reference media URLs.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function buildReport(options) {
  const referenceManifest = readJson(options.referenceManifest);
  const candidateManifest = readJson(options.candidateManifest);
  const referenceLayout = readLayoutSummary(options.referenceManifest, referenceManifest);
  const candidateLayout = readLayoutSummary(options.candidateManifest, candidateManifest);
  const requiredRoles = requiredMediaRoles(referenceManifest);
  const referenceRoleCounts = mediaSurfaceRoleCounts(referenceManifest.mediaSurfaces);
  const candidateRoleCounts = mediaSurfaceRoleCounts(candidateManifest.mediaSurfaces);
  const errors = [];
  const warnings = [];

  for (const role of requiredRoles) {
    const count = candidateRoleCounts[role.role] || 0;
    if (count < role.minSurfaces) {
      errors.push(error('missing_rendered_media_role', `Candidate render is missing required "${role.role}" media role (${count}/${role.minSurfaces}).`));
    }
  }

  const coverageReport = firstViewportCoverageReport(referenceLayout, candidateLayout, options);
  if (coverageReport.error) {
    errors.push(coverageReport.error);
  } else if (coverageReport.warning) {
    warnings.push(coverageReport.warning);
  }

  const viewportCoverage = viewportCoverageReports(options.referenceManifest, referenceManifest, options.candidateManifest, candidateManifest, options);
  for (const item of viewportCoverage) {
    if (item.error) {
      errors.push(item.error);
    } else if (item.warning) {
      warnings.push(item.warning);
    }
  }

  const hasCapturedReferenceSource = typeof referenceManifest.sourceUrl === 'string' && /^https?:\/\//i.test(referenceManifest.sourceUrl);
  const reused = options.allowReferenceMediaReuse || !hasCapturedReferenceSource
    ? []
    : reusedReferenceMedia(referenceManifest, candidateManifest);
  if (reused.length > 0) {
    errors.push(error('reused_reference_media', `Candidate render reuses ${reused.length} captured reference media URL(s). Use replacement licensed/generated/user-provided assets.`));
  }

  return {
    ok: errors.length === 0,
    files: {
      referenceManifest: options.referenceManifest,
      candidateManifest: options.candidateManifest,
    },
    stats: {
      requiredRoles: requiredRoles.length,
      referenceRoleCounts,
      candidateRoleCounts,
      referenceFirstViewportMediaCoverage: coverageReport.referenceCoverage,
      candidateFirstViewportMediaCoverage: coverageReport.candidateCoverage,
      minimumCandidateFirstViewportMediaCoverage: coverageReport.minimumCoverage,
      viewportCoverage,
      reusedReferenceMedia: reused.length,
    },
    requiredRoles,
    errors,
    warnings,
  };
}

function requiredMediaRoles(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.requiredMediaRoles)) {
    return [];
  }

  return manifest.requiredMediaRoles
    .map((role) => {
      if (!role || typeof role !== 'object' || Array.isArray(role)) {
        return { role: '', minSurfaces: 1, placement: '', description: '' };
      }
      return {
        role: typeof role.role === 'string' ? role.role.trim() : '',
        minSurfaces: Number.isInteger(role.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1,
        placement: typeof role.placement === 'string' ? role.placement.trim() : '',
        description: typeof role.description === 'string' ? role.description.trim() : '',
      };
    })
    .filter((role) => role.role);
}

function mediaSurfaceRoleCounts(mediaSurfaces) {
  if (!Array.isArray(mediaSurfaces)) {
    return {};
  }

  return mediaSurfaces.reduce((counts, surface) => {
    if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
      return counts;
    }
    const role = typeof surface.role === 'string' ? surface.role.trim() : '';
    if (role) {
      counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
  }, {});
}

function readLayoutSummary(manifestPath, manifest) {
  const layoutFile = typeof manifest?.layout === 'string' ? manifest.layout.trim() : '';
  const semanticCoverage = coverageValue(manifest);
  if (!layoutFile) {
    return {
      status: 'missing',
      summary: Number.isFinite(semanticCoverage) ? { firstViewportMediaCoverage: semanticCoverage } : null,
    };
  }

  const resolved = path.resolve(path.dirname(path.resolve(manifestPath)), layoutFile);
  if (!fs.existsSync(resolved)) {
    return {
      status: 'missing',
      summary: Number.isFinite(semanticCoverage) ? { firstViewportMediaCoverage: semanticCoverage } : null,
    };
  }

  const layout = readJson(resolved);
  const summary = layout && typeof layout === 'object' && !Array.isArray(layout) ? layout.summary || null : null;
  return {
    status: 'ok',
    summary: Number.isFinite(semanticCoverage)
      ? { ...(summary || {}), firstViewportMediaCoverage: semanticCoverage }
      : summary,
  };
}

function firstViewportCoverageReport(referenceLayout, candidateLayout, options) {
  const referenceCoverage = coverageValue(referenceLayout.summary);
  const candidateCoverage = coverageValue(candidateLayout.summary);
  const result = {
    referenceCoverage,
    candidateCoverage,
    minimumCoverage: 0,
    error: null,
    warning: null,
  };

  if (!Number.isFinite(referenceCoverage) || referenceCoverage <= 0) {
    result.warning = warning('missing_reference_coverage', 'Reference layout summary has no firstViewportMediaCoverage; rendered media roles are still checked.');
    return result;
  }

  if (!Number.isFinite(candidateCoverage)) {
    result.error = error('missing_candidate_coverage', 'Candidate layout summary has no firstViewportMediaCoverage. Capture the candidate with --capture-layout before benchmark parity.');
    return result;
  }

  result.minimumCoverage = minimumCandidateCoverage(referenceCoverage, options);
  if (candidateCoverage < result.minimumCoverage) {
    result.error = error(
      'first_viewport_media_coverage_drop',
      `Candidate first-viewport media coverage is too low (${formatCoverage(candidateCoverage)}; expected at least ${formatCoverage(result.minimumCoverage)} from reference ${formatCoverage(referenceCoverage)}).`,
    );
  }

  return result;
}

function viewportCoverageReports(referenceManifestPath, referenceManifest, candidateManifestPath, candidateManifest, options) {
  const referenceEntries = layoutCoverageEntries(referenceManifestPath, referenceManifest);
  const candidateEntries = layoutCoverageEntries(candidateManifestPath, candidateManifest);
  const candidateByLabel = new Map(candidateEntries.map((entry) => [entry.label, entry]));
  const enforced = options.requireViewportCoverage === true;
  const reports = [];

  for (const referenceEntry of referenceEntries) {
    if (!Number.isFinite(referenceEntry.coverage) || referenceEntry.coverage <= 0) {
      continue;
    }

    const candidateEntry = candidateByLabel.get(referenceEntry.label);
    const minimumCoverage = minimumCandidateCoverage(referenceEntry.coverage, options);
    const report = {
      label: referenceEntry.label,
      referenceCoverage: referenceEntry.coverage,
      candidateCoverage: Number.isFinite(candidateEntry?.coverage) ? candidateEntry.coverage : null,
      minimumCoverage,
      enforced,
      error: null,
      warning: null,
    };

    if (referenceEntry.coverage < MEANINGFUL_VIEWPORT_COVERAGE_FLOOR) {
      report.minimumCoverage = 0;
      report.enforced = false;
      report.warning = warning(
        'viewport_reference_coverage_below_photo_floor',
        `Reference ${referenceEntry.label} first-viewport media coverage is only ${formatCoverage(referenceEntry.coverage)}. Treating this viewport as logo/decorative media rather than photo-led pressure.`,
      );
      reports.push(report);
      continue;
    }

    if (!candidateEntry || !Number.isFinite(candidateEntry.coverage)) {
      const issue = (enforced ? error : warning)(
        'viewport_media_coverage_missing',
        `Candidate ${referenceEntry.label} layout has no first-viewport media coverage. Capture every benchmark viewport with --capture-layout before judging photo-led template fidelity.`,
      );
      report[enforced ? 'error' : 'warning'] = issue;
    } else if (candidateEntry.coverage < minimumCoverage) {
      const issue = (enforced ? error : warning)(
        'viewport_media_coverage_drop',
        `Candidate ${referenceEntry.label} first-viewport media coverage is too low (${formatCoverage(candidateEntry.coverage)}; expected at least ${formatCoverage(minimumCoverage)} from reference ${formatCoverage(referenceEntry.coverage)}). Keep visible photography in this viewport instead of only satisfying desktop media roles.`,
      );
      report[enforced ? 'error' : 'warning'] = issue;
    }

    reports.push(report);
  }

  return reports;
}

function layoutCoverageEntries(manifestPath, manifest) {
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const entries = comparableLayoutEntries(manifest);
  const result = [];

  for (const entry of entries) {
    const coverage = coverageForLayoutFile(manifestDir, entry.file);
    const fallbackCoverage = entry.isPrimary ? coverageValue(manifest) : NaN;
    result.push({
      label: entry.label,
      coverage: Number.isFinite(coverage) ? coverage : fallbackCoverage,
    });
  }

  return result;
}

function comparableLayoutEntries(manifest) {
  const entries = Array.isArray(manifest?.layoutCapture?.layouts)
    ? manifest.layoutCapture.layouts
    : Array.isArray(manifest?.layouts)
      ? manifest.layouts
      : [];
  const normalized = [];
  const seen = new Set();

  for (const entry of entries) {
    const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
    const file = typeof entry?.file === 'string' ? entry.file.trim() : '';
    if (!label || !file || seen.has(label) || entry.status === 'failed') {
      continue;
    }
    seen.add(label);
    normalized.push({ label, file, isPrimary: file === manifest?.layout });
  }

  const primaryFile = typeof manifest?.layout === 'string' ? manifest.layout.trim() : '';
  if (primaryFile && !seen.has('desktop')) {
    normalized.unshift({ label: 'desktop', file: primaryFile, isPrimary: true });
  }

  return normalized;
}

function coverageForLayoutFile(manifestDir, file) {
  if (!file) {
    return NaN;
  }

  const resolved = path.isAbsolute(file) ? file : path.join(manifestDir, file);
  if (!fs.existsSync(resolved)) {
    return NaN;
  }

  const layout = readJson(resolved);
  return coverageValue(layout?.summary);
}

function minimumCandidateCoverage(referenceCoverage, options) {
  return Math.max(
    referenceCoverage * options.minCoverageRatio,
    Math.min(options.minAbsoluteCoverage, referenceCoverage),
  );
}

function coverageValue(summary) {
  const value = summary && typeof summary === 'object' ? summary.firstViewportMediaCoverage : null;
  return Number.isFinite(value) ? value : NaN;
}

function reusedReferenceMedia(referenceManifest, candidateManifest) {
  const reference = new Set(mediaUrls(referenceManifest));
  return mediaUrls(candidateManifest).filter((url, index, urls) => reference.has(url) && urls.indexOf(url) === index);
}

function mediaUrls(manifest) {
  const urls = [];
  for (const url of Array.isArray(manifest?.media) ? manifest.media : []) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      urls.push(normalizeMediaUrl(url));
    }
  }
  for (const surface of Array.isArray(manifest?.mediaSurfaces) ? manifest.mediaSurfaces : []) {
    const source = typeof surface?.source === 'string' ? surface.source : '';
    if (/^https?:\/\//i.test(source)) {
      urls.push(normalizeMediaUrl(source));
    }
  }
  return urls.filter(Boolean);
}

function normalizeMediaUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return '';
  }
}

function error(code, message) {
  return { code, message };
}

function warning(code, message) {
  return { code, message };
}

function formatCoverage(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'n/a';
}

function printSummary(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`rendered_media_parity=${report.ok ? 'ok' : 'failed'}`);
  console.log(`reference_roles=${formatRoleCounts(report.stats.referenceRoleCounts)}`);
  console.log(`candidate_roles=${formatRoleCounts(report.stats.candidateRoleCounts)}`);
  console.log(`reference_first_viewport_coverage=${formatCoverage(report.stats.referenceFirstViewportMediaCoverage)}`);
  console.log(`candidate_first_viewport_coverage=${formatCoverage(report.stats.candidateFirstViewportMediaCoverage)}`);
  for (const item of report.errors) {
    console.log(`error ${item.code}: ${item.message}`);
  }
}

function formatRoleCounts(counts) {
  const roles = ['hero', 'secondary', 'service-card', 'reference-media'];
  const parts = roles
    .filter((role) => Number.isFinite(counts?.[role]) && counts[role] > 0)
    .map((role) => `${role}:${counts[role]}`);

  return parts.length > 0 ? parts.join(', ') : 'none';
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = buildReport(options);
    printSummary(report, options.json);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
