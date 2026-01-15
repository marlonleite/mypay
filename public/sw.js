const CACHE_NAME = 'ipay-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error('Cache failed:', error)
      })
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - Network first, falling back to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Skip Firebase and API requests
  if (event.request.url.includes('firebaseapp.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        // Clone the response
        const responseToCache = response.clone()

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache)
          })

        return response
      })
      .catch(() => {
        return caches.match(event.request)
      })
  )
})
