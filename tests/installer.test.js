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

test('installer and check resolve npm-hoisted screenshot dependencies', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-skills-hoisted-'));
  const modules = path.join(directory, 'node_modules');
  const packageDirectory = path.join(modules, '@gotowebpl', 'monteby-skills');
  const projectDirectory = path.join(directory, 'project');
  try {
    for (const entry of ['bin', 'monteby-site-authoring', 'monteby-widget-development']) {
      fs.cpSync(path.join(root, entry), path.join(packageDirectory, entry), { recursive: true });
    }
    for (const dependency of ['pixelmatch', 'pngjs']) {
      fs.cpSync(path.dirname(require.resolve(`${dependency}/package.json`)), path.join(modules, dependency), { recursive: true });
    }
    assert.equal(fs.existsSync(path.join(packageDirectory, 'node_modules')), false);
    const args = [path.join(packageDirectory, 'bin', 'monteby-skills.js'), '--target', 'both', '--scope', 'project', '--project-dir', projectDirectory];
    const installed = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(installed.status, 0, installed.stderr);
    for (const agentDirectory of ['.agents', '.claude']) {
      const scripts = path.join(projectDirectory, agentDirectory, 'skills', 'monteby-site-authoring', 'scripts');
      for (const dependency of ['pixelmatch', 'pngjs']) {
        assert.equal(fs.existsSync(path.join(scripts, 'node_modules', dependency, 'package.json')), true);
      }
      const runtime = spawnSync(process.execPath, [path.join(scripts, 'compare-screenshots.js'), '--help'], { encoding: 'utf8' });
      assert.equal(runtime.status, 0, runtime.stderr);
    }
    const checked = spawnSync(process.execPath, [...args, '--check'], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
    const reports = checked.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(reports.length, 4);
    for (const report of reports) assert.deepEqual([report.missing, report.changed, report.extra], [[], [], []]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missing screenshot dependencies fail before replacing installed skills while dry-run stays read-only', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-skills-dependencies-'));
  const packageDirectory = path.join(directory, 'package');
  const projectDirectory = path.join(directory, 'project');
  const destination = path.join(projectDirectory, '.agents', 'skills', 'monteby-site-authoring');
  try {
    fs.cpSync(path.join(root, 'bin'), path.join(packageDirectory, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(packageDirectory, 'monteby-site-authoring'), { recursive: true });
    fs.writeFileSync(path.join(packageDirectory, 'monteby-site-authoring', 'SKILL.md'), 'New bundled skill');
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'Keep existing installation');
    const args = [path.join(packageDirectory, 'bin', 'monteby-skills.js'), '--target', 'codex', '--scope', 'project', '--project-dir', projectDirectory, '--skills', 'monteby-site-authoring'];
    const options = { encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } };
    for (const extra of [[], ['--check']]) {
      const failed = spawnSync(process.execPath, [...args, ...extra], options);
      assert.equal(failed.status, 1, failed.stderr);
      assert.match(failed.stderr, /Missing runtime dependency: pixelmatch/);
      assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), 'Keep existing installation');
    }
    const dryRun = spawnSync(process.execPath, [...args, '--dry-run'], options);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), 'Keep existing installation');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
