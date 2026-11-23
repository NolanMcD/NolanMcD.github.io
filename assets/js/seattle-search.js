(() => {
  const key = 'noland-seattle-search-v1';
  const form = document.getElementById('sea-form'), list = document.getElementById('sea-list'), notice = document.getElementById('sea-storage');
  let entries = [];
  try { entries = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(entries)) entries = []; } catch { notice.textContent = 'Browser storage is unavailable. Entries will only last until this page is closed.'; }
  function save() { try { localStorage.setItem(key, JSON.stringify(entries)); } catch { notice.textContent = 'Could not save to browser storage. Entries will only last until this page is closed.'; } }
  function render() {
    list.replaceChildren();
    if (!entries.length) { const p = document.createElement('p'); p.textContent = 'No opportunities yet. Add the first one above.'; list.append(p); return; }
    entries.forEach((entry, index) => {
      const card = document.createElement('article'), body = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('p'), next = document.createElement('p'), remove = document.createElement('button');
      card.className = 'sea-entry'; title.textContent = `${entry.role} · ${entry.company}`; detail.textContent = `${entry.status}${entry.date ? ' · Follow up: ' + entry.date : ''}`; next.textContent = entry.next ? 'Next: ' + entry.next : 'Add a next action when you have one.';
      body.append(title, detail, next);
      if (entry.url) { try { const u = new URL(entry.url); if (['http:', 'https:'].includes(u.protocol)) { const a = document.createElement('a'); a.href = u.href; a.textContent = 'View posting ↗'; a.target = '_blank'; a.rel = 'noopener noreferrer'; body.append(a); } } catch {} }
      remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${entry.role} at ${entry.company}`); remove.addEventListener('click', () => { entries.splice(index, 1); save(); render(); }); card.append(body, remove); list.append(card);
    });
  }
  form.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(form); entries.unshift(Object.fromEntries(data.entries())); save(); render(); form.reset(); });
  const fields = ['income', 'housing', 'other', 'savings'].map(name => document.getElementById('sea-' + name));
  function budget() { const values = fields.map(field => Number(field.value) || 0); document.getElementById('sea-result').textContent = fields.every(field => !field.value) ? 'Enter estimates to calculate your monthly remainder.' : 'Monthly remainder: ' + new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(values[0] - values[1] - values[2] - values[3]); }
  fields.forEach(field => field.addEventListener('input', budget)); render();
})();
