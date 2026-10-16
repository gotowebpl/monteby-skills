# Papier and Orbit: bounded visual refinement proposal

Read-only review, 2026-10-16. Inputs: each original `20261015` brief and handoff, Builder `docs/PREMIUM-AUTHORING-RESULTS-20261015.md`, and all eight `papier-polish-*` / `orbit-polish-*` public screenshots. These captures show temporarily applied profiles, not a guarantee of the current live appearance after global restoration. No new page measurements or interactions were run.

The comparison is against the approved brief, not a reference screenshot. Preserve **every public text byte, existing approved asset, link label and destination**. Do not add case studies, testimonials, statistics, app UI, author portraits, legal text or stock photographs. These are recommendations to validate against a fresh contract and snapshot, not prepared mutation operations.

## Papier Studio

What already works: the serif hierarchy, readable mobile line lengths, compact service rows and complete prose fit an editorial studio. The large title feels appropriate; the page does not need a photograph merely to occupy the right side.

**Concrete direction for this fictional QA iteration:** a warm paper-and-ink spread. Retain the published `editorial-serif` family system: Playfair Display for display headings and Source Serif 4 for reading. Keep `typographyPreset` and change only intentional local scale: start the H1 trial at 80/60/42 px for desktop/tablet/mobile, with a desktop measure near 900 px and natural wrapping; body 18/18/17 px. These are proposed authored values to validate and visually test, not measured facts or replacements for the remaining preset fields. Use the profile's text/primary ink (`#111827` / `#1f2937`) through their actual live references. Limit the existing amber accent (`#b45309`) to an action/detail, not every heading. The current profile has no paper-surface token: explicitly approved local surface candidates are `#f6f1e7` for the main paper, `#eee7d9` for a quiet inset/footer, and `#cfc5b5` for non-text hairlines. Prefer a matching published surface reference if the fresh contract offers one; do not fabricate a token name. No gradients, textures, repeated shadows or ornamental icons. The aim is stronger type and warmer material, not merely a beige recoloring of the old structure.

1. **Give the process a different job and silhouette from the service list.** At 1440 the service and process bands both present three horizontally ruled label/description rows. Keep the service rows. For the process, test a desktop split with its existing heading/introduction as a narrower left column and the complete ordered process on the right. Keep a normal single reading flow at 834/390/375. No new step numbers or text are necessary; the order already exists. Use existing grid, gap and alignment controls only; no sticky or animation is needed.
2. **Make the end an editorial note, not a second landing-page climax.** The centered dark contact band gives a modest invitation the weight of a sales close. Test the existing contact heading, full paragraph and link in a light, left-aligned, compact ending. Keep enough separation from the process and footer; do not merge away their content. Use a published site surface/text pair and verify contrast. This should make Papier visually different from Orbit without replacing its font family or copy.
3. **Tune the opening-to-services interval only after those changes.** At 1440 the CTA-to-next-heading gap is substantially larger than intervals within either list; at mobile the gap is less problematic. Reduce desktop band padding if public measurements confirm that the two sections' padding adds up unnecessarily. Preserve the current H1 line behavior and mobile breathing room. Do not set a fixed hero height or force line breaks to imitate a poster.

Expected benefit: clearer distinction between what the studio does and how work proceeds. This is art direction, not proof that the result will be premium. A fresh full-page review may reject the proposed split if the process column becomes cramped.

## Orbit Desk

What already works: the opening message is prominent, the asymmetric desktop possibilities section has a useful hierarchy, and the mobile reading order is direct. A text-only fictional concept does not justify a fabricated working-product screenshot.

**Concrete direction for this fictional QA iteration:** a sharp, violet-led reading demonstration. Retain `modern-grotesk`: Space Grotesk headings and DM Sans prose, with live preset/font references. Start the H1 trial at 84/60/40 px and retain a constrained natural measure rather than making its line occupy the whole desktop; body/lead sizes remain independently controlled. Use the published accent `#6d28d9` as the only chromatic action signal, with published text `#09090b` and primary `#18181b`. White is the dominant surface; `#f6f3ff` is an explicitly approved local pale-violet surface only if no equivalent is published. The demonstration should carry the strongest violet/ink emphasis, while the closing recedes. An initial slide-title trial of 32 px and subtitle 18 px can be tested in the existing controls; responsive variants are permitted only when the new live contract actually publishes them. Keep text contrast and all slide lengths readable. Use the accent reference for the active dot on a light/neutral surface; if the panel is violet, use an approved contrasting light active indicator instead of making violet-on-violet invisible. No second blue accent, fake app chrome, invented task data or decorative moving shapes.

