#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const draftScript = path.join(root, 'monteby-site-authoring', 'scripts', 'draft-monteby-layout.js');

test('plan-out records every generic measured band and viewport without truncation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-mechanical-plan-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'mechanical-layout-plan.json');

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(genericMeasuredBrief()));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  assert.equal(report.planOut, planPath);
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.artifact, 'monteby-layout-plan');
  assert.equal(plan.sourceLayout, layoutPath);
  assert.equal(plan.sourceLayoutDigestFormat, 'sha256:json-stringify-node-map');
  assert.equal(plan.sourceLayoutSha256, nodeMapSha256(layout));
  assert.equal(plan.mode, 'generic-measured-reference');
  assert.deepEqual(plan.canonicalViewport, {
    label: 'desktop',
    width: 1440,
    height: 900,
    pageHeight: 500,
    bandCount: 2,
  });
  assert.deepEqual(plan.viewports.map((viewport) => viewport.label), ['desktop', 'tablet', 'mobile']);
  assert.deepEqual(plan.rootSectionIds, layout.ROOT.nodes);
  assert.equal(plan.bands.length, 2);
  assert.deepEqual(plan.bands.map((band) => ({
    order: band.order,
    sourceKey: band.sourceKey,
    tag: band.tag,
    generatedSectionId: band.generatedSectionId,
  })), [
    { order: 0, sourceKey: 'band.hero', tag: 'header', generatedSectionId: layout.ROOT.nodes[0] },
    { order: 1, sourceKey: 'band.body', tag: 'section', generatedSectionId: layout.ROOT.nodes[1] },
  ]);
  assert.deepEqual(plan.bands[0].viewports.desktop, {
    rect: rect(0, 0, 1440, 300),
    top: 0,
    height: 300,
    width: 1440,
    contentInset: 120,
    columns: 1,
    display: 'block',
    textCount: 0,
    mediaCount: 0,
    groupCount: 0,
    paintedBackground: true,
  });
  assert.equal(plan.bands[1].viewports.tablet.top, 220);
  assert.equal(plan.bands[1].viewports.tablet.height, 260);
  assert.equal(plan.bands[1].viewports.mobile.width, 390);
  assert.equal(plan.bands[1].viewports.mobile.contentInset, 20);
  assert.deepEqual(plan.bands.map((band) => band.surfaceMappings), [[], []]);
  assert.deepEqual(plan.bands.map((band) => band.surfaceParity), [
    emptySurfaceParity(),
    emptySurfaceParity(),
  ]);
  assert.deepEqual(plan.completion, {
    capturedBands: 2,
    draftedRootSections: 2,
    allBandsMapped: true,
    allSurfacesMapped: true,
    plannedBands: 2,
    emittedSections: 2,
    capturedSurfaces: emptySurfaceCounts(),
    authoredSurfaces: emptySurfaceCounts(),
    truncated: false,
    omittedBands: [],
    omittedMedia: [],
    omittedText: [],
    omittedGroups: [],
    omittedChildren: [],
  });
});

test('plan-out records specialized root section ids and mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-specialized-plan-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'mechanical-layout-plan.json');

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
    text: {
      h1: ['A clear place to begin.'],
      h2: [],
      h3: [],
      ctas: [],
      stats: [],
    },
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: { requiredMediaRoles: [] },
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.artifact, 'monteby-layout-plan');
  assert.equal(plan.sourceLayout, layoutPath);
  assert.equal(plan.sourceLayoutDigestFormat, 'sha256:json-stringify-node-map');
  assert.equal(plan.sourceLayoutSha256, nodeMapSha256(layout));
  assert.equal(plan.mode, 'specialized-or-generated');
  assert.deepEqual(plan.rootSectionIds, layout.ROOT.nodes);
  assert.equal(plan.rootSectionIds.length >= 2, true);
  assert.equal(plan.completion.emittedSections, plan.rootSectionIds.length);
  assert.equal(plan.completion.truncated, false);
});

