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
const renderScript = path.join(root, 'monteby-site-authoring', 'scripts', 'render-monteby-preview.js');
const { finalizeCapturedLayoutCoverage } = require(path.join(
  root,
  'monteby-site-authoring',
  'scripts',
  'capture-template-reference.js',
));
const userFacingNodePropNames = new Set([
  'alt',
  'caption',
  'children',
  'content',
  'description',
  'email',
  'errorMessage',
  'eyebrow',
  'href',
  'items',
  'label',
  'phone',
  'placeholder',
  'submitLabel',
  'successMessage',
  'text',
  'title',
  'url',
  'value',
]);
const prohibitedUserFacingCopy = [
  ['source demo name', /\b(?:Careglo|Maidy|Optomatta|Lumen)\b/i],
  ['source slogan', /Detailing That Defines True Luxury|Avoid A Dirty Scene, Keep Your Place Clean & Fresh|See Clearly\.|Live Fully\.|Crafting Luxury, One Car at a Time|Tailored Solutions|Luxury-Focused Care/i],
  ['source contact value', /\+1\s*\(234\)\s*567[ -]?890|\+?\s*6221[ -]?2002[ -]?2012|maidy@mails\.com/i],
  ['source partner identity', /^(?:AUTOLUX|CERAMIC|DETAIL PRO|MOTORLAB|SHINEWORKS|EXPRESS|MOON|NATUSKA|DINOTECH|BREEZY)$/i],
  ['internal product or QA term', /\b(?:Monteby|template|benchmark|scaffold|reference|recreation|homepage|layout|CTA)\b/i],
  ['internal authoring phrase', /first[- ]pass|first screen|visual (?:brief|target|proof)|target rhythm|replacement (?:copy|imagery|photography)|live site details|conversion-oriented content block|pixel-perfect/i],
  ['internal review instruction', /use (?:this|the) (?:page|card|section|process)|make the page feel|generic cards|scan-friendly|phone CTA|proof strip|agency feel|specific and visual/i],
];

test('draft layout self-audits clean Monteby JSON against media role requirements', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-layout-'));
  const contractPath = path.join(directory, 'contract.json');
  const startReportPath = path.join(directory, 'benchmark-start-report.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'target-manifest.json');

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(startReportPath, JSON.stringify({ visualBrief: visualBrief() }));
  fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest()));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--start-report',
    startReportPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));

  assert.equal(report.ok, true);
  assert.equal(report.stats.requiredMediaRoles, 3);
  assert.equal(report.stats.mediaProfile, 'optomatta-optical-retail');
  assert.equal(report.stats.heroProofCards >= 1, true);
  assert.equal(report.audit.ok, true);
  assert.equal(report.audit.stats.satisfiedMediaRoles, 3);
  assert.equal(report.audit.stats.reusedReferenceMedia, 0);
  assert.equal(layout.ROOT.nodes.length >= 3, true);
  assert.equal(JSON.stringify(layout).includes('className'), false);
  assert.equal(JSON.stringify(layout).includes('rawHtml'), false);
  assert.doesNotMatch(JSON.stringify(layout), /repeat\(/);
  assert.doesNotMatch(JSON.stringify(layout), /"boxShadow":"soft"|"boxShadow": "soft"/);
  assert.doesNotMatch(JSON.stringify(layout), /"fontWeight":"850"|"fontWeight": "850"/);
  assert.doesNotMatch(JSON.stringify(layout), /"backgroundPosition":"center center"|"backgroundPosition": "center center"/);
  assert.equal(JSON.stringify(layout).includes('https://captured.example.test/hero.jpg'), false);
  assert.equal(JSON.stringify(layout).includes('First-pass Monteby recreation scaffold'), false);
  assertUserFacingNodePropsAreOriginal(layout);
  assertLeafParentsAreContainers(layout, ['Heading', 'Text', 'ButtonBlock', 'StatsGrid']);
  assertLeafNodesKeepCraftNodesArray(layout, ['Heading', 'Text', 'ButtonBlock', 'StatsGrid']);
});

test('draft layout uses archetype-specific replacement media for Envato-style families', () => {
  const scenarios = [
    {
      archetype: 'luxury-car-care',
      referenceStyle: 'careglo-dark-service',
      h1: 'Premium detailing for cars that deserve ceremony.',
      h2: 'Premium service packages',
      h3: ['Signature detail', 'Interior reset', 'Protective finish'],
      expectedProfile: 'luxury-car-care',
      expectedBrand: 'Luxury Car Care',
      expectedHero: 'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg',
      forbiddenHero: 'https://images.pexels.com/photos/17029941/pexels-photo-17029941.jpeg',
      rootVariables: {
        '--bg': '#0b0d12',
        '--panel': '#151820',
        '--ink': '#fff7ea',
        '--muted': '#a7adb9',
        '--accent': '#f5b66f',
        '--accent-2': '#c88845',
        '--surface': '#12151b',
        '--service-bg': '#11141a',
        '--service-ink': '#fff7ea',
        '--button-bg': '#f5b66f',
        '--button-fg': '#18110a',
        '--max': '1220px',
        '--radius': '32px',
        '--hero-min': '700px',
        '--visual-min': '580px',
      },
      expectedBg: '#0b0d12',
      expectedCardBg: '#11141a',
      expectedButtonBg: '#f5b66f',
      expectedInnerMaxWidth: '1440px',
      expectedRadius: '32px',
      expectedHeroMin: '700px',
      expectedLayoutHeroMin: '700px',
      expectedVisualMin: '580px',
      expectedLayoutVisualMin: '701px',
      expectedProofTitle: 'Reserve a detail bay with expert handover.',
      expectedNavCta: 'Contact',
      expectedHeroCta: 'Book now',
      expectedHeroHeading: 'Premium detailing for cars that deserve ceremony.',
      expectedHeroSectionPaddingBottom: '44px',
      expectedServicesSectionPaddingTop: '128px',
      expectedServicesHeading: 'Precision Finish Care',
      expectedServicesHeadingSize: '16px',
      expectedCaregloServiceCopy: 'Care Built Around You',
      expectedCaregloServiceMediaHeights: ['555px', '400px'],
      expectedCaregloMobileHeadingSize: '42px',
      expectedCaregloMobileHeadingLineHeight: '1.08',
      expectedCaregloMobileHeadingAlign: 'left',
      expectedCaregloTabletHeadingAlign: 'left',
      expectedCaregloNavCtaDisplay: 'hide-mobile',
      expectedCaregloNavRhythm: true,
      expectedCaregloNavFirstLink: 'Services',
      expectedCaregloBrandWidth: '190px',
      expectedCaregloNavGap: '28px',
      expectedCaregloNavLinkFontSize: '12px',
      expectedCaregloFallbackSplitHero: true,
      expectedCaregloUniqueMediaMin: 17,
      expectedMinimumRootSections: 12,
      expectedHomepageDepthCopy: 'Care built for drivers who notice every detail.',
    },
    {
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
      h1: 'Avoid the mess, keep every room crisp and calm.',
      h2: 'Cleaning plans for homes and offices',
      h3: ['House refresh', 'Office upkeep', 'Move-out reset'],
      expectedProfile: 'maid-service-agency',
      expectedBrand: 'Tidyra',
      expectedHero: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
      forbiddenHero: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      rootVariables: {
        '--bg': '#f7f7f4',
        '--panel': '#ffffff',
        '--ink': '#060708',
        '--muted': '#7f817d',
        '--accent': '#ffdd67',
        '--accent-2': '#315f4f',
        '--soft': '#f0eee8',
        '--button-bg': '#203740',
        '--button-fg': '#ffffff',
        '--max': '1240px',
        '--radius': '26px',
        '--hero-min': '720px',
        '--visual-min': '560px',
      },
      expectedBg: '#f7f7f4',
      expectedCardBg: '#ffffff',
      expectedButtonBg: '#203740',
      expectedInnerMaxWidth: '1280px',
      expectedRadius: '0px',
      expectedHeroMin: '720px',
      expectedVisualMin: '560px',
      expectedLayoutHeroMin: '847px',
      expectedLayoutVisualMin: '847px',
      expectedProofTitle: 'Schedule a refresh before the week gets busy.',
      expectedHeroHeading: 'Clean & Ready',
      expectedMinHeroProofCards: 1,
      expectedMaidyNavGrow: true,
      expectedMaidyEquipmentMinHeight: '258px',
      expectedMaidyEquipment: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=760&q=82&ix=monteby-equipment&monteby_media=maidy-hero-equipment',
      expectedMaidySplitHero: true,
      expectedMaidyHeroCutout: 'https://cdn.example.test/monteby-maidy-cleaner-cutout.png?ix=monteby-maidy-cutout',
      expectedMaidyMobileCopyOffset: true,
      expectedMaidyUniqueMediaMin: 16,
      expectedMaidyEmail: 'hello@tidyra.example',
      expectedContactPhone: '☎ +1 (415) 555-0148',
      expectedMinimumRootSections: 16,
      expectedHomepageDepthCopy: 'Focused care for the spaces you use every day.',
      expectedMaidyDepthCopy: 'A useful note for a tidier week.',
    },
    {
      archetype: 'optomatta-optical-retail',
      referenceStyle: 'optomatta-optical-retail',
      h1: 'Secure clearer vision with precision eyewear.',
      h2: 'Qualified doctors, emergency care, and service',
      h3: ['Eye exams', 'Frame fitting', 'Lens care'],
      ctas: ['Shop frames', 'Ask optometrist'],
      expectedProfile: 'optomatta-optical-retail',
      expectedBrand: 'OPTICLINE',
      expectedHero: 'https://images.pexels.com/photos/6749748/pexels-photo-6749748.jpeg',
      forbiddenHero: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
      rootVariables: {
        '--bg': '#ffffff',
        '--panel': '#f4f6f9',
        '--ink': '#090d13',
        '--muted': '#5f6670',
        '--accent': '#0788d8',
        '--accent-2': '#0a6fa7',
        '--wash': '#eef7ff',
        '--button-bg': '#0788d8',
        '--button-fg': '#ffffff',
        '--max': '1200px',
        '--radius': '24px',
        '--hero-min': '680px',
        '--visual-min': '540px',
      },
      expectedBg: '#ffffff',
      expectedCardBg: '#f4f6f9',
      expectedButtonBg: '#0788d8',
      expectedInnerMaxWidth: '1240px',
      expectedRadius: '24px',
      expectedHeroMin: '680px',
      expectedVisualMin: '540px',
      expectedLayoutHeroMin: '496px',
      expectedLayoutVisualMin: '205px',
      expectedLayoutHeroMinTablet: '318px',
      expectedProofTitle: 'Eye exams',
      expectedMinHeroProofCards: 1,
      expectedHeroHeading: 'Secure clearer vision with precision eyewear.',
      expectedHeroCta: 'SHOP FRAMES',
      expectedFullWidthHero: true,
      expectedContactPhone: '+1 (415) 555-0186',
      expectedOptomattaUniqueMediaMin: 16,
      expectedMinimumRootSections: 10,
      expectedHomepageDepthCopy: 'Everyday eyewear shaped around personal fit, lasting comfort, and effortless style.',
    },
    {
      archetype: 'lumen-eye-care-editorial',
      referenceStyle: 'lumen-eye-care-editorial',
      h1: 'See better. Live brighter.',
      h2: 'Vision care with calm specialist guidance',
      h3: ['Vision testing', 'Specialist care', 'Treatment plans'],
      expectedProfile: 'lumen-eye-care-editorial',
      expectedBrand: 'CLEARWELL',
      expectedHero: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d',
      forbiddenHero: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      rootVariables: {
        '--bg': '#eefbe3',
        '--panel': '#ffffff',
        '--ink': '#061a27',
        '--muted': '#526271',
        '--accent': '#2fd678',
        '--accent-2': '#0f7768',
        '--wash': '#f8ffdc',
        '--button-bg': '#0f7768',
        '--button-fg': '#ffffff',
        '--max': '1280px',
        '--radius': '30px',
        '--hero-min': '780px',
        '--visual-min': '640px',
      },
      expectedBg: '#eefbe3',
      expectedCardBg: '#ffffff',
      expectedButtonBg: '#0f7768',
      expectedInnerMaxWidth: '1440px',
      expectedRadius: '30px',
      expectedHeroMin: '780px',
      expectedLayoutHeroMin: '952px',
      expectedVisualMin: '640px',
      expectedLayoutVisualMin: '530px',
      expectedProofTitle: 'Qualified eye care, explained clearly',
      expectedNavCta: 'Appointment Now',
      expectedHeroCta: 'Book Now',
      expectedHeroHeadingSize: '120px',
      expectedHeroHeading: 'Clear Sight.',
      expectedSecondaryHeroHeading: 'Bright Days.',
      expectedMinHeroProofCards: 1,
      expectedMinimumRootSections: 13,
      expectedHomepageDepthCopy: 'A clearer plan starts with a calm first conversation.',
      expectedLumenDoctorMarker: 'ix=monteby-lumen-doctor',
      expectedLumenDoctorCutout: 'https://cdn.example.test/monteby-lumen-doctor-cutout.png?ix=monteby-lumen-doctor',
    },
  ];

  for (const scenario of scenarios) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-draft-${scenario.archetype}-`));
    const contractPath = path.join(directory, 'contract.json');
    const briefPath = path.join(directory, 'visual-brief.json');
    const layoutPath = path.join(directory, 'layout-draft.json');
    const manifestPath = path.join(directory, 'target-manifest.json');
    const brief = visualBrief({
      target: {
        variant: 'marketplace-service',
        archetype: scenario.archetype,
        referenceStyle: scenario.referenceStyle,
      },
      text: {
        h1: [scenario.h1],
        h2: [scenario.h2],
        h3: scenario.h3,
        ctas: scenario.ctas || ['Book now', 'Explore services'],
        stats: ['4.9 rating', '24h response', '12 teams'],
      },
      visualSignals: {
        rootVariables: scenario.rootVariables,
      },
    });

    fs.writeFileSync(contractPath, JSON.stringify(contract()));
    fs.writeFileSync(briefPath, JSON.stringify(brief));
    fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest(brief)));

    const env = { ...process.env };
    if (scenario.expectedLumenDoctorCutout) {
      env.MONTEBY_LUMEN_DOCTOR_CUTOUT_URL = scenario.expectedLumenDoctorCutout;
    } else {
      delete env.MONTEBY_LUMEN_DOCTOR_CUTOUT_URL;
    }
    if (scenario.expectedMaidyHeroCutout) {
      env.MONTEBY_MAIDY_HERO_CUTOUT_URL = scenario.expectedMaidyHeroCutout;
      delete env.MONTEBY_MAIDY_HERO_COMPOSITE_URL;
    } else {
      delete env.MONTEBY_MAIDY_HERO_CUTOUT_URL;
      delete env.MONTEBY_MAIDY_HERO_COMPOSITE_URL;
    }

    const result = spawnSync(process.execPath, [
      draftScript,
      '--contract',
      contractPath,
      '--brief-json',
      briefPath,
      '--out',
      layoutPath,
      '--reference-manifest',
      manifestPath,
      '--json',
    ], { encoding: 'utf8', env });

    assert.equal(result.status, 0, `${scenario.archetype}: ${result.stderr}`);
    const report = JSON.parse(result.stdout);
    const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    const layoutJson = JSON.stringify(layout, null, 2);

    assert.equal(report.ok, true, scenario.archetype);
    assert.equal(report.stats.mediaProfile, scenario.expectedProfile);
    assert.equal(report.stats.geometryProfile, scenario.expectedProfile);
    assert.equal(report.stats.innerMaxWidth, scenario.expectedInnerMaxWidth);
    assert.equal(report.stats.heroMinHeight, scenario.expectedHeroMin);
    assert.equal(report.stats.visualMinHeight, scenario.expectedVisualMin);
    assert.equal(report.stats.heroProofCards >= (scenario.expectedMinHeroProofCards || 2), true, scenario.archetype);
    if (scenario.expectedLumenDoctorCutout) {
      assert.doesNotMatch(layoutJson, new RegExp(escapeRegExp(scenario.expectedHero)));
    } else {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedHero)));
    }
    assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedBrand)));
    assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedProofTitle)));
    if (scenario.expectedContactPhone) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedContactPhone)));
    }
    if (scenario.expectedNavCta) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedNavCta)));
      assert.match(layoutJson, /"paddingRight": "22px"/);
      assert.match(layoutJson, /"borderRadius": "999px"/);
    }
    if (scenario.expectedHeroCta) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedHeroCta)));
    }
    if (scenario.expectedHeroSectionPaddingBottom) {
      const heroSection = layout[layout.ROOT.nodes[1]];
      assert.equal(heroSection.props.paddingBottom, scenario.expectedHeroSectionPaddingBottom);
    }
    if (scenario.expectedServicesSectionPaddingTop) {
      const servicesSection = Object.values(layout)
        .find((node) => node?.parent === 'ROOT' && node?.props?.paddingBottom === '88px');
      assert.equal(servicesSection?.props?.paddingTop, scenario.expectedServicesSectionPaddingTop);
    }
    if (scenario.expectedHeroHeadingSize) {
      assert.match(layoutJson, new RegExp(escapeRegExp(`"fontSize": "${scenario.expectedHeroHeadingSize}"`)));
    }
    if (scenario.expectedHeroHeading) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedHeroHeading)));
    }
    if (scenario.expectedSecondaryHeroHeading) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedSecondaryHeroHeading)));
    }
    if (scenario.expectedServicesHeading) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedServicesHeading)));
      assert.match(layoutJson, new RegExp(escapeRegExp(`"fontSize": "${scenario.expectedServicesHeadingSize}"`)));
    }
    if (scenario.expectedCaregloServiceCopy) {
      assert.match(layoutJson, new RegExp(escapeRegExp('/Our studio')));
      assert.match(layoutJson, new RegExp(escapeRegExp('Refined Care, One Finish at a Time')));
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedCaregloServiceCopy)));
      for (const expectedHeight of scenario.expectedCaregloServiceMediaHeights) {
        assert.match(layoutJson, new RegExp(escapeRegExp(`"minHeight": "${expectedHeight}"`)));
      }
    }
    if (scenario.expectedCaregloMobileHeadingSize) {
      const heroHeading = Object.values(layout)
        .find((node) => node?.props?.text === scenario.expectedHeroHeading);
      assert.equal(heroHeading?.props?.fontSizeMobile, scenario.expectedCaregloMobileHeadingSize);
      assert.equal(heroHeading?.props?.lineHeightMobile, scenario.expectedCaregloMobileHeadingLineHeight);
      assert.equal(heroHeading?.props?.textAlignMobile, scenario.expectedCaregloMobileHeadingAlign);
      assert.equal(heroHeading?.props?.textAlignTablet, scenario.expectedCaregloTabletHeadingAlign);
    }
    if (scenario.expectedCaregloNavRhythm) {
      const homeLink = Object.entries(layout)
        .find(([, node]) => node?.props?.text === (scenario.expectedCaregloNavFirstLink || 'Home'));
      const navLinksParent = homeLink ? layout[homeLink[1].parent] : null;
      const brandText = Object.entries(layout)
        .find(([, node]) => node?.props?.text === scenario.expectedBrand);
      const brandParent = brandText ? layout[brandText[1].parent] : null;
      const appointmentButton = Object.entries(layout)
        .find(([, node]) => node?.props?.label === scenario.expectedNavCta);
      const appointmentParent = appointmentButton ? layout[appointmentButton[1].parent] : null;
      assert.equal(brandParent?.props?.width, scenario.expectedCaregloBrandWidth || '150px');
      assert.equal(navLinksParent?.props?.gap, scenario.expectedCaregloNavGap || '0px');
      assert.equal(navLinksParent?.props?.flexGrow, 1);
      assert.equal(homeLink?.[1]?.props?.fontSize, scenario.expectedCaregloNavLinkFontSize || '16px');
      assert.equal(homeLink?.[1]?.props?.display, scenario.expectedCaregloNavFirstLink ? undefined : 'inline-flex');
      assert.equal(homeLink?.[1]?.props?.paddingY, scenario.expectedCaregloNavFirstLink ? undefined : '16px');
      assert.equal(homeLink?.[1]?.props?.paddingX, scenario.expectedCaregloNavFirstLink ? undefined : '18px');
      assert.equal(appointmentParent?.props?.flexShrink, 0);
      assert.equal(appointmentParent?.props?.responsiveDisplay, scenario.expectedCaregloNavCtaDisplay);
    }
    if (scenario.expectedCaregloFallbackSplitHero) {
      const heroMedia = Object.values(layout)
        .find((node) => typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.includes('monteby_media=careglo-fallback-hero-main'));
      const proofMedia = Object.values(layout)
        .find((node) => typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.includes('monteby_media=careglo-side-proof'));
      const sideRail = proofMedia ? layout[proofMedia.parent] : null;
      const statsCard = Object.values(layout)
        .find((node) => node?.props?.backgroundColor === scenario.expectedCardBg && node?.props?.flexGrow === 1 && node?.props?.paddingTop === '18px');
      const bookButton = Object.entries(layout)
        .find(([, node]) => node?.props?.label === scenario.expectedHeroCta);
      const actionsParent = bookButton ? layout[bookButton[1].parent] : null;
      assert.equal(heroMedia?.props?.flexBasis, '467px');
      assert.equal(heroMedia?.props?.width, '467px');
      assert.equal(heroMedia?.props?.minHeight, scenario.expectedLayoutVisualMin);
      assert.equal(proofMedia?.props?.width, '224px');
      assert.equal(proofMedia?.props?.minHeight, '269px');
      assert.equal(sideRail?.props?.width, '224px');
      assert.equal(statsCard?.props?.borderRadius, '18px');
      assert.equal(actionsParent?.props?.responsiveStack, undefined);
      assert.equal(actionsParent?.props?.gap, '14px');
    }
    if (scenario.expectedCaregloUniqueMediaMin) {
      const mediaSources = Object.values(layout)
        .map((node) => node?.props?.backgroundImage)
        .filter((source) => typeof source === 'string' && /^https?:\/\//.test(source));
      assert.equal(new Set(mediaSources).size >= scenario.expectedCaregloUniqueMediaMin, true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-package-1')), false);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-result-wide')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-reason-1')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-reason-6')), false);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-work-4')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-testimonial-3')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=careglo-testimonial-4')), true);
      const statsGridEntry = Object.entries(layout)
        .find(([, node]) => node?.type?.resolvedName === 'StatsGrid');
      const statsGrid = statsGridEntry?.[1];
      assert.equal(statsGrid?.props?.cellBg, scenario.expectedBg);
      assert.equal(statsGrid?.props?.columnsTablet, 4);
      assert.equal(statsGrid?.props?.columnsMobile, 2);
      let statsRootId = statsGridEntry?.[0];
      while (statsRootId && layout[statsRootId]?.parent && layout[statsRootId].parent !== 'ROOT') {
        statsRootId = layout[statsRootId].parent;
      }
      const firstServiceMediaEntry = Object.entries(layout)
        .find(([, node]) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-service-card-1'));
      let serviceRootId = firstServiceMediaEntry?.[0];
      while (serviceRootId && layout[serviceRootId]?.parent && layout[serviceRootId].parent !== 'ROOT') {
        serviceRootId = layout[serviceRootId].parent;
      }
      assert.ok(layout.ROOT.nodes.indexOf(statsRootId) < layout.ROOT.nodes.indexOf(serviceRootId));
      assert.match(layoutJson, /Premium finish care for every surface\./);
      assert.equal(layout[serviceRootId]?.props?.paddingTopTablet, '0px');
      assert.equal(layout[serviceRootId]?.props?.paddingTopMobile, '131px');
      assert.equal(layout[serviceRootId]?.props?.paddingBottom, '76px');
      assert.equal(layout[serviceRootId]?.props?.innerPaddingX, '24px');
      const firstServiceCard = firstServiceMediaEntry ? layout[firstServiceMediaEntry[1].parent] : null;
      const secondServiceCard = Object.values(layout)
        .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-service-card-2'));
      const thirdServiceCard = Object.values(layout)
        .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-service-card-3'));
      assert.equal(firstServiceCard?.props?.minHeight, '555px');
      assert.equal(firstServiceCard?.props?.minHeightMobile, '454px');
      assert.equal(secondServiceCard?.props?.minHeightTablet, '500px');
      assert.equal(thirdServiceCard?.props?.minHeightTablet, '366px');
      assert.equal(thirdServiceCard?.props?.gridColumnSpanTablet, 2);
      const firstWorkMedia = Object.values(layout)
        .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-work-1'));
      const lastWorkMedia = Object.values(layout)
        .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-work-4'));
      assert.equal(firstWorkMedia?.props?.gridColumnSpanTablet, 3);
      assert.equal(firstWorkMedia?.props?.minHeightMobile, '250px');
      assert.equal(lastWorkMedia?.props?.gridColumnSpanTablet, 1);
      assert.equal(lastWorkMedia?.props?.minHeightMobile, '70px');
      const testimonialDetail = Object.values(layout)
        .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-testimonial-3'));
      assert.equal(testimonialDetail?.props?.gridColumnStart, 4);
      assert.equal(testimonialDetail?.props?.minHeightTablet, '300px');
      assert.equal(testimonialDetail?.props?.minHeightMobile, '291px');
      const testimonialSupplement = Object.values(layout)
        .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-testimonial-4'));
      assert.equal(testimonialSupplement?.props?.minHeight, '120px');
      const resultMetric = Object.entries(layout)
        .find(([, node]) => node?.props?.text === '12+ years');
      const resultProof = resultMetric ? layout[resultMetric[1].parent] : null;
      assert.equal(resultProof?.props?.minHeightMobile, '637px');
      const firstReasonMedia = Object.entries(layout)
        .find(([, node]) => String(node?.props?.backgroundImage || '').includes('monteby_media=careglo-reason-1'));
      const firstReasonCard = firstReasonMedia ? layout[firstReasonMedia[1].parent] : null;
      assert.equal(firstReasonCard?.props?.minHeight, '440px');
      assert.equal(firstReasonCard?.props?.minHeightTablet, '410px');
      assert.equal(firstReasonCard?.props?.minHeightMobile, '457px');
      const packageHeading = Object.entries(layout)
        .find(([, node]) => node?.props?.text === 'Essential wash');
      const packageContent = packageHeading ? layout[packageHeading[1].parent] : null;
      const packageCard = packageContent ? layout[packageContent.parent] : null;
      assert.equal(packageCard?.props?.minHeight, '610px');
      assert.equal(packageCard?.props?.minHeightTablet, '592px');
      assert.equal(packageCard?.props?.minHeightMobile, '680px');
      const testimonialLabel = Object.entries(layout)
        .find(([, node]) => node?.props?.text === '/Testimonials');
      let testimonialRootId = testimonialLabel?.[0];
      while (testimonialRootId && layout[testimonialRootId]?.parent && layout[testimonialRootId].parent !== 'ROOT') {
        testimonialRootId = layout[testimonialRootId].parent;
      }
      assert.equal(layout[testimonialRootId]?.props?.paddingTopMobile, '68px');
      assert.equal(layout[testimonialRootId]?.props?.paddingBottomMobile, '188px');
      const partnerHeading = Object.entries(layout)
        .find(([, node]) => node?.props?.text === 'Trusted partners in finish care');
      const partnerIntro = partnerHeading ? layout[partnerHeading[1].parent] : null;
      const partnerPanel = partnerIntro ? layout[partnerIntro.parent] : null;
      assert.equal(partnerPanel?.props?.borderWidth, '1px');
      assert.equal(partnerPanel?.props?.minHeightMobile, '585px');
      assert.match(layoutJson, /\/Pricing plans/);
      assert.match(layoutJson, /Interior hand wash and vacuum/);
      const footer = Object.values(layout)
        .find((node) => node?.parent === 'ROOT' && node?.props?.tag === 'footer');
      assert.ok(footer);
      assert.equal(footer.props.minHeight, '694px');
      assert.equal(footer.props.minHeightTablet, '839px');
      assert.equal(footer.props.minHeightMobile, '1580px');
      assert.match(layoutJson, /hello@aureline\.studio/);
    }
    if (scenario.expectedMaidyNavGrow) {
      const topbar = layout[layout.ROOT.nodes[0]];
      assert.equal(topbar?.props?.responsiveDisplay, 'hide-mobile');
      const homeLink = Object.entries(layout)
        .find(([, node]) => node?.props?.text === 'Home');
      const navLinksParent = homeLink ? layout[homeLink[1].parent] : null;
      const contactButton = Object.entries(layout)
        .find(([, node]) => node?.props?.label === 'Contact');
      const contactParent = contactButton ? layout[contactButton[1].parent] : null;
      const phoneButton = Object.entries(layout)
        .find(([, node]) => node?.props?.label === '☎');
      const phoneParent = phoneButton ? layout[phoneButton[1].parent] : null;
      const mobileMenu = Object.values(layout)
        .find((node) => node?.props?.responsiveDisplay === 'show-tablet-down-only'
          && node?.props?.width === '30px');
      const playButton = Object.entries(layout)
        .find(([, node]) => node?.props?.label === '▶');
      assert.equal(navLinksParent?.props?.flexGrow, 1);
      assert.equal(contactParent?.props?.flexShrink, 0);
      assert.equal(contactParent?.props?.responsiveDisplay, 'hide-mobile');
      assert.equal(phoneParent?.props?.responsiveDisplay, 'show-mobile-only');
      assert.equal(mobileMenu?.nodes?.length, 3);
      assert.equal(contactButton?.[1]?.props?.backgroundColor, '#ffdd67');
      assert.equal(playButton?.[1]?.props?.backgroundColor, '#ffdd67');
      assert.match(layoutJson, /TIDYRA CLEANING SERVICE/);
      assert.doesNotMatch(layoutJson, /FreshNest/);
      if (scenario.expectedMaidyEmail) {
        assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedMaidyEmail)));
      }
    }
    if (scenario.expectedMaidyEquipmentMinHeight) {
      const equipmentSurfaces = Object.values(layout)
        .filter((node) => node?.props?.backgroundImage === scenario.expectedMaidyEquipment);
      assert.equal(equipmentSurfaces.some((node) => node?.props?.width === '100%' && node?.props?.minHeight === scenario.expectedMaidyEquipmentMinHeight), true);
      if (scenario.expectedMaidyHeroCutout) {
        const equipmentSlot = layout[equipmentSurfaces[0]?.parent];
        assert.equal(equipmentSlot?.props?.width, '320px');
        assert.equal(equipmentSlot?.props?.maxWidthTablet, '180px');
        assert.equal(equipmentSlot?.props?.maxWidthMobile, '294px');
        assert.equal(equipmentSlot?.props?.responsiveDisplay, undefined);
      }
    }
    if (scenario.expectedMaidyUniqueMediaMin) {
      const mediaSources = Object.values(layout)
        .map((node) => node?.props?.backgroundImage)
        .filter((source) => typeof source === 'string' && /^https?:\/\//.test(source));
      assert.equal(new Set(mediaSources).size >= scenario.expectedMaidyUniqueMediaMin, true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=maidy-equipment-1')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=maidy-team-4')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=maidy-article-3')), true);
    }
    if (scenario.expectedMaidySplitHero) {
      const heroSection = layout[layout.ROOT.nodes[2]];
      assert.equal(heroSection?.props?.backgroundImage, undefined);
      assert.equal(heroSection?.props?.backgroundOverlay, undefined);
      const logoText = Object.values(layout)
        .find((node) => node?.props?.text === 'ALDER');
      const logoWrap = layout[logoText?.parent];
      const logoStrip = layout[logoWrap?.parent];
      assert.equal(logoStrip?.props?.paddingTop, '82px');
      assert.equal(logoStrip?.props?.paddingBottom, '82px');
      assert.equal(logoStrip?.props?.paddingTopMobile, '64px');
      assert.equal(logoStrip?.props?.paddingBottomMobile, '64px');
      assert.equal(logoWrap?.props?.responsiveStack, undefined);
      assert.equal(logoWrap?.props?.flexWrap, 'nowrap');
      assert.equal(logoWrap?.props?.gapMobile, '8px');
      assert.equal(logoText?.props?.fontSizeMobile, '12px');
      const heroWrap = layout[heroSection?.nodes?.[0]];
      assert.equal(heroWrap?.props?.gap, '0px');
      assert.equal(heroWrap?.props?.responsiveStack, scenario.expectedMaidyHeroCutout ? 'mobile' : 'tablet');
      if (scenario.expectedMaidyMobileCopyOffset) {
        const copy = layout[heroWrap?.nodes?.[0]];
        const copyContent = layout[copy?.nodes?.[0]];
        const heroHeading = Object.values(layout)
          .find((node) => node?.props?.text === 'Fresh Rooms,');
        const getStartedButton = Object.values(layout)
          .find((node) => node?.props?.label === 'Get started →');
        const actions = layout[getStartedButton?.parent];
        assert.equal(copy?.props?.justifyContent, 'flex-start');
        assert.equal(copy?.props?.paddingTopMobile, scenario.expectedMaidyHeroCutout ? '50px' : '52px');
        assert.equal(copyContent?.props?.width, '100%');
        assert.equal(copyContent?.props?.maxWidth, scenario.expectedMaidyHeroCutout ? '720px' : '560px');
        assert.equal(copyContent?.props?.paddingLeftTablet, scenario.expectedMaidyHeroCutout ? '30px' : undefined);
        assert.equal(copyContent?.props?.paddingLeftMobile, '20px');
        assert.equal(copyContent?.props?.paddingRightMobile, '20px');
        assert.equal(copyContent?.props?.maxWidthMobile, '100%');
        if (scenario.expectedMaidyHeroCutout) {
          assert.equal(heroHeading?.props?.fontSizeTablet, '48px');
          assert.equal(heroHeading?.props?.fontSizeMobile, '47px');
          assert.equal(heroHeading?.props?.lineHeightTablet, '65px');
          assert.equal(heroHeading?.props?.lineHeightMobile, '1.3');
          assert.equal(heroHeading?.props?.fontWeight, '600');
        } else {
          assert.equal(heroHeading?.props?.fontSizeMobile, '45px');
        }
        assert.equal(actions?.props?.responsiveStack, undefined);
      }
      if (scenario.expectedMaidyHeroCutout) {
        const cutoutStage = Object.values(layout)
          .find((node) => node?.props?.backgroundImage === scenario.expectedMaidyHeroCutout);
        assert.equal(cutoutStage?.type?.resolvedName, 'Container');
        assert.equal(cutoutStage?.props?.backgroundSize, 'contain');
        assert.equal(cutoutStage?.props?.backgroundPosition, 'top');
        assert.equal(cutoutStage?.props?.backgroundAccentColor1, '#ffdd67');
        const visualStage = layout[cutoutStage?.parent];
        assert.equal(visualStage?.props?.flexBasis, '600px');
        assert.equal(visualStage?.props?.flexShrink, 0);
        assert.equal(visualStage?.props?.width, '600px');
        assert.equal(visualStage?.props?.paddingTopMobile, '40px');
        assert.equal(visualStage?.props?.backgroundImage, undefined);
        assert.equal(visualStage?.props?.backgroundOverlay, undefined);
      } else {
        const heroVisual = Object.values(layout)
          .find((node) => typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.startsWith(scenario.expectedHero));
        assert.equal(heroVisual?.type?.resolvedName, 'Container');
        assert.equal(heroVisual?.props?.backgroundSize, 'cover');
        assert.equal(heroVisual?.props?.backgroundPosition, 'top');
      }
    }
    if (scenario.expectedFullWidthHero) {
      assert.match(layoutJson, /"innerMaxWidth": "1240px"/);
      assert.match(layoutJson, /"innerPaddingX": "20px"/);
      assert.match(layoutJson, /"width": "310px"/);
      assert.match(layoutJson, new RegExp(escapeRegExp(`"backgroundImage": "${scenario.expectedHero}`)));
      const heroSection = layout[layout.ROOT.nodes[1]];
      const heroWrap = layout[heroSection?.nodes?.[0]];
      const heroCopy = layout[heroWrap?.nodes?.[0]];
      const heroActions = layout[heroCopy?.nodes?.find((nodeId) => layout[nodeId]?.props?.gap === '12px')];
      assert.equal(heroSection?.props?.minHeightTablet, scenario.expectedLayoutHeroMinTablet);
      assert.equal(heroWrap?.props?.minHeightTablet, scenario.expectedLayoutHeroMinTablet);
      assert.equal(heroCopy?.props?.flexBasis, undefined);
      assert.equal(heroActions?.props?.alignItems, 'stretch');
      assert.equal(heroActions?.props?.width, '100%');
    }
    if (scenario.expectedOptomattaUniqueMediaMin) {
      const mediaSources = Object.values(layout)
        .map((node) => node?.props?.backgroundImage)
        .filter((source) => typeof source === 'string' && /^https?:\/\//.test(source));
      assert.equal(new Set(mediaSources).size >= scenario.expectedOptomattaUniqueMediaMin, true);
      assert.equal(report.audit.stats.mediaSurfaces >= scenario.expectedOptomattaUniqueMediaMin, true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=optomatta-process-03')), true);
      assert.equal(mediaSources.some((source) => source.includes('monteby_media=optomatta-trust-3')), true);
    }
    if (scenario.expectedMinimumRootSections) {
      assert.equal(layout.ROOT.nodes.length >= scenario.expectedMinimumRootSections, true, scenario.archetype);
    }
    if (scenario.expectedHomepageDepthCopy) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedHomepageDepthCopy)));
    }
    if (scenario.expectedMaidyDepthCopy) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedMaidyDepthCopy)));
    }
    if (scenario.expectedLumenDoctorMarker) {
      assert.match(layoutJson, new RegExp(escapeRegExp(scenario.expectedLumenDoctorMarker)));
      assert.match(layoutJson, /"backgroundPosition": "right"/);
      assert.match(layoutJson, /"responsiveDisplay": "hide-tablet-down"/);
    }
    if (scenario.expectedLumenDoctorCutout) {
      const doctorNode = Object.values(layout)
        .find((node) => node?.props?.backgroundImage === scenario.expectedLumenDoctorCutout);
      assert.equal(doctorNode?.type?.resolvedName, 'Container');
      assert.equal(doctorNode?.props?.backgroundSize, 'contain');
      assert.equal(doctorNode?.props?.backgroundPosition, 'right');
      const heroSection = Object.values(layout)
        .find((node) => node?.parent === 'ROOT' && node?.props?.minHeight === (scenario.expectedLayoutHeroMin || scenario.expectedHeroMin));
      assert.equal(heroSection?.props?.backgroundImage, undefined);
      assert.equal(heroSection?.props?.backgroundAccentType, 'radial');
    }
    assert.match(layoutJson, new RegExp(escapeRegExp(`"backgroundColor": "${scenario.expectedBg}"`)));
    assert.match(layoutJson, new RegExp(escapeRegExp(`"backgroundColor": "${scenario.expectedCardBg}"`)));
    assert.match(layoutJson, new RegExp(escapeRegExp(`"backgroundColor": "${scenario.expectedButtonBg}"`)));
    assert.match(layoutJson, new RegExp(escapeRegExp(`"innerMaxWidth": "${scenario.expectedInnerMaxWidth}"`)));
    assert.match(layoutJson, new RegExp(escapeRegExp(`"borderRadius": "${scenario.expectedRadius}"`)));
    assert.match(layoutJson, new RegExp(escapeRegExp(`"minHeight": "${scenario.expectedLayoutHeroMin || scenario.expectedHeroMin}"`)));
    assert.match(layoutJson, new RegExp(escapeRegExp(`"minHeight": "${scenario.expectedLayoutVisualMin || scenario.expectedVisualMin}"`)));
    assert.doesNotMatch(layoutJson, new RegExp(escapeRegExp(scenario.forbiddenHero)));
    assert.doesNotMatch(layoutJson, /repeat\(/);
    assert.doesNotMatch(layoutJson, /First-pass Monteby recreation scaffold/);
    assert.doesNotMatch(layoutJson, /Replacement copy for the visual target/);
    assertUserFacingNodePropsAreOriginal(layout);
    assert.equal(report.audit.ok, true, scenario.archetype);
    assert.equal(report.audit.stats.satisfiedMediaRoles, 3, scenario.archetype);
  }
});

test('draft layout authors the full Lumen V2 band sequence and hero mechanics', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-lumen-v2-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const doctorCutout = 'https://cdn.example.test/assets/clearwell-doctor-v2.png?asset=lumen-v2';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'lumen-eye-care-editorial',
      referenceStyle: 'lumen-eye-care-editorial',
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#eefbe3',
        '--panel': '#ffffff',
        '--ink': '#061a27',
        '--muted': '#526271',
        '--accent': '#2fd678',
        '--accent-2': '#0f7768',
        '--max': '1280px',
        '--radius': '30px',
        '--hero-min': '780px',
        '--visual-min': '640px',
      },
    },
    text: {
      h1: ['Editorial vision care'],
      h2: ['Calm specialist guidance'],
      h3: ['Vision reviews', 'Comfort therapy', 'Lens guidance'],
      ctas: ['Book now', 'Explore services'],
      stats: ['10K visits', '15 years'],
    },
  });

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest(brief)));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MONTEBY_LUMEN_DOCTOR_CUTOUT_URL: doctorCutout,
    },
  });

  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const sections = layout.ROOT.nodes.map((nodeId) => layout[nodeId]);
  const contentBands = sections.slice(1);

  assert.equal(report.audit.ok, true);
  assert.equal(sections.length, 13);
  assert.deepEqual(contentBands.map((section) => section.props.minHeight), [
    '952px', '690px', '954px', '592px', '826px', '1019px',
    '1143px', '899px', '710px', '594px', '977px', '681px',
  ]);
  assert.deepEqual(contentBands.map((section) => section.props.minHeightTablet), [
    '1014px', '1210px', '1447px', '1222px', '1440px', '1564px',
    '1436px', '1434px', '982px', '504px', '1812px', '873px',
  ]);
  assert.deepEqual(contentBands.map((section) => section.props.minHeightMobile), [
    '1305px', '1233px', '1925px', '972px', '1391px', '2710px',
    '2280px', '1323px', '1576px', '498px', '1904px', '1563px',
  ]);
  assert.equal(sections.at(-1)?.props?.tag, 'footer');

  const heroHeadings = Object.values(layout)
    .filter((node) => node?.type?.resolvedName === 'Heading' && node?.props?.tag === 'h1');
  assert.deepEqual(heroHeadings.map((node) => node.props.text), ['Clear Sight.', 'Bright Days.']);
  assert.equal(heroHeadings.every((node) => node.props.fontFamily === 'Outfit'), true);
  assert.equal(heroHeadings.every((node) => node.props.fontSizeMobile === '60px'), true);

  const doctorNode = Object.values(layout)
    .find((node) => node?.props?.backgroundImage === doctorCutout);
  const doctorOffset = layout[doctorNode?.parent];
  assert.equal(doctorNode?.props?.width, '440px');
  assert.equal(doctorNode?.props?.minHeight, '530px');
  assert.equal(doctorNode?.props?.backgroundSize, 'contain');
  assert.equal(doctorOffset?.props?.paddingLeft, '110px');
  assert.equal(doctorOffset?.props?.responsiveDisplay, 'hide-tablet-down');

  const miniMedia = Object.values(layout)
    .find((node) => String(node?.props?.backgroundImage || '').includes('monteby_media=lumen-hero-mini'));
  assert.equal(miniMedia?.props?.maxWidth, '235px');
  assert.equal(miniMedia?.props?.minHeight, '156px');
  assert.equal(miniMedia?.props?.maxWidthMobile, '100%');
  assert.equal(miniMedia?.props?.minHeightMobile, '232px');

  const proofHeading = Object.values(layout)
    .find((node) => node?.props?.text === 'Qualified eye care, explained clearly');
  const proofCard = layout[proofHeading?.parent];
  const proofColumn = layout[proofCard?.parent];
  assert.equal(proofColumn?.props?.width, '338px');
  assert.equal(proofColumn?.props?.paddingTop, '247px');

  const heroStats = Object.values(layout)
    .filter((node) => ['10K+', '15+'].includes(node?.props?.text));
  assert.equal(heroStats.length, 4);
  assert.equal(heroStats.every((node) => node?.type?.resolvedName === 'Heading'), true);
  assert.equal(heroStats.every((node) => node?.props?.tag === 'h2'), true);
  assert.equal(Object.values(layout).some((node) => node?.type?.resolvedName === 'StatsGrid'), false);

  const authoredMedia = Object.values(layout)
    .map((node) => node?.props?.backgroundImage)
    .filter((source) => typeof source === 'string' && /^https?:\/\//.test(source));
  assert.equal(authoredMedia.length >= 22, true);
  assert.equal(new Set(authoredMedia).size >= 22, true);
  assert.equal(authoredMedia.some((source) => source.includes('monteby_media=lumen-article-3')), true);
  assert.equal(authoredMedia.some((source) => source.includes('monteby_media=lumen-booking-band')), true);

  const heroWrap = layout[contentBands[0]?.nodes?.[0]];
  assert.equal(heroWrap?.props?.paddingLeft, '60px');
  assert.equal(heroWrap?.props?.paddingLeftTablet, '30px');
  assert.equal(heroWrap?.props?.paddingLeftMobile, '0px');
  assertUserFacingNodePropsAreOriginal(layout);
});

test('draft layout authors the full Maidy band sequence with clean responsive controls', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-full-bands-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const heroCutout = 'https://cdn.example.test/assets/tidyra-cleaner.png';
  const equipmentCutout = 'https://cdn.example.test/assets/tidyra-vacuum.png';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
  });
  const contractValue = contract();

  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest(brief)));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MONTEBY_MAIDY_HERO_CUTOUT_URL: heroCutout,
      MONTEBY_MAIDY_HERO_COMPOSITE_URL: '',
      MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL: equipmentCutout,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const layoutJson = JSON.stringify(layout);
  const rootBands = layout.ROOT.nodes.map((nodeId) => layout[nodeId]);

  assert.equal(report.ok, true);
  assert.equal(report.audit.ok, true);
  assert.equal(report.audit.stats.satisfiedMediaRoles, 3);
  assert.equal(layout.ROOT.nodes.length, 16);

  const expectedBandTexts = [
    [4, 'A clear routine for a home that feels lighter.'],
    [5, 'Focused care for the spaces you use every day.'],
    [6, 'Four clear steps from booking to handover.'],
    [7, 'Prepared tools for floors, fabrics, edges, and air.'],
    [8, 'Reliable care built around your rooms and routines.'],
    [9, 'Choose a plan that fits the pace of your space.'],
    [10, 'Small details that make the whole visit feel easier.'],
    [11, 'People who bring calm, care, and consistency.'],
    [12, 'Practical reading for a calmer weekly reset.'],
    [13, 'A useful note for a tidier week.'],
    [14, 'Tidyra'],
    [15, 'Copyright 2026 Tidyra. All rights reserved.'],
  ];
  for (const [rootIndex, textValue] of expectedBandTexts) {
    const matchingEntries = Object.entries(layout)
      .filter(([, node]) => node?.props?.text === textValue);
    const entry = textValue === 'Tidyra'
      ? matchingEntries.find(([, node]) => node?.props?.tag === 'h2')
      : matchingEntries[0];
    assert.notEqual(entry, undefined, textValue);
    let currentId = entry[0];
    let currentNode = entry[1];
    while (currentNode?.parent && currentNode.parent !== 'ROOT') {
      currentId = currentNode.parent;
      currentNode = layout[currentId];
    }
    assert.equal(currentId, layout.ROOT.nodes[rootIndex], textValue);
  }

  assert.deepEqual(
    rootBands.slice(4).map((node) => node.props.backgroundColor),
    ['#f7f7f4', '#ffffff', '#315f4f', '#315f4f', '#ffffff', '#f3f4f1', '#f3f4f1', '#ffffff', '#f7f7f4', '#ffffff', '#ffffff', '#203740']
  );
  assert.deepEqual(
    rootBands.slice(4).map((node) => [node.props.minHeight, node.props.minHeightTablet]),
    [
      ['904px', '967px'],
      ['970px', '1228px'],
      ['608px', '789px'],
      ['806px', '1298px'],
      ['1012px', '1121px'],
      ['974px', '1996px'],
      ['757px', '688px'],
      ['845px', '1380px'],
      ['824px', '1191px'],
      ['351px', '341px'],
      ['415px', '603px'],
      ['57px', '67px'],
    ]
  );

  const responsiveBandGrids = [
    [4, 'two'],
    [5, 'four'],
    [6, 'four'],
    [7, 'four'],
    [8, 'two'],
    [9, 'three'],
    [10, 'four'],
    [11, 'four'],
    [12, 'three'],
    [13, 'two'],
    [14, 'four'],
  ];
  for (const [rootIndex, desktopColumns] of responsiveBandGrids) {
    const rootId = layout.ROOT.nodes[rootIndex];
    const matchingGrid = Object.entries(layout)
      .filter(([, node]) => node?.type?.resolvedName === 'Container'
        && node?.props?.layoutDisplay === 'grid'
        && node?.props?.gridTemplateColumns === desktopColumns
        && node?.props?.gridTemplateColumnsTablet === 'two'
        && node?.props?.gridTemplateColumnsMobile === 'one'
        && node?.props?.responsiveStack === 'mobile')
      .find(([nodeId, node]) => {
        let currentId = nodeId;
        let currentNode = node;
        while (currentNode?.parent && currentNode.parent !== 'ROOT') {
          currentId = currentNode.parent;
          currentNode = layout[currentId];
        }
        return currentId === rootId;
      });
    assert.notEqual(matchingGrid, undefined, `root band ${rootIndex} needs ${desktopColumns}/two/one grid controls`);
  }

  const teamStage = layout[rootBands[11].nodes[0]];
  const teamBackdrop = layout[teamStage.nodes[0]];
  const firstTeamPosition = layout[teamStage.nodes[2]];
  const thirdTeamPosition = layout[teamStage.nodes[4]];
  assert.equal(teamStage.props.gridTemplateColumns, 'four');
  assert.equal(teamStage.props.gridTemplateColumnsTablet, 'two');
  assert.equal(teamStage.props.gridTemplateColumnsMobile, 'one');
  assert.equal(teamBackdrop.props.backgroundColor, '#ffdd67');
  assert.equal(teamBackdrop.props.gridColumnSpan, 4);
  assert.equal(teamBackdrop.props.gridColumnSpanTablet, 2);
  assert.equal(teamBackdrop.props.gridColumnSpanMobile, 1);
  assert.equal(teamBackdrop.props.gridRowStart, 1);
  assert.equal(firstTeamPosition.props.gridRowStartTablet, 1);
  assert.equal(firstTeamPosition.props.paddingTopTablet, '262px');
  assert.equal(thirdTeamPosition.props.gridRowStartTablet, 2);
  assert.equal(thirdTeamPosition.props.paddingTopTablet, '0px');

  const logoWrap = layout[rootBands[3].nodes[0]];
  assert.equal(logoWrap.props.responsiveStack, undefined);
  assert.equal(logoWrap.props.flexWrap, 'nowrap');
  assert.equal(logoWrap.props.gapMobile, '8px');
  assert.equal(rootBands[3].props.paddingTopMobile, '64px');
  assert.equal(rootBands[3].props.paddingBottomMobile, '64px');

  const newsletterWrap = layout[rootBands[13].nodes[0]];
  assert.equal(newsletterWrap.props.backgroundColor, '#315f4f');
  assert.equal(newsletterWrap.props.minHeight, '351px');
  assert.equal(newsletterWrap.props.minHeightTablet, '341px');
  assert.equal(rootBands[14].props.tag, 'footer');
  assert.equal(rootBands[14].props.backgroundColor, '#ffffff');
  assert.equal(rootBands[15].props.backgroundColor, '#203740');

  const allowedPropsByComponent = new Map(contractValue.components.map((component) => [component.name, new Set(component.props)]));
  const blockedProps = new Set(['className', 'cssId', 'customAttributes', 'motion', 'rawHtml', 'html', 'customCss', 'style']);
  for (const [nodeId, node] of Object.entries(layout)) {
    if (nodeId === 'ROOT') {
      continue;
    }
    const allowedProps = allowedPropsByComponent.get(node.type.resolvedName);
    assert.notEqual(allowedProps, undefined, node.type.resolvedName);
    for (const propName of Object.keys(node.props)) {
      assert.equal(allowedProps.has(propName), true, `${nodeId}.${propName} must come from the contract`);
      assert.equal(blockedProps.has(propName), false, `${nodeId}.${propName} is blocked`);
      assert.doesNotMatch(propName, /^on[A-Z]/, `${nodeId}.${propName} must not be an event handler`);
    }
  }

  const mediaSources = Object.values(layout)
    .map((node) => node?.props?.backgroundImage)
    .filter((source) => typeof source === 'string' && /^https?:\/\//.test(source));
  assert.equal(new Set(mediaSources).size >= 18, true);
  assert.equal(mediaSources.some((source) => source.includes('monteby_media=maidy-equipment-4')), true);
  assert.equal(mediaSources.some((source) => source.includes('monteby_media=maidy-team-4')), true);
  assert.equal(mediaSources.some((source) => source.includes('monteby_media=maidy-article-3')), true);
  assert.equal(Object.values(layout).some((node) => node?.type?.resolvedName === 'StatsGrid'), false);
  assert.equal(Object.values(layout).some((node) => node?.type?.resolvedName === 'IconBlock'), false);
  assert.equal(Object.values(layout).some((node) => node?.type?.resolvedName === 'TestimonialsCarousel'), false);
  assert.doesNotMatch(layoutJson, /Qualified Doctors|28 doctors|24h service|4\.9 rating/);
  assert.doesNotMatch(layoutJson, /askproject\.net|wp-content\/uploads\/sites\/71|Avoid A Dirty Scene|Keep Your Place Clean & Fresh|maidy@mails\.com/i);
  assertUserFacingNodePropsAreOriginal(layout);
});

test('draft layout keeps the Maidy hero panel green without captured color tokens', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-default-colors-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const cutout = 'https://cdn.example.test/monteby-maidy-cleaner-cutout.png';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
    visualSignals: {
      rootVariables: {},
    },
  });
  const env = {
    ...process.env,
    MONTEBY_MAIDY_HERO_CUTOUT_URL: cutout,
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest(brief)));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8', env });

  assert.equal(result.status, 0, result.stderr);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const finalHeroLine = Object.values(layout)
    .find((node) => node?.props?.text === 'Clean & Ready');
  const cutoutStage = Object.values(layout)
    .find((node) => node?.props?.backgroundImage === cutout);
  const visualStage = layout[cutoutStage?.parent];

  assert.equal(finalHeroLine?.props?.textColor, '#315f4f');
  assert.equal(visualStage?.props?.backgroundColor, '#315f4f');
});

test('draft layout renders a configured Maidy equipment cutout through responsive controls', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-equipment-cutout-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const heroCutout = 'https://cdn.example.test/assets/original-cleaner-cutout.png';
  const equipmentCutout = 'https://cdn.example.test/assets/original-vacuum-cutout.png';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
  });

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest(brief)));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MONTEBY_MAIDY_HERO_CUTOUT_URL: heroCutout,
      MONTEBY_MAIDY_HERO_COMPOSITE_URL: '',
      MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL: equipmentCutout,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const equipmentSurface = Object.values(layout)
    .find((node) => String(node?.props?.backgroundImage || '').startsWith(equipmentCutout));

  assert.equal(equipmentSurface?.props?.backgroundSize, 'contain');
  assert.equal(equipmentSurface?.props?.backgroundRepeat, 'no-repeat');
  assert.equal(equipmentSurface?.props?.backgroundPositionX, '-80px');
  assert.equal(equipmentSurface?.props?.backgroundPositionXTablet, '-30px');
  assert.equal(equipmentSurface?.props?.backgroundPositionXMobile, '-50px');
  assert.equal(equipmentSurface?.props?.backgroundPositionY, '50%');
  assert.equal(equipmentSurface?.props?.backgroundPositionYTablet, '50%');
  assert.equal(equipmentSurface?.props?.backgroundPositionYMobile, '50%');
  assert.equal(equipmentSurface?.props?.minHeightMobile, '237px');
  const equipmentSlot = layout[equipmentSurface?.parent];
  const lowerStage = layout[equipmentSlot?.parent];
  const actionRow = lowerStage?.nodes
    ?.map((nodeId) => layout[nodeId])
    .find((node) => node?.props?.paddingLeft === '120px');
  assert.equal(lowerStage?.props?.layoutDisplay, 'grid');
  assert.equal(equipmentSlot?.props?.gridColumnStart, 1);
  assert.equal(equipmentSlot?.props?.gridRowStart, 1);
  assert.equal(equipmentSlot?.props?.paddingTop, '57px');
  assert.equal(equipmentSlot?.props?.paddingTopTablet, '80px');
  assert.equal(equipmentSlot?.props?.paddingTopMobile, '30px');
  assert.equal(actionRow?.props?.gridColumnStart, 1);
  assert.equal(actionRow?.props?.gridRowStart, 1);
  assert.equal(actionRow?.props?.paddingTop, '62px');
  assert.equal(actionRow?.props?.paddingTopTablet, '35px');
  assert.equal(actionRow?.props?.paddingTopMobile, '35px');
  assert.equal(JSON.stringify(layout).includes('className'), false);
});

test('draft layout maps semantic Maidy media geometry across responsive viewports', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-semantic-geometry-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const desktopLayoutPath = path.join(directory, 'reference-layout.json');
  const tabletLayoutPath = path.join(directory, 'reference-layout-tablet.json');
  const mobileLayoutPath = path.join(directory, 'reference-layout-mobile.json');
  const heroCutout = 'https://cdn.example.test/assets/original-cleaner-cutout.png';
  const capturedCleaner = 'https://captured.example.test/happy-cleaner.png';
  const capturedVacuum = 'https://captured.example.test/vacuum-cleaner.png';
  const decorativeBackground = 'https://captured.example.test/bg_35.png';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://askproject.net/maidy/home/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(desktopLayoutPath, JSON.stringify({
    viewport: { width: 1440, height: 1200 },
    mediaBoxes: [
      { source: decorativeBackground, rect: { x: 0, y: 49, width: 1440, height: 947 }, firstViewportArea: 1363680 },
      { source: capturedCleaner, rect: { x: 720, y: 149, width: 600, height: 847 }, firstViewportArea: 508200 },
      { source: capturedVacuum, rect: { x: -80, y: 743, width: 320, height: 258 }, firstViewportArea: 61920 },
    ],
    meaningfulMediaBoxes: [
      { source: capturedCleaner, role: 'hero', rect: { x: 720, y: 149, width: 600, height: 847 }, firstViewportArea: 508200 },
      { source: capturedVacuum, role: 'secondary', rect: { x: -80, y: 743, width: 320, height: 258 }, firstViewportArea: 61920 },
    ],
    textBoxes: [{ tag: 'h1', text: 'Reference heading', rect: { x: 120, y: 250, width: 480, height: 260 }, firstViewportArea: 124800 }],
  }));
  fs.writeFileSync(tabletLayoutPath, JSON.stringify({
    viewport: { width: 834, height: 1112 },
    mediaBoxes: [
      { source: decorativeBackground, rect: { x: 0, y: 57, width: 834, height: 784 }, firstViewportArea: 653856 },
      { source: capturedCleaner, rect: { x: 417, y: 263, width: 387, height: 575 }, firstViewportArea: 222525 },
      { source: capturedVacuum, rect: { x: -30, y: 697, width: 179, height: 144 }, firstViewportArea: 21456 },
    ],
    meaningfulMediaBoxes: [
      { source: capturedCleaner, role: 'hero', rect: { x: 417, y: 263, width: 387, height: 575 }, firstViewportArea: 222525 },
      { source: capturedVacuum, role: 'secondary', rect: { x: -30, y: 697, width: 179, height: 144 }, firstViewportArea: 21456 },
    ],
    textBoxes: [{ tag: 'h1', text: 'Reference heading', rect: { x: 30, y: 255, width: 387, height: 260 }, firstViewportArea: 100620 }],
  }));
  fs.writeFileSync(mobileLayoutPath, JSON.stringify({
    viewport: { width: 390, height: 844 },
    mediaBoxes: [
      { source: decorativeBackground, rect: { x: 0, y: 0, width: 390, height: 844 }, firstViewportArea: 329160 },
      { source: capturedVacuum, rect: { x: -50, y: 566, width: 294, height: 237 }, firstViewportArea: 57834 },
      { source: capturedCleaner, rect: { x: 38, y: 843, width: 315, height: 468 }, firstViewportArea: 315 },
    ],
    meaningfulMediaBoxes: [
      { source: capturedVacuum, role: 'hero', rect: { x: -50, y: 566, width: 294, height: 237 }, firstViewportArea: 57834 },
      { source: capturedCleaner, role: 'service-card', rect: { x: 38, y: 843, width: 315, height: 468 }, firstViewportArea: 315 },
    ],
    textBoxes: [{ tag: 'h1', text: 'Reference heading', rect: { x: 20, y: 245, width: 350, height: 300 }, firstViewportArea: 104650 }],
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MONTEBY_MAIDY_HERO_CUTOUT_URL: heroCutout,
      MONTEBY_MAIDY_HERO_COMPOSITE_URL: '',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const cutoutStage = Object.values(layout)
    .find((node) => node?.props?.backgroundImage === heroCutout);
  const visualStage = layout[cutoutStage?.parent];

  assert.equal(cutoutStage?.props?.minHeight, '847px');
  assert.equal(cutoutStage?.props?.minHeightTablet, '575px');
  assert.equal(cutoutStage?.props?.minHeightMobile, '468px');
  assert.equal(cutoutStage?.props?.maxWidthTablet, '387px');
  assert.equal(cutoutStage?.props?.paddingBottomTablet, '0px');
  assert.equal(visualStage?.props?.paddingTopTablet, '115px');
  assert.equal(visualStage?.props?.paddingTopMobile, '40px');
  assert.equal(JSON.stringify(layout).includes('className'), false);
});

test('draft layout keeps generated Maidy fallback close to the measured target rhythm', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-generated-rhythm-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const internalLead = 'A bright cleaning-agency homepage with a large people-first hero, equipment image, bold CTA, quote card, and logo strip pressure.';
  const expectedLead = 'Home cleaning, routine upkeep, and simple booking for spaces that need to feel calm again.';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
    text: {
      h1: ['Avoid the mess, keep every room crisp and calm.'],
      h2: ['Cleaning plans for homes and offices'],
      h3: ['House refresh', 'Office upkeep', 'Move-out reset'],
      ctas: ['Get started →', 'How we work'],
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#f7f7f4',
        '--panel': '#ffffff',
        '--ink': '#060708',
        '--muted': '#7f817d',
        '--accent': '#ffdd67',
        '--accent-2': '#315f4f',
        '--hero-min': '665px',
        '--visual-min': '560px',
      },
    },
  });
  brief.renderedLayouts = [
    {
      label: 'desktop',
      textSamples: [
        { tag: 'p', text: internalLead },
      ],
    },
  ];

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(referenceManifest(brief)));

  const env = { ...process.env };
  delete env.MONTEBY_MAIDY_HERO_CUTOUT_URL;
  delete env.MONTEBY_MAIDY_HERO_COMPOSITE_URL;

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
    '--require-marketplace-media',
  ], { encoding: 'utf8', env });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const layoutJson = JSON.stringify(layout);

  assert.equal(report.ok, true);
  assert.match(layoutJson, /Avoid the mess,/);
  assert.match(layoutJson, /keep every room/);
  assert.match(layoutJson, /crisp and calm\./);
  assert.doesNotMatch(layoutJson, /Fresh Rooms,/);
  assert.doesNotMatch(layoutJson, new RegExp(escapeRegExp(internalLead)));
  assert.match(layoutJson, new RegExp(escapeRegExp(expectedLead)));
  assertUserFacingNodePropsAreOriginal(layout);

  const heroSection = layout[layout.ROOT.nodes[2]];
  const heroWrap = layout[heroSection?.nodes?.[0]];
  const copy = layout[heroWrap?.nodes?.[0]];
  const heroVisual = Object.values(layout)
    .find((node) => typeof node?.props?.backgroundImage === 'string'
      && node.props.backgroundImage.startsWith('https://images.unsplash.com/photo-1581578731548-c64695cc6952'));
  const heroVisualFrame = layout[heroVisual?.parent];
  const equipmentSurface = Object.values(layout)
    .find((node) => typeof node?.props?.backgroundImage === 'string'
      && node.props.backgroundImage.includes('monteby_media=maidy-hero-equipment'));
  const equipmentSlot = layout[equipmentSurface?.parent];
  const actions = Object.values(layout)
    .find((node) => node?.nodes?.some((childId) => layout[childId]?.props?.label === 'Get started →'));
  const bottomRow = layout[actions?.parent];

  assert.equal(heroWrap?.props?.alignItems, 'flex-start');
  assert.equal(copy?.props?.flexBasis, '55%');
  assert.equal(heroVisualFrame?.props?.width, '520px');
  assert.equal(heroVisualFrame?.props?.flexBasis, '520px');
  assert.equal(heroVisualFrame?.props?.paddingTop, '60px');
  assert.equal(heroVisual?.props?.width, '100%');
  assert.equal(heroVisual?.props?.minHeight, '610px');
  assert.equal(heroVisual?.props?.minHeightTablet, '270px');
  assert.equal(heroVisualFrame?.props?.responsiveDisplay, 'hide-tablet-down');
  assert.equal(bottomRow?.props?.width, '100%');
  assert.equal(bottomRow?.props?.responsiveStack, 'tablet');
  assert.equal(actions?.props?.paddingTop, '13px');
  assert.equal(equipmentSlot?.props?.width, '260px');
  assert.equal(equipmentSlot?.props?.responsiveStack, 'tablet');
  assert.equal(equipmentSlot?.props?.paddingTopTablet, '40px');
  assert.equal(equipmentSurface?.props?.width, '100%');
  assert.equal(equipmentSurface?.props?.minHeight, '170px');
  assert.equal(equipmentSurface?.props?.minHeightTablet, '270px');
});

test('draft layout requires a Maidy cutout asset for captured real Maidy references', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-real-reference-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
    text: {
      h1: ['Avoid A Dirty Scene, Keep Your Place Clean & Fresh'],
      ctas: ['Maidy', '+1 (234) 567 890', 'maidy@mails.com', 'Home', 'About', 'Services'],
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#f7f7f4',
        '--panel': '#ffffff',
        '--ink': '#060708',
        '--muted': '#7f817d',
        '--accent': '#ffdd67',
        '--accent-2': '#315f4f',
        '--button-bg': '#203740',
        '--button-fg': '#ffffff',
        '--hero-min': '716px',
      },
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://askproject.net/maidy/home/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
  };
  const env = { ...process.env };
  delete env.MONTEBY_MAIDY_HERO_CUTOUT_URL;
  delete env.MONTEBY_MAIDY_HERO_COMPOSITE_URL;

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], { encoding: 'utf8', env });

  assert.equal(result.status, 1, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, true);
  assert.equal(report.qualityErrors.some((error) => error.code === 'missing_maidy_hero_cutout_asset'), true);
  assert.match(report.qualityErrors[0].message, /MONTEBY_MAIDY_HERO_CUTOUT_URL/);
  assert.match(report.qualityErrors[0].message, /MONTEBY_MAIDY_HERO_COMPOSITE_URL/);
});

test('draft layout accepts a Maidy hero composite asset for captured real Maidy references', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-maidy-composite-real-reference-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const composite = 'https://cdn.example.test/monteby-maidy-hero-composite.png';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'maid-service-agency',
      referenceStyle: 'maidy-bright-cleaning',
    },
    text: {
      h1: ['Avoid A Dirty Scene, Keep Your Place Clean & Fresh'],
      ctas: ['Maidy', '+1 (234) 567 890', 'maidy@mails.com', 'Home', 'About', 'Services'],
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#f7f7f4',
        '--panel': '#ffffff',
        '--ink': '#060708',
        '--muted': '#7f817d',
        '--accent': '#ffdd67',
        '--accent-2': '#315f4f',
        '--button-bg': '#203740',
        '--button-fg': '#ffffff',
        '--hero-min': '716px',
      },
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://askproject.net/maidy/home/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
  };
  const env = {
    ...process.env,
    MONTEBY_MAIDY_HERO_COMPOSITE_URL: composite,
  };
  delete env.MONTEBY_MAIDY_HERO_CUTOUT_URL;

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], { encoding: 'utf8', env });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const heroSection = layout[layout.ROOT.nodes[2]];
  const visualStage = layout[layout[heroSection.nodes[0]].nodes[1]];

  assert.equal(report.ok, true);
  assert.equal(heroSection?.props?.backgroundImage, composite);
  assert.equal(heroSection?.props?.backgroundSize, 'cover');
  assert.equal(heroSection?.props?.backgroundPosition, 'top');
  assert.equal(visualStage?.props?.flexBasis, '600px');
  assert.equal(visualStage?.props?.flexShrink, 0);
  assert.equal(visualStage?.props?.width, '600px');
  assert.equal(visualStage?.props?.minHeightTablet, '0px');
  assert.equal(visualStage?.props?.minHeightMobile, '0px');
  assert.equal(visualStage?.props?.responsiveDisplay, 'hide-tablet-down');
  assert.equal(visualStage?.props?.backgroundImage, undefined);
  assert.equal(visualStage?.props?.backgroundOverlay, undefined);
  assert.match(JSON.stringify(layout), /Fresh Rooms,/);
  assert.match(JSON.stringify(layout), /TIDYRA CLEANING SERVICE/);
  assert.match(JSON.stringify(layout), /hello@tidyra\.example/);
  assert.doesNotMatch(JSON.stringify(layout), /Avoid A Dirty/);
  assert.doesNotMatch(JSON.stringify(layout), /maidy@mails\.com/);
  assert.equal(Object.values(layout).some((node) => node?.props?.text === 'Maidy'), false);
  assert.doesNotMatch(JSON.stringify(layout), /FreshNest/);
  assertUserFacingNodePropsAreOriginal(layout);
});

test('draft layout requires an Optomatta composite hero asset for captured real Optomatta references', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-optomatta-composite-missing-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'optomatta-optical-retail',
      referenceStyle: 'optomatta-optical-retail',
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#ffffff',
        '--panel': '#f4f6f9',
        '--ink': '#090d13',
        '--accent': '#0788d8',
        '--hero-min': '739px',
      },
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
  };
  const env = { ...process.env };
  delete env.MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL;

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], { encoding: 'utf8', env });

  assert.equal(result.status, 1, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, true);
  assert.equal(report.qualityErrors.some((error) => error.code === 'missing_optomatta_hero_composite_asset'), true);
  assert.match(report.qualityErrors[0].message, /MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL/);
});

test('draft layout requires a Lumen doctor cutout asset for captured real Lumen references', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-lumen-cutout-missing-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'lumen-eye-care-editorial',
      referenceStyle: 'lumen-eye-care-editorial',
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#eefbe3',
        '--panel': '#ffffff',
        '--ink': '#061a27',
        '--accent': '#2fd678',
        '--hero-min': '848px',
      },
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://omispace.com/lumen/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
  };
  const env = { ...process.env };
  delete env.MONTEBY_LUMEN_DOCTOR_CUTOUT_URL;

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], { encoding: 'utf8', env });

  assert.equal(result.status, 1, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, true);
  assert.equal(report.qualityErrors.some((error) => error.code === 'missing_lumen_doctor_cutout_asset'), true);
  assert.match(report.qualityErrors[0].message, /MONTEBY_LUMEN_DOCTOR_CUTOUT_URL/);
});

test('draft layout ignores generated fallback car photos when a real Careglo reference is attached', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-careglo-real-reference-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const generatedCarHero = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=82';
  const generatedCarDetail = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=82';
  const brief = visualBrief({
    target: {
      seed: 'careglo-real-reference',
      variant: 'marketplace-service',
      archetype: 'luxury-car-care',
      referenceStyle: 'careglo-dark-service',
    },
    text: {
      h1: ['Detailing That Defines True Luxury.'],
      h2: ['Careglo benchmark scaffold'],
      h3: ['Careglo template care', 'Reference finish', 'Monteby recreation'],
      ctas: ['Careglo', '+1 (234) 567 890', 'Book Detailing Now'],
      stats: ['4.9 Careglo benchmark', '24h template response', '1200 reference reviews'],
    },
    media: {
      surfaces: [
        { role: 'hero', placement: 'firstViewport', source: generatedCarHero },
        { role: 'secondary', placement: 'firstViewport', source: generatedCarDetail },
        { role: 'service-card', placement: 'afterHero', source: 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=700&q=80' },
        { role: 'service-card', placement: 'afterHero', source: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=700&q=80' },
        { role: 'service-card', placement: 'afterHero', source: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=700&q=80' },
      ],
      requiredRoles: requiredMediaRoles(),
    },
  });
  const manifest = {
    sourceUrl: 'https://templates.studioniskala.com/car/template-kit/home-page/?storefront=envato-elements',
    requiredMediaRoles: requiredMediaRoles(),
    layout: 'reference-layout.json',
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, 'reference-layout.json'), JSON.stringify({
    viewport: { width: 1440, height: 1200 },
    textBoxes: [
      {
        tag: 'h2',
        text: 'Detailing That Defines True Luxury.',
        rect: { x: 24, y: 232.8, width: 547.64, height: 211.22 },
        lines: [
          { text: 'Detailing That', rect: { x: 24, y: 227.8, width: 429.19, height: 80 } },
          { text: 'Defines True', rect: { x: 24, y: 298.2, width: 382.8, height: 80 } },
          { text: 'Luxury.', rect: { x: 24, y: 368.61, width: 235.72, height: 80 } },
        ],
        firstViewportArea: 115672.52,
        fontSize: '64px',
        fontWeight: '800',
      },
    ],
    mediaBoxes: [
      {
        tag: 'div',
        source: 'https://templates.example.test/careglo-hero.jpg',
        rect: { x: 619.64, y: 182.8, width: 796.36, height: 814.02 },
        firstViewportArea: 648245,
      },
      {
        tag: 'img',
        source: 'https://templates.example.test/careglo-proof.jpg',
        rect: { x: 24, y: 796.81, width: 215.61, height: 200 },
        firstViewportArea: 43122,
      },
    ],
  }));
  fs.writeFileSync(path.join(directory, 'reference-layout-tablet.json'), JSON.stringify({
    viewport: { width: 834, height: 1112 },
    textBoxes: [
      {
        tag: 'h2',
        text: 'Detailing That Defines True Luxury.',
        rect: { x: 24, y: 232.8, width: 786, height: 140.81 },
        lines: [
          { text: 'Detailing That Defines', rect: { x: 77.83, y: 227.8, width: 678.34, height: 80 } },
          { text: 'True Luxury.', rect: { x: 226.56, y: 298.2, width: 380.88, height: 80 } },
        ],
        firstViewportArea: 110676.66,
        fontSize: '64px',
        fontWeight: '800',
      },
    ],
    mediaBoxes: [
      {
        tag: 'div',
        source: 'https://templates.example.test/careglo-tablet-hero.jpg',
        rect: { x: 24, y: 944.41, width: 786, height: 500 },
        firstViewportArea: 131725.74,
      },
      {
        tag: 'img',
        source: 'https://templates.example.test/careglo-tablet-proof.jpg',
        rect: { x: 24, y: 696.41, width: 459.83, height: 200 },
        firstViewportArea: 91966,
      },
    ],
  }));
  fs.writeFileSync(path.join(directory, 'reference-layout-mobile.json'), JSON.stringify({
    viewport: { width: 390, height: 844 },
    textBoxes: [
      {
        tag: 'h2',
        text: 'Detailing That Defines True Luxury.',
        rect: { x: 24, y: 214.8, width: 342, height: 352.03 },
        lines: [
          { text: 'Detailing', rect: { x: 54.8, y: 209.8, width: 280.39, height: 80 } },
          { text: 'That', rect: { x: 126.36, y: 280.2, width: 137.28, height: 80 } },
          { text: 'Defines', rect: { x: 76.17, y: 350.61, width: 237.64, height: 80 } },
          { text: 'True', rect: { x: 128.17, y: 421.02, width: 133.64, height: 80 } },
          { text: 'Luxury.', rect: { x: 77.14, y: 491.42, width: 235.72, height: 80 } },
        ],
        firstViewportArea: 120394.26,
        fontSize: '64px',
        fontWeight: '800',
      },
    ],
    mediaBoxes: [
      {
        tag: 'img',
        source: 'https://templates.example.test/careglo-mobile-proof.jpg',
        rect: { x: 24, y: 1110.42, width: 342, height: 200 },
        firstViewportArea: 0,
      },
      {
        tag: 'img',
        source: 'https://templates.example.test/careglo-mobile-avatar.png',
        rect: { x: 24, y: 1334.42, width: 70, height: 70 },
        firstViewportArea: 0,
      },
      {
        tag: 'div',
        source: 'https://templates.example.test/careglo-mobile-hero.jpg',
        rect: { x: 24, y: 1452.42, width: 342, height: 500 },
        firstViewportArea: 0,
      },
    ],
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layoutJson = fs.readFileSync(layoutPath, 'utf8');

  assert.equal(report.ok, true);
  assert.equal(report.stats.mediaProfile, 'luxury-car-care');
  assert.equal(report.stats.referenceHeroHeadingLines, 3);
  assert.match(layoutJson, /https:\/\/images\.pexels\.com\/photos\/14615262\/pexels-photo-14615262\.jpeg/);
  assert.match(layoutJson, /https:\/\/images\.pexels\.com\/photos\/5233261\/pexels-photo-5233261\.jpeg/);
  assert.doesNotMatch(layoutJson, /https:\/\/images\.pexels\.com\/photos\/17029941\/pexels-photo-17029941\.jpeg/);
  assert.doesNotMatch(layoutJson, new RegExp(escapeRegExp(generatedCarHero)));
  assert.doesNotMatch(layoutJson, new RegExp(escapeRegExp(generatedCarDetail)));
  const layout = JSON.parse(layoutJson);
  const heroHeading = Object.values(layout)
    .find((node) => node?.props?.text === 'Crafted Care for a Lasting First Impression.');
  const copyTopId = heroHeading?.parent;
  const copyTop = heroHeading ? layout[heroHeading.parent] : null;
  const copyColumn = copyTop ? layout[copyTop.parent] : null;
  const heroWrap = copyColumn ? layout[copyColumn.parent] : null;
  const heroSection = heroWrap ? layout[heroWrap.parent] : null;
  const proofMedia = Object.values(layout)
    .find((node) => typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.includes('monteby_media=careglo-hero-proof'));
  const proofParent = proofMedia ? layout[proofMedia.parent] : null;
  const heroMedia = Object.values(layout)
    .find((node) => typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.includes('monteby_media=careglo-hero-main'));
  const heroActionButtons = Object.values(layout)
    .filter((node) => {
      if (node?.type?.resolvedName !== 'ButtonBlock') {
        return false;
      }
      const wrapper = layout[node.parent];
      const actionRow = wrapper ? layout[wrapper.parent] : null;
      return actionRow?.parent === copyTopId;
    });
  const primaryButton = heroActionButtons[0];
  const primaryButtonWrapper = primaryButton ? layout[primaryButton.parent] : null;
  const primaryButtonParent = primaryButtonWrapper ? layout[primaryButtonWrapper.parent] : null;
  const secondaryButton = heroActionButtons[1];
  const secondaryButtonWrapper = secondaryButton ? layout[secondaryButton.parent] : null;
  const certificationHeading = Object.values(layout)
    .find((node) => node?.props?.text === 'Professional & certified experts');
  const certificationColumn = certificationHeading ? layout[certificationHeading.parent] : null;
  const overlayBottom = certificationColumn ? layout[certificationColumn.parent] : null;
  const visualOverlay = overlayBottom ? layout[overlayBottom.parent] : null;
  const leadText = Object.values(layout)
    .find((node) => node?.type?.resolvedName === 'Text' && String(node.props?.text || '').startsWith('Premium interior and exterior'));
  const leadRow = leadText ? layout[leadText.parent] : null;
  const leadMarkerWrap = leadRow ? layout[leadRow.nodes[0]] : null;
  const leadMarker = leadMarkerWrap ? layout[leadMarkerWrap.nodes[0]] : null;
  assert.equal(heroHeading?.props?.fontSize, '64px');
  assert.equal(heroHeading?.props?.fontSizeTablet, '64px');
  assert.equal(heroHeading?.props?.fontSizeMobile, '64px');
  assert.equal(heroHeading?.props?.lineHeight, '1.10');
  assert.equal(heroHeading?.props?.lineHeightTablet, '1.10');
  assert.equal(heroHeading?.props?.lineHeightMobile, '1.10');
  assert.equal(heroHeading?.props?.fontWeight, '800');
  assert.equal(heroHeading?.props?.fontFamily, 'Plus_Jakarta_Sans');
  assert.equal(heroHeading?.props?.textColor, '#ffffff');
  assert.equal(heroHeading?.props?.textAlignMobile, 'center');
  assert.equal(heroSection?.props?.innerPaddingX, '24px');
  assert.equal(heroSection?.props?.paddingTopMobile, '78px');
  assert.equal(heroWrap?.props?.gap, '48px');
  assert.equal(heroWrap?.props?.gapTablet, '48px');
  assert.equal(heroWrap?.props?.gapMobile, '48px');
  assert.equal(copyColumn?.props?.flexBasis, '548px');
  assert.equal(copyColumn?.props?.maxWidth, '548px');
  assert.equal(copyColumn?.props?.maxWidthTablet, '100%');
  assert.equal(heroMedia?.props?.minHeight, '814px');
  assert.equal(heroMedia?.props?.minHeightTablet, '500px');
  assert.equal(heroMedia?.props?.minHeightMobile, '500px');
  assert.equal(proofMedia?.props?.width, '100%');
  assert.equal(proofMedia?.props?.maxWidth, '216px');
  assert.equal(proofMedia?.props?.maxWidthTablet, '460px');
  assert.equal(proofMedia?.props?.maxWidthMobile, '100%');
  assert.equal(proofMedia?.props?.minHeight, '200px');
  assert.equal(proofMedia?.props?.minHeightMobile, '200px');
  assert.equal(proofParent?.props?.paddingTopTablet, '25px');
  assert.equal(proofParent?.props?.paddingTopMobile, '34px');
  assert.equal(proofParent?.props?.responsiveDisplay, undefined);
  assert.equal(primaryButtonParent?.props?.paddingTopTablet, '38px');
  assert.equal(primaryButtonParent?.props?.paddingTop, '39px');
  assert.equal(primaryButtonParent?.props?.paddingTopMobile, '39px');
  assert.equal(primaryButtonParent?.props?.paddingLeftTablet, '206px');
  assert.equal(primaryButtonParent?.props?.responsiveDisplay, undefined);
  assert.equal(primaryButtonParent?.props?.width, '100%');
  assert.equal(primaryButton?.props?.label, 'Reserve Your Detail');
  assert.equal(primaryButton?.props?.paddingTop, '19px');
  assert.equal(primaryButton?.props?.paddingRight, '18px');
  assert.equal(primaryButton?.props?.borderRadius, '14px');
  assert.equal(primaryButton?.props?.fontFamily, 'Poppins');
  assert.equal(primaryButtonWrapper?.props?.justifyContent, 'center');
  assert.equal(secondaryButton?.props?.label, 'Explore Treatments');
  assert.equal(secondaryButtonWrapper?.props?.responsiveDisplay, undefined);
  assert.equal(visualOverlay?.props?.responsiveDisplay, 'hide-mobile');
  assert.equal(leadRow?.props?.gap, '71px');
  assert.equal(leadRow?.props?.gapTablet, '96px');
  assert.equal(leadRow?.props?.gapMobile, '76px');
  assert.equal(leadRow?.props?.paddingLeft, '7px');
  assert.equal(leadRow?.props?.paddingRight, '52px');
  assert.equal(leadRow?.props?.paddingTopMobile, '20px');
  assert.equal(leadRow?.props?.paddingLeftTablet, '44px');
  assert.equal(leadRow?.props?.paddingRightTablet, '62px');
  assert.equal(leadRow?.props?.paddingLeftMobile, '0px');
  assert.equal(leadMarkerWrap?.props?.maxWidth, '34px');
  assert.equal(leadMarkerWrap?.props?.maxWidthMobile, '100%');
  assert.equal(leadMarker?.props?.width, '34px');
  assert.equal(leadMarker?.props?.minHeight, '34px');
  assert.equal(leadMarker?.props?.borderWidth, '4px');
  assert.equal(leadMarker?.props?.borderColor, '#ffd0a8');
  assert.equal(leadText?.props?.textAlignMobile, 'left');
  assert.equal(leadText?.props?.textAlignTablet, 'left');
  assert.equal(leadText?.props?.fontSizeMobile, '20px');
  assert.equal(leadText?.props?.lineHeight, '1.5');
  const avatarNodes = Object.values(layout)
    .filter((node) => typeof node?.props?.backgroundImage === 'string'
      && node.props.backgroundImage.includes('images.unsplash.com/photo-')
      && node.props.width === '70px'
      && node.props.borderRadius === '999px');
  assert.equal(avatarNodes.length, 3);
  for (const avatarNode of avatarNodes) {
    assert.equal(avatarNode.props.maxWidth, '50px');
    assert.equal(avatarNode.props.maxWidthTablet, '50px');
    assert.equal(avatarNode.props.maxWidthMobile, '70px');
    assert.equal(avatarNode.props.minHeightMobile, '70px');
    assert.equal(avatarNode.props.backgroundSize, 'cover');
    assert.equal(avatarNode.props.backgroundPosition, 'center');
  }
  const ratingFirstLine = Object.values(layout)
    .find((node) => node?.type?.resolvedName === 'Text' && node.props?.text === 'Rated 4.8/5');
  const ratingText = ratingFirstLine ? layout[ratingFirstLine.parent] : null;
  const ratingWrap = ratingText ? layout[ratingText.parent] : null;
  const avatarStack = ratingWrap ? layout[ratingWrap.nodes[0]] : null;
  assert.equal(ratingWrap?.props?.alignItems, 'flex-end');
  assert.equal(ratingWrap?.props?.gapMobile, '40px');
  assert.equal(ratingText?.props?.width, '140px');
  assert.equal(ratingText?.nodes?.length, 2);
  assert.equal(avatarStack?.props?.layoutDisplay, 'grid');
  assert.equal(avatarStack?.props?.gridTemplateColumns, 'three');
  assert.equal(avatarStack?.props?.width, '150px');
  assert.equal(avatarStack?.props?.minHeight, '70px');
  assert.equal(Object.values(layout).some((node) => node?.props?.text === 'Services +'), false);
  const homeLink = Object.values(layout)
    .find((node) => node?.type?.resolvedName === 'Text' && node.props?.text === 'Home');
  assert.equal(homeLink?.props?.fontWeight, '400');
  assert.equal(homeLink?.props?.fontFamily, 'Poppins');
  const navLinksWrap = homeLink ? layout[homeLink.parent] : null;
  const navWrap = navLinksWrap ? layout[navLinksWrap.parent] : null;
  assert.equal(navLinksWrap?.props?.justifyContent, 'flex-start');
  assert.equal(navLinksWrap?.props?.paddingLeft, '188px');
  assert.equal(navWrap?.props?.minHeight, '87px');
  assert.equal(navWrap?.props?.minHeightTablet, '87px');
  assert.equal(navWrap?.props?.minHeightMobile, '87px');
  assert.equal(navWrap?.props?.paddingTop, '16px');
  assert.equal(navWrap?.props?.paddingBottom, '17px');
  const appointmentButton = Object.values(layout)
    .find((node) => node?.type?.resolvedName === 'ButtonBlock' && node.props?.label === 'Reserve a Visit');
  const appointmentWrapper = appointmentButton ? layout[appointmentButton.parent] : null;
  const navActionGroup = appointmentWrapper ? layout[appointmentWrapper.parent] : null;
  const menuButton = navActionGroup?.nodes
    ?.map((nodeId) => layout[nodeId])
    .find((node) => node?.props?.responsiveDisplay === 'show-tablet-down-only');
  const menuGlyph = menuButton ? layout[menuButton.nodes[0]] : null;
  assert.equal(navActionGroup?.props?.gap, '12px');
  assert.equal(appointmentWrapper?.props?.responsiveDisplay, 'hide-mobile');
  assert.equal(menuButton?.props?.width, '44px');
  assert.equal(menuButton?.props?.minHeight, '44px');
  assert.equal(menuButton?.props?.borderRadius, '14px');
  assert.equal(menuButton?.props?.backgroundColor, '#151820');
  assert.equal(menuGlyph?.props?.width, '14px');
  assert.equal(menuGlyph?.props?.minHeight, '14px');
  assert.equal(menuGlyph?.props?.borderWidth, '2px');
  assert.equal(menuGlyph?.props?.borderColor, '#b1b4c8');
  const careBrandText = Object.values(layout)
    .find((node) => node?.type?.resolvedName === 'Text' && node.props?.text === 'Aureline');
  const careBrand = careBrandText ? layout[careBrandText.parent] : null;
  const careMark = careBrand ? layout[careBrand.nodes[0]] : null;
  const careMarkText = careMark ? layout[careMark.nodes[0]] : null;
  assert.equal(careBrand?.props?.width, '150px');
  assert.equal(careBrand?.props?.gap, '8px');
  assert.equal(careMark?.props?.width, '30px');
  assert.equal(careMark?.props?.minHeight, '24px');
  assert.equal(careMark?.props?.borderRadius, '0px');
  assert.equal(careMark?.props?.backgroundColor, 'transparent');
  assert.equal(careMarkText?.props?.text, 'A');
  assert.equal(careMarkText?.props?.fontSize, '24px');
  assert.equal(careMarkText?.props?.textColor, '#ffd0a8');
  const userFacingValues = Object.values(layout)
    .flatMap((node) => [node?.props?.text, node?.props?.label, node?.props?.content])
    .filter((value) => typeof value === 'string');
  assert.equal(userFacingValues.includes('Careglo'), false);
  assert.equal(userFacingValues.includes('Detailing That Defines True Luxury.'), false);
  assert.equal(userFacingValues.includes('Book Detailing Now'), false);
  assertUserFacingNodePropsAreOriginal(layout);

  const legacyContractPath = path.join(directory, 'legacy-contract.json');
  const legacyLayoutPath = path.join(directory, 'legacy-layout-draft.json');
  const legacyContract = contract();
  const legacyContainer = legacyContract.components.find((component) => component.name === 'Container');
  const legacyResponsiveControl = legacyContainer?.controls?.find((control) => control.props?.includes('responsiveDisplay'));
  legacyResponsiveControl.options = ['', 'hide-mobile', 'hide-tablet-down'];
  fs.writeFileSync(legacyContractPath, JSON.stringify(legacyContract));

  const legacyResult = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    legacyContractPath,
    '--brief-json',
    briefPath,
    '--out',
    legacyLayoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(legacyResult.status, 0, legacyResult.stderr);
  const legacyLayout = JSON.parse(fs.readFileSync(legacyLayoutPath, 'utf8'));
  assert.equal(Object.values(legacyLayout).some((node) => node?.props?.responsiveDisplay === 'show-tablet-down-only'), false);
});

test('draft layout keeps Optomatta split-hero fallback geometry outside the strict marketplace gate', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-optomatta-real-reference-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'optomatta-optical-retail',
      referenceStyle: 'optomatta-optical-retail',
    },
    text: {
      h1: ['Secure clearer vision with precision eyewear.'],
      h2: ['Qualified doctors, emergency care, and service'],
      h3: ['Eye exams', 'Frame fitting', 'Lens care'],
      ctas: ['Shop frames', 'Ask optometrist'],
      stats: ['28 doctors', '24h service', '4.9 rating'],
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#ffffff',
        '--panel': '#f4f6f9',
        '--ink': '#090d13',
        '--muted': '#5f6670',
        '--accent': '#0788d8',
        '--button-bg': '#0788d8',
        '--button-fg': '#ffffff',
        '--max': '1300px',
        '--hero-min': '739px',
      },
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const navSection = layout[layout.ROOT.nodes[0]];
  const heroSection = layout[layout.ROOT.nodes[1]];
  const heroWrap = layout[heroSection.nodes[0]];
  const heroHeading = Object.values(layout)
    .find((node) => node?.props?.text === 'Clear vision, thoughtfully fitted');
  const copy = layout[heroHeading?.parent];
  const heroMedia = heroWrap.nodes
    .map((nodeId) => layout[nodeId])
    .find((node) => typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.includes('6749748'));

  assert.equal(report.ok, true);
  assert.equal(report.audit.ok, true);
  assert.equal(navSection.props.innerMaxWidth, '1440px');
  assert.equal(navSection.props.innerPaddingX, '10px');
  assert.equal(heroSection.props.innerMaxWidth, '1440px');
  assert.equal(heroSection.props.innerPaddingX, '0px');
  assert.equal(Object.hasOwn(heroSection.props, 'backgroundImage'), false);
  assert.equal(heroSection.props.minHeight, '704px');
  assert.equal(heroWrap.props.minHeight, '704px');
  assert.equal(copy.props.flexBasis, '50%');
  assert.equal(copy.props.maxWidth, '50%');
  assert.equal(copy.props.maxWidthMobile, '100%');
  assert.equal(copy.props.paddingTop, '132px');
  assert.equal(copy.props.paddingLeft, '120px');
  assert.equal(copy.props.paddingLeftMobile, '20px');
  assert.equal(copy.props.paddingRightMobile, '20px');
  assert.match(copy.props.backgroundImage, /1574258495973/);
  assert.equal(copy.props.backgroundOverlay, 'rgba(255, 255, 255, 0.78)');
  assert.equal(heroMedia?.props?.minHeight, '704px');
  assert.equal(heroHeading?.props?.fontSize, '75px');
  assert.equal(heroHeading?.props?.fontSizeMobile, '42px');
  assert.equal(JSON.stringify(layout).includes('Secure clearer vision with precision eyewear.'), false);
});

test('draft layout uses an Optomatta composite hero asset when provided', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-optomatta-composite-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const compositeUrl = 'https://cdn.example.test/monteby-optomatta-hero-composite-v1.png';
  const brief = visualBrief({
    target: {
      variant: 'marketplace-service',
      archetype: 'optomatta-optical-retail',
      referenceStyle: 'optomatta-optical-retail',
    },
    visualSignals: {
      rootVariables: {
        '--bg': '#ffffff',
        '--panel': '#f4f6f9',
        '--ink': '#090d13',
        '--accent': '#0788d8',
        '--hero-min': '739px',
      },
    },
  });
  const manifest = {
    ...referenceManifest(brief),
    sourceUrl: 'https://kits.moxcreative.com/optomatta/template-kit/homepage/?storefront=envato-elements',
    screenshots: [
      { label: 'desktop', file: 'reference-desktop.png' },
      { label: 'tablet', file: 'reference-tablet.png' },
      { label: 'mobile', file: 'reference-mobile.png' },
    ],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--require-real-reference',
    '--require-marketplace-media',
    '--json',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL: compositeUrl,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const heroSection = layout[layout.ROOT.nodes[1]];
  const heroWrap = layout[heroSection.nodes[0]];
  const heroHeading = Object.values(layout)
    .find((node) => node?.props?.text === 'Clear vision, thoughtfully fitted');
  const copy = layout[heroHeading?.parent];

  assert.equal(report.ok, true);
  assert.equal(report.audit.ok, true);
  assert.equal(heroSection.props.backgroundImage, compositeUrl);
  assert.equal(heroSection.props.innerMaxWidth, '1240px');
  assert.equal(heroSection.props.innerPaddingX, '20px');
  assert.equal(heroWrap.props.responsiveStack, 'tablet');
  assert.equal(copy.props.flexBasis, '566px');
  assert.equal(copy.props.paddingLeft, '0px');
  assert.equal(Object.hasOwn(copy.props, 'backgroundImage'), false);
  assert.equal(heroWrap.nodes.some((nodeId) => {
    const node = layout[nodeId];
    return typeof node?.props?.backgroundImage === 'string' && node.props.backgroundImage.includes('6749748');
  }), false);
});

test('draft layout refuses unsafe CSS functions in captured geometry variables', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-unsafe-geometry-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const brief = visualBrief({
    visualSignals: {
      rootVariables: {
        '--max': 'calc(100vw - 40px)',
        '--radius': 'var(--radius)',
        '--hero-min': 'expression(alert(1))',
        '--visual-min': 'clamp(320px, 40vw, 620px)',
      },
    },
  });

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layoutJson = fs.readFileSync(layoutPath, 'utf8');

  assert.equal(report.ok, true);
  assert.equal(report.stats.innerMaxWidth, '1260px');
  assert.equal(report.stats.heroMinHeight, '680px');
  assert.equal(report.stats.visualMinHeight, '540px');
  assert.doesNotMatch(layoutJson, /calc\(100vw - 40px\)/);
  assert.doesNotMatch(layoutJson, /var\(--radius\)/);
  assert.doesNotMatch(layoutJson, /expression\(alert\(1\)\)/);
  assert.doesNotMatch(layoutJson, /clamp\(320px, 40vw, 620px\)/);
});

test('draft layout ignores sentence-like extracted stats in hero proof cards', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-stat-filter-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const brief = visualBrief({
    target: {
      archetype: 'luxury-car-care',
      referenceStyle: 'careglo-dark-service',
    },
    text: {
      stats: [
        'Reserve a detail bay in under three minutes. Book detailing now 4.9/5 Average finish score across recent appointments.',
        '4.9 rating',
        '24h response',
      ],
    },
  });

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const layoutJson = fs.readFileSync(layoutPath, 'utf8');

  assert.equal(report.ok, true);
  assert.equal(report.stats.heroProofCards >= 2, true);
  assert.match(layoutJson, /"text": "4\.9"/);
  assert.doesNotMatch(layoutJson, /"text": "Reserve",/);
});

test('draft layout fails when self-audit cannot satisfy required photo roles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-layout-audit-fail-'));
  const contractPath = path.join(directory, 'contract.json');
  const startReportPath = path.join(directory, 'benchmark-start-report.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'target-manifest.json');
  const strictManifest = {
    ...referenceManifest(),
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'service-card', minSurfaces: 18, placement: 'afterHero' },
    ],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(startReportPath, JSON.stringify({ visualBrief: visualBrief() }));
  fs.writeFileSync(manifestPath, JSON.stringify(strictManifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--start-report',
    startReportPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.audit.ok, false);
  assert.equal(report.audit.stats.satisfiedMediaRoles, 2);
  assert.equal(report.audit.errors.some((error) => error.code === 'missing_media_role'), true);
});

test('draft layout preserves seven ordered generic measured bands with responsive depth and contract props', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-measured-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const contractValue = contract();
  const sectionComponent = contractValue.components.find((component) => component.name === 'Section');
  sectionComponent.props = sectionComponent.props.map((prop) => prop === 'backgroundColor' ? 'background' : prop);
  sectionComponent.aiProps = sectionComponent.aiProps.map((prop) => prop === 'backgroundColor' ? 'background' : prop);
  const bandTags = ['header', 'section', 'section', 'section', 'section', 'section', 'footer'];
  const bandColors = [
    'rgb(248, 249, 246)',
    'rgb(230, 239, 233)',
    'rgb(255, 255, 255)',
    'rgb(27, 35, 43)',
    'rgb(241, 235, 225)',
    'rgb(237, 243, 248)',
    'rgb(20, 27, 34)',
  ];
  const desktopHeights = [90, 720, 480, 620, 360, 540, 260];
  const tabletHeights = [80, 620, 520, 680, 420, 600, 300];
  const mobileHeights = [72, 760, 680, 740, 520, 720, 360];
  const layouts = [
    ['desktop', 1440, 1200, desktopHeights, [1, 2, 3, 2, 3, 3, 1]],
    ['tablet', 834, 1112, tabletHeights, [1, 1, 2, 2, 2, 2, 1]],
    ['mobile', 390, 844, mobileHeights, [1, 1, 1, 1, 1, 1, 1]],
  ];

  for (const [label, width, height, bandHeights, columns] of layouts) {
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const measuredLayout = genericMeasuredLayout({
      label,
      width,
      height,
      bandHeights,
      bandTags,
      bandColors,
      columns,
    });
    measuredLayout.landmarks[1].paddingLeft = '0px';
    measuredLayout.landmarks[1].paddingRight = '0px';
    const footerIndex = bandHeights.length - 1;
    const footerTop = bandHeights.slice(0, footerIndex).reduce((sum, bandHeight) => sum + bandHeight, 0);
    const footerGutter = label === 'desktop' ? 160 : 20;
    const footerWidth = width - footerGutter * 2;
    const footerLandmark = measuredLayout.landmarks.find((landmark) => (
      landmark.tag === bandTags[footerIndex]
      && landmark.rect.top === footerTop
      && landmark.rect.height === bandHeights[footerIndex]
    ));
    footerLandmark.rect = measuredRect(footerGutter, footerTop, footerWidth, bandHeights[footerIndex]);
    for (const textBox of measuredLayout.textBoxes.filter((box) => box.rect.top >= footerTop)) {
      textBox.rect = measuredRect(footerGutter, textBox.rect.top, footerWidth, textBox.rect.height);
    }
    const childBandIndex = 3;
    const childBandTop = bandHeights.slice(0, childBandIndex).reduce((sum, bandHeight) => sum + bandHeight, 0);
    const childBandBottom = childBandTop + bandHeights[childBandIndex];
    const bandKey = `0.${childBandIndex}`;
    const childBandLandmark = measuredLayout.landmarks.find((landmark) => (
      landmark.tag === bandTags[childBandIndex]
      && landmark.rect.top === childBandTop
      && landmark.rect.height === bandHeights[childBandIndex]
    ));
    childBandLandmark.groupKey = bandKey;
    childBandLandmark.display = 'grid';
    childBandLandmark.gap = label === 'mobile' ? '20px' : '24px';
    measuredLayout.layoutGroups = [{
      key: bandKey,
      parentKey: '',
      tag: bandTags[childBandIndex],
      rect: childBandLandmark.rect,
      display: 'grid',
      gap: childBandLandmark.gap,
      backgroundColor: bandColors[childBandIndex],
    }];
    measuredLayout.landmarks.push({
      tag: 'section',
      groupKey: `${bandKey}.nested`,
      rect: measuredRect(label === 'mobile' ? 20 : label === 'tablet' ? 36 : 72, childBandTop + 24, Math.max(260, width * 0.5), 180),
      backgroundColor: 'oklch(0.5 0 none / none)',
      display: 'block',
    });
    measuredLayout.textBoxes = measuredLayout.textBoxes.filter((box) => {
      const centerY = box.rect.top + box.rect.height / 2;
      return centerY < childBandTop || centerY > childBandBottom;
    });
    const childInset = label === 'mobile' ? 20 : label === 'tablet' ? 36 : 72;
    const childGap = label === 'mobile' ? 18 : 24;
    const childWidth = label === 'mobile'
      ? width - childInset * 2
      : (width - childInset * 2 - childGap) / 2;
    measuredLayout.textBoxes.push({
      parentGroupKey: bandKey,
      structureKey: `${bandKey}.0`,
      tag: 'span',
      text: 'Measured Band Label',
      rect: measuredRect(childInset, childBandTop, 180.45, 18),
      fontSize: '14px',
      fontWeight: '700',
      fontFamily: 'Untrusted Source Sans',
      lineHeight: 'normal',
      letterSpacing: label === 'mobile' ? '0.98px' : '1.12px',
      lines: [{ text: 'Measured Band Label', rect: measuredRect(childInset, childBandTop, 180.45, 17) }],
    });
    const childTop = childBandTop + 40;
    for (let childIndex = 0; childIndex < 2; childIndex += 1) {
      const left = label === 'mobile' ? childInset : childInset + childIndex * (childWidth + childGap);
      const top = label === 'mobile' ? childTop + childIndex * 200 : childTop;
      const childHeading = childIndex === 0 ? 'Measured Child Alpha' : 'Measured Child Beta';
      const childAccent = childIndex === 0 ? 'Alpha' : 'Beta';
      measuredLayout.landmarks.push({
        tag: 'article',
        rect: measuredRect(left, top, childWidth, 180),
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '20px',
        paddingTop: '20px',
        paddingRight: '20px',
        paddingBottom: '20px',
        paddingLeft: '20px',
      });
      const groupKey = `${bandKey}.${childIndex + 1}`;
      measuredLayout.layoutGroups.push({
        key: groupKey,
        parentKey: bandKey,
        tag: 'article',
        rect: measuredRect(left, top, childWidth, 180),
        display: 'flex',
        flexDirection: label === 'desktop' ? 'row' : 'column',
        flexWrap: label === 'desktop' ? 'wrap' : 'nowrap',
        justifyContent: label === 'desktop' ? 'center' : 'flex-start',
        alignItems: label === 'desktop' ? 'center' : 'flex-start',
        gap: '12px',
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '20px',
        paddingTop: '20px',
        paddingRight: '20px',
        paddingBottom: '20px',
        paddingLeft: '20px',
        ...(childIndex === 0 ? {
          sticky: label === 'desktop',
          stickyTop: label === 'desktop' ? '24px' : '',
        } : {}),
      });
      measuredLayout.textBoxes.push({
        parentGroupKey: groupKey,
        structureKey: `${groupKey}.0`,
        tag: 'h3',
        text: childHeading,
        rect: measuredRect(left + 20, top + 28, childWidth - 40, 34),
        fontSize: label === 'mobile' ? '24px' : '28px',
        fontWeight: '700',
        fontFamily: 'Untrusted Source Sans',
      });
      measuredLayout.textBoxes.push({
        parentGroupKey: groupKey,
        structureKey: `${groupKey}.0.0`,
        tag: 'span',
        text: childAccent,
        rect: measuredRect(left + 20, top + 28, 72, 34),
        fontSize: label === 'mobile' ? '24px' : '28px',
        fontWeight: '700',
        fontFamily: 'Untrusted Source Sans',
      });
      measuredLayout.textBoxes.push({
        parentGroupKey: groupKey,
        structureKey: `${groupKey}.1`,
        tag: 'span',
        text: 'BI',
        rect: measuredRect(left + 20, top + 82, 20, 18),
        fontSize: '14px',
        fontWeight: '600',
        fontFamily: 'Untrusted Source Sans',
      });
    }
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }

  const brief = {
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generated-target',
        family: 'lumen-eye-care-editorial',
        familyMechanics: true,
        source: 'generated-html',
      },
    },
  };
  const manifest = {
    sourceUrl: 'file:///tmp/unknown-seven-band-page.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const sections = layout.ROOT.nodes.map((nodeId) => layout[nodeId]);

  assert.equal(report.ok, true);
  assert.equal(report.stats.authoringMode, 'generic-measured-reference');
  assert.equal(report.stats.qualityLabel, 'generic_geometry_scaffold');
  assert.equal(report.stats.familyMechanicsClaimed, false);
  assert.equal(report.stats.measuredBandCount, 7);
  assert.equal(report.stats.measuredDesktopDepth, desktopHeights.reduce((sum, height) => sum + height, 0));
  assert.deepEqual(report.stats.measuredViewportLabels, ['desktop', 'tablet', 'mobile']);
  assert.match(report.warnings.join(' '), /geometry scaffold only/i);
  assert.equal(sections.length, 7);
  assert.deepEqual(sections.map((section) => section.props.tag), bandTags);
  assert.deepEqual(sections.slice(0, -1).map((section) => section.props.background), bandColors.slice(0, -1));
  assert.equal(sections.at(-1).props.background, undefined);
  assert.equal(layout[sections.at(-1).nodes[0]].props.backgroundColor, bandColors.at(-1));
  assert.equal(sections.every((section) => Object.prototype.hasOwnProperty.call(section.props, 'backgroundColor') === false), true);
  assert.deepEqual(sections.map((section) => section.props.minHeight), desktopHeights.map((height) => `${height}px`));
  assert.deepEqual(sections.map((section) => section.props.minHeightTablet), tabletHeights.map((height) => `${height}px`));
  assert.deepEqual(sections.map((section) => section.props.minHeightMobile), mobileHeights.map((height) => `${height}px`));
  const firstMeasuredFrame = layout[sections[0].nodes[0]];
  assert.equal(firstMeasuredFrame.props.paddingLeft, '0px');
  assert.equal(firstMeasuredFrame.props.paddingRight, '0px');
  assert.equal(sections.reduce((sum, section) => sum + Number.parseInt(section.props.minHeight, 10), 0), 3070);
  assert.equal(sections.every((section) => maximumDescendantDepth(layout, section) >= 3), true);
  assert.equal(sections.slice(0, -1).every((section) => section.props.innerPaddingX === '0px'), true);
  assert.equal(sections.at(-1).props.innerPaddingX, '20px');
  assert.equal(sections.at(-1).props.innerMaxWidth, '1160px');
  const measuredChildrenWrap = layout[sections[3].nodes[0]];
  assert.equal(measuredChildrenWrap.props.gap, '24px');
  assert.equal(measuredChildrenWrap.props.gapTablet, '24px');
  assert.equal(measuredChildrenWrap.props.gapMobile, '20px');
  assert.equal(measuredChildrenWrap.props.paddingTop, '0px');
  assert.equal(measuredChildrenWrap.props.paddingTopTablet, '0px');
  assert.equal(measuredChildrenWrap.props.paddingTopMobile, '0px');
  assert.equal(measuredChildrenWrap.props.paddingLeft, '72px');
  assert.equal(measuredChildrenWrap.props.paddingLeftTablet, '36px');
  assert.equal(measuredChildrenWrap.props.paddingLeftMobile, '20px');
  assert.equal(measuredChildrenWrap.props.paddingRight, '72px');
  assert.equal(measuredChildrenWrap.props.paddingRightTablet, '36px');
  assert.equal(measuredChildrenWrap.props.paddingRightMobile, '20px');

  const grids = Object.values(layout).filter((node) => node?.type?.resolvedName === 'Container' && node.props.layoutDisplay === 'grid');
  assert.equal(grids.some((node) => node.props.gridTemplateColumns === 'two'
    && node.props.gridTemplateColumnsTablet === 'one'
    && node.props.gridTemplateColumnsMobile === 'one'), true);
  assert.equal(grids.some((node) => node.props.gridTemplateColumns === 'six'
    && node.props.gridTemplateColumnsTablet === 'two'
    && node.props.gridTemplateColumnsMobile === 'one'), true);
  assert.equal(grids.every((node) => node.props.responsiveStack === undefined), true);

  const allowedPropsByComponent = new Map(contractValue.components.map((component) => [component.name, new Set(component.aiProps)]));
  const blockedProps = new Set(['className', 'cssId', 'customAttributes', 'motion', 'rawHtml', 'html', 'customCss', 'style']);
  for (const [nodeId, node] of Object.entries(layout)) {
    if (nodeId === 'ROOT') {
      continue;
    }
    const allowed = allowedPropsByComponent.get(node.type.resolvedName);
    assert.notEqual(allowed, undefined, node.type.resolvedName);
    for (const propName of Object.keys(node.props)) {
      assert.equal(allowed.has(propName), true, `${nodeId}.${propName} must come from the live contract`);
      assert.equal(blockedProps.has(propName), false, `${nodeId}.${propName} is blocked`);
      assert.doesNotMatch(propName, /^on[A-Z]/, `${nodeId}.${propName} must not be an event handler`);
    }
  }
  const layoutJson = JSON.stringify(layout);
  assert.doesNotMatch(layoutJson, /captured\.example\.test|Unknown Source Heading|className|rawHtml|Careglo|Maidy|Optomatta|Lumen/i);
  assert.equal(Object.values(layout).some((node) => Object.prototype.hasOwnProperty.call(node?.props || {}, 'boxShadow')), false);
  assert.match(layoutJson, /generic-band-2-media-1/);
  const compactTextWrappers = Object.values(layout).filter((node) => (
    node?.type?.resolvedName === 'Container'
    && node.props.maxWidth === '20px'
    && node.nodes.length === 1
  ));
  assert.equal(compactTextWrappers.length, 2);
  assert.equal(compactTextWrappers.every((wrapper) => {
    const text = String(layout[wrapper.nodes[0]]?.props?.text || '');
    return text.length <= 2 && text !== 'BI';
  }), true);
  assertUserFacingNodePropsAreOriginal(layout);

  const preservedLayoutPath = path.join(directory, 'layout-preserved-text.json');
  const preservedResult = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    preservedLayoutPath,
    '--reference-manifest',
    manifestPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(preservedResult.status, 0, preservedResult.stderr || preservedResult.stdout);
  const preservedLayout = JSON.parse(fs.readFileSync(preservedLayoutPath, 'utf8'));
  assert.equal(preservedLayout.ROOT.nodes.length, 7);
  assert.match(JSON.stringify(preservedLayout), /Unknown Source Heading 2\.1/);
  const alphaNodes = Object.values(preservedLayout).filter((node) => node?.props?.text === 'Measured Child Alpha');
  const betaNodes = Object.values(preservedLayout).filter((node) => node?.props?.text === 'Measured Child Beta');
  const labelNodes = Object.values(preservedLayout).filter((node) => node?.props?.text === 'Measured Band Label');
  assert.equal(alphaNodes.length, 1);
  assert.equal(betaNodes.length, 1);
  assert.equal(Object.values(preservedLayout).some((node) => node?.props?.text === 'Alpha'), false);
  assert.equal(Object.values(preservedLayout).some((node) => node?.props?.text === 'Beta'), false);
  assert.equal(labelNodes.length, 1);
  assert.notEqual(alphaNodes[0].parent, betaNodes[0].parent);
  assert.equal(preservedLayout[alphaNodes[0].parent]?.props?.paddingLeft, undefined);
  const alphaGroup = preservedLayout[preservedLayout[alphaNodes[0].parent]?.parent];
  assert.equal(alphaGroup?.props?.layoutDisplay, 'flex');
  assert.equal(alphaGroup?.props?.flexDirection, 'row');
  assert.equal(alphaGroup?.props?.flexDirectionTablet, 'column');
  assert.equal(alphaGroup?.props?.flexDirectionMobile, 'column');
  assert.equal(alphaGroup?.props?.flexWrap, 'wrap');
  assert.equal(alphaGroup?.props?.flexWrapTablet, 'nowrap');
  assert.equal(alphaGroup?.props?.justifyContent, 'center');
  assert.equal(alphaGroup?.props?.justifyContentTablet, 'flex-start');
  assert.equal(alphaGroup?.props?.alignItems, 'center');
  assert.equal(alphaGroup?.props?.alignItemsTablet, 'flex-start');
  assert.equal(alphaGroup?.props?.sticky, true);
  assert.equal(alphaGroup?.props?.stickyTop, '24px');
  assert.equal(alphaGroup?.props?.stickyResetAt, 'tablet');
  assert.equal(alphaGroup?.props?.responsiveStack, undefined);
  assert.equal(alphaGroup?.props?.paddingLeft, '20px');
  const preservedMeasuredSection = preservedLayout[preservedLayout.ROOT.nodes[3]];
  const preservedMeasuredFrame = preservedLayout[preservedMeasuredSection.nodes[0]];
  assert.equal(preservedLayout[labelNodes[0].parent]?.props?.gridRowStart, 1);
  assert.equal(alphaGroup?.props?.gridRowStart, 2);
  assert.equal(preservedMeasuredFrame.nodes[0], labelNodes[0].parent);
  assert.equal(preservedLayout[labelNodes[0].parent]?.props?.maxWidth, '180.45px');
  assert.equal(labelNodes[0].props.lineHeight, '17px');
  assert.equal(labelNodes[0].props.letterSpacing, '1.12px');
  assert.equal(labelNodes[0].props.letterSpacingTablet, undefined);
  assert.equal(labelNodes[0].props.letterSpacingMobile, '0.98px');
  assert.doesNotMatch(JSON.stringify(preservedLayout), /captured\.example\.test|className|rawHtml/);
});

test('generic measured drafting keeps solid and image band paint inside measured bounds at every viewport', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-painted-band-height-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const imageSource = 'https://source.example.test/painted-band.jpg';
  const viewports = [
    { label: 'desktop', width: 1440, height: 900, heights: [180, 220, 300, 240], gaps: [70, 40, 90], frameInset: 110, frameContentInset: 72 },
    { label: 'tablet', width: 834, height: 820, heights: [150, 200, 260, 220], gaps: [54, 32, 72], frameInset: 20, frameContentInset: 72 },
    { label: 'mobile', width: 390, height: 720, heights: [120, 180, 220, 200], gaps: [36, 24, 48], frameInset: 20, frameContentInset: 32 },
  ];

  for (const viewport of viewports) {
    const file = viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`;
    const measuredLayout = genericMeasuredLayout({
      label: viewport.label,
      width: viewport.width,
      height: viewport.height,
      bandHeights: viewport.heights,
      bandTags: ['section', 'section', 'section', 'section'],
      bandColors: ['rgb(32, 55, 64)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgb(255, 221, 103)'],
      columns: [1, 1, 1, 1],
    });
    const sourceTops = viewport.heights.map((_, index) => (
      viewport.heights.slice(0, index).reduce((sum, height) => sum + height, 0)
    ));
    const measuredTops = viewport.heights.map((_, index) => (
      sourceTops[index] + viewport.gaps.slice(0, index).reduce((sum, gap) => sum + gap, 0)
    ));
    const pageHeight = measuredTops.at(-1) + viewport.heights.at(-1);
    const bandLandmarks = measuredLayout.landmarks.slice(1);

    for (let index = 0; index < bandLandmarks.length; index += 1) {
      const horizontalInset = index === 3 ? viewport.frameInset : 0;
      bandLandmarks[index].groupKey = `0.${index}`;
      bandLandmarks[index].rect = measuredRect(
        horizontalInset,
        measuredTops[index],
        viewport.width - horizontalInset * 2,
        viewport.heights[index]
      );
      bandLandmarks[index].paintedBackground = index === 0 || index === 2 || index === 3;
    }
    measuredLayout.landmarks[0].rect = measuredRect(0, 0, viewport.width, pageHeight);
    for (const textBox of measuredLayout.textBoxes) {
      const sourceTop = textBox.rect.top;
      const bandIndex = sourceTops.findIndex((top, index) => (
        sourceTop >= top && sourceTop < top + viewport.heights[index]
      ));
      const top = sourceTop + measuredTops[bandIndex] - sourceTops[bandIndex];
      const left = bandIndex === 3
        ? viewport.frameInset + viewport.frameContentInset
        : textBox.rect.left;
      const width = bandIndex === 3
        ? viewport.width - viewport.frameInset * 2 - viewport.frameContentInset * 2
        : textBox.rect.width;
      textBox.rect = measuredRect(left, top, width, textBox.rect.height);
      textBox.firstViewportArea = top < viewport.height
        ? textBox.rect.width * Math.min(textBox.rect.height, viewport.height - top)
        : 0;
    }
    const imageRect = measuredRect(0, measuredTops[2], viewport.width, viewport.heights[2]);
    const imageBackground = {
      tag: 'div',
      source: imageSource,
      backgroundImage: imageSource,
      structureKey: '0.2.background',
      rect: imageRect,
      firstViewportArea: imageRect.top < viewport.height
        ? imageRect.width * Math.min(imageRect.height, viewport.height - imageRect.top)
        : 0,
      backgroundSize: 'cover',
      backgroundPosition: '50% 50%',
    };
    measuredLayout.mediaBoxes = [imageBackground];
    measuredLayout.meaningfulMediaBoxes = [imageBackground];
    measuredLayout.viewport.scrollHeight = pageHeight;
    measuredLayout.summary.firstViewportMediaBoxes = imageBackground.firstViewportArea > 0 ? 1 : 0;
    measuredLayout.summary.firstViewportMediaCoverage = imageBackground.firstViewportArea / (viewport.width * viewport.height);
    measuredLayout.summary.largestMediaArea = imageRect.width * imageRect.height;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generic-measured-reference',
        family: '',
        familyMechanics: false,
        source: 'captured-reference-layout',
      },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/painted-band-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map((viewport) => ({
      label: viewport.label,
      file: viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const sections = layout.ROOT.nodes.map((nodeId) => layout[nodeId]);

  assert.equal(sections.length, 4);
  assert.deepEqual(
    [sections[0].props.minHeight, sections[0].props.minHeightTablet, sections[0].props.minHeightMobile],
    ['180px', '150px', '120px']
  );
  assert.deepEqual(
    [sections[1].props.paddingTop, sections[1].props.paddingTopTablet, sections[1].props.paddingTopMobile],
    ['70px', '54px', '36px']
  );
  assert.deepEqual(
    [sections[1].props.minHeight, sections[1].props.minHeightTablet, sections[1].props.minHeightMobile],
    ['330px', '286px', '240px']
  );
  assert.deepEqual(
    [sections[2].props.minHeight, sections[2].props.minHeightTablet, sections[2].props.minHeightMobile],
    ['300px', '260px', '220px']
  );
  assert.match(sections[2].props.backgroundImage, /generic-band-3-background/u);
  assert.deepEqual(
    [sections[3].props.paddingTop, sections[3].props.paddingTopTablet, sections[3].props.paddingTopMobile],
    ['90px', '72px', '48px']
  );
  assert.deepEqual(
    [sections[3].props.minHeight, sections[3].props.minHeightTablet, sections[3].props.minHeightMobile],
    ['330px', '292px', '248px']
  );
  assert.equal(sections[3].props.innerMaxWidth, '1260px');
  assert.deepEqual(
    [sections[3].props.innerPaddingX, sections[3].props.innerPaddingXTablet, sections[3].props.innerPaddingXMobile],
    ['20px', '20px', '20px']
  );
  const constrainedPaintedFrame = layout[sections[3].nodes[0]];
  assert.equal(constrainedPaintedFrame.props.paddingLeft, '72px');
  assert.equal(constrainedPaintedFrame.props.paddingLeft, constrainedPaintedFrame.props.paddingRight);
  assert.equal(constrainedPaintedFrame.props.paddingLeftTablet, constrainedPaintedFrame.props.paddingRightTablet);
  assert.equal(constrainedPaintedFrame.props.paddingLeftMobile, constrainedPaintedFrame.props.paddingRightMobile);
  assert.equal(sections.reduce((sum, section) => sum + Number.parseInt(section.props.minHeight, 10), 0), 1140);
  assert.equal(sections.reduce((sum, section) => sum + Number.parseInt(section.props.minHeightTablet, 10), 0), 988);
  assert.equal(sections.reduce((sum, section) => sum + Number.parseInt(section.props.minHeightMobile, 10), 0), 828);
  assert.doesNotMatch(JSON.stringify(layout), /source\.example\.test|className|rawHtml/iu);
});

test('generic measured drafting preserves explicit rows when a card spans two grid tracks', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-spanning-grid-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const viewports = [
    ['desktop', 1440, 900, 110, 306.8],
    ['tablet', 834, 1112, 20, 387],
    ['mobile', 390, 844, 20, 350],
  ];

  for (const [label, width, height, inset, cardWidth] of viewports) {
    const mobile = label === 'mobile';
    const gap = 20;
    const groupTop = 120;
    const cardHeights = mobile ? [250, 434, 250] : [250, 520, 250];
    const cardRects = mobile
      ? [
        measuredRect(inset, groupTop, cardWidth, cardHeights[0]),
        measuredRect(inset, groupTop + cardHeights[0] + gap, cardWidth, cardHeights[1]),
        measuredRect(inset, groupTop + cardHeights[0] + gap + cardHeights[1] + gap, cardWidth, cardHeights[2]),
      ]
      : [
        measuredRect(inset, groupTop, cardWidth, cardHeights[0]),
        measuredRect(inset + cardWidth + gap, groupTop, cardWidth, cardHeights[1]),
        measuredRect(inset, groupTop + cardHeights[0] + gap, cardWidth, cardHeights[2]),
      ];
    const groupWidth = mobile ? cardWidth : cardWidth * 2 + gap;
    const groupHeight = mobile
      ? cardHeights.reduce((sum, cardHeight) => sum + cardHeight, 0) + gap * 2
      : 520;
    const textBoxes = ['Top card', 'Spanning card', 'Bottom card'].map((text, index) => ({
      tag: 'h3',
      text,
      structureKey: `0.0.${index}.0`,
      parentGroupKey: `0.0.${index}`,
      rect: measuredRect(cardRects[index].left + 32, cardRects[index].top + 32, cardRects[index].width - 64, 34),
      fontSize: '28px',
      fontWeight: '700',
      lineHeight: '34px',
      color: index === 1 ? 'rgb(255, 255, 255)' : 'rgb(6, 7, 8)',
    }));
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;

    fs.writeFileSync(path.join(directory, file), JSON.stringify({
      label,
      viewport: { width, height, scrollWidth: width, scrollHeight: groupTop + groupHeight + 120 },
      documentStyle: { backgroundColor: 'rgb(247, 247, 244)', color: 'rgb(6, 7, 8)' },
      landmarks: [{
        tag: 'section',
        groupKey: '0',
        rect: measuredRect(0, 0, width, groupTop + groupHeight + 120),
        display: 'block',
        backgroundColor: 'rgb(247, 247, 244)',
      }],
      layoutGroups: [
        {
          key: '0.0',
          parentKey: '0',
          tag: 'div',
          rect: measuredRect(inset, groupTop, groupWidth, groupHeight),
          display: 'grid',
          gap: `${gap}px`,
          rowGap: `${gap}px`,
          columnGap: `${gap}px`,
        },
        ...cardRects.map((rect, index) => ({
          key: `0.0.${index}`,
          parentKey: '0.0',
          tag: 'article',
          rect,
          display: 'block',
          backgroundColor: index === 1 ? 'rgb(49, 95, 79)' : 'rgb(255, 255, 255)',
          borderRadius: '26px',
          paddingTop: '32px',
          paddingRight: '32px',
          paddingBottom: '32px',
          paddingLeft: '32px',
          paintedBackground: true,
        })),
      ],
      textBoxes,
      interactions: [],
      mediaBoxes: [],
      meaningfulMediaBoxes: [],
      summary: {
        firstViewportTextBoxes: textBoxes.filter((box) => box.rect.top < height).length,
        firstViewportMediaBoxes: 0,
        firstViewportMediaCoverage: 0,
      },
    }));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: { variant: 'staggered-card-grid', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      preserveSourceText: true,
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-spanning-grid.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(([label]) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--reference-manifest', manifestPath,
    '--out', layoutPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const cardByHeading = new Map(Object.values(layout)
    .filter((node) => ['Top card', 'Spanning card', 'Bottom card'].includes(node?.props?.text))
    .map((node) => [node.props.text, layout[layout[node.parent].parent]]));
  const topCard = cardByHeading.get('Top card');
  const spanningCard = cardByHeading.get('Spanning card');
  const bottomCard = cardByHeading.get('Bottom card');

  assert.notEqual(topCard, undefined);
  assert.notEqual(spanningCard, undefined);
  assert.notEqual(bottomCard, undefined);
  const cardGrid = layout[topCard.parent];
  assert.equal(cardGrid.props.gridTemplateColumns, 'two');
  assert.equal(cardGrid.props.gridTemplateColumnsTablet, 'two');
  assert.equal(cardGrid.props.gridTemplateColumnsMobile, 'one');
  assert.deepEqual(
    [
      topCard.props.gridColumnStart,
      spanningCard.props.gridColumnStart,
      bottomCard.props.gridColumnStart,
      topCard.props.gridColumnSpan,
      spanningCard.props.gridColumnSpan,
      bottomCard.props.gridColumnSpan,
    ],
    [1, 2, 1, 1, 1, 1]
  );
  assert.deepEqual(
    [
      topCard.props.gridColumnStartTablet,
      spanningCard.props.gridColumnStartTablet,
      bottomCard.props.gridColumnStartTablet,
      topCard.props.gridColumnSpanTablet,
      spanningCard.props.gridColumnSpanTablet,
      bottomCard.props.gridColumnSpanTablet,
    ],
    [1, 2, 1, 1, 1, 1]
  );
  assert.deepEqual(
    [topCard.props.gridColumnStartMobile, spanningCard.props.gridColumnStartMobile, bottomCard.props.gridColumnStartMobile],
    [1, 1, 1]
  );
  assert.deepEqual(
    [topCard.props.gridRowStart, topCard.props.gridRowSpan],
    [1, 1]
  );
  assert.deepEqual(
    [spanningCard.props.gridRowStart, spanningCard.props.gridRowSpan],
    [1, 2]
  );
  assert.deepEqual(
    [bottomCard.props.gridRowStart, bottomCard.props.gridRowSpan],
    [2, 1]
  );
  assert.deepEqual(
    [topCard.props.gridRowStartTablet, topCard.props.gridRowSpanTablet],
    [1, 1]
  );
  assert.deepEqual(
    [spanningCard.props.gridRowStartTablet, spanningCard.props.gridRowSpanTablet],
    [1, 2]
  );
  assert.deepEqual(
    [bottomCard.props.gridRowStartTablet, bottomCard.props.gridRowSpanTablet],
    [2, 1]
  );
  assert.deepEqual(
    [topCard.props.gridRowStartMobile, spanningCard.props.gridRowStartMobile, bottomCard.props.gridRowStartMobile],
    [1, 2, 3]
  );
  assert.deepEqual(
    [topCard.props.gridRowSpanMobile, spanningCard.props.gridRowSpanMobile, bottomCard.props.gridRowSpanMobile],
    [1, 1, 1]
  );
});

test('generic measured drafting keeps keyed bands aligned when a middle band is hidden on mobile', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-keyed-responsive-bands-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const viewportBands = {
    desktop: [
      ['0.0', 'nav', 0, 100, 'Navigation'],
      ['0.1', 'section', 100, 360, 'Measured hero'],
      ['0.2', 'footer', 460, 180, 'Measured footer'],
    ],
    tablet: [
      ['0.0', 'nav', 0, 80, 'Navigation'],
      ['0.1', 'section', 80, 320, 'Measured hero'],
      ['0.2', 'footer', 400, 160, 'Measured footer'],
    ],
    mobile: [
      ['0.0', 'nav', 0, 72, 'Navigation'],
      ['0.2', 'footer', 72, 140, 'Measured footer'],
    ],
  };
  const viewportWidths = { desktop: 1440, tablet: 834, mobile: 390 };
  const viewportHeights = { desktop: 900, tablet: 1112, mobile: 844 };

  for (const label of ['desktop', 'tablet', 'mobile']) {
    const width = viewportWidths[label];
    const bands = viewportBands[label];
    const scrollHeight = bands.at(-1)[2] + bands.at(-1)[3];
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const textBoxes = bands.map(([key, tag, top, height, text], index) => ({
      tag: tag === 'section' ? 'h1' : 'span',
      text,
      structureKey: `${key}.0`,
      parentGroupKey: key,
      rect: measuredRect(20, top + Math.max(12, height * 0.2), width - 40, Math.min(72, height * 0.4)),
      fontSize: tag === 'section' ? '48px' : '16px',
      fontWeight: tag === 'section' ? '800' : '600',
      color: 'rgb(20, 35, 29)',
      order: index,
    }));
    fs.writeFileSync(path.join(directory, file), JSON.stringify({
      label,
      viewport: { width, height: viewportHeights[label], scrollWidth: width, scrollHeight },
      documentStyle: { backgroundColor: 'rgb(247, 247, 244)', color: 'rgb(20, 35, 29)' },
      landmarks: bands.map(([key, tag, top, height]) => ({
        tag,
        groupKey: key,
        rect: measuredRect(0, top, width, height),
        backgroundColor: key === '0.1' ? 'rgb(255, 221, 103)' : 'rgb(247, 247, 244)',
        display: 'block',
      })),
      layoutGroups: [],
      textBoxes,
      mediaBoxes: [],
      meaningfulMediaBoxes: [],
      summary: {
        firstViewportTextBoxes: textBoxes.length,
        firstViewportMediaBoxes: 0,
        firstViewportMediaCoverage: 0,
        largestMediaArea: 0,
      },
    }));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      preserveSourceText: true,
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/keyed-responsive-bands.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--reference-manifest', manifestPath,
    '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const sections = layout.ROOT.nodes.map((nodeId) => layout[nodeId]);

  assert.equal(sections.length, 3);
  assert.equal(sections[1].props.responsiveDisplay, 'hide-mobile');
  assert.equal(sections[1].props.minHeightMobile, '320px');
  assert.equal(sections[2].props.responsiveDisplay, undefined);
  assert.equal(sections[2].props.minHeightTablet, '160px');
  assert.equal(sections[2].props.minHeightMobile, '140px');
  assert.equal(Object.values(layout).some((node) => node?.props?.text === 'Measured footer'), true);
});

test('generic measured drafting recognizes a multi-field form as one contract-backed FormBlock', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-form-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const viewports = [
    ['desktop', 1440, 900, 600, 700, true],
    ['tablet', 834, 900, 72, 690, true],
    ['mobile', 390, 844, 20, 350, false],
  ];

  for (const [label, width, height, formLeft, formWidth, twoColumns] of viewports) {
    const formTop = 60;
    const formHeight = 620;
    const padding = 24;
    const gap = 20;
    const fieldWidth = twoColumns ? (formWidth - padding * 2 - gap) / 2 : formWidth - padding * 2;
    const fullWidth = formWidth - padding * 2;
    const firstRowTop = formTop + padding + 22;
    const secondRowTop = firstRowTop + (twoColumns ? 82 : 164);
    const messageTop = secondRowTop + 82;
    const checkboxTop = messageTop + 142;
    const submitTop = checkboxTop + 54;
    const firstFieldLeft = formLeft + padding;
    const secondFieldLeft = twoColumns ? firstFieldLeft + fieldWidth + gap : firstFieldLeft;
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const controlStyle = {
      backgroundColor: 'rgb(255, 255, 255)',
      color: 'oklch(0.5 0 none)',
      fontSize: '16px',
      fontWeight: '400',
      fontFamily: 'Arial, sans-serif',
      borderTopColor: 'oklch(0.88 0.01 260)',
      borderTopWidth: '2px',
      borderRadius: '8px',
      paddingTop: '12px',
      paddingRight: '16px',
      paddingBottom: '12px',
      paddingLeft: '16px',
    };
    const interactions = [
      { order: 0, tag: 'input', role: 'textbox', type: 'text', required: true, rect: measuredRect(firstFieldLeft, firstRowTop, fieldWidth, 50), structureKey: '0.0.0.0.0', parentGroupKey: '0.0.0.0', ...controlStyle },
      { order: 1, tag: 'input', role: 'textbox', type: 'email', required: true, rect: measuredRect(secondFieldLeft, twoColumns ? firstRowTop : firstRowTop + 82, fieldWidth, 50), structureKey: '0.0.0.1.0', parentGroupKey: '0.0.0.1', ...controlStyle },
      { order: 2, tag: 'input', role: 'textbox', type: 'text', required: false, rect: measuredRect(firstFieldLeft, secondRowTop, fullWidth, 50), structureKey: '0.0.1.0', parentGroupKey: '0.0', ...controlStyle },
      { order: 3, tag: 'textarea', role: 'textbox', required: true, rect: measuredRect(firstFieldLeft, messageTop, fullWidth, 120), structureKey: '0.0.2.0', parentGroupKey: '0.0', ...controlStyle },
      { order: 4, tag: 'input', role: 'checkbox', type: 'checkbox', required: true, rect: measuredRect(firstFieldLeft, checkboxTop, 16, 16), structureKey: '0.0.3.0', parentGroupKey: '0.0', ...controlStyle },
      { order: 5, tag: 'button', role: 'button', type: 'submit', required: false, rect: measuredRect(firstFieldLeft, submitTop, 220, 48), structureKey: '0.0.4', parentGroupKey: '0.0', backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)', fontSize: '14px', fontWeight: '600', borderTopColor: 'rgb(37, 99, 235)', borderTopWidth: '0px', borderRadius: '6px', paddingTop: '12px', paddingLeft: '24px' },
    ];
    fs.writeFileSync(path.join(directory, file), JSON.stringify({
      viewport: { width, height, scrollHeight: 720 },
      documentStyle: { backgroundColor: 'rgb(248, 250, 252)', color: 'rgb(17, 24, 39)' },
      landmarks: [{ tag: 'section', groupKey: '0', rect: measuredRect(0, 0, width, 720), backgroundColor: 'rgb(248, 250, 252)', display: 'block' }],
      layoutGroups: [
        { key: '0', parentKey: '', tag: 'section', rect: measuredRect(0, 0, width, 720), display: 'block', backgroundColor: 'rgb(248, 250, 252)' },
        { key: '0.0', parentKey: '0', tag: 'form', rect: measuredRect(formLeft, formTop, formWidth, formHeight), display: 'grid', gap: '20px', backgroundColor: 'rgb(255, 255, 255)', borderRadius: '12px' },
        { key: '0.0.0', parentKey: '0.0', tag: 'div', rect: measuredRect(firstFieldLeft, formTop + padding, fullWidth, twoColumns ? 72 : 154), display: 'grid', gap: '20px' },
        { key: '0.0.0.0', parentKey: '0.0.0', tag: 'div', rect: measuredRect(firstFieldLeft, formTop + padding, fieldWidth, 72), display: 'block' },
        { key: '0.0.0.1', parentKey: '0.0.0', tag: 'div', rect: measuredRect(secondFieldLeft, twoColumns ? formTop + padding : formTop + padding + 82, fieldWidth, 72), display: 'block' },
      ],
      textBoxes: [{
        tag: 'button', text: 'SEND PRIVATE SOURCE DATA', structureKey: '0.0.4', parentGroupKey: '0.0',
        rect: measuredRect(firstFieldLeft, submitTop, 220, 48), fontSize: '14px', fontWeight: '600',
        color: 'rgb(255, 255, 255)', backgroundColor: 'rgb(37, 99, 235)', borderRadius: '6px',
      }],
      interactions,
      mediaBoxes: [],
      meaningfulMediaBoxes: [],
      summary: { firstViewportTextBoxes: 1, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
    }));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/form-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const forms = Object.values(layout).filter((node) => node?.type?.resolvedName === 'FormBlock');
  assert.equal(forms.length, 1);
  assert.equal(forms[0].props.formColumns, 2);
  assert.equal(forms[0].props.fields.length, 5);
  assert.deepEqual(forms[0].props.fields.map((field) => field.type), ['text', 'email', 'text', 'textarea', 'checkbox']);
  assert.deepEqual(forms[0].props.fields.map((field) => field.columnSpan), [1, 1, 2, 2, 2]);
  assert.equal(forms[0].props.formGap, '20px');
  assert.equal(forms[0].props.formPaddingX, '24px');
  assert.equal(forms[0].props.formPaddingY, '24px');
  assert.equal(forms[0].props.inputHeight, '50px');
  assert.equal(forms[0].props.inputBorderWidth, 'border-2');
  assert.equal(forms[0].props.inputBorderRadius, 'rounded-lg');
  assert.equal(forms[0].props.inputColor, 'rgb(99, 99, 99)');
  assert.equal(forms[0].props.inputBgColor, 'rgb(255, 255, 255)');
  assert.notEqual(forms[0].props.inputBgColor, 'rgb(99, 99, 99)');
  assert.equal(forms[0].props.inputBorderColor, 'rgb(212, 216, 222)');
  assert.equal(forms[0].props.buttonBackgroundColor, 'rgb(37, 99, 235)');
  assert.notEqual(forms[0].props.submitLabel, 'SEND PRIVATE SOURCE DATA');
  assert.doesNotMatch(JSON.stringify(layout), /SEND PRIVATE SOURCE DATA|className|rawHtml/i);

  const subsetContract = contract();
  const subsetForm = subsetContract.components.find((component) => component.name === 'FormBlock');
  const subsetFieldsControl = subsetForm.controls.find((control) => control.props.includes('fields'));
  const subsetTypeControl = subsetFieldsControl.itemControls.find((control) => control.props.includes('type'));
  subsetTypeControl.options = ['text', 'email'];
  const subsetContractPath = path.join(directory, 'contract-field-subset.json');
  fs.writeFileSync(subsetContractPath, JSON.stringify(subsetContract));
  const subsetResult = spawnSync(process.execPath, [
    draftScript, '--contract', subsetContractPath, '--brief-json', briefPath, '--out', path.join(directory, 'layout-field-subset.json'),
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(subsetResult.status, 1, subsetResult.stdout);
  assert.match(subsetResult.stderr, /generic_semantic_form_field_type_unsupported/);
  assert.match(subsetResult.stderr, /textarea, checkbox/);

  for (const [label] of viewports) {
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const measuredLayout = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    measuredLayout.interactions = measuredLayout.interactions.slice(0, 2).map((interaction, index) => ({
      ...interaction,
      type: index === 0 ? 'password' : 'date',
    })).concat(measuredLayout.interactions.at(-1));
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }
  const unsupportedLayoutPath = path.join(directory, 'layout-unsupported-fields.json');
  const unsupportedResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', unsupportedLayoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(unsupportedResult.status, 1, unsupportedResult.stdout);
  assert.match(unsupportedResult.stderr, /generic_semantic_form_field_type_unsupported/);
  assert.match(unsupportedResult.stderr, /password, date/);

  for (const [label] of viewports) {
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const measuredLayout = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    measuredLayout.interactions[0].type = 'text';
    measuredLayout.interactions[1].type = 'email';
    measuredLayout.interactions.at(-1).type = 'button';
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }
  const nonSubmitLayoutPath = path.join(directory, 'layout-non-submit-button.json');
  const nonSubmitResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', nonSubmitLayoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(nonSubmitResult.status, 0, nonSubmitResult.stderr || nonSubmitResult.stdout);
  const nonSubmitLayout = JSON.parse(fs.readFileSync(nonSubmitLayoutPath, 'utf8'));
  assert.equal(Object.values(nonSubmitLayout).some((node) => node?.type?.resolvedName === 'FormBlock'), false);
});

test('generic measured drafting recognizes generated program tabs as one editable TabsBlock', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-tabs-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const tabs = [
    ['Doors open', 'Arrive before the first note.', 'Settle in, meet the room, and find a place close to the sound.', 'https://images.example.test/doors.jpg'],
    ['Listening room', 'Close sound, low light, no rush.', 'A focused live set shaped for a small audience.', 'https://images.example.test/listening.jpg'],
    ['Chef table', 'Seasonal plates between sets.', 'Share a generous menu made for the whole table.', 'https://images.example.test/table.jpg'],
    ['Courtyard set', 'Music under the late sky.', 'The evening moves outdoors for a brighter set.', 'https://images.example.test/courtyard.jpg'],
    ['Night archive', 'Stay for the final reel.', 'Rare recordings and projected photographs close the night.', 'https://images.example.test/archive.jpg'],
  ].map(([label, title, content, image], index) => {
    const time = ['18:00', '19:15', '20:30', '22:00', '23:30'][index];
    return {
      labelPrefix: String(index + 1).padStart(2, '0'),
      label,
      labelSuffix: time,
      eyebrow: `${time} · Hall ${String.fromCharCode(65 + index)}`,
      title,
      content,
      image,
      imageAlt: `${label} photograph`,
      ctaLabel: 'Reserve this part',
      ctaUrl: '#reserve',
    };
  });
  const viewportDefinitions = [
    ['desktop', 1440, 900],
    ['tablet', 834, 900],
    ['mobile', 390, 844],
  ];

  for (const [label, width, height] of viewportDefinitions) {
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(tabbedMeasuredLayout({ label, width, height })));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: {
        variant: 'tabbed-program',
        archetype: 'venue-program-tabs',
        referenceStyle: '',
        referenceClassification: { kind: 'generated-target', family: '', familyMechanics: false },
        interactionPattern: {
          type: 'tabs',
          itemCount: 5,
          defaultActiveTab: 2,
          orientation: 'vertical',
          mobileTabLayout: 'scroll',
        },
        tabs,
      },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      preserveSourceText: true,
      reuseSourceMedia: true,
      referenceClassification: { kind: 'generated-target', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-tabbed-program.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewportDefinitions.map(([label]) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const tabsNodes = Object.values(layout).filter((node) => node?.type?.resolvedName === 'TabsBlock');
  assert.equal(tabsNodes.length, 1);
  assert.equal(tabsNodes[0].props.tabs.length, 5);
  assert.deepEqual(tabsNodes[0].props.tabs.map((tab) => tab.label), tabs.map((tab) => tab.label));
  assert.equal(tabsNodes[0].props.tabs[2].content, tabs[2].content);
  assert.equal(tabsNodes[0].props.tabs[2].image, tabs[2].image);
  assert.equal(tabsNodes[0].props.tabs[2].imageAlt, tabs[2].imageAlt);
  assert.equal(tabsNodes[0].props.tabs[2].labelPrefix, tabs[2].labelPrefix);
  assert.equal(tabsNodes[0].props.tabs[2].labelSuffix, tabs[2].labelSuffix);
  assert.equal(tabsNodes[0].props.tabs[2].eyebrow, tabs[2].eyebrow);
  assert.equal(tabsNodes[0].props.tabs[2].title, tabs[2].title);
  assert.equal(tabsNodes[0].props.tabs[2].ctaLabel, tabs[2].ctaLabel);
  assert.equal(tabsNodes[0].props.tabs[2].ctaUrl, tabs[2].ctaUrl);
  assert.equal(tabsNodes[0].props.defaultActiveTab, 2);
  assert.equal(tabsNodes[0].props.orientation, 'vertical');
  assert.equal(tabsNodes[0].props.mobileTabLayout, 'scroll');
  assert.equal(tabsNodes[0].props.tabBarWidth, '230px');
  assert.equal(tabsNodes[0].props.tabBarWidthTablet, '190px');
  assert.equal(tabsNodes[0].props.tabBarWidthMobile, '100%');
  assert.equal(tabsNodes[0].props.tabWidth, '100%');
  assert.equal(tabsNodes[0].props.tabWidthTablet, '100%');
  assert.equal(tabsNodes[0].props.tabWidthMobile, '174px');
  assert.equal(tabsNodes[0].props.tabMinHeight, '78px');
  assert.equal(tabsNodes[0].props.tabMinHeightTablet, '78px');
  assert.equal(tabsNodes[0].props.tabMinHeightMobile, '68px');
  assert.equal(tabsNodes[0].props.tabFontSize, '14px');
  assert.equal(tabsNodes[0].props.tabFontSizeTablet, '14px');
  assert.equal(tabsNodes[0].props.tabFontSizeMobile, '14px');
  assert.equal(tabsNodes[0].props.tabActiveBackgroundColor, 'rgb(24, 63, 52)');
  assert.equal(tabsNodes[0].props.tabMetaFontSize, '11px');
  assert.equal(tabsNodes[0].props.tabMetaFontWeight, '400');
  assert.equal(tabsNodes[0].props.tabMetaGap, '8px');
  assert.equal(tabsNodes[0].props.panelBackgroundColor, 'rgb(24, 63, 52)');
  assert.equal(tabsNodes[0].props.panelEyebrowColor, 'rgb(204, 233, 92)');
  assert.equal(tabsNodes[0].props.panelEyebrowFontWeight, '900');
  assert.equal(tabsNodes[0].props.panelEyebrowLineHeight, '15px');
  assert.equal(tabsNodes[0].props.panelEyebrowLineHeightTablet, '15px');
  assert.equal(tabsNodes[0].props.panelEyebrowLineHeightMobile, '15px');
  assert.equal(tabsNodes[0].props.panelCtaBackgroundColor, 'rgb(255, 101, 77)');
  assert.equal(tabsNodes[0].props.panelCtaFontWeight, '800');
  assert.equal(tabsNodes[0].props.panelCtaMinHeight, '46px');
  assert.equal(tabsNodes[0].props.panelCtaMarginTop, '34px');
  assert.equal(tabsNodes[0].props.panelPaddingTablet, '22px');
  assert.equal(tabsNodes[0].props.panelPaddingMobile, '14px');
  assert.equal(tabsNodes[0].props.panelContentPaddingTop, '34px');
  assert.equal(tabsNodes[0].props.panelContentPaddingTopTablet, '24px');
  assert.equal(tabsNodes[0].props.panelContentPaddingTopMobile, '22px');
  assert.equal(tabsNodes[0].props.panelContentPaddingX, '20px');
  assert.equal(tabsNodes[0].props.panelContentPaddingXTablet, '18px');
  assert.equal(tabsNodes[0].props.panelContentPaddingXMobile, '10px');
  assert.equal(tabsNodes[0].props.panelContentPaddingBottom, '0px');
  assert.equal(tabsNodes[0].props.panelContentPaddingBottomTablet, '0px');
  assert.equal(tabsNodes[0].props.panelContentPaddingBottomMobile, '12px');
  assert.equal(tabsNodes[0].props.panelTitleFontSizeTablet, '42px');
  assert.equal(tabsNodes[0].props.panelTitleFontSizeMobile, '44px');
  assert.equal(tabsNodes[0].props.panelImageHeightTablet, '280px');
  assert.equal(tabsNodes[0].props.panelImageHeightMobile, '330px');
  assert.equal(tabsNodes[0].props.panelStackAt, 'tablet');
  assert.equal(tabsNodes[0].props.panelImagePosition, 'right');
  assert.equal(tabsNodes[0].props.panelImageWidth, '57.4%');
  assert.equal(tabsNodes[0].props.panelImageObjectPositionX, '50%');
  assert.equal(tabsNodes[0].props.panelImageObjectPositionY, '38%');
  assert.equal(tabsNodes[0].props.panelImageObjectPositionXTablet, '50%');
  assert.equal(tabsNodes[0].props.panelImageObjectPositionYTablet, '30%');
  assert.equal(tabsNodes[0].props.panelImageObjectPositionXMobile, '68%');
  assert.equal(tabsNodes[0].props.panelImageObjectPositionYMobile, '24%');
  assert.equal(tabsNodes[0].props.panelImageBorderRadius, '16px');
  let tabsSection = layout[tabsNodes[0].parent];
  while (tabsSection?.type?.resolvedName !== 'Section') {
    tabsSection = layout[tabsSection?.parent];
  }
  assert.equal(tabsSection.props.innerPaddingX, '12px');
  assert.equal(tabsSection.props.innerPaddingXTablet, '20px');
  assert.equal(tabsSection.props.innerPaddingXMobile, '12px');
  assert.equal(Object.values(layout).filter((node) => node?.type?.resolvedName === 'ButtonBlock').length, 0);
  assert.doesNotMatch(JSON.stringify(layout), /className|rawHtml|rawCss|onClick/i);

  const externalBriefPath = path.join(directory, 'visual-brief-external.json');
  const externalLayoutPath = path.join(directory, 'layout-external.json');
  fs.writeFileSync(externalBriefPath, JSON.stringify({
    ...visualBrief({
      target: {
        variant: 'captured-reference',
        archetype: '',
        referenceStyle: '',
        referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
      },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      preserveSourceText: false,
      reuseSourceMedia: false,
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  const externalResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', externalBriefPath, '--out', externalLayoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(externalResult.status, 0, externalResult.stderr || externalResult.stdout);
  const externalLayout = JSON.parse(fs.readFileSync(externalLayoutPath, 'utf8'));
  const externalTabs = Object.values(externalLayout).find((node) => node?.type?.resolvedName === 'TabsBlock');
  assert.equal(externalTabs.props.tabs.length, 5);
  assert.equal(externalTabs.props.tabs[0].labelPrefix, '01');
  assert.equal(externalTabs.props.tabs[1].labelSuffix, '19:00');
  assert.notEqual(externalTabs.props.tabs[2].label, 'Chef table');
  assert.notEqual(externalTabs.props.tabs[2].eyebrow, '20:30 · Hall C');
  assert.equal(externalTabs.props.tabs[2].ctaUrl, '#');
  assert.ok(externalTabs.props.tabs[2].ctaLabel);

  const missingTabsContract = contract();
  missingTabsContract.components = missingTabsContract.components.filter((component) => component.name !== 'TabsBlock');
  const missingContractPath = path.join(directory, 'contract-without-tabs.json');
  fs.writeFileSync(missingContractPath, JSON.stringify(missingTabsContract));
  const missingResult = spawnSync(process.execPath, [
    draftScript, '--contract', missingContractPath, '--brief-json', briefPath,
    '--out', path.join(directory, 'layout-without-tabs.json'), '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingResult.status, 1, missingResult.stdout);
  assert.match(missingResult.stderr, /generic_semantic_tabs_widget_missing/);

  const missingStackContract = contract();
  const missingStackTabs = missingStackContract.components.find((component) => component.name === 'TabsBlock');
  missingStackTabs.props = missingStackTabs.props.filter((prop) => prop !== 'panelStackAt');
  missingStackTabs.aiProps = missingStackTabs.aiProps.filter((prop) => prop !== 'panelStackAt');
  missingStackTabs.controls = missingStackTabs.controls.filter((control) => !control.props.includes('panelStackAt'));
  const missingStackContractPath = path.join(directory, 'contract-without-tablet-panel-stack.json');
  fs.writeFileSync(missingStackContractPath, JSON.stringify(missingStackContract));
  const missingStackResult = spawnSync(process.execPath, [
    draftScript, '--contract', missingStackContractPath, '--brief-json', briefPath,
    '--out', path.join(directory, 'layout-without-tablet-panel-stack.json'), '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingStackResult.status, 1, missingStackResult.stdout);
  assert.match(missingStackResult.stderr, /generic_semantic_tabs_control_missing/);
  assert.match(missingStackResult.stderr, /panelStackAt/);

  const missingResponsiveContract = contract();
  const missingResponsiveTabs = missingResponsiveContract.components.find((component) => component.name === 'TabsBlock');
  missingResponsiveTabs.props = missingResponsiveTabs.props.filter((prop) => prop !== 'panelContentPaddingXTablet');
  missingResponsiveTabs.aiProps = missingResponsiveTabs.aiProps.filter((prop) => prop !== 'panelContentPaddingXTablet');
  const missingResponsiveContractPath = path.join(directory, 'contract-without-tablet-content-padding.json');
  fs.writeFileSync(missingResponsiveContractPath, JSON.stringify(missingResponsiveContract));
  const missingResponsiveResult = spawnSync(process.execPath, [
    draftScript, '--contract', missingResponsiveContractPath, '--brief-json', briefPath,
    '--out', path.join(directory, 'layout-without-tablet-content-padding.json'), '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingResponsiveResult.status, 1, missingResponsiveResult.stdout);
  assert.match(missingResponsiveResult.stderr, /generic_semantic_tabs_control_missing/);
  assert.match(missingResponsiveResult.stderr, /panelContentPaddingXTablet/);
});

test('generic measured drafting maps overlay navigation to Navbar without changing measured page depth', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-navbar-'));
  const contractPath = path.join(directory, 'contract.json');
  const contractWithoutResponsivePaddingPath = path.join(directory, 'contract-without-responsive-navbar-padding.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const layoutWithoutTriggerPath = path.join(directory, 'layout-without-menu-trigger.json');
  const layoutWithoutResponsivePaddingPath = path.join(directory, 'layout-without-responsive-navbar-padding.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const viewports = [
    ['desktop', 1440, 900, 92, 120, true],
    ['tablet', 834, 900, 68, 42, false],
    ['mobile', 390, 844, 64, 20, false],
  ];

  for (const [label, width, height, navHeight, inset, showMenu] of viewports) {
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const brandWidth = showMenu ? 240 : 150;
    const ctaWidth = showMenu ? 180 : label === 'mobile' ? 44 : 120;
    const navTextBoxes = [
      { tag: 'span', text: 'PRIVATE SOURCE BRAND', structureKey: '0.0.1', parentGroupKey: '0.0', rect: measuredRect(inset + 56, 20, brandWidth - 56, 40), fontSize: label === 'mobile' ? '13px' : label === 'tablet' ? '15px' : '16px', fontWeight: '700', color: 'rgb(255, 255, 255)', backgroundColor: 'rgba(0, 0, 0, 0)' },
    ];
    if (showMenu) {
      navTextBoxes.push(
        { tag: 'button', text: 'SOURCE SERVICES', structureKey: '0.1.0', parentGroupKey: '0.1', rect: measuredRect(420, 36, 110, 20), fontSize: '14px', fontWeight: '500', color: 'rgb(226, 232, 240)', backgroundColor: 'rgba(0, 0, 0, 0)' },
        { tag: 'button', text: 'SOURCE PROCESS', structureKey: '0.1.1', parentGroupKey: '0.1', rect: measuredRect(562, 36, 104, 20), fontSize: '14px', fontWeight: '500', color: 'rgb(226, 232, 240)', backgroundColor: 'rgba(0, 0, 0, 0)' },
        { tag: 'button', text: 'SOURCE CONTACT', structureKey: '0.1.2', parentGroupKey: '0.1', rect: measuredRect(698, 36, 106, 20), fontSize: '14px', fontWeight: '500', color: 'rgb(226, 232, 240)', backgroundColor: 'rgba(0, 0, 0, 0)' },
        { tag: 'button', text: 'SOURCE APPOINTMENT', structureKey: '0.1.3', parentGroupKey: '0.1', rect: measuredRect(width - inset - ctaWidth, 16, ctaWidth, 60), fontSize: '14px', fontWeight: '600', color: 'rgb(15, 23, 42)', backgroundColor: 'rgb(250, 204, 21)', borderRadius: '8px' },
      );
    } else if (label === 'mobile') {
      navTextBoxes.push({
        tag: 'a', text: 'SOURCE APPOINTMENT', structureKey: '0.1.3', parentGroupKey: '0.1',
        rect: measuredRect(width - inset - ctaWidth - 56, 18, ctaWidth, 44), fontSize: '0px',
        fontWeight: '600', color: 'rgb(15, 23, 42)', backgroundColor: 'rgb(250, 204, 21)', borderRadius: '8px',
      });
    }
    fs.writeFileSync(path.join(directory, file), JSON.stringify({
      viewport: { width, height, scrollHeight: 700 },
      documentStyle: { backgroundColor: 'rgb(15, 23, 42)', color: 'rgb(255, 255, 255)' },
      landmarks: [
        { tag: 'nav', groupKey: '0', rect: measuredRect(0, 0, width, navHeight), backgroundColor: 'rgba(15, 23, 42, 0.82)', flowParticipation: 'overlay', display: 'block' },
        { tag: 'section', groupKey: '1', rect: measuredRect(0, 0, width, 700), backgroundColor: 'rgb(15, 23, 42)', display: 'flex' },
      ],
      layoutGroups: [
        { key: '0.0', parentKey: '0', tag: 'div', rect: measuredRect(inset, 18, brandWidth, 44), display: 'flex', alignItems: 'center', gap: '12px' },
        { key: '0.0.0', parentKey: '0.0', tag: 'span', rect: measuredRect(inset, 18, 44, 44), display: 'block', backgroundColor: 'rgba(0, 0, 0, 0)', paintedBackground: true, borderRadius: '12px' },
        { key: '1', parentKey: '', tag: 'section', rect: measuredRect(0, 0, width, 700), display: 'flex', alignItems: 'center', backgroundColor: 'rgb(15, 23, 42)' },
        { key: '1.0', parentKey: '1', tag: 'div', rect: measuredRect(inset, 220, width - inset * 2, 260), display: 'flex', flexDirection: 'column', gap: '18px' },
      ],
      textBoxes: navTextBoxes.concat([{
        tag: 'h1', text: 'PRIVATE SOURCE HERO', structureKey: '1.0.0', parentGroupKey: '1.0',
        rect: measuredRect(inset, 260, Math.min(620, width - inset * 2), 96), fontSize: label === 'mobile' ? '42px' : '64px',
        fontWeight: '700', color: 'rgb(255, 255, 255)', backgroundColor: 'rgba(0, 0, 0, 0)',
      }, {
        tag: 'span', text: 'OVERLAPPING SOURCE HERO', structureKey: '1.0.1', parentGroupKey: '1.0',
        rect: measuredRect(inset + brandWidth + 12, 24, 210, 30), fontSize: '18px', fontWeight: '700',
        color: 'rgb(255, 255, 255)', backgroundColor: 'rgba(0, 0, 0, 0)',
      }]),
      interactions: [{
        tag: 'button', role: 'button', type: 'button', structureKey: '1.0.2', parentGroupKey: '1.0',
        rect: measuredRect(width - inset - 160, 18, 160, 52), backgroundColor: 'rgb(239, 68, 68)',
      }, ...(!showMenu ? [{
        tag: 'button', role: 'button', type: 'button', structureKey: '0.2', parentGroupKey: '0',
        rect: measuredRect(width - inset - 44, 18, 44, 44), backgroundColor: 'rgba(0, 0, 0, 0)',
        state: { expanded: false, selected: null, checked: null, open: null, disabled: false },
      }] : [])],
      mediaBoxes: [],
      meaningfulMediaBoxes: [],
      summary: { firstViewportTextBoxes: navTextBoxes.length + 1, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
    }));
  }

  const contractValue = contract();
  const navbarComponent = contractValue.components.find((component) => component.name === 'Navbar');
  navbarComponent.props.push('innerPaddingYTablet', 'innerPaddingYMobile');
  navbarComponent.aiProps.push('innerPaddingYTablet', 'innerPaddingYMobile');
  navbarComponent.controls.push({
    type: 'css-value',
    props: ['innerPaddingY', 'innerPaddingYTablet', 'innerPaddingYMobile'],
    units: ['px', 'rem', 'em'],
  });
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/navbar-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const navbar = Object.values(layout).find((node) => node?.type?.resolvedName === 'Navbar');
  assert.notEqual(navbar, undefined);
  assert.equal(navbar.props.logoText, 'Northline');
  assert.equal(navbar.props.showLogoMark, true);
  assert.equal(navbar.props.logoMarkSize, 44);
  assert.equal(navbar.props.logoMarkBorderRadius, '12px');
  assert.equal(navbar.props.menuItems.length, 3);
  assert.doesNotMatch(JSON.stringify(navbar.props), /OVERLAPPING SOURCE HERO/);
  assert.equal(navbar.props.mobileMenuBehavior, 'drawer');
  assert.equal(navbar.props.mobileMenuBreakpoint, 'tablet');
  assert.equal(navbar.props.innerPaddingY, '16px');
  assert.equal(navbar.props.innerPaddingYTablet, '12px');
  assert.equal(navbar.props.innerPaddingYMobile, '10px');
  assert.equal(navbar.props.logoFontSize, '16px');
  assert.equal(navbar.props.logoFontSizeTablet, '15px');
  assert.equal(navbar.props.logoFontSizeMobile, '13px');
  assert.equal(navbar.props.ctaContentMode, 'label');
  assert.equal(navbar.props.ctaContentModeTablet, 'hidden');
  assert.equal(navbar.props.ctaContentModeMobile, 'icon');
  assert.equal(navbar.props.ctaIcon, 'arrow_forward');
  assert.equal(navbar.props.ctaCompactSize, '44px');
  assert.notEqual(navbar.props.ctaLabel, 'SOURCE APPOINTMENT');
  assert.equal(Object.values(layout).filter((node) => node?.type?.resolvedName === 'ButtonBlock').length, 0);
  const navigationHost = layout[navbar.parent];
  assert.equal(navigationHost.props.minHeight, '92px');
  assert.equal(navigationHost.props.minHeightTablet, '68px');
  assert.equal(navigationHost.props.minHeightMobile, '64px');
  assert.equal(navigationHost.props.paddingLeft, '120px');
  assert.equal(navigationHost.props.paddingLeftTablet, '42px');
  assert.equal(navigationHost.props.paddingLeftMobile, '20px');
  const section = layout[layout.ROOT.nodes[0]];
  const frame = layout[section.nodes.find((nodeId) => nodeId !== navbar.parent)];
  assert.equal(section.props.minHeight, '700px');
  assert.equal(frame.props.minHeight, '608px');
  assert.equal(frame.props.minHeightTablet, '632px');
  assert.equal(frame.props.minHeightMobile, '636px');
  assert.doesNotMatch(JSON.stringify(layout), /PRIVATE SOURCE|SOURCE SERVICES|SOURCE PROCESS|SOURCE CONTACT|SOURCE APPOINTMENT|className|rawHtml/i);

  for (const label of ['tablet', 'mobile']) {
    const referencePath = path.join(directory, `reference-layout-${label}.json`);
    const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
    reference.interactions = reference.interactions.filter((interaction) => interaction.parentGroupKey !== '0');
    fs.writeFileSync(referencePath, JSON.stringify(reference));
  }
  const resultWithoutTrigger = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutWithoutTriggerPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(resultWithoutTrigger.status, 0, resultWithoutTrigger.stderr || resultWithoutTrigger.stdout);
  const layoutWithoutTrigger = JSON.parse(fs.readFileSync(layoutWithoutTriggerPath, 'utf8'));
  const navbarWithoutTrigger = Object.values(layoutWithoutTrigger)
    .find((node) => node?.type?.resolvedName === 'Navbar');
  assert.equal(navbarWithoutTrigger.props.mobileMenuBehavior, 'hide-links');
  assert.equal(navbarWithoutTrigger.props.showLogoMark, true);
  assert.equal(navbarWithoutTrigger.props.logoMarkSize, 44);
  assert.equal(navbarWithoutTrigger.props.logoMarkBorderRadius, '12px');

  fs.writeFileSync(contractWithoutResponsivePaddingPath, JSON.stringify(contract()));
  const resultWithoutResponsivePadding = spawnSync(process.execPath, [
    draftScript, '--contract', contractWithoutResponsivePaddingPath, '--brief-json', briefPath,
    '--out', layoutWithoutResponsivePaddingPath, '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(resultWithoutResponsivePadding.status, 0, resultWithoutResponsivePadding.stderr || resultWithoutResponsivePadding.stdout);
  const layoutWithoutResponsivePadding = JSON.parse(fs.readFileSync(layoutWithoutResponsivePaddingPath, 'utf8'));
  const navbarWithoutResponsivePadding = Object.values(layoutWithoutResponsivePadding)
    .find((node) => node?.type?.resolvedName === 'Navbar');
  assert.equal(navbarWithoutResponsivePadding.props.innerPaddingYTablet, undefined);
  assert.equal(navbarWithoutResponsivePadding.props.innerPaddingYMobile, undefined);
});

test('generic measured drafting maps a normal-flow top navigation to one standalone Navbar section', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-flow-navbar-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const referenceLayoutPath = path.join(directory, 'reference-layout.json');
  const viewportWidth = 1200;
  const navigationRect = measuredRect(40, 20, 1120, 80);

  fs.writeFileSync(referenceLayoutPath, JSON.stringify({
    viewport: { width: viewportWidth, height: 800, scrollHeight: 700 },
    documentStyle: { backgroundColor: 'rgb(248, 250, 252)', color: 'rgb(15, 23, 42)' },
    landmarks: [
      {
        tag: 'nav', groupKey: '0', rect: navigationRect, flowParticipation: 'normal', display: 'flex',
        alignItems: 'center', backgroundColor: 'rgb(248, 250, 252)',
      },
      {
        tag: 'section', groupKey: '1', rect: measuredRect(0, 100, viewportWidth, 600),
        flowParticipation: 'normal', display: 'flex', backgroundColor: 'rgb(255, 255, 255)',
      },
    ],
    layoutGroups: [
      {
        key: '0', parentKey: '', tag: 'nav', rect: navigationRect, display: 'flex',
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      },
      {
        key: '1', parentKey: '', tag: 'section', rect: measuredRect(0, 100, viewportWidth, 600),
        display: 'flex', alignItems: 'center', backgroundColor: 'rgb(255, 255, 255)',
      },
      {
        key: '1.0', parentKey: '1', tag: 'div', rect: measuredRect(90, 260, 720, 180),
        display: 'flex', flexDirection: 'column', gap: '16px',
      },
    ],
    textBoxes: [
      {
        tag: 'a', text: 'PRIVATE FLOW BRAND', structureKey: '0.0', parentGroupKey: '0',
        rect: measuredRect(40, 45, 180, 30), fontSize: '18px', fontWeight: '700',
        color: 'rgb(15, 23, 42)', backgroundColor: 'rgba(0, 0, 0, 0)',
      },
      {
        tag: 'a', text: 'PRIVATE FLOW SERVICES', structureKey: '0.1', parentGroupKey: '0',
        rect: measuredRect(470, 50, 120, 20), fontSize: '14px', fontWeight: '500',
        color: 'rgb(51, 65, 85)', backgroundColor: 'rgba(0, 0, 0, 0)',
      },
      {
        tag: 'a', text: 'PRIVATE FLOW ABOUT', structureKey: '0.2', parentGroupKey: '0',
        rect: measuredRect(630, 50, 100, 20), fontSize: '14px', fontWeight: '500',
        color: 'rgb(51, 65, 85)', backgroundColor: 'rgba(0, 0, 0, 0)',
      },
      {
        tag: 'a', text: 'PRIVATE FLOW CONTACT', structureKey: '0.3', parentGroupKey: '0',
        rect: measuredRect(1010, 35, 150, 50), fontSize: '14px', fontWeight: '700',
        color: 'rgb(15, 23, 42)', backgroundColor: 'rgb(250, 204, 21)', borderRadius: '6px',
      },
      {
        tag: 'h1', text: 'PRIVATE FLOW HERO', structureKey: '1.0.0', parentGroupKey: '1.0',
        rect: measuredRect(90, 300, 620, 96), fontSize: '64px', fontWeight: '700',
        color: 'rgb(15, 23, 42)', backgroundColor: 'rgba(0, 0, 0, 0)',
      },
    ],
    interactions: [],
    mediaBoxes: [],
    meaningfulMediaBoxes: [],
    summary: { firstViewportTextBoxes: 5, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
  }));
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'editorial-service', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/normal-navigation-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutPath,
    '--reference-manifest', manifestPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  assert.equal(layout.ROOT.nodes.length, 2);
  const navigationSection = layout[layout.ROOT.nodes[0]];
  assert.equal(navigationSection.props.tag, 'nav');
  assert.equal(navigationSection.props.minHeight, '100px');
  assert.equal(navigationSection.props.paddingTop, '20px');
  assert.equal(navigationSection.nodes.length, 1);
  const navigationHost = layout[navigationSection.nodes[0]];
  assert.equal(navigationHost.props.minHeight, '80px');
  assert.equal(navigationHost.props.flexDirection, 'column');
  assert.equal(navigationHost.props.alignItems, 'stretch');
  const navbar = layout[navigationHost.nodes[0]];
  assert.equal(navbar.type.resolvedName, 'Navbar');
  assert.equal(navbar.props.menuItems.length, 2);
  assert.equal(navbar.props.mobileMenuBehavior, 'drawer');
  assert.equal(Object.values(layout).filter((node) => node?.type?.resolvedName === 'ButtonBlock').length, 0);
  assert.doesNotMatch(JSON.stringify(layout), /PRIVATE FLOW|className|rawHtml/i);
});

test('generic measured drafting clips only bands with measured out-of-viewport content on a clipped page', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-section-overflow-'));
  const contractPath = path.join(directory, 'contract.json');
  const missingContractPath = path.join(directory, 'contract-without-section-overflow.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const unclippedLayoutPath = path.join(directory, 'layout-unclipped-page.json');
  const internallyClippedLayoutPath = path.join(directory, 'layout-internally-clipped.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const referenceLayoutPath = path.join(directory, 'reference-layout.json');
  const viewportWidth = 1200;
  const pageHeight = 640;
  const contractValue = contract();
  const sectionComponent = contractValue.components.find((component) => component.name === 'Section');
  sectionComponent.props.push('overflow');
  sectionComponent.aiProps.push('overflow');
  sectionComponent.controls.push({
    type: 'select',
    props: ['overflow'],
    options: ['', 'visible', 'hidden', 'clip', 'auto', 'scroll'],
  });
  const measuredLayout = {
    viewport: { width: viewportWidth, height: 800, scrollWidth: viewportWidth, scrollHeight: pageHeight },
    horizontalOverflow: {
      viewportWidth,
      documentScrollWidth: viewportWidth,
      overflowPx: 0,
      offenderCount: 0,
      offenders: [],
    },
    documentStyle: { backgroundColor: 'rgb(248, 250, 252)', color: 'rgb(15, 23, 42)' },
    landmarks: [
      { tag: 'main', groupKey: '0', rect: measuredRect(0, 0, viewportWidth, pageHeight), display: 'block' },
      { tag: 'section', groupKey: '0.0', rect: measuredRect(0, 0, viewportWidth, 300), display: 'flex' },
      { tag: 'section', groupKey: '0.1', rect: measuredRect(0, 300, viewportWidth, 340), display: 'flex' },
    ],
    layoutGroups: [
      {
        key: '0', parentKey: '', tag: 'main', rect: measuredRect(0, 0, viewportWidth, pageHeight),
        display: 'block', overflow: 'hidden',
      },
      {
        key: '0.0', parentKey: '0', tag: 'section', rect: measuredRect(0, 0, viewportWidth, 300),
        display: 'flex', flexDirection: 'column',
      },
      {
        key: '0.1', parentKey: '0', tag: 'section', rect: measuredRect(0, 300, viewportWidth, 340),
        display: 'flex', flexDirection: 'row',
      },
    ],
    textBoxes: [
      {
        tag: 'h2', text: 'Measured in-view section', structureKey: '0.0.0', parentGroupKey: '0.0',
        rect: measuredRect(80, 90, 620, 72), fontSize: '46px', lineHeight: '52px', fontWeight: '700',
        color: 'rgb(15, 23, 42)',
      },
      {
        tag: 'p', text: 'Measured clipped partner label', structureKey: '0.1.0', parentGroupKey: '0.1',
        rect: measuredRect(1110, 430, 260, 52), fontSize: '24px', lineHeight: '30px', fontWeight: '700',
        color: 'rgb(15, 23, 42)',
      },
    ],
    interactions: [],
    mediaBoxes: [],
    meaningfulMediaBoxes: [],
    summary: { firstViewportTextBoxes: 2, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
  };

  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'editorial-service', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/measured-clipped-page.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  }));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(measuredLayout));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutPath,
    '--reference-manifest', manifestPath, '--preserve-source-text', '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  assert.equal(layout.ROOT.nodes.length, 2);
  assert.equal(layout[layout.ROOT.nodes[0]].props.backgroundColor, 'rgb(248, 250, 252)');
  assert.equal(layout[layout.ROOT.nodes[1]].props.backgroundColor, 'rgb(248, 250, 252)');
  assert.equal(layout[layout.ROOT.nodes[0]].props.overflow, undefined);
  assert.equal(layout[layout.ROOT.nodes[1]].props.overflow, 'hidden');

  const unclippedMeasuredLayout = JSON.parse(JSON.stringify(measuredLayout));
  unclippedMeasuredLayout.layoutGroups[0].overflow = 'visible';
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(unclippedMeasuredLayout));
  const unclippedResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', unclippedLayoutPath,
    '--reference-manifest', manifestPath, '--preserve-source-text', '--json',
  ], { encoding: 'utf8' });
  assert.equal(unclippedResult.status, 0, unclippedResult.stderr || unclippedResult.stdout);
  const unclippedLayout = JSON.parse(fs.readFileSync(unclippedLayoutPath, 'utf8'));
  assert.equal(Object.values(unclippedLayout).some((node) => node?.props?.overflow === 'hidden'), false);

  const internallyClippedMeasuredLayout = JSON.parse(JSON.stringify(measuredLayout));
  internallyClippedMeasuredLayout.layoutGroups.push({
    key: '0.1.0', parentKey: '0.1', tag: 'div', rect: measuredRect(1000, 400, 200, 120),
    display: 'flex', overflow: 'hidden',
  });
  internallyClippedMeasuredLayout.textBoxes[1].parentGroupKey = '0.1.0';
  internallyClippedMeasuredLayout.textBoxes[1].structureKey = '0.1.0.0';
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(internallyClippedMeasuredLayout));
  const internallyClippedResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', internallyClippedLayoutPath,
    '--reference-manifest', manifestPath, '--preserve-source-text', '--json',
  ], { encoding: 'utf8' });
  assert.equal(internallyClippedResult.status, 0, internallyClippedResult.stderr || internallyClippedResult.stdout);
  const internallyClippedLayout = JSON.parse(fs.readFileSync(internallyClippedLayoutPath, 'utf8'));
  const internallyClippedSections = internallyClippedLayout.ROOT.nodes.map((nodeId) => internallyClippedLayout[nodeId]);
  assert.equal(internallyClippedSections.some((section) => section.props.overflow === 'hidden'), false);
  assert.equal(Object.values(internallyClippedLayout).some((node) => (
    node?.type?.resolvedName === 'Container' && node?.props?.overflow === 'hidden'
  )), true);

  const missingContract = JSON.parse(JSON.stringify(contractValue));
  const missingSection = missingContract.components.find((component) => component.name === 'Section');
  missingSection.props = missingSection.props.filter((prop) => prop !== 'overflow');
  missingSection.aiProps = missingSection.aiProps.filter((prop) => prop !== 'overflow');
  missingSection.controls = missingSection.controls.filter((control) => !control.props.includes('overflow'));
  fs.writeFileSync(missingContractPath, JSON.stringify(missingContract));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(measuredLayout));
  const missingContractResult = spawnSync(process.execPath, [
    draftScript, '--contract', missingContractPath, '--brief-json', briefPath,
    '--out', path.join(directory, 'layout-without-section-overflow.json'),
    '--reference-manifest', manifestPath, '--preserve-source-text', '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingContractResult.status, 1);
  assert.match(`${missingContractResult.stdout}\n${missingContractResult.stderr}`, /\[generic_section_overflow_control_gap\]/u);
});

test('generic measured drafting ignores overlay decoration when inferring section gutters', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-overlay-gutter-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const referenceLayoutPath = path.join(directory, 'reference-layout.json');

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'editorial-service', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/overlay-gutter-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  }));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify({
    viewport: { width: 1000, height: 700, scrollWidth: 1000, scrollHeight: 500 },
    documentStyle: { backgroundColor: 'rgb(247, 249, 252)', color: 'rgb(15, 23, 42)' },
    landmarks: [{
      tag: 'section', groupKey: '0', rect: measuredRect(0, 0, 1000, 500),
      display: 'block', backgroundColor: 'rgb(247, 249, 252)',
    }],
    layoutGroups: [{
      key: '0.0', parentKey: '0', tag: 'div', rect: measuredRect(50, 120, 900, 220),
      display: 'flex', flexDirection: 'column', gap: '16px',
    }, {
      key: '0.1', parentKey: '0', tag: 'div', rect: measuredRect(0, 0, 1000, 500),
      display: 'block', flowParticipation: 'overlay', paintedBackground: true,
      backgroundColor: 'rgba(37, 99, 235, 0.12)',
    }],
    textBoxes: [{
      tag: 'h2', text: 'Measured content width', structureKey: '0.0.0', parentGroupKey: '0.0',
      rect: measuredRect(80, 150, 520, 54), fontSize: '42px', lineHeight: '48px',
      fontWeight: '700', color: 'rgb(15, 23, 42)',
    }],
    interactions: [],
    mediaBoxes: [],
    meaningfulMediaBoxes: [],
    summary: { firstViewportTextBoxes: 1, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--out', layoutPath,
    '--reference-manifest', manifestPath, '--preserve-source-text', '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const section = layout[layout.ROOT.nodes[0]];
  assert.equal(section.props.innerPaddingX, '50px');
  assert.doesNotMatch(JSON.stringify(layout), /className|rawHtml/iu);
});

test('generic measured drafting maps a full-band hero background and measured portrait geometry without source URLs or zero-width media', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-media-geometry-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const sourceHero = 'https://source.example.test/full-band-photo.jpg';
  const sourcePortrait = 'https://source.example.test/portrait-photo.jpg';
  const viewports = [
    {
      label: 'desktop',
      width: 1440,
      height: 1200,
      bandHeight: 1200,
      portrait: measuredRect(1000, 406, 320, 420),
      backgroundPosition: ['40%', '35%'],
      portraitPosition: '70% 35%',
    },
    {
      label: 'tablet',
      width: 834,
      height: 1112,
      bandHeight: 1130,
      portrait: measuredRect(257, 646, 320, 420),
      backgroundPosition: ['45%', '40%'],
      portraitPosition: '60% 40%',
    },
    {
      label: 'mobile',
      width: 390,
      height: 844,
      bandHeight: 1216,
      portrait: measuredRect(51, 768, 288, 384),
      backgroundPosition: ['50%', '45%'],
      portraitPosition: '50% 50%',
    },
  ];

  for (const viewport of viewports) {
    const file = viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`;
    const measuredLayout = genericMeasuredLayout({
      label: viewport.label,
      width: viewport.width,
      height: viewport.height,
      bandHeights: [viewport.bandHeight],
      bandTags: ['section'],
      bandColors: ['rgb(12, 22, 35)'],
      columns: [2],
    });
    measuredLayout.textBoxes[0].tag = 'h1';
    measuredLayout.textBoxes[0].color = 'rgb(245, 245, 245)';
    measuredLayout.textBoxes[0].rect = measuredRect(
      viewport.label === 'mobile' ? 32 : 120,
      viewport.label === 'mobile' ? 190 : 300,
      viewport.label === 'mobile' ? 326 : 600,
      viewport.label === 'mobile' ? 190 : 180
    );
    const background = {
      tag: 'div',
      source: sourceHero,
      backgroundImage: sourceHero,
      structureKey: 'hero.background',
      rect: measuredRect(0, 0, viewport.width, viewport.bandHeight),
      firstViewportArea: viewport.width * Math.min(viewport.height, viewport.bandHeight),
      backgroundSize: 'cover',
      backgroundPosition: viewport.backgroundPosition.join(' '),
      backgroundPositionX: viewport.backgroundPosition[0],
      backgroundPositionY: viewport.backgroundPosition[1],
    };
    const portrait = {
      tag: 'img',
      source: sourcePortrait,
      structureKey: 'hero.portrait',
      rect: viewport.portrait,
      firstViewportArea: viewport.portrait.top < viewport.height
        ? viewport.portrait.width * Math.min(viewport.portrait.height, viewport.height - viewport.portrait.top)
        : 0,
      objectFit: 'cover',
      objectPosition: viewport.portraitPosition,
      backgroundPositionX: '0%',
      backgroundPositionY: '0%',
      borderRadius: '18px',
    };
    measuredLayout.mediaBoxes = [background, portrait];
    measuredLayout.meaningfulMediaBoxes = [background, portrait];
    measuredLayout.summary.firstViewportMediaBoxes = 2;
    measuredLayout.summary.firstViewportMediaCoverage = 1;
    measuredLayout.summary.largestMediaArea = viewport.width * viewport.bandHeight;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }

  const brief = {
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generic-measured-reference',
        family: '',
        familyMechanics: false,
        source: 'captured-reference-layout',
      },
    },
  };
  const manifest = {
    sourceUrl: 'https://source.example.test/reference',
    mediaSurfaces: [
      { role: 'hero', placement: 'firstViewport', source: sourceHero, width: 1440, height: 1200, top: 0 },
      { role: 'secondary', placement: 'firstViewport', source: sourcePortrait, width: 320, height: 420, top: 406 },
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
    ],
    layouts: viewports.map((viewport) => ({
      label: viewport.label,
      file: viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`,
      status: 'ok',
    })),
  };
  const contractValue = contract();
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const section = layout[layout.ROOT.nodes[0]];
  const mediaContainers = Object.values(layout).filter((node) => (
    node?.type?.resolvedName === 'Container' && typeof node.props?.backgroundImage === 'string'
  ));

  assert.equal(report.ok, true);
  assert.equal(report.audit.stats.satisfiedMediaRoles, 2);
  assert.match(section.props.backgroundImage, /generic-band-1-background/);
  assert.equal(section.props.backgroundSize, 'cover');
  assert.equal(section.props.backgroundOverlay, 'rgba(7, 11, 20, 0.72)');
  assert.equal(section.props.backgroundPosition, 'center');
  assert.equal(section.props.backgroundPositionX, '40%');
  assert.equal(section.props.backgroundPositionY, '35%');
  assert.equal(section.props.backgroundPositionXTablet, '45%');
  assert.equal(section.props.backgroundPositionYTablet, '40%');
  assert.equal(section.props.backgroundPositionXMobile, '50%');
  assert.equal(section.props.backgroundPositionYMobile, '45%');
  assert.equal(mediaContainers.length, 1);
  assert.match(mediaContainers[0].props.backgroundImage, /generic-band-1-media-1/);
  assert.equal(mediaContainers[0].props.width, '100%');
  assert.equal(mediaContainers[0].props.maxWidth, '320px');
  assert.equal(mediaContainers[0].props.maxWidthTablet, '320px');
  assert.equal(mediaContainers[0].props.maxWidthMobile, '288px');
  assert.equal(mediaContainers[0].props.minHeight, '420px');
  assert.equal(mediaContainers[0].props.minHeightTablet, '420px');
  assert.equal(mediaContainers[0].props.minHeightMobile, '384px');
  assert.equal(mediaContainers[0].props.flexShrink, 0);
  assert.equal(mediaContainers[0].props.backgroundPositionX, '70%');
  assert.equal(mediaContainers[0].props.backgroundPositionY, '35%');
  assert.equal(mediaContainers[0].props.backgroundPositionXTablet, '60%');
  assert.equal(mediaContainers[0].props.backgroundPositionYTablet, '40%');
  assert.equal(mediaContainers[0].props.backgroundPositionXMobile, '50%');
  assert.equal(mediaContainers[0].props.backgroundPositionYMobile, '50%');
  assert.equal(mediaContainers[0].props.borderRadius, '18px');
  assert.equal(Number(mediaContainers[0].props.gridColumnStart) >= 1, true);
  assert.equal(Number(mediaContainers[0].props.gridColumnSpan) >= 1, true);
  assert.equal(Number.parseFloat(mediaContainers[0].props.width) > 0, true);
  assert.equal(Number.parseFloat(mediaContainers[0].props.maxWidthMobile) > 0, true);
  assert.equal(Number.parseFloat(mediaContainers[0].props.minHeightMobile) > 0, true);
  assert.doesNotMatch(JSON.stringify(layout), /source\.example\.test/);

  const missingControl = JSON.parse(JSON.stringify(contractValue));
  const missingSection = missingControl.components.find((component) => component.name === 'Section');
  missingSection.props = missingSection.props.filter((prop) => prop !== 'backgroundPositionXMobile');
  missingSection.aiProps = missingSection.aiProps.filter((prop) => prop !== 'backgroundPositionXMobile');
  const missingContractPath = path.join(directory, 'contract-missing-mobile-position.json');
  fs.writeFileSync(missingContractPath, JSON.stringify(missingControl));
  const missingResult = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    missingContractPath,
    '--brief-json',
    briefPath,
    '--out',
    path.join(directory, 'layout-missing-mobile-position.json'),
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /\[generic_media_control_gap\] Section\.backgroundPositionXMobile/);

  const missingRadiusControl = JSON.parse(JSON.stringify(contractValue));
  const missingRadiusContainer = missingRadiusControl.components.find((component) => component.name === 'Container');
  missingRadiusContainer.props = missingRadiusContainer.props.filter((prop) => prop !== 'borderRadius');
  missingRadiusContainer.aiProps = missingRadiusContainer.aiProps.filter((prop) => prop !== 'borderRadius');
  const missingRadiusContractPath = path.join(directory, 'contract-missing-media-radius.json');
  fs.writeFileSync(missingRadiusContractPath, JSON.stringify(missingRadiusControl));
  const missingRadiusResult = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    missingRadiusContractPath,
    '--brief-json',
    briefPath,
    '--out',
    path.join(directory, 'layout-missing-media-radius.json'),
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingRadiusResult.status, 1);
  assert.match(missingRadiusResult.stderr, /\[generic_media_control_gap\] Container\.borderRadius/);
});

test('generic measured drafting preserves every normal-flow media item in a four-card grid', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-four-card-media-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const referenceLayoutPath = path.join(directory, 'reference-layout.json');
  const measuredLayout = genericMeasuredLayout({
    label: 'desktop',
    width: 1440,
    height: 900,
    bandHeights: [720],
    bandTags: ['section'],
    bandColors: ['rgb(246, 248, 247)'],
    columns: [1],
  });
  measuredLayout.landmarks[1].key = '0.1';
  measuredLayout.layoutGroups = [
    {
      key: '0.1.0', parentKey: '0.1', tag: 'div', rect: measuredRect(110, 140, 1220, 440),
      display: 'grid', gap: '20px', rowGap: '20px', columnGap: '20px', flowParticipation: 'normal',
    },
    ...Array.from({ length: 4 }, (_, index) => ({
      key: `0.1.0.${index}`,
      parentKey: '0.1.0',
      tag: 'article',
      rect: measuredRect(110 + index * 310, 140, 290, 440),
      display: 'flex',
      flexDirection: 'column',
      flowParticipation: 'normal',
      backgroundColor: 'rgb(255, 255, 255)',
      paintedBackground: true,
      borderRadius: '26px',
      overflow: 'hidden',
    })),
  ];
  const cardMedia = Array.from({ length: 4 }, (_, index) => ({
    tag: 'img',
    source: `https://captured.example.test/card-${index + 1}.jpg`,
    structureKey: `0.1.0.${index}.0`,
    parentGroupKey: `0.1.0.${index}`,
    flowParticipation: 'normal',
    rect: measuredRect(110 + index * 310, 140, 290, 210),
    firstViewportArea: 290 * 210,
    objectFit: 'cover',
    objectPosition: '50% 50%',
  }));
  measuredLayout.mediaBoxes = cardMedia;
  measuredLayout.meaningfulMediaBoxes = cardMedia;
  measuredLayout.summary.firstViewportMediaBoxes = 4;
  measuredLayout.summary.firstViewportMediaCoverage = 0.2;
  measuredLayout.summary.largestMediaArea = 290 * 210;

  fs.writeFileSync(referenceLayoutPath, JSON.stringify(measuredLayout));
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: { variant: 'marketplace-service', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'https://captured.example.test/reference',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--reference-manifest', manifestPath,
    '--out', layoutPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const mediaContainers = Object.values(layout).filter((node) => (
    node?.type?.resolvedName === 'Container'
    && typeof node.props?.backgroundImage === 'string'
    && node.props?.minHeight === '210px'
  ));
  assert.equal(mediaContainers.length, 4);
  assert.equal(new Set(mediaContainers.map((node) => node.parent)).size, 4);
  assert.equal(mediaContainers.every((node) => layout[node.parent]?.props?.minHeight === '440px'), true);
  assert.doesNotMatch(JSON.stringify(layout), /captured\.example\.test|className/);
});

test('generic measured drafting removes overlay groups from flow, reuses the matching media container, and maps non-primary full-band backgrounds', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-overlay-media-flow-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const measuredLayout = genericMeasuredLayout({
    label: 'desktop',
    width: 1440,
    height: 1000,
    bandHeights: [900, 620],
    bandTags: ['section', 'section'],
    bandColors: ['rgb(10, 15, 30)', 'rgb(245, 244, 240)'],
    columns: [2, 1],
  });
  measuredLayout.landmarks[1].key = '1';
  measuredLayout.landmarks[2].key = '2';
  measuredLayout.textBoxes[0].parentGroupKey = '1.3.0.0';
  measuredLayout.textBoxes[0].structureKey = '1.3.0.0.1';
  measuredLayout.textBoxes[0].tag = 'span';
  measuredLayout.textBoxes[0].text = '01';
  measuredLayout.textBoxes[0].rect = measuredRect(140, 500, 584, 18);
  measuredLayout.textBoxes.push(
    {
      tag: 'h3',
      text: 'Measured card heading',
      structureKey: '1.3.0.0.2',
      parentGroupKey: '1.3.0.0',
      rect: measuredRect(140, 528, 584, 40),
      fontSize: '30px',
      fontWeight: '700',
      color: 'rgb(20, 35, 29)',
    },
    {
      tag: 'p',
      text: 'Measured card body copy.',
      structureKey: '1.3.0.0.3',
      parentGroupKey: '1.3.0.0',
      rect: measuredRect(140, 578, 584, 54),
      fontSize: '16px',
      fontWeight: '400',
      color: 'rgb(20, 35, 29)',
    }
  );
  measuredLayout.textBoxes.find((box) => box.tag === 'h1').parentGroupKey = '2.0';
  measuredLayout.layoutGroups = [
    {
      key: '1.0',
      parentKey: '1',
      tag: 'div',
      rect: measuredRect(0, 0, 1440, 900),
      display: 'block',
      flowParticipation: 'overlay',
      paintedBackground: true,
    },
    {
      key: '1.1',
      parentKey: '1',
      tag: 'div',
      rect: measuredRect(0, 0, 1440, 96),
      display: 'flex',
      flowParticipation: 'overlay',
    },
    {
      key: '1.3',
      parentKey: '1',
      tag: 'div',
      rect: measuredRect(80, 180, 1280, 560),
      display: 'block',
      flowParticipation: 'normal',
    },
    {
      key: '1.3.0',
      parentKey: '1.3',
      tag: 'div',
      rect: measuredRect(120, 220, 1200, 500),
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      flowParticipation: 'normal',
    },
    {
      key: '1.3.0.0',
      parentKey: '1.3.0',
      tag: 'div',
      rect: measuredRect(120, 260, 624, 420),
      display: 'block',
      flowParticipation: 'normal',
      borderTopWidth: '1px',
      borderRightWidth: '0px',
      borderBottomWidth: '0px',
      borderLeftWidth: '0px',
      borderTopColor: 'rgba(20, 35, 29, 0.18)',
    },
    {
      key: '1.3.0.1',
      parentKey: '1.3.0',
      tag: 'div',
      rect: measuredRect(808, 260, 512, 420),
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flowParticipation: 'normal',
    },
    {
      key: '1.3.0.1.0',
      parentKey: '1.3.0.1',
      tag: 'div',
      rect: measuredRect(1000, 260, 320, 420),
      display: 'block',
      flowParticipation: 'normal',
    },
    {
      key: '2.0',
      parentKey: '2',
      tag: 'div',
      rect: measuredRect(72, 1020, 1296, 220),
      display: 'block',
      flowParticipation: 'normal',
    },
  ];
  const heroSource = 'https://source.example.test/full-band.jpg';
  const portraitSource = 'https://source.example.test/portrait.jpg';
  const cardSource = 'https://source.example.test/card.jpg';
  const heroBackground = {
    tag: 'div',
    source: heroSource,
    backgroundImage: heroSource,
    structureKey: '1.0.0',
    parentGroupKey: '1.0',
    flowParticipation: 'overlay',
    rect: measuredRect(0, 0, 1440, 900),
    firstViewportArea: 1440 * 900,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
  const portrait = {
    tag: 'img',
    source: portraitSource,
    structureKey: '1.3.0.1.0.0',
    parentGroupKey: '1.3.0.1.0',
    flowParticipation: 'normal',
    rect: measuredRect(1000, 260, 320, 420),
    firstViewportArea: 320 * 420,
    objectFit: 'cover',
    objectPosition: '50% 50%',
    borderRadius: '11px',
  };
  const cardMedia = {
    tag: 'img',
    source: cardSource,
    structureKey: '1.3.0.0.0',
    parentGroupKey: '1.3.0.0',
    flowParticipation: 'normal',
    rect: measuredRect(140, 280, 584, 190),
    firstViewportArea: 584 * 190,
    objectFit: 'cover',
    objectPosition: '50% 50%',
    borderRadius: '11px',
  };
  measuredLayout.mediaBoxes = [heroBackground, portrait, cardMedia];
  measuredLayout.meaningfulMediaBoxes = [heroBackground, portrait, cardMedia];
  measuredLayout.summary.firstViewportMediaBoxes = 3;
  measuredLayout.summary.firstViewportMediaCoverage = 1;
  measuredLayout.summary.largestMediaArea = 1440 * 900;
  fs.writeFileSync(path.join(directory, 'reference-layout.json'), JSON.stringify(measuredLayout));

  const brief = {
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  };
  const manifest = {
    sourceUrl: 'https://source.example.test/reference',
    mediaSurfaces: [
      { role: 'hero', source: heroSource, width: 1440, height: 900, top: 0 },
      { role: 'secondary', source: portraitSource, width: 320, height: 420, top: 260 },
      { role: 'service-card', source: cardSource, width: 584, height: 190, top: 280 },
    ],
    requiredMediaRoles: [
      { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
      { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
    ],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  };
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--reference-manifest',
    manifestPath,
    '--out',
    layoutPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const firstSection = layout[layout.ROOT.nodes[0]];
  const portraitContainers = Object.values(layout).filter((node) => (
    node?.type?.resolvedName === 'Container'
    && String(node.props?.backgroundImage || '').includes('generic-band-1-media-1')
  ));
  const fullBandOverlayContainers = Object.values(layout).filter((node) => (
    node?.type?.resolvedName === 'Container'
    && node.props?.maxWidth === '1440px'
    && node.props?.minHeight === '900px'
  ));

  assert.equal(report.audit.stats.satisfiedMediaRoles, 2);
  assert.match(firstSection.props.backgroundImage, /generic-band-1-background/);
  assert.equal(portraitContainers.length, 1);
  assert.equal(portraitContainers[0].props.width, '320px');
  assert.equal(portraitContainers[0].props.minHeight, '420px');
  assert.equal(portraitContainers[0].nodes.length, 0);
  const mixedMediaCard = Object.values(layout).find((node) => (
    node?.type?.resolvedName === 'Container'
    && node.nodes.length >= 4
    && node.nodes.some((nodeId) => typeof layout[nodeId]?.props?.backgroundImage === 'string')
  ));
  assert.notEqual(mixedMediaCard, undefined);
  assert.deepEqual(mixedMediaCard.nodes.map((nodeId) => (
    typeof layout[nodeId]?.props?.backgroundImage === 'string'
      ? 'media'
      : layout[nodeId]?.props?.minHeight
  )), ['media', '18px', '40px', '54px']);
  assert.equal(layout[mixedMediaCard.nodes[0]].props.borderRadius, '11px');
  const mixedMediaShell = layout[mixedMediaCard.parent];
  assert.equal(layout[mixedMediaShell.nodes[0]].type.resolvedName, 'Divider');
  assert.equal(layout[mixedMediaShell.nodes[1]], mixedMediaCard);
  assert.equal(fullBandOverlayContainers.length, 0);
  assert.doesNotMatch(JSON.stringify(layout), /source\.example\.test|className|position/);
});

test('generic measured drafting lowers bounded hero overlays into responsive corner anchors', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-corner-overlays-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const mainSource = 'https://images.example.test/hero-main.jpg';
  const detailSource = 'https://images.example.test/hero-detail.jpg';
  const viewports = [
    ['desktop', 1440, 900, measuredRect(770, 80, 540, 700), measuredRect(792, 102, 250, 170), measuredRect(1008, 638, 280, 120), '8px'],
    ['tablet', 834, 900, measuredRect(420, 80, 378, 620), measuredRect(442, 102, 250, 170), measuredRect(496, 558, 280, 120), '8px'],
    ['mobile', 390, 844, measuredRect(12, 620, 366, 500), measuredRect(26, 634, 220, 150), measuredRect(76, 980, 280, 118), '6px'],
  ];

  for (const [label, width, height, mediaRect, detailRect, noteRect, detailBorder] of viewports) {
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    const noteTitleRect = measuredRect(noteRect.left + 20, noteRect.top + 20, noteRect.width - 40, 26);
    const noteBodyRect = measuredRect(noteRect.left + 20, noteRect.top + 54, noteRect.width - 40, noteRect.height - 74);
    const mediaBoxes = [
      {
        tag: 'img',
        source: mainSource,
        structureKey: '0.0.0',
        parentGroupKey: '0.0',
        flowParticipation: 'normal',
        rect: mediaRect,
        firstViewportArea: Math.max(0, Math.min(mediaRect.bottom, height) - mediaRect.top) * mediaRect.width,
        objectFit: 'cover',
        objectPosition: label === 'mobile' ? '64% 36%' : '54% 44%',
      },
      {
        tag: 'img',
        source: detailSource,
        structureKey: '0.0.1',
        parentGroupKey: '0.0',
        flowParticipation: label === 'desktop' ? 'overlay' : 'normal',
        rect: detailRect,
        firstViewportArea: Math.max(0, Math.min(detailRect.bottom, height) - detailRect.top) * detailRect.width,
        objectFit: 'cover',
        objectPosition: '50% 50%',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderTopWidth: detailBorder,
        borderRightWidth: detailBorder,
        borderBottomWidth: detailBorder,
        borderLeftWidth: detailBorder,
        borderTopColor: 'rgb(243, 241, 232)',
        borderRightColor: 'rgb(243, 241, 232)',
        borderBottomColor: 'rgb(243, 241, 232)',
        borderLeftColor: 'rgb(243, 241, 232)',
        borderRadius: '16px',
        boxShadow: 'rgba(20, 35, 29, 0.26) 0px 18px 42px 0px',
      },
    ];
    const textBoxes = [
      {
        tag: 'strong',
        text: 'Autumn house night',
        structureKey: '0.0.2.0',
        parentGroupKey: '0.0.2',
        rect: noteTitleRect,
        fontSize: '22px',
        fontWeight: '700',
        lineHeight: '26px',
        marginBottom: '8px',
        color: 'rgb(20, 35, 29)',
      },
      {
        tag: 'span',
        text: 'Five spaces, one ticket, and a program that moves at its own pace.',
        structureKey: '0.0.2.1',
        parentGroupKey: '0.0.2',
        rect: noteBodyRect,
        fontSize: '16px',
        fontWeight: '400',
        lineHeight: '23px',
        color: 'rgb(102, 113, 107)',
      },
    ];
    fs.writeFileSync(path.join(directory, file), JSON.stringify({
      label,
      viewport: { width, height, scrollWidth: width, scrollHeight: Math.max(height, mediaRect.bottom) },
      documentStyle: { backgroundColor: 'rgb(243, 241, 232)', color: 'rgb(20, 35, 29)' },
      landmarks: [{
        tag: 'section',
        groupKey: '0',
        rect: measuredRect(0, mediaRect.top, width, mediaRect.height),
        display: 'block',
        backgroundColor: 'rgb(243, 241, 232)',
      }],
      layoutGroups: [
        {
          key: '0.0',
          parentKey: '0',
          tag: 'div',
          rect: mediaRect,
          display: 'block',
          backgroundColor: 'rgb(83, 104, 220)',
          borderRadius: '26px',
          paintedBackground: true,
          flowParticipation: 'normal',
        },
        {
          key: '0.0.2',
          parentKey: '0.0',
          tag: 'div',
          rect: noteRect,
          display: 'block',
          backgroundColor: 'rgba(243, 241, 232, 0.94)',
          borderRadius: '16px',
          boxShadow: 'rgba(20, 35, 29, 0.22) 0px 18px 42px 0px',
          paddingTop: '20px',
          paddingRight: '20px',
          paddingBottom: '20px',
          paddingLeft: '20px',
          paintedBackground: true,
          flowParticipation: 'overlay',
        },
        ...(label === 'desktop' ? [{
          key: '0.0.3',
          parentKey: '0.0',
          tag: 'div',
          rect: measuredRect(mediaRect.right - 88, mediaRect.top + 40, 72, 72),
          display: 'block',
          backgroundColor: 'rgb(255, 221, 103)',
          borderRadius: '999px',
          paintedBackground: true,
          flowParticipation: 'overlay',
        }] : []),
      ],
      textBoxes,
      mediaBoxes,
      meaningfulMediaBoxes: mediaBoxes,
      summary: {
        firstViewportTextBoxes: textBoxes.filter((box) => box.rect.top < height).length,
        firstViewportMediaBoxes: mediaBoxes.filter((box) => box.rect.top < height).length,
        firstViewportMediaCoverage: 0.3,
        largestMediaArea: mediaRect.width * mediaRect.height,
      },
    }));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: { variant: 'tabbed-program', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      preserveSourceText: true,
      reuseSourceMedia: true,
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-corner-overlay.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(([label]) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath, '--reference-manifest', manifestPath,
    '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const mediaHost = Object.values(layout).find((node) => node?.props?.backgroundImage === mainSource);
  const detailImage = Object.values(layout).find((node) => node?.props?.backgroundImage === detailSource);
  const detailShell = Object.values(layout).find((node) => node?.nodes?.includes(
    Object.keys(layout).find((nodeId) => layout[nodeId] === detailImage)
  ));
  const noteSurface = Object.values(layout).find((node) => (
    node?.props?.backgroundColor === 'rgba(243, 241, 232, 0.94)'
    && node.nodes.length >= 2
  ));
  const desktopOnlyBadge = Object.values(layout).find((node) => (
    node?.props?.backgroundColor === 'rgb(255, 221, 103)'
    && node?.props?.borderRadius === '999px'
  ));
  const detailAnchor = detailShell ? layout[detailShell.parent] : null;
  const badgeAnchor = desktopOnlyBadge ? layout[desktopOnlyBadge.parent] : null;

  assert.notEqual(mediaHost, undefined);
  assert.equal(mediaHost.props.layoutDisplay, 'grid');
  assert.equal(mediaHost.props.gridTemplateColumns, 'one');
  assert.equal(mediaHost.props.gridTemplateColumnsTablet, 'one');
  assert.equal(mediaHost.props.gridTemplateColumnsMobile, 'one');
  assert.equal(mediaHost.nodes.length, 3);
  assert.notEqual(detailImage, undefined);
  assert.notEqual(detailShell, undefined);
  assert.notEqual(detailAnchor, null);
  assert.equal(detailAnchor.props.responsiveDisplay, undefined);
  assert.equal(detailAnchor.props.gridRowStart, 1);
  assert.equal(detailAnchor.props.gridRowStartTablet, 1);
  assert.equal(detailAnchor.props.gridRowStartMobile, 1);
  assert.equal(detailShell.props.maxWidth, '250px');
  assert.equal(detailShell.props.maxWidthTablet, '250px');
  assert.equal(detailShell.props.maxWidthMobile, '220px');
  assert.equal(detailShell.props.paddingTop, '8px');
  assert.equal(detailShell.props.paddingTopTablet, '8px');
  assert.equal(detailShell.props.paddingTopMobile, '6px');
  assert.equal(detailImage.props.minHeight, '154px');
  assert.equal(detailImage.props.minHeightTablet, '154px');
  assert.equal(detailImage.props.minHeightMobile, '138px');
  assert.notEqual(noteSurface, undefined);
  assert.equal(noteSurface.props.maxWidth, '280px');
  assert.equal(noteSurface.props.maxWidthTablet, '280px');
  assert.equal(noteSurface.props.maxWidthMobile, '280px');
  assert.notEqual(desktopOnlyBadge, undefined);
  assert.notEqual(badgeAnchor, null);
  assert.equal(badgeAnchor.props.responsiveDisplay, 'hide-tablet-down');
  assert.equal(badgeAnchor.props.gridRowStart, 1);
  assert.deepEqual(
    Object.values(layout).filter((node) => [mainSource, detailSource].includes(node?.props?.backgroundImage)).length,
    2
  );
  assert.doesNotMatch(JSON.stringify(layout), /className|rawHtml|rawCss|"position(?:Top|Right|Bottom|Left)?"\s*:/i);
});

test('generic measured drafting preserves a stable Lumen-like mixed hero stack and protruding proof content', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-mixed-hero-stack-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const previewPath = path.join(directory, 'preview.html');
  const backgroundSource = 'https://cdn.example.test/lumen-hero-full.jpg?auto=format&fit=crop';
  const doctorSource = 'https://cdn.example.test/lumen-doctor-cutout.png';
  const detailSource = 'https://cdn.example.test/lumen-hero-detail.jpg';
  const viewports = [
    {
      label: 'desktop', width: 1440, height: 900, heroWidth: 1400, heroHeight: 931,
      paddingTop: 118, paddingBottom: 24, proofTop: 646, proofWidth: 424, proofRight: 70, proofHeight: 405.94,
    },
    {
      label: 'tablet', width: 834, height: 900, heroWidth: 794, heroHeight: 820,
      paddingTop: 80, paddingBottom: 20, proofTop: 580, proofWidth: 360, proofRight: 40, proofHeight: 300,
    },
    {
      label: 'mobile', width: 390, height: 844, heroWidth: 390, heroHeight: 980,
      paddingTop: 40, paddingBottom: 16, proofTop: 780, proofWidth: 350, proofRight: 20, proofHeight: 260,
    },
  ];

  for (const viewport of viewports) {
    const captured = finalizeCapturedLayoutCoverage({
      status: 'ok',
      layout: lumenLikeMixedStackLayout(viewport),
    });
    const file = viewport.label === 'desktop'
      ? 'reference-layout.json'
      : `reference-layout-${viewport.label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(captured.layout));
  }
  const contractValue = contract();
  const container = contractValue.components.find((component) => component.name === 'Container');
  const protrusionProps = [
    'marginTop', 'marginTopTablet', 'marginTopMobile',
    'marginBottom', 'marginBottomTablet', 'marginBottomMobile',
    'paintLayer',
  ];
  container.props.push(...protrusionProps);
  container.aiProps.push(...protrusionProps);
  container.controls.push(
    { type: 'css-value', props: protrusionProps.slice(0, 6) },
    { type: 'select', props: ['paintLayer'], options: ['foreground'] },
  );
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: {
        variant: 'marketplace-service',
        archetype: 'lumen-eye-care-editorial',
        referenceStyle: 'editorial eye care',
      },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      preserveSourceText: true,
      reuseSourceMedia: true,
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generated-target',
        family: 'lumen-eye-care-editorial',
        familyMechanics: true,
      },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-lumen-mixed-stack.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(({ label }) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const firstSection = layout[layout.ROOT.nodes[0]];
  const stackHostEntry = Object.entries(layout).find(([, node]) => (
    node?.type?.resolvedName === 'Container'
    && node.props?.layoutDisplay === 'grid'
    && node.props?.gridTemplateColumns === 'one'
    && node.props?.minHeight === '931px'
    && node.nodes.length === 4
    && node.nodes.every((nodeId) => layout[nodeId]?.props?.gridRowStart === 1)
  ));

  assert.equal(report.stats.authoringMode, 'generic-measured-reference');
  assert.equal(firstSection.props.backgroundImage, backgroundSource);
  assert.notEqual(stackHostEntry, undefined);
  const [, stackHost] = stackHostEntry;
  const layerOrder = stackHost.nodes.map((layerId) => {
    const pending = [layerId];
    while (pending.length > 0) {
      const node = layout[pending.shift()];
      if (!node) {
        continue;
      }
      if (node.props?.backgroundImage === doctorSource) {
        return 'doctor';
      }
      if (node.props?.backgroundImage === detailSource) {
        return 'mini';
      }
      if (node.props?.text === 'Clear care, thoughtfully framed') {
        return 'content';
      }
      if (node.props?.text === 'Trusted by local families') {
        return 'proof';
      }
      pending.push(...(Array.isArray(node.nodes) ? node.nodes : []));
    }
    return 'unknown';
  });

  assert.deepEqual(layerOrder, ['doctor', 'content', 'mini', 'proof']);
  assert.equal(stackHost.props.minHeight, '931px');
  assert.equal(stackHost.props.paddingTop, '118px');
  assert.equal(stackHost.props.paddingBottom, '24px');
  assert.equal(stackHost.props.alignItems, 'flex-start');
  assert.equal(stackHost.props.alignItemsTablet, 'flex-start');
  assert.equal(stackHost.props.alignItemsMobile, 'flex-start');
  for (const layerId of stackHost.nodes) {
    assert.equal(layout[layerId].props.gridColumnStart, 1);
    assert.equal(layout[layerId].props.gridRowStart, 1);
    assert.equal(layout[layerId].props.gridColumnStartTablet, 1);
    assert.equal(layout[layerId].props.gridRowStartTablet, 1);
    assert.equal(layout[layerId].props.gridColumnStartMobile, 1);
    assert.equal(layout[layerId].props.gridRowStartMobile, 1);
  }
  assert.equal(Object.values(layout).some((node) => node?.props?.text === 'Trusted by local families'), true);
  const proofText = Object.values(layout)
    .find((node) => node?.props?.text === 'Trusted by local families');
  const proofTextWrapper = layout[proofText?.parent];
  const proofCard = layout[proofTextWrapper?.parent];
  const proofLayer = layout[proofCard?.parent];
  assert.equal(proofCard?.props?.maxWidth, '424px');
  assert.equal(proofCard?.props?.maxWidthTablet, '360px');
  assert.equal(proofCard?.props?.maxWidthMobile, '350px');
  assert.equal(proofCard?.props?.minHeight, '405.94px');
  assert.equal(proofLayer?.props?.justifyContent, 'flex-end');
  assert.equal(proofLayer?.props?.justifyContentTablet, 'flex-end');
  assert.equal(proofLayer?.props?.justifyContentMobile, 'flex-start');
  assert.equal(proofLayer?.props?.paddingLeft, '0px');
  assert.equal(proofLayer?.props?.paddingRight, '70px');
  assert.equal(proofLayer?.props?.paddingLeftTablet, '0px');
  assert.equal(proofLayer?.props?.paddingRightTablet, '40px');
  assert.equal(proofLayer?.props?.paddingLeftMobile, '20px');
  assert.equal(proofLayer?.props?.paddingRightMobile, '0px');
  assert.equal(proofLayer?.props?.paintLayer, 'foreground');
  assert.equal(proofLayer?.props?.marginTop, '528px');
  assert.equal(proofLayer?.props?.marginTopTablet, '500px');
  assert.equal(proofLayer?.props?.marginTopMobile, '740px');
  assert.equal(proofLayer?.props?.marginBottom, '-144.94px');
  assert.equal(proofLayer?.props?.marginBottomTablet, '-80px');
  assert.equal(proofLayer?.props?.marginBottomMobile, '-76px');
  assert.equal(proofLayer?.props?.minHeight, undefined);
  assert.equal(proofLayer?.props?.paddingTop, undefined);
  assert.equal(proofLayer?.props?.paddingBottom, undefined);
  assert.equal(Number.parseFloat(proofLayer.props.marginTop) + 405.94 + Number.parseFloat(proofLayer.props.marginBottom) + 118 + 24, 931);
  assert.equal(Number.parseFloat(proofLayer.props.marginTopTablet) + 300 + Number.parseFloat(proofLayer.props.marginBottomTablet) + 80 + 20, 820);
  assert.equal(Number.parseFloat(proofLayer.props.marginTopMobile) + 260 + Number.parseFloat(proofLayer.props.marginBottomMobile) + 40 + 16, 980);
  assert.doesNotMatch(
    JSON.stringify(layout),
    /className|rawHtml|rawCss|customCss|zIndex|stackingIndex|"position(?:Top|Right|Bottom|Left)?"\s*:/iu,
  );

  const previewResult = spawnSync(process.execPath, [
    renderScript, '--layout', layoutPath, '--out', previewPath,
  ], { encoding: 'utf8' });
  assert.equal(previewResult.status, 0, previewResult.stderr || previewResult.stdout);
  const previewHtml = fs.readFileSync(previewPath, 'utf8');
  assert.match(previewHtml, /lumen-hero-full\.jpg\?auto=format&amp;fit=crop/u);
  assert.doesNotMatch(previewHtml, /auto=format&amp;(?:amp|#38|#x26);fit=crop/iu);

  const conflictingMobile = JSON.parse(fs.readFileSync(
    path.join(directory, 'reference-layout-mobile.json'),
    'utf8',
  ));
  for (const media of conflictingMobile.meaningfulMediaBoxes) {
    if (media.source === detailSource) {
      media.stackingIndex = 1;
    }
  }
  fs.writeFileSync(
    path.join(directory, 'reference-layout-mobile-conflict.json'),
    JSON.stringify(conflictingMobile),
  );
  const conflictingManifestPath = path.join(directory, 'reference-manifest-conflict.json');
  fs.writeFileSync(conflictingManifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-lumen-mixed-stack.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile-conflict.json', status: 'ok' },
    ],
  }));
  const conflictResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', conflictingManifestPath,
    '--out', path.join(directory, 'layout-conflict.json'), '--json',
  ], { encoding: 'utf8' });

  assert.equal(conflictResult.status, 1);
  assert.match(conflictResult.stderr, /\[generic_responsive_stacking_order_unsupported\]/u);
  assert.match(conflictResult.stderr, /Conflicting pair 0\.0\.0 <> 0\.0\.2/u);
});

test('generic measured drafting reflows the exact Lumen doctor layer without weakening overlap inversion checks', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-lumen-responsive-flow-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const doctorSource = 'https://cdn.example.test/lumen-doctor-cutout.png';
  const detailSource = 'https://cdn.example.test/lumen-hero-detail.jpg';
  const viewports = [
    {
      label: 'desktop', width: 1440, height: 1200, heroWidth: 1400, heroHeight: 931,
      paddingTop: 118, paddingBottom: 0, proofTop: 646, proofWidth: 424, proofRight: 70, proofHeight: 405.94,
    },
    {
      label: 'tablet', width: 834, height: 1112, heroWidth: 794, heroHeight: 888.13,
      paddingTop: 40, paddingBottom: 0, proofTop: 600, proofWidth: 360, proofRight: 40, proofHeight: 300,
    },
    {
      label: 'mobile', width: 390, height: 844, heroWidth: 350, heroHeight: 781.2,
      paddingTop: 40, paddingBottom: 0, proofTop: 600, proofWidth: 350, proofRight: 0, proofHeight: 260,
    },
  ];

  for (const viewport of viewports) {
    const referenceLayout = lumenLikeMixedStackLayout({
      ...viewport,
      responsiveDoctorFlow: true,
    });
    const stackGroup = referenceLayout.layoutGroups.find((group) => group.key === '0.1');
    const heroLandmark = referenceLayout.landmarks.find((landmark) => landmark.groupKey === '0');
    Object.assign(heroLandmark, {
      groupKey: stackGroup.key,
      display: stackGroup.display,
      paddingTop: stackGroup.paddingTop,
      paddingBottom: stackGroup.paddingBottom,
    });
    referenceLayout.layoutGroups = referenceLayout.layoutGroups.filter((group) => group !== stackGroup);
    const captured = finalizeCapturedLayoutCoverage({
      status: 'ok',
      layout: referenceLayout,
    });
    const file = viewport.label === 'desktop'
      ? 'reference-layout.json'
      : `reference-layout-${viewport.label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(captured.layout));
  }

  const contractValue = contract();
  const container = contractValue.components.find((component) => component.name === 'Container');
  const protrusionProps = [
    'marginTop', 'marginTopTablet', 'marginTopMobile',
    'marginBottom', 'marginBottomTablet', 'marginBottomMobile',
    'paintLayer',
  ];
  container.props.push(...protrusionProps);
  container.aiProps.push(...protrusionProps);
  container.controls.push(
    { type: 'css-value', props: protrusionProps.slice(0, 6) },
    { type: 'select', props: ['paintLayer'], options: ['foreground'] },
  );
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: {
        variant: 'marketplace-service',
        archetype: 'lumen-eye-care-editorial',
        referenceStyle: 'editorial eye care',
      },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      preserveSourceText: true,
      reuseSourceMedia: true,
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generated-target',
        family: 'lumen-eye-care-editorial',
        familyMechanics: true,
      },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-lumen-responsive-flow.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(({ label }) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const stackHostEntry = Object.entries(layout).find(([, node]) => (
    node?.type?.resolvedName === 'Container'
    && node.props?.layoutDisplay === 'grid'
    && node.props?.minHeight === '931px'
    && node.nodes.length === 4
  ));
  assert.notEqual(stackHostEntry, undefined);
  const [stackHostId, stackHost] = stackHostEntry;
  const layerOrder = stackHost.nodes.map((layerId) => {
    const pending = [layerId];
    while (pending.length > 0) {
      const node = layout[pending.shift()];
      if (!node) {
        continue;
      }
      if (node.props?.backgroundImage === doctorSource) {
        return 'doctor';
      }
      if (node.props?.backgroundImage === detailSource) {
        return 'mini';
      }
      if (node.props?.text === 'Clear care, thoughtfully framed') {
        return 'content';
      }
      if (node.props?.text === 'Trusted by local families') {
        return 'proof';
      }
      pending.push(...(Array.isArray(node.nodes) ? node.nodes : []));
    }
    return 'unknown';
  });
  assert.deepEqual(layerOrder, ['doctor', 'content', 'mini', 'proof']);

  const doctorLayerId = stackHost.nodes[layerOrder.indexOf('doctor')];
  const doctorLayer = layout[doctorLayerId];
  const doctorSurfaceEntry = Object.entries(layout).find(([, node]) => (
    node?.props?.backgroundImage === doctorSource
  ));
  assert.notEqual(doctorSurfaceEntry, undefined);
  const [, doctorSurface] = doctorSurfaceEntry;
  const doctorFrame = layout[doctorSurface.parent];
  assert.equal(doctorFrame.parent, doctorLayerId);
  const contentLayer = layout[stackHost.nodes[layerOrder.indexOf('content')]];
  const miniLayer = layout[stackHost.nodes[layerOrder.indexOf('mini')]];
  const proofLayer = layout[stackHost.nodes[layerOrder.indexOf('proof')]];
  const lead = Object.values(layout).find((node) => (
    node?.props?.text === 'Thoughtful explanations and a calm plan for every stage of care.'
  ));
  assert.notEqual(lead, undefined);
  assert.equal(lead.props.marginTop, '34px');
  assert.equal(lead.props.marginTopTablet, undefined);
  assert.equal(lead.props.marginTopMobile, undefined);
  assert.equal(stackHost.props.gapTablet, '44px');
  assert.equal(stackHost.props.gapMobile, '44px');
  assert.equal(doctorLayer.props.gridRowStart, 1);
  assert.equal(doctorLayer.props.gridRowStartTablet, 2);
  assert.equal(doctorLayer.props.gridRowStartMobile, 2);
  assert.equal(doctorLayer.props.paddingLeft, '190px');
  assert.equal(doctorLayer.props.paddingLeftTablet, '0px');
  assert.equal(doctorLayer.props.paddingLeftMobile, '0px');
  assert.equal(doctorLayer.props.marginTop, '126px');
  assert.equal(doctorLayer.props.marginTopTablet, '0px');
  assert.equal(doctorLayer.props.marginTopMobile, '0px');
  assert.equal(doctorLayer.props.marginBottom, '157px');
  assert.equal(doctorLayer.props.marginBottomTablet, '0px');
  assert.equal(doctorLayer.props.marginBottomMobile, '0px');
  assert.equal(doctorLayer.props.paintLayer, 'foreground');
  assert.equal(doctorFrame.props.maxWidth, '440px');
  assert.equal(doctorFrame.props.maxWidthTablet, '794px');
  assert.equal(doctorFrame.props.maxWidthMobile, '350px');
  assert.equal(doctorFrame.props.minHeight, '530px');
  assert.equal(doctorFrame.props.minHeightTablet, '440px');
  assert.equal(doctorFrame.props.minHeightMobile, '300px');
  assert.equal(contentLayer.props.gridRowStartTablet, 1);
  assert.equal(contentLayer.props.gridRowStartMobile, 1);
  assert.equal(miniLayer.props.responsiveDisplay, 'hide-tablet-down');
  assert.equal(proofLayer.props.responsiveDisplay, 'hide-tablet-down');
  assert.doesNotMatch(
    JSON.stringify(layout),
    /className|rawHtml|rawCss|customCss|zIndex|stackingIndex|"position(?:Top|Right|Bottom|Left)?"\s*:/iu,
  );

  const conflictingMobile = JSON.parse(fs.readFileSync(
    path.join(directory, 'reference-layout-mobile.json'),
    'utf8',
  ));
  const conflictingMini = {
    tag: 'img',
    source: detailSource,
    structureKey: '0.1.1.1',
    parentGroupKey: '0.1',
    flowParticipation: 'overlay',
    stackingIndex: 1,
    rect: measuredRect(90, 160, 236, 158),
    firstViewportArea: 236 * 158,
    objectFit: 'cover',
  };
  conflictingMobile.mediaBoxes.push(conflictingMini);
  conflictingMobile.meaningfulMediaBoxes.push({ ...conflictingMini });
  fs.writeFileSync(
    path.join(directory, 'reference-layout-mobile-conflict.json'),
    JSON.stringify(conflictingMobile),
  );
  const conflictingManifestPath = path.join(directory, 'reference-manifest-conflict.json');
  fs.writeFileSync(conflictingManifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-lumen-responsive-flow.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'tablet', file: 'reference-layout-tablet.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile-conflict.json', status: 'ok' },
    ],
  }));
  const conflictResult = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', conflictingManifestPath,
    '--out', path.join(directory, 'layout-conflict.json'), '--json',
  ], { encoding: 'utf8' });

  assert.equal(conflictResult.status, 1);
  assert.match(conflictResult.stderr, /\[generic_responsive_stacking_order_unsupported\]/u);
  assert.match(conflictResult.stderr, /Conflicting pair 0\.1\.0 <> 0\.1\.1\.1/u);
  assert.match(
    conflictResult.stderr,
    /stackingIndex: 0\.1\.0=2, 0\.1\.1\.1=3; stackingIndexMobile: 0\.1\.0=2, 0\.1\.1\.1=1/u,
  );
  assert.equal(stackHostId.length > 0, true);
});

test('generic measured drafting keeps a narrow root stats band and clears its hero overlap responsively', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-narrow-root-band-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout.json');
  const viewports = [
    {
      label: 'desktop', width: 1440, height: 1200, pageHeight: 1521,
      nav: measuredRect(0, 0, 1440, 118),
      hero: measuredRect(20, 118, 1400, 931),
      stats: measuredRect(80, 823, 540, 120),
      following: measuredRect(20, 1121, 1400, 400),
      statsRows: [measuredRect(80, 823, 253, 120), measuredRect(367, 823, 253, 120)],
    },
    {
      label: 'tablet', width: 834, height: 1112, pageHeight: 1772.13,
      nav: measuredRect(0, 0, 834, 82),
      hero: measuredRect(20, 82, 794, 888.13),
      stats: measuredRect(147, 1012.13, 540, 306),
      following: measuredRect(20, 1372.13, 794, 400),
      statsRows: [measuredRect(147, 1036.13, 540, 120), measuredRect(147, 1174.13, 540, 120)],
    },
    {
      label: 'mobile', width: 390, height: 844, pageHeight: 1551.2,
      nav: measuredRect(0, 0, 390, 82),
      hero: measuredRect(20, 82, 350, 781.2),
      stats: measuredRect(20, 905.2, 350, 274),
      following: measuredRect(20, 1233.2, 350, 318),
      statsRows: [measuredRect(20, 929.2, 350, 104), measuredRect(20, 1051.2, 350, 104)],
    },
  ];

  for (const viewport of viewports) {
    const statsText = viewport.statsRows.flatMap((row, index) => ([
      {
        tag: 'strong',
        text: index === 0 ? '25+' : '98%',
        structureKey: `0.2.${index}.0`,
        parentGroupKey: '0.2',
        rect: measuredRect(row.left, row.top, Math.min(120, row.width), Math.min(64, row.height * 0.58)),
        fontSize: viewport.label === 'mobile' ? '42px' : '52px',
        fontWeight: '700',
        lineHeight: '1',
        color: 'rgb(24, 51, 45)',
      },
      {
        tag: 'p',
        text: index === 0 ? 'Years of focused care' : 'Patients recommending us',
        structureKey: `0.2.${index}.1`,
        parentGroupKey: '0.2',
        rect: measuredRect(row.left, row.bottom - 32, Math.min(240, row.width), 24),
        fontSize: '15px',
        fontWeight: '600',
        lineHeight: '24px',
        color: 'rgb(24, 51, 45)',
      },
    ]));
    const referenceLayout = {
      capturedAt: '2026-07-16T00:00:00.000Z',
      label: viewport.label,
      url: 'file:///tmp/generated-narrow-root-band.html',
      viewport: {
        width: viewport.width,
        height: viewport.height,
        scrollWidth: viewport.width,
        scrollHeight: viewport.pageHeight,
      },
      horizontalOverflow: { overflowPx: 0, documentScrollWidth: viewport.width },
      documentStyle: { backgroundColor: 'rgb(247, 250, 246)', color: 'rgb(24, 51, 45)' },
      landmarks: [
        { tag: 'main', rect: measuredRect(0, 0, viewport.width, viewport.pageHeight), backgroundColor: 'rgba(0, 0, 0, 0)' },
        { tag: 'nav', groupKey: '0.0', rect: viewport.nav, backgroundColor: 'rgb(247, 250, 246)' },
        { tag: 'section', groupKey: '0.1', rect: viewport.hero, backgroundColor: 'rgb(232, 247, 221)' },
        { tag: 'section', groupKey: '0.2', rect: viewport.stats, display: 'grid', columnGap: '34px', backgroundColor: 'rgba(0, 0, 0, 0)' },
        { tag: 'section', groupKey: '0.3', rect: viewport.following, backgroundColor: 'rgb(247, 250, 246)' },
      ],
      layoutGroups: [],
      textBoxes: [
        {
          tag: 'h1', text: 'Clear care, thoughtfully framed', structureKey: '0.1.0', parentGroupKey: '0.1',
          rect: measuredRect(viewport.hero.left + 40, viewport.hero.top + 80, Math.min(720, viewport.hero.width - 80), 150),
          fontSize: viewport.label === 'mobile' ? '54px' : '76px', fontWeight: '700', lineHeight: '0.98', color: 'rgb(24, 51, 45)',
        },
        ...statsText,
        {
          tag: 'h2', text: 'Care that continues', structureKey: '0.3.0', parentGroupKey: '0.3',
          rect: measuredRect(viewport.following.left + 40, viewport.following.top + 80, viewport.following.width - 80, 76),
          fontSize: viewport.label === 'mobile' ? '32px' : '46px', fontWeight: '700', lineHeight: '1.08', color: 'rgb(24, 51, 45)',
        },
      ],
      mediaBoxes: [],
      meaningfulMediaBoxes: [],
      summary: {
        firstViewportTextBoxes: statsText.length + 1,
        firstViewportMediaBoxes: 0,
        firstViewportMediaCoverage: 0,
        largestMediaArea: 0,
      },
    };
    const file = viewport.label === 'desktop'
      ? 'reference-layout.json'
      : `reference-layout-${viewport.label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(referenceLayout));
  }

  const contractValue = contract();
  const section = contractValue.components.find((component) => component.name === 'Section');
  const overlapProps = ['marginTop', 'marginTopTablet', 'marginTopMobile', 'paintLayer'];
  section.props.push(...overlapProps);
  section.aiProps.push(...overlapProps);
  section.controls.push(
    { type: 'css-value', props: overlapProps.slice(0, 3), units: ['px'], min: -9999 },
    { type: 'select', props: ['paintLayer'], options: ['auto', 'foreground'] },
  );
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({
      target: { variant: 'marketplace-service', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      preserveSourceText: true,
      reuseSourceMedia: true,
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-narrow-root-band.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(({ label }) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const statsSection = layout[layout.ROOT.nodes.find((nodeId) => layout[nodeId]?.props?.marginTop === '-226px')];
  assert.equal(report.stats.measuredBandCount, 4);
  assert.notEqual(statsSection, undefined);
  assert.equal(statsSection.props.marginTop, '-226px');
  assert.equal(statsSection.props.marginTopTablet, '0px');
  assert.equal(statsSection.props.marginTopMobile, '0px');
  assert.equal(statsSection.props.paintLayer, 'foreground');
  assert.equal(statsSection.props.minHeight, '298px');
  assert.equal(statsSection.props.minHeightTablet, '360px');
  assert.equal(statsSection.props.minHeightMobile, '328px');
  assert.equal(statsSection.props.innerMaxWidth, '1440px');
  assert.equal(statsSection.props.innerPaddingX, '80px');
  assert.equal(statsSection.props.innerPaddingXTablet, '147px');
  assert.equal(statsSection.props.innerPaddingXMobile, '20px');
  const statsFrame = layout[statsSection.nodes[0]];
  assert.equal(statsFrame.props.maxWidth, '540px');
  assert.equal(statsFrame.props.maxWidthTablet, '540px');
  assert.equal(statsFrame.props.maxWidthMobile, '350px');
  assert.equal(statsFrame.props.minHeight, '120px');
  assert.equal(statsFrame.props.minHeightTablet, '306px');
  assert.equal(statsFrame.props.minHeightMobile, '274px');
  assert.doesNotMatch(JSON.stringify(layout), /className|rawHtml|rawCss|customCss|zIndex/iu);
});

test('text-only generic measured drafting is unchanged when media controls are absent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-text-only-'));
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const measuredLayout = genericMeasuredLayout({
    label: 'desktop',
    width: 1200,
    height: 800,
    bandHeights: [640],
    bandTags: ['section'],
    bandColors: ['rgb(247, 248, 244)'],
    columns: [1],
  });
  measuredLayout.mediaBoxes = [];
  measuredLayout.meaningfulMediaBoxes = [];
  fs.writeFileSync(path.join(directory, 'reference-layout.json'), JSON.stringify(measuredLayout));

  const brief = {
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  };
  const manifest = {
    sourceUrl: 'file:///tmp/text-only-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  };
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const fullContract = contract();
  const textOnlyContract = JSON.parse(JSON.stringify(fullContract));
  for (const component of textOnlyContract.components.filter(({ name }) => ['Section', 'Container'].includes(name))) {
    component.props = component.props.filter((prop) => !['backgroundImage', 'backgroundSize'].includes(prop));
    component.aiProps = component.aiProps.filter((prop) => !['backgroundImage', 'backgroundSize'].includes(prop));
  }
  const layouts = [];
  for (const [label, contractValue] of [['full', fullContract], ['text-only', textOnlyContract]]) {
    const contractPath = path.join(directory, `contract-${label}.json`);
    const layoutPath = path.join(directory, `layout-${label}.json`);
    fs.writeFileSync(contractPath, JSON.stringify(contractValue));
    const result = spawnSync(process.execPath, [
      draftScript,
      '--contract',
      contractPath,
      '--brief-json',
      briefPath,
      '--out',
      layoutPath,
      '--reference-manifest',
      manifestPath,
      '--json',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    layouts.push(JSON.parse(fs.readFileSync(layoutPath, 'utf8')));
  }

  assert.deepEqual(layouts[1], layouts[0]);
  assert.doesNotMatch(JSON.stringify(layouts[0]), /backgroundImage/);
});

test('generic measured media evidence is bounded and ignores invalid or oversized geometry', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-media-bounds-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const measuredLayout = genericMeasuredLayout({
    label: 'desktop',
    width: 1440,
    height: 900,
    bandHeights: [900],
    bandTags: ['section'],
    bandColors: ['rgb(248, 248, 246)'],
    columns: [4],
  });
  const validMedia = Array.from({ length: 16 }, (_, index) => ({
    tag: 'img',
    source: `https://source.example.test/photo-${index + 1}.jpg`,
    structureKey: `gallery.${index}`,
    rect: measuredRect(40 + (index % 4) * 320, 120 + Math.floor(index / 4) * 180, 240, 140),
    firstViewportArea: 240 * 140,
    objectFit: 'cover',
    objectPosition: index === 0 ? '1000000% 50%' : '50% 50%',
  }));
  const oversized = {
    tag: 'img',
    source: 'https://source.example.test/oversized-photo.jpg',
    structureKey: 'gallery.oversized',
    rect: measuredRect(0, 200, 100000000, 180),
    firstViewportArea: 100000000 * 180,
    objectFit: 'cover',
  };
  const invalid = {
    tag: 'img',
    source: 'https://source.example.test/invalid-photo.jpg',
    structureKey: 'gallery.invalid',
    rect: measuredRect(20, 200, 0, 180),
    firstViewportArea: 0,
    objectFit: 'cover',
  };
  const decorative = {
    tag: 'img',
    source: 'https://source.example.test/texture-photo.jpg',
    structureKey: 'gallery.decorative',
    rect: measuredRect(20, 20, 1400, 860),
    firstViewportArea: 1400 * 860,
    objectFit: 'cover',
  };
  measuredLayout.mediaBoxes = validMedia.concat([oversized, invalid, decorative]);
  measuredLayout.meaningfulMediaBoxes = measuredLayout.mediaBoxes;
  measuredLayout.summary.firstViewportMediaBoxes = measuredLayout.mediaBoxes.length;
  measuredLayout.summary.largestMediaArea = oversized.firstViewportArea;
  fs.writeFileSync(path.join(directory, 'reference-layout.json'), JSON.stringify(measuredLayout));

  const brief = {
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  };
  const manifest = {
    sourceUrl: 'file:///tmp/bounded-media-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  };
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--reference-manifest',
    manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const mediaContainers = Object.values(layout).filter((node) => (
    node?.type?.resolvedName === 'Container' && typeof node.props?.backgroundImage === 'string'
  ));
  assert.equal(mediaContainers.length, 8);
  assert.equal(mediaContainers.every((node) => node.props.width === '100%'), true);
  assert.equal(mediaContainers.every((node) => node.props.maxWidth === '240px'), true);
  assert.equal(mediaContainers.every((node) => node.props.minHeight === '140px'), true);
  assert.equal(mediaContainers.every((node) => node.props.flexShrink === 0), true);
  assert.doesNotMatch(JSON.stringify(layout), /source\.example\.test|100000000|1000000%|oversized-photo|texture-photo/);
});

test('generic measured drafting uses bounded primary font evidence and safe fallbacks', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-font-evidence-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const referenceLayoutPath = path.join(directory, 'reference-layout.json');
  const measuredLayout = genericMeasuredLayout({
    label: 'desktop',
    width: 1200,
    height: 900,
    bandHeights: [80, 620, 220],
    bandTags: ['header', 'section', 'footer'],
    bandColors: ['rgb(255, 255, 255)', 'rgb(246, 248, 250)', 'rgb(20, 27, 34)'],
    columns: [1, 1, 1],
  });
  const fontCases = [
    ['Unknown Inter', 'Inter, ui-sans-serif, system-ui, sans-serif', 'unknown'],
    ['Loaded Poppins', 'Poppins, sans-serif', 'loaded-face'],
    ['Loaded Quoted', '"Plus Jakarta Sans", ui-sans-serif, sans-serif', 'loaded-face'],
    ['Failed Face', 'Unavailable Face, Arial, sans-serif', 'failed-face'],
    ['System Primary', '"Times New Roman", Times, serif', 'system-family'],
    ['No Fallback', 'Unavailable Face', 'unknown'],
    ['Unsafe Source', '@font-face { src: url(https://private.example/source.woff2) }', 'unknown'],
  ];
  measuredLayout.textBoxes = fontCases.map(([text, fontFamily, primaryFontEvidence], index) => ({
    tag: index < 3 ? 'h2' : 'p',
    text,
    rect: measuredRect(80, 120 + (index * 68), 520, 44),
    firstViewportArea: 520 * 44,
    fontSize: index < 3 ? '30px' : '18px',
    fontWeight: index < 3 ? '700' : '400',
    fontFamily,
    primaryFontEvidence,
  }));
  measuredLayout.textBoxes[1].lineHeight = '33.36px';
  measuredLayout.textBoxes[0].fontSize = '112px';
  measuredLayout.textBoxes[0].fontWeight = '850';
  measuredLayout.textBoxes[1].fontWeight = '437.5';
  measuredLayout.textBoxes[2].letterSpacing = '-0.045em';
  measuredLayout.textBoxes[3].fontWeight = '760';
  measuredLayout.textBoxes[3].lineHeight = 'normal';
  measuredLayout.textBoxes[3].letterSpacing = '0.72px';
  measuredLayout.textBoxes[4].letterSpacing = '+0.08em';
  measuredLayout.textBoxes[3].lines = [{
    text: measuredLayout.textBoxes[3].text,
    rect: measuredRect(80, 324, 240, 22),
  }];
  measuredLayout.textBoxes.push({
    tag: 'p',
    text: 'Legacy Evidence',
    rect: measuredRect(80, 596, 520, 44),
    firstViewportArea: 520 * 44,
    fontSize: '18px',
    fontWeight: '400',
    fontFamily: 'Legacy Source Sans, sans-serif',
  });
  measuredLayout.mediaBoxes = [];
  measuredLayout.meaningfulMediaBoxes = [];

  const brief = {
    ...visualBrief({
      target: { variant: 'split-hero', archetype: '', referenceStyle: '' },
      text: { h1: [], h2: [], h3: [], ctas: [], stats: [] },
    }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: {
        kind: 'generic-measured-reference',
        family: '',
        familyMechanics: false,
        source: 'captured-reference-layout',
      },
    },
  };
  const manifest = {
    sourceUrl: 'file:///tmp/font-evidence-reference.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: path.basename(referenceLayoutPath), status: 'ok' }],
  };

  const contractValue = contract();
  const headingContract = contractValue.components.find((component) => component.name === 'Heading');
  headingContract.controls = headingContract.controls.filter((control) => !control.props.includes('fontWeight'));
  headingContract.controls.push({
    type: 'css-value',
    props: ['fontWeight'],
    units: [''],
    min: 1,
    max: 1000,
    step: 0.001,
  });
  headingContract.controls.push({
    type: 'css-value',
    props: ['letterSpacing'],
    units: ['em', 'px'],
    min: -1,
    max: 1,
    step: 0.001,
  });
  headingContract.controls.push({
    type: 'css-value',
    props: ['lineHeight', 'lineHeightTablet', 'lineHeightMobile'],
    units: ['', 'px', 'em', 'rem'],
    step: 0.1,
  });
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(measuredLayout));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const nodeForText = (text) => Object.values(layout).find((node) => node?.props?.text === text);
  assert.equal(nodeForText('Unknown Inter')?.props?.fontFamily, 'system-ui');
  assert.equal(nodeForText('Unknown Inter')?.props?.fontSize, '112px');
  assert.equal(nodeForText('Unknown Inter')?.props?.fontWeight, '850');
  assert.equal(nodeForText('Loaded Poppins')?.props?.fontFamily, 'Poppins');
  assert.equal(nodeForText('Loaded Poppins')?.props?.fontWeight, '437.5');
  assert.equal(nodeForText('Loaded Poppins')?.props?.lineHeight, '33.4px');
  assert.equal(nodeForText('Loaded Quoted')?.props?.fontFamily, 'Plus_Jakarta_Sans');
  assert.equal(nodeForText('Loaded Quoted')?.props?.letterSpacing, '-0.045em');
  assert.equal(nodeForText('Failed Face')?.props?.fontFamily, '_system_Arial');
  assert.equal(nodeForText('Failed Face')?.props?.fontWeight, '760');
  assert.equal(nodeForText('Failed Face')?.props?.lineHeight, '22px');
  assert.equal(nodeForText('Failed Face')?.props?.letterSpacing, '0.04em');
  assert.equal(nodeForText('System Primary')?.props?.fontFamily, '_system_Times');
  assert.equal(nodeForText('System Primary')?.props?.letterSpacing, undefined);
  assert.equal(nodeForText('No Fallback')?.props?.fontFamily, undefined);
  assert.equal(nodeForText('Unsafe Source')?.props?.fontFamily, undefined);
  assert.equal(nodeForText('Legacy Evidence')?.props?.fontFamily, 'Legacy Source Sans, sans-serif');
  assert.match(report.warnings.join(' '), /no authorable system fallback/i);
  assert.doesNotMatch(JSON.stringify(layout), /private\.example|@font-face|src: url/i);
});

test('generic measured drafting maps unequal two-column tracks to bounded proportional controls', () => {
  const runScenario = (name, viewports, mutateContract = null) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `monteby-draft-proportional-${name}-`));
    const contractPath = path.join(directory, 'contract.json');
    const briefPath = path.join(directory, 'visual-brief.json');
    const layoutPath = path.join(directory, 'layout.json');
    const manifestPath = path.join(directory, 'reference-manifest.json');
    const contractValue = contract();
    if (mutateContract) {
      mutateContract(contractValue);
    }
    for (const viewport of viewports) {
      const file = viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`;
      fs.writeFileSync(path.join(directory, file), JSON.stringify(twoColumnGridMeasuredLayout(viewport)));
    }
    fs.writeFileSync(contractPath, JSON.stringify(contractValue));
    fs.writeFileSync(briefPath, JSON.stringify({
      ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
      media: { surfaces: [], requiredRoles: [] },
      authoringRequirements: {
        requiredMediaRoles: [],
        referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
      },
    }));
    fs.writeFileSync(manifestPath, JSON.stringify({
      sourceUrl: 'file:///tmp/owned-proportional-grid.html',
      mediaSurfaces: [],
      requiredMediaRoles: [],
      layouts: viewports.map((viewport) => ({
        label: viewport.label,
        file: viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`,
        status: 'ok',
      })),
    }));

    const result = spawnSync(process.execPath, [
      draftScript,
      '--contract', contractPath,
      '--brief-json', briefPath,
      '--out', layoutPath,
      '--reference-manifest', manifestPath,
      '--preserve-source-text',
      '--json',
    ], { encoding: 'utf8' });
    return {
      result,
      report: result.status === 0 ? JSON.parse(result.stdout) : null,
      layout: result.status === 0 ? JSON.parse(fs.readFileSync(layoutPath, 'utf8')) : null,
    };
  };

  const inherited = runScenario('inherited', [
    { label: 'desktop', width: 1440, height: 900, firstPercent: 46 },
    { label: 'tablet', width: 834, height: 1112, firstPercent: 46 },
    { label: 'mobile', width: 390, height: 844, firstPercent: 46, stacked: true },
  ]);
  assert.equal(inherited.result.status, 0, inherited.result.stderr || inherited.result.stdout);
  const proportional = Object.values(inherited.layout).find((node) => (
    node?.props?.gridTemplateColumns === 'two-proportional'
  ));
  assert.notEqual(proportional, undefined);
  assert.deepEqual({
    desktopToken: proportional.props.gridTemplateColumns,
    tabletToken: proportional.props.gridTemplateColumnsTablet,
    mobileToken: proportional.props.gridTemplateColumnsMobile,
    desktopPercent: proportional.props.gridFirstColumnPercent,
    tabletPercent: proportional.props.gridFirstColumnPercentTablet,
    mobilePercent: proportional.props.gridFirstColumnPercentMobile,
  }, {
    desktopToken: 'two-proportional',
    tabletToken: 'two-proportional',
    mobileToken: 'one',
    desktopPercent: 46,
    tabletPercent: undefined,
    mobilePercent: undefined,
  });
  assert.equal(Number.isInteger(proportional.props.gridFirstColumnPercent), true);
  const proportionalChildren = proportional.nodes.map((nodeId) => inherited.layout[nodeId]);
  assert.deepEqual(proportionalChildren.map((node) => node.props.gridColumnStart), [1, 2]);
  assert.deepEqual(proportionalChildren.map((node) => node.props.gridColumnSpan), [1, 1]);
  for (const child of proportionalChildren) {
    for (const prop of ['gridColumnStart', 'gridColumnSpan', 'gridColumnStartTablet', 'gridColumnSpanTablet', 'gridColumnStartMobile', 'gridColumnSpanMobile']) {
      assert.equal(Number(child.props[prop]) <= 2, true, `${prop} must stay inside the two-track grid`);
    }
  }
  assert.equal(inherited.report.audit.ok, true);
  assert.doesNotMatch(JSON.stringify(inherited.layout), /className|cssId|rawHtml|customCss/iu);

  const responsiveOverride = runScenario('responsive-override', [
    { label: 'desktop', width: 1440, height: 900, firstPercent: 46 },
    { label: 'tablet', width: 834, height: 1112, firstPercent: 54 },
    { label: 'mobile', width: 390, height: 844, firstPercent: 54, stacked: true },
  ]);
  assert.equal(responsiveOverride.result.status, 0, responsiveOverride.result.stderr || responsiveOverride.result.stdout);
  const responsiveGrid = Object.values(responsiveOverride.layout).find((node) => node?.props?.gridTemplateColumns === 'two-proportional');
  assert.equal(responsiveGrid.props.gridFirstColumnPercent, 46);
  assert.equal(responsiveGrid.props.gridFirstColumnPercentTablet, 54);
  assert.equal(responsiveGrid.props.gridFirstColumnPercentMobile, undefined);
  assert.equal(responsiveGrid.props.gridTemplateColumnsMobile, 'one');

  for (const scenario of [
    { name: 'reverse', viewport: { label: 'desktop', width: 1440, height: 900, firstPercent: 54 }, token: 'two-proportional', percent: 54 },
    { name: 'equal', viewport: { label: 'desktop', width: 1440, height: 900, firstPercent: 50 }, token: 'two', percent: undefined },
    { name: 'sidebar', viewport: { label: 'desktop', width: 1184, height: 900, fixedLeftWidth: 320 }, token: 'sidebar-left-320', percent: undefined },
  ]) {
    const drafted = runScenario(scenario.name, [scenario.viewport]);
    assert.equal(drafted.result.status, 0, drafted.result.stderr || drafted.result.stdout);
    const grid = Object.values(drafted.layout).find((node) => node?.props?.gridTemplateColumns === scenario.token);
    assert.notEqual(grid, undefined, scenario.name);
    assert.equal(grid.props.gridFirstColumnPercent, scenario.percent, scenario.name);
    assert.equal(drafted.report.audit.ok, true, scenario.name);
  }

  const missingContract = runScenario(
    'missing-contract',
    [{ label: 'desktop', width: 1440, height: 900, firstPercent: 46 }],
    (contractValue) => {
      const container = contractValue.components.find((component) => component.name === 'Container');
      container.props = container.props.filter((prop) => prop !== 'gridFirstColumnPercent');
      container.aiProps = container.aiProps.filter((prop) => prop !== 'gridFirstColumnPercent');
      container.controls = container.controls.map((control) => ({
        ...control,
        props: Array.isArray(control.props)
          ? control.props.filter((prop) => prop !== 'gridFirstColumnPercent')
          : control.props,
        options: Array.isArray(control.options)
          ? control.options.filter((option) => option !== 'two-proportional')
          : control.options,
      }));
    }
  );
  assert.equal(missingContract.result.status, 1);
  assert.match(
    `${missingContract.result.stdout}\n${missingContract.result.stderr}`,
    /\[generic_proportional_grid_control_gap\].*gridTemplateColumns option two-proportional.*gridFirstColumnPercent/s
  );
});

test('generic measured drafting preserves intentional Heading and Text vertical margins', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-measured-text-margins-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const viewportDefinitions = [
    { label: 'desktop', width: 1440, height: 900, offsets: [40, 140, 240], margins: [[28, 18], [56, 12], [14, 20]] },
    { label: 'tablet', width: 834, height: 1112, offsets: [40, 150, 245], margins: [[28, 18], [44, 12], [14, 20]] },
    { label: 'mobile', width: 390, height: 844, offsets: [40, 135, 230], margins: [[20, 16], [44, 12], [10, 18]] },
  ];

  for (const viewport of viewportDefinitions) {
    const measuredLayout = twoColumnGridMeasuredLayout({
      label: viewport.label,
      width: viewport.width,
      height: viewport.height,
      firstPercent: 50,
      stacked: viewport.label === 'mobile',
    });
    const firstGroup = measuredLayout.layoutGroups.find((group) => group.key === '0.0.0');
    const distributedGroup = measuredLayout.layoutGroups.find((group) => group.key === '0.0.1');
    firstGroup.gap = '12px';
    distributedGroup.display = 'flex';
    distributedGroup.flexDirection = 'column';
    distributedGroup.justifyContent = 'space-between';
    distributedGroup.gap = '0px';
    measuredLayout.textBoxes = [
      ['h1', 'Measured page heading', 0, 72],
      ['h3', 'Measured tile heading', 1, 34],
      ['p', 'Measured supporting body copy.', 2, 26],
    ].map(([tag, text, index, boxHeight]) => ({
      parentGroupKey: '0.0.0',
      structureKey: `0.0.0.${index}`,
      tag,
      text,
      rect: measuredRect(firstGroup.rect.left + 20, firstGroup.rect.top + viewport.offsets[index], Math.max(80, firstGroup.rect.width - 40), boxHeight),
      fontSize: tag === 'h1' ? '56px' : tag === 'h3' ? '30px' : '16px',
      fontWeight: tag === 'p' ? '400' : '700',
      lineHeight: `${boxHeight}px`,
      marginTop: `${viewport.margins[index][0]}px`,
      marginBottom: `${viewport.margins[index][1]}px`,
      paddingTop: '0px',
      paddingBottom: '0px',
      color: 'rgb(24, 32, 27)',
    })).concat([
      {
        parentGroupKey: '0.0.1',
        structureKey: '0.0.1.0',
        tag: 'span',
        text: 'Distributed label',
        rect: measuredRect(distributedGroup.rect.left + 20, distributedGroup.rect.top + 20, 180, 20),
        fontSize: '14px',
        fontWeight: '600',
        lineHeight: '20px',
        marginTop: '0px',
        marginBottom: '0px',
        color: 'rgb(24, 32, 27)',
      },
      {
        parentGroupKey: '0.0.1',
        structureKey: '0.0.1.1',
        tag: 'h2',
        text: 'Distributed heading',
        rect: measuredRect(distributedGroup.rect.left + 20, distributedGroup.rect.bottom - 60, Math.max(80, distributedGroup.rect.width - 40), 40),
        fontSize: '34px',
        fontWeight: '700',
        lineHeight: '40px',
        marginTop: '120px',
        marginBottom: '0px',
        color: 'rgb(24, 32, 27)',
      },
    ]);
    const file = viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/owned-measured-text-margins.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewportDefinitions.map((viewport) => ({
      label: viewport.label,
      file: viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const pageHeading = Object.values(layout).find((node) => node?.props?.text === 'Measured page heading');
  const tileHeading = Object.values(layout).find((node) => node?.props?.text === 'Measured tile heading');
  const body = Object.values(layout).find((node) => node?.props?.text === 'Measured supporting body copy.');
  const distributedHeading = Object.values(layout).find((node) => node?.props?.text === 'Distributed heading');
  const firstGroup = layout[tileHeading.parent];
  const measuredParent = layout[firstGroup.parent];

  assert.deepEqual({
    top: pageHeading.props.marginTop,
    bottom: pageHeading.props.marginBottom,
    topTablet: pageHeading.props.marginTopTablet,
    topMobile: pageHeading.props.marginTopMobile,
    bottomMobile: pageHeading.props.marginBottomMobile,
  }, { top: '0px', bottom: '0px', topTablet: undefined, topMobile: undefined, bottomMobile: undefined });
  assert.deepEqual({
    top: tileHeading.props.marginTop,
    bottom: tileHeading.props.marginBottom,
    topTablet: tileHeading.props.marginTopTablet,
    topMobile: tileHeading.props.marginTopMobile,
  }, { top: '16px', bottom: '0px', topTablet: '26px', topMobile: '11px' });
  assert.deepEqual({
    top: body.props.marginTop,
    bottom: body.props.marginBottom,
    topTablet: body.props.marginTopTablet,
    topMobile: body.props.marginTopMobile,
    bottomMobile: body.props.marginBottomMobile,
  }, { top: '54px', bottom: '0px', topTablet: '49px', topMobile: undefined, bottomMobile: undefined });
  assert.equal(firstGroup.props.paddingTop, '0px');
  assert.equal(measuredParent.props.gap, '12px');
  assert.equal(distributedHeading.props.marginTop, '0px');
  assert.equal(report.audit.ok, true);
  assert.doesNotMatch(JSON.stringify(layout), /className|cssId|rawHtml|customCss/iu);
});

test('generic measured drafting authors Container-only horizontal text offsets with responsive inheritance', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-measured-text-insets-'));
  const contractPath = path.join(directory, 'contract.json');
  const missingContractPath = path.join(directory, 'contract-missing-margin-controls.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const missingLayoutPath = path.join(directory, 'layout-missing-margin-controls.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const viewportDefinitions = [
    {
      label: 'desktop', width: 1440, height: 900,
      groupRect: measuredRect(20, 80, 1400, 520),
      paddingLeft: 80, paddingRight: 80,
      headingOffset: 255, leadOffset: 545.6, noteOffset: 0,
      headingWidth: 760, leadWidth: 470, noteWidth: 620,
    },
    {
      label: 'tablet', width: 834, height: 1112,
      groupRect: measuredRect(20, 80, 794, 480),
      paddingLeft: 0, paddingRight: 0,
      headingOffset: 0, leadOffset: 0, noteOffset: 120,
      headingWidth: 700, leadWidth: 470, noteWidth: 520,
    },
    {
      label: 'mobile', width: 390, height: 844,
      groupRect: measuredRect(20, 64, 350, 430),
      paddingLeft: 0, paddingRight: 0,
      headingOffset: 0, leadOffset: 0, noteOffset: 0,
      headingWidth: 350, leadWidth: 350, noteWidth: 350,
    },
  ];

  for (const viewport of viewportDefinitions) {
    const sectionHeight = viewport.groupRect.bottom + 80;
    const headingRect = measuredRect(
      viewport.groupRect.left + viewport.paddingLeft + viewport.headingOffset,
      viewport.groupRect.top + 40,
      viewport.headingWidth,
      viewport.label === 'mobile' ? 116 : 150
    );
    const leadRect = measuredRect(
      viewport.groupRect.left + viewport.paddingLeft + viewport.leadOffset,
      headingRect.bottom + 32,
      viewport.leadWidth,
      viewport.label === 'mobile' ? 76 : 56
    );
    const noteRect = measuredRect(
      viewport.groupRect.left + viewport.paddingLeft + viewport.noteOffset,
      leadRect.bottom + 32,
      viewport.noteWidth,
      viewport.label === 'mobile' ? 52 : 40
    );
    fs.writeFileSync(
      path.join(directory, viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`),
      JSON.stringify({
        capturedAt: '2026-07-16T00:00:00.000Z',
        label: viewport.label,
        url: 'file:///tmp/generated-lumen-text-insets.html',
        viewport: { width: viewport.width, height: viewport.height, scrollWidth: viewport.width, scrollHeight: sectionHeight },
        horizontalOverflow: { overflowPx: 0, documentScrollWidth: viewport.width },
        documentStyle: { backgroundColor: 'rgb(247, 250, 246)', color: 'rgb(24, 51, 45)' },
        landmarks: [{
          tag: 'section',
          groupKey: '0',
          rect: measuredRect(0, 0, viewport.width, sectionHeight),
          backgroundColor: 'rgb(247, 250, 246)',
        }],
        layoutGroups: [{
          key: '0.0',
          parentKey: '0',
          tag: 'div',
          rect: viewport.groupRect,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingLeft: `${viewport.paddingLeft}px`,
          paddingRight: `${viewport.paddingRight}px`,
        }],
        textBoxes: [
          {
            parentGroupKey: '0.0', structureKey: '0.0.0', tag: 'h1', text: 'Measured editorial heading',
            rect: headingRect, fontSize: viewport.label === 'mobile' ? '54px' : '96px', fontWeight: '500',
            lineHeight: '0.99', marginLeft: `${viewport.headingOffset}px`, color: 'rgb(24, 51, 45)',
          },
          {
            parentGroupKey: '0.0', structureKey: '0.0.1', tag: 'p', text: 'Measured editorial lead copy.',
            rect: leadRect, fontSize: viewport.label === 'mobile' ? '16px' : '18px', fontWeight: '600',
            lineHeight: '1.55', marginLeft: `${viewport.leadOffset}px`, color: 'rgb(24, 51, 45)',
          },
          {
            parentGroupKey: '0.0', structureKey: '0.0.2', tag: 'p', text: 'Responsive inset note.',
            rect: noteRect, fontSize: '14px', fontWeight: '500',
            lineHeight: '1.4', marginLeft: `${viewport.noteOffset}px`, color: 'rgb(24, 51, 45)',
          },
        ],
        interactions: [],
        mediaBoxes: [],
        meaningfulMediaBoxes: [],
        summary: { firstViewportTextBoxes: 3, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
      })
    );
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      preserveSourceText: true,
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-lumen-text-insets.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewportDefinitions.map(({ label }) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const heading = Object.values(layout).find((node) => node?.props?.text === 'Measured editorial heading');
  const lead = Object.values(layout).find((node) => node?.props?.text === 'Measured editorial lead copy.');
  const note = Object.values(layout).find((node) => node?.props?.text === 'Responsive inset note.');
  const headingWrapper = layout[heading.parent];
  const leadWrapper = layout[lead.parent];
  const noteWrapper = layout[note.parent];
  const measuredGroup = layout[headingWrapper.parent];

  assert.equal(headingWrapper.type.resolvedName, 'Container');
  assert.deepEqual({
    desktop: headingWrapper.props.marginLeft,
    tablet: headingWrapper.props.marginLeftTablet,
    mobile: headingWrapper.props.marginLeftMobile,
  }, { desktop: '255px', tablet: '0px', mobile: undefined });
  assert.deepEqual({
    desktop: leadWrapper.props.marginLeft,
    tablet: leadWrapper.props.marginLeftTablet,
    mobile: leadWrapper.props.marginLeftMobile,
  }, { desktop: '545.6px', tablet: '0px', mobile: undefined });
  assert.deepEqual({
    desktop: noteWrapper.props.marginLeft,
    tablet: noteWrapper.props.marginLeftTablet,
    mobile: noteWrapper.props.marginLeftMobile,
  }, { desktop: '0px', tablet: '120px', mobile: '0px' });
  assert.equal(measuredGroup.props.paddingLeft, '80px');
  assert.equal(headingWrapper.props.paddingLeft, undefined);
  assert.equal(leadWrapper.props.paddingLeft, undefined);
  assert.equal(noteWrapper.props.paddingLeft, undefined);
  assert.equal(heading.props.marginLeft, undefined);
  assert.equal(lead.props.marginLeft, undefined);
  assert.equal(note.props.marginLeft, undefined);
  assert.equal(layout.ROOT.nodes.every((nodeId) => layout[nodeId].props.marginLeft === undefined), true);

  const missingContract = contract();
  const missingContainer = missingContract.components.find((component) => component.name === 'Container');
  const horizontalMarginProps = new Set(['marginLeft', 'marginLeftTablet', 'marginLeftMobile']);
  missingContainer.controls = missingContainer.controls.map((control) => ({
    ...control,
    props: Array.isArray(control.props)
      ? control.props.filter((prop) => !horizontalMarginProps.has(prop))
      : control.props,
  }));
  fs.writeFileSync(missingContractPath, JSON.stringify(missingContract));
  const missingResult = spawnSync(process.execPath, [
    draftScript, '--contract', missingContractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', missingLayoutPath, '--json',
  ], { encoding: 'utf8' });

  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /\[generic_text_horizontal_margin_control_gap\] Container\.marginLeft is required by the measured band plan/u);
  assert.match(missingResult.stderr, /\[generic_text_horizontal_margin_control_gap\] Container\.marginLeftTablet is required by the measured band plan/u);
  assert.match(missingResult.stderr, /\[generic_text_horizontal_margin_control_gap\] Container\.marginLeftMobile is required by the measured band plan/u);
  assert.equal(fs.existsSync(missingLayoutPath), false);
});

test('generic measured drafting uses one MultilineHeading for stable deliberate line offsets only when nested controls exist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-measured-multiline-heading-'));
  const contractPath = path.join(directory, 'contract.json');
  const missingContractPath = path.join(directory, 'contract-missing-line-offset.json');
  const incompleteUnitsContractPath = path.join(directory, 'contract-incomplete-line-offset-units.json');
  const unsignedContractPath = path.join(directory, 'contract-unsigned-line-offset.json');
  const boundedContractPath = path.join(directory, 'contract-bounded-line-offset.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout.json');
  const missingLayoutPath = path.join(directory, 'layout-fallback.json');
  const incompleteUnitsLayoutPath = path.join(directory, 'layout-incomplete-units-fallback.json');
  const unsignedLayoutPath = path.join(directory, 'layout-unsigned-fallback.json');
  const boundedLayoutPath = path.join(directory, 'layout-bounded-fallback.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const viewports = [
    {
      label: 'desktop', width: 1440, height: 900, headingRect: measuredRect(100, 120, 860, 368),
      headingLines: [
        ['Clear Vision.', measuredRect(100, 108, 566, 146)],
        ['Open', measuredRect(276, 231, 264, 146)],
        ['Horizons.', measuredRect(276, 354, 436, 146)],
      ],
      naturalRect: measuredRect(100, 560, 520, 110),
      naturalLines: [
        ['Natural wrapping remains', measuredRect(100, 556, 510, 58)],
        ['an ordinary heading.', measuredRect(100, 610, 430, 58)],
      ],
      headingSize: '124px', naturalSize: '48px',
    },
    {
      label: 'tablet', width: 834, height: 1112, headingRect: measuredRect(20, 120, 794, 162),
      headingLines: [
        ['Clear Vision.', measuredRect(20, 112, 375, 96)],
        ['Open Horizons.', measuredRect(20, 193, 475, 96)],
      ],
      naturalRect: measuredRect(20, 380, 620, 94),
      naturalLines: [
        ['Natural wrapping remains', measuredRect(20, 376, 490, 50)],
        ['an ordinary heading.', measuredRect(20, 422, 410, 50)],
      ],
      headingSize: '82px', naturalSize: '42px',
    },
    {
      label: 'mobile', width: 390, height: 844, headingRect: measuredRect(20, 96, 350, 115),
      headingLines: [
        ['Clear Vision.', measuredRect(20, 90, 269, 68)],
        ['Open Horizons.', measuredRect(44, 147, 316, 68)],
      ],
      naturalRect: measuredRect(20, 300, 350, 82),
      naturalLines: [
        ['Natural wrapping remains', measuredRect(20, 296, 340, 44)],
        ['an ordinary heading.', measuredRect(20, 336, 320, 44)],
      ],
      headingSize: '58px', naturalSize: '36px',
    },
  ];

  for (const viewport of viewports) {
    const pageHeight = viewport.naturalRect.bottom + 100;
    const file = viewport.label === 'desktop' ? 'reference-layout.json' : `reference-layout-${viewport.label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify({
      capturedAt: '2026-07-16T00:00:00.000Z',
      label: viewport.label,
      url: 'file:///tmp/generated-deliberate-multiline-heading.html',
      viewport: { width: viewport.width, height: viewport.height, scrollWidth: viewport.width, scrollHeight: pageHeight },
      horizontalOverflow: { overflowPx: 0, documentScrollWidth: viewport.width },
      documentStyle: { backgroundColor: 'rgb(247, 250, 246)', color: 'rgb(24, 51, 45)' },
      landmarks: [{
        tag: 'section', groupKey: '0', rect: measuredRect(0, 0, viewport.width, pageHeight),
        backgroundColor: 'rgb(247, 250, 246)',
      }],
      layoutGroups: [{
        key: '0.0', parentKey: '0', tag: 'div', rect: measuredRect(20, 60, viewport.width - 40, pageHeight - 100),
        display: 'flex', flexDirection: 'column', gap: '24px', paddingLeft: '0px', paddingRight: '0px',
      }],
      textBoxes: [
        {
          parentGroupKey: '0.0', structureKey: '0.0.0', tag: 'h1', text: 'Clear Vision. Open Horizons.',
          textAlign: 'start', rect: viewport.headingRect, lines: viewport.headingLines.map(([text, rect]) => ({ text, rect })),
          fontSize: viewport.headingSize, fontWeight: '500', fontFamily: 'Inter, sans-serif', lineHeight: '0.99',
          marginTop: '0px', marginBottom: '0px', color: 'rgb(24, 51, 45)',
        },
        {
          parentGroupKey: '0.0', structureKey: '0.0.1', tag: 'h2', text: 'Natural wrapping remains an ordinary heading.',
          textAlign: 'start', rect: viewport.naturalRect, lines: viewport.naturalLines.map(([text, rect]) => ({ text, rect })),
          fontSize: viewport.naturalSize, fontWeight: '600', fontFamily: 'Inter, sans-serif', lineHeight: '1.08',
          marginTop: '0px', marginBottom: '0px', color: 'rgb(24, 51, 45)',
        },
      ],
      interactions: [], mediaBoxes: [], meaningfulMediaBoxes: [],
      summary: { firstViewportTextBoxes: 2, firstViewportMediaBoxes: 0, firstViewportMediaCoverage: 0 },
    }));
  }

  const fullContract = contract();
  const multilineProps = [
    'lines', 'tag', 'fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet',
    'lineHeightMobile', 'letterSpacing', 'letterSpacingTablet', 'letterSpacingMobile', 'fontWeight',
    'fontFamily', 'textAlign', 'marginTop', 'marginBottom', 'text', 'color', 'marginLeft',
    'marginLeftTablet', 'marginLeftMobile',
  ];
  fullContract.components.push({
    name: 'MultilineHeading',
    allowedParents: ['Section', 'Container'],
    props: multilineProps,
    aiProps: multilineProps,
    controls: [{
      type: 'repeater',
      props: ['lines'],
      minItems: 1,
      maxItems: 12,
      itemControls: [
        { type: 'text', props: ['text'] },
        { type: 'color', props: ['color'] },
        {
          type: 'css-value',
          props: ['marginLeft', 'marginLeftTablet', 'marginLeftMobile'],
          units: ['px', 'rem', 'em', 'vw', '%'],
          min: -9999,
        },
      ],
    }],
  });
  fs.writeFileSync(contractPath, JSON.stringify(fullContract));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      preserveSourceText: true,
      requiredMediaRoles: [],
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/generated-deliberate-multiline-heading.html',
    mediaSurfaces: [], requiredMediaRoles: [],
    layouts: viewports.map(({ label }) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript, '--contract', contractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', layoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const multiline = Object.values(layout).find((node) => node?.type?.resolvedName === 'MultilineHeading');
  const ordinary = Object.values(layout).find((node) => node?.props?.text === 'Natural wrapping remains an ordinary heading.');

  assert.equal(multiline.props.tag, 'h1');
  assert.deepEqual(multiline.props.lines, [
    { text: 'Clear Vision.', color: 'rgb(24, 51, 45)', marginLeft: '0px' },
    {
      text: 'Open Horizons.',
      color: 'rgb(24, 51, 45)',
      marginLeft: '176px',
      marginLeftTablet: '0px',
      marginLeftMobile: '24px',
    },
  ]);
  assert.equal(ordinary.type.resolvedName, 'Heading');
  assert.equal(Object.values(layout).filter((node) => node?.type?.resolvedName === 'MultilineHeading').length, 1);

  const missingContract = JSON.parse(JSON.stringify(fullContract));
  const missingMultiline = missingContract.components.find((component) => component.name === 'MultilineHeading');
  missingMultiline.controls[0].itemControls[2].props = ['marginLeft', 'marginLeftTablet'];
  fs.writeFileSync(missingContractPath, JSON.stringify(missingContract));
  const missingResult = spawnSync(process.execPath, [
    draftScript, '--contract', missingContractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', missingLayoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingResult.status, 0, missingResult.stderr || missingResult.stdout);
  const fallbackLayout = JSON.parse(fs.readFileSync(missingLayoutPath, 'utf8'));
  const fallbackHeading = Object.values(fallbackLayout).find((node) => node?.props?.text === 'Clear Vision. Open Horizons.');
  assert.equal(fallbackHeading.type.resolvedName, 'Heading');
  assert.equal(Object.values(fallbackLayout).some((node) => node?.type?.resolvedName === 'MultilineHeading'), false);

  const incompleteUnitsContract = JSON.parse(JSON.stringify(fullContract));
  const incompleteUnitsMultiline = incompleteUnitsContract.components.find((component) => component.name === 'MultilineHeading');
  incompleteUnitsMultiline.controls[0].itemControls[2].units = ['px', 'rem', 'em', 'vw'];
  fs.writeFileSync(incompleteUnitsContractPath, JSON.stringify(incompleteUnitsContract));
  const incompleteUnitsResult = spawnSync(process.execPath, [
    draftScript, '--contract', incompleteUnitsContractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', incompleteUnitsLayoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(incompleteUnitsResult.status, 0, incompleteUnitsResult.stderr || incompleteUnitsResult.stdout);
  const incompleteUnitsLayout = JSON.parse(fs.readFileSync(incompleteUnitsLayoutPath, 'utf8'));
  assert.equal(Object.values(incompleteUnitsLayout).some((node) => node?.type?.resolvedName === 'MultilineHeading'), false);

  const unsignedContract = JSON.parse(JSON.stringify(fullContract));
  const unsignedMultiline = unsignedContract.components.find((component) => component.name === 'MultilineHeading');
  unsignedMultiline.controls[0].itemControls[2].min = 0;
  fs.writeFileSync(unsignedContractPath, JSON.stringify(unsignedContract));
  const unsignedResult = spawnSync(process.execPath, [
    draftScript, '--contract', unsignedContractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', unsignedLayoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(unsignedResult.status, 0, unsignedResult.stderr || unsignedResult.stdout);
  const unsignedLayout = JSON.parse(fs.readFileSync(unsignedLayoutPath, 'utf8'));
  assert.equal(Object.values(unsignedLayout).some((node) => node?.type?.resolvedName === 'MultilineHeading'), false);

  const boundedContract = JSON.parse(JSON.stringify(fullContract));
  const boundedMultiline = boundedContract.components.find((component) => component.name === 'MultilineHeading');
  boundedMultiline.controls[0].itemControls[2].max = 100;
  fs.writeFileSync(boundedContractPath, JSON.stringify(boundedContract));
  const boundedResult = spawnSync(process.execPath, [
    draftScript, '--contract', boundedContractPath, '--brief-json', briefPath,
    '--reference-manifest', manifestPath, '--out', boundedLayoutPath, '--json',
  ], { encoding: 'utf8' });
  assert.equal(boundedResult.status, 0, boundedResult.stderr || boundedResult.stdout);
  const boundedLayout = JSON.parse(fs.readFileSync(boundedLayoutPath, 'utf8'));
  const boundedFallback = Object.values(boundedLayout).find((node) => node?.props?.text === 'Clear Vision. Open Horizons.');
  assert.equal(boundedFallback.type.resolvedName, 'Heading');
  assert.equal(Object.values(boundedLayout).some((node) => node?.type?.resolvedName === 'MultilineHeading'), false);
});

test('generic measured drafting preserves narrow grid tracks and maps top-only borders through Divider', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-grid-divider-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const flexibleLabel = 'sites-with-an-intentionally-long-unbroken-min-content-token';
  const viewports = [
    ['desktop', 1440, 900, 272],
    ['tablet', 834, 1112, 746],
    ['mobile', 390, 844, 302],
  ];

  for (const [label, width, height, rowWidth] of viewports) {
    const measuredLayout = genericMeasuredLayout({
      label,
      width,
      height,
      bandHeights: [100, 700, 100],
      bandTags: ['header', 'section', 'footer'],
      bandColors: ['rgb(248, 249, 246)', 'rgb(24, 32, 27)', 'rgb(248, 249, 246)'],
      columns: [1, 1, 1],
    });
    const section = measuredLayout.landmarks.find((landmark) => landmark.tag === 'section');
    const header = measuredLayout.landmarks.find((landmark) => landmark.tag === 'header');
    const rowLeft = label === 'desktop' ? 160 : label === 'tablet' ? 44 : 44;
    const rowTop = 150;
    const cardTop = rowTop + 110;
    section.groupKey = '0.1';
    section.display = 'flex';
    section.flexDirection = 'column';
    header.borderTopWidth = '0px';
    header.borderRightWidth = '0px';
    header.borderBottomWidth = '1px';
    header.borderLeftWidth = '0px';
    header.borderTopColor = 'rgb(24, 32, 27)';
    header.borderRightColor = 'rgb(24, 32, 27)';
    header.borderBottomColor = 'rgba(24, 32, 27, 0.18)';
    header.borderLeftColor = 'rgb(24, 32, 27)';
    measuredLayout.layoutGroups = [
      {
        key: '0.1.0',
        parentKey: '0.1',
        tag: 'div',
        rect: measuredRect(rowLeft, rowTop, rowWidth, 73),
        display: 'grid',
        alignItems: 'baseline',
        gap: '16px',
        paddingTop: '18px',
        paddingRight: '0px',
        paddingBottom: '18px',
        paddingLeft: '0px',
        borderTopWidth: '1px',
        borderRightWidth: '0px',
        borderBottomWidth: '0px',
        borderLeftWidth: '0px',
        borderTopColor: 'rgba(255, 255, 255, 0.22)',
        borderRightColor: 'rgb(255, 255, 255)',
        borderBottomColor: 'rgb(255, 255, 255)',
        borderLeftColor: 'rgb(255, 255, 255)',
        boxShadow: 'rgba(15, 23, 42, 0.16) 0px 34px 70px 0px',
        backgroundColor: 'rgba(0, 0, 0, 0)',
      },
      {
        key: '0.1.1',
        parentKey: '0.1',
        tag: 'article',
        rect: measuredRect(rowLeft, cardTop, rowWidth, 360),
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        paddingTop: '26px',
        paddingRight: '26px',
        paddingBottom: '26px',
        paddingLeft: '26px',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopColor: 'rgba(24, 32, 27, 0.12)',
        borderRightColor: 'rgba(24, 32, 27, 0.12)',
        borderBottomColor: 'rgba(24, 32, 27, 0.12)',
        borderLeftColor: 'rgba(24, 32, 27, 0.12)',
        backgroundColor: 'rgb(255, 255, 255)',
      },
    ];
    measuredLayout.textBoxes = measuredLayout.textBoxes.filter((box) => (
      box.rect.bottom <= section.rect.top || box.rect.top >= section.rect.bottom
    ));
    measuredLayout.textBoxes.push(
      {
        parentGroupKey: '0.1.0',
        structureKey: '0.1.0.0',
        tag: 'strong',
        text: '31',
        rect: measuredRect(rowLeft, rowTop + 19, 82, 36),
        fontSize: '36px',
        fontWeight: '700',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        primaryFontEvidence: 'unknown',
        lineHeight: '36px',
        color: 'rgb(255, 255, 255)',
      },
      {
        parentGroupKey: '0.1.0',
        structureKey: '0.1.0.1',
        tag: 'span',
        text: flexibleLabel,
        rect: measuredRect(rowLeft + 98, rowTop + 28, rowWidth - 98, 18),
        fontSize: '14px',
        fontWeight: '400',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        primaryFontEvidence: 'unknown',
        lineHeight: '18px',
        color: 'rgba(255, 255, 255, 0.72)',
      },
      {
        parentGroupKey: '0.1.1',
        structureKey: '0.1.1.0',
        tag: 'span',
        text: '01',
        rect: measuredRect(rowLeft + 26, cardTop + 26, rowWidth - 52, 18),
        fontSize: '16px',
        fontWeight: '900',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        primaryFontEvidence: 'unknown',
        lineHeight: '18px',
        color: 'rgb(20, 78, 67)',
        marginTop: '0px',
        marginBottom: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
      },
      {
        parentGroupKey: '0.1.1',
        structureKey: '0.1.1.1',
        tag: 'h3',
        text: 'Measured feature',
        rect: measuredRect(rowLeft + 26, cardTop + 150, rowWidth - 52, 29.4),
        fontSize: '28px',
        fontWeight: '700',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        primaryFontEvidence: 'unknown',
        lineHeight: '29.4px',
        color: 'rgb(24, 32, 27)',
        marginTop: '50px',
        marginBottom: '12px',
        paddingTop: '0px',
        paddingBottom: '0px',
      },
      {
        parentGroupKey: '0.1.1',
        structureKey: '0.1.1.2',
        tag: 'p',
        text: 'Measured feature description.',
        rect: measuredRect(rowLeft + 26, cardTop + 281, rowWidth - 52, 53),
        fontSize: '16px',
        fontWeight: '400',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        primaryFontEvidence: 'unknown',
        lineHeight: '26.4px',
        color: 'rgb(93, 102, 92)',
        marginTop: '0px',
        marginBottom: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
      }
    );
    measuredLayout.mediaBoxes = [];
    measuredLayout.meaningfulMediaBoxes = [];
    const file = label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(measuredLayout));
  }

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/owned-grid-divider.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(([label]) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const value = Object.values(layout).find((node) => node?.props?.text === '31');
  const flexible = Object.values(layout).find((node) => node?.props?.text === flexibleLabel);
  const headerSection = layout[layout.ROOT.nodes[0]];
  const headerDivider = layout[headerSection.nodes.at(-1)];
  const valueWrapper = layout[value.parent];
  const flexibleWrapper = layout[flexible.parent];
  const content = layout[valueWrapper.parent];
  const shell = layout[content.parent];
  const divider = layout[shell.nodes[0]];
  const featureHeading = Object.values(layout).find((node) => node?.props?.text === 'Measured feature');
  const featureHeadingWrapper = layout[featureHeading.parent];
  const featureGroup = layout[featureHeadingWrapper.parent];
  assert.equal(content.props.layoutDisplay, 'flex');
  assert.equal(headerDivider.type.resolvedName, 'Divider');
  assert.equal(headerDivider.props.dividerColor, 'rgba(24, 32, 27, 0.18)');
  assert.equal(content.props.flexDirection, 'row');
  assert.equal(content.props.flexDirectionTablet, 'row');
  assert.equal(content.props.flexDirectionMobile, 'row');
  assert.equal(content.props.gap, '16px');
  assert.equal(valueWrapper.props.width, '82px');
  assert.equal(valueWrapper.props.minWidth, '82px');
  assert.equal(valueWrapper.props.flexBasis, '82px');
  assert.equal(valueWrapper.props.flexShrink, 0);
  assert.equal(flexibleWrapper.props.minWidth, '0px');
  assert.equal(flexibleWrapper.props.flexBasis, '0px');
  assert.equal(flexibleWrapper.props.flexGrow, 1);
  assert.equal(flexibleWrapper.props.flexShrink, 1);
  assert.equal(shell.props.borderWidth, undefined);
  assert.equal(shell.props.background, undefined);
  assert.equal(shell.props.backgroundColor, undefined);
  assert.deepEqual({
    boxShadowOffsetX: shell.props.boxShadowOffsetX,
    boxShadowOffsetY: shell.props.boxShadowOffsetY,
    boxShadowBlur: shell.props.boxShadowBlur,
    boxShadowSpread: shell.props.boxShadowSpread,
    boxShadowColor: shell.props.boxShadowColor,
    boxShadowInset: shell.props.boxShadowInset,
  }, {
    boxShadowOffsetX: '0px',
    boxShadowOffsetY: '34px',
    boxShadowBlur: '70px',
    boxShadowSpread: '0px',
    boxShadowColor: 'rgba(15, 23, 42, 0.16)',
    boxShadowInset: false,
  });
  assert.equal(divider.type.resolvedName, 'Divider');
  assert.deepEqual(divider.props, {
    dividerWidth: '100%',
    dividerThickness: '1px',
    dividerStyle: 'solid',
    dividerColor: 'rgba(255, 255, 255, 0.22)',
    dividerAlign: 'left',
    dividerMargin: '0px',
  });
  assert.equal(featureHeadingWrapper.props.paddingTop, '0px');
  assert.equal(featureHeadingWrapper.props.paddingTopTablet, '0px');
  assert.equal(featureHeadingWrapper.props.paddingTopMobile, '0px');
  assert.equal(featureHeadingWrapper.props.paddingBottom, '0px');
  assert.equal(featureHeading.props.marginTop, '0px');
  assert.equal(featureHeading.props.marginBottom, '0px');
  assert.equal(featureGroup.props.borderWidth, '1px');
  assert.equal(featureGroup.props.borderColor, 'rgba(24, 32, 27, 0.12)');

  const missingFixedContractPath = path.join(directory, 'contract-missing-fixed-controls.json');
  const missingFixedContract = contract();
  const missingFixedContainer = missingFixedContract.components.find((component) => component.name === 'Container');
  const missingFixedControls = new Set(['minWidth', 'flexShrink']);
  missingFixedContainer.controls = missingFixedContainer.controls
    .map((control) => {
      if (!Array.isArray(control.props)) {
        return control;
      }
      const props = control.props.filter((prop) => !missingFixedControls.has(prop));
      return props.length > 0 ? { ...control, props } : null;
    })
    .filter(Boolean);
  fs.writeFileSync(missingFixedContractPath, JSON.stringify(missingFixedContract));
  const missingFixedResult = spawnSync(process.execPath, [
    draftScript,
    '--contract', missingFixedContractPath,
    '--brief-json', briefPath,
    '--out', path.join(directory, 'layout-missing-fixed-controls.json'),
    '--reference-manifest', manifestPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingFixedResult.status, 1);
  assert.match(`${missingFixedResult.stdout}\n${missingFixedResult.stderr}`, /\[generic_fixed_track_control_gap\].*Container\.minWidth/s);
  assert.match(`${missingFixedResult.stdout}\n${missingFixedResult.stderr}`, /\[generic_fixed_track_control_gap\].*Container\.flexShrink/s);

  const referenceFiles = viewports.map(([label]) => path.join(
    directory,
    label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`
  ));
  const baselineLayouts = new Map(referenceFiles.map((file) => [file, JSON.parse(fs.readFileSync(file, 'utf8'))]));
  const defaultPresetShadow = [
    'rgba(0, 0, 0, 0) 0px 0px 0px 0px',
    'rgba(0, 0, 0, 0) 0px 0px 0px 0px',
    'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px',
    'rgba(0, 0, 0, 0.1) 0px 1px 2px -1px',
  ].join(', ');
  for (const [file, baseline] of baselineLayouts) {
    const candidate = JSON.parse(JSON.stringify(baseline));
    candidate.layoutGroups.find((group) => group.key === '0.1.0').boxShadow = defaultPresetShadow;
    fs.writeFileSync(file, JSON.stringify(candidate));
  }
  const presetShadowLayoutPath = path.join(directory, 'layout-preset-shadow.json');
  const presetShadowResult = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', presetShadowLayoutPath,
    '--reference-manifest', manifestPath,
    '--preserve-source-text',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(presetShadowResult.status, 0, presetShadowResult.stderr || presetShadowResult.stdout);
  const presetShadowLayout = JSON.parse(fs.readFileSync(presetShadowLayoutPath, 'utf8'));
  const presetValue = Object.values(presetShadowLayout).find((node) => node?.props?.text === '31');
  const presetValueWrapper = presetShadowLayout[presetValue.parent];
  const presetContent = presetShadowLayout[presetValueWrapper.parent];
  const presetShell = presetShadowLayout[presetContent.parent];
  assert.equal(presetShell.props.boxShadow, 'shadow');
  assert.equal(presetShell.props.boxShadowColor, undefined);
  assert.equal(presetShell.props.boxShadowOffsetY, undefined);

  for (const scenario of [
    {
      label: 'arbitrary visible multi-shadow',
      shadow: `${defaultPresetShadow}, rgba(0, 0, 0, 0.04) 0px 4px 8px 0px`,
    },
    {
      label: 'transparent nonzero layer',
      shadow: `rgba(0, 0, 0, 0) 1px 0px 0px 0px, ${defaultPresetShadow}`,
    },
  ]) {
    for (const [file, baseline] of baselineLayouts) {
      const candidate = JSON.parse(JSON.stringify(baseline));
      candidate.layoutGroups.find((group) => group.key === '0.1.0').boxShadow = scenario.shadow;
      fs.writeFileSync(file, JSON.stringify(candidate));
    }
    const unsafeMultiShadowResult = spawnSync(process.execPath, [
      draftScript,
      '--contract', contractPath,
      '--brief-json', briefPath,
      '--out', path.join(directory, `layout-unsafe-shadow-${scenario.label.replace(/\s+/g, '-')}.json`),
      '--reference-manifest', manifestPath,
      '--preserve-source-text',
      '--json',
    ], { encoding: 'utf8' });
    assert.equal(unsafeMultiShadowResult.status, 1, scenario.label);
    assert.match(`${unsafeMultiShadowResult.stdout}\n${unsafeMultiShadowResult.stderr}`, /\[generic_shadow_control_gap\]/, scenario.label);
  }

  for (const scenario of [
    { label: 'disappears', width: '0px' },
    { label: 'changes thickness', width: '2px' },
  ]) {
    for (const [file, baseline] of baselineLayouts) {
      const candidate = JSON.parse(JSON.stringify(baseline));
      if (file.endsWith('reference-layout-mobile.json')) {
        candidate.layoutGroups.find((group) => group.key === '0.1.0').borderTopWidth = scenario.width;
      }
      fs.writeFileSync(file, JSON.stringify(candidate));
    }
    const mismatchResult = spawnSync(process.execPath, [
      draftScript,
      '--contract', contractPath,
      '--brief-json', briefPath,
      '--out', path.join(directory, `layout-${scenario.width}.json`),
      '--reference-manifest', manifestPath,
      '--preserve-source-text',
      '--json',
    ], { encoding: 'utf8' });
    assert.equal(mismatchResult.status, 1, scenario.label);
    assert.match(`${mismatchResult.stdout}\n${mismatchResult.stderr}`, /\[generic_responsive_divider_control_gap\]/, scenario.label);
  }

  for (const color of ['hsl(214, 38%, 18%)', 'hsla(214, 38%, 18%, 0.16)']) {
    for (const [file, baseline] of baselineLayouts) {
      const candidate = JSON.parse(JSON.stringify(baseline));
      candidate.layoutGroups.find((group) => group.key === '0.1.0').boxShadow = `${color} 0px 34px 70px 0px`;
      fs.writeFileSync(file, JSON.stringify(candidate));
    }
    const unsafeShadowResult = spawnSync(process.execPath, [
      draftScript,
      '--contract', contractPath,
      '--brief-json', briefPath,
      '--out', path.join(directory, `layout-${color.startsWith('hsla') ? 'hsla' : 'hsl'}.json`),
      '--reference-manifest', manifestPath,
      '--preserve-source-text',
      '--json',
    ], { encoding: 'utf8' });
    assert.equal(unsafeShadowResult.status, 1, color);
    assert.match(`${unsafeShadowResult.stdout}\n${unsafeShadowResult.stderr}`, /\[generic_shadow_control_gap\]/, color);
  }

  for (const [file, baseline] of baselineLayouts) {
    fs.writeFileSync(file, JSON.stringify(baseline));
  }
});

test('generic measured drafting maps safe gradients atomically through typed contract props', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-gradients-'));
  const contractPath = path.join(directory, 'contract.json');
  const fallbackContractPath = path.join(directory, 'fallback-contract.json');
  const missingOverflowContractPath = path.join(directory, 'missing-overflow-contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const fallbackLayoutPath = path.join(directory, 'fallback-layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const referenceLayoutPath = path.join(directory, 'reference-layout.json');
  const contractValue = contract();
  const sectionComponent = contractValue.components.find((component) => component.name === 'Section');
  const containerComponent = contractValue.components.find((component) => component.name === 'Container');
  const gradientPropNames = ['backgroundType', 'gradientType', 'gradientAngle', 'gradientColor1', 'gradientColor2'];
  sectionComponent.props.push(...gradientPropNames);
  sectionComponent.aiProps.push(...gradientPropNames);
  sectionComponent.controls = [
    { type: 'select', props: ['backgroundType'], options: ['', 'color', 'gradient', 'image'] },
    { type: 'select', props: ['gradientType'], options: ['linear', 'radial'] },
    { type: 'number', props: ['gradientAngle'], min: 0, max: 360, step: 1 },
    { type: 'color', props: ['gradientColor1'] },
    { type: 'color', props: ['gradientColor2'] },
  ];
  containerComponent.controls.push(
    { type: 'select', props: ['backgroundType'], options: ['', 'color', 'gradient', 'image'] },
    { type: 'select', props: ['gradientType'], options: ['linear', 'radial'] },
    { type: 'number', props: ['gradientAngle'], min: 0, max: 360, step: 1 },
    { type: 'color', props: ['gradientColor1'] },
    { type: 'color', props: ['gradientColor2'] },
  );

  const measuredLayout = genericMeasuredLayout({
    label: 'desktop',
    width: 1440,
    height: 900,
    bandHeights: [120, 560, 220],
    bandTags: ['header', 'section', 'footer'],
    bandColors: ['rgb(250, 250, 248)', 'rgba(0, 0, 0, 0)', 'rgb(20, 27, 34)'],
    columns: [1, 1, 1],
  });
  measuredLayout.mediaBoxes = [];
  measuredLayout.meaningfulMediaBoxes = [];
  const gradientBand = measuredLayout.landmarks.find((landmark) => landmark.tag === 'section');
  gradientBand.groupKey = '0.1';
  gradientBand.paintedBackground = true;
  gradientBand.backgroundType = 'gradient';
  gradientBand.gradientType = 'linear';
  gradientBand.gradientAngle = 118;
  gradientBand.gradientColor1 = 'rgb(30, 118, 72)';
  gradientBand.gradientColor2 = 'rgba(187, 235, 112, 0.84)';
  measuredLayout.layoutGroups = [
    {
      key: '0.1',
      parentKey: '',
      tag: 'section',
      rect: gradientBand.rect,
      display: 'flex',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      paintedBackground: true,
      backgroundType: 'gradient',
      gradientType: 'linear',
      gradientAngle: 118,
      gradientColor1: 'rgb(30, 118, 72)',
      gradientColor2: 'rgba(187, 235, 112, 0.84)',
    },
    {
      key: '0.1.0',
      parentKey: '0.1',
      tag: 'article',
      rect: measuredRect(916, 220, 528, 260),
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      paintedBackground: true,
      backgroundType: 'gradient',
      gradientType: 'linear',
      gradientAngle: 155,
      gradientColor1: 'rgb(24, 32, 27)',
      gradientColor2: 'rgb(20, 78, 67)',
      backgroundAccentType: 'radial',
      backgroundAccentColor1: 'rgba(139, 191, 47, 0.58)',
      backgroundAccentColor2: 'transparent',
      backgroundAccentPositionX: '18%',
      backgroundAccentPositionY: '18%',
      backgroundAccentSize: '34%',
      overflow: 'hidden',
    },
    {
      key: '0.1.1',
      parentKey: '0.1',
      tag: 'article',
      rect: measuredRect(640, 220, 520, 260),
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      paintedBackground: true,
      backgroundType: 'gradient',
      gradientType: 'radial',
      gradientColor1: 'rgb(235, 255, 222)',
      gradientColor2: 'rgb(24, 94, 60)',
    },
  ];
  const brief = {
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  };
  const manifest = {
    sourceUrl: 'file:///tmp/owned-gradient-page.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  };

  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(measuredLayout));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const section = layout[layout.ROOT.nodes[1]];
  const radialContainer = Object.values(layout).find((node) => node?.props?.gradientType === 'radial');
  const layeredContainer = Object.values(layout).find((node) => node?.props?.backgroundAccentType === 'radial');
  assert.equal(report.ok, true);
  assert.equal(report.audit.ok, true);
  assert.deepEqual({
    backgroundType: section.props.backgroundType,
    gradientType: section.props.gradientType,
    gradientAngle: section.props.gradientAngle,
    gradientColor1: section.props.gradientColor1,
    gradientColor2: section.props.gradientColor2,
  }, {
    backgroundType: 'gradient',
    gradientType: 'linear',
    gradientAngle: 118,
    gradientColor1: 'rgb(30, 118, 72)',
    gradientColor2: 'rgba(187, 235, 112, 0.84)',
  });
  assert.deepEqual({
    backgroundType: layeredContainer.props.backgroundType,
    gradientType: layeredContainer.props.gradientType,
    gradientAngle: layeredContainer.props.gradientAngle,
    gradientColor1: layeredContainer.props.gradientColor1,
    gradientColor2: layeredContainer.props.gradientColor2,
    backgroundAccentType: layeredContainer.props.backgroundAccentType,
    backgroundAccentColor1: layeredContainer.props.backgroundAccentColor1,
    backgroundAccentColor2: layeredContainer.props.backgroundAccentColor2,
    backgroundAccentPositionX: layeredContainer.props.backgroundAccentPositionX,
    backgroundAccentPositionY: layeredContainer.props.backgroundAccentPositionY,
    backgroundAccentSize: layeredContainer.props.backgroundAccentSize,
    overflow: layeredContainer.props.overflow,
  }, {
    backgroundType: 'gradient',
    gradientType: 'linear',
    gradientAngle: 155,
    gradientColor1: 'rgb(24, 32, 27)',
    gradientColor2: 'rgb(20, 78, 67)',
    backgroundAccentType: 'radial',
    backgroundAccentColor1: 'rgba(139, 191, 47, 0.58)',
    backgroundAccentColor2: 'transparent',
    backgroundAccentPositionX: '18%',
    backgroundAccentPositionY: '18%',
    backgroundAccentSize: '34%',
    overflow: 'hidden',
  });
  assert.deepEqual({
    backgroundType: radialContainer.props.backgroundType,
    gradientType: radialContainer.props.gradientType,
    gradientAngle: radialContainer.props.gradientAngle,
    gradientColor1: radialContainer.props.gradientColor1,
    gradientColor2: radialContainer.props.gradientColor2,
    backgroundColor: radialContainer.props.backgroundColor,
  }, {
    backgroundType: 'gradient',
    gradientType: 'radial',
    gradientAngle: undefined,
    gradientColor1: 'rgb(235, 255, 222)',
    gradientColor2: 'rgb(24, 94, 60)',
    backgroundColor: undefined,
  });
  assert.doesNotMatch(JSON.stringify(layout), /(?:linear|radial)-gradient\(|className|cssId|rawHtml|customCss|sourceMetadata/iu);

  const missingOverflowContract = JSON.parse(JSON.stringify(contractValue));
  const missingOverflowContainer = missingOverflowContract.components.find((component) => component.name === 'Container');
  missingOverflowContainer.props = missingOverflowContainer.props.filter((prop) => prop !== 'overflow');
  missingOverflowContainer.aiProps = missingOverflowContainer.aiProps.filter((prop) => prop !== 'overflow');
  missingOverflowContainer.controls = missingOverflowContainer.controls.filter((control) => !control.props.includes('overflow'));
  fs.writeFileSync(missingOverflowContractPath, JSON.stringify(missingOverflowContract));
  const missingOverflowResult = spawnSync(process.execPath, [
    draftScript,
    '--contract', missingOverflowContractPath,
    '--brief-json', briefPath,
    '--out', path.join(directory, 'missing-overflow-layout.json'),
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(missingOverflowResult.status, 1);
  assert.match(`${missingOverflowResult.stdout}\n${missingOverflowResult.stderr}`, /\[generic_overflow_control_gap\]/u);

  const fallbackContract = JSON.parse(JSON.stringify(contractValue));
  const fallbackSection = fallbackContract.components.find((component) => component.name === 'Section');
  fallbackSection.props = fallbackSection.props.filter((prop) => prop !== 'gradientAngle');
  fallbackSection.aiProps = fallbackSection.aiProps.filter((prop) => prop !== 'gradientAngle');
  fallbackSection.controls = fallbackSection.controls.filter((control) => !control.props.includes('gradientAngle'));
  const malformedLayout = JSON.parse(JSON.stringify(measuredLayout));
  for (const malformedGroup of malformedLayout.layoutGroups.filter((group) => group.backgroundType === 'gradient')) {
    malformedGroup.gradientType = 'linear';
    malformedGroup.gradientAngle = 'calc(45deg + 5deg)';
    malformedGroup.gradientColor2 = 'var(--source-color)';
    malformedGroup.backgroundImage = 'url("https://source.example.test/private.png")';
  }
  fs.writeFileSync(fallbackContractPath, JSON.stringify(fallbackContract));
  fs.writeFileSync(referenceLayoutPath, JSON.stringify(malformedLayout));

  const fallbackResult = spawnSync(process.execPath, [
    draftScript,
    '--contract', fallbackContractPath,
    '--brief-json', briefPath,
    '--out', fallbackLayoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(fallbackResult.status, 0, fallbackResult.stderr || fallbackResult.stdout);
  const fallbackReport = JSON.parse(fallbackResult.stdout);
  const fallbackLayout = JSON.parse(fs.readFileSync(fallbackLayoutPath, 'utf8'));
  const authoredNodes = Object.values(fallbackLayout).filter((node) => node && typeof node === 'object');
  assert.equal(fallbackReport.ok, true);
  assert.equal(fallbackReport.audit.ok, true);
  assert.equal(authoredNodes.some((node) => node.props?.backgroundType === 'gradient'), false);
  assert.equal(authoredNodes.some((node) => Object.keys(node.props || {}).some((prop) => /^gradient/u.test(prop))), false);
  assert.equal(authoredNodes.some((node) => node.props?.backgroundColor === '#101318'), true);
  assert.doesNotMatch(JSON.stringify(fallbackLayout), /source\.example\.test|url\(|var\(|calc\(|(?:linear|radial)-gradient\(|className|cssId|rawHtml|customCss/iu);
});

test('generic measured drafting maps a resettable visual tilt and symmetric inset frame through existing controls', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-visual-frame-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const visualFrame = {
    inset: '28px',
    height: 424,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundType: 'gradient',
    gradientType: 'linear',
    gradientAngle: 180,
    gradientColor1: 'rgba(255, 255, 255, 0.28)',
    gradientColor2: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '21px',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderRightColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomColor: 'rgba(255, 255, 255, 0.35)',
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
    boxShadow: 'none',
    paintedBackground: true,
  };
  const measuredLayout = (label, width, groupRect, responsiveFrameHeight, visualTilt = '') => ({
    label,
    viewport: { width, height: 900, scrollHeight: 700 },
    documentStyle: { backgroundColor: 'rgb(246, 247, 242)', color: 'rgb(25, 32, 28)' },
    landmarks: [{
      tag: 'section',
      groupKey: '0',
      rect: measuredRect(0, 0, width, 700),
      display: 'block',
      backgroundColor: 'rgb(246, 247, 242)',
    }],
    layoutGroups: [
      {
        key: '0',
        parentKey: '',
        tag: 'section',
        rect: measuredRect(0, 0, width, 700),
        display: 'block',
        backgroundColor: 'rgb(246, 247, 242)',
      },
      {
        key: '0.0',
        parentKey: '0',
        tag: 'div',
        rect: groupRect,
        display: 'block',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        backgroundType: 'gradient',
        gradientType: 'linear',
        gradientAngle: 145,
        gradientColor1: 'rgb(76, 149, 134)',
        gradientColor2: 'rgb(66, 72, 68)',
        borderRadius: '37px',
        overflow: 'hidden',
        ...(visualTilt ? { visualTilt, layoutWidth: 475.65, layoutHeight: 480 } : {}),
        visualFrame: { ...visualFrame, height: responsiveFrameHeight },
      },
    ],
    textBoxes: [],
    mediaBoxes: [],
    meaningfulMediaBoxes: [],
  });
  const viewports = [
    ['desktop', measuredLayout('desktop', 1440, measuredRect(780.21, 100, 483.95, 488.23), 424, 'micro-left')],
    ['tablet', measuredLayout('tablet', 834, measuredRect(36, 100, 762, 360), 304)],
    ['mobile', measuredLayout('mobile', 390, measuredRect(20, 100, 350, 360), 304)],
  ];
  const brief = {
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  };
  const manifest = {
    sourceUrl: 'file:///tmp/owned-visual-frame-page.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: viewports.map(([label]) => ({
      label,
      file: label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`,
      status: 'ok',
    })),
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const [label, layout] of viewports) {
    fs.writeFileSync(
      path.join(directory, label === 'desktop' ? 'reference-layout.json' : `reference-layout-${label}.json`),
      JSON.stringify(layout),
    );
  }

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  const tiltedSurface = Object.values(layout).find((node) => node?.props?.visualTilt === 'micro-left');
  assert.ok(tiltedSurface);
  assert.deepEqual({
    visualTilt: tiltedSurface.props.visualTilt,
    visualTiltResetAt: tiltedSurface.props.visualTiltResetAt,
    maxWidth: tiltedSurface.props.maxWidth,
    minHeight: tiltedSurface.props.minHeight,
    minHeightTablet: tiltedSurface.props.minHeightTablet,
    minHeightMobile: tiltedSurface.props.minHeightMobile,
    paddingTop: tiltedSurface.props.paddingTop,
    paddingTopTablet: tiltedSurface.props.paddingTopTablet,
    paddingTopMobile: tiltedSurface.props.paddingTopMobile,
  }, {
    visualTilt: 'micro-left',
    visualTiltResetAt: 'tablet',
    maxWidth: '475.65px',
    minHeight: '480px',
    minHeightTablet: '360px',
    minHeightMobile: '360px',
    paddingTop: '28px',
    paddingTopTablet: '28px',
    paddingTopMobile: '28px',
  });
  assert.equal(tiltedSurface.nodes.length, 1);
  const frame = layout[tiltedSurface.nodes[0]];
  assert.deepEqual({
    width: frame.props.width,
    minHeight: frame.props.minHeight,
    minHeightTablet: frame.props.minHeightTablet,
    minHeightMobile: frame.props.minHeightMobile,
    borderRadius: frame.props.borderRadius,
    borderWidth: frame.props.borderWidth,
    borderColor: frame.props.borderColor,
    backgroundType: frame.props.backgroundType,
    gradientType: frame.props.gradientType,
    gradientAngle: frame.props.gradientAngle,
    gradientColor1: frame.props.gradientColor1,
    gradientColor2: frame.props.gradientColor2,
  }, {
    width: '100%',
    minHeight: '424px',
    minHeightTablet: '304px',
    minHeightMobile: '304px',
    borderRadius: '21px',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundType: 'gradient',
    gradientType: 'linear',
    gradientAngle: 180,
    gradientColor1: 'rgba(255, 255, 255, 0.28)',
    gradientColor2: 'rgba(255, 255, 255, 0.08)',
  });
  assert.doesNotMatch(JSON.stringify(layout), /matrix\(|rotate\(|::before|className|cssId|rawHtml|customCss/iu);
});

test('draft layout can recover generic band geometry from the captured reference brief summary', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-brief-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const referenceBriefPath = path.join(directory, 'reference-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const bandTags = ['header', 'section', 'section', 'section', 'section', 'section', 'footer'];
  const bandColors = Array.from({ length: 7 }, (_, index) => `rgb(${245 - index}, ${246 - index}, ${247 - index})`);
  const desktop = genericMeasuredLayout({
    label: 'desktop', width: 1440, height: 1200, bandHeights: [90, 720, 480, 620, 360, 540, 260], bandTags, bandColors, columns: [1, 2, 3, 2, 3, 3, 1],
  });
  const mobile = genericMeasuredLayout({
    label: 'mobile', width: 390, height: 844, bandHeights: [72, 760, 680, 740, 520, 720, 360], bandTags, bandColors, columns: [1, 1, 1, 1, 1, 1, 1],
  });

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(referenceBriefPath, JSON.stringify({
    renderedLayouts: [desktop, mobile].map((layout, index) => ({
      status: 'ok',
      label: index === 0 ? 'desktop' : 'mobile',
      viewport: layout.viewport,
      firstViewport: layout.summary,
      landmarks: layout.landmarks,
      textSamples: layout.textBoxes,
      mediaSamples: layout.mediaBoxes,
    })),
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/unknown-seven-band-page.html',
    briefJson: 'reference-brief.json',
    mediaSurfaces: [],
    requiredMediaRoles: [],
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  assert.equal(report.stats.authoringMode, 'generic-measured-reference');
  assert.equal(report.stats.measuredBandCount, 7);
  assert.equal(layout.ROOT.nodes.length, 7);
  assert.deepEqual(layout.ROOT.nodes.map((nodeId) => layout[nodeId].props.minHeightMobile), ['72px', '760px', '680px', '740px', '520px', '720px', '360px']);
});

test('draft layout rejects generic evidence beyond the bounded band limit', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-bound-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const count = 25;
  const bandHeights = Array.from({ length: count }, () => 100);

  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(path.join(directory, 'reference-layout.json'), JSON.stringify(genericMeasuredLayout({
    label: 'desktop',
    width: 1440,
    height: 1200,
    bandHeights,
    bandTags: Array.from({ length: count }, () => 'section'),
    bandColors: Array.from({ length: count }, () => 'rgb(248, 249, 246)'),
    columns: Array.from({ length: count }, () => 1),
  })));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/unknown-long-page.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [{ label: 'desktop', file: 'reference-layout.json', status: 'ok' }],
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[generic_reference_band_limit_exceeded\].*25 major bands.*at most 24/);
  assert.equal(fs.existsSync(layoutPath), false);
});

test('draft layout reports the exact missing responsive control for a generic measured plan', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-generic-gap-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');
  const manifestPath = path.join(directory, 'reference-manifest.json');
  const contractValue = contract();
  const container = contractValue.components.find((component) => component.name === 'Container');
  container.props = container.props.filter((prop) => prop !== 'gridTemplateColumnsMobile');
  container.aiProps = container.aiProps.filter((prop) => prop !== 'gridTemplateColumnsMobile');
  container.controls = container.controls.map((control) => ({
    ...control,
    props: Array.isArray(control.props)
      ? control.props.filter((prop) => prop !== 'gridTemplateColumnsMobile')
      : control.props,
  }));
  const bandTags = ['header', 'section', 'section', 'section', 'section', 'section', 'footer'];
  const bandColors = Array.from({ length: 7 }, () => 'rgb(248, 249, 246)');
  const desktopHeights = [90, 720, 480, 620, 360, 540, 260];

  fs.writeFileSync(path.join(directory, 'reference-layout.json'), JSON.stringify(genericMeasuredLayout({
    label: 'desktop', width: 1440, height: 1200, bandHeights: desktopHeights, bandTags, bandColors, columns: [1, 2, 3, 2, 3, 3, 1],
  })));
  fs.writeFileSync(path.join(directory, 'reference-layout-mobile.json'), JSON.stringify(genericMeasuredLayout({
    label: 'mobile', width: 390, height: 844, bandHeights: [72, 760, 680, 740, 520, 720, 360], bandTags, bandColors, columns: [1, 1, 1, 1, 1, 1, 1],
  })));
  fs.writeFileSync(contractPath, JSON.stringify(contractValue));
  fs.writeFileSync(briefPath, JSON.stringify({
    ...visualBrief({ target: { variant: 'split-hero', archetype: '', referenceStyle: '' } }),
    media: { surfaces: [], requiredRoles: [] },
    authoringRequirements: {
      referenceClassification: { kind: 'generic-measured-reference', family: '', familyMechanics: false },
    },
  }));
  fs.writeFileSync(manifestPath, JSON.stringify({
    sourceUrl: 'file:///tmp/unknown-seven-band-page.html',
    mediaSurfaces: [],
    requiredMediaRoles: [],
    layouts: [
      { label: 'desktop', file: 'reference-layout.json', status: 'ok' },
      { label: 'mobile', file: 'reference-layout-mobile.json', status: 'ok' },
    ],
  }));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[generic_responsive_control_gap\] Container\.gridTemplateColumnsMobile is required by the measured band plan/);
  assert.equal(fs.existsSync(layoutPath), false);

  const sectionContractValue = contract();
  const section = sectionContractValue.components.find((component) => component.name === 'Section');
  section.props = section.props.filter((prop) => prop !== 'innerPaddingXMobile');
  section.aiProps = section.aiProps.filter((prop) => prop !== 'innerPaddingXMobile');
  fs.writeFileSync(contractPath, JSON.stringify(sectionContractValue));

  const sectionResult = spawnSync(process.execPath, [
    draftScript,
    '--contract', contractPath,
    '--brief-json', briefPath,
    '--out', layoutPath,
    '--reference-manifest', manifestPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(sectionResult.status, 1);
  assert.match(sectionResult.stderr, /\[generic_section_control_gap\] Section\.innerPaddingXMobile is required by the measured band plan/);
  assert.equal(fs.existsSync(layoutPath), false);
});

test('draft layout rejects contracts without core canvas widgets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-draft-layout-missing-'));
  const contractPath = path.join(directory, 'contract.json');
  const briefPath = path.join(directory, 'visual-brief.json');
  const layoutPath = path.join(directory, 'layout-draft.json');

  fs.writeFileSync(contractPath, JSON.stringify({ components: [{ name: 'Text', props: ['text'] }] }));
  fs.writeFileSync(briefPath, JSON.stringify(visualBrief()));

  const result = spawnSync(process.execPath, [
    draftScript,
    '--contract',
    contractPath,
    '--brief-json',
    briefPath,
    '--out',
    layoutPath,
    '--json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Section/);
});

function genericMeasuredLayout({ label, width, height, bandHeights, bandTags, bandColors, columns }) {
  const scrollHeight = bandHeights.reduce((sum, bandHeight) => sum + bandHeight, 0);
  const landmarks = [];
  const textBoxes = [];
  const mediaBoxes = [];
  let top = 0;

  landmarks.push({
    tag: 'main',
    rect: measuredRect(0, bandHeights[0], width, scrollHeight - bandHeights[0] - bandHeights.at(-1)),
    backgroundColor: 'rgba(0, 0, 0, 0)',
  });

  for (let index = 0; index < bandHeights.length; index += 1) {
    const bandHeight = bandHeights[index];
    const columnCount = columns[index];
    const inset = label === 'mobile' ? 20 : label === 'tablet' ? 36 : 72;
    const gap = label === 'mobile' ? 18 : 24;
    const contentWidth = width - inset * 2;
    const columnWidth = (contentWidth - gap * (columnCount - 1)) / columnCount;
    const textTop = top + Math.max(18, bandHeight * 0.16);
    const headingHeight = index === 1 ? Math.min(160, bandHeight * 0.28) : Math.min(76, bandHeight * 0.2);

    landmarks.push({
      tag: bandTags[index],
      rect: measuredRect(0, top, width, bandHeight),
      backgroundColor: bandColors[index],
      boxShadow: 'none',
    });

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const left = inset + columnIndex * (columnWidth + gap);
      const tag = index === 1 && columnIndex === 0 ? 'h1' : columnIndex === 0 ? 'h2' : 'p';
      const textHeight = tag === 'p' ? Math.min(64, bandHeight * 0.16) : headingHeight;
      textBoxes.push({
        tag,
        text: `Unknown Source Heading ${index + 1}.${columnIndex + 1}`,
        rect: measuredRect(left, textTop, columnWidth, textHeight),
        firstViewportArea: textTop < height ? columnWidth * Math.min(textHeight, height - textTop) : 0,
        fontSize: tag === 'h1' ? (label === 'mobile' ? '40px' : label === 'tablet' ? '52px' : '64px') : tag === 'h2' ? (label === 'mobile' ? '28px' : '36px') : '16px',
        fontWeight: tag === 'p' ? '400' : '700',
        fontFamily: 'Untrusted Source Sans',
        boxShadow: 'none',
      });
    }

    const mediaColumns = [1, 2, 3, 5].includes(index) ? Math.max(1, Math.min(2, columns[index] - 1 || 1)) : 0;
    for (let mediaIndex = 0; mediaIndex < mediaColumns; mediaIndex += 1) {
      const stacked = label === 'mobile';
      const mediaWidth = stacked ? contentWidth : columnWidth;
      const mediaLeft = stacked ? inset : inset + (columnCount - 1 - mediaIndex) * (columnWidth + gap);
      const mediaTop = stacked ? textTop + headingHeight + 28 + mediaIndex * 190 : textTop;
      const mediaHeight = Math.max(150, Math.min(260, bandHeight * 0.42));
      mediaBoxes.push({
        tag: 'img',
        source: `https://captured.example.test/source-band-${index + 1}-media-${mediaIndex + 1}.jpg`,
        rect: measuredRect(mediaLeft, mediaTop, mediaWidth, mediaHeight),
        firstViewportArea: mediaTop < height ? mediaWidth * Math.min(mediaHeight, height - mediaTop) : 0,
        objectFit: 'cover',
      });
    }

    top += bandHeight;
  }

  return {
    capturedAt: '2026-07-11T00:00:00.000Z',
    url: 'file:///tmp/unknown-seven-band-page.html',
    title: 'Unknown Local Page',
    viewport: { width, height, scrollHeight },
    textBoxes,
    mediaBoxes,
    meaningfulMediaBoxes: mediaBoxes,
    landmarks,
    summary: {
      firstViewportTextBoxes: textBoxes.filter((box) => box.rect.top < height).length,
      firstViewportMediaBoxes: mediaBoxes.filter((box) => box.rect.top < height).length,
      firstViewportMediaCoverage: 0.32,
      largestMediaArea: mediaBoxes.reduce((largest, box) => Math.max(largest, box.rect.width * box.rect.height), 0),
    },
  };
}

function lumenLikeMixedStackLayout({
  label,
  width,
  height,
  heroWidth,
  heroHeight,
  paddingTop,
  paddingBottom,
  proofTop,
  proofWidth,
  proofRight,
  proofHeight,
  responsiveDoctorFlow = false,
}) {
  const pageHeight = heroHeight + 320;
  const bandRect = measuredRect(0, 0, width, heroHeight);
  const heroRect = measuredRect(0, 0, heroWidth, heroHeight);
  const stackKey = responsiveDoctorFlow ? '0.1' : '0.0';
  const contentKey = `${stackKey}.0`;
  const proofKey = responsiveDoctorFlow ? `${stackKey}.2` : `${stackKey}.1`;
  const doctorKey = responsiveDoctorFlow ? `${stackKey}.1.0` : `${stackKey}.3`;
  const detailKey = responsiveDoctorFlow ? `${stackKey}.1.1` : `${stackKey}.2`;
  const contentHeight = responsiveDoctorFlow
    ? label === 'mobile' ? 397.2 : label === 'tablet' ? 364.13 : 532.03
    : label === 'mobile' ? 300 : 280;
  const contentRect = measuredRect(
    responsiveDoctorFlow ? 0 : label === 'mobile' ? 24 : 80,
    paddingTop,
    responsiveDoctorFlow ? heroWidth : Math.min(width - 48, 720),
    contentHeight,
  );
  const doctorWidth = responsiveDoctorFlow
    ? label === 'mobile' ? 350 : label === 'tablet' ? 794 : 440
    : label === 'mobile' ? 350 : label === 'tablet' ? 380 : 620;
  const doctorHeight = responsiveDoctorFlow
    ? label === 'mobile' ? 300 : label === 'tablet' ? 440 : 530
    : Math.max(280, heroHeight - paddingTop - paddingBottom);
  const doctorTop = responsiveDoctorFlow
    ? label === 'desktop' ? 244 : paddingTop + contentHeight + 44
    : paddingTop;
  const doctorRect = measuredRect(
    responsiveDoctorFlow
      ? label === 'desktop' ? 190 : 0
      : Math.max(0, heroRect.right - doctorWidth - (label === 'mobile' ? 20 : 110)),
    doctorTop,
    doctorWidth,
    doctorHeight,
  );
  const detailWidth = label === 'mobile' ? 150 : label === 'tablet' ? 210 : 280;
  const detailHeight = label === 'mobile' ? 180 : label === 'tablet' ? 230 : 300;
  const detailRect = measuredRect(
    width - detailWidth - (label === 'mobile' ? 18 : 48),
    paddingTop + (label === 'mobile' ? 30 : 20),
    detailWidth,
    detailHeight,
  );
  const proofRect = measuredRect(
    heroRect.right - proofWidth - proofRight,
    proofTop,
    proofWidth,
    proofHeight,
  );
  const backgroundSource = 'https://cdn.example.test/lumen-hero-full.jpg?auto=format&amp;fit=crop';
  const doctorSource = 'https://cdn.example.test/lumen-doctor-cutout.png';
  const detailSource = 'https://cdn.example.test/lumen-hero-detail.jpg';
  const textBoxes = [
    responsiveDoctorFlow ? {
      parentGroupKey: contentKey,
      structureKey: `${contentKey}.0`,
      tag: 'span',
      text: 'Eye care clinic',
      rect: measuredRect(
        responsiveDoctorFlow ? Math.min(80, Math.max(0, heroWidth - 350)) : label === 'mobile' ? 24 : 80,
        paddingTop + 74,
        130,
        18,
      ),
      firstViewportArea: 130 * 18,
      fontSize: '15px',
      fontWeight: '800',
      lineHeight: '18px',
      color: 'rgb(24, 51, 45)',
    } : null,
    {
      parentGroupKey: contentKey,
      structureKey: `${contentKey}.${responsiveDoctorFlow ? 1 : 0}`,
      tag: 'h1',
      text: 'Clear care, thoughtfully framed',
      rect: measuredRect(
        responsiveDoctorFlow ? Math.min(80, Math.max(0, heroWidth - 350)) : label === 'mobile' ? 24 : 80,
        paddingTop + 62,
        Math.min(responsiveDoctorFlow ? heroWidth : width - 48, 720),
        label === 'mobile' ? 132 : 150,
      ),
      firstViewportArea: 720 * 150,
      fontSize: label === 'mobile' ? '54px' : label === 'tablet' ? '62px' : '76px',
      fontWeight: '700',
      lineHeight: '0.98',
      color: 'rgb(24, 51, 45)',
    },
    responsiveDoctorFlow ? {
      parentGroupKey: contentKey,
      structureKey: `${contentKey}.2`,
      tag: 'p',
      text: 'Thoughtful explanations and a calm plan for every stage of care.',
      rect: measuredRect(
        label === 'desktop' ? 540 : 0,
        paddingTop + 62 + (label === 'mobile' ? 132 : 150) + 34,
        label === 'mobile' ? heroWidth : Math.min(470, heroWidth),
        label === 'mobile' ? 74 : 56,
      ),
      firstViewportArea: 470 * 56,
      fontSize: label === 'mobile' ? '16px' : '18px',
      fontWeight: '600',
      lineHeight: label === 'mobile' ? '24.8px' : '27.9px',
      color: 'rgb(24, 51, 45)',
    } : null,
    responsiveDoctorFlow && label !== 'desktop' ? null : {
      parentGroupKey: proofKey,
      structureKey: `${proofKey}.0`,
      tag: 'strong',
      text: 'Trusted by local families',
      rect: measuredRect(proofRect.left + 24, proofRect.top + 100, proofRect.width - 48, 28),
      firstViewportArea: 0,
      fontSize: '20px',
      fontWeight: '700',
      lineHeight: '28px',
      color: 'rgb(24, 51, 45)',
    },
    {
      parentGroupKey: '',
      structureKey: '1.0',
      tag: 'h2',
      text: 'Care that continues beyond the first visit',
      rect: measuredRect(label === 'mobile' ? 24 : 80, heroHeight + 100, width - (label === 'mobile' ? 48 : 160), 76),
      firstViewportArea: 0,
      fontSize: label === 'mobile' ? '32px' : '46px',
      fontWeight: '700',
      lineHeight: '1.08',
      color: 'rgb(24, 51, 45)',
    },
  ].filter(Boolean);
  const mediaBoxes = [
    {
      tag: 'div',
      source: backgroundSource,
      backgroundImage: backgroundSource,
      structureKey: '0.4',
      parentGroupKey: '0',
      flowParticipation: 'normal',
      rect: bandRect,
      firstViewportArea: width * Math.min(height, heroHeight),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundPositionX: '50%',
      backgroundPositionY: '50%',
    },
    {
      tag: 'img',
      source: doctorSource,
      structureKey: doctorKey,
      parentGroupKey: responsiveDoctorFlow && label !== 'desktop' ? `${stackKey}.1` : stackKey,
      flowParticipation: responsiveDoctorFlow && label !== 'desktop' ? 'normal' : responsiveDoctorFlow ? 'overlay' : 'normal',
      stackingIndex: 1,
      rect: doctorRect,
      firstViewportArea: doctorRect.top < height
        ? doctorRect.width * Math.min(doctorRect.height, height - doctorRect.top)
        : 0,
      objectFit: 'contain',
      objectPosition: '50% 100%',
    },
    responsiveDoctorFlow && label !== 'desktop' ? null : {
      tag: 'img',
      source: detailSource,
      structureKey: detailKey,
      parentGroupKey: stackKey,
      flowParticipation: 'overlay',
      stackingIndex: 3,
      rect: detailRect,
      firstViewportArea: detailRect.top < height
        ? detailRect.width * Math.min(detailRect.height, height - detailRect.top)
        : 0,
      objectFit: 'cover',
      objectPosition: '50% 42%',
      borderTopWidth: '6px',
      borderRightWidth: '6px',
      borderBottomWidth: '6px',
      borderLeftWidth: '6px',
      borderTopColor: 'rgb(255, 255, 255)',
      borderRightColor: 'rgb(255, 255, 255)',
      borderBottomColor: 'rgb(255, 255, 255)',
      borderLeftColor: 'rgb(255, 255, 255)',
      borderRadius: '18px',
    },
  ].filter(Boolean);

  return {
    capturedAt: '2026-07-16T00:00:00.000Z',
    label,
    url: 'file:///tmp/generated-lumen-mixed-stack.html',
    viewport: { width, height, scrollWidth: width, scrollHeight: pageHeight },
    horizontalOverflow: { overflowPx: 0, documentScrollWidth: width },
    documentStyle: { backgroundColor: 'rgb(247, 250, 246)', color: 'rgb(24, 51, 45)' },
    landmarks: [
      { tag: 'main', rect: measuredRect(0, 0, width, pageHeight), backgroundColor: 'rgba(0, 0, 0, 0)' },
      { tag: 'section', groupKey: '0', rect: heroRect, backgroundColor: 'rgb(247, 250, 246)' },
      {
        tag: 'section',
        groupKey: '1',
        rect: measuredRect(0, heroHeight, width, pageHeight - heroHeight),
        backgroundColor: 'rgb(247, 250, 246)',
      },
    ],
    layoutGroups: [
      {
        key: stackKey,
        parentKey: '0',
        tag: 'div',
        rect: heroRect,
        display: 'grid',
        flowParticipation: 'normal',
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingBottom}px`,
      },
      {
        key: contentKey,
        parentKey: stackKey,
        tag: 'div',
        rect: contentRect,
        display: 'flex',
        flexDirection: 'column',
        flowParticipation: 'normal',
        stackingIndex: 2,
      },
      responsiveDoctorFlow && label !== 'desktop' ? {
        key: `${stackKey}.1`,
        parentKey: stackKey,
        tag: 'div',
        rect: doctorRect,
        display: 'block',
        flowParticipation: 'normal',
      } : null,
      responsiveDoctorFlow && label !== 'desktop' ? null : {
        key: proofKey,
        parentKey: stackKey,
        tag: 'aside',
        rect: proofRect,
        display: 'flex',
        flexDirection: 'column',
        flowParticipation: 'overlay',
        stackingIndex: 4,
        backgroundColor: 'rgb(255, 255, 255)',
        paintedBackground: true,
        borderRadius: '18px',
        boxShadow: 'rgba(24, 51, 45, 0.18) 0px 18px 42px 0px',
        paddingTop: '24px',
        paddingRight: '24px',
        paddingBottom: '24px',
        paddingLeft: '24px',
      },
    ].filter(Boolean),
    textBoxes,
    mediaBoxes,
    summary: {
      firstViewportTextBoxes: textBoxes.filter((box) => box.rect.top < height).length,
      firstViewportMediaBoxes: mediaBoxes.filter((box) => box.rect.top < height).length,
      firstViewportMediaCoverage: 0.7,
      largestMediaArea: width * heroHeight,
    },
  };
}

function twoColumnGridMeasuredLayout({ label, width, height, firstPercent = 50, fixedLeftWidth = null, stacked = false }) {
  const inset = label === 'mobile' ? 20 : label === 'tablet' ? 36 : 72;
  const gap = 24;
  const groupLeft = inset;
  const groupTop = 120;
  const groupWidth = width - inset * 2;
  const availableTrackWidth = groupWidth - gap;
  const firstWidth = stacked
    ? groupWidth
    : fixedLeftWidth ?? availableTrackWidth * firstPercent / 100;
  const secondWidth = stacked ? groupWidth : availableTrackWidth - firstWidth;
  const firstHeight = stacked ? 180 : 300;
  const secondTop = stacked ? groupTop + firstHeight + gap : groupTop;
  const secondHeight = stacked ? 180 : 300;
  const groupHeight = stacked ? firstHeight + gap + secondHeight : 300;
  const firstRect = measuredRect(groupLeft, groupTop, firstWidth, firstHeight);
  const secondRect = measuredRect(
    stacked ? groupLeft : groupLeft + firstWidth + gap,
    secondTop,
    secondWidth,
    secondHeight
  );
  const scrollHeight = Math.max(640, groupTop + groupHeight + 120);

  return {
    label,
    viewport: { width, height, scrollHeight },
    documentStyle: { backgroundColor: 'rgb(248, 249, 246)', color: 'rgb(24, 32, 27)' },
    landmarks: [{
      tag: 'section',
      groupKey: '0',
      rect: measuredRect(0, 0, width, scrollHeight),
      display: 'block',
      backgroundColor: 'rgb(248, 249, 246)',
    }],
    layoutGroups: [
      {
        key: '0.0',
        parentKey: '0',
        tag: 'div',
        rect: measuredRect(groupLeft, groupTop, groupWidth, groupHeight),
        display: 'grid',
        gap: `${gap}px`,
        columnGap: `${gap}px`,
        rowGap: `${gap}px`,
      },
      {
        key: '0.0.0',
        parentKey: '0.0',
        tag: 'article',
        rect: firstRect,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      },
      {
        key: '0.0.1',
        parentKey: '0.0',
        tag: 'article',
        rect: secondRect,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      },
    ],
    textBoxes: [
      {
        parentGroupKey: '0.0.0',
        structureKey: '0.0.0.0',
        tag: 'h2',
        text: 'Measured first column',
        rect: measuredRect(firstRect.left + 20, firstRect.top + 24, Math.max(40, firstRect.width - 40), 56),
        fontSize: '42px',
        fontWeight: '700',
        lineHeight: '46px',
        marginTop: '0px',
        marginBottom: '0px',
        color: 'rgb(24, 32, 27)',
      },
      {
        parentGroupKey: '0.0.1',
        structureKey: '0.0.1.0',
        tag: 'p',
        text: 'Measured second column content.',
        rect: measuredRect(secondRect.left + 20, secondRect.top + 24, Math.max(40, secondRect.width - 40), 52),
        fontSize: '16px',
        fontWeight: '400',
        lineHeight: '26px',
        marginTop: '0px',
        marginBottom: '0px',
        color: 'rgb(74, 84, 76)',
      },
    ],
    interactions: [],
    mediaBoxes: [],
    meaningfulMediaBoxes: [],
    summary: {
      firstViewportTextBoxes: 2,
      firstViewportMediaBoxes: 0,
      firstViewportMediaCoverage: 0,
    },
  };
}

function tabbedMeasuredLayout({ label, width, height }) {
  const mobile = label === 'mobile';
  const tablet = label === 'tablet';
  const stackedPanel = mobile || tablet;
  const inset = mobile ? 12 : label === 'tablet' ? 20 : 130;
  const hostTop = 180;
  const hostWidth = width - inset * 2;
  const tabBarWidth = mobile ? hostWidth : label === 'tablet' ? 190 : 230;
  const layoutGap = 18;
  const tabBarHeight = mobile ? 90 : 616;
  const panelLeft = mobile ? inset : inset + tabBarWidth + layoutGap;
  const panelTop = mobile ? hostTop + tabBarHeight + layoutGap : hostTop;
  const panelWidth = mobile ? hostWidth : hostWidth - tabBarWidth - layoutGap;
  const panelHeight = mobile ? 765 : tablet ? 654 : 616;
  const hostHeight = mobile ? tabBarHeight + layoutGap + panelHeight : panelHeight;
  const tabLabels = ['Doors open', 'Listening room', 'Chef table', 'Courtyard set', 'Night archive'];
  const tabTimes = ['18:00', '19:15', '20:30', '22:00', '23:30'];
  const visibleTabWidth = mobile ? 174 : tabBarWidth - 22;
  const tabHeight = mobile ? 68 : 78;
  const tabStartLeft = inset + 11;
  const tabStartTop = hostTop + 11;
  const tabGap = 8;
  const tabRects = tabLabels.map((_, index) => measuredRect(
    mobile ? tabStartLeft + index * (visibleTabWidth + tabGap) : tabStartLeft,
    mobile ? tabStartTop : tabStartTop + index * (tabHeight + tabGap),
    visibleTabWidth,
    tabHeight
  ));
  const panelRect = measuredRect(panelLeft, panelTop, panelWidth, panelHeight);
  const panelPadding = mobile ? 14 : 22;
  const panelInnerWidth = panelWidth - panelPadding * 2;
  const imageWidth = stackedPanel ? panelInnerWidth : Math.round(panelInnerWidth * 0.574);
  const imageHeight = mobile ? 330 : tablet ? 280 : panelHeight - panelPadding * 2;
  const imageLeft = stackedPanel ? panelLeft + panelPadding : panelLeft + panelWidth - panelPadding - imageWidth;
  const imageTop = stackedPanel ? panelTop + panelHeight - panelPadding - imageHeight : panelTop + panelPadding;
  const imageRect = measuredRect(imageLeft, imageTop, imageWidth, imageHeight);
  const contentInset = mobile ? 10 : tablet ? 18 : 20;
  const contentPaddingTop = mobile ? 22 : tablet ? 24 : 34;
  const contentPaddingBottom = mobile ? 12 : 0;
  const contentTrackWidth = stackedPanel
    ? panelInnerWidth
    : panelWidth - imageWidth - panelPadding * 2 - 24;
  const contentLeft = panelLeft + panelPadding + contentInset;
  const contentWidth = contentTrackWidth - contentInset * 2;
  const eyebrowTop = panelTop + panelPadding + contentPaddingTop;
  const titleTop = panelTop + (tablet ? 91 : mobile ? 65 : panelPadding + 80);
  const bodyTop = panelTop + (tablet ? 192 : mobile ? 205 : panelPadding + 330);
  const ctaTop = panelTop + (tablet ? 282 : mobile ? 339 : panelPadding + 448);
  const interactions = tabRects.map((rect, index) => ({
    order: index,
    tag: 'button',
    role: 'tab',
    type: 'button',
    rect,
    structureKey: `0.1.0.${index}`,
    parentGroupKey: '0.1.0',
    backgroundColor: index === 2 ? 'rgb(24, 63, 52)' : 'rgba(0, 0, 0, 0)',
    color: index === 2 ? 'rgb(255, 255, 255)' : 'rgb(102, 113, 107)',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: 'normal',
    textAlign: 'left',
    borderRadius: '11px',
    borderTopWidth: '0px',
    borderTopColor: index === 2 ? 'rgb(255, 255, 255)' : 'rgb(102, 113, 107)',
    paddingTop: mobile ? '10px' : '12px',
    paddingRight: '14px',
    paddingBottom: mobile ? '10px' : '12px',
    paddingLeft: '14px',
    display: 'grid',
    gap: '8px',
    rowGap: '8px',
    columnGap: '8px',
    state: { selected: index === 2, disabled: false },
  })).concat([{
    order: tabLabels.length,
    tag: 'article',
    role: 'tabpanel',
    rect: panelRect,
    structureKey: '0.1.1.2',
    parentGroupKey: '0.1.1',
    backgroundColor: 'rgb(24, 63, 52)',
    color: 'rgb(255, 255, 255)',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: 'normal',
    borderRadius: '24px',
    borderTopWidth: '0px',
    borderTopColor: 'rgb(255, 255, 255)',
    paddingTop: `${panelPadding}px`,
    paddingRight: `${panelPadding}px`,
    paddingBottom: `${panelPadding}px`,
    paddingLeft: `${panelPadding}px`,
    display: 'grid',
    gap: '24px',
    state: {},
  }]);
  const tabTextBoxes = tabLabels.flatMap((tabLabel, index) => [{
    tag: 'button',
    text: `${String(index + 1).padStart(2, '0')} ${tabLabel} ${tabTimes[index]}`,
    structureKey: `0.1.0.${index}`,
    parentGroupKey: '0.1.0',
    rect: tabRects[index],
    fontSize: '16px',
    fontWeight: '400',
    color: index === 2 ? 'rgb(255, 255, 255)' : 'rgb(102, 113, 107)',
  }, {
    tag: 'span',
    text: String(index + 1).padStart(2, '0'),
    structureKey: `0.1.0.${index}.0`,
    parentGroupKey: '0.1.0',
    rect: measuredRect(tabRects[index].left + 14, tabRects[index].top + 30, 28, 13),
    fontSize: '11px',
    fontWeight: '400',
    lineHeight: '13px',
    color: index === 2 ? 'rgb(255, 255, 255)' : 'rgb(102, 113, 107)',
  }, {
    tag: 'strong',
    text: tabLabel,
    structureKey: `0.1.0.${index}.1`,
    parentGroupKey: '0.1.0',
    rect: measuredRect(tabRects[index].left + 48, tabRects[index].top + 28, Math.min(110, tabRects[index].width - 70), 17),
    fontSize: '14px',
    fontWeight: '700',
    lineHeight: '17px',
    color: index === 2 ? 'rgb(255, 255, 255)' : 'rgb(102, 113, 107)',
  }, {
    tag: 'small',
    text: tabTimes[index],
    structureKey: `0.1.0.${index}.2`,
    parentGroupKey: '0.1.0',
    rect: measuredRect(tabRects[index].right - 44, tabRects[index].top + 30, 30, 13),
    fontSize: '11px',
    fontWeight: '400',
    lineHeight: '13px',
    color: index === 2 ? 'rgb(255, 255, 255)' : 'rgb(102, 113, 107)',
  }]);
  const visibleTabTextBoxes = mobile
    ? tabTextBoxes.filter((box) => !String(box.structureKey || '').startsWith('0.1.0.2.'))
    : tabTextBoxes;
  const textBoxes = visibleTabTextBoxes.concat([{
    tag: 'h2',
    text: 'Choose a chapter, then stay for the whole story.',
    structureKey: '0.0.0',
    parentGroupKey: '0.0',
    rect: measuredRect(inset, 44, Math.min(640, hostWidth), 84),
    fontSize: mobile ? '38px' : '58px',
    fontWeight: '800',
    lineHeight: mobile ? '40px' : '60px',
    color: 'rgb(20, 35, 29)',
  }, {
    tag: 'span',
    text: '20:30 · Hall C',
    structureKey: '0.1.1.2.0.0',
    parentGroupKey: '0.1.1.2.0',
    rect: measuredRect(contentLeft, eyebrowTop, Math.min(120, contentWidth), 15),
    fontSize: '12px',
    fontWeight: '850',
    lineHeight: '15px',
    color: 'rgb(204, 233, 92)',
  }, {
    tag: 'h3',
    text: 'Seasonal plates between sets.',
    structureKey: '0.1.1.2.0.1',
    parentGroupKey: '0.1.1.2.0',
    rect: measuredRect(contentLeft, titleTop, contentWidth, mobile ? 126 : tablet ? 80 : 220),
    fontSize: mobile ? '44px' : tablet ? '42px' : '70px',
    fontWeight: '700',
    lineHeight: mobile ? '42px' : tablet ? '40px' : '66px',
    marginBottom: mobile ? '18px' : '22px',
    color: 'rgb(255, 255, 255)',
  }, {
    tag: 'p',
    text: 'Share a generous menu made for the whole table.',
    structureKey: '0.1.1.2.0.2',
    parentGroupKey: '0.1.1.2.0',
    rect: measuredRect(contentLeft, bodyTop, contentWidth, tablet ? 56 : 84),
    fontSize: '17px',
    fontWeight: '400',
    lineHeight: '28px',
    marginBottom: '34px',
    color: 'rgba(255, 255, 255, 0.72)',
  }, {
    tag: 'a',
    text: 'Reserve this part',
    structureKey: '0.1.1.2.0.3',
    parentGroupKey: '0.1.1.2.0',
    rect: measuredRect(contentLeft, ctaTop, 173, 46),
    fontSize: '16px',
    fontWeight: '750',
    lineHeight: '19px',
    color: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(255, 101, 77)',
    borderTopColor: 'rgb(255, 255, 255)',
    borderTopWidth: '0px',
    borderRadius: '999px',
    paddingTop: '0px',
    paddingLeft: '20px',
  }]);
  const mediaBoxes = [{
    order: 0,
    tag: 'img',
    source: 'https://images.example.test/table.jpg',
    rect: imageRect,
    structureKey: '0.1.1.2.1',
    parentGroupKey: '0.1.1.2',
    flowParticipation: 'normal',
    objectFit: 'cover',
    objectPosition: mobile ? '68% 24%' : tablet ? '50% 30%' : '50% 38%',
    backgroundPositionX: '0%',
    backgroundPositionY: '0%',
    borderRadius: '16px',
  }];
  const scrollHeight = Math.max(height, hostTop + hostHeight + 100);

  return {
    label,
    viewport: { width, height, scrollWidth: width, scrollHeight },
    documentStyle: { backgroundColor: 'rgb(243, 241, 232)', color: 'rgb(20, 35, 29)' },
    landmarks: [{
      tag: 'section',
      groupKey: '0',
      rect: measuredRect(inset, 0, hostWidth, scrollHeight),
      display: 'block',
      backgroundColor: 'rgb(243, 241, 232)',
    }],
    layoutGroups: [
      { key: '0.0', parentKey: '0', tag: 'div', rect: measuredRect(inset, 40, hostWidth, 100), display: 'block' },
      { key: '0.1', parentKey: '0', tag: 'div', rect: measuredRect(inset, hostTop, hostWidth, hostHeight), display: 'grid', gap: '18px' },
      {
        key: '0.1.0', parentKey: '0.1', tag: 'div', rect: measuredRect(inset, hostTop, tabBarWidth, tabBarHeight),
        display: 'flex', flexDirection: mobile ? 'row' : 'column', gap: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.38)', paddingTop: '10px', paddingRight: '10px',
        paddingBottom: '10px', paddingLeft: '10px', borderTopWidth: '1px',
        borderTopColor: 'rgba(20, 35, 29, 0.16)', borderRadius: '16px', paintedBackground: true,
      },
      { key: '0.1.1', parentKey: '0.1', tag: 'div', rect: panelRect, display: 'block' },
      {
        key: '0.1.1.2', parentKey: '0.1.1', tag: 'article', rect: panelRect, display: 'grid', gap: '24px',
        backgroundColor: 'rgb(24, 63, 52)', paddingTop: `${panelPadding}px`, paddingRight: `${panelPadding}px`,
        paddingBottom: `${panelPadding}px`, paddingLeft: `${panelPadding}px`, borderTopWidth: '0px',
        borderTopColor: 'rgb(255, 255, 255)', borderRadius: '24px', paintedBackground: true,
      },
      {
        key: '0.1.1.2.0', parentKey: '0.1.1.2', tag: 'div',
        rect: measuredRect(
          panelLeft + panelPadding,
          panelTop + panelPadding,
          contentTrackWidth,
          stackedPanel ? imageTop - panelTop - panelPadding - 24 : panelHeight - panelPadding * 2
        ),
        display: 'flex', flexDirection: 'column', paddingTop: `${contentPaddingTop}px`, paddingRight: `${contentInset}px`,
        paddingBottom: `${contentPaddingBottom}px`, paddingLeft: `${contentInset}px`,
      },
    ],
    textBoxes,
    interactions,
    mediaBoxes,
    meaningfulMediaBoxes: mediaBoxes,
    summary: {
      firstViewportTextBoxes: textBoxes.filter((box) => box.rect.top < height).length,
      firstViewportMediaBoxes: mediaBoxes.filter((box) => box.rect.top < height).length,
      firstViewportMediaCoverage: 0,
    },
  };
}

function measuredRect(x, y, width, height) {
  return { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
}

function maximumDescendantDepth(layout, node, depth = 0) {
  if (!Array.isArray(node?.nodes) || node.nodes.length === 0) {
    return depth;
  }
  return Math.max(...node.nodes.map((nodeId) => maximumDescendantDepth(layout, layout[nodeId], depth + 1)));
}

function contract() {
  const components = [
      {
        name: 'Section',
        allowedParents: ['ROOT'],
        props: ['tag', 'paddingTop', 'paddingTopTablet', 'paddingTopMobile', 'paddingBottom', 'paddingBottomTablet', 'paddingBottomMobile', 'innerMaxWidth', 'innerPaddingX', 'innerPaddingXTablet', 'innerPaddingXMobile', 'layoutDisplay', 'flexDirection', 'gap', 'responsiveStack', 'responsiveDisplay', 'gridTemplateColumns', 'gridTemplateColumnsTablet', 'gridTemplateColumnsMobile', 'gridFirstColumnPercent', 'gridFirstColumnPercentTablet', 'gridFirstColumnPercentMobile', 'minHeight', 'minHeightTablet', 'minHeightMobile', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY', 'backgroundPositionXTablet', 'backgroundPositionYTablet', 'backgroundPositionXMobile', 'backgroundPositionYMobile', 'backgroundRepeat', 'backgroundOverlay', 'backgroundAccentType', 'backgroundAccentColor1', 'backgroundAccentColor2', 'backgroundAccentPositionX', 'backgroundAccentPositionY', 'backgroundAccentSize'],
        controls: [
          {
            type: 'select',
            props: ['gridTemplateColumns', 'gridTemplateColumnsTablet', 'gridTemplateColumnsMobile'],
            options: ['', 'one', 'two', 'two-proportional', 'three', 'four', 'six', 'sidebar-left-280', 'sidebar-left-320', 'sidebar-left-360', 'sidebar-right-280', 'sidebar-right-320', 'sidebar-right-360'],
          },
          {
            type: 'number',
            props: ['gridFirstColumnPercent', 'gridFirstColumnPercentTablet', 'gridFirstColumnPercentMobile'],
            min: 10,
            max: 90,
            step: 1,
          },
        ],
      },
      {
        name: 'Container',
        allowedParents: ['Section', 'Container'],
        props: [
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
          'minHeight',
          'minHeightTablet',
          'minHeightMobile',
          'flexBasis',
          'flexGrow',
          'flexShrink',
          'width',
          'maxWidth',
          'maxWidthTablet',
          'maxWidthMobile',
          'minWidth',
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
          'marginLeft',
          'marginLeftTablet',
          'marginLeftMobile',
          'borderRadius',
          'borderWidth',
          'borderColor',
          'backgroundColor',
          'backgroundType',
          'gradientType',
          'gradientAngle',
          'gradientColor1',
          'gradientColor2',
          'boxShadow',
          'boxShadowOffsetX',
          'boxShadowOffsetY',
          'boxShadowBlur',
          'boxShadowSpread',
          'boxShadowColor',
          'boxShadowInset',
          'overflow',
          'gridTemplateColumns',
          'gridTemplateColumnsTablet',
          'gridTemplateColumnsMobile',
          'gridFirstColumnPercent',
          'gridFirstColumnPercentTablet',
          'gridFirstColumnPercentMobile',
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
          'backgroundImage',
          'backgroundSize',
          'backgroundPosition',
          'backgroundPositionX',
          'backgroundPositionY',
          'backgroundPositionXTablet',
          'backgroundPositionYTablet',
          'backgroundPositionXMobile',
          'backgroundPositionYMobile',
          'backgroundRepeat',
          'backgroundOverlay',
          'backgroundAccentType',
          'backgroundAccentColor1',
          'backgroundAccentColor2',
          'backgroundAccentPositionX',
          'backgroundAccentPositionY',
          'backgroundAccentSize',
          'responsiveDisplay',
          'sticky',
          'stickyTop',
          'stickyResetAt',
          'visualTilt',
          'visualTiltResetAt',
        ],
        controls: [
          {
            type: 'select',
            props: ['flexDirection', 'flexDirectionTablet', 'flexDirectionMobile'],
            options: ['', 'row', 'column', 'row-reverse', 'column-reverse'],
          },
          {
            type: 'select',
            props: ['flexWrap', 'flexWrapTablet', 'flexWrapMobile'],
            options: ['', 'nowrap', 'wrap', 'wrap-reverse'],
          },
          {
            type: 'select',
            props: ['justifyContent', 'justifyContentTablet', 'justifyContentMobile'],
            options: ['', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
          },
          {
            type: 'select',
            props: ['alignItems', 'alignItemsTablet', 'alignItemsMobile'],
            options: ['', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
          },
          {
            type: 'select',
            props: ['gridTemplateColumns', 'gridTemplateColumnsTablet', 'gridTemplateColumnsMobile'],
            options: ['', 'one', 'two', 'two-proportional', 'three', 'four', 'six', 'sidebar-left-280', 'sidebar-left-320', 'sidebar-left-360', 'sidebar-right-280', 'sidebar-right-320', 'sidebar-right-360'],
          },
          {
            type: 'number',
            props: ['gridFirstColumnPercent', 'gridFirstColumnPercentTablet', 'gridFirstColumnPercentMobile'],
            min: 10,
            max: 90,
            step: 1,
          },
          {
            type: 'css-value',
            props: ['width', 'minWidth', 'flexBasis'],
            units: ['px', 'rem', '%', 'vw'],
          },
          {
            type: 'css-value',
            props: ['marginLeft', 'marginLeftTablet', 'marginLeftMobile'],
            units: ['px'],
            min: 0,
            max: 1440,
          },
          {
            type: 'number',
            props: ['flexGrow', 'flexShrink'],
            min: 0,
            max: 12,
            step: 0.01,
          },
          {
            type: 'select',
            props: ['backgroundPosition'],
            options: ['center', 'top', 'bottom', 'left', 'right'],
          },
          {
            type: 'select',
            props: ['boxShadow'],
            options: ['', 'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl'],
          },
          { type: 'css-value', props: ['boxShadowOffsetX'], units: ['px', 'rem', 'em'], min: -9999 },
          { type: 'css-value', props: ['boxShadowOffsetY'], units: ['px', 'rem', 'em'], min: -9999 },
          { type: 'css-value', props: ['boxShadowBlur'], units: ['px', 'rem', 'em'], min: 0, max: 2000 },
          { type: 'css-value', props: ['boxShadowSpread'], units: ['px', 'rem', 'em'], min: -9999, max: 9999 },
          { type: 'color', props: ['boxShadowColor'] },
          { type: 'toggle', props: ['boxShadowInset'] },
          { type: 'select', props: ['overflow'], options: ['', 'visible', 'hidden', 'clip', 'auto', 'scroll'] },
          {
            type: 'select',
            props: ['responsiveDisplay'],
            options: ['', 'hide-mobile', 'hide-tablet-down', 'show-mobile-only', 'show-tablet-down-only'],
          },
          { type: 'toggle', props: ['sticky'] },
          { type: 'css-value', props: ['stickyTop'], units: ['px', 'rem', 'em', 'vh'] },
          { type: 'select', props: ['stickyResetAt'], options: ['', 'tablet', 'mobile'] },
          {
            type: 'select',
            props: ['visualTilt'],
            options: ['', 'micro-left', 'micro-right', 'subtle-left', 'subtle-right', 'medium-left', 'medium-right'],
          },
          { type: 'select', props: ['visualTiltResetAt'], options: ['', 'tablet', 'mobile'] },
        ],
      },
      {
        name: 'Heading',
        allowedParents: ['Container'],
        props: ['text', 'content', 'children', 'tag', 'fontSize', 'fontSizeTablet', 'fontSizeMobile', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile', 'letterSpacing', 'letterSpacingTablet', 'letterSpacingMobile', 'fontWeight', 'fontFamily', 'textAlignTablet', 'textAlignMobile', 'textColor', 'marginTop', 'marginTopTablet', 'marginTopMobile', 'marginBottom', 'marginBottomTablet', 'marginBottomMobile'],
        controls: [
          {
            type: 'select',
            props: ['fontWeight'],
            options: ['300', '400', '500', '600', '700', '800', '900'],
          },
          {
            type: 'css-value',
            props: ['marginTop', 'marginTopTablet', 'marginTopMobile', 'marginBottom', 'marginBottomTablet', 'marginBottomMobile'],
            units: ['px', 'rem', 'em', '%'],
          },
        ],
      },
      {
        name: 'Text',
        allowedParents: ['Container'],
        props: ['text', 'content', 'children', 'display', 'fontSize', 'fontSizeTablet', 'fontSizeMobile', 'fontWeight', 'fontFamily', 'lineHeight', 'lineHeightTablet', 'lineHeightMobile', 'letterSpacing', 'letterSpacingTablet', 'letterSpacingMobile', 'textAlignTablet', 'textAlignMobile', 'textColor', 'backgroundColor', 'paddingY', 'paddingX', 'borderRadius', 'marginTop', 'marginTopTablet', 'marginTopMobile', 'marginBottom', 'marginBottomTablet', 'marginBottomMobile'],
        controls: [{
          type: 'css-value',
          props: ['marginTop', 'marginTopTablet', 'marginTopMobile', 'marginBottom', 'marginBottomTablet', 'marginBottomMobile'],
          units: ['px', 'rem', 'em', '%'],
        }],
      },
      {
        name: 'ButtonBlock',
        allowedParents: ['Container'],
        props: [
          'label',
          'text',
          'url',
          'href',
          'variant',
          'alignment',
          'buttonDisplay',
          'alignItems',
          'justifyContent',
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
          'borderRadius',
          'fontSize',
          'lineHeight',
          'letterSpacing',
          'fontWeight',
          'fontFamily',
          'textDecoration',
          'backgroundColor',
          'textColor',
        ],
      },
      {
        name: 'Divider',
        allowedParents: ['Section', 'Container'],
        props: ['dividerWidth', 'dividerThickness', 'dividerStyle', 'dividerColor', 'dividerAlign', 'dividerMargin'],
        controls: [
          { type: 'css-value', props: ['dividerWidth'], units: ['px', 'rem', 'em', '%', 'vw'] },
          { type: 'css-value', props: ['dividerThickness'], units: ['px', 'rem', 'em'], min: 1, max: 20 },
          { type: 'segment', props: ['dividerStyle'], options: ['solid', 'dashed', 'dotted', 'double'] },
          { type: 'color', props: ['dividerColor'] },
          { type: 'segment', props: ['dividerAlign'], options: ['left', 'center', 'right'] },
          { type: 'css-value', props: ['dividerMargin'], units: ['px', 'rem', 'em'], min: 0, max: 200 },
        ],
      },
      {
        name: 'ImageBlock',
        allowedParents: ['Section', 'Container'],
        props: ['src', 'alt', 'width', 'maxWidth', 'height', 'objectFit', 'objectPosition', 'borderRadius'],
        controls: [
          {
            type: 'select',
            props: ['objectFit'],
            options: ['cover', 'contain'],
          },
          {
            type: 'select',
            props: ['objectPosition'],
            options: ['', 'center', 'top', 'right', 'bottom', 'left', 'top left', 'top right', 'bottom left', 'bottom right'],
          },
        ],
      },
      {
        name: 'Navbar',
        allowedParents: ['Section', 'Container'],
        props: [
          'logoText', 'menuItems', 'mobileMenuBehavior', 'mobileMenuBreakpoint', 'menuButtonLabel',
          'menuButtonIcon', 'ctaLabel', 'ctaHref', 'showLogoMark', 'logoMarkSize',
          'logoMarkBorderRadius', 'logoMarkGradientColor1', 'logoMarkGradientColor2',
          'logoMarkGradientAngle', 'sticky', 'backgroundColor', 'borderColor', 'borderWidth',
          'borderRadius', 'innerPaddingY', 'innerPaddingX', 'innerGap', 'brandGap', 'logoTextColor',
          'logoFontSize', 'logoFontSizeTablet', 'logoFontSizeMobile', 'logoFontWeight',
          'menuGap', 'linkColor', 'linkFontSize', 'linkFontWeight',
          'ctaContentMode', 'ctaContentModeTablet', 'ctaContentModeMobile', 'ctaIcon', 'ctaCompactSize',
          'ctaBackgroundColor', 'ctaTextColor', 'ctaBorderRadius', 'ctaPaddingY', 'ctaPaddingX',
          'ctaFontSize', 'ctaFontWeight', 'label', 'href',
        ],
        controls: [{
          type: 'repeater',
          props: ['menuItems'],
          itemControls: [
            { type: 'text', props: ['label', 'href'] },
          ],
        }],
      },
      {
        name: 'TabsBlock',
        allowedParents: ['Section', 'Container'],
        props: [
          'tabs', 'defaultActiveTab', 'orientation', 'mobileTabLayout', 'layoutGap',
          'tabBarWidth', 'tabBarWidthTablet', 'tabBarWidthMobile', 'tabBarAlignment', 'tabGap',
          'tabWidth', 'tabWidthTablet', 'tabWidthMobile', 'tabMinHeight', 'tabMinHeightTablet', 'tabMinHeightMobile', 'tabBarBackgroundColor',
          'tabBarBorderColor', 'tabBarBorderWidth', 'tabBarBorderRadius', 'tabBarPadding',
          'tabTextColor', 'tabActiveTextColor', 'tabBackgroundColor', 'tabActiveBackgroundColor',
          'tabBorderColor', 'tabBorderWidth', 'tabActiveBorderColor', 'tabActiveBorderWidth',
          'tabFontSize', 'tabFontWeight', 'tabLineHeight', 'tabPaddingY', 'tabPaddingX',
          'tabMetaColor', 'tabActiveMetaColor', 'tabMetaFontSize', 'tabMetaFontWeight',
          'tabMetaGap', 'tabBorderRadius', 'tabTextAlign', 'showPanelTitle', 'panelBackgroundColor',
          'panelTextColor', 'panelPadding', 'panelBorderColor', 'panelBorderWidth',
          'panelBorderRadius', 'panelFontSize', 'panelLineHeight', 'panelGap',
          'panelAlignItems', 'panelContentMaxWidth', 'panelTitleColor', 'panelTitleFontSize',
          'panelTitleFontWeight', 'panelTitleLineHeight', 'panelTitleMarginBottom',
          'panelEyebrowColor', 'panelEyebrowFontSize', 'panelEyebrowFontWeight',
          'panelEyebrowLineHeight', 'panelEyebrowLineHeightTablet', 'panelEyebrowLineHeightMobile',
          'panelEyebrowMarginBottom', 'panelCtaBackgroundColor', 'panelCtaTextColor',
          'panelCtaBorderColor', 'panelCtaBorderWidth', 'panelCtaBorderRadius',
          'panelCtaPaddingY', 'panelCtaPaddingX', 'panelCtaMinHeight', 'panelCtaFontSize', 'panelCtaFontWeight',
          'panelCtaMarginTop',
          'tabFontSizeTablet', 'tabFontSizeMobile', 'panelPaddingTablet', 'panelPaddingMobile',
          'panelGapTablet', 'panelGapMobile', 'panelTitleFontSizeTablet', 'panelTitleFontSizeMobile',
          'panelTitleLineHeightTablet', 'panelTitleLineHeightMobile',
          'panelTitleMarginBottomTablet', 'panelTitleMarginBottomMobile',
          'panelEyebrowMarginBottomTablet', 'panelEyebrowMarginBottomMobile',
          'panelContentPaddingTop', 'panelContentPaddingTopTablet', 'panelContentPaddingTopMobile',
          'panelContentPaddingX', 'panelContentPaddingXTablet', 'panelContentPaddingXMobile',
          'panelContentPaddingBottom', 'panelContentPaddingBottomTablet', 'panelContentPaddingBottomMobile',
          'panelStackAt',
          'panelImagePosition', 'panelImageWidth', 'panelImageHeight', 'panelImageHeightTablet', 'panelImageHeightMobile', 'panelImageObjectFit',
          'panelImageObjectPosition', 'panelImageObjectPositionX', 'panelImageObjectPositionY',
          'panelImageObjectPositionXTablet', 'panelImageObjectPositionYTablet',
          'panelImageObjectPositionXMobile', 'panelImageObjectPositionYMobile', 'panelImageBorderRadius',
        ],
        controls: [
          { type: 'segment', props: ['orientation'], options: ['horizontal', 'vertical'] },
          { type: 'segment', props: ['mobileTabLayout'], options: ['scroll', 'wrap', 'stack'] },
          { type: 'segment', props: ['panelStackAt'], options: ['mobile', 'tablet'] },
          {
            type: 'select',
            props: ['tabFontWeight', 'tabMetaFontWeight', 'panelTitleFontWeight', 'panelEyebrowFontWeight', 'panelCtaFontWeight'],
            options: ['300', '400', '500', '600', '700', '800', '900'],
          },
          {
            type: 'repeater',
            props: ['tabs'],
            minItems: 1,
            maxItems: 12,
            itemControls: [
              { type: 'text', props: ['labelPrefix', 'label', 'labelSuffix', 'eyebrow', 'title'] },
              { type: 'textarea', props: ['content'] },
              { type: 'media', props: ['image'] },
              { type: 'text', props: ['imageAlt', 'ctaLabel', 'ctaUrl'] },
            ],
          },
        ],
      },
      {
        name: 'FormBlock',
        allowedParents: ['Section', 'Container'],
        props: [
          'fields', 'formColumns', 'submitLabel', 'formId', 'formGap', 'formMaxWidth', 'formAlignItems',
          'formPaddingY', 'formPaddingX', 'formBackgroundColor', 'formBorderWidth', 'formBorderColor',
          'formBorderRadius', 'fieldGap', 'labelFontSize', 'labelFontWeight', 'labelColor', 'requiredColor',
          'inputBorderColor', 'inputBorderWidth', 'inputBorderRadius', 'inputPaddingTop', 'inputPaddingRight',
          'inputPaddingBottom', 'inputPaddingLeft', 'inputBgColor', 'inputColor', 'inputFontSize',
          'inputFontWeight', 'inputHeight', 'inputFocusColor', 'checkboxSize', 'checkboxBorderColor',
          'checkboxBorderRadius', 'buttonAlignSelf', 'buttonMinHeight', 'buttonPaddingY', 'buttonPaddingX',
          'buttonBorderWidth', 'buttonBorderColor', 'buttonBorderRadius', 'buttonBackgroundColor',
          'buttonTextColor', 'buttonFontSize', 'buttonFontWeight',
        ],
        controls: [{
          type: 'repeater',
          props: ['fields'],
          itemControls: [
            { type: 'select', props: ['type'], options: ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'] },
            { type: 'text', props: ['name', 'label', 'placeholder', 'linkText', 'linkUrl'] },
            { type: 'toggle', props: ['required'] },
            { type: 'number', props: ['rows'], min: 2, max: 30, step: 1 },
            { type: 'textarea', props: ['options'] },
            { type: 'number', props: ['columnSpan'], min: 1, max: 2, step: 1 },
          ],
        }],
      },
      {
        name: 'StatsGrid',
        allowedParents: ['Container'],
        props: [
          'items', 'columns', 'columnsTablet', 'columnsMobile', 'cellBg', 'cellPadding',
          'borderColor', 'borderRadius', 'valueColor', 'labelColor', 'accentColor', 'metricOrder',
        ],
      },
    ];

  return {
    components: components.map((component) => ({
      ...component,
      aiProps: component.props,
    })),
  };
}

function visualBrief(overrides = {}) {
  const target = overrides.target || {};
  const text = overrides.text || {};
  const visualSignals = overrides.visualSignals || {};

  return {
    target: {
      variant: 'marketplace-service',
      archetype: 'optomatta-optical-retail',
      referenceStyle: 'optomatta-optical-retail',
      ...target,
    },
    visualSignals: {
      rootVariables: {},
      sections: [
        { tag: 'nav', className: 'nav' },
        { tag: 'section', className: 'hero' },
        { tag: 'section', className: 'service-strip' },
      ],
      ...visualSignals,
    },
    text: {
      h1: ['Secure clearer vision with precision eyewear.'],
      h2: ['Qualified Doctors, Emergency Care, 24 Hour Service'],
      h3: ['Eye exams', 'Frame fitting', 'Lens care'],
      ctas: ['Shop frames', 'Ask optometrist'],
      stats: ['28 doctors', '24h service', '4.9 rating'],
      ...text,
    },
    media: {
      surfaces: [
        { role: 'hero', placement: 'firstViewport', source: 'https://captured.example.test/hero.jpg' },
        { role: 'secondary', placement: 'firstViewport', source: 'https://captured.example.test/detail.jpg' },
        { role: 'service-card', placement: 'afterHero', source: 'https://captured.example.test/card-one.jpg' },
        { role: 'service-card', placement: 'afterHero', source: 'https://captured.example.test/card-two.jpg' },
        { role: 'service-card', placement: 'afterHero', source: 'https://captured.example.test/card-three.jpg' },
      ],
      requiredRoles: requiredMediaRoles(),
    },
    authoringRequirements: {
      requiredMediaRoles: requiredMediaRoles(),
      firstViewportMediaCoverage: {
        sourceLayout: 'desktop',
        target: 0.42,
        minimumCandidate: 0.21,
      },
    },
  };
}

function referenceManifest(brief = visualBrief()) {
  return {
    mediaSurfaces: brief.media.surfaces,
    requiredMediaRoles: brief.media.requiredRoles,
  };
}

function requiredMediaRoles() {
  return [
    { role: 'hero', minSurfaces: 1, placement: 'firstViewport' },
    { role: 'secondary', minSurfaces: 1, placement: 'firstViewport' },
    { role: 'service-card', minSurfaces: 3, placement: 'afterHero' },
  ];
}

function assertLeafParentsAreContainers(layout, types) {
  for (const [nodeId, nodeValue] of Object.entries(layout)) {
    const type = nodeValue?.type?.resolvedName || '';
    if (!types.includes(type)) {
      continue;
    }

    const parent = layout[nodeValue.parent];
    assert.equal(parent?.type?.resolvedName, 'Container', `${nodeId} (${type}) should be under Container`);
  }
}

function assertLeafNodesKeepCraftNodesArray(layout, types) {
  for (const [nodeId, nodeValue] of Object.entries(layout)) {
    const type = nodeValue?.type?.resolvedName || '';
    if (!types.includes(type)) {
      continue;
    }

    assert.deepEqual(nodeValue.nodes, [], `${nodeId} (${type}) should keep nodes: [] for REST structure validation`);
  }
}

function assertUserFacingNodePropsAreOriginal(layout) {
  for (const [nodeId, nodeValue] of Object.entries(layout)) {
    for (const [propName, propValue] of Object.entries(nodeValue?.props || {})) {
      if (!userFacingNodePropNames.has(propName)) {
        continue;
      }

      for (const value of collectUserFacingStrings(propValue)) {
        for (const [label, pattern] of prohibitedUserFacingCopy) {
          assert.doesNotMatch(value, pattern, `${nodeId}.props.${propName} contains ${label}: ${value}`);
        }
      }
    }
  }
}

function collectUserFacingStrings(value) {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectUserFacingStrings);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectUserFacingStrings);
  }

  return [];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
