// Development-only regression checks. Run: node tools/test-application-event-lab.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/application-event-engine.js'), 'utf8'), context);
const Lab = context.ApplicationEventLab;
const m = new Lab();
const initial = JSON.stringify(m.db);
const normal = m.create();
assert.equal(m.receive(normal), 'queued');
assert.equal(m.db.version, 0, 'acknowledgement must precede background effects');
assert.equal(m.events.size, 1);
assert.equal(m.health.queue, 1);
assert.equal(m.work().result, 'processed');
assert.equal(m.client.version, 0, 'commit is independent of notifications');
assert.equal(m.outbox[0].published, false);
m.publish(); assert.equal(m.client.version, 1);
assert.equal(m.receive({ ...normal, deliveryAttempt: 2 }), 'duplicate');
assert.equal(m.work(), null); assert.equal(m.db.version, 1);
const bad = m.create(); bad.signatureStatus = 'invalid (simulated)';
assert.equal(m.receive(bad), 'invalid');
assert.equal(m.events.has(bad.eventId), false); assert.equal(m.db.version, 1);
const old = m.create('application.status_changed', 2);
const newer = m.create('application.status_changed', 3);
m.receive(newer); m.work(); m.receive(old);
assert.equal(m.work().result, 'older'); assert.equal(m.db.status, 3);
assert.equal(m.db.version, 2);
const failing = m.create('application.status_changed', 4);
m.receive(failing); assert.equal(m.work(true).result, 'failed');
assert.equal(m.health.failed, 1); assert.equal(m.health.queue, 1);
assert.equal(m.db.version, 2);
assert.equal(m.receive({ ...failing, deliveryAttempt: 2 }), 'duplicate');
const received = m.health.received;
assert.equal(m.retry(), true); assert.equal(m.work().result, 'processed');
assert.equal(m.health.received, received, 'worker retry is not a new webhook');
assert.equal(m.db.version, 3); assert.equal(m.retry(), false);
assert.equal(m.health.queue, 0);
m.publish(); m.connect(false);
const final = m.create('application.status_changed', 5);
m.receive(final); m.work(); m.publish();
assert.equal(m.client.version, 3); assert.equal(m.db.version, 4);
m.connect(true); assert.equal(JSON.stringify(m.client), JSON.stringify(m.db));
m.reset(); assert.equal(JSON.stringify(m.db), initial);
assert.equal(m.events.size, 0); assert.equal(m.jobs.length, 0);
assert.equal(m.outbox.length, 0); assert.equal(m.log.length, 0);
assert.equal(m.health.received, 0); assert.equal(m.connected, true);
assert.equal(m.create().eventId, normal.eventId, 'reset is reproducible');
// Every supported event is independently processable with customer-safe copy.
for (const type of Lab.types) {
  const lab = new Lab(); lab.receive(lab.create(type)); lab.work(); lab.publish();
  assert.equal(lab.db.version, 1); assert.ok(lab.client.message);
}
// Duplicate delivery while work is pending cannot create a second job.
const pending = new Lab(), event = pending.create();
pending.receive(event); pending.receive(event);
assert.equal(pending.jobs.length, 1);
// A failed older job retried after a newer commit cannot roll back state.
pending.work(true); pending.receive(pending.create('application.status_changed', 5)); pending.work();
pending.retry(); assert.equal(pending.work().result, 'older');
assert.equal(pending.db.status, 5); assert.equal(pending.db.version, 1);
console.log('PASS: normal, durable receipt, outbox, invalid signatures, duplicates, ordering, failure, retry, reconnect, reset, and all event types.');
