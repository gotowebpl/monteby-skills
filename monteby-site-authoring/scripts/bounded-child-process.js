'use strict';

const { spawn, spawnSync } = require('node:child_process');

const DEFAULT_FORCE_KILL_AFTER_MS = 500;

function runBoundedProcess(command, args, options = {}) {
  const timeoutMs = Number(options.timeoutMs);
  const forceKillAfterMs = options.forceKillAfterMs === undefined
    ? DEFAULT_FORCE_KILL_AFTER_MS
    : Number(options.forceKillAfterMs);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('runBoundedProcess requires a positive integer timeoutMs');
  }
  if (!Number.isInteger(forceKillAfterMs) || forceKillAfterMs < 0) {
    throw new Error('runBoundedProcess requires a non-negative integer forceKillAfterMs');
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let spawnError = null;
    let timedOut = false;
    let terminationAttempted = false;
    let forceKillSent = false;
    let knownProcessIds = [];
    let timeoutHandle;
    let forceKillHandle;
    let child;
    const parentSignalHandlers = new Map();

    const terminateForParentExit = () => {
      knownProcessIds = [...new Set([...knownProcessIds, ...processTreePids(child?.pid)])];
      terminateProcessTree(child?.pid, 'SIGKILL', knownProcessIds);
    };
    const removeParentHandlers = () => {
      process.removeListener('exit', terminateForParentExit);
      for (const [signal, handler] of parentSignalHandlers) {
        process.removeListener(signal, handler);
      }
      parentSignalHandlers.clear();
    };

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        status: 1,
        signal: null,
        stdout,
        stderr,
        timedOut: false,
        timeoutMs,
        durationMs: Date.now() - startedAt,
        code: 'child_process_spawn_failed',
        error,
        terminationAttempted: false,
        forceKillSent: false,
      });
      return;
    }

    const parentSignals = process.platform === 'win32'
      ? ['SIGINT', 'SIGTERM']
      : ['SIGHUP', 'SIGINT', 'SIGTERM'];
    for (const signal of parentSignals) {
      const handler = () => {
        terminateForParentExit();
        removeParentHandlers();
        process.kill(process.pid, signal);
      };
      parentSignalHandlers.set(signal, handler);
      process.once(signal, handler);
    }
    process.once('exit', terminateForParentExit);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      spawnError = error;
    });

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      knownProcessIds = processTreePids(child.pid);
      terminationAttempted = terminateProcessTree(child.pid, 'SIGTERM', knownProcessIds);
      forceKillHandle = setTimeout(() => {
        forceKillSent = terminateProcessTree(child.pid, 'SIGKILL', knownProcessIds);
      }, forceKillAfterMs);
    }, timeoutMs);

    child.once('close', (status, signal) => {
      clearTimeout(timeoutHandle);
      clearTimeout(forceKillHandle);
      removeParentHandlers();

      if (timedOut) {
        forceKillSent = terminateProcessTree(child.pid, 'SIGKILL', knownProcessIds) || forceKillSent;
      }

      resolve({
        status: status === null ? 1 : status,
        signal,
        stdout,
        stderr,
        timedOut,
        timeoutMs,
        durationMs: Date.now() - startedAt,
        code: timedOut
          ? 'child_process_timeout'
          : spawnError
            ? 'child_process_spawn_failed'
            : '',
        error: spawnError,
        terminationAttempted,
        forceKillSent,
      });
    });
  });
}

function processTreePids(rootPid) {
  if (!Number.isInteger(rootPid) || rootPid <= 0 || rootPid === process.pid) {
    return [];
  }
  if (process.platform === 'win32') {
    return [rootPid];
  }

  const result = spawnSync('ps', ['-axo', 'pid=,ppid='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 1000,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') {
    return [rootPid];
  }

  const childrenByParent = new Map();
  for (const line of result.stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    const parentPid = Number(match[2]);
    const children = childrenByParent.get(parentPid) || [];
    children.push(pid);
    childrenByParent.set(parentPid, children);
  }

  const processIds = [rootPid];
  for (let index = 0; index < processIds.length; index += 1) {
    processIds.push(...(childrenByParent.get(processIds[index]) || []));
  }

  return [...new Set(processIds)];
}

function terminateProcessTree(rootPid, signal, knownProcessIds = []) {
  if (!Number.isInteger(rootPid) || rootPid <= 0 || rootPid === process.pid) {
    return false;
  }

  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(rootPid), '/T', '/F'], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 5000,
      windowsHide: true,
    });
    return result.status === 0;
  }

  const processIds = [...new Set([
    ...knownProcessIds,
    ...processTreePids(rootPid),
    rootPid,
  ])].filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  let terminated = false;

  for (const pid of processIds.reverse()) {
    try {
      process.kill(-pid, signal);
      terminated = true;
    } catch {}

    try {
      process.kill(pid, signal);
      terminated = true;
    } catch {}
  }

  return terminated;
}

module.exports = {
  runBoundedProcess,
};
