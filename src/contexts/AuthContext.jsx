import { createContext, useContext, useEffect, useState } from 'react'
import {
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '../firebase/config'
import { signInWithGoogle as signInWithGoogleFacade } from '../services/auth'
import { connect as connectEventStream, disconnect as disconnectEventStream } from '../services/eventStream'
import { clearSettingsCache } from '../services/settingsService'
import { clearTransactionPaidOverrides } from '../utils/recurrencePaidDisplay'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
      // SSE: conecta no login, desconecta no logout. connect() é idempotente.
      if (user) {
        connectEventStream()
      } else {
        disconnectEventStream()
        clearSettingsCache()
        clearTransactionPaidOverrides()
      }
    })

    return () => unsubscribe()
  }, [])

  const loginWithGoogle = async () => {
    try {
      setError(null)
      const result = await signInWithGoogleFacade()
      return result.user
    } catch (error) {
      console.error('Error signing in with Google:', error)
      setError(getErrorMessage(error.code))
      throw error
    }
  }

  const logout = async () => {
    try {
      setError(null)
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
      setError(getErrorMessage(error.code))
      throw error
    }
  }

  const getErrorMessage = (code) => {
    const messages = {
      'auth/unauthorized-domain': 'Domínio não autorizado no Firebase. Verifique Authentication → Authorized domains (localhost / 127.0.0.1).',
      'auth/popup-closed-by-user': 'Login cancelado. Tente novamente.',
      'auth/popup-blocked': 'O popup foi bloqueado. Permita popups para este site.',
      'auth/cancelled-popup-request': 'Operação cancelada.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento.',
    }
    return messages[code] || 'Ocorreu um erro. Tente novamente.'
  }

  const value = {
    user,
    loading,
    error,
    loginWithGoogle,
    logout,
    clearError: () => setError(null)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
