import { LayoutDashboard, Receipt, CreditCard, Scan, Tag, LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const tabs = [
  { id: 'dashboard', label: 'Resumo', icon: LayoutDashboard },
  { id: 'transactions', label: 'Lançamentos', icon: Receipt },
  { id: 'cards', label: 'Cartões', icon: CreditCard },
  { id: 'categories', label: 'Categorias', icon: Tag },
  { id: 'documents', label: 'Importar', icon: Scan }
]

export default function Layout({ children, activeTab, onTabChange }) {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-lg border-b border-dark-800">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">myPay</h1>

          <div className="flex items-center gap-3">
            {/* User Avatar */}
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-8 h-8 rounded-full border border-dark-600"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                <User className="w-4 h-4 text-dark-400" />
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-lg border-t border-dark-800 safe-area-pb">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center h-16 overflow-x-auto scrollbar-hide px-2 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all flex-shrink-0 min-w-[4rem] ${
                    isActive
                      ? 'text-violet-400'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                  <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Safe area for iOS + hide scrollbar */}
      <style>{`
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom);
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
