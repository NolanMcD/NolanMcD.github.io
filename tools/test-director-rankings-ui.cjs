const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rootPath = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(rootPath, '_data/director_rankings.json'), 'utf8'));

// Exercise the actual browser script with the DOM operations it uses.
function mount(query = '') {
  const cards = data.directors.map(d => ({
    dataset: {name: d.name, total: String(d.total), average: String(d.average), totalRank: String(d.totalRank), averageRank: String(d.averageRank)},
    rank: {textContent: String(d.totalRank)},
    bar: {style: {}},
    querySelector(selector) { return selector === '.dr-rank' ? this.rank : this.bar; }
  }));
  const list = {children: [...cards], appendChild(card) { this.children.splice(this.children.indexOf(card), 1); this.children.push(card); }};
  const buttons = ['total', 'average'].map(mode => ({
    dataset: {directorSort: mode}, attributes: {},
    addEventListener(type, callback) { this[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; }
  }));
  const toolbar = {hidden: true};
  const status = {textContent: ''};
  const image = {complete: true, naturalWidth: 0, hidden: false, addEventListener() {}};
  const root = {dataset: {}, querySelector(selector) {
    return {'.dr-list': list, '.dr-toolbar': toolbar, '.dr-status': status}[selector];
  }, querySelectorAll(selector) { return selector === 'img' ? [image] : buttons; }};
  const window = {location: {href: 'https://example.test/post/' + query, search: query}, history: {replaceState(a, b, url) { window.location.href = String(url); }}};
  vm.runInNewContext(fs.readFileSync(path.join(rootPath, 'assets/js/director-rankings.js'), 'utf8'), {
    document: {querySelector: () => root}, window, URL, URLSearchParams
  });
  return {cards, list, buttons, root, toolbar, image, status, window};
}

const ui = mount();
assert.equal(ui.list.children[0].dataset.name, 'Steven Spielberg');
assert.equal(ui.toolbar.hidden, false);
assert.equal(ui.image.hidden, true);
ui.buttons[1].click();
assert.equal(ui.list.children[0].dataset.name, 'Christopher Nolan');
assert.equal(ui.list.children[1].dataset.name, 'Stanley Kubrick');
assert.equal(ui.list.children[0].bar.style.width, '100%');
assert.equal(ui.list.children[2].rank.textContent, '3');
assert.equal(ui.list.children[3].rank.textContent, '3');
assert.equal(ui.buttons[1].attributes['aria-pressed'], 'true');
assert.match(ui.window.location.href, /rank=average/);
assert.match(ui.status.textContent, /average rating/);
ui.buttons[0].click();
assert.equal(ui.list.children[0].dataset.name, 'Steven Spielberg');
assert.equal(new URL(ui.window.location.href).search, '');
assert.equal(new Set(ui.list.children).size, 18);
assert.ok(ui.list.children.every(card => ui.cards.includes(card)));
assert.equal(mount('?rank=average').list.children[0].dataset.name, 'Christopher Nolan');
assert.equal(mount('?rank=invalid').list.children[0].dataset.name, 'Steven Spielberg');
console.log('Director sort, tied ranks, share links, accessibility state, and image fallback passed.');
