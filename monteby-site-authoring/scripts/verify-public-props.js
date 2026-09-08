#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_WIDTHS = new Set([1440, 834, 390]);
const GEOMETRY_WIDTH = 375;

function normalizedText(value) {
  return String(value || '').normalize('NFC').replace(/[\t\n\f\r ]+/gu, ' ').trim();
}

function surfaces(layout) {
  return [
    ...(Array.isArray(layout?.textBoxes) ? layout.textBoxes : []),
    ...(Array.isArray(layout?.layoutGroups) ? layout.layoutGroups : []),
    ...(Array.isArray(layout?.landmarks) ? layout.landmarks : []),
  ];
}

function publicPropVerification(spec, diagnosticLayouts, publicLayouts) {
  if (spec?.schemaVersion !== 1 || spec?.artifact !== 'monteby-public-prop-expectations' || !Array.isArray(spec.expectations)) {
    throw new Error('Expected a monteby-public-prop-expectations v1 artifact');
  }
  const diagnosticsByWidth = new Map(diagnosticLayouts.map((layout) => [Number(layout?.viewport?.width), layout]));
  const publicByWidth = new Map(publicLayouts.map((layout) => [Number(layout?.viewport?.width), layout]));
  for (const width of [...REQUIRED_WIDTHS, GEOMETRY_WIDTH]) {
    if (!diagnosticsByWidth.has(width) || !publicByWidth.has(width)) throw new Error(`Missing diagnostic/public capture at ${width}px`);
  }
  const results = spec.expectations.map((expectation, index) => {
    const width = Number(expectation.width);
    if (!REQUIRED_WIDTHS.has(width)) throw new Error(`Expectation ${index} uses a non-canonical width`);
    const diagnostic = surfaces(diagnosticsByWidth.get(width)).filter((surface) => surface.montebyNodeId === expectation.nodeId);
    if (diagnostic.length !== 1) throw new Error(`Expectation ${index} cannot identify one diagnostic node`);
    const identity = expectation.identity;
    if (!identity || typeof identity.tag !== 'string' || typeof identity.text !== 'string') {
      throw new Error(`Expectation ${index} requires semantic tag/text identity`);
    }
    const candidates = surfaces(publicByWidth.get(width)).filter((surface) => (
      String(surface.tag || '').toLowerCase() === identity.tag.toLowerCase()
      && normalizedText(surface.text) === normalizedText(identity.text)
    ));
    if (candidates.length !== 1) throw new Error(`Expectation ${index} public identity is ambiguous or missing`);
    const actual = expectation.prop.startsWith('rect.')
      ? candidates[0]?.rect?.[expectation.prop.slice(5)]
      : candidates[0]?.[expectation.prop];
    const tolerance = Number.isFinite(expectation.tolerance) ? expectation.tolerance : 0;
    const matches = typeof expectation.expected === 'number'
      ? Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expectation.expected) <= tolerance
      : String(actual ?? '') === String(expectation.expected);
    return { index, nodeId: expectation.nodeId, width, prop: expectation.prop, expected: expectation.expected, actual, matches };
  });
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
