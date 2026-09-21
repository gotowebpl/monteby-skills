'use strict';

function parseVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u);
  return match ? {
    parts: match.slice(1, 4).map(Number),
    prerelease: match[4] || '',
  } : null;
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < 3; index += 1) {
    if (leftParts.parts[index] !== rightParts.parts[index]) {
      return leftParts.parts[index] < rightParts.parts[index] ? -1 : 1;
    }
  }
  if (leftParts.prerelease && !rightParts.prerelease) return -1;
  if (!leftParts.prerelease && rightParts.prerelease) return 1;
  if (leftParts.prerelease !== rightParts.prerelease) {
    return leftParts.prerelease.localeCompare(rightParts.prerelease);
  }
  return 0;
}

function valueAtPath(value, path) {
  return String(path || '').split('.').filter(Boolean).reduce((current, key) => (
    current && typeof current === 'object' ? current[key] : undefined
  ), value);
}

function evaluateFeatureGate(contract, featureName, compatibilityManifest) {
  const gate = compatibilityManifest?.featureGates?.[featureName];
  if (!gate) {
    return {
      ok: false,
      code: 'blocked_contract_inconsistency',
      message: `The skill manifest does not define the ${featureName} feature gate.`,
    };
  }
  const productVersion = String(contract?.productVersion || '');
  const comparison = compareVersions(productVersion, gate.minimumBuilderVersion);
  if (comparison === null) {
    return {
      ok: false,
      code: 'blocked_contract_inconsistency',
      message: 'The live contract must publish a valid productVersion.',
    };
  }
  if (comparison < 0) {
    return {
      ok: false,
      code: 'blocked_plugin_version',
      message: `${featureName} requires Monteby Builder ${gate.minimumBuilderVersion} or newer; the site reports ${productVersion}.`,
    };
  }

  const advertised = valueAtPath(contract, gate.contractPath);
  const capabilityMatches = gate.valueType === 'object'
    ? Boolean(advertised) && typeof advertised === 'object' && !Array.isArray(advertised)
    : advertised === gate.expectedValue;
  if (!capabilityMatches) {
    if (Object.hasOwn(gate, 'unavailableValue') && advertised === gate.unavailableValue) {
      return {
        ok: false,
        code: 'feature_unavailable',
        productVersion,
        featureName,
        fallback: gate.fallback,
      };
    }
    return {
      ok: false,
      code: 'blocked_contract_inconsistency',
      message: `Builder ${productVersion} does not publish the required ${gate.contractPath} capability.`,
    };
  }

  return {
    ok: true,
    code: 'feature_available',
    productVersion,
    featureName,
  };
}

module.exports = {
  compareVersions,
  evaluateFeatureGate,
  parseVersion,
  valueAtPath,
};