test('plan-out preserves a 40-band complex page at all three canonical responsive widths', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-long-mechanical-plan-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(longGenericMeasuredBrief(40)));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.equal(layout.ROOT.nodes.length, 40);
  assert.equal(plan.bands.length, 40);
  assert.equal(plan.sourceLayoutSha256, nodeMapSha256(layout));
  assert.deepEqual(plan.viewports.map((viewport) => viewport.label), ['desktop', 'tablet', 'mobile']);
  assert.equal(plan.bands.every((band) => (
    band.generatedSectionId
    && band.viewports.desktop
    && band.viewports.tablet
    && band.viewports.mobile
  )), true);
  const textMappings = plan.bands.flatMap((band) => (
    band.surfaceMappings.filter((mapping) => mapping.kind === 'text')
  ));
  assert.equal(textMappings.length, 40);
  assert.equal(new Set(textMappings.map((mapping) => mapping.structureKey)).size, 40);
  assert.equal(textMappings.every((mapping) => (
    layout[mapping.generatedNodeId]
    && ['Heading', 'Text'].includes(mapping.generatedComponent)
    && mapping.strategy === 'text-leaf'
    && mapping.lowered === false
    && mapping.viewports.join(',') === 'desktop,tablet,mobile'
  )), true);
  assert.equal(plan.bands.every((band) => band.surfaceParity.complete), true);
  assert.equal(plan.bands.every((band) => (
    band.surfaceParity.captured.text === 1
    && band.surfaceParity.authored.text === 1
    && band.surfaceParity.omitted.text.length === 0
  )), true);
  assert.deepEqual(plan.completion, {
    capturedBands: 40,
    draftedRootSections: 40,
    allBandsMapped: true,
    allSurfacesMapped: true,
    plannedBands: 40,
    emittedSections: 40,
    capturedSurfaces: { text: 40, media: 0, group: 0, child: 0 },
    authoredSurfaces: { text: 40, media: 0, group: 0, child: 0 },
    truncated: false,
    omittedBands: [],
    omittedMedia: [],
    omittedText: [],
    omittedGroups: [],
    omittedChildren: [],
  });
});

test('generic authoring preserves more than 32 text surfaces instead of truncating them', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-mechanical-texts-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');
  const brief = genericMeasuredBrief();
  brief.authoringRequirements.preserveSourceText = true;

  for (const [viewport, geometry] of Object.entries(brief.authoringRequirements.referenceGeometry)) {
    const band = geometry.bands[0];
    const inset = Number(band.contentInset || 0);
    band.texts = Array.from({ length: 40 }, (_, index) => ({
      structureKey: `${band.key}.text.${String(index + 1).padStart(2, '0')}`,
      tag: 'p',
      text: `${viewport} text surface ${index + 1}`,
      rect: rect(inset, band.rect.top + index * 5, 180, 5),
      color: 'rgb(15, 23, 42)',
      fontSize: '12px',
      lineHeight: '12px',
      fontWeight: '400',
    }));
  }

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const authoredTextNodes = Object.values(layout)
    .filter((node) => node?.type?.resolvedName === 'Text');
  const preservedSourceTexts = authoredTextNodes
    .map((node) => node?.props?.text)
    .filter((text) => typeof text === 'string' && text.startsWith('desktop text surface '));
  assert.equal(plan.bands[0].viewports.desktop.textCount, 40);
  assert.equal(preservedSourceTexts.length, 40);
  assert.deepEqual(plan.completion.omittedText, []);
});

