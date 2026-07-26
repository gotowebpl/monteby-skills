#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const SCHEMA_VERSION = 1;
const DEFAULT_AUTH_HEADER_ENV = 'MONTEBY_AUTH_HEADER';
const DEFAULT_TIMEOUT_MS = 30_000;
const API_ROOT = '/wp-json/monteby/v1';
const COMMANDS = new Set(['snapshot', 'validate', 'save', 'preview']);
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
    authHeaderEnv: DEFAULT_AUTH_HEADER_ENV,
    timeoutMs: DEFAULT_TIMEOUT_MS,
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
    } else if (option === '--auth-header-env') {
      options.authHeaderEnv = requiredValue(argv, index += 1, option);
    } else if (option === '--timeout-ms') {
      options.timeoutMs = parsePositiveInteger(requiredValue(argv, index += 1, option), option);
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
    rejectOption(options, 'pageId', '--page-id');
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
  }
}

function printHelp() {
  process.stdout.write(`Usage:
  wordpress-layout-client.js snapshot --site URL --page-id ID --out-dir DIR [--out REPORT.json]
  wordpress-layout-client.js validate --site URL --layout LAYOUT.json [--out REPORT.json]
  wordpress-layout-client.js save --site URL --page-id ID --layout LAYOUT.json (--out-dir DIR | --snapshot FILE) --expected-layout-sha256 SHA256 --out SAVE-REPORT.json [--presentation-layout NAME]
  wordpress-layout-client.js preview --site URL --layout LAYOUT.json --save-report SAVE-REPORT.json --out PREVIEW.html --report-out PREVIEW-REPORT.json

Common options:
  --auth-header-env NAME  Environment variable containing the complete Authorization header.
                          Defaults to MONTEBY_AUTH_HEADER. The header value is never accepted
                          as a CLI argument and is never written to reports.
  --timeout-ms NUMBER     Per-request timeout in milliseconds (default: 30000).

save reads DIR/layout-before.json when --snapshot is omitted. It never retries a
409 conflict or 428 precondition response automatically. validate emits the
layoutSha256 required by save; preview requires the persisted scoped SAVE_OK
report and writes a separate PREVIEW_OK report for canonical verification.
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
  if (options.out) args.push('--out', options.out);
  if (options.reportOut) args.push('--report-out', options.reportOut);
  return withCommonArgs(args, options);
}

function validationArgs(options, layout = options.layout) {
  const args = [
    'validate',
    '--site', options.site,
    '--layout', layout,
  ];
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
      'show_client_help',
      CLIENT_TOOL,
      ['--help'],
      [],
      instruction
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
        '--public-page-url', '$MONTEBY_PUBLIC_PAGE_URL',
        '--out-dir', path.join(path.dirname(options.out), 'canonical'),
        '--json',
      ],
      [
        'MONTEBY_ITERATION_REPORT',
        'MONTEBY_PUBLIC_PAGE_URL',
        'PUBLIC_PAGE_URL_CONFIRMED',
      ],
      'Capture and compare the canonical public page at all required full-page viewports.'
    );
  }

  if (
    options.command === 'save'
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
    options.command === 'save'
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
      'Take a new snapshot, reconcile the newer remote layout manually, then revalidate before one explicit save attempt. Do not retry PUT automatically.'
    );
  }

  if (
    report.code === 'VALIDATION_FAILED'
    || report.code === 'INVALID_LAYOUT_INPUT'
    || report.code === 'LAYOUT_SHA256_MISMATCH'
    || report.code === 'SAVE_REPORT_INVALID'
    || report.code === 'SAVE_REPORT_SCOPE_MISMATCH'
  ) {
    const requiresRepair = report.code === 'VALIDATION_FAILED'
      || report.code === 'INVALID_LAYOUT_INPUT';
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
      'show_client_help',
      CLIENT_TOOL,
      ['--help'],
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
    'resolve_error_and_retry',
    CLIENT_TOOL,
    commandArgs(options),
    [authRequirement],
    instruction
  );
}

function withMaterializedNextAction(report, options) {
  return {
    ...report,
    nextAction: materializeNextAction(report, options),
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

function endpointUrl(options, endpoint) {
  return `${options.site}${API_ROOT}${endpoint}`;
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
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();

  let response;
  try {
    response = await fetch(endpointUrl(options, endpoint), {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: expectJson ? 'application/json' : 'application/json, text/html;q=0.9',
        Authorization: authHeader,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
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
        throw new ClientError('REST endpoint returned invalid JSON.', {
          code: 'INVALID_JSON_RESPONSE',
          stage: options.command,
          retryable: response.status >= 500,
          httpStatus: response.status,
          nextAction: 'Inspect the WordPress REST endpoint before running the command again.',
        });
      }
    }
  } else if (expectJson && !trimmed && response.ok) {
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
    reportResponse: responseForReport(data, text),
  };
}

function httpFailureResult(stage, response, artifacts = {}) {
  const status = response.status;
  let code = 'REST_REQUEST_FAILED';
  let retryable = false;
  let nextAction = 'Inspect the REST response and correct the request before running it again.';

  if (status === 409) {
    code = 'REST_CONFLICT';
    nextAction = 'Take a new snapshot, reconcile the remote layout, revalidate, and run save again explicitly.';
  } else if (status === 428) {
    code = 'REST_PRECONDITION_REQUIRED';
    nextAction = 'Take a new snapshot and run save again with its postModifiedGmt precondition.';
  } else if (status === 401) {
    code = 'REST_UNAUTHENTICATED';
    nextAction = 'Replace the configured authorization environment variable and run the command again.';
  } else if (status === 403) {
    code = 'REST_FORBIDDEN';
    nextAction = 'Grant the authenticated WordPress user access to the Monteby endpoint.';
  } else if (status === 404) {
    code = 'REST_NOT_FOUND';
    nextAction = 'Check that Monteby Builder is active, and verify the site URL and page ID.';
  } else if (status === 408 || status === 425 || status === 429 || status >= 500) {
    code = status === 429 ? 'REST_RATE_LIMITED' : 'REST_SERVER_ERROR';
    retryable = true;
    nextAction = 'Check site health, then run the command again explicitly.';
  } else if ((status === 400 || status === 422) && stage === 'validate') {
    code = 'VALIDATION_FAILED';
    nextAction = 'Correct the node map using the validation response, then run validate again.';
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
    response: response.reportResponse,
  });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nodeMapSha256(nodeMap) {
  return createHash('sha256')
    .update(JSON.stringify(nodeMap), 'utf8')
    .digest('hex');
}

function layoutDocument(value) {
  if (isObject(value?.data) && value.postModifiedGmt === undefined && value.data.postModifiedGmt !== undefined) {
    return value.data;
  }
  return value;
}

function extractNodeMap(value) {
  if (isObject(value) && isObject(value.ROOT)) return value;
  if (isObject(value?.nodeMap)) return value.nodeMap;
  if (isObject(value?.layout)) return value.layout;
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

async function runSnapshot(options, authHeader) {
  const artifacts = {
    contract: path.join(options.outDir, 'contract.json'),
    snapshot: path.join(options.outDir, 'layout-before.json'),
  };

  const contractResponse = await request(options, authHeader, {
    method: 'GET',
    endpoint: '/contract',
  });
  if (!contractResponse.ok) {
    return httpFailureResult('snapshot', contractResponse, artifacts);
  }

  const layoutResponse = await request(options, authHeader, {
    method: 'GET',
    endpoint: `/pages/${options.pageId}/layout`,
  });
  if (!layoutResponse.ok) {
    return httpFailureResult('snapshot', layoutResponse, artifacts);
  }

  const pageSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    artifact: 'monteby-page-snapshot',
    site: options.site,
    pageId: options.pageId,
    capturedAt: new Date().toISOString(),
    data: redact(layoutResponse.data, authHeader),
  };
  await atomicWriteMany([
    {
      target: artifacts.contract,
      content: `${JSON.stringify(redact(contractResponse.data, authHeader), null, 2)}\n`,
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
  });
}

async function validateNodeMap(options, authHeader, nodeMap, artifacts) {
  const response = await request(options, authHeader, {
    method: 'POST',
    endpoint: '/validate',
    body: { nodeMap },
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
  return validateNodeMap(options, authHeader, nodeMap, {
    layout: options.layout,
    layoutSha256: nodeMapSha256(nodeMap),
  });
}

function versionToken(document) {
  const token = document?.postModifiedGmt;
  return typeof token === 'string' && token.trim() ? token : '';
}

function snapshotScopeFailure(snapshot, options, artifacts) {
  const structurallyValid = isObject(snapshot)
    && snapshot.schemaVersion === SCHEMA_VERSION
    && snapshot.artifact === 'monteby-page-snapshot'
    && typeof snapshot.site === 'string'
    && Number.isSafeInteger(snapshot.pageId)
    && typeof snapshot.capturedAt === 'string'
    && Number.isFinite(Date.parse(snapshot.capturedAt))
    && isObject(snapshot.data);
  if (!structurallyValid) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'SNAPSHOT_SCOPE_INVALID',
      artifacts,
      nextAction: 'Create a new page-scoped snapshot before validation or save.',
      message: 'Snapshot is missing a valid Monteby page-snapshot provenance envelope.',
    });
  }
  if (snapshot.site !== options.site || snapshot.pageId !== options.pageId) {
    return createResult({
      ok: false,
      stage: 'save',
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
  const candidate = await loadCandidate(options);
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
  const snapshotDocument = layoutDocument(snapshotValue);
  const snapshotVersion = versionToken(snapshotDocument);
  if (!snapshotVersion) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'SNAPSHOT_VERSION_MISSING',
      artifacts,
      nextAction: 'Run snapshot again and keep its unmodified layout-before.json for save.',
      message: 'Snapshot does not contain postModifiedGmt.',
    });
  }

  const freshResponse = await request(options, authHeader, {
    method: 'GET',
    endpoint: `/pages/${options.pageId}/layout`,
  });
  if (!freshResponse.ok) {
    return httpFailureResult('save', freshResponse, artifacts);
  }
  const freshDocument = layoutDocument(freshResponse.data);
  const freshVersion = versionToken(freshDocument);
  if (!freshVersion) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'REST_VERSION_MISSING',
      artifacts,
      nextAction: 'Inspect the page layout endpoint; it must return postModifiedGmt before save is safe.',
      message: 'Current page layout does not contain postModifiedGmt.',
      httpStatus: freshResponse.status,
    });
  }

  if (freshVersion !== snapshotVersion) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'REST_CONFLICT',
      artifacts,
      nextAction: 'Take a new snapshot, reconcile the remote layout, revalidate, and run save again explicitly.',
      message: 'The page changed after the snapshot; no validation or PUT request was sent.',
      httpStatus: 409,
      response: {
        snapshotPostModifiedGmt: snapshotVersion,
        currentPostModifiedGmt: freshVersion,
      },
    });
  }

  const validation = await validateNodeMap(options, authHeader, candidate, artifacts);
  if (!validation.ok) {
    return {
      ...validation,
      stage: 'save',
      nextAction: 'Correct the candidate, run validate, and then run save again with a fresh snapshot if needed.',
    };
  }

  const presentation = isObject(freshDocument?.presentation)
    ? { ...freshDocument.presentation }
    : null;
  if (options.presentationLayout) {
    if (presentation) {
      presentation.layout = options.presentationLayout;
    }
  }
  const effectivePresentation = options.presentationLayout && !presentation
    ? { layout: options.presentationLayout }
    : presentation;
  const payload = {
    expectedModifiedGmt: freshVersion,
    nodeMap: candidate,
    ...(effectivePresentation ? { presentation: effectivePresentation } : {}),
  };
  const saveResponse = await request(options, authHeader, {
    method: 'PUT',
    endpoint: `/pages/${options.pageId}/layout`,
    body: payload,
  });
  if (!saveResponse.ok) {
    return httpFailureResult('save', saveResponse, artifacts);
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

function previewSaveEvidence(saveReport, options, candidateSha256, artifacts) {
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
    );
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
  return {
    evidence: {
      site: saveReport.scope.site,
      pageId: saveReport.scope.pageId,
      layoutSha256: candidateSha256,
      saveReport: options.saveReport,
    },
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

  const previewResponse = await request(options, authHeader, {
    method: 'POST',
    endpoint: '/preview',
    body: { nodeMap },
    expectJson: false,
  });
  if (!previewResponse.ok) {
    return httpFailureResult('preview', previewResponse, artifacts);
  }

  const jsonHtml = findHtml(previewResponse.data);
  const html = jsonHtml || (previewResponse.data === undefined ? previewResponse.text : '');
  let result;
  if (html) {
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
    artifacts.format = 'json';
    result = createResult({
      ok: true,
      stage: 'preview',
      code: 'PREVIEW_OK',
      artifacts,
      nextAction: 'Inspect the preview response artifact before browser comparison.',
      httpStatus: previewResponse.status,
      response: previewResponse.data,
      scope: savedEvidence.scope,
      layoutSha256: candidateSha256,
      evidence: savedEvidence.evidence,
    });
    await atomicWriteJson(
      options.out,
      redact(previewResponse.data ?? { body: previewResponse.text }, authHeader),
      'preview'
    );
  }
  return result;
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
          'show_client_help',
          CLIENT_TOOL,
          ['--help'],
          [],
          'Inspect the local Node.js runtime, then read the client help before running another command.'
        ),
        message: 'The client stopped because of an unexpected local error.',
      }), null, 2)}\n`);
      process.exitCode = 1;
    }
  );
}

module.exports = {
  ClientError,
  createResult,
  extractNodeMap,
  main,
  nodeMapSha256,
  parseArgs,
};
