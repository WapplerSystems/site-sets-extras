// Enhances the TYPO3 v13 Site Settings navigation with collapsible blocks.
// Uses MutationObserver because the Lit editor re-renders its tree on
// search/state changes, so any DOM mutation must reapply itself.

// Per-site storage. Different sites can have different category trees
// (when site sets vary), so a single global set would mean pruning one
// site's keys while looking at another. Scope by the site identifier
// pulled from the editor's action-url.
const STORAGE_PREFIX = 't3-settings-nav-expanded';

const storageKey = (siteId) => `${STORAGE_PREFIX}:${siteId}`;

const getSiteId = (editor) => {
  const url = editor.getAttribute('action-url');
  if (!url) return null;
  try {
    return new URL(url, window.location.origin).searchParams.get('site') || null;
  } catch {
    return null;
  }
};

const loadExpandedSet = (siteId) => {
  if (!siteId) return new Set();
  try {
    const raw = localStorage.getItem(storageKey(siteId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const expandedFor = (editor) => {
  if (editor._expandedSet) return editor._expandedSet;
  const siteId = getSiteId(editor);
  editor._expandedSiteId = siteId;
  editor._expandedSet = loadExpandedSet(siteId);
  return editor._expandedSet;
};

const persistExpanded = (editor) => {
  const set = editor._expandedSet;
  const siteId = editor._expandedSiteId;
  if (!set || !siteId) return;
  try {
    localStorage.setItem(storageKey(siteId), JSON.stringify([...set]));
  } catch { /* quota or disabled storage — silently ignore */ }
};

// Drop keys from the editor's set that are no longer present in the nav,
// so localStorage doesn't accumulate dead keys as configs evolve. Per-site
// scoping makes this safe — keys from other sites are in their own bucket.
const pruneStaleKeys = (editor) => {
  const expanded = expandedFor(editor);
  if (expanded.size === 0) return;
  const present = new Set();
  editor.querySelectorAll('.settings-navigation li[data-key]').forEach(li => {
    if (li.dataset.key) present.add(li.dataset.key);
  });
  if (present.size === 0) return;  // nav not yet stamped; skip this pass
  let changed = false;
  for (const key of expanded) {
    if (!present.has(key)) { expanded.delete(key); changed = true; }
  }
  if (changed) persistExpanded(editor);
};

// Session-only: keys the user explicitly closed while their active leaf
// was still inside. Without this, markActivePath would re-reveal them on
// the next observer fire. Self-clears in markActivePath when the active
// leaf moves out of the suppressed branch.
const suppressedAncestors = new Set();

// The navigation <li>s carry no data-key, but the body
// .settings-category-list[data-key] elements do. Both trees come from the
// same recursive Lit render pass in DFS order, so zipping by index works.
const stampDataKeys = (editor) => {
  const navLis = editor.querySelectorAll('.settings-navigation li');
  const bodyCats = editor.querySelectorAll(
    '.settings-body-inner .settings-category-list[data-key]'
  );
  const len = Math.min(navLis.length, bodyCats.length);
  for (let i = 0; i < len; i++) {
    const key = bodyCats[i].dataset.key;
    if (key) navLis[i].dataset.key = key;
  }
};

// Toggle the visible state, not the stored state — otherwise an
// active-path reveal would make clicks/keys flip storage with no visual
// effect. activeRevealed reflects "currently revealed via active path".
const setBranchOpen = (li, wantOpen) => {
  const wasRevealed = li.dataset.activeRevealed === 'true';
  li.dataset.collapsed = wantOpen ? 'false' : 'true';
  const key = li.dataset.key;
  if (!key) return;
  const editor = li.closest('typo3-backend-settings-editor');
  if (editor) {
    const expanded = expandedFor(editor);
    if (wantOpen) expanded.add(key);
    else expanded.delete(key);
    persistExpanded(editor);
  }
  if (wasRevealed && !wantOpen) {
    // Drop only the reveal flag for instant collapse; keep activeAncestor
    // so the parent stays highlighted as part of the active path.
    suppressedAncestors.add(key);
    delete li.dataset.activeRevealed;
  } else if (wantOpen) {
    suppressedAncestors.delete(key);
  }
};

const ensureToggle = (li) => {
  const itemBtn = li.querySelector(':scope > .settings-navigation-item');
  const childUl = li.querySelector(':scope > ul');
  if (!itemBtn) return;

  const hasVisibleChild = childUl
    && Array.from(childUl.children).some(
      c => c.tagName === 'LI' && !c.hasAttribute('hidden')
    );
  if (!hasVisibleChild) {
    li.dataset.collapsible = 'false';
    itemBtn.removeAttribute('aria-expanded');
    return;
  }

  li.dataset.collapsible = 'true';

  const iconSpan = itemBtn.querySelector(':scope > .settings-navigation-item-icon');
  if (iconSpan && !iconSpan._collapseBound) {
    iconSpan._collapseBound = true;
    iconSpan.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasRevealed = li.dataset.activeRevealed === 'true';
      const visiblyOpen = li.dataset.collapsed !== 'true' || wasRevealed;
      setBranchOpen(li, !visiblyOpen);
    });
  }

  const key = li.dataset.key;
  const editor = li.closest('typo3-backend-settings-editor');
  const expanded = editor ? expandedFor(editor) : null;
  if (key && expanded && !expanded.has(key) && li.dataset.collapsed !== 'true') {
    li.dataset.collapsed = 'true';
  }

  // aria-expanded mirrors visual state, including active-path reveals.
  const visiblyOpen = li.dataset.collapsed !== 'true'
    || li.dataset.activeRevealed === 'true';
  itemBtn.setAttribute('aria-expanded', visiblyOpen ? 'true' : 'false');
};

const updateSearchState = (editor) => {
  const input = editor.querySelector('.settings-search input');
  if (input && input.value.trim() !== '') editor.dataset.searchActive = 'true';
  else delete editor.dataset.searchActive;
};

const findScrollable = (el) => {
  let cur = el.parentElement;
  while (cur && cur !== document.body) {
    const s = getComputedStyle(cur);
    if (/(auto|scroll)/.test(s.overflowY)) return cur;
    cur = cur.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

// Core's IntersectionObserver picks the FIRST visible category in tree order
// as activeCategory. At scroll-bottom multiple categories are visible and the
// last leaf can never be "first", so it never gets marked active. Detect that
// case and assign the correct key directly — Lit's reactive @state() handles
// the re-render. On scroll-up Lit's observer reclaims naturally.
const fixBottomActive = (editor) => {
  // A click pin overrides bottom-detection: if the user clicked something
  // specific while the body happens to be at scroll-bottom, the click wins.
  if (editor._pinnedKey && performance.now() < editor._pinnedUntil) return;
  const scrollable = editor._collapseScrollable;
  if (!scrollable) return;
  if (scrollable.scrollHeight <= scrollable.clientHeight + 1) return;

  const atBottom =
    scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 4;
  if (!atBottom) return;

  const cats = editor.querySelectorAll(
    '.settings-body-inner .settings-category[data-key]:not([hidden])'
  );
  if (!cats.length) return;
  const key = cats[cats.length - 1].dataset.key;
  if (key && editor.activeCategory !== key) {
    editor.activeCategory = key;
  }
};

// Set briefly during a nav-item click so the patched scrollTo (below)
// rewrites Lit's smooth scroll to an instant jump. Without this, the
// smooth scroll fires the IntersectionObserver repeatedly along the
// way and we'd see a wave of branches reveal as it passes through.
let forceInstantScroll = false;

const bindScroll = (editor) => {
  if (editor._collapseScrollBound) return;
  const scrollable = findScrollable(editor);
  if (!scrollable) return;
  editor._collapseScrollable = scrollable;
  editor._collapseScrollBound = true;

  if (!scrollable._collapseScrollPatched) {
    scrollable._collapseScrollPatched = true;
    const original = scrollable.scrollTo.bind(scrollable);
    scrollable.scrollTo = (opts, ...rest) => {
      if (forceInstantScroll && opts && typeof opts === 'object' && opts.behavior === 'smooth') {
        return original({ ...opts, behavior: 'auto' });
      }
      return original(opts, ...rest);
    };
  }

  let scheduled = false;
  scrollable.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fixBottomActive(editor);
    });
  }, { passive: true });
};

