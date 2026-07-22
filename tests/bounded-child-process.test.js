#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const test = require('node:test');

const { runBoundedProcess } = require('../monteby-site-authoring/scripts/bounded-child-process');

test('bounded child runner requires explicit finite bounds', () => {
  assert.throws(
    () => runBoundedProcess(process.execPath, ['--version'], { timeoutMs: 0 }),
    /positive integer timeoutMs/
  );
  assert.throws(
    () => runBoundedProcess(process.execPath, ['--version'], { timeoutMs: 100, forceKillAfterMs: -1 }),
    /non-negative integer forceKillAfterMs/
  );
});

test('bounded child runner kills a stuck generated target and its detached descendant', { timeout: 5000 }, async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX process-state assertion');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-bounded-child-'));
  const childScript = path.join(directory, 'generate-random-html-target.js');
  const pidFile = path.join(directory, 'processes.json');
  fs.writeFileSync(childScript, `'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const descendant = spawn(process.execPath, ['-e', ${JSON.stringify("process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);")}], {
  detached: true,
  stdio: 'ignore',
});
fs.writeFileSync(process.argv[2], JSON.stringify({ child: process.pid, descendant: descendant.pid }));
process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);
`);

  const result = await runBoundedProcess(process.execPath, [childScript, pidFile], {
    timeoutMs: 150,
    forceKillAfterMs: 100,
  });
  const processIds = Object.values(JSON.parse(fs.readFileSync(pidFile, 'utf8')));
  t.after(() => {
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  });

  assert.equal(result.status, 1);
  assert.equal(result.code, 'child_process_timeout');
  assert.equal(result.timedOut, true);
  assert.equal(result.timeoutMs, 150);
  assert.equal(result.terminationAttempted, true);
  assert.equal(result.forceKillSent, true);
  assert.ok(result.durationMs < 2000);

  await new Promise((resolve) => setTimeout(resolve, 100));
  for (const pid of processIds) {
    const state = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
    assert.equal(state.stdout.trim() === '' || state.stdout.trim().startsWith('Z'), true, `process ${pid} is still alive with state ${state.stdout.trim()}`);
  }
});

test('bounded child runner cleans descendants when its parent is terminated', { timeout: 5000 }, async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX signal assertion');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-bounded-parent-signal-'));
  const workerScript = path.join(directory, 'generated-target-worker.js');
  const wrapperScript = path.join(directory, 'benchmark-parent.js');
  const pidFile = path.join(directory, 'processes.json');
  const helperPath = path.join(__dirname, '..', 'monteby-site-authoring', 'scripts', 'bounded-child-process.js');

  fs.writeFileSync(workerScript, `'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const descendant = spawn(process.execPath, ['-e', ${JSON.stringify("setInterval(() => {}, 1000);")}], {
  detached: true,
  stdio: 'ignore',
});
fs.writeFileSync(process.argv[2], JSON.stringify({ worker: process.pid, descendant: descendant.pid }));
setInterval(() => {}, 1000);
`);
  fs.writeFileSync(wrapperScript, `'use strict';
const { runBoundedProcess } = require(${JSON.stringify(helperPath)});
runBoundedProcess(process.execPath, [${JSON.stringify(workerScript)}, ${JSON.stringify(pidFile)}], { timeoutMs: 10000 });
`);

  const wrapper = spawn(process.execPath, [wrapperScript], { stdio: 'ignore' });
  let processIds = [];
  t.after(() => {
    try {
      wrapper.kill('SIGKILL');
    } catch {}
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  });

  for (let attempt = 0; attempt < 100 && !fs.existsSync(pidFile); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(fs.existsSync(pidFile), true);
  processIds = Object.values(JSON.parse(fs.readFileSync(pidFile, 'utf8')));

  wrapper.kill('SIGTERM');
  const close = await new Promise((resolve) => {
    wrapper.once('close', (status, signal) => resolve({ status, signal }));
  });
  assert.equal(close.status, null);
  assert.equal(close.signal, 'SIGTERM');

  await new Promise((resolve) => setTimeout(resolve, 100));
  for (const pid of processIds) {
    const state = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
    assert.equal(state.stdout.trim() === '' || state.stdout.trim().startsWith('Z'), true, `process ${pid} is still alive with state ${state.stdout.trim()}`);
  }
});
