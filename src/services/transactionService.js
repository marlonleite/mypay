import { apiClient } from './apiClient'

/** Alinhado ao POST /api/v1/transactions/batch-delete (modo lista de ids). */
export const TRANSACTION_BATCH_DELETE_MAX_IDS = 200

const LIST_PAGE_LIMIT = 500

/**
 * Every row belongs to installment_group_id (API filter honoured) vs first page unrelated data (param ignored).
 * @param {object[]} rows
 * @param {string} installmentGroupId
 */
function installmentGroupPagesLookFiltered(rows, installmentGroupId) {
  if (!Array.isArray(rows) || rows.length === 0) return true
  return rows.every((r) => r?.installment_group_id === installmentGroupId)
}

function dedupeTransactionRowsById(rows) {
  const byId = new Map()
  for (const r of rows) {
    if (r?.id) byId.set(r.id, r)
  }
  return [...byId.values()]
}

/**
 * Uma página de GET /transactions; suporta header X-Next-Cursor quando a API pagina.
 */
async function fetchTransactionsPage(searchParams) {
  const qs = searchParams.toString()
  const { ok, status, body, headers } = await apiClient.getAllowError(
    `/api/v1/transactions?${qs}`
  )
  if (!ok) {
    const msg =
      (typeof body?.detail === 'string' && body.detail) ||
      (Array.isArray(body?.detail) && JSON.stringify(body.detail)) ||
      `HTTP ${status}`
    throw new Error(`API GET /transactions?… → ${msg}`)
  }
  const rows = Array.isArray(body) ? body : []
  const nextCursor = headers.get('X-Next-Cursor')
  return { rows, nextCursor }
}

/**
 * Todas as transações da API com mesmo installment_group_id (todas no servidor, não só o mês visível).
 * Tenta primeiro `installment_group_id` na query; se a resposta parecer lista mista ou a query falhar, faz scan paginado.
 *
 * `exclude_card_expenses=false`: parcelas podem estar em compras de fatura (`credit_card_id`).
 *
 * @param {string} installmentGroupId
 * @returns {Promise<object[]>} — linhas crus da API ({ id, date, installment_group_id, … })
 */
export async function listTransactionRowsForInstallmentGroup(installmentGroupId) {
  if (!installmentGroupId) throw new Error('installmentGroupId ausente')

  const gid = String(installmentGroupId)

  const filteredParams = (cursor) => {
    const p = new URLSearchParams()
    p.set('exclude_card_expenses', 'false')
    p.set('limit', String(LIST_PAGE_LIMIT))
    p.set('installment_group_id', gid)
    if (cursor) p.set('cursor', cursor)
    return p
  }

  const tryFirst = await apiClient.getAllowError(
    `/api/v1/transactions?${filteredParams(null).toString()}`
  )

  let useFilteredPath =
    tryFirst.ok &&
    Array.isArray(tryFirst.body) &&
    installmentGroupPagesLookFiltered(tryFirst.body, gid)

  if (!tryFirst.ok && (tryFirst.status === 400 || tryFirst.status === 422)) {
    useFilteredPath = false
  } else if (!tryFirst.ok) {
    const msg =
      (typeof tryFirst.body?.detail === 'string' && tryFirst.body.detail) ||
      (Array.isArray(tryFirst.body?.detail) && JSON.stringify(tryFirst.body.detail)) ||
      `HTTP ${tryFirst.status}`
    throw new Error(`API GET /transactions → ${msg}`)
  }

  if (useFilteredPath) {
    const collected = []
    let cursor = null
    let first = true
    while (true) {
      const pageResult = first
        ? {
            rows: Array.isArray(tryFirst.body) ? tryFirst.body : [],
            nextCursor: tryFirst.headers.get('X-Next-Cursor'),
          }
        : await fetchTransactionsPage(filteredParams(cursor))
      first = false
      if (!installmentGroupPagesLookFiltered(pageResult.rows, gid)) {
        break
      }
      collected.push(...pageResult.rows)
      if (!pageResult.nextCursor || pageResult.rows.length === 0) {
        return dedupeTransactionRowsById(collected)
      }
      cursor = pageResult.nextCursor
    }
  }

  const scanParams = (cursor) => {
    const p = new URLSearchParams()
    p.set('exclude_card_expenses', 'false')
    p.set('limit', String(LIST_PAGE_LIMIT))
    if (cursor) p.set('cursor', cursor)
    return p
  }

  const collected = []
  let cursor = null
  while (true) {
    const { rows, nextCursor } = await fetchTransactionsPage(scanParams(cursor))
    for (const r of rows) {
      if (r?.installment_group_id === gid) collected.push(r)
    }
    if (!nextCursor || rows.length === 0) break
    cursor = nextCursor
  }
  return dedupeTransactionRowsById(collected)
}


/** Alinhado ao POST /api/v1/transactions/batch-update — mesmo patch em até 200 ids. */
export const TRANSACTION_BATCH_UPDATE_MAX_IDS = 200

/**
 * POST /api/v1/transactions/batch-update — aplica `patch` (schema TransactionUpdate) a cada id.
 *
 * @param {{ transaction_ids: string[], patch: object, atomic?: boolean }} payload
 */
export async function batchUpdateTransactions(payload) {
  const { status, body } = await apiClient.postWithStatus('/api/v1/transactions/batch-update', {
    transaction_ids: payload.transaction_ids,
    patch: payload.patch,
    atomic: payload.atomic !== false,
  })
  if (!body) {
    throw new Error(`Resposta inesperada ao atualizar lançamentos em lote (HTTP ${status})`)
  }
  if (status < 200 || status >= 300) {
    const msg =
      (typeof body?.detail === 'string' && body.detail) ||
      (Array.isArray(body?.detail) && JSON.stringify(body.detail)) ||
      `HTTP ${status}`
    throw new Error(msg)
  }
  const failed = Number(body.failed_count ?? 0)
  if (failed > 0) {
    const first = body.results?.find((r) => r?.error != null)
    const apiMsg =
      typeof first?.error?.message === 'string'
        ? first.error.message
        : 'Um ou mais lançamentos do lote falharam ao atualizar'
    throw new Error(apiMsg)
  }
  return body
}

/**
 * POST /api/v1/transactions/batch-delete — modos exclusivos no corpo:
 * - { transaction_ids: string[] } (1–200 ids, sem duplicatas)
 * - { credit_card_invoice_id: string }
 *
 * @param {{ transaction_ids?: string[], credit_card_invoice_id?: string }} payload
 * @returns {Promise<{ results: Array<{ id: string, deleted: boolean, error?: { type?: string, message?: string } }>, deleted_count: number, failed_count: number }>}
 */
export async function batchDeleteTransactions(payload) {
  // post() só devolve o body; aqui precisamos do HTTP status (como batch create / Documents).
  const { status, body } = await apiClient.postWithStatus('/api/v1/transactions/batch-delete', payload)
  if (status !== 200 || !body) {
    throw new Error('Resposta inesperada da API ao excluir em lote')
  }
  return body
}

/** Modo fatura: remove as compras da fatura (não remove linhas de pagamento). `results` vem vazio. */
export async function batchDeleteCardInvoicePurchases(creditCardInvoiceId) {
  return batchDeleteTransactions({ credit_card_invoice_id: creditCardInvoiceId })
}
