(function () {
  "use strict";

  var ratingChart = document.getElementById("home-rating-chart");
  var ratingSummary = document.getElementById("home-rating-summary");
  if (!ratingChart || !ratingSummary) return;
  var base = document.currentScript.src.replace(/\/assets\/js\/home-feed\.js(?:\?.*)?$/, "/assets/data/");

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

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
