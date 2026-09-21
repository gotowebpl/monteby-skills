'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
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
const {
  canonicalSha256,
  nodeMapSha256,
  operationsSha256,
  portableDigestBytes,
  pruneNoopOperations,
} = require(CLIENT);
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
const COMPOSITION_SECTION = {
  type: { resolvedName: 'Section' },
  displayName: 'Section',
  custom: {},
  isCanvas: true,
  props: {},
  parent: 'ROOT',
  hidden: false,
  nodes: [],
  linkedNodes: {},
};
const COMPOSITION_PLAN_MAP = {
  ROOT: {
    type: { resolvedName: 'RootCanvas' },
    displayName: 'RootCanvas',
    custom: {},
    isCanvas: true,
    props: {},
    parent: null,
    hidden: false,
    nodes: ['hero-1'],
    linkedNodes: {},
  },
  'hero-1': COMPOSITION_SECTION,
};
const OPERATIONS = [{
  type: 'update_props',
  nodeId: 'section-1',
  props: { background: '#111111' },
  unsetProps: ['legacyColor'],
}];
const OPERATIONS_SHA256 = operationsSha256(OPERATIONS);
const BRANDING_REVISION = 'a'.repeat(64);
const PAGE_SETTINGS_SHA256 = 'b'.repeat(64);
const DOCUMENT_SHA256 = 'c'.repeat(64);

function layoutContract({
  productVersion = '1.6.0',
  pagePath = '/monteby/v1/pages/{postId}/layout',
  validatePath = '/monteby/v1/validate',
  previewPath = '/monteby/v1/preview',
  carrier = 'nodeMap',
  validationContextField = 'postId',
  previewContextField = 'postId',
  versionField = 'postModifiedGmt',
  writePreconditionField = 'expectedModifiedGmt',
  layoutDigestField = 'layoutSha256',
  writeDigestPreconditionField = 'expectedLayoutSha256',
  candidateDigestField = 'candidateLayoutSha256',
  writeCandidatePreconditionField = 'expectedCandidateSha256',
  settingsDigestField = 'pageSettingsSha256',
  writeSettingsDigestPreconditionField = 'expectedPageSettingsSha256',
} = {}) {
  return {
    version: 1,
    productVersion,
    authoring: { capabilities: { providerRenderedWidgetSave: true } },
    layoutPersistence: {
      versionField,
      writePreconditionField,
      layoutDigestField,
      writeDigestPreconditionField,
      candidateDigestField,
      writeCandidatePreconditionField,
      validationContextField,
      previewContextField,
      resources: {
        validate: { method: 'POST', path: validatePath, carrier },
        pageLayout: {
          readMethod: 'GET', writeMethod: 'PUT', path: pagePath, carrier,
          settingsDigestField, writeSettingsDigestPreconditionField,
        },
        preview: { method: 'POST', path: previewPath, carrier },
      },
    },
  };
}

function capabilityContract() {
  const contract = layoutContract();
  return {
    ...contract,
    mode: 'full',
    componentsMode: 'full',
    authoring: {
      capabilities: {
        providerRenderedWidgetSave: true,
        annotatedRender: true,
        renderGlobalStylesFilter: true,
        previewGlobalTemplates: true,
        previewVirtualGlobalTemplates: true,
      },
      compositions: {
        version: 1,
        recipes: [{
          id: 'hero', label: 'Hero', slots: { title: { type: 'text', required: true } }, tree: {},
        }],
        resources: {
          instantiate: {
            method: 'POST', path: '/monteby/v1/compositions/instantiate', carrier: 'slots',
          },
          plan: { method: 'POST', path: '/monteby/v1/compositions/plan', carrier: 'plan' },
        },
      },
      designProfiles: {
        version: 1,
        profiles: [{ id: 'editorial', label: 'Editorial' }],
        resource: {
          composeMethod: 'POST',
          composePath: '/monteby/v1/global-styles/compose',
          previewPath: '/monteby/v1/preview',
          previewField: 'globalStyles',
          applyPath: '/monteby/v1/global-styles',
          applyMethods: ['PUT', 'PATCH'],
        },
      },
      abilities: {
        available: true,
        namespace: 'monteby',
        category: 'monteby',
        restNamespace: 'wp-abilities/v1',
        listPath: '/wp-abilities/v1/abilities',
        runPath: '/wp-abilities/v1/abilities/{name}/run',
        names: ['monteby/get-contract', 'monteby/save-layout'],
      },
    },
    globalStyles: {
      colors: { primary: '#112233' },
      typography: { body_size: '16px' },
      revision: 'b'.repeat(64),
      resource: {
        patchMethod: 'PATCH',
        path: '/monteby/v1/global-styles',
        versionField: 'revision',
        writePreconditionField: 'expectedRevision',
        allowedFields: ['colors', 'typography'],
      },
      patchSchema: {
        type: 'object',
        additionalProperties: false,
        minProperties: 2,
        required: ['expectedRevision'],
        properties: {
          colors: { type: 'object', additionalProperties: { type: 'string' } },
          typography: { type: 'object' },
          expectedRevision: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        },
      },
    },
    layoutPersistence: {
      ...contract.layoutPersistence,
      seo: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'description'],
          properties: { title: { type: 'string' }, description: { type: 'string' } },
        },
      },
      resources: {
        ...contract.layoutPersistence.resources,
        pageContext: {
          method: 'GET', path: '/monteby/v1/pages/{postId}/context', postIdField: 'postId',
        },
        documents: {
          method: 'GET', path: '/monteby/v1/site/pages',
          queryFields: ['hasLayout', 'postType', 'page', 'perPage'],
        },
        revisions: {
          method: 'GET', path: '/monteby/v1/pages/{postId}/layout/revisions',
          queryFields: ['page', 'perPage'],
        },
        restoreRevision: {
          method: 'POST', path: '/monteby/v1/pages/{postId}/layout/restore',
          carrier: 'revisionId', revisionField: 'revisionId',
          writePreconditionField: 'expectedModifiedGmt',
          digestField: 'documentSha256',
          writeDigestPreconditionField: 'expectedDocumentSha256',
        },
        pageSeo: {
          readMethod: 'GET', writeMethod: 'PUT',
          path: '/monteby/v1/pages/{postId}/seo', carrier: 'seo',
          digestField: 'seoSha256', writeDigestPreconditionField: 'expectedSeoSha256',
        },
        bulkCreate: {
          method: 'POST', path: '/monteby/v1/site/pages/bulk', carrier: 'items',
          maxItems: 25, idempotencyField: 'requestId',
          payloadDigestField: 'payloadSha256', replayMode: 'durable-payload-bound',
          idempotencyTtlSeconds: 86_400, retryAfterUncertainOutcome: false,
          itemFields: ['title', 'slug', 'status', 'postType', 'layout', 'seo', 'presentation'],
        },
        contractComponent: {
          method: 'GET', path: '/monteby/v1/contract/components/{name}', nameField: 'name',
        },
      },
    },
  };
}

function documentSummary(overrides = {}) {
  return {
    id: 17,
    title: 'Example',
    slug: 'example',
    postType: 'page',
    documentType: 'page',
    status: 'publish',
    url: 'https://example.test/example/',
    editUrl: 'https://example.test/wp-admin/post.php?post=17&action=monteby',
    hasLayout: true,
    layoutState: 'stored',
    postModifiedGmt: '2026-09-21 12:00:00',
    ...overrides,
  };
}

function pageContext(overrides = {}) {
  const summary = documentSummary();
  return {
    postId: summary.id,
    postType: summary.postType,
    documentType: summary.documentType,
    title: summary.title,
    slug: summary.slug,
    status: summary.status,
    viewUrl: summary.url,
    editUrl: summary.editUrl,
    hasLayout: summary.hasLayout,
    layoutState: summary.layoutState,
    nodeCount: 1,
    postModifiedGmt: summary.postModifiedGmt,
    presentation: { layout: 'default', disableGlobalTemplates: false },
    effectiveLayout: 'default',
    headerPostId: 0,
    footerPostId: 0,
    ...overrides,
  };
}

test('operation generation prunes empty update_props entries without changing meaningful values', () => {
  const meaningful = {
    type: 'update_props',
    nodeId: 'section-1',
    props: { alt: '', background: '#111111' },
    unsetProps: [],
  };

  assert.deepEqual(pruneNoopOperations([
    { type: 'update_props', nodeId: 'empty-1', props: {}, unsetProps: [] },
    { type: 'update_props', nodeId: 'empty-2', props: {} },
    meaningful,
  ]), [{
    type: 'update_props',
    nodeId: 'section-1',
    props: { alt: '', background: '#111111' },
  }]);
});

test('portable digest v1 has cross-runtime numeric and UTF-8 ordering vectors', () => {
  const vectors = [
    [{}, 'o0:', '7cc07e7f12d86069de37261464c00b94179a600304e3eb3fcf4c8dc7e5e2f94f'],
    [[], 'a0:', '8e332b40cb62c4b575f1ea4c006f6ca0fc09ae3bf2c88bf06b4042ac61084097'],
    [-0, 'd0000000000000000', '045197659b25ff2231f213dc12c371c9cc55d498d4c07d39270098efe16bf19e'],
    [1e-7, 'd3e7ad7f29abcaf48', '08f9ce571f69ced340e69c57257c478e82c67c4e9497ba8c058755c088db3ed7'],
    [1e21, 'd444b1ae4d6e2ef50', '352ac32582b45e2eb5059dd766c3fb4c4fa45e80fc71a99649c0c2ea2741f666'],
  ];
  for (const [value, encoded, digest] of vectors) {
    assert.equal(portableDigestBytes(value).toString('utf8'), encoded);
    assert.equal(canonicalSha256(value), digest);
  }
  const unicode = { '😀': 'face', 'é': 'accent', z: 'latin', aa: 'pair' };
  assert.equal(
    portableDigestBytes(unicode).toString('hex'),
    '6f343a73323a616173343a7061697273313a7a73353a6c6174696e73323ac3a973363a616363656e7473343af09f988073343a66616365'
  );
  assert.equal(canonicalSha256(unicode), 'a41bbc6ac82a48d5bde9d6a60dc42b66e84eecf5dd4335bef766e5a36c11edec');
  assert.equal(canonicalSha256(-0), canonicalSha256(0));
  assert.equal(canonicalSha256({ z: 1, aa: 2 }), canonicalSha256({ aa: 2, z: 1 }));
  assert.throws(() => portableDigestBytes(Number.NaN), /must be finite/u);
  assert.throws(() => portableDigestBytes('\uD800'), /valid Unicode scalar values/u);
});

function brandingContract(overrides = {}) {
  return {
    siteBranding: {
      resource: {
        readMethod: 'GET',
        writeMethod: 'PUT',
        path: '/monteby/v1/site/branding',
        versionField: 'revision',
        writePreconditionField: 'expectedRevision',
        ...overrides,
      },
    },
  };
}

function brandingDocument(revision = BRANDING_REVISION, logoUrl = '') {
  return { version: 1, revision, logoUrl };
}

function brandingSnapshot(site, data = brandingDocument()) {
  return {
    schemaVersion: 1,
    artifact: 'monteby-site-branding-snapshot',
    site,
    capturedAt: '2026-08-30T08:00:00.000Z',
    data,
  };
}

function patchContract(layoutOptions = {}) {
  const baseContract = layoutContract(layoutOptions);
  return {
    ...baseContract,
    layoutPersistence: {
      ...baseContract.layoutPersistence,
      operations: {
        compiledDigestField: 'compiledHtmlSha256',
        writeCompiledPreconditionField: 'expectedCompiledHtmlSha256',
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
  const nodeMap = (() => {
    try {
      return data?.ROOT ? data : (data?.nodeMap || data?.layout || NODE_MAP);
    } catch {
      return NODE_MAP;
    }
  })();
  return {
    schemaVersion: 1,
    artifact: 'monteby-page-snapshot',
    site,
    pageId,
    publicPageUrl: `${site}/page-${pageId}/`,
    capturedAt: '2026-07-26T08:00:00.000Z',
    data: {
      id: pageId,
      postType: 'page',
      viewUrl: `${site}/page-${pageId}/`,
      nodeMap,
      postModifiedGmt: 'v1',
      layoutSha256: nodeMapSha256(nodeMap),
      pageSettingsSha256: PAGE_SETTINGS_SHA256,
      ...data,
    },
  };
}

function layoutResponse(site, pageId, versionToken, nodeMap = NODE_MAP, extra = {}) {
  return {
    id: pageId,
    postType: 'page',
    viewUrl: `${site}/page-${pageId}/`,
    postModifiedGmt: versionToken,
    nodeMap,
    layoutSha256: nodeMapSha256(nodeMap),
    pageSettingsSha256: PAGE_SETTINGS_SHA256,
    ...extra,
  };
}

function saveReport(site, pageId, layoutSha256 = LAYOUT_SHA256, readbackLayout = NODE_MAP) {
  const readbackLayoutSha256 = nodeMapSha256(readbackLayout);
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
      candidateLayoutSha256: readbackLayoutSha256,
      savedLayoutSha256: readbackLayoutSha256,
      readbackLayoutSha256,
      readbackLayout,
      versionField: 'postModifiedGmt',
      previousVersionToken: 'v1',
      previousLayoutSha256: LAYOUT_SHA256,
      versionToken: 'v2',
      versionAdvanced: true,
      layoutChanged: readbackLayoutSha256 !== LAYOUT_SHA256,
      validation: { valid: true, lint: [] },
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
  const contract = {
    ...layoutContract({ productVersion: '1.4.0' }),
    components: [{ name: 'Section' }],
  };
  const before = {
    id: 17,
    postType: 'page',
    viewUrl: '',
    postModifiedGmt: '2026-07-26 08:00:00',
    nodeMap: NODE_MAP,
    layoutSha256: LAYOUT_SHA256,
    pageSettingsSha256: PAGE_SETTINGS_SHA256,
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
      sendJson(response, 200, { ...before, viewUrl: `${server.site}/page-17/` });
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
  assert.equal(savedSnapshot.postType, 'page');
  assert.equal(savedSnapshot.viewUrl, `${server.site}/page-17/`);
  assert.equal(savedSnapshot.publicPageUrl, `${server.site}/page-17/`);
  assert.equal(Number.isFinite(Date.parse(savedSnapshot.capturedAt)), true);
  assert.deepEqual(savedSnapshot.data, { ...before, viewUrl: `${server.site}/page-17/` });
  assert.equal(execution.result.artifacts.snapshot, path.join(outDir, 'layout-before.json'));
  assert.deepEqual(execution.result.evidence, {
    publicPageUrl: `${server.site}/page-17/`,
    postType: 'page',
    viewUrl: `${server.site}/page-17/`,
    renderContextUrl: '',
    productVersion: '1.4.0',
    layoutSha256: LAYOUT_SHA256,
    pageSettingsSha256: PAGE_SETTINGS_SHA256,
  });
  assert.equal(execution.result.nextAction.id, 'validate_candidate');
  assert.deepEqual(
    execution.result.nextAction.args.slice(0, 8),
    [
      'validate', '--site', server.site, '--layout', '$MONTEBY_LAYOUT_PATH',
      '--page-id', '17', '--out',
    ]
  );
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_LAYOUT_PATH'));
  assert.equal(
    fs.readdirSync(outDir).some((name) => name.endsWith('.tmp')),
    false,
    'atomic writes leave no temporary artifacts'
  );
  assert.deepEqual(server.errors, []);
});

test('template snapshot uses only the layout resource and accepts an explicit render context', async (t) => {
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract({ productVersion: '1.4.0' }));
      return;
    }
    sendJson(response, 200, {
      id: 41,
      postType: 'gotoweb_template',
      viewUrl: `${server.site}/?gotoweb_template=global-header`,
      postModifiedGmt: '2026-08-20 09:00:00',
      nodeMap: NODE_MAP,
      layoutSha256: LAYOUT_SHA256,
      pageSettingsSha256: PAGE_SETTINGS_SHA256,
    });
  });
  const outDir = tempDir(t);
  const renderContextUrl = `${server.site}/kontakt/`;

  const execution = await runClient([
    'snapshot', '--site', server.site, '--page-id', '41', '--out-dir', outDir,
    '--render-context-url', renderContextUrl,
  ]);

  assert.equal(execution.exitCode, 0);
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/41/layout',
  ]);
  const snapshot = JSON.parse(fs.readFileSync(path.join(outDir, 'layout-before.json'), 'utf8'));
  assert.equal(snapshot.postType, 'gotoweb_template');
  assert.equal(snapshot.renderContextUrl, renderContextUrl);
  assert.equal(snapshot.publicPageUrl, renderContextUrl);
  assert.equal(snapshot.viewUrl, `${server.site}/?gotoweb_template=global-header`);
});

