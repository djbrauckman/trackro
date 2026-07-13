/**
 * sw.js
 * Minimal service worker: precaches the static app shell so the UI can boot
 * offline/on a flaky connection. Supabase/CDN requests are left untouched —
 * this is not an offline-data cache, just an offline-shell cache.
 */
const CACHE_NAME = 'trackro-shell-v1';
const SHELL_FILES = [
  'index.html',
  'weight.html',
  'exercise.html',
  'macros.html',
  'goals.html',
  'css/styles.css',
  'js/config.js',
  'js/supabaseClient.js',
  'js/utils.js',
  'js/nav.js',
  'js/gate.js',
  'js/dashboard.js',
  'js/weight.js',
  'js/exercise.js',
  'js/macros.js',
  'js/goals.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {}) // e.g. config.js missing in a dev checkout — don't block install
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate for same-origin shell files only.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
