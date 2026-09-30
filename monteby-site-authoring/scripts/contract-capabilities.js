'use strict';

function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u);
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))
    || (match[4] || '').split('.').some((part) => /^0\d+$/u.test(part))) return null;
  return {
    parts,
    prerelease: match[4] || '',
  };
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
  const leftIdentifiers = leftParts.prerelease.split('.');
  const rightIdentifiers = rightParts.prerelease.split('.');
  for (let index = 0; index < Math.max(leftIdentifiers.length, rightIdentifiers.length); index += 1) {
    const leftIdentifier = leftIdentifiers[index];
    const rightIdentifier = rightIdentifiers[index];
    if (leftIdentifier === rightIdentifier) continue;
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    const leftNumeric = /^\d+$/u.test(leftIdentifier);
    const rightNumeric = /^\d+$/u.test(rightIdentifier);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    if (leftNumeric && leftIdentifier.length !== rightIdentifier.length) {
      return leftIdentifier.length < rightIdentifier.length ? -1 : 1;
    }
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

function satisfiesBuilderVersion(productVersion, minimumBuilderVersion, minimumPrereleaseVersion) {
  const product = parseVersion(productVersion);
  const minimum = parseVersion(minimumBuilderVersion);
  if (!product || !minimum || minimum.prerelease) return null;
  const prerelease = minimumPrereleaseVersion === undefined ? null : parseVersion(minimumPrereleaseVersion);
  if (minimumPrereleaseVersion !== undefined && (!prerelease || !prerelease.prerelease
    || prerelease.parts.some((part, index) => part !== minimum.parts[index]))) return null;
  if (compareVersions(productVersion, minimumBuilderVersion) >= 0) return true;
  return Boolean(prerelease && product.prerelease
    && product.parts.every((part, index) => part === minimum.parts[index])
    && compareVersions(productVersion, minimumPrereleaseVersion) >= 0);
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
  const supported = satisfiesBuilderVersion(productVersion, gate.minimumBuilderVersion, gate.minimumPrereleaseVersion);
  if (supported === null) {
    return {
      ok: false,
      code: 'blocked_contract_inconsistency',
      message: 'The live contract and feature gate must publish valid, release-scoped version requirements.',
    };
  }
  if (!supported) {
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
  satisfiesBuilderVersion,
  valueAtPath,
};
