'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  validateQueryControlRelationships,
} = require('../monteby-site-authoring/scripts/control-contract');

const scripts = path.resolve(__dirname, '../monteby-site-authoring/scripts');
const kitModule = import(path.join(scripts, 'layout-kit.mjs'));

function contract() {
  const queryIdControl = { type: 'text', props: ['queryId'], pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' };
  return {
    components: [
      { name: 'Section', isCanvas: true, props: [], allowedParents: ['ROOT'] },
      {
        name: 'QueryLoop',
        props: ['queryId', 'source', 'postType', 'sortOptions'],
        allowedParents: ['Section'],
        controls: [
          queryIdControl,
          { type: 'select', props: ['source'], options: ['custom', 'inherit'] },
          { type: 'select', props: ['postType'], options: ['post', 'page'] },
          {
            type: 'repeater',
            props: ['sortOptions'],
            itemControls: [{ type: 'text', props: ['id'] }],
          },
        ],
      },
      {
        name: 'FilterBar',
        props: ['queryId', 'postType'],
        allowedParents: ['Section'],
        controls: [queryIdControl, { type: 'select', props: ['postType'], options: ['post', 'page'] }],
      },
      ...['SearchControl', 'SortControl', 'ActiveFilters'].map((name) => ({
        name,
        props: ['queryId'],
        allowedParents: ['Section'],
        controls: [queryIdControl],
      })),
    ],
    authoring: {
      blockedProps: [],
      topLevelRootComponents: ['Section'],
      relationshipRules: {
        queryControls: {
          loopComponent: 'QueryLoop',
          controlComponents: ['FilterBar', 'SearchControl', 'SortControl', 'ActiveFilters'],
          referenceProp: 'queryId',
          requiresExplicitId: true,
          requiresExactlyOne: true,
          inheritSourceAllowed: false,
          postTypeParityComponents: ['FilterBar'],
          sortOptionsRequiredComponents: ['SortControl'],
        },
      },
    },
  };
}

function node(component, props = {}, parent = 'section') {
  return { type: { resolvedName: component }, props, parent, nodes: [], isCanvas: false };
}

function layout() {
  return {
    ROOT: { type: { resolvedName: 'RootCanvas' }, props: {}, parent: null, nodes: ['section'], isCanvas: true },
    section: {
      type: { resolvedName: 'Section' },
      props: {},
      parent: 'ROOT',
      nodes: ['loop', 'filter', 'search', 'sort', 'active'],
      isCanvas: true,
    },
    loop: node('QueryLoop', {
      queryId: 'articles', source: 'custom', postType: 'post', sortOptions: [{ id: 'newest' }],
    }),
    filter: node('FilterBar', { queryId: 'articles', postType: 'post' }),
    search: node('SearchControl', { queryId: 'articles' }),
    sort: node('SortControl', { queryId: 'articles' }),
    active: node('ActiveFilters', { queryId: 'articles' }),
  };
}

function finding(nodeMap, code) {
  return validateQueryControlRelationships(nodeMap, contract()).find((entry) => entry.code === code);
}

test('queryControls relationship accepts one explicit QueryLoop shared by all published controls', () => {
  assert.deepEqual(validateQueryControlRelationships(layout(), contract()), []);
  assert.deepEqual(validateQueryControlRelationships(layout(), { components: [] }), []);
});

test('queryControls relationship reports duplicate, orphaned, inherited and incomplete graphs precisely', () => {
  const duplicate = layout();
  duplicate.loop2 = node('QueryLoop', { ...duplicate.loop.props });
  duplicate.section.nodes.push('loop2');
  assert.deepEqual(
    validateQueryControlRelationships(duplicate, contract())
      .filter((entry) => entry.code === 'duplicate_query_loop_id')
      .map((entry) => entry.path),
    ['loop.queryId', 'loop2.queryId']
  );

  const orphan = layout();
  orphan.search.props.queryId = 'missing';
  assert.deepEqual(finding(orphan, 'orphan_query_control'), {
    code: 'orphan_query_control',
    path: 'search.queryId',
    message: 'SearchControl must reference exactly one explicitly named QueryLoop.',
  });

  const implicit = layout();
  delete implicit.search.props.queryId;
  assert.equal(finding(implicit, 'orphan_query_control').path, 'search.queryId');

  const inherited = layout();
  inherited.loop.props.source = 'inherit';
  assert.deepEqual(finding(inherited, 'unsupported_inherited_query_control'), {
    code: 'unsupported_inherited_query_control',
    path: 'filter.queryId',
    message: 'Public QueryLoop controls cannot bind to source="inherit" because the page query owns that URL.',
  });
});

test('queryControls relationship enforces FilterBar postType parity and stored SortControl options', () => {
  const mismatch = layout();
  mismatch.filter.props.postType = 'page';
  assert.deepEqual(finding(mismatch, 'query_control_post_type_mismatch'), {
    code: 'query_control_post_type_mismatch',
    path: 'filter.postType',
    message: 'FilterBar and its QueryLoop must use the same postType.',
  });

  const unsortable = layout();
  unsortable.loop.props.sortOptions = [];
  assert.deepEqual(finding(unsortable, 'query_sort_options_missing'), {
    code: 'query_sort_options_missing',
    path: 'sort.queryId',
    message: 'SortControl requires at least one stored sort option on its QueryLoop.',
  });
});

test('queryControls relationship rejects incomplete live rule metadata instead of guessing', () => {
  const malformed = contract();
  delete malformed.authoring.relationshipRules.queryControls.referenceProp;
  assert.deepEqual(validateQueryControlRelationships(layout(), malformed), [{
    code: 'invalid_relationship_contract',
    path: 'authoring.relationshipRules.queryControls',
    message: 'The live queryControls relationship contract is incomplete.',
  }]);
});

test('Layout Kit rejects a QueryLoop relationship that scalar control validation cannot detect', async () => {
  const { Kit } = await kitModule;
  const kit = new Kit(contract());
  const loop = kit.node('QueryLoop', {
    queryId: 'articles', source: 'custom', postType: 'post', sortOptions: [],
  });
  const sort = kit.node('SortControl', { queryId: 'articles' });
  const section = kit.node('Section', {}, [loop, sort]);

  assert.throws(
    () => kit.build([section]),
    /relationship plan rejected: sortcontrol-2\.queryId: SortControl requires at least one stored sort option/u
  );
});

test('normalizer and clean-layout audit report the same orphan without repairing its queryId', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monteby-query-controls-'));
  const contractPath = path.join(directory, 'contract.json');
  const layoutPath = path.join(directory, 'layout.json');
  const fixedPath = path.join(directory, 'fixed.json');
  const orphan = layout();
  orphan.search.props.queryId = 'missing';
  fs.writeFileSync(contractPath, JSON.stringify(contract()));
  fs.writeFileSync(layoutPath, JSON.stringify(orphan));

  for (const script of ['normalize-layout.js', 'audit-monteby-layout.js']) {
    const args = [
      path.join(scripts, script),
      '--contract', contractPath,
      '--layout', layoutPath,
      '--json',
    ];
    if (script === 'normalize-layout.js') args.push('--fix', fixedPath);
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 1, `${script}: ${result.stderr || result.stdout}`);
    const report = JSON.parse(result.stdout);
    assert.equal(
      report.errors.some((entry) => entry.code === 'orphan_query_control'
        && (entry.prop === 'queryId' || entry.message.startsWith('search.queryId:'))),
      true,
      script
    );
  }

  const fixed = JSON.parse(fs.readFileSync(fixedPath, 'utf8'));
  assert.equal(fixed.search.props.queryId, 'missing');
});
