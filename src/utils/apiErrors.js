/**
 * Traduz mensagens conhecidas do backend (Conflict 409) para textos amigáveis
 * em pt-BR. Centralizado para reuso em catch handlers.
 *
 * Casos da Wave9 (faturas):
 * - "Invoice is paid; reopen it before deleting this transaction"
 * - "Invoice is paid; reopen it before changing structural fields"
 * - "Cannot delete invoice payment directly; use POST /credit-card-invoices/{id}/reopen"
 * - "Invoice already paid"
 * - "Invoice is not paid"
 *
 * Imports de documento:
 * - "Import already applied"
 */

const FRIENDLY_MAP = [
  {
    test: /Invoice is paid; reopen it before deleting this transaction/i,
    message:
      'Esta transação está em uma fatura paga. Reabra a fatura para excluir.',
  },
  {
    test: /Invoice is paid; reopen it before changing structural fields/i,
    message:
      'Esta transação está em uma fatura paga. Reabra a fatura para alterar valor, tipo, conta ou cartão.',
  },
  {
    test: /Cannot delete invoice payment directly/i,
    message:
      'Não dá para excluir um pagamento direto. Use "Reabrir fatura" para desfazê-lo.',
  },
  {
    test: /Invoice already paid/i,
    message: 'Esta fatura já está paga.',
  },
  {
    test: /Invoice is not paid/i,
    message: 'Esta fatura ainda não foi paga.',
  },
  {
    test: /Invoice has nothing to pay/i,
    message: 'Esta fatura não tem nada a quitar (sem compras no ciclo nem saldo anterior).',
  },
  {
    test: /reopen it before deleting transactions/i,
    message:
      'Há transações em uma fatura paga. Reabra a fatura para excluir lançamentos.',
  },
  {
    test: /Import already applied/i,
    message:
      'Esta importação já foi aplicada. Para reimportá-la, exclua antes os lançamentos relacionados.',
  },
]

/**
 * Tenta extrair uma mensagem amigável de um Error vindo do apiClient.
 * Retorna `null` se não for um caso conhecido — caller pode mostrar `error.message`.
 */
export function friendlyApiError(error) {
  if (!error) return null
  const message = String(error?.message ?? error)
  if (!message) return null
  for (const rule of FRIENDLY_MAP) {
    if (rule.test.test(message)) return rule.message
  }
  return null
}

/**
 * Retorna `friendlyApiError(error)` se houver match; senão retorna o
 * `fallback` (ou `error.message`).
 */
export function describeApiError(error, fallback) {
  return friendlyApiError(error) || error?.message || fallback || 'Erro inesperado.'
}
