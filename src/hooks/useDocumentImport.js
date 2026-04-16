import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { parseLocalDate } from '../utils/helpers'

/**
 * Hook para gerenciar histórico de importações e operações relacionadas
 */
export function useImportHistory() {
  const { user } = useAuth()
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setImports([])
      setLoading(false)
      return
    }

    setLoading(true)

    const q = query(
      collection(db, `users/${user.uid}/imports`),
      orderBy('createdAt', 'desc'),
      limit(10)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setImports(data)
        setLoading(false)
      },
      (error) => {
        console.error('Erro ao carregar histórico de importações:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  /**
   * Adiciona um registro de importação ao histórico
   */
  const addImport = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/imports`), {
      ...data,
      createdAt: serverTimestamp()
    })
  }

  /**
   * Adiciona uma despesa de cartão.
   *
   * Pós Fase B-Refactor (Onda 6): a tabela `card_expenses` foi DROPPED.
   * Compras de cartão agora são `transactions` com `credit_card_id` populado.
   * Backend auto-resolve `credit_card_invoice_id` via
   * `invoice_resolution.ensure_invoice_for_period` se omitido — só precisamos
   * mandar `credit_card_id`.
   */
  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')
    if (!data.cardId) throw new Error('cardId é obrigatório')

    const parsedDate = data.date instanceof Date ? data.date : parseLocalDate(data.date)
    const dateIso = parsedDate.toISOString().slice(0, 10)

    // Resolve tags (nomes → ids) se vierem como strings
    const { apiClient } = await import('../services/apiClient')
    let tag_ids
    if (Array.isArray(data.tags) && data.tags.length > 0) {
      // Se já vierem como ids (UUIDs), passa direto; se como nomes, resolve.
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

  return {
    imports,
    loading,
    addImport,
    addCardExpense
  }
}

export default useImportHistory
