# Mechanical runbook: owned HTML → canonical Monteby

Use this runbook only in `owned-html-reconstruction` mode. The HTML, text, fonts,
and assets must belong to the user/project or be explicitly licensed for reuse.
HTML generated locally in this project by a design skill from the user's own
brief and tokens is owned; record its provenance in `handoff.json` per
`references/design-handoff.md`. Otherwise stop with `blocked_source_rights` and
restart in `external-reference-benchmark` mode with replacement content.

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
- `CLIENT_CONTENT`: source-bound v2 client content document when exact supplied
  copy is part of the acceptance claim.

The WordPress client reads authentication from the environment variable named
`MONTEBY_AUTH_HEADER`. Populate it through the project's approved secret
mechanism. Never paste its value, a password, application password, cookie, nonce,
or bearer token into a command, report, plan, shell history, or committed file.

Require a current backup/rollback path before the first write.

## Phase table

| Phase | Required inputs | Required artifacts | Command | Pass condition | Failure action | Allowed verdict |
|---|---|---|---|---|---|---|
| 0. Rights and target | Ownership/license evidence, site/page/public URL, HTML path, rollback owner | Recorded mode and rights decision | No authoring command | Source may be reused; target and rollback are exact | Unknown rights → stop and use external-reference mode. Unknown target/rollback → stop | `continue`, `blocked_source_rights`, or `blocked_target` |
| 1. Discover exact live target | Phase 0, approved auth environment | `contract.json`; document-scoped discovery `layout-before.json`; snapshot report | `wordpress-layout-client.js snapshot` (`--render-context-url` for a global template) | Contract exposes `productVersion`, provider-rendered save, components/layout persistence; the advertised layout resource has exactly one `{postId}` and binds `id`, `postType`, `viewUrl`, its named `versionField` token (currently `postModifiedGmt`), canonical layout digest, and this exact site/document | Missing contract, old plugin, inconsistent capability, or scope mismatch → stop; never substitute a policy file, fixture, remembered contract, `/wp/v2/pages`, or another document's snapshot | `continue`, `blocked_plugin_version`, `blocked_contract_inconsistency`, or `blocked_live_contract_unavailable` |
| 2. Full measured iteration and plan | Live contract, owned HTML | Complete reference captures/layouts; `visual-iteration-report.json`; exact `files.layout`; exact `files.layoutPlan` | `run-visual-iteration.js --full-page` at all three viewports; runner internally invokes `draft-monteby-layout.js --plan-out` | Capture is complete; plan uses `generic-measured-reference`, maps every band, is untruncated, and omits nothing; report ends `diagnostic_passed` | Consume the report's blocker/queue; never redraft manually or relax evidence with a tolerance shortcut | `diagnostic_passed`, `blocked_incomplete_evidence`, `blocked_product_gap`, or `failed` |
| 3. Bounded AUTHOR loop, only if emitted | Iteration report with non-empty `repairQueue` | Updated candidate plus rerun report | Execute the emitted `apply-layout-repair-queue.js` action, then its exact rerun action | Queue gate is satisfied and the rerun reaches `diagnostic_passed` without regressing passing sections | Ambiguous or unsupported repair → stop and review the reported blocker; never translate the queue into manual JSON edits | `diagnostic_passed`, `blocked_product_gap`, or `failed` |
| 4. Fresh canonical snapshot | Passing iteration report, its exact layout, approved auth environment | Fresh `contract.json`; page-scoped `layout-before.json`; snapshot report | Execute emitted `snapshot_canonical_page` action | Snapshot matches the exact site/page and its next action is `validate_candidate` | Scope/version evidence missing → stop; do not reuse discovery evidence from another page or run | `continue` or `blocked_live_contract_unavailable` |
| 5. Live validation | Exact `files.layout` from phase 2/3 | `validate-response.json` containing `layoutSha256` | Resolve `MONTEBY_LAYOUT_PATH` in emitted `validate_candidate`; execute ordered argv | Server accepts that exact node map; `nextAction.id` is `save_validated_candidate` and carries the same hash | Repair from live errors, rerun the local path, and snapshot again; never save rejected or different JSON | `continue` or `failed` |
| 6. Versioned save | Validated layout, matching fresh snapshot, validation hash | Required `save-response.json`, before/after token and digest evidence, saved-response representation SHA-256, and canonical readback SHA-256 | Execute emitted `save_validated_candidate` with `--snapshot`, `--expected-layout-sha256`, and `--out` | Client uses the descriptor-named version and digest preconditions, proves the requested page identity, and binds both submitted and canonical validated candidates; canonical readback must match the saved response. A coarse-resolution token may remain unchanged only when exact source/candidate digests and canonical readback prove the write; patch apply additionally binds the persisted compiled HTML digest; presentation is preserved/explicit; next action is `preview_saved_candidate` | `428`/`409` → execute `resnapshot_and_reconcile`, manually reconcile, revalidate; incomplete identity/token/digest/readback evidence → inspect saved state and never auto-retry PUT | `continue`, `blocked_concurrent_edit`, or `failed` |
| 7. PHP preview | Saved candidate and successful save report | `preview.html`; required `preview-response.json` | Execute emitted `preview_saved_candidate` with `--save-report` and `--report-out` | Preview submits the exact canonical readback representation bound to the successful save, not the stale local candidate; `nextAction.id` is `verify_canonical_page` | Return through repair/validation/save; preview cannot prove 1:1 | `continue` or `failed` |
| 8. Canonical capture + comparison | Passing iteration report, successful preview report, confirmed saved public URL | Complete canonical screenshots/layouts/manifest at 1440, 834, 390; benchmark/diffs; canonical report | Resolve the emitted `verify_canonical_page` action, including `--preview-report`; execute ordered argv | `status: "DONE"`, `ok`, `fidelityPassed`, and `canonicalVerification` are true; direct review finds no mismatch | Consume blockers and execute the emitted deterministic repair action; then repeat validation, save, preview, and canonical verification through emitted actions | `canonical_verified_1_to_1`, `blocked_incomplete_evidence`, `blocked_product_gap`, or `failed` |

