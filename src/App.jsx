import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { LoadingScreen } from './components/ui/Loading'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Cards from './pages/Cards'
import Categories from './pages/Categories'
import Tags from './pages/Tags'
import Documents from './pages/Documents'
import Budgets from './pages/Budgets'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import { getCurrentMonthYear } from './utils/helpers'

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthYear())
  const [showAddModal, setShowAddModal] = useState(false)

  const handleMonthChange = (month, year) => {
    setSelectedMonth({ month, year })
  }

  const handleAddNew = () => {
    // Navega para transactions e abre o modal
    setActiveTab('transactions')
    setShowAddModal(true)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            month={selectedMonth.month}
            year={selectedMonth.year}
            onMonthChange={handleMonthChange}
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
          />
        )
      case 'cards':
        return (
          <Cards
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
        return <Accounts />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard month={selectedMonth.month} year={selectedMonth.year} onMonthChange={handleMonthChange} />
    }
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} onAddNew={handleAddNew}>
      {renderContent()}
    </Layout>
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
