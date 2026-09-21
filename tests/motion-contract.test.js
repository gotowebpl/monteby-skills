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
  recipeForNode,
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
          defaultRepeat: 'once',
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
          prohibitedInputs: [],
          rules: [],
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

function canonicalMotionFixture(kind) {
  const definitions = {
    entrance: { component: 'MotionOwner', intent: 'reveal', prop: 'motionPreset', value: 'slide', options: ['none', 'slide'] },
    pointer: { component: 'MotionOwner', intent: 'pointer', prop: 'pointerEffect', value: 'magnetic', options: ['none', 'magnetic'] },
    scroll: { component: 'Section', intent: 'background', prop: 'backgroundParallax', value: 'subtle', options: ['none', 'subtle'] },
    pinned: { component: 'Section', intent: 'story', prop: 'sectionStickyScene', value: 'progress', options: ['off', 'progress'] },
    'state-change': { component: 'TabsBlock', intent: 'component', prop: 'transitionPreset', value: 'fade', options: ['none', 'fade'] },
    ambient: { component: 'Section', intent: 'background', prop: 'backgroundMotion', value: 'zoom-in', options: ['none', 'zoom-in'] },
  };
  const definition = definitions[kind];
  const liveContract = {
    components: [component(definition.component, [control(definition.prop, 'select', { options: definition.options })])],
    authoring: {
      capabilities: { motionRecipes: true },
      motion: {
        version: 1,
        policy: {
          defaultRepeat: 'once',
          maxEntranceOwnersPerPage: 2,
          maxFirstViewportEntranceOwners: 2,
          maxPointerEffectsPerPage: 2,
          maxPinnedScenesPerPage: 1,
          maxBackgroundEffectsPerPage: 2,
          maxStaggerSpanMs: 300,
          maxEntranceDurationMs: 700,
          maxEntranceDelayMs: 150,
          maxEntranceDistancePx: 32,
          forbiddenComponents: [],
          prohibitedInputs: [],
          rules: [],
        },
        recipes: [{
          id: `proof-${kind}`,
          intent: definition.intent,
          components: [definition.component],
          props: { [definition.prop]: definition.value },
        }],
      },
    },
  };
  return {
    contract: liveContract,
    layout: (() => {
      const children = kind === 'pinned' ? ['story-1', 'story-2', 'story-3'] : [];
      const props = {
        [definition.prop]: definition.value,
        ...(['ambient', 'scroll'].includes(kind)
          ? { backgroundMedia: 'image', backgroundImage: '/media/background.jpg' }
          : {}),
        ...(kind === 'state-change'
          ? { tabs: [{ label: 'One' }, { label: 'Two' }] }
          : {}),
      };
      return {
        ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['motion-owner'] },
        'motion-owner': {
          type: { resolvedName: definition.component },
          isCanvas: children.length > 0,
          props,
          parent: 'ROOT',
          nodes: children,
        },
        ...Object.fromEntries(children.map((nodeId) => [nodeId, {
          type: { resolvedName: 'Text' }, isCanvas: false, props: { text: nodeId }, parent: 'motion-owner', nodes: [],
        }])),
      };
    })(),
  };
}

