# Mechanical runbook: owned HTML → canonical Monteby

Use this runbook only in `owned-html-reconstruction` mode. The HTML, text, fonts,
and assets must belong to the user/project or be explicitly licensed for reuse.
Otherwise stop with `blocked_source_rights` and restart in
`external-reference-benchmark` mode with replacement content.

Read `mechanical-workflow-protocol.md` first. At every phase, execute only the
report's `nextAction`. It is an ordered object with `id`, `tool`, `args`,
`requires`, and `instruction`; do not choose another tool or reconstruct argv.

For an arg token exactly equal to `$NAME`, resolve `NAME` from `requires` and
substitute the approved value directly, without shell expansion. An unresolved
required token is a hard stop.

## Inputs

Resolve these before phase 1:

- `SKILL`: absolute path to `monteby-site-authoring`;
- `WORK`: project-owned artifact directory, normally `.monteby`;
- `SITE`: WordPress base URL, without credentials;
- `PAGE_ID`: exact target page ID;
- `PUBLIC_PAGE_URL`: canonical public URL of that page;
- `REFERENCE_HTML`: absolute path to the owned/licensed HTML file;

The WordPress client reads authentication from the environment variable named
`MONTEBY_AUTH_HEADER`. Populate it through the project's approved secret
mechanism. Never paste its value, a password, application password, cookie, nonce,
or bearer token into a command, report, plan, shell history, or committed file.

Require a current backup/rollback path before the first write.

## Phase table

| Phase | Required inputs | Required artifacts | Command | Pass condition | Failure action | Allowed verdict |
|---|---|---|---|---|---|---|
| 0. Rights and target | Ownership/license evidence, site/page/public URL, HTML path, rollback owner | Recorded mode and rights decision | No authoring command | Source may be reused; target and rollback are exact | Unknown rights → stop and use external-reference mode. Unknown target/rollback → stop | `continue`, `blocked_source_rights`, or `blocked_target` |
| 1. Discover exact live target | Phase 0, approved auth environment | `contract.json`; page-scoped discovery `layout-before.json`; snapshot report | `wordpress-layout-client.js snapshot` | Contract exposes components/layout persistence; snapshot has `artifact: "monteby-page-snapshot"` and this exact site/page | Missing contract or scope mismatch → stop; never substitute a policy file, fixture, remembered contract, or another page's snapshot | `continue` or `blocked_live_contract_unavailable` |
| 2. Full measured iteration and plan | Live contract, owned HTML | Complete reference captures/layouts; `visual-iteration-report.json`; exact `files.layout`; exact `files.layoutPlan` | `run-visual-iteration.js --full-page` at all three viewports; runner internally invokes `draft-monteby-layout.js --plan-out` | Capture is complete; plan uses `generic-measured-reference`, maps every band, is untruncated, and omits nothing; report ends `diagnostic_passed` | Consume the report's blocker/queue; never redraft manually or relax evidence with a tolerance shortcut | `diagnostic_passed`, `blocked_incomplete_evidence`, `blocked_product_gap`, or `failed` |
| 3. Bounded AUTHOR loop, only if emitted | Iteration report with non-empty `repairQueue` | Updated candidate plus rerun report | Apply only named `sectionId` edits; execute the emitted `run-visual-iteration.js` action | Queue gate is satisfied and the rerun reaches `diagnostic_passed` without regressing passing sections | Missing reusable capability → separate `product-gap` run; otherwise repair only reported sections and rerun the exact action | `diagnostic_passed`, `blocked_product_gap`, or `failed` |
| 4. Fresh canonical snapshot | Passing iteration report, its exact layout, approved auth environment | Fresh `contract.json`; page-scoped `layout-before.json`; snapshot report | Execute emitted `snapshot_canonical_page` action | Snapshot matches the exact site/page and its next action is `validate_candidate` | Scope/version evidence missing → stop; do not reuse discovery evidence from another page or run | `continue` or `blocked_live_contract_unavailable` |
| 5. Live validation | Exact `files.layout` from phase 2/3 | `validate-response.json` containing `layoutSha256` | Resolve `MONTEBY_LAYOUT_PATH` in emitted `validate_candidate`; execute ordered argv | Server accepts that exact node map; `nextAction.id` is `save_validated_candidate` and carries the same hash | Repair from live errors, rerun the local path, and snapshot again; never save rejected or different JSON | `continue` or `failed` |
| 6. Versioned save | Validated layout, matching fresh snapshot, validation hash | Required `save-response.json`, before/after version evidence | Execute emitted `save_validated_candidate` with `--snapshot`, `--expected-layout-sha256`, and `--out` | Save succeeds with snapshot `postModifiedGmt`; presentation is preserved/explicit; next action is `preview_saved_candidate` | `428`/`409` → execute `resnapshot_and_reconcile`, manually reconcile, revalidate; never auto-retry PUT | `continue`, `blocked_concurrent_edit`, or `failed` |
| 7. PHP preview | Saved candidate and successful save report | `preview.html`; required `preview-response.json` | Execute emitted `preview_saved_candidate` with `--save-report` and `--report-out` | Preview is bound to the successful save; `nextAction.id` is `verify_canonical_page` | Return through repair/validation/save; preview cannot prove 1:1 | `continue` or `failed` |
| 8. Canonical capture + comparison | Passing iteration report, successful preview report, confirmed saved public URL | Complete canonical screenshots/layouts/manifest at 1440, 834, 390; benchmark/diffs; canonical report | Resolve the emitted `verify_canonical_page` action, including `--preview-report`; execute ordered argv | `status: "DONE"`, `ok`, `fidelityPassed`, and `canonicalVerification` are true; direct review finds no mismatch | Consume blockers and section-addressed queue; make a bounded AUTHOR edit; then repeat validation, save, preview, and canonical verification through emitted actions | `canonical_verified_1_to_1`, `blocked_incomplete_evidence`, `blocked_product_gap`, or `failed` |

