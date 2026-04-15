import { useState, useEffect, useCallback } from 'react'
// Firestore direto ainda necessário pra useBillPayments (próxima entidade na fila Fase E).
// Remover quando bill_payments migrar.
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { parseLocalDate } from '../utils/helpers'

// Transform: API response → frontend shape
// Nota: campo "paid" (não "isPaid") — Firestore sempre usou "paid"
function mapTransaction(t) {
  return {
    id: t.id,
    description: t.description,
    amount: parseFloat(t.amount),
    type: t.type,
    // "T12:00:00" garante interpretação local (evita UTC shift)
    date: t.date ? new Date(t.date + 'T12:00:00') : null,
    accountId: t.account_id ?? null,
    categoryId: t.category_id ?? null,
    notes: t.notes ?? null,
    paid: t.is_paid,
    isTransfer: t.is_transfer,
    oppositeTransactionId: t.opposite_transaction_id ?? null,
    recurrenceGroup: t.recurrence_group ?? null,
    tags: t.tags ? t.tags.map(tag => tag.name) : [],
    createdAt: t.created_at ? new Date(t.created_at) : null,
  }
}

// Resolve tag names → UUIDs via API
async function resolveTagIds(tagNames, apiClient) {
  if (!tagNames || tagNames.length === 0) return []
  const allTags = await apiClient.get('/api/v1/tags')
  return tagNames
    .map(name => allTags.find(t => t.name === name)?.id)
    .filter(Boolean)
}

// Converte payload frontend (camelCase) → API (snake_case)
async function buildTransactionPayload(data, apiClient) {
  const tag_ids = data.tags !== undefined
    ? await resolveTagIds(data.tags, apiClient)
    : undefined

  const payload = {
    description: data.description,
    amount: data.amount,
    type: data.type,
    // date pode chegar como 'YYYY-MM-DD' string ou Date — API espera string ISO date
    date: data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : data.date,
    account_id: data.accountId ?? null,
    category_id: data.categoryId ?? null,
    notes: data.notes ?? null,
    is_paid: data.paid ?? true,
    is_transfer: data.isTransfer ?? false,
    opposite_transaction_id: data.oppositeTransactionId ?? null,
    recurrence_group: data.recurrenceGroup ?? null,
  }

  if (tag_ids !== undefined) payload.tag_ids = tag_ids
  return payload
}

// Hook para transações — migrado para REST API (GET /api/v1/transactions)
// dateRange: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' } | null
// Nota: month prop é 0-indexed (JS); backend espera 1-indexed
export function useTransactions(month, year, dateRange) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const dateRangeKey = dateRange ? `${dateRange.startDate}_${dateRange.endDate}` : null

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')

      let data
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        // Backend não suporta dateRange: busca todos e filtra client-side
        const all = await apiClient.get('/api/v1/transactions')
        const [sy, sm, sd] = dateRange.startDate.split('-').map(Number)
        const [ey, em, ed] = dateRange.endDate.split('-').map(Number)
        const start = new Date(sy, sm - 1, sd, 0, 0, 0)
        const end = new Date(ey, em - 1, ed, 23, 59, 59)
        data = all.filter(t => {
          const d = new Date(t.date + 'T12:00:00')
          return d >= start && d <= end
        })
      } else {
        // month é 0-indexed → backend espera 1-indexed
        const params = `month=${month + 1}&year=${year}`
        data = await apiClient.get(`/api/v1/transactions?${params}`)
      }

      setTransactions(data.map(mapTransaction))
    } catch (err) {
      console.error('Error fetching transactions:', err)
      setError('Erro ao carregar transações')
    } finally {
      setLoading(false)
    }
  }, [user, month, year, dateRangeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    fetchTransactions()
  }, [fetchTransactions])

  const addTransaction = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildTransactionPayload(data, apiClient)
    const created = await apiClient.post('/api/v1/transactions', payload)
    await fetchTransactions()
    return mapTransaction(created) // consumidores usam result.id
  }

  const updateTransaction = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildTransactionPayload(data, apiClient)
    const updated = await apiClient.put(`/api/v1/transactions/${id}`, payload)
    await fetchTransactions()
    return mapTransaction(updated)
  }

  const deleteTransaction = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/transactions/${id}`)
    await fetchTransactions()
  }

  const updateRecurrenceGroup = async (recurrenceGroup, updates) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildTransactionPayload(updates, apiClient)
    const result = await apiClient.put(
      `/api/v1/transactions/recurrence/${recurrenceGroup}`,
      payload
    )
    await fetchTransactions()
    return Array.isArray(result) ? result.length : 0
  }

  const deleteRecurrenceGroup = async (recurrenceGroup) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/transactions/recurrence/${recurrenceGroup}`)
    await fetchTransactions()
    return 0
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateRecurrenceGroup,
    deleteRecurrenceGroup
  }
}