test('plan binds every stable group, media, child, and text surface to an authored descendant', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-deep-mechanical-plan-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(deepGenericMeasuredBrief()));
  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.equal(plan.sourceLayoutSha256, nodeMapSha256(layout));
  const expectedSurfaces = new Map([
    ['band.hero.group.card', {
      kind: 'group', band: 0, strategy: 'group-container', lowered: false,
    }],
    ['band.hero.group.card.text.title', {
      kind: 'text', band: 0, strategy: 'text-leaf', lowered: false,
    }],
    ['band.hero.media.product', {
      kind: 'media', band: 0, strategy: 'group-background', lowered: true,
    }],
    ['band.body.child.card', {
      kind: 'child', band: 1, strategy: 'child-container', lowered: false,
    }],
    ['band.body.child.card.text.copy', {
      kind: 'text', band: 1, strategy: 'text-leaf', lowered: false,
    }],
  ]);
  const mappings = plan.bands.flatMap((band) => (
    band.surfaceMappings.map((mapping) => ({ ...mapping, band: band.order }))
  ));

  assert.equal(mappings.length, expectedSurfaces.size);
  assert.equal(new Set(mappings.map((mapping) => (
    `${mapping.kind}:${mapping.structureKey}`
  ))).size, expectedSurfaces.size);
  for (const mapping of mappings) {
    const expected = expectedSurfaces.get(mapping.structureKey);
    assert.ok(expected, `Unexpected mapped surface ${mapping.kind}:${mapping.structureKey}`);
    assert.equal(mapping.kind, expected.kind);
    assert.equal(mapping.band, expected.band);
    assert.equal(mapping.strategy, expected.strategy);
    assert.equal(mapping.lowered, expected.lowered);
    if (!mapping.lowered) {
      assert.equal(mapping.stableNodeKey, mapping.structureKey);
    }
    assert.ok(layout[mapping.generatedNodeId], `Missing node ${mapping.generatedNodeId}`);
    assert.equal(
      isDescendantOf(layout, mapping.generatedNodeId, plan.bands[expected.band].generatedSectionId),
      true,
      `${mapping.structureKey} must belong to its planned Section`
    );
    assert.deepEqual(mapping.viewports, ['desktop', 'tablet', 'mobile']);
  }
  assert.deepEqual(plan.bands[0].surfaceParity, {
    captured: { text: 1, media: 1, group: 1, child: 0 },
    authored: { text: 1, media: 1, group: 1, child: 0 },
    omitted: { text: [], media: [], group: [], child: [] },
    complete: true,
  });
  assert.deepEqual(plan.bands[1].surfaceParity, {
    captured: { text: 1, media: 0, group: 0, child: 1 },
    authored: { text: 1, media: 0, group: 0, child: 1 },
    omitted: { text: [], media: [], group: [], child: [] },
    complete: true,
  });
  assert.deepEqual(plan.completion.capturedSurfaces, {
    text: 2,
    media: 1,
    group: 1,
    child: 1,
  });
  assert.deepEqual(plan.completion.authoredSurfaces, plan.completion.capturedSurfaces);
  assert.equal(plan.completion.allSurfacesMapped, true);
  assert.deepEqual(plan.completion.omittedText, []);
  assert.deepEqual(plan.completion.omittedMedia, []);
  assert.deepEqual(plan.completion.omittedGroups, []);
  assert.deepEqual(plan.completion.omittedChildren, []);
});

test('mobile-only captured surfaces are reported as omissions for fail-closed validation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-mobile-only-surface-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');
  const brief = genericMeasuredBrief();
  const mobileBand = brief.authoringRequirements.referenceGeometry.mobile.bands[0];
  mobileBand.texts = [{
    structureKey: 'band.hero.text.mobile-only',
    tag: 'p',
    text: 'Visible only on mobile',
    rect: rect(20, mobileBand.rect.top + 20, 300, 24),
    color: 'rgb(15, 23, 42)',
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: '400',
  }];

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.deepEqual(plan.bands[0].surfaceMappings, []);
  assert.deepEqual(plan.bands[0].surfaceParity, {
    captured: { text: 1, media: 0, group: 0, child: 0 },
    authored: emptySurfaceCounts(),
    omitted: {
      text: ['band.hero.text.mobile-only'],
      media: [],
      group: [],
      child: [],
    },
    complete: false,
  });
  assert.equal(plan.completion.allSurfacesMapped, false);
  assert.deepEqual(plan.completion.capturedSurfaces, {
    text: 1,
    media: 0,
    group: 0,
    child: 0,
  });
  assert.deepEqual(plan.completion.authoredSurfaces, emptySurfaceCounts());
  assert.deepEqual(plan.completion.omittedText, [{
    bandIndex: 0,
    structureKey: 'band.hero.text.mobile-only',
    viewports: ['mobile'],
  }]);
});

test('unkeyed captured surfaces fail before layout or plan artifacts are written', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-unkeyed-surface-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');
  const brief = genericMeasuredBrief();
  for (const geometry of Object.values(brief.authoringRequirements.referenceGeometry)) {
    const band = geometry.bands[0];
    band.texts = [{
      tag: 'p',
      text: 'Captured without a stable key',
      rect: rect(
        Number(band.contentInset || 0),
        band.rect.top + 20,
        Math.min(420, Number(band.contentWidth || 420)),
        24
      ),
    }];
  }

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[generic_surface_key_missing\].*text surface lacks a stable structureKey\/key/);
  assert.equal(fs.existsSync(layoutPath), false);
  assert.equal(fs.existsSync(planPath), false);
});

test('generic text above the per-band limit fails instead of writing a truncated plan', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-mechanical-text-limit-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'layout-plan.json');
  const brief = genericMeasuredBrief();
  brief.authoringRequirements.referenceGeometry.desktop.bands[0].texts = Array.from(
    { length: 257 },
    (_, index) => ({ text: `Text ${index + 1}` })
  );

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[generic_reference_text_limit_exceeded\].*257 text surfaces.*at most 256/);
  assert.equal(fs.existsSync(layoutPath), false);
  assert.equal(fs.existsSync(planPath), false);
});

