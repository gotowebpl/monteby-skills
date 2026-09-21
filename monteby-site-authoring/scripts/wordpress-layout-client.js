#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const compatibilityManifest = require('../references/site-contract-compatibility.json');
const { evaluateFeatureGate } = require('./contract-capabilities');

const SCHEMA_VERSION = 1;
const DEFAULT_AUTH_HEADER_ENV = 'MONTEBY_AUTH_HEADER';
const DEFAULT_TIMEOUT_MS = 30_000;
const API_ROOT = '/wp-json/monteby/v1';
const WP_JSON_ROOT = '/wp-json';
const CONTRACT_ENDPOINT = '/contract';
const REST_NAMESPACE = '/monteby/v1';
const CONTRACT_MODES = new Set(['full', 'light', 'design', 'authoring', 'catalogs']);
const COMPONENT_PROJECTIONS = new Set(['full', 'summary']);
const CAPABILITY_COMMANDS = new Set([
  'contract-fetch',
  'page-context',
  'documents-list',
  'revision-list',
  'revision-restore',
  'preview-resource',
  'bulk-create',
  'compositions-list',
  'composition-plan',
  'composition-instantiate',
  'global-styles-get',
  'global-styles-patch',
  'global-styles-compose',
  'design-profiles',
  'seo-get',
  'seo-put',
  'abilities-list',
  'ability-run',
]);
const WRITE_OUTCOME_RECONCILIATION = Object.freeze({
  save: 'Read the page layout and compare its exact candidate, layout and compiled HTML digests.',
  'patch-save': 'Read the page layout and compare its exact candidate, layout and compiled HTML digests.',
  'branding-save': 'Read the branding resource and compare its revision and bounded identity fields.',
  'revision-restore': 'Read the page layout and revision list before deciding whether another restore is needed.',
  'bulk-create': 'List documents and reconcile the exact requestId; do not create another batch.',
  'global-styles-patch': 'Fetch the full live contract and compare its safe global-style projection and revision.',
  'seo-put': 'Read the dedicated page SEO resource and compare the complete SEO profile and version token.',
});
const UNCERTAIN_TRANSPORT_CODES = new Set([
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'RESPONSE_READ_FAILED',
  'REST_SERVER_ERROR',
  'REST_RATE_LIMITED',
]);
const COMMANDS = new Set([
  'snapshot',
  'validate',
  'save',
  'preview',
  'patch-validate',
  'patch-save',
  'branding-snapshot',
  'branding-save',
  ...CAPABILITY_COMMANDS,
]);
const PRESENTATION_LAYOUTS = new Set(['default', 'full-width', 'canvas']);
const CLIENT_TOOL = path.resolve(__filename);
const CANONICAL_VERIFICATION_TOOL = path.join(__dirname, 'run-canonical-verification.js');

class ClientError extends Error {
  constructor(message, {
    code = 'CLIENT_ERROR',
    stage = 'cli',
    retryable = false,
    artifacts = {},
    nextAction = 'Inspect the error and run the command again after correcting it.',
    httpStatus,
    response,
  } = {}) {
    super(message);
    this.name = 'ClientError';
    this.code = code;
    this.stage = stage;
    this.retryable = retryable;
    this.artifacts = artifacts;
    this.nextAction = nextAction;
    this.httpStatus = httpStatus;
    this.response = response;
  }
}

function requiredValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new ClientError(`Missing value for ${option}.`, {
      code: 'CLI_USAGE',
      nextAction: 'Run the command with --help and provide every required option.',
    });
  }
  return value;
}

function parsePositiveInteger(value, option) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new ClientError(`${option} must be a positive integer.`, {
      code: 'CLI_USAGE',
      nextAction: `Provide a positive integer for ${option}.`,
    });
  }
  return Number(value);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return { help: true };
  }

  const command = argv[0];
  if (!COMMANDS.has(command)) {
    throw new ClientError('Unknown command.', {
      code: 'CLI_USAGE',
      nextAction: 'Run with --help and choose snapshot, validate, save, or preview.',
    });
  }

  const options = {
    command,
    site: '',
    pageId: null,
    layout: '',
    outDir: '',
    out: '',
    snapshot: '',
    presentationLayout: '',
    expectedLayoutSha256: '',
    saveReport: '',
    reportOut: '',
    operations: '',
    patchReport: '',
    expectedOperationsSha256: '',
    expectedCandidateLayoutSha256: '',
    expectedCompiledHtmlSha256: '',
    authHeaderEnv: DEFAULT_AUTH_HEADER_ENV,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    renderContextUrl: '',
    logoUrl: '',
    input: '',
    cache: '',
    mode: 'full',
    components: 'full',
    component: '',
    name: '',
  };
  const seen = new Set();

  for (let index = 1; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help' || option === '-h') {
      return { help: true };
    }
    if (!option.startsWith('--')) {
      throw new ClientError('Unexpected positional argument.', {
        code: 'CLI_USAGE',
        nextAction: 'Run the command with --help and remove the unexpected argument.',
      });
    }
    if (seen.has(option)) {
      throw new ClientError(`Option ${option} may only be provided once.`, {
        code: 'CLI_USAGE',
        nextAction: `Keep one ${option} value and run the command again.`,
      });
    }
    seen.add(option);

    if (option === '--site') {
      options.site = requiredValue(argv, index += 1, option);
    } else if (option === '--page-id') {
      options.pageId = parsePositiveInteger(requiredValue(argv, index += 1, option), option);
    } else if (option === '--layout') {
      options.layout = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--out-dir') {
      options.outDir = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--out') {
      options.out = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--snapshot') {
      options.snapshot = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--presentation-layout') {
      options.presentationLayout = requiredValue(argv, index += 1, option);
    } else if (option === '--expected-layout-sha256') {
      options.expectedLayoutSha256 = requiredValue(argv, index += 1, option).toLowerCase();
    } else if (option === '--save-report') {
      options.saveReport = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--report-out') {
      options.reportOut = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--operations') {
      options.operations = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--patch-report') {
      options.patchReport = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--expected-operations-sha256') {
      options.expectedOperationsSha256 = requiredValue(argv, index += 1, option).toLowerCase();
    } else if (option === '--expected-candidate-layout-sha256') {
      options.expectedCandidateLayoutSha256 = requiredValue(argv, index += 1, option).toLowerCase();
    } else if (option === '--expected-compiled-html-sha256') {
      options.expectedCompiledHtmlSha256 = requiredValue(argv, index += 1, option).toLowerCase();
    } else if (option === '--auth-header-env') {
      options.authHeaderEnv = requiredValue(argv, index += 1, option);
    } else if (option === '--timeout-ms') {
      options.timeoutMs = parsePositiveInteger(requiredValue(argv, index += 1, option), option);
    } else if (option === '--render-context-url') {
      options.renderContextUrl = requiredValue(argv, index += 1, option);
    } else if (option === '--logo-url') {
      options.logoUrl = requiredValue(argv, index += 1, option);
    } else if (option === '--input') {
      options.input = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--cache') {
      options.cache = path.resolve(requiredValue(argv, index += 1, option));
    } else if (option === '--mode') {
      options.mode = requiredValue(argv, index += 1, option);
    } else if (option === '--components') {
      options.components = requiredValue(argv, index += 1, option);
    } else if (option === '--component') {
      options.component = requiredValue(argv, index += 1, option);
    } else if (option === '--name') {
      options.name = requiredValue(argv, index += 1, option);
    } else {
      throw new ClientError(`Unknown option: ${option}.`, {
        code: 'CLI_USAGE',
        nextAction: 'Run the command with --help and use only documented options.',
      });
    }
  }

  validateOptions(options);
  return options;
}

function requireOption(options, key, option) {
  if (!options[key]) {
    throw new ClientError(`${option} is required for ${options.command}.`, {
      code: 'CLI_USAGE',
      stage: options.command,
      nextAction: `Provide ${option} and run ${options.command} again.`,
    });
  }
}

function rejectOption(options, key, option) {
  if (options[key]) {
    throw new ClientError(`${option} is not supported by ${options.command}.`, {
      code: 'CLI_USAGE',
      stage: options.command,
      nextAction: `Remove ${option} and run ${options.command} again.`,
    });
  }
}

function normalizeSite(rawSite, stage) {
  let parsed;
  try {
    parsed = new URL(rawSite);
  } catch {
    throw new ClientError('--site must be an absolute HTTP or HTTPS URL.', {
      code: 'CLI_USAGE',
      stage,
      nextAction: 'Provide the WordPress base URL without credentials, a query, or a fragment.',
    });
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new ClientError('--site must be an HTTP(S) base URL without embedded credentials, a query, or a fragment.', {
      code: 'CLI_USAGE',
      stage,
      nextAction: 'Move authorization to the configured environment variable and provide only the site base URL.',
    });
  }

  return parsed.toString().replace(/\/+$/, '');
}

function isValidLogoUrl(candidate) {
  if (
    typeof candidate !== 'string'
    || candidate.length > 2_048
    || /[\u0000-\u001F\u007F]/.test(candidate)
  ) return false;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }
  return ['http:', 'https:'].includes(parsed.protocol)
    && !parsed.username
    && !parsed.password;
}

function normalizeLogoUrl(rawUrl, stage) {
  const candidate = rawUrl.trim();
  if (!isValidLogoUrl(candidate)) {
    throw new ClientError('--logo-url must be an absolute HTTP or HTTPS URL.', {
      code: 'CLI_USAGE',
      stage,
      nextAction: 'Use the public URL returned for the approved WordPress media item.',
    });
  }
  return candidate;
}

function validateOptions(options) {
  requireOption(options, 'site', '--site');
  options.site = normalizeSite(options.site, options.command);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.authHeaderEnv)) {
    throw new ClientError('--auth-header-env must name an environment variable.', {
      code: 'CLI_USAGE',
      stage: options.command,
      nextAction: 'Provide an environment variable name, not an authorization secret.',
    });
  }
  if (
    options.expectedLayoutSha256
    && !/^[a-f0-9]{64}$/.test(options.expectedLayoutSha256)
  ) {
    throw new ClientError('--expected-layout-sha256 must be a 64-character SHA-256 digest.', {
      code: 'CLI_USAGE',
      stage: options.command,
      nextAction: 'Provide the layoutSha256 emitted by a successful validate report.',
    });
  }
  for (const [key, option] of [
    ['expectedOperationsSha256', '--expected-operations-sha256'],
    ['expectedCandidateLayoutSha256', '--expected-candidate-layout-sha256'],
    ['expectedCompiledHtmlSha256', '--expected-compiled-html-sha256'],
  ]) {
    if (options[key] && !/^[a-f0-9]{64}$/.test(options[key])) {
      throw new ClientError(`${option} must be a 64-character SHA-256 digest.`, {
        code: 'CLI_USAGE',
        stage: options.command,
        nextAction: `Use the digest emitted by patch-validate for ${option}.`,
      });
    }
  }
  if (options.presentationLayout && !PRESENTATION_LAYOUTS.has(options.presentationLayout)) {
    throw new ClientError('--presentation-layout must be default, full-width, or canvas.', {
      code: 'CLI_USAGE',
      stage: options.command,
      nextAction: 'Use one presentation layout exposed by the Monteby persistence contract.',
    });
  }
  if (options.renderContextUrl) {
    const normalized = normalizePublicPageUrl(options.renderContextUrl, options.site);
    if (!normalized) {
      throw new ClientError('--render-context-url must be a same-origin HTTP(S) URL without credentials.', {
        code: 'CLI_USAGE',
        stage: options.command,
        nextAction: 'Provide a public page on the same WordPress origin that renders the edited global template.',
      });
    }
    options.renderContextUrl = normalized;
  }
  if (options.logoUrl) {
    options.logoUrl = normalizeLogoUrl(options.logoUrl, options.command);
  }
  if (CAPABILITY_COMMANDS.has(options.command)) {
    validateCapabilityOptions(options);
    return;
  }
  for (const [key, option] of [
    ['input', '--input'],
    ['cache', '--cache'],
    ['component', '--component'],
    ['name', '--name'],
  ]) {
    rejectOption(options, key, option);
  }
  if (options.mode !== 'full') rejectOption(options, 'mode', '--mode');
  if (options.components !== 'full') rejectOption(options, 'components', '--components');
  if (options.command !== 'snapshot') {
    rejectOption(options, 'renderContextUrl', '--render-context-url');
  }
  if (options.command !== 'branding-save') {
    rejectOption(options, 'logoUrl', '--logo-url');
  }
  if (options.command !== 'patch-save') {
    rejectOption(options, 'expectedCompiledHtmlSha256', '--expected-compiled-html-sha256');
  }

  if (options.command === 'snapshot') {
    requireOption(options, 'pageId', '--page-id');
    requireOption(options, 'outDir', '--out-dir');
    rejectOption(options, 'layout', '--layout');
    rejectOption(options, 'snapshot', '--snapshot');
    rejectOption(options, 'presentationLayout', '--presentation-layout');
    rejectOption(options, 'expectedLayoutSha256', '--expected-layout-sha256');
    rejectOption(options, 'saveReport', '--save-report');
    rejectOption(options, 'reportOut', '--report-out');
  } else if (options.command === 'validate') {
    requireOption(options, 'layout', '--layout');
    rejectOption(options, 'outDir', '--out-dir');
    rejectOption(options, 'snapshot', '--snapshot');
    rejectOption(options, 'presentationLayout', '--presentation-layout');
    rejectOption(options, 'expectedLayoutSha256', '--expected-layout-sha256');
    rejectOption(options, 'saveReport', '--save-report');
    rejectOption(options, 'reportOut', '--report-out');
  } else if (options.command === 'save') {
    requireOption(options, 'pageId', '--page-id');
    requireOption(options, 'layout', '--layout');
    requireOption(options, 'expectedLayoutSha256', '--expected-layout-sha256');
    requireOption(options, 'out', '--out');
    if (!options.snapshot && !options.outDir) {
      throw new ClientError('save requires --snapshot or --out-dir.', {
        code: 'CLI_USAGE',
        stage: options.command,
        nextAction: 'Provide --snapshot, or provide --out-dir to use its layout-before.json snapshot.',
      });
    }
    rejectOption(options, 'saveReport', '--save-report');
    rejectOption(options, 'reportOut', '--report-out');
  } else if (options.command === 'preview') {
    requireOption(options, 'layout', '--layout');
    requireOption(options, 'out', '--out');
    requireOption(options, 'saveReport', '--save-report');
    requireOption(options, 'reportOut', '--report-out');
    rejectOption(options, 'pageId', '--page-id');
    rejectOption(options, 'outDir', '--out-dir');
    rejectOption(options, 'snapshot', '--snapshot');
    rejectOption(options, 'presentationLayout', '--presentation-layout');
    rejectOption(options, 'expectedLayoutSha256', '--expected-layout-sha256');
  } else if (options.command === 'patch-validate') {
    requireOption(options, 'pageId', '--page-id');
    requireOption(options, 'operations', '--operations');
    requireOption(options, 'out', '--out');
    if (!options.snapshot && !options.outDir) {
      throw new ClientError('patch-validate requires --snapshot or --out-dir.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Provide the page-scoped snapshot created immediately before the patch.',
      });
    }
    rejectOption(options, 'layout', '--layout');
    rejectOption(options, 'patchReport', '--patch-report');
    rejectOption(options, 'expectedOperationsSha256', '--expected-operations-sha256');
    rejectOption(options, 'expectedCandidateLayoutSha256', '--expected-candidate-layout-sha256');
  } else if (options.command === 'patch-save') {
    requireOption(options, 'pageId', '--page-id');
    requireOption(options, 'operations', '--operations');
    requireOption(options, 'patchReport', '--patch-report');
    requireOption(options, 'expectedOperationsSha256', '--expected-operations-sha256');
    requireOption(options, 'expectedCandidateLayoutSha256', '--expected-candidate-layout-sha256');
    requireOption(options, 'expectedCompiledHtmlSha256', '--expected-compiled-html-sha256');
    requireOption(options, 'out', '--out');
    if (!options.snapshot && !options.outDir) {
      throw new ClientError('patch-save requires --snapshot or --out-dir.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Provide the same page-scoped snapshot used by patch-validate.',
      });
    }
    rejectOption(options, 'layout', '--layout');
  } else if (options.command === 'branding-snapshot') {
    requireOption(options, 'outDir', '--out-dir');
    rejectOption(options, 'pageId', '--page-id');
    rejectOption(options, 'layout', '--layout');
    rejectOption(options, 'snapshot', '--snapshot');
    rejectOption(options, 'presentationLayout', '--presentation-layout');
    rejectOption(options, 'expectedLayoutSha256', '--expected-layout-sha256');
    rejectOption(options, 'saveReport', '--save-report');
    rejectOption(options, 'reportOut', '--report-out');
    rejectOption(options, 'operations', '--operations');
    rejectOption(options, 'patchReport', '--patch-report');
    rejectOption(options, 'expectedOperationsSha256', '--expected-operations-sha256');
    rejectOption(options, 'expectedCandidateLayoutSha256', '--expected-candidate-layout-sha256');
  } else if (options.command === 'branding-save') {
    requireOption(options, 'logoUrl', '--logo-url');
    requireOption(options, 'out', '--out');
    if (!options.snapshot && !options.outDir) {
      throw new ClientError('branding-save requires --snapshot or --out-dir.', {
        code: 'CLI_USAGE',
        stage: options.command,
        nextAction: 'Provide the branding snapshot created immediately before this save.',
      });
    }
    rejectOption(options, 'pageId', '--page-id');
    rejectOption(options, 'layout', '--layout');
    rejectOption(options, 'presentationLayout', '--presentation-layout');
    rejectOption(options, 'expectedLayoutSha256', '--expected-layout-sha256');
    rejectOption(options, 'saveReport', '--save-report');
    rejectOption(options, 'reportOut', '--report-out');
    rejectOption(options, 'operations', '--operations');
    rejectOption(options, 'patchReport', '--patch-report');
    rejectOption(options, 'expectedOperationsSha256', '--expected-operations-sha256');
    rejectOption(options, 'expectedCandidateLayoutSha256', '--expected-candidate-layout-sha256');
  }
}

function validateCapabilityOptions(options) {
  requireOption(options, 'out', '--out');
  for (const [key, option] of [
    ['layout', '--layout'],
    ['outDir', '--out-dir'],
    ['snapshot', '--snapshot'],
    ['presentationLayout', '--presentation-layout'],
    ['expectedLayoutSha256', '--expected-layout-sha256'],
    ['saveReport', '--save-report'],
    ['reportOut', '--report-out'],
    ['operations', '--operations'],
    ['patchReport', '--patch-report'],
    ['expectedOperationsSha256', '--expected-operations-sha256'],
    ['expectedCandidateLayoutSha256', '--expected-candidate-layout-sha256'],
    ['expectedCompiledHtmlSha256', '--expected-compiled-html-sha256'],
    ['renderContextUrl', '--render-context-url'],
    ['logoUrl', '--logo-url'],
  ]) {
    rejectOption(options, key, option);
  }

  const inputCommands = new Set([
    'documents-list', 'revision-restore', 'preview-resource', 'bulk-create',
    'composition-plan', 'composition-instantiate', 'global-styles-patch',
    'global-styles-compose', 'seo-put', 'ability-run',
  ]);
  if (inputCommands.has(options.command)) requireOption(options, 'input', '--input');
  else if (options.command !== 'revision-list') rejectOption(options, 'input', '--input');

  const pageCommands = new Set([
    'page-context', 'revision-list', 'revision-restore', 'seo-get', 'seo-put',
  ]);
  if (pageCommands.has(options.command)) requireOption(options, 'pageId', '--page-id');
  else rejectOption(options, 'pageId', '--page-id');

  if (options.command === 'contract-fetch') {
    if (!CONTRACT_MODES.has(options.mode)) {
      throw new ClientError('--mode must be full, light, design, authoring, or catalogs.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Choose a Site Contract projection published by Builder.',
      });
    }
    if (!COMPONENT_PROJECTIONS.has(options.components)) {
      throw new ClientError('--components must be full or summary.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Choose a component projection published by Builder.',
      });
    }
    if (!options.component && options.components === 'summary' && options.mode !== 'authoring') {
      throw new ClientError('--components summary is available only for --mode authoring.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Use --mode authoring with --components summary, or request a full component projection.',
      });
    }
    if (options.component && !/^[A-Za-z0-9_-]{1,128}$/u.test(options.component)) {
      throw new ClientError('--component must be a published component name.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Use a component name from the authoring summary projection.',
      });
    }
  } else {
    if (options.mode !== 'full') rejectOption(options, 'mode', '--mode');
    if (options.components !== 'full') rejectOption(options, 'components', '--components');
    rejectOption(options, 'component', '--component');
    rejectOption(options, 'cache', '--cache');
  }

  if (options.command === 'ability-run') {
    if (!/^monteby\/[a-z][a-z0-9-]{0,63}$/u.test(options.name)) {
      throw new ClientError('--name must be a published monteby/* ability.', {
        code: 'CLI_USAGE', stage: options.command,
        nextAction: 'Use an exact name returned by abilities-list.',
      });
    }
  } else {
    rejectOption(options, 'name', '--name');
  }
}

function printHelp() {
  process.stdout.write(`Usage:
  wordpress-layout-client.js snapshot --site URL --page-id ID --out-dir DIR [--render-context-url URL] [--out REPORT.json]
  wordpress-layout-client.js validate --site URL --layout LAYOUT.json [--page-id ID] [--out REPORT.json]
  wordpress-layout-client.js save --site URL --page-id ID --layout LAYOUT.json (--out-dir DIR | --snapshot FILE) --expected-layout-sha256 SHA256 --out SAVE-REPORT.json [--presentation-layout NAME]
  wordpress-layout-client.js preview --site URL --layout LAYOUT.json --save-report SAVE-REPORT.json --out PREVIEW.html --report-out PREVIEW-REPORT.json
  wordpress-layout-client.js patch-validate --site URL --page-id ID --operations OPERATIONS.json (--out-dir DIR | --snapshot FILE) --out PATCH-VALIDATE-REPORT.json
  wordpress-layout-client.js patch-save --site URL --page-id ID --operations OPERATIONS.json (--out-dir DIR | --snapshot FILE) --patch-report PATCH-VALIDATE-REPORT.json --expected-operations-sha256 SHA256 --expected-candidate-layout-sha256 SHA256 --expected-compiled-html-sha256 SHA256 --out PATCH-SAVE-REPORT.json
  wordpress-layout-client.js branding-snapshot --site URL --out-dir DIR [--out REPORT.json]
  wordpress-layout-client.js branding-save --site URL --logo-url URL (--out-dir DIR | --snapshot FILE) --out SAVE-REPORT.json
  wordpress-layout-client.js contract-fetch --site URL --out REPORT.json [--mode MODE] [--components full|summary] [--component NAME] [--cache CACHE.json]
  wordpress-layout-client.js page-context --site URL --page-id ID --out REPORT.json
  wordpress-layout-client.js documents-list --site URL --input QUERY.json --out REPORT.json
  wordpress-layout-client.js revision-list --site URL --page-id ID [--input QUERY.json] --out REPORT.json
  wordpress-layout-client.js revision-restore --site URL --page-id ID --input RESTORE.json --out REPORT.json
  wordpress-layout-client.js preview-resource --site URL --input PREVIEW.json --out REPORT.json
  wordpress-layout-client.js bulk-create --site URL --input BATCH.json --out REPORT.json
  wordpress-layout-client.js compositions-list --site URL --out REPORT.json
  wordpress-layout-client.js composition-plan --site URL --input PLAN.json --out REPORT.json
  wordpress-layout-client.js composition-instantiate --site URL --input COMPOSITION.json --out REPORT.json
  wordpress-layout-client.js global-styles-get --site URL --out REPORT.json
  wordpress-layout-client.js global-styles-patch --site URL --input PATCH.json --out REPORT.json
  wordpress-layout-client.js global-styles-compose --site URL --input PROFILE.json --out REPORT.json
  wordpress-layout-client.js design-profiles --site URL --out REPORT.json
  wordpress-layout-client.js seo-get --site URL --page-id ID --out REPORT.json
  wordpress-layout-client.js seo-put --site URL --page-id ID --input SEO.json --out REPORT.json
  wordpress-layout-client.js abilities-list --site URL --out REPORT.json
  wordpress-layout-client.js ability-run --site URL --name monteby/NAME --input INPUT.json --out REPORT.json

Common options:
  --auth-header-env NAME  Environment variable containing the complete Authorization header.
                          Defaults to MONTEBY_AUTH_HEADER. The header value is never accepted
                          as a CLI argument and is never written to reports.
  --timeout-ms NUMBER     Per-request timeout in milliseconds (default: 30000).

save reads DIR/layout-before.json when --snapshot is omitted. It never retries a
409 conflict or 428 precondition response automatically. validate emits the
layoutSha256 required by save; preview requires the persisted scoped SAVE_OK
report and writes a separate PREVIEW_OK report for canonical verification.
patch-validate and patch-save discover their endpoints and operation schemas only
from the live contract. patch-save binds the same snapshot, operations digest,
candidate digest, compiled-output digest, and descriptor-named version and layout
preconditions. Neither command retries 409/428.
branding-snapshot and branding-save discover the sole branding resource from the
full live contract. branding-save writes only logoUrl with the snapshot revision;
it never calls WordPress settings, theme mods, post meta, or layout-local props.
Every 1.6 resource command resolves its route, carrier, query fields and
precondition names from the live Site Contract. JSON inputs are capability-specific,
reject operational secrets and Custom CSS/JS, and are never echoed with authorization.
contract-fetch supports conditional ETag caching and component hydration.
`);
}

function nextAction(id, tool, args, requires, instruction) {
  return {
    id,
    tool,
    args,
    requires,
    instruction,
  };
}

function nextActionEnvelope(value) {
  if (
    isObject(value)
    && typeof value.id === 'string'
    && typeof value.tool === 'string'
    && Array.isArray(value.args)
    && Array.isArray(value.requires)
    && typeof value.instruction === 'string'
  ) {
    return value;
  }
  return nextAction(
    'resolve_next_action',
    CLIENT_TOOL,
    ['--help'],
    [],
    typeof value === 'string'
      ? value
      : 'Inspect the result and read the client help before executing another command.'
  );
}

function withCommonArgs(args, options) {
  return args.concat([
    '--auth-header-env', options.authHeaderEnv,
    '--timeout-ms', String(options.timeoutMs),
  ]);
}

