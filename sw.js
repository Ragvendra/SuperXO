/* Offline cache.
   Every path is relative: GitHub Pages serves the site from /<repo>/, so a
   leading-slash path would resolve to the domain root and 404.

   Bump CACHE whenever any file below changes — that is what makes returning
   players pick up a new version. */
var CACHE = 'stt-v7';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/theme.css',
  './css/layout.css',
  './css/animations.css',
  './js/glyphs.js',
  './js/variants.js',
  './js/rules.js',
  './js/engine.js',
  './js/bot.js',
  './js/effects.js',
  './js/ui.js',
  './js/main.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); })
      /* Take over as soon as the new files are all cached. Without this a new
         worker waits until every tab of the site is closed — and a plain
         reload does not count — so an update looks like a failed deploy. It is
         safe because the page already running keeps the code it loaded; the
         new version appears on the next load. */
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;

      return fetch(req).then(function (res) {
        /* Cache same-origin successes too, so anything missed at install time
           still works offline on the next launch. */
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        /* Offline and not cached. A page load still gets the app shell. */
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
