// CacheStorage is shared by every app on this origin; keep this release scoped.
const CACHE = `aldi-list-v4:${self.registration.scope}`;
const PREVIOUS_CACHE = 'aldi-list-v3';
const ASSETS = ['./', './index.html', './styles.css?v=4', './app.js?v=4', './cart_items.json', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  // A failed download leaves the active worker in place. Bypass the HTTP cache
  // so a successful install contains the complete new shell before activation.
  const requests = ASSETS.map(path => new Request(new URL(path, self.registration.scope), {cache: 'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // Keep v3 assets for tabs that still reference the previous script/CSS. Do not
  // delete other apps' caches or touch the shopping list stored in localStorage.
  event.waitUntil(self.clients.claim());
});

async function cachedResponse(request) {
  return (await caches.match(request, {cacheName: CACHE})) ||
    (await caches.match(request, {cacheName: PREVIOUS_CACHE}));
}

async function networkFirst(request) {
  let response;
  try {
    response = await fetch(request, {cache: 'no-cache'});
    if (response.ok) {
      // Storage pressure must not turn a successful network response into an error.
      try { await (await caches.open(CACHE)).put(request, response.clone()); }
      catch (_) {}
      return response;
    }
  } catch (_) {}
  const cached = await cachedResponse(request);
  if (cached) return cached;
  // Only a navigation may fall back to HTML; a missing script must remain an error.
  if (request.mode === 'navigate') {
    const shell = await caches.match(new URL('./index.html', self.registration.scope), {cacheName: CACHE});
    if (shell) return shell;
  }
  return response || Response.error();
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(networkFirst(event.request));
});
