#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const BLOCKED_PROPS = new Set([
  'classname',
  'innerclassname',
  'cssid',
  'customattributes',
  'customcss',
  'css',
  'csstext',
  'rawcss',
  'stylesheet',
  'tailwind',
  'utilityclasses',
  'motion',
  'raw',
  'unwrap',
  'rawhtml',
  'rawmarkup',
  'innerhtml',
  'dangerouslysetinnerhtml',
  'html',
  'markup',
  'svg',
  'style',
  'styles',
  'customstyle',
  'customstyles',
  'inlinestyle',
  'styletext',
  'styleattribute',
  'class',
  'classes',
  'backgroundvideo',
  'position',
  'postop',
  'posright',
  'posbottom',
  'posleft',
  'zindex',
  'rotate',
  'scalex',
  'scaley',
  'translatex',
  'translatey',
  'skewx',
  'skewy',
  'fliph',
  'flipv',
  'hidedesktop',
  'hidetablet',
  'hidemobile',
  'visibility',
  'fill',
  'strokewidth',
]);

function parseArgs(argv) {
  const options = {
    layout: '',
    contract: '',
    referenceManifest: '',
    minMediaSurfaces: null,
    requireRealReference: false,
    requireMarketplaceMedia: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--layout') {
      options.layout = requiredValue(argv, index += 1, arg);
    } else if (arg === '--contract') {
      options.contract = requiredValue(argv, index += 1, arg);
    } else if (arg === '--reference-manifest') {
      options.referenceManifest = requiredValue(argv, index += 1, arg);
    } else if (arg === '--min-media-surfaces') {
      options.minMediaSurfaces = parseNonNegativeInteger(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--require-real-reference') {
      options.requireRealReference = true;
    } else if (arg === '--require-marketplace-media') {
      options.requireMarketplaceMedia = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: audit-monteby-layout.js --layout layout.json [--contract contract.json] [--reference-manifest reference-manifest.json] [--min-media-surfaces count] [--require-real-reference] [--require-marketplace-media] [--json]');
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.layout) {
    throw new Error('--layout is required');
  }
  return options;
}

function parseNonNegativeInteger(value, arg) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${arg} must be a non-negative integer.`);
  }
  return parsed;
}

function requiredValue(argv, index, arg) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function extractNodeMap(payload) {
  if (isNodeMap(payload)) {
    return payload;
  }
  for (const key of ['layout', 'nodeMap', 'nodes', 'builderJson']) {
    if (payload && typeof payload === 'object' && isNodeMap(payload[key])) {
      return payload[key];
    }
  }
  throw new Error('Could not find a Monteby node map in the layout payload.');
}

function isNodeMap(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.ROOT && typeof value.ROOT === 'object');
}

function buildContractIndex(contractPayload) {
  if (!contractPayload) {
    return new Map();
  }

  const raw = Array.isArray(contractPayload)
    ? contractPayload
    : contractPayload.components || contractPayload.widgets || contractPayload.catalog || [];
  const entries = Array.isArray(raw) ? raw : Object.values(raw);
  const index = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const name = String(entry.name || entry.type || entry.resolvedName || '');
    if (!name) {
      continue;
    }

    const controlMetadata = collectControlMetadata([entry.controls, entry.schema]);
    const aiProps = arrayOfStrings(entry.aiProps);
    const allowedProps = unique(aiProps.concat(controlMetadata.props)).filter((prop) => !isBlockedAuthoringProp(prop));
    const allowedParents = unique(arrayOfStrings(entry.allowedParents));
    const defaults = entry.defaults && typeof entry.defaults === 'object' && !Array.isArray(entry.defaults)
      ? entry.defaults
      : {};

    index.set(name, {
      allowedParents,
      allowedProps,
      defaults,
      hasPropAllowlist: true,
      propOptions: controlMetadata.propOptions,
      propRules: controlMetadata.propRules,
      repeaterItemProps: controlMetadata.repeaterItemProps,
    });
  }

  return index;
}

function objectKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function collectControlMetadata(value) {
  const props = [];
  const propOptions = new Map();
  const propRules = new Map();
  const repeaterItemProps = new Map();

  visit(value, (item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }
    if (typeof item.type !== 'string' || !item.type.trim()) {
      return;
    }
    const itemProps = [];
    if (typeof item.prop === 'string') {
      itemProps.push(item.prop);
    }
    if (Array.isArray(item.props)) {
      itemProps.push(...arrayOfStrings(item.props));
    }
    if (item.spacingProps && typeof item.spacingProps === 'object') {
      itemProps.push(...objectKeys(item.spacingProps).map((key) => item.spacingProps[key]).filter((prop) => typeof prop === 'string'));
    }

    props.push(...itemProps);

    if (itemProps.length > 0) {
      const rule = { type: item.type };
      if (typeof item.min === 'number') {
        rule.min = item.min;
      }
      if (typeof item.max === 'number') {
        rule.max = item.max;
      }
      if (typeof item.step === 'number') {
        rule.step = item.step;
      }
      if (Array.isArray(item.units)) {
        rule.units = item.units.filter((unit) => typeof unit === 'string');
      }

      for (const prop of itemProps) {
        propRules.set(prop, { ...(propRules.get(prop) || {}), ...rule });
      }

      if (item.type === 'repeater') {
        const itemPropsMetadata = repeaterItemPropNames(item);
        if (itemPropsMetadata) {
          for (const prop of itemProps) {
            repeaterItemProps.set(prop, itemPropsMetadata);
          }
        }
      }
    }

    const optionValues = collectOptionValues(item.options);
    if (optionValues.length > 0) {
      for (const prop of itemProps) {
        const existing = propOptions.get(prop) || new Set();
        for (const optionValue of optionValues) {
          existing.add(optionValue);
        }
        propOptions.set(prop, existing);
      }
    }
  });

  return { props, propOptions, propRules, repeaterItemProps };
}

function repeaterItemPropNames(control) {
  const hasItemControls = Object.prototype.hasOwnProperty.call(control, 'itemControls');
  const hasItemFields = Object.prototype.hasOwnProperty.call(control, 'itemFields');
  if (!hasItemControls && !hasItemFields) {
    return null;
  }

  const names = new Set();
  const stack = [];
  if (hasItemControls) {
    stack.push({ value: control.itemControls, fieldMap: false });
  }
  if (hasItemFields) {
    stack.push({ value: control.itemFields, fieldMap: true });
  }

  while (stack.length > 0) {
    const entry = stack.pop();
    const metadata = entry?.value;
    if (typeof metadata === 'string') {
      if (entry.fieldMap && metadata.trim()) {
        names.add(metadata.trim());
      }
      continue;
    }
    if (Array.isArray(metadata)) {
      for (const item of metadata) {
        stack.push({ value: item, fieldMap: entry.fieldMap });
      }
      continue;
    }
    if (!metadata || typeof metadata !== 'object') {
      continue;
    }

    const directProps = [];
    if (typeof metadata.prop === 'string') {
      directProps.push(metadata.prop);
    }
    if (Array.isArray(metadata.props)) {
      directProps.push(...arrayOfStrings(metadata.props));
    }
    if (metadata.spacingProps && typeof metadata.spacingProps === 'object') {
      directProps.push(...objectKeys(metadata.spacingProps)
        .map((key) => metadata.spacingProps[key])
        .filter((prop) => typeof prop === 'string'));
    }
    for (const prop of directProps.map((prop) => prop.trim()).filter(Boolean)) {
      names.add(prop);
    }

    if (Array.isArray(metadata.sections)) {
      for (const section of metadata.sections) {
        stack.push({ value: section?.fields, fieldMap: false });
      }
    }
    if (Object.prototype.hasOwnProperty.call(metadata, 'fields')) {
      stack.push({ value: metadata.fields, fieldMap: entry.fieldMap });
    }

    if (entry.fieldMap && directProps.length === 0 && !metadata.type && !metadata.fields && !metadata.sections) {
      for (const [key, descriptor] of Object.entries(metadata)) {
        if (descriptor && (typeof descriptor === 'object' || typeof descriptor === 'string')) {
          names.add(key);
        }
      }
    }
  }

  return names;
}

function collectOptionValues(options) {
  if (Array.isArray(options)) {
    return uniqueOptionValues(options.map(optionValue).filter((value) => value !== null));
  }

  if (options && typeof options === 'object') {
    return uniqueOptionValues(Object.values(options).map(optionValue).filter((value) => value !== null));
  }

  return [];
}

function uniqueOptionValues(items) {
  return [...new Set(items.filter((item) => typeof item !== 'undefined' && item !== null))];
}

function optionValue(option) {
  if (isScalar(option)) {
    return normalizeComparableValue(option);
  }

  if (option && typeof option === 'object' && Object.prototype.hasOwnProperty.call(option, 'value') && isScalar(option.value)) {
    return normalizeComparableValue(option.value);
  }

  return null;
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function normalizeComparableValue(value) {
  return String(value);
}

function visit(value, callback) {
  callback(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, callback);
    }
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      visit(child, callback);
    }
  }
}

function audit(nodeMap, contractIndex, referenceManifest, minMediaSurfaces, options = {}) {
  const report = { ok: true, errors: [], warnings: [], stats: { nodes: Object.keys(nodeMap).length, mediaSurfaces: 0 } };

  if (!nodeMap.ROOT) {
    error(report, 'missing_root', 'Layout must contain ROOT.');
    return report;
  }

  for (const [nodeId, node] of Object.entries(nodeMap)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      error(report, 'invalid_node', `${nodeId} must be an object.`);
      continue;
    }

    const type = nodeType(node);
    if (!type) {
      error(report, 'missing_type', `${nodeId} is missing type.resolvedName.`);
      continue;
    }

    const contract = contractIndex.get(type);
    if (contractIndex.size > 0 && type !== 'RootCanvas' && !contract) {
      error(report, 'unknown_widget', `${nodeId} uses "${type}", which is not in the live contract.`);
    }

    auditProps(report, nodeId, type, node.props, contract);
    auditParent(report, nodeMap, nodeId, node, type, contract);
    auditChildren(report, nodeMap, nodeId, node);
  }

  auditReferenceProvenance(report, referenceManifest, options);
  auditReferenceMedia(report, nodeMap, referenceManifest, minMediaSurfaces, options);

  report.ok = report.errors.length === 0;
  return report;
}

function auditReferenceProvenance(report, referenceManifest, options) {
  if (options.requireRealReference !== true) {
    return;
  }

  if (!referenceManifest || typeof referenceManifest !== 'object' || Array.isArray(referenceManifest)) {
    error(report, 'missing_reference_manifest', 'Real template benchmarking requires --reference-manifest from capture-template-reference.js.');
    return;
  }

  const sourceUrl = typeof referenceManifest.sourceUrl === 'string' ? referenceManifest.sourceUrl.trim() : '';
  const screenshots = Array.isArray(referenceManifest.screenshots) ? referenceManifest.screenshots : [];
  report.stats.referenceSourceUrl = sourceUrl;
  report.stats.referenceScreenshots = screenshots.length;

  if (!/^https?:\/\//i.test(sourceUrl)) {
    error(report, 'missing_reference_source_url', 'Real template benchmarking requires reference-manifest.json with an http(s) sourceUrl.');
  }

  if (screenshots.length === 0) {
    error(report, 'missing_reference_screenshots', 'Real template benchmarking requires captured reference screenshots before auditing the Monteby candidate.');
    return;
  }

  for (const screenshot of screenshots) {
    if (!screenshot || typeof screenshot !== 'object' || Array.isArray(screenshot)) {
      error(report, 'invalid_reference_screenshot', 'Each captured reference screenshot must be an object with label and file.');
      continue;
    }

    const label = typeof screenshot.label === 'string' ? screenshot.label.trim() : '';
    const file = typeof screenshot.file === 'string' ? screenshot.file.trim() : '';
    if (!label || !/\.png$/i.test(file)) {
      error(report, 'invalid_reference_screenshot', 'Each captured reference screenshot must include a non-empty label and a .png file.');
    }
  }
}

function nodeType(node) {
  return node.type && typeof node.type === 'object' && typeof node.type.resolvedName === 'string'
    ? node.type.resolvedName
    : '';
}

function auditProps(report, nodeId, type, props, contract) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return;
  }

  for (const [prop, value] of Object.entries(props)) {
    if (isBlockedAuthoringProp(prop)) {
      error(report, 'blocked_prop', `${nodeId} (${type}) uses blocked prop "${prop}".`);
      continue;
    }
    if (contract && contract.hasPropAllowlist && !contract.allowedProps.includes(prop)) {
      error(report, 'unknown_prop', `${nodeId} (${type}) uses prop "${prop}" outside the live contract.`);
    }
    if (contract && contract.propOptions && contract.propOptions.has(prop) && isScalar(value) && value !== '') {
      const allowedValues = contract.propOptions.get(prop);
      if (!allowedValues.has(normalizeComparableValue(value))) {
        error(report, 'invalid_prop_value', `${nodeId} (${type}) uses invalid value "${value}" for prop "${prop}". Allowed: ${[...allowedValues].join(', ')}.`);
      }
    }
    if (contract && contract.propRules && contract.propRules.has(prop) && value !== '') {
      const rule = contract.propRules.get(prop);
      const hasDefault = contract.defaults && Object.prototype.hasOwnProperty.call(contract.defaults, prop);
      const defaultValue = hasDefault ? contract.defaults[prop] : undefined;
      const matchesDefaultStep = isScalar(defaultValue)
        && String(defaultValue).trim() === String(value).trim();

      if (rule.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          error(report, 'invalid_prop_type', `${nodeId} (${type}) uses non-number value for numeric prop "${prop}".`);
        } else {
          auditNumericConstraints(report, nodeId, type, prop, value, rule, matchesDefaultStep);
        }
      } else if (rule.type === 'toggle' && typeof value !== 'boolean') {
        error(report, 'invalid_prop_type', `${nodeId} (${type}) uses non-boolean value for toggle prop "${prop}".`);
      } else if (rule.type === 'repeater' && !Array.isArray(value)) {
        error(report, 'invalid_prop_type', `${nodeId} (${type}) uses non-array value for repeater prop "${prop}".`);
      } else if (rule.type === 'repeater' && contract.repeaterItemProps?.has(prop)) {
        auditRepeaterItemProps(report, nodeId, type, prop, value, contract.repeaterItemProps.get(prop));
      } else if (rule.type === 'css-value') {
        if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) {
          error(report, 'invalid_prop_type', `${nodeId} (${type}) uses non-scalar value for css-value prop "${prop}".`);
        } else {
          let numericValue = value;
          if (typeof value === 'string') {
            const units = Array.isArray(rule.units) ? rule.units : [];
            const allowedUnits = units.filter((unit) => unit !== '').map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const unitPattern = allowedUnits.length > 0 ? `(?:${allowedUnits.join('|')})?` : '[a-zA-Z%]*';
            const cssValuePattern = new RegExp(`^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?${unitPattern}$`);
            if (!cssValuePattern.test(value.trim())) {
              error(report, 'invalid_prop_value', `${nodeId} (${type}) uses invalid css-value "${value}" for prop "${prop}". Use a finite number or a unit value with a leading zero for decimals.`);
              numericValue = null;
            } else {
              numericValue = Number.parseFloat(value.trim());
            }
          }

          if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
            auditNumericConstraints(report, nodeId, type, prop, numericValue, rule, matchesDefaultStep);
          }
        }
      }
    }
    visit(value, (nested) => {
      if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
        return;
      }
      for (const nestedProp of Object.keys(nested)) {
        if (isBlockedAuthoringProp(nestedProp)) {
          error(report, 'blocked_nested_prop', `${nodeId} (${type}) contains blocked nested prop "${nestedProp}" under "${prop}".`);
        }
      }
    });
  }
}

function auditRepeaterItemProps(report, nodeId, type, prop, value, allowedItemProps) {
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    for (const itemProp of Object.keys(item)) {
      if (!isBlockedAuthoringProp(itemProp) && !allowedItemProps.has(itemProp)) {
        error(
          report,
          'unknown_repeater_item_prop',
          `${nodeId} (${type}) uses unknown key "${itemProp}" in ${prop}[${index}]. Allowed: ${[...allowedItemProps].join(', ') || '(none)'}.`
        );
      }
    }
  }
}

function auditNumericConstraints(report, nodeId, type, prop, value, rule, allowDefaultStep) {
  const min = Number.isFinite(rule.min) ? rule.min : null;
  const max = Number.isFinite(rule.max) ? rule.max : null;

  if (min !== null && value < min) {
    error(report, 'invalid_prop_range', `${nodeId} (${type}) uses ${value} for prop "${prop}", below minimum ${min}.`);
    return;
  }
  if (max !== null && value > max) {
    error(report, 'invalid_prop_range', `${nodeId} (${type}) uses ${value} for prop "${prop}", above maximum ${max}.`);
    return;
  }

  const step = Number.isFinite(rule.step) ? rule.step : null;
  if (step === null || step <= 0 || allowDefaultStep) {
    return;
  }

  const stepBase = min ?? 0;
  const steps = (value - stepBase) / step;
  const tolerance = 1e-8 * Math.max(1, Math.abs(steps));
  if (Math.abs(steps - Math.round(steps)) > tolerance) {
    error(report, 'invalid_prop_step', `${nodeId} (${type}) uses ${value} for prop "${prop}", which does not align with step ${step} from base ${stepBase}.`);
  }
}

function isBlockedAuthoringProp(prop) {
  const normalized = String(prop || '').trim();
  const lower = normalized.toLowerCase();

  return BLOCKED_PROPS.has(lower)
    || lower.endsWith('classname')
    || /^on[a-z]/i.test(normalized)
    || /^(?:hover|active)/i.test(normalized)
    || /^(?:transform|transformorigin)$/i.test(normalized);
}

function auditParent(report, nodeMap, nodeId, node, type, contract) {
  if (nodeId === 'ROOT') {
    if (node.parent !== null && typeof node.parent !== 'undefined') {
      error(report, 'root_parent', 'ROOT parent must be null or omitted.');
    }
    return;
  }

  const parentId = typeof node.parent === 'string' ? node.parent : '';
  if (!parentId || !nodeMap[parentId]) {
    error(report, 'missing_parent', `${nodeId} (${type}) has missing parent "${parentId}".`);
    return;
  }

  const parent = nodeMap[parentId];
  const parentType = parentId === 'ROOT' ? 'ROOT' : nodeType(parent);
  if (contract && contract.allowedParents.length > 0 && !contract.allowedParents.includes(parentType)) {
    error(report, 'invalid_parent', `${nodeId} (${type}) cannot be placed under ${parentType}; allowed: ${contract.allowedParents.join(', ')}.`);
  }

  const siblings = Array.isArray(parent.nodes) ? parent.nodes : [];
  if (!siblings.includes(nodeId)) {
    error(report, 'parent_missing_child_reference', `${parentId} does not list ${nodeId} in nodes.`);
  }
}

function auditChildren(report, nodeMap, nodeId, node) {
  const children = Array.isArray(node.nodes) ? node.nodes : [];
  for (const childId of children) {
    if (typeof childId !== 'string' || !nodeMap[childId]) {
      error(report, 'missing_child', `${nodeId} references missing child "${childId}".`);
      continue;
    }
    const child = nodeMap[childId];
    if (child && typeof child === 'object' && child.parent !== nodeId) {
      error(report, 'child_parent_mismatch', `${childId} parent is "${child.parent}" but ${nodeId} lists it as a child.`);
    }
  }
}

function auditReferenceMedia(report, nodeMap, referenceManifest, minMediaSurfaces, options = {}) {
  const referenceMediaEvidence = referenceMediaEvidenceCount(referenceManifest);
  const layoutMediaSurfaceDetails = collectLayoutMediaSurfaceDetails(nodeMap);
  const layoutMediaSurfaces = unique(layoutMediaSurfaceDetails.map((surface) => surface.value));
  const heroMediaSurfaces = collectHeroMediaSurfaces(nodeMap, layoutMediaSurfaceDetails);
  const secondaryMediaSurfaces = collectSecondaryMediaSurfaces(nodeMap, layoutMediaSurfaceDetails, heroMediaSurfaces);
  const mediaRoleReport = evaluateRequiredMediaRoles(nodeMap, layoutMediaSurfaceDetails, referenceManifest, heroMediaSurfaces, secondaryMediaSurfaces, options);
  const explicitRoleMinimum = mediaRoleReport.requiredRoles.reduce((total, role) => total + role.minSurfaces, 0);
  const effectiveMinMediaSurfaces = options.requireMarketplaceMedia === true
    ? Math.max(typeof minMediaSurfaces === 'number' ? minMediaSurfaces : 0, 5)
    : minMediaSurfaces;
  const requiredMediaSurfaces = requiredMediaSurfaceCount(
    referenceMediaEvidence,
    effectiveMinMediaSurfaces,
    explicitRoleMinimum
  );
  const heroScaleReport = evaluateHeroMediaScale(heroMediaSurfaces);
  const secondaryScaleReport = evaluateSecondaryMediaScale(secondaryMediaSurfaces);
  const serviceCardMediaSurfaces = collectAfterHeroCardMediaSurfaces(nodeMap, layoutMediaSurfaceDetails);
  const serviceCardScaleReport = evaluateServiceCardMediaScale(serviceCardMediaSurfaces);
  const coverageReport = evaluateFirstViewportMediaCoverage(nodeMap, layoutMediaSurfaceDetails, referenceManifest, options.referenceManifestPath);
  const reusedReferenceMedia = layoutMediaSurfaces.filter((surface) => isCapturedReferenceMedia(surface, referenceManifest));
  const requiredSecondaryMedia = requiredSecondaryMediaMinimum(mediaRoleReport.requiredRoles);
  const requiredServiceCardMedia = requiredServiceCardMediaMinimum(mediaRoleReport.requiredRoles);

  report.stats.referenceMediaEvidence = referenceMediaEvidence;
  report.stats.requiredMediaSurfaces = requiredMediaSurfaces;
  report.stats.mediaSurfaces = layoutMediaSurfaces.length;
  report.stats.heroMediaSurfaces = heroMediaSurfaces.length;
  report.stats.heroScaleMediaSurfaces = heroScaleReport.scaledSurfaces.length;
  report.stats.largestHeroMediaHeight = heroScaleReport.largestHeight;
  report.stats.largestHeroMediaWidth = heroScaleReport.largestWidth;
  report.stats.secondaryMediaSurfaces = uniqueMediaSurfaceValues(secondaryMediaSurfaces).length;
  report.stats.secondaryScaleMediaSurfaces = uniqueMediaSurfaceValues(secondaryScaleReport.scaledSurfaces).length;
  report.stats.smallestSecondaryMediaHeight = secondaryScaleReport.smallestHeight;
  report.stats.smallestSecondaryMediaWidth = secondaryScaleReport.smallestWidth;
  report.stats.serviceCardMediaSurfaces = uniqueMediaSurfaceValues(serviceCardMediaSurfaces).length;
  report.stats.serviceCardScaleMediaSurfaces = uniqueMediaSurfaceValues(serviceCardScaleReport.scaledSurfaces).length;
  report.stats.smallestServiceCardMediaHeight = serviceCardScaleReport.smallestHeight;
  report.stats.smallestServiceCardMediaWidth = serviceCardScaleReport.smallestWidth;
  report.stats.requiredMediaRoles = mediaRoleReport.requiredRoles.length;
  report.stats.satisfiedMediaRoles = mediaRoleReport.satisfiedRoles.length;
  report.stats.referenceFirstViewportMediaCoverage = coverageStat(coverageReport.referenceCoverage);
  report.stats.estimatedFirstViewportMediaCoverage = coverageStat(coverageReport.estimatedCoverage);
  report.stats.minimumFirstViewportMediaCoverage = coverageStat(coverageReport.minimumCoverage);
  report.stats.reusedReferenceMedia = reusedReferenceMedia.length;
  report.stats.mediaRoleProof = mediaRoleReport.requiredRoles.length > 0
    ? 'json-structure-only; rendered-media parity required'
    : 'not-required';

  if (mediaRoleReport.requiredRoles.length > 0) {
    report.warnings.push({
      code: 'rendered_media_parity_required',
      message: 'JSON audit verifies only authored media structure. Browser-rendered media parity is still required to prove visibility and viewport placement.',
    });
  }

  if (options.requireMarketplaceMedia === true && referenceMediaEvidence === 0) {
    error(
      report,
      'missing_marketplace_media_evidence',
      'Marketplace/template benchmarking requires reference media evidence. Capture the real template screenshots/media first or generate a marketplace-service target with replacement photo roles.'
    );
  }

  if (requiredMediaSurfaces > 0 && layoutMediaSurfaces.length < requiredMediaSurfaces) {
    error(
      report,
      'missing_reference_media',
      `Reference manifest shows photo/media pressure, but the layout has ${layoutMediaSurfaces.length} media surface(s). Expected at least ${requiredMediaSurfaces}. Use licensed, generated, neutral, or user-provided replacement images through contract-backed image/background props.`
    );
  }

  if (reusedReferenceMedia.length > 0) {
    error(
      report,
      'reused_reference_media',
      `Layout reuses ${reusedReferenceMedia.length} captured reference media URL(s). Captured template media is visual evidence only; use licensed, generated, neutral, or user-provided replacement assets.`
    );
  }

  if (requiresHeroMediaRole(requiredMediaSurfaces, layoutMediaSurfaces.length) && heroMediaSurfaces.length === 0) {
    error(
      report,
      'missing_hero_media_role',
      'Photo-led references need a large replacement image/background surface in the first viewport. Topbar/nav chrome may precede it, but small avatars, thumbnails, logos, or late-page images do not satisfy the hero photo role.'
    );
  }

  if (requiresHeroMediaRole(requiredMediaSurfaces, layoutMediaSurfaces.length) && heroMediaSurfaces.length > 0 && heroScaleReport.scaledSurfaces.length === 0) {
    error(
      report,
      'undersized_hero_media_surface',
      `First-viewport hero media is too small for a photo-led template reference. Largest detected hero media is ${heroScaleReport.largestWidth}x${heroScaleReport.largestHeight}px; use a Section background or a media Container/Image with at least 360px height or 640px width.`
    );
  }

  if (requiresHeroMediaRole(requiredMediaSurfaces, layoutMediaSurfaces.length) && coverageReport.enforced && coverageReport.estimatedCoverage < coverageReport.minimumCoverage) {
    error(
      report,
      'low_first_viewport_media_coverage',
      `Estimated first-viewport media coverage is too low (${formatCoverageRatio(coverageReport.estimatedCoverage)}; expected at least ${formatCoverageRatio(coverageReport.minimumCoverage)} from reference ${formatCoverageRatio(coverageReport.referenceCoverage)}). Increase hero photo/background scale through Section, Container, or Image controls before screenshot comparison.`
    );
  }

  if (
    requiredSecondaryMedia > 0
    && uniqueMediaSurfaceValues(secondaryMediaSurfaces).length >= requiredSecondaryMedia
    && uniqueMediaSurfaceValues(secondaryScaleReport.scaledSurfaces).length < requiredSecondaryMedia
  ) {
    error(
      report,
      'undersized_secondary_media_surface',
      `Secondary first-viewport media is too small for a marketplace/template reference (${uniqueMediaSurfaceValues(secondaryScaleReport.scaledSurfaces).length}/${requiredSecondaryMedia} scaled secondary media surfaces). Use a distinct card-level Container/Image detail, equipment, proof, or mini visual with at least 140px height or 220px width; do not use icons, logos, avatars, thumbnail strips, Section backgrounds, or the same hero image again.`
    );
  }

  if (
    requiredServiceCardMedia > 0
    && uniqueMediaSurfaceValues(serviceCardMediaSurfaces).length >= requiredServiceCardMedia
    && uniqueMediaSurfaceValues(serviceCardScaleReport.scaledSurfaces).length < requiredServiceCardMedia
  ) {
    error(
      report,
      'undersized_service_card_media_surface',
      `Service-card media is too small for a marketplace/template reference (${uniqueMediaSurfaceValues(serviceCardScaleReport.scaledSurfaces).length}/${requiredServiceCardMedia} scaled card media surfaces). Use card-level Container/Image media with at least 160px height or 260px width; Section background images, icons, logos, avatars, and thumbnail strips do not satisfy service-card photography.`
    );
  }

  for (const missingRole of mediaRoleReport.missingRoles) {
    error(
      report,
      'missing_media_role',
      `Layout is missing required "${missingRole.role}" media role (${missingRole.count}/${missingRole.minSurfaces}). ${missingRole.description}`
    );
  }
}

function referenceMediaEvidenceCount(referenceManifest) {
  const explicitSurfaceEvidence = unique(explicitMediaSurfaceEvidenceKeys(referenceManifest?.mediaSurfaces)).length;
  const meaningfulSurfaceEvidence = unique(
    mediaSurfaceSources(referenceManifest?.mediaSurfaces)
      .filter(isPhotoEvidenceValue)
      .map(normalizeMediaEvidence)
  ).length;
  const surfaceEvidence = Math.max(explicitSurfaceEvidence, meaningfulSurfaceEvidence);
  if (surfaceEvidence > 0) {
    return surfaceEvidence;
  }

  const photoEvidence = unique(
    referenceMediaValues(referenceManifest)
      .filter(isPhotoEvidenceValue)
      .map(normalizeMediaEvidence)
  ).length;

  if (photoEvidence > 0) {
    return photoEvidence;
  }

  return typeof referenceManifest?.mediaCount === 'number' && Number.isFinite(referenceManifest.mediaCount)
    ? Math.max(0, referenceManifest.mediaCount)
    : 0;
}

function explicitMediaSurfaceEvidenceKeys(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isMeaningfulExplicitMediaSurface).map((surface) => [
    normalizeMediaEvidence(surface.source),
    String(surface.role || '').trim().toLowerCase(),
    Number(surface.width),
    Number(surface.height),
    Number.isFinite(Number(surface.left)) ? Number(surface.left) : '',
    Number.isFinite(Number(surface.top)) ? Number(surface.top) : '',
  ].join('|'));
}

function isMeaningfulExplicitMediaSurface(surface) {
  if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
    return false;
  }
  const role = String(surface.role || '').trim().toLowerCase();
  const width = Number(surface.width);
  const height = Number(surface.height);
  return Boolean(role)
    && !/(?:logo|icon|avatar|decorative)/u.test(role)
    && isSafeHttpsMediaSource(surface.source)
    && Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0
    && width <= 32768
    && height <= 32768;
}

function referenceMediaValues(referenceManifest) {
  if (!referenceManifest || typeof referenceManifest !== 'object' || Array.isArray(referenceManifest)) {
    return [];
  }

  return []
    .concat(arrayOfStrings(referenceManifest.media))
    .concat(arrayOfStrings(referenceManifest.imageSources))
    .concat(mediaSurfaceSources(referenceManifest.mediaSurfaces));
}

function mediaSurfaceSources(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((surface) => {
      if (typeof surface === 'string') {
        return surface;
      }
      if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
        return '';
      }
      return typeof surface.source === 'string' ? surface.source : '';
    })
    .filter(Boolean);
}

function isCapturedReferenceMedia(surface, referenceManifest) {
  if (!hasCapturedReferenceSource(referenceManifest)) {
    return false;
  }

  const normalizedSurface = normalizeMediaEvidence(surface);
  if (!normalizedSurface) {
    return false;
  }

  return referenceMediaValues(referenceManifest)
    .map(normalizeMediaEvidence)
    .filter(Boolean)
    .includes(normalizedSurface);
}

function hasCapturedReferenceSource(referenceManifest) {
  if (!referenceManifest || typeof referenceManifest !== 'object' || Array.isArray(referenceManifest)) {
    return false;
  }

  const sourceUrl = typeof referenceManifest.sourceUrl === 'string' ? referenceManifest.sourceUrl.trim() : '';
  const screenshots = Array.isArray(referenceManifest.screenshots) ? referenceManifest.screenshots : [];
  return /^https?:\/\//i.test(sourceUrl) && screenshots.length > 0;
}

function requiredMediaSurfaceCount(referenceMediaEvidence, minMediaSurfaces, explicitRoleMinimum = 0) {
  if (explicitRoleMinimum > 0) {
    return typeof minMediaSurfaces === 'number'
      ? Math.max(explicitRoleMinimum, minMediaSurfaces)
      : explicitRoleMinimum;
  }
  if (typeof minMediaSurfaces === 'number') {
    return minMediaSurfaces;
  }

  if (referenceMediaEvidence >= 5) {
    return 3;
  }

  return referenceMediaEvidence > 0 ? 1 : 0;
}

function requiresHeroMediaRole(requiredMediaSurfaces, layoutMediaSurfaceCount) {
  return requiredMediaSurfaces >= 3 && layoutMediaSurfaceCount >= requiredMediaSurfaces;
}

function requiredServiceCardMediaMinimum(requiredRoles) {
  if (!Array.isArray(requiredRoles)) {
    return 0;
  }

  return requiredRoles.reduce((minimum, role) => {
    const roleName = typeof role?.role === 'string' ? role.role.toLowerCase() : '';
    const placement = typeof role?.placement === 'string' ? role.placement.toLowerCase() : '';
    if (roleName.includes('service') || roleName.includes('card') || roleName.includes('package') || roleName.includes('gallery') || placement === 'afterhero') {
      return Math.max(minimum, Number.isInteger(role.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1);
    }

    return minimum;
  }, 0);
}

function requiredSecondaryMediaMinimum(requiredRoles) {
  if (!Array.isArray(requiredRoles)) {
    return 0;
  }

  return requiredRoles.reduce((minimum, role) => {
    const roleName = typeof role?.role === 'string' ? role.role.toLowerCase() : '';
    const placement = typeof role?.placement === 'string' ? role.placement.toLowerCase() : '';
    if (roleName.includes('secondary') || roleName.includes('detail') || roleName.includes('proof') || roleName.includes('equipment') || roleName.includes('mini') || placement === 'firstviewport-secondary') {
      return Math.max(minimum, Number.isInteger(role.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1);
    }

    return minimum;
  }, 0);
}

function evaluateFirstViewportMediaCoverage(nodeMap, mediaSurfaceDetails, referenceManifest, referenceManifestPath) {
  const reference = referenceFirstViewportMediaCoverage(referenceManifest, referenceManifestPath);
  const estimatedCoverage = estimateCandidateFirstViewportMediaCoverage(nodeMap, mediaSurfaceDetails, reference.viewport);
  const minimumCoverage = minimumCandidateCoverage(reference.coverage, reference.minimumCoverage);

  return {
    referenceCoverage: reference.coverage,
    estimatedCoverage,
    minimumCoverage,
    enforced: Number.isFinite(reference.coverage) && reference.coverage > 0 && Number.isFinite(minimumCoverage),
  };
}

function referenceFirstViewportMediaCoverage(referenceManifest, referenceManifestPath) {
  const directCoverage = firstFiniteNumber([
    referenceManifest?.firstViewportMediaCoverage,
    referenceManifest?.authoringRequirements?.firstViewportMediaCoverage?.target,
    referenceManifest?.renderedLayout?.summary?.firstViewportMediaCoverage,
    referenceManifest?.renderedLayout?.firstViewport?.mediaCoverage,
  ]);
  const directMinimum = firstFiniteNumber([
    referenceManifest?.minimumFirstViewportMediaCoverage,
    referenceManifest?.authoringRequirements?.firstViewportMediaCoverage?.minimumCandidate,
  ]);

  if (Number.isFinite(directCoverage)) {
    return {
      coverage: directCoverage,
      minimumCoverage: directMinimum,
      viewport: referenceViewport(referenceManifest),
    };
  }

  for (const file of referenceLayoutFiles(referenceManifest)) {
    const layout = readReferenceLayout(referenceManifestPath, file);
    const coverage = firstFiniteNumber([layout?.summary?.firstViewportMediaCoverage]);
    if (Number.isFinite(coverage)) {
      return {
        coverage,
        minimumCoverage: directMinimum,
        viewport: referenceViewport(layout),
      };
    }
  }

  return {
    coverage: NaN,
    minimumCoverage: directMinimum,
    viewport: referenceViewport(referenceManifest),
  };
}

function referenceLayoutFiles(referenceManifest) {
  if (!referenceManifest || typeof referenceManifest !== 'object' || Array.isArray(referenceManifest)) {
    return [];
  }

  const files = [];
  if (typeof referenceManifest.layout === 'string') {
    files.push(referenceManifest.layout);
  }
  if (typeof referenceManifest.layoutCapture?.file === 'string') {
    files.push(referenceManifest.layoutCapture.file);
  }
  if (Array.isArray(referenceManifest.layouts)) {
    for (const layout of referenceManifest.layouts) {
      if (layout && typeof layout === 'object' && typeof layout.file === 'string' && (!layout.status || layout.status === 'ok')) {
        files.push(layout.file);
      }
    }
  }
  if (Array.isArray(referenceManifest.layoutCapture?.layouts)) {
    for (const layout of referenceManifest.layoutCapture.layouts) {
      if (layout && typeof layout === 'object' && typeof layout.file === 'string' && (!layout.status || layout.status === 'ok')) {
        files.push(layout.file);
      }
    }
  }

  return unique(files.map((file) => file.trim()).filter(Boolean));
}

function readReferenceLayout(referenceManifestPath, layoutFile) {
  if (!referenceManifestPath || !layoutFile) {
    return null;
  }

  const baseDir = path.dirname(path.resolve(referenceManifestPath));
  const resolved = path.isAbsolute(layoutFile) ? layoutFile : path.resolve(baseDir, layoutFile);
  if (!fs.existsSync(resolved)) {
    return null;
  }

  try {
    return readJson(resolved);
  } catch (error) {
    return null;
  }
}

function estimateCandidateFirstViewportMediaCoverage(nodeMap, mediaSurfaceDetails, viewport) {
  const normalizedViewport = normalizeViewport(viewport);
  const viewportArea = normalizedViewport.width * normalizedViewport.height;
  if (viewportArea <= 0) {
    return 0;
  }

  const firstViewportMediaSurfaces = collectFirstViewportMediaSurfaces(nodeMap, mediaSurfaceDetails);
  const mediaArea = firstViewportMediaSurfaces.reduce(
    (sum, surface) => sum + estimatedMediaSurfaceArea(surface, normalizedViewport),
    0
  );

  return roundRatio(Math.min(1, mediaArea / viewportArea));
}

function estimatedMediaSurfaceArea(surface, viewport) {
  const width = estimatedMediaSurfaceWidth(surface, viewport);
  const height = estimatedMediaSurfaceHeight(surface, viewport);
  return clamp(width, 0, viewport.width) * clamp(height, 0, viewport.height);
}

function estimatedMediaSurfaceWidth(surface, viewport) {
  const explicitWidth = surfaceDimensionWithBasis(surface, ['width', 'maxWidth', 'imageWidth'], viewport.width);
  if (explicitWidth > 0) {
    return explicitWidth;
  }

  if (surface.type === 'Section' && /(?:backgroundImage|image)$/i.test(surface.key)) {
    return viewport.width;
  }

  return Math.min(560, viewport.width * 0.55);
}

function estimatedMediaSurfaceHeight(surface, viewport) {
  const explicitHeight = surfaceDimensionWithBasis(surface, ['minHeight', 'height', 'imageHeight'], viewport.height);
  if (explicitHeight > 0) {
    return explicitHeight;
  }

  if (surface.type === 'Section' && /(?:backgroundImage|image)$/i.test(surface.key)) {
    return Math.min(viewport.height, Math.max(420, viewport.height * 0.55));
  }

  return 220;
}

function surfaceDimensionWithBasis(surface, props, basis) {
  const surfaceProps = surface.props || {};
  return props.reduce((largest, prop) => Math.max(largest, cssDimensionToPixelsWithBasis(surfaceProps[prop], basis)), 0);
}

function cssDimensionToPixelsWithBasis(value, basis) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(px|rem|em|%)?$/i);
  if (!match) {
    return 0;
  }

  const number = Number.parseFloat(match[1]);
  if (!Number.isFinite(number)) {
    return 0;
  }

  const unit = (match[2] || 'px').toLowerCase();
  if (unit === 'rem' || unit === 'em') {
    return number * 16;
  }
  if (unit === '%') {
    return Number.isFinite(basis) && basis > 0 ? (basis * number) / 100 : 0;
  }

  return number;
}

function minimumCandidateCoverage(referenceCoverage, explicitMinimum) {
  if (Number.isFinite(explicitMinimum)) {
    return explicitMinimum;
  }
  if (!Number.isFinite(referenceCoverage)) {
    return NaN;
  }

  return Math.max(referenceCoverage * 0.5, Math.min(0.12, referenceCoverage));
}

function referenceViewport(source) {
  const viewport = source && typeof source === 'object' && !Array.isArray(source) ? source.viewport || source : {};
  return normalizeViewport(viewport);
}

function normalizeViewport(viewport) {
  return {
    width: Number.isFinite(viewport?.width) && viewport.width > 0 ? viewport.width : 1440,
    height: Number.isFinite(viewport?.height) && viewport.height > 0 ? viewport.height : 900,
  };
}

function firstFiniteNumber(values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return NaN;
}

function coverageStat(value) {
  return Number.isFinite(value) ? roundRatio(value) : null;
}

function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCoverageRatio(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'n/a';
}

function evaluateRequiredMediaRoles(nodeMap, mediaSurfaceDetails, referenceManifest, heroMediaSurfaces, secondaryMediaSurfaces, options = {}) {
  const requiredRoles = referenceRequiredMediaRoles(referenceManifest, options);
  if (requiredRoles.length === 0) {
    return { requiredRoles, satisfiedRoles: [], missingRoles: [] };
  }

  const firstViewportMediaSurfaces = collectFirstViewportMediaSurfaces(nodeMap, mediaSurfaceDetails);
  const afterHeroMediaSurfaces = collectAfterHeroMediaSurfaces(nodeMap, mediaSurfaceDetails);
  const afterHeroCardMediaSurfaces = collectAfterHeroCardMediaSurfaces(nodeMap, mediaSurfaceDetails);
  const allRoleMediaSurfaces = uniqueMediaSurfaceValues(mediaSurfaceDetails.filter(isRoleMediaSurface));
  const heroCount = uniqueMediaSurfaceValues(heroMediaSurfaces).length;
  const secondaryCount = uniqueMediaSurfaceValues(secondaryMediaSurfaces).length;
  const firstViewportCount = uniqueMediaSurfaceValues(firstViewportMediaSurfaces).length;
  const afterHeroCount = uniqueMediaSurfaceValues(afterHeroMediaSurfaces).length;
  const afterHeroCardCount = uniqueMediaSurfaceValues(afterHeroCardMediaSurfaces).length;
  const results = requiredRoles.map((role) => {
    const count = mediaRoleSurfaceCount(role, {
      heroCount,
      secondaryCount,
      firstViewportCount,
      afterHeroCount,
      afterHeroCardCount,
      allCount: allRoleMediaSurfaces.length,
    });
    return { ...role, count, satisfied: count >= role.minSurfaces };
  });

  return {
    requiredRoles,
    satisfiedRoles: results.filter((role) => role.satisfied),
    missingRoles: results.filter((role) => !role.satisfied),
  };
}

function referenceRequiredMediaRoles(referenceManifest, options = {}) {
  if (!referenceManifest || typeof referenceManifest !== 'object' || Array.isArray(referenceManifest)) {
    return options.requireMarketplaceMedia === true ? marketplaceRequiredMediaRoles() : [];
  }

  if (!Array.isArray(referenceManifest.requiredMediaRoles)) {
    return options.requireMarketplaceMedia === true ? marketplaceRequiredMediaRoles() : [];
  }

  const roles = referenceManifest.requiredMediaRoles
    .map(normalizeRequiredMediaRole)
    .filter((role) => role.role);

  return roles.length > 0 || options.requireMarketplaceMedia !== true ? roles : marketplaceRequiredMediaRoles();
}

function marketplaceRequiredMediaRoles() {
  return [
    {
      role: 'hero',
      minSurfaces: 1,
      placement: 'firstViewport',
      description: 'Large first-viewport replacement hero photo/background.',
    },
    {
      role: 'secondary',
      minSurfaces: 1,
      placement: 'firstViewport',
      description: 'Supporting first-viewport photo such as detail, equipment, proof, or mini visual.',
    },
    {
      role: 'service-card',
      minSurfaces: 3,
      placement: 'afterHero',
      description: 'Photo surfaces inside service/package/content cards below the hero.',
    },
  ];
}

function normalizeRequiredMediaRole(role) {
  if (typeof role === 'string') {
    return { role, minSurfaces: 1, placement: '', description: '' };
  }

  if (!role || typeof role !== 'object' || Array.isArray(role)) {
    return { role: '', minSurfaces: 1, placement: '', description: '' };
  }

  const minSurfaces = Number.isInteger(role.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1;
  return {
    role: typeof role.role === 'string' ? role.role.trim() : '',
    minSurfaces,
    placement: typeof role.placement === 'string' ? role.placement.trim() : '',
    description: typeof role.description === 'string' ? role.description.trim() : '',
  };
}

function mediaRoleSurfaceCount(role, counts) {
  const roleName = role.role.toLowerCase();
  const placement = role.placement.toLowerCase();

  if (roleName.includes('hero') || placement === 'firstviewport-hero') {
    return counts.heroCount;
  }

  if (roleName.includes('secondary') || roleName.includes('detail') || roleName.includes('proof') || roleName.includes('equipment') || roleName.includes('mini')) {
    return counts.secondaryCount;
  }

  if (roleName.includes('service') || roleName.includes('card') || roleName.includes('package') || roleName.includes('gallery') || placement === 'afterhero') {
    return counts.afterHeroCardCount;
  }

  if (placement === 'firstviewport') {
    return counts.firstViewportCount;
  }

  return counts.allCount;
}

function collectLayoutMediaSurfaceDetails(nodeMap) {
  const details = [];

  for (const [nodeId, node] of Object.entries(nodeMap)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      continue;
    }
    collectMediaFromValue(node.props || {}, '', details, {
      nodeId,
      type: nodeType(node),
      props: node.props || {},
    });
  }

  return details;
}

function collectMediaFromValue(value, key, media, context) {
  if (typeof value === 'string') {
    for (const candidate of mediaCandidatesFromString(value)) {
      if (isMediaPropName(key) || isPhotoEvidenceValue(candidate)) {
        media.push({ ...context, key, value: candidate });
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMediaFromValue(item, key, media, context);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectMediaFromValue(childValue, childKey, media, context);
    }
  }
}

function collectHeroMediaSurfaces(nodeMap, mediaSurfaceDetails) {
  const firstViewportRootIds = rootViewportCandidateIds(nodeMap, mediaSurfaceDetails);
  const descendants = descendantsOf(nodeMap, firstViewportRootIds);
  const largeSurfaces = mediaSurfaceDetails.filter((surface) => descendants.has(surface.nodeId) && isRoleMediaSurface(surface) && isLargeMediaSurface(surface));
  const primaryHeroSurface = primaryHeroMediaSurface(largeSurfaces);

  return primaryHeroSurface ? largeSurfaces.filter((surface) => surface.value === primaryHeroSurface.value) : [];
}

function collectFirstViewportMediaSurfaces(nodeMap, mediaSurfaceDetails) {
  const firstViewportRootIds = rootViewportCandidateIds(nodeMap, mediaSurfaceDetails);
  const descendants = descendantsOf(nodeMap, firstViewportRootIds);

  return mediaSurfaceDetails.filter((surface) => descendants.has(surface.nodeId) && isRoleMediaSurface(surface) && isMediumMediaSurface(surface));
}

function collectSecondaryMediaSurfaces(nodeMap, mediaSurfaceDetails, heroMediaSurfaces) {
  const heroValues = new Set(uniqueMediaSurfaceValues(heroMediaSurfaces));
  return collectFirstViewportMediaSurfaces(nodeMap, mediaSurfaceDetails)
    .filter((surface) => !heroValues.has(surface.value) && isCardLevelMediaSurface(surface));
}

function collectAfterHeroMediaSurfaces(nodeMap, mediaSurfaceDetails) {
  const firstViewportRootIds = rootViewportCandidateIds(nodeMap, mediaSurfaceDetails);
  const descendants = descendantsOf(nodeMap, firstViewportRootIds);

  return mediaSurfaceDetails.filter((surface) => !descendants.has(surface.nodeId) && isRoleMediaSurface(surface) && isMediumMediaSurface(surface));
}

function collectAfterHeroCardMediaSurfaces(nodeMap, mediaSurfaceDetails) {
  return collectAfterHeroMediaSurfaces(nodeMap, mediaSurfaceDetails).filter(isCardLevelMediaSurface);
}

function uniqueMediaSurfaceValues(mediaSurfaceDetails) {
  return unique(mediaSurfaceDetails.map((surface) => surface.value));
}

function isRoleMediaSurface(surface) {
  return (isPhotoEvidenceValue(surface.value) || (isMediaPropName(surface.key) && isSafeHttpsMediaSource(surface.value)))
    && !isMinorMediaKey(surface.key);
}

function rootViewportCandidateIds(nodeMap, mediaSurfaceDetails = []) {
  const rootNodes = Array.isArray(nodeMap.ROOT?.nodes) ? nodeMap.ROOT.nodes : [];
  const candidates = rootNodes.filter((nodeId) => typeof nodeId === 'string' && nodeMap[nodeId]);
  const leadingChromeCount = countLeadingChromeRoots(nodeMap, candidates);
  const chromeAndHeroWindow = candidates.slice(0, Math.min(candidates.length, Math.max(2, leadingChromeCount + 2)));
  const mediaRoots = chromeAndHeroWindow.filter((nodeId) => rootHasLargeMediaSurface(nodeMap, nodeId, mediaSurfaceDetails));

  return unique(candidates.slice(0, 2).concat(mediaRoots));
}

function countLeadingChromeRoots(nodeMap, rootIds) {
  let count = 0;
  for (const rootId of rootIds) {
    if (!isChromeRootNode(nodeMap[rootId])) {
      break;
    }
    count += 1;
  }

  return count;
}

function isChromeRootNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }

  const tag = typeof node.props?.tag === 'string' ? node.props.tag.toLowerCase() : '';
  return tag === 'header' || tag === 'nav';
}

function rootHasLargeMediaSurface(nodeMap, rootId, mediaSurfaceDetails) {
  const descendants = descendantsOf(nodeMap, [rootId]);
  return mediaSurfaceDetails.some((surface) => (
    descendants.has(surface.nodeId)
    && isRoleMediaSurface(surface)
    && isLargeMediaSurface(surface)
  ));
}

function primaryHeroMediaSurface(surfaces) {
  if (surfaces.length === 0) {
    return null;
  }

  const sectionSurface = surfaces.find((surface) => surface.type === 'Section' && /(?:backgroundImage|image)$/i.test(surface.key));
  if (sectionSurface) {
    return sectionSurface;
  }

  return [...surfaces].sort((first, second) => mediaSurfaceRank(second) - mediaSurfaceRank(first))[0];
}

function mediaSurfaceRank(surface) {
  const props = surface.props || {};
  const width = largestCssDimension([props.width, props.maxWidth, props.imageWidth]);
  const height = largestCssDimension([props.minHeight, props.height, props.imageHeight]);
  return (width || 560) * (height || 220);
}

function descendantsOf(nodeMap, rootIds) {
  const descendants = new Set();
  const stack = [...rootIds];

  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId || descendants.has(nodeId)) {
      continue;
    }
    descendants.add(nodeId);

    const node = nodeMap[nodeId];
    const children = node && typeof node === 'object' && Array.isArray(node.nodes) ? node.nodes : [];
    for (const childId of children) {
      if (typeof childId === 'string' && nodeMap[childId]) {
        stack.push(childId);
      }
    }
  }

  return descendants;
}

function isLargeMediaSurface(surface) {
  if (surface.type === 'Section' && /(?:backgroundImage|image)$/i.test(surface.key)) {
    return true;
  }

  const props = surface.props || {};
  const height = largestCssDimension([props.minHeight, props.height, props.imageHeight]);
  const width = largestCssDimension([props.width, props.maxWidth, props.imageWidth]);

  return height >= 280 || width >= 420;
}

function evaluateHeroMediaScale(heroMediaSurfaces) {
  const measurements = heroMediaSurfaces.map((surface) => ({
    surface,
    width: surfaceDimension(surface, ['width', 'maxWidth', 'imageWidth']),
    height: surfaceDimension(surface, ['minHeight', 'height', 'imageHeight']),
  }));

  return {
    scaledSurfaces: measurements.filter((item) => isHeroScaleMediaSurface(item.surface, item.width, item.height)),
    largestWidth: measurements.reduce((largest, item) => Math.max(largest, item.width), 0),
    largestHeight: measurements.reduce((largest, item) => Math.max(largest, item.height), 0),
  };
}

function isHeroScaleMediaSurface(surface, width, height) {
  if (surface.type === 'Section' && /(?:backgroundImage|image)$/i.test(surface.key)) {
    return true;
  }

  return height >= 360 || width >= 640 || (height >= 260 && width >= 520);
}

function evaluateServiceCardMediaScale(serviceCardMediaSurfaces) {
  const measurements = serviceCardMediaSurfaces.map((surface) => ({
    surface,
    width: surfaceDimension(surface, ['width', 'maxWidth', 'imageWidth']),
    height: surfaceDimension(surface, ['minHeight', 'height', 'imageHeight']),
  }));
  const scaledSurfaces = measurements.filter((item) => isServiceCardScaleMediaSurface(item.width, item.height));

  return {
    scaledSurfaces: scaledSurfaces.map((item) => item.surface),
    smallestWidth: scaledSurfaces.reduce((smallest, item) => Math.min(smallest, item.width), scaledSurfaces.length > 0 ? Infinity : 0),
    smallestHeight: scaledSurfaces.reduce((smallest, item) => Math.min(smallest, item.height), scaledSurfaces.length > 0 ? Infinity : 0),
  };
}

function isServiceCardScaleMediaSurface(width, height) {
  return height >= 160 || width >= 260 || (height >= 130 && width >= 220);
}

function evaluateSecondaryMediaScale(secondaryMediaSurfaces) {
  const measurements = secondaryMediaSurfaces.map((surface) => ({
    surface,
    width: surfaceDimension(surface, ['width', 'maxWidth', 'imageWidth']),
    height: surfaceDimension(surface, ['minHeight', 'height', 'imageHeight']),
  }));
  const scaledSurfaces = measurements.filter((item) => isSecondaryScaleMediaSurface(item.width, item.height));

  return {
    scaledSurfaces: scaledSurfaces.map((item) => item.surface),
    smallestWidth: scaledSurfaces.reduce((smallest, item) => Math.min(smallest, item.width), scaledSurfaces.length > 0 ? Infinity : 0),
    smallestHeight: scaledSurfaces.reduce((smallest, item) => Math.min(smallest, item.height), scaledSurfaces.length > 0 ? Infinity : 0),
  };
}

function isSecondaryScaleMediaSurface(width, height) {
  return height >= 140 || width >= 220 || (height >= 120 && width >= 180);
}

function isCardLevelMediaSurface(surface) {
  return !(surface.type === 'Section' && /(?:backgroundImage|image)$/i.test(surface.key));
}

function surfaceDimension(surface, props) {
  const surfaceProps = surface.props || {};
  return largestCssDimension(props.map((prop) => surfaceProps[prop]));
}

function isMediumMediaSurface(surface) {
  if (isLargeMediaSurface(surface)) {
    return true;
  }

  const props = surface.props || {};
  const height = largestCssDimension([props.minHeight, props.height, props.imageHeight]);
  const width = largestCssDimension([props.width, props.maxWidth, props.imageWidth]);

  return height >= 110 || width >= 160;
}

function largestCssDimension(values) {
  return values.reduce((largest, value) => Math.max(largest, cssDimensionToPixels(value)), 0);
}

function cssDimensionToPixels(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(px|rem|em|%)?$/i);
  if (!match) {
    return 0;
  }

  const number = Number.parseFloat(match[1]);
  if (!Number.isFinite(number)) {
    return 0;
  }

  const unit = (match[2] || 'px').toLowerCase();
  if (unit === 'rem' || unit === 'em') {
    return number * 16;
  }

  if (unit === '%') {
    return number >= 90 ? 420 : 0;
  }

  return number;
}

function isMinorMediaKey(key) {
  return /(?:avatar|thumbnail|thumb|logo|icon|brand)$/i.test(key);
}

function mediaCandidatesFromString(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'none' || trimmed === 'transparent') {
    return [];
  }

  const candidates = [];
  const cssUrlPattern = /url\(([^)]+)\)/gi;
  let match;

  while ((match = cssUrlPattern.exec(trimmed)) !== null) {
    const unwrapped = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (unwrapped) {
      candidates.push(unwrapped);
    }
  }

  if (candidates.length > 0) {
    return candidates;
  }

  return [trimmed];
}

function isMediaPropName(key) {
  return /(?:image|photo|poster|thumbnail|avatar|backgroundImage|media|src)$/i.test(key);
}

function isPhotoEvidenceValue(value) {
  const normalized = normalizeMediaEvidence(value);
  return /\.(?:avif|jpe?g|png|webp)(?:[?#].*)?$/i.test(normalized)
    || /images\.unsplash\.com\/photo-/i.test(normalized)
    || /source\.unsplash\.com/i.test(normalized)
    || /picsum\.photos/i.test(normalized);
}

function isSafeHttpsMediaSource(value) {
  try {
    const parsed = new URL(normalizeMediaEvidence(value));
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch (error) {
    return false;
  }
}

function normalizeMediaEvidence(value) {
  return String(value || '').trim().replace(/^url\((.*)\)$/i, '$1').replace(/^['"]|['"]$/g, '');
}

function error(report, code, message) {
  report.errors.push({ code, message });
}

function printReport(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`monteby_layout_audit=${report.ok ? 'ok' : 'failed'}`);
  console.log(`nodes=${report.stats.nodes}`);
  for (const item of report.errors) {
    console.log(`error ${item.code}: ${item.message}`);
  }
  for (const item of report.warnings) {
    console.log(`warning ${item.code}: ${item.message}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const layout = extractNodeMap(readJson(options.layout));
  const contract = options.contract ? readJson(options.contract) : null;
  const referenceManifest = options.referenceManifest ? readJson(options.referenceManifest) : null;
  const report = audit(
    layout,
    buildContractIndex(contract),
    referenceManifest,
    options.minMediaSurfaces,
    {
      requireRealReference: options.requireRealReference,
      requireMarketplaceMedia: options.requireMarketplaceMedia,
      referenceManifestPath: options.referenceManifest,
    }
  );
  printReport(report, options.json);
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  isBlockedAuthoringProp,
};
