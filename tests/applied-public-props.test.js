'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const { appliedPropExpectations } = require('../monteby-site-authoring/scripts/verify-public-props');
const { canonicalSha256, operationsSha256 } = require('../monteby-site-authoring/scripts/wordpress-layout-client');

function fixture(props = { textColor: '#654321', fontSize: '48px', fontSizeTablet: '36px', fontSizeMobile: '28px', lineHeight: '1.2' }, unsetProps = []) {
  const nodeMap = {
    schemaVersion: 2,
    ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, nodes: ['section'] },
    section: { type: { resolvedName: 'Section' }, props: {}, nodes: ['heading'], parent: 'ROOT' },
    heading: { type: { resolvedName: 'Heading' }, props: { text: 'Real saved heading', tag: 'h1', fontFamily: '_system_Arial', ...props }, nodes: [], parent: 'section' },
  };
  for (const prop of unsetProps) delete nodeMap.heading.props[prop];
  const publicPageUrl = 'https://site.test/page/';
  const before = { schemaVersion: 1, artifact: 'monteby-page-snapshot', site: 'https://site.test', pageId: 17, publicPageUrl,
    capturedAt: '2026-09-09T10:00:00Z', data: { id: 17, builderJson: JSON.stringify(nodeMap), postModifiedGmt: '2026-09-09 09:59:00' } };
  const saved = { ...structuredClone(before), capturedAt: '2026-09-09T10:02:00Z', data: { ...before.data, postModifiedGmt: '2026-09-09 10:01:00' } };
  const operations = [{ type: 'update_props', nodeId: 'heading', ...(Object.keys(props).length ? { props } : {}), ...(unsetProps.length ? { unsetProps } : {}) }];
  const digest = operationsSha256(operations);
  const candidate = createHash('sha256').update(saved.data.builderJson).digest('hex');
  const scope = { site: before.site, pageId: before.pageId };
  const evidence = { ...scope, publicPageUrl, snapshotSha256: canonicalSha256(before), operationsSha256: digest, candidateLayoutSha256: candidate };
  const response = { operationsSha256: digest, candidateLayoutSha256: candidate, operationCount: operations.length };
  const preflight = { schemaVersion: 1, ok: true, stage: 'patch-validate', code: 'PATCH_VALIDATION_OK', scope, layoutSha256: candidate,
    evidence: { ...evidence, postModifiedGmt: before.data.postModifiedGmt, compiledHtmlSha256: 'a'.repeat(64) },
    response: { ...response, postModifiedGmt: before.data.postModifiedGmt, layout: nodeMap, compiledHtmlSha256: 'a'.repeat(64) } };
  const applied = { schemaVersion: 1, ok: true, stage: 'patch-save', code: 'PATCH_SAVE_OK', scope, layoutSha256: candidate,
    evidence: { ...evidence, previousPostModifiedGmt: before.data.postModifiedGmt, postModifiedGmt: saved.data.postModifiedGmt },
    response: { ...response, builderJson: saved.data.builderJson, postModifiedGmt: saved.data.postModifiedGmt, compiledHtmlSha256: 'a'.repeat(64) } };
  const contract = { components: [{ name: 'Heading', props: [...Object.keys(nodeMap.heading.props), ...unsetProps] }],
    layoutPersistence: { operations: { operationSchemas: Object.fromEntries(['update_props', 'insert_tree', 'duplicate_subtree', 'move_node', 'delete_subtree'].map((type) => [type, {}])) } } };
  return { operations, before, saved, preflight, applied, contract, publicPageUrl };
}

test('applied prop proof derives every responsive expectation from saved JSON, including unitless line height', () => {
  const prepared = appliedPropExpectations(fixture());
  assert.deepEqual(prepared.blockers, []);
  assert.equal(prepared.effects.length, 5);
  assert.equal(prepared.expectations.length, 15);
  assert.ok(prepared.effects.every((effect) => effect.expectationIndexes.length === 3));
  assert.deepEqual(prepared.expectations.filter((entry) => entry.sourceProp === 'lineHeight').map((entry) => entry.expected), ['57.6px', '43.2px', '33.6px']);
  assert.equal(prepared.expectations[0].expected, 'rgb(101, 67, 33)');
  assert.equal(prepared.bindings.candidateDigestFormat, 'sha256:utf8-builderJson');
});

test('applied prop proof rejects tampered batch, scope, revision, bytes and omitted saved values', () => {
  for (const mutate of [
    (f) => { f.operations[0].props.fontSize = '49px'; },
    (f) => { f.applied.scope.pageId = 18; },
    (f) => { f.saved.publicPageUrl = 'https://site.test/wrong/'; },
    (f) => { f.saved.data.postModifiedGmt = 'changed'; },
    (f) => { f.before.data.postModifiedGmt = 'changed'; },
    (f) => { f.saved.data.builderJson += '\n'; },
    (f) => { f.preflight.response.layout.heading.props.fontSize = 'changed'; },
    (f) => { f.applied.response.operationCount = 0; },
    (f) => { delete f.preflight.evidence.compiledHtmlSha256; },
    (f) => { delete f.contract.layoutPersistence; },
  ]) {
    const input = fixture(); mutate(input);
    assert.throws(() => appliedPropExpectations(input), /prop_/);
  }
});

