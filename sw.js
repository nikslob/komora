// Bump on every release so old caches get dropped
const CACHE = 'komora-v0.4';
const FILES = [
  './', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './vendor/barcode-detector.js', './vendor/zxing_reader.wasm',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Own files: network first so updates arrive, cache when offline. Everything else (Open Food Facts) goes straight to the network.
self.addEventListener('fetch', e => {
  let url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  let cacheable = !url.pathname.endsWith('.wasm');
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && cacheable) {
          let copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
