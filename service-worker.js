const CACHE_NAME = 'gym-log-pro-v1.1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/main.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/icons/favicon.ico',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js',
    'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700&display=swap',
    'https://fonts.gstatic.com/s/sarabun/v14/DtVjJx26TKEr37c9WBjdprY.woff2' // Example font file, actual may vary
];

// Install event: cache all essential assets.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // Use addAll to fetch and cache all specified resources.
                // Using individual add requests to prevent failure of the entire batch if one asset fails.
                const promises = ASSETS_TO_CACHE.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn(`Failed to cache ${url}:`, err);
                    });
                });
                return Promise.all(promises);
            })
            .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker.
    );
});

// Activate event: clean up old caches.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open clients.
    );
});

// Fetch event: serve assets from cache first.
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response from cache.
                if (response) {
                    return response;
                }

                // Not in cache - fetch from network, cache it, and return response.
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                           if (!event.request.url.includes('chrome-extension')) { // Don't log errors for browser extensions
                             console.warn('Fetch failed for:', event.request.url);
                           }
                           return networkResponse;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and because we want the browser to consume the response
                        // as well as the cache consuming the response, we need
                        // to clone it so we have two streams.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('Fetch error:', error);
                    // Optionally, return a fallback page for failed navigation requests
                    // if (event.request.mode === 'navigate') {
                    //     return caches.match('/offline.html');
                    // }
                });
            })
    );
});