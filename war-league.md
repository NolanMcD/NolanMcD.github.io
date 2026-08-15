---
layout: landing
title: WARLeague
permalink: /projects/war-league/
description: A fantasy baseball scorebook that turns player WAR into team standings, roster breakdowns, and a season-long transaction record.
project_date: 2026-08-15
project_label: Baseball data app
project_summary: A live fantasy baseball scorebook that turns player WAR into team standings, roster breakdowns, and a transaction history.
---

<section class="war-hero" aria-labelledby="war-heading">
  <div class="war-hero-copy">
    <p class="eyebrow">Baseball data app</p>
    <h1 id="war-heading">WARLeague</h1>
    <p>A fantasy league where the scoreboard is built from wins above replacement. WARLeague combines two major player-value models, follows ten custom rosters, and turns a season of baseball into one continuously updating competition.</p>
    <div class="hero-actions">
      <a class="button button-primary" href="https://warleague-nolan.streamlit.app/">Launch the live app</a>
      <a class="button button-secondary" href="https://github.com/NolanMcD/WARLeague">View the source</a>
    </div>
  </div>
  <div class="war-scoreboard" aria-label="WARLeague at a glance">
    <p>Season scorebook</p>
    <strong>bWAR + fWAR</strong>
    <span>Two perspectives on player value, combined into one league score.</span>
  </div>
</section>

<section class="war-intro" aria-labelledby="war-about-heading">
  <div>
    <p class="eyebrow">The idea</p>
    <h2 id="war-about-heading">Fantasy baseball, stripped down to value.</h2>
  </div>
  <p>Instead of counting a collection of traditional categories, each roster competes on one number: the combined Baseball-Reference and FanGraphs WAR earned by its players. Five starters determine the standings while reserves, promotions, demotions, adds, and drops preserve the strategy of managing a team across a full season.</p>
</section>

<section class="war-feature-grid" aria-label="Project features">
  <article>
    <span>01</span>
    <h2>Team standings</h2>
    <p>See every fantasy team ranked by the current WAR of its five starters, with separate totals for starters, reserves, and the complete roster.</p>
  </article>
  <article>
    <span>02</span>
    <h2>Player leaderboard</h2>
    <p>Search the full player pool, see each player’s fantasy team, and export the live leaderboard as a CSV for deeper analysis.</p>
  </article>
  <article>
    <span>03</span>
    <h2>Season history</h2>
    <p>Follow the league’s add/drop and promotion/demotion record, keeping roster changes visible even after the transaction window closes.</p>
  </article>
</section>

<section class="war-build" aria-labelledby="war-build-heading">
  <div>
    <p class="eyebrow">How it works</p>
    <h2 id="war-build-heading">A small data pipeline with a focused interface.</h2>
  </div>
  <div class="war-build-steps">
    <p><strong>Ingest.</strong> Parse batting and fielding WAR data, repair inconsistent name encoding, and merge the two sources by player.</p>
    <p><strong>Model.</strong> Map players to custom teams, separate starters from reserves, and replay transactions to preserve current ownership.</p>
    <p><strong>Present.</strong> Use Streamlit and pandas to publish searchable standings, team breakdowns, validation warnings, and downloadable data.</p>
  </div>
</section>

<aside class="war-cta">
  <div><p class="eyebrow">The season is live</p><h2>See where the league stands.</h2></div>
  <a class="button button-primary" href="https://warleague-nolan.streamlit.app/">Open WARLeague <span aria-hidden="true">&rarr;</span></a>
</aside>
