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
  getDocs,
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

    // Converter string de data para Date no timezone local (evita problema de UTC)
    const parseLocalDate = (dateStr) => {
      if (dateStr instanceof Date) return dateStr
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day, 12, 0, 0) // meio-dia para evitar problemas de timezone
    }

    return await addDoc(collection(db, `users/${user.uid}/transactions`), {
      ...data,
      date: parseLocalDate(data.date),
      createdAt: serverTimestamp()
    })
  }

  const updateTransaction = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Converter string de data para Date no timezone local
    const parseLocalDate = (dateStr) => {
      if (dateStr instanceof Date) return dateStr
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day, 12, 0, 0)
    }

    const docRef = doc(db, `users/${user.uid}/transactions`, id)
    return await updateDoc(docRef, {
      ...data,
      date: parseLocalDate(data.date),
      updatedAt: serverTimestamp()
    })
  }

  const deleteTransaction = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/transactions`, id)
    return await deleteDoc(docRef)
  }

  // Atualizar todos os lançamentos de um grupo de recorrência
  const updateRecurrenceGroup = async (recurrenceGroup, updates) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Busca todos os lançamentos do grupo
    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      where('recurrenceGroup', '==', recurrenceGroup)
    )

    const snapshot = await getDocs(q)

    // Atualiza cada um
    const updatePromises = snapshot.docs.map(docSnap => {
      const docRef = doc(db, `users/${user.uid}/transactions`, docSnap.id)
      return updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
    })

    await Promise.all(updatePromises)
    return snapshot.docs.length
  }

  // Excluir todos os lançamentos de um grupo de recorrência
  const deleteRecurrenceGroup = async (recurrenceGroup) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Busca todos os lançamentos do grupo
    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      where('recurrenceGroup', '==', recurrenceGroup)
    )

    const snapshot = await getDocs(q)

    // Exclui cada um
    const deletePromises = snapshot.docs.map(docSnap => {
      const docRef = doc(db, `users/${user.uid}/transactions`, docSnap.id)
      return deleteDoc(docRef)
    })

    await Promise.all(deletePromises)
    return snapshot.docs.length
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateRecurrenceGroup,
    deleteRecurrenceGroup
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

// Categorias padrão para inicialização
const DEFAULT_CATEGORIES = [
  // Despesas
  { name: 'Alimentação', type: 'expense', icon: 'Utensils', color: 'orange' },
  { name: 'Transporte', type: 'expense', icon: 'Car', color: 'blue' },
  { name: 'Moradia', type: 'expense', icon: 'Home', color: 'emerald' },
  { name: 'Saúde', type: 'expense', icon: 'Heart', color: 'red' },
  { name: 'Lazer', type: 'expense', icon: 'Gamepad2', color: 'violet' },
  { name: 'Educação', type: 'expense', icon: 'GraduationCap', color: 'indigo' },
  { name: 'Outros', type: 'expense', icon: 'MoreHorizontal', color: 'slate' },
  // Receitas
  { name: 'Salário', type: 'income', icon: 'Briefcase', color: 'emerald' },
  { name: 'Freelance', type: 'income', icon: 'Laptop', color: 'blue' },
  { name: 'Investimentos', type: 'income', icon: 'TrendingUp', color: 'green' },
  { name: 'Outros', type: 'income', icon: 'MoreHorizontal', color: 'slate' }
]

// Hook para categorias personalizadas (com suporte a subcategorias)
export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!user) {
      setCategories([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, `users/${user.uid}/categories`),
      orderBy('name', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setCategories(data)
        setInitialized(true)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching categories:', err)
        setError('Erro ao carregar categorias')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Inicializar categorias padrão (apenas se não existirem)
  const initializeDefaultCategories = async () => {
    if (!user) throw new Error('Usuário não autenticado')
    if (categories.length > 0) return // Já tem categorias

    const batch = []
    for (const cat of DEFAULT_CATEGORIES) {
      batch.push(
        addDoc(collection(db, `users/${user.uid}/categories`), {
          ...cat,
          parentId: null,
          archived: false,
          isDefault: true,
          createdAt: serverTimestamp()
        })
      )
    }
    await Promise.all(batch)
  }

  // Adicionar categoria (principal ou subcategoria)
  const addCategory = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/categories`), {
      name: data.name,
      type: data.type, // 'income' ou 'expense'
      icon: data.icon || 'Tag',
      color: data.color || 'violet',
      parentId: data.parentId || null, // null = categoria principal
      archived: false,
      createdAt: serverTimestamp()
    })
  }

  const updateCategory = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/categories`, id)
    return await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  }

  // Mover categoria (mudar parentId)
  const moveCategory = async (id, newParentId) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/categories`, id)
    return await updateDoc(docRef, {
      parentId: newParentId,
      updatedAt: serverTimestamp()
    })
  }

  // Arquivar categoria (soft delete)
  const archiveCategory = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/categories`, id)
    return await updateDoc(docRef, {
      archived: true,
      updatedAt: serverTimestamp()
    })
  }

  // Restaurar categoria arquivada
  const restoreCategory = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/categories`, id)
    return await updateDoc(docRef, {
      archived: false,
      updatedAt: serverTimestamp()
    })
  }

  // Excluir categoria permanentemente
  const deleteCategory = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Também excluir subcategorias
    const subcats = categories.filter(c => c.parentId === id)
    for (const sub of subcats) {
      const subRef = doc(db, `users/${user.uid}/categories`, sub.id)
      await deleteDoc(subRef)
    }

    const docRef = doc(db, `users/${user.uid}/categories`, id)
    return await deleteDoc(docRef)
  }

  // Helpers para organizar categorias
  const getMainCategories = (type) => {
    return categories.filter(c => c.type === type && !c.parentId && !c.archived)
  }

  const getSubcategories = (parentId) => {
    return categories.filter(c => c.parentId === parentId && !c.archived)
  }

  const getArchivedCategories = () => {
    return categories.filter(c => c.archived)
  }

  // Verifica se precisa inicializar
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

