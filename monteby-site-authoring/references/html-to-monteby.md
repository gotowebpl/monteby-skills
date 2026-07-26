# HTML/CSS → Monteby: mapowanie, pułapki, obejścia

Read this before converting a measured HTML/CSS reference into a Monteby node map.
It exists so the conversion is a lookup, not a series of failed validations and
screenshot surprises. Everything here was learned from real conversions; verify
each claim against the live contract, which stays authoritative.

## 1. Build the node map with a contract-aware generator

Do not hand-write JSON. Write a small generator (Python/Node) that, for every node:

1. rejects a component missing from `components`;
2. rejects a prop missing from that component's `props`;
3. rejects a prop listed in `authoring.blockedProps`;
4. rejects a child whose `allowedParents` does not list the parent;
5. **normalizes every value against its control** before emitting.

Step 5 is what removes most round trips. `POST /validate` rejects one violation at
a time across hundreds of nodes; a local normalizer fixes the whole class at once.
`scripts/normalize-layout.js` does this — run it before every `/validate` call.

Emit the generator's own diagnostics too: a value the normalizer had to drop is a
place where the reference cannot be reproduced, and it belongs in the gap report.

## 2. Control-value rules that silently reject authored values

Read `controls[].type`, `step`, `min`, `max`, `options`, and `units` — never assume
a CSS value passes through.

| Control shape | Rule | Typical trap |
|---|---|---|
| `css-value` with `step: 1` | integers only | `14.8px` → `15px`; a 0.2px drift per line becomes tens of px per column |
| `css-value` with `step: 0.1` | one decimal | `line-height: 1.65` → `1.6`; compounds over long body copy |
| `css-value` with `step: 0.001` | three decimals | letter spacing is usually safe |
| `number` with `min`/`max` | clamped integer, **not a string** | `flexGrow: "1"` fails as "must be a finite number"; send `1` |
| `select` / `segment` | value must be in `options` | `textTransform: "none"` is invalid where options are `['', 'uppercase', …]`; use `""` |
| Tailwind-token controls | value is a token, not CSS | `FormBlock.inputBorderWidth: "border"`, `labelFontWeight: "font-normal"`, `labelLetterSpacing: "tracking-widest"` |
| `aspectRatio` | small fixed enum | arbitrary ratios are dropped; use `height` + `heightTablet`/`heightMobile` instead |
| `gap` | **single value only** | `gap: "26px 44px"` is discarded entirely and the element renders `gap: normal` |

Same-named props can differ per widget: `StatsGrid.labelFontWeight` takes `"400"`
while `FormBlock.labelFontWeight` takes `"font-normal"`. Always resolve the control
for that component, never by prop name alone.

## 3. Renderer behavior that passes validation and still looks wrong

These cost the most time because `/validate` returns clean and the defect is only
visible in the rendered page.

**Headings and paragraphs inherit a top margin.** The renderer emits `margin-top`
only when authored. Theme resets apply `1em`, so an 80px heading silently gains an
80px top margin. Author `marginTop: "0px"` on every `Heading`, `Text`, and
`MultilineHeading` unless the reference measures a real gap.

**A single border edge paints all four.** Authoring only `borderTopWidth` yields
`border-style: solid` with the browser default `medium` on the other edges — a full
box instead of a rule. Always pair an edge width with `borderWidth: "0px"`.

**`backgroundType: "image"` drops the background colour.** The color prop is not
emitted alongside the image, so a dark section renders white behind a transparent
texture. Either bake the colour into the bitmap or use `gradient` and move the
texture elsewhere.

**Background layers are exclusive, except the accent.** `backgroundAccentType:
"radial"` composes *on top of* the gradient in one declaration, so a
`radial + linear` reference maps cleanly onto `backgroundType: "gradient"` plus the
accent props. A third layer (grid, noise, mask) has no home in the contract.

**List props take strings, repeater props take objects.** `ListBlock.items` is a
list of strings (or one newline-separated string) with no per-item link. Passing
`{text, href}` still renders server-side but throws React error #31 in the editor
and isolates the widget: correct frontend, uneditable page. Widgets whose control
exposes `itemControls` (`StatsGrid`, `IconList`, `TickerBlock`, `FormBlock.fields`)
take objects with exactly those keys. For clickable lists compose `ButtonBlock` or
a host `WPMenu`.