test('snapshot classifies an outdated Builder before requesting the layout', async (t) => {
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    sendJson(response, 200, { productVersion: '1.3.12' });
  });

  const execution = await runClient([
    'snapshot', '--site', server.site, '--page-id', '17', '--out-dir', tempDir(t),
  ]);

  assert.equal(execution.exitCode, 1);
  assert.equal(execution.result.code, 'blocked_plugin_version');
  assert.deepEqual(requests, ['GET /wp-json/monteby/v1/contract']);
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
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract());
      return;
    }
    receivedBody = await readBody(request);
    sendJson(response, 200, { valid: true, lint: [], reflectedAuthorization: receivedAuth });
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

test('layout workflows fail closed when their live descriptor is absent or unsafe', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  writeJson(layoutFile, NODE_MAP);

  const cases = [
    {
      command: ['validate', '--layout', layoutFile],
      mutate(contract) { delete contract.layoutPersistence.resources.validate; },
      code: 'VALIDATION_RESOURCE_MISSING',
    },
    {
      command: ['validate', '--layout', layoutFile],
      mutate(contract) {
        contract.layoutPersistence.validationContextField = contract.layoutPersistence.resources.validate.carrier;
      },
      code: 'VALIDATION_RESOURCE_MISSING',
    },
    {
      command: ['snapshot', '--page-id', '17', '--out-dir', path.join(directory, 'snapshot')],
      mutate(contract) { contract.layoutPersistence.resources.pageLayout.path = 'https://attacker.example/layout'; },
      code: 'PAGE_LAYOUT_RESOURCE_MISSING',
    },
    {
      command: ['snapshot', '--page-id', '17', '--out-dir', path.join(directory, 'missing-placeholder')],
      mutate(contract) { contract.layoutPersistence.resources.pageLayout.path = '/monteby/v1/pages/layout'; },
      code: 'PAGE_LAYOUT_RESOURCE_MISSING',
    },
    {
      command: ['snapshot', '--page-id', '17', '--out-dir', path.join(directory, 'duplicate-placeholder')],
      mutate(contract) { contract.layoutPersistence.resources.pageLayout.path = '/monteby/v1/pages/{postId}/copy/{postId}/layout'; },
      code: 'PAGE_LAYOUT_RESOURCE_MISSING',
    },
  ];

  for (const [index, current] of cases.entries()) {
    let requestCount = 0;
    const contract = layoutContract();
    current.mutate(contract);
    const server = await startServer(t, (_request, response) => {
      requestCount += 1;
      sendJson(response, 200, contract);
    });
    const execution = await runClient([
      current.command[0], '--site', server.site, ...current.command.slice(1),
      '--out', path.join(directory, `descriptor-${index}.json`),
    ]);
    assert.equal(execution.exitCode, 1);
    assert.equal(execution.result.code, current.code);
    assert.equal(requestCount, 1, 'only contract discovery may run');
    assert.deepEqual(server.errors, []);
  }
});

test('save stops before validation and PUT when postModifiedGmt differs from the snapshot', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  writeJson(layoutFile, NODE_MAP);
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract());
      return;
    }
    sendJson(response, 200, {
      ...layoutResponse(server.site, 17, '2026-07-26 08:05:00'),
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
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/17/layout',
  ]);
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

test('save omits page settings for layout-only writes and binds explicit presentation writes', async (t) => {
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
  let expectReadback = false;
  let readbackPresentation = freshPresentation;
  let readbackSettingsSha256 = PAGE_SETTINGS_SHA256;
  const server = await startServer(t, async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract());
    } else if (request.method === 'GET') {
      const postModifiedGmt = expectReadback
        ? '2026-07-26 08:00:01'
        : '2026-07-26 08:00:00';
      const presentation = expectReadback ? readbackPresentation : freshPresentation;
      const pageSettingsSha256 = expectReadback
        ? readbackSettingsSha256
        : PAGE_SETTINGS_SHA256;
      expectReadback = false;
      sendJson(response, 200, {
        ...layoutResponse(server.site, 17, postModifiedGmt, NODE_MAP, { pageSettingsSha256 }),
        presentation,
      });
    } else if (request.url.endsWith('/validate')) {
      assert.deepEqual(await readBody(request), { nodeMap: NODE_MAP, postId: 17 });
      sendJson(response, 200, {
        valid: true,
        lint: [],
        nodeMap: NODE_MAP,
        candidateLayoutSha256: LAYOUT_SHA256,
      });
    } else if (request.method === 'PUT') {
      const body = await readBody(request);
      putBodies.push(body);
      readbackPresentation = body.presentation || freshPresentation;
      readbackSettingsSha256 = body.presentation ? 'e'.repeat(64) : PAGE_SETTINGS_SHA256;
      expectReadback = true;
      sendJson(response, 200, {
        id: 17,
        saved: true,
        postModifiedGmt: '2026-07-26 08:00:01',
        nodeMap: NODE_MAP,
        layoutSha256: LAYOUT_SHA256,
        candidateLayoutSha256: LAYOUT_SHA256,
        pageSettingsSha256: readbackSettingsSha256,
        ...(body.presentation ? {
          presentation: body.presentation,
        } : {}),
      });
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
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/17/layout',
    'POST /wp-json/monteby/v1/validate',
    'PUT /wp-json/monteby/v1/pages/17/layout',
    'GET /wp-json/monteby/v1/pages/17/layout',
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/17/layout',
    'POST /wp-json/monteby/v1/validate',
    'PUT /wp-json/monteby/v1/pages/17/layout',
    'GET /wp-json/monteby/v1/pages/17/layout',
  ]);
  assert.deepEqual(putBodies[0], {
    expectedModifiedGmt: '2026-07-26 08:00:00',
    expectedLayoutSha256: LAYOUT_SHA256,
    expectedCandidateSha256: LAYOUT_SHA256,
    nodeMap: NODE_MAP,
  });
  assert.deepEqual(putBodies[1], {
    expectedModifiedGmt: '2026-07-26 08:00:00',
    expectedLayoutSha256: LAYOUT_SHA256,
    expectedCandidateSha256: LAYOUT_SHA256,
    expectedPageSettingsSha256: PAGE_SETTINGS_SHA256,
    nodeMap: NODE_MAP,
    presentation: {
      ...freshPresentation,
      layout: 'canvas',
      disableGlobalTemplates: true,
    },
  });
  assert.deepEqual(server.errors, []);
});

test('save binds an envelope SEO candidate to the fresh page-settings digest and exact readback', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  const seo = { title: 'Updated title', description: 'Updated description' };
  const updatedPageSettingsSha256 = 'f'.repeat(64);
  writeJson(layoutFile, { nodeMap: NODE_MAP, seo });
  let saved = false;
  let putBody;
  const server = await startServer(t, async (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, capabilityContract());
    if (request.url.endsWith('/validate')) {
      return sendJson(response, 200, {
        valid: true,
        lint: [],
        nodeMap: NODE_MAP,
        candidateLayoutSha256: LAYOUT_SHA256,
      });
    }
    if (request.method === 'PUT') {
      putBody = await readBody(request);
      saved = true;
      return sendJson(response, 200, {
        id: 17,
        saved: true,
        postModifiedGmt: 'v2',
        nodeMap: NODE_MAP,
        layoutSha256: LAYOUT_SHA256,
        candidateLayoutSha256: LAYOUT_SHA256,
        pageSettingsSha256: updatedPageSettingsSha256,
        seo,
      });
    }
    if (request.method === 'GET' && request.url.endsWith('/pages/17/layout')) {
      return sendJson(response, 200, layoutResponse(
        server.site,
        17,
        saved ? 'v2' : 'v1',
        NODE_MAP,
        {
          pageSettingsSha256: saved ? updatedPageSettingsSha256 : PAGE_SETTINGS_SHA256,
          seo: saved ? seo : { title: 'Old title', description: 'Old description' },
        }
      ));
    }
    return sendJson(response, 404, { code: 'not_found' });
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, { postModifiedGmt: 'v1' }));

  const execution = await runClient([
    'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save.json'),
  ]);

  assertEnvelope(execution.result, { ok: true, stage: 'save', code: 'SAVE_OK' });
  assert.deepEqual(putBody, {
    expectedModifiedGmt: 'v1',
    expectedLayoutSha256: LAYOUT_SHA256,
    expectedCandidateSha256: LAYOUT_SHA256,
    expectedPageSettingsSha256: PAGE_SETTINGS_SHA256,
    nodeMap: NODE_MAP,
    seo,
  });
  assert.equal(execution.result.evidence.previousPageSettingsSha256, PAGE_SETTINGS_SHA256);
  assert.equal(execution.result.evidence.pageSettingsSha256, updatedPageSettingsSha256);
  assert.deepEqual(server.errors, []);
});

test('save rejects same-version page-settings drift before an optional settings write', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  writeJson(layoutFile, {
    nodeMap: NODE_MAP,
    presentation: { layout: 'canvas', disableGlobalTemplates: true },
  });
  let mutations = 0;
  const server = await startServer(t, (request, response) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) mutations += 1;
    if (request.url.endsWith('/contract')) return sendJson(response, 200, capabilityContract());
    return sendJson(response, 200, layoutResponse(server.site, 17, 'v1', NODE_MAP, {
      pageSettingsSha256: '9'.repeat(64),
      presentation: { layout: 'full-width', disableGlobalTemplates: false },
    }));
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, { postModifiedGmt: 'v1' }));

  const execution = await runClient([
    'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'save.json'),
  ]);

  assertEnvelope(execution.result, { ok: false, stage: 'save', code: 'REST_CONFLICT' });
  assert.equal(execution.result.response.snapshotPageSettingsSha256, PAGE_SETTINGS_SHA256);
  assert.equal(execution.result.response.currentPageSettingsSha256, '9'.repeat(64));
  assert.equal(mutations, 0);
  assert.deepEqual(server.errors, []);
});

