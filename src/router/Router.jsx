import { BrowserRouter, HashRouter } from 'react-router-dom'
import { isWeb } from '../services/platform'

export function AppRouter({ children }) {
  const Router = isWeb() ? BrowserRouter : HashRouter
  return <Router>{children}</Router>
}
