'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  applySemanticMotionPlan,
  auditMotionLayout,
  buildResolvedMotionProfile,
  motionSignature,
} = require('../monteby-site-authoring/scripts/motion-contract');
const { buildResolvedDesignProfile } = require('../monteby-site-authoring/scripts/resolved-design-profile');
const { validateCanonicalMotionEvidence } = require('../monteby-site-authoring/scripts/run-canonical-verification');
const { renderedLayoutCaptureScript } = require('../monteby-site-authoring/scripts/capture-template-reference');

function control(prop, type, extra = {}) {
  return { prop, type, ...extra };
}

function component(name, controls, extra = {}) {
  const props = controls.map((entry) => entry.prop);
  return { name, props, aiProps: [...props], controls, ...extra };
}

function contract() {
  return {
    components: [
      component('Section', [
        control('motionPreset', 'select', { options: ['none', 'slide'] }),
        control('motionDirection', 'select', { options: ['up', 'down'] }),
        control('motionDuration', 'number', { min: 0, max: 2000, step: 50 }),
        control('motionStagger', 'number', { min: 0, max: 400, step: 10 }),
        control('motionRepeat', 'select', { options: ['once', 'repeat'] }),
      ], { isCanvas: true }),
      component('ButtonBlock', [
        control('pointerEffect', 'select', { options: ['none', 'magnetic'] }),
        control('pointerStrength', 'number', { min: 1, max: 40, step: 1 }),
        control('autoplay', 'toggle'),
      ]),
      component('Navbar', [control('motionPreset', 'select', { options: ['none', 'slide'] })]),
    ],
    authoring: {
      capabilities: { motionRecipes: true },
      motion: {
        version: 1,
        policy: {
          maxEntranceOwnersPerPage: 2,
          maxFirstViewportEntranceOwners: 1,
          maxPointerEffectsPerPage: 1,
          maxPinnedScenesPerPage: 0,
          maxBackgroundEffectsPerPage: 1,
          maxStaggerSpanMs: 300,
          maxEntranceDurationMs: 700,
          maxEntranceDelayMs: 150,
          maxEntranceDistancePx: 32,
          forbiddenComponents: ['Navbar'],
        },
        recipes: [
          {
            id: 'hero-reveal',
            intent: 'sequence',
            components: ['Section'],
            props: {
              motionPreset: 'slide',
              motionDirection: 'up',
              motionDuration: 600,
              motionStagger: 100,
              motionRepeat: 'once',
            },
          },
          {
            id: 'magnetic-cta',
            intent: 'pointer',
            components: ['ButtonBlock'],
            props: { pointerEffect: 'magnetic', pointerStrength: 12 },
          },
          {
            id: 'invalid-missing-control',
            intent: 'reveal',
            components: ['Section'],
            props: { inventedMotionProp: true },
          },
        ],
      },
    },
  };
}

function layout() {
  return {
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['section-1'] },
    'section-1': { type: { resolvedName: 'Section' }, isCanvas: true, props: {}, parent: 'ROOT', nodes: ['button-1', 'button-2'] },
    'button-1': { type: { resolvedName: 'ButtonBlock' }, isCanvas: false, props: {}, parent: 'section-1', nodes: [] },
    'button-2': { type: { resolvedName: 'ButtonBlock' }, isCanvas: false, props: {}, parent: 'section-1', nodes: [] },
  };
}

test('resolved motion profile accepts only recipes that round-trip through live controls', () => {
  const resolved = buildResolvedMotionProfile(contract());
  assert.equal(resolved.available, true);
  assert.deepEqual(resolved.recipes.map((recipe) => recipe.id), ['hero-reveal', 'magnetic-cta']);
  assert.equal(resolved.rejectedRecipes[0].id, 'invalid-missing-control');
  assert.match(resolved.rejectedRecipes[0].reasons[0], /live authoring control unavailable/);
  const designProfileMotion = buildResolvedDesignProfile(contract()).motion;
  assert.deepEqual(designProfileMotion.recipes.map((recipe) => recipe.id), ['hero-reveal', 'magnetic-cta']);
  assert.equal(designProfileMotion.policy.maxPointerEffectsPerPage, 1);
  const unavailable = contract();
  unavailable.authoring.capabilities.motionRecipes = false;
  assert.equal(buildResolvedMotionProfile(unavailable).fallback, 'no-generated-motion');

  const malicious = contract();
  malicious.components[0].props.push('runtimeOnlyMotion');
  malicious.components[0].controls.push(control('runtimeOnlyMotion', 'toggle'));
  malicious.authoring.motion.recipes.push({
    id: 'runtime-only-bypass',
    intent: 'reveal',
    components: ['Section'],
    props: { runtimeOnlyMotion: true },
  });
  assert.equal(
    buildResolvedMotionProfile(malicious).rejectedRecipes.some((recipe) => (
      recipe.id === 'runtime-only-bypass'
      && recipe.reasons.some((reason) => reason.includes('live authoring control unavailable'))
    )),
    true
  );
});