test('save and preview follow custom live resource paths, carriers, contexts, and version fields', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  const saveReportFile = path.join(directory, 'save.json');
  const previewFile = path.join(directory, 'preview.html');
  const previewReportFile = path.join(directory, 'preview.json');
  const persistedNodeMap = { schemaVersion: 4, ...NODE_MAP };
  const persistedLayoutSha256 = nodeMapSha256(persistedNodeMap);
  const previousNodeMap = { ROOT: { props: { old: true } } };
  const previousLayoutSha256 = nodeMapSha256(previousNodeMap);
  writeJson(layoutFile, NODE_MAP);
  const contract = layoutContract({
    pagePath: '/monteby/v1/documents/{postId}/canvas',
    validatePath: '/monteby/v1/check-layout',
    previewPath: '/monteby/v1/render-layout',
    carrier: 'layoutCandidate',
    validationContextField: 'documentRef',
    previewContextField: 'previewDocumentRef',
    versionField: 'revisionToken',
    writePreconditionField: 'expectedRevisionToken',
    layoutDigestField: 'canvasDigest',
    writeDigestPreconditionField: 'expectedCanvasDigest',
    candidateDigestField: 'canonicalCandidateDigest',
    writeCandidatePreconditionField: 'expectedCanonicalCandidateDigest',
  });
  const requests = [];
  let saved = false;
  const server = await startServer(t, async (request, response) => {
    const body = await readBody(request);
    requests.push({ method: request.method, url: request.url, body });
    if (request.url.endsWith('/contract')) return sendJson(response, 200, contract);
    if (request.method === 'GET' && request.url.endsWith('/documents/37/canvas')) {
      return sendJson(response, 200, {
        data: {
          id: 37,
          postType: 'page',
          viewUrl: `${server.site}/page-37/`,
          revisionToken: saved ? 'revision-2' : 'revision-1',
          layoutCandidate: saved ? persistedNodeMap : previousNodeMap,
          canvasDigest: saved ? persistedLayoutSha256 : previousLayoutSha256,
          pageSettingsSha256: PAGE_SETTINGS_SHA256,
          presentation: { layout: 'default', disableGlobalTemplates: false },
        },
      });
    }
    if (request.url.endsWith('/check-layout')) {
      assert.deepEqual(body, { layoutCandidate: NODE_MAP, documentRef: 37 });
      return sendJson(response, 200, {
        valid: true,
        lint: [],
        layoutCandidate: persistedNodeMap,
        canonicalCandidateDigest: persistedLayoutSha256,
      });
    }
    if (request.method === 'PUT' && request.url.endsWith('/documents/37/canvas')) {
      assert.deepEqual(body, {
        expectedRevisionToken: 'revision-1',
        expectedCanvasDigest: previousLayoutSha256,
        expectedCanonicalCandidateDigest: persistedLayoutSha256,
        layoutCandidate: NODE_MAP,
      });
      saved = true;
      return sendJson(response, 200, { data: {
        id: 37,
        saved: true,
        revisionToken: 'revision-2',
        layoutCandidate: persistedNodeMap,
        canvasDigest: persistedLayoutSha256,
        canonicalCandidateDigest: persistedLayoutSha256,
        pageSettingsSha256: PAGE_SETTINGS_SHA256,
      } });
    }
    if (request.url.endsWith('/render-layout')) {
      assert.deepEqual(body, { layoutCandidate: persistedNodeMap, previewDocumentRef: 37 });
      return sendJson(response, 200, { html: '<main>Custom descriptor preview</main>' });
    }
    return sendJson(response, 404, { code: 'unexpected_test_route' });
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 37, {
    revisionToken: 'revision-1',
    layoutCandidate: previousNodeMap,
    canvasDigest: previousLayoutSha256,
  }));

  const save = await runClient([
    'save', '--site', server.site, '--page-id', '37', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', saveReportFile,
  ]);
  assert.equal(save.exitCode, 0, JSON.stringify(save.result));
  assert.equal(save.result.evidence.versionField, 'revisionToken');
  assert.equal(save.result.evidence.previousVersionToken, 'revision-1');
  assert.equal(save.result.evidence.versionToken, 'revision-2');
  assert.notEqual(persistedLayoutSha256, LAYOUT_SHA256);
  assert.equal(save.result.evidence.savedLayoutSha256, persistedLayoutSha256);
  assert.equal(save.result.evidence.readbackLayoutSha256, persistedLayoutSha256);

  const preview = await runClient([
    'preview', '--site', server.site, '--layout', layoutFile,
    '--save-report', saveReportFile, '--out', previewFile, '--report-out', previewReportFile,
  ]);
  assert.equal(preview.exitCode, 0);
  assert.equal(fs.readFileSync(previewFile, 'utf8'), '<main>Custom descriptor preview</main>');
  assert.deepEqual(requests.map(({ method, url }) => `${method} ${url}`), [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/documents/37/canvas',
    'POST /wp-json/monteby/v1/check-layout',
    'PUT /wp-json/monteby/v1/documents/37/canvas',
    'GET /wp-json/monteby/v1/documents/37/canvas',
    'GET /wp-json/monteby/v1/contract',
    'POST /wp-json/monteby/v1/render-layout',
  ]);
  assert.deepEqual(server.errors, []);
});

test('save refuses incomplete write evidence and mismatched canonical readback', async (t) => {
  for (const scenario of ['missing-version', 'missing-representation', 'mismatched-readback']) {
    const directory = tempDir(t);
    const layoutFile = path.join(directory, 'layout.json');
    const snapshotFile = path.join(directory, 'snapshot.json');
    writeJson(layoutFile, NODE_MAP);
    let writeCompleted = false;
    const server = await startServer(t, async (request, response) => {
      if (request.url.endsWith('/contract')) return sendJson(response, 200, layoutContract());
      if (request.url.endsWith('/validate')) {
        return sendJson(response, 200, {
          valid: true,
          lint: [],
          nodeMap: NODE_MAP,
          candidateLayoutSha256: LAYOUT_SHA256,
        });
      }
      if (request.method === 'PUT') {
        writeCompleted = true;
        await readBody(request);
        if (scenario === 'missing-version') return sendJson(response, 200, {
          id: 17,
          saved: true,
          nodeMap: NODE_MAP,
          layoutSha256: LAYOUT_SHA256,
          candidateLayoutSha256: LAYOUT_SHA256,
          pageSettingsSha256: PAGE_SETTINGS_SHA256,
        });
        if (scenario === 'missing-representation') {
          return sendJson(response, 200, {
            id: 17,
            saved: true,
            postModifiedGmt: 'v2',
            layoutSha256: LAYOUT_SHA256,
            candidateLayoutSha256: LAYOUT_SHA256,
            pageSettingsSha256: PAGE_SETTINGS_SHA256,
          });
        }
        return sendJson(response, 200, {
          id: 17,
          saved: true,
          postModifiedGmt: 'v2',
          nodeMap: NODE_MAP,
          layoutSha256: LAYOUT_SHA256,
          candidateLayoutSha256: LAYOUT_SHA256,
          pageSettingsSha256: PAGE_SETTINGS_SHA256,
        });
      }
      const responseNodeMap = writeCompleted && scenario === 'mismatched-readback'
        ? { ROOT: { props: { unexpected: true } } }
        : NODE_MAP;
      return sendJson(response, 200, {
        ...layoutResponse(server.site, 17, writeCompleted ? 'v2' : 'v1', responseNodeMap),
        presentation: { layout: 'default', disableGlobalTemplates: false },
      });
    });
    writeJson(snapshotFile, pageSnapshot(server.site, 17, {
      postModifiedGmt: 'v1', nodeMap: NODE_MAP,
    }));

    const execution = await runClient([
      'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
      '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
      '--out', path.join(directory, `${scenario}.json`),
    ]);
    assert.equal(execution.exitCode, 1);
    const expectedCode = {
      'missing-version': 'SAVE_EVIDENCE_INVALID',
      'missing-representation': 'SAVE_EVIDENCE_INVALID',
      'mismatched-readback': 'SAVE_READBACK_MISMATCH',
    }[scenario];
    assert.equal(execution.result.code, expectedCode);
    assert.equal(execution.result.retryable, false);
    assert.deepEqual(server.errors, []);
  }
});

test('save rejects page identity drift in fresh, write, and readback envelopes', async (t) => {
  for (const scenario of ['fresh', 'string-id', 'write', 'readback']) {
    const directory = tempDir(t);
    const layoutFile = path.join(directory, 'layout.json');
    const snapshotFile = path.join(directory, 'snapshot.json');
    writeJson(layoutFile, NODE_MAP);
    writeJson(snapshotFile, pageSnapshot('https://placeholder.invalid', 17, {
      postModifiedGmt: 'v1', nodeMap: NODE_MAP,
    }));
    let writeCompleted = false;
    const server = await startServer(t, async (request, response) => {
      if (request.url.endsWith('/contract')) return sendJson(response, 200, layoutContract());
      if (request.url.endsWith('/validate')) {
        return sendJson(response, 200, {
          valid: true,
          lint: [],
          nodeMap: NODE_MAP,
          candidateLayoutSha256: LAYOUT_SHA256,
        });
      }
      if (request.method === 'PUT') {
        writeCompleted = true;
        await readBody(request);
        return sendJson(response, 200, {
          ...layoutResponse(server.site, scenario === 'write' ? 18 : 17, 'v2'),
          saved: true,
          candidateLayoutSha256: LAYOUT_SHA256,
        });
      }
      return sendJson(response, 200, layoutResponse(
        server.site,
        scenario === 'string-id'
          ? '17'
          : scenario === 'fresh' || (scenario === 'readback' && writeCompleted) ? 18 : 17,
        writeCompleted ? 'v2' : 'v1'
      ));
    });
    writeJson(snapshotFile, pageSnapshot(server.site, 17, {
      postModifiedGmt: 'v1', nodeMap: NODE_MAP,
    }));

    const execution = await runClient([
      'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
      '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
      '--out', path.join(directory, `${scenario}.json`),
    ]);

    assert.equal(execution.exitCode, 1);
    assert.equal(execution.result.code, {
      fresh: 'REST_LAYOUT_EVIDENCE_INVALID',
      'string-id': 'REST_LAYOUT_EVIDENCE_INVALID',
      write: 'SAVE_EVIDENCE_INVALID',
      readback: 'SAVE_READBACK_MISMATCH',
    }[scenario]);
    assert.deepEqual(server.errors, []);
  }
});

test('save detects same-token layout drift before validation or write', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  const changedLayout = { ROOT: { props: { changedWithinSameSecond: true } } };
  writeJson(layoutFile, NODE_MAP);
  let writeCount = 0;
  const server = await startServer(t, (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, layoutContract());
    if (request.method !== 'GET') writeCount += 1;
    return sendJson(response, 200, layoutResponse(server.site, 17, 'v1', changedLayout));
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: 'v1', nodeMap: NODE_MAP,
  }));

  const execution = await runClient([
    'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'same-token-conflict.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'save', code: 'REST_CONFLICT' });
  assert.equal(execution.result.response.snapshotVersionToken, 'v1');
  assert.equal(execution.result.response.currentVersionToken, 'v1');
  assert.notEqual(execution.result.response.currentLayoutSha256, LAYOUT_SHA256);
  assert.equal(writeCount, 0);
  assert.deepEqual(server.errors, []);
});

test('save accepts a fully proven no-op without a version advance', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const snapshotFile = path.join(directory, 'snapshot.json');
  writeJson(layoutFile, NODE_MAP);
  const server = await startServer(t, async (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, layoutContract());
    if (request.url.endsWith('/validate')) {
      return sendJson(response, 200, {
        valid: true,
        lint: [],
        nodeMap: NODE_MAP,
        candidateLayoutSha256: LAYOUT_SHA256,
      });
    }
    if (request.method === 'PUT') {
      await readBody(request);
      return sendJson(response, 200, {
        ...layoutResponse(server.site, 17, 'v1'),
        saved: true,
        candidateLayoutSha256: LAYOUT_SHA256,
      });
    }
    return sendJson(response, 200, {
      ...layoutResponse(server.site, 17, 'v1'),
      presentation: { layout: 'default', disableGlobalTemplates: false },
    });
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: 'v1', nodeMap: NODE_MAP,
  }));

  const execution = await runClient([
    'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', LAYOUT_SHA256,
    '--out', path.join(directory, 'no-op.json'),
  ]);

  assert.equal(execution.exitCode, 0, JSON.stringify(execution.result));
  assertEnvelope(execution.result, { ok: true, stage: 'save', code: 'SAVE_OK' });
  assert.equal(execution.result.evidence.versionAdvanced, false);
  assert.equal(execution.result.evidence.layoutChanged, false);
  assert.deepEqual(execution.result.evidence.readbackLayout, NODE_MAP);
  assert.deepEqual(server.errors, []);
});

test('save accepts a same-token change only with exact candidate and canonical readback proof', async (t) => {
  const directory = tempDir(t);
  const changedNodeMap = {
    ...NODE_MAP,
    'section-1': {
      ...NODE_MAP['section-1'],
      props: { background: '#111111' },
    },
  };
  const changedSha256 = nodeMapSha256(changedNodeMap);
  const layoutFile = path.join(directory, 'same-token-layout.json');
  const snapshotFile = path.join(directory, 'same-token-snapshot.json');
  writeJson(layoutFile, changedNodeMap);
  let writeCompleted = false;
  const server = await startServer(t, async (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, layoutContract());
    if (request.url.endsWith('/validate')) {
      return sendJson(response, 200, {
        valid: true,
        lint: [],
        nodeMap: changedNodeMap,
        candidateLayoutSha256: changedSha256,
      });
    }
    if (request.method === 'PUT') {
      writeCompleted = true;
      await readBody(request);
      return sendJson(response, 200, {
        ...layoutResponse(server.site, 17, 'v1', changedNodeMap),
        saved: true,
        candidateLayoutSha256: changedSha256,
      });
    }
    return sendJson(response, 200, layoutResponse(
      server.site,
      17,
      'v1',
      writeCompleted ? changedNodeMap : NODE_MAP
    ));
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: 'v1', nodeMap: NODE_MAP,
  }));

  const execution = await runClient([
    'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', changedSha256,
    '--out', path.join(directory, 'same-token.json'),
  ]);

  assert.equal(execution.exitCode, 0, JSON.stringify(execution.result));
  assertEnvelope(execution.result, { ok: true, stage: 'save', code: 'SAVE_OK' });
  assert.equal(execution.result.evidence.versionAdvanced, false);
  assert.equal(execution.result.evidence.layoutChanged, true);
  assert.equal(execution.result.evidence.savedLayoutSha256, changedSha256);
  assert.equal(execution.result.evidence.readbackLayoutSha256, changedSha256);
  assert.deepEqual(server.errors, []);
});

test('save rejects a mismatched candidate proof even when the canonical representation changed', async (t) => {
  const directory = tempDir(t);
  const changedNodeMap = {
    ...NODE_MAP,
    'section-1': {
      ...NODE_MAP['section-1'],
      props: { background: '#111111' },
    },
  };
  const changedSha256 = nodeMapSha256(changedNodeMap);
  const layoutFile = path.join(directory, 'candidate-mismatch-layout.json');
  const snapshotFile = path.join(directory, 'candidate-mismatch-snapshot.json');
  writeJson(layoutFile, changedNodeMap);
  const server = await startServer(t, async (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, layoutContract());
    if (request.url.endsWith('/validate')) {
      return sendJson(response, 200, {
        valid: true,
        lint: [],
        nodeMap: changedNodeMap,
        candidateLayoutSha256: changedSha256,
      });
    }
    if (request.method === 'PUT') {
      await readBody(request);
      return sendJson(response, 200, {
        ...layoutResponse(server.site, 17, 'v2', changedNodeMap),
        saved: true,
        candidateLayoutSha256: '0'.repeat(64),
      });
    }
    return sendJson(response, 200, layoutResponse(server.site, 17, 'v1', NODE_MAP));
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: 'v1', nodeMap: NODE_MAP,
  }));

  const execution = await runClient([
    'save', '--site', server.site, '--page-id', '17', '--layout', layoutFile,
    '--snapshot', snapshotFile, '--expected-layout-sha256', changedSha256,
    '--out', path.join(directory, 'candidate-mismatch.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'save', code: 'SAVE_EVIDENCE_INVALID' });
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
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract());
      return;
    }
    sendJson(response, 200, layoutResponse(server.site, 17, 'v1'));
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
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/17/layout',
  ]);
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
      if (request.url.endsWith('/contract')) {
        sendJson(response, 200, layoutContract());
      } else if (request.method === 'GET') {
        sendJson(response, 200, {
          ...layoutResponse(server.site, 21, 'v1'),
          presentation: { layout: 'default', disableGlobalTemplates: false },
        });
      } else if (request.url.endsWith('/validate')) {
        await readBody(request);
        sendJson(response, 200, {
          valid: true,
          lint: [],
          nodeMap: NODE_MAP,
          candidateLayoutSha256: LAYOUT_SHA256,
        });
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
      'GET /wp-json/monteby/v1/contract',
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
      currentLayoutSha256: LAYOUT_SHA256,
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
  assert.deepEqual(validateBody, {
    operations: OPERATIONS,
    expectedModifiedGmt: 'v1',
    expectedLayoutSha256: LAYOUT_SHA256,
  });
  assert.equal(execution.result.evidence.operationsSha256, OPERATIONS_SHA256);
  assert.equal(execution.result.evidence.currentLayoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.evidence.snapshotSha256, canonicalSha256(snapshot));
  assert.equal(execution.result.evidence.candidateLayoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.nextAction.id, 'save_validated_patch');
  assert.ok(execution.result.nextAction.args.includes(OPERATIONS_SHA256));
  assert.ok(execution.result.nextAction.args.includes(LAYOUT_SHA256));
  assert.ok(execution.result.nextAction.args.includes('a'.repeat(64)));
  assert.deepEqual(JSON.parse(fs.readFileSync(reportFile, 'utf8')), execution.result);
  assert.deepEqual(server.errors, []);
});