test('generic media above the per-band limit fails instead of writing a truncated plan', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-mechanical-media-limit-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const planPath = path.join(directory, 'mechanical-layout-plan.json');
  const brief = genericMeasuredBrief();
  brief.authoringRequirements.referenceGeometry.desktop.bands[0].media = Array.from(
    { length: 25 },
    (_, index) => ({ source: `https://example.test/media-${index + 1}.jpg` })
  );

  fs.writeFileSync(contractPath, JSON.stringify(minimalContract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--plan-out', planPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[generic_reference_media_limit_exceeded\].*25 meaningful media surfaces.*at most 24/);
  assert.equal(fs.existsSync(layoutPath), false);
  assert.equal(fs.existsSync(planPath), false);
});

function genericMeasuredBrief() {
  const viewports = [
    ['desktop', 1440, 900, [300, 200], [120, 120]],
    ['tablet', 834, 800, [220, 260], [48, 48]],
    ['mobile', 390, 720, [180, 320], [20, 20]],
  ];
  const referenceGeometry = {};

  for (const [label, width, height, bandHeights, contentInsets] of viewports) {
    let top = 0;
    referenceGeometry[label] = {
      viewport: { width, height },
      pageHeight: bandHeights.reduce((sum, bandHeight) => sum + bandHeight, 0),
      documentStyle: {
        backgroundColor: 'rgb(248, 250, 252)',
        color: 'rgb(15, 23, 42)',
      },
      bands: bandHeights.map((bandHeight, index) => {
        const measurement = {
          index,
          key: index === 0 ? 'band.hero' : 'band.body',
          tag: index === 0 ? 'header' : 'section',
          rect: rect(0, top, width, bandHeight),
          viewportWidth: width,
          fullWidth: true,
          leadingOffset: 0,
          precedingPaintedGap: 0,
          precedingOverlap: 0,
          flowHeight: bandHeight,
          backgroundColor: index === 0 ? 'rgb(226, 232, 240)' : 'rgb(248, 250, 252)',
          paintedBackground: true,
          display: index === 0 ? 'block' : 'flex',
          contentInset: contentInsets[index],
          contentWidth: width - contentInsets[index] * 2,
          columns: 1,
          mediaCount: 0,
          media: [],
          texts: [],
          groups: [],
          children: [],
        };
        top += bandHeight;
        return measurement;
      }),
    };
  }

  return {
    target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
    text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generic-measured-reference',
        family: '',
        familyMechanics: false,
      },
      referenceGeometry,
    },
  };
}

function longGenericMeasuredBrief(count) {
  const brief = genericMeasuredBrief();
  const viewportInputs = [
    ['desktop', 1440, 1200, 120],
    ['tablet', 834, 1112, 48],
    ['mobile', 390, 844, 20],
  ];
  brief.authoringRequirements.referenceGeometry = {};

  for (const [label, width, height, inset] of viewportInputs) {
    let top = 0;
    const bands = Array.from({ length: count }, (_, index) => {
      const bandHeight = (label === 'mobile' ? 150 : 110) + (index % 4) * 10;
      const bandKey = `band.${String(index + 1).padStart(2, '0')}`;
      const bandTop = top;
      const measurement = {
        index,
        key: bandKey,
        tag: index === 0 ? 'header' : index === count - 1 ? 'footer' : 'section',
        rect: rect(0, bandTop, width, bandHeight),
        viewportWidth: width,
        fullWidth: true,
        leadingOffset: 0,
        precedingPaintedGap: 0,
        precedingOverlap: 0,
        flowHeight: bandHeight,
        backgroundColor: index % 2 === 0 ? 'rgb(248, 250, 252)' : 'rgb(241, 245, 249)',
        paintedBackground: true,
        display: index % 3 === 0 ? 'grid' : 'block',
        contentInset: inset,
        contentWidth: width - inset * 2,
        columns: label === 'mobile' ? 1 : index % 3 === 0 ? 3 : 1,
        mediaCount: 0,
        media: [],
        texts: [{
          structureKey: `${bandKey}.text.01`,
          tag: index === 0 ? 'h1' : 'p',
          text: `Measured band ${index + 1}`,
          rect: rect(
            inset,
            bandTop + 20,
            Math.max(120, Math.min(width - inset * 2, label === 'mobile' ? 300 : 540)),
            30
          ),
          color: 'rgb(15, 23, 42)',
          fontSize: index === 0 ? '28px' : '16px',
          lineHeight: index === 0 ? '32px' : '24px',
          fontWeight: index === 0 ? '700' : '400',
        }],
        groups: [],
        children: [],
      };
      top += bandHeight;
      return measurement;
    });
    brief.authoringRequirements.referenceGeometry[label] = {
      viewport: { width, height },
      pageHeight: top,
      documentStyle: {
        backgroundColor: 'rgb(248, 250, 252)',
        color: 'rgb(15, 23, 42)',
      },
      bands,
    };
  }

  return brief;
}

