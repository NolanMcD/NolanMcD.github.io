// Exercise the real client bootstrap without a browser or third-party packages.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/triple-atlas.js'), 'utf8');

async function boot(fragment = '', saved = '') {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {hidden:true, textContent:'', attributes:{},
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; }, classList:{toggle() {}}});
    return elements.get(selector);
  };
  const root = {querySelector:element, dataset:{source:'/assets/data/triple-atlas.json'}};
  const location = {hostname:'127.0.0.1', origin:'http://127.0.0.1:8765', pathname:'/triple-atlas/', search:'', hash:fragment,
    href:'http://127.0.0.1:8765/triple-atlas/' + fragment, reloads:0, reload() { this.reloads++; }};
  const store = new Map(saved ? [['tripleAtlas.owner', saved]] : []);
  const events = {}, requests = [];
  const context = {URL, URLSearchParams, location,
    history:{replaceState(_, __, value) { const u = new URL(value, location.href); location.href = u.href; location.hash = u.hash; }},
    sessionStorage:{getItem:k => store.get(k), setItem:(k,v) => store.set(k,v), removeItem:k => store.delete(k)},
    document:{querySelector:() => root}, window:{addEventListener:(type, fn) => { events[type] = fn; }},
    FormData:class { constructor(form) { this.form = form; } get(k) { return this.form.values[k]; } },
    fetch:async (url, options) => { requests.push({url, options}); return {ok:false, status:401, json:async () => ({error:'Owner token required'})}; }
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return {element, location, events, requests, store};
}

test('an expired token offers reconnect and clears stale session credentials', async () => {
  const app = await boot('', 'expired');
  assert.equal(app.requests[0].options.headers.Authorization, 'Bearer expired');
  assert.equal(app.element('#ta-unlock').hidden, false);
  assert.match(app.element('#ta-message').textContent, /expired/);
  assert.equal(app.store.has('tripleAtlas.owner'), false);
  assert.equal(app.element('#ta-player').getAttribute('aria-busy'), 'false');
});

test('a new terminal token takes precedence over an old tab token', async () => {
  const app = await boot('#owner=fresh', 'expired');
  assert.equal(app.requests[0].options.headers.Authorization, 'Bearer fresh');
  assert.equal(app.location.hash, '');
});

test('opening a fresh owner fragment in the same tab reloads the client', async () => {
  const app = await boot('', 'expired');
  app.location.hash = '#owner=new-session';
  app.events.hashchange();
  assert.equal(app.location.reloads, 1);
  app.location.hash = '#ta-catalog';
  app.events.hashchange();
  assert.equal(app.location.reloads, 1);
});

test('a plain local address offers reconnect before fetching protected data', async () => {
  const app = await boot();
  assert.equal(app.requests.length, 0);
  assert.equal(app.element('#ta-unlock').hidden, false);
});

test('reconnect accepts a full local URL and rejects a different server', async () => {
  const app = await boot();
  const submit = value => app.element('#ta-unlock').onsubmit({preventDefault() {}, target:{values:{ownerUrl:value}}});
  submit('http://evil.example/triple-atlas/#owner=secret');
  assert.equal(app.location.reloads, 0);
  assert.match(app.element('#ta-unlock-error').textContent, /this server/);
  submit('http://127.0.0.1:8765/triple-atlas/#owner=new-session');
  assert.equal(app.location.hash, '#owner=new-session');
  assert.equal(app.location.reloads, 1);
});
