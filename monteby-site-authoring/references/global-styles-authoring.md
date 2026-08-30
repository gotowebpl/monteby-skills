# Global Styles: site-wide authoring boundary

Use this workflow only when the user explicitly requests a site-wide Global
Styles change. It is not part of page authoring, template authoring, visual
repair, or an ordinary benchmark.

Read-only consumption is different from changing Global Styles. Every authoring
mode may read `globalStyles` and optional `designTokens` from the exact live Site
Contract through `scripts/resolved-design-profile.js`. This never authorizes a
Global Styles write and never consumes `customCSS`. Existing node values and
exact measurements stay local overrides; new missing values may use published
references instead of copied literals.

`normalize-layout.js` reports an exact copied value as
`global-style-literal-match` without changing the layout. Relink only through an
explicit repair: either `--fix OUT --relink-global-tokens` for a reviewed local
pre-flight or a `relink_global_style_literal` operation already present in the
mechanically bound repair queue. Both paths re-check the current literal against
the current live contract and fail closed when the value changed.

## Allowed operation

1. Fetch the current authenticated Global Styles document from the exact live
   contract resource.
2. Preserve every field the task did not name.
3. Merge the approved change into the complete current document.
4. Validate the complete payload against the live schema.
5. Save the complete document once through the advertised resource and verify a
   fresh GET.

`globalStyles.customCSS` may change only when the site-wide task explicitly
names Custom CSS. A new value containing `@import` is invalid and must be
reported as `blocked_contract_inconsistency` if the server accepts it. Configure
fonts through WordPress Font Library and the contract-backed FontPicker, never
through CSS imports.

## Excluded surfaces

- Do not copy Custom CSS from a reference page, screenshot, demo, or another
  site.
- Do not write page, template, or node CSS during Global Styles authoring.
- Do not write Custom JS through any automated authoring path.
- Do not replace the complete document with a partial object.
- Do not use a cached GET after another editor or deployment changed the site.

Report the original document fingerprint, merged-document fingerprint, saved
fingerprint, and whether a fresh read matched. A failed validation or conflict
must leave the existing document unchanged.
