#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const options = {
    targetDir: '',
    manifest: '',
    html: '',
    out: '',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target-dir') {
      options.targetDir = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--manifest') {
      options.manifest = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--html') {
      options.html = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--out') {
      options.out = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.targetDir && !options.manifest) {
    throw new Error('--target-dir or --manifest is required');
  }

  if (!options.manifest) {
    options.manifest = path.join(options.targetDir, 'target-manifest.json');
  }

  if (!options.html) {
    options.html = path.join(options.targetDir || path.dirname(options.manifest), 'target.html');
  }

  if (!options.out) {
    options.out = path.join(options.targetDir || path.dirname(options.manifest), 'VISUAL-BRIEF.md');
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
  write-visual-brief.js (--target-dir dir | --manifest target-manifest.json) [--html target.html] [--out VISUAL-BRIEF.md] [--json]

Writes a visual authoring brief from a generated target. The brief is measurement guidance only; do not convert HTML into Monteby JSON.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildBrief(manifest, html, files) {
  const css = extractStyleText(html);
  const text = extractTextHierarchy(html);
  const variables = extractRootVariables(css);
  const classes = extractClassNames(html);
  const sections = extractSectionClasses(html);
  const mediaSurfaces = Array.isArray(manifest.mediaSurfaces) ? manifest.mediaSurfaces : [];
  const renderedLayouts = readRenderedLayouts(manifest, files.manifest);
  const renderedLayout = renderedLayouts[0] || emptyRenderedLayout();
  const authoringRequirements = buildAuthoringRequirements(manifest, renderedLayouts, mediaSurfaces);

  return {
    generatedAt: new Date().toISOString(),
    files,
    target: {
      seed: manifest.seed || '',
      variant: manifest.variant || '',
      archetype: manifest.archetype || '',
      referenceStyle: manifest.referenceStyle || '',
      palette: manifest.palette || '',
      visualTargets: Array.isArray(manifest.visualTargets) ? manifest.visualTargets : [],
      screenshots: Array.isArray(manifest.screenshots) ? manifest.screenshots : [],
      sourceOwnership: manifest.sourceOwnership === 'generated' ? 'generated' : '',
      interactionPattern: normalizeInteractionPattern(manifest.interactionPattern),
      tabs: normalizeTabItems(manifest.tabs),
    },
    visualSignals: {
      rootVariables: variables,
      bodyFontFamily: extractCssDeclaration(css, 'body', 'font-family'),
      bodyBackground: extractCssDeclaration(css, 'body', 'background'),
      sections,
      classCount: classes.length,
      classNames: classes.slice(0, 80),
    },
    text,
    media: {
      surfaces: mediaSurfaces,
      requiredRoles: Array.isArray(manifest.requiredMediaRoles) ? manifest.requiredMediaRoles : [],
    },
    renderedLayout,
    renderedLayouts,
    authoringRequirements,
    authoringChecklist: [
      'Fetch the live Monteby contract before authoring.',
      'Use Section for root-level bands and Container for layout groups.',
      'Preserve first-viewport media roles before tuning smaller card imagery.',
      'Map headings, badges, CTA labels, stats, and logo strips to contract-backed widgets.',
      'Use only aiProps/control-backed props; never use className, raw HTML, raw CSS, or utility strings.',
      'Run audit-monteby-layout.js before REST validation and screenshot comparison.',
    ],
  };
}

function normalizeInteractionPattern(pattern) {
  if (!pattern || pattern.type !== 'tabs') {
    return null;
  }

  const itemCount = Number(pattern.itemCount);
  const defaultActiveTab = Number(pattern.defaultActiveTab);
  return {
    type: 'tabs',
    itemCount: Number.isInteger(itemCount) ? Math.max(1, Math.min(12, itemCount)) : 1,
    defaultActiveTab: Number.isInteger(defaultActiveTab) ? Math.max(0, Math.min(11, defaultActiveTab)) : 0,
    orientation: pattern.orientation === 'vertical' ? 'vertical' : 'horizontal',
    mobileTabLayout: ['scroll', 'wrap', 'stack'].includes(pattern.mobileTabLayout)
      ? pattern.mobileTabLayout
      : 'scroll',
  };
}

function normalizeTabItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.slice(0, 12).map((item) => ({
    labelPrefix: normalizeText(item?.labelPrefix).slice(0, 80),
    label: normalizeText(item?.label).slice(0, 120),
    labelSuffix: normalizeText(item?.labelSuffix).slice(0, 80),
    eyebrow: normalizeText(item?.eyebrow).slice(0, 160),
    title: normalizeText(item?.title).slice(0, 240),
    content: normalizeText(item?.content).slice(0, 1200),
    image: String(item?.image || '').trim().slice(0, 4096),
    imageAlt: normalizeText(item?.imageAlt).slice(0, 240),
    ctaLabel: normalizeText(item?.ctaLabel).slice(0, 120),
    ctaUrl: String(item?.ctaUrl || '').trim().slice(0, 2048),
  })).filter((item) => item.label !== '');
}

