#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { isBlockedAuthoringProp } = require('./audit-monteby-layout.js');
const { PROPORTIONAL_GRID_TOKEN, measureTwoColumnGrid } = require('./measured-grid-geometry');

const REQUIRED_PARITY_SURFACES = [
  'editor schema',
  'compiler',
  'PHP renderer',
  'validation',
  'AI contract',
  'tests',
];
const LIVE_CONTRACT_ENDPOINT = 'GET /wp-json/monteby/v1/contract';

function parseArgs(argv) {
  const options = {
    contract: '',
    startReport: '',
    briefJson: '',
    referenceBrief: '',
    referenceLayouts: [],
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--contract') {
      options.contract = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--start-report') {
      options.startReport = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--brief-json') {
      options.briefJson = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-brief') {
      options.referenceBrief = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-layout') {
      options.referenceLayouts.push(path.resolve(requiredValue(argv, index += 1, arg)));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.contract) {
    throw new Error('--contract is required');
  }
  if (!options.startReport && !options.briefJson) {
    throw new Error('--start-report or --brief-json is required');
  }

  return options;
}

function requiredValue(argv, index, arg) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  audit-authoring-readiness.js --contract contract.json (--start-report benchmark-start-report.json | --brief-json visual-brief.json) [--reference-brief reference-brief.json] [--reference-layout reference-layout.json ...] [--json]

Checks whether a live Monteby contract exposes the widgets and props needed by a visual brief before clean JSON authoring starts. Optional captured reference JSON is treated only as untrusted geometry evidence.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readBrief(options) {
  if (options.briefJson) {
    return readJson(options.briefJson);
  }

  const startReport = readJson(options.startReport);
  if (!startReport.visualBrief || typeof startReport.visualBrief !== 'object') {
    throw new Error('--start-report must contain visualBrief. Re-run start-visual-benchmark.js.');
  }

  return startReport.visualBrief;
}

function readReferenceEvidence(options) {
  const startReport = options.startReport ? readJson(options.startReport) : null;
  const reportDirectory = options.startReport ? path.dirname(options.startReport) : process.cwd();
  const reportReferences = arrayOfObjects(startReport?.references);
  const referenceBriefs = [];
  const layouts = [];
  const seenLayoutFiles = new Set();

  if (options.referenceBrief) {
    referenceBriefs.push({
      value: readJson(options.referenceBrief),
      directory: path.dirname(options.referenceBrief),
    });
  }
  for (const reference of reportReferences) {
    const referenceDirectory = typeof reference.outDir === 'string' && reference.outDir.trim()
      ? path.resolve(reportDirectory, reference.outDir)
      : reportDirectory;
    if (typeof reference.briefJson === 'string' && reference.briefJson.trim()) {
      const briefFile = path.resolve(referenceDirectory, reference.briefJson);
      if (fs.existsSync(briefFile)) {
        referenceBriefs.push({ value: readJson(briefFile), directory: path.dirname(briefFile) });
      }
    } else if (reference.briefJson && typeof reference.briefJson === 'object' && !Array.isArray(reference.briefJson)) {
      referenceBriefs.push({ value: reference.briefJson, directory: referenceDirectory });
    }
  }

  for (const entry of referenceBriefs) {
    const referenceBrief = entry.value;
    if (!referenceBrief || typeof referenceBrief !== 'object' || Array.isArray(referenceBrief)) {
      continue;
    }
    if (Array.isArray(referenceBrief.renderedLayouts)) {
      appendReferenceLayoutEvidence(layouts, seenLayoutFiles, referenceBrief.renderedLayouts, entry.directory);
    } else if (referenceBrief.renderedLayout && typeof referenceBrief.renderedLayout === 'object') {
      appendReferenceLayoutEvidence(layouts, seenLayoutFiles, referenceBrief.renderedLayout, entry.directory);
    }
  }

  if (reportReferences.length > 0) {
    for (const reference of reportReferences) {
      const referenceDirectory = typeof reference.outDir === 'string' && reference.outDir.trim()
        ? path.resolve(reportDirectory, reference.outDir)
        : reportDirectory;
      appendReferenceLayoutEvidence(layouts, seenLayoutFiles, reference.layouts, referenceDirectory);
      appendReferenceLayoutEvidence(layouts, seenLayoutFiles, reference.layout, referenceDirectory);
      appendReferenceLayoutEvidence(layouts, seenLayoutFiles, reference.renderedLayouts, referenceDirectory);
      appendReferenceLayoutEvidence(layouts, seenLayoutFiles, reference.renderedLayout, referenceDirectory);
    }
  } else if (startReport) {
    appendReferenceLayoutEvidence(layouts, seenLayoutFiles, startReport.visualBrief?.renderedLayouts, reportDirectory);
    appendReferenceLayoutEvidence(layouts, seenLayoutFiles, startReport.visualBrief?.renderedLayout, reportDirectory);
    appendReferenceLayoutEvidence(layouts, seenLayoutFiles, startReport.target?.layouts, reportDirectory);
    appendReferenceLayoutEvidence(layouts, seenLayoutFiles, startReport.target?.layout, reportDirectory);
  }
  appendReferenceLayoutEvidence(layouts, seenLayoutFiles, options.referenceLayouts, process.cwd());

  const normalizedLayouts = dedupeReferenceLayoutEvidence(layouts
    .map(normalizeReferenceLayoutEvidence)
    .filter((layout) => layout.status === 'ok' && layout.viewport.width > 0 && layout.viewport.height > 0));
  const textBoxes = normalizedLayouts.flatMap((layout) => layout.textBoxes);
  const mediaBoxes = normalizedLayouts.flatMap((layout) => layout.mediaBoxes);
  const landmarks = normalizedLayouts.flatMap((layout) => layout.landmarks);
  const layoutGroups = normalizedLayouts.flatMap((layout) => layout.layoutGroups);
  const lineGeometryViewports = new Set(normalizedLayouts
    .filter((layout) => layout.textBoxes.some((box) => Array.isArray(box.lines) && box.lines.some((line) => hasRectGeometry(line?.rect))))
    .map(referenceViewportKey)).size;
  const mediaGeometryViewports = new Set(normalizedLayouts
    .filter((layout) => layout.mediaBoxes.some((box) => hasRectGeometry(box.rect)))
    .map(referenceViewportKey)).size;
  const bandGeometryViewports = new Set(normalizedLayouts
    .filter((layout) => layout.landmarks.some((landmark) => hasRectGeometry(landmark.rect)))
    .map(referenceViewportKey)).size;
  const layoutGroupGeometryViewports = new Set(normalizedLayouts
    .filter((layout) => layout.layoutGroups.some((group) => hasRectGeometry(group.rect)))
    .map(referenceViewportKey)).size;
  const coverage = firstFiniteNumber(
    normalizedLayouts
      .flatMap((layout) => [layout.firstViewportMediaCoverage])
      .filter((value) => Number.isFinite(value))
      .sort((first, second) => second - first)
  );

  const referenceBrief = referenceBriefs.find((entry) => (
    entry.value && typeof entry.value === 'object' && !Array.isArray(entry.value)
  ))?.value || null;
  const requiredMediaRoles = mergeRequiredMediaRoles(
    referenceBriefs.flatMap((entry) => normalizeRequiredMediaRoles(entry.value?.media?.requiredRoles))
      .concat(reportReferences.flatMap((reference) => normalizeRequiredMediaRoles(reference.requiredMediaRoles)))
  );
  const fixedTrackGroupKeys = referenceFixedTrackLayoutGroupKeys(normalizedLayouts);
  const proportionalGridRequirements = referenceProportionalGridRequirements(
    normalizedLayouts,
    fixedTrackGroupKeys
  );
  const layoutsByRole = new Map();
  for (const layout of normalizedLayouts.slice().sort((left, right) => right.viewport.width - left.viewport.width)) {
    const role = referenceViewportRole(layout);
    if (!layoutsByRole.has(role)) {
      layoutsByRole.set(role, layout);
    }
  }
  const desktopLayout = layoutsByRole.get('desktop')
    || normalizedLayouts.slice().sort((left, right) => right.viewport.width - left.viewport.width)[0];
  const responsiveStickyResetValues = new Set();
  for (const desktopGroup of arrayOfObjects(desktopLayout?.layoutGroups)) {
    const groupKey = String(desktopGroup?.key || '');
    if (!groupKey || desktopGroup.sticky !== true) {
      continue;
    }
    const tabletGroup = layoutsByRole.get('tablet')?.layoutGroups
      .find((group) => String(group?.key || '') === groupKey);
    const mobileGroup = layoutsByRole.get('mobile')?.layoutGroups
      .find((group) => String(group?.key || '') === groupKey);
    if (tabletGroup && tabletGroup.sticky !== true) {
      responsiveStickyResetValues.add('tablet');
    } else if (mobileGroup && mobileGroup.sticky !== true) {
      responsiveStickyResetValues.add('mobile');
    }
  }

  return {
    referenceBrief,
    layouts: normalizedLayouts,
    viewportTargets: uniqueViewportTargets(normalizedLayouts),
    textBoxes,
    mediaBoxes,
    landmarks,
    layoutGroups,
    requiredMediaRoles,
    firstViewportMediaCoverage: coverage,
    hasHeadingGeometry: textBoxes.some((box) => /^h[1-6]$/i.test(box.tag) && hasRectGeometry(box.rect)),
    hasBodyTextGeometry: textBoxes.some((box) => !/^h[1-6]$/i.test(box.tag) && hasRectGeometry(box.rect)),
    hasLineGeometry: lineGeometryViewports >= 2,
    hasMediaGeometry: mediaGeometryViewports >= 2,
    hasBandGeometry: bandGeometryViewports >= 2,
    hasLayoutGroupGeometry: layoutGroupGeometryViewports >= 2,
    hasFixedTrackGeometry: fixedTrackGroupKeys.size > 0,
    hasProportionalGridGeometry: proportionalGridRequirements.length > 0,
    proportionalGridRequirements,
    hasResponsiveStickyReset: responsiveStickyResetValues.size > 0,
    responsiveStickyResetValues: Array.from(responsiveStickyResetValues),
  };
}

