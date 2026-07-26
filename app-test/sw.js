/* Israel TEST edition — service worker. Precaches everything; the app is 100% offline.
   Same architecture as the China app, own cache namespace so the two never collide. */
var VERSION = 'iltest-v1.0.0';

/* CRITICAL — the app cannot work without these. If any fails, install fails and we retry. */
var CRITICAL = [
  './',
  './index.html',
  './manifest.webmanifest'
];
/* OPTIONAL — nice to have offline, but a failure must never break the whole install. */
var OPTIONAL = [
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];

function cacheOne(cache, url) {
  return fetch(url, { cache: 'reload' }).then(function (res) {
    /* only store a real, non-empty 200 — a 204/opaque/error response is worse than nothing */
    if (!res || res.status !== 200 || res.type === 'opaqueredirect') return null;
    return cache.put(url, res.clone());
  }).catch(function () { return null; });
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(CRITICAL).then(function () {
        return Promise.all(OPTIONAL.map(function (u) { return cacheOne(c, u); }));
      });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* Cache-first: never depend on the network to render.
   On a miss we try the network and, if that succeeds, backfill the cache
   (so an asset that failed at install time repairs itself next time online). */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline and not cached' });
      });
    })
  );
});
