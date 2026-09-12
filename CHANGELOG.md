# Changelog

## 0.6.0 - Unreleased

- Accept the `description` field Builder 1.6 publishes on every composition
  recipe; `layout-kit.mjs` previously rejected such contracts with
  `recipe.description: unknown field`.
- Add optional Builder 1.6.0 feature gates with named fallbacks: annotated
  render, request-scoped layout/global-styles/global-template render filters,
  preview global templates, server-side composition instantiation, bulk page
  creation, global styles PATCH, design profiles, per-component contract reads
  and WordPress abilities. Existing gates are unchanged.
- Document the Builder 1.6 authoring surfaces where their workflows live:
  global styles PATCH and compose → preview → apply under `manageDesign`;
  revision restore, `lint` and preview options for partial operations;
  server-side `compositions/plan` and `instantiate` as the canonical brief
  route with `layout-kit.mjs` as the offline fallback; bulk create with
  `requestId`, page context, document listing, `template-create` with
  `layout`, catalog and summary contract modes, icon/font catalog validation
  and abilities in the mechanical protocol and client handoff.

## 0.5.0 - Unreleased

- Restore the scroll origin before measuring full-page geometry, including
  sites with smooth scrolling; an unsettled origin stops capture instead of
  reporting missing content bands.
- Preserve measured native-icon smoothing through a matching live IconBlock
  control; refuse unsupported values instead of adding author CSS. Existing
  unmeasured icons keep their preview behavior.
- Use generic capture and drafting with ordered non-landmark bands, preserved
  non-breaking spaces and evidence-backed constraint decisions across viewports.
- Resolve icons through the versioned native catalog and an approved SHA-bound
  mapping. Unsupported icons block authoring without raster or raw SVG fallback.
- Resume icon approval and later repairs from the exact hash-bound reference
  capture. Changed source, contract, options or captured files stop the run
  instead of silently taking a different screenshot set.
- Share published control metadata and the resolved design profile across the
  Kit, drafter, normalization, repair and capability audits.
- Preflight all pages before a multi-page write and persist a conflict-aware
  resume ledger without claiming a cross-page database transaction.
- Bind content completeness and applied-prop verification to the exact source,
  site, page and scope; ambiguous evidence cannot receive a one-to-one verdict.
- Probe actual browser startup, frames, screenshots and shutdown before capture.
  The native Windows and Git Bash workflow remains manual and awaits execution.
- Accept the expanded native site-identity document while logo operations still
  write only Monteby Branding and verify that native identity remains unchanged.
- Preserve owned form content when the source form has no HTML `id` by assigning
  a deterministic unique FormBlock identifier; unsafe or shared source IDs still stop drafting.
- Preserve ordinary top-level notice and content bands through neutral page wrappers,
  and decompose compound linked cards without turning simple links into nested containers.
- Compare captured ordinary root groups alongside semantic landmarks so valid notice
  and content bands are not misreported as removable candidate sections.
- Render native IconBlock glyphs and their accessible names in diagnostic previews;
  load their font dependency and retain the public textarea minimum height.
- Preserve boundary non-breaking spaces in content verification and diagnostic labels;
  losing a hard space can no longer produce an exact-content verdict.
- Match independent textarea sizing and submit-button alignment in diagnostic
  previews while preserving omitted defaults, exact field radii and global bindings.
- Capture form labels, spacing, control sizes and linked-card decoration through
  published controls instead of approximating the source with preset defaults.
- Reject incomplete measured-constraint evidence and stale capture checkpoints;
  preserve explicit responsive constraints without freezing text-derived heights.
- Keep fluid measured content frames responsive without inferring fluidity from
  fixed-width counterexamples, and retain native icon order and measured CTA alignment.
- Preserve measured form label/button leading and system font identities through
  drafting and diagnostic rendering, including published global references.
- Verify residual geometry in actual CSS pixels. Missing or incomplete pixel
  evidence cannot be substituted by normalized geometry or receive a subpixel pass.
