import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingScreen } from './ui/Loading'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
