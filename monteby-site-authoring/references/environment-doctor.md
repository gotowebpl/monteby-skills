# Environment Doctor

Use this reference only when the freshly fetched live contract publishes
`contract.environmentDoctor`. The advertised resources, modes, groups and
safety flags are authoritative. Do not guess an endpoint from this document or
reuse a report from another site or release.

## Passive report first

Call the authenticated `resources.report` resource before an operational claim.
Require a versioned report with:

- `generatedAt`, `mode`, aggregate `status` and exact status counts;
- stable check IDs, closed groups and one status per check;
- bounded `evidence` containing no secret and no absolute filesystem path;
- safety flags that explicitly deny external requests, authored-content
  mutation and automatic fixes.

Bind any statement to that report's generation time and exact check ID.
A `warning` is not an error; `info` describes environment ownership or an
unavailable optional capability. Do not collapse all non-pass statuses into a
failed installation.

The integrity checks compare the running Builder version, exact Core revision
and critical runtime bytes with the generated release manifest. A mismatch can
mean a mixed or incomplete deployment, but the report does not identify who
changed a file and does not authorize overwriting it. Report the relative file
evidence only.

The request-budget check compares the live Builder limits with PHP request and
memory headroom. It does not discover every reverse-proxy limit. If the PHP
budget passes but a request still fails before WordPress, report the missing
proxy evidence instead of changing Builder limits.

The public-file scan is deliberately shallow and filename-based. A finding
means “review this potentially public location”; it is not proof that HTTP can
download the file and it does not authorize deletion.

## Active self-tests are explicit

Call `resources.run` only when the user explicitly requested operational
verification or a handoff workflow requires it. Before calling it, require the
contract to state:

```json
{
  "externalRequests": false,
  "userContentTouched": false,
  "temporaryDraftOnly": true,
  "automaticFixes": false
}
```

The active report may verify the authenticated Site Contract route, typed
JSON-LD encoding, secure form rendering, and a forced layout-save rollback. Its
only persistent-content exercise must be a newly created draft owned by that
request, with exact pre-state verification and unconditional deletion in a
`finally` path. It must not submit an external request, clear caches, edit an
existing post, alter settings, install an update, deploy files, or send a form.

If the active response does not repeat the safety flags with both
`temporaryDraftCreated: true` and `temporaryDraftDeleted: true`, or the
temporary-draft test cannot prove cleanup, return
`blocked_environment_doctor_safety`. Do not substitute a hand-written shell
smoke test on a live installation.

## Interpretation and next actions

Use one exact outcome:

- `environment_diagnostics_passed` — every required check passed; informational
  checks may remain;
- `environment_diagnostics_warning` — no error exists, but at least one bounded
  warning needs operator review;
- `blocked_environment_integrity` — version, Core reference, or critical file
  integrity is inconsistent;
- `blocked_environment_runtime` — a required PHP/WordPress/runtime capability
  failed;
- `blocked_environment_self_test` — an explicitly requested active test failed;
- `blocked_environment_doctor_safety` — the advertised or returned safety
  contract is incomplete.

Never repair from the report automatically. Present the exact failed check,
non-secret evidence, scope of a proposed remedy and rollback plan; obtain the
authority required by the base mode before taking any separate action. The
Doctor is a diagnostic boundary, not a deployment tool.
