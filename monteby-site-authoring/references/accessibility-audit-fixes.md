# Reviewable accessibility fixes

Use this path only when the live page-layout response publishes
`accessibilityAudit` and the live contract publishes
`layoutPersistence.accessibilityAudit`. The audit is read-only. A finding can
carry a deterministic proposal, but it never authorizes a mutation.

## Read the evidence

1. Snapshot the exact page immediately before review.
2. Read the audit contract's `responseField`, `rules`, `incompleteReasons`, and
   `safeFixes` from the same live contract. Do not use remembered labels.
3. Read the report from that response field. `complete: false` means the scan
   did not see the entire rendered composition; absence of a finding is not a
   pass.
4. A proposal is usable only when all of these are true:
   - its `label` is in live `safeFixes.labels`;
   - its operation type equals live `safeFixes.operationType`;
   - `finding.nodeId` equals `fix.operation.nodeId`;
   - `finding.documentId` is the document being edited;
   - every operation prop has exactly one matching `changes` entry whose path
     is `props.{prop}` and whose `after` value is identical.

Never invent an alternative text, label, color, ARIA value, or patch for a
finding that has no `fix`. Never convert a warning into a repair by judgment.
The `increase-text-contrast` proposal is valid only when the audit publishes it
for a solid, measurable foreground/background pair. Apply its exact returned
color; never substitute a remembered brand color or compute another shade.

## Human review is the write boundary

Show the user, before mutation:

- the rule, widget, node ID, and document ID;
- the stable fix label;
- every exact `path: before → after` entry, including empty and unset values;
- that applying it changes only a local/versioned draft, remains undoable, and
  is not an automatic save.

Require explicit approval for that exact proposal. Approval for one finding is
not approval for another node, document, or later refreshed audit. Never
auto-apply or auto-save an advertised fix.

## Validate and apply exactly once

After approval, write `operations.json` containing only the advertised
`fix.operation`. Run `patch-validate` as documented in
`partial-layout-operations.md`. Require the preflight to bind the fresh
`postModifiedGmt`, canonical `operationsSha256`, candidate layout,
`candidateLayoutSha256`, and compiled HTML hash.

Execute only the emitted `patch-save` action. Do not reconstruct its endpoint or
arguments, and do not retry `409` or `428`. A version conflict invalidates both
the approval evidence and preflight: snapshot again, show the refreshed diff,
and obtain a new approval.

## Verify the result

After `PATCH_SAVE_OK`, snapshot again. Confirm that:

- the canonical node carries the exact approved props;
- the previous finding no longer appears for that node;
- no unrelated operation was applied;
- the saved WordPress/PHP page still passes the relevant canonical checks.

If the finding belongs to a global template or loop template, open that exact
`documentId` as a separate authoring run. Never patch a supporting document
through the current page's identity or version token.
