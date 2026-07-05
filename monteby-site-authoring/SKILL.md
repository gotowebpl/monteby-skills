---
name: monteby-site-authoring
description: Use when authoring or modifying Monteby Builder layouts on any live WordPress site with Monteby Builder + Monteby Theme. Fetch the site's live contract, generate valid Monteby JSON, validate through REST, save through REST, and handle child-theme custom widgets declared by the site contract.
---

# Monteby Site Authoring

## Overview

Use this skill for site-level AI authoring on an existing WordPress installation. The live site contract is the source of truth; do not rely on a local repo, static widget memories, or pasted HTML-to-JSON conversion.

The canonical storage is Monteby JSON in WordPress post meta, and canonical rendering is the WordPress/PHP renderer. Do not introduce Astro, Node, React server rendering, static export, raw HTML authoring, or a separate frontend runtime for this workflow.

## Required Workflow

1. Detect WordPress and Monteby.

   Confirm the target is a WordPress site with Monteby Builder active. Prefer authenticated REST calls to:

   - `GET /wp-json/monteby/v1/contract`
   - fallback presence checks such as `/wp-json/`, plugin admin context, or user-provided credentials/session only when the contract endpoint is unavailable.

2. Fetch the live contract.

   Always request `GET /wp-json/monteby/v1/contract` before planning the layout. Treat its `components`/`widgets`, `props`/`aiProps`, `controls`, `defaults`, `allowedParents`, `globalStyles`, `templates`, and `hostChoices` as authoritative.

3. Build only valid Monteby JSON.

   Use a Craft-style node map with `ROOT` as the canvas root. Top-level children must be contract-allowed root components, normally `Section`. Place `Container` and leaf widgets only under parents listed in each widget's `allowedParents`.

4. Stay inside authoring props.

   Use only props listed by the contract for that widget. Never author:

   - `className`, `cssId`, `motion`, `customAttributes`, advanced/runtime props, positioning/transform/visibility props, hover/active props
   - raw HTML, raw CSS, inline scripts, event handler props such as `onClick`
   - Tailwind utility strings or arbitrary class strings
   - unknown widgets, guessed host IDs, guessed taxonomy names, or guessed template IDs

5. Validate before saving.

   Send the candidate layout to `POST /wp-json/monteby/v1/validate`. If validation fails, revise the node map using the returned errors. Do not save a layout that has not passed validation.

6. Save only through the official API.

   Use `PUT /wp-json/monteby/v1/pages/{id}/layout` with a validated `layout`, `nodeMap`, `nodes`, or `builderJson` payload. Do not write post meta directly, do not use wp-admin form scraping, and do not update `post_content` yourself.

7. Preview and inspect.

   Use `POST /wp-json/monteby/v1/preview` to render the final candidate and inspect the returned HTML for obvious blank output or server-side fallback comments. Then load the public page if the user asks for visual verification.

## Endpoint Contract

Use these endpoints:

- `GET /wp-json/monteby/v1/contract`
- `POST /wp-json/monteby/v1/validate`
- `GET /wp-json/monteby/v1/pages/{id}/layout`
- `PUT /wp-json/monteby/v1/pages/{id}/layout`
- `POST /wp-json/monteby/v1/preview`

Expected payload shape:

```json
{
  "layout": {
    "ROOT": {
      "type": { "resolvedName": "RootCanvas" },
      "isCanvas": true,
      "props": {},
      "nodes": ["section-1"]
    },
    "section-1": {
      "type": { "resolvedName": "Section" },
      "isCanvas": true,
      "props": {},
      "parent": "ROOT",
      "nodes": []
    }
  }
}
```

## Custom Widgets

Child-theme custom widgets are valid only when they appear in the live contract. In the MVP they are leaf widgets: they cannot contain children and must be placed inside existing layout canvases such as `Section` or `Container`.

When the user asks how to add a missing dedicated block in a child theme, load `references/custom-widget-registration.md`.

## Failure Handling

If `/contract` is unavailable, do not invent a contract. Explain that this workflow needs Monteby Builder's live Site Contract API and ask for access to a site where it is active.

If a widget or prop is missing from the contract, omit it or ask for a child-theme widget to be registered. Do not use raw HTML as a workaround.

If validation rejects host choices such as `templateId`, taxonomy, or term IDs, refresh `/contract` and use only values returned by `hostChoices`.
