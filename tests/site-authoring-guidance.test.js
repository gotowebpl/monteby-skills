#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('site-authoring guidance keeps decimal weights and safe negative tracking contract-backed', () => {
  const guidance = [
    path.join(root, 'README.md'),
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    path.join(root, 'monteby-site-authoring', 'references', 'visual-benchmark-loop.md'),
  ].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.match(guidance, /437\.5/);
  assert.match(guidance, /-0\.045em/);
  assert.match(guidance, /minWidth: "0px"/);
  assert.match(guidance, /generic_responsive_divider_control_gap/);
  assert.match(guidance, /live `FormBlock\.fields` repeater type options/);
  assert.match(guidance, /type="button"/);
  assert.match(guidance, /source URL is `file:\/\/`/);
  assert.match(guidance, /Viewport-only captures remain diagnostics/);
  assert.match(guidance, /outer surface is visually neutral/);
  assert.match(guidance, /explicit `\/ none` must never become an opaque color/);
  assert.match(guidance, /hsl\(\).*hsla\(\).*renderers support/is);
  assert.match(guidance, /expectedModifiedGmt/);
  assert.match(guidance, /A `428` response means the write precondition is missing/);
  assert.match(guidance, /A `409` response means another editor changed the page/);
  assert.doesNotMatch(guidance, /keep Monteby authoring on non-negative tracking/i);
  assert.doesNotMatch(guidance, /disallowed negative tracking/i);
  assert.doesNotMatch(guidance, /do not use negative tracking/i);
});

test('site-authoring guidance uses the live TabsBlock interaction contract', () => {
  const guidance = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    'utf8',
  );

  assert.match(guidance, /use one contract-listed `TabsBlock`/);
  assert.match(guidance, /`minItems`\/`maxItems`/);
  assert.match(guidance, /`defaultActiveTab` as a zero-based index/);
  assert.match(guidance, /`tabFontFamily`\/`tabLineHeight`/);
  assert.match(guidance, /`mobileTabLayout: "scroll"`, `"wrap"`, or `"stack"`/);
  assert.match(guidance, /Verify every active state with keyboard navigation/);
  assert.match(guidance, /record a Builder\/Core control gap/);
  assert.match(guidance, /`tabbed-program`/);
  assert.match(guidance, /Default and current Preview are distinct states/);
  assert.match(guidance, /custom 390px canvas must match the published mobile layout/);
  assert.match(guidance, /Every repeated field needs a programmatic label/);
});

test('site-authoring guidance preserves responsive composition and editor inheritance', () => {
  const guidance = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    'utf8',
  );

  assert.match(guidance, /hero -> about -> stats -> services -> result -> why -> work -> pricing -> testimonials -> partners -> footer/);
  assert.match(guidance, /asymmetric three-service rhythm/);
  assert.match(guidance, /responsive `1-2-1` testimonial mosaic/);
  assert.match(guidance, /switch the canvas to the intended breakpoint/);
  assert.match(guidance, /`mobile -> tablet -> desktop` cascade/);
  assert.match(guidance, /Do not populate all three breakpoint props/);
  assert.match(guidance, /Ordinary `Heading` owns natural wrapping/);
  assert.match(guidance, /Use `MultilineHeading` only for deliberate semantic line breaks with staggered starts/);
  assert.match(guidance, /live `lines` repeater `itemControls` expose every nested line prop needed at each breakpoint/);
  assert.match(guidance, /Never invent nested keys/);
  assert.equal((guidance.match(/Ordinary `Heading` owns natural wrapping/g) || []).length, 1);
});

