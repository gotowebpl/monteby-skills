# Residual child-theme styles: exceptional policy

Residual CSS is forbidden by default in Monteby site authoring. It is not a normal
layout layer, a fast path, a fallback for missing controls, or a way to complete a
visual benchmark.

An exception is available only when the user/site owner explicitly authorizes one
named, genuinely site-specific behavior. General or reusable behavior belongs in
Monteby Builder/Core through `monteby-widget-development`.

## Non-negotiable verdict rule

Residual CSS is never:

- a prerequisite for `canonical_verified`;
- a completion criterion;
- evidence for `canonical_verified_1_to_1`;
- permission to ignore a benchmark mismatch;
- a replacement for a missing typed widget, prop, responsive control, renderer
  behavior, or validation rule.

If removing the residual makes the candidate fail the claimed match, the 1:1
verdict is unavailable. An authorized residual may accompany a published
site-specific exception, but report the page as
`canonical_verified_with_authorized_residual`, not as 1:1.

## Authorization gate

Do not create or generate a residual plan until all fields below are recorded:

```yaml
decision: explicitly-authorized
site: exact-site-identifier
authorizedBy: user-or-site-owner
authorizedAt: YYYY-MM-DD
behavior: one-named-site-specific-behavior
reasonNotProduct: why-this-is-not-reusable
affectedPageOrTemplate: exact-scope
rollback: exact-disable-or-remove-procedure
reviewOwner: named-owner
```

An inferred preference, old theme rule, broad request for “pixel perfect,” or
permission to edit the site is not explicit residual authorization.

If authorization is missing, return `blocked_residual_not_authorized`.

## Pre-authorization technical gate

Before asking for or using an exception:

1. Fetch the current live Site Contract.
2. Prove that no listed component/prop/control expresses the behavior.
3. Try a normal semantic node composition for a decorative surface.
4. Decide whether the capability would benefit more than this one named site.
5. If reusable, stop with `blocked_product_gap` and use
   `monteby-widget-development`.
6. Confirm that omitting the behavior is safe and does not corrupt content,
   accessibility, legal meaning, or a core interaction.

`scripts/audit-reference-css.mjs` may support the classification, but its residual
bucket does not grant authorization.

## Never eligible

Do not authorize residual CSS for:

- ordinary color, typography, spacing, grids, flex, dimensions, borders, single
  backgrounds, or responsive visibility that a typed control can express;
- copied selectors, classes, markup, asset URLs, fonts, or styles from an external
  reference;
- third-party brand identity, copy, contact data, or legal content;
- form consent/legal wording or privacy links;
- a reusable hover/focus/active state, responsive variant, variable-font axis,
  sticky behavior, background layer, or plugin reset that belongs in the product;
- raw HTML, scripts, event handlers, tracking, or security-sensitive behavior;
- compensating for incomplete 1440/834/390 evidence;
- making a benchmark threshold green.

Do not author `className`, `cssId`, raw style props, or Advanced/runtime props in
Monteby JSON even after an exception is authorized.

## Narrow eligible class

An authorized exception must be:

- unique to the named site's integration or art direction;
- bounded to an exact page/template/node behavior;
- nonessential to content, accessibility, legal compliance, and interaction
  semantics;
- safe to remove without invalidating the clean Monteby layout;
- documented with owner and rollback;
- generated from the freshly saved canonical page rather than copied renderer
  hashes.

Examples may include a one-off integration correction for a client-owned theme or
plugin that cannot reasonably be generalized. The example is not automatic
approval; the recorded gate still applies.

## Generated-only implementation

Renderer classes may be hashes of node props and can change after an edit. Never
hand-copy them into a stylesheet.

After explicit authorization:

1. Store a project-owned residual plan beside the layout evidence.
2. Identify nodes through stable rendered evidence supported by the generator,
   such as exact approved heading/link text or a bounded section index.
3. Generate from the freshly saved canonical page:

```bash
node "$SKILL/scripts/emit-child-theme-css.mjs" \
  --url "$PUBLIC_PAGE_URL" \
  --plan "$WORK/authorized-residual-plan.json" \
  --out "$CHILD_THEME/assets/monteby-site-exception.css"
```

4. Treat a missing or ambiguous node as failure. Do not widen the selector.
5. Regenerate after every layout save while the exception remains active.
6. Keep the plan, authorization record, generated file, and rollback instructions
   in the project repository.

The plan and authorization record are the source of truth. The generated CSS is a
derived artifact.

## Child-theme loading

Load the generated file after the child theme's normal stylesheet and version it
with `filemtime`:

```php
add_action('wp_enqueue_scripts', static function (): void {
    $path = get_stylesheet_directory() . '/assets/monteby-site-exception.css';
    if (!is_file($path)) {
        return;
    }

    wp_enqueue_style(
        'monteby-site-exception',
        get_stylesheet_directory_uri() . '/assets/monteby-site-exception.css',
        ['monteby-child'],
        (string) filemtime($path)
    );
}, 20);
```

Keep the child theme on the project's tracked bind mount or release source. Do not
leave the only copy in an ephemeral container volume.

## Verification

Verify the clean Monteby page without the residual first:

- live contract and local audit pass;
- live `/validate` passes;
- versioned save passes;
- WordPress preview and public PHP page render;
- complete 1440, 834, and 390 pixel captures exist;
- content, layout, accessibility, and interactions remain valid.

Then enable the authorized exception and verify that it affects only the recorded
scope. The exception must not introduce overflow, hide focus, alter legal copy,
load external reference assets, or change unrelated pages.

The canonical page may be delivered with the documented exception, but the
exception does not upgrade the verdict and cannot turn a failed comparison into
1:1.

## Final report

Report:

- authorization owner and date;
- exact site/page/template scope;
- behavior and why it is site-specific;
- why a product control was rejected;
- plan and generated artifact paths;
- regeneration trigger;
- rollback command/procedure;
- review owner;
- explicit statement that the exception is not 1:1 evidence or a completion
  criterion.

If the same behavior appears on another site, reclassify it as a product gap. Do
not copy the residual plan forward.
