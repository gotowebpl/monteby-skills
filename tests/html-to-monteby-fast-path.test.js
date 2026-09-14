'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SCRIPTS = path.join(REPO, 'monteby-site-authoring', 'scripts');
const REFERENCES = path.join(REPO, 'monteby-site-authoring', 'references');

/** Minimalny kontrakt odwzorowujący realne kształty kontrolek. */
const CONTRACT = {
  version: 1,
  authoring: {
    blockedProps: ['className', 'hoverBg', 'transform'],
    topLevelRootComponents: ['Section'],
  },
  components: [
    {
      name: 'Section',
      isCanvas: true,
      allowedParents: ['ROOT'],
      props: ['anchorId', 'background', 'backgroundType', 'backgroundImage', 'paddingTop', 'layoutDisplay', 'gap', 'innerMaxWidth', 'innerPaddingX'],
      controls: [
        { type: 'text', props: ['anchorId'], pattern: '^(?:|[A-Za-z][A-Za-z0-9_-]{0,63})$' },
        { type: 'select', props: ['backgroundType'], options: ['', 'color', 'gradient', 'image'] },
        { type: 'select', props: ['layoutDisplay'], options: ['', 'flex', 'grid'] },
        { type: 'css-value', props: ['paddingTop'], step: 1, units: ['px'] },
        { type: 'css-value', props: ['gap'], step: 1, units: ['px'] },
      ],
    },
    {
      name: 'Container',
      isCanvas: true,
      allowedParents: ['Section', 'Container'],
      props: ['anchorId', 'borderWidth', 'borderTopWidth', 'borderTopColor', 'flexGrow', 'width', 'paddingLeft', 'sticky', 'stickyTop', 'hoverTranslateY'],
      controls: [
        { type: 'number', props: ['flexGrow'], step: 1, min: 0, max: 12 },
        { type: 'css-value', props: ['width'], units: ['px'] },
        { type: 'spacing', spacingProps: { left: 'paddingLeft' }, units: ['px'], min: 0, max: 200 },
        { type: 'toggle', props: ['sticky'] },
        { type: 'css-value', props: ['stickyTop'], units: ['px'] },
        { type: 'number', props: ['hoverTranslateY'], min: -999, max: 999 },
      ],
    },
    {
      name: 'Heading',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['anchorId', 'text', 'tag', 'fontSize', 'lineHeight', 'marginTop', 'textTransform'],
      controls: [
        { type: 'css-value', props: ['fontSize'], step: 1, units: ['px'] },
        { type: 'css-value', props: ['lineHeight'], step: 0.1, units: [''] },
        { type: 'segment', props: ['textTransform'], options: ['', 'uppercase', 'lowercase'] },
        { type: 'custom', props: ['tag'], pattern: '^h[1-6]$' },
      ],
    },
    {
      name: 'ButtonBlock',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['label', 'href', 'fontSize', 'backgroundColor', 'textColor'],
      controls: [{ type: 'css-value', props: ['fontSize'], step: 1, units: ['px'] }],
    },
    {
      name: 'ListBlock',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['items'],
      controls: [{ type: 'custom', props: ['items'] }],
    },
  ],
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-fast-path-'));
}

function writeContract(dir) {
  const file = path.join(dir, 'contract.json');
  fs.writeFileSync(file, JSON.stringify(CONTRACT), 'utf8');
  return file;
}

