---
title: Projects
permalink: /projects/
description: A complete archive of Nolan McDermott's projects, essays, analysis, reviews, and experiments.
---

<div class="archive-intro">
  <p class="eyebrow">Everything I make</p>
  <p class="page-lede">Ongoing projects, finished experiments, data stories, movie writing, and technical work—all in one place.</p>
</div>

<nav class="archive-filters" aria-label="Filter projects and posts">
  <button type="button" class="is-active" data-archive-filter="all">All</button>
  <button type="button" data-archive-filter="project">Projects</button>
  <button type="button" data-archive-filter="code,data,math">Code & Data</button>
  <button type="button" data-archive-filter="movies">Movies</button>
  <button type="button" data-archive-filter="career,interviews">Career</button>
</nav>

<p class="archive-count" id="archive-count" aria-live="polite"></p>

<div class="archive-stream" id="archive-stream">
  <article class="archive-card archive-project" data-archive-tags="project sports code data baseball">
    <div class="archive-card-top"><span>Project</span><time>New</time></div>
    <h2><a href="{{ '/projects/war-league/' | relative_url }}">WARLeague</a></h2>
    <p>A live fantasy baseball scorebook that combines player WAR into team standings, roster breakdowns, and a season-long transaction history.</p>
    <div class="archive-tags"><span>Baseball</span><span>Streamlit</span><span>Python</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project language education">
    <div class="archive-card-top"><span>Project</span><time>New</time></div>
    <h2><a href="{{ '/projects/top-1000-spanish-words/' | relative_url }}">Top 1,000 Spanish words</a></h2>
    <p>A frequency-ranked Spanish vocabulary list with English translations, saved study progress, and a quiz mode.</p>
    <div class="archive-tags"><span>Spanish</span><span>Interactive</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project sports code">
    <div class="archive-card-top"><span>Project</span><time>New</time></div>
    <h2><a href="{{ '/projects/sports-calendar/' | relative_url }}">Sports Calendar</a></h2>
    <p>One simple calendar for the leagues, races, college sports, soccer, and esports events I follow.</p>
    <div class="archive-tags"><span>Sports</span><span>Calendar</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project career">
    <div class="archive-card-top"><span>Project</span><time>Ongoing</time></div>
    <h2><a href="{{ '/resumes/' | relative_url }}">Professional resumes</a></h2>
    <p>Three targeted versions of my experience for software engineering, data and analytics, and applied AI roles.</p>
    <div class="archive-tags"><span>Career</span><span>PDF</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project audio">
    <div class="archive-card-top"><span>Project</span><time>Ongoing</time></div>
    <h2><a href="{{ '/storms/' | relative_url }}">Miami Storms</a></h2>
    <p>Real thunderstorms recorded from my apartment in Miami, collected for sleep, focus, and continuous listening.</p>
    <div class="archive-tags"><span>Field recordings</span><span>Audio</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project adventure">
    <div class="archive-card-top"><span>Project</span><time>In progress</time></div>
    <h2><a href="{{ '/projects/florida-keys/' | relative_url }}">Circumnavigating the Florida Keys</a></h2>
    <p>A long-term effort to paddle around every Florida Key, combining route research, trip documentation, and expedition logistics.</p>
    <div class="archive-tags"><span>Adventure</span><span>8 routes</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project movies">
    <div class="archive-card-top"><span>Project</span><time>Ongoing</time></div>
    <h2><a href="{{ '/reviews/' | relative_url }}">Exploring cinema</a></h2>
    <p>Watching widely and building Noland into a home for thoughtful movie reviews, ratings, and recommendations.</p>
    <div class="archive-tags"><span>Movies</span><span>Film diary</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project baseball">
    <div class="archive-card-top"><span>Project</span><time>9 / 30</time></div>
    <h2>The MLB ballpark project</h2>
    <p>A personal quest to visit every Major League Baseball stadium, with rankings, photos, travel notes, and game-day data to come.</p>
    <div class="archive-tags"><span>Baseball</span><span>Travel</span></div>
  </article>

  <article class="archive-card archive-project" data-archive-tags="project code">
    <div class="archive-card-top"><span>Project</span><time>Open source</time></div>
    <h2><a href="https://github.com/NolanMcD">Code and experiments</a></h2>
    <p>Small utilities, analyses, and works in progress that live on GitHub between full project write-ups.</p>
    <div class="archive-tags"><span>Software</span><span>GitHub</span></div>
  </article>

  {% for post in site.posts %}
  <article class="archive-card archive-post" data-archive-tags="post {{ post.categories | join: ' ' | escape }}">
    <div class="archive-card-top"><span>Post</span><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%B %-d, %Y" }}</time></div>
    <h2><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h2>
    {% if post.excerpt %}<p>{{ post.excerpt | strip_html | strip_newlines | escape }}</p>{% endif %}
    <div class="archive-tags">{% for category in post.categories %}<span>{{ category }}</span>{% endfor %}</div>
  </article>
  {% endfor %}
</div>

<p class="archive-empty" id="archive-empty" hidden>No entries match this filter.</p>

<script>
(() => {
  const stream = document.getElementById("archive-stream");
  if (!stream) return;

  const cards = [...stream.querySelectorAll(".archive-card")];
  const buttons = [...document.querySelectorAll("[data-archive-filter]")];
  const count = document.getElementById("archive-count");
  const empty = document.getElementById("archive-empty");

  function applyFilter(value) {
    const wanted = value.split(",");
    let visible = 0;
    cards.forEach(card => {
      const tags = card.dataset.archiveTags.toLowerCase().split(/\s+/);
      const show = value === "all" || wanted.some(tag => tags.includes(tag));
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = `${visible} ${visible === 1 ? "entry" : "entries"}`;
    empty.hidden = visible !== 0;
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    buttons.forEach(item => item.classList.toggle("is-active", item === button));
    applyFilter(button.dataset.archiveFilter);
  }));

  applyFilter("all");
})();
</script>
