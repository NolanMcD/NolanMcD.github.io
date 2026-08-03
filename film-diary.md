---
title: Film Diary
permalink: /reviews/diary/
description: Search Nolan McDermott's complete film diary, ratings, rewatches, and reviews synced from Letterboxd.
---

<header class="diary-hero">
  <p class="eyebrow">Every watch since 2020</p>
  <h1>Film Diary</h1>
  <p>Quick reactions, long reviews, rewatches, and everything in between. New entries sync from Letterboxd; viewing details are reconciled with periodic exports.</p>
  <div class="diary-stats" id="diary-stats" aria-live="polite"><span>Loading the archive…</span></div>
</header>

<section class="diary-browser" aria-labelledby="diary-browser-heading">
  <h2 class="visually-hidden" id="diary-browser-heading">Browse film diary entries</h2>
  <form class="diary-filters" id="diary-filters">
    <label class="diary-search">
      <span>Search</span>
      <input id="diary-search" type="search" placeholder="Title, review, or tag" autocomplete="off">
    </label>
    <label>
      <span>Rating</span>
      <select id="diary-rating">
        <option value="">All ratings</option>
        <option value="5">5 stars</option>
        <option value="4">4 stars</option>
        <option value="3">3 stars</option>
        <option value="2">2 stars</option>
        <option value="1">1 star</option>
      </select>
    </label>
    <label>
      <span>Watched</span>
      <select id="diary-year"><option value="">Every year</option></select>
    </label>
    <label>
      <span>Where</span>
      <select id="diary-source"><option value="">Everywhere</option></select>
    </label>
    <label>
      <span>Sort</span>
      <select id="diary-sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="highest">Highest rated</option>
        <option value="lowest">Lowest rated</option>
      </select>
    </label>
    <label class="diary-checkbox"><input id="diary-rewatch" type="checkbox"> <span>Rewatches only</span></label>
    <button class="diary-reset" id="diary-reset" type="reset">Clear filters</button>
  </form>

  <div class="diary-results-heading">
    <p id="diary-result-count" aria-live="polite">Loading reviews…</p>
    <a href="https://letterboxd.com/NolanMcD/">Follow on Letterboxd <span aria-hidden="true">→</span></a>
  </div>
  <div class="diary-list" id="diary-list"></div>
  <button class="diary-more" id="diary-more" type="button" hidden>Show more reviews</button>
  <p class="diary-error" id="diary-error" hidden>The Film Diary could not be loaded. You can still browse the reviews on <a href="https://letterboxd.com/NolanMcD/films/reviews/">Letterboxd</a>.</p>
</section>

<script src="{{ '/assets/js/film-diary.js' | relative_url }}" defer></script>

