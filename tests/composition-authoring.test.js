'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const script = path.resolve(__dirname, '../monteby-site-authoring/scripts/layout-kit.mjs');
const modulePromise = import(script);

function contract() {
  const heading = { component: 'Heading', typographyRole: 'h1', props: { tag: 'h1' }, slotProps: { text: 'title' } };
  return {
    components: [
      { name: 'Section', isCanvas: true, props: ['background'], allowedParents: ['ROOT'] },
      { name: 'Container', isCanvas: true, props: [], allowedParents: ['Section', 'Container'] },
      { name: 'Heading', props: ['text', 'tag', 'typographyPreset', 'marginTop'], allowedParents: ['Section', 'Container'] },
      { name: 'Text', props: ['text', 'marginTop'], allowedParents: ['Section', 'Container'] },
      { name: 'ImageBlock', props: ['src', 'alt', 'aspectRatio'], allowedParents: ['Section', 'Container'] },
      { name: 'ButtonBlock', props: ['href', 'label'], allowedParents: ['Section', 'Container'] },
    ],
    globalStyles: { colors: { paper: '#fff' }, typography: { presets: { h1: { lineHeight: '1.1' } } } },
    authoring: { blockedProps: ['className'], compositions: { version: 1, recipes: [{
      id: 'fixture-composition', label: 'Composition fixture',
      slots: { title: { type: 'text', required: true }, body: { type: 'text' }, media: { type: 'media', required: true }, cta: { type: 'link' }, items: { type: 'items', maxItems: 8, itemSlots: { title: { type: 'text', required: true } } } },
      tree: { component: 'Section', tokenProps: { background: 'colors.paper' }, children: [heading,
        { component: 'Text', optionalWhen: 'body', slotProps: { text: 'body' } },
        { component: 'ImageBlock', props: { aspectRatio: '16/9' }, slotProps: { src: 'media.src', alt: 'media.alt' } },
        { component: 'ButtonBlock', optionalWhen: 'cta', slotProps: { href: 'cta.href', label: 'cta.label' } },
        { component: 'Container', optionalWhen: 'items', repeat: 'items', children: [{ component: 'Text', slotProps: { text: 'item.title' } }] },
      ] },
    }] } },
  };
}
function plan() {
  return { version: 1, sections: [{ compositionId: 'fixture-composition', content: { title: 'Exact supplied title', media: { src: '/photo.webp', alt: '' } } }] };
}

test('composition expansion is deterministic, preserves text and tokens and omits absent slots', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const source = plan();
  source.sections[0].content.items = [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }];
  const result = expandCompositionPlan(contract(), source);
  assert.deepEqual(result, expandCompositionPlan(contract(), source));
  const nodes = Object.values(result.layout);
  assert.equal(nodes.filter((node) => node.type.resolvedName === 'Container').length, 3);
  assert.equal(nodes.some((node) => node.props.text === 'Exact supplied title'), true);
  assert.equal(nodes.find((node) => node.type.resolvedName === 'Section').props.background, 'var(--gcb-color-paper)');
  assert.equal(nodes.find((node) => node.type.resolvedName === 'ImageBlock').props.alt, '');
  assert.equal(nodes.some((node) => node.type.resolvedName === 'ButtonBlock'), false);
  assert.equal(result.notes.some((note) => note.includes('Heading bez lineHeight')), false);
  assert.doesNotMatch(JSON.stringify(result.layout), /compositionId|tokenProps|slotProps|typographyRole/);
});

test('composition rejects malformed plan, unavailable recipes, content, URL and budget violations', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const cases = [
    (p) => { p.customCSS = 'bad'; },
    (p) => { p.sections[0].props = {}; },
    (p) => { p.sections[0].compositionId = 'missing'; },
    (p) => { delete p.sections[0].content.title; },
    (p) => { p.sections[0].content.unknown = 'bad'; },
    (p) => { p.sections[0].content.title = ' '; },
    (p) => { p.sections[0].content.media.src = 'javascript:alert(1)'; },
    (p) => { p.sections[0].content.media.src = '//other.test/a.png'; },
    (p) => { p.sections[0].content.media.src = 'https://user:pass@host.test/a.png'; },
    (p) => { delete p.sections[0].content.media.alt; },
    (p) => { p.sections[0].content.cta = { label: 'Go', href: 'java\nscript:alert(1)' }; },
    (p) => { p.sections[0].content.items = Array.from({ length: 9 }, () => ({ title: 'Extra' })); },
    (p) => { p.sections.push(structuredClone(p.sections[0])); },
    (p) => { p.sections = Array.from({ length: 21 }, () => structuredClone(p.sections[0])); },
  ];
  for (const mutate of cases) {
    const source = plan(); mutate(source);
    assert.throws(() => expandCompositionPlan(contract(), source));
  }
});