- Render published global bindings and typography presets from the same full
  live contract used for authoring, with explicit system, Google and local font
  origins. Unresolved references stop the diagnostic without changing page JSON.

## 0.4.1 - 2026-09-07

- Reset the layout Kit only after a successful write, validate published style
  values, and remove empty operation containers without dropping intentional values.
- Preserve non-breaking spaces, ignore HTML comments as content, and report
  uncovered reference bands, omitted inline SVG and rigid measured constraints.
- Recognize a bounded contact strip before navigation in the existing media audit
  without lowering photographic-media thresholds.
- Keep measured button paint on the button and prevent colour-only bindings from
  inventing a border in diagnostic previews.
- Compare approved client text with the live content ledger through an explicit
  verifier reporting missing, changed, duplicated and additional content.
- Use shell-free browser capture invocation on Windows and document safe Git Bash
  commands, real-browser motion QA, font diagnostics and independent breakpoint grids.
- Document discovery, selection and versioned editing of global templates through
  the live Builder contract, without direct database or slug rewrites.

## 0.4.0 - 2026-09-07

- Expand strict content plans through the live Builder composition catalog and
  existing Kit, including typed repeaters and real navigation targets.
- Preserve explicit responsive typography, resolve effective preset line height,
  and apply a bounded h3 fallback only when that role is absent.
- Reject unsafe project tokens and aliased CLI output files rather than silently
  substituting values or overwriting source inputs.
- Guide full-page briefs through published hero, navigation and footer choices,
  approved media, canonical WordPress verification and independent visual review.
- Add an optional Builder 1.5.1 compositions feature gate while retaining the
  Builder 1.4.0 baseline for existing authoring routes.

## 0.3.1 - 2026-08-30

- Add a bounded `branding-snapshot` and `branding-save` workflow discovered
  from the live Monteby Site Contract.
- Store site-wide AI-authored logos only in Monteby Branding with a revision
  precondition; never write WordPress `custom_logo`, theme mods, post meta,
  layout-local logo props, or the complete private plugin settings document.
- Validate the exact branding resource, snapshot scope, response document and
  public HTTP(S) media URL, with no automatic retry after a conflict.

## 0.3.0 - 2026-08-30

- Resolve project tokens, live global styles, component design tokens, and
  neutral fallbacks through one shared design profile used by layout-kit,
  measured drafting, normalization, and explicit repair.
- Preserve local node overrides while applying contract-backed color,
  typography, button, form, radius, shadow, and content-width bindings only to
  missing props.
- Report global-style and design-token conflicts deterministically, keep global
  colors and typography authoritative, and exclude Custom CSS from resolution.
- Detect literals that exactly match a live global reference and allow repair
  only through an explicit exact-match operation.
- Add an optional Builder 1.5.0 `designTokens` feature gate while keeping older
  live contracts compatible through global styles and neutral fallbacks.

## 0.2.3 - 2026-08-22

- Author linked Containers only with the complete `tag: "a"` plus
  `href`/`dynamicHref` contract and mirror that behavior in diagnostic preview.
- Accept only the exact reviewable `increase-text-contrast` operation published
  by the live accessibility audit; never invent a replacement color.

## 0.2.2 - 2026-08-20

- Route visible direct text through measured drafting and the independent content ledger without duplicating complete semantic text.
- Preserve full source text while disclosing evidence-count and Range-geometry bounds.
- Bind semantic form controls to one exact DOM form owner, group radio options by form and name, and reject unsupported checkbox groups.
- Keep captured form copy and URLs behind the owned-source `preserveSourceText` gate; external references receive neutral structure or `blocked_legal_copy`.
- Validate portable form identifiers and numeric constraints against live nested controls.
- Restore geometry repairs to measured height and content-inset targets so an initial repair is material when the candidate differs.
- Keep FAQ, pricing compositions, and WooCommerce host bindings outside this release; their absence remains a product or contract-gated gap rather than inferred site-specific behavior.
