import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'

const ENTER_DELAY_MS = 10
const EXIT_DURATION_MS = 200

const VARIANT_STYLES = {
  success: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
  },
  error: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    icon: AlertCircle,
    iconClass: 'text-red-400',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    icon: AlertTriangle,
    iconClass: 'text-amber-400',
  },
  info: {
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/10',
    icon: Info,
    iconClass: 'text-blue-400',
  },
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  const style = VARIANT_STYLES[toast.variant] ?? VARIANT_STYLES.info
  const Icon = style.icon

  // Animação de entrada (mounted=false -> true após pequeno delay).
  const [mounted, setMounted] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), ENTER_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss com fade-out coordenado.
  useEffect(() => {
    if (!toast.duration || toast.duration < 0) return
    const exitAt = setTimeout(() => setExiting(true), toast.duration - EXIT_DURATION_MS)
    const removeAt = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => {
      clearTimeout(exitAt)
      clearTimeout(removeAt)
    }
  }, [toast.id, toast.duration, onDismiss])

  const handleClose = () => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), EXIT_DURATION_MS)
  }

  const visible = mounted && !exiting

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm shadow-lg transition-all duration-200 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconClass}`} />
      <p className="flex-1 text-sm text-white leading-snug break-words">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={handleClose}
        className="p-1 -mr-1 -mt-1 text-dark-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