function appendReferenceLayoutEvidence(layouts, seenFiles, value, baseDirectory) {
  if (Array.isArray(value)) {
    for (const item of value) {
      appendReferenceLayoutEvidence(layouts, seenFiles, item, baseDirectory);
    }
    return;
  }
  if (typeof value === 'string' && value.trim()) {
    const file = path.resolve(baseDirectory, value);
    if (!fs.existsSync(file) || seenFiles.has(file)) {
      return;
    }
    seenFiles.add(file);
    layouts.push(readJson(file));
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }

  const file = typeof value.file === 'string' && value.file.trim()
    ? path.resolve(baseDirectory, value.file)
    : '';
  if (file && fs.existsSync(file)) {
    if (seenFiles.has(file)) {
      return;
    }
    seenFiles.add(file);
    layouts.push({ ...value, layout: readJson(file) });
    return;
  }
  layouts.push(value);
}

function dedupeReferenceLayoutEvidence(layouts) {
  const uniqueLayouts = [];
  const seen = new Set();
  for (const layout of layouts) {
    const key = JSON.stringify(layout);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueLayouts.push(layout);
  }
  return uniqueLayouts;
}

function normalizeReferenceLayoutEvidence(value) {
  const layout = value && typeof value === 'object' && !Array.isArray(value) && value.layout && typeof value.layout === 'object'
    ? value.layout
    : value;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return emptyReferenceLayoutEvidence();
  }

  const summary = layout.summary && typeof layout.summary === 'object' && !Array.isArray(layout.summary)
    ? layout.summary
    : {};
  const firstViewport = layout.firstViewport && typeof layout.firstViewport === 'object' && !Array.isArray(layout.firstViewport)
    ? layout.firstViewport
    : {};
  const viewport = layout.viewport && typeof layout.viewport === 'object' && !Array.isArray(layout.viewport)
    ? layout.viewport
    : {};
  const textBoxes = arrayOfObjects(layout.textBoxes || layout.textSamples);
  const layoutGroups = arrayOfObjects(layout.layoutGroups);

  return {
    status: value?.status && value.status !== 'ok' ? value.status : 'ok',
    label: typeof value?.label === 'string' ? value.label : '',
    viewport: {
      width: finitePositive(viewport.width),
      height: finitePositive(viewport.height),
      scrollHeight: finitePositive(viewport.scrollHeight),
    },
    textBoxes,
    mediaBoxes: arrayOfObjects(layout.meaningfulMediaBoxes || layout.mediaBoxes || layout.mediaSamples),
    landmarks: arrayOfObjects(layout.landmarks),
    layoutGroups,
    firstViewportMediaCoverage: firstFiniteNumber([
      summary.meaningfulFirstViewportMediaCoverage,
      summary.firstViewportMediaCoverage,
      firstViewport.mediaCoverage,
    ]),
  };
}

