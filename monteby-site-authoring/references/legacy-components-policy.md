# legacyComponents policy

Since Builder 1.2.0 the live contract publishes a `legacyComponents` array. On
the current gotoweb contract it lists 25 names, for example `ButtonLink`,
`FeatureCard`, `LoopGrid`, `SearchShell`, `HTMLEmbed`, `TextBlock`,
`SpacerBlock`, `FormContainer` with its field nodes, the WooCommerce shells,
and `WPBridge`. Always read the array from the live contract; the exact list is
site-specific and changes between releases.

## What the flag means

A name in `legacyComponents` **validates without a schema**: `/validate` and
the editor accept the node, but no typed props, controls, `aiProps`, or
`allowedParents` are published for it. Nothing checks its prop values, so a
"0 errors" validation report proves nothing about a legacy node's contents.

## Rules

1. **Editing an existing page**: legacy nodes already present in a saved layout
   may be preserved as-is. Do not rebuild them opportunistically; an untouched
   legacy subtree is cheaper and safer than a speculative migration. When the
   task explicitly asks to restyle or extend a legacy node, prefer migrating
   that node to its full-schema replacement in the same change.
2. **New trees**: never author a `legacyComponents` name in a new page, a new
   section, or a template. New composition uses only components with a full
   published schema (typed props, controls, `allowedParents`).
3. **Not "modern"**: a legacy name being accepted by validation is not an
   endorsement. Treat `LoopGrid`, `SearchShell`, `HTMLEmbed`, and the other
   listed names as compatibility surface, and use their schema-backed
   counterparts (`QueryLoop`, `SearchForm`, typed widgets) for new work.
4. **Reporting**: when a run preserves legacy nodes, list them in the final
   report (component name and count) so the site owner can plan migration. When
   a needed behavior exists only in a legacy component, that is a product gap
   (`monteby-widget-development`), not a reason to author the legacy name.
