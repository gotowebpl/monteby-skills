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

The required lifecycle is **GET → merge → full save** against the advertised
versioned resource:

1. Discover `globalStyles.resource` from the full live contract. Require its
   advertised `GET`, `PUT`, `revision`, and `expectedRevision` fields, then fetch
   the current authenticated Global Styles document through that exact resource.
2. Preserve every field the task did not name.
3. Merge the approved change into the complete current document.
4. Validate the complete payload against the live schema.
5. Save the complete document once with the freshly read `expectedRevision`
   through the advertised resource and verify a fresh GET. A conflict requires a
   new read and manual reconciliation, never an automatic retry.

`globalStyles.customCSS` may change only when the site-wide task explicitly
names Custom CSS. A new value containing `@import` is invalid and must be
reported as `blocked_contract_inconsistency` if the server accepts it. Configure
fonts through WordPress Font Library and the contract-backed FontPicker, never
through CSS imports.

## Partial update and design profiles (Builder 1.6+)

Gate both paths through `references/site-contract-compatibility.json`:
`globalStylesPatch` requires `productVersion >= 1.6.0` and
`globalStyles.resource.patchMethod: "PATCH"`; `designProfiles` requires
`authoring.designProfiles.version: 1`. An older Builder is
`blocked_plugin_version` and keeps the full-document lifecycle above; a 1.6
Builder without the advertised field is `blocked_contract_inconsistency`.
Before either write, read `site.capabilities.manageDesign` from the same live
response: every site-wide design write (global styles `PUT`/`PATCH`,
`site/branding` `PUT`, `site/company-profile` `PUT`,
`site/templates/{role}` `PUT`) requires the `monteby_manage_design` meta
capability (`manage_options` unless the host remaps it). `manageDesign: false`
means compose and preview only: report the candidate instead of collecting a
`403`.

### PATCH lifecycle

`PATCH /monteby/v1/global-styles` merges a partial document onto the stored
one under the same `expectedRevision` precondition as `PUT` (`428` without it,
`409` when stale). Colors and typography scalars replace per key,
`typography.fonts.<role>` and `typography.presets.<key>` merge per field,
`customCSS` replaces whole, and every omitted field keeps its stored value,
Custom CSS included. Removing a key still needs the complete `PUT`. Validate
a partial body against the published `globalStyles.patchSchema` and a full
body against `globalStyles.writeSchema` before sending; never derive either
shape from memory.

1. `GET` the current document through `globalStyles.resource`; keep its
   `revision`.
2. Build the partial document containing only the fields the task named.
3. Validate it against `patchSchema`.
4. Send one `PATCH` with the freshly read `expectedRevision`, then verify a
   fresh `GET`. A conflict requires a new read and manual reconciliation,
   never an automatic retry.

### Design profiles: compose → preview → apply

`authoring.designProfiles` publishes bundled palette-and-typography profiles
(`{ version, profiles[], resource }`, each `{ id, label, description, mood[],
colors, typography, headingStyle }`; every font comes from `fontCatalog`).
Choose a profile only from that live list.

1. `POST /monteby/v1/global-styles/compose { profileId, overrides? }`
   (read-only, never writes) applies the profile over the stored document,
   then the optional `overrides` (a partial document validated like `PATCH`),
   and returns the complete candidate `styles` with the current `revision`.
2. `POST /monteby/v1/preview { layout, globalStyles: <styles>, document: true,
   globalTemplates: true }` renders a page with that candidate without
   touching the stored document, transients or caches
   (`renderGlobalStylesFilter` gate; `expectedRevision` is ignored there).
   Review it at 1440/834/390 before any write.
3. Apply the reviewed candidate with `PUT` (complete document) or `PATCH`,
   sending the `revision` from step 1 as `expectedRevision`, then verify a
   fresh `GET`.

An unknown profile is `404 monteby_global_styles_unknown_profile`; a malformed
body is `400 monteby_global_styles_compose_invalid_payload`. Neither is
permission to hand-write a palette: report the failure and stop.

## Excluded surfaces

- Do not copy Custom CSS from a reference page, screenshot, demo, or another
  site.
- Do not write page, template, or node CSS during Global Styles authoring.
- Do not write Custom JS through any automated authoring path.
- Do not send a partial object to `PUT`; the only partial write is the
  advertised `patchMethod` described above.
- Do not use a cached GET after another editor or deployment changed the site.

Report the original document fingerprint, merged-document fingerprint, saved
fingerprint, and whether a fresh read matched. A failed validation or conflict
must leave the existing document unchanged.
