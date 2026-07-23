#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const renderScript = path.join(root, 'monteby-site-authoring', 'scripts', 'render-monteby-preview.js');

function renderPreview(layout, prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const layoutPath = path.join(directory, 'layout.json');
  const previewPath = path.join(directory, 'preview.html');
  fs.writeFileSync(layoutPath, JSON.stringify(layout));

  const result = spawnSync(process.execPath, [
    renderScript,
    '--layout',
    layoutPath,
    '--out',
    previewPath,
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  return fs.readFileSync(previewPath, 'utf8');
}

test('preview renderer writes safe static HTML from a Monteby node map', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-preview-render-'));
  const layoutPath = path.join(directory, 'layout.json');
  const previewPath = path.join(directory, 'preview.html');
  const fragmentPath = path.join(directory, 'fragment.html');

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {
        tag: 'header',
        innerMaxWidth: '1200px',
        innerPaddingX: '20px',
        backgroundColor: '#f7f7f4',
        backgroundImage: 'https://cdn.example.test/hero.png',
        backgroundOverlay: 'rgba(0,0,0,.18)',
        backgroundAccentType: 'radial',
        backgroundAccentColor1: '#ffdd67',
        backgroundAccentColor2: 'rgba(255,221,103,0)',
        backgroundAccentPositionX: '70%',
        backgroundAccentPositionY: '24%',
        backgroundAccentSize: '34%',
        backgroundType: 'image',
        gradientType: 'linear',
        gradientAngle: 105,
        gradientColor1: '#e8fbef',
        gradientColor2: '#fbffdf',
        backgroundSize: 'cover',
        paddingTop: '40px',
        paddingBottom: '40px',
      },
      parent: 'ROOT',
      nodes: ['container-1'],
    },
    'container-1': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        layoutDisplay: 'flex',
        responsiveStack: 'tablet',
        flexDirection: 'row',
        flexDirectionTablet: 'column',
        flexDirectionMobile: 'row-reverse',
        flexWrap: 'wrap',
        flexWrapTablet: 'nowrap',
        flexWrapMobile: 'wrap-reverse',
        justifyContent: 'space-between',
        justifyContentTablet: 'center',
        justifyContentMobile: 'flex-end',
        alignItems: 'center',
        alignItemsTablet: 'stretch',
        alignItemsMobile: 'flex-start',
        gap: '24px',
        gapTablet: '18px',
        backgroundImage: 'https://cdn.example.test/equipment.png',
        backgroundPositionX: '-80px',
        backgroundPositionY: '50%',
        backgroundPositionXTablet: '-30px',
        backgroundPositionYTablet: '45%',
        backgroundPositionXMobile: '-50px',
        backgroundPositionYMobile: '40%',
        paddingTopTablet: '32px',
        paddingRightTablet: '24px',
        paddingBottomTablet: '28px',
        paddingLeftTablet: '24px',
        marginTopTablet: '0px',
        marginBottomTablet: '12px',
        marginTopMobile: '4px',
        marginBottomMobile: '0px',
        gridTemplateColumns: 'sidebar-left-280',
        gridTemplateColumnsTablet: 'two',
        gridTemplateColumnsMobile: 'one',
        gridColumnStart: 2,
        gridColumnSpan: 3,
        gridRowStart: 1,
        gridRowSpan: 2,
        gridColumnStartTablet: 1,
        gridColumnSpanTablet: 2,
        gridColumnStartMobile: 1,
        gridColumnSpanMobile: 1,
        gridRowStartTablet: 2,
        gridRowSpanTablet: 1,
        gridRowStartMobile: 1,
        gridRowSpanMobile: 2,
        boxShadow: 'shadow-md',
        boxShadowOffsetX: '0px',
        boxShadowOffsetY: '34px',
        boxShadowBlur: '70px',
        boxShadowSpread: '0px',
        boxShadowColor: 'rgba(15,23,42,.16)',
        boxShadowInset: false,
        sticky: true,
        stickyTop: '24px',
        stickyResetAt: 'tablet',
      },
      parent: 'section-1',
      nodes: ['gradient-1', 'divider-1', 'badge-1', 'heading-1', 'button-1'],
    },
    'gradient-1': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        backgroundType: 'gradient',
        gradientType: 'linear',
        gradientAngle: 105,
        gradientColor1: '#e8fbef',
        gradientColor2: '#fbffdf',
        backgroundAccentType: 'radial',
        backgroundAccentColor1: '#ffdd67',
        backgroundAccentColor2: 'rgba(255,221,103,0)',
        backgroundAccentPositionX: '70%',
        backgroundAccentPositionY: '24%',
        backgroundAccentSize: '34%',
        minHeight: '80px',
      },
      parent: 'container-1',
      nodes: [],
    },
    'divider-1': {
      type: { resolvedName: 'Divider' },
      isCanvas: false,
      props: {
        dividerWidth: '100%',
        dividerThickness: '1px',
        dividerStyle: 'solid',
        dividerColor: 'rgba(49,95,79,.22)',
        dividerAlign: 'left',
        dividerMargin: '0px',
      },
      parent: 'container-1',
      nodes: [],
    },
    'badge-1': {
      type: { resolvedName: 'Text' },
      isCanvas: false,
      props: {
        display: 'inline-block',
        responsiveDisplay: 'show-mobile-only',
        text: 'Service',
        backgroundColor: '#ffdd67',
        paddingY: '8px',
        paddingX: '12px',
        borderRadius: '999px',
        marginBottom: '16px',
        fontFamily: 'Poppins',
      },
      parent: 'container-1',
      nodes: [],
    },
    'heading-1': {
      type: { resolvedName: 'Heading' },
      isCanvas: false,
      props: {
        tag: 'h1',
        text: 'Maidy <Fresh>',
        fontSize: '62px',
        fontSizeMobile: '42px',
        responsiveDisplay: 'show-tablet-down-only',
        textColor: '#315f4f',
        fontFamily: 'Plus_Jakarta_Sans',
      },
      parent: 'container-1',
      nodes: [],
    },
    'button-1': {
      type: { resolvedName: 'ButtonBlock' },
      isCanvas: false,
      props: {
        label: 'Get started',
        url: '#contact',
        backgroundColor: '#315f4f',
        textColor: '#ffffff',
      },
      parent: 'container-1',
      nodes: [],
    },
  }));

  const result = spawnSync(process.execPath, [
    renderScript,
    '--layout',
    layoutPath,
    '--out',
    previewPath,
    '--fragment-out',
    fragmentPath,
    '--title',
    'Maidy Preview',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(previewPath, 'utf8');
  const fragment = fs.readFileSync(fragmentPath, 'utf8');

  assert.match(html, /<title>Maidy Preview<\/title>/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/);
  assert.match(html, /family=Plus\+Jakarta\+Sans:wght@100;200;300;400;500;600;700;800;900&amp;family=Poppins:wght@100;200;300;400;500;600;700;800;900&amp;display=swap/);
  assert.doesNotMatch(html, /family=Inter:/);
  assert.match(html, /<header/);
  assert.match(html, /max-width:1200px/);
  assert.match(html, /radial-gradient\(circle at 70% 24%,#ffdd67 0,rgba\(255,221,103,0\) 34%\)/);
  assert.match(html, /linear-gradient\(rgba\(0,0,0,\.18\),rgba\(0,0,0,\.18\)\)/);
  assert.match(html, /url\(&quot;https:\/\/cdn\.example\.test\/hero\.png&quot;\)/);
  assert.match(html, /linear-gradient\(105deg,#e8fbef,#fbffdf\)/);
  assert.match(html, /background-image:linear-gradient\(rgba\(0,0,0,\.18\),rgba\(0,0,0,\.18\)\),url\(&quot;https:\/\/cdn\.example\.test\/hero\.png&quot;\)/);
  assert.match(html, /background-image:radial-gradient\(circle at 70% 24%,#ffdd67 0,rgba\(255,221,103,0\) 34%\),linear-gradient\(105deg,#e8fbef,#fbffdf\)/);
  assert.doesNotMatch(html, /hero\.png[^\"]*radial-gradient/);
  assert.match(html, /background-size:auto,cover/);
  assert.match(html, /background-size:auto,auto/);
  assert.match(html, /background-position:center,center/);
  assert.match(html, /background-repeat:no-repeat,repeat/);
  assert.match(html, /<hr style="width:100%;border-top:1px solid rgba\(49,95,79,\.22\);border-right:none;border-bottom:none;border-left:none;margin-top:0px;margin-right:auto;margin-bottom:0px;margin-left:0">/);
  assert.match(html, /monteby-stack-tablet/);
  assert.match(html, /monteby-show-mobile-only/);
  assert.match(html, /monteby-show-tablet-down-only/);
  assert.match(html, /@media \(min-width: 901px\)\{\.monteby-show-tablet-down-only\{display:none!important\}\}/);
  assert.match(html, /@media \(min-width: 768px\)\{\.monteby-show-mobile-only\{display:none!important\}\}/);
  assert.match(html, /@media \(max-width: 767px\)\{\.monteby-stack-mobile/);
  assert.match(html, /\.monteby-stack-tablet>\*\{width:100%!important;max-width:100%!important;flex-basis:auto!important\}/);
  assert.match(html, /\.monteby-stack-mobile>\*\{width:100%!important;max-width:100%!important;flex-basis:auto!important\}/);
  assert.match(html, /display:inline-block/);
  assert.match(html, /padding-top:8px/);
  assert.match(html, /padding-right:12px/);
  assert.match(html, /margin-bottom:16px/);
  assert.match(html, /--monteby-gap-tablet:18px/);
  assert.match(html, /--monteby-padding-right-tablet:24px/);
  assert.match(html, /--monteby-margin-top-tablet:0px/);
  assert.match(html, /--monteby-margin-bottom-tablet:12px/);
  assert.match(html, /--monteby-margin-top-mobile:4px/);
  assert.match(html, /--monteby-margin-bottom-mobile:0px/);
  assert.match(html, /margin-top:var\(--monteby-margin-top-tablet\)!important/);
  assert.match(html, /margin-bottom:var\(--monteby-margin-bottom-mobile\)!important/);
  assert.match(html, /flex-direction:row/);
  assert.match(html, /flex-wrap:wrap/);
  assert.match(html, /justify-content:space-between/);
  assert.match(html, /align-items:center/);
  assert.match(html, /--monteby-flex-direction-tablet:column/);
  assert.match(html, /--monteby-flex-direction-mobile:row-reverse/);
  assert.match(html, /--monteby-flex-wrap-tablet:nowrap/);
  assert.match(html, /--monteby-flex-wrap-mobile:wrap-reverse/);
  assert.match(html, /--monteby-justify-content-tablet:center/);
  assert.match(html, /--monteby-justify-content-mobile:flex-end/);
  assert.match(html, /--monteby-align-items-tablet:stretch/);
  assert.match(html, /--monteby-align-items-mobile:flex-start/);
  assert.match(html, /flex-direction:var\(--monteby-flex-direction-tablet\)!important/);
  assert.match(html, /flex-wrap:var\(--monteby-flex-wrap-mobile\)!important/);
  assert.match(html, /justify-content:var\(--monteby-justify-content-tablet\)!important/);
  assert.match(html, /align-items:var\(--monteby-align-items-mobile\)!important/);
  assert.match(html, /background-position-x:-80px/);
  assert.match(html, /background-position-y:50%/);
  assert.match(html, /--monteby-background-position-x-tablet:-30px/);
  assert.match(html, /--monteby-background-position-y-tablet:45%/);
  assert.match(html, /--monteby-background-position-x-mobile:-50px/);
  assert.match(html, /--monteby-background-position-y-mobile:40%/);
  assert.match(html, /background-position-x:var\(--monteby-background-position-x-tablet\)!important/);
  assert.match(html, /background-position-y:var\(--monteby-background-position-y-mobile\)!important/);
  assert.match(html, /grid-template-columns:280px minmax\(0,1fr\)/);
  assert.match(html, /grid-column:2 \/ span 3/);
  assert.match(html, /grid-row:1 \/ span 2/);
  assert.match(html, /--monteby-grid-template-columns-tablet:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /--monteby-grid-template-columns-mobile:repeat\(1,minmax\(0,1fr\)\)/);
  assert.match(html, /--monteby-grid-column-tablet:1 \/ span 2/);
  assert.match(html, /--monteby-grid-column-mobile:1 \/ span 1/);
  assert.match(html, /--monteby-grid-row-tablet:2 \/ span 1/);
  assert.match(html, /--monteby-grid-row-mobile:1 \/ span 2/);
  assert.match(html, /grid-template-columns:var\(--monteby-grid-template-columns-tablet\)!important/);
  assert.match(html, /grid-column:var\(--monteby-grid-column-mobile\)!important/);
  assert.match(html, /grid-row:var\(--monteby-grid-row-mobile\)!important/);
  assert.match(html, /box-shadow:0px 34px 70px 0px rgba\(15,23,42,\.16\)/);
  assert.match(html, /class="monteby-stack-tablet monteby-sticky-reset-tablet"/);
  assert.match(html, /position:sticky;top:24px/);
  assert.match(html, /@media \(max-width: 900px\)\{\.monteby-sticky-reset-tablet\{position:static!important;top:auto!important\}\}/);
  assert.match(html, /Maidy &lt;Fresh&gt;/);
  assert.match(html, /font-family:&quot;Plus Jakarta Sans&quot;,sans-serif/);
  assert.doesNotMatch(html, /Maidy <Fresh>/);
  assert.match(html, /href="#contact"/);
  assert.match(fragment, /^<header/);
});

test('preview renderer keeps Section and Container padding inside authored dimensions', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {
        width: '100%',
        minHeight: '931px',
        paddingTop: '118px',
        paddingLeft: '40px',
        paddingRight: '40px',
        innerMaxWidth: '100%',
        innerPaddingX: '32px',
        boxSizing: 'content-box',
      },
      parent: 'ROOT',
      nodes: ['container-1'],
    },
    'container-1': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        width: '100%',
        minHeight: '931px',
        paddingTop: '118px',
        paddingLeft: '24px',
        paddingRight: '24px',
        boxSizing: 'content-box',
      },
      parent: 'section-1',
      nodes: [],
    },
  }, 'monteby-preview-layout-box-sizing-');

  assert.match(html, /<section style="box-sizing:border-box;[^\"]*width:100%;[^\"]*min-height:931px;[^\"]*padding-top:118px;[^\"]*padding-right:40px;[^\"]*padding-left:40px/);
  assert.match(html, /<div style="box-sizing:border-box;max-width:100%;margin-left:auto;margin-right:auto;padding-left:32px;padding-right:32px">/);
  assert.match(html, /<div style="box-sizing:border-box;[^\"]*width:100%;[^\"]*min-height:931px;[^\"]*padding-top:118px;[^\"]*padding-right:24px;[^\"]*padding-left:24px/);
  assert.doesNotMatch(html, /box-sizing:content-box|boxSizing/);
});

test('preview renderer inherits responsive Container margin-left resets through explicit zero values', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['tablet-reset', 'mobile-reset'],
    },
    'tablet-reset': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: { marginLeft: '255px', marginLeftTablet: '0px' },
      parent: 'ROOT',
      nodes: [],
    },
    'mobile-reset': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: { marginLeft: '545.6px', marginLeftTablet: '120px', marginLeftMobile: '0px' },
      parent: 'ROOT',
      nodes: [],
    },
  }, 'monteby-preview-responsive-margin-left-');
  const tabletResetTag = html.match(/<div style="[^"]*margin-left:255px[^"]*">/u)?.[0] || '';
  const mobileResetTag = html.match(/<div style="[^"]*margin-left:545\.6px[^"]*">/u)?.[0] || '';

  assert.match(tabletResetTag, /--monteby-margin-left-tablet:0px/u);
  assert.doesNotMatch(tabletResetTag, /--monteby-margin-left-mobile/u);
  assert.match(mobileResetTag, /--monteby-margin-left-tablet:120px/u);
  assert.match(mobileResetTag, /--monteby-margin-left-mobile:0px/u);
  assert.match(html, /\[style\*="--monteby-margin-left-tablet"\]\{margin-left:var\(--monteby-margin-left-tablet\)!important\}/u);
  assert.match(html, /\[style\*="--monteby-margin-left-mobile"\]\{margin-left:var\(--monteby-margin-left-mobile\)!important\}/u);
});

