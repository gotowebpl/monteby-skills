#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const installer = path.join(root, 'bin', 'monteby-skills.js');

test('installer bundles screenshot comparison runtime dependencies for site authoring', () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-skills-install-'));

  const result = spawnSync(process.execPath, [
    installer,
    '--target',
    'codex',
    '--scope',
    'project',
    '--project-dir',
    projectDir,
    '--skills',
    'monteby-site-authoring',
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);

  const skillDir = path.join(projectDir, '.agents', 'skills', 'monteby-site-authoring');
  assert.equal(fs.existsSync(path.join(skillDir, 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'capture-template-reference.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'audit-target-manifest.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'audit-authoring-readiness.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'start-visual-benchmark.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'write-visual-brief.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'audit-rendered-media-parity.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'run-visual-benchmark.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'run-visual-iteration.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'render-monteby-preview.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'node_modules', 'pngjs', 'package.json')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'node_modules', 'pixelmatch', 'package.json')), true);
});
