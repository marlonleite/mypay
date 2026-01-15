import { useState, useEffect } from 'react'
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
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

// Hook para transações (receitas e despesas)
export function useTransactions(month, year) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    const q = query(
      collection(db, `users/${user.uid}/transactions`),
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
        setTransactions(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching transactions:', err)
        setError('Erro ao carregar transações')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, month, year])

  const addTransaction = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/transactions`), {
      ...data,
      date: new Date(data.date),
      createdAt: serverTimestamp()
    })
  }

  const updateTransaction = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/transactions`, id)
    return await updateDoc(docRef, {
      ...data,
      date: new Date(data.date),
      updatedAt: serverTimestamp()
    })
  }

  const deleteTransaction = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/transactions`, id)
    return await deleteDoc(docRef)
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction
  }
}

// Hook para cartões de crédito
export function useCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, `users/${user.uid}/cards`),
      orderBy('name', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setCards(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching cards:', err)
        setError('Erro ao carregar cartões')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  const addCard = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/cards`), {
      ...data,
      createdAt: serverTimestamp()
    })
  }

  const updateCard = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/cards`, id)
    return await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  }

  const deleteCard = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/cards`, id)
    return await deleteDoc(docRef)
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
      const baseDate = new Date(data.date)
      const installmentValue = data.amount / data.installments

      for (let i = 0; i < data.installments; i++) {
        const installmentDate = new Date(baseDate)
        installmentDate.setMonth(installmentDate.getMonth() + i)

        expenses.push(
          addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
            ...data,
            amount: installmentValue,
            date: installmentDate,
            installment: i + 1,
            totalInstallments: data.installments,
            createdAt: serverTimestamp()
          })
        )
      }

      return await Promise.all(expenses)
    }

    return await addDoc(collection(db, `users/${user.uid}/cardExpenses`), {
      ...data,
      date: new Date(data.date),
      installment: 1,
      totalInstallments: 1,
      createdAt: serverTimestamp()
    })
  }

  const updateCardExpense = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/cardExpenses`, id)
    return await updateDoc(docRef, {
      ...data,
      date: new Date(data.date),
      updatedAt: serverTimestamp()
    })
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
