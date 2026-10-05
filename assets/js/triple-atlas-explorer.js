/* Catalog exploration helpers shared by the browser and regression tests. */
(() => {
  'use strict';
  const fields = ['search', 'player', 'team', 'park', 'from', 'through', 'status', 'rating', 'video', 'sort'];
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  function videoURL(play) {
    const value = play.annotation.video_url ?? play.video_url;
    return /^https:\/\/baseballsavant\.mlb\.com\/sporty-videos\?playId=[a-zA-Z0-9-]+$/.test(value) ? value : '';
  }
  function readURL(value) {
    const params = new URL(value).searchParams;
    const state = Object.fromEntries(fields.map(key => [key, params.get(key === 'search' ? 'q' : key) || '']));
    state.tags = [...new Set(params.getAll('tag'))];
    for (const key of ['from', 'through']) if (!validDate(state[key])) state[key] = '';
    if (!['', 'unwatched', 'tagged', 'review again'].includes(state.status)) state.status = '';
    if (!['', '0', '1', '2', '3', '4', '5'].includes(state.rating)) state.rating = '';
    if (!['', 'linked', 'missing'].includes(state.video)) state.video = '';
    if (!['oldest', 'newest', 'player', 'rating'].includes(state.sort)) state.sort = 'newest';
    return state;
  }
  function writeURL(base, state, play = '') {
    // Rebuild from known fields so private owner credentials never enter shared links.
    const url = new URL(base); url.search = ''; url.hash = '';
    for (const key of fields) {
      const value = state[key];
      if (value && !(key === 'sort' && value === 'newest')) url.searchParams.set(key === 'search' ? 'q' : key, value);
    }
    for (const tag of [...new Set(state.tags || [])]) url.searchParams.append('tag', tag);
    if (play) url.searchParams.set('play', play);
    return url;
  }
  function filter(plays, state) {
    const query = (state.search || '').trim().toLocaleLowerCase();
    return plays.filter(p => {
      const a = p.annotation;
      return (!query || `${p.player} ${p.description} ${a.note || ''}`.toLocaleLowerCase().includes(query)) &&
        ['player', 'team', 'park'].every(key => !state[key] || p[key] === state[key]) &&
        (!state.from || p.date >= state.from) && (!state.through || p.date <= state.through) &&
        (!state.status || a.status === state.status) && (!state.rating || (a.rating ?? 0) === Number(state.rating)) &&
        (!state.video || Boolean(videoURL(p)) === (state.video === 'linked')) &&
        (state.tags || []).every(tag => a.tags.includes(tag));
    });
  }
  function sort(plays, order = 'newest') {
    const chronological = (a, b) => a.date.localeCompare(b.date) || a.game_pk - b.game_pk || a.at_bat_number - b.at_bat_number || a.id.localeCompare(b.id);
    return [...plays].sort((a, b) => {
      if (order === 'player') return a.player.localeCompare(b.player) || -chronological(a, b);
      if (order === 'rating') return (b.annotation.rating || 0) - (a.annotation.rating || 0) || -chronological(a, b);
      return order === 'oldest' ? chronological(a, b) : -chronological(a, b);
    });
  }
  function rank(plays, key) {
    const counts = new Map();
    for (const play of plays) if (play[key]) counts.set(play[key], (counts.get(play[key]) || 0) + 1);
    return [...counts].map(([label, count]) => ({label, count})).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
  function summarize(plays) {
    return {total: plays.length, players: new Set(plays.map(p => p.batter_id)).size,
      parks: new Set(plays.map(p => p.park).filter(Boolean)).size, linked: plays.filter(p => videoURL(p)).length,
      tagged: plays.filter(p => p.annotation.status === 'tagged').length};
  }
  function months(plays, season) {
    const counts = new Map();
    for (const play of plays) {
      const month = play.date.slice(0, 7);
      counts.set(month, (counts.get(month) || 0) + 1);
    }
    return Array.from({length: 7}, (_, index) => {
      const month = `${season}-${String(index + 3).padStart(2, '0')}`;
      const last = new Date(Date.UTC(Number(season), index + 3, 0)).getUTCDate();
      return {month, count: counts.get(month) || 0, from: month + '-01', through: month + '-' + last};
    });
  }
  function pick(plays, currentId, random = Math.random) {
    const candidates = plays.filter(p => videoURL(p) && p.id !== currentId);
    return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
  }
  const api = {fields, validDate, videoURL, readURL, writeURL, filter, sort, rank, summarize, months, pick};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.TripleAtlasExplorer = api;
})();
