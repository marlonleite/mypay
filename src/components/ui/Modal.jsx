import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, hideHeader = false }) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-dark-900 border border-dark-700 rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-hidden animate-slide-up sm:animate-scale-in">
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between p-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Close button when header is hidden */}
        {hideHeader && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div className={`p-4 overflow-y-auto ${hideHeader ? 'pt-12 max-h-[90vh]' : 'max-h-[calc(90vh-4rem)]'}`}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
