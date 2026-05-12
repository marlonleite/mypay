import { isNative } from '../platform'
import { apiClient } from '../apiClient'
import { fetchSettings } from '../settingsService'

async function loadImpl() {
  if (isNative()) {
    return import('./native.js')
  }
  return import('./web.js')
}

export async function initializeServiceWorker() {
  const impl = await loadImpl()
  return impl.initializeServiceWorker()
}

export async function requestNotificationPermission() {
  const impl = await loadImpl()
  return impl.requestNotificationPermission()
}

export function getNotificationPermission() {
  // Em native, a fonte de verdade é PushNotifications.checkPermissions (async).
  // Retornamos 'default' aqui para não bloquear a UI; enablePush dispara o flow nativo.
  if (isNative()) {
    return 'default'
  }
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function getFCMToken() {
  const impl = await loadImpl()
  return impl.getFCMToken()
}

export async function onForegroundMessage(callback) {
  const impl = await loadImpl()
  return impl.onForegroundMessage(callback)
}

/**
 * Foreground/local notification (all targets). Keeps sync API for hooks/UI.
 */
export function showLocalNotification(title, options = {}) {
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
      icon: '/logo-mypay.svg',
      badge: '/logo-mypay.svg',
      vibrate: [200, 100, 200],
      tag: 'mypay-local',
      ...options
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

export function isPushSupported() {
  // Em native, suporte vem do plugin Capacitor (sempre disponível no APK).
  // Android WebView pode não expor Notification API — não usar como gate.
  if (isNative()) {
    return true
  }
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** In-app digest alerts (not FCM); true when Notification API exists. */
export function supportsLocalNotificationPreview() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function saveFCMToken(_userId, token) {
  if (!token) {
    console.warn('Missing token')
    return false
  }

  try {
    await apiClient.post('/api/v1/push/register', { token })
    await fetchSettings({ force: true })
    console.log('FCM token saved (backend)')
    return true
  } catch (error) {
    console.error('Failed to save FCM token:', error)
    return false
  }
}

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
