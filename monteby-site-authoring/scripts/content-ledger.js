'use strict';

const { createHash } = require('node:crypto');

const CONTENT_PROP_NAMES = new Set([
  'authorBio',
  'authorName',
  'body',
  'buttonText',
  'caption',
  'children',
  'content',
  'ctaLabel',
  'description',
  'eyebrow',
  'heading',
  'label',
  'labelPrefix',
  'labelSuffix',
  'quote',
  'role',
  'submitLabel',
  'subtitle',
  'text',
  'title',
]);

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&nbsp;/giu, '\u00a0')
    .replace(/&#x([0-9a-f]+);/giu, (_entity, code) => fromCodePoint(code, 16))
    .replace(/&#(\d+);/gu, (_entity, code) => fromCodePoint(code, 10));
}

function fromCodePoint(value, radix) {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isInteger(codePoint) || codePoint < 0) return '';
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
}

function normalizeContentText(value, literal = false) {
  return (literal ? String(value) : decodeEntities(String(value).replace(/<[^>]+>/gu, ' ')))
    .normalize('NFC')
    .replace(/[\t\n\f\r ]+/gu, ' ')
    .replace(/^ +| +$/gu, '');
}

function textSha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function buildContentLedger(entries, options = {}) {
  const grouped = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const semantic = options.semantic === true ? normalizeSemanticEntry(entry, options.viewUrl) : null;
    const text = semantic?.text ?? normalizeContentText(entry?.text);
    if (!text && !semantic) continue;
    const identity = semantic ? JSON.stringify(semantic) : text;
    const existing = grouped.get(identity) || {
      ...(semantic || {}),
      text,
      length: Array.from(text).length,
      sha256: textSha256(identity),
      count: 0,
      structureKeys: [],
    };
    existing.count += 1;
    const structureKey = String(entry?.structureKey || '').trim();
    if (structureKey && !existing.structureKeys.includes(structureKey)) {
      existing.structureKeys.push(structureKey);
    }
    grouped.set(identity, existing);
  }

  const items = [...grouped.values()].sort((left, right) => (
    left.structureKeys[0]?.localeCompare(right.structureKeys[0] || '')
      || left.sha256.localeCompare(right.sha256)
  ));
  return {
    schemaVersion: options.semantic === true ? 2 : 1,
    artifact: 'monteby-content-ledger',
    totalOccurrences: items.reduce((total, item) => total + item.count, 0),
    uniqueEntries: items.length,
    items,
  };
}

function normalizeSemanticEntry(entry, viewUrl) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.text !== 'string') throw new Error('Semantic content entry requires literal text');
  const kind = entry.kind ?? 'text';
  const role = entry.role ?? '';
  const roles = ['button', 'tab', 'switch', 'checkbox', 'radio', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'textbox', 'combobox', 'searchbox', 'slider', 'spinbutton'];
  if (!['text', 'link', 'control', 'alt', 'placeholder'].includes(kind)
      || typeof role !== 'string'
      || (kind === 'text' ? role !== '' && !/^h[1-6]$/u.test(role)
        : kind === 'control' ? !roles.includes(role) : role !== '')) {
    throw new Error('Unsupported semantic content kind or role');
  }
  const text = normalizeContentText(entry.text, true);
  const name = ['link', 'control'].includes(kind)
    ? normalizeContentText(entry.name ?? entry.text, true) : '';
  if (entry.name !== undefined && typeof entry.name !== 'string') throw new Error('Semantic name must be a string');
  if (!text && !name && kind !== 'alt') throw new Error('Semantic content entry must not be empty');
  if ((!['link', 'control'].includes(kind) && entry.name !== undefined)
      || (kind !== 'link' && entry.href !== undefined)) throw new Error('Unexpected semantic content attribute');
  let href = '';
  if (kind === 'link') {
    if (typeof entry.href !== 'string' || !entry.href || /[\u0000-\u0020\u007f]/u.test(entry.href)) {
      throw new Error('Semantic link requires a safe destination');
    }
    const url = new URL(entry.href, viewUrl);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Semantic link requires a safe destination');
    }
    href = url.href;
  }
  return { kind, role, text, name, href };
}