// Transform: API response (snake_case) → frontend shape (camelCase legado)
// Preserva interface usada por Cards.jsx e consumidores.
function mapCard(c) {
  return {
    id: c.id,
    name: c.name,
    lastDigits: c.last_digits ?? null,
    brand: c.brand ?? null,
    // Firestore usava `limit`; Postgres usa `credit_limit` — mantemos `limit` na UI.
    limit: c.credit_limit !== null && c.credit_limit !== undefined
      ? parseFloat(c.credit_limit)
      : null,
    closingDay: c.closing_day ?? null,
    dueDay: c.due_day ?? null,
    color: c.color,
    icon: c.icon,
    bankId: c.bank_id ?? 'generic',
    archived: c.archived,
    createdAt: c.created_at ? new Date(c.created_at) : null,
    updatedAt: c.updated_at ? new Date(c.updated_at) : null,
  }
}

// Converte payload camelCase (frontend) → snake_case (API)
function buildCardPayload(data) {
  const payload = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.lastDigits !== undefined) payload.last_digits = data.lastDigits
  if (data.brand !== undefined) payload.brand = data.brand
  // Frontend pode enviar `limit` (legado) ou `creditLimit`; ambos mapeiam para credit_limit.
  if (data.limit !== undefined) payload.credit_limit = data.limit
  if (data.creditLimit !== undefined) payload.credit_limit = data.creditLimit
  if (data.closingDay !== undefined) payload.closing_day = data.closingDay
  if (data.dueDay !== undefined) payload.due_day = data.dueDay
  if (data.color !== undefined) payload.color = data.color
  if (data.icon !== undefined) payload.icon = data.icon
  if (data.bankId !== undefined) payload.bank_id = data.bankId
  if (data.archived !== undefined) payload.archived = data.archived
  return payload
}

// Hook para cartões de crédito — migrado para REST API (GET /api/v1/cards).
// Interface mantida: { cards, loading, error, addCard, updateCard, deleteCard }.
export function useCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCards = useCallback(async () => {
    if (!user) {
      setCards([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      // include_archived=true mantém paridade com comportamento Firestore (tudo em memória).
      const data = await apiClient.get('/api/v1/cards?include_archived=true')
      // Ordenação por nome (Firestore fazia via query orderBy).
      const sorted = [...data].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      setCards(sorted.map(mapCard))
    } catch (err) {
      console.error('Error fetching cards:', err)
      setError('Erro ao carregar cartões')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchCards()
  }, [fetchCards])

  const addCard = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const created = await apiClient.post('/api/v1/cards', buildCardPayload(data))
    await fetchCards()
    return mapCard(created)
  }

  const updateCard = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/cards/${id}`, buildCardPayload(data))
    await fetchCards()
    return mapCard(updated)
  }

  const deleteCard = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/cards/${id}`)
    await fetchCards()
  }

  return {
    cards,
    loading,
    error,
    addCard,
    updateCard,
    deleteCard
  }
}

// Transform: API response (snake_case, 1-indexed month) → frontend shape (camelCase, 0-indexed)
function mapCardExpense(e) {
  return {
    id: e.id,
    cardId: e.card_id,
    category: e.category_id, // mantém nome legado `category` na UI; valor é UUID
    description: e.description,
    amount: parseFloat(e.amount),
    type: e.type, // 'income' | 'expense'
    // "T12:00:00" garante interpretação local (evita UTC shift)
    date: e.date ? new Date(e.date + 'T12:00:00') : null,
    billMonth: typeof e.bill_month === 'number' ? e.bill_month - 1 : null, // 1-indexed (API) → 0-indexed (JS)
    billYear: e.bill_year,
    installment: e.installment,
    totalInstallments: e.total_installments,
    installmentGroupId: e.installment_group_id ?? null,
    tags: e.tags ? e.tags.map(t => t.name) : [],
    createdAt: e.created_at ? new Date(e.created_at) : null,
    updatedAt: e.updated_at ? new Date(e.updated_at) : null,
  }
}

