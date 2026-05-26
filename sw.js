// ── Service Worker ── (save as sw.js in repo root)
const CACHE = 'lu-v4';
const ASSETS = ['./', './index.html', './js/app.js','./js/state.js','./js/data.js',
  './js/storage.js','./js/audio.js','./js/ui.js','./js/render.js',
  './js/notifications.js','./js/ai.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('offline'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
