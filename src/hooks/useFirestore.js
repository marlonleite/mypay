import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
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

// Hook para despesas do cartão
export function useCardExpenses(cardId, month, year) {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setExpenses([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let q

    if (cardId) {
      q = query(
        collection(db, `users/${user.uid}/cardExpenses`),
        where('cardId', '==', cardId),
        orderBy('date', 'desc')
      )
    } else {
      q = query(
        collection(db, `users/${user.uid}/cardExpenses`),
        orderBy('date', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate()
        }))
        setExpenses(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching card expenses:', err)
        setError('Erro ao carregar despesas do cartão')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, cardId, month, year])

  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Se tem parcelamento, criar múltiplas despesas
    if (data.installments && data.installments > 1) {
      const expenses = []
      const baseDate = parseLocalDate(data.date)
      const installmentValue = data.amount / data.installments
      const baseBillMonth = data.billMonth ?? baseDate.getMonth()
      const baseBillYear = data.billYear ?? baseDate.getFullYear()

      for (let i = 0; i < data.installments; i++) {
        const installmentDate = new Date(baseDate)
        installmentDate.setMonth(installmentDate.getMonth() + i)

        // Avançar billMonth/billYear para cada parcela
        let instBillMonth = baseBillMonth + i
        let instBillYear = baseBillYear
        while (instBillMonth > 11) {
          instBillMonth -= 12
          instBillYear++
        }

        expenses.push(
          addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
            ...data,
            amount: installmentValue,
            date: installmentDate,
            billMonth: instBillMonth,
            billYear: instBillYear,
            installment: i + 1,
            totalInstallments: data.installments,
            createdAt: serverTimestamp()
          })
        )
      }

      return await Promise.all(expenses)
    }

    const parsedDate = parseLocalDate(data.date)

    return await addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
      ...data,
      date: parsedDate,
      billMonth: data.billMonth ?? parsedDate.getMonth(),
      billYear: data.billYear ?? parsedDate.getFullYear(),
      installment: 1,
      totalInstallments: 1,
      createdAt: serverTimestamp()
    })
  }

  const updateCardExpense = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/cardExpenses`, id)
    const updateData = {
      ...data,
      date: parseLocalDate(data.date),
      updatedAt: serverTimestamp()
    }

    // Preservar billMonth/billYear se fornecidos (trava na fatura atual)
    if (data.billMonth != null) updateData.billMonth = data.billMonth
    if (data.billYear != null) updateData.billYear = data.billYear

    return await updateDoc(docRef, updateData)
  }

  const deleteCardExpense = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/cardExpenses`, id)
    return await deleteDoc(docRef)
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

