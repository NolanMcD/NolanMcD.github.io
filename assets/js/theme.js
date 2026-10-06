(() => {
  'use strict';
  const key = 'noland.theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch (_) { /* Storage is optional. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;
  function apply(theme) {
    root.dataset.theme = theme;
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const dark = theme === 'dark';
      toggle.hidden = false;
      toggle.textContent = `Switch to ${dark ? 'light' : 'dark'} mode`;
      toggle.title = `Switch to ${dark ? 'light' : 'dark'} mode`;
      toggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
      toggle.setAttribute('aria-pressed', String(dark));
    }
  }
  apply(preference || (system.matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch (_) { /* Keep the choice for this page. */ }
      apply(preference);
      const menu = document.getElementById('theme-menu');
      if (menu) menu.open = false;
    });
    const menu = document.getElementById('theme-menu');
    document.addEventListener('click', e => {
      if (menu && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu?.open) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    });
  });
  system.addEventListener('change', e => { if (!preference) apply(e.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', e => {
    if (e.key !== key) return;
    preference = ['light', 'dark'].includes(e.newValue) ? e.newValue : null;
    apply(preference || (system.matches ? 'dark' : 'light'));
  });
})();
