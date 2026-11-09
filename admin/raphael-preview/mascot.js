"use strict";
(() => {
  const slot = document.querySelector('.raphael-slot');
  const displacement = slot?.querySelector('.rp-displacement');
  if (!slot || !displacement) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, frame = 0, elapsed = 0, last = 0;
  // Continuous horizontal displacement keeps the centre/staff anchored and the
  // wing roots connected. Limit updates to 30fps at the small display size.
  function tick(now) {
    if (!last) last = now;
    const delta = now - last;
    if (delta >= 1000 / 30) {
      elapsed += Math.min(delta, 100);
      last = now;
      displacement.setAttribute('scale', String(20 + 100 * Math.sin(elapsed * Math.PI / 2000)));
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    const paused = document.hidden || !visible;
    slot.classList.toggle('is-suspended', paused);
    cancelAnimationFrame(frame);
    last = 0;
    if (reduced.matches) displacement.setAttribute('scale', '0');
    else if (!paused) frame = requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }).observe(slot);
  }
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
