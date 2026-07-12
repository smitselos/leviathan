// public/sw.js
// Ελάχιστος service worker — αρκεί για να θεωρηθεί η εφαρμογή installable.
// Δεν κάνει caching, απλώς προωθεί τα requests στο δίκτυο.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
