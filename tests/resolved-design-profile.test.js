'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const scripts = path.join(root, 'monteby-site-authoring', 'scripts');
const {
  applyResolvedDesignDefaults,
  buildResolvedDesignProfile,
  globalStyleLiteralMatch,
} = require(path.join(scripts, 'resolved-design-profile.js'));

function contract() {
  return {
    authoring: {
      blockedProps: ['className'],
      topLevelRootComponents: ['Section'],
    },
    components: [{
      name: 'Section',
      isCanvas: true,
      allowedParents: ['ROOT'],
      props: ['backgroundColor', 'innerMaxWidth', 'innerPaddingX', 'innerPaddingXTablet', 'innerPaddingXMobile'],
      aiProps: ['backgroundColor', 'innerMaxWidth', 'innerPaddingX', 'innerPaddingXTablet', 'innerPaddingXMobile'],
    }, {
      name: 'Container',
      isCanvas: true,
      allowedParents: ['Section'],
      props: [],
      aiProps: [],
    }, {
      name: 'Heading',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['text', 'tag', 'typographyPreset', 'fontFamily', 'fontSize', 'textColor', 'marginTop'],
      aiProps: ['text', 'tag', 'typographyPreset', 'fontFamily', 'fontSize', 'textColor', 'marginTop'],
    }, {
      name: 'Text',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['text', 'typographyPreset', 'textColor', 'marginTop'],
      aiProps: ['text', 'typographyPreset', 'textColor', 'marginTop'],
    }, {
      name: 'ButtonBlock',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['label', 'href', 'typographyPreset', 'backgroundColor', 'textColor', 'borderRadius'],
      aiProps: ['label', 'href', 'typographyPreset', 'backgroundColor', 'textColor', 'borderRadius'],
    }, {
      name: 'FormBlock',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['fields', 'inputBgColor', 'inputBorderRadius', 'buttonPaddingY', 'buttonBackgroundColor'],
      aiProps: ['fields', 'inputBgColor', 'inputBorderRadius', 'buttonPaddingY', 'buttonBackgroundColor'],
    }],
    globalStyles: {
      colors: {
        accent: '#112233',
        text: '#202124',
        paper: '#ffffff',
      },
      typography: {
        fonts: {
          body: { label: 'Audit Sans', value: '"Audit Sans", sans-serif' },
        },
        presets: {
          h1: { label: 'H1', fontFamily: 'var(--gcb-font-body)', fontSize: '60px' },
          h2: { label: 'H2', fontFamily: 'var(--gcb-font-body)', fontSize: '42px' },
          body: { label: 'Body', fontFamily: 'var(--gcb-font-body)', fontSize: '18px' },
          button: { label: 'Button', fontFamily: 'var(--gcb-font-body)', fontSize: '15px' },
        },
      },
      customCSS: '.must-not-enter-authored-json{color:red}',
    },
    designTokens: {
      version: 1,
      tokens: {
        'colors.accent': {
          value: '#ff0000',
          cssVariable: '--monteby-token-colors-accent',
          reference: 'var(--monteby-token-colors-accent)',
        },
        'buttons.radius': {
          value: '19px',
          cssVariable: '--monteby-token-buttons-radius',
          reference: 'var(--monteby-token-buttons-radius)',
        },
        'buttons.padding_y': {
          value: '13px',
          cssVariable: '--monteby-token-buttons-padding-y',
          reference: 'var(--monteby-token-buttons-padding-y)',
        },
        'forms.radius': {
          value: '11px',
          cssVariable: '--monteby-token-forms-radius',
          reference: 'var(--monteby-token-forms-radius)',
        },
        'forms.bg': {
          value: '#fafafa',
          cssVariable: '--monteby-token-forms-bg',
          reference: 'var(--monteby-token-forms-bg)',
        },
      },
      bindings: {
        ButtonBlock: {
          backgroundColor: 'colors.accent',
          borderRadius: 'buttons.radius',
        },
        FormBlock: {
          inputBgColor: 'forms.bg',
          inputBorderRadius: 'forms.radius',
          buttonPaddingY: 'buttons.padding_y',
          buttonBackgroundColor: 'colors.accent',
        },
      },
      layout: {
        contentWidth: '1376px',
      },
    },
  };
}

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-design-profile-'));
}

test('resolvedDesignProfile enforces precedence without consuming customCSS', () => {
  const resolved = buildResolvedDesignProfile(contract());

  assert.equal(resolved.tokens['colors.accent'].value, '#112233');
  assert.equal(resolved.tokens['colors.accent'].reference, 'var(--gcb-color-accent)');
  assert.equal(resolved.tokens['buttons.radius'].reference, 'var(--monteby-token-buttons-radius)');
  assert.equal(resolved.layout.contentWidth, '1376px');
  assert.equal(resolved.customCSSConsumed, false);
  assert.equal(JSON.stringify(resolved).includes('must-not-enter-authored-json'), false);
  assert.deepEqual(resolved.conflicts, [{
    code: 'global-design-token-conflict',
    token: 'colors.accent',
    preferredSource: 'globalStyles',
    globalStylesValue: '#112233',
    designTokensValue: '#ff0000',
  }]);

  const project = buildResolvedDesignProfile(contract(), { colors: { accent: '#abcdef' } });
  assert.equal(project.tokens['colors.accent'].source, 'projectTokens');
  assert.equal(project.tokens['colors.accent'].reference, '#abcdef');
  const unsafeProject = buildResolvedDesignProfile(contract(), {
    colors: { accent: 'url(https://example.test/tracker)' },
  });
  assert.equal(unsafeProject.tokens['colors.accent'].source, 'globalStyles');

  const projectTypography = buildResolvedDesignProfile(contract(), {
    typography: {
      presets: {
        h1: { fontFamily: 'Project Sans, sans-serif', fontSize: '66px' },
      },
    },
  });
  const projectHeading = applyResolvedDesignDefaults(
    'Heading',
    { text: 'Project', tag: 'h1' },
    projectTypography
  );
  assert.equal(projectHeading.typographyPreset, undefined);
  assert.equal(projectHeading.fontFamily, 'Project Sans, sans-serif');
  assert.equal(projectHeading.fontSize, '66px');
});

