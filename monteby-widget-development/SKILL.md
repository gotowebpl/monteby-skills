---
name: monteby-widget-development
description: "Use when developing Monteby Builder/Core/Theme widgets or blocks in the local repositories: adding a new widget, converting an existing widget to props-first schema controls, updating AI props/contracts, renderer parity, editor controls, validation, or tests across monteby-builder, monteby-core, and wp-monteby-theme."
---

# Monteby Widget Development

## Overview

Use this skill for repository development of Monteby widgets and blocks. This is not the live-site authoring workflow; it is for changing the product code in Builder, Core, and Theme.

Core is the framework-neutral source for shared rendering, schemas, validation, and compiler contracts. Builder is the WordPress integration layer. Theme is a neutral Hello Elementor-like shell and should change only when frontend/theme compatibility requires it.

## Required Context

Before changing code, inspect the relevant repo context:

- `monteby-builder`: WordPress plugin integration, REST, editor enqueue, AI Chat, imports, PHP runtime, release packaging.
- `monteby-core`: canonical framework-neutral core source, shared schemas, static/dynamic renderers, compiler contracts.
- `wp-monteby-theme`: public frontend shell, global layout compatibility, neutral theme behavior.

Read each repo's `AGENTS.md` and the Builder `docs/PRODUCTION-PLAN.md` when present. Check `git status --short` in every repo you touch and do not overwrite unrelated local work.

## Workflow

1. Classify the change.

   Decide whether the task is a new widget, props-first parity for an existing widget, validation/import hardening, renderer parity, editor UX, theme compatibility, or release/documentation cleanup.

2. Inspect before inventing.

   Search existing widgets, render helpers, schema controls, compiler utilities, validation helpers, and tests. Reuse or extend local patterns before adding new classes, helpers, functions, traits, or abstractions.

3. Keep authoring props-first.

   AI/default authoring must use schema-backed props, controls, `aiProps`, defaults, and `allowedParents`. Do not expose `className`, `cssId`, raw HTML, raw CSS, Tailwind utility strings, event handlers, custom attributes, positioning, transforms, visibility, hover/active props, or other Advanced/runtime props.

4. Preserve compatibility deliberately.

   Historical `gotoweb_*`, stored node names, REST namespaces, shortcode names, CSS hooks, meta keys, and serialized names may be compatibility surfaces. Do not rename them blindly. Add aliases/migrations/tests when compatibility changes.

5. Implement in the owning layer.

   Put shared logic in Core when it is framework-neutral. Put WordPress-specific behavior, REST endpoints, saved template adapters, shortcode/runtime integration, and host choices in Builder. Keep Theme neutral and minimal.

6. Update the full authoring surface.

   For visible widgets, align editor component, schema controls, defaults, inserter props, `aiProps`, `allowedParents`, AI catalog/export/import behavior, PHP renderer, JS compiler, and Core parity where applicable.

7. Treat editor usability as part of the widget contract.

   Use control types that match the value: selects/segments for bounded choices, toggles for booleans, media controls for assets, and repeaters for ordered items. Give controls user-facing labels and predictable defaults. Repeaters must expose and enforce `minItems`/`maxItems`, disable impossible actions, preserve the active/default item after add, move, or remove, and show useful empty and limit states. For interactive widgets, keep canvas state synchronized with the inspector, support keyboard and focus behavior, use complete ARIA relations, and verify desktop/tablet/mobile preview behavior against the PHP/compiled frontend. Browser and benchmark evidence must exercise hit-tested pointer transitions plus both applicable keyboard patterns: automatic arrow activation or manual Arrow+Enter/Space activation must change selection, visible content, and focus, then restore a known default. A pixel-identical screenshot with dead, covered, pointer-disabled, or structurally unrelated handlers is a failed widget implementation. A technically valid control that is hard to discover or produces a misleading preview is incomplete.

8. Test the behavior.

   Every logical parser, validator, transformer, renderer change, or widget authoring change needs PHPUnit/Vitest coverage. Run the narrow tests first, then the relevant repo gates.

9. Record the result.

   Report what changed, which repos were touched, which tests ran, and any remaining compatibility or follow-up risk. If new helpers/classes/functions were introduced, list inspected helper/class paths and explain why reuse was insufficient.

## Detailed Playbook

Read `references/widget-development-playbook.md` when implementing or reviewing an actual widget/block change. It contains the expected files, contracts, production benchmark defect checklist, tests, and review checklist.
