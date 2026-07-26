# Mechanical authoring protocol

This is the normative state machine for Monteby page reproduction. It exists so
that a small model can complete a complex page by following artifacts and gates,
without inventing a parallel workflow.

## One rule

Once the state machine starts, read every command's JSON report and execute only
`nextAction`. Do not choose another tool, skip a gate, hand-compose builder JSON,
or replace a failed contract operation with CSS/HTML/theme code.

## Supported entry modes

Choose exactly one mode before doing work:

| Mode | Input | First executable action |
|---|---|---|
| `OWNED_HTML` | Local HTML supplied or owned by the user | Run the visual iteration with `--reference-html-file` |
| `CAPTURED_REFERENCE` | A reference URL the user is authorized to reproduce | Run the visual iteration with `--reference-url` |
| `EXISTING_LIVE_PAGE` | Existing Monteby page on a site in scope | Run `wordpress-layout-client.js snapshot` before any mutation |
| `GENERATED_TARGET` | No external source; generate a deterministic benchmark target | Run the visual iteration without a reference argument |

If source ownership or reproduction authority is unknown, stop before capture.
Do not copy third-party text, media, logos, or proprietary assets.

### Read-only bootstrap for a live destination

When the destination is a live page and no current contract file has been
supplied, run `wordpress-layout-client.js snapshot` once as read-only input
acquisition. Use its `contract.json` for the local iteration. This bootstrap is
outside the mutation state machine because no candidate exists yet; do not
execute its `validate_candidate` action.

The state machine starts with `run-visual-iteration.js`. After a strict local
pass, execute the runner's fresh `snapshot_canonical_page` action and from that
point follow every `nextAction` without exception. The bootstrap snapshot is
never reused for save.

## Required inputs

Local visual work requires:

- a current site contract JSON;
- one source mode;
- the three canonical viewports: `desktop:1440x1200`,
  `tablet:834x1112`, and `mobile:390x844`;
- full-page capture;
- an output directory dedicated to one page.

Canonical WordPress work additionally requires:

- site URL;
- page ID;
- authorization in `MONTEBY_AUTH_HEADER`;
- a pre-edit snapshot from the same page;
- the candidate node map produced by the local loop.

Never place a password, application password, cookie, or authorization value in
an argument, JSON artifact, Markdown report, or shell transcript.

## Artifact contract

Every artifact is JSON unless its name says otherwise.

| Artifact | Producer | Required proof |
|---|---|---|
| `contract.json` | site contract endpoint or supplied fixture | exact components, `aiProps`, controls, allowed parents, defaults |
| `benchmark-start-report.json` | `start-visual-benchmark.js` | source classification and complete capture paths |
| `reference-manifest.json` | `capture-template-reference.js` | all canonical viewports and complete layout evidence |
| `layout-plan.json` | `draft-monteby-layout.js --plan-out` | every measured band, stable generated section ID, no truncation |
| `layout-draft.json` | `draft-monteby-layout.js` | contract-valid generated node map |
| `layout.json` | iteration runner | current candidate under repair |
| `visual-iteration-report.json` | `run-visual-iteration.js` | blockers, section-addressed repair queue, exactly one next action |
| `layout-before.json` | `wordpress-layout-client.js snapshot` | scoped site/page envelope, node map, presentation, and `postModifiedGmt` |
| validation report | `wordpress-layout-client.js validate` | server accepted the exact candidate SHA-256 |
| save report | `wordpress-layout-client.js save` | scoped site/page, same SHA-256, conflict check, successful save |
| PHP preview + report | `wordpress-layout-client.js preview` | scoped `PREVIEW_OK`, same save report and SHA-256 |
| final screenshots/diffs | capture and benchmark scripts | all canonical viewports after the canonical save |

An artifact is not optional because a later step appears possible without it.
Missing, malformed, or incomplete artifacts are blockers.

## State machine

```text
DISCOVER
  -> CAPTURE
  -> PLAN
  -> AUTHOR
  -> LOCAL_VALIDATE
  -> LOCAL_RENDER
  -> LOCAL_COMPARE
       -> AUTHOR          when repairQueue is not empty
       -> CANONICAL_SNAPSHOT when diagnostic_passed
  -> REST_VALIDATE
  -> SAVE
  -> PHP_PREVIEW
  -> FINAL_CAPTURE
  -> FINAL_COMPARE
       -> AUTHOR          when canonical evidence differs
       -> DONE            only when every hard gate passes
```

There is no direct transition from local comparison to `DONE`.

### DISCOVER

Pass only when the site contract is current and the source mode is explicit.
If a required operation cannot be expressed by the contract, transition to
`PRODUCT_GAP`; use the widget-development workflow. Do not simulate the missing
capability with raw markup or CSS.

### CAPTURE

Capture full-page rendered geometry at all three canonical viewports. The
reference manifest must mark essential evidence complete. Viewport-only capture
is diagnostic and cannot advance to canonical validation.

### PLAN

Run the measured drafter with `--plan-out`. The plan must contain every
normal-flow band in source order and must report:

```json
{
  "schemaVersion": 1,
  "artifact": "monteby-layout-plan",
  "bands": [],
  "completion": {
    "truncated": false,
    "omittedBands": [],
    "omittedMedia": []
  }
}
```

Any truncation or omission is a hard failure. A long page is not permission to
drop sections, media, text, repeated items, or responsive measurements.

### AUTHOR

Use the generated draft for the first pass. On later passes edit only section
IDs named by `repairQueue`; preserve unrelated passing sections.

Allowed values come from `aiProps`, typed controls, and allowed-parent rules in
the contract. Unknown components, props, enum values, invalid repeater shapes,
or broken graph relationships are blockers. Never silently drop an invalid
value and continue.