function emptyReferenceLayoutEvidence() {
  return {
    status: 'missing',
    label: '',
    viewport: { width: 0, height: 0, scrollHeight: 0 },
    textBoxes: [],
    mediaBoxes: [],
    landmarks: [],
    layoutGroups: [],
    firstViewportMediaCoverage: NaN,
  };
}

function referenceFixedTrackLayoutGroupKeys(layouts) {
  const evidence = arrayOfObjects(layouts);
  const canonical = evidence.slice().sort((left, right) => right.viewport.width - left.viewport.width)[0];
  const keys = new Set();
  if (!canonical) {
    return keys;
  }
  for (const canonicalGroup of canonical.layoutGroups) {
    const groupKey = String(canonicalGroup?.key || '');
    if (!groupKey) {
      continue;
    }
    const rows = [];
    for (const layout of evidence) {
      const matchedGroup = layout.layoutGroups.find((group) => String(group?.key || '') === groupKey);
      const group = matchedGroup || canonicalGroup;
      const textBoxes = matchedGroup ? layout.textBoxes : canonical.textBoxes;
      const parentRect = group?.rect;
      if (String(group?.display || '').toLowerCase() !== 'grid' || !hasRectGeometry(parentRect)) {
        rows.length = 0;
        break;
      }
      const items = textBoxes
        .filter((box) => String(box?.parentGroupKey || '') === groupKey && hasRectGeometry(box?.rect))
        .map((box) => {
          const rect = box.rect;
          const left = Number.isFinite(Number(rect.left)) ? Number(rect.left) : Number(rect.x);
          const top = Number.isFinite(Number(rect.top)) ? Number(rect.top) : Number(rect.y);
          return {
            structureKey: String(box?.structureKey || ''),
            left,
            top,
            width: Number(rect.width),
            height: Number(rect.height),
            right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + Number(rect.width),
            bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + Number(rect.height),
          };
        })
        .filter((rect) => [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite))
        .sort((left, right) => left.left - right.left);
      if (items.length !== 2 || items[0].right > items[1].left + 4 || items[0].width > Number(parentRect.width) * 0.4) {
        rows.length = 0;
        break;
      }
      const rowOverlap = Math.max(0, Math.min(items[0].bottom, items[1].bottom) - Math.max(items[0].top, items[1].top));
      if (rowOverlap < Math.min(items[0].height, items[1].height) * 0.25) {
        rows.length = 0;
        break;
      }
      rows.push({
        fixedItemKey: items[0].structureKey,
        fixedWidth: items[0].width,
        gap: Math.max(0, items[1].left - items[0].right),
      });
    }
    if (rows.length === evidence.length && rows.every((row) => (
      Math.abs(row.fixedWidth - rows[0].fixedWidth) <= 1
      && Math.abs(row.gap - rows[0].gap) <= 1
      && (!rows[0].fixedItemKey || row.fixedItemKey === rows[0].fixedItemKey)
    ))) {
      keys.add(groupKey);
    }
  }
  return keys;
}

function referenceProportionalGridRequirements(layouts, fixedTrackGroupKeys) {
  const evidence = arrayOfObjects(layouts);
  const canonical = evidence.slice().sort((left, right) => right.viewport.width - left.viewport.width)[0];
  if (!canonical) {
    return [];
  }

  const layoutsByRole = new Map();
  for (const layout of evidence.slice().sort((left, right) => right.viewport.width - left.viewport.width)) {
    const role = referenceViewportRole(layout);
    if (!layoutsByRole.has(role)) {
      layoutsByRole.set(role, layout);
    }
  }

  const requirements = new Map();
  const viewportProps = {
    desktop: ['gridTemplateColumns', 'gridFirstColumnPercent'],
    tablet: ['gridTemplateColumnsTablet', 'gridFirstColumnPercentTablet'],
    mobile: ['gridTemplateColumnsMobile', 'gridFirstColumnPercentMobile'],
  };

  for (const canonicalGroup of canonical.layoutGroups) {
    const groupKey = String(canonicalGroup?.key || '');
    if (!groupKey || fixedTrackGroupKeys.has(groupKey)) {
      continue;
    }
    let inheritedPercent = 50;
    for (const role of ['desktop', 'tablet', 'mobile']) {
      const layout = layoutsByRole.get(role);
      const group = layout?.layoutGroups.find((candidate) => String(candidate?.key || '') === groupKey);
      if (!layout || !group) {
        continue;
      }
      const measured = measureTwoColumnGrid(group, referenceLayoutGroupItems(layout, groupKey));
      if (measured?.token !== PROPORTIONAL_GRID_TOKEN) {
        continue;
      }
      const [tokenProp, percentProp] = viewportProps[role];
      requirements.set(`option:${tokenProp}`, {
        kind: 'option',
        prop: tokenProp,
        requiredValue: PROPORTIONAL_GRID_TOKEN,
      });
      if (Number.isFinite(measured.firstColumnPercent) && measured.firstColumnPercent !== inheritedPercent) {
        requirements.set(`prop:${percentProp}`, {
          kind: 'prop',
          prop: percentProp,
        });
        inheritedPercent = measured.firstColumnPercent;
      }
    }
  }

  return [...requirements.values()];
}

function referenceViewportRole(layout) {
  const label = String(layout?.label || '').toLowerCase();
  for (const role of ['desktop', 'tablet', 'mobile']) {
    if (label === role || label.startsWith(`${role}-`)) {
      return role;
    }
  }
  const width = Number(layout?.viewport?.width || 0);
  return width <= 600 ? 'mobile' : width <= 1100 ? 'tablet' : 'desktop';
}

function referenceLayoutGroupItems(layout, groupKey) {
  const groups = layout.layoutGroups.filter((group) => (
    String(group?.parentKey || '') === groupKey && group?.flowParticipation !== 'overlay'
  ));
  const texts = layout.textBoxes.filter((box) => String(box?.parentGroupKey || '') === groupKey);
  return groups.length > 0 ? groups.concat(texts) : texts;
}

