const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function control(dataset = {}) {
  return {dataset, hidden: false, attributes: {}, classList: {toggle() {}},
    addEventListener(type, fn) { this[type] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; }};
}
function mount(hash = '') {
  const cards = [control({archiveType: 'writing', archiveTags: 'movies data'}), control({archiveType: 'writing', archiveTags: 'weather miami'}), control({archiveType: 'project', archiveTags: 'sports baseball data'}), control({archiveType: 'project', archiveTags: 'movies writing interactive'})];
  const types = ['all', 'writing', 'project'].map(workType => control({workType}));
  const topics = ['all', 'film', 'sports', 'weather', 'code', 'life'].map(workTopic => control({workTopic}));
  const reset = control(), count = {}, empty = {};
  const filters = {hidden: true, querySelectorAll(selector) { return selector === '[data-work-type]' ? types : topics; }, querySelector() { return reset; }};
  const location = {hash, pathname: '/projects/', search: ''};
  const history = {pushState(a, b, url) { location.hash = new URL(url, 'https://example.test').hash; }};
  const events = {};
  const document = {getElementById(id) { return {'archive-stream': {querySelectorAll() { return cards; }}, 'archive-count': count, 'archive-empty': empty}[id]; }, querySelector() { return filters; }};
  vm.runInNewContext(fs.readFileSync('assets/js/work-filters.js', 'utf8'), {document, location, history, URLSearchParams, window: {addEventListener(type, fn) { events[type] = fn; }}});
  return {cards, types, topics, reset, count, empty, filters, location, events, visible: () => cards.filter(c => !c.hidden)};
}
const page = mount();
assert.equal(page.visible().length, 4);
assert.equal(page.filters.hidden, false);
page.types[1].click();
assert.equal(page.visible().length, 2);
page.topics[1].click();
assert.equal(page.visible().length, 1);
assert.equal(page.count.textContent, '1 entry');
assert.match(page.location.hash, /type=writing/);
assert.match(page.location.hash, /topic=film/);
assert.equal(page.topics[1].attributes['aria-pressed'], 'true');
page.topics[2].click();
assert.equal(page.empty.hidden, false);
page.reset.click();
assert.equal(page.visible().length, 4);
assert.equal(page.location.hash, '');
page.location.hash = '#type=project&topic=sports';
page.events.popstate();
assert.equal(page.visible().length, 1);
assert.equal(page.visible()[0].dataset.archiveType, 'project');
assert.equal(mount('#movies').visible().length, 2);
assert.equal(mount('#code,data,math').visible().length, 2);
assert.equal(mount('#%E0%A4%A').visible().length, 4);
assert.equal(mount('#type=unknown&topic=unknown').visible().length, 4);
console.log('Combined format/topic filters, shared URLs, Back, reset, empty states, and legacy fragments passed.');