test('composition recipes cannot bypass live controls, placement, bindings or recursion limits', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const cases = [
    (c, tree) => { tree.tokenProps.background = 'colors.missing'; },
    (c, tree) => { tree.props = { className: 'hidden-style' }; },
    (c, tree) => { tree.props = { background: '#fff' }; },
    (c, tree) => { tree.children[0].slotProps.text = '__proto__.title'; },
    (c, tree) => { tree.children[0].slotProps.text = 'title.bad'; },
    (c, tree) => { tree.children[0].props.unpublished = 1; },
    (c, tree) => { tree.children.push(tree); },
    (c, tree) => { tree.children[0].typographyRole = 'arbitrary'; },
    (c, tree) => { tree.children[0].optionalWhen = 'typo'; },
    (c, tree) => { tree.children[0].children = [{ component: 'Text', props: { text: 'wrong parent' } }]; },
    (c) => { delete c.components; },
  ];
  for (const mutate of cases) {
    const current = contract(); mutate(current, current.authoring.compositions.recipes[0].tree);
    assert.throws(() => expandCompositionPlan(current, plan()));
  }
});

test('composition CLI emits plain node map and diagnostic report, leaves output absent on rejection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-composition-'));
  try {
    const contractPath = path.join(directory, 'contract.json');
    const planPath = path.join(directory, 'plan.json');
    const out = path.join(directory, 'layout.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract()));
    fs.writeFileSync(planPath, JSON.stringify(plan()));
    const args = [script, '--contract', contractPath, '--plan', planPath, '--out', out];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).verdict, 'diagnostic_passed');
    assert.equal(JSON.parse(fs.readFileSync(out)).ROOT.nodes.length, 1);
    fs.unlinkSync(out);
    fs.writeFileSync(planPath, JSON.stringify({ version: 1, sections: [] }));
    assert.notEqual(spawnSync(process.execPath, args).status, 0);
    assert.equal(fs.existsSync(out), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('all bounded collection sizes preserve supplied rows without fabricated remainder nodes', async () => {
  const { expandCompositionPlan } = await modulePromise;
  for (const size of [1, 2, 3, 4, 5, 7, 8]) {
    const source = plan();
    source.sections[0].content.items = Array.from({ length: size }, (_, index) => ({ title: `Supplied row ${index}` }));
    const { layout } = expandCompositionPlan(contract(), source);
    const rows = Object.values(layout).filter((node) => node.type.resolvedName === 'Container');
    assert.equal(rows.length, size);
    assert.deepEqual(rows.map((row) => layout[row.nodes[0]].props.text), source.sections[0].content.items.map((item) => item.title));
  }
});

test('composition CLI preserves approved project tokens and refuses to overwrite inputs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-composition-tokens-'));
  try {
    const contractPath = path.join(directory, 'contract.json');
    const planPath = path.join(directory, 'plan.json');
    const tokensPath = path.join(directory, 'tokens.json');
    const out = path.join(directory, 'layout.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract()));
    fs.writeFileSync(planPath, JSON.stringify(plan()));
    fs.writeFileSync(tokensPath, JSON.stringify({ colors: { paper: '#123456' } }));
    const args = [script, '--contract', contractPath, '--plan', planPath, '--project-tokens', tokensPath, '--out'];
    const result = spawnSync(process.execPath, [...args, out], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const section = Object.values(JSON.parse(fs.readFileSync(out))).find((node) => node.type.resolvedName === 'Section');
    assert.equal(section.props.background, '#123456');
    const before = fs.readFileSync(planPath, 'utf8');
    assert.notEqual(spawnSync(process.execPath, [...args, planPath]).status, 0);
    assert.equal(fs.readFileSync(planPath, 'utf8'), before);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('long supplied content is preserved, while repair messages expose live bounds and choices', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const source = plan();
  const text = 'Długi opis. '.repeat(900);
  source.sections[0].content.body = text;
  const result = expandCompositionPlan(contract(), source);
  assert.ok(Object.values(result.layout).some((node) => node.props.text === text));
  source.sections[0].content.items = Array.from({ length: 9 }, () => ({ title: 'Row' }));
  assert.throws(() => expandCompositionPlan(contract(), source), /expected 0–8 items; received 9/);
  source.sections[0].compositionId = 'hero-guess';
  assert.throws(() => expandCompositionPlan(contract(), source), /choose fixture-composition/);
  source.sections[0].compositionId = 'fixture-composition';
  delete source.sections[0].content.items;
  source.sections[0].content.media.src = 'https:';
  assert.throws(() => expandCompositionPlan(contract(), source), /sections\[0\]\.content\.media: invalid URL/);
});

test('CLI rejects source aliases through symbolic and hard links without changing content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-composition-alias-'));
  try {
    const contractPath = path.join(directory, 'contract.json');
    const planPath = path.join(directory, 'plan.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract()));
    fs.writeFileSync(planPath, JSON.stringify(plan()));
    const before = fs.readFileSync(planPath, 'utf8');
    for (const link of ['symbolic', 'hard']) {
      const out = path.join(directory, `${link}.json`);
      if (link === 'symbolic') fs.symlinkSync(planPath, out);
      else fs.linkSync(planPath, out);
      const result = spawnSync(process.execPath, [script, '--contract', contractPath, '--plan', planPath, '--out', out], { encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /files must be distinct/);
      assert.equal(fs.readFileSync(planPath, 'utf8'), before);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('composition refuses rejected project tokens instead of silently substituting global defaults', async () => {
  const { expandCompositionPlan } = await modulePromise;
  for (const projectTokens of [[], null, 'tokens']) {
    assert.throws(() => expandCompositionPlan(contract(), plan(), { projectTokens }), /projectTokens/);
  }
  assert.throws(() => expandCompositionPlan(contract(), plan(), { projectTokens: { colors: { paper: 'url(https://example.test/secret)' } } }), /rejected values for colors.paper/);
});

function navigationFixture() {
  const current = contract();
  current.components[0].props.push('anchorId');
  current.components.push({
    name: 'Navbar', props: ['menuItems', 'ctaHref', 'ctaLabel'], allowedParents: ['Section'],
    controls: [{ type: 'repeater', props: ['menuItems'], minItems: 0, maxItems: 12,
      itemControls: [{ type: 'text', props: ['label'] }, { type: 'text', props: ['href'] }] },
    { type: 'text', props: ['ctaHref'] }, { type: 'text', props: ['ctaLabel'] }],
  });
  const recipe = current.authoring.compositions.recipes[0];
  recipe.slots.anchorId = { type: 'text' };
  recipe.slots.links = { type: 'items', required: true, minItems: 1, maxItems: 8,
    itemSlots: { label: { type: 'text', required: true }, href: { type: 'text', required: true } } };
  recipe.tree.slotProps = { anchorId: 'anchorId' };
  recipe.tree.children.unshift({ component: 'Navbar', slotProps: { menuItems: 'links', ctaHref: 'cta.href', ctaLabel: 'cta.label' } });
  const source = plan();
  source.sections[0].content.anchorId = 'details';
  source.sections[0].content.links = [{ label: 'Details', href: '#details' }, { label: 'Contact', href: 'mailto:hello@example.com' }];
  return { current, source, recipe, control: current.components.at(-1).controls[0] };
}

test('composition binds typed rows to live repeaters and resolves real navigation anchors without changing input', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const { current, source } = navigationFixture();
  const before = structuredClone(source);
  const result = expandCompositionPlan(current, source);
  const navbar = Object.values(result.layout).find((node) => node.type.resolvedName === 'Navbar');
  assert.deepEqual(navbar.props.menuItems, source.sections[0].content.links);
  assert.deepEqual(source, before);
  assert.equal(Object.values(result.layout).find((node) => node.type.resolvedName === 'Section').props.anchorId, 'details');
  assert.equal(result.notes.some((note) => note.includes('pomini')), false);
});

test('optional root slot bindings preserve old plans but never hide undeclared references', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const { current, source, recipe } = navigationFixture();
  delete source.sections[0].content.anchorId;
  source.sections[0].content.links = [{ label: 'Contact', href: 'mailto:hello@example.com' }];
  const result = expandCompositionPlan(current, source);
  assert.equal(Object.values(result.layout).some((node) => Object.hasOwn(node.props, 'anchorId')), false);
  recipe.tree.slotProps.anchorId = 'missing';
  assert.throws(() => expandCompositionPlan(current, source), /undeclared slot/);
});

test('typed repeater bindings reject incompatible controls, bounds, fields and unsafe links', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const cases = [
    ({ control }) => { control.type = 'text'; },
    ({ control }) => { delete control.itemControls; },
    ({ control }) => { control.itemControls.pop(); },
    ({ control }) => { control.itemControls[1].type = 'number'; },
    ({ control }) => { control.minItems = 2; },
    ({ control }) => { control.maxItems = 7; },
    ({ control }) => { control.maxItems = '12'; },
    ({ recipe, source }) => { recipe.slots.links.itemSlots.extra = { type: 'text' }; source.sections[0].content.links[0].extra = 'Hidden'; },
    ({ current }) => { current.authoring.blockedProps.push('href'); },
    ({ source }) => { source.sections[0].content.links[0].href = 'javascript:alert(1)'; },
    ({ source }) => { source.sections[0].content.links[0].href = 'java\nscript:alert(1)'; },
    ({ source }) => { source.sections[0].content.links[0].href = '//outside.example/path'; },
    ({ source }) => { source.sections[0].content.links[0].href = 'https://user:password@example.com/'; },
    ({ source }) => { source.sections[0].content.links[0].href = '#missing'; },
    ({ source }) => { source.sections[0].content.links[0].href = '#invalid%20anchor'; },
  ];
  for (const mutate of cases) {
    const fixture = navigationFixture(); mutate(fixture);
    assert.throws(() => expandCompositionPlan(fixture.current, fixture.source));
  }
});

test('navigation CTA must resolve one valid anchor just like the menu links', async () => {
  const { expandCompositionPlan } = await modulePromise;
  const { current, source } = navigationFixture();
  source.sections[0].content.cta = { label: 'Details', href: '#details' };
  assert.doesNotThrow(() => expandCompositionPlan(current, source));
  for (const href of ['#missing', '#invalid%20anchor', '#']) {
    source.sections[0].content.cta.href = href;
    assert.throws(() => expandCompositionPlan(current, source), /anchorId|kotwic/);
  }
});