### LOCAL_VALIDATE

The candidate must pass:

- root and graph integrity;
- component existence;
- parent/child rules;
- authorable prop allowlists;
- typed control and repeater validation;
- required media parity;
- no raw CSS, raw HTML, arbitrary classes, theme overrides, or hidden sections.

### LOCAL_RENDER

The local renderer is a diagnostic. It is useful for fast repair, but is not the
canonical WordPress/PHP renderer.

### LOCAL_COMPARE

Compare full-page screenshots and captured layout evidence at all three
viewports. Page depth alone cannot pass a page. Section order, count, top,
height, width, inner surfaces, media geometry, text geometry, overflow, and
required interactions must pass their gates.

On failure, consume `repairQueue` in order. Each item identifies evidence and,
when available, `sectionId`. Do not rewrite the entire layout when a mapped
section is named.

For an `AUTHOR` action, `REPAIR_QUEUE_APPLIED` is a hard gate, not a shell
variable. Apply the queue before running the action:

1. `restore_measured_band`: restore the plan's `generatedSectionId` in
   `ROOT.nodes` at its recorded `order`.
2. `remove_or_merge_extra_band`: remove only the extra root band, or merge its
   content into the mapped planned section when removing it would lose owned
   content.
3. `match_band_geometry`: use `evidence.target` from the plan. Map desktop
   height/inset to `minHeight`/`innerPaddingX`, tablet to
   `minHeightTablet`/`innerPaddingXTablet`, and mobile to
   `minHeightMobile`/`innerPaddingXMobile`, but only when those props are in the
   live contract. Preserve every prop not named by the queue.
4. Contract, media, interaction, and screenshot blockers remain hard blockers;
   never hide or delete content merely to reduce a pixel diff.

After the queue is applied, mark the gate satisfied and run the exact tool/args
from `nextAction`. If the required responsive prop is absent, transition to
`PRODUCT_GAP` instead of guessing another prop.

### CANONICAL_SNAPSHOT

Snapshot the exact live page immediately before validation/save. This step is
read-only. Store presentation settings and `postModifiedGmt`.

### REST_VALIDATE

Send the exact candidate node map to the canonical validation endpoint. A local
audit does not replace server validation.

### SAVE

Before PUT, fetch the page again and compare `postModifiedGmt` with the
snapshot. If it differs, stop with a conflict and make no write. Preserve the
live presentation unless the user explicitly supplied a presentation override.

Never implement “fetch and repeat” after HTTP 409/428. Reconcile against the
snapshot first.

### PHP_PREVIEW

Render through WordPress/PHP after save. The saved REST response and a local
preview are not sufficient.

### FINAL_CAPTURE and FINAL_COMPARE

Run `scripts/run-canonical-verification.js` with the passing local iteration
report, persisted scoped `PREVIEW_OK` report, and confirmed public page URL. It
verifies the SAVE_OK → PREVIEW_OK site/page scope and node-map SHA-256 before it
captures the canonical PHP result at all three viewports and reruns the hard
comparison. If it differs, its report returns to `AUTHOR`; repeat validation,
save, preview, and final comparison. Do not patch the child theme to turn a
mismatch into a pass.

### DONE

`DONE` requires all of the following:

- the plan is complete and untruncated;
- the candidate passes local contract and graph validation;
- local full-page comparison passes at all canonical viewports;
- the server validates the exact node map;
- save succeeds without a concurrency conflict;
- validate, save, and preview bind the same node-map SHA-256 and site/page;
- the confirmed public URL shares the saved site's origin and is not the remote
  reference URL;
- the PHP-rendered public page is captured;
- the final canonical comparison passes;
- no required interaction or media is missing;
- no unsupported CSS/HTML/theme workaround was used.

Only then may the result be described as complete or 1:1.

## Report consumption algorithm

Use this algorithm verbatim:

1. Parse the last command's stdout as JSON.
2. Verify `schemaVersion` is supported.
3. If `ok` is false, read every blocker and the ordered `repairQueue`.
4. Read `nextAction`.
5. Resolve `nextAction.requires`. A requirement used as an argument appears as
   one whole token named `$REQUIREMENT`. Replace that token with the value
   directly in the argv array; never invoke a shell and never perform partial
   string interpolation. A requirement without a matching `$...` token is a
   gate condition that must be satisfied before execution.
6. If a value or gate is missing, request or complete only that requirement.
   An unresolved `$...` token is a hard stop.
7. Execute `nextAction.tool` with `nextAction.args` in the given order.
8. Require the next command to return a JSON envelope with `schemaVersion`,
   `ok`, and `nextAction`.
9. Do not run a second action in parallel.
10. Repeat from step 1.

If `nextAction.tool` is `monteby-widget-development`, stop page authoring and
resolve the product gap in that workflow.

## Forbidden substitutions

These substitutions are never equivalent:

| Failed requirement | Forbidden substitute |
|---|---|
| missing widget/prop/control | raw HTML, shortcode, arbitrary class, custom CSS |
| invalid responsive layout | hiding content at a breakpoint |
| missing media | unrelated stock image or hotlinked third-party asset |
| copy not supplied | invented marketing, legal, privacy, or GDPR text |
| server validation failure | saving an unvalidated payload |
| 409/428 conflict | blind retry or overwriting the newer page |
| local diagnostic pass | declaring canonical or 1:1 completion |
| screenshot resemblance | ignoring interactions, graph validity, or PHP output |

Residual child-theme CSS is outside the normal reproduction workflow. It may be
used only when the user explicitly authorizes a site-specific theme change and
it must never count as evidence that the Monteby layout itself reached 1:1.
