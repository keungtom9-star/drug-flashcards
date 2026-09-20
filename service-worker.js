// Scope-relative URLs also work at /drug-flashcards/ on GitHub Pages.
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `drug-tutor-${encodeURIComponent(APP_BASE.pathname)}-`;
const CACHE_NAME = `${CACHE_PREFIX}v9`;
const APP_SHELL = [
  './', './index.html', './ward.html', './drugquiz.html',
  './manifest.json', './app-ui.js', './drugs.js', './prompts.js',
  './apple-touch-icon.png', './icon.png'
].map(path => new URL(path, APP_BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  // Only cache the public app shell, not arbitrary same-origin data.
  url.search = '';
  if (!APP_SHELL.includes(url.href)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        // Keep each page under its own URL; Ward must never overwrite the home page.
        if (response.ok) await cache.put(url.href, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(url.href)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.href);
    return cached || fetch(request);
  })());
});
