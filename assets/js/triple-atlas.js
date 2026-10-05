/* Shared read-only catalog and authenticated local owner console. No media requests. */
(() => {
  'use strict';
  const root = document.querySelector('#triple-atlas');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const explorer = globalThis.TripleAtlasExplorer;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const local = location.hostname === '127.0.0.1';
  const ownerHash = new URLSearchParams(location.hash.slice(1));
  let token = '', storageWorks = true;
  try {
    if (local && ownerHash.has('owner')) {
      sessionStorage.setItem('tripleAtlas.owner', ownerHash.get('owner'));
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (local) token = sessionStorage.getItem('tripleAtlas.owner') || '';
  } catch (_) { token = local ? ownerHash.get('owner') || '' : ''; storageWorks = false; }
  const owner = Boolean(token);
  // Opening a fresh terminal link in the same tab may change only the fragment.
  // Reload so the new token is consumed instead of continuing with the old one.
  window.addEventListener('hashchange', () => {
    if (local && new URLSearchParams(location.hash.slice(1)).has('owner')) location.reload();
  });
  function showUnlock(text) {
    $('#ta-mode').textContent = 'Owner console · Connection required';
    message(text, true);
    $('#ta-unlock').hidden = false;
    $('#ta-unlock').onsubmit = e => {
      e.preventDefault();
      try {
        const url = new URL(new FormData(e.target).get('ownerUrl').trim());
        if (url.origin !== location.origin || !new URLSearchParams(url.hash.slice(1)).get('owner')) {
          throw new Error('Paste the complete owner URL for this server, including #owner=.');
        }
        history.replaceState(null, '', url.href);
        location.reload();
      } catch (error) { $('#ta-unlock-error').textContent = error.message; }
    };
  }
  let data, groups, tagList, tagNames, current, dirty = false, timer, saving = null, editVersion = 0, blocked = false, limit = 36, advancing = false;
  const skipped = new Set();
  const draftKey = id => `tripleAtlas.draft.${id}`;
  function message(text, error = false) {
    $('#ta-message').textContent = text;
    $('#ta-message').classList.toggle('ta-error', error);
  }
  async function api(path, body) {
    const response = await fetch(path, { method:body ? 'POST' : 'GET', headers:{'Authorization':`Bearer ${token}`, 'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {}) });
    const value = await response.json();
    if (!response.ok) { const error = new Error(value.error || 'Request failed'); error.status = response.status; throw error; }
    return value;
  }
  function download(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function videoUrl(p) {
    return explorer.videoURL(p);
  }
  function videoLink(p) {
    const url = videoUrl(p);
    return url ? `<a class="ta-video" href="${esc(url)}" target="_blank" rel="noopener noreferrer">▶ Watch on Baseball Savant ↗</a>` : '<p><strong>Video link not yet matched.</strong> The owner can add a direct Savant link below.</p>';
  }
  function chip(t, selected, prefix, shortcuts = false) {
    return `<label class="ta-chip"><input type="checkbox" name="${prefix}" value="${esc(t.id)}" ${selected ? 'checked' : ''}>${esc(t.label)}${shortcuts && t.key ? ` <kbd>${esc(t.key)}</kbd>` : ''}</label>`;
  }
  function setTags(definitions) {
    tagList = [...definitions].sort((a,b) => a.label.localeCompare(b.label));
    tagNames = Object.fromEntries(tagList.map(t => [t.id,t.label]));
    groups = tagList.length ? [{label:'Your tags', tags:tagList}] : [];
    data.tag_definitions = tagList;
  }
  function tagOptions(selected) {
    return tagList.length ? `<div class="ta-chips">${tagList.map(t => chip(t,selected.includes(t.id),'tag',true)).join('')}</div>` : '<p class="ta-help">No tags yet. Create your first tag to start describing these plays your way.</p>';
  }
  function tagFilters() {
    const selected = new FormData($('#ta-filters')).getAll('filter-tag');
    $('#ta-tag-filters').innerHTML = `<legend>Tags · match every selected tag</legend><div class="ta-chips">${tagList.map(t => chip(t,selected.includes(t.id),'filter-tag')).join('')}</div>${tagList.length ? '' : '<p class="ta-help">No tags have been created or published yet.</p>'}`;
  }
  function renderTagManager() {
    $('#ta-manage-tags').innerHTML = tagList.length ? `<h3>Your tag collection</h3><p class="ta-help">Renaming a tag updates its name everywhere without changing saved selections.</p>${tagList.map(t => `<form class="ta-tag-form" data-tag-id="${esc(t.id)}"><label>Tag name<input name="label" value="${esc(t.label)}" maxlength="80" required></label><label>Shortcut<input name="key" value="${esc(t.key || '')}" maxlength="1" pattern="[A-Za-z0-9]"></label><button type="submit">Save changes</button></form>`).join('')}` : '<p class="ta-help">Your collection starts empty. No preset categories or tags.</p>';
  }
  async function submitTag(e) {
    e.preventDefault();
    const form = e.target, button = form.querySelector('button'), fields = new FormData(form);
    const old = tagList.find(t => t.id === form.dataset.tagId);
    button.disabled = true;
    try {
      const saved = await api('/api/tags', {label:fields.get('label'), key:fields.get('key'), ...(old ? {id:old.id,revision:old.revision} : {})});
      // Update just the tag controls. Never replace a note the owner is still typing.
      const selected = current && owner ? annotationFromForm().tags : [];
      setTags([...tagList.filter(t => t.id !== saved.id), saved]);
      if (current && owner) $('#ta-tag-options').innerHTML = tagOptions(selected);
      tagFilters(); renderCatalog(); renderTagManager();
      if (!old) form.reset();
      $('#ta-tag-message').textContent = old ? 'Tag updated everywhere. Saved selections are preserved.' : `Created “${saved.label}”. It’s ready to select on any play.`;
    } catch (error) { $('#ta-tag-message').textContent = error.message; }
    finally { button.disabled = false; }
  }
  function annotationFromForm() {
    const form = $('#ta-edit');
    if (!form || !current) return null;
    const fields = new FormData(form);
    return {...current.annotation, tags:fields.getAll('tag'), note:fields.get('note'), rating:fields.get('rating') ? Number(fields.get('rating')) : null,
      status:fields.get('status'), video_url: fields.get('video').trim() === current.video_url ? null : fields.get('video').trim()};
  }
  function retainDraft() {
    try { localStorage.setItem(draftKey(current.id), JSON.stringify({revision:current.annotation.revision, annotation:annotationFromForm()})); }
    catch (_) { storageWorks = false; }
  }
  function changed() {
    dirty = true; editVersion++; retainDraft(); clearTimeout(timer);
    message(storageWorks ? 'Draft kept on this device. Saving to disk…' : 'Saving to disk… Device draft storage is unavailable.');
    if (!blocked) timer = setTimeout(() => { save().catch(() => {}); }, 500);
  }
  async function save() {
    clearTimeout(timer);
    if (!owner || !current || !dirty) return;
    if (saving) { await saving; return save(); }
    if (blocked) throw new Error('Resolve the conflicting draft before saving.');
    const p = current, version = editVersion, annotation = annotationFromForm();
    saving = api('/api/save', {id:p.id, revision:p.annotation.revision, annotation}).then(saved => {
      p.annotation = saved;
      if (current.id === p.id) $('#ta-watch').innerHTML = videoLink(p);
      if (current.id === p.id) $('#ta-play-status').textContent = `Now watching · ${saved.status}`;
      if (version === editVersion) {
        dirty = false;
        try { localStorage.removeItem(draftKey(p.id)); } catch (_) { /* Disk save succeeded. */ }
      } else retainDraft();
      message('Saved to disk.' + (dirty ? ' Saving your latest changes…' : ''));
      renderCatalog();
    }).catch(error => {
      blocked = error.status === 409;
      message(`${error.message} Your draft is retained. Use “Export current draft” before reloading.`, true);
      throw error;
    }).finally(() => { saving = null; });
    await saving;
    if (dirty) return save();
  }
  async function select(p, updateUrl = true) {
    try { await save(); } catch (_) { return false; }
    current = p; blocked = false; dirty = false;
    if (updateUrl) history.pushState(null, '', explorer.writeURL(location.href, filterState(), p.id));
    renderPlayer();
    if (owner) {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey(p.id)) || 'null');
        if (draft) {
          fillForm(draft.annotation); dirty = true; editVersion++;
          if (draft.revision !== p.annotation.revision) { blocked = true; message('A recovered draft conflicts with a newer disk save. Export the draft, then reload after clearing this draft.', true); }
          else { message('Recovered your unsaved draft.'); timer = setTimeout(() => save().catch(() => {}), 500); }
        }
      } catch (_) { message('Device draft recovery unavailable. Disk saves still work.', true); }
    }
    return true;
  }
  function fillForm(a) {
    const form = $('#ta-edit');
    form.querySelectorAll('[name=tag]').forEach(input => { input.checked = a.tags.includes(input.value); });
    form.elements.note.value = a.note; form.elements.rating.value = a.rating ?? ''; form.elements.status.value = a.status;
    form.elements.video.value = a.video_url ?? current.video_url;
  }
  async function next(skip = false) {
    if (advancing) return;
    advancing = true;
    try {
    try { await save(); } catch (_) { return; }
    if (skip && current) skipped.add(current.id);
    const p = data.plays.find(p => p.annotation.status === 'unwatched' && !skipped.has(p.id) && p.id !== current?.id);
    if (p) { await select(p); $('#ta-player').scrollIntoView({block:'start'}); }
    else message(skipped.size ? 'Queue complete for this session. Use Unwatched queue to revisit skipped plays.' : 'You’ve reached the end of the unwatched queue. Browse the catalog to revisit a play.');
    } finally { advancing = false; }
  }
  function renderPlayer() {
    const p = current, a = p.annotation;
    document.title = `${p.player} · ${p.date} · Triple Atlas`;
    $('#ta-player').innerHTML = `<p id="ta-play-status" class="ta-eyebrow">Now watching · ${esc(a.status)}</p><h2 tabindex="-1">${esc(p.player)}</h2>
      <p class="ta-meta">${esc(p.date)} · ${esc(p.away_team)} at ${esc(p.home_team)} · ${esc(p.park)}</p>
      <p>${esc(p.description)}</p>
      <div id="ta-watch">${videoLink(p)}</div>
      <div class="ta-play-navigation"><a href="${esc(publicURL(p.id))}" target="_blank" rel="noopener">Shareable play link ↗</a><button id="ta-copy-play" type="button">Copy play link</button></div>
      <p class="ta-help">Game ${p.game_pk} · Plate appearance ${p.at_bat_number} · Pitch ${p.pitch_number}. Opens at the source; playback availability may vary.</p>
      ${owner ? `<form id="ta-edit"><fieldset><legend>Your tags <small>· choose any</small></legend><div id="ta-tag-options">${tagOptions(a.tags)}</div><button type="button" id="ta-new-tag">+ Create a tag</button></fieldset>
      <div class="ta-fields"><label class="ta-wide">Field notes<textarea name="note" maxlength="20000" placeholder="What made this one worth remembering?">${esc(a.note)}</textarea></label>
      <label>Enjoyment<select name="rating"><option value="">Unrated</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${a.rating === n ? 'selected' : ''}>${n} / 5</option>`).join('')}</select></label>
      <label>Status<select name="status">${['unwatched','tagged','review again'].map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="ta-wide">Add or correct the direct Savant video URL<input name="video" type="url" value="${esc(a.video_url ?? p.video_url)}" placeholder="https://baseballsavant.mlb.com/sporty-videos?playId=…"></label></div>
      <div class="ta-actions"><button type="submit" class="ta-primary">Save &amp; next</button><button type="button" id="ta-skip">Skip for now</button><button type="button" id="ta-review">Review again &amp; next</button></div>
      <p class="ta-help">Drafts autosave. Save &amp; next marks this play tagged. Ctrl/⌘ + Enter: save &amp; next. Alt + →: skip. Tag keys work outside text fields.</p>
      <details><summary>Draft recovery</summary><button type="button" id="ta-draft">Export current draft</button> <button type="button" id="ta-discard">Clear device draft &amp; reload saved play</button></details></form>` : `<p>${a.tags.map(t => `<span class="ta-badge">${esc(tagNames[t] || t)}</span>`).join('')}</p>${a.note ? `<p class="ta-note">${esc(a.note)}</p>` : ''}${a.rating ? `<p>Enjoyment: ${a.rating} / 5</p>` : ''}<button id="ta-public-next" type="button">Another from this view →</button>`}`;
    $('#ta-player').setAttribute('aria-busy', 'false');
    $('#ta-copy-play').onclick = () => copyLink(p.id);
    if (!owner) {
      $('#ta-public-next').onclick = surprise;
      $('#ta-public-next').disabled = !explorer.pick(filtered(), current.id, () => 0);
      return;
    }
    $('#ta-edit').addEventListener('input', changed);
    $('#ta-new-tag').onclick = () => { $('#ta-tag-manager').open = true; $('#ta-create-tag [name=label]').focus(); };
    $('#ta-edit').addEventListener('submit', async e => {
      e.preventDefault(); $('#ta-edit').elements.status.value = 'tagged'; changed(); await next();
    });
    $('#ta-skip').onclick = () => next(true);
    $('#ta-review').onclick = () => { $('#ta-edit').elements.status.value = 'review again'; changed(); next(); };
    $('#ta-draft').onclick = () => download({schema_version:1, tag_definitions:tagList, plays:[{...p, annotation:annotationFromForm()}]}, `triple-atlas-draft-${p.id}.json`);
    $('#ta-discard').onclick = () => {
      if (!confirm('Discard the device draft and reload the saved annotation? Export it first if you need it.')) return;
      clearTimeout(timer); try { localStorage.removeItem(draftKey(p.id)); } catch (_) { /* Reload disk state. */ } location.reload();
    };
  }
  function filterState() {
    const f = new FormData($('#ta-filters'));
    return {...Object.fromEntries(explorer.fields.map(key => [key, f.get(key) || ''])), tags: f.getAll('filter-tag')};
  }
  function restoreFilters() {
    const state = explorer.readURL(location.href), form = $('#ta-filters');
    for (const key of explorer.fields) form.elements[key].value = state[key];
    form.querySelectorAll('[name=filter-tag]').forEach(input => { input.checked = state.tags.includes(input.value); });
  }
  function filtered() {
    const state = filterState();
    return explorer.sort(explorer.filter(data.plays, state), state.sort);
  }
  function publicURL(play = '') {
    return explorer.writeURL('https://noland.blog/triple-atlas/', filterState(), play).href;
  }
  async function copyLink(play = '') {
    const url = publicURL(play);
    try {
      await navigator.clipboard.writeText(url);
      $('#ta-share-fallback').hidden = true;
      $('#ta-share-message').textContent = play ? 'Play link copied, including your filters.' : 'View link copied. Your filters will open with it.';
      message('Link copied.');
    } catch (_) {
      $('#ta-share-fallback').hidden = false;
      $('#ta-share-url').value = url;
      $('#ta-share-url').focus(); $('#ta-share-url').select();
      $('#ta-share-message').textContent = 'Select and copy the link below.';
      message('Your link is ready to copy above the catalog.');
    }
  }
  function updateFilters(push = false) {
    limit = 36;
    history[push ? 'pushState' : 'replaceState'](null, '', explorer.writeURL(location.href, filterState(), current?.id));
    $('#ta-share-fallback').hidden = true; $('#ta-share-message').textContent = '';
    renderCatalog();
    if (current) {
      const link = $('.ta-play-navigation a'); if (link) link.href = publicURL(current.id);
    }
  }
  function exploreFilter(key, value) {
    const form = $('#ta-filters');
    if (key === 'tag') {
      const input = [...form.querySelectorAll('[name=filter-tag]')].find(input => input.value === value);
      if (input) input.checked = !input.checked;
    } else if (key === 'month') {
      const month = explorer.months([], data.season).find(month => month.month === value);
      if (!month) return;
      const active = form.elements.from.value === month.from && form.elements.through.value === month.through;
      form.elements.from.value = active ? '' : month.from; form.elements.through.value = active ? '' : month.through;
    } else form.elements[key].value = form.elements[key].value === value ? '' : value;
    updateFilters(true);
  }
  async function surprise() {
    if (advancing) return;
    advancing = true;
    try {
      const play = explorer.pick(filtered(), current?.id);
      if (!play) { message('No other linked plays in this view. Try clearing a filter.'); return; }
      if (await select(play)) {
        renderCatalog();
        $('#ta-player').scrollIntoView({block: 'start'});
        $('#ta-player h2').focus({preventScroll: true});
        message(`A little three-base adventure: ${play.player}, ${play.date}.`);
      }
    } finally { advancing = false; }
  }
  function renderExploration(list) {
    const state = filterState(), stats = explorer.summarize(list);
    $('#ta-season-stats').innerHTML = [['Triples', stats.total], ['Players', stats.players], ['Ballparks', stats.parks], ['Video links', stats.linked]].map(([label, value]) => `<div><strong>${value.toLocaleString()}</strong><span>${label}</span></div>`).join('');
    $('#ta-explore-scope').textContent = `Showing ${list.length} of ${data.plays.length} cataloged triples. Totals and leaderboards follow your filters; choose a highlighted item again to remove it. These are catalog totals, not rates per game.`;
    for (const [key, target] of [['player', '#ta-player-leaders'], ['park', '#ta-park-leaders']]) {
      const ranking = explorer.rank(list, key), maximum = ranking[0]?.count || 1;
      $(target).innerHTML = ranking.slice(0, 8).map((row, i) => `<button type="button" class="ta-rank-row" data-explore="${key}" data-value="${esc(row.label)}" aria-pressed="${state[key] === row.label}"><meter min="0" max="${maximum}" value="${row.count}" aria-hidden="true"></meter><span><small>${i + 1}</small>${esc(row.label)}</span><strong>${row.count}</strong></button>`).join('') || '<p class="ta-help">No matching plays in this view.</p>';
    }
    // Ignore only the date filters here so the other months remain discoverable.
    const monthly = explorer.months(explorer.filter(data.plays, {...state, from: '', through: ''}), data.season);
    const maximum = Math.max(1, ...monthly.map(month => month.count));
    $('#ta-months').innerHTML = monthly.map(month => `<button type="button" data-explore="month" data-value="${month.month}" aria-pressed="${state.from === month.from && state.through === month.through}" aria-label="${new Date(month.from + 'T00:00:00Z').toLocaleDateString('en-US', {month: 'long', timeZone: 'UTC'})}: ${month.count} triples"><span>${new Date(month.from + 'T00:00:00Z').toLocaleDateString('en-US', {month: 'short', timeZone: 'UTC'})}</span><strong>${month.count}</strong><meter min="0" max="${maximum}" value="${month.count}" aria-hidden="true"></meter></button>`).join('');
    $('#ta-surprise').disabled = !explorer.pick(list, current?.id, () => 0);
    if ($('#ta-public-next')) $('#ta-public-next').disabled = $('#ta-surprise').disabled;
  }
  function renderCatalog() {
    const list = filtered(), tagged = data.plays.filter(p => p.annotation.status === 'tagged').length;
    const review = data.plays.filter(p => p.annotation.status === 'review again').length;
    $('#ta-progress').textContent = `${tagged} / ${data.plays.length} tagged · ${data.plays.length - tagged - review} unwatched · ${review} to review again`;
    $('#ta-meter').max = data.plays.length || 1; $('#ta-meter').value = tagged;
    const state = filterState();
    $('#ta-count').textContent = state.from && state.through && state.from > state.through ? 'The start date is after the end date. Adjust the date range to see plays.' : `${list.length} matching triples · showing ${Math.min(limit,list.length)}`;
    $('#ta-results').innerHTML = list.slice(0, limit).map(p => `<article class="ta-card${p.id === current?.id ? ' is-current' : ''}"><p class="ta-meta">${esc(p.date)}${owner ? ` · ${esc(p.annotation.status)}` : ''}</p><h3><a href="${esc(explorer.writeURL(location.href, state, p.id).href)}" data-play="${esc(p.id)}"${p.id === current?.id ? ' aria-current="true"' : ''}>${esc(p.player)}</a></h3><p>${esc(p.away_team)} at ${esc(p.home_team)}<br>${esc(p.park)}</p>${p.annotation.tags.map(t => `<span class="ta-badge">${esc(tagNames[t] || t)}</span>`).join('')}${p.annotation.rating ? `<p>Enjoyment ${p.annotation.rating} / 5</p>` : ''}${videoUrl(p) ? `<a class="ta-card-watch" href="${esc(videoUrl(p))}" target="_blank" rel="noopener noreferrer">Watch clip ↗</a>` : '<p class="ta-help">Awaiting a video link</p>'}</article>`).join('') || '<p>No triples match. Try clearing the filters.</p>';
    $('#ta-more').hidden = list.length <= limit;
    const counts = {}, pairs = {};
    list.forEach(p => {
      const tags = [...p.annotation.tags].sort();
      tags.forEach((t,i) => { counts[t] = (counts[t] || 0)+1; tags.slice(i+1).forEach(u => { const key = `${t}|${u}`; pairs[key] = (pairs[key] || 0)+1; }); });
    });
    $('#ta-tag-scope').textContent = `${list.filter(p => p.annotation.status === 'tagged').length} of ${list.length} matching plays tagged. Counts reflect ${owner ? 'your saved observations' : "Nolan’s published observations"}, not official scoring decisions. Select a tag below to filter the collection.`;
    const pairRows = Object.entries(pairs).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).map(([key,n]) => `<li><span>${key.split('|').map(t => esc(tagNames[t] || t)).join(' + ')}</span><strong>${n}</strong></li>`);
    $('#ta-counts').innerHTML = groups.map(g => `<div><h3>${owner ? 'Your tags' : 'What Nolan noticed'}</h3><ul>${[...g.tags].sort((a,b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.label.localeCompare(b.label)).map(t => `<li><button type="button" data-explore="tag" data-value="${esc(t.id)}" aria-pressed="${state.tags.includes(t.id)}"><span>${esc(t.label)}</span><strong>${counts[t.id] || 0}</strong></button></li>`).join('')}</ul></div>`).join('') +
      `<div><h3>Tag combinations</h3><p class="ta-help">Two observations on the same play.</p><ul>${pairRows.slice(0, 12).join('') || '<li>No combinations yet.</li>'}</ul>${pairRows.length > 12 ? `<details class="ta-more-pairs"><summary>See ${pairRows.length - 12} more combinations</summary><ul>${pairRows.slice(12).join('')}</ul></details>` : ''}</div>`;
    renderExploration(list);
  }
  async function start() {
    if (local && !owner) { showUnlock('Connect using the owner URL printed in your terminal.'); return; }
    data = owner ? await api('/api/data') : await fetch(root.dataset.source).then(r => { if (!r.ok) throw new Error('Catalog unavailable'); return r.json(); });
    data.plays.sort((a,b) => a.date.localeCompare(b.date) || a.game_pk-b.game_pk || a.at_bat_number-b.at_bat_number);
    setTags(data.tag_definitions || []);
    $('#ta-mode').textContent = owner ? 'Owner console · Annotations save to your local database.' : `Explore the ${data.season} collection · ${data.annotations_published ? 'With Nolan’s field notes' : 'Play metadata; field notes coming later'}`;
    $('#ta-queue').hidden = !owner; $('#ta-progress').hidden = !owner; $('#ta-meter').hidden = !owner;
    $('#ta-explore').hidden = false;
    $('.ta-import').hidden = !owner;
    $('#ta-tag-manager').hidden = !owner;
    if (owner) {
      renderTagManager();
      $('#ta-tag-manager').open = !tagList.length;
      $('#ta-create-tag').onsubmit = submitTag;
      $('#ta-manage-tags').addEventListener('submit', submitTag);
    }
    ['player','team','park'].forEach(key => {
      const select = $(`#ta-filters [name=${key}]`);
      [...new Set(data.plays.map(p => p[key]).filter(Boolean))].sort().forEach(value => select.add(new Option(value,value)));
    });
    tagFilters();
    restoreFilters();
    $('#ta-filters').oninput = () => updateFilters();
    $('#ta-filters').onsubmit = e => e.preventDefault();
    $('#ta-filters').onreset = () => setTimeout(() => updateFilters(true), 0);
    $('#ta-reset-explore').onclick = () => $('#ta-filters').reset();
    $('#ta-share').onclick = () => copyLink();
    $('#ta-surprise').onclick = surprise;
    root.addEventListener('click', e => {
      const button = e.target.closest('[data-explore]');
      if (button) exploreFilter(button.dataset.explore, button.dataset.value);
    });
    $('#ta-more').onclick = () => { limit += 36; renderCatalog(); };
    $('#ta-results').onclick = async e => {
      const link = e.target.closest('[data-play]'); if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); if (await select(data.plays.find(p => p.id === link.dataset.play))) {
        renderCatalog(); $('#ta-player').scrollIntoView({block:'start'}); $('#ta-player h2').focus({preventScroll:true});
      }
    };
    $('#ta-queue').onclick = async () => {
      try { await save(); } catch (_) { return; }
      skipped.clear(); const p = data.plays.find(p => p.annotation.status === 'unwatched');
      if (p) { await select(p); $('#ta-player').scrollIntoView({block:'start'}); } else message('All triples have been watched. Filter by “review again” to revisit those plays.');
    };
    $('#ta-export').onclick = async () => {
      try { await save(); download(owner ? await api('/api/data') : data, 'triple-atlas-annotations.json'); }
      catch (_) { message('Save could not finish. Export the current draft from Draft recovery first.', true); }
    };
    $('#ta-import').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        await save(); if (file.size > 10_000_000) throw new Error('File must be under 10 MB');
        const document = JSON.parse(await file.text());
        if (!confirm('Merge annotations by play ID, replacing annotations for matching plays? A backup is saved first.')) return;
        const result = await api('/api/restore',document); message(`Restored ${result.restored} annotations.`); location.reload();
      } catch (error) { message(error.message,true); } finally { e.target.value = ''; }
    };
    const report = data.import_info?.last_import ? JSON.parse(data.import_info.last_import) : null;
    $('#ta-import-info').textContent = report ? `Last import: ${report.imported_at.slice(0,10)} · ${report.imported} source plays · ${report.unresolved} links unresolved. Matched links do not guarantee playback.` : 'No source import yet.';
    const dates = data.plays.map(p => p.date).sort();
    $('#ta-snapshot').textContent = dates.length ? `${data.season} regular-season snapshot · ${dates[0]} through ${dates[dates.length - 1]} · Counts cover the imported collection, not a live feed or a guaranteed complete season.` : 'The season explorer will fill in as plays are imported.';
    renderCatalog();
    const requested = new URL(location.href).searchParams.get('play');
    const selected = data.plays.find(p => p.id === requested) || (owner ? data.plays.find(p => p.annotation.status === 'unwatched') : null) || filtered()[0];
    if (selected) { message('Choose a play, explore a player or park, or let the atlas surprise you.'); await select(selected,false); renderCatalog(); if (requested && requested !== selected.id) message('That play was not found in this snapshot. Showing the next available triple.',true); }
    else {
      $('#ta-player').setAttribute('aria-busy', 'false');
      message(data.plays.length ? 'No plays match this view. Clear or adjust the filters to explore.' : owner ? 'No triples imported yet. Run python tools/triple-atlas.py import, then reload.' : 'The first collection of triples is on its way.');
    }
    window.addEventListener('popstate', async () => {
      try { await save(); } catch (_) { history.replaceState(null, '', explorer.writeURL(location.href, filterState(), current?.id)); return; }
      restoreFilters(); limit = 36;
      const p = data.plays.find(p => p.id === new URL(location.href).searchParams.get('play')) || filtered()[0];
      if (p && p.id !== current?.id) await select(p, false);
      renderCatalog();
    });
    window.addEventListener('beforeunload', e => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) { retainDraft(); save().catch(() => {}); } });
    document.addEventListener('keydown', e => {
      if (!owner || !current || e.repeat) return;
      if (e.target.closest('#ta-tag-manager')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#ta-edit').requestSubmit(); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); next(true); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches('textarea, select, input:not([type=checkbox]):not([type=radio])') || e.target.isContentEditable) return;
      const t = tagList.find(t => t.key && t.key === e.key.toLowerCase());
      if (t) { e.preventDefault(); const input = [...$('#ta-edit').querySelectorAll('[name=tag]')].find(i => i.value === t.id); input.checked = !input.checked; changed(); }
    });
  }
  start().catch(error => {
    $('#ta-player').setAttribute('aria-busy', 'false');
    if (local && error.status === 401) {
      try { sessionStorage.removeItem('tripleAtlas.owner'); } catch (_) { /* Recovery also works without storage. */ }
      showUnlock('This tab’s owner connection expired. Paste the latest terminal URL below to reconnect. Your saved tags and notes are safe.');
    } else message(`Could not load Triple Atlas: ${error.message}. Reload to retry.`,true);
  });
})();
