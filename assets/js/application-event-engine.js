/* In-memory architectural model. No network, storage, or cryptography. */
(() => {
  "use strict";
  const statuses = ["Application Submitted", "Documents Under Review", "Information Required", "Documents Verified", "Submitted to Agency", "Completed"];
  const types = ["call.initiated", "call.completed", "agent.assigned", "document.received", "document.verified", "application.status_changed"];
  class ApplicationEventLab {
    constructor() { this.reset(); }
    reset() {
      this.serial = 0; this.sequence = 0; this.tick = 0;
      this.db = { id: "DEMO-1042", status: 0, version: 0, sequence: 0, updated: this.time(), message: "Your fictional application has been submitted." };
      this.client = { ...this.db }; this.connected = true;
      this.events = new Map(); this.jobs = []; this.outbox = []; this.log = [];
      this.metrics = { received: 0, processed: 0, invalid: 0, duplicates: 0 };
    }
    time() { return new Date(Date.UTC(2026, 0, 12, 9) + this.tick).toISOString(); }
    create(type = types[5], status = Math.min(5, this.db.status + 1)) {
      this.tick += 1000;
      return { eventId: `evt_demo_${String(++this.serial).padStart(4, "0")}`, provider: type.startsWith("call.") ? "Twilio (simulated)" : "Document service (simulated)", eventType: type, applicationId: this.db.id, timestamp: this.time(), deliveryAttempt: 1, sequence: ++this.sequence, payload: { status, reference: "fictional-record" }, signatureStatus: "valid (simulated)" };
    }
    record(event, result, latency = 0, workerAttempt = 0) {
      this.log.unshift({ time: this.time(), eventId: event.eventId, eventType: event.eventType, result, deliveryAttempt: event.deliveryAttempt, version: this.db.version, latency, workerAttempt });
      this.log = this.log.slice(0, 250);
    }
    receive(event) {
      this.metrics.received++; this.tick += 20;
      if (event.signatureStatus !== "valid (simulated)") { this.metrics.invalid++; this.record(event, "Rejected: Invalid Signature", 20); return "invalid"; }
      if (this.events.has(event.eventId)) { this.metrics.duplicates++; this.record(event, "Ignored: Duplicate Event", 20); return "duplicate"; }
      // Models one transaction: unique inbox event + durable pending work before ACK.
      const stored = JSON.parse(JSON.stringify(event));
      this.events.set(event.eventId, stored);
      this.jobs.push({ event: stored, state: "queued", attempts: 0 });
      this.record(stored, "Accepted", 20); this.record(stored, "Queued", 20);
      return "queued";
    }
    work(fail = false) {
      const job = this.jobs.find(item => item.state === "queued");
      if (!job) return null;
      job.attempts++; this.tick += 400;
      if (fail) { job.state = "failed"; this.record(job.event, "Failed: Retryable", 400, job.attempts); return { result: "failed", event: job.event }; }
      const event = job.event;
      if (event.sequence <= this.db.sequence) {
        job.state = "done"; this.record(event, "Deferred: Older Event", 400, job.attempts);
        return { result: "older", event };
      }
      const messages = { "call.initiated": "A support call has been initiated.", "call.completed": "Your support call is complete.", "agent.assigned": "A case specialist has been assigned.", "document.received": "Your document has been received.", "document.verified": "Your documents have been verified.", "application.status_changed": `Application update: ${statuses[event.payload.status]}.` };
      const status = event.eventType === "application.status_changed" ? event.payload.status : event.eventType === "document.verified" ? Math.max(3, this.db.status) : event.eventType === "document.received" ? Math.max(1, this.db.status) : this.db.status;
      // Atomic state + outgoing notification + completion marker, modeled in memory.
      this.db = { ...this.db, status, version: this.db.version + 1, sequence: event.sequence, updated: this.time(), message: messages[event.eventType] };
      this.outbox.push({ eventId: event.eventId, applicationId: this.db.id, version: this.db.version, published: false });
      job.state = "done"; this.metrics.processed++;
      this.record(event, "Processed", 400, job.attempts);
      return { result: "processed", event };
    }
    publish() {
      this.outbox.forEach(item => { item.published = true; });
      if (this.connected) this.client = { ...this.db };
    }
    retry() {
      const job = this.jobs.find(item => item.state === "failed");
      if (!job) return false;
      job.state = "queued"; this.record(job.event, "Retried", 0, job.attempts + 1); return true;
    }
    connect(value) { this.connected = value; if (value) this.client = { ...this.db }; }
    get health() { return { ...this.metrics, queue: this.jobs.filter(j => j.state !== "done").length, failed: this.jobs.filter(j => j.state === "failed").length, clients: Number(this.connected), version: this.db.version }; }
  }
  globalThis.ApplicationEventLab = ApplicationEventLab;
  ApplicationEventLab.statuses = statuses; ApplicationEventLab.types = types;
})();
