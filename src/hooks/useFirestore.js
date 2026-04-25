import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeMany } from '../services/eventStream'
// 🎉 Firestore SDK não é mais usado neste arquivo — todos os hooks foram migrados
// pra REST API. Mantém-se Firebase Auth + FCM no projeto (config.js), mas o SDK
// de dados (firestore) saiu deste arquivo após F4 da Fase E pós-refactor.

/**
 * Helper compartilhado: subscribe a eventos SSE de uma ou mais entidades e
 * dispara o callback (tipicamente re-fetch). Conexão SSE em si é gerenciada
 * em AuthContext (connect/disconnect no login/logout).
 */
function useEventInvalidation(entities, callback) {
  useEffect(() => {
    if (!entities || entities.length === 0) return
    const unsub = subscribeMany(entities, callback)
    return unsub
  }, [callback, ...entities]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Transform: API response → frontend shape
// Nota: campo "paid" (não "isPaid") — Firestore sempre usou "paid"
// Pós Fase B-Refactor (Organizze): transactions é tabela UNIFICADA — receitas,
// despesas, compras de cartão, pagamentos de fatura, pares de transferência e
// ocorrências de recorrência vivem aqui (FKs novas indicam o tipo).
function parseInstallmentIndex(raw, defaultValue = 1) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return defaultValue
  return Math.floor(n)
}

function parseTotalInstallments(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

function mapTransaction(t) {
  const totalInst = parseTotalInstallments(t?.total_installments)
  const inst = parseInstallmentIndex(t?.installment, 1)
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
    creditCardId: t.credit_card_id ?? null,
    creditCardInvoiceId: t.credit_card_invoice_id ?? null,
    paidCreditCardId: t.paid_credit_card_id ?? null,
    paidCreditCardInvoiceId: t.paid_credit_card_invoice_id ?? null,
    // Installment plan: one DB row = one installment; group via installment_group_id
    installment: totalInst > 1 ? Math.min(inst, totalInst) : 1,
    totalInstallments: totalInst,
    installmentGroupId: t.installment_group_id ?? null,
    recurrenceId: t.recurrence_id ?? null,
    // isFixed = legacy name; UI "recorrente" uses recurrence_id (not text heuristics)
    isFixed: Boolean(t.recurrence_id),
    isInstallment: totalInst > 1,
    tags: t.tags ? t.tags.map((tag) => (typeof tag === 'string' ? tag : tag.name)) : [],
    createdAt: t.created_at ? new Date(t.created_at) : null,
    updatedAt: t.updated_at ? new Date(t.updated_at) : null,
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

// Converte payload frontend (camelCase) → API (snake_case).
// Pós Fase B-Refactor (Organizze): aceita campos novos do modelo unificado.
// Constraint do backend: credit_card_invoice_id requer credit_card_id;
// paid_credit_card_id e paid_credit_card_invoice_id devem vir juntos.
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
    // Form de Transactions.jsx usa `category` (legacy Firestore name); aceita ambos.
    category_id: data.categoryId ?? data.category ?? null,
    notes: data.notes ?? null,
    is_paid: data.paid ?? true,
    is_transfer: data.isTransfer ?? false,
    opposite_transaction_id: data.oppositeTransactionId ?? null,
    // 🆕 Onda 1+6 — compra de cartão (invoice_id é opcional; backend auto-resolve)
    credit_card_id: data.creditCardId ?? null,
    credit_card_invoice_id: data.creditCardInvoiceId ?? null,
    // 🆕 Onda 1+4 — pagamento de fatura
    paid_credit_card_id: data.paidCreditCardId ?? null,
    paid_credit_card_invoice_id: data.paidCreditCardInvoiceId ?? null,
    // 🆕 Onda 1 — parcelamento (backend gera N rows quando total_installments > 1)
    installment: data.installment ?? 1,
    total_installments: data.totalInstallments ?? data.installments ?? 1,
    installment_group_id: data.installmentGroupId ?? null,
    // 🆕 Onda 3 — vínculo a template de recorrência (substitui recurrence_group string)
    recurrence_id: data.recurrenceId ?? null,
  }

  if (tag_ids !== undefined) payload.tag_ids = tag_ids
  return payload
}

/**
 * Normaliza assinaturas: useTransactions(month, year) | useTransactions(month, year, dateRange)
 * | useTransactions({ month, year, dateRange?, excludeCardExpenses? })
 * excludeCardExpenses: true (default) = GET com exclude_card_expenses=true, omite
 * despesas de fatura (credit_card_id). Pagamentos (paid_*) seguem na lista. Só
 * a página Lançamentos passa false para lista unificada.
 */
function normalizeUseTransactionsInput(monthOrOpts, year, dateRange) {
  if (monthOrOpts !== null && typeof monthOrOpts === 'object' && !Array.isArray(monthOrOpts)) {
    return {
      month: monthOrOpts.month,
      year: monthOrOpts.year,
      dateRange: monthOrOpts.dateRange ?? null,
      // Default API: exclui compras de cartão; a página Lançamentos pode passar false
      excludeCardExpenses: monthOrOpts.excludeCardExpenses !== false,
    }
  }
  return { month: monthOrOpts, year, dateRange: dateRange ?? null, excludeCardExpenses: true }
}

// Hook para transações — migrado para REST API (GET /api/v1/transactions)
// dateRange: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' } | null
// Nota: month prop é 0-indexed (JS); backend espera 1-indexed
// Parâmetros GET suportados (2026-04, OpenAPI): month, year, exclude_card_expenses,
// credit_card_id, credit_card_invoice_id, paid_*, — sem q, account_id, date_from, limit.
export function useTransactions(month, year, dateRangeMaybe) {
  const opts = normalizeUseTransactionsInput(month, year, dateRangeMaybe)
  const { month: m, year: y, dateRange, excludeCardExpenses } = opts

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

      const ex = excludeCardExpenses ? 'true' : 'false'
      let data
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        // Não existe date_from/date_to no GET: traz tudo (sem excluir cartão se ex=false) e filtra no cliente
        const all = await apiClient.get(`/api/v1/transactions?exclude_card_expenses=${ex}`)
        const [sy, sm, sd] = dateRange.startDate.split('-').map(Number)
        const [ey, em, ed] = dateRange.endDate.split('-').map(Number)
        const start = new Date(sy, sm - 1, sd, 0, 0, 0)
        const end = new Date(ey, em - 1, ed, 23, 59, 59)
        data = all.filter(t => {
          const d = new Date(t.date + 'T12:00:00')
          return d >= start && d <= end
        })
      } else {
        const params = new URLSearchParams()
        params.set('month', String(m + 1))
        params.set('year', String(y))
        params.set('exclude_card_expenses', ex)
        data = await apiClient.get(`/api/v1/transactions?${params.toString()}`)
      }

      setTransactions(data.map(mapTransaction))
    } catch (err) {
      console.error('Error fetching transactions:', err)
      setError('Erro ao carregar transações')
    } finally {
      setLoading(false)
    }
  }, [user, m, y, dateRangeKey, excludeCardExpenses]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    fetchTransactions()
  }, [fetchTransactions])

  // SSE: re-fetch quando qualquer transaction muda em outra aba/dispositivo.
  useEventInvalidation(['transaction', 'transfer'], fetchTransactions)

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

  // ❌ updateRecurrenceGroup / deleteRecurrenceGroup REMOVIDOS na Onda 7 do refactor.
  // O backend não tem mais coluna `recurrence_group` (string) nem endpoints batch
  // `/transactions/recurrence/{group}`. Recurrence vive em `recurrences` (template) +
  // FK `recurrence_id` em transactions. Edição em massa de "fixed" deve ir pelo
  // template (PUT /api/v1/recurrences/{id}) — ver hook `useRecurrences` (F6).

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
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
    description: c.description ?? null,        // 🆕 Onda 1 (Organizze)
    isDefault: c.is_default ?? false,          // 🆕 Onda 1 (Organizze) — marca cartão padrão
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
  if (data.description !== undefined) payload.description = data.description  // 🆕
  if (data.isDefault !== undefined) payload.is_default = data.isDefault       // 🆕
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

  useEventInvalidation(['card'], fetchCards)

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

