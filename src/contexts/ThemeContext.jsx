import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { fetchSettings, updateSettings, subscribeSettings } from '../services/settingsService'

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

  // Carregar preferências do backend quando usuário logar (settingsService dedupes).
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
        if (settings && settings.theme) {
          setThemeState(settings.theme)
          localStorage.setItem('theme', settings.theme)
        }
      } catch (error) {
        console.error('Erro ao carregar preferências:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUserPreferences()

    const unsubscribe = subscribeSettings((settings) => {
      if (!cancelled && settings && settings.theme) {
        setThemeState(settings.theme)
        localStorage.setItem('theme', settings.theme)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
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

  // Função para alterar o tema (otimista local + persiste no backend)
  const setTheme = async (newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)

    if (user) {
      try {
        await updateSettings({ theme: newTheme })
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
