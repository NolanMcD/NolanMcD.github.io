// Story flow checks without browser dependencies. Run: node tools/test-blood-manatees-airport.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  return {
    innerHTML: '', textContent: '', disabled: false, hidden: true,
    dataset: {}, listeners: {}, classList: { add() {} },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    querySelector() { return { focus() {} }; },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
    showModal() { this.open = true; }, close() { this.open = false; }
  };
}
function terminal(embedded = true) {
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const timers = new Map();
  const messages = [];
  const window = {
    location: { search: '?story=blood-manatees', origin: 'https://noland.blog', assign(url) { this.assigned = url; } },
    setTimeout(fn) { timers.set(1, fn); return 1; }, clearTimeout(id) { timers.delete(id); },
    addEventListener() {}
  };
  window.parent = embedded ? { postMessage(data, origin) { messages.push({ data, origin }); } } : window;
  const document = { getElementById: node, querySelector: node, body: element() };
  vm.runInNewContext(fs.readFileSync('assets/js/blood-manatees-airport.js', 'utf8'), { window, document, URLSearchParams });
  const click = data => node('screen').listeners.click({ target: { closest: () => ({ dataset: data, disabled: false }) } });
  return { node, timers, messages, window, click, next: () => node('continue').onclick() };
}
function buy(t) {
  t.click({ storyAction: 'next' });
  assert.match(t.node('screen').innerHTML, /passport/);
  t.next(); // Identification cannot be skipped with Continue.
  assert.match(t.node('screen').innerHTML, /passport/);
  t.click({ storyAction: 'scan' });
  assert.match(t.node('screen').innerHTML, /VEHICLE RECORD MATCHED/);
  t.next();
  t.click({ storySeat: '32C' });
  t.next();
  t.click({ storyBags: '2' });
  t.node('back').onclick();
  assert.match(t.node('screen').innerHTML, /32C.*?aria-pressed="true"/);
  t.next(); t.next();
  assert.match(t.node('screen').innerHTML, /WALKER \/ EWEN/);
  assert.match(t.node('screen').innerHTML, /Seat 32C · 2 checked bags/);
  t.next();
  assert.equal(t.node('continue').disabled, true);
  assert.match(t.node('screen').innerHTML, /Issuing your ticket/);
  t.timers.get(1)();
  assert.match(t.node('screen').innerHTML, /SHANNON → MIAMI/);
  assert.match(t.node('screen').innerHTML, /<b>32C<\/b>/);
  t.click({ storyAction: 'collect' });
}
const embedded = terminal();
assert.match(embedded.node('screen').innerHTML, /Good morning, Ewen/);
buy(embedded);
assert.equal(embedded.messages.length, 1);
assert.equal(embedded.messages[0].data.type, 'blood-manatees:ticket-collected');
assert.equal(embedded.messages[0].origin, 'https://noland.blog');
const standalone = terminal(false);
buy(standalone);
assert.equal(standalone.window.location.assigned, '../blood-manatees/scene/6/#airport-ending');

const cancelled = terminal();
cancelled.next(); cancelled.click({ storyAction: 'scan' }); cancelled.next();
cancelled.click({ storySeat: '33A' });
cancelled.node('cancel').onclick();
assert.equal(cancelled.node('dialog').open, true);
cancelled.node('dialog-actions').listeners.click({ target: { closest: () => ({ dataset: { storyAction: 'reset' } }) } });
assert.match(cancelled.node('screen').innerHTML, /Good morning, Ewen/);
assert.equal(cancelled.node('dialog').open, false);

// Original training script must yield to story mode before touching the DOM.
vm.runInNewContext(fs.readFileSync('assets/js/airport-check-in.js', 'utf8'), {
  window: { location: { search: '?story=blood-manatees' } }, URLSearchParams,
  document: { getElementById() { throw new Error('Training flow leaked into story mode'); } }
});

// Only the embedded same-origin terminal may reveal the scene ending.
const ending = element(), frame = { contentWindow: {} }, handlers = {};
const scene = { dataset: {}, querySelector(selector) {
  return selector === '[data-bm-airport]' ? frame : selector === '[data-bm-airport-ending]' ? ending : null;
} };
vm.runInNewContext(fs.readFileSync('assets/js/blood-manatees.js', 'utf8'), {
  document: { querySelector(selector) { return selector === '[data-bm-scene]' ? scene : null; }, addEventListener() {} },
  window: { location: { origin: 'https://noland.blog', hash: '' }, matchMedia() { return { matches: true }; }, addEventListener(type, fn) { handlers[type] = fn; } }
});
const message = { origin: 'https://noland.blog', source: frame.contentWindow, data: { type: 'blood-manatees:ticket-collected' } };
handlers.message({ ...message, origin: 'https://elsewhere.example' });
assert.equal(ending.hidden, true);
handlers.message({ ...message, source: {} });
assert.equal(ending.hidden, true);
handlers.message(message);
assert.equal(ending.hidden, false);
assert.equal(ending.focused, true);
assert.equal(ending.scrolled, true);
console.log('Blood Manatees airport flow, cancellation, standalone return, and message boundaries passed.');
