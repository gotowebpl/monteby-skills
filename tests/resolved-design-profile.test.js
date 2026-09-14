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
    kit.button('Global button', '/contact/', { textColor: '#eeeeee' }),
  ]);
  const map = kit.build([section]);
  const heading = Object.values(map).find((node) => node.type?.resolvedName === 'Heading');
  const button = Object.values(map).find((node) => node.type?.resolvedName === 'ButtonBlock');

  assert.equal(map[section].props.innerMaxWidth, '1376px');
  assert.equal(map[section].props.innerPaddingXTablet, '24px');
  assert.equal(map[section].props.innerPaddingXMobile, '16px');
  assert.equal(heading.props.typographyPreset, 'h1');
  assert.equal(heading.props.fontSize, '72px');
  assert.equal(button.props.backgroundColor, 'var(--gcb-color-accent)');
  assert.equal(button.props.borderRadius, 'var(--monteby-token-buttons-radius)');
  assert.equal(button.props.textColor, '#eeeeee');
  assert.ok(kit.notes.some((note) => note.includes('global-design-token-conflict')));

  const explicitKit = await Kit.fromContract(contractPath);
  const explicit = explicitKit.shell({
    innerPaddingX: '0px',
    innerPaddingXTablet: '0px',
    innerPaddingXMobile: '0px',
  }, []);
  const explicitMap = explicitKit.build([explicit]);
  assert.equal(explicitMap[explicit].props.innerPaddingX, '0px');
  assert.equal(explicitMap[explicit].props.innerPaddingXTablet, '0px');
  assert.equal(explicitMap[explicit].props.innerPaddingXMobile, '0px');
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

test('heading roles and responsive project typography preserve the declared hierarchy', async () => {
  const current = contract();
  current.components.find((entry) => entry.name === 'Heading').props.push('fontSizeTablet', 'fontSizeMobile', 'lineHeight');
  current.globalStyles.typography.presets.h3 = { fontSize: '26px', lineHeight: '1.2' };
  const profile = buildResolvedDesignProfile(current);
  assert.equal(applyResolvedDesignDefaults('Heading', { tag: 'h3' }, profile).typographyPreset, 'h3');
  const project = buildResolvedDesignProfile(current, { typography: { presets: {
    h3: { fontSize: '28px', fontSizeTablet: '26px', fontSizeMobile: '24px', lineHeight: '1.2' },
  } } });
  const props = applyResolvedDesignDefaults('Heading', { tag: 'h3' }, project);
  assert.equal(props.fontSizeTablet, '26px');
  assert.equal(props.fontSizeMobile, '24px');
  const { Kit } = await import(path.join(scripts, 'layout-kit.mjs'));
  const kit = new Kit(current);
  const id = kit.heading('Card heading', { tag: 'h3' });
  assert.equal(kit.nodes[id].props.typographyPreset, 'h3');
  assert.equal(kit.notes.some((note) => note.includes('lineHeight')), false);
});

test('numeric control normalization reports any snapped or clamped author value', async () => {
  const current = contract();
  const button = current.components.find((entry) => entry.name === 'ButtonBlock');
  button.props.push('testNumber');
  button.controls = [{ type: 'number', props: ['testNumber'], step: 2, min: 0, max: 10 }];
  const { Kit } = await import(path.join(scripts, 'layout-kit.mjs'));
  const kit = new Kit(current);
  const id = kit.node('ButtonBlock', { testNumber: 13 });
  assert.equal(kit.nodes[id].props.testNumber, 10);
  assert.ok(kit.notes.some((note) => note.includes('13 → 10')));
});

