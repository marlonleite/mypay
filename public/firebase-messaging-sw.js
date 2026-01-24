// Firebase Messaging Service Worker
// Handles push notifications when the app is in the background

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

// Firebase config will be injected when the service worker is registered
// For now, we initialize with a placeholder that gets the config from the message
let messaging = null

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const firebaseConfig = event.data.config

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig)
      messaging = firebase.messaging()

      // Handle background messages
      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Background message:', payload)

        const notificationTitle = payload.notification?.title || 'myPay'
        const notificationOptions = {
          body: payload.notification?.body || '',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: payload.data?.tag || 'mypay-notification',
          data: payload.data || {},
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'dismiss', title: 'Dispensar' }
          ]
        }

        self.registration.showNotification(notificationTitle, notificationOptions)
      })
    }
  }
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event)

  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/')
        }
      })
  )
})

// Handle push events (fallback for when onBackgroundMessage doesn't fire)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event:', event)

  if (event.data) {
    try {
      const payload = event.data.json()

      // Only show notification if it wasn't handled by onBackgroundMessage
      if (payload.notification) {
        const notificationTitle = payload.notification.title || 'myPay'
        const notificationOptions = {
          body: payload.notification.body || '',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: payload.data?.tag || 'mypay-push',
          data: payload.data || {},
          vibrate: [200, 100, 200]
        }

        event.waitUntil(
          self.registration.showNotification(notificationTitle, notificationOptions)
        )
      }
    } catch (e) {
      console.error('[firebase-messaging-sw.js] Error parsing push data:', e)
    }
  }
})
