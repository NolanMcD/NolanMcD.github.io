(() => {
  const experience = document.querySelector('.bm-experience');
  const opening = document.querySelector('[data-bm-opening]');
  const scene = document.querySelector('[data-bm-scene]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sceneAudio;

  const navigate = (url) => {
    if (!url) return;
    if (sceneAudio) sceneAudio.pause();
    if (reduceMotion) {
      window.location.assign(url);
      return;
    }
    experience.classList.add('is-leaving');
    window.setTimeout(() => window.location.assign(url), 260);
  };

  if (opening) {
    const advance = () => navigate(opening.dataset.nextUrl);
    opening.addEventListener('click', (event) => {
      if (!event.target.closest('button')) advance();
    });
    opening.querySelector('[data-bm-continue]').addEventListener('click', advance);
    opening.addEventListener('keydown', (event) => {
      if (event.target.closest('button')) return;
      if (['ArrowRight', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        advance();
      }
    });
    opening.focus({ preventScroll: true });
  }

  if (!scene) return;

  const audioSource = scene.dataset.audioSrc;
  if (audioSource) {
    const audio = new Audio(audioSource);
    sceneAudio = audio;
    audio.loop = true;
    const control = scene.querySelector('[data-bm-audio]');
    const updateControl = () => {
      const playing = !audio.paused;
      control.textContent = playing ? (audio.muted ? 'Unmute' : 'Mute') : 'Play audio';
      control.setAttribute('aria-label', control.textContent + ' for this scene');
    };
    control.addEventListener('click', async () => {
      if (audio.paused) {
        try { await audio.play(); } catch (_) { /* Browser permission can require another tap. */ }
      } else {
        audio.muted = !audio.muted;
      }
      updateControl();
    });
    audio.addEventListener('play', updateControl);
    audio.addEventListener('pause', updateControl);
    window.addEventListener('pagehide', () => { audio.pause(); audio.currentTime = 0; });
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-bm-direction]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.href);
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('a, button, input, textarea, select')) return;
    if (event.key === 'ArrowRight' && scene.dataset.nextUrl) {
      event.preventDefault();
      navigate(scene.dataset.nextUrl);
    }
    if (event.key === 'ArrowLeft' && scene.dataset.previousUrl) {
      event.preventDefault();
      navigate(scene.dataset.previousUrl);
    }
  });
})();
