#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { iterationArgsFor } = require('./run-visual-iteration.js');

const SCHEMA_VERSION = 1;
const ARTIFACT = 'monteby-layout-repair-application';
const ACTIONABLE_CODES = new Set([
  'restore_measured_band',
  'remove_or_merge_extra_band',
  'match_band_geometry',
]);
const VIEWPORT_PROPS = {
  desktop: {
    height: 'minHeight',
    inset: 'innerPaddingX',
  },
  tablet: {
    height: 'minHeightTablet',
    inset: 'innerPaddingXTablet',
  },
  mobile: {
    height: 'minHeightMobile',
    inset: 'innerPaddingXMobile',
  },
};

class RepairError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RepairError';
    this.code = code;
    this.details = details;
  }
}

function nextAction(id, tool, args, requires, instruction) {
  return { id, tool, args, requires, instruction };
}

function parseArgs(argv) {
  const options = {
    iterationReport: '',
    out: '',
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--json') {
      options.json = true;
      continue;
    }
    if (option === '--help' || option === '-h') {
      options.help = true;
      continue;
    }
    if (option !== '--iteration-report' && option !== '--out') {
      throw new RepairError('UNKNOWN_OPTION', `Unknown option: ${option}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new RepairError('MISSING_OPTION_VALUE', `Missing value for ${option}.`);
    }
    index += 1;
    if (option === '--iteration-report') {
      options.iterationReport = path.resolve(value);
    } else {
      options.out = path.resolve(value);
    }
  }

  if (!options.help && !options.iterationReport) {
    throw new RepairError('ITERATION_REPORT_REQUIRED', '--iteration-report is required.');
  }
  if (!options.help && !options.out) {
    throw new RepairError('OUTPUT_REQUIRED', '--out is required.');
  }

  return options;
}

function usage() {
  return `Usage:
  apply-layout-repair-queue.js --iteration-report REPORT.json --out LAYOUT.json [--json]

Applies only deterministic repairQueue operations:
  - restore_measured_band recursively restores the plan-owned Section subtree
  - match_band_geometry writes measured, contract-supported Section geometry
  - remove_or_merge_extra_band removes only a mechanically proven duplicate

Unknown blockers and ambiguous content scope are hard stops. The output layout is
published atomically only after every repair operation passes.`;
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file, label) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new RepairError(
      'ARTIFACT_READ_FAILED',
      `Could not read ${label}: ${file}`,
      { label, file, cause: error.message }
    );
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new RepairError(
      'ARTIFACT_JSON_INVALID',
      `${label} is not valid JSON: ${file}`,
      { label, file, cause: error.message }
    );
  }
}

function resolveArtifactPath(ownerFile, value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RepairError('ARTIFACT_PATH_MISSING', `${label} path is missing.`);
  }
  return path.isAbsolute(value)
    ? path.normalize(value)
    : path.resolve(path.dirname(ownerFile), value);
}

function isNodeMap(value) {
  return isObject(value) && isObject(value.ROOT);
}

function nodeMapFromPayload(payload, label) {
  if (isNodeMap(payload)) {
    return payload;
  }
  for (const key of ['layout', 'nodeMap', 'nodes', 'builderJson']) {
    if (isNodeMap(payload?.[key])) {
      return payload[key];
    }
  }
  throw new RepairError(
    'NODE_MAP_MISSING',
    `${label} does not contain a Monteby node map.`
  );
}

function arrayOfStrings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item)
    : [];
}

function componentEntries(contract) {
  const raw = Array.isArray(contract)
    ? contract
    : contract?.components || contract?.widgets || contract?.catalog || [];
  return Array.isArray(raw) ? raw : Object.values(raw || {});
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, callback);
    return;
  }
  if (!isObject(value)) return;
  callback(value);
  for (const child of Object.values(value)) visit(child, callback);
}

function controlProps(entry) {
  const props = [];
  visit([entry?.controls, entry?.schema], (control) => {
    if (typeof control.type !== 'string' || !control.type.trim()) return;
    if (typeof control.prop === 'string') props.push(control.prop);
    props.push(...arrayOfStrings(control.props));
    if (isObject(control.spacingProps)) {
      props.push(...Object.values(control.spacingProps).filter((prop) => typeof prop === 'string'));
    }
  });
  return props;
}

function sectionAuthoringProps(contract) {
  const section = componentEntries(contract).find((entry) => (
    isObject(entry)
    && String(entry.name || entry.type || entry.resolvedName || '') === 'Section'
  ));
  if (!section) {
    throw new RepairError(
      'SECTION_CONTRACT_MISSING',
      'The live contract does not contain a Section component.'
    );
  }

  return new Set([
    ...arrayOfStrings(section.aiProps),
    ...controlProps(section),
  ]);
}

function childNodeIds(node) {
  const ids = [...arrayOfStrings(node?.nodes)];
  if (isObject(node?.linkedNodes)) {
    ids.push(...Object.values(node.linkedNodes).filter((id) => typeof id === 'string' && id));
  }
  return ids;
}

function collectSubtreeIds(nodeMap, rootId, label = 'layout') {
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  function walk(nodeId) {
    if (visiting.has(nodeId)) {
      throw new RepairError(
        'NODE_GRAPH_CYCLE',
        `${label} contains a cycle at node ${nodeId}.`,
        { nodeId }
      );
    }
    if (visited.has(nodeId)) return;
    const node = nodeMap[nodeId];
    if (!isObject(node)) {
      throw new RepairError(
        'NODE_GRAPH_DANGLING',
        `${label} is missing referenced node ${nodeId}.`,
        { nodeId }
      );
    }

    visiting.add(nodeId);
    ordered.push(nodeId);
    for (const childId of childNodeIds(node)) walk(childId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  walk(rootId);
  return ordered;
}

function reachableNodeIds(nodeMap) {
  const roots = arrayOfStrings(nodeMap?.ROOT?.nodes);
  const reachable = new Set();
  for (const rootId of roots) {
    for (const nodeId of collectSubtreeIds(nodeMap, rootId, 'candidate layout')) {
      reachable.add(nodeId);
    }
  }
  return reachable;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function sha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function nodeMapSha256(nodeMap) {
  return sha256(nodeMap);
}

function subtreeSha256(nodeMap, rootId) {
  const subtree = Object.fromEntries(
    collectSubtreeIds(nodeMap, rootId, 'candidate layout')
      .sort()
      .map((nodeId) => [nodeId, nodeMap[nodeId]])
  );
  return sha256(subtree);
}

function subtreeFingerprint(nodeMap, rootId) {
  const visiting = new Set();

  function normalize(nodeId) {
    if (visiting.has(nodeId)) {
      throw new RepairError(
        'NODE_GRAPH_CYCLE',
        `Candidate layout contains a cycle at node ${nodeId}.`,
        { nodeId }
      );
    }
    const node = nodeMap[nodeId];
    if (!isObject(node)) {
      throw new RepairError(
        'NODE_GRAPH_DANGLING',
        `Candidate layout is missing referenced node ${nodeId}.`,
        { nodeId }
      );
    }

    visiting.add(nodeId);
    const scalar = {};
    for (const [key, value] of Object.entries(node)) {
      if (['id', 'parent', 'nodes', 'linkedNodes'].includes(key)) continue;
      scalar[key] = stableValue(value);
    }
    const normalized = {
      node: stableValue(scalar),
      children: arrayOfStrings(node.nodes).map(normalize),
      linked: Object.fromEntries(
        Object.entries(isObject(node.linkedNodes) ? node.linkedNodes : {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, childId]) => [key, normalize(childId)])
      ),
    };
    visiting.delete(nodeId);
    return normalized;
  }

  return JSON.stringify(normalize(rootId));
}

function planBandForItem(plan, item) {
  const bands = Array.isArray(plan?.bands) ? plan.bands : [];
  const byId = item?.sectionId
    ? bands.find((band) => band?.generatedSectionId === item.sectionId)
    : null;
  const referenceIndex = Number(item?.referenceIndex);
  const byIndex = Number.isInteger(referenceIndex) && referenceIndex >= 0
    ? bands[referenceIndex] || null
    : null;
  if (byId && byIndex && byId !== byIndex) {
    throw new RepairError(
      'REPAIR_PLAN_MAPPING_MISMATCH',
      `Repair item ${item.code} maps to conflicting plan bands.`,
      { sectionId: item.sectionId, referenceIndex }
    );
  }
  const band = byId || byIndex;
  if (!band || typeof band.generatedSectionId !== 'string' || !band.generatedSectionId) {
    throw new RepairError(
      'REPAIR_PLAN_BAND_MISSING',
      `Repair item ${item?.code || 'unknown'} does not map to a measured plan band.`,
      { sectionId: item?.sectionId || '', referenceIndex: item?.referenceIndex }
    );
  }
  return band;
}

function restoreBand(nodeMap, sourceMap, plan, item) {
  const band = planBandForItem(plan, item);
  const sectionId = band.generatedSectionId;
  const order = Number(band.order);
  if (!Number.isInteger(order) || order < 0) {
    throw new RepairError(
      'REPAIR_PLAN_ORDER_INVALID',
      `Plan band ${sectionId} has no valid insertion order.`,
      { sectionId, order: band.order }
    );
  }
  if (String(sourceMap?.[sectionId]?.type?.resolvedName || '') !== 'Section') {
    throw new RepairError(
      'RESTORE_SOURCE_SECTION_INVALID',
      `Plan source node ${sectionId} is not a Section.`,
      { sectionId }
    );
  }

  const sourceIds = collectSubtreeIds(sourceMap, sectionId, 'plan source layout');
  const sourceIdSet = new Set(sourceIds);
  const collisions = new Set();
  for (const unrelatedRootId of arrayOfStrings(nodeMap?.ROOT?.nodes)) {
    if (unrelatedRootId === sectionId) continue;
    for (const nodeId of collectSubtreeIds(nodeMap, unrelatedRootId, 'candidate layout')) {
      if (sourceIdSet.has(nodeId)) collisions.add(nodeId);
    }
  }
  if (collisions.size > 0) {
    throw new RepairError(
      'RESTORE_NODE_ID_COLLISION',
      `Source subtree ${sectionId} collides with nodes reachable from an unrelated candidate root.`,
      { sectionId, collidingNodeIds: [...collisions].sort() }
    );
  }
  for (const nodeId of sourceIds) {
    nodeMap[nodeId] = deepClone(sourceMap[nodeId]);
  }

  const roots = arrayOfStrings(nodeMap?.ROOT?.nodes).filter((nodeId) => nodeId !== sectionId);
  if (order > roots.length) {
    throw new RepairError(
      'REPAIR_PLAN_ORDER_UNAVAILABLE',
      `Cannot insert ${sectionId} at plan order ${order}; preceding planned bands are missing.`,
      { sectionId, order, availableRoots: roots.length }
    );
  }
  roots.splice(order, 0, sectionId);
  nodeMap.ROOT.nodes = roots;

  return {
    code: item.code,
    sectionId,
    order,
    copiedNodeCount: sourceIds.length,
  };
}

function verifiedExtraRootId(item) {
  const measuredNodeIds = [...new Set(arrayOfStrings(item?.evidence?.measuredNodeIds))];
  const candidateRootId = String(item?.evidence?.candidateRootId || '');
  const sectionId = String(item?.sectionId || '');
  if (
    measuredNodeIds.length === 1
    && candidateRootId === measuredNodeIds[0]
    && sectionId === measuredNodeIds[0]
  ) {
    return measuredNodeIds[0];
  }
  return '';
}

function extraIdentity(item, queueIndex) {
  const sectionId = verifiedExtraRootId(item);
  return sectionId ? `root:${sectionId}` : `unproven:${queueIndex}`;
}

function locateExtraRoot(nodeMap, plan, item) {
  const roots = arrayOfStrings(nodeMap?.ROOT?.nodes);
  const sectionId = verifiedExtraRootId(item);
  if (!sectionId) {
    throw new RepairError(
      'EXTRA_BAND_IDENTITY_UNPROVEN',
      'The captured extra band does not identify one unique Monteby ROOT section; benchmark indices are not ROOT indices.',
      {
        candidateIndex: item?.candidateIndex,
        measuredNodeIds: item?.evidence?.measuredNodeIds || [],
      }
    );
  }

  const matches = roots
    .map((id, index) => ({ id, index }))
    .filter((entry) => entry.id === sectionId);
  if (matches.length === 1) return { index: matches[0].index, sectionId };

  throw new RepairError(
    'EXTRA_BAND_IDENTITY_UNPROVEN',
    'The reported extra band no longer maps to one unique candidate ROOT section.',
    {
      sectionId,
      candidateIndex: item?.candidateIndex,
      rootMatches: matches.length,
    }
  );
}

function proveDuplicateExtra(nodeMap, plan, item) {
  const roots = arrayOfStrings(nodeMap?.ROOT?.nodes);
  let target;
  try {
    target = locateExtraRoot(nodeMap, plan, item);
  } catch (error) {
    if (error instanceof RepairError && error.code === 'EXTRA_BAND_IDENTITY_UNPROVEN') {
      return {
        ok: false,
        blocker: blockerFromError(error),
      };
    }
    throw error;
  }
  const fingerprint = subtreeFingerprint(nodeMap, target.sectionId);
  const matches = [];

  for (let index = 0; index < roots.length; index += 1) {
    if (index === target.index) continue;
    const rootId = roots[index];
    if (rootId === target.sectionId) {
      matches.push({ index, sectionId: rootId, proof: 'same-root-id' });
      continue;
    }
    if (subtreeFingerprint(nodeMap, rootId) === fingerprint) {
      matches.push({ index, sectionId: rootId, proof: 'identical-subtree' });
    }
  }

  if (matches.length === 0) {
    return {
      ok: false,
      blocker: {
        code: 'CONTENT_SCOPE_DECISION_REQUIRED',
        message: `Extra root ${target.sectionId} is not a mechanically proven duplicate; removing or merging it requires an explicit content-scope decision.`,
        sectionId: target.sectionId,
        candidateIndex: target.index,
      },
    };
  }

  return {
    ok: true,
    target,
    duplicate: matches[0],
  };
}

function removeDuplicateExtra(nodeMap, plan, item) {
  const proof = proveDuplicateExtra(nodeMap, plan, item);
  if (!proof.ok) {
    throw new RepairError(
      proof.blocker.code,
      proof.blocker.message,
      proof.blocker
    );
  }

  const roots = arrayOfStrings(nodeMap.ROOT.nodes);
  const removedIds = collectSubtreeIds(nodeMap, proof.target.sectionId, 'candidate layout');
  roots.splice(proof.target.index, 1);
  nodeMap.ROOT.nodes = roots;
  const reachable = reachableNodeIds(nodeMap);
  let deletedNodeCount = 0;
  for (const nodeId of removedIds) {
    if (!reachable.has(nodeId)) {
      delete nodeMap[nodeId];
      deletedNodeCount += 1;
    }
  }

  return {
    code: item.code,
    sectionId: proof.target.sectionId,
    candidateIndex: proof.target.index,
    duplicateOfSectionId: proof.duplicate.sectionId,
    proof: proof.duplicate.proof,
    deletedNodeCount,
  };
}

function cssPixels(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RepairError(
      'GEOMETRY_TARGET_INVALID',
      `${label} must be a finite non-negative number.`,
      { label, value }
    );
  }
  const rounded = Math.round(number * 100) / 100;
  return `${Object.is(rounded, -0) ? 0 : rounded}px`;
}

function geometryChange(nodeMap, plan, allowedProps, item) {
  const band = planBandForItem(plan, item);
  const sectionId = band.generatedSectionId;
  const node = nodeMap[sectionId];
  if (!isObject(node) || String(node?.type?.resolvedName || '') !== 'Section') {
    throw new RepairError(
      'GEOMETRY_SECTION_MISSING',
      `Mapped geometry node ${sectionId} is not a candidate Section.`,
      { sectionId }
    );
  }

  const viewport = String(item?.viewport || '');
  const propNames = VIEWPORT_PROPS[viewport];
  if (!propNames) {
    throw new RepairError(
      'GEOMETRY_VIEWPORT_UNSUPPORTED',
      `Repair viewport ${viewport || '(missing)'} cannot map to responsive Section props.`,
      { viewport, sectionId }
    );
  }

  const target = band?.viewports?.[viewport];
  if (!isObject(target)) {
    throw new RepairError(
      'GEOMETRY_TARGET_MISSING',
      `Plan band ${sectionId} has no ${viewport} target geometry.`,
      { viewport, sectionId }
    );
  }

  const updates = {};
  if (target.height !== null && target.height !== undefined) {
    if (!allowedProps.has(propNames.height)) {
      throw new RepairError(
        'SECTION_GEOMETRY_PROP_UNSUPPORTED',
        `The live Section contract does not author ${propNames.height}.`,
        { viewport, sectionId, prop: propNames.height }
      );
    }
    updates[propNames.height] = cssPixels(target.height, `${sectionId}.${viewport}.height`);
  }
  if (target.contentInset !== null && target.contentInset !== undefined) {
    if (!allowedProps.has(propNames.inset)) {
      throw new RepairError(
        'SECTION_GEOMETRY_PROP_UNSUPPORTED',
        `The live Section contract does not author ${propNames.inset}.`,
        { viewport, sectionId, prop: propNames.inset }
      );
    }
    updates[propNames.inset] = cssPixels(target.contentInset, `${sectionId}.${viewport}.contentInset`);
  }
  if (Object.keys(updates).length === 0) {
    throw new RepairError(
      'GEOMETRY_TARGET_EMPTY',
      `Plan band ${sectionId} has no applicable ${viewport} height or content inset.`,
      { viewport, sectionId }
    );
  }

  return {
    code: item.code,
    sectionId,
    viewport,
    updates,
  };
}

function applyGeometryChange(nodeMap, change) {
  const node = nodeMap[change.sectionId];
  node.props = isObject(node.props) ? node.props : {};
  Object.assign(node.props, change.updates);
  return change;
}

function uniqueQueueItems(queue, code, identity) {
  const seen = new Set();
  const result = [];
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    if (item?.code !== code) continue;
    const key = identity(item, index);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function loadContext(iterationReportPath) {
  const repairReport = readJson(iterationReportPath, 'repair report');
  if (repairReport?.schemaVersion !== SCHEMA_VERSION) {
    throw new RepairError(
      'REPORT_SCHEMA_UNSUPPORTED',
      'Repair report must use schemaVersion 1.'
    );
  }

  let iteration = repairReport;
  let baseReportPath = iterationReportPath;
  if (repairReport.artifact === 'monteby-canonical-verification') {
    baseReportPath = resolveArtifactPath(
      iterationReportPath,
      repairReport?.files?.iterationReport,
      'canonical iteration report'
    );
    iteration = readJson(baseReportPath, 'canonical source iteration report');
  }
  if (iteration?.schemaVersion !== SCHEMA_VERSION || iteration?.artifact !== 'monteby-visual-iteration') {
    throw new RepairError(
      'ITERATION_REPORT_INVALID',
      'The repair source must be a schemaVersion 1 visual iteration or canonical verification report.'
    );
  }

  const queue = repairReport.repairQueue;
  if (!Array.isArray(queue) || queue.length === 0) {
    throw new RepairError(
      'REPAIR_QUEUE_EMPTY',
      'The report contains no repairQueue operations.'
    );
  }

  const planPath = resolveArtifactPath(baseReportPath, iteration?.files?.layoutPlan, 'layout plan');
  const candidatePath = resolveArtifactPath(
    baseReportPath,
    iteration?.files?.layout || iteration?.files?.sourceCandidateLayout,
    'candidate layout'
  );
  const contractPath = resolveArtifactPath(
    baseReportPath,
    iteration?.files?.sourceContract || iteration?.files?.contract,
    'live contract'
  );
  const plan = readJson(planPath, 'layout plan');
  if (
    plan?.schemaVersion !== SCHEMA_VERSION
    || plan?.artifact !== 'monteby-layout-plan'
    || !Array.isArray(plan.bands)
  ) {
    throw new RepairError(
      'LAYOUT_PLAN_INVALID',
      'The repair source requires a schemaVersion 1 Monteby layout plan with measured bands.'
    );
  }
  const sourceLayoutPath = resolveArtifactPath(planPath, plan.sourceLayout, 'plan source layout');

  return {
    repairReport,
    iteration,
    queue,
    plan,
    planPath,
    candidatePath,
    contractPath,
    sourceLayoutPath,
  };
}

function baseReport(options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    artifact: ARTIFACT,
    generatedAt: new Date().toISOString(),
    ok: false,
    status: 'RUNNING',
    files: {
      iterationReport: options?.iterationReport || '',
      layoutPlan: '',
      sourceLayout: '',
      candidate: '',
      contract: '',
      out: options?.out || '',
    },
    repairQueueCount: 0,
    inputLayoutSha256: '',
    outputLayoutSha256: '',
    preservedRootSections: [],
    applied: [],
    blockers: [],
    nextAction: nextAction(
      'wait_for_repair',
      '',
      [],
      [],
      'The deterministic repair application is running.'
    ),
  };
}

function blockerFromError(error) {
  if (error instanceof RepairError) {
    return {
      code: error.code,
      message: error.message,
      ...error.details,
    };
  }
  return {
    code: 'REPAIR_APPLICATION_FAILED',
    message: error instanceof Error ? error.message : String(error),
  };
}

function fail(report, status, blockers, action) {
  report.ok = false;
  report.status = status;
  report.outputLayoutSha256 = '';
  report.preservedRootSections = [];
  report.applied = [];
  report.blockers = blockers;
  report.nextAction = action;
  return report;
}

async function atomicWriteJson(target, value) {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle;
  try {
    handle = await fs.promises.open(temporary, 'wx');
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(temporary, target);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.promises.unlink(temporary).catch(() => {});
    throw new RepairError(
      'ARTIFACT_WRITE_FAILED',
      `Could not publish repaired layout atomically: ${target}`,
      { file: target, cause: error.message }
    );
  }
}

async function applyRepairQueue(options) {
  const report = baseReport(options);
  let context;
  try {
    context = loadContext(options.iterationReport);
    report.files.layoutPlan = context.planPath;
    report.files.sourceLayout = context.sourceLayoutPath;
    report.files.candidate = context.candidatePath;
    report.files.contract = context.contractPath;
    report.repairQueueCount = context.queue.length;
  } catch (error) {
    return fail(
      report,
      'INPUT_BLOCKED',
      [blockerFromError(error)],
      nextAction(
        'blocked_repair_inputs',
        '',
        [],
        ['VALID_REPAIR_INPUTS'],
        'Stop. Correct the reported artifact or schema problem, then start a new applier run.'
      )
    );
  }

  const unknown = context.queue
    .filter((item) => !ACTIONABLE_CODES.has(item?.code))
    .map((item) => ({
      code: 'UNSUPPORTED_REPAIR_CODE',
      message: `Repair queue item ${item?.code || '(missing)'} is not mechanically actionable.`,
      repairCode: item?.code || '',
      sectionId: item?.sectionId || '',
      evidence: item?.evidence || null,
    }));
  if (unknown.length > 0) {
    return fail(
      report,
      'REPAIR_BLOCKED',
      unknown,
      nextAction(
        'blocked_repair_queue',
        '',
        [],
        ['REPAIR_BLOCKERS_RESOLVED'],
        'Stop. Resolve every unsupported real blocker and obtain a new iteration report; none were skipped.'
      )
    );
  }

  try {
    const candidatePayload = readJson(context.candidatePath, 'candidate layout');
    const outputPayload = deepClone(candidatePayload);
    const nodeMap = nodeMapFromPayload(outputPayload, 'candidate layout');
    const inputNodeMap = nodeMapFromPayload(candidatePayload, 'candidate layout');
    const sourceMap = nodeMapFromPayload(
      readJson(context.sourceLayoutPath, 'plan source layout'),
      'plan source layout'
    );
    if (!Array.isArray(nodeMap?.ROOT?.nodes)) {
      throw new RepairError(
        'ROOT_NODE_LIST_INVALID',
        'Candidate ROOT.nodes must be an array.'
      );
    }
    const allowedProps = sectionAuthoringProps(readJson(context.contractPath, 'live contract'));
    const applied = [];
    report.inputLayoutSha256 = nodeMapSha256(inputNodeMap);

    const namedSectionIds = new Set();
    for (const item of context.queue) {
      if (item.code === 'restore_measured_band' || item.code === 'match_band_geometry') {
        namedSectionIds.add(planBandForItem(context.plan, item).generatedSectionId);
      } else if (item.code === 'remove_or_merge_extra_band') {
        const sectionId = String(
          item.sectionId
          || item?.evidence?.candidateRootId
          || ''
        );
        if (sectionId) namedSectionIds.add(sectionId);
      }
    }
    const preservedBefore = arrayOfStrings(inputNodeMap?.ROOT?.nodes)
      .filter((sectionId, index, roots) => (
        !namedSectionIds.has(sectionId)
        && roots.indexOf(sectionId) === index
      ))
      .map((sectionId) => ({
        sectionId,
        beforeSha256: subtreeSha256(inputNodeMap, sectionId),
      }));

    const restoreItems = uniqueQueueItems(
      context.queue,
      'restore_measured_band',
      (item) => item?.sectionId || `reference:${item?.referenceIndex}`
    ).sort((left, right) => (
      Number(planBandForItem(context.plan, left).order)
      - Number(planBandForItem(context.plan, right).order)
    ));
    for (const item of restoreItems) {
      applied.push(restoreBand(nodeMap, sourceMap, context.plan, item));
    }

    const extraItems = uniqueQueueItems(
      context.queue,
      'remove_or_merge_extra_band',
      extraIdentity
    );
    const ambiguous = extraItems
      .map((item) => proveDuplicateExtra(nodeMap, context.plan, item))
      .filter((proof) => !proof.ok)
      .map((proof) => proof.blocker);
    if (ambiguous.length > 0) {
      return fail(
        report,
        'CONTENT_SCOPE_DECISION_REQUIRED',
        ambiguous,
        nextAction(
          'blocked_content_scope',
          '',
          [],
          ['CONTENT_SCOPE_DECISION'],
          'Stop. Decide the exact owned-content scope for every non-duplicate extra band; the applier never merges or deletes it heuristically.'
        )
      );
    }
    for (const item of extraItems) {
      applied.push(removeDuplicateExtra(nodeMap, context.plan, item));
    }

    const geometryItems = uniqueQueueItems(
      context.queue,
      'match_band_geometry',
      (item) => `${item?.sectionId || item?.referenceIndex}:${item?.viewport || ''}`
    );
    const geometryChanges = geometryItems.map((item) => (
      geometryChange(nodeMap, context.plan, allowedProps, item)
    ));
    for (const change of geometryChanges) {
      applied.push(applyGeometryChange(nodeMap, change));
    }

    reachableNodeIds(nodeMap);
    const afterRoots = new Set(arrayOfStrings(nodeMap?.ROOT?.nodes));
    report.preservedRootSections = preservedBefore.map((entry) => {
      if (!afterRoots.has(entry.sectionId)) {
        throw new RepairError(
          'UNRELATED_ROOT_REMOVED',
          `Repair operations removed unrelated root ${entry.sectionId}.`,
          { sectionId: entry.sectionId }
        );
      }
      const afterSha256 = subtreeSha256(nodeMap, entry.sectionId);
      if (afterSha256 !== entry.beforeSha256) {
        throw new RepairError(
          'UNRELATED_ROOT_CHANGED',
          `Repair operations changed unrelated root ${entry.sectionId}.`,
          {
            sectionId: entry.sectionId,
            beforeSha256: entry.beforeSha256,
            afterSha256,
          }
        );
      }
      return {
        sectionId: entry.sectionId,
        beforeSha256: entry.beforeSha256,
        afterSha256,
      };
    });
    report.outputLayoutSha256 = nodeMapSha256(nodeMap);
    if (report.outputLayoutSha256 === report.inputLayoutSha256) {
      report.ok = false;
      report.status = 'REPAIR_IDEMPOTENT';
      report.applied = applied;
      report.blockers = [{
        code: 'REPAIR_IDEMPOTENT',
        message: 'Every queued repair already matches the candidate layout; no output was written and no rerun was scheduled.',
      }];
      report.nextAction = nextAction(
        'blocked_repair_idempotent',
        '',
        [],
        ['NEW_REPAIR_REPORT'],
        'Stop. Obtain a new visual iteration report with a materially different repair target.'
      );
      return report;
    }
    await atomicWriteJson(options.out, outputPayload);

    report.ok = true;
    report.status = 'REPAIRED_CANDIDATE_WRITTEN';
    report.applied = applied;
    report.blockers = [];
    report.nextAction = nextAction(
      'rerun_visual_iteration_with_repaired_candidate',
      path.join(__dirname, 'run-visual-iteration.js'),
      iterationArgsFor(context.iteration, options.out),
      [],
      'Run the exact visual iteration again with the atomically written repaired candidate.'
    );
    return report;
  } catch (error) {
    const blocker = blockerFromError(error);
    const contentScope = blocker.code === 'CONTENT_SCOPE_DECISION_REQUIRED';
    return fail(
      report,
      contentScope ? 'CONTENT_SCOPE_DECISION_REQUIRED' : 'REPAIR_BLOCKED',
      [blocker],
      contentScope
        ? nextAction(
          'blocked_content_scope',
          '',
          [],
          ['CONTENT_SCOPE_DECISION'],
          'Stop. Decide the exact owned-content scope; the applier never merges or deletes an ambiguous band.'
        )
        : nextAction(
          'blocked_repair_application',
          '',
          [],
          ['REPAIR_BLOCKERS_RESOLVED'],
          'Stop. Resolve the reported contract, plan, or graph blocker and obtain a new repair report.'
        )
    );
  }
}

function output(report, options) {
  if (options?.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`layout_repair_status=${report.status}`);
  console.log(`layout_repair_ok=${report.ok ? 'true' : 'false'}`);
  console.log(`layout_repair_out=${report.files.out}`);
  console.log(`layout_repair_next_action=${report.nextAction.id}`);
  if (report.blockers.length > 0) {
    console.log(`layout_repair_blockers=${report.blockers.length}`);
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const report = await applyRepairQueue(options);
    output(report, options);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    const fallback = baseReport(options || {
      iterationReport: '',
      out: '',
    });
    const report = fail(
      fallback,
      'INPUT_BLOCKED',
      [blockerFromError(error)],
      nextAction(
        'blocked_repair_inputs',
        '',
        [],
        ['VALID_REPAIR_INPUTS'],
        'Stop. Correct the CLI arguments, then start a new applier run.'
      )
    );
    output(report, options || { json: process.argv.includes('--json') });
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ACTIONABLE_CODES,
  applyRepairQueue,
  collectSubtreeIds,
  nodeMapFromPayload,
  parseArgs,
  proveDuplicateExtra,
  sectionAuthoringProps,
  nodeMapSha256,
  subtreeSha256,
  subtreeFingerprint,
};
