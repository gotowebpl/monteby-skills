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

test('site contract compatibility manifest pins the tested Builder contract baseline', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.deepEqual(manifest, {
    schemaVersion: 1,
    siteContractVersion: 1,
    siteContractFingerprint: 'sha256:7157b60d8cc7c623bd76114f114660da8215244d2d67723aa4c3bfcf52127ebf',
    builderSnapshot: 'tests/fixtures/site-contract/full-contract-with-child-theme-widget.json',
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

test('site authoring requires the baseline and keeps the live contract authoritative', () => {
  const skill = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    'utf8',
  );

  assert.match(skill, /Read `references\/site-contract-compatibility\.json` before authoring/);
  assert.match(skill, /Always fetch `GET \/wp-json\/monteby\/v1\/contract` for the target site/);
  assert.match(skill, /Never use the bundled baseline[\s\S]*as a substitute for the live response/);
});
