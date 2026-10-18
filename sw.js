// Service worker: čuva celu aplikaciju na uređaju, pa radi i bez interneta.
// Posle svake izmene fajlova povećajte VERSION da bi telefoni preuzeli novu verziju.
const VERSION = '1.0.0';
const CACHE = `elektro-odrzavanje-${VERSION}`;
const ASSETS = [
  './',
  'css/app.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'js/app.js',
  'js/backup.js',
  'js/csv.js',
  'js/db.js',
  'js/icons.js',
  'js/ics.js',
  'js/images.js',
  'js/pdf.js',
  'js/router.js',
  'js/seed.js',
  'js/store.js',
  'js/ui.js',
  'js/util.js',
  'js/views/equipment.js',
  'js/views/home.js',
  'js/views/photoInput.js',
  'js/views/reportForm.js',
  'js/views/reports.js',
  'js/views/settings.js',
  'js/views/viewer.js',
  'js/zip.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error()))),
  );
});
