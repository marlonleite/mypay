import { useEffect, useCallback } from 'react'

/**
 * Hook para gerenciar atalhos de teclado globais
 * @param {Object} shortcuts - Objeto com atalhos e callbacks
 * @param {boolean} enabled - Se os atalhos estão habilitados
 *
 * Formato dos atalhos:
 * {
 *   'mod+k': () => openSearch(),      // mod = Cmd (Mac) ou Ctrl (Windows)
 *   'mod+n': () => newTransaction(),
 *   'escape': () => closeModal()
 * }
 */
export function useKeyboardShortcuts(shortcuts, enabled = true) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return

    // Ignorar se estiver digitando em input/textarea
    const target = event.target
    const isInput = target.tagName === 'INPUT' ||
                   target.tagName === 'TEXTAREA' ||
                   target.isContentEditable

    // Construir a combinação de teclas
    const parts = []

    // mod = Cmd no Mac, Ctrl no Windows
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? event.metaKey : event.ctrlKey

    if (modKey) parts.push('mod')
    if (event.shiftKey) parts.push('shift')
    if (event.altKey) parts.push('alt')

    // Adicionar a tecla principal
    let key = event.key.toLowerCase()
    if (key === ' ') key = 'space'

    parts.push(key)
    const combination = parts.join('+')

    // Verificar se existe um handler para essa combinação
    const handler = shortcuts[combination]

    if (handler) {
      // Permitir Escape mesmo em inputs
      if (key === 'escape' || !isInput) {
        event.preventDefault()
        event.stopPropagation()
        handler(event)
      }
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

/**
 * Hook pré-configurado com atalhos globais do app
 */
export function useGlobalShortcuts({
  onSearch,
  onNewTransaction,
  onTogglePrivacy,
  onToggleTheme,
  onHelp
} = {}) {
  const shortcuts = {}

  if (onSearch) shortcuts['mod+k'] = onSearch
  if (onNewTransaction) shortcuts['mod+n'] = onNewTransaction
  if (onTogglePrivacy) shortcuts['mod+h'] = onTogglePrivacy
  if (onToggleTheme) shortcuts['mod+d'] = onToggleTheme
  if (onHelp) shortcuts['mod+/'] = onHelp

  useKeyboardShortcuts(shortcuts)
}
