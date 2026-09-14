'use strict';

const GENERIC_MEASURED_REFERENCE = 'generic-measured-reference';
const GENERATED_BENCHMARK = 'generated-target';
const HISTORICAL_BENCHMARK_RECIPE = 'historical-benchmark-recipe';

function selectDraftStrategy(brief) {
  const classification = brief?.authoringRequirements?.referenceClassification
    || brief?.target?.referenceClassification;
  const hasGeometry = Boolean(
    brief?.authoringRequirements?.referenceGeometry
    && typeof brief.authoringRequirements.referenceGeometry === 'object'
    && !Array.isArray(brief.authoringRequirements.referenceGeometry)
  );
  if (classification?.kind === HISTORICAL_BENCHMARK_RECIPE) {
    return {
      name: 'generated-benchmark-recipe',
      allowHistoricalRecipes: true,
      allowFamilyProfile: true,
    };
  }
  if (classification?.kind === GENERIC_MEASURED_REFERENCE || hasGeometry) {
    return {
      name: GENERIC_MEASURED_REFERENCE,
      allowHistoricalRecipes: false,
      allowFamilyProfile: false,
    };
  }
  if (classification?.kind !== GENERATED_BENCHMARK) {
    return {
      name: 'unclassified-reference',
      allowHistoricalRecipes: false,
      allowFamilyProfile: false,
    };
  }
  return {
    name: 'generated-benchmark-recipe',
    allowHistoricalRecipes: true,
    allowFamilyProfile: true,
  };
}

module.exports = { GENERIC_MEASURED_REFERENCE, HISTORICAL_BENCHMARK_RECIPE, selectDraftStrategy };