test('patch-validate rejects a source layout digest that is not the snapshotted representation', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  writeJson(operationsFile, OPERATIONS);
  const server = await startServer(t, (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, patchContract());
    return sendJson(response, 200, {
      valid: true,
      operationCount: 1,
      operationsSha256: OPERATIONS_SHA256,
      currentLayoutSha256: '0'.repeat(64),
      candidateLayoutSha256: LAYOUT_SHA256,
      compiledHtmlSha256: 'a'.repeat(64),
      postModifiedGmt: 'v1',
      layout: NODE_MAP,
    });
  });
  writeJson(snapshotFile, pageSnapshot(server.site, 17, {
    postModifiedGmt: 'v1', nodeMap: NODE_MAP,
  }));

  const execution = await runClient([
    'patch-validate', '--site', server.site, '--page-id', '17',
    '--operations', operationsFile, '--snapshot', snapshotFile,
    '--out', path.join(directory, 'source-drift.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, {
    ok: false,
    stage: 'patch-validate',
    code: 'PATCH_VALIDATION_EVIDENCE_INVALID',
  });
  assert.deepEqual(server.errors, []);
});

test('patch workflows reject ambiguous routes and colliding proof fields before preflight', async (t) => {
  for (const scenario of ['duplicate-route-placeholder', 'colliding-write-field']) {
    const directory = tempDir(t);
    const snapshotFile = path.join(directory, 'layout-before.json');
    const operationsFile = path.join(directory, 'operations.json');
    writeJson(operationsFile, OPERATIONS);
    const contract = patchContract();
    if (scenario === 'duplicate-route-placeholder') {
      contract.layoutPersistence.operations.validate.endpoint = '/monteby/v1/pages/{postId}/copy/{postId}/validate';
    } else {
      contract.layoutPersistence.operations.writeCompiledPreconditionField = 'operations';
    }
    let requestCount = 0;
    const server = await startServer(t, (_request, response) => {
      requestCount += 1;
      sendJson(response, 200, contract);
    });
    writeJson(snapshotFile, pageSnapshot(server.site, 17, {
      postModifiedGmt: 'v1', nodeMap: NODE_MAP,
    }));

    const execution = await runClient([
      'patch-validate', '--site', server.site, '--page-id', '17',
      '--operations', operationsFile, '--snapshot', snapshotFile,
      '--out', path.join(directory, `${scenario}.json`),
    ]);

    assert.equal(execution.exitCode, 1);
    assert.equal(execution.result.code, 'PATCH_CAPABILITY_MISSING');
    assert.equal(requestCount, 1);
    assert.deepEqual(server.errors, []);
  }
});

test('patch-save accepts a same-token change only with exact candidate, compiled, and readback proof', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  const reportFile = path.join(directory, 'patch-validate-response.json');
  writeJson(operationsFile, OPERATIONS);
  const requests = [];
  let applyBody;
  const persistedNodeMap = { schemaVersion: 4, ...NODE_MAP };
  const persistedLayoutSha256 = nodeMapSha256(persistedNodeMap);
  const customContract = patchContract({
    pagePath: '/monteby/v1/custom/pages/{postId}/layout',
    carrier: 'documentTree',
    versionField: 'revisionToken',
    writePreconditionField: 'ifRevision',
  });
  const server = await startServer(t, async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) return sendJson(response, 200, {
      ...customContract, productVersion: '1.5.3', authoring: { capabilities: { providerRenderedWidgetSave: true } },
    });
    if (request.method === 'GET') return sendJson(response, 200, { data: {
      id: 17, postType: 'page', viewUrl: `${server.site}/page-17/`,
      revisionToken: 'v1',
      documentTree: applyBody ? persistedNodeMap : NODE_MAP,
      layoutSha256: applyBody ? persistedLayoutSha256 : LAYOUT_SHA256,
      pageSettingsSha256: PAGE_SETTINGS_SHA256,
    } });
    applyBody = await readBody(request);
    return sendJson(response, 200, {
      id: 17,
      saved: true,
      operationCount: 1,
      operationsSha256: OPERATIONS_SHA256,
      candidateLayoutSha256: persistedLayoutSha256,
      compiledHtmlSha256: 'a'.repeat(64),
      revisionToken: 'v1',
      layout: persistedNodeMap,
      layoutSha256: persistedLayoutSha256,
    });
  });
  const snapshot = pageSnapshot(server.site, 17, {
    revisionToken: 'v1', documentTree: NODE_MAP,
  });
  writeJson(snapshotFile, snapshot);
  writeJson(reportFile, {
    schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    scope: { site: server.site, pageId: 17 },
    evidence: {
      versionField: 'revisionToken', versionToken: 'v1', operationsSha256: OPERATIONS_SHA256,
      layoutSha256: LAYOUT_SHA256,
      snapshotSha256: canonicalSha256(snapshot),
      candidateLayoutSha256: persistedLayoutSha256,
      compiledHtmlSha256: 'a'.repeat(64),
    },
  });

  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17',
    '--operations', operationsFile, '--snapshot', snapshotFile,
    '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', persistedLayoutSha256,
    '--expected-compiled-html-sha256', 'a'.repeat(64),
    '--out', path.join(directory, 'patch-save-response.json'),
  ]);

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, { ok: true, stage: 'patch-save', code: 'PATCH_SAVE_OK' });
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/custom/pages/17/layout',
    'POST /wp-json/monteby/v1/pages/17/layout/operations',
    'GET /wp-json/monteby/v1/custom/pages/17/layout',
  ]);
  assert.deepEqual(applyBody, {
    operations: OPERATIONS,
    ifRevision: 'v1',
    expectedLayoutSha256: LAYOUT_SHA256,
    expectedCandidateSha256: persistedLayoutSha256,
    expectedCompiledHtmlSha256: 'a'.repeat(64),
  });
  assert.equal(execution.result.nextAction.id, 'verify_saved_patch');
  assert.equal(execution.result.evidence.candidateLayoutSha256, persistedLayoutSha256);
  assert.equal(execution.result.evidence.savedLayoutSha256, persistedLayoutSha256);
  assert.equal(execution.result.evidence.readbackLayoutSha256, persistedLayoutSha256);
  assert.equal(execution.result.evidence.versionField, 'revisionToken');
  assert.equal(execution.result.evidence.versionAdvanced, false);
  assert.equal(execution.result.evidence.layoutChanged, true);
  const beforeBytes = fs.readFileSync(snapshotFile, 'utf8');
  const preflightBytes = fs.readFileSync(reportFile, 'utf8');
  const verification = await runClient(execution.result.nextAction.args);
  assert.equal(verification.exitCode, 0);
  assert.equal(verification.result.code, 'SNAPSHOT_OK');
  assert.equal(verification.result.artifacts.snapshot, path.join(directory, 'saved-patch', 'layout-before.json'));
  assert.equal(JSON.parse(fs.readFileSync(verification.result.artifacts.snapshot, 'utf8')).data.revisionToken, 'v1');
  assert.equal(fs.readFileSync(snapshotFile, 'utf8'), beforeBytes);
  assert.equal(fs.readFileSync(reportFile, 'utf8'), preflightBytes);
  assert.equal(requests.filter((request) => request.startsWith('POST ')).length, 1);
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
    return sendJson(response, 200, layoutResponse(server.site, 17, 'v2'));
  });
  const snapshot = pageSnapshot(server.site, 17, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
  writeJson(snapshotFile, snapshot);
  writeJson(reportFile, {
    schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    scope: { site: server.site, pageId: 17 },
    evidence: {
      versionField: 'postModifiedGmt',
      versionToken: 'v1',
      layoutSha256: LAYOUT_SHA256,
      snapshotSha256: canonicalSha256(snapshot),
      operationsSha256: OPERATIONS_SHA256,
      candidateLayoutSha256: LAYOUT_SHA256,
      compiledHtmlSha256: 'a'.repeat(64),
    },
  });

  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17',
    '--operations', operationsFile, '--snapshot', snapshotFile, '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', LAYOUT_SHA256,
    '--expected-compiled-html-sha256', 'a'.repeat(64),
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
      versionField: 'postModifiedGmt', versionToken: 'v1', snapshotSha256: canonicalSha256(snapshot),
      layoutSha256: LAYOUT_SHA256,
      operationsSha256: OPERATIONS_SHA256,
      candidateLayoutSha256: LAYOUT_SHA256,
      compiledHtmlSha256: 'a'.repeat(64),
    },
  });

  // The live contract is the only request permitted before the local digest mismatch.
  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17', '--operations', operationsFile,
    '--snapshot', snapshotFile, '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', LAYOUT_SHA256,
    '--expected-compiled-html-sha256', 'a'.repeat(64),
    '--out', path.join(directory, 'changed.json'),
  ]);
  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, { ok: false, stage: 'patch-save', code: 'OPERATIONS_SHA256_MISMATCH' });
  assert.equal(execution.result.nextAction.id, 'restart_patch_preflight');
  assert.equal(requestCount, 1);
  assert.deepEqual(server.errors, []);
});

test('patch-save rejects a compiled output digest not bound to preflight', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'layout-before.json');
  const operationsFile = path.join(directory, 'operations.json');
  const reportFile = path.join(directory, 'patch-validate-response.json');
  writeJson(operationsFile, OPERATIONS);
  let requestCount = 0;
  const server = await startServer(t, (_request, response) => {
    requestCount += 1;
    sendJson(response, 200, patchContract());
  });
  const snapshot = pageSnapshot(server.site, 17, { postModifiedGmt: 'v1', nodeMap: NODE_MAP });
  writeJson(snapshotFile, snapshot);
  writeJson(reportFile, {
    schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    scope: { site: server.site, pageId: 17 },
    evidence: {
      versionField: 'postModifiedGmt',
      versionToken: 'v1',
      layoutSha256: LAYOUT_SHA256,
      snapshotSha256: canonicalSha256(snapshot),
      operationsSha256: OPERATIONS_SHA256,
      candidateLayoutSha256: LAYOUT_SHA256,
      compiledHtmlSha256: 'a'.repeat(64),
    },
  });

  const execution = await runClient([
    'patch-save', '--site', server.site, '--page-id', '17', '--operations', operationsFile,
    '--snapshot', snapshotFile, '--patch-report', reportFile,
    '--expected-operations-sha256', OPERATIONS_SHA256,
    '--expected-candidate-layout-sha256', LAYOUT_SHA256,
    '--expected-compiled-html-sha256', 'b'.repeat(64),
    '--out', path.join(directory, 'compiled-mismatch.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assertEnvelope(execution.result, {
    ok: false,
    stage: 'patch-save',
    code: 'COMPILED_HTML_SHA256_MISMATCH',
  });
  assert.equal(requestCount, 1, 'only live contract discovery may precede the local proof mismatch');
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
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract());
      return;
    }
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
  assert.deepEqual(requestBody, { nodeMap: NODE_MAP, postId: 17 });
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
    candidateLayoutSha256: LAYOUT_SHA256,
    savedLayoutSha256: LAYOUT_SHA256,
    readbackLayoutSha256: LAYOUT_SHA256,
    versionField: 'postModifiedGmt',
    previousVersionToken: 'v1',
    previousLayoutSha256: LAYOUT_SHA256,
    versionToken: 'v2',
    versionAdvanced: true,
    layoutChanged: false,
    validation: { valid: true, lint: [] },
    saveReport: saveReportFile,
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(previewReportFile, 'utf8')), execution.result);
  assert.equal(execution.result.nextAction.id, 'verify_canonical_page');
  assert.ok(execution.result.nextAction.args.includes('$MONTEBY_ITERATION_REPORT'));
  assert.ok(execution.result.nextAction.args.includes(previewReportFile));
  assert.ok(execution.result.nextAction.args.includes(`${server.site}/page-17/`));
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_ITERATION_REPORT'));
  assert.equal(execution.result.nextAction.requires.includes('MONTEBY_PUBLIC_PAGE_URL'), false);
  assert.ok(execution.result.nextAction.requires.includes('PUBLIC_PAGE_URL_CONFIRMED'));
  assert.equal(
    fs.readdirSync(directory).some((name) => name.endsWith('.tmp')),
    false
  );
  assert.deepEqual(server.errors, []);
});

test('preview refuses a missing descriptor without calling a guessed endpoint', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const saveReportFile = path.join(directory, 'save.json');
  writeJson(layoutFile, NODE_MAP);
  let requestCount = 0;
  const contract = layoutContract();
  delete contract.layoutPersistence.resources.preview;
  const server = await startServer(t, (_request, response) => {
    requestCount += 1;
    sendJson(response, 200, contract);
  });
  writeJson(saveReportFile, saveReport(server.site, 17));

  const execution = await runClient([
    'preview', '--site', server.site, '--layout', layoutFile,
    '--save-report', saveReportFile, '--out', path.join(directory, 'preview.html'),
    '--report-out', path.join(directory, 'preview-report.json'),
  ]);
  assert.equal(execution.exitCode, 1);
  assert.equal(execution.result.code, 'PREVIEW_RESOURCE_MISSING');
  assert.equal(requestCount, 1);
  assert.deepEqual(server.errors, []);
});

