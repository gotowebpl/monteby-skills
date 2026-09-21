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

### Builder 1.6 discovery and document resources

Each item is gated in `references/site-contract-compatibility.json`
(`productVersion >= 1.6.0` plus the named capability); an older Builder keeps
the full-contract flow and the fallback named there. Discover every route from
the live contract's `layoutPersistence.resources`; never remember it.

- Per-turn discovery reads
  `GET /wp-json/monteby/v1/contract?mode=authoring&components=summary`
  (`componentsMode: summary`: name, label, categoryLabel, isCanvas,
  allowedParents, aiHints) and fetches one schema on demand from
  `GET /wp-json/monteby/v1/contract/components/{name}`
  (`layoutPersistence.resources.contractComponent`, own private `ETag`,
  `404 monteby_site_authoring_unknown_component`). The compiler,
  `normalize-layout.js` and the Kit still consume the full contract file; a
  summary projection is a prompt catalog, not a validator input.
- Evaluate the projection gate against the response that was requested, not
  against a remembered full contract: `contractLightProjection`,
  `contractDesignProjection`, `contractAuthoringProjection`,
  `contractCatalogsProjection`, and `contractComponentsSummary` verify the
  returned `mode`/`componentsMode`. A missing projection falls back to the full
  live contract; it never authorizes cached schema from another site.
- `GET /wp-json/monteby/v1/contract?mode=catalogs` returns only `iconCatalog`
  and `fontCatalog` with their `ETag`; fetch them once per run and revalidate
  with `If-None-Match`. The server validates `icon-svg` props as published
  Material Symbols names and `font-picker` props as `fontCatalog` values
  (system `_system_*` tokens, Font Library choices, registered Google
  families, `var(--gcb-font-*)`); an invented name is `invalid_prop_value`,
  never a browser fallback. Author only values present in the fetched
  catalogs.
- `GET /wp-json/monteby/v1/pages/{id}/context` answers `postId`, `postType`,
  `documentType`, `title`, `slug`, `status`, `viewUrl`, `editUrl`,
  `hasLayout`, `layoutState`, `nodeCount`, `postModifiedGmt`, `presentation`,
  `effectiveLayout`, `headerPostId` and `footerPostId` before a layout read;
  `GET /wp-json/monteby/v1/site/pages` (`hasLayout`, `postType`, `page`,
  `perPage` up to 100) lists editable documents newest change first. Use them
  for scope discovery; the versioned layout resource remains the snapshot
  identity source for `layout-before.json`.
  `layoutPersistence.templatePostType` (`gotoweb_template`) and
  `documentTypes` name the vocabulary of every `documentType` field.
- `POST /wp-json/monteby/v1/site/pages/bulk { requestId?, items[] }`
  (`layoutPersistence.resources.bulkCreate`, `maxItems` 25) creates several
  documents in one write; each item is `{ title, slug?, status?, postType?,
  layout?, seo?, presentation? }` and is validated before the first post
  exists. Always send a `requestId` (`[A-Za-z0-9_-]{1,64}`): a repeat with
  the same id answers `replayed: true` with the original `created[]` and
  creates nothing, so a timeout never duplicates pages.
  `400 monteby_site_authoring_invalid_bulk_items` lists
  `{ itemIndex, code, message }` per failing item and creates nothing;
  `monteby_site_authoring_bulk_create_failed` names the failed `itemIndex`
  and the `created` items that stay, so reconcile before any resend. Without
  the gate, create pages one at a time through the sequential
  `batch-layout-client.js` path. Menus are not written here.
- `POST /wp-json/gotoweb-craft/v1/settings/template-create { type, title?,
  layout? }` validates the layout against the live contract before the post
  exists, persists it as the first revision and returns `id`, `editUrl`,
  `documentType`, `revisionId` and `postModifiedGmt`, so the next versioned
  layout PUT has its precondition without a read. Creation never activates
  the template; selection stays a separate `selectionResource` PUT.
- On WordPress 6.9+ with `authoring.capabilities.abilities: true`, Builder
  registers the same operations as `monteby/*` abilities
  (`authoring.abilities.names`). They are an alternative transport for the
  identical contract, gates and preconditions. A Builder 1.6 contract that
  explicitly publishes `abilities: false` reports `feature_unavailable` and
  uses the legal `rest-only` fallback; a missing or malformed value remains
  `blocked_contract_inconsistency`.
