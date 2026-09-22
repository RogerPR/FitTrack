const CACHE_NAME = 'fittrack-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Cache-first for the app shell so it opens without waiting on the network.
// Hashed assets are immutable; everything else (index.html, manifest, icon) is served
// from cache and refreshed in the background. When a fresh index.html differs from the
// cached one, open pages get an 'update-available' message and show a reload bar.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return

  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(event, request.mode === 'navigate'))
  }
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(event, notifyOnChange) {
  const { request } = event
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(request)

  const refresh = fetch(request)
    .then(async res => {
      if (!res.ok) return res
      if (notifyOnChange && hit) {
        const [before, after] = await Promise.all([hit.clone().text(), res.clone().text()])
        if (before !== after) notifyClients()
      }
      await cache.put(request, res.clone())
      return res
    })
    .catch(() => null)

  if (hit) {
    event.waitUntil(refresh)
    return hit
  }
  const res = await refresh
  return res || new Response('Offline', { status: 503 })
}

function notifyClients() {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    for (const c of clients) c.postMessage({ type: 'update-available' })
  })
}