test('absent h3 preset receives bounded neutral typography without replacing live or project choices', () => {
  const current = contract();
  current.components.find((entry) => entry.name === 'Heading').props.push('fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'fontWeight');
  current.globalStyles.typography.presets.h2.fontWeight = '600';
  const fallback = applyResolvedDesignDefaults('Heading', { tag: 'h3' }, buildResolvedDesignProfile(current));
  assert.equal(fallback.typographyPreset, undefined);
  assert.equal(fallback.fontSize, '28px');
  assert.equal(fallback.fontSizeTablet, '26px');
  assert.equal(fallback.fontSizeMobile, '24px');
  assert.equal(fallback.lineHeight, '1.3');
  assert.equal(fallback.fontFamily, 'var(--gcb-font-body)');
  assert.equal(fallback.fontWeight, '600');
  const explicit = applyResolvedDesignDefaults('Heading', { tag: 'h3', fontSize: '32px' }, buildResolvedDesignProfile(current));
  assert.equal(explicit.fontSize, '32px');
  assert.equal(explicit.fontSizeTablet, undefined);
  assert.equal(explicit.fontSizeMobile, undefined);
  const responsive = applyResolvedDesignDefaults('Heading', { tag: 'h3', fontSize: '32px', fontSizeMobile: '29px' }, buildResolvedDesignProfile(current));
  assert.equal(responsive.fontSizeTablet, undefined);
  assert.equal(responsive.fontSizeMobile, '29px');
  current.globalStyles.typography.presets.h3 = { fontSize: '30px', lineHeight: '1.4' };
  const live = applyResolvedDesignDefaults('Heading', { tag: 'h3' }, buildResolvedDesignProfile(current));
  assert.equal(live.typographyPreset, 'h3');
  assert.equal(live.fontSize, undefined);
  assert.equal(live.lineHeight, undefined);
  const project = buildResolvedDesignProfile(current, { typography: { presets: { h3: { fontSize: '31px', lineHeight: '1.35' } } } });
  const authored = applyResolvedDesignDefaults('Heading', { tag: 'h3' }, project);
  assert.equal(authored.fontSize, '31px');
  assert.equal(authored.lineHeight, '1.35');
});

test('normalizer and kit share effective line height and preserve genuinely missing preset warnings', async () => {
  const current = contract();
  current.globalStyles.typography.presets.h1.lineHeight = '1.1';
  const { Kit } = await import(path.join(scripts, 'layout-kit.mjs'));
  const kit = new Kit(current);
  const known = kit.heading('Known preset', { tag: 'h1' });
  const unknown = kit.heading('Missing preset', { tag: 'h2', typographyPreset: 'unavailable' });
  const section = kit.section({}, [known, unknown]);
  const layout = kit.build([section]);
  assert.equal(kit.notes.filter((note) => note.includes('lineHeight')).length, 1);
  const directory = temporaryDirectory();
  try {
    const contractPath = path.join(directory, 'contract.json');
    const layoutPath = path.join(directory, 'layout.json');
    fs.writeFileSync(contractPath, JSON.stringify(current));
    fs.writeFileSync(layoutPath, JSON.stringify(layout));
    const before = fs.readFileSync(layoutPath, 'utf8');
    const result = spawnSync(process.execPath, [path.join(scripts, 'normalize-layout.js'), '--contract', contractPath, '--layout', layoutPath, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.warnings.filter((entry) => entry.message.includes('lineHeight')).map((entry) => entry.node), [unknown]);
    assert.deepEqual(report.repairs, []);
    assert.equal(fs.readFileSync(layoutPath, 'utf8'), before);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('explicit typography preset wins over semantic role when project defaults are present', () => {
  const current = contract();
  current.components.find((entry) => entry.name === 'Heading').props.push('lineHeight', 'fontSizeTablet', 'fontSizeMobile');
  const profile = buildResolvedDesignProfile(current, { typography: { presets: {
    h1: { fontSize: '80px', lineHeight: '1.1' },
    h2: { fontSize: '40px', fontSizeMobile: '28px', lineHeight: '1.3' },
  } } });
  const resolved = applyResolvedDesignDefaults('Heading', { tag: 'h1', typographyPreset: 'H2' }, profile, 'h1');
  assert.equal(resolved.typographyPreset, 'H2');
  assert.equal(resolved.fontSize, '40px');
  assert.equal(resolved.fontSizeMobile, '28px');
  assert.equal(resolved.lineHeight, '1.3');
  const explicit = applyResolvedDesignDefaults('Heading', { tag: 'h1', typographyPreset: 'h2', fontSize: '43px' }, profile);
  assert.equal(explicit.fontSize, '43px');
  const missing = applyResolvedDesignDefaults('Heading', { tag: 'h1', typographyPreset: 'custom' }, profile);
  assert.equal(missing.fontSize, undefined);
});


test('project typography completes independent families without breaking explicit responsive inheritance', async () => {
  const current = contract();
  const text = current.components.find((entry) => entry.name === 'Text');
  const typography = {
    fontFamily: 'Arial', fontSize: '18px', fontSizeTablet: '18px', fontSizeMobile: '17px',
    fontWeight: '400', lineHeight: '1.6', lineHeightMobile: '1.5', letterSpacing: '0em',
  };
  text.props.push(...Object.keys(typography));
  const projectTokens = { typography: { presets: { body: typography } } };
  const profile = buildResolvedDesignProfile(current, projectTokens);
  const eyebrow = { text: 'Pracownia Forma · architektura wnętrz', fontSize: '12px', fontWeight: '600', letterSpacing: '0.12em' };
  const resolved = applyResolvedDesignDefaults('Text', eyebrow, profile, 'body');
  assert.equal(resolved.fontSize, '12px');
  assert.equal(resolved.fontSizeTablet, undefined);
  assert.equal(resolved.fontSizeMobile, undefined);
  assert.equal(resolved.fontFamily, 'Arial');
  assert.equal(resolved.fontWeight, '600');
  assert.equal(resolved.letterSpacing, '0.12em');
  assert.equal(resolved.lineHeightMobile, '1.5');
  const tablet = applyResolvedDesignDefaults('Text', { fontSizeTablet: '14px' }, profile, 'body');
  assert.equal(tablet.fontSize, '18px');
  assert.equal(tablet.fontSizeTablet, '14px');
  assert.equal(tablet.fontSizeMobile, undefined);
  const mobile = applyResolvedDesignDefaults('Text', { ...eyebrow, fontSizeMobile: '11px', lineHeight: '1.2' }, profile, 'body');
  assert.equal(mobile.fontSizeTablet, undefined);
  assert.equal(mobile.fontSizeMobile, '11px');
  assert.equal(mobile.lineHeightMobile, undefined);
  assert.deepEqual(applyResolvedDesignDefaults('Text', {}, profile, 'body'), typography);
  assert.equal(eyebrow.fontSizeMobile, undefined);
  const { Kit } = await import(path.join(scripts, 'layout-kit.mjs'));
  const kit = new Kit(current, { projectTokens });
  const id = kit.node('Text', eyebrow, [], 'body');
  assert.equal(kit.nodes[id].props.fontSize, '12px');
  assert.equal(kit.nodes[id].props.fontSizeTablet, undefined);
  assert.equal(kit.nodes[id].props.fontSizeMobile, undefined);
});
