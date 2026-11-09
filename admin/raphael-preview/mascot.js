"use strict";
// Pause decorative work outside the viewport and while the tab is hidden.
(() => {
  const slot = document.querySelector('.raphael-slot');
  if (!slot) return;
  let visible = true;
  const sync = () => slot.classList.toggle('is-suspended', document.hidden || !visible);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0 }).observe(slot);
  }
  document.addEventListener('visibilitychange', sync);
  sync();
})();
