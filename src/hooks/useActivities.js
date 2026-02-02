import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getActivities,
  groupActivitiesByDate,
  logActivity,
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES
} from '../services/activityService'

/**
 * Hook para gerenciar atividades
 */
export function useActivities(filters = {}) {
  const { user } = useAuth()
  const [activities, setActivities] = useState([])
  const [groupedActivities, setGroupedActivities] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadActivities = useCallback(async () => {
    if (!user) {
      setActivities([])
      setGroupedActivities({})
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const data = await getActivities(user.uid, filters)
      setActivities(data)
      setGroupedActivities(groupActivitiesByDate(data))
    } catch (err) {
      console.error('Erro ao carregar atividades:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, filters.accountId, filters.categoryId, filters.daysBack])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const refresh = useCallback(() => {
    loadActivities()
  }, [loadActivities])

  return {
    activities,
    groupedActivities,
    loading,
    error,
    refresh
  }
}

/**
 * Hook para registrar atividades
 */
export function useActivityLogger() {
  const { user } = useAuth()

  const log = useCallback(async (activityData) => {
    if (!user) return null
    return logActivity(user.uid, activityData)
  }, [user])

  // Helpers para ações comuns
  const logTransactionCreate = useCallback((transaction) => {
    return log({
      action: ACTIVITY_ACTIONS.CREATE,
      entityType: ACTIVITY_ENTITIES.TRANSACTION,
      entityId: transaction.id,
      entityName: transaction.description,
      entitySubtype: transaction.type,
      data: {
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date,
        paid: transaction.paid,
        accountId: transaction.accountId,
        category: transaction.category
      },
      accountId: transaction.accountId,
      categoryId: transaction.category
    })
  }, [log])

  const logTransactionUpdate = useCallback((transaction, previousData) => {
    return log({
      action: ACTIVITY_ACTIONS.UPDATE,
      entityType: ACTIVITY_ENTITIES.TRANSACTION,
      entityId: transaction.id,
      entityName: transaction.description,
      entitySubtype: transaction.type,
      data: {
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date,
        paid: transaction.paid,
        accountId: transaction.accountId,
        category: transaction.category
      },
      previousData,
      accountId: transaction.accountId,
      categoryId: transaction.category
    })
  }, [log])

  const logTransactionDelete = useCallback((transaction) => {
    return log({
      action: ACTIVITY_ACTIONS.DELETE,
      entityType: ACTIVITY_ENTITIES.TRANSACTION,
      entityId: transaction.id,
      entityName: transaction.description,
      entitySubtype: transaction.type,
      data: {
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date
      },
      accountId: transaction.accountId,
      categoryId: transaction.category
    })
  }, [log])

  const logCardExpenseCreate = useCallback((expense) => {
    return log({
      action: ACTIVITY_ACTIONS.CREATE,
      entityType: ACTIVITY_ENTITIES.CARD_EXPENSE,
      entityId: expense.id,
      entityName: expense.description,
      data: {
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        cardId: expense.cardId,
        category: expense.category
      },
      categoryId: expense.category
    })
  }, [log])

  const logCardExpenseUpdate = useCallback((expense, previousData) => {
    return log({
      action: ACTIVITY_ACTIONS.UPDATE,
      entityType: ACTIVITY_ENTITIES.CARD_EXPENSE,
      entityId: expense.id,
      entityName: expense.description,
      data: {
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        cardId: expense.cardId,
        category: expense.category
      },
      previousData,
      categoryId: expense.category
    })
  }, [log])

  const logCardExpenseDelete = useCallback((expense) => {
    return log({
      action: ACTIVITY_ACTIONS.DELETE,
      entityType: ACTIVITY_ENTITIES.CARD_EXPENSE,
      entityId: expense.id,
      entityName: expense.description,
      data: {
        description: expense.description,
        amount: expense.amount
      },
      categoryId: expense.category
    })
  }, [log])

  return {
    log,
    logTransactionCreate,
    logTransactionUpdate,
    logTransactionDelete,
    logCardExpenseCreate,
    logCardExpenseUpdate,
    logCardExpenseDelete
  }
}