test('layout-kit snaps control values and repairs renderer traps', async () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));
  const kit = await Kit.fromContract(contract);

  const section = kit.section({ paddingTop: '104.6px' }, [
    kit.heading('Tytuł', { tag: 'h1', fontSize: '78.4px', lineHeight: '1.05' }),
    kit.box({ borderTopWidth: '1px', borderTopColor: '#333', flexGrow: '2' }),
  ]);
  const result = await kit.write(path.join(dir, 'layout.json'), [section]);
  const map = JSON.parse(fs.readFileSync(result.path, 'utf8'));

  const heading = Object.values(map).find((node) => node.type.resolvedName === 'Heading');
  assert.equal(heading.props.fontSize, '78px', 'krok 1 zaokrągla rozmiar');
  assert.equal(heading.props.lineHeight, '1.1', 'krok 0.1 zaokrągla interlinię');
  assert.equal(heading.props.marginTop, '0px', 'tekst dostaje wyzerowany margines górny');

  const container = Object.values(map).find((node) => node.type.resolvedName === 'Container');
  assert.equal(container.props.flexGrow, 2, 'liczba zamiast tekstu');
  assert.equal(container.props.borderWidth, '0px', 'pojedyncza krawędź zeruje pozostałe');

  assert.equal(map.ROOT.nodes.length, 1);
  assert.equal(map[map.ROOT.nodes[0]].type.resolvedName, 'Section');
});

test('layout-kit rejects contract violations and the ListBlock object trap', async () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));
  const kit = await Kit.fromContract(contract);

  assert.throws(() => kit.heading('x', { className: 'foo' }), /zablokowany/);
  assert.throws(() => kit.heading('x', { nieistniejacy: 1 }), /spoza kontraktu/);
  assert.throws(() => kit.node('ListBlock', { items: [{ text: 'a', href: '/a' }] }), /React #31/);
  assert.throws(() => kit.section({}, [kit.section({})]), /niedozwolony/);
});

test('layout-kit validates spacing, custom controls, and published token references locally', async () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));
  const kit = await Kit.fromContract(contract);

  const section = kit.section({}, [
    kit.box({ paddingLeft: 'auto' }),
    kit.heading('Nieprawidłowy tag', { tag: 'div' }),
    kit.button('Token', '/', { backgroundColor: 'var(--arbitrary-color)' }),
  ]);
  const result = await kit.write(path.join(dir, 'controls.json'), [section]);
  const map = JSON.parse(fs.readFileSync(result.path, 'utf8'));
  const container = Object.values(map).find((node) => node.type.resolvedName === 'Container');
  const heading = Object.values(map).find((node) => node.type.resolvedName === 'Heading');
  const button = Object.values(map).find((node) => node.type.resolvedName === 'ButtonBlock');

  assert.equal(container.props.paddingLeft, undefined);
  assert.equal(heading.props.tag, undefined);
  assert.equal(button.props.backgroundColor, undefined);
  assert.ok(result.notes.some((note) => note.includes('Container.paddingLeft')));
  assert.ok(result.notes.some((note) => note.includes('Heading.tag')));
  assert.ok(result.notes.some((note) => note.includes('nieopublikowana referencja CSS')));
});

test('layout-kit starts a fresh document after each successful write', async () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));
  const kit = await Kit.fromContract(contract);

  const first = kit.section({}, [kit.heading('Pierwszy dokument', { tag: 'h1', lineHeight: '1.2' })]);
  await kit.write(path.join(dir, 'first.json'), [first]);
  const second = kit.section({}, [kit.heading('Drugi dokument', { tag: 'h2', lineHeight: '1.3' })]);
  const secondResult = await kit.write(path.join(dir, 'second.json'), [second]);
  const secondMap = JSON.parse(fs.readFileSync(secondResult.path, 'utf8'));

  assert.equal(Object.keys(secondMap).length, 3);
  assert.deepEqual(secondMap.ROOT.nodes, ['section-2']);
  assert.equal(JSON.stringify(secondMap).includes('Pierwszy dokument'), false);
  assert.equal(JSON.stringify(secondMap).includes('Drugi dokument'), true);
});

