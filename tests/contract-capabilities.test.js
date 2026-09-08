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
