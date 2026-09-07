# Production Site Benchmark Gate

Use this gate after the layout-level workflow in `SKILL.md` when a benchmark is becoming a real WordPress site. It generalizes lessons from complete multipage implementations; do not store client credentials, private assets, or environment-specific URLs here.

## Site Structure

- Build page content, global header, and global footer as separate Monteby resources. Confirm the editor zones and public frontend use the same saved templates.
- Compose a WordPress header from separate layout nodes, `SiteBranding`, a contract-listed `WPMenu`, and optional CTA widgets. Keep the logo, site title, and tagline independently controllable through SiteBranding fields or dedicated widgets; never flatten the whole brand row into one image. `WPMenu` must select a real host-provided WordPress menu; a free-text location and a monolithic `Navbar` are not valid substitutes.
- Keep every visible element independently editable when users are expected to change it. A visually accurate monolithic callback is still a failed authoring result.

### Global header/footer lifecycle

For each `header` or `footer`, use the resources discovered from the same full
live contract. Creation, selection and layout persistence have independent
preconditions and are never interchangeable:

1. Call only the advertised `templates.resources.create` operation with the
   exact `type` and optional plain-text `title`. Record the returned template
   ID. Creation publishes the document but does not activate it.
2. Read `globalTemplates.{header|footer}.selectionResource`, then activate the
   new ID with one `PUT` containing `postId` and that response's
   `expectedRevision`. A `409` or `428` requires a new read and manual
   reconciliation. Never infer activation from the slug. Use `postId: 0` only
   when the live resource declares `zeroRestoresCanonical: true`.
3. Use the resulting `activePostId` as `{postId}` in the role's advertised
   layout `resource`. Snapshot it with `wordpress-layout-client.js` and a
   same-origin `--render-context-url`. Apply a bounded existing-layout change
   only through `patch-validate` followed by the emitted `patch-save`; a full
   replacement follows the normal validate/save chain. The layout's
   `postModifiedGmt` is not the selection revision.
4. Read the selection again and verify `activePostId`, `activeStatus` and
   `selectionSource`. Open the render-context page and require exactly one
   public Monteby header or footer with the saved content. A `host-filter`
   source may legitimately override the configured selection; report it rather
   than rewriting an option, slug or post meta.

Rename an existing template only through `templates.resources.title`: GET its
current title document and PUT the approved title with that document's
`expectedRevision`. A title revision cannot authorize selection or layout
writes.

## Assets

- Import licensed or user-provided media through the WordPress media library. Use optimized WebP where appropriate, preserve useful dimensions, write meaningful alt text, and set featured/social images when the page needs them.
- Treat a global logo change as an explicit site-wide branding operation. After the approved media item has a public URL, run `wordpress-layout-client.js branding-snapshot` and only its emitted `branding-save` action. The client must discover the exact Monteby Branding resource from the full live contract, send only `logoUrl` plus `expectedRevision`, and verify a fresh snapshot and the canonical public SiteBranding render.
- Never substitute `/wp/v2/settings`, `custom_logo`, `site_logo`, theme mods, full `/gotoweb-craft/v1/settings`, post meta, or layout-local `logoAttachmentId` for the Monteby Branding resource. `logoAttachmentId` is only an explicitly requested one-off responsive widget override, not site identity. A branding `409` or `428` requires a new snapshot and manual review, never an automatic retry.
- Do not hotlink reference-template assets. Marketplace demos and screenshots establish role, crop, density, and rhythm only.
- Use contract-backed Material Symbols names for icons. Do not author raw SVG paths or copied icon markup.

When a newly saved Material Symbols icon is absent publicly, do not add a
routine cache flush. A standard Builder layout save invalidates the font
dependency profile. Inspect the authenticated page diagnostics
`font_profile` first: the target and rendered global templates must appear in
`documents`, the ligature in `icons`, and `unknownIcons`/`reasons` plus
`iconsComplete` explain whether narrowing was safe. Then inspect the public
Symbols stylesheet request and rendered glyph. A complete profile that omits a
saved ligature, or remains stale after a normal save, is a product defect to
report with the profile and document versions—not permission for a permanent
flush workaround.

## Controls And Editor UX

- Use control-backed props first. A missing visual capability is a typed control/schema/render parity gap in Builder/Core, not permission to add raw HTML, raw CSS, arbitrary classes, or theme-specific patches. Those surfaces remain explicit legacy compatibility only and are never the default AI path.
- In the editor UI, generic four-side margin and padding have one owner: Advanced. Do not duplicate generic spacing in widget Style panels; semantic controls such as grid gap, item gap, or caption offset may remain widget-specific.
- Border controls must support a shared color and an intentional per-side mode. A chosen color must not create a border when all widths are `0`; each side's width/style/color must round-trip consistently through editor, compiler, and PHP renderer.
- Verify default, hover, active/current, focus-visible, and disabled states separately. Match desktop, tablet, and mobile behavior without duplicating breakpoint-only content.
- Gallery editing uses the WordPress media modal as one collection: show selected thumbnails, reopen with the current selection, allow reorder/add/remove, and expose clear grid/masonry/layout controls. Masonry passes only when variable image heights visibly affect both editor and frontend layout.
- Inspector accordions open in a deterministic state for the selected node. State from a previously selected widget must not randomly open Box, Hover, or unrelated groups.
- Editor sidebars must never require horizontal scrolling. Range sliders, steppers, segmented controls, swatches, and icon buttons must match the editor system and expose accessible names, focus, and disabled states.

## Visual Acceptance

1. Capture the reference at desktop, tablet, and mobile widths.
2. Fetch the live contract, author clean JSON, validate, perform a versioned save, and run server preview.
3. Capture the Monteby editor canvas and canonical public PHP page at the same widths.
4. Compare reference vs editor and reference vs frontend. Treat missing styles in the editor, breakpoint drift, overflow, dead states, or materially different crops as failures.
5. Reopen the saved page and global templates, then confirm controls show the values responsible for the rendered result. A page that only looks correct because of hidden theme CSS is not accepted.

## SEO Ownership

- One integration owns standard document SEO. When Yoast SEO is active, Yoast solely owns title, canonical, meta description, Open Graph, Twitter cards, standard schema graph, robots policy UI, and XML sitemap output; Builder must defer and emit no duplicate tags.
- A project plugin may add only site-specific entities, explicit index policy, and redirects that Yoast does not already own. It must reference rather than duplicate standard Organization/WebSite/WebPage schema nodes.
- Set page-specific titles, descriptions, canonical URLs, social images, and indexability in the active SEO owner, then inspect rendered `<head>` output for exactly one of each standard tag.

## Product And Release Feedback

- Route each defect to its owner: authoring mistake -> JSON/skill; WordPress integration or editor UX -> Builder; shared schema/compiler/PHP behavior -> Core; proven shell integration defect -> Theme; missing generated file -> build/release pipeline.
- Treat invalid defaults, duplicate control ownership, stale/random inspector state, sidebar overflow, misleading media controls, nonfunctional masonry, and unpolished sliders as product defects uncovered by the benchmark.
- Before deployment or packaging, build production assets and verify the release contains every enqueued file, including `dist/settings.js` and `dist/settings.css`. Smoke the Builder editor and each admin screen in a clean WordPress install; network and console output must contain no plugin-asset `404`, duplicate entry load, or uncaught error.
- Never copy Envato/ThemeForest source, assets, demo content, classes, or scripts. Use commercial references only to measure visual behavior and author an original Monteby implementation.
