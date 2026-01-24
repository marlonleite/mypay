import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'
import { useTransactions, useAllCardExpenses, useCards, useBudgets } from '../hooks/useFirestore'
import { getCurrentMonthYear } from '../utils/helpers'
import { showLocalNotification, isPushSupported, getNotificationPermission } from '../services/pushNotifications'

const NotificationContext = createContext()

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const { month, year } = getCurrentMonthYear()
  const { transactions } = useTransactions(month, year)
  const { expenses: cardExpenses } = useAllCardExpenses()
  const { cards } = useCards()
  const { budgets } = useBudgets(month, year)

  const [readNotifications, setReadNotifications] = useState(() => {
    const saved = localStorage.getItem('readNotifications')
    return saved ? JSON.parse(saved) : []
  })

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false)
  const sentPushNotifications = useRef(new Set())
  const lastPushCheck = useRef(null)

  // Listen to push settings from Firestore
  useEffect(() => {
    if (!user) {
      setPushEnabled(false)
      return
    }

    const pushSettingsRef = doc(db, `users/${user.uid}/settings/push`)
    const unsubscribe = onSnapshot(pushSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setPushEnabled(docSnap.data().enabled || false)
      } else {
        setPushEnabled(false)
      }
    })

    return () => unsubscribe()
  }, [user])

  // Calculate notifications
  const notifications = useMemo(() => {
    if (!user) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const notifs = []

    // 1. Overdue transactions (not paid and date < today)
    const overdueTransactions = transactions.filter(t => {
      if (t.paid !== false) return false
      const transDate = t.date instanceof Date ? t.date : new Date(t.date)
      transDate.setHours(0, 0, 0, 0)
      return transDate < today
    })

    overdueTransactions.forEach(t => {
      notifs.push({
        id: `overdue-${t.id}`,
        type: 'overdue',
        severity: 'high',
        title: 'Lançamento vencido',
        message: `${t.description} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}`,
        date: t.date,
        actionText: 'Ver lançamento',
        actionData: { transactionId: t.id }
      })
    })

    // 2. Credit card bills due soon (3 days before)
    const threeDaysFromNow = new Date(today)
    threeDaysFromNow.setDate(today.getDate() + 3)

    cards.forEach(card => {
      const dueDate = new Date(year, month, card.dueDay)
      dueDate.setHours(0, 0, 0, 0)

      if (dueDate >= today && dueDate <= threeDaysFromNow) {
        // Check if bill is already paid
        const cardTotal = cardExpenses
          .filter(e => {
            const expDate = e.date instanceof Date ? e.date : new Date(e.date)
            return e.cardId === card.id && expDate.getMonth() === month && expDate.getFullYear() === year
          })
          .reduce((sum, e) => sum + (e.amount || 0), 0)

        if (cardTotal > 0) {
          notifs.push({
            id: `bill-due-${card.id}-${month}-${year}`,
            type: 'bill_due',
            severity: 'medium',
            title: 'Fatura próxima do vencimento',
            message: `${card.name} vence em ${Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))} dia(s) - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cardTotal)}`,
            date: dueDate,
            actionText: 'Ver fatura',
            actionData: { cardId: card.id }
          })
        }
      }
    })

    // 3. Credit card limit exceeded (> 80%)
    cards.forEach(card => {
      if (!card.limit || card.limit <= 0) return

      const cardTotal = cardExpenses
        .filter(e => {
          const expDate = e.date instanceof Date ? e.date : new Date(e.date)
          return e.cardId === card.id && expDate.getMonth() === month && expDate.getFullYear() === year
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0)

      const percentage = (cardTotal / card.limit) * 100

      if (percentage >= 80) {
        notifs.push({
          id: `limit-warning-${card.id}-${month}-${year}`,
          type: 'limit_warning',
          severity: percentage >= 100 ? 'high' : 'medium',
          title: percentage >= 100 ? 'Limite do cartão excedido' : 'Limite do cartão próximo',
          message: `${card.name} - ${percentage.toFixed(0)}% do limite usado`,
          date: today,
          actionText: 'Ver cartão',
          actionData: { cardId: card.id }
        })
      }
    })

    // 4. Budget exceeded
    budgets.forEach(budget => {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category === budget.categoryId)
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const cardSpent = cardExpenses
        .filter(e => {
          const expDate = e.date instanceof Date ? e.date : new Date(e.date)
          return e.category === budget.categoryId && expDate.getMonth() === month && expDate.getFullYear() === year
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0)

      const totalSpent = spent + cardSpent
      const percentage = (totalSpent / budget.amount) * 100

      if (percentage >= 100) {
        notifs.push({
          id: `budget-exceeded-${budget.id}-${month}-${year}`,
          type: 'budget_exceeded',
          severity: 'medium',
          title: 'Orçamento excedido',
          message: `Categoria com ${percentage.toFixed(0)}% do orçamento gasto`,
          date: today,
          actionText: 'Ver orçamentos',
          actionData: { budgetId: budget.id }
        })
      }
    })

    // Sort by severity and date (most recent first)
    return notifs.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateB - dateA
    })
  }, [user, transactions, cardExpenses, cards, budgets, month, year])

  // Unread notifications
  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !readNotifications.includes(n.id))
  }, [notifications, readNotifications])

  const unreadCount = unreadNotifications.length

  const markAsRead = (notificationId) => {
    const updated = [...readNotifications, notificationId]
    setReadNotifications(updated)
    localStorage.setItem('readNotifications', JSON.stringify(updated))
  }

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id)
    setReadNotifications(allIds)
    localStorage.setItem('readNotifications', JSON.stringify(allIds))
  }

  // Send push notification for a specific alert
  const sendPushNotification = useCallback((notification) => {
    if (!pushEnabled) return
    if (!isPushSupported()) return
    if (getNotificationPermission() !== 'granted') return

    // Don't send if already sent today
    const today = new Date().toDateString()
    const notifKey = `${notification.id}-${today}`
    if (sentPushNotifications.current.has(notifKey)) return

    // Show local notification
    showLocalNotification(notification.title, {
      body: notification.message,
      tag: notification.id,
      data: notification.actionData
    })

    sentPushNotifications.current.add(notifKey)
  }, [pushEnabled])

  // Trigger push notifications for high-severity unread notifications
  useEffect(() => {
    if (!pushEnabled || !user) return

    // Only check once per session or every 5 minutes
    const now = Date.now()
    if (lastPushCheck.current && (now - lastPushCheck.current) < 5 * 60 * 1000) {
      return
    }
    lastPushCheck.current = now

    // Send push for high-severity unread notifications
    unreadNotifications
      .filter(n => n.severity === 'high')
      .forEach(notification => {
        sendPushNotification(notification)
      })
  }, [pushEnabled, user, unreadNotifications, sendPushNotification])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadNotifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      pushEnabled,
      sendPushNotification
    }}>
      {children}
    </NotificationContext.Provider>
  )
}
