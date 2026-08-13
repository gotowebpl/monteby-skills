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
  assert.match(skill, /layoutPersistence\.operations/);
  assert.match(skill, /references\/partial-layout-operations\.md/);
  assert.match(skill, /`patch-validate`/);
  assert.match(skill, /canonical operations\s+SHA-256/);
  assert.match(skill, /never retry `409` or `428`/);
  assert.match(skill, /fresh `expectedModifiedGmt`/);
  assert.match(skill, /A save returns `428` or `409`/);
  assert.match(skill, /send presentation\s+in the same versioned layout PUT/i);
  assert.match(skill, /live contract advertises presentation persistence/);
  assert.match(skill, /Never call the legacy page-settings route/);
  assert.match(skill, /never send Custom CSS\/JS through this API/);
  assert.match(skill, /Send `seo` only when the same live\s+layout resource advertises `layoutPersistence\.seo`/);
  assert.match(skill, /`full-width` for edge-to-edge page bands/);
  assert.match(skill, /`canvas` with `"disableGlobalTemplates": true`/);
});

test('site-authoring uses the live company profile instead of hardcoded identity data', () => {
  const skill = read(skillPath);

  assert.match(skill, /live response includes `companyProfile`/);
  assert.match(skill, /authoritative public identity/);
  assert.match(skill, /`dynamicFields\.fields` keys that\s+start with `company_`/);
  assert.match(skill, /Do not\s+copy those values into static widget props/);
  assert.match(skill, /Never infer missing identity data from screenshots/);
  assert.match(skill, /`company_phone_url`\s+or `company_email_url` binding is the canonical link target/);
  assert.match(skill, /do not construct a\s+`tel:` or `mailto:` value from display text/);
});

test('page-role guidance binds AI SEO writes to the live contract and canonical graph', () => {
  const skill = read(skillPath);
  const brief = read(path.join(references, 'brief-to-monteby.md'));
  const guidance = read(path.join(references, 'page-role-and-schema.md'));

  assert.match(skill, /references\/page-role-and-schema\.md/);
  assert.match(skill, /Never infer a role from a slug, write raw JSON-LD/);
  assert.match(brief, /`seo`, `seoOwnership` i `seoGraph`/);
  assert.match(brief, /nie\s+wyprowadzaj jej ze slugu ani długości treści/);
  assert.match(guidance, /`layoutPersistence\.seo\.owner` i jego `authorable`/);
  assert.match(guidance, /`blocked_seo_owner`/);
  assert.match(guidance, /Wyślij kompletny obiekt `seo` zgodny z\s+live `required`/);
  assert.match(guidance, /surowego JSON-LD ani własnego `@graph`/);
  assert.match(guidance, /Rola jest decyzją treściową, nie heurystyką URL/);
  assert.match(guidance, /Article, TechArticle i Service nie zastępują WebPage/);
  assert.match(guidance, /organizacja nie jest\s+osobą zastępczą/);
  assert.match(guidance, /FAQ musi pochodzić z widocznych pytań i odpowiedzi Buildera/);
  assert.match(guidance, /`role\.authored`, `role\.effective`, `role\.schemaType`, `role\.pageType`/);
  assert.match(guidance, /`yoast-adapter-projection`/);
  assert.match(guidance, /publiczną stronę renderowaną przez WordPress\/PHP\s+bez wykonywania JavaScriptu/);
  assert.match(guidance, /dokładnie jeden dokument\/graf standardowego JSON-LD/);
  assert.match(guidance, /Bez tej bramki wynik pozostaje `diagnostic_passed`/);
});

test('expert-content guidance binds authoring to evidence and the live widget contract', () => {
  const skill = read(skillPath);
  const brief = read(path.join(references, 'brief-to-monteby.md'));
  const guidance = read(path.join(references, 'expert-content-authoring.md'));

  assert.match(skill, /references\/expert-content-authoring\.md/);
  assert.match(skill, /never invent an author, reviewer, verification\s+date, source, profile, or factual answer/);
  assert.match(skill, /server-published expert directory/);
  assert.match(skill, /layoutPersistence\.contentQualityAudit/);
  assert.match(skill, /`passed`, `complete` and\s+`serverRendered` are all true/);
  assert.match(brief, /`QuickAnswer`, `PostInfo`, `AuthorBox` i `Sources`/);
  assert.match(brief, /tylko wtedy, gdy publikuje je\s+żywy kontrakt/);
  assert.match(guidance, /`GET \/wp-json\/monteby\/v1\/contract`/);
  assert.match(guidance, /właściwości, typy,\s+limity repeaterów, dozwoleni rodzice i kontrolki/);
  assert.match(guidance, /To `blocked_product_gap`/);
  assert.match(guidance, /`contract\.layoutPersistence\.editorial`/);
  assert.match(guidance, /GET \/wp-json\/monteby\/v1\/pages\/\{postId\}\/editorial/);
  assert.match(guidance, /`expectedContentSha256` z `verification\.currentContentSha256`/);
  assert.match(guidance, /Status `409` oznacza, że treść zmieniła się od odczytu/);
  assert.match(guidance, /`verification\.status` przechodzi na `stale`/);
  assert.match(guidance, /nie kopiuj wtedy\s+`verifiedAt`/);
  assert.match(guidance, /`contract\.layoutPersistence\.editorial\.automation`/);
  assert.match(guidance, /pierwsza pasująca reguła wygrywa/);
  assert.match(guidance, /Masowe przypisanie rozpocznij przez zasób `bulkPreview`/);
  assert.match(guidance, /pobierz następną od `nextOffset`/);
  assert.match(guidance, /Do `bulkApply` przekaż bez zmian `rulesRevision`, `previewToken`/);
  assert.match(guidance, /Nie buduj operacji samodzielnie/);
  assert.match(guidance, /bulk_assignment_never_confirms_review/);
  assert.match(guidance, /`contentQualityAudit`/);
  assert.match(guidance, /`roleRequirements`/);
  assert.match(guidance, /znalezienie nie jest patchem ani zgodą na automatyczną zmianę/);
  assert.match(guidance, /`complete: false` oznacza, że brak kolejnych znalezisk nie jest zaliczeniem/);
  assert.match(guidance, /`serverRendered: true`/);
  assert.match(guidance, /`missing_sources` nie pozwala dodać prawdopodobnego linku/);
  for (const widget of ['QuickAnswer', 'PostInfo', 'AuthorBox', 'Sources']) {
    assert.ok(guidance.includes('### `' + widget + '`'), `guidance documents ${widget}`);
  }
  assert.match(guidance, /Nie ustawiaj `verifiedDate` tylko dlatego, że agent zbudował lub zapisał stronę/);
  assert.match(guidance, /organizacja\s+nie jest osobą zastępczą/);
  assert.match(guidance, /pusty tekst alternatywny jest błędem\s+dostępności/);
  assert.match(guidance, /`primary: true` oznacza materiał pierwotny/);
  assert.match(guidance, /nie jest zgodą na zapisanie wadliwego URL/);
  assert.match(guidance, /`2026-02-30`/);
  assert.match(guidance, /dokładnie jedno właściwe H1/);
  assert.match(guidance, /pochodzenie danych autora\/recenzenta/);
});

