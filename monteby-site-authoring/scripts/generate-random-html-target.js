#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { runBoundedProcess } = require('./bounded-child-process');
const { captureViewportTimeoutMs, resolveNpxExecutable } = require('./capture-template-reference');

const DEFAULT_VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 1200 },
  { label: 'tablet', width: 834, height: 1112 },
  { label: 'mobile', width: 390, height: 844 },
];

const palettes = [
  { name: 'civic-lime', bg: '#f5f7ef', panel: '#ffffff', ink: '#18201b', muted: '#5d665c', accent: '#8bbf2f', accent2: '#1f7a68' },
  { name: 'studio-coral', bg: '#fff8f4', panel: '#ffffff', ink: '#261f1c', muted: '#7b6960', accent: '#ff6847', accent2: '#2d6cdf' },
  { name: 'signal-blue', bg: '#f4f8ff', panel: '#ffffff', ink: '#111827', muted: '#526071', accent: '#2563eb', accent2: '#06b6d4' },
  { name: 'graphite-gold', bg: '#f7f5ef', panel: '#ffffff', ink: '#171717', muted: '#65615a', accent: '#b88a2d', accent2: '#0f766e' },
  { name: 'mint-berry', bg: '#f4fbf8', panel: '#ffffff', ink: '#10201c', muted: '#4f625d', accent: '#16a085', accent2: '#bf3f77' },
];

const archetypes = [
  {
    name: 'research-lab',
    brand: 'Northstar Field',
    eyebrow: 'Independent research studio',
    title: 'Designing field notes for complex digital products.',
    body: 'We turn interviews, product signals, and field evidence into clear decisions teams can act on with confidence.',
    cta: 'Explore the method',
    nav: ['Work', 'Approach', 'Contact'],
    supportingNote: 'Independent thinking, practical outcomes.',
    snapshotLabel: 'Recent studies',
    featureLabel: 'Featured study',
    featureTitle: 'Clarity for the decisions that shape what comes next.',
    closingTitle: 'Turn complex evidence into a confident next move.',
    closingBody: 'From first interview to final narrative, every finding stays clear, useful, and ready to act on.',
    closingCta: 'Start a study',
    metrics: ['42 studies', '18 markets', '7 week sprints'],
    cards: ['Evidence maps', 'Decision rooms', 'Narrative systems'],
  },
  {
    name: 'venue-program',
    brand: 'Morrow House',
    eyebrow: 'Autumn program',
    title: 'A cultural calendar built around sound, food, and late evenings.',
    body: 'Gather for intimate performances, seasonal plates, and a calendar designed to keep the night unfolding.',
    cta: 'View schedule',
    nav: ['Program', 'Spaces', 'Visit'],
    supportingNote: 'Reservations are open for the autumn season.',
    snapshotLabel: 'Season at a glance',
    featureLabel: 'Tonight at the hall',
    featureTitle: 'A full evening of sound, flavor, and shared tables.',
    closingTitle: 'Plan an evening worth staying late for.',
    closingBody: 'Choose a room, explore the program, and reserve your place for an evening made to unfold slowly.',
    closingCta: 'Reserve a table',
    metrics: ['24 events', '5 rooms', '11 artists'],
    cards: ['Listening room', 'Chef table', 'Night archive'],
  },
  {
    name: 'fintech-ops',
    brand: 'Tandem Ledger',
    eyebrow: 'Operations dashboard',
    title: 'Monitor cash movement without losing the human story.',
    body: 'Bring treasury, risk, and audit activity into one calm view, so every review starts with the full picture.',
    cta: 'Request access',
    nav: ['Platform', 'Security', 'Company'],
    supportingNote: 'Guided onboarding for modern finance teams.',
    snapshotLabel: 'Live overview',
    featureLabel: 'Cash intelligence',
    featureTitle: 'One reliable view across every account and approval.',
    closingTitle: 'Give every cash decision a clearer path.',
    closingBody: 'Connect the signals your team already trusts and move from review to action without losing context.',
    closingCta: 'Book a walkthrough',
    metrics: ['99.98% uptime', '3 min review', '128 controls'],
    cards: ['Treasury view', 'Risk queue', 'Audit trail'],
  },
  {
    name: 'architecture-office',
    brand: 'Courtyard Works',
    eyebrow: 'Urban housing practice',
    title: 'Quiet buildings with generous shared space.',
    body: 'We shape durable homes and public places through honest materials, careful proportion, and generous everyday space.',
    cta: 'See projects',
    nav: ['Projects', 'Practice', 'Contact'],
    supportingNote: 'New commissions are considered year-round.',
    snapshotLabel: 'Practice overview',
    featureLabel: 'Current work',
    featureTitle: 'Shared spaces shaped for light, comfort, and belonging.',
    closingTitle: 'Begin with the life a place should hold.',
    closingBody: 'From early studies to the finished threshold, we design every decision around how people gather and live.',
    closingCta: 'Discuss a project',
    metrics: ['31 sites', '9 cities', '14 awards'],
    cards: ['Courtyard homes', 'Adaptive reuse', 'Public interiors'],
  },
];

