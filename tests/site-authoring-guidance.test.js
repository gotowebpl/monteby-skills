#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const skillPath = path.join(root, 'monteby-site-authoring', 'SKILL.md');
const references = path.join(root, 'monteby-site-authoring', 'references');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('site-authoring skill is a compact one-mode router with fixed verdicts', () => {
  const skill = read(skillPath);
  const lines = skill.split('\n');
  const modes = [
    'live-page-edit',
    'owned-html-reconstruction',
    'external-reference-benchmark',
    'handoff',
    'custom-widget',
    'product-gap',
  ];

  assert.ok(lines.length < 500, `SKILL.md must stay below 500 lines, received ${lines.length}`);
  assert.match(skill, /Choose exactly one base mode/);
  assert.match(skill, /Do not combine modes in one run/);
  assert.match(skill, /Modes do not stack/);
  for (const mode of modes) {
    assert.match(skill, new RegExp(`\\| \\\`${mode}\\\` \\|`), `router lists ${mode}`);
  }

  assert.match(skill, /execute only the `nextAction`/);
  assert.match(skill, /references\/mechanical-workflow-protocol\.md/);
  assert.match(skill, /For `live-page-edit` and `owned-html-reconstruction`/);
  assert.match(skill, /read-only\s+contract bootstrap happens before the mutation state machine/);
  assert.match(skill, /other four modes[\s\S]*do not use the page-mutation state machine/);
  assert.match(skill, /`diagnostic_passed`: local\/static iteration passed; no canonical claim/);
  assert.match(skill, /`canonical_verified_1_to_1`/);
  assert.match(skill, /complete full-page comparison at 1440, 834, and 390 pixels/);
  assert.match(skill, /A script exit code, static preview[\s\S]*can yield only a diagnostic verdict/);
});