// Pin Lit's activeCategory to the clicked key for a brief window after
// the click. After an instant scroll lands, the IntersectionObserver may
// pick a still-partially-visible parent over the targeted leaf (first
// leaf of a parent is the typical case). Reasserting our key on the next
// observer fire forces Lit to re-render with the correct .active button.
const PIN_DURATION_MS = 400;

const enforcePinnedActive = (editor) => {
  if (!editor._pinnedKey) return;
  if (performance.now() > editor._pinnedUntil) {
    editor._pinnedKey = null;
    return;
  }
  if (editor.activeCategory !== editor._pinnedKey) {
    editor.activeCategory = editor._pinnedKey;
  }
};

// Capture-phase click listener: sets the flag before Lit's button-level
// click handler runs selectCategory → scrollTo. Cleared on the next tick
// after the synchronous click handlers complete. Also pins the clicked
// key so post-scroll IntersectionObserver fires can't drift it.
document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return;
  const btn = e.target.closest('.settings-navigation-item');
  if (!btn) return;
  forceInstantScroll = true;
  setTimeout(() => { forceInstantScroll = false; }, 0);

  const editor = btn.closest('typo3-backend-settings-editor');
  const li = btn.closest('li');
  const key = li?.dataset.key;
  if (editor && key) {
    editor._pinnedKey = key;
    editor._pinnedUntil = performance.now() + PIN_DURATION_MS;
  }
}, true);

