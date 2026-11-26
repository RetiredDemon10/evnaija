/* EV Naija service worker — hand-written, no build-time PWA dependency. */
const VERSION = 'ev-naija-v1.0.0'
const STATIC_CACHE = `${VERSION}-static`
const PAGES_CACHE = `${VERSION}-pages`
const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/ev-naija-logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  // Media under /videos/ is left to the browser HTTP cache: video range requests
  // break cacheFirst, and letting the service worker serve the hero poster would
  // invalidate the <link rel="preload"> (cross-world resource mismatch).
  if (url.pathname.startsWith('/videos/')) return false
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(?:css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|webmanifest|json)$/i.test(url.pathname)
  )
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(PAGES_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cachedPage = await caches.match(request)
    if (cachedPage) return cachedPage
    const appShell = await caches.match('/')
    if (appShell) return appShell
    return caches.match('/offline.html')
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request).catch(() => Response.error()))
  }
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (data.type === 'SHOW_NOTIFICATION' && data.title) {
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.options?.body ?? '',
        icon: data.options?.icon ?? '/icon-192.png',
        badge: data.options?.badge ?? '/icon-192.png',
        tag: data.options?.tag,
        requireInteraction: Boolean(data.options?.requireInteraction),
        data: data.options?.data ?? { url: '/app/bookings' },
      }),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/app/bookings'
  const destination = new URL(target, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin)) {
            client.navigate(destination)
            return client.focus()
          }
        }
        return self.clients.openWindow(destination)
      }),
  )
})