- Before using server composition planning or revision restore, require the
  `compositionPlan` or `revisionRestore` gate respectively. These gates verify
  the resource descriptors published by the current live contract; an absent
  restore descriptor falls back to an explicit versioned layout save and must
  never be replaced by a direct post-meta write.

### Trusted request-scoped render filters

The `renderLayoutFilter`, `renderGlobalStylesFilter` and
`renderGlobalTemplateFilter` gates describe PHP integration seams, not an
alternative authoring transport. Use them only inside trusted WordPress code
that has already authenticated the request and checked the relevant edit or
design capability. Scope every callback to one intended preview request and
exact post, document type or template role; never enable one from an arbitrary
public query parameter, cookie or page payload. Remove the callback after the
request when the host process can outlive it.

- `monteby/render/layout_json` may return a fully validated candidate JSON only
  for the exact `(postId, documentType)` requested. It does not replace REST
  layout reads or the editor document. Without `renderLayoutFilter`, use the
  official REST preview and the versioned save flow; do not patch post meta.
- `monteby/render/global_styles` may return a complete validated candidate only
  for the intended `front`, `preview` or `editor` context. Ordinary authoring
  should prefer the advertised `POST /monteby/v1/preview` `globalStyles`
  candidate. Without `renderGlobalStylesFilter`, preview using stored styles
  and report that the site-wide candidate could not be rendered.
- `monteby/render/global_template_post_id` may select only an existing,
  published template of the requested `header` or `footer` role. Without
  `renderGlobalTemplateFilter`, retain the stored active selection; use
  `previewGlobalTemplates` only to frame a document with that stored chrome.

Candidate renders must not persist layouts, selections or styles. They bypass
normal render/font-profile caches and must not populate them. A filtered public
request is diagnostic evidence only: canonical completion still requires the
approved versioned write, fresh read and saved WordPress/PHP render. If a gate
is absent, use its named fallback and never install a remembered hook or route.

## Required inputs

Local visual work requires:

- a current site contract JSON;
- one source mode;
- the three canonical viewports: `desktop:1440x1200`,
  `tablet:834x1112`, and `mobile:390x844`;
- full-page capture;
- an output directory dedicated to one page.

Before capture, run `scripts/browser-preflight.js` against the exact public
origin in the execution environment. It must complete real Chromium navigation,
two animation frames, and a PNG capture at 1440, 834, 390, and 375 pixels.
Installing Playwright alone is not evidence that its browser can run there.

Canonical WordPress work additionally requires:

- site URL;
- page ID;
- authorization in `MONTEBY_AUTH_HEADER`;
- a pre-edit snapshot from the same page;
- the candidate node map produced by the local loop.

Never place a password, application password, cookie, or authorization value in
an argument, JSON artifact, Markdown report, or shell transcript.

## Tablet-width rule

One rule governs every tablet width in this skill:

- the plugin's stylesheets switch at fixed thresholds: the tablet sheet applies
  at and below **900px**, the mobile sheet at and below **767px**;
- **834px** is the canonical tablet *measurement* viewport (`tablet:834x1112`),
  chosen because it sits inside the tablet sheet window; it is never itself a
  breakpoint;
- authoring decisions ("does this need a `*Tablet` override?") are made against
  the 900px/767px sheet windows, not against the capture width.

`WPMenu.mobileBreakpoint` is an independent component behavior, not a third
layout stylesheet boundary. Read its live control value (`sm` 640, `md` 768,
`lg` 1024, `xl` 1280 or `2xl` 1536) and test the drawer on both sides of that
chosen threshold. These legacy values switch below their named width. When
published by the live contract, `tablet` instead means at or below 900px and
`mobile` means at or below 767px; test 900/901 and 767/768 respectively.
A measurement at 834px still uses tablet layout props even
when the menu's own `md` drawer has already switched state. Never infer the
menu threshold from 834px, 900px or 767px.

Any document or script in this skill that states a different tablet threshold
(older texts said 768) is superseded by this rule and must carry an annotation
pointing here.

## Performance budgets

Every mode ends its final gate with these budgets. Exceeding one is a report
entry with an explicit decision, never a silent pass:

