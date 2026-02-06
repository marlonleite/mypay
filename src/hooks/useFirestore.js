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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

// Hook para transações (receitas e despesas)
// dateRange: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' } | null
export function useTransactions(month, year, dateRange) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Serializar dateRange para usar como dependência estável do useEffect
  const dateRangeKey = dateRange ? `${dateRange.startDate}_${dateRange.endDate}` : null

  useEffect(() => {
    if (!user) {
      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let startDate, endDate

    if (dateRange && dateRange.startDate && dateRange.endDate) {
      // Período customizado: usar datas do dateRange
      const [sy, sm, sd] = dateRange.startDate.split('-').map(Number)
      const [ey, em, ed] = dateRange.endDate.split('-').map(Number)
      startDate = new Date(sy, sm - 1, sd, 0, 0, 0)
      endDate = new Date(ey, em - 1, ed, 23, 59, 59)
    } else {
      // Padrão: mês/ano selecionado
      startDate = new Date(year, month, 1)
      endDate = new Date(year, month + 1, 0, 23, 59, 59)
    }

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
  }, [user, month, year, dateRangeKey]) // eslint-disable-line react-hooks/exhaustive-deps

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

// Hook para buscar todas as tags únicas (combina tags salvas + tags das transações)
export function useTags() {
  const { user } = useAuth()
  const [savedTags, setSavedTags] = useState([])
  const [transactionTags, setTransactionTags] = useState([])
  const [loading, setLoading] = useState(true)

  // Buscar tags salvas na coleção tags
  useEffect(() => {
    if (!user) {
      setSavedTags([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, `users/${user.uid}/tags`),
      orderBy('name', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tags = snapshot.docs.map(doc => doc.data().name)
        setSavedTags(tags)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Buscar tags das transações existentes
  useEffect(() => {
    if (!user) {
      setTransactionTags([])
      return
    }

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
        setTransactionTags(Array.from(allTags))
      }
    )

    return () => unsubscribe()
  }, [user])

  // Combinar e ordenar tags únicas
  const tags = [...new Set([...savedTags, ...transactionTags])].sort()

  // Adicionar nova tag
  const addTag = async (name) => {
    if (!user || !name.trim()) return

    // Verificar se já existe
    const existingQuery = query(
      collection(db, `users/${user.uid}/tags`),
      where('name', '==', name.trim())
    )
    const existingDocs = await getDocs(existingQuery)
    if (!existingDocs.empty) {
      throw new Error('Tag já existe')
    }

    await addDoc(collection(db, `users/${user.uid}/tags`), {
      name: name.trim(),
      createdAt: new Date()
    })
  }

  // Atualizar tag (renomear)
  const updateTag = async (oldName, newName) => {
    if (!user || !oldName || !newName.trim()) return

    // Encontrar o documento da tag
    const q = query(
      collection(db, `users/${user.uid}/tags`),
      where('name', '==', oldName)
    )
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref
      await updateDoc(docRef, { name: newName.trim() })
    }

    // Atualizar também nas transações que usam essa tag
    const transactionsQuery = query(
      collection(db, `users/${user.uid}/transactions`)
    )
    const transactionsSnapshot = await getDocs(transactionsQuery)

    const batch = writeBatch(db)
    transactionsSnapshot.docs.forEach(doc => {
      const data = doc.data()
      if (data.tags && data.tags.includes(oldName)) {
        const newTags = data.tags.map(t => t === oldName ? newName.trim() : t)
        batch.update(doc.ref, { tags: newTags })
      }
    })
    await batch.commit()
  }

  // Deletar tag
  const deleteTag = async (name) => {
    if (!user || !name) return

    // Encontrar e deletar o documento da tag
    const q = query(
      collection(db, `users/${user.uid}/tags`),
      where('name', '==', name)
    )
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      await deleteDoc(snapshot.docs[0].ref)
    }
  }

  return { tags, loading, addTag, updateTag, deleteTag }
}

// Hook para transferências entre contas
export function useTransfers(month, year) {
  const { user } = useAuth()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTransfers([])
      setLoading(false)
      return
    }

    setLoading(true)

    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    const q = query(
      collection(db, `users/${user.uid}/transfers`),
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
        setTransfers(data)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, month, year])

  // Criar transferência (cria 2 transações vinculadas + registro de transferência)
  const addTransfer = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const parseLocalDate = (dateStr) => {
      if (dateStr instanceof Date) return dateStr
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day, 12, 0, 0)
    }

    const transferDate = parseLocalDate(data.date)

    // 1. Criar transação de saída (despesa na conta origem)
    const outTransaction = await addDoc(collection(db, `users/${user.uid}/transactions`), {
      description: `Transferência para ${data.toAccountName}`,
      amount: data.amount,
      type: 'expense',
      category: 'transfer_out',
      accountId: data.fromAccountId,
      date: transferDate,
      isTransfer: true,
      createdAt: serverTimestamp()
    })

    // 2. Criar transação de entrada (receita na conta destino)
    const inTransaction = await addDoc(collection(db, `users/${user.uid}/transactions`), {
      description: `Transferência de ${data.fromAccountName}`,
      amount: data.amount,
      type: 'income',
      category: 'transfer_in',
      accountId: data.toAccountId,
      date: transferDate,
      isTransfer: true,
      createdAt: serverTimestamp()
    })

    // 3. Vincular as transações
    await updateDoc(doc(db, `users/${user.uid}/transactions`, outTransaction.id), {
      oppositeTransactionId: inTransaction.id
    })
    await updateDoc(doc(db, `users/${user.uid}/transactions`, inTransaction.id), {
      oppositeTransactionId: outTransaction.id
    })

    // 4. Criar registro de transferência
    const transfer = await addDoc(collection(db, `users/${user.uid}/transfers`), {
      fromAccountId: data.fromAccountId,
      fromAccountName: data.fromAccountName,
      toAccountId: data.toAccountId,
      toAccountName: data.toAccountName,
      amount: data.amount,
      date: transferDate,
      description: data.description || null,
      outTransactionId: outTransaction.id,
      inTransactionId: inTransaction.id,
      createdAt: serverTimestamp()
    })

    return transfer
  }

  // Excluir transferência (exclui as 2 transações vinculadas)
  const deleteTransfer = async (transfer) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Excluir transações vinculadas
    if (transfer.outTransactionId) {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, transfer.outTransactionId))
    }
    if (transfer.inTransactionId) {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, transfer.inTransactionId))
    }

    // Excluir registro de transferência
    await deleteDoc(doc(db, `users/${user.uid}/transfers`, transfer.id))
  }

  return {
    transfers,
    loading,
    addTransfer,
    deleteTransfer
  }
}