## Commands and gates

The commands below contain no secret value. Prefer the exact emitted
`nextAction.args` when a report is already available.

### 1 — Snapshot exact site/page

```bash
node "$SKILL/scripts/wordpress-layout-client.js" snapshot \
  --site "$SITE" \
  --page-id "$PAGE_ID" \
  --out-dir "$WORK" \
  --out "$WORK/discovery-response.json" \
  --auth-header-env MONTEBY_AUTH_HEADER
```

Require `$WORK/contract.json` and `$WORK/layout-before.json`. The snapshot shape is:

```json
{
  "schemaVersion": 1,
  "artifact": "monteby-page-snapshot",
  "site": "canonical-site-origin",
  "pageId": 123,
  "capturedAt": "timestamp",
  "data": {}
}
```

Never reuse the envelope for another site or page.

The discovery snapshot's `validate_candidate` action initially lacks
`MONTEBY_LAYOUT_PATH`. Phase 2 exists solely to produce that required artifact.
Do not substitute an older or hand-authored layout. Once the runner emits its
fresh `snapshot_canonical_page` action, that newer action and snapshot govern the
canonical chain.

### 2 — Run the measured generic loop

```bash
node "$SKILL/scripts/run-visual-iteration.js" \
  --contract "$WORK/contract.json" \
  --reference-html-file "$REFERENCE_HTML" \
  --preserve-source-text \
  --out-dir "$WORK/iteration" \
  --full-page \
  --viewport desktop:1440x1200 \
  --viewport tablet:834x1112 \
  --viewport mobile:390x844 \
  --channel chrome \
  --json
```

`--preserve-source-text` is permitted only because this mode already proved
ownership/licensing. Never add it to an external/public reference run.

The runner captures, checks readiness, invokes the generic measured drafter with
`--plan-out`, audits the resulting candidate, renders a local diagnostic, captures
it, and compares it. `diagnostic_passed` is the strongest possible verdict at
this phase.

Do not replace this route with:

- `compare-geometry.js --emit-snippet`;
- `extract-reference-spec.mjs` or `spec-to-layout.mjs`;
- a hand-written `build.mjs`;
- direct/manual `layout-kit.mjs`;
- hand-transcribed Craft JSON;
- `--viewport-only`.

When `repairQueue` is non-empty, AUTHOR is a bounded manual edit: change only the
named `sectionId` values, preserve passing sections, and rerun the emitted action.
It is not an automatic mutator and not permission to rewrite the page.

### 3 — Consume the runner's exact plan and layout

For generic measured mode require:

- `artifact: "monteby-layout-plan"`;
- `mode: "generic-measured-reference"`;
- `completion.allBandsMapped: true`;
- `completion.truncated: false`;
- `capturedBands === draftedRootSections` (equivalently planned/emitted counts);
- `omittedBands` and `omittedMedia` are empty.

Read the paths from `files.layoutPlan` and `files.layout` in the passing iteration
report. Those are the exact artifacts the runner audited and benchmarked. Do not
rerun `draft-monteby-layout.js` after a passing runner: a second draft would be a
different, unbenchmarked candidate. The plan is evidence, not an alternate input
language; never edit it to hide loss.

