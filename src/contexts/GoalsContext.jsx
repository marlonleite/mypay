import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

const GoalsContext = createContext()

/**
 * Tipos de meta:
 * - saving: Economizar um valor (ex: reserva de emergência)
 * - reduction: Reduzir gastos em categoria (ex: gastar menos em delivery)
 * - payment: Quitar uma dívida/valor (ex: pagar cartão)
 * - investment: Investir um valor por mês
 */

export function useGoals() {
  const context = useContext(GoalsContext)
  if (!context) {
    throw new Error('useGoals must be used within a GoalsProvider')
  }
  return context
}

export function GoalsProvider({ children }) {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Carregar metas do Firestore
  useEffect(() => {
    if (!user) {
      setGoals([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, `users/${user.uid}/goals`),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          deadline: doc.data().deadline?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate(),
          completedAt: doc.data().completedAt?.toDate() || null
        }))
        setGoals(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching goals:', err)
        setError('Erro ao carregar metas')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Adicionar meta
  const addGoal = useCallback(async (data) => {
    if (!user) throw new Error('Usuário não autenticado')

    return await addDoc(collection(db, `users/${user.uid}/goals`), {
      name: data.name,
      type: data.type || 'saving',
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount || 0,
      deadline: data.deadline || null,
      categoryId: data.categoryId || null,
      icon: data.icon || 'Target',
      color: data.color || 'violet',
      status: 'active',
      createdAt: serverTimestamp(),
      completedAt: null
    })
  }, [user])

  // Atualizar meta
  const updateGoal = useCallback(async (id, data) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/goals`, id)
    return await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  }, [user])

  // Atualizar progresso da meta
  const updateGoalProgress = useCallback(async (id, amount) => {
    if (!user) throw new Error('Usuário não autenticado')

    const goal = goals.find(g => g.id === id)
    if (!goal) throw new Error('Meta não encontrada')

    const newAmount = amount
    const isCompleted = newAmount >= goal.targetAmount

    const docRef = doc(db, `users/${user.uid}/goals`, id)
    return await updateDoc(docRef, {
      currentAmount: newAmount,
      status: isCompleted ? 'completed' : 'active',
      completedAt: isCompleted ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    })
  }, [user, goals])

  // Deletar meta
  const deleteGoal = useCallback(async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/goals`, id)
    return await deleteDoc(docRef)
  }, [user])

  // Arquivar meta
  const archiveGoal = useCallback(async (id) => {
    if (!user) throw new Error('Usuário não autenticado')

    const docRef = doc(db, `users/${user.uid}/goals`, id)
    return await updateDoc(docRef, {
      status: 'archived',
      updatedAt: serverTimestamp()
    })
  }, [user])

  // Helpers
  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const archivedGoals = goals.filter(g => g.status === 'archived')

  // Calcular progresso percentual
  const getProgress = useCallback((goal) => {
    if (!goal.targetAmount || goal.targetAmount === 0) return 0
    return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
  }, [])

  // Calcular dias restantes
  const getDaysRemaining = useCallback((goal) => {
    if (!goal.deadline) return null
    const now = new Date()
    const deadline = new Date(goal.deadline)
    const diffTime = deadline - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }, [])

  const value = {
    goals,
    activeGoals,
    completedGoals,
    archivedGoals,
    loading,
    error,
    addGoal,
    updateGoal,
    updateGoalProgress,
    deleteGoal,
    archiveGoal,
    getProgress,
    getDaysRemaining
  }

  return (
    <GoalsContext.Provider value={value}>
      {children}
    </GoalsContext.Provider>
  )
}
