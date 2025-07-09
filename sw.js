const CACHE_NAME = 'gym-log-v1.4'; // เปลี่ยนเวอร์ชันเพื่อบังคับอัปเดต
const urlsToCache = [
  '.',
  'index.html',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
