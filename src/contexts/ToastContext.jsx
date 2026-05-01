import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'

const ToastContext = createContext(null)

const DEFAULT_DURATION_MS = 5000
const ERROR_DURATION_MS = 8000
const MAX_TOASTS = 5

const VARIANTS = ['success', 'error', 'warning', 'info']

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

/** Aceita string, Error, ou objeto com `message`; sempre devolve string. */
function extractMessage(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message || String(value)
  if (typeof value === 'object' && typeof value.message === 'string') return value.message
  return String(value)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => setToasts([]), [])

  const show = useCallback((variant, value, options = {}) => {
    const id = ++idRef.current
    const safeVariant = VARIANTS.includes(variant) ? variant : 'info'
    const duration =
      options.duration ?? (safeVariant === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS)
    const next = {
      id,
      variant: safeVariant,
      message: extractMessage(value),
      duration,
    }
    setToasts((prev) => [...prev, next].slice(-MAX_TOASTS))
    return id
  }, [])

  const toast = useMemo(
    () => ({
      success: (msg, opts) => show('success', msg, opts),
      error: (msg, opts) => show('error', msg, opts),
      warning: (msg, opts) => show('warning', msg, opts),
      info: (msg, opts) => show('info', msg, opts),
      dismiss,
      dismissAll,
    }),
    [show, dismiss, dismissAll]
  )

  const value = useMemo(
    () => ({ toast, toasts, dismiss }),
    [toast, toasts, dismiss]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}