function commandArgs(options) {
  if (!options?.command) return ['--help'];
  const args = [options.command, '--site', options.site];
  if (options.pageId) args.push('--page-id', String(options.pageId));
  if (options.layout) args.push('--layout', options.layout);
  if (options.outDir) args.push('--out-dir', options.outDir);
  if (options.snapshot) args.push('--snapshot', options.snapshot);
  if (options.presentationLayout) {
    args.push('--presentation-layout', options.presentationLayout);
  }
  if (options.expectedLayoutSha256) {
    args.push('--expected-layout-sha256', options.expectedLayoutSha256);
  }
  if (options.saveReport) args.push('--save-report', options.saveReport);
  if (options.operations) args.push('--operations', options.operations);
  if (options.patchReport) args.push('--patch-report', options.patchReport);
  if (options.expectedOperationsSha256) {
    args.push('--expected-operations-sha256', options.expectedOperationsSha256);
  }
  if (options.expectedCandidateLayoutSha256) {
    args.push('--expected-candidate-layout-sha256', options.expectedCandidateLayoutSha256);
  }
  if (options.expectedCompiledHtmlSha256) {
    args.push('--expected-compiled-html-sha256', options.expectedCompiledHtmlSha256);
  }
  if (options.out) args.push('--out', options.out);
  if (options.reportOut) args.push('--report-out', options.reportOut);
  if (options.renderContextUrl) args.push('--render-context-url', options.renderContextUrl);
  if (options.logoUrl) args.push('--logo-url', options.logoUrl);
  if (options.input) args.push('--input', options.input);
  if (options.cache) args.push('--cache', options.cache);
  if (options.mode && options.mode !== 'full') args.push('--mode', options.mode);
  if (options.components && options.components !== 'full') {
    args.push('--components', options.components);
  }
  if (options.component) args.push('--component', options.component);
  if (options.name) args.push('--name', options.name);
  return withCommonArgs(args, options);
}

function validationArgs(options, layout = options.layout) {
  const args = [
    'validate',
    '--site', options.site,
    '--layout', layout,
  ];
  if (options.pageId) args.push('--page-id', String(options.pageId));
  const reportDirectory = options.outDir
    || path.dirname(options.out || layout.replace(/\$[A-Z0-9_]+/g, 'layout.json'));
  args.push('--out', path.join(reportDirectory, 'validate-response.json'));
  return withCommonArgs(args, options);
}

function snapshotArgs(options) {
  const outDir = options.outDir
    || path.dirname(options.snapshot || options.layout || options.out || process.cwd());
  return withCommonArgs([
    'snapshot',
    '--site', options.site,
    '--page-id', String(options.pageId),
    '--out-dir', outDir,
    ...(options.renderContextUrl ? ['--render-context-url', options.renderContextUrl] : []),
  ], options);
}

function brandingSnapshotArgs(options, outDir) {
  const targetDirectory = outDir
    || options.outDir
    || path.dirname(options.snapshot || options.out || process.cwd());
  return withCommonArgs([
    'branding-snapshot',
    '--site', options.site,
    '--out-dir', targetDirectory,
  ], options);
}

function patchValidateArgs(options) {
  const reportDirectory = path.dirname(options.out || options.operations);
  return withCommonArgs([
    'patch-validate',
    '--site', options.site,
    '--page-id', String(options.pageId),
    '--operations', options.operations,
    '--snapshot', options.snapshot || path.join(options.outDir, 'layout-before.json'),
    '--out', path.join(reportDirectory, 'patch-validate-response.json'),
  ], options);
}

function instructionFrom(report) {
  if (typeof report.nextAction === 'string') return report.nextAction;
  if (report.nextAction && typeof report.nextAction.instruction === 'string') {
    return report.nextAction.instruction;
  }
  return 'Inspect the report before executing the next action.';
}

function materializeNextAction(report, options) {
  const instruction = instructionFrom(report);
  const authRequirement = options?.authHeaderEnv || DEFAULT_AUTH_HEADER_ENV;
  if (!options?.command) {
    return nextAction(
      'blocked_client_usage',
      '',
      [],
      ['VALID_CLIENT_ARGUMENTS'],
      `${instruction} Stop; help output is not a state-machine report.`
    );
  }

  if (report.code === 'SNAPSHOT_OK') {
    return nextAction(
      'validate_candidate',
      CLIENT_TOOL,
      validationArgs(options, '$MONTEBY_LAYOUT_PATH'),
      ['MONTEBY_LAYOUT_PATH', authRequirement],
      'Provide the candidate layout path, then validate that exact node map against the live site.'
    );
  }

  if (report.code === 'BRANDING_SNAPSHOT_OK') {
    const reportDirectory = path.dirname(report.artifacts.snapshot);
    return nextAction(
      'save_approved_site_branding',
      CLIENT_TOOL,
      withCommonArgs([
        'branding-save',
        '--site', options.site,
        '--logo-url', '$MONTEBY_LOGO_URL',
        '--snapshot', report.artifacts.snapshot,
        '--out', path.join(reportDirectory, 'branding-save-response.json'),
      ], options),
      ['MONTEBY_LOGO_URL', authRequirement],
      'After explicit logo approval, write that public URL once through the discovered Monteby Branding resource.'
    );
  }

  if (report.code === 'BRANDING_SAVE_OK') {
    return nextAction(
      'verify_saved_site_branding',
      CLIENT_TOOL,
      brandingSnapshotArgs(options, path.join(path.dirname(options.out), 'branding-after')),
      [authRequirement, 'CANONICAL_SITE_BRANDING_REVIEW'],
      'Take a fresh branding snapshot and verify the SiteBranding output on the canonical public page.'
    );
  }

  if (
    options.command === 'branding-save'
    && (
      report.code === 'BRANDING_SNAPSHOT_INVALID'
      || report.code === 'BRANDING_SNAPSHOT_SCOPE_MISMATCH'
      || report.code === 'BRANDING_SNAPSHOT_STALE'
      || report.code === 'REST_CONFLICT'
      || report.code === 'REST_PRECONDITION_REQUIRED'
    )
  ) {
    return nextAction(
      'resnapshot_and_reconcile_site_branding',
      CLIENT_TOOL,
      brandingSnapshotArgs(options),
      [authRequirement, 'MANUAL_BRANDING_RECONCILIATION'],
      'Take a fresh branding snapshot, review the newer site identity, then issue one explicit save. Do not retry automatically.'
    );
  }

  if (report.code === 'VALIDATION_OK') {
    const reportDirectory = path.dirname(options.out || options.layout);
    return nextAction(
      'save_validated_candidate',
      CLIENT_TOOL,
      withCommonArgs([
        'save',
        '--site', options.site,
        '--page-id', '$MONTEBY_PAGE_ID',
        '--layout', options.layout,
        '--snapshot', '$MONTEBY_LAYOUT_SNAPSHOT',
        '--expected-layout-sha256', report.layoutSha256 || report.artifacts?.layoutSha256,
        '--out', path.join(reportDirectory, 'save-response.json'),
      ], options),
      ['MONTEBY_PAGE_ID', 'MONTEBY_LAYOUT_SNAPSHOT', authRequirement],
      'Provide the page ID and the matching pre-edit snapshot, then save this validated candidate once.'
    );
  }

  if (report.code === 'PATCH_VALIDATION_OK') {
    return nextAction(
      'save_validated_patch',
      CLIENT_TOOL,
      withCommonArgs([
        'patch-save',
        '--site', options.site,
        '--page-id', String(options.pageId),
        '--operations', options.operations,
        '--snapshot', options.snapshot || path.join(options.outDir, 'layout-before.json'),
        '--patch-report', options.out,
        '--expected-operations-sha256', report.evidence.operationsSha256,
        '--expected-candidate-layout-sha256', report.evidence.candidateLayoutSha256,
        '--expected-compiled-html-sha256', report.evidence.compiledHtmlSha256,
        '--out', path.join(path.dirname(options.out), 'patch-save-response.json'),
      ], options),
      [authRequirement],
      'Apply this exact preflighted operation batch once. Do not edit the operations file or reuse the report for another snapshot.'
    );
  }

  if (report.code === 'PATCH_SAVE_OK') {
    return nextAction(
      'verify_saved_patch',
      CLIENT_TOOL,
      snapshotArgs({ ...options, outDir: path.join(path.dirname(options.snapshot || options.out), 'saved-patch') }),
      [authRequirement, 'CANONICAL_PAGE_REVIEW'],
      'Snapshot the saved page and verify the affected node in canonical WordPress/PHP output.'
    );
  }

  if (report.code === 'SAVE_OK') {
    const preview = path.join(path.dirname(options.layout), 'preview.html');
    const previewReport = path.join(path.dirname(options.out), 'preview-response.json');
    return nextAction(
      'preview_saved_candidate',
      CLIENT_TOOL,
      withCommonArgs([
        'preview',
        '--site', options.site,
        '--layout', options.layout,
        '--save-report', options.out,
        '--out', preview,
        '--report-out', previewReport,
      ], options),
      [authRequirement],
      'Render the saved candidate through the canonical WordPress/PHP preview endpoint.'
    );
  }

  if (report.code === 'PREVIEW_OK') {
    return nextAction(
      'verify_canonical_page',
      CANONICAL_VERIFICATION_TOOL,
      [
        '--iteration-report', '$MONTEBY_ITERATION_REPORT',
        '--preview-report', options.reportOut,
        '--public-page-url', report.evidence.publicPageUrl,
        '--out-dir', path.join(path.dirname(options.out), 'canonical'),
        '--json',
      ],
      [
        'MONTEBY_ITERATION_REPORT',
        'PUBLIC_PAGE_URL_CONFIRMED',
      ],
      'Capture and compare the canonical public page at all required full-page viewports.'
    );
  }

  if (
    (options.command === 'save' || options.command === 'patch-save')
    && (
      report.code === 'SNAPSHOT_SCOPE_INVALID'
      || report.code === 'SNAPSHOT_SCOPE_MISMATCH'
    )
  ) {
    return nextAction(
      'snapshot_requested_page',
      CLIENT_TOOL,
      snapshotArgs(options),
      [authRequirement],
      'Discard the unrelated or unscoped snapshot and snapshot this exact site/page before validation or save.'
    );
  }

  if (
    (options.command === 'save' || options.command === 'patch-save')
    && (
      report.code === 'REST_CONFLICT'
      || report.code === 'REST_PRECONDITION_REQUIRED'
      || report.code === 'SNAPSHOT_VERSION_MISSING'
      || report.code === 'REST_VERSION_MISSING'
    )
  ) {
    return nextAction(
      'resnapshot_and_reconcile',
      CLIENT_TOOL,
      snapshotArgs(options),
      [authRequirement, 'MANUAL_LAYOUT_RECONCILIATION'],
      'Take a new snapshot, reconcile the newer remote layout manually, then preflight again before one explicit save attempt. Do not retry automatically.'
    );
  }

  if (
    report.code === 'VALIDATION_FAILED'
    || report.code === 'PATCH_VALIDATION_FAILED'
    || report.code === 'OPERATIONS_SHA256_MISMATCH'
    || report.code === 'CANDIDATE_LAYOUT_SHA256_MISMATCH'
    || report.code === 'PATCH_REPORT_INVALID'
    || report.code === 'PATCH_REPORT_SCOPE_MISMATCH'
    || report.code === 'INVALID_LAYOUT_INPUT'
    || report.code === 'LAYOUT_SHA256_MISMATCH'
    || report.code === 'SAVE_REPORT_INVALID'
    || report.code === 'SAVE_REPORT_SCOPE_MISMATCH'
  ) {
    if (options.command.startsWith('patch-')) {
      return nextAction(
        'restart_patch_preflight',
        CLIENT_TOOL,
        patchValidateArgs(options),
        ['PATCH_RECONCILED', authRequirement],
        'Repair or reconcile the operation batch, then preflight the exact batch again. Never reuse stale patch evidence.'
      );
    }
    const requiresRepair = report.code === 'VALIDATION_FAILED' || report.code === 'INVALID_LAYOUT_INPUT';
    return nextAction(
      'restart_validation_chain',
      CLIENT_TOOL,
      validationArgs(options),
      [requiresRepair ? 'LAYOUT_REPAIRED' : 'CHAIN_RESTART_CONFIRMED', authRequirement],
      'Resolve the reported evidence or node-map mismatch, then validate this exact layout and repeat save before preview.'
    );
  }

  if (report.code === 'CLI_USAGE') {
    return nextAction(
      'blocked_client_usage',
      '',
      [],
      ['VALID_CLIENT_ARGUMENTS'],
      `${instruction} Stop; help output is not a state-machine report.`
    );
  }

  if (report.code === 'WRITE_OUTCOME_UNCERTAIN') {
    return nextAction(
      'reconcile_uncertain_write',
      '',
      [],
      ['READ_ONLY_CANONICAL_RECONCILIATION'],
      WRITE_OUTCOME_RECONCILIATION[options.command]
        || 'Read the canonical resource and reconcile the uncertain write outcome. Never repeat the mutation automatically.'
    );
  }

  if (CAPABILITY_COMMANDS.has(options.command) && report.ok) {
    return nextAction(
      'capability_complete',
      '',
      [],
      [],
      instruction
    );
  }

  if (report.code === 'AUTH_HEADER_ENV_MISSING' || report.code === 'AUTH_HEADER_INVALID') {
    return nextAction(
      'set_authorization_and_retry',
      CLIENT_TOOL,
      commandArgs(options),
      [authRequirement],
      `${instruction} Authorization must remain in the named environment variable.`
    );
  }

  if (
    report.code === 'INPUT_NOT_FOUND'
    || report.code === 'INPUT_READ_FAILED'
    || report.code === 'INVALID_JSON_INPUT'
  ) {
    const missing = report.artifacts?.layout
      ? 'LAYOUT_FILE'
      : report.artifacts?.snapshot
        ? 'SNAPSHOT_FILE'
        : 'INPUT_FILE';
    return nextAction(
      'restore_input_and_retry',
      CLIENT_TOOL,
      commandArgs(options),
      [missing, authRequirement],
      instruction
    );
  }

  if (report.code === 'ARTIFACT_WRITE_FAILED') {
    return nextAction(
      'repair_output_and_retry',
      CLIENT_TOOL,
      commandArgs(options),
      ['WRITABLE_OUTPUT_PATH', authRequirement],
      instruction
    );
  }

  if (report.code === 'REST_FORBIDDEN') {
    return nextAction(
      'grant_access_and_retry',
      CLIENT_TOOL,
      commandArgs(options),
      ['WORDPRESS_MONTEBY_ACCESS', authRequirement],
      instruction
    );
  }

  if (
    report.code === 'NETWORK_ERROR'
    || report.code === 'REQUEST_TIMEOUT'
    || report.code === 'RESPONSE_READ_FAILED'
    || report.code === 'REST_SERVER_ERROR'
    || report.code === 'REST_RATE_LIMITED'
  ) {
    return nextAction(
      'retry_command_explicitly',
      CLIENT_TOOL,
      commandArgs(options),
      ['SITE_HEALTH_CONFIRMED', authRequirement],
      `${instruction} The client will not retry automatically.`
    );
  }

  return nextAction(
    'blocked_client_error',
    '',
    [],
    ['EXPLICIT_ERROR_RESOLUTION'],
    `${instruction} Stop: this error has no mechanically safe retry action.`
  );
}

function withMaterializedNextAction(report, options) {
  const command = options?.command || report.stage;
  const normalizedReport = WRITE_OUTCOME_RECONCILIATION[command]
    && UNCERTAIN_TRANSPORT_CODES.has(report.code)
    ? {
      ...report,
      code: 'WRITE_OUTCOME_UNCERTAIN',
      retryable: false,
      nextAction: nextActionEnvelope(WRITE_OUTCOME_RECONCILIATION[command]),
      message: 'The command transport failed while a write may have committed; reconcile the canonical resource before any further mutation.',
    }
    : report;
  return {
    ...normalizedReport,
    nextAction: materializeNextAction(normalizedReport, options),
  };
}

function createResult({
  ok,
  stage,
  code,
  retryable = false,
  artifacts = {},
  nextAction,
  message,
  httpStatus,
  response,
  scope,
  layoutSha256,
  evidence,
}) {
  const result = {
    schemaVersion: SCHEMA_VERSION,
    ok: Boolean(ok),
    stage,
    code,
    retryable: Boolean(retryable),
    artifacts,
    nextAction: nextActionEnvelope(nextAction),
  };
  if (message) result.message = message;
  if (httpStatus !== undefined) result.httpStatus = httpStatus;
  if (response !== undefined) result.response = response;
  if (scope !== undefined) result.scope = scope;
  if (layoutSha256 !== undefined) result.layoutSha256 = layoutSha256;
  if (evidence !== undefined) result.evidence = evidence;
  return result;
}

function resultFromError(error, fallbackStage = 'cli') {
  if (error instanceof ClientError) {
    return createResult({
      ok: false,
      stage: error.stage || fallbackStage,
      code: error.code,
      retryable: error.retryable,
      artifacts: error.artifacts || {},
      nextAction: error.nextAction,
      message: error.message,
      httpStatus: error.httpStatus,
      response: error.response,
    });
  }
  return createResult({
    ok: false,
    stage: fallbackStage,
    code: 'UNEXPECTED_ERROR',
    retryable: false,
    artifacts: {},
    nextAction: 'Inspect the local runtime and run the command again.',
    message: 'The client stopped because of an unexpected local error.',
  });
}

function resolveAuthHeader(options) {
  const value = process.env[options.authHeaderEnv];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ClientError(`Authorization environment variable ${options.authHeaderEnv} is not set.`, {
      code: 'AUTH_HEADER_ENV_MISSING',
      stage: options.command,
      nextAction: `Set ${options.authHeaderEnv} to the complete Authorization header and run ${options.command} again.`,
    });
  }
  if (/[\r\n]/.test(value)) {
    throw new ClientError('The authorization environment variable contains an invalid header value.', {
      code: 'AUTH_HEADER_INVALID',
      stage: options.command,
      nextAction: `Replace ${options.authHeaderEnv} with one valid Authorization header value.`,
    });
  }
  return value.trim();
}

function endpointUrl(options, endpoint, apiRoot = API_ROOT) {
  return `${options.site}${apiRoot}${endpoint}`;
}

function responseForReport(data, text) {
  if (data !== undefined) return data;
  if (!text) return undefined;
  return {
    bodyExcerpt: text.slice(0, 1_000),
    bodyTruncated: text.length > 1_000,
  };
}

async function request(options, authHeader, {
  method,
  endpoint,
  body,
  expectJson = true,
  apiRoot = API_ROOT,
  headers = {},
  allowNotModified = false,
  mutation = false,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();

  let response;
  try {
    response = await fetch(endpointUrl(options, endpoint, apiRoot), {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: expectJson ? 'application/json' : 'application/json, text/html;q=0.9',
        Authorization: authHeader,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (mutation) {
      throw new ClientError('The write may have committed before its response was received.', {
        code: 'WRITE_OUTCOME_UNCERTAIN',
        stage: options.command,
        retryable: false,
        nextAction: WRITE_OUTCOME_RECONCILIATION[options.command]
          || 'Read the canonical resource and reconcile the uncertain write outcome. Do not repeat the mutation.',
      });
    }
    if (controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      throw new ClientError(`REST request timed out after ${options.timeoutMs} ms.`, {
        code: 'REQUEST_TIMEOUT',
        stage: options.command,
        retryable: true,
        nextAction: 'Check site availability, then run the command again explicitly.',
      });
    }
    throw new ClientError('REST request could not reach the WordPress site.', {
      code: 'NETWORK_ERROR',
      stage: options.command,
      retryable: true,
      nextAction: 'Check the site URL and network access, then run the command again explicitly.',
    });
  } finally {
    clearTimeout(timer);
  }

  let text;
  try {
    text = await response.text();
  } catch {
    if (mutation) {
      throw new ClientError('The write response could not be read, so its commit outcome is uncertain.', {
        code: 'WRITE_OUTCOME_UNCERTAIN',
        stage: options.command,
        retryable: false,
        httpStatus: response.status,
        nextAction: WRITE_OUTCOME_RECONCILIATION[options.command]
          || 'Read the canonical resource and reconcile the uncertain write outcome. Do not repeat the mutation.',
      });
    }
    throw new ClientError('REST response body could not be read.', {
      code: 'RESPONSE_READ_FAILED',
      stage: options.command,
      retryable: true,
      httpStatus: response.status,
      nextAction: 'Check site stability, then run the command again explicitly.',
    });
  }

  const contentType = response.headers.get('content-type') || '';
  const trimmed = text.trim();
  const looksJson = /(^|[+\w.-])\/json(?:;|$)/i.test(contentType)
    || /^[\[{]/.test(trimmed);
  let data;
  if (trimmed && (expectJson || looksJson)) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      if (response.ok && (expectJson || /(^|[+\w.-])\/json(?:;|$)/i.test(contentType))) {
        if (mutation) {
          throw new ClientError('The write returned an unreadable success response, so its commit outcome is uncertain.', {
            code: 'WRITE_OUTCOME_UNCERTAIN',
            stage: options.command,
            retryable: false,
            httpStatus: response.status,
            nextAction: WRITE_OUTCOME_RECONCILIATION[options.command]
              || 'Read the canonical resource and reconcile the uncertain write outcome. Do not repeat the mutation.',
          });
        }
        throw new ClientError('REST endpoint returned invalid JSON.', {
          code: 'INVALID_JSON_RESPONSE',
          stage: options.command,
          retryable: response.status >= 500,
          httpStatus: response.status,
          nextAction: 'Inspect the WordPress REST endpoint before running the command again.',
        });
      }
    }
  } else if (expectJson && !trimmed && response.ok && !(allowNotModified && response.status === 304)) {
    if (mutation) {
      throw new ClientError('The write returned an empty success response, so its commit outcome is uncertain.', {
        code: 'WRITE_OUTCOME_UNCERTAIN',
        stage: options.command,
        retryable: false,
        httpStatus: response.status,
        nextAction: WRITE_OUTCOME_RECONCILIATION[options.command]
          || 'Read the canonical resource and reconcile the uncertain write outcome. Do not repeat the mutation.',
      });
    }
    throw new ClientError('REST endpoint returned an empty response instead of JSON.', {
      code: 'INVALID_JSON_RESPONSE',
      stage: options.command,
      retryable: response.status >= 500,
      httpStatus: response.status,
      nextAction: 'Inspect the WordPress REST endpoint before running the command again.',
    });
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    text,
    data,
    etag: response.headers.get('etag') || '',
    reportResponse: responseForReport(data, text),
    writeOutcomeUncertain: mutation && (
      response.status === 408
      || response.status === 425
      || response.status === 429
      || response.status >= 500
    ),
  };
}

function httpFailureResult(stage, response, artifacts = {}) {
  if (response.writeOutcomeUncertain === true) {
    return createResult({
      ok: false,
      stage,
      code: 'WRITE_OUTCOME_UNCERTAIN',
      retryable: false,
      artifacts,
      nextAction: WRITE_OUTCOME_RECONCILIATION[stage]
        || 'Read the canonical resource and reconcile the uncertain write outcome. Do not repeat the mutation.',
      message: `The write returned HTTP ${response.status}, but its commit outcome cannot be proven.`,
      httpStatus: response.status,
      response: CAPABILITY_COMMANDS.has(stage)
        ? safeCapabilityOutput(response.reportResponse, stage)
        : response.reportResponse,
    });
  }
  const status = response.status;
  const brandingWrite = stage === 'branding-save';
  const brandingCommand = brandingWrite || stage === 'branding-snapshot';
  let code = 'REST_REQUEST_FAILED';
  let retryable = false;
  let nextAction = 'Inspect the REST response and correct the request before running it again.';

  if (status === 409) {
    const serverCode = isObject(response.data) && typeof response.data.code === 'string'
      ? response.data.code
      : '';
    if (/(?:^|_)classic_conversion_required$/u.test(serverCode)) {
      code = 'REST_CLASSIC_CONVERSION_REQUIRED';
      nextAction = 'Stop the layout write. Preview and confirm conversion through the official classic-content conversion workflow before taking a new Monteby snapshot.';
    } else if (/(?:^|_)(?:write_)?busy$/u.test(serverCode)) {
      code = 'REST_WRITE_BUSY';
      nextAction = 'Wait for the active write to finish, then fetch the canonical resource and repeat preflight before one explicit mutation.';
    } else if (/(?:corrupt|invalid_stored_layout)/u.test(serverCode)) {
      code = 'REST_CORRUPT_RESOURCE';
      nextAction = 'Stop authoring and recover or repair the stored layout through the official recovery workflow before taking a new snapshot.';
    } else if (/(?:runtime_integrity|theme_incompatible)/u.test(serverCode)) {
      code = 'REST_ENVIRONMENT_INCOMPATIBLE';
      nextAction = 'Repair Builder and Theme compatibility or runtime integrity, verify site health, then start discovery again.';
    } else if (/(?:^|_)conflict$/u.test(serverCode) && !/(?:^|_)backup_conflict$/u.test(serverCode)) {
      code = 'REST_CONFLICT';
      nextAction = brandingWrite
        ? 'Take a new branding snapshot, review the newer identity, and issue one explicit save without retrying automatically.'
        : 'Take a new snapshot, reconcile the remote resource and version token, revalidate, and run the mutation again explicitly.';
    } else {
      code = 'REST_REQUEST_BLOCKED';
      nextAction = 'Inspect the named server error and resolve that resource state explicitly. Do not treat this response as an editor conflict or retry the mutation.';
    }
  } else if (status === 428) {
    code = 'REST_PRECONDITION_REQUIRED';
    nextAction = brandingWrite
      ? 'Take a new branding snapshot and issue one explicit save with its expectedRevision precondition.'
      : 'Take a new snapshot and run save again with the precondition field declared by the live descriptor.';
  } else if (status === 401) {
    code = 'REST_UNAUTHENTICATED';
    nextAction = 'Replace the configured authorization environment variable and run the command again.';
  } else if (status === 403) {
    code = 'REST_FORBIDDEN';
    nextAction = 'Grant the authenticated WordPress user access to the Monteby endpoint.';
  } else if (status === 404) {
    code = 'REST_NOT_FOUND';
    nextAction = brandingCommand
      ? 'Check that the installed Monteby Builder exposes the Branding resource declared by its live contract.'
      : 'Check that Monteby Builder is active, and verify the site URL and page ID.';
  } else if (status === 408 || status === 425 || status === 429 || status >= 500) {
    code = status === 429 ? 'REST_RATE_LIMITED' : 'REST_SERVER_ERROR';
    retryable = true;
    nextAction = 'Check site health, then run the command again explicitly.';
  } else if ((status === 400 || status === 422) && (stage === 'validate' || stage === 'patch-validate')) {
    code = stage === 'patch-validate' ? 'PATCH_VALIDATION_FAILED' : 'VALIDATION_FAILED';
    nextAction = stage === 'patch-validate'
      ? 'Correct the operation batch using the live schemas and preflight response, then run patch-validate again.'
      : 'Correct the node map using the validation response, then run validate again.';
  } else if (status >= 300 && status < 400) {
    code = 'REST_REDIRECT_NOT_ALLOWED';
    nextAction = 'Use the canonical WordPress base URL so authorization is never forwarded through a redirect.';
  }

  return createResult({
    ok: false,
    stage,
    code,
    retryable,
    artifacts,
    nextAction,
    message: `REST request failed with HTTP ${status}.`,
    httpStatus: status,
    response: CAPABILITY_COMMANDS.has(stage)
      ? safeCapabilityOutput(response.reportResponse, stage)
      : response.reportResponse,
  });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFieldName(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(value);
}

function resourceEndpoint(resourcePath, pageId, stage) {
  if (
    typeof resourcePath !== 'string'
    || !resourcePath.startsWith(`${REST_NAMESPACE}/`)
    || resourcePath.includes('..')
    || /[?#\\\u0000-\u001F\u007F]/u.test(resourcePath)
  ) {
    throw new ClientError('The live contract contains an unsafe REST resource path.', {
      code: 'LAYOUT_RESOURCE_INVALID',
      stage,
      nextAction: 'Repair the Builder live contract. Do not guess or rewrite its resource paths.',
    });
  }

  const placeholders = [...resourcePath.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1]);
  if (placeholders.some((placeholder) => placeholder !== 'postId')) {
    throw new ClientError('The live layout resource uses an unsupported path placeholder.', {
      code: 'LAYOUT_RESOURCE_INVALID',
      stage,
      nextAction: 'Repair the Builder descriptor so page-scoped resources use only {postId}.',
    });
  }
  if (placeholders.length > 0 && (!Number.isSafeInteger(pageId) || pageId < 1)) {
    throw new ClientError('The discovered REST resource requires a page context.', {
      code: 'LAYOUT_RESOURCE_CONTEXT_MISSING',
      stage,
      nextAction: 'Provide --page-id or use a page-scoped workflow that supplies the saved page identity.',
    });
  }

  const resolved = resourcePath.replaceAll('{postId}', String(pageId));
  if (!/^\/monteby\/v1\/[A-Za-z0-9_./-]+$/u.test(resolved)) {
    throw new ClientError('The live contract contains an unsupported REST resource path.', {
      code: 'LAYOUT_RESOURCE_INVALID',
      stage,
      nextAction: 'Repair the Builder descriptor. Do not call a resource outside the declared Monteby namespace.',
    });
  }
  return resolved.slice(REST_NAMESPACE.length);
}

function declaredResourcePath(resourcePath, replacements, stage, namespaces = [REST_NAMESPACE]) {
  if (
    typeof resourcePath !== 'string'
    || resourcePath.includes('..')
    || /[?#\\\u0000-\u001F\u007F]/u.test(resourcePath)
    || !namespaces.some((namespace) => resourcePath.startsWith(`${namespace}/`))
  ) {
    throw new ClientError('The live contract contains an unsafe REST resource path.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage,
      nextAction: 'Repair the live descriptor. Do not guess or rewrite its resource path.',
    });
  }

  const placeholders = [...resourcePath.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1]);
  if (
    placeholders.some((placeholder) => !Object.hasOwn(replacements, placeholder))
    || Object.keys(replacements).some((replacement) => !placeholders.includes(replacement))
  ) {
    throw new ClientError('The live resource path and supplied scope do not match.', {
      code: 'CAPABILITY_RESOURCE_SCOPE_INVALID',
      stage,
      nextAction: 'Use only the exact path placeholders declared by the live descriptor.',
    });
  }

  let resolved = resourcePath;
  for (const placeholder of placeholders) {
    const replacement = replacements[placeholder];
    if (
      (placeholder === 'postId' && (!Number.isSafeInteger(replacement) || replacement < 1))
      || (
        placeholder === 'name'
        && (
          typeof replacement !== 'string'
          || !(
            /^[A-Za-z0-9_-]{1,128}$/u.test(replacement)
            || /^monteby\/[a-z][a-z0-9-]{0,63}$/u.test(replacement)
          )
        )
      )
    ) {
      throw new ClientError('The supplied resource scope is invalid.', {
        code: 'CAPABILITY_RESOURCE_SCOPE_INVALID',
        stage,
        nextAction: 'Use a positive postId or an exact published monteby/* ability name.',
      });
    }
    resolved = resolved.replaceAll(`{${placeholder}}`, String(replacement));
  }
  if (/\{[^}]+\}/u.test(resolved) || !/^\/[A-Za-z0-9_./-]+$/u.test(resolved)) {
    throw new ClientError('The live descriptor resolved to an unsupported REST path.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage,
      nextAction: 'Repair the live descriptor. Do not call an undeclared endpoint.',
    });
  }
  return resolved;
}

function queryEndpoint(resourcePath, query, allowedFields, stage, replacements = {}) {
  const endpoint = declaredResourcePath(resourcePath, replacements, stage);
  if (!isObject(query)) {
    throw new ClientError('The resource query must be a JSON object.', {
      code: 'CAPABILITY_INPUT_INVALID',
      stage,
      nextAction: 'Provide a JSON object containing only fields published by the resource descriptor.',
    });
  }
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      throw new ClientError(`The query field ${key} is not published by the live descriptor.`, {
        code: 'CAPABILITY_INPUT_INVALID',
        stage,
        nextAction: 'Remove undeclared query fields and run the command again.',
      });
    }
  }
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'boolean') parameters.set(key, value ? 'true' : 'false');
    else if (typeof value === 'string' || (Number.isSafeInteger(value) && value >= 0)) {
      parameters.set(key, String(value));
    } else {
      throw new ClientError(`The query field ${key} has an unsupported value.`, {
        code: 'CAPABILITY_INPUT_INVALID',
        stage,
        nextAction: 'Use only scalar values accepted by the live resource.',
      });
    }
  }
  const encoded = parameters.toString();
  return encoded ? `${endpoint}?${encoded}` : endpoint;
}

