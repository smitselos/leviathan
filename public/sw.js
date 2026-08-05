// public/sw.js
// Ελάχιστος service worker — υπάρχει ΜΟΝΟ για να είναι η εφαρμογή installable (PWA).
// ΔΕΝ κάνει caching. Παρεμβαίνει μόνο σε same-origin GET· οτιδήποτε άλλο
// (POST/PUT/PATCH/DELETE ή cross-origin, π.χ. googleapis.com) περνά απευθείας
// στον browser. Έτσι δεν σπάει πλέον το ανέβασμα αρχείων στο Google Drive από
// κινητό, που εμφανιζόταν ως «FetchEvent.respondWith received an error: Failed to fetch».
const SW_VERSION = 'v2-passthrough';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1) Μη-GET (ανεβάσματα, /api POST/PATCH/DELETE κ.λπ.) → καμία παρέμβαση.
  if (request.method !== 'GET') return;

  // 2) Cross-origin (Google Drive / APIs) → καμία παρέμβαση.
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // 3) Same-origin GET: απλή προώθηση στο δίκτυο (χωρίς cache).
  event.respondWith(fetch(request));
});
