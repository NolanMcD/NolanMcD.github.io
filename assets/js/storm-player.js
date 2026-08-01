(function () {
  "use strict";

  var audio = document.getElementById("storm-audio");
  var list = document.getElementById("storm-list");
  if (!audio || !list) return;

  var title = document.getElementById("storm-now-title");
  var detail = document.getElementById("storm-now-detail");
  var count = document.getElementById("storm-count");
  var previous = document.getElementById("storm-previous");
  var next = document.getElementById("storm-next");
  var shuffle = document.getElementById("storm-shuffle");
  var tracks = [];
  var current = -1;
  var shuffled = false;
  var base = document.currentScript.src.replace(/\/assets\/js\/storm-player\.js(?:\?.*)?$/, "/assets/audio/");

  function durationLabel(seconds) {
    if (!Number.isFinite(seconds)) return "Length loading";
    var rounded = Math.round(seconds);
    var hours = Math.floor(rounded / 3600);
    var minutes = Math.floor((rounded % 3600) / 60);
    var secs = rounded % 60;
    if (hours) return hours + " hr " + minutes + " min";
    if (minutes) return minutes + " min " + secs + " sec";
    return secs + " sec";
  }

  function collectionDurationLabel(seconds) {
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.round((seconds % 3600) / 60);
    if (minutes === 60) { hours += 1; minutes = 0; }
    return hours ? hours + " hr " + minutes + " min" : minutes + " min";
  }

  function fileUrl(file) {
    return /^https?:\/\//i.test(file) ? file : base + encodeURIComponent(file);
  }

  function updateButtons() {
    list.querySelectorAll("button").forEach(function (button, index) {
      var active = index === current;
      button.classList.toggle("is-playing", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function playTrack(index, autoplay) {
    if (!tracks.length) return;
    current = (index + tracks.length) % tracks.length;
    var track = tracks[current];
    audio.src = track.url;
    title.textContent = "Storm · " + durationLabel(track.duration);
    detail.textContent = track.date || "Recorded in Miami";
    updateButtons();
    if (autoplay) audio.play().catch(function () {
      detail.textContent = "Press play to begin this storm.";
    });
  }

  function nextIndex(direction) {
    if (shuffled && tracks.length > 1) {
      var choice = current;
      while (choice === current) choice = Math.floor(Math.random() * tracks.length);
      return choice;
    }
    return current + direction;
  }

  function render() {
    list.innerHTML = "";
    var knownDuration = tracks.reduce(function (sum, track) {
      return sum + (Number.isFinite(track.duration) ? track.duration : 0);
    }, 0);
    count.textContent = tracks.length + (tracks.length === 1 ? " recording" : " recordings") +
      (knownDuration ? " · " + collectionDurationLabel(knownDuration) : "");
    tracks.forEach(function (track, index) {
      var button = document.createElement("button");
      var name = document.createElement("strong");
      var meta = document.createElement("span");
      button.type = "button";
      button.className = "storm-track";
      name.textContent = "Storm · " + durationLabel(track.duration);
      meta.textContent = track.date || "Miami field recording";
      button.appendChild(name);
      button.appendChild(meta);
      button.addEventListener("click", function () { playTrack(index, true); });
      list.appendChild(button);

      if (!Number.isFinite(track.duration)) {
        var probe = new Audio();
        probe.preload = "metadata";
        probe.addEventListener("loadedmetadata", function () {
          track.duration = probe.duration;
          name.textContent = "Storm · " + durationLabel(track.duration);
          if (index === current) title.textContent = name.textContent;
        });
        probe.src = track.url;
      }
    });
    playTrack(0, false);
  }

  fetch(base + "storms.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Catalog could not be loaded");
      return response.json();
    })
    .then(function (items) {
      tracks = items.filter(function (item) { return item && item.file; }).map(function (item) {
        var seconds = Number(item.duration);
        return { url: fileUrl(item.file), date: item.date || "", duration: seconds > 0 ? seconds : NaN };
      });
      if (!tracks.length) {
        list.innerHTML = '<p class="storm-empty">The recordings are being prepared. Check back when the next storm rolls through.</p>';
        count.textContent = "Coming soon";
        document.getElementById("storm-player").classList.add("is-empty");
        return;
      }
      render();
    })
    .catch(function () {
      list.innerHTML = '<p class="storm-empty">The storm archive could not be loaded. Please try again soon.</p>';
      count.textContent = "Unavailable";
    });

  audio.addEventListener("ended", function () { playTrack(nextIndex(1), true); });
  previous.addEventListener("click", function () { playTrack(nextIndex(-1), true); });
  next.addEventListener("click", function () { playTrack(nextIndex(1), true); });
  shuffle.addEventListener("click", function () {
    shuffled = !shuffled;
    shuffle.textContent = shuffled ? "Shuffle on" : "Shuffle off";
    shuffle.setAttribute("aria-pressed", String(shuffled));
  });
}());
