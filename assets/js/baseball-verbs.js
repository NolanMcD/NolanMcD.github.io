(() => {
  'use strict';
  const root = document.querySelector('#baseball-verbs');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const form = $('bv-editor');
  const filters = $('bv-filters');
  const token = new URLSearchParams(location.hash.slice(1)).get('owner');
  const owner = location.hostname === '127.0.0.1' && Boolean(token);
  if (owner) history.replaceState(null, '', location.pathname + location.search);
  let entries = [], editing = null, dirty = false, busy = false;
  const message = text => { $('bv-message').textContent = text; };
  function safeURL(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'baseballsavant.mlb.com' && !u.username && !u.password && !u.port; }
    catch { return false; }
  }
  async function api(path, body) {
    const response = await fetch(path, { cache:'no-store', headers:{ Authorization:`Bearer ${token}`, ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? { method:'POST', body:JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save. Please try again.');
    return data;
  }
  function node(tag, text, cls) {
    const el = document.createElement(tag); el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function reset() {
    form.reset(); editing = null; dirty = false;
    $('bv-editor-title').textContent = 'Add a word to the collection';
    $('bv-cancel').hidden = true;
  }
  function render() {
    const query = filters.elements.search.value.trim().toLocaleLowerCase();
    const status = filters.elements.status.value;
    const shown = entries.filter(e => [e.verb,e.announcer,e.notes].join(' ').toLocaleLowerCase().includes(query) && (!status || (status === 'linked' ? Boolean(e.url) : !e.url))).sort((a,b) => a.verb.localeCompare(b.verb));
    const linked = entries.filter(e => e.url).length;
    $('bv-stats').textContent = `${entries.length} words collected · ${linked} with clips · ${entries.length - linked} awaiting examples`;
    $('bv-count').textContent = `${shown.length} of ${entries.length} words`;
    $('bv-results').replaceChildren();
    for (const entry of shown) {
      const card = node('article', '', 'bv-card');
      card.append(node('h3', entry.verb));
      if (entry.announcer) card.append(node('p', entry.announcer, 'bv-muted'));
      if (entry.notes) card.append(node('p', entry.notes, 'bv-notes'));
      if (safeURL(entry.url)) {
        const link = node('a', 'Watch on Baseball Savant ↗', 'bv-clip');
        link.href = entry.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link);
      } else card.append(node('p', 'Awaiting a clip', 'bv-muted'));
      if (owner) {
        const actions = node('div', '', 'bv-actions');
        const edit = node('button', 'Edit'); edit.type = 'button'; edit.disabled = busy;
        edit.addEventListener('click', () => {
          if (dirty && !confirm('Discard the unsaved changes in the editor?')) return;
          editing = entry;
          for (const key of ['verb','url','announcer','notes']) form.elements[key].value = entry[key];
          dirty = false; $('bv-cancel').hidden = false;
          $('bv-editor-title').textContent = `Edit “${entry.verb}”`;
          form.elements.verb.focus();
        });
        const remove = node('button', 'Delete'); remove.type = 'button'; remove.disabled = busy;
        remove.addEventListener('click', async () => {
          if (busy || !confirm(`Delete “${entry.verb}” from the collection?`)) return;
          setBusy(true);
          try {
            await api('/api/delete', {id:entry.id, revision:entry.revision});
            entries = entries.filter(e => e.id !== entry.id);
            if (editing?.id === entry.id) reset();
            message('Word deleted.');
          } catch (error) { message(error.message); }
          finally { setBusy(false); }
        });
        actions.append(edit, remove); card.append(actions);
      }
      $('bv-results').append(card);
    }
    if (!shown.length) $('bv-results').append(node('p', entries.length ? 'No matching words. Try another search or filter.' : 'The collection is ready for its first word.'));
  }
  function setBusy(value) {
    busy = value;
    for (const el of form.elements) el.disabled = value;
    render();
  }
  form.addEventListener('input', () => { dirty = true; });
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
  $('bv-cancel').addEventListener('click', () => { if (!dirty || confirm('Discard unsaved changes?')) reset(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const body = Object.fromEntries(new FormData(form));
    body.url = body.url.trim();
    if (body.url && !safeURL(body.url)) { message('Use an HTTPS link on baseballsavant.mlb.com.'); return; }
    if (editing) { body.id = editing.id; body.revision = editing.revision; }
    setBusy(true);
    try {
      const saved = await api('/api/save', body);
      entries = entries.filter(e => e.id !== saved.id); entries.push(saved);
      reset(); message(`Saved “${saved.verb}”.`);
    } catch (error) { message(error.message); }
    finally { setBusy(false); }
  });
  filters.addEventListener('input', render);
  $('bv-export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({schema_version:1, entries}, null, 2) + '\n'], {type:'application/json'}));
    const a = node('a', ''); a.href = url; a.download = 'baseball-verbs.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  (async () => {
    try {
      let data;
      if (owner) data = await api('/api/data');
      else { const response = await fetch(root.dataset.source); if (!response.ok) throw new Error('The dictionary could not load. Please refresh to try again.'); data = await response.json(); }
      entries = data.entries;
      $('bv-owner').hidden = !owner; $('bv-export').disabled = false;
      message(owner ? 'Owner console connected. Add a word now and its clip whenever you find it.' : 'An ongoing search for every way to call contact.');
      render();
    } catch (error) { message(owner ? `${error.message} Reopen the complete owner URL printed in your terminal.` : error.message); }
  })();
})();
