#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const auditScript = path.join(root, 'monteby-site-authoring', 'scripts', 'audit-monteby-layout.js');

test('audit rejects scalar values outside contract control options', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-options-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: [],
      },
      {
        name: 'ButtonBlock',
        allowedParents: ['Section'],
        props: ['fontWeight', 'animation'],
        controls: [
          {
            type: 'select',
            props: ['fontWeight'],
            options: ['400', '700'],
          },
          {
            type: 'select',
            props: ['animation'],
            options: [
              { label: 'None', value: '' },
              { label: 'Fade', value: 'fade' },
            ],
          },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', ['button']),
    button: {
      ...node('ButtonBlock', 'section', []),
      props: {
        fontWeight: '750',
        animation: 'none',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), ['invalid_prop_value', 'invalid_prop_value']);
  assert.match(report.errors[0].message, /fontWeight/);
  assert.match(report.errors[1].message, /animation/);
});

test('audit accepts scalar values listed in contract control options', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-options-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: [],
      },
      {
        name: 'ButtonBlock',
        allowedParents: ['Section'],
        props: ['fontWeight', 'animation'],
        controls: [
          {
            type: 'select',
            props: ['fontWeight'],
            options: [400, 700],
          },
          {
            type: 'select',
            props: ['animation'],
            options: [
              { label: 'None', value: '' },
              { label: 'Fade', value: 'fade' },
            ],
          },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', ['button']),
    button: {
      ...node('ButtonBlock', 'section', []),
      props: {
        fontWeight: '700',
        animation: '',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test('audit rejects values that do not match control types and ranges', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-types-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: ['gradientAngle', 'columns', 'opacity', 'featured', 'items'],
        controls: [
          { type: 'number', props: ['gradientAngle'], min: 0, max: 360, step: 1 },
          { type: 'number', props: ['columns'], min: 1, max: 6, step: 1 },
          { type: 'number', props: ['opacity'], min: 0, max: 1, step: 0.1 },
          { type: 'toggle', props: ['featured'] },
          { type: 'repeater', props: ['items'] },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', []),
      props: {
        gradientAngle: '145deg',
        columns: 8,
        opacity: 0.35,
        featured: 'true',
        items: {},
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), [
    'invalid_prop_type',
    'invalid_prop_range',
    'invalid_prop_step',
    'invalid_prop_type',
    'invalid_prop_type',
  ]);
  assert.match(report.errors[0].message, /gradientAngle/);
  assert.match(report.errors[1].message, /columns/);
  assert.match(report.errors[2].message, /opacity/);
  assert.match(report.errors[3].message, /featured/);
  assert.match(report.errors[4].message, /items/);
});

test('audit accepts values that match control types and ranges', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-types-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: ['gradientAngle', 'columns', 'opacity', 'legacyOpacity', 'featured', 'items'],
        defaults: {
          legacyOpacity: 0.35,
        },
        controls: [
          { type: 'number', props: ['gradientAngle'], min: 0, max: 360, step: 1 },
          { type: 'number', props: ['columns'], min: 1, max: 6, step: 1 },
          { type: 'number', props: ['opacity', 'legacyOpacity'], min: 0, max: 1, step: 0.1 },
          { type: 'toggle', props: ['featured'] },
          { type: 'repeater', props: ['items'] },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', []),
      props: {
        gradientAngle: 145,
        columns: 3,
        opacity: 0.3,
        legacyOpacity: 0.35,
        featured: true,
        items: [{ label: 'Valid' }],
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test('audit rejects css-value values outside declared ranges and steps', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-css-value-constraints-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Heading',
        allowedParents: ['ROOT'],
        props: ['lineHeightTablet', 'lineHeightMobile', 'minimumLineHeight', 'maximumLineHeight'],
        defaults: {
          maximumLineHeight: '100.1px',
        },
        controls: [
          {
            type: 'css-value',
            props: ['lineHeightTablet', 'lineHeightMobile', 'minimumLineHeight', 'maximumLineHeight'],
            units: ['', 'px', 'em', 'rem'],
            min: 0.1,
            max: 100,
            step: 0.1,
          },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['heading']),
    heading: {
      ...node('Heading', 'ROOT', []),
      props: {
        lineHeightTablet: '60.048px',
        lineHeightMobile: '33.36px',
        minimumLineHeight: '0px',
        maximumLineHeight: '100.1px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), [
    'invalid_prop_step',
    'invalid_prop_step',
    'invalid_prop_range',
    'invalid_prop_range',
  ]);
  assert.match(report.errors[0].message, /lineHeightTablet/);
  assert.match(report.errors[1].message, /lineHeightMobile/);
  assert.match(report.errors[2].message, /minimumLineHeight/);
  assert.match(report.errors[3].message, /maximumLineHeight/);
});

test('audit accepts aligned css-value pixels, unitless values, and declared defaults', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-css-value-constraints-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Heading',
        allowedParents: ['ROOT'],
        props: ['lineHeight', 'lineHeightTablet', 'lineHeightMobile', 'legacyLineHeight'],
        defaults: {
          legacyLineHeight: '1.25',
        },
        controls: [
          {
            type: 'css-value',
            props: ['lineHeight', 'lineHeightTablet', 'lineHeightMobile', 'legacyLineHeight'],
            units: ['', 'px', 'em', 'rem'],
            min: 0.1,
            max: 100,
            step: 0.1,
          },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['heading']),
    heading: {
      ...node('Heading', 'ROOT', []),
      props: {
        lineHeight: '1.2',
        lineHeightTablet: '60px',
        lineHeightMobile: '33.4px',
        legacyLineHeight: '1.25',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test('audit rejects malformed css-value strings before renderer sanitization', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-css-value-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Heading',
        allowedParents: ['ROOT'],
        props: ['lineHeight', 'paddingTop'],
        controls: [
          { type: 'css-value', props: ['lineHeight'], units: ['', 'px', 'em', 'rem'] },
          { type: 'css-value', props: ['paddingTop'], units: ['px', 'rem', '%'] },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['heading']),
    heading: {
      ...node('Heading', 'ROOT', []),
      props: {
        lineHeight: '.94',
        paddingTop: '16pt',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), ['invalid_prop_value', 'invalid_prop_value']);
  assert.match(report.errors[0].message, /lineHeight/);
  assert.match(report.errors[0].message, /leading zero/);
  assert.match(report.errors[1].message, /paddingTop/);
});

test('audit accepts finite css-value numbers and leading-zero decimals', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-css-value-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Heading',
        allowedParents: ['ROOT'],
        props: ['lineHeight', 'paddingTop', 'marginBottom'],
        controls: [
          { type: 'css-value', props: ['lineHeight'], units: ['', 'px', 'em', 'rem'] },
          { type: 'css-value', props: ['paddingTop', 'marginBottom'], units: ['px', 'rem', '%'] },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['heading']),
    heading: {
      ...node('Heading', 'ROOT', []),
      props: {
        lineHeight: '0.94',
        paddingTop: 24,
        marginBottom: '12px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test('audit blocks runtime-only background video authoring', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-blocked-bg-video-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Container',
        allowedParents: ['ROOT'],
        props: ['backgroundType', 'backgroundVideo'],
        controls: [
          {
            type: 'select',
            props: ['backgroundType'],
            options: [
              { label: 'None', value: '' },
              { label: 'Video', value: 'video' },
            ],
          },
          { type: 'text', props: ['backgroundVideo'] },
        ],
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['container']),
    container: {
      ...node('Container', 'ROOT', []),
      props: {
        backgroundType: 'video',
        backgroundVideo: 'https://cdn.example.test/bg.mp4',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), ['blocked_prop']);
  assert.match(report.errors[0].message, /backgroundVideo/);
});

test('audit rejects props advertised only through broad props and defaults metadata', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-props-array-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: ['tag', 'backgroundType', 'background'],
        defaults: {
          tag: 'section',
          backgroundType: 'color',
          background: '#ffffff',
        },
      },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', []),
      props: {
        tag: 'header',
        backgroundType: 'color',
        background: '#f4fbf8',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), ['unknown_prop', 'unknown_prop', 'unknown_prop']);
});

test('audit preserves child-theme widgets with aiProps and typed schema controls', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-child-theme-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: [],
      },
      {
        name: 'ThemeClientHero',
        category: 'custom',
        origin: 'runtime',
        allowedParents: ['Section', 'Container'],
        props: ['title', 'cards', 'runtimeOnlyDefault'],
        defaults: { title: 'Broad default', runtimeOnlyDefault: true },
        aiProps: ['title', 'cards'],
        schema: {
          sections: [
            {
              title: 'Content',
              fields: [
                { type: 'text', prop: 'title' },
                {
                  type: 'repeater',
                  prop: 'cards',
                  itemControls: [
                    { type: 'text', prop: 'label' },
                    { type: 'media', prop: 'image' },
                    { type: 'spacing', spacingProps: { top: 'paddingTop' } },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', ['hero']),
    hero: {
      ...node('ThemeClientHero', 'section', []),
      props: {
        title: 'Replacement heading',
        cards: [{ label: 'First', image: 'https://replacement.example.test/card.jpg', paddingTop: '8px' }],
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test('audit validates repeater item keys from live itemControls before accepting new FormBlock fields', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-repeater-contract-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const formControl = {
    type: 'repeater',
    props: ['fields'],
    itemControls: [
      { type: 'select', props: ['type'], options: ['text', 'checkbox'] },
      { type: 'text', props: ['label'] },
    ],
  };
  const contractValue = {
    components: [
      { name: 'Section', allowedParents: ['ROOT'], aiProps: [] },
      {
        name: 'FormBlock',
        allowedParents: ['Section'],
        aiProps: ['fields'],
        controls: [formControl],
      },
    ],
  };
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', ['form']),
    form: {
      ...node('FormBlock', 'section', []),
      props: {
        fields: [{
          type: 'checkbox',
          label: 'Consent',
          columnSpan: 2,
          linkText: 'Privacy policy',
          linkUrl: '/privacy',
        }],
      },
    },
  }));

  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  const beforeRefresh = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(beforeRefresh.status, 1);
  assert.deepEqual(JSON.parse(beforeRefresh.stdout).errors.map((error) => error.code), [
    'unknown_repeater_item_prop',
    'unknown_repeater_item_prop',
    'unknown_repeater_item_prop',
  ]);

  formControl.itemControls.push(
    { type: 'number', props: ['columnSpan'], options: [1, 2] },
    { type: 'text', props: ['linkText'] },
    { type: 'link', props: ['linkUrl'] },
  );
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  const afterRefresh = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(afterRefresh.status, 0, afterRefresh.stderr || afterRefresh.stdout);
  assert.deepEqual(JSON.parse(afterRefresh.stdout).errors, []);
});

test('audit preserves child-theme itemFields maps while rejecting invented repeater keys', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-child-repeater-fields-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      { name: 'Section', allowedParents: ['ROOT'], aiProps: [] },
      {
        name: 'ThemeFeatureList',
        allowedParents: ['Section'],
        aiProps: ['items'],
        schema: {
          fields: [{
            type: 'repeater',
            prop: 'items',
            itemFields: {
              label: { type: 'text' },
              image: { type: 'media' },
            },
          }],
        },
      },
    ],
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', ['features']),
    features: {
      ...node('ThemeFeatureList', 'section', []),
      props: {
        items: [{
          label: 'Measured feature',
          image: 'https://replacement.example.test/feature.jpg',
          inventedTone: 'loud',
        }],
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.errors.map((error) => error.code), ['unknown_repeater_item_prop']);
  assert.match(report.errors[0].message, /inventedTone/);
});

test('audit rejects top-level and nested advanced/runtime props even when contract metadata advertises them', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-nested-boundary-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const blockedNestedProps = {
    className: 'unsafe-class',
    cssId: 'unsafe-id',
    customAttributes: { 'data-unsafe': '1' },
    customCss: 'selector { color: red; }',
    position: 'absolute',
    rotate: 15,
    hideMobile: true,
    visibility: 'hidden',
    hoverBg: '#000000',
    activeScale: 0.9,
    onClick: 'alert(1)',
    rawHtml: '<script>alert(1)</script>',
  };

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      { name: 'Section', allowedParents: ['ROOT'], aiProps: [] },
      {
        name: 'FormBlock',
        allowedParents: ['Section'],
        props: ['fields', 'className', 'backgroundVideo', ...Object.keys(blockedNestedProps)],
        defaults: blockedNestedProps,
        aiProps: ['fields', 'className', 'backgroundVideo'],
        controls: [
          { type: 'repeater', props: ['fields'] },
          { type: 'text', props: ['className', 'backgroundVideo'] },
        ],
      },
    ],
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', ['form']),
    form: {
      ...node('FormBlock', 'section', []),
      props: {
        fields: [{ label: 'Name', ...blockedNestedProps }],
        className: 'unsafe-root-class',
        backgroundVideo: 'https://replacement.example.test/runtime.mp4',
      },
    },
  }));

  const result = spawnSync(process.execPath, [auditScript, '--layout', layoutPath, '--contract', contractPath, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.errors.every((error) => ['blocked_prop', 'blocked_nested_prop'].includes(error.code)));
  assert.equal(report.errors.filter((error) => error.code === 'blocked_prop').length, 2);
  for (const prop of Object.keys(blockedNestedProps)) {
    assert.ok(report.errors.some((error) => error.code === 'blocked_nested_prop' && error.message.includes(`"${prop}"`)), prop);
  }
});

test('audit rejects photo-led reference layouts without replacement media surfaces', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-missing-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundType', 'background'],
      },
      {
        name: 'Heading',
        allowedParents: ['Section'],
        aiProps: ['text'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    mediaCount: 5,
    imageSources: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
      'https://cdn.example.test/card-one.webp',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.png',
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', ['heading']),
      props: {
        backgroundType: 'color',
        background: '#101318',
      },
    },
    heading: {
      ...node('Heading', 'section', []),
      props: {
        text: 'Premium detailing',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.referenceMediaEvidence, 5);
  assert.equal(report.stats.requiredMediaSurfaces, 3);
  assert.equal(report.stats.mediaSurfaces, 0);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_reference_media']);
});

test('audit counts distinct meaningful media surfaces instead of duplicate raw media and logos', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-distinct-media-evidence-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const heroSource = 'https://reference.example.test/hero.jpg';
  const portraitSource = 'https://reference.example.test/portrait.jpg';

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: [],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    media: [heroSource, portraitSource, 'https://reference.example.test/logo.png'],
    mediaSurfaces: [
      { role: 'hero', source: heroSource },
      { role: 'secondary', source: portraitSource },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: node('Section', 'ROOT', []),
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--min-media-surfaces',
    '2',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.stats.referenceMediaEvidence, 2);
  assert.equal(report.stats.requiredMediaSurfaces, 2);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_reference_media']);
});

test('audit accepts photo-led reference layouts with enough replacement media surfaces', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-present-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundType', 'backgroundImage'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'ImageBlock',
        allowedParents: ['Container'],
        aiProps: ['src'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    imageSources: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
      'https://cdn.example.test/card-one.webp',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.png',
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', ['container']),
      props: {
        backgroundType: 'image',
        backgroundImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      },
    },
    container: {
      ...node('Container', 'section', ['image']),
      props: {
        backgroundImage: "url('https://cdn.example.test/secondary.webp')",
      },
    },
    image: {
      ...node('ImageBlock', 'container', []),
      props: {
        src: 'https://cdn.example.test/card.jpg',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.referenceMediaEvidence, 5);
  assert.equal(report.stats.requiredMediaSurfaces, 3);
  assert.equal(report.stats.mediaSurfaces, 3);
  assert.deepEqual(report.errors, []);
});

test('audit rejects photo-led layouts that have media but no first-viewport hero image role', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-no-hero-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundType', 'background'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['avatar', 'thumbnail', 'backgroundImage', 'width', 'minHeight'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    imageSources: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
      'https://cdn.example.test/card-one.webp',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.png',
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'gallery']),
    nav: node('Section', 'ROOT', ['navAvatar']),
    navAvatar: {
      ...node('Container', 'nav', []),
      props: {
        avatar: 'https://replacement.example.test/avatar-one.jpg',
        width: '48px',
        minHeight: '48px',
      },
    },
    hero: node('Section', 'ROOT', ['heroThumb']),
    heroThumb: {
      ...node('Container', 'hero', []),
      props: {
        thumbnail: 'https://replacement.example.test/avatar-two.jpg',
        width: '64px',
        minHeight: '64px',
      },
    },
    gallery: node('Section', 'ROOT', ['latePhoto']),
    latePhoto: {
      ...node('Container', 'gallery', []),
      props: {
        backgroundImage: 'https://replacement.example.test/late-photo.jpg',
        minHeight: '520px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.mediaSurfaces, 3);
  assert.equal(report.stats.heroMediaSurfaces, 0);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_hero_media_role']);
});

test('audit rejects photo-led layouts with undersized first-viewport hero media', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-small-hero-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: [],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage', 'width', 'minHeight'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    imageSources: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
      'https://cdn.example.test/card-one.webp',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.png',
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'service-card', minSurfaces: 1, placement: 'afterHero' },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: node('Section', 'ROOT', ['heroPhoto', 'secondaryPhoto']),
    heroPhoto: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
        width: '420px',
        minHeight: '280px',
      },
    },
    secondaryPhoto: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/secondary.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['servicePhoto']),
    servicePhoto: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/service.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.heroMediaSurfaces, 1);
  assert.equal(report.stats.heroScaleMediaSurfaces, 0);
  assert.equal(report.stats.largestHeroMediaHeight, 280);
  assert.deepEqual(report.errors.map((error) => error.code), ['undersized_hero_media_surface']);
});

