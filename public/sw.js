/* Static shell only. Research data and API responses never enter this cache. */
const PREFIX = 'qisu-hub-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + '__BUILD__';
const FILES = ['app.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const urls = FILES.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)));
  // Updates wait until all application windows close, preserving ongoing edits.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = ''; url.hash = '';
  if (!urls.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.href)) || fetch(event.request)));
});