// =====================================================================
// Credit Card Invoices — 🆕 entidade adicionada na Onda 2 do refactor.
// Faturas vivem como entidade própria; compras (`transactions.credit_card_invoice_id`)
// e pagamentos (`transactions.paid_credit_card_invoice_id`) referenciam invoice.id.
// Backend computa balance/payment_amount/previous_balance via window function.
// =====================================================================

// Transform: API response (snake_case + decimals como string) → frontend shape.
function mapCreditCardInvoice(i) {
  const toNumber = (v) => (v !== null && v !== undefined ? parseFloat(v) : 0)
  return {
    id: i.id,
    cardId: i.card_id,
    // due_date é o vencimento (ex.: 10/04). dateNoon evita UTC shift.
    dueDate: i.due_date ? new Date(i.due_date + 'T12:00:00') : null,
    startingDate: i.starting_date ? new Date(i.starting_date + 'T12:00:00') : null,
    closingDate: i.closing_date ? new Date(i.closing_date + 'T12:00:00') : null,
    // Computed fields:
    amount: toNumber(i.amount),                       // soma compras - estornos
    paymentAmount: toNumber(i.payment_amount),        // soma pagamentos alocados
    previousBalance: toNumber(i.previous_balance),    // carry-over fatura anterior
    balance: toNumber(i.balance),                     // previous_balance + amount - payment_amount
    createdAt: i.created_at ? new Date(i.created_at) : null,
  }
}

