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

function normalizeContentText(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/gu, ' '))
    .normalize('NFC')
    .replace(/[\t\n\f\r ]+/gu, ' ')
    .trim();
}

function textSha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function buildContentLedger(entries) {
  const grouped = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const text = normalizeContentText(entry?.text);
    if (!text) continue;
    const existing = grouped.get(text) || {
      text,
      length: Array.from(text).length,
      sha256: textSha256(text),
      count: 0,
      structureKeys: [],
    };
    existing.count += 1;
    const structureKey = String(entry?.structureKey || '').trim();
    if (structureKey && !existing.structureKeys.includes(structureKey)) {
      existing.structureKeys.push(structureKey);
    }
    grouped.set(text, existing);
  }

  const items = [...grouped.values()].sort((left, right) => (
    left.structureKeys[0]?.localeCompare(right.structureKeys[0] || '')
      || left.sha256.localeCompare(right.sha256)
  ));
  return {
    schemaVersion: 1,
    artifact: 'monteby-content-ledger',
    totalOccurrences: items.reduce((total, item) => total + item.count, 0),
    uniqueEntries: items.length,
    items,
  };
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
  compareContentLedgers,
  mergeDirectTextEntries,
  nodeMapContentEntries,
  normalizeContentText,
};
