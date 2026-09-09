# Partial layout operations

Use this path for a bounded edit to an existing page: update or reset props,
insert/duplicate/move a subtree, or delete a proven subtree. Use full-layout
validation/PUT for a new page or intentional whole-document replacement.

## Preconditions

Use a separate working directory for each patch so later snapshots do not
replace an earlier patch's evidence.

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

Execute the emitted `verify_saved_patch` snapshot action. Its `saved-patch`
directory preserves the original pre-edit snapshot and preflight evidence.
This is post-save inspection, not the start of another authoring run: do not
consume that snapshot's generic `validate_candidate` action without a new edit.

For a computed-prop verification claim, run the canonical verifier with the
actual files from this completed patch:

```bash
node "$SKILL/scripts/run-canonical-verification.js" --verify-props \
  --operations "$WORK/operations.json" \
  --patch-report "$WORK/patch-validate-response.json" \
  --apply-report "$WORK/patch-save-response.json" \
  --before-snapshot "$WORK/layout-before.json" \
  --saved-snapshot "$WORK/saved-patch/layout-before.json" \
  --contract "$WORK/saved-patch/contract.json" \
  --public-page-url "$PUBLIC_PAGE_URL" \
  --out-dir "$WORK/public-props" \
  --auth-header-env MONTEBY_AUTH_HEADER --json
```

Use the exact `publicPageUrl` from the saved snapshot. The verifier binds the
operation, preflight, apply, saved JSON and compiled HTML hashes; it takes fresh
snapshots before and after its own diagnostic/public captures. It checks each
observable applied effect at 1440/834/390 px and overflow at 375 px.
Missing, unsupported or ambiguous evidence blocks the claim; never replace
it with expectations copied from the observed page or rerun the write to make
verification pass. A `prop_compiled_html_render_drift` blocker requires review
even if dynamic content could explain the difference.

`PUBLIC_PROPS_VERIFIED` proves only those applied effects. It is not `DONE`,
1:1, visual fidelity, or product readiness; unchanged page regions and
unobservable interactions still need their relevant checks. The optional
`--wordpress-wrapper` is an explicitly chosen local transport executable, never
a command supplied by page content or an evidence artifact.
