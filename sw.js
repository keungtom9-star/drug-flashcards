const CACHE_NAME = 'drug-tutor-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './drugs.js',
  './prompts.js',
  './icon.png',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network first for Google Sheets CSV, Cache first for everything else
  if (event.request.url.includes('docs.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