test('layout-kit requires same-page links to resolve to one contract anchor target', async () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));

  const valid = await Kit.fromContract(contract);
  const section = valid.section({ anchorId: 'contact' }, [valid.button('Kontakt', '#contact')]);
  const result = await valid.write(path.join(dir, 'anchor-layout.json'), [section]);
  const map = JSON.parse(fs.readFileSync(result.path, 'utf8'));
  assert.equal(map[map.ROOT.nodes[0]].props.anchorId, 'contact');

  const missing = await Kit.fromContract(contract);
  const missingSection = missing.section({}, [missing.button('Kontakt', '#contact')]);
  await assert.rejects(missing.write(path.join(dir, 'missing-anchor.json'), [missingSection]), /dokładnie jednego anchorId/);

  const duplicate = await Kit.fromContract(contract);
  const first = duplicate.section({ anchorId: 'contact' });
  const second = duplicate.section({ anchorId: 'contact' });
  await assert.rejects(duplicate.write(path.join(dir, 'duplicate-anchor.json'), [first, second]), /występuje 2 razy/);
});

test('layout-kit accepts only an environment-variable name for live-site authentication', async () => {
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));
  const originalFetch = global.fetch;
  const originalAuth = process.env.MONTEBY_TEST_AUTH;
  const directCredential = `fixture-${process.pid}-${Date.now()}`;
  let request = null;

  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return CONTRACT;
      },
    };
  };
  process.env.MONTEBY_TEST_AUTH = directCredential;

  try {
    await assert.rejects(
      Kit.fromSite('https://example.test', directCredential),
      /blocked_secrets/
    );
    await assert.rejects(
      Kit.fromSite('https://example.test', { authEnv: directCredential }),
      /blocked_secrets/
    );

    const kit = await Kit.fromSite('https://example.test/', { authEnv: 'MONTEBY_TEST_AUTH' });
    assert.equal(kit.contract, CONTRACT);
    assert.equal(request.url, 'https://example.test/wp-json/monteby/v1/contract');
    assert.equal(
      request.options.headers.Authorization,
      `Basic ${Buffer.from(process.env.MONTEBY_TEST_AUTH).toString('base64')}`
    );
  } finally {
    global.fetch = originalFetch;
    if (originalAuth === undefined) {
      delete process.env.MONTEBY_TEST_AUTH;
    } else {
      process.env.MONTEBY_TEST_AUTH = originalAuth;
    }
  }
});

test('normalize-layout reports value shapes and renderer traps at once', () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const layout = {
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['s1'] },
    s1: { type: { resolvedName: 'Section' }, isCanvas: true, props: {}, parent: 'ROOT', nodes: ['h1', 'c1'] },
    h1: {
      type: { resolvedName: 'Heading' },
      isCanvas: false,
      props: { text: 'x', fontSize: '14.8px', textTransform: 'none', className: 'x' },
      parent: 's1',
      nodes: [],
    },
    c1: {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: { flexGrow: '1', borderTopWidth: '1px' },
      parent: 's1',
      nodes: [],
    },
  };
  const layoutFile = path.join(dir, 'layout.json');
  fs.writeFileSync(layoutFile, JSON.stringify(layout), 'utf8');
  const fixed = path.join(dir, 'fixed.json');

  let stdout = '';
  try {
    stdout = execFileSync(
      process.execPath,
      [path.join(SCRIPTS, 'normalize-layout.js'), '--contract', contract, '--layout', layoutFile, '--fix', fixed, '--json'],
      { encoding: 'utf8' }
    );
  } catch (error) {
    stdout = error.stdout || '';
  }

  const report = JSON.parse(stdout);
  assert.ok(
    report.errors.some((item) => item.prop === 'className'),
    'prop zablokowany zgłoszony jako błąd'
  );
  assert.ok(
    report.repairs.some((item) => item.prop === 'fontSize' && /kroku/.test(item.message)),
    'rozmiar dociągnięty do kroku'
  );
  assert.ok(
    report.repairs.some((item) => item.prop === 'textTransform' && item.dropped),
    'wartość spoza enumu usunięta'
  );
  assert.ok(
    report.warnings.some((item) => /marginTop/.test(item.message)),
    'brak marginesu górnego zgłoszony'
  );
  assert.ok(
    report.warnings.some((item) => /borderWidth/.test(item.message)),
    'krawędź bez wyzerowania zgłoszona'
  );

  const repaired = JSON.parse(fs.readFileSync(fixed, 'utf8'));
  assert.equal(repaired.h1.props.fontSize, '15px');
  assert.equal(repaired.h1.props.marginTop, '0px');
  assert.equal(repaired.c1.props.flexGrow, 1);
  assert.equal(repaired.c1.props.borderWidth, '0px');
  assert.equal(repaired.h1.props.className, undefined);
});

