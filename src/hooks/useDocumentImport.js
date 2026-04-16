import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { listImports } from '../services/documentService'
import { parseLocalDate } from '../utils/helpers'
import { apiClient } from '../services/apiClient'

/**
 * Hook pra histórico de importações + criação de despesa de cartão a partir
 * do review da IA.
 *
 * Pós Fase E migration:
 * - `imports` lê de `/api/v1/documents/imports` (REST). Backend cria
 *   automaticamente os import_records ao processar documentos via
 *   `/documents/process`.
 * - `addImport` REMOVIDO — backend cria automaticamente; chamadas duplas
 *   gerariam histórico em paralelo (Firestore + Postgres).
 * - `addCardExpense` continua POST `/api/v1/transactions` com `credit_card_id`
 *   (Onda 6 do refactor backend; backend auto-resolve invoice).
 */
export function useImportHistory() {
  const { user } = useAuth()
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchImports = useCallback(async () => {
    if (!user) {
      setImports([])
      setLoading(false)
      return
    }

    try {
      const data = await listImports()
      // Ordena desc por createdAt
      data.sort((a, b) => {
        const aT = a.createdAt ? a.createdAt.getTime() : 0
        const bT = b.createdAt ? b.createdAt.getTime() : 0
        return bT - aT
      })
      setImports(data)
    } catch (err) {
      console.error('Erro ao carregar histórico de importações:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    fetchImports()
  }, [fetchImports])

  /**
   * Cria despesa de cartão a partir da review da IA.
   *
   * Pós Onda 6 do refactor backend: card_expenses table foi DROPPED.
   * Compras de cartão são `transactions` com `credit_card_id` populado.
   * Backend auto-resolve `credit_card_invoice_id` via
   * `invoice_resolution.ensure_invoice_for_period`.
   */
  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    if (!data.cardId) throw new Error('cardId é obrigatório')

    const parsedDate = data.date instanceof Date ? data.date : parseLocalDate(data.date)
    const dateIso = parsedDate.toISOString().slice(0, 10)

    // Resolve tags (nomes → ids) se vierem como strings
    let tag_ids
    if (Array.isArray(data.tags) && data.tags.length > 0) {
      const looksLikeId = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
      if (data.tags.every(looksLikeId)) {
        tag_ids = data.tags
      } else {
        const allTags = await apiClient.get('/api/v1/tags')
        tag_ids = data.tags
          .map(name => allTags.find(t => t.name === name)?.id)
          .filter(Boolean)
      }
    }

    const payload = {
      description: data.description,
      amount: data.amount,
      type: data.type || 'expense',
      date: dateIso,
      credit_card_id: data.cardId,
      category_id: data.category || data.categoryId || null,
      notes: data.notes ?? null,
      installment: data.installment || 1,
      total_installments: data.totalInstallments || 1,
      installment_group_id: data.installmentGroupId ?? null,
    }
    if (tag_ids && tag_ids.length > 0) payload.tag_ids = tag_ids

    return await apiClient.post('/api/v1/transactions', payload)
  }

  // Re-fetch imports (útil após processar novo documento).
  const refresh = fetchImports

  return {
    imports,
    loading,
    addCardExpense,
    refresh,
  }
}

export default useImportHistory
