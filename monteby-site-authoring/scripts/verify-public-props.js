#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { createHash } = require('node:crypto');
const { canonicalSha256, operationsSha256, pruneNoopOperations } = require('./wordpress-layout-client');
const { buildResolvedDesignProfile, effectiveTypographyValue } = require('./resolved-design-profile');

const REQUIRED_WIDTHS = new Set([1440, 834, 390]);
const GEOMETRY_WIDTH = 375;

function appliedPropExpectations({ operations: rawOperations, before, saved, preflight, applied, contract, publicPageUrl }) {
  const blockers = [];
  const effects = [];
  const expectations = [];
  const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
  if (!Array.isArray(rawOperations) || rawOperations.length === 0) throw new Error('operations_missing');
  const operations = pruneNoopOperations(rawOperations);
  if (operations.length === 0) throw new Error('operations_empty');
  const digest = operationsSha256(operations);
  const scope = { site: before?.site, pageId: before?.pageId };
  if (typeof scope.site !== 'string' || !Number.isSafeInteger(scope.pageId) || scope.pageId <= 0
    || !/^https?:\/\//u.test(scope.site)) throw new Error('prop_scope_invalid');
  const url = new URL(publicPageUrl);
  if (url.origin !== new URL(scope.site).origin || url.username || url.password || url.hash) throw new Error('prop_public_url_invalid');
  for (const snapshot of [before, saved]) {
    if (snapshot?.artifact !== 'monteby-page-snapshot' || snapshot.schemaVersion !== 1
      || snapshot.site !== scope.site || snapshot.pageId !== scope.pageId || snapshot.data?.id !== scope.pageId
      || snapshot.publicPageUrl !== publicPageUrl || typeof snapshot.data?.builderJson !== 'string'
      || typeof snapshot.data?.postModifiedGmt !== 'string' || !snapshot.data.postModifiedGmt
      || !Number.isFinite(Date.parse(snapshot.capturedAt))) throw new Error('prop_snapshot_scope_invalid');
  }
  const snapshotDigest = canonicalSha256(before);
  const savedDigest = hash(saved.data.builderJson);
  for (const [report, stage, code] of [[preflight, 'patch-validate', 'PATCH_VALIDATION_OK'], [applied, 'patch-save', 'PATCH_SAVE_OK']]) {
    if (report?.schemaVersion !== 1 || report.ok !== true || report.stage !== stage || report.code !== code
      || report.scope?.site !== scope.site || report.scope?.pageId !== scope.pageId
      || report.evidence?.site !== scope.site || report.evidence?.pageId !== scope.pageId
      || report.evidence?.publicPageUrl !== publicPageUrl
      || report.evidence?.snapshotSha256 !== snapshotDigest || report.evidence?.operationsSha256 !== digest
      || report.response?.operationsSha256 !== digest || report.response?.operationCount !== operations.length
      || report.evidence?.candidateLayoutSha256 !== savedDigest || report.response?.candidateLayoutSha256 !== savedDigest
      || report.layoutSha256 !== savedDigest) throw new Error('prop_patch_binding_invalid');
  }
  if (preflight.evidence.postModifiedGmt !== before.data.postModifiedGmt
    || preflight.response?.postModifiedGmt !== before.data.postModifiedGmt
    || applied.evidence.previousPostModifiedGmt !== before.data.postModifiedGmt
    || applied.evidence.postModifiedGmt !== saved.data.postModifiedGmt
    || applied.response?.postModifiedGmt !== saved.data.postModifiedGmt
    || Date.parse(saved.capturedAt) < Date.parse(before.capturedAt)) throw new Error('prop_patch_revision_invalid');
  for (const digest of [preflight.evidence.compiledHtmlSha256, preflight.response?.compiledHtmlSha256, applied.response?.compiledHtmlSha256]) {
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/u.test(digest)) throw new Error('prop_compiled_html_evidence_invalid');
  }
  if (preflight.response.compiledHtmlSha256 !== preflight.evidence.compiledHtmlSha256
    || applied.response.compiledHtmlSha256 !== preflight.response.compiledHtmlSha256) throw new Error('prop_compiled_html_render_drift');
  const nodeMap = JSON.parse(saved.data.builderJson);
  if (!record(nodeMap?.ROOT) || !isDeepStrictEqual(preflight.response?.layout, nodeMap)
    || (applied.response?.builderJson !== undefined && applied.response.builderJson !== saved.data.builderJson)) throw new Error('prop_saved_payload_mismatch');
  const schemas = contract?.layoutPersistence?.operations?.operationSchemas;
  if (!record(schemas)) throw new Error('prop_live_contract_missing');
  const profile = buildResolvedDesignProfile(contract);
  const components = Array.isArray(contract.components) ? contract.components : Object.values(contract.components || {});
  const mappings = {
    text: 'text', tag: 'tag', fontSize: 'fontSize', lineHeight: 'lineHeight', fontWeight: 'fontWeight',
    letterSpacing: 'letterSpacing', textColor: 'color', color: 'color', textAlign: 'textAlign', textTransform: 'textTransform',
    backgroundColor: 'backgroundColor', background: 'backgroundColor', borderRadius: 'borderRadius',
    paddingTop: 'paddingTop', paddingRight: 'paddingRight', paddingBottom: 'paddingBottom', paddingLeft: 'paddingLeft',
    marginTop: 'marginTop', marginBottom: 'marginBottom', marginLeft: 'marginLeft', marginRight: 'marginRight',
    gap: 'gap', rowGap: 'rowGap', columnGap: 'columnGap', layoutDisplay: 'display', display: 'display', alignSelf: 'alignSelf',
    flexDirection: 'flexDirection', flexWrap: 'flexWrap', justifyContent: 'justifyContent', alignItems: 'alignItems', overflow: 'overflow',
  };
  const touched = new Set();
  for (const [operationIndex, operation] of operations.entries()) {
    if (!record(operation) || !Object.hasOwn(schemas, operation.type)) {
      blockers.push({ code: 'unsupported_operation', operationIndex, type: operation?.type });
      continue;
    }
    if (operation.type !== 'update_props') {
      effects.push({ operationIndex, type: operation.type, status: 'unobservable', operation });
      blockers.push({ code: 'unobservable_structural_operation', operationIndex, type: operation.type });
      continue;
    }
    if (Object.keys(operation).some((key) => !['type', 'nodeId', 'props', 'unsetProps'].includes(key))
      || (operation.props !== undefined && !record(operation.props))
      || (operation.unsetProps !== undefined && (!Array.isArray(operation.unsetProps) || !operation.unsetProps.every((key) => typeof key === 'string')))) {
      blockers.push({ code: 'operation_shape_invalid', operationIndex });
      continue;
    }
    const node = nodeMap[operation.nodeId];
    const component = node?.type?.resolvedName;
    const definition = components.find((entry) => entry.name === component);
    const props = node?.props;
    for (const sourceProp of [...Object.keys(operation.props || {}), ...(operation.unsetProps || [])]) {
      const effect = { operationIndex, nodeId: operation.nodeId, sourceProp, status: 'blocked', expectationIndexes: [] };
      effects.push(effect);
      const key = `${operation.nodeId}\0${sourceProp}`;
      const unset = (operation.unsetProps || []).includes(sourceProp);
      if (touched.has(key)) { blockers.push({ code: 'overwritten_effect_unobservable', ...effect }); continue; }
      touched.add(key);
      if (!record(props) || (unset ? Object.hasOwn(props, sourceProp) : !isDeepStrictEqual(props[sourceProp], operation.props[sourceProp]))) {
        blockers.push({ code: 'applied_prop_not_saved', ...effect }); continue;
      }
      if (!definition?.props?.includes(sourceProp)) { blockers.push({ code: 'prop_not_in_live_contract', ...effect }); continue; }
      const base = sourceProp.replace(/(?:Tablet|Mobile)$/u, '');
      const observedProp = mappings[base];
      if (!observedProp || !['Heading', 'Text', 'Container'].includes(component)
        || node.hidden || props.dynamicField || props.dynamicText || props.href || props.dynamicHref
        || !['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(props.tag || (component === 'Heading' ? 'h2' : component === 'Text' ? 'p' : 'div'))
        || (component !== 'Container' && (typeof props.text !== 'string' || !normalizedText(props.text)))) {
        blockers.push({ code: 'unobservable_prop', ...effect }); continue;
      }
      for (const width of REQUIRED_WIDTHS) {
        const suffixes = width === 1440 ? [''] : width === 834 ? ['Tablet', ''] : ['Mobile', 'Tablet', ''];
        const resolveValue = (property) => {
          let value = suffixes.map((suffix) => props[property + suffix]).find((entry) => entry !== undefined && entry !== '');
          if (value === undefined) value = effectiveTypographyValue(props, profile, property);
          if (typeof value === 'number') value = String(value);
          if (typeof value === 'string' && value.startsWith('var(')) {
            const tokens = Object.values(profile.tokens || {}).filter((token) => token.reference === value);
            value = tokens.length === 1 ? tokens[0].value : undefined;
          }
          return value;
        };
        let value = resolveValue(base);
        if (typeof value !== 'string' || value === '' || /var\(|calc\(|clamp\(|[;{}]/u.test(value)) {
          blockers.push({ code: 'unresolved_prop_value', ...effect, width }); continue;
        }
        if (/color$/iu.test(observedProp)) {
          const hex = /^#([a-f0-9]{6})$/iu.exec(value);
          if (hex) value = `rgb(${[0, 2, 4].map((start) => parseInt(hex[1].slice(start, start + 2), 16)).join(', ')})`;
          if (!/^rgba?\([\d.,% ]+\)$/u.test(value)) { blockers.push({ code: 'unresolved_color_value', ...effect, width }); continue; }
        } else if (/^(?:fontSize|lineHeight|letterSpacing|borderRadius|padding|margin|gap|rowGap|columnGap)/u.test(observedProp)) {
          if (observedProp === 'lineHeight' && /^(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value)) {
            const fontSize = resolveValue('fontSize');
            if (typeof fontSize === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)px$/u.test(fontSize)) value = `${Number((parseFloat(fontSize) * Number(value)).toFixed(4))}px`;
          }
          if (value === '0') value = '0px';
          if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)px$/u.test(value)) { blockers.push({ code: 'unresolved_length_value', ...effect, width }); continue; }
        }
        effect.expectationIndexes.push(expectations.length);
        expectations.push({ nodeId: operation.nodeId, operationIndex, sourceProp, width, prop: observedProp, expected: value,
          identity: { tag: props.tag || (component === 'Heading' ? 'h2' : component === 'Text' ? 'p' : 'div'), text: component === 'Container' ? '' : props.text } });
      }
      if (effect.expectationIndexes.length === REQUIRED_WIDTHS.size) effect.status = 'expected';
    }
  }
  if (effects.length === 0 || expectations.length === 0) blockers.push({ code: 'no_observable_applied_props' });
  return { schemaVersion: 1, artifact: 'monteby-public-prop-expectations', expectations, effects, blockers, nodeMap,
    bindings: { site: scope.site, pageId: scope.pageId, publicPageUrl, operationsSha256: digest,
      operationsDigestFormat: 'sha256:canonical-json', beforeSnapshotSha256: snapshotDigest,
      savedSnapshotSha256: canonicalSha256(saved), snapshotDigestFormat: 'sha256:canonical-json',
      candidateLayoutSha256: savedDigest, candidateDigestFormat: 'sha256:utf8-builderJson', contractSha256: canonicalSha256(contract),
      compiledHtmlSha256: applied.response.compiledHtmlSha256, compiledHtmlDigestFormat: 'sha256:utf8-compiled-html' } };
}

function normalizedText(value) {
  return String(value || '').normalize('NFC').replace(/[\t\n\f\r ]+/gu, ' ').trim();
}

function surfaces(layout) {
  const observed = [
    ...(Array.isArray(layout?.textBoxes) ? layout.textBoxes : []),
    ...(Array.isArray(layout?.layoutGroups) ? layout.layoutGroups : []),
    ...(Array.isArray(layout?.landmarks) ? layout.landmarks : []),
  ];
  const unique = [];
  const byDomPath = new Map();
  for (const surface of observed) {
    const key = surface?.domPathKey;
    if (typeof key !== 'string' || key === '') {
      unique.push(surface);
      continue;
    }
    if (!/^\d+(?:\.\d+)*$/u.test(key)) throw new Error('Invalid capture DOM path key');
    const existing = byDomPath.get(key);
    if (!existing) {
      const copy = { ...surface };
      byDomPath.set(key, copy);
      unique.push(copy);
      continue;
    }
    for (const property of Object.keys(surface)) {
      if (Object.hasOwn(existing, property) && !isDeepStrictEqual(existing[property], surface[property])) {
        throw new Error(`Conflicting capture evidence for DOM path ${key}`);
      }
    }
    Object.assign(existing, surface);
  }
  return unique;
}

function publicPropVerification(spec, diagnosticLayouts, publicLayouts) {
  if (spec?.schemaVersion !== 1 || spec?.artifact !== 'monteby-public-prop-expectations' || !Array.isArray(spec.expectations)) {
    throw new Error('Expected a monteby-public-prop-expectations v1 artifact');
  }
  if (spec.expectations.length === 0) throw new Error('Expected nonempty public prop expectations');
  const diagnosticsByWidth = new Map();
  const publicByWidth = new Map();
  for (const [label, layouts, byWidth] of [
    ['diagnostic', diagnosticLayouts, diagnosticsByWidth],
    ['public', publicLayouts, publicByWidth],
  ]) {
    if (!Array.isArray(layouts)) throw new Error(`Expected ${label} capture array`);
    for (const layout of layouts) {
      const width = layout?.viewport?.width;
      if (!Number.isInteger(width) || width <= 0) throw new Error(`Invalid ${label} capture width`);
      if (byWidth.has(width)) throw new Error(`Duplicate ${label} capture at ${width}px`);
      byWidth.set(width, layout);
    }
  }
  for (const width of [...REQUIRED_WIDTHS, GEOMETRY_WIDTH]) {
    if (!diagnosticsByWidth.has(width) || !publicByWidth.has(width)) throw new Error(`Missing diagnostic/public capture at ${width}px`);
  }
  const results = spec.expectations.map((expectation, index) => {
    if (!expectation || typeof expectation !== 'object' || Array.isArray(expectation)
      || typeof expectation.nodeId !== 'string' || expectation.nodeId.trim() === ''
      || typeof expectation.prop !== 'string' || !/^(?:rect\.)?[A-Za-z][A-Za-z0-9]*$/u.test(expectation.prop)
      || !(typeof expectation.expected === 'string' || Number.isFinite(expectation.expected))) {
      throw new Error(`Expectation ${index} requires a nodeId, property and string or finite numeric expected value`);
    }
    if (Object.hasOwn(expectation, 'tolerance') && (!Number.isFinite(expectation.tolerance) || expectation.tolerance < 0)) {
      throw new Error(`Expectation ${index} requires a finite nonnegative tolerance`);
    }
    const width = expectation.width;
    if (!REQUIRED_WIDTHS.has(width)) throw new Error(`Expectation ${index} uses a non-canonical width`);
    const diagnostic = surfaces(diagnosticsByWidth.get(width)).filter((surface) => surface.montebyNodeId === expectation.nodeId);
    if (diagnostic.length !== 1) throw new Error(`Expectation ${index} cannot identify one diagnostic node`);
    const identity = expectation.identity;
    if (!identity || typeof identity.tag !== 'string' || identity.tag.trim() === '' || typeof identity.text !== 'string') {
      throw new Error(`Expectation ${index} requires semantic tag/text identity`);
    }
    if (String(diagnostic[0].tag || '').toLowerCase() !== identity.tag.toLowerCase()
      || normalizedText(diagnostic[0].text) !== normalizedText(identity.text)) {
      throw new Error(`Expectation ${index} identity does not describe the diagnostic root`);
    }
    const candidates = surfaces(publicByWidth.get(width)).filter((surface) => (
      String(surface.tag || '').toLowerCase() === identity.tag.toLowerCase()
      && normalizedText(surface.text) === normalizedText(identity.text)
    ));
    if (candidates.length !== 1) throw new Error(`Expectation ${index} public identity is ambiguous or missing`);
    const observed = expectation.prop.startsWith('rect.') ? candidates[0]?.rect : candidates[0];
    const property = expectation.prop.startsWith('rect.') ? expectation.prop.slice(5) : expectation.prop;
    if (!observed || !Object.hasOwn(observed, property)
      || !(typeof observed[property] === 'string' || Number.isFinite(observed[property]))) {
      throw new Error(`Expectation ${index} public property is missing or invalid`);
    }
    const actual = observed[property];
    const tolerance = Number.isFinite(expectation.tolerance) ? expectation.tolerance : 0;
    const matches = typeof expectation.expected === 'number'
      ? (typeof actual === 'number' || actual.trim() !== '')
        && Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expectation.expected) <= tolerance
      : String(actual) === expectation.expected;
    return { index, nodeId: expectation.nodeId, width, prop: expectation.prop, expected: expectation.expected, actual, matches,
      ...(expectation.operationIndex !== undefined ? { operationIndex: expectation.operationIndex, sourceProp: expectation.sourceProp } : {}) };
  });
  for (const width of REQUIRED_WIDTHS) {
    if (!results.some((result) => result.width === width)) throw new Error(`Missing public prop expectations at ${width}px`);
  }
  const geometry375 = publicByWidth.get(GEOMETRY_WIDTH);
  const geometrySurfaces = surfaces(geometry375);
  if (geometrySurfaces.length === 0 || !geometrySurfaces.every((surface) => surface?.rect
    && Number.isFinite(surface.rect.left) && Number.isFinite(surface.rect.right)
    && surface.rect.right >= surface.rect.left)) throw new Error('Missing or invalid 375px observed geometry');
  const overflowing = geometrySurfaces.filter((surface) => {
    const rect = surface?.rect;
    return rect && (Number(rect.left) < -1 || Number(rect.right) > GEOMETRY_WIDTH + 1);
  }).map((surface) => ({ tag: surface.tag || '', text: normalizedText(surface.text).slice(0, 80), rect: surface.rect }));
  return {
    schemaVersion: 1,
    artifact: 'monteby-public-prop-verification',
    complete: results.every((result) => result.matches) && overflowing.length === 0,
    results,
    geometry375: { overflowing },
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const values = {};
    for (let index = 0; index < argv.length; index += 2) values[argv[index]] = path.resolve(argv[index + 1] || '');
    for (const option of ['--expectations', '--diagnostic-layouts', '--public-layouts']) {
      if (!values[option]) throw new Error(`${option} is required`);
    }
    const report = publicPropVerification(
      JSON.parse(fs.readFileSync(values['--expectations'], 'utf8')),
      JSON.parse(fs.readFileSync(values['--diagnostic-layouts'], 'utf8')),
      JSON.parse(fs.readFileSync(values['--public-layouts'], 'utf8')),
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.complete ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { publicPropVerification, appliedPropExpectations };