function buildContractIndex(contractPayload) {
  const raw = Array.isArray(contractPayload)
    ? contractPayload
    : contractPayload.components || contractPayload.widgets || contractPayload.catalog || [];
  const entries = Array.isArray(raw) ? raw : Object.values(raw);
  const index = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const name = String(entry.name || entry.type || entry.resolvedName || '');
    if (!name) {
      continue;
    }

    const controlMetadata = collectControlMetadata([entry.controls, entry.schema]);
    const controlProps = unique(controlMetadata.props)
      .filter((prop) => !isBlockedAuthoringProp(prop));
    const aiProps = unique(arrayOfStrings(entry.aiProps))
      .filter((prop) => !isBlockedAuthoringProp(prop));
    const props = unique(aiProps.concat(controlProps))
      .filter((prop) => !isBlockedAuthoringProp(prop));

    index.set(name, {
      name,
      props,
      aiProps,
      controlProps,
      propOptions: controlMetadata.propOptions,
      allowedParents: unique(arrayOfStrings(entry.allowedParents)),
      category: typeof entry.category === 'string' ? entry.category : '',
      categoryLabel: typeof entry.categoryLabel === 'string' ? entry.categoryLabel : '',
      origin: typeof entry.origin === 'string' ? entry.origin : '',
    });
  }

  return index;
}

function collectControlMetadata(value) {
  const props = [];
  const propOptions = new Map();

  visit(value, (item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }
    if (typeof item.type !== 'string' || !item.type.trim()) {
      return;
    }
    const itemProps = [];
    if (typeof item.prop === 'string') {
      itemProps.push(item.prop);
    }
    if (Array.isArray(item.props)) {
      itemProps.push(...arrayOfStrings(item.props));
    }
    if (item.spacingProps && typeof item.spacingProps === 'object') {
      itemProps.push(...objectKeys(item.spacingProps).map((key) => item.spacingProps[key]).filter((prop) => typeof prop === 'string'));
    }
    props.push(...itemProps);
    const optionValues = collectControlOptionValues(item.options);
    for (const prop of itemProps) {
      if (optionValues.length === 0) {
        continue;
      }
      const existing = propOptions.get(prop) || new Set();
      for (const value of optionValues) {
        existing.add(value);
      }
      propOptions.set(prop, existing);
    }
  });

  return { props, propOptions };
}

function collectControlOptionValues(options) {
  const values = Array.isArray(options)
    ? options
    : options && typeof options === 'object' ? Object.values(options) : [];
  return unique(values.map((option) => {
    if (['string', 'number', 'boolean'].includes(typeof option)) {
      return String(option);
    }
    if (option && typeof option === 'object' && ['string', 'number', 'boolean'].includes(typeof option.value)) {
      return String(option.value);
    }
    return '';
  }));
}

function visit(value, callback) {
  callback(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, callback);
    }
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      visit(child, callback);
    }
  }
}

