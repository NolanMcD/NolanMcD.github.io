---
title: Top 1,000 Spanish Words
permalink: /projects/top-1000-spanish-words/
description: Study the 1,000 most common Spanish words with English translations, filters, saved progress, and a quiz.
---

<div class="vocab-app" id="vocab-app" data-source="{{ '/assets/data/spanish-1000.json' | relative_url }}">
  <header class="vocab-hero">
    <p class="eyebrow">Language study</p>
    <h1>Top 1,000 Spanish words</h1>
    <p class="vocab-lede">Start with the words you are most likely to meet. Browse the complete frequency-ranked list, mark what you know, then test your recall.</p>
    <div class="vocab-stats" aria-label="Study progress">
      <div><strong id="vocab-total">1,000</strong><span>words</span></div>
      <div><strong id="vocab-learned">0</strong><span>learned</span></div>
      <div><strong id="vocab-progress">0%</strong><span>progress</span></div>
    </div>
  </header>

  <nav class="vocab-tabs" aria-label="Study mode">
    <button class="is-active" type="button" data-vocab-tab="list" aria-controls="vocab-list-panel">Word list</button>
    <button type="button" data-vocab-tab="quiz" aria-controls="vocab-quiz-panel">Quiz mode</button>
  </nav>

  <section id="vocab-list-panel" class="vocab-panel">
    <div class="vocab-tools">
      <label class="vocab-search"><span>Search</span><input id="vocab-search" type="search" placeholder="Spanish or English…" autocomplete="off"></label>
      <label><span>Range</span><select id="vocab-range"><option value="all">All 1,000</option><option value="100">Top 100</option><option value="250">Top 250</option><option value="500">Top 500</option></select></label>
      <label><span>Part of speech</span><select id="vocab-pos"><option value="all">All types</option></select></label>
      <label><span>Status</span><select id="vocab-status"><option value="all">All words</option><option value="learning">Still learning</option><option value="learned">Learned</option></select></label>
    </div>
    <p class="vocab-result-count" id="vocab-result-count" aria-live="polite">Loading words…</p>
    <div class="vocab-table-wrap">
      <table class="vocab-table">
        <thead><tr><th>Rank</th><th>Spanish</th><th>English</th><th>Type</th><th><span class="sr-only">Progress</span></th></tr></thead>
        <tbody id="vocab-rows"></tbody>
      </table>
    </div>
    <div class="vocab-pagination" id="vocab-pagination"></div>
  </section>

  <section id="vocab-quiz-panel" class="vocab-panel" hidden>
    <div class="quiz-setup" id="quiz-setup">
      <p class="eyebrow">Choose your challenge</p>
      <h2>Build a 10-question round</h2>
      <div class="quiz-options">
        <label><span>Test me on</span><select id="quiz-range"><option value="100">Top 100</option><option value="250">Top 250</option><option value="500">Top 500</option><option value="1000">All 1,000</option><option value="learning">Words still learning</option></select></label>
        <label><span>Direction</span><select id="quiz-direction"><option value="es-en">Spanish → English</option><option value="en-es">English → Spanish</option><option value="mixed">Mix both</option></select></label>
      </div>
      <button class="vocab-primary" type="button" id="quiz-start">Start quiz</button>
    </div>
    <div class="quiz-card" id="quiz-card" hidden>
      <div class="quiz-meta"><span id="quiz-counter">Question 1 of 10</span><span>Score <strong id="quiz-score">0</strong></span></div>
      <div class="quiz-bar"><span id="quiz-bar-fill"></span></div>
      <p id="quiz-prompt-label" class="quiz-prompt-label"></p>
      <p id="quiz-prompt" class="quiz-prompt" lang="es"></p>
      <div id="quiz-answers" class="quiz-answers"></div>
      <p id="quiz-feedback" class="quiz-feedback" aria-live="polite"></p>
      <button class="vocab-primary" type="button" id="quiz-next" hidden>Next question</button>
    </div>
    <div class="quiz-results" id="quiz-results" hidden>
      <p class="eyebrow">Round complete</p><h2 id="quiz-result-score"></h2><p id="quiz-result-copy"></p>
      <button class="vocab-primary" type="button" id="quiz-again">Play again</button>
    </div>
  </section>

  <footer class="vocab-note">
    <h2>About the list</h2>
    <p>Frequency depends on the source. This learner-focused list groups inflected forms under their dictionary lemma, then ranks the lemmas by combined usage. English glosses are concise study cues, not exhaustive definitions. Data comes from <a href="https://github.com/doozan/spanish_data">Spanish Data</a>, built from frequency corpora and English Wiktionary under CC BY 4.0.</p>
  </footer>
</div>

<script src="{{ '/assets/js/spanish-words.js' | relative_url }}" defer></script>
