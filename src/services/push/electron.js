// Desktop Electron: local Notification API only (no FCM token in this phase)
export async function initializeServiceWorker() {
  return null
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  const permission = await Notification.requestPermission()
  return permission
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function getFCMToken() {
  return null
}

export async function onForegroundMessage(_callback) {
  return () => {}
}

export function isPushSupported() {
  return false
}
