'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { publicPropVerification } = require('../monteby-site-authoring/scripts/verify-public-props');

const completeSpec = {
  schemaVersion: 1,
  artifact: 'monteby-public-prop-expectations',
  expectations: [1440, 834, 390].map((width) => ({
    nodeId: 'heading-1', width, prop: 'color', expected: 'rgb(1, 2, 3)',
    identity: { tag: 'h1', text: 'Pełny nagłówek' },
  })),
};

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
  const report = publicPropVerification(completeSpec, layouts(), layouts(true));
  assert.equal(report.complete, true);
  assert.equal(report.results.length, 3);
  assert.ok(report.results.every((result) => result.actual === 'rgb(1, 2, 3)' && result.matches));
  assert.deepEqual(report.geometry375.overflowing, []);
});

test('public prop verification rejects empty and incomplete expectation coverage', () => {
  assert.throws(() => publicPropVerification({ ...completeSpec, expectations: [] }, layouts(), layouts(true)), /nonempty/);
  for (const width of [1440, 834, 390]) {
    const spec = { ...completeSpec, expectations: completeSpec.expectations.filter((entry) => entry.width !== width) };
    assert.throws(() => publicPropVerification(spec, layouts(), layouts(true)), new RegExp(`expectations at ${width}px`));
  }
  assert.throws(() => publicPropVerification(completeSpec, layouts(), layouts(true).map((layout) => ({ ...layout, textBoxes: [] }))), /ambiguous or missing/);
});

test('public prop verification rejects duplicate and malformed capture widths on either side', () => {
  for (const side of [0, 1]) {
    for (const width of [1440, 834, 390, 375]) {
      const captures = [layouts(), layouts(true)];
      captures[side].push(structuredClone(captures[side].find((layout) => layout.viewport.width === width)));
      assert.throws(() => publicPropVerification(completeSpec, ...captures), /Duplicate .* capture/);
    }
    for (const width of ['1440', null, 0, -1, 1440.5, NaN, Infinity]) {
      const captures = [layouts(), layouts(true)];
      captures[side][0].viewport.width = width;
      assert.throws(() => publicPropVerification(completeSpec, ...captures), /Invalid .* capture width/);
    }
    const captures = [layouts(), layouts(true)];
    captures[side] = {};
    assert.throws(() => publicPropVerification(completeSpec, ...captures), /capture array/);
  }
});

test('public prop verification rejects malformed expectation shapes and tolerance', () => {
  for (const change of [
    { nodeId: '' }, { nodeId: null }, { prop: '' }, { prop: null }, { prop: 'rect.' },
    { prop: 'rect.width.extra' }, { expected: undefined }, { expected: null },
    { expected: {} }, { expected: [] }, { expected: true }, { expected: NaN }, { expected: Infinity },
    { width: '1440' }, { width: 375 }, { identity: {} }, { identity: { tag: '', text: '' } },
    { tolerance: -1 }, { tolerance: '1' }, { tolerance: null }, { tolerance: NaN }, { tolerance: Infinity },
  ]) {
    const spec = structuredClone(completeSpec);
    Object.assign(spec.expectations[0], change);
    assert.throws(() => publicPropVerification(spec, layouts(), layouts(true)), /Expectation 0/);
  }
  for (const expectation of [null, [], 'color']) {
    const spec = structuredClone(completeSpec);
    spec.expectations[0] = expectation;
    assert.throws(() => publicPropVerification(spec, layouts(), layouts(true)), /Expectation 0/);
  }
});

