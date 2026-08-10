(function () {
  "use strict";

  var app = document.getElementById("sports-calendar");
  if (!app) return;

  var scriptBase = document.currentScript.src.replace(/\/assets\/js\/sports-calendar\.js(?:\?.*)?$/, "/assets/data/");
  var feedBase = "https://site.api.espn.com/apis/site/v2/sports/";
  var title = document.getElementById("sports-cal-heading");
  var grid = document.getElementById("sports-cal-grid");
  var filters = document.getElementById("sports-cal-filters");
  var status = document.getElementById("sports-cal-status");
  var details = document.getElementById("sports-cal-details");
  var todayPanel = document.getElementById("sports-cal-today");
  var viewedMonth = new Date();
  viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1);
  var config;
  var visibleLeagues = new Set();
  var eventsByDate = new Map();
  var requestNumber = 0;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function dateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function compactDate(date) {
    return dateKey(date).replace(/-/g, "");
  }

  function monthRange() {
    return {
      start: new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1),
      end: new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 0)
    };
  }

  function leagueById(id) {
    return config.leagues.find(function (league) { return league.id === id; });
  }

  function addEvent(event) {
    if (!event.date || !leagueById(event.league)) return;
    if (!eventsByDate.has(event.date)) eventsByDate.set(event.date, []);
    eventsByDate.get(event.date).push(event);
  }

  function normalizeFeedEvent(item, league) {
    var competition = item.competitions && item.competitions[0];
    var eventDate = new Date((competition && competition.date) || item.date);
    if (Number.isNaN(eventDate.getTime())) return null;
    return {
      date: dateKey(eventDate),
      league: league.id,
      title: item.shortName || item.name || league.label,
      time: eventDate.toISOString(),
      url: item.links && item.links[0] ? item.links[0].href : ""
    };
  }

  function loadLeague(league, range) {
    if (!league.feed) return Promise.resolve({ league: league, events: [], manual: true });
    var url = feedBase + league.feed + "/scoreboard?limit=1000&dates=" + compactDate(range.start) + "-" + compactDate(range.end);
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Schedule unavailable");
      return response.json();
    }).then(function (payload) {
      return {
        league: league,
        events: (payload.events || []).map(function (item) { return normalizeFeedEvent(item, league); }).filter(Boolean)
      };
    }).catch(function () {
      return { league: league, events: [], failed: true };
    });
  }

  function renderFilters() {
    filters.innerHTML = "";
    var all = element("button", "is-active", "All sports");
    all.type = "button";
    all.addEventListener("click", function () {
      visibleLeagues = new Set(config.leagues.map(function (league) { return league.id; }));
      Array.from(filters.children).forEach(function (button) { button.classList.toggle("is-active", button === all); });
      renderCalendar();
    });
    filters.appendChild(all);

    config.leagues.forEach(function (league) {
      var button = element("button", "", league.icon + " " + (league.shortLabel || league.label));
      button.type = "button";
      button.style.setProperty("--sport-color", league.color);
      button.addEventListener("click", function () {
        var onlyThis = visibleLeagues.size === 1 && visibleLeagues.has(league.id);
        visibleLeagues = onlyThis ? new Set(config.leagues.map(function (item) { return item.id; })) : new Set([league.id]);
        Array.from(filters.children).forEach(function (item, index) {
          item.classList.toggle("is-active", onlyThis ? index === 0 : item === button);
        });
        renderCalendar();
      });
      filters.appendChild(button);
    });
  }

  function eventsForDay(key) {
    return (eventsByDate.get(key) || []).filter(function (event) { return visibleLeagues.has(event.league); });
  }

  function showDay(key) {
    var dayEvents = eventsForDay(key);
    var date = new Date(key + "T12:00:00");
    details.innerHTML = "";
    details.appendChild(element("p", "eyebrow", "Selected day"));
    details.appendChild(element("h2", "", date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })));
    if (!dayEvents.length) {
      details.appendChild(element("p", "", "No followed events are listed for this date."));
      return;
    }
    var list = element("div", "sports-cal-event-list");
    dayEvents.sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); }).forEach(function (event) {
      var league = leagueById(event.league);
      var row = element("article", "sports-cal-event");
      row.style.setProperty("--sport-color", league.color);
      row.appendChild(element("span", "sports-cal-event-icon", league.icon));
      var copy = element("div");
      copy.appendChild(element("small", "", league.label));
      var heading = element("h3", "", event.title || league.label);
      copy.appendChild(heading);
      if (event.time) copy.appendChild(element("p", "", new Date(event.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })));
      row.appendChild(copy);
      if (event.url) {
        var link = element("a", "", "Details"); link.href = event.url; link.target = "_blank"; link.rel = "noopener"; row.appendChild(link);
      }
      list.appendChild(row);
    });
    details.appendChild(list);
  }

  function renderToday() {
    var key = dateKey(new Date());
    var dayEvents = eventsForDay(key);
    todayPanel.innerHTML = "";
    todayPanel.appendChild(element("strong", "", dayEvents.length ? dayEvents.length + " events today" : "A quiet day"));
    todayPanel.appendChild(element("span", "", dayEvents.length ? Array.from(new Set(dayEvents.map(function (event) { return leagueById(event.league).icon; }))).join(" ") : "No followed events listed"));
  }

  function renderCalendar() {
    var range = monthRange();
    title.textContent = viewedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    grid.innerHTML = "";
    for (var blank = 0; blank < range.start.getDay(); blank += 1) grid.appendChild(element("span", "sports-cal-blank"));

    for (var day = 1; day <= range.end.getDate(); day += 1) {
      var date = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), day);
      var key = dateKey(date);
      var dayEvents = eventsForDay(key);
      var leagues = Array.from(new Set(dayEvents.map(function (event) { return event.league; })));
      var cell = element("button", "sports-cal-day");
      cell.type = "button";
      cell.dataset.date = key;
      if (key === dateKey(new Date())) cell.classList.add("is-today");
      cell.setAttribute("aria-label", date.toLocaleDateString("en-US", { month: "long", day: "numeric" }) + (leagues.length ? ", " + leagues.length + " sports scheduled" : ", no followed events"));
      cell.appendChild(element("span", "sports-cal-number", String(day)));
      var marks = element("span", "sports-cal-marks");
      leagues.slice(0, 6).forEach(function (id) {
        var league = leagueById(id);
        var mark = element("i", "", league.icon);
        mark.title = league.label;
        mark.style.setProperty("--sport-color", league.color);
        marks.appendChild(mark);
      });
      if (leagues.length > 6) marks.appendChild(element("small", "", "+" + (leagues.length - 6)));
      cell.appendChild(marks);
      cell.addEventListener("click", function () {
        Array.from(grid.querySelectorAll(".is-selected")).forEach(function (item) { item.classList.remove("is-selected"); });
        this.classList.add("is-selected"); showDay(this.dataset.date);
      });
      grid.appendChild(cell);
    }
    renderToday();
  }

  function loadMonth() {
    var thisRequest = ++requestNumber;
    var range = monthRange();
    eventsByDate = new Map();
    (config.events || []).forEach(function (event) {
      if (event.date >= dateKey(range.start) && event.date <= dateKey(range.end)) addEvent(event);
    });
    status.textContent = "Loading schedules…";
    renderCalendar();
    Promise.all(config.leagues.map(function (league) { return loadLeague(league, range); })).then(function (results) {
      if (thisRequest !== requestNumber) return;
      var failed = 0;
      results.forEach(function (result) {
        if (result.failed) failed += 1;
        result.events.forEach(addEvent);
      });
      status.textContent = failed ? "Calendar loaded; " + failed + " schedule feed" + (failed === 1 ? " is" : "s are") + " temporarily unavailable." : "Schedules loaded.";
      renderCalendar();
    });
  }

  document.getElementById("sports-cal-previous").addEventListener("click", function () {
    viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1); loadMonth();
  });
  document.getElementById("sports-cal-next").addEventListener("click", function () {
    viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1); loadMonth();
  });
  document.getElementById("sports-cal-current").addEventListener("click", function () {
    var now = new Date(); viewedMonth = new Date(now.getFullYear(), now.getMonth(), 1); loadMonth();
  });

  fetch(scriptBase + "sports-calendar.json").then(function (response) {
    if (!response.ok) throw new Error("Configuration unavailable");
    return response.json();
  }).then(function (data) {
    config = data;
    visibleLeagues = new Set(config.leagues.map(function (league) { return league.id; }));
    renderFilters(); loadMonth();
  }).catch(function () {
    title.textContent = "Calendar unavailable";
    status.textContent = "The sports calendar configuration could not be loaded.";
  });
})();
