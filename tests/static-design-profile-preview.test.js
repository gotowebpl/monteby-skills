'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const renderScript = path.join(root, 'monteby-site-authoring', 'scripts', 'render-monteby-preview.js');
const iterationScript = path.join(root, 'monteby-site-authoring', 'scripts', 'run-visual-iteration.js');
const { renderDocument } = require(renderScript);

function contract(overrides = {}) {
  return {
    components: [
      { name: 'Section', isCanvas: true, allowedParents: ['ROOT'], props: [], aiProps: [] },
      { name: 'Heading', allowedParents: ['Section'], props: ['text', 'tag', 'typographyPreset', 'fontFamily', 'fontSize', 'fontSizeMobile', 'fontWeight', 'lineHeight', 'textColor'], aiProps: ['text', 'tag', 'typographyPreset', 'fontFamily', 'fontSize', 'fontSizeMobile', 'fontWeight', 'lineHeight', 'textColor'] },
      { name: 'ButtonBlock', allowedParents: ['Section'], props: ['label', 'href', 'typographyPreset', 'fontFamily', 'fontSize', 'lineHeight', 'backgroundColor', 'textColor', 'borderRadius'], aiProps: ['label', 'href', 'typographyPreset', 'fontFamily', 'fontSize', 'lineHeight', 'backgroundColor', 'textColor', 'borderRadius'] },
    ],
    globalStyles: {
      colors: { accent: '#123456', text: '#202124' },
      typography: {
        fonts: {
          body: { label: 'Arial', value: 'Arial, sans-serif' },
          display: { label: 'Roboto', value: 'Roboto, sans-serif' },
          web: { label: 'Inter', value: 'Inter, sans-serif' },
        },
        presets: {
          h1: { label: 'H1', fontFamily: 'var(--gcb-font-body)', fontSize: '52px', fontWeight: '700', lineHeight: '1.1', color: 'var(--gcb-color-text)' },
          button: { label: 'Button', fontFamily: 'var(--gcb-font-body)', fontSize: '15px', fontWeight: '600', lineHeight: '20px' },
        },
      },
      customCSS: '.must-not-be-emitted{position:fixed}',
    },
    designTokens: {
      version: 1,
      tokens: {
        'colors.accent': { value: '#ff0000', cssVariable: '--monteby-token-colors-accent', reference: 'var(--monteby-token-colors-accent)' },
        'buttons.radius': { value: '19px', cssVariable: '--monteby-token-buttons-radius', reference: 'var(--monteby-token-buttons-radius)' },
      },
      bindings: { ButtonBlock: { backgroundColor: 'colors.accent', borderRadius: 'buttons.radius' } },
      layout: { contentWidth: '1120px' },
    },
    fontCatalog: {
      version: 1,
      system: { _system_Arial: 'Arial, Helvetica, sans-serif' },
      google: {
        inter: { family: 'Inter', weights: '100..900' },
        roboto: { family: 'Roboto', weights: '400;700' },
      },
      local: { choices: [{ label: 'Local Roboto', value: 'Roboto, sans-serif' }], faces: {} },
    },
    integrations: { secret: 'must-not-be-emitted' },
    authoring: { blockedProps: ['className'], topLevelRootComponents: ['Section'] },
    ...overrides,
  };
}

function layout() {
  return {
    ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, nodes: ['heading', 'button', 'local', 'google', 'web', 'legacy', 'unknown'] },
    heading: { type: { resolvedName: 'Heading' }, props: { text: 'Profile heading', tag: 'h1', typographyPreset: 'h1', fontSizeMobile: '31px' }, nodes: [] },
    button: { type: { resolvedName: 'ButtonBlock' }, props: { label: 'Profile button', typographyPreset: 'button', backgroundColor: 'var(--monteby-token-colors-accent)', borderRadius: 'var(--monteby-token-buttons-radius)' }, nodes: [] },
    local: { type: { resolvedName: 'Heading' }, props: { text: 'Local heading', tag: 'h2', typographyPreset: 'h1', fontSize: '33px', lineHeight: '1.4', textColor: '#abcdef' }, nodes: [] },
    google: { type: { resolvedName: 'Heading' }, props: { text: 'Google heading', tag: 'h2', fontFamily: 'var(--gcb-font-display)' }, nodes: [] },
    web: { type: { resolvedName: 'Heading' }, props: { text: 'Web heading', tag: 'h2', fontFamily: 'var(--gcb-font-web)' }, nodes: [] },
    legacy: { type: { resolvedName: 'Heading' }, props: { text: 'Legacy heading', tag: 'h2' }, nodes: [] },
    unknown: { type: { resolvedName: 'Heading' }, props: { text: 'Unknown heading', tag: 'h2', typographyPreset: 'missing', fontFamily: 'var(--gcb-font-missing)', textColor: 'var(--gcb-color-missing)' }, nodes: [] },
  };
}

