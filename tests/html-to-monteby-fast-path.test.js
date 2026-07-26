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

test('fast-path guidance documents the residual escalation order', () => {
  const skill = fs.readFileSync(path.join(REPO, 'monteby-site-authoring', 'SKILL.md'), 'utf8');
  const runbook = fs.readFileSync(path.join(REFERENCES, 'quick-start-runbook.md'), 'utf8');
  const residuals = fs.readFileSync(path.join(REFERENCES, 'child-theme-residual-styles.md'), 'utf8');

  for (const needle of [
    'quick-start-runbook.md',
    'html-to-monteby.md',
    'layout-kit.mjs',
    'normalize-layout.js',
    'compare-geometry.js',
    'audit-reference-css.mjs',
    'emit-child-theme-css.mjs',
  ]) {
    assert.match(skill, new RegExp(needle.replace('.', '\\.')), `SKILL.md wskazuje ${needle}`);
  }

  assert.match(skill, /generated.*child-theme stylesheet|child-theme stylesheet.*carry the remainder/s);
  assert.match(runbook, /Krok 9 — Residua/);
  assert.match(runbook, /emit-child-theme-css\.mjs/);
  assert.match(residuals, /rebuild-as-node|odtwórz zwykłym Containerem/);
  assert.match(residuals, /monteby-widget-development/);
  assert.match(residuals, /regeneruj|Po \*\*każdym\*\*|po każdym zapisie/i);
});