function layoutPersistence(contract, stage) {
  const persistence = contract?.layoutPersistence;
  if (!isObject(persistence) || !isObject(persistence.resources)) {
    throw new ClientError('The live contract does not expose layout persistence resources.', {
      code: 'LAYOUT_PERSISTENCE_MISSING',
      stage,
      nextAction: 'Upgrade or repair Monteby Builder, fetch the live contract again, and do not guess REST routes.',
    });
  }
  return persistence;
}

function pageLayoutCapability(contract, pageId, stage) {
  const persistence = layoutPersistence(contract, stage);
  const resource = persistence.resources.pageLayout;
  const fieldNames = [
    resource?.carrier,
    persistence.versionField,
    persistence.writePreconditionField,
    persistence.layoutDigestField,
    persistence.writeDigestPreconditionField,
    persistence.candidateDigestField,
    persistence.writeCandidatePreconditionField,
    resource?.settingsDigestField,
    resource?.writeSettingsDigestPreconditionField,
  ];
  const placeholders = typeof resource?.path === 'string'
    ? [...resource.path.matchAll(/\{postId\}/gu)]
    : [];
  if (
    !isObject(resource)
    || resource.readMethod !== 'GET'
    || resource.writeMethod !== 'PUT'
    || fieldNames.some((fieldName) => !isFieldName(fieldName))
    || new Set(fieldNames).size !== fieldNames.length
    || placeholders.length !== 1
  ) {
    throw new ClientError('The live contract does not expose a supported versioned page-layout resource.', {
      code: 'PAGE_LAYOUT_RESOURCE_MISSING',
      stage,
      nextAction: 'Upgrade or repair Monteby Builder. Do not substitute a hardcoded page-layout endpoint.',
    });
  }
  return {
    endpoint: resourceEndpoint(resource.path, pageId, stage),
    readMethod: resource.readMethod,
    writeMethod: resource.writeMethod,
    carrier: resource.carrier,
    versionField: persistence.versionField,
    writePreconditionField: persistence.writePreconditionField,
    layoutDigestField: persistence.layoutDigestField,
    writeDigestPreconditionField: persistence.writeDigestPreconditionField,
    candidateDigestField: persistence.candidateDigestField,
    writeCandidatePreconditionField: persistence.writeCandidatePreconditionField,
    settingsDigestField: resource.settingsDigestField,
    writeSettingsDigestPreconditionField: resource.writeSettingsDigestPreconditionField,
  };
}

function validationCapability(contract, pageId, stage) {
  const persistence = layoutPersistence(contract, stage);
  const resource = persistence.resources.validate;
  if (
    !isObject(resource)
    || resource.method !== 'POST'
    || !isFieldName(resource.carrier)
    || !isFieldName(persistence.validationContextField)
    || resource.carrier === persistence.validationContextField
  ) {
    throw new ClientError('The live contract does not expose a supported layout-validation resource.', {
      code: 'VALIDATION_RESOURCE_MISSING',
      stage,
      nextAction: 'Upgrade or repair Monteby Builder. Do not substitute a hardcoded validation endpoint or field.',
    });
  }
  return {
    endpoint: resourceEndpoint(resource.path, pageId, stage),
    method: resource.method,
    carrier: resource.carrier,
    contextField: persistence.validationContextField,
  };
}

function previewCapability(contract, pageId, stage) {
  const persistence = layoutPersistence(contract, stage);
  const resource = persistence.resources.preview;
  if (
    !isObject(resource)
    || resource.method !== 'POST'
    || !isFieldName(resource.carrier)
    || !isFieldName(persistence.previewContextField)
    || resource.carrier === persistence.previewContextField
  ) {
    throw new ClientError('The live contract does not expose a supported layout-preview resource.', {
      code: 'PREVIEW_RESOURCE_MISSING',
      stage,
      nextAction: 'Upgrade or repair Monteby Builder. Do not substitute a hardcoded preview endpoint or field.',
    });
  }
  return {
    endpoint: resourceEndpoint(resource.path, pageId, stage),
    method: resource.method,
    carrier: resource.carrier,
    contextField: persistence.previewContextField,
  };
}

async function fetchLiveContract(options, authHeader, artifacts = {}) {
  const response = await request(options, authHeader, {
    method: 'GET',
    endpoint: CONTRACT_ENDPOINT,
  });
  if (!response.ok) return { failure: httpFailureResult(options.command, response, artifacts) };
  if (!isObject(response.data)) {
    return {
      failure: createResult({
        ok: false,
        stage: options.command,
        code: 'CONTRACT_INVALID',
        artifacts,
        nextAction: 'Repair the live Site Contract before authoring. Do not infer missing resources.',
        message: 'The contract endpoint did not return a JSON object.',
        httpStatus: response.status,
      }),
    };
  }
  return { contract: response.data };
}

function nodeMapSha256(nodeMap) {
  return createHash('sha256')
    .update(JSON.stringify(nodeMap), 'utf8')
    .digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function operationsSha256(operations) {
  return canonicalSha256(operations);
}

function pruneNoopOperations(operations) {
  return operations.flatMap((operation) => {
    if (!isObject(operation) || operation.type !== 'update_props') return [operation];
    const normalized = { ...operation };
    if (isObject(normalized.props) && Object.keys(normalized.props).length === 0) {
      delete normalized.props;
    }
    if (Array.isArray(normalized.unsetProps) && normalized.unsetProps.length === 0) {
      delete normalized.unsetProps;
    }
    return normalized.props === undefined && normalized.unsetProps === undefined ? [] : [normalized];
  });
}

const PORTABLE_DIGEST_PREFIX = Buffer.from('monteby-digest-v1\0', 'ascii');

function portableDigestBytes(value) {
  if (value === null) return Buffer.from('n', 'ascii');
  if (value === false) return Buffer.from('f', 'ascii');
  if (value === true) return Buffer.from('t', 'ascii');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Portable digest numbers must be finite.');
    const bytes = Buffer.allocUnsafe(8);
    bytes.writeDoubleBE(Object.is(value, -0) ? 0 : value);
    return Buffer.from(`d${bytes.toString('hex')}`, 'ascii');
  }
  if (typeof value === 'string') {
    if (/(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF])/u.test(value)) {
      throw new TypeError('Portable digest strings must contain valid Unicode scalar values.');
    }
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([Buffer.from(`s${bytes.length}:`, 'ascii'), bytes]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([
      Buffer.from(`a${value.length}:`, 'ascii'),
      ...value.map((item) => portableDigestBytes(item)),
    ]);
  }
  if (isObject(value)) {
    const entries = Object.entries(value).sort(([left], [right]) => (
      Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
    ));
    return Buffer.concat([
      Buffer.from(`o${entries.length}:`, 'ascii'),
      ...entries.flatMap(([key, item]) => [portableDigestBytes(key), portableDigestBytes(item)]),
    ]);
  }
  throw new TypeError(`Portable digest cannot encode ${typeof value}.`);
}

function canonicalSha256(value) {
  return createHash('sha256')
    .update(PORTABLE_DIGEST_PREFIX)
    .update(portableDigestBytes(value))
    .digest('hex');
}

function operationSchemaErrors(value, schema, pathName = '$') {
  const errors = [];
  if (!isObject(schema)) return [`${pathName}: schema is not an object`];
  if (typeof schema.$ref === 'string') return [`${pathName}: unresolved schema reference`];
  if (Array.isArray(schema.allOf)) {
    for (const candidate of schema.allOf) errors.push(...operationSchemaErrors(value, candidate, pathName));
  }
  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.some((candidate) => operationSchemaErrors(value, candidate, pathName).length === 0);
    if (!matches) errors.push(`${pathName}: must match at least one schema`);
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((candidate) => operationSchemaErrors(value, candidate, pathName).length === 0);
    return matches.length === 1 ? [] : [`${pathName}: must match exactly one schema`];
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${pathName}: const mismatch`);
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => candidate === value)) {
    errors.push(`${pathName}: value is not in enum`);
  }
  const types = Array.isArray(schema.type) ? schema.type : (schema.type ? [schema.type] : []);
  if (types.length) {
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const normalized = actual === 'number' && Number.isInteger(value) ? ['integer', 'number'] : [actual];
    if (!types.some((type) => normalized.includes(type))) return [`${pathName}: expected ${types.join('|')}`];
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(`${pathName}: too few items`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(`${pathName}: too many items`);
    if (schema.items) value.forEach((item, index) => errors.push(...operationSchemaErrors(item, schema.items, `${pathName}[${index}]`)));
    if (schema.uniqueItems === true && new Set(value.map(canonicalJson)).size !== value.length) errors.push(`${pathName}: items must be unique`);
  } else if (isObject(value)) {
    if (Number.isInteger(schema.minProperties) && Object.keys(value).length < schema.minProperties) errors.push(`${pathName}: too few properties`);
    if (Number.isInteger(schema.maxProperties) && Object.keys(value).length > schema.maxProperties) errors.push(`${pathName}: too many properties`);
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) errors.push(`${pathName}.${required}: required`);
    }
    if (schema.additionalProperties === false && isObject(schema.properties)) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) errors.push(`${pathName}.${key}: unknown property`);
      }
    }
    if (isObject(schema.additionalProperties)) {
      for (const [key, item] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) {
          errors.push(...operationSchemaErrors(item, schema.additionalProperties, `${pathName}.${key}`));
        }
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...operationSchemaErrors(value[key], childSchema, `${pathName}.${key}`));
      }
    }
  } else if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) errors.push(`${pathName}: too short`);
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) errors.push(`${pathName}: too long`);
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern)).test(value)) errors.push(`${pathName}: pattern mismatch`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${pathName}: below minimum`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${pathName}: above maximum`);
  }
  return errors;
}

function operationsCapability(contract, pageId, stage) {
  const capability = contract?.layoutPersistence?.operations;
  const validResource = (resource) => isObject(resource)
    && resource.method === 'POST'
    && typeof resource.endpoint === 'string'
    && [...resource.endpoint.matchAll(/\{postId\}/gu)].length === 1;
  if (
    !isObject(capability)
    || !isObject(capability.operationSchemas)
    || !validResource(capability.validate)
    || !validResource(capability.apply)
    || !isFieldName(capability.compiledDigestField)
    || !isFieldName(capability.writeCompiledPreconditionField)
  ) {
    throw new ClientError('The live contract does not expose self-contained patch resources and schemas.', {
      code: 'PATCH_CAPABILITY_MISSING', stage,
      nextAction: 'Upgrade Monteby Builder, then fetch the live contract again. Do not guess endpoint or payload shapes.',
    });
  }
  return {
    ...capability,
    validateEndpoint: resourceEndpoint(capability.validate.endpoint, pageId, stage),
    applyEndpoint: resourceEndpoint(capability.apply.endpoint, pageId, stage),
  };
}

function siteBrandingCapability(contract, stage) {
  const capability = contract?.siteBranding;
  const resource = capability?.resource;
  if (
    !isObject(capability)
    || !isObject(resource)
    || resource.readMethod !== 'GET'
    || resource.writeMethod !== 'PUT'
    || resource.path !== '/monteby/v1/site/branding'
    || resource.versionField !== 'revision'
    || resource.writePreconditionField !== 'expectedRevision'
  ) {
    throw new ClientError('The live contract does not expose the bounded Monteby Branding resource.', {
      code: 'BRANDING_CAPABILITY_MISSING',
      stage,
      nextAction: 'Upgrade Monteby Builder, fetch the full live contract again, and never substitute WordPress settings or theme mods.',
    });
  }
  return {
    endpoint: resource.path.replace(/^\/monteby\/v1(?=\/)/, ''),
    readMethod: resource.readMethod,
    writeMethod: resource.writeMethod,
    versionField: resource.versionField,
    writePreconditionField: resource.writePreconditionField,
  };
}

function siteBrandingDocument(value, stage) {
  const identityKeys = ['siteName', 'tagline', 'siteIconId', 'siteIconUrl'];
  const includesIdentity = isObject(value) && identityKeys.some((key) => Object.hasOwn(value, key));
  const exactKeys = ['logoUrl', 'revision', 'version', ...(includesIdentity ? identityKeys : [])].sort();
  const identityValid = !includesIdentity || (
    typeof value.siteName === 'string'
    && typeof value.tagline === 'string'
    && Number.isSafeInteger(value.siteIconId) && value.siteIconId >= 0
    && typeof value.siteIconUrl === 'string'
    && (value.siteIconUrl === '' || isValidLogoUrl(value.siteIconUrl))
  );
  if (
    !isObject(value)
    || value.version !== 1
    || typeof value.revision !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.revision)
    || typeof value.logoUrl !== 'string'
    || (value.logoUrl !== '' && !isValidLogoUrl(value.logoUrl))
    || !identityValid
    || Object.keys(value).sort().join('\0') !== exactKeys.join('\0')
  ) {
    throw new ClientError('The Monteby Branding endpoint returned a document outside the live contract.', {
      code: 'BRANDING_DOCUMENT_INVALID',
      stage,
      nextAction: 'Repair the Builder branding resource before attempting another site-wide identity write.',
    });
  }
  return value;
}

function validateOperations(operations, capability, stage) {
  const maxBatch = capability.limits?.maxBatchItems;
  const maxBytes = capability.limits?.maxPayloadBytes;
  if (!Array.isArray(operations) || operations.length === 0 || (Number.isInteger(maxBatch) && operations.length > maxBatch)) {
    throw new ClientError('Operations input is not a non-empty batch within the live contract limit.', {
      code: 'INVALID_OPERATIONS_INPUT', stage,
      nextAction: 'Provide a non-empty operation array within layoutPersistence.operations.limits.maxBatchItems.',
    });
  }
  if (Number.isInteger(maxBytes) && Buffer.byteLength(JSON.stringify({ operations }), 'utf8') > maxBytes) {
    throw new ClientError('Operations payload exceeds the live contract byte limit.', {
      code: 'INVALID_OPERATIONS_INPUT', stage,
      nextAction: 'Split the bounded change into smaller separately preflighted operation batches.',
    });
  }
  const errors = [];
  operations.forEach((operation, index) => {
    const type = operation?.type;
    const schema = typeof type === 'string' ? capability.operationSchemas[type] : null;
    if (!isObject(schema)) errors.push(`$[${index}].type: operation schema is absent from the live contract`);
    else errors.push(...operationSchemaErrors(operation, schema, `$[${index}]`));
  });
  if (errors.length) {
    throw new ClientError('Operations do not satisfy the live operation schemas.', {
      code: 'INVALID_OPERATIONS_INPUT', stage,
      artifacts: { schemaErrors: errors.slice(0, 100) },
      nextAction: 'Repair the batch using only layoutPersistence.operations.operationSchemas from the live contract.',
    });
  }
}

function layoutDocument(value, versionField, carrier) {
  if (
    isObject(value?.data)
    && value[versionField] === undefined
    && (
      value.data[versionField] !== undefined
      || (isFieldName(carrier) && value.data[carrier] !== undefined)
    )
  ) {
    return value.data;
  }
  return value;
}

function layoutResourceEvidence(value, capability, pageId) {
  const document = layoutDocument(value, capability.versionField, capability.carrier);
  let nodeMap = null;
  try {
    nodeMap = extractNodeMap(document, capability.carrier);
  } catch {
    nodeMap = null;
  }
  const declaredDigest = document?.[capability.layoutDigestField];
  const settingsDigest = document?.[capability.settingsDigestField];
  const representationDigest = nodeMap ? nodeMapSha256(nodeMap) : '';
  return {
    document,
    nodeMap,
    versionToken: versionToken(document, capability.versionField),
    declaredDigest: validSha(declaredDigest) ? declaredDigest : '',
    settingsDigest: validSha(settingsDigest) ? settingsDigest : '',
    representationDigest,
    validIdentity: document?.id === pageId,
    validRepresentation: Boolean(
      nodeMap
      && validSha(declaredDigest)
      && declaredDigest === representationDigest
    ),
    validSettingsDigest: validSha(settingsDigest),
  };
}

function extractNodeMap(value, carrier = '', depth = 0) {
  if (depth > 4) {
    throw new ClientError('Layout input nesting exceeds the supported contract envelope.', {
      code: 'INVALID_LAYOUT_INPUT',
      nextAction: 'Provide the exact node map returned through the declared layout carrier.',
    });
  }
  if (isObject(value) && isObject(value.ROOT)) return value;
  if (isFieldName(carrier) && isObject(value?.[carrier])) {
    return extractNodeMap(value[carrier], '', depth + 1);
  }
  if (isObject(value?.nodeMap)) return extractNodeMap(value.nodeMap, '', depth + 1);
  if (isObject(value?.layout)) return extractNodeMap(value.layout, '', depth + 1);
  throw new ClientError('Layout input does not contain a Monteby node map.', {
    code: 'INVALID_LAYOUT_INPUT',
    nextAction: 'Provide a JSON node map with ROOT, or an object containing nodeMap or layout.',
  });
}

async function readJsonFile(file, label, stage) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new ClientError(`${label} could not be read.`, {
      code: error?.code === 'ENOENT' ? 'INPUT_NOT_FOUND' : 'INPUT_READ_FAILED',
      stage,
      artifacts: { [label]: file },
      nextAction: `Create or restore the ${label} file, then run ${stage} again.`,
    });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ClientError(`${label} is not valid JSON.`, {
      code: 'INVALID_JSON_INPUT',
      stage,
      artifacts: { [label]: file },
      nextAction: `Repair the ${label} JSON, then run ${stage} again.`,
    });
  }
}

const PRIVATE_INPUT_KEYS = new Set([
  'authorization', 'cookie', 'nonce', 'password', 'applicationpassword',
  'secret', 'apikey', 'accesstoken', 'refreshtoken', 'webhooksecret',
  'recipientemail', 'recipients', 'customcss', 'customjs',
]);

function isPrivateCapabilityKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/gu, '');
  return PRIVATE_INPUT_KEYS.has(normalized)
    || /(?:secret|password)$/u.test(normalized)
    || /^(?:auth|authorization|bearer)token$/u.test(normalized)
    || /^(?:smtp|mail)(?:host|port|username|user|credential|credentials)$/u.test(normalized);
}

function assertSafeCapabilityInput(value, stage, pathName = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeCapabilityInput(item, stage, `${pathName}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (isPrivateCapabilityKey(key)) {
      throw new ClientError(`The input field ${pathName}.${key} is private or unsupported.`, {
        code: 'CAPABILITY_PRIVATE_INPUT',
        stage,
        nextAction: 'Remove secrets, recipients, Custom CSS and Custom JS from the input artifact.',
      });
    }
    assertSafeCapabilityInput(item, stage, `${pathName}.${key}`);
  }
}

function safeCapabilityOutput(value, stage, pathName = '$') {
  if (Array.isArray(value)) {
    return value.map((item, index) => safeCapabilityOutput(item, stage, `${pathName}[${index}]`));
  }
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (isPrivateCapabilityKey(key)) {
      throw new ClientError(`The capability response exposed the private field ${pathName}.${key}.`, {
        code: 'CAPABILITY_PRIVACY_VIOLATION',
        stage,
        nextAction: 'Repair the Builder response projection before using this capability. Do not treat a redacted response as successful evidence.',
      });
    }
    return [key, safeCapabilityOutput(item, stage, `${pathName}.${key}`)];
  }));
}

function assertExactFields(
  value,
  allowedFields,
  stage,
  label = 'input',
  code = 'CAPABILITY_INPUT_INVALID'
) {
  if (!isObject(value)) {
    throw new ClientError(`${label} must be a JSON object.`, {
      code,
      stage,
      nextAction: code === 'CAPABILITY_RESPONSE_INVALID'
        ? 'Repair the Builder response before using it as authoring evidence.'
        : `Provide one ${label} object using only fields published by the live descriptor.`,
    });
  }
  const extra = Object.keys(value).filter((key) => !allowedFields.includes(key));
  if (extra.length > 0) {
    throw new ClientError(`${label} contains undeclared fields: ${extra.join(', ')}.`, {
      code,
      stage,
      nextAction: code === 'CAPABILITY_RESPONSE_INVALID'
        ? 'Repair the Builder response projection before using it as authoring evidence.'
        : 'Remove undeclared fields and run the command again.',
    });
  }
}

async function loadCapabilityInput(options) {
  const input = await readJsonFile(options.input, 'input', options.command);
  assertSafeCapabilityInput(input, options.command);
  return input;
}