function buildAuthoringRequirements(manifest, renderedLayouts, mediaSurfaces) {
  const primaryLayout = firstOkLayout(renderedLayouts);
  const firstViewportMediaCoverage = numberOrNull(
    Number.isFinite(manifest.firstViewportMediaCoverage)
      ? manifest.firstViewportMediaCoverage
      : primaryLayout.summary.firstViewportMediaCoverage
  );

  return {
    preserveSourceText: manifest.sourceOwnership === 'generated' && manifest.preserveSourceText === true,
    reuseSourceMedia: manifest.sourceOwnership === 'generated' && manifest.reuseSourceMedia === true,
    requiredMediaRoles: normalizedRequiredMediaRoles(manifest.requiredMediaRoles, mediaSurfaces),
    firstViewportMediaCoverage: {
      sourceLayout: primaryLayout.label || 'primary',
      target: firstViewportMediaCoverage,
      minimumCandidate: minimumCandidateCoverage(firstViewportMediaCoverage),
    },
    viewportTargets: renderedLayouts
      .filter((layout) => layout.status === 'ok')
      .map(viewportRequirement),
    priorityMediaSamples: priorityMediaSamples(renderedLayouts),
    assetPolicy: manifest.sourceOwnership === 'generated' && manifest.reuseSourceMedia === true
      ? [
        'This target is generated and its declared media may be reused for deterministic visual comparison.',
        'Represent large photo areas with contract-backed ImageBlock or Section/Container background controls.',
      ]
      : [
        'Use replacement, licensed, generated, neutral, or user-provided assets.',
        'Do not reuse captured template-demo media URLs in authored Monteby JSON.',
        'Represent large photo areas with contract-backed ImageBlock or Section/Container background controls.',
      ],
  };
}

function firstOkLayout(renderedLayouts) {
  return renderedLayouts.find((layout) => layout.status === 'ok') || renderedLayouts[0] || emptyRenderedLayout();
}

function numberOrNull(value) {
  return Number.isFinite(value) ? roundRatio(value) : null;
}

function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}

function minimumCandidateCoverage(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return roundRatio(Math.max(value * 0.5, 0.12));
}

function normalizedRequiredMediaRoles(requiredRoles, mediaSurfaces) {
  if (Array.isArray(requiredRoles) && requiredRoles.length > 0) {
    return requiredRoles
      .map(normalizeRequiredMediaRole)
      .filter((role) => role.role);
  }

  const counts = mediaRoleCounts(mediaSurfaces);
  return ['hero', 'secondary', 'service-card']
    .filter((role) => Number.isFinite(counts[role]) && counts[role] > 0)
    .map((role) => ({
      role,
      minSurfaces: counts[role],
      placement: role === 'service-card' ? 'afterHero' : 'firstViewport',
      description: '',
    }));
}

