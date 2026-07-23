# Monteby Widget Development Playbook

## Repository Responsibilities

- `monteby-core`: shared schema, validation, compiler/render contracts, host-neutral renderer behavior.
- `monteby-builder`: WordPress plugin glue, REST, editor bootstrap, AI Chat, imports/exports, PHP runtime, shortcode/direct rendering, saved post/template adapters.
- `wp-monteby-theme`: neutral frontend shell only. Change it for layout compatibility, wrapper suppression, theme metadata/release rules, or global CSS shell issues.

## New or Props-First Widget Checklist

1. Inspect nearby widgets in the same category.

   Check manifest entries, defaults, content/style schemas, advanced panel behavior, PHP renderers, compiler output, tests, and AI catalog tests.

2. Define the authoring contract.

   Include:

   - `name`
   - `label`
   - `category`
   - `allowedParents`
   - `defaults`
   - content/style schema controls
   - `aiProps`
   - `isCanvas` only when the widget truly owns children

3. Keep AI clean.

   AI props must be explicit control-backed props. Exclude Advanced/runtime props such as `className`, `cssId`, custom attributes, raw markup, raw CSS, utility strings, events, motion unless a dedicated safe motion slice exists, and hover/active state props.

4. Implement render parity.

   Align editor preview, JS compiler, PHP renderer, and Core renderer when the widget exists in more than one layer. Use existing serializers/sanitizers/style helpers instead of hand-rolled output.

5. Verify editor UX before adding more controls.

   Group controls by the task users are performing, keep the most common content choices first, and use the control type that communicates the available values. When one bounded responsive mode can override another, use the existing empty value as an explicit inheritance/default state, make new widgets inherit by default, and name every override by its visible effect; do not ship two competing authored defaults. For ordered items, define `minItems`/`maxItems`, labelled add/move/remove actions, stable selection after mutations, an obvious active item, and clear empty/limit states. Interactive previews must synchronize their active state with the inspector, expose complete ARIA relationships, support the expected keyboard model, keep focus visible, and render the same responsive modes as the compiled/PHP frontend.

6. Preserve saved-node behavior.

   Legacy props can remain as runtime/editor compatibility surfaces. They should not become new default inserter props or AI authoring props.

7. Validate imports and AI actions.

   Ensure template imports and AI modify actions strip globally blocked props and per-widget disallowed props, including nested repeater item props.

8. Add tests.

   Minimum coverage:

   - manifest/AI catalog exposes expected props and controls
   - blocked props are rejected or stripped
   - PHP renderer sanitizes and renders defaults
   - JS/PHP/Core parity when the widget participates in shared rendering
   - saved legacy props remain compatible when required
   - editor add/move/remove/default-active flows and min/max boundaries
   - keyboard, focus, ARIA, and desktop/tablet/mobile preview parity for interactive widgets

9. Run gates.

   Typical Builder gates:

   - `composer analyse -- --no-progress`
   - `composer test -- --colors=never`
   - `npm test`
   - `npm run type-check -- --pretty false`

   Add Core/Theme gates when those repos are touched.

## REST and Host Choices

Host-specific IDs and names must come from the current WordPress site or Builder host adapters. Do not place guessed template IDs, taxonomy names, term IDs, post type names, or menu IDs into static Core contracts unless they are host-neutral placeholders.

## Production Benchmark Defect Checklist

Use complete site benchmarks as product tests, not as a reason to add client CSS:

- WordPress global headers and footers remain separate templates. A global header uses separate `SiteBranding`, host-choice-backed `WPMenu`, CTA, and layout nodes; do not collapse it into `Navbar` or a site-specific widget.
- Generic four-side spacing belongs to one Advanced control surface. Do not repeat margin/padding in widget Style schemas; keep only semantically distinct spacing such as gap or media offset.
- Border controls support shared and per-side intent. A color with zero widths renders no border, and editor/compiler/PHP paths must agree on every side.
- WordPress galleries use the media modal as a collection, reopen with selected attachments, show useful thumbnails, preserve order, and expose tested grid/masonry behavior. A masonry label without visibly variable editor/frontend placement is a defect.
- Material Symbols controls store icon names. Raw SVG/path data stays legacy/runtime compatibility and outside default/AI authoring.
- Inspector disclosure state resets deterministically for a newly selected node; unrelated Box/Hover groups must not open because another node used them. Sidebars have no horizontal overflow, and sliders plus compact controls match the editor's visual/focus/disabled states.
- When Yoast SEO is active, Builder defers standard title/canonical/description/Open Graph/Twitter/schema/sitemap output. Do not solve duplicate ownership in a theme or client layout.
- Release verification must build and assert every enqueued admin asset, including `dist/settings.js` and `dist/settings.css`, then open the real admin page and fail on asset `404` or console errors.

## Product Surface Rules

- Product-facing language should be Monteby/universal.
- Do not reintroduce store, marketplace, invoice, shipping, client-site, or WooCommerce-demo assumptions.
- Raw HTML remains hidden legacy/runtime compatibility only, never an AI/default authoring path.
- Theme remains a neutral shell similar to Hello Elementor.

## Review Checklist

Before finalizing, verify:

- No unrelated refactors or namespace rewrites slipped in.
- No debug logs, dead code, commented-out code, unused imports, or temporary statements remain.
- PHP files use `declare(strict_types=1);` and precise types/PHPDoc array shapes.
- PHPStan Level 9 has no warnings.
- Every new behavior has a matching test.
- Inspector state and canvas state stay synchronized after item selection, add, move, and removal.
- Empty, minimum, maximum, disabled, invalid, and server-preview failure states remain understandable.
- Desktop, tablet, and mobile previews match compiler/PHP behavior for the same props.
- Release/public-surface scanners remain compatible when product copy or release contents changed.
