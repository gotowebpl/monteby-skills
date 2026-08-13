---
name: monteby-site-authoring
description: Use when authoring or modifying Monteby Builder layouts on any live WordPress site with Monteby Builder + Monteby Theme, when taking over or handing off a Docker-backed Monteby client site, or when stress-testing Monteby authoring fidelity by recreating HTML/screenshot targets as clean Monteby JSON. Discover the real environment, fetch the site's live contract, generate valid control-backed JSON, validate through REST, save through REST, preview through WordPress/PHP, and handle child-theme custom widgets declared by the site contract.
---

# Monteby Site Authoring

This skill is a router plus a small set of non-negotiable policies. Mechanics live
in the references and scripts; judgment is spent only on the bounded reports the
tooling produces.

## Base mode router

Choose exactly one base mode for the run, from the task alone. Do not combine modes in one run. Modes do not stack; a new need means a new run with its own
mode.

| Mode | Use when | Primary references |
|---|---|---|
| `live-page-edit` | editing or extending pages on a working Monteby site | `references/mechanical-workflow-protocol.md` |
| `owned-html-reconstruction` | reproducing an owned/licensed HTML mockup as a Monteby page | `references/quick-start-runbook.md`, `references/html-to-monteby.md` |
| `content-brief-authoring` | building a page from a written brief / content JSON, with no reference HTML to measure | `references/brief-to-monteby.md` |
| `external-reference-benchmark` | third-party demo/template fidelity benchmarks | `references/visual-benchmark-loop.md` |
| `handoff` | takeover/handoff of a Docker-backed client installation | `references/client-site-handoff.md` |
| `custom-widget` | registering a site-specific child-theme widget | `references/custom-widget-registration.md` |
| `product-gap` | the contract cannot express a required, reusable behavior | `monteby-widget-development` skill |

A raster reference (user screenshot or a design-skill-generated image) routes
through `references/design-handoff.md`: owned images become owned local HTML
via a design skill and enter `owned-html-reconstruction`; third-party
screenshots stay `external-reference-benchmark`.

For `live-page-edit` and `owned-html-reconstruction`, read
`references/mechanical-workflow-protocol.md`. Its explicitly labeled read-only
contract bootstrap happens before the mutation state machine; no candidate exists
then, so do not consume the bootstrap report's `validate_candidate` action. Once
the protocol says the state machine has started, execute only the `nextAction`
emitted by the current report — one step, one artifact, one pass condition at a
time. Do not plan past it.

For the other four modes, follow only the primary reference or skill named in the
router row; they do not use the page-mutation state machine unless that reference
explicitly enters it.

In `handoff` mode, keep `AGENTS.md` and `CLAUDE.md` semantically equivalent as
required by `references/client-site-handoff.md`.

## Verdict taxonomy

- `diagnostic_passed`: local/static iteration passed; no canonical claim.
- `canonical_verified`: the saved canonical WordPress/PHP page passed the
  required checks for the mode.
- `canonical_verified_1_to_1`: additionally, complete full-page comparison at 1440, 834, and 390 pixels
  matched every band against the reference captures.
- `canonical_verified_with_authorized_residual`: canonical result shipped with a
  recorded residual exception; never equivalent to 1:1.
- `blocked_*`: a hard stop below fired; name it exactly.

A script exit code, static preview, or partial capture can yield only a diagnostic verdict.
Canonical verdicts come from the saved canonical WordPress/PHP page.

## Hard stops

**Secrets — `blocked_secrets`.** Refuse any step whose transcript, file, or
command output would contain a password, application password, cookie, nonce,
bearer value, or authorization header value; commands may name an environment
variable but never contain its value.

**Source rights — `blocked_source_rights`.** Ownership or reuse rights unproven
for the reference? Reclassify the work as `external-reference-benchmark` and do
not use `--preserve-source-text`. Third-party HTML, classes, scripts, asset URLs,
brand identity, contact data, legal text never enter authored output.
HTML or images generated locally in this project from the user's own
brief/tokens count as owned when their provenance is recorded in
`handoff.json`; see `references/design-handoff.md`.

