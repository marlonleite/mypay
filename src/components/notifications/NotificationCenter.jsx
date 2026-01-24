import { useState, useRef, useEffect } from 'react'
import { AlertCircle, AlertTriangle, Info, Check, X } from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function NotificationCenter({ isOpen, onClose }) {
  const { notifications, unreadNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [showAll, setShowAll] = useState(false)
  const dropdownRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const displayNotifications = showAll ? notifications : unreadNotifications

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 border-red-500/20'
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20'
      default:
        return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-dark-900 rounded-[20px] shadow-2xl border border-dark-700 z-[100] max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-700">
        <div>
          <h3 className="text-lg font-semibold text-white">Notificações</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-dark-400">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <button
          onClick={() => setShowAll(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !showAll
              ? 'bg-violet-500/20 text-violet-400'
              : 'text-dark-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          Não lidas ({unreadCount})
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showAll
              ? 'bg-violet-500/20 text-violet-400'
              : 'text-dark-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          Todas ({notifications.length})
        </button>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="ml-auto text-xs text-violet-400 hover:text-violet-300 font-medium"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {displayNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-medium mb-1">Tudo em dia!</p>
            <p className="text-sm text-dark-400">
              {showAll ? 'Nenhuma notificação' : 'Nenhuma notificação não lida'}
            </p>
          </div>
        ) : (
          displayNotifications.map(notif => {
            const isUnread = unreadNotifications.some(n => n.id === notif.id)

            return (
              <div
                key={notif.id}
                className={`p-3 border rounded-xl transition-all ${
                  isUnread
                    ? `${getSeverityBg(notif.severity)} border-opacity-100`
                    : 'bg-dark-800/30 border-dark-700/30 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(notif.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-white">{notif.title}</h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-dark-300 mb-2">{notif.message}</p>

                    <div className="flex items-center gap-2">
                      {notif.actionText && (
                        <button
                          onClick={() => {
                            markAsRead(notif.id)
                            // Handle action based on type
                            // In a real app, you'd navigate or open modals here
                          }}
                          className="text-xs text-violet-400 hover:text-violet-300 font-medium"
                        >
                          {notif.actionText}
                        </button>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="text-xs text-dark-400 hover:text-white font-medium"
                        >
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
