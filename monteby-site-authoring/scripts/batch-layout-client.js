#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const CLIENT = path.join(__dirname, 'wordpress-layout-client.js');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function batchPlan(value) {
  if (
    !value || typeof value !== 'object' || Array.isArray(value)
    || value.schemaVersion !== 1 || value.artifact !== 'monteby-layout-batch'
    || typeof value.site !== 'string' || !/^https?:\/\//u.test(value.site)
    || !Array.isArray(value.pages) || value.pages.length === 0
    || Object.keys(value).some((key) => !['schemaVersion', 'artifact', 'site', 'pages'].includes(key))
  ) throw new Error('Batch plan must be a monteby-layout-batch v1 artifact');
  const siteUrl = new URL(value.site);
  if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
    throw new Error('Batch site must be an absolute HTTP(S) URL without credentials');
  }
  const ids = new Set();
  const pages = value.pages.map((page, index) => {
    if (
      !page || typeof page !== 'object' || Array.isArray(page)
      || !Number.isSafeInteger(page.pageId) || page.pageId < 1
      || typeof page.operations !== 'string' || !page.operations.trim()
      || Object.keys(page).some((key) => !['pageId', 'operations'].includes(key))
    ) throw new Error(`Batch page ${index} must contain only pageId and operations`);
    if (ids.has(page.pageId)) throw new Error(`Batch pageId must be unique: ${page.pageId}`);
    ids.add(page.pageId);
    return { pageId: page.pageId, operations: path.resolve(page.operations) };
  });
  return { ...value, site: value.site.replace(/\/+$/u, ''), pages };
}

async function writeJson(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

function defaultExecute(args) {
  const result = spawnSync(process.execPath, [CLIENT, ...args], { encoding: 'utf8', env: process.env });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Canonical client returned unreadable output for ${args[0]}`);
  }
  return report;
}

function reportDigest(report, key) {
  const value = String(report?.[key] || report?.evidence?.[key] || '');
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(`Preflight report is missing ${key}`);
  return value;
}

async function runBatch(planValue, outDir, { resume = false, execute = defaultExecute } = {}) {
  const plan = batchPlan(planValue);
  const planSha256 = createHash('sha256').update(canonicalJson(planValue)).digest('hex');
  const ledgerFile = path.join(outDir, 'batch-ledger.json');
  let ledger;
  if (resume) {
    ledger = JSON.parse(await fs.readFile(ledgerFile, 'utf8'));
    if (ledger.planSha256 !== planSha256 || ledger.site !== plan.site) {
      throw new Error('Resume ledger does not match the exact batch plan and site');
    }
    if (ledger.phase === 'blocked') {
      const blocked = ledger.pages.find((page) => page.status === 'blocked');
      if (!blocked || blocked.stage !== 'patch-save' || !blocked.operationsSha256 || !blocked.candidateLayoutSha256) {
        throw new Error('Blocked ledger has no exact conflict evidence');
      }
      ledger.pages = ledger.pages.map((page) => (
        page.status === 'applied' ? page : { pageId: page.pageId, status: 'pending' }
      ));
      ledger.phase = 'preflight';
      await writeJson(ledgerFile, ledger);
    }
  } else {
    ledger = {
      schemaVersion: 1,
      artifact: 'monteby-layout-batch-ledger',
      site: plan.site,
      planSha256,
      phase: 'preflight',
      complete: false,
      pages: plan.pages.map((page) => ({ pageId: page.pageId, status: 'pending' })),
    };
    await writeJson(ledgerFile, ledger);
  }

  if (ledger.phase === 'preflight') {
    for (let index = 0; index < plan.pages.length; index += 1) {
      const page = plan.pages[index];
      if (ledger.pages[index]?.status === 'applied') continue;
      const pageDir = path.join(outDir, `page-${page.pageId}`);
      const snapshotReport = await execute([
        'snapshot', '--site', plan.site, '--page-id', String(page.pageId), '--out-dir', pageDir,
        '--out', path.join(pageDir, 'snapshot-report.json'),
      ]);
      if (!snapshotReport?.ok) {
        ledger.pages[index] = { pageId: page.pageId, status: 'blocked', stage: 'snapshot', code: snapshotReport?.code || 'UNKNOWN' };
        await writeJson(ledgerFile, ledger);
        return ledger;
      }
      const patchReportFile = path.join(pageDir, 'patch-validate-report.json');
      const patchReport = await execute([
        'patch-validate', '--site', plan.site, '--page-id', String(page.pageId), '--operations', page.operations,
        '--out-dir', pageDir, '--out', patchReportFile,
      ]);
      if (!patchReport?.ok) {
        ledger.pages[index] = { pageId: page.pageId, status: 'blocked', stage: 'patch-validate', code: patchReport?.code || 'UNKNOWN' };
        await writeJson(ledgerFile, ledger);
        return ledger;
      }
      ledger.pages[index] = {
        pageId: page.pageId,
        status: 'preflighted',
        operationsSha256: reportDigest(patchReport, 'operationsSha256'),
        candidateLayoutSha256: reportDigest(patchReport, 'candidateLayoutSha256'),
        pageDir,
        patchReport: patchReportFile,
      };
      await writeJson(ledgerFile, ledger);
    }
    ledger.phase = 'apply';
    await writeJson(ledgerFile, ledger);
  }

  for (let index = 0; index < plan.pages.length; index += 1) {
    const page = plan.pages[index];
    const state = ledger.pages[index];
    if (state.status === 'applied') continue;
    if (state.status !== 'preflighted') {
      throw new Error(`Page ${page.pageId} has no complete preflight evidence`);
    }
    const saveReport = await execute([
      'patch-save', '--site', plan.site, '--page-id', String(page.pageId), '--operations', page.operations,
      '--out-dir', state.pageDir, '--patch-report', state.patchReport,
      '--expected-operations-sha256', state.operationsSha256,
      '--expected-candidate-layout-sha256', state.candidateLayoutSha256,
      '--out', path.join(state.pageDir, 'patch-save-report.json'),
    ]);
    if (!saveReport?.ok) {
      ledger.pages[index] = { ...state, status: 'blocked', stage: 'patch-save', code: saveReport?.code || 'UNKNOWN' };
      ledger.phase = 'blocked';
      await writeJson(ledgerFile, ledger);
      return ledger;
    }
    ledger.pages[index] = { ...state, status: 'applied' };
    await writeJson(ledgerFile, ledger);
  }
  ledger.phase = 'complete';
  ledger.complete = true;
  await writeJson(ledgerFile, ledger);
  return ledger;
}

function parseArgs(argv) {
  const options = { plan: '', outDir: '', resume: false };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--resume') options.resume = true;
    else if (['--plan', '--out-dir'].includes(option)) {
      const value = argv[index += 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
      options[option === '--plan' ? 'plan' : 'outDir'] = path.resolve(value);
    } else throw new Error(`Unknown option: ${option}`);
  }
  if (!options.plan || !options.outDir) throw new Error('--plan and --out-dir are required');
  return options;
}

async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const plan = JSON.parse(await fs.readFile(options.plan, 'utf8'));
    const report = await runBatch(plan, options.outDir, { resume: options.resume });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.complete ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { batchPlan, canonicalJson, main, parseArgs, runBatch };