test('audit rejects photo-led layouts with too little estimated first-viewport media coverage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-coverage-low-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const referenceLayoutPath = path.join(directory, 'target-layout.json');

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify({
    viewport: { width: 1440, height: 900 },
    summary: {
      firstViewportMediaCoverage: 0.48,
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    ...mediaRoleManifest(),
    layout: 'target-layout.json',
    layouts: [
      { label: 'desktop', width: 1440, height: 900, file: 'target-layout.json', status: 'ok' },
    ],
    layoutCapture: { status: 'ok', file: 'target-layout.json', error: '' },
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: node('Section', 'ROOT', ['heroPhoto', 'detail']),
    heroPhoto: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
        width: '640px',
        minHeight: '260px',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        width: '180px',
        minHeight: '120px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.referenceFirstViewportMediaCoverage, 0.48);
  assert.equal(report.stats.minimumFirstViewportMediaCoverage, 0.24);
  assert.ok(report.stats.estimatedFirstViewportMediaCoverage < 0.24);
  assert.deepEqual(report.errors.map((error) => error.code), ['low_first_viewport_media_coverage']);
});

test('audit accepts photo-led layouts with enough estimated first-viewport media coverage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-coverage-ok-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const referenceLayoutPath = path.join(directory, 'target-layout.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage', 'minHeight'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage', 'minHeight', 'width'],
      },
    ],
  }));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify({
    viewport: { width: 1440, height: 900 },
    summary: {
      firstViewportMediaCoverage: 0.48,
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    ...mediaRoleManifest(),
    layout: 'target-layout.json',
    layouts: [
      { label: 'desktop', width: 1440, height: 900, file: 'target-layout.json', status: 'ok' },
    ],
    layoutCapture: { status: 'ok', file: 'target-layout.json', error: '' },
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
        minHeight: '520px',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.referenceFirstViewportMediaCoverage, 0.48);
  assert.equal(report.stats.minimumFirstViewportMediaCoverage, 0.24);
  assert.ok(report.stats.estimatedFirstViewportMediaCoverage >= 0.24);
  assert.deepEqual(report.errors, []);
});

