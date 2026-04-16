import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { subscribe as subscribeEventStream } from '../services/eventStream'

const GoalsContext = createContext()

/**
 * Tipos de meta:
 * - saving: Economizar um valor (ex: reserva de emergência)
 * - reduction: Reduzir gastos em categoria (ex: gastar menos em delivery)
 * - payment: Quitar uma dívida/valor (ex: pagar cartão)
 * - investment: Investir um valor por mês
 *
 * Pós Fase E migration: lê/escreve via REST API (/api/v1/goals).
 * Backend faz soft delete (deleted_at) — `archiveGoal` é uma mudança lógica
 * de status, não delete.
 */

// Transform: API response (snake_case + decimal-as-string) → frontend shape (camelCase + Date).
function mapGoal(g) {
  const toNumber = (v) => (v !== null && v !== undefined ? parseFloat(v) : 0)
  return {
    id: g.id,
    categoryId: g.category_id ?? null,
    name: g.name,
    type: g.type, // saving/reduction/payment/investment
    targetAmount: toNumber(g.target_amount),
    currentAmount: toNumber(g.current_amount),
    // "T12:00:00" evita UTC shift ao interpretar DATE como local.
    deadline: g.deadline ? new Date(g.deadline + 'T12:00:00') : null,
    icon: g.icon,
    color: g.color,
    status: g.status, // active/completed/archived
    completedAt: g.completed_at ? new Date(g.completed_at) : null,
    createdAt: g.created_at ? new Date(g.created_at) : null,
    updatedAt: g.updated_at ? new Date(g.updated_at) : null,
  }
}

// camelCase (frontend) → snake_case (API). Datas viram 'YYYY-MM-DD'.
function buildGoalPayload(data) {
  const toIsoDate = (d) => {
    if (!d) return null
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    return d
  }

  const payload = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.type !== undefined) payload.type = data.type
  if (data.targetAmount !== undefined) payload.target_amount = data.targetAmount
  if (data.currentAmount !== undefined) payload.current_amount = data.currentAmount
  if (data.deadline !== undefined) payload.deadline = toIsoDate(data.deadline)
  if (data.categoryId !== undefined) payload.category_id = data.categoryId
  if (data.icon !== undefined) payload.icon = data.icon
  if (data.color !== undefined) payload.color = data.color
  if (data.status !== undefined) payload.status = data.status
  return payload
}

export function useGoals() {
  const context = useContext(GoalsContext)
  if (!context) {
    throw new Error('useGoals must be used within a GoalsProvider')
  }
  return context
}

export function GoalsProvider({ children }) {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGoals = useCallback(async () => {
    if (!user) {
      setGoals([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      // Sem filtro de status: pega todas (active/completed/archived) — consumidores filtram client-side.
      const data = await apiClient.get('/api/v1/goals')
      // Ordena desc por createdAt (Firestore fazia via orderBy).
      const mapped = data.map(mapGoal)
      mapped.sort((a, b) => {
        const aT = a.createdAt ? a.createdAt.getTime() : 0
        const bT = b.createdAt ? b.createdAt.getTime() : 0
        return bT - aT
      })
      setGoals(mapped)
    } catch (err) {
      console.error('Error fetching goals:', err)
      setError('Erro ao carregar metas')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchGoals()
  }, [fetchGoals])

  // SSE: re-fetch quando uma goal muda em outra aba/dispositivo.
  useEffect(() => {
    return subscribeEventStream('goal', fetchGoals)
  }, [fetchGoals])

  // Adicionar meta
  const addGoal = useCallback(async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    // Defaults pra preservar comportamento anterior.
    const payload = buildGoalPayload({
      type: 'saving',
      currentAmount: 0,
      icon: 'Target',
      color: 'violet',
      ...data,
    })
    const created = await apiClient.post('/api/v1/goals', payload)
    await fetchGoals()
    return mapGoal(created)
  }, [user, fetchGoals])

  // Atualizar meta
  const updateGoal = useCallback(async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/goals/${id}`, buildGoalPayload(data))
    await fetchGoals()
    return mapGoal(updated)
  }, [user, fetchGoals])

  // Atualizar progresso da meta. Backend tem PATCH dedicado e marca completed
  // automaticamente quando current_amount >= target_amount.
  const updateGoalProgress = useCallback(async (id, amount) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.patch(`/api/v1/goals/${id}/progress`, { current_amount: amount })
    await fetchGoals()
    return mapGoal(updated)
  }, [user, fetchGoals])

  // Deletar meta (soft delete no backend)
  const deleteGoal = useCallback(async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/goals/${id}`)
    await fetchGoals()
  }, [user, fetchGoals])

  // Arquivar meta (status='archived' — mudança lógica, não soft delete)
  const archiveGoal = useCallback(async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/goals/${id}`, { status: 'archived' })
    await fetchGoals()
    return mapGoal(updated)
  }, [user, fetchGoals])

  // Helpers de filtragem (preservados — consumidores usam)
  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const archivedGoals = goals.filter(g => g.status === 'archived')

  // Calcular progresso percentual (0-100)
  const getProgress = useCallback((goal) => {
    if (!goal.targetAmount || goal.targetAmount === 0) return 0
    return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
  }, [])

  // Calcular dias restantes
  const getDaysRemaining = useCallback((goal) => {
    if (!goal.deadline) return null
    const now = new Date()
    const deadline = new Date(goal.deadline)
    const diffTime = deadline - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }, [])

  const value = {
    goals,
    activeGoals,
    completedGoals,
    archivedGoals,
    loading,
    error,
    addGoal,
    updateGoal,
    updateGoalProgress,
    deleteGoal,
    archiveGoal,
    getProgress,
    getDaysRemaining
  }

  return (
    <GoalsContext.Provider value={value}>
      {children}
    </GoalsContext.Provider>
  )
}