// ArrowRight/ArrowLeft on a focused nav button operates on the *active*
// branch's nearest collapsible ancestor — not the focused button. Focus
// and active drift apart when the user scrolls the body (mouse-wheel
// doesn't move focus, but IntersectionObserver moves active), so binding
// arrows to focus would mean keys still target the previously-focused
// branch. Tying them to active makes "what I'm looking at" what arrows
// control, which is the model for this UI.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (!(e.target instanceof Element)) return;
  if (!e.target.matches('.settings-navigation-item')) return;

  const editor = e.target.closest('typo3-backend-settings-editor');
  if (!editor) return;
  const activeBtn = editor.querySelector('.settings-navigation-item.active');
  if (!activeBtn) return;

  let targetLi = activeBtn.closest('li');
  while (targetLi && targetLi.dataset.collapsible !== 'true') {
    targetLi = targetLi.parentElement?.closest('li');
  }
  if (!targetLi) return;

  const wasRevealed = targetLi.dataset.activeRevealed === 'true';
  const visiblyOpen = targetLi.dataset.collapsed !== 'true' || wasRevealed;
  const wantOpen = e.key === 'ArrowRight';
  if (visiblyOpen === wantOpen) return;
  e.preventDefault();
  e.stopPropagation();
  setBranchOpen(targetLi, wantOpen);
}, true);

const markActivePath = (editor) => {
  editor.querySelectorAll('.settings-navigation li[data-active-ancestor]')
    .forEach(li => delete li.dataset.activeAncestor);
  editor.querySelectorAll('.settings-navigation li[data-active-revealed]')
    .forEach(li => delete li.dataset.activeRevealed);

  const activeBtn = editor.querySelector('.settings-navigation-item.active');
  if (!activeBtn) return;

  const activeLi = activeBtn.closest('li');
  const navRoot = editor.querySelector('.settings-navigation');
  if (!activeLi || !navRoot) return;

  // Build the ancestor key chain first so we can prune stale suppressions
  // (any key no longer in the chain — i.e. the active leaf moved out of
  // that branch — releases the user's earlier explicit-close).
  const ancestorKeys = new Set();
  let li = activeLi.parentElement?.closest('li');
  while (li && navRoot.contains(li)) {
    if (li.dataset.key) ancestorKeys.add(li.dataset.key);
    li = li.parentElement?.closest('li');
  }
  for (const key of suppressedAncestors) {
    if (!ancestorKeys.has(key)) suppressedAncestors.delete(key);
  }

  // Ancestors only — the active node's own subtree stays per stored state.
  // data-active-ancestor drives the path highlight and is set unconditionally
  // on every chain member. data-active-revealed drives the child-reveal and
  // chevron rotation, and is suppressed when the user explicitly collapsed
  // a branch they're still semantically inside.
  li = activeLi.parentElement?.closest('li');
  while (li && navRoot.contains(li)) {
    li.dataset.activeAncestor = 'true';
    if (!suppressedAncestors.has(li.dataset.key)) {
      li.dataset.activeRevealed = 'true';
    }
    li = li.parentElement?.closest('li');
  }
};