**Product boundary — `blocked_product_gap`.** A required behavior that is
reusable across sites belongs in Builder/Core. Return `blocked_product_gap` and switch to
`monteby-widget-development`; do not approximate it with classes, raw CSS, or
theme code.

**Legal copy — `blocked_legal_copy`.** Author a consent checkbox, privacy link,
or any legal wording only when approved project requirements explicitly include
it and the user/project approved that exact text and its destination URLs. Do not
invent a controller, purpose, privacy URL, checkbox, or legal page. When an
approved form scope requires copy that is unavailable, stop.
Return `blocked_legal_copy` for that form and finish the rest of the page. Never invent
legal wording, create a legal page, or expand the task's legal scope.

**Residual CSS — `blocked_residual_not_authorized`.** Residual CSS is forbidden
by default and sits outside every completion path. When the contract cannot
express a measured behavior, a generated child-theme stylesheet may carry the
remainder only as an explicitly authorized, site-specific exception — gate,
scope, and rollback in `references/child-theme-residual-styles.md`. It is never
a completion criterion or evidence for 1:1.

## Live contract policy

Read `references/site-contract-compatibility.json` before authoring; it records
the exact-live-contract compatibility policy for this skill release.
Always fetch `GET /wp-json/monteby/v1/contract` for the target site.
Never use the compatibility policy, remembered contracts, or bundled snapshots
as a substitute for the live response — components, controls, host choices, and
persistence capabilities are authoritative only there.

When the live response includes `companyProfile`, treat it as the site's
authoritative public identity. Prefer matching `dynamicFields.fields` keys that
start with `company_` for company names, logos, telephone and email content or
links, address, identifiers, service areas, languages, and contact hours. Do not
copy those values into static widget props unless the user explicitly requests a
deliberate one-off override. Never infer missing identity data from screenshots,
page copy, SEO snippets, or a third-party reference; report the missing profile
field and continue with content that does not require it. A `company_phone_url`
or `company_email_url` binding is the canonical link target; do not construct a
`tel:` or `mailto:` value from display text.

When a page needs a public listing, search, sort, filters, active-filter pills,
pagination, or an editable empty state, read
`references/query-loop-authoring.md`. Build the whole composition from the live
`authoring.relationshipRules.queryControls`, component schemas, and
`hostChoices.queryLoop`; never infer a `queryId`, post type, taxonomy, term,
template, custom-field key, public sort parameter, or indexable filter set.

When the task authors or changes page SEO, its page role, FAQ schema, or an
Article/Service relationship, read `references/page-role-and-schema.md`. The
live `layoutPersistence.seo` schema, owner and graph-preview contract are the
only authority. Never infer a role from a slug, write raw JSON-LD, or claim the
preview is canonical proof before checking the saved server-rendered page.

When the live layout response carries `accessibilityAudit`, read
`references/accessibility-audit-fixes.md`. Treat every `fix` as a reviewable
proposal, never as permission: show every advertised `changes` entry, obtain
explicit approval, and submit only the exact advertised `update_props`
operation through the live operation preflight. Never invent a fix for a
finding, apply one to another `documentId`, auto-apply it, or auto-save it.

When the live contract publishes `layoutPersistence.contentQualityAudit`, read
`references/expert-content-authoring.md` and treat `roleRequirements` as the
explicit checklist for the selected page role. The report is read-only: never
turn a finding into invented copy, identity, chronology, review or source, and
never claim answer-engine readiness unless `passed`, `complete` and
`serverRendered` are all true in the freshly saved response.

When the live contract publishes `indexing.indexNow`, read
`references/indexnow.md`. Treat page-save acceptance and IndexNow delivery as
separate facts: saving queues an eligible change asynchronously, while only the
authenticated status/history resource records a provider response. Never
generate or rotate a key, submit an off-site URL, submit a known draft/private/
password-protected/noindex post, run the queue, or manually submit a removed URL
unless the user explicitly asked for that operational action.

