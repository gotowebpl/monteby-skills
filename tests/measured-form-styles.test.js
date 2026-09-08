'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const test = require('node:test');

const script = path.resolve(__dirname, '../monteby-site-authoring/scripts/draft-monteby-layout.js');
const sandbox = { require: createRequire(script), module: { exports: {} }, console, process, __dirname: path.dirname(script), Buffer, Map, Set };
vm.runInNewContext(fs.readFileSync(script, 'utf8').replace(/\nmain\(\);\s*$/u, '\nmodule.exports = { summarizeReferenceForm, groupReferenceFormFields, buildContractIndex, filterAllowedProps, addGenericMeasuredGroups };'), sandbox, { filename: script });
const { summarizeReferenceForm, groupReferenceFormFields, buildContractIndex, filterAllowedProps, addGenericMeasuredGroups } = sandbox.module.exports;

if (process.env.MONTEBY_MEASURED_FORM_BROWSER_QA === '1') {
  const captureScript = path.resolve(__dirname, '../monteby-site-authoring/scripts/capture-template-reference.js');
  const captureSandbox = { ...sandbox, require: createRequire(captureScript), module: { exports: {} }, __dirname: path.dirname(captureScript) };
  vm.runInNewContext(`${fs.readFileSync(captureScript, 'utf8')}\nmodule.exports.expression = '(() => {' + [visibleRectangleUnionArea, safeGradientEvidence, safeVisualFrameEvidence, safeCapturedFontFamily, primaryFontEvidence, captureRenderedLayout].map(fn => fn.toString()).join('\\n') + ';return captureRenderedLayout();})()';`, captureSandbox, { filename: captureScript });
  const playwright = require(process.env.MONTEBY_PLAYWRIGHT_MODULE || 'playwright');
  const reference = fs.readFileSync(process.env.MONTEBY_FORM_REFERENCE_HTML, 'utf8');
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    for (const width of [1440, 834, 390, 375]) {
      test(`real ${engine} ${width}px form capture keeps measured typography and geometry`, async () => {
        const browser = await playwright[engine].connect(process.env.MONTEBY_PLAYWRIGHT_WS);
        try {
          const page = await browser.newPage({ viewport: { width, height: 1000 } });
          await page.route('https://**/*', (route) => route.abort());
          await page.setContent(reference);
          const layout = await page.evaluate(captureSandbox.module.exports.expression);
          const fields = layout.interactions.filter((control) => ['input', 'textarea', 'select'].includes(control.tag));
          const submit = layout.interactions.find((control) => control.tag === 'button' && control.type === 'submit');
          const formKey = fields[0].formKey;
          const band = layout.layoutGroups.filter((group) => formKey.startsWith(`${group.key}.`) && group.tag === 'section').at(-1);
          assert.ok(band, 'Form has a real captured owning band');
          const summary = summarizeReferenceForm(fields, submit, layout.layoutGroups, layout.textBoxes, band, formKey);
          assert.ok(summary, 'Captured native form becomes a FormBlock summary');
          assert.equal(fields[0].fieldGap, '8px');
          assert.equal(fields[0].labelStyle.fontSize, '16px');
          assert.equal(fields[0].labelStyle.fontWeight, '400');
          assert.ok(fields[0].labelRect.height > fields[0].rect.height);
          assert.equal(summary.props.formPaddingY, '0px');
          assert.equal(summary.props.formPaddingX, '0px');
          assert.equal(summary.props.formGap, '20px');
          assert.equal(summary.props.fieldGap, '8px');
          assert.equal(summary.props.labelFontSize, '16px');
          assert.equal(summary.props.labelFontWeight, 'font-normal');
          assert.equal(summary.props.inputBorderRadius, '6px');
          assert.equal(summary.props.inputHeight, '50px');
          assert.equal(summary.props.textareaHeight, '112px');
          assert.equal(summary.props.textareaMinHeight, '112px');
          assert.equal(summary.props.buttonJustifySelf, 'start');
          assert.ok(Math.abs(Number.parseFloat(summary.props.buttonWidth) - submit.rect.width) < 0.1);
        } finally {
          await browser.close();
        }
      });
    }
  }
}

