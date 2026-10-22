#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('node:crypto');

const SKILLS = [
  'monteby-site-authoring',
  'monteby-widget-development',
];

const UNSHIPPED_SKILL_PATHS = {
  'monteby-site-authoring': [
    'scripts/compare-geometry.js',
    'scripts/extract-reference-spec.mjs',
    'scripts/spec-to-layout.mjs',
    'quarantine',
  ],
};

function usage() {
  return `Monteby Skills installer

Usage:
  monteby-skills [options]
  monteby-skills install [options]

Options:
  --target <codex|claude|both>     Agent target. Default: both
  --scope <user|project>           Install scope. Default: user
  --project-dir <path>             Project directory for project scope. Default: cwd
  --skills <list>                  Comma-separated skills. Default: all
  --codex-dir <path>               Override Codex skills directory
  --claude-dir <path>              Override Claude Code skills directory
  --codex-legacy                   Also install Codex skills to ~/.codex/skills
  --dry-run                        Print actions without writing files
  --check                          Compare installed files without writing; fail on drift
  --help                           Show this help

Examples:
  npx github:gotowebpl/monteby-skills
  npx github:gotowebpl/monteby-skills --target codex --codex-legacy
  npx github:gotowebpl/monteby-skills --target claude --scope project --project-dir .
`;
}

