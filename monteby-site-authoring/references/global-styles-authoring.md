# Global Styles: site-wide authoring boundary

Use this workflow only when the user explicitly requests a site-wide Global
Styles change. It is not part of page authoring, template authoring, visual
repair, or an ordinary benchmark.

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
