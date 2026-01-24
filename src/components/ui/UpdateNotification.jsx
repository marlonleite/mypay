import { RefreshCw, X } from 'lucide-react'
import { useVersionCheck } from '../../hooks/useVersionCheck'

export default function UpdateNotification() {
  const { newVersionAvailable, refresh, dismiss } = useVersionCheck()

  if (!newVersionAvailable) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-slide-up">
      <div className="bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-500/30 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">Nova versão disponível!</h4>
            <p className="text-xs text-white/80 mt-0.5">
              Atualize para ter acesso às últimas melhorias.
            </p>

            <div className="flex gap-2 mt-3">
              <button
                onClick={refresh}
                className="flex-1 px-3 py-1.5 bg-white text-violet-600 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Atualizar agora
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
              >
                Depois
              </button>
            </div>
          </div>

          <button
            onClick={dismiss}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
