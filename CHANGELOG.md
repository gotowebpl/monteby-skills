# Changelog

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