function normalizeRequiredMediaRole(role) {
  if (!role || typeof role !== 'object' || Array.isArray(role)) {
    return {
      role: '',
      minSurfaces: 1,
      placement: '',
      description: '',
    };
  }

  return {
    role: typeof role.role === 'string' ? role.role.trim() : '',
    minSurfaces: Number.isFinite(role.minSurfaces) && role.minSurfaces > 0 ? role.minSurfaces : 1,
    placement: typeof role.placement === 'string' ? role.placement.trim() : '',
    description: typeof role.description === 'string' ? role.description.trim() : '',
  };
}

function mediaRoleCounts(mediaSurfaces) {
  if (!Array.isArray(mediaSurfaces)) {
    return {};
  }

  return mediaSurfaces.reduce((counts, surface) => {
    const role = typeof surface?.role === 'string' ? surface.role.trim() : '';
    if (role) {
      counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
  }, {});
}

function viewportRequirement(layout) {
  const summary = layout.summary || {};
  const viewport = layout.viewport || {};

  return {
    label: layout.label || '',
    width: Number.isFinite(viewport.width) ? viewport.width : 0,
    height: Number.isFinite(viewport.height) ? viewport.height : 0,
    scrollHeight: Number.isFinite(viewport.scrollHeight) ? viewport.scrollHeight : 0,
    firstViewportTextBoxes: Number.isFinite(summary.firstViewportTextBoxes) ? summary.firstViewportTextBoxes : null,
    firstViewportMediaBoxes: Number.isFinite(summary.firstViewportMediaBoxes) ? summary.firstViewportMediaBoxes : null,
    firstViewportMediaCoverage: numberOrNull(summary.firstViewportMediaCoverage),
  };
}

function priorityMediaSamples(renderedLayouts) {
  return renderedLayouts
    .flatMap((layout) => layout.mediaSamples.map((sample) => ({
      layout: layout.label || '',
      tag: sample.tag,
      source: sample.source,
      rect: sample.rect,
      firstViewportArea: Number.isFinite(sample.firstViewportArea) ? sample.firstViewportArea : 0,
    })))
    .filter((sample) => sample.firstViewportArea > 0)
    .sort((a, b) => b.firstViewportArea - a.firstViewportArea)
    .slice(0, 8);
}

function readRenderedLayouts(manifest, manifestPath) {
  const entries = renderedLayoutEntries(manifest);
  if (entries.length === 0) {
    return [emptyRenderedLayout()];
  }

  return entries.map((entry) => readRenderedLayout(entry, manifestPath));
}

function renderedLayoutEntries(manifest) {
  const layouts = Array.isArray(manifest?.layouts) && manifest.layouts.length > 0
    ? manifest.layouts
    : Array.isArray(manifest?.layoutCapture?.layouts) && manifest.layoutCapture.layouts.length > 0
      ? manifest.layoutCapture.layouts
      : [];

  if (layouts.length > 0) {
    return layouts.map((layout) => ({
      label: typeof layout?.label === 'string' ? layout.label.trim() : '',
      file: typeof layout?.file === 'string' ? layout.file.trim() : '',
    })).filter((layout) => layout.file);
  }

  const layoutFile = typeof manifest.layout === 'string' ? manifest.layout.trim() : '';
  return layoutFile ? [{ label: 'primary', file: layoutFile }] : [];
}

function readRenderedLayout(entry, manifestPath) {
  const resolved = path.resolve(path.dirname(path.resolve(manifestPath)), entry.file);
  if (!fs.existsSync(resolved)) {
    return {
      status: 'missing',
      label: entry.label || '',
      file: resolved,
      summary: {},
      viewport: {},
      textSamples: [],
      mediaSamples: [],
    };
  }

  const layout = readJson(resolved);
  return {
    status: 'ok',
    label: entry.label || '',
    file: resolved,
    summary: layout.summary && typeof layout.summary === 'object' && !Array.isArray(layout.summary) ? layout.summary : {},
    viewport: layout.viewport && typeof layout.viewport === 'object' && !Array.isArray(layout.viewport) ? layout.viewport : {},
    textSamples: Array.isArray(layout.textBoxes) ? layout.textBoxes.slice(0, 12).map(simplifyTextBox) : [],
    mediaSamples: Array.isArray(layout.mediaBoxes) ? layout.mediaBoxes.slice(0, 12).map(simplifyMediaBox) : [],
  };
}

function emptyRenderedLayout() {
  return {
    status: 'missing',
    label: '',
    file: '',
    summary: {},
    viewport: {},
    textSamples: [],
    mediaSamples: [],
  };
}

function simplifyTextBox(box) {
  return {
    tag: box?.tag || 'text',
    text: normalizeText(box?.text || ''),
    rect: simplifyRect(box?.rect || {}),
    fontSize: box?.fontSize || '',
    fontWeight: box?.fontWeight || '',
  };
}

function simplifyMediaBox(box) {
  return {
    tag: box?.tag || 'media',
    source: box?.source || box?.backgroundImage || '',
    rect: simplifyRect(box?.rect || {}),
    firstViewportArea: Number.isFinite(box?.firstViewportArea) ? box.firstViewportArea : 0,
    objectFit: box?.objectFit || '',
    backgroundSize: box?.backgroundSize || '',
  };
}

function simplifyRect(rect) {
  return {
    x: roundNumber(rect.x),
    y: roundNumber(rect.y),
    width: roundNumber(rect.width),
    height: roundNumber(rect.height),
    top: roundNumber(rect.top),
  };
}

function roundNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function extractStyleText(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join('\n');
}

function extractTextHierarchy(html) {
  return {
    title: firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
    h1: tagTexts(html, 'h1'),
    h2: tagTexts(html, 'h2'),
    h3: tagTexts(html, 'h3'),
    ctas: anchorTexts(html).slice(0, 12),
    stats: statTexts(html).slice(0, 12),
  };
}

function firstMatch(input, pattern) {
  const match = input.match(pattern);
  return match ? normalizeText(match[1]) : '';
}

function tagTexts(html, tag) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return [...html.matchAll(pattern)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)
    .slice(0, 20);
}

