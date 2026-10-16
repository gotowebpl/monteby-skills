'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { buildContentLedger } = require('../monteby-site-authoring/scripts/content-ledger');
const {
  canonicalClientSourceSha256,
  clientDocumentEntries,
  verifyClientContent,
  prepareClientDocument,
  parseArgs,
} = require('../monteby-site-authoring/scripts/verify-client-content');
const { nodeMapSha256 } = require('../monteby-site-authoring/scripts/wordpress-layout-client');

const SCRIPT = path.resolve(__dirname, '..', 'monteby-site-authoring', 'scripts', 'verify-client-content.js');

function clientDocument(entries) {
  return { schemaVersion: 1, artifact: 'monteby-client-content-document', entries };
}

function liveManifest(entries) {
  return { contentLedger: buildContentLedger(entries) };
}

test('client content verification compares approved text with the captured live ledger', () => {
  const report = verifyClientContent(
    clientDocument([
      { id: 'hero.heading', text: 'Kompletna oferta' },
      { id: 'hero.lead', text: 'Bez skrótów i parafraz.' },
    ]),
    liveManifest([
      { structureKey: '0.1', text: 'Kompletna oferta' },
      { structureKey: '0.2', text: 'Bez skrótów i parafraz.' },
    ])
  );

  assert.equal(report.complete, true);
  assert.equal(report.artifact, 'monteby-client-content-verification');
  assert.equal(report.sourceBound, false);
});

test('v2 client content gate binds exact approved text to one live page', () => {
  const entries = [
    { id: 'hero.heading', text: 'Cena od 1 000 zł' },
    { id: 'hero.lead', text: 'Pełny opis bez skrótów.' },
  ];
  const document = {
    schemaVersion: 2,
    artifact: 'monteby-client-content-document',
    scope: { viewUrl: 'https://example.test/oferta/#hero', region: 'page-content' },
    source: {
      label: 'Zatwierdzony dokument klienta',
      sha256: canonicalClientSourceSha256(entries.map((entry) => ({
        structureKey: entry.id,
        text: entry.text,
      }))),
    },
    entries,
  };
  const manifest = {
    ...liveManifest(entries.map((entry) => ({ structureKey: entry.id, text: entry.text }))),
    sourceUrl: 'https://example.test/oferta/',
    contentScope: { viewUrl: 'https://example.test/oferta/', region: 'page-content' },
  };

  const report = verifyClientContent(document, manifest);

  assert.equal(report.complete, true);
  assert.equal(report.sourceBound, true);
  assert.equal(report.scope.region, 'page-content');
  assert.equal(report.sourceSha256, document.source.sha256);
  for (const contentScope of [undefined, { viewUrl: manifest.sourceUrl, region: 'full-render' }, { viewUrl: 'https://example.test/other/', region: 'page-content' }]) {
    assert.throws(() => verifyClientContent(document, { ...manifest, contentScope }), /content scope/);
  }
});