test('audit rejects generated marketplace layouts that miss required secondary media roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-roles-missing-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify(mediaRoleManifest()));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', []),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.requiredMediaRoles, 3);
  assert.equal(report.stats.satisfiedMediaRoles, 2);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_reference_media', 'missing_media_role']);
  assert.match(report.errors[1].message, /"secondary"/);
});

test('audit rejects marketplace layouts with undersized secondary first-viewport media', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-secondary-small-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify(mediaRoleManifest()));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        width: '160px',
        minHeight: '110px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.secondaryMediaSurfaces, 1);
  assert.equal(report.stats.secondaryScaleMediaSurfaces, 0);
  assert.deepEqual(report.errors.map((error) => error.code), ['undersized_secondary_media_surface']);
});

test('audit accepts generated marketplace layouts that satisfy required media roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-roles-present-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify(mediaRoleManifest()));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.requiredMediaRoles, 3);
  assert.equal(report.stats.satisfiedMediaRoles, 3);
  assert.deepEqual(report.errors, []);
});

test('audit rejects marketplace layouts with undersized service-card media', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-service-card-small-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify(mediaRoleManifest()));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '110px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '110px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.serviceCardMediaSurfaces, 2);
  assert.equal(report.stats.serviceCardScaleMediaSurfaces, 0);
  assert.deepEqual(report.errors.map((error) => error.code), ['undersized_service_card_media_surface']);
});

