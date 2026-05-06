# Changelog

All notable changes to this extension are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0]

### Added
- Bulk **Expand all** / **Collapse all** toolbar inside the search bar,
  on its own row below the input. Each click batch-updates the persisted
  expanded set in one write. Collapse-all stays collapsed even when the
  active leaf is inside the closed branch — the active-path auto-reveal
  is suppressed for the duration, same mechanism as the per-branch
  user-explicit-collapse.
- English (source) and German XLIFF translations for the new toolbar
  labels under `Resources/Private/Language/`. Backend middleware
  registers the labels early enough for `TYPO3.lang` to receive them
  (the `BeforeJavaScriptsRenderingEvent` we already use fires after
  inline-language-label compilation, so it's not viable for this).
- Bigger chevron click area without enlarging the chevron itself: an
  invisible `::before` pseudo extends the hit zone on three sides
  (top/bottom/left) — tight on the right to avoid stealing label
  clicks.
- Active-path highlight: ancestors of the currently active category get
  the same focus fill as the active leaf (no outline, so the leaf
  remains the visually distinct destination).
- Auto-reveal of the active leaf's ancestor chain, regardless of stored
  collapse state. Non-destructive — the persisted preference is not
  modified.
- `aria-expanded` on every collapsible nav button, mirroring visual
  state through stored collapse, search reveal and active-path reveal.
- ArrowRight / ArrowLeft keyboard shortcuts to expand/collapse the
  *currently active* section. Bound to what is on screen, not to focus,
  so scrolling the body re-targets the keys without the user having to
  re-tab.
- Per-site `localStorage` scoping. Storage key is now
  `t3-settings-nav-expanded:<siteId>`; preferences on one site no
  longer pollute another.
- Stale-key pruning: keys in the per-site set that no longer match any
  `<li data-key>` in the nav are dropped on each enhance pass.

### Fixed
- The last leaf of the body never became active when scrolled to the
  bottom. Core's IntersectionObserver picks the first visible category
  in tree order, which the last leaf can never be when several sections
  are visible at once. The extension now overrides `activeCategory` to
  the last visible category when the scrollable parent is at the
  bottom.
- The first leaf of a parent failed to activate after a click because
  the parent's category section was still partially visible above the
  viewport. A 400ms pin after each nav click reasserts the clicked key
  while the IntersectionObserver settles.
- Clicking a parent's chevron while the active leaf was inside it had
  no visible effect: the click toggled stored state but the active-path
  reveal kept the children showing. Toggles now read *visual* state,
  and a session-scoped suppression set prevents the next render from
  undoing the user's explicit close. The suppression auto-clears when
  the active leaf moves out of the suppressed branch.
- A collapsed parent lost its active highlight when its children were
  hidden via user-explicit collapse. Path membership and the reveal
  override are now separate flags, so the parent stays highlighted as
  part of the active path even when its children are collapsed.

### Changed
- Smooth scroll on nav-item clicks is replaced with an instant jump.
  The previous smooth scroll caused core's IntersectionObserver to
  fire repeatedly along the way, briefly revealing every section
  between origin and destination.

## [0.1.0]

### Added
- Collapsible navigation blocks in the Site Settings / Site Sets module.
- Persisted expanded state in `localStorage`
  (`t3-settings-nav-expanded`).
- Default state: all blocks collapsed.
- Search auto-reveals collapsed branches via a `data-search-active`
  flag on the editor.
- Idempotent DOM enhancement via `MutationObserver` to survive Lit's
  re-renders.
