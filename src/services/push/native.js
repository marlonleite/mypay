// Capacitor Android: PushNotifications + Firebase Messaging token
import { PushNotifications } from '@capacitor/push-notifications'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'

export async function initializeServiceWorker() {
  let perm = await PushNotifications.checkPermissions()
  if (perm.receive !== 'granted') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    console.warn('Push notification permission not granted on native')
    return null
  }
  await PushNotifications.register()
  return null
}

export async function requestNotificationPermission() {
  const perm = await PushNotifications.requestPermissions()
  if (perm.receive === 'granted') return 'granted'
  if (perm.receive === 'denied') return 'denied'
  return 'default'
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function getFCMToken() {
  try {
    const { token } = await FirebaseMessaging.getToken()
    return token || null
  } catch (error) {
    console.error('Failed to get FCM token (native):', error)
    return null
  }
}

export async function onForegroundMessage(callback) {
  const handle = await FirebaseMessaging.addListener('notificationReceived', (event) => {
    const n = event.notification
    const data =
      n && typeof n.data === 'object' && n.data !== null && !Array.isArray(n.data)
        ? n.data
        : {}
    callback({
      notification: {
        title: n?.title,
        body: n?.body,
      },
      data,
    })
  })
  return () => {
    if (handle && typeof handle.remove === 'function') {
      handle.remove()
    }
  }
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}
