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

### Collapsible navigation blocks

The Site Settings module's left-hand navigation gains collapsible parent
blocks. **All blocks start collapsed by default.** Click the chevron in
front of a parent label to fold/unfold its children. The set of expanded
blocks is persisted in `localStorage` (key: `t3-settings-nav-expanded`) so
your choices survive reloads.

- Leaf items (no children, or whose only children are filtered out by the
  module's own search/visibility logic) show a faint bullet instead of the
  chevron.
- Clicking the label still smooth-scrolls to that section in the body — only
  the icon area toggles.
- Searching in the navigation auto-reveals collapsed branches so matches
  remain visible; clearing the search restores the previous state.

## How it works

- A PSR-14 listener on `BeforeJavaScriptsRenderingEvent` adds a small ES
  module to every backend page's asset collection.
- The module installs a `MutationObserver` on `document.body` and enhances
  any `<typo3-backend-settings-editor>` light-DOM tree it finds, re-running
  on every Lit re-render so search and state changes are handled correctly.
- A backend stylesheet is registered through
  `$GLOBALS['TYPO3_CONF_VARS']['BE']['stylesheets']`.

No vendor patching: TYPO3 core's compiled `editor.js` is left untouched.

## License

GPL-2.0-or-later