function auditReadiness(contractIndex, brief, referenceEvidence) {
  const mediaRequirements = authoringRequiredMediaRoles(brief, referenceEvidence);
  const minimumCandidateCoverage = minimumCandidateFirstViewportMediaCoverage(brief);
  const viewportTargets = uniqueViewportTargets(
    (Array.isArray(brief.authoringRequirements?.viewportTargets)
      ? brief.authoringRequirements.viewportTargets
      : [])
      .concat(referenceEvidence.viewportTargets)
  );
  const report = {
    ok: true,
    errors: [],
    warnings: [],
    controlGaps: [],
    stats: {
      components: contractIndex.size,
      briefSections: Array.isArray(brief.visualSignals?.sections) ? brief.visualSignals.sections.length : 0,
      mediaSurfaces: Array.isArray(brief.media?.surfaces) ? brief.media.surfaces.length : 0,
      requiredMediaRoles: mediaRequirements.length,
      minimumCandidateFirstViewportMediaCoverage: minimumCandidateCoverage,
      referenceViewports: referenceEvidence.viewportTargets.length,
      referenceTextBoxes: referenceEvidence.textBoxes.length,
      referenceMediaBoxes: referenceEvidence.mediaBoxes.length,
      referenceBands: referenceEvidence.landmarks.length,
      referenceLayoutGroups: referenceEvidence.layoutGroups.length,
      referenceFixedTrackGeometry: referenceEvidence.hasFixedTrackGeometry,
      referenceProportionalGridGeometry: referenceEvidence.hasProportionalGridGeometry,
      referenceResponsiveStickyReset: referenceEvidence.hasResponsiveStickyReset,
      referenceFirstViewportMediaCoverage: Number.isFinite(referenceEvidence.firstViewportMediaCoverage)
        ? referenceEvidence.firstViewportMediaCoverage
        : null,
      ctas: referenceTextValues(brief, referenceEvidence, 'ctas').length,
      stats: referenceTextValues(brief, referenceEvidence, 'stats').length,
    },
    capabilities: [],
  };

  requireComponent(report, contractIndex, ['Section'], 'section_band', 'Root-level page bands need Section.');
  requireComponent(report, contractIndex, ['Container'], 'container_layout', 'Nested layout groups need Container.');
  requireComponent(report, contractIndex, ['Heading'], 'heading_text', 'Visual brief contains heading hierarchy.');
  requireComponent(report, contractIndex, ['Text'], 'body_text', 'Visual brief contains paragraph, label, badge, or stat text.');

  if (hasCtas(brief, referenceEvidence)) {
    requireComponent(report, contractIndex, ['ButtonBlock', 'Button'], 'cta_button', 'Visual brief contains CTA links/buttons.');
  }

  if (hasMedia(brief, referenceEvidence)) {
    requireMediaCapability(report, contractIndex, brief, referenceEvidence);
  }

  if (hasStats(brief, referenceEvidence)) {
    warnComponent(report, contractIndex, ['StatsGrid'], 'stats_grid', 'Visual brief contains stats. StatsGrid is preferred; Heading/Text fallback is acceptable but may need more manual tuning.');
  }

  requireAnyProp(report, contractIndex, ['Section'], ['paddingTop', 'paddingBottom', 'innerMaxWidth', 'innerPaddingX'], 'section_spacing', 'Section needs spacing/width controls for target rhythm.');
  requireAnyProp(report, contractIndex, ['Container'], ['layoutDisplay', 'flexDirection', 'gridTemplateColumns', 'gap', 'responsiveStack'], 'layout_controls', 'Container needs flex/grid/gap controls for target structure.');
  requireAnyProp(report, contractIndex, ['Container'], ['minHeight', 'minHeightTablet', 'minHeightMobile'], 'container_min_height', 'Container min-height controls are needed for hero/media/card vertical matching.');
  requireAnyProp(report, contractIndex, ['Heading'], ['fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile'], 'heading_typography', 'Heading needs typography controls for visual fidelity.');
  requireAnyProp(report, contractIndex, ['Text'], ['fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'textColor'], 'text_typography', 'Text needs typography controls for labels, badges, leads, and stats.');

  if (referenceEvidence.hasFixedTrackGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Container',
      ['width', 'minWidth', 'flexBasis', 'flexGrow', 'flexShrink'],
      'reference_fixed_track_geometry',
      'missing_reference_fixed_track_controls',
      'Captured fixed-plus-flexible tracks need the exact typed Container controls used by the clean flex plan.',
      'controlProps'
    );
  }

  if (referenceEvidence.hasProportionalGridGeometry) {
    requireReferenceProportionalGridControls(report, contractIndex, referenceEvidence);
  }

  if (referenceEvidence.hasResponsiveStickyReset) {
    const container = contractIndex.get('Container');
    const requiredProps = ['sticky', 'stickyTop', 'stickyResetAt'];
    const missingProps = requiredProps.filter((prop) => (
      !container?.controlProps.includes(prop) || !container?.aiProps.includes(prop)
    ));
    const resetOptions = container?.propOptions.get('stickyResetAt');
    const missingResetValues = referenceEvidence.responsiveStickyResetValues.filter((value) => (
      !(resetOptions instanceof Set) || !resetOptions.has(value)
    ));
    capability(
      report,
      'reference_responsive_sticky_reset',
      missingProps.length === 0 && missingResetValues.length === 0,
      missingProps.length === 0 && missingResetValues.length === 0
        ? 'Container exposes AI-authorable sticky controls and the measured responsive reset options.'
        : `Container cannot reproduce the measured responsive sticky reset. Missing props: ${missingProps.join(', ') || 'none'}; missing reset options: ${missingResetValues.join(', ') || 'none'}.`
    );
    if (missingProps.length > 0 || missingResetValues.length > 0) {
      error(report, 'missing_reference_responsive_sticky_controls', 'Captured desktop sticky behavior with a smaller-viewport reset needs Container sticky, stickyTop, and stickyResetAt in both editor controls and aiProps, including every measured reset option.');
      addMissingPropGaps(report, {
        code: 'missing_reference_responsive_sticky_controls',
        capability: 'reference_responsive_sticky_reset',
        component: 'Container',
        props: missingProps,
        owner: ownerForComponent(container),
      });
      for (const requiredValue of missingResetValues) {
        addControlGap(report, {
          code: 'missing_reference_responsive_sticky_controls',
          capability: 'reference_responsive_sticky_reset',
          component: 'Container',
          prop: 'stickyResetAt',
          requiredValue,
          owner: ownerForComponent(container),
        });
      }
    }
  }

  if (viewportTargets.length >= 2) {
    const responsiveGridProps = ['gridTemplateColumns', 'gridTemplateColumnsTablet', 'gridTemplateColumnsMobile'];
    for (const componentName of ['Section', 'Container']) {
      const component = contractIndex.get(componentName);
      const missingProps = responsiveGridProps.filter((prop) => !component?.props.includes(prop));
      capability(
        report,
        `${componentName.toLowerCase()}_responsive_grid`,
        missingProps.length === 0,
        missingProps.length === 0
          ? `${componentName} exposes typed desktop, tablet, and mobile grid columns.`
          : `${componentName} is missing responsive grid controls: ${missingProps.join(', ')}.`
      );
      if (missingProps.length > 0) {
        error(report, 'missing_responsive_grid_controls', `${componentName} cannot reproduce measured grid column changes across viewports. Missing: ${missingProps.join(', ')}.`);
        addMissingPropGaps(report, {
          code: 'missing_responsive_grid_controls',
          capability: `${componentName.toLowerCase()}_responsive_grid`,
          component: componentName,
          props: missingProps,
          owner: ownerForComponent(contractIndex.get(componentName)),
        });
      }
    }

    const container = contractIndex.get('Container');
    const gridPlacementProps = ['gridColumnStart', 'gridColumnSpan', 'gridRowStart', 'gridRowSpan'];
    const missingPlacementProps = gridPlacementProps.filter((prop) => !container?.props.includes(prop));
    capability(
      report,
      'container_grid_placement',
      missingPlacementProps.length === 0,
      missingPlacementProps.length === 0
        ? 'Container exposes typed grid line and span controls for controlled overlap and asymmetric composition.'
        : `Container is missing typed grid placement controls: ${missingPlacementProps.join(', ')}.`
    );
    if (missingPlacementProps.length > 0) {
      error(report, 'missing_grid_placement_controls', `Container cannot reproduce controlled grid overlap/asymmetry without classes. Missing: ${missingPlacementProps.join(', ')}.`);
      addMissingPropGaps(report, {
        code: 'missing_grid_placement_controls',
        capability: 'container_grid_placement',
        component: 'Container',
        props: missingPlacementProps,
        owner: ownerForComponent(container),
      });
    }

    const statsGrid = contractIndex.get('StatsGrid');
    if (statsGrid && hasStats(brief, referenceEvidence)) {
      const missingStatsProps = ['columns', 'columnsTablet', 'columnsMobile']
        .filter((prop) => !statsGrid.props.includes(prop));
      capability(
        report,
        'stats_responsive_columns',
        missingStatsProps.length === 0,
        missingStatsProps.length === 0
          ? 'StatsGrid exposes typed desktop, tablet, and mobile column counts.'
          : `StatsGrid is missing responsive column controls: ${missingStatsProps.join(', ')}.`
      );
      if (missingStatsProps.length > 0) {
        error(report, 'missing_stats_responsive_columns', `StatsGrid cannot reproduce measured responsive stat grids. Missing: ${missingStatsProps.join(', ')}.`);
        addMissingPropGaps(report, {
          code: 'missing_stats_responsive_columns',
          capability: 'stats_responsive_columns',
          component: 'StatsGrid',
          props: missingStatsProps,
          owner: ownerForComponent(statsGrid),
        });
      }
    }

    requireReferenceGeometryControls(report, contractIndex, referenceEvidence);
  }

  report.ok = report.errors.length === 0;
  return report;
}

function requireReferenceProportionalGridControls(report, contractIndex, referenceEvidence) {
  const component = contractIndex.get('Container');
  if (!component) {
    return;
  }

  const missing = referenceEvidence.proportionalGridRequirements.filter((requirement) => {
    if (!component.controlProps.includes(requirement.prop) || !component.aiProps.includes(requirement.prop)) {
      return true;
    }
    if (requirement.kind !== 'option') {
      return false;
    }
    const options = component.propOptions.get(requirement.prop);
    return !(options instanceof Set) || !options.has(requirement.requiredValue);
  });
  capability(
    report,
    'reference_proportional_grid_geometry',
    missing.length === 0,
    missing.length === 0
      ? 'Container exposes the measured proportional two-column token and required first-column percentage controls.'
      : `Container is missing measured proportional-grid controls: ${missing.map((item) => item.kind === 'option' ? `${item.prop}=${item.requiredValue}` : item.prop).join(', ')}.`
  );
  if (missing.length === 0) {
    return;
  }

  error(
    report,
    'missing_reference_proportional_grid_controls',
    `Captured unequal two-column grid geometry needs the typed ${PROPORTIONAL_GRID_TOKEN} token and measured first-column percentage controls. Missing: ${missing.map((item) => item.kind === 'option' ? `${item.prop} option ${item.requiredValue}` : item.prop).join(', ')}.`
  );
  for (const requirement of missing) {
    addControlGap(report, {
      code: 'missing_reference_proportional_grid_controls',
      capability: 'reference_proportional_grid_geometry',
      component: 'Container',
      prop: requirement.prop,
      requiredValue: requirement.requiredValue,
      owner: ownerForComponent(component),
    });
  }
}

function requireReferenceGeometryControls(report, contractIndex, referenceEvidence) {
  if (referenceEvidence.hasLineGeometry && referenceEvidence.hasHeadingGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Heading',
      ['fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile'],
      'reference_heading_line_geometry',
      'missing_reference_heading_controls',
      'Captured multi-viewport heading line geometry needs typed desktop, tablet, and mobile size/line-height controls.'
    );
  }

  if (referenceEvidence.hasLineGeometry && referenceEvidence.hasBodyTextGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Text',
      ['fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile'],
      'reference_text_line_geometry',
      'missing_reference_text_controls',
      'Captured multi-viewport body-text line geometry needs typed desktop, tablet, and mobile size/line-height controls.'
    );
  }

  if (referenceEvidence.hasLineGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Container',
      ['maxWidth', 'maxWidthTablet', 'maxWidthMobile'],
      'reference_text_width_geometry',
      'missing_reference_text_width_controls',
      'Captured multi-viewport line wrapping needs typed desktop, tablet, and mobile content-width controls.'
    );
  }

  if (referenceEvidence.hasBandGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Section',
      ['paddingTop', 'paddingBottom', 'paddingTopTablet', 'paddingBottomTablet', 'paddingTopMobile', 'paddingBottomMobile'],
      'reference_band_geometry',
      'missing_reference_band_controls',
      'Captured multi-viewport band geometry needs typed desktop, tablet, and mobile vertical spacing controls.'
    );
  }

  if (referenceEvidence.hasMediaGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Container',
      ['minHeight', 'minHeightTablet', 'minHeightMobile'],
      'reference_media_geometry',
      'missing_reference_media_geometry_controls',
      'Captured multi-viewport media rectangles need typed desktop, tablet, and mobile media-container height controls.'
    );
  }

  if (referenceEvidence.hasLayoutGroupGeometry) {
    requireExactProps(
      report,
      contractIndex,
      'Container',
      [
        'flexDirectionTablet',
        'flexDirectionMobile',
        'flexWrapTablet',
        'flexWrapMobile',
        'justifyContentTablet',
        'justifyContentMobile',
        'alignItemsTablet',
        'alignItemsMobile',
      ],
      'reference_responsive_flex_geometry',
      'missing_reference_responsive_flex_controls',
      'Captured multi-viewport layout groups need typed tablet and mobile flex direction, wrapping, and alignment controls.'
    );
  }
}

