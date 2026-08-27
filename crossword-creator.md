---
layout: landing
title: Crossword Creator
permalink: /crossword-creator/
description: Design, clue, check, preview, save, and print an American-style crossword in your browser.
project_date: 2026-08-27
project_label: Browser construction tool
project_summary: A focused, offline-friendly workspace for building and test-solving crosswords.
---

<div class="crossword-creator" id="crossword-creator">
  <header class="cw-hero">
    <div><p class="eyebrow">A Noland browser tool</p><h1>Crossword Creator</h1><p>Build the grid, write the clues, and test the solve. Your draft stays in this browser.</p></div>
    <div class="cw-hero-mark" aria-hidden="true"><span>1</span><b>C</b><b>R</b><i></i><b>S</b><b>S</b></div>
  </header>

  <section class="cw-app" aria-label="Crossword construction workspace">
    <header class="cw-print-heading"><h1 id="cw-print-title">Untitled Crossword</h1><p id="cw-print-author"></p></header>
    <div class="cw-toolbar" role="toolbar" aria-label="Puzzle controls">
      <button type="button" data-action="new">New</button>
      <span class="cw-tool-group"><button type="button" data-action="undo" title="Undo (Ctrl+Z)">Undo</button><button type="button" data-action="redo" title="Redo (Ctrl+Shift+Z)">Redo</button></span>
      <span class="cw-tool-group cw-modes" aria-label="Editing mode"><button type="button" data-mode="letter" aria-pressed="true">Letter mode</button><button type="button" data-mode="block" aria-pressed="false">Block mode</button></span>
      <button type="button" data-action="symmetry" aria-pressed="true">Symmetry: On</button>
      <button type="button" data-action="preview">Preview</button>
      <button type="button" data-action="check">Check puzzle</button>
      <details class="cw-more"><summary>File &amp; print</summary><div><button type="button" data-action="import">Import JSON</button><button type="button" data-action="export">Export JSON</button><label><input id="cw-answer-key" type="checkbox"> Include answer key</label><button type="button" data-action="print">Print puzzle</button></div></details>
      <input id="cw-import" type="file" accept="application/json,.json" hidden>
    </div>

    <p class="cw-save-status" id="cw-save-status" role="status">Drafts save in this browser only.</p>

    <section class="cw-metadata" aria-label="Puzzle details">
      <label>Title <input id="cw-title" maxlength="120" value="Untitled Crossword"></label>
      <label>Author <input id="cw-author" maxlength="100" placeholder="Your name"></label>
      <label class="cw-notes-label">Notes <textarea id="cw-notes" maxlength="1000" rows="2" placeholder="Optional construction notes"></textarea></label>
    </section>

    <div class="cw-layout">
      <main class="cw-workspace">
        <div class="cw-current" id="cw-current">Select a cell to begin.</div>
        <div class="cw-grid-scroll"><div class="cw-grid" id="cw-grid" role="grid" aria-label="Crossword grid"></div></div>
        <p class="cw-key-hint"><kbd>A</kbd>–<kbd>Z</kbd> enter · arrows move · <kbd>Enter</kbd> changes direction · <kbd>.</kbd> toggles a block in Block mode</p>

        <section class="cw-health" aria-labelledby="cw-health-heading">
          <div><p class="eyebrow">Construction status</p><h2 id="cw-health-heading">Puzzle health</h2></div>
          <p class="cw-health-summary" id="cw-health-summary"></p>
          <div class="cw-stats" id="cw-stats"></div>
          <ul class="cw-warnings" id="cw-warnings"></ul>
        </section>
      </main>

      <aside class="cw-clue-panel" aria-label="Clue editor">
        <section><h2>Across</h2><div class="cw-clues" id="cw-across"></div></section>
        <section><h2>Down</h2><div class="cw-clues" id="cw-down"></div></section>
      </aside>
    </div>

    <div class="cw-live sr-only" id="cw-live" aria-live="polite" aria-atomic="true"></div>
  </section>

  <div class="cw-overlay" id="cw-new-dialog" hidden>
    <form class="cw-dialog" role="dialog" aria-modal="true" aria-labelledby="cw-new-title">
      <button type="button" class="cw-dialog-close" data-close aria-label="Close">×</button>
      <p class="eyebrow">Fresh grid</p><h2 id="cw-new-title">New puzzle</h2>
      <div class="cw-presets" aria-label="Size presets"><button type="button" data-size="9">9×9</button><button type="button" data-size="11">11×11</button><button type="button" data-size="13">13×13</button><button type="button" data-size="15">15×15</button><button type="button" data-size="21">21×21</button></div>
      <div class="cw-dimensions"><label>Columns <input id="cw-width" type="number" min="5" max="25" value="15" required></label><span>×</span><label>Rows <input id="cw-height" type="number" min="5" max="25" value="15" required></label></div>
      <p class="cw-dialog-note">Starting over replaces the current browser draft.</p>
      <button class="cw-primary" type="submit">Create puzzle</button>
      <button class="cw-secondary" type="button" data-close>Cancel</button>
    </form>
  </div>

  <div class="cw-overlay" id="cw-preview" hidden>
    <section class="cw-dialog cw-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="cw-preview-title">
      <header><div><p class="eyebrow">Test solve</p><h2 id="cw-preview-title">Solver preview</h2><p>The answer key is hidden. Test letters are kept separately.</p></div><button type="button" class="cw-dialog-close" data-action="close-preview" aria-label="Return to editor">×</button></header>
      <div class="cw-preview-layout"><div><div class="cw-grid-scroll"><div class="cw-grid" id="cw-preview-grid" role="grid" aria-label="Test-solve crossword grid"></div></div><div class="cw-preview-actions"><button class="cw-primary" type="button" data-action="close-preview">Return to editor</button><button class="cw-secondary" type="button" data-action="clear-test">Clear test solve</button><button class="cw-secondary" type="button" data-action="check-cell">Check cell</button><button class="cw-secondary" type="button" data-action="reveal-cell">Reveal cell</button></div></div><div class="cw-preview-clues" id="cw-preview-clues"></div></div>
    </section>
  </div>
</div>

<noscript><p class="callout">Crossword Creator requires JavaScript.</p></noscript>
<script src="{{ '/assets/js/crossword-creator.js' | relative_url }}" defer></script>