function captureSemanticContent(documentRef, viewUrl, region) {
  const roots = region === 'full-render' ? [documentRef.body]
    : region === 'page-content' ? Array.from(documentRef.querySelectorAll('main,[role="main"]')) : [];
  const report = { schemaVersion: 1, viewUrl, region, complete: true, entries: [], reasons: [] };
  if (roots.length !== 1 || !roots[0]) return { ...report, complete: false, reasons: ['ambiguous-content-root'] };
  const excluded = new Set(['script', 'style', 'template', 'noscript', 'svg', 'canvas']);
  const blocks = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'li', 'dt', 'dd', 'figcaption', 'legend', 'label', 'caption', 'td', 'th', 'option']);
  let visited = 0;
  let inspected = 0;
  let characters = 0;
  const tagOf = (node) => String(node?.tagName || '').toLowerCase();
  const attribute = (node, name) => String(node?.getAttribute?.(name) ?? '');
  const normalized = (text) => String(text ?? '').normalize('NFC').replace(/[\t\n\f\r ]+/gu, ' ').replace(/^ +| +$/gu, '');
  const omit = (node) => excluded.has(tagOf(node))
    || (['span', 'i'].includes(tagOf(node)) && attribute(node, 'aria-hidden') === 'true'
      && /(?:^|\s)material-(?:symbols|icons)(?:-[a-z]+)?(?:\s|$)/u.test(attribute(node, 'class')))
    || node?.hasAttribute?.('data-slider-clone') === true;
  const textOf = (node, depth = 0, alternatives = false) => {
    if (++inspected > 100000) { report.reasons.push('content-budget'); return ''; }
    if (depth > 128) { report.reasons.push('content-depth-limit'); return ''; }
    if (node?.nodeType === 3) return String(node.nodeValue || '');
    if (omit(node)) return '';
    if (alternatives && tagOf(node) === 'img') return attribute(node, 'alt');
    if (tagOf(node) === 'br') return ' ';
    return Array.from(node?.childNodes || []).map((child) => textOf(child, depth + 1, alternatives)).join('');
  };
  const nameOf = (node, text) => {
    const ids = attribute(node, 'aria-labelledby').split(/[\t\n\f\r ]+/u).filter(Boolean);
    if (ids.length) {
      const labels = ids.map((id) => documentRef.getElementById(id));
      if (labels.some((label) => !label)) report.reasons.push('unresolved-accessible-name');
      return normalized(labels.map((label) => textOf(label, 0, true)).join(' '));
    }
    return normalized(attribute(node, 'aria-label')
      || (node.labels?.length ? Array.from(node.labels).map((label) => textOf(label, 0, true)).join(' ') : '')
      || (['input', 'select', 'textarea'].includes(tagOf(node)) ? text : textOf(node, 0, true))
      || attribute(node, 'title'));
  };
  const add = (entry) => {
    characters += entry.text.length + (entry.name?.length || 0);
    if (report.entries.length >= 10000 || characters > 2 * 1024 * 1024) {
      report.reasons.push('content-budget');
      return;
    }
    report.entries.push(entry);
  };
  const visit = (node, key, consumed = false, depth = 0) => {
    if (depth > 128 || ++visited > 20000) { report.reasons.push('content-budget'); return; }
    if (['svg', 'canvas'].includes(tagOf(node)) && attribute(node, 'aria-hidden') !== 'true') {
      report.reasons.push('unsupported-embedded-content');
    }
    if (omit(node)) return;
    const tag = tagOf(node);
    if (tag === 'iframe' || node.shadowRoot) report.reasons.push('unsupported-embedded-content');
    const children = Array.from(node.children || []);
    const text = normalized(textOf(node));
    const declaredRole = attribute(node, 'role');
    const inputType = attribute(node, 'type').toLowerCase() || 'text';
    const controlRole = declaredRole || (tag === 'button' || tag === 'summary' ? 'button'
      : tag === 'select' ? 'combobox'
        : tag === 'textarea' ? 'textbox'
          : tag === 'input' ? ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', search: 'searchbox', submit: 'button', button: 'button', reset: 'button' }[inputType] || 'textbox') : '');
    const control = ['button', 'summary', 'select', 'textarea', 'input'].includes(tag)
      || ['button', 'tab', 'switch', 'checkbox', 'radio', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'textbox', 'combobox', 'searchbox', 'slider', 'spinbutton'].includes(declaredRole);
    const link = tag === 'a' && node.hasAttribute?.('href');
    if ((link && declaredRole && declaredRole !== 'link') || (declaredRole === 'link' && !link)) report.reasons.push('unsupported-link-role');
    if (link) {
      const name = nameOf(node, text);
      if (!name) report.reasons.push('unnamed-link');
      else add({ structureKey: `${key}:link`, kind: 'link', text, name, href: typeof node.href === 'string' ? node.href : attribute(node, 'href') });
    }
    else if (control && !(tag === 'input' && inputType === 'hidden')) {
      const visibleText = tag === 'input' && controlRole === 'button' ? attribute(node, 'value')
        : ['input', 'select', 'textarea'].includes(tag) ? '' : text;
      const name = nameOf(node, visibleText);
      if (!name) report.reasons.push('unnamed-control');
      else add({ structureKey: `${key}:control`, kind: 'control', role: controlRole, text: visibleText, name });
    }
    if (tag === 'img') {
      if (!node.hasAttribute?.('alt')) report.reasons.push('missing-image-alt');
      else add({ structureKey: `${key}:alt`, kind: 'alt', text: attribute(node, 'alt') });
    }
    if (['input', 'textarea'].includes(tag) && attribute(node, 'placeholder')) {
      add({ structureKey: `${key}:placeholder`, kind: 'placeholder', text: attribute(node, 'placeholder') });
    }
    const hasBlockDescendant = (element, level = 0) => {
      if (level > 128 || ++inspected > 100000) { report.reasons.push('content-budget'); return true; }
      return Array.from(element.children || []).some((child) => blocks.has(tagOf(child)) || hasBlockDescendant(child, level + 1));
    };
    let contentOwner = node;
    let ownerDepth = 0;
    while (!['a', 'button'].includes(tagOf(contentOwner)) && contentOwner.children?.length === 1 && ownerDepth++ < 128
        && !normalized(Array.from(contentOwner.childNodes || []).filter((child) => child.nodeType === 3).map((child) => child.nodeValue || '').join(''))) {
      contentOwner = contentOwner.children[0];
    }
    const interactiveOnly = contentOwner !== node && ['a', 'button'].includes(tagOf(contentOwner));
    const ownBlock = blocks.has(tag) && !hasBlockDescendant(node)
      && (!interactiveOnly || /^h[1-6]$/u.test(tag));
    const consumesText = !consumed && ownBlock && !link && !control;
    if (consumesText && text) add({ structureKey: `${key}:text`, kind: 'text', role: /^h[1-6]$/u.test(tag) ? tag : '', text });
    if (!consumed && !consumesText && !link && !control) {
      const direct = normalized(Array.from(node.childNodes || []).filter((child) => child.nodeType === 3).map((child) => child.nodeValue || '').join(''));
      if (direct) add({ structureKey: `${key}:direct`, kind: 'text', text: direct });
    }
    children.forEach((child, index) => visit(child, `${key}.${index}`, consumed || consumesText || (link && !hasBlockDescendant(node)) || (control && tag !== 'select'), depth + 1));
  };
  visit(roots[0], '0');
  report.reasons = [...new Set(report.reasons)];
  report.complete = report.reasons.length === 0;
  return report;
}