test('audit-reference-css resolves variables, expands shorthands, and isolates residuals', () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const css = `
    :root { --ink: #0a0b0d; --pad: 104px; }
    .band { background-color: var(--ink); padding-top: var(--pad); margin: 0 0 1em; }
    .band:hover { background-color: #1e222a; }
    .card:hover { transform: translateY(-4px); }
    .sticky { position: sticky; top: 24px; }
    h1 { font-variation-settings: 'wdth' 112; font-size: 78px; }
    .eyebrow::before { width: 28px; height: 2px; background: var(--ink); }
    .wide { max-width: clamp(20px, 5vw, 40px); }
    .grid { gap: 26px 44px; }
  `;
  const cssFile = path.join(dir, 'mockup.css');
  fs.writeFileSync(cssFile, css, 'utf8');
  const plan = path.join(dir, 'plan.json');

  execFileSync(
    process.execPath,
    [path.join(SCRIPTS, 'audit-reference-css.mjs'), '--contract', contract, '--css', cssFile, '--out', plan],
    { encoding: 'utf8' }
  );

  const report = JSON.parse(fs.readFileSync(plan, 'utf8'));
  const residual = report.residual;

  assert.ok(report.summary.contract > 0, 'część deklaracji jest wyrażalna propsami');
  assert.ok(
    !residual.some((item) => item.property === 'background-color' && !item.selector.includes(':hover')),
    'zmienna CSS nie trafia do residuów'
  );
  assert.ok(
    residual.some((item) => item.selector.includes(':hover') && item.target === 'child-theme'),
    'stan wskazania trafia do arkusza'
  );
  assert.ok(
    !residual.some((item) => item.selector === '.card:hover' && item.property === 'transform'),
    'bezpieczny hover lift używa typed propa'
  );
  assert.ok(
    !residual.some((item) => item.selector === '.sticky' && ['position', 'top'].includes(item.property)),
    'sticky i stickyTop używają typed props tylko w tej samej regule'
  );
  assert.ok(
    residual.some((item) => item.property === 'font-variation-settings' && item.target === 'child-theme'),
    'oś fontu zmiennego trafia do arkusza'
  );
  assert.ok(
    residual.some((item) => item.selector.includes('::before') && item.target === 'rebuild-as-node'),
    'pseudoelement dekoracyjny do odtworzenia węzłem'
  );
  assert.ok(
    residual.some((item) => item.property === 'max-width' && item.target === 'resolve-measured'),
    'wartość wyliczana wymaga liczby z pomiaru'
  );
  assert.ok(
    residual.some((item) => item.property === 'gap' && /jedną wartość/.test(item.reason)),
    'gap dwuwartościowy wykryty'
  );
});

