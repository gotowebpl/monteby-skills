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
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.deepEqual(manifest, {
    schemaVersion: 3,
    skillVersion: '0.4.0',
    minimumBuilderVersion: '1.4.0',
    contractEndpoint: '/wp-json/monteby/v1/contract',
    liveContractRequired: true,
    compatibilityPolicy: 'exact-live-contract',
    bundledBaseline: null,
    featureGates: {
      providerRenderedWidgetSave: {
        minimumBuilderVersion: '1.4.0',
        contractPath: 'authoring.capabilities.providerRenderedWidgetSave',
        expectedValue: true,
      },
      queryControls: {
        minimumBuilderVersion: '1.3.9',
        contractPath: 'authoring.relationshipRules.queryControls',
        valueType: 'object',
      },
      designTokens: {
        minimumBuilderVersion: '1.5.0',
        contractPath: 'designTokens',
        valueType: 'object',
        optional: true,
        fallback: 'globalStyles-and-neutral-archetype',
      },
      siteBranding: {
        minimumBuilderVersion: '1.5.0',
        contractPath: 'siteBranding.resource',
        valueType: 'object',
        optional: true,
        fallback: 'no-site-wide-logo-write',
      },
      compositions: {
        minimumBuilderVersion: '1.5.1',
        contractPath: 'authoring.compositions.version',
        expectedValue: 1,
        optional: true,
        fallback: 'existing-pattern-authoring',
      },
    },
    reason: "No verified portable Builder contract snapshot is bundled. Authoring must use the current target site's live contract.",
  });
  assert.equal(manifest.skillVersion, packageMetadata.version);
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
  const packedPaths = packResult[0].files.map((file) => file.path);
  assert.equal(
    packedPaths.includes('monteby-site-authoring/references/expert-content-authoring.md'),
    true,
    'expert-content guidance must ship in the npm package'
  );
  assert.equal(
    packedPaths.includes('monteby-site-authoring/scripts/resolved-design-profile.js'),
    true,
    'the shared design profile resolver must ship in the npm package'
  );
  assert.equal(
    packedPaths.some((file) => file.startsWith('audit-evidence/')),
    false,
    'rejected audit prototypes must stay outside the published package'
  );
  for (const rejected of [
    'monteby-site-authoring/scripts/compare-geometry.js',
    'monteby-site-authoring/scripts/extract-reference-spec.mjs',
    'monteby-site-authoring/scripts/spec-to-layout.mjs',
    'monteby-site-authoring/quarantine/quick-start-runbook.unsafe-draft.md',
  ]) {
    assert.equal(packedPaths.includes(rejected), false, `${rejected} must not ship`);
  }
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
