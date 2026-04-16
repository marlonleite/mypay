// Push Notifications Service using Firebase Cloud Messaging
import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance, firebaseConfig } from '../firebase/config'
import { apiClient } from './apiClient'
import { fetchSettings } from './settingsService'

// VAPID key for web push (optional - can be configured in Firebase Console)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || null

let messagingInstance = null
let fcmServiceWorker = null

/**
 * Initialize the FCM service worker
 */
export async function initializeServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported')
    return null
  }

  try {
    // Register the FCM service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    })

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready

    // Send Firebase config to the service worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig
      })
    }

    fcmServiceWorker = registration
    console.log('FCM Service Worker registered:', registration)
    return registration
  } catch (error) {
    console.error('Failed to register FCM service worker:', error)
    return null
  }
}

/**
 * Get the FCM messaging instance
 */
export async function getMessaging() {
  if (messagingInstance) {
    return messagingInstance
  }

  messagingInstance = await getMessagingInstance()
  return messagingInstance
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported')
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()
  console.log('Notification permission:', permission)
  return permission
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Get FCM token for the current device
 */
export async function getFCMToken() {
  try {
    const messaging = await getMessaging()
    if (!messaging) {
      console.warn('Firebase Messaging not supported')
      return null
    }

    // Ensure service worker is registered
    if (!fcmServiceWorker) {
      await initializeServiceWorker()
    }

    const tokenOptions = {
      serviceWorkerRegistration: fcmServiceWorker
    }

    // Add VAPID key if configured
    if (VAPID_KEY) {
      tokenOptions.vapidKey = VAPID_KEY
    }

    const token = await getToken(messaging, tokenOptions)
    console.log('FCM Token:', token)
    return token
  } catch (error) {
    console.error('Failed to get FCM token:', error)
    return null
  }
}

/**
 * Save FCM token via backend POST /api/v1/push/register.
 *
 * Backend grava em `user_settings.push_token` + seta `push_enabled = true`.
 * `userId` é mantido no parâmetro pra preservar o callsite, mas não é mais
 * necessário (backend resolve via JWT). Platform/browser metadata foram
 * dropados pra não inflar a tabela — backend não usava esses campos.
 */
export async function saveFCMToken(_userId, token) {
  if (!token) {
    console.warn('Missing token')
    return false
  }

  try {
    await apiClient.post('/api/v1/push/register', { token })
    // Refresh cache do settingsService pra que NotificationContext reaja.
    await fetchSettings({ force: true })
    console.log('FCM token saved (backend)')
    return true
  } catch (error) {
    console.error('Failed to save FCM token:', error)
    return false
  }
}

/**
 * Disable push notifications via backend DELETE /api/v1/push/unregister.
 */
export async function disablePushNotifications(_userId) {
  try {
    await apiClient.delete('/api/v1/push/unregister')
    await fetchSettings({ force: true })
    console.log('Push notifications disabled')
    return true
  } catch (error) {
    console.error('Failed to disable push notifications:', error)
    return false
  }
}

/**
 * Listen for foreground messages
 */
export async function onForegroundMessage(callback) {
  const messaging = await getMessaging()
  if (!messaging) {
    return () => {}
  }

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload)
    callback(payload)
  })
}

/**
 * Show a local notification (for when app is in foreground)
 */
export function showLocalNotification(title, options = {}) {
  console.log('showLocalNotification called:', title, options)

  if (!('Notification' in window)) {
    console.warn('Notification API not available')
    return null
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted:', Notification.permission)
    return null
  }

  try {
    const notification = new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'mypay-local',
      ...options
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    console.log('Notification created successfully')
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}
