'use strict';

const {
  buildControlIndex,
  normalizeControlValue,
  publishedControlReferences,
} = require('./control-contract');

const MOTION_PLAN_SOURCES = new Set(['explicit-brief', 'measured-reference']);
const MOTION_FORBIDDEN_COMPONENT_FALLBACK = Object.freeze([]);
const NON_CONTENT_COMPONENTS = new Set(['DecorativeShape', 'Divider', 'Spacer']);
const STATE_COLLECTIONS = Object.freeze({
  AccordionBlock: 'items',
  SliderBlock: 'slides',
  TabsBlock: 'tabs',
});
const REQUIRED_POLICY_BOUNDS = Object.freeze({
  maxEntranceOwnersPerPage: Object.freeze([1, 12]),
  maxFirstViewportEntranceOwners: Object.freeze([0, 6]),
  maxPointerEffectsPerPage: Object.freeze([0, 6]),
  maxPinnedScenesPerPage: Object.freeze([0, 3]),
  maxBackgroundEffectsPerPage: Object.freeze([0, 4]),
  maxStaggerSpanMs: Object.freeze([0, 2000]),
  maxEntranceDurationMs: Object.freeze([100, 2000]),
  maxEntranceDelayMs: Object.freeze([0, 2000]),
  maxEntranceDistancePx: Object.freeze([0, 160]),
});

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function finiteNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function validStringList(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

function componentMap(contract) {
  const entries = Array.isArray(contract?.components) ? contract.components : [];
  return new Map(entries
    .filter((entry) => isRecord(entry) && typeof entry.name === 'string' && entry.name)
    .map((entry) => [entry.name, entry]));
}

function recipeKind(recipe) {
  const props = recipe.props || {};
  if (props.pointerEffect !== undefined || recipe.intent === 'pointer') return 'pointer';
  if (props.sectionStickyScene !== undefined || recipe.intent === 'story') return 'pinned';
  if (props.backgroundParallax !== undefined) return 'scroll';
  if (props.transitionPreset !== undefined || ['component', 'slider'].includes(recipe.intent)) return 'state-change';
  if (props.backgroundMotion !== undefined || recipe.intent === 'background') return 'ambient';
  return 'entrance';
}

function normalizePolicy(value) {
  const policy = isRecord(value) ? value : {};
  return Object.freeze({
    defaultRepeat: policy.defaultRepeat === 'repeat' ? 'repeat' : 'once',
    maxEntranceOwnersPerPage: finiteNonNegativeInteger(policy.maxEntranceOwnersPerPage),
    maxFirstViewportEntranceOwners: finiteNonNegativeInteger(policy.maxFirstViewportEntranceOwners),
    maxPointerEffectsPerPage: finiteNonNegativeInteger(policy.maxPointerEffectsPerPage),
    maxPinnedScenesPerPage: finiteNonNegativeInteger(policy.maxPinnedScenesPerPage),
    maxBackgroundEffectsPerPage: finiteNonNegativeInteger(policy.maxBackgroundEffectsPerPage),
    maxStaggerSpanMs: finiteNonNegativeInteger(policy.maxStaggerSpanMs),
    maxEntranceDurationMs: finiteNonNegativeInteger(policy.maxEntranceDurationMs),
    maxEntranceDelayMs: finiteNonNegativeInteger(policy.maxEntranceDelayMs),
    maxEntranceDistancePx: finiteNonNegativeInteger(policy.maxEntranceDistancePx),
    forbiddenComponents: Object.freeze(Array.isArray(policy.forbiddenComponents)
      ? [...new Set(policy.forbiddenComponents.filter((name) => typeof name === 'string' && name))]
      : [...MOTION_FORBIDDEN_COMPONENT_FALLBACK]),
    prohibitedInputs: Object.freeze(Array.isArray(policy.prohibitedInputs)
      ? policy.prohibitedInputs.filter((entry) => typeof entry === 'string' && entry)
      : []),
    rules: Object.freeze(Array.isArray(policy.rules)
      ? policy.rules.filter((entry) => typeof entry === 'string' && entry)
      : []),
  });
}

function buildResolvedMotionProfile(contract) {
  const published = contract?.authoring?.motion;
  const controls = buildControlIndex(contract || {});
  const components = componentMap(contract);
  const rejectedRecipes = [];
  const recipes = [];
  const ids = new Set();

  const policyErrors = Object.entries(REQUIRED_POLICY_BOUNDS)
    .filter(([prop, [minimum, maximum]]) => (
      !Number.isInteger(published?.policy?.[prop])
      || published.policy[prop] < minimum
      || published.policy[prop] > maximum
    ))
    .map(([prop, [minimum, maximum]]) => `authoring.motion.policy.${prop} must be an integer from ${minimum} to ${maximum}`);
  if (published?.policy?.defaultRepeat !== 'once') {
    policyErrors.push('authoring.motion.policy.defaultRepeat must be once');
  }
  for (const prop of ['forbiddenComponents', 'prohibitedInputs', 'rules']) {
    if (!validStringList(published?.policy?.[prop])) {
      policyErrors.push(`authoring.motion.policy.${prop} must be an array of non-empty strings`);
    }
  }
  if (
    contract?.authoring?.capabilities?.motionRecipes !== true
    || !isRecord(published)
    || published.version !== 1
    || !Array.isArray(published.recipes)
    || policyErrors.length > 0
  ) {
    return {
      available: false,
      version: 0,
      fallback: 'no-generated-motion',
      policy: normalizePolicy({}),
      recipes: [],
      recipeById: new Map(),
      propNames: new Set(),
      propNamesByComponent: new Map(),
      rejectedRecipes: [{
        id: '',
        reasons: policyErrors.length > 0
          ? policyErrors
          : ['motionRecipes capability and authoring.motion version 1 are required'],
      }],
    };
  }

  for (const candidate of published.recipes) {
    const reasons = [];
    const id = typeof candidate?.id === 'string' ? candidate.id : '';
    const intent = typeof candidate?.intent === 'string' ? candidate.intent : '';
    const recipeComponents = Array.isArray(candidate?.components)
      ? [...new Set(candidate.components.filter((name) => typeof name === 'string' && name))]
      : [];
    const props = isRecord(candidate?.props) ? { ...candidate.props } : null;
    if (!/^[a-z][a-z0-9-]{0,63}$/u.test(id) || ids.has(id)) reasons.push('invalid or duplicate id');
    if (!intent) reasons.push('missing semantic intent');
    if (recipeComponents.length === 0) reasons.push('missing components');
    if (!props || Object.keys(props).length === 0) reasons.push('missing typed props');

    if (props) {
      for (const componentName of recipeComponents) {
        const component = components.get(componentName);
        const authoringProps = new Set(Array.isArray(component?.aiProps) ? component.aiProps : []);
        if (!component) {
          reasons.push(`${componentName}: component unavailable`);
          continue;
        }
        for (const [prop, value] of Object.entries(props)) {
          const control = controls.get(`${componentName}.${prop}`);
          if (!authoringProps.has(prop) || !control) {
            reasons.push(`${componentName}.${prop}: live authoring control unavailable`);
            continue;
          }
          const normalized = normalizeControlValue(
            control,
            value,
            publishedControlReferences(contract, componentName, prop, control),
          );
          if (!normalized.accepted || normalized.changed === true) {
            reasons.push(`${componentName}.${prop}: recipe value does not round-trip through live control`);
          }
        }
      }
    }

    if (reasons.length > 0) {
      rejectedRecipes.push({ id, reasons: [...new Set(reasons)] });
      continue;
    }

    ids.add(id);
    recipes.push(Object.freeze({
      id,
      label: typeof candidate.label === 'string' ? candidate.label : id,
      description: typeof candidate.description === 'string' ? candidate.description : '',
      intent,
      intensity: typeof candidate.intensity === 'string' ? candidate.intensity : '',
      kind: recipeKind(candidate),
      components: Object.freeze(recipeComponents),
      props: Object.freeze(props),
      constraints: Object.freeze(Array.isArray(candidate.constraints)
        ? candidate.constraints.filter((entry) => typeof entry === 'string' && entry)
        : []),
    }));
  }

  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const propNamesByComponent = new Map();
  for (const recipe of recipes) {
    for (const component of recipe.components) {
      const propNames = propNamesByComponent.get(component) || new Set();
      Object.keys(recipe.props).forEach((prop) => propNames.add(prop));
      propNamesByComponent.set(component, propNames);
    }
  }
  return {
    available: recipes.length > 0,
    version: 1,
    fallback: recipes.length > 0 ? '' : 'no-generated-motion',
    policy: normalizePolicy(published.policy),
    recipes: Object.freeze(recipes),
    recipeById,
    propNames: new Set(recipes.flatMap((recipe) => Object.keys(recipe.props))),
    propNamesByComponent,
    rejectedRecipes,
  };
}

function nodeType(node) {
  return typeof node?.type?.resolvedName === 'string' ? node.type.resolvedName : '';
}

function orderedNodeIds(nodeMap) {
  const ordered = [];
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id) || !isRecord(nodeMap?.[id])) return;
    visited.add(id);
    if (id !== 'ROOT') ordered.push(id);
    for (const childId of Array.isArray(nodeMap[id].nodes) ? nodeMap[id].nodes : []) visit(childId);
  };
  visit('ROOT');
  return ordered;
}

