// Push Notifications Service using Firebase Cloud Messaging
import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, getMessagingInstance, firebaseConfig } from '../firebase/config'

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
 * Save FCM token to Firestore for the user
 */
export async function saveFCMToken(userId, token) {
  if (!userId || !token) {
    console.warn('Missing userId or token')
    return false
  }

  try {
    const pushSettingsRef = doc(db, `users/${userId}/settings/push`)
    await setDoc(pushSettingsRef, {
      enabled: true,
      token: token,
      updatedAt: serverTimestamp(),
      platform: navigator.userAgent.includes('Mobile') ? 'mobile' : 'web',
      browser: getBrowserInfo()
    }, { merge: true })

    console.log('FCM token saved to Firestore')
    return true
  } catch (error) {
    console.error('Failed to save FCM token:', error)
    return false
  }
}

/**
 * Disable push notifications for the user
 */
export async function disablePushNotifications(userId) {
  if (!userId) {
    return false
  }

  try {
    const pushSettingsRef = doc(db, `users/${userId}/settings/push`)
    await setDoc(pushSettingsRef, {
      enabled: false,
      token: null,
      updatedAt: serverTimestamp()
    }, { merge: true })

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
 * Get browser info for debugging
 */
function getBrowserInfo() {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Unknown'
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
