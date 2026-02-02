import { createContext, useContext, useState, useCallback, useRef } from 'react'

const UndoContext = createContext()

const MAX_UNDO_STACK_SIZE = 50
const TOAST_DURATION_MS = 5000

/**
 * Tipos de ação que podem ser desfeitas:
 * - CREATE_TRANSACTION: criação de transação
 * - UPDATE_TRANSACTION: atualização de transação
 * - DELETE_TRANSACTION: exclusão de transação
 * - CREATE_CARD_EXPENSE: criação de despesa de cartão
 * - DELETE_CARD_EXPENSE: exclusão de despesa de cartão
 */

export function useUndo() {
  const context = useContext(UndoContext)
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider')
  }
  return context
}

export function UndoProvider({ children }) {
  const [undoStack, setUndoStack] = useState([])
  const [currentToast, setCurrentToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  // Adicionar ação ao stack de undo
  const pushUndo = useCallback((action) => {
    const undoAction = {
      id: Date.now(),
      ...action,
      timestamp: new Date()
    }

    setUndoStack(prev => {
      const newStack = [undoAction, ...prev].slice(0, MAX_UNDO_STACK_SIZE)
      return newStack
    })

    // Mostrar toast
    setCurrentToast({
      id: undoAction.id,
      message: action.message || 'Ação realizada',
      type: action.type
    })

    // Auto-hide toast
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = setTimeout(() => {
      setCurrentToast(null)
    }, TOAST_DURATION_MS)

    return undoAction.id
  }, [])

  // Executar undo da ação mais recente
  const undo = useCallback(async () => {
    if (undoStack.length === 0) return false

    const [action, ...rest] = undoStack
    setUndoStack(rest)

    // Executar callback de undo
    if (action.undoFn) {
      try {
        await action.undoFn()
        setCurrentToast({
          id: Date.now(),
          message: action.undoMessage || 'Ação desfeita',
          type: 'success'
        })

        // Auto-hide
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current)
        }
        toastTimeoutRef.current = setTimeout(() => {
          setCurrentToast(null)
        }, 3000)

        return true
      } catch (error) {
        console.error('Erro ao desfazer ação:', error)
        setCurrentToast({
          id: Date.now(),
          message: 'Erro ao desfazer',
          type: 'error'
        })
        return false
      }
    }

    return false
  }, [undoStack])

  // Fechar toast manualmente
  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setCurrentToast(null)
  }, [])

  // Verificar se pode desfazer
  const canUndo = undoStack.length > 0

  // Limpar stack
  const clearUndoStack = useCallback(() => {
    setUndoStack([])
    setCurrentToast(null)
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  const value = {
    pushUndo,
    undo,
    canUndo,
    undoStack,
    currentToast,
    dismissToast,
    clearUndoStack
  }

  return (
    <UndoContext.Provider value={value}>
      {children}
    </UndoContext.Provider>
  )
}
