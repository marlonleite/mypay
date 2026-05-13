import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchSettings, updateSettings, subscribeSettings } from '../services/settingsService'
import {
  readStoredAccentPreset,
  applyAccentToDocument,
  storeAccentPreset,
  readStoredHighContrast,
  storeHighContrast,
  applyHighContrastToDocument,
  readContrastFollowSystem,
  storeContrastFollowSystem,
  isAccentPresetId,
  DEFAULT_ACCENT_PRESET,
} from '../utils/appearance'

const ThemeContext = createContext()

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark'

  const saved = localStorage.getItem('theme')
  if (saved && saved !== 'auto') return saved

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyTheme = (themeMode) => {
  const root = document.documentElement
  if (themeMode === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
  }
}

if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme())
}

export function ThemeProvider({ children }) {
  const { user } = useAuth()

  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'auto'
    const saved = localStorage.getItem('theme')
    return saved || 'auto'
  })

  const [effectiveTheme, setEffectiveTheme] = useState(() => getInitialTheme())

  const [accentPreset, setAccentPresetState] = useState(readStoredAccentPreset)
  const [highContrastManual, setHighContrastManualState] = useState(readStoredHighContrast)
  const [contrastFollowSystem, setContrastFollowSystemState] = useState(readContrastFollowSystem)

  const [prefersContrastMore, setPrefersContrastMore] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-contrast: more)').matches
  )

  const [loading, setLoading] = useState(true)

  const persistAppearanceSilent = useCallback(async (partial) => {
    if (!user) return
    try {
      await updateSettings(partial)
    } catch (err) {
      console.warn('Aparência: não sincronizada com o servidor (campos opcionais).', err)
    }
  }, [user])

  const mergeAppearanceFromSettings = useCallback((settings) => {
    if (!settings) return
    if (settings.accentPreset && isAccentPresetId(settings.accentPreset)) {
      setAccentPresetState(settings.accentPreset)
      storeAccentPreset(settings.accentPreset)
      applyAccentToDocument(settings.accentPreset)
    }
    if (typeof settings.contrastFollowSystem === 'boolean') {
      setContrastFollowSystemState(settings.contrastFollowSystem)
      storeContrastFollowSystem(settings.contrastFollowSystem)
    }
    if (typeof settings.highContrastManual === 'boolean') {
      setHighContrastManualState(settings.highContrastManual)
      storeHighContrast(settings.highContrastManual)
    }
  }, [])

  const effectiveHighContrast =
    highContrastManual || (contrastFollowSystem && prefersContrastMore)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-contrast: more)')
    const onChange = () => setPrefersContrastMore(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyHighContrastToDocument(effectiveHighContrast)
  }, [effectiveHighContrast])

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
        mergeAppearanceFromSettings(settings)
      } catch (error) {
        console.error('Erro ao carregar preferências:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUserPreferences()

    const unsubscribe = subscribeSettings((settings) => {
      if (cancelled) return
      if (settings && settings.theme) {
        setThemeState(settings.theme)
        localStorage.setItem('theme', settings.theme)
      }
      mergeAppearanceFromSettings(settings)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user, mergeAppearanceFromSettings])

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

    mediaQuery.addEventListener('change', updateEffectiveTheme)
    return () => mediaQuery.removeEventListener('change', updateEffectiveTheme)
  }, [theme])

  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

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

  const setAccentPreset = useCallback(
    (presetId) => {
      const id = isAccentPresetId(presetId) ? presetId : DEFAULT_ACCENT_PRESET
      setAccentPresetState(id)
      storeAccentPreset(id)
      applyAccentToDocument(id)
      void persistAppearanceSilent({ accentPreset: id })
    },
    [persistAppearanceSilent]
  )

  const setHighContrast = useCallback(
    (enabled) => {
      setHighContrastManualState(enabled)
      storeHighContrast(enabled)
      void persistAppearanceSilent({ highContrastManual: enabled })
    },
    [persistAppearanceSilent]
  )

  const setContrastFollowSystem = useCallback(
    (enabled) => {
      setContrastFollowSystemState(enabled)
      storeContrastFollowSystem(enabled)
      void persistAppearanceSilent({ contrastFollowSystem: enabled })
    },
    [persistAppearanceSilent]
  )

  return (
    <ThemeContext.Provider
      value={{
        theme,
        effectiveTheme,
        setTheme,
        loading,
        accentPreset,
        setAccentPreset,
        /** Manual high-contrast checkbox (also stored as high_contrast in API when available). */
        highContrast: highContrastManual,
        setHighContrast,
        contrastFollowSystem,
        setContrastFollowSystem,
        prefersContrastMore,
        effectiveHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