test('fast-path guidance uses measured runner, generic drafter, and plan artifact', () => {
  const skill = fs.readFileSync(path.join(REPO, 'monteby-site-authoring', 'SKILL.md'), 'utf8');
  const runbook = fs.readFileSync(path.join(REFERENCES, 'quick-start-runbook.md'), 'utf8');
  const html = fs.readFileSync(path.join(REFERENCES, 'html-to-monteby.md'), 'utf8');

  assert.match(skill, /quick-start-runbook\.md/);
  assert.match(skill, /html-to-monteby\.md/);
  assert.match(skill, /run-visual-iteration\.js/);
  assert.match(skill, /draft-monteby-layout\.js/);
  assert.match(skill, /--plan-out/);
  assert.match(runbook, /Phase table/);
  assert.match(runbook, /Required inputs/);
  assert.match(runbook, /Required artifacts/);
  assert.match(runbook, /Pass condition/);
  assert.match(runbook, /Failure action/);
  assert.match(runbook, /Allowed verdict/);
  assert.match(runbook, /--full-page/);
  assert.match(runbook, /desktop:1440x1200/);
  assert.match(runbook, /tablet:834x1112/);
  assert.match(runbook, /mobile:390x844/);
  assert.match(runbook, /mode: "generic-measured-reference"/);
  assert.match(runbook, /completion\.allBandsMapped/);
  assert.match(runbook, /completion\.truncated/);
  assert.match(runbook, /capturedBands === draftedRootSections/);
  assert.match(runbook, /`omittedBands` and `omittedMedia` are empty/);
  assert.match(runbook, /runner internally invokes `draft-monteby-layout\.js --plan-out`/);
  assert.match(runbook, /Do not\s+rerun `draft-monteby-layout\.js` after a passing runner/);
  assert.doesNotMatch(runbook, /node "\$SKILL\/scripts\/draft-monteby-layout\.js"/);
  assert.match(runbook, /apply-layout-repair-queue\.js/);
  assert.match(runbook, /unrelated subtrees remain\s+unchanged/);
  assert.doesNotMatch(runbook, /AUTHOR is a bounded manual edit|It is not an automatic mutator/);
  assert.match(runbook, /--expected-layout-sha256/);
  assert.match(runbook, /--save-report/);
  assert.match(runbook, /--report-out/);
  assert.match(runbook, /--preview-report/);
  assert.match(html, /Do not make a browser snippet, hand-written `build\.mjs`/);
  assert.match(html, /do not rerun the drafter after a passing\s+runner/);
  assert.match(html, /`run-visual-iteration\.js` renders a static diagnostic candidate/);
  assert.match(html, /saved canonical\s+WordPress\/PHP page/);
});

