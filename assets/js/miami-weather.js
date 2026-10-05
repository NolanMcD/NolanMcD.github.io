(() => {
  const formatter = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'});
  function refresh() {
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    document.querySelectorAll('[data-weather-date]').forEach(element => {
      const warning = element.querySelector('[data-weather-stale]');
      if (!warning) return;
      const date = element.dataset.weatherDate;
      warning.hidden = date === today;
      warning.textContent = date < today ? `Archived report from ${date}. Check the latest briefing and NWS for current weather.` : date > today ? `Report dated ${date}; check NWS for current weather.` : '';
    });
  }
  refresh();
  setInterval(refresh, 60000);
})();
