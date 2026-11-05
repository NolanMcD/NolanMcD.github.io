---
title: "My top directors of all time, two ways"
date: 2026-11-05
layout: post
categories: [movies, data]
excerpt: "Spielberg has collected the most stars from me. Nolan has the highest average. Here are 18 directors, 216 films, and two ways to sort them."
---

I have been ranking individual directors' movies on Letterboxd for years. Put all those lists together, and I can finally ask a slightly different question: which directors have I given the most stars to?

There are two ways I wanted to look at it. **Total stars** adds up every rating and rewards a director whose work I keep coming back to. **Average rating** divides that total by the number of films and asks how much I tend to like a movie when their name is on it. Both tell me something useful about my taste.

Steven Spielberg finishes first in total stars, with **74 across 21 films**, just ahead of Alfred Hitchcock's 73. Christopher Nolan leads on average: **4.15 out of five across 13 films**. Stanley Kubrick comes next at 3.90, followed by Peter Weir and Quentin Tarantino, tied at 3.80. Nolan is third on total stars, too, which is a pretty good showing by either measure.

Scroll through the directors below, or switch the order to see who rises when every movie counts equally toward an average. Each poster belongs to my number-one film on that director's Letterboxd list. Open the film list to see every rating that went into the numbers.

<link rel="stylesheet" href="{{ '/assets/css/director-rankings.css' | relative_url }}">

{% assign ranking = site.data.director_rankings %}
{% assign total_leader = ranking.directors | first %}
<section class="director-rankings" aria-label="My director rankings">
  <div class="dr-overview">
    <div><strong>{{ ranking.directors | size }}</strong><span>directors &amp; teams</span></div>
    <div><strong>{{ ranking.filmCount }}</strong><span>rated films</span></div>
    <div><strong>{{ ranking.totalStars | round: 1 }}</strong><span>stars given out</span></div>
  </div>
  <div class="dr-toolbar" hidden>
    <span>Rank directors by</span>
    <div role="group" aria-label="Ranking order">
      <button type="button" data-director-sort="total" aria-pressed="true">Total stars</button>
      <button type="button" data-director-sort="average" aria-pressed="false">Average rating</button>
    </div>
  </div>
  <p class="dr-status" aria-live="polite" aria-atomic="true">Ordered by total stars. Equal scores share a rank.</p>
  <div class="dr-list">
  {% for director in ranking.directors %}
    {% assign images = site.data.director_images[director.id] %}
    {% assign favorite = director.films | first %}
    {% assign bar_width = director.total | times: 100.0 | divided_by: total_leader.total %}
    <article class="dr-card" id="director-{{ director.id }}" data-name="{{ director.name | escape }}" data-total="{{ director.total }}" data-average="{{ director.average }}" data-total-rank="{{ director.totalRank }}" data-average-rank="{{ director.averageRank }}">
      <header class="dr-card-header">
        <div class="dr-portrait"><span aria-hidden="true">{{ director.name | slice: 0 }}</span>{% if images.portrait %}<img src="{{ images.portrait.url | escape }}" alt="{{ director.name | escape }}" loading="lazy" width="110" height="130" referrerpolicy="no-referrer">{% endif %}</div>
        <div class="dr-name"><p class="dr-place">No. <span class="dr-rank">{{ director.totalRank }}</span></p><h2>{{ director.name }}</h2><a href="{{ director.listUrl }}">My Letterboxd ranking &rarr;</a></div>
      </header>
      <div class="dr-card-body">
        <div class="dr-numbers">
          <dl>
            <div class="dr-total"><dt>Total stars</dt><dd>{{ director.total | round: 1 }} <span aria-hidden="true">★</span></dd><small>Rank {{ director.totalRank }}</small></div>
            <div class="dr-average"><dt>Average rating</dt><dd>{{ director.average | round: 2 }}<small> / 5</small></dd><small>Rank {{ director.averageRank }}</small></div>
          </dl>
          <div class="dr-bar" aria-hidden="true"><span style="width: {{ bar_width }}%"></span></div>
          <p class="dr-film-count">{{ director.count }} films <span aria-hidden="true">·</span> {{ director.fiveStars }} five-star ratings</p>
          <p class="dr-favorite"><span>My top pick</span><a href="{{ favorite.url }}">{{ favorite.title }}</a> <small>({{ favorite.year }})</small></p>
        </div>
        <a class="dr-poster" href="{{ favorite.url }}" aria-label="{{ favorite.title | escape }} on Letterboxd"><span>{{ favorite.title }}</span>{% if images.poster %}<img src="{{ images.poster.url | escape }}" alt="{{ favorite.title | escape }} poster" loading="lazy" width="120" height="180" referrerpolicy="no-referrer">{% endif %}</a>
      </div>
      <details class="dr-films"><summary>All {{ director.count }} films and my ratings</summary><p>In my Letterboxd list order.</p><ol>
        {% for film in director.films %}<li><a href="{{ film.url }}">{{ film.title }} <small>({{ film.year }})</small></a><strong>{{ film.rating | round: 1 }} <span aria-label="stars">★</span></strong></li>{% endfor %}
      </ol></details>
      <details class="dr-credits"><summary>Image credits</summary><ul>{% for item in images %}{% assign credit = item[1] %}<li><a href="{{ credit.source | escape }}">{{ item[0] | capitalize }} source</a>{% if credit.artist != '' %} · {{ credit.artist | escape }}{% endif %} · {% if credit.licenseUrl != '' %}<a href="{{ credit.licenseUrl | escape }}">{{ credit.license | escape }}</a>{% else %}{{ credit.license | escape }}{% endif %}{% if item[0] == 'portrait' %}. Cropped to fit.{% endif %}</li>{% endfor %}</ul></details>
    </article>
  {% endfor %}
  </div>
</section>

## What these rankings cover

This is a snapshot of **the directors represented in my exported ranking lists**, and only the movies included in those lists. It is not a complete ranking of every director I have ever watched, or a claim that I have seen every film these directors made. The Coen brothers count as one filmmaking team, following my list.

Each film contributes one rating, regardless of how many times I have watched it. Total stars is the sum of those ratings. Average rating is that sum divided by the number of films. There is no minimum-film cutoff or weighting adjustment. A smaller list can beat a larger one on average, so the film count stays visible in both views. Averages are displayed to two decimal places; sorting uses the full value.

Equal scores share a rank. Within a tie, the other measure decides display order, then the director's name. My ordering of a director's individual films stays exactly as it was in the exported list, even when two films have the same star rating.

The numbers use my Letterboxd ratings export, supplemented by Film Diary ratings for *Barry Lyndon*, *Eyes Wide Shut*, and *Lolita*. *Paths of Glory* includes my four-star rating from November 5. Franchise, studio, author, and recommendation lists are excluded.

## What I take from it

The Spielberg and Hitchcock result makes sense as a measure of how much great movie-watching they have given me. They have the two largest lists here, and those extra films add up. Nolan's average tells me something else: across the thirteen films in my list, his work has been unusually reliable for my taste.

I like being able to keep both answers. Sometimes I want to reward the size of a body of work I have enjoyed. Sometimes I want to know whose next movie I am most likely to love. These rankings give me a way to look at both, and the individual film lists make it easy to see where the numbers come from.

<script src="{{ '/assets/js/director-rankings.js' | relative_url }}" defer></script>
