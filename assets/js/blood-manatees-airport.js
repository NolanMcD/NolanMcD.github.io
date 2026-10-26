(() => {
  'use strict';
  if (new URLSearchParams(window.location.search).get('story') !== 'blood-manatees') return;
  const $ = id => document.getElementById(id);
  const screen = $('screen');
  const state = { step: 0, seat: '31A', bags: 1, busy: false };
  const steps = ['Welcome', 'Identification', 'Destination', 'Seat selection', 'Baggage', 'Payment', 'Ticket issued'];
  let timer;
  document.title = 'Blood Manatees · Shannon ticket terminal';
  document.body.classList.add('story-terminal');
  document.querySelector('.brand').innerHTML = '<span class="story-airport-brand">SHANNON<small>PASSENGER SERVICES</small></span>';
  document.querySelector('.header-controls').innerHTML = '<span class="story-terminal-id">TERMINAL 06<br>SESSION ACTIVE</span>';
  document.querySelector('.screen-label span').textContent = 'Ticket purchase';
  document.querySelector('.simulator-note').innerHTML = 'BLOOD MANATEES · Fictional terminal · Scanning and payment are simulated. <a href="../blood-manatees/scene/6/" target="_top">Return to the scene</a>';
  const button = (action, text, css = 'blue') => `<button class="${css}" data-story-action="${action}">${text}</button>`;
  const route = '<div class="route"><div><span class="airport-code">SNN</span>Shannon</div><span class="plane" aria-hidden="true">✈ ·······</span><div><span class="airport-code">MIA</span>Miami</div></div>';
  const pass = () => `<div class="boarding-pass"><h2>SHANNON → MIAMI</h2><div class="passenger">WALKER / EWEN</div><div class="details"><div><small>Seat</small><b>${state.seat}</b></div><div><small>Checked bags</small><b>${state.bags}</b></div></div><p>TICKET ISSUED</p><small>FICTIONAL TICKET · NOT VALID FOR TRAVEL</small></div>`;
  function render(focus = false) {
    $('screen-label').textContent = state.busy ? 'Issuing ticket' : steps[state.step];
    $('continue').textContent = state.step === 5 ? 'Confirm purchase ❯' : state.step === 6 ? 'Ticket collected' : 'Continue ❯';
    $('continue').disabled = state.busy || state.step === 1 || state.step === 6;
    $('back').disabled = state.busy || state.step === 0 || state.step === 6;
    $('cancel').disabled = state.busy || state.step === 0;
    if (state.busy) {
      screen.innerHTML = '<div class="processing"><div class="spinner" aria-hidden="true"></div><h1 tabindex="-1">Issuing your ticket…</h1><p>Payment authorized.</p><p class="story-record">PASSENGER RECORD UPDATED</p></div>';
    } else switch (state.step) {
      case 0:
        screen.innerHTML = `<div class="welcome"><h1 tabindex="-1">Good morning, Ewen.</h1><p>Where would you like to go?</p>${button('next', 'Touch to begin', 'blue start')}<p class="story-record">PASSENGER RECOGNIZED</p></div>`;
        break;
      case 1:
        screen.innerHTML = `<h1 tabindex="-1">Place your passport on the reader.</h1><div class="processing"><div class="panel"><h2>EWEN WALKER</h2><p>The reader waits beneath the screen.</p>${button('scan', 'Place Ewen’s passport on reader')}<p class="muted">Fictional passport · No camera or document needed.</p></div></div>`;
        break;
      case 2:
        screen.innerHTML = `<h1 tabindex="-1">Select your destination.</h1><p class="story-record">IDENTITY VERIFIED · VEHICLE RECORD MATCHED</p><button class="panel story-destination" data-story-action="destination" aria-pressed="true">${route}<span class="check">✓ Miami selected</span></button><p class="muted">One adult · Economy · Next available itinerary</p>`;
        break;
      case 3:
        screen.innerHTML = `<h1 tabindex="-1">Choose your seat, Ewen.</h1><p>Shannon → Miami · Economy</p><div class="story-seats" role="group" aria-label="Available seats">${['31A','31C','32A','32C','33A','33C'].map(seat => `<button class="choice ${state.seat === seat ? 'selected' : ''}" data-story-seat="${seat}" aria-pressed="${state.seat === seat}">${seat}</button>`).join('')}</div><p class="muted">A · Window &nbsp; C · Aisle</p>`;
        break;
      case 4:
        screen.innerHTML = `<h1 tabindex="-1">How many bags will you check?</h1><p>EWEN WALKER · Seat ${state.seat}</p><div class="bag-choices">${[0,1,2,3].map(bags => `<button class="choice ${state.bags === bags ? 'selected' : ''}" data-story-bags="${bags}" aria-pressed="${state.bags === bags}"><b>${bags}</b>${bags === 1 ? 'bag' : 'bags'}</button>`).join('')}</div><p class="story-record">SELECTIONS ADDED TO PASSENGER RECORD</p>`;
        break;
      case 5:
        screen.innerHTML = `<h1 tabindex="-1">Confirm your purchase.</h1><section class="panel">${route}<p class="passenger">WALKER / EWEN</p><p>Seat ${state.seat} · ${state.bags} checked ${state.bags === 1 ? 'bag' : 'bags'}</p><p>Payment method on file.</p><p class="story-record">NO FURTHER DETAILS REQUIRED</p></section><p class="muted">Fictional purchase · No charge or payment details.</p>`;
        break;
      case 6:
        screen.innerHTML = `<div class="completion"><h1 tabindex="-1">Collect your ticket.</h1>${pass()}<p class="story-record">PASSENGER RECORD UPDATED</p>${button('collect', 'Take the ticket', 'orange')}</div>`;
        break;
    }
    if (focus) screen.querySelector('h1')?.focus({ preventScroll: true });
  }
  function next() {
    if ($('continue').disabled) return;
    if (state.step === 5) {
      state.busy = true; render(true);
      timer = window.setTimeout(() => { state.busy = false; state.step = 6; render(true); }, 1400);
    } else { state.step += 1; render(true); }
  }
  function reset() { window.clearTimeout(timer); Object.assign(state, { step: 0, seat: '31A', bags: 1, busy: false }); render(true); }
  screen.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control || control.disabled || state.busy) return;
    if (control.dataset.storySeat) { state.seat = control.dataset.storySeat; render(); screen.querySelector(`[data-story-seat="${state.seat}"]`).focus(); }
    if (control.dataset.storyBags !== undefined) { state.bags = Number(control.dataset.storyBags); render(); screen.querySelector(`[data-story-bags="${state.bags}"]`).focus(); }
    if (control.dataset.storyAction === 'next') next();
    if (control.dataset.storyAction === 'scan') { state.step = 2; render(true); }
    if (control.dataset.storyAction === 'collect') {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'blood-manatees:ticket-collected' }, window.location.origin);
        control.disabled = true; control.textContent = 'Ticket collected';
      } else window.location.assign('../blood-manatees/scene/6/#airport-ending');
    }
  });
  $('continue').onclick = next;
  $('back').onclick = () => { if (!$('back').disabled) { state.step -= 1; render(true); } };
  $('cancel').onclick = () => {
    $('dialog-title').textContent = 'Cancel this purchase?';
    $('dialog-text').textContent = 'Your seat and baggage selections will be cleared.';
    $('dialog-actions').innerHTML = `${button('keep', 'Keep selections')}${button('reset', 'Cancel purchase', 'orange')}`;
    $('dialog').showModal();
  };
  $('help').onclick = () => {
    $('dialog-title').textContent = 'Passenger assistance';
    $('dialog-text').textContent = 'Operate the terminal as Ewen Walker. All identification and payment details belong to the story. You can also read the scene beneath the terminal.';
    $('dialog-actions').innerHTML = button('keep', 'Close'); $('dialog').showModal();
  };
  $('dialog-actions').addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.storyAction;
    if (!action) return;
    $('dialog').close(); if (action === 'reset') reset();
  });
  window.addEventListener('pagehide', () => window.clearTimeout(timer));
  render();
})();