function hasCtas(brief, referenceEvidence) {
  return referenceTextValues(brief, referenceEvidence, 'ctas').length > 0;
}

function hasStats(brief, referenceEvidence) {
  return referenceTextValues(brief, referenceEvidence, 'stats').length > 0;
}

function hasMedia(brief, referenceEvidence) {
  return (Array.isArray(brief.media?.surfaces) && brief.media.surfaces.length > 0)
    || authoringRequiredMediaRoles(brief, referenceEvidence).length > 0
    || Number.isFinite(minimumCandidateFirstViewportMediaCoverage(brief))
    || referenceEvidence.hasMediaGeometry
    || Number.isFinite(referenceEvidence.firstViewportMediaCoverage);
}

function requireMediaCapability(report, contractIndex, brief, referenceEvidence) {
  const layoutMedia = componentWithAnyProp(contractIndex, ['Section', 'Container'], mediaSourceProps());
  const cardMedia = componentWithAnyProp(contractIndex, ['Container'], mediaSourceProps());
  const imageWidget = componentWithAnyProp(contractIndex, ['ImageBlock', 'Image', 'ImageGallery'], imageSourceProps());

  if (layoutMedia || imageWidget) {
    capability(report, 'media_surfaces', true, 'Contract can author replacement image/background surfaces.');
  } else {
    error(report, 'missing_media_capability', 'Visual brief has media roles but the contract exposes no Section/Container background image prop and no image widget with image/src/items props.');
    addControlGap(report, {
      code: 'missing_media_capability',
      capability: 'media_surfaces',
      candidates: [
        { component: 'Section', props: mediaSourceProps() },
        { component: 'Container', props: mediaSourceProps() },
        { component: 'ImageBlock', props: imageSourceProps() },
      ],
      owner: 'core',
    });
    capability(report, 'media_surfaces', false, 'Missing image/background authoring capability.');
  }

  const requiredRoles = authoringRequiredMediaRoles(brief, referenceEvidence);
  if (requiredRoleMinimum(requiredRoles, 'secondary') > 0) {
    requireRoleMediaSurface(
      report,
      cardMedia || imageWidget,
      'secondary_media_surfaces',
      'missing_secondary_media_capability',
      'The visual brief requires a secondary first-viewport photo. The contract needs Container background media or an ImageBlock/ImageGallery-style widget, not only Section background media.',
      [
        { component: 'Container', props: mediaSourceProps() },
        { component: 'ImageBlock', props: imageSourceProps() },
        { component: 'ImageGallery', props: imageSourceProps() },
      ]
    );
  }
  if (requiredRoleMinimum(requiredRoles, 'service-card') > 0) {
    requireRoleMediaSurface(
      report,
      cardMedia || imageWidget,
      'service_card_media_surfaces',
      'missing_service_card_media_capability',
      'The visual brief requires service-card photo surfaces. The contract needs repeatable card-level media through Container background media or ImageBlock/ImageGallery-style widgets; Section background media alone cannot model service cards.',
      [
        { component: 'Container', props: mediaSourceProps() },
        { component: 'ImageBlock', props: imageSourceProps() },
        { component: 'ImageGallery', props: imageSourceProps() },
      ]
    );
  }

  const minimumCoverage = minimumCandidateFirstViewportMediaCoverage(brief);
  const measuredCoverage = firstFiniteNumber([minimumCoverage, referenceEvidence.firstViewportMediaCoverage]);
  if (Number.isFinite(measuredCoverage) && measuredCoverage >= 0.12) {
    const cropControl = componentWithAnyProp(contractIndex, ['Section', 'Container'], mediaCropProps())
      || componentWithAnyProp(contractIndex, ['ImageBlock', 'Image', 'ImageGallery'], imageCropProps());
    capability(report, 'media_crop_controls', Boolean(cropControl), cropControl ? `${cropControl.name} exposes crop/fit controls for first-viewport media matching.` : 'Missing crop/fit controls for large first-viewport media.');
    if (!cropControl) {
      error(report, 'missing_media_crop_controls', 'The visual brief requires significant first-viewport media coverage, but the contract exposes no backgroundPosition/backgroundSize or objectFit/objectPosition-style crop controls.');
      addControlGap(report, {
        code: 'missing_media_crop_controls',
        capability: 'media_crop_controls',
        candidates: [
          { component: 'Section', props: mediaCropProps() },
          { component: 'Container', props: mediaCropProps() },
          { component: 'ImageBlock', props: imageCropProps() },
        ],
        owner: 'core',
      });
    }
  }
}

