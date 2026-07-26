#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const manifestRelativePath = 'monteby-site-authoring/references/site-contract-compatibility.json';
const manifestPath = path.join(root, manifestRelativePath);

test('site contract compatibility manifest requires the exact live contract without a phantom baseline', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.deepEqual(manifest, {
    schemaVersion: 2,
    contractEndpoint: '/wp-json/monteby/v1/contract',
    liveContractRequired: true,
    compatibilityPolicy: 'exact-live-contract',
    bundledBaseline: null,
    reason: "No verified portable Builder contract snapshot is bundled. Authoring must use the current target site's live contract.",
  });
});

test('site contract compatibility manifest ships in the npm package', () => {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  assert.equal(result.status, 0, result.stderr);

  const packResult = JSON.parse(result.stdout);
  assert.equal(Array.isArray(packResult), true);
  assert.equal(packResult.length, 1);
  assert.equal(
    packResult[0].files.some((file) => file.path === manifestRelativePath),
    true,
  );
});

test('site authoring requires the compatibility policy and keeps the live contract authoritative', () => {
  const skill = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    'utf8',
  );

  assert.match(skill, /references\/site-contract-compatibility\.json/);
  assert.match(skill, /Always fetch `GET \/wp-json\/monteby\/v1\/contract` for the target site/);
  assert.match(skill, /live contract|live response/i);
});