async function writeTempFile(target, content) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle;
  try {
    handle = await fs.open(temporary, 'wx');
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    return temporary;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

async function atomicWriteMany(entries, stage) {
  const prepared = [];
  try {
    for (const entry of entries) {
      prepared.push({
        target: entry.target,
        temporary: await writeTempFile(entry.target, entry.content),
      });
    }
    for (const entry of prepared) {
      await fs.rename(entry.temporary, entry.target);
    }
  } catch {
    for (const entry of prepared) {
      await fs.unlink(entry.temporary).catch(() => {});
    }
    throw new ClientError('An artifact could not be written atomically.', {
      code: 'ARTIFACT_WRITE_FAILED',
      stage,
      artifacts: Object.fromEntries(entries.map((entry, index) => [`target${index + 1}`, entry.target])),
      nextAction: 'Check output paths and permissions, then run the command again.',
    });
  }
}

async function atomicWriteJson(target, value, stage) {
  await atomicWriteMany([{
    target,
    content: `${JSON.stringify(value, null, 2)}\n`,
  }], stage);
}

async function loadCandidate(options) {
  const input = await readJsonFile(options.layout, 'layout', options.command);
  try {
    return extractNodeMap(input);
  } catch (error) {
    if (error instanceof ClientError) {
      error.stage = options.command;
      error.artifacts = { layout: options.layout };
    }
    throw error;
  }
}

async function loadSaveCandidate(options) {
  const input = await readJsonFile(options.layout, 'layout', options.command);
  let nodeMap;
  try {
    nodeMap = extractNodeMap(input);
  } catch (error) {
    if (error instanceof ClientError) {
      error.stage = options.command;
      error.artifacts = { layout: options.layout };
    }
    throw error;
  }
  const settingsEnvelope = !isObject(input.ROOT)
    && (isObject(input.nodeMap) || isObject(input.layout));
  const hasPresentation = settingsEnvelope && Object.hasOwn(input, 'presentation');
  const hasSeo = settingsEnvelope && Object.hasOwn(input, 'seo');
  if (
    (hasPresentation && !isObject(input.presentation))
    || (hasSeo && !isObject(input.seo))
  ) {
    throw new ClientError('Optional page settings in a layout candidate must be objects.', {
      code: 'INVALID_LAYOUT_INPUT',
      stage: options.command,
      artifacts: { layout: options.layout },
      nextAction: 'Provide presentation and seo only as complete objects beside nodeMap or layout.',
    });
  }
  return {
    nodeMap,
    presentation: hasPresentation ? input.presentation : null,
    seo: hasSeo ? input.seo : null,
  };
}

async function loadOperations(options) {
  const input = await readJsonFile(options.operations, 'operations', options.command);
  const operations = Array.isArray(input) ? input : input?.operations;
  if (!Array.isArray(operations)) {
    throw new ClientError('Operations input must be an array or an object containing operations.', {
      code: 'INVALID_OPERATIONS_INPUT', stage: options.command,
      artifacts: { operations: options.operations },
      nextAction: 'Provide the exact operation batch as JSON.',
    });
  }
  return pruneNoopOperations(operations);
}

async function fetchOperationsCapability(options, authHeader) {
  const discovered = await fetchLiveContract(options, authHeader);
  if (discovered.failure) return discovered;
  try {
    const pageLayout = pageLayoutCapability(discovered.contract, options.pageId, options.command);
    const capability = operationsCapability(discovered.contract, options.pageId, options.command);
    const responseFields = [
      'valid',
      'operationCount',
      'operationsSha256',
      'currentLayoutSha256',
      pageLayout.versionField,
      pageLayout.candidateDigestField,
      capability.compiledDigestField,
    ];
    const writeFields = [
      'operations',
      pageLayout.writePreconditionField,
      pageLayout.writeDigestPreconditionField,
      pageLayout.writeCandidatePreconditionField,
      capability.writeCompiledPreconditionField,
    ];
    if (
      new Set(responseFields).size !== responseFields.length
      || new Set(writeFields).size !== writeFields.length
    ) {
      throw new ClientError('The patch descriptor contains colliding evidence or precondition field names.', {
        code: 'PATCH_CAPABILITY_MISSING',
        stage: options.command,
        nextAction: 'Repair the live patch descriptor before preflight. Do not guess replacement field names.',
      });
    }
    return {
      capability,
      contract: discovered.contract,
      pageLayout,
    };
  } catch (error) {
    return { failure: resultFromError(error, options.command) };
  }
}

async function fetchSiteBrandingCapability(options, authHeader) {
  const discovered = await fetchLiveContract(options, authHeader);
  if (discovered.failure) return discovered;
  try {
    return {
      capability: siteBrandingCapability(discovered.contract, options.command),
      contract: discovered.contract,
    };
  } catch (error) {
    return { failure: resultFromError(error, options.command) };
  }
}

async function fetchSiteBrandingDocument(options, authHeader, capability, artifacts) {
  const response = await request(options, authHeader, {
    method: capability.readMethod,
    endpoint: capability.endpoint,
  });
  if (!response.ok) return { failure: httpFailureResult(options.command, response, artifacts) };
  try {
    return { document: siteBrandingDocument(response.data, options.command) };
  } catch (error) {
    return { failure: resultFromError(error, options.command) };
  }
}

async function runBrandingSnapshot(options, authHeader) {
  const artifacts = {
    contract: path.join(options.outDir, 'branding-contract.json'),
    snapshot: path.join(options.outDir, 'branding-before.json'),
  };
  const discovered = await fetchSiteBrandingCapability(options, authHeader);
  if (discovered.failure) return discovered.failure;
  const current = await fetchSiteBrandingDocument(
    options,
    authHeader,
    discovered.capability,
    artifacts
  );
  if (current.failure) return current.failure;

  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    artifact: 'monteby-site-branding-snapshot',
    site: options.site,
    capturedAt: new Date().toISOString(),
    data: current.document,
  };
  await atomicWriteMany([
    {
      target: artifacts.contract,
      content: `${JSON.stringify(redact(discovered.contract, authHeader), null, 2)}\n`,
    },
    {
      target: artifacts.snapshot,
      content: `${JSON.stringify(snapshot, null, 2)}\n`,
    },
  ], options.command);

  return createResult({
    ok: true,
    stage: options.command,
    code: 'BRANDING_SNAPSHOT_OK',
    artifacts,
    nextAction: 'Review the current logo, then save one approved public logo URL through Monteby Branding.',
    scope: { site: options.site },
    evidence: {
      revision: current.document.revision,
      logoUrl: current.document.logoUrl,
    },
  });
}

function brandingSnapshotScopeFailure(snapshot, options, artifacts) {
  const structurallyValid = isObject(snapshot)
    && snapshot.schemaVersion === SCHEMA_VERSION
    && snapshot.artifact === 'monteby-site-branding-snapshot'
    && typeof snapshot.site === 'string'
    && typeof snapshot.capturedAt === 'string'
    && Number.isFinite(Date.parse(snapshot.capturedAt))
    && isObject(snapshot.data);
  if (!structurallyValid) {
    return createResult({
      ok: false,
      stage: options.command,
      code: 'BRANDING_SNAPSHOT_INVALID',
      artifacts,
      nextAction: 'Create a new branding snapshot from this exact site before saving.',
      message: 'Branding snapshot is missing its required provenance envelope.',
    });
  }
  if (snapshot.site !== options.site) {
    return createResult({
      ok: false,
      stage: options.command,
      code: 'BRANDING_SNAPSHOT_SCOPE_MISMATCH',
      artifacts,
      nextAction: 'Discard this snapshot and snapshot the requested site branding.',
      message: 'Branding snapshot belongs to a different site; no REST request was sent.',
      response: {
        requested: { site: options.site },
        snapshot: { site: snapshot.site },
      },
    });
  }
  try {
    siteBrandingDocument(snapshot.data, options.command);
  } catch {
    return createResult({
      ok: false,
      stage: options.command,
      code: 'BRANDING_SNAPSHOT_INVALID',
      artifacts,
      nextAction: 'Create a new branding snapshot from this exact site before saving.',
      message: 'Branding snapshot does not contain a valid Monteby Branding document.',
    });
  }
  return null;
}

async function runBrandingSave(options, authHeader) {
  const snapshotFile = options.snapshot || path.join(options.outDir, 'branding-before.json');
  const artifacts = { snapshot: snapshotFile };
  const snapshot = await readJsonFile(snapshotFile, 'branding snapshot', options.command);
  const scopeFailure = brandingSnapshotScopeFailure(snapshot, options, artifacts);
  if (scopeFailure) return scopeFailure;

  const discovered = await fetchSiteBrandingCapability(options, authHeader);
  if (discovered.failure) return discovered.failure;
  const current = await fetchSiteBrandingDocument(
    options,
    authHeader,
    discovered.capability,
    artifacts
  );
  if (current.failure) return current.failure;
  if (current.document.revision !== snapshot.data.revision) {
    return createResult({
      ok: false,
      stage: options.command,
      code: 'BRANDING_SNAPSHOT_STALE',
      artifacts,
      nextAction: 'Take a new branding snapshot, review the newer logo, then issue one explicit save.',
      message: 'Site branding changed after the supplied snapshot; no write was sent.',
      scope: { site: options.site },
      evidence: {
        snapshotRevision: snapshot.data.revision,
        currentRevision: current.document.revision,
      },
    });
  }

  const body = {
    logoUrl: options.logoUrl,
    [discovered.capability.writePreconditionField]: snapshot.data.revision,
  };
  const response = await request(options, authHeader, {
    method: discovered.capability.writeMethod,
    endpoint: discovered.capability.endpoint,
    body,
    mutation: true,
  });
  if (!response.ok) return httpFailureResult(options.command, response, artifacts);

  let saved;
  try {
    saved = siteBrandingDocument(response.data, options.command);
  } catch (error) {
    return resultFromError(error, options.command);
  }
  if (saved.logoUrl !== options.logoUrl || ['siteName', 'tagline', 'siteIconId', 'siteIconUrl'].some((field) => (
    Object.hasOwn(current.document, field) && current.document[field] !== saved[field]
  ))) {
    return createResult({
      ok: false,
      stage: options.command,
      code: 'BRANDING_SAVE_EVIDENCE_INVALID',
      artifacts,
      nextAction: 'Inspect the Builder branding persistence before attempting another write.',
      message: 'The branding response did not confirm the approved logo and preservation of the native site identity.',
      response: saved,
      scope: { site: options.site },
    });
  }

  return createResult({
    ok: true,
    stage: options.command,
    code: 'BRANDING_SAVE_OK',
    artifacts,
    nextAction: 'Snapshot branding again and verify SiteBranding on the canonical public page.',
    httpStatus: response.status,
    response: saved,
    scope: { site: options.site },
    evidence: {
      previousRevision: snapshot.data.revision,
      revision: saved.revision,
      logoUrl: saved.logoUrl,
    },
  });
}

async function runSnapshot(options, authHeader) {
  const artifacts = {
    contract: path.join(options.outDir, 'contract.json'),
    snapshot: path.join(options.outDir, 'layout-before.json'),
  };

  const discovered = await fetchLiveContract(options, authHeader, artifacts);
  if (discovered.failure) return discovered.failure;
  const providerSaveGate = evaluateFeatureGate(
    discovered.contract,
    'providerRenderedWidgetSave',
    compatibilityManifest
  );
  if (!providerSaveGate.ok) {
    return createResult({
      ok: false,
      stage: 'snapshot',
      code: providerSaveGate.code,
      artifacts,
      nextAction: providerSaveGate.code === 'blocked_plugin_version'
        ? 'Upgrade Monteby Builder, then fetch a fresh live contract before authoring.'
        : 'Stop and repair the Builder live-contract deployment; do not guess the missing capability.',
      message: providerSaveGate.message,
    });
  }

  let layoutResource;
  try {
    layoutResource = pageLayoutCapability(discovered.contract, options.pageId, 'snapshot');
  } catch (error) {
    return resultFromError(error, 'snapshot');
  }

  const layoutResponse = await request(options, authHeader, {
    method: layoutResource.readMethod,
    endpoint: layoutResource.endpoint,
  });
  if (!layoutResponse.ok) {
    return httpFailureResult('snapshot', layoutResponse, artifacts);
  }

  const layoutEvidence = layoutResourceEvidence(
    layoutResponse.data,
    layoutResource,
    options.pageId
  );
  const layoutIdentity = layoutEvidence.document;
  const viewUrl = normalizePublicPageUrl(layoutIdentity?.viewUrl, options.site);
  const publicPageUrl = options.renderContextUrl || viewUrl;
  if (
    !layoutEvidence.validIdentity
    || !layoutEvidence.validRepresentation
    || !layoutEvidence.validSettingsDigest
    || typeof layoutIdentity?.postType !== 'string'
    || !layoutIdentity.postType.trim()
    || !layoutEvidence.versionToken
    || !viewUrl
  ) {
    return createResult({
      ok: false,
      stage: 'snapshot',
      code: 'LAYOUT_IDENTITY_INVALID',
      artifacts,
      nextAction: `Repair the versioned layout resource so it returns id, postType, viewUrl, ${layoutResource.versionField}, ${layoutResource.layoutDigestField}, ${layoutResource.settingsDigestField}, and the exact saved representation for the requested document.`,
      message: 'The layout resource did not bind the requested document to a complete same-site identity and verified representation.',
      response: layoutIdentity,
    });
  }

  const pageSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    artifact: 'monteby-page-snapshot',
    site: options.site,
    pageId: options.pageId,
    postType: layoutIdentity.postType,
    viewUrl,
    renderContextUrl: options.renderContextUrl || '',
    publicPageUrl,
    capturedAt: new Date().toISOString(),
    data: redact(layoutIdentity, authHeader),
  };
  await atomicWriteMany([
    {
      target: artifacts.contract,
      content: `${JSON.stringify(redact(discovered.contract, authHeader), null, 2)}\n`,
    },
    {
      target: artifacts.snapshot,
      content: `${JSON.stringify(pageSnapshot, null, 2)}\n`,
    },
  ], 'snapshot');

  return createResult({
    ok: true,
    stage: 'snapshot',
    code: 'SNAPSHOT_OK',
    artifacts,
    nextAction: 'Build the candidate from contract.json, then run validate before save.',
    scope: {
      site: options.site,
      pageId: options.pageId,
    },
    evidence: {
      publicPageUrl,
      postType: layoutIdentity.postType,
      viewUrl,
      renderContextUrl: options.renderContextUrl || '',
      productVersion: providerSaveGate.productVersion,
      layoutSha256: layoutEvidence.declaredDigest,
      pageSettingsSha256: layoutEvidence.settingsDigest,
    },
  });
}

function normalizePublicPageUrl(value, site) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    const siteUrl = new URL(site);
    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.origin !== siteUrl.origin
    ) {
      return '';
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

async function validateNodeMap(options, authHeader, nodeMap, artifacts, capability) {
  const body = {
    [capability.carrier]: nodeMap,
    ...(options.pageId ? { [capability.contextField]: options.pageId } : {}),
  };
  const response = await request(options, authHeader, {
    method: capability.method,
    endpoint: capability.endpoint,
    body,
  });
  if (!response.ok) {
    return httpFailureResult('validate', response, artifacts);
  }
  if (response.data?.valid === false || response.data?.ok === false) {
    return createResult({
      ok: false,
      stage: 'validate',
      code: 'VALIDATION_FAILED',
      artifacts,
      nextAction: 'Correct the node map using the validation response, then run validate again.',
      message: 'Monteby rejected the candidate node map.',
      httpStatus: response.status,
      response: response.data,
      layoutSha256: artifacts.layoutSha256,
    });
  }
  if (!isObject(response.data) || response.data.valid !== true || !Array.isArray(response.data.lint)) {
    return createResult({
      ok: false,
      stage: 'validate',
      code: 'VALIDATION_EVIDENCE_INVALID',
      artifacts,
      nextAction: 'Repair the validation resource so it returns valid: true and the evaluated lint findings.',
      message: 'Validation returned 2xx without complete contract-backed evidence.',
      httpStatus: response.status,
      response: response.data,
      layoutSha256: artifacts.layoutSha256,
    });
  }
  return createResult({
    ok: true,
    stage: 'validate',
    code: 'VALIDATION_OK',
    artifacts,
    nextAction: 'Run save with the same layout and the unchanged snapshot.',
    httpStatus: response.status,
    response: response.data,
    layoutSha256: artifacts.layoutSha256,
  });
}

async function runValidate(options, authHeader) {
  const nodeMap = await loadCandidate(options);
  const artifacts = {
    layout: options.layout,
    layoutSha256: nodeMapSha256(nodeMap),
  };
  const discovered = await fetchLiveContract(options, authHeader, artifacts);
  if (discovered.failure) return discovered.failure;
  let capability;
  try {
    capability = validationCapability(discovered.contract, options.pageId, 'validate');
  } catch (error) {
    return resultFromError(error, 'validate');
  }
  return validateNodeMap(options, authHeader, nodeMap, {
    ...artifacts,
  }, capability);
}

function versionToken(document, versionField) {
  const token = isFieldName(versionField) ? document?.[versionField] : undefined;
  return typeof token === 'string' && token.trim() ? token : '';
}

function snapshotScopeFailure(snapshot, options, artifacts, stage = 'save') {
  const structurallyValid = isObject(snapshot)
    && snapshot.schemaVersion === SCHEMA_VERSION
    && snapshot.artifact === 'monteby-page-snapshot'
    && typeof snapshot.site === 'string'
    && Number.isSafeInteger(snapshot.pageId)
    && normalizePublicPageUrl(snapshot.publicPageUrl, snapshot.site) === snapshot.publicPageUrl
    && typeof snapshot.capturedAt === 'string'
    && Number.isFinite(Date.parse(snapshot.capturedAt))
    && isObject(snapshot.data);
  if (!structurallyValid) {
    return createResult({
      ok: false,
      stage,
      code: 'SNAPSHOT_SCOPE_INVALID',
      artifacts,
      nextAction: 'Create a new page-scoped snapshot before validation or save.',
      message: 'Snapshot is missing a valid Monteby page-snapshot provenance envelope.',
    });
  }
  if (snapshot.site !== options.site || snapshot.pageId !== options.pageId) {
    return createResult({
      ok: false,
      stage,
      code: 'SNAPSHOT_SCOPE_MISMATCH',
      artifacts,
      nextAction: 'Snapshot this exact site and page before validation or save.',
      message: 'Snapshot belongs to a different site or page; no REST request was sent.',
      response: {
        requested: { site: options.site, pageId: options.pageId },
        snapshot: { site: snapshot.site, pageId: snapshot.pageId },
      },
    });
  }
  return null;
}

async function runSave(options, authHeader) {
  const snapshotFile = options.snapshot || path.join(options.outDir, 'layout-before.json');
  const artifacts = {
    layout: options.layout,
    snapshot: snapshotFile,
  };
  const snapshotValue = await readJsonFile(snapshotFile, 'snapshot', 'save');
  const scopeFailure = snapshotScopeFailure(snapshotValue, options, artifacts);
  if (scopeFailure) return scopeFailure;
  const candidateDocument = await loadSaveCandidate(options);
  const candidate = candidateDocument.nodeMap;
  const intendsPageSettingsWrite = Boolean(
    candidateDocument.presentation
    || candidateDocument.seo
    || options.presentationLayout
  );
  const candidateSha256 = nodeMapSha256(candidate);
  artifacts.layoutSha256 = candidateSha256;
  if (candidateSha256 !== options.expectedLayoutSha256) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'LAYOUT_SHA256_MISMATCH',
      artifacts,
      nextAction: 'Validate this exact candidate and use the emitted layoutSha256 for save.',
      message: 'Candidate layout no longer matches the digest supplied from validate; no REST request was sent.',
      response: {
        expectedLayoutSha256: options.expectedLayoutSha256,
        actualLayoutSha256: candidateSha256,
      },
      layoutSha256: candidateSha256,
    });
  }
  const discovered = await fetchLiveContract(options, authHeader, artifacts);
  if (discovered.failure) return discovered.failure;
  let pageResource;
  let validateResource;
  try {
    pageResource = pageLayoutCapability(discovered.contract, options.pageId, 'save');
    validateResource = validationCapability(discovered.contract, options.pageId, 'save');
  } catch (error) {
    return resultFromError(error, 'save');
  }
  const snapshotEvidence = layoutResourceEvidence(snapshotValue, pageResource, options.pageId);
  const snapshotVersion = snapshotEvidence.versionToken;
  if (
    !snapshotVersion
    || !snapshotEvidence.validIdentity
    || !snapshotEvidence.validRepresentation
    || !snapshotEvidence.validSettingsDigest
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'SNAPSHOT_EVIDENCE_INVALID',
      artifacts,
      nextAction: 'Run snapshot again and keep its unmodified layout-before.json for save.',
      message: `Snapshot does not bind page identity, ${pageResource.versionField}, ${pageResource.layoutDigestField}, ${pageResource.settingsDigestField}, and the exact layout representation.`,
    });
  }

  const freshResponse = await request(options, authHeader, {
    method: pageResource.readMethod,
    endpoint: pageResource.endpoint,
  });
  if (!freshResponse.ok) {
    return httpFailureResult('save', freshResponse, artifacts);
  }
  const freshEvidence = layoutResourceEvidence(freshResponse.data, pageResource, options.pageId);
  const freshDocument = freshEvidence.document;
  const freshVersion = freshEvidence.versionToken;
  if (
    !freshVersion
    || !freshEvidence.validIdentity
    || !freshEvidence.validRepresentation
    || !freshEvidence.validSettingsDigest
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'REST_LAYOUT_EVIDENCE_INVALID',
      artifacts,
      nextAction: `Inspect the page layout endpoint; it must return the requested id, ${pageResource.versionField}, ${pageResource.layoutDigestField}, ${pageResource.settingsDigestField}, and matching layout representation before save is safe.`,
      message: 'Current page layout does not contain complete page-scoped version and representation evidence.',
      httpStatus: freshResponse.status,
      response: freshResponse.data,
    });
  }

  if (
    freshVersion !== snapshotVersion
    || freshEvidence.declaredDigest !== snapshotEvidence.declaredDigest
    || (
      intendsPageSettingsWrite
      && freshEvidence.settingsDigest !== snapshotEvidence.settingsDigest
    )
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'REST_CONFLICT',
      artifacts,
      nextAction: 'Take a new snapshot, reconcile the remote layout, revalidate, and run save again explicitly.',
      message: 'The page changed after the snapshot; no validation or PUT request was sent.',
      httpStatus: 409,
      response: {
        snapshotVersionToken: snapshotVersion,
        currentVersionToken: freshVersion,
        snapshotLayoutSha256: snapshotEvidence.declaredDigest,
        currentLayoutSha256: freshEvidence.declaredDigest,
        snapshotPageSettingsSha256: snapshotEvidence.settingsDigest,
        currentPageSettingsSha256: freshEvidence.settingsDigest,
      },
    });
  }

  if (options.presentationLayout && !isObject(candidateDocument.presentation) && !isObject(freshDocument?.presentation)) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'PRESENTATION_CAPABILITY_MISSING',
      artifacts,
      nextAction: 'Use a presentation override only when the exact live layout document and contract expose presentation persistence.',
      message: 'The live page does not expose presentation persistence; no validation or PUT request was sent.',
      scope: {
        site: options.site,
        pageId: options.pageId,
      },
      layoutSha256: candidateSha256,
    });
  }

  let candidatePresentation = candidateDocument.presentation
    ? { ...candidateDocument.presentation }
    : null;
  if (options.presentationLayout) {
    candidatePresentation = candidatePresentation || { ...freshDocument.presentation };
    candidatePresentation.layout = options.presentationLayout;
    if (options.presentationLayout === 'canvas') {
      candidatePresentation.disableGlobalTemplates = true;
    }
  }
  const candidateSeo = candidateDocument.seo;
  if (candidateSeo) {
    const seoSchema = discovered.contract?.layoutPersistence?.seo?.schema;
    const schemaErrors = isObject(seoSchema)
      ? operationSchemaErrors(candidateSeo, seoSchema)
      : ['layoutPersistence.seo.schema is absent'];
    if (schemaErrors.length > 0) {
      return createResult({
        ok: false,
        stage: 'save',
        code: 'PAGE_SETTINGS_CAPABILITY_MISSING',
        artifacts,
        nextAction: 'Use the dedicated SEO resource or repair the live SEO schema before saving page settings with a layout.',
        message: `The candidate SEO block is not supported by the live layout contract: ${schemaErrors.join('; ')}`,
      });
    }
  }
  const writesPageSettings = Boolean(candidatePresentation || candidateSeo);

  const validation = await validateNodeMap(
    options,
    authHeader,
    candidate,
    artifacts,
    validateResource
  );
  if (!validation.ok) {
    return {
      ...validation,
      stage: 'save',
      nextAction: 'Correct the candidate, run validate, and then run save again with a fresh snapshot if needed.',
    };
  }

  let validatedNodeMap = null;
  try {
    validatedNodeMap = extractNodeMap(validation.response, pageResource.carrier);
  } catch {
    validatedNodeMap = null;
  }
  const validatedCandidateSha256 = validation.response?.[pageResource.candidateDigestField];
  if (
    !validatedNodeMap
    || !validSha(validatedCandidateSha256)
    || nodeMapSha256(validatedNodeMap) !== validatedCandidateSha256
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'VALIDATION_CANDIDATE_EVIDENCE_INVALID',
      artifacts,
      nextAction: 'Repair the validation resource so it returns the exact canonical candidate and its matching digest before another save.',
      message: 'Validation succeeded without proof of the canonical candidate that the server will persist.',
      httpStatus: validation.httpStatus,
      response: validation.response,
      layoutSha256: candidateSha256,
    });
  }

  const payload = {
    [pageResource.writePreconditionField]: freshVersion,
    [pageResource.writeDigestPreconditionField]: freshEvidence.declaredDigest,
    [pageResource.writeCandidatePreconditionField]: validatedCandidateSha256,
    [pageResource.carrier]: candidate,
    ...(writesPageSettings ? {
      [pageResource.writeSettingsDigestPreconditionField]: freshEvidence.settingsDigest,
    } : {}),
    ...(candidatePresentation ? { presentation: candidatePresentation } : {}),
    ...(candidateSeo ? { seo: candidateSeo } : {}),
  };
  const saveResponse = await request(options, authHeader, {
    method: pageResource.writeMethod,
    endpoint: pageResource.endpoint,
    body: payload,
    mutation: true,
  });
  if (!saveResponse.ok) {
    return httpFailureResult('save', saveResponse, artifacts);
  }

  const savedEvidence = layoutResourceEvidence(saveResponse.data, pageResource, options.pageId);
  const savedDocument = savedEvidence.document;
  const savedVersion = savedEvidence.versionToken;
  if (
    savedDocument?.saved !== true
    || !savedVersion
    || !savedEvidence.validIdentity
    || !savedEvidence.validRepresentation
    || savedDocument?.[pageResource.candidateDigestField] !== validatedCandidateSha256
    || savedEvidence.declaredDigest !== validatedCandidateSha256
    || !savedEvidence.validSettingsDigest
    || (!writesPageSettings && savedEvidence.settingsDigest !== freshEvidence.settingsDigest)
    || (writesPageSettings && (
      (candidatePresentation && canonicalJson(savedDocument.presentation) !== canonicalJson(candidatePresentation))
      || (candidateSeo && canonicalJson(savedDocument.seo) !== canonicalJson(candidateSeo))
    ))
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'SAVE_EVIDENCE_INVALID',
      artifacts,
      nextAction: 'Inspect the saved page and Builder proof fields. Do not repeat the write automatically.',
      message: 'The write returned 2xx without complete page identity, candidate, version, and representation evidence.',
      httpStatus: saveResponse.status,
      response: saveResponse.data,
      layoutSha256: candidateSha256,
    });
  }
  const savedLayoutSha256 = savedEvidence.declaredDigest;
  const savedPageSettingsSha256 = savedEvidence.settingsDigest;

  const readbackResponse = await request(options, authHeader, {
    method: pageResource.readMethod,
    endpoint: pageResource.endpoint,
  });
  if (!readbackResponse.ok) {
    return createResult({
      ...httpFailureResult('save', readbackResponse, artifacts),
      code: 'SAVE_READBACK_FAILED',
      retryable: false,
      nextAction: 'Inspect the page state manually. The write succeeded but its canonical readback failed.',
      layoutSha256: candidateSha256,
    });
  }
  const readbackEvidence = layoutResourceEvidence(readbackResponse.data, pageResource, options.pageId);
  const readbackVersion = readbackEvidence.versionToken;
  const readbackLayoutSha256 = readbackEvidence.declaredDigest;
  if (
    !readbackEvidence.validIdentity
    || !readbackEvidence.validRepresentation
    || !readbackEvidence.validSettingsDigest
    || readbackVersion !== savedVersion
    || readbackLayoutSha256 !== savedLayoutSha256
    || readbackEvidence.settingsDigest !== savedPageSettingsSha256
    || (candidatePresentation && canonicalJson(readbackEvidence.document.presentation) !== canonicalJson(candidatePresentation))
    || (candidateSeo && canonicalJson(readbackEvidence.document.seo) !== canonicalJson(candidateSeo))
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'SAVE_READBACK_MISMATCH',
      artifacts,
      nextAction: 'Inspect the canonical page state and reconcile it before another write.',
      message: 'The canonical readback does not match the saved version and write-response representation.',
      httpStatus: readbackResponse.status,
      response: {
        expectedVersionToken: savedVersion,
        readbackVersionToken: readbackVersion,
        expectedSavedLayoutSha256: savedLayoutSha256,
        readbackLayoutSha256,
        expectedPageSettingsSha256: savedPageSettingsSha256,
        readbackPageSettingsSha256: readbackEvidence.settingsDigest,
      },
      layoutSha256: candidateSha256,
    });
  }

  const responseDetails = isObject(saveResponse.data)
    ? { ...saveResponse.data }
    : { restResponse: saveResponse.data };
  responseDetails.presentationSource = 'fresh';
  responseDetails.presentationOverride = options.presentationLayout || null;
  return createResult({
    ok: true,
    stage: 'save',
    code: 'SAVE_OK',
    artifacts,
    nextAction: 'Run preview with the saved candidate and inspect the rendered artifact.',
    httpStatus: saveResponse.status,
    response: responseDetails,
    scope: {
      site: options.site,
      pageId: options.pageId,
    },
    layoutSha256: candidateSha256,
    evidence: {
      site: options.site,
      pageId: options.pageId,
      publicPageUrl: snapshotValue.publicPageUrl,
      layoutSha256: candidateSha256,
      candidateLayoutSha256: validatedCandidateSha256,
      savedLayoutSha256,
      readbackLayoutSha256,
      readbackLayout: readbackEvidence.nodeMap,
      versionField: pageResource.versionField,
      previousVersionToken: freshVersion,
      previousLayoutSha256: freshEvidence.declaredDigest,
      previousPageSettingsSha256: freshEvidence.settingsDigest,
      pageSettingsSha256: readbackEvidence.settingsDigest,
      versionToken: savedVersion,
      versionAdvanced: savedVersion !== freshVersion,
      layoutChanged: savedLayoutSha256 !== freshEvidence.declaredDigest,
      validation: {
        valid: true,
        lint: validation.response.lint,
      },
    },
  });
}

