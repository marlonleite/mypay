import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppRouter } from './router/Router'
import { isWeb } from './services/platform'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PrivacyProvider } from './contexts/PrivacyContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { SearchProvider } from './contexts/SearchContext'
import { ToastProvider } from './contexts/ToastContext'
import { OnboardingProvider } from './contexts/OnboardingContext'
import './index.css'
import { bootstrapAppearanceDom } from './utils/appearance'

bootstrapAppearanceDom()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter>
      <AuthProvider>
        <ThemeProvider>
          <PrivacyProvider>
            <NotificationProvider>
              <SearchProvider>
                <ToastProvider>
                  <OnboardingProvider>
                    <App />
                  </OnboardingProvider>
                </ToastProvider>
              </SearchProvider>
            </NotificationProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </AuthProvider>
    </AppRouter>
  </React.StrictMode>,
)

// PWA + FCM service workers (web only; file:// and capacitor:// skip registration)
if (isWeb() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('PWA SW registered:', registration)
      })
      .catch(error => {
        console.log('PWA SW registration failed:', error)
      })

    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' })
      .then(registration => {
        console.log('FCM SW registered:', registration)
      })
      .catch(error => {
        console.log('FCM SW registration failed:', error)
      })
  })
}
