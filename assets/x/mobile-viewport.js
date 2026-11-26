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

/* Orb experience for the chat app: the design layer is appended last so it sits at the end of the cascade,
   then the bridge connects the orb to the app's real activity (see orb-bridge.js). */
(() => {
  if (!document.getElementById('thread') || !document.getElementById('composer')) return;
  const base = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('orb-ui.css', base).href;
  document.head.appendChild(css);
  import(new URL('orb-bridge.js', base).href).catch(() => { /* the app works without the orb */ });
})();