- **Page weight**: the saved page's transferred weight at desktop must stay
  under 2.5 MB excluding video; a page over budget names the offending assets
  in the report.
- **Image format**: authored raster media uses WebP or AVIF (JPEG acceptable
  for photography when the host pipeline cannot serve WebP); PNG only for
  transparency/cutouts; no BMP/TIFF. Captured SVG icon surfaces must map to a
  native entry in the live `iconCatalog`; never author raw SVG or substitute a
  raster image when no native icon matches.
- **Video**: background video without `backgroundVideoPoster` is forbidden, and
  `backgroundVideoMobileBehavior` must be explicit (`poster` is the default
  policy; `autoplay` on mobile requires a recorded justification).
- **Node count**: a page over 350 authored nodes requires a written
  justification in the final report (repeated measured content is a valid
  justification; decorative wrapper stacking is not).

## Artifact contract

Every artifact is JSON unless its name says otherwise.

| Artifact | Producer | Required proof |
|---|---|---|
| `contract.json` | site contract endpoint or supplied fixture | exact components, `aiProps`, controls, allowed parents, defaults |
| browser preflight report | `browser-preflight.js` | real Chromium navigation and captures at 1440/834/390/375 in the execution environment |
| `benchmark-start-report.json` | `start-visual-benchmark.js` | source classification and complete capture paths |
| `reference-capture-checkpoint.json` | `run-visual-iteration.js` | exact contract/source/options/full-page scope plus file-byte SHA-256 bindings for the start report, owned HTML, manifests, layouts, and screenshots |
| `reference-manifest.json` | `capture-template-reference.js` | all canonical viewports and complete layout evidence |
| `layout-plan.json` | `draft-monteby-layout.js --plan-out` | every measured band and text/media/group/child surface, stable generated IDs, complete `constraintDecisions` from constraint evidence v1, source node-map SHA-256, no truncation |
| `layout-draft.json` | `draft-monteby-layout.js` | contract-valid generated node map |
| `layout.json` | iteration runner | current candidate under repair |
| `visual-iteration-report.json` | `run-visual-iteration.js` | complete repair queue, exactly one next action, SHA-256 bindings for plan, candidate, both contract files, and both manifests |
| `layout-before.json` | `wordpress-layout-client.js snapshot` | scoped site/document envelope from the advertised layout resource: requested `id`, `postType`, `viewUrl`, optional `renderContextUrl`, exact node map, matching descriptor-named layout digest, presentation, and version token |
| validation report | `wordpress-layout-client.js validate` | advertised validation resource accepted the exact candidate SHA-256 and returned `valid: true` with its evaluated `lint` array |
| save report | `wordpress-layout-client.js save` | scoped site/page identity, submitted and canonical validated-candidate SHA-256, token-plus-digest conflict check, valid descriptor-named response token, saved-response representation SHA-256, and canonical readback with the same token and saved representation SHA-256 |
| PHP preview + report | `wordpress-layout-client.js preview` | scoped `PREVIEW_OK` that rendered the exact canonical readback representation from the save report |
| final screenshots/diffs | capture and benchmark scripts | all canonical viewports after the canonical save; zero aggregate and per-viewport mismatch |

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

Capture visible SVG/icon surfaces separately from photographic media. Evidence
may retain geometry, accessible semantics, color, and stable structure keys,
but never SVG markup or path data. Each surface must be mapped through the live
`iconCatalog` by an exact SHA-bound mapping artifact before readiness can pass.
A missing native equivalent is a blocker, not permission to drop or rasterize it.

