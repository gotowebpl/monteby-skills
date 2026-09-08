'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { batchPlan, runBatch } = require('../monteby-site-authoring/scripts/batch-layout-client');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-layout-batch-'));
  const operations = [path.join(directory, 'one.json'), path.join(directory, 'two.json')];
  operations.forEach((file) => fs.writeFileSync(file, '[]'));
  return {
    directory,
    plan: {
      schemaVersion: 1,
      artifact: 'monteby-layout-batch',
      site: 'https://example.test/',
      pages: operations.map((file, index) => ({ pageId: index + 10, operations: file })),
    },
  };
}

test('batch preflights every page before the first write', async () => {
  const { directory, plan } = fixture();
  const calls = [];
  const digest = 'a'.repeat(64);
  const report = await runBatch(plan, directory, { execute: async (args) => {
    calls.push(args);
    return args[0] === 'patch-validate'
      ? { ok: true, operationsSha256: digest, candidateLayoutSha256: digest }
      : { ok: true };
  } });

  assert.equal(report.complete, true);
  assert.deepEqual(calls.map((args) => args[0]), [
    'snapshot', 'patch-validate', 'snapshot', 'patch-validate', 'patch-save', 'patch-save',
  ]);
});

test('batch performs no writes when any page fails preflight', async () => {
  const { directory, plan } = fixture();
  const calls = [];
  const digest = 'b'.repeat(64);
  const report = await runBatch(plan, directory, { execute: async (args) => {
    calls.push(args);
    if (args[0] === 'patch-validate' && args.includes('11')) return { ok: false, code: 'INVALID_LAYOUT' };
    return args[0] === 'patch-validate'
      ? { ok: true, operationsSha256: digest, candidateLayoutSha256: digest }
      : { ok: true };
  } });

  assert.equal(report.complete, false);
  assert.equal(calls.some((args) => args[0] === 'patch-save'), false);
});

test('batch stops on a save conflict and re-preflights every unapplied page before resume', async () => {
  const { directory, plan } = fixture();
  const digest = 'c'.repeat(64);
  let conflict = true;
  const calls = [];
  const execute = async (args) => {
    calls.push(args);
    if (args[0] === 'patch-validate') return { ok: true, operationsSha256: digest, candidateLayoutSha256: digest };
    if (args[0] === 'patch-save' && args.includes('10') && conflict) {
      conflict = false;
      return { ok: false, code: 'POST_MODIFIED_CONFLICT' };
    }
    return { ok: true };
  };
  const blocked = await runBatch(plan, directory, { execute });
  assert.equal(blocked.phase, 'blocked');
  assert.equal(blocked.pages[0].status, 'blocked');

  calls.length = 0;
  const resumed = await runBatch(plan, directory, { resume: true, execute });

  assert.equal(resumed.complete, true);
  assert.deepEqual(resumed.pages.map((page) => page.status), ['applied', 'applied']);
  assert.deepEqual(calls.map((args) => args[0]), [
    'snapshot', 'patch-validate', 'snapshot', 'patch-validate', 'patch-save', 'patch-save',
  ]);
});

test('batch plan rejects credential-bearing site URLs', () => {
  const { plan } = fixture();
  assert.throws(() => batchPlan({ ...plan, site: 'https://user:secret@example.test/' }), /without credentials/);
});
