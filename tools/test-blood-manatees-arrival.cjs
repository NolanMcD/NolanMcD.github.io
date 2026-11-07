const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function node() {
  return {hidden: true, textContent: '', innerHTML: '', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; }};
}
function mount() {
  const screen = node(), heading = node(), terminal = node(), ending = node();
  screen.querySelector = selector => { assert.equal(selector, 'h2'); return heading; };
  const views = ['corridor', 'desk', 'baggage', 'exit'].map(name => Object.assign(node(), {dataset: {arrivalView: name}}));
  const label = node(), note = node(), status = node(), description = node();
  const root = {
    querySelector(selector) { return {
      '[data-arrival-screen]': screen, '[data-arrival-terminal]': terminal,
      '[data-arrival-camera]': label, '[data-arrival-feed-note]': note,
      '[data-arrival-case-status]': status, '#arrival-feed-description': description
    }[selector]; },
    querySelectorAll() { return views; },
    contains(control) { return !control.outside; },
    addEventListener(type, callback) { this[type] = callback; }
  };
  const document = {querySelector(selector) { return selector === '[data-bm-arrival]' ? root : ending; }};
  vm.runInNewContext(fs.readFileSync('assets/js/blood-manatees-arrival.js', 'utf8'), {document});
  const click = (action, outside = false) => root.click({target: {closest: () => ({dataset: {arrivalAction: action}, outside})}});
  const activeView = () => views.filter(view => !Object.hasOwn(view.attributes, 'hidden')).map(view => view.dataset.arrivalView);
  return {screen, terminal, ending, heading, status, note, description, click, activeView};
}
const scene = mount();
assert.equal(scene.terminal.hidden, false);
assert.deepEqual(scene.activeView(), ['corridor']);
assert.match(scene.screen.innerHTML, /Arrival record located/);
assert.equal(scene.heading.focused, undefined);
scene.click('release'); // The ending cannot be revealed before the desk review.
assert.equal(scene.ending.hidden, true);
scene.click('next', true);
assert.deepEqual(scene.activeView(), ['corridor']);
scene.click('next');
assert.deepEqual(scene.activeView(), ['desk']);
assert.match(scene.screen.innerHTML, /No booking attached/);
assert.match(scene.screen.innerHTML, /Holiday/);
assert.equal(scene.heading.focused, true);
scene.click('next');
assert.match(scene.screen.innerHTML, /Position eliminated/);
assert.match(scene.screen.innerHTML, /Personnel · Finance · Compliance/);
scene.click('next');
assert.deepEqual(scene.activeView(), ['baggage']);
assert.match(scene.screen.innerHTML, /two laptops/);
assert.match(scene.screen.innerHTML, /Two baseball bats/);
assert.match(scene.screen.innerHTML, /glass marbles/);
assert.equal(scene.ending.hidden, true);
scene.click('next');
assert.match(scene.screen.innerHTML, /No further questions/);
scene.click('next'); // Cannot advance the disposition with a stale earlier action.
assert.equal(scene.ending.hidden, true);
scene.click('release');
assert.deepEqual(scene.activeView(), ['exit']);
assert.match(scene.screen.innerHTML, /OBSERVATION CONTINUES/);
assert.equal(scene.status.textContent, 'ARRIVAL CLOSED');
assert.equal(scene.ending.hidden, false);
assert.equal(scene.ending.focused, true);
assert.equal(scene.ending.scrolled, true);
assert.equal(scene.description.textContent, scene.note.textContent);
scene.click('restart');
assert.deepEqual(scene.activeView(), ['corridor']);
assert.equal(scene.ending.hidden, true);
assert.match(scene.screen.innerHTML, /Arrival record located/);

// Loading the script on other pages must not affect them.
vm.runInNewContext(fs.readFileSync('assets/js/blood-manatees-arrival.js', 'utf8'), {
  document: {querySelector: () => null}
});
const source = fs.readFileSync('_blood_manatees/7.md', 'utf8');
assert.match(source, /scene_number: 7/);
assert.match(source, /Read the complete scene without operating/);
assert.match(source, /OBSERVATION CONTINUES/);
assert.ok(!/fetch\(|localStorage|sessionStorage|XMLHttpRequest/.test(fs.readFileSync('assets/js/blood-manatees-arrival.js', 'utf8')));
console.log('Miami arrival sequence, synchronized camera views, disclosure gates, replay, and noninteractive transcript passed.');
