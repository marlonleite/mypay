import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, Receipt, CreditCard, Scan, Tag, Hash, LogOut, User, Plus, MoreHorizontal, Download, Target, Wallet, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggleCompact } from './ui/ThemeToggle'

// Tabs principais da navegação
const mainTabs = [
  { id: 'dashboard', label: 'Resumo', icon: LayoutDashboard },
  { id: 'transactions', label: 'Lançamentos', icon: Receipt },
  { id: 'cards', label: 'Cartões', icon: CreditCard },
]

// Itens do menu "Mais"
const moreMenuItems = [
  { id: 'budgets', label: 'Orçamentos', icon: Target },
  { id: 'accounts', label: 'Contas', icon: Wallet },
  { id: 'categories', label: 'Categorias', icon: Tag },
  { id: 'tags', label: 'Tags', icon: Hash },
  { id: 'documents', label: 'Importar IA', icon: Scan },
  { id: 'migration', label: 'Migrar Organizze', icon: Download },
  { id: 'settings', label: 'Configurações', icon: Settings }
]

export default function Layout({ children, activeTab, onTabChange, onAddNew }) {
  const { user, logout } = useAuth()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef(null)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Tabs para a navegação inferior (2 à esquerda, 1 + menu à direita)
  const leftTabs = mainTabs.slice(0, 2)
  const rightTabs = mainTabs.slice(2, 3)

  // Verifica se algum item do menu "Mais" está ativo
  const isMoreMenuActive = moreMenuItems.some(item => item.id === activeTab)

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-dark-950">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">myPay</h1>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggleCompact />

            {/* User Avatar */}
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-9 h-9 rounded-full"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center">
                <User className="w-5 h-5 text-dark-400" />
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 text-dark-400 hover:text-white rounded-full hover:bg-dark-800 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-28">
        {children}
      </main>

      {/* Bottom Navigation with FAB */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark-950 safe-area-pb">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Left tabs */}
            <div className="flex items-center">
              {leftTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                      isActive
                        ? 'text-violet-500'
                        : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                )
              })}
            </div>

            {/* FAB Button */}
            <button
              onClick={onAddNew}
              className="fab-button -mt-8"
            >
              <Plus className="w-6 h-6" />
            </button>

            {/* Right tabs */}
            <div className="flex items-center">
              {rightTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                      isActive
                        ? 'text-violet-500'
                        : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                )
              })}

              {/* More Menu Button */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                    isMoreMenuActive || showMoreMenu
                      ? 'text-violet-500'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {/* More Menu Dropdown */}
                {showMoreMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-dark-900 rounded-2xl shadow-lg py-2 min-w-[160px] border border-dark-700">
                    {moreMenuItems.map((item) => {
                      const Icon = item.icon
                      const isActive = activeTab === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id)
                            setShowMoreMenu(false)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                            isActive
                              ? 'text-violet-400 bg-violet-500/10'
                              : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  )
}