function recipeForNode(profile, component, props) {
  const publishedProps = profile.propNames || new Set();
  const matches = profile.recipes.filter((recipe) => (
    recipe.components.includes(component)
    && Object.entries(recipe.props).every(([prop, value]) => (
      Object.hasOwn(props, prop) && props[prop] === value
    ))
    && Object.entries(props).every(([prop, value]) => (
      !publishedProps.has(prop)
      || Object.hasOwn(recipe.props, prop)
      || motionPropIsInactive(value)
    ))
  ));
  return matches.length === 1 ? matches[0] : null;
}

function motionPropIsInactive(value) {
  return value === undefined
    || value === null
    || value === false
    || value === 0
    || value === ''
    || value === 'none'
    || value === 'off'
    || value === 'auto'
    || (Array.isArray(value) && value.length === 0);
}

function hasMotionProps(profile, component, props) {
  const componentProps = profile.propNamesByComponent?.get(component) || new Set();
  return Object.entries(props || {}).some(([prop, value]) => (
    componentProps.has(prop) && !motionPropIsInactive(value)
  ));
}

function firstViewportNodeIds(nodeMap) {
  const firstRoot = Array.isArray(nodeMap?.ROOT?.nodes) ? nodeMap.ROOT.nodes[0] : '';
  if (!firstRoot) return new Set();
  const scoped = { ...nodeMap, ROOT: { ...(nodeMap.ROOT || {}), nodes: [firstRoot] } };
  return new Set(orderedNodeIds(scoped));
}

