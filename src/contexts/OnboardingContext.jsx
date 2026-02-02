import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

const OnboardingContext = createContext()

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao myPay!',
    description: 'Seu app de controle financeiro pessoal. Vamos configurar tudo em poucos passos.'
  },
  {
    id: 'accounts',
    title: 'Suas contas',
    description: 'Adicione suas contas bancárias e carteiras para controlar seus saldos.'
  },
  {
    id: 'categories',
    title: 'Categorias',
    description: 'Criamos algumas categorias padrão. Você pode personalizar depois.'
  },
  {
    id: 'transaction',
    title: 'Primeiro lançamento',
    description: 'Vamos registrar sua primeira transação para você conhecer o fluxo.'
  },
  {
    id: 'complete',
    title: 'Tudo pronto!',
    description: 'Você está pronto para assumir o controle das suas finanças.'
  }
]

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}

export function OnboardingProvider({ children }) {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Carregar estado do onboarding do Firestore
  useEffect(() => {
    if (!user) {
      setLoading(false)
      setShowOnboarding(false)
      return
    }

    const loadOnboardingState = async () => {
      try {
        const docRef = doc(db, `users/${user.uid}/settings/onboarding`)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          setCompleted(data.completed || false)
          setCurrentStep(data.currentStep || 0)
          setShowOnboarding(!data.completed)
        } else {
          // Novo usuário - mostrar onboarding
          setShowOnboarding(true)
          setCompleted(false)
          setCurrentStep(0)
        }
      } catch (error) {
        console.error('Erro ao carregar onboarding:', error)
        setShowOnboarding(false)
      } finally {
        setLoading(false)
      }
    }

    loadOnboardingState()
  }, [user])

  // Salvar progresso no Firestore
  const saveProgress = useCallback(async (step, isCompleted = false) => {
    if (!user) return

    try {
      const docRef = doc(db, `users/${user.uid}/settings/onboarding`)
      await setDoc(docRef, {
        currentStep: step,
        completed: isCompleted,
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (error) {
      console.error('Erro ao salvar progresso do onboarding:', error)
    }
  }, [user])

  // Avançar para próximo passo
  const nextStep = useCallback(async () => {
    const nextIndex = currentStep + 1

    if (nextIndex >= ONBOARDING_STEPS.length) {
      // Concluir onboarding
      setCompleted(true)
      setShowOnboarding(false)
      await saveProgress(nextIndex, true)
    } else {
      setCurrentStep(nextIndex)
      await saveProgress(nextIndex, false)
    }
  }, [currentStep, saveProgress])

  // Voltar para passo anterior
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  // Pular onboarding
  const skipOnboarding = useCallback(async () => {
    setCompleted(true)
    setShowOnboarding(false)
    await saveProgress(ONBOARDING_STEPS.length, true)
  }, [saveProgress])

  // Reiniciar onboarding (para testes)
  const resetOnboarding = useCallback(async () => {
    setCurrentStep(0)
    setCompleted(false)
    setShowOnboarding(true)
    await saveProgress(0, false)
  }, [saveProgress])

  const value = {
    steps: ONBOARDING_STEPS,
    currentStep,
    currentStepData: ONBOARDING_STEPS[currentStep],
    totalSteps: ONBOARDING_STEPS.length,
    completed,
    loading,
    showOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    resetOnboarding,
    setShowOnboarding
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}
