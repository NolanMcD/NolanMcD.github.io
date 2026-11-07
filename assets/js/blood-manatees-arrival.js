(() => {
  'use strict';
  const root = document.querySelector('[data-bm-arrival]');
  if (!root) return;
  const screen = root.querySelector('[data-arrival-screen]');
  const terminal = root.querySelector('[data-arrival-terminal]');
  const ending = document.querySelector('[data-arrival-ending]');
  const views = [...root.querySelectorAll('[data-arrival-view]')];
  const state = { step: 0 };
  const button = (action, label) => `<button type="button" data-arrival-action="${action}">${label}</button>`;
  const pages = [
    {
      camera: 'corridor', label: 'ARRIVALS CORRIDOR / CAM 14', note: 'Subject acquired. Passenger record waiting.', status: 'RECORD WAITING',
      html: `<p class="bm-customs-code">INBOUND / SNN → MIA</p><h2 tabindex="-1">Arrival record located.</h2><p>One passenger. A record already open.</p>${button('next', 'Open passenger record')}`
    },
    {
      camera: 'desk', label: 'PRIMARY DESK / CAM 08', note: 'Face and passport record matched.', status: 'IDENTITY MATCHED',
      html: `<p class="bm-customs-code">01 / IDENTITY &amp; JOURNEY</p><h2 tabindex="-1">WALKER / EWEN</h2><dl><dt>Departure record</dt><dd>Shannon / SNN</dd><dt>Arrival record</dt><dd>Miami / MIA</dd><dt>Travelling party</dt><dd>Alone</dd><dt>Return itinerary</dt><dd>No booking attached</dd></dl><blockquote><p>“Purpose of your visit?”</p><p>“Holiday.”</p></blockquote>${button('next', 'Review passenger information')}`
    },
    {
      camera: 'desk', label: 'PRIMARY DESK / CAM 08', note: 'Employment update attached before the officer finishes the question.', status: 'LINKED RECORD FOUND',
      html: `<p class="bm-customs-code">02 / LINKED INFORMATION</p><h2 tabindex="-1">Employment record.</h2><blockquote><p>“What do you do?”</p><p>“Between things.”</p></blockquote><dl><dt>Previous role</dt><dd>Head of Artificial Intelligence</dd><dt>Latest status</dt><dd>Position eliminated</dd><dt>Approvals</dt><dd>Personnel · Finance · Compliance</dd></dl><p class="bm-customs-alert">All three approvals carry the same timestamp.</p><p>Ewen has not mentioned his employer.</p>${button('next', 'Open equipment record')}`
    },
    {
      camera: 'baggage', label: 'BAGGAGE RECORD / IMAGE 01', note: 'Personal electronics. Sporting equipment. Description awaiting acceptance.', status: 'DESCRIPTION PENDING',
      html: `<p class="bm-customs-code">03 / EQUIPMENT BAG</p><h2 tabindex="-1">Personal effects.</h2><dl><dt>Electronics</dt><dd>Mobile phones / two laptops</dd><dt>Sporting equipment</dt><dd>Two baseball bats</dd><dt>Other contents</dt><dd>Clothes / glass marbles in a pouch</dd></dl><blockquote><p>“You play?”</p><p>“Sometimes.”</p></blockquote><p>The cursor waits beside SPORTING EQUIPMENT.</p>${button('next', 'Accept equipment description')}`
    },
    {
      camera: 'desk', label: 'PRIMARY DESK / CAM 08', note: 'The officer returns the passport. The camera holds.', status: 'REVIEW COMPLETE',
      html: `<p class="bm-customs-code">04 / DISPOSITION</p><h2 tabindex="-1">No further questions.</h2><dl><dt>Identity</dt><dd>Matched</dd><dt>Equipment description</dt><dd>Accepted</dd><dt>Passenger record</dt><dd>Ready to close</dd></dl><p>The officer's hand moves toward Ewen's passport.</p>${button('release', 'Close arrival record')}`
    },
    {
      camera: 'exit', label: 'PUBLIC EXIT / CAM 22', note: 'Subject leaves the camera field. Record retained.', status: 'ARRIVAL CLOSED',
      html: `<p class="bm-customs-code">RECENT ARRIVALS / 01</p><h2 tabindex="-1">WALKER / EWEN</h2><dl><dt>Arrival</dt><dd>Miami / MIA</dd><dt>Desk review</dt><dd>Complete</dd><dt>Current camera</dt><dd>Subject out of frame</dd></dl><p class="bm-customs-alert">OBSERVATION CONTINUES</p>${button('restart', 'Replay arrival')}`
    }
  ];
  function render(focus = true) {
    const page = pages[state.step];
    screen.innerHTML = page.html;
    views.forEach(view => {
      if (view.dataset.arrivalView === page.camera) view.removeAttribute('hidden');
      else view.setAttribute('hidden', '');
    });
    root.querySelector('[data-arrival-camera]').textContent = `MIA / ${page.label}`;
    root.querySelector('[data-arrival-feed-note]').textContent = page.note;
    root.querySelector('[data-arrival-case-status]').textContent = page.status;
    root.querySelector('#arrival-feed-description').textContent = page.note;
    if (focus) screen.querySelector('h2').focus({ preventScroll: true });
  }
  root.addEventListener('click', event => {
    const control = event.target.closest('[data-arrival-action]');
    if (!control || !root.contains(control)) return;
    const action = control.dataset.arrivalAction;
    if (action === 'next' && state.step < 4) state.step += 1;
    else if (action === 'release' && state.step === 4) {
      state.step = 5;
      ending.hidden = false;
    } else if (action === 'restart' && state.step === 5) {
      state.step = 0;
      ending.hidden = true;
    } else return;
    render();
    if (state.step === 5) {
      ending.focus({ preventScroll: true });
      ending.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  });
  terminal.hidden = false;
  render(false);
})();
