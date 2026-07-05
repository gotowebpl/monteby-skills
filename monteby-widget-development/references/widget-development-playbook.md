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

5. Preserve saved-node behavior.

   Legacy props can remain as runtime/editor compatibility surfaces. They should not become new default inserter props or AI authoring props.

6. Validate imports and AI actions.

   Ensure template imports and AI modify actions strip globally blocked props and per-widget disallowed props, including nested repeater item props.

7. Add tests.

   Minimum coverage:

   - manifest/AI catalog exposes expected props and controls
   - blocked props are rejected or stripped
   - PHP renderer sanitizes and renders defaults
   - JS/PHP/Core parity when the widget participates in shared rendering
   - saved legacy props remain compatible when required

8. Run gates.

   Typical Builder gates:

   - `composer analyse -- --no-progress`
   - `composer test -- --colors=never`
   - `npm test`
   - `npm run type-check -- --pretty false`

   Add Core/Theme gates when those repos are touched.

## REST and Host Choices

Host-specific IDs and names must come from the current WordPress site or Builder host adapters. Do not place guessed template IDs, taxonomy names, term IDs, post type names, or menu IDs into static Core contracts unless they are host-neutral placeholders.

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
- Release/public-surface scanners remain compatible when product copy or release contents changed.