test('audit rejects section backgrounds as service-card media replacements', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-service-card-section-bg-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify(mediaRoleManifest()));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'servicesOne', 'servicesTwo']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    servicesOne: {
      ...node('Section', 'ROOT', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
      },
    },
    servicesTwo: {
      ...node('Section', 'ROOT', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.serviceCardMediaSurfaces, 0);
  assert.equal(report.stats.satisfiedMediaRoles, 2);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_media_role']);
  assert.match(report.errors[0].message, /"service-card"/);
});

test('audit treats manifest mediaSurfaces as reference media evidence', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-media-surfaces-evidence-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const baseManifest = mediaRoleManifest();

  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify({
    requiredMediaRoles: baseManifest.requiredMediaRoles,
    mediaSurfaces: baseManifest.imageSources.map((source, index) => ({
      source,
      role: index === 0 ? 'hero' : index === 1 ? 'secondary' : 'service-card',
      placement: index < 2 ? 'firstViewport' : 'afterHero',
    })),
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.referenceMediaEvidence, 5);
  assert.equal(report.stats.requiredMediaSurfaces, 4);
  assert.equal(report.stats.satisfiedMediaRoles, 3);
  assert.deepEqual(report.errors, []);
});

test('audit uses explicit role counts over generic pressure and accepts bounded extensionless HTTPS surfaces', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-extensionless-surfaces-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  fs.writeFileSync(contractPath, JSON.stringify(mediaRoleContract()));
  fs.writeFileSync(manifestPath, JSON.stringify({
    mediaSurfaces: [
      { role: 'hero', source: 'https://cdn.example.test/media/hero/primary', width: 1440, height: 900, top: 0 },
      { role: 'secondary', source: 'https://cdn.example.test/media/portrait/support', width: 320, height: 420, top: 260 },
      { role: 'service-card', source: 'https://cdn.example.test/media/card/reused', width: 360, height: 240, left: 0, top: 1000 },
      { role: 'service-card', source: 'https://cdn.example.test/media/card/reused', width: 360, height: 240, left: 380, top: 1000 },
      { role: 'service-card', source: 'https://cdn.example.test/media/card/reused', width: 360, height: 240, left: 760, top: 1000 },
      { role: 'logo', source: 'https://cdn.example.test/media/brand/mark', width: 180, height: 64, top: 20 },
      { role: 'decorative', source: 'https://cdn.example.test/media/texture/noise', width: 1440, height: 900, top: 0 },
      { role: 'hero', source: 'http://cdn.example.test/media/insecure', width: 1440, height: 900, top: 0 },
      { role: 'secondary', source: 'javascript:alert(1)', width: 320, height: 420, top: 200 },
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
    ],
  }));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['hero']),
    hero: {
      ...node('Section', 'ROOT', ['portrait']),
      props: {
        backgroundImage: 'https://replacement.example.test/media/hero/current',
      },
    },
    portrait: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/media/portrait/current',
        width: '320px',
        minHeight: '420px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.stats.referenceMediaEvidence, 5);
  assert.equal(report.stats.requiredMediaSurfaces, 2);
  assert.equal(report.stats.mediaSurfaces, 2);
  assert.equal(report.stats.satisfiedMediaRoles, 2);
  assert.equal(report.stats.mediaRoleProof, 'json-structure-only; rendered-media parity required');
  assert.deepEqual(report.errors, []);
});

