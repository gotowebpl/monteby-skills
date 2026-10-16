#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  buildContentLedger,
  compareContentLedgers,
  normalizeSemanticEntry,
} = require('./content-ledger');
const { nodeMapSha256 } = require('./wordpress-layout-client');

const MAX_INPUT_BYTES = 5 * 1024 * 1024;

function parseArgs(argv) {
  const options = { clientDocument: '', liveManifest: '', out: '', prepare: false, sourceDocument: '', inventory: '', snapshot: '', region: '', label: '' };
  const names = { '--client-document': 'clientDocument', '--live-manifest': 'liveManifest', '--out': 'out', '--source-document': 'sourceDocument', '--inventory': 'inventory', '--snapshot': 'snapshot', '--region': 'region', '--label': 'label' };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--prepare') { options.prepare = true; continue; }
    if (!Object.hasOwn(names, option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    index += 1;
    options[names[option]] = ['--region', '--label'].includes(option) ? value : path.resolve(value);
  }
  if (options.prepare) {
    if (!options.sourceDocument || !options.inventory || !options.snapshot || !options.out
        || !['full-render', 'page-content'].includes(options.region) || !options.label.trim()
        || options.clientDocument || options.liveManifest) {
      throw new Error('--prepare requires --inventory, --source-document, --snapshot, --region, --label and --out only');
    }
  } else if (!options.clientDocument || !options.liveManifest || options.inventory || options.snapshot || options.region || options.label) {
    throw new Error('--client-document and --live-manifest are required');
  }
  return options;
}

function readJson(file, label, raw = false) {
  const stats = fs.statSync(file);
  if (!stats.isFile() || stats.size > MAX_INPUT_BYTES) {
    throw new Error(`${label} must be a JSON file no larger than ${MAX_INPUT_BYTES} bytes`);
  }
  const bytes = fs.readFileSync(file);
  return raw ? bytes : JSON.parse(bytes.toString('utf8'));
}

function clientDocumentEntries(document) {
  const allowedTopLevelKeys = document?.schemaVersion === 2
    ? ['schemaVersion', 'artifact', 'scope', 'source', 'entries']
    : ['schemaVersion', 'artifact', 'entries'];
  if (
    !document
    || typeof document !== 'object'
    || Array.isArray(document)
    || ![1, 2].includes(document.schemaVersion)
    || document.artifact !== 'monteby-client-content-document'
    || !Array.isArray(document.entries)
    || Object.keys(document).some((key) => !allowedTopLevelKeys.includes(key))
  ) {
    throw new Error('Client document must be a monteby-client-content-document v1 or v2 artifact');
  }
  const ids = new Set();
  if (document.entries.length === 0 || document.entries.length > 10000) throw new Error('Client document needs 1–10000 entries');
  const semantic = document.scope?.capture === 'semantic-dom-v1';
  return document.entries.map((entry, index) => {
    if (
      !entry
      || typeof entry !== 'object'
      || Array.isArray(entry)
      || typeof entry.id !== 'string'
      || !entry.id.trim()
      || typeof entry.text !== 'string'
      || (!semantic && !entry.text)
      || Object.keys(entry).some((key) => !(semantic ? ['id', 'text', 'kind', 'role', 'href', 'name'] : ['id', 'text']).includes(key))
    ) {
      throw new Error(`Client document entry ${index} must contain only non-empty id and text strings`);
    }
    const id = entry.id.trim();
    if (ids.has(id)) throw new Error(`Client document entry id must be unique: ${id}`);
    ids.add(id);
    if (semantic) normalizeSemanticEntry(entry, document.scope.viewUrl);
    const content = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'id'));
    return { structureKey: id, ...content };
  });
}

function canonicalClientSourceSha256(entries) {
  return createHash('sha256').update(JSON.stringify(entries.map(({ structureKey, ...entry }) => ({
    id: structureKey, ...entry,
  })))).digest('hex');
}

