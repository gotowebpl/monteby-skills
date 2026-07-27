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

## Persistence endpoints

- `POST /wp-json/monteby/v1/validate`
- `GET /wp-json/monteby/v1/pages/{id}/layout`
- `PUT /wp-json/monteby/v1/pages/{id}/layout`
- `POST /wp-json/monteby/v1/preview`

Save only through the versioned PUT with a fresh `expectedModifiedGmt` taken
immediately before the write. A save returns `428` or `409` only for versioning:
a `428` means the precondition is absent; a `409` means another editor changed
the page. Refetch, reconcile, revalidate, and issue one new explicit save action;
never retry PUT automatically. Never bypass a conflict with stale JSON, and never
write post meta or `post_content` directly.

When the live contract advertises presentation persistence, send presentation
in the same versioned layout PUT: `full-width` for edge-to-edge page bands,
`canvas` with `"disableGlobalTemplates": true` for standalone benchmark pages.
Never call the legacy page-settings route for AI authoring and
never send Custom CSS/JS/SEO through this API.

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
  `ListBlock` string items, media sizing, gradients).

## Reporting

End every run by naming the mode, the exact verdict, the artifacts produced, the
report entries worked or carried as `blocked_*`, and any residual exception with
its authorization record. If the same residual appears on a second site,
reclassify it as a product gap.