test('audit rejects synthetic manifests when a real template reference is required', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-real-reference-missing-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    seed: 'synthetic-fallback',
    variant: 'marketplace-service',
    imageSources: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70'],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', []),
      props: {
        backgroundImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((error) => error.code), [
    'missing_reference_source_url',
    'missing_reference_screenshots',
  ]);
});

test('audit accepts captured real template manifests when required', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-real-reference-present-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'ImageBlock',
        allowedParents: ['Container'],
        aiProps: ['src'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'https://templates.example.test/home',
    media: [
      'https://cdn.example.test/hero.jpg',
      'https://cdn.example.test/card.jpg',
      'https://cdn.example.test/detail.jpg',
      'https://cdn.example.test/team.jpg',
      'https://cdn.example.test/gallery.jpg',
    ],
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, mode: 'viewport', file: 'reference-desktop.png' },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', ['container']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    container: {
      ...node('Container', 'section', ['image']),
      props: {
        backgroundImage: 'https://replacement.example.test/card.jpg',
      },
    },
    image: {
      ...node('ImageBlock', 'container', []),
      props: {
        src: 'https://replacement.example.test/detail.jpg',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.referenceSourceUrl, 'https://templates.example.test/home');
  assert.equal(report.stats.referenceScreenshots, 1);
  assert.equal(report.stats.reusedReferenceMedia, 0);
  assert.deepEqual(report.errors, []);
});