test('preview rejects a carrier colliding with its page context before rendering', async (t) => {
  const directory = tempDir(t);
  const layoutFile = path.join(directory, 'layout.json');
  const saveReportFile = path.join(directory, 'save.json');
  writeJson(layoutFile, NODE_MAP);
  writeJson(saveReportFile, saveReport('https://placeholder.invalid', 17));
  const contract = layoutContract({ previewContextField: 'nodeMap' });
  let requestCount = 0;
  const server = await startServer(t, (_request, response) => {
    requestCount += 1;
    sendJson(response, 200, contract);
  });
  writeJson(saveReportFile, saveReport(server.site, 17));

  const execution = await runClient([
    'preview', '--site', server.site, '--layout', layoutFile,
    '--save-report', saveReportFile, '--out', path.join(directory, 'preview.html'),
    '--report-out', path.join(directory, 'preview-report.json'),
  ]);

  assert.equal(execution.exitCode, 1);
  assert.equal(execution.result.code, 'PREVIEW_RESOURCE_MISSING');
  assert.equal(requestCount, 1, 'only contract discovery may run');
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
    {
      report: (() => {
        const report = saveReport(server.site, 17);
        report.evidence.pageId = 18;
        return report;
      })(),
      code: 'SAVE_REPORT_INVALID',
    },
    {
      report: (() => {
        const report = saveReport(server.site, 17);
        report.evidence.site = 'https://different.example';
        return report;
      })(),
      code: 'SAVE_REPORT_INVALID',
    },
    {
      report: (() => {
        const report = saveReport(server.site, 17);
        report.evidence.layoutSha256 = '0'.repeat(64);
        return report;
      })(),
      code: 'SAVE_REPORT_INVALID',
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
  const server = await startServer(t, (request, response) => {
    if (request.url.endsWith('/contract')) {
      sendJson(response, 200, layoutContract());
      return;
    }
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

test('branding-snapshot discovers the bounded resource and records exact site-scoped evidence', async (t) => {
  const requests = [];
  const contract = brandingContract();
  const document = brandingDocument(BRANDING_REVISION, 'https://cdn.example.test/logo.svg');
  const server = await startServer(t, (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    if (request.url.endsWith('/contract')) return sendJson(response, 200, contract);
    if (request.url.endsWith('/site/branding')) return sendJson(response, 200, document);
    return sendJson(response, 500, { code: 'forbidden_test_path' });
  });
  const outDir = tempDir(t);
  const reportFile = path.join(outDir, 'branding-snapshot-report.json');

  const execution = await runClient([
    'branding-snapshot', '--site', server.site, '--out-dir', outDir, '--out', reportFile,
  ]);

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, {
    ok: true,
    stage: 'branding-snapshot',
    code: 'BRANDING_SNAPSHOT_OK',
  });
  assert.deepEqual(
    requests.map(({ method, url }) => `${method} ${url}`),
    [
      'GET /wp-json/monteby/v1/contract',
      'GET /wp-json/monteby/v1/site/branding',
    ]
  );
  assert.ok(requests.every(({ authorization }) => authorization === AUTH));
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(outDir, 'branding-contract.json'), 'utf8')),
    contract
  );
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(outDir, 'branding-before.json'), 'utf8')
  );
  assert.equal(snapshot.artifact, 'monteby-site-branding-snapshot');
  assert.equal(snapshot.site, server.site);
  assert.deepEqual(snapshot.data, document);
  assert.deepEqual(JSON.parse(fs.readFileSync(reportFile, 'utf8')), execution.result);
  assert.equal(execution.result.nextAction.id, 'save_approved_site_branding');
  assert.ok(execution.result.nextAction.args.includes('$MONTEBY_LOGO_URL'));
  assert.ok(execution.result.nextAction.requires.includes('MONTEBY_LOGO_URL'));
  assert.equal(JSON.stringify(snapshot).includes(AUTH), false);
  assert.deepEqual(server.errors, []);
});

test('branding discovery refuses forbidden or malformed resources before a second request', async (t) => {
  const forbiddenResources = [
    { path: '/wp/v2/settings' },
    { path: '/gotoweb-craft/v1/settings' },
    { path: 'https://attacker.example/settings' },
    { writeMethod: 'POST' },
  ];

  for (const [index, override] of forbiddenResources.entries()) {
    let requestCount = 0;
    const server = await startServer(t, (_request, response) => {
      requestCount += 1;
      sendJson(response, 200, brandingContract(override));
    });
    const execution = await runClient([
      'branding-snapshot', '--site', server.site,
      '--out-dir', path.join(tempDir(t), String(index)),
    ]);

    assert.equal(execution.exitCode, 1);
    assertEnvelope(execution.result, {
      ok: false,
      stage: 'branding-snapshot',
      code: 'BRANDING_CAPABILITY_MISSING',
    });
    assert.equal(requestCount, 1);
    assert.equal(execution.result.nextAction.id, 'blocked_client_error');
    assert.deepEqual(server.errors, []);
  }
});

test('branding-save sends one exact bounded write and verifies the returned document', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'branding-before.json');
  const reportFile = path.join(directory, 'branding-save-response.json');
  const logoUrl = 'https://cdn.example.test/approved-logo.webp';
  const savedRevision = 'b'.repeat(64);
  const requests = [];
  const server = await startServer(t, async (request, response) => {
    const body = await readBody(request);
    requests.push({ method: request.method, url: request.url, body });
    if (request.url.endsWith('/contract')) return sendJson(response, 200, brandingContract());
    if (request.method === 'GET' && request.url.endsWith('/site/branding')) {
      return sendJson(response, 200, brandingDocument());
    }
    if (request.method === 'PUT' && request.url.endsWith('/site/branding')) {
      return sendJson(response, 200, brandingDocument(savedRevision, logoUrl));
    }
    return sendJson(response, 500, { code: 'forbidden_test_path' });
  });
  writeJson(snapshotFile, brandingSnapshot(server.site));

  const execution = await runClient([
    'branding-save', '--site', server.site, '--logo-url', logoUrl,
    '--snapshot', snapshotFile, '--out', reportFile,
  ]);

  assert.equal(execution.exitCode, 0);
  assertEnvelope(execution.result, {
    ok: true,
    stage: 'branding-save',
    code: 'BRANDING_SAVE_OK',
  });
  assert.deepEqual(
    requests.map(({ method, url }) => `${method} ${url}`),
    [
      'GET /wp-json/monteby/v1/contract',
      'GET /wp-json/monteby/v1/site/branding',
      'PUT /wp-json/monteby/v1/site/branding',
    ]
  );
  assert.deepEqual(requests[2].body, {
    logoUrl,
    expectedRevision: BRANDING_REVISION,
  });
  assert.deepEqual(Object.keys(requests[2].body).sort(), ['expectedRevision', 'logoUrl']);
  assert.ok(requests.every(({ url }) => !url.includes('/wp/v2/settings')));
  assert.ok(requests.every(({ url }) => !url.includes('/gotoweb-craft/v1/settings')));
  assert.ok(requests.every(({ url }) => !url.includes('/pages/')));
  assert.equal(execution.result.nextAction.id, 'verify_saved_site_branding');
  assert.equal(execution.result.nextAction.args[0], 'branding-snapshot');
  assert.deepEqual(server.errors, []);
});

test('branding preserves additive native identity fields while writing only the Monteby logo', async (t) => {
  for (const corruptIdentity of [false, true]) {
    const directory = tempDir(t);
    const identity = { siteName: 'Example site', tagline: 'Native tagline', siteIconId: 91, siteIconUrl: 'https://cdn.example.test/icon.png' };
    const logoUrl = 'https://cdn.example.test/approved.webp';
    const original = { ...brandingDocument(), ...identity };
    const writes = [];
    const server = await startServer(t, async (request, response) => {
      if (request.url.endsWith('/contract')) return sendJson(response, 200, brandingContract());
      if (request.method === 'GET') return sendJson(response, 200, original);
      writes.push(await readBody(request));
      return sendJson(response, 200, {
        ...brandingDocument('b'.repeat(64), logoUrl), ...identity,
        ...(corruptIdentity ? { siteIconId: 92 } : {}),
      });
    });
    const snapshot = await runClient(['branding-snapshot', '--site', server.site, '--out-dir', directory]);
    assert.equal(snapshot.exitCode, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'branding-before.json'), 'utf8')).data, original);
    const saved = await runClient([
      'branding-save', '--site', server.site, '--logo-url', logoUrl,
      '--out-dir', directory, '--out', path.join(directory, 'saved.json'),
    ]);
    assert.equal(saved.exitCode, corruptIdentity ? 1 : 0);
    assert.equal(saved.result.code, corruptIdentity ? 'BRANDING_SAVE_EVIDENCE_INVALID' : 'BRANDING_SAVE_OK');
    assert.deepEqual(writes, [{ logoUrl, expectedRevision: BRANDING_REVISION }]);
    assert.deepEqual(server.errors, []);
  }
});

test('branding rejects partial or invalid native identity and operational response fields', async (t) => {
  const complete = {
    ...brandingDocument(), siteName: 'Example', tagline: '', siteIconId: 0, siteIconUrl: '',
  };
  for (const invalid of [
    { ...brandingDocument(), siteName: 'Partial identity' },
    { ...complete, siteIconId: '91' },
    { ...complete, siteIconId: -1 },
    { ...complete, siteIconId: 2.5 },
    { ...complete, siteIconUrl: 'javascript:alert(1)' },
    { ...complete, tagline: null },
    { ...complete, custom_logo: 91 },
    { ...complete, smtpPassword: 'not-public' },
  ]) {
    const server = await startServer(t, (request, response) => sendJson(
      response, 200, request.url.endsWith('/contract') ? brandingContract() : invalid
    ));
    const result = await runClient(['branding-snapshot', '--site', server.site, '--out-dir', tempDir(t)]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.result.code, 'BRANDING_DOCUMENT_INVALID');
    assert.deepEqual(server.errors, []);
  }
});

test('branding-save rejects cross-site and stale snapshots without unsafe writes', async (t) => {
  const directory = tempDir(t);
  const crossSiteFile = path.join(directory, 'cross-site.json');
  const staleFile = path.join(directory, 'stale.json');
  let requestCount = 0;
  let writeCount = 0;
  const server = await startServer(t, (request, response) => {
    requestCount += 1;
    if (request.method === 'PUT') writeCount += 1;
    if (request.url.endsWith('/contract')) return sendJson(response, 200, brandingContract());
    return sendJson(response, 200, brandingDocument('b'.repeat(64)));
  });
  writeJson(crossSiteFile, brandingSnapshot('https://different.example.test'));
  writeJson(staleFile, brandingSnapshot(server.site));

  const crossSite = await runClient([
    'branding-save', '--site', server.site, '--logo-url', 'https://cdn.example.test/logo.svg',
    '--snapshot', crossSiteFile, '--out', path.join(directory, 'cross-site-report.json'),
  ]);
  assertEnvelope(crossSite.result, {
    ok: false,
    stage: 'branding-save',
    code: 'BRANDING_SNAPSHOT_SCOPE_MISMATCH',
  });
  assert.equal(requestCount, 0);
  assert.equal(crossSite.result.nextAction.id, 'resnapshot_and_reconcile_site_branding');

  const stale = await runClient([
    'branding-save', '--site', server.site, '--logo-url', 'https://cdn.example.test/logo.svg',
    '--snapshot', staleFile, '--out', path.join(directory, 'stale-report.json'),
  ]);
  assertEnvelope(stale.result, {
    ok: false,
    stage: 'branding-save',
    code: 'BRANDING_SNAPSHOT_STALE',
  });
  assert.equal(requestCount, 2);
  assert.equal(writeCount, 0);
  assert.equal(stale.result.nextAction.id, 'resnapshot_and_reconcile_site_branding');
  assert.ok(stale.result.nextAction.requires.includes('MANUAL_BRANDING_RECONCILIATION'));
  assert.deepEqual(server.errors, []);
});

test('branding-save never retries revision conflicts or missing preconditions', async (t) => {
  for (const status of [409, 428]) {
    const directory = tempDir(t);
    const snapshotFile = path.join(directory, `branding-${status}.json`);
    let putCount = 0;
    const server = await startServer(t, (request, response) => {
      if (request.url.endsWith('/contract')) return sendJson(response, 200, brandingContract());
      if (request.method === 'GET') return sendJson(response, 200, brandingDocument());
      putCount += 1;
      return sendJson(response, status, { code: `branding_${status}` });
    });
    writeJson(snapshotFile, brandingSnapshot(server.site));

    const execution = await runClient([
      'branding-save', '--site', server.site,
      '--logo-url', 'https://cdn.example.test/logo.svg',
      '--snapshot', snapshotFile, '--out', path.join(directory, `report-${status}.json`),
    ]);

    assertEnvelope(execution.result, {
      ok: false,
      stage: 'branding-save',
      code: status === 409 ? 'REST_CONFLICT' : 'REST_PRECONDITION_REQUIRED',
    });
    assert.equal(putCount, 1);
    assert.equal(execution.result.retryable, false);
    assert.equal(execution.result.nextAction.id, 'resnapshot_and_reconcile_site_branding');
    assert.equal(execution.result.nextAction.args[0], 'branding-snapshot');
    assert.deepEqual(server.errors, []);
  }
});

test('branding-save treats incomplete 2xx evidence as terminal after one write', async (t) => {
  const directory = tempDir(t);
  const snapshotFile = path.join(directory, 'branding-before.json');
  let putCount = 0;
  const server = await startServer(t, (request, response) => {
    if (request.url.endsWith('/contract')) return sendJson(response, 200, brandingContract());
    if (request.method === 'GET') return sendJson(response, 200, brandingDocument());
    putCount += 1;
    return sendJson(response, 200, {
      version: 1,
      revision: 'b'.repeat(64),
    });
  });
  writeJson(snapshotFile, brandingSnapshot(server.site));

  const execution = await runClient([
    'branding-save', '--site', server.site,
    '--logo-url', 'https://cdn.example.test/logo.svg',
    '--snapshot', snapshotFile, '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: false,
    stage: 'branding-save',
    code: 'BRANDING_DOCUMENT_INVALID',
  });
  assert.equal(putCount, 1);
  assert.equal(execution.result.nextAction.id, 'blocked_client_error');
  assert.equal(execution.result.nextAction.tool, '');
  assert.deepEqual(server.errors, []);
});

