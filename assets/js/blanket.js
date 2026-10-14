(function () {
  'use strict';
  const source = document.getElementById('blanket-results');
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const controls = document.getElementById('blanket-thresholds');
  const windowSelect = document.getElementById('blanket-window');
  let threshold = 1;
  function render() {
    const row = data.thresholds.find(item => item.threshold === threshold);
    const full = windowSelect.value === 'full';
    const count = full ? row.count : row.late_count;
    const original = threshold === 1 && full;
    controls.querySelectorAll('button').forEach(button => {
      const active = Number(button.dataset.threshold) === threshold;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('blanket-count').textContent = count.toLocaleString();
    document.getElementById('blanket-count-label').textContent = original ? 'provisional Blankets' : 'pairings below selected threshold';
    document.getElementById('blanket-rate').textContent = (100 * count / data.screened_reps).toFixed(2) + '%';
    document.getElementById('blanket-lab-note').textContent = `Average separation < ${threshold} yard${threshold === 1 ? '' : 's'}, ${full ? 'from snap through throw' : 'from 0.5 seconds after the snap through throw'}.${original ? '' : ' Alternative settings; this is not the proposed Blanket definition.'}`;
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-threshold]');
    if (!button || !controls.contains(button)) return;
    threshold = Number(button.dataset.threshold);
    render();
  });
  windowSelect.addEventListener('change', render);
  render();
}());