function mergeDirectTextEntries(contentEntries, directTextEntries) {
  const content = Array.isArray(contentEntries) ? contentEntries.filter(Boolean) : [];
  const coveredStructureKeys = new Set(content
    .map((entry) => String(entry?.structureKey || '').trim())
    .filter(Boolean));
  const seenDirectEntries = new Set();
  const direct = [];

  for (const entry of Array.isArray(directTextEntries) ? directTextEntries : []) {
    const structureKey = String(entry?.structureKey || '').trim();
    const text = normalizeContentText(entry?.text);
    if (!structureKey || !text || coveredStructureKeys.has(structureKey)) {
      continue;
    }

    const identity = `${structureKey}\0${text}`;
    if (seenDirectEntries.has(identity)) {
      continue;
    }
    seenDirectEntries.add(identity);
    direct.push(entry);
  }

  return content.concat(direct);
}

function nodeMapContentEntries(nodeMap) {
  const entries = [];
  for (const [nodeId, node] of Object.entries(nodeMap && typeof nodeMap === 'object' ? nodeMap : {})) {
    collectContentValues(node?.props, nodeId, 'props', entries);
  }
  const topLevelAliasKeys = new Set();
  return entries.filter((entry) => {
    const match = entry.structureKey.match(/^([^:]+):props\.(?:text|content|children)$/u);
    if (!match) return true;
    const aliasKey = `${match[1]}\0${entry.text}`;
    if (topLevelAliasKeys.has(aliasKey)) return false;
    topLevelAliasKeys.add(aliasKey);
    return true;
  });
}

