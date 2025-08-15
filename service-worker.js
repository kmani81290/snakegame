
// Simple offline cache-first service worker
const CACHE_NAME = 'perk-dash-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
  './assets/icons/icon-64x64.png',
  './assets/icons/icon-128x128.png',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-256x256.png',
  './assets/icons/icon-384x384.png',
  './assets/icons/icon-512x512.png',
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  evt.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy));
      return res;
    }).catch(()=> caches.match('./index.html')))
  );
});