function patchSnapshotFile(options) {
  return options.snapshot || path.join(options.outDir, 'layout-before.json');
}

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

async function preparePatch(options, authHeader) {
  const snapshotFile = patchSnapshotFile(options);
  const artifacts = { operations: options.operations, snapshot: snapshotFile };
  const snapshot = await readJsonFile(snapshotFile, 'snapshot', options.command);
  const scopeFailure = snapshotScopeFailure(snapshot, options, artifacts, options.command);
  if (scopeFailure) return { failure: scopeFailure };
  const discovered = await fetchOperationsCapability(options, authHeader);
  if (discovered.failure) return discovered;
  const snapshotEvidence = layoutResourceEvidence(
    snapshot,
    discovered.pageLayout,
    options.pageId
  );
  const expectedVersionToken = snapshotEvidence.versionToken;
  if (
    !expectedVersionToken
    || !snapshotEvidence.validIdentity
    || !snapshotEvidence.validRepresentation
  ) {
    return { failure: createResult({
      ok: false, stage: options.command, code: 'SNAPSHOT_EVIDENCE_INVALID', artifacts,
      nextAction: 'Create a fresh page-scoped snapshot and preflight the patch again.',
      message: 'Snapshot does not bind the requested page, version, digest, and exact layout representation.',
    }) };
  }
  const operations = await loadOperations(options);
  try {
    validateOperations(operations, discovered.capability, options.command);
  } catch (error) {
    return { failure: resultFromError(error, options.command) };
  }
  const digest = operationsSha256(operations);
  const snapshotSha256 = canonicalSha256(snapshot);
  return {
    artifacts: { ...artifacts, operationsSha256: digest, snapshotSha256 },
    snapshot,
    expectedVersionToken,
    expectedLayoutSha256: snapshotEvidence.declaredDigest,
    operations,
    operationsSha256: digest,
    snapshotSha256,
    capability: discovered.capability,
    pageLayout: discovered.pageLayout,
  };
}

async function runPatchValidate(options, authHeader) {
  const prepared = await preparePatch(options, authHeader);
  if (prepared.failure) return prepared.failure;
  const response = await request(options, authHeader, {
    method: prepared.capability.validate.method,
    endpoint: prepared.capability.validateEndpoint,
    body: {
      operations: prepared.operations,
      [prepared.pageLayout.writePreconditionField]: prepared.expectedVersionToken,
      [prepared.pageLayout.writeDigestPreconditionField]: prepared.expectedLayoutSha256,
    },
  });
  if (!response.ok) return httpFailureResult('patch-validate', response, prepared.artifacts);
  const data = response.data;
  const candidateLayout = (() => {
    try { return extractNodeMap(data?.layout); } catch { return null; }
  })();
  const invalid = !isObject(data)
    || data.valid !== true
    || data.operationCount !== prepared.operations.length
    || data.operationsSha256 !== prepared.operationsSha256
    || data.currentLayoutSha256 !== prepared.expectedLayoutSha256
    || !validSha(data[prepared.pageLayout.candidateDigestField])
    || !validSha(data[prepared.capability.compiledDigestField])
    || data[prepared.pageLayout.versionField] !== prepared.expectedVersionToken
    || !candidateLayout
    || nodeMapSha256(candidateLayout) !== data[prepared.pageLayout.candidateDigestField];
  if (invalid) {
    return createResult({
      ok: false, stage: 'patch-validate', code: 'PATCH_VALIDATION_EVIDENCE_INVALID',
      artifacts: prepared.artifacts,
      nextAction: 'Fix the Builder preflight response; do not apply this operation batch.',
      message: 'Patch preflight did not return complete evidence bound to the snapshot and operation batch.',
      httpStatus: response.status,
      response: data,
    });
  }
  const candidateLayoutSha256 = data[prepared.pageLayout.candidateDigestField];
  const compiledHtmlSha256 = data[prepared.capability.compiledDigestField];
  prepared.artifacts.candidateLayoutSha256 = candidateLayoutSha256;
  prepared.artifacts.compiledHtmlSha256 = compiledHtmlSha256;
  return createResult({
    ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK',
    artifacts: prepared.artifacts,
    nextAction: 'Apply the exact batch once using this report and both emitted SHA-256 bindings.',
    httpStatus: response.status,
    response: data,
    scope: { site: options.site, pageId: options.pageId },
    layoutSha256: candidateLayoutSha256,
    evidence: {
      site: options.site,
      pageId: options.pageId,
      publicPageUrl: prepared.snapshot.publicPageUrl,
      versionField: prepared.pageLayout.versionField,
      versionToken: prepared.expectedVersionToken,
      layoutSha256: prepared.expectedLayoutSha256,
      currentLayoutSha256: data.currentLayoutSha256,
      snapshotSha256: prepared.snapshotSha256,
      operationsSha256: prepared.operationsSha256,
      candidateLayoutSha256,
      compiledHtmlSha256,
    },
  });
}

function patchReportFailure(report, options, prepared) {
  const valid = isObject(report)
    && report.schemaVersion === SCHEMA_VERSION
    && report.ok === true
    && report.stage === 'patch-validate'
    && report.code === 'PATCH_VALIDATION_OK'
    && report.scope?.site === options.site
    && report.scope?.pageId === options.pageId
    && report.evidence?.versionField === prepared.pageLayout.versionField
    && report.evidence?.versionToken === prepared.expectedVersionToken
    && report.evidence?.layoutSha256 === prepared.expectedLayoutSha256
    && report.evidence?.snapshotSha256 === prepared.snapshotSha256
    && validSha(report.evidence?.operationsSha256)
    && validSha(report.evidence?.candidateLayoutSha256)
    && validSha(report.evidence?.compiledHtmlSha256);
  if (!valid) return 'PATCH_REPORT_INVALID';
  if (
    report.evidence.operationsSha256 !== options.expectedOperationsSha256
    || report.evidence.operationsSha256 !== prepared.operationsSha256
  ) return 'OPERATIONS_SHA256_MISMATCH';
  if (report.evidence.candidateLayoutSha256 !== options.expectedCandidateLayoutSha256) {
    return 'CANDIDATE_LAYOUT_SHA256_MISMATCH';
  }
  if (report.evidence.compiledHtmlSha256 !== options.expectedCompiledHtmlSha256) {
    return 'COMPILED_HTML_SHA256_MISMATCH';
  }
  return '';
}

async function runPatchSave(options, authHeader) {
  const prepared = await preparePatch(options, authHeader);
  if (prepared.failure) return prepared.failure;
  prepared.artifacts.patchReport = options.patchReport;
  const report = await readJsonFile(options.patchReport, 'patchReport', 'patch-save');
  const reportFailure = patchReportFailure(report, options, prepared);
  if (reportFailure) {
    return createResult({
      ok: false, stage: 'patch-save', code: reportFailure,
      artifacts: prepared.artifacts,
      nextAction: 'Run patch-validate again with this exact snapshot and operation file.',
      message: 'Patch evidence does not bind this exact site, page, snapshot, operation batch, and candidate.',
    });
  }
  const fresh = await request(options, authHeader, {
    method: prepared.pageLayout.readMethod,
    endpoint: prepared.pageLayout.endpoint,
  });
  if (!fresh.ok) return httpFailureResult('patch-save', fresh, prepared.artifacts);
  const currentEvidence = layoutResourceEvidence(
    fresh.data,
    prepared.pageLayout,
    options.pageId
  );
  const currentVersion = currentEvidence.versionToken;
  if (
    !currentVersion
    || !currentEvidence.validIdentity
    || !currentEvidence.validRepresentation
    || currentVersion !== prepared.expectedVersionToken
    || currentEvidence.declaredDigest !== prepared.expectedLayoutSha256
  ) {
    return createResult({
      ok: false, stage: 'patch-save', code: currentVersion ? 'REST_CONFLICT' : 'REST_VERSION_MISSING',
      artifacts: prepared.artifacts,
      nextAction: 'Snapshot the page again, reconcile the patch, and preflight it again. Do not retry apply.',
      message: currentVersion
        ? 'The page changed after patch preflight; no apply request was sent.'
        : `Current layout has no ${prepared.pageLayout.versionField}.`,
      httpStatus: currentVersion ? 409 : fresh.status,
      response: currentVersion ? {
        snapshotVersionToken: prepared.expectedVersionToken,
        currentVersionToken: currentVersion,
        snapshotLayoutSha256: prepared.expectedLayoutSha256,
        currentLayoutSha256: currentEvidence.declaredDigest,
      } : undefined,
    });
  }
  const response = await request(options, authHeader, {
    method: prepared.capability.apply.method,
    endpoint: prepared.capability.applyEndpoint,
    body: {
      operations: prepared.operations,
      [prepared.pageLayout.writePreconditionField]: prepared.expectedVersionToken,
      [prepared.pageLayout.writeDigestPreconditionField]: prepared.expectedLayoutSha256,
      [prepared.pageLayout.writeCandidatePreconditionField]: options.expectedCandidateLayoutSha256,
      [prepared.capability.writeCompiledPreconditionField]: options.expectedCompiledHtmlSha256,
    },
    mutation: true,
  });
  if (!response.ok) return httpFailureResult('patch-save', response, prepared.artifacts);
  const data = response.data;
  const savedEvidence = layoutResourceEvidence(data, prepared.pageLayout, options.pageId);
  const savedVersion = savedEvidence.versionToken;
  if (
    !isObject(data)
    || data.saved !== true
    || data.operationCount !== prepared.operations.length
    || data.operationsSha256 !== prepared.operationsSha256
    || data[prepared.pageLayout.candidateDigestField] !== options.expectedCandidateLayoutSha256
    || data[prepared.capability.compiledDigestField] !== report.evidence.compiledHtmlSha256
    || !savedVersion
    || !savedEvidence.validIdentity
    || !savedEvidence.validRepresentation
    || savedEvidence.declaredDigest !== options.expectedCandidateLayoutSha256
  ) {
    return createResult({
      ok: false, stage: 'patch-save', code: 'PATCH_SAVE_EVIDENCE_INVALID',
      artifacts: prepared.artifacts,
      nextAction: 'Inspect the saved page and Builder response; never repeat apply automatically.',
      message: 'Apply returned 2xx without complete evidence for the exact preflighted patch.',
      httpStatus: response.status,
      response: data,
    });
  }
  const savedLayoutSha256 = savedEvidence.declaredDigest;
  const readbackResponse = await request(options, authHeader, {
    method: prepared.pageLayout.readMethod,
    endpoint: prepared.pageLayout.endpoint,
  });
  if (!readbackResponse.ok) {
    return createResult({
      ok: false,
      stage: 'patch-save',
      code: 'PATCH_SAVE_READBACK_FAILED',
      artifacts: prepared.artifacts,
      nextAction: 'Inspect the page state manually. The patch succeeded but its canonical readback failed.',
      message: 'The canonical layout could not be read after patch apply.',
      httpStatus: readbackResponse.status,
      response: readbackResponse.reportResponse,
    });
  }
  const readbackEvidence = layoutResourceEvidence(
    readbackResponse.data,
    prepared.pageLayout,
    options.pageId
  );
  const readbackVersion = readbackEvidence.versionToken;
  const readbackLayoutSha256 = readbackEvidence.declaredDigest;
  if (
    !readbackEvidence.validIdentity
    || !readbackEvidence.validRepresentation
    || readbackVersion !== savedVersion
    || readbackLayoutSha256 !== savedLayoutSha256
  ) {
    return createResult({
      ok: false,
      stage: 'patch-save',
      code: 'PATCH_SAVE_READBACK_MISMATCH',
      artifacts: prepared.artifacts,
      nextAction: 'Inspect and reconcile the canonical page before another patch.',
      message: 'The patch readback does not match the saved representation and returned version.',
      httpStatus: readbackResponse.status,
      response: {
        expectedVersionToken: savedVersion,
        readbackVersionToken: readbackVersion,
        expectedSavedLayoutSha256: savedLayoutSha256,
        readbackLayoutSha256,
      },
    });
  }
  return createResult({
    ok: true, stage: 'patch-save', code: 'PATCH_SAVE_OK',
    artifacts: {
      ...prepared.artifacts,
      candidateLayoutSha256: data[prepared.pageLayout.candidateDigestField],
      compiledHtmlSha256: data[prepared.capability.compiledDigestField],
    },
    nextAction: 'Snapshot and inspect the canonical saved page.',
    httpStatus: response.status,
    response: data,
    scope: { site: options.site, pageId: options.pageId },
    layoutSha256: data[prepared.pageLayout.candidateDigestField],
    evidence: {
      site: options.site,
      pageId: options.pageId,
      publicPageUrl: prepared.snapshot.publicPageUrl,
      previousVersionToken: prepared.expectedVersionToken,
      previousLayoutSha256: prepared.expectedLayoutSha256,
      snapshotSha256: prepared.snapshotSha256,
      versionToken: savedVersion,
      versionAdvanced: savedVersion !== prepared.expectedVersionToken,
      layoutChanged: savedLayoutSha256 !== prepared.expectedLayoutSha256,
      operationsSha256: prepared.operationsSha256,
      candidateLayoutSha256: data[prepared.pageLayout.candidateDigestField],
      compiledHtmlSha256: data[prepared.capability.compiledDigestField],
      savedLayoutSha256,
      readbackLayoutSha256,
      versionField: prepared.pageLayout.versionField,
    },
  });
}