test('prepared semantic v2 binds approved inventory, original source bytes and canonical snapshot without claiming verification', () => {
  const source = Buffer.from('# Approved brief\nRead\u00a0more');
  const layout = { ROOT: { type: { resolvedName: 'Page' }, nodes: [] } };
  const snapshot = { artifact: 'monteby-page-snapshot', schemaVersion: 1, pageId: 12, site: 'https://example.test', viewUrl: 'https://example.test/offer/', data: { id: 12, viewUrl: 'https://example.test/offer/', layout, layoutSha256: nodeMapSha256(layout) } };
  const entries = [
    { id: 'heading', kind: 'text', role: 'h1', text: 'Offer' },
    { id: 'cta', kind: 'link', text: 'Read\u00a0more', href: '#detail' },
    { id: 'menu', kind: 'control', role: 'button', text: '', name: 'Open menu' },
    { id: 'image', kind: 'alt', text: '' },
  ];
  const document = prepareClientDocument(entries, snapshot, source, 'full-render', 'Approved copy and UI');
  assert.equal(document.scope.pageId, 12);
  assert.equal(document.scope.capture, 'semantic-dom-v1');
  assert.equal(document.verified, undefined);
  assert.deepEqual(document.entries, entries);
  const ledger = buildContentLedger(entries.map(({ id, ...entry }) => ({ structureKey: id, ...entry })), { semantic: true, viewUrl: snapshot.viewUrl });
  const viewport = { label: 'desktop', viewUrl: snapshot.viewUrl, region: 'full-render', complete: true, reasons: [], ledger };
  const manifest = { sourceUrl: snapshot.viewUrl, contentScope: { viewUrl: snapshot.viewUrl, region: 'full-render' }, captureStatus: 'complete', layouts: [{ label: 'desktop' }], semanticContent: { schemaVersion: 1, complete: true, viewports: [viewport] } };
  const report = verifyClientContent(document, manifest, source);
  assert.equal(report.complete, true);
  assert.equal(report.sourceBound, true);
  assert.equal(report.sourceDocumentBound, true);
  assert.match(report.coverage, /not-visual-or-interaction-proof/);
  assert.throws(() => verifyClientContent(document, manifest), /Source document bytes/);
  assert.throws(() => verifyClientContent(document, manifest, Buffer.from('new brief')), /Source document bytes/);
  assert.throws(() => prepareClientDocument(entries, { ...snapshot, pageId: 99 }, source, 'full-render', 'Brief'), /canonical page snapshot/);
  assert.throws(() => prepareClientDocument(entries, { ...snapshot, data: { ...snapshot.data, layoutSha256: 'a'.repeat(64) } }, source, 'full-render', 'Brief'), /canonical page snapshot/);
  assert.throws(() => prepareClientDocument([], snapshot, source, 'full-render', 'Brief'), /1–10000/);

  for (const [label, change] of [
    ['changed href', (data) => { data[1].href = '#other'; }],
    ['changed accessible name', (data) => { data[2].name = 'Close menu'; }],
    ['lost NBSP', (data) => { data[1].text = 'Read more'; }],
    ['wrong heading level', (data) => { data[0].role = 'h2'; }],
    ['missing', (data) => { data.splice(0, 1); }],
    ['duplicate', (data) => { data.push({ ...data[1], id: 'second-cta' }); }],
    ['addition', (data) => { data.push({ id: 'invented', text: 'Trusted by millions' }); }],
  ]) {
    const changed = structuredClone(entries); change(changed);
    const actual = buildContentLedger(changed.map(({ id, ...entry }) => ({ structureKey: id, ...entry })), { semantic: true, viewUrl: snapshot.viewUrl });
    const drift = verifyClientContent(document, { ...manifest, semanticContent: { ...manifest.semanticContent, viewports: [{ ...viewport, ledger: actual }] } }, source);
    assert.equal(drift.complete, false, label);
  }
  const equivalent = structuredClone(entries); equivalent[1].href = `${snapshot.viewUrl}#detail`;
  assert.equal(verifyClientContent(document, { ...manifest, semanticContent: { ...manifest.semanticContent, viewports: [{ ...viewport, ledger: buildContentLedger(equivalent.map(({ id, ...entry }) => ({ structureKey: id, ...entry })), { semantic: true, viewUrl: snapshot.viewUrl }) }] } }, source).complete, true);

  const allViewports = ['desktop', 'tablet', 'mobile'].map((label) => ({ ...structuredClone(viewport), label }));
  const responsiveManifest = { ...manifest, layouts: allViewports.map(({ label }) => ({ label })), semanticContent: { ...manifest.semanticContent, viewports: allViewports } };
  assert.equal(verifyClientContent(document, responsiveManifest, source).complete, true);
  const withoutHeading = entries.slice(1).map(({ id, ...entry }) => ({ structureKey: id, ...entry }));
  allViewports[2].ledger = buildContentLedger(withoutHeading, { semantic: true, viewUrl: snapshot.viewUrl });
  const mobileFailure = verifyClientContent(document, responsiveManifest, source);
  assert.equal(mobileFailure.complete, false);
  assert.deepEqual(mobileFailure.viewports.map(({ complete }) => complete), [true, true, false]);
  assert.equal(mobileFailure.missing[0].viewport, 'mobile');
  allViewports[2].label = 'desktop';
  assert.throws(() => verifyClientContent(document, responsiveManifest, source), /viewport/);

  for (const mutated of [
    { ...manifest, captureStatus: 'partial' },
    { ...manifest, semanticContent: { ...manifest.semanticContent, viewports: [] } },
    { ...manifest, semanticContent: { ...manifest.semanticContent, viewports: [{ ...viewport, complete: false, reasons: ['content-budget'] }] } },
    { ...manifest, semanticContent: { ...manifest.semanticContent, viewports: [{ ...viewport, viewUrl: 'https://example.test/login/' }] } },
    { ...manifest, semanticContent: { ...manifest.semanticContent, viewports: [{ ...viewport, region: 'page-content' }] } },
  ]) assert.throws(() => verifyClientContent(document, mutated, source), /capture|viewport/);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-content-v2-'));
  try {
    for (const [name, data] of [['snapshot.json', snapshot], ['inventory.json', entries], ['manifest.json', manifest]]) fs.writeFileSync(path.join(directory, name), JSON.stringify(data));
    fs.writeFileSync(path.join(directory, 'brief.md'), source);
    const result = spawnSync(process.execPath, [SCRIPT, '--prepare', '--inventory', path.join(directory, 'inventory.json'), '--snapshot', path.join(directory, 'snapshot.json'), '--source-document', path.join(directory, 'brief.md'), '--region', 'full-render', '--label', 'Approved source', '--out', path.join(directory, 'content.json')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).verified, false);
    const verified = spawnSync(process.execPath, [SCRIPT, '--client-document', path.join(directory, 'content.json'), '--live-manifest', path.join(directory, 'manifest.json'), '--source-document', path.join(directory, 'brief.md')], { encoding: 'utf8' });
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(JSON.parse(verified.stdout).complete, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('ledger verification rejects forged hashes/counts and does not turn two invalid URLs into matching scope', () => {
  const document = clientDocument([{ id: 'one', text: 'Approved' }]);
  const manifest = liveManifest([{ structureKey: 'one', text: 'Approved' }]);
  for (const mutate of [
    (ledger) => { ledger.items[0].text = 'Unapproved'; },
    (ledger) => { ledger.items[0].count = 2; },
    (ledger) => { ledger.items[0].length = 0; },
    (ledger) => { ledger.totalOccurrences = 9; },
    (ledger) => { ledger.items.push({ ...ledger.items[0] }); },
    (ledger) => { ledger.items[0].structureKeys = []; },
  ]) { const copy = structuredClone(manifest); mutate(copy.contentLedger); assert.throws(() => verifyClientContent(document, copy), /ledger/); }
  const v2 = { ...document, schemaVersion: 2, scope: { viewUrl: 'https://[bad', region: 'full-render' }, source: { label: 'Brief', sha256: canonicalClientSourceSha256(clientDocumentEntries(document)) } };
  assert.throws(() => verifyClientContent(v2, { ...manifest, sourceUrl: 'https://[bad' }), /public HTTP URL/);
  assert.throws(() => parseArgs(['--prepare', '--out', 'content.json']), /requires/);
  assert.throws(() => parseArgs(['--client-document', 'content.json', '--live-manifest', 'manifest.json', '--region', 'full-render']), /required/);
});

test('v2 client content gate rejects a stale source hash and a different live page', () => {
  const entries = [{ id: 'body', text: 'Zatwierdzony tekst' }];
  const base = {
    schemaVersion: 2,
    artifact: 'monteby-client-content-document',
    scope: { viewUrl: 'https://example.test/oferta/', region: 'full-render' },
    source: {
      label: 'Brief',
      sha256: canonicalClientSourceSha256([{ structureKey: 'body', text: 'Zatwierdzony tekst' }]),
    },
    entries,
  };
  assert.throws(
    () => verifyClientContent({ ...base, source: { ...base.source, sha256: '0'.repeat(64) } }, {
      ...liveManifest([{ structureKey: 'body', text: 'Zatwierdzony tekst' }]),
      sourceUrl: base.scope.viewUrl,
    }),
    /source\.sha256 does not match/,
  );
  assert.throws(
    () => verifyClientContent(base, {
      ...liveManifest([{ structureKey: 'body', text: 'Zatwierdzony tekst' }]),
      sourceUrl: 'https://example.test/inny/',
    }),
    /sourceUrl does not match/,
  );
});

test('client content verification fails on changed, missing, added, and duplicate text', () => {
  const report = verifyClientContent(
    clientDocument([
      { id: 'one', text: 'Pierwszy zatwierdzony akapit.' },
      { id: 'two', text: 'Drugi zatwierdzony akapit, którego nie wolno skracać.' },
      { id: 'repeat-1', text: 'Powtórzenie' },
      { id: 'repeat-2', text: 'Powtórzenie' },
    ]),
    liveManifest([
      { structureKey: 'live.1', text: 'Drugi zatwierdzony akapit' },
      { structureKey: 'live.2', text: 'Powtórzenie' },
      { structureKey: 'live.3', text: 'Treść dopisana poza dokumentem.' },
    ])
  );

  assert.equal(report.complete, false);
  assert.equal(report.missing[0].text, 'Pierwszy zatwierdzony akapit.');
  assert.equal(report.truncatedOrChanged[0].text, 'Drugi zatwierdzony akapit, którego nie wolno skracać.');
  assert.equal(report.duplicateCountMismatch[0].text, 'Powtórzenie');
  assert.equal(report.added[0].text, 'Treść dopisana poza dokumentem.');
});

test('client content document rejects duplicate ids and undeclared top-level data', () => {
  assert.throws(() => clientDocumentEntries(clientDocument([
    { id: 'hero.heading', text: 'Pierwszy tekst' },
    { id: 'hero.heading', text: 'Drugi tekst' },
  ])), /entry id must be unique/);
  assert.throws(() => clientDocumentEntries({
    ...clientDocument([{ id: 'hero.heading', text: 'Tekst' }]),
    privateNotes: 'nie należy do kontraktu',
  }), /must be a monteby-client-content-document/);
});

test('verify-client-content CLI exits non-zero and writes an auditable drift report', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-client-content-'));
  const clientFile = path.join(directory, 'client.json');
  const liveFile = path.join(directory, 'live.json');
  const reportFile = path.join(directory, 'report.json');
  fs.writeFileSync(clientFile, JSON.stringify(clientDocument([{ id: 'one', text: 'Treść źródłowa' }])), 'utf8');
  fs.writeFileSync(liveFile, JSON.stringify(liveManifest([{ structureKey: 'live.1', text: 'Inna treść' }])), 'utf8');

  const result = spawnSync(process.execPath, [
    SCRIPT,
    '--client-document', clientFile,
    '--live-manifest', liveFile,
    '--out', reportFile,
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).complete, false);
  assert.equal(JSON.parse(fs.readFileSync(reportFile, 'utf8')).complete, false);
});
