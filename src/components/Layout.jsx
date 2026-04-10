import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, Receipt, CreditCard, Scan, Tag, Hash, LogOut, User, Plus, MoreHorizontal, Target, Wallet, Settings, Eye, EyeOff, BarChart3, Search, Flag, History } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useSearch } from '../contexts/SearchContext'
import { ThemeToggleCompact } from './ui/ThemeToggle'
import NotificationBadge from './notifications/NotificationBadge'
import NotificationCenter from './notifications/NotificationCenter'
import UpdateNotification from './ui/UpdateNotification'

// Tabs principais da navegação
const mainTabs = [
  { id: 'dashboard', label: 'Resumo', icon: LayoutDashboard },
  { id: 'transactions', label: 'Lançamentos', icon: Receipt },
  { id: 'cards', label: 'Cartões', icon: CreditCard },
]

// Itens do menu "Mais"
const moreMenuItems = [
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'goals', label: 'Metas', icon: Flag },
  { id: 'budgets', label: 'Orçamentos', icon: Target },
  { id: 'accounts', label: 'Contas', icon: Wallet },
  { id: 'categories', label: 'Categorias', icon: Tag },
  { id: 'tags', label: 'Tags', icon: Hash },
  { id: 'documents', label: 'Importar IA', icon: Scan },
  { id: 'activities', label: 'Atividades', icon: History },
  { id: 'settings', label: 'Configurações', icon: Settings }
]

// Todos os itens de navegação para sidebar desktop
const allTabs = [...mainTabs, ...moreMenuItems]

export default function Layout({ children, activeTab, onTabChange, onAddNew }) {
  const { user, logout } = useAuth()
  const { showValues, toggleShowValues } = usePrivacy()
  const { openSearch } = useSearch()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 bottom-0 w-64 bg-dark-950 border-r border-dark-700/50 z-30">
        {/* Logo */}
        <div className="h-14 flex items-center px-6">
          <h1 className="text-2xl font-bold text-white">myPay</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {allTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'text-violet-400 bg-violet-500/10'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Add New Button */}
        <div className="px-3 py-2">
          <button
            onClick={onAddNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-2xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Lançamento
          </button>
        </div>

        {/* User Section */}
        <div className="px-3 py-4 border-t border-dark-700/50">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-9 h-9 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-dark-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {user?.displayName || 'Usuário'}
              </p>
              <p className="text-xs text-dark-500 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors flex-shrink-0"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-dark-950">
        <div className="max-w-lg lg:max-w-none lg:ml-64 mx-auto lg:mx-0 px-4 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo — mobile only */}
          <h1 className="text-2xl font-bold text-white lg:hidden">myPay</h1>

          {/* Spacer for desktop */}
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              onClick={openSearch}
              className="p-2 text-dark-400 hover:text-white rounded-full hover:bg-dark-800 transition-colors"
              title="Buscar (⌘K)"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Privacy Toggle */}
            <button
              onClick={toggleShowValues}
              className="p-2 text-dark-400 hover:text-white rounded-full hover:bg-dark-800 transition-colors"
              title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
            >
              {showValues ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </button>

            {/* Theme Toggle */}
            <ThemeToggleCompact />

            {/* Notifications */}
            <div className="relative">
              <NotificationBadge onClick={() => setShowNotifications(!showNotifications)} />
              <NotificationCenter
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>

            {/* User Avatar — mobile only */}
            <div className="lg:hidden">
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
            </div>

            {/* Logout Button — mobile only */}
            <button
              onClick={handleLogout}
              className="p-2 text-dark-400 hover:text-white rounded-full hover:bg-dark-800 transition-colors lg:hidden"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg lg:max-w-none lg:ml-64 mx-auto lg:mx-0 w-full lg:w-auto px-4 lg:px-8 py-4 pb-28 lg:pb-4">
        {children}
      </main>

      {/* Bottom Navigation with FAB — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark-950 safe-area-pb lg:hidden">
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

      {/* Notificação de nova versão */}
      <UpdateNotification />
    </div>
  )
}
