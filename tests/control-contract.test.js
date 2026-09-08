'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildControlIndex, collectControlMetadata, normalizeControlValue } = require('../monteby-site-authoring/scripts/control-contract');

test('shared control index exposes spacing, options, rules, and repeater item metadata once', () => {
  const controls = [{
    type: 'repeater', prop: 'items', itemControls: [
      { type: 'select', prop: 'variant', options: [{ value: 'one' }, { value: 'two' }] },
      { type: 'number', prop: 'count', min: 1, max: 5, step: 1 },
    ],
  }, {
    type: 'spacing', spacingProps: { top: 'paddingTop', bottom: 'paddingBottom' }, units: ['px'],
  }];
  const metadata = collectControlMetadata(controls);
  assert.deepEqual([...metadata.repeaterItemProps.get('items')].sort(), ['count', 'variant']);
  assert.equal(metadata.repeaterItemRules.get('items').get('variant').options.has('two'), true);
  assert.equal(metadata.propRules.get('paddingTop').type, 'spacing');
  const index = buildControlIndex({ components: [{ name: 'Card', controls }] });
  assert.equal(index.get('Card.paddingBottom').type, 'spacing');
});

test('shared control normalization accepts only published references and follows numeric control steps', () => {
  assert.deepEqual(normalizeControlValue(
    { type: 'number', min: 0, max: 10, step: 0.5 },
    4.26,
  ), { accepted: true, value: 4.5, changed: true, changeReason: 'dociągnięte do kroku 0.5: 4.26 → 4.5' });
  assert.equal(normalizeControlValue(
    { type: 'color' },
    'var(--gcb-color-accent)',
    new Set(['var(--gcb-color-accent)']),
  ).accepted, true);
  assert.equal(normalizeControlValue({ type: 'color' }, 'var(--private-token)').accepted, false);
});
