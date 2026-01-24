import { createContext, useContext, useState, useEffect } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

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

  // Load user preferences from Firestore when logged in
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const userPrefsRef = doc(db, `users/${user.uid}/settings/preferences`)
        const userPrefsDoc = await getDoc(userPrefsRef)

        if (userPrefsDoc.exists()) {
          const prefs = userPrefsDoc.data()
          if (prefs.showValues !== undefined) {
            setShowValuesState(prefs.showValues)
            localStorage.setItem('showValues', String(prefs.showValues))
          }
        }
      } catch (error) {
        console.error('Erro ao carregar preferências de privacidade:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserPreferences()
  }, [user])

  // Toggle visibility
  const toggleShowValues = async () => {
    const newValue = !showValues
    setShowValuesState(newValue)
    localStorage.setItem('showValues', String(newValue))

    // Save to Firestore if user is logged in
    if (user) {
      try {
        const userPrefsRef = doc(db, `users/${user.uid}/settings/preferences`)
        await updateDoc(userPrefsRef, { showValues: newValue }).catch(async () => {
          await setDoc(userPrefsRef, { showValues: newValue }, { merge: true })
        })
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