test('preview renderer keeps MultilineHeading semantic and sanitizes responsive line offsets with inheritance', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['heading-1'],
    },
    'heading-1': {
      type: { resolvedName: 'MultilineHeading' },
      isCanvas: false,
      props: {
        tag: 'h1',
        fontSize: '72px',
        lineHeight: '1',
        lines: [
          {
            text: 'Clear <Vision>.',
            color: '#18332d',
            marginLeft: '-1.25rem',
            marginLeftTablet: '120px',
          },
          {
            text: 'Unsafe offsets stay inert.',
            color: 'javascript:alert(1)',
            marginLeft: '10vh',
            marginLeftTablet: '1px;color:red',
            marginLeftMobile: 'url(evil)',
          },
          {
            text: 'Supported responsive units.',
            color: '#0f7768',
            marginLeft: '12.5%',
            marginLeftMobile: '-3vw',
          },
        ],
      },
      parent: 'ROOT',
      nodes: [],
    },
  }, 'monteby-preview-multiline-heading-');
  const headingTags = html.match(/<h1(?:\s|>)/gu) || [];

  assert.equal(headingTags.length, 1);
  assert.match(html, /<h1[^>]*><span class="gotoweb-margin-left--responsive"/u);
  assert.match(html, /Clear &lt;Vision&gt;\.<\/span><\/span><br><span style="color:#1f1d1b">Unsafe offsets stay inert\.<\/span>/u);
  assert.match(html, /margin-left:-1\.25rem;--gotoweb-margin-left-base:-1\.25rem;--gotoweb-margin-left-tablet:120px;--gotoweb-margin-left-mobile:120px/u);
  assert.match(html, /margin-left:12\.5%;--gotoweb-margin-left-base:12\.5%;--gotoweb-margin-left-tablet:12\.5%;--gotoweb-margin-left-mobile:-3vw/u);
  assert.match(html, /@media \(max-width:900px\)\{\.gotoweb-margin-left--responsive\{margin-left:var\(--gotoweb-margin-left-tablet,var\(--gotoweb-margin-left-base\)\)!important\}\}/u);
  assert.match(html, /@media \(max-width:767px\)\{\.gotoweb-margin-left--responsive\{margin-left:var\(--gotoweb-margin-left-mobile,var\(--gotoweb-margin-left-tablet,var\(--gotoweb-margin-left-base\)\)\)!important\}\}/u);
  assert.doesNotMatch(html, /monteby-multiline-heading__line|--monteby-multiline-line-margin-left/u);
  assert.doesNotMatch(html, /10vh|color:red|url\(evil\)|javascript:alert/u);
});

