'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildControlIndex,
  collectControlMetadata,
  nestedControlMap,
  normalizeControlValue,
  publishedControlReferences,
} = require('../monteby-site-authoring/scripts/control-contract');

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

test('control metadata keeps nested fields contextual and enforces nested bounds', () => {
  const control = {
    type: 'repeater',
    props: ['items'],
    minItems: 1,
    maxItems: 2,
    itemControls: [
      { type: 'text', props: ['label'], minLength: 2, maxLength: 4 },
      { type: 'number', props: ['count'], min: 1, max: 3, step: 1 },
    ],
  };
  const contract = { components: [{ name: 'CardList', controls: [control] }] };
  const metadata = collectControlMetadata([control]);
  const index = buildControlIndex(contract);

  assert.deepEqual(metadata.props, ['items']);
  assert.equal(index.has('CardList.label'), false);
  assert.deepEqual([...nestedControlMap(index.get('CardList.items')).keys()], ['label', 'count']);
  assert.equal(normalizeControlValue(index.get('CardList.items'), []).accepted, false);
  assert.equal(normalizeControlValue(index.get('CardList.items'), [{ label: 'A', count: 2 }]).accepted, false);
  assert.equal(normalizeControlValue(index.get('CardList.items'), [{ label: 'Good', count: 2 }]).accepted, true);
  assert.equal(normalizeControlValue(index.get('CardList.items'), [{ label: 'Good', invented: true }]).accepted, false);
  assert.equal(normalizeControlValue(index.get('CardList.items'), [
    { label: 'One', count: 1 },
    { label: 'Two', count: 2 },
    { label: 'More', count: 3 },
  ]).accepted, false);
});

test('control normalization honors empty, atomic, list, matrix, and spacing metadata', () => {
  assert.equal(normalizeControlValue({ type: 'number', min: 0, max: 5, step: 1 }, '').accepted, false);
  assert.deepEqual(
    normalizeControlValue({ type: 'number', min: 0, max: 5, step: 1, allowEmpty: true }, ''),
    { accepted: true, value: '' },
  );
  assert.equal(normalizeControlValue({
    type: 'object',
    atomic: true,
    itemControls: [{ type: 'number', props: ['count'], min: 0, max: 5, step: 1 }],
  }, { count: '2' }).accepted, false);
  assert.equal(normalizeControlValue({
    type: 'object',
    atomic: true,
    itemControls: [{ type: 'number', props: ['count'], min: 0, max: 5, step: 1 }],
  }, { count: 2 }).accepted, true);
  assert.equal(normalizeControlValue({ type: 'tag-list', minItems: 1, maxItems: 2 }, ['same', 'same']).accepted, false);
  assert.equal(normalizeControlValue({ type: 'tag-list', uniqueItems: false }, ['same', 'same']).accepted, true);
  assert.deepEqual(normalizeControlValue({ type: 'tag-list' }, [' one ', 'two']), {
    accepted: true,
    value: ['one', 'two'],
    changed: true,
    changeReason: 'przycięto białe znaki tag-list',
  });
  assert.equal(normalizeControlValue({ type: 'number', min: 0.25, max: 5, step: 0.5 }, 0.7).value, 0.75);
  assert.equal(normalizeControlValue({ type: 'string-matrix', columns: 2, maxColumns: 2 }, [['a']]).accepted, false);
  assert.deepEqual(normalizeControlValue(
    { type: 'spacing', units: ['px'], min: 0, max: 20, step: 1 },
    { top: '4.4px', left: '2px' },
  ), {
    accepted: true,
    value: { top: '4px', left: '2px' },
    changed: true,
    changeReason: 'znormalizowano krawędzie spacing',
  });
  assert.equal(normalizeControlValue(
    { type: 'spacing', units: ['px'] },
    { inlineStart: '4px' },
  ).accepted, false);
});

