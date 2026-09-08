'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { publicPropVerification } = require('../monteby-site-authoring/scripts/verify-public-props');

function layouts(publicCapture = false) {
  return [1440, 834, 390, 375].map((width) => ({
    viewport: { width, height: 844 },
    textBoxes: [{
      ...(!publicCapture ? { montebyNodeId: 'heading-1' } : {}),
      tag: 'h1', text: 'Pełny nagłówek', color: 'rgb(1, 2, 3)',
      rect: { left: 20, right: Math.min(width - 20, 700), top: 40, width: Math.min(width - 40, 680), height: 80 },
    }],
    layoutGroups: [], landmarks: [],
  }));
}

test('public prop verification correlates one semantic public surface and checks 375px overflow', () => {
  const report = publicPropVerification({
    schemaVersion: 1,
    artifact: 'monteby-public-prop-expectations',
    expectations: [{
      nodeId: 'heading-1', width: 390, prop: 'color', expected: 'rgb(1, 2, 3)',
      identity: { tag: 'h1', text: 'Pełny nagłówek' },
    }],
  }, layouts(), layouts(true));
  assert.equal(report.complete, true);
  assert.deepEqual(report.geometry375.overflowing, []);
});

test('public prop verification blocks ambiguous identity and missing canonical captures', () => {
  const spec = {
    schemaVersion: 1,
    artifact: 'monteby-public-prop-expectations',
    expectations: [{ nodeId: 'heading-1', width: 390, prop: 'color', expected: 'red', identity: { tag: 'h1', text: 'Pełny nagłówek' } }],
  };
  const publicLayouts = layouts(true);
  publicLayouts.find((layout) => layout.viewport.width === 390).textBoxes.push({ ...publicLayouts[2].textBoxes[0] });
  assert.throws(() => publicPropVerification(spec, layouts(), publicLayouts), /ambiguous or missing/);
  assert.throws(() => publicPropVerification(spec, layouts().slice(0, 3), layouts(true)), /375px/);
});
