'use strict';

const { createHash } = require('node:crypto');

const MAX_VIEWPORT_SUM_PX = 1;
const MAX_SINGLE_DELTA_PX = 0.5;
const ALLOWED_RESIDUAL_BLOCKERS = new Set([
  'canonical_zero_diff_evidence_missing',
  'generic_geometry_band_height_mismatch',
]);

function roundHundredth(value) {
  return Math.round(Number(value) * 100) / 100;
}

function geometryHeightResiduals(report) {
  const viewports = report?.genericGeometry?.stats?.viewports;
  if (!Array.isArray(viewports)) return [];
  const residuals = [];
  for (const viewport of viewports) {
    const label = String(viewport?.label || '');
    const pairs = Array.isArray(viewport?.geometry?.pairs) ? viewport.geometry.pairs : [];
    if (!label || pairs.length === 0) return [];
    const deltas = [];
    for (const pair of pairs) {
      if (!Number.isFinite(pair?.referenceIndex)
        || !Number.isFinite(pair?.candidateIndex)
        || !Number.isFinite(pair?.signedHeightDeltaPx)) {
        return [];
      }
      deltas.push({
        referenceIndex: pair.referenceIndex,
        candidateIndex: pair.candidateIndex,
        delta: roundHundredth(pair.signedHeightDeltaPx),
      });
    }
    residuals.push({
      label,
      deltas,
      sumAbsoluteDelta: roundHundredth(deltas.reduce((total, pair) => total + Math.abs(pair.delta), 0)),
      maxAbsoluteDelta: roundHundredth(deltas.reduce((maximum, pair) => Math.max(maximum, Math.abs(pair.delta)), 0)),
    });
  }
  return residuals;
}

function sameResiduals(left, right) {
  if (left.length !== right.length) return false;
  return left.every((viewport, viewportIndex) => {
    const other = right[viewportIndex];
    return viewport.label === other?.label
      && viewport.deltas.length === other.deltas.length
      && viewport.deltas.every((pair, pairIndex) => {
        const otherPair = other.deltas[pairIndex];
        return pair.referenceIndex === otherPair?.referenceIndex
          && pair.candidateIndex === otherPair?.candidateIndex
          && pair.delta === otherPair?.delta;
      });
  });
}

function evaluateSubpixelFixedPoint(localReport, canonicalReport, blockers) {
  const local = geometryHeightResiduals(localReport);
  const canonical = geometryHeightResiduals(canonicalReport);
  const blockerCodes = (Array.isArray(blockers) ? blockers : [])
    .map((blocker) => String(blocker?.code || ''))
    .filter(Boolean);
  const forbiddenBlockers = blockerCodes.filter((code) => !ALLOWED_RESIDUAL_BLOCKERS.has(code));
  const withinBudget = canonical.length > 0 && canonical.every((viewport) => (
    viewport.sumAbsoluteDelta <= MAX_VIEWPORT_SUM_PX
    && viewport.maxAbsoluteDelta <= MAX_SINGLE_DELTA_PX
  ));
  return {
    eligible: sameResiduals(local, canonical) && withinBudget && forbiddenBlockers.length === 0,
    stableAtHundredthPixel: sameResiduals(local, canonical),
    withinBudget,
    forbiddenBlockers,
    viewports: canonical,
    thresholds: {
      maxViewportSumPx: MAX_VIEWPORT_SUM_PX,
      maxSingleDeltaPx: MAX_SINGLE_DELTA_PX,
      roundingPx: 0.01,
    },
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildSubpixelResidual(evaluation, bindings) {
  const stableEvidence = {
    schemaVersion: 1,
    artifact: 'monteby-subpixel-residual',
    verdict: 'canonical_verified_with_authorized_residual',
    stableAtHundredthPixel: evaluation.stableAtHundredthPixel,
    thresholds: evaluation.thresholds,
    bindings,
    viewports: evaluation.viewports,
  };
  return {
    ...stableEvidence,
    generatedAt: new Date().toISOString(),
    residualSha256: createHash('sha256').update(canonicalJson(stableEvidence)).digest('hex'),
  };
}

function validateSubpixelAuthorization(authorization, residual) {
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) {
    return { ok: false, code: 'subpixel_authorization_missing' };
  }
  if (
    authorization.schemaVersion !== 1
    || authorization.artifact !== 'monteby-subpixel-authorization'
    || typeof authorization.authorizedBy !== 'string'
    || !authorization.authorizedBy.trim()
    || !Number.isFinite(Date.parse(String(authorization.authorizedAt || '')))
  ) {
    return { ok: false, code: 'subpixel_authorization_invalid' };
  }
  if (authorization.residualSha256 !== residual.residualSha256) {
    return { ok: false, code: 'subpixel_authorization_residual_mismatch' };
  }
  if (canonicalJson(authorization.bindings) !== canonicalJson(residual.bindings)) {
    return { ok: false, code: 'subpixel_authorization_binding_mismatch' };
  }
  return {
    ok: true,
    code: 'subpixel_authorization_valid',
    authorizedBy: authorization.authorizedBy.trim(),
    authorizedAt: authorization.authorizedAt,
  };
}

module.exports = {
  buildSubpixelResidual,
  evaluateSubpixelFixedPoint,
  geometryHeightResiduals,
  validateSubpixelAuthorization,
};
