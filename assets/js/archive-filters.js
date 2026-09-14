(() => {
  "use strict";
  const stream = document.getElementById("archive-stream");
  if (!stream) return;
  const cards = [...stream.querySelectorAll("[data-archive-tags]")];
  const buttons = [...document.querySelectorAll("[data-archive-filter]")];
  const count = document.getElementById("archive-count");
  const empty = document.getElementById("archive-empty");
  function applyFilter() {
    let value;
    try { value = decodeURIComponent(location.hash.slice(1)) || "all"; } catch (_) { value = "all"; }
    if (!buttons.some(button => button.dataset.archiveFilter === value)) value = "all";
    let visible = 0;
    cards.forEach(card => {
      const tags = card.dataset.archiveTags.toLowerCase().split(/\s+/);
      const show = value === "all" || value.split(",").some(tag => tags.includes(tag));
      card.hidden = !show;
      if (show) visible++;
    });
    buttons.forEach(button => {
      const selected = button.dataset.archiveFilter === value;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    count.textContent = `${visible} ${visible === 1 ? "entry" : "entries"}`;
    empty.hidden = visible !== 0;
  }
  buttons.forEach(button => button.addEventListener("click", () => {
    // A real URL state makes filtered lists shareable and browser Back useful.
    const hash = button.dataset.archiveFilter;
    if (location.hash.slice(1) !== hash) history.pushState(null, "", `#${hash}`);
    applyFilter();
  }));
  window.addEventListener("popstate", applyFilter);
  window.addEventListener("hashchange", applyFilter);
  applyFilter();
})();