test('site-authoring guidance keeps page presentation inside the versioned Monteby layout API', () => {
  const guidance = [
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    path.join(root, 'monteby-site-authoring', 'references', 'visual-benchmark-loop.md'),
  ].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.match(guidance, /`layoutPersistence\.presentation`/);
  assert.match(guidance, /"presentation": \{ "layout": "canvas", "disableGlobalTemplates": true \}/);
  assert.match(guidance, /same versioned (?:layout )?PUT/);
  assert.match(guidance, /never call the legacy page-settings route/i);
  assert.match(guidance, /never send Custom CSS\/JS\/SEO through this API/i);
  assert.doesNotMatch(guidance, /official Builder page-settings endpoint/);
  assert.doesNotMatch(guidance, /disable_global_templates: true/);
});

test('site-authoring guidance prefers the live proportional grid and measured text margins', () => {
  const guidance = [
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    path.join(root, 'monteby-site-authoring', 'references', 'visual-benchmark-loop.md'),
  ].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.match(guidance, /Columns `Two proportional`/);
  assert.match(guidance, /`gridTemplateColumns: "two-proportional"`/);
  assert.match(guidance, /`gridFirstColumnPercent\*`/);
  assert.match(guidance, /`Math\.round`.*integer range `10\.\.90`/s);
  assert.match(guidance, /six-track.*must never survive.*implicit tracks/s);
  assert.match(guidance, /backward-compatible fallback.*older contract/);
  assert.match(guidance, /literal token `grid-template-columns: two-proportional` is invalid evidence/);
  assert.match(guidance, /live `Container\.overflow` control/);
  assert.match(guidance, /measure.*parent gap independently.*never translate text margins into wrapper padding/s);
  assert.doesNotMatch(guidance, /fractional tracks[\s\S]{0,200}prefer `layoutDisplay: "flex"`/i);
});

test('site-authoring guidance bounds visual evidence and preserves Layers focus ownership', () => {
  const skill = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'SKILL.md'),
    'utf8',
  );
  const visualLoop = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'references', 'visual-benchmark-loop.md'),
    'utf8',
  );

  assert.match(skill, /manually collapsing that selected path must persist/);
  assert.match(skill, /only when the tree owned focus/);
  assert.match(skill, /must never lose focus to Layers/);
  assert.match(visualLoop, /empty, absolutely positioned, symmetric inset surface/);
  assert.match(visualLoop, /discard selectors, generated-content metadata, asymmetric insets, and arbitrary CSS/);
  assert.match(visualLoop, /pure two-dimensional rotation/);
  assert.match(visualLoop, /untransformed layout dimensions instead of the rotated bounding box/);
  assert.match(visualLoop, /reject scale, skew, translation, perspective, or arbitrary angles/);
  assert.match(visualLoop, /only permitted negative-margin case/);
  assert.match(visualLoop, /marginTop \+ surfaceHeight \+ marginBottom = parent content-row height/);
  assert.match(visualLoop, /Do not use negative margins for an ordinary stacked gap/);
  assert.match(visualLoop, /`paintLayer: "foreground"`/);
});

test('widget-development guidance treats editor usability as a release contract', () => {
  const guidance = fs.readFileSync(
    path.join(root, 'monteby-widget-development', 'SKILL.md'),
    'utf8',
  );

  assert.match(guidance, /Treat editor usability as part of the widget contract/);
  assert.match(guidance, /Repeaters must expose and enforce `minItems`\/`maxItems`/);
  assert.match(guidance, /preserve the active\/default item after add, move, or remove/);
  assert.match(guidance, /keep canvas state synchronized with the inspector/);
  assert.match(guidance, /support keyboard and focus behavior/);
  assert.match(guidance, /verify desktop\/tablet\/mobile preview behavior against the PHP\/compiled frontend/);
});

test('production-site benchmark guidance preserves site structure, SEO ownership, and release assets', () => {
  const guidance = fs.readFileSync(
    path.join(root, 'monteby-site-authoring', 'references', 'production-site-benchmark.md'),
    'utf8',
  );
  const widgetGuidance = fs.readFileSync(
    path.join(root, 'monteby-widget-development', 'references', 'widget-development-playbook.md'),
    'utf8',
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