function anchorTexts(html) {
  return [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean);
}

function statTexts(html) {
  return [...html.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>\s*<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => `${normalizeText(match[1])} ${normalizeText(match[2])}`.trim())
    .filter(Boolean);
}

function extractRootVariables(css) {
  const match = css.match(/:root\s*\{([\s\S]*?)\}/i);
  if (!match) {
    return {};
  }

  const variables = {};
  for (const declaration of match[1].split(';')) {
    const variableMatch = declaration.match(/(--[a-z0-9-]+)\s*:\s*(.+)$/i);
    if (variableMatch) {
      variables[variableMatch[1]] = variableMatch[2].trim();
    }
  }

  return variables;
}

function extractCssDeclaration(css, selector, property) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockPattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'i');
  const block = css.match(blockPattern);
  if (!block) {
    return '';
  }

  const propertyPattern = new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`, 'i');
  const declaration = block[1].match(propertyPattern);
  return declaration ? declaration[1].trim() : '';
}

function extractClassNames(html) {
  const classNames = [];
  for (const match of html.matchAll(/\bclass=["']([^"']+)["']/gi)) {
    classNames.push(...match[1].split(/\s+/).map((item) => item.trim()).filter(Boolean));
  }

  return [...new Set(classNames)];
}

function extractSectionClasses(html) {
  return [...html.matchAll(/<(section|nav|header|footer|main)\b([^>]*)>/gi)]
    .map((match) => {
      const classMatch = match[2].match(/\bclass=["']([^"']+)["']/i);
      return {
        tag: match[1].toLowerCase(),
        className: classMatch ? classMatch[1].trim() : '',
      };
    })
    .filter((item) => item.className)
    .slice(0, 30);
}

function normalizeText(value) {
  return decodeEntities(stripTags(value))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, ' ');
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_entity, code) => entityFromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_entity, code) => entityFromCodePoint(Number.parseInt(code, 10)));
}

function entityFromCodePoint(codePoint) {
  if (!Number.isInteger(codePoint) || codePoint < 0) {
    return '';
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch (error) {
    return '';
  }
}

function renderMarkdown(brief) {
  const lines = [
    '# Monteby Visual Authoring Brief',
    '',
    `- Target: ${brief.target.variant || 'unknown'} / ${brief.target.archetype || 'unknown'}`,
    `- Reference style: ${brief.target.referenceStyle || 'n/a'}`,
    `- Palette: ${brief.target.palette || 'n/a'}`,
    `- Target manifest: \`${brief.files.manifest}\``,
    `- Target HTML: \`${brief.files.html}\``,
    '',
    '## First-Pass Structure',
    '',
  ];

  appendList(lines, brief.visualSignals.sections.map((section) => `${section.tag}.${section.className.replace(/\s+/g, '.')}`), 'No named sections detected.');

  lines.push('', '## Text Hierarchy', '');
  appendNamedList(lines, 'H1', brief.text.h1);
  appendNamedList(lines, 'H2', brief.text.h2.slice(0, 8));
  appendNamedList(lines, 'H3', brief.text.h3.slice(0, 10));
  appendNamedList(lines, 'CTA', brief.text.ctas);
  appendNamedList(lines, 'Stats', brief.text.stats);

  lines.push('', '## Media Roles', '');
  if (brief.media.surfaces.length === 0) {
    lines.push('- None');
  } else {
    for (const surface of brief.media.surfaces) {
      lines.push(`- ${surface.role || 'media'} / ${surface.placement || 'unknown'}: ${surface.source || ''}`);
    }
  }

  lines.push('', '## Rendered Layout Snapshot', '');
  if (brief.renderedLayout.status === 'ok') {
    lines.push(`- Layout JSON: \`${brief.renderedLayout.file}\``);
    lines.push(`- Viewport: ${brief.renderedLayout.viewport.width || 0}x${brief.renderedLayout.viewport.height || 0}, scroll height ${brief.renderedLayout.viewport.scrollHeight || 0}`);
    lines.push(`- First-viewport text boxes: ${brief.renderedLayout.summary.firstViewportTextBoxes ?? 'n/a'}`);
    lines.push(`- First-viewport media boxes: ${brief.renderedLayout.summary.firstViewportMediaBoxes ?? 'n/a'}`);
    lines.push(`- First-viewport media coverage: ${formatPercentRatio(brief.renderedLayout.summary.firstViewportMediaCoverage)}`);
    appendList(lines, brief.renderedLayout.textSamples.slice(0, 6).map(formatTextSample), 'No text boxes captured.');
    appendList(lines, brief.renderedLayout.mediaSamples.slice(0, 6).map(formatMediaSample), 'No media boxes captured.');
    appendRenderedLayoutViewportSummaries(lines, brief.renderedLayouts);
  } else {
    lines.push('- Not captured. Run `start-visual-benchmark.js` so `target-layout.json` is generated.');
  }

  appendAuthoringRequirements(lines, brief.authoringRequirements);

  lines.push('', '## Visual Tokens', '');
  const variables = Object.entries(brief.visualSignals.rootVariables);
  if (variables.length === 0) {
    lines.push('- No root variables detected.');
  } else {
    for (const [name, value] of variables.slice(0, 20)) {
      lines.push(`- \`${name}\`: \`${value}\``);
    }
  }

  lines.push('', '## Monteby Authoring Checklist', '');
  appendList(lines, brief.authoringChecklist, 'No checklist items.');

  return `${lines.join('\n')}\n`;
}