test('audit rejects marketplace references without service-card photo roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-marketplace-media-missing-role-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage', 'avatar', 'minHeight'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'https://templates.example.test/home',
    media: [
      'https://cdn.example.test/hero.jpg',
      'https://cdn.example.test/detail.jpg',
      'https://cdn.example.test/card-one.jpg',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.jpg',
    ],
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, mode: 'viewport', file: 'reference-desktop.png' },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['avatarOne', 'avatarTwo', 'avatarThree']),
    avatarOne: {
      ...node('Container', 'services', []),
      props: {
        avatar: 'https://replacement.example.test/avatar-one.jpg',
        minHeight: '180px',
      },
    },
    avatarTwo: {
      ...node('Container', 'services', []),
      props: {
        avatar: 'https://replacement.example.test/avatar-two.jpg',
        minHeight: '180px',
      },
    },
    avatarThree: {
      ...node('Container', 'services', []),
      props: {
        avatar: 'https://replacement.example.test/avatar-three.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.requiredMediaSurfaces, 5);
  assert.equal(report.stats.requiredMediaRoles, 3);
  assert.equal(report.stats.satisfiedMediaRoles, 2);
  assert.deepEqual(report.errors.map((error) => error.code), ['missing_media_role']);
  assert.match(report.errors[0].message, /"service-card"/);
});

