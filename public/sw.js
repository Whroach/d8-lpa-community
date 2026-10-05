/*
 * D8-LPA service worker.
 *
 * Deliberately small. It does NOT cache pages, API responses, photos or
 * messages - nothing personal is ever stored by it. It only:
 *   1. makes the app installable ("Add to Home Screen"), and
 *   2. shows a plain "you are offline" page when a page cannot be loaded.
 */
const CACHE = 'd8lpa-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  )
})
