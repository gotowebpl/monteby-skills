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
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'apply-layout-repair-queue.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'wordpress-layout-client.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'run-canonical-verification.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'render-monteby-preview.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'resolved-design-profile.js')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'references', 'mechanical-workflow-protocol.md')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'references', 'client-site-handoff.md')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'references', 'expert-content-authoring.md')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'agents', 'openai.yaml')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'node_modules', 'pngjs', 'package.json')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'node_modules', 'pixelmatch', 'package.json')), true);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'compare-geometry.js')), false);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'extract-reference-spec.mjs')), false);
  assert.equal(fs.existsSync(path.join(skillDir, 'scripts', 'spec-to-layout.mjs')), false);
  assert.equal(
    fs.existsSync(path.join(skillDir, 'quarantine', 'quick-start-runbook.unsafe-draft.md')),
    false
  );
});

test('check detects missing, changed and stale files without modifying an installation', () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-skills-check-'));
  const args = [installer, '--target', 'codex', '--scope', 'project', '--project-dir', projectDir];
  try {
    const installed = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(installed.status, 0, installed.stderr);
    const clean = spawnSync(process.execPath, [...args, '--check'], { encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr);
    const reports = clean.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(reports.length, 2);
    for (const report of reports) {
      assert.match(report.sourceSha256, /^[a-f0-9]{64}$/);
      assert.deepEqual([report.missing, report.changed, report.extra], [[], [], []]);
    }
    const skillDir = path.join(projectDir, '.agents', 'skills', 'monteby-widget-development');
    fs.appendFileSync(path.join(skillDir, 'SKILL.md'), '\nStale local edit.\n');
    fs.unlinkSync(path.join(skillDir, 'references', 'widget-development-playbook.md'));
    fs.writeFileSync(path.join(skillDir, 'obsolete.js'), 'stale');
    const changedBefore = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const drift = spawnSync(process.execPath, [...args, '--check', '--dry-run'], { encoding: 'utf8' });
    assert.equal(drift.status, 1, drift.stderr);
    const report = drift.stdout.trim().split('\n').map((line) => JSON.parse(line)).find((item) => item.skill === 'monteby-widget-development');
    assert.deepEqual(report.changed, ['SKILL.md']);
    assert.deepEqual(report.missing, ['references/widget-development-playbook.md']);
    assert.deepEqual(report.extra, ['obsolete.js']);
    assert.equal(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8'), changedBefore);
    assert.equal(fs.existsSync(path.join(skillDir, 'references', 'widget-development-playbook.md')), false);
    assert.equal(fs.readFileSync(path.join(skillDir, 'obsolete.js'), 'utf8'), 'stale');
    fs.symlinkSync(path.join(skillDir, 'SKILL.md'), path.join(skillDir, 'linked.md'));
    const symlink = spawnSync(process.execPath, [...args, '--check'], { encoding: 'utf8' });
    assert.equal(symlink.status, 1);
    assert.match(symlink.stderr, /Refusing to follow skill symlink/);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('check reports absent installations without creating directories', () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-skills-missing-'));
  try {
    const checked = spawnSync(process.execPath, [installer, '--check', '--target', 'codex', '--scope', 'project', '--project-dir', projectDir], { encoding: 'utf8' });
    assert.equal(checked.status, 1, checked.stderr);
    assert.equal(fs.existsSync(path.join(projectDir, '.agents')), false);
    assert.ok(checked.stdout.trim().split('\n').map((line) => JSON.parse(line)).every((item) => item.missing.includes('SKILL.md')));
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