When the live contract publishes `indexing.llmsTxt`, read
`references/llms-txt.md`. Ownership is authoritative: do not create a competing
file while the owner is `external`, and do not enable Builder or change its
site-wide section policy during an ordinary page edit. Bind every inspection to
the authenticated preview's exact bytes and SHA-256, then compare the public
root file separately. A valid directory is discovery evidence only — never
permission to crawl or train, proof of AI use/citation, or an AEO verdict.

## Persistence endpoints

- `POST /wp-json/monteby/v1/validate`
- `GET /wp-json/monteby/v1/pages/{id}/layout`
- `PUT /wp-json/monteby/v1/pages/{id}/layout`
- `POST /wp-json/monteby/v1/preview`

For a bounded change to existing nodes, prefer the operation resources exposed
under `layoutPersistence.operations` in the live contract. Read
`references/partial-layout-operations.md`; use `patch-validate`, then execute
only its emitted `patch-save` action. The live `operationSchemas` are the sole
authority for operation payloads, including whether `update_props` supports
`unsetProps`. Bind the page snapshot, `postModifiedGmt`, canonical operations
SHA-256, and `candidateLayoutSha256`. Missing evidence is a hard stop.

Save only through the versioned PUT with a fresh `expectedModifiedGmt` taken
immediately before the write. A save returns `428` or `409` only for versioning:
a `428` means the precondition is absent; a `409` means another editor changed
the page. Refetch, reconcile, revalidate, and issue one new explicit save action;
never retry PUT automatically. Never bypass a conflict with stale JSON, and never
write post meta or `post_content` directly.

Apply the same rule to partial writes: never retry `409` or `428`, never apply
without a successful preflight, and never reuse a preflight after the page or
operations file changes.

When the live contract advertises presentation persistence, send presentation
in the same versioned layout PUT: `full-width` for edge-to-edge page bands,
`canvas` with `"disableGlobalTemplates": true` for standalone benchmark pages.
Never call the legacy page-settings route for AI authoring and
never send Custom CSS/JS through this API. Send `seo` only when the same live
layout resource advertises `layoutPersistence.seo`, its owner is authorable,
and `references/page-role-and-schema.md` permits the evidence-backed change.

Global header/footer templates are `gotoweb_template` posts resolved **by the
canonical slugs** `gotoweb-global-header` / `gotoweb-global-footer` (plus the
`_gotoweb_craft_template_type` meta); a theme-selected template must resolve to
the same post, or the panel edits a template the site does not render. Compose
headers from `SiteBranding`, a host `WPMenu`, and layout nodes — never one
monolithic `Navbar`.

## Canonical mechanical path

For measured references, capture with `scripts/run-visual-iteration.js`
(full-page, 1440/834/390). The runner invokes the generic measured path in
`scripts/draft-monteby-layout.js` with the mechanical plan written with
`--plan-out`, then emits the exact plan and layout it benchmarked. Gate on that
plan (`allBandsMapped`, `allSurfacesMapped`, no truncation, equal band/surface
counts, nothing omitted) and its plan/layout/contract/manifest SHA-256 bindings.
Do not rerun the drafter after a passing runner. When a report emits AUTHOR,
execute its `scripts/apply-layout-repair-queue.js` action; never translate the
queue into a manual edit. The applier changes only mechanically proven targets
and stops on ambiguous content, identity, contract, or graph evidence.
This prohibition applies only in `owned-html-reconstruction`, where a measurable reference exists. In `content-brief-authoring` there is no reference to measure, and the canonical route is `layout-kit.mjs` — see `references/brief-to-monteby.md`.

Do not replace this path with a browser snippet, a hand-written `build.mjs`,
or manual node-map transcription as the primary route.

