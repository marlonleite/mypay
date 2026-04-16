/**
 * Activity helpers.
 *
 * Pós Fase E migration: este serviço só contém helpers puros (formatadores,
 * agrupadores, constantes). A leitura de activities vai pelo `useActivities`
 * hook (REST API). A escrita NÃO existe no frontend — backend registra
 * automaticamente via `@audited` em todo usecase de mutação.
 */

import { apiClient } from './apiClient'

// Tipos de ação
export const ACTIVITY_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
}

// Tipos de entidade
export const ACTIVITY_ENTITIES = {
  TRANSACTION: 'transaction',
  CARD_EXPENSE: 'card_expense',
  ACCOUNT: 'account',
  CARD: 'card',
  CATEGORY: 'category',
  GOAL: 'goal',
  TRANSFER: 'transfer',
  BILL_PAYMENT: 'bill_payment'
}

// Labels em português
export const ACTION_LABELS = {
  [ACTIVITY_ACTIONS.CREATE]: 'criou',
  [ACTIVITY_ACTIONS.UPDATE]: 'atualizou',
  [ACTIVITY_ACTIONS.DELETE]: 'deletou'
}

export const ENTITY_LABELS = {
  [ACTIVITY_ENTITIES.TRANSACTION]: {
    income: 'uma receita',
    expense: 'uma despesa',
    default: 'uma transação'
  },
  [ACTIVITY_ENTITIES.CARD_EXPENSE]: 'uma despesa de cartão',
  [ACTIVITY_ENTITIES.ACCOUNT]: 'uma conta',
  [ACTIVITY_ENTITIES.CARD]: 'um cartão',
  [ACTIVITY_ENTITIES.CATEGORY]: 'uma categoria',
  [ACTIVITY_ENTITIES.GOAL]: 'uma meta',
  [ACTIVITY_ENTITIES.TRANSFER]: 'uma transferência',
  [ACTIVITY_ENTITIES.BILL_PAYMENT]: 'um pagamento de fatura'
}

/**
 * Transform: API response (snake_case + new_data/old_data) → frontend shape
 * (camelCase + data/previousData) que ActivityItem.jsx espera.
 *
 * Backend grava `metadata` JSONB que pode conter `accountId`/`categoryId`
 * dentro — promovemos ao topo pra preservar acesso direto pelo UI.
 */
function mapActivity(a) {
  const meta = a.metadata || {}
  return {
    id: a.id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    entityName: a.entity_name ?? null,
    entitySubtype: a.entity_subtype ?? null,
    // Renames pra preservar interface de ActivityItem.jsx:
    data: a.new_data ?? null,
    previousData: a.old_data ?? null,
    // Promovido de metadata pra fácil acesso (consumidores filtram por isso):
    accountId: meta.accountId ?? meta.account_id ?? null,
    categoryId: meta.categoryId ?? meta.category_id ?? null,
    metadata: meta,
    createdAt: a.created_at ? new Date(a.created_at) : new Date(),
  }
}

/**
 * Lê activities do backend.
 *
 * Backend tem filtros: entity_type, action, limit, offset.
 * NÃO tem filtros por accountId/categoryId/daysBack — esses ficam client-side
 * (storage em metadata JSONB; filtro server-side exigiria mudança backend).
 *
 * Trade-off aceitável pra single-user (~centenas de activities). Se virar
 * multi-tenant ou volume crescer, mover filtros pra backend.
 */
export async function fetchActivities({
  entityType = null,
  action = null,
  limit: maxResults = 200,
  offset = 0,
} = {}) {
  const params = new URLSearchParams()
  if (entityType) params.set('entity_type', entityType)
  if (action) params.set('action', action)
  params.set('limit', String(maxResults))
  if (offset) params.set('offset', String(offset))

  const data = await apiClient.get(`/api/v1/activities?${params.toString()}`)
  return Array.isArray(data) ? data.map(mapActivity) : []
}

/**
 * Filtro client-side por accountId/categoryId/daysBack.
 * Aplicado pelo hook após receber a lista do backend.
 */
export function filterActivitiesClientSide(activities, { accountId, categoryId, daysBack } = {}) {
  let out = activities

  if (accountId) {
    out = out.filter(a => a.accountId === accountId)
  }

  if (categoryId) {
    out = out.filter(a => a.categoryId === categoryId)
  }

  if (typeof daysBack === 'number' && daysBack > 0) {
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() - daysBack)
    out = out.filter(a => a.createdAt >= limitDate)
  }

  return out
}

/**
 * Agrupa atividades por data (chave em pt-BR).
 */
export function groupActivitiesByDate(activities) {
  const groups = {}

  activities.forEach(activity => {
    const date = activity.createdAt
    const dateKey = date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(activity)
  })

  return groups
}

/**
 * Formata a descrição da atividade ("criou uma despesa", etc.)
 */
export function formatActivityDescription(activity) {
  const actionLabel = ACTION_LABELS[activity.action] || activity.action

  let entityLabel = ENTITY_LABELS[activity.entityType]

  if (activity.entityType === ACTIVITY_ENTITIES.TRANSACTION && activity.entitySubtype) {
    entityLabel = ENTITY_LABELS[ACTIVITY_ENTITIES.TRANSACTION][activity.entitySubtype]
      || ENTITY_LABELS[ACTIVITY_ENTITIES.TRANSACTION].default
  } else if (typeof entityLabel === 'object') {
    entityLabel = entityLabel.default || 'um item'
  }

  return `${actionLabel} ${entityLabel}`
}

/**
 * Diff entre old_data e new_data — usado pra mostrar "antes/depois" em updates.
 */
export function getDataDiff(previousData, currentData) {
  if (!previousData || !currentData) return null

  const changes = []
  const fieldsToCompare = ['description', 'amount', 'date', 'paid', 'accountId', 'category']
  const fieldLabels = {
    description: 'Descrição',
    amount: 'Valor',
    date: 'Data',
    paid: 'Pago',
    accountId: 'Conta',
    category: 'Categoria'
  }

  fieldsToCompare.forEach(field => {
    if (previousData[field] !== currentData[field]) {
      changes.push({
        field,
        label: fieldLabels[field] || field,
        before: previousData[field],
        after: currentData[field]
      })
    }
  })

  return changes.length > 0 ? changes : null
}