const serviceArchetypes = [
  {
    name: 'luxury-car-care',
    brand: 'Aureline Auto',
    eyebrow: 'Private detailing studio',
    title: 'Precision detailing, finished like a private commission.',
    body: 'From paint correction to cabin care, every appointment is paced, documented, and finished for a lasting reveal.',
    cta: 'Book a visit',
    secondaryCta: 'View services',
    stats: ['4.9 rating', '1.2k visits', '24h response'],
    cards: ['Signature detail', 'Interior reset', 'Protective finish'],
    referenceStyle: 'careglo-dark-service',
    heroImage: 'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=1600',
    detailImage: 'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=900',
    cardImages: [
      'https://images.pexels.com/photos/17029940/pexels-photo-17029940/free-photo-of-back-view-of-a-woman-cleaning-a-car.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=900',
    ],
  },
  {
    name: 'neighborhood-cleaning',
    brand: 'Tidy & True',
    eyebrow: 'Home care team',
    title: 'Fresh rooms, simple booking, and cleaner routines.',
    body: 'Flexible home care for busy weeks, with reliable teams, thoughtful details, and booking that takes only a moment.',
    cta: 'Schedule cleaning',
    secondaryCta: 'How it works',
    stats: ['18 teams', '900 homes', '7 day plans'],
    cards: ['Deep clean', 'Move-in support', 'Weekly refresh'],
    heroImage: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=82',
    detailImage: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=82',
    cardImages: [
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    name: 'maid-service-agency',
    brand: 'FreshNest',
    eyebrow: 'Home cleaning service',
    title: 'Come home to rooms that feel fresh and effortless.',
    titleLead: 'Come home to rooms that feel ',
    titleAccent: 'fresh and effortless.',
    body: 'Reliable teams, carefully stocked kits, and a simple plan for homes, offices, and handover days.',
    cta: 'Get started',
    secondaryCta: 'How we work',
    stats: ['4.8 rating', '620 homes', '12 teams'],
    cards: ['House refresh', 'Office upkeep', 'Move-out reset'],
    referenceStyle: 'maidy-bright-cleaning',
    heroImage: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=82',
    detailImage: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=82',
    cardImages: [
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    name: 'modern-eye-clinic',
    brand: 'Kindred Eye',
    eyebrow: 'Care clinic',
    title: 'See better with care that feels calm and precise.',
    body: 'Thoughtful exams, specialist guidance, and clear next steps from your first appointment onward.',
    cta: 'Book exam',
    secondaryCta: 'Explore care',
    stats: ['10k patients', '15 experts', '4.8 score'],
    cards: ['Vision test', 'Frame fitting', 'Eye therapy'],
    heroImage: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1400&q=82',
    detailImage: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=82',
    cardImages: [
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    name: 'optomatta-optical-retail',
    brand: 'Opticline',
    eyebrow: 'Optical care studio',
    title: 'Find your clearest look with eyewear made to fit.',
    body: 'Personal eye exams, considered frame styling, and precision lenses brought together in one easy visit.',
    cta: 'Shop frames',
    secondaryCta: 'Ask optometrist',
    stats: ['28 doctors', '24h service', '4.9 rating'],
    cards: ['Eye exams', 'Frame fitting', 'Lens care'],
    referenceStyle: 'optomatta-optical-retail',
    heroImage: 'https://images.pexels.com/photos/6749726/pexels-photo-6749726.jpeg?auto=compress&cs=tinysrgb&w=1500',
    detailImage: 'https://images.pexels.com/photos/6749708/pexels-photo-6749708.jpeg?auto=compress&cs=tinysrgb&w=900',
    cardImages: [
      'https://images.pexels.com/photos/6749730/pexels-photo-6749730.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749698/pexels-photo-6749698.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749727/pexels-photo-6749727.jpeg?auto=compress&cs=tinysrgb&w=900',
    ],
  },
  {
    name: 'lumen-eye-care-editorial',
    brand: 'Iriswell',
    eyebrow: 'Eye care clinic',
    title: 'Clear Vision. Open Horizons.',
    titleLead: 'Clear Vision.',
    titleAccent: 'Open Horizons.',
    body: 'Specialist eye care, thoughtful explanations, and a calm plan for protecting sight at every stage of life.',
    cta: 'Book now',
    secondaryCta: 'Explore services',
    stats: ['10k patients', '15 years', '7 care rooms'],
    cards: ['Vision testing', 'Specialist care', 'Treatment plans'],
    referenceStyle: 'lumen-eye-care-editorial',
    heroImage: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1200&q=82',
    detailImage: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=900&q=82',
    cardImages: [
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=700&q=80',
    ],
  },
];

const variants = ['split-hero', 'editorial-ledger', 'bento-showcase', 'tabbed-program', 'marketplace-service'];
const serviceArchetypeNames = serviceArchetypes.map((archetype) => archetype.name);

function parseArgs(argv) {
  const options = {
    seed: String(Date.now()),
    outDir: path.resolve(process.cwd(), 'monteby-random-target'),
    variant: 'auto',
    archetype: '',
    marketplaceReference: false,
    captureScreenshots: false,
    fullPage: false,
    waitMs: 1000,
    viewports: DEFAULT_VIEWPORTS,
    channel: '',
    playwrightPackage: 'playwright@1.54.1',
    viewportTimeoutMs: 0,
  };
  const customViewports = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--seed') {
      options.seed = requiredValue(argv, index += 1, arg);
    } else if (arg === '--out-dir') {
      options.outDir = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--variant') {
      options.variant = requiredValue(argv, index += 1, arg);
    } else if (arg === '--archetype') {
      options.archetype = requiredValue(argv, index += 1, arg);
    } else if (arg === '--marketplace-reference') {
      options.marketplaceReference = true;
    } else if (arg === '--capture-screenshots') {
      options.captureScreenshots = true;
    } else if (arg === '--full-page') {
      options.fullPage = true;
    } else if (arg === '--wait-ms') {
      options.waitMs = parseNonNegativeInteger(requiredValue(argv, index += 1, arg), arg);
    } else if (arg === '--viewport') {
      customViewports.push(parseViewport(requiredValue(argv, index += 1, arg)));
    } else if (arg === '--channel') {
      options.channel = requiredValue(argv, index += 1, arg);
    } else if (arg === '--playwright-package') {
      options.playwrightPackage = requiredValue(argv, index += 1, arg);
    } else if (arg === '--viewport-timeout-ms') {
      const timeoutMs = Number(requiredValue(argv, index += 1, arg));
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error('--viewport-timeout-ms must be a positive integer');
      }
      options.viewportTimeoutMs = timeoutMs;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: generate-random-html-target.js [--seed value] [--out-dir path] [--variant auto|${variants.join('|')}] [--archetype ${serviceArchetypeNames.join('|')}] [--marketplace-reference] [--capture-screenshots] [--viewport label:WIDTHxHEIGHT] [--full-page] [--viewport-timeout-ms milliseconds] [--channel name]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (customViewports.length > 0) {
    options.viewports = customViewports;
  }

  if (options.variant !== 'auto' && !variants.includes(options.variant)) {
    throw new Error(`Unsupported variant: ${options.variant}. Expected auto, ${variants.join(', ')}.`);
  }

  if (options.marketplaceReference) {
    if (options.variant === 'auto') {
      options.variant = 'marketplace-service';
    } else if (options.variant !== 'marketplace-service') {
      throw new Error('--marketplace-reference can only be used with --variant marketplace-service or --variant auto.');
    }
  }

  if (options.archetype) {
    if (!serviceArchetypeNames.includes(options.archetype)) {
      throw new Error(`Unsupported archetype: ${options.archetype}. Expected ${serviceArchetypeNames.join(', ')}.`);
    }

    if (options.variant === 'auto') {
      options.variant = 'marketplace-service';
    } else if (options.variant !== 'marketplace-service') {
      throw new Error('--archetype can only be used with --variant marketplace-service or --variant auto.');
    }
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

function parseNonNegativeInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }

  return parsed;
}

function parseViewport(value) {
  const match = /^([a-z0-9-]+):([1-9][0-9]*)x([1-9][0-9]*)$/i.exec(value);
  if (!match) {
    throw new Error('--viewport must use label:WIDTHxHEIGHT, for example desktop:1440x1200');
  }

  return {
    label: slugify(match[1]),
    width: parseNonNegativeInteger(match[2], '--viewport width'),
    height: parseNonNegativeInteger(match[3], '--viewport height'),
  };
}

function slugify(input) {
  const slug = String(input).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'target';
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed) {
  let state = hashSeed(seed);
  return function next() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function marketplaceMediaRoles() {
  return [
    {
      role: 'hero',
      minSurfaces: 1,
      placement: 'firstViewport',
      description: 'Large first-viewport replacement hero photo/background.',
    },
    {
      role: 'secondary',
      minSurfaces: 1,
      placement: 'firstViewport',
      description: 'Supporting first-viewport photo such as detail, equipment, proof, or mini visual.',
    },
    {
      role: 'service-card',
      minSurfaces: 3,
      placement: 'afterHero',
      description: 'Photo surfaces inside service/package/content cards below the hero.',
    },
  ];
}

function marketplaceMediaSurfaces(archetype) {
  return [
    {
      role: 'hero',
      placement: 'firstViewport',
      source: archetype.heroImage,
      description: 'Primary first-viewport hero photo/background.',
    },
    {
      role: 'secondary',
      placement: 'firstViewport',
      source: archetype.detailImage,
      description: 'Supporting first-viewport detail, proof, equipment, or mini media photo.',
    },
    ...archetype.cardImages.map((source, index) => ({
      role: 'service-card',
      placement: 'afterHero',
      source,
      description: `Service card photo ${index + 1}.`,
    })),
  ];
}

function marketplaceImageSources(archetype) {
  return marketplaceMediaSurfaces(archetype).map((surface) => surface.source);
}

function configuredImageSource(environmentName, allowedPathPattern) {
  const source = String(process.env[environmentName] || '').trim();
  if (source === '') {
    return '';
  }

  try {
    const url = new URL(source);
    return (url.protocol === 'http:' || url.protocol === 'https:') && allowedPathPattern.test(url.pathname)
      ? source
      : '';
  } catch {
    return '';
  }
}

function eyeCareContinuationMediaSurfaces(isLumenStyle) {
  const sources = isLumenStyle
    ? [
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1580281658626-ee379f3cce93?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1576765608622-067973a79f53?auto=format&fit=crop&w=900&q=80',
    ]
    : [
      'https://images.pexels.com/photos/6749729/pexels-photo-6749729.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/6749739/pexels-photo-6749739.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749728/pexels-photo-6749728.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749733/pexels-photo-6749733.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749722/pexels-photo-6749722.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749732/pexels-photo-6749732.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749741/pexels-photo-6749741.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749708/pexels-photo-6749708.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749698/pexels-photo-6749698.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/6749726/pexels-photo-6749726.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=900&q=80',
    ];

  return sources.map((source, index) => ({
    role: 'reference-media',
    placement: 'page',
    source,
    description: `Extended eye-care template media surface ${index + 1}.`,
  }));
}

function cleaningContinuationMediaSurfaces() {
  const sources = [
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=1200&q=82',
    'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1649073005971-37babef31983?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1649073000644-d839009ff2dd?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
  ];

  return sources.map((source, index) => ({
    role: 'reference-media',
    placement: 'page',
    source,
    description: `Extended cleaning-service template media surface ${index + 1}.`,
  }));
}

function carCareContinuationMediaSurfaces() {
  const sources = [
    'https://images.pexels.com/photos/6872164/pexels-photo-6872164.jpeg?auto=compress&cs=tinysrgb&w=1400',
    'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=1000',
    'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=1000',
    'https://images.pexels.com/photos/17029940/pexels-photo-17029940/free-photo-of-back-view-of-a-woman-cleaning-a-car.jpeg?auto=compress&cs=tinysrgb&w=1000',
    'https://images.pexels.com/photos/5233285/pexels-photo-5233285.jpeg?auto=compress&cs=tinysrgb&w=1000',
    'https://images.pexels.com/photos/6873119/pexels-photo-6873119.jpeg?auto=compress&cs=tinysrgb&w=1000',
    'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=80',
  ];

  return sources.map((source, index) => ({
    role: 'reference-media',
    placement: 'page',
    source,
    description: `Extended luxury car-care template media surface ${index + 1}.`,
  }));
}

function between(random, min, max) {
  return Math.round(min + random() * (max - min));
}

function buildTarget(seed, requestedVariant = 'auto', requestedArchetype = '') {
  const random = rng(seed);
  const variant = requestedVariant === 'auto' ? pick(variants, random) : requestedVariant;

  if (variant === 'editorial-ledger') {
    return buildEditorialLedgerTarget(seed, random, variant);
  }

  if (variant === 'bento-showcase') {
    return buildBentoShowcaseTarget(seed, random, variant);
  }

  if (variant === 'tabbed-program') {
    return buildTabbedProgramTarget(seed, random, variant);
  }

  if (variant === 'marketplace-service') {
    return buildMarketplaceServiceTarget(seed, random, variant, requestedArchetype);
  }

  return buildSplitHeroTarget(seed, random, variant);
}

function buildSplitHeroTarget(seed, random, variant) {
  const palette = pick(palettes, random);
  const archetype = pick(archetypes, random);
  const radius = between(random, 10, 28);
  const heroHeight = between(random, 520, 720);
  const cardTilt = between(random, -3, 3);
  const maxWidth = pick([1080, 1160, 1240, 1320], random);
  const columns = pick([3, 4], random);

  const manifest = {
    seed,
    variant,
    archetype: archetype.name,
    palette: palette.name,
    maxWidth,
    columns,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    notes: [
      'HTML is a visual target only.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
    ],
  };

  const cards = archetype.cards.map((card, index) => `
      <article class="card card-${index + 1}">
        <span class="card-index">0${index + 1}</span>
        <h3>${escapeHtml(card)}</h3>
        <p>${escapeHtml(cardCopy(index))}</p>
      </article>`).join('');

  const metrics = archetype.metrics.map((metric) => {
    const [value, ...label] = metric.split(' ');
    return `
      <div class="metric">
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(label.join(' '))}</span>
      </div>`;
  }).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(archetype.brand)} | ${escapeHtml(archetype.eyebrow)}</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --accent-2: ${palette.accent2};
      --radius: ${radius}px;
      --max: ${maxWidth}px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    .shell { overflow: hidden; }
    .nav {
      width: min(var(--max), calc(100vw - 40px));
      margin: 24px auto 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 14px 18px;
      border: 1px solid color-mix(in srgb, var(--ink), transparent 86%);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel), transparent 4%);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; }
    .mark { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
    .links { display: flex; gap: 20px; color: var(--muted); font-size: 14px; }
    .nav button, .hero a, .cta a {
      border: 0;
      border-radius: 999px;
      background: var(--ink);
      color: white;
      padding: 12px 18px;
      font-weight: 750;
      text-decoration: none;
    }
    .hero {
      min-height: ${heroHeight}px;
      width: min(var(--max), calc(100vw - 40px));
      margin: 58px auto 0;
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
      gap: 46px;
      align-items: center;
    }
    .eyebrow {
      display: inline-flex;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent), transparent 84%);
      color: var(--accent-2);
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    h1 {
      margin: 22px 0 20px;
      max-width: 820px;
      font-size: clamp(46px, 7vw, 92px);
      line-height: .95;
      letter-spacing: -0.04em;
    }
    .lead {
      max-width: 640px;
      color: var(--muted);
      font-size: 20px;
      line-height: 1.65;
    }
    .hero-actions { display: flex; align-items: center; gap: 18px; margin-top: 30px; }
    .hero-actions span { color: var(--muted); font-size: 14px; }
    .visual {
      position: relative;
      min-height: 480px;
      border-radius: calc(var(--radius) + 16px);
      background:
        radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent), transparent 46%), transparent 34%),
        linear-gradient(145deg, color-mix(in srgb, var(--accent-2), white 20%), color-mix(in srgb, var(--ink), white 18%));
      box-shadow: 0 40px 90px rgba(15, 23, 42, .18);
      transform: rotate(${cardTilt}deg);
      overflow: hidden;
    }
    .visual:before {
      content: "";
      position: absolute;
      inset: 28px;
      border: 1px solid rgba(255,255,255,.35);
      border-radius: var(--radius);
      background: linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,.08));
    }
    .metrics {
      width: min(var(--max), calc(100vw - 40px));
      margin: 18px auto 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
    .metric {
      padding: 22px;
      border-radius: var(--radius);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 90%);
    }
    .metric strong { display: block; font-size: 34px; line-height: 1; }
    .metric span { display: block; margin-top: 8px; color: var(--muted); }
    .cards {
      width: min(var(--max), calc(100vw - 40px));
      margin: 90px auto;
      display: grid;
      grid-template-columns: repeat(${columns}, minmax(0, 1fr));
      gap: 18px;
    }
    .card {
      min-height: 260px;
      padding: 26px;
      border-radius: var(--radius);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 88%);
      box-shadow: 0 22px 55px rgba(15, 23, 42, .08);
    }
    .card-index { color: var(--accent-2); font-weight: 900; }
    .card h3 { margin: 58px 0 12px; font-size: 26px; line-height: 1.08; }
    .card p { margin: 0; color: var(--muted); line-height: 1.65; }
    .cta {
      margin: 0 auto 34px;
      width: min(var(--max), calc(100vw - 40px));
      padding: 46px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      border-radius: calc(var(--radius) + 8px);
      background: var(--ink);
      color: white;
    }
    .cta h2 { margin: 0; max-width: 640px; font-size: clamp(32px, 4vw, 58px); line-height: 1; }
    .cta p { color: color-mix(in srgb, white, transparent 32%); line-height: 1.6; }
    .cta a { background: white; color: var(--ink); white-space: nowrap; }
    @media (max-width: 900px) {
      .links { display: none; }
      .hero { grid-template-columns: 1fr; min-height: auto; }
      .visual { min-height: 360px; transform: none; }
      .metrics, .cards { grid-template-columns: 1fr; }
      .cta { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav">
      <div class="brand"><span class="mark"></span><span>${escapeHtml(archetype.brand)}</span></div>
      <div class="links">${archetype.nav.map((link) => `<span>${escapeHtml(link)}</span>`).join('')}</div>
      <button type="button">Talk to us</button>
    </nav>
    <section class="hero">
      <div>
        <span class="eyebrow">${escapeHtml(archetype.eyebrow)}</span>
        <h1>${escapeHtml(archetype.title)}</h1>
        <p class="lead">${escapeHtml(archetype.body)}</p>
        <div class="hero-actions"><a href="#">${escapeHtml(archetype.cta)}</a><span>${escapeHtml(archetype.supportingNote)}</span></div>
      </div>
      <div class="visual" aria-hidden="true"></div>
    </section>
    <section class="metrics">${metrics}
    </section>
    <section class="cards">${cards}
    </section>
    <section class="cta">
      <div>
        <h2>${escapeHtml(archetype.closingTitle)}</h2>
        <p>${escapeHtml(archetype.closingBody)}</p>
      </div>
      <a href="#">${escapeHtml(archetype.closingCta)}</a>
    </section>
  </main>
</body>
</html>
`;

  return { html, manifest };
}

function buildTabbedProgramTarget(seed, random, variant) {
  const palette = pick(palettes, random);
  const radius = between(random, 12, 24);
  const maxWidth = pick([1180, 1240, 1320], random);
  const defaultActiveTab = 2;
  const heroImage = 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=84';
  const tabs = [
    {
      label: 'Doors open',
      title: 'Arrive before the first note.',
      content: 'Settle in with a short welcome pour, meet the room, and find a place close to the sound.',
      image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=82',
      imageAlt: 'Guests arriving inside an intimate music venue',
      time: '18:00',
    },
    {
      label: 'Listening room',
      title: 'Close sound, low light, no rush.',
      content: 'A focused live set shaped for a small audience, warm acoustics, and an unhurried beginning.',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=82',
      imageAlt: 'Singer performing under warm stage lighting',
      time: '19:15',
    },
    {
      label: 'Chef table',
      title: 'Seasonal plates between sets.',
      content: 'Share a generous menu of late-summer produce, bright sauces, and small plates made for the whole table.',
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=82',
      imageAlt: 'Seasonal dishes arranged on a dining table',
      time: '20:30',
    },
    {
      label: 'Courtyard set',
      title: 'Music under the late sky.',
      content: 'The evening moves outdoors for a brighter set, open air, and a little more room to gather.',
      image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=82',
      imageAlt: 'Outdoor concert audience beneath evening lights',
      time: '22:00',
    },
    {
      label: 'Night archive',
      title: 'Stay for the final reel.',
      content: 'Rare recordings and projected photographs close the night with stories from earlier seasons.',
      image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1400&q=82',
      imageAlt: 'Late-night performance in a crowded room',
      time: '23:30',
    },
  ].map((tab, index) => ({
    ...tab,
    labelPrefix: String(index + 1).padStart(2, '0'),
    labelSuffix: tab.time,
    eyebrow: `${tab.time} · Hall ${String.fromCharCode(65 + index)}`,
    ctaLabel: 'Reserve this part',
    ctaUrl: '#reserve',
  }));
  const cardImages = [tabs[1].image, tabs[3].image, tabs[4].image];
  const manifest = {
    seed,
    variant,
    archetype: 'venue-program-tabs',
    palette: palette.name,
    maxWidth,
    columns: 2,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    interactionPattern: {
      type: 'tabs',
      itemCount: tabs.length,
      defaultActiveTab,
      orientation: 'vertical',
      mobileTabLayout: 'scroll',
    },
    tabs,
    requiredMediaRoles: marketplaceMediaRoles(),
    mediaSurfaces: [
      {
        role: 'hero',
        placement: 'firstViewport',
        source: heroImage,
        description: 'Large opening venue photograph.',
      },
      {
        role: 'secondary',
        placement: 'firstViewport',
        source: tabs[0].image,
        description: 'Supporting first-viewport arrival photograph.',
      },
      ...cardImages.map((source, index) => ({
        role: 'service-card',
        placement: 'afterHero',
        source,
        description: `Program highlight photograph ${index + 1}.`,
      })),
      {
        role: 'reference-media',
        placement: 'page',
        source: tabs[defaultActiveTab].image,
        description: 'Active program tab photograph.',
      },
    ],
    notes: [
      'HTML is a visual target only.',
      'The active program state must become one real TabsBlock with keyboard behavior.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
    ],
  };
  manifest.imageSources = manifest.mediaSurfaces.map((surface) => surface.source);

  const tabButtons = tabs.map((tab, index) => `
          <button id="program-tab-${index}" type="button" role="tab" aria-selected="${index === defaultActiveTab}" aria-controls="program-panel-${index}" tabindex="${index === defaultActiveTab ? '0' : '-1'}">
            <span>${escapeHtml(tab.labelPrefix)}</span>
            <strong>${escapeHtml(tab.label)}</strong>
            <small>${escapeHtml(tab.labelSuffix)}</small>
          </button>`).join('');
  const tabPanels = tabs.map((tab, index) => `
          <article id="program-panel-${index}" class="program-panel" role="tabpanel" aria-labelledby="program-tab-${index}"${index === defaultActiveTab ? '' : ' hidden'}>
            <div class="program-copy">
              <span class="program-kicker">${escapeHtml(tab.eyebrow)}</span>
              <h3>${escapeHtml(tab.title)}</h3>
              <p>${escapeHtml(tab.content)}</p>
              <a href="${escapeHtml(tab.ctaUrl)}">${escapeHtml(tab.ctaLabel)}</a>
            </div>
            <img src="${escapeHtml(tab.image)}" alt="${escapeHtml(tab.imageAlt)}" ${index === defaultActiveTab ? 'loading="eager"' : 'loading="lazy"'}>
          </article>`).join('');
  const highlightCards = [
    ['The room', 'A low-lit hall tuned for close performances and clear sound.', cardImages[0]],
    ['Open air', 'A courtyard chapter that keeps the evening moving outside.', cardImages[1]],
    ['After hours', 'Archive films, late sets, and a final drink before midnight.', cardImages[2]],
  ].map(([title, body, image], index) => `
        <article class="highlight-card">
          <img src="${escapeHtml(image)}" alt="" loading="lazy">
          <span>0${index + 1}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(body)}</p>
        </article>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Morrow House | An evening in five parts</title>
  <style>
    :root {
      --paper: #f3f1e8;
      --ink: #14231d;
      --muted: #66716b;
      --forest: #183f34;
      --coral: #ff654d;
      --blue: #5368dc;
      --lime: #cce95c;
      --line: rgba(20, 35, 29, .16);
      --radius: ${radius}px;
      --max: ${maxWidth}px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    img { display: block; max-width: 100%; }
    a { color: inherit; }
    .site-header {
      width: min(var(--max), calc(100% - 40px));
      min-height: 78px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid var(--line);
    }
    .brand { display: flex; align-items: center; gap: 11px; font-weight: 850; }
    .brand-mark { width: 30px; height: 30px; border-radius: 50% 50% 8px 50%; background: var(--coral); transform: rotate(-12deg); }
    .nav-links { display: flex; gap: 28px; color: var(--muted); font-size: 14px; }
    .header-action, .hero-action, .program-copy a, .closing a {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 20px;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font-weight: 750;
      text-decoration: none;
    }
    .hero {
      width: min(var(--max), calc(100% - 40px));
      min-height: 730px;
      margin: 36px auto 0;
      display: grid;
      grid-template-columns: minmax(0, .84fr) minmax(420px, 1.16fr);
      gap: 26px;
    }
    .hero-copy {
      min-width: 0;
      padding: 54px 38px 48px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: space-between;
      border-radius: calc(var(--radius) + 10px);
      background: var(--lime);
    }
    .eyebrow, .program-kicker {
      font-size: 12px;
      font-weight: 850;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .hero h1 {
      margin: 42px 0 26px;
      max-width: 670px;
      font-size: clamp(62px, 7vw, 108px);
      line-height: .88;
      font-weight: 850;
    }
    .hero-copy p { max-width: 520px; margin: 0 0 30px; font-size: 19px; line-height: 1.6; }
    .hero-meta { width: 100%; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
    .hero-meta strong { display: block; font-size: 42px; line-height: 1; }
    .hero-meta span { color: rgba(20, 35, 29, .68); font-size: 13px; }
    .hero-media { position: relative; min-width: 0; overflow: hidden; border-radius: calc(var(--radius) + 10px); background: var(--blue); }
    .hero-media img { width: 100%; height: 100%; object-fit: cover; object-position: 54% 44%; filter: saturate(.86) contrast(1.05); }
    .hero-media > .hero-detail {
      position: absolute;
      z-index: 1;
      top: 22px;
      left: 22px;
      width: 250px;
      height: 170px;
      border: 8px solid var(--paper);
      border-radius: var(--radius);
      object-fit: cover;
      object-position: center;
      box-shadow: 0 18px 42px rgba(20, 35, 29, .26);
    }
    .hero-note {
      position: absolute;
      right: 22px;
      bottom: 22px;
      width: min(280px, calc(100% - 44px));
      padding: 20px;
      border-radius: var(--radius);
      background: rgba(243, 241, 232, .94);
      box-shadow: 0 18px 42px rgba(20, 35, 29, .22);
    }
    .hero-note strong { display: block; margin-bottom: 8px; font-size: 22px; }
    .hero-note span { color: var(--muted); line-height: 1.45; }
    .program {
      width: min(var(--max), calc(100% - 40px));
      margin: 118px auto 0;
    }
    .section-heading { display: grid; grid-template-columns: .65fr 1.35fr; gap: 32px; align-items: end; margin-bottom: 42px; }
    .section-heading h2 { margin: 0; max-width: 920px; font-size: clamp(46px, 6vw, 86px); line-height: .94; }
    .section-heading p { margin: 0 0 8px; max-width: 430px; color: var(--muted); line-height: 1.65; }
    .program-shell { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 18px; align-items: stretch; }
    .program-tabs {
      position: relative;
      z-index: 1;
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255,255,255,.38);
    }
    .program-tabs button {
      width: 100%;
      min-height: 78px;
      padding: 12px 14px;
      display: grid;
      grid-template-columns: 28px 1fr auto;
      align-items: center;
      gap: 8px;
      border: 0;
      border-radius: calc(var(--radius) - 5px);
      background: transparent;
      color: var(--muted);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .program-tabs button[aria-selected="true"] { background: var(--forest); color: #fff; }
    .program-tabs button:focus-visible { outline: 3px solid var(--coral); outline-offset: 2px; }
    .program-tabs button span, .program-tabs button small { font-size: 11px; }
    .program-tabs button strong { font-size: 14px; }
    .program-stage { min-width: 0; }
    .program-panel {
      min-height: 610px;
      padding: 22px;
      display: grid;
      grid-template-columns: minmax(240px, .82fr) minmax(0, 1.18fr);
      gap: 24px;
      border-radius: calc(var(--radius) + 8px);
      background: var(--forest);
      color: #fff;
    }
    .program-panel[hidden] { display: none; }
    .program-copy { min-width: 0; padding: 34px 20px 22px; display: flex; flex-direction: column; align-items: flex-start; }
    .program-kicker { color: var(--lime); }
    .program-copy h3 { margin: 52px 0 22px; font-size: clamp(42px, 5vw, 70px); line-height: .94; }
    .program-copy p { margin: 0 0 34px; color: rgba(255,255,255,.72); font-size: 17px; line-height: 1.65; }
    .program-copy a { margin-top: auto; background: var(--coral); }
    .program-panel > img { width: 100%; height: 100%; min-height: 566px; object-fit: cover; object-position: 50% 38%; border-radius: var(--radius); }
    .highlights {
      width: min(var(--max), calc(100% - 40px));
      margin: 112px auto 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .highlight-card { min-width: 0; padding: 14px 14px 28px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(255,255,255,.45); }
    .highlight-card img { width: 100%; height: 280px; object-fit: cover; object-position: center; border-radius: calc(var(--radius) - 5px); }
    .highlight-card > span { display: block; margin: 22px 10px 10px; color: var(--coral); font-size: 12px; font-weight: 850; }
    .highlight-card h3 { margin: 0 10px 10px; font-size: 28px; }
    .highlight-card p { margin: 0 10px; color: var(--muted); line-height: 1.6; }
    .closing {
      width: min(var(--max), calc(100% - 40px));
      margin: 112px auto 28px;
      padding: 62px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 32px;
      border-radius: calc(var(--radius) + 10px);
      background: var(--blue);
      color: #fff;
    }
    .closing h2 { margin: 0; max-width: 820px; font-size: clamp(46px, 6vw, 82px); line-height: .94; }
    .closing p { max-width: 520px; margin: 22px 0 0; color: rgba(255,255,255,.72); line-height: 1.6; }
    .closing a { flex: 0 0 auto; background: var(--lime); color: var(--ink); }
    @media (max-width: 1023px) {
      .hero { min-height: 660px; grid-template-columns: minmax(0, .9fr) minmax(330px, 1.1fr); }
      .hero-copy { padding: 42px 30px; }
      .hero h1 { font-size: clamp(54px, 8vw, 78px); }
      .program-shell { grid-template-columns: 190px minmax(0, 1fr); }
      .program-panel { min-height: 570px; grid-template-columns: 1fr; }
      .program-copy { padding: 24px 18px 0; }
      .program-copy h3 { margin-top: 30px; }
      .program-copy a { margin-top: 0; }
      .program-panel > img { min-height: 280px; height: 280px; object-position: 50% 30%; }
      .highlight-card img { height: 220px; }
    }
    @media (max-width: 767px) {
      .site-header, .hero, .program, .highlights, .closing { width: min(100% - 24px, var(--max)); }
      .site-header { min-height: 66px; }
      .nav-links { display: none; }
      .header-action { min-height: 40px; padding: 0 14px; font-size: 13px; }
      .hero { min-height: 0; margin-top: 18px; grid-template-columns: 1fr; }
      .hero-copy { min-height: 500px; padding: 34px 24px; }
      .hero h1 { margin-top: 32px; font-size: 58px; }
      .hero-meta { align-items: flex-start; flex-direction: column; }
      .hero-media { min-height: 500px; }
      .hero-media img { object-position: 64% 36%; }
      .hero-media > .hero-detail { top: 14px; left: 14px; width: 220px; height: 150px; border-width: 6px; }
      .program { margin-top: 82px; }
      .section-heading { grid-template-columns: 1fr; margin-bottom: 28px; }
      .section-heading h2 { font-size: 50px; }
      .program-shell { grid-template-columns: 1fr; }
      .program-tabs { overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: thin; flex-direction: row; }
      .program-tabs button { flex: 0 0 174px; min-height: 68px; }
      .program-panel { min-height: 0; padding: 14px; }
      .program-copy { padding: 22px 10px 12px; }
      .program-copy h3 { margin: 28px 0 18px; font-size: 44px; }
      .program-panel > img { min-height: 330px; height: 330px; object-position: 68% 24%; }
      .highlights { margin-top: 82px; grid-template-columns: 1fr; }
      .highlight-card img { height: 260px; }
      .closing { margin-top: 82px; padding: 40px 26px; align-items: flex-start; flex-direction: column; }
      .closing h2 { font-size: 48px; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="brand"><span class="brand-mark"></span><span>Morrow House</span></div>
    <nav class="nav-links" aria-label="Main navigation"><a href="#program">Program</a><a href="#spaces">Spaces</a><a href="#reserve">Visit</a></nav>
    <a class="header-action" href="#reserve">Reserve</a>
  </header>
  <main>
    <section class="hero">
      <div class="hero-copy">
        <div>
          <span class="eyebrow">One house · five chapters</span>
          <h1>An evening made to keep unfolding.</h1>
          <p>Move from close sound to shared plates, an open-air set, and a final archive screening without leaving the house.</p>
          <a class="hero-action" href="#program">See the evening</a>
        </div>
        <div class="hero-meta"><div><strong>17 Oct</strong><span>Doors from 18:00</span></div><span>Limited to 140 guests</span></div>
      </div>
      <div class="hero-media">
        <img src="${heroImage}" alt="Audience gathered beneath stage lights" loading="eager">
        <img class="hero-detail" src="${tabs[0].image}" alt="Guests arriving inside the venue" loading="eager">
        <div class="hero-note"><strong>Autumn house night</strong><span>Five spaces, one ticket, and a program that moves at its own pace.</span></div>
      </div>
    </section>
    <section class="program" id="program">
      <div class="section-heading"><span class="eyebrow">The full route</span><div><h2>Choose a chapter, then stay for the whole story.</h2><p>Each part has its own room, rhythm, and atmosphere. Your ticket keeps every door open.</p></div></div>
      <div class="program-shell">
        <div class="program-tabs" role="tablist" aria-label="Evening program" aria-orientation="vertical">${tabButtons}
        </div>
        <div class="program-stage">${tabPanels}
        </div>
      </div>
    </section>
    <section class="highlights" id="spaces">${highlightCards}
    </section>
    <section class="closing" id="reserve"><div><span class="eyebrow">17 October · one night only</span><h2>Come early. Leave after the last frame.</h2><p>One ticket includes every chapter, the shared table, and a late drink in the archive room.</p></div><a href="#">Reserve a place</a></section>
  </main>
  <script>
    const tabList = document.querySelector('[role="tablist"]');
    const tabButtons = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const tabPanels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
    const mobileTabs = window.matchMedia('(max-width: 767px)');
    const syncTabOrientation = () => {
      tabList.setAttribute('aria-orientation', mobileTabs.matches ? 'horizontal' : 'vertical');
    };
    const activateTab = (index, moveFocus = true) => {
      tabButtons.forEach((button, buttonIndex) => {
        const active = buttonIndex === index;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        tabPanels[buttonIndex].hidden = !active;
      });
      if (moveFocus) tabButtons[index].focus();
    };
    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => activateTab(index));
      button.addEventListener('keydown', (event) => {
        const orientation = tabList.getAttribute('aria-orientation');
        const forwardKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
        const backwardKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
        if (![forwardKey, backwardKey, 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabButtons.length - 1
            : event.key === forwardKey
              ? (index + 1) % tabButtons.length
              : (index - 1 + tabButtons.length) % tabButtons.length;
        activateTab(next);
      });
    });
    syncTabOrientation();
    mobileTabs.addEventListener('change', syncTabOrientation);
  </script>
</body>
</html>
`;

  return { html, manifest };
}

function buildEditorialLedgerTarget(seed, random, variant) {
  const palette = pick(palettes, random);
  const archetype = pick(archetypes, random);
  const radius = between(random, 6, 18);
  const maxWidth = pick([1120, 1200, 1280], random);
  const heroScale = pick([96, 104, 112], random);

  const manifest = {
    seed,
    variant,
    archetype: archetype.name,
    palette: palette.name,
    maxWidth,
    columns: 6,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    notes: [
      'HTML is a visual target only.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
      'This variant stresses asymmetric grids, sticky side panels, and text-heavy editorial rhythm.',
    ],
  };

  const metricRows = archetype.metrics.map((metric) => {
    const [value, ...label] = metric.split(' ');
    return `
        <div class="metric-row">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label.join(' '))}</span>
        </div>`;
  }).join('');

  const features = archetype.cards.map((card, index) => `
        <article class="feature feature-${index + 1}">
          <span>0${index + 1}</span>
          <h3>${escapeHtml(card)}</h3>
          <p>${escapeHtml(cardCopy(index))}</p>
        </article>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(archetype.brand)} | ${escapeHtml(archetype.eyebrow)}</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --accent-2: ${palette.accent2};
      --radius: ${radius}px;
      --max: ${maxWidth}px;
      --hero-scale: ${heroScale}px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    .shell { overflow: hidden; }
    .nav {
      width: min(var(--max), calc(100vw - 40px));
      margin: 28px auto 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      padding: 12px 0 18px;
      border-bottom: 1px solid color-mix(in srgb, var(--ink), transparent 82%);
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 850; }
    .mark { width: 42px; height: 42px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
    .links { display: flex; gap: 22px; color: var(--muted); font-size: 14px; }
    .nav a {
      border-radius: 999px;
      background: var(--ink);
      color: white;
      padding: 11px 16px;
      font-weight: 760;
      text-decoration: none;
    }
    .hero {
      width: min(var(--max), calc(100vw - 40px));
      margin: 74px auto 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 34px;
      align-items: end;
    }
    .eyebrow {
      display: inline-flex;
      padding: 8px 11px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent), transparent 86%);
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    h1 {
      margin: 18px 0 0;
      max-width: 980px;
      font-size: clamp(44px, 8vw, var(--hero-scale));
      line-height: .9;
      letter-spacing: -0.045em;
    }
    .intro-card {
      padding: 22px;
      border-radius: calc(var(--radius) + 10px);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 88%);
      box-shadow: 0 18px 45px rgba(15, 23, 42, .08);
      color: var(--muted);
      line-height: 1.6;
    }
    .ledger {
      width: min(var(--max), calc(100vw - 40px));
      margin: 54px auto 0;
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }
    .snapshot {
      position: sticky;
      top: 24px;
      min-height: 430px;
      padding: 24px;
      border-radius: calc(var(--radius) + 14px);
      background:
        radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--accent), transparent 42%), transparent 34%),
        linear-gradient(155deg, var(--ink), color-mix(in srgb, var(--accent-2), black 36%));
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 34px 70px rgba(15, 23, 42, .16);
    }
    .snapshot-label {
      width: fit-content;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .metric-row {
      display: grid;
      grid-template-columns: 82px 1fr;
      gap: 16px;
      align-items: baseline;
      padding: 18px 0;
      border-top: 1px solid rgba(255,255,255,.22);
    }
    .metric-row strong { font-size: 36px; line-height: 1; }
    .metric-row span { color: rgba(255,255,255,.72); }
    .story-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 18px;
    }
    .feature {
      min-height: 260px;
      padding: 26px;
      border-radius: calc(var(--radius) + 8px);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 88%);
      box-shadow: 0 18px 45px rgba(15, 23, 42, .07);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .feature span { color: var(--accent-2); font-weight: 900; }
    .feature h3 { margin: 50px 0 12px; font-size: 28px; line-height: 1.05; }
    .feature p { margin: 0; color: var(--muted); line-height: 1.65; }
    .feature-1 {
      grid-column: span 4;
      min-height: 360px;
      background: linear-gradient(145deg, color-mix(in srgb, var(--accent), white 10%), color-mix(in srgb, var(--accent-2), black 8%));
      color: white;
    }
    .feature-1 span, .feature-1 p { color: rgba(255,255,255,.78); }
    .feature-2 { grid-column: span 2; }
    .feature-3 { grid-column: span 3; }
    .quote-band {
      width: min(var(--max), calc(100vw - 40px));
      margin: 22px auto 42px;
      padding: 34px;
      border-radius: calc(var(--radius) + 12px);
      background: color-mix(in srgb, var(--accent), transparent 88%);
      display: flex;
      justify-content: space-between;
      gap: 28px;
      align-items: center;
    }
    .quote-band h2 { margin: 0; max-width: 720px; font-size: clamp(30px, 4vw, 54px); line-height: 1; }
    .quote-band p { margin: 0; max-width: 300px; color: var(--muted); line-height: 1.55; }
    @media (max-width: 900px) {
      .links { display: none; }
      .hero, .ledger { grid-template-columns: 1fr; }
      .snapshot { position: static; min-height: 320px; }
      .story-grid { grid-template-columns: 1fr; }
      .feature, .feature-1, .feature-2, .feature-3 { grid-column: auto; }
      .quote-band { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav">
      <div class="brand"><span class="mark"></span><span>${escapeHtml(archetype.brand)}</span></div>
      <div class="links">${archetype.nav.map((link) => `<span>${escapeHtml(link)}</span>`).join('')}</div>
      <a href="#">${escapeHtml(archetype.closingCta)}</a>
    </nav>
    <section class="hero">
      <div>
        <span class="eyebrow">${escapeHtml(archetype.eyebrow)}</span>
        <h1>${escapeHtml(archetype.title)}</h1>
      </div>
      <p class="intro-card">${escapeHtml(archetype.body)}</p>
    </section>
    <section class="ledger">
      <aside class="snapshot">
        <span class="snapshot-label">${escapeHtml(archetype.snapshotLabel)}</span>
        <div>${metricRows}
        </div>
      </aside>
      <div class="story-grid">${features}
      </div>
    </section>
    <section class="quote-band">
      <h2>${escapeHtml(archetype.closingTitle)}</h2>
      <p>${escapeHtml(archetype.closingBody)}</p>
    </section>
  </main>
</body>
</html>
`;

  return { html, manifest };
}

function buildBentoShowcaseTarget(seed, random, variant) {
  const palette = pick(palettes, random);
  const archetype = pick(archetypes, random);
  const radius = between(random, 14, 30);
  const maxWidth = pick([1120, 1200, 1280], random);
  const columns = 6;

  const manifest = {
    seed,
    variant,
    archetype: archetype.name,
    palette: palette.name,
    maxWidth,
    columns,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    notes: [
      'HTML is a visual target only.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
      'This variant stresses bento card spans, compact labels, layered panels, and CTA rhythm.',
    ],
  };

  const metrics = archetype.metrics.map((metric, index) => {
    const [value, ...label] = metric.split(' ');
    return `
        <div class="mini mini-${index + 1}">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label.join(' '))}</span>
        </div>`;
  }).join('');

  const cards = archetype.cards.map((card, index) => `
        <article class="tile tile-${index + 1}">
          <span>0${index + 1}</span>
          <h3>${escapeHtml(card)}</h3>
          <p>${escapeHtml(cardCopy(index))}</p>
        </article>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(archetype.brand)} | ${escapeHtml(archetype.eyebrow)}</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --accent-2: ${palette.accent2};
      --radius: ${radius}px;
      --max: ${maxWidth}px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    .shell { overflow: hidden; }
    .nav {
      width: min(var(--max), calc(100vw - 40px));
      margin: 26px auto 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 850; }
    .mark { width: 44px; height: 44px; border-radius: 16px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
    .nav-links { display: flex; gap: 18px; color: var(--muted); font-size: 14px; }
    .nav a, .hero a, .band a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 12px 17px;
      background: var(--ink);
      color: white;
      text-decoration: none;
      font-weight: 780;
    }
    .hero {
      width: min(var(--max), calc(100vw - 40px));
      margin: 66px auto 0;
      display: grid;
      grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
      gap: 24px;
      align-items: stretch;
    }
    .intro {
      min-height: 580px;
      padding: 34px;
      border-radius: calc(var(--radius) + 16px);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 88%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 24px 70px rgba(15, 23, 42, .09);
    }
    .eyebrow {
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent), transparent 84%);
      color: var(--accent-2);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: 12px;
      font-weight: 850;
    }
    h1 {
      margin: 28px 0 18px;
      font-size: clamp(42px, 6vw, 76px);
      line-height: .95;
      letter-spacing: -0.035em;
    }
    .intro p { margin: 0; max-width: 520px; color: var(--muted); font-size: 18px; line-height: 1.65; }
    .bento {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 16px;
    }
    .feature-panel {
      grid-column: span 6;
      min-height: 330px;
      padding: 28px;
      border-radius: calc(var(--radius) + 14px);
      color: white;
      background:
        radial-gradient(circle at 22% 18%, color-mix(in srgb, var(--accent), transparent 40%), transparent 34%),
        linear-gradient(145deg, color-mix(in srgb, var(--accent-2), black 8%), color-mix(in srgb, var(--ink), white 10%));
      box-shadow: 0 36px 80px rgba(15, 23, 42, .16);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .feature-panel span { opacity: .76; font-weight: 800; }
    .feature-panel h2 { margin: 0; max-width: 560px; font-size: clamp(34px, 4vw, 58px); line-height: 1; }
    .mini {
      grid-column: span 2;
      min-height: 150px;
      padding: 22px;
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--panel), transparent 4%);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 90%);
    }
    .mini strong { display: block; font-size: 34px; line-height: 1; }
    .mini span { display: block; margin-top: 8px; color: var(--muted); }
    .tiles {
      width: min(var(--max), calc(100vw - 40px));
      margin: 24px auto 70px;
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 16px;
    }
    .tile {
      min-height: 250px;
      grid-column: span 2;
      padding: 26px;
      border-radius: var(--radius);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--ink), transparent 88%);
      box-shadow: 0 20px 50px rgba(15, 23, 42, .07);
    }
    .tile span { color: var(--accent-2); font-weight: 900; }
    .tile h3 { margin: 56px 0 12px; font-size: 27px; line-height: 1.05; }
    .tile p { margin: 0; color: var(--muted); line-height: 1.65; }
    .band {
      width: min(var(--max), calc(100vw - 40px));
      margin: 0 auto 36px;
      padding: 30px;
      border-radius: calc(var(--radius) + 10px);
      background: color-mix(in srgb, var(--accent), transparent 84%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .band p { max-width: 660px; margin: 0; font-size: 28px; line-height: 1.1; font-weight: 820; }
    @media (max-width: 900px) {
      .nav-links { display: none; }
      .hero { grid-template-columns: 1fr; }
      .intro { min-height: 440px; }
      .bento, .tiles { grid-template-columns: 1fr; }
      .feature-panel, .mini, .tile { grid-column: auto; }
      .band { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav">
      <div class="brand"><span class="mark"></span><span>${escapeHtml(archetype.brand)}</span></div>
      <div class="nav-links">${archetype.nav.map((link) => `<span>${escapeHtml(link)}</span>`).join('')}</div>
      <a href="#">${escapeHtml(archetype.closingCta)}</a>
    </nav>
    <section class="hero">
      <div class="intro">
        <div>
          <span class="eyebrow">${escapeHtml(archetype.eyebrow)}</span>
          <h1>${escapeHtml(archetype.title)}</h1>
          <p>${escapeHtml(archetype.body)}</p>
        </div>
        <a href="#">${escapeHtml(archetype.cta)}</a>
      </div>
      <div class="bento">
        <article class="feature-panel">
          <span>${escapeHtml(archetype.featureLabel)}</span>
          <h2>${escapeHtml(archetype.featureTitle)}</h2>
        </article>${metrics}
      </div>
    </section>
    <section class="tiles">${cards}
    </section>
    <section class="band">
      <p>${escapeHtml(archetype.closingTitle)}</p>
      <a href="#">${escapeHtml(archetype.closingCta)}</a>
    </section>
  </main>
</body>
</html>
`;

  return { html, manifest };
}

function buildMaidyBrightCleaningTarget(seed, random, variant, archetype) {
  const radius = between(random, 16, 26);
  const maxWidth = pick([1180, 1220, 1280], random);
  const heroMinHeight = between(random, 660, 760);
  const continuationSurfaces = cleaningContinuationMediaSurfaces();
  const heroCompositeSource = configuredImageSource(
    'MONTEBY_MAIDY_HERO_COMPOSITE_URL',
    /\.(?:avif|jpe?g|png|webp)$/i,
  );
  const heroCutoutSource = heroCompositeSource === ''
    ? configuredImageSource('MONTEBY_MAIDY_HERO_CUTOUT_URL', /\.(?:png|webp)$/i)
    : '';
  const equipmentCutoutSource = configuredImageSource(
    'MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL',
    /\.(?:png|webp)$/i,
  );
  const heroAssetMode = heroCompositeSource !== '' ? 'composite' : heroCutoutSource !== '' ? 'cutout' : 'stock';
  const equipmentAssetMode = equipmentCutoutSource !== '' ? 'cutout' : 'stock';
  const heroMediaSource = heroCompositeSource || heroCutoutSource || archetype.heroImage;
  const equipmentMediaSource = equipmentCutoutSource || archetype.detailImage;
  const primaryMediaSurfaces = marketplaceMediaSurfaces(archetype).map((surface) => (
    surface.role === 'hero'
      ? {
        ...surface,
        source: heroMediaSource,
        description: heroAssetMode === 'stock'
          ? surface.description
          : `Generated, licensed, or user-provided Maidy hero ${heroAssetMode}.`,
      }
      : surface.role === 'secondary' && equipmentCutoutSource !== ''
        ? {
          ...surface,
          source: equipmentCutoutSource,
          description: 'Generated, licensed, or user-provided Maidy equipment cutout.',
        }
        : surface
  ));
  const bodyClasses = [
    ...(heroAssetMode === 'stock' ? [] : [`maidy-hero-${heroAssetMode}`]),
    ...(equipmentAssetMode === 'cutout' ? ['maidy-equipment-cutout'] : []),
  ];
  const bodyClassAttribute = bodyClasses.length > 0 ? ` class="${bodyClasses.join(' ')}"` : '';
  const palette = {
    name: 'maidy-bright',
    bg: '#f7f7f4',
    panel: '#ffffff',
    ink: '#060708',
    muted: '#7f817d',
    accent: '#ffdd67',
    accent2: '#315f4f',
    deep: '#203740',
    soft: '#f0eee8',
  };

  const manifest = {
    seed,
    variant,
    archetype: archetype.name,
    palette: palette.name,
    referenceStyle: archetype.referenceStyle,
    heroAssetMode,
    equipmentAssetMode,
    maxWidth,
    columns: 12,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    marketplaceReferences: [
      'Maidy cleaning-service homepage with topbar, split hero, large cleaner image, equipment image, quote card, and dark logo strip.',
      'Use as visual research only; generated copy, imagery, and brand are original replacement material.',
    ],
    imagePolicy: heroAssetMode === 'stock'
      ? 'Uses neutral stock-photo URLs as placeholder visual pressure; never copies Envato/template-demo assets.'
      : 'Uses a generated, licensed, or user-provided hero asset plus neutral replacement photography; never copies Envato/template-demo assets.',
    imageSources: [
      ...primaryMediaSurfaces.map((surface) => surface.source),
      ...continuationSurfaces.map((surface) => surface.source),
    ],
    mediaSurfaces: [
      ...primaryMediaSurfaces,
      ...continuationSurfaces,
    ],
    requiredMediaRoles: marketplaceMediaRoles(),
    notes: [
      'HTML is a visual target only.',
      'This target is marketplace-seeded but original; do not copy third-party assets, copy, or source.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
    ],
  };

  const logos = ['NORTH & CO', 'HARBOR', 'WILLOW', 'VERA', 'KINSHIP'];
  const logoItems = logos.map((logo) => `<span>${escapeHtml(logo)}</span>`).join('');
  const serviceCards = archetype.cards.map((card, index) => `
      <article class="mini-card">
        <img src="${escapeHtml(archetype.cardImages[index % archetype.cardImages.length])}" alt="" loading="lazy">
        <span>0${index + 1}</span>
        <h3>${escapeHtml(card)}</h3>
      </article>`).join('');
  const processCards = [
    ['01', 'Book the routine', 'Choose the room plan, arrival window, and care notes.'],
    ['02', 'Prepared arrival', 'A stocked team checks surfaces, fabrics, edges, and high-touch points.'],
    ['03', 'Final reset', 'Rooms are reviewed, aired, and handed back with a short service note.'],
  ].map(([number, title, text], index) => `
      <article class="process-card${index === 1 ? ' featured' : ''}">
        ${index === 1 ? `<img src="${escapeHtml(continuationSurfaces[1].source)}" alt="" loading="lazy">` : ''}
        <span>${escapeHtml(number)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </article>`).join('');
  const packageCards = [
    ['Kitchen reset', 'Grease, counters, appliances, and cabinet fronts.', continuationSurfaces[2].source],
    ['Bathroom polish', 'Tiles, glass, fixtures, grout, and fresh finishing.', archetype.cardImages[0]],
    ['Living areas', 'Floors, dusting, textiles, shelves, and calm details.', continuationSurfaces[3].source],
    ['Move-out detail', 'Deep preparation for handover or first-night comfort.', archetype.cardImages[2]],
  ].map(([title, text, source], index) => `
      <article class="package-card">
        <img src="${escapeHtml(source)}" alt="" loading="lazy">
        <div>
          <span>Plan 0${index + 1}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(text)}</p>
        </div>
      </article>`).join('');
  const storyCards = [
    ['Supply station', 'Every kit arrives stocked with gentle products, fresh cloths, and the right tools for each room.', continuationSurfaces[5].source],
    ['Fresh finish', 'Small finishing touches leave busy rooms feeling lighter, calmer, and ready to enjoy.', continuationSurfaces[6].source],
  ].map(([title, text, source]) => `
      <article class="story-card">
        <img src="${escapeHtml(source)}" alt="" loading="lazy">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </article>`).join('');
  const articleCards = [
    ['Weekly plans', 'Recurring care with clear room-by-room priority.', continuationSurfaces[0].source],
    ['Office upkeep', 'Daylight-friendly commercial cleaning routines.', continuationSurfaces[3].source],
    ['Handover clean', 'Move-out support with a clear room-by-room handover checklist.', continuationSurfaces[6].source],
  ].map(([title, text, source]) => `
      <article class="article-card">
        <img src="${escapeHtml(source)}" alt="" loading="lazy">
        <span>Guide</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </article>`).join('');
  const cleanGalleryCards = [
    ['Supply detail', 'Refillable product and cloth setup before the team starts.', continuationSurfaces[7].source],
    ['Low-waste routine', 'Concentrated refills and washable cloths help each visit leave less behind.', continuationSurfaces[8].source],
    ['Kitchen finish', 'Polished surfaces and a careful final check make every handoff feel effortless.', continuationSurfaces[9].source],
  ].map(([title, text, source]) => `
      <article class="clean-gallery-card">
        <img src="${escapeHtml(source)}" alt="" loading="lazy">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(text)}</p>
        </div>
      </article>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(archetype.brand)} | Thoughtful home care</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --accent-2: ${palette.accent2};
      --deep: ${palette.deep};
      --soft: ${palette.soft};
      --radius: ${radius}px;
      --max: ${maxWidth}px;
      --hero-min: ${heroMinHeight}px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    img { display: block; max-width: 100%; }
    .shell { overflow: hidden; background: var(--bg); }
    .topbar {
      background: var(--deep);
      color: white;
      font-size: 14px;
    }
    .topbar-inner {
      width: min(var(--max), calc(100vw - 40px));
      min-height: 48px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
    }
    .topbar span { display: inline-flex; align-items: center; gap: 9px; }
    .topbar b { color: var(--accent); }
    .nav {
      position: relative;
      z-index: 2;
      width: min(var(--max), calc(100vw - 40px));
      min-height: 104px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 26px;
      font-weight: 850;
    }
    .mark {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background:
        radial-gradient(circle at 70% 28%, var(--accent) 0 12%, transparent 13%),
        linear-gradient(145deg, var(--accent-2), var(--deep));
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 38px;
      color: color-mix(in srgb, var(--ink), transparent 42%);
      font-weight: 760;
    }
    .nav-cta {
      min-width: 136px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      padding: 16px 24px;
      background: var(--accent);
      color: var(--ink);
      text-decoration: none;
      font-weight: 850;
    }
    .hero {
      position: relative;
      min-height: var(--hero-min);
    }
    .hero::after {
      content: "";
      position: absolute;
      z-index: 0;
      top: -104px;
      right: 0;
      width: 31vw;
      height: calc(100% + 104px);
      background: var(--accent-2);
      clip-path: polygon(14% 0, 100% 0, 100% 100%, 0 100%);
    }
    .hero-inner {
      position: relative;
      z-index: 1;
      width: min(var(--max), calc(100vw - 40px));
      min-height: var(--hero-min);
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
      align-items: center;
      gap: 34px;
    }
    .copy { padding-bottom: 58px; }
    .eyebrow {
      display: inline-flex;
      margin-bottom: 34px;
      color: #bebfbd;
      font-size: 18px;
      font-weight: 850;
      letter-spacing: .36em;
      text-transform: uppercase;
    }
    h1 {
      max-width: 610px;
      margin: 0;
      font-size: clamp(50px, 5vw, 68px);
      line-height: 1.22;
      font-weight: 900;
      letter-spacing: 0;
    }
    h1 strong {
      display: block;
      margin-top: 12px;
      color: var(--accent-2);
      font: inherit;
    }
    .lead {
      max-width: 560px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.75;
    }
    .actions {
      margin-top: 38px;
      display: flex;
      align-items: center;
      gap: 30px;
      flex-wrap: wrap;
    }
    .primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 158px;
      min-height: 54px;
      padding: 15px 26px;
      background: var(--accent-2);
      color: white;
      text-decoration: none;
      font-weight: 850;
    }
    .play {
      width: 58px;
      height: 58px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 13px color-mix(in srgb, var(--accent), transparent 72%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-2);
      font-size: 20px;
      font-weight: 900;
    }
    .secondary {
      display: inline-flex;
      align-items: center;
      gap: 16px;
      color: var(--accent-2);
      text-decoration: none;
      font-weight: 850;
    }
    .visual {
      position: relative;
      min-height: 620px;
      align-self: stretch;
    }
    .sun {
      position: absolute;
      top: 150px;
      left: 70px;
      width: 264px;
      height: 264px;
      border-radius: 999px;
      background: var(--accent);
      opacity: .9;
    }
    .person {
      position: absolute;
      z-index: 2;
      right: 20px;
      bottom: 0;
      width: min(520px, 82%);
      height: 610px;
      object-fit: ${heroAssetMode === 'cutout' ? 'contain' : 'cover'};
      object-position: center;
      border-radius: ${heroAssetMode === 'cutout' ? '0' : 'calc(var(--radius) + 8px) calc(var(--radius) + 8px) 0 0'};
      box-shadow: ${heroAssetMode === 'cutout' ? 'none' : '0 30px 80px rgba(31, 55, 64, .18)'};
    }
    .equipment {
      position: absolute;
      left: -96px;
      bottom: 20px;
      width: 260px;
      height: 170px;
      object-fit: ${equipmentAssetMode === 'cutout' ? 'contain' : 'cover'};
      object-position: center;
      border-radius: ${equipmentAssetMode === 'cutout' ? '0' : 'calc(var(--radius) + 2px)'};
      box-shadow: ${equipmentAssetMode === 'cutout' ? 'none' : '0 24px 50px rgba(31, 55, 64, .14)'};
    }
    .quote-card {
      position: absolute;
      z-index: 3;
      left: 44px;
      bottom: 58px;
      width: 288px;
      min-height: 172px;
      padding: 28px 30px;
      background: var(--panel);
      box-shadow: 0 26px 70px rgba(31, 55, 64, .11);
    }
    .quote-card strong {
      display: block;
      color: var(--accent);
      font-size: 42px;
      line-height: 1;
      font-weight: 300;
    }
    .quote-card span {
      display: block;
      margin-top: 14px;
      color: var(--accent-2);
      font-size: 16px;
      line-height: 1.65;
    }
    .logos {
      background: var(--deep);
    }
    .logos-inner {
      width: min(var(--max), calc(100vw - 40px));
      min-height: 196px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 44px;
      color: rgba(255,255,255,.38);
      font-size: clamp(34px, 4vw, 58px);
      font-weight: 850;
      letter-spacing: .18em;
    }
    .cards {
      width: min(var(--max), calc(100vw - 40px));
      margin: 74px auto 58px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }
    .mini-card {
      padding: 18px;
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--deep), transparent 88%);
      border-radius: var(--radius);
    }
    .mini-card img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: calc(var(--radius) - 6px);
    }
    .mini-card span {
      display: block;
      margin-top: 20px;
      color: var(--accent-2);
      font-weight: 900;
    }
    .mini-card h3 {
      margin: 14px 0 0;
      font-size: 28px;
      line-height: 1.1;
    }
    .process-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: 112px auto 0;
      display: grid;
      grid-template-columns: .9fr 1.1fr;
      gap: 68px;
      align-items: start;
    }
    .section-kicker {
      display: inline-flex;
      color: var(--accent-2);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: .28em;
      text-transform: uppercase;
    }
    .section-title {
      margin: 22px 0 0;
      font-size: clamp(44px, 4.6vw, 62px);
      line-height: 1.02;
      letter-spacing: -.045em;
    }
    .section-copy {
      max-width: 540px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.75;
    }
    .process-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    .process-card {
      min-height: 250px;
      padding: 32px;
      background: var(--panel);
      border-radius: var(--radius);
      box-shadow: 0 22px 70px rgba(31, 55, 64, .07);
    }
    .process-card.featured {
      grid-row: span 2;
      background: var(--accent-2);
      color: white;
      overflow: hidden;
    }
    .process-card img {
      width: calc(100% + 64px);
      height: 240px;
      margin: -32px -32px 28px;
      object-fit: cover;
    }
    .process-card span,
    .package-card span {
      display: block;
      color: var(--accent);
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .process-card h3 {
      margin: 18px 0 0;
      font-size: 28px;
      line-height: 1.12;
    }
    .process-card p {
      margin: 14px 0 0;
      color: color-mix(in srgb, currentColor, transparent 28%);
      line-height: 1.65;
    }
    .media-band {
      margin: 124px 0 0;
      min-height: 640px;
      display: grid;
      align-items: end;
      background:
        linear-gradient(90deg, rgba(32, 55, 64, .86), rgba(32, 55, 64, .35)),
        url("${escapeHtml(continuationSurfaces[0].source)}");
      background-size: cover;
      background-position: center;
    }
    .media-band-inner {
      width: min(var(--max), calc(100vw - 40px));
      margin: 0 auto;
      padding: 0 0 74px;
      display: grid;
      grid-template-columns: minmax(0, .78fr) minmax(300px, .42fr);
      gap: 64px;
      align-items: end;
      color: white;
    }
    .media-band h2 {
      max-width: 720px;
      margin: 0;
      font-size: clamp(48px, 5.2vw, 74px);
      line-height: 1.02;
      letter-spacing: -.05em;
    }
    .media-proof {
      padding: 34px;
      background: rgba(255, 255, 255, .94);
      color: var(--ink);
      border-radius: var(--radius);
      box-shadow: 0 28px 70px rgba(0, 0, 0, .18);
    }
    .media-proof strong {
      display: block;
      color: var(--accent-2);
      font-size: 54px;
      line-height: 1;
    }
    .media-proof span {
      display: block;
      margin-top: 16px;
      color: var(--muted);
      line-height: 1.65;
    }
    .package-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: 118px auto 0;
    }
    .package-heading {
      display: flex;
      justify-content: space-between;
      gap: 48px;
      align-items: end;
    }
    .package-heading .section-copy {
      margin-bottom: 8px;
    }
    .package-grid {
      margin-top: 42px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 20px;
    }
    .package-card {
      min-height: 440px;
      display: flex;
      flex-direction: column;
      background: var(--panel);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 22px 70px rgba(31, 55, 64, .07);
    }
    .package-card img {
      width: 100%;
      height: 210px;
      object-fit: cover;
    }
    .package-card div {
      padding: 28px;
    }
    .package-card h3 {
      margin: 14px 0 0;
      font-size: 28px;
      line-height: 1.1;
    }
    .package-card p {
      margin: 14px 0 0;
      color: var(--muted);
      line-height: 1.58;
    }
    .review-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: 120px auto 0;
      display: grid;
      grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
      gap: 52px;
      align-items: center;
    }
    .review-photo {
      min-height: 560px;
      border-radius: var(--radius);
      overflow: hidden;
      background: var(--soft);
    }
    .story-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: 124px auto 0;
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr);
      gap: 52px;
      align-items: stretch;
    }
    .story-main {
      min-height: 640px;
      border-radius: var(--radius);
      overflow: hidden;
      background: var(--soft);
    }
    .story-main img {
      width: 100%;
      height: 100%;
      min-height: inherit;
      object-fit: cover;
    }
    .story-panel {
      padding: 54px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--panel);
      border-radius: var(--radius);
      box-shadow: 0 22px 70px rgba(31, 55, 64, .07);
    }
    .story-grid {
      margin-top: 44px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .story-card {
      background: var(--soft);
      border-radius: calc(var(--radius) - 6px);
      overflow: hidden;
    }
    .story-card img {
      width: 100%;
      height: 220px;
      object-fit: cover;
    }
    .story-card h3 {
      margin: 24px 24px 0;
      font-size: 26px;
      line-height: 1.08;
    }
    .story-card p {
      margin: 12px 24px 28px;
      color: var(--muted);
      line-height: 1.58;
    }
    .article-strip {
      width: min(var(--max), calc(100vw - 40px));
      margin: 120px auto 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }
    .article-card {
      min-height: 430px;
      background: var(--panel);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 22px 70px rgba(31, 55, 64, .07);
    }
    .article-card img {
      width: 100%;
      height: 220px;
      object-fit: cover;
    }
    .article-card span {
      display: block;
      margin: 28px 30px 0;
      color: var(--accent-2);
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .article-card h3 {
      margin: 14px 30px 0;
      font-size: 30px;
      line-height: 1.08;
    }
    .article-card p {
      margin: 14px 30px 30px;
      color: var(--muted);
      line-height: 1.62;
    }
    .clean-gallery {
      width: min(var(--max), calc(100vw - 40px));
      margin: 112px auto 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }
    .clean-gallery-card {
      min-height: 390px;
      background: var(--panel);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 22px 70px rgba(31, 55, 64, .07);
    }
    .clean-gallery-card img {
      width: 100%;
      height: 240px;
      object-fit: cover;
    }
    .clean-gallery-card div {
      padding: 26px 28px 30px;
    }
    .clean-gallery-card h3 {
      margin: 0;
      font-size: 28px;
      line-height: 1.08;
    }
    .clean-gallery-card p {
      margin: 12px 0 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .review-photo img {
      width: 100%;
      height: 100%;
      min-height: inherit;
      object-fit: cover;
    }
    .review-card {
      padding: 60px;
      background: var(--deep);
      color: white;
      border-radius: var(--radius);
    }
    .review-card strong {
      display: block;
      color: var(--accent);
      font-size: 64px;
      line-height: 1;
    }
    .review-card blockquote {
      margin: 28px 0 0;
      font-size: clamp(30px, 3.2vw, 46px);
      line-height: 1.16;
      letter-spacing: -.035em;
    }
    .review-card p {
      margin: 26px 0 0;
      color: rgba(255,255,255,.68);
      font-size: 18px;
      line-height: 1.7;
    }
    .final-cta {
      width: min(var(--max), calc(100vw - 40px));
      margin: 118px auto 96px;
      padding: 72px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 42px;
      align-items: center;
      background: var(--accent);
      color: var(--ink);
      border-radius: var(--radius);
    }
    .final-cta h2 {
      margin: 0;
      font-size: clamp(42px, 4.4vw, 64px);
      line-height: 1.02;
      letter-spacing: -.045em;
    }
    .final-cta p {
      max-width: 620px;
      margin: 18px 0 0;
      color: color-mix(in srgb, var(--ink), transparent 28%);
      font-size: 18px;
      line-height: 1.65;
    }
    .final-cta a {
      min-width: 184px;
      min-height: 58px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 16px 28px;
      background: var(--deep);
      color: white;
      text-decoration: none;
      font-weight: 900;
    }
    @media (max-width: 900px) {
      .topbar { display: none; }
      .nav { min-height: 80px; }
      .nav-links { display: none; }
      .hero::after { display: none; }
      .hero-inner {
        grid-template-columns: 1fr;
        min-height: auto;
      }
      .copy {
        padding: 72px 0 0;
      }
      .visual {
        min-height: 300px;
      }
      .sun, .person, .quote-card { display: none; }
      .equipment {
        position: static;
        width: 100%;
        height: 270px;
        margin-top: 34px;
      }
      .logos-inner {
        min-height: 150px;
        flex-wrap: wrap;
        justify-content: center;
        font-size: 34px;
      }
      .cards,
      .process-section,
      .media-band-inner,
      .package-heading,
      .story-section,
      .review-section,
      .final-cta {
        grid-template-columns: 1fr;
      }
      .process-grid,
      .package-grid,
      .story-grid,
      .article-strip,
      .clean-gallery {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .media-band {
        min-height: 520px;
      }
      .media-band-inner {
        padding: 72px 0;
      }
      .review-photo {
        min-height: 420px;
      }
      .story-main {
        min-height: 420px;
      }
    }
    @media (max-width: 560px) {
      .nav-cta {
        min-width: 44px;
        width: 44px;
        height: 44px;
        padding: 0;
        font-size: 0;
      }
      .nav-cta::after {
        content: "↗";
        font-size: 20px;
      }
      .brand { font-size: 22px; }
      .eyebrow {
        margin-bottom: 28px;
        font-size: 14px;
        letter-spacing: .34em;
      }
      h1 {
        font-size: 45px;
        line-height: 1.35;
      }
      .lead {
        font-size: 16px;
      }
      .actions {
        gap: 24px;
      }
      .primary {
        min-width: 158px;
      }
      .secondary span:last-child {
        display: none;
      }
      .visual {
        min-height: 260px;
      }
      .equipment {
        height: 220px;
        margin-left: -48px;
        width: calc(100% + 78px);
      }
      .logos { display: none; }
      .cards { margin-top: 46px; }
      .section-title,
      .media-band h2,
      .review-card blockquote,
      .final-cta h2 {
        font-size: 40px;
      }
      .process-grid,
      .package-grid {
        grid-template-columns: 1fr;
      }
      .process-section,
      .package-section,
      .story-section,
      .article-strip,
      .clean-gallery,
      .review-section,
      .final-cta {
        margin-top: 76px;
      }
      .media-band {
        margin-top: 82px;
      }
      .process-card,
      .story-panel,
      .review-card,
      .final-cta {
        padding: 32px;
      }
      .story-grid,
      .article-strip,
      .clean-gallery {
        grid-template-columns: 1fr;
      }
      .package-card {
        min-height: 0;
      }
      .story-main {
        min-height: 300px;
      }
      .review-photo {
        min-height: 300px;
      }
    }
    ${heroAssetMode === 'cutout' ? `
    body.maidy-hero-cutout .visual {
      min-height: calc(var(--hero-min) - 40px);
      overflow: visible;
      background: var(--accent-2);
    }
    body.maidy-hero-cutout .person {
      display: block;
      right: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center bottom;
    }
    body.maidy-hero-cutout .equipment {
      z-index: 4;
      left: calc(-100% - 96px);
    }
    @media (max-width: 900px) and (min-width: 561px) {
      body.maidy-hero-cutout .topbar { display: block; }
      body.maidy-hero-cutout .hero-inner {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        min-height: 684px;
        gap: 0;
      }
      body.maidy-hero-cutout .copy { padding: 54px 0; }
      body.maidy-hero-cutout .visual { min-height: 684px; }
      body.maidy-hero-cutout .sun,
      body.maidy-hero-cutout .person,
      body.maidy-hero-cutout .quote-card { display: block; }
      body.maidy-hero-cutout .equipment {
        position: absolute;
        left: calc(-100% - 30px);
        bottom: 0;
        width: 180px;
        height: 144px;
        margin: 0;
      }
    }
    @media (max-width: 560px) {
      body.maidy-hero-cutout .hero-inner { grid-template-columns: 1fr; }
      body.maidy-hero-cutout .copy { padding: 72px 0 150px; }
      body.maidy-hero-cutout .visual {
        min-height: 508px;
        margin-top: 0;
      }
      body.maidy-hero-cutout .person {
        right: 17px;
        bottom: 0;
        width: 315px;
        height: 468px;
      }
      body.maidy-hero-cutout .equipment {
        position: absolute;
        top: -238px;
        left: -70px;
        bottom: auto;
        width: 294px;
        height: 237px;
        margin: 0;
      }
      body.maidy-hero-cutout .quote-card {
        display: block;
        left: 0;
        bottom: 20px;
      }
    }
    ` : ''}
  </style>
</head>
<body${bodyClassAttribute}>
  <main class="shell">
    <div class="topbar">
      <div class="topbar-inner">
        <span><b>☎</b> Plan a care visit</span>
        <span><b>✉</b> Ask about recurring care</span>
        <span>Monday-Saturday / 8:00-18:00</span>
      </div>
    </div>
    <nav class="nav">
      <div class="brand"><span class="mark"></span><span>${escapeHtml(archetype.brand)}</span></div>
      <div class="nav-links"><span>Home</span><span>About</span><span>Services</span><span>Reviews</span><span>Contact</span></div>
      <a class="nav-cta" href="#">Contact</a>
    </nav>
    <section class="hero">
      <div class="hero-inner">
        <div class="copy">
          <span class="eyebrow">${escapeHtml(archetype.eyebrow)}</span>
          <h1>${escapeHtml(archetype.titleLead)}<strong>${escapeHtml(archetype.titleAccent)}</strong></h1>
          <p class="lead">${escapeHtml(archetype.body)}</p>
          <div class="actions">
            <a class="primary" href="#">${escapeHtml(archetype.cta)} →</a>
            <a class="secondary" href="#"><span class="play">▶</span><span>${escapeHtml(archetype.secondaryCta)}</span></a>
          </div>
        </div>
        <div class="visual">
          <div class="sun" aria-hidden="true"></div>
          <img class="person" src="${escapeHtml(heroMediaSource)}" alt="" loading="eager">
          <img class="equipment" src="${escapeHtml(equipmentMediaSource)}" alt="" loading="eager">
          <div class="quote-card">
            <strong>99</strong>
            <span>Fresh rooms, steady routines, and a team that arrives prepared.</span>
          </div>
        </div>
      </div>
    </section>
    <section class="logos">
      <div class="logos-inner">${logoItems}</div>
    </section>
    <section class="cards">${serviceCards}
    </section>
    <section class="process-section">
      <div>
        <span class="section-kicker">How the visit works</span>
        <h2 class="section-title">A calm routine before the doorbell rings.</h2>
        <p class="section-copy">Every visit is easy to follow, from thoughtful booking and a prepared arrival to careful room checks and a tidy handoff.</p>
      </div>
      <div class="process-grid">${processCards}
      </div>
    </section>
    <section class="media-band">
      <div class="media-band-inner">
        <h2>Clean surfaces, open rooms, and a team you know by name.</h2>
        <div class="media-proof">
          <strong>12+</strong>
          <span>Prepared teams cover recurring home care, office upkeep, and move-out resets with consistent checks at every visit.</span>
        </div>
      </div>
    </section>
    <section class="package-section">
      <div class="package-heading">
        <div>
          <span class="section-kicker">Service packages</span>
          <h2 class="section-title">Room-by-room care, planned around the way you live.</h2>
        </div>
        <p class="section-copy">Choose a focused reset or combine rooms into a plan tailored to your week, priorities, and pace.</p>
      </div>
      <div class="package-grid">${packageCards}
      </div>
    </section>
    <section class="review-section">
      <div class="review-photo">
        <img src="${escapeHtml(continuationSurfaces[4].source)}" alt="" loading="lazy">
      </div>
      <article class="review-card">
        <strong>99</strong>
        <blockquote>They made the whole place feel reset without making the booking feel complicated.</blockquote>
        <p>From the first message to the final walk-through, the team was thoughtful, punctual, and precise in every room.</p>
      </article>
    </section>
    <section class="story-section">
      <div class="story-main">
        <img src="${escapeHtml(continuationSurfaces[5].source)}" alt="" loading="lazy">
      </div>
      <div class="story-panel">
        <div>
          <span class="section-kicker">Behind the clean</span>
          <h2 class="section-title">Prepared with care, finished with a lighter touch.</h2>
          <p class="section-copy">We choose practical products, keep equipment ready, and finish each visit with details that make the whole home feel settled.</p>
        </div>
        <div class="story-grid">${storyCards}
        </div>
      </div>
    </section>
    <section class="article-strip">${articleCards}
    </section>
    <section class="clean-gallery">${cleanGalleryCards}
    </section>
    <section class="final-cta">
      <div>
        <h2>Ready for a brighter weekly reset?</h2>
        <p>Tell us which rooms need attention and we will shape a recurring plan around your home, schedule, and priorities.</p>
      </div>
      <a href="#">Schedule cleaning</a>
    </section>
  </main>
</body>
</html>
`;

  return { html, manifest };
}

function buildEyeCareReferenceTarget(seed, random, variant, archetype) {
  const isLumenStyle = archetype.referenceStyle === 'lumen-eye-care-editorial';
  const continuationSurfaces = eyeCareContinuationMediaSurfaces(isLumenStyle);
  const doctorCutoutSource = isLumenStyle
    ? configuredImageSource('MONTEBY_LUMEN_DOCTOR_CUTOUT_URL', /\.(?:png|webp)$/i)
    : '';
  const heroAssetMode = doctorCutoutSource !== '' ? 'cutout' : 'stock';
  const heroMediaSource = doctorCutoutSource || archetype.heroImage;
  const primaryMediaSurfaces = marketplaceMediaSurfaces(archetype).map((surface) => (
    surface.role === 'hero' && doctorCutoutSource !== ''
      ? {
        ...surface,
        source: doctorCutoutSource,
        description: 'Generated, licensed, or user-provided Lumen doctor cutout.',
      }
      : surface
  ));
  const palette = isLumenStyle
    ? {
      name: 'lumen-soft-green',
      bg: '#eefbe3',
      panel: '#ffffff',
      ink: '#061a27',
      muted: '#526271',
      accent: '#2fd678',
      accent2: '#0f7768',
      wash: '#f8ffdc',
    }
    : {
      name: 'optomatta-blue-white',
      bg: '#ffffff',
      panel: '#f4f6f9',
      ink: '#090d13',
      muted: '#5f6670',
      accent: '#0788d8',
      accent2: '#0a6fa7',
      wash: '#eef7ff',
    };
  const maxWidth = isLumenStyle ? 1400 : pick([1180, 1240, 1300], random);
  const heroMinHeight = isLumenStyle ? between(random, 910, 980) : between(random, 650, 740);
  const cards = archetype.cards.map((card, index) => `
      <article class="service-card">
        <img src="${escapeHtml(archetype.cardImages[index % archetype.cardImages.length])}" alt="" loading="lazy">
        <span>0${index + 1}</span>
        <h3>${escapeHtml(card)}</h3>
        <p>${escapeHtml(cardCopy(index))}</p>
      </article>`).join('');
  const statsSource = isLumenStyle ? archetype.stats.slice(0, 2) : archetype.stats;
  const stats = statsSource.map((stat) => {
    const [value, ...label] = stat.split(' ');
    return `
        <div class="stat">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label.join(' '))}</span>
        </div>`;
  }).join('');
  const continuationCards = [
    isLumenStyle ? 'Detailed diagnosis' : 'Complete eye exams',
    isLumenStyle ? 'Treatment planning' : 'Optical services',
    isLumenStyle ? 'Specialist follow-up' : 'Lens consultation',
  ].map((title, index) => `
      <article class="deep-card">
        <img src="${escapeHtml(continuationSurfaces[index + 1].source)}" alt="" loading="lazy">
        <span>0${index + 1}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(cardCopy(index))}</p>
      </article>`).join('');
  const productCards = [
    isLumenStyle ? 'Pediatric care' : 'Noir Arc',
    isLumenStyle ? 'Retina consult' : 'Crystal Vale',
    isLumenStyle ? 'Digital screening' : 'Silver Row',
    isLumenStyle ? 'Urgent support' : 'Golden Finch',
    isLumenStyle ? 'Lens therapy' : 'Coral Line',
    isLumenStyle ? 'Vision coaching' : 'Midnight Key',
  ].map((title, index) => `
      <article class="product-card">
        <img src="${escapeHtml(continuationSurfaces[index % continuationSurfaces.length].source)}" alt="" loading="lazy">
        <span>${isLumenStyle ? 'Care path' : 'Frame collection'}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(isLumenStyle
    ? 'Gentle guidance, clear next steps, and care shaped around everyday comfort.'
    : 'A considered frame, precise lens options, and fitting support from first try to final adjustment.')}</p>
      </article>`).join('');
  const galleryCards = [
    isLumenStyle ? 'Exam room' : 'Frame wall',
    isLumenStyle ? 'Doctor consult' : 'Lens lab',
    isLumenStyle ? 'Patient guidance' : 'Fitting desk',
    isLumenStyle ? 'Treatment notes' : 'Retail close-up',
  ].map((title, index) => `
      <article class="gallery-card">
        <img src="${escapeHtml(continuationSurfaces[(index + 12) % continuationSurfaces.length].source)}" alt="" loading="lazy">
        <span>${escapeHtml(title)}</span>
      </article>`).join('');
  const specialistCards = [
    isLumenStyle ? 'Retina screening' : 'Frame selection',
    isLumenStyle ? 'Lens therapy' : 'Lens fitting',
    isLumenStyle ? 'Family optometry' : 'Style consultation',
  ].map((title, index) => `
      <article class="specialist-card">
        <img src="${escapeHtml(continuationSurfaces[(index + 6) % continuationSurfaces.length].source)}" alt="" loading="lazy">
        <span>${isLumenStyle ? 'Specialist care' : 'Personal fitting'}</span>
        <h3>${escapeHtml(title)}</h3>
      </article>`).join('');
  const certificationCards = [
    isLumenStyle ? 'Modern diagnostic rooms' : 'Certified retail partners',
    isLumenStyle ? 'Clear treatment notes' : 'Premium lens suppliers',
    isLumenStyle ? 'Specialist follow-up' : 'Appointment support',
  ].map((title, index) => `
      <div class="cert-card">
        <strong>0${index + 1}</strong>
        <span>${escapeHtml(title)}</span>
      </div>`).join('');

  const manifest = {
    seed,
    variant,
    archetype: archetype.name,
    palette: palette.name,
    referenceStyle: archetype.referenceStyle,
    ...(isLumenStyle ? { heroAssetMode } : {}),
    maxWidth,
    columns: 12,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    marketplaceReferences: isLumenStyle
      ? [
        'Lumen eye-care homepage with soft green editorial hero, huge headline, doctor visual, stats, mini media card, and proof card.',
        'Use as visual research only; generated copy, imagery, and brand are original replacement material.',
      ]
      : [
        'Optomatta optical retail homepage with white nav, split hero image, shop/appointment CTAs, and three proof/service tiles.',
        'Use as visual research only; generated copy, imagery, and brand are original replacement material.',
      ],
    imagePolicy: doctorCutoutSource === ''
      ? 'Uses neutral stock-photo URLs as placeholder visual pressure; never copies Envato/template-demo assets.'
      : 'Uses a generated, licensed, or user-provided doctor cutout plus neutral replacement photography; never copies Envato/template-demo assets.',
    imageSources: [
      ...primaryMediaSurfaces.map((surface) => surface.source),
      ...continuationSurfaces.map((surface) => surface.source),
    ],
    mediaSurfaces: [
      ...primaryMediaSurfaces,
      ...continuationSurfaces,
    ],
    requiredMediaRoles: marketplaceMediaRoles(),
    notes: [
      'HTML is a visual target only.',
      'This target is marketplace-seeded but original; do not copy third-party assets, copy, or source.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
    ],
  };

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(archetype.brand)} | ${escapeHtml(archetype.eyebrow)}</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --accent-2: ${palette.accent2};
      --wash: ${palette.wash};
      --max: ${maxWidth}px;
      --hero-min: ${heroMinHeight}px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    img { display: block; max-width: 100%; }
	    .shell {
	      min-height: 100vh;
	      overflow: hidden;
	      background: ${isLumenStyle
        ? `linear-gradient(90deg, rgba(238,251,227,.92), rgba(248,255,220,.76)), radial-gradient(circle at 70% 20%, #faffc8 0, transparent 28%), radial-gradient(circle at 34% 45%, #d7f7e3 0, transparent 34%), url("${escapeHtml(continuationSurfaces[5].source)}"), var(--bg)`
        : 'var(--bg)'};
	      background-size: ${isLumenStyle ? 'cover, auto, auto, cover, auto' : 'auto'};
	      background-position: ${isLumenStyle ? 'center top, center, center, center top, center' : 'center'};
	    }
    .nav {
      width: min(var(--max), calc(100vw - 24px));
      min-height: ${isLumenStyle ? '118px' : '108px'};
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 26px;
      background: ${isLumenStyle ? 'transparent' : 'white'};
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: ${isLumenStyle ? '42px' : '32px'};
      font-weight: ${isLumenStyle ? '400' : '900'};
      letter-spacing: ${isLumenStyle ? '-0.04em' : '-0.03em'};
      text-transform: uppercase;
    }
    .mark {
      width: ${isLumenStyle ? '50px' : '42px'};
      height: ${isLumenStyle ? '50px' : '28px'};
      border-radius: 999px;
      background:
        linear-gradient(90deg, transparent 34%, white 35% 65%, transparent 66%),
        ${isLumenStyle ? 'var(--accent)' : 'var(--accent-2)'};
      box-shadow: inset 0 -10px 0 color-mix(in srgb, var(--accent), transparent 38%);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: ${isLumenStyle ? '30px' : '46px'};
      font-size: ${isLumenStyle ? '15px' : '16px'};
      font-weight: 780;
      text-transform: ${isLumenStyle ? 'uppercase' : 'none'};
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 22px;
    }
    .nav-cta {
      min-width: ${isLumenStyle ? '180px' : '214px'};
      min-height: ${isLumenStyle ? '50px' : '72px'};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 24px;
      border-radius: ${isLumenStyle ? '999px' : '0'};
      background: var(--accent);
      color: ${isLumenStyle ? 'var(--ink)' : 'white'};
      text-decoration: none;
      font-weight: 700;
      ${isLumenStyle ? '' : 'letter-spacing: .14em;'}
    }
	    .hero {
	      width: ${isLumenStyle ? 'min(var(--max), 100vw)' : '100vw'};
	      min-height: var(--hero-min);
	      margin: 0 auto;
	      position: relative;
	      ${isLumenStyle
        ? 'display: grid; grid-template-columns: 1fr; align-items: start; padding: 118px 0 0;'
        : `display: block; background: linear-gradient(90deg, rgba(255,255,255,.98) 0 34%, rgba(255,255,255,.86) 44%, rgba(255,255,255,.24) 58%, rgba(255,255,255,0) 72%), url("${escapeHtml(heroMediaSource)}"); background-size: cover; background-position: center right;`}
	    }
	    .copy {
	      position: relative;
	      z-index: 2;
	      ${isLumenStyle ? 'width: 100%; padding: 0 80px;' : 'width: min(var(--max), calc(100vw - 40px)); margin: 0 auto; padding: 170px 0 88px;'}
    }
	    .eyebrow {
	      display: inline-flex;
	      margin-bottom: ${isLumenStyle ? '20px' : '22px'};
      color: ${isLumenStyle ? 'var(--ink)' : '#e96778'};
      font-size: ${isLumenStyle ? '15px' : '13px'};
      font-weight: 800;
	      letter-spacing: ${isLumenStyle ? '0' : '.34em'};
	      text-transform: uppercase;
	    }
	    .lumen-editorial .hero .copy > .eyebrow {
	      position: absolute;
	      left: 80px;
	      top: 12px;
	      margin: 0;
	    }
	    h1 {
	      max-width: ${isLumenStyle ? '860px' : '640px'};
	      margin: ${isLumenStyle ? '0 0 0 255px' : '0'};
	      color: ${isLumenStyle ? 'color-mix(in srgb, var(--ink), var(--accent-2) 38%)' : 'var(--ink)'};
	      font-size: ${isLumenStyle ? 'clamp(82px, 8.8vw, 124px)' : 'clamp(52px, 5.2vw, 76px)'};
      line-height: ${isLumenStyle ? '.99' : '.96'};
	      font-weight: ${isLumenStyle ? '500' : '900'};
	      letter-spacing: ${isLumenStyle ? '-0.06em' : '-0.04em'};
	    }
	    h1 span {
	      display: block;
	    }
	    .lumen-editorial h1 span + span {
	      margin-left: 176px;
	    }
    .lead {
      max-width: ${isLumenStyle ? '470px' : '580px'};
      margin: ${isLumenStyle ? '34px 0 0 44%' : '22px 0 0'};
      color: ${isLumenStyle ? 'var(--ink)' : 'var(--muted)'};
      font-size: ${isLumenStyle ? '18px' : '20px'};
      line-height: 1.55;
      font-weight: ${isLumenStyle ? '680' : '400'};
    }
    .actions {
      margin: ${isLumenStyle ? '24px 0 0 44%' : '34px 0 0'};
      display: flex;
      align-items: center;
      gap: ${isLumenStyle ? '12px' : '10px'};
      flex-wrap: wrap;
    }
    .actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: ${isLumenStyle ? '50px' : '46px'};
      min-width: ${isLumenStyle ? '126px' : '160px'};
      padding: 13px 24px;
      border-radius: ${isLumenStyle ? '999px' : '0'};
      background: var(--accent);
      color: ${isLumenStyle ? 'var(--ink)' : 'white'};
      text-decoration: none;
      font-size: ${isLumenStyle ? '15px' : '14px'};
      font-weight: ${isLumenStyle ? '500' : '800'};
      letter-spacing: ${isLumenStyle ? '0' : '.16em'};
      text-transform: ${isLumenStyle ? 'none' : 'uppercase'};
    }
    .actions a:last-child {
      background: ${isLumenStyle ? 'var(--ink)' : 'white'};
      color: ${isLumenStyle ? 'white' : 'var(--ink)'};
      box-shadow: ${isLumenStyle ? 'none' : '0 12px 30px rgba(9,13,19,.04)'};
    }
	    .hero-photo {
	      ${isLumenStyle
        ? `position: absolute; z-index: 1; left: 190px; top: 244px; width: 440px; height: 530px; object-fit: ${heroAssetMode === 'cutout' ? 'contain' : 'cover'}; object-position: top center; border-radius: 0; filter: saturate(1.04) contrast(1.02); ${heroAssetMode === 'cutout' ? 'mix-blend-mode: normal; -webkit-mask-image: none; mask-image: none;' : 'mix-blend-mode: multiply; -webkit-mask-image: radial-gradient(ellipse 54% 78% at 52% 50%, #000 0 68%, rgba(0,0,0,.82) 80%, transparent 100%); mask-image: radial-gradient(ellipse 54% 78% at 52% 50%, #000 0 68%, rgba(0,0,0,.82) 80%, transparent 100%);'}`
        : 'display: none;'}
    }
    .photo-panel {
      ${isLumenStyle
        ? 'display: contents;'
        : 'position: absolute; inset: 0; overflow: hidden; pointer-events: none;'}
    }
    .photo-panel::before {
      ${isLumenStyle
        ? 'content: none;'
        : 'content: none;'}
    }
    .mini-photo {
      position: absolute;
      z-index: 3;
      width: ${isLumenStyle ? '236px' : '310px'};
      height: ${isLumenStyle ? '158px' : '220px'};
      object-fit: cover;
	      border-radius: ${isLumenStyle ? '12px' : '0'};
	      box-shadow: 0 24px 60px rgba(6, 26, 39, .12);
	      ${isLumenStyle ? 'left: 44%; top: 582px;' : 'right: calc((100vw - min(var(--max), calc(100vw - 40px))) / 2 + 64px); bottom: 56px;'}
	    }
    .proof-card {
      position: absolute;
      z-index: 4;
      right: ${isLumenStyle ? '70px' : '80px'};
	      bottom: ${isLumenStyle ? 'auto' : '-72px'};
	      top: ${isLumenStyle ? '646px' : 'auto'};
      width: ${isLumenStyle ? '424px' : '410px'};
      min-height: ${isLumenStyle ? '304px' : '170px'};
      padding: ${isLumenStyle ? '58px 64px' : '34px 36px'};
      background: white;
      border-radius: ${isLumenStyle ? '8px 8px 0 0' : '0'};
      box-shadow: ${isLumenStyle ? 'none' : '0 26px 70px rgba(9,13,19,.09)'};
      ${isLumenStyle ? '' : 'display: none;'}
    }
    .proof-card span {
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: ${isLumenStyle ? '0' : '.12em'};
      text-transform: uppercase;
    }
    .proof-card h2 {
      margin: 16px 0 0;
      font-size: ${isLumenStyle ? '34px' : '26px'};
      line-height: 1.15;
      letter-spacing: -.03em;
    }
    .proof-card p {
      margin: 18px 0 0;
      color: var(--muted);
      line-height: 1.7;
    }
	    .stats {
	      width: ${isLumenStyle ? 'min(540px, calc(100vw - 40px))' : 'min(var(--max), calc(100vw - 40px))'};
	      margin: ${isLumenStyle ? '-226px 0 0 max(20px, calc((100vw - var(--max)) / 2 + 60px))' : '0 auto'};
	      position: relative;
	      z-index: 5;
	      display: grid;
	      grid-template-columns: ${isLumenStyle ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))'};
      gap: ${isLumenStyle ? '34px' : '0'};
      background: ${isLumenStyle ? 'transparent' : 'var(--panel)'};
      padding: ${isLumenStyle ? '0 0 0 0' : '58px 0'};
    }
    .stat {
      display: grid;
      grid-template-columns: ${isLumenStyle ? '1fr' : '56px 1fr'};
      align-items: start;
      gap: 18px;
      padding: ${isLumenStyle ? '0' : '0 42px'};
    }
    .stat::before {
      content: "✓";
      ${isLumenStyle ? 'display: none;' : 'display: inline-flex; width: 34px; height: 34px; border: 3px solid var(--accent); color: var(--accent); align-items: center; justify-content: center; font-weight: 900;'}
    }
    .stat strong {
      display: block;
      color: ${isLumenStyle ? 'var(--ink)' : '#4b4d50'};
      font-size: ${isLumenStyle ? '62px' : '24px'};
      line-height: 1;
    }
    .stat span {
      display: block;
      margin-top: ${isLumenStyle ? '16px' : '16px'};
      color: ${isLumenStyle ? 'var(--ink)' : '#81858c'};
      font-size: ${isLumenStyle ? '15px' : '16px'};
      line-height: 1.6;
    }
	    .service-strip {
	      width: min(var(--max), calc(100vw - 40px));
	      margin: ${isLumenStyle ? '178px auto 70px' : '150px auto 70px'};
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }
    .service-card {
      padding: 20px;
      background: white;
      border: 1px solid color-mix(in srgb, var(--ink), transparent 90%);
      border-radius: ${isLumenStyle ? '16px' : '0'};
    }
    .service-card img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: ${isLumenStyle ? '12px' : '0'};
    }
    .service-card span {
      display: block;
      margin-top: 20px;
      color: var(--accent-2);
      font-weight: 900;
    }
    .service-card h3 {
      margin: 12px 0 0;
      font-size: 26px;
      line-height: 1.1;
    }
    .service-card p {
      margin: 12px 0 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .split-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: ${isLumenStyle ? '100px auto 0' : '124px auto 0'};
      display: grid;
      grid-template-columns: ${isLumenStyle ? '.92fr 1.08fr' : '1fr 1fr'};
      gap: ${isLumenStyle ? '84px' : '70px'};
      align-items: center;
    }
    .split-copy .eyebrow {
      margin-bottom: 22px;
    }
    .split-copy h2,
    .shop-heading h2,
    .article-heading h2,
    .final-cta h2 {
      margin: 0;
      font-size: ${isLumenStyle ? '64px' : '56px'};
      line-height: 1.02;
      letter-spacing: -.045em;
    }
    .split-copy p,
    .shop-heading p,
    .article-heading p,
    .final-cta p {
      max-width: 560px;
      margin: 22px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.72;
    }
    .split-media {
      position: relative;
      min-height: ${isLumenStyle ? '640px' : '560px'};
      background: var(--panel);
      overflow: hidden;
    }
    .split-media img {
      width: 100%;
      height: 100%;
      min-height: inherit;
      object-fit: cover;
    }
    .split-note {
      position: absolute;
      left: ${isLumenStyle ? '34px' : '42px'};
      bottom: ${isLumenStyle ? '34px' : '42px'};
      width: min(360px, calc(100% - 68px));
      padding: 28px 30px;
      background: white;
      box-shadow: 0 24px 70px rgba(9, 13, 19, .1);
    }
    .split-note strong {
      display: block;
      color: var(--accent-2);
      font-size: 44px;
      line-height: 1;
      letter-spacing: -.04em;
    }
    .split-note span {
      display: block;
      margin-top: 12px;
      color: var(--ink);
      font-weight: 780;
      line-height: 1.4;
    }
    .wide-band {
      margin: ${isLumenStyle ? '120px 0 0' : '130px 0 0'};
      min-height: ${isLumenStyle ? '620px' : '660px'};
      position: relative;
      display: grid;
      align-items: end;
      background:
        linear-gradient(90deg, rgba(9, 13, 19, .82), rgba(9, 13, 19, .24)),
        url("${escapeHtml(continuationSurfaces[3].source)}");
      background-size: cover;
      background-position: center;
      color: white;
    }
    .wide-band-inner {
      width: min(var(--max), calc(100vw - 40px));
      margin: 0 auto;
      padding: 0 0 84px;
      display: grid;
      grid-template-columns: .55fr .45fr;
      gap: 70px;
      align-items: end;
    }
    .wide-band h2 {
      margin: 0;
      max-width: 720px;
      font-size: ${isLumenStyle ? '72px' : '64px'};
      line-height: 1.02;
      letter-spacing: -.05em;
    }
    .wide-band p {
      margin: 0;
      color: rgba(255,255,255,.82);
      font-size: 18px;
      line-height: 1.75;
    }
    .deep-grid {
      width: min(var(--max), calc(100vw - 40px));
      margin: ${isLumenStyle ? '92px auto 0' : '96px auto 0'};
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
    }
    .deep-card {
      background: white;
      border: 1px solid color-mix(in srgb, var(--ink), transparent 90%);
      padding: 24px;
    }
    .deep-card img {
      width: 100%;
      height: 230px;
      object-fit: cover;
    }
    .deep-card span,
    .product-card span,
    .article-card span {
      display: block;
      margin-top: 22px;
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .deep-card h3,
    .product-card h3,
    .article-card h3 {
      margin: 13px 0 0;
      font-size: 26px;
      line-height: 1.12;
      letter-spacing: -.03em;
    }
    .deep-card p,
    .product-card p,
    .article-card p {
      margin: 14px 0 0;
      color: var(--muted);
      line-height: 1.62;
    }
    .shop-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: ${isLumenStyle ? '128px auto 0' : '138px auto 0'};
    }
    .shop-heading,
    .article-heading {
      display: grid;
      grid-template-columns: .58fr .42fr;
      gap: 70px;
      align-items: end;
      margin-bottom: 46px;
    }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 26px;
    }
    .product-card {
      min-height: 470px;
      padding: 20px 20px 28px;
      background: ${isLumenStyle ? 'rgba(255,255,255,.74)' : 'white'};
      border: 1px solid color-mix(in srgb, var(--ink), transparent 90%);
    }
    .product-card img {
      width: 100%;
      height: 260px;
      object-fit: cover;
      background: var(--panel);
    }
    .gallery-section {
      width: min(var(--max), calc(100vw - 40px));
      margin: ${isLumenStyle ? '118px auto 0' : '112px auto 0'};
      display: grid;
      grid-template-columns: .34fr .66fr;
      gap: 42px;
      align-items: end;
    }
    .gallery-kicker {
      min-height: 330px;
      padding: 38px;
      display: grid;
      align-content: end;
      background: var(--panel);
    }
    .gallery-kicker h2 {
      margin: 0;
      font-size: ${isLumenStyle ? '48px' : '42px'};
      line-height: 1.04;
      letter-spacing: -.045em;
    }
    .gallery-kicker p {
      margin: 18px 0 0;
      color: var(--muted);
      line-height: 1.65;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }
    .gallery-card {
      min-height: 310px;
      background: white;
      border: 1px solid color-mix(in srgb, var(--ink), transparent 90%);
    }
    .gallery-card img {
      width: 100%;
      height: 248px;
      object-fit: cover;
    }
    .gallery-card span {
      display: block;
      padding: 16px 18px 18px;
      color: var(--ink);
      font-weight: 820;
    }
    .article-strip {
      width: min(var(--max), calc(100vw - 40px));
      margin: ${isLumenStyle ? '128px auto 0' : '138px auto 0'};
    }
    .article-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 30px;
    }
	    .article-card {
	      min-height: 360px;
	      padding: 34px;
	      display: grid;
	      align-content: end;
	      background: var(--panel);
	    }
	    .article-card img {
	      width: 100%;
	      height: 190px;
	      margin-bottom: 26px;
	      object-fit: cover;
	    }
	    .specialist-section {
	      width: min(var(--max), calc(100vw - 40px));
	      margin: ${isLumenStyle ? '128px auto 0' : '118px auto 0'};
	      display: grid;
	      grid-template-columns: .5fr .5fr;
	      gap: 48px;
	      align-items: stretch;
	    }
	    .specialist-media {
	      min-height: ${isLumenStyle ? '620px' : '520px'};
	      background: white;
	      overflow: hidden;
	    }
	    .specialist-media img {
	      width: 100%;
	      height: 100%;
	      min-height: inherit;
	      object-fit: cover;
	    }
	    .specialist-copy {
	      padding: ${isLumenStyle ? '18px 0 0' : '0'};
	      display: grid;
	      align-content: center;
	    }
	    .specialist-copy h2,
	    .certification-copy h2 {
	      margin: 0;
	      font-size: ${isLumenStyle ? '66px' : '54px'};
	      line-height: 1.02;
	      letter-spacing: -.045em;
	    }
	    .specialist-copy p,
	    .certification-copy p {
	      max-width: 560px;
	      margin: 22px 0 0;
	      color: var(--muted);
	      font-size: 18px;
	      line-height: 1.72;
	    }
	    .specialist-list {
	      margin-top: 42px;
	      display: grid;
	      grid-template-columns: repeat(3, minmax(0, 1fr));
	      gap: 16px;
	    }
	    .specialist-card {
	      min-height: 250px;
	      padding: 14px;
	      background: white;
	      border: 1px solid color-mix(in srgb, var(--ink), transparent 88%);
	    }
	    .specialist-card img {
	      width: 100%;
	      height: 128px;
	      object-fit: cover;
	    }
	    .specialist-card span {
	      display: block;
	      margin-top: 16px;
	      color: var(--accent-2);
	      font-size: 11px;
	      font-weight: 900;
	      letter-spacing: .14em;
	      text-transform: uppercase;
	    }
	    .specialist-card h3 {
	      margin: 10px 0 0;
	      font-size: 20px;
	      line-height: 1.14;
	      letter-spacing: -.03em;
	    }
	    .certification-band {
	      margin: ${isLumenStyle ? '132px 0 0' : '118px 0 0'};
	      padding: ${isLumenStyle ? '110px 0' : '92px 0'};
	      background:
	        linear-gradient(90deg, rgba(6,26,39,.78), rgba(6,26,39,.22)),
	        url("${escapeHtml(continuationSurfaces[9 % continuationSurfaces.length].source)}");
	      background-size: cover;
	      background-position: center;
	      color: white;
	    }
	    .certification-inner {
	      width: min(var(--max), calc(100vw - 40px));
	      margin: 0 auto;
	      display: grid;
	      grid-template-columns: .58fr .42fr;
	      gap: 64px;
	      align-items: end;
	    }
	    .certification-copy p {
	      color: rgba(255,255,255,.78);
	    }
	    .cert-grid {
	      display: grid;
	      gap: 14px;
	    }
	    .cert-card {
	      min-height: 94px;
	      padding: 22px 24px;
	      display: flex;
	      align-items: center;
	      gap: 22px;
	      background: rgba(255,255,255,.92);
	      color: var(--ink);
	    }
	    .cert-card strong {
	      color: var(--accent-2);
	      font-size: 30px;
	      letter-spacing: -.04em;
	    }
	    .cert-card span {
	      font-weight: 780;
	      line-height: 1.35;
	    }
	    .final-cta {
	      width: min(var(--max), calc(100vw - 40px));
	      margin: ${isLumenStyle ? '126px auto 88px' : '136px auto 96px'};
      min-height: 440px;
      padding: 70px;
      display: grid;
      align-content: center;
      background:
        linear-gradient(90deg, rgba(255,255,255,.96), rgba(255,255,255,.76)),
        url("${escapeHtml(continuationSurfaces[4].source)}");
      background-size: cover;
      background-position: center right;
    }
    .final-cta a {
      width: fit-content;
      min-height: 52px;
      margin-top: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 15px 28px;
      background: var(--accent);
      color: ${isLumenStyle ? 'var(--ink)' : 'white'};
      text-decoration: none;
      font-weight: 800;
      letter-spacing: ${isLumenStyle ? '0' : '.12em'};
      text-transform: ${isLumenStyle ? 'none' : 'uppercase'};
    }
    @media (max-width: 900px) {
      .nav-links { display: none; }
      .nav { min-height: 82px; }
      .brand { font-size: 30px; }
      .hero {
        width: min(var(--max), calc(100vw - 40px));
        grid-template-columns: 1fr;
        min-height: auto;
        padding-top: 40px;
      }
	      .copy {
	        grid-column: auto;
	        padding: 0;
	      }
	      .lumen-editorial .hero .copy > .eyebrow {
	        position: static;
	        margin-bottom: 20px;
	      }
	      h1 {
	        margin-left: 0;
	      }
	      .lumen-editorial h1 span + span {
	        margin-left: 0;
	      }
      .lead, .actions {
        margin-left: 0;
      }
      .photo-panel {
        display: block;
        margin-top: 44px;
        min-height: 440px;
      }
      .hero-photo {
        position: static;
        width: 100%;
        height: 440px;
        min-height: 0;
        border-radius: ${isLumenStyle && heroAssetMode === 'cutout' ? '0' : '24px'};
        object-fit: ${isLumenStyle && heroAssetMode === 'cutout' ? 'contain' : 'cover'};
      }
      .mini-photo, .proof-card {
        display: none;
      }
      .stats {
        margin: 42px auto 0;
        grid-template-columns: 1fr;
        gap: 18px;
        padding: 24px 0;
      }
      .stat {
        grid-template-columns: 1fr;
        padding: 0;
      }
      .service-strip {
        grid-template-columns: 1fr;
        margin-top: 54px;
      }
      .split-section,
      .wide-band-inner,
      .shop-heading,
      .article-heading,
      .deep-grid,
      .product-grid,
      .article-grid,
      .gallery-section,
      .gallery-grid {
        grid-template-columns: 1fr;
      }
	      .split-section,
	      .shop-section,
	      .gallery-section,
	      .article-strip,
	      .specialist-section {
	        margin-top: 88px;
	      }
      .split-media {
        min-height: 460px;
      }
      .wide-band {
        min-height: 560px;
      }
      .wide-band-inner {
        padding-bottom: 56px;
      }
      .product-card {
        min-height: auto;
      }
    }
    @media (max-width: 560px) {
      .nav-cta { display: none; }
      .brand { font-size: 24px; }
      h1 { font-size: ${isLumenStyle ? '58px' : '46px'}; }
      .lead { font-size: 16px; }
      .actions a { min-width: 100%; }
      .photo-panel { min-height: 300px; }
      .hero-photo { height: 300px; }
      .stat strong { font-size: ${isLumenStyle ? '46px' : '24px'}; }
	      .split-copy h2,
	      .shop-heading h2,
	      .article-heading h2,
	      .specialist-copy h2,
	      .certification-copy h2,
	      .wide-band h2,
	      .final-cta h2 {
	        font-size: 42px;
	      }
      .split-media {
        min-height: 360px;
      }
	      .split-note {
	        position: static;
	        width: 100%;
	      }
	      .specialist-section,
	      .specialist-list,
	      .certification-inner {
	        grid-template-columns: 1fr;
	      }
	      .specialist-media {
	        min-height: 460px;
	      }
	      .wide-band {
	        min-height: 500px;
	      }
	      .deep-card img,
	      .product-card img,
	      .gallery-card img,
	      .specialist-card img {
	        height: 210px;
	      }
	      .specialist-media {
	        min-height: 360px;
	      }
	      .certification-band {
	        padding: 70px 0;
	      }
      .final-cta {
        min-height: 390px;
        padding: 42px 28px;
      }
    }
  </style>
