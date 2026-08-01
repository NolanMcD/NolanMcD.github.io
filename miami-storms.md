---
title: Miami Storms
permalink: /storms/
description: Field recordings of thunderstorms in Miami, made for sleep, focus, and a little calm.
---

<div class="storm-hero">
  <p class="eyebrow">Field recordings from Miami</p>
  <h1>Let the storm roll in.</h1>
  <p>Real thunderstorms recorded from my apartment—no loops, music, or talking. Pick one recording or settle in and let the whole collection play.</p>
</div>

<section class="storm-player" id="storm-player" aria-labelledby="now-playing-heading">
  <div class="storm-player-copy">
    <p class="storm-player-label" id="now-playing-heading">Now playing</p>
    <h2 id="storm-now-title">Choose a storm</h2>
    <p id="storm-now-detail">The sky is quiet for the moment.</p>
  </div>
  <audio id="storm-audio" controls preload="metadata"></audio>
  <div class="storm-controls">
    <button type="button" id="storm-previous" aria-label="Play previous storm">Previous</button>
    <button type="button" id="storm-shuffle" aria-pressed="false">Shuffle off</button>
    <button type="button" id="storm-next" aria-label="Play next storm">Next</button>
  </div>
  <p class="storm-note">After you start one recording, the next storm will play automatically.</p>
</section>

<section class="storm-library" aria-labelledby="storm-library-heading">
  <div class="storm-library-heading">
    <div>
      <p class="eyebrow">The archive</p>
      <h2 id="storm-library-heading">Storm recordings</h2>
    </div>
    <span id="storm-count" aria-live="polite"></span>
  </div>
  <div id="storm-list" class="storm-list" aria-live="polite">
    <p class="storm-empty">Loading the weather…</p>
  </div>
</section>

<noscript><p class="callout">JavaScript is required for continuous playback. You can still download the recordings directly from the audio folder.</p></noscript>

<script src="{{ '/assets/js/storm-player.js' | relative_url }}" defer></script>

