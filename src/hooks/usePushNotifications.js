// Hook for managing push notifications
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchSettings, subscribeSettings } from '../services/settingsService'
import {
  initializeServiceWorker,
  requestNotificationPermission,
  getNotificationPermission,
  getFCMToken,
  saveFCMToken,
  disablePushNotifications,
  onForegroundMessage,
  showLocalNotification,
  isPushSupported
} from '../services/pushNotifications'

export function usePushNotifications() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [isEnabled, setIsEnabled] = useState(false)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if push is supported on mount and when isEnabled changes
  useEffect(() => {
    setIsSupported(isPushSupported())
    const currentPerm = getNotificationPermission()
    console.log('Push notification permission:', currentPerm)
    setPermission(currentPerm)
    setLoading(false)
  }, [isEnabled])

  // Load push settings from backend (settingsService dedupes concurrent calls).
  useEffect(() => {
    if (!user) {
      setIsEnabled(false)
      setToken(null)
      return
    }

    let cancelled = false

    fetchSettings()
      .then((settings) => {
        if (cancelled || !settings) return
        setIsEnabled(settings.pushEnabled || false)
        setToken(settings.pushToken || null)
      })
      .catch((err) => {
        console.error('Error loading push settings:', err)
        setError(err.message)
      })

    // Reage a mudanças vindas de outras abas/dispositivos via SSE → settingsService.
    const unsubscribe = subscribeSettings((settings) => {
      if (cancelled || !settings) return
      setIsEnabled(settings.pushEnabled || false)
      setToken(settings.pushToken || null)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  // Setup foreground message listener
  useEffect(() => {
    if (!isEnabled || !user) return

    let unsubscribe = () => {}

    const setupListener = async () => {
      unsubscribe = await onForegroundMessage((payload) => {
        // Show notification when app is in foreground
        const title = payload.notification?.title || 'myPay'
        const body = payload.notification?.body || ''

        showLocalNotification(title, {
          body,
          tag: payload.data?.tag || 'mypay-foreground',
          data: payload.data
        })
      })
    }

    setupListener()

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [isEnabled, user])

  // Enable push notifications
  const enablePush = useCallback(async () => {
    if (!user || !isSupported) {
      setError('Push notifications not supported')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      // Initialize service worker first
      await initializeServiceWorker()

      // Request permission
      const perm = await requestNotificationPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        setError('Permission denied')
        setLoading(false)
        return false
      }

      // Get FCM token
      const fcmToken = await getFCMToken()
      if (!fcmToken) {
        setError('Failed to get notification token')
        setLoading(false)
        return false
      }

      // Save token to Firestore
      const saved = await saveFCMToken(user.uid, fcmToken)
      if (!saved) {
        setError('Failed to save settings')
        setLoading(false)
        return false
      }

      setToken(fcmToken)
      setIsEnabled(true)
      setLoading(false)
      return true
    } catch (err) {
      console.error('Error enabling push:', err)
      setError(err.message)
      setLoading(false)
      return false
    }
  }, [user, isSupported])

  // Disable push notifications
  const disablePush = useCallback(async () => {
    if (!user) {
      return false
    }

    setLoading(true)
    setError(null)

    try {
      const disabled = await disablePushNotifications(user.uid)
      if (disabled) {
        setIsEnabled(false)
        setToken(null)
      }
      setLoading(false)
      return disabled
    } catch (err) {
      console.error('Error disabling push:', err)
      setError(err.message)
      setLoading(false)
      return false
    }
  }, [user])

  // Toggle push notifications
  const togglePush = useCallback(async () => {
    if (isEnabled) {
      return disablePush()
    } else {
      return enablePush()
    }
  }, [isEnabled, enablePush, disablePush])

  // Send a local test notification
  const sendTestNotification = useCallback(() => {
    // Check permission directly from browser API (not from state which might be stale)
    const currentPermission = getNotificationPermission()
    console.log('Test notification - permission:', currentPermission)

    if (currentPermission !== 'granted') {
      console.warn('Notification permission not granted:', currentPermission)
      return
    }

    console.log('Sending test notification...')
    const notification = showLocalNotification('Teste de Notificacao', {
      body: 'As notificacoes push estao funcionando!',
      tag: 'mypay-test'
    })
    console.log('Notification created:', notification)
  }, [])

  return {
    isSupported,
    permission,
    isEnabled,
    token,
    loading,
    error,
    enablePush,
    disablePush,
    togglePush,
    sendTestNotification,
    showLocalNotification
  }
}
