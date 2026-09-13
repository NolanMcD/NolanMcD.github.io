(() => {
  "use strict";
  const root = document.getElementById("application-event-lab");
  if (!root) return;
  const model = new ApplicationEventLab();
  const $ = id => root.querySelector(`#ael-${id}`);
  const stages = [...root.querySelectorAll("[data-stage]")];
  let last = null, delayed = null, fail = false, busy = false, generation = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const say = message => { $("notice").textContent = message; };
  const stamp = value => value.slice(11, 19) + " UTC";
  function render() {
    const state = model.client;
    $("status").textContent = ApplicationEventLab.statuses[state.status];
    $("updated").textContent = stamp(state.updated);
    $("customer-version").textContent = `Customer v${state.version}`;
    $("message").textContent = state.message;
    $("progress").value = state.status + 1;
    $("progress-label").textContent = `Step ${state.status + 1} of 6`;
    root.querySelectorAll("[data-workflow]").forEach((el, i) => { el.setAttribute("aria-current", i === state.status ? "step" : "false"); });
    $("connection").textContent = model.connected ? `Live updates connected · database v${model.db.version}` : `Disconnected · customer v${state.version} / database v${model.db.version}`;
    $("customer").classList.toggle("is-stale", !model.connected);
    $("stale").hidden = model.connected;
    Object.entries(model.health).forEach(([key, value]) => { $(key).textContent = value; });
    root.querySelectorAll("[data-send]").forEach(button => { button.disabled = busy; });
    $("duplicate").disabled = busy || !last;
    $("release").disabled = busy || !delayed;
    $("delay").disabled = busy || !!delayed;
    $("retry").disabled = busy || !model.health.failed;
    $("disconnect").disabled = !model.connected;
    $("reconnect").disabled = model.connected;
    $("failure").setAttribute("aria-pressed", String(fail));
    $("failure").textContent = fail ? "Worker failure armed" : "Simulate worker failure";
    $("held").textContent = delayed ? `${delayed.eventId} held at source (sequence ${delayed.sequence}). Send a newer event, then release this one.` : "No delayed event. Delay holds a delivery until you release it.";
    const rows = model.log.filter(row => (!$("filter-result").value || row.result === $("filter-result").value) && (!$("filter-type").value || row.eventType === $("filter-type").value));
    $("log").replaceChildren(...rows.map(row => {
      const tr = document.createElement("tr");
      [stamp(row.time), row.eventId, row.eventType, row.result, `${row.deliveryAttempt} / ${row.workerAttempt || "—"}`, `v${row.version}`, `${row.latency} ms`].forEach(value => { const td = document.createElement("td"); td.textContent = value; tr.append(td); });
      return tr;
    }));
    $("empty").hidden = rows.length > 0;
    $("log-count").textContent = `${rows.length} matching log entries · latest 250 retained`;
  }
  function stage(index, label) {
    stages[index].dataset.state = "done";
    stages[index].querySelector("small").textContent = label;
  }
  async function pause(token) {
    await new Promise(resolve => setTimeout(resolve, reduced.matches ? 0 : 150));
    return token === generation;
  }
  async function process(event, retry = false) {
    const token = generation;
    busy = true; stages.forEach(el => { el.dataset.state = ""; el.querySelector("small").textContent = "Waiting"; });
    $("payload").textContent = JSON.stringify(event, null, 2);
    $("pipeline-event").textContent = `${event.eventId} · sequence ${event.sequence}`;
    render();
    if (!retry) {
      stage(0, "Received"); if (!await pause(token)) return;
      const result = model.receive(event); render();
      stage(1, result === "invalid" ? "Rejected" : "Valid (simulated)");
      if (result === "invalid") { say("Invalid signature rejected before recording or changing application state."); busy = false; render(); return; }
      if (!await pause(token)) return;
      stage(2, result === "duplicate" ? "Duplicate ignored" : "Unique event ID");
      if (result === "duplicate") { say("Duplicate ignored. The recorded event ID prevents a second job or side effect."); busy = false; render(); return; }
      if (!await pause(token)) return;
      stage(3, "Recorded atomically");
    } else { stage(3, "Existing durable event"); }
    stage(4, retry ? "Retry queued · no new delivery" : "Queued · HTTP 202 ACK");
    if (!await pause(token)) return;
    const outcome = model.work(fail); fail = false; render();
    if (!outcome || outcome.result !== "processed") {
      stage(5, outcome?.result === "failed" ? "Failed · retryable" : "Older sequence deferred");
      say(outcome?.result === "failed" ? "Worker failed before commit. The recorded job remains available for retry." : "Older event recorded but not applied: its sequence cannot overwrite newer authoritative state.");
      busy = false; render(); return;
    }
    stage(5, `Committed v${model.db.version} + outbox`);
    if (!await pause(token)) return;
    model.publish(); stage(6, "Outbox published"); stage(7, model.connected ? "Customer synchronized" : "Offline · notification missed");
    say(model.connected ? `Processed ${event.eventId}. Customer and database now match at v${model.db.version}.` : `Database advanced to v${model.db.version}. Customer view stays frozen until reconnect.`);
    busy = false; render();
  }
  function create() { return model.create($("type").value, Number($("target").value)); }
  root.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]"); if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "reset") {
      generation++; model.reset(); last = null; delayed = null; fail = false; busy = false;
      $("type").selectedIndex = 5; $("target").value = "1"; $("filter-result").value = ""; $("filter-type").value = "";
      $("target").disabled = false;
      $("payload").textContent = "Send an event to inspect its simulated envelope."; $("pipeline-event").textContent = "Waiting for the first event";
      stages.forEach(el => { el.dataset.state = ""; el.querySelector("small").textContent = "Waiting"; }); say("Simulation reset. All state, jobs, counters, filters, and delayed deliveries cleared.");
    } else if (action === "disconnect" || action === "reconnect") {
      model.connect(action === "reconnect"); say(model.connected ? `Refetched authoritative application v${model.db.version}. Missed notifications are not required.` : "Live updates disconnected. Send an event to see the database advance while this customer view stays stale.");
    } else if (action === "failure") { fail = !fail; say(fail ? "The next worker attempt will fail before its transaction commits." : "Worker failure disarmed.");
    } else if (action === "delay") { delayed = create(); say("Event held at the source. It has not reached the webhook receiver.");
    } else if (action === "retry") { const job = model.jobs.find(j => j.state === "failed"); if (model.retry()) await process(job.event, true);
    } else if (action === "out-of-order") {
      const older = model.create("application.status_changed", 2), newer = model.create("application.status_changed", 3);
      const token = generation; last = newer; await process(newer);
      if (token === generation) { last = older; await process(older); }
    } else {
      let next;
      if (action === "duplicate") next = { ...last, deliveryAttempt: last.deliveryAttempt + 1 };
      else if (action === "release") { next = delayed; delayed = null; }
      else { next = create(); if (action === "invalid") next.signatureStatus = "invalid (simulated)"; }
      last = next; await process(next);
    }
    render();
  });
  $("type").addEventListener("change", () => { $("target").disabled = $("type").value !== "application.status_changed"; });
  [$("filter-result"), $("filter-type")].forEach(el => el.addEventListener("change", render));
  render();
})();