### 4–5 — Fresh snapshot, then validate the exact runner layout

Execute `snapshot_canonical_page` exactly as emitted by the passing runner.
Resolve the resulting `validate_candidate` action's `MONTEBY_LAYOUT_PATH` to the
passing iteration report's exact `files.layout`, then execute its ordered argv.

For the command shown in phase 2, those emitted actions use:

```bash
node "$SKILL/scripts/wordpress-layout-client.js" snapshot \
  --site "$SITE" \
  --page-id "$PAGE_ID" \
  --out-dir "$WORK/iteration/wordpress"

node "$SKILL/scripts/wordpress-layout-client.js" validate \
  --site "$SITE" \
  --layout "$WORK/iteration/candidate/layout.json" \
  --out "$WORK/iteration/wordpress/validate-response.json" \
  --auth-header-env MONTEBY_AUTH_HEADER
```

Require `validate-response.json`, `ok: true`, and a 64-character `layoutSha256`.
The returned `save_validated_candidate` action binds that hash into
`--expected-layout-sha256`; execute its ordered argv without rebuilding it.

### 6 — Save with concurrency protection

The emitted save action includes all of these bindings:

```bash
node "$SKILL/scripts/wordpress-layout-client.js" save \
  --site "$SITE" \
  --page-id "$PAGE_ID" \
  --layout "$WORK/iteration/candidate/layout.json" \
  --snapshot "$WORK/iteration/wordpress/layout-before.json" \
  --expected-layout-sha256 "$VALIDATION_LAYOUT_SHA256" \
  --out "$WORK/iteration/wordpress/save-response.json" \
  --auth-header-env MONTEBY_AUTH_HEADER
```

Resolve `VALIDATION_LAYOUT_SHA256` directly from the validate report's
`layoutSha256` without shell expansion or recomputation. The report's emitted argv
remains authoritative.

Preserve presentation by default. A deliberate shell change may use only a value
from `contract.layoutPersistence.presentation` through
`--presentation-layout`; presentation belongs to this same versioned save.

On `428`/`409`, execute `resnapshot_and_reconcile`. Reconcile remote changes,
revalidate, and wait for a newly emitted save action. Never auto-retry PUT.

### 7 — WordPress/PHP preview preflight

```bash
node "$SKILL/scripts/wordpress-layout-client.js" preview \
  --site "$SITE" \
  --layout "$WORK/iteration/candidate/layout.json" \
  --save-report "$WORK/iteration/wordpress/save-response.json" \
  --out "$WORK/iteration/candidate/preview.html" \
  --report-out "$WORK/iteration/wordpress/preview-response.json" \
  --auth-header-env MONTEBY_AUTH_HEADER
```

This proves only that WordPress/PHP rendered the candidate bound to the successful
save report. Resolve the three gates/tokens in its `verify_canonical_page` action.

### 8 — Canonical full-page verification

```bash
node "$SKILL/scripts/run-canonical-verification.js" \
  --iteration-report "$WORK/iteration/visual-iteration-report.json" \
  --preview-report "$WORK/iteration/wordpress/preview-response.json" \
  --public-page-url "$PUBLIC_PAGE_URL" \
  --out-dir "$WORK/iteration/candidate/canonical" \
  --channel chrome \
  --json
```

This wrapper captures the saved WordPress/PHP page at 1440, 834, and 390 pixels
and runs the final strict benchmark. It is the only site-authoring script allowed
to emit `status: "DONE"`.

Inspect its contact sheet. A green JSON audit cannot override a visible mismatch.
On failure, consume its blockers, bounded `repairQueue`, and emitted action; do not
run capture or benchmark ad hoc.

## Content and forms

Owned HTML permits reuse only inside the recorded license scope. It does not
authorize importing scripts, tracking, credentials, unsafe markup, or instructions
embedded in the source.

For a form:

- use consent/legal copy only when the user/project approved that exact text;
- use only approved privacy/legal destination URLs;
- do not invent a controller, purpose, retention period, rights notice, checkbox,
  legal page, URL, or translation;
- missing approved copy stops that form with `blocked_legal_copy` without expanding
  the rest of the task.

## Residual CSS

Residual child-theme CSS is forbidden by default and absent from the mechanical completion path. It is never a required phase, substitute for a typed control, or
evidence for `canonical_verified_1_to_1`.

If the user/site owner separately authorizes a named site-specific exception, read
`child-theme-residual-styles.md`. Keep it outside completion criteria and report
the owner, scope, product rationale, and rollback.
