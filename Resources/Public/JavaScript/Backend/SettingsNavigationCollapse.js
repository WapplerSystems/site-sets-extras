// Enhances the TYPO3 v13 Site Settings navigation with collapsible blocks.
// Uses MutationObserver because the Lit editor re-renders its tree on
// search/state changes, so any DOM mutation must reapply itself.

const STORAGE_KEY = 't3-settings-nav-collapsed';

const loadCollapsed = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const saveCollapsed = (set) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* quota or disabled storage — silently ignore */ }
};

const collapsed = loadCollapsed();

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

const TOGGLE_SVG =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
  '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const ensureToggle = (li) => {
  const itemBtn = li.querySelector(':scope > .settings-navigation-item');
  const childUl = li.querySelector(':scope > ul');
  if (!itemBtn || !childUl) return;

  li.dataset.collapsible = 'true';

  let toggle = itemBtn.querySelector(':scope > .settings-navigation-item-toggle');
  if (!toggle) {
    toggle = document.createElement('span');
    toggle.className = 'settings-navigation-item-toggle';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-label', 'Toggle category');
    toggle.innerHTML = TOGGLE_SVG;

    const handle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = li.dataset.collapsed !== 'true';
      li.dataset.collapsed = next ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', String(!next));
      const key = li.dataset.key;
      if (key) {
        if (next) collapsed.add(key);
        else collapsed.delete(key);
        saveCollapsed(collapsed);
      }
    };
    toggle.addEventListener('click', handle);
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handle(e);
    });

    itemBtn.insertBefore(toggle, itemBtn.firstChild);
  }

  const key = li.dataset.key;
  if (key && collapsed.has(key) && li.dataset.collapsed !== 'true') {
    li.dataset.collapsed = 'true';
  }
  toggle.setAttribute('aria-expanded', String(li.dataset.collapsed !== 'true'));
};

const updateSearchState = (editor) => {
  const input = editor.querySelector('.settings-search input');
  if (input && input.value.trim() !== '') editor.dataset.searchActive = 'true';
  else delete editor.dataset.searchActive;
};

const enhance = (editor) => {
  stampDataKeys(editor);
  editor.querySelectorAll('.settings-navigation li').forEach(ensureToggle);
  updateSearchState(editor);
};

const enhanceAll = () => {
  document.querySelectorAll('typo3-backend-settings-editor').forEach(enhance);
};

new MutationObserver(enhanceAll).observe(document.body, {
  childList: true,
  subtree: true,
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.matches('.settings-search input')) {
    const editor = t.closest('typo3-backend-settings-editor');
    if (editor) updateSearchState(editor);
  }
}, true);

enhanceAll();