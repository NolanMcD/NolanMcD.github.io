---
layout: landing
title: Sports Calendar
permalink: /projects/sports-calendar/
description: One calendar for the leagues, races, tournaments, and esports events Nolan follows.
---

<section class="sports-cal-hero">
  <div>
    <p class="eyebrow">Sports calendar</p>
    <h1>What is on today?</h1>
    <p>A simple month-at-a-glance view of the sports I follow. Each mark means that league has at least one game, race, or tournament that day.</p>
  </div>
  <div class="sports-cal-today" id="sports-cal-today" aria-live="polite"></div>
</section>

<section class="sports-cal-app" id="sports-calendar" aria-labelledby="sports-cal-heading">
  <header class="sports-cal-toolbar">
    <div>
      <p class="eyebrow">Schedule</p>
      <h2 id="sports-cal-heading">Loading calendar…</h2>
    </div>
    <div class="sports-cal-nav">
      <button type="button" id="sports-cal-previous" aria-label="Previous month">←</button>
      <button type="button" id="sports-cal-current">Today</button>
      <button type="button" id="sports-cal-next" aria-label="Next month">→</button>
    </div>
  </header>

  <div class="sports-cal-filters" id="sports-cal-filters" aria-label="Filter calendar by sport"></div>
  <p class="sports-cal-status" id="sports-cal-status" aria-live="polite">Loading schedules…</p>

  <div class="sports-cal-weekdays" aria-hidden="true">
    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
  </div>
  <div class="sports-cal-grid" id="sports-cal-grid"></div>
</section>

<aside class="sports-cal-details" id="sports-cal-details" aria-live="polite">
  <p class="eyebrow">Selected day</p>
  <h2>Choose a date</h2>
  <p>Select any day with a sports mark to see what is scheduled.</p>
</aside>

<p class="sports-cal-note">Schedules come from public league scoreboards and may change. CS majors and Smash tournaments use curated entries because those scenes do not share a dependable schedule feed.</p>

<script src="{{ '/assets/js/sports-calendar.js' | relative_url }}" defer></script>
