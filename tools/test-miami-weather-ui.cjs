const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/miami-weather.js'), 'utf8');
function run(now, reportDate) {
  const warning = {hidden: true, textContent: ''};
  const element = {dataset: {weatherDate: reportDate}, querySelector: () => warning};
  class Clock extends Date {constructor() {super(now);}}
  vm.runInNewContext(source, {Intl, Date: Clock, document: {querySelectorAll: () => [element]}, setInterval: () => {}});
  return warning;
}
test('the stale label uses the Eastern date before UTC midnight rollover', () => {
  assert.equal(run('2026-07-02T02:00:00Z', '2026-07-01').hidden, true);
  assert.equal(run('2026-07-02T04:01:00Z', '2026-07-01').hidden, false);
});
test('winter midnight follows EST and older dates stay explicit', () => {
  assert.equal(run('2026-01-02T04:59:00Z', '2026-01-01').hidden, true);
  const stale = run('2026-01-02T05:00:00Z', '2026-01-01');
  assert.equal(stale.hidden, false);
  assert.match(stale.textContent, /Archived report from 2026-01-01/);
});
