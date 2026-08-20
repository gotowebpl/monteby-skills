'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSubpixelResidual,
  evaluateSubpixelFixedPoint,
  validateSubpixelAuthorization,
} = require('../monteby-site-authoring/scripts/subpixel-residual');

function geometry(deltasByViewport) {
  return {
    genericGeometry: {
      stats: {
        viewports: Object.entries(deltasByViewport).map(([label, deltas]) => ({
          label,
          geometry: {
            pairs: deltas.map((delta, index) => ({
              referenceIndex: index,
              candidateIndex: index,
              signedHeightDelta: delta,
            })),
          },
        })),
      },
    },
  };
}

test('subpixel fixed point accepts stable 0.99px sums and rejects 1.01px', () => {
  const stable = geometry({ desktop: [0.49, 0.5], tablet: [0.2], mobile: [-0.4] });
  const eligible = evaluateSubpixelFixedPoint(stable, stable, [{ code: 'canonical_zero_diff_evidence_missing' }]);
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.viewports[0].sumAbsoluteDelta, 0.99);

  const over = geometry({ desktop: [0.5, 0.5, 0.01] });
  assert.equal(evaluateSubpixelFixedPoint(over, over, []).eligible, false);
});

test('subpixel fixed point rejects unstable measurements and semantic blockers', () => {
  const local = geometry({ desktop: [0.2] });
  const changed = geometry({ desktop: [0.21] });
  assert.equal(evaluateSubpixelFixedPoint(local, changed, []).stableAtHundredthPixel, false);
  assert.equal(evaluateSubpixelFixedPoint(local, local, [{ code: 'content_ledger_incomplete' }]).eligible, false);
  assert.equal(evaluateSubpixelFixedPoint(local, local, [{ code: 'max_percent_exceeded' }]).eligible, false);
  assert.equal(evaluateSubpixelFixedPoint(local, local, [{ code: 'visual_budget_failed' }]).eligible, false);
});

test('authorization binds the exact residual and all evidence hashes', () => {
  const evaluation = evaluateSubpixelFixedPoint(
    geometry({ desktop: [0.2] }),
    geometry({ desktop: [0.2] }),
    []
  );
  const bindings = {
    pageSha256: 'a'.repeat(64),
    layoutSha256: 'b'.repeat(64),
    manifestSha256: 'c'.repeat(64),
    iterationSha256: 'd'.repeat(64),
  };
  const residual = buildSubpixelResidual(evaluation, bindings);
  const authorization = {
    schemaVersion: 1,
    artifact: 'monteby-subpixel-authorization',
    authorizedBy: 'Release Owner',
    authorizedAt: '2026-08-20T10:00:00.000Z',
    residualSha256: residual.residualSha256,
    bindings,
  };

  assert.equal(validateSubpixelAuthorization(authorization, residual).ok, true);
  assert.equal(validateSubpixelAuthorization({
    ...authorization,
    bindings: { ...bindings, pageSha256: 'e'.repeat(64) },
  }, residual).code, 'subpixel_authorization_binding_mismatch');
});
