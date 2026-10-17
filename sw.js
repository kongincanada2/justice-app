// 離線快取。更新程式檔案時請修改版本號；公開數據檔每次開啟時在背景更新。
const CACHE = 'justice-app-v2';
const DATA = 'data/region-data.json';
const FILES = ['./', 'index.html', 'styles.css', 'data.js', 'plans.js', 'region.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', DATA];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.url.endsWith(DATA)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match(e.request);
      const fresh = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => cached);
      return cached || fresh;
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
