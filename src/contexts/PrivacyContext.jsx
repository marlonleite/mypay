import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { fetchSettings, updateSettings, subscribeSettings } from '../services/settingsService'

const PrivacyContext = createContext()

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider')
  }
  return context
}

const HIDDEN_VALUE = 'R$ •••••'

export function PrivacyProvider({ children }) {
  const { user } = useAuth()

  const [showValues, setShowValuesState] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('showValues')
    return saved === null ? true : saved === 'true'
  })

  const [loading, setLoading] = useState(true)

  // Load user preferences from backend (settingsService cacheia + dedupes).
  useEffect(() => {
    let cancelled = false

    const loadUserPreferences = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const settings = await fetchSettings()
        if (cancelled) return
        if (settings && typeof settings.showValues === 'boolean') {
          setShowValuesState(settings.showValues)
          localStorage.setItem('showValues', String(settings.showValues))
        }
      } catch (error) {
        console.error('Erro ao carregar preferências de privacidade:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUserPreferences()

    // Reage a mudanças de outros contexts (ex.: settings reset).
    const unsubscribe = subscribeSettings((settings) => {
      if (!cancelled && settings && typeof settings.showValues === 'boolean') {
        setShowValuesState(settings.showValues)
        localStorage.setItem('showValues', String(settings.showValues))
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  // Toggle visibility (otimista local + persiste no backend)
  const toggleShowValues = async () => {
    const newValue = !showValues
    setShowValuesState(newValue)
    localStorage.setItem('showValues', String(newValue))

    if (user) {
      try {
        await updateSettings({ showValues: newValue })
      } catch (error) {
        console.error('Erro ao salvar preferência de privacidade:', error)
      }
    }
  }

  // Format currency with privacy support (for Dashboard only)
  const formatCurrencyPrivate = (value) => {
    if (!showValues) {
      return HIDDEN_VALUE
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  // Format currency always visible (for other pages)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  return (
    <PrivacyContext.Provider value={{
      showValues,
      toggleShowValues,
      formatCurrencyPrivate,
      formatCurrency,
      loading
    }}>
      {children}
    </PrivacyContext.Provider>
  )
}