**`FormBlock` paints its own `<form>` background.** Clearing `formBackgroundColor`
does not inherit the parent — it falls back to the plugin's white. Set it explicitly
even when a wrapper `Container` already carries the surface.

**Images without a height collapse to 0 before load.** There is no `height: auto`;
lazy-loaded media has no intrinsic ratio until it arrives, so the layout jumps. Author
`height` plus `heightTablet`/`heightMobile` from the measured reference.

## 4. Structural mappings that are not obvious

| Reference CSS | Monteby composition |
|---|---|
| `grid-template-columns: 1.15fr 0.85fr` | `gridTemplateColumns: "two-proportional"` + `gridFirstColumnPercent` (rounded 10–90) |
| `grid-template-columns: 1.3fr 1fr 1fr 1fr` | nested: outer `two-proportional` + inner `three` — the contract has no proportional four-track |
| five equal columns | flex row with `flexBasis: "20%"`, `flexGrow: 1`, `minWidth: "0px"` — grid tokens stop at `four`/`six` |
| a narrow marker column (`34px 1fr`) | flex row with a fixed-width child and `flexShrink: 0`, **not** `sidebar-left-280` |
| `margin-top: auto` pinning a footer link | wrap the body copy in a `Container` with `flexGrow: 1` |
| full-bleed band inside a constrained page | `Section` + `presentation.layout: "full-width"`, with the content column on `innerMaxWidth` + `innerPaddingX*` |
| repeating stripe / hazard tape | small seamless bitmap as `backgroundImage` with `backgroundRepeat: "repeat-x"`, `minHeight`, and `overflow: "hidden"` |
| section heading + lead in two columns | `Container` grid `two` with the heading column wrapped for measured line breaks |

## 5. Reproduce line breaking, not just font size

Wrapping drives section height more than any spacing prop. Compare the ordered
`lines[]` evidence, or simply the rendered line count per heading, between reference
and candidate before touching sizes.

The most common cause of a mismatch is a **variable-font axis the contract does not
expose**. A reference using `font-variation-settings: 'wdth' 112` renders materially
wider than the same family loaded with only a weight axis, so identical copy wraps
onto fewer lines and every section comes out short. Diagnose it by comparing line
counts at identical column widths. Fixing the axis (see §6) usually collapses many
per-section deltas at once — do it before hand-tuning `maxWidth` per heading, and
remove any compensating widths afterwards.

## 6. What the contract cannot express, and where it belongs

Classify every miss; do not reach for CSS by reflex.

**Belongs in `monteby-widget-development` (add a typed control):** finer `step` on
typography controls, missing responsive variants, a control the reference needs on
many sites. This is the default for anything reusable.

**Belongs in the project child theme** (only with the site owner's explicit decision,
and only for site-specific presentation): `:hover` and other interaction states —
`authoring.blockedProps` blocks `hoverBg`, `hoverColor`, `hoverShadow` by design;
`position: sticky` on a global header; a second background layer such as a grid
overlay; variable-font axes (both the `@font-face` request and
`font-variation-settings`); resets of plugin defaults with no zero token, like input
`border-radius`.

When you do write child-theme CSS, **generate it rather than hand-copying class
names**. Rendered classes are hashes of the node's props and change whenever the
props change, so a hand-written selector silently stops matching. Read the rendered
page, locate nodes by their heading text or structural position, and emit the
stylesheet from that mapping; re-run the generator after every layout save. Keep the
file limited to what the contract genuinely cannot express, and record each rule as
a contract gap in the final report.

**Never acceptable:** `className`, `cssId`, raw HTML, Tailwind strings in authored
JSON, or pasting reference markup into the builder.

## 7. Verify by measurement, then by eye

Screenshots alone hide drift. Measure both pages in one browser at identical widths
and compare per section (`scripts/compare-geometry.js`):

- section heights, in order — a section-by-section delta table localizes the fault;
- total page height — treat below ~95% of the reference depth as incomplete;
- rendered line count per heading — the fastest signal for a typography mismatch;
- `document.scrollWidth` vs `innerWidth` at 390 / 768 / 1024 / 1440 — a horizontal
  overflow of a few pixels is usually one unwrapped header element, not the grid;
- computed `background-color` and `background-image` per section — catches the
  dropped-colour and single-border traps above.

Headless screenshots taken by resizing a window can render a desktop layout inside a
narrow viewport and fake an overflow. When a screenshot and a live measurement
disagree, trust the measurement.