// camelCase (frontend) → snake_case (API). Resolve tag names → UUIDs e billMonth 0→1.
async function buildCardExpensePayload(data, apiClient) {
  const tag_ids = data.tags !== undefined
    ? await resolveTagIds(data.tags, apiClient)
    : undefined

  const payload = {}

  if (data.cardId !== undefined) payload.card_id = data.cardId
  if (data.category !== undefined) payload.category_id = data.category || null
  if (data.categoryId !== undefined) payload.category_id = data.categoryId || null
  if (data.description !== undefined) payload.description = data.description
  if (data.amount !== undefined) payload.amount = data.amount
  if (data.type !== undefined) payload.type = data.type
  if (data.date !== undefined) {
    payload.date = data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : data.date
  }
  // billMonth: 0-indexed (JS) → 1-indexed (API)
  if (data.billMonth !== undefined && data.billMonth !== null) {
    payload.bill_month = data.billMonth + 1
  }
  if (data.billYear !== undefined) payload.bill_year = data.billYear
  // installments: backend gera N parcelas server-side via total_installments
  if (data.installments !== undefined) payload.total_installments = data.installments
  if (data.totalInstallments !== undefined) payload.total_installments = data.totalInstallments
  if (tag_ids !== undefined) payload.tag_ids = tag_ids

  return payload
}

// Hook para despesas do cartão — migrado para REST API (GET /api/v1/card-expenses)
// month/year são 0-indexed na chamada (JS); o mapping converte pra 1-indexed na URL.
export function useCardExpenses(cardId, month, year) {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setExpenses([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const params = new URLSearchParams()
      if (cardId) params.set('card_id', cardId)
      if (typeof month === 'number') params.set('month', String(month + 1))
      if (typeof year === 'number') params.set('year', String(year))
      const qs = params.toString()
      const data = await apiClient.get(`/api/v1/card-expenses${qs ? `?${qs}` : ''}`)
      setExpenses(data.map(mapCardExpense))
    } catch (err) {
      console.error('Error fetching card expenses:', err)
      setError('Erro ao carregar despesas do cartão')
    } finally {
      setLoading(false)
    }
  }, [user, cardId, month, year])

  useEffect(() => {
    setLoading(true)
    fetchExpenses()
  }, [fetchExpenses])

  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildCardExpensePayload(data, apiClient)
    // Defaults obrigatórios pelo backend caso o caller não passe billMonth/billYear:
    if (payload.bill_month === undefined && data.date) {
      const parsed = parseLocalDate(data.date)
      payload.bill_month = parsed.getMonth() + 1
    }
    if (payload.bill_year === undefined && data.date) {
      const parsed = parseLocalDate(data.date)
      payload.bill_year = parsed.getFullYear()
    }
    if (payload.type === undefined) payload.type = 'expense'
    const created = await apiClient.post('/api/v1/card-expenses', payload)
    await fetchExpenses()
    return mapCardExpense(created)
  }

  const updateCardExpense = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildCardExpensePayload(data, apiClient)
    const updated = await apiClient.put(`/api/v1/card-expenses/${id}`, payload)
    await fetchExpenses()
    return mapCardExpense(updated)
  }

  const deleteCardExpense = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/card-expenses/${id}`)
    await fetchExpenses()
  }

  return {
    expenses,
    loading,
    error,
    addCardExpense,
    updateCardExpense,
    deleteCardExpense
  }
}

// Hook para pegar todas as despesas de cartão (sem filtros) — migrado.
export function useAllCardExpenses() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) {
      setExpenses([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const data = await apiClient.get('/api/v1/card-expenses')
      setExpenses(data.map(mapCardExpense))
    } catch (err) {
      console.error('Error fetching all card expenses:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchAll()
  }, [fetchAll])

  return { expenses, loading }
}

// Transform: snake_case API response → camelCase frontend shape
function mapCategory(c) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    parentId: c.parent_id ?? null,
    archived: c.archived,
    isDefault: c.is_default ?? false,
    createdAt: c.created_at ? new Date(c.created_at) : null,
  }
}

// Hook para categorias — migrado para REST API (GET /api/v1/categories)
// Interface mantida: { categories, loading, error, needsInitialization, initializeDefaultCategories,
//   addCategory, updateCategory, moveCategory, archiveCategory, restoreCategory, deleteCategory,
//   getMainCategories, getSubcategories, getArchivedCategories }
export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const data = await apiClient.get('/api/v1/categories')
      setCategories(data.map(mapCategory))
      setInitialized(true)
    } catch (err) {
      console.error('Error fetching categories:', err)
      setError('Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchCategories()
  }, [fetchCategories])

  const initializeDefaultCategories = async () => {
    if (!user) throw new Error('Usuário não autenticado')
    if (categories.length > 0) return
    const { apiClient } = await import('../services/apiClient')
    await apiClient.post('/api/v1/categories/initialize', {})
    await fetchCategories()
  }

  const addCategory = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.post('/api/v1/categories', {
      name: data.name,
      type: data.type,
      icon: data.icon || 'Tag',
      color: data.color || 'violet',
      parent_id: data.parentId || null,
    })
    await fetchCategories()
  }

  const updateCategory = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const body = { ...data }
    // camelCase → snake_case para campos que divergem
    if ('parentId' in body) { body.parent_id = body.parentId; delete body.parentId }
    if ('isDefault' in body) { body.is_default = body.isDefault; delete body.isDefault }
    await apiClient.put(`/api/v1/categories/${id}`, body)
    await fetchCategories()
  }

  const moveCategory = async (id, newParentId) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.put(`/api/v1/categories/${id}`, { parent_id: newParentId })
    await fetchCategories()
  }

  const archiveCategory = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.put(`/api/v1/categories/${id}`, { archived: true })
    await fetchCategories()
  }

  const restoreCategory = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.put(`/api/v1/categories/${id}`, { archived: false })
    await fetchCategories()
  }

  const deleteCategory = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    // Backend cascateia subcategorias — sem necessidade de deletar manualmente
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/categories/${id}`)
    await fetchCategories()
  }

  // Helpers in-memory (interface mantida, funcionam sobre o array mapeado)
  const getMainCategories = (type) =>
    categories.filter(c => c.type === type && !c.parentId && !c.archived)

  const getSubcategories = (parentId) =>
    categories.filter(c => c.parentId === parentId && !c.archived)

  const getArchivedCategories = () =>
    categories.filter(c => c.archived)

  const needsInitialization = initialized && categories.length === 0

  return {
    categories,
    loading,
    error,
    needsInitialization,
    initializeDefaultCategories,
    addCategory,
    updateCategory,
    moveCategory,
    archiveCategory,
    restoreCategory,
    deleteCategory,
    getMainCategories,
    getSubcategories,
    getArchivedCategories
  }
}