// Contas padrão para inicialização
const DEFAULT_ACCOUNTS = [
  { name: 'Carteira', type: 'wallet', icon: 'Wallet', color: 'emerald', balance: 0 },
  { name: 'Conta Corrente', type: 'checking', icon: 'Building2', color: 'blue', balance: 0 }
]

// Hook para contas (carteira, banco, etc)
export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!user) {
      setAccounts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, `users/${user.uid}/accounts`),
      orderBy('name', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setAccounts(data)
        setInitialized(true)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching accounts:', err)
        setError('Erro ao carregar contas')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Inicializar contas padrão
  const initializeDefaultAccounts = async () => {
    if (!user) throw new Error('Usuário não autenticado')
    if (accounts.length > 0) return

    const batch = []
    for (const account of DEFAULT_ACCOUNTS) {
      batch.push(
        addDoc(collection(db, `users/${user.uid}/accounts`), {
          ...account,
          archived: false,
          createdAt: serverTimestamp()
        })
      )
    }
    await Promise.all(batch)
  }

  const addAccount = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/accounts`), {
      name: data.name,
      type: data.type || 'checking',
      icon: data.icon || 'Wallet',
      color: data.color || 'blue',
      balance: data.balance || 0,
      archived: false,
      createdAt: serverTimestamp()
    })
  }

  const updateAccount = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/accounts`, id)
    return await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  }

  const archiveAccount = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/accounts`, id)
    return await updateDoc(docRef, {
      archived: true,
      updatedAt: serverTimestamp()
    })
  }

  const deleteAccount = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/accounts`, id)
    return await deleteDoc(docRef)
  }

  const getActiveAccounts = () => {
    return accounts.filter(a => !a.archived)
  }

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

// Hook para buscar todas as tags únicas
export function useTags() {
  const { user } = useAuth()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTags([])
      setLoading(false)
      return
    }

    setLoading(true)

    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      orderBy('date', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allTags = new Set()
        snapshot.docs.forEach(doc => {
          const data = doc.data()
          if (data.tags && Array.isArray(data.tags)) {
            data.tags.forEach(tag => allTags.add(tag))
          }
        })
        setTags(Array.from(allTags).sort())
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  return { tags, loading }
}
