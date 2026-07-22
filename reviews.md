---
title: Movie Reviews
permalink: /reviews/
description: All movie reviews published on Noland.
---

<p class="page-lede">Every movie review, from new releases to old favorites.</p>

{% assign movie_reviews = site.posts | where: "layout", "review" %}
{% if movie_reviews != empty %}
<div class="review-index">
{% for review in movie_reviews %}
  <article>
    {% if review.poster %}<a class="review-index-poster" href="{{ review.url | relative_url }}"><img src="{{ review.poster | relative_url }}" alt="{{ review.title }} poster" loading="lazy"></a>{% endif %}
    <div>
      <p class="review-kicker">{% if review.film_year %}{{ review.film_year }} · {% endif %}{{ review.date | date: "%B %-d, %Y" }}</p>
      <h2><a href="{{ review.url | relative_url }}">{{ review.title }}</a></h2>
      <p>{{ review.excerpt | strip_html | truncatewords: 32 }}</p>
    </div>
    {% if review.rating %}<p class="rating">{% include star-rating.html rating=review.rating %}</p>{% endif %}
  </article>
{% endfor %}
</div>
{% else %}
<div class="empty-reel"><span aria-hidden="true">◎</span><div><h2>No reviews published yet.</h2><p>The first one is on its way. My recent watches are on <a href="https://letterboxd.com/NolanMcD/">Letterboxd</a>.</p></div></div>
{% endif %}