// Transform: API response (snake_case) → frontend shape (camelCase legado).
// Preserva campo `bankId` usado pelo <BankIcon /> em Accounts.jsx.
function mapAccount(a) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    icon: a.icon,
    color: a.color,
    bankId: a.bank_id ?? 'generic',
    balance: a.balance !== null && a.balance !== undefined
      ? parseFloat(a.balance)
      : 0,
    archived: a.archived,
    createdAt: a.created_at ? new Date(a.created_at) : null,
    updatedAt: a.updated_at ? new Date(a.updated_at) : null,
  }
}

// camelCase (frontend) → snake_case (API). Omite campos undefined (útil em PATCH-like updates).
function buildAccountPayload(data) {
  const payload = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.type !== undefined) payload.type = data.type
  if (data.icon !== undefined) payload.icon = data.icon
  if (data.color !== undefined) payload.color = data.color
  if (data.bankId !== undefined) payload.bank_id = data.bankId
  if (data.balance !== undefined) payload.balance = data.balance
  if (data.archived !== undefined) payload.archived = data.archived
  return payload
}

// Hook para contas — migrado para REST API (GET /api/v1/accounts)
// Interface mantida: { accounts, loading, error, needsInitialization,
//   initializeDefaultAccounts, addAccount, updateAccount, archiveAccount,
//   deleteAccount, getActiveAccounts }
export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      // include_archived=true para manter comportamento do Firestore (tudo em memória)
      const data = await apiClient.get('/api/v1/accounts?include_archived=true')
      setAccounts(data.map(mapAccount))
      setInitialized(true)
    } catch (err) {
      console.error('Error fetching accounts:', err)
      setError('Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchAccounts()
  }, [fetchAccounts])

  const initializeDefaultAccounts = async () => {
    if (!user) throw new Error('Usuário não autenticado')
    if (accounts.length > 0) return
    const { apiClient } = await import('../services/apiClient')
    await apiClient.post('/api/v1/accounts/initialize', {})
    await fetchAccounts()
  }

  const addAccount = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.post('/api/v1/accounts', {
      name: data.name,
      type: data.type || 'checking',
      icon: data.icon || 'Wallet',
      color: data.color || 'blue',
      bank_id: data.bankId || 'generic',
      balance: data.balance || 0,
    })
    await fetchAccounts()
  }

  const updateAccount = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.put(`/api/v1/accounts/${id}`, buildAccountPayload(data))
    await fetchAccounts()
  }

  const archiveAccount = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.put(`/api/v1/accounts/${id}`, { archived: true })
    await fetchAccounts()
  }

  const deleteAccount = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/accounts/${id}`)
    await fetchAccounts()
  }

  const getActiveAccounts = () => accounts.filter(a => !a.archived)

  const needsInitialization = initialized && accounts.length === 0

  return {
    accounts,
    loading,
    error,
    needsInitialization,
    initializeDefaultAccounts,
    addAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    getActiveAccounts
  }
}

// Hook para tags — migrado para REST API (GET /api/v1/tags)
// Interface mantida: { tags: string[], loading, addTag, updateTag, deleteTag }
export function useTags() {
  const { user } = useAuth()
  const [tagObjects, setTagObjects] = useState([]) // [{ id, name }]
  const [loading, setLoading] = useState(true)

  const fetchTags = useCallback(async () => {
    if (!user) {
      setTagObjects([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const data = await apiClient.get('/api/v1/tags')
      setTagObjects(data)
    } catch (err) {
      console.error('Error fetching tags:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchTags()
  }, [fetchTags])

  // Interface pública: array de strings (backward compat com consumidores)
  const tags = tagObjects.map(t => t.name)

  const addTag = async (name) => {
    if (!user || !name.trim()) return
    const { apiClient } = await import('../services/apiClient')
    await apiClient.post('/api/v1/tags', { name: name.trim() })
    await fetchTags()
  }

  // updateTag(oldName, newName) — resolve ID internamente
  const updateTag = async (oldName, newName) => {
    if (!user || !oldName || !newName.trim()) return
    const tag = tagObjects.find(t => t.name === oldName)
    if (!tag) throw new Error('Tag não encontrada')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.put(`/api/v1/tags/${tag.id}`, { name: newName.trim() })
    await fetchTags()
  }

  // deleteTag(name) — resolve ID internamente
  const deleteTag = async (name) => {
    if (!user || !name) return
    const tag = tagObjects.find(t => t.name === name)
    if (!tag) return
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/tags/${tag.id}`)
    await fetchTags()
  }

  return { tags, loading, addTag, updateTag, deleteTag }
}