// Hook pra faturas de um cartão. Sem cardId, retorna lista vazia (não busca tudo).
// Backend: GET /api/v1/credit-card-invoices?card_id=X (lista todas as invoices do cartão).
//
// Helpers expostos:
// - findInvoiceByDueMonth(month, year): retorna invoice cujo due_date cai no mês/ano (JS, 0-indexed).
//   Útil pro fluxo "pagar fatura de abril" — é a invoice que vence em abril.
// - findInvoiceForDate(date): retorna invoice que cobre essa data (entre starting/closing).
//   Útil pra saber em qual fatura uma compra cai.
export function useCreditCardInvoices(cardId) {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchInvoices = useCallback(async () => {
    if (!user || !cardId) {
      setInvoices([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const data = await apiClient.get(`/api/v1/credit-card-invoices?card_id=${cardId}`)
      // Ordena por due_date desc — fatura mais recente primeiro.
      const sorted = [...data].sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''))
      setInvoices(sorted.map(mapCreditCardInvoice))
    } catch (err) {
      console.error('Error fetching credit card invoices:', err)
      setError('Erro ao carregar faturas')
    } finally {
      setLoading(false)
    }
  }, [user, cardId])

  useEffect(() => {
    setLoading(true)
    fetchInvoices()
  }, [fetchInvoices])

  // Backend não @audita credit_card_invoice (auto-criado), mas balance/payment_amount
  // são derivados de transactions — re-fetch quando uma transaction muda.
  useEventInvalidation(['transaction', 'card'], fetchInvoices)

  // month: 0-indexed (JS); year: 4 dígitos.
  const findInvoiceByDueMonth = (month, year) => {
    return invoices.find(inv =>
      inv.dueDate &&
      inv.dueDate.getMonth() === month &&
      inv.dueDate.getFullYear() === year
    )
  }

  const findInvoiceForDate = (date) => {
    if (!date) return null
    const target = date instanceof Date ? date : new Date(date)
    return invoices.find(inv =>
      inv.startingDate && inv.closingDate &&
      target >= inv.startingDate && target <= inv.closingDate
    )
  }

  // Re-fetch (útil após criar/pagar transação que afeta computed fields).
  const refresh = fetchInvoices

  return {
    invoices,
    loading,
    error,
    findInvoiceByDueMonth,
    findInvoiceForDate,
    refresh,
  }
}