test('audit accepts captured marketplace references with replacement photo roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-marketplace-media-present-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage', 'minHeight', 'width'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'https://templates.example.test/home',
    media: [
      'https://cdn.example.test/hero.jpg',
      'https://cdn.example.test/detail.jpg',
      'https://cdn.example.test/card-one.jpg',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.jpg',
    ],
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, mode: 'viewport', file: 'reference-desktop.png' },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['nav', 'hero', 'services']),
    nav: node('Section', 'ROOT', []),
    hero: {
      ...node('Section', 'ROOT', ['detail']),
      props: {
        backgroundImage: 'https://replacement.example.test/hero.jpg',
      },
    },
    detail: {
      ...node('Container', 'hero', []),
      props: {
        backgroundImage: 'https://replacement.example.test/detail.jpg',
        minHeight: '180px',
      },
    },
    services: node('Section', 'ROOT', ['cardOne', 'cardTwo', 'cardThree']),
    cardOne: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-one.jpg',
        minHeight: '180px',
      },
    },
    cardTwo: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-two.jpg',
        minHeight: '180px',
      },
    },
    cardThree: {
      ...node('Container', 'services', []),
      props: {
        backgroundImage: 'https://replacement.example.test/card-three.jpg',
        minHeight: '180px',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.stats.requiredMediaSurfaces, 5);
  assert.equal(report.stats.requiredMediaRoles, 3);
  assert.equal(report.stats.satisfiedMediaRoles, 3);
  assert.deepEqual(report.errors, []);
});