// Hook para orçamentos/metas por categoria
export function useBudgets(month, year) {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Buscar orçamentos do mês/ano específico
    const q = query(
      collection(db, `users/${user.uid}/budgets`),
      where('month', '==', month),
      where('year', '==', year)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setBudgets(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching budgets:', err)
        setError('Erro ao carregar orçamentos')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, month, year])

  // Adicionar orçamento
  const addBudget = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Verificar se já existe orçamento para essa categoria no mês
    const existing = budgets.find(b => b.categoryId === data.categoryId)
    if (existing) {
      throw new Error('Já existe um orçamento para esta categoria neste mês')
    }

    return await addDoc(collection(db, `users/${user.uid}/budgets`), {
      categoryId: data.categoryId,
      amount: data.amount,
      month: month,
      year: year,
      createdAt: serverTimestamp()
    })
  }

  // Atualizar orçamento
  const updateBudget = async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/budgets`, id)
    return await updateDoc(docRef, {
      amount: data.amount,
      updatedAt: serverTimestamp()
    })
  }

  // Excluir orçamento
  const deleteBudget = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const docRef = doc(db, `users/${user.uid}/budgets`, id)
    return await deleteDoc(docRef)
  }

  // Copiar orçamentos do mês anterior
  const copyFromPreviousMonth = async () => {
    if (!user) throw new Error('Usuário não autenticado')

    // Calcular mês anterior
    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth < 0) {
      prevMonth = 11
      prevYear = year - 1
    }

    // Buscar orçamentos do mês anterior
    const q = query(
      collection(db, `users/${user.uid}/budgets`),
      where('month', '==', prevMonth),
      where('year', '==', prevYear)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      throw new Error('Nenhum orçamento encontrado no mês anterior')
    }

    // Criar cópias para o mês atual
    const promises = snapshot.docs.map(docSnap => {
      const data = docSnap.data()
      // Verificar se já existe
      const exists = budgets.find(b => b.categoryId === data.categoryId)
      if (exists) return Promise.resolve()

      return addDoc(collection(db, `users/${user.uid}/budgets`), {
        categoryId: data.categoryId,
        amount: data.amount,
        month: month,
        year: year,
        createdAt: serverTimestamp()
      })
    })

    await Promise.all(promises)
    return snapshot.docs.length
  }

  // Obter orçamento de uma categoria específica
  const getBudget = (categoryId) => {
    return budgets.find(b => b.categoryId === categoryId)
  }

  return {
    budgets,
    loading,
    error,
    addBudget,
    updateBudget,
    deleteBudget,
    copyFromPreviousMonth,
    getBudget
  }
}

// Hook para pagamentos de fatura de cartão
export function useBillPayments(month, year) {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setPayments([])
      setAllPayments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Buscar pagamentos do mês/ano específico
    const q = query(
      collection(db, `users/${user.uid}/billPayments`),
      where('month', '==', month),
      where('year', '==', year)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          paidAt: doc.data().paidAt?.toDate()
        }))
        setPayments(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching bill payments:', err)
        setError('Erro ao carregar pagamentos')
        setLoading(false)
      }
    )

    // Buscar todos os pagamentos para calcular saldo anterior
    const allQ = query(
      collection(db, `users/${user.uid}/billPayments`),
      orderBy('paidAt', 'desc')
    )

    const unsubscribeAll = onSnapshot(
      allQ,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          paidAt: doc.data().paidAt?.toDate()
        }))
        setAllPayments(data)
      }
    )

    return () => {
      unsubscribe()
      unsubscribeAll()
    }
  }, [user, month, year])

  // Verificar se uma fatura específica foi paga (total ou parcialmente)
  const isBillPaid = (cardId) => {
    return payments.some(p => p.cardId === cardId)
  }

  // Verificar se foi pago integralmente
  const isBillFullyPaid = (cardId, totalAmount) => {
    const cardPayments = payments.filter(p => p.cardId === cardId)
    const totalPaid = cardPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    return totalPaid >= totalAmount
  }

  // Obter total pago de uma fatura
  const getTotalPaid = (cardId) => {
    const cardPayments = payments.filter(p => p.cardId === cardId)
    return cardPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  }

  // Obter detalhes do pagamento de uma fatura
  const getBillPayment = (cardId) => {
    return payments.find(p => p.cardId === cardId)
  }

  // Obter todos os pagamentos de uma fatura
  const getBillPayments = (cardId) => {
    return payments.filter(p => p.cardId === cardId)
  }

  // Calcular saldo anterior (faturas não pagas de meses anteriores)
  const getPreviousBalance = (cardId) => {
    let balance = 0

    // Calcular mês anterior
    let checkMonth = month - 1
    let checkYear = year
    if (checkMonth < 0) {
      checkMonth = 11
      checkYear = year - 1
    }

    // Buscar pagamentos do mês anterior
    const prevPayments = allPayments.filter(p =>
      p.cardId === cardId &&
      p.month === checkMonth &&
      p.year === checkYear
    )

    // Se houver pagamento parcial, calcular saldo não pago
    // (isso precisaria de acesso aos gastos do mês anterior - simplificado por ora)
    if (prevPayments.length > 0) {
      const hasCarryOver = prevPayments.some(p => p.carryOverBalance && p.carryOverBalance > 0)
      if (hasCarryOver) {
        balance = prevPayments[0].carryOverBalance
      }
    }

    return balance
  }

  // Registrar pagamento de fatura (suporta pagamentos parciais)
  const addBillPayment = async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Calcular saldo não pago (carry over)
    const carryOverBalance = data.totalBill ? Math.max(0, data.totalBill - data.amount) : 0

    return await addDoc(collection(db, `users/${user.uid}/billPayments`), {
      cardId: data.cardId,
      month: data.month,
      year: data.year,
      amount: data.amount,
      totalBill: data.totalBill || data.amount,
      carryOverBalance: carryOverBalance,
      accountId: data.accountId,
      transactionId: data.transactionId,
      isPartial: data.amount < (data.totalBill || data.amount),
      paidAt: data.paidAt || new Date(),
      createdAt: serverTimestamp()
    })
  }

  // Excluir pagamento (caso precise estornar)
  const deleteBillPayment = async (id) => {
    if (!user) throw new Error('Usuário não autenticado')
    const docRef = doc(db, `users/${user.uid}/billPayments`, id)
    return await deleteDoc(docRef)
  }

  return {
    payments,
    loading,
    error,
    isBillPaid,
    isBillFullyPaid,
    getTotalPaid,
    getBillPayment,
    getBillPayments,
    getPreviousBalance,
    addBillPayment,
    deleteBillPayment
  }
}
