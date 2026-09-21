'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  validateButtonFormPrefillRelationships,
} = require('../monteby-site-authoring/scripts/control-contract');

const kitModule = import(path.resolve(__dirname, '../monteby-site-authoring/scripts/layout-kit.mjs'));

function contract() {
  return {
    components: [
      { name: 'Section', isCanvas: true, props: [], allowedParents: ['ROOT'] },
      {
        name: 'ButtonBlock',
        props: ['label', 'prefillFormId', 'prefillFieldId', 'prefillValue'],
        allowedParents: ['Section'],
        controls: [
          { type: 'text', props: ['label'] },
          { type: 'text', props: ['prefillFormId'], allowEmpty: true },
          { type: 'text', props: ['prefillFieldId'], allowEmpty: true },
          { type: 'text', props: ['prefillValue'], allowEmpty: true },
        ],
      },
      {
        name: 'FormBlock',
        props: ['formId', 'fields'],
        allowedParents: ['Section'],
        controls: [
          { type: 'text', props: ['formId'] },
          {
            type: 'repeater',
            props: ['fields'],
            itemControls: [
              { type: 'text', props: ['fieldId'] },
              { type: 'text', props: ['name'] },
              { type: 'select', props: ['type'], options: ['text', 'number', 'select', 'radio', 'checkbox', 'hidden'] },
              { type: 'textarea', props: ['options'], allowEmpty: true },
              { type: 'number', props: ['min'] },
              { type: 'number', props: ['max'] },
              { type: 'number', props: ['step'] },
            ],
          },
        ],
      },
    ],
    authoring: {
      blockedProps: [],
      topLevelRootComponents: ['Section'],
      relationshipRules: {
        buttonFormPrefill: {
          buttonComponent: 'ButtonBlock',
          formComponent: 'FormBlock',
          formReferenceProp: 'prefillFormId',
          fieldReferenceProp: 'prefillFieldId',
          valueProp: 'prefillValue',
          formIdentityProp: 'formId',
          fieldsProp: 'fields',
          fieldIdentityProps: ['fieldId', 'name'],
          fieldTypeProp: 'type',
          optionsProp: 'options',
          allEmptyInert: true,
          maximumValueCodePoints: 500,
          supportedFieldTypes: ['text', 'number', 'select', 'radio', 'checkbox'],
        },
      },
    },
  };
}

function node(type, props = {}, parent = 'section', hidden = false) {
  return { type: { resolvedName: type }, props, parent, hidden, nodes: [], isCanvas: false };
}

function layout(field = { fieldId: 'plan', name: 'plan-name', type: 'select', options: 'Standard|standard\nPro|pro' }) {
  return {
    ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, parent: null, nodes: ['section'], isCanvas: true },
    section: { type: { resolvedName: 'Section' }, props: {}, parent: 'ROOT', nodes: ['button', 'form'], isCanvas: true },
    button: node('ButtonBlock', { label: 'Choose', prefillFormId: 'quote', prefillFieldId: 'plan', prefillValue: 'pro' }),
    form: node('FormBlock', { formId: 'quote', fields: [field] }),
  };
}

test('live buttonFormPrefill relationship accepts one exact visible form and field', () => {
  assert.deepEqual(validateButtonFormPrefillRelationships(layout(), contract()), []);
  const inert = layout();
  inert.button.props = { label: 'Plain link' };
  assert.deepEqual(validateButtonFormPrefillRelationships(inert, contract()), []);
});

test('buttonFormPrefill relationship fails closed for missing, duplicate and hidden targets', () => {
  const missing = layout();
  missing.button.props.prefillFormId = 'missing';
  assert.equal(validateButtonFormPrefillRelationships(missing, contract())[0].code, 'unknown_form_prefill_form');

  const duplicate = layout();
  duplicate.form2 = node('FormBlock', duplicate.form.props);
  duplicate.section.nodes.push('form2');
  assert.equal(validateButtonFormPrefillRelationships(duplicate, contract())[0].code, 'ambiguous_form_prefill_form');

  const hidden = layout();
  hidden.form.hidden = true;
  assert.equal(validateButtonFormPrefillRelationships(hidden, contract())[0].code, 'hidden_form_prefill_form');

  const missingField = layout();
  missingField.button.props.prefillFieldId = 'missing';
  assert.equal(validateButtonFormPrefillRelationships(missingField, contract())[0].code, 'unknown_form_prefill_field');
});

test('buttonFormPrefill relationship derives option, checkbox and number rules from the target field', () => {
  const invalidOption = layout();
  invalidOption.button.props.prefillValue = 'enterprise';
  assert.equal(validateButtonFormPrefillRelationships(invalidOption, contract())[0].code, 'invalid_form_prefill_option');

  const checkbox = layout({ fieldId: 'plan', type: 'checkbox' });
  checkbox.button.props.prefillValue = 'yes';
  assert.equal(validateButtonFormPrefillRelationships(checkbox, contract())[0].code, 'invalid_form_prefill_checkable_value');

  const number = layout({ fieldId: 'plan', type: 'number', min: 10, max: 20, step: 5 });
  number.button.props.prefillValue = '17';
  assert.equal(validateButtonFormPrefillRelationships(number, contract())[0].code, 'invalid_form_prefill_number');
  number.button.props.prefillValue = '20';
  assert.deepEqual(validateButtonFormPrefillRelationships(number, contract()), []);
});

test('buttonFormPrefill relationship rejects incomplete live metadata instead of guessing', () => {
  const malformed = contract();
  delete malformed.authoring.relationshipRules.buttonFormPrefill.fieldIdentityProps;
  assert.equal(validateButtonFormPrefillRelationships(layout(), malformed)[0].code, 'invalid_relationship_contract');
});

test('Layout Kit blocks a relationship that its per-control validation cannot detect', async () => {
  const { Kit } = await kitModule;
  const kit = new Kit(contract());
  const form = kit.node('FormBlock', {
    formId: 'quote',
    fields: [{ fieldId: 'plan', name: 'plan-name', type: 'select', options: 'Standard|standard\nPro|pro' }],
  });
  const button = kit.node('ButtonBlock', {
    label: 'Choose', prefillFormId: 'quote', prefillFieldId: 'plan', prefillValue: 'missing',
  });
  const section = kit.node('Section', {}, [button, form]);
  assert.throws(() => kit.build([section]), /relationship plan rejected.*published option/u);
});
