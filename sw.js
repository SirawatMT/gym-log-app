const CACHE_NAME = 'gym-log-v1.5'; // อัปเดตเวอร์ชันเพื่อบังคับอัปเดตแคช
const urlsToCache = [
  '.',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// เพิ่มส่วนนี้เพื่อลบแคชเก่าออกไป
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // ถ้าเจอในแคช, ส่งจากแคชเลย
        if (response) {
          return response;
        }
        // ถ้าไม่เจอ, ไปดึงจาก network
        return fetch(event.request);
      })
  );
});
