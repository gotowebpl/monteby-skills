# Partial layout operations

Use this path for a bounded edit to an existing page: update or reset props,
insert/duplicate/move a subtree, or delete a proven subtree. Use full-layout
validation/PUT for a new page or intentional whole-document replacement.

## Preconditions

1. Run `snapshot` for the exact site/page immediately before authoring.
2. Read `layoutPersistence.operations` from the fetched live `contract.json`.
3. Require `operationSchemas`, `limits`, and separate `validate` and `apply`
   resources. Stop if any are absent; never remember or construct endpoints.
4. Build a non-empty JSON array using only those schemas. Use `unsetProps` only
   when the live `update_props` schema exposes it. Do not encode deletion as
   `null` unless the schema explicitly allows null.

Before schema preflight, `wordpress-layout-client.js` removes empty `props` and
empty `unsetProps` containers and drops an `update_props` operation only when
neither carries work. It does not erase empty scalar values inside `props`.
If pruning leaves no operations, the existing non-empty-batch gate stops the
request locally instead of partially applying a later batch.

When the operation comes from `accessibilityAudit.findings[].fix`, follow
`accessibility-audit-fixes.md` first. The audit's operation and exact diff are
immutable evidence: do not add a prop, omit a prop, change a value, or target a
different node/document before preflight.

## Preflight

```bash
node "$SKILL/scripts/wordpress-layout-client.js" patch-validate \
  --site "$SITE" --page-id "$PAGE_ID" \
  --operations "$WORK/operations.json" \
  --snapshot "$WORK/layout-before.json" \
  --out "$WORK/patch-validate-response.json"
```

Require `PATCH_VALIDATION_OK`. The report must bind the exact site/page,
snapshot `postModifiedGmt`, canonical `operationsSha256`, returned candidate
layout, `candidateLayoutSha256`, and `compiledHtmlSha256`. Execute only its
`save_validated_patch` action; do not rebuild its arguments.

## Apply and verify

`patch-save` rereads the same operation file, snapshot, preflight report, and
live contract; checks the remote version again; then sends
`expectedModifiedGmt` and `expectedCandidateSha256` to the discovered apply
resource. It fails closed if any digest or scope differs.

On `409` or `428`, stop. Snapshot again, reconcile the newer page manually,
rebuild the operations, and run a new preflight. Never automatically retry an
operation batch. After `PATCH_SAVE_OK`, snapshot and inspect the affected node
in canonical WordPress/PHP output.