test('public prop verification requires an observed own scalar property, including for empty and zero expectations', () => {
  for (const prop of ['color', 'rect.height']) {
    for (const actual of [undefined, null, {}, [], false, Infinity, NaN]) {
      const spec = structuredClone(completeSpec);
      spec.expectations[0] = { ...spec.expectations[0], prop, expected: '' };
      const captured = layouts(true);
      const surface = captured[0].textBoxes[0];
      if (prop === 'color') surface.color = actual;
      else surface.rect.height = actual;
      assert.throws(() => publicPropVerification(spec, layouts(), captured), /public property is missing or invalid/);
    }
  }
  const inherited = layouts(true);
  delete inherited[0].textBoxes[0].color;
  Object.setPrototypeOf(inherited[0].textBoxes[0], { color: 'rgb(1, 2, 3)' });
  assert.throws(() => publicPropVerification(completeSpec, layouts(), inherited), /public property is missing or invalid/);
  const spec = structuredClone(completeSpec);
  spec.expectations[0] = { ...spec.expectations[0], prop: 'rect.height', expected: 0 };
  const captured = layouts(true);
  captured[0].textBoxes[0].rect.height = '';
  assert.equal(publicPropVerification(spec, layouts(), captured).complete, false);
});

test('public prop verification preserves observed empty strings, numeric tolerance and mismatch reporting', () => {
  const spec = structuredClone(completeSpec);
  spec.expectations[0] = { ...spec.expectations[0], prop: 'rect.height', expected: 80.25, tolerance: 0.25 };
  spec.expectations[1].expected = '';
  const captured = layouts(true);
  captured[1].textBoxes[0].color = '';
  assert.equal(publicPropVerification(spec, layouts(), captured).complete, true);
  spec.expectations[0].tolerance = 0.24;
  const mismatch = publicPropVerification(spec, layouts(), captured);
  assert.equal(mismatch.complete, false);
  assert.equal(mismatch.results[0].matches, false);
  spec.expectations[0].tolerance = 0.25;
  captured[3].textBoxes[0].rect.right = 377;
  const overflow = publicPropVerification(spec, layouts(), captured);
  assert.equal(overflow.complete, false);
  assert.equal(overflow.geometry375.overflowing.length, 1);
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

test('public prop verification merges only matching capture-local DOM keys without mutating evidence', () => {
  const captures = [layouts(), layouts(true)];
  for (const captured of captures) {
    for (const layout of captured) {
      const text = layout.textBoxes[0];
      text.domPathKey = '0.1';
      layout.layoutGroups.push({ domPathKey: '0.1', tag: text.tag, rect: { ...text.rect } });
      layout.landmarks.push({ ...text });
    }
  }
  const before = structuredClone(captures);
  const report = publicPropVerification(completeSpec, ...captures);
  assert.equal(report.complete, true);
  assert.equal(report.results.length, 3);
  assert.deepEqual(captures, before);
});

test('public prop verification rejects conflicting DOM evidence, multiple roots and legacy duplicates', () => {
  for (const side of [0, 1]) {
    for (const change of [{ domPathKey: '0.2' }, { color: 'red' }, { tag: 'p' }, ...(side === 0 ? [{ montebyNodeId: 'other' }] : []), { rect: { left: 0 } }]) {
      const captures = [layouts(), layouts(true)];
      captures[side][0].textBoxes[0].domPathKey = '0.1';
      captures[side][0].landmarks.push({ ...captures[side][0].textBoxes[0], ...change });
      assert.throws(() => publicPropVerification(completeSpec, ...captures), /Conflicting capture evidence|cannot identify one diagnostic node|ambiguous or missing/);
    }
    const captures = [layouts(), layouts(true)];
    captures[side][0].landmarks.push({ ...captures[side][0].textBoxes[0] });
    assert.throws(() => publicPropVerification(completeSpec, ...captures), /cannot identify one diagnostic node|ambiguous or missing/);
  }
});

test('public prop verification cannot redirect a root expectation to an inner control', () => {
  const captures = [layouts(), layouts(true)];
  captures[1][0].textBoxes.push({ tag: 'label', text: 'Name', color: 'rgb(1, 2, 3)' });
  const spec = structuredClone(completeSpec);
  spec.expectations[0].identity = { tag: 'label', text: 'Name' };
  assert.throws(() => publicPropVerification(spec, ...captures), /identity does not describe the diagnostic root/);
});

test('public prop verification rejects non-DOM-path deduplication keys', () => {
  const captured = layouts(true);
  captured[0].textBoxes[0].domPathKey = 'heading-1';
  assert.throws(() => publicPropVerification(completeSpec, layouts(), captured), /Invalid capture DOM path key/);
});