function deepGenericMeasuredBrief() {
  const brief = genericMeasuredBrief();
  brief.authoringRequirements.preserveSourceText = true;
  brief.authoringRequirements.reuseSourceMedia = true;

  for (const geometry of Object.values(brief.authoringRequirements.referenceGeometry)) {
    const [hero, body] = geometry.bands;
    const heroInset = Number(hero.contentInset || 0);
    const heroGroupWidth = Math.min(640, hero.rect.width - heroInset * 2);
    const heroGroupRect = rect(
      heroInset,
      hero.rect.top + 24,
      heroGroupWidth,
      Math.max(120, hero.rect.height - 48)
    );
    const groupKey = 'band.hero.group.card';
    const groupText = {
      structureKey: `${groupKey}.text.title`,
      tag: 'h2',
      text: 'Measured group title',
      rect: rect(
        heroGroupRect.left + 18,
        heroGroupRect.top + 18,
        Math.max(100, heroGroupRect.width * 0.45),
        34
      ),
      color: 'rgb(15, 23, 42)',
      fontSize: '26px',
      lineHeight: '32px',
      fontWeight: '700',
    };
    hero.groups = [{
      key: groupKey,
      structureKey: groupKey,
      tag: 'article',
      rect: heroGroupRect,
      flowParticipation: 'normal',
      display: 'flex',
      flexDirection: 'column',
      columns: 1,
      gap: '12px',
      paddingTop: '16px',
      paddingRight: '16px',
      paddingBottom: '16px',
      paddingLeft: '16px',
      backgroundColor: 'rgb(255, 255, 255)',
      texts: [groupText],
      media: [],
      groups: [],
      children: [],
    }];
    hero.texts = [];
    hero.children = [];
    hero.media = [{
      structureKey: 'band.hero.media.product',
      parentGroupKey: groupKey,
      mediaKind: 'img',
      source: 'https://example.test/product.jpg',
      rect: { ...heroGroupRect },
      flowParticipation: 'normal',
      objectFit: 'cover',
      borderRadius: '8px',
    }];
    hero.mediaCount = 1;

    const bodyInset = Number(body.contentInset || 0);
    const childKey = 'band.body.child.card';
    const childRect = rect(
      bodyInset,
      body.rect.top + 24,
      Math.max(120, body.rect.width - bodyInset * 2),
      Math.max(120, body.rect.height - 48)
    );
    body.groups = [];
    body.texts = [];
    body.media = [];
    body.mediaCount = 0;
    body.children = [{
      key: childKey,
      structureKey: childKey,
      tag: 'article',
      rect: childRect,
      display: 'grid',
      columns: 1,
      gap: '10px',
      paddingTop: '14px',
      paddingRight: '14px',
      paddingBottom: '14px',
      paddingLeft: '14px',
      backgroundColor: 'rgb(241, 245, 249)',
      texts: [{
        structureKey: `${childKey}.text.copy`,
        tag: 'p',
        text: 'Measured child copy',
        rect: rect(childRect.left + 14, childRect.top + 14, childRect.width - 28, 28),
        color: 'rgb(15, 23, 42)',
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '400',
      }],
      media: [],
      groups: [],
      children: [],
    }];
  }

  return brief;
}

