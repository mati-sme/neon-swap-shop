/* Neon Swap Shop service worker — cache-first, bump CACHE on every release. */
'use strict';
const CACHE = 'neon-swap-shop-v2';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'js/data.js',
  'js/save.js',
  'js/audio.js',
  'js/sprites.js',
  'js/art.js',
  'js/input.js',
  'js/ui.js',
  'js/trade.js',
  'js/shop.js',
  'js/scavenge.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
