'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  batchPlan,
  defaultExecute,
  runBatch,
} = require('../monteby-site-authoring/scripts/batch-layout-client');

const SITE = 'https://example.test';

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-layout-batch-'));
  const operations = [path.join(directory, 'one.json'), path.join(directory, 'two.json')];
  operations.forEach((file) => fs.writeFileSync(file, '[]'));
  return {
    directory,
    plan: {
      schemaVersion: 1,
      artifact: 'monteby-layout-batch',
      site: `${SITE}/`,
      pages: operations.map((file, index) => ({ pageId: index + 10, operations: file })),
    },
  };
}

function pageIdFromArgs(args) {
  return Number(args[args.indexOf('--page-id') + 1]);
}

function snapshotProof(pageId) {
  return {
    schemaVersion: 1,
    ok: true,
    stage: 'snapshot',
    code: 'SNAPSHOT_OK',
    scope: { site: SITE, pageId },
  };
}

function preflightProof(seed, pageId) {
  return {
    schemaVersion: 1,
    ok: true,
    stage: 'patch-validate',
    code: 'PATCH_VALIDATION_OK',
    scope: { site: SITE, pageId },
    operationsSha256: seed.repeat(64),
    candidateLayoutSha256: 'e'.repeat(64),
    compiledHtmlSha256: 'f'.repeat(64),
    evidence: { site: SITE, pageId, layoutSha256: 'd'.repeat(64) },
    response: { currentLayoutSha256: 'd'.repeat(64) },
  };
}

function saveProof(preflight, pageId) {
  return {
    schemaVersion: 1,
    ok: true,
    stage: 'patch-save',
    code: 'PATCH_SAVE_OK',
    scope: { site: SITE, pageId },
    candidateLayoutSha256: preflight.candidateLayoutSha256,
    compiledHtmlSha256: preflight.compiledHtmlSha256,
    evidence: { site: SITE, pageId },
  };
}

test('batch preflights every page before the first write', async () => {
  const { directory, plan } = fixture();
  const calls = [];
  const report = await runBatch(plan, directory, { execute: async (args) => {
    calls.push(args);
    const pageId = pageIdFromArgs(args);
    const preflight = preflightProof('a', pageId);
    if (args[0] === 'snapshot') return snapshotProof(pageId);
    if (args[0] === 'patch-validate') return preflight;
    return saveProof(preflight, pageId);
  } });

  assert.equal(report.complete, true);
  assert.deepEqual(calls.map((args) => args[0]), [
    'snapshot', 'patch-validate', 'snapshot', 'patch-validate', 'patch-save', 'patch-save',
  ]);
  const preflight = preflightProof('a', 10);
  const applyCalls = calls.filter((args) => args[0] === 'patch-save');
  assert.ok(applyCalls.every((args) => args.includes(preflight.compiledHtmlSha256)));
  assert.ok(report.pages.every((page) => (
    page.layoutSha256 === preflight.evidence.layoutSha256
    && page.currentLayoutSha256 === preflight.response.currentLayoutSha256
    && page.compiledHtmlSha256 === preflight.compiledHtmlSha256
  )));
});

test('batch performs no writes when any page fails preflight', async () => {
  const { directory, plan } = fixture();
  const calls = [];
  const report = await runBatch(plan, directory, { execute: async (args) => {
    calls.push(args);
    const pageId = pageIdFromArgs(args);
    if (args[0] === 'snapshot') return snapshotProof(pageId);
    if (args[0] === 'patch-validate' && args.includes('11')) return { ok: false, code: 'INVALID_LAYOUT' };
    return preflightProof('b', pageId);
  } });

  assert.equal(report.complete, false);
  assert.equal(calls.some((args) => args[0] === 'patch-save'), false);
});