function requireRoleMediaSurface(report, found, capabilityName, errorCode, message, candidates) {
  capability(report, capabilityName, Boolean(found), found ? `${found.name} can author this media role.` : message);
  if (!found) {
    error(report, errorCode, message);
    addControlGap(report, {
      code: errorCode,
      capability: capabilityName,
      candidates,
      owner: 'core',
    });
  }
}

function authoringRequiredMediaRoles(brief, referenceEvidence = null) {
  const roles = Array.isArray(brief.authoringRequirements?.requiredMediaRoles)
    ? brief.authoringRequirements.requiredMediaRoles
    : Array.isArray(brief.media?.requiredRoles)
      ? brief.media.requiredRoles
      : [];

  return mergeRequiredMediaRoles(
    normalizeRequiredMediaRoles(roles)
      .concat(Array.isArray(referenceEvidence?.requiredMediaRoles) ? referenceEvidence.requiredMediaRoles : [])
  );
}

function requiredRoleMinimum(requiredRoles, roleName) {
  return requiredRoles
    .filter((role) => role.role.toLowerCase() === roleName.toLowerCase())
    .reduce((maximum, role) => Math.max(maximum, role.minSurfaces), 0);
}

function minimumCandidateFirstViewportMediaCoverage(brief) {
  const value = brief.authoringRequirements?.firstViewportMediaCoverage?.minimumCandidate;
  return Number.isFinite(value) ? value : null;
}

function mediaSourceProps() {
  return ['backgroundImage', 'backgroundMedia', 'backgroundVideoPoster', 'image', 'media', 'src', 'url'];
}

function imageSourceProps() {
  return ['src', 'image', 'images', 'items', 'url'];
}

