'use strict';

const GENERIC_MEASURED_REFERENCE = 'generic-measured-reference';

function selectDraftStrategy(brief) {
  const classification = brief?.authoringRequirements?.referenceClassification
    || brief?.target?.referenceClassification;
  const hasGeometry = Boolean(
    brief?.authoringRequirements?.referenceGeometry
    && typeof brief.authoringRequirements.referenceGeometry === 'object'
    && !Array.isArray(brief.authoringRequirements.referenceGeometry)
  );
  if (classification?.kind === GENERIC_MEASURED_REFERENCE || (classification?.kind === 'generated-target' && hasGeometry)) {
    return {
      name: GENERIC_MEASURED_REFERENCE,
      allowHistoricalRecipes: false,
      allowFamilyProfile: false,
    };
  }
  return {
    name: 'historical-or-generated-recipe',
    allowHistoricalRecipes: true,
    allowFamilyProfile: true,
  };
}

module.exports = { GENERIC_MEASURED_REFERENCE, selectDraftStrategy };
