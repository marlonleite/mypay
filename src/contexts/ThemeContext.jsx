import { createContext, useContext, useState, useEffect } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

const ThemeContext = createContext()

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Função para determinar o tema inicial antes do render
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark'

  const saved = localStorage.getItem('theme')
  if (saved && saved !== 'auto') return saved

  // Auto: detectar preferência do sistema
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Aplicar tema imediatamente para evitar flash
const applyTheme = (theme) => {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
  }
}

// Aplicar tema inicial imediatamente
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme())
}

export function ThemeProvider({ children }) {
  const { user } = useAuth()

  // Carregar tema salvo ou usar 'auto' como padrão
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'auto'
    const saved = localStorage.getItem('theme')
    return saved || 'auto'
  })

  // Tema efetivo (resolve 'auto' para 'light' ou 'dark')
  const [effectiveTheme, setEffectiveTheme] = useState(() => getInitialTheme())

  // Loading state para evitar flash enquanto carrega do Firestore
  const [loading, setLoading] = useState(true)

  // Carregar preferências do Firestore quando usuário logar
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
          if (prefs.theme) {
            setThemeState(prefs.theme)
            localStorage.setItem('theme', prefs.theme)
          }
        } else {
          // Se não existe documento, criar com a preferência atual
          const currentTheme = localStorage.getItem('theme') || 'auto'
          await setDoc(userPrefsRef, { theme: currentTheme })
        }
      } catch (error) {
        console.error('Erro ao carregar preferências:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserPreferences()
  }, [user])

  // Detectar preferência do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateEffectiveTheme = () => {
      if (theme === 'auto') {
        setEffectiveTheme(mediaQuery.matches ? 'dark' : 'light')
      } else {
        setEffectiveTheme(theme)
      }
    }

    updateEffectiveTheme()

    // Listener para mudanças na preferência do sistema
    mediaQuery.addEventListener('change', updateEffectiveTheme)
    return () => mediaQuery.removeEventListener('change', updateEffectiveTheme)
  }, [theme])

  // Aplicar tema ao documento
  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

  // Função para alterar o tema
  const setTheme = async (newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)

    // Salvar no Firestore se usuário estiver logado
    if (user) {
      try {
        const userPrefsRef = doc(db, `users/${user.uid}/settings/preferences`)
        await updateDoc(userPrefsRef, { theme: newTheme }).catch(async () => {
          // Se o documento não existir, criar
          await setDoc(userPrefsRef, { theme: newTheme })
        })
      } catch (error) {
        console.error('Erro ao salvar preferência de tema:', error)
      }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  )
}