// Busca invoices de múltiplos cartões em paralelo. Usado por Accounts.jsx
// para mostrar o saldo devedor real (invoice.balance computed) de cada cartão.
export function useAllCreditCardInvoices(cardIds) {
  const { user } = useAuth()
  const [invoicesByCard, setInvoicesByCard] = useState({})
  const [loading, setLoading] = useState(true)

  const cardIdsKey = Array.isArray(cardIds) ? cardIds.join(',') : ''

  const fetchAll = useCallback(async () => {
    if (!user || !cardIds || cardIds.length === 0) {
      setInvoicesByCard({})
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const results = await Promise.all(
        cardIds.map(async (cardId) => {
          const data = await apiClient.get(`/api/v1/credit-card-invoices?card_id=${cardId}`)
          return [cardId, data.map(mapCreditCardInvoice)]
        })
      )
      setInvoicesByCard(Object.fromEntries(results))
    } catch (err) {
      console.error('Error fetching all credit card invoices:', err)
    } finally {
      setLoading(false)
    }
  }, [user, cardIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    fetchAll()
  }, [fetchAll])

  useEventInvalidation(['transaction', 'card'], fetchAll)

  // Retorna a invoice cujo due_date cai no mês/ano (month 0-indexed).
  const findInvoiceByDueMonth = (cardId, month, year) => {
    const invoices = invoicesByCard[cardId] || []
    return invoices.find(inv =>
      inv.dueDate &&
      inv.dueDate.getMonth() === month &&
      inv.dueDate.getFullYear() === year
    )
  }

  return { invoicesByCard, loading, findInvoiceByDueMonth }
}

// =====================================================================
// Recurrences — 🆕 entidade adicionada na Onda 3 do refactor (Organizze).
// Templates de recorrência (condomínio, salário, mensalidade). Backend
// materializa ocorrências on-demand em `transactions.list` quando month+year
// são fornecidos — substitui o modelo "expand 12 transactions" do Firestore.
//
// Endpoints (sem DELETE — só archive/unarchive):
//   GET    /api/v1/recurrences?include_archived=
//   POST   /api/v1/recurrences
//   GET    /api/v1/recurrences/{id}
//   PUT    /api/v1/recurrences/{id}
//   PUT    /api/v1/recurrences/{id}/archive
//   PUT    /api/v1/recurrences/{id}/unarchive
// =====================================================================

// Frequencies aceitas pelo backend (Literal type em RecurrenceCreate).
export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
]

// Transform: API response (snake_case) → frontend shape (camelCase).
function mapRecurrence(r) {
  return {
    id: r.id,
    description: r.description,
    amount: parseFloat(r.amount),
    type: r.type, // 'income' | 'expense'
    accountId: r.account_id ?? null,
    categoryId: r.category_id ?? null,
    frequency: r.frequency,
    dayOfPeriod: r.day_of_period ?? null,
    startDate: r.start_date ? new Date(r.start_date + 'T12:00:00') : null,
    endDate: r.end_date ? new Date(r.end_date + 'T12:00:00') : null,
    lastGenerated: r.last_generated ? new Date(r.last_generated + 'T12:00:00') : null,
    archived: r.archived,
    createdAt: r.created_at ? new Date(r.created_at) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
  }
}

