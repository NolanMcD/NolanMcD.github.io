(function () {
  "use strict";

  var list = document.getElementById("diary-list");
  if (!list) return;

  var controls = {
    form: document.getElementById("diary-filters"),
    search: document.getElementById("diary-search"),
    rating: document.getElementById("diary-rating"),
    year: document.getElementById("diary-year"),
    source: document.getElementById("diary-source"),
    sort: document.getElementById("diary-sort"),
    rewatch: document.getElementById("diary-rewatch"),
    reset: document.getElementById("diary-reset"),
    more: document.getElementById("diary-more"),
    count: document.getElementById("diary-result-count"),
    stats: document.getElementById("diary-stats"),
    error: document.getElementById("diary-error")
  };
  var entries = [];
  var visible = 24;
  var pageSize = 24;
  var dataUrl = document.currentScript.src.replace(/\/assets\/js\/film-diary\.js(?:\?.*)?$/, "/assets/data/film-diary.json");

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function makeStars(rating) {
    var stars = element("span", "diary-stars", "★".repeat(rating) + "☆".repeat(5 - rating));
    stars.setAttribute("aria-label", rating + " out of 5 stars");
    return stars;
  }

  function makeChip(text, className) {
    return element("span", "diary-chip " + (className || ""), text);
  }

  function makeEntry(entry) {
    var card = element("article", "diary-entry");
    var header = element("header", "diary-entry-header");
    var headingWrap = element("div");
    var kicker = element("p", "review-kicker", formatDate(entry.watchedDate) + (entry.rewatch ? " · Rewatch" : ""));
    var heading = element("h2");
    var titleLink = element("a", "", entry.title);
    titleLink.href = entry.url;
    titleLink.rel = "noopener";
    heading.appendChild(titleLink);
    heading.appendChild(document.createTextNode(" "));
    heading.appendChild(element("span", "diary-film-year", "(" + entry.year + ")"));
    headingWrap.appendChild(kicker);
    headingWrap.appendChild(heading);
    header.appendChild(headingWrap);
    header.appendChild(makeStars(entry.rating));
    card.appendChild(header);

    if (entry.wordCount > 75) {
      var preview = entry.review.split(/\s+/).slice(0, 42).join(" ") + "…";
      card.appendChild(element("p", "diary-review diary-preview", preview));
      var details = element("details", "diary-full-review");
      details.appendChild(element("summary", "", "Read the full " + entry.wordCount + "-word review"));
      details.appendChild(element("p", "diary-review", entry.review));
      card.appendChild(details);
    } else {
      card.appendChild(element("p", "diary-review", entry.review));
    }

    if ((entry.viewingSources && entry.viewingSources.length) || (entry.awardTagsReliable && entry.awardTags.length)) {
      var meta = element("div", "diary-chips");
      (entry.viewingSources || []).forEach(function (source) { meta.appendChild(makeChip(source, "diary-source-chip")); });
      if (entry.awardTagsReliable) {
        entry.awardTags.forEach(function (tag) { meta.appendChild(makeChip("★ " + tag, "diary-award-chip")); });
      }
      card.appendChild(meta);
    }

    var footer = element("footer", "diary-entry-footer");
    if (entry.origin === "rss" && (!entry.tags || !entry.tags.length)) {
      footer.appendChild(element("span", "diary-sync-note", "Viewing tags arrive with the next export"));
    } else {
      footer.appendChild(element("span", "diary-sync-note", "Synced from Letterboxd"));
    }
    var sourceLink = element("a", "", "View on Letterboxd →");
    sourceLink.href = entry.url;
    sourceLink.rel = "noopener";
    footer.appendChild(sourceLink);
    card.appendChild(footer);
    return card;
  }

  function filteredEntries() {
    var query = controls.search.value.trim().toLowerCase();
    var rating = controls.rating.value;
    var year = controls.year.value;
    var source = controls.source.value;
    var result = entries.filter(function (entry) {
      var searchable = [entry.title, entry.review, entry.year].concat(entry.tags || []).join(" ").toLowerCase();
      return (!query || searchable.indexOf(query) !== -1) &&
        (!rating || String(entry.rating) === rating) &&
        (!year || String(entry.watchedDate || "").slice(0, 4) === year) &&
        (!source || (entry.viewingSources || []).indexOf(source) !== -1) &&
        (!controls.rewatch.checked || entry.rewatch);
    });
    var direction = controls.sort.value;
    result.sort(function (a, b) {
      if (direction === "oldest") return a.publishedDate.localeCompare(b.publishedDate);
      if (direction === "highest") return b.rating - a.rating || b.publishedDate.localeCompare(a.publishedDate);
      if (direction === "lowest") return a.rating - b.rating || b.publishedDate.localeCompare(a.publishedDate);
      return b.publishedDate.localeCompare(a.publishedDate);
    });
    return result;
  }

  function render() {
    var filtered = filteredEntries();
    var shown = filtered.slice(0, visible);
    list.innerHTML = "";
    var fragment = document.createDocumentFragment();
    shown.forEach(function (entry) { fragment.appendChild(makeEntry(entry)); });
    if (!shown.length) fragment.appendChild(element("p", "diary-no-results", "No films match those filters."));
    list.appendChild(fragment);
    controls.count.textContent = filtered.length.toLocaleString() + (filtered.length === 1 ? " review" : " reviews");
    controls.more.hidden = shown.length >= filtered.length;
  }

  function populateFilters() {
    var years = {};
    var sources = {};
    entries.forEach(function (entry) {
      if (entry.watchedDate) years[entry.watchedDate.slice(0, 4)] = true;
      (entry.viewingSources || []).forEach(function (source) { sources[source] = true; });
    });
    Object.keys(years).sort().reverse().forEach(function (year) {
      var option = element("option", "", year); option.value = year; controls.year.appendChild(option);
    });
    Object.keys(sources).sort().forEach(function (source) {
      var option = element("option", "", source); option.value = source; controls.source.appendChild(option);
    });
  }

  function updateStats() {
    var unique = {};
    var rewatches = 0;
    entries.forEach(function (entry) { unique[entry.title.toLowerCase() + "|" + entry.year] = true; if (entry.rewatch) rewatches += 1; });
    controls.stats.innerHTML = "";
    [[entries.length.toLocaleString(), "reviews"], [Object.keys(unique).length.toLocaleString(), "films"], [rewatches.toLocaleString(), "rewatches"]].forEach(function (stat) {
      var box = element("span"); box.appendChild(element("strong", "", stat[0])); box.appendChild(document.createTextNode(" " + stat[1])); controls.stats.appendChild(box);
    });
  }

  fetch(dataUrl).then(function (response) {
    if (!response.ok) throw new Error("Film Diary request failed");
    return response.json();
  }).then(function (data) {
    entries = data;
    populateFilters();
    updateStats();
    render();
  }).catch(function () {
    controls.error.hidden = false;
    controls.count.textContent = "Archive unavailable";
  });

  controls.form.addEventListener("input", function () { visible = pageSize; render(); });
  controls.form.addEventListener("change", function () { visible = pageSize; render(); });
  controls.form.addEventListener("reset", function () { setTimeout(function () { visible = pageSize; render(); }, 0); });
  controls.more.addEventListener("click", function () { visible += pageSize; render(); });
}());

