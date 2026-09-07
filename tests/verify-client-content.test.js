'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { buildContentLedger } = require('../monteby-site-authoring/scripts/content-ledger');
const {
  clientDocumentEntries,
  verifyClientContent,
} = require('../monteby-site-authoring/scripts/verify-client-content');

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
