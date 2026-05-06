# Site Sets Extras

Quality-of-life UX improvements for the TYPO3 v13 backend Site Settings /
Site Sets area.

## Requirements

- TYPO3 v13
- PHP 8.3+

## Installation

```sh
composer require wapplersystems/site-sets-extras
```

The extension auto-activates via composer; no manual extension setup needed
beyond the usual `vendor/bin/typo3 extension:setup`.

## Features

### Collapsible navigation

The Site Settings module's left-hand navigation gains collapsible parent
blocks. **All blocks start collapsed by default.** Click the chevron in
front of a parent label to fold/unfold its children.

- Expanded state is persisted in `localStorage` **per site** (key:
  `t3-settings-nav-expanded:<siteId>`), so each site keeps its own
  preferences. Keys for categories no longer present in the
  configuration are pruned automatically on each render.
- Leaf items (no children, or whose only children are filtered out) show
  a faint bullet instead of the chevron.
- The chevron's clickable area is wider than the chevron itself
  (extended via an invisible pseudo-element) so it forgives slightly
  off-target clicks.

### Bulk expand / collapse

Two buttons sit directly below the search input:

- **Expand all** — opens every collapsible block and writes them all to
  the persisted set.
- **Collapse all** — closes every block (active branch included) and
  empties the persisted set. The active-path auto-reveal is suppressed
  for the duration so the click feels final, releasing once the active
  leaf moves out of the closed branch.

Labels are translated via
`Resources/Private/Language/{locallang,de.locallang}.xlf` — German is
shipped, additional locales can be added as sibling `<lang>.locallang.xlf`
files.

### Active-path highlight

When you select or scroll to a category, its entire ancestor chain in
the navigation gets a subordinate fill. The active leaf still wears
core's outlined ring as the destination; ancestors read as the trail.
Collapsed ancestors auto-reveal so the active leaf is always visible.

If you explicitly close a parent while a child of it is still the
active leaf, the parent stays highlighted (you're still semantically
inside it) but its children hide. The override is session-only — when
the active leaf moves out of that branch, the auto-reveal is restored.

### Keyboard

- **Arrow Right** — expand the currently active section
- **Arrow Left** — collapse the currently active section
- **Enter / Space** — navigate (unchanged)

Arrow keys always target the *active* section, regardless of which
button has focus, so scrolling the body re-points them automatically.

Every collapsible nav button carries an `aria-expanded` attribute
mirroring its visual state.

### Click & scroll behaviour

- Clicking a nav item jumps **instantly** to its section. The previous
  smooth scroll caused core's IntersectionObserver to fire on every
  section in between, briefly revealing each branch en route.
- The first leaf of a parent now activates correctly on click — a brief
  post-click pin overrides the IntersectionObserver picking the
  still-partially-visible parent above it.
- Scrolling to the very bottom of the body marks the last leaf as
  active (core's "first visible in tree order" picker can never reach
  it on its own).

### Search

Typing in the navigation's search field auto-reveals all collapsed
branches so matches stay visible. Clearing the search restores the
previous collapse state.

## How it works

- A PSR-14 listener on `BeforeJavaScriptsRenderingEvent` adds a small ES
  module to every backend page's asset collection.
- A PSR-15 backend middleware registers the inline language label file
  via `PageRenderer::addInlineLanguageLabelFile()`. The asset listener
  fires too late for this — `PageRenderer::renderMainJavaScriptLibraries()`
  compiles inline labels into the `TYPO3.lang` global *before* the
  asset-render event runs.
- The module installs a `MutationObserver` on `document.body` and
  enhances any `<typo3-backend-settings-editor>` light-DOM tree it finds,
  re-running on every Lit re-render so search and state changes are
  handled correctly.
- A backend stylesheet is registered through
  `$GLOBALS['TYPO3_CONF_VARS']['BE']['stylesheets']`.

No vendor patching: TYPO3 core's compiled `editor.js` is left untouched.

## License

GPL-2.0-or-later
