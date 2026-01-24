import { useState, useEffect, useCallback } from 'react'

// Versão atual do app (será atualizada no build)
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

// Intervalo de verificação (5 minutos)
const CHECK_INTERVAL = 5 * 60 * 1000

export function useVersionCheck() {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    const saved = localStorage.getItem('dismissedVersion')
    return saved || null
  })

  const checkVersion = useCallback(async () => {
    try {
      // Adiciona timestamp para evitar cache
      const response = await fetch(`/version.json?t=${Date.now()}`)
      if (!response.ok) return

      const data = await response.json()
      const serverVersion = data.version

      // Se a versão do servidor for diferente da atual e não foi dismissada
      if (serverVersion !== CURRENT_VERSION && serverVersion !== dismissed) {
        setLatestVersion(serverVersion)
        setNewVersionAvailable(true)
      }
    } catch (error) {
      // Silently fail - não é crítico
      console.debug('Erro ao verificar versão:', error)
    }
  }, [dismissed])

  // Verifica ao montar e periodicamente
  useEffect(() => {
    // Primeira verificação após 10 segundos (para não atrasar o carregamento inicial)
    const initialTimeout = setTimeout(checkVersion, 10000)

    // Verificações periódicas
    const interval = setInterval(checkVersion, CHECK_INTERVAL)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [checkVersion])

  // Também verifica quando o usuário volta para a aba
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [checkVersion])

  const refresh = useCallback(() => {
    // Força recarregar a página sem cache
    window.location.reload(true)
  }, [])

  const dismiss = useCallback(() => {
    if (latestVersion) {
      localStorage.setItem('dismissedVersion', latestVersion)
      setDismissed(latestVersion)
    }
    setNewVersionAvailable(false)
  }, [latestVersion])

  return {
    newVersionAvailable,
    latestVersion,
    currentVersion: CURRENT_VERSION,
    refresh,
    dismiss
  }
}

export default useVersionCheck