function appendAuthoringRequirements(lines, requirements) {
  lines.push('', '## Monteby Authoring Requirements', '');
  const coverage = requirements.firstViewportMediaCoverage || {};
  lines.push(`- Target media coverage source: ${coverage.sourceLayout || 'primary'}`);
  lines.push(`- Target first-viewport media coverage: ${formatPercentRatio(coverage.target)}`);
  lines.push(`- Candidate minimum media coverage: ${formatPercentRatio(coverage.minimumCandidate)}`);

  lines.push('- Required replacement media roles:');
  if (!Array.isArray(requirements.requiredMediaRoles) || requirements.requiredMediaRoles.length === 0) {
    lines.push('  - None detected.');
  } else {
    for (const role of requirements.requiredMediaRoles) {
      const placement = role.placement ? `, placement ${role.placement}` : '';
      lines.push(`  - ${role.role}: ${role.minSurfaces} replacement surface(s)${placement}`);
    }
  }

  lines.push('- Viewport targets:');
  if (!Array.isArray(requirements.viewportTargets) || requirements.viewportTargets.length === 0) {
    lines.push('  - None captured.');
  } else {
    for (const viewport of requirements.viewportTargets) {
      const label = viewport.label || `${viewport.width}x${viewport.height}`;
      lines.push(`  - ${label}: ${viewport.width}x${viewport.height}, text ${viewport.firstViewportTextBoxes ?? 'n/a'}, media ${viewport.firstViewportMediaBoxes ?? 'n/a'}, coverage ${formatPercentRatio(viewport.firstViewportMediaCoverage)}`);
    }
  }

  lines.push('- Priority first-viewport media boxes:');
  if (!Array.isArray(requirements.priorityMediaSamples) || requirements.priorityMediaSamples.length === 0) {
    lines.push('  - None captured.');
  } else {
    for (const sample of requirements.priorityMediaSamples.slice(0, 5)) {
      const label = sample.layout ? `${sample.layout} ` : '';
      lines.push(`  - ${label}${sample.tag} @ ${formatRect(sample.rect)} area ${Math.round(sample.firstViewportArea)}`);
    }
  }

  lines.push('- Asset policy:');
  appendNestedList(lines, requirements.assetPolicy, 'No asset policy.');
}

