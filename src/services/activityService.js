/**
 * Serviço de registro de atividades
 * Persiste logs de ações do usuário no Firestore
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit
} from 'firebase/firestore'
import { db } from '../firebase/config'

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
 * Registra uma atividade
 * @param {string} userId - ID do usuário
 * @param {Object} activity - Dados da atividade
 */
export async function logActivity(userId, {
  action,
  entityType,
  entityId,
  entityName,
  entitySubtype = null, // income/expense para transações
  data = null,
  previousData = null,
  accountId = null,
  categoryId = null
}) {
  if (!userId) return null

  try {
    const activityRef = collection(db, `users/${userId}/activities`)

    const activityData = {
      action,
      entityType,
      entityId,
      entityName,
      entitySubtype,
      data,
      previousData,
      accountId,
      categoryId,
      createdAt: serverTimestamp()
    }

    const docRef = await addDoc(activityRef, activityData)
    return docRef.id
  } catch (error) {
    console.error('Erro ao registrar atividade:', error)
    return null
  }
}

/**
 * Busca atividades do usuário
 * @param {string} userId - ID do usuário
 * @param {Object} filters - Filtros opcionais
 */
export async function getActivities(userId, {
  accountId = null,
  categoryId = null,
  daysBack = 90,
  maxResults = 100
} = {}) {
  if (!userId) return []

  try {
    const activitiesRef = collection(db, `users/${userId}/activities`)

    // Data limite (90 dias atrás)
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() - daysBack)
    const limitTimestamp = Timestamp.fromDate(limitDate)

    // Construir query
    let constraints = [
      where('createdAt', '>=', limitTimestamp),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    ]

    // Adicionar filtros se especificados
    if (accountId) {
      constraints = [
        where('accountId', '==', accountId),
        ...constraints
      ]
    }

    if (categoryId) {
      constraints = [
        where('categoryId', '==', categoryId),
        ...constraints
      ]
    }

    const q = query(activitiesRef, ...constraints)
    const snapshot = await getDocs(q)

    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }))

    return activities
  } catch (error) {
    console.error('Erro ao buscar atividades:', error)
    return []
  }
}

/**
 * Agrupa atividades por data
 * @param {Array} activities - Lista de atividades
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
 * Formata a descrição da atividade
 * @param {Object} activity - Atividade
 */
export function formatActivityDescription(activity) {
  const actionLabel = ACTION_LABELS[activity.action] || activity.action

  let entityLabel = ENTITY_LABELS[activity.entityType]

  // Tratar transações com subtipo
  if (activity.entityType === ACTIVITY_ENTITIES.TRANSACTION && activity.entitySubtype) {
    entityLabel = ENTITY_LABELS[ACTIVITY_ENTITIES.TRANSACTION][activity.entitySubtype]
      || ENTITY_LABELS[ACTIVITY_ENTITIES.TRANSACTION].default
  } else if (typeof entityLabel === 'object') {
    entityLabel = entityLabel.default || 'um item'
  }

  return `${actionLabel} ${entityLabel}`
}

/**
 * Obtém as diferenças entre dados antigos e novos
 * @param {Object} previousData - Dados anteriores
 * @param {Object} currentData - Dados atuais
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