function findHtml(value) {
  if (!isObject(value)) return '';
  for (const candidate of [
    value.html,
    value.renderedHtml,
    value.rendered,
    value.data?.html,
    value.data?.renderedHtml,
  ]) {
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

function isRenderedHtml(value) {
  return typeof value === 'string'
    && /<(?:!doctype\s+html|html|body|main|header|footer|section|article|div|form)\b/i.test(value);
}

function previewSaveEvidence(saveReport, options, candidateSha256, artifacts) {
  const readbackLayout = saveReport?.evidence?.readbackLayout;
  const readbackNodeMap = (() => {
    try {
      return extractNodeMap(readbackLayout);
    } catch {
      return null;
    }
  })();
  const readbackLayoutSha256 = readbackNodeMap ? nodeMapSha256(readbackNodeMap) : '';
  const valid = isObject(saveReport)
    && saveReport.schemaVersion === SCHEMA_VERSION
    && saveReport.ok === true
    && saveReport.stage === 'save'
    && saveReport.code === 'SAVE_OK'
    && isObject(saveReport.scope)
    && typeof saveReport.scope.site === 'string'
    && Number.isSafeInteger(saveReport.scope.pageId)
    && /^[a-f0-9]{64}$/.test(saveReport.layoutSha256 || '')
    && (
      saveReport.artifacts?.layoutSha256 === undefined
      || saveReport.artifacts.layoutSha256 === saveReport.layoutSha256
    )
    && isFieldName(saveReport.evidence?.versionField)
    && typeof saveReport.evidence?.previousVersionToken === 'string'
    && saveReport.evidence.previousVersionToken !== ''
    && validSha(saveReport.evidence?.previousLayoutSha256)
    && typeof saveReport.evidence?.versionToken === 'string'
    && saveReport.evidence.versionToken !== ''
    && typeof saveReport.evidence?.versionAdvanced === 'boolean'
    && typeof saveReport.evidence?.layoutChanged === 'boolean'
    && saveReport.evidence.site === saveReport.scope.site
    && saveReport.evidence.pageId === saveReport.scope.pageId
    && saveReport.evidence.layoutSha256 === saveReport.layoutSha256
    && validSha(saveReport.evidence?.candidateLayoutSha256)
    && validSha(saveReport.evidence?.savedLayoutSha256)
    && saveReport.evidence.candidateLayoutSha256 === saveReport.evidence.savedLayoutSha256
    && saveReport.evidence?.readbackLayoutSha256 === saveReport.evidence.savedLayoutSha256
    && readbackLayoutSha256 === saveReport.evidence.readbackLayoutSha256
    && saveReport.evidence.versionAdvanced
      === (saveReport.evidence.versionToken !== saveReport.evidence.previousVersionToken)
    && saveReport.evidence.layoutChanged
      === (saveReport.evidence.savedLayoutSha256 !== saveReport.evidence.previousLayoutSha256)
    && saveReport.evidence?.validation?.valid === true
    && Array.isArray(saveReport.evidence?.validation?.lint);
  if (!valid) {
    return {
      failure: createResult({
        ok: false,
        stage: 'preview',
        code: 'SAVE_REPORT_INVALID',
        artifacts,
        nextAction: 'Repeat validate and save, then provide the resulting SAVE_OK report.',
        message: 'Save report does not contain valid scoped SAVE_OK evidence.',
        layoutSha256: candidateSha256,
      }),
    };
  }
  if (saveReport.scope.site !== options.site) {
    return {
      failure: createResult({
        ok: false,
        stage: 'preview',
        code: 'SAVE_REPORT_SCOPE_MISMATCH',
        artifacts,
        nextAction: 'Repeat validate and save against this exact site before preview.',
        message: 'Save report belongs to a different site; no preview request was sent.',
        scope: saveReport.scope,
        layoutSha256: candidateSha256,
      }),
    };
  }
  if (saveReport.layoutSha256 !== candidateSha256) {
    return {
      failure: createResult({
        ok: false,
        stage: 'preview',
        code: 'LAYOUT_SHA256_MISMATCH',
        artifacts,
        nextAction: 'Validate and save this exact layout again before preview.',
        message: 'Preview layout no longer matches the saved candidate; no preview request was sent.',
        scope: saveReport.scope,
        layoutSha256: candidateSha256,
        response: {
          savedLayoutSha256: saveReport.layoutSha256,
          previewLayoutSha256: candidateSha256,
        },
      }),
    };
  }
  const publicPageUrl = normalizePublicPageUrl(saveReport.evidence?.publicPageUrl, options.site);
  if (!publicPageUrl || publicPageUrl !== saveReport.evidence?.publicPageUrl) {
    return {
      failure: createResult({
        ok: false,
        stage: 'preview',
        code: 'SAVE_REPORT_PAGE_IDENTITY_MISSING',
        artifacts,
        nextAction: 'Create a fresh page-scoped snapshot and repeat validate/save before preview.',
        message: 'Save report does not bind the page ID to its WordPress public URL.',
        scope: saveReport.scope,
        layoutSha256: candidateSha256,
      }),
    };
  }
  return {
    evidence: {
      site: saveReport.scope.site,
      pageId: saveReport.scope.pageId,
      publicPageUrl,
      layoutSha256: candidateSha256,
      candidateLayoutSha256: saveReport.evidence.candidateLayoutSha256,
      savedLayoutSha256: saveReport.evidence.savedLayoutSha256,
      readbackLayoutSha256: saveReport.evidence.readbackLayoutSha256,
      versionField: saveReport.evidence.versionField,
      previousVersionToken: saveReport.evidence.previousVersionToken,
      previousLayoutSha256: saveReport.evidence.previousLayoutSha256,
      versionToken: saveReport.evidence.versionToken,
      versionAdvanced: saveReport.evidence.versionAdvanced,
      layoutChanged: saveReport.evidence.layoutChanged,
      validation: saveReport.evidence.validation,
      saveReport: options.saveReport,
    },
    nodeMap: readbackNodeMap,
    scope: {
      site: saveReport.scope.site,
      pageId: saveReport.scope.pageId,
    },
  };
}

async function runPreview(options, authHeader) {
  const nodeMap = await loadCandidate(options);
  const candidateSha256 = nodeMapSha256(nodeMap);
  const artifacts = {
    layout: options.layout,
    layoutSha256: candidateSha256,
    preview: options.out,
    report: options.reportOut,
    saveReport: options.saveReport,
  };
  const saveReport = await readJsonFile(options.saveReport, 'saveReport', 'preview');
  const savedEvidence = previewSaveEvidence(
    saveReport,
    options,
    candidateSha256,
    artifacts
  );
  if (savedEvidence.failure) return savedEvidence.failure;

  const discovered = await fetchLiveContract(options, authHeader, artifacts);
  if (discovered.failure) return discovered.failure;
  let capability;
  try {
    capability = previewCapability(
      discovered.contract,
      savedEvidence.scope.pageId,
      'preview'
    );
  } catch (error) {
    return resultFromError(error, 'preview');
  }

  const previewResponse = await request(options, authHeader, {
    method: capability.method,
    endpoint: capability.endpoint,
    body: {
      [capability.carrier]: savedEvidence.nodeMap,
      [capability.contextField]: savedEvidence.scope.pageId,
    },
    expectJson: false,
  });
  if (!previewResponse.ok) {
    return httpFailureResult('preview', previewResponse, artifacts);
  }

  const jsonHtml = findHtml(previewResponse.data);
  const html = jsonHtml || (previewResponse.data === undefined ? previewResponse.text : '');
  let result;
  if (isRenderedHtml(html)) {
    artifacts.previewLayoutSha256 = savedEvidence.evidence.readbackLayoutSha256;
    artifacts.format = 'html';
    result = createResult({
      ok: true,
      stage: 'preview',
      code: 'PREVIEW_OK',
      artifacts,
      nextAction: 'Open the preview artifact and inspect the canonical PHP-rendered output.',
      httpStatus: previewResponse.status,
      scope: savedEvidence.scope,
      layoutSha256: candidateSha256,
      evidence: savedEvidence.evidence,
    });
    await atomicWriteMany([{ target: options.out, content: redact(html, authHeader) }], 'preview');
  } else {
    artifacts.format = 'missing-html';
    result = createResult({
      ok: false,
      stage: 'preview',
      code: 'PREVIEW_HTML_MISSING',
      artifacts,
      nextAction: 'Fix the preview endpoint so it returns rendered WordPress/PHP HTML, then repeat preview.',
      message: 'The preview endpoint returned 2xx without a rendered HTML document or fragment.',
      httpStatus: previewResponse.status,
      response: previewResponse.data,
      scope: savedEvidence.scope,
      layoutSha256: candidateSha256,
      evidence: savedEvidence.evidence,
    });
  }
  return result;
}

function capabilitySuccess(options, code, {
  artifacts = {},
  response,
  evidence,
  message = 'The declared Monteby capability completed successfully.',
} = {}) {
  return createResult({
    ok: true,
    stage: options.command,
    code,
    artifacts,
    nextAction: 'Review the response artifact before starting another authoring operation.',
    message,
    response: response === undefined ? undefined : safeCapabilityOutput(response, options.command),
    evidence,
  });
}

function capabilityFailure(options, code, message, nextAction, artifacts = {}) {
  return createResult({
    ok: false,
    stage: options.command,
    code,
    artifacts,
    nextAction,
    message,
  });
}

function persistenceResource(contract, name, stage) {
  const resource = layoutPersistence(contract, stage).resources[name];
  if (!isObject(resource) || typeof resource.path !== 'string') {
    throw new ClientError(`The live contract does not publish the ${name} resource.`, {
      code: 'CAPABILITY_RESOURCE_MISSING',
      stage,
      nextAction: 'Upgrade or repair Builder. Do not infer an endpoint that the live contract omits.',
    });
  }
  return resource;
}

async function requestDeclared(options, authHeader, requestOptions) {
  return request(options, authHeader, { ...requestOptions, apiRoot: WP_JSON_ROOT });
}

async function readOptionalCache(file, stage) {
  if (!file) return { schemaVersion: 1, artifact: 'monteby-contract-cache', entries: {} };
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (
      parsed?.schemaVersion === 1
      && parsed?.artifact === 'monteby-contract-cache'
      && isObject(parsed.entries)
    ) {
      return parsed;
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { schemaVersion: 1, artifact: 'monteby-contract-cache', entries: {} };
    }
    if (!(error instanceof SyntaxError)) {
      throw new ClientError('The contract cache could not be read.', {
        code: 'INPUT_READ_FAILED',
        stage,
        artifacts: { cache: file },
        nextAction: 'Repair cache permissions or remove the cache and run contract-fetch again.',
      });
    }
  }
  throw new ClientError('The contract cache has an unsupported shape.', {
    code: 'INVALID_JSON_INPUT',
    stage,
    artifacts: { cache: file },
    nextAction: 'Remove the invalid cache and run contract-fetch again.',
  });
}

function contractCacheIdentity(options) {
  return {
    site: options.site,
    mode: options.mode,
    components: options.components,
    component: options.component,
  };
}

async function conditionalContractRequest(options, authHeader, endpoint) {
  const identity = contractCacheIdentity(options);
  const cacheKey = canonicalSha256(identity);
  const cache = await readOptionalCache(options.cache, options.command);
  const cached = isObject(cache.entries[cacheKey]) ? cache.entries[cacheKey] : null;
  const etag = typeof cached?.etag === 'string' && !/[\r\n]/u.test(cached.etag)
    ? cached.etag
    : '';
  const response = await requestDeclared(options, authHeader, {
    method: 'GET',
    endpoint,
    headers: etag ? { 'If-None-Match': etag } : {},
    allowNotModified: true,
  });
  if (response.status === 304) {
    if (!isObject(cached?.document)) {
      throw new ClientError('The server returned 304 without a matching cached contract.', {
        code: 'CONTRACT_CACHE_MISS',
        stage: options.command,
        nextAction: 'Remove the stale cache and fetch the contract without an If-None-Match validator.',
      });
    }
    return { document: cached.document, etag, cacheKey, cache, notModified: true };
  }
  if (!response.ok) return { failure: httpFailureResult(options.command, response, {}) };
  if (!isObject(response.data)) {
    throw new ClientError('The contract resource did not return a JSON object.', {
      code: 'CONTRACT_INVALID',
      stage: options.command,
      nextAction: 'Repair the live contract response before using it for authoring.',
    });
  }
  const nextCache = {
    ...cache,
    entries: {
      ...cache.entries,
      [cacheKey]: {
        identity,
        etag: response.etag,
        document: response.data,
      },
    },
  };
  return {
    document: response.data,
    etag: response.etag,
    cacheKey,
    cache: nextCache,
    notModified: false,
  };
}

async function persistValidatedContractCache(options, fetched) {
  if (options.cache && !fetched.notModified) {
    await atomicWriteJson(options.cache, fetched.cache, options.command);
  }
}

function requireContractFeature(contract, featureName, stage) {
  const gate = evaluateFeatureGate(contract, featureName, compatibilityManifest);
  if (!gate.ok) {
    throw new ClientError(gate.message || `The live contract does not advertise ${featureName}.`, {
      code: gate.code,
      stage,
      nextAction: gate.code === 'blocked_plugin_version'
        ? 'Upgrade Monteby Builder before requesting this contract capability.'
        : 'Discard the response and repair the advertised Site Contract capability.',
    });
  }
}

function validateContractProjection(document, options) {
  const declaredMode = document.mode || 'full';
  if (declaredMode !== options.mode) {
    throw new ClientError('The returned contract projection does not match the requested mode.', {
      code: 'CONTRACT_SCOPE_MISMATCH',
      stage: options.command,
      nextAction: 'Repair the projection response and discard the mismatched contract.',
    });
  }

  const projectionFeatures = {
    light: 'contractLightProjection',
    design: 'contractDesignProjection',
    authoring: 'contractAuthoringProjection',
    catalogs: 'contractCatalogsProjection',
  };
  const projectionFeature = projectionFeatures[options.mode];
  if (projectionFeature) requireContractFeature(document, projectionFeature, options.command);

  if (options.mode === 'authoring' || options.components === 'summary') {
    if (document.componentsMode !== options.components) {
      throw new ClientError('The returned component projection does not match the requested components mode.', {
        code: 'CONTRACT_SCOPE_MISMATCH',
        stage: options.command,
        nextAction: 'Discard the response and request the exact full or summary component projection again.',
      });
    }
    if (options.components === 'summary') {
      requireContractFeature(document, 'contractComponentsSummary', options.command);
    }
  }
}

async function runContractFetch(options, authHeader) {
  if (options.component) {
    const discovered = await fetchLiveContract(options, authHeader);
    if (discovered.failure) return discovered.failure;
    requireContractFeature(discovered.contract, 'contractComponent', options.command);
    const resource = persistenceResource(discovered.contract, 'contractComponent', options.command);
    if (resource.method !== 'GET' || resource.nameField !== 'name') {
      throw new ClientError('The component resource descriptor is unsupported.', {
        code: 'CAPABILITY_RESOURCE_INVALID',
        stage: options.command,
        nextAction: 'Repair the component descriptor instead of guessing its route or identity field.',
      });
    }
    const endpoint = declaredResourcePath(resource.path, { name: options.component }, options.command);
    const fetched = await conditionalContractRequest(options, authHeader, endpoint);
    if (fetched.failure) return fetched.failure;
    if (fetched.document?.component?.name !== options.component) {
      throw new ClientError('The hydrated component identity does not match the requested component.', {
        code: 'CONTRACT_COMPONENT_SCOPE_MISMATCH',
        stage: options.command,
        nextAction: 'Repair the component resource and discard this response.',
      });
    }
    safeCapabilityOutput(fetched.document, options.command);
    await persistValidatedContractCache(options, fetched);
    return capabilitySuccess(options, 'CONTRACT_COMPONENT_OK', {
      artifacts: options.cache ? { cache: options.cache } : {},
      response: fetched.document,
      evidence: { etag: fetched.etag, notModified: fetched.notModified, component: options.component },
      message: 'The exact published component contract was hydrated successfully.',
    });
  }

  const parameters = new URLSearchParams({ mode: options.mode, components: options.components });
  const fetched = await conditionalContractRequest(
    options,
    authHeader,
    `${REST_NAMESPACE}${CONTRACT_ENDPOINT}?${parameters.toString()}`
  );
  if (fetched.failure) return fetched.failure;
  validateContractProjection(fetched.document, options);
  safeCapabilityOutput(fetched.document, options.command);
  await persistValidatedContractCache(options, fetched);
  return capabilitySuccess(options, 'CONTRACT_FETCH_OK', {
    artifacts: options.cache ? { cache: options.cache } : {},
    response: fetched.document,
    evidence: {
      etag: fetched.etag,
      notModified: fetched.notModified,
      mode: options.mode,
      components: options.components,
    },
    message: 'The requested Site Contract projection was fetched successfully.',
  });
}

async function fullContractForCapability(options, authHeader) {
  const fetched = await fetchLiveContract(options, authHeader);
  if (fetched.failure) return fetched;
  if (!isObject(fetched.contract.layoutPersistence)) {
    throw new ClientError('The full live contract omits layout persistence.', {
      code: 'LAYOUT_PERSISTENCE_MISSING',
      stage: options.command,
      nextAction: 'Upgrade or repair Builder before invoking authoring resources.',
    });
  }
  return fetched;
}

const DOCUMENT_TYPES = new Set(['page', 'header', 'footer', 'template']);
const LAYOUT_STATES = new Set(['stored', 'corrupt', 'classic', 'empty']);
const PAGE_PRESENTATION_LAYOUTS = new Set(['', ...PRESENTATION_LAYOUTS]);

function validateDocumentSummary(document, stage, label) {
  const fields = [
    'id', 'title', 'slug', 'postType', 'documentType', 'status', 'url', 'editUrl',
    'hasLayout', 'layoutState', 'postModifiedGmt',
  ];
  assertExactFields(document, fields, stage, label, 'CAPABILITY_RESPONSE_INVALID');
  const layoutOwnsJson = document.layoutState === 'stored' || document.layoutState === 'corrupt';
  if (
    !fields.every((field) => Object.hasOwn(document, field))
    || !Number.isSafeInteger(document.id) || document.id < 1
    || typeof document.title !== 'string'
    || typeof document.slug !== 'string'
    || typeof document.postType !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/u.test(document.postType)
    || !DOCUMENT_TYPES.has(document.documentType)
    || typeof document.status !== 'string' || document.status === ''
    || typeof document.url !== 'string'
    || typeof document.editUrl !== 'string' || document.editUrl === ''
    || typeof document.hasLayout !== 'boolean'
    || !LAYOUT_STATES.has(document.layoutState)
    || document.hasLayout !== layoutOwnsJson
    || typeof document.postModifiedGmt !== 'string' || document.postModifiedGmt === ''
  ) {
    throw new ClientError(`${label} does not match the published document summary.`, {
      code: 'CAPABILITY_RESPONSE_INVALID',
      stage,
      nextAction: 'Repair the Builder document projection before using it for authoring.',
    });
  }
}

function validatePageContextDocument(document, pageId, stage) {
  const fields = [
    'postId', 'postType', 'documentType', 'title', 'slug', 'status', 'viewUrl',
    'editUrl', 'hasLayout', 'layoutState', 'nodeCount', 'postModifiedGmt',
    'presentation', 'effectiveLayout', 'headerPostId', 'footerPostId',
  ];
  assertExactFields(document, fields, stage, 'page-context response', 'CAPABILITY_RESPONSE_INVALID');
  const summary = {
    id: document.postId,
    title: document.title,
    slug: document.slug,
    postType: document.postType,
    documentType: document.documentType,
    status: document.status,
    url: document.viewUrl,
    editUrl: document.editUrl,
    hasLayout: document.hasLayout,
    layoutState: document.layoutState,
    postModifiedGmt: document.postModifiedGmt,
  };
  validateDocumentSummary(summary, stage, 'page-context document');
  assertExactFields(
    document.presentation,
    ['layout', 'disableGlobalTemplates'],
    stage,
    'page-context presentation',
    'CAPABILITY_RESPONSE_INVALID'
  );
  if (
    !fields.every((field) => Object.hasOwn(document, field))
    || document.postId !== pageId
    || !Number.isSafeInteger(document.nodeCount) || document.nodeCount < 0
    || (!document.hasLayout && document.nodeCount !== 0)
    || !Object.hasOwn(document.presentation, 'layout')
    || !Object.hasOwn(document.presentation, 'disableGlobalTemplates')
    || !PAGE_PRESENTATION_LAYOUTS.has(document.presentation.layout)
    || typeof document.presentation.disableGlobalTemplates !== 'boolean'
    || typeof document.effectiveLayout !== 'string' || document.effectiveLayout === ''
    || !Number.isSafeInteger(document.headerPostId) || document.headerPostId < 0
    || !Number.isSafeInteger(document.footerPostId) || document.footerPostId < 0
  ) {
    throw new ClientError('The page-context response is incomplete or internally inconsistent.', {
      code: 'CAPABILITY_RESPONSE_INVALID',
      stage,
      nextAction: 'Discard the response and repair the Builder page-context projection.',
    });
  }
}

async function fetchPageContext(options, authHeader, contract, pageId) {
  const resource = persistenceResource(contract, 'pageContext', options.command);
  if (resource.method !== 'GET' || resource.postIdField !== 'postId') {
    throw new ClientError('The page-context descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage: options.command,
      nextAction: 'Repair the page-context descriptor. Do not infer its route.',
    });
  }
  const endpoint = declaredResourcePath(resource.path, { postId: pageId }, options.command);
  const response = await requestDeclared(options, authHeader, { method: resource.method, endpoint });
  if (!response.ok) return { failure: httpFailureResult(options.command, response, {}) };
  validatePageContextDocument(response.data, pageId, options.command);
  return { document: response.data };
}

async function runPageContext(options, authHeader) {
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const context = await fetchPageContext(options, authHeader, fetched.contract, options.pageId);
  if (context.failure) return context.failure;
  return capabilitySuccess(options, 'PAGE_CONTEXT_OK', {
    response: context.document,
    evidence: { pageId: options.pageId, postModifiedGmt: context.document.postModifiedGmt },
    message: 'The exact document context was read from its declared resource.',
  });
}

function validateCollectionQuery(query, allowedFields, stage, label) {
  assertExactFields(query, allowedFields, stage, 'query');
  if (
    Object.hasOwn(query, 'hasLayout') && typeof query.hasLayout !== 'boolean'
    || Object.hasOwn(query, 'postType') && (
      typeof query.postType !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/u.test(query.postType)
    )
    || Object.hasOwn(query, 'page') && (!Number.isSafeInteger(query.page) || query.page < 1)
    || Object.hasOwn(query, 'perPage') && (
      !Number.isSafeInteger(query.perPage) || query.perPage < 1 || query.perPage > 100
    )
  ) {
    throw new ClientError(`The ${label} query has invalid values.`, {
      code: 'CAPABILITY_INPUT_INVALID',
      stage,
      nextAction: allowedFields.includes('postType')
        ? 'Use a boolean hasLayout, a public postType slug, page >= 1 and perPage between 1 and 100.'
        : 'Use page >= 1 and perPage between 1 and 100.',
    });
  }
}

async function runDocumentsList(options, authHeader) {
  const query = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const resource = persistenceResource(fetched.contract, 'documents', options.command);
  if (resource.method !== 'GET' || !Array.isArray(resource.queryFields)) {
    throw new ClientError('The documents descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage: options.command,
      nextAction: 'Repair the documents descriptor. Do not guess query fields.',
    });
  }
  validateCollectionQuery(query, resource.queryFields, options.command, 'document-list');
  const endpoint = queryEndpoint(resource.path, query, resource.queryFields, options.command);
  const response = await requestDeclared(options, authHeader, { method: resource.method, endpoint });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  const document = response.data;
  if (
    !isObject(document)
    || !Array.isArray(document.items)
    || !Number.isSafeInteger(document.page) || document.page < 1
    || !Number.isSafeInteger(document.perPage) || document.perPage < 1 || document.perPage > 100
    || !Number.isSafeInteger(document.total) || document.total < 0
    || !Number.isSafeInteger(document.totalPages) || document.totalPages < 0
  ) {
    throw new ClientError('The documents resource returned an invalid collection.', {
      code: 'CAPABILITY_RESPONSE_INVALID',
      stage: options.command,
      nextAction: 'Repair the Builder response before using it for authoring.',
    });
  }
  assertExactFields(
    document,
    ['items', 'page', 'perPage', 'total', 'totalPages'],
    options.command,
    'documents response',
    'CAPABILITY_RESPONSE_INVALID'
  );
  document.items.forEach((item, index) => (
    validateDocumentSummary(item, options.command, `documents.items[${index}]`)
  ));
  const expectedPage = Object.hasOwn(query, 'page') ? query.page : 1;
  const expectedPerPage = Object.hasOwn(query, 'perPage') ? query.perPage : 50;
  const expectedTotalPages = document.total === 0 ? 0 : Math.ceil(document.total / document.perPage);
  const ids = document.items.map((item) => item.id);
  if (
    document.page !== expectedPage
    || document.perPage !== expectedPerPage
    || document.totalPages !== expectedTotalPages
    || document.items.length > document.perPage
    || new Set(ids).size !== ids.length
    || Object.hasOwn(query, 'postType') && document.items.some((item) => item.postType !== query.postType)
    || query.hasLayout === true && document.items.some((item) => item.hasLayout !== true)
  ) {
    throw new ClientError('The documents collection does not match its requested scope or pagination.', {
      code: 'CAPABILITY_SCOPE_MISMATCH',
      stage: options.command,
      nextAction: 'Discard the collection and repair the Builder document-list resource.',
    });
  }
  return capabilitySuccess(options, 'DOCUMENTS_LIST_OK', {
    artifacts: { input: options.input },
    response: response.data,
    evidence: {
      count: document.items.length,
      page: document.page,
      total: document.total,
    },
    message: 'The authorable document collection was read successfully.',
  });
}

async function runRevisionList(options, authHeader) {
  const query = options.input ? await loadCapabilityInput(options) : {};
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const resource = persistenceResource(fetched.contract, 'revisions', options.command);
  if (resource.method !== 'GET' || !Array.isArray(resource.queryFields)) {
    throw new ClientError('The revisions descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage: options.command,
      nextAction: 'Repair the revisions descriptor. Do not guess its route or query fields.',
    });
  }
  validateCollectionQuery(query, resource.queryFields, options.command, 'revision-list');
  const endpoint = queryEndpoint(
    resource.path,
    query,
    resource.queryFields,
    options.command,
    { postId: options.pageId }
  );
  const response = await requestDeclared(options, authHeader, { method: resource.method, endpoint });
  if (!response.ok) {
    return httpFailureResult(
      options.command,
      response,
      options.input ? { input: options.input } : {}
    );
  }
  const document = revisionCollectionDocument(response.data, options.command);
  return capabilitySuccess(options, 'REVISION_LIST_OK', {
    artifacts: options.input ? { input: options.input } : {},
    response: document,
    evidence: {
      pageId: options.pageId,
      count: document.items.length,
      page: document.page,
      total: document.total,
      currentPostModifiedGmt: document.currentPostModifiedGmt,
      currentLayoutSha256: document.currentLayoutSha256,
      currentDocumentSha256: document.currentDocumentSha256,
    },
    message: 'The exact revision inventory was read without exposing revision content.',
  });
}

function revisionCollectionDocument(document, stage) {
  const validItems = Array.isArray(document?.items) && document.items.every((item) => (
    isObject(item)
    && Number.isSafeInteger(item.revisionId) && item.revisionId > 0
    && typeof item.title === 'string'
    && Number.isSafeInteger(item.authorId) && item.authorId >= 0
    && typeof item.createdGmt === 'string'
    && typeof item.modifiedGmt === 'string'
    && typeof item.hasLayout === 'boolean'
    && (
      item.hasLayout
        ? validSha(item.layoutSha256)
        : item.layoutSha256 === null
    )
  ));
  if (
    !isObject(document)
    || !validItems
    || !Number.isSafeInteger(document.page) || document.page < 1
    || !Number.isSafeInteger(document.perPage) || document.perPage < 1 || document.perPage > 100
    || !Number.isSafeInteger(document.total) || document.total < 0
    || !Number.isSafeInteger(document.totalPages) || document.totalPages < 0
    || typeof document.currentPostModifiedGmt !== 'string'
    || document.currentPostModifiedGmt === ''
    || !validSha(document.currentLayoutSha256)
    || !validSha(document.currentDocumentSha256)
  ) {
    throw new ClientError('The revisions resource returned an invalid collection.', {
      code: 'CAPABILITY_RESPONSE_INVALID',
      stage,
      nextAction: 'Repair the Builder revision collection before choosing a restore target.',
    });
  }
  return document;
}

async function runRevisionRestore(options, authHeader) {
  const input = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const resource = persistenceResource(fetched.contract, 'restoreRevision', options.command);
  if (
    resource.method !== 'POST'
    || !isFieldName(resource.revisionField)
    || resource.carrier !== resource.revisionField
    || !isFieldName(resource.writePreconditionField)
    || !isFieldName(resource.digestField)
    || !isFieldName(resource.writeDigestPreconditionField)
    || new Set([
      resource.revisionField,
      resource.writePreconditionField,
      resource.digestField,
      resource.writeDigestPreconditionField,
    ]).size !== 4
  ) {
    throw new ClientError('The revision-restore descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage: options.command,
      nextAction: 'Repair the restore descriptor. Do not infer revision or precondition fields.',
    });
  }
  assertExactFields(
    input,
    [
      resource.revisionField,
      resource.writePreconditionField,
      resource.writeDigestPreconditionField,
    ],
    options.command,
    'restore input'
  );
  if (
    !Number.isSafeInteger(input[resource.revisionField])
    || input[resource.revisionField] < 1
    || typeof input[resource.writePreconditionField] !== 'string'
    || input[resource.writePreconditionField].trim() === ''
    || !validSha(input[resource.writeDigestPreconditionField])
  ) {
    throw new ClientError('Revision restore requires a positive revision ID plus version and document-digest preconditions.', {
      code: 'CAPABILITY_INPUT_INVALID',
      stage: options.command,
      nextAction: 'Use a revisionId previously reported by Builder plus fresh currentPostModifiedGmt and currentDocumentSha256 values.',
    });
  }
  const revisions = persistenceResource(fetched.contract, 'revisions', options.command);
  if (revisions.method !== 'GET' || !Array.isArray(revisions.queryFields)) {
    throw new ClientError('The revisions descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID',
      stage: options.command,
      nextAction: 'Repair the revisions descriptor before restoring. Do not infer the document digest.',
    });
  }
  const revisionsEndpoint = declaredResourcePath(
    revisions.path,
    { postId: options.pageId },
    options.command
  );
  const beforeRevisionsResponse = await requestDeclared(options, authHeader, {
    method: revisions.method,
    endpoint: revisionsEndpoint,
  });
  if (!beforeRevisionsResponse.ok) {
    return httpFailureResult(options.command, beforeRevisionsResponse, { input: options.input });
  }
  const beforeRevisions = revisionCollectionDocument(
    beforeRevisionsResponse.data,
    options.command
  );
  if (
    beforeRevisions.currentPostModifiedGmt !== input[resource.writePreconditionField]
    || beforeRevisions.currentDocumentSha256 !== input[resource.writeDigestPreconditionField]
  ) {
    return capabilityFailure(
      options,
      'REST_CONFLICT',
      'A restore precondition is stale before the write.',
      'Fetch the revision inventory again, reconcile the revision choice, and issue one new explicit restore.',
      { input: options.input }
    );
  }
  const page = pageLayoutCapability(fetched.contract, options.pageId, options.command);
  const currentResponse = await request(options, authHeader, {
    method: page.readMethod,
    endpoint: page.endpoint,
  });
  if (!currentResponse.ok) {
    return httpFailureResult(options.command, currentResponse, { input: options.input });
  }
  const current = layoutResourceEvidence(currentResponse.data, page, options.pageId);
  if (
    !current.validIdentity
    || !current.validRepresentation
    || !current.validSettingsDigest
    || !current.versionToken
  ) {
    throw new ClientError('The current layout cannot prove the restore preconditions.', {
      code: 'CAPABILITY_RESPONSE_INVALID',
      stage: options.command,
      nextAction: 'Repair the canonical page-layout response before restoring a revision.',
    });
  }
  if (
    current.versionToken !== input[resource.writePreconditionField]
    || current.versionToken !== beforeRevisions.currentPostModifiedGmt
    || current.declaredDigest !== beforeRevisions.currentLayoutSha256
  ) {
    return capabilityFailure(
      options,
      'REST_CONFLICT',
      'A restore precondition is stale before the write.',
      'Fetch the current document context, reconcile the revision choice, and issue one new explicit restore.',
      { input: options.input }
    );
  }

  const endpoint = declaredResourcePath(resource.path, { postId: options.pageId }, options.command);
  const response = await requestDeclared(options, authHeader, {
    method: resource.method,
    endpoint,
    body: input,
    mutation: true,
  });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  if (
    !isObject(response.data)
    || response.data.id !== options.pageId
    || response.data.restored !== true
    || response.data.revisionId !== input[resource.revisionField]
    || !validSha(response.data[resource.digestField])
    || !validSha(response.data.layoutSha256)
    || typeof response.data.postModifiedGmt !== 'string'
    || response.data.postModifiedGmt.trim() === ''
  ) {
    throw new ClientError('The revision write returned incomplete or mismatched evidence.', {
      code: 'CAPABILITY_WRITE_UNPROVEN',
      stage: options.command,
      nextAction: 'Do not retry automatically. Read the current layout and reconcile the uncertain restore.',
    });
  }

  const readback = await request(options, authHeader, { method: page.readMethod, endpoint: page.endpoint });
  if (!readback.ok) {
    return capabilityFailure(
      options,
      'CAPABILITY_WRITE_UNPROVEN',
      'The restore succeeded but canonical readback failed.',
      'Do not repeat the restore. Snapshot the page and reconcile the uncertain write.',
      { input: options.input }
    );
  }
  const restoredLayout = extractNodeMap(response.data.layout);
  const restoredLayoutSha256 = nodeMapSha256(restoredLayout);
  const readbackEvidence = layoutResourceEvidence(readback.data, page, options.pageId);
  const afterRevisionsResponse = await requestDeclared(options, authHeader, {
    method: revisions.method,
    endpoint: revisionsEndpoint,
  });
  if (!afterRevisionsResponse.ok) {
    return capabilityFailure(
      options,
      'CAPABILITY_WRITE_UNPROVEN',
      'The restore succeeded but its document-digest readback failed.',
      'Do not repeat the restore. Read the revision inventory and reconcile the uncertain write.',
      { input: options.input }
    );
  }
  const afterRevisions = revisionCollectionDocument(afterRevisionsResponse.data, options.command);
  if (
    response.data.layoutSha256 !== restoredLayoutSha256
    || !readbackEvidence.validIdentity
    || !readbackEvidence.validRepresentation
    || !readbackEvidence.validSettingsDigest
    || readbackEvidence.declaredDigest !== restoredLayoutSha256
    || response.data.postModifiedGmt !== readbackEvidence.versionToken
    || afterRevisions.currentPostModifiedGmt !== readbackEvidence.versionToken
    || afterRevisions.currentLayoutSha256 !== readbackEvidence.declaredDigest
    || afterRevisions.currentDocumentSha256 !== response.data[resource.digestField]
  ) {
    return capabilityFailure(
      options,
      'CAPABILITY_WRITE_UNPROVEN',
      'Canonical readback does not match the restored representation.',
      'Do not repeat the restore. Reconcile the current canonical layout manually.',
      { input: options.input }
    );
  }
  return capabilitySuccess(options, 'REVISION_RESTORE_OK', {
    artifacts: { input: options.input },
    response: response.data,
    evidence: {
      pageId: options.pageId,
      revisionId: input[resource.revisionField],
      previousDocumentSha256: beforeRevisions.currentDocumentSha256,
      documentSha256: afterRevisions.currentDocumentSha256,
      previousLayoutSha256: current.declaredDigest,
      layoutSha256: readbackEvidence.declaredDigest,
      postModifiedGmt: readbackEvidence.versionToken,
    },
    message: 'The selected revision was restored and its canonical layout read back successfully.',
  });
}

