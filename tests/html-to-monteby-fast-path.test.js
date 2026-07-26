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
      props: ['background', 'backgroundType', 'backgroundImage', 'paddingTop', 'layoutDisplay', 'gap', 'innerMaxWidth', 'innerPaddingX'],
      controls: [
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
      props: ['borderWidth', 'borderTopWidth', 'borderTopColor', 'flexGrow', 'width'],
      controls: [
        { type: 'number', props: ['flexGrow'], step: 1, min: 0, max: 12 },
        { type: 'css-value', props: ['width'], units: ['px'] },
      ],
    },
    {
      name: 'Heading',
      isCanvas: false,
      allowedParents: ['Section', 'Container'],
      props: ['text', 'tag', 'fontSize', 'lineHeight', 'marginTop', 'textTransform'],
      controls: [
        { type: 'css-value', props: ['fontSize'], step: 1, units: ['px'] },
        { type: 'css-value', props: ['lineHeight'], step: 0.1, units: [''] },
        { type: 'segment', props: ['textTransform'], options: ['', 'uppercase', 'lowercase'] },
      ],
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

test('spec-to-layout compiles a measured spec into a valid scaffold with a report', () => {
  const dir = tempDir();
  const contract = writeContract(dir);
  const spec = {
    kind: 'monteby-reference-spec',
    version: 2,
    viewport: 1440,
    pageHeight: 2000,
    contentWidth: 1280,
    sections: [
      {
        role: 'box', tag: 'section', index: 0,
        style: { rect: { x: 0, y: 0, w: 1440, h: 900 }, background: 'rgb(10, 11, 13)', borderWidth: [0, 0, 1, 0], borderColor: 'rgb(51,57,68)' },
        children: [
          {
            role: 'box', tag: 'div',
            style: { rect: { x: 80, y: 0, w: 1280, h: 900 }, maxWidth: 1280, padding: [104, 56, 84, 56], display: 'grid', gridTemplateColumns: '694.5px 513.4px', gap: [72] },
            children: [
              { role: 'heading', tag: 'h1', style: { rect: { x: 80, y: 104, w: 694, h: 246 }, margin: [0, 0, 26, 0] },
                text: 'Tytuł', typography: { fontSize: 78, fontWeight: '800', fontFamily: 'Archivo', lineHeight: 1.05, color: 'rgb(244, 242, 238)', fontVariationSettings: '"wdth" 108' } },
              { role: 'box', tag: 'div', style: { rect: { x: 80, y: 400, w: 694, h: 60 }, display: 'flex', flexDirection: 'row', gap: [14] },
                children: [
                  { role: 'button', tag: 'a', href: '#kontakt', text: 'Kontakt',
                    style: { rect: { x: 80, y: 400, w: 200, h: 60 }, background: 'rgb(255, 190, 0)', padding: [16, 28, 16, 28] },
                    typography: { fontSize: 15, fontWeight: '700', fontFamily: 'Archivo', lineHeight: 1, color: 'rgb(10, 11, 13)' } },
                ] },
            ],
          },
        ],
      },
    ],
  };
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify(spec), 'utf8');
  const out = path.join(dir, 'layout.json');
  const reportFile = path.join(dir, 'report.json');

  execFileSync(
    process.execPath,
    [path.join(SCRIPTS, 'spec-to-layout.mjs'), '--contract', contract, '--spec', specFile, '--out', out, '--report', reportFile],
    { encoding: 'utf8' }
  );

  const map = JSON.parse(fs.readFileSync(out, 'utf8'));
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

  const section = Object.values(map).find((n) => n.type.resolvedName === 'Section');
  assert.ok(section, 'sekcja istnieje');
  assert.equal(section.props.innerMaxWidth, '1280px', 'wrapper podniesiony do innerMaxWidth');
  assert.equal(section.props.paddingTop, '104px', 'pionowy padding wrappera przeniesiony na sekcję');
  assert.equal(section.props.gridTemplateColumns, undefined, 'brak tokenu grid w minimalnym kontrakcie — raport zamiast wyjątku');

  assert.ok(
    report.issues.some((i) => i.target === 'dropped-prop' && /borderBottomWidth/.test(i.issue)),
    'obramowanie sekcji odrzucone z raportem'
  );
  assert.ok(
    report.issues.some((i) => i.target === 'child-theme' && /font-variation-settings/.test(i.issue)),
    'oś fontu zmiennego zgłoszona do arkusza'
  );

  const heading = Object.values(map).find((n) => n.type.resolvedName === 'Heading');
  assert.equal(heading.props.text, 'Tytuł');
  assert.equal(heading.props.marginTop, '0px', 'kit wyzerował margines górny');
});

test('extract-reference-spec emits a browser snippet with role classification', () => {
  const snippet = execFileSync(
    process.execPath,
    [path.join(SCRIPTS, 'extract-reference-spec.mjs'), '--emit-snippet'],
    { encoding: 'utf8' }
  );
  assert.match(snippet, /monteby-reference-spec/);
  assert.match(snippet, /fontVariationSettings/);
  assert.match(snippet, /gridTemplateColumns/);
  // rząd samych odnośników nie może wpaść do roli text
  assert.match(snippet, /actionable/);
  // pasy strony zbierane z children main, nie tylko <section>
  assert.match(snippet, /function bands\(/);
});