test('preview renderer resolves proportional grid presets across responsive viewports', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['container-1', 'container-2', 'container-3'],
    },
    'container-1': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        layoutDisplay: 'grid',
        gridTemplateColumns: 'two-proportional',
        gridFirstColumnPercent: 5,
        gridFirstColumnPercentTablet: 72.4,
        gridFirstColumnPercentMobile: 100,
      },
      parent: 'ROOT',
      nodes: [],
    },
    'container-2': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        layoutDisplay: 'grid',
        gridTemplateColumns: 'two-proportional',
        gridTemplateColumnsMobile: 'one',
        gridFirstColumnPercent: 54,
      },
      parent: 'ROOT',
      nodes: [],
    },
    'container-3': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        layoutDisplay: 'grid',
        gridTemplateColumns: 'repeat(12,1fr)',
      },
      parent: 'ROOT',
      nodes: [],
    },
  }, 'monteby-preview-proportional-grid-');

  assert.match(html, /grid-template-columns:minmax\(0,10fr\) minmax\(0,90fr\)/);
  assert.match(html, /--monteby-grid-template-columns-tablet:minmax\(0,72fr\) minmax\(0,28fr\)/);
  assert.match(html, /--monteby-grid-template-columns-mobile:minmax\(0,90fr\) minmax\(0,10fr\)/);
  assert.match(html, /grid-template-columns:minmax\(0,54fr\) minmax\(0,46fr\)/);
  assert.match(html, /--monteby-grid-template-columns-tablet:minmax\(0,54fr\) minmax\(0,46fr\)/);
  assert.match(html, /--monteby-grid-template-columns-mobile:repeat\(1,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html, /grid-template-columns:two-proportional/);
  assert.doesNotMatch(html, /grid-template-columns:repeat\(12,1fr\)/);
});

