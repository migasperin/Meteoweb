const CACHE_NAME = 'radar-meteo-v2'; // Passato a v2 per forzare il refresh della cache
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    // Forza il nuovo service worker ad attivarsi immediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', event => {
    // Pulisce le cache obsolete (come la v1)
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('rainviewer') || event.request.url.includes('tile')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