test('batch stops on a save conflict and re-preflights every unapplied page before resume', async () => {
  const { directory, plan } = fixture();
  let conflict = true;
  const calls = [];
  const execute = async (args) => {
    calls.push(args);
    const pageId = pageIdFromArgs(args);
    const preflight = preflightProof('c', pageId);
    if (args[0] === 'snapshot') return snapshotProof(pageId);
    if (args[0] === 'patch-validate') return preflight;
    if (args[0] === 'patch-save' && args.includes('10') && conflict) {
      conflict = false;
      return { ok: false, code: 'REST_CONFLICT' };
    }
    return saveProof(preflight, pageId);
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
  const preflight = preflightProof('c', 10);
  assert.ok(calls.filter((args) => args[0] === 'patch-save')
    .every((args) => args.includes(preflight.compiledHtmlSha256)));
});

test('batch never marks a successful response applied without candidate and compiled proof', async () => {
  const { directory, plan } = fixture();
  const report = await runBatch(plan, directory, { execute: async (args) => {
    const pageId = pageIdFromArgs(args);
    if (args[0] === 'snapshot') return snapshotProof(pageId);
    if (args[0] === 'patch-validate') return preflightProof('d', pageId);
    if (args[0] === 'patch-save') return { ok: true };
    throw new Error('Unexpected batch command');
  } });

  assert.equal(report.complete, false);
  assert.equal(report.phase, 'blocked');
  assert.equal(report.pages[0].status, 'blocked');
  assert.equal(report.pages[0].code, 'PATCH_SAVE_EVIDENCE_INVALID');
  assert.equal(report.pages[0].writeOutcome, 'unknown');
  assert.equal(report.pages.some((page) => page.status === 'applied'), false);
  await assert.rejects(
    runBatch(plan, directory, { resume: true, execute: async () => ({ ok: true }) }),
    /no exact conflict evidence/
  );
});

test('batch never retries a patch whose post-write readback was uncertain', async () => {
  const { directory, plan } = fixture();
  let saveCount = 0;
  const execute = async (args) => {
    const pageId = pageIdFromArgs(args);
    if (args[0] === 'snapshot') return snapshotProof(pageId);
    if (args[0] === 'patch-validate') return preflightProof('e', pageId);
    saveCount += 1;
    return { ok: false, code: 'PATCH_SAVE_READBACK_FAILED' };
  };

  const report = await runBatch(plan, directory, { execute });
  assert.equal(report.pages[0].writeOutcome, 'unknown');
  await assert.rejects(
    runBatch(plan, directory, { execute }),
    /Batch ledger already exists/
  );
  await assert.rejects(runBatch(plan, directory, { resume: true, execute }), /no exact conflict evidence/);
  assert.equal(saveCount, 1);
});

test('batch rejects a successful envelope scoped to another page before apply completes', async () => {
  const { directory, plan } = fixture();
  let saveCount = 0;
  const report = await runBatch(plan, directory, { execute: async (args) => {
    const pageId = pageIdFromArgs(args);
    if (args[0] === 'snapshot') return snapshotProof(pageId);
    if (args[0] === 'patch-validate') return preflightProof('f', pageId);
    saveCount += 1;
    return saveProof(preflightProof('f', pageId + 1), pageId + 1);
  } });

  assert.equal(saveCount, 1);
  assert.equal(report.pages[0].code, 'PATCH_SAVE_EVIDENCE_INVALID');
  assert.equal(report.pages[0].writeOutcome, 'unknown');
});

test('default executor reads the report artifact and rejects exit-status disagreement', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-layout-child-'));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const reportFile = path.join(directory, 'report.json');
  const child = path.join(directory, 'child.js');
  fs.writeFileSync(child, `
    const fs = require('node:fs');
    const out = process.argv[process.argv.indexOf('--out') + 1];
    fs.writeFileSync(out, JSON.stringify({ ok: true }));
    process.stdout.write('x'.repeat(2 * 1024 * 1024));
    process.exitCode = 1;
  `);

  await assert.rejects(
    defaultExecute(['patch-save', '--out', reportFile], child),
    /exit status disagrees/
  );
});

test('default executor never accepts a stale report after the child fails before writing', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-layout-child-'));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const reportFile = path.join(directory, 'report.json');
  const child = path.join(directory, 'child.js');
  fs.writeFileSync(reportFile, JSON.stringify({ ok: false, code: 'REST_CONFLICT' }));
  fs.writeFileSync(child, 'process.exitCode = 1;');

  await assert.rejects(
    defaultExecute(['patch-save', '--out', reportFile], child),
    /left no readable report/
  );
  assert.equal(fs.existsSync(reportFile), false);
});

test('batch plan rejects credential-bearing site URLs', () => {
  const { plan } = fixture();
  assert.throws(() => batchPlan({ ...plan, site: 'https://user:secret@example.test/' }), /without credentials/);
});
