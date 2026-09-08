'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('audit and normalization accept only published references for the exact component prop', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-style-reference-'));
  const contract = {
    authoring: { topLevelRootComponents: ['Section'], blockedProps: [] },
    components: [
      { name: 'Section', allowedParents: ['ROOT'], props: [], aiProps: [] },
      {
        name: 'Container', allowedParents: ['Section'],
        props: ['borderRadius', 'width', 'textColor', 'fontWeight'],
        aiProps: ['borderRadius', 'width', 'textColor', 'fontWeight'],
        controls: [
          { type: 'css-value', props: ['borderRadius', 'width'], units: ['px', 'rem'] },
          { type: 'color', props: ['textColor'] },
          { type: 'select', props: ['fontWeight'], options: ['400', '700'] },
        ],
      },
    ],
    globalStyles: { colors: { accent: '#112233' }, typography: { presets: { body: { fontWeight: '400' } } } },
    designTokens: {
      tokens: {
        radius: { value: '8px', reference: 'var(--monteby-token-radius)' },
        'colors.accent': { value: '#ff0000', reference: 'var(--monteby-token-colors-accent)' },
      },
      bindings: { Container: { borderRadius: 'radius' } },
    },
  };
  try {
    const contractPath = path.join(directory, 'contract.json');
    const layoutPath = path.join(directory, 'layout.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    for (const [prop, value, accepted] of [
      ['borderRadius', 'var(--monteby-token-radius)', true],
      ['borderRadius', '8px', true],
      ['borderRadius', 'var(--monteby-token-unknown)', false],
      ['borderRadius', 'var(--private-secret)', false],
      ['width', 'var(--monteby-token-radius)', false],
      ['textColor', 'var(--monteby-token-radius)', false],
      ['textColor', 'var(--monteby-token-colors-accent)', true],
      ['textColor', 'var(--gcb-color-accent)', true],
      ['textColor', 'var(--gcb-color-unknown)', false],
      ['fontWeight', 'var(--gcb-typo-body-font-weight)', true],
      ['fontWeight', 'var(--gcb-typo-body-color)', false],
    ]) {
      fs.writeFileSync(layoutPath, JSON.stringify({
        ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, parent: null, nodes: ['section'], linkedNodes: {} },
        section: { type: { resolvedName: 'Section' }, isCanvas: true, props: {}, parent: 'ROOT', nodes: ['container'], linkedNodes: {} },
        container: { type: { resolvedName: 'Container' }, props: { [prop]: value }, parent: 'section', nodes: [], linkedNodes: {} },
      }));
      for (const script of ['audit-monteby-layout.js', 'normalize-layout.js']) {
        const result = spawnSync(process.execPath, [
          path.join(__dirname, '../monteby-site-authoring/scripts', script),
          '--contract', contractPath, '--layout', layoutPath, '--json',
        ], { encoding: 'utf8' });
        const context = `${script}: ${prop}=${value}\n${result.stdout}\n${result.stderr}`;
        if (script === 'normalize-layout.js') {
          assert.equal(result.status, 0, context);
          assert.equal(JSON.parse(result.stdout).repairs.some((repair) => repair.prop === prop && repair.dropped), !accepted, context);
        } else {
          assert.equal(result.status, accepted ? 0 : 1, context);
        }
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
