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
   * Adiciona uma despesa de cartão
   */
  const addCardExpense = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
      ...data,
      date: new Date(data.date),
      installment: 1,
      totalInstallments: 1,
      createdAt: serverTimestamp()
    })
  }

  return {
    imports,
    loading,
    addImport,
    addCardExpense
  }
}

export default useImportHistory
