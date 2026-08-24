---
layout: landing
title: Elevator Game
permalink: /elevator-game/
description: Manage a growing bank of elevators, route passengers, and survive the rush-hour crush.
project_date: 2026-08-24
project_label: Browser strategy game
project_summary: Dispatch elevators, manage passenger patience, and keep a ten-floor building moving through rush hour.
---

<div class="elevator-game" id="elevator-game" tabindex="0">
  <header class="eg-hero">
    <div>
      <p class="eyebrow">A Noland browser game</p>
      <h1>Elevator Game</h1>
      <p>Keep a ten-floor building moving. Deliver riders directly—or make a risky detour before someone takes the stairs.</p>
    </div>
    <div class="eg-hero-lift" aria-hidden="true"><span>10</span><div><b>▲</b><strong>E</strong></div><span>1</span></div>
  </header>

  <section class="eg-shell" aria-label="Elevator Game">
    <div class="eg-start" id="eg-start">
      <p class="eyebrow">Your shift starts now</p>
      <h2>How long can you keep everyone moving?</h2>
      <div class="eg-start-rules">
        <p><strong>1. Pick an elevator.</strong><span>Use its card or keys 1–4.</span></p>
        <p><strong>2. Send it to a floor.</strong><span>Tap a floor to add a pickup stop.</span></p>
        <p><strong>3. Beat the clock.</strong><span>Riders leave after 5 simulated minutes. Five misses ends the run.</span></p>
      </div>
      <p class="eg-accelerated">The building clock runs at 10× real time.</p>
      <p class="eg-best-intro">Best score <strong id="eg-intro-best">0</strong></p>
      <div class="eg-start-actions">
        <button class="eg-primary" id="eg-start-button" type="button">Start game</button>
        <button class="eg-secondary" id="eg-computer-start" type="button">Watch computer play</button>
        <button class="eg-secondary" type="button" data-eg-open="help">Instructions</button>
      </div>
    </div>

    <div class="eg-play" id="eg-play" hidden>
      <header class="eg-scorebar">
        <div><span>Delivered</span><strong id="eg-score">0</strong></div>
        <div><span>Waiting</span><strong id="eg-waiting">0</strong></div>
        <div><span>Misses</span><strong id="eg-misses">0 / 5</strong></div>
        <div><span>Best</span><strong id="eg-best">0</strong></div>
        <div><span>Building time</span><strong id="eg-clock">8:00 AM</strong></div>
        <button class="eg-ai-button" id="eg-ai-toggle" type="button" aria-pressed="false"><span>Computer</span><strong>Off</strong></button>
        <button class="eg-icon-button" id="eg-pause" type="button" aria-label="Pause game">Ⅱ <span>Pause</span></button>
      </header>

      <div class="eg-phasebar">
        <span class="eg-phase" id="eg-phase">Opening</span>
        <span id="eg-shift">Shift 1</span>
        <span id="eg-next-unlock">Next elevator at 25 deliveries</span>
      </div>

      <div class="eg-layout">
        <section class="eg-building-panel" aria-label="Ten-floor building">
          <div class="eg-building" id="eg-building"></div>
          <p class="eg-keyboard-hint">Game focused: ↑/↓ choose floor · Enter/Space assign · 1–4 choose elevator · P pause</p>
        </section>

        <aside class="eg-dispatch" aria-label="Elevator dispatch controls">
          <div class="eg-dispatch-heading">
            <div><p class="eyebrow">Dispatch</p><h2>Elevators</h2></div>
            <button class="eg-help-button" type="button" data-eg-open="help">? <span>Help</span></button>
          </div>
          <div class="eg-elevator-cards" id="eg-elevator-cards"></div>
          <section class="eg-legend" aria-label="Route legend">
            <h3>Route key</h3>
            <p><span class="eg-route-mark eg-route-optional">○</span> Optional pickup — tap again to remove</p>
            <p><span class="eg-route-mark eg-route-required">◆</span> Rider destination — cannot be removed</p>
          </section>
          <p class="eg-ai-note" id="eg-ai-note" hidden><strong>Computer dispatching</strong><span>Autopilot weighs urgency, distance, capacity, and route detours. Turn it off at any time to take control.</span></p>
          <section class="eg-achievements-mini">
            <h3>Achievements <span id="eg-achievement-count">0 / 8</span></h3>
            <button type="button" class="eg-text-button" data-eg-open="achievements">View collection</button>
          </section>
          <label class="eg-sound"><input type="checkbox" id="eg-sound"> <span>Arrival sound</span></label>
        </aside>
      </div>
    </div>

    <div class="eg-toast-stack" id="eg-toasts" aria-hidden="true"></div>
    <div class="sr-only" id="eg-live" aria-live="polite" aria-atomic="true"></div>

    <div class="eg-overlay" id="eg-pause-overlay" hidden>
      <div class="eg-dialog" role="dialog" aria-modal="true" aria-labelledby="eg-pause-title">
        <p class="eyebrow">Building on hold</p><h2 id="eg-pause-title">Paused</h2>
        <p id="eg-pause-reason">Passenger patience and building time are frozen.</p>
        <button class="eg-primary" id="eg-resume" type="button">Resume</button>
        <button class="eg-secondary" type="button" data-eg-open="help">Instructions</button>
        <button class="eg-text-button" id="eg-restart" type="button">Restart run</button>
      </div>
    </div>

    <div class="eg-overlay" id="eg-gameover" hidden>
      <div class="eg-dialog eg-results" role="dialog" aria-modal="true" aria-labelledby="eg-gameover-title">
        <p class="eyebrow">Shift over</p><h2 id="eg-gameover-title">The stairs won this one.</h2>
        <p class="eg-new-best" id="eg-new-best" hidden>New high score!</p>
        <div class="eg-result-grid">
          <p><strong id="eg-final-score">0</strong><span>delivered</span></p>
          <p><strong id="eg-final-time">0h 00m</strong><span>survived</span></p>
          <p><strong id="eg-final-missed">5</strong><span>missed</span></p>
          <p><strong id="eg-final-elevators">1</strong><span>elevators</span></p>
        </div>
        <button class="eg-primary" id="eg-replay" type="button">Play again</button>
        <button class="eg-secondary" type="button" data-eg-open="achievements">Achievements</button>
      </div>
    </div>

    <div class="eg-overlay" id="eg-help" hidden>
      <div class="eg-dialog eg-help-dialog" role="dialog" aria-modal="true" aria-labelledby="eg-help-title">
        <button class="eg-dialog-close" type="button" data-eg-close aria-label="Close instructions">×</button>
        <p class="eyebrow">Dispatch manual</p><h2 id="eg-help-title">Keep the building moving</h2>
        <div class="eg-help-grid">
          <section><h3>Dispatch</h3><p>Select an elevator, then tap any floor. A <b>○ pickup</b> can be canceled; a <b>◆ destination</b> belongs to someone onboard and is mandatory.</p></section>
          <section><h3>Passengers</h3><p>Each badge shows a rider’s destination. Their label changes from Calm to Critical as the five-minute patience limit approaches.</p></section>
          <section><h3>Rush hour</h3><p>Morning traffic rises from the lobby. Evening traffic heads down. New elevators unlock at 25, 75, and 150 deliveries.</p></section>
          <section><h3>Keyboard</h3><p><kbd>1</kbd>–<kbd>4</kbd> select an elevator. <kbd>↑</kbd>/<kbd>↓</kbd> choose a floor. <kbd>Enter</kbd> or <kbd>Space</kbd> assigns it. <kbd>P</kbd> pauses.</p></section>
          <section><h3>Computer plays</h3><p>Start in spectator mode or switch on Computer during a run. It continually balances urgent pickups against the destinations of riders already onboard.</p></section>
        </div>
        <p><strong>Scoring:</strong> one point per delivery. A rider who waits five simulated minutes takes the stairs; five misses ends the run.</p>
        <button class="eg-primary" type="button" data-eg-close>Got it</button>
      </div>
    </div>

    <div class="eg-overlay" id="eg-achievements" hidden>
      <div class="eg-dialog" role="dialog" aria-modal="true" aria-labelledby="eg-achievements-title">
        <button class="eg-dialog-close" type="button" data-eg-close aria-label="Close achievements">×</button>
        <p class="eyebrow">Permanent collection</p><h2 id="eg-achievements-title">Achievements</h2>
        <div class="eg-achievement-list" id="eg-achievement-list"></div>
        <button class="eg-primary" type="button" data-eg-close>Close</button>
      </div>
    </div>

    <div class="eg-overlay" id="eg-restart-confirm" hidden>
      <div class="eg-dialog" role="dialog" aria-modal="true" aria-labelledby="eg-restart-title">
        <h2 id="eg-restart-title">Restart this run?</h2><p>Your current score will be lost.</p>
        <button class="eg-primary" id="eg-restart-yes" type="button">Restart</button>
        <button class="eg-secondary" type="button" data-eg-close>Keep playing</button>
      </div>
    </div>
  </section>
</div>

<noscript><p class="callout">Elevator Game requires JavaScript to run.</p></noscript>
<script src="{{ '/assets/js/elevator-game.js' | relative_url }}" defer></script>
