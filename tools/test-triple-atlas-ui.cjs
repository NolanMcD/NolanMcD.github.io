// Real DOM integration tests. jsdom is a test-only dependency installed in a temp directory.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const snapshot = JSON.parse(read('assets/data/triple-atlas.json'));
const helpers = require('../assets/js/triple-atlas-explorer.js');
const settle = () => new Promise(resolve => setImmediate(resolve));

async function boot(t, query = '', options = {}) {
  const errors = [], requests = [], copied = [], data = structuredClone(options.data || snapshot);
  const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(read('pages/triple-atlas.html').split('---').slice(2).join('---'), {
    url: (options.owner ? 'http://127.0.0.1:8765' : 'https://noland.blog') + '/triple-atlas/' + query,
    runScripts: 'outside-only', virtualConsole: console,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  Object.defineProperty(w.navigator, 'clipboard', {value: {writeText: async value => {
    if (options.denyClipboard) throw new Error('Clipboard unavailable'); copied.push(value);
  }}});
  w.fetch = async (url, settings = {}) => {
    requests.push({url, settings});
    if (options.failLoad) return {ok: false, status: 503, json: async () => ({error: 'Catalog unavailable'})};
    if (url === '/api/save') {
      if (options.failSave) return {ok: false, status: 409, json: async () => ({error: 'Another tab saved first'})};
      const body = JSON.parse(settings.body);
      const play = data.plays.find(p => p.id === body.id);
      play.annotation = {...body.annotation, revision: play.annotation.revision + 1};
      return {ok: true, json: async () => structuredClone(play.annotation)};
    }
    return {ok: true, json: async () => structuredClone(data)};
  };
  w.eval(read('assets/js/triple-atlas-explorer.js'));
  w.eval(read('assets/js/triple-atlas.js'));
  await settle(); await settle();
  if (!options.failLoad) assert.doesNotMatch(w.document.querySelector('#ta-message').textContent, /Could not load/);
  const $ = selector => w.document.querySelector(selector);
  return {w, $, data, errors, requests, copied, options};
}

test('public bootstrap renders the actual template, dashboard and clips without owner controls', async t => {
  const app = await boot(t);
  assert.equal(app.$('#ta-explore').hidden, false);
  assert.equal(app.$('#ta-queue').hidden, true);
  assert.equal(app.$('#ta-tag-manager').hidden, true);
  assert.equal(app.w.document.querySelectorAll('.ta-rank-row').length, 16);
  assert.equal(app.w.document.querySelectorAll('#ta-months button').length, 7);
  assert.equal(app.w.document.querySelectorAll('.ta-card').length, 36);
  assert.ok(app.$('.ta-card-watch'));
  assert.match(app.$('#ta-count').textContent, new RegExp(String(snapshot.plays.length)));
  assert.equal(app.$('#ta-player').getAttribute('aria-busy'), 'false');
  assert.equal(app.$('#ta-edit'), null);
  assert.deepEqual(app.errors, []);
});

test('player and month clicks intersect, highlight, toggle off, and restore through browser Back', async t => {
  const app = await boot(t);
  const name = app.$('#ta-player-leaders button').dataset.value;
  app.$('#ta-player-leaders button').click();
  const form = app.$('#ta-filters');
  assert.equal(form.elements.player.value, name);
  assert.match(app.$('#ta-count').textContent, new RegExp('^' + snapshot.plays.filter(p => p.player === name).length + ' matching'));
  const month = [...app.w.document.querySelectorAll('#ta-months button')].find(button => Number(button.querySelector('strong').textContent) > 0);
  const value = month.dataset.value; month.click();
  assert.equal(form.elements.from.value, value + '-01');
  assert.equal(app.$(`#ta-months button[data-value="${value}"]`).getAttribute('aria-pressed'), 'true');
  assert.ok([...app.w.document.querySelectorAll('.ta-card .ta-meta')].every(el => el.textContent.startsWith(value)));
  const back = new Promise(resolve => app.w.addEventListener('popstate', resolve, {once: true}));
  app.w.history.back(); await back; await settle();
  assert.equal(form.elements.from.value, '');
  assert.equal(form.elements.player.value, name);
  app.$('#ta-player-leaders button').click();
  assert.equal(form.elements.player.value, '');
  assert.match(app.$('#ta-count').textContent, new RegExp('^' + snapshot.plays.length + ' matching'));
});

test('shared filters restore in the DOM and card links preserve every tag and ordering', async t => {
  const chosen = snapshot.plays.find(p => p.annotation.tags.length > 1);
  const options = {...helpers.readURL('https://noland.blog/triple-atlas/'), player: chosen.player, tags: chosen.annotation.tags, sort: 'oldest'};
  const url = helpers.writeURL('https://noland.blog/triple-atlas/', options, chosen.id);
  const app = await boot(t, url.search);
  assert.equal(app.$('#ta-filters').elements.player.value, chosen.player);
  assert.equal(app.w.document.querySelectorAll('[name=filter-tag]:checked').length, chosen.annotation.tags.length);
  assert.equal(app.$('#ta-filters').elements.sort.value, 'oldest');
  assert.equal(app.$('.ta-card h3 a').search.includes('sort=oldest'), true);
  assert.deepEqual(new URL(app.$('.ta-card h3 a').href).searchParams.getAll('tag'), chosen.annotation.tags);
  assert.match(app.$('#ta-player h2').textContent, new RegExp(chosen.player));
  await app.$('#ta-share').onclick();
  assert.equal(new URL(app.copied[0]).searchParams.has('play'), false);
  assert.equal(new URL(app.copied[0]).searchParams.get('player'), chosen.player);
});

test('surprise and another-play work when the entire public collection is already tagged', async t => {
  const name = helpers.rank(snapshot.plays, 'player')[0].label;
  const app = await boot(t, '?player=' + encodeURIComponent(name));
  const first = app.$('.ta-play-navigation a').href;
  assert.equal(app.$('#ta-surprise').disabled, false);
  await app.$('#ta-surprise').onclick();
  const second = app.$('.ta-play-navigation a').href;
  assert.notEqual(first, second);
  assert.equal(app.$('#ta-player h2').textContent, name);
  await app.$('#ta-public-next').onclick();
  assert.notEqual(app.$('.ta-play-navigation a').href, second);
  assert.equal(app.$('#ta-player h2').textContent, name);
  assert.deepEqual(app.errors, []);
});

test('empty filtered views recover through reset, and pagination adds real cards', async t => {
  const app = await boot(t, '?q=there-is-no-such-player-xyz');
  assert.equal(app.$('#ta-surprise').disabled, true);
  assert.match(app.$('#ta-message').textContent, /No plays match/);
  app.$('#ta-reset-explore').click();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(app.w.document.querySelectorAll('.ta-card').length, 36);
  app.$('#ta-more').click();
  assert.equal(app.w.document.querySelectorAll('.ta-card').length, 72);
  await app.$('#ta-surprise').onclick();
  assert.ok(app.$('#ta-player h2'));
});

test('clipboard denial exposes a selectable public link and never copies local owner credentials', async t => {
  const app = await boot(t, '#owner=test-secret', {owner: true, denyClipboard: true});
  await app.$('#ta-copy-play').onclick();
  assert.equal(app.$('#ta-share-fallback').hidden, false);
  assert.match(app.$('#ta-share-url').value, /^https:\/\/noland.blog\/triple-atlas\//);
  assert.equal(app.$('#ta-share-url').value.includes('test-secret'), false);
  assert.equal(app.w.location.hash, '');
  assert.equal(app.w.document.activeElement.id, 'ta-share-url');
});

test('owner filtering preserves the edit form and Save & next persists notes before advancing', async t => {
  const data = structuredClone(snapshot); data.plays.forEach(p => { p.annotation.status = 'unwatched'; });
  const app = await boot(t, '#owner=test-secret', {owner: true, data});
  const edit = app.$('#ta-edit'), before = app.$('.ta-play-navigation a').href;
  edit.elements.note.value = 'A note retained while exploring.';
  edit.dispatchEvent(new app.w.Event('input', {bubbles: true}));
  app.$('#ta-player-leaders button').click();
  assert.equal(app.$('#ta-edit'), edit);
  assert.equal(edit.elements.note.value, 'A note retained while exploring.');
  edit.dispatchEvent(new app.w.Event('submit', {cancelable: true, bubbles: true}));
  await settle(); await settle();
  const request = app.requests.find(r => r.url === '/api/save');
  assert.ok(request);
  const body = JSON.parse(request.settings.body);
  assert.equal(body.annotation.note, 'A note retained while exploring.');
  assert.equal(body.annotation.status, 'tagged');
  assert.notEqual(app.$('.ta-play-navigation a').href, before);
  assert.deepEqual(app.errors, []);
});

test('a conflicting owner save blocks surprise navigation and retains the device draft', async t => {
  const app = await boot(t, '#owner=test-secret', {owner: true, failSave: true});
  const before = app.$('.ta-play-navigation a').href;
  const id = new URL(before).searchParams.get('play');
  app.$('#ta-edit').elements.note.value = 'Keep this unsaved thought.';
  app.$('#ta-edit').dispatchEvent(new app.w.Event('input', {bubbles: true}));
  await app.$('#ta-surprise').onclick();
  assert.equal(app.$('.ta-play-navigation a').href, before);
  assert.match(app.$('#ta-message').textContent, /Your draft is retained/);
  assert.match(app.w.localStorage.getItem('tripleAtlas.draft.' + id), /Keep this unsaved thought/);
});

test('catalog text is escaped in rankings, tags and play details rather than interpreted as HTML', async t => {
  const data = structuredClone(snapshot);
  const text = '\"><img src=x onerror="alert(1)">';
  data.plays = [data.plays[0]];
  data.plays[0].player = text;
  data.plays[0].park = text;
  data.plays[0].annotation.note = text;
  data.tag_definitions = [{id: text, label: text}];
  data.plays[0].annotation.tags = [text];
  const app = await boot(t, '', {data});
  assert.equal(app.$('#ta-player h2').textContent, text);
  assert.equal(app.$('#ta-player-leaders button').dataset.value, text);
  assert.equal(app.$('#ta-tag-filters input').value, text);
  assert.equal(app.$('img'), null);
  assert.equal(app.$('[onerror]'), null);
  assert.deepEqual(app.errors, []);
});

test('a failed catalog request stops the loading state and offers a readable retry message', async t => {
  const app = await boot(t, '', {failLoad: true});
  assert.match(app.$('#ta-message').textContent, /Could not load.*Reload to retry/);
  assert.equal(app.$('#ta-player').getAttribute('aria-busy'), 'false');
  assert.equal(app.$('#ta-explore').hidden, true);
  assert.equal(app.$('#ta-surprise').disabled, true);
});
