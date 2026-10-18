// Exercise real page script handlers without requiring a browser installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const filename of ['blanket_results.json','blanket_expanded.json']) {
const data = JSON.parse(fs.readFileSync(path.join(root, '_data',filename), 'utf8'));
const nodes = new Map();
const buttons = data.thresholds.map(row => ({
  dataset: {threshold: String(row.threshold)},
  attributes: {},
  classList: {toggle() {}},
  setAttribute(name, value) { this.attributes[name] = value; },
  closest() { return this; }
}));
for (const id of ['blanket-count','blanket-count-label','blanket-rate','blanket-lab-note']) nodes.set(id,{textContent:''});
nodes.set('blanket-results',{textContent:JSON.stringify(data)});
nodes.set('blanket-thresholds',{
  querySelectorAll: () => buttons,
  contains: button => buttons.includes(button),
  addEventListener(event,fn) {this[event] = fn;}
});
nodes.set('blanket-window',{value:'full',addEventListener(event,fn){this[event] = fn;}});
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/blanket.js'),'utf8'),{
  document:{getElementById: id => nodes.get(id)}
});
assert.equal(nodes.get('blanket-count').textContent,String(data.provisional_blankets));
assert.equal(nodes.get('blanket-count-label').textContent,'provisional Blankets');
for (const windowName of ['full','late']) {
  nodes.get('blanket-window').value = windowName;
  nodes.get('blanket-window').change();
  for (const row of data.thresholds) {
    const button = buttons.find(b => Number(b.dataset.threshold) === row.threshold);
    nodes.get('blanket-thresholds').click({target:button});
    const expected = windowName === 'full' ? row.count : row.late_count;
    assert.equal(nodes.get('blanket-count').textContent,expected.toLocaleString());
    assert.equal(nodes.get('blanket-rate').textContent,(100*expected/data.screened_reps).toFixed(2)+'%');
    assert.equal(button.attributes['aria-pressed'],'true');
    assert.equal(buttons.filter(b => b.attributes['aria-pressed']==='true').length,1);
    assert.equal(nodes.get('blanket-count-label').textContent,
      windowName==='full' && row.threshold===1 ? 'provisional Blankets' : 'pairings below selected threshold');
  }
}
assert.ok(nodes.get('blanket-lab-note').textContent.includes('not the proposed Blanket definition'));
assert.equal(data.screened_reps + Object.values(data.exclusions).reduce((a,b)=>a+b,0),data.candidate_reps);
assert.equal(data.histogram.reduce((a,b)=>a+b.count,0),data.screened_reps);
}
console.log('Passed: 28 explorer settings across both studies, definition labels, selected-button accessibility, and result reconciliation.');
