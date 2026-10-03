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
      toggle.dataset.icon = dark ? 'sun' : 'moon';
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
    });
  });
  system.addEventListener('change', e => { if (!preference) apply(e.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', e => {
    if (e.key !== key) return;
    preference = ['light', 'dark'].includes(e.newValue) ? e.newValue : null;
    apply(preference || (system.matches ? 'dark' : 'light'));
  });
})();
