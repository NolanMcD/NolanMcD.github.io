---
layout: landing
title: Home
description: Nolan McDermott's latest movie reviews, writing, adventures, and personal projects.
---

<section class="feed-hero home-compact" aria-labelledby="feed-heading">
  <header class="feed-heading">
    <div><p class="eyebrow">Movies, miles, and side quests</p><h1 id="feed-heading">Noland.</h1></div>
  </header>
  <nav class="home-shortcuts" aria-label="Explore Noland">
    <a class="home-shortcut home-shortcut-movies" href="{{ '/reviews/diary/' | relative_url }}">
      <span class="home-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><rect x="9" y="12" width="46" height="40" rx="4"/><path d="M19 12v40M45 12v40M9 22h10M9 32h10M9 42h10M45 22h10M45 32h10M45 42h10"/><path d="m27 24 12 8-12 8z"/></svg></span>
      <span class="home-shortcut-label">Film diary</span>
    </a>
    <a class="home-shortcut home-shortcut-paddle" href="{{ '/projects/florida-keys/' | relative_url }}">
      <span class="home-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><path d="M8 48q6-6 12 0t12 0t12 0t12 0M10 56q6-6 12 0t12 0t12 0"/><ellipse cx="30" cy="40" rx="21" ry="4"/><circle cx="30" cy="10" r="4"/><path d="m30 15-4 12 8 5 3 8M26 27l-5 13M29 20l11 5M42 15l-4 24"/><path d="m38 34-3 9 5 1 2-9z"/></svg></span>
      <span class="home-shortcut-label">Paddleboard</span>
    </a>
    <a class="home-shortcut home-shortcut-crossword" href="{{ '/crossword-creator/' | relative_url }}">
      <span class="home-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><rect x="8" y="8" width="48" height="48" rx="3"/><path d="M24 8v48M40 8v48M8 24h48M8 40h48"/><path d="M9 9h14v14H9zM41 41h14v14H41z" fill="currentColor"/><path d="m29 34 3-6 3 6M30 32h4"/></svg></span>
      <span class="home-shortcut-label">Crossword</span>
    </a>
    <a class="home-shortcut home-shortcut-code" aria-label="Latest coding project: Application Event Lab" title="Application Event Lab" href="{{ '/projects/application-event-lab/' | relative_url }}">
      <span class="home-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><rect x="6" y="10" width="52" height="42" rx="4"/><path d="M6 21h52M13 16h1M19 16h1M25 16h1m-3 13-7 7 7 7m20-14 7 7-7 7m-7-17-6 20"/></svg></span>
      <span class="home-shortcut-label">Latest code</span>
    </a>
    <a class="home-shortcut home-shortcut-writing" aria-label="Latest writing project: Blood Manatees" title="Blood Manatees" href="{{ '/blood-manatees/' | relative_url }}">
      <span class="home-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><path d="M14 7h27l9 9v41H14zM41 7v11h9M22 27h20M22 34h16M22 41h20M22 48h10"/></svg></span>
      <span class="home-shortcut-label">Latest writing</span>
    </a>
  </nav>
</section>

<script src="{{ '/assets/js/home-feed.js' | relative_url }}" defer></script>

<section class="home-blog" aria-labelledby="home-blog-heading">
  <div class="section-heading split-heading"><h2 id="home-blog-heading">Latest on the blog</h2><a class="text-link" href="{{ '/blog/' | relative_url }}">All posts &rarr;</a></div>
  <ul>
    {% assign blog_posts = site.posts | where_exp: "post", "post.layout != 'review'" %}
    {% for post in blog_posts limit: 3 %}
    <li><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d" }}</time></li>
    {% endfor %}
  </ul>
</section>

<section class="section review-section" id="latest-reviews" aria-labelledby="reviews-heading">
  <div class="section-heading split-heading">
    <div>
      <p class="eyebrow">Fresh from the theater</p>
      <h2 id="reviews-heading">Latest reviews</h2>
    </div>
    <a class="text-link" href="{{ '/reviews/' | relative_url }}">All reviews <span aria-hidden="true">→</span></a>
  </div>

  {% assign movie_reviews = site.posts | where: "layout", "review" %}
  {% if movie_reviews != empty %}
  <div class="review-grid">
    {% for review in movie_reviews limit: 6 %}
    <article class="review-card">
      {% if review.poster %}
      <a class="poster" href="{{ review.url | relative_url }}"><img src="{{ review.poster | relative_url }}" alt="{{ review.title }} poster" width="200" height="300" loading="lazy"></a>
      {% else %}
      <a class="poster poster-placeholder" href="{{ review.url | relative_url }}" aria-label="Read {{ review.title }}"><span aria-hidden="true">N</span></a>
      {% endif %}
      <div class="review-body">
        <p class="review-kicker">{% if review.film_year %}{{ review.film_year }} · {% endif %}{{ review.date | date: "%b %-d, %Y" }}</p>
        <h3><a href="{{ review.url | relative_url }}">{{ review.title }}</a></h3>
        {% if review.rating %}<p class="rating">{% include star-rating.html rating=review.rating %}</p>{% endif %}
        <p>{{ review.excerpt | strip_html | truncatewords: 24 }}</p>
      </div>
    </article>
    {% endfor %}
  </div>
  {% else %}
  <div class="empty-reel">
    <span aria-hidden="true">◎</span>
    <div><h3>The projector is warming up.</h3><p>My first full review is coming soon. Until then, browse everything I've logged on <a href="https://letterboxd.com/NolanMcD/">Letterboxd</a>.</p></div>
  </div>
  {% endif %}
</section>

<section class="home-rating-distribution" aria-labelledby="rating-distribution-heading">
  <header>
    <div><p class="eyebrow">The full Film Diary</p><h2 id="rating-distribution-heading">How I rate what I watch</h2></div>
    <p>Every logged rating, from the rare disasters to the movies I cannot stop recommending.</p>
  </header>
  <div class="home-rating-summary" id="home-rating-summary" aria-live="polite">
    <div><strong>—</strong><span>rated films</span></div>
    <div><strong>—</strong><span>average rating</span></div>
    <div><strong>—</strong><span>most common</span></div>
  </div>
  <div class="home-rating-chart" id="home-rating-chart" aria-label="Loading rating distribution">
    <p class="feed-loading">Loading the Film Diary distribution…</p>
  </div>
  <a class="text-link" href="{{ '/reviews/diary/' | relative_url }}">Explore every rating <span aria-hidden="true">→</span></a>
</section>

<section class="connect-strip" aria-labelledby="elsewhere-heading">
  <div><p class="eyebrow">Beyond the credits</p><h2 id="elsewhere-heading">There's more to explore.</h2></div>
  <div class="connect-links"><a href="{{ '/projects/' | relative_url }}">Projects</a><a href="{{ '/about/' | relative_url }}">About Nolan</a><a href="mailto:boltjets24@gmail.com">Email</a></div>
</section>
