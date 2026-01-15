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
import Documents from './pages/Documents'
import { getCurrentMonthYear } from './utils/helpers'

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthYear())

  const handleMonthChange = (month, year) => {
    setSelectedMonth({ month, year })
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
      case 'documents':
        return (
          <Documents
            month={selectedMonth.month}
            year={selectedMonth.year}
          />
        )
      default:
        return <Dashboard month={selectedMonth.month} year={selectedMonth.year} onMonthChange={handleMonthChange} />
    }
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
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
