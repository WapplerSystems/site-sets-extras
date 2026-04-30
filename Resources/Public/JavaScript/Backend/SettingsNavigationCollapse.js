// Enhances the TYPO3 v13 Site Settings navigation with collapsible blocks.
// Uses MutationObserver because the Lit editor re-renders its tree on
// search/state changes, so any DOM mutation must reapply itself.

const STORAGE_KEY = 't3-settings-nav-expanded';

const loadExpanded = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const saveExpanded = (set) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* quota or disabled storage — silently ignore */ }
};

const expanded = loadExpanded();

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
    return;
  }

  li.dataset.collapsible = 'true';

  const iconSpan = itemBtn.querySelector(':scope > .settings-navigation-item-icon');
  if (iconSpan && !iconSpan._collapseBound) {
    iconSpan._collapseBound = true;
    iconSpan.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = li.dataset.collapsed !== 'true';
      li.dataset.collapsed = next ? 'true' : 'false';
      const key = li.dataset.key;
      if (key) {
        if (next) expanded.delete(key);
        else expanded.add(key);
        saveExpanded(expanded);
      }
    });
  }

  const key = li.dataset.key;
  if (key && !expanded.has(key) && li.dataset.collapsed !== 'true') {
    li.dataset.collapsed = 'true';
  }
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