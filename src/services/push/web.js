// Web: FCM + service worker (PWA)
import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance, firebaseConfig } from '../../firebase/config'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || null

let messagingInstance = null
let fcmServiceWorker = null

export async function initializeServiceWorker() {
  if (!isWebPushEnvironment()) {
    console.warn('Service workers not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    })

    await navigator.serviceWorker.ready

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

function isWebPushEnvironment() {
  return 'serviceWorker' in navigator
}

export async function getMessaging() {
  if (messagingInstance) {
    return messagingInstance
  }

  messagingInstance = await getMessagingInstance()
  return messagingInstance
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported')
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()
  console.log('Notification permission:', permission)
  return permission
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function getFCMToken() {
  try {
    const messaging = await getMessaging()
    if (!messaging) {
      console.warn('Firebase Messaging not supported')
      return null
    }

    if (!fcmServiceWorker) {
      await initializeServiceWorker()
    }

    const tokenOptions = {
      serviceWorkerRegistration: fcmServiceWorker
    }

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

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}
