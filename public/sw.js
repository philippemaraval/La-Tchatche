const CACHE_PREFIX = 'la-tchatche'
const VERSION = 'v2'
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${VERSION}`
const AUDIO_CACHE = `${CACHE_PREFIX}-audio-v1`
const FALLBACK_HTML = '/index.html'

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon/favicon.ico',
  '/favicon/favicon-32x32.png',
  '/favicon/favicon-16x16.png',
  '/favicon/manifest.json',
]

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

function isAudioRequest(request) {
  return request.destination === 'audio' || /\.(mp3|m4a|aac|ogg|wav|flac|webm)(\?|#|$)/i.test(request.url)
}

function isNavigationRequest(request, url) {
  return request.mode === 'navigate' && isSameOrigin(url)
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await cache.addAll(SHELL_ASSETS)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, AUDIO_CACHE])
      const keys = await caches.keys()

      await Promise.all(
        keys
          .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !keep.has(key))
          .map((key) => caches.delete(key)),
      )

      await self.clients.claim()
    })(),
  )
})

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) {
    return cached
  }

  try {
    const network = await fetch(request)
    if (network && (network.ok || network.type === 'opaque')) {
      await cache.put(request, network.clone())
    }
    return network
  } catch {
    return cached || Response.error()
  }
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(SHELL_CACHE)

  try {
    const network = await fetch(request)
    if (network && network.ok) {
      await cache.put(request, network.clone())
    }
    return network
  } catch {
    const cachedRoute = await cache.match(request)
    if (cachedRoute) {
      return cachedRoute
    }

    const fallback = await cache.match(FALLBACK_HTML)
    return fallback || Response.error()
  }
}

async function handleShellRequest(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cached || networkPromise || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (isAudioRequest(request)) {
    event.respondWith(handleAudioRequest(request))
    return
  }

  if (isNavigationRequest(request, url)) {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  if (!isSameOrigin(url)) {
    return
  }

  if (url.pathname.startsWith('/api/')) {
    return
  }

  event.respondWith(handleShellRequest(request))
})