test('branding commands reject unsafe URLs, foreign options, and response shape drift', async (t) => {
  const invalidUrls = [
    'javascript:alert(1)',
    'data:image/svg+xml,test',
    'file:///tmp/logo.svg',
    'https://user:password@example.test/logo.svg',
    'https://example.test/logo\n.svg',
    `https://example.test/${'a'.repeat(2_048)}`,
  ];
  for (const [index, logoUrl] of invalidUrls.entries()) {
    const execution = await runClient([
      'branding-save', '--site', 'https://example.test', '--logo-url', logoUrl,
      '--snapshot', `/tmp/unused-${index}.json`, '--out', `/tmp/unused-report-${index}.json`,
    ]);
    assertEnvelope(execution.result, {
      ok: false,
      stage: 'branding-save',
      code: 'CLI_USAGE',
    });
  }

  const foreignOption = await runClient([
    'snapshot', '--site', 'https://example.test', '--page-id', '1', '--out-dir', tempDir(t),
    '--logo-url', 'https://example.test/logo.svg',
  ]);
  assertEnvelope(foreignOption.result, {
    ok: false,
    stage: 'snapshot',
    code: 'CLI_USAGE',
  });

  let requestCount = 0;
  const server = await startServer(t, (request, response) => {
    requestCount += 1;
    if (request.url.endsWith('/contract')) return sendJson(response, 200, brandingContract());
    return sendJson(response, 200, { ...brandingDocument(), custom_logo: 42 });
  });
  const invalidDocument = await runClient([
    'branding-snapshot', '--site', server.site, '--out-dir', tempDir(t),
  ]);
  assertEnvelope(invalidDocument.result, {
    ok: false,
    stage: 'branding-snapshot',
    code: 'BRANDING_DOCUMENT_INVALID',
  });
  assert.equal(requestCount, 2);
  assert.deepEqual(server.errors, []);
});

test('contract-fetch caches projections by ETag and hydrates components from the declared resource', async (t) => {
  const directory = tempDir(t);
  const cache = path.join(directory, 'contract-cache.json');
  const requests = [];
  const projection = {
    version: 1,
    productVersion: '1.6.0',
    mode: 'authoring',
    componentsMode: 'summary',
    components: [{ name: 'Section' }],
  };
  const server = await startServer(t, (request, response) => {
    requests.push({ url: request.url, etag: request.headers['if-none-match'] || '' });
    if (request.url === '/wp-json/monteby/v1/contract') {
      sendJson(response, 200, capabilityContract());
      return;
    }
    if (request.url.startsWith('/wp-json/monteby/v1/contract?')) {
      if (request.headers['if-none-match'] === '"projection-v1"') {
        response.writeHead(304, { ETag: '"projection-v1"' });
        response.end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        ETag: '"projection-v1"',
      });
      response.end(JSON.stringify(projection));
      return;
    }
    if (request.url === '/wp-json/monteby/v1/contract/components/Section') {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        ETag: '"section-v1"',
      });
      response.end(JSON.stringify({
        version: 1,
        productVersion: '1.6.0',
        component: { name: 'Section', controls: [] },
      }));
      return;
    }
    sendJson(response, 404, { code: 'not_found' });
  });

  const first = await runClient([
    'contract-fetch', '--site', server.site, '--mode', 'authoring',
    '--components', 'summary', '--cache', cache, '--out', path.join(directory, 'first.json'),
  ]);
  const second = await runClient([
    'contract-fetch', '--site', server.site, '--mode', 'authoring',
    '--components', 'summary', '--cache', cache, '--out', path.join(directory, 'second.json'),
  ]);
  const component = await runClient([
    'contract-fetch', '--site', server.site, '--component', 'Section',
    '--cache', cache, '--out', path.join(directory, 'component.json'),
  ]);

  assertEnvelope(first.result, { ok: true, stage: 'contract-fetch', code: 'CONTRACT_FETCH_OK' });
  assert.equal(first.result.evidence.notModified, false);
  assertEnvelope(second.result, { ok: true, stage: 'contract-fetch', code: 'CONTRACT_FETCH_OK' });
  assert.equal(second.result.evidence.notModified, true);
  assert.deepEqual(second.result.response, projection);
  assertEnvelope(component.result, { ok: true, stage: 'contract-fetch', code: 'CONTRACT_COMPONENT_OK' });
  assert.equal(component.result.response.component.name, 'Section');
  assert.equal(requests[1].etag, '"projection-v1"');
  assert.deepEqual(server.errors, []);
});

test('contract-fetch rejects mismatched scopes and unavailable features before writing cache', async (t) => {
  const directory = tempDir(t);
  const scopeCache = path.join(directory, 'scope-cache.json');
  const featureCache = path.join(directory, 'feature-cache.json');
  let projectionRequests = 0;
  const server = await startServer(t, (request, response) => {
    if (!request.url.startsWith('/wp-json/monteby/v1/contract?')) {
      return sendJson(response, 404, { code: 'not_found' });
    }
    projectionRequests += 1;
    if (projectionRequests === 1) {
      return sendJson(response, 200, {
        version: 1,
        productVersion: '1.6.0',
        mode: 'authoring',
        componentsMode: 'full',
        components: [],
      });
    }
    return sendJson(response, 200, {
      version: 1,
      productVersion: '1.5.7',
      mode: 'authoring',
      componentsMode: 'summary',
      components: [],
    });
  });

  const wrongScope = await runClient([
    'contract-fetch', '--site', server.site, '--mode', 'authoring',
    '--components', 'summary', '--cache', scopeCache, '--out', path.join(directory, 'scope.json'),
  ]);
  const unavailable = await runClient([
    'contract-fetch', '--site', server.site, '--mode', 'authoring',
    '--components', 'summary', '--cache', featureCache, '--out', path.join(directory, 'feature.json'),
  ]);

  assertEnvelope(wrongScope.result, {
    ok: false, stage: 'contract-fetch', code: 'CONTRACT_SCOPE_MISMATCH',
  });
  assertEnvelope(unavailable.result, {
    ok: false, stage: 'contract-fetch', code: 'blocked_plugin_version',
  });
  assert.equal(fs.existsSync(scopeCache), false);
  assert.equal(fs.existsSync(featureCache), false);
  assert.deepEqual(server.errors, []);
});