// Hook para transferências entre contas
// Transform: API response (snake_case) → frontend shape (camelCase legado)
function mapTransfer(t) {
  return {
    id: t.id,
    fromAccountId: t.from_account_id,
    toAccountId: t.to_account_id,
    fromAccountName: t.from_account_name ?? null,
    toAccountName: t.to_account_name ?? null,
    outTransactionId: t.out_transaction_id ?? null,
    inTransactionId: t.in_transaction_id ?? null,
    amount: parseFloat(t.amount),
    // "T12:00:00" garante interpretação local (evita UTC shift)
    date: t.date ? new Date(t.date + 'T12:00:00') : null,
    description: t.description ?? null,
    createdAt: t.created_at ? new Date(t.created_at) : null,
  }
}

// Hook para transferências — migrado para REST API (GET /api/v1/transfers)
// month é 0-indexed (JS); backend espera 1-indexed.
// Backend cria as 2 transactions + transfer record atomicamente; frontend não orquestra mais.
export function useTransfers(month, year) {
  const { user } = useAuth()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTransfers = useCallback(async () => {
    if (!user) {
      setTransfers([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      // month 0-indexed (JS) → 1-indexed (backend)
      const params = `month=${month + 1}&year=${year}`
      const data = await apiClient.get(`/api/v1/transfers?${params}`)
      setTransfers(data.map(mapTransfer))
    } catch (err) {
      console.error('Error fetching transfers:', err)
    } finally {
      setLoading(false)
    }
  }, [user, month, year])

  useEffect(() => {
    setLoading(true)
    fetchTransfers()
  }, [fetchTransfers])

  // Criar transferência — backend cria as 2 transactions + transfer record em 1 chamada atômica.
  // Aceita `fromAccountName`/`toAccountName` no input para compatibilidade com chamadores
  // existentes (Accounts.jsx), mas ignora — o backend resolve via JOIN.
  const addTransfer = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')

    const payload = {
      from_account_id: data.fromAccountId,
      to_account_id: data.toAccountId,
      amount: data.amount,
      // date pode chegar como Date ou string 'YYYY-MM-DD'
      date: data.date instanceof Date
        ? data.date.toISOString().slice(0, 10)
        : data.date,
      description: data.description || null,
    }

    const created = await apiClient.post('/api/v1/transfers', payload)
    await fetchTransfers()
    return mapTransfer(created)
  }

  // Excluir transferência — backend faz cascade soft delete nas 2 transactions vinculadas.
  // Aceita o objeto transfer inteiro (compat com Accounts.jsx) ou um id direto.
  const deleteTransfer = async (transferOrId) => {
    if (!user) throw new Error('Usuário não autenticado')
    const id = typeof transferOrId === 'string' ? transferOrId : transferOrId?.id
    if (!id) throw new Error('Transfer id ausente')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/transfers/${id}`)
    await fetchTransfers()
  }

  return {
    transfers,
    loading,
    addTransfer,
    deleteTransfer
  }
}

// Transform: API response (snake_case, 1-indexed month) → frontend shape (camelCase, 0-indexed).
function mapBudget(b) {
  return {
    id: b.id,
    categoryId: b.category_id,
    amount: parseFloat(b.amount),
    month: typeof b.month === 'number' ? b.month - 1 : null, // 1-indexed (API) → 0-indexed (JS)
    year: b.year,
    createdAt: b.created_at ? new Date(b.created_at) : null,
    updatedAt: b.updated_at ? new Date(b.updated_at) : null,
  }
}

// camelCase (frontend) → snake_case (API). month 0→1.
function buildBudgetPayload(data) {
  const payload = {}
  if (data.categoryId !== undefined) payload.category_id = data.categoryId
  if (data.amount !== undefined) payload.amount = data.amount
  if (data.month !== undefined && data.month !== null) payload.month = data.month + 1
  if (data.year !== undefined) payload.year = data.year
  return payload
}

// Hook para orçamentos/metas por categoria — migrado para REST API (GET /api/v1/budgets)
// month é 0-indexed (JS); backend espera 1-indexed.
export function useBudgets(month, year) {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBudgets = useCallback(async () => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      // month JS (0-indexed) → API (1-indexed)
      const params = `month=${month + 1}&year=${year}`
      const data = await apiClient.get(`/api/v1/budgets?${params}`)
      setBudgets(data.map(mapBudget))
    } catch (err) {
      console.error('Error fetching budgets:', err)
      setError('Erro ao carregar orçamentos')
    } finally {
      setLoading(false)
    }
  }, [user, month, year])

  useEffect(() => {
    setLoading(true)
    fetchBudgets()
  }, [fetchBudgets])

  // Adicionar orçamento (backend valida UNIQUE; pré-check defensivo pra mensagem amigável)
  const addBudget = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const existing = budgets.find(b => b.categoryId === data.categoryId)
    if (existing) {
      throw new Error('Já existe um orçamento para esta categoria neste mês')
    }

    const { apiClient } = await import('../services/apiClient')
    const payload = buildBudgetPayload({ ...data, month, year })
    const created = await apiClient.post('/api/v1/budgets', payload)
    await fetchBudgets()
    return mapBudget(created)
  }

  // Atualizar orçamento — só envia campos passados
  const updateBudget = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/budgets/${id}`, buildBudgetPayload(data))
    await fetchBudgets()
    return mapBudget(updated)
  }

  // Excluir orçamento (hard delete — sem soft delete em budgets)
  const deleteBudget = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/budgets/${id}`)
    await fetchBudgets()
  }

  // Copiar orçamentos do mês anterior — backend faz tudo atômico (Jan→Dec rollback,
  // skip de categorias já com budget no mês destino). Retorna lista dos criados.
  const copyFromPreviousMonth = async () => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    // backend espera month 1-indexed
    const created = await apiClient.post('/api/v1/budgets/copy-previous', {
      month: month + 1,
      year,
    })
    await fetchBudgets()
    return Array.isArray(created) ? created.length : 0
  }

  // Obter orçamento de uma categoria específica (lookup local)
  const getBudget = (categoryId) => {
    return budgets.find(b => b.categoryId === categoryId)
  }

  return {
    budgets,
    loading,
    error,
    addBudget,
    updateBudget,
    deleteBudget,
    copyFromPreviousMonth,
    getBudget
  }
}

// Hook para pagamentos de fatura de cartão
export function useBillPayments(month, year) {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setPayments([])
      setAllPayments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Buscar pagamentos do mês/ano específico
    const q = query(
      collection(db, `users/${user.uid}/billPayments`),
      where('month', '==', month),
      where('year', '==', year)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          paidAt: doc.data().paidAt?.toDate()
        }))
        setPayments(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching bill payments:', err)
        setError('Erro ao carregar pagamentos')
        setLoading(false)
      }
    )

    // Buscar todos os pagamentos para calcular saldo anterior
    const allQ = query(
      collection(db, `users/${user.uid}/billPayments`),
      orderBy('paidAt', 'desc')
    )

    const unsubscribeAll = onSnapshot(
      allQ,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          paidAt: doc.data().paidAt?.toDate()
        }))
        setAllPayments(data)
      }
    )

    return () => {
      unsubscribe()
      unsubscribeAll()
    }
  }, [user, month, year])

  // Verificar se uma fatura específica foi paga (total ou parcialmente)
  const isBillPaid = (cardId) => {
    return payments.some(p => p.cardId === cardId)
  }

  // Verificar se foi pago integralmente
  const isBillFullyPaid = (cardId, totalAmount) => {
    const cardPayments = payments.filter(p => p.cardId === cardId)
    const totalPaid = cardPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    return totalPaid >= totalAmount
  }

  // Obter total pago de uma fatura
  const getTotalPaid = (cardId) => {
    const cardPayments = payments.filter(p => p.cardId === cardId)
    return cardPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  }

  // Obter detalhes do pagamento de uma fatura
  const getBillPayment = (cardId) => {
    return payments.find(p => p.cardId === cardId)
  }

  // Obter todos os pagamentos de uma fatura
  const getBillPayments = (cardId) => {
    return payments.filter(p => p.cardId === cardId)
  }

  // Calcular saldo anterior (faturas não pagas de meses anteriores)
  const getPreviousBalance = (cardId) => {
    let balance = 0

    // Calcular mês anterior
    let checkMonth = month - 1
    let checkYear = year
    if (checkMonth < 0) {
      checkMonth = 11
      checkYear = year - 1
    }

    // Buscar pagamentos do mês anterior
    const prevPayments = allPayments.filter(p =>
      p.cardId === cardId &&
      p.month === checkMonth &&
      p.year === checkYear
    )

    // Se houver pagamento parcial, calcular saldo não pago
    // (isso precisaria de acesso aos gastos do mês anterior - simplificado por ora)
    if (prevPayments.length > 0) {
      const hasCarryOver = prevPayments.some(p => p.carryOverBalance && p.carryOverBalance > 0)
      if (hasCarryOver) {
        balance = prevPayments[0].carryOverBalance
      }
    }

    return balance
  }

  // Registrar pagamento de fatura (suporta pagamentos parciais)
  const addBillPayment = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Calcular saldo não pago (carry over)
    const carryOverBalance = data.totalBill ? Math.max(0, data.totalBill - data.amount) : 0

    return await addDoc(collection(db, `users/${user.uid}/billPayments`), {
      cardId: data.cardId,
      month: data.month,
      year: data.year,
      amount: data.amount,
      totalBill: data.totalBill || data.amount,
      carryOverBalance: carryOverBalance,
      accountId: data.accountId,
      transactionId: data.transactionId,
      isPartial: data.amount < (data.totalBill || data.amount),
      paidAt: data.paidAt || new Date(),
      createdAt: serverTimestamp()
    })
  }

  // Excluir pagamento (caso precise estornar)
  const deleteBillPayment = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const docRef = doc(db, `users/${user.uid}/billPayments`, id)
    return await deleteDoc(docRef)
  }

  return {
    payments,
    loading,
    error,
    isBillPaid,
    isBillFullyPaid,
    getTotalPaid,
    getBillPayment,
    getBillPayments,
    getPreviousBalance,
    addBillPayment,
    deleteBillPayment
  }
}