// Look up a label from inline language labels populated by PageRenderer's
// addInlineLanguageLabelFile (registered in AddBackendAssets). Falls back to
// the source string if labels haven't loaded — keeps the UI usable on a
// fresh install before language packs are warm.
const labelFor = (key, fallback) => window.TYPO3?.lang?.[key] || fallback;

// Expand-all: adds every collapsible key to the persisted set, opens every
// branch, clears the user-explicit-collapse memory (intent is "show me
// everything", which contradicts any prior suppression).
const expandAll = (editor) => {
  const expanded = expandedFor(editor);
  editor.querySelectorAll('.settings-navigation li[data-collapsible="true"]').forEach(li => {
    if (li.dataset.key) expanded.add(li.dataset.key);
    li.dataset.collapsed = 'false';
  });
  suppressedAncestors.clear();
  persistExpanded(editor);
  enhance(editor);
};

// Collapse-all: empties the persisted set, closes every branch, AND adds
// every active-chain ancestor key to suppressedAncestors. Without that last
// step the active-path auto-reveal would re-open the active chain on the
// next observer fire and the click would feel broken — same mechanism the
// existing per-branch user-explicit-collapse uses (see setBranchOpen).
const collapseAll = (editor) => {
  const expanded = expandedFor(editor);
  expanded.clear();
  editor.querySelectorAll('.settings-navigation li[data-collapsible="true"]').forEach(li => {
    li.dataset.collapsed = 'true';
  });
  const activeBtn = editor.querySelector('.settings-navigation-item.active');
  const navRoot = editor.querySelector('.settings-navigation');
  if (activeBtn && navRoot) {
    let li = activeBtn.closest('li')?.parentElement?.closest('li');
    while (li && navRoot.contains(li)) {
      if (li.dataset.key) suppressedAncestors.add(li.dataset.key);
      li = li.parentElement?.closest('li');
    }
  }
  persistExpanded(editor);
  enhance(editor);
};

// Lit re-renders the editor's light DOM on state changes (search input,
// category select), wiping any DOM we inserted as a child. So the gate is
// "is our toolbar still attached" rather than a one-shot bound flag — the
// existing MutationObserver re-runs enhance on every change, and this
// function is idempotent when the toolbar is present.
const ensureCollapseAllToolbar = (editor) => {
  if (editor.querySelector('.settings-extras-bulk-toolbar')) return;
  const search = editor.querySelector('.settings-search');
  if (!search) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'settings-extras-bulk-toolbar';

  const makeBtn = (iconId, labelKey, fallbackLabel, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-default btn-sm settings-extras-bulk-toolbar__btn';
    const label = labelFor(labelKey, fallbackLabel);
    btn.title = label;
    btn.innerHTML =
      `<typo3-backend-icon identifier="${iconId}" size="small"></typo3-backend-icon>` +
      `<span class="settings-extras-bulk-toolbar__label">${label}</span>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  toolbar.appendChild(makeBtn(
    'apps-pagetree-category-expand-all',
    'siteSetsExtras.nav.expand_all',
    'Expand all',
    () => expandAll(editor),
  ));
  toolbar.appendChild(makeBtn(
    'apps-pagetree-category-collapse-all',
    'siteSetsExtras.nav.collapse_all',
    'Collapse all',
    () => collapseAll(editor),
  ));

  search.appendChild(toolbar);
};

const enhance = (editor) => {
  bindScroll(editor);
  stampDataKeys(editor);
  pruneStaleKeys(editor);
  ensureCollapseAllToolbar(editor);
  editor.querySelectorAll('.settings-navigation li').forEach(ensureToggle);
  updateSearchState(editor);
  fixBottomActive(editor);
  enforcePinnedActive(editor);
  markActivePath(editor);
};

const enhanceAll = () => {
  document.querySelectorAll('typo3-backend-settings-editor').forEach(enhance);
};

// Lit toggles the .active class on nav buttons in-place (no childList change),
// so the observer must also see class-attribute mutations. We only ever write
// dataset.* attributes, so this filter won't loop on our own writes.
new MutationObserver(enhanceAll).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.matches('.settings-search input')) {
    const editor = t.closest('typo3-backend-settings-editor');
    if (editor) updateSearchState(editor);
  }
}, true);

enhanceAll();