test('preview renderer renders StatsGrid authoring props and responsive columns', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: ['stats-1'],
    },
    'stats-1': {
      type: { resolvedName: 'StatsGrid' },
      isCanvas: false,
      props: {
        items: [
          { label: 'Patients & families', value: '10K' },
          {
            label: 'Static label',
            dynamicLabel: 'patient_label',
            value: 'Static value',
            dynamicValue: 'patient_total',
            icon: 'trending_up',
            iconPosition: 'before',
            iconGap: '6px',
            iconSize: '1.1em',
            iconColor: '#0f7768',
          },
          { label: 'Years', value: '15', icon: 'M0 0L24 24' },
        ],
        columns: 3,
        columnsTablet: 2,
        columnsMobile: 1,
        cellBg: '#f7fff0',
        cellPadding: 18,
        borderColor: '#c8ddbd',
        borderRadius: '14px',
        labelColor: '#526271',
        valueColor: '#061a27',
        accentColor: '#2fd678',
        iconSize: '0.9em',
        metricOrder: 'value-label',
        labelFontSize: '13px',
        labelFontWeight: 600,
        labelLetterSpacing: '0.04em',
        labelTextTransform: 'capitalize',
        valueFontSize: '48px',
        valueLineHeight: 1.05,
        valueFontWeight: 800,
        valueLetterSpacing: '0',
        className: 'legacy-stats',
        cssId: 'legacy-stats-id',
        labelClassName: 'legacy-label',
        valueClassName: 'legacy-value',
      },
      parent: 'section-1',
      nodes: [],
    },
  }, 'monteby-preview-stats-grid-');

  assert.match(html, /family=Material\+Symbols\+Rounded:opsz,wght,FILL,GRAD@20\.\.48,100\.\.700,0\.\.1,-50\.\.200/);
  assert.match(html, /<dl class="gotoweb-grid-template-columns--responsive" style="display:grid;grid-template-columns:repeat\(3, minmax\(0, 1fr\)\);--gotoweb-grid-template-columns-base:repeat\(3, minmax\(0, 1fr\)\);--gotoweb-grid-template-columns-tablet:repeat\(2, minmax\(0, 1fr\)\);--gotoweb-grid-template-columns-mobile:repeat\(1, minmax\(0, 1fr\)\)/);
  assert.match(html, /background:#c8ddbd;border:1px solid #c8ddbd;border-radius:14px;overflow:hidden/);
  assert.match(html, /<div style="background:#f7fff0;padding:18px;display:flex;flex-direction:column;gap:4px">/);
  assert.match(html, /<dt style="color:#526271;font-size:13px;font-weight:600;letter-spacing:0\.04em;text-transform:capitalize;margin:0;order:2">Patients &amp; families<\/dt>/);
  assert.match(html, /<dd style="color:#061a27;font-size:48px;line-height:1\.05;font-weight:800;letter-spacing:0;margin:0;order:1"><span>10K<\/span><\/dd>/);
  assert.match(html, /patient_label<\/dt><dd[^>]*><span style="display:inline-flex;align-items:center;gap:6px"><span class="material-symbols-rounded"[^>]*>trending_up<\/span>patient_total<\/span><\/dd>/);
  assert.match(html, /@media \(max-width: 900px\)\{\.gotoweb-grid-template-columns--responsive\{grid-template-columns:var\(--gotoweb-grid-template-columns-tablet,var\(--gotoweb-grid-template-columns-base\)\)!important\}\}/);
  assert.match(html, /@media \(max-width: 767px\)\{\.gotoweb-grid-template-columns--responsive\{grid-template-columns:var\(--gotoweb-grid-template-columns-mobile,var\(--gotoweb-grid-template-columns-tablet,var\(--gotoweb-grid-template-columns-base\)\)\)!important\}\}/);
  assert.doesNotMatch(html, /Static label|Static value|M0 0L24 24|legacy-stats|legacy-label|legacy-value|legacy-stats-id/);
});

test('preview renderer rejects raw StatsGrid style inputs and keeps props-first fallbacks', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: ['stats-1'],
    },
    'stats-1': {
      type: { resolvedName: 'StatsGrid' },
      isCanvas: false,
      props: {
        items: [{ label: 'Safe label', value: '128' }],
        cellBg: 'linear-gradient(red, blue)',
        cellPadding: 'calc(100% - 1px)',
        borderColor: 'url(https://evil.test/border.png)',
        borderRadius: 'var(--runtime-radius)',
        labelFontSize: '12px;color:red',
        valueFontSize: 'expression(alert(1))',
        iconSize: 'clamp(1rem, 2vw, 2rem)',
        className: 'raw-utility-string',
      },
      parent: 'section-1',
      nodes: [],
    },
  }, 'monteby-preview-stats-grid-unsafe-');

  assert.match(html, /background:#e4e4e7;border:1px solid #e4e4e7;border-radius:12px/);
  assert.match(html, /background:#ffffff;padding:24px/);
  assert.match(html, /font-size:12px/);
  assert.match(html, /font-size:2rem/);
  assert.doesNotMatch(html, /linear-gradient\(red|calc\(|evil\.test|runtime-radius|color:red|expression\(|clamp\(|raw-utility-string/i);
});

test('preview renderer uses a system default and never fetches generic or arbitrary families', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: ['system-heading', 'arbitrary-text'],
    },
    'system-heading': {
      type: { resolvedName: 'Heading' },
      isCanvas: false,
      props: {
        tag: 'h1',
        text: 'System family',
        fontFamily: 'ui-sans-serif',
      },
      parent: 'section-1',
      nodes: [],
    },
    'arbitrary-text': {
      type: { resolvedName: 'Text' },
      isCanvas: false,
      props: {
        text: 'Arbitrary family',
        fontFamily: 'Private Source Family',
      },
      parent: 'section-1',
      nodes: [],
    },
  }, 'monteby-preview-system-font-');

  assert.match(html, /body\{[^}]*font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif/);
  assert.match(html, /<h1 style="[^"]*font-family:system-ui,-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,sans-serif/);
  assert.match(html, /font-family:&quot;Private Source Family&quot;,sans-serif/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(html, /family=(?:ui-sans-serif|Private\+Source\+Family)/i);
});

