'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const manifest = require('../monteby-site-authoring/references/site-contract-compatibility.json');
const {
  compareVersions,
  evaluateFeatureGate,
} = require('../monteby-site-authoring/scripts/contract-capabilities');

test('semantic version comparison is deterministic for stable and prerelease values', () => {
  assert.equal(compareVersions('1.3.9', '1.3.9'), 0);
  assert.equal(compareVersions('1.4.0', '1.3.9'), 1);
  assert.equal(compareVersions('1.3.8', '1.3.9'), -1);
  assert.equal(compareVersions('1.4.0-beta.1', '1.4.0'), -1);
  assert.equal(compareVersions('dev-main', '1.4.0'), null);
});

test('feature gate distinguishes plugin version and contract inconsistency', () => {
  assert.equal(evaluateFeatureGate({
    productVersion: '1.3.12',
  }, 'providerRenderedWidgetSave', manifest).code, 'blocked_plugin_version');

  assert.equal(evaluateFeatureGate({
    productVersion: '1.4.0',
    authoring: { capabilities: {} },
  }, 'providerRenderedWidgetSave', manifest).code, 'blocked_contract_inconsistency');

  assert.deepEqual(evaluateFeatureGate({
    productVersion: '1.4.0',
    authoring: { capabilities: { providerRenderedWidgetSave: true } },
  }, 'providerRenderedWidgetSave', manifest), {
    ok: true,
    code: 'feature_available',
    productVersion: '1.4.0',
    featureName: 'providerRenderedWidgetSave',
  });
});

test('query control gate is available from Builder 1.3.9', () => {
  assert.equal(evaluateFeatureGate({
    productVersion: '1.3.9',
    authoring: { relationshipRules: { queryControls: {} } },
  }, 'queryControls', manifest).ok, true);
});

test('native icon authoring requires the versioned Builder 1.5.3 catalog', () => {
  assert.equal(evaluateFeatureGate({ productVersion: '1.5.2', iconCatalog: { version: 1 } }, 'nativeIconAuthoring', manifest).code, 'blocked_plugin_version');
  for (const iconCatalog of [undefined, {}, { version: 2 }]) {
    assert.equal(evaluateFeatureGate({ productVersion: '1.5.3', iconCatalog }, 'nativeIconAuthoring', manifest).code, 'blocked_contract_inconsistency');
  }
  assert.equal(evaluateFeatureGate({ productVersion: '1.5.3', iconCatalog: { version: 1 } }, 'nativeIconAuthoring', manifest).ok, true);
});


test('composition gate requires Builder 1.5.1 and the declared live composition version', () => {
  assert.equal(evaluateFeatureGate({ productVersion: '1.5.0', authoring: { compositions: { version: 1 } } }, 'compositions', manifest).code, 'blocked_plugin_version');
  for (const compositions of [undefined, {}, { version: 2 }]) {
    assert.equal(evaluateFeatureGate({ productVersion: '1.5.1', authoring: { compositions } }, 'compositions', manifest).code, 'blocked_contract_inconsistency');
  }
  assert.equal(evaluateFeatureGate({ productVersion: '1.5.1', authoring: { compositions: { version: 1 } } }, 'compositions', manifest).ok, true);
});

test('global styles PATCH gate requires Builder 1.6.0 and the advertised patch method', () => {
  assert.equal(evaluateFeatureGate({ productVersion: '1.5.3', globalStyles: { resource: { patchMethod: 'PATCH' } } }, 'globalStylesPatch', manifest).code, 'blocked_plugin_version');
  for (const resource of [undefined, {}, { patchMethod: 'PUT' }]) {
    assert.equal(evaluateFeatureGate({ productVersion: '1.6.0', globalStyles: { resource } }, 'globalStylesPatch', manifest).code, 'blocked_contract_inconsistency');
  }
  assert.deepEqual(evaluateFeatureGate({ productVersion: '1.6.0', globalStyles: { resource: { patchMethod: 'PATCH' } } }, 'globalStylesPatch', manifest), {
    ok: true,
    code: 'feature_available',
    productVersion: '1.6.0',
    featureName: 'globalStylesPatch',
  });
});

test('design profile gate requires Builder 1.6.0 and the declared live profile version', () => {
  assert.equal(evaluateFeatureGate({ productVersion: '1.5.3', authoring: { designProfiles: { version: 1 } } }, 'designProfiles', manifest).code, 'blocked_plugin_version');
  for (const designProfiles of [undefined, {}, { version: 2 }]) {
    assert.equal(evaluateFeatureGate({ productVersion: '1.6.0', authoring: { designProfiles } }, 'designProfiles', manifest).code, 'blocked_contract_inconsistency');
  }
  assert.equal(evaluateFeatureGate({ productVersion: '1.6.0', authoring: { designProfiles: { version: 1 } } }, 'designProfiles', manifest).ok, true);
});

test('contract projection gates validate the response that was actually requested', () => {
  const projections = {
    contractLightProjection: 'light',
    contractDesignProjection: 'design',
    contractAuthoringProjection: 'authoring',
    contractCatalogsProjection: 'catalogs',
  };
  for (const [featureName, mode] of Object.entries(projections)) {
    assert.equal(evaluateFeatureGate({ productVersion: '1.6.0', mode }, featureName, manifest).ok, true);
    assert.equal(evaluateFeatureGate({ productVersion: '1.6.0', mode: 'full' }, featureName, manifest).code, 'blocked_contract_inconsistency');
  }
  assert.equal(evaluateFeatureGate({
    productVersion: '1.6.0',
    mode: 'authoring',
    componentsMode: 'summary',
  }, 'contractComponentsSummary', manifest).ok, true);
});

test('composition plan and revision restore require advertised live resources', () => {
  const contract = {
    productVersion: '1.6.0',
    authoring: { compositions: { resources: { plan: { method: 'POST' } } } },
    layoutPersistence: { resources: { restoreRevision: { method: 'POST' } } },
  };
  assert.equal(evaluateFeatureGate(contract, 'compositionPlan', manifest).ok, true);
  assert.equal(evaluateFeatureGate(contract, 'revisionRestore', manifest).ok, true);
  delete contract.layoutPersistence.resources.restoreRevision;
  assert.equal(evaluateFeatureGate(contract, 'revisionRestore', manifest).code, 'blocked_contract_inconsistency');
});

test('every Builder 1.6 gate is optional, names a fallback, and blocks older plugins by version', () => {
  const gates = ['contractLightProjection', 'contractDesignProjection', 'contractAuthoringProjection',
    'contractCatalogsProjection', 'contractComponentsSummary', 'annotatedRender', 'renderLayoutFilter',
    'renderGlobalStylesFilter', 'renderGlobalTemplateFilter', 'previewGlobalTemplates',
    'compositionInstantiate', 'compositionPlan', 'revisionRestore', 'bulkCreate', 'globalStylesPatch',
    'designProfiles', 'contractComponent', 'abilities'];
  for (const name of gates) {
    const gate = manifest.featureGates[name];
    assert.equal(gate.minimumBuilderVersion, '1.6.0', `${name} minimum`);
    assert.equal(gate.optional, true, `${name} optional`);
    assert.match(gate.fallback, /^[a-z][a-z0-9-]+$/, `${name} fallback slug`);
    assert.equal(evaluateFeatureGate({ productVersion: '1.5.3' }, name, manifest).code, 'blocked_plugin_version');
    assert.equal(evaluateFeatureGate({ productVersion: '1.6.0' }, name, manifest).code, 'blocked_contract_inconsistency');
  }
});
