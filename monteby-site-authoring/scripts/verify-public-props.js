#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const REQUIRED_WIDTHS = new Set([1440, 834, 390]);
const GEOMETRY_WIDTH = 375;

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
    return { index, nodeId: expectation.nodeId, width, prop: expectation.prop, expected: expectation.expected, actual, matches };
  });
  for (const width of REQUIRED_WIDTHS) {
    if (!results.some((result) => result.width === width)) throw new Error(`Missing public prop expectations at ${width}px`);
  }
  const geometry375 = publicByWidth.get(GEOMETRY_WIDTH);
  const overflowing = surfaces(geometry375).filter((surface) => {
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

module.exports = { publicPropVerification };