test('audit rejects captured template media URLs as authored layout assets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-audit-real-reference-reuse-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify({
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'ImageBlock',
        allowedParents: ['Container'],
        aiProps: ['src'],
      },
    ],
  }));

  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'https://templates.example.test/home',
    media: [
      'https://cdn.example.test/hero.jpg',
      'https://cdn.example.test/card.jpg',
      'https://cdn.example.test/detail.jpg',
      'https://cdn.example.test/team.jpg',
      'https://cdn.example.test/gallery.jpg',
    ],
    screenshots: [
      { label: 'desktop', width: 1440, height: 1200, mode: 'viewport', file: 'reference-desktop.png' },
    ],
  }));

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: node('RootCanvas', null, ['section']),
    section: {
      ...node('Section', 'ROOT', ['container']),
      props: {
        backgroundImage: 'https://cdn.example.test/hero.jpg',
      },
    },
    container: {
      ...node('Container', 'section', ['image']),
      props: {
        backgroundImage: "url('https://cdn.example.test/card.jpg')",
      },
    },
    image: {
      ...node('ImageBlock', 'container', []),
      props: {
        src: 'https://replacement.example.test/detail.jpg',
      },
    },
  }));

  const result = spawnSync(process.execPath, [
    auditScript,
    '--layout',
    layoutPath,
    '--contract',
    contractPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.stats.reusedReferenceMedia, 2);
  assert.deepEqual(report.errors.map((error) => error.code), ['reused_reference_media']);
});

function node(type, parent, nodes) {
  return {
    type: { resolvedName: type },
    isCanvas: nodes.length > 0,
    props: {},
    parent,
    nodes,
    linkedNodes: {},
  };
}

function mediaRoleContract() {
  return {
    components: [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        aiProps: ['backgroundImage'],
      },
      {
        name: 'Container',
        allowedParents: ['Section'],
        aiProps: ['backgroundImage', 'minHeight', 'width'],
      },
    ],
  };
}

function mediaRoleManifest() {
  return {
    imageSources: [
      'https://cdn.example.test/hero.jpg',
      'https://cdn.example.test/detail.jpg',
      'https://cdn.example.test/card-one.jpg',
      'https://cdn.example.test/card-two.jpg',
      'https://cdn.example.test/card-three.jpg',
    ],
    requiredMediaRoles: [
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
        minSurfaces: 2,
        placement: 'afterHero',
        description: 'Photo surfaces inside service/package/content cards below the hero.',
      },
    ],
  };
}
