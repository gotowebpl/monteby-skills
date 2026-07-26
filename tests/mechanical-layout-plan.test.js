#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
  assert.deepEqual(plan.completion, {
    capturedBands: 2,
    draftedRootSections: 2,
    allBandsMapped: true,
    plannedBands: 2,
    emittedSections: 2,
    truncated: false,
    omittedBands: [],
    omittedMedia: [],
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
  assert.deepEqual(plan.viewports.map((viewport) => viewport.label), ['desktop', 'tablet', 'mobile']);
  assert.equal(plan.bands.every((band) => (
    band.generatedSectionId
    && band.viewports.desktop
    && band.viewports.tablet
    && band.viewports.mobile
  )), true);
  assert.deepEqual(plan.completion, {
    capturedBands: 40,
    draftedRootSections: 40,
    allBandsMapped: true,
    plannedBands: 40,
    emittedSections: 40,
    truncated: false,
    omittedBands: [],
    omittedMedia: [],
  });
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
      const measurement = {
        index,
        key: `band.${String(index + 1).padStart(2, '0')}`,
        tag: index === 0 ? 'header' : index === count - 1 ? 'footer' : 'section',
        rect: rect(0, top, width, bandHeight),
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
        texts: [],
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
