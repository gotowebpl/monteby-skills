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
const CONTRACT_ENDPOINT = '/contract';
const REST_NAMESPACE = '/monteby/v1';
const COMMANDS = new Set([
  'snapshot',
  'validate',
  'save',
  'preview',
  'patch-validate',
  'patch-save',
  'branding-snapshot',
  'branding-save',
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
  const brandingWrite = stage === 'branding-save';
  const brandingCommand = brandingWrite || stage === 'branding-snapshot';
  let code = 'REST_REQUEST_FAILED';
  let retryable = false;
  let nextAction = 'Inspect the REST response and correct the request before running it again.';

  if (status === 409) {
    code = 'REST_CONFLICT';
    nextAction = brandingWrite
      ? 'Take a new branding snapshot, review the newer identity, and issue one explicit save without retrying automatically.'
      : 'Take a new snapshot, reconcile the remote layout and version token, revalidate, and run save again explicitly.';
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
    response: response.reportResponse,
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
  return createHash('sha256').update(canonicalJson(operations), 'utf8').digest('hex');
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

function canonicalSha256(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
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
  const representationDigest = nodeMap ? nodeMapSha256(nodeMap) : '';
  return {
    document,
    nodeMap,
    versionToken: versionToken(document, capability.versionField),
    declaredDigest: validSha(declaredDigest) ? declaredDigest : '',
    representationDigest,
    validIdentity: document?.id === pageId,
    validRepresentation: Boolean(
      nodeMap
      && validSha(declaredDigest)
      && declaredDigest === representationDigest
    ),
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
      nextAction: `Repair the versioned layout resource so it returns id, postType, viewUrl, ${layoutResource.versionField}, ${layoutResource.layoutDigestField}, and the exact saved representation for the requested document.`,
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
  ) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'SNAPSHOT_EVIDENCE_INVALID',
      artifacts,
      nextAction: 'Run snapshot again and keep its unmodified layout-before.json for save.',
      message: `Snapshot does not bind page identity, ${pageResource.versionField}, ${pageResource.layoutDigestField}, and the exact layout representation.`,
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
  if (!freshVersion || !freshEvidence.validIdentity || !freshEvidence.validRepresentation) {
    return createResult({
      ok: false,
      stage: 'save',
      code: 'REST_LAYOUT_EVIDENCE_INVALID',
      artifacts,
      nextAction: `Inspect the page layout endpoint; it must return the requested id, ${pageResource.versionField}, ${pageResource.layoutDigestField}, and matching layout representation before save is safe.`,
      message: 'Current page layout does not contain complete page-scoped version and representation evidence.',
      httpStatus: freshResponse.status,
      response: freshResponse.data,
    });
  }

  if (
    freshVersion !== snapshotVersion
    || freshEvidence.declaredDigest !== snapshotEvidence.declaredDigest
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
      },
    });
  }

  if (options.presentationLayout && !isObject(freshDocument?.presentation)) {
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

  const presentation = isObject(freshDocument?.presentation)
    ? { ...freshDocument.presentation }
    : null;
  if (options.presentationLayout) {
    if (presentation) {
      presentation.layout = options.presentationLayout;
      if (options.presentationLayout === 'canvas') {
        presentation.disableGlobalTemplates = true;
      }
    }
  }
  const effectivePresentation = options.presentationLayout && !presentation
    ? {
      layout: options.presentationLayout,
      ...(options.presentationLayout === 'canvas' ? { disableGlobalTemplates: true } : {}),
    }
    : presentation;
  const payload = {
    [pageResource.writePreconditionField]: freshVersion,
    [pageResource.writeDigestPreconditionField]: freshEvidence.declaredDigest,
    [pageResource.writeCandidatePreconditionField]: validatedCandidateSha256,
    [pageResource.carrier]: candidate,
    ...(effectivePresentation ? { presentation: effectivePresentation } : {}),
  };
  const saveResponse = await request(options, authHeader, {
    method: pageResource.writeMethod,
    endpoint: pageResource.endpoint,
    body: payload,
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
    || (
      savedVersion === freshVersion
      && savedEvidence.declaredDigest !== freshEvidence.declaredDigest
    )
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
    || readbackVersion !== savedVersion
    || readbackLayoutSha256 !== savedLayoutSha256
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
    || (
      savedVersion === prepared.expectedVersionToken
      && savedEvidence.declaredDigest !== prepared.expectedLayoutSha256
    )
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
    && (saveReport.evidence.versionAdvanced || !saveReport.evidence.layoutChanged)
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
  pruneNoopOperations,
};