// camelCase → snake_case. Datas viram 'YYYY-MM-DD'.
function buildRecurrencePayload(data) {
  const toIsoDate = (d) => {
    if (!d) return null
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    return d // assume já é string ISO
  }

  const payload = {}
  if (data.description !== undefined) payload.description = data.description
  if (data.amount !== undefined) payload.amount = data.amount
  if (data.type !== undefined) payload.type = data.type
  if (data.accountId !== undefined) payload.account_id = data.accountId
  if (data.categoryId !== undefined) payload.category_id = data.categoryId
  if (data.frequency !== undefined) payload.frequency = data.frequency
  if (data.dayOfPeriod !== undefined) payload.day_of_period = data.dayOfPeriod
  if (data.startDate !== undefined) payload.start_date = toIsoDate(data.startDate)
  if (data.endDate !== undefined) payload.end_date = toIsoDate(data.endDate)
  return payload
}

// Hook pra templates de recorrência. Sem parâmetros, retorna apenas ativos
// (archived=false). Passe { includeArchived: true } pra ver todos.
export function useRecurrences({ includeArchived = false } = {}) {
  const { user } = useAuth()
  const [recurrences, setRecurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRecurrences = useCallback(async () => {
    if (!user) {
      setRecurrences([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      const qs = includeArchived ? '?include_archived=true' : ''
      const data = await apiClient.get(`/api/v1/recurrences${qs}`)
      // Ordenação: ativos primeiro, depois por description.
      const sorted = [...data].sort((a, b) => {
        if (a.archived !== b.archived) return a.archived ? 1 : -1
        return (a.description ?? '').localeCompare(b.description ?? '')
      })
      setRecurrences(sorted.map(mapRecurrence))
    } catch (err) {
      console.error('Error fetching recurrences:', err)
      setError('Erro ao carregar recorrências')
    } finally {
      setLoading(false)
    }
  }, [user, includeArchived])

  useEffect(() => {
    setLoading(true)
    fetchRecurrences()
  }, [fetchRecurrences])

  // Backend não @audita recurrence diretamente, mas a entidade existe — wirea por
  // garantia (no-op se backend nunca dispara).
  useEventInvalidation(['recurrence'], fetchRecurrences)

  const addRecurrence = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    // Defaults: startDate hoje, type expense, frequency monthly se omitidos.
    const payload = buildRecurrencePayload({
      type: 'expense',
      frequency: 'monthly',
      startDate: new Date(),
      ...data,
    })
    const created = await apiClient.post('/api/v1/recurrences', payload)
    await fetchRecurrences()
    return mapRecurrence(created)
  }

  const updateRecurrence = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/recurrences/${id}`, buildRecurrencePayload(data))
    await fetchRecurrences()
    return mapRecurrence(updated)
  }

  // Backend não tem DELETE — só archive (preserva ocorrências já materializadas).
  const archiveRecurrence = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/recurrences/${id}/archive`, {})
    await fetchRecurrences()
    return mapRecurrence(updated)
  }

  const unarchiveRecurrence = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const updated = await apiClient.put(`/api/v1/recurrences/${id}/unarchive`, {})
    await fetchRecurrences()
    return mapRecurrence(updated)
  }

  const refresh = fetchRecurrences

  return {
    recurrences,
    loading,
    error,
    addRecurrence,
    updateRecurrence,
    archiveRecurrence,
    unarchiveRecurrence,
    refresh,
  }
}