function appendRenderedLayoutViewportSummaries(lines, renderedLayouts) {
  if (!Array.isArray(renderedLayouts) || renderedLayouts.length <= 1) {
    return;
  }

  lines.push('', '### Viewport Snapshot Summaries');
  for (const layout of renderedLayouts) {
    const viewport = layout.viewport || {};
    const summary = layout.summary || {};
    const label = layout.label || `${viewport.width || 0}x${viewport.height || 0}`;
    lines.push(`- ${label}: ${viewport.width || 0}x${viewport.height || 0}, media coverage ${formatPercentRatio(summary.firstViewportMediaCoverage)}, text ${summary.firstViewportTextBoxes ?? 'n/a'}, media ${summary.firstViewportMediaBoxes ?? 'n/a'}`);
  }
}

function formatTextSample(sample) {
  return `${sample.tag} @ ${formatRect(sample.rect)}: ${sample.text}`;
}

function formatMediaSample(sample) {
  return `${sample.tag} @ ${formatRect(sample.rect)}: ${sample.source}`;
}

function formatRect(rect) {
  return `${rect.x},${rect.y} ${rect.width}x${rect.height}`;
}

function formatPercentRatio(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'n/a';
}

function appendNamedList(lines, title, items) {
  lines.push(`- ${title}:`);
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('  - None');
    return;
  }

  for (const item of items) {
    lines.push(`  - ${item}`);
  }
}

function appendList(lines, items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    lines.push(`- ${emptyText}`);
    return;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }
}

function appendNestedList(lines, items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    lines.push(`  - ${emptyText}`);
    return;
  }

  for (const item of items) {
    lines.push(`  - ${item}`);
  }
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const manifest = readJson(options.manifest);
    const html = fs.readFileSync(options.html, 'utf8');
    const brief = buildBrief(manifest, html, {
      manifest: options.manifest,
      html: options.html,
      markdown: options.out,
    });

    writeFile(options.out, renderMarkdown(brief));
    if (options.json) {
      console.log(JSON.stringify(brief, null, 2));
    } else {
      console.log(`visual_brief=${options.out}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
