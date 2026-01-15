import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config'

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
    })

    return () => unsubscribe()
  }, [])

  const loginWithGoogle = async () => {
    try {
      setError(null)
      const result = await signInWithPopup(auth, googleProvider)
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
