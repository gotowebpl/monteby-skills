'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { selectDraftStrategy } = require('../monteby-site-authoring/scripts/draft-strategy');

const scriptsDirectory = path.resolve(__dirname, '..', 'monteby-site-authoring', 'scripts');

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
  }).name, 'generated-benchmark-recipe');
  assert.equal(selectDraftStrategy({
    authoringRequirements: {
      referenceClassification: { kind: 'historical-benchmark-recipe' },
      referenceGeometry: { desktop: { bands: [] } },
    },
  }).name, 'generated-benchmark-recipe');
});

test('captured geometry always uses the generic path without recognizing client names', () => {
  for (const archetype of [
    'maid-service-agency',
    'luxury-car-care',
    'optomatta-optical-retail',
    'lumen-eye-care-editorial',
  ]) {
    assert.deepEqual(selectDraftStrategy({
      target: { archetype, referenceStyle: `${archetype} client page` },
      authoringRequirements: {
        referenceGeometry: { desktop: { bands: [] } },
      },
    }), {
      name: 'generic-measured-reference',
      allowHistoricalRecipes: false,
      allowFamilyProfile: false,
    });
  }
});

test('unclassified and captured family names cannot enable benchmark recipes', () => {
  for (const archetype of [
    'maid-service-agency',
    'luxury-car-care',
    'optomatta-optical-retail',
    'lumen-eye-care-editorial',
  ]) {
    assert.deepEqual(selectDraftStrategy({
      target: { archetype, referenceStyle: archetype },
      authoringRequirements: {
        referenceClassification: {
          kind: 'specialized-family',
          family: archetype,
          source: 'reference-content',
        },
        referenceGeometry: { desktop: { bands: [] } },
      },
    }), {
      name: 'generic-measured-reference',
      allowHistoricalRecipes: false,
      allowFamilyProfile: false,
    });
  }

  assert.deepEqual(selectDraftStrategy({
    target: { archetype: 'maid-service-agency', referenceStyle: 'Maidy client page' },
  }), {
    name: 'unclassified-reference',
    allowHistoricalRecipes: false,
    allowFamilyProfile: false,
  });
});

test('historical family recipes live outside the production drafter and are loaded lazily', () => {
  const drafterSource = fs.readFileSync(path.join(scriptsDirectory, 'draft-monteby-layout.js'), 'utf8');
  const recipeSource = fs.readFileSync(path.join(scriptsDirectory, 'historical-benchmark-recipes.js'), 'utf8');
  const historicalRecipeFunctions = [
    'addMaidyHeroSection',
    'addCaregloHeroSection',
    'addOptomattaHeroSection',
    'addLumenHeroSection',
  ];

  for (const functionName of historicalRecipeFunctions) {
    assert.doesNotMatch(drafterSource, new RegExp(`function ${functionName}\\b`));
    assert.match(recipeSource, new RegExp(`function ${functionName}\\b`));
  }

  assert.equal(
    drafterSource.match(/require\('\.\/historical-benchmark-recipes'\)/g)?.length,
    1
  );
  assert.match(
    drafterSource,
    /draftStrategy\.allowHistoricalRecipes\s*\?\s*require\('\.\/historical-benchmark-recipes'\)/
  );
});
