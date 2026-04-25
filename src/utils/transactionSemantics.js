/**
 * Semântica de transações unificadas (API GET /api/v1/transactions).
 * Classificação por FKs; não usar categoria, texto ou valor para inferir "cartão" vs "conta".
 *
 * Campos (API snake_case; no front, mapTransaction usa camelCase):
 * - credit_card_id: compra/despesa na fatura do cartão.
 * - credit_card_invoice_id: fatura da compra (acompanha credit_card_id).
 * - paid_credit_card_id + paid_credit_card_invoice_id: saída da conta para quitar
 *   fatura (credit_card_id costuma ser null).
 * - account_id, is_transfer: movimentação em conta / transferência.
 *
 * exclude_card_expenses=true (default do backend) remove só linhas com credit_card_id
 * preenchido; pagamentos de fatura (paid_*) permanecem.
 */

/** @param {{ creditCardId?: string|null }} t */
export function isCreditCardInvoicePurchase(t) {
  return t != null && Boolean(t.creditCardId)
}

/** @param {{ paidCreditCardId?: string|null }} t */
export function isCreditCardBillPayment(t) {
  return t != null && Boolean(t.paidCreditCardId)
}

/**
 * Movimentos "da conta" no sentido de não serem compra na fatura: exclui só
 * isCreditCardInvoicePurchase. Inclui pagamento de fatura, transferências e
 * despesas/receitas comuns com accountId.
 * @param {{ creditCardId?: string|null }} t
 */
export function isAccountSideTransaction(t) {
  return t != null && !isCreditCardInvoicePurchase(t)
}

/**
 * Filtro client-side alinhado à aba "origem" em Lançamentos.
 * @param {'all'|'account'|'card'|'bill_payment'} source
 * @param {object} t — mapTransaction
 */
export function matchesTransactionSourceFilter(t, source) {
  if (!source || source === 'all') return true
  if (source === 'account') return isAccountSideTransaction(t)
  if (source === 'card') return isCreditCardInvoicePurchase(t)
  if (source === 'bill_payment') return isCreditCardBillPayment(t)
  return true
}

/**
 * Template de recorrência (GET /api/v1/recurrences); linhas em meses diferentes
 * compartilham o mesmo recurrence_id.
 * @param {{ recurrenceId?: string|null }} t — mapTransaction
 */
export function isRecurrenceLinkedTransaction(t) {
  return t != null && Boolean(t.recurrenceId)
}

/**
 * Parcelamento: total_installments > 1 (API); não confundir com recurrence_id.
 * @param {{ totalInstallments?: number }} t
 */
export function isInstallmentPlanTransaction(t) {
  if (t == null) return false
  const n = Number(t.totalInstallments)
  return Number.isFinite(n) && n > 1
}

/**
 * @param {{ installment?: number, totalInstallments?: number }} t
 * @returns {string} e.g. "3/12" or "" if not an installment plan
 */
export function formatInstallmentFraction(t) {
  if (!t || !isInstallmentPlanTransaction(t)) return ''
  const total = Number(t.totalInstallments)
  const cur = Math.min(Math.max(1, Number(t.installment) || 1), total)
  return `${cur}/${total}`
}
