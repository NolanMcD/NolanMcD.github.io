(function () {
  "use strict";

  var letterboxd = document.getElementById("home-letterboxd");
  var strava = document.getElementById("home-strava");
  var ratingChart = document.getElementById("home-rating-chart");
  var ratingSummary = document.getElementById("home-rating-summary");
  if (!letterboxd || !strava) return;
  var base = document.currentScript.src.replace(/\/assets\/js\/home-feed\.js(?:\?.*)?$/, "/assets/data/");

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function dateLabel(value) {
    if (!value) return "Recent activity";
    return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function reviewItem(entry) {
    var item = element("div", "feed-item");
    item.appendChild(element("p", "feed-date", dateLabel(entry.watchedDate) + (entry.rewatch ? " · Rewatch" : "")));
    var heading = element("h3");
    var link = element("a", "", entry.title + " (" + entry.year + ")");
    link.href = entry.url; link.rel = "noopener"; heading.appendChild(link); item.appendChild(heading);
    var rating = element("p", "feed-rating", "★".repeat(entry.rating) + "☆".repeat(5 - entry.rating));
    rating.setAttribute("aria-label", entry.rating + " out of 5 stars"); item.appendChild(rating);
    item.appendChild(element("p", "", entry.review.split(/\s+/).slice(0, 23).join(" ") + (entry.wordCount > 23 ? "…" : "")));
    return item;
  }

  function activityItem(activity) {
    var item = element("div", "feed-item");
    item.appendChild(element("p", "feed-date", activity.type + (activity.date ? " · " + dateLabel(activity.date) : "")));
    var heading = element("h3");
    var link = element("a", "", activity.title); link.href = activity.url; link.rel = "noopener"; heading.appendChild(link); item.appendChild(heading);
    if (activity.summary) item.appendChild(element("p", "", activity.summary));
    if (activity.stats && activity.stats.length) item.appendChild(element("p", "feed-activity-stats", activity.stats.join(" · ")));
    return item;
  }

  fetch(base + "latest-letterboxd.json").then(function (response) {
    if (!response.ok) throw new Error(); return response.json();
  }).then(function (entries) {
    letterboxd.innerHTML = "";
    entries.slice(0, 2).forEach(function (entry) { letterboxd.appendChild(reviewItem(entry)); });
  }).catch(function () { letterboxd.innerHTML = '<p class="feed-loading">Visit the Film Diary for the latest reviews.</p>'; });

  fetch(base + "strava-feed.json").then(function (response) {
    if (!response.ok) throw new Error(); return response.json();
  }).then(function (activities) {
    strava.innerHTML = "";
    activities.slice(0, 2).forEach(function (activity) { strava.appendChild(activityItem(activity)); });
  }).catch(function () { strava.innerHTML = '<p class="feed-loading">Visit Strava for the latest activity.</p>'; });

  function renderRatingDistribution(distribution) {
    var counts = [0, 0, 0, 0, 0, 0];
    distribution.ratings.forEach(function (entry) {
      counts[Number(entry.rating)] = Number(entry.count);
    });

    var total = counts.reduce(function (sum, count) { return sum + count; }, 0);
    if (!total) throw new Error("No ratings found");
    var maximum = Math.max.apply(null, counts);
    var weightedTotal = counts.reduce(function (sum, count, rating) { return sum + count * rating; }, 0);
    var mostCommon = counts.indexOf(maximum);

    ratingChart.innerHTML = "";
    ratingChart.setAttribute("aria-label", "Distribution of " + total.toLocaleString() + " film ratings");
    for (var rating = 5; rating >= 1; rating -= 1) {
      var count = counts[rating];
      var percentage = count / total * 100;
      var row = element("div", "home-rating-row");
      row.setAttribute("aria-label", rating + " stars: " + count.toLocaleString() + " films, " + percentage.toFixed(1) + " percent");
      row.appendChild(element("strong", "home-rating-label", rating + " ★"));
      var track = element("span", "home-rating-track");
      var bar = element("i", "home-rating-bar");
      bar.style.width = (count / maximum * 100).toFixed(2) + "%";
      track.appendChild(bar);
      row.appendChild(track);
      var value = element("span", "home-rating-value");
      value.appendChild(element("b", "", count.toLocaleString()));
      value.appendChild(element("small", "", percentage.toFixed(1) + "%"));
      row.appendChild(value);
      ratingChart.appendChild(row);
    }

    var summaries = ratingSummary.querySelectorAll("div");
    summaries[0].querySelector("strong").textContent = total.toLocaleString();
    summaries[1].querySelector("strong").textContent = (weightedTotal / total).toFixed(2) + " ★";
    summaries[2].querySelector("strong").textContent = mostCommon + " stars";
  }

  if (ratingChart && ratingSummary) {
    fetch(base + "rating-distribution.json").then(function (response) {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(renderRatingDistribution).catch(function () {
      ratingChart.innerHTML = '<p class="feed-loading">Open the Film Diary to explore the complete rating history.</p>';
    });
  }
}());
