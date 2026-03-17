const SHELL_CACHE = 'la-tchatche-shell-v1'
const AUDIO_CACHE = 'la-tchatche-audio-v1'

const SHELL_ASSETS = ['/', '/index.html', '/favicon/favicon.ico', '/favicon/favicon-32x32.png', '/favicon/favicon-16x16.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

function isAudioRequest(request) {
  return request.destination === 'audio' || request.url.includes('.mp3')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  if (isAudioRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE)
        const cached = await cache.match(request, { ignoreSearch: true })
        if (cached) {
          return cached
        }

        try {
          const network = await fetch(request)
          if (network && (network.ok || network.type === 'opaque')) {
            cache.put(request, network.clone())
          }
          return network
        } catch {
          return cached || Response.error()
        }
      })(),
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      const cached = await cache.match(request)
      const networkPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => null)

      return cached || networkPromise || Response.error()
    })(),
  )
})