function parseArgs(argv) {
  const options = {
    target: 'both',
    scope: 'user',
    projectDir: process.cwd(),
    skills: SKILLS,
    codexDir: '',
    claudeDir: '',
    codexLegacy: false,
    dryRun: false,
    check: false,
    help: false,
  };

  const args = [...argv];
  if (args[0] === 'install') {
    args.shift();
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    if (arg === '--codex-legacy') {
      options.codexLegacy = true;
      continue;
    }

    const valueOption = [
      '--target',
      '--scope',
      '--project-dir',
      '--skills',
      '--codex-dir',
      '--claude-dir',
    ].includes(arg);

    if (!valueOption) {
      throw new Error(`Unknown option: ${arg}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    index += 1;
    switch (arg) {
      case '--target':
        options.target = value;
        break;
      case '--scope':
        options.scope = value;
        break;
      case '--project-dir':
        options.projectDir = path.resolve(value);
        break;
      case '--skills':
        options.skills = value.split(',').map((item) => item.trim()).filter(Boolean);
        break;
      case '--codex-dir':
        options.codexDir = path.resolve(expandHome(value));
        break;
      case '--claude-dir':
        options.claudeDir = path.resolve(expandHome(value));
        break;
      default:
        break;
    }
  }

  validateOptions(options);

  return options;
}

function validateOptions(options) {
  if (!['codex', 'claude', 'both'].includes(options.target)) {
    throw new Error('--target must be one of: codex, claude, both');
  }
  if (!['user', 'project'].includes(options.scope)) {
    throw new Error('--scope must be one of: user, project');
  }
  for (const skill of options.skills) {
    if (!SKILLS.includes(skill)) {
      throw new Error(`Unknown skill "${skill}". Available: ${SKILLS.join(', ')}`);
    }
  }
}

function expandHome(input) {
  if (input === '~') {
    return os.homedir();
  }
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

function packageRoot() {
  return path.resolve(__dirname, '..');
}

function ensureSkillExists(skill) {
  const source = path.join(packageRoot(), skill);
  const skillFile = path.join(source, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    throw new Error(`Missing bundled skill: ${skillFile}`);
  }

  return source;
}

function targetDirectories(options) {
  const directories = [];
  const installCodex = options.target === 'codex' || options.target === 'both';
  const installClaude = options.target === 'claude' || options.target === 'both';
  const projectDir = options.projectDir;

  if (installCodex) {
    if (options.codexDir) {
      directories.push({ agent: 'Codex', dir: options.codexDir });
    } else if (options.scope === 'project') {
      directories.push({ agent: 'Codex', dir: path.join(projectDir, '.agents', 'skills') });
    } else {
      directories.push({ agent: 'Codex', dir: path.join(os.homedir(), '.agents', 'skills') });
    }

    if (options.codexLegacy && options.scope === 'user') {
      directories.push({ agent: 'Codex legacy', dir: path.join(os.homedir(), '.codex', 'skills') });
    }
  }

  if (installClaude) {
    if (options.claudeDir) {
      directories.push({ agent: 'Claude Code', dir: options.claudeDir });
    } else if (options.scope === 'project') {
      directories.push({ agent: 'Claude Code', dir: path.join(projectDir, '.claude', 'skills') });
    } else {
      directories.push({ agent: 'Claude Code', dir: path.join(os.homedir(), '.claude', 'skills') });
    }
  }

  return directories;
}

function copySkill(source, destination, dryRun) {
  if (dryRun) {
    return;
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

function copySkillRuntimeDependencies(skill, destination, dryRun, dependencies) {
  if (dryRun || skill !== 'monteby-site-authoring') {
    return;
  }

  const destinationNodeModules = path.join(destination, 'scripts', 'node_modules');

  for (const [dependency, source] of dependencies) {
    fs.mkdirSync(destinationNodeModules, { recursive: true });
    fs.cpSync(source, path.join(destinationNodeModules, dependency), {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
  }
}

function removeUnshippedSkillArtifacts(skill, destination, dryRun) {
  if (dryRun) {
    return;
  }

  for (const relativePath of UNSHIPPED_SKILL_PATHS[skill] || []) {
    fs.rmSync(path.join(destination, relativePath), { recursive: true, force: true });
  }
}

function install(options) {
  const directories = targetDirectories(options);
  const planned = [];
  const runtimeDependencies = new Map();

  if ((options.check || !options.dryRun) && options.skills.includes('monteby-site-authoring')) {
    for (const dependency of ['pixelmatch', 'pngjs']) {
      try {
        runtimeDependencies.set(dependency, path.dirname(require.resolve(`${dependency}/package.json`)));
      } catch {
        throw new Error(`Missing runtime dependency: ${dependency}. Run npm ci in a source checkout or reinstall the npm package.`);
      }
    }
  }

  for (const skill of options.skills) {
    const source = ensureSkillExists(skill);
    for (const target of directories) {
      const destination = path.join(target.dir, skill);
      planned.push({ skill, source, destination, agent: target.agent });
    }
  }

  if (planned.length === 0) {
    throw new Error('No install targets selected.');
  }

  for (const item of planned) {
    if (options.check) {
      const expected = skillFileHashes(item.source, UNSHIPPED_SKILL_PATHS[item.skill] || []);
      if (item.skill === 'monteby-site-authoring') {
        for (const [dependency, dependencyPath] of runtimeDependencies) {
          for (const [file, hash] of skillFileHashes(dependencyPath)) {
            expected.set(`scripts/node_modules/${dependency}/${file}`, hash);
          }
        }
      }
      const actual = skillFileHashes(item.destination);
      const missing = [...expected.keys()].filter((file) => !actual.has(file));
      const changed = [...expected.keys()].filter((file) => actual.has(file) && actual.get(file) !== expected.get(file));
      const extra = [...actual.keys()].filter((file) => !expected.has(file));
      const digest = createHash('sha256').update(JSON.stringify([...expected].sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
      console.log(JSON.stringify({ mode: 'check', skill: item.skill, destination: item.destination, sourceSha256: digest, missing, changed, extra }));
      if (missing.length || changed.length || extra.length) process.exitCode = 1;
      continue;
    }
    console.log(`${options.dryRun ? '[dry-run] ' : ''}${item.agent}: ${item.skill} -> ${item.destination}`);
    copySkill(item.source, item.destination, options.dryRun);
    removeUnshippedSkillArtifacts(item.skill, item.destination, options.dryRun);
    copySkillRuntimeDependencies(item.skill, item.destination, options.dryRun, runtimeDependencies);
  }

  if (!options.dryRun && !options.check) {
    console.log('');
    console.log('Monteby skills installed.');
  }
}

function skillFileHashes(directory, excluded = [], prefix = '', hashes = new Map()) {
  if (!fs.existsSync(directory)) return hashes;
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Refusing to follow skill symlink: ${directory}`);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (excluded.some((item) => relative === item || relative.startsWith(`${item}/`))) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to follow skill symlink: ${absolute}`);
    if (entry.isDirectory()) skillFileHashes(absolute, excluded, relative, hashes);
    else if (entry.isFile()) hashes.set(relative, createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'));
    else throw new Error(`Unsupported skill file: ${absolute}`);
  }
  return hashes;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    install(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error(usage());
    process.exitCode = 1;
  }
}

main();