function motionGroupSize(node) {
  const directChildren = Array.isArray(node?.nodes) ? node.nodes.length : 0;
  if (directChildren > 0) return directChildren;
  const props = isRecord(node?.props) ? node.props : {};
  for (const value of ['items', 'slides', 'tabs', 'cards'].map((prop) => props[prop])) {
    if (Array.isArray(value) && value.length > 0) return value.length;
  }
  for (const prop of ['postsPerPage', 'perPage', 'limit', 'count']) {
    const value = Number(props[prop]);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return 0;
}

function hasAuthoredValue(value) {
  return (typeof value === 'string' && value.trim() !== '')
    || (Number.isSafeInteger(value) && value > 0);
}

function hasAuthoredAction(value) {
  if (Number.isSafeInteger(value)) return value > 0;
  if (typeof value !== 'string' || value.trim() !== value || value === '' || value === '#') return false;
  return !/^(?:javascript|data|vbscript):/iu.test(value);
}

function hasCompositeBackgroundMedia(props, imageOnly) {
  const image = hasAuthoredValue(props.backgroundImage) || hasAuthoredValue(props.dynamicBackgroundImage);
  const video = hasAuthoredValue(props.backgroundVideo);
  if (props.backgroundMedia === 'image') return image;
  if (props.backgroundMedia === 'video') return imageOnly ? false : video;
  return false;
}

function hasFixedBackground(props) {
  return props.backgroundAttachment === 'fixed'
    || (Array.isArray(props.backgroundLayers) && props.backgroundLayers.some((layer) => (
      isRecord(layer) && layer.attachment === 'fixed'
    )));
}

function meaningfulDirectChildCount(nodeMap, node) {
  return (Array.isArray(node?.nodes) ? node.nodes : []).filter((childId) => {
    const child = nodeMap?.[childId];
    return isRecord(child) && !NON_CONTENT_COMPONENTS.has(nodeType(child));
  }).length;
}

function stateCollectionCount(component, props) {
  const collection = STATE_COLLECTIONS[component];
  if (!collection || !Array.isArray(props[collection])) return 0;
  return props[collection].filter((item) => isRecord(item)).length;
}

function cardActionIsProven(component, props) {
  if (component === 'Container') {
    return hasAuthoredAction(props.href) || hasAuthoredAction(props.dynamicHref);
  }
  if (component === 'PricingTable' && Array.isArray(props.plans) && props.plans.length === 1) {
    const plan = props.plans[0];
    return isRecord(plan) && (hasAuthoredAction(plan.ctaHref) || hasAuthoredAction(plan.dynamicCtaHref));
  }
  return false;
}

function motionPrerequisiteErrors(nodeMap, nodeId, node, component, props, recipe) {
  const errors = [];
  const error = (code, message) => errors.push({ code, nodeId, component, message: `${nodeId} (${component}) ${message}` });
  if (Object.hasOwn(recipe.props, 'backgroundMotion') && !hasCompositeBackgroundMedia(props, true)) {
    error('motion_background_media_missing', 'requires an authored composite image background for this motion recipe.');
  }
  if (Object.hasOwn(recipe.props, 'backgroundParallax')) {
    if (!hasCompositeBackgroundMedia(props, false)) {
      error('motion_background_media_missing', 'requires an authored composite image or video background for this motion recipe.');
    }
    if (hasFixedBackground(props)) {
      error('motion_fixed_background_conflict', 'cannot combine scroll depth with fixed background attachment.');
    }
  }
  if (Object.hasOwn(recipe.props, 'sectionStickyScene')) {
    const childCount = meaningfulDirectChildCount(nodeMap, node);
    if (childCount < 3 || childCount > 6) {
      error('motion_pinned_story_structure', `requires three to six meaningful direct children; found ${childCount}.`);
    }
    if (hasFixedBackground(props)) {
      error('motion_fixed_background_conflict', 'cannot combine a pinned story with fixed background attachment.');
    }
  }
  if (Object.hasOwn(recipe.props, 'transitionPreset')) {
    const stateCount = stateCollectionCount(component, props);
    if (stateCount < 2) {
      error('motion_state_owner_structure', 'requires an explicit authorable collection with at least two states or slides.');
    }
  }
  if (Object.hasOwn(recipe.props, 'hoverPreset') && !cardActionIsProven(component, props)) {
    error('motion_card_action_unproven', 'requires one authorable, unambiguous card action.');
  }
  return errors;
}

function auditMotionLayout(nodeMap, profile) {
  const errors = [];
  const claims = [];
  if (!profile?.available) return { ok: true, errors, claims, stats: { owners: 0 } };
  const forbidden = new Set(profile.policy.forbiddenComponents);
  const firstViewport = firstViewportNodeIds(nodeMap);
  const entranceOwners = [];
  const pointerOwners = [];
  const pinnedOwners = [];
  const backgroundOwners = [];

  for (const nodeId of orderedNodeIds(nodeMap)) {
    const node = nodeMap[nodeId];
    const component = nodeType(node);
    const props = isRecord(node.props) ? node.props : {};
    const hasComponentMotion = hasMotionProps(profile, component, props);
    const hasPublishedMotion = Object.entries(props).some(([prop, value]) => (
      profile.propNames.has(prop) && !motionPropIsInactive(value)
    ));
    if (forbidden.has(component) && hasPublishedMotion) {
      errors.push({ code: 'motion_forbidden_component', nodeId, component, message: `${nodeId} (${component}) is forbidden by the live motion policy.` });
      continue;
    }
    if (!hasComponentMotion) {
      if (hasPublishedMotion) {
        errors.push({ code: 'motion_recipe_unmatched', nodeId, component, message: `${nodeId} (${component}) uses published motion props without one compatible live recipe.` });
      }
      continue;
    }
    const recipe = recipeForNode(profile, component, props);
    if (!recipe) {
      errors.push({ code: 'motion_recipe_unmatched', nodeId, component, message: `${nodeId} (${component}) must have exactly one complete live recipe signature and no additional typed motion props.` });
      continue;
    }
    errors.push(...motionPrerequisiteErrors(nodeMap, nodeId, node, component, props, recipe));
    if (props.autoplay === true) {
      errors.push({ code: 'motion_autoplay_enabled', nodeId, component, message: `${nodeId} (${component}) enables autoplay while claiming a live motion recipe; generated motion must remain user-controlled.` });
    }
    const claim = { nodeId, component, recipeId: recipe.id, intent: recipe.intent, kind: recipe.kind, firstViewport: firstViewport.has(nodeId) };
    claims.push(claim);
    if (recipe.kind === 'entrance') entranceOwners.push(claim);
    if (recipe.kind === 'pointer') pointerOwners.push(claim);
    if (recipe.kind === 'pinned') pinnedOwners.push(claim);
    if (['ambient', 'scroll'].includes(recipe.kind)) backgroundOwners.push(claim);

    if (recipe.kind === 'entrance') {
      for (const [prop, value, maximum, code] of [
        ['motionDuration', props.motionDuration, profile.policy.maxEntranceDurationMs, 'motion_entrance_duration_exceeded'],
        ['motionDelay', props.motionDelay, profile.policy.maxEntranceDelayMs, 'motion_entrance_delay_exceeded'],
        ['motionDistance', props.motionDistance, profile.policy.maxEntranceDistancePx, 'motion_entrance_distance_exceeded'],
      ]) {
        if (Number.isFinite(Number(value)) && Number(value) > maximum) {
          errors.push({ code, nodeId, component, message: `${nodeId} ${prop}=${value} exceeds the live motion budget ${maximum}.` });
        }
      }
    }

    const stagger = Number(props.motionStagger || 0);
    if (stagger > 0) {
      const groupSize = motionGroupSize(node);
      const span = stagger * Math.max(0, groupSize - 1);
      if (groupSize < 2 || groupSize > 6) {
        errors.push({ code: 'motion_stagger_group_size', nodeId, component, message: `${nodeId} stagger requires two to six direct children; found ${groupSize}.` });
      }
      if (span > profile.policy.maxStaggerSpanMs) {
        errors.push({ code: 'motion_stagger_budget_exceeded', nodeId, component, message: `${nodeId} stagger spans ${span}ms; live budget is ${profile.policy.maxStaggerSpanMs}ms.` });
      }
      for (const childId of Array.isArray(node.nodes) ? node.nodes : []) {
        const child = nodeMap[childId];
        const childProps = isRecord(child?.props) ? child.props : {};
        if (hasMotionProps(profile, nodeType(child), childProps)) {
          errors.push({ code: 'motion_parent_child_conflict', nodeId: childId, component: nodeType(child), message: `${nodeId} owns a stagger while direct child ${childId} owns motion.` });
        }
      }
    }
  }

  const budgets = [
    ['motion_entrance_budget_exceeded', entranceOwners, profile.policy.maxEntranceOwnersPerPage, 'entrance owners'],
    ['motion_first_viewport_budget_exceeded', entranceOwners.filter((claim) => claim.firstViewport), profile.policy.maxFirstViewportEntranceOwners, 'first-viewport entrance owners'],
    ['motion_pointer_budget_exceeded', pointerOwners, profile.policy.maxPointerEffectsPerPage, 'pointer effects'],
    ['motion_pinned_budget_exceeded', pinnedOwners, profile.policy.maxPinnedScenesPerPage, 'pinned scenes'],
    ['motion_background_budget_exceeded', backgroundOwners, profile.policy.maxBackgroundEffectsPerPage, 'background effects'],
  ];
  for (const [code, owners, maximum, label] of budgets) {
    if (owners.length > maximum) errors.push({ code, message: `Layout has ${owners.length} ${label}; live budget is ${maximum}.` });
  }
  return {
    ok: errors.length === 0,
    errors,
    claims,
    stats: {
      owners: claims.length,
      entranceOwners: entranceOwners.length,
      firstViewportEntranceOwners: entranceOwners.filter((claim) => claim.firstViewport).length,
      pointerEffects: pointerOwners.length,
      pinnedScenes: pinnedOwners.length,
      backgroundEffects: backgroundOwners.length,
    },
  };
}

function targetNodeId(nodeMap, target) {
  if (!isRecord(target)) return '';
  if (typeof target.nodeId === 'string' && nodeMap[target.nodeId]) return target.nodeId;
  if (typeof target.component !== 'string' || !Number.isInteger(target.occurrence) || target.occurrence < 0) return '';
  const matches = orderedNodeIds(nodeMap).filter((nodeId) => nodeType(nodeMap[nodeId]) === target.component);
  return matches[target.occurrence] || '';
}

function applySemanticMotionPlan(nodeMap, profile, plan) {
  if (!isRecord(plan) || plan.version !== 1 || !MOTION_PLAN_SOURCES.has(plan.source) || !Array.isArray(plan.requests)) {
    if (plan === undefined || plan === null) return { applied: [], rejected: [], source: '', version: 0 };
    throw new Error('motion plan requires version 1, an explicit/measured source, and requests');
  }
  if (!profile?.available) {
    return {
      applied: [],
      rejected: plan.requests.map((request) => ({ recipeId: String(request?.recipeId || ''), reason: 'no-generated-motion' })),
      source: plan.source,
      version: 1,
    };
  }
  const staged = new Map();
  const targetedNodes = new Set();
  const firstViewportNodes = firstViewportNodeIds(nodeMap);
  const applied = [];
  const rejected = [];
  for (const request of plan.requests) {
    const recipe = profile.recipeById.get(request?.recipeId);
    const nodeId = targetNodeId(nodeMap, request?.target);
    const component = nodeType(nodeMap[nodeId]);
    let reason = '';
    if (!recipe) reason = 'recipe unavailable in live contract';
    else if (!nodeId) reason = 'deterministic target did not resolve';
    else if (request.intent !== recipe.intent) reason = 'semantic intent does not match live recipe';
    else if (!recipe.components.includes(component)) reason = 'target component is incompatible with live recipe';
    else if (typeof request.firstViewport !== 'boolean') reason = 'firstViewport evidence must be explicit';
    else if (request.firstViewport !== firstViewportNodes.has(nodeId)) reason = 'firstViewport evidence does not match the deterministic root scope';
    else if (targetedNodes.has(nodeId)) reason = 'a node may own only one semantic motion recipe';
    if (reason) {
      rejected.push({ recipeId: String(request?.recipeId || ''), nodeId, reason });
      continue;
    }
    targetedNodes.add(nodeId);
    staged.set(nodeId, { ...(nodeMap[nodeId].props || {}), ...recipe.props });
    applied.push({ nodeId, component, recipeId: recipe.id, intent: recipe.intent, kind: recipe.kind, firstViewport: request.firstViewport });
  }

  if (rejected.length > 0) {
    return { applied: [], rejected, source: plan.source, version: 1 };
  }

  const clone = Object.fromEntries(Object.entries(nodeMap).map(([id, node]) => [id, {
    ...node,
    props: staged.has(id) ? staged.get(id) : node?.props,
    nodes: Array.isArray(node?.nodes) ? [...node.nodes] : node?.nodes,
  }]));
  const audit = auditMotionLayout(clone, profile);
  if (!audit.ok) {
    return {
      applied: [],
      rejected: [
        ...rejected,
        ...audit.errors.map((entry) => ({ recipeId: '', nodeId: entry.nodeId || '', reason: entry.message, code: entry.code })),
      ],
      source: plan.source,
      version: 1,
    };
  }
  for (const [nodeId, props] of staged) nodeMap[nodeId].props = props;
  return { applied, rejected, source: plan.source, version: 1 };
}

function motionSignature(nodeMap, profile) {
  if (!profile?.available) return [];
  return orderedNodeIds(nodeMap).flatMap((nodeId) => {
    const node = nodeMap[nodeId];
    const props = isRecord(node?.props) ? node.props : {};
    const publishedProps = profile.propNames || new Set();
    const recipe = recipeForNode(profile, nodeType(node), props);
    const selected = recipe
      ? Object.fromEntries(Object.keys(recipe.props).map((prop) => [prop, props[prop]]))
      : Object.fromEntries(Object.entries(props).filter(([prop, value]) => (
        publishedProps.has(prop) && !motionPropIsInactive(value)
      )));
    return Object.keys(selected).length > 0 ? [{ nodeId, component: nodeType(node), props: selected }] : [];
  });
}

module.exports = {
  applySemanticMotionPlan,
  auditMotionLayout,
  buildResolvedMotionProfile,
  motionSignature,
  orderedNodeIds,
  recipeForNode,
};
