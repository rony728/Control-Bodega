const BASE = '/Control-Bodega/';
const API_ORIGIN = 'https://api-control-bodega.rtdev.uk';
const CACHE = 'control-bodega-v3';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([BASE, `${BASE}index.html`, `${BASE}manifest.json`, `${BASE}icon.svg`])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (url.origin === API_ORIGIN) return event.respondWith(fetch(request));
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone())); return response; }).catch(() => caches.match(`${BASE}index.html`))));
});
