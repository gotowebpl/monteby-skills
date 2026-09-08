'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { sha256, validateIconCatalog, validateIconMapping } = require('../monteby-site-authoring/scripts/icon-mapping');

function fixture() {
  const icons = ['arrow_forward', 'menu'];
  const contract = { iconCatalog: { version: 1, sha256: sha256(JSON.stringify(icons)), icons } };
  const mapping = {
    schemaVersion: 1,
    artifact: 'monteby-icon-mapping',
    iconCatalogSha256: contract.iconCatalog.sha256,
    referenceManifestSha256: 'a'.repeat(64),
    mappings: [
      { structureKey: '0.1', icon: 'menu', iconRole: 'meaningful', iconLabel: 'Otwórz menu' },
      { structureKey: '0.2', icon: 'arrow_forward', iconRole: 'decorative', iconLabel: '' },
    ],
  };
  return { contract, mapping };
}

test('native icon mapping is bound to exact catalog, reference, and complete structure keys', () => {
  const { contract, mapping } = fixture();
  assert.equal(validateIconCatalog(contract).iconSet.has('menu'), true);
  const result = validateIconMapping(mapping, {
    contract,
    referenceManifestSha256: 'a'.repeat(64),
    requiredStructureKeys: new Set(['0.1', '0.2']),
  });
  assert.equal(result.get('0.1').iconLabel, 'Otwórz menu');
});

test('icon mapping blocks unknown native names, raw SVG, and incomplete coverage', () => {
  const { contract, mapping } = fixture();
  assert.throws(() => validateIconMapping({
    ...mapping,
    mappings: [{ structureKey: '0.1', icon: '<svg/>', iconRole: 'decorative', iconLabel: '' }],
  }, {
    contract,
    referenceManifestSha256: 'a'.repeat(64),
    requiredStructureKeys: new Set(['0.1']),
  }), /invalid or not native/);
  assert.throws(() => validateIconMapping({ ...mapping, mappings: mapping.mappings.slice(0, 1) }, {
    contract,
    referenceManifestSha256: 'a'.repeat(64),
    requiredStructureKeys: new Set(['0.1', '0.2']),
  }), /missing=0\.2/);
  assert.throws(() => validateIconMapping(mapping, {
    contract: { iconCatalog: { ...contract.iconCatalog, sha256: '0'.repeat(64) } },
    referenceManifestSha256: 'a'.repeat(64),
    requiredStructureKeys: new Set(['0.1', '0.2']),
  }), /sha256 does not match/);
});
