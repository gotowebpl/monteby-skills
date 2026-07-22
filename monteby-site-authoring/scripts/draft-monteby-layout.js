#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { safeCapturedFontFamily } = require('./capture-template-reference');
const {
  PROPORTIONAL_GRID_TOKEN,
  measureEqualColumnGrid,
  measureTwoColumnGrid,
} = require('./measured-grid-geometry');
const { googleFontToken } = require('./render-monteby-preview');

const DEFAULT_REPLACEMENT_PROFILE = {
  name: 'generic-service',
  brand: 'Northline',
  lead: 'Practical service, clear choices, and thoughtful imagery help visitors move forward with confidence.',
  serviceCopy: [
    'A focused service path with clear benefit copy and room for proof details.',
    'A supporting offer with clear benefits, useful detail, and a welcoming experience.',
    'A confident next step with the details visitors need to make a decision.',
  ],
  proof: {
    eyebrow: 'TRUSTED SERVICE',
    title: 'Helpful service details before you book.',
    body: 'See the service, compare the proof, and choose the next step with confidence.',
    cta: 'Plan service',
  },
  style: {
    bg: '#f4f8ff',
    panel: '#ffffff',
    ink: '#101318',
    muted: '#5f6670',
    accent: '#0788d8',
    accent2: '#0a6fa7',
    badgeBackground: '#edf7ff',
    navBackground: '#ffffff',
    cardBackground: '#ffffff',
    cardInk: '#101318',
    cardMuted: '#68717c',
    buttonBg: '#101318',
    buttonFg: '#ffffff',
  },
  geometry: {
    maxWidth: '1200px',
    radius: '22px',
    heroMinHeight: '620px',
    visualMinHeight: '520px',
    secondaryMinHeight: '180px',
    serviceMediaMinHeight: '180px',
  },
  hero: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=82',
  secondary: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=82',
  serviceCard: [
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=700&q=80',
  ],
};

const GENERIC_MEASURED_REFERENCE = 'generic-measured-reference';
const MAX_GENERIC_REFERENCE_BANDS = 24;
const MAX_GENERIC_REFERENCE_MEDIA_PER_BAND = 8;
const MAX_GENERIC_REFERENCE_MEDIA_DIMENSION = 8192;
const MAX_GENERIC_REFERENCE_MEDIA_SCALE = 4;
const GENERIC_GRID_TOKENS = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
};
const GENERIC_VISUAL_TILT_TOKENS = new Set([
  'micro-left',
  'micro-right',
  'subtle-left',
  'subtle-right',
  'medium-left',
  'medium-right',
]);
const SYSTEM_FONT_CANONICAL_VALUES = new Map([
  ['-apple-system', 'system-ui'],
  ['arial', '_system_Arial'],
  ['blinkmacsystemfont', 'system-ui'],
  ['courier', '_system_Courier'],
  ['courier new', '_system_Courier'],
  ['cursive', 'cursive'],
  ['fantasy', 'fantasy'],
  ['fangsong', 'fangsong'],
  ['geneva', '_system_Verdana'],
  ['georgia', '_system_Georgia'],
  ['helvetica', '_system_Helvetica'],
  ['helvetica neue', '_system_Helvetica'],
  ['math', 'math'],
  ['monospace', 'monospace'],
  ['sans-serif', 'sans-serif'],
  ['segoe ui', 'system-ui'],
  ['serif', 'serif'],
  ['system-ui', 'system-ui'],
  ['times', '_system_Times'],
  ['times new roman', '_system_Times'],
  ['trebuchet ms', '_system_Trebuchet'],
  ['ui-monospace', 'monospace'],
  ['ui-rounded', 'system-ui'],
  ['ui-sans-serif', 'system-ui'],
  ['ui-serif', 'serif'],
  ['verdana', '_system_Verdana'],
]);
const GENERIC_BAND_CONTENT = [
  ['Northline', 'Clear choices, useful details, and a calm way to begin.'],
  ['A Strong First Impression', 'A focused opening brings the most important idea into view with confidence.'],
  ['Built Around Everyday Needs', 'Thoughtful structure makes each option easier to understand and compare.'],
  ['Details That Earn Attention', 'Useful information and balanced imagery keep the experience clear and inviting.'],
  ['A Practical Way Forward', 'Simple steps help people move from interest to a confident decision.'],
  ['Proof at a Glance', 'Concise facts add context without interrupting the wider story.'],
  ['Made for Real Routines', 'Flexible choices support different needs, timings, and priorities.'],
  ['Experience in Every Detail', 'Careful decisions create a result that feels consistent from start to finish.'],
  ['Thoughtful Work, Clearly Shared', 'A balanced presentation gives each idea enough room to be understood.'],
  ['Support When It Matters', 'Helpful guidance keeps the next step simple, direct, and reassuring.'],
  ['A Closer Look', 'Selected highlights bring the character and quality of the work into focus.'],
  ['Designed to Feel Effortless', 'Strong foundations and clear communication make the process easier to follow.'],
  ['Trusted by Busy People', 'Reliable delivery and useful updates help every decision feel well supported.'],
  ['Explore the Possibilities', 'A varied selection creates room for different goals and preferences.'],
  ['Quality You Can See', 'Visible care and practical detail give the work a lasting sense of confidence.'],
  ['Meet the People Behind the Work', 'Experienced specialists bring clarity, attention, and steady guidance.'],
  ['Useful Ideas for What Comes Next', 'Short observations offer practical value beyond the immediate decision.'],
  ['Questions, Answered Clearly', 'Direct explanations remove uncertainty and keep planning straightforward.'],
  ['Ready When You Are', 'Choose a comfortable next step and continue with a clear sense of direction.'],
  ['Stay in the Loop', 'Occasional updates bring useful news and timely ideas to your inbox.'],
  ['A Simple Closing Note', 'Everything important remains easy to find as the page comes to a close.'],
  ['More Ways to Connect', 'Useful contact paths make it easy to reach the right person.'],
  ['Plan the Next Step', 'A clear invitation keeps momentum without adding pressure.'],
  ['Northline, Close at Hand', 'Essential details and helpful links remain available whenever they are needed.'],
];
const GENERIC_SHORT_COPY = [
  'OK',
  'View',
  'Review',
  'Clear idea',
  'Next step',
  'Useful detail',
  'Steady progress',
  'Trusted support',
  'A practical choice',
  'Clear direction',
  'A thoughtful approach',
  'Useful details for every step',
  'Clear choices make each next step easier.',
  'Practical guidance supports a confident decision.',
];
const GENERIC_CTA_COPY = [
  'Go',
  'View',
  'Review',
  'Explore',
  'Start here',
  'Learn more',
  'See details',
  'Plan a visit',
  'Explore details',
  'Start a conversation',
];
const GENERIC_STAT_COPY = [
  '01',
  '24+',
  '4.9',
  '99%',
  '12 projects',
  '20+ years',
  'Over 20 years',
];
const GENERIC_REPLACEMENT_MEDIA = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=82',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=82',
];

const REPLACEMENT_PROFILES = [
  {
    name: 'luxury-car-care',
    match: ['luxury-car-care', 'careglo', 'car-detailing', 'detailing', 'car care'],
    brand: 'Aureline',
    heroEyebrow: 'A finish engineered to last',
    heroHeading: 'Crafted Care for a Lasting First Impression.',
    navCta: 'Reserve a Visit',
    primaryCta: 'Reserve Your Detail',
    secondaryCta: 'Explore Treatments',
    lead: 'Premium detailing, protective finishes, and appointment-ready care for high-value vehicles.',
    serviceCopy: [
      'Exterior and paint-safe detailing built around premium finish quality.',
      'Interior reset work with careful materials, equipment, and hand-finished surfaces.',
      'Protection packages that keep the vehicle looking sharp between visits.',
    ],
    proof: {
      eyebrow: 'SIGNATURE SLOT',
      title: 'Reserve a detail bay in under three minutes.',
      body: 'Choose a treatment, reserve a time, and arrive knowing every finish detail is covered.',
      cta: 'Book detailing now',
    },
    style: {
      bg: '#0b0d12',
      panel: '#151820',
      ink: '#fff7ea',
      muted: '#a7adb9',
      accent: '#f5b66f',
      accent2: '#c88845',
      badgeBackground: '#171b23',
      navBackground: '#12151b',
      cardBackground: '#11141a',
      cardInk: '#fff7ea',
      cardMuted: '#a7adb9',
      buttonBg: '#f5b66f',
      buttonFg: '#18110a',
    },
    geometry: {
      maxWidth: '1220px',
      radius: '28px',
      heroMinHeight: '660px',
      visualMinHeight: '560px',
      secondaryMinHeight: '220px',
      serviceMediaMinHeight: '220px',
    },
    hero: 'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=1600',
    secondary: 'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=900',
    serviceCard: [
      'https://images.pexels.com/photos/17029940/pexels-photo-17029940/free-photo-of-back-view-of-a-woman-cleaning-a-car.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=900',
    ],
  },
  {
    name: 'maid-service-agency',
    match: ['maid-service-agency', 'maidy', 'cleaning', 'home care', 'maid service'],
    brand: 'Tidyra',
    email: 'hello@tidyra.example',
    lead: 'Home cleaning, routine upkeep, and simple booking for spaces that need to feel calm again.',
    serviceCopy: [
      'Room-by-room cleaning for recurring home care and tidy weekly routines.',
      'Equipment-led deep cleaning for kitchens, bathrooms, and high-touch areas.',
      'Move-in and office refresh services with clear scope and fast scheduling.',
    ],
    proof: {
      eyebrow: 'QUICK BOOKING',
      title: 'Schedule a refresh before the week gets busy.',
      body: 'Choose the rooms, timing, and level of care that make the week feel lighter.',
      cta: 'Book cleaning',
    },
    style: {
      bg: '#f7f7f4',
      panel: '#ffffff',
      ink: '#060708',
      muted: '#7f817d',
      accent: '#315f4f',
      accent2: '#ffdd67',
      badgeBackground: '#f0eee8',
      navBackground: '#ffffff',
      cardBackground: '#ffffff',
      cardInk: '#060708',
      cardMuted: '#7f817d',
      buttonBg: '#203740',
      buttonFg: '#ffffff',
    },
    geometry: {
      maxWidth: '1240px',
      radius: '26px',
      heroMinHeight: '720px',
      visualMinHeight: '560px',
      secondaryMinHeight: '220px',
      serviceMediaMinHeight: '210px',
    },
    hero: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=82',
    secondary: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=82',
    equipment: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=760&q=82&ix=monteby-equipment',
    serviceCard: [
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    name: 'optomatta-optical-retail',
    match: ['optomatta-optical-retail', 'optomatta', 'optical retail', 'eyewear', 'optometrist'],
    brand: 'Opticline',
    heroEyebrow: 'VISION & FRAME STUDIO',
    heroHeading: 'Clear vision, thoughtfully fitted',
    primaryCta: 'Plan an Eye Exam',
    secondaryCta: 'Explore Eyewear',
    lead: 'Modern eyewear, eye exams, and appointment support presented with bright retail clarity.',
    serviceCopy: [
      'Vision exams and optical guidance for clearer daily routines.',
      'Frame fitting support with practical guidance on style, comfort, and appointment timing.',
      'Lens care and follow-up services designed for long-term comfort.',
    ],
    proof: {
      eyebrow: 'VISION READY',
      title: 'Match the right frame and exam path faster.',
      body: 'Compare frames, plan an exam, and leave with a clearer path to everyday comfort.',
      cta: 'Book eye exam',
    },
    style: {
      bg: '#ffffff',
      panel: '#f4f6f9',
      ink: '#090d13',
      muted: '#5f6670',
      accent: '#0788d8',
      accent2: '#0a6fa7',
      badgeBackground: '#eef7ff',
      navBackground: '#ffffff',
      cardBackground: '#f4f6f9',
      cardInk: '#090d13',
      cardMuted: '#5f6670',
      buttonBg: '#0788d8',
      buttonFg: '#ffffff',
    },
    geometry: {
      maxWidth: '1220px',
      radius: '24px',
      heroMinHeight: '680px',
      visualMinHeight: '540px',
      secondaryMinHeight: '200px',
      serviceMediaMinHeight: '200px',
    },
    hero: 'https://images.pexels.com/photos/6749748/pexels-photo-6749748.jpeg?auto=compress&cs=tinysrgb&w=1800',
    secondary: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1000&q=82',
    serviceCard: [
      'https://images.unsplash.com/photo-1517948430535-1e2469d314fe?auto=format&fit=crop&w=900&q=82',
      'https://images.unsplash.com/photo-1486250944723-86bca2b15b06?auto=format&fit=crop&w=900&q=82',
      'https://images.unsplash.com/photo-1743038560986-3b346b7c3b22?auto=format&fit=crop&w=900&q=82',
    ],
  },
  {
    name: 'lumen-eye-care-editorial',
    match: ['lumen-eye-care-editorial', 'lumen', 'eye care', 'doctor', 'clinic'],
    brand: 'CLEARWELL',
    lead: 'Editorial eye care, specialist guidance, and calm appointment pathways for everyday vision health.',
    serviceCopy: [
      'Vision testing shaped around clear communication and comfortable care rooms.',
      'Specialist consultations with a calmer clinical pace and proof-led guidance.',
      'Treatment planning that turns eye-care details into easy next steps.',
    ],
    proof: {
      eyebrow: 'CARE NOTE',
      title: 'Qualified eye care, explained clearly',
      body: 'Every examination combines professional attention, calm guidance, and practical next steps.',
      cta: 'Start visit',
    },
    style: {
      bg: '#eefbe3',
      panel: '#ffffff',
      ink: '#061a27',
      muted: '#526271',
      accent: '#0f7768',
      accent2: '#2fd678',
      badgeBackground: '#f8ffdc',
      navBackground: '#eefbe3',
      cardBackground: '#ffffff',
      cardInk: '#061a27',
      cardMuted: '#526271',
      buttonBg: '#0f7768',
      buttonFg: '#ffffff',
    },
    geometry: {
      maxWidth: '1280px',
      radius: '30px',
      heroMinHeight: '780px',
      visualMinHeight: '640px',
      secondaryMinHeight: '220px',
      serviceMediaMinHeight: '220px',
    },
    hero: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1200&q=82',
    secondary: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=900&q=82',
    serviceCard: [
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=700&q=80',
    ],
  },
];

const OPTOMATTA_CANVAS_WIDTH = '1440px';
const CAREGLO_CANVAS_WIDTH = '1440px';
const CAREGLO_AVATAR_IMAGES = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
];
const LUMEN_CANVAS_WIDTH = '1440px';

function parseArgs(argv) {
  const options = {
    contract: '',
    startReport: '',
    briefJson: '',
    out: '',
    referenceManifest: '',
    minMediaSurfaces: null,
    requireRealReference: false,
    requireMarketplaceMedia: false,
    preserveSourceText: false,
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
    } else if (arg === '--out') {
      options.out = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--reference-manifest') {
      options.referenceManifest = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--min-media-surfaces') {
      options.minMediaSurfaces = parseNonNegativeInteger(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--require-real-reference') {
      options.requireRealReference = true;
    } else if (arg === '--require-marketplace-media') {
      options.requireMarketplaceMedia = true;
    } else if (arg === '--preserve-source-text') {
      options.preserveSourceText = true;
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
  if (!options.out) {
    throw new Error('--out is required');
  }

  return options;
}

function parseNonNegativeInteger(value, arg) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${arg} must be a non-negative integer.`);
  }
  return parsed;
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
  draft-monteby-layout.js --contract contract.json (--start-report benchmark-start-report.json | --brief-json visual-brief.json) --out layout-draft.json [--reference-manifest reference-manifest.json] [--require-real-reference] [--require-marketplace-media] [--preserve-source-text] [--json]

Writes a clean Monteby JSON draft from a visual brief and live contract. When --reference-manifest is provided, the draft is immediately audited for blocked props, placement, and replacement media roles. This is a first-pass scaffold only; do not treat it as a pixel-perfect result.`);
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

  const referenceClassification = startReport.options?.referenceClassification;
  if (!referenceClassification || typeof referenceClassification !== 'object') {
    return startReport.visualBrief;
  }

  return {
    ...startReport.visualBrief,
    authoringRequirements: {
      ...(startReport.visualBrief.authoringRequirements || {}),
      referenceClassification,
    },
  };
}

function briefWithReferenceMediaRequirements(brief, referenceManifest, options = {}) {
  const requiredMediaRoles = Array.isArray(referenceManifest?.requiredMediaRoles)
    ? referenceManifest.requiredMediaRoles
    : [];
  const realReferenceSourceUrl = typeof referenceManifest?.sourceUrl === 'string' ? referenceManifest.sourceUrl.trim() : '';
  const requiresRealReference = options.requireRealReference === true || /^https?:\/\//i.test(realReferenceSourceUrl);
  const referenceGeometry = referenceManifest && options.referenceManifest
    ? referenceGeometryFromManifest(referenceManifest, options.referenceManifest)
    : null;

  if (requiredMediaRoles.length === 0 && requiresRealReference === false && !referenceGeometry) {
    return brief;
  }

  return {
    ...brief,
    authoringRequirements: {
      ...(brief.authoringRequirements || {}),
      requiredMediaRoles,
      requireRealReference: requiresRealReference,
      preserveSourceText: options.preserveSourceText === true
        || brief.authoringRequirements?.preserveSourceText === true,
      reuseSourceMedia: brief.authoringRequirements?.reuseSourceMedia === true,
      realReferenceSourceUrl: realReferenceSourceUrl || undefined,
      referenceGeometry: referenceGeometry || undefined,
    },
  };
}

function referenceGeometryFromManifest(referenceManifest, manifestPath) {
  const manifestDirectory = path.dirname(manifestPath);
  const entries = Array.isArray(referenceManifest.layouts)
    ? referenceManifest.layouts
    : Array.isArray(referenceManifest.layoutCapture?.layouts)
      ? referenceManifest.layoutCapture.layouts
      : referenceManifest.layout
        ? [{ label: 'desktop', file: referenceManifest.layout, status: referenceManifest.layoutCapture?.status || 'ok' }]
        : [];
  const geometry = {};

  for (const entry of entries) {
    if (!entry || entry.status === 'failed' || !entry.file) {
      continue;
    }
    const file = path.resolve(manifestDirectory, String(entry.file));
    if (!fs.existsSync(file)) {
      continue;
    }
    const label = slugify(entry.label || 'desktop');
    geometry[label] = summarizeReferenceLayout(readJson(file));
  }

  const briefJsonFile = typeof referenceManifest.briefJson === 'string'
    ? path.resolve(manifestDirectory, referenceManifest.briefJson)
    : '';
  if (briefJsonFile && fs.existsSync(briefJsonFile)) {
    const referenceBrief = readJson(briefJsonFile);
    const renderedLayouts = Array.isArray(referenceBrief.renderedLayouts) ? referenceBrief.renderedLayouts : [];
    for (const renderedLayout of renderedLayouts) {
      if (!renderedLayout || renderedLayout.status !== 'ok') {
        continue;
      }
      const label = slugify(renderedLayout.label || 'desktop');
      if (!geometry[label] || geometry[label].bands.length === 0) {
        geometry[label] = summarizeReferenceLayout({
          viewport: renderedLayout.viewport,
          summary: renderedLayout.firstViewport,
          landmarks: renderedLayout.landmarks,
          textBoxes: renderedLayout.textSamples,
          mediaBoxes: renderedLayout.mediaSamples,
        });
      }
    }
  }

  const canonicalHeroSource = String(geometry.desktop?.heroMedia?.source || '').trim();
  if (canonicalHeroSource) {
    for (const viewportGeometry of Object.values(geometry)) {
      const matchingHero = viewportGeometry.earlyMedia
        ?.find((media) => String(media?.source || '').trim() === canonicalHeroSource);
      viewportGeometry.canonicalHeroMedia = matchingHero || viewportGeometry.heroMedia;
    }
  }

  return Object.keys(geometry).length > 0 ? geometry : null;
}

function summarizeReferenceLayout(layout) {
  const textBoxes = Array.isArray(layout?.textBoxes) ? layout.textBoxes : [];
  const mediaBoxes = Array.isArray(layout?.meaningfulMediaBoxes)
    ? layout.meaningfulMediaBoxes
    : Array.isArray(layout?.mediaBoxes) ? layout.mediaBoxes : [];
  const meaningfulMedia = mediaBoxes
    .filter((box) => isMeaningfulReferenceMediaBox(box, layout?.viewport))
    .sort((a, b) => referenceBoxTop(a) - referenceBoxTop(b));
  const firstViewportMedia = meaningfulMedia
    .filter((box) => Number(box?.firstViewportArea || 0) > 0)
    .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0));
  const pageMediaByArea = meaningfulMedia
    .slice()
    .sort((a, b) => referenceBoxArea(b) - referenceBoxArea(a));
  const heroMedia = firstViewportMedia[0] || pageMediaByArea[0] || null;
  const secondaryMedia = firstViewportMedia.find((box) => box !== heroMedia)
    || meaningfulMedia.find((box) => box !== heroMedia)
    || null;
  const heroHeading = textBoxes.find((box) => /Detailing That Defines/i.test(String(box?.text || '')))
    || textBoxes
      .filter((box) => ['h1', 'h2'].includes(String(box?.tag || '').toLowerCase()))
      .sort((a, b) => Number(b.firstViewportArea || 0) - Number(a.firstViewportArea || 0))[0]
    || null;
  const viewportWidth = Number(layout?.viewport?.width || 0);
  const pageHeight = referencePageHeight(layout);
  const measuredOverflow = Number(layout?.horizontalOverflow?.overflowPx);
  const documentScrollWidth = Number(layout?.horizontalOverflow?.documentScrollWidth ?? layout?.viewport?.scrollWidth);
  const pageHasNoHorizontalScroll = Number.isFinite(measuredOverflow)
    ? measuredOverflow <= 1
    : viewportWidth > 0 && Number.isFinite(documentScrollWidth) && documentScrollWidth <= viewportWidth + 1;
  const pageClipsHorizontalOverflow = pageHasNoHorizontalScroll
    && viewportWidth > 0
    && pageHeight > 0
    && (Array.isArray(layout?.layoutGroups) ? layout.layoutGroups : []).some((group) => {
      const rect = normalizeReferenceRect(group?.rect);
      const overflow = String(group?.overflow || '').trim().toLowerCase();
      return rect
        && ['hidden', 'clip'].includes(overflow)
        && rect.left <= 1
        && rect.right >= viewportWidth - 1
        && rect.top <= 1
        && rect.bottom >= pageHeight - 2;
    });
  const bands = summarizeReferenceBands(layout, textBoxes, meaningfulMedia, pageClipsHorizontalOverflow);
  const navigation = summarizeReferenceNavigation(layout, textBoxes);

  return {
    viewport: layout?.viewport || null,
    documentStyle: layout?.documentStyle && typeof layout.documentStyle === 'object'
      ? layout.documentStyle
      : null,
    summary: layout?.summary || null,
    pageHeight,
    pageClipsHorizontalOverflow,
    bands,
    navigation,
    heroHeading: summarizeReferenceBox(heroHeading),
    heroMedia: summarizeReferenceBox(heroMedia),
    secondaryMedia: summarizeReferenceBox(secondaryMedia),
    earlyMedia: meaningfulMedia.slice(0, 4).map(summarizeReferenceBox),
  };
}

function summarizeReferenceNavigation(layout, textBoxes) {
  const viewportWidth = Number(layout?.viewport?.width || 0);
  const candidates = (Array.isArray(layout?.landmarks) ? layout.landmarks : [])
    .map((landmark) => summarizeReferenceLandmark(landmark, viewportWidth, referencePageHeight(layout)))
    .filter((landmark) => (
      landmark
      && ['nav', 'header'].includes(landmark.tag)
      && landmark.rect.top <= 120
      && landmark.rect.height >= 40
      && landmark.rect.height <= 180
      && (
        landmark.flowParticipation === 'overlay'
        || (
          landmark.tag === 'nav'
          && viewportWidth > 0
          && landmark.rect.width >= viewportWidth * 0.55
        )
      )
    ))
    .sort((left, right) => (
      (left.tag === 'nav' ? 0 : 1) - (right.tag === 'nav' ? 0 : 1)
      || left.rect.top - right.rect.top
      || right.rect.width - left.rect.width
    ));
  const navigation = candidates[0];
  if (!navigation) {
    return null;
  }

  const belongsToNavigationStructure = (box) => {
    const structureKey = String(box?.structureKey || '');
    const parentGroupKey = String(box?.parentGroupKey || '');
    if (!navigation.key || (!structureKey && !parentGroupKey)) {
      return true;
    }
    return structureKey === navigation.key
      || structureKey.startsWith(`${navigation.key}.`)
      || parentGroupKey === navigation.key
      || parentGroupKey.startsWith(`${navigation.key}.`);
  };
  const rawTextBoxes = (Array.isArray(textBoxes) ? textBoxes : [])
    .filter((box) => referenceBoxBelongsToBand(box, navigation.rect) && belongsToNavigationStructure(box));
  const interactionBoxes = (Array.isArray(layout?.interactions) ? layout.interactions : [])
    .filter((box) => referenceBoxBelongsToBand(box, navigation.rect) && belongsToNavigationStructure(box))
    .sort((left, right) => Number(left?.rect?.left || 0) - Number(right?.rect?.left || 0));
  const authoredTextBoxes = referenceTextBoxesForAuthoring(rawTextBoxes)
    .slice()
    .sort((left, right) => (
      Number(left?.rect?.left || left?.rect?.x || 0) - Number(right?.rect?.left || right?.rect?.x || 0)
      || referenceBoxTop(left) - referenceBoxTop(right)
    ));
  if (authoredTextBoxes.length === 0 && interactionBoxes.length === 0) {
    return null;
  }

  const brandBox = authoredTextBoxes[0] || interactionBoxes[0];
  const brandRect = normalizeReferenceRect(brandBox?.rect);
  const logoMarkGroup = (Array.isArray(layout?.layoutGroups) ? layout.layoutGroups : [])
    .filter((group) => {
      const rect = normalizeReferenceRect(group?.rect);
      if (!rect || !brandRect || group?.paintedBackground !== true) {
        return false;
      }
      const aspectRatio = rect.width / rect.height;
      return String(group?.parentKey || '') === String(brandBox?.parentGroupKey || '')
        && rect.width >= 16
        && rect.width <= 96
        && rect.height >= 16
        && rect.height <= 96
        && aspectRatio >= 0.7
        && aspectRatio <= 1.4
        && rect.right <= brandRect.left + 2
        && brandRect.left - rect.right <= 40
        && Math.abs((rect.top + rect.height / 2) - (brandRect.top + brandRect.height / 2)) <= 20;
    })
    .sort((left, right) => Number(right?.rect?.right || 0) - Number(left?.rect?.right || 0))[0];
  const menuTriggerBoxes = interactionBoxes.filter((box) => {
    if (String(box?.role || '') !== 'button') {
      return false;
    }
    const rect = normalizeReferenceRect(box?.rect);
    if (!rect || rect.width > 96 || rect.height > 72 || rect.height < 28 || rect.width / rect.height > 2.2) {
      return false;
    }
    const interactionKey = String(box?.structureKey || '');
    const hasAssociatedText = rawTextBoxes.some((textBox) => {
      const textKey = String(textBox?.structureKey || '');
      return interactionKey && (textKey === interactionKey || textKey.startsWith(`${interactionKey}.`));
    });
    return box?.state?.expanded !== null && box?.state?.expanded !== undefined
      || !hasAssociatedText;
  });
  const paintedBoxes = authoredTextBoxes.filter((box) => (
    normalizedAuthorableColor(box?.backgroundColor)
    && !/^(?:transparent|rgba\([^)]*,\s*0(?:\.0+)?\s*\))$/iu.test(String(box?.backgroundColor || '').trim())
  ));
  const ctaBox = paintedBoxes
    .filter((box) => box !== brandBox)
    .sort((left, right) => referenceBoxArea(right) - referenceBoxArea(left))[0]
    || (authoredTextBoxes.length > 1
      ? authoredTextBoxes.at(-1)
      : interactionBoxes.filter((box) => !menuTriggerBoxes.includes(box)).at(-1))
    || brandBox;
  const menuBoxes = authoredTextBoxes.filter((box) => box !== brandBox && box !== ctaBox);
  const nestedBrandText = rawTextBoxes.find((box) => (
    box !== brandBox
    && String(box?.structureKey || '').startsWith(`${String(brandBox?.structureKey || '')}.`)
    && String(box?.text || '').trim() === String(brandBox?.text || '').trim()
  ));

  return {
    ...navigation,
    brandBox: summarizeReferenceBox(brandBox),
    menuBoxes: menuBoxes.map(summarizeReferenceBox),
    ctaBox: summarizeReferenceBox(ctaBox),
    hasCta: ctaBox !== brandBox,
    logoMark: logoMarkGroup ? {
      ...summarizeReferenceBox(logoMarkGroup),
      paintedBackground: true,
    } : null,
    showLogoMark: Boolean(
      logoMarkGroup
      || (nestedBrandText && referenceBoxArea(brandBox) > referenceBoxArea(nestedBrandText) * 1.45)
    ),
    hasMenuTrigger: menuTriggerBoxes.length > 0,
  };
}

function summarizeReferenceBands(layout, textBoxes, meaningfulMedia, pageClipsHorizontalOverflow) {
  const viewportWidth = Number(layout?.viewport?.width || 0);
  const pageHeight = referencePageHeight(layout);
  if (viewportWidth <= 0 || pageHeight <= 0 || !Array.isArray(layout?.landmarks)) {
    return [];
  }

  const candidates = layout.landmarks
    .map((landmark) => summarizeReferenceLandmark(landmark, viewportWidth, pageHeight))
    .filter((landmark) => landmark && landmark.flowParticipation !== 'overlay')
    .sort((left, right) => left.rect.top - right.rect.top || right.rect.height - left.rect.height);
  const withoutPageWrappers = candidates.filter((candidate) => !isReferencePageWrapper(candidate, candidates));
  const rootBandCandidates = withoutPageWrappers.filter((candidate) => {
    const nestedInMajorLandmark = candidate.key && withoutPageWrappers.some((parent) => (
      parent !== candidate
      && parent.key
      && candidate.key.startsWith(`${parent.key}.`)
      && ['section', 'header', 'footer', 'nav'].includes(parent.tag)
      && referenceRectContains(parent.rect, candidate.rect)
    ));
    if (nestedInMajorLandmark) {
      return false;
    }
    if (!['article', 'aside'].includes(candidate.tag)) {
      return true;
    }
    return !withoutPageWrappers.some((parent) => (
      parent !== candidate
      && ['section', 'header', 'footer', 'nav'].includes(parent.tag)
      && parent.rect.width * parent.rect.height > candidate.rect.width * candidate.rect.height * 1.08
      && referenceRectContains(parent.rect, candidate.rect)
    ));
  });
  const bands = [];

  for (const candidate of rootBandCandidates) {
    const duplicateIndex = bands.findIndex((band) => referenceBandsOverlapAsDuplicate(band, candidate));
    if (duplicateIndex === -1) {
      bands.push(candidate);
      continue;
    }
    if (referenceLandmarkRank(candidate.tag) > referenceLandmarkRank(bands[duplicateIndex].tag)) {
      bands[duplicateIndex] = candidate;
    }
  }

  const summarizedBands = bands
    .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left)
    .map((band, index) => summarizeReferenceBandContent(
      band,
      index,
      viewportWidth,
      textBoxes,
      meaningfulMedia,
      layout.landmarks,
      layout.layoutGroups,
      layout.interactions,
      pageClipsHorizontalOverflow
    ));

  return summarizedBands.map((band, index) => {
    const previousBand = summarizedBands[index - 1];
    const nextTop = summarizedBands[index + 1]?.rect?.top;
    const flowBottom = Number.isFinite(nextTop) ? nextTop : pageHeight;
    const flowTop = index === 0 ? 0 : band.rect.top;
    const precedingPaintedGap = previousBand?.paintedBackground === true
      ? Math.max(0, band.rect.top - previousBand.rect.bottom)
      : 0;
    return {
      ...band,
      leadingOffset: Math.max(0, band.rect.top - flowTop),
      precedingPaintedGap,
      precedingOverlap: previousBand ? Math.max(0, previousBand.rect.bottom - band.rect.top) : 0,
      flowHeight: Math.max(band.rect.height, flowBottom - flowTop),
    };
  });
}

function summarizeReferenceLandmark(landmark, viewportWidth, pageHeight) {
  if (!landmark || typeof landmark !== 'object') {
    return null;
  }
  const rect = normalizeReferenceRect(landmark.rect);
  const key = String(landmark.groupKey || landmark.key || '');
  const tag = String(landmark.tag || 'section').toLowerCase();
  const rootSemanticBand = /^\d+\.\d+$/u.test(key)
    && ['section', 'header', 'footer', 'nav'].includes(tag);
  const minimumRootBandWidth = Math.min(240, viewportWidth * 0.5);
  if (
    !rect
    || rect.height < 40
    || (rect.width < viewportWidth * 0.72 && (!rootSemanticBand || rect.width < minimumRootBandWidth))
    || rect.top >= pageHeight
    || rect.bottom <= 0
  ) {
    return null;
  }

  return {
    key,
    tag,
    rootSemanticBand,
    rect,
    backgroundColor: String(landmark.backgroundColor || ''),
    backgroundType: String(landmark.backgroundType || ''),
    gradientType: String(landmark.gradientType || ''),
    gradientAngle: landmark.gradientAngle,
    gradientColor1: String(landmark.gradientColor1 || ''),
    gradientColor2: String(landmark.gradientColor2 || ''),
    backgroundAccentType: String(landmark.backgroundAccentType || ''),
    backgroundAccentColor1: String(landmark.backgroundAccentColor1 || ''),
    backgroundAccentColor2: String(landmark.backgroundAccentColor2 || ''),
    backgroundAccentPositionX: String(landmark.backgroundAccentPositionX || ''),
    backgroundAccentPositionY: String(landmark.backgroundAccentPositionY || ''),
    backgroundAccentSize: String(landmark.backgroundAccentSize || ''),
    display: String(landmark.display || ''),
    flexDirection: String(landmark.flexDirection || ''),
    flexWrap: String(landmark.flexWrap || ''),
    justifyContent: String(landmark.justifyContent || ''),
    alignItems: String(landmark.alignItems || ''),
    gap: String(landmark.gap || ''),
    rowGap: String(landmark.rowGap || ''),
    columnGap: String(landmark.columnGap || ''),
    borderRadius: String(landmark.borderRadius || ''),
    borderWidth: String(landmark.borderWidth || ''),
    borderColor: String(landmark.borderColor || ''),
    borderTopWidth: String(landmark.borderTopWidth || ''),
    borderRightWidth: String(landmark.borderRightWidth || ''),
    borderBottomWidth: String(landmark.borderBottomWidth || ''),
    borderLeftWidth: String(landmark.borderLeftWidth || ''),
    borderTopColor: String(landmark.borderTopColor || ''),
    borderRightColor: String(landmark.borderRightColor || ''),
    borderBottomColor: String(landmark.borderBottomColor || ''),
    borderLeftColor: String(landmark.borderLeftColor || ''),
    boxShadow: String(landmark.boxShadow || ''),
    visualTilt: String(landmark.visualTilt || ''),
    layoutWidth: Number.isFinite(landmark.layoutWidth) ? landmark.layoutWidth : undefined,
    layoutHeight: Number.isFinite(landmark.layoutHeight) ? landmark.layoutHeight : undefined,
    paddingTop: String(landmark.paddingTop || ''),
    paddingRight: String(landmark.paddingRight || ''),
    paddingBottom: String(landmark.paddingBottom || ''),
    paddingLeft: String(landmark.paddingLeft || ''),
    paintedBackground: landmark.paintedBackground === true,
    flowParticipation: landmark.flowParticipation === 'overlay' ? 'overlay' : 'normal',
  };
}

function summarizeReferenceVisualFrame(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const inset = genericCssMetric(value.inset);
  const height = Number(value.height);
  if (!inset || Number.parseFloat(inset) < 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  return {
    inset,
    height,
    backgroundColor: String(value.backgroundColor || ''),
    backgroundType: String(value.backgroundType || ''),
    gradientType: String(value.gradientType || ''),
    gradientAngle: value.gradientAngle,
    gradientColor1: String(value.gradientColor1 || ''),
    gradientColor2: String(value.gradientColor2 || ''),
    borderRadius: String(value.borderRadius || ''),
    borderTopWidth: String(value.borderTopWidth || ''),
    borderRightWidth: String(value.borderRightWidth || ''),
    borderBottomWidth: String(value.borderBottomWidth || ''),
    borderLeftWidth: String(value.borderLeftWidth || ''),
    borderTopColor: String(value.borderTopColor || ''),
    borderRightColor: String(value.borderRightColor || ''),
    borderBottomColor: String(value.borderBottomColor || ''),
    borderLeftColor: String(value.borderLeftColor || ''),
    boxShadow: String(value.boxShadow || ''),
    paintedBackground: value.paintedBackground === true,
  };
}

function normalizeReferenceRect(rect) {
  if (!rect || typeof rect !== 'object') {
    return null;
  }
  const left = finiteReferenceNumber(rect.left, rect.x);
  const top = finiteReferenceNumber(rect.top, rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
    bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height,
  };
}

function finiteReferenceNumber(primary, fallback) {
  const primaryNumber = Number(primary);
  if (Number.isFinite(primaryNumber)) {
    return primaryNumber;
  }
  return Number(fallback);
}

function safeReferenceStackingIndex(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && Math.abs(value) <= 10000
    ? value
    : undefined;
}

function referencePageHeight(layout) {
  const scrollHeight = Number(layout?.viewport?.scrollHeight || 0);
  if (Number.isFinite(scrollHeight) && scrollHeight > 0) {
    return scrollHeight;
  }
  const landmarks = Array.isArray(layout?.landmarks) ? layout.landmarks : [];
  return landmarks.reduce((largest, landmark) => {
    const rect = normalizeReferenceRect(landmark?.rect);
    return rect ? Math.max(largest, rect.bottom) : largest;
  }, Number(layout?.viewport?.height || 0));
}

function isReferencePageWrapper(candidate, candidates) {
  const contained = candidates.filter((other) => (
    other !== candidate
    && other.rect.top >= candidate.rect.top - 2
    && other.rect.bottom <= candidate.rect.bottom + 2
    && other.rect.height <= candidate.rect.height * 0.82
  ));
  const distinctStarts = unique(contained.map((item) => Math.round(item.rect.top / 20)));
  return distinctStarts.length >= 2 && candidate.tag === 'main';
}

function referenceBandsOverlapAsDuplicate(left, right) {
  const overlap = Math.max(0, Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top));
  const smallerHeight = Math.min(left.rect.height, right.rect.height);
  const nearSameStart = Math.abs(left.rect.top - right.rect.top) <= 12;
  const nearSameHeight = Math.abs(left.rect.height - right.rect.height) <= Math.max(16, smallerHeight * 0.12);
  return smallerHeight > 0 && overlap / smallerHeight >= 0.88 && (nearSameStart || nearSameHeight);
}

function referenceLandmarkRank(tag) {
  return {
    section: 6,
    header: 5,
    footer: 5,
    nav: 4,
    article: 3,
    aside: 2,
    main: 1,
  }[tag] || 0;
}

function summarizeReferenceBandContent(band, index, viewportWidth, textBoxes, meaningfulMedia, landmarks, layoutGroups, interactions, pageClipsHorizontalOverflow) {
  const bandKey = String(band.key || '');
  const protrudingOverlayGroupKeys = new Set((Array.isArray(layoutGroups) ? layoutGroups : [])
    .filter((group) => {
      const groupKey = String(group?.key || '');
      const rect = normalizeReferenceRect(group?.rect);
      return groupKey
        && groupKey !== bandKey
        && (!bandKey || groupKey.startsWith(`${bandKey}.`))
        && group?.flowParticipation === 'overlay'
        && group?.paintedBackground === true
        && rect
        && !referenceRectContains(band.rect, rect)
        && referenceRectMateriallyOverlaps(band.rect, rect);
    })
    .map((group) => String(group.key)));
  const belongsToProtrudingOverlay = (box) => {
    const structureKey = String(box?.structureKey || '');
    const parentGroupKey = String(box?.parentGroupKey || '');
    return Array.from(protrudingOverlayGroupKeys).some((groupKey) => (
      structureKey === groupKey
      || structureKey.startsWith(`${groupKey}.`)
      || parentGroupKey === groupKey
      || parentGroupKey.startsWith(`${groupKey}.`)
    ));
  };
  const belongsToBandStructure = (box) => {
    if (!bandKey) {
      return true;
    }
    const structureKey = String(box?.structureKey || '');
    const parentGroupKey = String(box?.parentGroupKey || '');
    return structureKey === bandKey
      || structureKey.startsWith(`${bandKey}.`)
      || parentGroupKey === bandKey
      || parentGroupKey.startsWith(`${bandKey}.`);
  };
  const rawBandTextBoxes = textBoxes.filter((box) => (
    (referenceBoxBelongsToBand(box, band.rect) || belongsToProtrudingOverlay(box))
      && belongsToBandStructure(box)
  ));
  const bandTextBoxes = referenceTextBoxesForAuthoring(rawBandTextBoxes);
  const bandMediaBoxes = meaningfulMedia
    .filter((box) => (
      (referenceBoxBelongsToBand(box, band.rect) || belongsToProtrudingOverlay(box))
        && belongsToBandStructure(box)
    ))
    .filter((box) => referenceMediaRectWithinBounds(box, band.rect))
    .sort((left, right) => (
      referenceBoxTop(left) - referenceBoxTop(right)
      || Number(left?.rect?.left || left?.rect?.x || 0) - Number(right?.rect?.left || right?.rect?.x || 0)
      || referenceBoxArea(right) - referenceBoxArea(left)
    ))
    .slice(0, MAX_GENERIC_REFERENCE_MEDIA_PER_BAND);
  const semanticForm = summarizeReferenceForm(interactions, layoutGroups, bandTextBoxes, band, index);
  const semanticTabs = summarizeReferenceTabs(
    interactions,
    layoutGroups,
    rawBandTextBoxes,
    bandMediaBoxes,
    band
  );
  const semanticGroups = new Map(
    [semanticForm, semanticTabs]
      .filter(Boolean)
      .map((semanticGroup) => [semanticGroup.hostGroupKey, semanticGroup])
  );
  const semanticHostKeys = new Set(semanticGroups.keys());
  const authoredTextBoxes = bandTextBoxes.filter((box) => !Array.from(semanticHostKeys).some((key) => (
    String(box?.structureKey || '').startsWith(`${key}.`)
    || String(box?.parentGroupKey || '') === key
    || String(box?.parentGroupKey || '').startsWith(`${key}.`)
  )));
  const authoredMediaBoxes = bandMediaBoxes.filter((box) => !Array.from(semanticHostKeys).some((key) => (
    String(box?.structureKey || '').startsWith(`${key}.`)
    || String(box?.parentGroupKey || '') === key
    || String(box?.parentGroupKey || '').startsWith(`${key}.`)
  )));
  const media = authoredMediaBoxes.map((box) => summarizeReferenceMediaBox(box, band.rect)).filter(Boolean);
  const groupSummary = summarizeReferenceLayoutGroups(layoutGroups, band, authoredTextBoxes, authoredMediaBoxes, semanticGroups);
  const childLandmarks = groupSummary.groups.length > 0
    ? []
    : summarizeReferenceChildLandmarks(landmarks, band, authoredTextBoxes, authoredMediaBoxes);
  const rootTextBoxes = groupSummary.groups.length > 0
    ? authoredTextBoxes.filter((box) => !groupSummary.keys.has(String(box?.parentGroupKey || '')))
    : authoredTextBoxes.filter((box) => !childLandmarks.some((child) => (
      referenceBoxBelongsToBand(box, child.rect)
    )));
  const rootMediaBoxes = groupSummary.groups.length > 0
    ? authoredMediaBoxes.filter((box) => !groupSummary.keys.has(String(box?.parentGroupKey || '')))
    : authoredMediaBoxes.filter((box) => !childLandmarks.some((child) => (
      referenceBoxBelongsToBand(box, child.rect)
    )));
  const contentBoxes = authoredTextBoxes.concat(authoredMediaBoxes, groupSummary.groups);
  const heading = rootTextBoxes
    .filter((box) => /^h[1-4]$/i.test(String(box?.tag || '')))
    .sort((left, right) => referenceBoxArea(right) - referenceBoxArea(left))[0] || null;
  const body = rootTextBoxes.find((box) => ['p', 'li'].includes(String(box?.tag || '').toLowerCase())) || null;
  const contentBounds = referenceContentBounds(contentBoxes, band.rect);
  const clipsHorizontalOverflow = pageClipsHorizontalOverflow === true
    && [
      ...(Array.isArray(textBoxes) ? textBoxes : []),
      ...(Array.isArray(meaningfulMedia) ? meaningfulMedia : []),
      ...(Array.isArray(layoutGroups) ? layoutGroups : []),
      ...(Array.isArray(interactions) ? interactions : []),
      ...(Array.isArray(landmarks) ? landmarks : []),
    ].some((box) => {
      const rect = normalizeReferenceRect(box?.rect);
      const structureKey = String(box?.structureKey || box?.key || '');
      const parentGroupKey = String(box?.parentGroupKey || box?.parentKey || '');
      const clippedByNestedGroup = (Array.isArray(layoutGroups) ? layoutGroups : []).some((group) => {
        const groupKey = String(group?.key || '');
        const groupRect = normalizeReferenceRect(group?.rect);
        const groupOverflow = String(group?.overflow || '').trim().toLowerCase();
        const ownsBox = groupKey
          && groupKey !== band.key
          && groupKey.startsWith(`${band.key}.`)
          && (
            structureKey === groupKey
            || structureKey.startsWith(`${groupKey}.`)
            || parentGroupKey === groupKey
            || parentGroupKey.startsWith(`${groupKey}.`)
          );
        return ownsBox
          && groupRect
          && ['hidden', 'clip'].includes(groupOverflow)
          && groupRect.left >= -1
          && groupRect.right <= viewportWidth + 1;
      });
      return rect
        && belongsToBandStructure(box)
        && referenceBoxBelongsToBand(box, band.rect)
        && (rect.left < -1 || rect.right > viewportWidth + 1)
        && !clippedByNestedGroup;
    });

  return {
    index,
    key: band.key,
    tag: band.tag,
    rootSemanticBand: band.rootSemanticBand,
    rect: band.rect,
    viewportWidth,
    fullWidth: band.rect.width >= viewportWidth * 0.98,
    clipsHorizontalOverflow,
    backgroundColor: band.backgroundColor,
    backgroundType: band.backgroundType,
    gradientType: band.gradientType,
    gradientAngle: band.gradientAngle,
    gradientColor1: band.gradientColor1,
    gradientColor2: band.gradientColor2,
    backgroundAccentType: band.backgroundAccentType,
    backgroundAccentColor1: band.backgroundAccentColor1,
    backgroundAccentColor2: band.backgroundAccentColor2,
    backgroundAccentPositionX: band.backgroundAccentPositionX,
    backgroundAccentPositionY: band.backgroundAccentPositionY,
    backgroundAccentSize: band.backgroundAccentSize,
    paintedBackground: band.paintedBackground,
    display: band.display,
    flexDirection: band.flexDirection,
    flexWrap: band.flexWrap,
    justifyContent: band.justifyContent,
    alignItems: band.alignItems,
    gap: band.gap,
    rowGap: band.rowGap,
    columnGap: band.columnGap,
    borderRadius: band.borderRadius,
    borderWidth: band.borderWidth,
    borderColor: band.borderColor,
    borderTopWidth: band.borderTopWidth,
    borderRightWidth: band.borderRightWidth,
    borderBottomWidth: band.borderBottomWidth,
    borderLeftWidth: band.borderLeftWidth,
    borderTopColor: band.borderTopColor,
    borderRightColor: band.borderRightColor,
    borderBottomColor: band.borderBottomColor,
    borderLeftColor: band.borderLeftColor,
    boxShadow: band.boxShadow,
    paddingTop: band.paddingTop,
    paddingRight: band.paddingRight,
    paddingBottom: band.paddingBottom,
    paddingLeft: band.paddingLeft,
    contentBounds,
    contentInset: contentBounds ? Math.max(0, Math.round(contentBounds.left - band.rect.left)) : Math.round(viewportWidth * 0.05),
    contentWidth: contentBounds ? Math.round(contentBounds.width) : Math.round(Math.min(viewportWidth * 0.9, 1280)),
    columns: estimateReferenceBandColumns(childLandmarks.length > 0 ? childLandmarks : rootTextBoxes.concat(rootMediaBoxes), band.rect),
    mediaCount: media.length,
    media,
    overlayMedia: media.filter((box) => box.flowParticipation === 'overlay'),
    heading: summarizeReferenceBox(heading),
    body: summarizeReferenceBox(body),
    texts: rootTextBoxes
      .slice()
      .sort((left, right) => referenceBoxTop(left) - referenceBoxTop(right) || Number(left?.rect?.left || left?.rect?.x || 0) - Number(right?.rect?.left || right?.rect?.x || 0))
      .map(summarizeReferenceBox),
    groups: groupSummary.groups,
    children: childLandmarks,
  };
}

function referenceTextBoxesForAuthoring(textBoxes) {
  const boxes = Array.isArray(textBoxes) ? textBoxes.filter(Boolean) : [];
  const inlineTags = new Set(['span', 'strong', 'em', 'b', 'i', 'small']);
  const semanticContainerTags = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'label', 'a', 'button',
  ]);
  const blockTextTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li']);
  const rank = (tag) => {
    if (/^h[1-6]$/u.test(tag)) {
      return 100;
    }
    if (tag === 'a' || tag === 'button') {
      return 90;
    }
    if (tag === 'p' || tag === 'li' || tag === 'label') {
      return 80;
    }
    return inlineTags.has(tag) ? 10 : 50;
  };
  const isAncestor = (ancestor, descendant) => (
    ancestor !== '' && descendant.startsWith(`${ancestor}.`)
  );

  return boxes.filter((candidate) => {
    const key = String(candidate?.structureKey || '');
    const tag = String(candidate?.tag || '').toLowerCase();
    const text = String(candidate?.text || '').trim().replace(/\s+/gu, ' ');
    if (!key || !text) {
      return true;
    }

    const relatives = boxes.filter((other) => {
      if (other === candidate) {
        return false;
      }
      const otherKey = String(other?.structureKey || '');
      return isAncestor(key, otherKey) || isAncestor(otherKey, key);
    });
    const exactPreferredRelative = relatives.some((other) => {
      const otherText = String(other?.text || '').trim().replace(/\s+/gu, ' ');
      if (otherText !== text) {
        return false;
      }
      const otherTag = String(other?.tag || '').toLowerCase();
      const otherRank = rank(otherTag);
      return otherRank > rank(tag)
        || (otherRank === rank(tag) && isAncestor(String(other?.structureKey || ''), key));
    });
    if (exactPreferredRelative) {
      return false;
    }

    if (inlineTags.has(tag) && relatives.some((other) => {
      const otherKey = String(other?.structureKey || '');
      const otherTag = String(other?.tag || '').toLowerCase();
      const otherText = String(other?.text || '').trim().replace(/\s+/gu, ' ');
      return isAncestor(otherKey, key)
        && semanticContainerTags.has(otherTag)
        && otherText.includes(text);
    })) {
      return false;
    }

    return !((tag === 'a' || tag === 'button') && relatives.some((other) => (
      isAncestor(key, String(other?.structureKey || ''))
      && blockTextTags.has(String(other?.tag || '').toLowerCase())
    )));
  });
}

function referenceMediaRectWithinBounds(box, bandRect) {
  const rect = normalizeReferenceRect(box?.rect);
  const bounds = normalizeReferenceRect(bandRect);
  if (!rect || !bounds) {
    return false;
  }
  const maximumWidth = Math.min(
    MAX_GENERIC_REFERENCE_MEDIA_DIMENSION,
    Math.max(bounds.width, bounds.width * MAX_GENERIC_REFERENCE_MEDIA_SCALE)
  );
  const maximumHeight = Math.min(
    MAX_GENERIC_REFERENCE_MEDIA_DIMENSION,
    Math.max(bounds.height, bounds.height * MAX_GENERIC_REFERENCE_MEDIA_SCALE)
  );
  return rect.width <= maximumWidth
    && rect.height <= maximumHeight
    && rect.left >= bounds.left - maximumWidth
    && rect.right <= bounds.right + maximumWidth
    && rect.top >= bounds.top - maximumHeight
    && rect.bottom <= bounds.bottom + maximumHeight;
}

function summarizeReferenceMediaBox(box, bandRect) {
  const rect = normalizeReferenceRect(box?.rect);
  const bounds = normalizeReferenceRect(bandRect);
  if (!rect || !bounds || !referenceMediaRectWithinBounds(box, bounds)) {
    return null;
  }
  const source = String(box?.source || box?.backgroundImage || '').trim();
  const isBackground = String(box?.backgroundImage || '').trim() !== '';
  const position = safeReferenceMediaPosition(
    isBackground ? box?.backgroundPositionX : undefined,
    isBackground ? box?.backgroundPositionY : undefined,
    isBackground ? box?.backgroundPosition : box?.objectPosition
  );
  const relative = (value, total) => Math.round(Math.max(-1, Math.min(2, value / total)) * 10000) / 10000;

  return {
    parentGroupKey: String(box.parentGroupKey || ''),
    structureKey: String(box.structureKey || ''),
    source: source.length <= 4096 ? source : '',
    mediaKind: isBackground ? 'background' : 'image',
    flowParticipation: box.flowParticipation === 'overlay' ? 'overlay' : 'normal',
    stackingIndex: safeReferenceStackingIndex(box.stackingIndex),
    rect,
    relativeRect: {
      left: relative(rect.left - bounds.left, bounds.width),
      top: relative(rect.top - bounds.top, bounds.height),
      width: relative(rect.width, bounds.width),
      height: relative(rect.height, bounds.height),
    },
    firstViewportArea: Number(box.firstViewportArea || 0),
    backgroundSize: safeReferenceMediaFit(box.backgroundSize),
    objectFit: safeReferenceMediaFit(box.objectFit),
    positionX: position?.x || '',
    positionY: position?.y || '',
    backgroundColor: String(box.backgroundColor || ''),
    borderTopWidth: String(box.borderTopWidth || ''),
    borderRightWidth: String(box.borderRightWidth || ''),
    borderBottomWidth: String(box.borderBottomWidth || ''),
    borderLeftWidth: String(box.borderLeftWidth || ''),
    borderTopColor: String(box.borderTopColor || ''),
    borderRightColor: String(box.borderRightColor || ''),
    borderBottomColor: String(box.borderBottomColor || ''),
    borderLeftColor: String(box.borderLeftColor || ''),
    borderRadius: String(box.borderRadius || ''),
    boxShadow: String(box.boxShadow || ''),
    paddingTop: String(box.paddingTop || ''),
    paddingRight: String(box.paddingRight || ''),
    paddingBottom: String(box.paddingBottom || ''),
    paddingLeft: String(box.paddingLeft || ''),
  };
}

function safeReferenceMediaFit(value) {
  const fit = String(value || '').trim().toLowerCase();
  return ['cover', 'contain'].includes(fit) ? fit : '';
}

function safeReferenceMediaPosition(positionX, positionY, shorthand) {
  let x = safeReferenceMediaPositionAxis(positionX, 'x');
  let y = safeReferenceMediaPositionAxis(positionY, 'y');
  if (x && y) {
    return { x, y };
  }

  const tokens = String(shorthand || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const token = tokens[0];
    x = safeReferenceMediaPositionAxis(['top', 'bottom'].includes(token) ? 'center' : token, 'x');
    y = safeReferenceMediaPositionAxis(['left', 'right'].includes(token) ? 'center' : token, 'y');
  } else if (tokens.length === 2) {
    const firstIsVertical = ['top', 'bottom'].includes(tokens[0]);
    x = safeReferenceMediaPositionAxis(firstIsVertical ? tokens[1] : tokens[0], 'x');
    y = safeReferenceMediaPositionAxis(firstIsVertical ? tokens[0] : tokens[1], 'y');
  }
  return x && y ? { x, y } : null;
}

function safeReferenceMediaPositionAxis(value, axis) {
  const normalized = String(value || '').trim().toLowerCase();
  const keyword = axis === 'x'
    ? { left: '0%', center: '50%', right: '100%' }[normalized]
    : { top: '0%', center: '50%', bottom: '100%' }[normalized];
  if (keyword) {
    return keyword;
  }
  const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|%)$/u.exec(normalized);
  if (!match) {
    return '';
  }
  const numeric = Number(match[1]);
  const limit = match[2] === '%' ? 1000 : MAX_GENERIC_REFERENCE_MEDIA_DIMENSION;
  return Number.isFinite(numeric) && Math.abs(numeric) <= limit ? `${numeric}${match[2]}` : '';
}

function summarizeReferenceForm(interactions, layoutGroups, textBoxes, band, bandIndex) {
  const controls = (Array.isArray(interactions) ? interactions : [])
    .map((interaction) => ({ ...interaction, rect: normalizeReferenceRect(interaction?.rect) }))
    .filter((interaction) => interaction.rect && referenceBoxBelongsToBand(interaction, band.rect));
  const potentialFields = controls.filter((interaction) => (
    ['textarea', 'select'].includes(String(interaction.tag || '').toLowerCase())
    || (String(interaction.tag || '').toLowerCase() === 'input'
      && !['button', 'hidden', 'image', 'reset', 'submit'].includes(String(interaction.type || 'text').toLowerCase()))
  ));
  const fields = potentialFields;
  const submits = controls.filter((interaction) => String(interaction.type || '').toLowerCase() === 'submit');
  if (fields.length < 2 || submits.length === 0) {
    return null;
  }

  const bandKey = String(band.key || '');
  const groups = (Array.isArray(layoutGroups) ? layoutGroups : [])
    .map((group) => ({ ...group, key: String(group?.key || ''), rect: normalizeReferenceRect(group?.rect) }))
    .filter((group) => (
      group.rect
      && group.key
      && group.key !== bandKey
      && (!bandKey || group.key.startsWith(`${bandKey}.`))
      && group.flowParticipation !== 'overlay'
      && referenceRectContains(band.rect, group.rect)
    ));
  const candidates = submits.flatMap((submit) => groups.map((group) => {
    if (!referenceRectContains(group.rect, submit.rect)) {
      return null;
    }
    const containedFields = fields.filter((field) => referenceRectContains(group.rect, field.rect));
    return containedFields.length >= 2 ? { group, submit, fields: containedFields } : null;
  })).filter(Boolean).sort((left, right) => (
    right.fields.length - left.fields.length
    || referenceBoxArea(left.group) - referenceBoxArea(right.group)
  ));
  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }

  const orderedFields = candidate.fields.slice().sort((left, right) => (
    left.rect.top - right.rect.top || left.rect.left - right.rect.left
  ));
  const nonCheckboxFields = orderedFields.filter((field) => String(field.type || '') !== 'checkbox');
  const hasTwoColumnRow = nonCheckboxFields.some((field, index) => nonCheckboxFields.slice(index + 1).some((other) => (
    Math.abs(field.rect.top - other.rect.top) <= Math.max(6, Math.min(field.rect.height, other.rect.height) * 0.5)
    && field.rect.right <= other.rect.left + 3
    && Math.abs(field.rect.width - other.rect.width) <= Math.max(24, field.rect.width * 0.2)
  )));
  const formColumns = hasTwoColumnRow ? 2 : 1;
  const fieldBounds = referenceContentBounds(orderedFields, candidate.group.rect);
  const firstControl = nonCheckboxFields[0] || orderedFields[0];
  const directChildren = groups.filter((group) => String(group.parentKey || '') === candidate.group.key);
  const contentLeft = directChildren.length > 0
    ? Math.min(...directChildren.map((group) => group.rect.left))
    : fieldBounds?.left;
  const contentTop = directChildren.length > 0
    ? Math.min(...directChildren.map((group) => group.rect.top))
    : fieldBounds?.top;
  const sourceGap = directChildren.map((group) => genericCssMetric(group.gap || group.rowGap)).find(Boolean);
  const buttonBox = textBoxes.find((box) => String(box?.structureKey || '') === String(candidate.submit.structureKey || ''))
    || candidate.submit;
  const numericMetric = (value, fallback) => {
    const parsed = Number.parseFloat(String(value || ''));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : fallback;
  };
  const borderToken = (value) => {
    const width = numericMetric(value, 0);
    if (width <= 0) return '';
    if (width <= 1) return 'border';
    if (width <= 2) return 'border-2';
    if (width <= 4) return 'border-4';
    return 'border-8';
  };
  const radiusToken = (value) => {
    const radius = numericMetric(value, 0);
    if (radius <= 0) return '';
    if (radius <= 2) return 'rounded-sm';
    if (radius <= 4) return 'rounded';
    if (radius <= 8) return 'rounded-lg';
    if (radius <= 12) return 'rounded-xl';
    if (radius <= 20) return 'rounded-2xl';
    return 'rounded-full';
  };
  const labelsByType = {
    checkbox: 'I agree to the',
    email: 'Email address',
    select: 'Topic',
    tel: 'Phone number',
    text: 'Name',
    textarea: 'Message',
  };
  let textFieldIndex = 0;
  const authoredFields = orderedFields.map((field, index) => {
    const type = String(field.tag || '').toLowerCase() === 'textarea'
      ? 'textarea'
      : String(field.tag || '').toLowerCase() === 'select'
        ? 'select'
        : String(field.type || 'text').toLowerCase();
    const repeatedTextLabel = type === 'text' && textFieldIndex > 0 ? 'Subject' : labelsByType[type] || 'Field';
    if (type === 'text') {
      textFieldIndex += 1;
    }
    const spansRow = formColumns === 2 && fieldBounds && field.rect.width >= fieldBounds.width * 0.7;
    return {
      type,
      name: `field_${index + 1}`,
      label: repeatedTextLabel,
      placeholder: '',
      required: field.required === true,
      ...(type === 'textarea' ? { rows: Math.max(2, Math.min(12, Math.round(field.rect.height / 30))) } : {}),
      ...(type === 'select' ? { options: 'General enquiry|general\nProject planning|project' } : {}),
      ...(formColumns === 2 ? { columnSpan: spansRow || type === 'checkbox' ? 2 : 1 } : {}),
      ...(type === 'checkbox' ? { linkText: 'privacy policy', linkUrl: '#' } : {}),
    };
  });

  return {
    hostGroupKey: candidate.group.key,
    semanticWidget: 'FormBlock',
    submitBox: summarizeReferenceBox(buttonBox),
    props: {
      fields: authoredFields,
      formColumns,
      formId: `contact-form-${bandIndex + 1}`,
      formGap: sourceGap || '18px',
      formMaxWidth: fieldBounds ? `${Math.round(fieldBounds.width * 100) / 100}px` : '100%',
      formAlignItems: 'stretch',
      formPaddingY: `${Math.max(0, Math.round((contentTop || candidate.group.rect.top) - candidate.group.rect.top))}px`,
      formPaddingX: `${Math.max(0, Math.round((contentLeft || candidate.group.rect.left) - candidate.group.rect.left))}px`,
      formBackgroundColor: normalizedAuthorableColor(candidate.group.backgroundColor) || 'transparent',
      formBorderWidth: '0px',
      formBorderColor: normalizedAuthorableColor(candidate.group.borderColor) || '#e5e7eb',
      formBorderRadius: genericCssMetric(candidate.group.borderRadius) || '0px',
      fieldGap: '6px',
      labelFontSize: '14px',
      labelFontWeight: 'font-semibold',
      labelColor: normalizedAuthorableColor(firstControl.color) || '#111827',
      requiredColor: '#ef4444',
      inputBorderColor: normalizedAuthorableColor(firstControl.borderTopColor) || '#d1d5db',
      inputBorderWidth: borderToken(firstControl.borderTopWidth),
      inputBorderRadius: radiusToken(firstControl.borderRadius),
      inputPaddingTop: numericMetric(firstControl.paddingTop, 14),
      inputPaddingRight: numericMetric(firstControl.paddingRight, 16),
      inputPaddingBottom: numericMetric(firstControl.paddingBottom, 14),
      inputPaddingLeft: numericMetric(firstControl.paddingLeft, 16),
      inputBgColor: normalizedAuthorableColor(firstControl.backgroundColor) || '#ffffff',
      inputColor: normalizedAuthorableColor(firstControl.color) || '#111827',
      inputFontSize: genericCssMetric(firstControl.fontSize) || '16px',
      inputFontWeight: 'font-normal',
      inputHeight: `${Math.round(firstControl.rect.height * 100) / 100}px`,
      inputFocusColor: normalizedAuthorableColor(buttonBox.backgroundColor) || '#2563eb',
      checkboxSize: `${Math.round((orderedFields.find((field) => field.type === 'checkbox')?.rect.height || 16) * 100) / 100}px`,
      checkboxBorderColor: normalizedAuthorableColor(firstControl.borderTopColor) || '#d1d5db',
      checkboxBorderRadius: 'rounded-sm',
      buttonAlignSelf: 'flex-start',
      buttonMinHeight: `${Math.round(candidate.submit.rect.height * 100) / 100}px`,
      buttonPaddingY: genericCssMetric(buttonBox.paddingTop) || '12px',
      buttonPaddingX: genericCssMetric(buttonBox.paddingLeft) || '24px',
      buttonBorderWidth: genericCssMetric(buttonBox.borderTopWidth) || '0px',
      buttonBorderColor: normalizedAuthorableColor(buttonBox.borderTopColor) || normalizedAuthorableColor(buttonBox.backgroundColor) || '#2563eb',
      buttonBorderRadius: genericCssMetric(buttonBox.borderRadius) || '0px',
      buttonBackgroundColor: normalizedAuthorableColor(buttonBox.backgroundColor) || '#2563eb',
      buttonTextColor: normalizedAuthorableColor(buttonBox.color) || '#ffffff',
      buttonFontSize: genericCssMetric(buttonBox.fontSize) || '14px',
      buttonFontWeight: genericFontWeight(buttonBox, '600'),
    },
  };
}

function summarizeReferenceTabs(interactions, layoutGroups, textBoxes, mediaBoxes, band) {
  const controls = (Array.isArray(interactions) ? interactions : [])
    .map((interaction) => ({ ...interaction, rect: normalizeReferenceRect(interaction?.rect) }))
    .filter((interaction) => interaction.rect && referenceBoxBelongsToBand(interaction, band.rect));
  const tabs = controls
    .filter((interaction) => String(interaction.role || '').toLowerCase() === 'tab')
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const panels = controls
    .filter((interaction) => String(interaction.role || '').toLowerCase() === 'tabpanel')
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  if (tabs.length < 2 || panels.length === 0) {
    return null;
  }

  const bandKey = String(band.key || '');
  const groups = (Array.isArray(layoutGroups) ? layoutGroups : [])
    .map((group) => ({ ...group, key: String(group?.key || ''), rect: normalizeReferenceRect(group?.rect) }))
    .filter((group) => (
      group.key
      && group.rect
      && group.key !== bandKey
      && (!bandKey || group.key.startsWith(`${bandKey}.`))
      && group.flowParticipation !== 'overlay'
      && referenceRectContains(band.rect, group.rect)
    ));
  const semanticStructureKeys = tabs.concat(panels).map((interaction) => String(interaction.structureKey || ''));
  const hostGroup = groups
    .filter((group) => semanticStructureKeys.every((key) => key === group.key || key.startsWith(`${group.key}.`)))
    .sort((left, right) => (
      right.key.split('.').length - left.key.split('.').length
      || referenceBoxArea(left) - referenceBoxArea(right)
    ))[0];
  if (!hostGroup) {
    return null;
  }

  const tabParentKey = String(tabs[0].parentGroupKey || '');
  const tabBarGroup = groups.find((group) => group.key === tabParentKey)
    || groups
      .filter((group) => tabs.every((tab) => (
        String(tab.structureKey || '') === group.key
        || String(tab.structureKey || '').startsWith(`${group.key}.`)
      )))
      .sort((left, right) => referenceBoxArea(left) - referenceBoxArea(right))[0];
  if (!tabBarGroup) {
    return null;
  }

  const activeTabIndex = Math.max(0, tabs.findIndex((tab) => tab.state?.selected === true));
  const activeTab = tabs[activeTabIndex] || tabs[0];
  const inactiveTab = tabs.find((tab) => tab !== activeTab) || activeTab;
  const activePanel = panels[0];
  const tabItems = tabs.map((tab, tabIndex) => {
    const structureKey = String(tab.structureKey || '');
    const descendants = textBoxes.filter((box) => {
      const boxKey = String(box?.structureKey || '');
      return boxKey === structureKey || boxKey.startsWith(`${structureKey}.`);
    });
    const labelBox = descendants.find((box) => String(box?.tag || '').toLowerCase() === 'strong')
      || descendants.find((box) => String(box?.tag || '').toLowerCase() === 'button')
      || descendants[0];
    const prefixBox = descendants.find((box) => String(box?.tag || '').toLowerCase() === 'span');
    const suffixBox = descendants.find((box) => String(box?.tag || '').toLowerCase() === 'small');
    return {
      labelPrefix: String(prefixBox?.text || '').trim().replace(/\s+/gu, ' '),
      label: String(labelBox?.text || `Tab ${tabIndex + 1}`).trim().replace(/\s+/gu, ' '),
      labelSuffix: String(suffixBox?.text || '').trim().replace(/\s+/gu, ' '),
    };
  });
  const activeLabelKey = String(activeTab.structureKey || '');
  const visibleLabelBoxes = textBoxes.filter((box) => (
    String(box?.tag || '').toLowerCase() === 'strong'
    && tabs.some((tab) => String(box?.structureKey || '').startsWith(`${String(tab.structureKey || '')}.`))
  ));
  const activeLabelBox = textBoxes.find((box) => (
    String(box?.tag || '').toLowerCase() === 'strong'
    && String(box?.structureKey || '').startsWith(`${activeLabelKey}.`)
  )) || visibleLabelBoxes[0] || activeTab;
  const visibleMetaBoxes = textBoxes.filter((box) => (
    ['span', 'small'].includes(String(box?.tag || '').toLowerCase())
    && tabs.some((tab) => String(box?.structureKey || '').startsWith(`${String(tab.structureKey || '')}.`))
  ));
  const activeMetaBox = textBoxes.find((box) => (
    ['span', 'small'].includes(String(box?.tag || '').toLowerCase())
    && String(box?.structureKey || '').startsWith(`${activeLabelKey}.`)
  )) || visibleMetaBoxes[0] || null;
  const inactiveLabelKey = String(inactiveTab.structureKey || '');
  const inactiveMetaBox = textBoxes.find((box) => (
    ['span', 'small'].includes(String(box?.tag || '').toLowerCase())
    && String(box?.structureKey || '').startsWith(`${inactiveLabelKey}.`)
  )) || null;
  const panelKey = String(activePanel.structureKey || '');
  const panelTextBoxes = textBoxes.filter((box) => {
    const boxKey = String(box?.structureKey || '');
    return boxKey === panelKey || boxKey.startsWith(`${panelKey}.`);
  });
  const panelTitle = panelTextBoxes
    .filter((box) => /^h[1-6]$/iu.test(String(box?.tag || '')))
    .sort((left, right) => referenceBoxArea(right) - referenceBoxArea(left))[0] || null;
  const panelBody = panelTextBoxes.find((box) => String(box?.tag || '').toLowerCase() === 'p') || null;
  const panelEyebrow = panelTextBoxes.find((box) => String(box?.tag || '').toLowerCase() === 'span') || null;
  const panelCta = panelTextBoxes.find((box) => String(box?.tag || '').toLowerCase() === 'a') || null;
  const panelMedia = (Array.isArray(mediaBoxes) ? mediaBoxes : [])
    .filter((box) => {
      const structureKey = String(box?.structureKey || '');
      const rect = normalizeReferenceRect(box?.rect);
      return rect && (structureKey === panelKey || structureKey.startsWith(`${panelKey}.`));
    })
    .sort((left, right) => referenceBoxArea(right) - referenceBoxArea(left))[0] || null;
  const panelMediaRect = normalizeReferenceRect(panelMedia?.rect);
  const panelRect = activePanel.rect;
  const panelTextRects = [panelEyebrow, panelTitle, panelBody, panelCta]
    .map((box) => normalizeReferenceRect(box?.rect))
    .filter(Boolean);
  const panelContentBounds = referenceContentBounds(
    [panelEyebrow, panelTitle, panelBody, panelCta].filter(Boolean),
    panelRect
  );
  const panelTextTop = panelTextRects.length > 0
    ? Math.min(...panelTextRects.map((rect) => rect.top))
    : null;
  const panelTextBottom = panelTextRects.length > 0
    ? Math.max(...panelTextRects.map((rect) => rect.bottom))
    : null;
  const panelFlow = panelMediaRect && panelTextTop !== null && panelTextBottom !== null
    && (panelMediaRect.top >= panelTextBottom - 1 || panelTextTop >= panelMediaRect.bottom - 1)
    ? 'stack'
    : 'split';
  const vertical = String(tabBarGroup.flexDirection || '').toLowerCase() === 'column'
    || (tabs.length > 1
      && Math.abs(tabs.at(-1).rect.top - tabs[0].rect.top) > Math.abs(tabs.at(-1).rect.left - tabs[0].rect.left));
  const tabGap = Number.parseFloat(String(tabBarGroup.gap || tabBarGroup.columnGap || tabBarGroup.rowGap || '0')) || 0;
  const measuredTabWidth = tabs.reduce((total, tab) => total + tab.rect.width, 0) + tabGap * Math.max(0, tabs.length - 1);
  const mobileTabLayout = !vertical && measuredTabWidth > tabBarGroup.rect.width + 1 ? 'scroll' : 'wrap';
  const panelImagePosition = panelMediaRect && panelMediaRect.left + panelMediaRect.width / 2 < panelRect.left + panelRect.width / 2
    ? 'left'
    : 'right';
  const panelPaddingLeftMetric = genericCssMetric(activePanel.paddingLeft || activePanel.paddingTop) || '0px';
  const panelPaddingRightMetric = genericCssMetric(activePanel.paddingRight || activePanel.paddingTop) || '0px';
  const panelPaddingTopMetric = genericCssMetric(activePanel.paddingTop) || '0px';
  const panelPaddingBottomMetric = genericCssMetric(activePanel.paddingBottom || activePanel.paddingTop) || '0px';
  const panelPaddingLeft = pxNumber(panelPaddingLeftMetric) ?? 0;
  const panelPaddingRight = pxNumber(panelPaddingRightMetric) ?? 0;
  const panelPaddingTop = pxNumber(panelPaddingTopMetric) ?? 0;
  const panelPaddingBottom = pxNumber(panelPaddingBottomMetric) ?? 0;
  const panelGapMetric = genericCssMetric(activePanel.gap || activePanel.columnGap || activePanel.rowGap) || '0px';
  const measuredPanelGap = pxNumber(panelGapMetric) ?? 0;
  const panelInnerLeft = panelRect.left + panelPaddingLeft;
  const panelInnerRight = panelRect.right - panelPaddingRight;
  const panelInnerTop = panelRect.top + panelPaddingTop;
  const panelInnerBottom = panelRect.bottom - panelPaddingBottom;
  const panelContentLeft = panelFlow === 'split' && panelMediaRect && panelImagePosition === 'left'
    ? panelMediaRect.right + measuredPanelGap
    : panelInnerLeft;
  const panelContentRight = panelFlow === 'split' && panelMediaRect && panelImagePosition === 'right'
    ? panelMediaRect.left - measuredPanelGap
    : panelInnerRight;
  const measuredPanelContentPaddingX = panelContentBounds
    ? Math.max(0, Math.min(
      panelContentBounds.left - panelContentLeft,
      panelContentRight - panelContentBounds.right
    ))
    : 0;
  const measuredPanelContentPaddingTop = panelContentBounds
    ? Math.max(0, panelContentBounds.top - panelInnerTop)
    : 0;
  const measuredPanelContentPaddingBottom = panelFlow === 'stack' && panelContentBounds && panelMediaRect
    ? Math.max(0, panelMediaRect.top >= panelContentBounds.bottom
      ? panelMediaRect.top - measuredPanelGap - panelContentBounds.bottom
      : panelInnerBottom - panelContentBounds.bottom)
    : 0;
  const panelMediaIsBackground = String(panelMedia?.backgroundImage || '').trim() !== '';
  const panelImagePositionAxes = safeReferenceMediaPosition(
    panelMediaIsBackground ? panelMedia?.backgroundPositionX : undefined,
    panelMediaIsBackground ? panelMedia?.backgroundPositionY : undefined,
    panelMediaIsBackground ? panelMedia?.backgroundPosition : panelMedia?.objectPosition
  ) || { x: '50%', y: '50%' };
  const panelInnerWidth = Math.max(1, panelRect.width - panelPaddingLeft - panelPaddingRight);

  return {
    hostGroupKey: hostGroup.key,
    semanticWidget: 'TabsBlock',
    tabLabels: tabItems.map((item) => item.label),
    tabItems,
    activePanel: {
      eyebrow: String(panelEyebrow?.text || '').trim(),
      title: String(panelTitle?.text || '').trim(),
      content: String(panelBody?.text || '').trim(),
      image: String(panelMedia?.source || '').trim(),
      ctaLabel: String(panelCta?.text || '').trim(),
    },
    panelFlow,
    props: {
      defaultActiveTab: activeTabIndex,
      orientation: vertical ? 'vertical' : 'horizontal',
      mobileTabLayout,
      layoutGap: genericCssMetric(hostGroup.gap || hostGroup.columnGap || hostGroup.rowGap) || '0px',
      tabBarWidth: vertical ? `${Math.round(tabBarGroup.rect.width * 100) / 100}px` : '100%',
      tabBarAlignment: 'stretch',
      tabGap: genericCssMetric(tabBarGroup.gap || tabBarGroup.columnGap || tabBarGroup.rowGap) || '0px',
      tabWidth: vertical ? '100%' : `${Math.round(activeTab.rect.width * 100) / 100}px`,
      tabMinHeight: `${Math.round(activeTab.rect.height * 100) / 100}px`,
      tabBarBackgroundColor: normalizedAuthorableColor(tabBarGroup.backgroundColor) || 'transparent',
      tabBarBorderColor: normalizedAuthorableColor(tabBarGroup.borderTopColor) || 'transparent',
      tabBarBorderWidth: genericCssMetric(tabBarGroup.borderTopWidth) || '0px',
      tabBarBorderRadius: genericCssMetric(tabBarGroup.borderRadius) || '0px',
      tabBarPadding: genericCssMetric(tabBarGroup.paddingTop) || '0px',
      tabTextColor: normalizedAuthorableColor(inactiveTab.color) || '#4b5563',
      tabActiveTextColor: normalizedAuthorableColor(activeTab.color) || '#111827',
      tabBackgroundColor: normalizedAuthorableColor(inactiveTab.backgroundColor) || 'transparent',
      tabActiveBackgroundColor: normalizedAuthorableColor(activeTab.backgroundColor) || 'transparent',
      tabBorderColor: normalizedAuthorableColor(inactiveTab.borderTopColor) || 'transparent',
      tabBorderWidth: genericCssMetric(inactiveTab.borderTopWidth) || '0px',
      tabActiveBorderColor: normalizedAuthorableColor(activeTab.borderTopColor) || 'transparent',
      tabActiveBorderWidth: genericCssMetric(activeTab.borderTopWidth) || '0px',
      tabFontSize: genericCssMetric(activeLabelBox.fontSize)
        || genericCssMetric(activeTab.fontSize)
        || genericFontSize(activeLabelBox, 15),
      tabFontWeight: genericFontWeight(activeLabelBox, '600'),
      tabLineHeight: genericCssMetric(activeLabelBox.lineHeight) || '1.2',
      tabMetaColor: inactiveMetaBox ? normalizedAuthorableColor(inactiveMetaBox.color) : undefined,
      tabActiveMetaColor: activeMetaBox ? normalizedAuthorableColor(activeMetaBox.color) : undefined,
      tabMetaFontSize: activeMetaBox ? (genericCssMetric(activeMetaBox.fontSize) || genericFontSize(activeMetaBox, 12)) : undefined,
      tabMetaFontWeight: activeMetaBox ? genericFontWeight(activeMetaBox, '400') : undefined,
      tabMetaGap: activeMetaBox ? (genericCssMetric(activeTab.gap || activeTab.columnGap || activeTab.rowGap) || '0px') : undefined,
      tabPaddingY: genericCssMetric(activeTab.paddingTop) || '0px',
      tabPaddingX: genericCssMetric(activeTab.paddingLeft) || '0px',
      tabBorderRadius: genericCssMetric(activeTab.borderRadius) || '0px',
      tabTextAlign: genericMeasuredTextAlign(activeTab.textAlign) || 'left',
      showPanelTitle: Boolean(panelTitle),
      panelBackgroundColor: normalizedAuthorableColor(activePanel.backgroundColor) || 'transparent',
      panelTextColor: normalizedAuthorableColor(panelBody?.color || activePanel.color) || '#374151',
      panelPadding: genericCssMetric(activePanel.paddingTop) || '0px',
      panelBorderColor: normalizedAuthorableColor(activePanel.borderTopColor) || 'transparent',
      panelBorderWidth: genericCssMetric(activePanel.borderTopWidth) || '0px',
      panelBorderRadius: genericCssMetric(activePanel.borderRadius) || '0px',
      panelFontSize: genericCssMetric(panelBody?.fontSize) || genericFontSize(panelBody, 16),
      panelLineHeight: genericCssMetric(panelBody?.lineHeight) || '1.65',
      panelGap: genericCssMetric(activePanel.gap || activePanel.columnGap || activePanel.rowGap) || '0px',
      panelAlignItems: 'stretch',
      panelContentMaxWidth: '100%',
      panelTitleColor: normalizedAuthorableColor(panelTitle?.color) || normalizedAuthorableColor(activePanel.color) || '#111827',
      panelTitleFontSize: genericCssMetric(panelTitle?.fontSize) || genericFontSize(panelTitle, 32),
      panelTitleFontWeight: genericFontWeight(panelTitle, '700'),
      panelTitleLineHeight: genericCssMetric(panelTitle?.lineHeight) || '1.1',
      panelTitleMarginBottom: genericCssMetric(panelTitle?.marginBottom) || '0px',
      panelEyebrowColor: panelEyebrow ? normalizedAuthorableColor(panelEyebrow.color) : undefined,
      panelEyebrowFontSize: panelEyebrow ? (genericCssMetric(panelEyebrow.fontSize) || genericFontSize(panelEyebrow, 12)) : undefined,
      panelEyebrowFontWeight: panelEyebrow ? genericFontWeight(panelEyebrow, '700') : undefined,
      panelEyebrowLineHeight: panelEyebrow ? (genericCssMetric(panelEyebrow.lineHeight) || '1.2') : undefined,
      panelEyebrowMarginBottom: panelEyebrow && panelTitle
        ? `${Math.max(0, Math.round((referenceBoxTop(panelTitle) - Number(panelEyebrow.rect?.bottom || 0)) * 100) / 100)}px`
        : undefined,
      panelCtaBackgroundColor: panelCta ? normalizedAuthorableColor(panelCta.backgroundColor) : undefined,
      panelCtaTextColor: panelCta ? normalizedAuthorableColor(panelCta.color) : undefined,
      panelCtaBorderColor: panelCta ? normalizedAuthorableColor(panelCta.borderTopColor) : undefined,
      panelCtaBorderWidth: panelCta ? (genericCssMetric(panelCta.borderTopWidth) || '0px') : undefined,
      panelCtaBorderRadius: panelCta ? (genericCssMetric(panelCta.borderRadius) || '0px') : undefined,
      panelCtaPaddingY: panelCta ? (genericCssMetric(panelCta.paddingTop) || '0px') : undefined,
      panelCtaPaddingX: panelCta ? (genericCssMetric(panelCta.paddingLeft) || '0px') : undefined,
      panelCtaMinHeight: panelCta?.rect?.height
        ? `${Math.round(Number(panelCta.rect.height) * 100) / 100}px`
        : undefined,
      panelCtaFontSize: panelCta ? (genericCssMetric(panelCta.fontSize) || genericFontSize(panelCta, 16)) : undefined,
      panelCtaFontWeight: panelCta ? genericFontWeight(panelCta, '600') : undefined,
      panelCtaMarginTop: panelCta && panelBody
        ? `${Math.max(0, Math.round((referenceBoxTop(panelCta) - Number(panelBody.rect?.bottom || 0)) * 100) / 100)}px`
        : undefined,
      panelContentPaddingTop: panelContentBounds
        ? `${Math.round(measuredPanelContentPaddingTop * 100) / 100}px`
        : undefined,
      panelContentPaddingX: panelContentBounds
        ? `${Math.round(measuredPanelContentPaddingX * 100) / 100}px`
        : undefined,
      panelContentPaddingBottom: panelContentBounds
        ? `${Math.round(measuredPanelContentPaddingBottom * 100) / 100}px`
        : undefined,
      panelImagePosition,
      panelImageWidth: panelMediaRect ? `${Math.round(panelMediaRect.width / panelInnerWidth * 1000) / 10}%` : undefined,
      panelImageHeight: panelMediaRect ? `${Math.round(panelMediaRect.height * 100) / 100}px` : undefined,
      panelImageObjectFit: ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(String(panelMedia?.objectFit))
        ? String(panelMedia.objectFit)
        : 'cover',
      panelImageObjectPosition: 'center',
      panelImageObjectPositionX: panelMediaRect ? panelImagePositionAxes.x : undefined,
      panelImageObjectPositionY: panelMediaRect ? panelImagePositionAxes.y : undefined,
      panelImageBorderRadius: panelMediaRect ? genericCssMetric(panelMedia?.borderRadius) : undefined,
    },
  };
}

function summarizeReferenceLayoutGroups(layoutGroups, band, textBoxes, mediaBoxes, semanticGroups = new Map()) {
  const allGroups = (Array.isArray(layoutGroups) ? layoutGroups : [])
    .map((group) => {
      const rect = normalizeReferenceRect(group?.rect);
      const key = String(group?.key || '');
      const containmentTolerance = rect
        ? Math.max(3, Math.min(24, Math.max(rect.width, rect.height) * 0.02))
        : 3;
      const structurallyOwnedOverlayOverlap = group?.flowParticipation === 'overlay'
        && group?.paintedBackground === true
        && rect
        && referenceRectMateriallyOverlaps(band.rect, rect);
      if (!rect
        || !key
        || key === band.key
        || (band.key && !key.startsWith(`${band.key}.`))
        || (!referenceRectContains(band.rect, rect, containmentTolerance) && !structurallyOwnedOverlayOverlap)) {
        return null;
      }
      return {
        key,
        parentKey: String(group.parentKey || ''),
        tag: String(group.tag || 'div').toLowerCase(),
        rect,
        backgroundColor: String(group.backgroundColor || ''),
        backgroundType: String(group.backgroundType || ''),
        gradientType: String(group.gradientType || ''),
        gradientAngle: group.gradientAngle,
        gradientColor1: String(group.gradientColor1 || ''),
        gradientColor2: String(group.gradientColor2 || ''),
        backgroundAccentType: String(group.backgroundAccentType || ''),
        backgroundAccentColor1: String(group.backgroundAccentColor1 || ''),
        backgroundAccentColor2: String(group.backgroundAccentColor2 || ''),
        backgroundAccentPositionX: String(group.backgroundAccentPositionX || ''),
        backgroundAccentPositionY: String(group.backgroundAccentPositionY || ''),
        backgroundAccentSize: String(group.backgroundAccentSize || ''),
        display: String(group.display || ''),
        flexDirection: String(group.flexDirection || ''),
        flexWrap: String(group.flexWrap || ''),
        justifyContent: String(group.justifyContent || ''),
        alignItems: String(group.alignItems || ''),
        gap: String(group.gap || ''),
        rowGap: String(group.rowGap || ''),
        columnGap: String(group.columnGap || ''),
        borderRadius: String(group.borderRadius || ''),
        borderWidth: String(group.borderWidth || ''),
        borderColor: String(group.borderColor || ''),
        borderTopWidth: String(group.borderTopWidth || ''),
        borderRightWidth: String(group.borderRightWidth || ''),
        borderBottomWidth: String(group.borderBottomWidth || ''),
        borderLeftWidth: String(group.borderLeftWidth || ''),
        borderTopColor: String(group.borderTopColor || ''),
        borderRightColor: String(group.borderRightColor || ''),
        borderBottomColor: String(group.borderBottomColor || ''),
        borderLeftColor: String(group.borderLeftColor || ''),
        boxShadow: String(group.boxShadow || ''),
        visualTilt: String(group.visualTilt || ''),
        layoutWidth: Number.isFinite(group.layoutWidth) ? group.layoutWidth : undefined,
        layoutHeight: Number.isFinite(group.layoutHeight) ? group.layoutHeight : undefined,
        visualFrame: summarizeReferenceVisualFrame(group.visualFrame),
        overflow: String(group.overflow || ''),
        paddingTop: String(group.paddingTop || ''),
        paddingRight: String(group.paddingRight || ''),
        paddingBottom: String(group.paddingBottom || ''),
        paddingLeft: String(group.paddingLeft || ''),
        paintedBackground: group.paintedBackground === true,
        flowParticipation: group.flowParticipation === 'overlay' ? 'overlay' : 'normal',
        stackingIndex: safeReferenceStackingIndex(group.stackingIndex),
        sticky: group.sticky === true,
        stickyTop: String(group.stickyTop || ''),
      };
    })
    .filter(Boolean);
  const keys = new Set(allGroups.map((group) => group.key));
  const semanticHostKeys = Array.from(semanticGroups.keys());
  const groups = allGroups.filter((group) => !semanticHostKeys.some((hostKey) => (
    group.key !== hostKey && group.key.startsWith(`${hostKey}.`)
  )));
  const retainedKeys = new Set(groups.map((group) => group.key));
  const byParent = new Map();
  for (const group of groups) {
    const parentKey = retainedKeys.has(group.parentKey) ? group.parentKey : band.key;
    const siblings = byParent.get(parentKey) || [];
    siblings.push(group);
    byParent.set(parentKey, siblings);
  }

  const summarizeGroup = (group) => {
    const semantic = semanticGroups.get(group.key);
    const directMedia = semantic ? [] : mediaBoxes
      .filter((box) => String(box?.parentGroupKey || '') === group.key)
      .map((box) => summarizeReferenceMediaBox(box, band.rect))
      .filter(Boolean);
    return {
      ...group,
      ...(semantic || {}),
      texts: semantic ? [] : textBoxes
        .filter((box) => String(box?.parentGroupKey || '') === group.key)
        .sort((left, right) => referenceBoxTop(left) - referenceBoxTop(right) || Number(left?.rect?.left || left?.rect?.x || 0) - Number(right?.rect?.left || right?.rect?.x || 0))
        .map(summarizeReferenceBox),
      mediaCount: directMedia.length,
      media: directMedia,
      overlayMedia: directMedia.filter((box) => box.flowParticipation === 'overlay'),
      groups: semantic ? [] : (byParent.get(group.key) || [])
        .sort((left, right) => compareReferenceStructureKeys(left.key, right.key))
        .map(summarizeGroup),
    };
  };

  return {
    keys,
    groups: (byParent.get(band.key) || [])
      .sort((left, right) => compareReferenceStructureKeys(left.key, right.key))
      .map(summarizeGroup),
  };
}

function compareReferenceStructureKeys(left, right) {
  const leftParts = String(left || '').split('.').map(Number);
  const rightParts = String(right || '').split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : -1;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : -1;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  return 0;
}

function summarizeReferenceChildLandmarks(landmarks, band, textBoxes, mediaBoxes) {
  const candidates = (Array.isArray(landmarks) ? landmarks : [])
    .map((landmark) => {
      const rect = normalizeReferenceRect(landmark?.rect);
      const tag = String(landmark?.tag || '').toLowerCase();
      if (!rect || !['article', 'aside'].includes(tag) || !referenceRectContains(band.rect, rect)) {
        return null;
      }
      if (rect.width * rect.height >= band.rect.width * band.rect.height * 0.92) {
        return null;
      }
      return {
        tag,
        rect,
        backgroundColor: String(landmark.backgroundColor || ''),
        backgroundType: String(landmark.backgroundType || ''),
        gradientType: String(landmark.gradientType || ''),
        gradientAngle: landmark.gradientAngle,
        gradientColor1: String(landmark.gradientColor1 || ''),
        gradientColor2: String(landmark.gradientColor2 || ''),
        backgroundAccentType: String(landmark.backgroundAccentType || ''),
        backgroundAccentColor1: String(landmark.backgroundAccentColor1 || ''),
        backgroundAccentColor2: String(landmark.backgroundAccentColor2 || ''),
        backgroundAccentPositionX: String(landmark.backgroundAccentPositionX || ''),
        backgroundAccentPositionY: String(landmark.backgroundAccentPositionY || ''),
        backgroundAccentSize: String(landmark.backgroundAccentSize || ''),
        borderRadius: String(landmark.borderRadius || ''),
        borderWidth: String(landmark.borderWidth || ''),
        borderColor: String(landmark.borderColor || ''),
        borderTopWidth: String(landmark.borderTopWidth || ''),
        borderRightWidth: String(landmark.borderRightWidth || ''),
        borderBottomWidth: String(landmark.borderBottomWidth || ''),
        borderLeftWidth: String(landmark.borderLeftWidth || ''),
        borderTopColor: String(landmark.borderTopColor || ''),
        borderRightColor: String(landmark.borderRightColor || ''),
        borderBottomColor: String(landmark.borderBottomColor || ''),
        borderLeftColor: String(landmark.borderLeftColor || ''),
        boxShadow: String(landmark.boxShadow || ''),
        overflow: String(landmark.overflow || ''),
        paddingTop: String(landmark.paddingTop || ''),
        paddingRight: String(landmark.paddingRight || ''),
        paddingBottom: String(landmark.paddingBottom || ''),
        paddingLeft: String(landmark.paddingLeft || ''),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);
  const topLevel = candidates.filter((candidate) => !candidates.some((other) => (
    other !== candidate
    && other.rect.width * other.rect.height > candidate.rect.width * candidate.rect.height
    && referenceRectContains(other.rect, candidate.rect)
  )));

  return topLevel.map((child, index) => ({
    ...child,
    index,
    texts: textBoxes
      .filter((box) => {
        const rect = normalizeReferenceRect(box?.rect);
        return rect && referenceRectContains(child.rect, rect);
      })
      .sort((left, right) => referenceBoxTop(left) - referenceBoxTop(right) || Number(left?.rect?.left || left?.rect?.x || 0) - Number(right?.rect?.left || right?.rect?.x || 0))
      .map(summarizeReferenceBox),
    mediaCount: mediaBoxes.filter((box) => {
      const rect = normalizeReferenceRect(box?.rect);
      return rect && referenceRectContains(child.rect, rect);
    }).length,
  }));
}

function referenceRectContains(outer, inner, tolerance = 3) {
  return inner.left >= outer.left - tolerance
    && inner.right <= outer.right + tolerance
    && inner.top >= outer.top - tolerance
    && inner.bottom <= outer.bottom + tolerance;
}

function referenceRectMateriallyOverlaps(outer, inner, minimumInnerCoverage = 0.4) {
  const outerRect = normalizeReferenceRect(outer);
  const innerRect = normalizeReferenceRect(inner);
  if (!outerRect || !innerRect) {
    return false;
  }
  const overlapWidth = Math.max(0, Math.min(outerRect.right, innerRect.right) - Math.max(outerRect.left, innerRect.left));
  const overlapHeight = Math.max(0, Math.min(outerRect.bottom, innerRect.bottom) - Math.max(outerRect.top, innerRect.top));
  const innerArea = innerRect.width * innerRect.height;
  return innerArea > 0 && overlapWidth * overlapHeight >= innerArea * minimumInnerCoverage;
}

function referenceBoxBelongsToBand(box, bandRect) {
  const rect = normalizeReferenceRect(box?.rect);
  if (!rect) {
    return false;
  }
  const centerY = rect.top + rect.height / 2;
  const overlap = Math.max(0, Math.min(rect.bottom, bandRect.bottom) - Math.max(rect.top, bandRect.top));
  return centerY >= bandRect.top && centerY <= bandRect.bottom && overlap >= Math.min(rect.height, bandRect.height) * 0.4;
}

function referenceContentBounds(boxes, bandRect) {
  const rects = boxes.map((box) => normalizeReferenceRect(box?.rect)).filter(Boolean);
  if (rects.length === 0) {
    return null;
  }
  const left = Math.max(bandRect.left, Math.min(...rects.map((rect) => rect.left)));
  const right = Math.min(bandRect.right, Math.max(...rects.map((rect) => rect.right)));
  const top = Math.max(bandRect.top, Math.min(...rects.map((rect) => rect.top)));
  const bottom = Math.min(bandRect.bottom, Math.max(...rects.map((rect) => rect.bottom)));
  return { left, right, top, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function estimateReferenceBandColumns(boxes, bandRect) {
  const rects = boxes
    .map((box) => normalizeReferenceRect(box?.rect))
    .filter((rect) => rect && rect.width >= bandRect.width * 0.12 && rect.height >= 12);
  let maximum = 1;

  for (const anchor of rects) {
    const row = rects
      .filter((rect) => referenceRectsShareRow(anchor, rect))
      .sort((left, right) => left.left - right.left);
    let columns = 0;
    let rightEdge = -Infinity;
    for (const rect of row) {
      if (rect.left >= rightEdge - 4) {
        columns += 1;
        rightEdge = rect.right;
      }
    }
    maximum = Math.max(maximum, columns);
  }

  return Math.max(1, Math.min(4, maximum));
}

function referenceRectsShareRow(left, right) {
  const overlap = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return overlap >= Math.min(left.height, right.height) * 0.25;
}

function summarizeReferenceBox(box) {
  if (!box || typeof box !== 'object') {
    return null;
  }

  return {
    parentGroupKey: String(box.parentGroupKey || ''),
    structureKey: String(box.structureKey || ''),
    tag: box.tag || '',
    text: box.text || '',
    source: box.source || '',
    rect: box.rect || null,
    firstViewportArea: Number(box.firstViewportArea || 0),
    stackingIndex: safeReferenceStackingIndex(box.stackingIndex),
    fontSize: box.fontSize || '',
    fontWeight: box.fontWeight || '',
    fontFamily: box.fontFamily || '',
    ...(['loaded-face', 'system-family', 'failed-face', 'unknown'].includes(box.primaryFontEvidence)
      ? { primaryFontEvidence: box.primaryFontEvidence }
      : {}),
    lineHeight: box.lineHeight || '',
    letterSpacing: box.letterSpacing || '',
    textAlign: box.textAlign || '',
    textTransform: box.textTransform || '',
    color: box.color || '',
    backgroundColor: box.backgroundColor || '',
    borderRadius: box.borderRadius || '',
    borderWidth: box.borderWidth || '',
    borderColor: box.borderColor || '',
    borderTopWidth: box.borderTopWidth || '',
    borderRightWidth: box.borderRightWidth || '',
    borderBottomWidth: box.borderBottomWidth || '',
    borderLeftWidth: box.borderLeftWidth || '',
    borderTopColor: box.borderTopColor || '',
    borderRightColor: box.borderRightColor || '',
    borderBottomColor: box.borderBottomColor || '',
    borderLeftColor: box.borderLeftColor || '',
    boxShadow: box.boxShadow || '',
    paddingTop: box.paddingTop || '',
    paddingRight: box.paddingRight || '',
    paddingBottom: box.paddingBottom || '',
    paddingLeft: box.paddingLeft || '',
    marginTop: box.marginTop || '',
    marginRight: box.marginRight || '',
    marginBottom: box.marginBottom || '',
    marginLeft: box.marginLeft || '',
    lines: Array.isArray(box.lines)
      ? box.lines.map((line) => ({ text: line?.text || '', rect: line?.rect || null })).filter((line) => line.text)
      : [],
  };
}

function isMeaningfulReferenceMediaBox(box, viewport) {
  const source = String(box?.source || box?.backgroundImage || '').trim();
  const rect = box?.rect || {};
  const width = Number(rect.width || 0);
  const height = Number(rect.height || 0);
  const viewportArea = Number(viewport?.width || 0) * Number(viewport?.height || 0);
  const minArea = Math.max(12000, viewportArea * 0.004);

  if (!isReferencePhotoSource(source) || isExcludedReferenceMediaSource(source)) {
    return false;
  }

  return width * height >= minArea || Number(box?.firstViewportArea || 0) >= minArea;
}

function isReferencePhotoSource(source) {
  return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(source)
    || /images\.unsplash\.com\/photo-/i.test(source)
    || /images\.pexels\.com\/photos\//i.test(source)
    || /source\.unsplash\.com/i.test(source)
    || /picsum\.photos/i.test(source);
}

function isExcludedReferenceMediaSource(source) {
  const pathname = (() => {
    try {
      return new URL(source).pathname;
    } catch (error) {
      return source;
    }
  })();
  const basename = decodeURIComponent(pathname.split('/').pop() || '');

  return /(?:logo|brand|icon|favicon|vector|avatar|sprite|badge|star|rating)/i.test(basename)
    || /(?:^|[-_])(?:abstract|bokeh|blob|decorative|dots|gradient|illustration|noise|ornament|pattern|shape|texture|textured)(?:[-_.]|$)/i.test(basename)
    || /(?:^|[-_])(?:client|partner|sponsor)[-_]?\d+(?:[-_.]|$)/i.test(basename);
}

function referenceBoxArea(box) {
  const rect = box?.rect || {};
  return Number(rect.width || 0) * Number(rect.height || 0);
}

function referenceBoxTop(box) {
  const rect = box?.rect || {};
  return Number.isFinite(rect.top) ? Number(rect.top) : Number(rect.y || 0);
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
    const props = unique(
      arrayOfStrings(entry.aiProps)
        .concat(arrayOfStrings(entry.props))
        .concat(objectKeys(entry.props))
        .concat(objectKeys(entry.defaults))
        .concat(controlMetadata.props)
    );

    index.set(name, {
      name,
      props,
      authoringProps: unique(arrayOfStrings(entry.aiProps).concat(controlMetadata.props)),
      controlProps: unique(controlMetadata.props),
      allowedParents: unique(arrayOfStrings(entry.allowedParents)),
      defaults: entry.defaults && typeof entry.defaults === 'object' && !Array.isArray(entry.defaults)
        ? entry.defaults
        : {},
      propOptions: controlMetadata.propOptions,
      propRules: controlMetadata.propRules,
      repeaterItemProps: controlMetadata.repeaterItemProps,
      repeaterItemRules: controlMetadata.repeaterItemRules,
    });
  }

  return index;
}

function collectControlMetadata(value) {
  const props = [];
  const propOptions = new Map();
  const propRules = new Map();
  const repeaterItemProps = new Map();
  const repeaterItemRules = new Map();

  visit(value, (item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
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

    if (item.type === 'repeater' && itemProps.length > 0) {
      const nestedMetadata = collectControlMetadata([item.itemControls, item.itemFields]);
      for (const repeaterProp of itemProps) {
        const existingProps = repeaterItemProps.get(repeaterProp) || new Set();
        for (const nestedProp of nestedMetadata.props) {
          existingProps.add(nestedProp);
        }
        repeaterItemProps.set(repeaterProp, existingProps);

        const existingRules = repeaterItemRules.get(repeaterProp) || new Map();
        for (const [nestedProp, rule] of nestedMetadata.propRules.entries()) {
          existingRules.set(nestedProp, rule);
        }
        repeaterItemRules.set(repeaterProp, existingRules);
      }
    }

    if (typeof item.type === 'string' && itemProps.length > 0) {
      const rule = { type: item.type };
      if (typeof item.min === 'number') {
        rule.min = item.min;
      }
      if (typeof item.max === 'number') {
        rule.max = item.max;
      }
      if (typeof item.step === 'number') {
        rule.step = item.step;
      }
      if (Array.isArray(item.units)) {
        rule.units = item.units.filter((unit) => typeof unit === 'string');
      }

      for (const prop of itemProps) {
        propRules.set(prop, { ...(propRules.get(prop) || {}), ...rule });
      }
    }

    const optionValues = collectOptionValues(item.options);
    if (optionValues.length > 0) {
      for (const prop of itemProps) {
        const existing = propOptions.get(prop) || new Set();
        for (const optionValue of optionValues) {
          existing.add(optionValue);
        }
        propOptions.set(prop, existing);
      }
    }
  });

  return { props, propOptions, propRules, repeaterItemProps, repeaterItemRules };
}

function collectOptionValues(options) {
  if (Array.isArray(options)) {
    return uniqueOptionValues(options.map(optionValue).filter((value) => value !== null));
  }

  if (options && typeof options === 'object') {
    return uniqueOptionValues(Object.values(options).map(optionValue).filter((value) => value !== null));
  }

  return [];
}

function uniqueOptionValues(items) {
  return [...new Set(items.filter((item) => typeof item !== 'undefined' && item !== null))];
}

function optionValue(option) {
  if (isScalar(option)) {
    return normalizeComparableValue(option);
  }

  if (option && typeof option === 'object' && Object.prototype.hasOwnProperty.call(option, 'value') && isScalar(option.value)) {
    return normalizeComparableValue(option.value);
  }

  return null;
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function normalizeComparableValue(value) {
  return String(value);
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

function draftLayout(contractIndex, brief) {
  const genericMeasuredReference = isGenericMeasuredReferenceBrief(brief);
  const context = {
    contractIndex,
    brief,
    nodeMap: {
      ROOT: {
        type: { resolvedName: 'RootCanvas' },
        isCanvas: true,
        props: {},
        nodes: [],
      },
    },
    counters: {},
    warnings: [],
    heroProofCards: 0,
    strictAuthoringContract: genericMeasuredReference,
    genericMeasuredGroupNodes: new Map(),
    genericMeasuredNodeKeys: new Map(),
    genericMeasuredOrderEntries: new Map(),
    genericMeasuredLoweredMediaKeys: new Set(),
    replacementProfile: genericMeasuredReference ? DEFAULT_REPLACEMENT_PROFILE : replacementProfileForBrief(brief),
  };
  context.styleProfile = styleProfileForBrief(brief, context.replacementProfile);
  context.geometryProfile = geometryProfileForBrief(brief, context.replacementProfile);

  const section = requireComponent(context, ['Section']);
  const container = requireComponent(context, ['Container']);
  requireComponent(context, ['Heading']);
  requireComponent(context, ['Text']);

  let genericPlan = null;
  if (genericMeasuredReference) {
    genericPlan = buildGenericMeasuredSectionPlan(brief);
    assertGenericMeasuredContract(context, genericPlan, section, container);
    addGenericMeasuredSections(context, genericPlan, section, container);
    context.warnings.push('Generic measured-reference geometry scaffold only; template-family mechanics and 1:1 visual fidelity are not claimed.');
  } else {
    addNavSection(context, section, container);
    addHeroSection(context, section, container);
    if (isOptomattaProfile(context)) {
      addOptomattaProofStripSection(context, section, container);
      addOptomattaIntroSection(context, section, container);
    }
    if (isMaidyProfile(context)) {
      addLogoStripSection(context, section, container);
      addMaidyHomepageDepthSections(context, section, container);
    } else if (!isLumenProfile(context)) {
      const rootCountBeforeServices = context.nodeMap.ROOT.nodes.length;
      addServicesSection(context, section, container);
      const rootCountAfterServices = context.nodeMap.ROOT.nodes.length;
      addStatsSection(context, section, container);
      if (
        context.replacementProfile?.name === 'luxury-car-care'
        && rootCountAfterServices >= rootCountBeforeServices + 2
        && context.nodeMap.ROOT.nodes.length === rootCountAfterServices + 1
      ) {
        const statsSectionId = context.nodeMap.ROOT.nodes.pop();
        context.nodeMap.ROOT.nodes.splice(rootCountBeforeServices + 1, 0, statsSectionId);
      }
    }
    if (context.replacementProfile?.name === 'luxury-car-care') {
      addCaregloHomepageDepthSections(context, section, container);
    }
    if (isOptomattaProfile(context)) {
      addOptomattaHomepageDepthSections(context, section, container);
    }
    if (isLumenProfile(context)) {
      addLumenHomepageDepthSections(context, section, container);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    layout: context.nodeMap,
    warnings: context.warnings,
    stats: {
      nodes: Object.keys(context.nodeMap).length,
      rootSections: context.nodeMap.ROOT.nodes.length,
      requiredMediaRoles: requiredMediaRoles(brief).length,
      mediaProfile: context.replacementProfile.name,
      styleProfile: context.styleProfile.name,
      geometryProfile: context.geometryProfile.name,
      innerMaxWidth: context.geometryProfile.innerMaxWidth,
      heroMinHeight: context.geometryProfile.heroMinHeight,
      visualMinHeight: context.geometryProfile.visualMinHeight,
      heroProofCards: context.heroProofCards,
      referenceHeroHeadingLines: context.geometryProfile.referenceGeometry?.desktop?.heroHeading?.lines?.length || 0,
      authoringMode: genericPlan ? GENERIC_MEASURED_REFERENCE : 'specialized-or-generated',
      qualityLabel: genericPlan ? 'generic_geometry_scaffold' : 'family_or_generated_scaffold',
      familyMechanicsClaimed: genericPlan ? false : undefined,
      measuredBandCount: genericPlan?.bands.length || 0,
      measuredDesktopDepth: genericPlan?.desktopDepth || 0,
      measuredViewportLabels: genericPlan?.viewportLabels || [],
    },
  };
}

function isGenericMeasuredReferenceBrief(brief) {
  const classification = brief.authoringRequirements?.referenceClassification
    || brief.target?.referenceClassification;
  if (classification?.kind === GENERIC_MEASURED_REFERENCE) {
    return true;
  }
  return classification?.kind === 'generated-target'
    && brief.authoringRequirements?.referenceGeometry
    && typeof brief.authoringRequirements.referenceGeometry === 'object';
}

function buildGenericMeasuredSectionPlan(brief) {
  const geometry = brief.authoringRequirements?.referenceGeometry;
  if (!geometry || typeof geometry !== 'object') {
    throw new Error('[generic_reference_geometry_missing] Generic measured references require captured reference-layout or reference brief landmark geometry.');
  }

  const viewportEntries = Object.entries(geometry)
    .filter(([, value]) => value && typeof value === 'object' && Array.isArray(value.bands));
  const canonicalEntry = viewportEntries.find(([label]) => label === 'desktop' || label.startsWith('desktop-'))
    || viewportEntries.slice().sort((left, right) => Number(right[1]?.viewport?.width || 0) - Number(left[1]?.viewport?.width || 0))[0];
  if (!canonicalEntry || canonicalEntry[1].bands.length === 0) {
    throw new Error('[generic_reference_band_geometry_missing] Captured reference evidence does not contain any major full-width landmark bands. Re-capture with --capture-layout --full-page.');
  }

  const [canonicalLabel, canonicalGeometry] = canonicalEntry;
  if (canonicalGeometry.bands.length > MAX_GENERIC_REFERENCE_BANDS) {
    throw new Error(`[generic_reference_band_limit_exceeded] Captured reference contains ${canonicalGeometry.bands.length} major bands; the bounded generic path supports at most ${MAX_GENERIC_REFERENCE_BANDS}.`);
  }

  const desktopEntry = viewportEntryForRole(viewportEntries, 'desktop') || canonicalEntry;
  const tabletEntry = viewportEntryForRole(viewportEntries, 'tablet');
  const mobileEntry = viewportEntryForRole(viewportEntries, 'mobile');
  const primaryHeadingIndex = genericPrimaryHeadingIndex(canonicalGeometry.bands);
  const bands = canonicalGeometry.bands.map((canonicalBand, index) => ({
    index,
    tag: canonicalBand.tag,
    primaryHeading: index === primaryHeadingIndex,
    desktop: matchedReferenceBand(canonicalBand, index, canonicalGeometry.bands, desktopEntry?.[1]?.bands),
    tablet: matchedReferenceBand(canonicalBand, index, canonicalGeometry.bands, tabletEntry?.[1]?.bands),
    mobile: matchedReferenceBand(canonicalBand, index, canonicalGeometry.bands, mobileEntry?.[1]?.bands),
  }));

  for (const band of bands) {
    for (const [viewport, measurement] of Object.entries({ desktop: band.desktop, tablet: band.tablet, mobile: band.mobile })) {
      const height = Number(measurement?.rect?.height || 0);
      if (height > 3200) {
        throw new Error(`[generic_reference_band_height_out_of_bounds] Band ${band.index + 1} is ${Math.round(height)}px tall at ${viewport}; split the captured landmark into major full-width bands before drafting.`);
      }
    }
  }

  return {
    mode: GENERIC_MEASURED_REFERENCE,
    canonicalLabel,
    viewportLabels: viewportEntries.map(([label]) => label),
    hasTablet: Boolean(tabletEntry),
    hasMobile: Boolean(mobileEntry),
    hasMedia: bands.some((band) => genericBandMediaCount(band) > 0),
    preserveSourceText: brief.authoringRequirements?.preserveSourceText === true,
    reuseSourceMedia: brief.authoringRequirements?.reuseSourceMedia === true,
    pageBackground: normalizedAuthorableColor(desktopEntry?.[1]?.documentStyle?.backgroundColor),
    pageTextColor: normalizedAuthorableColor(desktopEntry?.[1]?.documentStyle?.color),
    desktopDepth: Number(desktopEntry?.[1]?.pageHeight || canonicalGeometry.pageHeight || 0),
    navigation: {
      desktop: desktopEntry?.[1]?.navigation || canonicalGeometry.navigation || null,
      tablet: tabletEntry?.[1]?.navigation || null,
      mobile: mobileEntry?.[1]?.navigation || null,
    },
    bands,
  };
}

function viewportEntryForRole(entries, role) {
  return entries.find(([label]) => label === role || label.startsWith(`${role}-`)) || null;
}

function matchedReferenceBand(canonicalBand, index, canonicalBands, viewportBands) {
  if (!Array.isArray(viewportBands) || viewportBands.length === 0) {
    return null;
  }
  const canonicalKey = String(canonicalBand?.key || '');
  const keyedViewportBands = viewportBands.filter((band) => String(band?.key || ''));
  if (canonicalKey && keyedViewportBands.length > 0) {
    return keyedViewportBands.find((band) => String(band.key) === canonicalKey) || null;
  }
  if (viewportBands.length === canonicalBands.length) {
    return viewportBands[index] || null;
  }
  if (canonicalBands.length <= 1 || viewportBands.length <= 1) {
    return viewportBands[0] || null;
  }

  const normalizedIndex = index / (canonicalBands.length - 1);
  const expectedIndex = Math.round(normalizedIndex * (viewportBands.length - 1));
  const candidates = viewportBands
    .map((band, bandIndex) => ({ band, bandIndex }))
    .sort((left, right) => {
      const leftTagPenalty = left.band.tag === canonicalBand.tag ? 0 : 0.35;
      const rightTagPenalty = right.band.tag === canonicalBand.tag ? 0 : 0.35;
      return Math.abs(left.bandIndex - expectedIndex) + leftTagPenalty
        - (Math.abs(right.bandIndex - expectedIndex) + rightTagPenalty);
    });
  return candidates[0]?.band || null;
}

function genericPrimaryHeadingIndex(bands) {
  const h1Index = bands.findIndex((band) => String(band?.heading?.tag || '').toLowerCase() === 'h1');
  if (h1Index >= 0) {
    return h1Index;
  }
  const substantialIndex = bands.findIndex((band) => Number(band?.rect?.height || 0) >= 300);
  return substantialIndex >= 0 ? substantialIndex : 0;
}

function genericMeasurementMedia(measurement) {
  return Array.isArray(measurement?.media)
    ? measurement.media.slice(0, MAX_GENERIC_REFERENCE_MEDIA_PER_BAND)
    : [];
}

function matchedGenericMeasuredMedia(canonical, index, measurement) {
  const candidates = genericMeasurementMedia(measurement);
  if (!canonical || candidates.length === 0) {
    return null;
  }
  const kind = String(canonical.mediaKind || '');
  const structureKey = String(canonical.structureKey || '');
  if (structureKey) {
    const structureMatch = candidates.find((candidate) => (
      candidate?.structureKey === structureKey && candidate?.mediaKind === kind
    ));
    if (structureMatch) {
      return structureMatch;
    }
  }
  const source = String(canonical.source || '');
  if (source) {
    const sourceMatch = candidates.find((candidate) => (
      candidate?.source === source && candidate?.mediaKind === kind
    ));
    if (sourceMatch) {
      return sourceMatch;
    }
  }
  if (structureKey || source) {
    return null;
  }
  const parentGroupKey = String(canonical.parentGroupKey || '');
  if (parentGroupKey) {
    const parentMatch = candidates.find((candidate) => (
      candidate?.parentGroupKey === parentGroupKey && candidate?.mediaKind === kind
    ));
    if (parentMatch) {
      return parentMatch;
    }
  }
  return candidates[index]?.mediaKind === kind
    ? candidates[index]
    : candidates.find((candidate) => candidate?.mediaKind === kind) || null;
}

function genericFullBandBackground(band, plan) {
  const desktopMedia = genericMeasurementMedia(band.desktop);
  for (let index = 0; index < desktopMedia.length; index += 1) {
    const desktop = desktopMedia[index];
    if (!genericMediaCoversBand(desktop, band.desktop)) {
      continue;
    }
    const tablet = matchedGenericMeasuredMedia(desktop, index, band.tablet);
    const mobile = matchedGenericMeasuredMedia(desktop, index, band.mobile);
    if ((plan.hasTablet && !genericMediaCoversBand(tablet, band.tablet))
      || (plan.hasMobile && !genericMediaCoversBand(mobile, band.mobile))) {
      continue;
    }
    return { desktop, tablet, mobile };
  }
  return null;
}

function genericMediaCoversBand(media, measurement) {
  if (media?.mediaKind !== 'background') {
    return false;
  }
  const rect = normalizeReferenceRect(media.rect);
  const bandRect = normalizeReferenceRect(measurement?.rect);
  if (!rect || !bandRect) {
    return false;
  }
  const horizontalOverlap = Math.max(0, Math.min(rect.right, bandRect.right) - Math.max(rect.left, bandRect.left));
  const verticalOverlap = Math.max(0, Math.min(rect.bottom, bandRect.bottom) - Math.max(rect.top, bandRect.top));
  return rect.width >= bandRect.width * 0.96
    && rect.height >= bandRect.height * 0.92
    && horizontalOverlap >= bandRect.width * 0.96
    && verticalOverlap >= bandRect.height * 0.92;
}

function sameGenericMeasuredMedia(left, right) {
  if (!left || !right || left.mediaKind !== right.mediaKind) {
    return false;
  }
  if (left.structureKey && right.structureKey) {
    return left.structureKey === right.structureKey;
  }
  return Boolean(left.source && right.source && left.source === right.source);
}

function genericMeasuredMediaBundles(band, plan, backgroundBundle = genericFullBandBackground(band, plan)) {
  const desktopMedia = genericMeasurementMedia(band.desktop)
    .filter((media) => !sameGenericMeasuredMedia(media, backgroundBundle?.desktop));
  if (desktopMedia.length === 0) {
    const legacyCount = Math.max(0, Math.min(
      MAX_GENERIC_REFERENCE_MEDIA_PER_BAND,
      Number(band?.desktop?.mediaCount || 0) - (backgroundBundle ? 1 : 0)
    ));
    return Array.from({ length: legacyCount }, () => ({ desktop: null, tablet: null, mobile: null }));
  }

  return desktopMedia
    .slice(0, MAX_GENERIC_REFERENCE_MEDIA_PER_BAND)
    .map((desktop, index) => ({
      desktop,
      tablet: matchedGenericMeasuredMedia(desktop, index, band.tablet),
      mobile: matchedGenericMeasuredMedia(desktop, index, band.mobile),
    }));
}

function genericMeasuredMediaFit(bundle) {
  for (const media of [bundle?.desktop, bundle?.tablet, bundle?.mobile]) {
    const fit = media?.backgroundSize || media?.objectFit;
    if (fit) {
      return fit;
    }
  }
  return 'cover';
}

function genericMeasuredMediaFitChanges(bundle, plan) {
  const fits = [
    bundle?.desktop,
    ...(plan.hasTablet ? [bundle?.tablet] : []),
    ...(plan.hasMobile ? [bundle?.mobile] : []),
  ]
    .map((media) => media?.backgroundSize || media?.objectFit || '')
    .filter(Boolean);
  return new Set(fits).size > 1;
}

function genericMeasuredMediaPositionProps(bundle, plan) {
  const center = { x: '50%', y: '50%' };
  const desktop = genericMeasuredMediaAxes(bundle?.desktop) || center;
  const tablet = genericMeasuredMediaAxes(bundle?.tablet) || desktop;
  const mobile = genericMeasuredMediaAxes(bundle?.mobile) || tablet;
  const position = genericMeasuredMediaPositionKeyword(desktop);
  const props = { backgroundPosition: position || 'center' };

  if (!position) {
    props.backgroundPositionX = desktop.x;
    props.backgroundPositionY = desktop.y;
  }
  if (plan.hasTablet && (tablet.x !== desktop.x || tablet.y !== desktop.y)) {
    props.backgroundPositionXTablet = tablet.x;
    props.backgroundPositionYTablet = tablet.y;
  }
  if (plan.hasMobile && (mobile.x !== tablet.x || mobile.y !== tablet.y)) {
    props.backgroundPositionXMobile = mobile.x;
    props.backgroundPositionYMobile = mobile.y;
  }
  return props;
}

function genericMeasuredMediaAxes(media) {
  return media?.positionX && media?.positionY
    ? { x: media.positionX, y: media.positionY }
    : null;
}

function genericMeasuredMediaPositionKeyword(position) {
  return {
    '50% 50%': 'center',
    '50% 0%': 'top',
    '50% 100%': 'bottom',
    '0% 50%': 'left',
    '100% 50%': 'right',
  }[`${position.x} ${position.y}`] || '';
}

function assertGenericMeasuredContract(context, plan, sectionName, containerName) {
  const errors = [];
  const section = context.contractIndex.get(sectionName);
  const container = context.contractIndex.get(containerName);
  const heading = findComponent(context.contractIndex, ['Heading']);
  const text = findComponent(context.contractIndex, ['Text']);
  const hasGrid = plan.bands.some((band) => Math.max(
    genericBandColumnCount(band, 'desktop'),
    genericBandColumnCount(band, 'tablet'),
    genericBandColumnCount(band, 'mobile')
  ) > 1);
  const needsBandBackground = plan.bands.some((band) => genericBandBackground(band));
  const hasMeasuredItems = plan.bands.some((band) => (
    genericMeasurementItems(band.desktop).length > 0
  ));
  const hasLayoutGroups = plan.bands.some((band) => (
    Array.isArray(band.desktop?.groups) && band.desktop.groups.length > 0
  ));
  const hasFixedTrackRow = genericMeasuredPlanHasFixedTrackRow(plan);
  const stickyResetValues = new Set();
  let needsTextHorizontalMargin = false;
  const measuredGroupStack = plan.bands.map((band) => ({
    desktop: band.desktop,
    tablet: band.tablet,
    mobile: band.mobile,
  }));
  while (measuredGroupStack.length > 0) {
    const measurements = measuredGroupStack.pop();
    const desktopTexts = Array.isArray(measurements?.desktop?.texts) ? measurements.desktop.texts : [];
    for (let index = 0; index < desktopTexts.length; index += 1) {
      const desktopText = desktopTexts[index];
      const tabletText = matchedGenericMeasuredItem(desktopText, index, measurements?.tablet?.texts) || desktopText;
      const mobileText = matchedGenericMeasuredItem(desktopText, index, measurements?.mobile?.texts) || tabletText;
      const marginProps = genericMeasuredTextMarginProps(
        measurements.desktop,
        measurements.tablet || measurements.desktop,
        measurements.mobile || measurements.tablet || measurements.desktop,
        desktopText,
        tabletText,
        mobileText,
        plan
      );
      if (Object.keys(marginProps.wrapper).length > 0) {
        needsTextHorizontalMargin = true;
      }
    }
    for (const desktopGroup of Array.isArray(measurements?.desktop?.groups) ? measurements.desktop.groups : []) {
      const tabletGroup = matchedGenericMeasuredGroup(desktopGroup, measurements?.tablet?.groups);
      const mobileGroup = matchedGenericMeasuredGroup(desktopGroup, measurements?.mobile?.groups);
      if (desktopGroup.sticky === true) {
        if (plan.hasTablet && tabletGroup && tabletGroup.sticky !== true) {
          stickyResetValues.add('tablet');
        } else if (plan.hasMobile && mobileGroup && mobileGroup.sticky !== true) {
          stickyResetValues.add('mobile');
        }
      }
      measuredGroupStack.push({
        desktop: desktopGroup,
        tablet: tabletGroup,
        mobile: mobileGroup,
      });
    }
    const desktopChildren = Array.isArray(measurements?.desktop?.children) ? measurements.desktop.children : [];
    for (let index = 0; index < desktopChildren.length; index += 1) {
      const desktopChild = desktopChildren[index];
      const tabletChild = matchedGenericMeasuredItem(desktopChild, index, measurements?.tablet?.children);
      const mobileChild = matchedGenericMeasuredItem(desktopChild, index, measurements?.mobile?.children);
      measuredGroupStack.push({
        desktop: desktopChild,
        tablet: tabletChild,
        mobile: mobileChild,
      });
    }
  }
  const sectionAuthoringProps = new Set(section?.authoringProps || []);
  const needsSectionOverlap = plan.bands.some((band) => (
    [band.desktop, band.tablet, band.mobile]
      .some((measurement) => Number(measurement?.precedingOverlap || 0) > 0)
  ));
  const needsSectionOverflow = plan.bands.some((band) => (
    [band.desktop, band.tablet, band.mobile].some((measurement) => measurement?.clipsHorizontalOverflow === true)
  ));
  const heroBackgrounds = plan.bands
    .map((band) => genericFullBandBackground(band, plan))
    .filter(Boolean);
  const inlineMediaBundles = plan.bands.flatMap((band) => (
    genericMeasuredMediaBundles(band, plan, genericFullBandBackground(band, plan))
  ));

  addGenericMissingProps(errors, 'generic_section_control_gap', section, [
    'innerMaxWidth',
    'innerPaddingX',
    ...(plan.hasTablet ? ['innerPaddingXTablet'] : []),
    ...(plan.hasMobile ? ['innerPaddingXMobile'] : []),
    'minHeight',
    'paddingTop',
    ...(plan.hasTablet ? ['minHeightTablet'] : []),
    ...(plan.hasTablet ? ['paddingTopTablet'] : []),
    ...(plan.hasMobile ? ['minHeightMobile'] : []),
    ...(plan.hasMobile ? ['paddingTopMobile'] : []),
    ...(needsSectionOverlap ? [
      'marginTop',
      ...(plan.hasTablet ? ['marginTopTablet'] : []),
      ...(plan.hasMobile ? ['marginTopMobile'] : []),
      'paintLayer',
    ] : []),
  ]);
  if (needsBandBackground && !['background', 'backgroundColor'].some((prop) => sectionAuthoringProps.has(prop))) {
    errors.push({
      code: 'generic_section_control_gap',
      message: `${section?.name || sectionName} needs one live authoring color prop: background or backgroundColor.`,
    });
  }
  if (needsSectionOverflow && !sectionAuthoringProps.has('overflow')) {
    errors.push({
      code: 'generic_section_overflow_control_gap',
      message: `${section?.name || sectionName}.overflow must be exposed by the live contract before a measured clipped band can be authored without className or raw CSS.`,
    });
  }
  addGenericMissingProps(errors, 'generic_container_control_gap', container, [
    'layoutDisplay',
    'flexDirection',
    'flexWrap',
    'justifyContent',
    'alignItems',
    'gap',
    'width',
    'maxWidth',
    'minHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  ]);
  addGenericMissingProps(errors, 'generic_responsive_control_gap', container, [
    ...(plan.hasTablet ? ['gapTablet', 'minHeightTablet', 'paddingTopTablet', 'paddingRightTablet', 'paddingBottomTablet', 'paddingLeftTablet'] : []),
    ...(plan.hasMobile ? ['gapMobile', 'minHeightMobile', 'paddingTopMobile', 'paddingRightMobile', 'paddingBottomMobile', 'paddingLeftMobile'] : []),
    ...(hasGrid ? ['gridTemplateColumns'] : []),
    ...(hasGrid && plan.hasTablet ? ['gridTemplateColumnsTablet'] : []),
    ...(hasGrid && plan.hasMobile ? ['gridTemplateColumnsMobile'] : []),
  ]);
  if (needsTextHorizontalMargin) {
    addGenericMissingProps(errors, 'generic_text_horizontal_margin_control_gap', container ? {
      ...container,
      authoringProps: container.controlProps,
    } : container, ['marginLeft', 'marginLeftTablet', 'marginLeftMobile']);
  }
  if (hasMeasuredItems) {
    addGenericMissingProps(errors, 'generic_geometry_control_gap', container, [
      'gridTemplateColumns',
      'gridColumnStart',
      'gridColumnSpan',
      'gridRowStart',
      'gridRowSpan',
      'maxWidth',
      ...(plan.hasTablet ? [
        'gridTemplateColumnsTablet',
        'gridColumnStartTablet',
        'gridColumnSpanTablet',
        'gridRowStartTablet',
        'gridRowSpanTablet',
        'maxWidthTablet',
      ] : []),
      ...(plan.hasMobile ? [
        'gridTemplateColumnsMobile',
        'gridColumnStartMobile',
        'gridColumnSpanMobile',
        'gridRowStartMobile',
        'gridRowSpanMobile',
        'maxWidthMobile',
      ] : []),
    ]);
    addGenericMissingOption(errors, container, 'gridTemplateColumns', 'six');
  }
  if (hasLayoutGroups) {
    addGenericMissingProps(errors, 'generic_responsive_flex_control_gap', container, [
      ...(plan.hasTablet ? ['flexDirectionTablet', 'flexWrapTablet', 'justifyContentTablet', 'alignItemsTablet'] : []),
      ...(plan.hasMobile ? ['flexDirectionMobile', 'flexWrapMobile', 'justifyContentMobile', 'alignItemsMobile'] : []),
    ]);
  }
  if (hasFixedTrackRow) {
    addGenericMissingProps(errors, 'generic_fixed_track_control_gap', container ? {
      ...container,
      authoringProps: container.controlProps,
    } : container, ['width', 'minWidth', 'flexBasis', 'flexGrow', 'flexShrink']);
  }
  if (stickyResetValues.size > 0) {
    addGenericMissingProps(errors, 'generic_responsive_sticky_control_gap', container ? {
      ...container,
      authoringProps: container.controlProps,
    } : container, ['sticky', 'stickyTop', 'stickyResetAt']);
    for (const resetAt of stickyResetValues) {
      addGenericMissingOption(errors, container, 'stickyResetAt', resetAt);
    }
  }
  addGenericMissingProps(errors, 'generic_typography_control_gap', heading, [
    'tag',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'fontWeight',
    ...(plan.hasTablet ? ['fontSizeTablet', 'lineHeightTablet', 'letterSpacingTablet'] : []),
    ...(plan.hasMobile ? ['fontSizeMobile', 'lineHeightMobile', 'letterSpacingMobile'] : []),
  ]);
  addGenericMissingProps(errors, 'generic_typography_control_gap', text, [
    'fontSize',
    'lineHeight',
    'letterSpacing',
    ...(plan.hasTablet ? ['fontSizeTablet', 'lineHeightTablet', 'letterSpacingTablet'] : []),
    ...(plan.hasMobile ? ['fontSizeMobile', 'lineHeightMobile', 'letterSpacingMobile'] : []),
  ]);
  addGenericContentPropGap(errors, heading);
  addGenericContentPropGap(errors, text);

  for (const backgroundBundle of heroBackgrounds) {
    addGenericMissingProps(errors, 'generic_media_control_gap', section, [
      'backgroundImage',
      'backgroundSize',
      ...Object.keys(genericMeasuredMediaPositionProps(backgroundBundle, plan)),
    ]);
    if (genericMeasuredMediaFitChanges(backgroundBundle, plan)) {
      errors.push({
        code: 'generic_responsive_media_control_gap',
        message: `${section?.name || sectionName}.backgroundSize needs responsive variants for the measured hero background fit change.`,
      });
    }
  }

  if (inlineMediaBundles.length > 0) {
    addGenericMissingProps(errors, 'generic_media_control_gap', container, [
      'backgroundImage',
      'backgroundSize',
      'backgroundPosition',
      ...(inlineMediaBundles.some((bundle) => genericCssMetric(bundle?.desktop?.borderRadius))
        ? ['borderRadius']
        : []),
      'width',
      'maxWidth',
      'minHeight',
      'flexShrink',
      'gridColumnStart',
      'gridColumnSpan',
      'gridRowStart',
      'gridRowSpan',
      ...(plan.hasTablet ? [
        'maxWidthTablet',
        'minHeightTablet',
        'gridColumnStartTablet',
        'gridColumnSpanTablet',
        'gridRowStartTablet',
        'gridRowSpanTablet',
      ] : []),
      ...(plan.hasMobile ? [
        'maxWidthMobile',
        'minHeightMobile',
        'gridColumnStartMobile',
        'gridColumnSpanMobile',
        'gridRowStartMobile',
        'gridRowSpanMobile',
      ] : []),
    ]);
    for (const mediaBundle of inlineMediaBundles) {
      addGenericMissingProps(
        errors,
        'generic_media_control_gap',
        container,
        Object.keys(genericMeasuredMediaPositionProps(mediaBundle, plan))
      );
      if (genericMeasuredMediaFitChanges(mediaBundle, plan)) {
        errors.push({
          code: 'generic_responsive_media_control_gap',
          message: `${container?.name || containerName}.backgroundSize needs responsive variants for a measured media fit change.`,
        });
      }
    }
  }

  for (const band of plan.bands) {
    const bandUsesGrid = Math.max(
      genericBandColumnCount(band, 'desktop'),
      genericBandColumnCount(band, 'tablet'),
      genericBandColumnCount(band, 'mobile')
    ) > 1;
    for (const viewport of ['desktop', 'tablet', 'mobile']) {
      if ((viewport === 'tablet' && !plan.hasTablet) || (viewport === 'mobile' && !plan.hasMobile)) {
        continue;
      }
      const prop = viewport === 'desktop' ? 'gridTemplateColumns' : `gridTemplateColumns${capitalize(viewport)}`;
      const columns = genericBandColumnCount(band, viewport);
      if (bandUsesGrid) {
        addGenericMissingOption(errors, container, prop, GENERIC_GRID_TOKENS[columns]);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Generic measured reference contract gaps:\n${errors.map((error) => `- [${error.code}] ${error.message}`).join('\n')}`);
  }
}

function addGenericMissingProps(errors, code, component, props) {
  if (!component) {
    errors.push({ code, message: `Required component is missing for ${code.replace(/^generic_|_control_gap$/g, '').replace(/_/g, ' ')} authoring.` });
    return;
  }
  const allowed = new Set(component.authoringProps || []);
  for (const prop of unique(props)) {
    if (!allowed.has(prop)) {
      errors.push({ code, message: `${component.name}.${prop} is required by the measured band plan but is absent from the live authoring contract.` });
    }
  }
}

function addGenericContentPropGap(errors, component) {
  if (!component) {
    return;
  }
  const allowed = new Set(component.authoringProps || []);
  if (!['text', 'content', 'children'].some((prop) => allowed.has(prop))) {
    errors.push({
      code: 'generic_typography_control_gap',
      message: `${component.name} needs one live authoring content prop: text, content, or children.`,
    });
  }
}

function addGenericMissingOption(errors, component, prop, value) {
  const options = component?.propOptions?.get(prop);
  if (options && options.size > 0 && !options.has(String(value))) {
    errors.push({
      code: 'generic_responsive_control_gap',
      message: `${component.name}.${prop} does not expose the measured ${value} grid token in its live control options.`,
    });
  }
}

function genericMeasuredDisplay(measurement) {
  const display = String(measurement?.display || '').toLowerCase();
  if (display === 'flex' || display === 'inline-flex') {
    return 'flex';
  }
  if (display === 'grid' || display === 'inline-grid') {
    return 'grid';
  }
  return Number(measurement?.columns || 1) > 1 ? 'grid' : 'flex';
}

function genericMeasuredFlexDirection(measurement) {
  const direction = String(measurement?.flexDirection || '').toLowerCase();
  return ['row', 'column', 'row-reverse', 'column-reverse'].includes(direction)
    ? direction
    : 'column';
}

function genericMeasuredFlexWrap(measurement) {
  const wrap = String(measurement?.flexWrap || '').toLowerCase();
  return ['nowrap', 'wrap', 'wrap-reverse'].includes(wrap) ? wrap : 'nowrap';
}

function genericMeasuredJustifyContent(measurement) {
  const justify = String(measurement?.justifyContent || '').toLowerCase();
  const normalized = { start: 'flex-start', end: 'flex-end', normal: 'flex-start' }[justify] || justify;
  return ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'].includes(normalized)
    ? normalized
    : 'flex-start';
}

function genericMeasuredAlignItems(measurement) {
  const align = String(measurement?.alignItems || '').toLowerCase();
  const normalized = { start: 'flex-start', end: 'flex-end', normal: 'stretch' }[align] || align;
  return ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'].includes(normalized)
    ? normalized
    : 'stretch';
}

function genericMeasuredLayoutGap(measurement) {
  const explicitGap = genericCssMetric(measurement?.gap)
    || genericCssMetric(measurement?.columnGap);
  if (explicitGap) {
    return explicitGap;
  }
  const sourceDisplay = String(measurement?.display || '').toLowerCase();
  return sourceDisplay === 'block' ? genericMeasuredItemGap(measurement) : '0px';
}

function genericBandLeadingOffset(measurement) {
  const leadingOffset = Number(measurement?.leadingOffset || 0);
  const precedingPaintedGap = Number(measurement?.precedingPaintedGap || 0);
  return `${Math.round(Math.max(0, leadingOffset + precedingPaintedGap))}px`;
}

function genericBandFrameHeight(measurement, occupiedHeight = 0) {
  const measuredHeight = Number(measurement?.rect?.height || 0);
  if (measuredHeight > 0 && occupiedHeight > 0) {
    return `${Math.max(0, Math.round((measuredHeight - occupiedHeight) * 100) / 100)}px`;
  }
  return genericMeasuredRectSize(measurement, 'height') || genericBandHeight(measurement);
}

function genericMeasuredGroupWidth(group, parent) {
  const groupRect = normalizeReferenceRect(group?.rect);
  const parentRect = normalizeReferenceRect(parent?.rect);
  if (!groupRect || !parentRect) {
    return undefined;
  }
  if (genericMeasuredDisplay(parent) === 'grid') {
    return '100%';
  }
  const horizontalPadding = [parent?.paddingLeft, parent?.paddingRight]
    .map((value) => Number.parseFloat(genericCssMetric(value) || '0'))
    .reduce((sum, value) => sum + value, 0);
  const contentWidth = Math.max(1, parentRect.width - horizontalPadding);
  return groupRect.width >= contentWidth * 0.92
    ? '100%'
    : genericMeasuredRectSize(group, 'width');
}

function genericMeasuredNavigationProps(context, navigation, plan, containerName) {
  const desktop = navigation?.desktop;
  if (!desktop) {
    return null;
  }
  const tablet = navigation.tablet || desktop;
  const mobile = navigation.mobile || tablet || desktop;
  const contentInset = (measurement) => {
    const rect = normalizeReferenceRect(measurement?.rect);
    const brandRect = normalizeReferenceRect(measurement?.logoMark?.rect || measurement?.brandBox?.rect);
    const ctaRect = normalizeReferenceRect(measurement?.ctaBox?.rect);
    if (!rect || (!brandRect && !ctaRect)) {
      return 0;
    }
    const left = brandRect ? Math.max(0, brandRect.left - rect.left) : Number.POSITIVE_INFINITY;
    const right = ctaRect ? Math.max(0, rect.right - ctaRect.right) : Number.POSITIVE_INFINITY;
    return Math.round(Math.min(left, right) * 100) / 100;
  };
  const contentPaddingY = (measurement) => {
    const rect = normalizeReferenceRect(measurement?.rect);
    const contentRects = [measurement?.logoMark, measurement?.brandBox, ...(measurement?.menuBoxes || []), measurement?.ctaBox]
      .map((box) => normalizeReferenceRect(box?.rect))
      .filter(Boolean);
    if (!rect || contentRects.length === 0) {
      return 12;
    }
    const contentHeight = Math.max(...contentRects.map((item) => item.height));
    return Math.max(0, Math.round(((rect.height - contentHeight) / 2) * 100) / 100);
  };
  const menuBoxes = Array.isArray(desktop.menuBoxes) ? desktop.menuBoxes : [];
  const menuGaps = menuBoxes.slice(1).map((box, index) => {
    const previous = normalizeReferenceRect(menuBoxes[index]?.rect);
    const current = normalizeReferenceRect(box?.rect);
    return previous && current ? Math.max(0, current.left - previous.right) : 0;
  }).filter((gap) => gap > 0).sort((left, right) => left - right);
  const menuGap = menuGaps.length > 0 ? menuGaps[Math.floor(menuGaps.length / 2)] : 24;
  const tabletMenuCount = Array.isArray(navigation.tablet?.menuBoxes) ? navigation.tablet.menuBoxes.length : menuBoxes.length;
  const mobileMenuCount = Array.isArray(navigation.mobile?.menuBoxes) ? navigation.mobile.menuBoxes.length : tabletMenuCount;
  const collapsesAtTablet = menuBoxes.length >= 2 && tabletMenuCount < 2;
  const collapsesAtMobile = menuBoxes.length >= 2 && mobileMenuCount < 2;
  const breakpoint = collapsesAtTablet
    ? 'tablet'
    : collapsesAtMobile ? 'mobile' : 'mobile';
  const measuredResponsiveBehavior = collapsesAtTablet || collapsesAtMobile;
  const hasResponsiveMenuTrigger = collapsesAtTablet
    ? navigation.tablet?.hasMenuTrigger === true
    : collapsesAtMobile && navigation.mobile?.hasMenuTrigger === true;
  const brandBox = desktop.brandBox || {};
  const ctaBox = desktop.ctaBox || {};
  const tabletBrandBox = tablet.brandBox || brandBox;
  const mobileBrandBox = mobile.brandBox || tabletBrandBox;
  const logoText = plan.preserveSourceText && String(brandBox.text || '').trim()
    ? String(brandBox.text).trim()
    : brandName(context.brief, context.replacementProfile);
  const ctaLabel = desktop.hasCta === false
    ? ''
    : genericMeasuredAuthoringText(ctaBox, plan, 0, menuBoxes.length + 1);
  const ctaRect = normalizeReferenceRect(ctaBox.rect);
  const tabletCtaRect = normalizeReferenceRect(tablet.ctaBox?.rect || ctaBox.rect);
  const mobileCtaRect = normalizeReferenceRect(mobile.ctaBox?.rect || tablet.ctaBox?.rect || ctaBox.rect);
  const ctaFontSize = pxNumber(String(ctaBox.fontSize || '')) || 14;
  const ctaPaddingY = ctaRect
    ? Math.max(0, Math.round(((ctaRect.height - ctaFontSize * 1.2) / 2) * 100) / 100)
    : 8;
  const navbarAuthoringProps = new Set(findComponent(context.contractIndex, ['Navbar'])?.authoringProps || []);
  const desktopInnerPaddingY = contentPaddingY(desktop);
  const tabletInnerPaddingY = contentPaddingY(tablet);
  const mobileInnerPaddingY = contentPaddingY(mobile);
  const authoredTabletInnerPaddingY = plan.hasTablet
    && navbarAuthoringProps.has('innerPaddingYTablet')
    && tabletInnerPaddingY !== desktopInnerPaddingY;
  const inheritedMobileInnerPaddingY = authoredTabletInnerPaddingY
    ? tabletInnerPaddingY
    : desktopInnerPaddingY;
  const desktopLogoFontSize = genericCssMetric(brandBox.fontSize) || '18px';
  const tabletLogoFontSize = genericCssMetric(tabletBrandBox.fontSize) || desktopLogoFontSize;
  const mobileLogoFontSize = genericCssMetric(mobileBrandBox.fontSize) || tabletLogoFontSize;
  const authoredTabletLogoFontSize = plan.hasTablet
    && navbarAuthoringProps.has('logoFontSizeTablet')
    && tabletLogoFontSize !== desktopLogoFontSize;
  const inheritedMobileLogoFontSize = authoredTabletLogoFontSize
    ? tabletLogoFontSize
    : desktopLogoFontSize;
  const desktopCtaIsCompact = desktop.hasCta !== false
    && ctaRect
    && ctaRect.width <= Math.max(64, ctaRect.height * 1.35);
  const tabletCtaIsCompact = tablet.hasCta !== false
    && tabletCtaRect
    && tabletCtaRect.width <= Math.max(64, tabletCtaRect.height * 1.35);
  const mobileCtaIsCompact = mobile.hasCta !== false
    && mobileCtaRect
    && mobileCtaRect.width <= Math.max(64, mobileCtaRect.height * 1.35);
  const desktopCtaContentMode = desktop.hasCta === false ? 'hidden' : desktopCtaIsCompact ? 'icon' : 'label';
  const tabletCtaContentMode = tablet.hasCta === false ? 'hidden' : tabletCtaIsCompact ? 'icon' : 'label';
  const mobileCtaContentMode = mobile.hasCta === false ? 'hidden' : mobileCtaIsCompact ? 'icon' : 'label';
  const compactCtaRect = mobileCtaIsCompact
    ? mobileCtaRect
    : tabletCtaIsCompact ? tabletCtaRect : desktopCtaIsCompact ? ctaRect : null;
  const authoredTabletCtaContentMode = plan.hasTablet
    && navbarAuthoringProps.has('ctaContentModeTablet')
    && tabletCtaContentMode !== desktopCtaContentMode;
  const inheritedMobileCtaContentMode = authoredTabletCtaContentMode
    ? tabletCtaContentMode
    : desktopCtaContentMode;

  return {
    height: Number(desktop.rect?.height || 0),
    heightTablet: Number(tablet.rect?.height || desktop.rect?.height || 0),
    heightMobile: Number(mobile.rect?.height || tablet.rect?.height || desktop.rect?.height || 0),
    hostProps: {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      flexDirectionTablet: plan.hasTablet ? 'column' : undefined,
      flexDirectionMobile: plan.hasMobile ? 'column' : undefined,
      alignItems: 'stretch',
      alignItemsTablet: plan.hasTablet ? 'stretch' : undefined,
      alignItemsMobile: plan.hasMobile ? 'stretch' : undefined,
      width: '100%',
      minHeight: genericMeasuredRectSize(desktop, 'height'),
      minHeightTablet: plan.hasTablet ? genericMeasuredRectSize(tablet, 'height') : undefined,
      minHeightMobile: plan.hasMobile ? genericMeasuredRectSize(mobile, 'height') : undefined,
      paddingLeft: `${contentInset(desktop)}px`,
      paddingLeftTablet: plan.hasTablet ? `${contentInset(tablet)}px` : undefined,
      paddingLeftMobile: plan.hasMobile ? `${contentInset(mobile)}px` : undefined,
      paddingRight: `${contentInset(desktop)}px`,
      paddingRightTablet: plan.hasTablet ? `${contentInset(tablet)}px` : undefined,
      paddingRightMobile: plan.hasMobile ? `${contentInset(mobile)}px` : undefined,
      ...backgroundProps(context, containerName, normalizedAuthorableColor(desktop.backgroundColor) || 'transparent'),
    },
    navbarProps: {
      logoText,
      menuItems: menuBoxes.map((box, index) => ({
        label: genericMeasuredAuthoringText(box, plan, 0, index + 1),
        href: '#',
      })),
      mobileMenuBehavior: menuBoxes.length < 2
        ? 'default'
        : measuredResponsiveBehavior
          ? (hasResponsiveMenuTrigger ? 'drawer' : 'hide-links')
          : 'drawer',
      mobileMenuBreakpoint: breakpoint,
      menuButtonLabel: 'Menu',
      menuButtonIcon: 'menu',
      ctaLabel,
      ctaHref: '#',
      ctaContentMode: navbarAuthoringProps.has('ctaContentMode') ? desktopCtaContentMode : undefined,
      ctaContentModeTablet: authoredTabletCtaContentMode ? tabletCtaContentMode : undefined,
      ctaContentModeMobile: plan.hasMobile
        && navbarAuthoringProps.has('ctaContentModeMobile')
        && mobileCtaContentMode !== inheritedMobileCtaContentMode
        ? mobileCtaContentMode
        : undefined,
      ctaIcon: compactCtaRect && navbarAuthoringProps.has('ctaIcon') ? 'arrow_forward' : undefined,
      ctaCompactSize: compactCtaRect && navbarAuthoringProps.has('ctaCompactSize')
        ? `${Math.round(Math.max(compactCtaRect.width, compactCtaRect.height))}px`
        : undefined,
      showLogoMark: desktop.showLogoMark === true,
      logoMarkSize: Math.max(20, Math.min(48, Math.round(
        Number(desktop.logoMark?.rect?.width || desktop.rect?.height || 68) - (desktop.logoMark ? 0 : contentPaddingY(desktop) * 2)
      ))),
      logoMarkBorderRadius: genericCssMetric(desktop.logoMark?.borderRadius) || '9999px',
      logoMarkGradientColor1: normalizedAuthorableColor(ctaBox.backgroundColor) || context.styleProfile.accent,
      logoMarkGradientColor2: context.styleProfile.accent2,
      logoMarkGradientAngle: 135,
      sticky: desktop.sticky === true,
      backgroundColor: 'rgba(0, 0, 0, 0)',
      borderColor: 'rgba(0, 0, 0, 0)',
      borderWidth: '0px',
      borderRadius: genericCssMetric(desktop.borderRadius) || '0px',
      innerPaddingY: `${desktopInnerPaddingY}px`,
      innerPaddingYTablet: authoredTabletInnerPaddingY ? `${tabletInnerPaddingY}px` : undefined,
      innerPaddingYMobile: plan.hasMobile
        && navbarAuthoringProps.has('innerPaddingYMobile')
        && mobileInnerPaddingY !== inheritedMobileInnerPaddingY
        ? `${mobileInnerPaddingY}px`
        : undefined,
      innerPaddingX: '0px',
      innerGap: '16px',
      brandGap: '10px',
      logoTextColor: normalizedAuthorableColor(brandBox.color) || context.styleProfile.ink,
      logoFontSize: desktopLogoFontSize,
      logoFontSizeTablet: authoredTabletLogoFontSize ? tabletLogoFontSize : undefined,
      logoFontSizeMobile: plan.hasMobile
        && navbarAuthoringProps.has('logoFontSizeMobile')
        && mobileLogoFontSize !== inheritedMobileLogoFontSize
        ? mobileLogoFontSize
        : undefined,
      logoFontWeight: genericFontWeight(brandBox, '700'),
      menuGap: `${Math.round(menuGap * 100) / 100}px`,
      linkColor: normalizedAuthorableColor(menuBoxes[0]?.color) || context.styleProfile.muted,
      linkFontSize: genericCssMetric(menuBoxes[0]?.fontSize) || '14px',
      linkFontWeight: genericFontWeight(menuBoxes[0], '500'),
      ctaBackgroundColor: normalizedAuthorableColor(ctaBox.backgroundColor) || context.styleProfile.buttonBg,
      ctaTextColor: normalizedAuthorableColor(ctaBox.color) || context.styleProfile.buttonFg,
      ctaBorderRadius: genericCssMetric(ctaBox.borderRadius) || '0px',
      ctaPaddingY: `${ctaPaddingY}px`,
      ctaPaddingX: '24px',
      ctaFontSize: genericCssMetric(ctaBox.fontSize) || '14px',
      ctaFontWeight: genericFontWeight(ctaBox, '600'),
    },
  };
}

function addGenericMeasuredSections(context, plan, sectionName, containerName) {
  for (const band of plan.bands) {
    const desktop = band.desktop;
    const tablet = band.tablet || desktop;
    const mobile = band.mobile || tablet || desktop;
    const navigationProps = band.index === 0
      ? genericMeasuredNavigationProps(context, plan.navigation, plan, containerName)
      : null;
    const desktopColumns = genericBandColumnCount(band, 'desktop');
    const hasMeasuredItems = genericMeasurementItems(desktop).length > 0;
    const desktopDisplay = genericMeasuredDisplay(desktop);
    const tabletDisplay = genericMeasuredDisplay(tablet);
    const mobileDisplay = genericMeasuredDisplay(mobile);
    const usesGrid = desktopDisplay === 'grid' || tabletDisplay === 'grid' || mobileDisplay === 'grid';
    const heroBackgroundBundle = genericFullBandBackground(band, plan);
    const foregroundBoxes = [];
    const foregroundStack = [desktop];
    while (foregroundStack.length > 0) {
      const measurement = foregroundStack.pop();
      if (!measurement) {
        continue;
      }
      foregroundBoxes.push(...(Array.isArray(measurement.texts) ? measurement.texts : []));
      foregroundStack.push(...(Array.isArray(measurement.groups) ? measurement.groups : []));
      foregroundStack.push(...(Array.isArray(measurement.children) ? measurement.children : []));
    }
    foregroundBoxes.sort((left, right) => {
      const leftHeading = /^h[1-4]$/iu.test(String(left?.tag || '')) ? 1 : 0;
      const rightHeading = /^h[1-4]$/iu.test(String(right?.tag || '')) ? 1 : 0;
      return rightHeading - leftHeading || referenceBoxArea(right) - referenceBoxArea(left);
    });
    const heroForegroundChannels = heroBackgroundBundle
      ? colorChannels(desktop.heading?.color || foregroundBoxes[0]?.color)
      : null;
    const heroForegroundLuminance = heroForegroundChannels
      ? (heroForegroundChannels[0] * 299 + heroForegroundChannels[1] * 587 + heroForegroundChannels[2] * 114) / 1000
      : null;
    const heroBackgroundOverlay = heroForegroundLuminance === null
      ? undefined
      : heroForegroundLuminance >= 170 ? 'rgba(7, 11, 20, 0.72)' : 'rgba(255, 255, 255, 0.68)';
    const bandBackground = genericBandBackground(band);
    const usesSectionSurface = desktop.fullWidth === true;
    const usesMeasuredBandFrame = !usesSectionSurface && [desktop, tablet, mobile].some((measurement) => (
      measurement?.paintedBackground === true
    ));
    const sectionGradient = usesSectionSurface
      ? genericMeasuredGradientProps(context, sectionName, [desktop, tablet, mobile])
      : {};
    const frameGradient = usesSectionSurface
      ? {}
      : genericMeasuredGradientProps(context, containerName, [desktop, tablet, mobile]);
    const appliedGradient = Object.keys(sectionGradient).length > 0 ? sectionGradient : frameGradient;
    const sectionBackground = usesSectionSurface
      ? (Object.keys(sectionGradient).length > 0 ? '' : (bandBackground || plan.pageBackground))
      : plan.pageBackground;
    const frameBackground = usesSectionSurface || Object.keys(frameGradient).length > 0 ? '' : bandBackground;
    const pageTextColor = plan.pageTextColor || context.styleProfile.ink;
    const textColor = genericTextColor(appliedGradient.gradientColor1 || bandBackground || plan.pageBackground, pageTextColor);
    const sectionMeasurements = [desktop, plan.hasTablet ? tablet : null, plan.hasMobile ? mobile : null].filter(Boolean);
    const topDividerProps = genericMeasuredEdgeDividerProps(sectionMeasurements, 'top');
    const bottomDividerProps = genericMeasuredEdgeDividerProps(sectionMeasurements, 'bottom');
    const edgeDividerComponent = topDividerProps || bottomDividerProps
      ? findComponent(context.contractIndex, ['Divider'])
      : null;
    if ((topDividerProps || bottomDividerProps) && !edgeDividerComponent) {
      throw new Error('Generic measured reference contract gaps:\n- [generic_border_control_gap] Divider is required to reproduce a measured one-edge section border without className or raw CSS.');
    }
    const sectionHorizontalGutter = Math.min(...sectionMeasurements.map((measurement) => {
      const rect = normalizeReferenceRect(measurement?.rect);
      const viewportWidth = Number(measurement?.viewportWidth || 0);
      return rect && viewportWidth > 0
        ? Math.max(0, Math.min(rect.left, viewportWidth - rect.right))
        : 0;
    }));
    const roundedSectionGutter = Math.round(Math.min(96, sectionHorizontalGutter) * 100) / 100;
    const desktopRect = normalizeReferenceRect(desktop?.rect);
    const desktopViewportWidth = Number(desktop?.viewportWidth || 0);
    const usesNarrowRootFrame = desktop?.rootSemanticBand === true
      && desktopRect
      && desktopViewportWidth > 0
      && desktopRect.width < desktopViewportWidth * 0.72;
    const measuredSectionWidth = pxNumber(
      usesMeasuredBandFrame ? genericMeasuredRectSize(desktop, 'width') : genericBandContentWidth(desktop)
    );
    const sectionInnerMaxWidth = usesNarrowRootFrame
      ? `${Math.round(desktopViewportWidth * 100) / 100}px`
      : measuredSectionWidth === null
        ? genericBandContentWidth(desktop)
        : `${Math.round((measuredSectionWidth + roundedSectionGutter * 2) * 100) / 100}px`;
    const sectionInnerMaxWidthPixels = pxNumber(sectionInnerMaxWidth);
    const responsiveSectionGutters = [desktop, tablet, mobile].map((measurement) => {
      const measurementRect = normalizeReferenceRect(measurement?.rect);
      const viewportWidth = Number(measurement?.viewportWidth || 0);
      if (usesNarrowRootFrame && measurementRect && viewportWidth > 0) {
        const centeredGutter = Math.max(0, (viewportWidth - measurementRect.width) / 2);
        return Math.round(Math.max(0, Math.min(measurementRect.left, centeredGutter)) * 100) / 100;
      }
      const measuredGroups = Array.isArray(measurement?.groups) ? measurement.groups : [];
      const hasOverlayGroup = measuredGroups.some((group) => group?.flowParticipation === 'overlay');
      const directContentBounds = referenceContentBounds(
        !navigationProps && (hasOverlayGroup || band.primaryHeading === true)
          ? measuredGroups.filter((group) => group?.flowParticipation !== 'overlay')
          : [],
        measurement?.rect
      );
      const measuredContentWidth = Number(directContentBounds?.width || 0) > 0
        ? Number(directContentBounds.width)
        : pxNumber(usesMeasuredBandFrame ? genericMeasuredRectSize(measurement, 'width') : genericBandContentWidth(measurement));
      if (viewportWidth <= 0 || measuredContentWidth === null) {
        return roundedSectionGutter;
      }
      const availableWidth = sectionInnerMaxWidthPixels === null
        ? viewportWidth
        : Math.min(viewportWidth, sectionInnerMaxWidthPixels);
      return Math.round(Math.min(96, Math.max(0, (availableWidth - measuredContentWidth) / 2)) * 100) / 100;
    });
    const desktopOverlap = Math.max(0, Number(desktop?.precedingOverlap || 0));
    const tabletOverlap = Math.max(0, Number(tablet?.precedingOverlap || 0));
    const mobileOverlap = Math.max(0, Number(mobile?.precedingOverlap || 0));
    const hasSectionOverlap = desktopOverlap > 0 || tabletOverlap > 0 || mobileOverlap > 0;
    const section = createCanvasNode(context, sectionName, 'ROOT', {
      tag: genericSectionTag(band.tag),
      responsiveDisplay: genericMeasuredResponsiveDisplay(band.tablet, band.mobile, plan),
      innerMaxWidth: sectionInnerMaxWidth,
      innerPaddingX: `${responsiveSectionGutters[0]}px`,
      innerPaddingXTablet: plan.hasTablet ? `${responsiveSectionGutters[1]}px` : undefined,
      innerPaddingXMobile: plan.hasMobile ? `${responsiveSectionGutters[2]}px` : undefined,
      minHeight: genericBandHeight(desktop),
      minHeightTablet: plan.hasTablet ? genericBandHeight(tablet) : undefined,
      minHeightMobile: plan.hasMobile ? genericBandHeight(mobile) : undefined,
      paddingTop: genericBandLeadingOffset(desktop),
      paddingTopTablet: plan.hasTablet ? genericBandLeadingOffset(tablet) : undefined,
      paddingTopMobile: plan.hasMobile ? genericBandLeadingOffset(mobile) : undefined,
      marginTop: desktopOverlap > 0 ? `${-Math.round(desktopOverlap * 100) / 100}px` : undefined,
      marginTopTablet: plan.hasTablet && hasSectionOverlap
        ? tabletOverlap > 0 ? `${-Math.round(tabletOverlap * 100) / 100}px` : '0px'
        : undefined,
      marginTopMobile: plan.hasMobile && hasSectionOverlap
        ? mobileOverlap > 0 ? `${-Math.round(mobileOverlap * 100) / 100}px` : '0px'
        : undefined,
      paintLayer: hasSectionOverlap ? 'foreground' : undefined,
      overflow: [desktop, tablet, mobile].some((measurement) => measurement?.clipsHorizontalOverflow === true)
        ? 'hidden'
        : undefined,
      ...backgroundProps(context, sectionName, sectionBackground),
      ...sectionGradient,
      ...(heroBackgroundBundle ? {
        backgroundImage: plan.reuseSourceMedia && String(heroBackgroundBundle.desktop?.source || '').trim()
          ? String(heroBackgroundBundle.desktop.source).trim()
          : genericReplacementMediaSource(context, band.index, 0, true),
        backgroundSize: genericMeasuredMediaFit(heroBackgroundBundle),
        ...genericMeasuredMediaPositionProps(heroBackgroundBundle, plan),
        backgroundOverlay: heroBackgroundOverlay,
      } : {}),
    });
    if (topDividerProps && edgeDividerComponent) {
      createLeafNode(context, edgeDividerComponent.name, section.id, topDividerProps);
    }
    if (navigationProps) {
      const navbarComponent = findComponent(context.contractIndex, ['Navbar']);
      if (!navbarComponent) {
        throw new Error('Generic measured reference contract gaps:\n- [generic_semantic_navbar_widget_missing] Navbar is required to reproduce measured navigation without raw HTML.');
      }
      const navigationHost = createCanvasNode(context, containerName, section.id, navigationProps.hostProps);
      createLeafNode(context, navbarComponent.name, navigationHost.id, navigationProps.navbarProps);
      const navigationKey = String(plan.navigation?.desktop?.key || '');
      if (navigationKey && navigationKey === String(desktop?.key || '')) {
        if (bottomDividerProps && edgeDividerComponent) {
          createLeafNode(context, edgeDividerComponent.name, section.id, bottomDividerProps);
        }
        continue;
      }
    }
    const wrap = createCanvasNode(context, containerName, section.id, {
      layoutDisplay: desktopDisplay,
      flexDirection: genericMeasuredFlexDirection(desktop),
      flexDirectionTablet: plan.hasTablet ? genericMeasuredFlexDirection(tablet) : undefined,
      flexDirectionMobile: plan.hasMobile ? genericMeasuredFlexDirection(mobile) : undefined,
      flexWrap: genericMeasuredFlexWrap(desktop),
      flexWrapTablet: plan.hasTablet ? genericMeasuredFlexWrap(tablet) : undefined,
      flexWrapMobile: plan.hasMobile ? genericMeasuredFlexWrap(mobile) : undefined,
      justifyContent: genericMeasuredJustifyContent(desktop),
      justifyContentTablet: plan.hasTablet ? genericMeasuredJustifyContent(tablet) : undefined,
      justifyContentMobile: plan.hasMobile ? genericMeasuredJustifyContent(mobile) : undefined,
      alignItems: genericMeasuredAlignItems(desktop),
      alignItemsTablet: plan.hasTablet ? genericMeasuredAlignItems(tablet) : undefined,
      alignItemsMobile: plan.hasMobile ? genericMeasuredAlignItems(mobile) : undefined,
      gap: genericMeasuredLayoutGap(desktop),
      gapTablet: plan.hasTablet ? genericMeasuredLayoutGap(tablet) : undefined,
      gapMobile: plan.hasMobile ? genericMeasuredLayoutGap(mobile) : undefined,
      ...(usesGrid ? genericMeasuredGridProps(
        context,
        containerName,
        desktop,
        tablet,
        mobile,
        plan,
        hasMeasuredItems
      ) : {}),
      width: '100%',
      maxWidth: usesNarrowRootFrame ? genericMeasuredRectSize(desktop, 'width') : undefined,
      maxWidthTablet: usesNarrowRootFrame && plan.hasTablet ? genericMeasuredRectSize(tablet, 'width') : undefined,
      maxWidthMobile: usesNarrowRootFrame && plan.hasMobile ? genericMeasuredRectSize(mobile, 'width') : undefined,
      minHeight: topDividerProps || bottomDividerProps ? undefined : genericBandFrameHeight(desktop, navigationProps?.height),
      minHeightTablet: plan.hasTablet && !topDividerProps && !bottomDividerProps ? genericBandFrameHeight(tablet, navigationProps?.heightTablet) : undefined,
      minHeightMobile: plan.hasMobile && !topDividerProps && !bottomDividerProps ? genericBandFrameHeight(mobile, navigationProps?.heightMobile) : undefined,
      paddingTop: genericCssMetric(desktop?.paddingTop) ?? genericBandVerticalInset(desktop, 'top'),
      paddingTopTablet: plan.hasTablet ? (genericCssMetric(tablet?.paddingTop) ?? genericBandVerticalInset(tablet, 'top')) : undefined,
      paddingTopMobile: plan.hasMobile ? (genericCssMetric(mobile?.paddingTop) ?? genericBandVerticalInset(mobile, 'top')) : undefined,
      paddingRight: genericBandFrameHorizontalPadding(desktop, 'right'),
      paddingRightTablet: plan.hasTablet ? genericBandFrameHorizontalPadding(tablet, 'right') : undefined,
      paddingRightMobile: plan.hasMobile ? genericBandFrameHorizontalPadding(mobile, 'right') : undefined,
      paddingBottom: genericCssMetric(desktop?.paddingBottom) ?? genericBandVerticalInset(desktop, 'bottom'),
      paddingBottomTablet: plan.hasTablet ? (genericCssMetric(tablet?.paddingBottom) ?? genericBandVerticalInset(tablet, 'bottom')) : undefined,
      paddingBottomMobile: plan.hasMobile ? (genericCssMetric(mobile?.paddingBottom) ?? genericBandVerticalInset(mobile, 'bottom')) : undefined,
      paddingLeft: genericBandFrameHorizontalPadding(desktop, 'left'),
      paddingLeftTablet: plan.hasTablet ? genericBandFrameHorizontalPadding(tablet, 'left') : undefined,
      paddingLeftMobile: plan.hasMobile ? genericBandFrameHorizontalPadding(mobile, 'left') : undefined,
      borderRadius: genericCssMetric(desktop?.borderRadius),
      ...genericMeasuredUniformBorderProps([desktop, tablet, mobile]),
      ...genericMeasuredShadowProps(context, containerName, [desktop, tablet, mobile]),
      ...backgroundProps(context, containerName, frameBackground),
      ...frameGradient,
    });

    const measuredNodes = hasMeasuredItems
      ? addGenericMeasuredBandItems(context, wrap.id, band, plan, textColor, containerName)
      : 0;
    if (measuredNodes === 0) {
      addGenericBandCopy(context, wrap.id, band, textColor);
    }
    const mediaCount = addGenericMeasuredMediaSurfaces(
      context,
      wrap.id,
      band,
      plan,
      containerName,
      heroBackgroundBundle
    );

    const supportingColumns = measuredNodes > 0 ? 0 : Math.max(0, desktopColumns - 1 - mediaCount);
    for (let columnIndex = 0; columnIndex < supportingColumns; columnIndex += 1) {
      const copy = GENERIC_BAND_CONTENT[(band.index + columnIndex + 5) % GENERIC_BAND_CONTENT.length];
      const card = createCanvasNode(context, containerName, wrap.id, {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minHeight: genericMediaHeight(desktop, Math.max(1, supportingColumns)),
        minHeightTablet: plan.hasTablet ? genericMediaHeight(tablet, Math.max(1, supportingColumns)) : undefined,
        minHeightMobile: plan.hasMobile ? genericMediaHeight(mobile, Math.max(1, supportingColumns)) : undefined,
      });
      addHeading(context, card.id, copy[0], 'h3', { fontSize: '24px', lineHeight: '1.2', fontWeight: '700', textColor });
      addText(context, card.id, copy[1], { fontSize: '16px', lineHeight: '1.6', textColor });
    }
    if (bottomDividerProps && edgeDividerComponent) {
      createLeafNode(context, edgeDividerComponent.name, section.id, bottomDividerProps);
    }
  }
}

function addGenericMeasuredMediaSurfaces(context, fallbackParentId, band, plan, containerName, backgroundBundle) {
  const bundles = genericMeasuredMediaBundles(band, plan, backgroundBundle);
  let renderedMedia = 0;
  for (let index = 0; index < bundles.length; index += 1) {
    const bundle = bundles[index];
    const desktop = bundle.desktop;
    if (desktop?.structureKey && context.genericMeasuredLoweredMediaKeys.has(desktop.structureKey)) {
      continue;
    }
    const tablet = bundle.tablet || desktop;
    const mobile = bundle.mobile || tablet || desktop;
    const desktopParent = genericMeasuredVisibleMediaParent(band.desktop, desktop);
    const tabletParent = genericMeasuredVisibleMediaParent(band.tablet || band.desktop, tablet);
    const mobileParent = genericMeasuredVisibleMediaParent(band.mobile || band.tablet || band.desktop, mobile);
    const tabletPlacementParentKey = tabletParent?.key !== desktopParent?.key
      ? tabletParent?.parentKey || desktopParent?.key
      : desktopParent?.key;
    const mobilePlacementParentKey = mobileParent?.key !== desktopParent?.key
      ? mobileParent?.parentKey || desktopParent?.key
      : desktopParent?.key;
    const tabletMeasurement = band.tablet || band.desktop;
    const mobileMeasurement = band.mobile || band.tablet || band.desktop;
    const tabletPlacementParent = bundle.tablet && tabletPlacementParentKey
      ? (tabletMeasurement?.key === tabletPlacementParentKey
        ? tabletMeasurement
        : genericMeasuredGroupByKey(tabletMeasurement, tabletPlacementParentKey)) || tabletParent
      : tabletParent;
    const mobilePlacementParent = bundle.mobile && mobilePlacementParentKey
      ? (mobileMeasurement?.key === mobilePlacementParentKey
        ? mobileMeasurement
        : genericMeasuredGroupByKey(mobileMeasurement, mobilePlacementParentKey)) || mobileParent
      : mobileParent;
    const tabletReflowsWithinParent = bundle.tablet?.flowParticipation === 'normal'
      && desktop?.flowParticipation === 'overlay'
      && tabletParent?.key !== desktopParent?.key;
    const mobileReflowsWithinParent = bundle.mobile?.flowParticipation === 'normal'
      && desktop?.flowParticipation === 'overlay'
      && mobileParent?.key !== desktopParent?.key;
    const desktopPlacement = genericMeasuredMediaPlacement(desktop, band.desktop, desktopParent);
    const tabletPlacement = genericMeasuredMediaPlacement(tablet, tabletMeasurement, tabletPlacementParent);
    const mobilePlacement = genericMeasuredMediaPlacement(mobile, mobileMeasurement, mobilePlacementParent);
    const hostGroup = genericMeasuredMediaHostGroup(band.desktop, desktop);
    const hostNodeId = hostGroup?.key ? context.genericMeasuredGroupNodes.get(hostGroup.key) : '';
    const mediaSource = plan.reuseSourceMedia && String(desktop?.source || '').trim()
      ? String(desktop.source).trim()
      : genericReplacementMediaSource(context, band.index, index, false);
    const mediaBackgroundProps = {
      backgroundImage: mediaSource,
      backgroundSize: genericMeasuredMediaFit(bundle),
      borderRadius: genericCssMetric(desktop?.borderRadius),
      ...genericMeasuredMediaPositionProps(bundle, plan),
    };

    if (hostNodeId && context.nodeMap[hostNodeId]) {
      Object.assign(
        context.nodeMap[hostNodeId].props,
        filterAllowedProps(context, containerName, mediaBackgroundProps)
      );
      renderedMedia += 1;
      continue;
    }

    const parentId = desktopParent?.key
      ? context.genericMeasuredGroupNodes.get(desktopParent.key) || fallbackParentId
      : fallbackParentId;
    Object.assign(context.nodeMap[parentId].props, filterAllowedProps(context, containerName, {
      gapTablet: plan.hasTablet && tabletReflowsWithinParent
        ? genericMeasuredItemGap(tabletPlacementParent)
        : undefined,
      gapMobile: plan.hasMobile && mobileReflowsWithinParent
        ? genericMeasuredItemGap(mobilePlacementParent)
        : undefined,
    }));
    const fallbackDesktopWidth = genericBandContentWidth(band.desktop);
    const fallbackTabletWidth = genericBandContentWidth(band.tablet || band.desktop);
    const fallbackMobileWidth = genericBandContentWidth(band.mobile || band.tablet || band.desktop);
    const desktopWidth = genericMeasuredMediaSizeWithinParent(desktop, desktopParent || band.desktop, 'width');
    const tabletWidth = genericMeasuredMediaSizeWithinParent(tablet, tabletParent || band.tablet || band.desktop, 'width');
    const mobileWidth = genericMeasuredMediaSizeWithinParent(mobile, mobileParent || band.mobile || band.tablet || band.desktop, 'width');
    const desktopHeight = genericMeasuredMediaSizeWithinParent(desktop, desktopParent || band.desktop, 'height');
    const tabletHeight = genericMeasuredMediaSizeWithinParent(tablet, tabletParent || band.tablet || band.desktop, 'height');
    const mobileHeight = genericMeasuredMediaSizeWithinParent(mobile, mobileParent || band.mobile || band.tablet || band.desktop, 'height');

    const mediaNode = createCanvasNode(context, containerName, parentId, {
      ...mediaBackgroundProps,
      responsiveDisplay: desktop ? genericMeasuredResponsiveDisplay(bundle.tablet, bundle.mobile, plan) : undefined,
      width: '100%',
      maxWidth: desktopWidth || fallbackDesktopWidth,
      maxWidthTablet: plan.hasTablet
        ? tabletWidth || fallbackTabletWidth
        : undefined,
      maxWidthMobile: plan.hasMobile
        ? mobileWidth || fallbackMobileWidth
        : undefined,
      minHeight: desktopHeight || genericMediaHeight(band.desktop, bundles.length),
      minHeightTablet: plan.hasTablet
        ? tabletHeight || genericMediaHeight(band.tablet || band.desktop, bundles.length)
        : undefined,
      minHeightMobile: plan.hasMobile
        ? mobileHeight || genericMediaHeight(band.mobile || band.tablet || band.desktop, bundles.length)
        : undefined,
      flexShrink: 0,
      gridColumnStart: desktopPlacement.columnStart,
      gridColumnSpan: desktopPlacement.columnSpan,
      gridRowStart: desktopPlacement.rowStart,
      gridRowSpan: desktopPlacement.rowSpan,
      gridColumnStartTablet: plan.hasTablet ? tabletPlacement.columnStart : undefined,
      gridColumnSpanTablet: plan.hasTablet ? tabletPlacement.columnSpan : undefined,
      gridRowStartTablet: plan.hasTablet ? tabletPlacement.rowStart : undefined,
      gridRowSpanTablet: plan.hasTablet ? tabletPlacement.rowSpan : undefined,
      gridColumnStartMobile: plan.hasMobile ? mobilePlacement.columnStart : undefined,
      gridColumnSpanMobile: plan.hasMobile ? mobilePlacement.columnSpan : undefined,
      gridRowStartMobile: plan.hasMobile ? mobilePlacement.rowStart : undefined,
      gridRowSpanMobile: plan.hasMobile ? mobilePlacement.rowSpan : undefined,
    });
    if (desktop?.structureKey) {
      const stackingIndex = safeReferenceStackingIndex(desktop.stackingIndex);
      context.genericMeasuredNodeKeys.set(mediaNode.id, desktop.structureKey);
      orderGenericMeasuredChildren(
        context,
        parentId,
        context.nodeMap[parentId].nodes.map((nodeId) => ({
          id: nodeId,
          key: context.genericMeasuredNodeKeys.get(nodeId),
          ...(nodeId === mediaNode.id ? {
            stackLayer: stackingIndex !== undefined,
            stackingIndex,
            stackingIndexTablet: safeReferenceStackingIndex(bundle.tablet?.stackingIndex),
            stackingIndexMobile: safeReferenceStackingIndex(bundle.mobile?.stackingIndex),
            rect: desktop.rect,
            rectTablet: bundle.tablet?.rect,
            rectMobile: bundle.mobile?.rect,
          } : {}),
        }))
      );
    }
    renderedMedia += 1;
  }
  return renderedMedia;
}

function genericMeasuredMediaHostGroup(measurement, media) {
  let group = genericMeasuredGroupByKey(measurement, media?.parentGroupKey);
  while (group) {
    if (group.flowParticipation !== 'overlay' && genericMeasuredMediaMatchesGroup(media, group)) {
      return group;
    }
    group = genericMeasuredGroupByKey(measurement, group.parentKey);
  }
  return null;
}

function genericMeasuredVisibleMediaParent(measurement, media) {
  let group = genericMeasuredGroupByKey(measurement, media?.parentGroupKey);
  while (group) {
    if (group.flowParticipation !== 'overlay') {
      return group;
    }
    group = genericMeasuredGroupByKey(measurement, group.parentKey);
  }
  return null;
}

function genericMeasuredMediaMatchesGroup(media, group) {
  const mediaRect = normalizeReferenceRect(media?.rect);
  const groupRect = normalizeReferenceRect(group?.rect);
  if (!mediaRect || !groupRect) {
    return false;
  }
  const overlapWidth = Math.max(0, Math.min(mediaRect.right, groupRect.right) - Math.max(mediaRect.left, groupRect.left));
  const overlapHeight = Math.max(0, Math.min(mediaRect.bottom, groupRect.bottom) - Math.max(mediaRect.top, groupRect.top));
  const overlapArea = overlapWidth * overlapHeight;
  return overlapArea >= mediaRect.width * mediaRect.height * 0.9
    && overlapArea >= groupRect.width * groupRect.height * 0.82;
}

function genericMeasuredMediaSizeWithinParent(media, parentMeasurement, axis) {
  const mediaRect = normalizeReferenceRect(media?.rect);
  const parentRect = normalizeReferenceRect(parentMeasurement?.rect);
  if (!mediaRect || !parentRect || !['width', 'height'].includes(axis)) {
    return undefined;
  }
  const bounded = Math.min(mediaRect[axis], parentRect[axis], MAX_GENERIC_REFERENCE_MEDIA_DIMENSION);
  return bounded > 0 ? `${Math.round(bounded * 100) / 100}px` : undefined;
}

function genericMeasuredMediaPlacement(media, measurement, visibleParent = genericMeasuredVisibleMediaParent(measurement, media)) {
  const parentGroup = visibleParent;
  const parentMeasurement = parentGroup || measurement;
  const parentGroupKey = String(parentGroup?.key || media?.parentGroupKey || '');
  const mediaSiblings = genericMeasurementMedia(measurement).filter((candidate) => (
    String(genericMeasuredVisibleMediaParent(measurement, candidate)?.key || candidate?.parentGroupKey || '') === parentGroupKey
  ));
  const siblings = genericMeasurementItems(parentMeasurement).concat(mediaSiblings);
  return genericGridItemPlacement(
    media,
    siblings,
    parentMeasurement?.rect,
    genericMeasuredGridToken(parentMeasurement, true)
  );
}

function genericMeasuredGroupByKey(measurement, key) {
  if (!measurement || !key) {
    return null;
  }
  const groups = Array.isArray(measurement.groups) ? measurement.groups : [];
  for (const group of groups) {
    if (group?.key === key) {
      return group;
    }
    const nested = genericMeasuredGroupByKey(group, key);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function genericReplacementMediaSource(context, bandIndex, mediaIndex, heroBackground) {
  const profile = context.replacementProfile || DEFAULT_REPLACEMENT_PROFILE;
  const profileSources = heroBackground
    ? [profile.hero]
    : [profile.secondary, ...(Array.isArray(profile.serviceCard) ? profile.serviceCard : []), profile.hero];
  const sources = unique(profileSources.concat(GENERIC_REPLACEMENT_MEDIA).filter(Boolean));
  const sourceIndex = heroBackground ? 0 : Math.abs(bandIndex + mediaIndex) % sources.length;
  return mediaVariant(
    sources[sourceIndex] || GENERIC_REPLACEMENT_MEDIA[0],
    heroBackground
      ? `generic-band-${bandIndex + 1}-background`
      : `generic-band-${bandIndex + 1}-media-${mediaIndex + 1}`
  );
}

function genericMeasurementItems(measurement) {
  const groups = Array.isArray(measurement?.groups)
    ? measurement.groups.filter((group) => group?.flowParticipation !== 'overlay')
    : [];
  const texts = Array.isArray(measurement?.texts) ? measurement.texts : [];
  if (groups.length > 0) {
    return groups.concat(texts);
  }
  const children = Array.isArray(measurement?.children) ? measurement.children : [];
  if (children.length > 0) {
    return children;
  }
  return texts;
}

function genericMeasuredGridToken(measurement, measuredItems) {
  if (!measuredItems) {
    return GENERIC_GRID_TOKENS[Math.max(1, Math.min(4, Number(measurement?.columns || 1)))] || 'one';
  }
  const items = genericMeasurementItems(measurement);
  const directGroups = Array.isArray(measurement?.groups)
    ? measurement.groups.filter((group) => group?.flowParticipation !== 'overlay')
    : [];
  const trackItems = directGroups.length >= 2 ? directGroups : items;
  const measuredTwoColumn = measureTwoColumnGrid(measurement, trackItems);
  if (measuredTwoColumn) {
    return measuredTwoColumn.token;
  }
  const measuredEqualColumns = measureEqualColumnGrid(measurement, trackItems);
  if (measuredEqualColumns) {
    return measuredEqualColumns.token;
  }
  if (genericMeasuredDisplay(measurement) === 'grid') {
    const itemRects = items
      .map((item) => normalizeReferenceRect(item?.rect))
      .filter(Boolean);
    const hasMeasuredGridRow = itemRects.some((anchor, anchorIndex) => itemRects.some((candidate, candidateIndex) => (
      anchorIndex !== candidateIndex
      && referenceRectsShareRow(anchor, candidate)
      && (candidate.left >= anchor.right - 4 || anchor.left >= candidate.right - 4)
    )));
    if (hasMeasuredGridRow) {
      return 'six';
    }
  }
  const inferredColumns = estimateReferenceBandColumns(
    items,
    normalizeReferenceRect(measurement?.rect) || { width: 0 }
  );
  return Math.max(Number(measurement?.columns || 1), inferredColumns) > 1 ? 'six' : 'one';
}

function genericMeasuredGridProps(context, componentName, desktop, tablet, mobile, plan, measuredItems) {
  const tabletMeasurement = tablet || desktop;
  const mobileMeasurement = mobile || tablet || desktop;
  const viewports = [
    {
      measurement: desktop,
      tokenProp: 'gridTemplateColumns',
      percentProp: 'gridFirstColumnPercent',
      enabled: Boolean(desktop),
    },
    {
      measurement: tabletMeasurement,
      tokenProp: 'gridTemplateColumnsTablet',
      percentProp: 'gridFirstColumnPercentTablet',
      enabled: plan.hasTablet,
    },
    {
      measurement: mobileMeasurement,
      tokenProp: 'gridTemplateColumnsMobile',
      percentProp: 'gridFirstColumnPercentMobile',
      enabled: plan.hasMobile,
    },
  ];
  const props = {};
  let inheritedPercent = 50;

  for (const viewport of viewports) {
    if (!viewport.enabled || !viewport.measurement) {
      continue;
    }
    const token = genericMeasuredGridToken(viewport.measurement, measuredItems);
    props[viewport.tokenProp] = token;
    if (token !== PROPORTIONAL_GRID_TOKEN) {
      continue;
    }
    const measuredTwoColumn = measureTwoColumnGrid(
      viewport.measurement,
      genericMeasurementItems(viewport.measurement)
    );
    const percent = measuredTwoColumn?.firstColumnPercent;
    if (!Number.isFinite(percent)) {
      continue;
    }
    if (viewport.percentProp === 'gridFirstColumnPercent' || percent !== inheritedPercent) {
      props[viewport.percentProp] = percent;
      inheritedPercent = percent;
    }
  }

  assertGenericMeasuredProportionalGridContract(context, componentName, props);
  return props;
}

function assertGenericMeasuredProportionalGridContract(context, componentName, props) {
  const proportionalTokenProps = Object.entries(props)
    .filter(([prop, value]) => prop.startsWith('gridTemplateColumns') && value === PROPORTIONAL_GRID_TOKEN)
    .map(([prop]) => prop);
  if (proportionalTokenProps.length === 0) {
    return;
  }

  const component = context.contractIndex.get(componentName);
  const authoringProps = new Set(component?.authoringProps || []);
  const controlProps = new Set(component?.controlProps || []);
  const missing = [];
  for (const prop of proportionalTokenProps) {
    const options = component?.propOptions?.get(prop);
    if (!authoringProps.has(prop) || !(options instanceof Set) || !options.has(PROPORTIONAL_GRID_TOKEN)) {
      missing.push(`${prop} option ${PROPORTIONAL_GRID_TOKEN}`);
    }
  }
  for (const prop of Object.keys(props).filter((prop) => prop.startsWith('gridFirstColumnPercent'))) {
    if (!authoringProps.has(prop) || !controlProps.has(prop)) {
      missing.push(prop);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Generic measured reference contract gaps:\n- [generic_proportional_grid_control_gap] ${componentName} is missing measured proportional-grid controls: ${unique(missing).join(', ')}.`);
  }
}

function genericMeasuredEdgeDividerProps(measurements, edge) {
  const widthProps = {
    top: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
    bottom: ['borderBottomWidth', 'borderTopWidth', 'borderRightWidth', 'borderLeftWidth'],
  }[edge];
  const colorProp = edge === 'bottom' ? 'borderBottomColor' : 'borderTopColor';
  if (!widthProps) {
    return null;
  }
  const borders = measurements
    .filter(Boolean)
    .map((measurement) => ({
      edge: genericCssMetric(measurement?.[widthProps[0]]),
      other: widthProps.slice(1).map((prop) => genericCssMetric(measurement?.[prop])),
      color: normalizedAuthorableColor(measurement?.[colorProp]),
    }));
  const oneEdgeBorders = borders.filter((border) => (
    border.edge
    && Number.parseFloat(border.edge) > 0
    && border.other.every((width) => Number.parseFloat(width || '0') === 0)
    && border.color
  ));
  if (oneEdgeBorders.length === 0) {
    return null;
  }
  if (oneEdgeBorders.length !== borders.length
    || oneEdgeBorders.some((border) => border.edge !== oneEdgeBorders[0].edge || border.color !== oneEdgeBorders[0].color)) {
    throw new Error(`Generic measured reference contract gaps:\n- [generic_responsive_divider_control_gap] A measured ${edge}-edge Divider changes or disappears across viewports, but responsive Divider thickness, color, and visibility controls are absent.`);
  }

  return {
    dividerWidth: '100%',
    dividerThickness: oneEdgeBorders[0].edge,
    dividerStyle: 'solid',
    dividerColor: oneEdgeBorders[0].color,
    dividerAlign: 'left',
    dividerMargin: '0px',
  };
}

function genericMeasuredUniformBorderProps(measurements) {
  const borders = measurements
    .filter(Boolean)
    .map((measurement) => {
      const explicitWidth = genericCssMetric(measurement?.borderWidth);
      const explicitColor = normalizedAuthorableColor(measurement?.borderColor);
      if (explicitWidth && explicitColor) {
        return { width: explicitWidth, color: explicitColor };
      }
      const widths = [
        measurement?.borderTopWidth,
        measurement?.borderRightWidth,
        measurement?.borderBottomWidth,
        measurement?.borderLeftWidth,
      ].map(genericCssMetric);
      const colors = [
        measurement?.borderTopColor,
        measurement?.borderRightColor,
        measurement?.borderBottomColor,
        measurement?.borderLeftColor,
      ].map(normalizedAuthorableColor);
      if (widths.some((width) => !width)
        || colors.some((color) => !color)
        || widths.some((width) => width !== widths[0])
        || colors.some((color) => color !== colors[0])) {
        return null;
      }
      return { width: widths[0], color: colors[0] };
    });
  if (borders.length === 0 || borders.some((border) => !border)) {
    return {};
  }
  if (Number.parseFloat(borders[0].width) === 0) {
    return {};
  }
  if (borders.some((border) => border.width !== borders[0].width || border.color !== borders[0].color)) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_border_control_gap] A uniform border changes by viewport, but responsive border controls are absent.');
  }
  return {
    borderWidth: borders[0].width,
    borderColor: borders[0].color,
  };
}

function genericMeasuredVisualTiltProps(context, componentName, desktop, tablet, mobile, plan) {
  const normalizedTilt = (measurement) => {
    const token = String(measurement?.visualTilt || '').trim().toLowerCase();
    return GENERIC_VISUAL_TILT_TOKENS.has(token) ? token : '';
  };
  const desktopTilt = normalizedTilt(desktop);
  const tabletTilt = plan.hasTablet ? normalizedTilt(tablet) : desktopTilt;
  const mobileTilt = plan.hasMobile ? normalizedTilt(mobile) : tabletTilt;
  if (!desktopTilt && !tabletTilt && !mobileTilt) {
    return {};
  }
  if (!desktopTilt) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_visual_tilt_control_gap] A measured visual tilt begins below desktop, but the live contract only supports a desktop tilt with a responsive reset.');
  }

  let resetAt;
  if (tabletTilt === desktopTilt && mobileTilt === desktopTilt) {
    resetAt = undefined;
  } else if (plan.hasTablet && !tabletTilt && (!plan.hasMobile || !mobileTilt)) {
    resetAt = 'tablet';
  } else if (plan.hasMobile && tabletTilt === desktopTilt && !mobileTilt) {
    resetAt = 'mobile';
  } else {
    throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_visual_tilt_control_gap] The measured visual tilt changes between viewports in a way that visualTiltResetAt cannot represent.');
  }

  const props = {
    visualTilt: desktopTilt,
    visualTiltResetAt: resetAt,
  };
  const filtered = filterAllowedProps(context, componentName, props);
  const requiredProps = Object.entries(props)
    .filter(([, value]) => typeof value !== 'undefined')
    .map(([prop]) => prop);
  if (requiredProps.some((prop) => !Object.prototype.hasOwnProperty.call(filtered, prop))) {
    throw new Error(`Generic measured reference contract gaps:\n- [generic_visual_tilt_control_gap] ${componentName} must expose visualTilt${resetAt ? ' and visualTiltResetAt' : ''} as live authoring controls.`);
  }
  return filtered;
}

function genericMeasuredVisualFramePlan(context, componentName, desktop, tablet, mobile, plan) {
  const frames = [
    desktop?.visualFrame || null,
    ...(plan.hasTablet ? [tablet?.visualFrame || null] : []),
    ...(plan.hasMobile ? [mobile?.visualFrame || null] : []),
  ];
  if (frames.every((frame) => !frame)) {
    return null;
  }
  if (!frames[0] || frames.some((frame) => !frame)) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_visual_frame_control_gap] A measured inset frame appears or disappears between viewports, but the live contract has no responsive frame visibility control.');
  }
  const frameStyleKeys = [
    'backgroundColor', 'backgroundType', 'gradientType', 'gradientAngle', 'gradientColor1', 'gradientColor2',
    'borderRadius', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'boxShadow',
  ];
  const styleSignatures = frames.map((frame) => JSON.stringify(
    frameStyleKeys.map((key) => frame[key] ?? '')
  ));
  if (styleSignatures.some((signature) => signature !== styleSignatures[0])) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_visual_frame_control_gap] The measured inset frame style changes between viewports, but its border, radius, gradient, and shadow controls are not responsive.');
  }

  const activeFrames = frames.filter(Boolean);
  const gradientProps = genericMeasuredGradientProps(context, componentName, activeFrames);
  const surfaceColor = Object.keys(gradientProps).length > 0
    ? ''
    : normalizedAuthorableColor(activeFrames[0].backgroundColor);
  const insetProps = {
    paddingTop: activeFrames[0].inset,
    paddingRight: activeFrames[0].inset,
    paddingBottom: activeFrames[0].inset,
    paddingLeft: activeFrames[0].inset,
    paddingTopTablet: plan.hasTablet ? activeFrames[1].inset : undefined,
    paddingRightTablet: plan.hasTablet ? activeFrames[1].inset : undefined,
    paddingBottomTablet: plan.hasTablet ? activeFrames[1].inset : undefined,
    paddingLeftTablet: plan.hasTablet ? activeFrames[1].inset : undefined,
    paddingTopMobile: plan.hasMobile ? activeFrames[activeFrames.length - 1].inset : undefined,
    paddingRightMobile: plan.hasMobile ? activeFrames[activeFrames.length - 1].inset : undefined,
    paddingBottomMobile: plan.hasMobile ? activeFrames[activeFrames.length - 1].inset : undefined,
    paddingLeftMobile: plan.hasMobile ? activeFrames[activeFrames.length - 1].inset : undefined,
  };
  const childProps = {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: '100%',
    minHeight: `${Math.round(activeFrames[0].height * 100) / 100}px`,
    minHeightTablet: plan.hasTablet ? `${Math.round(activeFrames[1].height * 100) / 100}px` : undefined,
    minHeightMobile: plan.hasMobile ? `${Math.round(activeFrames[activeFrames.length - 1].height * 100) / 100}px` : undefined,
    borderRadius: genericCssMetric(activeFrames[0].borderRadius),
    ...genericMeasuredUniformBorderProps(activeFrames),
    ...genericMeasuredShadowProps(context, componentName, activeFrames),
    ...backgroundProps(context, componentName, surfaceColor),
    ...gradientProps,
  };
  const filteredInsets = filterAllowedProps(context, componentName, insetProps);
  const filteredChildProps = filterAllowedProps(context, componentName, childProps);
  const requiredInsetProps = Object.entries(insetProps)
    .filter(([, value]) => typeof value !== 'undefined')
    .map(([prop]) => prop);
  const requiredChildProps = Object.entries(childProps)
    .filter(([, value]) => typeof value !== 'undefined')
    .map(([prop]) => prop);
  if (requiredInsetProps.some((prop) => !Object.prototype.hasOwnProperty.call(filteredInsets, prop))
    || requiredChildProps.some((prop) => !Object.prototype.hasOwnProperty.call(filteredChildProps, prop))) {
    throw new Error(`Generic measured reference contract gaps:\n- [generic_visual_frame_control_gap] ${componentName} lacks one or more live controls required for the measured inset frame.`);
  }

  return { paddingProps: filteredInsets, childProps: filteredChildProps };
}

function genericMeasuredFixedTrackRow(measurements) {
  const rows = measurements
    .filter(Boolean)
    .map((measurement) => {
      const texts = Array.isArray(measurement?.texts) ? measurement.texts : [];
      const parentRect = normalizeReferenceRect(measurement?.rect);
      const items = texts
        .map((item, index) => ({ item, index, rect: normalizeReferenceRect(item?.rect) }))
        .filter((entry) => entry.rect)
        .sort((left, right) => left.rect.left - right.rect.left);
      if (genericMeasuredDisplay(measurement) !== 'grid'
        || !parentRect
        || items.length !== 2
        || !referenceRectsShareRow(items[0].rect, items[1].rect)
        || items[0].rect.right > items[1].rect.left + 4
        || items[0].rect.width > parentRect.width * 0.4) {
        return null;
      }
      return {
        fixedItemKey: String(items[0].item?.structureKey || ''),
        fixedItemIndex: items[0].index,
        fixedWidth: items[0].rect.width,
        gap: Math.max(0, items[1].rect.left - items[0].rect.right),
      };
    });
  if (rows.length !== measurements.filter(Boolean).length || rows.some((row) => !row)) {
    return null;
  }
  if (rows.some((row) => (
    Math.abs(row.fixedWidth - rows[0].fixedWidth) > 1
    || Math.abs(row.gap - rows[0].gap) > 1
    || (rows[0].fixedItemKey && row.fixedItemKey !== rows[0].fixedItemKey)
  ))) {
    return null;
  }

  return {
    fixedItemKey: rows[0].fixedItemKey,
    fixedItemIndex: rows[0].fixedItemIndex,
    fixedWidth: `${Math.round(rows[0].fixedWidth * 100) / 100}px`,
    gap: `${Math.round(rows[0].gap * 100) / 100}px`,
  };
}

function genericMeasuredPlanHasFixedTrackRow(plan) {
  const parents = plan.bands.map((band) => ({
    desktop: band.desktop,
    tablet: band.tablet,
    mobile: band.mobile,
  }));
  while (parents.length > 0) {
    const { desktop, tablet, mobile } = parents.pop();
    if (!desktop) {
      continue;
    }
    const tabletMeasurement = tablet || desktop;
    const mobileMeasurement = mobile || tablet || desktop;
    if (genericMeasuredFixedTrackRow([
      desktop,
      ...(plan.hasTablet ? [tabletMeasurement] : []),
      ...(plan.hasMobile ? [mobileMeasurement] : []),
    ])) {
      return true;
    }
    for (const desktopGroup of Array.isArray(desktop.groups) ? desktop.groups : []) {
      const tabletGroup = matchedGenericMeasuredGroup(desktopGroup, tabletMeasurement?.groups);
      const mobileGroup = matchedGenericMeasuredGroup(desktopGroup, mobileMeasurement?.groups);
      parents.push({
        desktop: desktopGroup,
        tablet: tabletGroup || desktopGroup,
        mobile: mobileGroup || tabletGroup || desktopGroup,
      });
    }
  }

  return false;
}

function genericMeasuredShadowProps(context, componentName, measurements) {
  const sources = measurements
    .filter(Boolean)
    .map((measurement) => String(measurement?.boxShadow || '').trim())
    .filter((value) => value && !['none', 'initial', 'unset'].includes(value.toLowerCase()));
  if (sources.length === 0) {
    return {};
  }
  const parsed = sources.map(parseMeasuredBoxShadow);
  if (parsed.some((value) => !value)) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_shadow_control_gap] The measured box shadow is not representable as one safe structured shadow. Add typed multi-shadow controls instead of using raw CSS.');
  }
  const canonical = JSON.stringify(parsed[0]);
  if (parsed.some((value) => JSON.stringify(value) !== canonical)) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_shadow_control_gap] The measured box shadow changes by viewport, but responsive structured shadow controls are absent.');
  }
  const filtered = filterAllowedProps(context, componentName, parsed[0]);
  if (Object.keys(filtered).length !== Object.keys(parsed[0]).length) {
    throw new Error('Generic measured reference contract gaps:\n- [generic_shadow_control_gap] Container needs boxShadowOffsetX, boxShadowOffsetY, boxShadowBlur, boxShadowSpread, boxShadowColor, and boxShadowInset authoring props.');
  }
  return filtered;
}

function parseMeasuredBoxShadow(value) {
  const source = String(value || '').trim();
  if (!source || /[;{}]|url\s*\(|var\s*\(|calc\s*\(|hsla?\s*\(/iu.test(source)) {
    return null;
  }
  const layers = splitMeasuredBoxShadowLayers(source);
  if (layers.length === 0) {
    return null;
  }
  const parsedLayers = layers.map(parseMeasuredBoxShadowLayer);
  if (parsedLayers.some((layer) => !layer || (layer.transparent && !layer.zeroGeometry))) {
    return null;
  }
  const visibleLayers = parsedLayers.filter((layer) => !layer.transparent);
  if (visibleLayers.length === 0) {
    return {};
  }
  if (visibleLayers.length === 1) {
    return visibleLayers[0].props;
  }
  if (isDefaultShadowPresetLayers(visibleLayers)) {
    return { boxShadow: 'shadow' };
  }

  return null;
}

function splitMeasuredBoxShadowLayers(source) {
  const layers = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      if (depth === 0) {
        return [];
      }
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      layers.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (depth !== 0) {
    return [];
  }
  layers.push(source.slice(start).trim());
  return layers.some((layer) => !layer) ? [] : layers;
}

function parseMeasuredBoxShadowLayer(source) {
  const colorMatches = [...source.matchAll(/(?:rgba?\([^)]*\)|color\(\s*srgb[^)]*\)|#[0-9a-f]{3,8}|\btransparent\b)/giu)];
  if (colorMatches.length !== 1) {
    return null;
  }
  const colorSource = colorMatches[0][0];
  const transparent = isTransparentShadowColor(colorSource);
  const color = transparent ? '' : normalizedAuthorableColor(colorSource);
  if (!transparent && !color) {
    return null;
  }
  const remainder = `${source.slice(0, colorMatches[0].index)} ${source.slice((colorMatches[0].index || 0) + colorMatches[0][0].length)}`.trim();
  const tokens = remainder.split(/\s+/u).filter(Boolean);
  const insetIndex = tokens.findIndex((token) => token.toLowerCase() === 'inset');
  const inset = insetIndex >= 0;
  if (insetIndex >= 0) {
    tokens.splice(insetIndex, 1);
  }
  if (tokens.length < 2 || tokens.length > 4) {
    return null;
  }
  const lengths = tokens.map((token) => {
    const normalized = token === '0' ? '0px' : token;
    const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em)$/iu.exec(normalized);
    if (!match) {
      return null;
    }
    return { value: normalized, number: Number(match[1]), unit: match[2].toLowerCase() };
  });
  if (lengths.some((length) => !length)
    || lengths[0].number < -9999
    || lengths[1].number < -9999
    || (lengths[2] && (lengths[2].number < 0 || lengths[2].number > 2000))
    || (lengths[3] && (lengths[3].number < -9999 || lengths[3].number > 9999))) {
    return null;
  }

  const completeLengths = [
    lengths[0],
    lengths[1],
    lengths[2] || { value: '0px', number: 0, unit: 'px' },
    lengths[3] || { value: '0px', number: 0, unit: 'px' },
  ];
  return {
    transparent,
    zeroGeometry: !inset && completeLengths.every((length) => length.number === 0),
    lengths: completeLengths,
    color,
    inset,
    props: transparent ? null : {
      boxShadowOffsetX: completeLengths[0].value,
      boxShadowOffsetY: completeLengths[1].value,
      boxShadowBlur: completeLengths[2].value,
      boxShadowSpread: completeLengths[3].value,
      boxShadowColor: color,
      boxShadowInset: inset,
    },
  };
}

function isTransparentShadowColor(value) {
  const color = String(value || '').trim().toLowerCase();
  if (color === 'transparent') {
    return true;
  }
  if (/^#[0-9a-f]{4}$/u.test(color)) {
    return color.endsWith('0');
  }
  if (/^#[0-9a-f]{8}$/u.test(color)) {
    return color.endsWith('00');
  }
  return /^rgba\(\s*[^,]+\s*,\s*[^,]+\s*,\s*[^,]+\s*,\s*0(?:\.0+)?\s*\)$/u.test(color)
    || /^rgba?\([^)]*\/\s*0(?:\.0+)?\s*\)$/u.test(color)
    || /^color\(\s*srgb[^)]*\/\s*0(?:\.0+)?\s*\)$/u.test(color);
}

function isDefaultShadowPresetLayers(layers) {
  const expectedLengths = [
    [0, 1, 3, 0],
    [0, 1, 2, -1],
  ];
  return layers.length === expectedLengths.length && layers.every((layer, index) => (
    layer.inset === false
    && /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.1(?:0+)?\s*\)$/iu.test(layer.color)
    && layer.lengths.every((length, lengthIndex) => (
      length.number === expectedLengths[index][lengthIndex]
      && (length.number === 0 || length.unit === 'px')
    ))
  ));
}

function addGenericMeasuredBandItems(context, parentId, band, plan, fallbackTextColor, containerName) {
  const desktopGroups = Array.isArray(band.desktop?.groups) ? band.desktop.groups : [];
  if (desktopGroups.length > 0) {
    const orderEntries = [];
    const groupNodes = addGenericMeasuredGroups(
      context,
      parentId,
      band.desktop,
      band.tablet,
      band.mobile,
      plan,
      fallbackTextColor,
      containerName,
      band.index,
      orderEntries
    );
    const textNodes = addGenericMeasuredTextItems(
      context,
      parentId,
      band.desktop,
      band.tablet,
      band.mobile,
      plan,
      fallbackTextColor,
      containerName,
      band.index * 100,
      orderEntries
    );
    orderGenericMeasuredChildren(context, parentId, orderEntries);
    return groupNodes + textNodes;
  }

  const desktopChildren = Array.isArray(band.desktop?.children) ? band.desktop.children : [];
  if (desktopChildren.length === 0) {
    return addGenericMeasuredTextItems(
      context,
      parentId,
      band.desktop,
      band.tablet,
      band.mobile,
      plan,
      fallbackTextColor,
      containerName,
      band.index
    );
  }

  let created = 0;
  for (let index = 0; index < desktopChildren.length; index += 1) {
    const desktop = desktopChildren[index];
    const tablet = matchedGenericMeasuredItem(desktop, index, band.tablet?.children);
    const mobile = matchedGenericMeasuredItem(desktop, index, band.mobile?.children);
    const desktopPlacement = genericGridItemPlacement(desktop, desktopChildren, band.desktop?.rect, genericMeasuredGridToken(band.desktop, true));
    const tabletPlacement = genericGridItemPlacement(tablet, band.tablet?.children, band.tablet?.rect, genericMeasuredGridToken(band.tablet, true));
    const mobilePlacement = genericGridItemPlacement(mobile, band.mobile?.children, band.mobile?.rect, genericMeasuredGridToken(band.mobile, true));
    const gradientProps = genericMeasuredGradientProps(context, containerName, [desktop, tablet, mobile]);
    const surfaceColor = Object.keys(gradientProps).length > 0
      ? ''
      : genericMeasuredSurfaceColor(desktop, plan.pageTextColor || context.styleProfile.ink);
    const child = createCanvasNode(context, containerName, parentId, {
      layoutDisplay: 'grid',
      ...genericMeasuredGridProps(context, containerName, desktop, tablet, mobile, plan, true),
      gap: genericMeasuredItemGap(desktop),
      gapTablet: plan.hasTablet ? genericMeasuredItemGap(tablet || desktop) : undefined,
      gapMobile: plan.hasMobile ? genericMeasuredItemGap(mobile || tablet || desktop) : undefined,
      gridColumnStart: desktopPlacement.columnStart,
      gridColumnSpan: desktopPlacement.columnSpan,
      gridRowStart: desktopPlacement.rowStart,
      gridRowSpan: desktopPlacement.rowSpan,
      gridColumnStartTablet: plan.hasTablet ? tabletPlacement.columnStart : undefined,
      gridColumnSpanTablet: plan.hasTablet ? tabletPlacement.columnSpan : undefined,
      gridRowStartTablet: plan.hasTablet ? tabletPlacement.rowStart : undefined,
      gridRowSpanTablet: plan.hasTablet ? tabletPlacement.rowSpan : undefined,
      gridColumnStartMobile: plan.hasMobile ? mobilePlacement.columnStart : undefined,
      gridColumnSpanMobile: plan.hasMobile ? mobilePlacement.columnSpan : undefined,
      gridRowStartMobile: plan.hasMobile ? mobilePlacement.rowStart : undefined,
      gridRowSpanMobile: plan.hasMobile ? mobilePlacement.rowSpan : undefined,
      minHeight: genericMeasuredRectSize(desktop, 'height'),
      minHeightTablet: plan.hasTablet ? genericMeasuredRectSize(tablet || desktop, 'height') : undefined,
      minHeightMobile: plan.hasMobile ? genericMeasuredRectSize(mobile || tablet || desktop, 'height') : undefined,
      maxWidth: genericMeasuredRectSize(desktop, 'width'),
      maxWidthTablet: plan.hasTablet ? genericMeasuredRectSize(tablet || desktop, 'width') : undefined,
      maxWidthMobile: plan.hasMobile ? genericMeasuredRectSize(mobile || tablet || desktop, 'width') : undefined,
      paddingTop: genericCssMetric(desktop?.paddingTop),
      paddingTopTablet: plan.hasTablet ? genericCssMetric((tablet || desktop)?.paddingTop) : undefined,
      paddingTopMobile: plan.hasMobile ? genericCssMetric((mobile || tablet || desktop)?.paddingTop) : undefined,
      paddingRight: genericCssMetric(desktop?.paddingRight),
      paddingRightTablet: plan.hasTablet ? genericCssMetric((tablet || desktop)?.paddingRight) : undefined,
      paddingRightMobile: plan.hasMobile ? genericCssMetric((mobile || tablet || desktop)?.paddingRight) : undefined,
      paddingBottom: genericCssMetric(desktop?.paddingBottom),
      paddingBottomTablet: plan.hasTablet ? genericCssMetric((tablet || desktop)?.paddingBottom) : undefined,
      paddingBottomMobile: plan.hasMobile ? genericCssMetric((mobile || tablet || desktop)?.paddingBottom) : undefined,
      paddingLeft: genericCssMetric(desktop?.paddingLeft),
      paddingLeftTablet: plan.hasTablet ? genericCssMetric((tablet || desktop)?.paddingLeft) : undefined,
      paddingLeftMobile: plan.hasMobile ? genericCssMetric((mobile || tablet || desktop)?.paddingLeft) : undefined,
      borderRadius: genericCssMetric(desktop?.borderRadius),
      ...genericMeasuredUniformBorderProps([desktop, tablet || desktop, mobile || tablet || desktop]),
      ...genericMeasuredShadowProps(context, containerName, [desktop, tablet || desktop, mobile || tablet || desktop]),
      ...backgroundProps(context, containerName, surfaceColor),
      ...gradientProps,
    });
    const childTextColor = genericTextColor(gradientProps.gradientColor1 || surfaceColor, fallbackTextColor);
    created += 1 + addGenericMeasuredTextItems(
      context,
      child.id,
      desktop,
      tablet,
      mobile,
      plan,
      childTextColor,
      containerName,
      band.index * 10 + index
    );
  }

  return created;
}

function addGenericMeasuredGroups(context, parentId, desktopParent, tabletParent, mobileParent, plan, fallbackTextColor, containerName, contentIndex, orderEntries = null) {
  const desktopGroups = Array.isArray(desktopParent?.groups)
    ? desktopParent.groups.filter((group) => group?.flowParticipation !== 'overlay')
    : [];
  let created = 0;

  for (let index = 0; index < desktopGroups.length; index += 1) {
    const desktop = desktopGroups[index];
    const tablet = matchedGenericMeasuredGroup(desktop, tabletParent?.groups);
    const mobile = matchedGenericMeasuredGroup(desktop, mobileParent?.groups);
    const tabletMeasurement = tablet || desktop;
    const mobileMeasurement = mobile || tablet || desktop;
    const desktopPlacement = genericGridItemPlacement(desktop, genericMeasurementItems(desktopParent), desktopParent?.rect, genericMeasuredGridToken(desktopParent, true));
    const tabletPlacement = genericGridItemPlacement(tabletMeasurement, genericMeasurementItems(tabletParent), tabletParent?.rect, genericMeasuredGridToken(tabletParent || desktopParent, true));
    const mobilePlacement = genericGridItemPlacement(mobileMeasurement, genericMeasurementItems(mobileParent), mobileParent?.rect, genericMeasuredGridToken(mobileParent || tabletParent || desktopParent, true));
    const gradientProps = genericMeasuredGradientProps(context, containerName, [desktop, tabletMeasurement, mobileMeasurement]);
    const visualTiltProps = genericMeasuredVisualTiltProps(
      context,
      containerName,
      desktop,
      tabletMeasurement,
      mobileMeasurement,
      plan
    );
    const visualFramePlan = genericMeasuredVisualFramePlan(
      context,
      containerName,
      desktop,
      tabletMeasurement,
      mobileMeasurement,
      plan
    );
    if (visualFramePlan && (
      genericMeasurementItems(desktop).length > 0
      || Number(desktop?.mediaCount || 0) > 0
      || (Array.isArray(desktop?.overlayMedia) && desktop.overlayMedia.length > 0)
    )) {
      throw new Error('Generic measured reference contract gaps:\n- [generic_visual_frame_content_overlap] An inset frame may only be synthesized for an empty measured visual surface; use a dedicated control before framing live child content.');
    }
    const measuredOverflowValues = unique([desktop, tabletMeasurement, mobileMeasurement]
      .map((measurement) => String(measurement?.overflow || '').trim().toLowerCase())
      .filter((value) => ['visible', 'hidden', 'clip', 'auto', 'scroll'].includes(value)));
    if (measuredOverflowValues.length > 1) {
      throw new Error('Generic measured reference contract gaps:\n- [generic_responsive_overflow_control_gap] Container overflow changes between measured viewports, but the live contract has no responsive overflow control.');
    }
    const measuredOverflow = measuredOverflowValues[0] || '';
    if (measuredOverflow) {
      const containerAuthoringProps = new Set(context.contractIndex.get(containerName)?.authoringProps || []);
      if (!containerAuthoringProps.has('overflow')) {
        throw new Error('Generic measured reference contract gaps:\n- [generic_overflow_control_gap] Container must expose the measured overflow control before this clipped visual surface can be authored without className or raw CSS.');
      }
    }
    const surfaceColor = Object.keys(gradientProps).length > 0
      ? ''
      : genericMeasuredSurfaceColor(desktop, plan.pageTextColor || context.styleProfile.ink);
    const stickyResetAt = desktop?.sticky === true
      ? plan.hasTablet && tablet && tablet.sticky !== true
        ? 'tablet'
        : plan.hasMobile && mobile && mobile.sticky !== true
          ? 'mobile'
          : undefined
      : undefined;
    const fixedTrackRow = genericMeasuredFixedTrackRow([
      desktop,
      ...(plan.hasTablet ? [tabletMeasurement] : []),
      ...(plan.hasMobile ? [mobileMeasurement] : []),
    ]);
    const display = fixedTrackRow ? 'flex' : genericMeasuredDisplay(desktop);
    const usesGrid = !fixedTrackRow && (display === 'grid'
      || genericMeasuredDisplay(tabletMeasurement) === 'grid'
      || genericMeasuredDisplay(mobileMeasurement) === 'grid');
    const measuredLayoutProps = fixedTrackRow ? {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      flexDirectionTablet: plan.hasTablet ? 'row' : undefined,
      flexDirectionMobile: plan.hasMobile ? 'row' : undefined,
      flexWrap: 'nowrap',
      flexWrapTablet: plan.hasTablet ? 'nowrap' : undefined,
      flexWrapMobile: plan.hasMobile ? 'nowrap' : undefined,
      justifyContent: 'flex-start',
      justifyContentTablet: plan.hasTablet ? 'flex-start' : undefined,
      justifyContentMobile: plan.hasMobile ? 'flex-start' : undefined,
      alignItems: 'baseline',
      alignItemsTablet: plan.hasTablet ? 'baseline' : undefined,
      alignItemsMobile: plan.hasMobile ? 'baseline' : undefined,
      gap: fixedTrackRow.gap,
      gapTablet: plan.hasTablet ? fixedTrackRow.gap : undefined,
      gapMobile: plan.hasMobile ? fixedTrackRow.gap : undefined,
    } : {
      layoutDisplay: display,
      flexDirection: genericMeasuredFlexDirection(desktop),
      flexDirectionTablet: plan.hasTablet ? genericMeasuredFlexDirection(tabletMeasurement) : undefined,
      flexDirectionMobile: plan.hasMobile ? genericMeasuredFlexDirection(mobileMeasurement) : undefined,
      flexWrap: genericMeasuredFlexWrap(desktop),
      flexWrapTablet: plan.hasTablet ? genericMeasuredFlexWrap(tabletMeasurement) : undefined,
      flexWrapMobile: plan.hasMobile ? genericMeasuredFlexWrap(mobileMeasurement) : undefined,
      justifyContent: genericMeasuredJustifyContent(desktop),
      justifyContentTablet: plan.hasTablet ? genericMeasuredJustifyContent(tabletMeasurement) : undefined,
      justifyContentMobile: plan.hasMobile ? genericMeasuredJustifyContent(mobileMeasurement) : undefined,
      alignItems: genericMeasuredAlignItems(desktop),
      alignItemsTablet: plan.hasTablet ? genericMeasuredAlignItems(tabletMeasurement) : undefined,
      alignItemsMobile: plan.hasMobile ? genericMeasuredAlignItems(mobileMeasurement) : undefined,
      gap: genericMeasuredLayoutGap(desktop),
      gapTablet: plan.hasTablet ? genericMeasuredLayoutGap(tabletMeasurement) : undefined,
      gapMobile: plan.hasMobile ? genericMeasuredLayoutGap(mobileMeasurement) : undefined,
      ...(usesGrid ? genericMeasuredGridProps(
        context,
        containerName,
        desktop,
        tabletMeasurement,
        mobileMeasurement,
        plan,
        true
      ) : {}),
    };
    const measuredPaddingProps = visualFramePlan?.paddingProps || {
      paddingTop: genericCssMetric(desktop?.paddingTop),
      paddingTopTablet: plan.hasTablet ? genericCssMetric(tabletMeasurement?.paddingTop) : undefined,
      paddingTopMobile: plan.hasMobile ? genericCssMetric(mobileMeasurement?.paddingTop) : undefined,
      paddingRight: genericCssMetric(desktop?.paddingRight),
      paddingRightTablet: plan.hasTablet ? genericCssMetric(tabletMeasurement?.paddingRight) : undefined,
      paddingRightMobile: plan.hasMobile ? genericCssMetric(mobileMeasurement?.paddingRight) : undefined,
      paddingBottom: genericCssMetric(desktop?.paddingBottom),
      paddingBottomTablet: plan.hasTablet ? genericCssMetric(tabletMeasurement?.paddingBottom) : undefined,
      paddingBottomMobile: plan.hasMobile ? genericCssMetric(mobileMeasurement?.paddingBottom) : undefined,
      paddingLeft: genericCssMetric(desktop?.paddingLeft),
      paddingLeftTablet: plan.hasTablet ? genericCssMetric(tabletMeasurement?.paddingLeft) : undefined,
      paddingLeftMobile: plan.hasMobile ? genericCssMetric(mobileMeasurement?.paddingLeft) : undefined,
    };
    const topDividerProps = genericMeasuredEdgeDividerProps([
      desktop,
      ...(plan.hasTablet ? [tabletMeasurement] : []),
      ...(plan.hasMobile ? [mobileMeasurement] : []),
    ], 'top');
    const dividerComponent = topDividerProps ? findComponent(context.contractIndex, ['Divider']) : null;
    if (topDividerProps && visualFramePlan) {
      throw new Error('Generic measured reference contract gaps:\n- [generic_visual_frame_divider_conflict] One measured surface cannot be represented as both an inset frame and a top-edge divider.');
    }
    if (topDividerProps && !dividerComponent) {
      throw new Error('Generic measured reference contract gaps:\n- [generic_border_control_gap] Divider is required to reproduce a measured top-only border without className or raw CSS.');
    }
    const group = createCanvasNode(context, containerName, parentId, {
      ...(topDividerProps ? {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        flexDirectionTablet: plan.hasTablet ? 'column' : undefined,
        flexDirectionMobile: plan.hasMobile ? 'column' : undefined,
        flexWrap: 'nowrap',
        flexWrapTablet: plan.hasTablet ? 'nowrap' : undefined,
        flexWrapMobile: plan.hasMobile ? 'nowrap' : undefined,
        justifyContent: 'flex-start',
        justifyContentTablet: plan.hasTablet ? 'flex-start' : undefined,
        justifyContentMobile: plan.hasMobile ? 'flex-start' : undefined,
        alignItems: 'stretch',
        alignItemsTablet: plan.hasTablet ? 'stretch' : undefined,
        alignItemsMobile: plan.hasMobile ? 'stretch' : undefined,
        gap: '0px',
        gapTablet: plan.hasTablet ? '0px' : undefined,
        gapMobile: plan.hasMobile ? '0px' : undefined,
      } : measuredLayoutProps),
      responsiveDisplay: genericMeasuredResponsiveDisplay(tablet, mobile, plan),
      gridColumnStart: desktopPlacement.columnStart,
      gridColumnSpan: desktopPlacement.columnSpan,
      gridRowStart: desktopPlacement.rowStart,
      gridRowSpan: desktopPlacement.rowSpan,
      gridColumnStartTablet: plan.hasTablet ? tabletPlacement.columnStart : undefined,
      gridColumnSpanTablet: plan.hasTablet ? tabletPlacement.columnSpan : undefined,
      gridRowStartTablet: plan.hasTablet ? tabletPlacement.rowStart : undefined,
      gridRowSpanTablet: plan.hasTablet ? tabletPlacement.rowSpan : undefined,
      gridColumnStartMobile: plan.hasMobile ? mobilePlacement.columnStart : undefined,
      gridColumnSpanMobile: plan.hasMobile ? mobilePlacement.columnSpan : undefined,
      gridRowStartMobile: plan.hasMobile ? mobilePlacement.rowStart : undefined,
      gridRowSpanMobile: plan.hasMobile ? mobilePlacement.rowSpan : undefined,
      width: genericMeasuredGroupWidth(desktop, desktopParent),
      maxWidth: genericMeasuredRectSize(desktop, 'width'),
      maxWidthTablet: plan.hasTablet ? genericMeasuredRectSize(tabletMeasurement, 'width') : undefined,
      maxWidthMobile: plan.hasMobile ? genericMeasuredRectSize(mobileMeasurement, 'width') : undefined,
      minHeight: genericMeasuredRectSize(desktop, 'height'),
      minHeightTablet: plan.hasTablet ? genericMeasuredRectSize(tabletMeasurement, 'height') : undefined,
      minHeightMobile: plan.hasMobile ? genericMeasuredRectSize(mobileMeasurement, 'height') : undefined,
      ...(topDividerProps ? {
        paddingTop: '0px',
        paddingTopTablet: plan.hasTablet ? '0px' : undefined,
        paddingTopMobile: plan.hasMobile ? '0px' : undefined,
        paddingRight: '0px',
        paddingRightTablet: plan.hasTablet ? '0px' : undefined,
        paddingRightMobile: plan.hasMobile ? '0px' : undefined,
        paddingBottom: '0px',
        paddingBottomTablet: plan.hasTablet ? '0px' : undefined,
        paddingBottomMobile: plan.hasMobile ? '0px' : undefined,
        paddingLeft: '0px',
        paddingLeftTablet: plan.hasTablet ? '0px' : undefined,
        paddingLeftMobile: plan.hasMobile ? '0px' : undefined,
      } : measuredPaddingProps),
      sticky: desktop?.sticky === true ? true : undefined,
      stickyTop: desktop?.sticky === true ? genericCssMetric(desktop?.stickyTop) : undefined,
      stickyResetAt,
      ...visualTiltProps,
      borderRadius: genericCssMetric(desktop?.borderRadius),
      ...genericMeasuredUniformBorderProps([desktop, tabletMeasurement, mobileMeasurement]),
      ...genericMeasuredShadowProps(context, containerName, [desktop, tabletMeasurement, mobileMeasurement]),
      overflow: measuredOverflow || undefined,
      ...backgroundProps(context, containerName, surfaceColor),
      ...gradientProps,
    });
    if (desktop.key) {
      context.genericMeasuredGroupNodes.set(desktop.key, group.id);
      context.genericMeasuredNodeKeys.set(group.id, desktop.key);
    }
    if (Array.isArray(orderEntries)) {
      orderEntries.push({
        id: group.id,
        key: desktop.key,
        stackingIndex: safeReferenceStackingIndex(desktop.stackingIndex),
        stackingIndexTablet: safeReferenceStackingIndex(tablet?.stackingIndex),
        stackingIndexMobile: safeReferenceStackingIndex(mobile?.stackingIndex),
        rect: desktop.rect,
        rectTablet: tablet?.rect,
        rectMobile: mobile?.rect,
      });
    }
    const groupTextColor = genericTextColor(gradientProps.gradientColor1 || surfaceColor, fallbackTextColor);
    const childOrderEntries = [];
    created += 1;
    let contentParentId = group.id;
    if (visualFramePlan) {
      const frame = createCanvasNode(context, containerName, group.id, visualFramePlan.childProps);
      contentParentId = frame.id;
      created += 1;
    } else if (topDividerProps && dividerComponent) {
      createLeafNode(context, dividerComponent.name, group.id, topDividerProps);
      const content = createCanvasNode(context, containerName, group.id, {
        ...measuredLayoutProps,
        ...measuredPaddingProps,
        width: '100%',
      });
      contentParentId = content.id;
      if (desktop.key) {
        context.genericMeasuredGroupNodes.set(desktop.key, content.id);
      }
      created += 2;
    }
    if (desktop.semanticWidget === 'FormBlock') {
      const formComponent = findComponent(context.contractIndex, ['FormBlock']);
      if (!formComponent) {
        throw new Error('Generic measured reference contract gaps:\n- [generic_semantic_form_widget_missing] FormBlock is required to reproduce a measured multi-field form without raw HTML.');
      }
      const supportedFieldTypes = formComponent.propOptions?.get('type');
      const capturedFields = Array.isArray(desktop.props?.fields) ? desktop.props.fields : [];
      if (!(supportedFieldTypes instanceof Set) || supportedFieldTypes.size === 0) {
        throw new Error('Generic measured reference contract gaps:\n- [generic_semantic_form_field_contract_missing] FormBlock must expose live repeater item type options before a measured form can be authored.');
      }
      const unsupportedFieldTypes = unique(capturedFields
        .map((field) => String(field?.type || 'text'))
        .filter((type) => !supportedFieldTypes.has(type)));
      if (unsupportedFieldTypes.length > 0) {
        throw new Error(`Generic measured reference contract gaps:\n- [generic_semantic_form_field_type_unsupported] FormBlock does not expose measured field type(s): ${unsupportedFieldTypes.join(', ')}.`);
      }
      const submitLabel = genericMeasuredAuthoringText(
        desktop.submitBox || { tag: 'button', text: 'Send message' },
        plan,
        contentIndex,
        index
      );
      createLeafNode(context, formComponent.name, contentParentId, {
        ...(desktop.props || {}),
        submitLabel,
      });
      created += 1;
      continue;
    }
    if (desktop.semanticWidget === 'TabsBlock') {
      const tabsComponent = findComponent(context.contractIndex, ['TabsBlock']);
      if (!tabsComponent) {
        throw new Error('Generic measured reference contract gaps:\n- [generic_semantic_tabs_widget_missing] TabsBlock is required to reproduce measured tabs without separate button and panel nodes.');
      }
      const tabletRequiresPanelStack = desktop.panelFlow === 'split'
        && tabletMeasurement?.panelFlow === 'stack';
      const responsiveTabProps = {
        tabBarWidthTablet: plan.hasTablet ? tabletMeasurement?.props?.tabBarWidth : undefined,
        tabBarWidthMobile: plan.hasMobile ? mobileMeasurement?.props?.tabBarWidth : undefined,
        tabWidthTablet: plan.hasTablet ? tabletMeasurement?.props?.tabWidth : undefined,
        tabWidthMobile: plan.hasMobile ? mobileMeasurement?.props?.tabWidth : undefined,
        tabMinHeightTablet: plan.hasTablet ? tabletMeasurement?.props?.tabMinHeight : undefined,
        tabMinHeightMobile: plan.hasMobile ? mobileMeasurement?.props?.tabMinHeight : undefined,
        tabFontSizeTablet: plan.hasTablet ? tabletMeasurement?.props?.tabFontSize : undefined,
        tabFontSizeMobile: plan.hasMobile ? mobileMeasurement?.props?.tabFontSize : undefined,
        panelPaddingTablet: plan.hasTablet ? tabletMeasurement?.props?.panelPadding : undefined,
        panelPaddingMobile: plan.hasMobile ? mobileMeasurement?.props?.panelPadding : undefined,
        panelGapTablet: plan.hasTablet ? tabletMeasurement?.props?.panelGap : undefined,
        panelGapMobile: plan.hasMobile ? mobileMeasurement?.props?.panelGap : undefined,
        panelContentPaddingTopTablet: plan.hasTablet ? tabletMeasurement?.props?.panelContentPaddingTop : undefined,
        panelContentPaddingTopMobile: plan.hasMobile ? mobileMeasurement?.props?.panelContentPaddingTop : undefined,
        panelContentPaddingXTablet: plan.hasTablet ? tabletMeasurement?.props?.panelContentPaddingX : undefined,
        panelContentPaddingXMobile: plan.hasMobile ? mobileMeasurement?.props?.panelContentPaddingX : undefined,
        panelContentPaddingBottomTablet: plan.hasTablet ? tabletMeasurement?.props?.panelContentPaddingBottom : undefined,
        panelContentPaddingBottomMobile: plan.hasMobile ? mobileMeasurement?.props?.panelContentPaddingBottom : undefined,
        panelTitleFontSizeTablet: plan.hasTablet ? tabletMeasurement?.props?.panelTitleFontSize : undefined,
        panelTitleFontSizeMobile: plan.hasMobile ? mobileMeasurement?.props?.panelTitleFontSize : undefined,
        panelTitleLineHeightTablet: plan.hasTablet ? tabletMeasurement?.props?.panelTitleLineHeight : undefined,
        panelTitleLineHeightMobile: plan.hasMobile ? mobileMeasurement?.props?.panelTitleLineHeight : undefined,
        panelTitleMarginBottomTablet: plan.hasTablet ? tabletMeasurement?.props?.panelTitleMarginBottom : undefined,
        panelTitleMarginBottomMobile: plan.hasMobile ? mobileMeasurement?.props?.panelTitleMarginBottom : undefined,
        panelEyebrowLineHeightTablet: plan.hasTablet ? tabletMeasurement?.props?.panelEyebrowLineHeight : undefined,
        panelEyebrowLineHeightMobile: plan.hasMobile ? mobileMeasurement?.props?.panelEyebrowLineHeight : undefined,
        panelEyebrowMarginBottomTablet: plan.hasTablet ? tabletMeasurement?.props?.panelEyebrowMarginBottom : undefined,
        panelEyebrowMarginBottomMobile: plan.hasMobile ? mobileMeasurement?.props?.panelEyebrowMarginBottom : undefined,
        panelImageHeightTablet: plan.hasTablet ? tabletMeasurement?.props?.panelImageHeight : undefined,
        panelImageHeightMobile: plan.hasMobile ? mobileMeasurement?.props?.panelImageHeight : undefined,
        panelImageObjectPositionXTablet: plan.hasTablet ? tabletMeasurement?.props?.panelImageObjectPositionX : undefined,
        panelImageObjectPositionXMobile: plan.hasMobile ? mobileMeasurement?.props?.panelImageObjectPositionX : undefined,
        panelImageObjectPositionYTablet: plan.hasTablet ? tabletMeasurement?.props?.panelImageObjectPositionY : undefined,
        panelImageObjectPositionYMobile: plan.hasMobile ? mobileMeasurement?.props?.panelImageObjectPositionY : undefined,
      };
      const requiredProps = unique(['tabs', 'defaultActiveTab', 'orientation', 'mobileTabLayout']
        .concat(tabletRequiresPanelStack ? ['panelStackAt'] : [])
        .concat(Object.entries({ ...(desktop.props || {}), ...responsiveTabProps })
          .filter(([, value]) => typeof value !== 'undefined' && value !== null && value !== '')
          .map(([prop]) => prop)));
      const authoringProps = new Set(tabsComponent.authoringProps || []);
      const missingProps = requiredProps.filter((prop) => !authoringProps.has(prop));
      if (missingProps.length > 0) {
        throw new Error(`Generic measured reference contract gaps:\n- [generic_semantic_tabs_control_missing] TabsBlock is missing measured authoring controls: ${missingProps.join(', ')}.`);
      }
      const orientation = String(desktop.props?.orientation || 'horizontal');
      const mobileTabLayout = String(mobileMeasurement?.props?.mobileTabLayout || desktop.props?.mobileTabLayout || 'scroll');
      const orientationOptions = tabsComponent.propOptions?.get('orientation');
      const mobileLayoutOptions = tabsComponent.propOptions?.get('mobileTabLayout');
      const panelStackOptions = tabsComponent.propOptions?.get('panelStackAt');
      if (orientationOptions instanceof Set && orientationOptions.size > 0 && !orientationOptions.has(orientation)) {
        throw new Error(`Generic measured reference contract gaps:\n- [generic_semantic_tabs_orientation_unsupported] TabsBlock does not expose the measured ${orientation} orientation.`);
      }
      if (mobileLayoutOptions instanceof Set && mobileLayoutOptions.size > 0 && !mobileLayoutOptions.has(mobileTabLayout)) {
        throw new Error(`Generic measured reference contract gaps:\n- [generic_semantic_tabs_mobile_layout_unsupported] TabsBlock does not expose the measured ${mobileTabLayout} mobile layout.`);
      }
      if (tabletRequiresPanelStack
        && panelStackOptions instanceof Set
        && panelStackOptions.size > 0
        && !panelStackOptions.has('tablet')) {
        throw new Error('Generic measured reference contract gaps:\n- [generic_semantic_tabs_panel_stack_unsupported] TabsBlock cannot stack panel content and media at the measured tablet breakpoint.');
      }
      const generatedTarget = (context.brief.authoringRequirements?.referenceClassification
        || context.brief.target?.referenceClassification)?.kind === 'generated-target';
      const targetTabs = generatedTarget && Array.isArray(context.brief.target?.tabs)
        ? context.brief.target.tabs
        : [];
      const capturedLabels = Array.isArray(desktop.tabLabels) ? desktop.tabLabels : [];
      const capturedTabItems = Array.isArray(desktop.tabItems) && desktop.tabItems.length > 0
        ? desktop.tabItems
        : capturedLabels.map((label) => ({ label }));
      const capturedActivePanel = desktop.activePanel && typeof desktop.activePanel === 'object'
        ? desktop.activePanel
        : {};
      const activeIndex = Number.isInteger(desktop.props?.defaultActiveTab)
        ? Math.max(0, Math.min(Number(desktop.props.defaultActiveTab), Math.max(0, capturedTabItems.length - 1)))
        : 0;
      const itemSources = targetTabs.length > 0
        ? targetTabs
        : capturedTabItems.map((item, tabIndex) => ({
          ...item,
          eyebrow: tabIndex === activeIndex ? capturedActivePanel.eyebrow : '',
          title: tabIndex === activeIndex ? capturedActivePanel.title : '',
          content: tabIndex === activeIndex ? capturedActivePanel.content : '',
          image: tabIndex === activeIndex ? capturedActivePanel.image : '',
          imageAlt: '',
          ctaLabel: tabIndex === activeIndex ? capturedActivePanel.ctaLabel : '',
          ctaUrl: '#',
        }));
      if (itemSources.length < 2 || itemSources.length > 12) {
        throw new Error(`Generic measured reference contract gaps:\n- [generic_semantic_tabs_cardinality_unsupported] Measured tabs require 2-12 items; received ${itemSources.length}.`);
      }
      const authoredTabs = itemSources.map((tab, tabIndex) => {
        const sourceLabel = String(tab?.label || capturedLabels[tabIndex] || `Tab ${tabIndex + 1}`).trim();
        const sourceTitle = String(tab?.title || '').trim();
        const sourceContent = String(tab?.content || '').trim();
        const sourceImage = String(tab?.image || '').trim();
        const sourceLabelPrefix = String(tab?.labelPrefix || '').trim();
        const sourceLabelSuffix = String(tab?.labelSuffix || '').trim();
        const sourceEyebrow = String(tab?.eyebrow || '').trim();
        const sourceCtaLabel = String(tab?.ctaLabel || '').trim();
        const sourceCtaUrl = String(tab?.ctaUrl || '').trim();
        return {
          ...(authoringProps.has('labelPrefix') && sourceLabelPrefix ? {
            labelPrefix: plan.preserveSourceText ? sourceLabelPrefix : String(tabIndex + 1).padStart(2, '0'),
          } : {}),
          label: plan.preserveSourceText
            ? sourceLabel
            : genericMeasuredReplacementCopy(sourceLabel, 'button', contentIndex + tabIndex),
          ...(authoringProps.has('labelSuffix') && sourceLabelSuffix ? {
            labelSuffix: plan.preserveSourceText
              ? sourceLabelSuffix
              : `${String(18 + tabIndex).padStart(2, '0')}:00`,
          } : {}),
          ...(authoringProps.has('eyebrow') && sourceEyebrow ? {
            eyebrow: plan.preserveSourceText
              ? sourceEyebrow
              : genericMeasuredReplacementCopy(sourceEyebrow, 'p', contentIndex + tabIndex),
          } : {}),
          ...(authoringProps.has('title') && sourceTitle ? {
            title: plan.preserveSourceText
              ? sourceTitle
              : genericMeasuredReplacementCopy(sourceTitle, 'h3', contentIndex + tabIndex),
          } : {}),
          content: plan.preserveSourceText
            ? sourceContent
            : genericMeasuredReplacementCopy(sourceContent, 'p', contentIndex + tabIndex),
          ...(authoringProps.has('image') && sourceImage ? {
            image: generatedTarget && plan.reuseSourceMedia
              ? sourceImage
              : genericReplacementMediaSource(context, contentIndex, tabIndex, false),
          } : {}),
          ...(authoringProps.has('imageAlt') && String(tab?.imageAlt || '').trim() ? {
            imageAlt: String(tab.imageAlt).trim(),
          } : {}),
          ...(authoringProps.has('ctaLabel') && sourceCtaLabel ? {
            ctaLabel: plan.preserveSourceText
              ? sourceCtaLabel
              : genericMeasuredReplacementCopy(sourceCtaLabel, 'a', contentIndex + tabIndex),
          } : {}),
          ...(authoringProps.has('ctaUrl') && sourceCtaLabel ? {
            ctaUrl: generatedTarget && plan.preserveSourceText && sourceCtaUrl ? sourceCtaUrl : '#',
          } : {}),
        };
      });
      createLeafNode(context, tabsComponent.name, contentParentId, {
        ...(desktop.props || {}),
        ...responsiveTabProps,
        panelStackAt: tabletRequiresPanelStack ? 'tablet' : undefined,
        orientation,
        mobileTabLayout,
        defaultActiveTab: Math.max(0, Math.min(activeIndex, authoredTabs.length - 1)),
        tabs: authoredTabs,
      });
      created += 1;
      continue;
    }
    created += addGenericMeasuredGroups(
      context,
      contentParentId,
      desktop,
      tabletMeasurement,
      mobileMeasurement,
      plan,
      groupTextColor,
      containerName,
      contentIndex * 10 + index,
      childOrderEntries
    );
    created += addGenericMeasuredTextItems(
      context,
      contentParentId,
      desktop,
      tabletMeasurement,
      mobileMeasurement,
      plan,
      groupTextColor,
      containerName,
      contentIndex * 10 + index,
      childOrderEntries
    );
    orderGenericMeasuredChildren(context, contentParentId, childOrderEntries);
  }

  created += addGenericMeasuredOverlayItems(
    context,
    parentId,
    desktopParent,
    tabletParent,
    mobileParent,
    plan,
    fallbackTextColor,
    containerName,
    contentIndex,
    orderEntries
  );

  return created;
}

function addGenericMeasuredOverlayItems(context, parentId, desktopParent, tabletParent, mobileParent, plan, fallbackTextColor, containerName, contentIndex, orderEntries = null) {
  const desktopParentRect = normalizeReferenceRect(desktopParent?.rect);
  const desktopNormalGroups = Array.isArray(desktopParent?.groups)
    ? desktopParent.groups.filter((group) => group?.flowParticipation !== 'overlay')
    : [];
  const desktopTexts = Array.isArray(desktopParent?.texts) ? desktopParent.texts : [];
  if (!desktopParentRect || desktopTexts.length > 0) {
    return 0;
  }

  const overlayGroups = (Array.isArray(desktopParent?.groups) ? desktopParent.groups : [])
    .filter((group) => {
      const rect = normalizeReferenceRect(group?.rect);
      return group?.flowParticipation === 'overlay'
        && group?.paintedBackground === true
        && rect
        && (referenceRectContains(desktopParentRect, rect) || referenceRectMateriallyOverlaps(desktopParentRect, rect))
        && referenceBoxArea(group) <= referenceBoxArea(desktopParent) * 0.75;
    })
    .map((value) => ({ kind: 'group', key: value.key, value }));
  const overlayMedia = (Array.isArray(desktopParent?.overlayMedia) ? desktopParent.overlayMedia : [])
    .filter((media) => {
      const rect = normalizeReferenceRect(media?.rect);
      return media?.flowParticipation === 'overlay'
        && media?.structureKey
        && rect
        && (referenceRectContains(desktopParentRect, rect) || referenceRectMateriallyOverlaps(desktopParentRect, rect))
        && referenceBoxArea(media) <= referenceBoxArea(desktopParent) * 0.75;
    })
    .map((value) => ({ kind: 'media', key: value.structureKey, value }));
  const desktopItems = overlayGroups
    .concat(overlayMedia)
    .sort((left, right) => (
      (safeReferenceStackingIndex(left.value?.stackingIndex) ?? Number.MAX_SAFE_INTEGER)
        - (safeReferenceStackingIndex(right.value?.stackingIndex) ?? Number.MAX_SAFE_INTEGER)
      || referenceBoxTop(left.value) - referenceBoxTop(right.value)
      || Number(left.value?.rect?.left || 0) - Number(right.value?.rect?.left || 0)
    ));
  if (desktopItems.length === 0 || desktopItems.length > 4) {
    return 0;
  }

  const matchedItems = desktopItems.map((item) => {
    const responsiveMediaParentKey = item.kind === 'media'
      ? String(item.key || '').split('.').slice(0, -1).join('.')
      : '';
    const tabletCandidates = item.kind === 'group'
      ? (Array.isArray(tabletParent?.groups) ? tabletParent.groups : [])
      : genericMeasurementMedia(tabletParent).concat(genericMeasurementMedia(
        genericMeasuredGroupByKey(tabletParent, responsiveMediaParentKey)
      ));
    const mobileCandidates = item.kind === 'group'
      ? (Array.isArray(mobileParent?.groups) ? mobileParent.groups : [])
      : genericMeasurementMedia(mobileParent).concat(genericMeasurementMedia(
        genericMeasuredGroupByKey(mobileParent, responsiveMediaParentKey)
      ));
    const tablet = item.kind === 'group'
      ? tabletCandidates.find((candidate) => candidate?.key === item.key) || null
      : matchedGenericMeasuredMedia(item.value, 0, { media: tabletCandidates });
    const mobile = item.kind === 'group'
      ? mobileCandidates.find((candidate) => candidate?.key === item.key) || null
      : matchedGenericMeasuredMedia(item.value, 0, { media: mobileCandidates });
    return { ...item, tablet, mobile };
  });
  const tabletParentRect = normalizeReferenceRect(tabletParent?.rect) || desktopParentRect;
  const mobileParentRect = normalizeReferenceRect(mobileParent?.rect) || tabletParentRect;
  const tabletHasNormalFlowItem = matchedItems.some((item) => item.tablet?.flowParticipation === 'normal');
  const mobileHasNormalFlowItem = matchedItems.some((item) => item.mobile?.flowParticipation === 'normal');
  const mixedStack = desktopNormalGroups.length > 0;
  const containerAuthoringProps = new Set(context.contractIndex.get(containerName)?.authoringProps || []);
  const usesSignedOverlayMargins = [
    'marginTop',
    'marginBottom',
    'paintLayer',
    ...(plan.hasTablet ? ['marginTopTablet', 'marginBottomTablet'] : []),
    ...(plan.hasMobile ? ['marginTopMobile', 'marginBottomMobile'] : []),
  ].every((prop) => containerAuthoringProps.has(prop));
  const normalOrderEntries = mixedStack && Array.isArray(orderEntries)
    ? desktopNormalGroups.map((group) => orderEntries.find((entry) => entry.key === group.key)).filter(Boolean)
    : [];
  if (mixedStack && (
    normalOrderEntries.length !== desktopNormalGroups.length
    || desktopNormalGroups.some((group) => safeReferenceStackingIndex(group.stackingIndex) === undefined)
    || desktopItems.some((item) => safeReferenceStackingIndex(item.value?.stackingIndex) === undefined)
  )) {
    return 0;
  }
  Object.assign(context.nodeMap[parentId].props, filterAllowedProps(context, containerName, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    gridTemplateColumnsTablet: plan.hasTablet ? 'one' : undefined,
    gridTemplateColumnsMobile: plan.hasMobile ? 'one' : undefined,
    alignItems: 'flex-start',
    alignItemsTablet: plan.hasTablet ? 'flex-start' : undefined,
    alignItemsMobile: plan.hasMobile ? 'flex-start' : undefined,
    gap: '0px',
    gapTablet: plan.hasTablet
      ? tabletHasNormalFlowItem ? genericMeasuredItemGap(tabletParent) : '0px'
      : undefined,
    gapMobile: plan.hasMobile
      ? mobileHasNormalFlowItem ? genericMeasuredItemGap(mobileParent) : '0px'
      : undefined,
  }));
  if (mixedStack) {
    const stackPlacementProps = filterAllowedProps(context, containerName, {
      gridColumnStart: 1,
      gridColumnSpan: 1,
      gridRowStart: 1,
      gridRowSpan: 1,
      gridColumnStartTablet: plan.hasTablet ? 1 : undefined,
      gridColumnSpanTablet: plan.hasTablet ? 1 : undefined,
      gridRowStartTablet: plan.hasTablet ? 1 : undefined,
      gridRowSpanTablet: plan.hasTablet ? 1 : undefined,
      gridColumnStartMobile: plan.hasMobile ? 1 : undefined,
      gridColumnSpanMobile: plan.hasMobile ? 1 : undefined,
      gridRowStartMobile: plan.hasMobile ? 1 : undefined,
      gridRowSpanMobile: plan.hasMobile ? 1 : undefined,
    });
    for (const entry of normalOrderEntries) {
      Object.assign(context.nodeMap[entry.id].props, stackPlacementProps);
      entry.stackLayer = true;
    }
  }

  let created = 0;
  for (let index = 0; index < matchedItems.length; index += 1) {
    const item = matchedItems[index];
    const desktop = item.value;
    const tablet = item.tablet || desktop;
    const mobile = item.mobile || item.tablet || desktop;
    const desktopRect = normalizeReferenceRect(desktop?.rect);
    const tabletRect = normalizeReferenceRect(tablet?.rect) || desktopRect;
    const mobileRect = normalizeReferenceRect(mobile?.rect) || tabletRect;
    if (!desktopRect || !tabletRect || !mobileRect) {
      continue;
    }
    const tabletNormalFlow = item.tablet?.flowParticipation === 'normal';
    const mobileNormalFlow = item.mobile?.flowParticipation === 'normal';
    const tabletGridPlacement = tabletNormalFlow
      ? genericGridItemPlacement(tablet, genericMeasurementItems(tabletParent), tabletParent?.rect, 'one')
      : { columnStart: 1, columnSpan: 1, rowStart: 1, rowSpan: 1 };
    const mobileGridPlacement = mobileNormalFlow
      ? genericGridItemPlacement(mobile, genericMeasurementItems(mobileParent), mobileParent?.rect, 'one')
      : { columnStart: 1, columnSpan: 1, rowStart: 1, rowSpan: 1 };
    const desktopTop = desktopRect.bottom > desktopParentRect.bottom + 2
      || desktopRect.top + desktopRect.height / 2 <= desktopParentRect.top + desktopParentRect.height / 2;
    const tabletTop = tabletRect.bottom > tabletParentRect.bottom + 2
      || tabletRect.top + tabletRect.height / 2 <= tabletParentRect.top + tabletParentRect.height / 2;
    const mobileTop = mobileRect.bottom > mobileParentRect.bottom + 2
      || mobileRect.top + mobileRect.height / 2 <= mobileParentRect.top + mobileParentRect.height / 2;
    const desktopLeft = desktopRect.left + desktopRect.width / 2 <= desktopParentRect.left + desktopParentRect.width / 2;
    const tabletLeft = tabletRect.left + tabletRect.width / 2 <= tabletParentRect.left + tabletParentRect.width / 2;
    const mobileLeft = mobileRect.left + mobileRect.width / 2 <= mobileParentRect.left + mobileParentRect.width / 2;
    const desktopParentPaddingTop = Number.parseFloat(genericCssMetric(desktopParent?.paddingTop) || '0');
    const tabletParentPaddingTop = Number.parseFloat(genericCssMetric((tabletParent || desktopParent)?.paddingTop) || '0');
    const mobileParentPaddingTop = Number.parseFloat(genericCssMetric((mobileParent || tabletParent || desktopParent)?.paddingTop) || '0');
    const desktopParentPaddingBottom = Number.parseFloat(genericCssMetric(desktopParent?.paddingBottom) || '0');
    const tabletParentPaddingBottom = Number.parseFloat(genericCssMetric((tabletParent || desktopParent)?.paddingBottom) || '0');
    const mobileParentPaddingBottom = Number.parseFloat(genericCssMetric((mobileParent || tabletParent || desktopParent)?.paddingBottom) || '0');
    const desktopTopInset = Math.max(0, desktopRect.top - desktopParentRect.top - desktopParentPaddingTop);
    const tabletTopInset = Math.max(0, tabletRect.top - tabletParentRect.top - tabletParentPaddingTop);
    const mobileTopInset = Math.max(0, mobileRect.top - mobileParentRect.top - mobileParentPaddingTop);
    const desktopBottomInset = Math.max(0, desktopParentRect.bottom - desktopParentPaddingBottom - desktopRect.bottom);
    const tabletBottomInset = Math.max(0, tabletParentRect.bottom - tabletParentPaddingBottom - tabletRect.bottom);
    const mobileBottomInset = Math.max(0, mobileParentRect.bottom - mobileParentPaddingBottom - mobileRect.bottom);
    const desktopMarginBottom = desktopParentRect.bottom - desktopParentPaddingBottom - desktopRect.bottom;
    const tabletMarginBottom = tabletParentRect.bottom - tabletParentPaddingBottom - tabletRect.bottom;
    const mobileMarginBottom = mobileParentRect.bottom - mobileParentPaddingBottom - mobileRect.bottom;
    const anchor = createCanvasNode(context, containerName, parentId, {
      layoutDisplay: 'flex',
      responsiveDisplay: genericMeasuredResponsiveDisplay(item.tablet, item.mobile, plan),
      flexDirection: 'row',
      flexDirectionTablet: plan.hasTablet ? 'row' : undefined,
      flexDirectionMobile: plan.hasMobile ? 'row' : undefined,
      justifyContent: desktopLeft ? 'flex-start' : 'flex-end',
      justifyContentTablet: plan.hasTablet ? (tabletLeft ? 'flex-start' : 'flex-end') : undefined,
      justifyContentMobile: plan.hasMobile ? (mobileLeft ? 'flex-start' : 'flex-end') : undefined,
      alignItems: desktopTop ? 'flex-start' : 'flex-end',
      alignItemsTablet: plan.hasTablet ? (tabletNormalFlow || tabletTop ? 'flex-start' : 'flex-end') : undefined,
      alignItemsMobile: plan.hasMobile ? (mobileNormalFlow || mobileTop ? 'flex-start' : 'flex-end') : undefined,
      width: '100%',
      paddingRight: `${desktopLeft ? 0 : Math.round(Math.max(0, desktopParentRect.right - desktopRect.right) * 100) / 100}px`,
      paddingRightTablet: plan.hasTablet ? `${tabletLeft ? 0 : Math.round(Math.max(0, tabletParentRect.right - tabletRect.right) * 100) / 100}px` : undefined,
      paddingRightMobile: plan.hasMobile ? `${mobileLeft ? 0 : Math.round(Math.max(0, mobileParentRect.right - mobileRect.right) * 100) / 100}px` : undefined,
      paddingLeft: `${desktopLeft ? Math.round(Math.max(0, desktopRect.left - desktopParentRect.left) * 100) / 100 : 0}px`,
      paddingLeftTablet: plan.hasTablet ? `${tabletLeft ? Math.round(Math.max(0, tabletRect.left - tabletParentRect.left) * 100) / 100 : 0}px` : undefined,
      paddingLeftMobile: plan.hasMobile ? `${mobileLeft ? Math.round(Math.max(0, mobileRect.left - mobileParentRect.left) * 100) / 100 : 0}px` : undefined,
      ...(usesSignedOverlayMargins
        ? {
          marginTop: `${Math.round(desktopTopInset * 100) / 100}px`,
          marginTopTablet: plan.hasTablet ? tabletNormalFlow ? '0px' : `${Math.round(tabletTopInset * 100) / 100}px` : undefined,
          marginTopMobile: plan.hasMobile ? mobileNormalFlow ? '0px' : `${Math.round(mobileTopInset * 100) / 100}px` : undefined,
          marginBottom: `${Math.round(desktopMarginBottom * 100) / 100}px`,
          marginBottomTablet: plan.hasTablet ? tabletNormalFlow ? '0px' : `${Math.round(tabletMarginBottom * 100) / 100}px` : undefined,
          marginBottomMobile: plan.hasMobile ? mobileNormalFlow ? '0px' : `${Math.round(mobileMarginBottom * 100) / 100}px` : undefined,
          paintLayer: 'foreground',
        }
        : {
          minHeight: `${Math.round(desktopParentRect.height * 100) / 100}px`,
          minHeightTablet: plan.hasTablet ? `${Math.round(tabletParentRect.height * 100) / 100}px` : undefined,
          minHeightMobile: plan.hasMobile ? `${Math.round(mobileParentRect.height * 100) / 100}px` : undefined,
          paddingTop: `${Math.round(desktopTopInset * 100) / 100}px`,
          paddingTopTablet: plan.hasTablet ? `${Math.round(tabletTopInset * 100) / 100}px` : undefined,
          paddingTopMobile: plan.hasMobile ? `${Math.round(mobileTopInset * 100) / 100}px` : undefined,
          paddingBottom: `${Math.round(desktopBottomInset * 100) / 100}px`,
          paddingBottomTablet: plan.hasTablet ? `${Math.round(tabletBottomInset * 100) / 100}px` : undefined,
          paddingBottomMobile: plan.hasMobile ? `${Math.round(mobileBottomInset * 100) / 100}px` : undefined,
        }),
      gridColumnStart: 1,
      gridColumnSpan: 1,
      gridRowStart: 1,
      gridRowSpan: 1,
      gridColumnStartTablet: plan.hasTablet ? tabletGridPlacement.columnStart : undefined,
      gridColumnSpanTablet: plan.hasTablet ? tabletGridPlacement.columnSpan : undefined,
      gridRowStartTablet: plan.hasTablet ? tabletGridPlacement.rowStart : undefined,
      gridRowSpanTablet: plan.hasTablet ? tabletGridPlacement.rowSpan : undefined,
      gridColumnStartMobile: plan.hasMobile ? mobileGridPlacement.columnStart : undefined,
      gridColumnSpanMobile: plan.hasMobile ? mobileGridPlacement.columnSpan : undefined,
      gridRowStartMobile: plan.hasMobile ? mobileGridPlacement.rowStart : undefined,
      gridRowSpanMobile: plan.hasMobile ? mobileGridPlacement.rowSpan : undefined,
    });
    if (Array.isArray(orderEntries)) {
      orderEntries.push({
        id: anchor.id,
        key: item.key,
        stackLayer: mixedStack || safeReferenceStackingIndex(desktop.stackingIndex) !== undefined,
        stackingIndex: safeReferenceStackingIndex(desktop.stackingIndex),
        stackingIndexTablet: safeReferenceStackingIndex(item.tablet?.stackingIndex),
        stackingIndexMobile: safeReferenceStackingIndex(item.mobile?.stackingIndex),
        rect: desktop.rect,
        rectTablet: item.tablet?.rect,
        rectMobile: item.mobile?.rect,
      });
    }
    created += 1;

    if (item.kind === 'media') {
      const mediaSource = plan.reuseSourceMedia && String(desktop?.source || '').trim()
        ? String(desktop.source).trim()
        : genericReplacementMediaSource(context, contentIndex, index, false);
      const desktopBorder = Math.max(0, Number.parseFloat(desktop.borderTopWidth || '0'));
      const tabletBorder = Math.max(0, Number.parseFloat(tablet.borderTopWidth || desktop.borderTopWidth || '0'));
      const mobileBorder = Math.max(0, Number.parseFloat(mobile.borderTopWidth || tablet.borderTopWidth || desktop.borderTopWidth || '0'));
      const shellColor = normalizedAuthorableColor(desktop.borderTopColor)
        || normalizedAuthorableColor(desktop.backgroundColor)
        || 'transparent';
      const shell = createCanvasNode(context, containerName, anchor.id, {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: `${Math.round(desktopRect.width * 100) / 100}px`,
        maxWidthTablet: plan.hasTablet ? `${Math.round(tabletRect.width * 100) / 100}px` : undefined,
        maxWidthMobile: plan.hasMobile ? `${Math.round(mobileRect.width * 100) / 100}px` : undefined,
        minHeight: `${Math.round(desktopRect.height * 100) / 100}px`,
        minHeightTablet: plan.hasTablet ? `${Math.round(tabletRect.height * 100) / 100}px` : undefined,
        minHeightMobile: plan.hasMobile ? `${Math.round(mobileRect.height * 100) / 100}px` : undefined,
        paddingTop: `${desktopBorder}px`,
        paddingTopTablet: plan.hasTablet ? `${tabletBorder}px` : undefined,
        paddingTopMobile: plan.hasMobile ? `${mobileBorder}px` : undefined,
        paddingRight: `${desktopBorder}px`,
        paddingRightTablet: plan.hasTablet ? `${tabletBorder}px` : undefined,
        paddingRightMobile: plan.hasMobile ? `${mobileBorder}px` : undefined,
        paddingBottom: `${desktopBorder}px`,
        paddingBottomTablet: plan.hasTablet ? `${tabletBorder}px` : undefined,
        paddingBottomMobile: plan.hasMobile ? `${mobileBorder}px` : undefined,
        paddingLeft: `${desktopBorder}px`,
        paddingLeftTablet: plan.hasTablet ? `${tabletBorder}px` : undefined,
        paddingLeftMobile: plan.hasMobile ? `${mobileBorder}px` : undefined,
        borderRadius: genericCssMetric(desktop.borderRadius),
        ...genericMeasuredShadowProps(context, containerName, [desktop, tablet, mobile]),
        ...backgroundProps(context, containerName, shellColor),
      });
      createCanvasNode(context, containerName, shell.id, {
        backgroundImage: mediaSource,
        backgroundSize: genericMeasuredMediaFit({ desktop, tablet, mobile }),
        ...genericMeasuredMediaPositionProps({ desktop, tablet, mobile }, plan),
        width: '100%',
        minHeight: `${Math.max(1, Math.round((desktopRect.height - desktopBorder * 2) * 100) / 100)}px`,
        minHeightTablet: plan.hasTablet ? `${Math.max(1, Math.round((tabletRect.height - tabletBorder * 2) * 100) / 100)}px` : undefined,
        minHeightMobile: plan.hasMobile ? `${Math.max(1, Math.round((mobileRect.height - mobileBorder * 2) * 100) / 100)}px` : undefined,
        borderRadius: scalePxLength(desktop.borderRadius, 0.5, '0px'),
      });
      context.genericMeasuredLoweredMediaKeys.add(String(desktop.structureKey || ''));
      created += 2;
      continue;
    }

    const gradientProps = genericMeasuredGradientProps(context, containerName, [desktop, tablet, mobile]);
    const surfaceColor = Object.keys(gradientProps).length > 0
      ? ''
      : genericMeasuredSurfaceColor(desktop, fallbackTextColor);
    const surface = createCanvasNode(context, containerName, anchor.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: genericMeasuredItemGap(desktop),
      gapTablet: plan.hasTablet ? genericMeasuredItemGap(tablet) : undefined,
      gapMobile: plan.hasMobile ? genericMeasuredItemGap(mobile) : undefined,
      width: '100%',
      maxWidth: `${Math.round(desktopRect.width * 100) / 100}px`,
      maxWidthTablet: plan.hasTablet ? `${Math.round(tabletRect.width * 100) / 100}px` : undefined,
      maxWidthMobile: plan.hasMobile ? `${Math.round(mobileRect.width * 100) / 100}px` : undefined,
      minHeight: `${Math.round(desktopRect.height * 100) / 100}px`,
      minHeightTablet: plan.hasTablet ? `${Math.round(tabletRect.height * 100) / 100}px` : undefined,
      minHeightMobile: plan.hasMobile ? `${Math.round(mobileRect.height * 100) / 100}px` : undefined,
      paddingTop: genericCssMetric(desktop.paddingTop),
      paddingTopTablet: plan.hasTablet ? genericCssMetric(tablet.paddingTop) : undefined,
      paddingTopMobile: plan.hasMobile ? genericCssMetric(mobile.paddingTop) : undefined,
      paddingRight: genericCssMetric(desktop.paddingRight),
      paddingRightTablet: plan.hasTablet ? genericCssMetric(tablet.paddingRight) : undefined,
      paddingRightMobile: plan.hasMobile ? genericCssMetric(mobile.paddingRight) : undefined,
      paddingBottom: genericCssMetric(desktop.paddingBottom),
      paddingBottomTablet: plan.hasTablet ? genericCssMetric(tablet.paddingBottom) : undefined,
      paddingBottomMobile: plan.hasMobile ? genericCssMetric(mobile.paddingBottom) : undefined,
      paddingLeft: genericCssMetric(desktop.paddingLeft),
      paddingLeftTablet: plan.hasTablet ? genericCssMetric(tablet.paddingLeft) : undefined,
      paddingLeftMobile: plan.hasMobile ? genericCssMetric(mobile.paddingLeft) : undefined,
      borderRadius: genericCssMetric(desktop.borderRadius),
      ...genericMeasuredUniformBorderProps([desktop, tablet, mobile]),
      ...genericMeasuredShadowProps(context, containerName, [desktop, tablet, mobile]),
      ...backgroundProps(context, containerName, surfaceColor),
      ...gradientProps,
    });
    const overlayTextColor = genericTextColor(gradientProps.gradientColor1 || surfaceColor, fallbackTextColor);
    const overlayOrderEntries = [];
    created += 1 + addGenericMeasuredGroups(
      context,
      surface.id,
      desktop,
      tablet,
      mobile,
      plan,
      overlayTextColor,
      containerName,
      contentIndex * 10 + index,
      overlayOrderEntries
    );
    created += addGenericMeasuredTextItems(
      context,
      surface.id,
      desktop,
      tablet,
      mobile,
      plan,
      overlayTextColor,
      containerName,
      contentIndex * 10 + index,
      overlayOrderEntries
    );
    orderGenericMeasuredChildren(context, surface.id, overlayOrderEntries);
  }

  return created;
}

function orderGenericMeasuredChildren(context, parentId, orderEntries) {
  if (!Array.isArray(orderEntries)) {
    return;
  }
  const orderById = new Map(
    (context.genericMeasuredOrderEntries.get(parentId) || []).map((entry) => [entry.id, entry])
  );
  for (const entry of orderEntries) {
    const definedEntry = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== undefined)
    );
    orderById.set(entry.id, { ...(orderById.get(entry.id) || {}), ...definedEntry });
  }
  const currentEntries = context.nodeMap[parentId].nodes
    .map((nodeId) => orderById.get(nodeId))
    .filter(Boolean);
  context.genericMeasuredOrderEntries.set(parentId, currentEntries);
  if (currentEntries.length < 2) {
    return;
  }
  const stackingEntries = currentEntries.filter((entry) => entry.stackLayer === true);
  const stackingMeasurements = [
    { prop: 'stackingIndex', rectProp: 'rect' },
    { prop: 'stackingIndexTablet', rectProp: 'rectTablet' },
    { prop: 'stackingIndexMobile', rectProp: 'rectMobile' },
  ];
  const stackingProps = stackingMeasurements.map((measurement) => measurement.prop);
  for (let leftIndex = 0; leftIndex < stackingEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < stackingEntries.length; rightIndex += 1) {
      const left = stackingEntries[leftIndex];
      const right = stackingEntries[rightIndex];
      const responsiveOrders = stackingMeasurements.flatMap(({ prop, rectProp }) => {
        const leftStackingIndex = safeReferenceStackingIndex(left[prop]);
        const rightStackingIndex = safeReferenceStackingIndex(right[prop]);
        const leftRect = normalizeReferenceRect(left[rectProp]);
        const rightRect = normalizeReferenceRect(right[rectProp]);
        if (leftStackingIndex === undefined || rightStackingIndex === undefined || !leftRect || !rightRect) {
          return [];
        }
        const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
        const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
        if (overlapWidth <= 1 || overlapHeight <= 1) {
          return [];
        }
        const difference = leftStackingIndex - rightStackingIndex
          || compareReferenceStructureKeys(left.key, right.key);
        return difference === 0 ? [] : [{
          prop,
          direction: Math.sign(difference),
          leftStackingIndex,
          rightStackingIndex,
        }];
      });
      if (new Set(responsiveOrders.map((order) => order.direction)).size > 1) {
        const orderDetails = responsiveOrders.map((order) => (
          `${order.prop}: ${String(left.key || left.id)}=${order.leftStackingIndex}, ${String(right.key || right.id)}=${order.rightStackingIndex}`
        )).join('; ');
        throw new Error(`Generic measured reference contract gaps:\n- [generic_responsive_stacking_order_unsupported] Conflicting pair ${String(left.key || left.id)} <> ${String(right.key || right.id)} changes visible overlap order across breakpoints (${orderDetails}) and cannot be represented by one safe DOM order without a responsive stacking control.`);
      }
    }
  }
  context.nodeMap[parentId].nodes.sort((leftId, rightId) => {
    const left = orderById.get(leftId);
    const right = orderById.get(rightId);
    if (!left || !right) {
      return 0;
    }
    if (left.stackLayer === true && right.stackLayer === true) {
      for (const prop of stackingProps) {
        const leftStackingIndex = safeReferenceStackingIndex(left[prop]);
        const rightStackingIndex = safeReferenceStackingIndex(right[prop]);
        if (leftStackingIndex !== undefined && rightStackingIndex !== undefined && leftStackingIndex !== rightStackingIndex) {
          return leftStackingIndex - rightStackingIndex;
        }
      }
    }
    return compareReferenceStructureKeys(left.key, right.key);
  });
}

function matchedGenericMeasuredGroup(canonical, groups) {
  const candidates = Array.isArray(groups) ? groups : [];
  if (!canonical || !canonical.key) {
    return null;
  }
  return candidates.find((candidate) => candidate?.key === canonical.key) || null;
}

function genericMeasuredResponsiveDisplay(tablet, mobile, plan) {
  if (plan.hasTablet && !tablet && (!plan.hasMobile || !mobile)) {
    return 'hide-tablet-down';
  }
  if (plan.hasMobile && !mobile) {
    return 'hide-mobile';
  }
  return undefined;
}

function addGenericMeasuredTextItems(context, parentId, desktopMeasurement, tabletMeasurement, mobileMeasurement, plan, fallbackTextColor, containerName, contentIndex, orderEntries = null) {
  const desktopTexts = Array.isArray(desktopMeasurement?.texts) ? desktopMeasurement.texts.slice(0, 32) : [];
  let created = 0;

  for (let index = 0; index < desktopTexts.length; index += 1) {
    const desktop = desktopTexts[index];
    const tablet = matchedGenericMeasuredItem(desktop, index, tabletMeasurement?.texts);
    const mobile = matchedGenericMeasuredItem(desktop, index, mobileMeasurement?.texts);
    const fixedTrackRow = genericMeasuredFixedTrackRow([
      desktopMeasurement,
      ...(plan.hasTablet ? [tabletMeasurement || desktopMeasurement] : []),
      ...(plan.hasMobile ? [mobileMeasurement || tabletMeasurement || desktopMeasurement] : []),
    ]);
    const isFixedTrackItem = fixedTrackRow && (
      (fixedTrackRow.fixedItemKey && desktop?.structureKey === fixedTrackRow.fixedItemKey)
      || (!fixedTrackRow.fixedItemKey && index === fixedTrackRow.fixedItemIndex)
    );
    const desktopToken = genericMeasuredGridToken(desktopMeasurement, true);
    const tabletToken = genericMeasuredGridToken(tabletMeasurement || desktopMeasurement, true);
    const mobileToken = genericMeasuredGridToken(mobileMeasurement || tabletMeasurement || desktopMeasurement, true);
    const desktopPlacement = genericGridItemPlacement(desktop, genericMeasurementItems(desktopMeasurement), desktopMeasurement?.rect, desktopToken);
    const tabletPlacement = genericGridItemPlacement(tablet, genericMeasurementItems(tabletMeasurement), tabletMeasurement?.rect, tabletToken);
    const mobilePlacement = genericGridItemPlacement(mobile, genericMeasurementItems(mobileMeasurement), mobileMeasurement?.rect, mobileToken);
    const surfaceColor = normalizedAuthorableColor(desktop?.backgroundColor);
    const desktopPaddingTop = genericCssMetric(desktop?.paddingTop);
    const tabletPaddingTop = genericCssMetric((tablet || desktop)?.paddingTop);
    const mobilePaddingTop = genericCssMetric((mobile || tablet || desktop)?.paddingTop);
    const desktopPaddingBottom = genericCssMetric(desktop?.paddingBottom);
    const tabletPaddingBottom = genericCssMetric((tablet || desktop)?.paddingBottom);
    const mobilePaddingBottom = genericCssMetric((mobile || tablet || desktop)?.paddingBottom);
    const { leaf: marginProps, wrapper: wrapperMarginProps } = genericMeasuredTextMarginProps(
      desktopMeasurement,
      tabletMeasurement || desktopMeasurement,
      mobileMeasurement || tabletMeasurement || desktopMeasurement,
      desktop,
      tablet || desktop,
      mobile || tablet || desktop,
      plan
    );
    const wrapper = createCanvasNode(context, containerName, parentId, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      ...(fixedTrackRow ? {
        width: isFixedTrackItem ? fixedTrackRow.fixedWidth : undefined,
        maxWidth: isFixedTrackItem ? fixedTrackRow.fixedWidth : undefined,
        maxWidthTablet: isFixedTrackItem && plan.hasTablet ? fixedTrackRow.fixedWidth : undefined,
        maxWidthMobile: isFixedTrackItem && plan.hasMobile ? fixedTrackRow.fixedWidth : undefined,
        minWidth: isFixedTrackItem ? fixedTrackRow.fixedWidth : '0px',
        flexGrow: isFixedTrackItem ? 0 : 1,
        flexShrink: isFixedTrackItem ? 0 : 1,
        flexBasis: isFixedTrackItem ? fixedTrackRow.fixedWidth : '0px',
      } : {
        gridColumnStart: desktopPlacement.columnStart,
        gridColumnSpan: desktopPlacement.columnSpan,
        gridRowStart: desktopPlacement.rowStart,
        gridRowSpan: desktopPlacement.rowSpan,
        gridColumnStartTablet: plan.hasTablet ? tabletPlacement.columnStart : undefined,
        gridColumnSpanTablet: plan.hasTablet ? tabletPlacement.columnSpan : undefined,
        gridRowStartTablet: plan.hasTablet ? tabletPlacement.rowStart : undefined,
        gridRowSpanTablet: plan.hasTablet ? tabletPlacement.rowSpan : undefined,
        gridColumnStartMobile: plan.hasMobile ? mobilePlacement.columnStart : undefined,
        gridColumnSpanMobile: plan.hasMobile ? mobilePlacement.columnSpan : undefined,
        gridRowStartMobile: plan.hasMobile ? mobilePlacement.rowStart : undefined,
        gridRowSpanMobile: plan.hasMobile ? mobilePlacement.rowSpan : undefined,
        maxWidth: genericMeasuredRectSize(desktop, 'width'),
        maxWidthTablet: plan.hasTablet ? genericMeasuredRectSize(tablet || desktop, 'width') : undefined,
        maxWidthMobile: plan.hasMobile ? genericMeasuredRectSize(mobile || tablet || desktop, 'width') : undefined,
      }),
      minHeight: genericMeasuredRectSize(desktop, 'height'),
      minHeightTablet: plan.hasTablet ? genericMeasuredRectSize(tablet || desktop, 'height') : undefined,
      minHeightMobile: plan.hasMobile ? genericMeasuredRectSize(mobile || tablet || desktop, 'height') : undefined,
      paddingTop: desktopPaddingTop,
      paddingTopTablet: plan.hasTablet ? tabletPaddingTop : undefined,
      paddingTopMobile: plan.hasMobile ? mobilePaddingTop : undefined,
      paddingRight: genericCssMetric(desktop?.paddingRight),
      paddingBottom: desktopPaddingBottom,
      paddingBottomTablet: plan.hasTablet ? tabletPaddingBottom : undefined,
      paddingBottomMobile: plan.hasMobile ? mobilePaddingBottom : undefined,
      paddingLeft: genericCssMetric(desktop?.paddingLeft),
      borderRadius: genericCssMetric(desktop?.borderRadius),
      ...wrapperMarginProps,
      ...genericMeasuredUniformBorderProps([desktop, tablet || desktop, mobile || tablet || desktop]),
      ...genericMeasuredShadowProps(context, containerName, [desktop, tablet || desktop, mobile || tablet || desktop]),
      ...backgroundProps(context, containerName, surfaceColor),
    });
    if (Array.isArray(orderEntries) && desktop?.structureKey) {
      orderEntries.push({ id: wrapper.id, key: desktop.structureKey });
    }
    if (desktop?.structureKey) {
      context.genericMeasuredNodeKeys.set(wrapper.id, desktop.structureKey);
    }
    addGenericMeasuredTextNode(
      context,
      wrapper.id,
      desktop,
      tablet,
      mobile,
      plan,
      fallbackTextColor,
      contentIndex,
      index,
      marginProps
    );
    created += 2;
  }

  return created;
}

function addGenericMeasuredTextNode(context, parentId, desktop, tablet, mobile, plan, fallbackTextColor, contentIndex, textIndex, marginProps) {
  const tag = String(desktop?.tag || '').toLowerCase();
  const text = genericMeasuredAuthoringText(desktop, plan, contentIndex, textIndex);
  const props = {
    fontSize: genericFontSize(desktop, /^h[1-4]$/.test(tag) ? 36 : 16),
    fontSizeTablet: plan.hasTablet ? genericFontSize(tablet || desktop, /^h[1-4]$/.test(tag) ? 32 : 16) : undefined,
    fontSizeMobile: plan.hasMobile ? genericFontSize(mobile || tablet || desktop, /^h[1-4]$/.test(tag) ? 28 : 16) : undefined,
    lineHeight: genericMeasuredLineHeight(desktop, /^h[1-4]$/.test(tag) ? '1.1' : '1.6'),
    lineHeightTablet: plan.hasTablet ? genericMeasuredLineHeight(tablet || desktop, /^h[1-4]$/.test(tag) ? '1.12' : '1.6') : undefined,
    lineHeightMobile: plan.hasMobile ? genericMeasuredLineHeight(mobile || tablet || desktop, /^h[1-4]$/.test(tag) ? '1.15' : '1.6') : undefined,
    fontWeight: genericFontWeight(desktop, /^h[1-4]$/.test(tag) ? '700' : '400'),
    fontFamily: genericMeasuredFontFamily(desktop, context.warnings),
    ...genericMeasuredLetterSpacing(desktop, tablet, mobile),
    textAlign: genericMeasuredTextAlign(desktop?.textAlign),
    textAlignTablet: plan.hasTablet ? genericMeasuredTextAlign(tablet?.textAlign) : undefined,
    textAlignMobile: plan.hasMobile ? genericMeasuredTextAlign(mobile?.textAlign) : undefined,
    textTransform: genericMeasuredTextTransform(desktop?.textTransform),
    textColor: normalizedAuthorableColor(desktop?.color) || fallbackTextColor,
    ...marginProps,
  };

  if (tag === 'a' || tag === 'button') {
    addButton(context, parentId, text, '#', {
      ...props,
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
      borderRadius: '0px',
      backgroundColor: 'transparent',
    });
    return;
  }
  if (/^h[1-4]$/.test(tag)) {
    const multilineProps = genericMeasuredMultilineHeadingProps(
      context,
      desktop,
      tablet,
      mobile,
      plan,
      fallbackTextColor,
      contentIndex,
      textIndex,
      props
    );
    if (multilineProps) {
      createLeafNode(context, multilineProps.componentName, parentId, multilineProps.props);
      return;
    }
    assertGenericMeasuredTextMarginContract(context, 'Heading', marginProps);
    addHeading(context, parentId, text, tag, props);
    return;
  }
  assertGenericMeasuredTextMarginContract(context, 'Text', marginProps);
  addText(context, parentId, text, props);
}

function genericMeasuredMultilineHeadingProps(context, desktop, tablet, mobile, plan, fallbackTextColor, contentIndex, textIndex, headingProps) {
  const component = findComponent(context.contractIndex, ['MultilineHeading']);
  const tag = String(desktop?.tag || '').toLowerCase();
  if (!component || !/^h[1-3]$/.test(tag)) {
    return null;
  }

  const itemProps = component.repeaterItemProps?.get('lines') || new Set();
  const itemRules = component.repeaterItemRules?.get('lines') || new Map();
  const requiredItemProps = ['text', 'color', 'marginLeft', 'marginLeftTablet', 'marginLeftMobile'];
  const requiredOffsetUnits = ['px', 'rem', 'em', 'vw', '%'];
  if (!requiredItemProps.every((prop) => itemProps.has(prop))) {
    return null;
  }
  for (const prop of ['marginLeft', 'marginLeftTablet', 'marginLeftMobile']) {
    const rule = itemRules.get(prop);
    if (rule?.type !== 'css-value'
      || !Array.isArray(rule.units)
      || !requiredOffsetUnits.every((unit) => rule.units.includes(unit))
      || !Number.isFinite(rule.min)
      || Number(rule.min) >= 0
      || (Number.isFinite(rule.max) && Number(rule.max) <= 0)) {
      return null;
    }
  }

  const viewportEvidence = [
    { role: 'desktop', box: desktop },
    ...(plan.hasTablet ? [{ role: 'tablet', box: tablet }] : []),
    ...(plan.hasMobile ? [{ role: 'mobile', box: mobile }] : []),
  ].map(({ role, box }) => ({ role, evidence: genericMeasuredLineEvidence(box) }));
  if (viewportEvidence.some(({ evidence }) => !evidence)) {
    return null;
  }

  const fullText = viewportEvidence[0].evidence.text;
  if (viewportEvidence.some(({ evidence }) => evidence.text !== fullText)) {
    return null;
  }

  let stableBoundaries = new Set(viewportEvidence[0].evidence.lines.slice(0, -1).map((line) => line.end));
  if (viewportEvidence.length > 1) {
    for (const { evidence } of viewportEvidence.slice(1)) {
      const boundaries = new Set(evidence.lines.slice(0, -1).map((line) => line.end));
      stableBoundaries = new Set([...stableBoundaries].filter((boundary) => boundaries.has(boundary)));
    }
  } else {
    stableBoundaries = new Set(viewportEvidence[0].evidence.lines.slice(0, -1)
      .filter((line, index, lines) => {
        const nextLine = lines[index + 1];
        return nextLine && Math.abs(line.rect.left - nextLine.rect.left) > 4;
      })
      .map((line) => line.end));
  }

  const endpoints = [...stableBoundaries].sort((left, right) => left - right).concat(fullText.length);
  if (endpoints.length < 2 || endpoints.length > 12) {
    return null;
  }

  const groupedEvidence = viewportEvidence.map(({ role, evidence }) => {
    let startIndex = 0;
    const groups = endpoints.map((endpoint) => {
      const endIndex = evidence.lines.findIndex((line, index) => index >= startIndex && line.end === endpoint);
      if (endIndex < startIndex) {
        return null;
      }
      const lines = evidence.lines.slice(startIndex, endIndex + 1);
      startIndex = endIndex + 1;
      const offsets = lines.map((line) => line.rect.left - evidence.rect.left);
      if (Math.max(...offsets) - Math.min(...offsets) > 4) {
        return null;
      }
      return {
        text: lines.map((line) => line.text).join(' '),
        offset: Math.round(offsets[0] * 100) / 100,
      };
    });
    return groups.some((group) => !group) ? null : { role, groups };
  });
  if (groupedEvidence.some((entry) => !entry)) {
    return null;
  }

  const materiallyOffset = groupedEvidence.some(({ groups }) => {
    const offsets = groups.map((group) => group.offset);
    return Math.max(...offsets) - Math.min(...offsets) >= 12;
  });
  if (!materiallyOffset) {
    return null;
  }

  const authoringProps = new Set(component.authoringProps || []);
  const rootProps = { ...headingProps };
  delete rootProps.textColor;
  const requiredRootProps = Object.entries({ ...rootProps, lines: true, tag })
    .filter(([, value]) => typeof value !== 'undefined' && value !== null && value !== '')
    .map(([prop]) => prop);
  if (!requiredRootProps.every((prop) => authoringProps.has(prop))) {
    return null;
  }

  const evidenceByRole = new Map(groupedEvidence.map(({ role, groups }) => [role, groups]));
  const desktopGroups = evidenceByRole.get('desktop');
  const tabletGroups = evidenceByRole.get('tablet') || desktopGroups;
  const mobileGroups = evidenceByRole.get('mobile') || tabletGroups;
  const controlledOffsetGroups = [
    ['marginLeft', desktopGroups],
    ['marginLeftTablet', tabletGroups],
    ['marginLeftMobile', mobileGroups],
  ];
  for (const [prop, groups] of controlledOffsetGroups) {
    const rule = itemRules.get(prop);
    const minimum = Number.isFinite(rule?.min) ? Number(rule.min) : null;
    const maximum = Number.isFinite(rule?.max) ? Number(rule.max) : null;
    const step = Number.isFinite(rule?.step) && Number(rule.step) > 0 ? Number(rule.step) : null;
    const stepBase = minimum ?? 0;
    const violatesControl = groups.some(({ offset }) => {
      if ((minimum !== null && offset < minimum) || (maximum !== null && offset > maximum)) {
        return true;
      }
      if (step === null) {
        return false;
      }
      const steps = (offset - stepBase) / step;
      const tolerance = 1e-8 * Math.max(1, Math.abs(steps));
      return Math.abs(steps - Math.round(steps)) > tolerance;
    });
    if (violatesControl) {
      return null;
    }
  }
  const color = normalizedAuthorableColor(desktop?.color) || fallbackTextColor;
  const lines = desktopGroups.map((group, index) => {
    const line = {
      text: plan.preserveSourceText
        ? group.text
        : genericMeasuredReplacementCopy(group.text, tag, contentIndex + textIndex + index),
      color,
      marginLeft: `${group.offset}px`,
    };
    let inheritedOffset = group.offset;
    if (plan.hasTablet && tabletGroups[index].offset !== inheritedOffset) {
      line.marginLeftTablet = `${tabletGroups[index].offset}px`;
      inheritedOffset = tabletGroups[index].offset;
    }
    if (plan.hasMobile && mobileGroups[index].offset !== inheritedOffset) {
      line.marginLeftMobile = `${mobileGroups[index].offset}px`;
    }
    return line;
  });

  return {
    componentName: component.name,
    props: {
      ...rootProps,
      lines,
      tag,
    },
  };
}

function genericMeasuredLineEvidence(box) {
  const text = String(box?.text || '').trim().replace(/\s+/gu, ' ');
  const rect = normalizeReferenceRect(box?.rect);
  const textAlign = String(box?.textAlign || '').trim().toLowerCase();
  const rawLines = Array.isArray(box?.lines) ? box.lines : [];
  if (!text || !rect || !['', 'left', 'start'].includes(textAlign) || rawLines.length < 2 || rawLines.length > 24) {
    return null;
  }

  let end = 0;
  const lines = [];
  for (const rawLine of rawLines) {
    const lineText = String(rawLine?.text || '').trim().replace(/\s+/gu, ' ');
    const lineRect = normalizeReferenceRect(rawLine?.rect);
    if (!lineText || !lineRect) {
      return null;
    }
    end += (lines.length > 0 ? 1 : 0) + lineText.length;
    lines.push({ text: lineText, rect: lineRect, end });
  }
  if (lines.map((line) => line.text).join(' ') !== text) {
    return null;
  }

  return { text, rect, lines };
}

function genericMeasuredTextMarginProps(desktopParent, tabletParent, mobileParent, desktop, tablet, mobile, plan) {
  const desktopTop = genericMeasuredTextTopResidual(desktopParent, desktop);
  const desktopBottom = '0px';
  const tabletTop = genericMeasuredTextTopResidual(tabletParent, tablet);
  const tabletBottom = '0px';
  const mobileTop = genericMeasuredTextTopResidual(mobileParent, mobile);
  const mobileBottom = '0px';
  const leaf = {
    marginTop: desktopTop,
    marginBottom: desktopBottom,
  };
  let inheritedTop = desktopTop;
  let inheritedBottom = desktopBottom;

  if (plan.hasTablet) {
    if (tabletTop !== inheritedTop) {
      leaf.marginTopTablet = tabletTop;
      inheritedTop = tabletTop;
    }
    if (tabletBottom !== inheritedBottom) {
      leaf.marginBottomTablet = tabletBottom;
      inheritedBottom = tabletBottom;
    }
  }
  if (plan.hasMobile) {
    if (mobileTop !== inheritedTop) {
      leaf.marginTopMobile = mobileTop;
    }
    if (mobileBottom !== inheritedBottom) {
      leaf.marginBottomMobile = mobileBottom;
    }
  }

  const horizontalOffsets = [
    [desktopParent, desktop],
    [tabletParent, tablet],
    [mobileParent, mobile],
  ].map(([parent, item]) => {
    const parentRect = normalizeReferenceRect(parent?.rect);
    const itemRect = normalizeReferenceRect(item?.rect);
    if (!parentRect || !itemRect || genericMeasuredDisplay(parent) === 'grid') {
      return '0px';
    }
    const direction = genericMeasuredFlexDirection(parent);
    if (!['column', 'column-reverse'].includes(direction)) {
      return '0px';
    }
    const isBandMeasurement = Number.isFinite(Number(parent?.viewportWidth)) && Number(parent.viewportWidth) > 0;
    const leftPadding = pxNumber(isBandMeasurement
      ? genericBandFrameHorizontalPadding(parent, 'left')
      : genericCssMetric(parent?.paddingLeft) || '0px');
    const rightPadding = pxNumber(isBandMeasurement
      ? genericBandFrameHorizontalPadding(parent, 'right')
      : genericCssMetric(parent?.paddingRight) || '0px');
    if (leftPadding === null || rightPadding === null) {
      return '0px';
    }
    const contentWidth = parentRect.width - leftPadding - rightPadding;
    const offset = itemRect.left - parentRect.left - leftPadding;
    const maximumInset = Math.min(1440, Math.max(0, contentWidth - itemRect.width));
    const contained = itemRect.left >= parentRect.left - 3
      && itemRect.left + itemRect.width <= parentRect.left + parentRect.width + 3;
    if (!contained || !Number.isFinite(offset) || offset <= 3 || offset > maximumInset + 3) {
      return '0px';
    }
    return `${Math.round(offset * 100) / 100}px`;
  });
  const wrapper = {};
  const desktopLeft = horizontalOffsets[0];
  if (horizontalOffsets.some((offset) => offset !== '0px')) {
    wrapper.marginLeft = desktopLeft;
    let inheritedLeft = desktopLeft;
    if (plan.hasTablet && horizontalOffsets[1] !== inheritedLeft) {
      wrapper.marginLeftTablet = horizontalOffsets[1];
      inheritedLeft = horizontalOffsets[1];
    }
    if (plan.hasMobile && horizontalOffsets[2] !== inheritedLeft) {
      wrapper.marginLeftMobile = horizontalOffsets[2];
    }
  }

  return { leaf, wrapper };
}

function genericMeasuredTextTopResidual(measurement, item) {
  const distributedAlignment = ['space-between', 'space-around', 'space-evenly']
    .includes(genericMeasuredJustifyContent(measurement));
  if (!measurement || !item || genericMeasuredDisplay(measurement) === 'grid' || distributedAlignment) {
    return '0px';
  }
  const entries = genericMeasurementItems(measurement)
    .map((source) => ({ source, rect: normalizeReferenceRect(source?.rect) }))
    .filter((entry) => entry.rect)
    .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);
  const structureKey = String(item?.structureKey || '');
  const itemIndex = entries.findIndex((entry) => (
    entry.source === item
    || (structureKey && String(entry.source?.structureKey || '') === structureKey)
  ));
  if (itemIndex <= 0) {
    return '0px';
  }

  const previousRect = entries
    .slice(0, itemIndex)
    .map((entry) => entry.rect)
    .sort((left, right) => right.bottom - left.bottom)[0];
  const currentRect = entries[itemIndex].rect;
  if (referenceRectsShareRow(previousRect, currentRect)) {
    return '0px';
  }
  const observedGap = currentRect.top - previousRect.bottom;
  const parentGap = Number.parseFloat(genericMeasuredLayoutGap(measurement)) || 0;
  const residual = Math.round(Math.max(0, observedGap - parentGap));
  return `${residual}px`;
}

function assertGenericMeasuredTextMarginContract(context, componentName, marginProps) {
  const component = context.contractIndex.get(componentName);
  const allowed = new Set(component?.authoringProps || []);
  const requiredProps = Object.entries(marginProps)
    .filter(([prop, value]) => prop.endsWith('Tablet') || prop.endsWith('Mobile') || Number.parseFloat(value) !== 0)
    .map(([prop]) => prop);
  const missingProps = requiredProps.filter((prop) => !allowed.has(prop));
  if (missingProps.length > 0) {
    throw new Error(`Generic measured reference contract gaps:\n- [generic_typography_margin_control_gap] ${componentName} is missing measured vertical margin controls: ${missingProps.join(', ')}.`);
  }
}

function genericMeasuredAuthoringText(box, plan, contentIndex, textIndex) {
  const source = String(box?.text || '').trim();
  if (plan.preserveSourceText && source) {
    return source;
  }
  const tag = String(box?.tag || '').toLowerCase();
  if (/^\d{1,4}$/.test(source)) {
    return String(textIndex + 1).padStart(source.length, '0');
  }
  return genericMeasuredReplacementCopy(source, tag, contentIndex + textIndex);
}

function genericMeasuredReplacementCopy(source, tag, seed) {
  const targetLength = Math.max(1, Math.min(180, Array.from(source).length));
  if (targetLength <= 2) {
    return targetLength === 1 ? '|' : 'OK';
  }

  const headings = GENERIC_BAND_CONTENT.map((copy) => copy[0]);
  const body = GENERIC_BAND_CONTENT.map((copy) => copy[1]);
  let candidates = GENERIC_SHORT_COPY.concat(body);
  if (/^h[1-6]$/u.test(tag)) {
    candidates = headings;
  } else if (tag === 'a' || tag === 'button') {
    candidates = GENERIC_CTA_COPY;
  } else if (/\d/u.test(source)) {
    candidates = GENERIC_STAT_COPY.concat(GENERIC_SHORT_COPY);
  }

  const normalizedSeed = Math.abs(Number(seed) || 0);
  const expanded = candidates.concat(
    body.map((copy, index) => `${copy} ${body[(index + normalizedSeed + 1) % body.length]}`)
  );
  return expanded
    .map((value, index) => {
      const length = Array.from(value).length;
      const overflow = Math.max(0, length - targetLength);
      return {
        value,
        score: Math.abs(length - targetLength) + overflow * 2,
        order: (index - normalizedSeed + expanded.length) % expanded.length,
      };
    })
    .sort((left, right) => left.score - right.score || left.order - right.order)[0].value;
}

function matchedGenericMeasuredItem(canonical, index, items) {
  const candidates = Array.isArray(items) ? items : [];
  if (!canonical || candidates.length === 0) {
    return canonical || null;
  }
  const text = String(canonical.text || '').trim();
  const tag = String(canonical.tag || '').toLowerCase();
  if (text) {
    const exact = candidates.find((candidate) => (
      String(candidate?.text || '').trim() === text
      && String(candidate?.tag || '').toLowerCase() === tag
    ));
    if (exact) {
      return exact;
    }
  }
  const childHeading = Array.isArray(canonical.texts)
    ? canonical.texts.find((item) => /^h[1-4]$/i.test(String(item?.tag || '')))?.text
    : '';
  if (childHeading) {
    const exactChild = candidates.find((candidate) => Array.isArray(candidate?.texts) && candidate.texts.some((item) => item?.text === childHeading));
    if (exactChild) {
      return exactChild;
    }
  }
  return candidates[index] || candidates.find((candidate) => String(candidate?.tag || '').toLowerCase() === tag) || canonical;
}

function genericGridItemPlacement(item, siblings, containerRect, token) {
  const rect = normalizeReferenceRect(item?.rect);
  const bounds = normalizeReferenceRect(containerRect);
  const tracks = genericGridTrackCount(token);
  if (!rect || !bounds) {
    return { columnStart: 1, columnSpan: tracks, rowStart: 1, rowSpan: 1 };
  }
  if (/^sidebar-(?:left|right)-\d+$/.test(token)) {
    const columnStart = rect.left + rect.width / 2 < bounds.left + bounds.width / 2 ? 1 : 2;
    const rows = genericMeasuredRows(siblings);
    const rowStartIndex = Math.max(0, rows.findIndex((row) => referenceRectsShareRow(row.rect, rect)));
    return { columnStart, columnSpan: 1, rowStart: rowStartIndex + 1, rowSpan: 1 };
  }
  const leftRatio = Math.max(0, Math.min(1, (rect.left - bounds.left) / bounds.width));
  const rightRatio = Math.max(leftRatio, Math.min(1, (rect.right - bounds.left) / bounds.width));
  const columnStart = tracks === 1 ? 1 : Math.max(1, Math.min(tracks, Math.round(leftRatio * tracks) + 1));
  const columnEnd = tracks === 1 ? 1 : Math.max(columnStart, Math.min(tracks, Math.ceil(rightRatio * tracks)));
  const rows = genericMeasuredRows(siblings);
  const rowStartIndex = Math.max(0, rows.findIndex((row) => referenceRectsShareRow(row.rect, rect)));
  const rowStart = rowStartIndex + 1;
  const rowSpan = Math.max(1, rows.filter((row, rowIndex) => rowIndex >= rowStartIndex && row.rect.top < rect.bottom - 3).length);
  return {
    columnStart,
    columnSpan: Math.max(1, columnEnd - columnStart + 1),
    rowStart,
    rowSpan,
  };
}

function genericGridTrackCount(token) {
  return {
    one: 1,
    two: 2,
    [PROPORTIONAL_GRID_TOKEN]: 2,
    three: 3,
    four: 4,
    six: 6,
  }[token] || (/^sidebar-(?:left|right)-\d+$/.test(token) ? 2 : 6);
}

function genericMeasuredRows(items) {
  const rows = [];
  const rects = (Array.isArray(items) ? items : [])
    .map((item) => normalizeReferenceRect(item?.rect))
    .filter(Boolean)
    .sort((left, right) => left.top - right.top || left.left - right.left);
  for (const rect of rects) {
    const row = rows.find((candidate) => referenceRectsShareRow(candidate.rect, rect));
    if (!row) {
      rows.push({ rect: { ...rect } });
      continue;
    }
    row.rect.top = Math.max(row.rect.top, rect.top);
    row.rect.bottom = Math.min(row.rect.bottom, rect.bottom);
    row.rect.height = row.rect.bottom - row.rect.top;
  }
  return rows;
}

function genericMeasuredRectSize(item, dimension) {
  const layoutDimension = dimension === 'width' ? 'layoutWidth' : 'layoutHeight';
  const rawValue = Number(item?.[layoutDimension] || item?.rect?.[dimension] || 0);
  const value = dimension === 'width'
    ? Math.ceil(rawValue * 100) / 100
    : Math.round(rawValue);
  return value > 0 ? `${value}px` : undefined;
}

function genericMeasuredItemGap(measurement) {
  const items = genericMeasurementItems(measurement);
  const gaps = [];
  const sorted = items
    .map((item) => normalizeReferenceRect(item?.rect))
    .filter(Boolean)
    .sort((left, right) => left.top - right.top || left.left - right.left);
  for (let index = 1; index < sorted.length; index += 1) {
    const horizontal = sorted[index].left - sorted[index - 1].right;
    const vertical = sorted[index].top - sorted[index - 1].bottom;
    if (horizontal >= 0 && referenceRectsShareRow(sorted[index - 1], sorted[index])) {
      gaps.push(horizontal);
    } else if (vertical >= 0) {
      gaps.push(vertical);
    }
  }
  const value = gaps.length > 0 ? Math.min(...gaps) : 14;
  return `${Math.round(Math.max(0, Math.min(48, value)))}px`;
}

function genericMeasuredSurfaceColor(measurement, fallbackDark) {
  const sourceColor = String(measurement?.backgroundColor || '').trim();
  if (measurement?.paintedBackground !== true && (
    sourceColor.toLowerCase() === 'transparent'
    || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/iu.test(sourceColor)
  )) {
    return '';
  }
  const color = normalizedAuthorableColor(sourceColor);
  if (color) {
    return color;
  }
  const textColors = Array.isArray(measurement?.texts)
    ? measurement.texts.map((item) => normalizedAuthorableColor(item?.color)).filter(Boolean)
    : [];
  const lightText = textColors.some((textColor) => {
    const channels = colorChannels(textColor);
    return channels && (channels[0] + channels[1] + channels[2]) / 3 > 205;
  });
  return lightText || measurement?.paintedBackground === true ? fallbackDark : '';
}

function genericMeasuredLineHeight(box, fallback) {
  const value = String(box?.lineHeight || '').trim();
  if (/^(?:\d+(?:\.\d+)?|\d+(?:\.\d+)?(?:px|rem|em|%))$/.test(value)) {
    return value;
  }
  if (value.toLowerCase() !== 'normal' || !Array.isArray(box?.lines) || box.lines.length === 0) {
    return fallback;
  }
  const lineRects = box.lines.map((line) => normalizeReferenceRect(line?.rect)).filter(Boolean);
  const measuredSteps = lineRects.slice(1)
    .map((rect, index) => rect.top - lineRects[index].top)
    .filter((step) => Number.isFinite(step) && step > 0);
  const measured = measuredSteps.length > 0
    ? measuredSteps.reduce((sum, step) => sum + step, 0) / measuredSteps.length
    : lineRects[0]?.height;
  return Number.isFinite(measured) && measured > 0 ? `${Math.round(measured * 1000) / 1000}px` : fallback;
}

function genericMeasuredLetterSpacing(desktop, tablet, mobile) {
  const boxes = [desktop, tablet, mobile];
  const values = boxes.map((box) => {
    const value = String(box?.letterSpacing || '').trim().toLowerCase();
    return /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em)$/u.test(value) ? value : '';
  });
  const desktopValue = values[0];
  const desktopSize = Number.parseFloat(String(desktop?.fontSize || ''));
  const desktopPixels = Number.parseFloat(desktopValue);
  const ratio = desktopValue.endsWith('px') && Number.isFinite(desktopSize) && desktopSize > 0 && Number.isFinite(desktopPixels)
    ? desktopPixels / desktopSize
    : null;
  const responsiveBoxes = boxes.slice(1).map((box, index) => ({ box, value: values[index + 1] })).filter(({ box }) => box);
  const ratioIsStable = ratio !== null && responsiveBoxes.every(({ box, value }) => {
    const size = Number.parseFloat(String(box?.fontSize || ''));
    const pixels = Number.parseFloat(value);
    return value.endsWith('px')
      && Number.isFinite(size)
      && size > 0
      && Number.isFinite(pixels)
      && Math.abs((pixels / size) - ratio) <= 0.0005;
  });
  if (ratioIsStable) {
    return { letterSpacing: `${Math.round(ratio * 10000) / 10000}em` };
  }

  const tabletValue = values[1];
  const mobileValue = values[2];
  return {
    letterSpacing: desktopValue || undefined,
    letterSpacingTablet: tabletValue && tabletValue !== desktopValue ? tabletValue : undefined,
    letterSpacingMobile: mobileValue && mobileValue !== (tabletValue || desktopValue) ? mobileValue : undefined,
  };
}

function genericMeasuredFontFamily(box, warnings) {
  const source = String(box?.fontFamily || '').trim();
  const warning = 'Measured font evidence had no authorable system fallback; fontFamily was omitted.';
  const safeStack = safeCapturedFontFamily(source);
  if (!safeStack) {
    if (source && Object.prototype.hasOwnProperty.call(box, 'primaryFontEvidence')
      && Array.isArray(warnings) && !warnings.includes(warning)) {
      warnings.push(warning);
    }
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(box, 'primaryFontEvidence')) {
    return source;
  }

  const evidence = ['loaded-face', 'system-family', 'failed-face', 'unknown'].includes(box.primaryFontEvidence)
    ? box.primaryFontEvidence
    : 'unknown';
  const families = safeStack
    .split(',')
    .map((family) => family.trim().replace(/^"|"$/g, ''));
  const normalizedFamilies = families.map((family) => family.replace(/_/g, ' ').replace(/\s+/g, ' ').toLowerCase());
  let authoredFamily;
  if (evidence === 'system-family') {
    authoredFamily = SYSTEM_FONT_CANONICAL_VALUES.get(normalizedFamilies[0]);
  } else if (evidence === 'loaded-face') {
    authoredFamily = googleFontToken(families[0]);
  }

  if (!authoredFamily) {
    authoredFamily = normalizedFamilies
      .slice(1)
      .map((family) => SYSTEM_FONT_CANONICAL_VALUES.get(family))
      .find(Boolean);
  }
  if (authoredFamily) {
    return authoredFamily;
  }

  if (Array.isArray(warnings) && !warnings.includes(warning)) {
    warnings.push(warning);
  }
  return undefined;
}

function genericMeasuredTextAlign(value) {
  const align = String(value || '').trim().toLowerCase();
  return ['', 'left', 'center', 'right', 'justify'].includes(align) ? align || undefined : undefined;
}

function genericMeasuredTextTransform(value) {
  const transform = String(value || '').trim().toLowerCase();
  return ['', 'none', 'uppercase', 'lowercase', 'capitalize'].includes(transform) ? transform || undefined : undefined;
}

function genericCssMetric(value) {
  const metric = String(value || '').trim();
  return /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))$/.test(metric) ? metric : undefined;
}

function addGenericBandCopy(context, parentId, band, textColor) {
  const copy = GENERIC_BAND_CONTENT[band.index % GENERIC_BAND_CONTENT.length];
  const desktopHeading = band.desktop?.heading;
  const tabletHeading = band.tablet?.heading || desktopHeading;
  const mobileHeading = band.mobile?.heading || tabletHeading || desktopHeading;
  const desktopBody = band.desktop?.body;
  const tabletBody = band.tablet?.body || desktopBody;
  const mobileBody = band.mobile?.body || tabletBody || desktopBody;
  const copyWrap = createCanvasNode(context, requireComponent(context, ['Container']), parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });

  addHeading(context, copyWrap.id, copy[0], band.primaryHeading ? 'h1' : 'h2', {
    fontSize: genericFontSize(desktopHeading, band.primaryHeading ? 56 : 36),
    fontSizeTablet: band.tablet ? genericFontSize(tabletHeading, band.primaryHeading ? 44 : 32) : undefined,
    fontSizeMobile: band.mobile ? genericFontSize(mobileHeading, band.primaryHeading ? 38 : 28) : undefined,
    lineHeight: '1.1',
    lineHeightTablet: band.tablet ? '1.12' : undefined,
    lineHeightMobile: band.mobile ? '1.15' : undefined,
    fontWeight: genericFontWeight(desktopHeading, band.primaryHeading ? '800' : '700'),
    textColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copyWrap.id, copy[1], {
    fontSize: genericFontSize(desktopBody, 17),
    fontSizeTablet: band.tablet ? genericFontSize(tabletBody, 16) : undefined,
    fontSizeMobile: band.mobile ? genericFontSize(mobileBody, 16) : undefined,
    lineHeight: '1.6',
    lineHeightTablet: band.tablet ? '1.6' : undefined,
    lineHeightMobile: band.mobile ? '1.6' : undefined,
    textColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function genericBandColumnCount(band, viewport) {
  const measurement = band?.[viewport] || band?.desktop;
  const columns = Number(measurement?.columns || 1);
  return Math.max(1, Math.min(4, Math.round(columns)));
}

function genericBandMediaCount(band) {
  return Math.max(
    genericMeasurementMedia(band?.desktop).length || Number(band?.desktop?.mediaCount || 0),
    genericMeasurementMedia(band?.tablet).length || Number(band?.tablet?.mediaCount || 0),
    genericMeasurementMedia(band?.mobile).length || Number(band?.mobile?.mediaCount || 0)
  );
}

function genericBandBackground(band) {
  for (const measurement of [band?.desktop, band?.tablet, band?.mobile]) {
    const color = normalizedAuthorableColor(measurement?.backgroundColor);
    if (color) {
      return color;
    }
  }
  return '';
}

function genericMeasuredGradientProps(context, componentName, measurements) {
  let gradientProps = null;
  for (const measurement of Array.isArray(measurements) ? measurements : []) {
    if (!measurement || measurement.backgroundType !== 'gradient') {
      continue;
    }
    const gradientType = String(measurement.gradientType || '').trim().toLowerCase();
    const gradientColor1 = normalizedAuthorableColor(measurement.gradientColor1);
    const gradientColor2 = normalizedAuthorableColor(measurement.gradientColor2);
    if (!['linear', 'radial'].includes(gradientType) || !gradientColor1 || !gradientColor2) {
      continue;
    }

    if (gradientType === 'linear') {
      const gradientAngle = measurement.gradientAngle;
      if (typeof gradientAngle !== 'number' || !Number.isFinite(gradientAngle) || gradientAngle < 0 || gradientAngle > 360) {
        continue;
      }
      gradientProps = {
        backgroundType: 'gradient',
        gradientType,
        gradientAngle,
        gradientColor1,
        gradientColor2,
      };
    } else {
      gradientProps = {
        backgroundType: 'gradient',
        gradientType,
        gradientColor1,
        gradientColor2,
      };
    }
    if (gradientProps.gradientType === 'linear' && measurement.backgroundAccentType === 'radial') {
      const accentColor1 = normalizedAuthorableColor(measurement.backgroundAccentColor1);
      const accentColor2Source = String(measurement.backgroundAccentColor2 || '').trim();
      const accentColor2 = accentColor2Source.toLowerCase() === 'transparent'
        ? 'transparent'
        : normalizedAuthorableColor(accentColor2Source);
      const accentX = String(measurement.backgroundAccentPositionX || '').trim().toLowerCase();
      const accentY = String(measurement.backgroundAccentPositionY || '').trim().toLowerCase();
      const accentSize = String(measurement.backgroundAccentSize || '').trim().toLowerCase();
      const validX = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|%|vw)$/u.test(accentX);
      const validY = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|%|vh)$/u.test(accentY);
      const validSize = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|%|vw|vh)$/u.test(accentSize);
      if (!accentColor1 || !accentColor2 || !validX || !validY || !validSize) {
        continue;
      }
      Object.assign(gradientProps, {
        backgroundAccentType: 'radial',
        backgroundAccentColor1: accentColor1,
        backgroundAccentColor2: accentColor2,
        backgroundAccentPositionX: accentX,
        backgroundAccentPositionY: accentY,
        backgroundAccentSize: accentSize,
      });
    }
    break;
  }

  if (!gradientProps) {
    return {};
  }
  const entry = context.contractIndex.get(componentName);
  const allowed = new Set(entry?.authoringProps || []);
  const requiredProps = Object.keys(gradientProps);
  if (!requiredProps.every((prop) => allowed.has(prop))) {
    return {};
  }
  for (const prop of ['backgroundType', 'gradientType', 'backgroundAccentType']) {
    if (!Object.prototype.hasOwnProperty.call(gradientProps, prop)) {
      continue;
    }
    const options = entry?.propOptions?.get(prop);
    if (options && options.size > 0 && !options.has(String(gradientProps[prop]))) {
      return {};
    }
  }
  if (gradientProps.gradientType === 'linear') {
    const rule = entry?.propRules?.get('gradientAngle');
    if ((typeof rule?.min === 'number' && gradientProps.gradientAngle < rule.min)
      || (typeof rule?.max === 'number' && gradientProps.gradientAngle > rule.max)) {
      return {};
    }
  }

  const filtered = filterAllowedProps(context, componentName, gradientProps);
  return Object.keys(filtered).length === requiredProps.length ? filtered : {};
}

function normalizedAuthorableColor(value) {
  const color = String(value || '').trim();
  if (isAuthorableBackgroundColor(color)) {
    return color;
  }
  const oklch = color.match(/^oklch\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))(%?)\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s+(none|[+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:deg)?(?:\s*\/\s*(none|[+-]?(?:\d+(?:\.\d+)?|\.\d+))(%?))?\s*\)$/iu);
  if (oklch) {
    const lightness = Math.max(0, Math.min(1, Number(oklch[1]) / (oklch[2] === '%' ? 100 : 1)));
    const chroma = Math.max(0, Number(oklch[3]));
    const hue = (oklch[4].toLowerCase() === 'none' ? 0 : Number(oklch[4])) * Math.PI / 180;
    const alphaValue = !oklch[5] ? 1 : oklch[5].toLowerCase() === 'none' ? 0 : Number(oklch[5]);
    const alpha = Math.max(0, Math.min(1, alphaValue / (oklch[6] === '%' ? 100 : 1)));
    const axisA = chroma * Math.cos(hue);
    const axisB = chroma * Math.sin(hue);
    const lRoot = lightness + 0.3963377774 * axisA + 0.2158037573 * axisB;
    const mRoot = lightness - 0.1055613458 * axisA - 0.0638541728 * axisB;
    const sRoot = lightness - 0.0894841775 * axisA - 1.291485548 * axisB;
    const l = lRoot ** 3;
    const m = mRoot ** 3;
    const s = sRoot ** 3;
    const linearChannels = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const channels = linearChannels.map((channel) => {
      const encoded = channel <= 0.0031308
        ? 12.92 * channel
        : 1.055 * Math.max(0, channel) ** (1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(1, encoded)) * 255);
    });
    if (alpha === 0) {
      return '';
    }
    return alpha < 1
      ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Math.round(alpha * 1000) / 1000})`
      : `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
  }
  const srgb = color.match(/^color\(\s*srgb\s+([01]?(?:\.\d+)?)\s+([01]?(?:\.\d+)?)\s+([01]?(?:\.\d+)?)(?:\s*\/\s*([01]?(?:\.\d+)?))?\s*\)$/i);
  if (!srgb) {
    return '';
  }
  const channels = srgb.slice(1, 4).map((channel) => Math.round(Math.max(0, Math.min(1, Number(channel))) * 255));
  const alpha = typeof srgb[4] === 'string' ? Math.max(0, Math.min(1, Number(srgb[4]))) : 1;
  return alpha < 1
    ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Math.round(alpha * 1000) / 1000})`
    : `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function isAuthorableBackgroundColor(color) {
  const rgb = /^rgba?\(\s*\d{1,3}(?:\.\d+)?%?\s*,\s*\d{1,3}(?:\.\d+)?%?\s*,\s*\d{1,3}(?:\.\d+)?%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
  const hsl = /^hsla?\(\s*-?\d+(?:\.\d+)?(?:deg)?\s*,\s*\d+(?:\.\d+)?%\s*,\s*\d+(?:\.\d+)?%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
  return (/^#[0-9a-f]{3,8}$/i.test(color) || rgb.test(color) || hsl.test(color))
    && !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0(?:\.0+)?\s*\)$/i.test(color);
}

function genericSectionTag(tag) {
  return ['section', 'header', 'footer', 'main', 'article', 'aside', 'nav'].includes(String(tag || '').toLowerCase())
    ? String(tag).toLowerCase()
    : 'section';
}

function genericBandHeight(measurement) {
  const measuredHeight = Number(measurement?.rect?.height || 0);
  const flowHeight = Number(measurement?.flowHeight || measuredHeight || 120);
  const precedingPaintedGap = Number(measurement?.precedingPaintedGap || 0);
  const ownedHeight = measurement?.paintedBackground === true && measuredHeight > 0
    ? measuredHeight
    : flowHeight;
  const height = Math.max(40, Math.round(ownedHeight + Math.max(0, precedingPaintedGap)));
  return `${height}px`;
}

function genericBandContentWidth(measurement) {
  const bandWidth = Number(measurement?.rect?.width || 0);
  const contentWidth = Number(measurement?.contentWidth || 0);
  const measuredWidth = contentWidth > 0
    ? Math.min(contentWidth, bandWidth || contentWidth)
    : bandWidth;
  const width = Math.max(280, Math.min(1440, measuredWidth || 1200));
  return `${Math.round(width)}px`;
}

function genericBandGap(measurement) {
  if (Array.isArray(measurement?.children) && measurement.children.length > 0) {
    return genericMeasuredItemGap(measurement);
  }
  const height = Number(measurement?.rect?.height || 0);
  const gap = Math.max(12, Math.min(48, Math.round(height * 0.045 / 2) * 2));
  return `${gap}px`;
}

function genericBandFrameHorizontalPadding(measurement, edge) {
  const explicitProp = edge === 'right' ? 'paddingRight' : 'paddingLeft';
  const explicit = genericCssMetric(measurement?.[explicitProp]);
  if (explicit !== undefined) {
    return explicit;
  }
  return genericBandHorizontalInset(measurement, edge);
}

function genericBandHorizontalInset(measurement, edge = 'left') {
  const bandRect = normalizeReferenceRect(measurement?.rect);
  const contentBounds = measurement?.contentBounds;
  const bandWidth = Number(bandRect?.width || 0);
  const measured = bandRect && contentBounds
    ? edge === 'right'
      ? bandRect.right - Number(contentBounds.right || bandRect.right)
      : Number(contentBounds.left || bandRect.left) - bandRect.left
    : Number(measurement?.contentInset || 0);
  const inset = measured > 0 ? measured : bandWidth * 0.05;
  const maximum = Math.max(24, Math.min(480, bandWidth * 0.45));
  return `${Math.round(Math.max(16, Math.min(maximum, inset || 24)))}px`;
}

function genericBandVerticalInset(measurement, edge) {
  const rect = measurement?.rect || {};
  const bounds = measurement?.contentBounds;
  const measuredRects = [
    ...(Array.isArray(measurement?.groups) ? measurement.groups : []),
    ...(Array.isArray(measurement?.children) ? measurement.children : []),
    ...(Array.isArray(measurement?.texts) ? measurement.texts : []),
  ].map((item) => normalizeReferenceRect(item?.rect)).filter(Boolean);
  const height = Number(rect.height || 0);
  const measured = measuredRects.length > 0
    ? edge === 'top'
      ? Math.min(...measuredRects.map((itemRect) => itemRect.top)) - Number(rect.top || 0)
      : Number(rect.bottom || 0) - Math.max(...measuredRects.map((itemRect) => itemRect.bottom))
    : edge === 'top'
      ? Number(bounds?.top || 0) - Number(rect.top || 0)
      : Number(rect.bottom || 0) - Number(bounds?.bottom || 0);
  const leadingOffset = edge === 'top' ? Number(measurement?.leadingOffset || 0) : 0;
  const fallback = Math.max(16, Math.min(72, height * 0.08));
  const inset = measuredRects.length > 0
    ? Math.max(0, measured)
    : measured > 0 ? measured : fallback;
  return `${Math.round(Math.max(0, leadingOffset + Math.min(height * 0.3, inset)))}px`;
}

function genericResponsiveStack(desktopColumns, tabletColumns, mobileColumns) {
  if (desktopColumns !== tabletColumns) {
    return 'tablet';
  }
  if (tabletColumns !== mobileColumns || desktopColumns !== mobileColumns) {
    return 'mobile';
  }
  return undefined;
}

function genericMediaHeight(measurement, mediaCount) {
  const bandHeight = Number(measurement?.rect?.height || 0);
  const divisor = Math.max(1, Math.min(3, mediaCount));
  const height = Math.max(140, Math.min(720, bandHeight * (divisor > 1 ? 0.42 : 0.62)));
  return `${Math.round(height)}px`;
}

function genericFontSize(box, fallback) {
  const pixels = pxNumber(String(box?.fontSize || ''));
  const value = pixels === null ? fallback : pixels;
  return `${Math.round(Math.max(1, value))}px`;
}

function genericFontWeight(box, fallback) {
  const value = Number.parseFloat(String(box?.fontWeight || ''));
  return Number.isFinite(value) ? String(Math.max(1, Math.min(1000, value))) : fallback;
}

function genericTextColor(backgroundColor, fallback) {
  const channels = colorChannels(backgroundColor);
  if (!channels) {
    return fallback;
  }
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return luminance < 130 ? '#ffffff' : '#101318';
}

function colorChannels(color) {
  const hex = String(color || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (hex) {
    const value = hex[1].length === 3 ? hex[1].split('').map((item) => item + item).join('') : hex[1];
    return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  }
  const rgb = String(color || '').match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  return rgb ? rgb.slice(1, 4).map(Number) : null;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function requireComponent(context, names) {
  const found = findComponent(context.contractIndex, names);
  if (!found) {
    throw new Error(`Contract is missing required component: ${names.join(', ')}`);
  }

  return found.name;
}

function findComponent(contractIndex, names) {
  for (const name of names) {
    if (contractIndex.has(name)) {
      return contractIndex.get(name);
    }
  }

  return null;
}

function addNavSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidy = isMaidyProfile(context);
  const careglo = context.replacementProfile?.name === 'luxury-car-care';
  const caregloFallback = careglo && context.brief.authoringRequirements?.requireRealReference !== true;
  const caregloRealReference = careglo && !caregloFallback;
  const caregloNavBackground = caregloRealReference ? '#222731' : style.navBackground;
  const caregloAccent = caregloRealReference ? '#ffd0a8' : style.accent;
  const lumen = isLumenProfile(context);
  const optomatta = isOptomattaProfile(context);

  if (maidy) {
    addTopbarSection(context, sectionName, containerName);
  }

  const nav = createCanvasNode(context, sectionName, 'ROOT', {
    tag: maidy || careglo || lumen || optomatta ? 'header' : 'section',
    paddingTop: maidy || careglo || optomatta ? '0px' : lumen ? '18px' : '18px',
    paddingBottom: maidy || careglo || optomatta ? '0px' : lumen ? '10px' : '18px',
    innerMaxWidth: optomatta ? '1440px' : geometry.innerMaxWidth,
    innerPaddingX: optomatta ? '10px' : caregloRealReference ? '24px' : '20px',
    ...backgroundProps(context, sectionName, careglo ? caregloNavBackground : optomatta ? style.navBackground : style.bg),
    ...(lumen
      ? {
        backgroundType: 'gradient',
        gradientType: 'linear',
        gradientAngle: 105,
        gradientColor1: '#e8fbef',
        gradientColor2: '#fbffdf',
      }
      : {}),
  });
  const wrap = createCanvasNode(context, containerName, nav.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
    width: '100%',
    minHeight: caregloRealReference ? '87px' : undefined,
    minHeightTablet: caregloRealReference ? '87px' : undefined,
    minHeightMobile: caregloRealReference ? '87px' : undefined,
    ...(lumen ? {} : backgroundProps(context, containerName, careglo ? caregloNavBackground : style.navBackground)),
    borderRadius: maidy || careglo || lumen || optomatta ? '0px' : geometry.navRadius,
    paddingTop: maidy ? '26px' : caregloRealReference ? '16px' : careglo ? '18px' : optomatta ? '20px' : lumen ? '20px' : '14px',
    paddingTopTablet: optomatta ? '22px' : undefined,
    paddingTopMobile: optomatta ? '27px' : undefined,
    paddingRight: careglo || lumen || optomatta ? '0px' : '18px',
    paddingBottom: maidy ? '26px' : caregloRealReference ? '17px' : careglo ? '18px' : optomatta ? '20px' : lumen ? '18px' : '14px',
    paddingBottomTablet: optomatta ? '23px' : undefined,
    paddingBottomMobile: optomatta ? '27px' : undefined,
    paddingLeft: careglo || lumen || optomatta ? '0px' : '18px',
    paddingLeftTablet: maidy ? '10px' : undefined,
    paddingLeftMobile: maidy ? '0px' : undefined,
    paddingRightTablet: maidy ? '10px' : undefined,
    paddingRightMobile: maidy ? '0px' : undefined,
  });

  if (maidy) {
    const brand = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
    });
    createCanvasNode(context, containerName, brand.id, {
      width: '44px',
      minHeight: '44px',
      flexShrink: 0,
      borderRadius: '12px',
      ...backgroundProps(context, containerName, maidyPanelColor(context)),
      backgroundAccentType: 'radial',
      backgroundAccentColor1: maidyHighlightColor(context),
      backgroundAccentColor2: 'rgba(255, 221, 103, 0)',
      backgroundAccentPositionX: '72%',
      backgroundAccentPositionY: '28%',
      backgroundAccentSize: '18px',
    });
    addText(context, brand.id, brandName(context.brief, context.replacementProfile), {
      fontSize: '22px',
      fontWeight: '900',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else if (careglo || optomatta) {
    const geometricCaregloMark = careglo && !caregloFallback;
    const displayBrand = brandName(context.brief, context.replacementProfile);
    const brand = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: optomatta ? '10px' : geometricCaregloMark ? '8px' : '12px',
      width: caregloFallback ? '190px' : careglo ? '150px' : undefined,
      flexShrink: careglo ? 0 : undefined,
    });
    const mark = createCanvasNode(context, containerName, brand.id, {
      width: optomatta ? '42px' : '30px',
      minHeight: optomatta ? '28px' : geometricCaregloMark ? '24px' : '30px',
      flexShrink: 0,
      borderRadius: geometricCaregloMark ? '0px' : '999px',
      layoutDisplay: geometricCaregloMark ? 'flex' : undefined,
      flexDirection: geometricCaregloMark ? 'column' : undefined,
      justifyContent: geometricCaregloMark ? 'center' : undefined,
      alignItems: geometricCaregloMark ? 'center' : undefined,
      ...backgroundProps(context, containerName, geometricCaregloMark ? 'transparent' : style.accent),
    });
    if (!optomatta) {
      addText(context, mark.id, geometricCaregloMark ? displayBrand.slice(0, 1).toUpperCase() : 'C', {
        fontSize: geometricCaregloMark ? '24px' : '12px',
        lineHeight: '1',
        fontWeight: '900',
        textAlign: 'center',
        textColor: geometricCaregloMark ? caregloAccent : style.buttonFg,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addText(context, brand.id, optomatta ? displayBrand.toUpperCase() : caregloFallback ? 'Luxury Car Care' : displayBrand, {
      fontSize: optomatta ? '32px' : caregloFallback ? '16px' : '20px',
      fontSizeMobile: optomatta ? '24px' : undefined,
      fontWeight: optomatta ? '900' : '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else if (lumen) {
    const brand = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
      flexShrink: 0,
    });
    createCanvasNode(context, containerName, brand.id, {
      width: '50px',
      minHeight: '50px',
      flexShrink: 0,
      borderRadius: '999px',
      ...backgroundProps(context, containerName, style.accent2),
    });
    addText(context, brand.id, brandName(context.brief, context.replacementProfile), {
      fontSize: '42px',
      fontWeight: '400',
      lineHeight: '1',
      letterSpacing: '0px',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else {
    addText(context, wrap.id, brandName(context.brief, context.replacementProfile), {
      fontSize: '20px',
      fontWeight: '800',
      textColor: style.ink,
    });
  }
  const navLinks = maidy
    ? ['Home', 'About', 'Services', 'Plans', 'Contact']
    : careglo
      ? caregloFallback ? ['Services', 'Results', 'Process', 'Contact'] : ['Home', 'Studio', 'Treatments', 'Care guide', 'Results', 'Contact']
      : optomatta
        ? ['Home', 'About', 'Services', 'Shop', 'Contact']
        : lumen
          ? ['HOME', 'ABOUT', 'CARE +', 'JOURNAL +', 'CONTACT']
      : ['Services', 'Proof', 'Plans'];
  const navLinksWrap = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: caregloRealReference ? 'flex-start' : 'center',
    alignItems: 'center',
    gap: maidy ? '38px' : caregloFallback ? '28px' : careglo ? '0px' : optomatta ? '42px' : lumen ? '34px' : '18px',
    paddingLeft: caregloRealReference ? '188px' : undefined,
    flexGrow: maidy || careglo || lumen ? 1 : undefined,
    flexShrink: careglo ? 0 : undefined,
    responsiveDisplay: 'hide-tablet-down',
  });
  for (const link of navLinks) {
    addText(context, navLinksWrap.id, link, {
      display: careglo && !caregloFallback ? 'inline-flex' : undefined,
      fontSize: maidy ? '15px' : caregloFallback ? '12px' : careglo || optomatta ? '16px' : lumen ? '13px' : '14px',
      fontWeight: careglo && !caregloFallback ? '400' : careglo ? '650' : optomatta ? '500' : maidy ? '800' : '700',
      fontFamily: caregloRealReference ? 'Poppins' : undefined,
      letterSpacing: lumen ? '0.06em' : undefined,
      textColor: careglo || lumen || maidy || optomatta ? style.ink : style.muted,
      paddingY: careglo && !caregloFallback ? '16px' : undefined,
      paddingX: careglo && !caregloFallback ? '18px' : undefined,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  if (maidy) {
    const action = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10px',
      flexShrink: 0,
    });
    const contactAction = createCanvasNode(context, containerName, action.id, {
      responsiveDisplay: 'hide-mobile',
      flexShrink: 0,
    });
    addButton(context, contactAction.id, 'Contact', '#', {
      paddingTop: '16px',
      paddingRight: '28px',
      paddingBottom: '16px',
      paddingLeft: '28px',
      borderRadius: '0px',
      fontWeight: '800',
      backgroundColor: maidyHighlightColor(context),
      textColor: style.ink,
    });
    const phoneAction = createCanvasNode(context, containerName, action.id, {
      responsiveDisplay: 'show-mobile-only',
    });
    addButton(context, phoneAction.id, '☎', '#', {
      paddingTop: '9px',
      paddingRight: '10px',
      paddingBottom: '9px',
      paddingLeft: '10px',
      borderRadius: '0px',
      fontSize: '14px',
      fontWeight: '800',
      backgroundColor: maidyHighlightColor(context),
      textColor: style.ink,
    });
    const menuAction = createCanvasNode(context, containerName, action.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '5px',
      responsiveDisplay: 'show-tablet-down-only',
      width: '30px',
      minHeight: '34px',
      flexShrink: 0,
    });
    for (let index = 0; index < 3; index += 1) {
      createCanvasNode(context, containerName, menuAction.id, {
        width: '22px',
        minHeight: '2px',
        ...backgroundProps(context, containerName, maidyPanelColor(context)),
      });
    }
    return;
  }

  const responsiveDisplayOptions = context.contractIndex.get(containerName)?.propOptions?.get('responsiveDisplay');
  const canShowTabletDownOnly = responsiveDisplayOptions?.has('show-tablet-down-only') === true;
  let actionParentId;
  let caregloActionGroup = null;
  if (caregloRealReference && canShowTabletDownOnly) {
    caregloActionGroup = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
      flexShrink: 0,
    });
    actionParentId = createCanvasNode(context, containerName, caregloActionGroup.id, {
      responsiveDisplay: 'hide-mobile',
      flexShrink: 0,
    }).id;
  } else {
    actionParentId = optomatta || careglo || lumen
      ? createCanvasNode(context, containerName, wrap.id, {
        responsiveDisplay: careglo ? 'hide-mobile' : optomatta ? 'hide-tablet-down' : undefined,
        flexShrink: careglo || lumen ? 0 : undefined,
      }).id
      : wrap.id;
  }
  addButton(context, actionParentId, caregloFallback ? 'Contact' : careglo ? context.replacementProfile.navCta || 'Reserve a Visit' : optomatta ? '+1 (415) 555-0186' : lumen ? 'Appointment Now' : firstCta(context.brief), '#', optomatta ? {
    paddingTop: '26px',
    paddingRight: '34px',
    paddingBottom: '26px',
    paddingLeft: '34px',
    borderRadius: '0px',
    fontWeight: '700',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  } : caregloRealReference ? {
    paddingTop: '19px',
    paddingRight: '21px',
    paddingBottom: '19px',
    paddingLeft: '21px',
    borderRadius: '16px',
    fontWeight: '400',
    fontFamily: 'Poppins',
    backgroundColor: caregloAccent,
    textColor: '#15171c',
  } : {});

  if (caregloActionGroup) {
    const menuButton = createCanvasNode(context, containerName, caregloActionGroup.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      responsiveDisplay: 'show-tablet-down-only',
      width: '44px',
      minHeight: '44px',
      flexShrink: 0,
      borderRadius: '14px',
      ...backgroundProps(context, containerName, '#151820'),
    });
    createCanvasNode(context, containerName, menuButton.id, {
      width: '14px',
      minHeight: '14px',
      borderRadius: '0px',
      borderWidth: '2px',
      borderColor: '#b1b4c8',
    });
  }
}

function addTopbarSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const topbar = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'header',
    paddingTop: '14px',
    paddingBottom: '14px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    responsiveDisplay: 'hide-mobile',
    ...backgroundProps(context, sectionName, style.buttonBg),
  });
  const wrap = createCanvasNode(context, containerName, topbar.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
  });

  const contact = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '30px',
  });
  addText(context, contact.id, '☎ +1 (415) 555-0148', {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '600',
    textColor: style.buttonFg,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, contact.id, `✉ ${context.replacementProfile.email || firstEmailText(context.brief, 'hello@example.test')}`, {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '600',
    textColor: style.buttonFg,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const social = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '20px',
    responsiveDisplay: 'hide-mobile',
  });
  for (const label of ['f', 'x', '▶', '◎', 'in']) {
    addText(context, social.id, label, {
      fontSize: '13px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.buttonFg,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
}

function addMaidyHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidyCompositeSource = maidyHeroCompositeSource();
  const usesMaidyComposite = maidyCompositeSource !== '';
  const maidyCutoutSource = usesMaidyComposite ? '' : maidyHeroCutoutSource();
  const usesMaidyCutout = maidyCutoutSource !== '';
  const configuredEquipmentSource = String(process.env.MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL || '').trim();
  const maidyEquipmentSource = /^https?:\/\//i.test(configuredEquipmentSource) && isTransparentCutoutSource(configuredEquipmentSource)
    ? configuredEquipmentSource
    : '';
  const usesMaidyEquipmentCutout = maidyEquipmentSource !== '';
  const usesGeneratedFallback = !usesMaidyCutout && !usesMaidyComposite;
  const cutoutHeight = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.desktop?.canonicalHeroMedia || geometry.referenceGeometry?.desktop?.heroMedia, 'height') || '847px'
    : '';
  const cutoutHeightTablet = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.tablet?.canonicalHeroMedia || geometry.referenceGeometry?.tablet?.heroMedia, 'height') || geometry.visualMinHeightTablet
    : '';
  const cutoutHeightMobile = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.mobile?.canonicalHeroMedia || geometry.referenceGeometry?.mobile?.heroMedia, 'height') || geometry.visualMinHeightMobile
    : '';
  const cutoutWidthTablet = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.tablet?.canonicalHeroMedia || geometry.referenceGeometry?.tablet?.heroMedia, 'width')
    : '';
  const cutoutTabletOffset = usesMaidyCutout && isMaidyRealReferenceBrief(context.brief) ? '115px' : '0px';
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '0px',
    paddingBottom: '0px',
    innerMaxWidth: '1440px',
    innerPaddingX: '0px',
    minHeight: cutoutHeight || geometry.heroMinHeight,
    minHeightTablet: cutoutHeightTablet || geometry.heroMinHeightTablet,
    minHeightMobile: cutoutHeightMobile || geometry.heroMinHeightMobile,
    ...backgroundProps(context, sectionName, style.bg),
    backgroundImage: usesMaidyComposite ? maidyCompositeSource : undefined,
    backgroundSize: usesMaidyComposite ? 'cover' : undefined,
    backgroundPosition: usesMaidyComposite ? 'top' : undefined,
    backgroundRepeat: usesMaidyComposite ? 'no-repeat' : undefined,
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: usesGeneratedFallback ? 'flex-start' : 'stretch',
    gap: '0px',
    responsiveStack: usesGeneratedFallback ? 'tablet' : 'mobile',
    minHeight: cutoutHeight || geometry.heroMinHeight,
    minHeightTablet: cutoutHeightTablet || geometry.heroMinHeightTablet,
    minHeightMobile: cutoutHeightMobile || geometry.heroMinHeightMobile,
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: '0px',
    flexBasis: usesGeneratedFallback ? '55%' : '50%',
    flexShrink: usesGeneratedFallback ? undefined : 0,
    paddingTop: usesGeneratedFallback ? '60px' : usesMaidyCutout ? '100px' : '32px',
    paddingTopTablet: usesGeneratedFallback ? '52px' : usesMaidyCutout ? '59px' : '42px',
    paddingTopMobile: usesMaidyCutout ? '50px' : '52px',
    paddingBottom: '0px',
  });
  const copyContent = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: usesGeneratedFallback ? '24px' : '12px',
    gapTablet: usesMaidyCutout ? '20px' : undefined,
    gapMobile: usesGeneratedFallback ? '28px' : '10px',
    width: '100%',
    maxWidth: usesGeneratedFallback ? '656px' : usesMaidyCutout ? '720px' : '560px',
    maxWidthTablet: usesMaidyCutout ? '100%' : undefined,
    maxWidthMobile: '100%',
    paddingLeft: usesGeneratedFallback ? '110px' : '120px',
    paddingLeftTablet: usesMaidyCutout ? '30px' : undefined,
    paddingLeftMobile: '20px',
    paddingRight: '0px',
    paddingRightTablet: usesMaidyCutout ? '0px' : undefined,
    paddingRightMobile: '20px',
  });

  addText(context, copyContent.id, maidyEyebrowText(context.brief, context.replacementProfile), {
    fontSize: '17px',
    fontSizeMobile: '14px',
    lineHeightTablet: usesMaidyCutout ? '1.7' : undefined,
    fontWeight: '800',
    letterSpacing: '0.32em',
    textTransform: 'uppercase',
    textColor: '#b9bbb7',
    marginTop: '0px',
    marginBottom: '0px',
  });

  const headingStack = createCanvasNode(context, containerName, copyContent.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '0px',
    paddingTop: usesGeneratedFallback ? '12px' : usesMaidyCutout ? '4px' : undefined,
    paddingTopTablet: usesMaidyCutout ? '0px' : undefined,
    paddingTopMobile: usesGeneratedFallback ? '2px' : usesMaidyCutout ? '13px' : undefined,
  });
  let headingLines = maidyHeroHeadingLines(context.brief);
  const sourceHeading = String(firstHeading(context.brief) || '').replace(/\s+/g, ' ').trim();
  if (usesGeneratedFallback && /avoid the mess/i.test(sourceHeading) && /crisp and calm/i.test(sourceHeading)) {
    headingLines = {
      body: ['Avoid the mess,', 'keep every room'],
      accent: 'crisp and calm.',
    };
  }
  for (const line of headingLines.body) {
    addHeading(context, headingStack.id, line, 'h1', {
      fontSize: usesGeneratedFallback ? '68px' : '62px',
      fontSizeTablet: usesMaidyCutout ? '48px' : '54px',
      fontSizeMobile: usesMaidyCutout ? '47px' : '45px',
      lineHeight: usesGeneratedFallback ? '1.28' : usesMaidyCutout ? '82px' : '1.08',
      lineHeightTablet: usesMaidyCutout ? '65px' : usesGeneratedFallback ? '1.2' : undefined,
      lineHeightMobile: usesMaidyCutout ? '1.3' : usesGeneratedFallback ? '1.32' : undefined,
      fontWeight: usesGeneratedFallback ? '900' : '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  addHeading(context, headingStack.id, headingLines.accent, 'h1', {
    fontSize: usesGeneratedFallback ? '68px' : '62px',
    fontSizeTablet: usesMaidyCutout ? '48px' : '54px',
    fontSizeMobile: usesMaidyCutout ? '47px' : '45px',
    lineHeight: usesGeneratedFallback ? '1.28' : usesMaidyCutout ? '82px' : '1.08',
    lineHeightTablet: usesMaidyCutout ? '65px' : usesGeneratedFallback ? '1.2' : undefined,
    lineHeightMobile: usesMaidyCutout ? '1.3' : usesGeneratedFallback ? '1.32' : undefined,
    fontWeight: usesGeneratedFallback ? '900' : '600',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });

  const leadParent = usesMaidyCutout
    ? createCanvasNode(context, containerName, copyContent.id, {
      width: '100%',
      maxWidth: '400px',
      maxWidthTablet: '317px',
      maxWidthMobile: '100%',
      paddingTop: '8px',
      paddingTopTablet: '0px',
      paddingTopMobile: '11px',
    }).id
    : copyContent.id;
  addText(context, leadParent, context.replacementProfile.lead, {
    fontSize: usesMaidyCutout ? '16px' : '18px',
    fontSizeTablet: usesMaidyCutout ? '16px' : undefined,
    fontSizeMobile: '16px',
    lineHeight: usesMaidyCutout ? '1.7' : '1.72',
    lineHeightTablet: usesMaidyCutout ? '1.7' : undefined,
    lineHeightMobile: usesMaidyCutout ? '1.6' : undefined,
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const lowerStage = usesMaidyCutout
    ? createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'one',
      width: '100%',
    })
    : null;
  const bottomRow = createCanvasNode(context, containerName, lowerStage ? lowerStage.id : copyContent.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: '30px',
    width: '100%',
    maxWidthMobile: '100%',
    responsiveStack: usesGeneratedFallback ? 'tablet' : undefined,
    gridColumnStart: usesMaidyCutout ? 1 : undefined,
    gridRowStart: usesMaidyCutout ? 1 : undefined,
    paddingTop: usesMaidyCutout ? '62px' : undefined,
    paddingTopTablet: usesMaidyCutout ? '35px' : undefined,
    paddingTopMobile: usesMaidyCutout ? '35px' : undefined,
    paddingLeft: usesMaidyCutout ? '120px' : undefined,
    paddingLeftTablet: usesMaidyCutout ? '30px' : undefined,
    paddingLeftMobile: usesMaidyCutout ? '20px' : undefined,
  });
  const actions = createCanvasNode(context, containerName, bottomRow.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '30px',
    paddingTop: usesGeneratedFallback ? '13px' : undefined,
    paddingTopTablet: usesGeneratedFallback ? '0px' : undefined,
    paddingTopMobile: usesGeneratedFallback ? '0px' : undefined,
  });
  addButton(context, actions.id, 'Get started →', '#', {
    paddingTop: '14px',
    paddingRight: '25px',
    paddingBottom: '14px',
    paddingLeft: '25px',
    borderRadius: '0px',
    fontWeight: '800',
    backgroundColor: maidyPanelColor(context),
    textColor: '#ffffff',
  });
  const secondaryActionWrap = createCanvasNode(context, containerName, actions.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16px',
  });
  addButton(context, secondaryActionWrap.id, '▶', '#', {
    paddingTop: usesMaidyCutout ? '12px' : '17px',
    paddingRight: usesMaidyCutout ? '15px' : '19px',
    paddingBottom: usesMaidyCutout ? '12px' : '17px',
    paddingLeft: usesMaidyCutout ? '15px' : '19px',
    borderRadius: '999px',
    backgroundColor: maidyHighlightColor(context),
    textColor: maidyPanelColor(context),
  });
  addText(context, secondaryActionWrap.id, 'How we work', {
    fontSize: '16px',
    fontWeight: '800',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });
  const equipmentSlot = createCanvasNode(context, containerName, lowerStage ? lowerStage.id : copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: usesGeneratedFallback ? '260px' : '320px',
    maxWidthTablet: usesMaidyCutout ? '180px' : undefined,
    maxWidthMobile: usesMaidyCutout ? '294px' : undefined,
    responsiveStack: usesGeneratedFallback ? 'tablet' : undefined,
    gridColumnStart: usesMaidyCutout ? 1 : undefined,
    gridRowStart: usesMaidyCutout ? 1 : undefined,
    paddingTop: usesMaidyCutout ? '57px' : undefined,
    paddingTopTablet: usesGeneratedFallback ? '40px' : usesMaidyCutout ? '80px' : undefined,
    paddingTopMobile: usesGeneratedFallback ? '0px' : usesMaidyCutout ? '30px' : undefined,
  });
  addMediaSurface(context, equipmentSlot.id, 'secondary', mediaVariant(maidyEquipmentSource || context.replacementProfile.equipment || context.replacementProfile.secondary, 'maidy-hero-equipment'), {
    width: '100%',
    minHeight: usesGeneratedFallback ? '170px' : '258px',
    minHeightTablet: usesGeneratedFallback ? '270px' : '144px',
    minHeightMobile: usesGeneratedFallback ? '220px' : usesMaidyCutout ? '237px' : '258px',
    borderRadius: '0px',
    backgroundPosition: 'center',
    backgroundPositionX: usesMaidyEquipmentCutout ? '-80px' : undefined,
    backgroundPositionXTablet: usesMaidyEquipmentCutout ? '-30px' : undefined,
    backgroundPositionXMobile: usesMaidyEquipmentCutout ? '-50px' : undefined,
    backgroundPositionY: usesMaidyEquipmentCutout ? '50%' : undefined,
    backgroundPositionYTablet: usesMaidyEquipmentCutout ? '50%' : undefined,
    backgroundPositionYMobile: usesMaidyEquipmentCutout ? '50%' : undefined,
    backgroundSize: usesMaidyEquipmentCutout ? 'contain' : 'cover',
    backgroundRepeat: usesMaidyEquipmentCutout ? 'no-repeat' : undefined,
  });

  const visualParent = usesGeneratedFallback
    ? createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      flexBasis: '520px',
      width: '520px',
      minHeight: '670px',
      minHeightTablet: '270px',
      minHeightMobile: geometry.visualMinHeightMobile,
      paddingTop: '60px',
      paddingTopTablet: '0px',
      paddingTopMobile: '0px',
      responsiveDisplay: 'hide-tablet-down',
    })
    : null;

  const visual = createCanvasNode(context, containerName, visualParent ? visualParent.id : wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: usesMaidyCutout ? 'flex-start' : 'flex-end',
    alignItems: 'flex-start',
    flexBasis: usesMaidyCutout || usesMaidyComposite ? '600px' : usesGeneratedFallback ? undefined : '50%',
    flexShrink: usesMaidyCutout || usesMaidyComposite ? 0 : undefined,
    width: usesMaidyCutout || usesMaidyComposite ? '600px' : usesGeneratedFallback ? '100%' : '720px',
    maxWidth: usesMaidyCutout || usesMaidyComposite ? '100%' : undefined,
    minHeight: usesGeneratedFallback ? '610px' : cutoutHeight || '847px',
    minHeightTablet: usesMaidyComposite ? '0px' : usesGeneratedFallback ? '270px' : cutoutHeightTablet || geometry.visualMinHeightTablet,
    minHeightMobile: usesMaidyComposite ? '0px' : cutoutHeightMobile || geometry.visualMinHeightMobile,
    paddingTop: '0px',
    paddingTopTablet: usesMaidyCutout ? cutoutTabletOffset : undefined,
    paddingTopMobile: usesMaidyCutout ? '40px' : undefined,
    paddingRight: usesMaidyCutout ? '0px' : usesGeneratedFallback ? '0px' : '120px',
    paddingBottom: usesMaidyCutout ? '0px' : usesGeneratedFallback ? '48px' : '80px',
    paddingLeft: '0px',
    borderRadius: '0px',
    responsiveDisplay: usesMaidyComposite ? 'hide-tablet-down' : usesGeneratedFallback ? 'hide-mobile' : undefined,
    ...(usesMaidyComposite ? {} : backgroundProps(context, containerName, maidyPanelColor(context))),
    backgroundImage: usesMaidyCutout || usesMaidyComposite ? undefined : context.replacementProfile.hero,
    backgroundSize: usesMaidyCutout || usesMaidyComposite ? undefined : 'cover',
    backgroundPosition: usesMaidyCutout || usesMaidyComposite ? undefined : 'top',
    backgroundRepeat: usesMaidyCutout || usesMaidyComposite ? undefined : 'no-repeat',
    backgroundOverlay: usesMaidyCutout || usesMaidyComposite ? undefined : 'rgba(49, 95, 79, 0.16)',
    backgroundAccentType: 'radial',
    backgroundAccentColor1: maidyHighlightColor(context),
    backgroundAccentColor2: 'rgba(255, 221, 103, 0)',
    backgroundAccentPositionX: '27%',
    backgroundAccentPositionY: '42%',
    backgroundAccentSize: '330px',
  });

  const quoteParent = usesMaidyCutout
    ? createCanvasNode(context, containerName, visual.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      width: '100%',
      maxWidthTablet: cutoutWidthTablet || undefined,
      maxWidthMobile: '100%',
      minHeight: cutoutHeight || '847px',
      minHeightTablet: cutoutHeightTablet || geometry.visualMinHeightTablet,
      minHeightMobile: cutoutHeightMobile || geometry.visualMinHeightMobile,
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '80px',
      paddingBottomTablet: '0px',
      paddingBottomMobile: '0px',
      paddingLeft: '0px',
      backgroundImage: maidyCutoutSource,
      backgroundSize: 'contain',
      backgroundPosition: 'top',
      backgroundRepeat: 'no-repeat',
      backgroundAccentType: 'radial',
      backgroundAccentColor1: maidyHighlightColor(context),
      backgroundAccentColor2: 'rgba(255, 221, 103, 0)',
      backgroundAccentPositionX: '42%',
      backgroundAccentPositionY: '44%',
      backgroundAccentSize: '360px',
    }).id
    : visual.id;

  const proof = proofCopy(context.replacementProfile);
  const quote = createCanvasNode(context, containerName, quoteParent, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '12px',
    width: '288px',
    minHeight: '184px',
    paddingTop: '26px',
    paddingRight: '28px',
    paddingBottom: '26px',
    paddingLeft: '28px',
    borderRadius: '0px',
    ...backgroundProps(context, containerName, style.cardBackground),
    boxShadow: 'soft',
  });
  addHeading(context, quote.id, '99', 'div', {
    fontSize: '44px',
    lineHeight: '1',
    fontWeight: '300',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, quote.id, proof.title, {
    fontSize: '16px',
    lineHeight: '1.35',
    fontWeight: '800',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, quote.id, 'Fresh rooms, steady routines, and a team that arrives prepared.', {
    fontSize: '13px',
    lineHeight: '1.6',
    fontWeight: '700',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });
  context.heroProofCards += 1;
}

function addCaregloHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const realReferenceMode = context.brief.authoringRequirements?.requireRealReference === true;
  const compactFallbackMobile = realReferenceMode === false;
  const accentColor = realReferenceMode ? '#ffd0a8' : style.accent;
  const mutedColor = realReferenceMode ? '#b1b4c8' : style.muted;
  const inkColor = realReferenceMode ? '#f7f7f8' : style.ink;
  const navPanelColor = realReferenceMode ? '#222731' : style.navBackground;
  const heroHeadingText = realReferenceMode
    ? context.replacementProfile.heroHeading || 'Crafted Care for a Lasting First Impression.'
    : firstHeading(context.brief);
  const fallbackCtas = Array.isArray(context.brief.text?.ctas) ? context.brief.text.ctas : [];
  const primaryHeroCta = realReferenceMode
    ? context.replacementProfile.primaryCta || 'Reserve Your Detail'
    : fallbackCtas.find((cta) => /book/i.test(String(cta || ''))) || 'Book Detailing Now';
  const secondaryHeroCta = realReferenceMode
    ? context.replacementProfile.secondaryCta || 'Explore Treatments'
    : fallbackCtas.find((cta) => /view|service/i.test(String(cta || ''))) || 'View services';
  const heroEyebrow = realReferenceMode
    ? context.replacementProfile.heroEyebrow || 'A finish engineered to last'
    : 'A finish made to endure';
  const visualMinHeight = compactFallbackMobile
    ? scalePxLength(geometry.visualMinHeight, 1.208, '701px')
    : referenceRectLength(geometry.referenceGeometry?.desktop?.heroMedia, 'height')
      || scalePxLength(geometry.visualMinHeight, 1.54, '814px');
  const visualMinHeightTablet = compactFallbackMobile
    ? geometry.visualMinHeightTablet
    : referenceRectLength(geometry.referenceGeometry?.tablet?.heroMedia, 'height') || geometry.visualMinHeightTablet;
  const visualMinHeightMobile = compactFallbackMobile
    ? geometry.visualMinHeightMobile
    : referenceRectLength(geometry.referenceGeometry?.mobile?.heroMedia, 'height') || geometry.visualMinHeightMobile;
  const heroMinHeight = compactFallbackMobile
    ? geometry.heroMinHeight
    : referenceRectLength(geometry.referenceGeometry?.desktop?.heroMedia, 'height')
      || scalePxLength(geometry.heroMinHeight, 1.26, '814px');
  const referenceSecondaryHeight = Number(geometry.referenceGeometry?.desktop?.secondaryMedia?.rect?.height || 0);
  const secondaryMinHeight = compactFallbackMobile
    ? scalePxLength(geometry.secondaryMinHeight, 1.16, '269px')
    : Number.isFinite(referenceSecondaryHeight) && referenceSecondaryHeight > 0
      ? `${Math.max(200, Math.round(referenceSecondaryHeight))}px`
      : scalePxLength(geometry.secondaryMinHeight, 0.86, '200px');
  const secondaryWidth = compactFallbackMobile
    ? '216px'
    : referenceRectLength(geometry.referenceGeometry?.desktop?.secondaryMedia, 'width') || '216px';
  const secondaryWidthTablet = compactFallbackMobile
    ? undefined
    : referenceRectLength(geometry.referenceGeometry?.tablet?.secondaryMedia, 'width') || secondaryWidth;
  const secondaryMinHeightMobile = compactFallbackMobile
    ? secondaryMinHeight
    : referenceRectLength(geometry.referenceGeometry?.mobile?.secondaryMedia, 'height') || secondaryMinHeight;
  const referenceHeadingFontSize = cssLengthValue(geometry.referenceGeometry?.desktop?.heroHeading?.fontSize, '66px');
  const referenceHeadingFontSizeTablet = cssLengthValue(geometry.referenceGeometry?.tablet?.heroHeading?.fontSize, '56px');
  const referenceHeadingFontSizeMobile = cssLengthValue(geometry.referenceGeometry?.mobile?.heroHeading?.fontSize, '64px');

  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: compactFallbackMobile ? '70px' : '96px',
    paddingTopMobile: realReferenceMode ? '78px' : undefined,
    paddingBottom: '44px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: realReferenceMode ? '24px' : '20px',
    minHeight: geometry.heroMinHeight,
    minHeightTablet: geometry.heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
    ...backgroundProps(context, sectionName, style.bg),
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: compactFallbackMobile ? '24px' : '48px',
    gapTablet: realReferenceMode ? '48px' : undefined,
    gapMobile: realReferenceMode ? '48px' : undefined,
    responsiveStack: 'tablet',
    minHeight: heroMinHeight,
    minHeightTablet: scalePxLength(heroMinHeight, 0.78, geometry.heroMinHeightTablet),
    minHeightMobile: '0px',
  });

  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: compactFallbackMobile ? '28px' : '40px',
    gapMobile: compactFallbackMobile ? '22px' : undefined,
    width: realReferenceMode ? '100%' : undefined,
    flexBasis: compactFallbackMobile ? '585px' : realReferenceMode ? '548px' : '40%',
    flexShrink: realReferenceMode ? 0 : undefined,
    maxWidth: compactFallbackMobile ? '585px' : realReferenceMode ? '548px' : undefined,
    maxWidthTablet: realReferenceMode ? '100%' : undefined,
    maxWidthMobile: realReferenceMode ? '100%' : undefined,
    minHeight: visualMinHeight,
    minHeightTablet: '0px',
    minHeightMobile: '0px',
    paddingTop: realReferenceMode ? '0px' : '4px',
    paddingBottom: '0px',
    paddingLeft: compactFallbackMobile ? '32px' : undefined,
    paddingLeftMobile: compactFallbackMobile ? '0px' : undefined,
  });
  const copyTop = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: realReferenceMode ? '25px' : '28px',
    gapMobile: compactFallbackMobile ? '18px' : undefined,
  });
  const eyebrowParentId = realReferenceMode
    ? createCanvasNode(context, containerName, copyTop.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
    }).id
    : copyTop.id;
  addText(context, eyebrowParentId, heroEyebrow, {
    fontSize: '20px',
    fontSizeMobile: realReferenceMode ? '20px' : '16px',
    lineHeight: '1.25',
    fontWeight: realReferenceMode ? '400' : '500',
    textAlignTablet: compactFallbackMobile ? 'left' : 'center',
    textAlignMobile: compactFallbackMobile ? 'left' : 'center',
    textColor: accentColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, copyTop.id, heroHeadingText, 'h1', {
    fontSize: compactFallbackMobile ? '66px' : referenceHeadingFontSize,
    fontSizeTablet: compactFallbackMobile ? '44px' : referenceHeadingFontSizeTablet,
    fontSizeMobile: compactFallbackMobile ? '42px' : referenceHeadingFontSizeMobile,
    lineHeight: realReferenceMode ? '1.10' : '1.08',
    lineHeightTablet: realReferenceMode ? '1.10' : undefined,
    lineHeightMobile: compactFallbackMobile ? '1.08' : '1.10',
    fontWeight: compactFallbackMobile ? '900' : '800',
    fontFamily: compactFallbackMobile ? undefined : 'Plus_Jakarta_Sans',
    textAlignTablet: compactFallbackMobile ? 'left' : 'center',
    textAlignMobile: compactFallbackMobile ? 'left' : 'center',
    textColor: compactFallbackMobile ? style.ink : '#ffffff',
    marginTop: '0px',
    marginBottom: compactFallbackMobile ? '8px' : '22px',
  });

  const leadRow = createCanvasNode(context, containerName, copyTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: compactFallbackMobile ? '16px' : '71px',
    gapTablet: realReferenceMode ? '96px' : undefined,
    gapMobile: realReferenceMode ? '76px' : undefined,
    responsiveStack: compactFallbackMobile ? undefined : 'mobile',
    paddingTop: realReferenceMode ? '25px' : undefined,
    paddingTopTablet: realReferenceMode ? '25px' : undefined,
    paddingTopMobile: realReferenceMode ? '20px' : undefined,
    paddingLeft: realReferenceMode ? '7px' : undefined,
    paddingLeftTablet: realReferenceMode ? '44px' : undefined,
    paddingRight: realReferenceMode ? '52px' : undefined,
    paddingRightTablet: realReferenceMode ? '62px' : undefined,
    paddingLeftMobile: realReferenceMode ? '0px' : undefined,
    paddingRightMobile: realReferenceMode ? '0px' : undefined,
  });
  const leadMarkerWrap = createCanvasNode(context, containerName, leadRow.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '34px',
    maxWidthTablet: '34px',
    maxWidthMobile: realReferenceMode ? '100%' : '34px',
    minHeight: '41px',
    paddingTop: '7px',
    flexShrink: 0,
  });
  createCanvasNode(context, containerName, leadMarkerWrap.id, {
    width: '34px',
    minHeight: '34px',
    flexShrink: 0,
    borderRadius: '0px',
    borderWidth: '4px',
    borderColor: accentColor,
  });
  addText(context, leadRow.id, 'Premium interior and exterior treatments that make every ride feel first-class, every single day.', {
    fontSize: realReferenceMode ? '20px' : '22px',
    fontSizeTablet: realReferenceMode ? '20px' : '19px',
    fontSizeMobile: realReferenceMode ? '20px' : '17px',
    lineHeight: realReferenceMode ? '1.5' : '1.45',
    lineHeightTablet: realReferenceMode ? '1.5' : undefined,
    lineHeightMobile: realReferenceMode ? '1.5' : undefined,
    fontWeight: '400',
    textAlignTablet: compactFallbackMobile || realReferenceMode ? 'left' : 'center',
    textAlignMobile: compactFallbackMobile || realReferenceMode ? 'left' : 'center',
    textColor: mutedColor,
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const actions = createCanvasNode(context, containerName, copyTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: compactFallbackMobile ? '14px' : '24px',
    responsiveStack: compactFallbackMobile ? undefined : 'mobile',
    width: realReferenceMode ? '100%' : undefined,
    paddingTop: realReferenceMode ? '39px' : undefined,
    paddingTopTablet: realReferenceMode ? '38px' : undefined,
    paddingTopMobile: realReferenceMode ? '39px' : undefined,
    paddingLeftTablet: realReferenceMode ? '206px' : undefined,
    paddingLeftMobile: realReferenceMode ? '0px' : undefined,
  });
  const primaryActionParent = realReferenceMode
    ? createCanvasNode(context, containerName, actions.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
    }).id
    : actions.id;
  addButton(context, primaryActionParent, primaryHeroCta, '#', {
    paddingTop: realReferenceMode ? '19px' : '17px',
    paddingRight: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
    paddingBottom: realReferenceMode ? '19px' : '17px',
    paddingLeft: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
    borderRadius: realReferenceMode ? '14px' : '18px',
    fontWeight: realReferenceMode ? '400' : '500',
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    backgroundColor: realReferenceMode ? accentColor : style.buttonBg,
    textColor: realReferenceMode ? '#15171c' : style.buttonFg,
  });
  if (secondaryHeroCta) {
    const secondaryActionParent = realReferenceMode
      ? createCanvasNode(context, containerName, actions.id, {
        layoutDisplay: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
      }).id
      : actions.id;
    addButton(context, secondaryActionParent, secondaryHeroCta, '#', {
      paddingTop: realReferenceMode ? '19px' : '17px',
      paddingRight: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
      paddingBottom: realReferenceMode ? '19px' : '17px',
      paddingLeft: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
      borderRadius: realReferenceMode ? '14px' : '16px',
      fontWeight: realReferenceMode ? '400' : '500',
      fontFamily: realReferenceMode ? 'Poppins' : undefined,
      backgroundColor: realReferenceMode ? navPanelColor : style.navBackground,
      textColor: mutedColor,
    });
  }

  const heroStats = statItems(context.brief);
  const ratingCopy = heroStats[0] || { value: '4.9/5', label: 'rated finish score' };
  const ownerCopy = heroStats[1] || { value: '1,200+', label: 'car owners' };

  if (compactFallbackMobile) {
    const statsRow = createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: '14px',
      responsiveStack: 'mobile',
      responsiveDisplay: 'hide-tablet-down',
      width: '100%',
    });
    for (const item of heroStats.slice(0, 3)) {
      const card = createCanvasNode(context, containerName, statsRow.id, {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        gap: '5px',
        flexBasis: '0px',
        flexGrow: 1,
        paddingTop: '18px',
        paddingRight: '16px',
        paddingBottom: '18px',
        paddingLeft: '16px',
        borderRadius: '18px',
        ...backgroundProps(context, containerName, style.cardBackground),
      });
      addHeading(context, card.id, item.value, 'div', {
        fontSize: '24px',
        lineHeight: '1',
        fontWeight: '800',
        textColor: style.accent,
        marginTop: '0px',
        marginBottom: '0px',
      });
      addText(context, card.id, item.label, {
        fontSize: '13px',
        lineHeight: '1.25',
        fontWeight: '600',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }

    addMediaSurface(context, wrap.id, 'hero', mediaVariant(context.replacementProfile.hero, 'careglo-fallback-hero-main'), {
      flexBasis: '467px',
      flexShrink: 0,
      width: '467px',
      minHeight: visualMinHeight,
      minHeightTablet: geometry.visualMinHeightTablet,
      minHeightMobile: geometry.visualMinHeightMobile,
      borderRadius: scalePxLength(geometry.radius, 0.75, '24px'),
      backgroundPosition: 'center',
      backgroundOverlay: 'rgba(0, 0, 0, 0.05)',
    });

    const sideRail = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '20px',
      flexShrink: 0,
      width: '224px',
      minHeight: visualMinHeight,
      minHeightTablet: '0px',
      minHeightMobile: '0px',
    });
    addMediaSurface(context, sideRail.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'careglo-side-proof'), {
      width: '224px',
      minHeight: secondaryMinHeight,
      minHeightTablet: secondaryMinHeight,
      minHeightMobile: '180px',
      borderRadius: '18px',
      backgroundPosition: 'center',
    });
    const bookingCard = createCanvasNode(context, containerName, sideRail.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '18px',
      flexGrow: 1,
      minHeight: '246px',
      paddingTop: '22px',
      paddingRight: '18px',
      paddingBottom: '18px',
      paddingLeft: '18px',
      borderRadius: '18px',
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addText(context, bookingCard.id, 'SIGNATURE SLOT', {
      fontSize: '12px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, bookingCard.id, 'Reserve a detail bay with expert handover.', 'h3', {
      fontSize: '21px',
      lineHeight: '1.18',
      fontWeight: '700',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addButton(context, bookingCard.id, primaryHeroCta, '#', {
      paddingTop: '14px',
      paddingRight: '16px',
      paddingBottom: '14px',
      paddingLeft: '16px',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: '700',
      backgroundColor: style.buttonBg,
      textColor: style.buttonFg,
    });
    context.heroProofCards += 3;
    return;
  }

  const lowerProof = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: '24px',
    responsiveStack: 'mobile',
    paddingTopTablet: realReferenceMode ? '25px' : undefined,
    paddingTopMobile: realReferenceMode ? '34px' : undefined,
    width: '100%',
  });
  addMediaSurface(context, lowerProof.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'careglo-hero-proof'), {
    width: realReferenceMode ? '100%' : '216px',
    maxWidth: realReferenceMode ? secondaryWidth : undefined,
    maxWidthTablet: secondaryWidthTablet,
    maxWidthMobile: realReferenceMode ? '100%' : undefined,
    minHeight: secondaryMinHeight,
    minHeightTablet: secondaryMinHeight,
    minHeightMobile: secondaryMinHeightMobile,
    borderRadius: '16px',
    backgroundPosition: 'center',
  });
  const ratingWrap = createCanvasNode(context, containerName, lowerProof.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: realReferenceMode ? 'flex-end' : 'center',
    gap: realReferenceMode ? '26px' : '18px',
    gapMobile: realReferenceMode ? '40px' : undefined,
    flexBasis: '0px',
    flexGrow: 1,
    minWidth: '220px',
  });
  const avatarStack = createCanvasNode(context, containerName, ratingWrap.id, {
    layoutDisplay: realReferenceMode ? 'grid' : 'flex',
    flexDirection: realReferenceMode ? undefined : 'row',
    alignItems: realReferenceMode ? undefined : 'center',
    gridTemplateColumns: realReferenceMode ? 'three' : undefined,
    gap: realReferenceMode ? undefined : '0px',
    width: realReferenceMode ? '150px' : undefined,
    minHeight: realReferenceMode ? '70px' : undefined,
  });
  for (const source of CAREGLO_AVATAR_IMAGES) {
    createCanvasNode(context, containerName, avatarStack.id, {
      width: realReferenceMode ? '70px' : '50px',
      maxWidth: realReferenceMode ? '50px' : undefined,
      maxWidthTablet: realReferenceMode ? '50px' : undefined,
      maxWidthMobile: realReferenceMode ? '70px' : undefined,
      minHeight: '50px',
      minHeightTablet: realReferenceMode ? '50px' : undefined,
      minHeightMobile: realReferenceMode ? '70px' : undefined,
      borderRadius: '999px',
      borderWidth: '2px',
      borderColor: style.bg,
      ...backgroundProps(context, containerName, style.panel),
      backgroundImage: source,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    });
  }
  if (realReferenceMode) {
    const ratingText = createCanvasNode(context, containerName, ratingWrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '0px',
      width: '140px',
      flexShrink: 0,
    });
    addText(context, ratingText.id, 'Rated 4.8/5', {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      fontFamily: 'Poppins',
      textColor: accentColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, ratingText.id, '900+ returning drivers', {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      fontFamily: 'Poppins',
      textColor: accentColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else {
    const ratingText = createCanvasNode(context, containerName, ratingWrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '2px',
    });
    addHeading(context, ratingText.id, ratingCopy.value, 'div', {
      fontSize: '18px',
      lineHeight: '1.1',
      fontWeight: '500',
      textColor: accentColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, ratingText.id, `${ratingCopy.label}\n${ownerCopy.value} ${ownerCopy.label}`, {
      fontSize: '15px',
      lineHeight: '1.32',
      fontWeight: '500',
      textColor: inkColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const visual = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    flexBasis: realReferenceMode ? '0px' : '60%',
    flexGrow: realReferenceMode ? 1 : undefined,
    minWidth: realReferenceMode ? '0px' : undefined,
    minHeight: visualMinHeight,
    minHeightTablet: visualMinHeightTablet,
    minHeightMobile: visualMinHeightMobile,
    paddingTop: '0px',
    paddingRight: '18px',
    paddingBottom: '18px',
    paddingLeft: '18px',
    borderRadius: realReferenceMode ? '16px' : geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
    backgroundImage: mediaVariant(context.replacementProfile.hero, 'careglo-hero-main'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOverlay: 'rgba(0, 0, 0, 0.08)',
  });

  const overlay = createCanvasNode(context, containerName, visual.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: realReferenceMode ? '24px' : '18px',
    paddingTop: '22px',
    paddingRight: realReferenceMode ? '0px' : '18px',
    paddingBottom: realReferenceMode ? '0px' : '18px',
    paddingLeft: realReferenceMode ? '0px' : '18px',
    borderRadius: realReferenceMode ? '18px' : geometry.radius,
    responsiveDisplay: realReferenceMode ? 'hide-mobile' : undefined,
    ...backgroundProps(context, containerName, realReferenceMode ? 'rgba(23, 25, 31, 0.97)' : 'rgba(18, 21, 27, 0.95)'),
    boxShadow: 'shadow-xl',
  });
  const overlayTop = createCanvasNode(context, containerName, overlay.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '28px',
    responsiveStack: 'mobile',
    paddingRight: realReferenceMode ? '18px' : undefined,
    paddingLeft: realReferenceMode ? '22px' : undefined,
  });
  const iconCircle = createCanvasNode(context, containerName, overlayTop.id, {
    width: '66px',
    minHeight: '66px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderColor: accentColor,
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  });
  createCanvasNode(context, containerName, iconCircle.id, {
    width: '20px',
    minHeight: '20px',
    borderRadius: '0px',
    borderWidth: '4px',
    borderColor: accentColor,
  });
  const overlayTitle = createCanvasNode(context, containerName, overlayTop.id, {
    width: '100%',
    maxWidth: '166px',
  });
  addHeading(context, overlayTitle.id, heroEyebrow, 'h3', {
    fontSize: '20px',
    fontSizeMobile: '20px',
    lineHeight: '1.5',
    fontWeight: '400',
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    textAlign: 'right',
    textColor: inkColor,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const overlayBottom = createCanvasNode(context, containerName, overlay.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: realReferenceMode ? 'space-between' : undefined,
    gap: realReferenceMode ? '0px' : '28px',
    responsiveStack: 'mobile',
    paddingTop: realReferenceMode ? '15px' : '18px',
    paddingRight: realReferenceMode ? '16px' : '18px',
    paddingBottom: realReferenceMode ? '15px' : '18px',
    paddingLeft: realReferenceMode ? '14px' : '18px',
    borderRadius: scalePxLength(geometry.radius, 0.78, '22px'),
    ...backgroundProps(context, containerName, '#242932'),
  });
  const certification = createCanvasNode(context, containerName, overlayBottom.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    width: realReferenceMode ? '183px' : undefined,
    flexBasis: realReferenceMode ? undefined : '52%',
    flexShrink: realReferenceMode ? 0 : undefined,
    minHeight: '150px',
  });
  addText(context, certification.id, 'Professional & certified experts', {
    fontSize: realReferenceMode ? '20px' : '24px',
    fontSizeMobile: '20px',
    lineHeight: realReferenceMode ? '1.5' : '1.25',
    fontWeight: realReferenceMode ? '400' : '500',
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    textColor: inkColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addMediaSurface(context, overlayBottom.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'careglo-overlay-proof'), {
    width: realReferenceMode ? '350px' : undefined,
    flexBasis: realReferenceMode ? undefined : '48%',
    flexShrink: realReferenceMode ? 0 : undefined,
    minHeight: '150px',
    minHeightTablet: '150px',
    minHeightMobile: '180px',
    borderRadius: '14px',
    backgroundPosition: 'center',
  });
  context.heroProofCards += 3;
}

function addHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidy = isMaidyProfile(context);
  const careglo = context.replacementProfile?.name === 'luxury-car-care';
  if (isLumenProfile(context)) {
    addLumenHeroSection(context, sectionName, containerName);
    return;
  }
  if (maidy) {
    addMaidyHeroSection(context, sectionName, containerName);
    return;
  }
  if (careglo) {
    addCaregloHeroSection(context, sectionName, containerName);
    return;
  }
  if (isOptomattaProfile(context)) {
    addOptomattaHeroSection(context, sectionName, containerName);
    return;
  }

  const heroProps = {
    paddingTop: '72px',
    paddingBottom: '84px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  };
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    ...heroProps,
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '48px',
    responsiveStack: 'tablet',
    minHeight: geometry.heroMinHeight,
    minHeightTablet: geometry.heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '20px',
    flexBasis: '46%',
  });

  addText(context, copy.id, eyebrowText(context.brief), {
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: '800',
    textColor: style.accent,
    backgroundColor: style.badgeBackground,
    paddingY: '8px',
    paddingX: '12px',
    borderRadius: '999px',
  });
  addHeading(context, copy.id, 'Thoughtful service, made easy to choose.', 'h1', {
    fontSize: '64px',
    fontSizeTablet: '52px',
    fontSizeMobile: '42px',
    lineHeight: '0.98',
    fontWeight: '900',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copy.id, context.replacementProfile.lead, {
    fontSize: '20px',
    fontSizeMobile: '16px',
    lineHeight: '1.55',
    textColor: style.muted,
  });
  addButton(context, copy.id, primaryAction(context.brief), '#');

  const media = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '20px',
    flexBasis: '54%',
  });
  addMediaSurface(context, media.id, 'hero', context.replacementProfile.hero, {
    width: '100%',
    minHeight: geometry.visualMinHeight,
    minHeightTablet: geometry.visualMinHeightTablet,
    minHeightMobile: geometry.visualMinHeightMobile,
    borderRadius: geometry.radius,
  });

  addHeroProofDeck(context, media.id);
}

function addOptomattaHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const realReferenceSourceUrl = typeof context.brief.authoringRequirements?.realReferenceSourceUrl === 'string'
    ? context.brief.authoringRequirements.realReferenceSourceUrl
    : '';
  const realReferenceMode = context.brief.authoringRequirements?.requireRealReference === true
    || /optomatta/i.test(realReferenceSourceUrl);
  const heroCompositeSource = realReferenceMode ? optomattaHeroCompositeSource() : '';
  const usesHeroComposite = heroCompositeSource !== '';
  const usesSplitHero = realReferenceMode && !usesHeroComposite;
  const heroMinHeight = realReferenceMode ? '704px' : scalePxLength(geometry.heroMinHeight, 0.73, geometry.heroMinHeightMobile);
  const heroMinHeightTablet = realReferenceMode ? geometry.heroMinHeightTablet : scalePxLength(geometry.heroMinHeightTablet, 0.6, '344px');
  const primaryCta = realReferenceMode
    ? context.replacementProfile.primaryCta || 'Plan an Eye Exam'
    : primaryAction(context.brief);
  const secondaryCta = realReferenceMode
    ? context.replacementProfile.secondaryCta || 'Explore Eyewear'
    : secondaryAction(context.brief, 'Ask optometrist');
  const eyebrow = context.replacementProfile.heroEyebrow || (realReferenceMode ? 'VISION & FRAME STUDIO' : 'OPTICAL CARE STUDIO');
  const lead = context.replacementProfile.lead;
  const heading = realReferenceMode
    ? context.replacementProfile.heroHeading || 'Clear vision, thoughtfully fitted'
    : firstHeading(context.brief);
  const copyMaxWidth = usesHeroComposite ? '566px' : realReferenceMode ? '50%' : '700px';
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '0px',
    paddingBottom: '0px',
    innerMaxWidth: usesHeroComposite ? '1240px' : realReferenceMode ? OPTOMATTA_CANVAS_WIDTH : geometry.innerMaxWidth,
    innerPaddingX: usesHeroComposite ? '20px' : realReferenceMode ? '0px' : '20px',
    minHeight: heroMinHeight,
    minHeightTablet: heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
    ...backgroundProps(context, sectionName, '#ffffff'),
    ...(usesSplitHero ? {} : {
      backgroundImage: heroCompositeSource || context.replacementProfile.hero,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }),
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: usesSplitHero ? 'stretch' : 'flex-start',
    gap: '0px',
    responsiveStack: usesSplitHero ? 'mobile' : 'tablet',
    minHeight: heroMinHeight,
    minHeightTablet: heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: '22px',
    flexBasis: usesSplitHero || usesHeroComposite ? copyMaxWidth : undefined,
    width: '100%',
    maxWidth: copyMaxWidth,
    maxWidthMobile: usesSplitHero ? '100%' : undefined,
    minWidth: '0px',
    paddingTop: realReferenceMode ? '132px' : '172px',
    paddingTopTablet: '42px',
    paddingTopMobile: '42px',
    paddingRight: usesSplitHero ? '34px' : '0px',
    paddingRightMobile: usesSplitHero ? '20px' : undefined,
    paddingBottom: '70px',
    paddingBottomTablet: '0px',
    paddingBottomMobile: '0px',
    paddingLeft: usesSplitHero ? '120px' : '0px',
    paddingLeftMobile: usesSplitHero ? '20px' : undefined,
    ...(usesHeroComposite ? {} : usesSplitHero ? {
      ...backgroundProps(context, containerName, '#ffffff'),
      backgroundImage: context.replacementProfile.secondary,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundOverlay: 'rgba(255, 255, 255, 0.78)',
    } : backgroundProps(context, containerName, 'rgba(255, 255, 255, 0.78)')),
  });
  addText(context, copy.id, eyebrow, {
    fontSize: '13px',
    lineHeight: '1.2',
    letterSpacing: '0.34em',
    fontWeight: '800',
    textTransform: 'uppercase',
    textColor: '#e96778',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, copy.id, heading, 'h1', {
    fontSize: '75px',
    fontSizeTablet: '52px',
    fontSizeMobile: realReferenceMode ? '42px' : '46px',
    lineHeight: '0.96',
    fontWeight: '900',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copy.id, lead, {
    fontSize: '20px',
    fontSizeTablet: '20px',
    fontSizeMobile: '16px',
    lineHeight: '1.42',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '14px',
  });
  const actions = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '12px',
    responsiveStack: 'mobile',
    width: '100%',
  });
  addButton(context, actions.id, primaryCta.toUpperCase(), '#', {
    paddingTop: '16px',
    paddingRight: '30px',
    paddingBottom: '16px',
    paddingLeft: '30px',
    borderRadius: '0px',
    fontSize: '14px',
    fontWeight: '800',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
  addButton(context, actions.id, secondaryCta.toUpperCase(), '#', {
    paddingTop: '16px',
    paddingRight: '30px',
    paddingBottom: '16px',
    paddingLeft: '30px',
    borderRadius: '0px',
    fontSize: '14px',
    fontWeight: '800',
    backgroundColor: '#ffffff',
    textColor: style.ink,
  });

  if (usesSplitHero) {
    addMediaSurface(context, wrap.id, 'hero', context.replacementProfile.hero, {
      flexBasis: '50%',
      width: '100%',
      minWidth: '0px',
      minHeight: heroMinHeight,
      minHeightTablet: geometry.heroMinHeightTablet,
      minHeightMobile: geometry.visualMinHeightMobile,
      borderRadius: '0px',
      backgroundPosition: 'center center',
    });
  }

  if (requiredRoleMinimum(context.brief, 'secondary') > 0) {
    const media = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      flexGrow: 1,
      minHeight: geometry.heroMinHeight,
      minHeightTablet: '0px',
      minHeightMobile: '0px',
      paddingTop: '0px',
      paddingRight: '64px',
      paddingBottom: '56px',
      paddingLeft: '0px',
      responsiveDisplay: 'hide-tablet-down',
    });
    addMediaSurface(context, media.id, 'secondary', context.replacementProfile.secondary, {
      width: '310px',
      minHeight: '220px',
      minHeightTablet: '0px',
      minHeightMobile: '0px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
  }

  context.heroProofCards += 1;
}

function addOptomattaProofStripSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const strip = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '54px',
    paddingBottom: '54px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const grid = createCanvasNode(context, containerName, strip.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '48px',
    responsiveStack: 'tablet',
  });
  const labels = h3Texts(context.brief);
  const stats = statItems(context.brief);
  const proofItems = (stats.length >= 3 ? stats : [
    { value: '28', label: 'doctors' },
    { value: '24h', label: 'service' },
    { value: '4.9', label: 'rating' },
  ]).slice(0, 3).map((item, index) => ({
    title: item.value || labels[index] || '',
    body: item.label || serviceCopy(context.replacementProfile, index),
  }));
  for (const item of proofItems) {
    const card = createCanvasNode(context, containerName, grid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '28px',
      paddingTop: '0px',
      paddingRight: '42px',
      paddingBottom: '0px',
      paddingLeft: '42px',
    });
    const valueRow = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '34px',
    });
    const iconBox = createCanvasNode(context, containerName, valueRow.id, {
      layoutDisplay: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '40px',
      minHeight: '40px',
      borderWidth: '3px',
      borderColor: style.accent,
    });
    addText(context, iconBox.id, '✓', {
      fontSize: '24px',
      lineHeight: '1',
      fontWeight: '800',
      textAlign: 'center',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, valueRow.id, item.title || item.value, {
      fontSize: '24px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: '#474747',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, item.body || item.label, {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: '#7a7a7a',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
}

function addOptomattaIntroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const section = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '82px',
    paddingBottom: '88px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const wrap = createCanvasNode(context, containerName, section.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '64px',
    responsiveStack: 'tablet',
  });
  const media = createCanvasNode(context, containerName, wrap.id, {
    flexBasis: '52%',
    minWidth: '0px',
  });
  addMediaSurface(context, media.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'optomatta-intro-clinic'), {
    width: '100%',
    minHeight: geometry.visualMinHeight,
    minHeightTablet: geometry.visualMinHeightTablet,
    minHeightMobile: geometry.visualMinHeightMobile,
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '22px',
    flexBasis: '48%',
    minWidth: '0px',
  });
  addText(context, copy.id, 'Who We Are', {
    display: 'inline-block',
    fontSize: '15px',
    lineHeight: '1.2',
    fontWeight: '700',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, copy.id, secondHeading(context.brief), 'h2', {
    fontSize: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.16',
    fontWeight: '700',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copy.id, 'A precise optical-care studio pairing exams, eyewear fitting, lens support, and everyday guidance in one clear customer path.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.62',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, copy.id, 'Discover more', '#', {
    paddingTop: '16px',
    paddingRight: '30px',
    paddingBottom: '16px',
    paddingLeft: '30px',
    borderRadius: '0px',
    fontSize: '14px',
    fontWeight: '800',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
}

function addOptomattaHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;

  const frameSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '96px',
    paddingBottom: '96px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const frameWrap = createCanvasNode(context, containerName, frameSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '32px',
    responsiveStack: 'tablet',
  });
  const frameCopy = createCanvasNode(context, containerName, frameWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '28px',
    flexBasis: '38%',
    minWidth: '0px',
  });
  addText(context, frameCopy.id, 'Frame Selection', {
    fontSize: '15px',
    lineHeight: '1.2',
    fontWeight: '800',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, frameCopy.id, 'Everyday eyewear shaped around personal fit, lasting comfort, and effortless style.', 'h2', {
    fontSize: '48px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, frameCopy.id, 'Our opticians explain lens choices, frame fit, and the next appointment step in clear, practical language.', {
    fontSize: '17px',
    fontSizeMobile: '16px',
    lineHeight: '1.62',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, frameCopy.id, 'Browse frames', '#', {
    borderRadius: '0px',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
  const frameMediaGrid = createCanvasNode(context, containerName, frameWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '22px',
    flexBasis: '62%',
    minWidth: '0px',
    responsiveStack: 'mobile',
  });
  addMediaSurface(context, frameMediaGrid.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[0], 'optomatta-frame-wall'), {
    minHeight: '520px',
    minHeightTablet: '420px',
    minHeightMobile: '300px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  const stackedMedia = createCanvasNode(context, containerName, frameMediaGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '22px',
  });
  addMediaSurface(context, stackedMedia.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[1], 'optomatta-fitting-detail'), {
    minHeight: '249px',
    minHeightTablet: '200px',
    minHeightMobile: '220px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  addMediaSurface(context, stackedMedia.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[2], 'optomatta-lens-care'), {
    minHeight: '249px',
    minHeightTablet: '200px',
    minHeightMobile: '220px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });

  const processSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '94px',
    paddingBottom: '94px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const processIntro = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '32px',
    responsiveStack: 'tablet',
  });
  addHeading(context, processIntro.id, 'A simple path from eye exam to fitted frames.', 'h2', {
    fontSize: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, processIntro.id, 'Each step is explained with calm guidance, clinical expertise, and confidence about what comes next.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const processGrid = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '26px',
    responsiveStack: 'tablet',
    paddingTop: '46px',
  });
  const processItems = [
    ['01', 'Book an eye exam', 'Choose a convenient time and tell us what you would like help seeing more clearly.'],
    ['02', 'Choose your frame', 'Compare styles, comfort, lens options, and fit with an experienced optician.'],
    ['03', 'Collect and adjust', 'Pick up your eyewear with a precise adjustment and practical lens-care advice.'],
  ];
  for (const [number, title, body] of processItems) {
    const card = createCanvasNode(context, containerName, processGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '20px',
      paddingTop: '34px',
      paddingRight: '30px',
      paddingBottom: '34px',
      paddingLeft: '30px',
      minHeight: '420px',
      ...backgroundProps(context, containerName, style.bg),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[(Number(number) - 1) % context.replacementProfile.serviceCard.length], `optomatta-process-${number}`), {
      width: '100%',
      minHeight: '168px',
      minHeightTablet: '154px',
      minHeightMobile: '180px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    addText(context, card.id, number, {
      fontSize: '42px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '26px',
      fontSizeMobile: '22px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '16px',
      lineHeight: '1.55',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const appointmentSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '104px',
    paddingBottom: '67px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const appointmentWrap = createCanvasNode(context, containerName, appointmentSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '0px',
    responsiveStack: 'tablet',
    ...backgroundProps(context, containerName, style.accent),
  });
  const appointmentMedia = createCanvasNode(context, containerName, appointmentWrap.id, {
    flexBasis: '50%',
    minWidth: '0px',
  });
  addMediaSurface(context, appointmentMedia.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'optomatta-appointment-exam'), {
    minHeight: '560px',
    minHeightTablet: '420px',
    minHeightMobile: '300px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  const appointmentCopy = createCanvasNode(context, containerName, appointmentWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    flexBasis: '50%',
    minWidth: '0px',
    paddingTop: '68px',
    paddingRight: '68px',
    paddingBottom: '68px',
    paddingLeft: '68px',
  });
  addText(context, appointmentCopy.id, 'Appointment Ready', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: 'rgba(255, 255, 255, 0.76)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, appointmentCopy.id, 'Move from frame browsing to expert guidance with ease.', 'h2', {
    fontSize: '46px',
    fontSizeMobile: '32px',
    lineHeight: '1.1',
    fontWeight: '800',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, appointmentCopy.id, 'Speak with an optometrist, confirm a convenient appointment, and get practical answers before your visit.', {
    fontSize: '17px',
    lineHeight: '1.62',
    textColor: 'rgba(255, 255, 255, 0.82)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, appointmentCopy.id, 'Ask optometrist', '#', {
    borderRadius: '0px',
    backgroundColor: '#ffffff',
    textColor: style.ink,
  });

  const reviewsSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '98px',
    paddingBottom: '110px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const reviewsGrid = createCanvasNode(context, containerName, reviewsSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '26px',
    responsiveStack: 'tablet',
  });
  const reviews = [
    ['4.8', 'Average patient rating', 'Patients value patient explanations, comfortable fittings, and thoughtful follow-up.'],
    ['24h', 'Fast appointment follow-up', 'Questions receive a prompt answer so every visit begins with clear expectations.'],
    ['300+', 'Frames fitted monthly', 'Experienced opticians balance personal style, lens needs, and all-day comfort.'],
  ];
  for (const [index, [value, title, body]] of reviews.entries()) {
    const card = createCanvasNode(context, containerName, reviewsGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '28px',
      minHeight: '460px',
      paddingTop: '34px',
      paddingRight: '32px',
      paddingBottom: '34px',
      paddingLeft: '32px',
      ...backgroundProps(context, containerName, style.bg),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length], `optomatta-trust-${index + 1}`), {
      width: '100%',
      minHeight: '176px',
      minHeightTablet: '160px',
      minHeightMobile: '190px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    addText(context, card.id, value, {
      fontSize: '54px',
      lineHeight: '1',
      fontWeight: '900',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '26px',
      lineHeight: '1.16',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '16px',
      lineHeight: '1.56',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const finalSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '120px',
    paddingBottom: '130px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.ink),
    backgroundImage: mediaVariant(context.replacementProfile.hero, 'optomatta-final-cta'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOverlay: 'rgba(9, 13, 19, 0.78)',
  });
  const finalWrap = createCanvasNode(context, containerName, finalSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '30px',
    textAlign: 'center',
  });
  addText(context, finalWrap.id, 'YOUR NEXT PAIR', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, finalWrap.id, 'Ready for eyewear that feels right all day?', 'h2', {
    fontSize: '52px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    fontWeight: '800',
    textAlign: 'center',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, finalWrap.id, '+1 (415) 555-0186', {
    fontSize: '24px',
    lineHeight: '1.2',
    fontWeight: '800',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, finalWrap.id, 'Book eye exam', '#', {
    borderRadius: '0px',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
}

function addLumenHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const heroStats = [
    { value: '10K+', label: 'Visits supported' },
    { value: '15+', label: 'Years of practice' },
  ];
  const doctorSource = `${context.replacementProfile.hero}${context.replacementProfile.hero.includes('?') ? '&' : '?'}ix=monteby-lumen-doctor`;
  const doctorCutoutSource = lumenDoctorCutoutSource() || doctorSource;
  const usesCutoutDoctor = isTransparentCutoutSource(doctorCutoutSource);
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '84px',
    paddingTopTablet: '34px',
    paddingTopMobile: '24px',
    paddingBottom: '0px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '952px',
    minHeightTablet: '1014px',
    minHeightMobile: '1305px',
    ...backgroundProps(context, sectionName, style.bg),
    ...(usesCutoutDoctor
      ? {
        backgroundType: 'gradient',
        gradientType: 'linear',
        gradientAngle: 105,
        gradientColor1: '#e8fbef',
        gradientColor2: '#fbffdf',
        backgroundAccentType: 'radial',
        backgroundAccentColor1: 'rgba(47, 214, 120, 0.22)',
        backgroundAccentColor2: 'rgba(248, 255, 220, 0)',
        backgroundAccentPositionX: '46%',
        backgroundAccentPositionY: '40%',
        backgroundAccentSize: '72%',
      }
      : {
        backgroundImage: context.replacementProfile.hero,
        backgroundSize: 'contain',
        backgroundPosition: 'left bottom',
        backgroundRepeat: 'no-repeat',
        backgroundOverlay: 'rgba(238, 251, 227, 0.82)',
      }),
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const intro = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '110px',
    gapTablet: '40px',
    gapMobile: '20px',
    responsiveStack: 'tablet',
    gridColumnStart: 1,
    gridRowStart: 1,
  });
  const eyebrowColumn = createCanvasNode(context, containerName, intro.id, {
    flexBasis: '139px',
    flexShrink: 0,
    paddingTop: '40px',
    paddingTopTablet: '0px',
    paddingTopMobile: '0px',
  });
  addText(context, eyebrowColumn.id, 'EYE CARE CENTER', {
    fontSize: '14px',
    fontSizeTablet: '14px',
    fontSizeMobile: '14px',
    lineHeight: '1.25',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.1em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const headlineColumn = createCanvasNode(context, containerName, intro.id, {
    flexBasis: '836px',
    flexShrink: 0,
    width: '836px',
  });
  const headingStack = createCanvasNode(context, containerName, headlineColumn.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0px',
    width: '100%',
  });
  const firstLine = createCanvasNode(context, containerName, headingStack.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    justifyContentMobile: 'center',
    width: '100%',
  });
  addHeading(context, firstLine.id, 'Clear Sight.', 'h1', {
    fontSize: '120px',
    fontSizeTablet: '80px',
    fontSizeMobile: '60px',
    lineHeight: '1.1',
    lineHeightTablet: '1',
    lineHeightMobile: '1.2',
    fontWeight: '600',
    fontFamily: 'Outfit',
    textAlign: 'left',
    textAlignMobile: 'center',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const secondLine = createCanvasNode(context, containerName, headingStack.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    justifyContentMobile: 'center',
    width: '100%',
    paddingLeft: '200px',
    paddingLeftTablet: '310px',
    paddingLeftMobile: '0px',
  });
  addHeading(context, secondLine.id, 'Bright Days.', 'h1', {
    fontSize: '120px',
    fontSizeTablet: '80px',
    fontSizeMobile: '60px',
    lineHeight: '1.1',
    lineHeightTablet: '1',
    lineHeightMobile: '1.2',
    fontWeight: '600',
    fontFamily: 'Outfit',
    textAlign: 'left',
    textAlignMobile: 'center',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const details = createCanvasNode(context, containerName, headlineColumn.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
    width: '755px',
    maxWidthTablet: '100%',
    maxWidthMobile: '100%',
    paddingTop: '20px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '325px',
    paddingLeftTablet: '0px',
    paddingLeftMobile: '0px',
  });
  addText(context, details.id, 'Clearwell pairs attentive examinations with practical guidance, so every visit ends with an understandable next step.', {
    fontSize: '16px',
    fontSizeMobile: '15px',
    lineHeight: '1.5',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const actions = createCanvasNode(context, containerName, details.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  });
  addButton(context, actions.id, 'Book Now', '#', {
    backgroundColor: style.accent2,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });
  addButton(context, actions.id, 'Explore Services', '#', {
    backgroundColor: style.ink,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });

  const stage = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '0px',
    responsiveStack: 'tablet',
    gridColumnStart: 1,
    gridRowStart: 1,
    paddingTop: '338px',
    paddingTopTablet: '370px',
    paddingTopMobile: '490px',
  });
  const mediaColumn = createCanvasNode(context, containerName, stage.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    flexBasis: '552px',
    flexShrink: 0,
    width: '552px',
    minHeight: '530px',
    minHeightTablet: '100px',
    minHeightMobile: '100px',
  });
  if (usesCutoutDoctor) {
    const doctorOffset = createCanvasNode(context, containerName, mediaColumn.id, {
      gridColumnStart: 1,
      gridRowStart: 1,
      width: '552px',
      paddingLeft: '110px',
      responsiveDisplay: 'hide-tablet-down',
    });
    createCanvasNode(context, containerName, doctorOffset.id, {
      width: '440px',
      minHeight: '530px',
      backgroundImage: doctorCutoutSource,
      backgroundSize: 'contain',
      backgroundPosition: 'right',
      backgroundRepeat: 'no-repeat',
    });
  } else {
    const doctorOffset = createCanvasNode(context, containerName, mediaColumn.id, {
      gridColumnStart: 1,
      gridRowStart: 1,
      width: '552px',
      paddingLeft: '110px',
      responsiveDisplay: 'hide-tablet-down',
    });
    addMediaSurface(context, doctorOffset.id, 'hero', doctorCutoutSource, {
      width: '440px',
      minHeight: '530px',
      borderRadius: '0px',
      backgroundPosition: 'top',
    });
  }
  const desktopStats = createCanvasNode(context, containerName, mediaColumn.id, {
    gridColumnStart: 1,
    gridRowStart: 1,
    width: '330px',
    paddingTop: '290px',
    responsiveDisplay: 'hide-tablet-down',
  });
  addLumenStatsRow(context, desktopStats.id, heroStats);
  const responsiveStats = createCanvasNode(context, containerName, mediaColumn.id, {
    gridColumnStart: 1,
    gridRowStart: 1,
    width: '330px',
    paddingLeftMobile: '33px',
    responsiveDisplay: 'show-tablet-down-only',
  });
  addLumenStatsRow(context, responsiveStats.id, heroStats);

  const middleColumn = createCanvasNode(context, containerName, stage.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexBasis: '344px',
    flexShrink: 0,
    width: '344px',
    paddingTop: '163px',
    paddingTopTablet: '84px',
    paddingTopMobile: '84px',
  });
  addMediaSurface(context, middleColumn.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'lumen-hero-mini'), {
    width: '100%',
    maxWidth: '235px',
    maxWidthTablet: '235px',
    maxWidthMobile: '100%',
    minHeight: '156px',
    minHeightTablet: '150px',
    minHeightMobile: '232px',
    borderRadius: '10px',
    backgroundPosition: 'center',
  });

  const proofColumn = createCanvasNode(context, containerName, stage.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexBasis: '338px',
    flexShrink: 0,
    width: '338px',
    paddingTop: '247px',
    paddingTopTablet: '0px',
    paddingTopMobile: '0px',
    paddingBottom: '0px',
  });
  addHeroProofCard(context, proofColumn.id);
}

function addLumenStatsRow(context, parentId, heroStats) {
  const style = context.styleProfile;
  const containerName = findComponent(context.contractIndex, ['Container'])?.name || 'Container';
  const statsRow = createCanvasNode(context, containerName, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '72px',
    gapTablet: '72px',
    gapMobile: '60px',
    width: '330px',
  });
  for (const item of heroStats) {
    const stat = createCanvasNode(context, containerName, statsRow.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });
    addHeading(context, stat.id, item.value, 'h2', {
      fontSize: '60px',
      fontSizeTablet: '50px',
      fontSizeMobile: '50px',
      lineHeight: '1.2',
      fontWeight: '600',
      fontFamily: 'Outfit',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, stat.id, item.label, {
      fontSize: '12px',
      fontSizeMobile: '11px',
      lineHeight: '1.35',
      fontFamily: 'Manrope',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
}

function addLumenHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;

  const careSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '70px',
    paddingTopTablet: '70px',
    paddingTopMobile: '70px',
    paddingBottom: '70px',
    paddingBottomTablet: '70px',
    paddingBottomMobile: '70px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '690px',
    minHeightTablet: '1210px',
    minHeightMobile: '1233px',
    ...backgroundProps(context, sectionName, '#f7fff0'),
  });
  const careWrap = createCanvasNode(context, containerName, careSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '56px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const careMedia = createCanvasNode(context, containerName, careWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '16px',
    flexBasis: '47%',
    minWidth: '0px',
  });
  addMediaSurface(context, careMedia.id, 'service-card', mediaVariant(context.replacementProfile.serviceCard[0], 'lumen-intro-wide'), {
    width: '100%',
    minHeight: '220px',
    minHeightTablet: '240px',
    minHeightMobile: '220px',
    gridColumnSpan: 2,
    gridColumnSpanMobile: 1,
    borderRadius: geometry.mediaRadius,
    backgroundPosition: 'center',
  });
  for (const [index, source] of [context.replacementProfile.secondary, context.replacementProfile.serviceCard[1]].entries()) {
    addMediaSurface(context, careMedia.id, 'service-card', mediaVariant(source, `lumen-intro-detail-${index + 1}`), {
      width: '100%',
      minHeight: '180px',
      minHeightTablet: '220px',
      minHeightMobile: '220px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'center',
    });
  }
  const careCopy = createCanvasNode(context, containerName, careWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '24px',
    flexBasis: '53%',
    minWidth: '0px',
  });
  addText(context, careCopy.id, 'CARE IN CONTEXT', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, careCopy.id, 'A clearer plan starts with a calm first conversation.', 'h2', {
    fontSize: '54px',
    fontSizeTablet: '48px',
    fontSizeMobile: '38px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, careCopy.id, 'Thoughtful diagnostics, plain-language guidance, and a steady pace make each decision easier to understand.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.66',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, careCopy.id, 'Plan a first visit', '#', {
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });

  const serviceSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '90px',
    paddingTopMobile: '90px',
    paddingBottom: '90px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '90px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '954px',
    minHeightTablet: '1447px',
    minHeightMobile: '1925px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const serviceIntro = createCanvasNode(context, containerName, serviceSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '42px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addHeading(context, serviceIntro.id, 'Everyday care for changing eyes and busy lives.', 'h2', {
    fontSize: '50px',
    fontSizeMobile: '36px',
    lineHeight: '1.08',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, serviceIntro.id, 'From routine checks to focused treatment, each service keeps the purpose and the next step in view.', {
    fontSize: '17px',
    lineHeight: '1.58',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const serviceGrid = createCanvasNode(context, containerName, serviceSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '28px',
    paddingTop: '52px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  for (const [index, label] of ['Vision reviews', 'Comfort therapy', 'Lens guidance'].entries()) {
    const card = createCanvasNode(context, containerName, serviceGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '24px',
      paddingTop: '28px',
      paddingRight: '28px',
      paddingBottom: '32px',
      paddingLeft: '28px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
      boxShadow: 'soft',
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length], `lumen-service-${index + 1}`), {
      width: '100%',
      minHeight: '280px',
      minHeightTablet: '300px',
      minHeightMobile: '300px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'center',
    });
    addHeading(context, card.id, label, 'h3', {
      fontSize: '30px',
      fontSizeMobile: '24px',
      lineHeight: '1.15',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, serviceCopy(context.replacementProfile, index), {
      fontSize: '16px',
      lineHeight: '1.58',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const processSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '60px',
    paddingTopTablet: '80px',
    paddingTopMobile: '50px',
    paddingBottom: '60px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '50px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '592px',
    minHeightTablet: '1222px',
    minHeightMobile: '972px',
    ...backgroundProps(context, sectionName, '#e8f7dd'),
  });
  const processGrid = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '54px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const processCopy = createCanvasNode(context, containerName, processGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '22px',
  });
  addText(context, processCopy.id, 'WHEN SIGHT CHANGES', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, processCopy.id, 'Prompt support when clarity cannot wait.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, processCopy.id, 'A focused consultation helps identify sudden discomfort, visual changes, and the safest next action without adding confusion.', {
    fontSize: '17px',
    fontSizeMobile: '15px',
    lineHeight: '1.62',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, processCopy.id, 'Request prompt care', '#', {
    backgroundColor: style.accent2,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });
  addMediaSurface(context, processGrid.id, 'reference-media', mediaVariant(lumenDoctorCutoutSource() || context.replacementProfile.hero, 'lumen-prompt-care'), {
    width: '100%',
    minHeight: '472px',
    minHeightTablet: '520px',
    minHeightMobile: '380px',
    borderRadius: geometry.radius,
    backgroundSize: 'contain',
    backgroundPosition: 'bottom',
  });

  const technologySection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '100px',
    paddingTopTablet: '100px',
    paddingTopMobile: '80px',
    paddingBottom: '100px',
    paddingBottomTablet: '100px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '826px',
    minHeightTablet: '1440px',
    minHeightMobile: '1391px',
    ...backgroundProps(context, sectionName, '#f8ffef'),
  });
  const technologyGrid = createCanvasNode(context, containerName, technologySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '54px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const technologyCopy = createCanvasNode(context, containerName, technologyGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    gridColumnStart: 2,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    paddingTop: '36px',
    paddingRight: '36px',
    paddingBottom: '36px',
    paddingLeft: '36px',
    borderRadius: geometry.cardRadius,
    ...backgroundProps(context, containerName, style.cardBackground),
  });
  addText(context, technologyCopy.id, 'OUR APPROACH', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, technologyCopy.id, 'Clinical focus, human conversations.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, technologyCopy.id, 'Careful imaging supports the clinical work, while patient explanations keep every finding connected to daily life.', {
    fontSize: '17px',
    lineHeight: '1.65',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const technologyStats = createCanvasNode(context, containerName, technologyCopy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    gap: '42px',
  });
  for (const [value, label] of [['48K+', 'care moments'], ['24K+', 'follow-ups']]) {
    const stat = createCanvasNode(context, containerName, technologyStats.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });
    addHeading(context, stat.id, value, 'h3', {
      fontSize: '42px',
      fontSizeMobile: '34px',
      lineHeight: '1',
      fontWeight: '600',
      fontFamily: 'Outfit',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, stat.id, label, {
      fontSize: '12px',
      lineHeight: '1.35',
      fontFamily: 'Manrope',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  const technologyMedia = createCanvasNode(context, containerName, technologyGrid.id, {
    minWidth: '0px',
    gridColumnStart: 1,
    gridRowStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
  });
  addMediaSurface(context, technologyMedia.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'lumen-approach'), {
    width: '100%',
    minHeight: '626px',
    minHeightTablet: '520px',
    minHeightMobile: '420px',
    borderRadius: geometry.radius,
    backgroundPosition: 'center',
  });

  const trustSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '90px',
    paddingTopMobile: '90px',
    paddingBottom: '90px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '90px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '1019px',
    minHeightTablet: '1564px',
    minHeightMobile: '2710px',
    ...backgroundProps(context, sectionName, '#e8f7dd'),
  });
  const trustWrap = createCanvasNode(context, containerName, trustSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '44px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const trustIntro = createCanvasNode(context, containerName, trustWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '42px',
    responsiveStack: 'tablet',
  });
  addHeading(context, trustIntro.id, 'Experienced eyes on every detail.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, trustIntro.id, 'A compact team of clinicians brings focused experience to preventive care, optics, comfort, and long-term follow-up.', {
    fontSize: '17px',
    lineHeight: '1.6',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const trustGrid = createCanvasNode(context, containerName, trustWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '26px',
  });
  const trustItems = [
    ['Mara Venn', 'Preventive care', context.replacementProfile.serviceCard[0]],
    ['Jon Bell', 'Clinical optics', context.replacementProfile.serviceCard[1]],
    ['Inez Park', 'Comfort therapy', context.replacementProfile.serviceCard[2]],
    ['Owen Reed', 'Family vision', lumenDoctorCutoutSource() || context.replacementProfile.hero],
  ];
  for (const [index, item] of trustItems.entries()) {
    const [name, focus, source] = item;
    const card = createCanvasNode(context, containerName, trustGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '22px',
      paddingLeft: '18px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(source, `lumen-specialist-${index + 1}`), {
      width: '100%',
      minHeight: '330px',
      minHeightTablet: '330px',
      minHeightMobile: '360px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'top',
    });
    addHeading(context, card.id, name, 'h3', {
      fontSize: '22px',
      fontSizeMobile: '22px',
      lineHeight: '1.18',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, focus, {
      fontSize: '14px',
      lineHeight: '1.45',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const whySection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '80px',
    paddingTopTablet: '80px',
    paddingTopMobile: '80px',
    paddingBottom: '92px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '1143px',
    minHeightTablet: '1436px',
    minHeightMobile: '2280px',
    ...backgroundProps(context, sectionName, style.ink),
  });
  const whyWrap = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '42px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addText(context, whyWrap.id, 'WHY CLEARWELL', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent2,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, whyWrap.id, 'Better tools. Better explanations. Better follow-through.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const whyGrid = createCanvasNode(context, containerName, whyWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
  });
  const whyItems = [
    ['Focused imaging', 'Sharper diagnostics give each conversation a useful starting point.', context.replacementProfile.serviceCard[0]],
    ['Plain-language notes', 'Clear summaries connect clinical findings to work, travel, and home routines.', ''],
    ['Comfort-led testing', 'A measured pace creates room for questions and more confident answers.', context.replacementProfile.serviceCard[1]],
    ['Care continuity', 'Follow-up remains connected to the same plan instead of becoming a separate task.', ''],
    ['Useful adjustments', 'Small changes to lenses, habits, and timing can make everyday vision feel easier.', context.replacementProfile.serviceCard[2]],
    ['Thoughtful access', 'Scheduling and support stay straightforward when a new concern appears.', ''],
  ];
  for (const [index, item] of whyItems.entries()) {
    const [title, body, source] = item;
    const card = createCanvasNode(context, containerName, whyGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '18px',
      minHeight: source ? '330px' : '250px',
      paddingTop: '22px',
      paddingRight: '22px',
      paddingBottom: '24px',
      paddingLeft: '22px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, source ? '#102d38' : '#0b2330'),
    });
    if (source) {
      addMediaSurface(context, card.id, 'reference-media', mediaVariant(source, `lumen-why-${index + 1}`), {
        width: '100%',
        minHeight: '210px',
        minHeightTablet: '220px',
        minHeightMobile: '240px',
        borderRadius: geometry.mediaRadius,
        backgroundPosition: 'center',
      });
    } else {
      addText(context, card.id, `0${index + 1}`, {
        fontSize: '34px',
        lineHeight: '1',
        fontWeight: '600',
        fontFamily: 'Outfit',
        textColor: style.accent2,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addHeading(context, card.id, title, 'h3', {
      fontSize: '22px',
      lineHeight: '1.18',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: '#ffffff',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '14px',
      lineHeight: '1.55',
      fontFamily: 'Manrope',
      textColor: '#b6cbd2',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const testimonialSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '100px',
    paddingTopTablet: '100px',
    paddingTopMobile: '80px',
    paddingBottom: '100px',
    paddingBottomTablet: '100px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '899px',
    minHeightTablet: '1434px',
    minHeightMobile: '1323px',
    ...backgroundProps(context, sectionName, '#f8ffef'),
  });
  const testimonialGrid = createCanvasNode(context, containerName, testimonialSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '56px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const testimonialCopy = createCanvasNode(context, containerName, testimonialGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
  });
  addText(context, testimonialCopy.id, 'PATIENT PERSPECTIVE', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, testimonialCopy.id, 'Care that feels considered from the first question.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialCopy.id, '“The team explained each finding in a way that felt calm and useful. I left knowing what mattered now and what could wait.”', {
    fontSize: '21px',
    fontSizeMobile: '18px',
    lineHeight: '1.55',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialCopy.id, 'Elena Morris · patient since 2022', {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '700',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addMediaSurface(context, testimonialGrid.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'lumen-patient-story'), {
    width: '100%',
    minHeight: '659px',
    minHeightTablet: '520px',
    minHeightMobile: '420px',
    borderRadius: geometry.radius,
    backgroundPosition: 'center',
  });

  const certificationSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '80px',
    paddingTopMobile: '80px',
    paddingBottom: '90px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '710px',
    minHeightTablet: '982px',
    minHeightMobile: '1576px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const certificationWrap = createCanvasNode(context, containerName, certificationSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '38px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addText(context, certificationWrap.id, 'PRACTICE STANDARDS', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, certificationWrap.id, 'Independent standards, consistently applied.', 'h2', {
    fontSize: '44px',
    fontSizeTablet: '40px',
    fontSizeMobile: '32px',
    lineHeight: '1.15',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textAlign: 'center',
    textAlignMobile: 'center',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const certificationGrid = createCanvasNode(context, containerName, certificationWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
    width: '100%',
  });
  for (const [index, item] of [
    ['Clinical review', 'Annual practice review keeps care standards current and accountable.'],
    ['Equipment checks', 'Routine calibration supports consistent imaging and dependable findings.'],
    ['Care protocols', 'Documented procedures give each visit a steady clinical foundation.'],
    ['Patient confidence', 'Clear consent and plain explanations remain part of every decision.'],
  ].entries()) {
    const [title, body] = item;
    const card = createCanvasNode(context, containerName, certificationGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '210px',
      paddingTop: '26px',
      paddingRight: '24px',
      paddingBottom: '26px',
      paddingLeft: '24px',
      borderRadius: geometry.cardRadius,
      borderWidth: '1px',
      borderColor: '#d9e9d1',
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addText(context, card.id, `0${index + 1}`, {
      fontSize: '28px',
      lineHeight: '1',
      fontWeight: '600',
      fontFamily: 'Outfit',
      textColor: style.accent2,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '20px',
      lineHeight: '1.2',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '14px',
      lineHeight: '1.55',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const finalSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '80px',
    paddingTopTablet: '70px',
    paddingTopMobile: '60px',
    paddingBottom: '80px',
    paddingBottomTablet: '70px',
    paddingBottomMobile: '60px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '594px',
    minHeightTablet: '504px',
    minHeightMobile: '498px',
    ...backgroundProps(context, sectionName, style.ink),
    backgroundImage: mediaVariant(context.replacementProfile.serviceCard[1], 'lumen-booking-band'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOverlay: 'rgba(6, 26, 39, 0.78)',
  });
  const finalWrap = createCanvasNode(context, containerName, finalSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '26px',
    textAlign: 'center',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addText(context, finalWrap.id, 'PLAN YOUR VISIT', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, finalWrap.id, 'Make space for clearer sight.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textAlign: 'center',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, finalWrap.id, 'Choose a visit time', '#', {
    backgroundColor: style.accent,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });

  const articleSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '90px',
    paddingTopMobile: '90px',
    paddingBottom: '90px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '90px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '977px',
    minHeightTablet: '1812px',
    minHeightMobile: '1904px',
    ...backgroundProps(context, sectionName, '#f8ffef'),
  });
  const articleWrap = createCanvasNode(context, containerName, articleSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '46px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const articleIntro = createCanvasNode(context, containerName, articleWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '42px',
    responsiveStack: 'tablet',
  });
  addHeading(context, articleIntro.id, 'Useful guidance for everyday vision.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, articleIntro.id, 'Short reads on comfort, eyewear, screen habits, and the signs worth discussing at a future visit.', {
    fontSize: '16px',
    lineHeight: '1.6',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const articleGrid = createCanvasNode(context, containerName, articleWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '26px',
    responsiveStack: 'tablet',
  });
  const articles = [
    ['Screen comfort that lasts beyond the workday', 'Small distance, lighting, and break changes can reduce unnecessary visual strain.', context.replacementProfile.serviceCard[0]],
    ['Choosing lenses around the way you move', 'Daily routines offer better clues than trends when comparing lens options.', context.replacementProfile.serviceCard[1]],
    ['When a vision change deserves a closer look', 'A simple symptom record can make an upcoming conversation more useful.', context.replacementProfile.serviceCard[2]],
  ];
  for (const [index, article] of articles.entries()) {
    const [title, body, source] = article;
    const card = createCanvasNode(context, containerName, articleGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '24px',
      paddingLeft: '18px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(source, `lumen-article-${index + 1}`), {
      width: '100%',
      minHeight: '300px',
      minHeightTablet: '340px',
      minHeightMobile: '320px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'center',
    });
    addText(context, card.id, 'FIELD NOTE', {
      fontSize: '12px',
      lineHeight: '1.2',
      fontWeight: '700',
      fontFamily: 'Manrope',
      letterSpacing: '0.14em',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '24px',
      fontSizeMobile: '22px',
      lineHeight: '1.18',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '14px',
      lineHeight: '1.55',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const footerSection = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'footer',
    paddingTop: '90px',
    paddingTopTablet: '80px',
    paddingTopMobile: '80px',
    paddingBottom: '90px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '681px',
    minHeightTablet: '873px',
    minHeightMobile: '1563px',
    ...backgroundProps(context, sectionName, style.ink),
  });
  const footerWrap = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '64px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const footerTop = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '64px',
    responsiveStack: 'tablet',
  });
  const footerBrand = createCanvasNode(context, containerName, footerTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addHeading(context, footerBrand.id, 'CLEARWELL', 'h2', {
    fontSize: '34px',
    lineHeight: '1',
    fontWeight: '600',
    fontFamily: 'Outfit',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBrand.id, 'Calm eye care, useful explanations, and practical support for clearer days.', {
    fontSize: '15px',
    lineHeight: '1.6',
    fontFamily: 'Manrope',
    textColor: '#b6cbd2',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const footerSignup = createCanvasNode(context, containerName, footerTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '16px',
  });
  addHeading(context, footerSignup.id, 'Occasional notes for healthier visual routines.', 'h3', {
    fontSize: '26px',
    fontSizeMobile: '23px',
    lineHeight: '1.2',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerSignup.id, 'Monthly ideas on comfort, lenses, appointments, and everyday eye habits.', {
    fontSize: '14px',
    lineHeight: '1.55',
    fontFamily: 'Manrope',
    textColor: '#b6cbd2',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, footerSignup.id, 'Join the note list', '#', {
    backgroundColor: style.accent2,
    textColor: style.ink,
    fontFamily: 'Manrope',
  });
  const footerLinks = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'three',
    gridTemplateColumnsMobile: 'one',
    gap: '36px',
  });
  for (const [title, links] of [
    ['Visit', ['Appointments', 'First visits', 'Prompt care']],
    ['Care', ['Vision reviews', 'Comfort therapy', 'Lens guidance']],
    ['Connect', ['Journal', 'Questions', 'Accessibility']],
  ]) {
    const column = createCanvasNode(context, containerName, footerLinks.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });
    addHeading(context, column.id, title, 'h3', {
      fontSize: '18px',
      lineHeight: '1.2',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: '#ffffff',
      marginTop: '0px',
      marginBottom: '0px',
    });
    for (const link of links) {
      addText(context, column.id, link, {
        fontSize: '14px',
        lineHeight: '1.5',
        fontFamily: 'Manrope',
        textColor: '#b6cbd2',
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
  }
  const footerBottom = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '24px',
    responsiveStack: 'mobile',
  });
  addText(context, footerBottom.id, 'Clearwell Eye Care', {
    fontSize: '12px',
    lineHeight: '1.4',
    fontFamily: 'Manrope',
    textColor: '#829aa4',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBottom.id, 'Care information for everyday use.', {
    fontSize: '12px',
    lineHeight: '1.4',
    fontFamily: 'Manrope',
    textColor: '#829aa4',
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function addCaregloHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const serviceImages = context.replacementProfile.serviceCard;
  const iconComponent = findComponent(context.contractIndex, ['IconBlock']);

  const resultSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '104px',
    paddingTopTablet: '82px',
    paddingTopMobile: '72px',
    paddingBottom: '0px',
    paddingBottomTablet: '82px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const resultPanel = createCanvasNode(context, containerName, resultSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '44px',
    gapTablet: '36px',
    gapMobile: '28px',
    paddingTop: '54px',
    paddingTopTablet: '42px',
    paddingTopMobile: '28px',
    paddingRight: '54px',
    paddingRightTablet: '42px',
    paddingRightMobile: '24px',
    paddingBottom: '54px',
    paddingBottomTablet: '42px',
    paddingBottomMobile: '28px',
    paddingLeft: '54px',
    paddingLeftTablet: '42px',
    paddingLeftMobile: '24px',
    borderRadius: geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
  });
  const resultIntro = createCanvasNode(context, containerName, resultPanel.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    maxWidth: '940px',
  });
  addText(context, resultIntro.id, '/Signature result', {
    fontSize: '17px',
    lineHeight: '1.35',
    fontWeight: '400',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, resultIntro.id, 'A finish that changes how every drive feels.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '42px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    fontWeight: '600',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'left',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, resultIntro.id, 'Paint, trim, glass, and cabin surfaces leave the studio with a deliberate finish and a clear after-care plan.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.58',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'left',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const resultGrid = createCanvasNode(context, containerName, resultPanel.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'six',
    gridTemplateColumnsTablet: 'one',
    gridTemplateColumnsMobile: 'one',
    gap: '28px',
    gapTablet: '24px',
    gapMobile: '20px',
  });
  addMediaSurface(context, resultGrid.id, 'reference-media', mediaVariant(context.replacementProfile.hero, 'careglo-result-wide'), {
    gridColumnSpan: 4,
    gridColumnSpanTablet: 1,
    gridColumnSpanMobile: 1,
    width: '100%',
    minHeight: '350px',
    minHeightTablet: '360px',
    minHeightMobile: '300px',
    borderRadius: '20px',
    backgroundPosition: 'center',
  });
  const resultProof = createCanvasNode(context, containerName, resultGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '14px',
    gridColumnSpan: 2,
    gridColumnSpanTablet: 1,
    gridColumnSpanMobile: 1,
    minHeight: '350px',
    minHeightTablet: '220px',
    minHeightMobile: '637px',
    paddingTop: '24px',
    paddingRight: '24px',
    paddingBottom: '24px',
    paddingLeft: '24px',
    borderRadius: '20px',
    ...backgroundProps(context, containerName, style.cardBackground),
  });
  addHeading(context, resultProof.id, '12+ years', 'div', {
    fontSize: '42px',
    fontSizeMobile: '42px',
    lineHeight: '1',
    fontWeight: '700',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, resultProof.id, 'of careful correction, protection, and finish-led handover experience.', {
    fontSize: '15px',
    lineHeight: '1.4',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, resultProof.id, '95%', 'div', {
    fontSize: '42px',
    fontSizeMobile: '42px',
    lineHeight: '1',
    fontWeight: '700',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, resultProof.id, 'returning clients who reserve their next treatment before collection.', {
    fontSize: '15px',
    lineHeight: '1.4',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, resultProof.id, 'Reserve Your Detail', '#', {
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });

  const whySection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '186px',
    paddingTopTablet: '129px',
    paddingTopMobile: '74px',
    paddingBottom: '38px',
    paddingBottomTablet: '37px',
    paddingBottomMobile: '74px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const whyIntro = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '48px',
    gapTablet: '30px',
    gapMobile: '20px',
    paddingBottom: '58px',
    paddingBottomTablet: '46px',
    paddingBottomMobile: '38px',
  });
  const whyHeading = createCanvasNode(context, containerName, whyIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '16px',
  });
  addText(context, whyHeading.id, '/Why choose us', {
    fontSize: '17px',
    lineHeight: '1.35',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, whyHeading.id, 'Care built for drivers who notice every detail.', 'h2', {
    fontSize: '48px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, whyIntro.id, 'From material-safe interior work to measured paint correction, every treatment follows a clear plan and ends with practical guidance for the road ahead.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.65',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const whyGrid = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '24px',
    gapMobile: '20px',
  });
  const reasons = [
    'Measured finish care',
    'Precision-led work',
    'Premium-grade products',
    'Specialist attention',
    'Trusted process',
    'Tailored experience',
  ];
  const reasonIcons = ['verified', 'tune', 'workspace_premium', 'person_check', 'handshake', 'auto_awesome'];
  for (const [index, reason] of reasons.entries()) {
    const card = createCanvasNode(context, containerName, whyGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: index === 0 ? 'space-between' : 'flex-end',
      gap: '18px',
      minHeight: '440px',
      minHeightTablet: '410px',
      minHeightMobile: '457px',
      paddingTop: '24px',
      paddingRight: '24px',
      paddingBottom: '24px',
      paddingLeft: '24px',
      borderRadius: '20px',
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    const iconFrame = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '52px',
      minWidth: '52px',
      minHeight: '52px',
      borderWidth: '1px',
      borderColor: style.accent,
      borderRadius: '999px',
    });
    if (iconComponent) {
      createLeafNode(context, iconComponent.name, iconFrame.id, {
        icon: reasonIcons[index],
        iconDisplay: 'inline-flex',
        size: 24,
        color: style.accent,
      });
    } else {
      addText(context, iconFrame.id, 'O', {
        fontSize: '18px',
        lineHeight: '1',
        textColor: style.accent,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addHeading(context, card.id, reason, 'h3', {
      fontSize: '24px',
      lineHeight: '1.18',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    if (index === 0) {
      addMediaSurface(context, card.id, 'reference-media', mediaVariant(serviceImages[0], 'careglo-reason-1'), {
        width: '100%',
        minHeight: '200px',
        minHeightTablet: '200px',
        minHeightMobile: '200px',
        borderRadius: '14px',
        backgroundPosition: 'center',
      });
    }
  }

  const workSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '106px',
    paddingTopTablet: '85px',
    paddingTopMobile: '72px',
    paddingBottom: '32px',
    paddingBottomTablet: '9px',
    paddingBottomMobile: '30px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const workIntro = createCanvasNode(context, containerName, workSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '48px',
    gapMobile: '18px',
    paddingBottom: '48px',
    paddingBottomTablet: '9px',
  });
  const workHeading = createCanvasNode(context, containerName, workIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });
  addText(context, workHeading.id, '/Our work', {
    fontSize: '17px',
    lineHeight: '1.35',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, workHeading.id, 'Finishes that read clearly from every angle.', 'h2', {
    fontSize: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, workIntro.id, 'A recent selection of cabin, paint, trim, and protection work shaped around daily use and long-term care.', {
    fontSize: '17px',
    lineHeight: '1.6',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const workGrid = createCanvasNode(context, containerName, workSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'six',
    gridTemplateColumnsTablet: 'six',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
  });
  const workMedia = [
    context.replacementProfile.hero,
    serviceImages[0],
    serviceImages[1],
    serviceImages[2],
  ];
  for (const [index, source] of workMedia.entries()) {
    addMediaSurface(context, workGrid.id, 'reference-media', mediaVariant(source, `careglo-work-${index + 1}`), {
      gridColumnSpan: index === 0 ? 3 : 1,
      gridColumnSpanTablet: index === 0 ? 3 : 1,
      gridColumnSpanMobile: 1,
      width: '100%',
      minHeight: '550px',
      minHeightTablet: '500px',
      minHeightMobile: index === 0 ? '250px' : '70px',
      borderRadius: '18px',
      backgroundPosition: 'center',
    });
  }

  const packagesSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '80px',
    paddingTopTablet: '159px',
    paddingTopMobile: '116px',
    paddingBottom: '80px',
    paddingBottomTablet: '53px',
    paddingBottomMobile: '124px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const packagesIntro = createCanvasNode(context, containerName, packagesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    gap: '42px',
    gapTablet: '28px',
    gapMobile: '18px',
  });
  addText(context, packagesIntro.id, '/Pricing plans', {
    fontSize: '17px',
    lineHeight: '1.35',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, packagesIntro.id, 'Luxury care, tailored to you.', 'h2', {
    fontSize: '34px',
    fontSizeTablet: '32px',
    fontSizeMobile: '32px',
    lineHeight: '1.12',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, packagesIntro.id, 'Every package combines a careful inspection, precise treatment steps, and a straightforward reservation.', {
    fontSize: '17px',
    lineHeight: '1.58',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const packagesGrid = createCanvasNode(context, containerName, packagesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '24px',
    paddingTop: '80px',
    paddingTopTablet: '54px',
    paddingTopMobile: '54px',
  });
  const packages = [
    ['Essential wash', '$149', 'Foam, wheels, glass, interior wipe-down, and a finish check.', ['Interior hand wash and vacuum', 'Exterior wash and glass care', 'Finish and tyre review']],
    ['Signature detail', '$329', 'Interior extraction, paint-safe correction, trim dressing, and protection.', ['Full interior deep cleaning', 'Exterior polish and protective coating', 'Guided after-care handover']],
    ['Ceramic prep', '$690', 'Decontamination, polish stage, ceramic prep, and guided after-care.', ['Complete decontamination', 'Measured correction stage', 'Ceramic surface preparation']],
  ];
  for (const [index, packageItem] of packages.entries()) {
    const [title, price, body, features] = packageItem;
    const card = createCanvasNode(context, containerName, packagesGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '18px',
      gapTablet: '18px',
      gapMobile: '24px',
      gridColumnSpanTablet: index === 2 ? 2 : 1,
      gridColumnSpanMobile: 1,
      minHeight: '610px',
      minHeightTablet: '592px',
      minHeightMobile: '680px',
      paddingTop: '22px',
      paddingRight: '22px',
      paddingBottom: '28px',
      paddingLeft: '22px',
      borderRadius: geometry.radius,
      ...backgroundProps(context, containerName, style.panel),
    });
    const packageContent = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
    });
    addHeading(context, packageContent.id, title, 'h3', {
      fontSize: '30px',
      fontSizeMobile: '24px',
      lineHeight: '1.14',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, packageContent.id, price, 'div', {
      fontSize: '46px',
      fontSizeMobile: '36px',
      lineHeight: '1',
      fontWeight: '700',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, packageContent.id, body, {
      fontSize: '16px',
      lineHeight: '1.56',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    for (const feature of features) {
      addText(context, packageContent.id, `+ ${feature}`, {
        fontSize: '15px',
        lineHeight: '1.45',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addButton(context, card.id, 'Reserve package', '#', {
      backgroundColor: index === 1 ? style.buttonBg : style.cardBackground,
      textColor: index === 1 ? style.buttonFg : style.ink,
    });
  }

  const testimonialSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '64px',
    paddingTopTablet: '118px',
    paddingTopMobile: '68px',
    paddingBottom: '64px',
    paddingBottomTablet: '118px',
    paddingBottomMobile: '188px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const testimonialIntro = createCanvasNode(context, containerName, testimonialSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    gap: '30px',
    gapMobile: '18px',
  });
  addText(context, testimonialIntro.id, '/Testimonials', {
    fontSize: '18px',
    lineHeight: '1.35',
    fontWeight: '400',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, testimonialIntro.id, 'What our clients notice.', 'h2', {
    fontSize: '34px',
    fontSizeMobile: '32px',
    lineHeight: '1.12',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialIntro.id, 'Measured care, clear communication, and a finish that still reads well after the drive home.', {
    fontSize: '16px',
    lineHeight: '1.58',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const testimonialGrid = createCanvasNode(context, containerName, testimonialSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '30px',
    gapTablet: '24px',
    gapMobile: '20px',
    paddingTop: '46px',
  });
  const testimonialFeature = createCanvasNode(context, containerName, testimonialGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    flexDirectionTablet: 'row',
    flexDirectionMobile: 'column',
    gridColumnStart: 2,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridColumnSpan: 2,
    gridColumnSpanTablet: 2,
    gridColumnSpanMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    gap: '18px',
    minHeight: '422px',
    minHeightTablet: '400px',
    minHeightMobile: '632px',
    paddingTop: '16px',
    paddingRight: '16px',
    paddingBottom: '16px',
    paddingLeft: '16px',
    borderRadius: geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
  });
  addMediaSurface(context, testimonialFeature.id, 'reference-media', mediaVariant(serviceImages[0], 'careglo-testimonial-1'), {
    width: '100%',
    flexBasis: '50%',
    flexGrow: 1,
    minHeight: '390px',
    minHeightTablet: '360px',
    minHeightMobile: '280px',
    borderRadius: '20px',
    backgroundPosition: 'center',
  });
  const testimonialFeatureCopy = createCanvasNode(context, containerName, testimonialFeature.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '18px',
    flexBasis: '50%',
    flexGrow: 1,
    paddingTop: '18px',
    paddingRight: '18px',
    paddingBottom: '18px',
    paddingLeft: '18px',
  });
  addMediaSurface(context, testimonialFeatureCopy.id, 'reference-media', mediaVariant(serviceImages[1], 'careglo-testimonial-4'), {
    width: '100%',
    minHeight: '120px',
    minHeightTablet: '120px',
    minHeightMobile: '120px',
    borderRadius: '16px',
    backgroundPosition: 'center',
  });
  addHeading(context, testimonialFeatureCopy.id, 'The handover made the difference.', 'h3', {
    fontSize: '26px',
    fontSizeMobile: '24px',
    lineHeight: '1.16',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialFeatureCopy.id, 'The team explained the work, the after-care, and what to watch over the next few weeks.', {
    fontSize: '15px',
    lineHeight: '1.55',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const testimonialSides = [
    [context.replacementProfile.secondary, 'careglo-testimonial-2', 'The cabin felt considered.', 'Every material kept its natural finish.', 1, 1, 2, '300px'],
    [serviceImages[2], 'careglo-testimonial-3', 'The result stayed clear.', 'Paint, trim, and glass remained balanced.', 4, 2, 3, '291px'],
  ];
  for (const [source, mediaKey, title, body, desktopColumn, tabletColumn, mobileRow, mobileHeight] of testimonialSides) {
    const testimonialSide = createCanvasNode(context, containerName, testimonialGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: '12px',
      gridColumnStart: desktopColumn,
      gridColumnStartTablet: tabletColumn,
      gridColumnStartMobile: 1,
      gridColumnSpan: 1,
      gridColumnSpanTablet: 1,
      gridColumnSpanMobile: 1,
      gridRowStart: 1,
      gridRowStartTablet: 2,
      gridRowStartMobile: mobileRow,
      minHeight: '422px',
      minHeightTablet: '300px',
      minHeightMobile: mobileHeight,
      paddingTop: '24px',
      paddingRight: '24px',
      paddingBottom: '24px',
      paddingLeft: '24px',
      borderRadius: geometry.radius,
      backgroundImage: mediaVariant(source, mediaKey),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundOverlay: 'rgba(4, 7, 12, 0.48)',
    });
    addHeading(context, testimonialSide.id, title, 'h3', {
      fontSize: '24px',
      lineHeight: '1.18',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, testimonialSide.id, body, {
      fontSize: '15px',
      lineHeight: '1.55',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const partnerSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '88px',
    paddingTopTablet: '72px',
    paddingTopMobile: '80px',
    paddingBottom: '88px',
    paddingBottomTablet: '72px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const partnerPanel = createCanvasNode(context, containerName, partnerSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '348px',
    minHeightTablet: '440px',
    minHeightMobile: '585px',
    paddingTop: '58px',
    paddingTopTablet: '50px',
    paddingTopMobile: '48px',
    paddingRight: '58px',
    paddingRightTablet: '50px',
    paddingRightMobile: '28px',
    paddingBottom: '58px',
    paddingBottomTablet: '50px',
    paddingBottomMobile: '48px',
    paddingLeft: '58px',
    paddingLeftTablet: '50px',
    paddingLeftMobile: '28px',
    borderWidth: '1px',
    borderColor: 'rgba(255, 247, 234, 0.12)',
    borderRadius: geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
  });
  const partnerIntro = createCanvasNode(context, containerName, partnerPanel.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    maxWidth: '920px',
    paddingBottom: '48px',
    paddingBottomTablet: '48px',
    paddingBottomMobile: '48px',
  });
  addHeading(context, partnerIntro.id, 'Trusted partners in finish care', 'h2', {
    fontSize: '34px',
    fontSizeMobile: '28px',
    lineHeight: '1.15',
    fontWeight: '600',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'center',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, partnerIntro.id, 'Products, tools, and specialist support selected around repeatable quality and durable results.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.6',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'center',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const partnerWrap = createCanvasNode(context, containerName, partnerPanel.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'six',
    gridTemplateColumnsTablet: 'three',
    gridTemplateColumnsMobile: 'two',
    alignItems: 'center',
    gap: '34px',
    gapTablet: '26px',
    gapMobile: '22px',
  });
  for (const label of ['VANTAGE', 'CERAVUE', 'FORME', 'MOTIVE', 'LUSTER']) {
    addText(context, partnerWrap.id, label, {
      fontSize: '24px',
      fontSizeTablet: '20px',
      fontSizeMobile: '17px',
      lineHeight: '1',
      fontWeight: '700',
      letterSpacing: '0.12em',
      textAlign: 'center',
      textAlignTablet: 'center',
      textAlignMobile: 'center',
      textColor: 'rgba(255, 247, 234, 0.38)',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const footerSection = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'footer',
    minHeight: '694px',
    minHeightTablet: '839px',
    minHeightMobile: '1580px',
    paddingTop: '92px',
    paddingTopTablet: '112px',
    paddingTopMobile: '68px',
    paddingBottom: '44px',
    paddingBottomTablet: '40px',
    paddingBottomMobile: '36px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const footerGrid = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '52px',
    gapTablet: '42px',
    gapMobile: '36px',
  });
  const footerBrand = createCanvasNode(context, containerName, footerGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addHeading(context, footerBrand.id, 'Aureline', 'h2', {
    fontSize: '32px',
    lineHeight: '1',
    fontWeight: '700',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBrand.id, 'Finish-led vehicle care with clear booking, careful handover, and practical after-care.', {
    fontSize: '16px',
    lineHeight: '1.65',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, footerBrand.id, 'Reserve a Visit', '#', {
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
  const footerColumns = [
    ['Explore', ['Treatments', 'Results', 'Care guide']],
    ['Studio', ['Our process', 'Appointments', 'After-care']],
    ['Contact', ['+1 415 555 0148', 'hello@aureline.studio', 'Mon-Sat, 8:00-18:00']],
  ];
  for (const [title, items] of footerColumns) {
    const column = createCanvasNode(context, containerName, footerGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '16px',
    });
    addHeading(context, column.id, title, 'h3', {
      fontSize: '18px',
      lineHeight: '1.25',
      fontWeight: '600',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '4px',
    });
    for (const item of items) {
      addText(context, column.id, item, {
        fontSize: '15px',
        lineHeight: '1.5',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
  }
  const footerBottom = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    flexDirectionMobile: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignItemsMobile: 'flex-start',
    gap: '20px',
    paddingTop: '68px',
    paddingTopTablet: '56px',
    paddingTopMobile: '48px',
  });
  addText(context, footerBottom.id, 'Aureline vehicle care', {
    fontSize: '13px',
    lineHeight: '1.45',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBottom.id, 'Privacy  |  Terms  |  Accessibility', {
    fontSize: '13px',
    lineHeight: '1.45',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function addMaidyHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const serviceImages = context.replacementProfile.serviceCard;
  const panelColor = maidyPanelColor(context);
  const highlightColor = maidyHighlightColor(context);
  const paleColor = '#f3f4f1';
  const white = '#ffffff';
  const cleanerSource = maidyHeroCutoutSource() || context.replacementProfile.hero;
  const configuredEquipmentSource = String(process.env.MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL || '').trim();
  const equipmentSource = /^https?:\/\//i.test(configuredEquipmentSource) && isTransparentCutoutSource(configuredEquipmentSource)
    ? configuredEquipmentSource
    : context.replacementProfile.equipment || context.replacementProfile.secondary;
  const teamImages = [
    context.replacementProfile.hero,
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=720&q=82',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=720&q=82',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=720&q=82',
  ];

  const aboutSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '904px',
    minHeightTablet: '967px',
    paddingTop: '100px',
    paddingTopTablet: '82px',
    paddingTopMobile: '64px',
    paddingBottom: '100px',
    paddingBottomTablet: '82px',
    paddingBottomMobile: '64px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const aboutWrap = createCanvasNode(context, containerName, aboutSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '56px',
    gapTablet: '34px',
    gapMobile: '40px',
    alignItems: 'stretch',
    responsiveStack: 'mobile',
  });
  const aboutMediaFrame = createCanvasNode(context, containerName, aboutWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    gridTemplateColumnsTablet: 'one',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    minHeight: '704px',
    minHeightTablet: '760px',
    minHeightMobile: '430px',
    ...backgroundProps(context, containerName, highlightColor),
  });
  addMediaSurface(context, aboutMediaFrame.id, 'reference-media', mediaVariant(cleanerSource, 'maidy-about-cleaner'), {
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    width: '100%',
    minHeight: '704px',
    minHeightTablet: '760px',
    minHeightMobile: '430px',
    borderRadius: '0px',
    backgroundSize: isTransparentCutoutSource(cleanerSource) ? 'contain' : 'cover',
    backgroundPosition: isTransparentCutoutSource(cleanerSource) ? 'bottom' : 'center',
    backgroundRepeat: 'no-repeat',
  });
  const aboutProofPosition = createCanvasNode(context, containerName, aboutMediaFrame.id, {
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    width: '240px',
    maxWidthMobile: '210px',
    paddingTop: '520px',
    paddingTopTablet: '570px',
    paddingTopMobile: '292px',
    paddingLeft: '26px',
    paddingLeftTablet: '24px',
    paddingLeftMobile: '18px',
  });
  const aboutProof = createCanvasNode(context, containerName, aboutProofPosition.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '20px',
    paddingRight: '20px',
    paddingBottom: '20px',
    paddingLeft: '20px',
    ...backgroundProps(context, containerName, white),
    boxShadow: 'shadow-md',
  });
  addText(context, aboutProof.id, 'CAREFUL HANDOVER', {
    fontSize: '11px',
    lineHeight: '1.3',
    fontWeight: '800',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, aboutProof.id, 'Every visit closes with a room-by-room check.', {
    fontSize: '14px',
    lineHeight: '1.45',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const aboutCopy = createCanvasNode(context, containerName, aboutWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    paddingTop: '56px',
    paddingTopTablet: '34px',
    paddingTopMobile: '0px',
    paddingRight: '20px',
    paddingRightTablet: '0px',
    paddingRightMobile: '0px',
    paddingBottom: '56px',
    paddingBottomTablet: '34px',
    paddingBottomMobile: '0px',
    paddingLeft: '20px',
    paddingLeftTablet: '0px',
    paddingLeftMobile: '0px',
  });
  addText(context, aboutCopy.id, 'ABOUT TIDYRA', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, aboutCopy.id, 'A clear routine for a home that feels lighter.', 'h2', {
    fontSize: '52px',
    fontSizeTablet: '42px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, aboutCopy.id, 'Friendly crews arrive prepared, follow the priorities you set, and leave every room ready for the rest of your week.', {
    fontSize: '17px',
    lineHeight: '1.68',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const aboutStats = createCanvasNode(context, containerName, aboutCopy.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '16px',
    gapTablet: '14px',
    gapMobile: '12px',
    width: '100%',
    responsiveStack: 'mobile',
  });
  for (const [value, label] of [['12+', 'Care teams'], ['4.9', 'Average visit rating']]) {
    const stat = createCanvasNode(context, containerName, aboutStats.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '18px',
      paddingLeft: '18px',
      borderWidth: '1px',
      borderColor: '#e1e3df',
      ...backgroundProps(context, containerName, white),
    });
    addHeading(context, stat.id, value, 'div', {
      fontSize: '36px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, stat.id, label, {
      fontSize: '14px',
      lineHeight: '1.4',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  addButton(context, aboutCopy.id, 'Meet our approach', '#', {
    paddingTop: '15px',
    paddingRight: '28px',
    paddingBottom: '15px',
    paddingLeft: '28px',
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });

  const servicesSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '970px',
    minHeightTablet: '1228px',
    paddingTop: '108px',
    paddingTopTablet: '92px',
    paddingTopMobile: '70px',
    paddingBottom: '112px',
    paddingBottomTablet: '96px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const servicesIntro = createCanvasNode(context, containerName, servicesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '52px',
    gapTablet: '30px',
    gapMobile: '20px',
    alignItems: 'flex-end',
    responsiveStack: 'mobile',
  });
  const servicesTitle = createCanvasNode(context, containerName, servicesIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });
  addText(context, servicesTitle.id, 'SERVICES', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, servicesTitle.id, 'Focused care for the spaces you use every day.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '40px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const servicesLead = createCanvasNode(context, containerName, servicesIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addText(context, servicesLead.id, 'Choose one visit or build a steady routine around the rooms, surfaces, and timing that matter most.', {
    fontSize: '17px',
    lineHeight: '1.64',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, servicesLead.id, 'View all services', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });
  const servicesGrid = createCanvasNode(context, containerName, servicesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
    gapTablet: '22px',
    gapMobile: '16px',
    paddingTop: '62px',
    paddingTopTablet: '54px',
    paddingTopMobile: '42px',
    responsiveStack: 'mobile',
  });
  const services = [
    ['01', 'Home refresh', 'Recurring room care for kitchens, baths, living areas, and weekly reset zones.'],
    ['02', 'Workplace upkeep', 'Quiet, scheduled cleaning for desks, shared spaces, entries, and meeting rooms.'],
    ['03', 'Deep reset', 'Detailed attention for high-touch surfaces, overlooked corners, and seasonal care.'],
    ['04', 'Move support', 'A clear cleaning scope for arrivals, departures, handovers, and fresh starts.'],
  ];
  for (const [number, title, body] of services) {
    const card = createCanvasNode(context, containerName, servicesGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '24px',
      minHeight: '320px',
      minHeightTablet: '330px',
      minHeightMobile: '280px',
      paddingTop: '30px',
      paddingRight: '26px',
      paddingBottom: '30px',
      paddingLeft: '26px',
      borderWidth: '1px',
      borderColor: '#e7e9e5',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-sm',
    });
    addText(context, card.id, number, {
      display: 'inline-block',
      fontSize: '13px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: panelColor,
      backgroundColor: highlightColor,
      paddingY: '10px',
      paddingX: '11px',
      borderRadius: '999px',
      marginTop: '0px',
      marginBottom: '0px',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });
    addHeading(context, cardCopy.id, title, 'h3', {
      fontSize: '25px',
      fontSizeMobile: '23px',
      lineHeight: '1.18',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, body, {
      fontSize: '15px',
      lineHeight: '1.58',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const processSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '608px',
    minHeightTablet: '789px',
    paddingTop: '88px',
    paddingTopTablet: '76px',
    paddingTopMobile: '64px',
    paddingBottom: '92px',
    paddingBottomTablet: '78px',
    paddingBottomMobile: '68px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, panelColor),
  });
  const processIntro = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-end',
    gap: '44px',
    gapTablet: '30px',
    gapMobile: '18px',
    responsiveStack: 'mobile',
  });
  const processTitle = createCanvasNode(context, containerName, processIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, processTitle.id, 'OUR PROCESS', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: 'rgba(255, 255, 255, 0.62)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, processTitle.id, 'Four clear steps from booking to handover.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '39px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: white,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, processIntro.id, 'From booking through the final check, every visit follows a calm routine with clear expectations.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: 'rgba(255, 255, 255, 0.72)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const processGrid = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
    gapTablet: '20px',
    gapMobile: '14px',
    responsiveStack: 'mobile',
    paddingTop: '48px',
    paddingTopTablet: '42px',
    paddingTopMobile: '36px',
  });
  for (const [number, title, body] of [
    ['01', 'Share priorities', 'Tell us which rooms need attention and what a good result looks like.'],
    ['02', 'Choose a time', 'Pick a practical visit window and confirm the scope before arrival.'],
    ['03', 'Welcome the crew', 'A prepared team follows the agreed route with the right equipment.'],
    ['04', 'Review the rooms', 'Walk through the finished spaces and close the visit with confidence.'],
  ]) {
    const card = createCanvasNode(context, containerName, processGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '250px',
      minHeightTablet: '240px',
      minHeightMobile: '220px',
      paddingTop: '26px',
      paddingRight: '24px',
      paddingBottom: '26px',
      paddingLeft: '24px',
      borderWidth: '1px',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      ...backgroundProps(context, containerName, 'rgba(255, 255, 255, 0.06)'),
    });
    addText(context, card.id, number, {
      display: 'inline-block',
      fontSize: '14px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: panelColor,
      backgroundColor: highlightColor,
      paddingY: '12px',
      paddingX: '12px',
      borderRadius: '999px',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '23px',
      fontSizeMobile: '22px',
      lineHeight: '1.18',
      fontWeight: '800',
      textColor: white,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '15px',
      lineHeight: '1.56',
      textColor: 'rgba(255, 255, 255, 0.68)',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const equipmentSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '806px',
    minHeightTablet: '1298px',
    paddingTop: '88px',
    paddingTopTablet: '84px',
    paddingTopMobile: '66px',
    paddingBottom: '92px',
    paddingBottomTablet: '88px',
    paddingBottomMobile: '70px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, panelColor),
  });
  const equipmentIntro = createCanvasNode(context, containerName, equipmentSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-end',
    gap: '44px',
    gapTablet: '30px',
    gapMobile: '18px',
    responsiveStack: 'mobile',
  });
  const equipmentTitle = createCanvasNode(context, containerName, equipmentIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, equipmentTitle.id, 'OUR EQUIPMENT', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: 'rgba(255, 255, 255, 0.62)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, equipmentTitle.id, 'Prepared tools for floors, fabrics, edges, and air.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '39px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: white,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const equipmentLead = createCanvasNode(context, containerName, equipmentIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addText(context, equipmentLead.id, 'Each visit is matched with practical equipment so the crew can work carefully without slowing the day down.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: 'rgba(255, 255, 255, 0.72)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, equipmentLead.id, 'See the toolkit', '#', {
    borderRadius: '0px',
    backgroundColor: highlightColor,
    textColor: panelColor,
  });
  const equipmentGrid = createCanvasNode(context, containerName, equipmentSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
    gapTablet: '22px',
    gapMobile: '16px',
    paddingTop: '48px',
    paddingTopTablet: '46px',
    paddingTopMobile: '38px',
    responsiveStack: 'mobile',
  });
  const equipmentItems = [
    [equipmentSource, 'Compact floor unit', 'Agile care for daily floor routes and tighter rooms.'],
    [context.replacementProfile.secondary, 'Surface care kit', 'Prepared attachments for edges, textiles, and detail work.'],
    [serviceImages[1] || serviceImages[0], 'Quiet room system', 'Lower-noise tools for homes, studios, and workplaces.'],
    [serviceImages[2] || serviceImages[0], 'Deep reset set', 'Focused equipment for periodic and move-ready cleaning.'],
  ];
  for (const [index, item] of equipmentItems.entries()) {
    const [source, title, body] = item;
    const card = createCanvasNode(context, containerName, equipmentGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '370px',
      minHeightTablet: '420px',
      minHeightMobile: '350px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '24px',
      paddingLeft: '18px',
      ...backgroundProps(context, containerName, 'rgba(255, 255, 255, 0.06)'),
    });
    addMediaSurface(context, card.id, 'service-card', mediaVariant(source, `maidy-equipment-${index + 1}`), {
      width: '100%',
      minHeight: '230px',
      minHeightTablet: '280px',
      minHeightMobile: '240px',
      borderRadius: '0px',
      backgroundSize: isTransparentCutoutSource(source) ? 'contain' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });
    addHeading(context, cardCopy.id, title, 'h3', {
      fontSize: '21px',
      fontSizeMobile: '21px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: white,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, body, {
      fontSize: '14px',
      lineHeight: '1.5',
      textColor: 'rgba(255, 255, 255, 0.66)',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const whySection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '1012px',
    minHeightTablet: '1121px',
    paddingTop: '110px',
    paddingTopTablet: '90px',
    paddingTopMobile: '70px',
    paddingBottom: '112px',
    paddingBottomTablet: '92px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const whyWrap = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '60px',
    gapTablet: '34px',
    gapMobile: '42px',
    alignItems: 'stretch',
    responsiveStack: 'mobile',
  });
  addMediaSurface(context, whyWrap.id, 'reference-media', mediaVariant(context.replacementProfile.hero, 'maidy-why-cleaner'), {
    width: '100%',
    minHeight: '760px',
    minHeightTablet: '860px',
    minHeightMobile: '440px',
    borderRadius: '0px',
    backgroundPosition: 'top',
  });
  const whyCopy = createCanvasNode(context, containerName, whyWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '22px',
    paddingTop: '42px',
    paddingTopTablet: '30px',
    paddingTopMobile: '0px',
    paddingRight: '12px',
    paddingRightTablet: '0px',
    paddingRightMobile: '0px',
    paddingBottom: '42px',
    paddingBottomTablet: '30px',
    paddingBottomMobile: '0px',
    paddingLeft: '12px',
    paddingLeftTablet: '0px',
    paddingLeftMobile: '0px',
  });
  addText(context, whyCopy.id, 'WHY TIDYRA', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, whyCopy.id, 'Reliable care built around your rooms and routines.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '40px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, whyCopy.id, 'Clear arrival windows, prepared crews, and visible checks make each visit easier to plan and easier to trust.', {
    fontSize: '17px',
    lineHeight: '1.64',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const benefitsGrid = createCanvasNode(context, containerName, whyCopy.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '14px',
    gapTablet: '12px',
    gapMobile: '10px',
    width: '100%',
    responsiveStack: 'mobile',
  });
  for (const [number, title, body] of [
    ['01', 'Prepared crews', 'The right supplies and a room plan arrive with the team.'],
    ['02', 'Clear timing', 'Arrival windows and visit scope stay easy to understand.'],
    ['03', 'Careful details', 'High-touch surfaces and finishing checks are never rushed.'],
    ['04', 'Practical follow-up', 'Questions after the visit have a simple response path.'],
  ]) {
    const benefit = createCanvasNode(context, containerName, benefitsGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '9px',
      minHeight: '170px',
      paddingTop: '20px',
      paddingRight: '18px',
      paddingBottom: '20px',
      paddingLeft: '18px',
      ...backgroundProps(context, containerName, paleColor),
    });
    addText(context, benefit.id, number, {
      fontSize: '12px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: panelColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, benefit.id, title, 'h3', {
      fontSize: '20px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, benefit.id, body, {
      fontSize: '14px',
      lineHeight: '1.5',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  addButton(context, whyCopy.id, 'Plan a visit', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });

  const pricingSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '974px',
    minHeightTablet: '1996px',
    paddingTop: '100px',
    paddingTopTablet: '90px',
    paddingTopMobile: '70px',
    paddingBottom: '104px',
    paddingBottomTablet: '94px',
    paddingBottomMobile: '74px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, paleColor),
  });
  const pricingIntro = createCanvasNode(context, containerName, pricingSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '44px',
    gapTablet: '28px',
    gapMobile: '18px',
    alignItems: 'flex-end',
    responsiveStack: 'mobile',
  });
  const pricingTitle = createCanvasNode(context, containerName, pricingIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, pricingTitle.id, 'PRICING', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, pricingTitle.id, 'Choose a plan that fits the pace of your space.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '40px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const pricingLead = createCanvasNode(context, containerName, pricingIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addText(context, pricingLead.id, 'Start with a focused reset or keep a dependable routine. Every plan begins with a confirmed room list.', {
    fontSize: '17px',
    lineHeight: '1.62',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, pricingLead.id, 'Compare plans', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });
  const pricingGrid = createCanvasNode(context, containerName, pricingSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '24px',
    gapTablet: '24px',
    gapMobile: '16px',
    paddingTop: '52px',
    paddingTopTablet: '48px',
    paddingTopMobile: '40px',
    responsiveStack: 'mobile',
  });
  const plans = [
    ['Essentials', '$140', 'A focused visit for the rooms that carry the week.', ['Up to three rooms', 'Kitchen or bath focus', 'Final room check']],
    ['Routine', '$220', 'Steady home care with a repeatable room-by-room plan.', ['Whole-home route', 'Priority surface care', 'Flexible visit cadence']],
    ['Deep Reset', '$360', 'Extra time for detail work, transitions, and seasonal care.', ['Extended room list', 'Detail equipment set', 'Handover checklist']],
  ];
  for (const [index, plan] of plans.entries()) {
    const [title, price, body, features] = plan;
    const highlighted = index === 1;
    const planCard = createCanvasNode(context, containerName, pricingGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '28px',
      minHeight: '590px',
      minHeightTablet: '760px',
      minHeightMobile: '620px',
      paddingTop: '40px',
      paddingRight: '34px',
      paddingBottom: '40px',
      paddingLeft: '34px',
      borderWidth: highlighted ? '0px' : '1px',
      borderColor: '#e2e4e0',
      ...backgroundProps(context, containerName, highlighted ? panelColor : white),
      boxShadow: highlighted ? 'shadow-lg' : 'shadow-sm',
    });
    const planCopy = createCanvasNode(context, containerName, planCard.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
    });
    addText(context, planCopy.id, highlighted ? 'MOST POPULAR' : 'CLEANING PLAN', {
      fontSize: '11px',
      lineHeight: '1.3',
      fontWeight: '800',
      letterSpacing: '0.14em',
      textColor: highlighted ? highlightColor : panelColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, planCopy.id, title, 'h3', {
      fontSize: '30px',
      fontSizeMobile: '27px',
      lineHeight: '1.15',
      fontWeight: '800',
      textColor: highlighted ? white : style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, planCopy.id, price, 'div', {
      fontSize: '48px',
      fontSizeMobile: '42px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: highlighted ? white : style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, planCopy.id, body, {
      fontSize: '15px',
      lineHeight: '1.58',
      textColor: highlighted ? 'rgba(255, 255, 255, 0.72)' : style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const featureList = createCanvasNode(context, containerName, planCard.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });
    for (const feature of features) {
      addText(context, featureList.id, `Included: ${feature}`, {
        fontSize: '14px',
        lineHeight: '1.45',
        textColor: highlighted ? 'rgba(255, 255, 255, 0.82)' : style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addButton(context, planCard.id, highlighted ? 'Choose routine' : 'Choose plan', '#', {
      alignment: 'stretch',
      buttonDisplay: 'flex',
      borderRadius: '0px',
      backgroundColor: highlighted ? highlightColor : panelColor,
      textColor: highlighted ? panelColor : white,
    });
  }

  const testimonialsSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '757px',
    minHeightTablet: '688px',
    paddingTop: '96px',
    paddingTopTablet: '76px',
    paddingTopMobile: '66px',
    paddingBottom: '100px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '70px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, paleColor),
  });
  const testimonialsIntro = createCanvasNode(context, containerName, testimonialsSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '720px',
  });
  addText(context, testimonialsIntro.id, 'CLIENT NOTES', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, testimonialsIntro.id, 'Small details that make the whole visit feel easier.', 'h2', {
    fontSize: '46px',
    fontSizeTablet: '38px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    lineHeightTablet: '1.12',
    lineHeightMobile: '1.14',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const testimonialGrid = createCanvasNode(context, containerName, testimonialsSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
    gapTablet: '18px',
    gapMobile: '14px',
    paddingTop: '46px',
    paddingTopTablet: '40px',
    paddingTopMobile: '34px',
    responsiveStack: 'mobile',
  });
  const testimonials = [
    ['The crew arrived ready and left the kitchen feeling calm without disrupting the afternoon.', 'Rina Cole', 'Weekly home care'],
    ['The room list was clear, the timing was accurate, and every question had a practical answer.', 'Marcus Bell', 'Apartment reset'],
    ['Our office feels consistently looked after, especially the shared areas that used to get missed.', 'Talia Reed', 'Workplace upkeep'],
    ['The final walk-through made the result easy to see and the next visit easy to plan.', 'Evan Shaw', 'Seasonal deep clean'],
  ];
  for (const [index, testimonial] of testimonials.entries()) {
    const [quote, author, role] = testimonial;
    const card = createCanvasNode(context, containerName, testimonialGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '24px',
      minHeight: '330px',
      minHeightTablet: '210px',
      minHeightMobile: '270px',
      paddingTop: '28px',
      paddingRight: '24px',
      paddingBottom: '28px',
      paddingLeft: '24px',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-sm',
    });
    const quoteCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '16px',
    });
    addText(context, quoteCopy.id, '5 / 5', {
      fontSize: '13px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: '#c89200',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, quoteCopy.id, quote, {
      fontSize: '16px',
      lineHeight: '1.62',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const authorRow = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
    });
    addMediaSurface(context, authorRow.id, 'reference-media', mediaVariant(teamImages[index], `maidy-testimonial-${index + 1}`), {
      width: '52px',
      minHeight: '52px',
      minHeightTablet: '52px',
      minHeightMobile: '52px',
      borderRadius: '999px',
      backgroundPosition: 'top',
    });
    const authorCopy = createCanvasNode(context, containerName, authorRow.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '3px',
    });
    addHeading(context, authorCopy.id, author, 'h3', {
      fontSize: '16px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, authorCopy.id, role, {
      fontSize: '12px',
      lineHeight: '1.35',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const teamSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '845px',
    minHeightTablet: '1380px',
    paddingTop: '0px',
    paddingBottom: '96px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const teamStage = createCanvasNode(context, containerName, teamSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    gap: '22px',
    gapTablet: '22px',
    gapMobile: '16px',
    responsiveStack: 'mobile',
  });
  createCanvasNode(context, containerName, teamStage.id, {
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridColumnSpan: 4,
    gridColumnSpanTablet: 2,
    gridColumnSpanMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    width: '100%',
    minHeight: '350px',
    minHeightTablet: '350px',
    minHeightMobile: '330px',
    ...backgroundProps(context, containerName, highlightColor),
  });
  const teamIntro = createCanvasNode(context, containerName, teamStage.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-end',
    gap: '44px',
    gapTablet: '28px',
    gapMobile: '16px',
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridColumnSpan: 4,
    gridColumnSpanTablet: 2,
    gridColumnSpanMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    paddingTop: '70px',
    paddingTopTablet: '64px',
    paddingTopMobile: '54px',
    paddingRight: '42px',
    paddingRightTablet: '30px',
    paddingRightMobile: '20px',
    paddingLeft: '42px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '20px',
    responsiveStack: 'mobile',
  });
  const teamTitle = createCanvasNode(context, containerName, teamIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, teamTitle.id, 'OUR TEAM', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, teamTitle.id, 'People who bring calm, care, and consistency.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '38px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const teamLead = createCanvasNode(context, containerName, teamIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '18px',
  });
  addText(context, teamLead.id, 'Every crew member follows the same clear visit plan while bringing thoughtful attention to each room.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: '#4c554f',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, teamLead.id, 'Meet the crew', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });
  const teamMembers = [
    ['Lena Brooks', 'Home care lead'],
    ['Tessa Morgan', 'Detail specialist'],
    ['Nia Foster', 'Workplace lead'],
    ['Avery Cole', 'Visit coordinator'],
  ];
  for (const [index, member] of teamMembers.entries()) {
    const desktopColumn = index + 1;
    const tabletColumn = (index % 2) + 1;
    const tabletRow = Math.floor(index / 2) + 1;
    const mobileRow = index + 1;
    const cardPosition = createCanvasNode(context, containerName, teamStage.id, {
      gridColumnStart: desktopColumn,
      gridColumnStartTablet: tabletColumn,
      gridColumnStartMobile: 1,
      gridRowStart: 1,
      gridRowStartTablet: tabletRow,
      gridRowStartMobile: mobileRow,
      paddingTop: '262px',
      paddingTopTablet: index < 2 ? '262px' : '0px',
      paddingTopMobile: index === 0 ? '250px' : '0px',
    });
    const card = createCanvasNode(context, containerName, cardPosition.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '420px',
      minHeightTablet: '470px',
      minHeightMobile: '430px',
      paddingBottom: '24px',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-md',
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(teamImages[index], `maidy-team-${index + 1}`), {
      width: '100%',
      minHeight: '285px',
      minHeightTablet: '330px',
      minHeightMobile: '300px',
      borderRadius: '0px',
      backgroundPosition: 'top',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingRight: '20px',
      paddingLeft: '20px',
    });
    addHeading(context, cardCopy.id, member[0], 'h3', {
      fontSize: '22px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, member[1], {
      fontSize: '14px',
      lineHeight: '1.45',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const articlesSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '824px',
    minHeightTablet: '1191px',
    paddingTop: '96px',
    paddingTopTablet: '84px',
    paddingTopMobile: '66px',
    paddingBottom: '102px',
    paddingBottomTablet: '88px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const articlesIntro = createCanvasNode(context, containerName, articlesSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '720px',
  });
  addText(context, articlesIntro.id, 'ROOM NOTES', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, articlesIntro.id, 'Practical reading for a calmer weekly reset.', 'h2', {
    fontSize: '46px',
    fontSizeTablet: '38px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    lineHeightTablet: '1.12',
    lineHeightMobile: '1.14',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const articlesGrid = createCanvasNode(context, containerName, articlesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
    gapTablet: '22px',
    gapMobile: '16px',
    responsiveStack: 'mobile',
    paddingTop: '46px',
    paddingTopTablet: '42px',
    paddingTopMobile: '34px',
  });
  const articles = [
    ['A ten-minute closing routine', 'Small room-by-room habits that make the next morning feel lighter.'],
    ['Preparing for a focused visit', 'A short checklist that helps the crew spend more time on the work that matters.'],
    ['A practical guide to shared surfaces', 'Simple care for kitchens, handles, switches, desks, and busy family spaces.'],
  ];
  for (const [index, article] of articles.entries()) {
    const card = createCanvasNode(context, containerName, articlesGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '420px',
      minHeightTablet: '430px',
      minHeightMobile: '390px',
      paddingBottom: '26px',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-sm',
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(serviceImages[(index + 1) % serviceImages.length], `maidy-article-${index + 1}`), {
      width: '100%',
      minHeight: '235px',
      minHeightTablet: '245px',
      minHeightMobile: '220px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingRight: '24px',
      paddingLeft: '24px',
    });
    addText(context, cardCopy.id, 'HOME ROUTINES', {
      fontSize: '11px',
      lineHeight: '1.3',
      fontWeight: '800',
      letterSpacing: '0.12em',
      textColor: panelColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, cardCopy.id, article[0], 'h3', {
      fontSize: '23px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, article[1], {
      fontSize: '15px',
      lineHeight: '1.55',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const newsletterSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '351px',
    minHeightTablet: '341px',
    paddingTop: '0px',
    paddingBottom: '0px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const newsletterWrap = createCanvasNode(context, containerName, newsletterSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'center',
    gap: '46px',
    gapTablet: '30px',
    gapMobile: '24px',
    minHeight: '351px',
    minHeightTablet: '341px',
    minHeightMobile: '430px',
    paddingTop: '58px',
    paddingTopTablet: '50px',
    paddingTopMobile: '44px',
    paddingRight: '58px',
    paddingRightTablet: '40px',
    paddingRightMobile: '24px',
    paddingBottom: '58px',
    paddingBottomTablet: '50px',
    paddingBottomMobile: '44px',
    paddingLeft: '58px',
    paddingLeftTablet: '40px',
    paddingLeftMobile: '24px',
    responsiveStack: 'mobile',
    ...backgroundProps(context, containerName, panelColor),
  });
  const newsletterCopy = createCanvasNode(context, containerName, newsletterWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, newsletterCopy.id, 'ROOM LETTER', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: highlightColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, newsletterCopy.id, 'A useful note for a tidier week.', 'h2', {
    fontSize: '36px',
    fontSizeTablet: '30px',
    fontSizeMobile: '29px',
    lineHeight: '1.12',
    fontWeight: '800',
    textColor: white,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, newsletterCopy.id, 'Occasional room-care ideas, visit preparation tips, and seasonal reminders.', {
    fontSize: '15px',
    lineHeight: '1.55',
    textColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const newsletterForm = createCanvasNode(context, containerName, newsletterWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '10px',
    responsiveStack: 'mobile',
  });
  const emailField = createCanvasNode(context, containerName, newsletterForm.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    flexGrow: 1,
    minHeight: '54px',
    paddingRight: '18px',
    paddingLeft: '18px',
    ...backgroundProps(context, containerName, white),
  });
  addText(context, emailField.id, 'Email address', {
    fontSize: '14px',
    lineHeight: '1.4',
    textColor: '#747a76',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, newsletterForm.id, 'Subscribe', '#', {
    borderRadius: '0px',
    paddingTop: '18px',
    paddingRight: '24px',
    paddingBottom: '18px',
    paddingLeft: '24px',
    backgroundColor: highlightColor,
    textColor: panelColor,
  });

  const footerSection = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'footer',
    paddingTop: '92px',
    paddingTopTablet: '76px',
    paddingTopMobile: '66px',
    paddingBottom: '76px',
    paddingBottomTablet: '70px',
    paddingBottomMobile: '64px',
    minHeight: '415px',
    minHeightTablet: '603px',
    minHeightMobile: '760px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const footerWrap = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '44px',
    gapTablet: '34px',
    gapMobile: '30px',
    responsiveStack: 'mobile',
  });
  const footerLead = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '18px',
  });
  addHeading(context, footerLead.id, 'Tidyra', 'h2', {
    fontSize: '34px',
    fontSizeMobile: '30px',
    lineHeight: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerLead.id, 'Prepared crews, clear room plans, and a dependable path from booking to final check.', {
    fontSize: '16px',
    lineHeight: '1.6',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  for (const [title, links] of [
    ['Services', ['Home refresh', 'Workplace upkeep', 'Deep reset']],
    ['Company', ['Our approach', 'The crew', 'Room notes']],
    ['Contact', ['+1 (415) 555-0148', context.replacementProfile.email]],
  ]) {
    const column = createCanvasNode(context, containerName, footerWrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });
    addHeading(context, column.id, title, 'h3', {
      fontSize: '18px',
      lineHeight: '1.3',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    for (const link of links) {
      addText(context, column.id, link, {
        fontSize: '15px',
        lineHeight: '1.5',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
  }

  const copyrightSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '18px',
    paddingTopTablet: '20px',
    paddingTopMobile: '24px',
    paddingBottom: '18px',
    paddingBottomTablet: '20px',
    paddingBottomMobile: '24px',
    minHeight: '57px',
    minHeightTablet: '67px',
    minHeightMobile: '96px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.buttonBg),
  });
  const copyrightWrap = createCanvasNode(context, containerName, copyrightSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
    responsiveStack: 'mobile',
  });
  addText(context, copyrightWrap.id, 'Copyright 2026 Tidyra. All rights reserved.', {
    fontSize: '12px',
    lineHeight: '1.4',
    textColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copyrightWrap.id, 'Privacy  |  Terms', {
    fontSize: '12px',
    lineHeight: '1.4',
    textColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function addHeroProofDeck(context, parentId) {
  const container = findComponent(context.contractIndex, ['Container']);
  if (!container) {
    return;
  }
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const proofGrid = createCanvasNode(context, container.name, parentId, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '20px',
    responsiveStack: 'mobile',
  });

  if (requiredRoleMinimum(context.brief, 'secondary') > 0) {
    addMediaSurface(context, proofGrid.id, 'secondary', context.replacementProfile.secondary, {
      minHeight: geometry.secondaryMinHeight,
      borderRadius: geometry.cardRadius,
    });
  }

  addHeroProofCard(context, proofGrid.id);

  const stats = statItems(context.brief);
  if (stats.length > 0) {
    addMetricCard(context, proofGrid.id);
  }
}

function addMetricCard(context, parentId) {
  const container = findComponent(context.contractIndex, ['Container']);
  const stats = statItems(context.brief);
  if (!container || stats.length === 0) {
    return;
  }
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const card = createCanvasNode(context, container.name, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingTop: '22px',
    paddingRight: '22px',
    paddingBottom: '22px',
    paddingLeft: '22px',
    borderRadius: geometry.cardRadius,
    ...backgroundProps(context, container.name, style.cardBackground),
    boxShadow: 'soft',
  });
  addHeading(context, card.id, stats[0].value, 'div', {
    fontSize: '34px',
    lineHeight: '1',
    fontWeight: '850',
    textColor: style.cardInk,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, card.id, stats[0].label, {
    fontSize: '15px',
    lineHeight: '1.45',
    textColor: style.cardMuted,
  });
  context.heroProofCards += 1;
}

function addHeroProofCard(context, parentId) {
  const container = findComponent(context.contractIndex, ['Container']);
  if (!container) {
    return;
  }
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const proof = proofCopy(context.replacementProfile);
  const card = createCanvasNode(context, container.name, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '14px',
    paddingTop: '24px',
    paddingRight: '24px',
    paddingBottom: '24px',
    paddingLeft: '24px',
    borderRadius: geometry.cardRadius,
    ...backgroundProps(context, container.name, style.cardBackground),
    boxShadow: 'soft',
  });

  addText(context, card.id, proof.eyebrow, {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '800',
    textColor: style.accent,
    backgroundColor: style.badgeBackground,
    paddingY: '7px',
    paddingX: '10px',
    borderRadius: '999px',
  });
  addHeading(context, card.id, proof.title, 'h3', {
    fontSize: '28px',
    fontSizeMobile: '24px',
    lineHeight: '1.08',
    fontWeight: '850',
    textColor: style.cardInk,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, card.id, proof.body, {
    fontSize: '15px',
    lineHeight: '1.55',
    textColor: style.cardMuted,
  });
  addButton(context, card.id, secondaryAction(context.brief, proof.cta), '#');
  context.heroProofCards += 1;
}

function addServicesSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const careglo = context.replacementProfile?.name === 'luxury-car-care';
  const count = Math.max(requiredRoleMinimum(context.brief, 'service-card'), 0);
  if (count === 0 && h3Texts(context.brief).length === 0) {
    return;
  }

  if (careglo) {
    const services = createCanvasNode(context, sectionName, 'ROOT', {
      paddingTop: '128px',
      paddingBottom: '88px',
      innerMaxWidth: geometry.innerMaxWidth,
      innerPaddingX: '20px',
      ...backgroundProps(context, sectionName, style.bg),
    });
    const row = createCanvasNode(context, containerName, services.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'six',
      gridTemplateColumnsTablet: 'two',
      gridTemplateColumnsMobile: 'one',
      gap: '24px',
    });
    const copy = createCanvasNode(context, containerName, row.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '48px',
      gridColumnSpan: 2,
      gridColumnSpanTablet: 2,
      gridColumnSpanMobile: 1,
      minHeight: '555px',
      minHeightTablet: '0px',
      minHeightMobile: '0px',
    });
    const copyTop = createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '20px',
      maxWidth: '370px',
    });
    addHeading(context, copyTop.id, 'Precision Finish Care', 'h2', {
      fontSize: '16px',
      fontSizeMobile: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, copyTop.id, 'Every vehicle receives deliberate care, with each surface restored to a crisp, lasting finish.', {
      fontSize: '16px',
      fontSizeMobile: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const about = createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '420px',
    });
    addHeading(context, about.id, '/Our studio', 'h2', {
      fontSize: '20px',
      lineHeight: '1.3',
      fontWeight: '400',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, about.id, 'Refined Care, One Finish at a Time', 'h2', {
      fontSize: '32px',
      fontSizeMobile: '28px',
      lineHeight: '1.2',
      fontWeight: '400',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addMediaSurface(context, row.id, 'service-card', mediaVariant(context.replacementProfile.serviceCard[0], 'careglo-about-tall'), {
      gridColumnSpan: 2,
      gridColumnSpanTablet: 1,
      gridColumnSpanMobile: 1,
      minHeight: '555px',
      minHeightTablet: '420px',
      minHeightMobile: '320px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    const right = createCanvasNode(context, containerName, row.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '48px',
      gridColumnSpan: 2,
      gridColumnSpanTablet: 1,
      gridColumnSpanMobile: 1,
      minHeight: '555px',
      minHeightTablet: '0px',
      minHeightMobile: '0px',
    });
    addMediaSurface(context, right.id, 'service-card', mediaVariant(context.replacementProfile.serviceCard[1], 'careglo-about-side'), {
      minHeight: '400px',
      minHeightTablet: '360px',
      minHeightMobile: '280px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    const rightCopy = createCanvasNode(context, containerName, right.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    });
    addHeading(context, rightCopy.id, 'Care Built Around You', 'h3', {
      fontSize: '20px',
      lineHeight: '1.25',
      fontWeight: '400',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, rightCopy.id, 'Flexible treatments for every vehicle, finish, and routine.', {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const serviceCards = createCanvasNode(context, sectionName, 'ROOT', {
      paddingTop: '96px',
      paddingTopTablet: '0px',
      paddingTopMobile: '131px',
      paddingBottom: '76px',
      paddingBottomTablet: '90px',
      paddingBottomMobile: '88px',
      innerMaxWidth: geometry.innerMaxWidth,
      innerPaddingX: '24px',
      ...backgroundProps(context, sectionName, style.bg),
    });
    const serviceIntro = createCanvasNode(context, containerName, serviceCards.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'two',
      gridTemplateColumnsTablet: 'two',
      gridTemplateColumnsMobile: 'one',
      gap: '48px',
      gapTablet: '28px',
      gapMobile: '22px',
      minHeight: '178px',
      minHeightTablet: '160px',
      minHeightMobile: '383px',
    });
    const serviceHeading = createCanvasNode(context, containerName, serviceIntro.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });
    addText(context, serviceHeading.id, '/Our top solution', {
      fontSize: '17px',
      lineHeight: '1.35',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, serviceHeading.id, 'Premium finish care for every surface.', 'h2', {
      fontSize: '46px',
      fontSizeTablet: '38px',
      fontSizeMobile: '34px',
      lineHeight: '1.1',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const serviceLead = createCanvasNode(context, containerName, serviceIntro.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '18px',
    });
    addText(context, serviceLead.id, 'Choose focused interior, exterior, or protection work, then shape the treatment around the vehicle and its daily use.', {
      fontSize: '17px',
      fontSizeMobile: '16px',
      lineHeight: '1.6',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addButton(context, serviceLead.id, 'View treatments', '#', {
      backgroundColor: style.buttonBg,
      textColor: style.buttonFg,
    });
    const grid = createCanvasNode(context, containerName, serviceCards.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'three',
      gridTemplateColumnsTablet: 'two',
      gridTemplateColumnsMobile: 'one',
      gap: '24px',
    });
    const labels = h3Texts(context.brief);
    for (let index = 0; index < 3; index += 1) {
      const source = context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length];
      const mediaSource = mediaVariant(source, `careglo-service-card-${index + 1}`);
      const desktopHeight = '555px';
      const tabletHeight = index === 2 ? '366px' : '500px';
      const mobileHeight = index === 0 ? '454px' : index === 1 ? '500px' : '366px';
      const card = createCanvasNode(context, containerName, grid.id, {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        justifyContent: index === 0 ? 'space-between' : 'flex-end',
        gap: '16px',
        gridColumnSpanTablet: index === 2 ? 2 : 1,
        gridColumnSpanMobile: 1,
        minHeight: desktopHeight,
        minHeightTablet: tabletHeight,
        minHeightMobile: mobileHeight,
        paddingTop: '24px',
        paddingRight: '24px',
        paddingBottom: '24px',
        paddingLeft: '24px',
        borderRadius: '20px',
        ...(index === 0
          ? backgroundProps(context, containerName, style.cardBackground)
          : {
              backgroundImage: mediaSource,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundOverlay: 'rgba(4, 7, 12, 0.48)',
            }),
      });
      addText(context, card.id, `0${index + 1}`, {
        fontSize: '15px',
        lineHeight: '1.2',
        fontWeight: '600',
        textColor: style.accent,
        marginTop: '0px',
        marginBottom: '0px',
      });
      addHeading(context, card.id, labels[index] || `Service ${index + 1}`, 'h3', {
        fontSize: '24px',
        lineHeight: '1.25',
        fontWeight: '600',
        textColor: style.ink,
        marginTop: '0px',
        marginBottom: '0px',
      });
      addText(context, card.id, serviceCopy(context.replacementProfile, index), {
        fontSize: '16px',
        lineHeight: '1.5',
        fontWeight: '400',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
      if (index === 0) {
        addButton(context, card.id, 'Book a treatment', '#', {
          backgroundColor: style.buttonBg,
          textColor: style.buttonFg,
        });
        addMediaSurface(context, card.id, 'service-card', mediaSource, {
          width: '100%',
          minHeight: '200px',
          minHeightTablet: '200px',
          minHeightMobile: '180px',
          borderRadius: '14px',
          backgroundPosition: 'center',
        });
      }
    }
    return;
  }

  const services = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '64px',
    paddingBottom: '88px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  addHeading(context, services.id, secondHeading(context.brief), 'h2', {
    fontSize: '42px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    fontWeight: '850',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const grid = createCanvasNode(context, containerName, services.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '24px',
    responsiveStack: 'tablet',
  });
  const cardCount = Math.max(count, Math.min(3, h3Texts(context.brief).length || 3));
  const labels = h3Texts(context.brief);

  for (let index = 0; index < cardCount; index += 1) {
    const card = createCanvasNode(context, containerName, grid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '16px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '22px',
      paddingLeft: '18px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
      boxShadow: 'soft',
    });
    addMediaSurface(context, card.id, 'service-card', context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length], {
      minHeight: geometry.serviceMediaMinHeight,
      borderRadius: geometry.mediaRadius,
    });
    addHeading(context, card.id, labels[index] || `Service ${index + 1}`, 'h3', {
      fontSize: '24px',
      lineHeight: '1.15',
      fontWeight: '800',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, serviceCopy(context.replacementProfile, index), {
      fontSize: '15px',
      lineHeight: '1.55',
      textColor: style.cardMuted,
    });
  }
}

function addLogoStripSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidy = isMaidyProfile(context);
  const strip = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: maidy ? '82px' : '44px',
    paddingTopTablet: maidy ? '52px' : undefined,
    paddingTopMobile: maidy ? '64px' : undefined,
    paddingBottom: maidy ? '82px' : '44px',
    paddingBottomTablet: maidy ? '52px' : undefined,
    paddingBottomMobile: maidy ? '64px' : undefined,
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.buttonBg),
  });
  const wrap = createCanvasNode(context, containerName, strip.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '36px',
    gapTablet: maidy ? '18px' : undefined,
    gapMobile: maidy ? '8px' : undefined,
    responsiveStack: maidy ? undefined : 'tablet',
  });
  for (const label of ['ALDER', 'NORTHLINE', 'VERDANT', 'DAYMARK', 'KINSHIP']) {
    addText(context, wrap.id, label, {
      fontSize: '34px',
      fontSizeTablet: maidy ? '18px' : undefined,
      fontSizeMobile: maidy ? '12px' : '24px',
      fontWeight: '800',
      lineHeight: '1',
      textColor: 'rgba(255, 255, 255, 0.42)',
    });
  }
}

function addStatsSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const stats = statItems(context.brief).slice(0, 4);
  if (context.replacementProfile?.name === 'luxury-car-care') {
    const careStats = [
      { value: '34K+', label: 'vehicles renewed' },
      { value: '12+', label: 'years refining finishes' },
      { value: '95%', label: 'returning clients' },
      { value: '100%', label: 'handover checks' },
    ];
    while (stats.length < 4) {
      stats.push(careStats[stats.length]);
    }
  }
  if (stats.length === 0) {
    return;
  }

  const statsGrid = findComponent(context.contractIndex, ['StatsGrid']);
  if (statsGrid) {
    const section = createCanvasNode(context, sectionName, 'ROOT', {
      paddingTop: '34px',
      paddingBottom: '34px',
      innerMaxWidth: geometry.innerMaxWidth,
      innerPaddingX: '20px',
      ...backgroundProps(context, sectionName, style.bg),
    });
    createLeafNode(context, statsGrid.name, section.id, {
      items: stats.map((item) => ({ value: item.value, label: item.label })),
      columns: Math.min(stats.length, 4),
      columnsTablet: Math.min(stats.length, 4),
      columnsMobile: Math.min(stats.length, 2),
      cellBg: style.bg,
      cellPadding: '20px',
      borderColor: style.panel,
      borderRadius: '0px',
      valueColor: style.ink,
      labelColor: style.muted,
      accentColor: style.accent,
      metricOrder: 'value-label',
    });
    return;
  }

  const section = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '34px',
    paddingBottom: '34px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const wrap = createCanvasNode(context, containerName, section.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))`,
    gap: '20px',
    responsiveStack: 'mobile',
  });

  for (const item of stats) {
    const card = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingTop: '20px',
      paddingRight: '20px',
      paddingBottom: '20px',
      paddingLeft: '20px',
      borderRadius: geometry.mediaRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addHeading(context, card.id, item.value, 'div', { fontSize: '30px', fontWeight: '850', textColor: style.ink });
    addText(context, card.id, item.label, { fontSize: '15px', textColor: style.muted });
  }
}

function addMediaSurface(context, parentId, role, source, props) {
  const container = findComponent(context.contractIndex, ['Container']);
  const image = findComponent(context.contractIndex, ['ImageBlock', 'Image', 'ImageGallery']);
  const containerMediaProp = container ? firstAllowedProp(context, container.name, ['backgroundImage', 'image', 'media', 'src', 'url']) : '';

  if (container && containerMediaProp) {
    createCanvasNode(context, container.name, parentId, {
      ...props,
      [containerMediaProp]: source,
      backgroundSize: props.backgroundSize || 'cover',
      backgroundPosition: props.backgroundPosition || (role === 'secondary' ? 'center center' : 'center center'),
    });
    return;
  }

  if (image) {
    const imageProp = firstAllowedProp(context, image.name, ['image', 'src', 'url']);
    createLeafNode(context, image.name, parentId, {
      [imageProp || 'image']: source,
      objectFit: props.objectFit || 'cover',
      objectPosition: props.objectPosition || 'center center',
      imageHeight: props.minHeight || '320px',
      borderRadius: props.borderRadius || '18px',
    });
    return;
  }

  context.warnings.push(`Missing media component for ${role}; no media node was created.`);
}

function mediaVariant(source, key) {
  const normalizedSource = String(source || '').trim();
  const variant = slugify(key);
  if (!normalizedSource || !variant) {
    return normalizedSource;
  }

  const hashIndex = normalizedSource.indexOf('#');
  const sourceWithoutHash = hashIndex >= 0 ? normalizedSource.slice(0, hashIndex) : normalizedSource;
  const hash = hashIndex >= 0 ? normalizedSource.slice(hashIndex) : '';
  const separator = sourceWithoutHash.includes('?') ? '&' : '?';
  return `${sourceWithoutHash}${separator}monteby_media=${variant}${hash}`;
}

function addImageSurface(context, parentId, role, source, props) {
  const image = findComponent(context.contractIndex, ['ImageBlock', 'Image']);
  if (!image) {
    addMediaSurface(context, parentId, role, source, props);
    return;
  }

  const imageProp = firstAllowedProp(context, image.name, ['image', 'src', 'url']);
  createLeafNode(context, image.name, parentId, {
    [imageProp || 'image']: source,
    alt: props.alt || `${role} image`,
    width: props.width,
    maxWidth: props.maxWidth || props.width,
    height: props.height || props.minHeight || '320px',
    objectFit: props.objectFit || 'contain',
    objectPosition: props.objectPosition || 'center',
    borderRadius: props.borderRadius || '0px',
  });
}

function lumenDoctorCutoutSource() {
  const source = String(process.env.MONTEBY_LUMEN_DOCTOR_CUTOUT_URL || '').trim();

  if (!/^https?:\/\//i.test(source) || !isTransparentCutoutSource(source)) {
    return '';
  }

  return source;
}

function optomattaHeroCompositeSource() {
  const source = String(process.env.MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL || '').trim();
  return /^https?:\/\//i.test(source) ? source : '';
}

function maidyHeroCompositeSource() {
  const source = String(process.env.MONTEBY_MAIDY_HERO_COMPOSITE_URL || '').trim();
  return /^https?:\/\//i.test(source) ? source : '';
}

function isTransparentCutoutSource(source) {
  return /\.(?:png|webp)(?:[?#]|$)/i.test(String(source || ''));
}

function addHeading(context, parentId, text, tag, props = {}) {
  const component = findComponent(context.contractIndex, ['Heading']);
  if (!component) {
    context.warnings.push('Missing Heading component.');
    return;
  }

  createLeafNode(context, component.name, parentId, {
    text,
    content: text,
    children: text,
    tag,
    ...props,
  });
}

function addText(context, parentId, text, props = {}) {
  const component = findComponent(context.contractIndex, ['Text']);
  if (!component) {
    context.warnings.push('Missing Text component.');
    return;
  }

  createLeafNode(context, component.name, parentId, {
    text,
    content: text,
    children: text,
    ...props,
  });
}

function addButton(context, parentId, label, url, props = {}) {
  const component = findComponent(context.contractIndex, ['ButtonBlock', 'Button']);
  if (!component || !label) {
    return;
  }
  const style = context.styleProfile;

  createLeafNode(context, component.name, parentId, {
    label,
    text: label,
    url,
    href: url,
    variant: 'primary',
    alignment: 'left',
    buttonDisplay: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '14px',
    paddingRight: '22px',
    paddingBottom: '14px',
    paddingLeft: '22px',
    borderRadius: '999px',
    fontSize: '16px',
    lineHeight: '1',
    fontWeight: '700',
    textDecoration: 'none',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
    ...props,
  });
}

function createCanvasNode(context, componentName, parentId, props) {
  return createNode(context, componentName, parentId, props, true);
}

function createLeafNode(context, componentName, parentId, props) {
  return createNode(context, componentName, parentId, props, false);
}

function createNode(context, componentName, parentId, props, isCanvas) {
  const resolvedParentId = ensureAllowedParent(context, componentName, parentId);
  const id = nextId(context, componentName);
  const node = {
    type: { resolvedName: componentName },
    isCanvas,
    props: filterAllowedProps(context, componentName, props),
    parent: resolvedParentId,
    nodes: [],
  };

  context.nodeMap[id] = node;
  if (!Array.isArray(context.nodeMap[resolvedParentId].nodes)) {
    context.nodeMap[resolvedParentId].nodes = [];
  }
  context.nodeMap[resolvedParentId].nodes.push(id);

  return { id, node };
}

function ensureAllowedParent(context, componentName, parentId) {
  const entry = context.contractIndex.get(componentName);
  const allowedParents = entry?.allowedParents || [];
  const parentType = parentTypeForNode(context, parentId);

  if (allowedParents.length === 0 || allowedParents.includes(parentType)) {
    return parentId;
  }

  if (allowedParents.includes('Container') && componentName !== 'Container') {
    const container = findComponent(context.contractIndex, ['Container']);
    if (container && canPlaceUnder(context, container.name, parentId)) {
      return createPlacementWrapper(context, parentId).id;
    }
  }

  throw new Error(`${componentName} cannot be placed under ${parentType}; allowed: ${allowedParents.join(', ') || 'any'}.`);
}

function parentTypeForNode(context, parentId) {
  if (parentId === 'ROOT') {
    return 'ROOT';
  }

  const parent = context.nodeMap[parentId];
  if (!parent || typeof parent !== 'object') {
    throw new Error(`Missing parent node: ${parentId}`);
  }

  return nodeType(parent);
}

function nodeType(node) {
  return node?.type?.resolvedName || node?.type || '';
}

function canPlaceUnder(context, componentName, parentId) {
  const entry = context.contractIndex.get(componentName);
  const allowedParents = entry?.allowedParents || [];
  const parentType = parentTypeForNode(context, parentId);
  return allowedParents.length === 0 || allowedParents.includes(parentType);
}

function createPlacementWrapper(context, parentId) {
  const container = requireComponent(context, ['Container']);
  return createCanvasNode(context, container, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '16px',
  });
}

function nextId(context, componentName) {
  const base = slugify(componentName);
  context.counters[base] = (context.counters[base] || 0) + 1;
  return `${base}-${context.counters[base]}`;
}

function filterAllowedProps(context, componentName, props) {
  const entry = context.contractIndex.get(componentName);
  const allowed = new Set(context.strictAuthoringContract ? entry?.authoringProps || [] : entry?.props || []);
  const filtered = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'undefined' || value === null || value === '') {
      continue;
    }
    if ((!context.strictAuthoringContract && allowed.size === 0) || allowed.has(key)) {
      const normalized = normalizeAllowedPropValue(entry, key, value);
      if (typeof normalized !== 'undefined' && normalized !== null && normalized !== '') {
        filtered[key] = normalized;
      }
    }
  }

  return filtered;
}

function normalizeAllowedPropValue(entry, prop, value) {
  const options = entry?.propOptions?.get(prop);
  let normalized = value;
  if (options && options.size > 0 && isScalar(value)) {
    const comparable = normalizeComparableValue(value);
    if (options.has(comparable)) {
      normalized = comparable;
    } else {
      const mapped = mapConstrainedPropValue(prop, comparable, options);
      if (!options.has(mapped)) {
        return undefined;
      }
      normalized = mapped;
    }
  }

  const rule = entry?.propRules?.get(prop);
  const step = Number(rule?.step);
  const matchesDefault = Object.prototype.hasOwnProperty.call(entry?.defaults || {}, prop)
    && String(entry.defaults[prop]).trim() === String(normalized).trim();
  if (!Number.isFinite(step) || step <= 0 || matchesDefault || !['number', 'css-value'].includes(rule?.type)) {
    return normalized;
  }

  const cssMatch = rule.type === 'css-value' && typeof normalized === 'string'
    ? /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([a-z%]*)$/iu.exec(normalized.trim())
    : null;
  const numeric = rule.type === 'number' && typeof normalized === 'number'
    ? normalized
    : cssMatch ? Number(cssMatch[1]) : NaN;
  if (!Number.isFinite(numeric)) {
    return normalized;
  }
  const base = Number.isFinite(rule?.min) ? Number(rule.min) : 0;
  const snapped = Number((base + Math.round((numeric - base) / step) * step).toFixed(8));
  if ((Number.isFinite(rule?.min) && snapped < Number(rule.min))
    || (Number.isFinite(rule?.max) && snapped > Number(rule.max))) {
    return normalized;
  }
  return rule.type === 'number' ? snapped : `${snapped}${cssMatch[2]}`;
}

function mapConstrainedPropValue(prop, value, options) {
  if (prop === 'gridTemplateColumns') {
    const repeatMatch = value.match(/repeat\(\s*(\d+)/i);
    const columnTokens = {
      1: 'one',
      2: 'two',
      3: 'three',
      4: 'four',
      6: 'six',
    };
    if (repeatMatch && Object.prototype.hasOwnProperty.call(columnTokens, repeatMatch[1])) {
      return columnTokens[repeatMatch[1]];
    }
  }

  if (prop === 'backgroundPosition') {
    const normalized = value.toLowerCase();
    for (const token of ['top', 'bottom', 'left', 'right', 'center']) {
      if (normalized.includes(token) && options.has(token)) {
        return token;
      }
    }
  }

  if (prop === 'boxShadow') {
    const shadowToken = shadowOptionForValue(value, options);
    if (shadowToken) {
      return shadowToken;
    }
  }

  if (prop.toLowerCase().endsWith('fontweight')) {
    const weightToken = nearestFontWeightOption(value, options);
    if (weightToken) {
      return weightToken;
    }
  }

  return value;
}

function shadowOptionForValue(value, options) {
  const normalized = value.toLowerCase();
  if (normalized === 'none' || normalized === 'initial' || normalized === 'unset') {
    return '';
  }
  const candidates = normalized.includes('xl') || normalized.includes('large') || normalized.includes('strong')
    ? ['shadow-lg', 'shadow-xl', 'shadow-md', 'shadow']
    : normalized.includes('sm') || normalized.includes('small')
      ? ['shadow-sm', 'shadow', 'shadow-md']
      : ['shadow-md', 'shadow', 'shadow-lg', 'shadow-sm'];

  return candidates.find((candidate) => options.has(candidate)) || '';
}

function nearestFontWeightOption(value, options) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const numericOptions = [...options]
    .map((option) => ({ option, numeric: Number.parseFloat(option) }))
    .filter((option) => Number.isFinite(option.numeric));
  if (numericOptions.length === 0) {
    return '';
  }

  numericOptions.sort((a, b) => {
    const delta = Math.abs(a.numeric - numeric) - Math.abs(b.numeric - numeric);
    return delta === 0 ? b.numeric - a.numeric : delta;
  });

  return numericOptions[0].option;
}

function firstAllowedProp(context, componentName, props) {
  const entry = context.contractIndex.get(componentName);
  const allowed = new Set(entry?.props || []);
  return props.find((prop) => allowed.has(prop)) || '';
}

function backgroundProps(context, componentName, color) {
  if (!color) {
    return {};
  }

  const entry = context.contractIndex.get(componentName);
  const allowed = new Set(entry?.props || []);
  if (allowed.size === 0 || allowed.has('background')) {
    return { background: color };
  }
  if (allowed.has('backgroundColor')) {
    return { backgroundColor: color };
  }

  return { background: color, backgroundColor: color };
}

function isMaidyProfile(context) {
  return context.replacementProfile?.name === 'maid-service-agency';
}

function isLumenProfile(context) {
  return context.replacementProfile?.name === 'lumen-eye-care-editorial';
}

function isOptomattaProfile(context) {
  return context.replacementProfile?.name === 'optomatta-optical-retail';
}

function maidyPanelColor(context) {
  const secondaryAccent = String(context.styleProfile.accent2 || '').trim().toLowerCase();
  return secondaryAccent === '#ffdd67' ? context.styleProfile.accent : context.styleProfile.accent2 || context.styleProfile.accent;
}

function maidyHighlightColor(context) {
  const panelColor = String(maidyPanelColor(context) || '').trim().toLowerCase();
  const candidates = [
    context.styleProfile.accent2,
    context.styleProfile.accent,
    context.styleProfile.buttonBg,
    '#ffdd67',
  ];

  return candidates.find((candidate) => {
    const color = String(candidate || '').trim();
    return color && color.toLowerCase() !== panelColor;
  }) || '#ffdd67';
}

function requiredMediaRoles(brief) {
  const roles = Array.isArray(brief.authoringRequirements?.requiredMediaRoles)
    ? brief.authoringRequirements.requiredMediaRoles
    : Array.isArray(brief.media?.requiredRoles)
      ? brief.media.requiredRoles
      : [];

  return roles
    .map((role) => ({
      role: typeof role?.role === 'string' ? role.role.trim() : '',
      minSurfaces: Number.isFinite(role?.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1,
    }))
    .filter((role) => role.role);
}

function requiredRoleMinimum(brief, roleName) {
  return requiredMediaRoles(brief)
    .filter((role) => role.role === roleName)
    .reduce((maximum, role) => Math.max(maximum, role.minSurfaces), 0);
}

function firstHeading(brief) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    return 'Thoughtful service, clearly delivered.';
  }

  return brief.text?.h1?.[0] || 'Thoughtful service, clearly delivered.';
}

function secondHeading(brief) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    const family = [brief.target?.archetype, brief.target?.referenceStyle].filter(Boolean).join(' ').toLowerCase();
    if (/luxury-car-care|careglo|car-detailing/.test(family)) {
      return 'Finish care for every surface';
    }
    if (/maid-service-agency|maidy|cleaning/.test(family)) {
      return 'Room-by-room care for homes and workplaces';
    }
    if (/optomatta|optical-retail|eyewear/.test(family)) {
      return 'Eye exams, frames, and long-term comfort';
    }
    if (/lumen|eye-care-editorial/.test(family)) {
      return 'Specialist care with a calmer pace';
    }

    return 'Services shaped around what matters';
  }

  return brief.text?.h2?.[0] || 'Featured services';
}

function h3Texts(brief) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    const family = [brief.target?.archetype, brief.target?.referenceStyle].filter(Boolean).join(' ').toLowerCase();
    if (/luxury-car-care|careglo|car-detailing/.test(family)) {
      return ['Exterior refinement', 'Interior renewal', 'Finish protection'];
    }
    if (/maid-service-agency|maidy|cleaning/.test(family)) {
      return ['Home refresh', 'Office upkeep', 'Move-out reset'];
    }
    if (/optomatta|optical-retail|eyewear/.test(family)) {
      return ['Vision exams', 'Frame fitting', 'Lens care'];
    }
    if (/lumen|eye-care-editorial/.test(family)) {
      return ['Vision testing', 'Specialist care', 'Treatment plans'];
    }

    return ['Personal service', 'Thoughtful guidance', 'Reliable follow-through'];
  }

  return Array.isArray(brief.text?.h3) ? brief.text.h3.filter(Boolean) : [];
}

function firstCta(brief) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    return 'Contact';
  }

  return brief.text?.ctas?.[0] || 'Contact';
}

function primaryAction(brief) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    return 'Plan a visit';
  }

  return brief.text?.ctas?.find((cta) => !/^\+?[\d\s().-]+$/.test(cta)) || firstCta(brief) || 'Get started';
}

function secondaryAction(brief, fallback) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    return fallback || 'Learn more';
  }

  const ctas = Array.isArray(brief.text?.ctas) ? brief.text.ctas.filter((cta) => !/^\+?[\d\s().-]+$/.test(cta)) : [];
  return ctas[1] || fallback || ctas[0] || 'Learn more';
}

function eyebrowText() {
  return 'THOUGHTFUL SERVICE';
}

function maidyEyebrowText(brief, profile) {
  return `${brandName(brief, profile)} CLEANING SERVICE`.toUpperCase();
}

function maidyHeroHeadingLines() {
  return {
    body: ['Fresh Rooms,', 'Calm Spaces,', 'Every Visit'],
    accent: 'Clean & Ready',
  };
}

function isMaidyRealReferenceBrief(brief) {
  const sourceUrl = typeof brief.authoringRequirements?.realReferenceSourceUrl === 'string'
    ? brief.authoringRequirements.realReferenceSourceUrl
    : '';

  return brief.authoringRequirements?.requireRealReference === true
    && /\bmaidy\b|askproject\.net\/maidy/i.test(sourceUrl);
}

function firstEmailText(brief, fallback) {
  const ctas = Array.isArray(brief.text?.ctas) ? brief.text.ctas : [];
  const email = ctas.find((cta) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cta || '').trim()));
  return email || fallback;
}

function brandName(brief, profile = replacementProfileForBrief(brief)) {
  if (profile.brand) {
    return profile.brand;
  }

  const style = brief.target?.referenceStyle || brief.target?.archetype || 'Northline';
  return String(style).split('-').filter(Boolean).slice(0, 2).join(' ') || 'Northline';
}

function serviceCopy(profile, index) {
  const copy = Array.isArray(profile.serviceCopy) ? profile.serviceCopy : [];
  return copy[index % copy.length] || DEFAULT_REPLACEMENT_PROFILE.serviceCopy[index % DEFAULT_REPLACEMENT_PROFILE.serviceCopy.length];
}

function proofCopy(profile) {
  return {
    ...DEFAULT_REPLACEMENT_PROFILE.proof,
    ...(profile.proof || {}),
  };
}

function styleProfileForBrief(brief, replacementProfile) {
  const base = {
    ...DEFAULT_REPLACEMENT_PROFILE.style,
    ...(replacementProfile.style || {}),
  };
  const variables = brief.visualSignals?.rootVariables && typeof brief.visualSignals.rootVariables === 'object'
    ? brief.visualSignals.rootVariables
    : {};
  const bg = cssColorValue(variables['--bg'], base.bg);
  const panel = cssColorValue(variables['--panel'], base.panel);
  const ink = cssColorValue(variables['--ink'], base.ink);
  const muted = cssColorValue(variables['--muted'], base.muted);
  const accent = cssColorValue(variables['--accent'], base.accent);
  const accent2 = cssColorValue(variables['--accent-2'], base.accent2);

  return {
    name: replacementProfile.name,
    bg,
    panel,
    ink,
    muted,
    accent,
    accent2,
    badgeBackground: cssColorValue(variables['--wash'], cssColorValue(variables['--soft'], base.badgeBackground)),
    navBackground: cssColorValue(variables['--secondary-bg'], base.navBackground || panel),
    cardBackground: cssColorValue(variables['--service-bg'], cssColorValue(variables['--surface'], base.cardBackground || panel)),
    cardInk: cssColorValue(variables['--service-ink'], base.cardInk || ink),
    cardMuted: muted || base.cardMuted,
    buttonBg: cssColorValue(variables['--button-bg'], base.buttonBg || ink),
    buttonFg: cssColorValue(variables['--button-fg'], base.buttonFg || '#ffffff'),
  };
}

function geometryProfileForBrief(brief, replacementProfile) {
  const base = {
    ...DEFAULT_REPLACEMENT_PROFILE.geometry,
    ...(replacementProfile.geometry || {}),
  };
  const variables = brief.visualSignals?.rootVariables && typeof brief.visualSignals.rootVariables === 'object'
    ? brief.visualSignals.rootVariables
    : {};
  const isCareglo = replacementProfile.name === 'luxury-car-care';
  const isLumen = replacementProfile.name === 'lumen-eye-care-editorial';
  const referenceGeometry = brief.authoringRequirements?.referenceGeometry;
  const maxWidth = isCareglo ? '1400px' : cssLengthValue(variables['--max'], base.maxWidth);
  const radius = cssLengthValue(variables['--radius'], base.radius);
  const heroMinHeight = cssLengthValue(variables['--hero-min'], base.heroMinHeight);
  const visualMinHeight = cssLengthValue(variables['--visual-min'], base.visualMinHeight);
  const secondaryMinHeight = cssLengthValue(
    variables['--secondary-min'],
    scalePxLength(visualMinHeight, 0.4, base.secondaryMinHeight)
  );
  const serviceMediaMinHeight = cssLengthValue(
    variables['--service-media-min'],
    scalePxLength(visualMinHeight, 0.38, base.serviceMediaMinHeight)
  );

  return {
    name: replacementProfile.name,
    maxWidth,
    innerMaxWidth: isCareglo ? CAREGLO_CANVAS_WIDTH : isLumen ? LUMEN_CANVAS_WIDTH : innerMaxWidthForSection(maxWidth),
    radius,
    cardRadius: radius,
    mediaRadius: scalePxLength(radius, 0.75, radius),
    navRadius: '999px',
    heroMinHeight,
    heroMinHeightTablet: scalePxLength(heroMinHeight, 0.78, '520px'),
    heroMinHeightMobile: scalePxLength(heroMinHeight, 0.52, '360px'),
    visualMinHeight,
    visualMinHeightTablet: scalePxLength(visualMinHeight, 0.78, '420px'),
    visualMinHeightMobile: scalePxLength(visualMinHeight, 0.56, '300px'),
    secondaryMinHeight,
    serviceMediaMinHeight,
    referenceGeometry: referenceGeometry && typeof referenceGeometry === 'object' ? referenceGeometry : null,
  };
}

function cssColorValue(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed) || /^rgba?\(/i.test(trimmed) || /^hsla?\(/i.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

function cssLengthValue(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^(?:0|[1-9]\d*(?:\.\d+)?)(?:px|rem|em|%)$/i.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

function innerMaxWidthForSection(maxWidth) {
  const pixels = pxNumber(maxWidth);
  if (pixels === null) {
    return maxWidth;
  }

  return `${Math.round(pixels + 40)}px`;
}

function scalePxLength(value, factor, fallback) {
  const pixels = pxNumber(value);
  if (pixels === null) {
    return fallback;
  }

  return `${Math.round(pixels * factor)}px`;
}

function pxNumber(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function referenceRectLength(box, key) {
  const value = Number(box?.rect?.[key]);
  return Number.isFinite(value) && value > 0 ? `${Math.round(value)}px` : '';
}

function replacementProfileForBrief(brief) {
  const haystack = [
    brief.target?.archetype,
    brief.target?.referenceStyle,
    brief.target?.variant,
    brief.text?.title,
    firstHeading(brief),
    secondHeading(brief),
    ...h3Texts(brief),
  ].filter(Boolean).join(' ').toLowerCase();

  const profile = REPLACEMENT_PROFILES.find((item) => item.match.some((term) => haystack.includes(term))) || DEFAULT_REPLACEMENT_PROFILE;
  const realReferenceSourceUrl = typeof brief.authoringRequirements?.realReferenceSourceUrl === 'string'
    ? brief.authoringRequirements.realReferenceSourceUrl.trim()
    : '';
  const usesRealReference = brief.authoringRequirements?.requireRealReference === true || /^https?:\/\//i.test(realReferenceSourceUrl);
  const canUseGeneratedTargetMedia = usesRealReference === false && Boolean(brief.target?.seed) && Array.isArray(brief.media?.surfaces);
  if (!canUseGeneratedTargetMedia) {
    return profile;
  }

  const surfaces = brief.media.surfaces
    .filter((surface) => surface && typeof surface === 'object' && typeof surface.source === 'string' && surface.source.trim());
  const hero = surfaces.find((surface) => surface.role === 'hero')?.source || profile.hero;
  const secondary = surfaces.find((surface) => surface.role === 'secondary')?.source || profile.secondary;
  const serviceCard = surfaces
    .filter((surface) => surface.role === 'service-card')
    .map((surface) => surface.source)
    .filter(Boolean);

  return {
    ...profile,
    hero,
    secondary,
    equipment: profile.equipment,
    serviceCard: serviceCard.length > 0 ? serviceCard : profile.serviceCard,
  };
}

function statItems(brief) {
  if (brief.authoringRequirements?.requireRealReference === true) {
    return [
      { value: '4.8', label: 'average rating' },
      { value: '24h', label: 'reply window' },
      { value: '12+', label: 'experienced specialists' },
    ];
  }

  if (!Array.isArray(brief.text?.stats)) {
    return [];
  }

  return brief.text.stats
    .map(parseStatItem)
    .filter(Boolean)
    .slice(0, 4);
}

function parseStatItem(item) {
  const normalized = String(item || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(' ');
  const value = parts.shift() || '';
  if (!isMetricValue(value)) {
    return null;
  }

  return {
    value,
    label: parts.join(' ') || 'metric',
  };
}

function isMetricValue(value) {
  return /^[+~]?\d/.test(String(value || ''));
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

function slugify(value) {
  const slug = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'node';
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function auditDraft(options) {
  if (!options.referenceManifest) {
    return null;
  }

  const args = [
    path.join(__dirname, 'audit-monteby-layout.js'),
    '--layout',
    options.out,
    '--contract',
    options.contract,
    '--reference-manifest',
    options.referenceManifest,
    '--json',
  ];

  if (typeof options.minMediaSurfaces === 'number') {
    args.push('--min-media-surfaces', String(options.minMediaSurfaces));
  }
  if (options.requireRealReference) {
    args.push('--require-real-reference');
  }
  if (options.requireMarketplaceMedia) {
    args.push('--require-marketplace-media');
  }

  const run = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const report = parseAuditJson(run.stdout);

  return {
    status: run.status === null ? 1 : run.status,
    ok: run.status === 0 && report?.ok === true,
    report,
    stderr: String(run.stderr || '').trim(),
  };
}

function parseAuditJson(stdout) {
  const output = String(stdout || '').trim();
  if (!output) {
    return null;
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    return {
      ok: false,
      errors: [{
        code: 'invalid_audit_output',
        message: error instanceof Error ? error.message : String(error),
      }],
      warnings: [],
      stats: {},
    };
  }
}

function auditSummary(audit) {
  if (!audit) {
    return null;
  }

  return {
    status: audit.status,
    ok: audit.ok,
    errors: Array.isArray(audit.report?.errors) ? audit.report.errors : [],
    warnings: Array.isArray(audit.report?.warnings) ? audit.report.warnings : [],
    stats: audit.report?.stats && typeof audit.report.stats === 'object' ? audit.report.stats : {},
    stderr: audit.stderr,
  };
}

function draftQualityErrors(draft, referenceManifest, options) {
  const errors = [];
  const sourceUrl = typeof referenceManifest?.sourceUrl === 'string' ? referenceManifest.sourceUrl : '';

  if (
    options.requireRealReference
    && options.requireMarketplaceMedia
    && draft.stats?.mediaProfile === 'maid-service-agency'
    && /\bmaidy\b|askproject\.net\/maidy/i.test(sourceUrl)
    && !maidyHeroCutoutSource()
    && !maidyHeroCompositeSource()
  ) {
    errors.push({
      code: 'missing_maidy_hero_cutout_asset',
      message: 'Captured Maidy references use a cleaner/person cutout or composite hero artwork. Provide a generated, licensed, or user-provided transparent PNG/WebP through MONTEBY_MAIDY_HERO_CUTOUT_URL, or a full hero composite through MONTEBY_MAIDY_HERO_COMPOSITE_URL, before drafting a real-reference Maidy candidate.',
    });
  }

  if (
    options.requireRealReference
    && options.requireMarketplaceMedia
    && draft.stats?.mediaProfile === 'optomatta-optical-retail'
    && /optomatta|kits\.moxcreative\.com\/optomatta/i.test(sourceUrl)
    && !optomattaHeroCompositeSource()
  ) {
    errors.push({
      code: 'missing_optomatta_hero_composite_asset',
      message: 'Captured Optomatta references use one full-width optical hero bitmap. Provide a generated, licensed, or user-provided 1440px-wide composite replacement through MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL before drafting a real-reference Optomatta candidate.',
    });
  }

  if (
    options.requireRealReference
    && options.requireMarketplaceMedia
    && /\blumen\b|omispace\.com\/lumen/i.test(sourceUrl)
    && !lumenDoctorCutoutSource()
  ) {
    errors.push({
      code: 'missing_lumen_doctor_cutout_asset',
      message: 'Captured Lumen references use a transparent/cutout-like doctor hero. Provide a generated, licensed, or user-provided transparent PNG/WebP through MONTEBY_LUMEN_DOCTOR_CUTOUT_URL before drafting a real-reference Lumen candidate.',
    });
  }

  return errors;
}

function maidyHeroCutoutSource() {
  const source = String(process.env.MONTEBY_MAIDY_HERO_CUTOUT_URL || '').trim();

  if (!/^https?:\/\//i.test(source) || !isTransparentCutoutSource(source)) {
    return '';
  }

  return source;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const contract = readJson(options.contract);
    const referenceManifest = options.referenceManifest ? readJson(options.referenceManifest) : null;
    const brief = briefWithReferenceMediaRequirements(readBrief(options), referenceManifest, options);
    const draft = draftLayout(buildContractIndex(contract), brief);

    writeFile(options.out, `${JSON.stringify(draft.layout, null, 2)}\n`);
    const audit = auditDraft(options);
    const qualityErrors = draftQualityErrors(draft, referenceManifest, options);
    const ok = (!audit || audit.ok) && qualityErrors.length === 0;
    if (options.json) {
      console.log(JSON.stringify({
        ok,
        out: options.out,
        warnings: draft.warnings,
        qualityErrors,
        stats: draft.stats,
        audit: auditSummary(audit),
      }, null, 2));
    } else {
      console.log(`layout_draft=${options.out}`);
      if (audit) {
        console.log(`draft_audit=${audit.ok ? 'ok' : 'failed'}`);
      }
      if (qualityErrors.length > 0) {
        console.log('draft_quality=failed');
        for (const error of qualityErrors) {
          console.error(`${error.code}: ${error.message}`);
        }
      }
    }
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