The runner's `diagnostic_passed` remains non-canonical. Continue through its
emitted snapshot, validation, versioned save, and PHP preview actions. Only
`scripts/run-canonical-verification.js`, bound to the successful preview report,
may upgrade the verdict after comparing the saved canonical WordPress/PHP page
at all three widths.

## Utilities outside the reproduction state machine

Never select these while a page-reproduction report chain is active; its
`nextAction` is the only executable route. Other router modes may use a utility
only when their primary reference explicitly calls for it.

- `scripts/layout-kit.mjs` — declarative node-map builder: enforces components,
  props, blocked props, `allowedParents`; snaps values to control step/enum/type;
  repairs known renderer traps.
- `scripts/normalize-layout.js` — pre-flight for an existing node map; reports
  every violation class at once, `--fix` writes the repaired copy.
- `scripts/audit-reference-css.mjs` — classifies every reference CSS declaration
  before authoring: contract-expressible, rebuild-as-node, product gap, residual.
- `scripts/emit-child-theme-css.mjs` — generates an authorized residual
  stylesheet from a plan plus the freshly saved page; never hand-write renderer
  classes.
- `references/html-to-monteby.md` — measured evidence → composition lookup,
  control-value rules, renderer traps (text margins, single-edge borders,
  `ListBlock` string items, media sizing, gradients), and the 1.2.0 composition
  routes (`backgroundLayers`, background video with mobile policy, media filter
  tiers, rhythm presets, `layerPull`, `Heading.href`, FormBlock v2).
- `references/legacy-components-policy.md` — `legacyComponents` names validate
  without a schema; preserve them when editing existing pages, never author
  them in new trees.
- `references/design-handoff.md` — seam with the local design skills: image
  references, locally generated HTML as owned input, and the `handoff.json`
  artifact (tokens, section list, breakpoints, asset manifest) produced and
  consumed by the modes.
- `references/expert-content-authoring.md` — evidence-bound use of `AuthorBox`,
  `PostInfo`, `QuickAnswer`, and `Sources`. Use it whenever the live contract
  exposes any of those widgets or `layoutPersistence.editorial`; use only the
  server-published expert directory, bind review confirmation to the advertised
  content fingerprint, and never invent an author, reviewer, verification
  date, source, profile, or factual answer to fill a component.
  When the live contract exposes `contentQualityAudit`, use its role-specific
  requirements and verify the fresh saved report; findings never authorize an
  automatic content fix.
- `references/page-role-and-schema.md` — evidence-backed page roles, the full
  SEO block, Yoast handover, `seoGraph` diagnostics and server-rendered graph
  verification. Use it for every AI-authored SEO or schema-role change.
- `references/accessibility-audit-fixes.md` — read-only audit evidence and the
  approval-bound path from an advertised exact diff through operation preflight
  to one versioned partial save. Use it whenever `accessibilityAudit` carries a
  `fix`.
- `references/indexnow.md` — contract-led IndexNow eligibility, asynchronous
  queue semantics, manual-submit guardrails, and the evidence required before
  reporting provider acceptance. Use it whenever `indexing.indexNow` is present
  and the task includes publication, indexing, or an indexing-status claim.
- `references/llms-txt.md` — single-owner policy, explicit section evidence,
  authenticated preview validation and byte-for-byte public `/llms.txt`
  verification. Use it whenever `indexing.llmsTxt` is present and the task
  includes AI discovery, AEO diagnostics or a claim about the generated file.
- `references/mechanical-workflow-protocol.md` §“Performance budgets” and
  §“Tablet-width rule” — final-gate budgets (page weight, image formats, video
  poster requirement, node-count threshold) and the single 900px/767px sheet
  rule behind the 1440/834/390 measurement viewports; these apply to every
  mode's final report, not only the mechanical state machine.

## Reporting

End every run by naming the mode, the exact verdict, the artifacts produced, the
report entries worked or carried as `blocked_*`, and any residual exception with
its authorization record. If the same residual appears on a second site,
reclassify it as a product gap.
