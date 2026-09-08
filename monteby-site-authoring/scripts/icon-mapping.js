'use strict';

const { createHash } = require('node:crypto');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateIconCatalog(contract) {
  const catalog = contract?.iconCatalog;
  if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.icons)) {
    throw new Error('Live contract does not publish iconCatalog v1');
  }
  const icons = catalog.icons.map((icon) => String(icon));
  if (icons.length === 0 || new Set(icons).size !== icons.length || icons.some((icon) => !icon.trim())) {
    throw new Error('Live iconCatalog must contain unique non-empty native ligatures');
  }
  const sorted = [...icons].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (!icons.every((icon, index) => icon === sorted[index])) {
    throw new Error('Live iconCatalog icons must be sorted');
  }
  if (!/^[a-f0-9]{64}$/u.test(String(catalog.sha256 || '')) || sha256(JSON.stringify(icons)) !== catalog.sha256) {
    throw new Error('Live iconCatalog sha256 does not match its icon list');
  }
  return { ...catalog, icons, iconSet: new Set(icons) };
}

function validateIconMapping(mapping, { contract, referenceManifestSha256, requiredStructureKeys }) {
  const catalog = validateIconCatalog(contract);
  if (
    !mapping || typeof mapping !== 'object' || Array.isArray(mapping)
    || mapping.schemaVersion !== 1 || mapping.artifact !== 'monteby-icon-mapping'
    || mapping.iconCatalogSha256 !== catalog.sha256
    || mapping.referenceManifestSha256 !== referenceManifestSha256
    || !Array.isArray(mapping.mappings)
    || Object.keys(mapping).some((key) => ![
      'schemaVersion', 'artifact', 'iconCatalogSha256', 'referenceManifestSha256', 'mappings',
    ].includes(key))
  ) throw new Error('Icon mapping is not bound to the current live catalog and reference manifest');

  const result = new Map();
  for (const [index, entry] of mapping.mappings.entries()) {
    if (
      !entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.structureKey !== 'string' || !entry.structureKey.trim()
      || typeof entry.icon !== 'string' || !catalog.iconSet.has(entry.icon)
      || !['decorative', 'meaningful'].includes(entry.iconRole)
      || typeof entry.iconLabel !== 'string' || entry.iconLabel.length > 120
      || (entry.iconRole === 'meaningful' && !entry.iconLabel.trim())
      || (entry.iconRole === 'decorative' && entry.iconLabel !== '')
      || Object.keys(entry).some((key) => !['structureKey', 'icon', 'iconRole', 'iconLabel'].includes(key))
    ) throw new Error(`Icon mapping entry ${index} is invalid or not native`);
    const structureKey = entry.structureKey.trim();
    if (result.has(structureKey)) throw new Error(`Icon mapping structureKey must be unique: ${structureKey}`);
    result.set(structureKey, { ...entry, structureKey });
  }
  const missing = [...requiredStructureKeys].filter((key) => !result.has(key));
  const unknown = [...result.keys()].filter((key) => !requiredStructureKeys.has(key));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(`Icon mapping coverage mismatch; missing=${missing.join(',') || 'none'} unknown=${unknown.join(',') || 'none'}`);
  }
  return result;
}

module.exports = { sha256, validateIconCatalog, validateIconMapping };