function mediaCropProps() {
  return ['backgroundSize', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY', 'objectFit', 'objectPosition'];
}

function imageCropProps() {
  return ['objectFit', 'objectPosition', 'imageObjectFit', 'imageObjectPosition', 'imageWidth', 'imageHeight', 'width', 'height', 'aspectRatio', 'imageAspectRatio'];
}

function requireComponent(report, contractIndex, names, capabilityName, message) {
  const found = findComponent(contractIndex, names);
  capability(report, capabilityName, Boolean(found), found ? `Uses ${found.name}.` : message);
  if (!found) {
    error(report, 'missing_component', `${message} Missing one of: ${names.join(', ')}.`);
    addControlGap(report, {
      code: 'missing_component',
      capability: capabilityName,
      component: names[0],
      acceptableComponents: names,
      owner: 'core',
    });
  }
}

function warnComponent(report, contractIndex, names, capabilityName, message) {
  const found = findComponent(contractIndex, names);
  capability(report, capabilityName, Boolean(found), found ? `Uses ${found.name}.` : message);
  if (!found) {
    warning(report, 'missing_preferred_component', `${message} Missing one of: ${names.join(', ')}.`);
  }
}

function requireAnyProp(report, contractIndex, names, props, capabilityName, message) {
  const found = componentWithAnyProp(contractIndex, names, props);
  capability(report, capabilityName, Boolean(found), found ? `${found.name} exposes one of: ${props.join(', ')}.` : message);
  if (!found) {
    error(report, 'missing_authoring_prop', `${message} Missing ${props.join(', ')} on ${names.join(', ')}.`);
    addControlGap(report, {
      code: 'missing_authoring_prop',
      capability: capabilityName,
      component: names.length === 1 ? names[0] : null,
      candidates: names.map((component) => ({ component, props })),
      owner: names.length === 1 ? ownerForComponent(contractIndex.get(names[0])) : 'core',
    });
  }
}

function requireExactProps(report, contractIndex, componentName, props, capabilityName, errorCode, message, propCollection = 'props') {
  const component = contractIndex.get(componentName);
  if (!component) {
    return;
  }

  const availableProps = Array.isArray(component[propCollection]) ? component[propCollection] : [];
  const missingProps = props.filter((prop) => !availableProps.includes(prop));
  capability(
    report,
    capabilityName,
    missingProps.length === 0,
    missingProps.length === 0
      ? `${componentName} exposes the measured geometry controls.`
      : `${componentName} is missing measured geometry controls: ${missingProps.join(', ')}.`
  );
  if (missingProps.length === 0) {
    return;
  }

  error(report, errorCode, `${message} Missing: ${missingProps.join(', ')}.`);
  addMissingPropGaps(report, {
    code: errorCode,
    capability: capabilityName,
    component: componentName,
    props: missingProps,
    owner: ownerForComponent(component),
  });
}

function findComponent(contractIndex, names) {
  for (const name of names) {
    if (contractIndex.has(name)) {
      return contractIndex.get(name);
    }
  }

  return null;
}

function componentWithAnyProp(contractIndex, names, props) {
  for (const name of names) {
    const entry = contractIndex.get(name);
    if (!entry) {
      continue;
    }
    if (props.some((prop) => entry.props.includes(prop))) {
      return entry;
    }
  }

  return null;
}

function hasAnyProp(contractIndex, names, props) {
  return Boolean(componentWithAnyProp(contractIndex, names, props));
}

function capability(report, name, ok, message) {
  report.capabilities.push({ name, ok, message });
}

function error(report, code, message) {
  report.errors.push({ code, message });
}

function warning(report, code, message) {
  report.warnings.push({ code, message });
}

function addMissingPropGaps(report, details) {
  for (const prop of details.props) {
    addControlGap(report, {
      code: details.code,
      capability: details.capability,
      component: details.component,
      prop,
      owner: details.owner,
    });
  }
}

function addControlGap(report, details) {
  const component = typeof details.component === 'string' && details.component ? details.component : null;
  const prop = typeof details.prop === 'string' && details.prop ? details.prop : null;
  const requiredValue = ['string', 'number', 'boolean'].includes(typeof details.requiredValue)
    ? details.requiredValue
    : null;
  const capabilityName = typeof details.capability === 'string' && details.capability ? details.capability : details.code;
  const owner = ['core', 'builder', 'child-theme'].includes(details.owner) ? details.owner : 'core';
  const target = component && prop
    ? `${component}.${prop}${requiredValue === null ? '' : `=${requiredValue}`}`
    : component || capabilityName;
  const gap = {
    code: details.code,
    capability: capabilityName,
    component,
    prop,
    ...(requiredValue === null ? {} : { requiredValue }),
    owner,
    requiredParitySurfaces: [...REQUIRED_PARITY_SURFACES],
    resumeCondition: `${target} must land across every required parity surface. Fetch a refreshed ${LIVE_CONTRACT_ENDPOINT}, rerun audit-authoring-readiness.js, and resume authoring only after the refreshed contract removes this gap.`,
  };

  if (Array.isArray(details.acceptableComponents)) {
    gap.acceptableComponents = unique(arrayOfStrings(details.acceptableComponents));
  }
  if (Array.isArray(details.candidates)) {
    gap.candidates = details.candidates
      .filter((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate))
      .map((candidate) => ({
        component: typeof candidate.component === 'string' ? candidate.component : '',
        props: unique(arrayOfStrings(candidate.props)),
      }))
      .filter((candidate) => candidate.component);
  }

  const duplicate = report.controlGaps.some((candidate) => (
    candidate.code === gap.code
    && candidate.capability === gap.capability
    && candidate.component === gap.component
    && candidate.prop === gap.prop
    && (candidate.requiredValue ?? null) === (gap.requiredValue ?? null)
  ));
  if (!duplicate) {
    report.controlGaps.push(gap);
  }
}

function ownerForComponent(component) {
  if (!component || typeof component !== 'object') {
    return 'core';
  }

  const category = String(component.category || '').toLowerCase();
  const categoryLabel = String(component.categoryLabel || '').toLowerCase();
  const origin = String(component.origin || '').toLowerCase();
  return category === 'custom' || categoryLabel === 'custom' || origin === 'child-theme'
    ? 'child-theme'
    : 'core';
}

function referenceTextValues(brief, referenceEvidence, key) {
  return unique(
    arrayOfStrings(brief.text?.[key])
      .concat(arrayOfStrings(referenceEvidence.referenceBrief?.text?.[key]))
  );
}

function normalizeRequiredMediaRoles(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles
    .map((role) => ({
      role: typeof role?.role === 'string' ? role.role.trim() : '',
      minSurfaces: Number.isFinite(role?.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1,
      placement: typeof role?.placement === 'string' ? role.placement.trim() : '',
    }))
    .filter((role) => role.role);
}

function mergeRequiredMediaRoles(roles) {
  const merged = new Map();
  for (const role of roles) {
    const key = `${role.role.toLowerCase()}::${role.placement.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing || role.minSurfaces > existing.minSurfaces) {
      merged.set(key, role);
    }
  }
  return [...merged.values()];
}

function uniqueViewportTargets(values) {
  const targets = [];
  const seen = new Set();
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const viewport = value.viewport && typeof value.viewport === 'object' && !Array.isArray(value.viewport)
      ? value.viewport
      : value;
    const width = finitePositive(viewport.width);
    const height = finitePositive(viewport.height);
    if (width <= 0 || height <= 0) {
      continue;
    }
    const key = `${width}x${height}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    targets.push({
      label: typeof value.label === 'string' ? value.label : '',
      width,
      height,
      scrollHeight: finitePositive(viewport.scrollHeight),
    });
  }
  return targets;
}

function referenceViewportKey(layout) {
  return `${finitePositive(layout?.viewport?.width)}x${finitePositive(layout?.viewport?.height)}`;
}

function hasRectGeometry(rect) {
  return Boolean(
    rect
    && typeof rect === 'object'
    && !Array.isArray(rect)
    && finitePositive(rect.width) > 0
    && finitePositive(rect.height) > 0
  );
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function firstFiniteNumber(values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return NaN;
}

function arrayOfObjects(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function objectKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function printReport(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`monteby_authoring_readiness=${report.ok ? 'ok' : 'failed'}`);
  console.log(`components=${report.stats.components}`);
  for (const item of report.errors) {
    console.log(`error ${item.code}: ${item.message}`);
  }
  for (const item of report.warnings) {
    console.log(`warning ${item.code}: ${item.message}`);
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const contract = readJson(options.contract);
    const brief = readBrief(options);
    const referenceEvidence = readReferenceEvidence(options);
    const report = auditReadiness(buildContractIndex(contract), brief, referenceEvidence);
    printReport(report, options.json);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