test('preview renderer rejects unsafe font family values', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-preview-font-family-'));
  const layoutPath = path.join(directory, 'layout.json');
  const previewPath = path.join(directory, 'preview.html');

  fs.writeFileSync(layoutPath, JSON.stringify({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: ['heading-1'],
    },
    'heading-1': {
      type: { resolvedName: 'Heading' },
      isCanvas: false,
      props: {
        tag: 'h1',
        text: 'Unsafe font',
        fontFamily: 'Inter;color:red',
      },
      parent: 'section-1',
      nodes: [],
    },
  }));

  const result = spawnSync(process.execPath, [
    renderScript,
    '--layout',
    layoutPath,
    '--out',
    previewPath,
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);

  const html = fs.readFileSync(previewPath, 'utf8');
  assert.doesNotMatch(html, /<h1 style="[^"]*font-family/);
  assert.doesNotMatch(html, /Inter;color:red/);
  assert.doesNotMatch(html, /color:red/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('preview renderer sanitizes button schemes while retaining safe links', () => {
  const linkCases = [
    ['https-link', 'HTTPS', 'url', 'https://example.test/book?source=preview'],
    ['relative-link', 'Relative', 'href', '../contact?source=preview#form'],
    ['root-link', 'Root', 'url', '/book'],
    ['hash-link', 'Hash', 'url', '#faq'],
    ['mail-link', 'Mail', 'url', 'mailto:hello@example.test?subject=Preview'],
    ['phone-link', 'Phone', 'url', 'tel:+48123456789'],
    ['script-link', 'Script', 'url', 'javascript:alert(1)'],
    ['data-link', 'Data', 'href', 'data:text/html,<script>alert(1)</script>'],
    ['control-link', 'Control', 'url', 'java\tscript:alert(1)'],
    ['unknown-link', 'Unknown', 'url', 'vbscript:msgbox(1)'],
  ];
  const nodeMap = {
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: linkCases.map(([id]) => id),
    },
  };

  for (const [id, label, prop, value] of linkCases) {
    nodeMap[id] = {
      type: { resolvedName: 'ButtonBlock' },
      isCanvas: false,
      props: { label, [prop]: value },
      parent: 'section-1',
      nodes: [],
    };
  }

  const html = renderPreview(nodeMap, 'monteby-preview-links-');

  assert.match(html, /<a[^>]*href="https:\/\/example\.test\/book\?source=preview">HTTPS<\/a>/);
  assert.match(html, /<a[^>]*href="\.\.\/contact\?source=preview#form">Relative<\/a>/);
  assert.match(html, /<a[^>]*href="\/book">Root<\/a>/);
  assert.match(html, /<a[^>]*href="#faq">Hash<\/a>/);
  assert.match(html, /<a[^>]*href="mailto:hello@example\.test\?subject=Preview">Mail<\/a>/);
  assert.match(html, /<a[^>]*href="tel:\+48123456789">Phone<\/a>/);
  assert.match(html, /<a[^>]*href="#">Script<\/a>/);
  assert.match(html, /<a[^>]*href="#">Data<\/a>/);
  assert.match(html, /<a[^>]*href="#">Control<\/a>/);
  assert.match(html, /<a[^>]*href="#">Unknown<\/a>/);
  assert.doesNotMatch(html, /javascript:|data:text\/html|vbscript:/i);
});