function collectContentValues(value, nodeId, propPath, entries, propName = '') {
  if (typeof value === 'string') {
    if (CONTENT_PROP_NAMES.has(propName)) {
      entries.push({ text: value, structureKey: `${nodeId}:${propPath}` });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectContentValues(item, nodeId, `${propPath}[${index}]`, entries, propName));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    collectContentValues(item, nodeId, `${propPath}.${key}`, entries, key);
  }
}

function compareContentLedgers(expectedLedger, candidateLedger) {
  const actualByHash = new Map(
    (Array.isArray(candidateLedger?.items) ? candidateLedger.items : [])
      .map((item) => [String(item.sha256 || ''), item])
  );
  const candidateItems = Array.isArray(candidateLedger?.items) ? candidateLedger.items : [];
  const result = {
    matched: [],
    missing: [],
    truncatedOrChanged: [],
    duplicateCountMismatch: [],
    added: [],
  };
  const changedCandidateHashes = new Set();

  for (const expected of Array.isArray(expectedLedger?.items) ? expectedLedger.items : []) {
    const actual = actualByHash.get(String(expected.sha256 || ''));
    if (actual && Number(actual.count) === Number(expected.count)) {
      result.matched.push(expected);
      continue;
    }
    if (actual) {
      result.duplicateCountMismatch.push({
        ...expected,
        actualCount: Number(actual.count) || 0,
      });
      continue;
    }
    const changed = closestChangedEntry(expected, candidateItems);
    if (changed) {
      changedCandidateHashes.add(String(changed.sha256 || ''));
      result.truncatedOrChanged.push({
        ...expected,
        actualText: changed.text,
        actualSha256: changed.sha256,
      });
    } else {
      result.missing.push(expected);
    }
  }

  const expectedHashes = new Set(
    (Array.isArray(expectedLedger?.items) ? expectedLedger.items : [])
      .map((item) => String(item.sha256 || ''))
  );
  result.added = candidateItems.filter((item) => {
    const hash = String(item.sha256 || '');
    return !expectedHashes.has(hash) && !changedCandidateHashes.has(hash);
  });

  return {
    schemaVersion: 1,
    artifact: 'monteby-content-ledger-comparison',
    complete: result.missing.length === 0
      && result.truncatedOrChanged.length === 0
      && result.duplicateCountMismatch.length === 0
      && result.added.length === 0,
    expectedOccurrences: Number(expectedLedger?.totalOccurrences) || 0,
    candidateOccurrences: Number(candidateLedger?.totalOccurrences) || 0,
    ...result,
  };
}

function closestChangedEntry(expected, candidateItems) {
  const expectedText = String(expected?.text || '');
  if (!expectedText) return null;
  const minimumPrefix = Math.min(24, Math.max(8, Math.floor(expectedText.length * 0.25)));
  return candidateItems.find((candidate) => {
    const candidateText = String(candidate?.text || '');
    if (!candidateText) return false;
    const shorterLength = Math.min(expectedText.length, candidateText.length);
    if (shorterLength < minimumPrefix) return false;
    return expectedText.startsWith(candidateText) || candidateText.startsWith(expectedText);
  }) || null;
}

module.exports = {
  buildContentLedger,
  captureSemanticContent,
  compareContentLedgers,
  mergeDirectTextEntries,
  nodeMapContentEntries,
  normalizeContentText,
  normalizeSemanticEntry,
};