test('resolvedDesignProfile applies bindings and semantic presets only to missing props', () => {
  const resolved = buildResolvedDesignProfile(contract());
  const button = applyResolvedDesignDefaults('ButtonBlock', { label: 'Start' }, resolved);
  const localButton = applyResolvedDesignDefaults('ButtonBlock', {
    label: 'Local',
    backgroundColor: '#abcdef',
  }, resolved);
  const heading = applyResolvedDesignDefaults('Heading', { text: 'Title', tag: 'h1' }, resolved);
  const text = applyResolvedDesignDefaults('Text', { text: 'Body' }, resolved);
  const form = applyResolvedDesignDefaults('FormBlock', { fields: [] }, resolved);

  assert.equal(button.backgroundColor, 'var(--gcb-color-accent)');
  assert.equal(button.borderRadius, 'var(--monteby-token-buttons-radius)');
  assert.equal(button.typographyPreset, 'button');
  assert.equal(localButton.backgroundColor, '#abcdef');
  assert.equal(localButton.borderRadius, 'var(--monteby-token-buttons-radius)');
  assert.equal(heading.typographyPreset, 'h1');
  assert.equal(text.typographyPreset, 'body');
  assert.equal(form.inputBgColor, 'var(--monteby-token-forms-bg)');
  assert.equal(form.inputBorderRadius, 'var(--monteby-token-forms-radius)');
  assert.equal(form.buttonPaddingY, 'var(--monteby-token-buttons-padding-y)');
  assert.equal(form.buttonBackgroundColor, 'var(--gcb-color-accent)');

  const legacyContract = contract();
  delete legacyContract.designTokens;
  const legacy = buildResolvedDesignProfile(legacyContract);
  assert.equal(applyResolvedDesignDefaults('ButtonBlock', { label: 'Legacy' }, legacy).backgroundColor, undefined);
});

test('layout-kit consumes the same resolvedDesignProfile and preserves local overrides', async () => {
  const directory = temporaryDirectory();
  const contractPath = path.join(directory, 'contract.json');
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  const { Kit } = await import(path.join(scripts, 'layout-kit.mjs'));
  const kit = await Kit.fromContract(contractPath);

  const section = kit.shell({}, [
    kit.heading('Global heading', { tag: 'h1', fontSize: '72px' }),
    kit.button('Global button', '#', { textColor: '#eeeeee' }),
  ]);
  const map = kit.build([section]);
  const heading = Object.values(map).find((node) => node.type?.resolvedName === 'Heading');
  const button = Object.values(map).find((node) => node.type?.resolvedName === 'ButtonBlock');

  assert.equal(map[section].props.innerMaxWidth, '1376px');
  assert.equal(heading.props.typographyPreset, 'h1');
  assert.equal(heading.props.fontSize, '72px');
  assert.equal(button.props.backgroundColor, 'var(--gcb-color-accent)');
  assert.equal(button.props.borderRadius, 'var(--monteby-token-buttons-radius)');
  assert.equal(button.props.textColor, '#eeeeee');
  assert.ok(kit.notes.some((note) => note.includes('global-design-token-conflict')));
});

test('normalization reports literals and relinks only an explicit exact match repair', () => {
  const directory = temporaryDirectory();
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const fixedPath = path.join(directory, 'fixed.json');
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['section'] },
    section: { type: { resolvedName: 'Section' }, isCanvas: true, props: {}, parent: 'ROOT', nodes: ['exact', 'local'] },
    exact: {
      type: { resolvedName: 'ButtonBlock' },
      isCanvas: false,
      props: { label: 'Exact', href: '#', backgroundColor: '#112233' },
      parent: 'section',
      nodes: [],
    },
    local: {
      type: { resolvedName: 'ButtonBlock' },
      isCanvas: false,
      props: { label: 'Local', href: '#', backgroundColor: '#abcdef' },
      parent: 'section',
      nodes: [],
    },
  }));

  const diagnostic = spawnSync(process.execPath, [
    path.join(scripts, 'normalize-layout.js'),
    '--contract', contractPath,
    '--layout', layoutPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(diagnostic.status, 0, diagnostic.stderr || diagnostic.stdout);
  const report = JSON.parse(diagnostic.stdout);
  assert.equal(report.warnings.some((warning) => warning.code === 'global-style-literal-match'), true);
  assert.equal(JSON.parse(fs.readFileSync(layoutPath, 'utf8')).exact.props.backgroundColor, '#112233');

  const repair = spawnSync(process.execPath, [
    path.join(scripts, 'normalize-layout.js'),
    '--contract', contractPath,
    '--layout', layoutPath,
    '--fix', fixedPath,
    '--relink-global-tokens',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(repair.status, 0, repair.stderr || repair.stdout);
  const fixed = JSON.parse(fs.readFileSync(fixedPath, 'utf8'));
  assert.equal(fixed.exact.props.backgroundColor, 'var(--gcb-color-accent)');
  assert.equal(fixed.local.props.backgroundColor, '#abcdef');
  assert.equal(globalStyleLiteralMatch(
    buildResolvedDesignProfile(contract()),
    'ButtonBlock',
    'backgroundColor',
    '#abcdef'
  ), null);
});