test('preview renderer rejects unsafe generic CSS while retaining controlled values and gradients', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['section-1'],
    },
    'section-1': {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: {},
      parent: 'ROOT',
      nodes: ['text-1'],
    },
    'text-1': {
      type: { resolvedName: 'Text' },
      isCanvas: false,
      props: {
        text: 'CSS probe',
        width: 'calc(100% - 2rem)',
        borderRadius: '12px',
        gradientType: 'linear',
        backgroundType: 'gradient',
        gradientAngle: '135deg',
        gradientColor1: '#112233',
        gradientColor2: 'rgba(1,2,3,.4)',
        display: 'block;color:red',
        backgroundColor: '#fff;position:fixed',
        fontSize: 'expression(alert(1))',
        lineHeight: '1.5\u0000;opacity:0',
        gap: 'url(javascript:alert(1))',
        boxShadow: '0 0 1px #000;behavior:url(test.htc)',
        paddingTop: '@import url("https://evil.test/x.css")',
        marginTop: '10px\\3b color:red',
      },
      parent: 'section-1',
      nodes: [],
    },
  }, 'monteby-preview-css-');
  const textMatch = html.match(/<p style="([^"]*)">CSS probe<\/p>/);

  assert.ok(textMatch);
  const style = textMatch[1];
  assert.match(style, /width:calc\(100% - 2rem\)/);
  assert.match(style, /border-radius:12px/);
  assert.match(style, /background-image:linear-gradient\(135deg,#112233,rgba\(1,2,3,\.4\)\)/);
  assert.doesNotMatch(style, /color:red|position:fixed|expression\s*\(|opacity:0|javascript\s*:|behavior\s*:|@\s*import|url\s*\(|\\3b/i);
});

test('preview renderer rejects unsafe background media payloads while retaining HTTP and relative images', () => {
  const backgrounds = [
    ['https-background', 'https://cdn.example.test/hero.webp?width=1440&fit=crop'],
    ['root-background', '/assets/hero.webp'],
    ['relative-background', '../assets/hero-mobile.webp'],
    ['script-background', 'javascript:alert(1)'],
    ['data-background', 'data:text/html,<svg onload=alert(1)>'],
    ['nested-url-background', 'url("https://evil.test/hero.webp")'],
    ['declaration-background', 'https://evil.test/hero.webp");color:red;/*'],
    ['control-background', 'https://evil.test/hero.webp\u0000;color:red'],
    ['expression-background', 'expression(alert(1))'],
    ['import-background', '@import url("https://evil.test/x.css")'],
    ['behavior-background', 'behavior:url(test.htc)'],
  ];
  const nodeMap = {
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: backgrounds.map(([id]) => id),
    },
  };

  for (const [id, backgroundImage] of backgrounds) {
    nodeMap[id] = {
      type: { resolvedName: 'Section' },
      isCanvas: true,
      props: { backgroundImage },
      parent: 'ROOT',
      nodes: [],
    };
  }

  const html = renderPreview(nodeMap, 'monteby-preview-backgrounds-');

  assert.match(html, /url\(&quot;https:\/\/cdn\.example\.test\/hero\.webp\?width=1440&amp;fit=crop&quot;\)/);
  assert.match(html, /url\(&quot;\/assets\/hero\.webp&quot;\)/);
  assert.match(html, /url\(&quot;\.\.\/assets\/hero-mobile\.webp&quot;\)/);
  assert.doesNotMatch(html, /evil\.test|javascript:|data:text\/html|color:red|expression\s*\(|behavior\s*:|@\s*import/i);
});

test('preview renderer rejects unsafe image sources while retaining HTTP and relative images', () => {
  const html = renderPreview({
    ROOT: {
      type: { resolvedName: 'RootCanvas' },
      isCanvas: true,
      props: {},
      nodes: ['safe-http', 'safe-relative', 'unsafe-script', 'unsafe-data'],
    },
    'safe-http': {
      type: { resolvedName: 'ImageBlock' },
      isCanvas: false,
      props: { src: 'https://cdn.example.test/proof.webp', alt: 'Safe HTTP image' },
      parent: 'ROOT',
      nodes: [],
    },
    'safe-relative': {
      type: { resolvedName: 'ImageBlock' },
      isCanvas: false,
      props: { src: '/assets/proof.webp', alt: 'Safe relative image' },
      parent: 'ROOT',
      nodes: [],
    },
    'unsafe-script': {
      type: { resolvedName: 'ImageBlock' },
      isCanvas: false,
      props: { src: 'javascript:alert(1)', alt: 'Unsafe script image' },
      parent: 'ROOT',
      nodes: [],
    },
    'unsafe-data': {
      type: { resolvedName: 'ImageBlock' },
      isCanvas: false,
      props: { src: 'data:image/svg+xml,<svg onload="alert(1)">', alt: 'Unsafe data image' },
      parent: 'ROOT',
      nodes: [],
    },
  }, 'monteby-preview-images-');

  assert.match(html, /src="https:\/\/cdn\.example\.test\/proof\.webp"/);
  assert.match(html, /src="\/assets\/proof\.webp"/);
  assert.doesNotMatch(html, /Unsafe script image|Unsafe data image|javascript:|data:image/i);
});

test('preview renderer renders Navbar and FormBlock contract props for screenshot diagnostics', () => {
  const html = renderPreview({
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['navbar', 'form'] },
    navbar: {
      type: { resolvedName: 'Navbar' }, isCanvas: false, parent: 'ROOT', nodes: [],
      props: {
        logoSrc: 'https://cdn.example.test/logo.svg', logoText: 'Northstar', mobileMenuBehavior: 'drawer', mobileMenuBreakpoint: 'tablet',
        menuButtonLabel: 'Open menu', menuButtonIcon: 'menu_open', ctaLabel: 'Book now', ctaHref: '/book',
        menuItems: [{ label: 'Services', href: '/services' }, { label: 'Contact', href: 'mailto:hello@example.test' }],
        backgroundColor: '#ffffff', borderColor: '#d1d5db', innerPaddingY: '18px', innerPaddingYTablet: '14px', innerPaddingYMobile: '10px', innerPaddingX: '28px', menuGap: '32px', ctaBorderWidth: '2px',
      },
    },
    form: {
      type: { resolvedName: 'FormBlock' }, isCanvas: false, parent: 'ROOT', nodes: [],
      props: {
        formId: 'contact_form', formColumns: 2, formGap: '20px', formMaxWidth: '720px', formBackgroundColor: '#f8fafc', inputBorderRadius: 'rounded-xl',
        fields: [
          { type: 'text', name: 'name', label: 'Name', placeholder: 'Your name', required: true },
          { type: 'email', name: 'email', label: 'Email', placeholder: 'you@example.test', required: true },
          { type: 'textarea', name: 'message', label: 'Message', rows: 6, columnSpan: 2 },
          { type: 'select', name: 'topic', label: 'Topic', placeholder: 'Choose a topic', options: 'Project enquiry|project\nSupport|support' },
          { type: 'checkbox', name: 'consent', label: 'I accept the', linkText: 'privacy policy', linkUrl: '/privacy', required: true, columnSpan: 2 },
        ],
        submitLabel: 'Send enquiry', submitIcon: 'send', buttonAlignSelf: 'center',
      },
    },
  }, 'monteby-preview-navbar-form-');

  assert.match(html, /<nav class="monteby-preview-navbar monteby-preview-navbar--drawer-tablet"/);
  assert.match(html, /src="https:\/\/cdn\.example\.test\/logo\.svg" alt="Northstar"/);
  assert.match(html, /<div class="monteby-preview-navbar__desktop" style="display:flex;align-items:center;gap:16px;margin-left:auto">/);
  assert.match(html, /--monteby-navbar-inner-padding-y-base:18px;--monteby-navbar-inner-padding-y-tablet:14px;--monteby-navbar-inner-padding-y-mobile:10px/);
  assert.match(html, /aria-expanded="false" aria-label="Open menu"/);
  assert.match(html, /class="monteby-preview-navbar__toggle"[^>]*style="display:none;/);
  assert.match(html, /<div class="monteby-preview-navbar__drawer" aria-hidden="true" hidden>/);
  assert.match(html, /href="\/services"/);
  assert.match(html, /href="mailto:hello@example\.test"/);
  assert.match(html, /@media \(max-width:900px\)\{\.monteby-preview-navbar--hide-links-tablet/);
  assert.match(html, /@media \(max-width:900px\)\{\.monteby-preview-navbar__inner\{padding-top:var\(--monteby-navbar-inner-padding-y-tablet,var\(--monteby-navbar-inner-padding-y-base\)\)!important/);
  assert.match(html, /@media \(max-width:767px\)\{\.monteby-preview-navbar__inner\{padding-top:var\(--monteby-navbar-inner-padding-y-mobile,var\(--monteby-navbar-inner-padding-y-tablet,var\(--monteby-navbar-inner-padding-y-base\)\)\)!important/);
  assert.match(html, /\.monteby-preview-navbar--drawer-tablet \.monteby-preview-navbar__desktop\{display:none!important\}/);
  assert.match(html, /<form class="monteby-preview-form monteby-preview-form--two-columns" id="contact_form"/);
  assert.match(html, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /name="message"[^>]*rows="6"[^>]*resize:vertical/);
  assert.match(html, /<option value="project">Project enquiry<\/option>/);
  assert.match(html, /<input class="monteby-preview-form-control" type="checkbox" name="consent" required/);
  assert.match(html, /href="\/privacy">privacy policy<\/a>/);
  assert.match(html, /grid-column:span 2/);
  assert.match(html, /<span class="material-symbols-rounded" aria-hidden="true" style="font-size:1\.1em;line-height:1">send<\/span>Send enquiry/);
  assert.match(html, /family=Material\+Symbols\+Rounded/);
});

test('preview renderer applies Section overflow to the outer semantic element', () => {
  const html = renderPreview({
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['section'] },
    section: {
      type: { resolvedName: 'Section' }, isCanvas: true, parent: 'ROOT', nodes: ['text'],
      props: { tag: 'section', innerMaxWidth: '1200px', innerPaddingX: '24px', overflow: 'hidden' },
    },
    text: {
      type: { resolvedName: 'Text' }, isCanvas: false, parent: 'section', nodes: [],
      props: { text: 'Clipped measured content' },
    },
  }, 'monteby-preview-section-overflow-');

  assert.match(html, /<section style="box-sizing:border-box;[^"]*overflow:hidden[^"]*"><div style="box-sizing:border-box;max-width:1200px;margin-left:auto;margin-right:auto;padding-left:24px;padding-right:24px">/);
});

test('preview renderer rejects unsafe Navbar and FormBlock structured values', () => {
  const html = renderPreview({
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['navbar', 'form'] },
    navbar: {
      type: { resolvedName: 'Navbar' }, isCanvas: false, parent: 'ROOT', nodes: [],
      props: {
        logoSrc: 'javascript:alert(1)', mobileMenuBehavior: 'drawer', menuButtonIcon: 'menu<script>', ctaLabel: 'Unsafe CTA', ctaHref: 'data:text/html,boom',
        menuItems: [{ label: 'Unsafe link', href: 'javascript:alert(1)' }], className: 'injected-class',
      },
    },
    form: {
      type: { resolvedName: 'FormBlock' }, isCanvas: false, parent: 'ROOT', nodes: [],
      props: {
        formId: 'bad id<script>', formColumns: 1, submitIcon: 'send<script>', className: 'injected-form',
        fields: [
          { type: 'file', name: 'bad name<script>', label: 'Fallback type', placeholder: 'Unsafe\u0000 placeholder', columnSpan: 2 },
          { type: 'select', name: 'topic', options: 'Safe choice|safe\nBad value|javascript:alert(1)\nBad\u0000option|nope' },
          { type: 'checkbox', name: 'consent', label: 'Agree', linkText: 'terms', linkUrl: 'javascript:alert(1)' },
        ],
      },
    },
  }, 'monteby-preview-navbar-form-adversarial-');

  assert.match(html, /<a href="#"[^>]*>Unsafe CTA<\/a>/);
  assert.match(html, /<a href="#"[^>]*>Unsafe link<\/a>/);
  assert.match(html, /type="text" name="field_1" placeholder=""/);
  assert.match(html, /<option value="safe">Safe choice<\/option>/);
  assert.doesNotMatch(html, /Bad value|Bad.*option|javascript:|data:text\/html|<script>alert|injected-class|injected-form/);
  assert.doesNotMatch(html, / id="bad/);
  assert.doesNotMatch(html, /menu<script>|send<script>/);
  assert.doesNotMatch(html, /grid-column:span 2/);
});

test('preview renderer keeps TabsBlock visible, responsive, safe, and interactive', () => {
  const html = renderPreview({
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: ['section'] },
    section: { type: { resolvedName: 'Section' }, isCanvas: true, parent: 'ROOT', props: {}, nodes: ['tabs-widget'] },
    'tabs-widget': {
      type: { resolvedName: 'TabsBlock' },
      isCanvas: false,
      parent: 'section',
      nodes: [],
      props: {
        defaultActiveTab: 1,
        orientation: 'vertical',
        mobileTabLayout: 'scroll',
        panelStackAt: 'tablet',
        tabBarWidth: '230px',
        tabBarWidthTablet: '190px',
        tabBarAlignment: 'stretch',
        tabWidthMobile: '174px',
        tabMinHeight: '78px',
        tabMinHeightMobile: '68px',
        tabActiveBackgroundColor: '#183f34',
        tabActiveTextColor: '#ffffff',
        panelBackgroundColor: '#183f34',
        panelTextColor: 'rgba(255,255,255,.72)',
        panelTitleColor: '#ffffff',
        panelTitleFontSize: '70px',
        panelTitleFontSizeMobile: '44px',
        panelImageWidth: '57.6%',
        panelImageHeight: '572px',
        panelImageHeightMobile: '330px',
        panelImageObjectPositionX: '50%',
        panelImageObjectPositionY: '38%',
        showPanelTitle: true,
        className: 'must-not-render',
        tabs: [
          {
            labelPrefix: '01', label: 'Doors open', labelSuffix: '18:00', eyebrow: 'Hall A',
            title: 'Arrive before the first note.', content: 'Safe opening content.',
            image: 'https://cdn.example.test/doors.jpg', imageAlt: 'Guests arriving', ctaLabel: 'Reserve', ctaUrl: '#reserve',
          },
          {
            labelPrefix: '02', label: 'Chef table', labelSuffix: '20:30', eyebrow: 'Hall C',
            title: 'Seasonal plates.', content: '<script>alert(1)</script>',
            image: 'https://cdn.example.test/table.jpg', imageAlt: 'Seasonal dishes', ctaLabel: 'Book', ctaUrl: 'javascript:alert(1)',
          },
          {
            label: 'Unsafe media', content: 'No unsafe image.', image: 'data:text/html,boom',
          },
        ],
      },
    },
  }, 'monteby-preview-tabs-');

  assert.match(html, /class="gotoweb-tabs gotoweb-tabs--vertical gotoweb-tabs--mobile-scroll"/);
  assert.match(html, /data-gotoweb-tabs data-mobile-tab-layout="scroll" data-panel-stack-at="tablet" data-tabs-responsive/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 3);
  assert.match(html, /id="tabs-widget-tab-1"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(html, /id="tabs-widget-panel-1"[^>]*aria-labelledby="tabs-widget-tab-1"[^>]*tabindex="0" style=/);
  assert.match(html, /id="tabs-widget-panel-0"[^>]*hidden/);
  assert.match(html, /grid-template-columns:minmax\(0,230px\) minmax\(0,1fr\)/);
  assert.match(html, /class="gotoweb-tabs__bar"[^>]*align-self:stretch/);
  assert.match(html, /--gotoweb-tabs-tab-width-mobile:174px/);
  assert.match(html, /--gotoweb-tabs-panel-title-font-size-mobile:44px/);
  assert.match(html, /--gotoweb-tabs-panel-image-height-mobile:330px/);
  assert.match(html, /src="https:\/\/cdn\.example\.test\/table\.jpg"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /class="gotoweb-tabs__cta" href="#"/);
  assert.match(html, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(html, /if\(layout==="stack"\)\{return "vertical";\}/);
  assert.match(html, /if\(layout==="scroll"\|\|layout==="wrap"\)\{return "horizontal";\}/);
  assert.match(html, /forward=orientation==="vertical"\?"ArrowDown":"ArrowRight"/);
  assert.match(html, /backward=orientation==="vertical"\?"ArrowUp":"ArrowLeft"/);
  assert.match(html, /mobileLayout\(\)==="scroll"/);
  assert.match(html, /activeButton\.scrollIntoView\(\{block:"nearest",inline:"nearest"\}\)/);
  assert.match(html, /window\.requestAnimationFrame\(scrollActiveIntoView\)/);
  assert.match(html, /syncOrientation\(\);if\(mobileQuery\)/);
  assert.match(html, /mobileQuery\.addEventListener\("change",syncOrientation\)/);
  assert.doesNotMatch(html, /must-not-render|data:text\/html|<script>alert\(1\)<\/script>|javascript:/);
});

test('preview Tabs runtime synchronizes mobile orientation and active scroll position', () => {
  const html = renderPreview({
    ROOT: { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: [] },
  }, 'monteby-preview-tabs-runtime-');
  const runtimeMatch = html.match(/<script>([\s\S]+)<\/script>/);
  assert.ok(runtimeMatch);

  const mediaListeners = [];
  const mediaQuery = {
    matches: true,
    addEventListener(type, listener) {
      if (type === 'change') mediaListeners.push(listener);
    },
  };
  const createButton = (selected) => {
    const attributes = new Map([['aria-selected', selected ? 'true' : 'false']]);
    const listeners = new Map();
    return {
      attributes,
      listeners,
      scrollCalls: [],
      tabIndex: selected ? 0 : -1,
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      focus(options) {
        this.focusOptions = options;
      },
      getAttribute(name) {
        return attributes.has(name) ? attributes.get(name) : null;
      },
      scrollIntoView(options) {
        this.scrollCalls.push(options);
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
    };
  };
  const createRoot = (desktopOrientation, mobileLayout) => {
    const buttons = [createButton(false), createButton(true)];
    const panels = [{ hidden: true }, { hidden: false }];
    const tabListAttributes = new Map([['aria-orientation', desktopOrientation]]);
    const tabList = {
      getAttribute(name) {
        return tabListAttributes.get(name) || null;
      },
      setAttribute(name, value) {
        tabListAttributes.set(name, String(value));
      },
    };
    const rootElement = {
      dataset: {},
      getAttribute(name) {
        return name === 'data-mobile-tab-layout' ? mobileLayout : null;
      },
      querySelector(selector) {
        return selector === '[role=tablist]' ? tabList : null;
      },
      querySelectorAll(selector) {
        if (selector === '[data-tab-index]') return buttons;
        if (selector === '[data-tab-panel]') return panels;
        return [];
      },
    };
    return { rootElement, buttons, panels, tabListAttributes };
  };
  const stack = createRoot('horizontal', 'stack');
  const scroll = createRoot('vertical', 'scroll');
  const wrap = createRoot('vertical', 'wrap');

  vm.runInNewContext(runtimeMatch[1], {
    document: {
      querySelectorAll(selector) {
        return selector === '[data-gotoweb-tabs]'
          ? [stack.rootElement, scroll.rootElement, wrap.rootElement]
          : [];
      },
    },
    window: {
      matchMedia() {
        return mediaQuery;
      },
      requestAnimationFrame(callback) {
        callback();
      },
    },
  });

  assert.equal(stack.tabListAttributes.get('aria-orientation'), 'vertical');
  assert.equal(scroll.tabListAttributes.get('aria-orientation'), 'horizontal');
  assert.equal(wrap.tabListAttributes.get('aria-orientation'), 'horizontal');
  assert.equal(stack.buttons[1].scrollCalls.length, 0);
  assert.equal(scroll.buttons[1].scrollCalls.length, 1);
  assert.equal(wrap.buttons[1].scrollCalls.length, 0);

  let prevented = false;
  stack.buttons[1].listeners.get('keydown')({
    key: 'ArrowDown',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(stack.buttons[0].getAttribute('aria-selected'), 'true');
  assert.equal(stack.panels[0].hidden, false);

  mediaQuery.matches = false;
  mediaListeners.forEach((listener) => listener());
  assert.equal(stack.tabListAttributes.get('aria-orientation'), 'horizontal');
  assert.equal(scroll.tabListAttributes.get('aria-orientation'), 'vertical');
  const scrollCallsBeforeMobileRestore = scroll.buttons[1].scrollCalls.length;

  mediaQuery.matches = true;
  mediaListeners.forEach((listener) => listener());
  assert.equal(stack.tabListAttributes.get('aria-orientation'), 'vertical');
  assert.equal(scroll.tabListAttributes.get('aria-orientation'), 'horizontal');
  assert.equal(scroll.buttons[1].scrollCalls.length, scrollCallsBeforeMobileRestore + 1);
});

test('preview renderer rejects payloads without a node map', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-preview-render-invalid-'));
  const layoutPath = path.join(directory, 'layout.json');
  const previewPath = path.join(directory, 'preview.html');

  fs.writeFileSync(layoutPath, JSON.stringify({ nope: true }));

  const result = spawnSync(process.execPath, [
    renderScript,
    '--layout',
    layoutPath,
    '--out',
    previewPath,
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not find a Monteby node map/);
});
