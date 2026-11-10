# Global header: sticky and scroll behavior

Use this reference when the user requests a sticky/przyklejony nagłówek, a
header that reappears while scrolling up, or a header that shrinks on scroll.
These are **template settings**, separate from the header's node-map props.
In the editor, open the header template, then **Style → Template settings →
Header Behavior** (Polish: **Styl → Ustawienia szablonu → Zachowanie nagłówka**).

## Discover the existing control before declaring a gap

Fetch the **full live contract**, not only a component or summary projection.
Resolve the active header from `globalTemplates.header.activePostId` and read
`globalTemplates.header.settingsResource` from that same response. Its `postId`
must match the active header; an ID of `0` means no active document, not
permission to create or replace one. Creating or selecting a header requires
the corresponding explicit task and its separate resource.

Use the descriptor's `readMethod`, `writeMethod`, `path`, `versionField`,
`writePreconditionField`, `fields`, and `headerBehavior`. Current examples are
`GET`/`POST`, `/gotoweb-craft/v1/template-settings/{postId}`, `revision` and
`expectedRevision`; these are discovery examples, not guessed routes or fixed
client flags. Substitute only the descriptor's scoped `{postId}`. An absent or
malformed descriptor needs the actual version/capability diagnosis from
`SKILL.md`; it is not evidence that the whole product lacks sticky headers.

Select only a behavior actually published by that live descriptor:

| Requested outcome | Published `header_behavior` value |
|---|---|
| Normal header in document flow | `static` |
| Entire header remains at the top | `sticky` |
| Hide while scrolling down, reveal while scrolling up | `showOnScrollUp` |
| Keep the header pinned and reduce its saved root Section padding | `shrinkOnScroll` |

The native semantic outer `<header>` owns this behavior. Do not substitute
`Container.sticky`, `Navbar.sticky`, Advanced positioning, utility classes,
Custom CSS/JS, theme code, or a different header widget. A nested sticky box
can be constrained by its short parent and does not implement template behavior.
Do not enable motion merely because a brief says “premium”.

## Settings-only write and readback

This is not a layout save: keep the header selection and node map unchanged.
Finish or stop any active layout-mutation report chain before this independent
settings operation; do not invent a layout `nextAction` or a client command.
Use the site's authorized authenticated REST transport for the descriptor.

1. GET the current settings. Require `template_type: "header"` and a nonempty
   token under the advertised `versionField`. Keep that settings snapshot for
   comparison; never expose its private CSS/JS or credentials in a report.
2. Prepare only the explicitly requested changes plus that settings token under
   `writePreconditionField`. For example, a requested ordinary sticky header
   with zero extra offset sends `header_behavior: "sticky"`,
   `sticky_offset: "0px"`, and the fresh `expectedRevision`. Omitted fields are
   preserved by this partial settings write. Do not resend defaults, full
   settings, read-only choice lists, CSS/JS, or layout/selection revision tokens.
3. For `shrinkOnScroll`, GET `shrink_targets` and choose the intended **saved
   direct root Section** by its returned ID. Send `shrink_target_node_id` and
   the approved `shrink_padding`; never guess an ID or serialize
   `shrink_targets`. If the requested root Section is not saved yet, finish its
   versioned layout save first, then fetch settings and targets again. An
   ambiguous or missing target blocks this change, not permission to fake it
   with CSS. `invalid_shrink_target` is a refusal, not successful sticky fallback.
4. Send one request through the advertised `writeMethod`. Respect permission
   errors, integrity/write locks, conflicts and missing preconditions. Never
   retry `409`/`428` automatically or bypass a refusal with direct meta/option
   writes; a fresh read and reviewed reconciliation start a new attempt.
5. Require success, canonical `settings` and a fresh settings `revision`, then
   GET again. The readback revision must match the save response and every
   submitted setting must match its canonical value (`"0"` may normalize to
   `"0px"`). Verify unrelated settings remain unchanged; compare private fields
   internally without printing them. A `200` alone does not prove the change.

`sticky_offset` is the additional authored offset. The native frontend already
accounts for the WordPress admin bar; do not add a guessed admin-bar height to
the stored value. The settings operation must not rename, activate, replace or
rewrite the header layout.

## Browser acceptance, not a static screenshot

Open a same-origin **public page that actually renders the active header**,
not just the isolated template editor or a virtual layout preview. At
1440/834/390 px, check the outer header's geometry before/after scrolling:

- `sticky`: the whole header pins at the requested offset. Check again with
  JavaScript disabled; ordinary sticky needs CSS, not a script workaround.
- `showOnScrollUp`: the header stays visible initially, hides only after its
  area is passed while scrolling down, and returns when scrolling up.
- `shrinkOnScroll`: the selected root Section changes padding and returns to
  its saved size near the top; the wrong Section must not shrink.
- `static`: the header scrolls away normally.

Repeat after a normal reload, and check signed-out and admin-bar views when
available. Ensure there is exactly one header, content does not jump or become
unusable, focus/menu controls remain usable, and no horizontal overflow or
missing stylesheet appears. A simple header made from text/links must work
without adding WPMenu or another widget merely to trigger asset loading.
If saved settings read back correctly but the public header does not behave,
report a Builder runtime/asset defect with that evidence. Do not claim a missing
authoring control, change the cache policy, or add CSS as a workaround.
