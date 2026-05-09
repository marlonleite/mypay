import { apiClient } from './apiClient'

/**
 * Wrapper sobre os endpoints de fatura (Wave9): pagar / reabrir / breakdown.
 *
 * Pagar fatura cria **um** lançamento contábil (`paid_credit_card_invoice_id`) e
 * atualiza a fatura (``payment_amount`` / ``status``). Reabrir apaga esse
 * lançamento e volta a fatura para ``status='open'`` — anexos permanecem em
 * ``credit_card_invoice_attachments`` (não na transação). Segundo `/pay` na
 * mesma invoice deve ser bloqueado no app e rejeitado na API.
 */

function toIsoDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  return String(value)
}

/**
 * @typedef {object} PayInvoiceInput
 * @property {string} accountId Conta de onde sai o dinheiro.
 * @property {number|string} amount Valor pago (Decimal-string-friendly).
 * @property {Date|string} date Data do pagamento (ISO-yyyy-mm-dd).
 * @property {string} [categoryId] Categoria opcional (default: cria/usa "Pagamento de Cartão").
 * @property {string} [description]
 * @property {string} [notes]
 */

/**
 * POST /api/v1/credit-card-invoices/{id}/pay
 * @param {string} invoiceId
 * @param {PayInvoiceInput} input
 * @returns {Promise<{invoice: object, paymentTransactionId: string}>}
 */
export async function payInvoice(invoiceId, input) {
  if (!invoiceId) throw new Error('invoiceId é obrigatório')
  if (!input?.accountId) throw new Error('accountId é obrigatório')
  if (input?.amount === undefined || input.amount === null || input.amount === '')
    throw new Error('amount é obrigatório')

  const payload = {
    account_id: input.accountId,
    amount: typeof input.amount === 'number' ? input.amount.toFixed(2) : String(input.amount),
    date: toIsoDate(input.date) ?? toIsoDate(new Date()),
  }
  if (input.categoryId) payload.category_id = input.categoryId
  if (input.description) payload.description = input.description
  if (input.notes) payload.notes = input.notes

  const data = await apiClient.post(`/api/v1/credit-card-invoices/${invoiceId}/pay`, payload)
  return {
    invoice: data?.invoice ?? null,
    paymentTransactionId: data?.payment_transaction_id ?? null,
  }
}

/**
 * POST /api/v1/credit-card-invoices/{id}/reopen — devolve a fatura ao estado 'open'.
 * Apaga a transação de pagamento; anexos da fatura permanecem.
 */
export async function reopenInvoice(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId é obrigatório')
  return apiClient.post(`/api/v1/credit-card-invoices/${invoiceId}/reopen`, undefined)
}

/**
 * GET /api/v1/credit-card-invoices/{id}/breakdown — agrega gastos por categoria.
 * @returns {Promise<Array<{categoryId: string|null, categoryName: string|null, expenseTotal: number, refundTotal: number, netTotal: number, transactionCount: number}>>}
 */
export async function getInvoiceBreakdown(invoiceId) {
  if (!invoiceId) return []
  const data = await apiClient.get(`/api/v1/credit-card-invoices/${invoiceId}/breakdown`)
  if (!Array.isArray(data)) return []
  const toNumber = (v) => (v !== null && v !== undefined ? parseFloat(v) : 0)
  return data.map((row) => ({
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    expenseTotal: toNumber(row.expense_total),
    refundTotal: toNumber(row.refund_total),
    netTotal: toNumber(row.net_total),
    transactionCount: row.transaction_count ?? 0,
  }))
}

/** Mensagem única para UI + validações client-side antes de POST. */
export const PAID_INVOICE_EXPENSE_BLOCK_MESSAGE =
  'Esta fatura está paga. Reabra em Cartões para importar ou incluir lançamentos.'

/**
 * Impede criar/importar lançamentos em fatura já paga (status=paid).
 * @param {string} cardId
 * @param {number} monthJs Índice JS 0–11 (mês de vencimento).
 * @param {number} year
 */
export async function assertInvoiceNotPaidForCardPeriod(cardId, monthJs, year) {
  if (!cardId || typeof monthJs !== 'number' || typeof year !== 'number') return
  const data = await apiClient.get(`/api/v1/credit-card-invoices?card_id=${cardId}`)
  if (!Array.isArray(data)) return
  for (const i of data) {
    if (!i.due_date || typeof i.due_date !== 'string') continue
    const d = new Date(i.due_date + 'T12:00:00')
    if (d.getMonth() === monthJs && d.getFullYear() === year && i.status === 'paid') {
      throw new Error(PAID_INVOICE_EXPENSE_BLOCK_MESSAGE)
    }
  }
}

/**
 * @param {string} cardId
 * @param {string} invoiceId
 */
export async function assertInvoiceNotPaidById(cardId, invoiceId) {
  if (!cardId || !invoiceId) return
  const data = await apiClient.get(`/api/v1/credit-card-invoices?card_id=${cardId}`)
  if (!Array.isArray(data)) return
  const i = data.find((row) => row.id === invoiceId)
  if (i?.status === 'paid') {
    throw new Error(PAID_INVOICE_EXPENSE_BLOCK_MESSAGE)
  }
}