The runner writes `reference-capture-checkpoint.json` immediately after a
successful capture. When readiness stops on a missing or invalid native icon
mapping, execute only its `approve_native_icon_mapping_and_resume` action. That
action carries the original source arguments, the approved mapping placeholder,
and `--resume-capture` for the exact checkpoint. Resume never invokes
`start-visual-benchmark.js`; it verifies the contract path and bytes, source
scope, capture-affecting options, viewport list, full-page mode, owned HTML, and
every bound manifest/layout/screenshot byte first. Any mismatch returns
`blocked_capture_checkpoint` and must not silently recapture. A deliberate fresh
capture is a new run and invalidates the old icon mapping by design.

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
    "omittedMedia": [],
    "omittedText": []
  }
}
```

Any truncation or omission is a hard failure. A long page is not permission to
drop sections, media, text, repeated items, or responsive measurements.

Every captured hard minimum/maximum width or offset needs a recorded decision:
preserve it, replace it with an equivalent live responsive control, or omit it
only when measured evidence proves it non-constraining and the 375px stress
check stays free of overflow. Silent removal is incomplete authoring. A generic
plan without `constraintDecisions`, or with an authored decision classified as
`legacy-unclassified`, cannot advance. Execute its
`recapture_constraint_evidence` action to create a fresh constraint-evidence-v1
capture; do not reuse the legacy checkpoint or its bound icon mapping.

The generic path is complete only inside its declared resource envelope: at
most 64 normal-flow bands, 24 meaningful media surfaces per band, 256 text
surfaces per band, and 3200 CSS pixels per band at any captured viewport.
Crossing a bound stops before layout/plan publication with a stable error; it
never samples or truncates the reference.

### AUTHOR

Use the generated draft for the first pass. On later passes execute the emitted
`apply-layout-repair-queue.js` action exactly. The applier may change only root
sections named by the complete, ordered `repairQueue`; it cryptographically
proves that every unrelated root subtree is unchanged.

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

The queue is never truncated per viewport or in total. The deterministic applier
implements these operations:

1. `restore_measured_band`: recursively copy the complete planned subtree from
   `plan.sourceLayout` and insert its root in `ROOT.nodes` at the plan's recorded
   `order`. A source node ID that collides with a node reachable from an unrelated
   candidate root is a hard `RESTORE_NODE_ID_COLLISION` blocker.
2. `remove_or_merge_extra_band`: despite the legacy repair-code name, removal is
   allowed only when a unique extra `montebyNodeId` maps to one candidate root and
   recursive subtree evidence mechanically proves it is a duplicate. The
   benchmark's filtered/merged `candidateIndex` is never root identity. The
   applier never guesses, merges content, or deletes an ambiguous extra; it stops
   with `CONTENT_SCOPE_DECISION_REQUIRED` and
   `EXTRA_BAND_IDENTITY_UNPROVEN` when identity is not proven.
3. `match_band_geometry`: use `evidence.target` from the plan. Map desktop
   height/inset to `minHeight`/`innerPaddingX`, tablet to
   `minHeightTablet`/`innerPaddingXTablet`, and mobile to
   `minHeightMobile`/`innerPaddingXMobile`. Set only responsive Section props
   explicitly authorable by the live contract. An absent required prop is a hard
   blocker; do not guess another prop.
4. Unknown repair codes and non-summary contract, media, interaction, and
   screenshot blockers remain hard blockers. Aggregate visual-budget summaries
   may be deferred while actionable queue items exist, because the exact rerun
   recomputes them. Never hide or delete content merely to reduce a pixel diff.

The applier report records canonical `inputLayoutSha256` and
`outputLayoutSha256`, plus before/after subtree SHA-256 proofs in
`preservedRootSections` for every root section not named by an applied queue
item. It fails if any such subtree changes. A successful report emits one exact
`run-visual-iteration.js` action whose `--candidate-layout` is the repaired
output. Execute that action directly; no separate queue-applied gate exists.

### CANONICAL_SNAPSHOT

Snapshot the exact live page immediately before validation/save. This step is
read-only. Store presentation settings, the requested numeric document `id`,
the token from the field named by the live `layoutPersistence.versionField`
(currently `postModifiedGmt`), and the matching canonical layout digest named
by `layoutDigestField`.

### REST_VALIDATE

Send the exact candidate node map through the validation method, path, carrier,
and context field advertised in the live `layoutPersistence` descriptor. The
current Builder's `/monteby/v1/validate`, `nodeMap`, and `postId` names are
examples, not fixed client constants. Missing or unsupported descriptors stop
the run; a local audit does not replace server validation. Require the response
to contain `valid: true` and an evaluated `lint` array.

For a bounded existing-node edit, use the separate operation branch documented
in `partial-layout-operations.md`: `patch-validate -> patch-save -> canonical
review`. Enter it only after `CANONICAL_SNAPSHOT`. Its preflight must bind the
snapshot version and layout digest, exact operation batch, candidate layout,
and compiled output; apply sends every descriptor-named precondition, including
the compiled-output digest;
it does not permit skipping the canonical review after apply.

### SAVE

Before the advertised write, fetch the page again and compare both the token
named by `layoutPersistence.versionField` and the canonical digest named by
`layoutDigestField` with the snapshot. If either differs, stop with a conflict
and make no write. This catches a second write inside the timestamp token's
resolution. Send both values through the descriptor's `writePreconditionField`
and `writeDigestPreconditionField`. Current Builder names the version fields
`postModifiedGmt` and `expectedModifiedGmt`; another compatible descriptor may
name them differently. Preserve the live presentation unless the user explicitly
supplied a presentation override.

After a successful write require a non-empty token and exact saved
representation, then read the canonical layout through the same descriptor.
The token may equal the previous token only when the representation proves a
no-op. The readback token must equal the write-response token and the readback
node-map SHA-256 must equal the write-response representation SHA-256. Retain
the submitted and canonical validated-candidate SHA-256 separately, because a
declared migration may change the persisted representation. Every response in
this chain must identify the requested page. An arbitrary `2xx` or
`{ "saved": true }` is not sufficient evidence, and a failed or mismatched
readback must never trigger an automatic repeat write.

Never implement “fetch and repeat” after HTTP 409/428. Reconcile against the
snapshot first.

For a requested multi-page batch, `batch-layout-client.js` snapshots and
patch-validates every page before the first save, then writes sequentially. A
conflict stops the batch and persists the exact applied/remaining preflight
ledger for explicit `--resume`. Resume re-preflights every unapplied page before
another write; this is not a database-wide transaction.

### PHP_PREVIEW

Render the exact canonical readback representation through WordPress/PHP after
save. Do not re-submit the local pre-save candidate. The saved REST response and
a local preview are not sufficient.

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
- save succeeds without a concurrency conflict and returns a valid version
  token; an unchanged token is accepted only for a proven no-op;
- the canonical readback carries that token and the exact saved-response
  representation SHA-256, while the report separately retains the validated
  candidate SHA-256;
- the save evidence preserves the server's `valid: true` result and `lint`
  array;
- validate and save bind the submitted and canonical candidate SHA-256 to the
  same site/page, while preview binds the exact canonical readback SHA-256;
- the plan, candidate, source/copied contract, and reference/target manifests
  still match the SHA-256 bindings recorded by the passing local report;
- the confirmed public URL shares the saved site's origin and is not the remote
  reference URL;
- the PHP-rendered public page is captured;
- the final canonical comparison contains non-empty desktop/tablet/mobile
  results with zero mismatched pixels, zero aggregate percent, and zero maximum
  viewport percent;
- no required interaction or media is missing;
- required public computed-prop expectations pass at 1440/834/390 and the 375px
  stress capture has no horizontal overflow;
- no unsupported CSS/HTML/theme workaround was used.

Only then may the result be described as complete or 1:1.

## Report consumption algorithm

Use this algorithm verbatim:

1. Parse the last command's stdout as JSON.
2. Verify `schemaVersion` is supported.
3. If `ok` is false, read every blocker and the ordered `repairQueue`.
4. Read `nextAction`.
5. Treat an action with `id: "complete"`, empty `tool`, and empty `args` as a
   successful terminal action. Treat an action whose `id` begins with
   `blocked_`, or whose `tool` and `args` are both empty, as a stopped terminal
   action: report its blockers/requirements and never execute it. Any other
   action with an empty tool is malformed and a hard stop.
6. Resolve `nextAction.requires`. A requirement used as an argument appears as
   one whole token named `$REQUIREMENT`. Replace that token with the value
   directly in the argv array; never invoke a shell and never perform partial
   string interpolation. A requirement without a matching `$...` token is a
   gate condition that must be satisfied before execution.
7. If a value or gate is missing, request or complete only that requirement.
   An unresolved `$...` token is a hard stop.
8. Execute `nextAction.tool` with `nextAction.args` in the given order.
9. Require the next command to return a JSON envelope with `schemaVersion`,
   `ok`, and `nextAction`.
10. Do not run a second action in parallel.
11. Repeat from step 1.

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
