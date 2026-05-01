import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useSearch } from './contexts/SearchContext'
import { usePrivacy } from './contexts/PrivacyContext'
import { LoadingScreen } from './components/ui/Loading'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Cards from './pages/Cards'
import Reports from './pages/Reports'
import Categories from './pages/Categories'
import Tags from './pages/Tags'
import Documents from './pages/Documents'
import Budgets from './pages/Budgets'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import Goals from './pages/Goals'
import Activities from './pages/Activities'
import SearchModal from './components/search/SearchModal'
import ToastContainer from './components/ui/Toast'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { getCurrentMonthYear } from './utils/helpers'

const INITIAL_FILTERS = {
  type: 'all',
  // Lançamentos: por padrão omitir compras na fatura (credit_card_id); manter contas e pag. fatura
  source: 'account',
  account: 'all',
  category: [],
  tag: []
}

const VALID_TABS = new Set([
  'dashboard',
  'transactions',
  'cards',
  'reports',
  'goals',
  'budgets',
  'accounts',
  'categories',
  'tags',
  'documents',
  'activities',
  'settings',
])

function AppContent() {
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeTab =
    tabParam && VALID_TABS.has(tabParam) ? tabParam : 'dashboard'

  useEffect(() => {
    if (tabParam && !VALID_TABS.has(tabParam)) {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('tab')
          return p
        },
        { replace: true }
      )
    }
  }, [tabParam, setSearchParams])

  const setActiveTab = useCallback(
    (tab) => {
      if (!VALID_TABS.has(tab)) return
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (tab === 'dashboard') p.delete('tab')
          else p.set('tab', tab)
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthYear())
  const [showAddModal, setShowAddModal] = useState(false)
  const [transactionFilters, setTransactionFilters] = useState(INITIAL_FILTERS)
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('')
  const [transactionShowFilters, setTransactionShowFilters] = useState(false)
  const [transactionDateRange, setTransactionDateRange] = useState(null)
  const { toggleSearch } = useSearch()
  const { toggleShowValues } = usePrivacy()

  const handleMonthChange = (month, year) => {
    setSelectedMonth({ month, year })
  }

  const handleAddNew = () => {
    // Navega para transactions e abre o modal
    setActiveTab('transactions')
    setShowAddModal(true)
  }

  // Handler para navegação via busca
  const handleSearchNavigate = useCallback((tab, _params) => {
    setActiveTab(tab)
    // _params pode conter IDs para destacar/abrir itens específicos (futura implementação)
  }, [])

  // Atalhos de teclado globais
  useKeyboardShortcuts({
    'mod+k': toggleSearch,
    'mod+n': handleAddNew,
    'mod+h': toggleShowValues,
  })

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
            onNavigate={setActiveTab}
          />
        )
      case 'transactions':
        return (
          <Transactions
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
            showAddModal={showAddModal}
            onCloseAddModal={() => setShowAddModal(false)}
            filters={transactionFilters}
            onFiltersChange={setTransactionFilters}
            searchTerm={transactionSearchTerm}
            onSearchTermChange={setTransactionSearchTerm}
            showFilters={transactionShowFilters}
            onShowFiltersChange={setTransactionShowFilters}
            dateRange={transactionDateRange}
            onDateRangeChange={setTransactionDateRange}
          />
        )
      case 'cards':
        return (
          <Cards
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
            onNavigate={setActiveTab}
          />
        )
      case 'reports':
        return (
          <Reports
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
          />
        )
      case 'categories':
        return <Categories />
      case 'tags':
        return <Tags />
      case 'documents':
        return (
          <Documents
            month={selectedMonth.month}
            year={selectedMonth.year}
          />
        )
      case 'budgets':
        return (
          <Budgets
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
          />
        )
      case 'accounts':
        return <Accounts onNavigate={setActiveTab} />
      case 'goals':
        return <Goals />
      case 'activities':
        return <Activities />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard month={selectedMonth.month} year={selectedMonth.year} onMonthChange={handleMonthChange} />
    }
  }

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab} onAddNew={handleAddNew}>
        {renderContent()}
      </Layout>
      <SearchModal onNavigate={handleSearchNavigate} />
      <ToastContainer />
      <OnboardingWizard />
    </>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppContent />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