test('page-context and documents-list follow their descriptors and enforce exact scope', async (t) => {
  const directory = tempDir(t);
  const queryFile = path.join(directory, 'query.json');
  writeJson(queryFile, { hasLayout: true, postType: 'page', page: 2, perPage: 10 });
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(request.url);
    if (request.url === '/wp-json/monteby/v1/contract') return sendJson(response, 200, capabilityContract());
    if (request.url === '/wp-json/monteby/v1/pages/17/context') {
      return sendJson(response, 200, pageContext());
    }
    if (request.url.startsWith('/wp-json/monteby/v1/site/pages?')) {
      return sendJson(response, 200, {
        items: [documentSummary()], page: 2, perPage: 10, total: 11, totalPages: 2,
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const context = await runClient([
    'page-context', '--site', server.site, '--page-id', '17',
    '--out', path.join(directory, 'context.json'),
  ]);
  const documents = await runClient([
    'documents-list', '--site', server.site, '--input', queryFile,
    '--out', path.join(directory, 'documents.json'),
  ]);

  assertEnvelope(context.result, { ok: true, stage: 'page-context', code: 'PAGE_CONTEXT_OK' });
  assert.equal(context.result.response.postId, 17);
  assertEnvelope(documents.result, { ok: true, stage: 'documents-list', code: 'DOCUMENTS_LIST_OK' });
  assert.equal(documents.result.response.items[0].id, 17);
  assert.ok(requests.some((url) => url.includes('hasLayout=true')));
  assert.ok(requests.some((url) => url.includes('perPage=10')));
  assert.deepEqual(server.errors, []);
});

test('page-context and documents-list reject shallow or internally inconsistent responses', async (t) => {
  const directory = tempDir(t);
  const queryFile = path.join(directory, 'query.json');
  writeJson(queryFile, { page: 1, perPage: 10 });
  const server = await startServer(t, (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url === '/wp-json/monteby/v1/pages/17/context') {
      const invalid = pageContext();
      delete invalid.presentation;
      return sendJson(response, 200, invalid);
    }
    if (request.url.startsWith('/wp-json/monteby/v1/site/pages?')) {
      const invalid = documentSummary();
      delete invalid.editUrl;
      return sendJson(response, 200, {
        items: [invalid], page: 1, perPage: 10, total: 1, totalPages: 1,
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const context = await runClient([
    'page-context', '--site', server.site, '--page-id', '17',
    '--out', path.join(directory, 'context.json'),
  ]);
  const documents = await runClient([
    'documents-list', '--site', server.site, '--input', queryFile,
    '--out', path.join(directory, 'documents.json'),
  ]);

  assertEnvelope(context.result, {
    ok: false, stage: 'page-context', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assertEnvelope(documents.result, {
    ok: false, stage: 'documents-list', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assert.deepEqual(server.errors, []);
});

test('revision-list follows the page-scoped descriptor and returns bounded restore choices', async (t) => {
  const directory = tempDir(t);
  const queryFile = path.join(directory, 'revision-query.json');
  writeJson(queryFile, { page: 2, perPage: 10 });
  const layoutSha256 = 'a'.repeat(64);
  let collectionRequest = '';
  const server = await startServer(t, (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url.startsWith('/wp-json/monteby/v1/pages/17/layout/revisions?')) {
      collectionRequest = request.url;
      return sendJson(response, 200, {
        items: [{
          revisionId: 91,
          title: 'Page revision',
          authorId: 3,
          createdGmt: '2026-09-21 08:00:00',
          modifiedGmt: '2026-09-21 08:00:00',
          hasLayout: true,
          layoutSha256,
        }, {
          revisionId: 90,
          title: 'Classic revision',
          authorId: 3,
          createdGmt: '2026-09-20 08:00:00',
          modifiedGmt: '2026-09-20 08:00:00',
          hasLayout: false,
          layoutSha256: null,
        }],
        page: 2,
        perPage: 10,
        total: 12,
        totalPages: 2,
        currentPostModifiedGmt: '2026-09-21 08:05:00',
        currentLayoutSha256: LAYOUT_SHA256,
        currentDocumentSha256: DOCUMENT_SHA256,
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const execution = await runClient([
    'revision-list', '--site', server.site, '--page-id', '17', '--input', queryFile,
    '--out', path.join(directory, 'revisions.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: true, stage: 'revision-list', code: 'REVISION_LIST_OK',
  });
  assert.equal(execution.result.response.items[0].revisionId, 91);
  assert.equal(execution.result.response.items[1].layoutSha256, null);
  assert.ok(collectionRequest.includes('page=2'));
  assert.ok(collectionRequest.includes('perPage=10'));
  assert.equal(execution.result.evidence.currentPostModifiedGmt, '2026-09-21 08:05:00');
  assert.equal(execution.result.evidence.currentLayoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.evidence.currentDocumentSha256, DOCUMENT_SHA256);
  assert.deepEqual(server.errors, []);
});

test('revision-restore proves the scoped write through canonical layout readback', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'restore.json');
  writeJson(inputFile, {
    revisionId: 91,
    expectedModifiedGmt: 'v1',
    expectedDocumentSha256: DOCUMENT_SHA256,
  });
  const restored = {
    ...NODE_MAP,
    'section-1': { ...NODE_MAP['section-1'], props: { background: '#000000' } },
  };
  const methods = [];
  let restoredApplied = false;
  const restoredDocumentSha256 = 'd'.repeat(64);
  const server = await startServer(t, async (request, response) => {
    methods.push(`${request.method} ${request.url}`);
    if (request.url === '/wp-json/monteby/v1/contract') return sendJson(response, 200, capabilityContract());
    if (request.method === 'GET' && request.url === '/wp-json/monteby/v1/pages/17/layout/revisions') {
      return sendJson(response, 200, {
        items: [],
        page: 1,
        perPage: 50,
        total: 0,
        totalPages: 0,
        currentPostModifiedGmt: restoredApplied ? 'v2' : 'v1',
        currentLayoutSha256: restoredApplied ? nodeMapSha256(restored) : LAYOUT_SHA256,
        currentDocumentSha256: restoredApplied ? restoredDocumentSha256 : DOCUMENT_SHA256,
      });
    }
    if (request.method === 'POST' && request.url === '/wp-json/monteby/v1/pages/17/layout/restore') {
      assert.deepEqual(await readBody(request), {
        revisionId: 91,
        expectedModifiedGmt: 'v1',
        expectedDocumentSha256: DOCUMENT_SHA256,
      });
      restoredApplied = true;
      return sendJson(response, 200, {
        id: 17,
        restored: true,
        revisionId: 91,
        layout: restored,
        layoutSha256: nodeMapSha256(restored),
        documentSha256: restoredDocumentSha256,
        postModifiedGmt: 'v2',
      });
    }
    if (request.method === 'GET' && request.url === '/wp-json/monteby/v1/pages/17/layout') {
      return sendJson(response, 200, restoredApplied
        ? layoutResponse(server.site, 17, 'v2', restored)
        : layoutResponse(server.site, 17, 'v1', NODE_MAP));
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const execution = await runClient([
    'revision-restore', '--site', server.site, '--page-id', '17',
    '--input', inputFile, '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(execution.result, { ok: true, stage: 'revision-restore', code: 'REVISION_RESTORE_OK' });
  assert.equal(execution.result.evidence.revisionId, 91);
  assert.equal(execution.result.evidence.previousDocumentSha256, DOCUMENT_SHA256);
  assert.equal(execution.result.evidence.documentSha256, restoredDocumentSha256);
  assert.equal(execution.result.evidence.previousLayoutSha256, LAYOUT_SHA256);
  assert.equal(execution.result.evidence.layoutSha256, nodeMapSha256(restored));
  assert.equal(methods.filter((entry) => entry.startsWith('POST ')).length, 1);
  assert.deepEqual(server.errors, []);
});

test('revision-restore rejects same-version document drift before reading or mutating layout', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'restore.json');
  writeJson(inputFile, {
    revisionId: 91,
    expectedModifiedGmt: 'v1',
    expectedDocumentSha256: DOCUMENT_SHA256,
  });
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url.endsWith('/contract')) return sendJson(response, 200, capabilityContract());
    if (request.url.endsWith('/layout/revisions')) {
      return sendJson(response, 200, {
        items: [], page: 1, perPage: 50, total: 0, totalPages: 0,
        currentPostModifiedGmt: 'v1',
        currentLayoutSha256: LAYOUT_SHA256,
        currentDocumentSha256: '8'.repeat(64),
      });
    }
    return sendJson(response, 500, { code: 'must_not_be_called' });
  });

  const execution = await runClient([
    'revision-restore', '--site', server.site, '--page-id', '17',
    '--input', inputFile, '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: false, stage: 'revision-restore', code: 'REST_CONFLICT',
  });
  assert.deepEqual(requests, [
    'GET /wp-json/monteby/v1/contract',
    'GET /wp-json/monteby/v1/pages/17/layout/revisions',
  ]);
  assert.deepEqual(server.errors, []);
});

test('revision and SEO writes fail closed without their advertised digest preconditions', async (t) => {
  const directory = tempDir(t);
  const restoreFile = path.join(directory, 'restore-without-digest.json');
  const seoFile = path.join(directory, 'seo-without-digest.json');
  writeJson(restoreFile, { revisionId: 91, expectedModifiedGmt: 'v1' });
  writeJson(seoFile, {
    seo: { title: 'Updated title', description: 'Updated description' },
    expectedModifiedGmt: 'v1',
  });
  const mutations = [];
  const server = await startServer(t, (request, response) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) mutations.push(request.url);
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    return sendJson(response, 500, { code: 'unexpected_request' });
  });

  const restore = await runClient([
    'revision-restore', '--site', server.site, '--page-id', '17',
    '--input', restoreFile, '--out', path.join(directory, 'restore-report.json'),
  ]);
  const seo = await runClient([
    'seo-put', '--site', server.site, '--page-id', '17',
    '--input', seoFile, '--out', path.join(directory, 'seo-report.json'),
  ]);

  assertEnvelope(restore.result, {
    ok: false, stage: 'revision-restore', code: 'CAPABILITY_INPUT_INVALID',
  });
  assertEnvelope(seo.result, { ok: false, stage: 'seo-put', code: 'CAPABILITY_INPUT_INVALID' });
  assert.deepEqual(mutations, []);
  assert.deepEqual(server.errors, []);
});

test('preview-resource supports annotated subtree and virtual chrome without leaking HTML into JSON', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'preview.json');
  const reportFile = path.join(directory, 'preview-report.json');
  writeJson(inputFile, {
    layout: NODE_MAP,
    postId: 17,
    nodeId: 'section-1',
    annotateNodeIds: true,
    assets: true,
    document: true,
    globalTemplates: true,
    templateCandidates: { header: NODE_MAP },
    globalStyles: { colors: { primary: '#334455' } },
  });
  let previewBody;
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') return sendJson(response, 200, capabilityContract());
    if (request.url === '/wp-json/monteby/v1/preview') {
      previewBody = await readBody(request);
      const html = '<main>preview</main>';
      return sendJson(response, 200, {
        valid: true,
        html,
        document: `<!doctype html><html><body>${html}</body></html>`,
        assets: { styles: [], inlineCss: '', scripts: [] },
        globalTemplates: {
          header: 0,
          footer: 0,
          candidateRoles: ['header'],
          disabledByPresentation: false,
        },
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const execution = await runClient([
    'preview-resource', '--site', server.site, '--input', inputFile, '--out', reportFile,
  ]);

  assertEnvelope(execution.result, { ok: true, stage: 'preview-resource', code: 'PREVIEW_RESOURCE_OK' });
  assert.equal(previewBody.nodeMap.ROOT.type.resolvedName, 'RootCanvas');
  assert.equal(previewBody.templateCandidates.header.ROOT.type.resolvedName, 'RootCanvas');
  assert.equal(previewBody.globalStyles.colors.primary, '#334455');
  assert.equal(Object.hasOwn(execution.result.response, 'html'), false);
  assert.equal(Object.hasOwn(execution.result.response, 'document'), false);
  assert.equal(fs.readFileSync(execution.result.artifacts.preview, 'utf8').includes('preview'), true);
  assert.equal(fs.readFileSync(execution.result.artifacts.document, 'utf8').includes('preview'), true);
  assert.equal(execution.result.evidence.inputLayoutSha256, nodeMapSha256(NODE_MAP));
  assert.equal(execution.result.evidence.inputSha256, canonicalSha256(previewBody));
  assert.equal(
    execution.result.evidence.outputHtmlSha256,
    createHash('sha256').update('<main>preview</main>', 'utf8').digest('hex')
  );
  assert.match(execution.result.evidence.documentSha256, /^[a-f0-9]{64}$/u);
  assert.match(execution.result.evidence.globalStylesSha256, /^[a-f0-9]{64}$/u);
  assert.match(execution.result.evidence.templateCandidatesSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(server.errors, []);
});

test('preview-resource requires valid output and the requested standalone document proof', async (t) => {
  const directory = tempDir(t);
  const invalidFile = path.join(directory, 'invalid.json');
  const missingDocumentFile = path.join(directory, 'missing-document.json');
  writeJson(invalidFile, { layout: NODE_MAP });
  writeJson(missingDocumentFile, { layout: NODE_MAP, document: true });
  let previews = 0;
  const server = await startServer(t, (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url === '/wp-json/monteby/v1/preview') {
      previews += 1;
      return previews === 1
        ? sendJson(response, 200, { valid: false, html: '<main>invalid</main>' })
        : sendJson(response, 200, { valid: true, html: '<main>missing document</main>' });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const invalid = await runClient([
    'preview-resource', '--site', server.site, '--input', invalidFile,
    '--out', path.join(directory, 'invalid-report.json'),
  ]);
  const missingDocument = await runClient([
    'preview-resource', '--site', server.site, '--input', missingDocumentFile,
    '--out', path.join(directory, 'missing-document-report.json'),
  ]);

  assertEnvelope(invalid.result, {
    ok: false, stage: 'preview-resource', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assertEnvelope(missingDocument.result, {
    ok: false, stage: 'preview-resource', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assert.equal(fs.existsSync(path.join(directory, 'invalid-report-preview.html')), false);
  assert.equal(fs.existsSync(path.join(directory, 'missing-document-report-document.html')), false);
  assert.deepEqual(server.errors, []);
});

test('capability inputs reject Custom CSS before any REST request', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'preview.json');
  const secretFile = path.join(directory, 'preview-secret.json');
  writeJson(inputFile, { layout: NODE_MAP, globalStyles: { customCSS: 'body{}' } });
  writeJson(secretFile, { layout: NODE_MAP, integration: { clientSecret: 'must-not-leak' } });
  let requests = 0;
  const server = await startServer(t, (_request, response) => {
    requests += 1;
    sendJson(response, 500, { code: 'unexpected' });
  });

  const execution = await runClient([
    'preview-resource', '--site', server.site, '--input', inputFile,
    '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: false, stage: 'preview-resource', code: 'CAPABILITY_PRIVATE_INPUT',
  });
  const secretExecution = await runClient([
    'preview-resource', '--site', server.site, '--input', secretFile,
    '--out', path.join(directory, 'secret-report.json'),
  ]);
  assertEnvelope(secretExecution.result, {
    ok: false, stage: 'preview-resource', code: 'CAPABILITY_PRIVATE_INPUT',
  });
  assert.equal(JSON.stringify(secretExecution.result).includes('must-not-leak'), false);
  assert.equal(requests, 0);
});

test('bulk-create requires a stable requestId and preserves replay evidence', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'bulk.json');
  const incompleteFile = path.join(directory, 'bulk-incomplete.json');
  writeJson(inputFile, { requestId: 'release-160-pages', items: [{ title: 'About' }] });
  writeJson(incompleteFile, {
    requestId: 'release-160-incomplete',
    items: [{ title: 'About' }, { title: 'Contact' }],
  });
  const received = [];
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') return sendJson(response, 200, capabilityContract());
    if (request.url === '/wp-json/monteby/v1/site/pages/bulk') {
      const body = await readBody(request);
      received.push(body);
      const payloadSha256 = canonicalSha256(body.items);
      if (body.requestId === 'release-160-incomplete') {
        return sendJson(response, 201, {
          replayed: false,
          created: [{ id: 81, title: 'About' }],
          count: 1,
          requestId: body.requestId,
          payloadSha256,
        });
      }
      return sendJson(response, 201, {
        replayed: false,
        created: [{ id: 81, title: 'About' }],
        count: 1,
        requestId: 'release-160-pages',
        payloadSha256,
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const execution = await runClient([
    'bulk-create', '--site', server.site, '--input', inputFile,
    '--out', path.join(directory, 'report.json'),
  ]);
  const incomplete = await runClient([
    'bulk-create', '--site', server.site, '--input', incompleteFile,
    '--out', path.join(directory, 'incomplete-report.json'),
  ]);

  assertEnvelope(execution.result, { ok: true, stage: 'bulk-create', code: 'BULK_CREATE_OK' });
  assert.deepEqual(received[0], { requestId: 'release-160-pages', items: [{ title: 'About' }] });
  assert.deepEqual(execution.result.evidence.ids, [81]);
  assert.equal(execution.result.evidence.payloadSha256, canonicalSha256([{ title: 'About' }]));
  assertEnvelope(incomplete.result, {
    ok: false, stage: 'bulk-create', code: 'CAPABILITY_WRITE_UNPROVEN',
  });
  assert.deepEqual(server.errors, []);
});

test('bulk-create fails closed without durable payload-bound replay semantics', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'bulk.json');
  writeJson(inputFile, { requestId: 'unsafe-descriptor', items: [{ title: 'About' }] });
  let writeRequests = 0;
  const server = await startServer(t, (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      const contract = capabilityContract();
      delete contract.layoutPersistence.resources.bulkCreate.replayMode;
      return sendJson(response, 200, contract);
    }
    writeRequests += 1;
    return sendJson(response, 500, { code: 'unexpected_write' });
  });

  const execution = await runClient([
    'bulk-create', '--site', server.site, '--input', inputFile,
    '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: false, stage: 'bulk-create', code: 'CAPABILITY_RESOURCE_INVALID',
  });
  assert.equal(writeRequests, 0);
  assert.deepEqual(server.errors, []);
});

test('composition commands use embedded recipes and their declared carriers', async (t) => {
  const directory = tempDir(t);
  const instantiateFile = path.join(directory, 'instantiate.json');
  const planFile = path.join(directory, 'plan.json');
  writeJson(instantiateFile, { recipeId: 'hero', slots: { title: 'Hello' }, parentId: 'ROOT' });
  writeJson(planFile, {
    plan: { version: 1, sections: [{ compositionId: 'hero', content: { title: 'Hello' } }] },
  });
  const bodies = [];
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') return sendJson(response, 200, capabilityContract());
    if (request.url === '/wp-json/monteby/v1/compositions/instantiate') {
      bodies.push(await readBody(request));
      const nodes = { 'hero-1': COMPOSITION_SECTION };
      return sendJson(response, 200, {
        valid: true,
        recipeId: 'hero',
        rootNodeId: 'hero-1',
        nodes,
        operation: {
          type: 'insert_tree',
          parentId: 'ROOT',
          tree: { rootNodeId: 'hero-1', nodes },
        },
        errors: [],
        lint: [],
        decisions: {
          idPrefix: 'hero',
          idStart: 1,
          nodeCount: 1,
          omittedOptional: [],
          levelOneHeadings: 0,
          placementVerified: false,
          anchorsVerified: false,
        },
      });
    }
    if (request.url === '/wp-json/monteby/v1/compositions/plan') {
      bodies.push(await readBody(request));
      return sendJson(response, 200, {
        valid: true,
        layout: { version: 1, nodeMap: COMPOSITION_PLAN_MAP },
        sections: [{ index: 0, compositionId: 'hero', rootNodeId: 'hero-1', nodeCount: 1 }],
        errors: [],
        lint: [],
        decisions: [{
          section: 0,
          compositionId: 'hero',
          rootNodeId: 'hero-1',
          idStart: 1,
          nodeCount: 1,
          omittedOptional: [],
        }],
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const list = await runClient([
    'compositions-list', '--site', server.site, '--out', path.join(directory, 'list.json'),
  ]);
  const instantiate = await runClient([
    'composition-instantiate', '--site', server.site, '--input', instantiateFile,
    '--out', path.join(directory, 'instantiate-report.json'),
  ]);
  const plan = await runClient([
    'composition-plan', '--site', server.site, '--input', planFile,
    '--out', path.join(directory, 'plan-report.json'),
  ]);

  assertEnvelope(list.result, { ok: true, stage: 'compositions-list', code: 'COMPOSITIONS_LIST_OK' });
  assert.equal(list.result.response.recipes[0].id, 'hero');
  assertEnvelope(instantiate.result, { ok: true, stage: 'composition-instantiate', code: 'COMPOSITION_INSTANTIATE_OK' });
  assertEnvelope(plan.result, { ok: true, stage: 'composition-plan', code: 'COMPOSITION_PLAN_OK' });
  assert.match(instantiate.result.evidence.inputSha256, /^[a-f0-9]{64}$/u);
  assert.match(instantiate.result.evidence.outputSha256, /^[a-f0-9]{64}$/u);
  assert.match(instantiate.result.evidence.nodeTreeSha256, /^[a-f0-9]{64}$/u);
  assert.match(plan.result.evidence.inputSha256, /^[a-f0-9]{64}$/u);
  assert.equal(plan.result.evidence.layoutSha256, nodeMapSha256(COMPOSITION_PLAN_MAP));
  assert.deepEqual(bodies, [
    { recipeId: 'hero', slots: { title: 'Hello' }, parentId: 'ROOT' },
    { plan: { version: 1, sections: [{ compositionId: 'hero', content: { title: 'Hello' } }] } },
  ]);
  assert.deepEqual(server.errors, []);
});

test('composition commands reject mismatched node operations and incomplete plan evidence', async (t) => {
  const directory = tempDir(t);
  const instantiateFile = path.join(directory, 'instantiate.json');
  const planFile = path.join(directory, 'plan.json');
  writeJson(instantiateFile, { recipeId: 'hero', slots: { title: 'Hello' }, parentId: 'ROOT' });
  writeJson(planFile, {
    plan: { version: 1, sections: [{ compositionId: 'hero', content: { title: 'Hello' } }] },
  });
  const server = await startServer(t, (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url === '/wp-json/monteby/v1/compositions/instantiate') {
      const nodes = { 'hero-1': COMPOSITION_SECTION };
      return sendJson(response, 200, {
        valid: true,
        recipeId: 'hero',
        rootNodeId: 'hero-1',
        nodes,
        operation: {
          type: 'insert_tree',
          parentId: 'another-parent',
          tree: { rootNodeId: 'hero-1', nodes },
        },
        errors: [],
        lint: [],
        decisions: {
          idPrefix: 'hero', idStart: 1, nodeCount: 1, omittedOptional: [],
          levelOneHeadings: 0, placementVerified: false, anchorsVerified: false,
        },
      });
    }
    if (request.url === '/wp-json/monteby/v1/compositions/plan') {
      return sendJson(response, 200, {
        valid: true,
        layout: { version: 1, nodeMap: COMPOSITION_PLAN_MAP },
        sections: [],
        errors: [],
        lint: [],
        decisions: [],
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const instantiate = await runClient([
    'composition-instantiate', '--site', server.site, '--input', instantiateFile,
    '--out', path.join(directory, 'instantiate-report.json'),
  ]);
  const plan = await runClient([
    'composition-plan', '--site', server.site, '--input', planFile,
    '--out', path.join(directory, 'plan-report.json'),
  ]);

  assertEnvelope(instantiate.result, {
    ok: false, stage: 'composition-instantiate', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assertEnvelope(plan.result, {
    ok: false, stage: 'composition-plan', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assert.deepEqual(server.errors, []);
});

test('global styles read, compose and patch stay on the safe projection and prove readback', async (t) => {
  const directory = tempDir(t);
  const composeFile = path.join(directory, 'compose.json');
  const patchFile = path.join(directory, 'patch.json');
  writeJson(composeFile, { profileId: 'editorial', overrides: { colors: { primary: '#445566' } } });
  writeJson(patchFile, { expectedRevision: 'b'.repeat(64), colors: { primary: '#445566' } });
  let revision = 'b'.repeat(64);
  let primary = '#112233';
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      const contract = capabilityContract();
      contract.globalStyles.revision = revision;
      contract.globalStyles.colors.primary = primary;
      return sendJson(response, 200, contract);
    }
    if (request.url === '/wp-json/monteby/v1/global-styles/compose') {
      return sendJson(response, 200, {
        profileId: 'editorial',
        styles: { colors: { primary: '#445566' }, typography: {} },
        revision,
        apply: {},
      });
    }
    if (request.method === 'PATCH' && request.url === '/wp-json/monteby/v1/global-styles') {
      const body = await readBody(request);
      assert.equal(body.expectedRevision, revision);
      primary = body.colors.primary;
      revision = 'c'.repeat(64);
      return sendJson(response, 200, {
        success: true,
        styles: { colors: { primary }, typography: {} },
        revision,
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const read = await runClient([
    'global-styles-get', '--site', server.site, '--out', path.join(directory, 'styles.json'),
  ]);
  const compose = await runClient([
    'global-styles-compose', '--site', server.site, '--input', composeFile,
    '--out', path.join(directory, 'compose-report.json'),
  ]);
  const patch = await runClient([
    'global-styles-patch', '--site', server.site, '--input', patchFile,
    '--out', path.join(directory, 'patch-report.json'),
  ]);

  assertEnvelope(read.result, { ok: true, stage: 'global-styles-get', code: 'GLOBAL_STYLES_GET_OK' });
  assert.equal(read.result.response.colors.primary, '#112233');
  assertEnvelope(compose.result, { ok: true, stage: 'global-styles-compose', code: 'GLOBAL_STYLES_COMPOSE_OK' });
  assert.equal(Object.hasOwn(compose.result.response.styles, 'customCSS'), false);
  assertEnvelope(patch.result, { ok: true, stage: 'global-styles-patch', code: 'GLOBAL_STYLES_PATCH_OK' });
  assert.equal(patch.result.evidence.revision, 'c'.repeat(64));
  assert.deepEqual(server.errors, []);
});

test('capability responses fail closed instead of masking private fields', async (t) => {
  const directory = tempDir(t);
  const composeFile = path.join(directory, 'compose.json');
  writeJson(composeFile, { profileId: 'editorial' });
  const server = await startServer(t, (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url === '/wp-json/monteby/v1/global-styles/compose') {
      return sendJson(response, 200, {
        profileId: 'editorial',
        styles: {
          colors: { primary: '#445566' },
          typography: {},
          integration: { clientSecret: 'must-not-be-reported' },
        },
        revision: 'b'.repeat(64),
        apply: {},
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const execution = await runClient([
    'global-styles-compose', '--site', server.site, '--input', composeFile,
    '--out', path.join(directory, 'compose-report.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: false,
    stage: 'global-styles-compose',
    code: 'CAPABILITY_PRIVACY_VIOLATION',
  });
  assert.equal(JSON.stringify(execution.result).includes('must-not-be-reported'), false);
  assert.match(execution.result.message, /\$\.integration\.clientSecret/u);
  assert.deepEqual(server.errors, []);
});

test('global styles require a revision advance for a genuine change', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'patch.json');
  const noOpFile = path.join(directory, 'noop.json');
  const revision = 'b'.repeat(64);
  writeJson(inputFile, { expectedRevision: revision, colors: { primary: '#445566' } });
  writeJson(noOpFile, { expectedRevision: revision, colors: { primary: '#112233' } });
  let primary = '#112233';
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      const contract = capabilityContract();
      contract.globalStyles.revision = revision;
      contract.globalStyles.colors.primary = primary;
      return sendJson(response, 200, contract);
    }
    if (request.method === 'PATCH' && request.url === '/wp-json/monteby/v1/global-styles') {
      const body = await readBody(request);
      primary = body.colors.primary;
      return sendJson(response, 200, { success: true, revision });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const noOp = await runClient([
    'global-styles-patch', '--site', server.site, '--input', noOpFile,
    '--out', path.join(directory, 'noop-report.json'),
  ]);
  const execution = await runClient([
    'global-styles-patch', '--site', server.site, '--input', inputFile,
    '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(noOp.result, {
    ok: true, stage: 'global-styles-patch', code: 'GLOBAL_STYLES_PATCH_OK',
  });
  assert.equal(noOp.result.evidence.noOp, true);
  assert.equal(noOp.result.evidence.revisionAdvanced, false);
  assertEnvelope(execution.result, {
    ok: false, stage: 'global-styles-patch', code: 'CAPABILITY_WRITE_UNPROVEN',
  });
  assert.equal(execution.result.nextAction.id, 'blocked_client_error');
  assert.deepEqual(server.errors, []);
});

test('mutating capability transport failures require read-only reconciliation', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'patch.json');
  const revision = 'b'.repeat(64);
  writeJson(inputFile, { expectedRevision: revision, colors: { primary: '#445566' } });
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      const contract = capabilityContract();
      contract.globalStyles.revision = revision;
      return sendJson(response, 200, contract);
    }
    if (request.method === 'PATCH' && request.url === '/wp-json/monteby/v1/global-styles') {
      await readBody(request);
      return sendJson(response, 500, { code: 'committed_but_response_failed' });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const execution = await runClient([
    'global-styles-patch', '--site', server.site, '--input', inputFile,
    '--out', path.join(directory, 'report.json'),
  ]);

  assertEnvelope(execution.result, {
    ok: false, stage: 'global-styles-patch', code: 'WRITE_OUTCOME_UNCERTAIN',
  });
  assert.equal(execution.result.retryable, false);
  assert.equal(execution.result.nextAction.id, 'reconcile_uncertain_write');
  assert.equal(execution.result.nextAction.tool, '');
  assert.deepEqual(execution.result.nextAction.args, []);
  assert.deepEqual(server.errors, []);
});

test('page SEO read and write use the dedicated resource and exact canonical readback', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'seo.json');
  const submittedSeo = { title: 'Updated title', description: 'Updated description' };
  let version = 'v1';
  let seo = { title: 'Original title', description: 'Original description' };
  const originalSeoSha256 = canonicalSha256(seo);
  writeJson(inputFile, {
    seo: submittedSeo,
    expectedModifiedGmt: 'v1',
    expectedSeoSha256: originalSeoSha256,
  });
  let writeBody;
  const server = await startServer(t, async (request, response) => {
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url === '/wp-json/monteby/v1/pages/17/seo' && request.method === 'GET') {
      return sendJson(response, 200, {
        id: 17,
        title: 'Page',
        postType: 'page',
        viewUrl: `${server.site}/page/`,
        postModifiedGmt: version,
        seoSha256: canonicalSha256(seo),
        seo,
        seoOwnership: {},
        seoGraph: {},
      });
    }
    if (request.url === '/wp-json/monteby/v1/pages/17/seo' && request.method === 'PUT') {
      writeBody = await readBody(request);
      seo = writeBody.seo;
      version = 'v2';
      return sendJson(response, 200, {
        id: 17,
        saved: true,
        seo,
        seoSha256: canonicalSha256(seo),
        postModifiedGmt: version,
      });
    }
    return sendJson(response, 404, { code: 'not_found' });
  });

  const read = await runClient([
    'seo-get', '--site', server.site, '--page-id', '17',
    '--out', path.join(directory, 'seo-before.json'),
  ]);
  const write = await runClient([
    'seo-put', '--site', server.site, '--page-id', '17', '--input', inputFile,
    '--out', path.join(directory, 'seo-save.json'),
  ]);

  assertEnvelope(read.result, { ok: true, stage: 'seo-get', code: 'SEO_GET_OK' });
  assert.deepEqual(read.result.response.seo, {
    title: 'Original title', description: 'Original description',
  });
  assertEnvelope(write.result, { ok: true, stage: 'seo-put', code: 'SEO_PUT_OK' });
  assert.deepEqual(writeBody, {
    seo: submittedSeo,
    expectedModifiedGmt: 'v1',
    expectedSeoSha256: originalSeoSha256,
  });
  assert.equal(write.result.evidence.versionToken, 'v2');
  assert.equal(write.result.evidence.previousSeoSha256, originalSeoSha256);
  assert.equal(write.result.evidence.seoSha256, canonicalSha256(submittedSeo));
  assert.equal(write.result.evidence.canonicalReadback, true);
  assert.deepEqual(server.errors, []);
});

test('Abilities discovery executes only schema-valid read-only abilities', async (t) => {
  const directory = tempDir(t);
  const inputFile = path.join(directory, 'ability-input.json');
  const invalidOutputInputFile = path.join(directory, 'ability-invalid-output.json');
  const privateOutputInputFile = path.join(directory, 'ability-private-output.json');
  const mutationInputFile = path.join(directory, 'mutation-input.json');
  writeJson(inputFile, { mode: 'light' });
  writeJson(invalidOutputInputFile, { mode: 'full' });
  writeJson(privateOutputInputFile, { mode: 'private' });
  writeJson(mutationInputFile, {});
  const abilities = [{
    name: 'monteby/get-contract',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { mode: { type: 'string', enum: ['light', 'full', 'private'] } },
    },
    output_schema: {
      type: 'object',
      required: ['version', 'product', 'productVersion', 'source', 'mode'],
      additionalProperties: true,
      properties: {
        version: { type: 'integer' },
        product: { type: 'string' },
        productVersion: { type: 'string' },
        source: { type: 'string' },
        mode: { type: 'string' },
      },
    },
    meta: {
      show_in_rest: true,
      annotations: { readonly: true, destructive: false, idempotent: true },
    },
  }, {
    name: 'monteby/save-layout',
    input_schema: { type: 'object', additionalProperties: false, properties: {} },
    output_schema: { type: 'object', additionalProperties: true, properties: {} },
    meta: {
      show_in_rest: true,
      annotations: { readonly: false, destructive: true, idempotent: false },
    },
  }];
  const requests = [];
  const server = await startServer(t, (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    if (request.url === '/wp-json/monteby/v1/contract') {
      return sendJson(response, 200, capabilityContract());
    }
    if (request.url.startsWith('/wp-json/wp-abilities/v1/abilities?')) {
      return sendJson(response, 200, abilities);
    }
    if (request.url.startsWith('/wp-json/wp-abilities/v1/abilities/monteby/get-contract/run?')) {
      if (request.url.includes('input%5Bmode%5D=full')) {
        return sendJson(response, 200, { mode: 'full' });
      }
      if (request.url.includes('input%5Bmode%5D=private')) {
        return sendJson(response, 200, {
          version: 1,
          product: 'Monteby Builder',
          productVersion: '1.6.0',
          source: 'live-site',
          mode: 'private',
          integration: { apiKey: 'must-not-be-reported' },
        });
      }
      return sendJson(response, 200, {
        version: 1,
        product: 'Monteby Builder',
        productVersion: '1.6.0',
        source: 'live-site',
        mode: 'light',
      });
    }
    return sendJson(response, 500, { code: 'unexpected_ability_request' });
  });

  const list = await runClient([
    'abilities-list', '--site', server.site, '--out', path.join(directory, 'abilities.json'),
  ]);
  const readOnly = await runClient([
    'ability-run', '--site', server.site, '--name', 'monteby/get-contract',
    '--input', inputFile, '--out', path.join(directory, 'ability-result.json'),
  ]);
  const mutation = await runClient([
    'ability-run', '--site', server.site, '--name', 'monteby/save-layout',
    '--input', mutationInputFile, '--out', path.join(directory, 'mutation-result.json'),
  ]);
  const invalidOutput = await runClient([
    'ability-run', '--site', server.site, '--name', 'monteby/get-contract',
    '--input', invalidOutputInputFile, '--out', path.join(directory, 'ability-invalid-result.json'),
  ]);
  const privateOutput = await runClient([
    'ability-run', '--site', server.site, '--name', 'monteby/get-contract',
    '--input', privateOutputInputFile, '--out', path.join(directory, 'ability-private-result.json'),
  ]);

  assertEnvelope(list.result, { ok: true, stage: 'abilities-list', code: 'ABILITIES_LIST_OK' });
  assert.deepEqual(list.result.evidence.names, ['monteby/get-contract', 'monteby/save-layout']);
  assertEnvelope(readOnly.result, { ok: true, stage: 'ability-run', code: 'ABILITY_RUN_OK' });
  assert.equal(readOnly.result.response.mode, 'light');
  assertEnvelope(mutation.result, {
    ok: false, stage: 'ability-run', code: 'CAPABILITY_MUTATION_REQUIRES_CANONICAL_CLIENT',
  });
  assertEnvelope(invalidOutput.result, {
    ok: false, stage: 'ability-run', code: 'CAPABILITY_RESPONSE_INVALID',
  });
  assertEnvelope(privateOutput.result, {
    ok: false, stage: 'ability-run', code: 'CAPABILITY_PRIVACY_VIOLATION',
  });
  assert.equal(JSON.stringify(privateOutput.result).includes('must-not-be-reported'), false);
  assert.equal(requests.some((entry) => entry.includes('monteby/save-layout/run')), false);
  assert.ok(requests.some((entry) => entry.includes('input%5Bmode%5D=light')));
  assert.deepEqual(server.errors, []);
});
