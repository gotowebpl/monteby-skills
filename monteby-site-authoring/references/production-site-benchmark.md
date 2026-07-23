# Production Site Benchmark Gate

Use this gate after the layout-level workflow in `SKILL.md` when a benchmark is becoming a real WordPress site. It generalizes lessons from complete multipage implementations; do not store client credentials, private assets, or environment-specific URLs here.

## Site Structure

- Build page content, global header, and global footer as separate Monteby resources. Confirm the editor zones and public frontend use the same saved templates.
- Compose a WordPress header from separate layout nodes, `SiteBranding`, a contract-listed `WPMenu`, and optional CTA widgets. Keep the logo, site title, and tagline independently controllable through SiteBranding fields or dedicated widgets; never flatten the whole brand row into one image. `WPMenu` must select a real host-provided WordPress menu; a free-text location and a monolithic `Navbar` are not valid substitutes.
- Keep every visible element independently editable when users are expected to change it. A visually accurate monolithic callback is still a failed authoring result.

## Assets

- Import licensed or user-provided media through the WordPress media library. Use optimized WebP where appropriate, preserve useful dimensions, write meaningful alt text, and set featured/social images when the page needs them.
- Do not hotlink reference-template assets. Marketplace demos and screenshots establish role, crop, density, and rhythm only.
- Use contract-backed Material Symbols names for icons. Do not author raw SVG paths or copied icon markup.

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
