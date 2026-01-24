import { Bell } from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext'

export default function NotificationBadge({ onClick }) {
  const { unreadCount } = useNotifications()

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-dark-400 hover:text-white rounded-full hover:bg-dark-800 transition-colors"
      title="Notificações"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