</head>
<body>
  <main class="shell ${isLumenStyle ? 'lumen-editorial' : 'optical-split'}">
    <nav class="nav">
      <div class="brand"><span class="mark"></span><span>${escapeHtml(archetype.brand)}</span></div>
      <div class="nav-links">
        <span>Home</span><span>About</span><span>Services</span><span>${isLumenStyle ? 'Journal' : 'Shop'}</span><span>Contact</span>
      </div>
      <div class="nav-actions"><a class="nav-cta" href="#">${isLumenStyle ? 'Book a visit' : 'Book an eye exam'}</a></div>
    </nav>
    <section class="hero">
      <div class="copy">
        <span class="eyebrow">${escapeHtml(archetype.eyebrow)}</span>
	        <h1>${isLumenStyle
    ? `<span>${escapeHtml(archetype.titleLead)}</span><span>${escapeHtml(archetype.titleAccent)}</span>`
    : escapeHtml(archetype.title)}</h1>
        <p class="lead">${escapeHtml(archetype.body)}</p>
        <div class="actions">
          <a href="#">${escapeHtml(archetype.cta)}</a>
          <a href="#">${escapeHtml(archetype.secondaryCta)}</a>
        </div>
      </div>
      <div class="photo-panel">
        <img class="hero-photo doctor-visual" src="${escapeHtml(heroMediaSource)}" alt="" loading="eager">
        <img class="mini-photo" src="${escapeHtml(archetype.detailImage)}" alt="" loading="eager">
      </div>
      <article class="proof-card">
        <span>${isLumenStyle ? 'Certified optometrists' : 'Trusted optometry'}</span>
        <h2>${isLumenStyle ? 'Licensed specialists with thoughtful care plans' : 'Qualified eye care and same-day guidance'}</h2>
        <p>${isLumenStyle
    ? 'Every examination is led by a trained specialist who explains the findings and the next step clearly.'
    : 'From routine exams to urgent questions, every recommendation stays practical, personal, and easy to understand.'}</p>
      </article>
    </section>
    <section class="stats">${stats}
    </section>
    <section class="service-strip">${cards}
    </section>
    <section class="split-section">
      <div class="split-copy">
        <span class="eyebrow">${isLumenStyle ? 'Care process' : 'Who we are'}</span>
        <h2>${isLumenStyle ? 'Specialist care, explained with calm and clarity.' : 'Eye care and frame styling, brought together.'}</h2>
        <p>${isLumenStyle
    ? 'From first screening to follow-up, we make room for questions and keep every care decision easy to understand.'
    : 'Our optometrists and frame stylists work side by side, helping you leave with sharper sight and a comfortable fit.'}</p>
      </div>
      <div class="split-media">
        <img src="${escapeHtml(continuationSurfaces[0].source)}" alt="" loading="lazy">
        <div class="split-note">
          <strong>${isLumenStyle ? '15+' : '24h'}</strong>
          <span>${isLumenStyle ? 'Years of careful examinations and patient-first guidance.' : 'Same-day exam support and precise adjustments for a more comfortable fit.'}</span>
        </div>
      </div>
    </section>
    <section class="wide-band">
      <div class="wide-band-inner">
        <h2>${isLumenStyle ? 'Specialist rooms, modern diagnostics, and care that never feels rushed.' : 'Modern diagnostics and thoughtful eyewear service, all in one visit.'}</h2>
        <p>${isLumenStyle
    ? 'From screening to follow-up, each step is explained clearly and supported by the right specialist.'
    : 'Explore complete exams, lens options, frame styling, and aftercare built around your daily routine.'}</p>
      </div>
    </section>
    <section class="deep-grid">${continuationCards}
    </section>
    <section class="shop-section">
      <div class="shop-heading">
        <h2>${isLumenStyle ? 'Care plans for every stage of sight.' : 'Frames selected for comfort, character, and everyday wear.'}</h2>
        <p>${isLumenStyle
    ? 'Explore thoughtful support for changing vision, long-term conditions, and the everyday habits that protect comfort.'
    : 'Discover considered shapes, precise lens choices, and personal fitting advice without the rushed showroom experience.'}</p>
      </div>
      <div class="product-grid">${productCards}
      </div>
    </section>
    <section class="gallery-section">
      <div class="gallery-kicker">
        <span class="eyebrow">${isLumenStyle ? 'Inside the clinic' : 'Inside the studio'}</span>
        <h2>${isLumenStyle ? 'A closer look at how we care.' : 'See the craft behind every fitting.'}</h2>
        <p>${isLumenStyle
    ? 'Meet the people, rooms, and modern equipment that make each visit feel calm, capable, and personal.'
    : 'From the exam room to the frame wall, every detail is arranged to make choosing eyewear easier.'}</p>
      </div>
      <div class="gallery-grid">${galleryCards}
      </div>
    </section>
    <section class="article-strip">
      <div class="article-heading">
        <h2>${isLumenStyle ? 'Practical eye-care guidance for everyday life.' : 'Straightforward guidance for clearer choices.'}</h2>
        <p>${isLumenStyle
    ? 'Practical guidance helps you prepare for visits, understand changes, and care for your eyes between appointments.'
    : 'Straightforward advice helps you compare lenses, care for frames, and feel prepared for your next exam.'}</p>
      </div>
	      <div class="article-grid">
	        <article class="article-card">
	          <img src="${escapeHtml(continuationSurfaces[10 % continuationSurfaces.length].source)}" alt="" loading="lazy">
	          <span>${isLumenStyle ? 'Clinic journal' : 'Optical journal'}</span>
	          <h3>${isLumenStyle ? 'How careful screening improves everyday comfort.' : 'Choosing screen lenses for long working days.'}</h3>
	          <p>${escapeHtml(cardCopy(1))}</p>
	        </article>
	        <article class="article-card">
	          <img src="${escapeHtml(continuationSurfaces[11 % continuationSurfaces.length].source)}" alt="" loading="lazy">
	          <span>${isLumenStyle ? 'Patient notes' : 'Safety notes'}</span>
	          <h3>${isLumenStyle ? 'What to prepare before your next eye exam.' : 'A practical guide to eyewear for active days.'}</h3>
          <p>${escapeHtml(cardCopy(2))}</p>
	        </article>
	      </div>
	    </section>
	    <section class="specialist-section">
	      <div class="specialist-media">
	        <img src="${escapeHtml(continuationSurfaces[5 % continuationSurfaces.length].source)}" alt="" loading="lazy">
	      </div>
	      <div class="specialist-copy">
	        <span class="eyebrow">${isLumenStyle ? 'Our specialists' : 'Optical team'}</span>
	        <h2>${isLumenStyle ? 'Trusted eye experts dedicated to you.' : 'Retail guidance with clinical confidence.'}</h2>
	        <p>${isLumenStyle
    ? 'Our optometrists take time to listen, explain each finding, and connect you with the right specialist when needed.'
    : 'From first fitting to final adjustment, our team balances clinical precision with a genuine feel for personal style.'}</p>
	        <div class="specialist-list">${specialistCards}
	        </div>
	      </div>
	    </section>
	    <section class="certification-band">
	      <div class="certification-inner">
	        <div class="certification-copy">
	          <span class="eyebrow">${isLumenStyle ? 'Our certifications' : 'Our standards'}</span>
	          <h2>${isLumenStyle ? 'Trusted standards in modern eye care.' : 'Care you can count on before and after collection.'}</h2>
	          <p>${isLumenStyle
    ? 'Our clinics pair modern equipment with careful records, clear explanations, and consistent specialist follow-up.'
    : 'Trusted partners, precise fittings, and responsive aftercare support every frame long after collection day.'}</p>
	        </div>
	        <div class="cert-grid">${certificationCards}
	        </div>
	      </div>
	    </section>
	    <section class="final-cta">
	      <span class="eyebrow">${isLumenStyle ? 'Appointment ready' : 'Your next pair'}</span>
      <h2>${isLumenStyle ? 'Book a calmer eye-care visit.' : 'Find frames and eye care that feel made for you.'}</h2>
      <p>${isLumenStyle
    ? 'Choose a convenient time and meet a specialist who will listen carefully, explain clearly, and plan with you.'
    : 'Plan an exam, explore new frames, and leave with thoughtful guidance for clearer, more comfortable days.'}</p>
      <a href="#">${escapeHtml(archetype.cta)}</a>
    </section>
  </main>