1. **Make the manual demonstration proportionate to its actual content.** At 1440 a short title and sentence sit in a very wide dark panel; at 390/375 the same sentence is squeezed between the arrows while much of the panel remains empty. Keep all three slides, order, text, manual controls and no-autoplay behavior. Test a more compact panel with stronger title hierarchy and responsive inner spacing; provide enough side clearance for real arrow hit areas. This depends on the freshly published SliderBlock controls, including the current spacing/radius/color surface. Do not invent nested slide widgets, a fake task UI or responsive props absent from the live contract. Check every slide, not just the first capture.
2. **Let that demonstration be the main contrast event.** The next centered black closing band competes with the dark slider. Test the full existing closing copy and `Wróć do pokazu` link as a light, shorter, left-aligned follow-through, with a readable text measure. It must not become a new registration or sales CTA. Preserve `#dalej`, `#pokaz` and the footer.
3. **Resolve accent consistency and excess desktop separation.** Purple feature icons and the blue active slider dot read as two unrelated interaction accents in the captures. Bind both to the appropriate single approved live action/accent reference where supported; verify inactive/active dots and focus contrast. Separately reduce the large desktop gap after the hero CTA if the fresh snapshot confirms redundant section spacing. Keep the existing asymmetric features arrangement and the comfortable mobile paragraph width.

Expected benefit: a deliberate interactive reading surface instead of a slideshow-shaped placeholder. Responsive padding and dot controls can remove constraints; they do not by themselves supply content design or justify a premium claim.

## Boundaries and acceptance

- Reuse existing Section/Container/Heading/Text/ButtonBlock/Navbar/SliderBlock owners and live controls. No new helper, renderer, CSS class, raw CSS/JS or Theme change is proposed.
- Start from each canonical current layout and its authoritative digest; inspect the latest contract. The Oct 15 SliderBlock limitations are historical until rechecked, not a reason to bypass validation.
- Compare the exact approved copy/link inventory before and after. Keep semantic tags and remaining global typography bindings when changing local sizes or layout.
- Confirm 1440/834/390/375 reading order, actual fonts, all slide states, arrow/text separation, keyboard focus, reduced motion and no-JS before closing Orbit. Screenshot-only review cannot establish these behaviors.
- Keep the old evidence and record new sources/hashes separately. Restoring global styles must not rewrite page JSON.

## Reviewed image identities

Paths relative to Builder `output/playwright/premium-authoring-20261015/`:

| File | SHA-256 |
| --- | --- |
| papier-polish-1440.png | `69ee1784c508eba1a9b45d61e5ddf2daddcfd3bd3b7e02dfad9e147767500564` |
| papier-polish-834.png | `cdf3171f4a6dd8e7302be7c0c16778d49ae2a5af6ff0889444def6a0e40656ae` |
| papier-polish-390.png | `3a119366aac1fc580a9627e94b06922c8ea3ba2c921718eae907e9e68260c990` |
| papier-polish-375.png | `285ba1a93889d66cbc1adbceb187278a55acc5795e2f9b8d970cd16111186585` |
| orbit-polish-1440.png | `65de9d9a097d82eaa1810186ec1b02dcaa8f8fedfe659b51b1d1a07579fb08da` |
| orbit-polish-834.png | `dfc1e4d3c81721e2e4932b49a7e943538cc8ec6d3e8455982e52aab941cbc0d0` |
| orbit-polish-390.png | `961c70f60437770bbcc467622624ce3130c14d82e00c1f925e6d5d8b07aca56c` |
| orbit-polish-375.png | `c1a5b646752361fff097029f3f827c8dfe238434b19cfd6e3a51753083a92817` |

## Subsequent Papier diagnostic, not final-package acceptance

The integrator then supplied two new public diagnostic PNGs from the old installed ZIP. All observations below concern those images only, not a fresh browser execution by this reviewer. The chosen implementation differs from the earlier palette/size proposals above: the integrator reports ink `#243d32`, secondary `#605d51`, accent `#536b43`, local paper `#f5f1e8`, process surface `#e9e9df`, and H1 80/60/44 px. The earlier proposals are retained as proposal history, not represented as applied values.

- The stronger two-line desktop opening, warm paper/green ink and separate desktop process structure create a more recognizable editorial identity. The light ending now feels like a continuation of the text, not a sales banner. The 390 px reading order and visible copy remain comfortable in the supplied image.
- The desktop gap from the hero action to “Zakres pracy” still looks around 200 px in the screenshot. That is a visual estimate, not a DOM measurement. Inspect the contributing section paddings and reduce that one interval if confirmed; do not impose a fixed hero height.
- Service descriptions now span a long desktop reading measure; the first “Redakcja” line approaches roughly 100 characters. Test a right-column text measure around 600–680 px instead of reducing the body font or rewriting text. Leave the responsive single-column reading flow intact.
- No further photograph, texture, icon or animated decoration is necessary to address these two issues.

Files relative to Builder root:

| File | SHA-256 |
| --- | --- |
| output/premium-authoring-20261016/papier-studio/diagnostic-1440.png | `9870430f4279340aacb3400616f902605bdfba2cec0904dd7d073e31e4b3744b` |
| output/premium-authoring-20261016/papier-studio/diagnostic-390.png | `58bc8bce2ba519246dfb414e84eec9ca323e85561749bd90a73a67f04fb5bd1c` |

This is encouraging visual progress, not a final premium verdict. The new 834/375 captures, final ZIP, actual font/contrast data and menu/keyboard states were not reviewed at this diagnostic stage. The raw fictional briefs remain unchanged.
