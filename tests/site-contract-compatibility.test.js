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
    skillVersion: '0.6.0',
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
      nativeIconAuthoring: {
        minimumBuilderVersion: '1.5.3',
        contractPath: 'iconCatalog.version',
        expectedValue: 1,
        optional: true,
        fallback: 'block-native-icon-authoring-without-approved-catalog',
      },
      compositions: {
        minimumBuilderVersion: '1.5.1',
        contractPath: 'authoring.compositions.version',
        expectedValue: 1,
        optional: true,
        fallback: 'existing-pattern-authoring',
      },
      contractLightProjection: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'mode',
        expectedValue: 'light',
        optional: true,
        fallback: 'full-contract-discovery',
      },
      contractDesignProjection: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'mode',
        expectedValue: 'design',
        optional: true,
        fallback: 'full-contract-compositions',
      },
      contractAuthoringProjection: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'mode',
        expectedValue: 'authoring',
        optional: true,
        fallback: 'full-contract-discovery',
      },
      contractCatalogsProjection: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'mode',
        expectedValue: 'catalogs',
        optional: true,
        fallback: 'full-contract-catalogs',
      },
      contractComponentsSummary: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'componentsMode',
        expectedValue: 'summary',
        optional: true,
        fallback: 'full-component-catalog',
      },
      annotatedRender: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.annotatedRender',
        expectedValue: true,
        optional: true,
        fallback: 'unannotated-preview-selection',
      },
      renderLayoutFilter: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.renderLayoutFilter',
        expectedValue: true,
        optional: true,
        fallback: 'no-request-scoped-layout-preview',
      },
      renderGlobalStylesFilter: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.renderGlobalStylesFilter',
        expectedValue: true,
        optional: true,
        fallback: 'preview-without-global-styles-candidate',
      },
      renderGlobalTemplateFilter: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.renderGlobalTemplateFilter',
        expectedValue: true,
        optional: true,
        fallback: 'stored-global-template-selection',
      },
      previewGlobalTemplates: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.previewGlobalTemplates',
        expectedValue: true,
        optional: true,
        fallback: 'preview-without-site-chrome',
      },
      compositionInstantiate: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.compositions.resources.instantiate',
        valueType: 'object',
        optional: true,
        fallback: 'local-layout-kit-expansion',
      },
      compositionPlan: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.compositions.resources.plan',
        valueType: 'object',
        optional: true,
        fallback: 'local-layout-kit-expansion',
      },
      revisionRestore: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'layoutPersistence.resources.restoreRevision',
        valueType: 'object',
        optional: true,
        fallback: 'manual-versioned-layout-save',
      },
      bulkCreate: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'layoutPersistence.resources.bulkCreate',
        valueType: 'object',
        optional: true,
        fallback: 'sequential-single-page-writes',
      },
      globalStylesPatch: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'globalStyles.resource.patchMethod',
        expectedValue: 'PATCH',
        optional: true,
        fallback: 'full-document-put',
      },
      designProfiles: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.designProfiles.version',
        expectedValue: 1,
        optional: true,
        fallback: 'manual-global-styles-proposal',
      },
      motionAuthoring: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.motion.version',
        expectedValue: 1,
        optional: true,
        fallback: 'no-generated-motion',
      },
      motionRecipes: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.motionRecipes',
        expectedValue: true,
        optional: true,
        fallback: 'no-generated-motion',
      },
      contractComponent: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'layoutPersistence.resources.contractComponent',
        valueType: 'object',
        optional: true,
        fallback: 'full-contract-components',
      },
      abilities: {
        minimumBuilderVersion: '1.6.0',
        contractPath: 'authoring.capabilities.abilities',
        expectedValue: true,
        unavailableValue: false,
        optional: true,
        fallback: 'rest-only',
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
    packedPaths.includes('monteby-site-authoring/scripts/historical-benchmark-recipes.js'),
    true,
    'the explicitly gated historical benchmark recipes must ship with the drafter'
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