test('semantic motion plan is deterministic, source-bound, and uses exact live recipe props', () => {
  const nodeMap = layout();
  const profile = buildResolvedMotionProfile(contract());
  const plan = {
    version: 1,
    source: 'explicit-brief',
    requests: [{
      recipeId: 'magnetic-cta',
      intent: 'pointer',
      firstViewport: true,
      target: { component: 'ButtonBlock', occurrence: 1 },
    }],
  };
  const first = applySemanticMotionPlan(nodeMap, profile, plan);
  assert.deepEqual(first.rejected, []);
  assert.equal(first.applied[0].nodeId, 'button-2');
  assert.deepEqual(nodeMap['button-2'].props, { pointerEffect: 'magnetic', pointerStrength: 12 });
  assert.deepEqual(motionSignature(nodeMap, profile), [{
    nodeId: 'button-2',
    component: 'ButtonBlock',
    props: { pointerEffect: 'magnetic', pointerStrength: 12 },
  }]);

  const secondLayout = layout();
  const second = applySemanticMotionPlan(secondLayout, profile, plan);
  assert.deepEqual(second, first);
  assert.deepEqual(secondLayout, nodeMap);
});

test('layout kit applies only an explicit semantic plan through the resolved live profile', async () => {
  const { Kit } = await import('../monteby-site-authoring/scripts/layout-kit.mjs');
  const kit = new Kit(contract());
  const first = kit.node('ButtonBlock');
  const second = kit.node('ButtonBlock');
  const section = kit.node('Section', {}, [first, second]);
  const nodeMap = kit.build([section], {
    version: 1,
    source: 'explicit-brief',
    requests: [{
      recipeId: 'hero-reveal',
      intent: 'sequence',
      firstViewport: true,
      target: { component: 'Section', occurrence: 0 },
    }],
  });
  assert.equal(nodeMap[section].props.motionPreset, 'slide');
  assert.equal(kit.motionPlan.applied[0].recipeId, 'hero-reveal');
});

test('motion audit enforces stagger ownership, budgets, forbidden components, and autoplay off', () => {
  const profile = buildResolvedMotionProfile(contract());
  const nodeMap = layout();
  Object.assign(nodeMap['section-1'].props, profile.recipeById.get('hero-reveal').props);
  Object.assign(nodeMap['button-1'].props, profile.recipeById.get('magnetic-cta').props, { autoplay: true });
  Object.assign(nodeMap['button-2'].props, profile.recipeById.get('magnetic-cta').props);
  nodeMap.ROOT.nodes.push('nav-1');
  nodeMap['nav-1'] = {
    type: { resolvedName: 'Navbar' }, isCanvas: false, parent: 'ROOT', nodes: [], props: { motionPreset: 'slide' },
  };

  const result = auditMotionLayout(nodeMap, profile);
  const codes = new Set(result.errors.map((entry) => entry.code));
  assert.equal(result.ok, false);
  assert.equal(codes.has('motion_autoplay_enabled'), true);
  assert.equal(codes.has('motion_parent_child_conflict'), true);
  assert.equal(codes.has('motion_pointer_budget_exceeded'), true);
  assert.equal(codes.has('motion_forbidden_component'), true);
});

test('legacy autoplay without a claimed motion recipe remains compatible and unmodified', () => {
  const profile = buildResolvedMotionProfile(contract());
  const nodeMap = layout();
  nodeMap['button-1'].props.autoplay = true;
  const before = JSON.stringify(nodeMap);
  const result = auditMotionLayout(nodeMap, profile);
  assert.equal(result.errors.some((entry) => entry.code === 'motion_autoplay_enabled'), false);
  assert.equal(JSON.stringify(nodeMap), before);
});

test('semantic slider motion never preserves an existing autoplay setting', () => {
  const live = contract();
  live.components.push(component('SliderBlock', [
    control('transitionPreset', 'select', { options: ['none', 'slide'] }),
    control('autoplay', 'toggle'),
  ]));
  live.authoring.motion.recipes.push({
    id: 'slider-slide',
    intent: 'slider',
    components: ['SliderBlock'],
    props: { transitionPreset: 'slide' },
  });
  const profile = buildResolvedMotionProfile(live);
  const nodeMap = layout();
  nodeMap['section-1'].nodes.push('slider-1');
  nodeMap['slider-1'] = {
    type: { resolvedName: 'SliderBlock' },
    isCanvas: false,
    props: { autoplay: true },
    parent: 'section-1',
    nodes: [],
  };
  const before = JSON.stringify(nodeMap);
  const result = applySemanticMotionPlan(nodeMap, profile, {
    version: 1,
    source: 'explicit-brief',
    requests: [{
      recipeId: 'slider-slide',
      intent: 'slider',
      firstViewport: true,
      target: { nodeId: 'slider-1' },
    }],
  });

  assert.equal(result.applied.length, 0);
  assert.equal(result.rejected.some((entry) => entry.code === 'motion_autoplay_enabled'), true);
  assert.equal(JSON.stringify(nodeMap), before);
});

