/* Progressive Web App install support. Chat and sign-in still require internet. */
(() => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  let promptEvent = null;
  const button = document.getElementById('pwa-install');
  if (!button) return;
  const row = button.closest('[data-pwa-row]') || button;
  if (matchMedia('(display-mode: standalone)').matches) row.hidden = true;
  button.addEventListener('click', async () => {
    if (promptEvent) {
      promptEvent.prompt();
      const result = await promptEvent.userChoice.catch(() => null);
      if (result?.outcome === 'accepted') row.hidden = true;
      promptEvent = null;
    } else {
      location.href = '/mobile.html';
    }
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    row.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    row.hidden = true;
  });
})();

/* Viora Labs bootstrap. Runs on app.html only (the page that has the chat sidebar).
   1) Viora Flash is the default chat model. A stored Humanizer / Pro Search / Math choice from before Labs existed is
      reset to Flash unless the person just launched it from Labs in this browser session.
   2) Loads the Labs stylesheet and script. */
(() => {
  if (!document.getElementById('sh-left') || !document.getElementById('thread')) return;
  try {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('viora_assistant')); } catch {}
    const fromLabs = sessionStorage.getItem('viora_labs_session') === '1';
    if (!stored || (['search', 'math', 'human'].includes(stored) && !fromLabs)) localStorage.setItem('viora_assistant', JSON.stringify('flash'));
  } catch {}
  const v = '?v=20261125-labs-plus-flash';
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = 'assets/labs/labs.css' + v;
  document.head.append(css);
  const js = document.createElement('script');
  js.src = 'assets/labs/labs.js' + v; js.defer = true;
  document.head.append(js);
})();