// Transform: transaction (modelo unificado pós-Onda 6) → shape legado de card_expense.
// Pós Fase B-Refactor: card_expenses table foi DROPPED; compras de cartão agora
// vivem em `transactions` com `credit_card_id` populado. Esta camada de adaptação
// preserva a interface esperada pelos consumidores (Cards.jsx, Dashboard, Reports).
//
// IMPORTANTE: `billMonth`/`billYear` agora são DERIVADOS de `transaction.date`
// (aproximação — não considera closing_day do cartão). Pra precisão correta da
// fatura (que pode shiftar uma compra do dia 31/jan pra fatura de fevereiro),
// usar `useCreditCardInvoices` (F5) e fazer JOIN via `creditCardInvoiceId`.
function mapTransactionAsCardExpense(t) {
  const date = t.date ? new Date(t.date + 'T12:00:00') : null
  const totalInst = parseTotalInstallments(t?.total_installments)
  const inst = parseInstallmentIndex(t?.installment, 1)
  return {
    id: t.id,
    cardId: t.credit_card_id,
    creditCardInvoiceId: t.credit_card_invoice_id ?? null,
    category: t.category_id,
    description: t.description,
    amount: parseFloat(t.amount),
    type: t.type,
    date,
    // Aproximação até F5 expor invoice's starting/closing dates:
    billMonth: date ? date.getMonth() : null,   // 0-indexed (JS)
    billYear: date ? date.getFullYear() : null,
    installment: totalInst > 1 ? Math.min(inst, totalInst) : 1,
    totalInstallments: totalInst,
    installmentGroupId: t.installment_group_id ?? null,
    tags: t.tags ? t.tags.map(tag => tag.name) : [],
    notes: t.notes ?? null,
    createdAt: t.created_at ? new Date(t.created_at) : null,
    updatedAt: t.updated_at ? new Date(t.updated_at) : null,
  }
}

// camelCase (frontend, shape legado de card_expense) → payload /transactions com credit_card_id.
// Backend auto-resolve `credit_card_invoice_id` se omitido (Onda 6 — invoice_resolution.ensure_invoice_for_period).
async function buildCardExpenseAsTransactionPayload(data, apiClient) {
  const tag_ids = data.tags !== undefined
    ? await resolveTagIds(data.tags, apiClient)
    : undefined

  const payload = {}

  if (data.cardId !== undefined) payload.credit_card_id = data.cardId
  if (data.creditCardInvoiceId !== undefined) payload.credit_card_invoice_id = data.creditCardInvoiceId
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
  if (data.notes !== undefined) payload.notes = data.notes
  // Parcelamento: frontend ainda gera N rows manualmente em fluxos legacy.
  // Onda 6 backend NÃO splita server-side em /transactions (só no antigo /card-expenses).
  if (data.installment !== undefined) payload.installment = data.installment
  if (data.installments !== undefined) payload.total_installments = data.installments
  if (data.totalInstallments !== undefined) payload.total_installments = data.totalInstallments
  if (data.installmentGroupId !== undefined) payload.installment_group_id = data.installmentGroupId
  if (tag_ids !== undefined) payload.tag_ids = tag_ids

  return payload
}