test('valueSchemas prove exact defaults without narrowing non-default authoring values', () => {
  const contract = {
    components: [{
      name: 'Heading',
      defaults: { text: '' },
      valueSchemas: { text: { type: 'string', const: '' } },
      controls: [{ type: 'text', props: ['text'], maxLength: 20 }],
    }],
  };
  const control = buildControlIndex(contract).get('Heading.text');
  assert.equal(normalizeControlValue(control, '').accepted, true);
  assert.equal(normalizeControlValue(control, 'Published copy').accepted, true);

  const legacyDefault = buildControlIndex({
    components: [{
      name: 'Heading',
      defaults: { fontSize: '' },
      controls: [{ type: 'css-value', props: ['fontSize'], units: ['px'] }],
    }],
  }).get('Heading.fontSize');
  assert.equal(normalizeControlValue(legacyDefault, '').accepted, true);

  const missingSchema = buildControlIndex({
    components: [{
      name: 'Heading',
      defaults: { text: '', tag: 'h2' },
      valueSchemas: { tag: { type: 'string', const: 'h2' } },
      controls: [{ type: 'text', props: ['text'] }],
    }],
  }).get('Heading.text');
  const result = normalizeControlValue(missingSchema, 'Copy');
  assert.equal(result.accepted, false);
  assert.equal(result.contractError, true);
});

test('host bindings enforce exact sources, prefixes, targets, schemas, and bounded media references', () => {
  const contract = {
    dynamicFields: {
      fields: [
        { key: 'post_title', target: 'text' },
        { key: 'custom_field', target: 'text' },
        { key: 'field_gallery:photos', target: 'media' },
      ],
    },
    hostChoices: {
      queryLoop: {
        postTypes: [{ name: 'post' }, { name: 'page' }],
      },
    },
    components: [
      {
        name: 'ImageGallery',
        hostScopedProps: ['dynamicImages'],
        hostBindings: {
          dynamicImages: {
            source: 'dynamicFields.fields',
            valueField: 'key',
            kind: 'dynamic-field',
            prefix: 'field_gallery:',
          },
        },
        controls: [{ type: 'host-choice', props: ['dynamicImages'], source: 'dynamicFields.fields' }],
      },
      {
        name: 'FormBlock',
        hostScopedProps: ['fields[].dynamicValue'],
        hostBindings: {
          'fields[].dynamicValue': {
            source: 'dynamicFields.fields',
            valueField: 'key',
            kind: 'dynamic-field',
            target: 'text',
            excludeValues: ['custom_field'],
          },
        },
        controls: [{
          type: 'repeater',
          props: ['fields'],
          itemControls: [{ type: 'host-choice', props: ['dynamicValue'], source: 'dynamicFields.fields' }],
        }],
      },
      {
        name: 'QueryLoop',
        hostScopedProps: ['postType'],
        hostBindings: {
          postType: {
            source: 'hostChoices.queryLoop.postTypes',
            valueField: 'name',
            schema: { type: 'string', minLength: 1 },
          },
        },
        controls: [{ type: 'host-choice', props: ['postType'], source: 'hostChoices.queryLoop.postTypes' }],
      },
      {
        name: 'ImageBlock',
        hostScopedProps: ['attachmentId'],
        controls: [{ type: 'number', props: ['attachmentId'], min: 0, max: 1000000, step: 1 }],
      },
    ],
  };
  const index = buildControlIndex(contract);
  const gallery = index.get('ImageGallery.dynamicImages');
  const formFields = index.get('FormBlock.fields');
  const formDynamicValue = nestedControlMap(formFields).get('dynamicValue');
  const postType = index.get('QueryLoop.postType');
  const attachment = index.get('ImageBlock.attachmentId');

  assert.equal(normalizeControlValue(gallery, 'field_gallery:photos').accepted, true);
  assert.equal(normalizeControlValue(gallery, 'post_title').accepted, false);
  assert.equal(normalizeControlValue(formDynamicValue, 'post_title').accepted, true);
  assert.equal(normalizeControlValue(formDynamicValue, 'custom_field').accepted, false);
  assert.equal(normalizeControlValue(formDynamicValue, 'field_gallery:photos').accepted, false);
  assert.equal(normalizeControlValue(postType, 'post').accepted, true);
  assert.equal(normalizeControlValue(postType, '').accepted, false);
  assert.equal(normalizeControlValue(postType, 'product').accepted, false);
  assert.equal(normalizeControlValue(attachment, 42).accepted, true);

  const unbounded = buildControlIndex({
    components: [{
      name: 'ImageBlock',
      hostScopedProps: ['attachmentId'],
      controls: [{ type: 'number', props: ['attachmentId'] }],
    }],
  }).get('ImageBlock.attachmentId');
  assert.equal(normalizeControlValue(unbounded, 42).contractError, true);

  const unboundedDefault = buildControlIndex({
    components: [{
      name: 'ImageBlock',
      defaults: { attachmentId: 0 },
      valueSchemas: { attachmentId: { type: 'integer', const: 0 } },
      hostScopedProps: ['attachmentId'],
      controls: [{ type: 'number', props: ['attachmentId'] }],
    }],
  }).get('ImageBlock.attachmentId');
  assert.equal(normalizeControlValue(unboundedDefault, 0).contractError, true);
});

