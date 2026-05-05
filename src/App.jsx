import { useState, useCallback, useEffect, useMemo } from 'react'
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
  // Persiste mês/ano selecionados em URL searchParams (mesma estratégia do
  // `tab`). URL usa 1-indexed pra leitura humana; internamente mantemos
  // 0-indexed. Sobrevive refresh, back/forward, e fica compartilhável.
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')
  const selectedMonth = useMemo(() => {
    const now = getCurrentMonthYear()
    const m = monthParam != null ? Number(monthParam) - 1 : NaN
    const y = yearParam != null ? Number(yearParam) : NaN
    return {
      month: Number.isInteger(m) && m >= 0 && m <= 11 ? m : now.month,
      year: Number.isInteger(y) && y >= 1900 && y <= 2200 ? y : now.year,
    }
  }, [monthParam, yearParam])

  const [showAddModal, setShowAddModal] = useState(false)
  const [transactionFilters, setTransactionFilters] = useState(INITIAL_FILTERS)
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('')
  const [transactionShowFilters, setTransactionShowFilters] = useState(false)
  const [transactionDateRange, setTransactionDateRange] = useState(null)
  const { toggleSearch } = useSearch()
  const { toggleShowValues } = usePrivacy()

  const handleMonthChange = useCallback(
    (month, year) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('month', String(month + 1))
          p.set('year', String(year))
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Abre o modal de detalhes de um cartão na aba Cartões. Usado por
  // Lançamentos quando o DELETE de um pagamento de fatura retorna 409
  // (transação vinculada a fatura paga → usuário precisa Reabrir fatura).
  const openCardId = searchParams.get('card')
  const handleOpenCardInvoice = useCallback(
    (cardId, month, year) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'cards')
          p.set('card', cardId)
          if (typeof month === 'number') p.set('month', String(month + 1))
          if (typeof year === 'number') p.set('year', String(year))
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Limpa o param `card` da URL — usado pelo Cards.jsx depois de abrir o
  // modal pra evitar reabertura espontânea ao trocar mês/aba.
  const clearOpenCardParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('card')
        return p
      },
      { replace: true }
    )
  }, [setSearchParams])

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
            onOpenCardInvoice={handleOpenCardInvoice}
          />
        )
      case 'cards':
        return (
          <Cards
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
            onNavigate={setActiveTab}
            openCardId={openCardId}
            onConsumeOpenCard={clearOpenCardParam}
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