function minimalContract() {
  const sectionProps = [
    'tag',
    'responsiveDisplay',
    'innerMaxWidth',
    'innerPaddingX',
    'innerPaddingXTablet',
    'innerPaddingXMobile',
    'minHeight',
    'minHeightTablet',
    'minHeightMobile',
    'paddingTop',
    'paddingTopTablet',
    'paddingTopMobile',
    'paddingBottom',
    'paddingBottomTablet',
    'paddingBottomMobile',
    'backgroundColor',
    'backgroundImage',
    'backgroundSize',
    'backgroundPosition',
    'backgroundPositionX',
    'backgroundPositionY',
    'backgroundPositionXTablet',
    'backgroundPositionYTablet',
    'backgroundPositionXMobile',
    'backgroundPositionYMobile',
    'backgroundOverlay',
  ];
  const containerProps = [
    'layoutDisplay',
    'flexDirection',
    'flexDirectionTablet',
    'flexDirectionMobile',
    'flexWrap',
    'flexWrapTablet',
    'flexWrapMobile',
    'justifyContent',
    'justifyContentTablet',
    'justifyContentMobile',
    'alignItems',
    'alignItemsTablet',
    'alignItemsMobile',
    'gap',
    'gapTablet',
    'gapMobile',
    'responsiveStack',
    'responsiveDisplay',
    'width',
    'maxWidth',
    'maxWidthTablet',
    'maxWidthMobile',
    'minWidth',
    'minHeight',
    'minHeightTablet',
    'minHeightMobile',
    'paddingTop',
    'paddingTopTablet',
    'paddingTopMobile',
    'paddingRight',
    'paddingRightTablet',
    'paddingRightMobile',
    'paddingBottom',
    'paddingBottomTablet',
    'paddingBottomMobile',
    'paddingLeft',
    'paddingLeftTablet',
    'paddingLeftMobile',
    'borderRadius',
    'borderWidth',
    'borderColor',
    'backgroundColor',
    'backgroundImage',
    'backgroundSize',
    'backgroundPosition',
    'backgroundPositionX',
    'backgroundPositionY',
    'backgroundPositionXTablet',
    'backgroundPositionYTablet',
    'backgroundPositionXMobile',
    'backgroundPositionYMobile',
    'backgroundOverlay',
    'flexBasis',
    'flexGrow',
    'flexShrink',
    'gridTemplateColumns',
    'gridTemplateColumnsTablet',
    'gridTemplateColumnsMobile',
    'gridColumnStart',
    'gridColumnStartTablet',
    'gridColumnStartMobile',
    'gridColumnSpan',
    'gridColumnSpanTablet',
    'gridColumnSpanMobile',
    'gridRowStart',
    'gridRowStartTablet',
    'gridRowStartMobile',
    'gridRowSpan',
    'gridRowSpanTablet',
    'gridRowSpanMobile',
  ];
  const headingProps = [
    'text',
    'content',
    'children',
    'tag',
    'fontSize',
    'fontSizeTablet',
    'fontSizeMobile',
    'lineHeight',
    'lineHeightTablet',
    'lineHeightMobile',
    'letterSpacing',
    'letterSpacingTablet',
    'letterSpacingMobile',
    'fontWeight',
    'textColor',
    'marginTop',
    'marginTopTablet',
    'marginTopMobile',
    'marginBottom',
    'marginBottomTablet',
    'marginBottomMobile',
  ];
  const textProps = [
    'text',
    'content',
    'children',
    'display',
    'fontSize',
    'fontSizeTablet',
    'fontSizeMobile',
    'lineHeight',
    'lineHeightTablet',
    'lineHeightMobile',
    'letterSpacing',
    'letterSpacingTablet',
    'letterSpacingMobile',
    'fontWeight',
    'textColor',
    'marginTop',
    'marginTopTablet',
    'marginTopMobile',
    'marginBottom',
    'marginBottomTablet',
    'marginBottomMobile',
  ];

  return {
    components: [
      component('Section', ['ROOT'], sectionProps),
      component('Container', ['Section', 'Container'], containerProps),
      component('Heading', ['Container'], headingProps),
      component('Text', ['Container'], textProps),
    ],
  };
}

function component(name, allowedParents, props) {
  return { name, allowedParents, props, aiProps: props };
}

function rect(x, y, width, height) {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  };
}

function nodeMapSha256(layout) {
  return createHash('sha256').update(JSON.stringify(layout)).digest('hex');
}

function emptySurfaceCounts() {
  return { text: 0, media: 0, group: 0, child: 0 };
}

function emptySurfaceParity() {
  return {
    captured: emptySurfaceCounts(),
    authored: emptySurfaceCounts(),
    omitted: { text: [], media: [], group: [], child: [] },
    complete: true,
  };
}

function isDescendantOf(layout, nodeId, ancestorId) {
  let currentId = nodeId;
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    if (currentId === ancestorId) {
      return true;
    }
    visited.add(currentId);
    currentId = layout[currentId]?.parent;
  }
  return false;
}