test('malformed controls and host bindings fail closed', () => {
  for (const control of [
    { type: 'text', minLength: 5, maxLength: 2 },
    { type: 'repeater', minItems: 2, maxItems: 1, itemControls: [{ type: 'text', props: ['label'] }] },
    { type: 'object', atomic: 'yes', itemControls: [{ type: 'text', props: ['label'] }] },
    { type: 'text', pattern: '[' },
  ]) {
    const result = normalizeControlValue(control, 'value');
    assert.equal(result.accepted, false);
    assert.equal(result.contractError, true);
  }

  const sourceMismatch = buildControlIndex({
    hostChoices: { queryLoop: { postTypes: [{ name: 'post' }] } },
    components: [{
      name: 'QueryLoop',
      hostScopedProps: ['postType'],
      hostBindings: { postType: { source: 'hostChoices.queryLoop.postTypes', valueField: 'name' } },
      controls: [{ type: 'host-choice', props: ['postType'], source: 'hostChoices.queryLoop.templates' }],
    }],
  }).get('QueryLoop.postType');
  assert.equal(normalizeControlValue(sourceMismatch, 'post').contractError, true);

  const malformedExclusion = buildControlIndex({
    dynamicFields: { fields: [{ key: 'post_title', target: 'text' }] },
    components: [{
      name: 'FormBlock',
      hostScopedProps: ['fields[].dynamicValue'],
      hostBindings: {
        'fields[].dynamicValue': {
          source: 'dynamicFields.fields', kind: 'dynamic-field', target: 'text', excludeValues: 'post_title',
        },
      },
      controls: [{
        type: 'repeater', props: ['fields'], itemControls: [{ type: 'host-choice', props: ['dynamicValue'], source: 'dynamicFields.fields' }],
      }],
    }],
  }).get('FormBlock.fields');
  assert.equal(normalizeControlValue(nestedControlMap(malformedExclusion).get('dynamicValue'), 'post_title').contractError, true);

  for (const componentMetadata of [
    { hostScopedProps: 'postType' },
    { hostBindings: [] },
    { valueSchemas: [] },
  ]) {
    const malformed = buildControlIndex({
      components: [{
        name: 'QueryLoop',
        ...componentMetadata,
        controls: [{ type: 'text', props: ['postType'] }],
      }],
    }).get('QueryLoop.postType');
    assert.equal(normalizeControlValue(malformed, 'post').contractError, true);
  }
});

test('published CSS references stay scoped to the exact component prop', () => {
  const contract = {
    designTokens: {
      tokens: {
        headingSize: { reference: 'var(--monteby-token-typography-heading-size)' },
        bodySize: { reference: 'var(--monteby-token-typography-body-size)' },
      },
      bindings: {
        Heading: { fontSize: 'headingSize' },
        Text: { fontSize: 'bodySize' },
      },
    },
  };
  const heading = publishedControlReferences(contract, 'Heading', 'fontSize', { type: 'css-value' });
  assert.equal(heading.has('var(--monteby-token-typography-heading-size)'), true);
  assert.equal(heading.has('var(--monteby-token-typography-body-size)'), false);
});
