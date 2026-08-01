---
layout: landing
title: Home
description: Movie reviews, watchlists, and notes on cinema from Nolan McDermott.
---

<section class="movie-hero" aria-labelledby="movie-heading">
  <p class="eyebrow">Nolan's land</p>
  <h1 id="movie-heading">Movie reviews, screenplays.<br>and personal projects.</h1>
  <p class="hero-copy">Reviews, recommendations, and screenplays from a lifelong movie watcher—written after the credits roll.</p>
  <div class="hero-actions">
    <a class="button button-primary" href="#latest-reviews">Read the reviews</a>
    <a class="button button-secondary" href="https://letterboxd.com/NolanMcD/">Follow on Letterboxd</a>
  </div>
  <div class="film-strip" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
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

<section class="section writing-section" aria-labelledby="writing-heading">
  <div class="section-heading">
    <p class="eyebrow">Beyond the review</p>
    <h2 id="writing-heading">Latest writing</h2>
  </div>
  {% assign latest_writing = site.posts | where_exp: "post", "post.layout != 'review'" %}
  {% for post in latest_writing limit: 1 %}
  <article class="writing-card">
    <p class="review-kicker">{{ post.date | date: "%B %-d, %Y" }}</p>
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <p>{{ post.excerpt | strip_html }}</p>
    <a class="text-link" href="{{ post.url | relative_url }}">Read the post <span aria-hidden="true">→</span></a>
  </article>
  {% endfor %}
</section>

<section class="cinema-manifesto" aria-labelledby="why-heading">
  <p class="eyebrow">Why Noland?</p>
  <h2 id="why-heading">A place to think about what makes movies stick.</h2>
  <p class="manifesto-intro">I've been obsessed with movies since 2015. My rating system is simple: no half stars, no complicated math—just how strongly I'd recommend the movie.</p>
  <ol class="rating-scale" reversed aria-label="Nolan's five-star rating scale">
    <li><strong>5 stars</strong><span>A favorite. A must-see.</span></li>
    <li><strong>4 stars</strong><span>Great. I highly recommend it.</span></li>
    <li><strong>3 stars</strong><span>Good, and worth watching.</span></li>
    <li><strong>2 stars</strong><span>Below average. Not worth your time.</span></li>
    <li><strong>1 star</strong><span>Terrible. Avoid it.</span></li>
  </ol>
</section>

<section class="connect-strip" aria-labelledby="elsewhere-heading">
  <div><p class="eyebrow">Beyond the credits</p><h2 id="elsewhere-heading">There's more to explore.</h2></div>
  <div class="connect-links"><a href="{{ '/projects/' | relative_url }}">Projects</a><a href="{{ '/about/' | relative_url }}">About Nolan</a><a href="mailto:boltjets24@gmail.com">Email</a></div>
</section>