function validateSourceBinding(document, manifest, entries, sourceBytes) {
  if (document.schemaVersion !== 2) {
    return { sourceBound: false, scope: null, sourceSha256: '' };
  }
  const scope = document.scope;
  const source = document.source;
  if (
    !scope || typeof scope !== 'object' || Array.isArray(scope)
    || Object.keys(scope).some((key) => !['viewUrl', 'region', 'capture', 'pageId'].includes(key))
    || typeof scope.viewUrl !== 'string' || !/^https?:\/\//u.test(scope.viewUrl)
    || !['page-content', 'full-render'].includes(scope.region)
    || !source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).some((key) => !['label', 'sha256', 'documentSha256'].includes(key))
    || typeof source.label !== 'string' || !source.label.trim()
    || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(source.sha256)
  ) {
    throw new Error('Client document v2 requires closed scope and source bindings');
  }
  if (!normalizeBoundUrl(scope.viewUrl)) throw new Error('Client document scope.viewUrl must be a public HTTP URL');
  if (scope.capture !== undefined && scope.capture !== 'semantic-dom-v1') throw new Error('Unknown content capture method');
  if (scope.pageId !== undefined && (!Number.isSafeInteger(scope.pageId) || scope.pageId <= 0)) throw new Error('Invalid content page identity');
  const semantic = scope.capture === 'semantic-dom-v1';
  if (semantic && (!Number.isSafeInteger(scope.pageId) || !/^[a-f0-9]{64}$/u.test(source.documentSha256 || ''))) {
    throw new Error('Semantic document requires page identity and source.documentSha256');
  }
  if (source.documentSha256 !== undefined && (!Buffer.isBuffer(sourceBytes)
      || createHash('sha256').update(sourceBytes).digest('hex') !== source.documentSha256)) {
    throw new Error('Source document bytes do not match source.documentSha256');
  }
  const actualSourceSha256 = canonicalClientSourceSha256(entries);
  if (source.sha256 !== actualSourceSha256) {
    throw new Error('Client document source.sha256 does not match its ordered entries');
  }
  const manifestUrl = String(manifest?.sourceUrl || '');
  if (normalizeBoundUrl(scope.viewUrl) !== normalizeBoundUrl(manifestUrl)) {
    throw new Error('Live manifest sourceUrl does not match the client document scope.viewUrl');
  }
  if (manifest?.contentScope?.region !== scope.region
      || normalizeBoundUrl(manifest?.contentScope?.viewUrl) !== normalizeBoundUrl(scope.viewUrl)) {
    throw new Error('Live manifest content scope does not match the client document');
  }
  return {
    sourceBound: true,
    sourceDocumentBound: source.documentSha256 !== undefined,
    sourceDocumentSha256: source.documentSha256 || '',
    scope: { ...scope },
    sourceSha256: source.sha256,
  };
}

function normalizeBoundUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.hash = '';
    return url.toString().replace(/\/$/u, '');
  } catch {
    return '';
  }
}

function liveContentLedger(manifest, semantic = false, viewUrl = '') {
  const ledger = manifest?.contentLedger;
  if (
    ledger?.schemaVersion !== (semantic ? 2 : 1)
    || ledger?.artifact !== 'monteby-content-ledger'
    || !Array.isArray(ledger.items)
    || ledger.items.length > 10000
  ) {
    throw new Error('Live manifest does not contain a monteby-content-ledger v1 artifact');
  }
  let total = 0;
  const seen = new Set();
  const seenKeys = new Set();
  for (const item of ledger.items) {
    if (!item || typeof item.text !== 'string' || !Number.isSafeInteger(item.count) || item.count < 1
        || !Array.isArray(item.structureKeys) || item.structureKeys.length !== item.count
        || item.structureKeys.some((key) => typeof key !== 'string' || !key || seenKeys.has(key))
        || new Set(item.structureKeys).size !== item.structureKeys.length
        || seen.has(item.sha256)) throw new Error('Live content ledger item is invalid');
    const entry = semantic ? { kind: item.kind, role: item.role, text: item.text, ...(['link', 'control'].includes(item.kind) ? { name: item.name } : {}), ...(item.kind === 'link' ? { href: item.href } : {}) } : { text: item.text };
    const recomputed = buildContentLedger([{ ...entry, structureKey: item.structureKeys[0] }], { semantic, viewUrl }).items[0];
    if (!recomputed || recomputed.sha256 !== item.sha256 || recomputed.length !== item.length || recomputed.text !== item.text
        || (semantic && ['kind', 'role', 'name', 'href'].some((key) => recomputed[key] !== item[key]))) {
      throw new Error('Live content ledger text/hash integrity mismatch');
    }
    seen.add(item.sha256);
    for (const key of item.structureKeys) seenKeys.add(key);
    total += item.count;
  }
  if (total > 10000 || total !== ledger.totalOccurrences || ledger.uniqueEntries !== ledger.items.length) {
    throw new Error('Live content ledger totals are invalid');
  }
  return ledger;
}