function validatePreviewInput(input, contract, stage) {
  const allowed = [
    'layout', 'postId', 'nodeId', 'annotateNodeIds', 'assets', 'document',
    'globalTemplates', 'templateCandidates', 'globalStyles',
  ];
  assertExactFields(input, allowed, stage, 'preview input');
  extractNodeMap(input.layout);
  if (Object.hasOwn(input, 'postId') && (!Number.isSafeInteger(input.postId) || input.postId < 1)) {
    throw new ClientError('preview postId must be a positive integer.', {
      code: 'CAPABILITY_INPUT_INVALID', stage,
      nextAction: 'Use a document ID returned by the document-list or page-context resource.',
    });
  }
  if (Object.hasOwn(input, 'nodeId') && (
    typeof input.nodeId !== 'string' || input.nodeId === '' || input.nodeId === 'ROOT'
  )) {
    throw new ClientError('preview nodeId must name a non-root node.', {
      code: 'CAPABILITY_INPUT_INVALID', stage,
      nextAction: 'Use an exact non-ROOT node ID from the candidate layout.',
    });
  }
  for (const field of ['annotateNodeIds', 'assets', 'document', 'globalTemplates']) {
    if (Object.hasOwn(input, field) && typeof input[field] !== 'boolean') {
      throw new ClientError(`${field} must be boolean.`, {
        code: 'CAPABILITY_INPUT_INVALID', stage,
        nextAction: 'Use explicit JSON booleans for preview switches.',
      });
    }
  }
  if (input.globalTemplates === true && input.document !== true) {
    throw new ClientError('globalTemplates requires document: true.', {
      code: 'CAPABILITY_INPUT_INVALID', stage,
      nextAction: 'Enable the document preview before adding global templates.',
    });
  }
  const capabilities = contract?.authoring?.capabilities;
  if (input.annotateNodeIds === true && capabilities?.annotatedRender !== true) {
    throw new ClientError('Annotated rendering is not advertised by the live contract.', {
      code: 'CAPABILITY_NOT_ADVERTISED', stage,
      nextAction: 'Upgrade Builder or preview without node annotations.',
    });
  }
  if (input.globalTemplates === true && capabilities?.previewGlobalTemplates !== true) {
    throw new ClientError('Global-template preview is not advertised by the live contract.', {
      code: 'CAPABILITY_NOT_ADVERTISED', stage,
      nextAction: 'Upgrade Builder or preview the document without site chrome.',
    });
  }
  if (Object.hasOwn(input, 'templateCandidates')) {
    if (
      input.document !== true
      || input.globalTemplates !== true
      || capabilities?.previewVirtualGlobalTemplates !== true
    ) {
      throw new ClientError('Virtual template candidates require the advertised document/chrome capability.', {
        code: 'CAPABILITY_NOT_ADVERTISED', stage,
        nextAction: 'Enable document and globalTemplates on a Builder that advertises virtual template preview.',
      });
    }
    assertExactFields(input.templateCandidates, ['header', 'footer'], stage, 'templateCandidates');
    if (Object.keys(input.templateCandidates).length === 0) {
      throw new ClientError('templateCandidates must include a header or footer layout.', {
        code: 'CAPABILITY_INPUT_INVALID', stage,
        nextAction: 'Provide at least one candidate template node map.',
      });
    }
    for (const candidate of Object.values(input.templateCandidates)) extractNodeMap(candidate);
  }
  if (Object.hasOwn(input, 'globalStyles')) {
    if (capabilities?.renderGlobalStylesFilter !== true) {
      throw new ClientError('Global-style preview is not advertised by the live contract.', {
        code: 'CAPABILITY_NOT_ADVERTISED', stage,
        nextAction: 'Upgrade Builder or remove the globalStyles preview candidate.',
      });
    }
    assertExactFields(input.globalStyles, ['colors', 'typography'], stage, 'globalStyles');
    if (Object.keys(input.globalStyles).length === 0) {
      throw new ClientError('globalStyles must change colors or typography.', {
        code: 'CAPABILITY_INPUT_INVALID', stage,
        nextAction: 'Provide a bounded colors and/or typography patch.',
      });
    }
  }
}

async function runPreviewResource(options, authHeader) {
  const input = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  validatePreviewInput(input, fetched.contract, options.command);
  const resource = persistenceResource(fetched.contract, 'preview', options.command);
  const persistence = layoutPersistence(fetched.contract, options.command);
  if (
    resource.method !== 'POST'
    || !isFieldName(resource.carrier)
    || !isFieldName(persistence.previewContextField)
  ) {
    throw new ClientError('The preview descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID', stage: options.command,
      nextAction: 'Repair the preview descriptor instead of guessing its payload carrier.',
    });
  }
  const body = {
    ...input,
    [resource.carrier]: extractNodeMap(input.layout),
  };
  delete body.layout;
  if (Object.hasOwn(body, 'postId') && persistence.previewContextField !== 'postId') {
    body[persistence.previewContextField] = body.postId;
    delete body.postId;
  }
  if (isObject(body.templateCandidates)) {
    body.templateCandidates = Object.fromEntries(
      Object.entries(body.templateCandidates).map(([role, candidate]) => [role, extractNodeMap(candidate)])
    );
  }
  const endpoint = declaredResourcePath(resource.path, {}, options.command);
  const response = await requestDeclared(options, authHeader, {
    method: resource.method,
    endpoint,
    body,
  });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  if (
    !isObject(response.data)
    || response.data.valid !== true
    || typeof response.data.html !== 'string'
    || response.data.html === ''
    || input.document === true && (
      typeof response.data.document !== 'string'
      || response.data.document === ''
      || !response.data.document.includes(response.data.html)
    )
  ) {
    throw new ClientError('The preview resource did not return a valid candidate-bound render.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the preview response so it proves valid, fragment and requested document output before treating it as render evidence.',
    });
  }
  if (input.assets === true && (
    !isObject(response.data.assets)
    || !Array.isArray(response.data.assets.styles)
    || typeof response.data.assets.inlineCss !== 'string'
    || !Array.isArray(response.data.assets.scripts)
  )) {
    throw new ClientError('The preview resource omitted the requested asset profile.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the Builder preview response before using its render as canonical evidence.',
    });
  }
  if (input.globalTemplates === true && (
    !isObject(response.data.globalTemplates)
    || !Number.isSafeInteger(response.data.globalTemplates.header)
    || response.data.globalTemplates.header < 0
    || !Number.isSafeInteger(response.data.globalTemplates.footer)
    || response.data.globalTemplates.footer < 0
    || typeof response.data.globalTemplates.disabledByPresentation !== 'boolean'
    || Object.hasOwn(input, 'templateCandidates') && (
      !Array.isArray(response.data.globalTemplates.candidateRoles)
      || response.data.globalTemplates.candidateRoles.some((role) => !Object.hasOwn(input.templateCandidates, role))
    )
  )) {
    throw new ClientError('The preview resource omitted or mismatched the requested global-template proof.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the Builder preview response before using its site-chrome render as evidence.',
    });
  }
  const extension = path.extname(options.out);
  const previewBase = path.join(path.dirname(options.out), path.basename(options.out, extension));
  const previewFile = path.join(
    path.dirname(options.out), `${path.basename(options.out, extension)}-preview.html`
  );
  const documentFile = input.document === true ? `${previewBase}-document.html` : '';
  const outputWrites = [{ target: previewFile, content: redact(response.data.html, authHeader) }];
  if (documentFile) {
    outputWrites.push({ target: documentFile, content: redact(response.data.document, authHeader) });
  }
  await atomicWriteMany(outputWrites, options.command);
  const responseWithoutHtml = { ...response.data };
  delete responseWithoutHtml.html;
  delete responseWithoutHtml.document;
  const inputLayoutSha256 = nodeMapSha256(body[resource.carrier]);
  const inputSha256 = canonicalSha256(body);
  const outputHtmlSha256 = createHash('sha256').update(response.data.html, 'utf8').digest('hex');
  const documentSha256 = documentFile
    ? createHash('sha256').update(response.data.document, 'utf8').digest('hex')
    : '';
  return capabilitySuccess(options, 'PREVIEW_RESOURCE_OK', {
    artifacts: {
      input: options.input,
      preview: previewFile,
      ...(documentFile ? { document: documentFile } : {}),
    },
    response: responseWithoutHtml,
    evidence: {
      inputSha256,
      inputLayoutSha256,
      htmlSha256: outputHtmlSha256,
      outputHtmlSha256,
      ...(documentSha256 ? { documentSha256 } : {}),
      ...(isObject(body.globalStyles)
        ? { globalStylesSha256: canonicalSha256(body.globalStyles) }
        : {}),
      ...(isObject(body.templateCandidates)
        ? { templateCandidatesSha256: canonicalSha256(body.templateCandidates) }
        : {}),
      htmlBytes: Buffer.byteLength(response.data.html, 'utf8'),
      postId: input.postId || 0,
      nodeId: input.nodeId || '',
      document: input.document === true,
      globalTemplates: input.globalTemplates === true,
    },
    message: 'The candidate was rendered through the declared WordPress/PHP preview resource.',
  });
}

async function runBulkCreate(options, authHeader) {
  const input = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const resource = persistenceResource(fetched.contract, 'bulkCreate', options.command);
  if (
    resource.method !== 'POST'
    || !isFieldName(resource.carrier)
    || !isFieldName(resource.idempotencyField)
    || !isFieldName(resource.payloadDigestField)
    || !Array.isArray(resource.itemFields)
    || !Number.isSafeInteger(resource.maxItems)
    || resource.maxItems < 1
    || resource.replayMode !== 'durable-payload-bound'
    || !Number.isSafeInteger(resource.idempotencyTtlSeconds)
    || resource.idempotencyTtlSeconds < 1
    || resource.retryAfterUncertainOutcome !== false
  ) {
    throw new ClientError('The bulk-create descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID', stage: options.command,
      nextAction: 'Repair the bulk-create descriptor. Do not guess its carrier or idempotency field.',
    });
  }
  assertExactFields(input, [resource.carrier, resource.idempotencyField], options.command, 'bulk input');
  const requestId = input[resource.idempotencyField];
  const items = input[resource.carrier];
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(requestId)) {
    throw new ClientError('Bulk create requires a stable requestId.', {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Generate one 1-64 character requestId and reuse it only to resolve this exact uncertain request.',
    });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > resource.maxItems) {
    throw new ClientError(`Bulk create requires 1-${resource.maxItems} items.`, {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Split the request into bounded, independently identified batches.',
    });
  }
  items.forEach((item, index) => assertExactFields(
    item,
    resource.itemFields,
    options.command,
    `items[${index}]`
  ));
  const payloadSha256 = canonicalSha256(items);
  const endpoint = declaredResourcePath(resource.path, {}, options.command);
  const response = await requestDeclared(options, authHeader, {
    method: resource.method,
    endpoint,
    body: input,
    mutation: true,
  });
  if (!response.ok) {
    if (
      isObject(response.data)
      && (
        Object.hasOwn(response.data, 'requestId')
        || Object.hasOwn(response.data, resource.payloadDigestField)
      )
      && (
        response.data.requestId !== requestId
        || response.data[resource.payloadDigestField] !== payloadSha256
      )
    ) {
      throw new ClientError('The bulk failure response belongs to another request payload.', {
        code: 'CAPABILITY_WRITE_UNPROVEN', stage: options.command,
        artifacts: { input: options.input, requestId, payloadSha256 },
        nextAction: 'List documents and reconcile the exact requestId and payload before any further mutation.',
      });
    }
    return httpFailureResult(options.command, response, { input: options.input, requestId, payloadSha256 });
  }
  const createdIds = Array.isArray(response.data?.created)
    ? response.data.created.map((item) => item?.id)
    : [];
  if (
    !isObject(response.data)
    || response.data.requestId !== requestId
    || response.data[resource.payloadDigestField] !== payloadSha256
    || typeof response.data.replayed !== 'boolean'
    || !Array.isArray(response.data.created)
    || response.data.count !== response.data.created.length
    || response.data.count !== items.length
    || createdIds.some((id) => !Number.isSafeInteger(id) || id < 1)
    || new Set(createdIds).size !== createdIds.length
  ) {
    throw new ClientError('Bulk creation returned incomplete idempotency evidence.', {
      code: 'CAPABILITY_WRITE_UNPROVEN', stage: options.command,
      artifacts: { input: options.input, requestId, payloadSha256 },
      nextAction: 'Do not use a new requestId. List documents and reconcile this exact batch before retrying.',
    });
  }
  return capabilitySuccess(options, 'BULK_CREATE_OK', {
    artifacts: { input: options.input, requestId, payloadSha256 },
    response: response.data,
    evidence: {
      requestId,
      payloadSha256,
      replayMode: resource.replayMode,
      idempotencyTtlSeconds: resource.idempotencyTtlSeconds,
      replayed: response.data.replayed === true,
      count: response.data.count,
      ids: createdIds,
    },
    message: response.data.replayed === true
      ? 'The existing idempotent bulk result was recovered without creating duplicates.'
      : 'The declared bulk resource created the requested documents once.',
  });
}

function compositionContract(contract, stage) {
  const compositions = contract?.authoring?.compositions;
  if (!isObject(compositions) || !Array.isArray(compositions.recipes) || !isObject(compositions.resources)) {
    throw new ClientError('The live contract does not publish composition recipes and resources.', {
      code: 'CAPABILITY_RESOURCE_MISSING', stage,
      nextAction: 'Upgrade or repair Builder before authoring through compositions.',
    });
  }
  return compositions;
}

async function runCompositionsList(options, authHeader) {
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const compositions = compositionContract(fetched.contract, options.command);
  return capabilitySuccess(options, 'COMPOSITIONS_LIST_OK', {
    response: compositions,
    evidence: {
      version: compositions.version,
      count: compositions.recipes.length,
      source: 'full-live-contract',
    },
    message: 'Composition recipes were read from the full live Site Contract.',
  });
}

function compositionRequest(resource, input, recipes, stage, kind) {
  if (resource?.method !== 'POST' || !isFieldName(resource?.carrier)) {
    throw new ClientError(`The ${kind} composition descriptor is unsupported.`, {
      code: 'CAPABILITY_RESOURCE_INVALID', stage,
      nextAction: 'Repair the composition resource. Do not infer its carrier or endpoint.',
    });
  }
  const allowed = kind === 'instantiate'
    ? ['recipeId', resource.carrier, 'parentId', 'index', 'idPrefix', 'postId']
    : [resource.carrier, 'postId'];
  assertExactFields(input, allowed, stage, `${kind} input`);
  if (kind === 'instantiate') {
    const recipeIds = new Set(recipes.map((recipe) => recipe?.id).filter((id) => typeof id === 'string'));
    if (
      typeof input.recipeId !== 'string'
      || !recipeIds.has(input.recipeId)
      || !isObject(input[resource.carrier])
      || Object.hasOwn(input, 'parentId') && (typeof input.parentId !== 'string' || input.parentId === '')
      || Object.hasOwn(input, 'index') && (!Number.isSafeInteger(input.index) || input.index < 0)
      || Object.hasOwn(input, 'idPrefix') && (
        typeof input.idPrefix !== 'string'
        || !/^[a-z][a-z0-9-]{0,63}$/u.test(input.idPrefix)
      )
    ) {
      throw new ClientError('Composition instantiation requires a published recipeId and a slot object.', {
        code: 'CAPABILITY_INPUT_INVALID', stage,
        nextAction: 'Choose an exact recipe from compositions-list and satisfy its published slots.',
      });
    }
  } else {
    const plan = input[resource.carrier];
    if (!isObject(plan)) {
      throw new ClientError('Composition planning requires a plan object.', {
        code: 'CAPABILITY_INPUT_INVALID', stage,
        nextAction: 'Provide the complete plan object described by the live composition contract.',
      });
    }
    assertExactFields(plan, ['version', 'sections'], stage, 'composition plan');
    const recipeIds = new Set(recipes.map((recipe) => recipe?.id).filter((id) => typeof id === 'string'));
    if (
      plan.version !== 1
      || !Array.isArray(plan.sections)
      || plan.sections.length < 1
      || plan.sections.length > 20
    ) {
      throw new ClientError('Composition planning requires version 1 and 1-20 sections.', {
        code: 'CAPABILITY_INPUT_INVALID', stage,
        nextAction: 'Provide the complete bounded plan described by the live composition contract.',
      });
    }
    plan.sections.forEach((section, index) => {
      assertExactFields(section, ['compositionId', 'content'], stage, `plan.sections[${index}]`);
      if (
        typeof section.compositionId !== 'string'
        || !recipeIds.has(section.compositionId)
        || !isObject(section.content)
      ) {
        throw new ClientError(`plan.sections[${index}] does not use a published composition and content object.`, {
          code: 'CAPABILITY_INPUT_INVALID', stage,
          nextAction: 'Choose exact recipe IDs from compositions-list and provide one content object per section.',
        });
      }
    });
  }
  if (Object.hasOwn(input, 'postId') && (!Number.isSafeInteger(input.postId) || input.postId < 1)) {
    throw new ClientError('Composition postId must be a positive integer.', {
      code: 'CAPABILITY_INPUT_INVALID', stage,
      nextAction: 'Use an exact document ID from page-context or omit postId for host-neutral validation.',
    });
  }
  return input;
}

function validateCanonicalNodeGraph(nodeMap, rootNodeId, externalParentId, stage, label) {
  if (!isObject(nodeMap) || Object.keys(nodeMap).length === 0 || !isObject(nodeMap[rootNodeId])) {
    throw new ClientError(`${label} does not contain its declared root node.`, {
      code: 'CAPABILITY_RESPONSE_INVALID', stage,
      nextAction: 'Repair the composition response before using its node tree.',
    });
  }
  const owners = new Map();
  for (const [nodeId, node] of Object.entries(nodeMap)) {
    const required = [
      'type', 'displayName', 'custom', 'isCanvas', 'props', 'parent', 'hidden', 'nodes', 'linkedNodes',
    ];
    const linkedChildren = isObject(node?.linkedNodes) ? Object.values(node.linkedNodes) : [];
    if (
      !isObject(node)
      || !required.every((field) => Object.hasOwn(node, field))
      || !isObject(node.type)
      || typeof node.type.resolvedName !== 'string' || node.type.resolvedName === ''
      || typeof node.displayName !== 'string' || node.displayName === ''
      || !isObject(node.custom)
      || typeof node.isCanvas !== 'boolean'
      || !isObject(node.props)
      || typeof node.hidden !== 'boolean'
      || !Array.isArray(node.nodes)
      || !isObject(node.linkedNodes)
      || !node.nodes.every((childId) => typeof childId === 'string' && childId !== '')
      || !linkedChildren.every((childId) => typeof childId === 'string' && childId !== '')
      || typeof node.parent !== 'string' && node.parent !== null
    ) {
      throw new ClientError(`${label}.${nodeId} is not a canonical Monteby node.`, {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Repair the composition response before using its node tree.',
      });
    }
    const childIds = [...node.nodes, ...linkedChildren];
    if (new Set(childIds).size !== childIds.length) {
      throw new ClientError(`${label}.${nodeId} owns one child more than once.`, {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Repair the composition tree ownership before using the response.',
      });
    }
    for (const childId of childIds) {
      if (!isObject(nodeMap[childId]) || nodeMap[childId].parent !== nodeId || owners.has(childId)) {
        throw new ClientError(`${label} has an invalid or duplicate child owner.`, {
          code: 'CAPABILITY_RESPONSE_INVALID', stage,
          nextAction: 'Repair the composition tree ownership before using the response.',
        });
      }
      owners.set(childId, nodeId);
    }
  }
  if (nodeMap[rootNodeId].parent !== externalParentId || owners.has(rootNodeId)) {
    throw new ClientError(`${label} root ownership does not match the requested parent.`, {
      code: 'CAPABILITY_RESPONSE_INVALID', stage,
      nextAction: 'Repair the composition root ownership before using the response.',
    });
  }
  const visited = new Set();
  const active = new Set();
  const visit = (nodeId) => {
    if (active.has(nodeId)) {
      throw new ClientError(`${label} contains a cycle.`, {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Repair the composition tree before using the response.',
      });
    }
    if (visited.has(nodeId)) return;
    active.add(nodeId);
    const node = nodeMap[nodeId];
    [...node.nodes, ...Object.values(node.linkedNodes)].forEach(visit);
    active.delete(nodeId);
    visited.add(nodeId);
  };
  visit(rootNodeId);
  if (visited.size !== Object.keys(nodeMap).length) {
    throw new ClientError(`${label} contains unreachable nodes.`, {
      code: 'CAPABILITY_RESPONSE_INVALID', stage,
      nextAction: 'Repair the composition tree reachability before using the response.',
    });
  }
}

function validateCompositionResponse(response, input, kind, stage) {
  const responseFields = kind === 'instantiate'
    ? ['valid', 'recipeId', 'rootNodeId', 'nodes', 'operation', 'errors', 'lint', 'decisions']
    : ['valid', 'layout', 'sections', 'errors', 'lint', 'decisions'];
  assertExactFields(response, responseFields, stage, `${kind} response`, 'CAPABILITY_RESPONSE_INVALID');
  if (
    !responseFields.every((field) => Object.hasOwn(response, field))
    || response.valid !== true
    || !Array.isArray(response.errors) || response.errors.length !== 0
    || !Array.isArray(response.lint) || response.lint.some((finding) => !isObject(finding))
  ) {
    throw new ClientError('The composition resource did not return a complete valid candidate.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage,
      response: safeCapabilityOutput(response, stage),
      nextAction: 'Correct the recipe slots or plan using the returned errors and run the command again.',
    });
  }

  if (kind === 'instantiate') {
    const expectedParent = input.parentId || 'ROOT';
    const expectedPrefix = input.idPrefix || input.recipeId;
    if (
      response.recipeId !== input.recipeId
      || typeof response.rootNodeId !== 'string' || response.rootNodeId === ''
      || !isObject(response.nodes)
      || !isObject(response.operation)
      || !isObject(response.decisions)
    ) {
      throw new ClientError('The composition instantiation identity is incomplete or mismatched.', {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Discard the response and repair the Builder composition resource.',
      });
    }
    validateCanonicalNodeGraph(
      response.nodes,
      response.rootNodeId,
      expectedParent,
      stage,
      'instantiate.nodes'
    );
    assertExactFields(
      response.operation,
      ['type', 'parentId', 'index', 'tree'],
      stage,
      'instantiate operation',
      'CAPABILITY_RESPONSE_INVALID'
    );
    assertExactFields(
      response.operation.tree,
      ['rootNodeId', 'nodes'],
      stage,
      'instantiate operation tree',
      'CAPABILITY_RESPONSE_INVALID'
    );
    const indexMatches = Object.hasOwn(input, 'index')
      ? response.operation.index === input.index
      : !Object.hasOwn(response.operation, 'index');
    if (
      response.operation.type !== 'insert_tree'
      || response.operation.parentId !== expectedParent
      || !indexMatches
      || response.operation.tree.rootNodeId !== response.rootNodeId
      || canonicalSha256(response.operation.tree.nodes) !== canonicalSha256(response.nodes)
    ) {
      throw new ClientError('The composition operation does not reproduce the returned node tree.', {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Discard the response and repair the Builder composition operation.',
      });
    }
    const decisionFields = [
      'idPrefix', 'idStart', 'nodeCount', 'omittedOptional', 'levelOneHeadings',
      'placementVerified', 'anchorsVerified',
    ];
    assertExactFields(
      response.decisions,
      decisionFields,
      stage,
      'instantiate decisions',
      'CAPABILITY_RESPONSE_INVALID'
    );
    if (
      !decisionFields.every((field) => Object.hasOwn(response.decisions, field))
      || response.decisions.idPrefix !== expectedPrefix
      || !Number.isSafeInteger(response.decisions.idStart) || response.decisions.idStart < 1
      || response.decisions.nodeCount !== Object.keys(response.nodes).length
      || !Array.isArray(response.decisions.omittedOptional)
      || !response.decisions.omittedOptional.every((value) => typeof value === 'string')
      || !Number.isSafeInteger(response.decisions.levelOneHeadings)
      || response.decisions.levelOneHeadings < 0
      || typeof response.decisions.placementVerified !== 'boolean'
      || typeof response.decisions.anchorsVerified !== 'boolean'
    ) {
      throw new ClientError('The composition instantiation decisions are incomplete or inconsistent.', {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Discard the response and repair the Builder composition decisions.',
      });
    }
    return;
  }

  if (!Array.isArray(response.sections) || !Array.isArray(response.decisions)) {
    throw new ClientError('The composition plan omitted its section evidence.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage,
      nextAction: 'Discard the response and repair the Builder composition plan.',
    });
  }
  const nodeMap = extractNodeMap(response.layout);
  validateCanonicalNodeGraph(nodeMap, 'ROOT', null, stage, 'plan.layout');
  const requestedSections = input.plan.sections;
  if (
    !Array.isArray(requestedSections)
    || response.sections.length !== requestedSections.length
    || response.decisions.length !== requestedSections.length
    || nodeMap.ROOT.nodes.length !== requestedSections.length
  ) {
    throw new ClientError('The composition plan section count does not match the request.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage,
      nextAction: 'Discard the response and repair the Builder composition plan.',
    });
  }
  response.sections.forEach((section, index) => {
    const decision = response.decisions[index];
    assertExactFields(
      section,
      ['index', 'compositionId', 'rootNodeId', 'nodeCount'],
      stage,
      `plan.sections[${index}]`,
      'CAPABILITY_RESPONSE_INVALID'
    );
    assertExactFields(
      decision,
      ['section', 'compositionId', 'rootNodeId', 'idStart', 'nodeCount', 'omittedOptional'],
      stage,
      `plan.decisions[${index}]`,
      'CAPABILITY_RESPONSE_INVALID'
    );
    const rootNodeId = nodeMap.ROOT.nodes[index];
    const stack = [rootNodeId];
    const subtree = new Set();
    while (stack.length > 0) {
      const nodeId = stack.pop();
      if (subtree.has(nodeId)) continue;
      subtree.add(nodeId);
      const node = nodeMap[nodeId];
      stack.push(...node.nodes, ...Object.values(node.linkedNodes));
    }
    if (
      section.index !== index
      || section.compositionId !== requestedSections[index]?.compositionId
      || section.rootNodeId !== rootNodeId
      || section.nodeCount !== subtree.size
      || decision.section !== index
      || decision.compositionId !== section.compositionId
      || decision.rootNodeId !== section.rootNodeId
      || decision.nodeCount !== section.nodeCount
      || !Number.isSafeInteger(decision.idStart) || decision.idStart < 1
      || !Array.isArray(decision.omittedOptional)
      || !decision.omittedOptional.every((value) => typeof value === 'string')
    ) {
      throw new ClientError('The composition plan section evidence is incomplete or inconsistent.', {
        code: 'CAPABILITY_RESPONSE_INVALID', stage,
        nextAction: 'Discard the response and repair the Builder composition plan.',
      });
    }
  });
}

