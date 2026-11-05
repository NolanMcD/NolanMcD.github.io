(() => {
  const root = document.querySelector('.director-rankings');
  if (!root) return;
  const list = root.querySelector('.dr-list');
  const cards = [...list.children];
  const buttons = [...root.querySelectorAll('[data-director-sort]')];
  function sort(mode, updateUrl = false) {
    mode = mode === 'average' ? 'average' : 'total';
    const secondary = mode === 'total' ? 'average' : 'total';
    cards.sort((a, b) => Number(b.dataset[mode]) - Number(a.dataset[mode]) ||
      Number(b.dataset[secondary]) - Number(a.dataset[secondary]) || a.dataset.name.localeCompare(b.dataset.name));
    const maximum = Number(cards[0].dataset[mode]);
    for (const card of cards) {
      card.querySelector('.dr-rank').textContent = card.dataset[mode + 'Rank'];
      card.querySelector('.dr-bar span').style.width = `${Number(card.dataset[mode]) / maximum * 100}%`;
      list.appendChild(card);
    }
    root.dataset.sort = mode;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.directorSort === mode)));
    root.querySelector('.dr-status').textContent = `Ordered by ${mode === 'total' ? 'total stars' : 'average rating'}. Equal scores share a rank.`;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (mode === 'average') url.searchParams.set('rank', 'average');
      else url.searchParams.delete('rank');
      window.history.replaceState(null, '', url);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => sort(button.dataset.directorSort, true)));
  root.querySelectorAll('img').forEach(img => {
    const hide = () => { img.hidden = true; };
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });
  sort(new URLSearchParams(window.location.search).get('rank'));
  root.querySelector('.dr-toolbar').hidden = false;
})();