## Commands and gates

The commands below contain no secret value. Prefer the exact emitted
`nextAction.args` when a report is already available.

On Windows, invoke the canonical client with `node` and its absolute script
path, as shown below. Do not switch it to `npx.cmd`, `shell: true`, or an
unquoted shell-composed command. In Git Bash only, if an exact diagnostic must
call `curl.exe` with a `/wp-json/...` path argument, prefix that one invocation
with `MSYS_NO_PATHCONV=1`; do not export it for the session or attach it to the
Node workflow. This prevents MSYS from rewriting the REST path into a local
Windows path while keeping every other path conversion scoped normally.

### 0 — Prove the browser in this environment

```bash
node "$SKILL/scripts/browser-preflight.js" --url "$PUBLIC_PAGE_URL"
```

Require successful real Chromium navigation and PNG evidence at 1440, 834, 390,
and the independent 375px narrow-width stress viewport. On native Windows run
this with `node` from PowerShell; do not route it through `.cmd`, `shell: true`,
or a Git Bash path-rewriting wrapper. The repository's manually dispatched
`Windows browser preflight` workflow provides the same native Windows smoke;
it is never scheduled automatically.

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
When this complete capture finds icon surfaces, the first run stops at readiness.
Review those surfaces, create an exact SHA-bound native mapping, and rerun the
same command with `--icon-mapping "$ICON_MAPPING"`. Omit it only for a capture
with zero icons. An unknown native equivalent blocks the run.

The runner captures, checks readiness, invokes the generic measured drafter with
`--plan-out`, audits the resulting candidate, renders a local diagnostic, captures
it, and compares it. `diagnostic_passed` is the strongest possible verdict at
this phase.

Do not replace this route with:

- `compare-geometry.js --emit-snippet`;
- `extract-reference-spec.mjs` or `spec-to-layout.mjs`;
- a hand-written `build.mjs`;  <!-- zakaz dotyczy tego trybu; z briefu bez referencji patrz references/brief-to-monteby.md -->
- direct/manual `layout-kit.mjs`;
- hand-transcribed Craft JSON;
- `--viewport-only`.

When `repairQueue` is non-empty, execute the emitted
`apply-layout-repair-queue.js` action exactly. Its deterministic applier changes
only proven, named root sections and verifies that unrelated subtrees remain
unchanged. Follow its emitted rerun action; never translate the queue into manual
JSON edits or rewrite the page. An ambiguous or unsupported repair blocks this
step until the capability or evidence is corrected.

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
  --page-id "$PAGE_ID" \
  --layout "$WORK/iteration/candidate/layout.json" \
  --out "$WORK/iteration/wordpress/validate-response.json" \
  --auth-header-env MONTEBY_AUTH_HEADER
```

Require `validate-response.json`, `ok: true`, and a 64-character `layoutSha256`.
The client discovers the validation path, carrier, and context key from the live
contract; `--page-id` supplies that advertised context without assuming its
field name. The response must prove `valid: true` and include the evaluated
`lint` array.
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

The client discovers the page-layout method/path/carrier plus version, digest,
and candidate-precondition fields from the live contract. In the current
Builder the version fields are `postModifiedGmt` and `expectedModifiedGmt`; do
not encode them into another client. `SAVE_OK` requires the requested page ID,
a valid response token, the saved node-map representation returned by the
write, and a fresh canonical GET whose token and representation digest match
that response. A coarse-resolution token may remain unchanged only when exact source and
candidate digest preconditions, the saved response, and canonical readback prove the write. The
submitted and canonical validated-candidate hashes are retained separately so
the request stays bound across a declared server-side canonical migration. A
`2xx` response containing only `{ "saved": true }` is not save proof.

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

This proves only that WordPress/PHP rendered the exact canonical readback bound
to the successful save report. Resolve the three gates/tokens in its
`verify_canonical_page` action.

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

When exact supplied copy is part of acceptance, run
`verify-client-content.js` with the source-bound v2 `$CLIENT_CONTENT` and the
canonical capture manifest. Its source SHA-256, public URL, region, occurrence
counts, and NBSP characters must all match. For explicitly requested multi-page
work, use `batch-layout-client.js`: it preflights all pages before the first
write and later stops with a durable resume ledger on conflict; resume
re-preflights every unapplied page before another write.

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


## Capture caveat: narrow viewports in headless Chrome

Motion verification requires a real browser with advancing animation frames.
Static browser panels and DOM-only probes may confirm triggers, positions, and
CSS variable values, but they are not evidence that a transition or animation
played correctly. If Playwright or a usable local browser is unavailable, report
motion QA as blocked; do not promote a static probe to a motion pass.

`chrome --headless=new --screenshot --window-size=390,H` silently enforces a
minimum window width (~435px) and crops the image back to 390 — every element
appears clipped at the right edge even though the live layout is correct. Any
"words cut at the right edge" finding from such a capture is a measurement
artifact until confirmed in a real browser or an exact-width frame.

Capture narrow viewports through a fixed-width iframe harness instead:

```html
<!doctype html><meta charset="utf-8">
<style>html,body{margin:0}iframe{border:0;width:390px;height:14400px;display:block}</style>
<iframe src="PAGE_URL"></iframe>
```

Screenshot the harness at a wide window (e.g. 600px) and slice the left 390
columns. Cross-origin pages render fine — the harness needs pixels, not DOM
access.