// Hook para despesas do cartão — agora FILTER VIEW sobre /api/v1/transactions
// (post-refactor: tabela `card_expenses` foi DROPPED na Onda 6).
// Interface preservada: { expenses, loading, error, addCardExpense, updateCardExpense, deleteCardExpense }.
export function useCardExpenses(cardId, month, year, invoiceId) {
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
      params.set('exclude_card_expenses', 'false')
      if (invoiceId) {
        params.set('credit_card_invoice_id', invoiceId)
      } else {
        if (cardId) params.set('credit_card_id', cardId)
        if (typeof month === 'number') params.set('month', String(month + 1))
        if (typeof year === 'number') params.set('year', String(year))
      }
      const qs = params.toString()
      const data = await apiClient.get(`/api/v1/transactions${qs ? `?${qs}` : ''}`)
      const cardTxns = invoiceId ? data : (cardId ? data : data.filter(t => t.credit_card_id))
      setExpenses(cardTxns.map(mapTransactionAsCardExpense))
    } catch (err) {
      console.error('Error fetching card expenses:', err)
      setError('Erro ao carregar despesas do cartão')
    } finally {
      setLoading(false)
    }
  }, [user, cardId, month, year, invoiceId])

  useEffect(() => {
    setLoading(true)
    fetchExpenses()
  }, [fetchExpenses])

  // Filter view sobre /transactions — invalida com qualquer transaction.
  useEventInvalidation(['transaction'], fetchExpenses)

  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildCardExpenseAsTransactionPayload(data, apiClient)
    // type default
    if (payload.type === undefined) payload.type = 'expense'
    // credit_card_id obrigatório no novo modelo
    if (!payload.credit_card_id) {
      throw new Error('cardId é obrigatório para criar despesa de cartão')
    }
    const created = await apiClient.post('/api/v1/transactions', payload)
    await fetchExpenses()
    return mapTransactionAsCardExpense(created)
  }

  const updateCardExpense = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    const payload = await buildCardExpenseAsTransactionPayload(data, apiClient)
    const updated = await apiClient.put(`/api/v1/transactions/${id}`, payload)
    await fetchExpenses()
    return mapTransactionAsCardExpense(updated)
  }

  const deleteCardExpense = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/transactions/${id}`)
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

// Hook para todas as despesas de cartão (sem filtro de mês). Filter view sobre
// /api/v1/transactions retornando apenas as com credit_card_id != null.
//
// Performance: backend não tem filtro `is_credit_card=true` — o GET retorna TODAS
// transactions e filtramos client-side. Aceitável pra single-user; revisitar se virar
// multi-tenant ou se o volume crescer. Alternativa futura: filtro server-side.
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
      const data = await apiClient.get('/api/v1/transactions?exclude_card_expenses=false')
      const cardTxns = data.filter(t => t.credit_card_id)
      setExpenses(cardTxns.map(mapTransactionAsCardExpense))
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

  // Filter view sobre /transactions
  useEventInvalidation(['transaction'], fetchAll)

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
    groupId: c.group_id ?? null,
    fixed: c.fixed ?? false,
    essential: c.essential ?? false,
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

  useEventInvalidation(['category'], fetchCategories)

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
      group_id: data.groupId ?? null,
      fixed: data.fixed ?? false,
      essential: data.essential ?? false,
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
    if ('groupId' in body) { body.group_id = body.groupId; delete body.groupId }
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
    description: a.description ?? null,        // 🆕 Onda 1 (Organizze)
    isDefault: a.is_default ?? false,          // 🆕 Onda 1 (Organizze) — marca conta padrão
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
  if (data.description !== undefined) payload.description = data.description  // 🆕
  if (data.isDefault !== undefined) payload.is_default = data.isDefault       // 🆕
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

  useEventInvalidation(['account'], fetchAccounts)

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

  useEventInvalidation(['tag'], fetchTags)

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

  // Transfers vivem como par de transactions internamente — invalida com transaction também.
  useEventInvalidation(['transfer', 'transaction'], fetchTransfers)

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

  useEventInvalidation(['budget'], fetchBudgets)

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

// Transform: transaction (com paid_credit_card_id populado) → shape legado de bill_payment.
// Pós Fase B-Refactor: tabela `bill_payments` foi DROPPED na Onda 4.
// Pagamentos de fatura agora vivem em `transactions` com `paid_credit_card_id` +
// `paid_credit_card_invoice_id`. Esta camada de adaptação preserva a interface
// dos consumidores (Cards.jsx, Accounts.jsx).
//
// IMPORTANTE: campos `totalBill` e `carryOverBalance` (que existiam em
// bill_payment) NÃO existem na transaction. Eles eram CALCULADOS — totalBill
// vinha do form do usuário (snapshot do total da fatura na hora do pagamento),
// carryOverBalance era derivado disso. No novo modelo, esses dados vivem em
// `credit_card_invoices` (campos computed `amount`/`balance`/`previous_balance`).
//
// Pra preservar a interface mínima dos consumidores agora:
// - getTotalPaid/isBillPaid funcionam (somam transactions de pagamento)
// - getPreviousBalance retorna 0 (placeholder) até F5/F8 wirearem useCreditCardInvoices
function mapTransactionAsBillPayment(t) {
  return {
    id: t.id,
    cardId: t.paid_credit_card_id,
    paidCreditCardInvoiceId: t.paid_credit_card_invoice_id ?? null,
    accountId: t.account_id ?? null,
    // Bill payment não tem mais relação com transaction_id externa — é a própria transaction.
    transactionId: t.id,
    amount: parseFloat(t.amount),
    // Aproximação até F5: deriva month/year da date do pagamento.
    // O correto seria via paid_credit_card_invoice_id.starting_date.
    month: t.date ? new Date(t.date + 'T12:00:00').getMonth() : null,    // 0-indexed
    year: t.date ? new Date(t.date + 'T12:00:00').getFullYear() : null,
    paidAt: t.date ? new Date(t.date + 'T12:00:00') : null,
    // Campos legados que não têm equivalente direto no novo modelo:
    totalBill: parseFloat(t.amount),  // sem snapshot; assumimos amount = totalBill
    carryOverBalance: 0,              // F5/F8 vai buscar do invoice.previous_balance
    isPartial: false,                 // F5/F8 vai derivar comparando amount vs invoice.amount
  }
}

// Hook para pagamentos de fatura — agora FILTER VIEW sobre /api/v1/transactions
// (Onda 4: bill_payments DROPPED). Interface preservada pra consumidores existentes.
export function useBillPayments(month, year) {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPayments = useCallback(async () => {
    if (!user) {
      setPayments([])
      setLoading(false)
      return
    }

    try {
      const { apiClient } = await import('../services/apiClient')
      // Buscar transactions do mês com paid_credit_card_id != null.
      // Backend não tem filtro `is_bill_payment`; usa month/year e filtra client-side.
      const params = new URLSearchParams()
      if (typeof month === 'number') params.set('month', String(month + 1))
      if (typeof year === 'number') params.set('year', String(year))
      params.set('exclude_card_expenses', 'true')
      const qs = params.toString()
      const data = await apiClient.get(`/api/v1/transactions?${qs}`)
      const billPayments = data.filter(t => t.paid_credit_card_id && !t.credit_card_id)
      setPayments(billPayments.map(mapTransactionAsBillPayment))
    } catch (err) {
      console.error('Error fetching bill payments:', err)
      setError('Erro ao carregar pagamentos')
    } finally {
      setLoading(false)
    }
  }, [user, month, year])

  useEffect(() => {
    setLoading(true)
    fetchPayments()
  }, [fetchPayments])

  // Pagamentos são transactions com paid_credit_card_id — invalida com qualquer transaction.
  useEventInvalidation(['transaction'], fetchPayments)

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

  // Calcular saldo anterior (carry-over de meses anteriores).
  // ⚠️ TRANSITIONAL: até F5/F8, retorna 0. O dado correto vive em
  // credit_card_invoices.previous_balance (computed pelo backend).
  const getPreviousBalance = (_cardId) => {
    return 0
  }

  // Registrar pagamento de fatura: cria transaction com paid_credit_card_id
  // + paid_credit_card_invoice_id. Backend valida que ambos vêm juntos.
  const addBillPayment = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    if (!data.cardId) throw new Error('cardId é obrigatório')
    if (!data.paidCreditCardInvoiceId) {
      throw new Error('paidCreditCardInvoiceId é obrigatório (resolver via useCreditCardInvoices)')
    }

    const { apiClient } = await import('../services/apiClient')
    const paidAt = data.paidAt instanceof Date
      ? data.paidAt.toISOString().slice(0, 10)
      : (data.paidAt || new Date().toISOString().slice(0, 10))

    const payload = {
      description: data.description || `Pagamento de fatura`,
      amount: data.amount,
      type: 'expense',
      date: paidAt,
      account_id: data.accountId ?? null,
      paid_credit_card_id: data.cardId,
      paid_credit_card_invoice_id: data.paidCreditCardInvoiceId,
      is_paid: true,
    }

    const created = await apiClient.post('/api/v1/transactions', payload)
    await fetchPayments()
    return mapTransactionAsBillPayment(created)
  }

  // Excluir pagamento (estorno) — soft delete da transaction.
  const deleteBillPayment = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const { apiClient } = await import('../services/apiClient')
    await apiClient.delete(`/api/v1/transactions/${id}`)
    await fetchPayments()
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
