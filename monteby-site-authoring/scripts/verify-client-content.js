#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildContentLedger,
  compareContentLedgers,
} = require('./content-ledger');

const MAX_INPUT_BYTES = 5 * 1024 * 1024;

function parseArgs(argv) {
  const options = { clientDocument: '', liveManifest: '', out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!['--client-document', '--live-manifest', '--out'].includes(option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    index += 1;
    const key = option === '--client-document'
      ? 'clientDocument'
      : option === '--live-manifest' ? 'liveManifest' : 'out';
    options[key] = path.resolve(value);
  }
  if (!options.clientDocument || !options.liveManifest) {
    throw new Error('--client-document and --live-manifest are required');
  }
  return options;
}

function readJson(file, label) {
  const stats = fs.statSync(file);
  if (!stats.isFile() || stats.size > MAX_INPUT_BYTES) {
    throw new Error(`${label} must be a JSON file no larger than ${MAX_INPUT_BYTES} bytes`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clientDocumentEntries(document) {
  if (
    !document
    || typeof document !== 'object'
    || Array.isArray(document)
    || document.schemaVersion !== 1
    || document.artifact !== 'monteby-client-content-document'
    || !Array.isArray(document.entries)
    || Object.keys(document).some((key) => !['schemaVersion', 'artifact', 'entries'].includes(key))
  ) {
    throw new Error('Client document must be a monteby-client-content-document v1 artifact');
  }
  const ids = new Set();
  return document.entries.map((entry, index) => {
    if (
      !entry
      || typeof entry !== 'object'
      || Array.isArray(entry)
      || typeof entry.id !== 'string'
      || !entry.id.trim()
      || typeof entry.text !== 'string'
      || !entry.text
      || Object.keys(entry).some((key) => !['id', 'text'].includes(key))
    ) {
      throw new Error(`Client document entry ${index} must contain only non-empty id and text strings`);
    }
    const id = entry.id.trim();
    if (ids.has(id)) throw new Error(`Client document entry id must be unique: ${id}`);
    ids.add(id);
    return { structureKey: id, text: entry.text };
  });
}

function liveContentLedger(manifest) {
  const ledger = manifest?.contentLedger;
  if (
    ledger?.schemaVersion !== 1
    || ledger?.artifact !== 'monteby-content-ledger'
    || !Array.isArray(ledger.items)
  ) {
    throw new Error('Live manifest does not contain a monteby-content-ledger v1 artifact');
  }
  return ledger;
}

function verifyClientContent(clientDocument, liveManifest) {
  const expected = buildContentLedger(clientDocumentEntries(clientDocument));
  const comparison = compareContentLedgers(expected, liveContentLedger(liveManifest));
  return {
    ...comparison,
    artifact: 'monteby-client-content-verification',
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const report = verifyClientContent(
      readJson(options.clientDocument, 'Client document'),
      readJson(options.liveManifest, 'Live manifest')
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
  liveContentLedger,
  main,
  parseArgs,
  verifyClientContent,
};
