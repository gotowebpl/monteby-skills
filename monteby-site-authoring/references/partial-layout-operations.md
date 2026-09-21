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
snapshot version plus canonical layout digest, canonical `operationsSha256`,
returned candidate layout, `candidateLayoutSha256`, and `compiledHtmlSha256`.
Execute only its
`save_validated_patch` action; do not rebuild its arguments.

## Apply and verify

`patch-save` rereads the same operation file, snapshot, preflight report, and
live contract; checks the remote version and layout digest again; then sends
the descriptor-named version, layout, candidate, and compiled-output
preconditions to the discovered apply resource. It fails closed if any digest,
page identity, or scope differs. An unchanged response token is valid only when
the readback proves that the operation batch was a no-op.

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

## Builder 1.6 additions

Every item below is gated by `productVersion >= 1.6.0` and the named
capability in `references/site-contract-compatibility.json`; an older Builder
keeps the flow above unchanged. Discover each route in the live
`layoutPersistence` block of the fetched contract; never construct it.

### Lint and changed-node insight in validate responses

`POST /monteby/v1/validate` and the operations preflight return `lint[]`
(`{ ruleId, level, nodeId, component, message, fix? }`), evaluated server-side
from the published `authoring.lint` rules; the preflight limits it to the
nodes in `changedNodeIds.inserted` and `updated`. Findings never change
`valid`: an `error`-level finding describes a render that passes validation
but breaks the editor canvas, so carry it as a repair entry with an explicit
decision, never as a silent pass. The preflight and apply responses also
return `documentType` (`page|header|footer|template`) and `changedNodeIds`
`{ inserted[], updated[], moved[], deleted[] }`; compare them with the batch
you sent before executing `save_validated_patch`. Validation errors carry
`operationIndex` (the last operation that touched the node named by `path`,
or `null`) and operation batch errors carry `path` and `message`: repair the
named operation instead of resending the batch. The server never normalizes
prop values (`invalid_prop_range`, `invalid_prop_step`), so run
`normalize-layout.js` before preflight.

### Revision restore

`PUT /monteby/v1/pages/{id}/layout`, the operations apply route and
`template-create` return `revisionId` (0 when the host cannot report
revisions); record it in the save report. To roll back, send
`POST /monteby/v1/pages/{id}/layout/restore { revisionId, expectedModifiedGmt,
expectedDocumentSha256 }`. Read both `currentPostModifiedGmt` and
`currentDocumentSha256` from one fresh revision-list response immediately before
the write, then use them as the two preconditions. It is a versioned write
(`428`/`409` apply, one mutation token, theme write availability) that returns
the restored `layout`, `documentSha256`, and a fresh `postModifiedGmt`; a
revision of another document answers `404`. Restore only a `revisionId` recorded
by this workflow's own save evidence whose revision-list item reports
`hasLayout: true`. The host rejects a missing or corrupt target layout before
mutation. Then snapshot and inspect the canonical WordPress/PHP output as after
any save. A restore conflict is reconciled manually, never retried.

### Preview options

`POST /monteby/v1/preview` accepts `nodeId` (render only that subtree after
the whole candidate validated), `assets: true` (`assets: { styles[],
inlineCss, scripts[] }` for an embeddable fragment), `document: true` (a
standalone page with the fonts and variables the public site would use),
`globalTemplates: true` (only with `document: true`; frames the fragment with
the active header and footer, gate `previewGlobalTemplates`),
`annotateNodeIds: true` (`data-monteby-node-id` and `data-monteby-component`
on each node's first element, gate `annotatedRender`) and a `globalStyles`
candidate (gate `renderGlobalStylesFilter`, see
`global-styles-authoring.md`). None of them writes, and none replaces the
canonical PHP review of the saved page.
