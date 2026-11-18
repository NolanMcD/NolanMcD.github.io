(() => {
  const feature = document.querySelector('[data-home-expedition]');
  if (!feature) return;

  try {
    const showSecond = sessionStorage.getItem('noland.expeditionPhoto') === 'first';
    feature.classList.toggle('is-second', showSecond);
    sessionStorage.setItem('noland.expeditionPhoto', showSecond ? 'second' : 'first');
  } catch (_) {
    // The first photo remains visible if browser storage is unavailable.
  }
})();