test('motion audit reads entrance and background bounds from the live policy', () => {
  const live = contract();
  live.components[0].props.push('motionDelay', 'motionDistance', 'backgroundMotion');
  live.components[0].aiProps.push('motionDelay', 'motionDistance', 'backgroundMotion');
  live.components[0].controls.push(
    control('motionDelay', 'number', { min: 0, max: 1000, step: 10 }),
    control('motionDistance', 'number', { min: 0, max: 100, step: 1 }),
    control('backgroundMotion', 'select', { options: ['none', 'zoom-in'] })
  );
  live.authoring.motion.recipes[0].props.motionDuration = 800;
  live.authoring.motion.recipes[0].props.motionDelay = 160;
  live.authoring.motion.recipes[0].props.motionDistance = 33;
  live.authoring.motion.recipes.push({
    id: 'background-zoom',
    intent: 'background',
    components: ['Section'],
    props: { backgroundMotion: 'zoom-in' },
  });
  const profile = buildResolvedMotionProfile(live);
  const nodeMap = layout();
  Object.assign(nodeMap['section-1'].props, profile.recipeById.get('hero-reveal').props);
  const entranceCodes = new Set(auditMotionLayout(nodeMap, profile).errors.map((entry) => entry.code));
  assert.equal(entranceCodes.has('motion_entrance_duration_exceeded'), true);
  assert.equal(entranceCodes.has('motion_entrance_delay_exceeded'), true);
  assert.equal(entranceCodes.has('motion_entrance_distance_exceeded'), true);

  nodeMap['section-1'].props = { backgroundMotion: 'zoom-in' };
  nodeMap.ROOT.nodes.push('section-2');
  nodeMap['section-2'] = {
    type: { resolvedName: 'Section' }, isCanvas: true, props: { backgroundMotion: 'zoom-in' }, parent: 'ROOT', nodes: [],
  };
  assert.equal(
    auditMotionLayout(nodeMap, profile).errors.some((entry) => entry.code === 'motion_background_budget_exceeded'),
    true
  );
});

test('normalizer and clean-layout audit both enforce the shared live motion policy', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-motion-audit-'));
  const contractFile = path.join(directory, 'contract.json');
  const layoutFile = path.join(directory, 'layout.json');
  const nodeMap = layout();
  const profile = buildResolvedMotionProfile(contract());
  Object.assign(nodeMap['button-1'].props, profile.recipeById.get('magnetic-cta').props);
  Object.assign(nodeMap['button-2'].props, profile.recipeById.get('magnetic-cta').props);
  fs.writeFileSync(contractFile, JSON.stringify(contract()));
  fs.writeFileSync(layoutFile, JSON.stringify(nodeMap));
  for (const script of ['normalize-layout.js', 'audit-monteby-layout.js']) {
    const result = spawnSync(process.execPath, [
      path.join(__dirname, '..', 'monteby-site-authoring', 'scripts', script),
      '--contract', contractFile,
      '--layout', layoutFile,
      '--json',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 1, `${script}: ${result.stderr || result.stdout}`);
    const report = JSON.parse(result.stdout);
    const findings = script === 'normalize-layout.js' ? report.errors : report.errors;
    assert.equal(findings.some((entry) => entry.code === 'motion_pointer_budget_exceeded'), true, script);
  }
});

test('canonical verifier requires normalized reduced/no-JS/coarse/input evidence only for claimed motion', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-motion-contract-'));
  const contractFile = path.join(directory, 'contract.json');
  const layoutFile = path.join(directory, 'layout.json');
  const nodeMap = layout();
  const profile = buildResolvedMotionProfile(contract());
  Object.assign(nodeMap['button-1'].props, profile.recipeById.get('magnetic-cta').props);
  fs.writeFileSync(contractFile, JSON.stringify(contract()));
  fs.writeFileSync(layoutFile, JSON.stringify(nodeMap));
  const iteration = { files: { contract: contractFile, layout: layoutFile } };
  const viewportEvidence = (label) => ({
    label,
    schemaVersion: 1,
    normalized: true,
    owners: [{ kind: 'pointer' }],
    checks: {
      reducedMotionStatic: true,
      noJavaScriptStatic: true,
      coarsePointerStatic: true,
      keyboardOperable: true,
      wheelInterception: false,
    },
  });
  const manifest = {
    motionEvidence: {
      viewports: ['desktop', 'tablet', 'mobile'].map(viewportEvidence),
    },
  };
  assert.deepEqual(validateCanonicalMotionEvidence(iteration, manifest), []);
  manifest.motionEvidence.viewports[2].checks.reducedMotionStatic = false;
  assert.equal(
    validateCanonicalMotionEvidence(iteration, manifest).some((entry) => entry.code === 'canonical_motion_reduced_motion_static_failed'),
    true
  );
});

test('browser capture records normalized motion owners and explicit fallback/input probes', () => {
  const source = renderedLayoutCaptureScript();
  for (const evidence of [
    'data-gw-motion',
    'data-gw-section-sticky',
    'data-monteby-background-parallax',
    'data-monteby-pointer-effect',
    'reducedMotionStatic',
    'noJavaScriptStatic',
    'coarsePointerStatic',
    'keyboardOperable',
    'wheelInterception',
  ]) {
    assert.match(source, new RegExp(evidence));
  }
});
