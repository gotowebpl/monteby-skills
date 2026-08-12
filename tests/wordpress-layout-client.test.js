'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const REPO = path.resolve(__dirname, '..');
const CLIENT = path.join(
  REPO,
  'monteby-site-authoring',
  'scripts',
  'wordpress-layout-client.js'
);
const { canonicalSha256, nodeMapSha256, operationsSha256 } = require(CLIENT);
const AUTH = 'Basic dGVzdDpzZWNyZXQ=';
const NODE_MAP = {
  ROOT: {
    type: { resolvedName: 'RootCanvas' },
    isCanvas: true,
    props: {},
    nodes: ['section-1'],
  },
  'section-1': {
    type: { resolvedName: 'Section' },
    isCanvas: true,
    props: { background: '#ffffff' },
    parent: 'ROOT',
    nodes: [],
  },
};
const LAYOUT_SHA256 = nodeMapSha256(NODE_MAP);
const OPERATIONS = [{
  type: 'update_props',
  nodeId: 'section-1',
  props: { background: '#111111' },
  unsetProps: ['legacyColor'],
}];
const OPERATIONS_SHA256 = operationsSha256(OPERATIONS);

function patchContract() {
  return {
    layoutPersistence: {
      operations: {
        limits: { maxBatchItems: 100, maxPayloadBytes: 2097152 },
        operationSchemas: {
          update_props: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'nodeId'],
            properties: {
              type: { type: 'string', const: 'update_props' },
              nodeId: { type: 'string', minLength: 1 },
              props: { type: 'object' },
              unsetProps: { type: 'array', items: { type: 'string', minLength: 1 } },
            },
          },
        },
        validate: {
          method: 'POST',
          endpoint: '/monteby/v1/pages/{postId}/layout/operations/validate',
        },
        apply: {
          method: 'POST',
          endpoint: '/monteby/v1/pages/{postId}/layout/operations',
        },
      },
    },
  };
}

function tempDir(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordpress-layout-client-'));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  return directory;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function pageSnapshot(site, pageId, data) {
  return {
    schemaVersion: 1,
    artifact: 'monteby-page-snapshot',
    site,
    pageId,
    publicPageUrl: `${site}/page-${pageId}/`,
    capturedAt: '2026-07-26T08:00:00.000Z',
    data,
  };
}