async function runComposition(options, authHeader, kind) {
  const input = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const compositions = compositionContract(fetched.contract, options.command);
  const resource = compositions.resources[kind];
  const body = compositionRequest(resource, input, compositions.recipes, options.command, kind);
  const endpoint = declaredResourcePath(resource.path, {}, options.command);
  const response = await requestDeclared(options, authHeader, {
    method: resource.method,
    endpoint,
    body,
  });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  validateCompositionResponse(response.data, input, kind, options.command);
  const inputSha256 = canonicalSha256(body);
  const outputSha256 = canonicalSha256(response.data);
  return capabilitySuccess(options, kind === 'instantiate' ? 'COMPOSITION_INSTANTIATE_OK' : 'COMPOSITION_PLAN_OK', {
    artifacts: { input: options.input },
    response: response.data,
    evidence: {
      kind,
      recipeId: kind === 'instantiate' ? input.recipeId : undefined,
      postId: input.postId || 0,
      inputSha256,
      outputSha256,
      ...(kind === 'instantiate'
        ? { nodeTreeSha256: canonicalSha256(response.data.nodes) }
        : { layoutSha256: nodeMapSha256(extractNodeMap(response.data.layout)) }),
    },
    message: kind === 'instantiate'
      ? 'The published composition was instantiated and validated without writing.'
      : 'The composition plan produced a validated page candidate without writing.',
  });
}

function globalStylesContract(contract, stage) {
  const styles = contract?.globalStyles;
  if (
    !isObject(styles)
    || !isObject(styles.colors)
    || !isObject(styles.typography)
    || typeof styles.revision !== 'string'
    || !isObject(styles.resource)
    || styles.resource.patchMethod !== 'PATCH'
    || !Array.isArray(styles.resource.allowedFields)
    || !isFieldName(styles.resource.versionField)
    || !isFieldName(styles.resource.writePreconditionField)
    || !isObject(styles.patchSchema)
  ) {
    throw new ClientError('The live contract does not publish safe versioned global styles.', {
      code: 'CAPABILITY_RESOURCE_MISSING', stage,
      nextAction: 'Upgrade or repair Builder. Do not read or write private style settings directly.',
    });
  }
  return styles;
}

function matchesPatch(document, patch) {
  if (!isObject(patch)) return canonicalJson(document) === canonicalJson(patch);
  if (!isObject(document)) return false;
  return Object.entries(patch).every(([key, value]) => matchesPatch(document[key], value));
}

async function runGlobalStylesGet(options, authHeader) {
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const styles = globalStylesContract(fetched.contract, options.command);
  return capabilitySuccess(options, 'GLOBAL_STYLES_GET_OK', {
    response: styles,
    evidence: {
      revision: styles.revision,
      source: 'full-live-contract',
      allowedFields: styles.resource.allowedFields,
    },
    message: 'The safe global colors and typography projection was read from the live contract.',
  });
}

async function runGlobalStylesPatch(options, authHeader) {
  const input = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const styles = globalStylesContract(fetched.contract, options.command);
  const precondition = styles.resource.writePreconditionField;
  const allowed = [...styles.resource.allowedFields, precondition];
  assertExactFields(input, allowed, options.command, 'global styles patch');
  const patchFields = Object.fromEntries(
    styles.resource.allowedFields
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, input[field]])
  );
  if (Object.keys(patchFields).length === 0 || input[precondition] !== styles.revision) {
    return capabilityFailure(
      options,
      input[precondition] === styles.revision ? 'CAPABILITY_INPUT_INVALID' : 'REST_CONFLICT',
      input[precondition] === styles.revision
        ? 'The patch does not contain a published style field.'
        : 'The global styles revision precondition is stale.',
      input[precondition] === styles.revision
        ? 'Add a colors or typography change and preserve all unrelated settings.'
        : 'Fetch global styles again, reconcile the newer design, and issue one explicit patch.',
      { input: options.input }
    );
  }
  const schemaErrors = operationSchemaErrors(input, styles.patchSchema);
  if (schemaErrors.length > 0) {
    throw new ClientError(`Global styles patch failed the live schema: ${schemaErrors.join('; ')}`, {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Correct the patch using globalStyles.patchSchema from the live contract.',
    });
  }
  const patchWasNoOp = matchesPatch(styles, patchFields);
  const endpoint = declaredResourcePath(styles.resource.path, {}, options.command);
  const response = await requestDeclared(options, authHeader, {
    method: styles.resource.patchMethod,
    endpoint,
    body: input,
    mutation: true,
  });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  const readback = await fullContractForCapability(options, authHeader);
  if (readback.failure) {
    return capabilityFailure(
      options,
      'CAPABILITY_WRITE_UNPROVEN',
      'The style write returned success but its safe canonical readback failed.',
      'Do not repeat the patch. Fetch the contract and reconcile the uncertain design state.',
      { input: options.input }
    );
  }
  const saved = globalStylesContract(readback.contract, options.command);
  if (
    !matchesPatch(saved, patchFields)
    || typeof response.data?.revision !== 'string'
    || response.data.revision !== saved.revision
    || (!patchWasNoOp && saved.revision === styles.revision)
  ) {
    return capabilityFailure(
      options,
      'CAPABILITY_WRITE_UNPROVEN',
      'The safe contract readback does not prove both the requested patch and its revision advance.',
      'Do not repeat the patch. Reconcile the current global styles manually.',
      { input: options.input }
    );
  }
  return capabilitySuccess(options, 'GLOBAL_STYLES_PATCH_OK', {
    artifacts: { input: options.input },
    response: response.data,
    evidence: {
      previousRevision: styles.revision,
      revision: saved.revision,
      revisionAdvanced: saved.revision !== styles.revision,
      noOp: patchWasNoOp,
      patchSha256: canonicalSha256(patchFields),
      canonicalReadback: true,
    },
    message: 'The bounded global-style patch was written and proved through the safe live contract.',
  });
}

function designProfilesContract(contract, stage) {
  const profiles = contract?.authoring?.designProfiles;
  if (!isObject(profiles) || !Array.isArray(profiles.profiles) || !isObject(profiles.resource)) {
    throw new ClientError('The live contract does not publish design profiles.', {
      code: 'CAPABILITY_RESOURCE_MISSING', stage,
      nextAction: 'Upgrade or repair Builder before composing a design profile.',
    });
  }
  return profiles;
}

async function runDesignProfiles(options, authHeader) {
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const profiles = designProfilesContract(fetched.contract, options.command);
  return capabilitySuccess(options, 'DESIGN_PROFILES_OK', {
    response: profiles,
    evidence: { version: profiles.version, count: profiles.profiles.length },
    message: 'Published design profiles were read from the full live contract.',
  });
}

async function runGlobalStylesCompose(options, authHeader) {
  const input = await loadCapabilityInput(options);
  assertExactFields(input, ['profileId', 'overrides'], options.command, 'profile input');
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const styles = globalStylesContract(fetched.contract, options.command);
  const profiles = designProfilesContract(fetched.contract, options.command);
  const profileIds = new Set(profiles.profiles.map((profile) => profile?.id).filter((id) => typeof id === 'string'));
  if (typeof input.profileId !== 'string' || !profileIds.has(input.profileId)) {
    throw new ClientError('profileId must name a published design profile.', {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Choose an exact profile ID returned by design-profiles.',
    });
  }
  if (Object.hasOwn(input, 'overrides')) {
    assertExactFields(input.overrides, styles.resource.allowedFields, options.command, 'profile overrides');
  }
  if (profiles.resource.composeMethod !== 'POST' || typeof profiles.resource.composePath !== 'string') {
    throw new ClientError('The design-profile compose descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID', stage: options.command,
      nextAction: 'Repair the compose descriptor. Do not guess its endpoint.',
    });
  }
  const endpoint = declaredResourcePath(profiles.resource.composePath, {}, options.command);
  const response = await requestDeclared(options, authHeader, {
    method: profiles.resource.composeMethod,
    endpoint,
    body: input,
  });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  if (
    !isObject(response.data)
    || response.data.profileId !== input.profileId
    || !isObject(response.data.styles)
    || typeof response.data.revision !== 'string'
  ) {
    throw new ClientError('The design-profile composition response is invalid.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the Builder composition response before previewing or applying it.',
    });
  }
  const safeStyles = safeCapabilityOutput(response.data.styles, options.command);
  return capabilitySuccess(options, 'GLOBAL_STYLES_COMPOSE_OK', {
    artifacts: { input: options.input },
    response: { ...response.data, styles: safeStyles },
    evidence: {
      profileId: input.profileId,
      revision: response.data.revision,
      safeStylesSha256: canonicalSha256(safeStyles),
    },
    message: 'The selected design profile was composed without changing site settings.',
  });
}

function pageSeoCapability(contract, pageId, stage) {
  const persistence = layoutPersistence(contract, stage);
  const resource = persistenceResource(contract, 'pageSeo', stage);
  if (
    resource.readMethod !== 'GET'
    || resource.writeMethod !== 'PUT'
    || !isFieldName(resource.carrier)
    || !isFieldName(persistence.writePreconditionField)
    || !isFieldName(resource.digestField)
    || !isFieldName(resource.writeDigestPreconditionField)
    || new Set([
      resource.carrier,
      persistence.writePreconditionField,
      resource.digestField,
      resource.writeDigestPreconditionField,
    ]).size !== 4
    || !isObject(persistence.seo?.schema)
  ) {
    throw new ClientError('The page SEO resource descriptor is unsupported.', {
      code: 'CAPABILITY_RESOURCE_INVALID', stage,
      nextAction: 'Repair the versioned SEO descriptor. Do not couple SEO changes to the layout resource.',
    });
  }
  return {
    endpoint: declaredResourcePath(resource.path, { postId: pageId }, stage),
    readMethod: resource.readMethod,
    writeMethod: resource.writeMethod,
    carrier: resource.carrier,
    preconditionField: persistence.writePreconditionField,
    digestField: resource.digestField,
    digestPreconditionField: resource.writeDigestPreconditionField,
    schema: persistence.seo.schema,
  };
}

async function fetchPageSeo(options, authHeader, capability) {
  const response = await requestDeclared(options, authHeader, {
    method: capability.readMethod,
    endpoint: capability.endpoint,
  });
  if (!response.ok) return { failure: httpFailureResult(options.command, response, {}) };
  if (
    !isObject(response.data)
    || response.data.id !== options.pageId
    || !isObject(response.data.seo)
    || !validSha(response.data[capability.digestField])
    || response.data[capability.digestField] !== canonicalSha256(response.data.seo)
  ) {
    throw new ClientError('The page SEO response does not match the requested document.', {
      code: 'CAPABILITY_SCOPE_MISMATCH', stage: options.command,
      nextAction: 'Discard the response and repair the Builder SEO resource.',
    });
  }
  return { document: response.data };
}

async function runSeoGet(options, authHeader) {
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const capability = pageSeoCapability(fetched.contract, options.pageId, options.command);
  const seo = await fetchPageSeo(options, authHeader, capability);
  if (seo.failure) return seo.failure;
  return capabilitySuccess(options, 'SEO_GET_OK', {
    response: seo.document,
    evidence: {
      pageId: options.pageId,
      postModifiedGmt: seo.document.postModifiedGmt,
      seoSha256: seo.document[capability.digestField],
    },
    message: 'The complete page SEO profile was read without loading or converting its layout.',
  });
}

async function runSeoPut(options, authHeader) {
  const input = await loadCapabilityInput(options);
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const capability = pageSeoCapability(fetched.contract, options.pageId, options.command);
  assertExactFields(
    input,
    [capability.carrier, capability.preconditionField, capability.digestPreconditionField],
    options.command,
    'SEO input'
  );
  if (
    !isObject(input[capability.carrier])
    || typeof input[capability.preconditionField] !== 'string'
    || !validSha(input[capability.digestPreconditionField])
  ) {
    throw new ClientError('SEO save requires the complete SEO block plus version and digest preconditions.', {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Start from seo-get, change the complete seo block, and preserve its postModifiedGmt and seoSha256 values.',
    });
  }
  const schemaErrors = operationSchemaErrors(input[capability.carrier], capability.schema);
  if (schemaErrors.length > 0) {
    throw new ClientError(`SEO input failed the live schema: ${schemaErrors.join('; ')}`, {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Correct the complete SEO block using layoutPersistence.seo.schema.',
    });
  }
  const before = await fetchPageSeo(options, authHeader, capability);
  if (before.failure) return before.failure;
  if (
    before.document.postModifiedGmt !== input[capability.preconditionField]
    || before.document[capability.digestField] !== input[capability.digestPreconditionField]
  ) {
    return capabilityFailure(
      options,
      'REST_CONFLICT',
      'The SEO version precondition is stale before the write.',
      'Fetch SEO again, reconcile the newer profile, and issue one explicit save.',
      { input: options.input }
    );
  }
  const response = await requestDeclared(options, authHeader, {
    method: capability.writeMethod,
    endpoint: capability.endpoint,
    body: input,
    mutation: true,
  });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input });
  if (
    !isObject(response.data)
    || response.data.id !== options.pageId
    || !isObject(response.data.seo)
    || !validSha(response.data[capability.digestField])
    || response.data[capability.digestField] !== canonicalSha256(response.data.seo)
  ) {
    throw new ClientError('The SEO write response has the wrong document identity.', {
      code: 'CAPABILITY_WRITE_UNPROVEN', stage: options.command,
      nextAction: 'Do not repeat the write. Read the current SEO profile and reconcile it manually.',
    });
  }
  const readback = await fetchPageSeo(options, authHeader, capability);
  if (readback.failure || canonicalJson(readback.document.seo) !== canonicalJson(input[capability.carrier])) {
    return capabilityFailure(
      options,
      'CAPABILITY_WRITE_UNPROVEN',
      'Canonical SEO readback does not exactly match the submitted profile.',
      'Do not repeat the write. Reconcile the current SEO profile manually.',
      { input: options.input }
    );
  }
  return capabilitySuccess(options, 'SEO_PUT_OK', {
    artifacts: { input: options.input },
    response: response.data,
    evidence: {
      pageId: options.pageId,
      previousVersionToken: before.document.postModifiedGmt,
      versionToken: readback.document.postModifiedGmt,
      previousSeoSha256: before.document[capability.digestField],
      seoSha256: readback.document[capability.digestField],
      canonicalReadback: true,
    },
    message: 'The complete SEO profile was saved and proved by canonical readback.',
  });
}

function abilitiesContract(contract, stage) {
  const abilities = contract?.authoring?.abilities;
  if (
    !isObject(abilities)
    || abilities.available !== true
    || abilities.namespace !== 'monteby'
    || abilities.category !== 'monteby'
    || abilities.restNamespace !== 'wp-abilities/v1'
    || !Array.isArray(abilities.names)
    || typeof abilities.listPath !== 'string'
    || typeof abilities.runPath !== 'string'
  ) {
    throw new ClientError('WordPress Abilities are unavailable or absent from the live contract.', {
      code: 'CAPABILITY_NOT_ADVERTISED', stage,
      nextAction: 'Use the declared Monteby REST resources, or upgrade WordPress/Builder before using Abilities.',
    });
  }
  if (
    abilities.names.some((name) => typeof name !== 'string' || !/^monteby\/[a-z][a-z0-9-]{0,63}$/u.test(name))
    || new Set(abilities.names).size !== abilities.names.length
  ) {
    throw new ClientError('The advertised ability names are invalid.', {
      code: 'CAPABILITY_RESOURCE_INVALID', stage,
      nextAction: 'Repair the Builder ability contract before discovery or execution.',
    });
  }
  return abilities;
}

async function fetchAbilities(options, authHeader, contract) {
  const descriptor = abilitiesContract(contract, options.command);
  const endpointPath = declaredResourcePath(
    descriptor.listPath,
    {},
    options.command,
    [`/${descriptor.restNamespace}`]
  );
  const parameters = new URLSearchParams({ category: descriptor.category, per_page: '100' });
  const response = await requestDeclared(options, authHeader, {
    method: 'GET',
    endpoint: `${endpointPath}?${parameters.toString()}`,
  });
  if (!response.ok) return { failure: httpFailureResult(options.command, response, {}) };
  if (!Array.isArray(response.data)) {
    throw new ClientError('The WordPress Abilities list is not an array.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the WordPress Abilities REST response before invoking any ability.',
    });
  }
  const byName = new Map();
  for (const ability of response.data) {
    const name = ability?.name;
    if (
      typeof name !== 'string'
      || !descriptor.names.includes(name)
      || ability?.meta?.show_in_rest !== true
      || !isObject(ability?.meta?.annotations)
      || typeof ability.meta.annotations.readonly !== 'boolean'
      || typeof ability.meta.annotations.destructive !== 'boolean'
      || typeof ability.meta.annotations.idempotent !== 'boolean'
    ) {
      throw new ClientError('The Abilities list disagrees with the Monteby contract or annotations.', {
        code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
        nextAction: 'Repair the Ability registration and discard the inconsistent discovery response.',
      });
    }
    if (byName.has(name)) {
      throw new ClientError(`Ability discovery returned the duplicate name ${name}.`, {
        code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
        nextAction: 'Repair the WordPress Ability registration before executing an ambiguous duplicate.',
      });
    }
    byName.set(name, ability);
  }
  const missing = descriptor.names.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new ClientError(`Advertised Abilities are missing from discovery: ${missing.join(', ')}.`, {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the WordPress Ability registrations before execution.',
    });
  }
  return { descriptor, items: response.data, byName };
}

async function runAbilitiesList(options, authHeader) {
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const abilities = await fetchAbilities(options, authHeader, fetched.contract);
  if (abilities.failure) return abilities.failure;
  return capabilitySuccess(options, 'ABILITIES_LIST_OK', {
    response: abilities.items,
    evidence: {
      namespace: abilities.descriptor.namespace,
      count: abilities.items.length,
      names: abilities.descriptor.names,
    },
    message: 'WordPress Abilities were discovered and reconciled with the live Monteby contract.',
  });
}

function appendAbilityQuery(parameters, field, value, stage) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendAbilityQuery(parameters, `${field}[${index}]`, item, stage));
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) => {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key)) {
        throw new ClientError(`Ability input contains an unsafe key: ${key}.`, {
          code: 'CAPABILITY_INPUT_INVALID', stage,
          nextAction: 'Use only fields declared by the discovered Ability input schema.',
        });
      }
      appendAbilityQuery(parameters, `${field}[${key}]`, item, stage);
    });
    return;
  }
  if (typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) {
    parameters.append(field, String(value));
    return;
  }
  throw new ClientError(`Ability input field ${field} has an unsupported value.`, {
    code: 'CAPABILITY_INPUT_INVALID', stage,
    nextAction: 'Use JSON values accepted by the discovered Ability input schema.',
  });
}

async function runAbility(options, authHeader) {
  const input = await loadCapabilityInput(options);
  if (!isObject(input)) {
    throw new ClientError('Ability input must be a JSON object.', {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Provide an object matching the discovered Ability input schema.',
    });
  }
  const fetched = await fullContractForCapability(options, authHeader);
  if (fetched.failure) return fetched.failure;
  const abilities = await fetchAbilities(options, authHeader, fetched.contract);
  if (abilities.failure) return abilities.failure;
  const ability = abilities.byName.get(options.name);
  if (!ability) {
    throw new ClientError('The requested Ability is not published by the live Monteby contract.', {
      code: 'CAPABILITY_NOT_ADVERTISED', stage: options.command,
      nextAction: 'Choose an exact name returned by abilities-list.',
    });
  }
  if (ability.meta.annotations.readonly !== true || ability.meta.annotations.destructive !== false) {
    throw new ClientError('Destructive Abilities are blocked by the canonical authoring client.', {
      code: 'CAPABILITY_MUTATION_REQUIRES_CANONICAL_CLIENT', stage: options.command,
      nextAction: 'Use save, patch-save, revision-restore, SEO or global-style commands with their full proof chain.',
    });
  }
  const inputSchema = ability.input_schema || ability.inputSchema;
  const outputSchema = ability.output_schema || ability.outputSchema;
  if (!isObject(inputSchema) || !isObject(outputSchema)) {
    throw new ClientError('The discovered Ability omits its input or output schema.', {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the Ability registration before execution.',
    });
  }
  const schemaErrors = operationSchemaErrors(input, inputSchema);
  if (schemaErrors.length > 0) {
    throw new ClientError(`Ability input failed its discovered schema: ${schemaErrors.join('; ')}`, {
      code: 'CAPABILITY_INPUT_INVALID', stage: options.command,
      nextAction: 'Correct the input using the exact schema returned by abilities-list.',
    });
  }
  const endpointPath = declaredResourcePath(
    abilities.descriptor.runPath,
    { name: options.name },
    options.command,
    [`/${abilities.descriptor.restNamespace}`]
  );
  const parameters = new URLSearchParams();
  appendAbilityQuery(parameters, 'input', input, options.command);
  const endpoint = parameters.size > 0 ? `${endpointPath}?${parameters.toString()}` : endpointPath;
  if (endpoint.length > 16_384) {
    throw new ClientError('Ability input is too large for the read-only GET transport.', {
      code: 'CAPABILITY_INPUT_TOO_LARGE', stage: options.command,
      nextAction: 'Use the equivalent descriptor-driven Monteby REST command for large layout candidates.',
    });
  }
  const response = await requestDeclared(options, authHeader, { method: 'GET', endpoint });
  if (!response.ok) return httpFailureResult(options.command, response, { input: options.input, ability: options.name });
  const outputErrors = operationSchemaErrors(response.data, outputSchema);
  if (outputErrors.length > 0) {
    throw new ClientError(`Ability output failed its discovered schema: ${outputErrors.join('; ')}`, {
      code: 'CAPABILITY_RESPONSE_INVALID', stage: options.command,
      nextAction: 'Repair the Ability output contract before using this response as authoring evidence.',
    });
  }
  const output = isObject(response.data) ? { ...response.data } : response.data;
  const artifacts = { input: options.input };
  const evidence = { ability: options.name, readonly: true, idempotent: ability.meta.annotations.idempotent };
  if (isObject(output) && typeof output.html === 'string') {
    const extension = path.extname(options.out);
    const previewFile = path.join(path.dirname(options.out), `${path.basename(options.out, extension)}-ability.html`);
    await atomicWriteMany([{ target: previewFile, content: redact(output.html, authHeader) }], options.command);
    artifacts.preview = previewFile;
    evidence.htmlSha256 = createHash('sha256').update(output.html, 'utf8').digest('hex');
    delete output.html;
  }
  return capabilitySuccess(options, 'ABILITY_RUN_OK', {
    artifacts,
    response: output,
    evidence,
    message: 'The read-only published WordPress Ability completed successfully.',
  });
}

function redact(value, secret) {
  if (!secret) return value;
  if (typeof value === 'string') return value.split(secret).join('[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => redact(item, secret));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, secret)]));
  }
  return value;
}

async function persistReportIfRequested(options, report) {
  const reportTarget = options.command === 'preview' ? options.reportOut : options.out;
  if (!reportTarget) return report;
  const withArtifact = {
    ...report,
    artifacts: {
      ...report.artifacts,
      report: reportTarget,
    },
  };
  await atomicWriteJson(reportTarget, withArtifact, options.command);
  return withArtifact;
}

async function run(options, authHeader) {
  if (options.command === 'snapshot') return runSnapshot(options, authHeader);
  if (options.command === 'validate') return runValidate(options, authHeader);
  if (options.command === 'save') return runSave(options, authHeader);
  if (options.command === 'patch-validate') return runPatchValidate(options, authHeader);
  if (options.command === 'patch-save') return runPatchSave(options, authHeader);
  if (options.command === 'branding-snapshot') return runBrandingSnapshot(options, authHeader);
  if (options.command === 'branding-save') return runBrandingSave(options, authHeader);
  if (options.command === 'contract-fetch') return runContractFetch(options, authHeader);
  if (options.command === 'page-context') return runPageContext(options, authHeader);
  if (options.command === 'documents-list') return runDocumentsList(options, authHeader);
  if (options.command === 'revision-list') return runRevisionList(options, authHeader);
  if (options.command === 'revision-restore') return runRevisionRestore(options, authHeader);
  if (options.command === 'preview-resource') return runPreviewResource(options, authHeader);
  if (options.command === 'bulk-create') return runBulkCreate(options, authHeader);
  if (options.command === 'compositions-list') return runCompositionsList(options, authHeader);
  if (options.command === 'composition-plan') return runComposition(options, authHeader, 'plan');
  if (options.command === 'composition-instantiate') {
    return runComposition(options, authHeader, 'instantiate');
  }
  if (options.command === 'global-styles-get') return runGlobalStylesGet(options, authHeader);
  if (options.command === 'global-styles-patch') return runGlobalStylesPatch(options, authHeader);
  if (options.command === 'global-styles-compose') return runGlobalStylesCompose(options, authHeader);
  if (options.command === 'design-profiles') return runDesignProfiles(options, authHeader);
  if (options.command === 'seo-get') return runSeoGet(options, authHeader);
  if (options.command === 'seo-put') return runSeoPut(options, authHeader);
  if (options.command === 'abilities-list') return runAbilitiesList(options, authHeader);
  if (options.command === 'ability-run') return runAbility(options, authHeader);
  return runPreview(options, authHeader);
}

async function main(argv = process.argv.slice(2)) {
  let options;
  let authHeader = '';
  let report;
  try {
    options = parseArgs(argv);
    if (options.help) {
      printHelp();
      return 0;
    }
    authHeader = resolveAuthHeader(options);
    report = await run(options, authHeader);
    report = withMaterializedNextAction(report, options);
    report = redact(report, authHeader);
    report = await persistReportIfRequested(options, report);
  } catch (error) {
    report = withMaterializedNextAction(
      resultFromError(error, options?.command || 'cli'),
      options
    );
    report = redact(report, authHeader);
    if (
      options
      && (
        (options.command === 'preview' && options.reportOut)
        || (options.command !== 'preview' && options.out)
      )
    ) {
      try {
        report = await persistReportIfRequested(options, report);
      } catch (writeError) {
        report = withMaterializedNextAction(
          resultFromError(writeError, options.command),
          options
        );
        report = redact(report, authHeader);
      }
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

if (require.main === module) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    () => {
      process.stdout.write(`${JSON.stringify(createResult({
        ok: false,
        stage: 'cli',
        code: 'UNEXPECTED_ERROR',
        retryable: false,
        artifacts: {},
        nextAction: nextAction(
          'blocked_unexpected_client_error',
          '',
          [],
          ['CLIENT_RUNTIME_REPAIRED'],
          'Stop. Inspect and repair the local Node.js runtime before starting a new client command.'
        ),
        message: 'The client stopped because of an unexpected local error.',
      }), null, 2)}\n`);
      process.exitCode = 1;
    }
  );
}

module.exports = {
  ClientError,
  canonicalJson,
  canonicalSha256,
  createResult,
  extractNodeMap,
  main,
  nodeMapSha256,
  operationsSha256,
  parseArgs,
  portableDigestBytes,
  pruneNoopOperations,
};
