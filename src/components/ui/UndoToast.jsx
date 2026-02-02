import { useCallback, useEffect, useState } from 'react'
import { Undo2, X, Check, AlertCircle } from 'lucide-react'
import { useUndo } from '../../contexts/UndoContext'

const ANIMATION_DURATION_MS = 300

export default function UndoToast() {
  const { currentToast, undo, dismissToast, canUndo } = useUndo()
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  // Controlar animação de entrada/saída
  useEffect(() => {
    if (currentToast) {
      setIsExiting(false)
      // Pequeno delay para trigger da animação
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    } else {
      setIsExiting(true)
      const timeout = setTimeout(() => {
        setIsVisible(false)
        setIsExiting(false)
      }, ANIMATION_DURATION_MS)
      return () => clearTimeout(timeout)
    }
  }, [currentToast])

  const handleUndo = useCallback(async () => {
    await undo()
  }, [undo])

  const handleDismiss = useCallback(() => {
    dismissToast()
  }, [dismissToast])

  if (!isVisible && !currentToast) return null

  const getIcon = () => {
    switch (currentToast?.type) {
      case 'success':
        return <Check className="w-5 h-5 text-emerald-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Undo2 className="w-5 h-5 text-violet-500" />
    }
  }

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible && !isExiting
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-800 rounded-xl shadow-lg border border-dark-700 min-w-[280px] max-w-[90vw]">
        {getIcon()}

        <span className="flex-1 text-sm text-white">
          {currentToast?.message}
        </span>

        {canUndo && currentToast?.type !== 'success' && currentToast?.type !== 'error' && (
          <button
            onClick={handleUndo}
            className="px-3 py-1 text-sm font-medium text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
          >
            Desfazer
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="p-1 text-dark-400 hover:text-white rounded-full hover:bg-dark-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