test('site-authoring hard stops protect secrets, source rights, legal copy, and product boundaries', () => {
  const skill = read(skillPath);

  assert.match(skill, /would contain a password, application password, cookie, nonce,\s+bearer value, or authorization header value/);
  assert.match(skill, /commands may name an environment\s+variable but never contain its value/);
  assert.match(skill, /Ownership or reuse rights[\s\S]*Reclassify the work as `external-reference-benchmark`/);
  assert.match(skill, /do\s+not use `--preserve-source-text`/);
  assert.match(skill, /Third-party HTML, classes, scripts, asset URLs,\s+brand identity, contact data, legal text/);
  assert.match(skill, /Return `blocked_product_gap`/);
  assert.match(skill, /Return `blocked_legal_copy` for that form/);
  assert.match(skill, /Never invent\s+legal wording, create a legal page, or expand the task's legal scope/);
  assert.match(skill, /Residual CSS is forbidden\s+by default/);
});

test('site-authoring keeps live contract, REST concurrency, and presentation canonical', () => {
  const skill = read(skillPath);

  assert.match(skill, /Read `references\/site-contract-compatibility\.json` before authoring/);
  assert.match(skill, /exact-live-contract compatibility policy/);
  assert.match(skill, /Always fetch `GET \/wp-json\/monteby\/v1\/contract` for the target site/);
  assert.match(skill, /Never use the compatibility policy[\s\S]*as a substitute for the live response/);
  assert.match(skill, /POST \/wp-json\/monteby\/v1\/validate/);
  assert.match(skill, /GET \/wp-json\/monteby\/v1\/pages\/\{id\}\/layout/);
  assert.match(skill, /PUT \/wp-json\/monteby\/v1\/pages\/\{id\}\/layout/);
  assert.match(skill, /POST \/wp-json\/monteby\/v1\/preview/);
  assert.match(skill, /fresh `expectedModifiedGmt`/);
  assert.match(skill, /A save returns `428` or `409`/);
  assert.match(skill, /send presentation\s+in the same versioned layout PUT/i);
  assert.match(skill, /live contract advertises presentation persistence/);
  assert.match(skill, /Never call the legacy page-settings route/);
  assert.match(skill, /never send Custom CSS\/JS\/SEO through this API/);
  assert.match(skill, /`full-width` for edge-to-edge page bands/);
  assert.match(skill, /`canvas` with `"disableGlobalTemplates": true`/);
});

test('owned HTML route uses the measured runner, deterministic plan, and canonical PHP gate', () => {
  const skill = read(skillPath);
  const protocol = read(path.join(references, 'mechanical-workflow-protocol.md'));

  assert.match(skill, /scripts\/run-visual-iteration\.js/);
  assert.match(skill, /generic measured path in\s+`scripts\/draft-monteby-layout\.js`/);
  assert.match(skill, /mechanical plan written with\s+`--plan-out`/);
  assert.match(skill, /`allSurfacesMapped`/);
  assert.match(skill, /plan\/layout\/contract\/manifest SHA-256 bindings/);
  assert.match(skill, /scripts\/apply-layout-repair-queue\.js/);
  assert.match(skill, /never translate the\s+queue into a manual edit/);
  assert.match(skill, /runner invokes the generic measured path/);
  assert.match(skill, /[Dd]o\s+not rerun the drafter after a passing runner/);
  assert.match(skill, /Do not replace this path with a browser snippet, a hand-written `build\.mjs`/);
  assert.match(skill, /runner's `diagnostic_passed` remains non-canonical/);
  assert.match(skill, /saved canonical WordPress\/PHP page/);
  assert.match(skill, /Never select these while a page-reproduction report chain is active/);
  assert.match(protocol, /at\s+most 64 normal-flow bands, 24 meaningful media surfaces per band, 256 text\s+surfaces per band, and 3200 CSS pixels per band/);
  assert.match(protocol, /never samples or truncates the reference/);
  assert.match(protocol, /both contract files, and both manifests/);
  assert.match(protocol, /zero mismatched pixels, zero aggregate percent/);
  assert.doesNotMatch(skill, /extract-reference-spec|spec-to-layout/);
});

test('custom-widget example renders and escapes every exposed image prop', () => {
  const guidance = read(path.join(references, 'custom-widget-registration.md'));

  assert.match(guidance, /'image' => ''/);
  assert.match(guidance, /'imageAlt' => ''/);
  assert.match(guidance, /\$imageMarkup = sprintf/);
  assert.match(guidance, /esc_url\(\$image\)/);
  assert.match(guidance, /esc_attr\(\$imageAlt\)/);
  assert.match(guidance, /<section class="theme-client-hero">%s<h1>/);
  assert.match(guidance, /Do not expose an editable prop that the render callback ignores/);
});

test('residual CSS is opt-in site-specific debt and never completion evidence', () => {
  const skill = read(skillPath);
  const residuals = read(path.join(references, 'child-theme-residual-styles.md'));
  const combined = `${skill}\n${residuals}`;

  assert.match(residuals, /Residual CSS is forbidden by default/);
  assert.match(residuals, /explicitly authorizes one\s+named, genuinely site-specific behavior/);
  assert.match(residuals, /If removing the residual makes the candidate fail the claimed match, the 1:1\s+verdict is unavailable/);
  assert.match(residuals, /blocked_residual_not_authorized/);
  assert.match(residuals, /scripts\/audit-reference-css\.mjs[\s\S]*does not grant authorization/);
  assert.match(residuals, /scripts\/emit-child-theme-css\.mjs/);
  assert.match(residuals, /Regenerate after every layout save/);
  assert.match(residuals, /rollback/);
  assert.doesNotMatch(combined, /residual CSS.*(?:required|prerequisite).*(?:completion|1:1)/i);
});

test('HTML and form guidance preserves contract detail without invented legal copy', () => {
  const html = read(path.join(references, 'html-to-monteby.md'));

  assert.match(html, /Decimal font weights and safe negative tracking/);
  assert.match(html, /weight\s+`437\.5` and tracking\s+`-0\.045em`/);
  assert.match(html, /`minWidth: "0px"`/);
  assert.match(html, /generic measured source/);
  assert.match(html, /`completion\.allBandsMapped: true`/);
  assert.match(html, /`completion\.truncated: false`/);
  assert.match(html, /A reset or\s+`type="button"` is not submit evidence/);
  assert.match(html, /Consent\/legal copy may be authored only when the user\/project supplied or approved/);
  assert.match(html, /Do not invent:[\s\S]*a controller or processing purpose/);
  assert.match(html, /A `428` means\s+the precondition is absent/);
  assert.match(html, /A `409` means another editor\s+changed\s+the page/);
});

test('widget-development guidance treats editor usability as a release contract', () => {
  const guidance = read(path.join(root, 'monteby-widget-development', 'SKILL.md'));

  assert.match(guidance, /Treat editor usability as part of the widget contract/);
  assert.match(guidance, /Repeaters must expose and enforce `minItems`\/`maxItems`/);
  assert.match(guidance, /preserve the active\/default item after add, move, or remove/);
  assert.match(guidance, /keep canvas state synchronized with the inspector/);
  assert.match(guidance, /support keyboard and focus behavior/);
  assert.match(guidance, /verify desktop\/tablet\/mobile preview behavior against the PHP\/compiled frontend/);
});

test('production-site benchmark guidance preserves site structure, SEO ownership, and release assets', () => {
  const guidance = read(path.join(references, 'production-site-benchmark.md'));
  const widgetGuidance = read(
    path.join(root, 'monteby-widget-development', 'references', 'widget-development-playbook.md'),
  );

  assert.match(guidance, /global header, and global footer as separate Monteby resources/);
  assert.match(guidance, /`WPMenu` must select a real host-provided WordPress menu/);
  assert.match(guidance, /generic four-side margin and padding have one owner: Advanced/);
  assert.match(guidance, /WordPress media modal as one collection/);
  assert.match(guidance, /Masonry passes only when variable image heights visibly affect both editor and frontend layout/);
  assert.match(guidance, /Yoast solely owns title, canonical, meta description, Open Graph, Twitter cards/);
  assert.match(guidance, /`dist\/settings\.js` and `dist\/settings\.css`/);
  assert.match(guidance, /Never copy Envato\/ThemeForest source, assets, demo content, classes, or scripts/);
  assert.doesNotMatch(guidance, /localhost|Społem|spolem/i);
  assert.match(widgetGuidance, /A color with zero widths renders no border/);
  assert.match(widgetGuidance, /unrelated Box\/Hover groups must not open/);
  assert.match(widgetGuidance, /fail on asset `404` or console errors/);
});

test('client-site handoff guidance keeps Codex and Claude instructions equivalent and secrets isolated', () => {
  const skill = read(skillPath);
  const handoff = read(path.join(references, 'client-site-handoff.md'));

  assert.match(skill, /references\/client-site-handoff\.md/);
  assert.match(skill, /`AGENTS\.md` and `CLAUDE\.md` semantically equivalent/);
  assert.match(handoff, /@AGENTS\.md/);
  assert.match(handoff, /one canonical body/);
  assert.match(handoff, /Run the project's actual Compose discovery and status commands/);
  assert.match(handoff, /`docker compose config --services`/);
  assert.match(handoff, /named volumes and bind mounts/);
  assert.match(handoff, /Never run or recommend `docker compose down -v`/);
  assert.match(handoff, /read-only WP-CLI/);
  assert.match(handoff, /If a project directory is not a Git repository, say so explicitly/);
  assert.match(handoff, /Do not assume an existing ignore file protects operational artifacts/);
  assert.match(handoff, /historical authoring directories as untrusted until audited and redacted/);
  assert.match(handoff, /deployment directory or package: immutable release snapshot/);
  assert.match(handoff, /Do not record administrator passwords, application passwords, cookies, nonces/);
  assert.match(handoff, /child theme as a hidden patch layer/);
  assert.match(handoff, /## Handoff Report/);
  assert.match(handoff, /origin, branch, commit SHA, upstream relation, and dirty state/);
  assert.match(handoff, /backup status, rollback procedure/);
  assert.match(handoff, /`CLAUDE\.md` resolves to the same contract as `AGENTS\.md`/);
  assert.doesNotMatch(handoff, /Społem|spolem|8194|8195|strona-projektowa/i);
});