test('static preview consumes only explicit published design references without mutating saved JSON', () => {
  const nodeMap = layout();
  const serialized = JSON.stringify(nodeMap);
  const legacy = renderDocument(nodeMap, 'Profile');
  const rendered = renderDocument(nodeMap, 'Profile', contract());

  assert.equal(JSON.stringify(nodeMap), serialized);
  assert.equal(renderDocument(nodeMap, 'Profile', null).html, legacy.html);
  assert.ok(legacy.diagnostics.some((diagnostic) => diagnostic.startsWith('design-contract-required:')));
  assert.match(rendered.html, /--gcb-color-accent:#123456/);
  assert.match(rendered.html, /--monteby-token-colors-accent:#123456/);
  assert.match(rendered.html, /--monteby-token-buttons-radius:19px/);
  assert.match(rendered.html, /--gcb-typo-h1-font-size:52px/);
  assert.match(rendered.html, /--monteby-token-layout-content-width:1120px/);
  assert.match(rendered.fragment, /Profile heading<\/h1>/);
  assert.match(rendered.fragment, /font-family:Arial,sans-serif/);
  assert.match(rendered.fragment, /font-size:52px/);
  assert.match(rendered.fragment, /--monteby-font-size-mobile:31px/);
  assert.match(rendered.fragment, /Local heading<\/h2>/);
  assert.match(rendered.fragment, /font-size:33px;line-height:1\.4[^>]*color:#abcdef/);
  assert.match(rendered.fragment, /Legacy heading<\/h2>/);
  assert.doesNotMatch(rendered.fragment.match(/<h2[^>]*>Legacy heading<\/h2>/)?.[0] || '', /font-size|font-family/);
  assert.doesNotMatch(rendered.html, /--gcb-(?:font|color)-missing:/);
  assert.doesNotMatch(rendered.html, /must-not-be-emitted|position:fixed/);
  assert.doesNotMatch(rendered.html, /family=Roboto:wght/);
  assert.match(rendered.html, /family=Inter:wght@100\.\.900/);
  assert.deepEqual(rendered.diagnostics, ['unresolved-design-reference:var(--gcb-color-missing)', 'unresolved-design-reference:var(--gcb-font-missing)', 'unresolved-local-font-face:Roboto, sans-serif', 'unresolved-typography-preset:missing']);
});

test('contract font discovery does not change legacy no-contract dependency scanning', () => {
  const nodeMap = {
    ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, nodes: ['button'] },
    button: { type: { resolvedName: 'ButtonBlock' }, props: { label: 'Legacy', buttonFontFamily: 'Inter' }, nodes: [] },
  };
  assert.doesNotMatch(renderDocument(nodeMap, 'Legacy').html, /fonts\.googleapis\.com/);
  const liveContract = contract();
  assert.match(renderDocument(nodeMap, 'Contract', liveContract).html, /family=Inter:wght@100\.\.900/);
});

test('contract CLI and visual iteration use the captured candidate contract', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-static-profile-'));
  const layoutPath = path.join(directory, 'layout.json');
  const contractPath = path.join(directory, 'contract.json');
  const outPath = path.join(directory, 'preview.html');
  const validLayout = layout();
  validLayout.ROOT.nodes = validLayout.ROOT.nodes.filter((nodeId) => !['google', 'unknown'].includes(nodeId));
  delete validLayout.google;
  delete validLayout.unknown;
  fs.writeFileSync(layoutPath, JSON.stringify(validLayout));
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  const result = spawnSync(process.execPath, [renderScript, '--layout', layoutPath, '--contract', contractPath, '--out', outPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(outPath, 'utf8'), /--monteby-token-buttons-radius:19px/);
  validLayout.ROOT.nodes.push('unknown');
  validLayout.unknown = layout().unknown;
  fs.writeFileSync(layoutPath, JSON.stringify(validLayout));
  const refused = spawnSync(process.execPath, [renderScript, '--layout', layoutPath, '--contract', contractPath, '--out', outPath], { encoding: 'utf8' });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /unresolved-(?:design-reference|typography-preset)/);
  const iterationSource = fs.readFileSync(iterationScript, 'utf8');
  assert.match(iterationSource, /function renderArgs\(options\)[\s\S]*?'--contract',[\s\S]*?candidateContractPath\(options\)/u);
});

test('layout kit references render through the same resolved live profile', async () => {
  const { Kit } = await import(path.join(root, 'monteby-site-authoring', 'scripts', 'layout-kit.mjs'));
  const liveContract = contract();
  const kit = new Kit(liveContract);
  const heading = kit.heading('Kit heading', { tag: 'h1' });
  const button = kit.button('Kit button', '/kit');
  const nodeMap = kit.build([kit.section({}, [heading, button])]);
  const buttonProps = Object.values(nodeMap).find((node) => node?.type?.resolvedName === 'ButtonBlock').props;
  assert.equal(buttonProps.typographyPreset, 'button');
  assert.equal(buttonProps.backgroundColor, 'var(--gcb-color-accent)');
  assert.equal(buttonProps.borderRadius, 'var(--monteby-token-buttons-radius)');
  const rendered = renderDocument(nodeMap, 'Kit', liveContract);
  assert.match(rendered.fragment, /Kit heading<\/h1>/);
  assert.match(rendered.fragment, /font-size:52px/);
  assert.match(rendered.fragment, /background-color:var\(--gcb-color-accent\)/);
  assert.match(rendered.fragment, /border-radius:var\(--monteby-token-buttons-radius\)/);
});

test('static preview rejects unsafe published values and keeps unknown presets unresolved', () => {
  const unsafe = contract();
  unsafe.globalStyles.colors.accent = 'red;}</style><script>alert(1)</script>';
  unsafe.globalStyles.typography.presets.h1.fontSize = '52px;position:fixed';
  unsafe.designTokens.tokens['buttons.radius'].value = 'url(https://evil.test)';
  const rendered = renderDocument(layout(), 'Unsafe', unsafe);
  assert.doesNotMatch(rendered.html, /alert\(1\)|evil\.test|position:fixed|--gcb-color-accent:|--monteby-token-buttons-radius:/);
  assert.doesNotMatch(rendered.fragment.match(/<h2[^>]*>Unknown heading<\/h2>/)?.[0] || '', /font-family/);
});

test('static preview closes used published reference chains and rejects missing or cyclic dependencies', () => {
  const nodeMap = {
    ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, nodes: ['heading'] },
    heading: { type: { resolvedName: 'Heading' }, props: { text: 'Chain', tag: 'h1', typographyPreset: 'h1', textColor: 'var(--gcb-color-accent)' }, nodes: [] },
  };
  const chained = contract();
  chained.globalStyles.colors.accent = 'var(--monteby-token-colors-accent-strong)';
  chained.designTokens.tokens['colors.accent_strong'] = {
    value: '#314159',
    cssVariable: '--monteby-token-colors-accent-strong',
    reference: 'var(--monteby-token-colors-accent-strong)',
  };
  chained.globalStyles.typography.fonts.body = { label: 'Body chain', value: 'var(--gcb-font-web)' };
  const resolved = renderDocument(nodeMap, 'Chained', chained);
  assert.deepEqual(resolved.diagnostics, []);
  assert.match(resolved.html, /--gcb-color-accent:var\(--monteby-token-colors-accent-strong\)/);
  assert.match(resolved.html, /--monteby-token-colors-accent-strong:#314159/);
  assert.match(resolved.fragment, /font-family:Inter,sans-serif/);
  assert.match(resolved.html, /family=Inter:wght@100\.\.900/);

  chained.designTokens.tokens['colors.accent_strong'].value = 'var(--unpublished-private-color)';
  assert.deepEqual(renderDocument(nodeMap, 'Missing chain', chained).diagnostics, ['unresolved-design-reference:var(--unpublished-private-color)']);

  chained.globalStyles.colors.accent = 'var(--gcb-color-accent)';
  assert.deepEqual(renderDocument(nodeMap, 'Self cycle', chained).diagnostics, ['cyclic-design-reference:var(--gcb-color-accent)']);

  chained.globalStyles.colors.accent = 'var(--gcb-color-text)';
  chained.globalStyles.colors.text = 'var(--gcb-color-accent)';
  assert.deepEqual(renderDocument(nodeMap, 'Mutual cycle', chained).diagnostics, ['cyclic-design-reference:var(--gcb-color-accent)']);
});

test('static preview trusts only published Google provenance and emits bounded local faces', () => {
  const published = contract();
  published.globalStyles.typography.fonts.web = { label: 'Acme', value: 'Acme Display, sans-serif' };
  published.fontCatalog.google = { 'acme display': { family: 'Acme Display', weights: '300;700' } };
  const webOnly = layout();
  webOnly.ROOT.nodes = ['web'];
  for (const nodeId of Object.keys(webOnly)) {
    if (!['ROOT', 'web'].includes(nodeId)) delete webOnly[nodeId];
  }
  const google = renderDocument(webOnly, 'Published Google', published);
  assert.match(google.html, /family=Acme\+Display:wght@300;700/);
  assert.deepEqual(google.diagnostics, []);

  published.fontCatalog.google = { 'acme display': { family: 'Acme Display', weights: '200..1000' } };
  assert.match(renderDocument(webOnly, 'Variable Google', published).html, /family=Acme\+Display:wght@200\.\.1000/);
  published.fontCatalog.google = { 'acme display': { family: 'Acme Display', weights: '100..300;400;500..700;900' } };
  assert.match(renderDocument(webOnly, 'Mixed Google', published).html, /family=Acme\+Display:wght@100\.\.300;400;500\.\.700;900/);

  for (const weights of ['700..200', '400;300', '0..900', '100..1001', '400;;700']) {
    published.fontCatalog.google = { 'acme display': { family: 'Acme Display', weights } };
    const invalidWeights = renderDocument(webOnly, 'Invalid weights', published);
    assert.doesNotMatch(invalidWeights.html, /family=Acme\+Display/);
    assert.deepEqual(invalidWeights.diagnostics, ['unresolved-font-provider:var(--gcb-font-web)']);
  }

  published.fontCatalog.google = {};
  const unpublished = renderDocument(webOnly, 'Unpublished Google', published);
  assert.doesNotMatch(unpublished.html, /family=Acme\+Display/);
  assert.deepEqual(unpublished.diagnostics, ['unresolved-font-provider:var(--gcb-font-web)']);

  published.fontCatalog.google = { 'acme display': { family: 'Acme Display&family=Injected', weights: '300;700&display=block' } };
  const injected = renderDocument(webOnly, 'Invalid catalog', published);
  assert.doesNotMatch(injected.html, /Injected|display=block/);
  assert.deepEqual(injected.diagnostics, ['unresolved-font-provider:var(--gcb-font-web)']);

  const local = contract();
  local.globalStyles.typography.fonts.web = { label: 'Native', value: 'Native Brand, serif' };
  local.fontCatalog.google = { 'native brand': { family: 'Native Brand', weights: '100..900' } };
  local.fontCatalog.local = {
    choices: [{ label: 'Native Brand', value: 'Native Brand, serif' }],
    faces: { native: [{ 'font-family': 'Native Brand', src: ['https://assets.example.test/native.woff2'], 'font-style': 'normal', 'font-weight': '400' }] },
  };
  const localRendered = renderDocument(webOnly, 'Local', local);
  assert.match(localRendered.html, /@font-face\{font-family:"Native Brand";src:url\("https:\/\/assets\.example\.test\/native\.woff2"\);font-style:normal;font-weight:400\}/);
  assert.doesNotMatch(localRendered.html, /family=Native\+Brand/);
  assert.deepEqual(localRendered.diagnostics, []);

  local.globalStyles.typography.fonts.web = { label: 'Quoted comma', value: '"Native,Serif", serif' };
  local.fontCatalog.google = {};
  local.fontCatalog.local = {
    choices: [{ label: 'Quoted comma', value: '"Native,Serif", serif' }],
    faces: { native: [{ 'font-family': '"Native,Serif"', src: ['https://assets.example.test/native-comma.woff2'] }] },
  };
  const quotedComma = renderDocument(webOnly, 'Quoted comma', local);
  assert.match(quotedComma.html, /@font-face\{font-family:"Native,Serif";src:url\("https:\/\/assets\.example\.test\/native-comma\.woff2"\)\}/);
  assert.match(quotedComma.fragment, /font-family:&quot;Native,Serif&quot;,serif/);
  assert.deepEqual(quotedComma.diagnostics, []);

  local.globalStyles.typography.fonts.web = { label: 'Apostrophe', value: '"Rock\'n\'Roll", serif' };
  local.fontCatalog.local = {
    choices: [{ label: 'Apostrophe', value: '"Rock\'n\'Roll", serif' }],
    faces: { rock: [{ 'font-family': '"Rock\'n\'Roll"', src: ['https://assets.example.test/rock.woff2'] }] },
  };
  const apostrophe = renderDocument(webOnly, 'Apostrophe', local);
  assert.match(apostrophe.html, /@font-face\{font-family:"Rock'n'Roll";src:url\("https:\/\/assets\.example\.test\/rock\.woff2"\)\}/);
  assert.deepEqual(apostrophe.diagnostics, []);

  for (const [value, faceFamily, source, expectedFamily] of [
    ['Acme.Brand, serif', '"Acme.Brand"', 'acme-dot.woff2', '"Acme.Brand"'],
    ['"Native \\"Display\\"", serif', '"Native \\"Display\\""', 'native-quote.woff2', '"Native \\"Display\\""'],
    ["'Native \\'Quote\\'', serif", "'Native \\'Quote\\''", 'native-single.woff2', '"Native \'Quote\'"'],
    ['Żółć Sans, sans-serif', 'Żółć Sans', 'unicode.woff2', '"Żółć Sans"'],
    ['Ż, sans-serif', '"ż"', 'unicode-single.woff2', '"ż"'],
  ]) {
    local.globalStyles.typography.fonts.web = { label: 'Special local', value };
    local.fontCatalog.local = {
      choices: [{ label: 'Special local', value }],
      faces: { special: [{ 'font-family': faceFamily, src: [`https://assets.example.test/${source}`] }] },
    };
    const special = renderDocument(webOnly, 'Special local', local);
    assert.ok(special.html.includes(`@font-face{font-family:${expectedFamily};src:url("https://assets.example.test/${source}")}`), `${value}: ${special.html.slice(0, 1200)}`);
    assert.deepEqual(special.diagnostics, [], value);
  }

  local.globalStyles.typography.fonts.web = { label: 'Native', value: 'Native Brand, serif' };
  local.fontCatalog.local = {
    choices: [{ label: 'Native Brand', value: 'Native Brand, serif' }],
    faces: { native: [{ 'font-family': 'Native Brand', src: ['https://assets.example.test/native.woff2'], 'font-style': 'normal', 'font-weight': '400' }] },
  };
  local.fontCatalog.local.faces.native[0].src = ['https://user:password@assets.example.test/private.woff2'];
  const unsafeLocal = renderDocument(webOnly, 'Unsafe local', local);
  assert.doesNotMatch(unsafeLocal.html, /password|private\.woff2|@font-face/);
  assert.ok(unsafeLocal.diagnostics.some((diagnostic) => diagnostic.startsWith('unresolved-local-font-face:')));
});

if (process.env.MONTEBY_STATIC_DESIGN_BROWSER_QA === '1') {
  const playwright = require(process.env.MONTEBY_PLAYWRIGHT_MODULE || 'playwright');
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    for (const width of [1440, 834, 390, 375]) {
      test(`real ${engine} ${width}px static preview follows the live design profile`, async () => {
        const browser = await playwright[engine].connect(process.env.MONTEBY_PLAYWRIGHT_WS);
        try {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.route('https://**/*', (route) => route.abort());
          const first = contract();
          const { Kit } = await import(path.join(root, 'monteby-site-authoring', 'scripts', 'layout-kit.mjs'));
          const kit = new Kit(first);
          const nodeMap = kit.build([
            kit.section({}, [
              kit.heading('Profile heading', { tag: 'h1', fontSizeMobile: '31px' }),
              kit.button('Profile button', '/profile'),
            ]),
          ]);
          await page.setContent(renderDocument(nodeMap, 'Profile', first).html, { waitUntil: 'domcontentloaded' });
          const initial = await page.locator('h1').evaluate((element) => {
            const style = getComputedStyle(element);
            return { size: style.fontSize, family: style.fontFamily, color: style.color };
          });
          assert.equal(initial.size, width <= 767 ? '31px' : '52px');
          assert.match(initial.family, /^Arial/u);
          assert.equal(initial.color, 'rgb(32, 33, 36)');
          assert.equal(await page.getByText('Profile button').evaluate((element) => getComputedStyle(element).borderRadius), '19px');
          first.globalStyles.colors.text = '#654321';
          first.globalStyles.typography.presets.h1.fontSize = '57px';
          first.designTokens.tokens['buttons.radius'].value = '7px';
          await page.setContent(renderDocument(nodeMap, 'Profile', first).html, { waitUntil: 'domcontentloaded' });
          assert.equal(await page.locator('h1').evaluate((element) => getComputedStyle(element).fontSize), width <= 767 ? '31px' : '57px');
          assert.equal(await page.locator('h1').evaluate((element) => getComputedStyle(element).color), 'rgb(101, 67, 33)');
          assert.equal(await page.getByText('Profile button').evaluate((element) => getComputedStyle(element).borderRadius), '7px');
        } finally {
          await browser.close();
        }
      });
    }

    test(`real ${engine} loads a published local font for Kit output without Google fallback`, async () => {
      const localFontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
      assert.ok(fs.existsSync(localFontPath), `Local QA font is unavailable: ${localFontPath}`);
      const localFont = fs.readFileSync(localFontPath);
      const localFontUrl = 'https://assets.example.test/monteby-local-proof.ttf';
      const browser = await playwright[engine].connect(process.env.MONTEBY_PLAYWRIGHT_WS);
      try {
        const page = await browser.newPage({ viewport: { width: 834, height: 900 } });
        const remoteRequests = [];
        await page.route('https://**/*', (route) => {
          const url = route.request().url();
          remoteRequests.push(url);
          if (url === localFontUrl) {
            return route.fulfill({
              body: localFont,
              contentType: 'font/ttf',
              headers: { 'access-control-allow-origin': '*' },
            });
          }
          return route.abort();
        });
        const liveContract = contract();
        liveContract.globalStyles.typography.fonts.body = { label: 'Local proof', value: 'Monteby Local Proof, monospace' };
        liveContract.fontCatalog.google['monteby local proof'] = { family: 'Monteby Local Proof', weights: '100..900' };
        liveContract.fontCatalog.local = {
          choices: [{ label: 'Local proof', value: 'Monteby Local Proof, monospace' }],
          faces: { 'local-proof': [{ 'font-family': 'Monteby Local Proof', src: [localFontUrl], 'font-style': 'normal', 'font-weight': '400' }] },
        };
        const { Kit } = await import(path.join(root, 'monteby-site-authoring', 'scripts', 'layout-kit.mjs'));
        const kit = new Kit(liveContract);
        const nodeMap = kit.build([kit.section({}, [kit.heading('iiiiiiiiWWWW', { tag: 'h1', fontWeight: '400', fontSize: '64px' })])]);
        const rendered = renderDocument(nodeMap, 'Local font', liveContract);
        assert.deepEqual(rendered.diagnostics, []);
        assert.doesNotMatch(rendered.html, /fonts\.googleapis\.com/);
        await page.setContent(rendered.html, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => document.fonts.load('400 64px "Monteby Local Proof"'));
        const evidence = await page.locator('h1').evaluate((element) => {
          const context = document.createElement('canvas').getContext('2d');
          context.font = '400 64px "Monteby Local Proof"';
          const loadedWidth = context.measureText(element.textContent).width;
          context.font = '400 64px monospace';
          return {
            checked: document.fonts.check('400 64px "Monteby Local Proof"'),
            computedFamily: getComputedStyle(element).fontFamily,
            loadedWidth,
            fallbackWidth: context.measureText(element.textContent).width,
          };
        });
        assert.equal(evidence.checked, true);
        assert.match(evidence.computedFamily, /^"?Monteby Local Proof"?(?:,|$)/u);
        assert.ok(Math.abs(evidence.loadedWidth - evidence.fallbackWidth) > 1, `Loaded font metric must differ from fallback: ${JSON.stringify(evidence)}`);
        assert.ok(remoteRequests.includes(localFontUrl));
        assert.equal(remoteRequests.some((url) => url.startsWith('https://fonts.googleapis.com/')), false);
      } finally {
        await browser.close();
      }
    });
  }
}
