const CACHE_NAME = 'pwa-device-display-cache-v1';
const urlsToCache = [
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/images/',
    '/images/GIPSPresents192x192.png',
    '/images/icon-192x192.png',
    '/images/favicon.ico',
    '/images/GIPSPresents512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // If not in cache, fetch from network
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and can only be consumed once. We consume it once to cache it
                        // and once the browser consumes it.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Optional: Intercept fetch requests for Google Presentations to allow embedding
// Google Presentations are likely cross-origin, so direct caching might be limited.
// This example primarily focuses on caching your app's static assets.
// Google Presentation embeds handle their own caching internally.