import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchActivities,
  filterActivitiesClientSide,
  groupActivitiesByDate,
} from '../services/activityService'

/**
 * Lê activities via REST API (`/api/v1/activities`).
 *
 * Backend tem filtros: entity_type, action, limit, offset.
 * NÃO tem filtros por accountId/categoryId/daysBack — esses ficam client-side.
 * Pra single-user com volume modesto isso é aceitável; revisitar se virar
 * multi-tenant.
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

      // Backend retorna até 200 (limite do endpoint); filtros server-side
      // só pra entityType/action.
      const raw = await fetchActivities({
        entityType: filters.entityType,
        action: filters.action,
        limit: filters.limit ?? 200,
      })

      // Filtros que o backend não suporta nativamente (metadata JSONB).
      const filtered = filterActivitiesClientSide(raw, {
        accountId: filters.accountId,
        categoryId: filters.categoryId,
        daysBack: filters.daysBack,
      })

      setActivities(filtered)
      setGroupedActivities(groupActivitiesByDate(filtered))
    } catch (err) {
      console.error('Erro ao carregar atividades:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, filters.accountId, filters.categoryId, filters.daysBack, filters.entityType, filters.action, filters.limit])

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
 * useActivityLogger — NO-OP após Fase E migration.
 *
 * Backend agora registra activities AUTOMATICAMENTE via `@audited` decorator
 * em todo usecase de mutação (transactions, card_expenses, transfers, goals,
 * etc.). O frontend não precisa mais chamar logger nenhum.
 *
 * As funções abaixo viram no-ops mas a interface é preservada pra que
 * Transactions.jsx (e qualquer outro caller) continue funcionando sem
 * mudanças. Próxima refactor pode remover os callsites e este hook inteiro.
 */
export function useActivityLogger() {
  const noop = useCallback(() => Promise.resolve(null), [])

  return {
    log: noop,
    logTransactionCreate: noop,
    logTransactionUpdate: noop,
    logTransactionDelete: noop,
    logCardExpenseCreate: noop,
    logCardExpenseUpdate: noop,
    logCardExpenseDelete: noop,
  }
}