test('applied prop proof requires matching preflight and apply compiled HTML evidence before capture', () => {
  const matching = appliedPropExpectations(fixture());
  assert.equal(matching.bindings.compiledHtmlSha256, 'a'.repeat(64));
  for (const field of ['preflightEvidence', 'preflightResponse', 'applyResponse']) {
    for (const digest of [undefined, null, '', 'broken', 'A'.repeat(64), 'a'.repeat(63), 'b'.repeat(64)]) {
      const input = fixture();
      const target = field === 'preflightEvidence' ? input.preflight.evidence : field === 'preflightResponse' ? input.preflight.response : input.applied.response;
      if (digest === undefined) delete target.compiledHtmlSha256;
      else target.compiledHtmlSha256 = digest;
      assert.throws(() => appliedPropExpectations(input), digest === 'b'.repeat(64) ? /prop_compiled_html_render_drift/ : /prop_compiled_html_evidence_invalid/);
    }
  }
});

test('applied prop proof blocks unsupported properties, unknown and structural operations, unresolved resets and overwrites', () => {
  for (const props of [{ shadowBlur: '4px' }, { fontSize: '2rem' }, { textColor: 'var(--missing)' }, { text: '' }]) {
    assert.ok(appliedPropExpectations(fixture(props)).blockers.length > 0);
  }
  assert.ok(appliedPropExpectations(fixture({}, ['fontSize'])).blockers.length > 0);
  for (const type of ['insert_tree', 'duplicate_subtree', 'move_node', 'delete_subtree', 'unknown']) {
    const input = fixture(); input.operations[0] = { type, nodeId: 'heading' };
    const digest = operationsSha256(input.operations);
    for (const report of [input.preflight, input.applied]) { report.response.operationsSha256 = digest; report.evidence.operationsSha256 = digest; }
    assert.ok(appliedPropExpectations(input).blockers.some((entry) => /operation/u.test(entry.code)));
  }
  const input = fixture(); input.operations.push(structuredClone(input.operations[0]));
  for (const report of [input.preflight, input.applied]) { report.response.operationsSha256 = operationsSha256(input.operations); report.evidence.operationsSha256 = operationsSha256(input.operations); report.response.operationCount = 2; }
  assert.ok(appliedPropExpectations(input).blockers.some((entry) => entry.code === 'overwritten_effect_unobservable'));
});

test('applied prop proof resolves published token references and intentional zero without consulting captures', () => {
  const input = fixture({ textColor: 'var(--monteby-token-brand)', marginTop: '0' });
  input.contract.designTokens = { tokens: { 'colors.brand': { value: '#654321', reference: 'var(--monteby-token-brand)' } } };
  const result = appliedPropExpectations(input);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.expectations[0].expected, 'rgb(101, 67, 33)');
  assert.equal(result.expectations[3].expected, '0px');
});

test('applied prop proof covers responsive reset inheritance and rejects a removed property hidden behind valid bindings', () => {
  const reset = appliedPropExpectations(fixture({ fontSize: '48px', fontSizeTablet: '36px' }, ['fontSizeMobile']));
  assert.deepEqual(reset.blockers, []);
  assert.deepEqual(reset.expectations.filter((entry) => entry.sourceProp === 'fontSizeMobile').map((entry) => entry.expected), ['48px', '36px', '36px']);
  const input = fixture();
  const changed = JSON.parse(input.saved.data.builderJson);
  delete changed.heading.props.textColor;
  input.saved.data.builderJson = JSON.stringify(changed);
  input.preflight.response.layout = changed;
  input.applied.response.builderJson = input.saved.data.builderJson;
  const digest = createHash('sha256').update(input.saved.data.builderJson).digest('hex');
  for (const report of [input.preflight, input.applied]) {
    report.layoutSha256 = digest; report.evidence.candidateLayoutSha256 = digest; report.response.candidateLayoutSha256 = digest;
  }
  assert.ok(appliedPropExpectations(input).blockers.some((entry) => entry.code === 'applied_prop_not_saved' && entry.sourceProp === 'textColor'));
});

