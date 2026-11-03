/* Keep the chat shell inside the visible area when a mobile keyboard is open. */
(() => {
  const viewport = window.visualViewport;
  if (!viewport || !matchMedia('(max-width: 979px)').matches) return;
  let frame = 0;
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!matchMedia('(max-width: 979px)').matches) {
        document.documentElement.style.removeProperty('--viora-app-height');
        return;
      }
      const height = Math.max(240, Math.round(viewport.height));
      document.documentElement.style.setProperty('--viora-app-height', `${height}px`);
    });
  };
  viewport.addEventListener('resize', sync, { passive: true });
  viewport.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  sync();
})();