// Hook para pegar todas as despesas de cartão de um mês
export function useAllCardExpenses() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setExpenses([])
      setLoading(false)
      return
    }

    setLoading(true)

    const q = query(
      collection(db, `users/${user.uid}/cardExpenses`),
      orderBy('date', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate()
        }))
        setExpenses(data)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

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
export function useTransfers(month, year) {
  const { user } = useAuth()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTransfers([])
      setLoading(false)
      return
    }

    setLoading(true)

    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    const q = query(
      collection(db, `users/${user.uid}/transfers`),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate()
        }))
        setTransfers(data)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, month, year])

  // Criar transferência (cria 2 transações vinculadas + registro de transferência)
  const addTransfer = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const parseLocalDate = (dateStr) => {
      if (dateStr instanceof Date) return dateStr
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day, 12, 0, 0)
    }

    const transferDate = parseLocalDate(data.date)

    // 1. Criar transação de saída (despesa na conta origem)
    const outTransaction = await addDoc(collection(db, `users/${user.uid}/transactions`), {
      description: `Transferência para ${data.toAccountName}`,
      amount: data.amount,
      type: 'expense',
      category: 'transfer_out',
      accountId: data.fromAccountId,
      date: transferDate,
      isTransfer: true,
      createdAt: serverTimestamp()
    })

    // 2. Criar transação de entrada (receita na conta destino)
    const inTransaction = await addDoc(collection(db, `users/${user.uid}/transactions`), {
      description: `Transferência de ${data.fromAccountName}`,
      amount: data.amount,
      type: 'income',
      category: 'transfer_in',
      accountId: data.toAccountId,
      date: transferDate,
      isTransfer: true,
      createdAt: serverTimestamp()
    })

    // 3. Vincular as transações
    await updateDoc(doc(db, `users/${user.uid}/transactions`, outTransaction.id), {
      oppositeTransactionId: inTransaction.id
    })
    await updateDoc(doc(db, `users/${user.uid}/transactions`, inTransaction.id), {
      oppositeTransactionId: outTransaction.id
    })

    // 4. Criar registro de transferência
    const transfer = await addDoc(collection(db, `users/${user.uid}/transfers`), {
      fromAccountId: data.fromAccountId,
      fromAccountName: data.fromAccountName,
      toAccountId: data.toAccountId,
      toAccountName: data.toAccountName,
      amount: data.amount,
      date: transferDate,
      description: data.description || null,
      outTransactionId: outTransaction.id,
      inTransactionId: inTransaction.id,
      createdAt: serverTimestamp()
    })

    return transfer
  }

  // Excluir transferência (exclui as 2 transações vinculadas)
  const deleteTransfer = async (transfer) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Excluir transações vinculadas
    if (transfer.outTransactionId) {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, transfer.outTransactionId))
    }
    if (transfer.inTransactionId) {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, transfer.inTransactionId))
    }

    // Excluir registro de transferência
    await deleteDoc(doc(db, `users/${user.uid}/transfers`, transfer.id))
  }

  return {
    transfers,
    loading,
    addTransfer,
    deleteTransfer
  }
}

// Hook para orçamentos/metas por categoria
export function useBudgets(month, year) {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Buscar orçamentos do mês/ano específico
    const q = query(
      collection(db, `users/${user.uid}/budgets`),
      where('month', '==', month),
      where('year', '==', year)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setBudgets(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching budgets:', err)
        setError('Erro ao carregar orçamentos')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, month, year])

  // Adicionar orçamento
  const addBudget = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Verificar se já existe orçamento para essa categoria no mês
    const existing = budgets.find(b => b.categoryId === data.categoryId)
    if (existing) {
      throw new Error('Já existe um orçamento para esta categoria neste mês')
    }

    return await addDoc(collection(db, `users/${user.uid}/budgets`), {
      categoryId: data.categoryId,
      amount: data.amount,
      month: month,
      year: year,
      createdAt: serverTimestamp()
    })
  }

  // Atualizar orçamento
  const updateBudget = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/budgets`, id)
    return await updateDoc(docRef, {
      amount: data.amount,
      updatedAt: serverTimestamp()
    })
  }

  // Excluir orçamento
  const deleteBudget = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const docRef = doc(db, `users/${user.uid}/budgets`, id)
    return await deleteDoc(docRef)
  }

  // Copiar orçamentos do mês anterior
  const copyFromPreviousMonth = async () => {
    if (!user) throw new Error('Usuário não autenticado')

    // Calcular mês anterior
    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth < 0) {
      prevMonth = 11
      prevYear = year - 1
    }

    // Buscar orçamentos do mês anterior
    const q = query(
      collection(db, `users/${user.uid}/budgets`),
      where('month', '==', prevMonth),
      where('year', '==', prevYear)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      throw new Error('Nenhum orçamento encontrado no mês anterior')
    }

    // Criar cópias para o mês atual
    const promises = snapshot.docs.map(docSnap => {
      const data = docSnap.data()
      // Verificar se já existe
      const exists = budgets.find(b => b.categoryId === data.categoryId)
      if (exists) return Promise.resolve()

      return addDoc(collection(db, `users/${user.uid}/budgets`), {
        categoryId: data.categoryId,
        amount: data.amount,
        month: month,
        year: year,
        createdAt: serverTimestamp()
      })
    })

    await Promise.all(promises)
    return snapshot.docs.length
  }

  // Obter orçamento de uma categoria específica
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
