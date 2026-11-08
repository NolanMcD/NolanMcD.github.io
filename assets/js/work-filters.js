(() => {
  'use strict';
  const stream = document.getElementById('archive-stream');
  const filters = document.querySelector('.work-filters');
  if (!stream || !filters) return;
  const cards = [...stream.querySelectorAll('[data-archive-type]')];
  const typeButtons = [...filters.querySelectorAll('[data-work-type]')];
  const topicButtons = [...filters.querySelectorAll('[data-work-topic]')];
  const topics = {film: ['movies', 'film', 'screenplays'], sports: ['sports', 'baseball', 'football'], weather: ['weather', 'miami'], code: ['code', 'data', 'math', 'architecture'], life: ['adventure', 'audio', 'language', 'education', 'career', 'interviews', 'internet', 'humor', 'meta']};
  const legacy = {'code,data,math': 'code', 'weather,miami': 'weather', movies: 'film', 'movies,writing': 'film', 'baseball,sports': 'sports', 'career,interviews,internet,humor,meta': 'life', 'career,interviews': 'life', 'adventure,audio,language': 'life'};
  function state() {
    let hash = '';
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) { /* Invalid legacy fragment defaults to all. */ }
    if (legacy[hash]) return {type: 'all', topic: legacy[hash]};
    const params = new URLSearchParams(hash);
    const type = params.get('type');
    const topic = params.get('topic');
    return {type: ['writing', 'project'].includes(type) ? type : 'all', topic: Object.hasOwn(topics, topic) ? topic : 'all'};
  }
  function apply() {
    const selected = state();
    let visible = 0;
    for (const card of cards) {
      const tags = card.dataset.archiveTags.split(/\s+/);
      card.hidden = !((selected.type === 'all' || card.dataset.archiveType === selected.type) &&
        (selected.topic === 'all' || topics[selected.topic].some(tag => tags.includes(tag))));
      if (!card.hidden) visible++;
    }
    for (const [buttons, key] of [[typeButtons, 'type'], [topicButtons, 'topic']]) {
      for (const button of buttons) {
        const active = button.dataset[key === 'type' ? 'workType' : 'workTopic'] === selected[key];
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
    }
    document.getElementById('archive-count').textContent = `${visible} ${visible === 1 ? 'entry' : 'entries'}`;
    document.getElementById('archive-empty').hidden = visible !== 0;
  }
  function select(changes) {
    const selected = {...state(), ...changes};
    const params = new URLSearchParams();
    if (selected.type !== 'all') params.set('type', selected.type);
    if (selected.topic !== 'all') params.set('topic', selected.topic);
    const hash = params.toString();
    if (location.hash.slice(1) !== hash) history.pushState(null, '', location.pathname + location.search + (hash ? '#' + hash : ''));
    apply();
  }
  typeButtons.forEach(button => button.addEventListener('click', () => select({type: button.dataset.workType})));
  topicButtons.forEach(button => button.addEventListener('click', () => select({topic: button.dataset.workTopic})));
  filters.querySelector('[data-work-reset]').addEventListener('click', () => select({type: 'all', topic: 'all'}));
  window.addEventListener('popstate', apply);
  window.addEventListener('hashchange', apply);
  filters.hidden = false;
  apply();
})();
