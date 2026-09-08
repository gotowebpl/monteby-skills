'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { selectDraftStrategy } = require('../monteby-site-authoring/scripts/draft-strategy');

test('measured strategy never enables historical family recipes even when the brief names one', () => {
  const strategy = selectDraftStrategy({
    target: { archetype: 'maid-service-agency', referenceStyle: 'historical-family' },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: 'historical-family', familyMechanics: true },
      referenceGeometry: { desktop: { bands: [] } },
    },
  });
  assert.deepEqual(strategy, {
    name: 'generic-measured-reference', allowHistoricalRecipes: false, allowFamilyProfile: false,
  });
});

test('generated target uses measured strategy only when real geometry exists', () => {
  assert.equal(selectDraftStrategy({
    authoringRequirements: { referenceClassification: { kind: 'generated-target' }, referenceGeometry: {} },
  }).name, 'generic-measured-reference');
  assert.equal(selectDraftStrategy({
    authoringRequirements: { referenceClassification: { kind: 'generated-target' } },
  }).name, 'historical-or-generated-recipe');
});
