import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PrivacyProvider } from './contexts/PrivacyContext'
import { NotificationProvider } from './contexts/NotificationContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <PrivacyProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Register service workers for PWA and FCM
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register main PWA service worker
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('PWA SW registered:', registration)
      })
      .catch(error => {
        console.log('PWA SW registration failed:', error)
      })

    // Register Firebase Messaging service worker
    // This is done separately to handle push notifications in background
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' })
      .then(registration => {
        console.log('FCM SW registered:', registration)
      })
      .catch(error => {
        console.log('FCM SW registration failed:', error)
      })
  })
}