test('canonical prop mode self-renders and brackets four-width captures with authenticated snapshots; rejects failures', () => {
  const script = path.resolve(__dirname, '../monteby-site-authoring/scripts/run-canonical-verification.js');
  const originalRequire = createRequire(script);
  for (const fault of ['', 'wrapper', 'beforeVersion', 'afterVersion', 'contract', 'url', 'renderedUrl', 'missing375', 'empty375', 'overflow', 'truncated', 'ambiguous', 'wrongValue', 'snapshotExit', 'inputMutation']) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-applied-props-'));
    try {
      const input = fixture();
      const options = { verifyProps: true, publicPageUrl: input.publicPageUrl, outDir: directory, waitMs: '0', playwrightPackage: 'fake', authHeaderEnv: 'TEST_AUTH' };
      if (fault === 'wrapper') options.wordpressWrapper = '/trusted/local-qa.mjs';
      for (const [key, value] of Object.entries({ operations: input.operations, patchReport: input.preflight, applyReport: input.applied, beforeSnapshot: input.before, savedSnapshot: input.saved, contract: input.contract })) {
        options[key] = path.join(directory, key + '.json'); fs.writeFileSync(options[key], JSON.stringify(value));
      }
      const calls = [];
      const child = { spawnSync(command, args) {
        if (args[0] === '/trusted/local-qa.mjs') {
          assert.equal(args[1], 'skill'); args = args.slice(2);
        }
        const scriptName = path.basename(args[0]); calls.push(scriptName);
        assert.equal(command, process.execPath);
        const value = (name) => args[args.indexOf(name) + 1];
        const outDir = value('--out-dir'); fs.mkdirSync(outDir, { recursive: true });
        if (scriptName === 'wordpress-layout-client.js') {
          assert.equal(args[1], 'snapshot');
          if (fault === 'snapshotExit') return { status: 1 };
          const saved = structuredClone(input.saved);
          if ((fault === 'beforeVersion' && calls.length === 1) || (fault === 'afterVersion' && calls.length > 1)) saved.data.postModifiedGmt = 'changed';
          fs.writeFileSync(path.join(outDir, 'layout-before.json'), JSON.stringify(saved));
          fs.writeFileSync(path.join(outDir, 'contract.json'), JSON.stringify(fault === 'contract' ? {} : input.contract));
          fs.writeFileSync(value('--out'), JSON.stringify({ ok: true, code: 'SNAPSHOT_OK', scope: input.applied.scope }));
          if (fault === 'inputMutation' && calls.length > 1) fs.appendFileSync(options.operations, ' ');
        } else {
          assert.equal(scriptName, 'capture-template-reference.js');
          assert.equal(args.flatMap((arg, index) => arg === '--viewport' ? [args[index + 1]] : []).join(','), 'desktop:1440x1200,tablet:834x1112,mobile:390x844,stress:375x844');
          const diagnostic = args.includes('--html-file');
          if (diagnostic) assert.match(fs.readFileSync(value('--html-file'), 'utf8'), /data-monteby-node-id="heading"/);
          fs.writeFileSync(path.join(outDir, 'reference-manifest.json'), JSON.stringify({ sourceUrl: fault === 'url' ? 'https://site.test/wrong/' : input.publicPageUrl, evidenceCompleteness: { complete: fault !== 'truncated' } }));
          for (const [index, width] of [1440, 834, 390, 375].entries()) {
            if (fault === 'missing375' && width === 375) continue;
            const surface = { ...(diagnostic ? { montebyNodeId: 'heading' } : {}), tag: 'h1', text: 'Real saved heading', color: fault === 'wrongValue' ? 'red' : 'rgb(101, 67, 33)',
              fontSize: ['48px', '36px', '28px', '28px'][index], lineHeight: ['57.6px', '43.2px', '33.6px', '33.6px'][index], rect: { left: 0, right: width, width, height: 80 } };
            const layout = { url: fault === 'renderedUrl' ? 'https://site.test/wrong/' : input.publicPageUrl, viewport: { width, scrollWidth: fault === 'overflow' ? width + 10 : width, scrollHeight: 1000 }, evidenceCompleteness: { complete: true },
              textBoxes: fault === 'empty375' && width === 375 ? [] : [surface], layoutGroups: [], landmarks: [] };
            if (fault === 'ambiguous' && !diagnostic) layout.textBoxes.push({ ...surface });
            const suffix = ['', '-tablet', '-mobile', '-stress'][index];
            fs.writeFileSync(path.join(outDir, `reference-layout${suffix}.json`), JSON.stringify(layout));
          }
        }
        return { status: 0, stdout: '', stderr: '' };
      } };
      const module = { exports: {} };
      vm.runInNewContext(fs.readFileSync(script, 'utf8'), { require: (name) => name === 'node:child_process' ? child : originalRequire(name), module, exports: module.exports,
        __dirname: path.dirname(script), __filename: script, process, console, URL, Buffer, JSON });
      const report = { ok: false, fidelityPassed: false, productReady: false, canonicalVerification: false, files: {}, steps: {} };
      if (fault && !['wrongValue', 'wrapper'].includes(fault)) assert.throws(() => module.exports.verifyAppliedProps(options, report), undefined, fault);
      else {
        module.exports.verifyAppliedProps(options, report);
        assert.equal(report.status, fault === 'wrongValue' ? 'PUBLIC_PROPS_FAILED' : 'PUBLIC_PROPS_VERIFIED');
        assert.equal(report.ok, fault !== 'wrongValue');
        assert.equal(report.fidelityPassed, false); assert.equal(report.productReady, false);
        assert.deepEqual(calls, ['wordpress-layout-client.js', 'capture-template-reference.js', 'capture-template-reference.js', 'wordpress-layout-client.js']);
      }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
});