test('query-loop guidance binds every public control to live host choices and one exact graph', () => {
  const skill = read(skillPath);
  const brief = read(path.join(references, 'brief-to-monteby.md'));
  const guidance = read(path.join(references, 'query-loop-authoring.md'));

  assert.match(skill, /references\/query-loop-authoring\.md/);
  assert.match(skill, /authoring\.relationshipRules\.queryControls/);
  assert.match(brief, /`QueryLoop`, `FilterBar`,\s+`SearchControl`, `SortControl` i `ActiveFilters`/);
  assert.match(guidance, /`GET \/wp-json\/monteby\/v1\/contract`/);
  assert.match(guidance, /`hostChoices\.queryLoop\.templates`, `emptyTemplates`, `postTypes`/);
  assert.match(guidance, /dokładnie jeden `QueryLoop` w całej node mapie/);
  assert.match(guidance, /Nie dołączaj publicznych kontrolek do pętli z `source="inherit"`/);
  assert.match(guidance, /`FilterBar\.postType` musi być zgodny z `QueryLoop\.postType`/);
  assert.match(guidance, /REST-visible, skalarne pola/);
  assert.match(guidance, /Publiczny adres przenosi wyłącznie identyfikator zapisanej opcji/);
  assert.match(guidance, /surowe `orderBy`, `order`,\s+`metaKey`/);
  assert.match(guidance, /Domyślnie traktuj warianty filtrowane jako `noindex`/);
  assert.match(guidance, /nie traktuj podzbioru jako zgody na indeksowanie\s+supersetu/);
  assert.match(guidance, /Tryb\s+`infinite`[\s\S]*serwerowy link progresywnego\s+fallbacku/);
  assert.match(guidance, /`patch-validate`, potem wyłącznie\s+emitowany `patch-save`/);
  assert.match(guidance, /z JavaScriptem i bez niego/);
});

test('partial operation guidance binds preflight evidence and forbids inferred API shapes', () => {
  const guidance = read(path.join(references, 'partial-layout-operations.md'));
  assert.match(guidance, /operationSchemas/);
  assert.match(guidance, /never remember or construct endpoints/);
  assert.match(guidance, /`unsetProps` only\s+when the live `update_props` schema exposes it/);
  assert.match(guidance, /postModifiedGmt/);
  assert.match(guidance, /operationsSha256/);
  assert.match(guidance, /candidateLayoutSha256/);
  assert.match(guidance, /Never automatically retry/);
});

test('accessibility fix guidance requires exact diff review and the canonical operation preflight', () => {
  const skill = read(skillPath);
  const partial = read(path.join(references, 'partial-layout-operations.md'));
  const guidance = read(path.join(references, 'accessibility-audit-fixes.md'));

  assert.match(skill, /references\/accessibility-audit-fixes\.md/);
  assert.match(skill, /show every advertised `changes` entry, obtain\s+explicit approval/);
  assert.match(skill, /Never invent a fix for a\s+finding, apply one to another `documentId`, auto-apply it, or auto-save it/);
  assert.match(partial, /audit's operation and exact diff are\s+immutable evidence/);
  assert.match(guidance, /`layoutPersistence\.accessibilityAudit`/);
  assert.match(guidance, /`complete: false`[\s\S]*absence of a finding is not a\s+pass/);
  assert.match(guidance, /`finding\.nodeId` equals `fix\.operation\.nodeId`/);
  assert.match(guidance, /`finding\.documentId` is the document being edited/);
  assert.match(guidance, /Never invent an alternative text, label, color, ARIA value, or patch/);
  assert.match(guidance, /Require explicit approval for that exact proposal/);
  assert.match(guidance, /containing only the advertised\s+`fix\.operation`/);
  assert.match(guidance, /Run `patch-validate`/);
  assert.match(guidance, /Execute only the emitted `patch-save` action/);
  assert.match(guidance, /A version conflict invalidates both\s+the approval evidence and preflight/);
  assert.match(guidance, /open that exact\s+`documentId` as a separate authoring run/);
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