test('measured forms use actual form padding, field wrappers and label typography', () => {
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  const labelStyle = { fontSize: '16px', fontWeight: '400', lineHeight: '24px', color: 'rgb(35, 49, 63)' };
  const field = (tag, name, top, height) => ({ tag, type: 'text', name, label: `\u00a0${name}\u00a0`, placeholder: '\u00a0Keep boundary\u00a0', formKey: '0.1', rect: rect(100, top, 400, height), labelStyle, fieldGap: '8px', fontSize: '16px', fontWeight: '400', borderRadius: '6px', borderTopWidth: '1px', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px', minHeight: tag === 'textarea' ? '112px' : '0px', structureKey: `0.1.${top}.0` });
  const fields = [field('input', 'Name', 132, 50), field('input', 'Email', 234, 50), field('textarea', 'Message', 336, 112)];
  const form = { key: '0.1', parentKey: '0', tag: 'form', rect: rect(100, 100, 400, 416), display: 'flex', flexDirection: 'column', gap: '20px', rowGap: '20px', paddingTop: '0px', paddingLeft: '0px', paddingBottom: '0px', paddingRight: '0px' };
  const groups = [form, { key: '0.1.0', parentKey: '0.1', rect: rect(100, 132, 400, 50), gap: '8px' }];
  const submit = { tag: 'button', type: 'submit', rect: rect(100, 468, 162, 48), structureKey: '0.1.3', backgroundColor: '#123456', fontSize: '16px', fontWeight: '400' };
  const summary = summarizeReferenceForm(fields, submit, groups, [], { key: '0', rect: rect(0, 0, 800, 700) }, '0.1');
  assert.equal(summary.hostGroupKey, '0.1');
  assert.equal(summary.props.formPaddingY, '0px');
  assert.equal(summary.props.formPaddingX, '0px');
  assert.equal(summary.props.formGap, '20px');
  assert.equal(summary.props.fieldGap, '8px');
  assert.equal(summary.props.labelFontSize, '16px');
  assert.equal(summary.props.labelFontWeight, 'font-normal');
  assert.equal(summary.props.inputFontWeight, 'font-normal');
  assert.equal(summary.props.inputHeight, '50px');
  assert.equal(summary.props.inputBorderRadius, '6px');
  assert.equal(summary.props.textareaHeight, '112px');
  assert.equal(summary.props.textareaMinHeight, '112px');
  assert.equal(summary.props.buttonWidth, '162px');
  assert.equal(summary.props.buttonJustifySelf, 'start');
  assert.equal(summary.props.fields[0].label, '\u00a0Name\u00a0');
  assert.equal(summary.props.fields[0].placeholder, '\u00a0Keep boundary\u00a0');

  const originalProps = ['fields', 'formGap', 'formPaddingY', 'labelFontWeight'];
  const currentProps = [...originalProps, 'textareaHeight', 'textareaMinHeight', 'buttonWidth', 'buttonJustifySelf'];
  for (const props of [originalProps, currentProps]) {
    const contractIndex = buildContractIndex({ components: [{ name: 'FormBlock', props, aiProps: props, controls: [{ type: 'select', props: ['labelFontWeight'], options: ['font-normal', 'font-semibold'] }] }] });
    const authored = filterAllowedProps({ contractIndex, strictAuthoringContract: true }, 'FormBlock', summary.props);
    assert.equal(authored.labelFontWeight, 'font-normal');
    assert.equal(authored.buttonWidth, props.includes('buttonWidth') ? '162px' : undefined);
    assert.equal(authored.textareaHeight, props.includes('textareaHeight') ? '112px' : undefined);
  }
});

test('radio labels and option labels preserve authored boundary NBSP', () => {
  const radios = [1, 2].map((id) => ({ type: 'radio', name: 'choice', label: `\u00a0Choice ${id}\u00a0`, groupLabel: '\u00a0Group\u00a0', value: `value${id}`, rect: { left: 0, right: 20, top: id * 30, bottom: id * 30 + 20, width: 20, height: 20 } }));
  const result = groupReferenceFormFields(radios, '0.1');
  assert.equal(result[0].label, '\u00a0Group\u00a0');
  assert.equal(result[0].options[0].label, '\u00a0Choice 1\u00a0');
});

test('form authoring accepts exact length only through its live control and never rounds legacy radii', () => {
  const author = (radius, control) => {
    const contractIndex = buildContractIndex({ components: [
      { name: 'Container', props: [], aiProps: [] },
      { name: 'FormBlock', props: ['fields', 'inputBorderRadius'], aiProps: ['fields', 'inputBorderRadius'], controls: [control, { type: 'repeater', props: ['fields'], itemControls: [{ type: 'select', props: ['type'], options: ['text'] }, { type: 'text', props: ['name', 'label'] }] }] },
    ] });
    const context = { contractIndex, strictAuthoringContract: true, nodeMap: { ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, nodes: [] } }, counters: {}, warnings: [], styleProfile: { ink: '#000000' }, genericMeasuredGroupNodes: new Map(), genericMeasuredNodeKeys: new Map(), genericMeasuredSurfaceNodes: new Map(), genericMeasuredOrderEntries: new Map(), authoredFormIds: new Set(), reservedFormIds: new Set() };
    const rect = { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 };
    addGenericMeasuredGroups(context, 'ROOT', { key: '0', rect, groups: [{ key: '0.1', rect, semanticWidget: 'FormBlock', submitBox: { text: 'Send' }, props: { inputBorderRadius: radius, fields: [{ type: 'text', name: 'name', label: 'Name' }, { type: 'text', name: 'subject', label: 'Subject' }] } }] }, null, null, { preserveSourceText: true }, '#000000', 'Container', 0);
    return Object.values(context.nodeMap).find((node) => node.type.resolvedName === 'FormBlock').props.inputBorderRadius;
  };
  const legacy = { type: 'select', props: ['inputBorderRadius'], options: ['', 'rounded-sm', 'rounded', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full'] };
  const current = { type: 'text', props: ['inputBorderRadius'], allowEmpty: true, maxLength: 96, pattern: '^(?:rounded(?:-(?:sm|lg|xl|2xl|full))?|0|[0-9]+(?:\\.[0-9]+)?(?:px|rem|em))?$' };
  assert.equal(author('8px', legacy), 'rounded-lg');
  assert.throws(() => author('6px', legacy), /generic_form_radius_control_gap.*6px/u);
  assert.equal(author('6px', current), '6px');
  assert.equal(author('0.375rem', current), '0.375rem');
  assert.equal(author('0px', current), '0px');
  assert.equal(author('0', current), '0');
  assert.equal(author('rounded-xl', current), 'rounded-xl');
  assert.throws(() => author('-6px', current), /generic_form_radius_control_gap/u);
  assert.throws(() => author('var(--unpublished)', current), /generic_form_radius_control_gap/u);
});
