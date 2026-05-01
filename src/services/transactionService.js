import { apiClient } from './apiClient'

/** Alinhado ao POST /api/v1/transactions/batch-delete (modo lista de ids). */
export const TRANSACTION_BATCH_DELETE_MAX_IDS = 200

/**
 * POST /api/v1/transactions/batch-delete — modos exclusivos no corpo:
 * - { transaction_ids: string[] } (1–200 ids, sem duplicatas)
 * - { credit_card_invoice_id: string }
 *
 * @param {{ transaction_ids?: string[], credit_card_invoice_id?: string }} payload
 * @returns {Promise<{ results: Array<{ id: string, deleted: boolean, error?: { type?: string, message?: string } }>, deleted_count: number, failed_count: number }>}
 */
export async function batchDeleteTransactions(payload) {
  const { status, body } = await apiClient.post('/api/v1/transactions/batch-delete', payload)
  if (status !== 200 || !body) {
    throw new Error('Resposta inesperada da API ao excluir em lote')
  }
  return body
}

/** Modo fatura: remove as compras da fatura (não remove linhas de pagamento). `results` vem vazio. */
export async function batchDeleteCardInvoicePurchases(creditCardInvoiceId) {
  return batchDeleteTransactions({ credit_card_invoice_id: creditCardInvoiceId })
}