function verifyClientContent(clientDocument, liveManifest, sourceBytes) {
  const entries = clientDocumentEntries(clientDocument);
  const sourceBinding = validateSourceBinding(clientDocument, liveManifest, entries, sourceBytes);
  if (clientDocument.scope?.capture === 'semantic-dom-v1') {
    const capture = liveManifest.semanticContent;
    if (liveManifest.captureStatus !== 'complete' || capture?.schemaVersion !== 1 || capture.complete !== true
        || !Array.isArray(capture.viewports) || capture.viewports.length === 0
        || !Array.isArray(liveManifest.layouts) || capture.viewports.length !== liveManifest.layouts.length) {
      throw new Error('Semantic capture is incomplete');
    }
    const expected = buildContentLedger(entries, { semantic: true, viewUrl: clientDocument.scope.viewUrl });
    const labels = new Set();
    const viewports = capture.viewports.map((viewport) => {
      if (typeof viewport.label !== 'string' || !viewport.label || labels.has(viewport.label)
          || !liveManifest.layouts.some((layout) => layout.label === viewport.label)
          || viewport.complete !== true || !Array.isArray(viewport.reasons) || viewport.reasons.length
          || viewport.region !== clientDocument.scope.region
          || normalizeBoundUrl(viewport.viewUrl) !== normalizeBoundUrl(clientDocument.scope.viewUrl)) {
        throw new Error('Semantic viewport scope or completeness mismatch');
      }
      labels.add(viewport.label);
      return { label: viewport.label, ...compareContentLedgers(expected, liveContentLedger({ contentLedger: viewport.ledger }, true, viewport.viewUrl)) };
    });
    return {
      schemaVersion: 2,
      artifact: 'monteby-client-content-verification',
      ...sourceBinding,
      complete: viewports.every((viewport) => viewport.complete),
      coverage: 'semantic-dom-including-inactive-content-not-visual-or-interaction-proof',
      viewports,
      ...Object.fromEntries(['missing', 'truncatedOrChanged', 'duplicateCountMismatch', 'added'].map((key) => [key, viewports.flatMap((viewport) => viewport[key].map((item) => ({ viewport: viewport.label, ...item })))])),
    };
  }
  const expected = buildContentLedger(entries);
  const comparison = compareContentLedgers(expected, liveContentLedger(liveManifest));
  return {
    ...comparison,
    artifact: 'monteby-client-content-verification',
    ...sourceBinding,
  };
}

function prepareClientDocument(inventory, snapshot, sourceBytes, region, label) {
  const viewUrl = snapshot?.data?.viewUrl;
  if (snapshot?.artifact !== 'monteby-page-snapshot' || snapshot.schemaVersion !== 1
      || snapshot.pageId !== snapshot.data?.id || !Number.isSafeInteger(snapshot.pageId) || snapshot.pageId <= 0
      || !normalizeBoundUrl(viewUrl) || normalizeBoundUrl(viewUrl) !== normalizeBoundUrl(snapshot.viewUrl)
      || new URL(viewUrl).origin !== new URL(snapshot.site).origin
      || nodeMapSha256(snapshot.data.layout) !== snapshot.data.layoutSha256) {
    throw new Error('A canonical page snapshot with matching identity and layout digest is required');
  }
  if (!['page-content', 'full-render'].includes(region) || typeof label !== 'string' || !label.trim()
      || !Buffer.isBuffer(sourceBytes) || !sourceBytes.length || sourceBytes.length > MAX_INPUT_BYTES) {
    throw new Error('A bounded source document, label and explicit content region are required');
  }
  const document = {
    schemaVersion: 2,
    artifact: 'monteby-client-content-document',
    scope: { viewUrl, region, pageId: snapshot.pageId, capture: 'semantic-dom-v1' },
    source: { label, sha256: '', documentSha256: createHash('sha256').update(sourceBytes).digest('hex') },
    entries: inventory,
  };
  document.source.sha256 = canonicalClientSourceSha256(clientDocumentEntries(document));
  return document;
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const sourceBytes = options.sourceDocument ? readJson(options.sourceDocument, 'Source document', true) : undefined;
    if (options.prepare) {
      const document = prepareClientDocument(readJson(options.inventory, 'Approved inventory'), readJson(options.snapshot, 'Canonical snapshot'), sourceBytes, options.region, options.label);
      fs.writeFileSync(options.out, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
      process.stdout.write(`${JSON.stringify({ artifact: document.artifact, prepared: true, verified: false, source: document.source, scope: document.scope, entryCount: document.entries.length })}\n`);
      return 0;
    }
    const report = verifyClientContent(
      readJson(options.clientDocument, 'Client document'),
      readJson(options.liveManifest, 'Live manifest'),
      sourceBytes,
    );
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.out) fs.writeFileSync(options.out, output, 'utf8');
    process.stdout.write(output);
    return report.complete ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  clientDocumentEntries,
  canonicalClientSourceSha256,
  liveContentLedger,
  main,
  parseArgs,
  prepareClientDocument,
  verifyClientContent,
};