function saveReport(site, pageId, layoutSha256 = LAYOUT_SHA256) {
  return {
    schemaVersion: 1,
    ok: true,
    stage: 'save',
    code: 'SAVE_OK',
    retryable: false,
    artifacts: { layoutSha256 },
    nextAction: {
      id: 'preview_saved_candidate',
      tool: CLIENT,
      args: [],
      requires: [],
      instruction: 'Preview the saved candidate.',
    },
    scope: { site, pageId },
    layoutSha256,
    evidence: {
      site,
      pageId,
      publicPageUrl: `${site}/page-${pageId}/`,
      layoutSha256,
    },
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : undefined;
}

async function startServer(t, handler) {
  const errors = [];
  const server = http.createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error) => {
      errors.push(error);
      if (!response.headersSent) {
        sendJson(response, 500, { code: 'test_server_error' });
      } else {
        response.end();
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return {
    errors,
    site: `http://127.0.0.1:${address.port}`,
  };
}

async function runClient(args, {
  auth = AUTH,
  env = {},
  timeoutMs = 5_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLIENT, ...args], {
      cwd: REPO,
      env: {
        ...process.env,
        MONTEBY_AUTH_HEADER: auth,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Client timed out. stdout=${stdout} stderr=${stderr}`));
    }, timeoutMs);
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (signal) {
        reject(new Error(`Client exited via ${signal}. stdout=${stdout} stderr=${stderr}`));
        return;
      }
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (error) {
        reject(new Error(`Client did not return JSON: ${error.message}\nstdout=${stdout}\nstderr=${stderr}`));
        return;
      }
      resolve({ exitCode, result, stderr, stdout });
    });
  });
}

function assertEnvelope(result, {
  ok,
  stage,
  code,
}) {
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.ok, ok);
  assert.equal(result.stage, stage);
  assert.equal(result.code, code);
  assert.equal(typeof result.retryable, 'boolean');
  assert.ok(result.artifacts && typeof result.artifacts === 'object');
  assert.deepEqual(
    Object.keys(result.nextAction).sort(),
    ['args', 'id', 'instruction', 'requires', 'tool'].sort()
  );
  assert.equal(typeof result.nextAction.id, 'string');
  assert.equal(typeof result.nextAction.tool, 'string');
  assert.ok(Array.isArray(result.nextAction.args));
  assert.ok(Array.isArray(result.nextAction.requires));
  assert.equal(typeof result.nextAction.instruction, 'string');
}

test('snapshot fetches contract before the page and atomically records both artifacts', async (t) => {
  const requests = [];
  const contract = { version: 1, components: [{ name: 'Section' }] };
  const before = {
    postModifiedGmt: '2026-07-26 08:00:00',
    nodeMap: NODE_MAP,
    presentation: { layout: 'default', disableGlobalTemplates: false },
  };
  const server = await startServer(t, (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    if (request.url === '/wp-json/monteby/v1/contract') {
      sendJson(response, 200, contract);
    } else if (request.url === '/wp-json/monteby/v1/pages/17/layout') {
      sendJson(response, 200, before);
    } else if (request.url === '/wp-json/wp/v2/pages/17?context=edit&_fields=id%2Clink') {
      sendJson(response, 200, { id: 17, link: `${server.site}/page-17/` });
    } else {
      sendJson(response, 404, { code: 'not_found' });
    }
  });
  const outDir = tempDir(t);

  const execution = await runClient([
    'snapshot',
    '--site', server.site,
    '--page-id', '17',
    '--out-dir', outDir,
  ]);

  assert.equal(execution.exitCode, 0);
  assert.equal(execution.stderr, '');
  assertEnvelope(execution.result, { ok: true, stage: 'snapshot', code: 'SNAPSHOT_OK' });
  assert.deepEqual(
    requests.map(({ method, url }) => `${method} ${url}`),
    [
      'GET /wp-json/monteby/v1/contract',
      'GET /wp-json/monteby/v1/pages/17/layout',
      'GET /wp-json/wp/v2/pages/17?context=edit&_fields=id%2Clink',
    ]
  );
  assert.ok(requests.every((request) => request.authorization === AUTH));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, 'contract.json'), 'utf8')), contract);
  const savedSnapshot = JSON.parse(
    fs.readFileSync(path.join(outDir, 'layout-before.json'), 'utf8')
  );
  assert.equal(savedSnapshot.schemaVersion, 1);
  assert.equal(savedSnapshot.artifact, 'monteby-page-snapshot');
  assert.equal(savedSnapshot.site, server.site);
  assert.equal(savedSnapshot.pageId, 17);
  assert.equal(savedSnapshot.publicPageUrl, `${server.site}/page-17/`);
  assert.equal(Number.isFinite(Date.parse(savedSnapshot.capturedAt)), true);
  assert.deepEqual(savedSnapshot.data, before);
  assert.equal(execution.result.artifacts.snapshot, path.join(outDir, 'layout-before.json'));
  assert.deepEqual(execution.result.evidence, { publicPageUrl: `${server.site}/page-17/` });
  assert.equal(execution.result.nextAction.id, 'validate_candidate');
  assert.deepEqual(
    execution.result.nextAction.args.slice(0, 6),
    ['validate', '--site', server.site, '--layout', '$MONTEBY_LAYOUT_PATH', '--out']
  );
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_LAYOUT_PATH'));
  assert.equal(
    fs.readdirSync(outDir).some((name) => name.endsWith('.tmp')),
    false,
    'atomic writes leave no temporary artifacts'
  );
  assert.deepEqual(server.errors, []);
});

test('non-retryable REST failures emit a terminal blocked action instead of looping', async (t) => {
  const server = await startServer(t, (_request, response) => {
    sendJson(response, 404, { code: 'rest_no_route' });
  });
  const outDir = tempDir(t);

  const execution = await runClient([
    'snapshot',
    '--site', server.site,
    '--page-id', '17',
    '--out-dir', outDir,
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, {
    ok: false,
    stage: 'snapshot',
    code: 'REST_NOT_FOUND',
  });
  assert.equal(execution.result.nextAction.id, 'blocked_client_error');
  assert.equal(execution.result.nextAction.tool, '');
  assert.deepEqual(execution.result.nextAction.args, []);
  assert.deepEqual(execution.result.nextAction.requires, ['EXPLICIT_ERROR_RESOLUTION']);
  assert.deepEqual(server.errors, []);
});

test('validate posts nodeMap, reads only the named auth environment variable, and redacts it', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const reportFile = path.join(directory, 'validate-response.json');
  writeJson(layoutFile, NODE_MAP);
  let receivedBody;
  let receivedAuth;
  const secret = 'Bearer custom-private-token';
  const server = await startServer(t, async (request, response) => {
    receivedAuth = request.headers.authorization;
    receivedBody = await readBody(request);
    sendJson(response, 200, { valid: true, reflectedAuthorization: receivedAuth });
  });

  const execution = await runClient([
    'validate',
    '--site', server.site,
    '--layout', layoutFile,
    '--out', reportFile,
    '--auth-header-env', 'WORDPRESS_TEST_AUTH',
  ], {
    auth: 'Bearer ignored-default-token',
    env: { WORDPRESS_TEST_AUTH: secret },
  });

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, { ok: true, stage: 'validate', code: 'VALIDATION_OK' });
  assert.equal(receivedAuth, secret);
  assert.deepEqual(receivedBody, { nodeMap: NODE_MAP });
  assert.equal(execution.result.layoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.artifacts.layoutSha256, LAYOUT_SHA256);
  assert.doesNotMatch(execution.stdout, /custom-private-token/);
  const persisted = fs.readFileSync(reportFile, 'utf8');
  assert.doesNotMatch(persisted, /custom-private-token/);
  assert.deepEqual(JSON.parse(persisted), execution.result);
  assert.equal(execution.result.response.reflectedAuthorization, '[REDACTED]');
  assert.equal(execution.result.nextAction.id, 'save_validated_candidate');
  assert.ok(execution.result.nextAction.args.includes('$MONTEBY_PAGE_ID'));
  assert.ok(execution.result.nextAction.args.includes('$MONTEBY_LAYOUT_SNAPSHOT'));
  assert.ok(execution.result.nextAction.args.includes(LAYOUT_SHA256));
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_PAGE_ID'));
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_LAYOUT_SNAPSHOT'));
  assert.deepEqual(server.errors, []);
});

test('save stops before validation and PUT when postModifiedGmt differs from the snapshot', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  writeJson(layoutFile, NODE_MAP);
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    sendJson(response, 200, {
      postModifiedGmt: '2026-07-26 08:05:00',
      nodeMap: NODE_MAP,
      presentation: { layout: 'default' },
    });
  });
  writeJson(
    path.join(directory, 'layout-before.json'),
    pageSnapshot(server.site, 17, {
      postModifiedGmt: '2026-07-26 08:00:00',
      nodeMap: NODE_MAP,
    })
  );

  const execution = await runClient([
    'save',
    '--site', server.site,
    '--page-id', '17',
    '--layout', layoutFile,
    '--out-dir', directory,
    '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save-conflict.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'save', code: 'REST_CONFLICT' });
  assert.equal(execution.result.retryable, false);
  assert.equal(execution.result.nextAction.id, 'resnapshot_and_reconcile');
  assert.equal(execution.result.nextAction.args[0], 'snapshot');
  assert.ok(execution.result.nextAction.requires.includes('MANUAL_LAYOUT_RECONCILIATION'));
  assert.deepEqual(requests, ['GET /wp-json/monteby/v1/pages/17/layout']);
  assert.equal(execution.result.artifacts.snapshot, path.join(directory, 'layout-before.json'));
  assert.deepEqual(server.errors, []);
});

test('save rejects a snapshot from another site or page before any REST request', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'layout-before.json');
  writeJson(layoutFile, NODE_MAP);
  let requestCount = 0;
  const server = await startServer(t, (request, response) => {
    requestCount += 1;
    sendJson(response, 500, { code: 'must_not_be_called' });
  });

  for (const scope of [
    { site: 'https://different.example', pageId: 17 },
    { site: server.site, pageId: 18 },
  ]) {
    writeJson(snapshotFile, pageSnapshot(scope.site, scope.pageId, {
      postModifiedGmt: '2026-07-26 08:00:00',
      nodeMap: NODE_MAP,
    }));
    const execution = await runClient([
      'save',
      '--site', server.site,
      '--page-id', '17',
      '--layout', layoutFile,
      '--snapshot', snapshotFile,
      '--expected-layout-sha256', LAYOUT_SHA256,
      '--out', path.join(directory, `save-scope-${scope.pageId}.json`),
    ]);

    assert.equal(execution.exitCode, 1);
    assertEnvelope(execution.result, {
      ok: false,
      stage: 'save',
      code: 'SNAPSHOT_SCOPE_MISMATCH',
    });
    assert.equal(execution.result.nextAction.id, 'snapshot_requested_page');
    assert.equal(execution.result.nextAction.args[0], 'snapshot');
  }
  assert.equal(requestCount, 0);
  assert.deepEqual(server.errors, []);
});

test('save rejects a candidate that differs from the validated SHA-256 before REST', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'layout-before.json');
  writeJson(layoutFile, NODE_MAP);
  let requestCount = 0;
  const server = await startServer(t, (request, response) => {
    requestCount += 1;
    sendJson(response, 500, { code: 'must_not_be_called' });
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: '2026-07-26 08:00:00',
  }));

  const execution = await runClient([
    'save',
    '--site', server.site,
    '--page-id', '17',
    '--layout', layoutFile,
    '--snapshot', snapshotFile,
    '--expected-layout-sha256', '0'.repeat(64),
    '--out', path.join(directory, 'save-response.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, {
    ok: false,
    stage: 'save',
    code: 'LAYOUT_SHA256_MISMATCH',
  });
  assert.equal(execution.result.layoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.nextAction.id, 'restart_validation_chain');
  assert.equal(requestCount, 0);
  assert.deepEqual(server.errors, []);
});

test('save validates before PUT and preserves fresh presentation while overriding only layout', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'custom-snapshot.json');
  writeJson(layoutFile, { nodeMap: NODE_MAP });
  const requests = [];
  const putBodies = [];
  const freshPresentation = {
    layout: 'full-width',
    disableGlobalTemplates: true,
    contentWidth: 'wide',
  };
  const server = await startServer(t, async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.method === 'GET') {
      sendJson(response, 200, {
        postModifiedGmt: '2026-07-26 08:00:00',
        nodeMap: { ROOT: { props: { remote: true } } },
        presentation: freshPresentation,
      });
    } else if (request.url.endsWith('/validate')) {
      assert.deepEqual(await readBody(request), { nodeMap: NODE_MAP });
      sendJson(response, 200, { valid: true });
    } else if (request.method === 'PUT') {
      putBodies.push(await readBody(request));
      sendJson(response, 200, { saved: true });
    } else {
      sendJson(response, 404, { code: 'not_found' });
    }
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: '2026-07-26 08:00:00',
    presentation: { layout: 'stale-value', disableGlobalTemplates: false },
  }));

  const first = await runClient([
    'save',
    '--site', server.site,
    '--page-id', '17',
    '--layout', layoutFile,
    '--snapshot', snapshotFile,
    '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save-first.json'),
  ]);
  const second = await runClient([
    'save',
    '--site', server.site,
    '--page-id', '17',
    '--layout', layoutFile,
    '--snapshot', snapshotFile,
    '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save-second.json'),
    '--presentation-layout', 'canvas',
  ]);

  assert.equal(first.exitCode, 0);
  assert.equal(second.exitCode, 0);
  assertEnvelope(first.result, { ok: true, stage: 'save', code: 'SAVE_OK' });
  assertEnvelope(second.result, { ok: true, stage: 'save', code: 'SAVE_OK' });
  assert.equal(first.result.response.presentationSource, 'fresh');
  assert.equal(first.result.response.presentationOverride, null);
  assert.equal(second.result.response.presentationSource, 'fresh');
  assert.equal(second.result.response.presentationOverride, 'canvas');
  assert.deepEqual(first.result.scope, { site: server.site, pageId: 17 });
  assert.equal(first.result.layoutSha256, LAYOUT_SHA256);
  assert.equal(first.result.artifacts.layoutSha256, LAYOUT_SHA256);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(directory, 'save-first.json'), 'utf8')),
    first.result
  );
  assert.equal(first.result.nextAction.id, 'preview_saved_candidate');
  assert.equal(first.result.nextAction.args[0], 'preview');
  assert.ok(first.result.nextAction.args.includes(path.join(directory, 'save-first.json')));
  assert.ok(first.result.nextAction.args.includes(path.join(directory, 'preview-response.json')));
  assert.ok(first.result.nextAction.args.includes(path.join(directory, 'preview.html')));
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/pages/17/layout',
    'POST /wp-json/monteby/v1/validate',
    'PUT /wp-json/monteby/v1/pages/17/layout',
    'GET /wp-json/monteby/v1/pages/17/layout',
    'POST /wp-json/monteby/v1/validate',
    'PUT /wp-json/monteby/v1/pages/17/layout',
  ]);
  assert.deepEqual(putBodies[0], {
    expectedModifiedGmt: '2026-07-26 08:00:00',
    nodeMap: NODE_MAP,
    presentation: freshPresentation,
  });
  assert.deepEqual(putBodies[1], {
    expectedModifiedGmt: '2026-07-26 08:00:00',
    nodeMap: NODE_MAP,
    presentation: {
      ...freshPresentation,
      layout: 'canvas',
      disableGlobalTemplates: true,
    },
  });
  assert.deepEqual(server.errors, []);
});

test('save rejects an unknown presentation layout before making a request', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  writeJson(layoutFile, NODE_MAP);
  writeJson(snapshotFile, pageSnapshot('https://site.example.test', 17, {
    postModifiedGmt: '2026-07-26 08:00:00',
  }));

  const execution = await runClient([
    'save',
    '--site', 'https://site.example.test',
    '--page-id', '17',
    '--layout', layoutFile,
    '--snapshot', snapshotFile,
    '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save.json'),
    '--presentation-layout', 'banana',
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'save', code: 'CLI_USAGE' });
  assert.equal(execution.result.nextAction.id, 'blocked_client_usage');
  assert.equal(execution.result.nextAction.tool, '');
  assert.deepEqual(execution.result.nextAction.args, []);
  assert.deepEqual(execution.result.nextAction.requires, ['VALID_CLIENT_ARGUMENTS']);
});

test('save blocks a presentation override when the live page exposes no presentation capability', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  writeJson(layoutFile, NODE_MAP);
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    sendJson(response, 200, {
      postModifiedGmt: 'v1',
      nodeMap: NODE_MAP,
    });
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: 'v1',
    nodeMap: NODE_MAP,
  }));

  const execution = await runClient([
    'save',
    '--site', server.site,
    '--page-id', '17',
    '--layout', layoutFile,
    '--snapshot', snapshotFile,
    '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save.json'),
    '--presentation-layout', 'canvas',
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, {
    ok: false,
    stage: 'save',
    code: 'PRESENTATION_CAPABILITY_MISSING',
  });
  assert.equal(execution.result.nextAction.id, 'blocked_client_error');
  assert.equal(execution.result.nextAction.tool, '');
  assert.deepEqual(execution.result.nextAction.args, []);
  assert.deepEqual(requests, ['GET /wp-json/monteby/v1/pages/17/layout']);
  assert.deepEqual(server.errors, []);
});

test('save maps PUT 428 and 409 to stable non-retryable codes without retrying', async (t) => {
  for (const [status, code] of [
    [428, 'REST_PRECONDITION_REQUIRED'],
    [409, 'REST_CONFLICT'],
  ]) {
    const directory = tempDir(t);
    const layoutFile = path.join(directory, `layout-${status}.json`);
    const snapshotFile = path.join(directory, `snapshot-${status}.json`);
    writeJson(layoutFile, NODE_MAP);
    const requests = [];
    const server = await startServer(t, async (request, response) => {
      requests.push(`${request.method} ${request.url}`);
      if (request.method === 'GET') {
        sendJson(response, 200, {
          postModifiedGmt: 'v1',
          presentation: { layout: 'default', disableGlobalTemplates: false },
        });
      } else if (request.url.endsWith('/validate')) {
        await readBody(request);
        sendJson(response, 200, { valid: true });
      } else {
        await readBody(request);
        response.writeHead(status, { 'Content-Type': 'text/plain' });
        response.end();
      }
    });
    writeJson(snapshotFile, pageSnapshot(server.site, 21, { postModifiedGmt: 'v1' }));

    const execution = await runClient([
      'save',
      '--site', server.site,
      '--page-id', '21',
      '--layout', layoutFile,
      '--snapshot', snapshotFile,
      '--expected-layout-sha256', LAYOUT_SHA256,
      '--out', path.join(directory, `save-${status}.json`),
    ]);

    assert.equal(execution.exitCode, 1);
    assertEnvelope(execution.result, { ok: false, stage: 'save', code });
    assert.equal(execution.result.retryable, false);
    assert.equal(execution.result.nextAction.id, 'resnapshot_and_reconcile');
    assert.equal(execution.result.nextAction.args[0], 'snapshot');
    assert.deepEqual(requests, [
      'GET /wp-json/monteby/v1/pages/21/layout',
      'POST /wp-json/monteby/v1/validate',
      'PUT /wp-json/monteby/v1/pages/21/layout',
    ]);
    assert.deepEqual(server.errors, []);
  }
});

test('patch-validate discovers the live schemas and binds snapshot, operations, and candidate digests', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  const reportFile = path.join(directory, 'patch-validate-response.json');
  writeJson(operationsFile, OPERATIONS);
  const requests = [];
  let validateBody;
  const server = await startServer(t, async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) return sendJson(response, 200, patchContract());
    validateBody = await readBody(request);
    return sendJson(response, 200, {
      valid: true,
      operationCount: 1,
      operationsSha256: OPERATIONS_SHA256,
      candidateLayoutSha256: LAYOUT_SHA256,
      compiledHtmlSha256: 'a'.repeat(64),
      postModifiedGmt: 'v1',
      layout: NODE_MAP,
      migration: { sourceSchemaVersion: 1, targetSchemaVersion: 2 },
    });
  });
  const snapshot = pageSnapshot(server.site, 17, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
  writeJson(snapshotFile, snapshot);

  const execution = await runClient([
    'patch-validate', '--site', server.site, '--page-id', '17',
    '--operations', operationsFile, '--snapshot', snapshotFile, '--out', reportFile,
  ]);

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, { ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK' });
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'POST /wp-json/monteby/v1/pages/17/layout/operations/validate',
  ]);
  assert.deepEqual(validateBody, { operations: OPERATIONS, expectedModifiedGmt: 'v1' });
  assert.equal(execution.result.evidence.operationsSha256, OPERATIONS_SHA256);
  assert.equal(execution.result.evidence.snapshotSha256, canonicalSha256(snapshot));
  assert.equal(execution.result.evidence.candidateLayoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.nextAction.id, 'save_validated_patch');
  assert.ok(execution.result.nextAction.args.includes(OPERATIONS_SHA256));
  assert.ok(execution.result.nextAction.args.includes(LAYOUT_SHA256));
  assert.deepEqual(JSON.parse(fs.readFileSync(reportFile, 'utf8')), execution.result);
  assert.deepEqual(server.errors, []);
});

test('patch-save applies only the exact preflighted batch and sends both server preconditions', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  const reportFile = path.join(directory, 'patch-validate-response.json');
  writeJson(operationsFile, OPERATIONS);
  const requests = [];
  let applyBody;
  const server = await startServer(t, async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) return sendJson(response, 200, patchContract());
    if (request.method === 'GET') return sendJson(response, 200, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
    applyBody = await readBody(request);
    return sendJson(response, 200, {
      operationCount: 1,
      operationsSha256: OPERATIONS_SHA256,
      candidateLayoutSha256: LAYOUT_SHA256,
      compiledHtmlSha256: 'a'.repeat(64),
      postModifiedGmt: 'v2',
    });
  });
  const snapshot = pageSnapshot(server.site, 17, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
  writeJson(snapshotFile, snapshot);
  writeJson(reportFile, {
    schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    scope: { site: server.site, pageId: 17 },
    evidence: {
      postModifiedGmt: 'v1', operationsSha256: OPERATIONS_SHA256,
      snapshotSha256: canonicalSha256(snapshot),
      candidateLayoutSha256: LAYOUT_SHA256,
    },
  });

  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17',
    '--operations', operationsFile, '--snapshot', snapshotFile,
    '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'patch-save-response.json'),
  ]);

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, { ok: true, stage: 'patch-save', code: 'PATCH_SAVE_OK' });
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/17/layout',
    'POST /wp-json/monteby/v1/pages/17/layout/operations',
  ]);
  assert.deepEqual(applyBody, {
    operations: OPERATIONS,
    expectedModifiedGmt: 'v1',
    expectedCandidateSha256: LAYOUT_SHA256,
  });
  assert.equal(execution.result.nextAction.id, 'verify_saved_patch');
  assert.deepEqual(server.errors, []);
});

test('patch-save never applies or retries after a concurrent page change', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  const reportFile = path.join(directory, 'patch-validate-response.json');
  writeJson(operationsFile, OPERATIONS);
  let applyCount = 0;
  const server = await startServer(t, (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, patchContract());
    if (request.method === 'POST') applyCount += 1;
    return sendJson(response, 200, { postModifiedGmt: 'v2', nodeMap: NODE_MAP });
  });
  const snapshot = pageSnapshot(server.site, 17, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
  writeJson(snapshotFile, snapshot);
  writeJson(reportFile, {
    schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    scope: { site: server.site, pageId: 17 },
    evidence: { postModifiedGmt: 'v1', snapshotSha256: canonicalSha256(snapshot), operationsSha256: OPERATIONS_SHA256, candidateLayoutSha256: LAYOUT_SHA256 },
  });

  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17',
    '--operations', operationsFile, '--snapshot', snapshotFile, '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'conflict.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'patch-save', code: 'REST_CONFLICT' });
  assert.equal(execution.result.nextAction.id, 'resnapshot_and_reconcile');
  assert.equal(execution.result.retryable, false);
  assert.equal(applyCount, 0);
  assert.deepEqual(server.errors, []);
});

test('patch-save rejects an operation file changed after preflight before apply', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  const reportFile = path.join(directory, 'patch-validate-response.json');
  writeJson(operationsFile, [{ ...OPERATIONS[0], props: { background: '#222222' } }]);
  let requestCount = 0;
  const server = await startServer(t, (request, response) => {
    requestCount += 1;
    if (request.url.endsWith('/contract')) return sendJson(response, 200, patchContract());
    return sendJson(response, 500, { code: 'must_not_be_called' });
  });
  const snapshot = pageSnapshot(server.site, 17, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
  writeJson(snapshotFile, snapshot);
  writeJson(reportFile, {
    schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    scope: { site: server.site, pageId: 17 },
    evidence: {
      postModifiedGmt: 'v1', snapshotSha256: canonicalSha256(snapshot),
      operationsSha256: OPERATIONS_SHA256, candidateLayoutSha256: LAYOUT_SHA256,
    },
  });

  // The live contract is the only request permitted before the local digest mismatch.
  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17', '--operations', operationsFile,
    '--snapshot', snapshotFile, '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'changed.json'),
  ]);
  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'patch-save', code: 'OPERATIONS_SHA256_MISMATCH' });
  assert.equal(execution.result.nextAction.id, 'restart_patch_preflight');
  assert.equal(requestCount, 1);
  assert.deepEqual(server.errors, []);
});

test('preview posts nodeMap and writes returned HTML atomically', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const previewFile = path.join(directory, 'preview.html');
  const saveReportFile = path.join(directory, 'save-response.json');
  const previewReportFile = path.join(directory, 'preview-response.json');
  writeJson(layoutFile, NODE_MAP);
  let requestBody;
  const html = '<main data-preview="monteby">Rendered by PHP</main>';
  const server = await startServer(t, async (request, response) => {
    requestBody = await readBody(request);
    sendJson(response, 200, { html });
  });
  writeJson(saveReportFile, saveReport(server.site, 17));

  const execution = await runClient([
    'preview',
    '--site', server.site,
    '--layout', layoutFile,
    '--save-report', saveReportFile,
    '--out', previewFile,
    '--report-out', previewReportFile,
  ]);

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, { ok: true, stage: 'preview', code: 'PREVIEW_OK' });
  assert.deepEqual(requestBody, { nodeMap: NODE_MAP });
  assert.equal(fs.readFileSync(previewFile, 'utf8'), html);
  assert.equal(execution.result.artifacts.preview, previewFile);
  assert.equal(execution.result.artifacts.format, 'html');
  assert.equal(execution.result.layoutSha256, LAYOUT_SHA256);
  assert.deepEqual(execution.result.scope, { site: server.site, pageId: 17 });
  assert.deepEqual(execution.result.evidence, {
    site: server.site,
    pageId: 17,
    publicPageUrl: `${server.site}/page-17/`,
    layoutSha256: LAYOUT_SHA256,
    saveReport: saveReportFile,
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(previewReportFile, 'utf8')), execution.result);
  assert.equal(execution.result.nextAction.id, 'verify_canonical_page');
  assert.ok(execution.result.nextAction.args.includes('$MONTEBY_ITERATION_REPORT'));
  assert.ok(execution.result.nextAction.args.includes(previewReportFile));
  assert.ok(execution.result.nextAction.args.includes('$MONTEBY_PUBLIC_PAGE_URL'));
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_ITERATION_REPORT'));
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_PUBLIC_PAGE_URL'));
  assert.ok(execution.result.nextAction.requires.includes('PUBLIC_PAGE_URL_CONFIRMED'));
  assert.equal(
    fs.readdirSync(directory).some((name) => name.endsWith('.tmp')),
    false
  );
  assert.deepEqual(server.errors, []);
});

test('preview rejects mismatched save scope and layout digest before POST', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const saveReportFile = path.join(directory, 'save-response.json');
  writeJson(layoutFile, NODE_MAP);
  let requestCount = 0;
  const server = await startServer(t, (request, response) => {
    requestCount += 1;
    sendJson(response, 500, { code: 'must_not_be_called' });
  });
  const cases = [
    {
      report: saveReport('https://different.example', 17),
      code: 'SAVE_REPORT_SCOPE_MISMATCH',
    },
    {
      report: saveReport(server.site, 17, '0'.repeat(64)),
      code: 'LAYOUT_SHA256_MISMATCH',
    },
  ];

  for (const [index, current] of cases.entries()) {
    const reportOut = path.join(directory, `preview-report-${index}.json`);
    writeJson(saveReportFile, current.report);
    const execution = await runClient([
      'preview',
      '--site', server.site,
      '--layout', layoutFile,
      '--save-report', saveReportFile,
      '--out', path.join(directory, `preview-${index}.html`),
      '--report-out', reportOut,
    ]);

    assert.equal(execution.exitCode, 1);
    assertEnvelope(execution.result, {
      ok: false,
      stage: 'preview',
      code: current.code,
    });
    assert.equal(execution.result.nextAction.id, 'restart_validation_chain');
    assert.deepEqual(JSON.parse(fs.readFileSync(reportOut, 'utf8')), execution.result);
  }
  assert.equal(requestCount, 0);
  assert.deepEqual(server.errors, []);
});

test('preview rejects a 2xx JSON response without rendered HTML', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const previewFile = path.join(directory, 'preview.html');
  const saveReportFile = path.join(directory, 'save-response.json');
  const previewReportFile = path.join(directory, 'preview-response.json');
  writeJson(layoutFile, NODE_MAP);
  const server = await startServer(t, (_request, response) => {
    sendJson(response, 200, { ok: true, previewId: 123 });
  });
  writeJson(saveReportFile, saveReport(server.site, 17));

  const execution = await runClient([
    'preview',
    '--site', server.site,
    '--layout', layoutFile,
    '--save-report', saveReportFile,
    '--out', previewFile,
    '--report-out', previewReportFile,
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, {
    ok: false,
    stage: 'preview',
    code: 'PREVIEW_HTML_MISSING',
  });
  assert.equal(execution.result.nextAction.id, 'blocked_client_error');
  assert.equal(execution.result.nextAction.tool, '');
  assert.deepEqual(execution.result.nextAction.args, []);
  assert.equal(fs.existsSync(previewFile), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(previewReportFile, 'utf8')), execution.result);
  assert.deepEqual(server.errors, []);
});

test('--timeout-ms aborts a request and reports a retryable timeout without retrying', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  writeJson(layoutFile, NODE_MAP);
  let requestCount = 0;
  const server = await startServer(t, async (request, response) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    sendJson(response, 200, { valid: true });
  });

  const execution = await runClient([
    'validate',
    '--site', server.site,
    '--layout', layoutFile,
    '--timeout-ms', '20',
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'validate', code: 'REQUEST_TIMEOUT' });
  assert.equal(execution.result.retryable, true);
  assert.equal(execution.result.nextAction.id, 'retry_command_explicitly');
  assert.ok(execution.result.nextAction.requires.includes('SITE_HEALTH_CONFIRMED'));
  assert.ok(requestCount <= 1, `timeout must not retry (received ${requestCount} requests)`);
  assert.deepEqual(server.errors, []);
});
