const CACHE = 'viora-shell-v6';
const SHELL = ['/','/index.html','/app.html','/mobile.html','/manifest.json','/assets/x/icon32.png','/assets/mark.png','/assets/pwa-icon.svg','/assets/x/studio-polish.css','/assets/x/app-polish.css','/assets/x/viora-theme.css','/assets/x/chat-surface.css','/assets/x/pwa.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache API, auth, or user-specific chat responses.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('login') || url.pathname.includes('account')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('/mobile.html'))));
    return;
  }
  if (/\.(?:css|js)$/i.test(url.pathname)) {
    event.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
    return res;
  })));
});
