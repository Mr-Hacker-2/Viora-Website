/* Progressive Web App install support. Chat and sign-in still require internet. */
(() => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  let promptEvent = null;
  const button = document.getElementById('pwa-install');
  if (!button) return;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) button.hidden = false;
  button.addEventListener('click', async () => {
    if (promptEvent) {
      promptEvent.prompt();
      const result = await promptEvent.userChoice.catch(() => null);
      if (result?.outcome === 'accepted') button.hidden = true;
      promptEvent = null;
    } else {
      location.href = '/mobile.html';
    }
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    button.hidden = true;
  });
})();
