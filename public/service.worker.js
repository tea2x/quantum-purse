self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('quantum-purse-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/logo.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});