test('fast-path guidance contains no embedded secrets or third-party copy path', () => {
  const runbook = fs.readFileSync(path.join(REFERENCES, 'quick-start-runbook.md'), 'utf8');

  assert.match(runbook, /MONTEBY_AUTH_HEADER/);
  assert.match(runbook, /Never paste its value/);
  assert.match(runbook, /Use this runbook only in `owned-html-reconstruction` mode/);
  assert.match(runbook, /Unknown rights → (?:stop and use )?external-reference mode/);
  assert.match(runbook, /Never add it to an external\/public reference run/);
  assert.doesNotMatch(runbook, /USER:PASS|USER:APP_PASSWORD|-u "USER|Authorization: Bearer [A-Za-z0-9]/);
});

test('guidance forbids residual CSS by default and removes tolerance shortcuts', () => {
  const skill = fs.readFileSync(path.join(REPO, 'monteby-site-authoring', 'SKILL.md'), 'utf8');
  const runbook = fs.readFileSync(path.join(REFERENCES, 'quick-start-runbook.md'), 'utf8');
  const html = fs.readFileSync(path.join(REFERENCES, 'html-to-monteby.md'), 'utf8');
  const residuals = fs.readFileSync(path.join(REFERENCES, 'child-theme-residual-styles.md'), 'utf8');
  const guidance = `${skill}\n${runbook}\n${html}\n${residuals}`;

  assert.match(skill, /Residual CSS is forbidden\s+by default/);
  assert.match(runbook, /absent from the mechanical\s+completion path/);
  assert.match(residuals, /explicitly authorizes one\s+named, genuinely site-specific behavior/);
  assert.match(residuals, /Residual CSS is never:[\s\S]*a completion criterion/);
  assert.match(residuals, /cannot turn a failed comparison into[\s\n]*1:1/);
  assert.match(residuals, /emit-child-theme-css\.mjs/);
  assert.doesNotMatch(guidance, /(?:depth|głębokość)[^\n]*95%/i);
  assert.doesNotMatch(guidance, /±\s*30\s*px/);
});

test('form guidance requires approved legal copy without expanding scope', () => {
  const skill = fs.readFileSync(path.join(REPO, 'monteby-site-authoring', 'SKILL.md'), 'utf8');
  const runbook = fs.readFileSync(path.join(REFERENCES, 'quick-start-runbook.md'), 'utf8');
  const html = fs.readFileSync(path.join(REFERENCES, 'html-to-monteby.md'), 'utf8');
  const guidance = `${skill}\n${runbook}\n${html}`;

  assert.match(guidance, /only when (?:that exact copy and its destination URLs are supplied|the user\/project approved that exact text)/);
  assert.match(guidance, /do not invent a controller/i);
  assert.match(guidance, /do not expand|without expanding/i);
  assert.match(guidance, /blocked_legal_copy/);
});

test('extractor role rules keep structured content out of flattened text', () => {
  const snippet = execFileSync(
    process.execPath,
    [path.join(SCRIPTS, 'extract-reference-spec.mjs'), '--emit-snippet'],
    { encoding: 'utf8' }
  );
  // pozycja listy z dziećmi blokowymi to pudełko, nie tekst listy (checklista)
  assert.match(snippet, /tagName === 'LI' && !textOnly/);
  // odnośnik z blokowymi dziećmi (callout) to kontener, nie przycisk
  assert.match(snippet, /display === 'block' \|\| bcs\.display === 'flex' \|\| bcs\.display === 'grid'/);
  // span z display:block łamie textOnly (wiersze karty kontaktu)
  assert.match(snippet, /d === 'block' \|\| d === 'flex' \|\| d === 'grid'/);
});

test('extractor reads motion from the reference sheets', () => {
  const snippet = execFileSync(
    process.execPath,
    [path.join(SCRIPTS, 'extract-reference-spec.mjs'), '--emit-snippet'],
    { encoding: 'utf8' }
  );
  // stan po najechaniu i animacja są mierzone, nie zgadywane
  assert.match(snippet, /function motionOf/);
  assert.match(snippet, /hover\|focus-visible\|focus\|active/);
  assert.match(snippet, /if \(motion\) out\.motion = motion/);
  // zwykła reguła stylu też wystawia cssRules (zagnieżdżanie) — selektor sprawdzany pierwszy
  const selectorCheck = snippet.indexOf('rule.selectorText && STATE_RE.test');
  const nestedWalk = snippet.indexOf('rule.cssRules && rule.cssRules.length');
  assert.ok(selectorCheck > 0 && nestedWalk > selectorCheck);
  // skrót ze zmienną nie ma longhandów — czytany jest oryginalny zapis deklaracji
  assert.match(snippet, /rule\.style\.cssText \|\| ''/);
  // globalny reset fokusu pasuje do każdego węzła i musi wypaść
  assert.match(snippet, /universal/);
  assert.match(snippet, /reducedMotionHonored/);
});

test('compiler routes measured motion to the residual plan', () => {
  const source = fs.readFileSync(path.join(SCRIPTS, 'spec-to-layout.mjs'), 'utf8');
  assert.match(source, /function collectMotion/);
  assert.match(source, /motion: collectMotion\(spec, compiler\.loweredMotionPaths\)/);
  assert.match(source, /hoverLift|hoverTranslateY/);
  assert.match(source, /props\.hoverTranslateY = control\?\.type === 'css-value'[\s\S]*?: Number\(lift\[1\]\)/);
  assert.match(source, /hasOwnProperty\.call\(this\.kit\.nodes\[containerId\]\?\.props/);
  assert.match(source, /const residualStates = loweredMotionPaths\.has\(path\)/);
  assert.doesNotMatch(source, /if \(loweredMotionPaths\.has\(path\)\) \{[\s\S]{0,180}?return;/);
  // Ruch bez typed props nie trafia do node mapy.
  assert.match(source, /Tylko ruch bez typed props trafia do residual-plan\.json/);

  const guidance = fs.readFileSync(path.join(REFERENCES, 'html-to-monteby.md'), 'utf8');
  assert.match(guidance, /kontrolki Motion/);
  assert.match(guidance, /istniejącego runtime Motion/);
  assert.match(guidance, /JavaScriptu i reduced-motion pozostawiają treść dostępną/);
  assert.match(guidance, /nie usuwa niezależnego stanu hover lub `focus-within`/);
  assert.doesNotMatch(guidance, /kontrakt nie wystawia kontrolek ruchu|Kontrakt nie zna wejść/);
});

test('compiler lowers a safe hover lift only after the numeric control survives normalization', () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const specFile = path.join(dir, 'spec.json');
  const layoutFile = path.join(dir, 'layout.json');
  const reportFile = path.join(dir, 'report.json');
  fs.writeFileSync(specFile, JSON.stringify({
    kind: 'monteby-reference-spec',
    contentWidth: 1100,
    sections: [{
      style: { rect: { w: 1440, h: 400 }, background: '#ffffff', position: 'sticky', top: '8px' },
      children: [{
        role: 'box',
        style: { rect: { w: 1400, h: 180 }, position: 'sticky', top: '12px' },
        children: [],
        motion: {
          states: [{ state: 'hover', declarations: { transform: 'translateY(-4px)' } }],
        },
      }],
    }],
  }), 'utf8');

  execFileSync(process.execPath, [
    path.join(SCRIPTS, 'spec-to-layout.mjs'),
    '--contract', contract,
    '--spec', specFile,
    '--out', layoutFile,
    '--report', reportFile,
  ], { encoding: 'utf8' });

  const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
  const container = Object.values(layout).find((node) => node.type?.resolvedName === 'Container');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  assert.equal(container.props.hoverTranslateY, -4);
  assert.equal(container.props.sticky, true);
  assert.equal(container.props.stickyTop, '12px');
  assert.equal(report.motion.states, 0);
  assert.deepEqual(report.motion.entries, []);
  assert.ok(report.issues.some((issue) => issue.path === 's0' && issue.target === 'child-theme' && /sticky/.test(issue.issue)));
});

test('compiler pins typography and keeps marker rows from stacking', async () => {
  const source = fs.readFileSync(path.join(SCRIPTS, 'spec-to-layout.mjs'), 'utf8');
  // R1: renderer nakłada płynny clamp bez jawnych wariantów — kompilator przypina rozmiary
  assert.match(source, /fontSizeTablet: px\(t\.fontSize\)/);
  assert.match(source, /fontSizeMobile: px\(t\.fontSize\)/);
  // R2: wąski pierwszy track (znacznik/plakietka) zostaje flexem i nie składa się na tablecie
  assert.match(source, /widths\[0\] <= 60\) return \{ marker/);
  assert.match(source, /noStack: percent <= 25/);
  // R3: tekst ze zmierzoną miarą dostaje Container maxWidth
  assert.match(source, /st\.maxWidth && st\.rect/);
});


test('compiler guarantees section gutters and runbook documents narrow-capture artifact', () => {
  const source = fs.readFileSync(path.join(SCRIPTS, 'spec-to-layout.mjs'), 'utf8');
  // F1: brak zmierzonego bocznego paddingu nie oznacza pełnego bleedu treści
  assert.match(source, /UNMEASURED_CONTENT_SECTION_DEFAULTS\.innerPaddingXTablet/);
  assert.match(source, /UNMEASURED_CONTENT_SECTION_DEFAULTS\.innerPaddingXMobile/);
  assert.match(source, /isDecorBand/);
  const runbook = fs.readFileSync(path.join(REFERENCES, 'quick-start-runbook.md'), 'utf8');
  assert.match(runbook, /minimum window width/);
  assert.match(runbook, /iframe harness|fixed-width iframe/);
  assert.match(runbook, /Motion verification requires a real browser/);
  assert.match(runbook, /report\s+motion QA as blocked/);
  assert.match(runbook, /invoke the canonical client with `node`/);
  assert.match(runbook, /Do not switch it to `npx\.cmd`, `shell: true`/);
  assert.match(runbook, /Git Bash only[\s\S]*MSYS_NO_PATHCONV=1/);
  assert.match(runbook, /do not export it for the session/);
});

test('responsive guidance separates measurement, layout sheets, and WPMenu behavior', () => {
  const protocol = fs.readFileSync(path.join(REFERENCES, 'mechanical-workflow-protocol.md'), 'utf8');

  assert.match(protocol, /desktop:1440x1200/);
  assert.match(protocol, /tablet:834x1112/);
  assert.match(protocol, /mobile:390x844/);
  assert.match(protocol, /at and below \*\*900px\*\*/);
  assert.match(protocol, /at and below \*\*767px\*\*/);
  assert.match(protocol, /`WPMenu\.mobileBreakpoint` is an independent component behavior/);
  assert.match(protocol, /`sm` 640, `md` 768,[\s\S]*`2xl` 1536/);
});

test('kit surfaces silent snaps and renderer traps discovered by the 10-agent audit', async () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const { Kit } = await import(path.join(SCRIPTS, 'layout-kit.mjs'));
  const kit = await Kit.fromContract(contract);

  // B: docięcie do kroku kontrolki musi zostawić ślad w uwagach
  kit.heading('T', { tag: 'h2', fontSize: '36px', lineHeight: '1.25' });
  assert.ok(
    kit.notes.some((n) => /dociągnięte do kroku/.test(n) && /1\.25/.test(n)),
    'snap wartości jest raportowany'
  );

  // C: rozmiar od 30px bez wariantów responsywnych
  assert.ok(
    kit.notes.some((n) => /clamp\(\)/.test(n)),
    'próg clamp jest raportowany'
  );

  // H: brak lineHeight dziedziczy interlinię motywu
  const k2 = await Kit.fromContract(contract);
  k2.heading('x', { tag: 'h2', fontSize: '19px' });
  assert.ok(
    k2.notes.some((n) => /bez lineHeight/.test(n)),
    'brak interlinii jest raportowany'
  );

  // D: komponent bez wariantów responsywnych mówi to wprost
  assert.throws(
    () => k2.button('x', '#', { fontSizeTablet: '14px' }),
    /nie wystawia wariantu responsywnego/,
    'ButtonBlock tłumaczy brak wariantu zamiast ogólnego „prop spoza kontraktu”'
  );
});

test('brief mode is routed, scoped and documented', () => {
  const skill = fs.readFileSync(path.join(REPO, 'monteby-site-authoring', 'SKILL.md'), 'utf8');
  const brief = fs.readFileSync(path.join(REFERENCES, 'brief-to-monteby.md'), 'utf8');
  const html = fs.readFileSync(path.join(REFERENCES, 'html-to-monteby.md'), 'utf8');

  // A: tryb istnieje w routerze i ma własną referencję
  assert.match(skill, /\| `content-brief-authoring` \|/);
  assert.match(skill, /references\/brief-to-monteby\.md/);
  // A: zakaz ręcznego buildera ograniczony do trybu z referencją
  assert.match(skill, /applies only in `owned-html-reconstruction`/);
  assert.match(html, /applies only in `owned-html-reconstruction`/);

  // I: artefakty per strona
  assert.match(brief, /payload-<slug>\.json/);
  assert.match(brief, /wyścig/);
  // spójność między stronami serwisu
  assert.match(brief, /lineHeight` na każdym[\s\S]*typographyPreset/);
  assert.match(brief, /heightTablet`\/`heightMobile/);
  assert.match(brief, /wielokrotnością liczby kolumn/);
  // uwagi kitu jako bramka
  assert.match(brief, /Uwagi kitu są bramką/);

  // C/G/H/J/K w tablicy wiedzy
  assert.match(html, /Fluid font size/);
  assert.match(html, /Interlinia dziedziczona z motywu/);
  assert.match(html, /height: auto` dla obrazów poniżej 768px/);
  assert.match(html, /Siatka hairline z nieparzystą liczbą kafli/);
  assert.match(html, /Local validation never replaces live\s+`\/validate`/);
  assert.match(html, /type-compatible token references/);
  assert.match(html, /`boxShadowLayers`/);
  assert.match(html, /`resolvedDesignProfile`[\s\S]*`typographyPreset`/);
  assert.doesNotMatch(html, /nikt tego nie waliduje|Ustaw `lineHeight` na każdym węźle/);
});