</body>
</html>
`;

  return { html, manifest };
}

function buildMarketplaceServiceTarget(seed, random, variant, requestedArchetype = '') {
  const pickedPalette = pick(palettes, random);
  const archetype = requestedArchetype
    ? serviceArchetypes.find((item) => item.name === requestedArchetype)
    : pick(serviceArchetypes, random);

  if (archetype.referenceStyle === 'maidy-bright-cleaning') {
    return buildMaidyBrightCleaningTarget(seed, random, variant, archetype);
  }

  if (archetype.referenceStyle === 'optomatta-optical-retail' || archetype.referenceStyle === 'lumen-eye-care-editorial') {
    return buildEyeCareReferenceTarget(seed, random, variant, archetype);
  }

  const isCaregloStyle = archetype.referenceStyle === 'careglo-dark-service';
  const palette = isCaregloStyle
    ? {
      name: 'careglo-dark',
      bg: '#0b0d12',
      panel: '#151820',
      ink: '#fff7ea',
      muted: '#a7adb9',
      accent: '#f5b66f',
      accent2: '#c88845',
    }
    : pickedPalette;
  const radius = between(random, 18, 34);
  const maxWidth = pick([1160, 1240, 1320], random);
  const heroMinHeight = isCaregloStyle ? between(random, 600, 700) : between(random, 680, 820);
  const visualMinHeight = isCaregloStyle ? between(random, 500, 590) : between(random, 520, 640);
  const topbarLeft = isCaregloStyle ? 'Guaranteed luxury finish' : 'Appointments open this week';
  const topbarRight = isCaregloStyle ? 'Studio-grade care by appointment' : 'Trusted local service studio';
  const bookingLabel = isCaregloStyle ? 'Signature slot' : 'Priority slot';
  const bookingTitle = isCaregloStyle ? 'Reserve a detail bay in under three minutes.' : 'Plan a visit in under three minutes.';
  const bookingCta = isCaregloStyle ? 'Book detailing now' : 'Start booking';
  const scoreText = isCaregloStyle ? 'Average finish score across recent appointments.' : 'Average client score across recent appointments.';
  const stripTitle = isCaregloStyle ? 'Considered care packages for every finish.' : 'Straightforward service plans for a fresher space.';
  const stripBody = isCaregloStyle
    ? 'Every package pairs careful inspection with clear finish notes, so you know exactly how the vehicle was restored and protected.'
    : 'Choose the level of care that fits your week, then book a trusted team and arrival window in minutes.';
  const navLinks = isCaregloStyle
    ? ['Services', 'Proof', 'Process', 'Contact']
    : ['Services', 'Proof', 'Plans', 'Contact'];
  const continuationSurfaces = isCaregloStyle ? carCareContinuationMediaSurfaces() : [];

  const manifest = {
    seed,
    variant,
    archetype: archetype.name,
    palette: palette.name,
    referenceStyle: archetype.referenceStyle || null,
    maxWidth,
    columns: 12,
    visualTargets: ['desktop:1440x1200', 'tablet:834x1112', 'mobile:390x844'],
    marketplaceReferences: [
      'Automotive/car-detailing service hero with split visual panel, trust cards, and appointment CTA.',
      'Optometry/clinic layouts with oversized typography, soft gradient backgrounds, and service cards.',
      'Cleaning/service layouts with strong CTA hierarchy and social-proof bands.',
    ],
    imagePolicy: 'Uses neutral stock-photo URLs as placeholder visual pressure; never copies Envato/template-demo assets.',
    imageSources: [
      ...marketplaceImageSources(archetype),
      ...continuationSurfaces.map((surface) => surface.source),
    ],
    mediaSurfaces: [
      ...marketplaceMediaSurfaces(archetype),
      ...continuationSurfaces,
    ],
    requiredMediaRoles: marketplaceMediaRoles(),
    notes: [
      'HTML is a visual target only.',
      'This target is marketplace-seeded but original; do not copy third-party assets, copy, or source.',
      'Monteby recreation must use contract-backed props and no className/raw HTML.',
    ],
  };

  const serviceCards = archetype.cards.map((card, index) => `
        <article class="service-card service-card-${index + 1}">
          <img src="${escapeHtml(archetype.cardImages[index % archetype.cardImages.length])}" alt="" loading="lazy">
          <span>0${index + 1}</span>
          <h3>${escapeHtml(card)}</h3>
          <p>${escapeHtml(cardCopy(index))}</p>
        </article>`).join('');
  const careProcessCards = isCaregloStyle ? [
    ['Paint correction', 'Lighting-led correction checks before finish protection.', continuationSurfaces[3].source],
    ['Interior reset', 'Fabric, leather, vents, and touch points handled in one flow.', continuationSurfaces[2].source],
    ['Ceramic finish', 'Gloss, hydrophobic protection, and handover photography.', continuationSurfaces[4].source],
  ].map(([title, text, source], index) => `
        <article class="care-process-card">
          <img src="${escapeHtml(source)}" alt="" loading="lazy">
          <span>0${index + 1}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(text)}</p>
        </article>`).join('') : '';
  const carePackageCards = isCaregloStyle ? [
    ['Signature bay', 'Exterior wash, clay, polish, sealant, and interior reset.', continuationSurfaces[0].source],
    ['Interior ritual', 'Steam, extraction, leather care, cabin glass, and scent finish.', continuationSurfaces[1].source],
    ['Protective detail', 'Paint inspection, ceramic prep, wheel faces, and gloss check.', continuationSurfaces[4].source],
    ['Handover proof', 'Photo-backed finish summary and next-care recommendations.', continuationSurfaces[5].source],
  ].map(([title, text, source]) => `
        <article class="care-package-card">
          <img src="${escapeHtml(source)}" alt="" loading="lazy">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(text)}</p>
          </div>
        </article>`).join('') : '';
  const careDetailCards = isCaregloStyle ? [
    ['Paint depth read', 'Close-up inspection for gloss, correction, and surface finish.', continuationSurfaces[7].source],
    ['Studio handover', 'Final lighting checks reveal gloss, clarity, and every detail prepared for collection.', continuationSurfaces[8].source],
  ].map(([title, text, source]) => `
        <article class="care-detail-card">
          <img src="${escapeHtml(source)}" alt="" loading="lazy">
          <div>
            <span>Proof</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(text)}</p>
          </div>
        </article>`).join('') : '';
  const carePricingCards = isCaregloStyle ? [
    ['Essential finish', '$140', 'For regularly maintained vehicles that need a precise exterior and cabin reset.', ['Hand wash and decontamination', 'Cabin touch-point reset', 'Finish inspection notes']],
    ['Studio correction', '$290', 'A focused paint and interior treatment for vehicles that need visible correction and protection.', ['Single-stage paint correction', 'Interior steam and extraction', 'Six-month finish protection']],
    ['Commission detail', '$480', 'A complete studio appointment with deeper correction, ceramic preparation, and documented handover.', ['Multi-stage surface refinement', 'Ceramic coating preparation', 'Photo-backed care report']],
  ].map(([title, price, text, features], index) => `
        <article class="care-price-card${index === 1 ? ' is-featured' : ''}">
          <span>${index === 1 ? 'Most requested' : 'Care plan'}</span>
          <h3>${escapeHtml(title)}</h3>
          <strong>${escapeHtml(price)}</strong>
          <p>${escapeHtml(text)}</p>
          <ul>${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
          <a href="#">Reserve this plan</a>
        </article>`).join('') : '';
  const careStorySections = isCaregloStyle ? `
    <section class="care-about">
      <div class="care-about-copy">
        <span class="eyebrow">Detail bay process</span>
        <h2>Craft, patience, and proof in every finished surface.</h2>
        <p>Every vehicle moves through a measured sequence of inspection, correction, protection, and final review under studio lighting.</p>
        <div class="care-proof-row">
          <strong>1.2k</strong>
          <span>vehicles prepared through controlled interior, exterior, and finish-protection routines.</span>
        </div>
      </div>
      <div class="care-about-media">
        <img class="care-tall-photo" src="${escapeHtml(continuationSurfaces[0].source)}" alt="" loading="lazy">
        <div class="care-side-photo">
          <img src="${escapeHtml(continuationSurfaces[1].source)}" alt="" loading="lazy">
          <span>Studio-grade surface checks before every handover.</span>
        </div>
      </div>
    </section>
    <section class="care-process">
      <div class="care-process-heading">
        <span class="eyebrow">Process</span>
        <h2>Premium treatments for paint, cabin, and protection.</h2>
      </div>
      <div class="care-process-grid">${careProcessCards}
      </div>
    </section>
    <section class="care-video-band">
      <div>
        <span class="eyebrow">Workshop proof</span>
        <h2>Watch the finish take shape under studio lights.</h2>
      </div>
      <article>
        <strong>24h</strong>
        <span>booking response with inspection, bay allocation, and finish notes.</span>
      </article>
    </section>
    <section class="care-detail-strip">
      <div class="care-detail-copy">
        <span class="eyebrow">Inspection details</span>
        <h2>A closer look before the final handover.</h2>
        <p>From paint depth to trim condition, every close-up helps us choose the right correction and protection plan.</p>
      </div>
      <div class="care-detail-grid">${careDetailCards}
      </div>
    </section>
    <section class="care-packages">
      <div class="care-section-heading">
        <span class="eyebrow">Packages</span>
        <h2>Choose the level of care your vehicle deserves.</h2>
      </div>
      <div class="care-package-grid">${carePackageCards}
      </div>
    </section>
    <section class="care-testimonial">
      <div class="care-testimonial-media">
        <img src="${escapeHtml(continuationSurfaces[6].source)}" alt="" loading="lazy">
      </div>
      <article>
        <strong>99</strong>
        <blockquote>The handover felt like a studio reveal, not a normal car wash.</blockquote>
        <p>The team documented every stage, explained the finish options clearly, and returned the car looking exceptional from every angle.</p>
      </article>
    </section>
    <section class="care-pricing">
      <div class="care-section-heading">
        <div>
          <span class="eyebrow">Care plans</span>
          <h2>Clear options for every level of finish.</h2>
        </div>
        <p>Every plan starts with an inspection and ends with a concise handover record, so protection and follow-up care stay predictable.</p>
      </div>
      <div class="care-price-grid">${carePricingCards}
      </div>
    </section>
    <section class="care-partners">
      <span>VELOCE</span><span>MONOCOAT</span><span>ATELIER</span><span>POLISH LAB</span><span>DETAIL BAY</span>
    </section>
    <section class="care-final">
      <div>
        <span class="eyebrow">Book the bay</span>
        <h2>Reserve a premium detail while the finish still matters.</h2>
        <p>Choose a package, share a few notes about the vehicle, and we will prepare the bay, products, and timing before you arrive.</p>
      </div>
      <a href="#">Make appointment</a>
    </section>
    <footer class="care-footer">
      <div class="care-footer-intro">
        <strong>Aureline Auto</strong>
        <p>Measured detailing for drivers who value finish quality, clear recommendations, and careful studio handovers.</p>
      </div>
      <div>
        <span>Studio</span>
        <a href="#">Treatments</a>
        <a href="#">Recent work</a>
        <a href="#">Care plans</a>
      </div>
      <div>
        <span>Visit</span>
        <a href="#">Detail bay hours</a>
        <a href="#">Preparation guide</a>
        <a href="#">Contact</a>
      </div>
      <div class="care-footer-contact">
        <span>Appointments</span>
        <strong>+1 415 555 0186</strong>
        <a href="#">hello@aureline.studio</a>
      </div>
      <small>Independent automotive care studio. Visits are arranged by appointment.</small>
    </footer>` : '';

  const stats = archetype.stats.map((stat) => {
    const [value, ...label] = stat.split(' ');
    return `
          <div class="stat">
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(label.join(' '))}</span>
          </div>`;
  }).join('');
  const careCss = isCaregloStyle ? `
    .care-about,
    .care-process,
    .care-detail-strip,
    .care-packages,
    .care-testimonial,
    .care-pricing,
    .care-final {
      width: min(var(--max), calc(100vw - 40px));
      margin: 112px auto 0;
    }
    .care-about {
      display: grid;
      grid-template-columns: minmax(0, .82fr) minmax(0, 1.18fr);
      gap: 56px;
      align-items: center;
    }
    .care-about-copy h2,
    .care-process-heading h2,
    .care-section-heading h2,
    .care-pricing h2,
    .care-final h2 {
      margin: 24px 0 0;
      color: var(--ink);
      font-size: clamp(42px, 4.8vw, 68px);
      line-height: 1;
      letter-spacing: -.035em;
    }
    .care-about-copy p,
    .care-final p {
      max-width: 620px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
    }
    .care-proof-row {
      margin-top: 36px;
      padding-top: 28px;
      border-top: 1px solid var(--hairline);
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 24px;
      align-items: start;
    }
    .care-proof-row strong {
      color: var(--accent);
      font-size: 58px;
      line-height: .9;
    }
    .care-proof-row span {
      color: var(--muted);
      line-height: 1.65;
    }
    .care-about-media {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, .72fr);
      gap: 22px;
      align-items: end;
    }
    .care-tall-photo,
    .care-side-photo {
      border-radius: calc(var(--radius) + 8px);
      overflow: hidden;
      border: 1px solid var(--hairline);
      background: var(--surface);
      box-shadow: 0 30px 70px rgba(0, 0, 0, .28);
    }
    .care-tall-photo {
      width: 100%;
      min-height: 560px;
      height: 560px;
      object-fit: cover;
    }
    .care-side-photo img {
      width: 100%;
      height: 330px;
      object-fit: cover;
    }
    .care-side-photo span {
      display: block;
      padding: 24px;
      color: var(--muted);
      line-height: 1.55;
    }
    .care-process {
      display: grid;
      grid-template-columns: .78fr 1.22fr;
      gap: 44px;
      align-items: start;
    }
    .care-process-grid,
    .care-package-grid {
      display: grid;
      gap: 20px;
    }
    .care-process-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .care-process-card,
    .care-package-card {
      overflow: hidden;
      border-radius: var(--radius);
      background: var(--surface);
      border: 1px solid var(--hairline);
      box-shadow: 0 24px 60px rgba(0, 0, 0, .22);
    }
    .care-process-card img {
      width: 100%;
      height: 260px;
      object-fit: cover;
    }
    .care-process-card span {
      display: block;
      margin: 26px 28px 0;
      color: var(--accent);
      font-weight: 900;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .care-process-card h3,
    .care-package-card h3 {
      margin: 14px 28px 0;
      color: var(--ink);
      font-size: 28px;
      line-height: 1.06;
    }
    .care-process-card p,
    .care-package-card p {
      margin: 14px 28px 30px;
      color: var(--muted);
      line-height: 1.62;
    }
    .care-video-band {
      margin: 128px 0 0;
      min-height: 620px;
      padding: 80px max(20px, calc((100vw - var(--max)) / 2));
      display: grid;
      grid-template-columns: minmax(0, .72fr) minmax(280px, .32fr);
      gap: 56px;
      align-items: end;
      background:
        linear-gradient(90deg, rgba(5, 7, 10, .88), rgba(5, 7, 10, .18)),
        url("${escapeHtml(continuationSurfaces[5].source)}");
      background-size: cover;
      background-position: center;
    }
    .care-video-band h2 {
      max-width: 760px;
      margin: 24px 0 0;
      color: var(--ink);
      font-size: clamp(48px, 5.8vw, 78px);
      line-height: .98;
      letter-spacing: -.04em;
    }
    .care-video-band article {
      padding: 36px;
      border-radius: var(--radius);
      background: rgba(18, 21, 27, .92);
      border: 1px solid var(--hairline);
      color: var(--ink);
    }
    .care-video-band article strong {
      display: block;
      color: var(--accent);
      font-size: 56px;
      line-height: 1;
    }
    .care-video-band article span {
      display: block;
      margin-top: 16px;
      color: var(--muted);
      line-height: 1.65;
    }
    .care-detail-strip {
      display: grid;
      grid-template-columns: minmax(0, .42fr) minmax(0, .58fr);
      gap: 42px;
      align-items: end;
    }
    .care-detail-copy {
      min-height: 420px;
      padding: 44px;
      display: grid;
      align-content: end;
      border-radius: calc(var(--radius) + 8px);
      background: var(--surface);
      border: 1px solid var(--hairline);
    }
    .care-detail-copy h2 {
      margin: 22px 0 0;
      color: var(--ink);
      font-size: clamp(38px, 4vw, 58px);
      line-height: 1.02;
      letter-spacing: -.035em;
    }
    .care-detail-copy p {
      margin: 22px 0 0;
      color: var(--muted);
      line-height: 1.7;
    }
    .care-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px;
    }
    .care-detail-card {
      min-height: 520px;
      overflow: hidden;
      border-radius: calc(var(--radius) + 8px);
      background: var(--surface);
      border: 1px solid var(--hairline);
      box-shadow: 0 24px 60px rgba(0, 0, 0, .22);
    }
    .care-detail-card img {
      width: 100%;
      height: 330px;
      object-fit: cover;
    }
    .care-detail-card div {
      padding: 28px;
    }
    .care-detail-card span {
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .care-detail-card h3 {
      margin: 14px 0 0;
      color: var(--ink);
      font-size: 30px;
      line-height: 1.06;
    }
    .care-detail-card p {
      margin: 14px 0 0;
      color: var(--muted);
      line-height: 1.62;
    }
    .care-section-heading {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 48px;
      margin-bottom: 42px;
    }
    .care-package-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .care-package-card img {
      width: 100%;
      height: 240px;
      object-fit: cover;
    }
    .care-testimonial {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 44px;
      align-items: stretch;
    }
    .care-testimonial-media,
    .care-testimonial article {
      min-height: 540px;
      border-radius: calc(var(--radius) + 8px);
      overflow: hidden;
    }
    .care-testimonial-media img {
      width: 100%;
      height: 100%;
      min-height: inherit;
      object-fit: cover;
    }
    .care-testimonial article {
      padding: 62px;
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--ink);
    }
    .care-testimonial strong {
      color: var(--accent);
      font-size: 68px;
      line-height: 1;
    }
    .care-testimonial blockquote {
      margin: 32px 0 0;
      font-size: clamp(32px, 3.8vw, 52px);
      line-height: 1.08;
      letter-spacing: -.035em;
    }
    .care-testimonial p {
      margin: 28px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
    }
    .care-pricing .care-section-heading > p {
      max-width: 480px;
      margin: 0;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.7;
    }
    .care-price-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }
    .care-price-card {
      min-height: 500px;
      padding: 42px;
      display: flex;
      flex-direction: column;
      border-radius: calc(var(--radius) + 8px);
      background: var(--surface);
      border: 1px solid var(--hairline);
      color: var(--ink);
      box-shadow: 0 24px 60px rgba(0, 0, 0, .22);
    }
    .care-price-card.is-featured {
      background: var(--accent);
      border-color: var(--accent);
      color: #18110a;
      transform: translateY(-18px);
    }
    .care-price-card > span {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
      opacity: .72;
    }
    .care-price-card h3 {
      margin: 22px 0 0;
      font-size: 32px;
      line-height: 1.04;
    }
    .care-price-card > strong {
      margin-top: 26px;
      font-size: 58px;
      line-height: 1;
    }
    .care-price-card p {
      margin: 24px 0 0;
      color: var(--muted);
      line-height: 1.65;
    }
    .care-price-card.is-featured p {
      color: rgba(24, 17, 10, .72);
    }
    .care-price-card ul {
      margin: 28px 0 34px;
      padding-left: 20px;
      display: grid;
      gap: 12px;
      line-height: 1.5;
    }
    .care-price-card a {
      min-height: 52px;
      margin-top: auto;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      border: 1px solid currentColor;
      border-radius: 999px;
      color: inherit;
      text-decoration: none;
      font-weight: 900;
    }
    .care-partners {
      width: min(var(--max), calc(100vw - 40px));
      min-height: 168px;
      margin: 118px auto 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 34px;
      color: rgba(255,255,255,.34);
      font-size: clamp(24px, 3vw, 42px);
      font-weight: 900;
      letter-spacing: .16em;
    }
    .care-final {
      margin-bottom: 100px;
      min-height: 520px;
      padding: 68px;
      display: grid;
      grid-template-columns: minmax(0, .78fr) auto;
      gap: 48px;
      align-items: end;
      border-radius: calc(var(--radius) + 10px);
      overflow: hidden;
      background:
        linear-gradient(90deg, rgba(18, 21, 27, .95), rgba(18, 21, 27, .68)),
        url("${escapeHtml(continuationSurfaces[6].source)}");
      background-size: cover;
      background-position: center;
    }
    .care-final a {
      min-width: 190px;
      min-height: 58px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      padding: 16px 28px;
      border-radius: 999px;
      background: var(--accent);
      color: #18110a;
      text-decoration: none;
      font-weight: 900;
    }
    .care-footer {
      width: min(var(--max), calc(100vw - 40px));
      min-height: 430px;
      margin: 118px auto 0;
      padding: 72px 0 46px;
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) repeat(3, minmax(150px, .72fr));
      gap: 48px;
      border-top: 1px solid var(--hairline);
      color: var(--muted);
    }
    .care-footer-intro strong {
      color: var(--ink);
      font-size: 30px;
    }
    .care-footer-intro p {
      max-width: 430px;
      margin: 24px 0 0;
      font-size: 17px;
      line-height: 1.7;
    }
    .care-footer > div:not(.care-footer-intro) {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
    .care-footer span {
      color: var(--ink);
      font-weight: 900;
    }
    .care-footer a {
      color: var(--muted);
      text-decoration: none;
    }
    .care-footer-contact strong {
      color: var(--accent);
      font-size: 22px;
    }
    .care-footer small {
      grid-column: 1 / -1;
      align-self: end;
      padding-top: 28px;
      border-top: 1px solid var(--hairline);
    }
    @media (max-width: 900px) {
      .care-about,
      .care-process,
      .care-detail-strip,
      .care-testimonial,
      .care-final {
        grid-template-columns: 1fr;
      }
      .care-about-media,
      .care-process-grid,
      .care-package-grid,
      .care-price-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .care-price-card:last-child {
        grid-column: 1 / -1;
      }
      .care-footer {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .care-video-band {
        grid-template-columns: 1fr;
        min-height: 520px;
      }
      .care-tall-photo,
      .care-testimonial-media,
      .care-testimonial article {
        min-height: 420px;
      }
      .care-final {
        min-height: 440px;
      }
      .care-partners {
        flex-wrap: wrap;
        justify-content: center;
      }
    }
    @media (max-width: 560px) {
      .care-about,
      .care-process,
      .care-detail-strip,
      .care-packages,
      .care-testimonial,
      .care-pricing,
      .care-partners,
      .care-final,
      .care-footer {
        margin-top: 76px;
      }
      .care-about-media,
      .care-process-grid,
      .care-detail-grid,
      .care-package-grid,
      .care-price-grid,
      .care-final {
        grid-template-columns: 1fr;
      }
      .care-price-card:last-child {
        grid-column: auto;
      }
      .care-price-card.is-featured {
        transform: none;
      }
      .care-footer {
        padding-top: 52px;
        grid-template-columns: 1fr;
      }
      .care-about-copy h2,
      .care-process-heading h2,
      .care-detail-copy h2,
      .care-section-heading h2,
      .care-pricing h2,
      .care-video-band h2,
      .care-final h2 {
        font-size: 40px;
      }
      .care-proof-row {
        grid-template-columns: 1fr;
      }
      .care-tall-photo,
      .care-testimonial-media,
      .care-testimonial article {
        min-height: 320px;
      }
      .care-video-band,
      .care-final {
        padding: 42px 20px;
      }
      .care-testimonial article {
        padding: 34px;
      }
    }` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(archetype.brand)} | ${escapeHtml(archetype.eyebrow)}</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --accent-2: ${palette.accent2};
      --radius: ${radius}px;
      --max: ${maxWidth}px;
      --hero-min: ${heroMinHeight}px;
      --visual-min: ${visualMinHeight}px;
      --surface: ${isCaregloStyle ? '#12151b' : palette.panel};
      --surface-2: ${isCaregloStyle ? '#1b2029' : palette.panel};
      --hairline: ${isCaregloStyle ? 'rgba(255,255,255,.1)' : 'color-mix(in srgb, var(--ink), transparent 88%)'};
      --button-bg: ${isCaregloStyle ? palette.accent : palette.ink};
      --button-fg: ${isCaregloStyle ? '#18110a' : '#ffffff'};
      --secondary-bg: ${isCaregloStyle ? '#171b23' : palette.panel};
      --service-bg: ${isCaregloStyle ? '#11141a' : palette.ink};
      --service-ink: ${isCaregloStyle ? '#fff7ea' : '#ffffff'};
      --hero-title-max: ${isCaregloStyle ? '66px' : '88px'};
      --hero-title-vw: ${isCaregloStyle ? '5.4vw' : '7vw'};
      --service-photo-height: ${isCaregloStyle ? '196px' : '180px'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    .shell { overflow: hidden; }
    img { display: block; max-width: 100%; }
    .topbar {
      background: ${isCaregloStyle ? '#151820' : 'var(--ink)'};
      color: ${isCaregloStyle ? 'color-mix(in srgb, var(--ink), transparent 24%)' : 'color-mix(in srgb, white, transparent 18%)'};
      font-size: 14px;
    }
    .topbar-inner {
      width: min(var(--max), calc(100vw - 40px));
      min-height: 44px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
    }
    .nav {
      width: min(var(--max), calc(100vw - 40px));
      min-height: 78px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 26px;
    }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 850; }
    .mark { width: 44px; height: 44px; border-radius: 15px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
    .nav-links { display: flex; align-items: center; gap: 24px; color: var(--muted); font-weight: 720; }
    .nav a, .actions a, .service-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 14px 20px;
      background: var(--button-bg);
      color: var(--button-fg);
      text-decoration: none;
      font-weight: 780;
      line-height: 1;
    }
    .nav a { background: var(--accent); color: ${isCaregloStyle ? '#18110a' : 'var(--ink)'}; }
    .hero {
      width: min(var(--max), calc(100vw - 40px));
      min-height: var(--hero-min);
      margin: 34px auto 0;
      display: grid;
      grid-template-columns: ${isCaregloStyle ? 'minmax(0, .82fr) minmax(0, 1.18fr)' : 'minmax(0, .94fr) minmax(0, 1.06fr)'};
      gap: ${isCaregloStyle ? '34px' : '46px'};
      align-items: center;
    }
    .eyebrow {
      display: inline-flex;
      width: fit-content;
      padding: 9px 13px;
      border-radius: 999px;
      background: ${isCaregloStyle ? 'rgba(245,182,111,.13)' : 'color-mix(in srgb, var(--accent), transparent 82%)'};
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: .1em;
    }
    h1 {
      max-width: 720px;
      margin: 24px 0 20px;
      font-size: clamp(46px, var(--hero-title-vw), var(--hero-title-max));
      line-height: ${isCaregloStyle ? '.96' : '.94'};
      letter-spacing: ${isCaregloStyle ? '-0.028em' : '-0.04em'};
    }
    .lead {
      max-width: 560px;
      margin: 0;
      color: var(--muted);
      font-size: 19px;
      line-height: 1.68;
    }
    .actions {
      margin-top: 34px;
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
    }
    .actions a:last-child {
      background: var(--secondary-bg);
      color: var(--ink);
      border: 1px solid var(--hairline);
    }
    .visual-grid {
      min-height: var(--visual-min);
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: repeat(6, minmax(0, 1fr));
      gap: 16px;
    }
    .hero-panel {
      position: relative;
      border-radius: calc(var(--radius) + 8px);
      border: 1px solid var(--hairline);
      box-shadow: ${isCaregloStyle ? '0 30px 70px rgba(0, 0, 0, .34)' : '0 28px 70px rgba(15, 23, 42, .12)'};
      overflow: hidden;
    }
    .photo-frame img {
      width: 100%;
      height: 100%;
      min-height: inherit;
      object-fit: cover;
      filter: saturate(1.08) contrast(1.03);
    }
    .photo-frame::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 30% 20%, rgba(255,255,255,.34), transparent 24%),
        linear-gradient(180deg, transparent 42%, color-mix(in srgb, var(--ink), transparent 42%));
      mix-blend-mode: soft-light;
    }
    .main-visual {
      grid-column: 1 / span 4;
      grid-row: 1 / span 5;
      background: ${isCaregloStyle ? '#191d25' : 'color-mix(in srgb, var(--ink), var(--accent-2) 26%)'};
    }
    .booking-card {
      grid-column: 4 / span 3;
      grid-row: 4 / span 3;
      padding: 28px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .booking-card span { color: var(--accent-2); font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
    .booking-card strong { display: block; margin-top: 14px; font-size: 30px; line-height: 1.04; }
    .mini-visual {
      grid-column: 5 / span 2;
      grid-row: 1 / span 2;
      background: color-mix(in srgb, var(--panel), var(--accent) 16%);
    }
    .score-card {
      grid-column: 1 / span 3;
      grid-row: 6 / span 1;
      padding: 20px 22px;
      background: ${isCaregloStyle ? '#090b0f' : 'var(--ink)'};
      color: ${isCaregloStyle ? 'var(--ink)' : 'white'};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
    }
    .score-card strong { font-size: 24px; line-height: 1; }
    .score-card span { color: ${isCaregloStyle ? 'color-mix(in srgb, var(--ink), transparent 34%)' : 'color-mix(in srgb, white, transparent 32%)'}; }
    .stats {
      width: min(var(--max), calc(100vw - 40px));
      margin: 12px auto 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .stat {
      padding: 24px 26px;
      border-radius: var(--radius);
      background: var(--surface);
      border: 1px solid ${isCaregloStyle ? 'rgba(255,255,255,.08)' : 'color-mix(in srgb, var(--ink), transparent 90%)'};
    }
    .stat strong { display: block; font-size: 42px; line-height: 1; }
    .stat span { display: block; margin-top: 8px; color: var(--muted); }
    .service-strip {
      width: min(var(--max), calc(100vw - 40px));
      margin: 82px auto 46px;
      padding: 34px;
      border-radius: calc(var(--radius) + 10px);
      background: var(--service-bg);
      color: var(--service-ink);
      display: grid;
      grid-template-columns: 1.08fr repeat(3, minmax(0, 1fr));
      gap: 18px;
      align-items: stretch;
    }
    .strip-intro {
      padding: 4px 16px 4px 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 34px;
    }
    .strip-intro h2 { margin: 0; font-size: clamp(30px, 3.8vw, 54px); line-height: 1; }
    .strip-intro p { margin: 0; color: color-mix(in srgb, var(--service-ink), transparent 34%); line-height: 1.6; }
    .service-card {
      min-height: ${isCaregloStyle ? '360px' : '330px'};
      padding: 24px;
      border-radius: var(--radius);
      background: ${isCaregloStyle ? '#191d25' : 'color-mix(in srgb, white, transparent 91%)'};
      border: 1px solid rgba(255,255,255,.12);
      overflow: hidden;
    }
    .service-card img {
      width: calc(100% + 48px);
      height: var(--service-photo-height);
      margin: -24px -24px 22px;
      object-fit: cover;
      opacity: .82;
    }
    .service-card span { color: var(--accent); font-weight: 900; }
    .service-card h3 { margin: 18px 0 12px; font-size: 25px; line-height: 1.05; }
    .service-card p { margin: 0; color: color-mix(in srgb, var(--service-ink), transparent 34%); line-height: 1.62; }
    ${careCss}
    @media (max-width: 900px) {
      .topbar { display: none; }
      .nav-links { display: none; }
      .hero {
        grid-template-columns: 1fr;
        min-height: auto;
        margin-top: 20px;
      }
      .visual-grid {
        min-height: 520px;
      }
      .stats {
        grid-template-columns: 1fr;
      }
      .service-strip {
        grid-template-columns: 1fr;
      }
      .service-card {
        min-height: 220px;
      }
    }
    @media (max-width: 560px) {
      .nav { min-height: 68px; }
      .brand { font-size: 18px; }
      .nav a { display: none; }
      h1 { font-size: 48px; }
      .lead { font-size: 17px; }
      .visual-grid {
        min-height: 620px;
        grid-template-columns: 1fr;
        grid-template-rows: auto;
      }
      .main-visual, .booking-card, .mini-visual, .score-card {
        grid-column: auto;
        grid-row: auto;
        min-height: 180px;
      }
      .main-visual { min-height: 280px; }
      .booking-card { min-height: 210px; }
      .score-card { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="topbar">
      <div class="topbar-inner">
        <span>${escapeHtml(topbarLeft)}</span>
        <span>${escapeHtml(topbarRight)}</span>
      </div>
    </div>
    <nav class="nav">
      <div class="brand"><span class="mark"></span><span>${escapeHtml(archetype.brand)}</span></div>
      <div class="nav-links">${navLinks.map((link) => `<span>${escapeHtml(link)}</span>`).join('')}</div>
      <a href="#">Contact</a>
    </nav>
    <section class="hero">
      <div class="copy">
        <span class="eyebrow">${escapeHtml(archetype.eyebrow)}</span>
        <h1>${escapeHtml(archetype.title)}</h1>
        <p class="lead">${escapeHtml(archetype.body)}</p>
        <div class="actions">
          <a href="#">${escapeHtml(archetype.cta)}</a>
          <a href="#">${escapeHtml(archetype.secondaryCta)}</a>
        </div>
      </div>
      <div class="visual-grid">
        <div class="hero-panel main-visual photo-frame" aria-hidden="true">
          <img src="${escapeHtml(archetype.heroImage)}" alt="" loading="eager">
        </div>
        <div class="hero-panel mini-visual photo-frame" aria-hidden="true">
          <img src="${escapeHtml(archetype.detailImage)}" alt="" loading="lazy">
        </div>
        <article class="hero-panel booking-card">
          <div>
            <span>${escapeHtml(bookingLabel)}</span>
            <strong>${escapeHtml(bookingTitle)}</strong>
          </div>
          <a class="service-cta" href="#">${escapeHtml(bookingCta)}</a>
        </article>
        <div class="hero-panel score-card">
          <strong>4.9/5</strong>
          <span>${escapeHtml(scoreText)}</span>
        </div>
      </div>
    </section>
    <section class="stats">${stats}
    </section>
    <section class="service-strip">
      <div class="strip-intro">
        <div>
          <span class="eyebrow">Service menu</span>
          <h2>${escapeHtml(stripTitle)}</h2>
        </div>
        <p>${stripBody}</p>
      </div>${serviceCards}
    </section>
    ${careStorySections}
  </main>
</body>
</html>
`;

  return { html, manifest };
}

function cardCopy(index) {
  const copy = [
    'Thoughtful details and clear priorities make every step feel considered from the start.',
    'Expert guidance brings each choice together with confidence, care, and lasting value.',
    'A focused experience shaped around real needs, dependable service, and a clear next step.',
  ];
  return copy[index % copy.length];
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function captureTargetScreenshots(options, targetHtmlPath, onProgress) {
  const screenshots = [];
  const targetUrl = pathToFileURL(targetHtmlPath).href;

  for (const viewport of options.viewports) {
    const filename = `target-${viewport.label}.png`;
    await captureTargetScreenshotViewport(options, targetUrl, viewport, filename);

    screenshots.push({
      label: viewport.label,
      width: viewport.width,
      height: viewport.height,
      mode: options.fullPage ? 'full-page' : 'viewport',
      file: filename,
    });
    if (typeof onProgress === 'function') {
      onProgress(screenshots.slice());
    }
  }

  return screenshots;
}

async function captureTargetScreenshotViewport(options, targetUrl, viewport, file) {
  const outputPath = path.join(options.outDir, file);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-target-screenshot-'));
  const scriptFile = path.join(tempDir, 'capture-screenshot.js');
  const timeoutMs = captureViewportTimeoutMs(options, viewport);

  fs.writeFileSync(scriptFile, targetScreenshotCaptureScript());

  try {
    const result = await runBoundedProcess(resolveNpxExecutable(), ['--yes', '-p', options.playwrightPackage, 'node', scriptFile], {
      timeoutMs,
      env: {
        ...process.env,
        MONTEBY_TARGET_SCREENSHOT_URL: targetUrl,
        MONTEBY_TARGET_SCREENSHOT_OUT: outputPath,
        MONTEBY_TARGET_SCREENSHOT_WIDTH: String(viewport.width),
        MONTEBY_TARGET_SCREENSHOT_HEIGHT: String(viewport.height),
        MONTEBY_TARGET_SCREENSHOT_WAIT_MS: String(options.waitMs),
        MONTEBY_TARGET_SCREENSHOT_CHANNEL: options.channel,
        MONTEBY_TARGET_SCREENSHOT_FULL_PAGE: options.fullPage ? '1' : '',
      },
    });

    if (result.timedOut) {
      const error = new Error(`[generated_target_viewport_timeout] Generated fallback screenshot capture timed out after ${timeoutMs}ms for ${viewport.label}; browser process-tree termination was requested.`);
      error.code = 'generated_target_viewport_timeout';
      error.viewport = viewport.label;
      error.timeoutMs = timeoutMs;
      error.artifact = fileExistsWithContent(outputPath) ? file : '';
      error.terminationAttempted = result.terminationAttempted;
      error.forceKillSent = result.forceKillSent;
      throw error;
    }

    if (result.status !== 0) {
      const error = new Error(`[generated_target_viewport_failed] Playwright screenshot failed for ${viewport.label}: ${result.stderr || result.stdout}`);
      error.code = 'generated_target_viewport_failed';
      error.viewport = viewport.label;
      error.timeoutMs = timeoutMs;
      error.artifact = fileExistsWithContent(outputPath) ? file : '';
      throw error;
    }

    if (!fileExistsWithContent(outputPath)) {
      const error = new Error(`[generated_target_screenshot_missing] Playwright screenshot did not create ${file}.`);
      error.code = 'generated_target_screenshot_missing';
      error.viewport = viewport.label;
      error.timeoutMs = timeoutMs;
      error.artifact = '';
      throw error;
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function fileExistsWithContent(file) {
  try {
    return fs.statSync(file).size > 0;
  } catch (error) {
    return false;
  }
}

function targetScreenshotCaptureScript() {
  return `
'use strict';

const path = require('path');

const { chromium } = loadPlaywright();

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (directError) {
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const binPaths = String(process.env.PATH || '').split(delimiter);
    let pathErrorMessage = '';
    for (const binPath of binPaths) {
      const nodeModulesPath = path.dirname(binPath);
      if (path.basename(binPath) !== '.bin' || path.basename(nodeModulesPath) !== 'node_modules') {
        continue;
      }
      try {
        return require(path.join(nodeModulesPath, 'playwright'));
      } catch (pathError) {
        pathErrorMessage = pathError instanceof Error ? pathError.message : String(pathError);
      }
    }
    const directMessage = directError instanceof Error ? directError.message : String(directError);
    const suffix = pathErrorMessage ? \` Last PATH lookup error: \${pathErrorMessage}\` : '';
    throw new Error(\`\${directMessage}. Could not resolve playwright from npx/npm PATH.\${suffix}\`);
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.MONTEBY_TARGET_SCREENSHOT_CHANNEL || undefined,
  });
  const page = await browser.newPage({
    viewport: {
      width: Number(process.env.MONTEBY_TARGET_SCREENSHOT_WIDTH || '1440'),
      height: Number(process.env.MONTEBY_TARGET_SCREENSHOT_HEIGHT || '1200'),
    },
  });
  await page.goto(process.env.MONTEBY_TARGET_SCREENSHOT_URL, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  const waitMs = Number(process.env.MONTEBY_TARGET_SCREENSHOT_WAIT_MS || '0');
  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }
  await warmLazyMedia(page);
  await waitForVisualMedia(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  await waitForVisualMedia(page);
  await page.screenshot({
    path: process.env.MONTEBY_TARGET_SCREENSHOT_OUT,
    fullPage: process.env.MONTEBY_TARGET_SCREENSHOT_FULL_PAGE === '1',
  });
  await browser.close();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function warmLazyMedia(page) {
  const viewportHeight = Number(process.env.MONTEBY_TARGET_SCREENSHOT_HEIGHT || '1200');
  const scrollHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const step = Math.max(400, Math.round(viewportHeight * 0.8));
  const maxScrollHeight = Math.min(scrollHeight, 12000);
  for (let y = 0; y < maxScrollHeight; y += step) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(80);
  }
}

async function waitForVisualMedia(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.evaluate(async () => {
    const visibleImages = Array.from(document.images).filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = window.getComputedStyle(image);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    await Promise.all(visibleImages.map((image) => new Promise((resolve) => {
      if (image.complete && image.naturalWidth > 0) {
        resolve();
        return;
      }
      const done = () => resolve();
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
      setTimeout(done, 5000);
    })));
    await Promise.all(visibleImages.map((image) => (
      typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve()
    )));

    const backgroundUrls = new Set();
    for (const element of Array.from(document.querySelectorAll('*'))) {
      const value = window.getComputedStyle(element).backgroundImage || '';
      const matches = value.matchAll(/url\\(["']?([^"')]+)["']?\\)/g);
      for (const match of matches) {
        if (match[1]) {
          backgroundUrls.add(new URL(match[1], document.baseURI).href);
        }
      }
      if (backgroundUrls.size >= 80) {
        break;
      }
    }

    await Promise.all(Array.from(backgroundUrls).map((url) => new Promise((resolve) => {
      const image = new Image();
      const done = () => resolve();
      image.onload = done;
      image.onerror = done;
      image.src = url;
      if (image.complete) {
        done();
      }
      setTimeout(done, 5000);
    })));
  });
}
`;
}

function writeTargetManifest(file, manifest) {
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = buildTarget(options.seed, options.variant, options.archetype);
  target.manifest.sourceOwnership = 'generated';
  target.manifest.preserveSourceText = true;
  target.manifest.reuseSourceMedia = true;
  const targetHtmlPath = path.join(options.outDir, 'target.html');
  const targetManifestPath = path.join(options.outDir, 'target-manifest.json');

  fs.mkdirSync(options.outDir, { recursive: true });
  fs.writeFileSync(targetHtmlPath, target.html);

  if (options.captureScreenshots) {
    target.manifest.screenshots = [];
    target.manifest.captureStatus = 'in-progress';
    writeTargetManifest(targetManifestPath, target.manifest);

    try {
      target.manifest.screenshots = await captureTargetScreenshots(options, targetHtmlPath, (screenshots) => {
        target.manifest.screenshots = screenshots;
        writeTargetManifest(targetManifestPath, target.manifest);
      });
      target.manifest.captureStatus = 'complete';
    } catch (error) {
      target.manifest.captureStatus = 'partial';
      target.manifest.captureFailure = {
        code: error?.code || 'generated_target_capture_failed',
        message: error instanceof Error ? error.message : String(error),
        viewport: typeof error?.viewport === 'string' ? error.viewport : '',
        timeoutMs: Number.isInteger(error?.timeoutMs) ? error.timeoutMs : 0,
        artifact: typeof error?.artifact === 'string' ? error.artifact : '',
        terminationAttempted: error?.terminationAttempted === true,
        forceKillSent: error?.forceKillSent === true,
      };
      writeTargetManifest(targetManifestPath, target.manifest);
      throw error;
    }
  }

  writeTargetManifest(targetManifestPath, target.manifest);

  console.log(`target_html=${targetHtmlPath}`);
  console.log(`target_manifest=${targetManifestPath}`);
  for (const screenshot of target.manifest.screenshots || []) {
    console.log(`target_${screenshot.label}=${path.join(options.outDir, screenshot.file)}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
