---
layout: landing
title: Home
description: Nolan McDermott's latest movie reviews, writing, adventures, and personal projects.
---

<section class="feed-hero" aria-labelledby="feed-heading">
  <header class="feed-heading">
    <div><p class="eyebrow">Movies, miles, and side quests</p><h1 id="feed-heading">My feed.</h1></div>
    <p>The latest things I've watched, made, and done—collected from across Noland.</p>
  </header>
  <div class="feed-grid">
    <article class="feed-lane feed-letterboxd">
      <header><span class="feed-mark" aria-hidden="true">★</span><div><p class="feed-source">Letterboxd</p><h2>Recently watched</h2></div></header>
      <div class="feed-items" id="home-letterboxd"><p class="feed-loading">Loading the latest reviews…</p></div>
      <a class="feed-footer-link" href="{{ '/reviews/diary/' | relative_url }}">Open the Film Diary <span aria-hidden="true">→</span></a>
    </article>
    <article class="feed-lane feed-strava">
      <header><span class="feed-mark" aria-hidden="true">↗</span><div><p class="feed-source">Strava</p><h2>Out there</h2></div></header>
      <div class="feed-items" id="home-strava"><p class="feed-loading">Loading the latest activity…</p></div>
      <a class="feed-footer-link" href="https://www.strava.com/athletes/57377386">Follow on Strava <span aria-hidden="true">→</span></a>
    </article>
    <article class="feed-lane feed-noland">
      <header><span class="feed-mark" aria-hidden="true">N</span><div><p class="feed-source">Noland</p><h2>Latest dispatch</h2></div></header>
      <div class="feed-items">
        {% assign feed_writing = site.posts | where_exp: "post", "post.layout != 'review'" %}
        {% for post in feed_writing limit: 1 %}
        <div class="feed-item"><p class="feed-date">{{ post.date | date: "%b %-d, %Y" }}</p><h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3><p>{{ post.excerpt | strip_html | truncatewords: 22 }}</p></div>
        {% endfor %}
      </div>
      <a class="feed-footer-link" href="{{ '/projects/' | relative_url }}">Explore the projects <span aria-hidden="true">→</span></a>
    </article>
  </div>
</section>

<script src="{{ '/assets/js/home-feed.js' | relative_url }}" defer></script>

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
      <a class="poster" href="{{ review.url | relative_url }}"><img src="{{ review.poster | relative_url }}" alt="{{ review.title }} poster" loading="lazy"></a>
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