function canonicalMotionViewportEvidence(label, kind, owners = [{
  nodeId: 'motion-owner', recipeId: `proof-${kind}`, passed: true,
}]) {
  return {
    label,
    schemaVersion: 1,
    normalized: true,
    owners: owners.map((owner) => ({
      nodeId: owner.nodeId,
      recipeId: owner.recipeId,
      kind,
      firstViewport: true,
    })),
    environments: {
      normalFinePointer: {
        status: 'passed',
        javaScript: true,
        reducedMotion: false,
        coarsePointer: false,
        keyboardIntercepted: false,
        wheelIntercepted: false,
        positiveByKind: {
          [kind]: {
            ownerCount: owners.length,
            attemptedCount: owners.length,
            passedCount: owners.filter((owner) => owner.passed).length,
            passed: owners.some((owner) => owner.passed),
            samples: owners.map((owner, index) => ({
              id: String(index + 1),
              nodeId: owner.nodeId,
              recipeId: owner.recipeId,
              kind,
              mechanism: `${kind}-proof`,
              passed: owner.passed,
            })),
          },
        },
        positiveByOwner: owners.map((owner, index) => ({
          probeId: String(index + 1),
          nodeId: owner.nodeId,
          recipeId: owner.recipeId,
          kind,
          attemptedCount: 1,
          passedCount: owner.passed ? 1 : 0,
          passed: owner.passed,
          samples: [{
            id: String(index + 1),
            nodeId: owner.nodeId,
            recipeId: owner.recipeId,
            kind,
            mechanism: `${kind}-proof`,
            passed: owner.passed,
          }],
        })),
      },
    },
    checks: {
      reducedMotionStatic: true,
      noJavaScriptStatic: true,
      coarsePointerStatic: true,
      keyboardOperable: true,
      wheelInterception: false,
    },
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

test('resolved motion profile accepts defaultless controls beside a partial value schema map', () => {
  const live = contract();
  live.components[0].defaults = { motionRepeat: 'once' };
  live.components[0].valueSchemas = {
    motionRepeat: { type: 'string', const: 'once' },
  };
  live.components[1].defaults = { pointerStrength: 14 };
  live.components[1].valueSchemas = {
    pointerStrength: { type: 'number', const: 14 },
  };

  const profile = buildResolvedMotionProfile(live);

  assert.deepEqual(profile.recipes.map((recipe) => recipe.id), ['hero-reveal', 'magnetic-cta']);
  assert.deepEqual(profile.rejectedRecipes.map((recipe) => recipe.id), ['invalid-missing-control']);
});

test('resolved motion profile fails closed for invalid policy semantics and published bounds', () => {
  for (const [prop, value] of [
    ['maxEntranceOwnersPerPage', 0],
    ['maxEntranceOwnersPerPage', 13],
    ['maxFirstViewportEntranceOwners', 7],
    ['maxBackgroundEffectsPerPage', 5],
    ['maxPointerEffectsPerPage', 7],
    ['maxPinnedScenesPerPage', 4],
    ['maxStaggerSpanMs', 2001],
    ['maxEntranceDelayMs', 2001],
    ['maxEntranceDurationMs', 99],
    ['maxEntranceDurationMs', 2001],
    ['maxEntranceDistancePx', 161],
  ]) {
    const invalid = contract();
    invalid.authoring.motion.policy[prop] = value;
    const profile = buildResolvedMotionProfile(invalid);
    assert.equal(profile.available, false, `${prop}=${value}`);
    assert.equal(profile.fallback, 'no-generated-motion', `${prop}=${value}`);
  }

  for (const [prop, value] of [
    ['defaultRepeat', 'repeat'],
    ['forbiddenComponents', null],
    ['prohibitedInputs', 'wheel'],
    ['rules', [42]],
  ]) {
    const invalid = contract();
    invalid.authoring.motion.policy[prop] = value;
    const profile = buildResolvedMotionProfile(invalid);
    assert.equal(profile.available, false, prop);
    assert.equal(profile.fallback, 'no-generated-motion', prop);
  }
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

test('motion audit requires one exact active recipe signature while tolerating neutral defaults', () => {
  const live = contract();
  live.components[0].props.push('backgroundMotion');
  live.components[0].aiProps.push('backgroundMotion');
  live.components[0].controls.push(control('backgroundMotion', 'select', { options: ['none', 'zoom-in'] }));
  live.authoring.motion.recipes.push({
    id: 'background-zoom',
    intent: 'background',
    components: ['Section'],
    props: { backgroundMotion: 'zoom-in' },
  });
  const profile = buildResolvedMotionProfile(live);
  const neutral = layout();
  Object.assign(neutral['section-1'].props, profile.recipeById.get('hero-reveal').props, {
    backgroundMotion: 'none',
  });
  assert.equal(
    auditMotionLayout(neutral, profile).errors.some((entry) => entry.code === 'motion_recipe_unmatched'),
    false
  );

  const mixed = layout();
  Object.assign(
    mixed['section-1'].props,
    profile.recipeById.get('hero-reveal').props,
    profile.recipeById.get('background-zoom').props,
    { backgroundMedia: 'image', backgroundImage: '/media/background.jpg' }
  );
  assert.equal(
    auditMotionLayout(mixed, profile).errors.some((entry) => entry.code === 'motion_recipe_unmatched'),
    true
  );

  const crossComponentMixed = layout();
  Object.assign(
    crossComponentMixed['section-1'].props,
    profile.recipeById.get('hero-reveal').props,
    { pointerEffect: 'magnetic' }
  );
  assert.equal(
    auditMotionLayout(crossComponentMixed, profile).errors
      .some((entry) => entry.code === 'motion_recipe_unmatched'),
    false,
    'a prop owned only by another component cannot corrupt this component motion signature'
  );
  assert.deepEqual(motionSignature(crossComponentMixed, profile), [{
    nodeId: 'section-1',
    component: 'Section',
    props: {
      motionPreset: 'slide',
      motionDirection: 'up',
      motionDuration: 600,
      motionStagger: 100,
      motionRepeat: 'once',
    },
  }]);

  const wrongOwner = layout();
  wrongOwner['section-1'].nodes.push('text-motion');
  wrongOwner['text-motion'] = {
    type: { resolvedName: 'Text' },
    isCanvas: false,
    props: { pointerEffect: 'magnetic', pointerStrength: 12 },
    parent: 'section-1',
    nodes: [],
  };
  assert.equal(
    auditMotionLayout(wrongOwner, profile).errors.some((entry) => entry.code === 'motion_recipe_unmatched'),
    false,
    'an unknown cross-component prop is left to the shared control validator instead of tainting motion identity'
  );
  assert.deepEqual(motionSignature(wrongOwner, profile), []);

  const advanced = contract();
  advanced.components[0].controls = advanced.components[0].controls.map((entry) => ({
    ...entry,
    section: 'Motion',
  }));
  advanced.components[0].props.push('motionBlur');
  advanced.components[0].aiProps.push('motionBlur');
  advanced.components[0].controls.push(control('motionBlur', 'toggle', { section: 'Motion' }));
  advanced.components[0].defaults = {
    motionPreset: 'none',
    motionDirection: 'up',
    motionDuration: 700,
    motionStagger: 0,
    motionRepeat: 'once',
    motionBlur: false,
  };
  const advancedProfile = buildResolvedMotionProfile(advanced);
  const defaultedProps = {
    ...advanced.components[0].defaults,
    ...advancedProfile.recipeById.get('hero-reveal').props,
  };
  assert.equal(
    recipeForNode(advancedProfile, 'Section', defaultedProps)?.id,
    'hero-reveal',
    'published component defaults must not invalidate an otherwise exact recipe'
  );
  const blurred = layout();
  Object.assign(blurred['section-1'].props, defaultedProps, {
    motionBlur: true,
  });
  const advancedAudit = auditMotionLayout(blurred, advancedProfile);
  assert.equal(
    advancedAudit.errors.some((entry) => entry.code === 'motion_recipe_unmatched'),
    true,
    'an active live control from a published motion section must invalidate exact recipe identity'
  );
  assert.equal(
    motionSignature(blurred, advancedProfile)[0].props.motionBlur,
    true,
    'the canonical signature must disclose the unmatched live motion control'
  );
});

test('motion sections and prop names remain scoped to their owning component', () => {
  const live = contract();
  live.components.find((entry) => entry.name === 'ButtonBlock').controls = [
    control('pointerEffect', 'select', { section: 'Animation', options: ['none', 'magnetic'] }),
    control('pointerStrength', 'number', { section: 'Animation', min: 1, max: 40, step: 1 }),
    control('autoplay', 'toggle'),
  ];
  live.components.push(component('AnimatedHeadline', [
    control('duration', 'number', { section: 'Animation', min: 100, max: 10000, step: 100 }),
  ]));
  const profile = buildResolvedMotionProfile(live);
  const nodeMap = {
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['animated'] },
    animated: {
      type: { resolvedName: 'AnimatedHeadline' },
      isCanvas: false,
      props: { duration: 3000 },
      parent: 'ROOT',
      nodes: [],
    },
  };

  assert.equal(profile.propNamesByComponent.has('AnimatedHeadline'), false);
  assert.equal(auditMotionLayout(nodeMap, profile).ok, true);
  assert.deepEqual(motionSignature(nodeMap, profile), []);
});

test('motion audit fails closed when published recipe prerequisites are absent', () => {
  const ambient = canonicalMotionFixture('ambient');
  delete ambient.layout['motion-owner'].props.backgroundImage;
  assert.equal(
    auditMotionLayout(ambient.layout, buildResolvedMotionProfile(ambient.contract)).errors
      .some((entry) => entry.code === 'motion_background_media_missing'),
    true
  );

  const scroll = canonicalMotionFixture('scroll');
  scroll.layout['motion-owner'].props.backgroundAttachment = 'fixed';
  assert.equal(
    auditMotionLayout(scroll.layout, buildResolvedMotionProfile(scroll.contract)).errors
      .some((entry) => entry.code === 'motion_fixed_background_conflict'),
    true
  );

  const pinned = canonicalMotionFixture('pinned');
  pinned.layout['motion-owner'].nodes = ['story-1', 'story-2'];
  assert.equal(
    auditMotionLayout(pinned.layout, buildResolvedMotionProfile(pinned.contract)).errors
      .some((entry) => entry.code === 'motion_pinned_story_structure'),
    true
  );

  const tabs = canonicalMotionFixture('state-change');
  tabs.layout['motion-owner'].props.tabs = [{ label: 'Only state' }];
  assert.equal(
    auditMotionLayout(tabs.layout, buildResolvedMotionProfile(tabs.contract)).errors
      .some((entry) => entry.code === 'motion_state_owner_structure'),
    true
  );

  const cardContract = canonicalMotionFixture('entrance').contract;
  cardContract.components = [component('Container', [
    control('hoverPreset', 'select', { options: ['none', 'lift'] }),
    control('activePreset', 'select', { options: ['none', 'press'] }),
  ])];
  cardContract.authoring.motion.recipes = [{
    id: 'card-hover',
    intent: 'component',
    components: ['Container'],
    props: { hoverPreset: 'lift', activePreset: 'press' },
  }];
  const cardProfile = buildResolvedMotionProfile(cardContract);
  const cardLayout = {
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['card'] },
    card: {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: { hoverPreset: 'lift', activePreset: 'press' },
      parent: 'ROOT',
      nodes: [],
    },
  };
  assert.equal(
    auditMotionLayout(cardLayout, cardProfile).errors
      .some((entry) => entry.code === 'motion_card_action_unproven'),
    true
  );
  cardLayout.card.props.href = '#';
  assert.equal(
    auditMotionLayout(cardLayout, cardProfile).errors
      .some((entry) => entry.code === 'motion_card_action_unproven'),
    true
  );
  cardLayout.card.props.href = '/contact/';
  assert.equal(auditMotionLayout(cardLayout, cardProfile).ok, true);
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

test('canonical verifier requires normalized normal/reduced/no-JS/coarse/input evidence only for claimed motion', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-motion-contract-'));
  const contractFile = path.join(directory, 'contract.json');
  const layoutFile = path.join(directory, 'layout.json');
  const nodeMap = layout();
  const profile = buildResolvedMotionProfile(contract());
  Object.assign(nodeMap['button-1'].props, profile.recipeById.get('magnetic-cta').props);
  fs.writeFileSync(contractFile, JSON.stringify(contract()));
  fs.writeFileSync(layoutFile, JSON.stringify(nodeMap));
  const iteration = { files: { contract: contractFile, layout: layoutFile } };
  const manifest = {
    motionEvidence: {
      viewports: ['desktop', 'tablet', 'mobile'].map((label) => canonicalMotionViewportEvidence(
        label,
        'pointer',
        [{ nodeId: 'button-1', recipeId: 'magnetic-cta', passed: true }]
      )),
    },
  };
  assert.deepEqual(validateCanonicalMotionEvidence(iteration, manifest), []);
  manifest.motionEvidence.viewports[2].checks.reducedMotionStatic = false;
  assert.equal(
    validateCanonicalMotionEvidence(iteration, manifest).some((entry) => entry.code === 'canonical_motion_reduced_motion_static_failed'),
    true
  );
});

test('canonical verifier requires positive normal-runtime proof for every claimed motion kind', () => {
  for (const kind of ['pointer', 'scroll', 'pinned', 'state-change', 'entrance', 'ambient']) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-motion-${kind}-`));
    const contractFile = path.join(directory, 'contract.json');
    const layoutFile = path.join(directory, 'layout.json');
    const fixture = canonicalMotionFixture(kind);
    fs.writeFileSync(contractFile, JSON.stringify(fixture.contract));
    fs.writeFileSync(layoutFile, JSON.stringify(fixture.layout));
    const iteration = { files: { contract: contractFile, layout: layoutFile } };
    const manifest = {
      motionEvidence: {
        viewports: ['desktop', 'tablet', 'mobile'].map((label) => canonicalMotionViewportEvidence(label, kind)),
      },
    };
    assert.deepEqual(validateCanonicalMotionEvidence(iteration, manifest), [], `${kind} positive proof`);

    const failedProof = manifest.motionEvidence.viewports[1].environments.normalFinePointer.positiveByOwner[0];
    failedProof.passed = false;
    failedProof.passedCount = 0;
    failedProof.samples[0].passed = false;
    assert.equal(
      validateCanonicalMotionEvidence(iteration, manifest)
        .some((entry) => entry.code === 'canonical_motion_owner_positive_operation_failed'),
      true,
      `${kind} failed proof`
    );
  }
});

test('canonical motion proof is bound to each exact owner even when kinds match', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-motion-owner-proof-'));
  const contractFile = path.join(directory, 'contract.json');
  const layoutFile = path.join(directory, 'layout.json');
  const fixture = canonicalMotionFixture('entrance');
  fixture.layout.ROOT.nodes.push('motion-owner-2');
  fixture.layout['motion-owner-2'] = {
    ...fixture.layout['motion-owner'],
    props: { ...fixture.layout['motion-owner'].props },
    parent: 'ROOT',
    nodes: [],
  };
  fs.writeFileSync(contractFile, JSON.stringify(fixture.contract));
  fs.writeFileSync(layoutFile, JSON.stringify(fixture.layout));
  const owners = [
    { nodeId: 'motion-owner', recipeId: 'proof-entrance', passed: true },
    { nodeId: 'motion-owner-2', recipeId: 'proof-entrance', passed: false },
  ];
  const blockers = validateCanonicalMotionEvidence(
    { files: { contract: contractFile, layout: layoutFile } },
    {
      motionEvidence: {
        viewports: ['desktop', 'tablet', 'mobile'].map((label) => (
          canonicalMotionViewportEvidence(label, 'entrance', owners)
        )),
      },
    }
  );
  assert.equal(blockers.some((entry) => (
    entry.code === 'canonical_motion_owner_positive_operation_failed'
    && entry.message.includes('motion-owner-2')
  )), true);
  assert.equal(blockers.some((entry) => (
    entry.code === 'canonical_motion_owner_positive_operation_failed'
    && entry.message.includes('motion-owner,')
  )), false);
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
    'normalFinePointer',
    'positiveByKind',
    'positiveByOwner',
    'data-monteby-node-id',
    'data-monteby-motion-recipe',
    'pointer-css-variable',
    'scroll-progress',
    'pinned-progress',
    'user-control',
    'entrance-transition',
    'running-animation',
  ]) {
    assert.match(source, new RegExp(evidence));
  }
});
